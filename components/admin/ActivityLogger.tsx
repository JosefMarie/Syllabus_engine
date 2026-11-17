"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ActivityLog, ActivityActionType } from "@/types/activity";
import { UserProfile } from "@/types/auth";
import { SystemRestrictionsConfig } from "@/types/restrictions";
import {
  getAllActivities,
  clearAllActivityLogs,
  subscribeToActivityLogs,
  getLocalActivityLogs,
  subscribeToAllUserProfiles,
  getLocalUserProfiles
} from "@/lib/db";
import { getLocalRestrictions, subscribeToSystemRestrictions } from "@/lib/restrictions";
import { 
  Activity, 
  Search, 
  UserCheck, 
  UserPlus, 
  LogIn, 
  LogOut,
  BookOpen, 
  Clock, 
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  KeyRound,
  AlertTriangle,
  RefreshCw,
  Trash2,
  EyeOff
} from "lucide-react";

const SECURITY_ACTIONS = new Set<ActivityActionType>([
  "ADMIN_LOGIN",
  "STUDENT_SUSPENDED_FOCUS",
  "RESET_FOCUS_STRIKES",
  "REJECT_STUDENT",
  "PASSWORD_RESET_REQUESTED",
  "PASSWORD_RESET_COMPLETED",
  "DISABLE_RESTRICTIONS",
  "ENABLE_RESTRICTIONS",
  "AUTO_TIMEOUT_LOGOUT",
  "STUDENT_LOGOUT",
  "APPROVE_STUDENT",
  "APPROVE_STUDENT_BATCH"
]);

export default function ActivityLogger() {
  const [activities, setActivities] = useState<ActivityLog[]>(() => getLocalActivityLogs());
  const [students, setStudents] = useState<UserProfile[]>(() =>
    getLocalUserProfiles().filter(u => u.role !== "teacher")
  );
  const [restrictions, setRestrictions] = useState<SystemRestrictionsConfig>(() => getLocalRestrictions());
  const [loading, setLoading] = useState<boolean>(() => getLocalActivityLogs().length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("ALL");

  const loadLogs = async (limitCount = displayLimit) => {
    setRefreshing(true);
    try {
      const data = await getAllActivities(limitCount);
      if (data) {
        setActivities(data);
      }
    } catch (e) {
      console.warn("Failed to load logs:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    const nextLimit = displayLimit + 100;
    setDisplayLimit(nextLimit);
    try {
      const data = await getAllActivities(nextLimit);
      if (data) setActivities(data);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleClearLogs = async () => {
    const ok = window.confirm("Are you sure you want to clear all activity logs and start fresh?");
    if (!ok) return;

    setClearing(true);
    await clearAllActivityLogs();
    setActivities([]);
    setClearing(false);
  };

  useEffect(() => {
    let isMounted = true;

    const unsubLogs = subscribeToActivityLogs(displayLimit, (logs) => {
      if (isMounted) {
        setActivities(logs);
        setLoading(false);
      }
    });

    const unsubUsers = subscribeToAllUserProfiles((allUsers) => {
      if (isMounted) {
        setStudents(allUsers.filter(u => u.role !== "teacher"));
      }
    });

    const unsubRestrictions = subscribeToSystemRestrictions((cfg) => {
      if (isMounted) {
        setRestrictions(cfg);
      }
    });

    // Trigger one direct fetch as well to ensure latest logs populate immediately
    loadLogs(displayLimit);

    return () => {
      isMounted = false;
      unsubLogs();
      unsubUsers();
      unsubRestrictions();
    };
  }, [displayLimit]);

  const securityStats = useMemo(() => {
    const suspendedStudents = students.filter(
      u => u.status === "rejected" || (u.suspensionReason && u.suspensionReason.trim().length > 0)
    );
    const flaggedFocusStudents = students
      .filter(u => (u.unfocusedCount || 0) > 0)
      .sort((a, b) => (b.unfocusedCount || 0) - (a.unfocusedCount || 0));
    const securityEventsCount = activities.filter(a => SECURITY_ACTIONS.has(a.action)).length;

    return {
      suspendedStudents,
      flaggedFocusStudents,
      securityEventsCount
    };
  }, [students, activities]);

  const filtered = activities.filter((act) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (act.userName || "").toLowerCase().includes(q) ||
      (act.userEmail || "").toLowerCase().includes(q) ||
      (act.details || "").toLowerCase().includes(q) ||
      (act.action || "").toLowerCase().includes(q);

    if (actionFilter === "ALL") return matchesSearch;
    if (actionFilter === "SECURITY") return matchesSearch && SECURITY_ACTIONS.has(act.action);
    return matchesSearch && act.action === actionFilter;
  });

  const getActionBadge = (action: ActivityActionType) => {
    switch (action) {
      case "STUDENT_REGISTER":
        return <span className="rounded-full bg-[#F59E0B]/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-[#F59E0B] border border-[#F59E0B]/30 flex items-center gap-1"><UserPlus className="h-3 w-3" /> Registration</span>;
      case "STUDENT_LOGIN":
        return <span className="rounded-full bg-[#EAEAE6]/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-[#EAEAE6] border border-[#EAEAE6]/30 flex items-center gap-1"><LogIn className="h-3 w-3" /> Login</span>;
      case "STUDENT_LOGOUT":
        return <span className="rounded-full bg-slate-500/20 px-2.5 py-0.5 text-[10px] font-mono font-bold text-slate-300 border border-slate-500/30 flex items-center gap-1"><LogOut className="h-3 w-3" /> Logout</span>;
      case "AUTO_TIMEOUT_LOGOUT":
        return <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-amber-300 border border-amber-500/30 flex items-center gap-1"><Clock className="h-3 w-3" /> Idle Timeout</span>;
      case "ADMIN_LOGIN":
        return <span className="rounded-full bg-purple-500/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-purple-400 border border-purple-500/30 flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Admin Auth</span>;
      case "VIEW_SUBTOPIC":
      case "VIEW_SYLLABUS":
        return <span className="rounded-full bg-[#10B981]/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-[#10B981] border border-[#10B981]/30 flex items-center gap-1"><BookOpen className="h-3 w-3" /> Subtopic View</span>;
      case "APPROVE_STUDENT":
      case "APPROVE_STUDENT_BATCH":
        return <span className="rounded-full bg-[#10B981]/20 px-2.5 py-0.5 text-[10px] font-mono font-bold text-emerald-300 border border-[#10B981]/40 flex items-center gap-1"><UserCheck className="h-3 w-3" /> Approved</span>;
      case "REJECT_STUDENT":
        return <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-rose-400 border border-rose-500/30 flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Suspended / Rejected</span>;
      case "STUDENT_SUSPENDED_FOCUS":
        return <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-[10px] font-mono font-bold text-rose-300 border border-rose-500/40 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Security / Focus</span>;
      case "RESET_FOCUS_STRIKES":
        return <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-amber-400 border border-amber-500/30 flex items-center gap-1">Strikes Cleared</span>;
      case "PASSWORD_RESET_REQUESTED":
      case "PASSWORD_RESET_COMPLETED":
        return <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-indigo-300 border border-indigo-500/30 flex items-center gap-1"><KeyRound className="h-3 w-3" /> Password Recovery</span>;
      case "DISABLE_RESTRICTIONS":
        return <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-amber-300 border border-amber-500/30 flex items-center gap-1"><Unlock className="h-3 w-3" /> Restrictions Paused</span>;
      case "ENABLE_RESTRICTIONS":
        return <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-emerald-300 border border-emerald-500/30 flex items-center gap-1"><Lock className="h-3 w-3" /> Restrictions Enabled</span>;
      case "SAVE_SYLLABUS":
        return <span className="rounded-full bg-[#EAEAE6]/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-[#EAEAE6] border border-[#EAEAE6]/30 flex items-center gap-1">Syllabus Saved</span>;
      case "DELETE_SYLLABUS":
        return <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-rose-400 border border-rose-500/30 flex items-center gap-1">Syllabus Deleted</span>;
      default:
        return <span className="rounded-full bg-[#2E2E34] px-2.5 py-0.5 text-[10px] font-mono text-white">{action}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#2E2E34] pb-4 gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#EAEAE6]" />
            <span>Student Activity &amp; Action Tracking Audit</span>
          </h3>
          <p className="text-xs text-[#A1A1AA]">
            Real-time logs of student logins, subtopic views, focus violations, suspensions, password resets, and admin security events.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={handleClearLogs}
            disabled={clearing}
            title="Clear all activity logs from database"
            className="inline-flex items-center space-x-1.5 rounded-xl border border-rose-500/30 bg-[#1C1C1F] px-3.5 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 hover:text-white transition-all shadow-md"
          >
            <Trash2 className="h-3.5 w-3.5 text-rose-400" />
            <span>{clearing ? "Clearing..." : "Clear Audit Logs"}</span>
          </button>

          <button
            onClick={() => loadLogs(displayLimit)}
            disabled={refreshing}
            className="inline-flex items-center space-x-1.5 rounded-xl border border-[#2E2E34] bg-[#1C1C1F] px-3.5 py-2 text-xs font-semibold text-[#EAEAE6] hover:text-white transition-all shadow-md disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#EAEAE6] ${refreshing ? "animate-spin" : ""}`} />
            <span>{refreshing ? "Refreshing..." : "Refresh Logs"}</span>
          </button>
        </div>
      </div>

      {/* Live Security & Discipline Audit Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-[#2E2E34] bg-[#1C1C1F]/90 p-3.5 flex items-center justify-between">
          <div>
            <span className="block text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA]">
              Security &amp; Auth Events
            </span>
            <span className="text-lg font-extrabold text-white font-mono">
              {securityStats.securityEventsCount}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActionFilter("SECURITY")}
            className="rounded-lg bg-purple-500/15 border border-purple-500/30 px-2.5 py-1 text-[11px] font-bold text-purple-300 hover:bg-purple-500 hover:text-white transition-all"
          >
            Filter Security
          </button>
        </div>

        <div className="rounded-xl border border-[#2E2E34] bg-[#1C1C1F]/90 p-3.5 flex items-center justify-between">
          <div>
            <span className="block text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA]">
              Suspended Accounts
            </span>
            <span className={`text-lg font-extrabold font-mono ${securityStats.suspendedStudents.length > 0 ? "text-rose-400" : "text-emerald-400"}`}>
              {securityStats.suspendedStudents.length}
            </span>
          </div>
          <ShieldAlert className={`h-6 w-6 ${securityStats.suspendedStudents.length > 0 ? "text-rose-400" : "text-emerald-400/50"}`} />
        </div>

        <div className="rounded-xl border border-[#2E2E34] bg-[#1C1C1F]/90 p-3.5 flex items-center justify-between">
          <div>
            <span className="block text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA]">
              Students w/ Focus Strikes
            </span>
            <span className={`text-lg font-extrabold font-mono ${securityStats.flaggedFocusStudents.length > 0 ? "text-amber-400" : "text-emerald-400"}`}>
              {securityStats.flaggedFocusStudents.length}
            </span>
          </div>
          <EyeOff className={`h-6 w-6 ${securityStats.flaggedFocusStudents.length > 0 ? "text-amber-400" : "text-emerald-400/50"}`} />
        </div>

        <div className="rounded-xl border border-[#2E2E34] bg-[#1C1C1F]/90 p-3.5 flex items-center justify-between">
          <div>
            <span className="block text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA]">
              Window Lock Restrictions
            </span>
            <span className={`text-xs font-extrabold font-mono block mt-1 ${restrictions.restrictionsDisabled ? "text-amber-300" : "text-emerald-400"}`}>
              {restrictions.restrictionsDisabled ? "Paused (Group Work)" : "Active & Enforced"}
            </span>
          </div>
          {restrictions.restrictionsDisabled ? (
            <Unlock className="h-6 w-6 text-amber-400" />
          ) : (
            <Lock className="h-6 w-6 text-emerald-400" />
          )}
        </div>
      </div>

      {/* Active Security Watchlist (Suspended or High Focus Strikes) */}
      {(securityStats.suspendedStudents.length > 0 || securityStats.flaggedFocusStudents.length > 0) && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold text-amber-300 flex items-center space-x-2 uppercase tracking-wider font-mono">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span>Active Student Security &amp; Focus Watchlist</span>
            </h4>
            <span className="text-[11px] font-mono text-[#A1A1AA]">Live from Student Profiles</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {securityStats.suspendedStudents.map((st) => (
              <button
                key={`susp-${st.uid}`}
                type="button"
                onClick={() => setSearch(st.fullName || st.username)}
                className="inline-flex items-center space-x-1.5 rounded-lg border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 text-[11px] text-rose-200 hover:bg-rose-500/25 transition-all"
                title={st.suspensionReason || "Suspended account — click to filter logs for this student"}
              >
                <ShieldAlert className="h-3 w-3 text-rose-400" />
                <span className="font-bold">{st.fullName}</span>
                <span className="font-mono text-[10px] text-rose-300">
                  ({st.level} • SUSPENDED • {st.unfocusedCount || 0}/10)
                </span>
              </button>
            ))}
            {securityStats.flaggedFocusStudents
              .filter(st => !securityStats.suspendedStudents.some(s => s.uid === st.uid))
              .slice(0, 12)
              .map((st) => (
                <button
                  key={`warn-${st.uid}`}
                  type="button"
                  onClick={() => setSearch(st.fullName || st.username)}
                  className="inline-flex items-center space-x-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200 hover:bg-amber-500/20 transition-all"
                  title="Click to filter activity logs for this student"
                >
                  <EyeOff className="h-3 w-3 text-amber-400" />
                  <span className="font-bold">{st.fullName}</span>
                  <span className="font-mono text-[10px] text-amber-300">
                    ({st.level} • {st.unfocusedCount}/10 strikes)
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#A1A1AA]" />
          <input
            type="text"
            placeholder="Search student name (e.g. Josef Marie), email or action details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[#2E2E34] bg-[#1C1C1F] py-2 pl-9 pr-3 text-xs text-white placeholder-[#71717A] focus:border-[#EAEAE6] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "ALL", label: "ALL" },
            { id: "SECURITY", label: "SECURITY & DISCIPLINE" },
            { id: "VIEW_SUBTOPIC", label: "VIEW SUBTOPIC" },
            { id: "STUDENT_LOGIN", label: "STUDENT LOGIN" },
            { id: "STUDENT_REGISTER", label: "STUDENT REGISTER" },
            { id: "APPROVE_STUDENT", label: "APPROVE STUDENT" }
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setActionFilter(btn.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-mono font-semibold transition-all border ${
                actionFilter === btn.id
                  ? btn.id === "SECURITY"
                    ? "bg-purple-500 text-white border-purple-400 shadow-md"
                    : "bg-[#EAEAE6] text-[#141416] border-[#EAEAE6] shadow-md"
                  : "bg-[#1C1C1F] text-[#A1A1AA] border-[#2E2E34] hover:border-[#EAEAE6]"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Log Feed */}
      {loading ? (
        <div className="py-12 text-center text-xs text-[#A1A1AA]">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[#EAEAE6] border-t-transparent mb-2" />
          Fetching activity logs...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-xs text-[#A1A1AA] bg-[#1C1C1F]/40 rounded-2xl border border-[#2E2E34]">
          No recorded activity logs matching your filter criteria.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((log) => (
            <div
              key={log.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border bg-[#1C1C1F] p-4 shadow-md gap-3 ${
                SECURITY_ACTIONS.has(log.action) ? "border-purple-500/30" : "border-[#2E2E34]"
              }`}
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {getActionBadge(log.action)}
                  <span className="text-sm font-bold text-white">
                    {log.userName === "Teacher Admin" ? "Josef Marie" : log.userName}
                  </span>
                  <span className="text-xs font-mono text-[#EAEAE6]">({log.userEmail || "No Email"})</span>
                  {log.userLevel && (
                    <span className="rounded bg-[#10B981]/15 px-2 py-0.5 font-mono text-[10px] text-[#10B981] border border-[#10B981]/30">
                      {log.userLevel}
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#EAEAE6] pt-1 leading-relaxed">
                  {(log.details || "").replace(/Teacher Admin/g, "Josef Marie")}
                </p>
              </div>

              <div className="flex items-center space-x-2 text-[11px] font-mono text-[#A1A1AA] shrink-0">
                <Clock className="h-3.5 w-3.5 text-[#EAEAE6]" />
                <span>{new Date(log.timestamp).toLocaleString()}</span>
              </div>
            </div>
          ))}

          {activities.length >= displayLimit && (
            <div className="pt-4 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center space-x-2 rounded-xl border border-[#2E2E34] bg-[#1C1C1F] px-6 py-2.5 text-xs font-bold text-white hover:border-[#EAEAE6] hover:bg-[#EAEAE6]/10 transition-all shadow-md disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#EAEAE6]" />
                    <span>Loading Previous Logs...</span>
                  </>
                ) : (
                  <>
                    <Clock className="h-3.5 w-3.5 text-[#EAEAE6]" />
                    <span>Load 100 More Logs (Showing {activities.length})</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
