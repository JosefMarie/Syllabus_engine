"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Assignment, AssignmentSubmission } from "@/types/assignment";
import { StudentGroup } from "@/types/group";
import { UserProfile } from "@/types/auth";
import { Syllabus } from "@/types/syllabus";
import {
  getAllAssignments,
  getLocalAssignments,
  mergeAssignmentsLists,
  getStudentSubmissions,
  saveAssignmentSubmission,
  getStudentGroups,
  subscribeToAssignments,
  subscribeToSubmissions,
  subscribeToGroups
} from "@/lib/db";
import { isAllowedSubmissionFile, ACCEPT_FILE_ATTRIBUTE } from "@/lib/aiGrading";
import { 
  FileText, 
  Upload, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Award, 
  X, 
  AlertCircle, 
  FileCheck, 
  Send, 
  Sparkles, 
  ChevronRight, 
  PlusCircle, 
  BookOpen,
  Users,
  RefreshCw,
  Lock,
  BarChart3
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Parse YYYY-MM-DD due dates as 23:59:59.999 local time on that date so assignments remain open through the entire due date
export function getAssignmentDeadlineDate(dueDateStr?: string): Date | null {
  if (!dueDateStr) return null;
  const trimmed = dueDateStr.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59, 999);
  }
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function isAssignmentPastDue(dueDateStr?: string): boolean {
  const deadline = getAssignmentDeadlineDate(dueDateStr);
  if (!deadline) return false;
  return Date.now() > deadline.getTime();
}

export function formatAssignmentDueDate(dueDateStr?: string): string {
  const deadline = getAssignmentDeadlineDate(dueDateStr);
  if (!deadline) return "";
  return deadline.toLocaleDateString();
}

interface StudentAssignmentsViewProps {
  currentUser: UserProfile;
  syllabi?: Syllabus[];
}

export default function StudentAssignmentsView({ currentUser, syllabi = [] }: StudentAssignmentsViewProps) {
  const [rawAssignments, setRawAssignments] = useState<Assignment[]>(() => getLocalAssignments());
  const [submissions, setSubmissions] = useState<Record<string, AssignmentSubmission>>({});
  const [independentSubmissions, setIndependentSubmissions] = useState<AssignmentSubmission[]>([]);
  const [myGroups, setMyGroups] = useState<StudentGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(() => getLocalAssignments().length === 0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>("my_level");
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>("all");

  // Modal for teacher-assigned assignment
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);

  // Modal for student self-initiated course assignment submission
  const [isSelfSubmitModalOpen, setIsSelfSubmitModalOpen] = useState(false);
  const [selectedCourseCode, setSelectedCourseCode] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customMarkdown, setCustomMarkdown] = useState("");
  const [customFile, setCustomFile] = useState<{
    name: string;
    base64Url?: string;
    size: number;
    type: string;
  } | null>(null);
  const [submittingSelf, setSubmittingSelf] = useState(false);
  const [selfSubmitSuccess, setSelfSubmitSuccess] = useState(false);

  // Modal for viewing an independent submission details
  const [viewingSubmission, setViewingSubmission] = useState<AssignmentSubmission | null>(null);

  // Form State for teacher-assigned modal
  const [textAnswer, setTextAnswer] = useState("");
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    base64Url?: string;
    size: number;
    type: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Group for the currently active assignment if it is a group project
  const activeMatchedGroup = activeAssignment?.submissionType === "group"
    ? (activeAssignment.targetGroupId && activeAssignment.targetGroupId !== "all_groups"
        ? (myGroups.find(g => g.id === activeAssignment.targetGroupId) || null)
        : (myGroups.length > 0 ? myGroups[0] : null))
    : null;

  // Helper functions for matching target cohorts and aliases
  const isTradeMatch = (targetTradeId?: string, studentTradeId?: string) => {
    if (!targetTradeId || targetTradeId === "all") return true;
    if (!studentTradeId || studentTradeId === "all") return true;
    if (targetTradeId === studentTradeId) return true;
    // Match software engineering & software development aliases
    const isSoftware1 = targetTradeId === "trade-sw-eng" || targetTradeId === "trade-1785861602651";
    const isSoftware2 = studentTradeId === "trade-sw-eng" || studentTradeId === "trade-1785861602651";
    if (isSoftware1 && isSoftware2) return true;
    return false;
  };

  const isLevelMatch = (targetLevel?: string, studentLevel?: string) => {
    if (!targetLevel || targetLevel === "all") return true;
    if (!studentLevel || studentLevel === "all") return true;
    return targetLevel.toLowerCase().trim() === studentLevel.toLowerCase().trim();
  };

  // Available courses filtered by student level/trade
  const studentCourses = syllabi.filter(s => {
    const matchesLevel = isLevelMatch(s.level, currentUser.level);
    const matchesTrade = isTradeMatch(s.tradeId, currentUser.tradeId);
    return matchesLevel && matchesTrade;
  });

  // Compute assignments matching trade & group membership first
  const tradeAndGroupMatchedAssignments = useMemo(() => {
    return rawAssignments.filter(a => {
      if (a.status && a.status !== "published") return false;
      const matchesTrade = isTradeMatch(a.tradeId, currentUser.tradeId);
      if (!matchesTrade) return false;

      // If targeted to a specific group, only members of that group receive this assignment
      if (a.submissionType === "group" && a.targetGroupId && a.targetGroupId !== "all_groups") {
        const isMemberOfGroup = myGroups.some(g => g.id === a.targetGroupId);
        if (!isMemberOfGroup) return false;
      }

      return true;
    });
  }, [rawAssignments, myGroups, currentUser.tradeId]);

  // Assignments strictly matching the student's profile level
  const myLevelAssignments = useMemo(() => {
    return tradeAndGroupMatchedAssignments.filter(a => isLevelMatch(a.level, currentUser.level));
  }, [tradeAndGroupMatchedAssignments, currentUser.level]);

  // If the student's registered level has 0 assignments (e.g. they registered with default "Level 3"),
  // automatically show all published assignments across levels so they are never stuck seeing 0 tasks.
  const effectiveLevelFilter =
    selectedLevelFilter === "my_level" && myLevelAssignments.length === 0 && tradeAndGroupMatchedAssignments.length > 0
      ? "all"
      : selectedLevelFilter;

  const levelMatchedAssignments = useMemo(() => {
    if (effectiveLevelFilter === "all") {
      return tradeAndGroupMatchedAssignments;
    }
    if (effectiveLevelFilter === "my_level") {
      return myLevelAssignments;
    }
    return tradeAndGroupMatchedAssignments.filter(a => isLevelMatch(a.level, effectiveLevelFilter));
  }, [tradeAndGroupMatchedAssignments, myLevelAssignments, effectiveLevelFilter]);

  const assignments = useMemo(() => {
    if (selectedSubjectFilter === "all") return levelMatchedAssignments;
    return levelMatchedAssignments.filter(a => (a.courseCode || "General") === selectedSubjectFilter);
  }, [levelMatchedAssignments, selectedSubjectFilter]);

  // Compute distinct subjects across assignments & student submissions, plus per-subject marks summary
  const subjectMarksSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        courseCode: string;
        courseTitle: string;
        gradedItems: {
          id: string;
          title: string;
          score: number;
          maxScore: number;
          pct: number;
          feedback?: string;
          submittedAt?: string;
          isIndependent?: boolean;
          assignment?: Assignment;
          submission: AssignmentSubmission;
        }[];
        pendingCount: number;
        earnedPoints: number;
        possiblePoints: number;
      }
    >();

    const ensureSubject = (codeRaw?: string, titleRaw?: string) => {
      const code = (codeRaw || "General").trim() || "General";
      if (!map.has(code)) {
        const matchedSyl = syllabi.find(s => s.courseCode === code);
        map.set(code, {
          courseCode: code,
          courseTitle: matchedSyl?.title || titleRaw || code,
          gradedItems: [],
          pendingCount: 0,
          earnedPoints: 0,
          possiblePoints: 0
        });
      }
      return map.get(code)!;
    };

    // Include official assignments and their submissions
    Object.values(submissions).forEach(sub => {
      const matchedAsg = rawAssignments.find(a => a.id === sub.assignmentId);
      const entry = ensureSubject(sub.courseCode || matchedAsg?.courseCode, sub.courseTitle || matchedAsg?.courseTitle);
      if (sub.status === "graded" && typeof sub.score === "number") {
        const max = sub.maxScore || matchedAsg?.totalPoints || 100;
        const pct = max > 0 ? Math.round((sub.score / max) * 100) : 0;
        entry.gradedItems.push({
          id: sub.id,
          title: sub.submissionTitle || matchedAsg?.title || "Assignment",
          score: sub.score,
          maxScore: max,
          pct,
          feedback: sub.feedback,
          submittedAt: sub.submittedAt,
          isIndependent: false,
          assignment: matchedAsg,
          submission: sub
        });
        entry.earnedPoints += sub.score;
        entry.possiblePoints += max;
      } else {
        entry.pendingCount += 1;
      }
    });

    // Include independent course submissions
    independentSubmissions.forEach(sub => {
      const entry = ensureSubject(sub.courseCode, sub.courseTitle);
      if (sub.status === "graded" && typeof sub.score === "number") {
        const max = sub.maxScore || 100;
        const pct = max > 0 ? Math.round((sub.score / max) * 100) : 0;
        entry.gradedItems.push({
          id: sub.id,
          title: sub.submissionTitle || "Course Work",
          score: sub.score,
          maxScore: max,
          pct,
          feedback: sub.feedback,
          submittedAt: sub.submittedAt,
          isIndependent: true,
          submission: sub
        });
        entry.earnedPoints += sub.score;
        entry.possiblePoints += max;
      } else {
        entry.pendingCount += 1;
      }
    });

    return Array.from(map.values()).filter(
      item => item.gradedItems.length > 0 || item.pendingCount > 0
    );
  }, [submissions, independentSubmissions, rawAssignments, syllabi]);

  // Subject options for the filter dropdown
  const availableSubjectCodes = useMemo(() => {
    const codes = new Set<string>();
    levelMatchedAssignments.forEach(a => codes.add((a.courseCode || "General").trim() || "General"));
    Object.values(submissions).forEach(s => {
      if (s.courseCode) codes.add(s.courseCode.trim());
    });
    return Array.from(codes);
  }, [levelMatchedAssignments, submissions]);

  useEffect(() => {
    let isMounted = true;

    const unsubAsg = subscribeToAssignments((allAsg) => {
      if (isMounted) {
        setRawAssignments(prev => mergeAssignmentsLists(prev, allAsg));
        setLoading(false);
      }
    });

    const unsubSubs = subscribeToSubmissions((allSubs) => {
      if (isMounted && currentUser?.uid) {
        const mySubs = allSubs.filter(s => s.studentUid === currentUser.uid);
        const subMap: Record<string, AssignmentSubmission> = {};
        const indep: AssignmentSubmission[] = [];
        mySubs.forEach(s => {
          if (s.isIndependentSubmission || s.assignmentId.startsWith("indep_") || s.assignmentId === "independent") {
            indep.push(s);
          } else {
            subMap[s.assignmentId] = s;
          }
        });
        setSubmissions(subMap);
        setIndependentSubmissions(indep);
      }
    });

    const unsubGroups = subscribeToGroups((allGroups) => {
      if (isMounted) {
        const studentGroups = allGroups.filter(
          g => g.members && g.members.some(m => m.uid === currentUser.uid)
        );
        setMyGroups(studentGroups);
      }
    });

    loadData(true);

    return () => {
      isMounted = false;
      unsubAsg();
      unsubSubs();
      unsubGroups();
    };
  }, [currentUser?.uid, currentUser?.level, currentUser?.tradeId]);

  const loadData = async (isInitial: boolean = false) => {
    if (isInitial && rawAssignments.length === 0) {
      setLoading(true);
    } else if (!isInitial) {
      setIsSyncing(true);
    }
    try {
      const [allAsg, studentSubs, groupsData] = await Promise.all([
        getAllAssignments(),
        getStudentSubmissions(currentUser.uid),
        getStudentGroups(currentUser.uid)
      ]);

      setRawAssignments(prev => mergeAssignmentsLists(prev, allAsg));
      if (groupsData.length > 0) {
        setMyGroups(groupsData);
      }

      const subMap: Record<string, AssignmentSubmission> = {};
      const indep: AssignmentSubmission[] = [];

      studentSubs.forEach(s => {
        if (s.isIndependentSubmission || s.assignmentId.startsWith("indep_") || s.assignmentId === "independent") {
          indep.push(s);
        } else {
          subMap[s.assignmentId] = s;
        }
      });

      setSubmissions(subMap);
      setIndependentSubmissions(indep);
      return groupsData;
    } catch (err) {
      console.error("Error loading student assignments:", err);
      return [];
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  };

  const handleOpenAssignment = (asg: Assignment) => {
    setActiveAssignment(asg);
    const existing = submissions[asg.id];
    if (existing) {
      setTextAnswer(existing.contentMarkdown || "");
      setSelectedFile(existing.fileData || null);
    } else {
      setTextAnswer("");
      setSelectedFile(null);
    }
    setSubmitSuccess(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isSelf: boolean = false) => {
    if (typeof window !== "undefined") {
      setTimeout(() => {
        (window as any).__SYLLABUS_FILE_PICKER_ACTIVE = false;
        (window as any).__SYLLABUS_FILE_PICKER_TIMESTAMP = 0;
      }, 1000);
    }
    const file = e.target.files?.[0];
    if (!file) return;

    const formatCheck = isAllowedSubmissionFile(file.name);
    if (!formatCheck.allowed) {
      alert(formatCheck.reason);
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("File size exceeds 5MB limit. Please attach a smaller file.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const fileData = {
        name: file.name,
        base64Url: reader.result as string,
        size: file.size,
        type: file.type || "application/octet-stream"
      };
      if (isSelf) {
        setCustomFile(fileData);
      } else {
        setSelectedFile(fileData);
      }
    };
    reader.readAsDataURL(file);
  };

  // Submit to an official teacher-assigned task
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssignment) return;

    // 1. Block re-submission or editing if already submitted or graded
    if (submissions[activeAssignment.id]) {
      alert("You have already submitted this assignment. Once submitted, answers are locked for grading and cannot be modified or re-submitted.");
      return;
    }

    // 2. Block submission if the assignment due date has passed
    if (isAssignmentPastDue(activeAssignment.dueDate)) {
      alert(`Submission Closed: The due date (${formatAssignmentDueDate(activeAssignment.dueDate)}) has passed. Late submissions are not permitted.`);
      return;
    }

    if (!textAnswer.trim() && !selectedFile) {
      alert("Please provide a text answer or attach a file.");
      return;
    }

    const isGroupProject = activeAssignment.submissionType === "group";
    const matchedGroup = isGroupProject 
      ? (activeAssignment.targetGroupId && activeAssignment.targetGroupId !== "all_groups"
          ? (myGroups.find(g => g.id === activeAssignment.targetGroupId) || null)
          : (myGroups.length > 0 ? myGroups[0] : null))
      : null;

    if (isGroupProject && !matchedGroup) {
      alert(`This is a Group Project. You must join or create your class group first before submitting work!`);
      return;
    }

    setSubmitting(true);
    try {
      const submissionId = `${activeAssignment.id}_${currentUser.uid}`;
      const submission: AssignmentSubmission = {
        id: submissionId,
        assignmentId: activeAssignment.id,
        courseCode: activeAssignment.courseCode || "",
        courseTitle: activeAssignment.courseTitle || "",
        submissionTitle: activeAssignment.title,
        isIndependentSubmission: false,
        studentUid: currentUser.uid,
        studentName: currentUser.fullName,
        studentUsername: currentUser.username,
        tradeId: currentUser.tradeId,
        level: currentUser.level,
        contentMarkdown: textAnswer.trim(),
        fileData: selectedFile || undefined,
        status: "submitted",
        maxScore: activeAssignment.totalPoints,
        submissionType: isGroupProject ? "group" : "individual",
        groupId: matchedGroup ? matchedGroup.id : undefined,
        groupName: matchedGroup ? matchedGroup.name : undefined,
        groupMembers: matchedGroup ? matchedGroup.members.map(m => ({ uid: m.uid, fullName: m.fullName, username: m.username })) : undefined,
        submittedByUid: currentUser.uid,
        submittedByName: currentUser.fullName,
        submittedAt: new Date().toISOString()
      };

      await saveAssignmentSubmission(submission);

      // If group project, also save copy for teammates so it shows on their dashboard
      if (matchedGroup && matchedGroup.members) {
        for (const m of matchedGroup.members) {
          if (m.uid === currentUser.uid) continue;
          const memberSub: AssignmentSubmission = {
            ...submission,
            id: `${activeAssignment.id}_${m.uid}`,
            studentUid: m.uid,
            studentName: m.fullName,
            studentUsername: m.username
          };
          await saveAssignmentSubmission(memberSub);
        }
      }

      setSubmissions(prev => ({ ...prev, [activeAssignment.id]: submission }));
      setSubmitSuccess(true);
      setTimeout(() => {
        setActiveAssignment(null);
        setSubmitSuccess(false);
      }, 1800);
    } catch (err) {
      console.error("Error submitting assignment:", err);
      alert("Failed to submit assignment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Submit an independent course project / assignment directly by course
  const handleSelfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseCode) {
      alert("Please select the course or subject for this assignment.");
      return;
    }
    if (!customTitle.trim()) {
      alert("Please provide an assignment title or topic.");
      return;
    }
    if (!customMarkdown.trim() && !customFile) {
      alert("Please provide text/code notes or attach a file.");
      return;
    }

    setSubmittingSelf(true);
    try {
      const matchedCourse = syllabi.find(s => s.courseCode === selectedCourseCode);
      const submissionId = `indep_${currentUser.uid}_${Date.now()}`;
      
      const newSubmission: AssignmentSubmission = {
        id: submissionId,
        assignmentId: `indep_${selectedCourseCode}`,
        courseCode: selectedCourseCode,
        courseTitle: matchedCourse ? matchedCourse.title : selectedCourseCode,
        submissionTitle: customTitle.trim(),
        isIndependentSubmission: true,
        studentUid: currentUser.uid,
        studentName: currentUser.fullName,
        studentUsername: currentUser.username,
        tradeId: currentUser.tradeId,
        level: currentUser.level,
        contentMarkdown: customMarkdown.trim(),
        fileData: customFile || undefined,
        status: "submitted",
        maxScore: 100,
        submittedAt: new Date().toISOString()
      };

      await saveAssignmentSubmission(newSubmission);
      setIndependentSubmissions(prev => [newSubmission, ...prev]);
      setSelfSubmitSuccess(true);
      setTimeout(() => {
        setIsSelfSubmitModalOpen(false);
        setSelfSubmitSuccess(false);
        setCustomTitle("");
        setCustomMarkdown("");
        setCustomFile(null);
      }, 1800);
    } catch (err) {
      console.error("Self submit error:", err);
      alert("Failed to submit assignment. Please try again.");
    } finally {
      setSubmittingSelf(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#334155] bg-[#1E293B]/60 p-8 text-center text-xs font-mono text-[#94A3B8]">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[#06B6D4] border-t-transparent mb-2" />
        Loading your class assignments...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Direct Submit Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#334155] pb-4">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center space-x-2">
            <Award className="h-5 w-5 text-[#06B6D4]" />
            <span>Class Assignments &amp; Course Projects</span>
          </h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Complete tasks assigned by your instructor, or submit independent homework &amp; project files under your course.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => loadData(false)}
            disabled={isSyncing}
            className="inline-flex items-center space-x-1.5 rounded-xl border border-[#334155] bg-[#1E293B] px-3 py-2 text-xs font-semibold text-[#CBD5E1] hover:text-white hover:border-[#06B6D4] transition-all disabled:opacity-50"
            title="Sync latest assignments & grades from instructor"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#06B6D4] ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Syncing..." : "Sync Latest"}</span>
          </button>

          <button
            onClick={() => {
              if (studentCourses.length > 0 && !selectedCourseCode) {
                setSelectedCourseCode(studentCourses[0].courseCode);
              }
              setIsSelfSubmitModalOpen(true);
            }}
            className="inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-[#06B6D4] to-[#3B82F6] px-4 py-2 text-xs font-bold text-slate-950 shadow-lg hover:brightness-110 transition-all shrink-0"
          >
            <Upload className="h-4 w-4" />
            <span>Submit Course Assignment</span>
          </button>
        </div>
      </div>

      {/* SECTION 0: MY ASSIGNMENT MARKS & GRADES BY SUBJECT */}
      {subjectMarksSummary.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/30 bg-[#1E293B]/85 p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#334155]/70 pb-3">
            <div>
              <h3 className="text-xs font-extrabold font-mono text-emerald-400 uppercase tracking-wider flex items-center space-x-2">
                <BarChart3 className="h-4 w-4 text-emerald-400" />
                <span>My Assignment Marks &amp; Grades by Subject ({subjectMarksSummary.length})</span>
              </h3>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                View your graded assignment marks and total scores grouped by subject / course module.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {(() => {
                const totalEarned = subjectMarksSummary.reduce((acc, s) => acc + s.earnedPoints, 0);
                const totalPoss = subjectMarksSummary.reduce((acc, s) => acc + s.possiblePoints, 0);
                if (totalPoss <= 0) return null;
                const overallPct = Math.round((totalEarned / totalPoss) * 100);
                return (
                  <span className="inline-flex items-center space-x-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 px-3 py-1.5 text-xs font-mono font-bold text-emerald-300">
                    <Award className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Overall Assignment Marks: {totalEarned} / {totalPoss} Pts ({overallPct}%)</span>
                  </span>
                );
              })()}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {subjectMarksSummary.map((subj) => {
              const avgPct = subj.possiblePoints > 0 ? Math.round((subj.earnedPoints / subj.possiblePoints) * 100) : null;
              return (
                <div
                  key={subj.courseCode}
                  className="rounded-xl border border-[#334155] bg-[#0B0F19]/70 p-4 flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <span className="inline-block rounded-md bg-[#06B6D4]/15 border border-[#06B6D4]/30 px-2 py-0.5 text-[10px] font-mono font-bold text-[#06B6D4]">
                          {subj.courseCode}
                        </span>
                        <h4 className="text-xs font-bold text-white mt-1 line-clamp-1">
                          {subj.courseTitle}
                        </h4>
                      </div>
                      {avgPct !== null ? (
                        <div className="text-right shrink-0">
                          <span className={`inline-block rounded-lg px-2.5 py-1 text-xs font-mono font-black border ${
                            avgPct >= 70
                              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                              : avgPct >= 50
                              ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                              : "bg-rose-500/15 text-rose-300 border-rose-500/40"
                          }`}>
                            {avgPct}%
                          </span>
                          <span className="block text-[10px] font-mono text-[#94A3B8] mt-0.5">
                            {subj.earnedPoints} / {subj.possiblePoints} Pts
                          </span>
                        </div>
                      ) : (
                        <span className="rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono text-amber-300">
                          Awaiting Grade
                        </span>
                      )}
                    </div>

                    {/* Individual assignment marks in this subject */}
                    <div className="space-y-1.5 pt-2 border-t border-[#334155]/60">
                      {subj.gradedItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (item.isIndependent) {
                              setViewingSubmission(item.submission);
                            } else if (item.assignment) {
                              handleOpenAssignment(item.assignment);
                            } else {
                              setViewingSubmission(item.submission);
                            }
                          }}
                          className="w-full flex items-center justify-between rounded-lg bg-[#1E293B]/80 hover:bg-[#1E293B] border border-[#334155]/60 hover:border-[#06B6D4]/50 px-2.5 py-1.5 text-left transition-all"
                        >
                          <span className="text-[11px] font-medium text-[#CBD5E1] truncate pr-2">
                            {item.title}
                          </span>
                          <span className="text-[11px] font-mono font-bold text-emerald-400 shrink-0">
                            {item.score}/{item.maxScore} ({item.pct}%)
                          </span>
                        </button>
                      ))}
                      {subj.pendingCount > 0 && (
                        <div className="text-[10px] font-mono text-amber-300/90 flex items-center space-x-1 pt-0.5">
                          <Clock className="h-3 w-3" />
                          <span>{subj.pendingCount} submitted assignment(s) awaiting teacher grading</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 1: SELF-SUBMITTED COURSE ASSIGNMENTS */}
      {independentSubmissions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold font-mono text-[#06B6D4] uppercase tracking-wider flex items-center space-x-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              <span>Your Self-Submitted Course Work ({independentSubmissions.length})</span>
            </h3>
            <span className="text-[11px] font-mono text-[#94A3B8]">Visible to course teachers</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {independentSubmissions.map((sub) => {
              const isGraded = sub.status === "graded";
              return (
                <div
                  key={sub.id}
                  onClick={() => setViewingSubmission(sub)}
                  className="rounded-2xl border border-[#334155] bg-[#1E293B]/80 p-4 hover:border-[#06B6D4]/50 cursor-pointer transition-all shadow-md group space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-[#06B6D4]/10 border border-[#06B6D4]/30 px-2 py-0.5 text-[10px] font-mono font-bold text-[#06B6D4]">
                      {sub.courseCode}
                    </span>
                    {isGraded ? (
                      <span className="inline-flex items-center space-x-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>{sub.score} / {sub.maxScore} Pts</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono text-amber-300">
                        <Clock className="h-3 w-3" />
                        <span>Pending Teacher Review</span>
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-[#06B6D4] transition-colors line-clamp-1">
                      {sub.submissionTitle || "Course Assignment"}
                    </h4>
                    <span className="text-[10px] font-mono text-[#64748B] block mt-0.5">
                      Submitted on {new Date(sub.submittedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#334155]/60 text-[11px] font-mono text-[#94A3B8]">
                    <span className="flex items-center space-x-1 text-[#06B6D4]">
                      {sub.fileData ? <Upload className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                      <span className="truncate max-w-[150px]">{sub.fileData ? sub.fileData.name : "Markdown Notes"}</span>
                    </span>
                    <span className="text-[#06B6D4] group-hover:underline">View Details &rarr;</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: OFFICIAL TEACHER ASSIGNMENTS */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-bold font-mono text-[#94A3B8] uppercase tracking-wider">
              Assigned by Instructor ({assignments.length})
            </h3>
            <div className="flex items-center rounded-xl bg-[#0B0F19] p-0.5 border border-[#334155]">
              <button
                type="button"
                onClick={() => setSelectedLevelFilter("my_level")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all ${
                  effectiveLevelFilter === "my_level"
                    ? "bg-[#06B6D4] text-slate-950"
                    : "text-[#94A3B8] hover:text-white"
                }`}
              >
                My Class ({currentUser.level || "All"}) ({myLevelAssignments.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedLevelFilter("all")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all ${
                  effectiveLevelFilter === "all"
                    ? "bg-[#06B6D4] text-slate-950"
                    : "text-[#94A3B8] hover:text-white"
                }`}
              >
                All Levels ({tradeAndGroupMatchedAssignments.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedLevelFilter("Level 5")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all ${
                  effectiveLevelFilter === "Level 5"
                    ? "bg-[#06B6D4] text-slate-950"
                    : "text-[#94A3B8] hover:text-white"
                }`}
              >
                Level 5
              </button>
              <button
                type="button"
                onClick={() => setSelectedLevelFilter("Level 4")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all ${
                  effectiveLevelFilter === "Level 4"
                    ? "bg-[#06B6D4] text-slate-950"
                    : "text-[#94A3B8] hover:text-white"
                }`}
              >
                Level 4
              </button>
            </div>

            {availableSubjectCodes.length > 1 && (
              <select
                value={selectedSubjectFilter}
                onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                className="rounded-xl border border-[#334155] bg-[#0B0F19] px-3 py-1.5 text-[11px] font-mono text-white focus:border-[#06B6D4] focus:outline-none"
              >
                <option value="all">All Subjects ({levelMatchedAssignments.length})</option>
                {availableSubjectCodes.map((code) => {
                  const syl = syllabi.find(s => s.courseCode === code);
                  return (
                    <option key={code} value={code}>
                      {code}{syl ? ` - ${syl.title.slice(0, 24)}` : ""}
                    </option>
                  );
                })}
              </select>
            )}
          </div>
          <span className="text-xs font-mono text-[#06B6D4]">
            {Object.keys(submissions).length} / {assignments.length} Completed
          </span>
        </div>

        {assignments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#334155] bg-[#1E293B]/40 p-8 text-center">
            <FileText className="mx-auto h-10 w-10 text-[#64748B] mb-2" />
            <h3 className="text-sm font-bold text-white mb-1">No Instructor Assignments Found for This Filter</h3>
            <p className="text-xs text-[#94A3B8] max-w-sm mx-auto mb-4">
              Switch to &ldquo;All Levels&rdquo; above to view assignments across all classes, or click the button below to submit course work directly.
            </p>
            <div className="flex items-center justify-center gap-2">
              {effectiveLevelFilter !== "all" && tradeAndGroupMatchedAssignments.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedLevelFilter("all")}
                  className="inline-flex items-center space-x-1.5 rounded-xl border border-[#06B6D4]/40 bg-[#06B6D4]/10 px-3.5 py-1.5 text-xs font-bold text-[#06B6D4] hover:bg-[#06B6D4] hover:text-slate-950 transition-all"
                >
                  <span>Show All Class Assignments ({tradeAndGroupMatchedAssignments.length})</span>
                </button>
              )}
              <button
                onClick={() => {
                  if (studentCourses.length > 0 && !selectedCourseCode) {
                    setSelectedCourseCode(studentCourses[0].courseCode);
                  }
                  setIsSelfSubmitModalOpen(true);
                }}
                className="inline-flex items-center space-x-2 rounded-xl bg-[#06B6D4] px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-md"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Submit Course Assignment</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignments.map((asg) => {
              const sub = submissions[asg.id];
              const isGraded = sub?.status === "graded";
              const isSubmitted = !!sub;
              const isOverdue = isAssignmentPastDue(asg.dueDate);

              return (
                <div
                  key={asg.id}
                  className="flex flex-col justify-between rounded-2xl border border-[#334155] bg-[#1E293B]/90 p-5 hover:border-[#06B6D4]/50 transition-all shadow-xl group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-[#06B6D4]/10 border border-[#06B6D4]/30 px-2 py-0.5 text-[10px] font-mono font-bold text-[#06B6D4]">
                          {asg.courseCode || "General"}
                        </span>
                        {asg.level && (
                          <span className="rounded-md bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                            {asg.level}
                          </span>
                        )}
                        {asg.submissionType === "group" && (
                          <span className="inline-flex items-center space-x-1 rounded-md bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-400">
                            <Users className="h-3 w-3" />
                            <span>
                              {asg.targetGroupId && asg.targetGroupId !== "all_groups"
                                ? `Team Task (${myGroups.find(g => g.id === asg.targetGroupId)?.name || "Assigned Team"})`
                                : "Group Project"}
                            </span>
                          </span>
                        )}
                      </div>
                      <span className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
                        {asg.totalPoints} Pts
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white group-hover:text-[#06B6D4] transition-colors line-clamp-2 mb-1.5">
                      {asg.title}
                    </h3>

                    <p className="text-xs text-[#94A3B8] line-clamp-2 mb-3 leading-relaxed">
                      {asg.description || asg.instructionsMarkdown}
                    </p>

                    {asg.dueDate && (
                      <div className={`flex items-center space-x-1.5 text-[11px] font-mono mb-3 ${isOverdue ? "text-rose-400 font-bold" : "text-[#94A3B8]"}`}>
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          Due: {formatAssignmentDueDate(asg.dueDate)}
                          {isOverdue ? " (Closed)" : ""}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#334155]/60 flex items-center justify-between gap-2">
                    <div>
                      {isGraded ? (
                        <span className="inline-flex items-center space-x-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-mono font-bold text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>
                            Graded: {sub.score} / {sub.maxScore} ({Math.round(((sub.score || 0) / (sub.maxScore || asg.totalPoints || 100)) * 100)}%)
                          </span>
                        </span>
                      ) : isSubmitted ? (
                        <span className="inline-flex items-center space-x-1 rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[11px] font-mono font-bold text-amber-400">
                          <Lock className="h-3 w-3" />
                          <span>Submitted • Awaiting Grade</span>
                        </span>
                      ) : isOverdue ? (
                        <span className="inline-flex items-center space-x-1 rounded-md bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[11px] font-mono font-bold text-rose-400">
                          <Lock className="h-3 w-3" />
                          <span>Deadline Passed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 text-[11px] font-mono text-[#94A3B8]">
                          <Clock className="h-3 w-3" />
                          <span>Not Submitted</span>
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleOpenAssignment(asg)}
                      className={`inline-flex items-center space-x-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all shadow-md ${
                        isGraded
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500 hover:text-slate-950"
                          : isSubmitted
                          ? "bg-[#0B0F19] text-[#06B6D4] border border-[#06B6D4]/40 hover:bg-[#06B6D4] hover:text-slate-950"
                          : isOverdue
                          ? "bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
                          : "bg-[#06B6D4] text-slate-950 hover:bg-[#0891B2] hover:text-white"
                      }`}
                    >
                      <span>
                        {isGraded
                          ? "View Marks"
                          : isSubmitted
                          ? "View Submission"
                          : isOverdue
                          ? "Closed"
                          : "Start"}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: STUDENT SELF-SUBMIT UNDER COURSE */}
      {isSelfSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#334155] bg-[#1E293B] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#334155] pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center space-x-2">
                  <Upload className="h-5 w-5 text-[#06B6D4]" />
                  <span>Submit Assignment for Course</span>
                </h3>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Select a course and submit your project file, homework, or solution directly under your name ({currentUser.fullName}).
                </p>
              </div>
              <button
                onClick={() => setIsSelfSubmitModalOpen(false)}
                className="rounded-lg p-1.5 text-[#94A3B8] hover:text-white hover:bg-[#334155]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSelfSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                    Select Course / Subject <span className="text-rose-400">*</span>
                  </label>
                  <select
                    required
                    value={selectedCourseCode}
                    onChange={(e) => setSelectedCourseCode(e.target.value)}
                    className="w-full rounded-xl border border-[#334155]/70 bg-[#0B0F19]/60 backdrop-blur-md px-3 py-2.5 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                  >
                    <option value="">-- Choose Course --</option>
                    {studentCourses.map((c) => (
                      <option key={c.id} value={c.courseCode}>
                        {c.courseCode} - {c.title.slice(0, 35)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                    Assignment Topic / Title <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="e.g. Lab 2: Binary Search Tree Solution"
                    className="w-full rounded-xl border border-[#334155]/70 bg-[#0B0F19]/60 backdrop-blur-md px-3.5 py-2.5 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                  Explanation, Code, or Solution Notes (Markdown supported)
                </label>
                <textarea
                  rows={5}
                  value={customMarkdown}
                  onChange={(e) => setCustomMarkdown(e.target.value)}
                  placeholder="Provide answers, code snippets, or notes about your submission..."
                  className="w-full rounded-xl border border-[#334155]/70 bg-[#0B0F19]/60 backdrop-blur-md p-3 text-xs font-mono text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                  Attach Readable Document or Code File (PDF, DOCX, MD, TXT, JSON, CSV, Source Code, Image — Max 5MB, No .zip)
                </label>
                <div className="flex items-center space-x-3">
                  <label 
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        (window as any).__SYLLABUS_FILE_PICKER_ACTIVE = true;
                        (window as any).__SYLLABUS_FILE_PICKER_TIMESTAMP = Date.now();
                      }
                    }}
                    className="inline-flex items-center space-x-2 rounded-xl border border-[#334155] bg-[#0B0F19] px-4 py-2 text-xs font-semibold text-[#CBD5E1] hover:text-white hover:border-[#06B6D4] cursor-pointer transition-all"
                  >
                    <Upload className="h-4 w-4 text-[#06B6D4]" />
                    <span>{customFile ? "Change File" : "Choose File"}</span>
                    <input
                      type="file"
                      accept={ACCEPT_FILE_ATTRIBUTE}
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          (window as any).__SYLLABUS_FILE_PICKER_ACTIVE = true;
                          (window as any).__SYLLABUS_FILE_PICKER_TIMESTAMP = Date.now();
                        }
                      }}
                      onChange={(e) => handleFileChange(e, true)}
                      className="hidden"
                    />
                  </label>

                  {customFile && (
                    <div className="flex items-center space-x-2 rounded-xl bg-[#0B0F19] border border-[#334155] px-3 py-1.5 text-xs text-white">
                      <FileCheck className="h-4 w-4 text-emerald-400" />
                      <span className="font-mono text-[11px] truncate max-w-[200px]">{customFile.name}</span>
                      <button
                        type="button"
                        onClick={() => setCustomFile(null)}
                        className="text-[#94A3B8] hover:text-rose-400"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {selfSubmitSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Assignment submitted to course instructor successfully!</span>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#334155]">
                <button
                  type="button"
                  onClick={() => setIsSelfSubmitModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-white bg-[#0B0F19] border border-[#334155]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submittingSelf}
                  className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-[#06B6D4] hover:bg-[#0891B2] hover:text-white transition-all shadow-lg disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{submittingSelf ? "Submitting..." : "Submit to Teacher"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: VIEW INDEPENDENT SUBMISSION DETAILS */}
      {viewingSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#334155] bg-[#1E293B] p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between border-b border-[#334155] pb-3">
              <div>
                <div className="flex items-center space-x-2 text-xs font-mono text-[#06B6D4] mb-1">
                  <span>Course: {viewingSubmission.courseCode}</span>
                  <span>•</span>
                  <span>{new Date(viewingSubmission.submittedAt).toLocaleString()}</span>
                </div>
                <h3 className="text-base font-extrabold text-white">{viewingSubmission.submissionTitle || "Course Work"}</h3>
              </div>
              <button
                onClick={() => setViewingSubmission(null)}
                className="rounded-lg p-1.5 text-[#94A3B8] hover:text-white hover:bg-[#334155]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Teacher Feedback if already graded */}
            {viewingSubmission.status === "graded" && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1.5">
                    <Award className="h-4 w-4" />
                    <span>Teacher Grade &amp; Review</span>
                  </span>
                  <span className="text-xs font-mono font-extrabold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/40">
                    {viewingSubmission.score} / {viewingSubmission.maxScore} Points
                  </span>
                </div>
                {viewingSubmission.feedback && (
                  <p className="text-xs text-[#CBD5E1] italic">
                    "{viewingSubmission.feedback}"
                  </p>
                )}
              </div>
            )}

            {/* Content notes */}
            {viewingSubmission.contentMarkdown && (
              <div className="rounded-xl border border-[#334155]/60 bg-[#0B0F19]/50 backdrop-blur-md p-4 space-y-2">
                <span className="text-[10px] font-mono text-[#06B6D4] uppercase tracking-wider block">Your Notes / Solution:</span>
                <div className="prose prose-invert prose-xs max-w-none text-[#CBD5E1]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {viewingSubmission.contentMarkdown}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* Attached file */}
            {viewingSubmission.fileData && (
              <div className="flex items-center justify-between rounded-xl border border-[#334155]/60 bg-[#0B0F19]/50 backdrop-blur-md p-3.5">
                <div className="flex items-center space-x-2.5">
                  <FileCheck className="h-5 w-5 text-[#06B6D4]" />
                  <div>
                    <span className="block text-xs font-bold text-white">{viewingSubmission.fileData.name}</span>
                    <span className="block text-[10px] font-mono text-[#94A3B8]">{(viewingSubmission.fileData.size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
                {viewingSubmission.fileData.base64Url && (
                  <a
                    href={viewingSubmission.fileData.base64Url}
                    download={viewingSubmission.fileData.name}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1 rounded-lg bg-[#06B6D4] px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-md"
                  >
                    <Upload className="h-3 w-3" />
                    <span>Download</span>
                  </a>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-[#334155]">
              <button
                onClick={() => setViewingSubmission(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#0B0F19]/60 backdrop-blur-sm border border-[#334155]/70 hover:bg-[#0B0F19]/90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: OFFICIAL ASSIGNMENT SUBMISSION / MARKS MODAL */}
      {activeAssignment && (() => {
        const existingSubmission = submissions[activeAssignment.id];
        const isPastDue = isAssignmentPastDue(activeAssignment.dueDate);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#334155] bg-[#1E293B] p-6 shadow-2xl space-y-6">
              <div className="flex items-start justify-between border-b border-[#334155] pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#06B6D4] mb-1">
                    <span>{activeAssignment.courseCode || "General"}</span>
                    <span>•</span>
                    <span>{activeAssignment.totalPoints} Total Points</span>
                    {activeAssignment.dueDate && (
                      <>
                        <span>•</span>
                        <span className={isPastDue ? "text-rose-400 font-bold" : "text-[#94A3B8]"}>
                          Due: {formatAssignmentDueDate(activeAssignment.dueDate)}
                          {isPastDue ? " (Closed)" : ""}
                        </span>
                      </>
                    )}
                  </div>
                  <h3 className="text-lg font-extrabold text-white">{activeAssignment.title}</h3>
                </div>
                <button
                  onClick={() => setActiveAssignment(null)}
                  className="rounded-lg p-1.5 text-[#94A3B8] hover:text-white hover:bg-[#334155]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Assignment Instructions in Markdown */}
              <div className="rounded-xl border border-[#334155] bg-[#0B0F19] p-4 space-y-2">
                <span className="text-[10px] font-mono text-[#06B6D4] uppercase tracking-wider block">Instructions:</span>
                <div className="prose prose-invert prose-xs max-w-none leading-relaxed text-[#CBD5E1]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {activeAssignment.instructionsMarkdown || activeAssignment.description}
                  </ReactMarkdown>
                </div>
              </div>

              {/* CASE 1: STUDENT HAS ALREADY SUBMITTED (LOCKED AGAINST RE-SUBMISSION OR MODIFICATION) */}
              {existingSubmission ? (
                <div className="space-y-4">
                  {existingSubmission.status === "graded" ? (
                    <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1.5">
                          <Award className="h-4 w-4" />
                          <span>Teacher Evaluation &amp; Official Grade</span>
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-mono font-extrabold text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-md border border-emerald-500/40">
                            {existingSubmission.score} / {existingSubmission.maxScore || activeAssignment.totalPoints} Points (
                            {Math.round(((existingSubmission.score || 0) / (existingSubmission.maxScore || activeAssignment.totalPoints || 100)) * 100)}%)
                          </span>
                        </div>
                      </div>
                      {existingSubmission.feedback && (
                        <p className="text-xs text-[#CBD5E1] italic leading-relaxed">
                          &ldquo;{existingSubmission.feedback}&rdquo;
                        </p>
                      )}
                      <div className="pt-2 border-t border-emerald-500/20 flex items-center space-x-1.5 text-[11px] font-mono text-emerald-300/90">
                        <Lock className="h-3.5 w-3.5 shrink-0" />
                        <span>Final grade recorded. Graded submissions are locked and cannot be modified.</span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-300 flex items-center space-x-1.5">
                          <Lock className="h-4 w-4 text-amber-400" />
                          <span>Submission Locked — Awaiting Instructor Grading</span>
                        </span>
                        <span className="text-[11px] font-mono text-amber-300/90">
                          Submitted {new Date(existingSubmission.submittedAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-amber-200/90 leading-relaxed">
                        Your assignment has been submitted and is locked for evaluation. You cannot modify or re-submit your work while awaiting your instructor&apos;s grade.
                      </p>
                    </div>
                  )}

                  {/* Read-only view of what the student submitted */}
                  {existingSubmission.contentMarkdown && (
                    <div className="rounded-xl border border-[#334155] bg-[#0B0F19] p-4 space-y-2">
                      <span className="text-[10px] font-mono text-[#06B6D4] uppercase tracking-wider block">
                        Your Submitted Solution / Notes (Read-Only):
                      </span>
                      <div className="prose prose-invert prose-xs max-w-none text-[#CBD5E1] leading-relaxed">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {existingSubmission.contentMarkdown}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {existingSubmission.fileData && (
                    <div className="flex items-center justify-between rounded-xl border border-[#334155] bg-[#0B0F19] p-3.5">
                      <div className="flex items-center space-x-2.5">
                        <FileCheck className="h-5 w-5 text-emerald-400" />
                        <div>
                          <span className="block text-xs font-bold text-white">{existingSubmission.fileData.name}</span>
                          <span className="block text-[10px] font-mono text-[#94A3B8]">
                            Submitted File • {(existingSubmission.fileData.size / 1024).toFixed(1)} KB (Locked)
                          </span>
                        </div>
                      </div>
                      {existingSubmission.fileData.base64Url && (
                        <a
                          href={existingSubmission.fileData.base64Url}
                          download={existingSubmission.fileData.name}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center space-x-1 rounded-lg bg-[#06B6D4] px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-md"
                        >
                          <Upload className="h-3 w-3" />
                          <span>Download Copy</span>
                        </a>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-end pt-3 border-t border-[#334155]">
                    <button
                      type="button"
                      onClick={() => setActiveAssignment(null)}
                      className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-[#06B6D4] hover:bg-[#0891B2] hover:text-white transition-all shadow-md"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : isPastDue ? (
                /* CASE 2: DEADLINE HAS PASSED AND STUDENT DID NOT SUBMIT */
                <div className="space-y-4">
                  <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 space-y-2">
                    <div className="flex items-center space-x-2 text-rose-300 text-xs font-bold">
                      <Lock className="h-4 w-4 shrink-0 text-rose-400" />
                      <span>Submission Closed — Due Date Has Passed</span>
                    </div>
                    <p className="text-xs text-rose-200/90 leading-relaxed">
                      The deadline for this assignment (<strong>{formatAssignmentDueDate(activeAssignment.dueDate)}</strong>) has expired. New submissions and changes are no longer accepted after the due date.
                    </p>
                  </div>

                  <div className="flex items-center justify-end pt-3 border-t border-[#334155]">
                    <button
                      type="button"
                      onClick={() => setActiveAssignment(null)}
                      className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-[#0B0F19] border border-[#334155] hover:bg-slate-800"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                /* CASE 3: OPEN FOR INITIAL SUBMISSION (1 ATTEMPT ONLY) */
                <>
                  {/* Group Project Team Information / Warning */}
                  {activeAssignment.submissionType === "group" && (
                    activeMatchedGroup ? (
                      <div className="rounded-xl border border-purple-500/40 bg-purple-500/10 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-purple-300 flex items-center space-x-1.5">
                            <Users className="h-4 w-4 text-purple-400" />
                            <span>Group Project Submission: {activeMatchedGroup.name}</span>
                          </span>
                          <span className="text-[10px] font-mono text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30">
                            Code: {activeMatchedGroup.joinCode}
                          </span>
                        </div>
                        <p className="text-xs text-[#CBD5E1] leading-relaxed">
                          Submitting on behalf of all teammates:{" "}
                          <span className="text-white font-semibold">
                            {activeMatchedGroup.members.map(m => m.fullName).join(", ")}
                          </span>
                          . Your instructor&apos;s evaluation and grade will automatically synchronize across all team members.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
                        <div className="flex items-center space-x-2 text-amber-300 text-xs font-bold">
                          <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                          <span>Group Project: Team Required</span>
                        </div>
                        <p className="text-xs text-amber-200/90 leading-relaxed">
                          This task is assigned as a Group Project. You must join or create a study group for your class before submitting work. Please switch to the <strong>My Study Groups</strong> tab to form or join your team.
                        </p>
                      </div>
                    )
                  )}

                  <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-3.5 py-2.5 text-[11px] text-cyan-200/90 flex items-center space-x-2">
                    <Lock className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                    <span>
                      <strong>Single-Submission Policy:</strong> Please review your work carefully before submitting. Once submitted, your assignment is locked for grading and cannot be edited or re-submitted.
                    </span>
                  </div>

                  {/* Submission Form */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {activeAssignment.allowTextSubmission && (
                      <div>
                        <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                          Your Solution / Markdown Notes / Code Answer
                        </label>
                        <textarea
                          rows={6}
                          value={textAnswer}
                          onChange={(e) => setTextAnswer(e.target.value)}
                          placeholder="Type your explanation, answers, and code here... (Markdown supported)"
                          className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-xs font-mono text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none leading-relaxed"
                        />
                      </div>
                    )}

                    {activeAssignment.allowFileUpload && (
                      <div>
                        <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                          File Attachment (PDF, DOCX, MD, TXT, JSON, CSV, Source Code, or Image — No .zip)
                        </label>
                        <div className="flex items-center space-x-3">
                          <label 
                            onClick={() => {
                              if (typeof window !== "undefined") {
                                (window as any).__SYLLABUS_FILE_PICKER_ACTIVE = true;
                                (window as any).__SYLLABUS_FILE_PICKER_TIMESTAMP = Date.now();
                              }
                            }}
                            className="inline-flex items-center space-x-2 rounded-xl border border-[#334155] bg-[#0B0F19] px-4 py-2 text-xs font-semibold text-[#CBD5E1] hover:text-white hover:border-[#06B6D4] cursor-pointer transition-all"
                          >
                            <Upload className="h-4 w-4 text-[#06B6D4]" />
                            <span>{selectedFile ? "Change Selected File" : "Choose File (Max 5MB)"}</span>
                            <input
                              type="file"
                              accept={ACCEPT_FILE_ATTRIBUTE}
                              onClick={() => {
                                if (typeof window !== "undefined") {
                                  (window as any).__SYLLABUS_FILE_PICKER_ACTIVE = true;
                                  (window as any).__SYLLABUS_FILE_PICKER_TIMESTAMP = Date.now();
                                }
                              }}
                              onChange={(e) => handleFileChange(e, false)}
                              className="hidden"
                            />
                          </label>

                          {selectedFile && (
                            <div className="flex items-center space-x-2 rounded-xl bg-[#1E293B] border border-[#334155] px-3 py-1.5 text-xs text-white">
                              <FileCheck className="h-4 w-4 text-emerald-400" />
                              <span className="font-mono text-[11px] truncate max-w-[200px]">{selectedFile.name}</span>
                              <button
                                type="button"
                                onClick={() => setSelectedFile(null)}
                                className="text-[#94A3B8] hover:text-rose-400"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {submitSuccess && (
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center space-x-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>Assignment submitted and locked for grading! Your instructor can now review your work.</span>
                      </div>
                    )}

                    <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#334155]">
                      <button
                        type="button"
                        onClick={() => setActiveAssignment(null)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-white bg-[#0B0F19] border border-[#334155]"
                      >
                        Close
                      </button>

                      <button
                        type="submit"
                        disabled={submitting || (activeAssignment.submissionType === "group" && !activeMatchedGroup)}
                        className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-[#06B6D4] hover:bg-[#0891B2] hover:text-white transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>
                          {submitting 
                            ? "Submitting..." 
                            : (activeAssignment.submissionType === "group" && !activeMatchedGroup)
                            ? "Team Required to Submit"
                            : "Submit Final Answer"}
                        </span>
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
