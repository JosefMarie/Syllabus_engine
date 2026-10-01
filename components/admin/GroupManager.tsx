"use client";

import React, { useState, useEffect } from "react";
import { StudentGroup, GroupMember, GroupEvaluation, MemberEvaluation, MemberParticipationStatus } from "@/types/group";
import { Syllabus } from "@/types/syllabus";
import { Trade, StudentLevel, UserProfile } from "@/types/auth";
import { 
  getAllGroups, 
  saveGroup, 
  deleteGroup, 
  toggleGroupLock, 
  addMemberToGroup, 
  removeMemberFromGroup, 
  updateGroupCapacity,
  autoGenerateGroups, 
  generateGroupJoinCode,
  getAllUserProfiles,
  saveGroupEvaluation,
  getAllGroupEvaluations,
  deleteGroupEvaluation
} from "@/lib/db";
import { generatePresentationFeedback } from "@/lib/gemini";
import { 
  Users, 
  UserPlus, 
  Lock, 
  Unlock, 
  Trash2, 
  Sparkles, 
  Plus, 
  Copy, 
  Check, 
  Search, 
  Filter, 
  Crown, 
  UserMinus, 
  X, 
  AlertCircle, 
  Layers,
  BookOpen,
  Award,
  Sliders,
  Download,
  History,
  UserCheck,
  FileText,
  CheckCircle2,
  ChevronRight,
  Eye,
  Percent,
  Calendar,
  UserX,
  Tablet,
  Zap
} from "lucide-react";
import RestrictionsControl from "./RestrictionsControl";

interface GroupManagerProps {
  syllabi: Syllabus[];
  trades: Trade[];
  adminEmail?: string;
  adminUser?: UserProfile | null;
}

export default function GroupManager({ syllabi, trades, adminEmail, adminUser }: GroupManagerProps) {
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [evaluations, setEvaluations] = useState<GroupEvaluation[]>([]);
  const [loading, setLoading] = useState(true);

  // Active view tab: "groups" roster or "evaluations" presentation gradebook
  const [activeTab, setActiveTab] = useState<"groups" | "evaluations">("groups");

  // Filters
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [selectedTrade, setSelectedTrade] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [evalSearchQuery, setEvalSearchQuery] = useState("");

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAutoModalOpen, setIsAutoModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Evaluation & Grading Modal State
  const [isEvalModalOpen, setIsEvalModalOpen] = useState(false);
  const [evaluatingGroup, setEvaluatingGroup] = useState<StudentGroup | null>(null);
  const [editingEvaluationId, setEditingEvaluationId] = useState<string | null>(null);
  const [evalPresentationTitle, setEvalPresentationTitle] = useState("PowerPoint & Project Presentation");
  const [evalCourseCode, setEvalCourseCode] = useState("");
  const [evalGroupScore, setEvalGroupScore] = useState(85);
  const [evalGroupWeight, setEvalGroupWeight] = useState(50);
  const [evalIndividualWeight, setEvalIndividualWeight] = useState(50);
  const [evalStrictAbsentZero, setEvalStrictAbsentZero] = useState(true);
  const [evalGroupFeedback, setEvalGroupFeedback] = useState("");
  const [evalMembers, setEvalMembers] = useState<Record<string, { individualScore: number; status: MemberParticipationStatus; privateFeedback: string }>>({});
  const [savingEvaluation, setSavingEvaluation] = useState(false);
  const [touchHudMode, setTouchHudMode] = useState(false);
  const [generatingAiFeedback, setGeneratingAiFeedback] = useState(false);

  // History Drawer State
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [historyGroup, setHistoryGroup] = useState<StudentGroup | null>(null);

  // Manual Create Form State
  const [formName, setFormName] = useState("");
  const [formCourseCode, setFormCourseCode] = useState("");
  const [formLevel, setFormLevel] = useState<StudentLevel>("Level 4");
  const [formTradeId, setFormTradeId] = useState("all");
  const [formMaxMembers, setFormMaxMembers] = useState(4);
  const [formSelectedStudentUids, setFormSelectedStudentUids] = useState<string[]>([]);
  const [savingManual, setSavingManual] = useState(false);

  // Auto-Generate Form State
  const [autoCourseCode, setAutoCourseCode] = useState("");
  const [autoLevel, setAutoLevel] = useState<StudentLevel>("Level 4");
  const [autoTradeId, setAutoTradeId] = useState("all");
  const [autoGroupSize, setAutoGroupSize] = useState(4);
  const [generatingAuto, setGeneratingAuto] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [allG, allUsers, allEvals] = await Promise.all([
        getAllGroups(),
        getAllUserProfiles(),
        getAllGroupEvaluations()
      ]);
      setGroups(allG);
      setStudents(allUsers.filter(u => u.role === "student" && u.status === "approved"));
      setEvaluations(allEvals);
    } catch (err) {
      console.error("Error loading groups & students:", err);
    } finally {
      setLoading(false);
    }
  };

  const calculateMemberFinalScore = (
    groupScore: number,
    individualScore: number,
    groupWeight: number,
    individualWeight: number,
    status: MemberParticipationStatus,
    strictAbsentZero: boolean
  ): number => {
    if (status === "absent" && strictAbsentZero) {
      return 0;
    }
    const gw = (groupWeight || 50) / 100;
    const iw = (individualWeight || 50) / 100;
    const raw = (groupScore * gw) + (individualScore * iw);
    return Math.min(100, Math.max(0, Math.round(raw * 10) / 10));
  };

  const handleOpenEvaluation = (group: StudentGroup, existingEval?: GroupEvaluation) => {
    setEvaluatingGroup(group);
    if (existingEval) {
      setEditingEvaluationId(existingEval.id);
      setEvalPresentationTitle(existingEval.presentationTitle || "PowerPoint & Project Presentation");
      setEvalCourseCode(existingEval.courseCode || group.courseCode || "");
      setEvalGroupScore(existingEval.groupScore ?? 85);
      setEvalGroupWeight(existingEval.groupWeight ?? 50);
      setEvalIndividualWeight(existingEval.individualWeight ?? 50);
      setEvalStrictAbsentZero(existingEval.strictAbsentZero ?? true);
      setEvalGroupFeedback(existingEval.groupFeedback || "");

      const memMap: Record<string, { individualScore: number; status: MemberParticipationStatus; privateFeedback: string }> = {};
      group.members.forEach(m => {
        const saved = existingEval.members?.[m.uid];
        if (saved) {
          memMap[m.uid] = {
            individualScore: saved.individualScore ?? 85,
            status: saved.status || "present",
            privateFeedback: saved.privateFeedback || ""
          };
        } else {
          memMap[m.uid] = {
            individualScore: existingEval.groupScore ?? 85,
            status: "present",
            privateFeedback: ""
          };
        }
      });
      setEvalMembers(memMap);
    } else {
      setEditingEvaluationId(null);
      setEvalPresentationTitle("PowerPoint & Project Presentation");
      setEvalCourseCode(group.courseCode || (syllabi[0]?.courseCode || ""));
      setEvalGroupScore(85);
      setEvalGroupWeight(50);
      setEvalIndividualWeight(50);
      setEvalStrictAbsentZero(true);
      setEvalGroupFeedback("");

      const memMap: Record<string, { individualScore: number; status: MemberParticipationStatus; privateFeedback: string }> = {};
      group.members.forEach(m => {
        memMap[m.uid] = {
          individualScore: 85,
          status: "present",
          privateFeedback: ""
        };
      });
      setEvalMembers(memMap);
    }
    setIsEvalModalOpen(true);
  };

  const handleSaveEvaluation = async () => {
    if (!evaluatingGroup) return;
    if (!evalPresentationTitle.trim()) {
      alert("Please enter a presentation title or topic.");
      return;
    }

    setSavingEvaluation(true);
    try {
      const evalId = editingEvaluationId || `eval_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const evaluatedAt = new Date().toISOString();
      const evaluatedBy = adminUser?.fullName || adminEmail || "Instructor";

      const membersRecord: Record<string, MemberEvaluation> = {};
      evaluatingGroup.members.forEach(m => {
        const data = evalMembers[m.uid] || { individualScore: evalGroupScore, status: "present", privateFeedback: "" };
        const finalScore = calculateMemberFinalScore(
          evalGroupScore,
          data.individualScore,
          evalGroupWeight,
          evalIndividualWeight,
          data.status,
          evalStrictAbsentZero
        );

        membersRecord[m.uid] = {
          uid: m.uid,
          studentName: m.fullName,
          username: m.username,
          individualScore: data.individualScore,
          finalScore,
          status: data.status,
          privateFeedback: data.privateFeedback
        };
      });

      const newEval: GroupEvaluation = {
        id: evalId,
        groupId: evaluatingGroup.id,
        groupName: evaluatingGroup.name,
        presentationTitle: evalPresentationTitle.trim(),
        courseCode: evalCourseCode || evaluatingGroup.courseCode,
        courseTitle: syllabi.find(s => s.courseCode === evalCourseCode)?.title,
        evaluatedAt,
        evaluatedBy,
        groupScore: evalGroupScore,
        groupWeight: evalGroupWeight,
        individualWeight: evalIndividualWeight,
        strictAbsentZero: evalStrictAbsentZero,
        groupFeedback: evalGroupFeedback.trim(),
        members: membersRecord,
        createdAt: evaluatedAt,
        updatedAt: evaluatedAt
      };

      await saveGroupEvaluation(newEval);
      const updatedAll = await getAllGroupEvaluations();
      setEvaluations(updatedAll);
      setIsEvalModalOpen(false);
      setEvaluatingGroup(null);
    } catch (err) {
      console.error("Error saving evaluation:", err);
      alert("Failed to save evaluation. Please try again.");
    } finally {
      setSavingEvaluation(false);
    }
  };

  const handleAiSuggestFeedback = async () => {
    if (!evaluatingGroup) return;
    setGeneratingAiFeedback(true);
    try {
      const memberSummary = evaluatingGroup.members.map(m => {
        const data = evalMembers[m.uid];
        return `${m.fullName}: ${data?.status || "present"} (individual: ${data?.individualScore ?? evalGroupScore}/100)`;
      }).join(", ");

      const critique = await generatePresentationFeedback({
        groupName: evaluatingGroup.name,
        presentationTitle: evalPresentationTitle,
        courseCode: evalCourseCode || evaluatingGroup.courseCode,
        groupScore: evalGroupScore,
        memberSummary
      });
      setEvalGroupFeedback(critique);
    } catch (err) {
      console.error("AI feedback generation failed:", err);
    } finally {
      setGeneratingAiFeedback(false);
    }
  };

  const handleDeleteEvaluation = async (evalId: string) => {
    if (!confirm("Are you sure you want to delete this presentation evaluation?")) return;
    try {
      await deleteGroupEvaluation(evalId);
      setEvaluations(prev => prev.filter(e => e.id !== evalId));
    } catch (err) {
      console.error("Error deleting evaluation:", err);
      alert("Failed to delete evaluation.");
    }
  };

  const handleExportEvaluationsCSV = (customEvals?: GroupEvaluation[]) => {
    const evalsToExport = customEvals || evaluations;
    if (evalsToExport.length === 0) {
      alert("No evaluations to export.");
      return;
    }

    const headers = [
      "Evaluation ID",
      "Group Name",
      "Presentation Title",
      "Course",
      "Evaluated At",
      "Evaluated By",
      "Group Score (%)",
      "Group Weight (%)",
      "Individual Weight (%)",
      "Student Name",
      "Student Username",
      "Participation Status",
      "Individual Score (%)",
      "Final Weighted Mark (%)",
      "Student Private Feedback",
      "Team General Feedback"
    ];

    const rows: string[][] = [];

    evalsToExport.forEach(ev => {
      Object.values(ev.members || {}).forEach(m => {
        rows.push([
          `"${ev.id}"`,
          `"${ev.groupName}"`,
          `"${ev.presentationTitle || ""}"`,
          `"${ev.courseCode || ""}"`,
          `"${new Date(ev.evaluatedAt).toLocaleDateString()}"`,
          `"${ev.evaluatedBy || ""}"`,
          `"${ev.groupScore}"`,
          `"${ev.groupWeight}"`,
          `"${ev.individualWeight}"`,
          `"${m.studentName}"`,
          `"${m.username || ""}"`,
          `"${m.status}"`,
          `"${m.individualScore}"`,
          `"${m.finalScore}"`,
          `"${(m.privateFeedback || "").replace(/"/g, '""')}"`,
          `"${(ev.groupFeedback || "").replace(/"/g, '""')}"`
        ]);
      });
    });

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `presentation_grades_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy code helper
  const handleCopyCode = (code: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  // Filter groups
  const filteredGroups = groups.filter(g => {
    if (selectedCourse !== "all" && g.courseCode && g.courseCode !== "all" && g.courseCode !== selectedCourse) return false;
    if (selectedLevel !== "all" && g.level !== selectedLevel) return false;
    if (selectedTrade !== "all" && g.tradeId !== selectedTrade && g.tradeId !== "all") return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = g.name.toLowerCase().includes(q);
      const matchCode = (g.courseCode || "").toLowerCase().includes(q);
      const matchJoin = g.joinCode.toLowerCase().includes(q);
      const matchMember = g.members.some(m => m.fullName.toLowerCase().includes(q) || m.username.toLowerCase().includes(q));
      if (!matchName && !matchCode && !matchJoin && !matchMember) return false;
    }
    return true;
  });

  // Calculate stats
  const totalGroups = groups.length;
  const uniqueEnrolledUids = new Set<string>();
  groups.forEach(g => g.members.forEach(m => uniqueEnrolledUids.add(m.uid)));
  const totalEnrolled = uniqueEnrolledUids.size;

  // Toggle lock
  const handleToggleLock = async (g: StudentGroup) => {
    await toggleGroupLock(g.id, !g.isLocked);
    setGroups(prev => prev.map(item => item.id === g.id ? { ...item, isLocked: !g.isLocked } : item));
  };

  // Delete group
  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (confirm(`Are you sure you want to disband and delete group "${groupName}"?`)) {
      await deleteGroup(groupId);
      setGroups(prev => prev.filter(g => g.id !== groupId));
    }
  };

  // Remove member
  const handleRemoveMember = async (groupId: string, studentUid: string, studentName: string) => {
    if (confirm(`Remove ${studentName} from this group?`)) {
      await removeMemberFromGroup(groupId, studentUid);
      await loadAllData();
    }
  };

  // Add member to existing group
  const handleAddMember = async (groupId: string, studentUid: string) => {
    const student = students.find(s => s.uid === studentUid);
    if (!student) return;
    const res = await addMemberToGroup(groupId, student);
    if (res.success) {
      await loadAllData();
    } else {
      alert(res.message);
    }
  };

  // Update group capacity
  const handleUpdateCapacity = async (groupId: string, currentCap: number, currentMembers: number) => {
    const input = prompt(
      `Set maximum member capacity for this group:\n(Current limit: ${currentCap}, Current active members: ${currentMembers})`,
      String(Math.max(currentCap, currentMembers))
    );
    if (!input) return;
    const newCap = parseInt(input.trim(), 10);
    if (isNaN(newCap) || newCap < 2) {
      alert("Capacity must be at least 2 members.");
      return;
    }
    const res = await updateGroupCapacity(groupId, newCap);
    if (res.success) {
      await loadAllData();
    } else {
      alert(res.message);
    }
  };

  // Create manual group
  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert("Please provide a group name.");
      return;
    }

    setSavingManual(true);
    try {
      const course = syllabi.find(s => s.courseCode === formCourseCode);
      const newGroupId = `grp_${Date.now()}`;
      const joinCode = generateGroupJoinCode();

      const selectedStudents = students.filter(s => formSelectedStudentUids.includes(s.uid));
      const members: GroupMember[] = selectedStudents.map((s, idx) => ({
        uid: s.uid,
        fullName: s.fullName,
        username: s.username,
        joinedAt: new Date().toISOString(),
        isLeader: idx === 0
      }));

      const newGroup: StudentGroup = {
        id: newGroupId,
        name: formName.trim(),
        courseCode: formCourseCode || "all",
        courseTitle: formCourseCode && formCourseCode !== "all" ? (course ? course.title : formCourseCode) : "All Class Assignments",
        tradeId: formTradeId,
        level: formLevel,
        joinCode,
        createdByUid: adminEmail || "teacher",
        leaderName: members.length > 0 ? members[0].fullName : "Instructor Assigned",
        members,
        maxMembers: Math.max(Number(formMaxMembers) || 4, members.length),
        isLocked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await saveGroup(newGroup);
      await loadAllData();
      setIsCreateModalOpen(false);
      setFormName("");
      setFormCourseCode("");
      setFormSelectedStudentUids([]);
    } catch (err) {
      console.error("Error creating group:", err);
      alert("Failed to create group.");
    } finally {
      setSavingManual(false);
    }
  };

  // Auto-generate teams
  const handleAutoGenerate = async (e: React.FormEvent) => {
    e.preventDefault();

    setGeneratingAuto(true);
    try {
      const course = syllabi.find(s => s.courseCode === autoCourseCode);
      const targetTitle = autoCourseCode && autoCourseCode !== "all" 
        ? (course ? course.title : autoCourseCode) 
        : "All Class Assignments";

      // Filter eligible students in this class level & trade
      const eligibleStudents = students.filter(s => {
        const matchesLevel = s.level === autoLevel;
        const matchesTrade = autoTradeId === "all" || !s.tradeId || s.tradeId === autoTradeId;
        return matchesLevel && matchesTrade;
      });

      if (eligibleStudents.length === 0) {
        alert("No approved students found matching this level and trade.");
        setGeneratingAuto(false);
        return;
      }

      const created = await autoGenerateGroups(
        autoCourseCode || "all",
        targetTitle,
        autoTradeId,
        autoLevel,
        eligibleStudents,
        Number(autoGroupSize) || 4
      );

      if (created.length === 0) {
        alert("All eligible students in this class are already assigned to groups!");
      } else {
        alert(`Successfully generated and enrolled ${created.length} new groups!`);
      }

      await loadAllData();
      setIsAutoModalOpen(false);
    } catch (err) {
      console.error("Error auto-generating groups:", err);
      alert("Failed to auto-generate groups.");
    } finally {
      setGeneratingAuto(false);
    }
  };

  // Find unassigned students for a class cohort (no student can belong to more than one group)
  const getUnassignedStudentsForClass = (level: string, tradeId: string) => {
    const allAssignedUids = new Set<string>();
    groups.forEach(g => g.members.forEach(m => allAssignedUids.add(m.uid)));

    return students.filter(s => {
      if (allAssignedUids.has(s.uid)) return false;
      const matchesLevel = level === "all" || s.level === level;
      const matchesTrade = tradeId === "all" || !s.tradeId || s.tradeId === tradeId;
      return matchesLevel && matchesTrade;
    });
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#334155] bg-[#1E293B]/60 p-12 text-center text-xs font-mono text-[#94A3B8]">
        <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-[#06B6D4] border-t-transparent mb-3" />
        Loading course groups and student rosters...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Stats Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#334155] pb-5">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center space-x-2">
            <Users className="h-6 w-6 text-[#06B6D4]" />
            <span>Course Study &amp; Project Groups</span>
          </h2>
          <p className="text-xs text-[#94A3B8] mt-1">
            Manage peer project teams, balance rosters automatically, lock memberships, and assign group work.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsAutoModalOpen(true)}
            className="inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg hover:from-purple-500 hover:to-indigo-500 transition-all"
          >
            <Sparkles className="h-4 w-4" />
            <span>Auto-Generate Teams</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center space-x-2 rounded-xl bg-[#06B6D4] px-4 py-2.5 text-xs font-bold text-slate-950 shadow-lg hover:bg-[#0891B2] hover:text-white transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Create Group Manually</span>
          </button>
        </div>
      </div>

      {/* Quick Group Work Restrictions Switcher */}
      <RestrictionsControl adminUser={adminUser} />

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#334155] bg-[#1E293B]/80 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[#94A3B8]">Active Teams</span>
            <Layers className="h-4 w-4 text-[#06B6D4]" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">{totalGroups}</div>
          <p className="text-[11px] text-[#64748B] mt-0.5">Across all curriculum courses</p>
        </div>

        <div className="rounded-2xl border border-[#334155] bg-[#1E293B]/80 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[#94A3B8]">Students in Groups</span>
            <Users className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">{totalEnrolled}</div>
          <p className="text-[11px] text-[#64748B] mt-0.5">Registered team members</p>
        </div>

        <div className="rounded-2xl border border-[#334155] bg-[#1E293B]/80 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[#94A3B8]">Approved Students</span>
            <Crown className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">{students.length}</div>
          <p className="text-[11px] text-[#64748B] mt-0.5">Available for group placement</p>
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 to-[#1E293B]/80 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-amber-300">Graded Presentations</span>
            <Award className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-400">{evaluations.length}</div>
          <p className="text-[11px] text-[#94A3B8] mt-0.5">Group &amp; Individual evaluations</p>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex border-b border-[#334155] space-x-6">
        <button
          type="button"
          onClick={() => setActiveTab("groups")}
          className={`pb-3 text-sm font-bold transition-all flex items-center space-x-2 border-b-2 ${
            activeTab === "groups"
              ? "border-[#06B6D4] text-[#06B6D4]"
              : "border-transparent text-[#94A3B8] hover:text-white"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Teams &amp; Groups ({filteredGroups.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("evaluations")}
          className={`pb-3 text-sm font-bold transition-all flex items-center space-x-2 border-b-2 relative ${
            activeTab === "evaluations"
              ? "border-amber-400 text-amber-400"
              : "border-transparent text-[#94A3B8] hover:text-white"
          }`}
        >
          <Award className="h-4 w-4 text-amber-400" />
          <span>Presentation Gradebook</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {evaluations.length} Graded
          </span>
        </button>
      </div>

      {activeTab === "groups" && (
        <div className="space-y-6">

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border border-[#334155] bg-[#1E293B]/50 p-4">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Course Filter */}
          <div className="w-full sm:w-auto">
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] px-3 py-2 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
            >
              <option value="all">All Courses</option>
              {syllabi.map(s => (
                <option key={s.id} value={s.courseCode}>{s.courseCode} - {s.title}</option>
              ))}
            </select>
          </div>

          {/* Level Filter */}
          <div className="w-full sm:w-auto">
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] px-3 py-2 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
            >
              <option value="all">All Levels</option>
              <option value="Level 3">Level 3</option>
              <option value="Level 4">Level 4</option>
              <option value="Level 5">Level 5</option>
              <option value="Level 6">Level 6</option>
            </select>
          </div>

          {/* Trade Filter */}
          <div className="w-full sm:w-auto">
            <select
              value={selectedTrade}
              onChange={(e) => setSelectedTrade(e.target.value)}
              className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] px-3 py-2 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
            >
              <option value="all">All Trades</option>
              {trades.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#64748B]" />
          <input
            type="text"
            placeholder="Search group, member, code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] py-2 pl-9 pr-3 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
          />
        </div>
      </div>

      {/* Groups List Grid */}
      {filteredGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#334155] bg-[#1E293B]/20 p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-[#64748B] mb-2" />
          <h3 className="text-sm font-bold text-white">No Groups Found</h3>
          <p className="text-xs text-[#94A3B8] mt-1 max-w-sm mx-auto">
            No study groups match your filters. Click &quot;Auto-Generate Teams&quot; to divide your class or create a group manually.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGroups.map(group => {
            const unassigned = getUnassignedStudentsForClass(group.level, group.tradeId);
            const isFull = group.members.length >= group.maxMembers;

            return (
              <div 
                key={group.id}
                className="rounded-2xl border border-[#334155] bg-[#1E293B] p-5 shadow-lg hover:border-[#475569] transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-[#334155] pb-3 mb-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-base font-extrabold text-white">{group.name}</h4>
                        {group.isLocked ? (
                          <span className="inline-flex items-center space-x-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[10px] font-mono text-rose-400 border border-rose-500/20">
                            <Lock className="h-3 w-3" />
                            <span>Locked</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-400 border border-emerald-500/20">
                            <Unlock className="h-3 w-3" />
                            <span>Open</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono text-[#06B6D4] mt-0.5">
                        {group.level} Class Group {group.tradeId && group.tradeId !== "all" ? `(${group.tradeId})` : ""} &bull; All Class Assignments
                      </p>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        onClick={() => handleToggleLock(group)}
                        title={group.isLocked ? "Unlock Group (Allow students to join/leave)" : "Lock Group (Freeze membership)"}
                        className={`p-2 rounded-xl text-xs font-semibold transition-all border ${
                          group.isLocked 
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20" 
                            : "bg-[#0B0F19] text-[#94A3B8] border-[#334155] hover:text-white"
                        }`}
                      >
                        {group.isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                      </button>

                      <button
                        onClick={() => handleDeleteGroup(group.id, group.name)}
                        title="Disband Group"
                        className="p-2 rounded-xl bg-[#0B0F19] text-[#94A3B8] border border-[#334155] hover:text-rose-400 hover:border-rose-500/30 transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Join Code Banner */}
                  <div className="flex items-center justify-between rounded-xl bg-[#0B0F19] px-3.5 py-2 border border-[#334155] mb-3.5">
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-mono text-[#94A3B8]">Student Join Code:</span>
                      <span className="text-xs font-mono font-bold text-amber-400 tracking-wider">
                        {group.joinCode}
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopyCode(group.joinCode)}
                      className="inline-flex items-center space-x-1 text-[11px] font-mono text-[#06B6D4] hover:underline"
                    >
                      {copiedCode === group.joinCode ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Presentation Evaluation Banner */}
                  {(() => {
                    const groupEvals = evaluations.filter(e => e.groupId === group.id);
                    const latestEval = groupEvals[0];

                    return (
                      <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-amber-950/30 via-[#0B0F19] to-[#1E293B] px-3.5 py-2.5 border border-amber-500/30 mb-3.5">
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                            <Award className="h-4 w-4 text-amber-400" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-white block truncate">
                              Live Presentation &amp; Defense
                            </span>
                            <span className="text-[10px] text-[#94A3B8] block truncate">
                              {latestEval 
                                ? `Latest: ${latestEval.presentationTitle || "Presentation"} (Group: ${latestEval.groupScore}%)` 
                                : "Score PowerPoint & individual defense"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                          {groupEvals.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setHistoryGroup(group);
                                setIsHistoryDrawerOpen(true);
                              }}
                              title={`View ${groupEvals.length} past evaluation(s)`}
                              className="p-1.5 rounded-lg border border-[#334155] bg-[#0B0F19] text-[#94A3B8] hover:text-white hover:border-[#06B6D4] transition-all"
                            >
                              <History className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenEvaluation(group)}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95"
                          >
                            <Award className="h-3.5 w-3.5 text-slate-950 font-bold" />
                            <span>Grade</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Members List */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono text-[#94A3B8] mb-2">
                      <div className="flex items-center space-x-2">
                        <span>Team Members ({group.members.length} / {group.maxMembers})</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateCapacity(group.id, group.maxMembers, group.members.length)}
                          title="Click to adjust group member limit"
                          className="px-1.5 py-0.5 text-[10px] font-sans font-semibold rounded bg-[#334155]/60 hover:bg-[#334155] text-[#38BDF8] hover:text-white transition-colors border border-[#475569]/40"
                        >
                          Edit Cap
                        </button>
                      </div>
                      <span className="text-[10px] text-[#64748B]">{group.level}</span>
                    </div>

                    <div className="space-y-1.5 mb-3">
                      {group.members.map((m) => (
                        <div 
                          key={m.uid}
                          className="flex items-center justify-between rounded-xl bg-[#0B0F19]/70 px-3 py-2 border border-[#334155]"
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            {m.isLeader ? (
                              <span title="Team Leader" className="inline-flex shrink-0">
                                <Crown className="h-4 w-4 text-amber-400" />
                              </span>
                            ) : (
                              <div className="h-2 w-2 rounded-full bg-[#06B6D4] shrink-0 ml-1 mr-1" />
                            )}
                            <div className="truncate">
                              <span className="text-xs font-bold text-white block truncate">{m.fullName}</span>
                              <span className="text-[10px] font-mono text-[#64748B]">@{m.username}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleRemoveMember(group.id, m.uid, m.fullName)}
                            title="Remove from group"
                            className="p-1 rounded-lg text-[#64748B] hover:text-rose-400 hover:bg-rose-500/10 transition-all shrink-0 ml-2"
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quick Add Student Dropdown (Always available to Admin/Teacher) */}
                {unassigned.length > 0 && (
                  <div className="pt-2 border-t border-[#334155]/60 mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-mono text-[#94A3B8]">
                        Add Student to Team:
                      </label>
                      {isFull && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30">
                          +Auto-expands Cap
                        </span>
                      )}
                    </div>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddMember(group.id, e.target.value);
                          e.target.value = "";
                        }
                      }}
                      defaultValue=""
                      className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-2 text-xs text-[#CBD5E1] focus:border-[#06B6D4] focus:outline-none"
                    >
                      <option value="" disabled>Select unassigned student...</option>
                      {unassigned.map(s => (
                        <option key={s.uid} value={s.uid}>{s.fullName} (@{s.username})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>
      )}

      {/* EVALUATIONS GRADEBOOK TAB */}
      {activeTab === "evaluations" && (
        <div className="space-y-4">
          {/* Evaluations Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border border-[#334155] bg-[#1E293B]/50 p-4">
            <div className="flex items-center space-x-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#64748B]" />
                <input
                  type="text"
                  value={evalSearchQuery}
                  onChange={(e) => setEvalSearchQuery(e.target.value)}
                  placeholder="Search evaluations by group name, topic, or student..."
                  className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] pl-9 pr-3 py-2 text-xs text-white placeholder-[#64748B] focus:border-amber-400 focus:outline-none"
                />
              </div>

              {selectedCourse !== "all" && (
                <span className="text-xs font-mono text-cyan-300 bg-cyan-950/70 border border-cyan-500/30 px-2.5 py-1 rounded-lg shrink-0">
                  Course: {selectedCourse}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => handleExportEvaluationsCSV()}
                disabled={evaluations.length === 0}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-[#334155] bg-[#0B0F19] text-xs font-bold text-[#CBD5E1] hover:text-white hover:border-[#06B6D4] transition-all disabled:opacity-50"
              >
                <Download className="h-4 w-4 text-[#06B6D4]" />
                <span>Export Gradebook (CSV)</span>
              </button>
            </div>
          </div>

          {/* Evaluations List */}
          {(() => {
            const filteredEvaluations = evaluations.filter(ev => {
              if (selectedCourse !== "all" && ev.courseCode && ev.courseCode !== selectedCourse) return false;
              if (evalSearchQuery.trim()) {
                const q = evalSearchQuery.toLowerCase();
                const matchGroup = ev.groupName.toLowerCase().includes(q);
                const matchTitle = (ev.presentationTitle || "").toLowerCase().includes(q);
                const matchCourse = (ev.courseCode || "").toLowerCase().includes(q);
                const matchStudent = Object.values(ev.members || {}).some(m => 
                  m.studentName.toLowerCase().includes(q) || (m.username || "").toLowerCase().includes(q)
                );
                if (!matchGroup && !matchTitle && !matchCourse && !matchStudent) return false;
              }
              return true;
            });

            if (filteredEvaluations.length === 0) {
              return (
                <div className="rounded-3xl border border-[#334155] bg-[#1E293B]/60 p-12 text-center">
                  <Award className="mx-auto h-12 w-12 text-amber-400/40 mb-3" />
                  <h3 className="text-base font-bold text-white">No Presentation Evaluations Recorded</h3>
                  <p className="text-xs text-[#94A3B8] mt-1 max-w-md mx-auto">
                    When students present in class, click &quot;Grade&quot; on their group card to record their group score and individual contributions.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("groups")}
                    className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#06B6D4] text-slate-950 font-bold text-xs hover:bg-[#0891B2] hover:text-white transition-all"
                  >
                    <span>Switch to Groups &amp; Grade Teams &rarr;</span>
                  </button>
                </div>
              );
            }

            return (
              <div className="space-y-4">
                {filteredEvaluations.map((ev) => {
                  const memberList = Object.values(ev.members || {});
                  const groupObj = groups.find(g => g.id === ev.groupId);

                  return (
                    <div
                      key={ev.id}
                      className="rounded-2xl border border-[#334155] bg-[#1E293B] p-5 shadow-lg space-y-4 hover:border-[#475569] transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#334155] pb-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              {ev.groupName}
                            </span>
                            <h4 className="text-base font-bold text-white">{ev.presentationTitle}</h4>
                            {ev.courseCode && (
                              <span className="text-xs text-[#94A3B8] font-mono">
                                ({ev.courseCode})
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#94A3B8] mt-1">
                            <span className="flex items-center space-x-1">
                              <Calendar className="h-3.5 w-3.5 text-[#64748B]" />
                              <span>{new Date(ev.evaluatedAt).toLocaleDateString()}</span>
                            </span>
                            <span>&bull;</span>
                            <span>Evaluator: {ev.evaluatedBy}</span>
                            <span>&bull;</span>
                            <span className="text-amber-300 font-bold">
                              Weights: {ev.groupWeight}% Group / {ev.individualWeight}% Indiv
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <div className="text-right mr-2">
                            <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider block font-mono">
                              Group Score
                            </span>
                            <span className="text-lg font-black text-amber-400 font-mono">
                              {ev.groupScore}%
                            </span>
                          </div>

                          {groupObj && (
                            <button
                              type="button"
                              onClick={() => handleOpenEvaluation(groupObj, ev)}
                              className="p-2 rounded-xl border border-[#334155] bg-[#0B0F19] text-[#94A3B8] hover:text-white hover:border-[#06B6D4] transition-all text-xs"
                              title="Edit Evaluation"
                            >
                              <Sliders className="h-4 w-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteEvaluation(ev.id)}
                            className="p-2 rounded-xl border border-[#334155] bg-[#0B0F19] text-[#94A3B8] hover:text-rose-400 hover:border-rose-500/30 transition-all text-xs"
                            title="Delete Record"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Member Breakdown Grid */}
                      <div>
                        <span className="text-[11px] font-mono text-[#94A3B8] uppercase tracking-wider block mb-2">
                          Individual Student Scores &amp; Breakdown:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {memberList.map((m) => (
                            <div
                              key={m.uid}
                              className={`rounded-xl border p-3 flex flex-col justify-between ${
                                m.status === "absent"
                                  ? "border-rose-500/30 bg-rose-950/20"
                                  : m.status === "partial"
                                  ? "border-amber-500/30 bg-amber-950/10"
                                  : "border-[#334155] bg-[#0B0F19]"
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-white truncate block">
                                    {m.studentName}
                                  </span>
                                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-bold ${
                                    m.status === "absent"
                                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                      : m.status === "partial"
                                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                      : m.status === "minimal"
                                      ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  }`}>
                                    {m.status}
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono text-[#64748B] block">
                                  @{m.username}
                                </span>
                              </div>

                              <div className="mt-2 pt-2 border-t border-[#334155]/60 flex items-center justify-between">
                                <span className="text-[11px] text-[#94A3B8]">
                                  Indiv: <strong className="text-white">{m.individualScore}%</strong>
                                </span>
                                <div className="flex items-center space-x-1">
                                  <span className="text-[10px] text-[#64748B] font-mono">Final:</span>
                                  <span className={`text-sm font-black font-mono ${
                                    m.finalScore >= 80 ? "text-emerald-400" :
                                    m.finalScore >= 60 ? "text-amber-400" : "text-rose-400"
                                  }`}>
                                    {m.finalScore}%
                                  </span>
                                </div>
                              </div>

                              {m.privateFeedback && (
                                <p className="mt-1.5 text-[10px] text-[#94A3B8] italic line-clamp-2 border-t border-[#334155]/40 pt-1">
                                  &ldquo;{m.privateFeedback}&rdquo;
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {ev.groupFeedback && (
                        <div className="rounded-xl bg-[#0B0F19] p-3 text-xs text-[#CBD5E1] border border-[#334155]">
                          <span className="font-bold text-amber-300 block mb-0.5">Team General Feedback:</span>
                          <p className="text-[#94A3B8]">{ev.groupFeedback}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* MODAL: CREATE MANUAL GROUP */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-[#334155] bg-[#1E293B] p-6 shadow-2xl relative">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-5 right-5 text-[#94A3B8] hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-extrabold text-white flex items-center space-x-2 mb-1">
              <UserPlus className="h-5 w-5 text-[#06B6D4]" />
              <span>Create New Study &amp; Project Group</span>
            </h3>
            <p className="text-xs text-[#94A3B8] mb-5">
              Define a new group and assign initial students from your class roster.
            </p>

            <form onSubmit={handleCreateManual} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                  Group / Team Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cloud Innovators, Team Alpha"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-2.5 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                    Course Scope
                  </label>
                  <select
                    value={formCourseCode}
                    onChange={(e) => setFormCourseCode(e.target.value)}
                    className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-2.5 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                  >
                    <option value="all">All Courses in Class (Class-Wide Group - Recommended)</option>
                    {syllabi.map(s => (
                      <option key={s.id} value={s.courseCode}>{s.courseCode} - {s.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                    Target Academic Level *
                  </label>
                  <select
                    value={formLevel}
                    onChange={(e) => setFormLevel(e.target.value as StudentLevel)}
                    className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-2.5 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                  >
                    <option value="Level 3">Level 3</option>
                    <option value="Level 4">Level 4</option>
                    <option value="Level 5">Level 5</option>
                    <option value="Level 6">Level 6</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                    Target Academic Trade
                  </label>
                  <select
                    value={formTradeId}
                    onChange={(e) => setFormTradeId(e.target.value)}
                    className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-2.5 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                  >
                    <option value="all">All Trades in Level</option>
                    {trades.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-[#CBD5E1]">
                      Max Capacity
                    </label>
                    <span className="text-[10px] text-[#94A3B8]">Up to 100 members</span>
                  </div>
                  <input
                    type="number"
                    min={2}
                    max={100}
                    value={formMaxMembers}
                    onChange={(e) => setFormMaxMembers(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-2.5 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[4, 6, 8, 10, 12, 15, 20].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setFormMaxMembers(preset)}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border transition-all ${
                          formMaxMembers === preset
                            ? "bg-[#06B6D4]/20 border-[#06B6D4] text-[#38BDF8]"
                            : "bg-[#0B0F19] border-[#334155] text-[#94A3B8] hover:text-white"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Multi-student selection */}
              <div>
                <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                  Assign Initial Students (Optional)
                </label>
                <div className="max-h-36 overflow-y-auto rounded-xl border border-[#334155] bg-[#0B0F19] p-2 space-y-1">
                  {students.map(s => {
                    const isChecked = formSelectedStudentUids.includes(s.uid);
                    const existingG = groups.find(g => g.members.some(m => m.uid === s.uid));
                    const isAlreadyAssigned = !!existingG;

                    return (
                      <label 
                        key={s.uid}
                        className={`flex items-center justify-between p-1.5 rounded-lg text-xs ${
                          isAlreadyAssigned 
                            ? "opacity-50 cursor-not-allowed bg-[#0B0F19]" 
                            : "hover:bg-[#1E293B] cursor-pointer text-white"
                        }`}
                      >
                        <div className="flex items-center space-x-2 truncate min-w-0">
                          <input
                            type="checkbox"
                            disabled={isAlreadyAssigned}
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormSelectedStudentUids(prev => [...prev, s.uid]);
                              } else {
                                setFormSelectedStudentUids(prev => prev.filter(uid => uid !== s.uid));
                              }
                            }}
                            className="rounded border-[#334155] text-[#06B6D4] focus:ring-0 disabled:opacity-40"
                          />
                          <span className="truncate">{s.fullName}</span>
                          <span className="text-[10px] font-mono text-[#64748B]">(@{s.username})</span>
                        </div>
                        {isAlreadyAssigned && (
                          <span className="text-[10px] text-amber-400/80 shrink-0 font-mono ml-2">
                            (in {existingG.name})
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#334155]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-[#94A3B8] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingManual}
                  className="rounded-xl bg-[#06B6D4] px-5 py-2 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-md disabled:opacity-50"
                >
                  {savingManual ? "Creating Group..." : "Create Group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AUTO-GENERATE GROUPS */}
      {isAutoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-[#334155] bg-[#1E293B] p-6 shadow-2xl relative">
            <button
              onClick={() => setIsAutoModalOpen(false)}
              className="absolute top-5 right-5 text-[#94A3B8] hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-extrabold text-white flex items-center space-x-2 mb-1">
              <Sparkles className="h-5 w-5 text-purple-400" />
              <span>Auto-Generate Balanced Teams</span>
            </h3>
            <p className="text-xs text-[#94A3B8] mb-5">
              Automatically divide all unassigned students in this class level into balanced project groups with instant Join Codes. These groups collaborate on all course assignments.
            </p>

            <form onSubmit={handleAutoGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                  Target Course Scope
                </label>
                <select
                  value={autoCourseCode}
                  onChange={(e) => setAutoCourseCode(e.target.value)}
                  className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-2.5 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                >
                  <option value="all">All Courses in Class (Class-Wide Teams - Recommended)</option>
                  {syllabi.map(s => (
                    <option key={s.id} value={s.courseCode}>{s.courseCode} - {s.title}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                    Student Level *
                  </label>
                  <select
                    value={autoLevel}
                    onChange={(e) => setAutoLevel(e.target.value as StudentLevel)}
                    className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-2.5 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                  >
                    <option value="Level 3">Level 3</option>
                    <option value="Level 4">Level 4</option>
                    <option value="Level 5">Level 5</option>
                    <option value="Level 6">Level 6</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                    Target Trade
                  </label>
                  <select
                    value={autoTradeId}
                    onChange={(e) => setAutoTradeId(e.target.value)}
                    className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-2.5 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                  >
                    <option value="all">All Trades in Class</option>
                    {trades.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-[#CBD5E1]">
                    Desired Students Per Team:
                  </label>
                  <span className="text-[10px] font-mono text-purple-300">Selected: {autoGroupSize} members/group</span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 mb-2">
                  {[2, 3, 4, 5, 6, 8, 10].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setAutoGroupSize(size)}
                      className={`rounded-xl py-2 text-xs font-bold transition-all border ${
                        autoGroupSize === size
                          ? "bg-purple-600 text-white border-purple-500 shadow-md"
                          : "bg-[#0B0F19] text-[#94A3B8] border-[#334155] hover:text-white"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                <div className="flex items-center space-x-2 pt-1">
                  <label className="text-[11px] text-[#94A3B8] whitespace-nowrap">
                    Or custom size:
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={50}
                    value={autoGroupSize}
                    onChange={(e) => setAutoGroupSize(Math.max(2, Number(e.target.value) || 2))}
                    className="w-24 rounded-xl border border-[#334155] bg-[#0B0F19] px-2.5 py-1.5 text-xs text-white focus:border-purple-400 focus:outline-none"
                    placeholder="e.g. 10"
                  />
                  <span className="text-[10px] text-[#64748B]">
                    (e.g., 50 students ÷ 10 = 5 groups)
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-3 text-xs text-purple-300">
                <p>
                  <strong>How it works:</strong> The algorithm checks for students who are not yet in a team for this course, shuffles them randomly, assigns a designated team leader, and creates unique join codes.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#334155]">
                <button
                  type="button"
                  onClick={() => setIsAutoModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-[#94A3B8] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generatingAuto}
                  className="rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:from-purple-500 hover:to-indigo-500 transition-all shadow-md disabled:opacity-50"
                >
                  {generatingAuto ? "Generating Groups..." : "Auto-Generate & Assign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Live Presentation & Defense Grader Modal */}
      {isEvalModalOpen && evaluatingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border border-emerald-500/30 bg-[#0F172A] p-6 shadow-2xl custom-scrollbar">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#334155] pb-4 mb-5">
              <div className="flex items-center space-x-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-bold text-white">
                      Live Presentation & Defense Grader
                    </h3>
                    <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      Live Classroom Mode
                    </span>
                  </div>
                  <p className="text-xs text-[#94A3B8]">
                    Team: <strong className="text-white">{evaluatingGroup.name}</strong> • Members: <span className="text-emerald-400 font-bold">{evaluatingGroup.members.length} students</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setTouchHudMode(!touchHudMode)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    touchHudMode
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-500/20"
                      : "bg-[#1E293B] text-[#94A3B8] border-[#334155] hover:text-white"
                  }`}
                  title="Toggle Quick Touch HUD for tablet/mobile grading"
                >
                  <Tablet className="h-3.5 w-3.5" />
                  <span>{touchHudMode ? "HUD Active" : "Tablet / HUD Mode"}</span>
                </button>
                <button
                  onClick={() => setIsEvalModalOpen(false)}
                  className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#1E293B] hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Offline / PowerPoint Presentation Banner Notice */}
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3.5 mb-5 flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-200/90 leading-relaxed">
                <strong className="text-emerald-300 font-semibold">Offline / PowerPoint Mode:</strong> Students do <span className="underline font-bold text-white">not</span> need to be logged into their group on the web app during the presentation. They can present in front of class using PowerPoint/projector. The instructor grades whole-team delivery and individual member defense here. Students can log in anytime later to see their marks and private feedback.
              </div>
            </div>

            {/* Step 1: Presentation & Course Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-5">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                  Presentation Title / Topic *
                </label>
                <input
                  type="text"
                  value={evalPresentationTitle}
                  onChange={(e) => setEvalPresentationTitle(e.target.value)}
                  placeholder="e.g. Sprint 1 PowerPoint Defense / Architecture Pitch"
                  className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] px-3 py-2 text-xs text-white placeholder-[#64748B] focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                  Associated Course
                </label>
                <select
                  value={evalCourseCode}
                  onChange={(e) => setEvalCourseCode(e.target.value)}
                  className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value={evaluatingGroup.courseCode || ""}>
                    {evaluatingGroup.courseCode ? `${evaluatingGroup.courseCode} (Team Default)` : "Select Course..."}
                  </option>
                  {syllabi
                    .filter(s => s.courseCode !== evaluatingGroup.courseCode)
                    .map(s => (
                      <option key={s.id} value={s.courseCode}>{s.courseCode} - {s.title}</option>
                    ))}
                </select>
              </div>
            </div>

            {/* Step 2: Weight Configuration & Anti-Freeloader Controls */}
            <div className="rounded-xl border border-[#334155] bg-[#0B0F19]/80 p-4 mb-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#334155]/60 pb-3">
                <div className="flex items-center space-x-2">
                  <Sliders className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Grading Weight Formula
                  </span>
                </div>
                {/* Weight Presets */}
                <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                  <span className="text-[10px] text-[#94A3B8] mr-1">Presets:</span>
                  {[
                    { label: "50 / 50 Balanced", gw: 50, iw: 50 },
                    { label: "40 / 60 Indiv-Heavy", gw: 40, iw: 60 },
                    { label: "30 / 70 High Defense", gw: 30, iw: 70 },
                    { label: "60 / 40 Team-Heavy", gw: 60, iw: 40 },
                    { label: "0 / 100 Solo", gw: 0, iw: 100 }
                  ].map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setEvalGroupWeight(p.gw);
                        setEvalIndividualWeight(p.iw);
                      }}
                      className={`rounded-lg px-2 py-1 text-[10px] font-bold transition-all border ${
                        evalGroupWeight === p.gw && evalIndividualWeight === p.iw
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm"
                          : "bg-[#1E293B] text-[#94A3B8] border-[#334155] hover:text-white"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders for Group Weight vs Individual Weight */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[#CBD5E1] font-semibold">Whole Group Score Weight:</span>
                    <span className="font-mono font-bold text-teal-400">{evalGroupWeight}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={evalGroupWeight}
                    onChange={(e) => {
                      const gw = Number(e.target.value);
                      setEvalGroupWeight(gw);
                      setEvalIndividualWeight(100 - gw);
                    }}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                  <p className="text-[10px] text-[#64748B] mt-0.5">Slides, structure, team coordination</p>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[#CBD5E1] font-semibold">Individual Member Defense Weight:</span>
                    <span className="font-mono font-bold text-emerald-400">{evalIndividualWeight}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={evalIndividualWeight}
                    onChange={(e) => {
                      const iw = Number(e.target.value);
                      setEvalIndividualWeight(iw);
                      setEvalGroupWeight(100 - iw);
                    }}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <p className="text-[10px] text-[#64748B] mt-0.5">Speaking, Q&A mastery, depth of defense</p>
                </div>
              </div>

              {/* Strict Zero Penalty Toggle (Anti-Freeloader) */}
              <div className="flex items-center justify-between pt-2 border-t border-[#334155]/40">
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={evalStrictAbsentZero}
                    onChange={(e) => setEvalStrictAbsentZero(e.target.checked)}
                    className="h-4 w-4 rounded border-[#334155] bg-[#0B0F19] text-emerald-500 focus:ring-emerald-400"
                  />
                  <div>
                    <span className="text-xs font-bold text-white">
                      Strict Absent Penalty (Anti-Freeloader Engine)
                    </span>
                    <p className="text-[10px] text-[#94A3B8]">
                      If enabled, any member marked as <span className="text-red-400 font-bold uppercase">Absent</span> receives <strong>0%</strong> final mark, preventing free points from the team's presentation score.
                    </p>
                  </div>
                </label>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  evalStrictAbsentZero 
                    ? "bg-red-500/10 text-red-300 border-red-500/30" 
                    : "bg-[#1E293B] text-[#64748B] border-[#334155]"
                }`}>
                  {evalStrictAbsentZero ? "Strict Active" : "Lenient"}
                </span>
              </div>
            </div>

            {/* Step 3: Whole Group Presentation Evaluation */}
            <div className="rounded-xl border border-teal-500/30 bg-gradient-to-br from-teal-500/5 to-emerald-500/5 p-4 mb-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-teal-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    1. Whole Group Presentation Score
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-[#94A3B8]">Score (0-100):</span>
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={evalGroupScore}
                      onChange={(e) => setEvalGroupScore(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                      className="w-16 rounded-lg border border-teal-500/40 bg-[#0B0F19] p-1.5 text-center text-sm font-bold text-teal-300 focus:border-teal-400 focus:outline-none"
                    />
                    <span className="text-xs font-bold text-teal-400">/ 100</span>
                  </div>
                </div>
              </div>

              {/* Slider for Group Score */}
              <div className="mb-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={evalGroupScore}
                  onChange={(e) => setEvalGroupScore(Number(e.target.value))}
                  className="w-full accent-teal-400 cursor-pointer"
                />
              </div>

              {/* Group Feedback */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-semibold text-[#CBD5E1]">
                    General Group Feedback / Teacher Critique (Visible to all team members)
                  </label>
                  <button
                    type="button"
                    disabled={generatingAiFeedback}
                    onClick={handleAiSuggestFeedback}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[11px] font-bold transition-all disabled:opacity-50"
                  >
                    <Sparkles className="h-3 w-3 text-teal-400" />
                    <span>{generatingAiFeedback ? "Drafting Critique..." : "✨ AI Suggest Feedback"}</span>
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={evalGroupFeedback}
                  onChange={(e) => setEvalGroupFeedback(e.target.value)}
                  placeholder="e.g. Excellent slide visuals, clear problem statement, good coordination. Next time prepare for deep architecture questions..."
                  className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-2.5 text-xs text-white placeholder-[#64748B] focus:border-teal-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Step 4: Individual Member Defense & Participation Grader */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <UserCheck className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    2. Individual Member Defense & Participation
                  </span>
                </div>
                <span className="text-[11px] text-[#94A3B8]">
                  Formula: ({evalGroupScore} × {evalGroupWeight}%) + (Indiv × {evalIndividualWeight}%)
                </span>
              </div>

              {evaluatingGroup.members.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#334155] p-6 text-center text-xs text-[#94A3B8]">
                  This group currently has no members assigned. Add students before evaluating.
                </div>
              ) : (
                evaluatingGroup.members.map((member) => {
                  const mData = evalMembers[member.uid] || {
                    individualScore: evalGroupScore,
                    status: "present" as MemberParticipationStatus,
                    privateFeedback: ""
                  };

                  const computedFinal = calculateMemberFinalScore(
                    evalGroupScore,
                    mData.individualScore,
                    evalGroupWeight,
                    evalIndividualWeight,
                    mData.status,
                    evalStrictAbsentZero
                  );

                  return (
                    <div
                      key={member.uid}
                      className={`rounded-xl border p-3.5 transition-all ${
                        mData.status === "absent"
                          ? "border-red-500/30 bg-red-500/5"
                          : "border-[#334155] bg-[#0B0F19]/70 hover:border-emerald-500/30"
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        {/* Member Identity */}
                        <div className="flex items-center space-x-3 min-w-[220px]">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-sm border ${
                            mData.status === "absent"
                              ? "bg-red-500/20 text-red-300 border-red-500/30"
                              : member.isLeader
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                              : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          }`}>
                            {member.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-white">
                                {member.fullName}
                              </span>
                              {member.isLeader && (
                                <span className="flex items-center text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                                  <Crown className="h-2.5 w-2.5 mr-0.5" />
                                  Leader
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-[#94A3B8]">
                              @{member.username}
                            </span>
                          </div>
                        </div>

                        {/* Defense Status Selector */}
                        <div className="flex items-center space-x-1 flex-wrap gap-1">
                          {(
                            [
                              { val: "present", label: "Defended / Active", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
                              { val: "partial", label: "Partial Defense", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
                              { val: "minimal", label: "Minimal Effort", color: "text-orange-400 border-orange-500/30 bg-orange-500/10" },
                              { val: "absent", label: "Absent / No Show", color: "text-red-400 border-red-500/30 bg-red-500/10" }
                            ] as const
                          ).map((opt) => (
                            <button
                              key={opt.val}
                              type="button"
                              onClick={() => {
                                setEvalMembers(prev => ({
                                  ...prev,
                                  [member.uid]: {
                                    ...mData,
                                    status: opt.val,
                                    individualScore: opt.val === "absent" ? 0 : mData.individualScore
                                  }
                                }));
                              }}
                              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition-all ${
                                mData.status === opt.val
                                  ? `${opt.color} shadow-sm`
                                  : "border-transparent text-[#64748B] hover:text-white"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        {/* Individual Score Input */}
                        <div className="flex items-center space-x-3">
                          <div className="flex flex-col space-y-1">
                            <div className="flex items-center space-x-1.5">
                              <label className="text-[11px] text-[#94A3B8] whitespace-nowrap">
                                Indiv Score:
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                disabled={mData.status === "absent" && evalStrictAbsentZero}
                                value={mData.status === "absent" && evalStrictAbsentZero ? 0 : mData.individualScore}
                                onChange={(e) => {
                                  const val = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                                  setEvalMembers(prev => ({
                                    ...prev,
                                    [member.uid]: {
                                      ...mData,
                                      individualScore: val
                                    }
                                  }));
                                }}
                                className="w-16 rounded-lg border border-[#334155] bg-[#0B0F19] p-1.5 text-center text-xs font-bold text-white focus:border-emerald-400 focus:outline-none disabled:opacity-40"
                              />
                              <span className="text-xs text-[#64748B]">/100</span>
                            </div>

                            {/* Touch Scorer Quick Pills (visible on touchHudMode or small devices) */}
                            {(touchHudMode || true) && (
                              <div className="flex items-center space-x-1 pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = Math.max(0, mData.individualScore - 5);
                                    setEvalMembers(prev => ({
                                      ...prev,
                                      [member.uid]: { ...mData, individualScore: next }
                                    }));
                                  }}
                                  className="h-6 w-6 rounded bg-[#1E293B] hover:bg-[#334155] text-xs font-bold text-[#94A3B8] hover:text-white transition-all flex items-center justify-center border border-[#334155]"
                                  title="Subtract 5"
                                >
                                  -5
                                </button>
                                {[60, 75, 85, 95].map((preset) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => {
                                      setEvalMembers(prev => ({
                                        ...prev,
                                        [member.uid]: { ...mData, individualScore: preset }
                                      }));
                                    }}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all ${
                                      mData.individualScore === preset
                                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                        : "bg-[#0B0F19] text-[#94A3B8] border-[#334155] hover:text-white"
                                    }`}
                                  >
                                    {preset}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = Math.min(100, mData.individualScore + 5);
                                    setEvalMembers(prev => ({
                                      ...prev,
                                      [member.uid]: { ...mData, individualScore: next }
                                    }));
                                  }}
                                  className="h-6 w-6 rounded bg-[#1E293B] hover:bg-[#334155] text-xs font-bold text-[#94A3B8] hover:text-white transition-all flex items-center justify-center border border-[#334155]"
                                  title="Add 5"
                                >
                                  +5
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Computed Final Score Badge */}
                          <div className="flex flex-col items-end min-w-[90px]">
                            <span className="text-[10px] text-[#64748B]">Final Mark:</span>
                            <span className={`text-base font-extrabold font-mono ${
                              mData.status === "absent" && evalStrictAbsentZero
                                ? "text-red-400"
                                : computedFinal >= 80
                                ? "text-emerald-400"
                                : computedFinal >= 60
                                ? "text-amber-400"
                                : "text-rose-400"
                            }`}>
                              {computedFinal}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Individual Private Feedback */}
                      <div className="mt-2.5 pt-2 border-t border-[#334155]/40 flex items-center space-x-2">
                        <span className="text-[10px] font-semibold text-[#64748B] whitespace-nowrap">
                          Private Note:
                        </span>
                        <input
                          type="text"
                          value={mData.privateFeedback || ""}
                          onChange={(e) => {
                            const note = e.target.value;
                            setEvalMembers(prev => ({
                              ...prev,
                              [member.uid]: {
                                ...mData,
                                privateFeedback: note
                              }
                            }));
                          }}
                          placeholder={`Private teacher feedback for ${member.fullName.split(" ")[0]} (visible only to this student)...`}
                          className="w-full rounded-lg border border-[#334155]/60 bg-[#0B0F19]/90 px-2.5 py-1 text-[11px] text-[#CBD5E1] placeholder-[#64748B] focus:border-emerald-400 focus:outline-none"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-[#334155]">
              <div className="text-xs text-[#94A3B8]">
                Marks are saved instantly to database & local cache for students to view.
              </div>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsEvalModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-[#94A3B8] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEvaluation}
                  disabled={savingEvaluation}
                  className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs font-bold text-white hover:from-emerald-500 hover:to-teal-500 transition-all shadow-md disabled:opacity-50 flex items-center space-x-2"
                >
                  <Award className="h-4 w-4" />
                  <span>{savingEvaluation ? "Saving Presentation Marks..." : "Publish & Save Marks"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Team Presentation History Drawer / Modal */}
      {isHistoryDrawerOpen && historyGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-2xl border border-[#334155] bg-[#0F172A] p-6 shadow-2xl custom-scrollbar">
            {/* Drawer Header */}
            <div className="flex items-start justify-between border-b border-[#334155] pb-4 mb-4">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Presentation Grade History: {historyGroup.name}
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    Past classroom presentations, evaluations, and individual breakdowns
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsHistoryDrawerOpen(false)}
                className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#1E293B] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* List of Previous Evaluations for this Group */}
            {(() => {
              const groupEvals = evaluations.filter(e => e.groupId === historyGroup.id);
              if (groupEvals.length === 0) {
                return (
                  <div className="py-12 text-center">
                    <Award className="h-10 w-10 text-[#64748B] mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-semibold text-white mb-1">No presentation evaluations yet</p>
                    <p className="text-xs text-[#94A3B8] mb-4">
                      This group has not been graded for any live presentations or slide defenses.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsHistoryDrawerOpen(false);
                        handleOpenEvaluation(historyGroup);
                      }}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-all shadow-md inline-flex items-center space-x-1.5"
                    >
                      <Award className="h-3.5 w-3.5" />
                      <span>Start First Evaluation</span>
                    </button>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {groupEvals.map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded-xl border border-[#334155] bg-[#0B0F19] p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-bold text-white">{ev.presentationTitle}</span>
                            <span className="rounded-full bg-teal-500/20 text-teal-300 text-[10px] font-bold px-2 py-0.5 border border-teal-500/30">
                              {ev.courseCode || "General"}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#64748B] mt-0.5">
                            Evaluated by {ev.evaluatedBy || "Instructor"} on {new Date(ev.evaluatedAt).toLocaleDateString()} at {new Date(ev.evaluatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              setIsHistoryDrawerOpen(false);
                              handleOpenEvaluation(historyGroup, ev);
                            }}
                            className="rounded-lg bg-[#1E293B] hover:bg-[#334155] text-white px-2.5 py-1 text-xs font-semibold transition-all border border-[#334155]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEvaluation(ev.id)}
                            className="rounded-lg p-1 text-[#94A3B8] hover:text-red-400 transition-all"
                            title="Delete this evaluation"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Group Deliverable Score & Weightings */}
                      <div className="grid grid-cols-3 gap-2 rounded-lg bg-[#0F172A] p-2.5 text-center border border-[#334155]/60 text-xs">
                        <div>
                          <span className="text-[10px] text-[#64748B] block">Whole Group Score</span>
                          <span className="font-bold text-teal-400 text-sm">{ev.groupScore}%</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#64748B] block">Weight Distribution</span>
                          <span className="font-semibold text-white text-xs">{ev.groupWeight}% Team / {ev.individualWeight}% Indiv</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#64748B] block">Absent Penalty</span>
                          <span className={`font-semibold text-xs ${ev.strictAbsentZero ? "text-red-400" : "text-[#94A3B8]"}`}>
                            {ev.strictAbsentZero ? "Strict 0%" : "Lenient"}
                          </span>
                        </div>
                      </div>

                      {/* Group Feedback */}
                      {ev.groupFeedback && (
                        <div className="rounded-lg bg-teal-500/10 border border-teal-500/20 p-2.5 text-xs text-teal-200">
                          <strong className="text-teal-300">Team Feedback:</strong> {ev.groupFeedback}
                        </div>
                      )}

                      {/* Members Breakdown Table */}
                      <div className="border-t border-[#334155]/60 pt-2">
                        <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1.5">
                          Member Individual Defense Marks:
                        </span>
                        <div className="space-y-1">
                          {Object.values(ev.members || {}).map((m) => (
                            <div
                              key={m.uid}
                              className="flex items-center justify-between rounded-lg bg-[#0F172A] px-2.5 py-1.5 text-xs"
                            >
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold text-white">{m.studentName}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded border ${
                                  m.status === "absent"
                                    ? "bg-red-500/10 text-red-300 border-red-500/30"
                                    : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                                }`}>
                                  {m.status}
                                </span>
                              </div>
                              <div className="flex items-center space-x-3 font-mono">
                                <span className="text-[11px] text-[#94A3B8]">
                                  Defense: {m.individualScore}%
                                </span>
                                <span className="text-emerald-400 font-bold">
                                  Final: {m.finalScore}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Drawer Footer */}
            <div className="flex items-center justify-end pt-4 mt-5 border-t border-[#334155]">
              <button
                type="button"
                onClick={() => setIsHistoryDrawerOpen(false)}
                className="rounded-xl bg-[#1E293B] px-4 py-2 text-xs font-bold text-white hover:bg-[#334155]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
