"use client";

import React, { useState, useEffect } from "react";
import { Assignment, AssignmentSubmission } from "@/types/assignment";
import { StudentGroup } from "@/types/group";
import { Syllabus } from "@/types/syllabus";
import { Trade, StudentLevel } from "@/types/auth";
import { 
  getAllAssignments, 
  saveAssignment, 
  deleteAssignment, 
  getSubmissionsForAssignment, 
  getAllSubmissions,
  saveAssignmentSubmission,
  getAllGroups,
  gradeGroupSubmission
} from "@/lib/db";
import { parseAssignmentWithGemini } from "@/lib/gemini";
import { 
  FileText, 
  Plus, 
  Upload, 
  Sparkles, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Users, 
  Award, 
  Eye, 
  X, 
  Check, 
  AlertCircle,
  FileCheck,
  Search,
  ExternalLink,
  BookOpen,
  Filter
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AssignmentManagerProps {
  syllabi: Syllabus[];
  trades: Trade[];
  adminEmail?: string;
}

export default function AssignmentManager({ syllabi, trades, adminEmail }: AssignmentManagerProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [allSubmissionsList, setAllSubmissionsList] = useState<AssignmentSubmission[]>([]);
  const [courseGroups, setCourseGroups] = useState<StudentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"list" | "create" | "submissions" | "course_submissions">("list");
  
  // Specific assignment submissions view
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Filter for Course Submissions tab
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Grading modal state
  const [gradingSubmission, setGradingSubmission] = useState<AssignmentSubmission | null>(null);
  const [gradeScore, setGradeScore] = useState<number>(0);
  const [gradeFeedback, setGradeFeedback] = useState<string>("");
  const [savingGrade, setSavingGrade] = useState(false);

  // Form states for creating / editing assignment
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formCourseCode, setFormCourseCode] = useState("");
  const [formTradeId, setFormTradeId] = useState<string>("all");
  const [formLevel, setFormLevel] = useState<StudentLevel | "all">("all");
  const [formDescription, setFormDescription] = useState("");
  const [formInstructions, setFormInstructions] = useState("");
  const [formTotalPoints, setFormTotalPoints] = useState<number>(100);
  const [formDueDate, setFormDueDate] = useState<string>("");
  const [formAllowFile, setFormAllowFile] = useState(true);
  const [formAllowText, setFormAllowText] = useState(true);
  const [formSubmissionType, setFormSubmissionType] = useState<"individual" | "group">("individual");
  const [formTargetGroupId, setFormTargetGroupId] = useState<string>("all_groups");

  // Document ingestion / AI parse state
  const [pastedRawText, setPastedRawText] = useState("");
  const [isParsingDoc, setIsParsingDoc] = useState(false);
  const [parseStatus, setParseStatus] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [asgData, allSubs, allG] = await Promise.all([
        getAllAssignments(),
        getAllSubmissions(),
        getAllGroups()
      ]);
      setAssignments(asgData);
      setAllSubmissionsList(allSubs);
      setCourseGroups(allG);
    } catch (err) {
      console.error("Error loading assignments, submissions & groups:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSyllabus = (sylId: string) => {
    const found = syllabi.find(s => s.id === sylId);
    if (found) {
      setFormCourseCode(found.courseCode || "");
      if (found.tradeId) setFormTradeId(found.tradeId);
      if (found.level) setFormLevel(found.level);
    }
  };

  // PDF & Text File Reader
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingDoc(true);
    setParseStatus(`Reading ${file.name}...`);

    try {
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        const arrayBuffer = await file.arrayBuffer();
        const pdfjsLib = await import("pdfjs-dist");
        try {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
        } catch {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
        }

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let extractedText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str || "")
            .join(" ");
          extractedText += pageText + "\n\n";
        }

        setPastedRawText(extractedText);
        setParseStatus("Structuring with Gemini 2.5 Pro...");
        await processRawTextWithGemini(extractedText);
      } else {
        const text = await file.text();
        setPastedRawText(text);
        setParseStatus("Structuring with Gemini 2.5 Pro...");
        await processRawTextWithGemini(text);
      }
    } catch (err: any) {
      console.error("File parsing error:", err);
      alert("Failed to parse file: " + (err.message || "Unknown error"));
    } finally {
      setIsParsingDoc(false);
      setParseStatus(null);
    }
  };

  const processRawTextWithGemini = async (rawText: string) => {
    try {
      const parsed = await parseAssignmentWithGemini(rawText);
      if (parsed.title) setFormTitle(parsed.title);
      if (parsed.courseCode) setFormCourseCode(parsed.courseCode);
      if (parsed.description) setFormDescription(parsed.description);
      if (parsed.instructionsMarkdown) setFormInstructions(parsed.instructionsMarkdown);
      if (parsed.totalPoints) setFormTotalPoints(parsed.totalPoints);
      if (parsed.dueDate) setFormDueDate(parsed.dueDate);
    } catch (err) {
      console.warn("AI parse failed, using raw text directly:", err);
      setFormInstructions(rawText);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert("Please provide an assignment title.");
      return;
    }

    const newAssignment: Assignment = {
      id: editingId || `asg_${Date.now()}`,
      title: formTitle.trim(),
      courseCode: formCourseCode.trim(),
      courseTitle: syllabi.find(s => s.courseCode === formCourseCode)?.title || "",
      tradeId: formTradeId,
      level: formLevel,
      description: formDescription.trim(),
      instructionsMarkdown: formInstructions.trim() || formDescription.trim(),
      totalPoints: Number(formTotalPoints) || 100,
      dueDate: formDueDate || undefined,
      allowFileUpload: formAllowFile,
      allowTextSubmission: formAllowText,
      submissionType: formSubmissionType,
      targetGroupId: formSubmissionType === "group" ? formTargetGroupId : undefined,
      status: "published",
      createdAt: editingId ? (assignments.find(a => a.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: adminEmail || "Josef Marie"
    };

    await saveAssignment(newAssignment);
    await loadAllData();
    resetForm();
    setActiveTab("list");
  };

  const resetForm = () => {
    setEditingId(null);
    setFormTitle("");
    setFormCourseCode("");
    setFormTradeId("all");
    setFormLevel("all");
    setFormDescription("");
    setFormInstructions("");
    setFormTotalPoints(100);
    setFormDueDate("");
    setFormAllowFile(true);
    setFormAllowText(true);
    setFormSubmissionType("individual");
    setFormTargetGroupId("all_groups");
    setPastedRawText("");
  };

  const handleEdit = (asg: Assignment) => {
    setEditingId(asg.id);
    setFormTitle(asg.title);
    setFormCourseCode(asg.courseCode || "");
    setFormTradeId(asg.tradeId || "all");
    setFormLevel(asg.level || "all");
    setFormDescription(asg.description || "");
    setFormInstructions(asg.instructionsMarkdown || "");
    setFormTotalPoints(asg.totalPoints || 100);
    setFormDueDate(asg.dueDate ? asg.dueDate.split("T")[0] : "");
    setFormAllowFile(asg.allowFileUpload ?? true);
    setFormAllowText(asg.allowTextSubmission ?? true);
    setFormSubmissionType(asg.submissionType || "individual");
    setFormTargetGroupId(asg.targetGroupId || "all_groups");
    setActiveTab("create");
  };

  const handleDelete = async (id: string, title: string) => {
    if (confirm(`Permanently delete assignment "${title}"?`)) {
      await deleteAssignment(id);
      await loadAllData();
      if (selectedAssignment?.id === id) {
        setSelectedAssignment(null);
        setActiveTab("list");
      }
    }
  };

  const handleViewSubmissions = async (asg: Assignment) => {
    setSelectedAssignment(asg);
    setActiveTab("submissions");
    setLoadingSubmissions(true);
    try {
      const data = await getSubmissionsForAssignment(asg.id);
      setSubmissions(data);
    } catch (err) {
      console.error("Error loading submissions:", err);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const openGradingModal = (sub: AssignmentSubmission) => {
    setGradingSubmission(sub);
    setGradeScore(sub.score ?? (sub.maxScore || 100));
    setGradeFeedback(sub.feedback || "");
  };

  const handleSaveGrade = async () => {
    if (!gradingSubmission) return;
    setSavingGrade(true);
    try {
      const isGroup = gradingSubmission.submissionType === "group" || !!gradingSubmission.groupId;

      if (isGroup) {
        await gradeGroupSubmission(
          gradingSubmission,
          Number(gradeScore),
          gradeFeedback.trim(),
          adminEmail || "Josef Marie"
        );
        await loadAllData();
        if (selectedAssignment) {
          const freshSubs = await getSubmissionsForAssignment(selectedAssignment.id);
          setSubmissions(freshSubs);
        }
      } else {
        const updated: AssignmentSubmission = {
          ...gradingSubmission,
          score: Number(gradeScore),
          feedback: gradeFeedback.trim(),
          status: "graded",
          gradedAt: new Date().toISOString(),
          gradedBy: adminEmail || "Josef Marie"
        };

        await saveAssignmentSubmission(updated);
        setSubmissions(prev => prev.map(s => s.id === updated.id ? updated : s));
        setAllSubmissionsList(prev => prev.map(s => s.id === updated.id ? updated : s));
      }
      setGradingSubmission(null);
    } catch (err) {
      console.error("Grading save error:", err);
      alert("Failed to save grade.");
    } finally {
      setSavingGrade(false);
    }
  };

  // Filter submissions by course and grading status for the Course Submissions desk
  const filteredCourseSubmissions = allSubmissionsList.filter(s => {
    const matchesCourse = courseFilter === "all" || s.courseCode === courseFilter;
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "graded" && s.status === "graded") ||
      (statusFilter === "pending" && s.status !== "graded");
    return matchesCourse && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Tab Navigation & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#334155] pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setActiveTab("list"); resetForm(); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "list"
                ? "bg-[#06B6D4] text-slate-950 shadow-md"
                : "bg-[#1E293B] text-[#94A3B8] hover:text-white border border-[#334155]"
            }`}
          >
            Instructor Tasks ({assignments.length})
          </button>

          <button
            onClick={() => setActiveTab("course_submissions")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === "course_submissions"
                ? "bg-[#06B6D4] text-slate-950 shadow-md"
                : "bg-[#1E293B] text-[#94A3B8] hover:text-white border border-[#334155]"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>All Course Submissions ({allSubmissionsList.length})</span>
          </button>

          {selectedAssignment && (
            <button
              onClick={() => setActiveTab("submissions")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "submissions"
                  ? "bg-[#06B6D4] text-slate-950 shadow-md"
                  : "bg-[#1E293B] text-[#94A3B8] hover:text-white border border-[#334155]"
              }`}
            >
              Task: {selectedAssignment.title.slice(0, 18)}...
            </button>
          )}
        </div>

        <button
          onClick={() => {
            resetForm();
            setActiveTab("create");
          }}
          className="inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-[#06B6D4] to-[#3B82F6] px-4 py-2 text-xs font-bold text-slate-950 shadow-lg hover:brightness-110 transition-all shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Create New Assignment</span>
        </button>
      </div>

      {/* 1. LIST VIEW (OFFICIAL INSTRUCTOR ASSIGNMENTS) */}
      {activeTab === "list" && (
        <div className="space-y-4">
          {loading ? (
            <div className="py-12 text-center text-[#94A3B8] text-xs font-mono">
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[#06B6D4] border-t-transparent mb-2" />
              Loading Assignments...
            </div>
          ) : assignments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#334155] p-12 text-center bg-[#1E293B]/40">
              <FileText className="mx-auto h-12 w-12 text-[#64748B] mb-3" />
              <h3 className="text-base font-bold text-white mb-1">No Instructor Assignments Created Yet</h3>
              <p className="text-xs text-[#94A3B8] max-w-md mx-auto mb-6">
                Create assignments, upload a PDF document or paste instructions. You can target specific classes, trades, or subjects.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => { resetForm(); setActiveTab("create"); }}
                  className="inline-flex items-center space-x-2 rounded-xl bg-[#06B6D4] px-4 py-2 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-md"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create First Assignment</span>
                </button>
                <button
                  onClick={() => setActiveTab("course_submissions")}
                  className="inline-flex items-center space-x-2 rounded-xl bg-[#1E293B] border border-[#334155] px-4 py-2 text-xs font-semibold text-white hover:border-[#06B6D4] transition-all shadow-md"
                >
                  <BookOpen className="h-4 w-4 text-[#06B6D4]" />
                  <span>View Student Submissions</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignments.map((asg) => {
                const targetTrade = trades.find(t => t.id === asg.tradeId);
                const isOverdue = asg.dueDate && new Date(asg.dueDate) < new Date();
                const taskSubmissionsCount = allSubmissionsList.filter(s => s.assignmentId === asg.id).length;

                return (
                  <div
                    key={asg.id}
                    className="flex flex-col justify-between rounded-2xl border border-[#334155] bg-[#1E293B]/90 p-5 hover:border-[#06B6D4]/50 transition-all shadow-xl group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="rounded-md bg-[#06B6D4]/10 border border-[#06B6D4]/30 px-2 py-0.5 text-[10px] font-mono font-bold text-[#06B6D4]">
                          {asg.courseCode || "General"}
                        </span>
                        <div className="flex items-center space-x-1.5">
                          {asg.submissionType === "group" && (
                            <span className="rounded-md bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-300 flex items-center space-x-1">
                              <Users className="h-3 w-3" />
                              <span>Group Project</span>
                            </span>
                          )}
                          <span className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
                            {asg.totalPoints} Pts
                          </span>
                        </div>
                      </div>

                      <h3 className="text-sm font-extrabold text-white group-hover:text-[#06B6D4] transition-colors line-clamp-2 mb-2">
                        {asg.title}
                      </h3>

                      <p className="text-xs text-[#94A3B8] line-clamp-3 mb-4 leading-relaxed">
                        {asg.description || asg.instructionsMarkdown}
                      </p>

                      <div className="space-y-1.5 mb-4 text-[11px] font-mono text-[#64748B]">
                        <div className="flex items-center space-x-2">
                          <Users className="h-3.5 w-3.5 text-[#94A3B8]" />
                          <span>Class: {asg.level === "all" ? "All Levels" : asg.level} • {asg.tradeId === "all" ? "All Trades" : targetTrade?.name || asg.tradeId}</span>
                        </div>
                        {asg.dueDate && (
                          <div className={`flex items-center space-x-2 ${isOverdue ? "text-rose-400 font-bold" : "text-[#94A3B8]"}`}>
                            <Calendar className="h-3.5 w-3.5" />
                            <span>Due: {new Date(asg.dueDate).toLocaleDateString()} {isOverdue && "(Expired)"}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#334155]/60 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleViewSubmissions(asg)}
                        className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#06B6D4] hover:text-white bg-[#06B6D4]/10 hover:bg-[#06B6D4] hover:text-slate-950 px-3 py-1.5 rounded-lg border border-[#06B6D4]/30 transition-all"
                      >
                        <Award className="h-3.5 w-3.5" />
                        <span>Submissions ({taskSubmissionsCount})</span>
                      </button>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleEdit(asg)}
                          title="Edit Assignment"
                          className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#334155] transition-colors"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(asg.id, asg.title)}
                          title="Delete Assignment"
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
        </div>
      )}

      {/* 2. COURSE SUBMISSIONS DESK (VIEW ALL SUBMISSIONS GROUPED / FILTERED BY COURSE) */}
      {activeTab === "course_submissions" && (
        <div className="space-y-5">
          {/* Header & Course Filter Bar */}
          <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center space-x-2">
                <BookOpen className="h-5 w-5 text-[#06B6D4]" />
                <span>All Submitted Student Assignments By Course</span>
              </h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Review and grade student work submitted under specific courses, both from assigned tasks and student-uploaded course projects.
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono text-[#94A3B8]">Course:</span>
                <select
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                  className="rounded-xl border border-[#334155] bg-[#0B0F19] px-3 py-1.5 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                >
                  <option value="all">All Courses ({allSubmissionsList.length})</option>
                  {syllabi.map((s) => (
                    <option key={s.id} value={s.courseCode}>
                      {s.courseCode} ({allSubmissionsList.filter(sub => sub.courseCode === s.courseCode).length})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono text-[#94A3B8]">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-[#334155] bg-[#0B0F19] px-3 py-1.5 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Needs Grading</option>
                  <option value="graded">Graded</option>
                </select>
              </div>
            </div>
          </div>

          {/* Submissions Table */}
          {filteredCourseSubmissions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#334155] p-12 text-center bg-[#1E293B]/40">
              <Users className="mx-auto h-10 w-10 text-[#64748B] mb-2" />
              <h3 className="text-sm font-bold text-white mb-1">No Submissions Found</h3>
              <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
                No assignments have been submitted matching the selected course and status filters.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#334155] bg-[#1E293B] overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#334155] bg-[#0B0F19]/50 text-[#94A3B8] font-mono">
                    <tr>
                      <th className="px-4 py-3">Course / Subject</th>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3">Assignment Topic</th>
                      <th className="px-4 py-3">Submission Type</th>
                      <th className="px-4 py-3">Submitted At</th>
                      <th className="px-4 py-3">Status / Grade</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#334155]/60 text-[#CBD5E1]">
                    {filteredCourseSubmissions.map((sub) => {
                      const isGraded = sub.status === "graded";
                      return (
                        <tr key={sub.id} className="hover:bg-[#0B0F19]/40 transition-colors">
                          <td className="px-4 py-3">
                            <span className="rounded-md bg-[#06B6D4]/10 border border-[#06B6D4]/30 px-2 py-0.5 font-mono text-[10px] font-bold text-[#06B6D4]">
                              {sub.courseCode || "General"}
                            </span>
                            {sub.courseTitle && (
                              <span className="block text-[10px] text-[#94A3B8] truncate max-w-[140px] mt-0.5">
                                {sub.courseTitle}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-semibold text-white">
                            {sub.studentName}
                            <span className="block text-[10px] font-mono text-[#64748B]">
                              @{sub.studentUsername} • {sub.level}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-white font-medium max-w-[180px] truncate">
                            {sub.submissionTitle || "Course Assignment"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col space-y-0.5">
                              <span className="inline-flex items-center space-x-1 font-mono text-[10px] text-[#06B6D4]">
                                {sub.fileData ? <Upload className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                                <span className="truncate max-w-[120px]">{sub.fileData ? sub.fileData.name : "Text Answer"}</span>
                              </span>
                              {sub.isIndependentSubmission ? (
                                <span className="text-[9px] font-mono text-purple-300">Self-Submitted</span>
                              ) : (
                                <span className="text-[9px] font-mono text-[#64748B]">Assigned Task</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-[#94A3B8]">
                            {new Date(sub.submittedAt).toLocaleDateString()} {new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3">
                            {isGraded ? (
                              <span className="inline-flex items-center space-x-1 rounded-md bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-400 border border-emerald-500/30">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>{sub.score} / {sub.maxScore}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 rounded-md bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-400 border border-amber-500/30">
                                <Clock className="h-3 w-3" />
                                <span>Needs Grading</span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => openGradingModal(sub)}
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
      )}

      {/* 3. CREATE / EDIT VIEW */}
      {activeTab === "create" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-5 sm:p-7 shadow-xl">
              <h2 className="text-base font-extrabold text-white mb-4 flex items-center space-x-2">
                <FileText className="h-5 w-5 text-[#06B6D4]" />
                <span>{editingId ? "Edit Course Assignment" : "Build & Publish Assignment"}</span>
              </h2>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                    Assignment Title <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Practical Lab: Implementing Binary Search Trees"
                    className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] px-3.5 py-2.5 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#CBD5E1] mb-1">Course / Subject</label>
                    <select
                      value={formCourseCode}
                      onChange={(e) => {
                        setFormCourseCode(e.target.value);
                        handleSelectSyllabus(syllabi.find(s => s.courseCode === e.target.value)?.id || "");
                      }}
                      className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] px-3 py-2.5 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                    >
                      <option value="">-- General / No Subject --</option>
                      {syllabi.map((s) => (
                        <option key={s.id} value={s.courseCode}>
                          {s.courseCode} - {s.title.slice(0, 30)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#CBD5E1] mb-1">Target Class / Level</label>
                    <select
                      value={formLevel}
                      onChange={(e) => setFormLevel(e.target.value as any)}
                      className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] px-3 py-2.5 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                    >
                      <option value="all">All Levels (Level 3, 4, 5)</option>
                      <option value="Level 3">Level 3</option>
                      <option value="Level 4">Level 4</option>
                      <option value="Level 5">Level 5</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#CBD5E1] mb-1">Academic Trade</label>
                    <select
                      value={formTradeId}
                      onChange={(e) => setFormTradeId(e.target.value)}
                      className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] px-3 py-2.5 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                    >
                      <option value="all">All Trades</option>
                      {trades.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#CBD5E1] mb-1">Total Points / Marks</label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={formTotalPoints}
                      onChange={(e) => setFormTotalPoints(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] px-3.5 py-2 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#CBD5E1] mb-1">Due Date</label>
                    <input
                      type="date"
                      value={formDueDate}
                      onChange={(e) => setFormDueDate(e.target.value)}
                      className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] px-3.5 py-2 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1">Short Description / Summary</label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Brief description or purpose of this assignment"
                    className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] px-3.5 py-2 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-[#CBD5E1]">
                      Detailed Instructions, Questions & Tasks (Markdown Supported)
                    </label>
                    <span className="text-[10px] font-mono text-[#06B6D4]">Supports headings, tables, code blocks</span>
                  </div>
                  <textarea
                    rows={8}
                    value={formInstructions}
                    onChange={(e) => setFormInstructions(e.target.value)}
                    placeholder="## Instructions&#10;1. Create a function that implements...&#10;2. Analyze time complexity...&#10;&#10;```javascript&#10;// starter code&#10;```"
                    className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-xs font-mono text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none leading-relaxed"
                  />
                </div>

                {/* Submission Options */}
                <div className="flex items-center space-x-6 p-3 rounded-xl bg-[#0B0F19] border border-[#334155]">
                  <label className="flex items-center space-x-2 text-xs text-[#CBD5E1] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAllowText}
                      onChange={(e) => setFormAllowText(e.target.checked)}
                      className="rounded border-[#334155] text-[#06B6D4] focus:ring-0"
                    />
                    <span>Allow Text / Markdown Responses</span>
                  </label>

                  <label className="flex items-center space-x-2 text-xs text-[#CBD5E1] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAllowFile}
                      onChange={(e) => setFormAllowFile(e.target.checked)}
                      className="rounded border-[#334155] text-[#06B6D4] focus:ring-0"
                    />
                    <span>Allow File / Document Uploads</span>
                  </label>
                </div>

                {/* Submission Mode: Individual vs Group Project */}
                <div className="rounded-xl border border-[#334155] bg-[#0B0F19] p-3.5 space-y-3">
                  <label className="block text-xs font-bold text-white">
                    Assignment Type &amp; Submission Mode
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormSubmissionType("individual")}
                      className={`flex items-center justify-center space-x-2 rounded-xl p-2.5 text-xs font-bold transition-all border ${
                        formSubmissionType === "individual"
                          ? "bg-[#06B6D4] text-slate-950 border-[#06B6D4] shadow-md"
                          : "bg-[#1E293B] text-[#94A3B8] border-[#334155] hover:text-white"
                      }`}
                    >
                      <FileText className="h-4 w-4" />
                      <span>Individual Submission</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormSubmissionType("group")}
                      className={`flex items-center justify-center space-x-2 rounded-xl p-2.5 text-xs font-bold transition-all border ${
                        formSubmissionType === "group"
                          ? "bg-purple-600 text-white border-purple-500 shadow-md"
                          : "bg-[#1E293B] text-[#94A3B8] border-[#334155] hover:text-white"
                      }`}
                    >
                      <Users className="h-4 w-4" />
                      <span>Group Project / Team Task</span>
                    </button>
                  </div>

                  {formSubmissionType === "group" && (
                    <div className="pt-2 border-t border-[#334155]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-[11px] text-purple-300">
                        <span>👥 One submission represents the entire team. Grades &amp; feedback cascade to all members.</span>
                      </div>
                      <select
                        value={formTargetGroupId}
                        onChange={(e) => setFormTargetGroupId(e.target.value)}
                        className="rounded-xl border border-[#334155] bg-[#1E293B] px-3 py-1.5 text-xs text-white focus:border-purple-400 focus:outline-none"
                      >
                        <option value="all_groups">Target: All Groups in Course</option>
                        {courseGroups
                          .filter(g => !formCourseCode || g.courseCode === formCourseCode)
                          .map(g => (
                            <option key={g.id} value={g.id}>Specific: {g.name} ({g.members.length} members)</option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#334155]">
                  <button
                    type="button"
                    onClick={() => { resetForm(); setActiveTab("list"); }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-white bg-[#0B0F19] border border-[#334155] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-[#06B6D4] hover:bg-[#0891B2] hover:text-white transition-all shadow-lg"
                  >
                    {editingId ? "Update Assignment" : "Publish Assignment"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right 1 Col: Document Upload & AI Parser */}
          <div className="space-y-5">
            <div className="rounded-2xl border border-dashed border-[#06B6D4]/40 bg-[#06B6D4]/5 p-5 shadow-xl">
              <div className="flex items-center space-x-2 text-xs font-extrabold text-[#06B6D4] mb-2">
                <Sparkles className="h-4 w-4" />
                <span>AI Assignment Extractor</span>
              </div>
              <p className="text-xs text-[#CBD5E1] mb-4 leading-relaxed">
                Upload an existing <strong>PDF document</strong> or <strong>text document</strong>. Our client-side parser &amp; Gemini 2.5 Pro will automatically extract instructions, due date, course code, and questions directly into the form!
              </p>

              <label 
                onClick={() => {
                  if (typeof window !== "undefined") {
                    (window as any).__SYLLABUS_FILE_PICKER_ACTIVE = true;
                    (window as any).__SYLLABUS_FILE_PICKER_TIMESTAMP = Date.now();
                  }
                }}
                className="flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-[#334155] bg-[#1E293B] hover:border-[#06B6D4] hover:bg-[#1E293B]/80 cursor-pointer transition-all"
              >
                <Upload className="h-8 w-8 text-[#06B6D4] mb-2" />
                <span className="text-xs font-bold text-white text-center">
                  {isParsingDoc ? (parseStatus || "Processing Document...") : "Upload Assignment PDF / Doc"}
                </span>
                <span className="text-[10px] text-[#94A3B8] mt-1">.pdf, .txt, .md formats supported</span>
                <input
                  type="file"
                  accept=".pdf,.txt,.md"
                  disabled={isParsingDoc}
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      (window as any).__SYLLABUS_FILE_PICKER_ACTIVE = true;
                      (window as any).__SYLLABUS_FILE_PICKER_TIMESTAMP = Date.now();
                    }
                  }}
                  onChange={(e) => {
                    if (typeof window !== "undefined") {
                      setTimeout(() => {
                        (window as any).__SYLLABUS_FILE_PICKER_ACTIVE = false;
                        (window as any).__SYLLABUS_FILE_PICKER_TIMESTAMP = 0;
                      }, 1000);
                    }
                    handleFileUpload(e);
                  }}
                  className="hidden"
                />
              </label>

              <div className="my-4 flex items-center">
                <div className="flex-1 border-t border-[#334155]"></div>
                <span className="px-3 text-[10px] font-mono text-[#64748B]">OR PASTE TEXT</span>
                <div className="flex-1 border-t border-[#334155]"></div>
              </div>

              <div>
                <textarea
                  rows={4}
                  value={pastedRawText}
                  onChange={(e) => setPastedRawText(e.target.value)}
                  placeholder="Paste raw assignment questions or syllabus tasks here..."
                  className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-2.5 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none mb-2"
                />
                <button
                  type="button"
                  disabled={isParsingDoc || !pastedRawText.trim()}
                  onClick={() => {
                    setIsParsingDoc(true);
                    setParseStatus("Parsing pasted text...");
                    processRawTextWithGemini(pastedRawText).finally(() => {
                      setIsParsingDoc(false);
                      setParseStatus(null);
                    });
                  }}
                  className="w-full inline-flex items-center justify-center space-x-1.5 rounded-xl border border-[#06B6D4]/40 bg-[#06B6D4]/10 py-2 text-xs font-bold text-[#06B6D4] hover:bg-[#06B6D4] hover:text-slate-950 transition-all disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Parse With Gemini 2.5 Pro</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. SUBMISSIONS & GRADING VIEW (FOR SPECIFIC INSTRUCTOR ASSIGNMENT) */}
      {activeTab === "submissions" && selectedAssignment && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 text-xs font-mono text-[#06B6D4] mb-1">
                <span>{selectedAssignment.courseCode || "General"}</span>
                <span>•</span>
                <span>Max Points: {selectedAssignment.totalPoints}</span>
              </div>
              <h2 className="text-base font-extrabold text-white">{selectedAssignment.title}</h2>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-[#94A3B8]">
                {submissions.length} Submissions ({submissions.filter(s => s.status === "graded").length} Graded)
              </span>
            </div>
          </div>

          {loadingSubmissions ? (
            <div className="py-12 text-center text-[#94A3B8] text-xs font-mono">
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[#06B6D4] border-t-transparent mb-2" />
              Loading Submissions...
            </div>
          ) : submissions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#334155] p-12 text-center bg-[#1E293B]/40">
              <Users className="mx-auto h-10 w-10 text-[#64748B] mb-2" />
              <h3 className="text-sm font-bold text-white mb-1">No Student Submissions Yet</h3>
              <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
                Students enrolled in this class can view this assignment and submit their answers online.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#334155] bg-[#1E293B] overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#334155] bg-[#0B0F19]/50 text-[#94A3B8] font-mono">
                    <tr>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3">Class & Trade</th>
                      <th className="px-4 py-3">Submitted At</th>
                      <th className="px-4 py-3">Format</th>
                      <th className="px-4 py-3">Status / Grade</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#334155]/60 text-[#CBD5E1]">
                    {submissions.map((sub) => {
                      const isGraded = sub.status === "graded";
                      return (
                        <tr key={sub.id} className="hover:bg-[#0B0F19]/40 transition-colors">
                          <td className="px-4 py-3 font-semibold text-white">
                            {sub.studentName}
                            <span className="block text-[10px] font-mono text-[#64748B]">@{sub.studentUsername}</span>
                            {sub.groupName && (
                              <span className="inline-flex items-center space-x-1 rounded bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 text-[9px] font-mono text-purple-300 mt-1">
                                <Users className="h-2.5 w-2.5" />
                                <span>Team: {sub.groupName}</span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-[#94A3B8]">
                            {sub.level}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-[#94A3B8]">
                            {new Date(sub.submittedAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center space-x-1 font-mono text-[10px] text-[#06B6D4]">
                              {sub.fileData ? <Upload className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                              <span>{sub.fileData ? sub.fileData.name : "Text Answer"}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {isGraded ? (
                              <span className="inline-flex items-center space-x-1 rounded-md bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-400 border border-emerald-500/30">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>{sub.score} / {sub.maxScore}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 rounded-md bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-400 border border-amber-500/30">
                                <Clock className="h-3 w-3" />
                                <span>Needs Grading</span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => openGradingModal(sub)}
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
      )}

      {/* GRADING MODAL */}
      {gradingSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#334155] bg-[#1E293B] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#334155] pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-white">Review Student Submission</h3>
                <p className="text-xs text-[#94A3B8]">
                  {gradingSubmission.studentName} (@{gradingSubmission.studentUsername}) • {gradingSubmission.courseCode || "Course"} • {gradingSubmission.submissionTitle || "Assignment"}
                </p>
              </div>
              <button
                onClick={() => setGradingSubmission(null)}
                className="rounded-lg p-1 text-[#94A3B8] hover:text-white hover:bg-[#334155]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Group Project Notice */}
            {gradingSubmission.groupName && (
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3.5 text-xs text-purple-200">
                <div className="flex items-center space-x-2 font-bold mb-1">
                  <Users className="h-4 w-4 text-purple-400" />
                  <span>Group Project: {gradingSubmission.groupName}</span>
                </div>
                <p className="text-[11px] text-purple-300 leading-relaxed">
                  <strong>Team Roster:</strong> {gradingSubmission.groupMembers?.map(m => m.fullName).join(", ") || gradingSubmission.studentName}.
                  <br />
                  Saving this grade will automatically apply the score and instructor feedback to all team members!
                </p>
              </div>
            )}

            {/* Student's answer content */}
            <div className="rounded-xl border border-[#334155] bg-[#0B0F19] p-4 space-y-3">
              <span className="text-[10px] font-mono text-[#06B6D4] uppercase tracking-wider block">Submitted Solution:</span>
              
              {gradingSubmission.contentMarkdown ? (
                <div className="prose prose-invert prose-xs max-w-none leading-relaxed text-[#CBD5E1]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {gradingSubmission.contentMarkdown}
                  </ReactMarkdown>
                </div>
              ) : null}

              {gradingSubmission.fileData && (
                <div className="mt-3 flex items-center justify-between rounded-lg border border-[#334155] bg-[#1E293B] p-3">
                  <div className="flex items-center space-x-2">
                    <FileCheck className="h-5 w-5 text-[#06B6D4]" />
                    <div>
                      <span className="block text-xs font-bold text-white">{gradingSubmission.fileData.name}</span>
                      <span className="block text-[10px] font-mono text-[#94A3B8]">{(gradingSubmission.fileData.size / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                  {gradingSubmission.fileData.base64Url && (
                    <a
                      href={gradingSubmission.fileData.base64Url}
                      download={gradingSubmission.fileData.name}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center space-x-1 rounded-lg bg-[#06B6D4] px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-md"
                    >
                      <Upload className="h-3 w-3" />
                      <span>Download File</span>
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Grading inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                  Awarded Score (out of {gradingSubmission.maxScore || 100})
                </label>
                <input
                  type="number"
                  min={0}
                  max={gradingSubmission.maxScore || 100}
                  value={gradeScore}
                  onChange={(e) => setGradeScore(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] px-3.5 py-2 text-xs font-bold text-[#06B6D4] focus:border-[#06B6D4] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#CBD5E1] mb-1">Feedback / Corrections</label>
                <textarea
                  rows={3}
                  value={gradeFeedback}
                  onChange={(e) => setGradeFeedback(e.target.value)}
                  placeholder="Provide constructive feedback for the student..."
                  className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-2.5 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#334155]">
              <button
                type="button"
                onClick={() => setGradingSubmission(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-white bg-[#0B0F19] border border-[#334155]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingGrade}
                onClick={handleSaveGrade}
                className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-500 hover:text-white transition-all shadow-lg"
              >
                {savingGrade ? "Saving Grade..." : "Submit Grade & Feedback"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
