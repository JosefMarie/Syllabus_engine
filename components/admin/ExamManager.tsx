"use client";

import React, { useState, useEffect } from "react";
import { 
  Exam, 
  ExamQuestion, 
  QuestionType, 
  ExamAttempt, 
  QuestionGrade,
  ExamType
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
  getExamAttemptsForExam
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
  Bot
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeQuestionRenderer from "@/components/common/CodeQuestionRenderer";
import {
  downloadExamTemplateCSV,
  downloadExamTemplateJSON,
  downloadExamTemplatePlainText,
  copyAIPromptToClipboard,
  exportExamQuestionsToCSV,
  exportExamQuestionsToJSON,
  exportExamQuestionsToPlainText,
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
  const [formShowResultsImmediately, setFormShowResultsImmediately] = useState(true);
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
    loadAll();
    const unsub = subscribeToExams((freshExams) => {
      setExams(freshExams);
    });
    return () => unsub();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [exList, attList] = await Promise.all([
        getExams(),
        getAllExamAttempts()
      ]);
      setExams(exList);
      setAttempts(attList);
    } catch (e) {
      console.error("Error loading exams:", e);
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
    setFormAntiCheating(false);
    setFormShowResultsImmediately(true);
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
    setFormShowResultsImmediately(exam.showResultsImmediately ?? true);
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
        enableAntiCheating: formAntiCheating,
        showResultsImmediately: formShowResultsImmediately,
        questions: formQuestions,
        totalPoints,
        createdAt: editingExamId ? (exams.find(e => e.id === editingExamId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
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
    setLoadingAttempts(true);
    try {
      const atts = await getExamAttemptsForExam(exam.id);
      setExamAttempts(atts);
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

      selectedExamForSubmissions.questions.forEach((q) => {
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

      const percentage = selectedExamForSubmissions.totalPoints > 0 
        ? Math.round((totalAwarded / selectedExamForSubmissions.totalPoints) * 100) 
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#334155] pb-4 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#06B6D4]/20 text-[#06B6D4]">
              <FileQuestion className="h-4 w-4" />
            </span>
            <h3 className="text-xl font-extrabold text-white tracking-tight">
              Assessment &amp; Examination Studio
            </h3>
          </div>
          <p className="text-xs text-[#94A3B8] mt-1">
            Build interactive practice quizzes, schedule proctored exams with anti-cheating timers, and review student grades.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Template Download Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsTemplateMenuOpen(!isTemplateMenuOpen)}
              className="inline-flex items-center space-x-1.5 rounded-xl border border-[#334155] bg-[#1E293B] px-3 py-2 text-xs font-semibold text-[#CBD5E1] hover:text-white transition-all shadow hover:border-slate-500"
            >
              <Download className="h-3.5 w-3.5 text-[#06B6D4]" />
              <span>Download Template</span>
              <ChevronDown className="h-3 w-3 text-[#94A3B8]" />
            </button>

            {isTemplateMenuOpen && (
              <div 
                className="absolute right-0 mt-1 w-64 rounded-2xl border border-[#334155] bg-[#0B0F19] p-2 shadow-2xl z-30 space-y-1 animate-in fade-in"
                onMouseLeave={() => setIsTemplateMenuOpen(false)}
              >
                <div className="px-2.5 py-1 text-[10px] font-mono uppercase font-bold text-[#64748B]">
                  Question Starter Templates
                </div>

                <button
                  type="button"
                  onClick={() => {
                    downloadExamTemplatePlainText();
                    setIsTemplateMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 text-left rounded-xl hover:bg-[#1E293B] text-xs text-[#CBD5E1] hover:text-white transition-all group"
                >
                  <FileText className="h-4 w-4 text-cyan-400 shrink-0 group-hover:scale-110 transition-transform" />
                  <div>
                    <span className="font-bold block text-white flex items-center space-x-1.5">
                      <span>Plain Text Template (.txt)</span>
                      <span className="rounded bg-cyan-500/20 text-cyan-300 text-[9px] px-1.5 py-0.2">AI Friendly</span>
                    </span>
                    <span className="text-[10px] text-[#94A3B8] block">Natural text for ChatGPT / Claude / Gemini</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleCopyAIPrompt();
                    setIsTemplateMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 text-left rounded-xl hover:bg-[#1E293B] text-xs text-[#CBD5E1] hover:text-white transition-all group"
                >
                  <Sparkles className="h-4 w-4 text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
                  <div>
                    <span className="font-bold block text-white flex items-center space-x-1.5">
                      <span>Copy AI Prompt</span>
                      <span className="rounded bg-amber-500/20 text-amber-300 text-[9px] px-1.5 py-0.2">Instant</span>
                    </span>
                    <span className="text-[10px] text-[#94A3B8] block">Paste into any AI to generate full tests</span>
                  </div>
                </button>

                <div className="border-t border-[#334155]/60 my-1" />

                <button
                  type="button"
                  onClick={() => {
                    downloadExamTemplateCSV();
                    setIsTemplateMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 text-left rounded-xl hover:bg-[#1E293B] text-xs text-[#CBD5E1] hover:text-white transition-all"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold block text-white">CSV Template</span>
                    <span className="text-[10px] text-[#94A3B8] block">For Microsoft Excel &amp; Sheets</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    downloadExamTemplateJSON();
                    setIsTemplateMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 text-left rounded-xl hover:bg-[#1E293B] text-xs text-[#CBD5E1] hover:text-white transition-all"
                >
                  <FileCode className="h-4 w-4 text-purple-400 shrink-0" />
                  <div>
                    <span className="font-bold block text-white">JSON Template</span>
                    <span className="text-[10px] text-[#94A3B8] block">For Developers &amp; Data Pipeline</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleRefresh}
            title="Refresh database records"
            className="inline-flex items-center space-x-1.5 rounded-xl border border-[#334155] bg-[#1E293B] px-3 py-2 text-xs font-semibold text-[#CBD5E1] hover:text-white transition-all shadow"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleOpenNewBuilder}
            className="inline-flex items-center space-x-2 rounded-xl bg-[#06B6D4] px-4 py-2 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-md active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Create Assessment</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-4 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono font-bold text-[#94A3B8] uppercase tracking-wider block mb-0.5">
              Practice Quizzes
            </span>
            <span className="text-2xl font-extrabold text-cyan-400 font-mono">{totalQuizzes}</span>
            <span className="text-[10px] text-[#94A3B8] block mt-0.5">Interactive checks</span>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
            <HelpCircle className="h-4 w-4" />
          </div>
        </div>

        <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono font-bold text-purple-300 uppercase tracking-wider block mb-0.5">
              Official Exams
            </span>
            <span className="text-2xl font-extrabold text-purple-300 font-mono">{totalExams}</span>
            <span className="text-[10px] text-[#94A3B8] block mt-0.5">Timed & proctored</span>
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
            <span className="text-[10px] text-[#94A3B8] block mt-0.5">Needs teacher grade</span>
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
            <span className="text-[10px] text-[#94A3B8] block mt-0.5">Student submissions</span>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
            <UserCheck className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-[#1E293B] p-4 rounded-2xl border border-[#334155]">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assessments by title, topic, or course code..."
            className="w-full rounded-xl bg-[#0B0F19] border border-[#334155] pl-10 pr-4 py-2 text-xs text-white placeholder-[#94A3B8] focus:border-[#06B6D4] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Type Filter */}
          <div className="flex items-center rounded-xl bg-[#0B0F19] p-1 border border-[#334155]">
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                filterType === "all" ? "bg-[#06B6D4] text-slate-950 font-bold" : "text-[#94A3B8] hover:text-white"
              }`}
            >
              All Types
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

          {/* Course Selector */}
          <select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="rounded-xl bg-[#0B0F19] border border-[#334155] px-3 py-2 text-xs font-semibold text-[#CBD5E1] focus:border-[#06B6D4] focus:outline-none"
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
            className="rounded-xl bg-[#0B0F19] border border-[#334155] px-3 py-2 text-xs font-semibold text-[#CBD5E1] focus:border-[#06B6D4] focus:outline-none font-mono"
          >
            <option value="all">All Levels</option>
            <option value="Level 3">Level 3</option>
            <option value="Level 4">Level 4</option>
            <option value="Level 5">Level 5</option>
          </select>
        </div>
      </div>

      {/* Assessments Grid */}
      {loading ? (
        <div className="py-20 text-center text-[#94A3B8]">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#06B6D4] border-t-transparent mb-3" />
          Loading assessments and proctored exam rooms...
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="py-16 text-center text-[#94A3B8] bg-[#1E293B]/40 rounded-3xl border border-[#334155] p-8">
          <FileQuestion className="mx-auto h-12 w-12 text-[#64748B] mb-3" />
          <h4 className="text-base font-bold text-white mb-1">No Assessments Found</h4>
          <p className="text-xs text-[#94A3B8] max-w-md mx-auto mb-5">
            There are currently no quizzes or exams matching your active filters. Click the button below to build your first quiz or exam.
          </p>
          <button
            onClick={handleOpenNewBuilder}
            className="inline-flex items-center space-x-2 rounded-xl bg-[#06B6D4] px-4 py-2 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-md"
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

                      <span className="rounded-md bg-[#0B0F19] border border-[#334155] px-2 py-0.5 text-[10px] font-mono text-[#CBD5E1]">
                        {exam.courseCode}
                      </span>

                      <span className="rounded-md bg-[#0B0F19] border border-[#334155] px-2 py-0.5 text-[10px] font-mono text-emerald-400">
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

                  <h4 className="text-base font-extrabold text-white group-hover:text-[#06B6D4] transition-colors line-clamp-1 mb-1.5">
                    {exam.title}
                  </h4>

                  <p className="text-xs text-[#94A3B8] line-clamp-2 leading-relaxed mb-4">
                    {exam.description || (exam.courseTitle ? `Comprehensive assessment on ${exam.courseTitle}` : "Interactive assessment module")}
                  </p>

                  {/* Metadata Chips */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono mb-4">
                    <div className="rounded-xl bg-[#0B0F19] p-2 border border-[#334155]">
                      <span className="text-[#64748B] block text-[10px]">TIME LIMIT</span>
                      <span className="text-white font-bold flex items-center space-x-1 mt-0.5">
                        <Clock className="h-3 w-3 text-cyan-400" />
                        <span>{exam.timeLimitMinutes > 0 ? `${exam.timeLimitMinutes} Mins` : "Untimed"}</span>
                      </span>
                    </div>

                    <div className="rounded-xl bg-[#0B0F19] p-2 border border-[#334155]">
                      <span className="text-[#64748B] block text-[10px]">PASS / TOTAL</span>
                      <span className="text-emerald-400 font-bold flex items-center space-x-1 mt-0.5">
                        <Award className="h-3 w-3 text-emerald-400" />
                        <span>{exam.passPercentage}% &bull; {exam.totalPoints} Pts</span>
                      </span>
                    </div>
                  </div>

                  {/* Anti-cheating & Features tags */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-4">
                    <span className="rounded-md bg-slate-800/80 px-2 py-0.5 text-[10px] font-mono text-[#94A3B8]">
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
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-3 border-t border-[#334155] flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenSubmissions(exam)}
                    className="inline-flex items-center space-x-1.5 rounded-xl bg-[#06B6D4]/15 border border-[#06B6D4]/30 px-3 py-1.5 text-xs font-bold text-[#06B6D4] hover:bg-[#06B6D4] hover:text-slate-950 transition-all shadow-sm"
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>Attempts ({examAttemptsCount})</span>
                    {needsReviewCount > 0 && (
                      <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.2 text-[9px] font-extrabold text-slate-950">
                        {needsReviewCount}
                      </span>
                    )}
                  </button>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleEditExam(exam)}
                      title="Edit assessment questions & settings"
                      className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-slate-800 transition-colors"
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
          <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-[#334155] bg-[#0F172A] shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#334155] px-6 py-4 bg-[#1E293B]/70 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#06B6D4]/20 text-[#06B6D4]">
                  <FileQuestion className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    {editingExamId ? "Edit Assessment" : "Build Assessment Studio"}
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    Configure questions, anti-cheating timers, and grading rules.
                  </p>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center space-x-2">
                <div className="flex items-center rounded-xl bg-[#0B0F19] p-1 border border-[#334155]">
                  <button
                    onClick={() => setBuilderTab("settings")}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      builderTab === "settings" ? "bg-[#06B6D4] text-slate-950" : "text-[#94A3B8] hover:text-white"
                    }`}
                  >
                    <Sliders className="h-3.5 w-3.5" />
                    <span>Settings</span>
                  </button>

                  <button
                    onClick={() => setBuilderTab("questions")}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      builderTab === "questions" ? "bg-[#06B6D4] text-slate-950" : "text-[#94A3B8] hover:text-white"
                    }`}
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    <span>Questions ({formQuestions.length})</span>
                  </button>
                </div>

                <button
                  onClick={() => setIsBuilderOpen(false)}
                  className="rounded-xl p-1.5 text-[#94A3B8] hover:text-white hover:bg-slate-800"
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
                  <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-4 space-y-3">
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
                            ? "border-[#06B6D4] bg-[#06B6D4]/10 text-white shadow-md"
                            : "border-[#334155] bg-[#0B0F19] text-[#94A3B8] hover:border-slate-500"
                        }`}
                      >
                        <div className="flex items-center space-x-2 font-bold text-sm text-cyan-400 mb-1">
                          <HelpCircle className="h-4 w-4" />
                          <span>Practice Quiz</span>
                        </div>
                        <p className="text-[11px] text-[#94A3B8] leading-relaxed">
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
                            : "border-[#334155] bg-[#0B0F19] text-[#94A3B8] hover:border-slate-500"
                        }`}
                      >
                        <div className="flex items-center space-x-2 font-bold text-sm text-purple-400 mb-1">
                          <Award className="h-4 w-4" />
                          <span>Formal Exam</span>
                        </div>
                        <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                          Strict proctored test with countdown timer, single attempt, and anti-cheating violation tracking.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Basic Details */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                        Assessment Title <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="e.g. Midterm Examination: Data Structures & Algorithms"
                        className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                        Description / Instructions for Students
                      </label>
                      <textarea
                        rows={2}
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        placeholder="Brief overview of the syllabus modules covered in this test..."
                        className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                          Course / Module <span className="text-rose-400">*</span>
                        </label>
                        <select
                          value={formCourseCode}
                          onChange={(e) => setFormCourseCode(e.target.value)}
                          className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-2.5 text-xs font-semibold text-white focus:border-[#06B6D4] focus:outline-none"
                        >
                          {syllabi.map((s) => (
                            <option key={s.id} value={s.courseCode}>{s.courseCode} - {s.title}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                          Target Academic Level
                        </label>
                        <select
                          value={formLevel}
                          onChange={(e) => setFormLevel(e.target.value as any)}
                          className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-2.5 text-xs font-semibold text-white focus:border-[#06B6D4] focus:outline-none font-mono"
                        >
                          <option value="all">All Levels</option>
                          <option value="Level 3">Level 3</option>
                          <option value="Level 4">Level 4</option>
                          <option value="Level 5">Level 5</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                          Target Trade
                        </label>
                        <select
                          value={formTradeId}
                          onChange={(e) => setFormTradeId(e.target.value)}
                          className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-2.5 text-xs font-semibold text-white focus:border-[#06B6D4] focus:outline-none"
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
                  <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-4 space-y-4">
                    <span className="block text-xs font-bold text-white uppercase tracking-wider font-mono">
                      Rules &amp; Proctoring Settings
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[#94A3B8] mb-1">
                          Time Limit (Minutes)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={300}
                          value={formTimeLimit}
                          onChange={(e) => setFormTimeLimit(Number(e.target.value))}
                          placeholder="0 = Untimed"
                          className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] px-3 py-2 text-xs font-mono text-white focus:border-[#06B6D4] focus:outline-none"
                        />
                        <span className="text-[10px] text-[#64748B] mt-0.5 block">0 = Untimed practice</span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#94A3B8] mb-1">
                          Passing Grade (%)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={formPassPercentage}
                          onChange={(e) => setFormPassPercentage(Number(e.target.value))}
                          className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] px-3 py-2 text-xs font-mono text-emerald-400 font-bold focus:border-[#06B6D4] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#94A3B8] mb-1">
                          Allowed Attempts
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={formMaxAttempts}
                          onChange={(e) => setFormMaxAttempts(Number(e.target.value))}
                          className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] px-3 py-2 text-xs font-mono text-white focus:border-[#06B6D4] focus:outline-none"
                        />
                        <span className="text-[10px] text-[#64748B] mt-0.5 block">0 = Unlimited</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#334155]">
                      <label className="flex items-center space-x-2.5 text-xs text-[#CBD5E1] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formAntiCheating}
                          onChange={(e) => setFormAntiCheating(e.target.checked)}
                          className="rounded border-[#334155] text-[#06B6D4] focus:ring-0"
                        />
                        <span>Enforce Anti-Cheating &amp; Tab-Switch Tracking</span>
                      </label>

                      <label className="flex items-center space-x-2.5 text-xs text-[#CBD5E1] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formShuffleQuestions}
                          onChange={(e) => setFormShuffleQuestions(e.target.checked)}
                          className="rounded border-[#334155] text-[#06B6D4] focus:ring-0"
                        />
                        <span>Shuffle Question Order for Each Student</span>
                      </label>

                      <label className="flex items-center space-x-2.5 text-xs text-[#CBD5E1] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formShowResultsImmediately}
                          onChange={(e) => setFormShowResultsImmediately(e.target.checked)}
                          className="rounded border-[#334155] text-[#06B6D4] focus:ring-0"
                        />
                        <span>Reveal Score &amp; Explanations Upon Submission</span>
                      </label>
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
                        <span className="text-xs font-bold font-mono text-[#94A3B8] uppercase tracking-wider block">
                          Assessment Questions ({formQuestions.length}) &bull; Total Points:{" "}
                          <span className="text-[#06B6D4] font-bold">
                            {formQuestions.reduce((s, q) => s + (Number(q.points) || 0), 0)} Pts
                          </span>
                        </span>
                        <span className="text-[11px] text-[#64748B]">
                          Supports Single Choice, Multi-Select Checkboxes, True/False, Short Answer & Essays.
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Import Button */}
                        <button
                          type="button"
                          onClick={() => setIsImportModalOpen(true)}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-950 bg-[#06B6D4] hover:bg-[#0891B2] hover:text-white transition-all shadow-md active:scale-95"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          <span>Import Questions</span>
                        </button>

                        {/* Download Template Dropdown */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setIsBuilderTemplateMenuOpen(!isBuilderTemplateMenuOpen)}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#CBD5E1] bg-[#0B0F19] border border-[#334155] hover:text-white hover:border-slate-500 transition-all"
                          >
                            <Download className="h-3.5 w-3.5 text-cyan-400" />
                            <span>Template</span>
                            <ChevronDown className="h-3 w-3 text-[#94A3B8]" />
                          </button>

                          {isBuilderTemplateMenuOpen && (
                            <div 
                              className="absolute right-0 mt-1 w-64 rounded-2xl border border-[#334155] bg-[#0B0F19] p-2 shadow-2xl z-30 space-y-1 animate-in fade-in"
                              onMouseLeave={() => setIsBuilderTemplateMenuOpen(false)}
                            >
                              <div className="px-2.5 py-1 text-[10px] font-mono uppercase font-bold text-[#64748B]">
                                Question Starter Templates
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  downloadExamTemplatePlainText();
                                  setIsBuilderTemplateMenuOpen(false);
                                }}
                                className="w-full flex items-center space-x-2.5 px-3 py-2 text-left rounded-xl hover:bg-[#1E293B] text-xs text-[#CBD5E1] hover:text-white transition-all group"
                              >
                                <FileText className="h-4 w-4 text-cyan-400 shrink-0 group-hover:scale-110 transition-transform" />
                                <div>
                                  <span className="font-bold block text-white flex items-center space-x-1.5">
                                    <span>Plain Text Template (.txt)</span>
                                    <span className="rounded bg-cyan-500/20 text-cyan-300 text-[9px] px-1.5 py-0.2">AI Friendly</span>
                                  </span>
                                  <span className="text-[10px] text-[#94A3B8] block">Natural text for ChatGPT / Claude / Gemini</span>
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  handleCopyAIPrompt();
                                  setIsBuilderTemplateMenuOpen(false);
                                }}
                                className="w-full flex items-center space-x-2.5 px-3 py-2 text-left rounded-xl hover:bg-[#1E293B] text-xs text-[#CBD5E1] hover:text-white transition-all group"
                              >
                                <Sparkles className="h-4 w-4 text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
                                <div>
                                  <span className="font-bold block text-white flex items-center space-x-1.5">
                                    <span>Copy AI Prompt</span>
                                    <span className="rounded bg-amber-500/20 text-amber-300 text-[9px] px-1.5 py-0.2">Instant</span>
                                  </span>
                                  <span className="text-[10px] text-[#94A3B8] block">Paste into any AI to generate questions</span>
                                </div>
                              </button>

                              <div className="border-t border-[#334155]/60 my-1" />

                              <button
                                type="button"
                                onClick={() => {
                                  downloadExamTemplateCSV();
                                  setIsBuilderTemplateMenuOpen(false);
                                }}
                                className="w-full flex items-center space-x-2.5 px-3 py-2 text-left rounded-xl hover:bg-[#1E293B] text-xs text-[#CBD5E1] hover:text-white transition-all"
                              >
                                <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0" />
                                <div>
                                  <span className="font-bold block text-white">CSV Template</span>
                                  <span className="text-[10px] text-[#94A3B8] block">Excel &amp; Google Sheets</span>
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  downloadExamTemplateJSON();
                                  setIsBuilderTemplateMenuOpen(false);
                                }}
                                className="w-full flex items-center space-x-2.5 px-3 py-2 text-left rounded-xl hover:bg-[#1E293B] text-xs text-[#CBD5E1] hover:text-white transition-all"
                              >
                                <FileCode className="h-4 w-4 text-purple-400 shrink-0" />
                                <div>
                                  <span className="font-bold block text-white">JSON Template</span>
                                  <span className="text-[10px] text-[#94A3B8] block">Formatted Array Object</span>
                                </div>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Export Existing Questions (if any) */}
                        {formQuestions.length > 0 && (
                          <div className="flex items-center space-x-1 border-l border-[#334155] pl-2">
                            <button
                              type="button"
                              title="Export questions as plain text"
                              onClick={() => exportExamQuestionsToPlainText(formQuestions, formTitle || "exam")}
                              className="px-2 py-1 rounded-lg text-cyan-300 hover:text-white hover:bg-slate-800 text-[11px] font-mono border border-cyan-500/30"
                            >
                              TXT
                            </button>
                            <button
                              type="button"
                              title="Export questions to CSV"
                              onClick={() => exportExamQuestionsToCSV(formQuestions, formTitle || "exam")}
                              className="px-2 py-1 rounded-lg text-[#94A3B8] hover:text-white hover:bg-slate-800 text-[11px] font-mono border border-[#334155]"
                            >
                              CSV
                            </button>
                            <button
                              type="button"
                              title="Export questions to JSON"
                              onClick={() => exportExamQuestionsToJSON(formQuestions, formTitle || "exam")}
                              className="px-2 py-1 rounded-lg text-[#94A3B8] hover:text-white hover:bg-slate-800 text-[11px] font-mono border border-[#334155]"
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
                      <div className="rounded-2xl border border-dashed border-[#334155] bg-[#1E293B]/40 p-6 text-center text-xs text-[#94A3B8]">
                        No questions added yet. Use the question editor below to create multiple choice, true/false, or coding questions.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {formQuestions.map((q, idx) => (
                          <div
                            key={q.id}
                            className={`flex items-start justify-between rounded-2xl border p-4 transition-all ${
                              editingQuestionIdx === idx
                                ? "border-[#06B6D4] bg-[#06B6D4]/10 shadow-lg"
                                : "border-[#334155] bg-[#1E293B]"
                            }`}
                          >
                            <div className="flex items-start space-x-3">
                              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0B0F19] font-mono text-xs font-bold text-[#06B6D4] border border-[#334155] shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <div>
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className="rounded bg-[#0B0F19] border border-[#334155] px-1.5 py-0.2 text-[10px] font-mono uppercase text-cyan-300 font-bold">
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
                                className="p-1 rounded text-[#94A3B8] hover:text-white hover:bg-slate-800"
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
                  <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-[#334155] pb-3">
                      <span className="text-xs font-bold text-white uppercase font-mono flex items-center space-x-1.5">
                        <Plus className="h-4 w-4 text-[#06B6D4]" />
                        <span>{editingQuestionIdx !== null ? `Edit Question #${editingQuestionIdx + 1}` : "Add New Question"}</span>
                      </span>

                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-1.5">
                          <label className="text-[11px] font-mono text-[#94A3B8]">Points:</label>
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={qPoints}
                            onChange={(e) => setQPoints(Number(e.target.value))}
                            className="w-16 rounded-lg border border-[#334155] bg-[#0B0F19] px-2 py-1 text-xs font-mono text-emerald-400 font-bold focus:border-[#06B6D4] focus:outline-none"
                          />
                        </div>

                        <select
                          value={qType}
                          onChange={(e) => setQType(e.target.value as QuestionType)}
                          className="rounded-lg border border-[#334155] bg-[#0B0F19] px-2.5 py-1 text-xs font-semibold text-cyan-300 focus:border-[#06B6D4] focus:outline-none"
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
                      <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                        Question Prompt (Markdown &amp; Code Syntax Supported)
                      </label>
                      <textarea
                        rows={3}
                        value={qPrompt}
                        onChange={(e) => setQPrompt(e.target.value)}
                        placeholder="Write your question here... (e.g. 'What is the time complexity of binary search?' or paste code snippet)"
                        className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none font-mono"
                      />
                    </div>

                    {/* Options / Answer Input Based on Question Type */}
                    {qType === "multiple_choice" && (
                      <div className="space-y-2">
                        <label className="block text-[11px] font-bold text-[#94A3B8]">
                          Answer Choices (Select radio button for the CORRECT option)
                        </label>
                        {qOptions.map((opt, idx) => (
                          <div key={idx} className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name="mc_correct"
                              checked={qCorrectSingle === String(idx)}
                              onChange={() => setQCorrectSingle(String(idx))}
                              className="text-[#06B6D4] focus:ring-0 cursor-pointer"
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
                              className="flex-1 rounded-xl border border-[#334155] bg-[#0B0F19] px-3 py-1.5 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
                            />
                            {qOptions.length > 2 && (
                              <button
                                type="button"
                                onClick={() => setQOptions(prev => prev.filter((_, i) => i !== idx))}
                                className="p-1 text-[#64748B] hover:text-rose-400"
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
                            className="text-xs text-[#06B6D4] hover:underline font-mono"
                          >
                            + Add Another Option
                          </button>
                        )}
                      </div>
                    )}

                    {qType === "multiple_select" && (
                      <div className="space-y-2">
                        <label className="block text-[11px] font-bold text-[#94A3B8]">
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
                                className="rounded text-[#06B6D4] focus:ring-0 cursor-pointer"
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
                                className="flex-1 rounded-xl border border-[#334155] bg-[#0B0F19] px-3 py-1.5 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
                              />
                              {qOptions.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => setQOptions(prev => prev.filter((_, i) => i !== idx))}
                                  className="p-1 text-[#64748B] hover:text-rose-400"
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
                            className="text-xs text-[#06B6D4] hover:underline font-mono"
                          >
                            + Add Another Choice
                          </button>
                        )}
                      </div>
                    )}

                    {qType === "true_false" && (
                      <div className="space-y-2">
                        <label className="block text-[11px] font-bold text-[#94A3B8]">
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
                        <label className="block text-[11px] font-bold text-[#94A3B8] mb-1">
                          Exact Target Answer (Case-insensitive auto-match)
                        </label>
                        <input
                          type="text"
                          value={qCorrectText}
                          onChange={(e) => setQCorrectText(e.target.value)}
                          placeholder="e.g. O(log n) or polymorphism"
                          className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] px-3.5 py-2 text-xs font-mono text-emerald-400 font-bold focus:border-[#06B6D4] focus:outline-none"
                        />
                      </div>
                    )}

                    {qType === "essay" && (
                      <div className="rounded-xl bg-[#0B0F19] p-3 text-xs text-[#94A3B8] border border-[#334155]">
                        <p>
                          💡 <strong>Open-ended Question:</strong> Student answers will be saved and presented in the Teacher Grading Desk for manual scoring and custom feedback.
                        </p>
                      </div>
                    )}

                    {/* Code Completion Editor */}
                    {qType === "code_completion" && (
                      <div className="space-y-3 rounded-2xl bg-[#0B0F19] p-4 border border-[#334155]">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-cyan-400 font-mono flex items-center space-x-1.5">
                            <Code className="h-4 w-4" />
                            <span>Code Snippet with Interactive Blanks</span>
                          </label>

                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-mono text-[#94A3B8]">Language:</span>
                            <select
                              value={qCodeLanguage}
                              onChange={(e) => setQCodeLanguage(e.target.value)}
                              className="rounded-lg border border-[#334155] bg-[#1E293B] px-2 py-0.5 text-xs font-mono text-cyan-300 focus:border-cyan-400 focus:outline-none"
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

                        <p className="text-[11px] text-[#94A3B8]">
                          Mark missing tokens with <code className="text-cyan-300 font-mono bg-slate-800 px-1 py-0.5 rounded">___1___</code>, <code className="text-cyan-300 font-mono bg-slate-800 px-1 py-0.5 rounded">___2___</code> or <code className="text-cyan-300 font-mono bg-slate-800 px-1 py-0.5 rounded">{"{{1}}"}</code> where students need to type.
                        </p>

                        <textarea
                          rows={6}
                          value={qCodeSnippet}
                          onChange={(e) => setQCodeSnippet(e.target.value)}
                          placeholder={`def factorial(n):\n    if n <= 1:\n        return ___1___\n    return n * factorial(___2___)`}
                          className="w-full rounded-xl border border-[#334155] bg-[#020617] p-3 text-xs font-mono text-cyan-200 placeholder-slate-600 focus:border-cyan-400 focus:outline-none leading-relaxed"
                        />

                        <div>
                          <label className="block text-[11px] font-bold text-[#CBD5E1] mb-1">
                            Accepted Answers for Blanks (One blank per line, aliases separated by <code className="text-cyan-400">|</code> or commas):
                          </label>
                          <textarea
                            rows={3}
                            value={qCodeBlanksText}
                            onChange={(e) => setQCodeBlanksText(e.target.value)}
                            placeholder={`Blank 1: 1\nBlank 2: n - 1`}
                            className="w-full rounded-xl border border-[#334155] bg-[#020617] p-2.5 text-xs font-mono text-emerald-400 placeholder-slate-600 focus:border-cyan-400 focus:outline-none"
                          />
                        </div>

                        {qCodeSnippet && (
                          <div className="pt-2">
                            <span className="block text-[10px] font-mono uppercase text-[#94A3B8] mb-1.5 font-bold">
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
                      <div className="space-y-3 rounded-2xl bg-[#0B0F19] p-4 border border-[#334155]">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-cyan-400 font-mono flex items-center space-x-1.5">
                            <Shuffle className="h-4 w-4" />
                            <span>Code Lines (In Correct Sequential Order)</span>
                          </label>

                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-mono text-[#94A3B8]">Language:</span>
                            <select
                              value={qCodeLanguage}
                              onChange={(e) => setQCodeLanguage(e.target.value)}
                              className="rounded-lg border border-[#334155] bg-[#1E293B] px-2 py-0.5 text-xs font-mono text-cyan-300 focus:border-cyan-400 focus:outline-none"
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

                        <p className="text-[11px] text-[#94A3B8]">
                          Enter the full program lines here in their <strong>correct working sequence</strong>. During the student examination, lines are automatically shuffled into interactive draggable/touch-sortable blocks (Parson&apos;s puzzle).
                        </p>

                        <textarea
                          rows={6}
                          value={qCodeLinesText}
                          onChange={(e) => setQCodeLinesText(e.target.value)}
                          placeholder={`def find_max(arr):\n    max_val = arr[0]\n    for num in arr:\n        if num > max_val:\n            max_val = num\n    return max_val`}
                          className="w-full rounded-xl border border-[#334155] bg-[#020617] p-3 text-xs font-mono text-cyan-200 placeholder-slate-600 focus:border-cyan-400 focus:outline-none leading-relaxed"
                        />

                        {qCodeLinesText && (
                          <div className="pt-2">
                            <span className="block text-[10px] font-mono uppercase text-[#94A3B8] mb-1.5 font-bold">
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
                      <div className="space-y-3 rounded-2xl bg-[#0B0F19] p-4 border border-[#334155]">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-cyan-400 font-mono flex items-center space-x-1.5">
                            <Code className="h-4 w-4" />
                            <span>Source Code for Analysis</span>
                          </label>

                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-mono text-[#94A3B8]">Language:</span>
                            <select
                              value={qCodeLanguage}
                              onChange={(e) => setQCodeLanguage(e.target.value)}
                              className="rounded-lg border border-[#334155] bg-[#1E293B] px-2 py-0.5 text-xs font-mono text-cyan-300 focus:border-cyan-400 focus:outline-none"
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
                          className="w-full rounded-xl border border-[#334155] bg-[#020617] p-3 text-xs font-mono text-cyan-200 placeholder-slate-600 focus:border-cyan-400 focus:outline-none leading-relaxed"
                        />

                        <div>
                          <label className="block text-[11px] font-bold text-[#CBD5E1] mb-1">
                            Exact Expected Standard Terminal Output (stdout):
                          </label>
                          <input
                            type="text"
                            value={qCorrectText}
                            onChange={(e) => setQCorrectText(e.target.value)}
                            placeholder="e.g. [4, 8] or Hello, World!"
                            className="w-full rounded-xl border border-[#334155] bg-[#020617] px-3.5 py-2 text-xs font-mono text-emerald-400 font-bold focus:border-cyan-400 focus:outline-none"
                          />
                        </div>

                        {qCodeSnippet && (
                          <div className="pt-2">
                            <span className="block text-[10px] font-mono uppercase text-[#94A3B8] mb-1.5 font-bold">
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
                      <label className="block text-[11px] font-bold text-[#94A3B8] mb-1">
                        Explanation (Shown to students during post-exam review)
                      </label>
                      <input
                        type="text"
                        value={qExplanation}
                        onChange={(e) => setQExplanation(e.target.value)}
                        placeholder="e.g. Binary search halves the search space each step, resulting in O(log n) logarithmic complexity."
                        className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] px-3 py-2 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
                      />
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={handleSaveQuestion}
                        className="inline-flex items-center space-x-1.5 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-all shadow-md"
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
            <div className="flex items-center justify-between border-t border-[#334155] px-6 py-4 bg-[#1E293B]/70 shrink-0">
              <span className="text-xs font-mono text-[#94A3B8]">
                {formQuestions.length} Questions &bull; Total Points:{" "}
                <strong className="text-emerald-400">
                  {formQuestions.reduce((s, q) => s + (Number(q.points) || 0), 0)}
                </strong>
              </span>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsBuilderOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-white bg-[#0B0F19] border border-[#334155]"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={savingExam}
                  onClick={() => handleSaveExam("draft")}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 border border-[#334155] transition-all"
                >
                  Save as Draft
                </button>

                <button
                  type="button"
                  disabled={savingExam}
                  onClick={() => handleSaveExam("published")}
                  className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-[#06B6D4] hover:bg-[#0891B2] hover:text-white transition-all shadow-lg disabled:opacity-50"
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
          <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-[#334155] bg-[#0F172A] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-[#334155] px-6 py-4 bg-[#1E293B]/70 shrink-0">
              <div>
                <div className="flex items-center space-x-2 text-xs font-mono text-[#06B6D4] mb-0.5">
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
                className="rounded-xl p-1.5 text-[#94A3B8] hover:text-white hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingAttempts ? (
                <div className="py-20 text-center text-[#94A3B8]">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#06B6D4] border-t-transparent mb-3" />
                  Loading student attempts and proctoring logs...
                </div>
              ) : examAttempts.length === 0 ? (
                <div className="py-16 text-center text-[#94A3B8] bg-[#1E293B]/40 rounded-2xl border border-[#334155] p-6">
                  <Users className="mx-auto h-10 w-10 text-[#64748B] mb-2" />
                  <p className="text-sm font-bold text-white mb-1">No Student Attempts Yet</p>
                  <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
                    Students enrolled in {selectedExamForSubmissions.courseCode} ({selectedExamForSubmissions.level}) will appear here when they start or submit this assessment.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-[#334155] bg-[#1E293B] overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[750px]">
                      <thead className="border-b border-[#334155] bg-[#0B0F19]/60 font-mono text-[#94A3B8] uppercase">
                        <tr>
                          <th className="px-5 py-3">Student</th>
                          <th className="px-5 py-3">Level</th>
                          <th className="px-5 py-3">Duration / Submitted</th>
                          <th className="px-5 py-3">Proctoring Flags</th>
                          <th className="px-5 py-3">Score &amp; Status</th>
                          <th className="px-5 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#334155]/60 text-[#CBD5E1]">
                        {examAttempts.map((att) => {
                          const isGraded = att.status === "graded";
                          const hasViolations = att.tabSwitchCount > 0;

                          return (
                            <tr key={att.id} className="hover:bg-[#0B0F19]/40 transition-colors">
                              <td className="px-5 py-3.5">
                                <div className="font-bold text-white">{att.studentName}</div>
                                <span className="text-[10px] font-mono text-[#64748B]">@{att.studentUsername}</span>
                              </td>

                              <td className="px-5 py-3.5 font-mono text-[11px] text-[#94A3B8]">
                                {att.studentLevel}
                              </td>

                              <td className="px-5 py-3.5">
                                <div className="font-mono text-xs text-white">
                                  {Math.floor(att.timeSpentSeconds / 60)}m {att.timeSpentSeconds % 60}s
                                </div>
                                <span className="text-[10px] font-mono text-[#64748B]">
                                  {att.submittedAt ? new Date(att.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "In Progress"}
                                </span>
                              </td>

                              {/* Proctoring Tab Switches */}
                              <td className="px-5 py-3.5">
                                {hasViolations ? (
                                  <span className="inline-flex items-center space-x-1 rounded-md bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[11px] font-mono font-bold text-rose-300">
                                    <ShieldAlert className="h-3 w-3" />
                                    <span>{att.tabSwitchCount} Tab Switches</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center space-x-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-mono text-emerald-400">
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>Clean Attempt</span>
                                  </span>
                                )}
                              </td>

                              <td className="px-5 py-3.5">
                                {isGraded ? (
                                  <div className="flex flex-col">
                                    <span className={`inline-flex items-center space-x-1 font-mono font-bold text-xs ${
                                      att.passed ? "text-emerald-400" : "text-rose-400"
                                    }`}>
                                      <span>{att.score} / {att.maxScore}</span>
                                      <span>({att.percentage}%)</span>
                                    </span>
                                    <span className={`text-[10px] font-mono uppercase font-bold mt-0.5 ${
                                      att.passed ? "text-emerald-500" : "text-rose-500"
                                    }`}>
                                      {att.passed ? "Passed" : "Failed"}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center space-x-1 rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[11px] font-mono font-bold text-amber-400">
                                    <Clock className="h-3 w-3" />
                                    <span>Review Required</span>
                                  </span>
                                )}
                              </td>

                              <td className="px-5 py-3.5 text-right">
                                <button
                                  onClick={() => handleOpenGradingModal(att)}
                                  className="inline-flex items-center space-x-1 rounded-lg bg-[#06B6D4]/15 px-2.5 py-1 text-xs font-bold text-[#06B6D4] hover:bg-[#06B6D4] hover:text-slate-950 transition-all border border-[#06B6D4]/30"
                                >
                                  <Award className="h-3.5 w-3.5" />
                                  <span>{isGraded ? "Edit Grade" : "Grade & Review"}</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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
          <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-[#334155] bg-[#0F172A] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-[#334155] px-6 py-4 bg-[#1E293B]/70 shrink-0">
              <div>
                <h3 className="text-base font-extrabold text-white">
                  Grading Attempt: {gradingAttempt.studentName}
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  {selectedExamForSubmissions.title} &bull; {selectedExamForSubmissions.courseCode} &bull; Time: {Math.floor(gradingAttempt.timeSpentSeconds / 60)}m {gradingAttempt.timeSpentSeconds % 60}s
                </p>
              </div>

              <button
                onClick={() => setGradingAttempt(null)}
                className="rounded-xl p-1.5 text-[#94A3B8] hover:text-white hover:bg-slate-800"
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
                      className="rounded-2xl border border-[#334155] bg-[#1E293B] p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-[#334155]/60 pb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold text-[#06B6D4]">#{idx + 1}</span>
                          <span className="rounded bg-[#0B0F19] px-2 py-0.5 text-[10px] font-mono uppercase text-[#94A3B8]">
                            {q.type.replace("_", " ")}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="text-[11px] font-mono text-[#94A3B8]">Awarded:</span>
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
                            className="w-16 rounded-lg border border-[#334155] bg-[#0B0F19] px-2 py-1 text-xs font-mono font-bold text-emerald-400 focus:border-[#06B6D4] focus:outline-none"
                          />
                          <span className="text-xs font-mono text-[#94A3B8]">/ {q.points} Pts</span>
                        </div>
                      </div>

                      {/* Question Prompt */}
                      <p className="text-xs text-white font-medium">{q.prompt}</p>

                      {/* Student's Given Answer */}
                      <div className="rounded-xl bg-[#0B0F19] p-3 text-xs border border-[#334155]">
                        <span className="text-[10px] font-mono text-[#06B6D4] uppercase block mb-1">
                          Student's Answer:
                        </span>
                        <div className="font-mono text-white whitespace-pre-wrap">
                          {studentAnswer !== undefined && studentAnswer !== null
                            ? (Array.isArray(studentAnswer) ? studentAnswer.join(", ") : String(studentAnswer))
                            : <span className="text-[#64748B] italic">No answer provided</span>
                          }
                        </div>
                      </div>

                      {/* Expected Answer (if available) */}
                      {q.correctAnswer !== undefined && (
                        <div className="text-[11px] font-mono text-[#94A3B8]">
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
                          className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] px-3 py-1.5 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
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
                  className="w-full rounded-2xl border border-[#334155] bg-[#0B0F19] p-3 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[#334155] px-6 py-4 bg-[#1E293B]/70 shrink-0">
              <button
                type="button"
                onClick={() => setGradingAttempt(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-white bg-[#0B0F19] border border-[#334155]"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={savingGrade}
                onClick={handleSaveAttemptGrade}
                className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-500 hover:text-white transition-all shadow-lg"
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
          <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-[#334155] bg-[#0F172A] shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#334155] px-6 py-4 bg-[#1E293B]/70 shrink-0">
              <div className="flex items-center space-x-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#06B6D4]/20 text-[#06B6D4]">
                  <Upload className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Bulk Import Questions
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
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
                className="rounded-xl p-1.5 text-[#94A3B8] hover:text-white hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* AI Prompt & Templates Banner */}
              <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/30 to-[#1E293B] p-4.5 space-y-3 shadow-lg">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center space-x-1.5">
                      <Sparkles className="h-4 w-4 text-cyan-400" />
                      <span>AI Exam Generator &amp; Starter Templates</span>
                    </span>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">
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
                          ? "bg-emerald-400 text-slate-950 shadow-emerald-500/20"
                          : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                      }`}
                    >
                      {copiedAIPrompt ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-slate-950 font-bold" />
                          <span>Copied to Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy AI Prompt</span>
                        </>
                      )}
                    </button>

                    {/* Download Plain Text */}
                    <button
                      type="button"
                      onClick={downloadExamTemplatePlainText}
                      className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all shadow"
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
                <div className="rounded-xl bg-[#0B0F19] p-3 text-[11px] font-mono border border-[#334155] flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="space-y-0.5 text-[#CBD5E1]">
                    <div className="text-white font-bold flex items-center space-x-1.5">
                      <Bot className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Natural AI / Plain Text Format Example:</span>
                    </div>
                    <div className="text-[#94A3B8]">
                      1. What is the function of a router? &bull; A) Forwards network packets &bull; B) Cools the computer &bull; Answer: A &bull; Points: 2
                    </div>
                  </div>
                  <span className="text-[10px] text-cyan-300 font-bold bg-cyan-950/70 border border-cyan-500/30 px-2 py-1 rounded-lg shrink-0">
                    Works automatically with any AI output!
                  </span>
                </div>
              </div>

              {/* Format Filter Selection */}
              <div className="flex items-center space-x-2 text-xs">
                <span className="font-mono text-[11px] text-[#94A3B8] font-bold uppercase">Format Mode:</span>
                <div className="flex items-center space-x-1 bg-[#1E293B] p-1 rounded-xl border border-[#334155]">
                  <button
                    type="button"
                    onClick={() => {
                      setImportFormatSelection("auto");
                      runParseContent(importInputText, importFileName || undefined, "auto");
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                      importFormatSelection === "auto"
                        ? "bg-[#06B6D4] text-slate-950 shadow"
                        : "text-[#94A3B8] hover:text-white"
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
                        ? "bg-[#06B6D4] text-slate-950 shadow"
                        : "text-[#94A3B8] hover:text-white"
                    }`}
                  >
                    Plain Text / AI
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImportFormatSelection("csv");
                      runParseContent(importInputText, importFileName || undefined, "csv");
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                      importFormatSelection === "csv"
                        ? "bg-[#06B6D4] text-slate-950 shadow"
                        : "text-[#94A3B8] hover:text-white"
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
                        ? "bg-[#06B6D4] text-slate-950 shadow"
                        : "text-[#94A3B8] hover:text-white"
                    }`}
                  >
                    JSON
                  </button>
                </div>
              </div>

              {/* Upload or Paste Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Method 1: File Upload */}
                <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-4 flex flex-col justify-between">
                  <div>
                    <label className="block text-xs font-bold text-white mb-1">
                      Option A: Upload File (.txt, .csv, .json)
                    </label>
                    <p className="text-[11px] text-[#94A3B8] mb-3">
                      Drop an AI output text file or saved spreadsheet.
                    </p>
                  </div>

                  <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#334155] bg-[#0B0F19] p-6 cursor-pointer hover:border-[#06B6D4] transition-all group text-center">
                    <Upload className="h-7 w-7 text-[#94A3B8] group-hover:text-[#06B6D4] transition-all mb-2" />
                    <span className="text-xs font-bold text-white group-hover:text-[#06B6D4]">
                      {importFileName ? importFileName : "Click to Browse or Drag File Here"}
                    </span>
                    <span className="text-[10px] text-[#64748B] mt-1">
                      Supports .txt (AI output), .csv (Excel / Sheets), and .json
                    </span>
                    <input
                      type="file"
                      accept=".txt,.csv,.json,text/plain,text/csv,application/json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Method 2: Paste Raw Content */}
                <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-4 flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-white">
                      Option B: Paste Content Directly
                    </label>
                    {importInputText && (
                      <button
                        type="button"
                        onClick={() => handleTextareaChange("")}
                        className="text-[10px] text-rose-400 hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-[#94A3B8] mb-2">
                    Paste text copied straight from ChatGPT, Gemini, Claude, or Excel.
                  </p>

                  <textarea
                    rows={6}
                    value={importInputText}
                    onChange={(e) => handleTextareaChange(e.target.value)}
                    placeholder="1. What is the function of a router?&#10;A) Forwards network packets across IP networks&#10;B) Cools the computer chassis&#10;Answer: A&#10;Points: 2&#10;Explanation: Routers connect networks and route IP traffic.&#10;&#10;2. True or False: Python is compiled directly to machine code.&#10;Answer: False&#10;Points: 1"
                    className="flex-1 w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-xs font-mono text-[#CBD5E1] placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none resize-none"
                  />
                </div>
              </div>

              {/* Import Mode: Append vs Replace */}
              <div className="flex items-center justify-between rounded-2xl border border-[#334155] bg-[#1E293B] p-4">
                <div>
                  <span className="text-xs font-bold text-white block">Import Action</span>
                  <span className="text-[11px] text-[#94A3B8]">
                    Choose how imported questions are merged with this assessment.
                  </span>
                </div>

                <div className="flex items-center space-x-2 bg-[#0B0F19] p-1 rounded-xl border border-[#334155]">
                  <button
                    type="button"
                    onClick={() => setImportMode("append")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      importMode === "append"
                        ? "bg-[#06B6D4] text-slate-950 shadow"
                        : "text-[#94A3B8] hover:text-white"
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
                        : "text-[#94A3B8] hover:text-white"
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
                        <span className="text-[#06B6D4]">
                          {parsedPreviewQuestions.reduce((s, q) => s + (Number(q.points) || 0), 0)} Pts
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg border font-bold uppercase tracking-wider text-cyan-300 border-cyan-500/30 bg-cyan-500/10">
                        Detected: {detectedFormat === "plain_text" ? "AI Plain Text" : detectedFormat.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center flex-wrap gap-1.5 text-[10px] font-mono">
                      <span className="rounded bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 text-cyan-300">
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
                        className="rounded-xl border border-[#334155] bg-[#1E293B] p-3 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#0B0F19] font-mono text-[10px] font-bold text-[#06B6D4]">
                              {idx + 1}
                            </span>
                            <span className="rounded bg-[#0B0F19] border border-[#334155] px-1.5 py-0.2 text-[10px] font-mono uppercase text-cyan-300 font-bold">
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
                                      : "border-[#334155] bg-[#0B0F19] text-[#94A3B8]"
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
                            <span className="font-bold text-cyan-400">Accepted Answer / Rubric: </span>
                            {String(q.correctAnswer)}
                          </div>
                        )}

                        {q.explanation && (
                          <div className="text-[10px] text-[#94A3B8] italic">
                            Rationale: {q.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#334155] bg-[#0B0F19]/60 p-8 text-center text-xs text-[#94A3B8]">
                  Select a file or paste formatted CSV/JSON above to view preview and import questions.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-[#334155] px-6 py-4 bg-[#1E293B]/70 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportInputText("");
                  setImportFileName(null);
                  setParsedPreviewQuestions([]);
                  setImportErrors([]);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-white bg-[#0B0F19] border border-[#334155]"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={parsedPreviewQuestions.length === 0}
                onClick={handleConfirmImport}
                className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-[#06B6D4] hover:bg-[#0891B2] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95"
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
    </div>
  );
}
