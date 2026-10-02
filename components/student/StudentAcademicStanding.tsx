"use client";

import React, { useState, useEffect } from "react";
import { UserProfile } from "@/types/auth";
import { Syllabus } from "@/types/syllabus";
import { ExamAttempt } from "@/types/exam";
import { 
  getStudentGroupEvaluations, 
  getStudentExamAttempts, 
  getStudentSubmissions,
  getSubtopicProgressAsync 
} from "@/lib/db";
import { 
  Award, 
  FileQuestion, 
  Layers, 
  CheckCircle2, 
  TrendingUp, 
  Sparkles, 
  BookOpen, 
  GraduationCap,
  ChevronRight,
  FileText,
  Printer,
  X
} from "lucide-react";

interface StudentAcademicStandingProps {
  currentUser: UserProfile;
  syllabi: Syllabus[];
  onTabChange?: (tab: "courses" | "assignments" | "groups" | "exams") => void;
}

export default function StudentAcademicStanding({
  currentUser,
  syllabi,
  onTabChange
}: StudentAcademicStandingProps) {
  const [loading, setLoading] = useState(true);
  const [presentationAvg, setPresentationAvg] = useState<number | null>(null);
  const [examAvg, setExamAvg] = useState<number | null>(null);
  const [completedSubtopicsCount, setCompletedSubtopicsCount] = useState(0);
  const [totalSubtopicsCount, setTotalSubtopicsCount] = useState(0);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [showReportCard, setShowReportCard] = useState(false);

  useEffect(() => {
    async function loadStats() {
      if (!currentUser?.uid) return;
      try {
        // 1. Evaluations & presentations
        const evals = await getStudentGroupEvaluations(currentUser.uid);
        if (evals.length > 0) {
          const myScores = evals
            .map((e) => e.members?.[currentUser.uid]?.finalScore)
            .filter((s): s is number => typeof s === "number");
          if (myScores.length > 0) {
            const sum = myScores.reduce((a, b) => a + b, 0);
            setPresentationAvg(Math.round((sum / myScores.length) * 10) / 10);
          }
        }

        // 2. Exam attempts
        const attempts = await getStudentExamAttempts(currentUser.uid);
        if (attempts.length > 0) {
          const completedAttempts = attempts.filter((a: ExamAttempt) => a.status === "graded" || a.status === "submitted");
          if (completedAttempts.length > 0) {
            const sum = completedAttempts.reduce((acc: number, b: ExamAttempt) => acc + (b.percentage || 0), 0);
            setExamAvg(Math.round((sum / completedAttempts.length) * 10) / 10);
          }
        }

        // 3. Subtopic progress
        const relevantSyllabi = syllabi.filter(
          (s) => !s.level || s.level === currentUser.level
        );
        let totalSub = 0;
        relevantSyllabi.forEach((s) => {
          s.learningOutcomes?.forEach((lo) => {
            lo.indicativeContents?.forEach((ic) => {
              ic.topics?.forEach((top) => {
                totalSub += top.subtopics?.length || 0;
              });
            });
          });
        });
        setTotalSubtopicsCount(totalSub);

        const progMap = await getSubtopicProgressAsync(currentUser.uid);
        const completed = Object.values(progMap).filter(Boolean).length;
        setCompletedSubtopicsCount(completed);

        // 4. Assignments
        const subs = await getStudentSubmissions(currentUser.uid);
        setSubmissionCount(subs.length);
      } catch (err) {
        console.error("Error loading academic standing:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [currentUser?.uid, syllabi]);

  // Weighted Academic Grade
  const progressPercent = totalSubtopicsCount > 0 
    ? Math.min(100, Math.round((completedSubtopicsCount / totalSubtopicsCount) * 100)) 
    : 0;

  // Compute composite score
  const validWeights: { score: number; weight: number }[] = [];
  if (examAvg !== null) validWeights.push({ score: examAvg, weight: 0.4 });
  if (presentationAvg !== null) validWeights.push({ score: presentationAvg, weight: 0.35 });
  if (progressPercent > 0) validWeights.push({ score: progressPercent, weight: 0.25 });

  let cumulativeGrade: number | null = null;
  if (validWeights.length > 0) {
    const totalWeight = validWeights.reduce((acc, v) => acc + v.weight, 0);
    const weightedSum = validWeights.reduce((acc, v) => acc + (v.score * v.weight), 0);
    cumulativeGrade = Math.round((weightedSum / totalWeight) * 10) / 10;
  }

  // Academic standing label
  const getStandingBadge = (score: number | null) => {
    if (score === null) return { label: "Orientation Phase", color: "bg-slate-500/20 text-slate-300 border-slate-500/30" };
    if (score >= 85) return { label: "First Class / High Distinction", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" };
    if (score >= 75) return { label: "Distinction Standing", color: "bg-teal-500/20 text-teal-300 border-teal-500/40" };
    if (score >= 60) return { label: "Good Academic Standing", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" };
    if (score >= 50) return { label: "Satisfactory Pass", color: "bg-amber-500/20 text-amber-300 border-amber-500/40" };
    return { label: "Academic Support Required", color: "bg-rose-500/20 text-rose-300 border-rose-500/40" };
  };

  const standing = getStandingBadge(cumulativeGrade);

  if (loading) return null;

  return (
    <>
      <div className="rounded-3xl border border-cyan-500/30 bg-[#1E293B]/75 backdrop-blur-xl p-5 sm:p-6 shadow-2xl relative overflow-hidden mb-6">
        {/* Background ambient glow */}
        <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#334155]/60 pb-4 mb-5">
          <div className="flex items-center space-x-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 text-cyan-400">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-extrabold text-white">
                  Academic Standing &amp; Performance
                </h3>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${standing.color}`}>
                  {standing.label}
                </span>
              </div>
              <p className="text-xs text-[#94A3B8]">
                {currentUser.fullName} • {currentUser.level} Class Cohort
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {cumulativeGrade !== null && (
              <div className="flex items-center space-x-2 bg-[#0B0F19]/50 backdrop-blur-md border border-cyan-500/30 rounded-2xl px-4 py-2">
                <span className="text-[11px] text-[#94A3B8] font-semibold">Cumulative Grade:</span>
                <span className="text-xl font-black font-mono text-cyan-300">
                  {cumulativeGrade}%
                </span>
              </div>
            )}

            <button
              onClick={() => setShowReportCard(true)}
              className="inline-flex items-center space-x-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 text-xs font-mono font-bold text-cyan-300 hover:bg-cyan-500/20 transition-all shadow-sm"
              title="View & Print Official Academic Transcript"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Report Card</span>
            </button>
          </div>
        </div>

        {/* 4 Performance Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {/* Metric 1: Course Progress */}
          <div 
            onClick={() => onTabChange?.("courses")}
            className="rounded-2xl border border-[#334155]/70 bg-[#0B0F19]/50 backdrop-blur-md p-3.5 hover:border-cyan-500/40 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-[#94A3B8] mb-1.5">
              <span className="text-[11px] font-bold">Curriculum Topics</span>
              <BookOpen className="h-4 w-4 text-cyan-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-white mb-1">
              {progressPercent}%
            </div>
            <div className="w-full bg-[#1E293B] h-1.5 rounded-full overflow-hidden mb-1.5">
              <div 
                className="bg-cyan-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${progressPercent}%` }} 
              />
            </div>
            <span className="text-[10px] text-[#64748B] block truncate">
              {completedSubtopicsCount} of {totalSubtopicsCount} topics read
            </span>
          </div>

          {/* Metric 2: Exam Average */}
          <div 
            onClick={() => onTabChange?.("exams")}
            className="rounded-2xl border border-[#334155]/70 bg-[#0B0F19]/50 backdrop-blur-md p-3.5 hover:border-purple-500/40 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-[#94A3B8] mb-1.5">
              <span className="text-[11px] font-bold">Exam Average</span>
              <FileQuestion className="h-4 w-4 text-purple-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-purple-300 mb-1">
              {examAvg !== null ? `${examAvg}%` : "—"}
            </div>
            <div className="w-full bg-[#1E293B] h-1.5 rounded-full overflow-hidden mb-1.5">
              <div 
                className="bg-purple-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${examAvg || 0}%` }} 
              />
            </div>
            <span className="text-[10px] text-[#64748B] block truncate">
              {examAvg !== null ? "Quizzes & official assessments" : "No exam attempts yet"}
            </span>
          </div>

          {/* Metric 3: Group Presentation Defense */}
          <div 
            onClick={() => onTabChange?.("groups")}
            className="rounded-2xl border border-[#334155]/70 bg-[#0B0F19]/50 backdrop-blur-md p-3.5 hover:border-emerald-500/40 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-[#94A3B8] mb-1.5">
              <span className="text-[11px] font-bold">Live Defense</span>
              <Award className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-300 mb-1">
              {presentationAvg !== null ? `${presentationAvg}%` : "—"}
            </div>
            <div className="w-full bg-[#1E293B] h-1.5 rounded-full overflow-hidden mb-1.5">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${presentationAvg || 0}%` }} 
              />
            </div>
            <span className="text-[10px] text-[#64748B] block truncate">
              {presentationAvg !== null ? "PowerPoint & slide defense" : "Pending class presentation"}
            </span>
          </div>

          {/* Metric 4: Assignments Submitted */}
          <div 
            onClick={() => onTabChange?.("assignments")}
            className="rounded-2xl border border-[#334155]/70 bg-[#0B0F19]/50 backdrop-blur-md p-3.5 hover:border-amber-500/40 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-[#94A3B8] mb-1.5">
              <span className="text-[11px] font-bold">Assignments</span>
              <Layers className="h-4 w-4 text-amber-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-amber-300 mb-1">
              {submissionCount}
            </div>
            <div className="w-full bg-[#1E293B] h-1.5 rounded-full overflow-hidden mb-1.5">
              <div 
                className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, submissionCount * 25)}%` }} 
              />
            </div>
            <span className="text-[10px] text-[#64748B] block truncate">
              Completed deliverables
            </span>
          </div>
        </div>
      </div>

      {/* Official Academic Report Card Modal */}
      {showReportCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-6 backdrop-blur-md animate-in fade-in">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-[#334155] bg-[#0F172A] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-[#334155] px-6 py-4 bg-[#1E293B]/70 shrink-0">
              <div className="flex items-center space-x-2.5">
                <GraduationCap className="h-5 w-5 text-cyan-400" />
                <h3 className="text-sm font-extrabold text-white">
                  Official Academic Transcript &amp; Performance Summary
                </h3>
              </div>
              <button
                onClick={() => setShowReportCard(false)}
                className="rounded-xl p-1.5 text-[#94A3B8] hover:text-white hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
              {/* Report Header */}
              <div className="border-b border-[#334155] pb-5 text-center space-y-2">
                <div className="inline-flex items-center space-x-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 text-[11px] font-mono font-bold text-cyan-300">
                  <Sparkles className="h-3 w-3" />
                  <span>Syllabus Engine Academic Record</span>
                </div>
                <h2 className="text-2xl font-black text-white">{currentUser.fullName}</h2>
                <p className="text-xs text-[#94A3B8] font-mono">
                  Username: <span className="text-white">@{currentUser.username}</span> &bull; Level: <span className="text-cyan-400 font-bold">{currentUser.level}</span>
                </p>
                <div className="pt-2">
                  <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${standing.color}`}>
                    Standing: {standing.label}
                  </span>
                </div>
              </div>

              {/* Composite Grade Highlight */}
              <div className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 p-5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono uppercase text-cyan-300 font-bold">Cumulative Weighted Score</div>
                  <div className="text-[11px] text-[#94A3B8] mt-0.5">Based on Exams (40%), Oral Defense (35%), Syllabus (25%)</div>
                </div>
                <div className="text-3xl font-black font-mono text-cyan-300">
                  {cumulativeGrade !== null ? `${cumulativeGrade}%` : "N/A"}
                </div>
              </div>

              {/* Assessment Breakdown Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold font-mono text-[#CBD5E1] uppercase tracking-wider">Evaluation Pillar Breakdown</h4>
                <div className="rounded-2xl border border-[#334155] bg-[#1E293B] overflow-hidden divide-y divide-[#334155]">
                  <div className="p-3.5 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <BookOpen className="h-4 w-4 text-cyan-400" />
                      <span className="text-white font-medium">Curriculum Topics Completed</span>
                    </div>
                    <span className="font-mono font-bold text-cyan-300">{progressPercent}% ({completedSubtopicsCount}/{totalSubtopicsCount})</span>
                  </div>

                  <div className="p-3.5 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <FileQuestion className="h-4 w-4 text-purple-400" />
                      <span className="text-white font-medium">Examinations &amp; Quizzes Average</span>
                    </div>
                    <span className="font-mono font-bold text-purple-300">{examAvg !== null ? `${examAvg}%` : "Not Attempted"}</span>
                  </div>

                  <div className="p-3.5 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <Award className="h-4 w-4 text-emerald-400" />
                      <span className="text-white font-medium">Group Presentation &amp; Defense Score</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-300">{presentationAvg !== null ? `${presentationAvg}%` : "Pending Defense"}</span>
                  </div>

                  <div className="p-3.5 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <Layers className="h-4 w-4 text-amber-400" />
                      <span className="text-white font-medium">Coursework Assignments Submitted</span>
                    </div>
                    <span className="font-mono font-bold text-amber-300">{submissionCount} deliverables</span>
                  </div>
                </div>
              </div>

              {/* Footer Note */}
              <p className="text-[10px] text-center text-[#64748B] font-mono">
                Record generated on {new Date().toLocaleDateString(undefined, { dateStyle: 'full' })} &bull; Official Digital Verification Token: {currentUser.uid.slice(0, 10).toUpperCase()}
              </p>
            </div>

            <div className="flex justify-between border-t border-[#334155] px-6 py-4 bg-[#1E293B]/70 shrink-0">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center space-x-1.5 rounded-xl border border-[#334155] bg-slate-800 px-4 py-2 text-xs font-mono font-bold text-white hover:bg-slate-700 transition-all"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Transcript</span>
              </button>

              <button
                onClick={() => setShowReportCard(false)}
                className="rounded-xl bg-[#06B6D4] px-6 py-2 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
