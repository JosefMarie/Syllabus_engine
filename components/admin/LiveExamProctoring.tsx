"use client";

import React, { useState, useEffect } from "react";
import { LiveProctoringSession, ProctoringSessionStatus } from "@/types/exam";
import { UserProfile } from "@/types/auth";
import { 
  subscribeToLiveProctoringSessions, 
  grantExtraExamTime, 
  flagExamSession, 
  forceSubmitExamSession,
  deleteLiveExamSession 
} from "@/lib/db";
import { 
  ShieldAlert, 
  Clock, 
  UserCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Activity, 
  Plus, 
  Flag, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Search,
  Filter,
  Trash2,
  Send,
  Zap,
  Radio,
  Sparkles,
  Award
} from "lucide-react";

interface LiveExamProctoringProps {
  adminUser?: UserProfile | null;
}

export default function LiveExamProctoring({ adminUser }: LiveExamProctoringProps) {
  const [sessions, setSessions] = useState<LiveProctoringSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "flagged" | "submitted">("all");
  const [search, setSearch] = useState("");
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Subscribe to real-time proctoring updates
  useEffect(() => {
    const unsub = subscribeToLiveProctoringSessions((data) => {
      setSessions(data);
      setLoading(false);
    });

    // Tick every second to keep countdowns and heartbeat relative timers accurate
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);

  const handleGrantTime = async (sessionId: string, studentName: string, mins: number) => {
    setActionLoadingId(sessionId);
    try {
      await grantExtraExamTime(sessionId, mins);
    } catch (err) {
      console.error("Failed to grant extra time:", err);
    } finally {
      setTimeout(() => setActionLoadingId(null), 500);
    }
  };

  const handleToggleFlag = async (sessionId: string, currentStatus: ProctoringSessionStatus) => {
    setActionLoadingId(sessionId);
    try {
      const isCurrentlyFlagged = currentStatus === "flagged";
      await flagExamSession(sessionId, !isCurrentlyFlagged, isCurrentlyFlagged ? undefined : "Flagged by instructor for review");
    } catch (err) {
      console.error("Failed to flag session:", err);
    } finally {
      setTimeout(() => setActionLoadingId(null), 500);
    }
  };

  const handleForceSubmit = async (sessionId: string, studentName: string) => {
    if (confirm(`⚠️ Force-submit exam for ${studentName}? This will immediately end their active test session.`)) {
      setActionLoadingId(sessionId);
      try {
        await forceSubmitExamSession(sessionId);
      } catch (err) {
        console.error("Failed to force submit session:", err);
      } finally {
        setTimeout(() => setActionLoadingId(null), 500);
      }
    }
  };

  const handleClearSession = async (sessionId: string) => {
    if (confirm("Remove this session from the live proctoring board?")) {
      try {
        await deleteLiveExamSession(sessionId);
      } catch (err) {
        console.error("Failed to clear session:", err);
      }
    }
  };

  // Determine connectivity state based on last heartbeat
  const getConnectionStatus = (session: LiveProctoringSession) => {
    if (session.status === "submitted" || session.status === "force_submitted") {
      return { status: "completed", label: "Submitted", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle2 };
    }

    const lastPing = new Date(session.lastHeartbeat).getTime();
    const diffSecs = Math.max(0, Math.floor((currentTime - lastPing) / 1000));

    if (diffSecs <= 20) {
      return { status: "online", label: "Live Online", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/40", icon: Wifi };
    } else if (diffSecs <= 60) {
      return { status: "idle", label: `Idle (${diffSecs}s ago)`, color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/40", icon: Activity };
    } else {
      return { status: "disconnected", label: `Offline (${Math.floor(diffSecs / 60)}m ago)`, color: "text-rose-400", bg: "bg-rose-500/15 border-rose-500/40", icon: WifiOff };
    }
  };

  const formatTimer = (seconds: number) => {
    if (seconds <= 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const activeSessions = sessions.filter(s => s.status === "active" || s.status === "flagged");
  const flaggedSessions = sessions.filter(s => s.status === "flagged" || s.tabSwitchViolations > 0);
  const submittedSessions = sessions.filter(s => s.status === "submitted" || s.status === "force_submitted");

  const filteredSessions = sessions.filter(s => {
    if (filterStatus === "active" && s.status !== "active" && s.status !== "flagged") return false;
    if (filterStatus === "flagged" && s.status !== "flagged" && s.tabSwitchViolations === 0) return false;
    if (filterStatus === "submitted" && s.status !== "submitted" && s.status !== "force_submitted") return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const match = s.studentName.toLowerCase().includes(q) || 
                    s.examTitle.toLowerCase().includes(q) || 
                    s.courseCode.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  }).sort((a, b) => {
    // Flagged & active sessions first
    if (a.status === "flagged" && b.status !== "flagged") return -1;
    if (b.status === "flagged" && a.status !== "flagged") return 1;
    if (a.status === "active" && b.status !== "active") return -1;
    if (b.status === "active" && a.status !== "active") return 1;
    return new Date(b.lastHeartbeat).getTime() - new Date(a.lastHeartbeat).getTime();
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="rounded-3xl border border-[#334155] bg-gradient-to-r from-[#1E293B] via-[#0F172A] to-[#1E293B] p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-rose-400 font-mono text-xs font-semibold uppercase tracking-wider mb-1">
              <Radio className="h-4 w-4 animate-pulse" />
              <span>Real-Time Academic Integrity Engine</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center space-x-2.5">
              <span>Live Exam Hall Monitor &amp; Proctoring</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                LIVE
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-[#94A3B8] mt-1 max-w-xl">
              Monitor active test-takers in real-time, detect tab-switching strikes, and remotely grant time extensions for network or power interruptions.
            </p>
          </div>

          <div className="flex items-center space-x-3 self-start md:self-auto">
            <span className="text-xs font-mono text-[#94A3B8] flex items-center space-x-1.5 bg-[#0B0F19] px-3 py-1.5 rounded-xl border border-[#334155]">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Synced with Firebase</span>
            </span>
          </div>
        </div>

        {/* Live KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 pt-5 border-t border-[#334155]/60">
          <div className="rounded-2xl bg-[#0B0F19]/60 border border-emerald-500/30 p-3.5">
            <span className="text-xs font-mono text-emerald-300 block flex items-center space-x-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Active Right Now</span>
            </span>
            <span className="text-2xl font-black text-white font-mono mt-1 block">
              {activeSessions.length}
            </span>
          </div>

          <div className="rounded-2xl bg-[#0B0F19]/60 border border-rose-500/30 p-3.5">
            <span className="text-xs font-mono text-rose-300 block flex items-center space-x-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
              <span>Suspicious / Flagged</span>
            </span>
            <span className="text-2xl font-black text-rose-400 font-mono mt-1 block">
              {flaggedSessions.length}
            </span>
          </div>

          <div className="rounded-2xl bg-[#0B0F19]/60 border border-cyan-500/30 p-3.5">
            <span className="text-xs font-mono text-cyan-300 block flex items-center space-x-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
              <span>Completed / Turned In</span>
            </span>
            <span className="text-2xl font-black text-cyan-300 font-mono mt-1 block">
              {submittedSessions.length}
            </span>
          </div>

          <div className="rounded-2xl bg-[#0B0F19]/60 border border-[#334155] p-3.5">
            <span className="text-xs font-mono text-[#94A3B8] block">Total In Session</span>
            <span className="text-2xl font-black text-white font-mono mt-1 block">
              {sessions.length}
            </span>
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#1E293B] p-3.5 rounded-2xl border border-[#334155]">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
          <input
            type="text"
            placeholder="Search active student or exam title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#0B0F19] border border-[#334155] rounded-xl text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-rose-400 font-mono"
          />
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-mono text-[#94A3B8] flex items-center space-x-1 shrink-0">
            <Filter className="h-3.5 w-3.5" />
            <span>Status:</span>
          </span>
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all shrink-0 ${
              filterStatus === "all" ? "bg-rose-500 text-white" : "bg-[#0B0F19] text-[#94A3B8] hover:text-white"
            }`}
          >
            All ({sessions.length})
          </button>
          <button
            onClick={() => setFilterStatus("active")}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all shrink-0 ${
              filterStatus === "active" ? "bg-emerald-500 text-slate-950" : "bg-[#0B0F19] text-[#94A3B8] hover:text-white"
            }`}
          >
            Active ({activeSessions.length})
          </button>
          <button
            onClick={() => setFilterStatus("flagged")}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all shrink-0 ${
              filterStatus === "flagged" ? "bg-rose-500 text-white" : "bg-[#0B0F19] text-[#94A3B8] hover:text-white"
            }`}
          >
            Flagged ({flaggedSessions.length})
          </button>
          <button
            onClick={() => setFilterStatus("submitted")}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all shrink-0 ${
              filterStatus === "submitted" ? "bg-cyan-500 text-slate-950" : "bg-[#0B0F19] text-[#94A3B8] hover:text-white"
            }`}
          >
            Finished ({submittedSessions.length})
          </button>
        </div>
      </div>

      {/* Proctoring Grid */}
      {loading ? (
        <div className="p-16 text-center text-xs font-mono text-[#94A3B8]">
          <div className="h-8 w-8 rounded-full border-2 border-rose-500 border-t-transparent animate-spin mx-auto mb-3" />
          Connecting to live exam hall stream...
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#334155] bg-[#1E293B]/40 p-16 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0B0F19] border border-[#334155] flex items-center justify-center mx-auto text-xl">
            🎓
          </div>
          <h4 className="text-sm font-bold text-white">No active test sessions found</h4>
          <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
            {filterStatus === "active" 
              ? "No students are currently taking an exam right now. As soon as a student starts a test, their live card will appear here instantly." 
              : "No exam proctoring sessions matched your filter criteria."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredSessions.map((session) => {
            const conn = getConnectionStatus(session);
            const ConnIcon = conn.icon;
            const progressPercent = session.totalQuestions > 0 
              ? Math.round((session.answeredQuestionsCount / session.totalQuestions) * 100) 
              : 0;

            const isHighRisk = session.tabSwitchViolations >= 3 || session.status === "flagged";
            const isMediumRisk = session.tabSwitchViolations > 0 && session.tabSwitchViolations < 3;
            const isFinished = session.status === "submitted" || session.status === "force_submitted";

            return (
              <div
                key={session.id}
                className={`rounded-2xl border transition-all p-5 space-y-4 ${
                  isHighRisk && !isFinished
                    ? "border-rose-500/60 bg-gradient-to-br from-[#1E293B] via-[#1E293B] to-rose-950/30 shadow-xl shadow-rose-950/20"
                    : isMediumRisk && !isFinished
                    ? "border-amber-500/50 bg-[#1E293B]"
                    : isFinished
                    ? "border-[#334155]/60 bg-[#1E293B]/60 opacity-80"
                    : "border-[#334155] bg-[#1E293B] hover:border-cyan-500/40"
                }`}
              >
                {/* Header Row: Student Info & Connection Pill */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-base font-extrabold text-white tracking-tight">
                        {session.studentName}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#0B0F19] text-[#06B6D4] border border-[#334155]">
                        {session.studentLevel}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-[#94A3B8] mt-0.5">
                      <span>{session.courseCode}</span> &bull; <span className="text-white">{session.examTitle}</span>
                    </div>
                  </div>

                  {/* Connection & Status Badges */}
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold border ${conn.bg} ${conn.color}`}>
                      <ConnIcon className="h-3 w-3" />
                      <span>{conn.label}</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => handleClearSession(session.id)}
                      className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-[#0B0F19] transition-all"
                      title="Clear session record"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Live Countdown & Anti-Cheat Strike Board */}
                <div className="grid grid-cols-2 gap-3 bg-[#0B0F19] p-3.5 rounded-xl border border-[#334155]">
                  {/* Countdown Clock */}
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] block mb-1">
                      Time Remaining
                    </span>
                    <div className="flex items-baseline space-x-2">
                      <span className={`text-2xl font-black font-mono tracking-tight ${
                        session.timeRemainingSeconds <= 300 && !isFinished
                          ? "text-rose-400 animate-pulse"
                          : isFinished
                          ? "text-slate-400"
                          : "text-white"
                      }`}>
                        {formatTimer(session.timeRemainingSeconds)}
                      </span>
                      {session.extraTimeGrantedMinutes > 0 && (
                        <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                          +{session.extraTimeGrantedMinutes}m
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tab-Switch Anti-Cheat Strikes */}
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] block mb-1">
                      Anti-Cheat Strikes
                    </span>
                    <div className="flex items-center space-x-2">
                      {session.tabSwitchViolations === 0 ? (
                        <span className="inline-flex items-center space-x-1 text-xs font-mono font-bold text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>0 Strikes (Clean)</span>
                        </span>
                      ) : (
                        <span className={`inline-flex items-center space-x-1.5 text-xs font-mono font-bold ${
                          session.tabSwitchViolations >= 3 ? "text-rose-400" : "text-amber-400"
                        }`}>
                          <ShieldAlert className="h-4 w-4 animate-bounce" />
                          <span>{session.tabSwitchViolations} Tab Switch{session.tabSwitchViolations > 1 ? "es" : ""}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Question Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-[#94A3B8]">
                      Question Progress: <strong className="text-white">{session.answeredQuestionsCount}</strong> / {session.totalQuestions} Answered
                    </span>
                    <span className="text-[#06B6D4] font-bold">{progressPercent}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#0B0F19] overflow-hidden border border-[#334155]/60">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        isFinished ? "bg-emerald-400" : "bg-gradient-to-r from-cyan-400 to-indigo-500"
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Flag Reason Alert if present */}
                {session.flagReason && (
                  <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs text-rose-300 flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{session.flagReason}</span>
                  </div>
                )}

                {/* Teacher Command & Control Strip */}
                {!isFinished && (
                  <div className="pt-3 border-t border-[#334155]/60 flex flex-wrap items-center justify-between gap-2">
                    {/* Extra Time Buttons */}
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[10px] font-mono text-[#94A3B8] mr-1">Grant Time:</span>
                      <button
                        type="button"
                        onClick={() => handleGrantTime(session.id, session.studentName, 5)}
                        disabled={actionLoadingId === session.id}
                        className="px-2.5 py-1 rounded-lg bg-[#0B0F19] border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 font-mono text-xs font-bold transition-all active:scale-95"
                      >
                        +5m
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGrantTime(session.id, session.studentName, 10)}
                        disabled={actionLoadingId === session.id}
                        className="px-2.5 py-1 rounded-lg bg-[#0B0F19] border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 font-mono text-xs font-bold transition-all active:scale-95"
                      >
                        +10m
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGrantTime(session.id, session.studentName, 15)}
                        disabled={actionLoadingId === session.id}
                        className="px-2.5 py-1 rounded-lg bg-[#0B0F19] border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 font-mono text-xs font-bold transition-all active:scale-95"
                      >
                        +15m
                      </button>
                    </div>

                    {/* Flag & Force Submit Actions */}
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleFlag(session.id, session.status)}
                        disabled={actionLoadingId === session.id}
                        className={`inline-flex items-center space-x-1 px-3 py-1 rounded-lg font-mono text-xs font-bold transition-all ${
                          session.status === "flagged"
                            ? "bg-rose-500 text-white"
                            : "bg-[#0B0F19] border border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
                        }`}
                      >
                        <Flag className="h-3 w-3" />
                        <span>{session.status === "flagged" ? "Clear Flag" : "Flag"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleForceSubmit(session.id, session.studentName)}
                        disabled={actionLoadingId === session.id}
                        className="inline-flex items-center space-x-1 px-3 py-1 rounded-lg bg-rose-950/60 border border-rose-500/50 text-rose-300 hover:bg-rose-600 hover:text-white font-mono text-xs font-bold transition-all"
                        title="Force student to turn in their test right now"
                      >
                        <span>Force Submit</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
