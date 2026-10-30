"use client";

import React, { useState, useEffect, useMemo } from "react";
import { UserProfile, Trade, StudentLevel } from "@/types/auth";
import { ExamAttempt } from "@/types/exam";
import { AssignmentSubmission } from "@/types/assignment";
import { StudentGradeRecord, AcademicStanding } from "@/types/gradebook";
import { 
  getAllUserProfiles, 
  getAllExamAttempts, 
  getAllSubmissions, 
  getAllTrades,
  getAllStudentProgressSummaries,
  resetStudentUnfocusedCount
} from "@/lib/db";
import { 
  calculateLetterGrade, 
  calculateAcademicStanding, 
  exportGradebookToCSV 
} from "@/lib/gradebookExport";
import { 
  GraduationCap, 
  Download, 
  Search, 
  Filter, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  AlertTriangle, 
  CheckCircle2, 
  Award, 
  ShieldAlert, 
  FileSpreadsheet, 
  Printer, 
  RefreshCw, 
  BookOpen, 
  FileText, 
  Eye, 
  X, 
  ExternalLink,
  RotateCcw,
  Sparkles,
  Users
} from "lucide-react";

interface MasterGradebookProps {
  adminUser?: UserProfile | null;
  trades?: Trade[];
}

type SortField = "name" | "trade" | "level" | "strikes" | "progress" | "examAvg" | "assignAvg" | "composite";
type SortDirection = "asc" | "desc";

export default function MasterGradebook({ adminUser, trades = [] }: MasterGradebookProps) {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [examAttempts, setExamAttempts] = useState<ExamAttempt[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [progressSummaries, setProgressSummaries] = useState<Record<string, { pct: number; completed: number; total: number; lastActive?: string }>>({});
  const [tradesMap, setTradesMap] = useState<Record<string, string>>({});

  // Filters & Search
  const [search, setSearch] = useState("");
  const [selectedTrade, setSelectedTrade] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [selectedStanding, setSelectedStanding] = useState<string>("all");

  // Sorting
  const [sortField, setSortField] = useState<SortField>("composite");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Selected Student for Detailed Transcript Modal
  const [selectedStudent, setSelectedStudent] = useState<StudentGradeRecord | null>(null);
  const [resettingStrikesUid, setResettingStrikesUid] = useState<string | null>(null);

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [allUsers, allExams, allSubs, allProgress, allTrd] = await Promise.all([
        getAllUserProfiles(),
        getAllExamAttempts(),
        getAllSubmissions(),
        getAllStudentProgressSummaries(),
        trades.length > 0 ? Promise.resolve(trades) : getAllTrades()
      ]);

      const tMap: Record<string, string> = {};
      allTrd.forEach((t) => {
        tMap[t.id] = t.name;
      });
      setTradesMap(tMap);

      // Filter only real students
      const studentProfiles = allUsers.filter(
        (u) => u.role === "student" && !u.uid.startsWith("demo-") && u.fullName !== "Alson Johns"
      );
      setStudents(studentProfiles);
      setExamAttempts(allExams || []);
      setSubmissions(allSubs || []);

      // Build progress map
      const pMap: Record<string, { pct: number; completed: number; total: number; lastActive?: string }> = {};
      allProgress.forEach((p) => {
        pMap[p.userId] = {
          pct: p.progressPercent || 0,
          completed: p.completedSubtopicsCount || 0,
          total: p.totalSubtopicsCount || 0,
          lastActive: p.lastActive
        };
      });
      setProgressSummaries(pMap);
    } catch (e) {
      console.error("Error loading gradebook data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute Grade Records
  const gradeRecords: StudentGradeRecord[] = useMemo(() => {
    return students.map((student) => {
      // 1. Exams
      const studentExams = examAttempts.filter((a) => a.studentUid === student.uid && a.status !== "in_progress");
      let examAvg = 0;
      let examsPassed = 0;
      if (studentExams.length > 0) {
        const totalPct = studentExams.reduce((acc, curr) => {
          const pct = curr.percentage !== undefined ? curr.percentage : (curr.score !== undefined && curr.maxScore > 0 ? (curr.score / curr.maxScore) * 100 : 0);
          if (pct >= 60 || curr.passed) examsPassed++;
          return acc + pct;
        }, 0);
        examAvg = totalPct / studentExams.length;
      }

      // 2. Assignments
      const studentSubs = submissions.filter((s) => s.studentUid === student.uid || s.submittedByUid === student.uid);
      const gradedSubs = studentSubs.filter((s) => s.status === "graded" && s.score !== undefined);
      let assignAvg = 0;
      if (gradedSubs.length > 0) {
        const totalScorePct = gradedSubs.reduce((acc, curr) => {
          const max = curr.maxScore > 0 ? curr.maxScore : 100;
          return acc + ((curr.score || 0) / max) * 100;
        }, 0);
        assignAvg = totalScorePct / gradedSubs.length;
      }

      // 3. Syllabus Progress
      const prog = progressSummaries[student.uid] || { pct: 0, completed: 0, total: 0 };

      // 4. Composite Score: 45% Exams, 35% Assignments, 20% Syllabus Progress
      let composite = 0;
      if (studentExams.length > 0 && gradedSubs.length > 0) {
        composite = examAvg * 0.45 + assignAvg * 0.35 + prog.pct * 0.20;
      } else if (studentExams.length > 0) {
        composite = examAvg * 0.70 + prog.pct * 0.30;
      } else if (gradedSubs.length > 0) {
        composite = assignAvg * 0.70 + prog.pct * 0.30;
      } else {
        composite = prog.pct;
      }

      const letterGrade = calculateLetterGrade(composite);
      const standing = calculateAcademicStanding(student, examAvg, assignAvg, prog.pct, composite);

      return {
        studentUid: student.uid,
        studentName: student.fullName || student.username,
        username: student.username,
        email: student.email || "No email",
        tradeId: student.tradeId,
        tradeName: tradesMap[student.tradeId] || "General Core",
        level: student.level,
        status: student.status,
        unfocusedCount: student.unfocusedCount || 0,
        lastActive: prog.lastActive || student.createdAt,
        examAttempts: studentExams,
        examAvg,
        examsPassedCount: examsPassed,
        examsTotalCount: studentExams.length,
        assignmentSubmissions: studentSubs,
        assignmentAvg: assignAvg,
        assignmentsGradedCount: gradedSubs.length,
        assignmentsSubmittedCount: studentSubs.length,
        syllabusProgressPct: prog.pct,
        completedSubtopics: prog.completed,
        totalSubtopics: prog.total,
        compositeScore: composite,
        letterGrade,
        standing
      };
    });
  }, [students, examAttempts, submissions, progressSummaries, tradesMap]);

  // Filtered & Sorted Records
  const filteredRecords = useMemo(() => {
    return gradeRecords
      .filter((r) => {
        // Trade filter
        if (selectedTrade !== "all" && r.tradeId !== selectedTrade) return false;
        // Level filter
        if (selectedLevel !== "all" && r.level !== selectedLevel) return false;
        // Standing filter
        if (selectedStanding !== "all" && r.standing !== selectedStanding) return false;
        // Search query
        if (search.trim()) {
          const q = search.toLowerCase();
          return (
            r.studentName.toLowerCase().includes(q) ||
            r.username.toLowerCase().includes(q) ||
            r.email.toLowerCase().includes(q) ||
            r.tradeName.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        let comp = 0;
        if (sortField === "name") comp = a.studentName.localeCompare(b.studentName);
        else if (sortField === "trade") comp = a.tradeName.localeCompare(b.tradeName);
        else if (sortField === "level") comp = a.level.localeCompare(b.level);
        else if (sortField === "strikes") comp = (a.unfocusedCount || 0) - (b.unfocusedCount || 0);
        else if (sortField === "progress") comp = a.syllabusProgressPct - b.syllabusProgressPct;
        else if (sortField === "examAvg") comp = a.examAvg - b.examAvg;
        else if (sortField === "assignAvg") comp = a.assignmentAvg - b.assignmentAvg;
        else if (sortField === "composite") comp = a.compositeScore - b.compositeScore;

        return sortDirection === "asc" ? comp : -comp;
      });
  }, [gradeRecords, selectedTrade, selectedLevel, selectedStanding, search, sortField, sortDirection]);

  // Aggregate Stats
  const stats = useMemo(() => {
    const total = gradeRecords.length;
    if (total === 0) return { total: 0, classAvg: 0, honorCount: 0, atRiskCount: 0, suspendedCount: 0 };
    const sumComposite = gradeRecords.reduce((acc, r) => acc + r.compositeScore, 0);
    const honor = gradeRecords.filter((r) => r.standing === "honor").length;
    const atRisk = gradeRecords.filter((r) => r.standing === "at_risk" || r.standing === "critical_risk").length;
    const suspended = gradeRecords.filter((r) => r.standing === "suspended").length;
    return {
      total,
      classAvg: sumComposite / total,
      honorCount: honor,
      atRiskCount: atRisk,
      suspendedCount: suspended
    };
  }, [gradeRecords]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const handleResetStrikes = async (studentUid: string) => {
    setResettingStrikesUid(studentUid);
    try {
      await resetStudentUnfocusedCount(studentUid);
      await loadData();
      if (selectedStudent && selectedStudent.studentUid === studentUid) {
        setSelectedStudent((prev) => prev ? { ...prev, unfocusedCount: 0, standing: "good" } : null);
      }
    } catch (e) {
      console.error("Error resetting strikes:", e);
    } finally {
      setResettingStrikesUid(null);
    }
  };

  const getStandingBadge = (standing: AcademicStanding) => {
    switch (standing) {
      case "honor":
        return {
          label: "Honor Roll",
          badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
          icon: <Award className="w-3.5 h-3.5 text-emerald-400" />
        };
      case "good":
        return {
          label: "In Good Standing",
          badge: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
        };
      case "at_risk":
        return {
          label: "At Academic Risk",
          badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
        };
      case "critical_risk":
        return {
          label: "Critical Warning",
          badge: "bg-orange-500/15 text-orange-300 border-orange-500/30",
          icon: <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
        };
      case "suspended":
        return {
          label: "Suspended (10 Strikes)",
          badge: "bg-rose-500/20 text-rose-300 border-rose-500/40",
          icon: <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
        };
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case "A+":
      case "A":
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
      case "B":
        return "text-cyan-400 bg-cyan-500/10 border-cyan-500/30";
      case "C":
        return "text-amber-400 bg-amber-500/10 border-amber-500/30";
      case "D":
        return "text-orange-400 bg-orange-500/10 border-orange-500/30";
      default:
        return "text-rose-400 bg-rose-500/10 border-rose-500/30";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="rounded-2xl border border-[#334155]/80 bg-[#1E293B]/75 backdrop-blur-xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 h-44 w-44 bg-gradient-to-bl from-cyan-500/15 via-blue-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#334155]/80 pb-5">
          <div className="flex items-center space-x-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 text-cyan-400 shadow-inner shrink-0">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  Academic Master Gradebook
                </h2>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Live Ledger
                </span>
              </div>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Unified grades combining real exam attempts, assignments, syllabus progress, and discipline standing.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => exportGradebookToCSV(filteredRecords)}
              disabled={filteredRecords.length === 0}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export to Excel / CSV</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-[#0B0F19]/80 hover:bg-[#0B0F19] text-[#CBD5E1] hover:text-white border border-[#334155] transition-all flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4 text-slate-400" />
              <span className="hidden sm:inline">Print Report</span>
            </button>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-xl text-xs bg-[#0B0F19]/80 hover:bg-[#0B0F19] text-[#94A3B8] hover:text-white border border-[#334155] transition-all"
              title="Refresh Gradebook Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* 4 Stat Overview Tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-5">
          <div className="rounded-xl bg-[#0B0F19]/60 border border-[#334155]/60 p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Active Students</span>
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-extrabold text-white font-mono">
              {stats.total}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Enrolled across all trades</p>
          </div>

          <div className="rounded-xl bg-[#0B0F19]/60 border border-[#334155]/60 p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Class Composite Avg</span>
              <Sparkles className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-extrabold text-cyan-400 font-mono">
              {stats.classAvg.toFixed(1)}%
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Exams + Work + Syllabus</p>
          </div>

          <div className="rounded-xl bg-[#0B0F19]/60 border border-emerald-500/30 p-4">
            <div className="flex items-center justify-between text-emerald-400 text-xs mb-1">
              <span>Honor Roll</span>
              <Award className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-400 font-mono">
              {stats.honorCount}
            </div>
            <p className="text-[11px] text-emerald-400/70 mt-1">≥ 85% Score & Good Focus</p>
          </div>

          <div className="rounded-xl bg-[#0B0F19]/60 border border-rose-500/30 p-4">
            <div className="flex items-center justify-between text-rose-400 text-xs mb-1">
              <span>Intervention Needed</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-extrabold text-rose-400 font-mono">
              {stats.atRiskCount + stats.suspendedCount}
            </div>
            <p className="text-[11px] text-rose-400/70 mt-1">
              {stats.suspendedCount} Suspended • {stats.atRiskCount} At Risk
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="rounded-2xl border border-[#334155]/70 bg-[#1E293B]/75 backdrop-blur-xl p-4 shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Search student by name, username, trade, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[#334155]/80 bg-[#0B0F19]/70 py-2.5 pl-10 pr-4 text-xs text-white placeholder-[#64748B] focus:border-cyan-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Trade Filter */}
          <select
            value={selectedTrade}
            onChange={(e) => setSelectedTrade(e.target.value)}
            className="rounded-xl border border-[#334155]/80 bg-[#0B0F19]/70 py-2 px-3 text-xs text-white focus:border-cyan-400 focus:outline-none"
          >
            <option value="all">All Academic Trades</option>
            {trades.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Level Filter */}
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="rounded-xl border border-[#334155]/80 bg-[#0B0F19]/70 py-2 px-3 text-xs text-white focus:border-cyan-400 focus:outline-none"
          >
            <option value="all">All Levels</option>
            <option value="Level 3">Level 3</option>
            <option value="Level 4">Level 4</option>
            <option value="Level 5">Level 5</option>
          </select>

          {/* Standing Filter */}
          <select
            value={selectedStanding}
            onChange={(e) => setSelectedStanding(e.target.value)}
            className="rounded-xl border border-[#334155]/80 bg-[#0B0F19]/70 py-2 px-3 text-xs text-white focus:border-cyan-400 focus:outline-none"
          >
            <option value="all">All Standings</option>
            <option value="honor">🌟 Honor Roll Only</option>
            <option value="good">✅ In Good Standing</option>
            <option value="at_risk">⚠️ At Risk Only</option>
            <option value="critical_risk">🚨 Critical Warning</option>
            <option value="suspended">🛑 Suspended (10 Strikes)</option>
          </select>
        </div>
      </div>

      {/* Main Gradebook Spreadsheet Table */}
      <div className="rounded-2xl border border-[#334155]/70 bg-[#1E293B]/75 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#334155]/80 bg-[#0B0F19]/80 text-[#94A3B8] font-mono">
                <th className="py-3.5 px-4 cursor-pointer hover:text-white" onClick={() => toggleSort("name")}>
                  <div className="flex items-center gap-1.5">
                    <span>Student</span>
                    {sortField === "name" ? (sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-cyan-400" /> : <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                  </div>
                </th>
                <th className="py-3.5 px-4 cursor-pointer hover:text-white" onClick={() => toggleSort("trade")}>
                  <div className="flex items-center gap-1.5">
                    <span>Trade & Level</span>
                    {sortField === "trade" ? (sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-cyan-400" /> : <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                  </div>
                </th>
                <th className="py-3.5 px-4 cursor-pointer hover:text-white" onClick={() => toggleSort("strikes")}>
                  <div className="flex items-center gap-1.5">
                    <span>Discipline Focus</span>
                    {sortField === "strikes" ? (sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-cyan-400" /> : <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                  </div>
                </th>
                <th className="py-3.5 px-4 cursor-pointer hover:text-white" onClick={() => toggleSort("progress")}>
                  <div className="flex items-center gap-1.5">
                    <span>Syllabus Progress</span>
                    {sortField === "progress" ? (sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-cyan-400" /> : <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                  </div>
                </th>
                <th className="py-3.5 px-4 cursor-pointer hover:text-white" onClick={() => toggleSort("examAvg")}>
                  <div className="flex items-center gap-1.5">
                    <span>Exams</span>
                    {sortField === "examAvg" ? (sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-cyan-400" /> : <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                  </div>
                </th>
                <th className="py-3.5 px-4 cursor-pointer hover:text-white" onClick={() => toggleSort("assignAvg")}>
                  <div className="flex items-center gap-1.5">
                    <span>Assignments</span>
                    {sortField === "assignAvg" ? (sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-cyan-400" /> : <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                  </div>
                </th>
                <th className="py-3.5 px-4 cursor-pointer hover:text-white" onClick={() => toggleSort("composite")}>
                  <div className="flex items-center gap-1.5">
                    <span>Composite Grade</span>
                    {sortField === "composite" ? (sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-cyan-400" /> : <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                  </div>
                </th>
                <th className="py-3.5 px-4 text-center">Standing</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent mb-3" />
                      <span>Compiling Academic Master Gradebook...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-500">
                    <GraduationCap className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-semibold">No student records match the selected filters.</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const standingInfo = getStandingBadge(record.standing);
                  const isSuspended = record.standing === "suspended";
                  return (
                    <tr
                      key={record.studentUid}
                      className={`hover:bg-[#0B0F19]/40 transition-colors ${
                        isSuspended ? "bg-rose-950/10" : ""
                      }`}
                    >
                      {/* 1. Student Name & Profile */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center font-bold text-cyan-300 text-xs shrink-0">
                            {record.studentName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate max-w-[160px]">
                              {record.studentName}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                              @{record.username} • {record.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Trade & Level */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-200 truncate max-w-[140px]">
                          {record.tradeName}
                        </div>
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                          {record.level}
                        </span>
                      </td>

                      {/* 3. Discipline / Inattention Strikes */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden shrink-0">
                            <div
                              className={`h-full ${
                                (record.unfocusedCount || 0) >= 10
                                  ? "bg-rose-500"
                                  : (record.unfocusedCount || 0) >= 5
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                              }`}
                              style={{ width: `${Math.min(((record.unfocusedCount || 0) / 10) * 100, 100)}%` }}
                            />
                          </div>
                          <span
                            className={`font-mono text-xs font-bold ${
                              (record.unfocusedCount || 0) >= 10
                                ? "text-rose-400"
                                : (record.unfocusedCount || 0) >= 5
                                ? "text-amber-400"
                                : "text-slate-400"
                            }`}
                          >
                            {record.unfocusedCount || 0}/10
                          </span>
                        </div>
                      </td>

                      {/* 4. Syllabus Progress */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden shrink-0">
                            <div
                              className="h-full bg-cyan-400 rounded-full"
                              style={{ width: `${Math.min(record.syllabusProgressPct, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs font-bold text-cyan-300">
                            {record.syllabusProgressPct.toFixed(0)}%
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          {record.completedSubtopics}/{record.totalSubtopics} topics
                        </span>
                      </td>

                      {/* 5. Exams Avg */}
                      <td className="py-3 px-4">
                        {record.examsTotalCount > 0 ? (
                          <div>
                            <span className="font-mono font-bold text-white">
                              {record.examAvg.toFixed(1)}%
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              {record.examsPassedCount}/{record.examsTotalCount} passed
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 font-mono text-[11px]">No attempts</span>
                        )}
                      </td>

                      {/* 6. Assignments Avg */}
                      <td className="py-3 px-4">
                        {record.assignmentsSubmittedCount > 0 ? (
                          <div>
                            <span className="font-mono font-bold text-white">
                              {record.assignmentAvg.toFixed(1)}%
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              {record.assignmentsGradedCount}/{record.assignmentsSubmittedCount} graded
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 font-mono text-[11px]">No tasks</span>
                        )}
                      </td>

                      {/* 7. Composite Grade & Score */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-7 h-7 rounded-lg font-bold flex items-center justify-center text-xs border ${getGradeColor(
                              record.letterGrade
                            )}`}
                          >
                            {record.letterGrade}
                          </span>
                          <span className="font-mono font-extrabold text-white text-sm">
                            {record.compositeScore.toFixed(1)}%
                          </span>
                        </div>
                      </td>

                      {/* 8. Standing Badge */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${standingInfo.badge}`}
                        >
                          {standingInfo.icon}
                          <span>{standingInfo.label}</span>
                        </span>
                      </td>

                      {/* 9. Action Buttons */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedStudent(record)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-all inline-flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Transcript</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="p-4 border-t border-[#334155]/80 bg-[#0B0F19]/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#94A3B8]">
          <span>
            Showing <strong className="text-white">{filteredRecords.length}</strong> of {stats.total} total students
          </span>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span>Honor Roll (≥85%)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>At Risk (&lt;60%)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <span>Suspended (10 Strikes)</span>
            </span>
          </div>
        </div>
      </div>

      {/* INDIVIDUAL STUDENT TRANSCRIPT & SCORECARD MODAL */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-left">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-start justify-between bg-slate-950/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center font-bold text-cyan-300 text-lg">
                  {selectedStudent.studentName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{selectedStudent.studentName}</h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold border ${getStandingBadge(
                        selectedStudent.standing
                      ).badge}`}
                    >
                      {getStandingBadge(selectedStudent.standing).label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    @{selectedStudent.username} • {selectedStudent.email} • {selectedStudent.level} • {selectedStudent.tradeName}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Performance Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
                  <span className="text-[11px] text-slate-400 block mb-1">Composite Score</span>
                  <div className="text-xl font-bold font-mono text-cyan-400">
                    {selectedStudent.compositeScore.toFixed(1)}% ({selectedStudent.letterGrade})
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
                  <span className="text-[11px] text-slate-400 block mb-1">Exam Average</span>
                  <div className="text-xl font-bold font-mono text-white">
                    {selectedStudent.examsTotalCount > 0 ? `${selectedStudent.examAvg.toFixed(1)}%` : "N/A"}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
                  <span className="text-[11px] text-slate-400 block mb-1">Assignment Avg</span>
                  <div className="text-xl font-bold font-mono text-white">
                    {selectedStudent.assignmentsSubmittedCount > 0 ? `${selectedStudent.assignmentAvg.toFixed(1)}%` : "N/A"}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
                  <span className="text-[11px] text-slate-400 block mb-1">Syllabus Progress</span>
                  <div className="text-xl font-bold font-mono text-white">
                    {selectedStudent.syllabusProgressPct.toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Discipline Focus & Reset Strikes */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Classroom Attention & Window-Focus Standing
                  </h4>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-base font-extrabold font-mono ${
                        (selectedStudent.unfocusedCount || 0) >= 10
                          ? "text-rose-400"
                          : (selectedStudent.unfocusedCount || 0) >= 5
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {selectedStudent.unfocusedCount || 0} of 10 Inattention Strikes
                    </span>
                    {(selectedStudent.unfocusedCount || 0) >= 10 && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        Account Suspended
                      </span>
                    )}
                  </div>
                </div>

                {(selectedStudent.unfocusedCount || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => handleResetStrikes(selectedStudent.studentUid)}
                    disabled={resettingStrikesUid === selectedStudent.studentUid}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>
                      {resettingStrikesUid === selectedStudent.studentUid ? "Resetting..." : "Pardon & Reset Strikes"}
                    </span>
                  </button>
                )}
              </div>

              {/* Exam Attempts List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-cyan-400" />
                    <span>Exam Attempts ({selectedStudent.examAttempts.length})</span>
                  </h4>
                  <span className="text-xs text-slate-400">
                    {selectedStudent.examsPassedCount} passed
                  </span>
                </div>

                {selectedStudent.examAttempts.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-500 text-center">
                    No formal exams attempted yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedStudent.examAttempts.map((attempt) => (
                      <div
                        key={attempt.id}
                        className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-white">{attempt.examTitle}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {attempt.courseCode} • Submitted {new Date(attempt.submittedAt || attempt.startedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`font-mono font-bold text-sm ${
                              (attempt.percentage || 0) >= 60 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {(attempt.percentage !== undefined ? attempt.percentage : ((attempt.score || 0) / (attempt.maxScore || 100)) * 100).toFixed(1)}%
                          </span>
                          <span className="block text-[10px] text-slate-500 font-mono">
                            {attempt.score || 0} / {attempt.maxScore} pts
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assignment Submissions List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <span>Course Assignment Submissions ({selectedStudent.assignmentSubmissions.length})</span>
                  </h4>
                  <span className="text-xs text-slate-400">
                    {selectedStudent.assignmentsGradedCount} graded
                  </span>
                </div>

                {selectedStudent.assignmentSubmissions.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-500 text-center">
                    No course assignments submitted yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedStudent.assignmentSubmissions.map((sub) => (
                      <div
                        key={sub.id}
                        className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-white">
                            {sub.submissionTitle || sub.courseTitle || sub.courseCode}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {sub.courseCode} • Status: <span className="capitalize text-slate-300">{sub.status}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          {sub.status === "graded" && sub.score !== undefined ? (
                            <>
                              <span className="font-mono font-bold text-sm text-cyan-400">
                                {(((sub.score || 0) / (sub.maxScore || 100)) * 100).toFixed(1)}%
                              </span>
                              <span className="block text-[10px] text-slate-500 font-mono">
                                {sub.score} / {sub.maxScore} pts
                              </span>
                            </>
                          ) : (
                            <span className="text-[11px] font-mono text-amber-400">Pending Grading</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
              >
                Close Transcript
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
