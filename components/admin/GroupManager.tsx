"use client";

import React, { useState, useEffect } from "react";
import { StudentGroup, GroupMember } from "@/types/group";
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
  getAllUserProfiles 
} from "@/lib/db";
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
  BookOpen
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
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [selectedTrade, setSelectedTrade] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAutoModalOpen, setIsAutoModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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
      const [allG, allUsers] = await Promise.all([
        getAllGroups(),
        getAllUserProfiles()
      ]);
      setGroups(allG);
      setStudents(allUsers.filter(u => u.role === "student" && u.status === "approved"));
    } catch (err) {
      console.error("Error loading groups & students:", err);
    } finally {
      setLoading(false);
    }
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <Crown className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">{students.length}</div>
          <p className="text-[11px] text-[#64748B] mt-0.5">Available for group placement</p>
        </div>
      </div>

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
    </div>
  );
}
