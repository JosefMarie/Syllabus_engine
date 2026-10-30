"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Exam, 
  ExamQuestion, 
  ExamAttempt, 
  QuestionGrade,
  LiveProctoringSession
} from "@/types/exam";
import { Syllabus } from "@/types/syllabus";
import { UserProfile } from "@/types/auth";
import { 
  getExams, 
  getExamAttemptsForStudent, 
  saveExamAttempt, 
  calculateAutoGrade,
  saveLiveProctoringSession,
  subscribeToStudentLiveSession,
  deleteLiveExamSession
} from "@/lib/db";
import { 
  FileQuestion, 
  Clock, 
  Award, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  Check, 
  HelpCircle, 
  Flame, 
  AlertCircle, 
  RotateCcw, 
  Eye, 
  Flag, 
  Send,
  BookOpen,
  Lock,
  Sparkles,
  Maximize2,
  Minimize2,
  Play
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeQuestionRenderer from "@/components/common/CodeQuestionRenderer";

interface ActiveExamSessionBackup {
  examId: string;
  studentUid: string;
  answers: Record<string, any>;
  flaggedQuestions: Record<string, boolean>;
  currentQuestionIdx: number;
  timeRemainingSeconds: number;
  startedAt: string;
  lastSavedAt: string;
  tabSwitchViolations: number;
}

const getExamSessionKey = (studentUid: string) => `active_exam_session_${studentUid}`;

const saveActiveSession = (session: ActiveExamSessionBackup) => {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(getExamSessionKey(session.studentUid), JSON.stringify(session));
    }
  } catch (e) {
    console.warn("Failed to backup active exam session to localStorage:", e);
  }
};

const getActiveSession = (studentUid: string): ActiveExamSessionBackup | null => {
  try {
    if (typeof window !== "undefined") {
      const data = localStorage.getItem(getExamSessionKey(studentUid));
      if (data) {
        return JSON.parse(data);
      }
    }
  } catch (e) {
    console.warn("Failed to read active exam session from localStorage:", e);
  }
  return null;
};

const clearActiveSession = (studentUid: string) => {
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem(getExamSessionKey(studentUid));
    }
  } catch (e) {
    console.warn("Failed to clear active exam session from localStorage:", e);
  }
};

interface StudentExamsViewProps {
  currentUser: UserProfile;
  syllabi?: Syllabus[];
}

export default function StudentExamsView({ currentUser, syllabi = [] }: StudentExamsViewProps) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [myAttempts, setMyAttempts] = useState<ExamAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState<"all" | "quiz" | "exam">("all");
  const [filterCourse, setFilterCourse] = useState("all");

  // Active Exam Hall Modal State
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState<Record<string, any>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(0);
  const [tabSwitchViolations, setTabSwitchViolations] = useState(0);
  const [examStarted, setExamStarted] = useState(false);
  const [submittingAttempt, setSubmittingAttempt] = useState(false);
  const [completedAttempt, setCompletedAttempt] = useState<ExamAttempt | null>(null);
  const [violationToast, setViolationToast] = useState<string | null>(null);

  // Interrupted Session Recovery State
  const [recoveredSession, setRecoveredSession] = useState<ActiveExamSessionBackup | null>(null);
  const [recoveredExam, setRecoveredExam] = useState<Exam | null>(null);
  const examStartedAtRef = useRef<string | null>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Live refs to guarantee stable 5-second proctoring heartbeats without interval thrashing
  const timeRemainingSecondsRef = useRef(timeRemainingSeconds);
  timeRemainingSecondsRef.current = timeRemainingSeconds;

  const studentAnswersRef = useRef(studentAnswers);
  studentAnswersRef.current = studentAnswers;

  const tabSwitchViolationsRef = useRef(tabSwitchViolations);
  tabSwitchViolationsRef.current = tabSwitchViolations;

  const currentQuestionIdxRef = useRef(currentQuestionIdx);
  currentQuestionIdxRef.current = currentQuestionIdx;

  const extraTimeGrantedMinutesRef = useRef(0);
  const currentProctorStatusRef = useRef<"active" | "flagged" | "submitted" | "force_submitted">("active");
  const currentFlagReasonRef = useRef<string | undefined>(undefined);

  const isQuestionAnswered = (val: any): boolean => {
    if (val === undefined || val === null || val === "") return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === "object") return Object.keys(val).length > 0;
    return true;
  };

  // Review Past Attempt Modal
  const [reviewAttempt, setReviewAttempt] = useState<ExamAttempt | null>(null);
  const [reviewExam, setReviewExam] = useState<Exam | null>(null);

  // Fullscreen examination hall state
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
    };
  }, []);

  const enterFullscreen = () => {
    try {
      if (typeof document !== "undefined") {
        const el = document.documentElement as any;
        if (el.requestFullscreen) {
          el.requestFullscreen().catch(() => {});
        } else if (el.webkitRequestFullscreen) {
          el.webkitRequestFullscreen();
        } else if (el.msRequestFullscreen) {
          el.msRequestFullscreen();
        }
      }
    } catch (e) {}
  };

  const exitFullscreen = () => {
    try {
      if (typeof document !== "undefined") {
        const doc = document as any;
        if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement) {
          if (doc.exitFullscreen) {
            doc.exitFullscreen().catch(() => {});
          } else if (doc.webkitExitFullscreen) {
            doc.webkitExitFullscreen();
          } else if (doc.msExitFullscreen) {
            doc.msExitFullscreen();
          }
        }
      }
    } catch (e) {}
  };

  const toggleFullscreen = () => {
    if (typeof document !== "undefined" && (document.fullscreenElement || (document as any).webkitFullscreenElement)) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  };

  // Live timer for countdowns
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getReviewUnlockStatus = (attempt?: ExamAttempt | null, exam?: Exam | null) => {
    if (!attempt || !exam) {
      return { isLocked: true, reason: "No assessment data available", remainingMs: 0, unlockTime: null, isManualLock: true };
    }

    // 1. If instructor explicitly toggled "Release Answers" for this exam, unlock for all students
    if (exam.resultsReleased) {
      return { isLocked: false, reason: "Results released by instructor.", remainingMs: 0, unlockTime: null, isManualLock: false };
    }

    // 2. If instructor set mode to manual_release or turned off showResultsImmediately
    if (exam.showResultsImmediately === false || exam.resultsReleaseMode === "manual_release") {
      return {
        isLocked: true,
        reason: "Detailed answers, resources, and question explanations are held by the instructor to protect test integrity.",
        remainingMs: 0,
        unlockTime: null,
        isManualLock: true
      };
    }

    // 3. If mode is after_due_date: lock until the common class deadline passes
    if (exam.resultsReleaseMode === "after_due_date" && exam.dueDate) {
      const dueMs = new Date(exam.dueDate).getTime();
      const remainingMs = Math.max(0, dueMs - currentTime);
      if (remainingMs > 0) {
        return {
          isLocked: true,
          reason: "Answers will unlock for all students simultaneously after the class submission deadline.",
          remainingMs,
          unlockTime: new Date(dueMs),
          isManualLock: false
        };
      }
      return { isLocked: false, reason: "Class submission deadline has passed.", remainingMs: 0, unlockTime: null, isManualLock: false };
    }

    // 4. If mode is immediate:
    if (exam.resultsReleaseMode === "immediate" || exam.showResultsImmediately === true) {
      return { isLocked: false, reason: "Practice quiz solutions available.", remainingMs: 0, unlockTime: null, isManualLock: false };
    }

    // Default fallback: protect integrity by keeping locked until teacher releases
    return {
      isLocked: true,
      reason: "Answers and resources are held until released by your instructor.",
      remainingMs: 0,
      unlockTime: null,
      isManualLock: true
    };
  };

  const formatRemainingTime = (ms: number) => {
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const remM = m % 60;
      return `${h}h ${remM}m ${s < 10 ? "0" : ""}${s}s`;
    }
    return `${m}m ${s < 10 ? "0" : ""}${s}s`;
  };

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadData();
  }, [currentUser?.uid]);

  const submitInterruptedExpiredAttempt = async (
    saved: ActiveExamSessionBackup,
    exam: Exam,
    pastAttempts: ExamAttempt[]
  ) => {
    try {
      const pastForExam = pastAttempts.filter(a => a.examId === exam.id);
      const attemptNum = pastForExam.length + 1;
      const attemptId = `${exam.id}_${saved.studentUid}_${attemptNum}`;
      const autoRes = calculateAutoGrade(exam, saved.answers || {});
      const timeSpentSeconds = exam.timeLimitMinutes > 0 ? exam.timeLimitMinutes * 60 : 60;

      const attemptPayload: ExamAttempt = {
        id: attemptId,
        examId: exam.id,
        examTitle: exam.title,
        courseCode: exam.courseCode,
        studentUid: currentUser.uid,
        studentName: currentUser.fullName,
        studentUsername: currentUser.username,
        studentTradeId: currentUser.tradeId,
        studentLevel: currentUser.level,
        attemptNumber: attemptNum,
        answers: saved.answers || {},
        score: autoRes.score,
        maxScore: autoRes.maxScore,
        percentage: autoRes.percentage,
        passed: autoRes.passed,
        status: autoRes.hasSubjectiveQuestions ? "submitted" : "graded",
        startedAt: saved.startedAt,
        submittedAt: new Date().toISOString(),
        timeSpentSeconds,
        tabSwitchCount: saved.tabSwitchViolations || 0,
        questionGrades: autoRes.questionGrades,
        gradedAt: autoRes.hasSubjectiveQuestions ? undefined : new Date().toISOString(),
        gradedBy: autoRes.hasSubjectiveQuestions ? undefined : "Automated Engine"
      };

      await saveExamAttempt(attemptPayload);
      setMyAttempts(prev => [attemptPayload, ...prev]);
      clearActiveSession(currentUser.uid);
      alert(`⏰ Interrupted Exam: Time for "${exam.title}" elapsed while offline/power off. Your saved progress has been automatically graded and submitted.`);
    } catch (err) {
      console.error("Failed to auto-submit expired interrupted exam:", err);
    }
  };

  const loadData = async () => {
    // 1. Instant Cache Load: Display local cached exams and attempts in 0ms so slow internet never blocks student
    if (typeof window !== "undefined") {
      try {
        const rawExams = localStorage.getItem("syllabus_platform_exams_v1");
        const studentAttemptsKey = `syllabus_platform_exam_attempts_v1_${currentUser.uid}`;
        const rawAttempts = localStorage.getItem(studentAttemptsKey) || localStorage.getItem("syllabus_platform_exam_attempts_v1");
        if (rawExams) {
          const cachedAll: Exam[] = JSON.parse(rawExams);
          const cachedVisible = cachedAll.filter(e => {
            if (e.status !== "published") return false;
            const matchesLevel = e.level === "all" || !currentUser.level || e.level === currentUser.level;
            const matchesTrade = e.tradeId === "all" || !currentUser.tradeId || e.tradeId === currentUser.tradeId;
            return matchesLevel && matchesTrade;
          });
          setExams(cachedVisible);
          if (rawAttempts) {
            const cachedAttempts: ExamAttempt[] = JSON.parse(rawAttempts);
            setMyAttempts(cachedAttempts.filter(a => a.studentUid === currentUser.uid));
          }
          setLoading(false);
        }
      } catch (e) {}
    }

    try {
      // 2. Fetch network data with 5s timeout safeguard
      const timeoutPromise = new Promise<{ timeout: true }>(resolve => setTimeout(() => resolve({ timeout: true }), 5000));
      const fetchPromise = Promise.all([
        getExams(),
        getExamAttemptsForStudent(currentUser.uid)
      ]);

      const result = await Promise.race([fetchPromise, timeoutPromise]);
      if ("timeout" in result) {
        console.warn("Exams network fetch timed out; continuing with cached data");
        setLoading(false);
        return;
      }

      const [allExams, attemptsList] = result;

      // Only published exams matching student's level and trade
      const visible = allExams.filter(e => {
        if (e.status !== "published") return false;
        const matchesLevel = e.level === "all" || !currentUser.level || e.level === currentUser.level;
        const matchesTrade = e.tradeId === "all" || !currentUser.tradeId || e.tradeId === currentUser.tradeId;
        return matchesLevel && matchesTrade;
      });

      setExams(visible);
      setMyAttempts(attemptsList);

      // Check for an interrupted session saved in localStorage
      const savedSession = getActiveSession(currentUser.uid);
      if (savedSession) {
        const targetExam = visible.find(e => e.id === savedSession.examId) || allExams.find(e => e.id === savedSession.examId);
        if (targetExam) {
          const now = Date.now();
          const lastSavedMs = new Date(savedSession.lastSavedAt).getTime();
          const elapsedSec = Math.max(0, Math.floor((now - lastSavedMs) / 1000));
          let remainingSec = savedSession.timeRemainingSeconds;
          if (targetExam.timeLimitMinutes > 0) {
            remainingSec = Math.max(0, savedSession.timeRemainingSeconds - elapsedSec);
          }

          if (targetExam.timeLimitMinutes > 0 && remainingSec <= 0) {
            // Time expired while power was off or browser closed
            await submitInterruptedExpiredAttempt(savedSession, targetExam, attemptsList);
          } else {
            // Can be resumed
            setRecoveredSession({
              ...savedSession,
              timeRemainingSeconds: remainingSec
            });
            setRecoveredExam(targetExam);
          }
        } else {
          clearActiveSession(currentUser.uid);
        }
      }
    } catch (e) {
      console.error("Error loading student exams:", e);
    } finally {
      setLoading(false);
    }
  };

  // Continuous Auto-Save to localStorage to survive power cuts, battery loss, or accidental closes
  useEffect(() => {
    if (!examStarted || !activeExam || !currentUser?.uid) return;

    const backup: ActiveExamSessionBackup = {
      examId: activeExam.id,
      studentUid: currentUser.uid,
      answers: studentAnswers,
      flaggedQuestions,
      currentQuestionIdx,
      timeRemainingSeconds,
      startedAt: examStartedAtRef.current || new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
      tabSwitchViolations
    };
    saveActiveSession(backup);
  }, [
    examStarted,
    activeExam,
    studentAnswers,
    flaggedQuestions,
    currentQuestionIdx,
    timeRemainingSeconds,
    tabSwitchViolations,
    currentUser?.uid
  ]);

  // Prevent accidental window / tab close or browser navigation during active exams
  useEffect(() => {
    if (!examStarted) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "You have an active examination in progress. Exiting or reloading may affect your score.";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [examStarted]);

  // Anti-Cheating: Detect Window Blur / Tab Switching with 5-second Grace Period
  useEffect(() => {
    if (!examStarted || !activeExam || !activeExam.enableAntiCheating) return;

    const recordViolation = (reason: string) => {
      setTabSwitchViolations(prev => {
        const next = prev + 1;
        setViolationToast(`🚨 Proctoring Alert: ${reason}! (Strike #${next})`);
        setTimeout(() => setViolationToast(null), 5000);
        return next;
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        recordViolation("Tab switched or browser minimized");
      }
    };

    const handleBlur = () => {
      // 5-second grace period: prevents strikes from brief OS popups (antivirus alert, battery low, system prompt)
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = setTimeout(() => {
        recordViolation("Window focus lost for more than 5 seconds");
      }, 5000);
    };

    const handleFocus = () => {
      // Regained focus within 5 seconds -> cancel strike
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [examStarted, activeExam]);

  // Countdown Timer
  useEffect(() => {
    if (!examStarted || !activeExam || activeExam.timeLimitMinutes <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleAutoSubmitTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [examStarted, activeExam]);

  // Anti-Cheating: Block Copying, Right-Click Context Menu, Page Saving & Printing
  useEffect(() => {
    if (!examStarted) return;

    // 1. Block right click / context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setViolationToast("⚠️ Right-click context menu is disabled during exams.");
      setTimeout(() => setViolationToast(null), 3500);
      return false;
    };

    // 2. Block copy and cut outside answer input fields
    const handleCopyCut = (e: ClipboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      e.preventDefault();
      setViolationToast("⚠️ Copying exam questions is strictly prohibited.");
      setTimeout(() => setViolationToast(null), 3500);
      return false;
    };

    // 3. Block selection outside input fields
    const handleSelectStart = (e: Event) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag !== "input" && tag !== "textarea") {
        e.preventDefault();
        return false;
      }
    };

    // 4. Block keyboard shortcuts: Ctrl+C (outside inputs), Ctrl+S (save page), Ctrl+P (print), Ctrl+U (source), F12 (devtools)
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Block Save (Ctrl+S / Cmd+S), Print (Ctrl+P / Cmd+P), View Source (Ctrl+U / Cmd+U)
      if (isCtrlOrMeta && (key === "s" || key === "p" || key === "u")) {
        e.preventDefault();
        setViolationToast("⚠️ Saving, printing, or downloading exam pages is prohibited.");
        setTimeout(() => setViolationToast(null), 3500);
        return false;
      }

      // Block DevTools shortcuts: F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
      if (
        e.key === "F12" ||
        (isCtrlOrMeta && e.shiftKey && (key === "i" || key === "j" || key === "c"))
      ) {
        e.preventDefault();
        setViolationToast("⚠️ Developer tools inspection is blocked during exams.");
        setTimeout(() => setViolationToast(null), 3500);
        return false;
      }

      // Block Copy (Ctrl+C / Cmd+C) outside answer inputs
      if (isCtrlOrMeta && key === "c") {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag !== "input" && tag !== "textarea") {
          e.preventDefault();
          setViolationToast("⚠️ Copying exam content is strictly prohibited.");
          setTimeout(() => setViolationToast(null), 3500);
          return false;
        }
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopyCut);
    document.addEventListener("cut", handleCopyCut);
    document.addEventListener("selectstart", handleSelectStart);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopyCut);
      document.removeEventListener("cut", handleCopyCut);
      document.removeEventListener("selectstart", handleSelectStart);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [examStarted]);

  // Real-Time Proctoring Listener & Heartbeat Sync (Stable: does not thrash timer every second)
  useEffect(() => {
    if (!examStarted || !activeExam || !currentUser?.uid) return;

    extraTimeGrantedMinutesRef.current = 0;
    currentProctorStatusRef.current = "active";
    currentFlagReasonRef.current = undefined;

    // 1. Reactive listener: receive instructor actions (extra time, force-submit, flag)
    const unsub = subscribeToStudentLiveSession(currentUser.uid, activeExam.id, (live) => {
      if (!live) return;

      // Update flag status locally so heartbeats preserve it
      if (live.status === "flagged") {
        currentProctorStatusRef.current = "flagged";
        currentFlagReasonRef.current = live.flagReason;
      } else if (live.status === "active") {
        currentProctorStatusRef.current = "active";
        currentFlagReasonRef.current = undefined;
      }

      // Handle extra time grant from teacher
      if (live.extraTimeGrantedMinutes > extraTimeGrantedMinutesRef.current) {
        const addedMins = live.extraTimeGrantedMinutes - extraTimeGrantedMinutesRef.current;
        extraTimeGrantedMinutesRef.current = live.extraTimeGrantedMinutes;
        setTimeRemainingSeconds(prev => prev + (addedMins * 60));
        setViolationToast(`⏱️ Proctor Notice: Instructor granted you +${addedMins} minute(s) extra time!`);
        setTimeout(() => setViolationToast(null), 6000);
      }

      // Handle remote call-in / force submit
      if (live.forceSubmitRequested || live.status === "force_submitted") {
        alert("⚠️ Proctoring Notice: Your assessment has been force-submitted by the instructor.");
        finalizeSubmission(true);
      }
    });

    const sendHeartbeat = () => {
      const answers = studentAnswersRef.current;
      const answeredCount = Object.keys(answers).filter(k => isQuestionAnswered(answers[k])).length;
      const livePayload: LiveProctoringSession = {
        id: `${activeExam.id}_${currentUser.uid}`,
        examId: activeExam.id,
        examTitle: activeExam.title,
        courseCode: activeExam.courseCode,
        studentUid: currentUser.uid,
        studentName: currentUser.fullName,
        studentUsername: currentUser.username,
        studentLevel: currentUser.level,
        studentTradeId: currentUser.tradeId,
        status: currentProctorStatusRef.current,
        flagReason: currentFlagReasonRef.current,
        startedAt: examStartedAtRef.current || new Date().toISOString(),
        lastHeartbeat: new Date().toISOString(),
        timeLimitMinutes: activeExam.timeLimitMinutes,
        timeRemainingSeconds: timeRemainingSecondsRef.current,
        extraTimeGrantedMinutes: extraTimeGrantedMinutesRef.current,
        tabSwitchViolations: tabSwitchViolationsRef.current,
        answeredQuestionsCount: answeredCount,
        totalQuestions: activeExam.questions.length,
        currentQuestionIndex: currentQuestionIdxRef.current
      };

      saveLiveProctoringSession(livePayload);
    };

    // Send immediate initial ping
    sendHeartbeat();

    // 2. Periodic Heartbeat sync (every 5 seconds)
    const heartbeatTimer = setInterval(sendHeartbeat, 5000);

    return () => {
      unsub();
      clearInterval(heartbeatTimer);
    };
  }, [examStarted, activeExam?.id, currentUser?.uid]);

  // Resume or Discard Interrupted Session
  const handleResumeRecoveredSession = () => {
    if (!recoveredSession || !recoveredExam) return;
    setActiveExam(recoveredExam);
    setStudentAnswers(recoveredSession.answers || {});
    setFlaggedQuestions(recoveredSession.flaggedQuestions || {});
    setCurrentQuestionIdx(recoveredSession.currentQuestionIdx || 0);
    setTimeRemainingSeconds(recoveredSession.timeRemainingSeconds);
    setTabSwitchViolations(recoveredSession.tabSwitchViolations || 0);
    examStartedAtRef.current = recoveredSession.startedAt;
    setExamStarted(true);
    setRecoveredSession(null);
    setRecoveredExam(null);
    enterFullscreen();
  };

  const handleDiscardRecoveredSession = () => {
    if (confirm("Are you sure you want to discard this interrupted exam session? Your saved answers will be deleted.")) {
      if (currentUser?.uid) clearActiveSession(currentUser.uid);
      setRecoveredSession(null);
      setRecoveredExam(null);
    }
  };

  // Start Exam Flow
  const handleOpenExamPreScreen = (exam: Exam) => {
    setActiveExam(exam);
    setExamStarted(false);
    setCurrentQuestionIdx(0);
    setStudentAnswers({});
    setFlaggedQuestions({});
    setTabSwitchViolations(0);
    setCompletedAttempt(null);
    setTimeRemainingSeconds(exam.timeLimitMinutes * 60);
    examStartedAtRef.current = null;
  };

  const handleStartExamConfirmed = () => {
    const startedAt = new Date().toISOString();
    examStartedAtRef.current = startedAt;
    setExamStarted(true);
    enterFullscreen();

    if (activeExam) {
      const initialLiveSession: LiveProctoringSession = {
        id: `${activeExam.id}_${currentUser.uid}`,
        examId: activeExam.id,
        examTitle: activeExam.title,
        courseCode: activeExam.courseCode,
        studentUid: currentUser.uid,
        studentName: currentUser.fullName,
        studentUsername: currentUser.username,
        studentLevel: currentUser.level,
        studentTradeId: currentUser.tradeId,
        status: "active",
        startedAt,
        lastHeartbeat: startedAt,
        timeLimitMinutes: activeExam.timeLimitMinutes,
        timeRemainingSeconds: activeExam.timeLimitMinutes > 0 ? activeExam.timeLimitMinutes * 60 : 0,
        extraTimeGrantedMinutes: 0,
        tabSwitchViolations: 0,
        answeredQuestionsCount: 0,
        totalQuestions: activeExam.questions.length,
        currentQuestionIndex: 0
      };
      saveLiveProctoringSession(initialLiveSession);
    }
  };

  // Select Answer
  const handleAnswerChange = (questionId: string, answerValue: any) => {
    setStudentAnswers(prev => ({
      ...prev,
      [questionId]: answerValue
    }));
  };

  // Toggle Flag Question
  const handleToggleFlag = (questionId: string) => {
    setFlaggedQuestions(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
  };

  // Auto-Submit When Timer Reaches 0
  const handleAutoSubmitTimeUp = () => {
    alert("⏰ Time is up! Your answers are being automatically submitted to your instructor.");
    finalizeSubmission(true);
  };

  // Manual Submit
  const handleManualSubmit = () => {
    if (!activeExam) return;
    const answeredCount = Object.keys(studentAnswers).filter(k => isQuestionAnswered(studentAnswers[k])).length;
    const unansweredCount = activeExam.questions.length - answeredCount;

    let confirmMsg = `Are you sure you want to submit your assessment?`;
    if (unansweredCount > 0) {
      confirmMsg = `You have ${unansweredCount} unanswered question(s). Are you sure you want to submit?`;
    }

    if (confirm(confirmMsg)) {
      finalizeSubmission(false);
    }
  };

  const finalizeSubmission = async (forcedTimeUp = false) => {
    if (!activeExam) return;
    setSubmittingAttempt(true);

    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const pastAttemptsForExam = myAttempts.filter(a => a.examId === activeExam.id);
      const attemptNum = pastAttemptsForExam.length + 1;
      const attemptId = `${activeExam.id}_${currentUser.uid}_${attemptNum}`;

      // Calculate automated score
      const autoRes = calculateAutoGrade(activeExam, studentAnswers);
      const timeSpentSeconds = activeExam.timeLimitMinutes > 0 
        ? Math.max(1, (activeExam.timeLimitMinutes * 60) - timeRemainingSeconds)
        : 60;

      const attemptPayload: ExamAttempt = {
        id: attemptId,
        examId: activeExam.id,
        examTitle: activeExam.title,
        courseCode: activeExam.courseCode,
        studentUid: currentUser.uid,
        studentName: currentUser.fullName,
        studentUsername: currentUser.username,
        studentTradeId: currentUser.tradeId,
        studentLevel: currentUser.level,
        attemptNumber: attemptNum,
        answers: studentAnswers,
        score: autoRes.score,
        maxScore: autoRes.maxScore,
        percentage: autoRes.percentage,
        passed: autoRes.passed,
        status: autoRes.hasSubjectiveQuestions ? "submitted" : "graded",
        startedAt: examStartedAtRef.current || new Date(Date.now() - (timeSpentSeconds * 1000)).toISOString(),
        submittedAt: new Date().toISOString(),
        timeSpentSeconds,
        tabSwitchCount: tabSwitchViolations,
        questionGrades: autoRes.questionGrades,
        gradedAt: autoRes.hasSubjectiveQuestions ? undefined : new Date().toISOString(),
        gradedBy: autoRes.hasSubjectiveQuestions ? undefined : "Automated Engine"
      };

      await saveExamAttempt(attemptPayload);
      clearActiveSession(currentUser.uid);
      setMyAttempts(prev => [attemptPayload, ...prev]);
      setCompletedAttempt(attemptPayload);
      setExamStarted(false);
      exitFullscreen();

      // Update live session status to submitted
      try {
        const livePayload: LiveProctoringSession = {
          id: `${activeExam.id}_${currentUser.uid}`,
          examId: activeExam.id,
          examTitle: activeExam.title,
          courseCode: activeExam.courseCode,
          studentUid: currentUser.uid,
          studentName: currentUser.fullName,
          studentUsername: currentUser.username,
          studentLevel: currentUser.level,
          studentTradeId: currentUser.tradeId,
          status: "submitted",
          startedAt: examStartedAtRef.current || new Date().toISOString(),
          lastHeartbeat: new Date().toISOString(),
          timeLimitMinutes: activeExam.timeLimitMinutes,
          timeRemainingSeconds: 0,
          extraTimeGrantedMinutes: 0,
          tabSwitchViolations,
          answeredQuestionsCount: activeExam.questions.length,
          totalQuestions: activeExam.questions.length,
          currentQuestionIndex: activeExam.questions.length - 1
        };
        await saveLiveProctoringSession(livePayload);
      } catch (e) {}
    } catch (e) {
      console.error("Failed to submit exam attempt:", e);
      alert("Error submitting answers. Please try again.");
    } finally {
      setSubmittingAttempt(false);
    }
  };

  const handleCloseExamHall = () => {
    clearActiveSession(currentUser.uid);
    exitFullscreen();
    setActiveExam(null);
    setExamStarted(false);
    setCompletedAttempt(null);
    examStartedAtRef.current = null;
  };

  // Open Review of Past Attempt
  const handleOpenReview = (attempt: ExamAttempt) => {
    const parentExam = exams.find(e => e.id === attempt.examId) || null;
    setReviewAttempt(attempt);
    setReviewExam(parentExam);
  };

  // Filtered Exams
  const filteredExams = exams.filter(ex => {
    if (filterType !== "all" && ex.type !== filterType) return false;
    if (filterCourse !== "all" && ex.courseCode !== filterCourse) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#334155] bg-[#1E293B]/60 p-12 text-center text-xs font-mono text-[#94A3B8]">
        <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-[#06B6D4] border-t-transparent mb-3" />
        Loading your class examinations &amp; practice quizzes...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#334155] pb-5">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center space-x-2">
            <FileQuestion className="h-5 w-5 text-[#06B6D4]" />
            <span>Examinations &amp; Knowledge Checks</span>
          </h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Take official timed course exams, complete self-paced practice quizzes, and review your scores.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center rounded-xl bg-[#0B0F19]/50 backdrop-blur-md p-1 border border-[#334155]/60">
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                filterType === "all" ? "bg-[#06B6D4] text-slate-950 font-bold" : "text-[#94A3B8] hover:text-white"
              }`}
            >
              All Tests
            </button>
            <button
              onClick={() => setFilterType("quiz")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                filterType === "quiz" ? "bg-[#06B6D4] text-slate-950 font-bold" : "text-[#94A3B8] hover:text-white"
              }`}
            >
              Quizzes
            </button>
            <button
              onClick={() => setFilterType("exam")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                filterType === "exam" ? "bg-[#06B6D4] text-slate-950 font-bold" : "text-[#94A3B8] hover:text-white"
              }`}
            >
              Exams
            </button>
          </div>

          <select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="rounded-xl bg-[#0B0F19]/60 backdrop-blur-md border border-[#334155]/70 px-3 py-1.5 text-xs font-semibold text-[#CBD5E1] focus:border-[#06B6D4] focus:outline-none"
          >
            <option value="all">All Courses</option>
            {syllabi.map((s) => (
              <option key={s.id} value={s.courseCode}>{s.courseCode} - {s.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Interrupted Session Recovery Alert Banner */}
      {recoveredSession && recoveredExam && !activeExam && (
        <div className="rounded-3xl border-2 border-cyan-500/50 bg-gradient-to-r from-cyan-950/70 via-[#0F172A] to-slate-900/90 p-5 sm:p-6 shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shrink-0 shadow-lg">
                <RotateCcw className="h-6 w-6 animate-spin" style={{ animationDuration: '6s' }} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 text-[10px] font-mono font-bold uppercase">
                    Interrupted Session Detected
                  </span>
                  <span className="text-xs font-mono text-cyan-400 font-bold">{recoveredExam.courseCode}</span>
                </div>
                <h3 className="text-sm sm:text-base font-extrabold text-white">
                  Unfinished Assessment: {recoveredExam.title}
                </h3>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  We automatically preserved your test session, answers, and remaining time from an unexpected interruption (power cut, battery loss, or restart).
                  {recoveredExam.timeLimitMinutes > 0 && (
                    <span className="ml-1 text-cyan-300 font-mono font-semibold">
                      Time Remaining: {Math.floor(recoveredSession.timeRemainingSeconds / 60)}m {recoveredSession.timeRemainingSeconds % 60}s.
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 shrink-0 self-end sm:self-center">
              <button
                onClick={handleDiscardRecoveredSession}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-rose-400 bg-[#0B0F19] border border-[#334155] hover:border-rose-500/40 transition-all"
              >
                Discard
              </button>
              <button
                onClick={handleResumeRecoveredSession}
                className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-black text-slate-950 bg-cyan-400 hover:bg-cyan-500 transition-all shadow-xl active:scale-95"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Resume in Fullscreen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tests Grid */}
      {filteredExams.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#334155] bg-[#1E293B]/30 p-10 text-center">
          <FileQuestion className="mx-auto h-12 w-12 text-[#64748B] mb-3" />
          <h3 className="text-base font-bold text-white">No Assessments Posted Yet</h3>
          <p className="text-xs text-[#94A3B8] max-w-md mx-auto mt-1">
            Your instructor hasn't scheduled any formal exams or quizzes for your level ({currentUser.level}) yet. Please check back later.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredExams.map((exam) => {
            const isExam = exam.type === "exam";
            const examAttempts = myAttempts.filter(a => a.examId === exam.id);
            const latestAttempt = examAttempts[0]; // sorted newest first
            const hasAttemptsRemaining = exam.maxAttempts === 0 || examAttempts.length < exam.maxAttempts;
            const isPassed = latestAttempt?.passed;

            return (
              <div
                key={exam.id}
                className="flex flex-col justify-between rounded-3xl border border-[#334155] bg-[#1E293B] p-5 shadow-xl hover:border-[#06B6D4]/50 transition-all group relative overflow-hidden"
              >
                {/* Accent top stripe */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                  isExam 
                    ? "bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-600" 
                    : "bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500"
                }`} />

                <div>
                  {/* Badge Bar */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center space-x-1 rounded-md px-2 py-0.5 text-[10px] font-mono font-bold border ${
                        isExam 
                          ? "bg-purple-500/15 border-purple-500/30 text-purple-300"
                          : "bg-cyan-500/15 border-cyan-500/30 text-cyan-300"
                      }`}>
                        {isExam ? <Award className="h-3 w-3" /> : <HelpCircle className="h-3 w-3" />}
                        <span className="uppercase">{exam.type}</span>
                      </span>

                      <span className="rounded-md bg-[#0B0F19]/60 backdrop-blur-sm border border-[#334155]/60 px-2 py-0.5 text-[10px] font-mono text-[#CBD5E1]">
                        {exam.courseCode}
                      </span>
                    </div>

                    <span className="rounded-md bg-[#0B0F19]/60 backdrop-blur-sm border border-[#334155]/60 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
                      {exam.totalPoints} Pts
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-white group-hover:text-[#06B6D4] transition-colors line-clamp-1 mb-1.5">
                    {exam.title}
                  </h3>

                  <p className="text-xs text-[#94A3B8] line-clamp-2 leading-relaxed mb-4">
                    {exam.description || (exam.courseTitle ? `Assessment covering ${exam.courseTitle}` : "Interactive assessment")}
                  </p>

                  {/* Metadata Chips */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono mb-4">
                    <div className="rounded-xl bg-[#0B0F19]/50 backdrop-blur-md p-2 border border-[#334155]/60">
                      <span className="text-[#64748B] block text-[10px]">TIME ALLOWED</span>
                      <span className="text-white font-bold flex items-center space-x-1 mt-0.5">
                        <Clock className="h-3 w-3 text-cyan-400" />
                        <span>{exam.timeLimitMinutes > 0 ? `${exam.timeLimitMinutes} Mins` : "Untimed"}</span>
                      </span>
                    </div>

                    <div className="rounded-xl bg-[#0B0F19]/50 backdrop-blur-md p-2 border border-[#334155]/60">
                      <span className="text-[#64748B] block text-[10px]">QUESTIONS</span>
                      <span className="text-white font-bold flex items-center space-x-1 mt-0.5">
                        <FileQuestion className="h-3 w-3 text-emerald-400" />
                        <span>{exam.questions.length} Items</span>
                      </span>
                    </div>
                  </div>

                  {/* Status Banner */}
                  {latestAttempt && (
                    <div className={`rounded-xl p-2.5 mb-4 border flex items-center justify-between text-xs font-mono ${
                      isPassed 
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : latestAttempt.status === "submitted"
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    }`}>
                      <div className="flex items-center space-x-1.5">
                        {isPassed ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                        <span>
                          {latestAttempt.status === "submitted" 
                            ? "Submitted (Pending Review)" 
                            : `${latestAttempt.score} / ${latestAttempt.maxScore} (${latestAttempt.percentage}%)`
                          }
                        </span>
                      </div>
                      <span className="text-[10px] font-bold uppercase">
                        {latestAttempt.status === "submitted" ? "In Review" : isPassed ? "Passed" : "Retake Available"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="pt-3 border-t border-[#334155] flex items-center justify-between gap-2">
                  {latestAttempt ? (() => {
                    const unlockInfo = getReviewUnlockStatus(latestAttempt, exam);
                    if (unlockInfo.isLocked) {
                      return (
                        <span
                          className="inline-flex items-center space-x-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-mono text-amber-300"
                          title={unlockInfo.reason}
                        >
                          <Lock className="h-3 w-3 text-amber-400 shrink-0" />
                          <span>
                            {unlockInfo.isManualLock
                              ? "Answers Held by Teacher"
                              : `Unlocks in ${formatRemainingTime(unlockInfo.remainingMs)}`}
                          </span>
                        </span>
                      );
                    }
                    return (
                      <button
                        onClick={() => handleOpenReview(latestAttempt)}
                        className="inline-flex items-center space-x-1 text-xs font-mono text-[#06B6D4] hover:underline"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Review &amp; Explanations</span>
                      </button>
                    );
                  })() : (
                    <span className="text-[11px] font-mono text-[#64748B]">
                      {exam.maxAttempts === 1 ? "1 Attempt Only" : "Multiple Attempts"}
                    </span>
                  )}

                  {hasAttemptsRemaining ? (
                    <button
                      onClick={() => handleOpenExamPreScreen(exam)}
                      className="inline-flex items-center space-x-1.5 rounded-xl bg-[#06B6D4] px-4 py-2 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-md active:scale-95"
                    >
                      <span>{latestAttempt ? "Retake Test" : "Start Test"}</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <span className="inline-flex items-center space-x-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-mono text-slate-400">
                      <Lock className="h-3 w-3" />
                      <span>Max Attempts Reached</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* EXAM HALL MODAL */}
      {/* ========================================================================= */}
      {activeExam && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/95 ${
          examStarted ? "p-0 w-screen h-screen h-[100dvh]" : "p-3 sm:p-6"
        } backdrop-blur-md animate-in fade-in`}>
          <div className={`h-full w-full ${
            examStarted
              ? "h-[100dvh] max-h-screen w-screen max-w-none rounded-none border-0 select-none"
              : "max-h-[96vh] max-w-4xl rounded-3xl border border-[#334155]"
          } overflow-hidden bg-[#0F172A] shadow-2xl flex flex-col relative transition-all duration-300`}>
            
            {/* Anti-Cheat: Suppress Printing, Downloading & Force Non-Selectable Questions */}
            {examStarted && (
              <style dangerouslySetInnerHTML={{
                __html: `
                  @media print {
                    body { display: none !important; }
                  }
                  .select-none, .select-none * {
                    -webkit-user-select: none !important;
                    -moz-user-select: none !important;
                    -ms-user-select: none !important;
                    user-select: none !important;
                  }
                  input, textarea {
                    -webkit-user-select: text !important;
                    -moz-user-select: text !important;
                    -ms-user-select: text !important;
                    user-select: text !important;
                  }
                `
              }} />
            )}

            {/* Proctoring Violation Floating Alert Toast */}
            {violationToast && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[9999] bg-rose-600 text-white font-bold text-xs px-4 py-2.5 rounded-2xl shadow-2xl animate-bounce flex items-center space-x-2">
                <ShieldAlert className="h-4 w-4" />
                <span>{violationToast}</span>
              </div>
            )}

            {/* Strict Fullscreen Required Security Curtain (Blocks exam viewing if fullscreen lost) */}
            {examStarted && !completedAttempt && !isFullscreen && (
              <div className="fixed inset-0 z-[99999] bg-[#070B14]/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
                <div className="max-w-md w-full rounded-3xl border border-cyan-500/40 bg-[#0F172A] p-8 shadow-2xl space-y-5 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-lg">
                    <Maximize2 className="h-8 w-8 animate-pulse text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-white tracking-tight">
                      Fullscreen Required
                    </h3>
                    <p className="text-xs text-[#94A3B8] mt-2 leading-relaxed">
                      To preserve academic integrity and prevent distractions, this assessment requires uninterrupted full-screen display.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#1E293B] border border-[#334155] p-3.5 text-[11px] text-[#CBD5E1] text-left space-y-2">
                    <div className="flex items-center space-x-1.5 text-cyan-400 font-semibold font-mono">
                      <Lock className="h-3.5 w-3.5" />
                      <span>Security &amp; Progress Guard Active</span>
                    </div>
                    <p className="text-slate-400 leading-normal">
                      Your answers and timer are continuously saved. If an antivirus prompt, low battery notification, or accidental keypress closed full-screen, click below to return immediately without penalty.
                    </p>
                  </div>

                  <button
                    onClick={enterFullscreen}
                    type="button"
                    className="w-full inline-flex items-center justify-center space-x-2 rounded-xl bg-cyan-400 hover:bg-cyan-500 px-6 py-3 text-xs font-black text-slate-950 transition-all shadow-xl active:scale-95"
                  >
                    <Maximize2 className="h-4 w-4" />
                    <span>Return to Fullscreen &amp; Continue</span>
                  </button>
                </div>
              </div>
            )}

            {/* PRE-EXAM BRIEFING / CONFIRMATION SCREEN */}
            {!examStarted && !completedAttempt ? (
              <div className="flex-1 overflow-y-auto p-6 sm:p-10 flex flex-col justify-between max-w-2xl mx-auto space-y-6">
                <div className="space-y-4 text-center sm:text-left">
                  <div className="inline-flex items-center space-x-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3.5 py-1 text-xs font-mono text-purple-300">
                    <Award className="h-3.5 w-3.5" />
                    <span className="uppercase">{activeExam.type}: {activeExam.courseCode}</span>
                  </div>

                  <h2 className="text-2xl font-extrabold text-white tracking-tight">
                    {activeExam.title}
                  </h2>

                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    {activeExam.description || "Please read the following examination instructions and integrity protocols carefully before beginning."}
                  </p>

                  {/* Rules Box */}
                  <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-5 space-y-3 text-left">
                    <span className="text-xs font-mono font-bold text-white uppercase tracking-wider block border-b border-[#334155] pb-2">
                      Exam Guidelines &amp; Anti-Cheating Protocol
                    </span>

                    <div className="space-y-2.5 text-xs text-[#CBD5E1]">
                      <div className="flex items-start space-x-2.5">
                        <Clock className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                        <div>
                          <strong>Time Limit:</strong> {activeExam.timeLimitMinutes > 0 ? `${activeExam.timeLimitMinutes} minutes` : "Untimed"}. The countdown starts immediately when you click Begin.
                        </div>
                      </div>

                      <div className="flex items-start space-x-2.5 text-cyan-300">
                        <Lock className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                        <div>
                          <strong>Mandatory Fullscreen &amp; Power-Loss Guard:</strong> Once started, fullscreen is locked until you submit. All your answers and remaining time are continuously backed up in real time, so your work is safe even if your computer restarts or power dies.
                        </div>
                      </div>

                      {activeExam.enableAntiCheating && (
                        <div className="flex items-start space-x-2.5 text-rose-300">
                          <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <strong>Window Lock:</strong> Do NOT switch tabs, minimize the browser, or open other windows. Tab switches are strictly logged and reported to your instructor.
                          </div>
                        </div>
                      )}

                      <div className="flex items-start space-x-2.5">
                        <Award className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <strong>Grading Standard:</strong> Total score is {activeExam.totalPoints} points. The passing score is {activeExam.passPercentage}%.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-[#334155]">
                  <button
                    onClick={handleCloseExamHall}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-[#94A3B8] hover:text-white bg-[#0B0F19] border border-[#334155]"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleStartExamConfirmed}
                    className="inline-flex items-center space-x-2 rounded-xl bg-cyan-400 hover:bg-cyan-500 px-6 py-2.5 text-xs font-extrabold text-slate-950 transition-all shadow-xl active:scale-95"
                  >
                    <span>I Understand &amp; Begin Assessment</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : completedAttempt ? (
              /* COMPLETED ATTEMPT RESULTS SCREEN */
              <div className="flex-1 overflow-y-auto p-6 sm:p-10 flex flex-col justify-between max-w-2xl mx-auto space-y-6">
                <div className="space-y-5 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-inner">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>

                  <div>
                    <h2 className="text-2xl font-extrabold text-white tracking-tight">
                      Assessment Submitted!
                    </h2>
                    <p className="text-xs text-[#94A3B8] mt-1">
                      {activeExam.title} &bull; Time Spent: {Math.floor(completedAttempt.timeSpentSeconds / 60)}m {completedAttempt.timeSpentSeconds % 60}s
                    </p>
                  </div>

                  {/* Score Card */}
                  <div className="rounded-3xl border border-[#334155] bg-[#1E293B] p-6 space-y-3">
                    <span className="text-xs font-mono text-[#94A3B8] uppercase tracking-wider block">
                      Evaluation Result
                    </span>

                    <div className="flex items-center justify-center space-x-3">
                      <span className={`text-4xl font-extrabold font-mono ${
                        completedAttempt.passed ? "text-emerald-400" : "text-rose-400"
                      }`}>
                        {completedAttempt.score} / {completedAttempt.maxScore}
                      </span>
                      <span className={`text-2xl font-mono font-bold ${
                        completedAttempt.passed ? "text-emerald-400" : "text-rose-400"
                      }`}>
                        ({completedAttempt.percentage}%)
                      </span>
                    </div>

                    <div className="pt-2">
                      <span className={`inline-flex items-center space-x-1.5 rounded-full px-4 py-1 text-xs font-mono font-bold uppercase ${
                        completedAttempt.passed 
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                      }`}>
                        {completedAttempt.passed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                        <span>{completedAttempt.passed ? "Passed Examination" : "Did Not Meet Pass Requirement"}</span>
                      </span>
                    </div>

                    {completedAttempt.status === "submitted" && (
                      <p className="text-[11px] text-amber-300 italic pt-2">
                        * Note: This exam contains open written questions currently pending final instructor scoring.
                      </p>
                    )}
                  </div>

                  {/* Review Availability Banner */}
                  {(() => {
                    const unlockInfo = getReviewUnlockStatus(completedAttempt, activeExam);
                    if (unlockInfo.isLocked) {
                      return (
                        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-left space-y-2">
                          <div className="flex items-center space-x-2 text-amber-300 font-bold text-xs font-mono">
                            <Lock className="h-4 w-4 text-amber-400 shrink-0" />
                            <span>Exam Review &amp; Answers Locked</span>
                          </div>
                          <p className="text-xs text-[#CBD5E1] leading-relaxed">
                            {unlockInfo.reason}
                          </p>
                          {!unlockInfo.isManualLock && unlockInfo.unlockTime && unlockInfo.remainingMs > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-500/20 text-[11px] font-mono text-amber-300">
                              <span>Class Deadline: {unlockInfo.unlockTime.toLocaleDateString()} {unlockInfo.unlockTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              <span className="font-bold flex items-center space-x-1.5 text-amber-400">
                                <Clock className="h-3.5 w-3.5 animate-pulse" />
                                <span>Unlocks in {formatRemainingTime(unlockInfo.remainingMs)}</span>
                              </span>
                            </div>
                          )}
                          {unlockInfo.isManualLock && (
                            <p className="text-[11px] font-mono text-amber-400/90 pt-1 border-t border-amber-500/20">
                              Your teacher will release the answers and explanations after all students finish.
                            </p>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-left space-y-2">
                        <div className="flex items-center space-x-2 text-emerald-300 font-bold text-xs font-mono">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span>Exam Review &amp; Explanations Available</span>
                        </div>
                        <p className="text-xs text-[#CBD5E1] leading-relaxed">
                          Official solutions and question explanations are released. You may now review question-by-question rationales.
                        </p>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-6 border-t border-[#334155]">
                  <button
                    onClick={handleCloseExamHall}
                    className="rounded-xl bg-slate-800 border border-[#334155] px-6 py-2.5 text-xs font-bold text-white hover:bg-slate-700 transition-all shadow-md"
                  >
                    Return to Exam Portal
                  </button>

                  {(() => {
                    const unlockInfo = getReviewUnlockStatus(completedAttempt, activeExam);
                    if (unlockInfo.isLocked) {
                      return (
                        <button
                          disabled
                          className="inline-flex items-center space-x-1.5 rounded-xl bg-slate-800/80 border border-slate-700 px-6 py-2.5 text-xs font-bold text-slate-500 cursor-not-allowed shadow-none"
                          title={unlockInfo.reason}
                        >
                          <Lock className="h-4 w-4" />
                          <span>Answers Held by Teacher</span>
                        </button>
                      );
                    }
                    return (
                      <button
                        onClick={() => {
                          const att = completedAttempt;
                          handleCloseExamHall();
                          handleOpenReview(att);
                        }}
                        className="inline-flex items-center space-x-1.5 rounded-xl bg-[#06B6D4] px-6 py-2.5 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-md"
                      >
                        <Eye className="h-4 w-4" />
                        <span>View Exam Review</span>
                      </button>
                    );
                  })()}
                </div>
              </div>
            ) : (
              /* ACTIVE TEST TAKING WORKSPACE */
              <>
                {/* Header with Countdown & Controls */}
                <div className="flex items-center justify-between border-b border-[#334155] px-4 sm:px-6 py-3.5 bg-[#1E293B]/90 shrink-0">
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-mono font-bold text-[#06B6D4] uppercase">
                      {activeExam.courseCode}
                    </span>
                    <span className="text-xs text-white font-bold truncate max-w-[160px] sm:max-w-md">
                      {activeExam.title}
                    </span>
                    <span className="hidden md:inline-flex items-center space-x-1 rounded-md bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 text-[10px] font-mono text-purple-300">
                      <span>Live Examination</span>
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 sm:space-x-3">
                    {/* Live Countdown Timer */}
                    {activeExam.timeLimitMinutes > 0 && (
                      <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-mono font-extrabold text-xs border ${
                        timeRemainingSeconds < 180
                          ? "bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse"
                          : timeRemainingSeconds < 600
                          ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                          : "bg-[#0B0F19] border-[#334155] text-cyan-400"
                      }`}>
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          {Math.floor(timeRemainingSeconds / 60).toString().padStart(2, "0")}:
                          {(timeRemainingSeconds % 60).toString().padStart(2, "0")}
                        </span>
                      </div>
                    )}

                    {/* Fullscreen Mode Locked Indicator */}
                    <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#0B0F19] border border-[#334155] text-cyan-400 text-xs font-mono shadow-inner">
                      <Lock className="h-3.5 w-3.5 text-cyan-400" />
                      <span className="hidden sm:inline text-[11px] font-bold">Fullscreen Locked</span>
                    </div>

                    <button
                      onClick={handleManualSubmit}
                      disabled={submittingAttempt}
                      className="inline-flex items-center space-x-1.5 rounded-xl bg-emerald-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-500 hover:text-white transition-all shadow-md disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>{submittingAttempt ? "Submitting..." : "Finish & Submit"}</span>
                    </button>
                  </div>
                </div>

                {/* Question Palette Strip */}
                <div className="border-b border-[#334155] bg-[#0B0F19] px-6 py-2 flex items-center overflow-x-auto space-x-2 shrink-0">
                  {activeExam.questions.map((q, idx) => {
                    const hasAnswer = isQuestionAnswered(studentAnswers[q.id]);
                    const isFlagged = flaggedQuestions[q.id];
                    const isCurrent = currentQuestionIdx === idx;

                    return (
                      <button
                        key={q.id}
                        onClick={() => setCurrentQuestionIdx(idx)}
                        className={`h-7 w-7 rounded-lg text-xs font-mono font-bold transition-all relative shrink-0 ${
                          isCurrent
                            ? "bg-cyan-500 text-slate-950 ring-2 ring-cyan-300 shadow-md"
                            : isFlagged
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : hasAnswer
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-[#1E293B] text-[#94A3B8] hover:text-white"
                        }`}
                      >
                        {idx + 1}
                        {isFlagged && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-400" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Active Question Workspace */}
                {activeExam.questions[currentQuestionIdx] && (
                  <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-6">
                    {(() => {
                      const q = activeExam.questions[currentQuestionIdx];
                      const currentVal = studentAnswers[q.id];
                      const isFlagged = flaggedQuestions[q.id];

                      return (
                        <div className="space-y-6 max-w-4xl mx-auto">
                          {/* Question Prompt Header */}
                          <div className="flex items-center justify-between border-b border-[#334155] pb-3">
                            <span className="text-xs font-mono font-bold text-[#06B6D4] uppercase">
                              Question {currentQuestionIdx + 1} of {activeExam.questions.length} &bull; {q.points} {q.points === 1 ? "Point" : "Points"}
                            </span>

                            <button
                              onClick={() => handleToggleFlag(q.id)}
                              className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                                isFlagged
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                  : "text-[#94A3B8] hover:text-white bg-[#1E293B]"
                              }`}
                            >
                              <Flag className="h-3 w-3" />
                              <span>{isFlagged ? "Flagged for Review" : "Flag Question"}</span>
                            </button>
                          </div>

                          {/* Prompt Markdown */}
                          <div className="text-sm font-semibold text-white leading-relaxed prose prose-invert prose-sm max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {q.prompt}
                            </ReactMarkdown>
                          </div>

                          {/* Answer Inputs */}
                          <div className="space-y-3 pt-2">
                            {q.type === "multiple_choice" && q.options && (
                              <div className="space-y-2.5">
                                {q.options.map((opt, oIdx) => {
                                  const isSelected = String(currentVal) === String(oIdx);
                                  return (
                                    <div
                                      key={oIdx}
                                      onClick={() => handleAnswerChange(q.id, String(oIdx))}
                                      className={`flex items-center space-x-3 p-4 rounded-2xl border transition-all cursor-pointer ${
                                        isSelected
                                          ? "border-cyan-400 bg-cyan-500/10 shadow-lg text-white"
                                          : "border-[#334155] bg-[#1E293B] text-[#CBD5E1] hover:border-slate-500 hover:text-white"
                                      }`}
                                    >
                                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                        isSelected ? "border-cyan-400 bg-cyan-400" : "border-[#64748B]"
                                      }`}>
                                        {isSelected && <div className="h-2 w-2 rounded-full bg-slate-950" />}
                                      </div>
                                      <span className="text-xs font-medium">{opt}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {q.type === "multiple_select" && q.options && (
                              <div className="space-y-2.5">
                                {q.options.map((opt, oIdx) => {
                                  const arr: string[] = Array.isArray(currentVal) ? currentVal : [];
                                  const isSelected = arr.includes(String(oIdx));
                                  return (
                                    <div
                                      key={oIdx}
                                      onClick={() => {
                                        if (isSelected) {
                                          handleAnswerChange(q.id, arr.filter(v => v !== String(oIdx)));
                                        } else {
                                          handleAnswerChange(q.id, [...arr, String(oIdx)]);
                                        }
                                      }}
                                      className={`flex items-center space-x-3 p-4 rounded-2xl border transition-all cursor-pointer ${
                                        isSelected
                                          ? "border-cyan-400 bg-cyan-500/10 shadow-lg text-white"
                                          : "border-[#334155] bg-[#1E293B] text-[#CBD5E1] hover:border-slate-500 hover:text-white"
                                      }`}
                                    >
                                      <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                                        isSelected ? "border-cyan-400 bg-cyan-400 text-slate-950" : "border-[#64748B]"
                                      }`}>
                                        {isSelected && <Check className="h-3.5 w-3.5 font-bold" />}
                                      </div>
                                      <span className="text-xs font-medium">{opt}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {q.type === "true_false" && (
                              <div className="grid grid-cols-2 gap-4">
                                <button
                                  type="button"
                                  onClick={() => handleAnswerChange(q.id, true)}
                                  className={`p-5 rounded-2xl border text-center transition-all ${
                                    currentVal === true
                                      ? "border-emerald-400 bg-emerald-500/15 text-emerald-400 font-extrabold shadow-lg"
                                      : "border-[#334155] bg-[#1E293B] text-white hover:border-slate-500"
                                  }`}
                                >
                                  <span className="text-base font-bold">True</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleAnswerChange(q.id, false)}
                                  className={`p-5 rounded-2xl border text-center transition-all ${
                                    currentVal === false
                                      ? "border-rose-400 bg-rose-500/15 text-rose-400 font-extrabold shadow-lg"
                                      : "border-[#334155] bg-[#1E293B] text-white hover:border-slate-500"
                                  }`}
                                >
                                  <span className="text-base font-bold">False</span>
                                </button>
                              </div>
                            )}

                            {q.type === "short_answer" && (
                              <div>
                                <label className="block text-xs font-bold text-[#CBD5E1] mb-1">Your Answer:</label>
                                <input
                                  type="text"
                                  value={currentVal || ""}
                                  onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                  placeholder="Type your answer here..."
                                  className="w-full rounded-2xl border border-[#334155] bg-[#0B0F19] p-3.5 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none font-mono"
                                />
                              </div>
                            )}

                            {q.type === "essay" && (
                              <div>
                                <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                                  Your Solution / Detailed Explanation (Markdown &amp; Code Supported):
                                </label>
                                <textarea
                                  rows={8}
                                  value={currentVal || ""}
                                  onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                  placeholder="Type your full answer or code implementation here..."
                                  className="w-full rounded-2xl border border-[#334155] bg-[#0B0F19] p-4 text-xs font-mono text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none leading-relaxed"
                                />
                              </div>
                            )}

                            {["code_completion", "code_ordering", "predict_output"].includes(q.type) && (
                              <CodeQuestionRenderer
                                question={q}
                                mode="take"
                                studentAnswer={currentVal}
                                onChange={(val) => handleAnswerChange(q.id, val)}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Footer Navigation */}
                <div className="flex items-center justify-between border-t border-[#334155] px-6 py-4 bg-[#1E293B]/80 shrink-0">
                  <button
                    disabled={currentQuestionIdx === 0}
                    onClick={() => setCurrentQuestionIdx(prev => Math.max(0, prev - 1))}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-[#CBD5E1] hover:text-white bg-[#0B0F19] border border-[#334155] disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Previous</span>
                  </button>

                  <span className="text-xs font-mono text-[#94A3B8]">
                    {Object.keys(studentAnswers).filter(k => isQuestionAnswered(studentAnswers[k])).length} of {activeExam.questions.length} Answered
                  </span>

                  <button
                    disabled={currentQuestionIdx === activeExam.questions.length - 1}
                    onClick={() => setCurrentQuestionIdx(prev => Math.min(activeExam.questions.length - 1, prev + 1))}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-[#CBD5E1] hover:text-white bg-[#0B0F19] border border-[#334155] disabled:opacity-40"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* REVIEW PAST ATTEMPT MODAL */}
      {/* ========================================================================= */}
      {reviewAttempt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-6 backdrop-blur-md animate-in fade-in">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-[#334155] bg-[#0F172A] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-[#334155] px-6 py-4 bg-[#1E293B]/70 shrink-0">
              <div>
                <h3 className="text-base font-extrabold text-white">
                  Exam Review: {reviewAttempt.examTitle}
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  Score: <strong className={reviewAttempt.passed ? "text-emerald-400" : "text-rose-400"}>{reviewAttempt.score} / {reviewAttempt.maxScore} ({reviewAttempt.percentage}%)</strong> &bull; Completed {new Date(reviewAttempt.submittedAt || reviewAttempt.startedAt).toLocaleDateString()}
                </p>
              </div>

              <button
                onClick={() => setReviewAttempt(null)}
                className="rounded-xl p-1.5 text-[#94A3B8] hover:text-white hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {(() => {
                const unlockInfo = getReviewUnlockStatus(reviewAttempt, reviewExam);

                if (unlockInfo.isLocked) {
                  return (
                    <div className="flex flex-col items-center justify-center p-6 sm:p-10 text-center space-y-5 my-auto">
                      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-xl">
                        <Lock className="h-10 w-10 animate-bounce" />
                      </div>

                      <div className="space-y-2 max-w-md">
                        <span className="inline-flex items-center space-x-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-[11px] font-mono font-bold text-amber-300">
                          <Lock className="h-3 w-3" />
                          <span>Academic Integrity Protocol</span>
                        </span>
                        <h4 className="text-xl font-extrabold text-white">Review &amp; Explanations Locked</h4>
                        <p className="text-xs text-[#94A3B8] leading-relaxed">
                          {unlockInfo.reason}
                        </p>
                      </div>

                      {/* If deadline countdown exists */}
                      {!unlockInfo.isManualLock && unlockInfo.unlockTime && unlockInfo.remainingMs > 0 && (
                        <div className="rounded-2xl border border-amber-500/30 bg-[#0B0F19] p-5 w-full max-w-sm space-y-2.5 shadow-inner text-left">
                          <div className="flex items-center justify-between text-xs font-mono text-[#94A3B8]">
                            <span>Unlocks For All In:</span>
                            <span className="text-amber-400 font-bold flex items-center space-x-1.5">
                              <Clock className="h-3.5 w-3.5 animate-pulse" />
                              <span>{formatRemainingTime(unlockInfo.remainingMs)}</span>
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] font-mono text-[#64748B] pt-1 border-t border-[#1E293B]">
                            <span>Class Deadline: {unlockInfo.unlockTime.toLocaleDateString()} {unlockInfo.unlockTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      )}

                      {/* If teacher manual release */}
                      {unlockInfo.isManualLock && (
                        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 w-full max-w-sm text-center text-xs font-mono text-amber-300/80">
                          To ensure fair testing across students starting at different times, full answers will be unlocked by the instructor after testing concludes.
                        </div>
                      )}

                      <div className="text-xs text-[#94A3B8]">
                        Evaluation score: <strong className={reviewAttempt.passed ? "text-emerald-400" : "text-rose-400"}>{reviewAttempt.score} / {reviewAttempt.maxScore} ({reviewAttempt.percentage}%)</strong>
                      </div>
                    </div>
                  );
                }

                return (
                  <>
                    {/* Unlocked banner */}
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-emerald-300 font-mono">Exam Session Concluded — Review Unlocked</div>
                          <p className="text-[11px] text-[#94A3B8]">You can now view official answers, instructor rationales, and detailed explanations.</p>
                        </div>
                      </div>
                    </div>

                    {/* Teacher Feedback if graded */}
                    {reviewAttempt.teacherFeedback && (
                      <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 space-y-1">
                        <span className="text-xs font-bold text-cyan-300 font-mono flex items-center space-x-1.5">
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Teacher Remarks &amp; Feedback:</span>
                        </span>
                        <p className="text-xs text-[#CBD5E1] italic">"{reviewAttempt.teacherFeedback}"</p>
                      </div>
                    )}

                    {/* Questions breakdown */}
                    {reviewExam && reviewExam.questions.map((q, idx) => {
                      const ans = reviewAttempt.answers[q.id];
                      const grade = reviewAttempt.questionGrades?.[q.id];
                      const isFullPoints = (grade?.awardedPoints ?? 0) === q.points;

                      return (
                        <div key={q.id} className="rounded-2xl border border-[#334155] bg-[#1E293B] p-4 space-y-3">
                          <div className="flex items-center justify-between border-b border-[#334155]/60 pb-2">
                            <span className="text-xs font-mono font-bold text-[#06B6D4]">
                              Question #{idx + 1} &bull; <span className="uppercase text-[10px] text-[#94A3B8]">{q.type.replace('_', ' ')}</span>
                            </span>
                            <span className={`text-xs font-mono font-bold ${
                              isFullPoints ? "text-emerald-400" : "text-amber-400"
                            }`}>
                              {grade?.awardedPoints ?? 0} / {q.points} Points
                            </span>
                          </div>

                          <p className="text-xs text-white font-medium">{q.prompt}</p>

                          {["code_completion", "code_ordering", "predict_output"].includes(q.type) ? (
                            <CodeQuestionRenderer
                              question={q}
                              mode="review"
                              studentAnswer={ans}
                              grade={grade}
                              showCorrectAnswer={true}
                            />
                          ) : q.options && (q.type === "multiple_choice" || q.type === "true_false" || q.type === "multiple_select") ? (
                            <div className="space-y-1.5 pt-1">
                              <span className="text-[10px] font-mono text-[#94A3B8] uppercase block">Choices &amp; Answers:</span>
                              {q.options.map((opt, optIdx) => {
                                const isUserSelected = Array.isArray(ans) ? ans.includes(opt) : ans === opt;
                                const isOfficialCorrect = Array.isArray(q.correctAnswer)
                                  ? q.correctAnswer.includes(opt)
                                  : String(q.correctAnswer).toLowerCase() === String(opt).toLowerCase();

                                return (
                                  <div
                                    key={optIdx}
                                    className={`flex items-center justify-between p-2.5 rounded-xl text-xs border transition-colors ${
                                      isOfficialCorrect
                                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200"
                                        : isUserSelected && !isOfficialCorrect
                                        ? "bg-rose-500/15 border-rose-500/40 text-rose-200"
                                        : "bg-[#0B0F19] border-[#334155]/60 text-[#CBD5E1]"
                                    }`}
                                  >
                                    <div className="flex items-center space-x-2">
                                      <span className="font-mono text-[10px] text-[#64748B]">
                                        {String.fromCharCode(65 + optIdx)}.
                                      </span>
                                      <span>{opt}</span>
                                    </div>

                                    <div className="flex items-center space-x-1.5 shrink-0 text-[10px] font-mono">
                                      {isOfficialCorrect && (
                                        <span className="inline-flex items-center space-x-1 rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-400 font-bold">
                                          <Check className="h-3 w-3" />
                                          <span>Correct Answer</span>
                                        </span>
                                      )}
                                      {isUserSelected && (
                                        <span className={`inline-flex items-center space-x-1 rounded px-2 py-0.5 font-bold ${
                                          isOfficialCorrect ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                                        }`}>
                                          <span>Your Selection</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="rounded-xl bg-[#0B0F19] p-3 text-xs border border-[#334155]">
                                <span className="text-[10px] font-mono text-[#94A3B8] uppercase block mb-1">Your Submitted Answer:</span>
                                <div className="font-mono text-white whitespace-pre-wrap">
                                  {ans !== undefined && ans !== null
                                    ? (Array.isArray(ans) ? ans.join(", ") : String(ans))
                                    : <span className="text-slate-500 italic">No answer submitted</span>
                                  }
                                </div>
                              </div>

                              {q.correctAnswer && (
                                <div className="rounded-xl bg-emerald-500/10 p-3 text-xs border border-emerald-500/30">
                                  <span className="text-[10px] font-mono text-emerald-400 uppercase block mb-1">Expected Correct Answer:</span>
                                  <div className="font-mono text-emerald-300 whitespace-pre-wrap">
                                    {String(q.correctAnswer)}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Question Explanation */}
                          {q.explanation && (
                            <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/25 p-3.5 text-xs text-cyan-200 space-y-1">
                              <strong className="flex items-center space-x-1.5 text-[10px] font-mono uppercase text-cyan-300">
                                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                                <span>Explanation &amp; Solution Rationale:</span>
                              </strong>
                              <p className="leading-relaxed text-[#E2E8F0]">{q.explanation}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>

            <div className="flex justify-end border-t border-[#334155] px-6 py-4 bg-[#1E293B]/70 shrink-0">
              <button
                onClick={() => setReviewAttempt(null)}
                className="rounded-xl bg-[#334155] px-6 py-2 text-xs font-bold text-white hover:bg-slate-600 transition-all"
              >
                Close Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
