"use client";

import React, { useEffect, useState } from "react";
import { UserProfile, Trade } from "@/types/auth";
import { getAllUserProfiles, updateStudentStatus, getAllTrades, logActivity, deleteUserProfile, resetStudentUnfocusedCount } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { UserCheck, Check, X, ShieldAlert, Clock, CheckCircle2, Trash2, AlertTriangle, RotateCcw, Search, GraduationCap, Filter } from "lucide-react";

export default function StudentApprovals() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [tradesMap, setTradesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'suspended' | 'all'>('pending');
  const [levelFilter, setLevelFilter] = useState<'all' | 'Level 3' | 'Level 4' | 'Level 5'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [bulkApproving, setBulkApproving] = useState(false);

  useEffect(() => {
    async function load() {
      const allProfiles = await getAllUserProfiles();
      setUsers(allProfiles);

      const trades = await getAllTrades();
      const map: Record<string, string> = {};
      trades.forEach(t => map[t.id] = t.name);
      setTradesMap(map);

      setLoading(false);
    }
    load();
  }, []);

  const handleApproveAll = async () => {
    // Target all pending and suspended students
    const targets = users.filter(u => u.status === 'pending_approval' || (u.unfocusedCount || 0) >= 10);
    if (targets.length === 0) {
      alert("There are no pending or suspended students to approve.");
      return;
    }

    const confirmMsg = `Are you sure you want to approve all ${targets.length} pending/suspended students? This will grant them active access and reset their side-window strikes to 0.`;
    if (!window.confirm(confirmMsg)) return;

    setBulkApproving(true);
    const admin = getAdminSession();

    try {
      await Promise.all(
        targets.map(async (u) => {
          await updateStudentStatus(u.uid, 'approved');
        })
      );

      const targetUids = new Set(targets.map(t => t.uid));
      setUsers(prev => prev.map(u => targetUids.has(u.uid) ? {
        ...u,
        status: 'approved',
        unfocusedCount: 0,
        suspensionReason: ''
      } : u));

      if (admin) {
        await logActivity({
          userId: admin.uid,
          userName: admin.fullName,
          userEmail: admin.email,
          userLevel: admin.level,
          action: 'APPROVE_STUDENT_BATCH',
          details: `Batch-approved ${targets.length} students (reset all focus strikes to 0).`
        });
      }
    } catch (err) {
      console.error("Bulk approval error:", err);
      alert("An error occurred while approving some students.");
    } finally {
      setBulkApproving(false);
    }
  };

  const handleStatusChange = async (uid: string, status: 'approved' | 'rejected') => {
    await updateStudentStatus(uid, status);
    const targetUser = users.find(u => u.uid === uid);
    const admin = getAdminSession();

    setUsers(users.map(u => u.uid === uid ? { 
      ...u, 
      status,
      unfocusedCount: status === 'approved' ? 0 : u.unfocusedCount,
      suspensionReason: status === 'approved' ? '' : u.suspensionReason
    } : u));

    if (targetUser && admin) {
      await logActivity({
        userId: admin.uid,
        userName: admin.fullName,
        userEmail: admin.email,
        userLevel: admin.level,
        action: status === 'approved' ? 'APPROVE_STUDENT' : 'REJECT_STUDENT',
        details: `${status === 'approved' ? 'Approved (focus strikes reset)' : 'Rejected'} student ${targetUser.fullName} (${targetUser.email}) for level ${targetUser.level}`
      });
    }
  };

  const handleResetStrikes = async (uid: string, name: string) => {
    await resetStudentUnfocusedCount(uid);
    setUsers(users.map(u => u.uid === uid ? { ...u, unfocusedCount: 0, suspensionReason: '', status: 'pending_approval' } : u));
    const admin = getAdminSession();
    if (admin) {
      await logActivity({
        userId: admin.uid,
        userName: admin.fullName,
        userEmail: admin.email,
        userLevel: admin.level,
        action: 'RESET_FOCUS_STRIKES',
        details: `Reset side-window / focus strikes to 0 for student ${name} (moved to Pending Approval)`
      });
    }
  };

  const handleDeleteUser = async (uid: string, name: string) => {
    const ok = window.confirm(`Are you sure you want to delete student account "${name}"?`);
    if (!ok) return;

    await deleteUserProfile(uid);
    setUsers(users.filter(u => u.uid !== uid));
  };

  // Combined Multi-Dimensional Filtering: Status Tab + Level + Search Query (name, username, email)
  const filteredUsers = users.filter((u) => {
    // 1. Status Filter
    if (filter === 'pending' && u.status !== 'pending_approval') return false;
    if (filter === 'approved' && u.status !== 'approved') return false;
    if (filter === 'suspended') {
      const isSuspended = (u.unfocusedCount || 0) >= 10 || (u.status === 'rejected' && !!u.suspensionReason);
      if (!isSuspended) return false;
    }

    // 2. Level Filter
    if (levelFilter !== 'all' && u.level !== levelFilter) {
      return false;
    }

    // 3. Search Query Filter (name, username, email)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = (u.fullName || '').toLowerCase().includes(q);
      const matchUsername = (u.username || '').toLowerCase().includes(q);
      const matchEmail = (u.email || '').toLowerCase().includes(q);
      if (!matchName && !matchUsername && !matchEmail) {
        return false;
      }
    }

    return true;
  });

  const pendingCount = users.filter(u => u.status === 'pending_approval').length;
  const approvedCount = users.filter(u => u.status === 'approved').length;
  const rejectedCount = users.filter(u => u.status === 'rejected').length;
  const suspendedCount = users.filter(u => (u.unfocusedCount || 0) >= 10 || (u.status === 'rejected' && !!u.suspensionReason)).length;
  const eligibleToApproveCount = users.filter(u => u.status === 'pending_approval' || (u.unfocusedCount || 0) >= 10).length;

  const level3Count = users.filter(u => u.level === 'Level 3').length;
  const level4Count = users.filter(u => u.level === 'Level 4').length;
  const level5Count = users.filter(u => u.level === 'Level 5').length;

  const isFiltered = searchQuery.trim().length > 0 || levelFilter !== 'all';

  return (
    <div className="space-y-6">
      {/* Top Statistical Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 p-5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-mono font-bold text-[#F59E0B] uppercase tracking-wider block mb-1">
              Pending Verification
            </span>
            <span className="text-3xl font-extrabold text-white font-mono">
              {pendingCount}
            </span>
            <span className="text-[11px] text-[#94A3B8] block mt-1">Students awaiting access</span>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F59E0B]/20 text-[#F59E0B]">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-2xl border border-[#10B981]/30 bg-[#10B981]/10 p-5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-mono font-bold text-[#10B981] uppercase tracking-wider block mb-1">
              Approved Accounts
            </span>
            <span className="text-3xl font-extrabold text-white font-mono">
              {approvedCount}
            </span>
            <span className="text-[11px] text-[#94A3B8] block mt-1">Active syllabus access</span>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#10B981]/20 text-[#10B981]">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-mono font-bold text-rose-400 uppercase tracking-wider block mb-1">
              Suspended (10 Strikes)
            </span>
            <span className="text-3xl font-extrabold text-rose-400 font-mono">
              {suspendedCount}
            </span>
            <span className="text-[11px] text-[#94A3B8] block mt-1">Exceeded side windows</span>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Rejected Requests
            </span>
            <span className="text-3xl font-extrabold text-white font-mono">
              {rejectedCount}
            </span>
            <span className="text-[11px] text-[#94A3B8] block mt-1">Denied registration</span>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-700/30 text-slate-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Header & Status Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#334155] pb-4 gap-4">
        <div>
          <h3 className="text-lg font-bold text-white">Student Registration Verification & Focus Enforcement</h3>
          <p className="text-xs text-[#94A3B8]">
            Review student status, side-window focus strikes, and re-approve suspended accounts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {eligibleToApproveCount > 0 && (
            <button
              onClick={handleApproveAll}
              disabled={bulkApproving}
              title="Batch-approve all pending & suspended students at once"
              className="inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs px-3.5 py-2 shadow-lg shadow-emerald-950/40 border border-emerald-400/40 transition-all active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4 text-white" />
              <span>{bulkApproving ? "Approving All..." : `Approve All (${eligibleToApproveCount})`}</span>
            </button>
          )}

          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[#1E293B] p-1 border border-[#334155]">
            <button
              onClick={() => setFilter('pending')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                filter === 'pending' ? 'bg-[#F59E0B]/20 text-[#F59E0B] font-bold' : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setFilter('suspended')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                filter === 'suspended' ? 'bg-rose-500/20 text-rose-400 font-bold' : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              Suspended ({suspendedCount})
            </button>
            <button
              onClick={() => setFilter('approved')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                filter === 'approved' ? 'bg-[#10B981]/20 text-[#10B981] font-bold' : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              Approved ({approvedCount})
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                filter === 'all' ? 'bg-[#06B6D4]/20 text-[#06B6D4] font-bold' : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              All ({users.length})
            </button>
          </div>
        </div>
      </div>

      {/* Real-Time Multi-Field Search & Level Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#1E293B]/80 p-3 rounded-2xl border border-[#334155] shadow-lg">
        {/* Search Input (Names, Username, Email) */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student name, username, or email across all categories..."
            className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] py-2 pl-10 pr-9 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white p-0.5 rounded-md transition-colors"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Level Filter Selector */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center space-x-1.5 text-xs text-[#94A3B8] font-mono pl-1">
            <GraduationCap className="h-3.5 w-3.5 text-[#06B6D4]" />
            <span className="hidden sm:inline">Level:</span>
          </div>

          <div className="flex items-center rounded-xl bg-[#0B0F19] p-1 border border-[#334155] gap-1">
            <button
              onClick={() => setLevelFilter('all')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                levelFilter === 'all'
                  ? 'bg-[#06B6D4] text-slate-950 font-bold shadow-xs'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              All Levels ({users.length})
            </button>
            <button
              onClick={() => setLevelFilter('Level 3')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                levelFilter === 'Level 3'
                  ? 'bg-[#06B6D4] text-slate-950 font-bold shadow-xs'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              Level 3 ({level3Count})
            </button>
            <button
              onClick={() => setLevelFilter('Level 4')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                levelFilter === 'Level 4'
                  ? 'bg-[#06B6D4] text-slate-950 font-bold shadow-xs'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              Level 4 ({level4Count})
            </button>
            <button
              onClick={() => setLevelFilter('Level 5')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                levelFilter === 'Level 5'
                  ? 'bg-[#06B6D4] text-slate-950 font-bold shadow-xs'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              Level 5 ({level5Count})
            </button>
          </div>

          {isFiltered && (
            <button
              onClick={() => {
                setSearchQuery("");
                setLevelFilter("all");
              }}
              className="inline-flex items-center space-x-1 rounded-lg border border-[#334155] bg-[#0B0F19] px-2.5 py-1 text-xs text-[#06B6D4] hover:bg-[#1E293B] transition-all font-mono"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Status Summary Tag */}
      {!loading && isFiltered && (
        <div className="flex items-center justify-between text-xs text-[#94A3B8] font-mono px-2 py-1 rounded-xl bg-[#0B0F19]/40 border border-[#334155]/60">
          <span className="flex items-center space-x-1.5">
            <Filter className="h-3.5 w-3.5 text-[#06B6D4]" />
            <span>
              Showing <strong className="text-white font-bold">{filteredUsers.length}</strong> of {users.length} registered students
            </span>
          </span>
          <span className="text-[#06B6D4]">
            Active filters: {[levelFilter !== 'all' ? levelFilter : null, searchQuery ? `"${searchQuery}"` : null].filter(Boolean).join(" • ")}
          </span>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-xs text-[#94A3B8]">Loading student profiles...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="py-12 text-center text-xs text-[#94A3B8] bg-[#1E293B]/40 rounded-2xl border border-[#334155] p-6 space-y-3">
          <p className="text-sm font-bold text-white">No matching student registrations found</p>
          <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
            No students found in category <strong className="text-[#06B6D4]">"{filter.toUpperCase()}"</strong>
            {levelFilter !== 'all' && <> for <strong className="text-[#10B981] font-mono">{levelFilter}</strong></>}
            {searchQuery && <> matching name, username, or email <strong className="text-amber-400">"{searchQuery}"</strong></>}.
          </p>
          {isFiltered && (
            <button
              onClick={() => {
                setSearchQuery("");
                setLevelFilter("all");
              }}
              className="mt-2 inline-flex items-center space-x-1.5 rounded-xl bg-[#06B6D4] px-4 py-2 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-md"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Clear Search & Reset Filters</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => {
            const strikes = user.unfocusedCount || 0;
            const isSuspended = strikes >= 10 || (user.status === 'rejected' && !!user.suspensionReason);

            return (
              <div
                key={user.uid}
                className={`flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl border p-5 shadow-lg gap-4 transition-all ${
                  isSuspended 
                    ? 'border-rose-500/50 bg-rose-950/20' 
                    : 'border-[#334155] bg-[#1E293B]'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-base font-bold text-white">{user.fullName}</h4>
                    <span className="text-xs font-mono text-[#06B6D4]">(@{user.username})</span>
                    
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase ${
                      user.status === 'approved'
                        ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                        : user.status === 'pending_approval'
                        ? 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}>
                      {user.status.replace('_', ' ')}
                    </span>

                    {/* Strikes Badge */}
                    {isSuspended ? (
                      <span className="rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-0.5 text-[10px] font-mono font-bold flex items-center space-x-1">
                        <AlertTriangle className="h-3 w-3" />
                        <span>SUSPENDED ({strikes}/10 Side Windows)</span>
                      </span>
                    ) : strikes > 0 ? (
                      <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-mono font-bold">
                        {strikes} / 10 Side Windows
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-800 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-mono">
                        0/10 Strikes
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-[#94A3B8]">
                    <span>Email: <strong className="text-white">{user.email || 'None'}</strong></span>
                    <span>•</span>
                    <span>Trade: <strong className="text-[#06B6D4]">{tradesMap[user.tradeId] || "Assigned Trade"}</strong></span>
                    <span>•</span>
                    <span>Assigned Level: <strong className="text-[#10B981] font-mono">{user.level}</strong></span>
                  </div>

                  {user.suspensionReason && (
                    <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg flex items-center space-x-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>{user.suspensionReason}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {user.status !== 'approved' && (
                    <button
                      onClick={() => handleStatusChange(user.uid, 'approved')}
                      className="inline-flex items-center space-x-1.5 rounded-xl bg-[#10B981] px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-all shadow-md"
                    >
                      <Check className="h-4 w-4" />
                      <span>{isSuspended ? 'Re-Approve & Clear Strikes' : 'Approve Student'}</span>
                    </button>
                  )}

                  {strikes > 0 && (
                    <button
                      onClick={() => handleResetStrikes(user.uid, user.fullName)}
                      title="Reset focus strikes back to 0 (moves to Pending Approval)"
                      className="inline-flex items-center space-x-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 px-3 py-2 text-xs font-bold text-amber-400 hover:bg-amber-500/25 transition-all"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Reset Strikes (0/10)</span>
                    </button>
                  )}

                  {user.status !== 'rejected' && (
                    <button
                      onClick={() => handleStatusChange(user.uid, 'rejected')}
                      className="inline-flex items-center space-x-1 rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 border border-rose-500/30"
                    >
                      <X className="h-4 w-4" />
                      <span>Reject</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteUser(user.uid, user.fullName)}
                    title="Permanently remove student"
                    className="inline-flex items-center space-x-1 rounded-xl bg-slate-800/80 px-2.5 py-2 text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-[#334155] transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
