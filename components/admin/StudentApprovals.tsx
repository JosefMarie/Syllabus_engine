"use client";

import React, { useEffect, useState } from "react";
import { UserProfile, Trade } from "@/types/auth";
import { getAllUserProfiles, updateStudentStatus, getAllTrades, logActivity } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { UserCheck, Check, X, ShieldAlert, Clock, CheckCircle2 } from "lucide-react";

export default function StudentApprovals() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [tradesMap, setTradesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'all'>('pending');

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

  const handleStatusChange = async (uid: string, status: 'approved' | 'rejected') => {
    await updateStudentStatus(uid, status);
    const targetUser = users.find(u => u.uid === uid);
    const admin = getAdminSession();

    setUsers(users.map(u => u.uid === uid ? { ...u, status } : u));

    if (targetUser && admin) {
      await logActivity({
        userId: admin.uid,
        userName: admin.fullName,
        userEmail: admin.email,
        userLevel: admin.level,
        action: status === 'approved' ? 'APPROVE_STUDENT' : 'REJECT_STUDENT',
        details: `${status === 'approved' ? 'Approved' : 'Rejected'} student ${targetUser.fullName} (${targetUser.email}) for level ${targetUser.level}`
      });
    }
  };

  const filteredUsers = users.filter(u => {
    if (filter === 'pending') return u.status === 'pending_approval';
    if (filter === 'approved') return u.status === 'approved';
    return true;
  });

  const pendingCount = users.filter(u => u.status === 'pending_approval').length;
  const approvedCount = users.filter(u => u.status === 'approved').length;
  const rejectedCount = users.filter(u => u.status === 'rejected').length;

  return (
    <div className="space-y-6">
      {/* Top Statistical Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
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
              Rejected Requests
            </span>
            <span className="text-3xl font-extrabold text-white font-mono">
              {rejectedCount}
            </span>
            <span className="text-[11px] text-[#94A3B8] block mt-1">Denied registration</span>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Header & Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#334155] pb-4 gap-4">
        <div>
          <h3 className="text-lg font-bold text-white">Student Registration Verification</h3>
          <p className="text-xs text-[#94A3B8]">
            Review student details, trade assignment, and requested study level before granting syllabus access.
          </p>
        </div>

        <div className="flex items-center space-x-2 rounded-xl bg-[#1E293B] p-1 border border-[#334155]">
          <button
            onClick={() => setFilter('pending')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              filter === 'pending' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : 'text-[#94A3B8]'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              filter === 'approved' ? 'bg-[#10B981]/20 text-[#10B981]' : 'text-[#94A3B8]'
            }`}
          >
            Approved ({approvedCount})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              filter === 'all' ? 'bg-[#06B6D4]/20 text-[#06B6D4]' : 'text-[#94A3B8]'
            }`}
          >
            All Accounts ({users.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-[#94A3B8]">Loading student profiles...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="py-12 text-center text-xs text-[#94A3B8] bg-[#1E293B]/40 rounded-2xl border border-[#334155]">
          No student registrations found for filter "{filter}".
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => (
            <div
              key={user.uid}
              className="flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl border border-[#334155] bg-[#1E293B] p-5 shadow-lg gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
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
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-[#94A3B8]">
                  <span>Email: <strong className="text-white">{user.email}</strong></span>
                  <span>•</span>
                  <span>Trade: <strong className="text-[#06B6D4]">{tradesMap[user.tradeId] || "Assigned Trade"}</strong></span>
                  <span>•</span>
                  <span>Assigned Level: <strong className="text-[#10B981] font-mono">{user.level}</strong></span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 shrink-0">
                {user.status !== 'approved' && (
                  <button
                    onClick={() => handleStatusChange(user.uid, 'approved')}
                    className="inline-flex items-center space-x-1.5 rounded-xl bg-[#10B981] px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-all shadow-md"
                  >
                    <Check className="h-4 w-4" />
                    <span>Approve Student</span>
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
