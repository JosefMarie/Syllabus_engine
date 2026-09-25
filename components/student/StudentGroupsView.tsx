"use client";

import React, { useState, useEffect } from "react";
import { StudentGroup, GroupMember } from "@/types/group";
import { UserProfile } from "@/types/auth";
import { Syllabus } from "@/types/syllabus";
import { 
  getStudentGroups, 
  saveGroup, 
  leaveGroup, 
  joinGroupByCode, 
  generateGroupJoinCode 
} from "@/lib/db";
import { 
  Users, 
  UserPlus, 
  Plus, 
  Copy, 
  Check, 
  Key, 
  Crown, 
  Lock, 
  LogOut, 
  X, 
  Sparkles, 
  Layers, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";

interface StudentGroupsViewProps {
  currentUser: UserProfile;
  syllabi?: Syllabus[];
  onNavigateToAssignments?: () => void;
}

export default function StudentGroupsView({ 
  currentUser, 
  syllabi = [],
  onNavigateToAssignments
}: StudentGroupsViewProps) {
  const [myGroups, setMyGroups] = useState<StudentGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Create Form
  const [createCourseCode, setCreateCourseCode] = useState("");
  const [createGroupName, setCreateGroupName] = useState("");
  const [createMaxMembers, setCreateMaxMembers] = useState(4);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Join Form
  const [inputJoinCode, setInputJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinMsg, setJoinMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filter available courses for student's level & trade
  const studentCourses = syllabi.filter(s => {
    const matchesLevel = !s.level || s.level === currentUser.level;
    const matchesTrade = !s.tradeId || s.tradeId === "all" || !currentUser.tradeId || s.tradeId === currentUser.tradeId;
    return matchesLevel && matchesTrade;
  });

  useEffect(() => {
    loadGroups();
  }, [currentUser?.uid]);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const data = await getStudentGroups(currentUser.uid);
      setMyGroups(data);
    } catch (err) {
      console.error("Error loading student groups:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = (code: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  // Student Creates Group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createGroupName.trim()) {
      setCreateError("Please provide a group name.");
      return;
    }

    // Strict Policy: Each student can only belong to ONE group in their class
    if (myGroups.length > 0) {
      setCreateError(`You are already enrolled in "${myGroups[0].name}". In this class, each student can only belong to one group across all courses.`);
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const matchedCourse = syllabi.find(s => s.courseCode === createCourseCode);
      const newGroupId = `grp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const joinCode = generateGroupJoinCode();

      const initialMember: GroupMember = {
        uid: currentUser.uid,
        fullName: currentUser.fullName,
        username: currentUser.username,
        joinedAt: new Date().toISOString(),
        isLeader: true
      };

      const newGroup: StudentGroup = {
        id: newGroupId,
        name: createGroupName.trim(),
        courseCode: createCourseCode || "all",
        courseTitle: createCourseCode ? (matchedCourse ? matchedCourse.title : createCourseCode) : "All Class Assignments",
        tradeId: currentUser.tradeId || "all",
        level: currentUser.level,
        joinCode,
        createdByUid: currentUser.uid,
        leaderName: currentUser.fullName,
        members: [initialMember],
        maxMembers: Number(createMaxMembers) || 4,
        isLocked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await saveGroup(newGroup);
      setMyGroups(prev => [newGroup, ...prev]);
      setIsCreateModalOpen(false);
      setCreateCourseCode("");
      setCreateGroupName("");
    } catch (err: any) {
      console.error("Create group error:", err);
      setCreateError(err.message || "Failed to create group.");
    } finally {
      setCreating(false);
    }
  };

  // Student Joins with Code
  const handleJoinWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputJoinCode.trim()) return;

    if (myGroups.length > 0) {
      setJoinMsg({ 
        type: "error", 
        text: `You are already enrolled in "${myGroups[0].name}". In this class, each student can only belong to one group across all courses. Please leave your current group before joining another.` 
      });
      return;
    }

    setJoining(true);
    setJoinMsg(null);
    try {
      const res = await joinGroupByCode(currentUser, inputJoinCode.trim());
      if (res.success && res.group) {
        setJoinMsg({ type: "success", text: res.message });
        setMyGroups(prev => [res.group!, ...prev.filter(g => g.id !== res.group!.id)]);
        setTimeout(() => {
          setIsJoinModalOpen(false);
          setInputJoinCode("");
          setJoinMsg(null);
        }, 1500);
      } else {
        setJoinMsg({ type: "error", text: res.message });
      }
    } catch (err: any) {
      setJoinMsg({ type: "error", text: err.message || "Failed to join group." });
    } finally {
      setJoining(false);
    }
  };

  // Student Leaves Group
  const handleLeaveGroup = async (group: StudentGroup) => {
    if (group.isLocked) {
      alert("This group is locked by the course instructor. You cannot leave at this time.");
      return;
    }

    if (confirm(`Are you sure you want to leave "${group.name}"?`)) {
      const res = await leaveGroup(currentUser.uid, group.id);
      if (res.success) {
        setMyGroups(prev => prev.filter(g => g.id !== group.id));
      } else {
        alert(res.message);
      }
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#334155] bg-[#1E293B]/60 p-12 text-center text-xs font-mono text-[#94A3B8]">
        <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-[#06B6D4] border-t-transparent mb-3" />
        Loading your study groups...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#334155] pb-5">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center space-x-2">
            <Users className="h-5 w-5 text-[#06B6D4]" />
            <span>My Study &amp; Project Groups</span>
          </h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Collaborate on course assignments, form teams with classmates, and submit group work together.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setIsJoinModalOpen(true)}
            className="inline-flex items-center space-x-2 rounded-xl border border-[#334155] bg-[#1E293B] px-4 py-2.5 text-xs font-bold text-[#CBD5E1] hover:text-white hover:border-[#06B6D4] transition-all"
          >
            <Key className="h-4 w-4 text-amber-400" />
            <span>Join with Code</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center space-x-2 rounded-xl bg-[#06B6D4] px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>Create a Group</span>
          </button>
        </div>
      </div>

      {/* Banner if already enrolled in a group */}
      {myGroups.length > 0 && (
        <div className="rounded-2xl border border-[#06B6D4]/30 bg-[#06B6D4]/10 p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="h-5 w-5 text-[#06B6D4] shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-white block">Official Class Group: {myGroups[0].name}</span>
              <span className="text-[#94A3B8]">
                This is your designated team for your entire class. This group will automatically collaborate and submit on all group assignments across all courses and modules.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Groups List */}
      {myGroups.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#334155] bg-[#1E293B]/30 p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#06B6D4]/10 border border-[#06B6D4]/20 text-[#06B6D4] mb-3">
            <Users className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-white">No Groups Joined Yet</h3>
          <p className="text-xs text-[#94A3B8] max-w-md mx-auto mt-1 mb-5">
            You haven&apos;t joined any project or study teams yet. Create a group for one of your courses or join an existing group with your friend&apos;s code!
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center space-x-2 rounded-xl bg-[#06B6D4] px-4 py-2 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Create New Group</span>
            </button>
            <button
              onClick={() => setIsJoinModalOpen(true)}
              className="inline-flex items-center space-x-2 rounded-xl border border-[#334155] bg-[#1E293B] px-4 py-2 text-xs font-bold text-white hover:border-[#06B6D4] transition-all"
            >
              <Key className="h-4 w-4 text-amber-400" />
              <span>Enter Join Code</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {myGroups.map((group) => {
            const isUserLeader = group.members.some(m => m.uid === currentUser.uid && m.isLeader);

            return (
              <div
                key={group.id}
                className="rounded-3xl border border-[#334155] bg-[#1E293B] p-5 shadow-xl flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-3 border-b border-[#334155] pb-3 mb-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-base font-extrabold text-white">{group.name}</h4>
                        {isUserLeader && (
                          <span className="inline-flex items-center space-x-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-400 border border-amber-500/20">
                            <Crown className="h-3 w-3" />
                            <span>Leader</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono text-[#06B6D4] mt-0.5">
                        {group.level} Class Team &bull; Works on All Courses &amp; Assignments
                      </p>
                    </div>

                    {group.isLocked ? (
                      <span className="inline-flex items-center space-x-1 rounded-lg bg-rose-500/10 px-2.5 py-1 text-[11px] font-mono text-rose-400 border border-rose-500/20 shrink-0">
                        <Lock className="h-3.5 w-3.5" />
                        <span>Roster Locked</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[11px] font-mono text-emerald-400 border border-emerald-500/20 shrink-0">
                        <span>Open Team</span>
                      </span>
                    )}
                  </div>

                  {/* Share Code Box */}
                  <div className="rounded-2xl bg-[#0B0F19] p-3 border border-[#334155] mb-3.5 flex items-center justify-between">
                    <div>
                      <span className="block text-[10px] font-mono text-[#64748B] uppercase tracking-wider">
                        Invite Classmates (Join Code)
                      </span>
                      <span className="text-sm font-mono font-extrabold text-amber-400 tracking-wider">
                        {group.joinCode}
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopyCode(group.joinCode)}
                      className="inline-flex items-center space-x-1.5 rounded-xl border border-[#334155] bg-[#1E293B] px-3 py-1.5 text-xs font-bold text-white hover:border-[#06B6D4] transition-all"
                    >
                      {copiedCode === group.joinCode ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-[#06B6D4]" />
                          <span>Copy Code</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Members */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono text-[#94A3B8] mb-2">
                      <span>Roster ({group.members.length} / {group.maxMembers} members)</span>
                      <span>Level: {group.level}</span>
                    </div>

                    <div className="space-y-1.5 mb-4">
                      {group.members.map((member) => (
                        <div
                          key={member.uid}
                          className="flex items-center justify-between rounded-xl bg-[#0B0F19]/60 px-3 py-2 border border-[#334155]"
                        >
                          <div className="flex items-center space-x-2">
                            {member.isLeader ? (
                              <span title="Group Leader" className="inline-flex shrink-0">
                                <Crown className="h-4 w-4 text-amber-400" />
                              </span>
                            ) : (
                              <div className="h-2 w-2 rounded-full bg-[#06B6D4] shrink-0 ml-1 mr-1" />
                            )}
                            <div>
                              <span className="text-xs font-bold text-white block">
                                {member.fullName} {member.uid === currentUser.uid ? "(You)" : ""}
                              </span>
                              <span className="text-[10px] font-mono text-[#64748B]">@{member.username}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-[#334155] flex items-center justify-between">
                  {onNavigateToAssignments && (
                    <button
                      onClick={onNavigateToAssignments}
                      className="inline-flex items-center space-x-1.5 text-xs font-mono text-[#06B6D4] hover:underline"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>View Course Assignments &rarr;</span>
                    </button>
                  )}

                  {!group.isLocked && (
                    <button
                      onClick={() => handleLeaveGroup(group)}
                      className="inline-flex items-center space-x-1.5 text-xs text-rose-400 hover:text-rose-300 ml-auto transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Leave Team</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: CREATE GROUP */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-[#334155] bg-[#1E293B] p-6 shadow-2xl relative">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-5 right-5 text-[#94A3B8] hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-extrabold text-white flex items-center space-x-2 mb-1">
              <UserPlus className="h-5 w-5 text-[#06B6D4]" />
              <span>Create a Study Group</span>
            </h3>
            <p className="text-xs text-[#94A3B8] mb-5">
              Pick your course, choose a team name, and get a code to invite your peers.
            </p>

            {createError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div className="rounded-xl bg-[#0B0F19] p-3 border border-[#334155] space-y-1">
                <span className="text-[11px] font-mono text-[#94A3B8] block">Class Cohort:</span>
                <span className="text-xs font-bold text-white block">
                  {currentUser.level} Class {currentUser.tradeId && currentUser.tradeId !== "all" ? `(${currentUser.tradeId})` : ""}
                </span>
                <span className="text-[10px] text-[#06B6D4] block">
                  This group is class-wide and works together on all assigned projects across all subjects and courses.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                  Group / Team Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Code Ninjas, Team Alpha"
                  value={createGroupName}
                  onChange={(e) => setCreateGroupName(e.target.value)}
                  className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-2.5 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                  Maximum Team Size
                </label>
                <select
                  value={createMaxMembers}
                  onChange={(e) => setCreateMaxMembers(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-2.5 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                >
                  <option value={2}>2 Members (Pair)</option>
                  <option value={3}>3 Members</option>
                  <option value={4}>4 Members (Standard)</option>
                  <option value={5}>5 Members</option>
                  <option value={6}>6 Members</option>
                  <option value={8}>8 Members</option>
                  <option value={10}>10 Members (Large Team)</option>
                  <option value={12}>12 Members</option>
                  <option value={15}>15 Members</option>
                </select>
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
                  disabled={creating}
                  className="rounded-xl bg-[#06B6D4] px-5 py-2 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-md disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: JOIN WITH CODE */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-[#334155] bg-[#1E293B] p-6 shadow-2xl relative">
            <button
              onClick={() => setIsJoinModalOpen(false)}
              className="absolute top-5 right-5 text-[#94A3B8] hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-extrabold text-white flex items-center space-x-2 mb-1">
              <Key className="h-5 w-5 text-amber-400" />
              <span>Join a Study Group</span>
            </h3>
            <p className="text-xs text-[#94A3B8] mb-5">
              Enter the 6-character Join Code given to you by your team leader or instructor.
            </p>

            {joinMsg && (
              <div className={`p-3 mb-4 rounded-xl text-xs flex items-center space-x-2 border ${
                joinMsg.type === "success" 
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                  : "bg-rose-500/10 border-rose-500/30 text-rose-400"
              }`}>
                {joinMsg.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                <span>{joinMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleJoinWithCode} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                  Group Join Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GRP-482"
                  value={inputJoinCode}
                  onChange={(e) => setInputJoinCode(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-center text-lg font-mono font-bold tracking-widest text-amber-400 placeholder-[#64748B] focus:border-amber-400 focus:outline-none uppercase"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#334155]">
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-[#94A3B8] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joining || !inputJoinCode.trim()}
                  className="rounded-xl bg-amber-400 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 transition-all shadow-md disabled:opacity-50"
                >
                  {joining ? "Joining..." : "Join Team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
