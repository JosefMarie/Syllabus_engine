"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Exam, 
  ExamQuestion, 
  ExamAttempt, 
  QuestionGrade 
} from "@/types/exam";
import { Syllabus } from "@/types/syllabus";
import { UserProfile } from "@/types/auth";
import { 
  getExams, 
  getExamAttemptsForStudent, 
  saveExamAttempt, 
  calculateAutoGrade 
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
  Sparkles
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeQuestionRenderer from "@/components/common/CodeQuestionRenderer";

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

  const isQuestionAnswered = (val: any): boolean => {
    if (val === undefined || val === null || val === "") return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === "object") return Object.keys(val).length > 0;
    return true;
  };

  // Review Past Attempt Modal
  const [reviewAttempt, setReviewAttempt] = useState<ExamAttempt | null>(null);
  const [reviewExam, setReviewExam] = useState<Exam | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadData();
  }, [currentUser?.uid]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allExams, attemptsList] = await Promise.all([
        getExams(),
        getExamAttemptsForStudent(currentUser.uid)
      ]);

      // Only published exams matching student's level and trade
      const visible = allExams.filter(e => {
        if (e.status !== "published") return false;
        const matchesLevel = e.level === "all" || !currentUser.level || e.level === currentUser.level;
        const matchesTrade = e.tradeId === "all" || !currentUser.tradeId || e.tradeId === currentUser.tradeId;
        return matchesLevel && matchesTrade;
      });

      setExams(visible);
      setMyAttempts(attemptsList);
    } catch (e) {
      console.error("Error loading student exams:", e);
    } finally {
      setLoading(false);
    }
  };

  // Anti-Cheating: Detect Window Blur / Tab Switching
  useEffect(() => {
    if (!examStarted || !activeExam || !activeExam.enableAntiCheating) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        recordViolation();
      }
    };

    const handleBlur = () => {
      recordViolation();
    };

    const recordViolation = () => {
      setTabSwitchViolations(prev => {
        const next = prev + 1;
        setViolationToast(`🚨 Proctoring Alert: Side window switch detected! (Strike #${next})`);
        setTimeout(() => setViolationToast(null), 4000);
        return next;
      });
    };

    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("blur", handleBlur);
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
  };

  const handleStartExamConfirmed = () => {
    setExamStarted(true);
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
        startedAt: new Date(Date.now() - (timeSpentSeconds * 1000)).toISOString(),
        submittedAt: new Date().toISOString(),
        timeSpentSeconds,
        tabSwitchCount: tabSwitchViolations,
        questionGrades: autoRes.questionGrades,
        gradedAt: autoRes.hasSubjectiveQuestions ? undefined : new Date().toISOString(),
        gradedBy: autoRes.hasSubjectiveQuestions ? undefined : "Automated Engine"
      };

      await saveExamAttempt(attemptPayload);
      setMyAttempts(prev => [attemptPayload, ...prev]);
      setCompletedAttempt(attemptPayload);
    } catch (e) {
      console.error("Failed to submit exam attempt:", e);
      alert("Error submitting answers. Please try again.");
    } finally {
      setSubmittingAttempt(false);
    }
  };

  const handleCloseExamHall = () => {
    setActiveExam(null);
    setExamStarted(false);
    setCompletedAttempt(null);
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
                  {latestAttempt ? (
                    <button
                      onClick={() => handleOpenReview(latestAttempt)}
                      className="inline-flex items-center space-x-1 text-xs font-mono text-[#06B6D4] hover:underline"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Review Answers</span>
                    </button>
                  ) : (
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 sm:p-6 backdrop-blur-lg animate-in fade-in">
          <div className="h-full max-h-[96vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-[#334155] bg-[#0F172A] shadow-2xl flex flex-col relative">
            
            {/* Proctoring Violation Floating Alert Toast */}
            {violationToast && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[9999] bg-rose-600 text-white font-bold text-xs px-4 py-2.5 rounded-2xl shadow-2xl animate-bounce flex items-center space-x-2">
                <ShieldAlert className="h-4 w-4" />
                <span>{violationToast}</span>
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
                </div>

                <div className="flex justify-center pt-6 border-t border-[#334155]">
                  <button
                    onClick={handleCloseExamHall}
                    className="rounded-xl bg-[#06B6D4] px-8 py-2.5 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-md"
                  >
                    Return to Exam Portal
                  </button>
                </div>
              </div>
            ) : (
              /* ACTIVE TEST TAKING WORKSPACE */
              <>
                {/* Header with Countdown & Controls */}
                <div className="flex items-center justify-between border-b border-[#334155] px-6 py-3.5 bg-[#1E293B]/80 shrink-0">
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-mono font-bold text-[#06B6D4] uppercase">
                      {activeExam.courseCode}
                    </span>
                    <span className="text-xs text-white font-bold truncate max-w-[200px] sm:max-w-xs">
                      {activeExam.title}
                    </span>
                  </div>

                  <div className="flex items-center space-x-4">
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

                    <button
                      onClick={handleManualSubmit}
                      disabled={submittingAttempt}
                      className="inline-flex items-center space-x-1.5 rounded-xl bg-emerald-400 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-500 hover:text-white transition-all shadow-md disabled:opacity-50"
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
                  <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
                    {(() => {
                      const q = activeExam.questions[currentQuestionIdx];
                      const currentVal = studentAnswers[q.id];
                      const isFlagged = flaggedQuestions[q.id];

                      return (
                        <div className="space-y-6 max-w-2xl mx-auto">
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
                        Question #{idx + 1}
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
                    ) : (
                      <div className="rounded-xl bg-[#0B0F19] p-3 text-xs border border-[#334155]">
                        <span className="text-[10px] font-mono text-[#94A3B8] uppercase block mb-1">Your Answer:</span>
                        <div className="font-mono text-white">
                          {ans !== undefined && ans !== null
                            ? (Array.isArray(ans) ? ans.join(", ") : String(ans))
                            : <span className="text-slate-500 italic">No answer submitted</span>
                          }
                        </div>
                      </div>
                    )}

                    {q.explanation && (
                      <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-3 text-xs text-cyan-200">
                        <strong className="block text-[10px] font-mono uppercase text-cyan-300 mb-0.5">Explanation:</strong>
                        <span>{q.explanation}</span>
                      </div>
                    )}
                  </div>
                );
              })}
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
