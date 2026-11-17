"use client";

import React, { useState, useEffect } from "react";
import { 
  Exam, 
  ExamQuestion, 
  QuestionType, 
  ExamAttempt, 
  QuestionGrade,
  ExamType,
  StudentExamOverride
} from "@/types/exam";
import { Syllabus } from "@/types/syllabus";
import { Trade, StudentLevel, UserProfile } from "@/types/auth";
import { 
  getExams, 
  saveExam, 
  deleteExam, 
  subscribeToExams, 
  getAllExamAttempts,
  saveExamAttempt,
  getExamAttemptsForExam,
  subscribeToAllExamAttempts,
  subscribeToExamAttempts
} from "@/lib/db";
import { 
  FileQuestion, 
  Plus, 
  Search, 
  Clock, 
  Award, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Edit3, 
  Trash2, 
  Eye, 
  ChevronRight, 
  X, 
  Send, 
  RefreshCw, 
  Shuffle, 
  Sliders, 
  BookOpen, 
  Users, 
  HelpCircle,
  FileText,
  Code,
  CheckSquare,
  Radio,
  Flame,
  UserCheck,
  Download,
  Upload,
  FileSpreadsheet,
  FileCode,
  Check,
  ChevronDown,
  Sparkles,
  Copy,
  Bot,
  Server,
  WifiOff,
  ExternalLink,
  EyeOff,
  Lock,
  BarChart3,
  CalendarClock,
  UserPlus
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeQuestionRenderer from "@/components/common/CodeQuestionRenderer";
import {
  downloadExamTemplateCSV,
  downloadExamTemplateJSON,
  downloadExamTemplatePlainText,
  downloadExamTemplateMarkdown,
  copyAIPromptToClipboard,
  exportExamQuestionsToCSV,
  exportExamQuestionsToJSON,
  exportExamQuestionsToPlainText,
  exportExamQuestionsToMarkdown,
  autoDetectAndParseQuestions,
  AI_GENERATION_PROMPT
} from "@/lib/examImportExport";

interface ExamManagerProps {
  adminUser?: UserProfile | null;
  syllabi?: Syllabus[];
  trades?: Trade[];
}

export default function ExamManager({ adminUser, syllabi = [], trades = [] }: ExamManagerProps) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | ExamType>("all");
  const [filterCourse, setFilterCourse] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");

  // Modals
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);

  // Builder Form State
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCourseCode, setFormCourseCode] = useState("");
  const [formTradeId, setFormTradeId] = useState("all");
  const [formLevel, setFormLevel] = useState<StudentLevel | "all">("all");
  const [formType, setFormType] = useState<ExamType>("quiz");
  const [formTimeLimit, setFormTimeLimit] = useState(30);
  const [formPassPercentage, setFormPassPercentage] = useState(70);
  const [formMaxAttempts, setFormMaxAttempts] = useState(1);
  const [formShuffleQuestions, setFormShuffleQuestions] = useState(true);
  const [formAntiCheating, setFormAntiCheating] = useState(true);
  const [formShowResultsImmediately, setFormShowResultsImmediately] = useState(false);
  const [formResultsReleaseMode, setFormResultsReleaseMode] = useState<'manual_release' | 'after_due_date' | 'immediate'>('manual_release');
  const [formAvailableFrom, setFormAvailableFrom] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formQuestionDrawCount, setFormQuestionDrawCount] = useState(0);
  const [formMaxTabSwitches, setFormMaxTabSwitches] = useState(0);
  const [formRequireFullscreen, setFormRequireFullscreen] = useState(true);
  const [formLockCopyPaste, setFormLockCopyPaste] = useState(true);
  const [formQuestions, setFormQuestions] = useState<ExamQuestion[]>([]);
  const [builderTab, setBuilderTab] = useState<"settings" | "questions">("settings");
  const [savingExam, setSavingExam] = useState(false);

  // Question Form State (within builder)
  const [editingQuestionIdx, setEditingQuestionIdx] = useState<number | null>(null);
  const [qPrompt, setQPrompt] = useState("");
  const [qType, setQType] = useState<QuestionType>("multiple_choice");
  const [qOptions, setQOptions] = useState<string[]>(["", "", "", ""]);
  const [qCorrectSingle, setQCorrectSingle] = useState("0");
  const [qCorrectMulti, setQCorrectMulti] = useState<string[]>(["0"]);
  const [qCorrectTF, setQCorrectTF] = useState(true);
  const [qCorrectText, setQCorrectText] = useState("");
  const [qPoints, setQPoints] = useState(5);
  const [qExplanation, setQExplanation] = useState("");
  const [qCodeSnippet, setQCodeSnippet] = useState("");
  const [qCodeLanguage, setQCodeLanguage] = useState("typescript");
  const [qCodeBlanksText, setQCodeBlanksText] = useState("");
  const [qCodeLinesText, setQCodeLinesText] = useState("");

  // Submissions Desk State
  const [selectedExamForSubmissions, setSelectedExamForSubmissions] = useState<Exam | null>(null);
  const [examAttempts, setExamAttempts] = useState<ExamAttempt[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [attemptsSearchQuery, setAttemptsSearchQuery] = useState("");
  const [expandedStudentGroups, setExpandedStudentGroups] = useState<Record<string, boolean>>({});

  // Per-Student Override Modal State (Extra Attempts / Extra Time / Extended Deadline)
  const [overrideTargetStudent, setOverrideTargetStudent] = useState<{ uid: string; name: string; username: string } | null>(null);
  const [overrideExtraAttempts, setOverrideExtraAttempts] = useState(1);
  const [overrideExtraMinutes, setOverrideExtraMinutes] = useState(0);
  const [overrideExtendedDueDate, setOverrideExtendedDueDate] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);

  // Analytics Modal State
  const [analyticsExam, setAnalyticsExam] = useState<Exam | null>(null);
  const [analyticsAttempts, setAnalyticsAttempts] = useState<ExamAttempt[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Manual Grading Modal State
  const [gradingAttempt, setGradingAttempt] = useState<ExamAttempt | null>(null);
  const [editableGrades, setEditableGrades] = useState<Record<string, { awardedPoints: number; feedback: string }>>({});
  const [generalFeedback, setGeneralFeedback] = useState("");
  const [savingGrade, setSavingGrade] = useState(false);

  // Bulk Question Import & Template State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importInputText, setImportInputText] = useState("");
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [parsedPreviewQuestions, setParsedPreviewQuestions] = useState<ExamQuestion[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(false);
  const [isBuilderTemplateMenuOpen, setIsBuilderTemplateMenuOpen] = useState(false);
  const [importFormatSelection, setImportFormatSelection] = useState<"auto" | "plain_text" | "csv" | "json">("auto");
  const [detectedFormat, setDetectedFormat] = useState<"plain_text" | "csv" | "json">("plain_text");
  const [copiedAIPrompt, setCopiedAIPrompt] = useState(false);

  // Import Source Tab: upload file, paste text, or live sync from Python AMS
  const [importSourceTab, setImportSourceTab] = useState<"upload" | "paste" | "ams_sync">("upload");

  // AMS Live Sync State
  const [amsEndpointUrl, setAmsEndpointUrl] = useState("http://127.0.0.1:8000/api/exams/generate/");
  const [amsTopic, setAmsTopic] = useState("");
  const [amsQuestionCount, setAmsQuestionCount] = useState(5);
  const [amsDifficulty, setAmsDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [amsSyncing, setAmsSyncing] = useState(false);
  const [amsSyncError, setAmsSyncError] = useState<string | null>(null);
  const [amsSyncSuccess, setAmsSyncSuccess] = useState<string | null>(null);

  // Load persisted AMS URL from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ams_exam_api_url");
      if (saved) setAmsEndpointUrl(saved);
    } catch {}
  }, []);

  const handleSyncWithAMS = async () => {
    setAmsSyncError(null);
    setAmsSyncSuccess(null);
    setAmsSyncing(true);

    try {
      localStorage.setItem("ams_exam_api_url", amsEndpointUrl.trim());
    } catch {}

    const topicQuery = amsTopic.trim() || formTitle.trim() || "Computer Science Assessment";

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(amsEndpointUrl.trim(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/markdown, text/plain"
        },
        body: JSON.stringify({
          topic: topicQuery,
          num_questions: amsQuestionCount,
          difficulty: amsDifficulty
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`AMS responded with status ${res.status}: ${res.statusText}`);
      }

      const contentType = res.headers.get("content-type") || "";
      let markdownContent = "";

      if (contentType.includes("application/json")) {
        const data = await res.json();
        markdownContent = data.markdown || data.text || data.content || (typeof data === "string" ? data : JSON.stringify(data, null, 2));
      } else {
        markdownContent = await res.text();
      }

      if (!markdownContent || !markdownContent.trim()) {
        throw new Error("AMS server returned empty content.");
      }

      setImportInputText(markdownContent);
      setImportFileName("ams_generated_exam.md");
      runParseContent(markdownContent, "ams_generated_exam.md", "plain_text");
      setAmsSyncSuccess(`Successfully fetched and parsed questions for "${topicQuery}" from AMS!`);
    } catch (err: any) {
      console.error("AMS sync error:", err);
      let errMsg = err.message || "Failed to connect to AMS.";
      if (err.name === "AbortError") {
        errMsg = "Request timed out after 12 seconds. Ensure your Django server is running and reachable.";
      } else if (errMsg.includes("Failed to fetch") || errMsg.includes("NetworkError")) {
        errMsg = `Could not connect to AMS at ${amsEndpointUrl}. If your Django server is running locally on HTTP and this app is accessed over HTTPS, the browser blocks direct requests (Mixed Content).`;
      }
      setAmsSyncError(errMsg);
    } finally {
      setAmsSyncing(false);
    }
  };

  const handleCopyAIPrompt = async () => {
    const ok = await copyAIPromptToClipboard();
    if (ok) {
      setCopiedAIPrompt(true);
      setTimeout(() => setCopiedAIPrompt(false), 2500);
    }
  };

  const runParseContent = (text: string, filenameHint?: string, forcedFormat?: "auto" | "plain_text" | "csv" | "json") => {
    const trimmed = text.trim();
    if (!trimmed) {
      setParsedPreviewQuestions([]);
      setImportErrors([]);
      return;
    }
    const fmt = forcedFormat || importFormatSelection;
    const res = autoDetectAndParseQuestions(text, filenameHint, fmt);
    setParsedPreviewQuestions(res.questions);
    setImportErrors(res.errors);
    setDetectedFormat(res.detectedFormat);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      setImportInputText(content);
      runParseContent(content, file.name);
    };
    reader.readAsText(file);
    // Reset input value so re-selecting same file triggers onChange
    e.target.value = "";
  };

  const handleTextareaChange = (text: string) => {
    setImportInputText(text);
    runParseContent(text);
  };

  const handleConfirmImport = () => {
    if (parsedPreviewQuestions.length === 0) return;
    if (importMode === "replace") {
      setFormQuestions(parsedPreviewQuestions);
    } else {
      setFormQuestions(prev => [...prev, ...parsedPreviewQuestions]);
    }
    setIsImportModalOpen(false);
    setImportInputText("");
    setImportFileName(null);
    setParsedPreviewQuestions([]);
    setImportErrors([]);
  };

  useEffect(() => {
    // 1. Immediate local cache retrieval to prevent UI block
    try {
      const cached = localStorage.getItem("syllabus_platform_exams_v1");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setExams(parsed);
          setLoading(false);
        }
      }
    } catch {}

    // 2. Real-time live Firestore subscription for exams
    const unsubExams = subscribeToExams((freshExams) => {
      setExams(freshExams);
      setLoading(false);
    });

    // 3. Real-time live Firestore subscription for attempts
    const unsubAttempts = subscribeToAllExamAttempts((freshAttempts) => {
      setAttempts(freshAttempts);
    });

    // 4. Async initial fetch
    loadAll();

    return () => {
      unsubExams();
      unsubAttempts();
    };
  }, []);

  // Sync selected exam attempts whenever attempts update
  useEffect(() => {
    if (selectedExamForSubmissions) {
      const matching = attempts.filter(a => a.examId === selectedExamForSubmissions.id);
      setExamAttempts(matching);
    }
  }, [attempts, selectedExamForSubmissions?.id]);

  const handleDownloadExamMarksCSV = () => {
    if (!selectedExamForSubmissions || examAttempts.length === 0) return;
    const rows = [
      [
        "Student Name",
        "Username",
        "Trade",
        "Class Level",
        "Attempt Number",
        "Score Awarded",
        "Total Points",
        "Percentage",
        "Academic Result",
        "Proctoring Strikes",
        "Time Spent (Seconds)",
        "Grading Status",
        "Submitted At"
      ]
    ];

    examAttempts.forEach((att) => {
      const maxPts = att.maxScore && att.maxScore > 0 ? att.maxScore : (selectedExamForSubmissions.totalPoints || 100);
      const score = att.score ?? 0;
      const pct = att.percentage !== undefined ? att.percentage : Math.round((score / maxPts) * 100);
      const passed = att.passed ? "PASSED" : "FAILED";

      rows.push([
        `"${(att.studentName || "").replace(/"/g, '""')}"`,
        `"${(att.studentUsername || "").replace(/"/g, '""')}"`,
        `"${(att.studentTradeId || "").replace(/"/g, '""')}"`,
        `"${(att.studentLevel || "").replace(/"/g, '""')}"`,
        String(att.attemptNumber || 1),
        String(score),
        String(maxPts),
        `${pct}%`,
        passed,
        String(att.tabSwitchCount || 0),
        String(att.timeSpentSeconds || 0),
        att.status || "submitted",
        att.submittedAt ? `"${att.submittedAt}"` : '""'
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((r) => r.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const safeTitle = (selectedExamForSubmissions.title || "exam").toLowerCase().replace(/[^a-z0-9]/g, "_");
    link.setAttribute("download", `${safeTitle}_marks_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loadAll = async () => {
    try {
      const [exList, attList] = await Promise.all([
        getExams().catch(() => []),
        getAllExamAttempts().catch(() => [])
      ]);
      if (exList && exList.length > 0) setExams(exList);
      if (attList && attList.length > 0) setAttempts(attList);
    } catch (e) {
      console.warn("Exams/Attempts load fallback:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAll();
  };

  // Open Builder for New Assessment
  const handleOpenNewBuilder = () => {
    setEditingExamId(null);
    setFormTitle("");
    setFormDescription("");
    setFormCourseCode(syllabi.length > 0 ? syllabi[0].courseCode : "");
    setFormTradeId("all");
    setFormLevel("all");
    setFormType("quiz");
    setFormTimeLimit(20);
    setFormPassPercentage(70);
    setFormMaxAttempts(0); // 0 = unlimited for practice quiz
    setFormShuffleQuestions(true);
    setFormAntiCheating(true);
    setFormShowResultsImmediately(false);
    setFormResultsReleaseMode("manual_release");
    setFormAvailableFrom("");
    setFormDueDate("");
    setFormQuestionDrawCount(0);
    setFormMaxTabSwitches(0);
    setFormRequireFullscreen(true);
    setFormLockCopyPaste(true);
    setFormQuestions([]);
    setBuilderTab("settings");
    resetQuestionSubForm();
    setIsBuilderOpen(true);
  };

  // Open Builder for Existing Assessment
  const handleEditExam = (exam: Exam) => {
    setEditingExamId(exam.id);
    setFormTitle(exam.title);
    setFormDescription(exam.description);
    setFormCourseCode(exam.courseCode);
    setFormTradeId(exam.tradeId);
    setFormLevel(exam.level);
    setFormType(exam.type);
    setFormTimeLimit(exam.timeLimitMinutes);
    setFormPassPercentage(exam.passPercentage);
    setFormMaxAttempts(exam.maxAttempts);
    setFormShuffleQuestions(exam.shuffleQuestions ?? true);
    setFormAntiCheating(exam.enableAntiCheating ?? false);
    const releaseMode = exam.resultsReleaseMode || (exam.showResultsImmediately ? "immediate" : "manual_release");
    setFormResultsReleaseMode(releaseMode);
    setFormShowResultsImmediately(exam.showResultsImmediately ?? (releaseMode === "immediate"));
    setFormAvailableFrom(exam.availableFrom ? exam.availableFrom.slice(0, 16) : "");
    setFormDueDate(exam.dueDate ? exam.dueDate.slice(0, 16) : "");
    setFormQuestionDrawCount(exam.questionDrawCount ?? 0);
    setFormMaxTabSwitches(exam.maxTabSwitches ?? 0);
    setFormRequireFullscreen(exam.requireFullscreen ?? true);
    setFormLockCopyPaste(exam.lockCopyPaste ?? true);
    setFormQuestions(exam.questions || []);
    setBuilderTab("settings");
    resetQuestionSubForm();
    setIsBuilderOpen(true);
  };

  const resetQuestionSubForm = () => {
    setEditingQuestionIdx(null);
    setQPrompt("");
    setQType("multiple_choice");
    setQOptions(["", "", "", ""]);
    setQCorrectSingle("0");
    setQCorrectMulti(["0"]);
    setQCorrectTF(true);
    setQCorrectText("");
    setQPoints(5);
    setQExplanation("");
    setQCodeSnippet("");
    setQCodeLanguage("typescript");
    setQCodeBlanksText("");
    setQCodeLinesText("");
  };

  // Add / Update Question inside Builder
  const handleSaveQuestion = () => {
    if (!qPrompt.trim()) {
      alert("Please provide the question prompt.");
      return;
    }

    let correctAnswer: any;
    let codeBlanks: any[] | undefined = undefined;
    let codeLines: string[] | undefined = undefined;

    if (qType === "multiple_choice") {
      correctAnswer = qCorrectSingle;
    } else if (qType === "multiple_select") {
      correctAnswer = qCorrectMulti;
    } else if (qType === "true_false") {
      correctAnswer = qCorrectTF;
    } else if (qType === "short_answer") {
      if (!qCorrectText.trim()) {
        alert("Please specify the target accepted answer.");
        return;
      }
      correctAnswer = qCorrectText.trim();
    } else if (qType === "code_completion") {
      if (!qCodeSnippet.trim()) {
        alert("Please provide the code snippet containing inline blanks (e.g. ___1___ or {{1}}).");
        return;
      }
      const parsedBlanks: any[] = [];
      const lines = qCodeBlanksText.split("\n").map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        const match = line.match(/^(?:Blank\s+)?\[?(\w+)\]?\s*[:\-]\s*(.+)$/i);
        if (match) {
          const bId = match[1];
          const answers = match[2].split(/[,|]/).map(a => a.trim()).filter(Boolean);
          if (answers.length > 0) {
            parsedBlanks.push({ id: bId, acceptedAnswers: answers });
          }
        } else {
          const bId = String(parsedBlanks.length + 1);
          parsedBlanks.push({ id: bId, acceptedAnswers: [line] });
        }
      }

      if (parsedBlanks.length === 0) {
        const tokens = qCodeSnippet.match(/(___\w+___|\{\{\w+\}\}|\[\w+\])/g) || [];
        const uniqueTokens = Array.from(new Set(tokens));
        uniqueTokens.forEach((tok, idx) => {
          const rawKey = tok.replace(/[_{}\[\]]/g, "").trim();
          parsedBlanks.push({ id: rawKey || String(idx + 1), acceptedAnswers: [""] });
        });
      }

      codeBlanks = parsedBlanks;
      const ansObj: Record<string, string> = {};
      parsedBlanks.forEach(b => {
        ansObj[b.id] = b.acceptedAnswers[0] || "";
      });
      correctAnswer = ansObj;
    } else if (qType === "code_ordering") {
      if (!qCodeLinesText.trim()) {
        alert("Please provide the code lines in their correct sequential order.");
        return;
      }
      const rawLines = qCodeLinesText.split("\n").map(l => l.trimEnd()).filter(Boolean);
      if (rawLines.length < 2) {
        alert("Please provide at least 2 lines of code for students to order.");
        return;
      }
      codeLines = rawLines;
      correctAnswer = rawLines;
    } else if (qType === "predict_output") {
      if (!qCodeSnippet.trim()) {
        alert("Please provide the code snippet for students to analyze.");
        return;
      }
      if (!qCorrectText.trim()) {
        alert("Please provide the expected standard terminal output.");
        return;
      }
      correctAnswer = qCorrectText.trim();
    } else {
      // essay
      correctAnswer = "";
    }

    const questionObj: ExamQuestion = {
      id: editingQuestionIdx !== null ? formQuestions[editingQuestionIdx].id : `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      prompt: qPrompt.trim(),
      type: qType,
      options: (qType === "multiple_choice" || qType === "multiple_select") 
        ? qOptions.map(o => o.trim()).filter(Boolean)
        : undefined,
      correctAnswer,
      points: Number(qPoints) || 1,
      explanation: qExplanation.trim() || undefined,
      codeSnippet: (qType === "code_completion" || qType === "predict_output") ? qCodeSnippet.trim() : undefined,
      codeLanguage: (qType === "code_completion" || qType === "code_ordering" || qType === "predict_output") ? qCodeLanguage : undefined,
      codeBlanks: qType === "code_completion" ? codeBlanks : undefined,
      codeLines: qType === "code_ordering" ? codeLines : undefined
    };

    if (editingQuestionIdx !== null) {
      const updated = [...formQuestions];
      updated[editingQuestionIdx] = questionObj;
      setFormQuestions(updated);
    } else {
      setFormQuestions(prev => [...prev, questionObj]);
    }

    resetQuestionSubForm();
  };

  const handleEditQuestionInList = (index: number) => {
    const q = formQuestions[index];
    setEditingQuestionIdx(index);
    setQPrompt(q.prompt);
    setQType(q.type);
    setQPoints(q.points);
    setQExplanation(q.explanation || "");

    if (q.type === "multiple_choice") {
      setQOptions(q.options || ["", "", "", ""]);
      setQCorrectSingle(String(q.correctAnswer ?? "0"));
    } else if (q.type === "multiple_select") {
      setQOptions(q.options || ["", "", "", ""]);
      setQCorrectMulti(Array.isArray(q.correctAnswer) ? q.correctAnswer : ["0"]);
    } else if (q.type === "true_false") {
      setQCorrectTF(Boolean(q.correctAnswer));
    } else if (q.type === "short_answer") {
      setQCorrectText(String(q.correctAnswer ?? ""));
    } else if (q.type === "code_completion") {
      setQCodeSnippet(q.codeSnippet || "");
      setQCodeLanguage(q.codeLanguage || "typescript");
      if (q.codeBlanks && q.codeBlanks.length > 0) {
        setQCodeBlanksText(q.codeBlanks.map(b => `Blank ${b.id}: ${b.acceptedAnswers.join(", ")}`).join("\n"));
      } else {
        setQCodeBlanksText("");
      }
    } else if (q.type === "code_ordering") {
      setQCodeLanguage(q.codeLanguage || "typescript");
      setQCodeLinesText((q.codeLines || []).join("\n"));
    } else if (q.type === "predict_output") {
      setQCodeSnippet(q.codeSnippet || "");
      setQCodeLanguage(q.codeLanguage || "typescript");
      setQCorrectText(String(q.correctAnswer ?? ""));
    }
  };

  const handleDeleteQuestion = (index: number) => {
    setFormQuestions(prev => prev.filter((_, i) => i !== index));
    if (editingQuestionIdx === index) {
      resetQuestionSubForm();
    }
  };

  // Save Exam to DB
  const handleSaveExam = async (statusToSet: "published" | "draft" = "published") => {
    if (!formTitle.trim()) {
      alert("Please provide an assessment title.");
      return;
    }
    if (!formCourseCode) {
      alert("Please choose a course / module.");
      return;
    }
    if (formQuestions.length === 0) {
      alert("Please add at least one question to this assessment.");
      setBuilderTab("questions");
      return;
    }

    setSavingExam(true);
    try {
      const matchedCourse = syllabi.find(s => s.courseCode === formCourseCode);
      const totalPoints = formQuestions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);

      const existingExam = editingExamId ? exams.find(e => e.id === editingExamId) : undefined;
      const examPayload: Exam = {
        id: editingExamId || `exam_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: formTitle.trim(),
        description: formDescription.trim(),
        courseCode: formCourseCode,
        courseTitle: matchedCourse ? matchedCourse.title : formCourseCode,
        tradeId: formTradeId,
        level: formLevel,
        type: formType,
        status: statusToSet,
        timeLimitMinutes: Number(formTimeLimit) || 0,
        passPercentage: Number(formPassPercentage) || 70,
        maxAttempts: Number(formMaxAttempts) || 0,
        shuffleQuestions: formShuffleQuestions,
        shuffleOptions: formShuffleQuestions,
        questionDrawCount: Math.max(0, Number(formQuestionDrawCount) || 0),
        enableAntiCheating: formAntiCheating,
        maxTabSwitches: Math.max(0, Number(formMaxTabSwitches) || 0),
        requireFullscreen: formRequireFullscreen,
        lockCopyPaste: formLockCopyPaste,
        showResultsImmediately: formResultsReleaseMode === "immediate" && formShowResultsImmediately,
        resultsReleaseMode: formResultsReleaseMode,
        resultsReleased: existingExam?.resultsReleased ?? false,
        availableFrom: formAvailableFrom ? new Date(formAvailableFrom).toISOString() : undefined,
        dueDate: formDueDate ? new Date(formDueDate).toISOString() : undefined,
        studentOverrides: existingExam?.studentOverrides,
        questions: formQuestions,
        totalPoints,
        createdAt: existingExam?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: adminUser?.fullName || "Josef Marie"
      };

      await saveExam(examPayload);
      setIsBuilderOpen(false);
      await loadAll();
    } catch (e) {
      console.error("Save exam error:", e);
      alert("Failed to save assessment. Please try again.");
    } finally {
      setSavingExam(false);
    }
  };

  // Open Exam Analytics Modal
  const handleOpenAnalytics = async (exam: Exam) => {
    setAnalyticsExam(exam);
    setLoadingAnalytics(true);
    try {
      const list = await getExamAttemptsForExam(exam.id);
      setAnalyticsAttempts(list);
    } catch (e) {
      console.error("Failed to load exam analytics:", e);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Open Per-Student Override Modal (Retakes, Extra Time, Extended Deadline)
  const handleOpenOverrideModal = (studentUid: string, studentName: string, studentUsername: string) => {
    if (!selectedExamForSubmissions) return;
    const existing = selectedExamForSubmissions.studentOverrides?.[studentUid];
    setOverrideTargetStudent({ uid: studentUid, name: studentName, username: studentUsername });
    setOverrideExtraAttempts(existing?.extraAttempts ?? 1);
    setOverrideExtraMinutes(existing?.extraMinutes ?? 0);
    setOverrideExtendedDueDate(existing?.extendedDueDate ? existing.extendedDueDate.slice(0, 16) : "");
    setOverrideReason(existing?.reason ?? "");
  };

  const handleSaveOverride = async () => {
    if (!selectedExamForSubmissions || !overrideTargetStudent) return;
    setSavingOverride(true);
    try {
      const nextOverride: StudentExamOverride = {
        extraAttempts: Math.max(0, Number(overrideExtraAttempts) || 0),
        extraMinutes: Math.max(0, Number(overrideExtraMinutes) || 0),
        extendedDueDate: overrideExtendedDueDate ? new Date(overrideExtendedDueDate).toISOString() : undefined,
        reason: overrideReason.trim() || undefined,
        grantedBy: adminUser?.fullName || "Instructor",
        grantedAt: new Date().toISOString(),
      };
      const updatedExam: Exam = {
        ...selectedExamForSubmissions,
        studentOverrides: {
          ...(selectedExamForSubmissions.studentOverrides || {}),
          [overrideTargetStudent.uid]: nextOverride,
        },
        updatedAt: new Date().toISOString(),
      };
      await saveExam(updatedExam);
      setSelectedExamForSubmissions(updatedExam);
      setExams((prev) => prev.map((e) => (e.id === updatedExam.id ? updatedExam : e)));
      setOverrideTargetStudent(null);
    } catch (e) {
      console.error("Failed to save student override:", e);
      alert("Could not save student override. Please try again.");
    } finally {
      setSavingOverride(false);
    }
  };

  // Toggle Results & Answers Release for students
  const handleToggleReleaseResults = async (exam: Exam) => {
    const nextReleased = !exam.resultsReleased;
    try {
      const updatedExam: Exam = {
        ...exam,
        resultsReleased: nextReleased,
        updatedAt: new Date().toISOString()
      };
      await saveExam(updatedExam);
      setExams(prev => prev.map(e => e.id === exam.id ? updatedExam : e));
    } catch (err) {
      console.error("Failed to toggle results release:", err);
      alert("Could not update results release status. Please try again.");
    }
  };

  // Delete Exam
  const handleDeleteExam = async (examId: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"? All student attempts for this test will be permanently archived.`)) {
      await deleteExam(examId);
      await loadAll();
    }
  };

  // Open Submissions Desk
  const handleOpenSubmissions = async (exam: Exam) => {
    setSelectedExamForSubmissions(exam);
    const existingMatching = attempts.filter(a => a.examId === exam.id);
    setExamAttempts(existingMatching);
    setLoadingAttempts(existingMatching.length === 0);

    try {
      const atts = await getExamAttemptsForExam(exam.id);
      if (atts && atts.length > 0) {
        setExamAttempts(atts);
      }
    } catch (e) {
      console.error("Error loading exam attempts:", e);
    } finally {
      setLoadingAttempts(false);
    }
  };

  // Open Attempt Grading Modal
  const handleOpenGradingModal = (attempt: ExamAttempt) => {
    setGradingAttempt(attempt);
    setGeneralFeedback(attempt.teacherFeedback || "");

    const gradesInit: Record<string, { awardedPoints: number; feedback: string }> = {};
    if (selectedExamForSubmissions) {
      selectedExamForSubmissions.questions.forEach((q) => {
        const existing = attempt.questionGrades?.[q.id];
        gradesInit[q.id] = {
          awardedPoints: existing?.awardedPoints ?? 0,
          feedback: existing?.feedback ?? ""
        };
      });
    }
    setEditableGrades(gradesInit);
  };

  // Save Teacher Manual Grade
  const handleSaveAttemptGrade = async () => {
    if (!gradingAttempt || !selectedExamForSubmissions) return;

    setSavingGrade(true);
    try {
      let totalAwarded = 0;
      const questionGrades: Record<string, QuestionGrade> = {};
      const activeQuestions =
        gradingAttempt.drawnQuestionIds && gradingAttempt.drawnQuestionIds.length > 0
          ? selectedExamForSubmissions.questions.filter((q) => gradingAttempt.drawnQuestionIds!.includes(q.id))
          : selectedExamForSubmissions.questions;
      const attemptMaxScore =
        gradingAttempt.maxScore || activeQuestions.reduce((sum, q) => sum + (q.points || 1), 0);

      activeQuestions.forEach((q) => {
        const input = editableGrades[q.id];
        const awarded = Math.min(q.points, Math.max(0, Number(input?.awardedPoints || 0)));
        totalAwarded += awarded;
        questionGrades[q.id] = {
          awardedPoints: awarded,
          maxPoints: q.points,
          autoGraded: q.type !== "essay",
          feedback: input?.feedback || ""
        };
      });

      const percentage = attemptMaxScore > 0
        ? Math.round((totalAwarded / attemptMaxScore) * 100)
        : 0;
      const passed = percentage >= (selectedExamForSubmissions.passPercentage || 70);

      const updatedAttempt: ExamAttempt = {
        ...gradingAttempt,
        score: totalAwarded,
        percentage,
        passed,
        status: "graded",
        questionGrades,
        teacherFeedback: generalFeedback.trim(),
        gradedBy: adminUser?.fullName || "Josef Marie",
        gradedAt: new Date().toISOString()
      };

      await saveExamAttempt(updatedAttempt);
      setExamAttempts(prev => prev.map(a => a.id === updatedAttempt.id ? updatedAttempt : a));
      setAttempts(prev => prev.map(a => a.id === updatedAttempt.id ? updatedAttempt : a));
      setGradingAttempt(null);
    } catch (e) {
      console.error("Failed to save grade:", e);
      alert("Error saving grade.");
    } finally {
      setSavingGrade(false);
    }
  };

  // Filtered Assessments
  const filteredExams = exams.filter(ex => {
    if (filterType !== "all" && ex.type !== filterType) return false;
    if (filterCourse !== "all" && ex.courseCode !== filterCourse) return false;
    if (filterLevel !== "all" && ex.level !== "all" && ex.level !== filterLevel) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = ex.title.toLowerCase().includes(q);
      const matchCourse = (ex.courseTitle || "").toLowerCase().includes(q) || ex.courseCode.toLowerCase().includes(q);
      if (!matchTitle && !matchCourse) return false;
    }
    return true;
  });

  // Calculate stats
  const totalQuizzes = exams.filter(e => e.type === "quiz").length;
  const totalExams = exams.filter(e => e.type === "exam").length;
  const pendingReviewCount = attempts.filter(a => a.status === "submitted").length;
  const completedAttemptsCount = attempts.filter(a => a.status === "graded").length;

  return (
    <div className="space-y-6">
      {/* Top Header & Stat Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#2E2E34] pb-4 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAEAE6]/20 text-[#EAEAE6]">
              <FileQuestion className="h-4 w-4" />
            </span>
            <h3 className="text-xl font-extrabold text-white tracking-tight">
              Assessment &amp; Examination Studio
            </h3>
          </div>
          <p className="text-xs text-[#A1A1AA] mt-1">
            Build interactive practice quizzes, schedule proctored exams with anti-cheating timers, and review student grades.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Template Download Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsTemplateMenuOpen(!isTemplateMenuOpen)}
              className="inline-flex items-center space-x-1.5 rounded-xl border border-[#2E2E34] bg-[#1C1C1F] px-3 py-2 text-xs font-semibold text-[#EAEAE6] hover:text-white transition-all shadow hover:border-slate-500"
            >
              <Download className="h-3.5 w-3.5 text-[#EAEAE6]" />
              <span>Download Template</span>
              <ChevronDown className="h-3 w-3 text-[#A1A1AA]" />
            </button>

            {isTemplateMenuOpen && (
              <div 
                className="absolute right-0 mt-1 w-64 rounded-2xl border border-[#2E2E34] bg-[#141416] p-2 shadow-2xl z-30 space-y-1 animate-in fade-in"
                onMouseLeave={() => setIsTemplateMenuOpen(false)}
              >
                <div className="px-2.5 py-1 text-[10px] font-mono uppercase font-bold text-[#71717A]">
                  Question Starter Templates
                </div>

                <button
                  type="button"
                  onClick={() => {
                    downloadExamTemplatePlainText();
                    setIsTemplateMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 text-left rounded-xl hover:bg-[#1C1C1F] text-xs text-[#EAEAE6] hover:text-white transition-all group"
                >
                  <FileText className="h-4 w-4 text-[#EAEAE6] shrink-0 group-hover:scale-110 transition-transform" />
                  <div>
                    <span className="font-bold block text-white flex items-center space-x-1.5">
                      <span>Plain Text Template (.txt)</span>
                      <span className="rounded bg-[#EAEAE6]/20 text-[#EAEAE6] text-[9px] px-1.5 py-0.2">AI Friendly</span>
                    </span>
                    <span className="text-[10px] text-[#A1A1AA] block">Natural text for ChatGPT / Claude / Gemini</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleCopyAIPrompt();
                    setIsTemplateMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 text-left rounded-xl hover:bg-[#1C1C1F] text-xs text-[#EAEAE6] hover:text-white transition-all group"
                >
                  <Sparkles className="h-4 w-4 text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
                  <div>
                    <span className="font-bold block text-white flex items-center space-x-1.5">
                      <span>Copy AI Prompt</span>
                      <span className="rounded bg-amber-500/20 text-amber-300 text-[9px] px-1.5 py-0.2">Instant</span>
                    </span>
                    <span className="text-[10px] text-[#A1A1AA] block">Paste into any AI to generate full tests</span>
                  </div>
                </button>

                <div className="border-t border-[#2E2E34]/60 my-1" />

                <button
                  type="button"
                  onClick={() => {
                    downloadExamTemplateCSV();
                    setIsTemplateMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 text-left rounded-xl hover:bg-[#1C1C1F] text-xs text-[#EAEAE6] hover:text-white transition-all"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold block text-white">CSV Template</span>
                    <span className="text-[10px] text-[#A1A1AA] block">For Microsoft Excel &amp; Sheets</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    downloadExamTemplateJSON();
                    setIsTemplateMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 text-left rounded-xl hover:bg-[#1C1C1F] text-xs text-[#EAEAE6] hover:text-white transition-all"
                >
                  <FileCode className="h-4 w-4 text-purple-400 shrink-0" />
                  <div>
                    <span className="font-bold block text-white">JSON Template</span>
                    <span className="text-[10px] text-[#A1A1AA] block">For Developers &amp; Data Pipeline</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleRefresh}
            title="Refresh database records"
            className="inline-flex items-center space-x-1.5 rounded-xl border border-[#2E2E34] bg-[#1C1C1F] px-3 py-2 text-xs font-semibold text-[#EAEAE6] hover:text-white transition-all shadow"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleOpenNewBuilder}
            className="inline-flex items-center space-x-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-[#141416] hover:bg-emerald-400 hover:text-[#141416] transition-all shadow-md active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Create Assessment</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#2E2E34] bg-[#1C1C1F] p-4 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono font-bold text-[#A1A1AA] uppercase tracking-wider block mb-0.5">
              Practice Quizzes
            </span>
            <span className="text-2xl font-extrabold text-[#EAEAE6] font-mono">{totalQuizzes}</span>
            <span className="text-[10px] text-[#A1A1AA] block mt-0.5">Interactive checks</span>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAEAE6]/10 text-[#EAEAE6]">
            <HelpCircle className="h-4 w-4" />
          </div>
        </div>

        <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono font-bold text-purple-300 uppercase tracking-wider block mb-0.5">
              Official Exams
            </span>
            <span className="text-2xl font-extrabold text-purple-300 font-mono">{totalExams}</span>
            <span className="text-[10px] text-[#A1A1AA] block mt-0.5">Timed & proctored</span>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/20 text-purple-300">
            <Award className="h-4 w-4" />
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-wider block mb-0.5">
              Pending Review
            </span>
            <span className="text-2xl font-extrabold text-amber-400 font-mono">{pendingReviewCount}</span>
            <span className="text-[10px] text-[#A1A1AA] block mt-0.5">Needs teacher grade</span>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
            <Clock className="h-4 w-4" />
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono font-bold text-emerald-400 uppercase tracking-wider block mb-0.5">
              Completed Tests
            </span>
            <span className="text-2xl font-extrabold text-emerald-400 font-mono">{completedAttemptsCount}</span>
            <span className="text-[10px] text-[#A1A1AA] block mt-0.5">Student submissions</span>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
            <UserCheck className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-[#1C1C1F] p-4 rounded-2xl border border-[#2E2E34]">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A1A1AA]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assessments by title, topic, or course code..."
            className="w-full rounded-xl bg-[#141416] border border-[#2E2E34] pl-10 pr-4 py-2 text-xs text-white placeholder-[#A1A1AA] focus:border-[#EAEAE6] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Type Filter */}
          <div className="flex items-center rounded-xl bg-[#141416] p-1 border border-[#2E2E34]">
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                filterType === "all" ? "bg-[#EAEAE6] text-[#141416] font-bold" : "text-[#A1A1AA] hover:text-white"
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setFilterType("quiz")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                filterType === "quiz" ? "bg-[#EAEAE6] text-[#141416] font-bold" : "text-[#A1A1AA] hover:text-white"
              }`}
            >
              Quizzes
            </button>
            <button
              onClick={() => setFilterType("exam")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                filterType === "exam" ? "bg-[#EAEAE6] text-[#141416] font-bold" : "text-[#A1A1AA] hover:text-white"
              }`}
            >
              Exams
            </button>
          </div>

          {/* Course Selector */}
          <select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="rounded-xl bg-[#141416] border border-[#2E2E34] px-3 py-2 text-xs font-semibold text-[#EAEAE6] focus:border-[#EAEAE6] focus:outline-none"
          >
            <option value="all">All Courses</option>
            {syllabi.map((s) => (
              <option key={s.id} value={s.courseCode}>{s.courseCode} - {s.title}</option>
            ))}
          </select>

          {/* Level Selector */}
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="rounded-xl bg-[#141416] border border-[#2E2E34] px-3 py-2 text-xs font-semibold text-[#EAEAE6] focus:border-[#EAEAE6] focus:outline-none font-mono"
          >
            <option value="all">All Levels</option>
            <option value="Level 3">Level 3</option>
            <option value="Level 4">Level 4</option>
            <option value="Level 5">Level 5</option>
          </select>
        </div>
      </div>

      {/* Assessments Grid */}
      {loading && exams.length === 0 ? (
        <div className="py-20 text-center text-[#A1A1AA]">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#EAEAE6] border-t-transparent mb-3" />
          Loading assessments and proctored exam rooms...
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="py-16 text-center text-[#A1A1AA] bg-[#1C1C1F]/40 rounded-3xl border border-[#2E2E34] p-8">
          <FileQuestion className="mx-auto h-12 w-12 text-[#71717A] mb-3" />
          <h4 className="text-base font-bold text-white mb-1">No Assessments Found</h4>
          <p className="text-xs text-[#A1A1AA] max-w-md mx-auto mb-5">
            There are currently no quizzes or exams matching your active filters. Click the button below to build your first quiz or exam.
          </p>
          <button
            onClick={handleOpenNewBuilder}
            className="inline-flex items-center space-x-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-[#141416] hover:bg-emerald-400 hover:text-[#141416] transition-all shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>Create First Assessment</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredExams.map((exam) => {
            const isExam = exam.type === "exam";
            const examAttemptsCount = attempts.filter(a => a.examId === exam.id).length;
            const needsReviewCount = attempts.filter(a => a.examId === exam.id && a.status === "submitted").length;

            return (
              <div
                key={exam.id}
                className="flex flex-col justify-between rounded-3xl border border-[#2E2E34] bg-[#1C1C1F] p-5 shadow-xl hover:border-[#EAEAE6]/50 transition-all group relative overflow-hidden"
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
                          : "bg-[#EAEAE6]/15 border-[#EAEAE6]/30 text-[#EAEAE6]"
                      }`}>
                        {isExam ? <Award className="h-3 w-3" /> : <HelpCircle className="h-3 w-3" />}
                        <span className="uppercase">{exam.type}</span>
                      </span>

                      <span className="rounded-md bg-[#141416] border border-[#2E2E34] px-2 py-0.5 text-[10px] font-mono text-[#EAEAE6]">
                        {exam.courseCode}
                      </span>

                      <span className="rounded-md bg-[#141416] border border-[#2E2E34] px-2 py-0.5 text-[10px] font-mono text-emerald-400">
                        {exam.level}
                      </span>
                    </div>

                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold uppercase ${
                      exam.status === "published"
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "bg-slate-700/40 text-slate-400 border border-slate-600/30"
                    }`}>
                      {exam.status}
                    </span>
                  </div>

                  <h4 className="text-base font-extrabold text-white group-hover:text-[#EAEAE6] transition-colors line-clamp-1 mb-1.5">
                    {exam.title}
                  </h4>

                  <p className="text-xs text-[#A1A1AA] line-clamp-2 leading-relaxed mb-4">
                    {exam.description || (exam.courseTitle ? `Comprehensive assessment on ${exam.courseTitle}` : "Interactive assessment module")}
                  </p>

                  {/* Metadata Chips */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono mb-4">
                    <div className="rounded-xl bg-[#141416] p-2 border border-[#2E2E34]">
                      <span className="text-[#71717A] block text-[10px]">TIME LIMIT</span>
                      <span className="text-white font-bold flex items-center space-x-1 mt-0.5">
                        <Clock className="h-3 w-3 text-[#EAEAE6]" />
                        <span>{exam.timeLimitMinutes > 0 ? `${exam.timeLimitMinutes} Mins` : "Untimed"}</span>
                      </span>
                    </div>

                    <div className="rounded-xl bg-[#141416] p-2 border border-[#2E2E34]">
                      <span className="text-[#71717A] block text-[10px]">PASS / TOTAL</span>
                      <span className="text-emerald-400 font-bold flex items-center space-x-1 mt-0.5">
                        <Award className="h-3 w-3 text-emerald-400" />
                        <span>{exam.passPercentage}% &bull; {exam.totalPoints} Pts</span>
                      </span>
                    </div>
                  </div>

                  {/* Anti-cheating & Features tags */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-4">
                    <span className="rounded-md bg-slate-800/80 px-2 py-0.5 text-[10px] font-mono text-[#A1A1AA]">
                      {exam.questions.length} Questions
                    </span>

                    {exam.enableAntiCheating && (
                      <span className="inline-flex items-center space-x-1 rounded-md bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[10px] font-mono text-rose-300">
                        <ShieldAlert className="h-2.5 w-2.5" />
                        <span>Proctored Lock</span>
                      </span>
                    )}

                    {exam.shuffleQuestions && (
                      <span className="inline-flex items-center space-x-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[10px] font-mono text-indigo-300">
                        <Shuffle className="h-2.5 w-2.5" />
                        <span>Shuffled</span>
                      </span>
                    )}

                    {exam.questionDrawCount && exam.questionDrawCount > 0 && (
                      <span className="inline-flex items-center space-x-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                        <span>Draw {exam.questionDrawCount}/{exam.questions.length}</span>
                      </span>
                    )}

                    {(exam.availableFrom || exam.dueDate) && (
                      <span className="inline-flex items-center space-x-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-mono text-amber-300">
                        <CalendarClock className="h-2.5 w-2.5" />
                        <span>Scheduled</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-3 border-t border-[#2E2E34] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => handleOpenSubmissions(exam)}
                      className="inline-flex items-center space-x-1.5 rounded-xl bg-emerald-500/15 border border-[#EAEAE6]/30 px-3 py-1.5 text-xs font-bold text-[#EAEAE6] hover:bg-emerald-500 hover:text-[#141416] transition-all shadow-sm"
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span>Attempts ({examAttemptsCount})</span>
                      {needsReviewCount > 0 && (
                        <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.2 text-[9px] font-extrabold text-[#141416]">
                          {needsReviewCount}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenAnalytics(exam)}
                      className="inline-flex items-center space-x-1 rounded-xl bg-[#141416] border border-[#2E2E34] px-2.5 py-1.5 text-xs font-bold text-[#EAEAE6] hover:border-emerald-500/50 hover:text-emerald-300 transition-all shadow-sm"
                      title="View Score Analytics & Question Difficulty Breakdown"
                    >
                      <BarChart3 className="h-3.5 w-3.5" />
                      <span>Analytics</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleReleaseResults(exam)}
                      className={`inline-flex items-center space-x-1 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all shadow-sm ${
                        exam.resultsReleased
                          ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500 hover:text-[#141416]"
                          : "bg-[#141416] border border-[#2E2E34] text-[#A1A1AA] hover:text-white hover:border-slate-500"
                      }`}
                      title={
                        exam.resultsReleased
                          ? "Answers and explanations are visible to students. Click to hide."
                          : "Answers and explanations are hidden from students. Click to release."
                      }
                    >
                      {exam.resultsReleased ? <Eye className="h-3 w-3 text-emerald-400" /> : <EyeOff className="h-3 w-3 text-slate-400" />}
                      <span className="hidden sm:inline">{exam.resultsReleased ? "Answers Released" : "Release Answers"}</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleEditExam(exam)}
                      title="Edit assessment questions & settings"
                      className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteExam(exam.id, exam.title)}
                      title="Delete assessment"
                      className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: EXAM BUILDER & QUESTION STUDIO */}
      {/* ========================================================================= */}
      {isBuilderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6 backdrop-blur-md animate-in fade-in">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-[#2E2E34] bg-[#141416] shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#2E2E34] px-6 py-4 bg-[#1C1C1F]/70 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EAEAE6]/20 text-[#EAEAE6]">
                  <FileQuestion className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    {editingExamId ? "Edit Assessment" : "Build Assessment Studio"}
                  </h3>
                  <p className="text-xs text-[#A1A1AA]">
                    Configure questions, anti-cheating timers, and grading rules.
                  </p>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center space-x-2">
                <div className="flex items-center rounded-xl bg-[#141416] p-1 border border-[#2E2E34]">
                  <button
                    onClick={() => setBuilderTab("settings")}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      builderTab === "settings" ? "bg-[#EAEAE6] text-[#141416]" : "text-[#A1A1AA] hover:text-white"
                    }`}
                  >
                    <Sliders className="h-3.5 w-3.5" />
                    <span>Settings</span>
                  </button>

                  <button
                    onClick={() => setBuilderTab("questions")}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      builderTab === "questions" ? "bg-[#EAEAE6] text-[#141416]" : "text-[#A1A1AA] hover:text-white"
                    }`}
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    <span>Questions ({formQuestions.length})</span>
                  </button>
                </div>

                <button
                  onClick={() => setIsBuilderOpen(false)}
                  className="rounded-xl p-1.5 text-[#A1A1AA] hover:text-white hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {builderTab === "settings" ? (
                <div className="space-y-5 max-w-2xl mx-auto">
                  {/* Assessment Type Toggle */}
                  <div className="rounded-2xl border border-[#2E2E34] bg-[#1C1C1F] p-4 space-y-3">
                    <span className="block text-xs font-bold text-white uppercase tracking-wider font-mono">
                      Assessment Mode
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setFormType("quiz");
                          setFormTimeLimit(0);
                          setFormAntiCheating(false);
                          setFormMaxAttempts(0);
                        }}
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          formType === "quiz"
                            ? "border-[#EAEAE6] bg-[#EAEAE6]/10 text-white shadow-md"
                            : "border-[#2E2E34] bg-[#141416] text-[#A1A1AA] hover:border-slate-500"
                        }`}
                      >
                        <div className="flex items-center space-x-2 font-bold text-sm text-[#EAEAE6] mb-1">
                          <HelpCircle className="h-4 w-4" />
                          <span>Practice Quiz</span>
                        </div>
                        <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                          Ideal for learning checks. Students can practice freely with instant feedback.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFormType("exam");
                          setFormTimeLimit(60);
                          setFormAntiCheating(true);
                          setFormMaxAttempts(1);
                        }}
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          formType === "exam"
                            ? "border-purple-500 bg-purple-500/10 text-white shadow-md"
                            : "border-[#2E2E34] bg-[#141416] text-[#A1A1AA] hover:border-slate-500"
                        }`}
                      >
                        <div className="flex items-center space-x-2 font-bold text-sm text-purple-400 mb-1">
                          <Award className="h-4 w-4" />
                          <span>Formal Exam</span>
                        </div>
                        <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                          Strict proctored test with countdown timer, single attempt, and anti-cheating violation tracking.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Basic Details */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-[#EAEAE6] mb-1">
                        Assessment Title <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="e.g. Midterm Examination: Data Structures & Algorithms"
                        className="w-full rounded-xl border border-[#2E2E34] bg-[#141416] p-3 text-xs text-white placeholder-[#71717A] focus:border-[#EAEAE6] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#EAEAE6] mb-1">
                        Description / Instructions for Students
                      </label>
                      <textarea
                        rows={2}
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        placeholder="Brief overview of the syllabus modules covered in this test..."
                        className="w-full rounded-xl border border-[#2E2E34] bg-[#141416] p-3 text-xs text-white placeholder-[#71717A] focus:border-[#EAEAE6] focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-[#EAEAE6] mb-1">
                          Course / Module <span className="text-rose-400">*</span>
                        </label>
                        <select
                          value={formCourseCode}
                          onChange={(e) => setFormCourseCode(e.target.value)}
                          className="w-full rounded-xl border border-[#2E2E34] bg-[#141416] p-2.5 text-xs font-semibold text-white focus:border-[#EAEAE6] focus:outline-none"
                        >
                          {syllabi.map((s) => (
                            <option key={s.id} value={s.courseCode}>{s.courseCode} - {s.title}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#EAEAE6] mb-1">
                          Target Academic Level
                        </label>
                        <select
                          value={formLevel}
                          onChange={(e) => setFormLevel(e.target.value as any)}
                          className="w-full rounded-xl border border-[#2E2E34] bg-[#141416] p-2.5 text-xs font-semibold text-white focus:border-[#EAEAE6] focus:outline-none font-mono"
                        >
                          <option value="all">All Levels</option>
                          <option value="Level 3">Level 3</option>
                          <option value="Level 4">Level 4</option>
                          <option value="Level 5">Level 5</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#EAEAE6] mb-1">
                          Target Trade
                        </label>
                        <select
                          value={formTradeId}
                          onChange={(e) => setFormTradeId(e.target.value)}
                          className="w-full rounded-xl border border-[#2E2E34] bg-[#141416] p-2.5 text-xs font-semibold text-white focus:border-[#EAEAE6] focus:outline-none"
                        >
                          <option value="all">All Academic Trades</option>
                          {trades.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Timing & Proctoring Settings */}
                  <div className="rounded-2xl border border-[#2E2E34] bg-[#1C1C1F] p-4 space-y-4">
                    <span className="block text-xs font-bold text-white uppercase tracking-wider font-mono">
                      Rules &amp; Proctoring Settings
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[#A1A1AA] mb-1">
                          Time Limit (Minutes)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={300}
                          value={formTimeLimit}
                          onChange={(e) => setFormTimeLimit(Number(e.target.value))}
                          placeholder="0 = Untimed"
                          className="w-full rounded-xl border border-[#2E2E34] bg-[#141416] px-3 py-2 text-xs font-mono text-white focus:border-[#EAEAE6] focus:outline-none"
                        />
                        <span className="text-[10px] text-[#71717A] mt-0.5 block">0 = Untimed practice</span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#A1A1AA] mb-1">
                          Passing Grade (%)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={formPassPercentage}
                          onChange={(e) => setFormPassPercentage(Number(e.target.value))}
                          className="w-full rounded-xl border border-[#2E2E34] bg-[#141416] px-3 py-2 text-xs font-mono text-emerald-400 font-bold focus:border-[#EAEAE6] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#A1A1AA] mb-1">
                          Allowed Attempts
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={formMaxAttempts}
                          onChange={(e) => setFormMaxAttempts(Number(e.target.value))}
                          className="w-full rounded-xl border border-[#2E2E34] bg-[#141416] px-3 py-2 text-xs font-mono text-white focus:border-[#EAEAE6] focus:outline-none"
                        />
                        <span className="text-[10px] text-[#71717A] mt-0.5 block">0 = Unlimited</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#2E2E34]">
                      <label className="flex items-center space-x-2.5 text-xs text-[#EAEAE6] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formAntiCheating}
                          onChange={(e) => setFormAntiCheating(e.target.checked)}
                          className="rounded border-[#2E2E34] text-[#EAEAE6] focus:ring-0"
                        />
                        <span>Enforce Anti-Cheating &amp; Tab-Switch Tracking</span>
                      </label>

                      <label className="flex items-center space-x-2.5 text-xs text-[#EAEAE6] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formShuffleQuestions}
                          onChange={(e) => setFormShuffleQuestions(e.target.checked)}
                          className="rounded border-[#2E2E34] text-[#EAEAE6] focus:ring-0"
                        />
                        <span>Shuffle Question Order for Each Student</span>
                      </label>

                      <label className="flex items-center space-x-2.5 text-xs text-[#EAEAE6] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formRequireFullscreen}
                          onChange={(e) => setFormRequireFullscreen(e.target.checked)}
                          className="rounded border-[#2E2E34] text-[#EAEAE6] focus:ring-0"
                        />
                        <span>Require Fullscreen Exam Hall</span>
                      </label>

                      <label className="flex items-center space-x-2.5 text-xs text-[#EAEAE6] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formLockCopyPaste}
                          onChange={(e) => setFormLockCopyPaste(e.target.checked)}
                          className="rounded border-[#2E2E34] text-[#EAEAE6] focus:ring-0"
                        />
                        <span>Disable Copy, Paste &amp; Right-Click</span>
                      </label>
                    </div>

                    {/* Question Bank Draw & Auto-Submit Threshold & Scheduling */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-[#2E2E34]">
                      <div>
                        <label className="block text-[11px] font-bold text-[#A1A1AA] mb-1">
                          Random Draw Count
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={500}
                          value={formQuestionDrawCount}
                          onChange={(e) => setFormQuestionDrawCount(Number(e.target.value))}
                          className="w-full rounded-xl border border-[#2E2E34] bg-[#141416] px-3 py-2 text-xs font-mono text-white focus:border-[#EAEAE6] focus:outline-none"
                        />
                        <span className="text-[10px] text-[#71717A] mt-0.5 block">0 = Use all questions</span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#A1A1AA] mb-1">
                          Auto-Submit Tab Limit
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={formMaxTabSwitches}
                          onChange={(e) => setFormMaxTabSwitches(Number(e.target.value))}
                          className="w-full rounded-xl border border-[#2E2E34] bg-[#141416] px-3 py-2 text-xs font-mono text-rose-300 font-bold focus:border-[#EAEAE6] focus:outline-none"
                        />
                        <span className="text-[10px] text-[#71717A] mt-0.5 block">0 = Warn only (no auto-submit)</span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#A1A1AA] mb-1">
                          Scheduled Opens At
                        </label>
                        <input
                          type="datetime-local"
                          value={formAvailableFrom}
                          onChange={(e) => setFormAvailableFrom(e.target.value)}
                          className="w-full rounded-xl border border-[#2E2E34] bg-[#141416] px-3 py-2 text-xs font-mono text-white focus:border-[#EAEAE6] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#A1A1AA] mb-1">
                          Scheduled Closes At
                        </label>
                        <input
                          type="datetime-local"
                          value={formDueDate}
                          onChange={(e) => setFormDueDate(e.target.value)}
                          className="w-full rounded-xl border border-[#2E2E34] bg-[#141416] px-3 py-2 text-xs font-mono text-white focus:border-[#EAEAE6] focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Results & Answer Explanations Release Strategy */}
                    <div className="pt-3 border-t border-[#2E2E34] space-y-2.5">
                      <div className="flex items-center space-x-2">
                        <Lock className="h-4 w-4 text-[#EAEAE6]" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                          Release of Answers, Solutions &amp; Explanations
                        </span>
                      </div>
                      <p className="text-[11px] text-[#A1A1AA]">
                        Prevent students who finish or start earlier from accessing correct answers and leaking them to classmates.
                      </p>

                      <div className="space-y-2 bg-[#141416] p-3.5 rounded-2xl border border-[#2E2E34]">
                        <label className="flex items-start space-x-2.5 text-xs text-[#EAEAE6] cursor-pointer">
                          <input
                            type="radio"
                            name="resultsReleaseMode"
                            value="manual_release"
                            checked={formResultsReleaseMode === "manual_release"}
                            onChange={() => {
                              setFormResultsReleaseMode("manual_release");
                              setFormShowResultsImmediately(false);
                            }}
                            className="mt-0.5 text-[#EAEAE6] focus:ring-0"
                          />
                          <div>
                            <span className="font-semibold text-white block">
                              🔒 Manual Instructor Release (Recommended for Assessments)
                            </span>
                            <span className="text-[11px] text-[#A1A1AA] block mt-0.5">
                              Answers and explanations remain strictly locked. When all students finish, click &quot;Release Answers&quot; on the exam card to publish results.
                            </span>
                          </div>
                        </label>

                        <label className="flex items-start space-x-2.5 text-xs text-[#EAEAE6] cursor-pointer pt-2 border-t border-[#1C1C1F]">
                          <input
                            type="radio"
                            name="resultsReleaseMode"
                            value="after_due_date"
                            checked={formResultsReleaseMode === "after_due_date"}
                            onChange={() => {
                              setFormResultsReleaseMode("after_due_date");
                              setFormShowResultsImmediately(false);
                            }}
                            className="mt-0.5 text-[#EAEAE6] focus:ring-0"
                          />
                          <div>
                            <span className="font-semibold text-white block">
                              ⏰ After Global Exam Due Date / Deadline
                            </span>
                            <span className="text-[11px] text-[#A1A1AA] block mt-0.5">
                              Unlocks automatically only after the entire class deadline passes, never based on individual student start times.
                            </span>
                          </div>
                        </label>

                        <label className="flex items-start space-x-2.5 text-xs text-[#EAEAE6] cursor-pointer pt-2 border-t border-[#1C1C1F]">
                          <input
                            type="radio"
                            name="resultsReleaseMode"
                            value="immediate"
                            checked={formResultsReleaseMode === "immediate"}
                            onChange={() => {
                              setFormResultsReleaseMode("immediate");
                              setFormShowResultsImmediately(true);
                            }}
                            className="mt-0.5 text-[#EAEAE6] focus:ring-0"
                          />
                          <div>
                            <span className="font-semibold text-white block">
                              ⚡ Immediately Upon Submission
                            </span>
                            <span className="text-[11px] text-[#A1A1AA] block mt-0.5">
                              Reveals answers immediately to each student as soon as they submit (only recommended for ungraded self-practice checks).
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* TAB 2: QUESTIONS STUDIO */
                <div className="space-y-6">
                  {/* Current Questions List */}
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                      <div>
                        <span className="text-xs font-bold font-mono text-[#A1A1AA] uppercase tracking-wider block">
                          Assessment Questions ({formQuestions.length}) &bull; Total Points:{" "}
                          <span className="text-[#EAEAE6] font-bold">
                            {formQuestions.reduce((s, q) => s + (Number(q.points) || 0), 0)} Pts
                          </span>
                        </span>
                        <span className="text-[11px] text-[#71717A]">
                          Supports Single Choice, Multi-Select Checkboxes, True/False, Short Answer & Essays.
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Import Button */}
                        <button
                          type="button"
                          onClick={() => setIsImportModalOpen(true)}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#141416] bg-emerald-500 hover:bg-emerald-400 hover:text-[#141416] transition-all shadow-md active:scale-95"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          <span>Import Questions</span>
                        </button>

                        {/* Download Template Dropdown */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setIsBuilderTemplateMenuOpen(!isBuilderTemplateMenuOpen)}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#EAEAE6] bg-[#141416] border border-[#2E2E34] hover:text-white hover:border-slate-500 transition-all"
                          >
                            <Download className="h-3.5 w-3.5 text-[#EAEAE6]" />
                            <span>Template</span>
                            <ChevronDown className="h-3 w-3 text-[#A1A1AA]" />
                          </button>

                          {isBuilderTemplateMenuOpen && (
                            <div 
                              className="absolute right-0 mt-1 w-64 rounded-2xl border border-[#2E2E34] bg-[#141416] p-2 shadow-2xl z-30 space-y-1 animate-in fade-in"
                              onMouseLeave={() => setIsBuilderTemplateMenuOpen(false)}
                            >
                              <div className="px-2.5 py-1 text-[10px] font-mono uppercase font-bold text-[#71717A]">
                                Question Starter Templates
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  downloadExamTemplateMarkdown();
                                  setIsBuilderTemplateMenuOpen(false);
                                }}
                                className="w-full flex items-center space-x-2.5 px-3 py-2 text-left rounded-xl hover:bg-[#1C1C1F] text-xs text-[#EAEAE6] hover:text-white transition-all group"
                              >
                                <FileText className="h-4 w-4 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                                <div>
                                  <span className="font-bold block text-white flex items-center space-x-1.5">
                                    <span>Markdown Template (.md)</span>
                                    <span className="rounded bg-emerald-500/20 text-emerald-300 text-[9px] px-1.5 py-0.2">Recommended</span>
                                  </span>
                                  <span className="text-[10px] text-[#A1A1AA] block">Standard formatted document with code blocks</span>
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  downloadExamTemplatePlainText();
                                  setIsBuilderTemplateMenuOpen(false);
                                }}
                                className="w-full flex items-center space-x-2.5 px-3 py-2 text-left rounded-xl hover:bg-[#1C1C1F] text-xs text-[#EAEAE6] hover:text-white transition-all group"
                              >
                                <FileText className="h-4 w-4 text-[#EAEAE6] shrink-0 group-hover:scale-110 transition-transform" />
                                <div>
                                  <span className="font-bold block text-white flex items-center space-x-1.5">
                                    <span>Plain Text Template (.txt)</span>
                                    <span className="rounded bg-[#EAEAE6]/20 text-[#EAEAE6] text-[9px] px-1.5 py-0.2">AI Friendly</span>
                                  </span>
                                  <span className="text-[10px] text-[#A1A1AA] block">Natural text for ChatGPT / Claude / Gemini</span>
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  handleCopyAIPrompt();
                                  setIsBuilderTemplateMenuOpen(false);
                                }}
                                className="w-full flex items-center space-x-2.5 px-3 py-2 text-left rounded-xl hover:bg-[#1C1C1F] text-xs text-[#EAEAE6] hover:text-white transition-all group"
                              >
                                <Sparkles className="h-4 w-4 text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
                                <div>
                                  <span className="font-bold block text-white flex items-center space-x-1.5">
                                    <span>Copy AI Prompt</span>
                                    <span className="rounded bg-amber-500/20 text-amber-300 text-[9px] px-1.5 py-0.2">Instant</span>
                                  </span>
                                  <span className="text-[10px] text-[#A1A1AA] block">Paste into any AI to generate questions</span>
                                </div>
                              </button>

                              <div className="border-t border-[#2E2E34]/60 my-1" />

                              <button
                                type="button"
                                onClick={() => {
                                  downloadExamTemplateCSV();
                                  setIsBuilderTemplateMenuOpen(false);
                                }}
                                className="w-full flex items-center space-x-2.5 px-3 py-2 text-left rounded-xl hover:bg-[#1C1C1F] text-xs text-[#EAEAE6] hover:text-white transition-all"
                              >
                                <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0" />
                                <div>
                                  <span className="font-bold block text-white">CSV Template</span>
                                  <span className="text-[10px] text-[#A1A1AA] block">Excel &amp; Google Sheets</span>
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  downloadExamTemplateJSON();
                                  setIsBuilderTemplateMenuOpen(false);
                                }}
                                className="w-full flex items-center space-x-2.5 px-3 py-2 text-left rounded-xl hover:bg-[#1C1C1F] text-xs text-[#EAEAE6] hover:text-white transition-all"
                              >
                                <FileCode className="h-4 w-4 text-purple-400 shrink-0" />
                                <div>
                                  <span className="font-bold block text-white">JSON Template</span>
                                  <span className="text-[10px] text-[#A1A1AA] block">Formatted Array Object</span>
                                </div>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Export Existing Questions (if any) */}
                        {formQuestions.length > 0 && (
                          <div className="flex items-center space-x-1 border-l border-[#2E2E34] pl-2">
                            <button
                              type="button"
                              title="Export questions as Markdown (.md)"
                              onClick={() => exportExamQuestionsToMarkdown(formQuestions, formTitle || "exam")}
                              className="px-2 py-1 rounded-lg text-emerald-300 hover:text-white hover:bg-slate-800 text-[11px] font-mono border border-emerald-500/30"
                            >
                              MD
                            </button>
                            <button
                              type="button"
                              title="Export questions as plain text"
                              onClick={() => exportExamQuestionsToPlainText(formQuestions, formTitle || "exam")}
                              className="px-2 py-1 rounded-lg text-[#EAEAE6] hover:text-white hover:bg-slate-800 text-[11px] font-mono border border-[#EAEAE6]/30"
                            >
                              TXT
                            </button>
                            <button
                              type="button"
                              title="Export questions to CSV"
                              onClick={() => exportExamQuestionsToCSV(formQuestions, formTitle || "exam")}
                              className="px-2 py-1 rounded-lg text-[#A1A1AA] hover:text-white hover:bg-slate-800 text-[11px] font-mono border border-[#2E2E34]"
                            >
                              CSV
                            </button>
                            <button
                              type="button"
                              title="Export questions to JSON"
                              onClick={() => exportExamQuestionsToJSON(formQuestions, formTitle || "exam")}
                              className="px-2 py-1 rounded-lg text-[#A1A1AA] hover:text-white hover:bg-slate-800 text-[11px] font-mono border border-[#2E2E34]"
                            >
                              JSON
                            </button>
                          </div>
                        )}

                        {editingQuestionIdx !== null && (
                          <button
                            type="button"
                            onClick={resetQuestionSubForm}
                            className="text-xs text-amber-400 hover:underline font-mono ml-1"
                          >
                            + Cancel Edit
                          </button>
                        )}
                      </div>
                    </div>

                    {formQuestions.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#2E2E34] bg-[#1C1C1F]/40 p-6 text-center text-xs text-[#A1A1AA]">
                        No questions added yet. Use the question editor below to create multiple choice, true/false, or coding questions.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {formQuestions.map((q, idx) => (
                          <div
                            key={q.id}
                            className={`flex items-start justify-between rounded-2xl border p-4 transition-all ${
                              editingQuestionIdx === idx
                                ? "border-[#EAEAE6] bg-[#EAEAE6]/10 shadow-lg"
                                : "border-[#2E2E34] bg-[#1C1C1F]"
                            }`}
                          >
                            <div className="flex items-start space-x-3">
                              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#141416] font-mono text-xs font-bold text-[#EAEAE6] border border-[#2E2E34] shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <div>
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className="rounded bg-[#141416] border border-[#2E2E34] px-1.5 py-0.2 text-[10px] font-mono uppercase text-[#EAEAE6] font-bold">
                                    {q.type.replace("_", " ")}
                                  </span>
                                  <span className="text-[10px] font-mono text-emerald-400 font-bold">
                                    {q.points} {q.points === 1 ? "Point" : "Points"}
                                  </span>
                                </div>
                                <p className="text-xs text-white font-medium line-clamp-2">{q.prompt}</p>
                              </div>
                            </div>

                            <div className="flex items-center space-x-1 shrink-0 ml-3">
                              <button
                                onClick={() => handleEditQuestionInList(idx)}
                                className="p-1 rounded text-[#A1A1AA] hover:text-white hover:bg-slate-800"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteQuestion(idx)}
                                className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Question Creator Box */}
                  <div className="rounded-2xl border border-[#2E2E34] bg-[#1C1C1F] p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-[#2E2E34] pb-3">
                      <span className="text-xs font-bold text-white uppercase font-mono flex items-center space-x-1.5">
                        <Plus className="h-4 w-4 text-[#EAEAE6]" />
                        <span>{editingQuestionIdx !== null ? `Edit Question #${editingQuestionIdx + 1}` : "Add New Question"}</span>
                      </span>

                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-1.5">
                          <label className="text-[11px] font-mono text-[#A1A1AA]">Points:</label>
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={qPoints}
                            onChange={(e) => setQPoints(Number(e.target.value))}
                            className="w-16 rounded-lg border border-[#2E2E34] bg-[#141416] px-2 py-1 text-xs font-mono text-emerald-400 font-bold focus:border-[#EAEAE6] focus:outline-none"
                          />
                        </div>

                        <select
                          value={qType}
                          onChange={(e) => setQType(e.target.value as QuestionType)}
                          className="rounded-lg border border-[#2E2E34] bg-[#141416] px-2.5 py-1 text-xs font-semibold text-[#EAEAE6] focus:border-[#EAEAE6] focus:outline-none"
                        >
                          <option value="multiple_choice">Multiple Choice (Single)</option>
                          <option value="multiple_select">Multiple Select (Checkboxes)</option>
                          <option value="true_false">True / False</option>
                          <option value="short_answer">Short Answer / Code Output</option>
                          <option value="essay">Open Essay / Code Solution</option>
                          <option value="code_completion">💻 Fill-in-the-Code Blanks</option>
                          <option value="code_ordering">🧩 Scrambled Code Ordering (Parson&apos;s)</option>
                          <option value="predict_output">⚡ Predict Terminal Output</option>
                        </select>
                      </div>
                    </div>

                    {/* Question Prompt */}
                    <div>
                      <label className="block text-xs font-bold text-[#EAEAE6] mb-1">
                        Question Prompt (Markdown &amp; Code Syntax Supported)
                      </label>
                      <textarea
                        rows={3}
                        value={qPrompt}
                        onChange={(e) => setQPrompt(e.target.value)}
                        placeholder="Write your question here... (e.g. 'What is the time complexity of binary search?' or paste code snippet)"
                        className="w-full rounded-xl border border-[#2E2E34] bg-[#141416] p-3 text-xs text-white placeholder-[#71717A] focus:border-[#EAEAE6] focus:outline-none font-mono"
                      />
                    </div>

                    {/* Options / Answer Input Based on Question Type */}
                    {qType === "multiple_choice" && (
                      <div className="space-y-2">
                        <label className="block text-[11px] font-bold text-[#A1A1AA]">
                          Answer Choices (Select radio button for the CORRECT option)
                        </label>
                        {qOptions.map((opt, idx) => (
                          <div key={idx} className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name="mc_correct"
                              checked={qCorrectSingle === String(idx)}
                              onChange={() => setQCorrectSingle(String(idx))}
                              className="text-[#EAEAE6] focus:ring-0 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const copy = [...qOptions];
                                copy[idx] = e.target.value;
                                setQOptions(copy);
                              }}
                              placeholder={`Option ${idx + 1}`}
                              className="flex-1 rounded-xl border border-[#2E2E34] bg-[#141416] px-3 py-1.5 text-xs text-white placeholder-[#71717A] focus:border-[#EAEAE6] focus:outline-none"
                            />
                            {qOptions.length > 2 && (
                              <button
                                type="button"
                                onClick={() => setQOptions(prev => prev.filter((_, i) => i !== idx))}
                                className="p-1 text-[#71717A] hover:text-rose-400"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                        {qOptions.length < 6 && (
                          <button
                            type="button"
                            onClick={() => setQOptions(prev => [...prev, ""])}
                            className="text-xs text-[#EAEAE6] hover:underline font-mono"
                          >
                            + Add Another Option
                          </button>
                        )}
                      </div>
                    )}

                    {qType === "multiple_select" && (
                      <div className="space-y-2">
                        <label className="block text-[11px] font-bold text-[#A1A1AA]">
                          Answer Choices (Check all boxes that are CORRECT)
                        </label>
                        {qOptions.map((opt, idx) => {
                          const isChecked = qCorrectMulti.includes(String(idx));
                          return (
                            <div key={idx} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setQCorrectMulti(prev => [...prev, String(idx)]);
                                  } else {
                                    setQCorrectMulti(prev => prev.filter(v => v !== String(idx)));
                                  }
                                }}
                                className="rounded text-[#EAEAE6] focus:ring-0 cursor-pointer"
                              />
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const copy = [...qOptions];
                                  copy[idx] = e.target.value;
                                  setQOptions(copy);
                                }}
                                placeholder={`Choice ${idx + 1}`}
                                className="flex-1 rounded-xl border border-[#2E2E34] bg-[#141416] px-3 py-1.5 text-xs text-white placeholder-[#71717A] focus:border-[#EAEAE6] focus:outline-none"
                              />
                              {qOptions.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => setQOptions(prev => prev.filter((_, i) => i !== idx))}
                                  className="p-1 text-[#71717A] hover:text-rose-400"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {qOptions.length < 6 && (
                          <button
                            type="button"
                            onClick={() => setQOptions(prev => [...prev, ""])}
                            className="text-xs text-[#EAEAE6] hover:underline font-mono"
                          >
                            + Add Another Choice
                          </button>
                        )}
                      </div>
                    )}

                    {qType === "true_false" && (
                      <div className="space-y-2">
                        <label className="block text-[11px] font-bold text-[#A1A1AA]">
                          Select Correct Answer
                        </label>
                        <div className="flex items-center space-x-4">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              name="tf_correct"
                              checked={qCorrectTF === true}
                              onChange={() => setQCorrectTF(true)}
                              className="text-[#10B981] focus:ring-0"
                            />
                            <span className="text-xs font-bold text-white">True</span>
                          </label>

                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              name="tf_correct"
                              checked={qCorrectTF === false}
                              onChange={() => setQCorrectTF(false)}
                              className="text-rose-400 focus:ring-0"
                            />
                            <span className="text-xs font-bold text-white">False</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {qType === "short_answer" && (
                      <div>
                        <label className="block text-[11px] font-bold text-[#A1A1AA] mb-1">
                          Exact Target Answer (Case-insensitive auto-match)
                        </label>
                        <input
                          type="text"
                          value={qCorrectText}
                          onChange={(e) => setQCorrectText(e.target.value)}
                          placeholder="e.g. O(log n) or polymorphism"
                          className="w-full rounded-xl border border-[#2E2E34] bg-[#141416] px-3.5 py-2 text-xs font-mono text-emerald-400 font-bold focus:border-[#EAEAE6] focus:outline-none"
                        />
                      </div>
                    )}

                    {qType === "essay" && (
                      <div className="rounded-xl bg-[#141416] p-3 text-xs text-[#A1A1AA] border border-[#2E2E34]">
                        <p>
                          💡 <strong>Open-ended Question:</strong> Student answers will be saved and presented in the Teacher Grading Desk for manual scoring and custom feedback.
                        </p>
                      </div>
                    )}

                    {/* Code Completion Editor */}
                    {qType === "code_completion" && (
                      <div className="space-y-3 rounded-2xl bg-[#141416] p-4 border border-[#2E2E34]">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-[#EAEAE6] font-mono flex items-center space-x-1.5">
                            <Code className="h-4 w-4" />
                            <span>Code Snippet with Interactive Blanks</span>
                          </label>

                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-mono text-[#A1A1AA]">Language:</span>
                            <select
                              value={qCodeLanguage}
                              onChange={(e) => setQCodeLanguage(e.target.value)}
                              className="rounded-lg border border-[#2E2E34] bg-[#1C1C1F] px-2 py-0.5 text-xs font-mono text-[#EAEAE6] focus:border-[#EAEAE6] focus:outline-none"
                            >
                              <option value="python">Python</option>
                              <option value="javascript">JavaScript</option>
                              <option value="typescript">TypeScript</option>
                              <option value="java">Java</option>
                              <option value="c">C</option>
                              <option value="cpp">C++</option>
                              <option value="csharp">C#</option>
                              <option value="sql">SQL</option>
                              <option value="html">HTML</option>
                              <option value="css">CSS</option>
                              <option value="rust">Rust</option>
                              <option value="go">Go</option>
                              <option value="php">PHP</option>
                            </select>
                          </div>
                        </div>

                        <p className="text-[11px] text-[#A1A1AA]">
                          Mark missing tokens with <code className="text-[#EAEAE6] font-mono bg-slate-800 px-1 py-0.5 rounded">___1___</code>, <code className="text-[#EAEAE6] font-mono bg-slate-800 px-1 py-0.5 rounded">___2___</code> or <code className="text-[#EAEAE6] font-mono bg-slate-800 px-1 py-0.5 rounded">{"{{1}}"}</code> where students need to type.
                        </p>

                        <textarea
                          rows={6}
                          value={qCodeSnippet}
                          onChange={(e) => setQCodeSnippet(e.target.value)}
                          placeholder={`def factorial(n):\n    if n <= 1:\n        return ___1___\n    return n * factorial(___2___)`}
                          className="w-full rounded-xl border border-[#2E2E34] bg-[#020617] p-3 text-xs font-mono text-[#EAEAE6] placeholder-slate-600 focus:border-[#EAEAE6] focus:outline-none leading-relaxed"
                        />

                        <div>
                          <label className="block text-[11px] font-bold text-[#EAEAE6] mb-1">
                            Accepted Answers for Blanks (One blank per line, aliases separated by <code className="text-[#EAEAE6]">|</code> or commas):
                          </label>
                          <textarea
                            rows={3}
                            value={qCodeBlanksText}
                            onChange={(e) => setQCodeBlanksText(e.target.value)}
                            placeholder={`Blank 1: 1\nBlank 2: n - 1`}
                            className="w-full rounded-xl border border-[#2E2E34] bg-[#020617] p-2.5 text-xs font-mono text-emerald-400 placeholder-slate-600 focus:border-[#EAEAE6] focus:outline-none"
                          />
                        </div>

                        {qCodeSnippet && (
                          <div className="pt-2">
                            <span className="block text-[10px] font-mono uppercase text-[#A1A1AA] mb-1.5 font-bold">
                              Student Interactive Preview:
                            </span>
                            <CodeQuestionRenderer
                              question={{
                                id: "preview_completion",
                                prompt: qPrompt || "Fill in the missing code:",
                                type: "code_completion",
                                points: qPoints,
                                codeSnippet: qCodeSnippet,
                                codeLanguage: qCodeLanguage,
                                codeBlanks: (() => {
                                  const lines = qCodeBlanksText.split("\n").map(l => l.trim()).filter(Boolean);
                                  return lines.map((l, i) => {
                                    const m = l.match(/^(?:Blank\s+)?\[?(\w+)\]?\s*[:\-]\s*(.+)$/i);
                                    return {
                                      id: m ? m[1] : String(i + 1),
                                      acceptedAnswers: m ? m[2].split(/[,|]/).map(a => a.trim()) : [l]
                                    };
                                  });
                                })()
                              }}
                              mode="preview"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Scrambled Code Ordering Editor */}
                    {qType === "code_ordering" && (
                      <div className="space-y-3 rounded-2xl bg-[#141416] p-4 border border-[#2E2E34]">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-[#EAEAE6] font-mono flex items-center space-x-1.5">
                            <Shuffle className="h-4 w-4" />
                            <span>Code Lines (In Correct Sequential Order)</span>
                          </label>

                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-mono text-[#A1A1AA]">Language:</span>
                            <select
                              value={qCodeLanguage}
                              onChange={(e) => setQCodeLanguage(e.target.value)}
                              className="rounded-lg border border-[#2E2E34] bg-[#1C1C1F] px-2 py-0.5 text-xs font-mono text-[#EAEAE6] focus:border-[#EAEAE6] focus:outline-none"
                            >
                              <option value="python">Python</option>
                              <option value="javascript">JavaScript</option>
                              <option value="typescript">TypeScript</option>
                              <option value="java">Java</option>
                              <option value="c">C</option>
                              <option value="cpp">C++</option>
                              <option value="csharp">C#</option>
                              <option value="sql">SQL</option>
                              <option value="html">HTML</option>
                              <option value="css">CSS</option>
                              <option value="rust">Rust</option>
                              <option value="go">Go</option>
                              <option value="php">PHP</option>
                            </select>
                          </div>
                        </div>

                        <p className="text-[11px] text-[#A1A1AA]">
                          Enter the full program lines here in their <strong>correct working sequence</strong>. During the student examination, lines are automatically shuffled into interactive draggable/touch-sortable blocks (Parson&apos;s puzzle).
                        </p>

                        <textarea
                          rows={6}
                          value={qCodeLinesText}
                          onChange={(e) => setQCodeLinesText(e.target.value)}
                          placeholder={`def find_max(arr):\n    max_val = arr[0]\n    for num in arr:\n        if num > max_val:\n            max_val = num\n    return max_val`}
                          className="w-full rounded-xl border border-[#2E2E34] bg-[#020617] p-3 text-xs font-mono text-[#EAEAE6] placeholder-slate-600 focus:border-[#EAEAE6] focus:outline-none leading-relaxed"
                        />

                        {qCodeLinesText && (
                          <div className="pt-2">
                            <span className="block text-[10px] font-mono uppercase text-[#A1A1AA] mb-1.5 font-bold">
                              Student Interactive Preview (Shuffled cards with touch controls):
                            </span>
                            <CodeQuestionRenderer
                              question={{
                                id: "preview_ordering",
                                prompt: qPrompt || "Arrange the code lines in the correct logical order:",
                                type: "code_ordering",
                                points: qPoints,
                                codeLanguage: qCodeLanguage,
                                codeLines: qCodeLinesText.split("\n").map(l => l.trimEnd()).filter(Boolean)
                              }}
                              mode="preview"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Predict Output Editor */}
                    {qType === "predict_output" && (
                      <div className="space-y-3 rounded-2xl bg-[#141416] p-4 border border-[#2E2E34]">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-[#EAEAE6] font-mono flex items-center space-x-1.5">
                            <Code className="h-4 w-4" />
                            <span>Source Code for Analysis</span>
                          </label>

                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-mono text-[#A1A1AA]">Language:</span>
                            <select
                              value={qCodeLanguage}
                              onChange={(e) => setQCodeLanguage(e.target.value)}
                              className="rounded-lg border border-[#2E2E34] bg-[#1C1C1F] px-2 py-0.5 text-xs font-mono text-[#EAEAE6] focus:border-[#EAEAE6] focus:outline-none"
                            >
                              <option value="python">Python</option>
                              <option value="javascript">JavaScript</option>
                              <option value="typescript">TypeScript</option>
                              <option value="java">Java</option>
                              <option value="c">C</option>
                              <option value="cpp">C++</option>
                              <option value="csharp">C#</option>
                              <option value="sql">SQL</option>
                              <option value="rust">Rust</option>
                              <option value="go">Go</option>
                              <option value="php">PHP</option>
                            </select>
                          </div>
                        </div>

                        <textarea
                          rows={6}
                          value={qCodeSnippet}
                          onChange={(e) => setQCodeSnippet(e.target.value)}
                          placeholder={`nums = [1, 2, 3, 4]\nres = [x * 2 for x in nums if x % 2 == 0]\nprint(res)`}
                          className="w-full rounded-xl border border-[#2E2E34] bg-[#020617] p-3 text-xs font-mono text-[#EAEAE6] placeholder-slate-600 focus:border-[#EAEAE6] focus:outline-none leading-relaxed"
                        />

                        <div>
                          <label className="block text-[11px] font-bold text-[#EAEAE6] mb-1">
                            Exact Expected Standard Terminal Output (stdout):
                          </label>
                          <input
                            type="text"
                            value={qCorrectText}
                            onChange={(e) => setQCorrectText(e.target.value)}
                            placeholder="e.g. [4, 8] or Hello, World!"
                            className="w-full rounded-xl border border-[#2E2E34] bg-[#020617] px-3.5 py-2 text-xs font-mono text-emerald-400 font-bold focus:border-[#EAEAE6] focus:outline-none"
                          />
                        </div>

                        {qCodeSnippet && (
                          <div className="pt-2">
                            <span className="block text-[10px] font-mono uppercase text-[#A1A1AA] mb-1.5 font-bold">
                              Student Interactive Preview (IDE + Terminal View):
                            </span>
                            <CodeQuestionRenderer
                              question={{
                                id: "preview_predict",
                                prompt: qPrompt || "Predict the printed output of this program:",
                                type: "predict_output",
                                points: qPoints,
                                codeSnippet: qCodeSnippet,
                                codeLanguage: qCodeLanguage,
                                correctAnswer: qCorrectText
                              }}
                              mode="preview"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Educational Explanation */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#A1A1AA] mb-1">
                        Explanation (Shown to students during post-exam review)
                      </label>
                      <input
                        type="text"
                        value={qExplanation}
                        onChange={(e) => setQExplanation(e.target.value)}
                        placeholder="e.g. Binary search halves the search space each step, resulting in O(log n) logarithmic complexity."
                        className="w-full rounded-xl border border-[#2E2E34] bg-[#141416] px-3 py-2 text-xs text-white placeholder-[#71717A] focus:border-[#EAEAE6] focus:outline-none"
                      />
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={handleSaveQuestion}
                        className="inline-flex items-center space-x-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-[#141416] hover:bg-emerald-500 transition-all shadow-md"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{editingQuestionIdx !== null ? "Update Question" : "Add Question to Exam"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-[#2E2E34] px-6 py-4 bg-[#1C1C1F]/70 shrink-0">
              <span className="text-xs font-mono text-[#A1A1AA]">
                {formQuestions.length} Questions &bull; Total Points:{" "}
                <strong className="text-emerald-400">
                  {formQuestions.reduce((s, q) => s + (Number(q.points) || 0), 0)}
                </strong>
              </span>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsBuilderOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#A1A1AA] hover:text-white bg-[#141416] border border-[#2E2E34]"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={savingExam}
                  onClick={() => handleSaveExam("draft")}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 border border-[#2E2E34] transition-all"
                >
                  Save as Draft
                </button>

                <button
                  type="button"
                  disabled={savingExam}
                  onClick={() => handleSaveExam("published")}
                  className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-bold text-[#141416] bg-emerald-500 hover:bg-emerald-400 hover:text-[#141416] transition-all shadow-lg disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{savingExam ? "Saving..." : "Publish Assessment"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: SUBMISSIONS & PROCTORING DESK */}
      {/* ========================================================================= */}
      {selectedExamForSubmissions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6 backdrop-blur-md animate-in fade-in">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-[#2E2E34] bg-[#141416] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-[#2E2E34] px-6 py-4 bg-[#1C1C1F]/70 shrink-0">
              <div>
                <div className="flex items-center space-x-2 text-xs font-mono text-[#EAEAE6] mb-0.5">
                  <span className="uppercase font-bold">{selectedExamForSubmissions.type}</span>
                  <span>&bull;</span>
                  <span>{selectedExamForSubmissions.courseCode}</span>
                </div>
                <h3 className="text-base font-extrabold text-white">
                  {selectedExamForSubmissions.title} &mdash; Student Attempts
                </h3>
              </div>

              <button
                onClick={() => setSelectedExamForSubmissions(null)}
                className="rounded-xl p-1.5 text-[#A1A1AA] hover:text-white hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingAttempts ? (
                <div className="py-20 text-center text-[#A1A1AA]">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#EAEAE6] border-t-transparent mb-3" />
                  Loading student attempts and proctoring logs...
                </div>
              ) : examAttempts.length === 0 ? (
                <div className="py-16 text-center text-[#A1A1AA] bg-[#1C1C1F]/40 rounded-2xl border border-[#2E2E34] p-6">
                  <Users className="mx-auto h-10 w-10 text-[#71717A] mb-2" />
                  <p className="text-sm font-bold text-white mb-1">No Student Attempts Yet</p>
                  <p className="text-xs text-[#A1A1AA] max-w-sm mx-auto">
                    Students enrolled in {selectedExamForSubmissions.courseCode} ({selectedExamForSubmissions.level}) will appear here when they start or submit this assessment.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Search and Filter Toolbar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#1C1C1F]/70 p-3 rounded-2xl border border-[#2E2E34]">
                    <div className="relative w-full sm:w-80">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#A1A1AA]" />
                      <input
                        type="text"
                        placeholder="Search student name, username, or level..."
                        value={attemptsSearchQuery}
                        onChange={(e) => setAttemptsSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-[#2E2E34] bg-[#141416] py-2 pl-9 pr-8 text-xs text-white placeholder-[#71717A] focus:border-[#EAEAE6] focus:outline-none"
                      />
                      {attemptsSearchQuery && (
                        <button
                          onClick={() => setAttemptsSearchQuery("")}
                          className="absolute right-2.5 top-2.5 text-xs text-[#A1A1AA] hover:text-white"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 self-end sm:self-center">
                      <div className="text-xs font-mono text-[#A1A1AA]">
                        Showing <span className="text-[#EAEAE6] font-bold">
                          {examAttempts.filter(att => {
                            if (!attemptsSearchQuery.trim()) return true;
                            const q = attemptsSearchQuery.toLowerCase();
                            return (
                              (att.studentName || "").toLowerCase().includes(q) ||
                              (att.studentUsername || "").toLowerCase().includes(q) ||
                              (att.studentLevel || "").toLowerCase().includes(q) ||
                              (att.status || "").toLowerCase().includes(q)
                            );
                          }).length}
                        </span> of {examAttempts.length} submissions
                      </div>
                      <button
                        type="button"
                        onClick={handleDownloadExamMarksCSV}
                        title="Download student marks for this assessment as a CSV spreadsheet"
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all shadow active:scale-95"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download Marks (CSV)</span>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#2E2E34] bg-[#1C1C1F] overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs min-w-[750px]">
                        <thead className="border-b border-[#2E2E34] bg-[#141416]/60 font-mono text-[#A1A1AA] uppercase">
                          <tr>
                            <th className="px-5 py-3">Student</th>
                            <th className="px-5 py-3">Level</th>
                            <th className="px-5 py-3">Duration / Submitted</th>
                            <th className="px-5 py-3">Proctoring Flags</th>
                            <th className="px-5 py-3">Score &amp; Status</th>
                            <th className="px-5 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2E2E34]/60 text-[#EAEAE6]">
                          {(() => {
                            const filtered = examAttempts.filter(att => {
                              if (!attemptsSearchQuery.trim()) return true;
                              const q = attemptsSearchQuery.toLowerCase();
                              return (
                                (att.studentName || "").toLowerCase().includes(q) ||
                                (att.studentUsername || "").toLowerCase().includes(q) ||
                                (att.studentLevel || "").toLowerCase().includes(q) ||
                                (att.status || "").toLowerCase().includes(q)
                              );
                            });

                            // Group all attempts by the same student under one single name
                            const groupsMap = new Map<string, ExamAttempt[]>();
                            filtered.forEach((att) => {
                              const key = att.studentUid || att.studentUsername || att.studentName;
                              const arr = groupsMap.get(key) || [];
                              arr.push(att);
                              groupsMap.set(key, arr);
                            });

                            return Array.from(groupsMap.entries()).map(([studentKey, studentAttempts]) => {
                              const sorted = [...studentAttempts].sort((a, b) => (b.attemptNumber || 1) - (a.attemptNumber || 1));
                              const latest = sorted[0];
                              const isMulti = sorted.length > 1;
                              const isExpanded = !!expandedStudentGroups[studentKey];
                              const bestScoreAtt = sorted.reduce((best, cur) => ((cur.percentage || 0) >= (best.percentage || 0) ? cur : best), sorted[0]);
                              const totalViolations = sorted.reduce((sum, a) => sum + (a.tabSwitchCount || 0), 0);
                              const hasOverride = !!selectedExamForSubmissions.studentOverrides?.[latest.studentUid];
                              const anyPendingReview = sorted.some(a => a.status === "submitted");
                              const isGraded = latest.status === "graded";

                              return (
                                <React.Fragment key={studentKey}>
                                  <tr className="hover:bg-[#141416]/40 transition-colors">
                                    <td className="px-5 py-3.5">
                                      <div className="flex items-center space-x-2">
                                        {isMulti && (
                                          <button
                                            type="button"
                                            onClick={() => setExpandedStudentGroups(prev => ({ ...prev, [studentKey]: !prev[studentKey] }))}
                                            className="rounded-md bg-[#141416] border border-[#2E2E34] p-1 text-[#EAEAE6] hover:border-emerald-500/50 transition-colors"
                                            title={isExpanded ? "Collapse attempts" : `Show all ${sorted.length} attempts`}
                                          >
                                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                          </button>
                                        )}
                                        <div>
                                          <div className="flex items-center space-x-2">
                                            <span className="font-bold text-white">{latest.studentName}</span>
                                            {isMulti && (
                                              <button
                                                type="button"
                                                onClick={() => setExpandedStudentGroups(prev => ({ ...prev, [studentKey]: !prev[studentKey] }))}
                                                className="rounded-full bg-[#EAEAE6]/15 border border-[#EAEAE6]/30 px-2 py-0.5 text-[10px] font-mono font-bold text-[#EAEAE6] hover:bg-[#EAEAE6] hover:text-[#141416] transition-all"
                                              >
                                                {sorted.length} Attempts
                                              </button>
                                            )}
                                            {hasOverride && (
                                              <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-300">
                                                Override Active
                                              </span>
                                            )}
                                          </div>
                                          <span className="text-[10px] font-mono text-[#71717A]">@{latest.studentUsername}</span>
                                        </div>
                                      </div>
                                    </td>

                                    <td className="px-5 py-3.5 font-mono text-[11px] text-[#A1A1AA]">
                                      {latest.studentLevel}
                                    </td>

                                    <td className="px-5 py-3.5">
                                      <div className="font-mono text-xs text-white">
                                        {Math.floor(latest.timeSpentSeconds / 60)}m {latest.timeSpentSeconds % 60}s
                                      </div>
                                      <span className="text-[10px] font-mono text-[#71717A]">
                                        {isMulti ? `Latest (#${latest.attemptNumber}) • ` : ""}
                                        {latest.submittedAt ? new Date(latest.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "In Progress"}
                                      </span>
                                    </td>

                                    {/* Proctoring Tab Switches */}
                                    <td className="px-5 py-3.5">
                                      {totalViolations > 0 ? (
                                        <span className="inline-flex items-center space-x-1 rounded-md bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[11px] font-mono font-bold text-rose-300">
                                          <ShieldAlert className="h-3 w-3" />
                                          <span>{totalViolations} Tab Switches</span>
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center space-x-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-mono text-emerald-400">
                                          <CheckCircle2 className="h-3 w-3" />
                                          <span>Clean Attempt</span>
                                        </span>
                                      )}
                                    </td>

                                    <td className="px-5 py-3.5">
                                      {anyPendingReview ? (
                                        <span className="inline-flex items-center space-x-1 rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[11px] font-mono font-bold text-amber-400">
                                          <Clock className="h-3 w-3" />
                                          <span>Review Required</span>
                                        </span>
                                      ) : isGraded ? (
                                        <div className="flex flex-col">
                                          <span className={`inline-flex items-center space-x-1 font-mono font-bold text-xs ${
                                            bestScoreAtt.passed ? "text-emerald-400" : "text-rose-400"
                                          }`}>
                                            <span>{bestScoreAtt.score} / {bestScoreAtt.maxScore}</span>
                                            <span>({bestScoreAtt.percentage}%)</span>
                                            {isMulti && <span className="text-[10px] text-[#A1A1AA]">Best</span>}
                                          </span>
                                          <span className={`text-[10px] font-mono uppercase font-bold mt-0.5 ${
                                            bestScoreAtt.passed ? "text-emerald-500" : "text-rose-500"
                                          }`}>
                                            {bestScoreAtt.passed ? "Passed" : "Failed"}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-[11px] font-mono text-[#A1A1AA]">In Progress</span>
                                      )}
                                    </td>

                                    <td className="px-5 py-3.5 text-right">
                                      <div className="inline-flex items-center justify-end gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => handleOpenOverrideModal(latest.studentUid, latest.studentName, latest.studentUsername)}
                                          className="inline-flex items-center space-x-1 rounded-lg bg-[#141416] border border-[#2E2E34] px-2.5 py-1 text-xs font-bold text-amber-300 hover:border-amber-400 transition-all"
                                          title="Grant Extra Attempt, Extra Time, or Extended Deadline"
                                        >
                                          <UserPlus className="h-3.5 w-3.5" />
                                          <span>Grant</span>
                                        </button>

                                        {!isMulti ? (
                                          <button
                                            onClick={() => handleOpenGradingModal(latest)}
                                            className="inline-flex items-center space-x-1 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-300 hover:bg-emerald-500 hover:text-[#141416] transition-all border border-emerald-500/40"
                                          >
                                            <Award className="h-3.5 w-3.5" />
                                            <span>{isGraded ? "Edit Grade" : "Grade & Review"}</span>
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => setExpandedStudentGroups(prev => ({ ...prev, [studentKey]: !prev[studentKey] }))}
                                            className="inline-flex items-center space-x-1 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-300 hover:bg-emerald-500 hover:text-[#141416] transition-all border border-emerald-500/40"
                                          >
                                            <span>{isExpanded ? "Hide Attempts" : `View ${sorted.length} Attempts`}</span>
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>

                                  {isMulti && isExpanded && sorted.map((subAtt) => {
                                    const subGraded = subAtt.status === "graded";
                                    return (
                                      <tr key={subAtt.id} className="bg-[#141416]/70 border-l-2 border-emerald-500/50">
                                        <td className="pl-12 pr-5 py-2.5 text-[11px] font-mono text-[#A1A1AA]">
                                          ↳ Attempt #{subAtt.attemptNumber}
                                          {subAtt.autoSubmittedReason && (
                                            <span className="ml-2 rounded bg-rose-500/15 px-1.5 py-0.5 text-[9px] text-rose-300">
                                              {subAtt.autoSubmittedReason}
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-5 py-2.5 font-mono text-[11px] text-[#71717A]">{subAtt.studentLevel}</td>
                                        <td className="px-5 py-2.5 font-mono text-[11px] text-[#A1A1AA]">
                                          {Math.floor(subAtt.timeSpentSeconds / 60)}m {subAtt.timeSpentSeconds % 60}s &bull;{" "}
                                          {subAtt.submittedAt ? new Date(subAtt.submittedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "In Progress"}
                                        </td>
                                        <td className="px-5 py-2.5 font-mono text-[11px]">
                                          {subAtt.tabSwitchCount > 0 ? (
                                            <span className="text-rose-300">{subAtt.tabSwitchCount} switches</span>
                                          ) : (
                                            <span className="text-emerald-400">Clean</span>
                                          )}
                                        </td>
                                        <td className="px-5 py-2.5 font-mono text-[11px]">
                                          {subGraded ? (
                                            <span className={subAtt.passed ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                                              {subAtt.score} / {subAtt.maxScore} ({subAtt.percentage}%)
                                            </span>
                                          ) : (
                                            <span className="text-amber-400">Pending Review</span>
                                          )}
                                        </td>
                                        <td className="px-5 py-2.5 text-right">
                                          <button
                                            onClick={() => handleOpenGradingModal(subAtt)}
                                            className="inline-flex items-center space-x-1 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500 hover:text-[#141416] transition-all border border-emerald-500/40"
                                          >
                                            <Award className="h-3 w-3" />
                                            <span>{subGraded ? "Edit Grade" : "Grade"}</span>
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </React.Fragment>
                              );
                            });
                          })()}
                        </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: INDIVIDUAL STUDENT ATTEMPT REVIEW & GRADING MODAL */}
      {/* ========================================================================= */}
      {gradingAttempt && selectedExamForSubmissions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-6 backdrop-blur-md animate-in fade-in">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-[#2E2E34] bg-[#141416] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-[#2E2E34] px-6 py-4 bg-[#1C1C1F]/70 shrink-0">
              <div>
                <h3 className="text-base font-extrabold text-white">
                  Grading Attempt: {gradingAttempt.studentName}
                </h3>
                <p className="text-xs text-[#A1A1AA]">
                  {selectedExamForSubmissions.title} &bull; {selectedExamForSubmissions.courseCode} &bull; Time: {Math.floor(gradingAttempt.timeSpentSeconds / 60)}m {gradingAttempt.timeSpentSeconds % 60}s
                </p>
              </div>

              <button
                onClick={() => setGradingAttempt(null)}
                className="rounded-xl p-1.5 text-[#A1A1AA] hover:text-white hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Cheating warning if applicable */}
              {gradingAttempt.tabSwitchCount > 0 && (
                <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-200 flex items-start space-x-3">
                  <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-rose-300 font-bold">Proctoring Notice: Tab Switches Detected</strong>
                    <span>
                      This student unfocused or switched browser tabs {gradingAttempt.tabSwitchCount} time(s) during their test.
                    </span>
                  </div>
                </div>
              )}

              {/* Questions Review */}
              <div className="space-y-4">
                {selectedExamForSubmissions.questions.map((q, idx) => {
                  const studentAnswer = gradingAttempt.answers[q.id];
                  const currentGrade = editableGrades[q.id] || { awardedPoints: 0, feedback: "" };

                  return (
                    <div
                      key={q.id}
                      className="rounded-2xl border border-[#2E2E34] bg-[#1C1C1F] p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-[#2E2E34]/60 pb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold text-[#EAEAE6]">#{idx + 1}</span>
                          <span className="rounded bg-[#141416] px-2 py-0.5 text-[10px] font-mono uppercase text-[#A1A1AA]">
                            {q.type.replace("_", " ")}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="text-[11px] font-mono text-[#A1A1AA]">Awarded:</span>
                          <input
                            type="number"
                            min={0}
                            max={q.points}
                            value={currentGrade.awardedPoints}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setEditableGrades(prev => ({
                                ...prev,
                                [q.id]: { ...prev[q.id], awardedPoints: val }
                              }));
                            }}
                            className="w-16 rounded-lg border border-[#2E2E34] bg-[#141416] px-2 py-1 text-xs font-mono font-bold text-emerald-400 focus:border-[#EAEAE6] focus:outline-none"
                          />
                          <span className="text-xs font-mono text-[#A1A1AA]">/ {q.points} Pts</span>
                        </div>
                      </div>

                      {/* Question Prompt */}
                      <p className="text-xs text-white font-medium">{q.prompt}</p>

                      {/* Student's Given Answer */}
                      <div className="rounded-xl bg-[#141416] p-3 text-xs border border-[#2E2E34]">
                        <span className="text-[10px] font-mono text-[#EAEAE6] uppercase block mb-1">
                          Student's Answer:
                        </span>
                        <div className="font-mono text-white whitespace-pre-wrap">
                          {studentAnswer !== undefined && studentAnswer !== null
                            ? (Array.isArray(studentAnswer) ? studentAnswer.join(", ") : String(studentAnswer))
                            : <span className="text-[#71717A] italic">No answer provided</span>
                          }
                        </div>
                      </div>

                      {/* Expected Answer (if available) */}
                      {q.correctAnswer !== undefined && (
                        <div className="text-[11px] font-mono text-[#A1A1AA]">
                          Expected Target: <strong className="text-emerald-400">{Array.isArray(q.correctAnswer) ? q.correctAnswer.join(", ") : String(q.correctAnswer)}</strong>
                        </div>
                      )}

                      {/* Per-Question Teacher Feedback */}
                      <div>
                        <input
                          type="text"
                          value={currentGrade.feedback}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditableGrades(prev => ({
                              ...prev,
                              [q.id]: { ...prev[q.id], feedback: val }
                            }));
                          }}
                          placeholder="Feedback or correction on this question (optional)..."
                          className="w-full rounded-xl border border-[#2E2E34] bg-[#141416] px-3 py-1.5 text-xs text-white placeholder-[#71717A] focus:border-[#EAEAE6] focus:outline-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Overall Feedback */}
              <div>
                <label className="block text-xs font-bold text-white mb-1">Overall Teacher Remarks &amp; Feedback</label>
                <textarea
                  rows={3}
                  value={generalFeedback}
                  onChange={(e) => setGeneralFeedback(e.target.value)}
                  placeholder="Provide overall constructive advice and comments for this student's exam attempt..."
                  className="w-full rounded-2xl border border-[#2E2E34] bg-[#141416] p-3 text-xs text-white placeholder-[#71717A] focus:border-[#EAEAE6] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[#2E2E34] px-6 py-4 bg-[#1C1C1F]/70 shrink-0">
              <button
                type="button"
                onClick={() => setGradingAttempt(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#A1A1AA] hover:text-white bg-[#141416] border border-[#2E2E34]"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={savingGrade}
                onClick={handleSaveAttemptGrade}
                className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-bold text-[#141416] bg-emerald-400 hover:bg-emerald-500 hover:text-white transition-all shadow-lg"
              >
                <Award className="h-4 w-4" />
                <span>{savingGrade ? "Saving..." : "Submit Grade & Evaluation"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* MODAL 4: BULK QUESTION IMPORT & TEMPLATE MODAL */}
      {/* ========================================================================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-6 backdrop-blur-md animate-in fade-in">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-[#2E2E34] bg-[#141416] shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#2E2E34] px-6 py-4 bg-[#1C1C1F]/70 shrink-0">
              <div className="flex items-center space-x-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAEAE6]/20 text-[#EAEAE6]">
                  <Upload className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Bulk Import Questions
                  </h3>
                  <p className="text-xs text-[#A1A1AA]">
                    Import questions from AI outputs (ChatGPT / Gemini / Claude), plain text documents, spreadsheets (CSV), or JSON.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportInputText("");
                  setImportFileName(null);
                  setParsedPreviewQuestions([]);
                  setImportErrors([]);
                }}
                className="rounded-xl p-1.5 text-[#A1A1AA] hover:text-white hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* AI Prompt & Templates Banner */}
              <div className="rounded-2xl border border-[#EAEAE6]/30 bg-gradient-to-r from-cyan-950/30 to-[#1C1C1F] p-4.5 space-y-3 shadow-lg">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center space-x-1.5">
                      <Sparkles className="h-4 w-4 text-[#EAEAE6]" />
                      <span>AI Exam Generator &amp; Starter Templates</span>
                    </span>
                    <p className="text-[11px] text-[#A1A1AA] mt-0.5">
                      Generate tests in seconds with ChatGPT, Gemini, or Claude, or download template files to write your questions.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* Copy AI Prompt Button */}
                    <button
                      type="button"
                      onClick={handleCopyAIPrompt}
                      className={`inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
                        copiedAIPrompt
                          ? "bg-emerald-400 text-[#141416] shadow-emerald-500/20"
                          : "bg-[#EAEAE6] hover:bg-[#EAEAE6] text-[#141416]"
                      }`}
                    >
                      {copiedAIPrompt ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-[#141416] font-bold" />
                          <span>Copied to Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy AI Prompt</span>
                        </>
                      )}
                    </button>

                    {/* Download Markdown (.md) */}
                    <button
                      type="button"
                      onClick={downloadExamTemplateMarkdown}
                      className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all shadow"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Markdown (.md)</span>
                    </button>

                    {/* Download Plain Text */}
                    <button
                      type="button"
                      onClick={downloadExamTemplatePlainText}
                      className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#EAEAE6] bg-[#EAEAE6]/10 border border-[#EAEAE6]/30 hover:bg-[#EAEAE6]/20 transition-all shadow"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Plain Text (.txt)</span>
                    </button>

                    {/* Download CSV */}
                    <button
                      type="button"
                      onClick={downloadExamTemplateCSV}
                      className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all shadow"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      <span>Excel CSV</span>
                    </button>

                    {/* Download JSON */}
                    <button
                      type="button"
                      onClick={downloadExamTemplateJSON}
                      className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold text-purple-400 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 transition-all shadow"
                    >
                      <FileCode className="h-3.5 w-3.5" />
                      <span>JSON</span>
                    </button>
                  </div>
                </div>

                {/* Natural Format Example Pill */}
                <div className="rounded-xl bg-[#141416] p-3 text-[11px] font-mono border border-[#2E2E34] flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="space-y-0.5 text-[#EAEAE6]">
                    <div className="text-white font-bold flex items-center space-x-1.5">
                      <Bot className="h-3.5 w-3.5 text-[#EAEAE6]" />
                      <span>Natural AI / Plain Text Format Example:</span>
                    </div>
                    <div className="text-[#A1A1AA]">
                      1. What is the function of a router? &bull; A) Forwards network packets &bull; B) Cools the computer &bull; Answer: A &bull; Points: 2
                    </div>
                  </div>
                  <span className="text-[10px] text-[#EAEAE6] font-bold bg-cyan-950/70 border border-[#EAEAE6]/30 px-2 py-1 rounded-lg shrink-0">
                    Works automatically with any AI output!
                  </span>
                </div>
              </div>

              {/* Format Filter Selection */}
              <div className="flex items-center space-x-2 text-xs">
                <span className="font-mono text-[11px] text-[#A1A1AA] font-bold uppercase">Format Mode:</span>
                <div className="flex items-center space-x-1 bg-[#1C1C1F] p-1 rounded-xl border border-[#2E2E34]">
                  <button
                    type="button"
                    onClick={() => {
                      setImportFormatSelection("auto");
                      runParseContent(importInputText, importFileName || undefined, "auto");
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                      importFormatSelection === "auto"
                        ? "bg-[#EAEAE6] text-[#141416] shadow"
                        : "text-[#A1A1AA] hover:text-white"
                    }`}
                  >
                    Auto-Detect
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImportFormatSelection("plain_text");
                      runParseContent(importInputText, importFileName || undefined, "plain_text");
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                      importFormatSelection === "plain_text"
                        ? "bg-[#EAEAE6] text-[#141416] shadow"
                        : "text-[#A1A1AA] hover:text-white"
                    }`}
                  >
                    Markdown / AI (.md)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImportFormatSelection("csv");
                      runParseContent(importInputText, importFileName || undefined, "csv");
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                      importFormatSelection === "csv"
                        ? "bg-[#EAEAE6] text-[#141416] shadow"
                        : "text-[#A1A1AA] hover:text-white"
                    }`}
                  >
                    CSV (Excel)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImportFormatSelection("json");
                      runParseContent(importInputText, importFileName || undefined, "json");
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                      importFormatSelection === "json"
                        ? "bg-[#EAEAE6] text-[#141416] shadow"
                        : "text-[#A1A1AA] hover:text-white"
                    }`}
                  >
                    JSON
                  </button>
                </div>
              </div>

              {/* Import Source Tabs */}
              <div className="flex border-b border-[#2E2E34] space-x-4">
                <button
                  type="button"
                  onClick={() => setImportSourceTab("upload")}
                  className={`pb-3 text-xs font-bold transition-all flex items-center space-x-2 border-b-2 ${
                    importSourceTab === "upload"
                      ? "border-[#EAEAE6] text-[#EAEAE6]"
                      : "border-transparent text-[#A1A1AA] hover:text-white"
                  }`}
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload File (.md, .txt, .csv, .json)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImportSourceTab("paste")}
                  className={`pb-3 text-xs font-bold transition-all flex items-center space-x-2 border-b-2 ${
                    importSourceTab === "paste"
                      ? "border-[#EAEAE6] text-[#EAEAE6]"
                      : "border-transparent text-[#A1A1AA] hover:text-white"
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  <span>Paste Raw Text / Markdown</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImportSourceTab("ams_sync")}
                  className={`pb-3 text-xs font-bold transition-all flex items-center space-x-2 border-b-2 relative ${
                    importSourceTab === "ams_sync"
                      ? "border-emerald-400 text-emerald-400"
                      : "border-transparent text-[#A1A1AA] hover:text-white"
                  }`}
                >
                  <Server className="h-4 w-4 text-emerald-400" />
                  <span>Live Sync with AMS (Python)</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Bridge
                  </span>
                </button>
              </div>

              {/* Source Tab Contents */}
              {importSourceTab === "upload" && (
                <div className="rounded-2xl border border-[#2E2E34] bg-[#1C1C1F] p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-bold text-white mb-0.5">
                        Drop or Select Your Assessment File
                      </label>
                      <p className="text-[11px] text-[#A1A1AA]">
                        Supports Markdown (<strong>.md</strong>), Plain Text (<strong>.txt</strong>), Excel CSV (<strong>.csv</strong>), and JSON (<strong>.json</strong>).
                      </p>
                    </div>
                    {importFileName && (
                      <span className="text-xs font-mono font-bold text-[#EAEAE6] bg-cyan-950/70 border border-[#EAEAE6]/30 px-2.5 py-1 rounded-lg">
                        {importFileName}
                      </span>
                    )}
                  </div>

                  <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#2E2E34] bg-[#141416] p-8 cursor-pointer hover:border-[#EAEAE6] transition-all group text-center">
                    <Upload className="h-8 w-8 text-[#A1A1AA] group-hover:text-[#EAEAE6] transition-all mb-2.5" />
                    <span className="text-sm font-bold text-white group-hover:text-[#EAEAE6]">
                      {importFileName ? importFileName : "Click to Browse or Drag File Here"}
                    </span>
                    <span className="text-[11px] text-[#71717A] mt-1.5">
                      Accepts .md (Markdown), .txt (AI output), .csv (Spreadsheet), and .json
                    </span>
                    <input
                      type="file"
                      accept=".md,.markdown,.txt,.csv,.json,text/markdown,text/plain,text/csv,application/json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {importSourceTab === "paste" && (
                <div className="rounded-2xl border border-[#2E2E34] bg-[#1C1C1F] p-5 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <label className="block text-xs font-bold text-white mb-0.5">
                        Paste Raw AI Output or Markdown Document
                      </label>
                      <p className="text-[11px] text-[#A1A1AA]">
                        Paste text copied straight from ChatGPT, Gemini, Claude, or your Python AMS output.
                      </p>
                    </div>
                    {importInputText && (
                      <button
                        type="button"
                        onClick={() => handleTextareaChange("")}
                        className="text-xs text-rose-400 hover:underline font-bold"
                      >
                        Clear Text
                      </button>
                    )}
                  </div>

                  <textarea
                    rows={8}
                    value={importInputText}
                    onChange={(e) => handleTextareaChange(e.target.value)}
                    placeholder={`### Question 1 [multiple_choice] (3 pts)\nWhich data structure is immutable in Python?\n* A) List\n* B) Tuple (Correct)\n* C) Set\n* D) Dictionary\n\n### Question 2 [code_completion] (5 pts)\nFill in the missing loop operator:\n\`\`\`python\ntotal = 0\nfor x in items:\n    total ___1___ x\nreturn total\n\`\`\`\n* Blank 1: +=\n\n### Question 3 [predict_output] (4 pts)\nWhat will this print?\n\`\`\`python\nprint("Hello" * 2)\n\`\`\`\n* Output: HelloHello`}
                    className="w-full rounded-xl border border-[#2E2E34] bg-[#141416] p-3.5 text-xs font-mono text-[#EAEAE6] placeholder-[#71717A] focus:border-[#EAEAE6] focus:outline-none resize-none leading-relaxed"
                  />
                </div>
              )}

              {importSourceTab === "ams_sync" && (
                <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-[#1C1C1F] to-[#141416] p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <Server className="h-5 w-5 text-emerald-400" />
                        <h4 className="text-sm font-bold text-white">Live Python AMS Curriculum Sync</h4>
                      </div>
                      <p className="text-xs text-[#A1A1AA] mt-1">
                        Directly queries your Python Django AMS backend to generate and parse assessment questions on demand.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 border border-emerald-500/40 px-2.5 py-1 rounded-lg shrink-0">
                      Python ↔ Next.js
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#EAEAE6] mb-1">
                        AMS API Endpoint URL
                      </label>
                      <input
                        type="url"
                        value={amsEndpointUrl}
                        onChange={(e) => setAmsEndpointUrl(e.target.value)}
                        placeholder="http://127.0.0.1:8000/api/exams/generate/"
                        className="w-full rounded-xl border border-[#2E2E34] bg-[#141416] px-3.5 py-2.5 text-xs font-mono text-white placeholder-[#71717A] focus:border-emerald-400 focus:outline-none"
                      />
                      <span className="text-[10px] text-[#71717A] mt-1 block">
                        Defaults to local Django endpoint. Supports ngrok or hosted URLs.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#EAEAE6] mb-1">
                        Subject / Topic Query
                      </label>
                      <input
                        type="text"
                        value={amsTopic}
                        onChange={(e) => setAmsTopic(e.target.value)}
                        placeholder={formTitle || "e.g., Python Data Structures & Functions"}
                        className="w-full rounded-xl border border-[#2E2E34] bg-[#141416] px-3.5 py-2.5 text-xs text-white placeholder-[#71717A] focus:border-emerald-400 focus:outline-none"
                      />
                      <span className="text-[10px] text-[#71717A] mt-1 block">
                        Leave blank to use current assessment title ({formTitle || "Assessment"}).
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center space-x-3 text-xs">
                      <div>
                        <span className="text-[#A1A1AA] text-xs mr-2 font-bold">Questions:</span>
                        <select
                          value={amsQuestionCount}
                          onChange={(e) => setAmsQuestionCount(Number(e.target.value))}
                          className="rounded-lg border border-[#2E2E34] bg-[#141416] px-2.5 py-1 text-xs text-white focus:outline-none font-bold"
                        >
                          <option value={3}>3 questions</option>
                          <option value={5}>5 questions</option>
                          <option value={10}>10 questions</option>
                          <option value={15}>15 questions</option>
                        </select>
                      </div>

                      <div>
                        <span className="text-[#A1A1AA] text-xs mr-2 font-bold">Difficulty:</span>
                        <select
                          value={amsDifficulty}
                          onChange={(e) => setAmsDifficulty(e.target.value as any)}
                          className="rounded-lg border border-[#2E2E34] bg-[#141416] px-2.5 py-1 text-xs text-white focus:outline-none font-bold capitalize"
                        >
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={amsSyncing}
                      onClick={handleSyncWithAMS}
                      className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-[#141416] transition-all shadow-md active:scale-95 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${amsSyncing ? "animate-spin" : ""}`} />
                      <span>{amsSyncing ? "Connecting to AMS..." : "Generate & Pull from AMS"}</span>
                    </button>
                  </div>

                  {/* Sync Success Banner */}
                  {amsSyncSuccess && (
                    <div className="flex items-center space-x-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 p-3 text-xs text-emerald-300">
                      <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                      <span>{amsSyncSuccess}</span>
                    </div>
                  )}

                  {/* Sync Error with Graceful Fallback Explanation */}
                  {amsSyncError && (
                    <div className="rounded-xl bg-rose-950/40 border border-rose-500/40 p-3.5 space-y-2 text-xs">
                      <div className="flex items-start space-x-2 text-rose-300">
                        <WifiOff className="h-4 w-4 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <span className="font-bold block">AMS Connection Notice:</span>
                          <span className="block text-[#EAEAE6] text-[11px] leading-relaxed">
                            {amsSyncError}
                          </span>
                        </div>
                      </div>

                      <div className="border-t border-rose-500/20 pt-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] text-[#A1A1AA]">
                          Tip: If AMS is not hosted, copy the Markdown generated in Python and paste it directly.
                        </span>
                        <button
                          type="button"
                          onClick={() => setImportSourceTab("paste")}
                          className="text-[11px] font-bold text-[#EAEAE6] hover:underline"
                        >
                          Switch to Paste Markdown &rarr;
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Import Mode: Append vs Replace */}
              <div className="flex items-center justify-between rounded-2xl border border-[#2E2E34] bg-[#1C1C1F] p-4">
                <div>
                  <span className="text-xs font-bold text-white block">Import Action</span>
                  <span className="text-[11px] text-[#A1A1AA]">
                    Choose how imported questions are merged with this assessment.
                  </span>
                </div>

                <div className="flex items-center space-x-2 bg-[#141416] p-1 rounded-xl border border-[#2E2E34]">
                  <button
                    type="button"
                    onClick={() => setImportMode("append")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      importMode === "append"
                        ? "bg-[#EAEAE6] text-[#141416] shadow"
                        : "text-[#A1A1AA] hover:text-white"
                    }`}
                  >
                    Append to Existing ({formQuestions.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportMode("replace")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      importMode === "replace"
                        ? "bg-rose-500 text-white shadow"
                        : "text-[#A1A1AA] hover:text-white"
                    }`}
                  >
                    Replace All Existing
                  </button>
                </div>
              </div>

              {/* Errors & Warnings if any */}
              {importErrors.length > 0 && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-1.5">
                  <div className="flex items-center space-x-2 text-xs font-bold text-amber-400 font-mono">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Import Notices &amp; Warnings ({importErrors.length})</span>
                  </div>
                  <ul className="text-[11px] text-amber-200 list-disc list-inside space-y-0.5">
                    {importErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Live Preview of Parsed Questions */}
              {parsedPreviewQuestions.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white uppercase font-mono tracking-wider">
                        Valid Questions Ready ({parsedPreviewQuestions.length}) &bull; Total Points:{" "}
                        <span className="text-[#EAEAE6]">
                          {parsedPreviewQuestions.reduce((s, q) => s + (Number(q.points) || 0), 0)} Pts
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg border font-bold uppercase tracking-wider text-[#EAEAE6] border-[#EAEAE6]/30 bg-[#EAEAE6]/10">
                        Detected: {detectedFormat === "plain_text" ? "AI Plain Text" : detectedFormat.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center flex-wrap gap-1.5 text-[10px] font-mono">
                      <span className="rounded bg-[#EAEAE6]/10 border border-[#EAEAE6]/30 px-2 py-0.5 text-[#EAEAE6]">
                        {parsedPreviewQuestions.filter(q => q.type === "multiple_choice").length} Single Choice
                      </span>
                      <span className="rounded bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 text-indigo-300">
                        {parsedPreviewQuestions.filter(q => q.type === "multiple_select").length} Multi-Select
                      </span>
                      <span className="rounded bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 text-purple-300">
                        {parsedPreviewQuestions.filter(q => q.type === "true_false").length} True/False
                      </span>
                      <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-emerald-300">
                        {parsedPreviewQuestions.filter(q => q.type === "short_answer").length} Short
                      </span>
                      <span className="rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-amber-300">
                        {parsedPreviewQuestions.filter(q => q.type === "essay").length} Essay
                      </span>
                      {parsedPreviewQuestions.some(q => q.type === "code_completion") && (
                        <span className="rounded bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 text-sky-300">
                          {parsedPreviewQuestions.filter(q => q.type === "code_completion").length} Code Blanks
                        </span>
                      )}
                      {parsedPreviewQuestions.some(q => q.type === "code_ordering") && (
                        <span className="rounded bg-teal-500/10 border border-teal-500/30 px-2 py-0.5 text-teal-300">
                          {parsedPreviewQuestions.filter(q => q.type === "code_ordering").length} Code Ordering
                        </span>
                      )}
                      {parsedPreviewQuestions.some(q => q.type === "predict_output") && (
                        <span className="rounded bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 text-blue-300">
                          {parsedPreviewQuestions.filter(q => q.type === "predict_output").length} Predict Output
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {parsedPreviewQuestions.map((q, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-[#2E2E34] bg-[#1C1C1F] p-3 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#141416] font-mono text-[10px] font-bold text-[#EAEAE6]">
                              {idx + 1}
                            </span>
                            <span className="rounded bg-[#141416] border border-[#2E2E34] px-1.5 py-0.2 text-[10px] font-mono uppercase text-[#EAEAE6] font-bold">
                              {q.type.replace("_", " ")}
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400 font-bold">
                              {q.points} Pts
                            </span>
                          </div>
                        </div>

                        <p className="text-white font-medium">{q.prompt}</p>

                        {/* Options preview */}
                        {q.options && q.options.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                            {q.options.map((opt, oIdx) => {
                              const isCorrect = Array.isArray(q.correctAnswer)
                                ? q.correctAnswer.includes(String(oIdx))
                                : String(q.correctAnswer) === String(oIdx);

                              return (
                                <div
                                  key={oIdx}
                                  className={`rounded-lg px-2.5 py-1 text-[11px] border flex items-center justify-between ${
                                    isCorrect
                                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 font-bold"
                                      : "border-[#2E2E34] bg-[#141416] text-[#A1A1AA]"
                                  }`}
                                >
                                  <span>{String.fromCharCode(65 + oIdx)}. {opt}</span>
                                  {isCorrect && (
                                    <Check className="h-3 w-3 text-emerald-400 shrink-0 ml-1" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* True / False indicator */}
                        {q.type === "true_false" && (
                          <div className="text-[11px] text-emerald-300 font-bold">
                            Correct Answer: {q.correctAnswer ? "True" : "False"}
                          </div>
                        )}

                        {/* Short Answer / Essay Guideline */}
                        {(q.type === "short_answer" || q.type === "essay") && q.correctAnswer && (
                          <div className="text-[11px] text-slate-300">
                            <span className="font-bold text-[#EAEAE6]">Accepted Answer / Rubric: </span>
                            {String(q.correctAnswer)}
                          </div>
                        )}

                        {q.explanation && (
                          <div className="text-[10px] text-[#A1A1AA] italic">
                            Rationale: {q.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#2E2E34] bg-[#141416]/60 p-8 text-center text-xs text-[#A1A1AA]">
                  Select a file or paste formatted CSV/JSON above to view preview and import questions.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-[#2E2E34] px-6 py-4 bg-[#1C1C1F]/70 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportInputText("");
                  setImportFileName(null);
                  setParsedPreviewQuestions([]);
                  setImportErrors([]);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#A1A1AA] hover:text-white bg-[#141416] border border-[#2E2E34]"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={parsedPreviewQuestions.length === 0}
                onClick={handleConfirmImport}
                className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-bold text-[#141416] bg-emerald-500 hover:bg-emerald-400 hover:text-[#141416] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  Confirm &amp; Import ({parsedPreviewQuestions.length} Questions)
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2B: PER-STUDENT OVERRIDE (EXTRA ATTEMPTS / EXTRA TIME / DEADLINE) */}
      {/* ========================================================================= */}
      {overrideTargetStudent && selectedExamForSubmissions && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-[#2E2E34] bg-[#141416] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#2E2E34] pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-amber-300 font-bold block">Student Exception Grant</span>
                <h4 className="text-base font-extrabold text-white">
                  {overrideTargetStudent.name} <span className="text-xs font-mono text-[#A1A1AA]">(@{overrideTargetStudent.username})</span>
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setOverrideTargetStudent(null)}
                className="rounded-lg p-1.5 text-[#A1A1AA] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#A1A1AA] mb-1">Extra Attempts (+)</label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={overrideExtraAttempts}
                    onChange={(e) => setOverrideExtraAttempts(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#2E2E34] bg-[#1C1C1F] px-3 py-2 text-xs font-mono text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#A1A1AA] mb-1">Extra Time (+ Mins)</label>
                  <input
                    type="number"
                    min={0}
                    max={180}
                    value={overrideExtraMinutes}
                    onChange={(e) => setOverrideExtraMinutes(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#2E2E34] bg-[#1C1C1F] px-3 py-2 text-xs font-mono text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#A1A1AA] mb-1">Extended Deadline (Optional)</label>
                <input
                  type="datetime-local"
                  value={overrideExtendedDueDate}
                  onChange={(e) => setOverrideExtendedDueDate(e.target.value)}
                  className="w-full rounded-xl border border-[#2E2E34] bg-[#1C1C1F] px-3 py-2 text-xs font-mono text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#A1A1AA] mb-1">Reason / Note</label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Medical excuse or connectivity drop"
                  className="w-full rounded-xl border border-[#2E2E34] bg-[#1C1C1F] px-3 py-2 text-xs text-white placeholder-[#71717A] focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#2E2E34]">
              <button
                type="button"
                onClick={() => setOverrideTargetStudent(null)}
                className="rounded-xl border border-[#2E2E34] bg-[#1C1C1F] px-4 py-2 text-xs font-semibold text-[#A1A1AA] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingOverride}
                onClick={handleSaveOverride}
                className="inline-flex items-center space-x-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-[#141416] hover:bg-emerald-400 transition-all disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{savingOverride ? "Saving..." : "Save Override"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2C: EXAM ANALYTICS & ITEM DIFFICULTY BREAKDOWN */}
      {/* ========================================================================= */}
      {analyticsExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6 backdrop-blur-md animate-in fade-in">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-[#2E2E34] bg-[#141416] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-[#2E2E34] px-6 py-4 bg-[#1C1C1F]/70 shrink-0">
              <div>
                <div className="flex items-center space-x-2 text-xs font-mono text-emerald-400 mb-0.5">
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span className="uppercase font-bold">Assessment Analytics &amp; Item Difficulty</span>
                </div>
                <h3 className="text-base font-extrabold text-white">
                  {analyticsExam.title} ({analyticsExam.courseCode})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAnalyticsExam(null)}
                className="rounded-xl p-1.5 text-[#A1A1AA] hover:text-white hover:bg-[#2E2E34]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingAnalytics ? (
                <div className="py-16 text-center text-[#A1A1AA] text-xs font-mono">
                  Computing cohort statistics and question difficulty...
                </div>
              ) : analyticsAttempts.length === 0 ? (
                <div className="py-16 text-center text-[#A1A1AA] bg-[#1C1C1F] rounded-2xl border border-[#2E2E34] p-6">
                  <BarChart3 className="mx-auto h-10 w-10 text-[#71717A] mb-2" />
                  <p className="text-sm font-bold text-white">No Submissions Yet</p>
                  <p className="text-xs mt-1">Analytics will populate automatically as students submit attempts.</p>
                </div>
              ) : (() => {
                const uniqueStudents = new Set(analyticsAttempts.map(a => a.studentUid || a.studentUsername)).size;
                const graded = analyticsAttempts.filter(a => typeof a.percentage === "number");
                const avgPct = graded.length > 0 ? Math.round(graded.reduce((s, a) => s + (a.percentage || 0), 0) / graded.length) : 0;
                const passCount = graded.filter(a => a.passed).length;
                const passRate = graded.length > 0 ? Math.round((passCount / graded.length) * 100) : 0;
                const avgSec = Math.round(analyticsAttempts.reduce((s, a) => s + (a.timeSpentSeconds || 0), 0) / analyticsAttempts.length);

                const itemStats = analyticsExam.questions.map((q, idx) => {
                  let answeredCount = 0;
                  let fullCreditCount = 0;
                  analyticsAttempts.forEach((att) => {
                    const qGrade = att.questionGrades?.[q.id];
                    if (qGrade) {
                      answeredCount++;
                      if (qGrade.awardedPoints >= (qGrade.maxPoints || q.points || 1)) {
                        fullCreditCount++;
                      }
                    }
                  });
                  const correctRate = answeredCount > 0 ? Math.round((fullCreditCount / answeredCount) * 100) : 0;
                  return { q, idx, answeredCount, fullCreditCount, correctRate };
                }).sort((a, b) => a.correctRate - b.correctRate);

                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-2xl border border-[#2E2E34] bg-[#1C1C1F] p-4">
                        <span className="text-[10px] font-mono uppercase text-[#A1A1AA]">Unique Students</span>
                        <div className="text-2xl font-extrabold text-white mt-1">{uniqueStudents}</div>
                        <span className="text-[10px] font-mono text-[#71717A]">{analyticsAttempts.length} total attempts</span>
                      </div>
                      <div className="rounded-2xl border border-[#2E2E34] bg-[#1C1C1F] p-4">
                        <span className="text-[10px] font-mono uppercase text-[#A1A1AA]">Average Score</span>
                        <div className="text-2xl font-extrabold text-emerald-400 mt-1">{avgPct}%</div>
                        <span className="text-[10px] font-mono text-[#71717A]">Pass threshold: {analyticsExam.passPercentage}%</span>
                      </div>
                      <div className="rounded-2xl border border-[#2E2E34] bg-[#1C1C1F] p-4">
                        <span className="text-[10px] font-mono uppercase text-[#A1A1AA]">Pass Rate</span>
                        <div className={`text-2xl font-extrabold mt-1 ${passRate >= 50 ? "text-emerald-400" : "text-rose-400"}`}>{passRate}%</div>
                        <span className="text-[10px] font-mono text-[#71717A]">{passCount} of {graded.length} passed</span>
                      </div>
                      <div className="rounded-2xl border border-[#2E2E34] bg-[#1C1C1F] p-4">
                        <span className="text-[10px] font-mono uppercase text-[#A1A1AA]">Avg Duration</span>
                        <div className="text-2xl font-extrabold text-white mt-1">{Math.floor(avgSec / 60)}m {avgSec % 60}s</div>
                        <span className="text-[10px] font-mono text-[#71717A]">Across all attempts</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-mono font-bold uppercase text-[#EAEAE6] tracking-wider">
                        Question Difficulty Breakdown (Hardest First)
                      </h4>
                      <div className="space-y-2">
                        {itemStats.map(({ q, idx, answeredCount, fullCreditCount, correctRate }) => {
                          const tier =
                            correctRate < 40 ? "Hard (Reteach)" : correctRate < 75 ? "Moderate" : "Strong";
                          const tierClass =
                            correctRate < 40
                              ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                              : correctRate < 75
                              ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                              : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
                          return (
                            <div key={q.id} className="rounded-2xl border border-[#2E2E34] bg-[#1C1C1F] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className="rounded bg-[#141416] border border-[#2E2E34] px-2 py-0.5 text-[10px] font-mono font-bold text-[#EAEAE6]">
                                    Q{idx + 1} &bull; {q.points} Pts
                                  </span>
                                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-mono font-bold ${tierClass}`}>
                                    {tier}
                                  </span>
                                </div>
                                <p className="text-xs text-white line-clamp-2">{q.prompt}</p>
                              </div>
                              <div className="shrink-0 text-right">
                                <div className="text-lg font-extrabold font-mono text-white">{correctRate}%</div>
                                <span className="text-[10px] font-mono text-[#A1A1AA]">
                                  {fullCreditCount}/{answeredCount} correct
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
