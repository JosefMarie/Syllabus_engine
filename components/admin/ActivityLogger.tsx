"use client";

import React, { useEffect, useState } from "react";
import { ActivityLog, ActivityActionType } from "@/types/activity";
import { getAllActivities } from "@/lib/db";
import { 
  Activity, 
  Search, 
  UserCheck, 
  UserPlus, 
  LogIn, 
  BookOpen, 
  Clock, 
  Terminal,
  ShieldCheck,
  RefreshCw,
  Sparkles
} from "lucide-react";

export default function ActivityLogger() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("ALL");

  const loadLogs = async () => {
    setLoading(true);
    const data = await getAllActivities();
    setActivities(data);
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filtered = activities.filter((act) => {
    const matchesSearch = 
      act.userName.toLowerCase().includes(search.toLowerCase()) ||
      act.userEmail.toLowerCase().includes(search.toLowerCase()) ||
      act.details.toLowerCase().includes(search.toLowerCase());
    
    if (actionFilter === "ALL") return matchesSearch;
    return matchesSearch && act.action === actionFilter;
  });

  const getActionBadge = (action: ActivityActionType) => {
    switch (action) {
      case "STUDENT_REGISTER":
        return <span className="rounded-full bg-[#F59E0B]/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-[#F59E0B] border border-[#F59E0B]/30 flex items-center gap-1"><UserPlus className="h-3 w-3" /> Registration</span>;
      case "STUDENT_LOGIN":
        return <span className="rounded-full bg-[#06B6D4]/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-[#06B6D4] border border-[#06B6D4]/30 flex items-center gap-1"><LogIn className="h-3 w-3" /> Login</span>;
      case "ADMIN_LOGIN":
        return <span className="rounded-full bg-purple-500/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-purple-400 border border-purple-500/30 flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Admin Auth</span>;
      case "VIEW_SUBTOPIC":
      case "VIEW_SYLLABUS":
        return <span className="rounded-full bg-[#10B981]/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-[#10B981] border border-[#10B981]/30 flex items-center gap-1"><BookOpen className="h-3 w-3" /> Subtopic View</span>;
      case "APPROVE_STUDENT":
        return <span className="rounded-full bg-[#10B981]/20 px-2.5 py-0.5 text-[10px] font-mono font-bold text-emerald-300 border border-[#10B981]/40 flex items-center gap-1"><UserCheck className="h-3 w-3" /> Approved</span>;
      case "REJECT_STUDENT":
        return <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-rose-400 border border-rose-500/30 flex items-center gap-1">Rejected</span>;
      default:
        return <span className="rounded-full bg-[#334155] px-2.5 py-0.5 text-[10px] font-mono text-white">{action}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#334155] pb-4 gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#06B6D4]" />
            <span>Student Activity & Action Tracking Audit</span>
          </h3>
          <p className="text-xs text-[#94A3B8]">
            Real-time logs of student logins, subtopic views, note progress, and admin verification events.
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="inline-flex items-center space-x-1.5 rounded-xl border border-[#334155] bg-[#1E293B] px-3.5 py-2 text-xs font-semibold text-[#CBD5E1] hover:text-white transition-all shadow-md shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5 text-[#06B6D4]" />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Search student name, email or action details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[#334155] bg-[#1E293B] py-2 pl-9 pr-3 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {["ALL", "VIEW_SUBTOPIC", "STUDENT_LOGIN", "STUDENT_REGISTER", "APPROVE_STUDENT"].map((type) => (
            <button
              key={type}
              onClick={() => setActionFilter(type)}
              className={`rounded-xl px-3 py-1.5 text-xs font-mono font-semibold transition-all border ${
                actionFilter === type
                  ? "bg-[#06B6D4] text-slate-950 border-[#06B6D4] shadow-md"
                  : "bg-[#1E293B] text-[#94A3B8] border-[#334155] hover:border-[#06B6D4]"
              }`}
            >
              {type.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Log Feed */}
      {loading ? (
        <div className="py-12 text-center text-xs text-[#94A3B8]">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[#06B6D4] border-t-transparent mb-2" />
          Fetching activity logs...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-xs text-[#94A3B8] bg-[#1E293B]/40 rounded-2xl border border-[#334155]">
          No recorded activity logs matching your filter criteria.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((log) => (
            <div
              key={log.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-[#334155] bg-[#1E293B] p-4 shadow-md gap-3"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {getActionBadge(log.action)}
                  <span className="text-sm font-bold text-white">{log.userName}</span>
                  <span className="text-xs font-mono text-[#06B6D4]">({log.userEmail})</span>
                  {log.userLevel && (
                    <span className="rounded bg-[#10B981]/15 px-2 py-0.5 font-mono text-[10px] text-[#10B981] border border-[#10B981]/30">
                      {log.userLevel}
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#CBD5E1] pt-1 leading-relaxed">{log.details}</p>
              </div>

              <div className="flex items-center space-x-2 text-[11px] font-mono text-[#94A3B8] shrink-0">
                <Clock className="h-3.5 w-3.5 text-[#06B6D4]" />
                <span>{new Date(log.timestamp).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
