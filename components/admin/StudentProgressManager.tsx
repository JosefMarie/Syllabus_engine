"use client";

import React, { useEffect, useState } from "react";
import { StudentProgressSummary } from "@/types/notification";
import { Trade, StudentLevel } from "@/types/auth";
import { StudentPresenceRecord } from "@/types/presence";
import { getStudentProgressSummaries, getAllTrades, sendStudentNotification, logActivity } from "@/lib/db";
import { getAllStudentPresences } from "@/lib/presence";
import { getAdminSession } from "@/lib/auth";
import { 
  Users, 
  Search, 
  Send, 
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  MessageSquare,
  Sparkles,
  RefreshCw,
  EyeOff,
  Radio
} from "lucide-react";

export default function StudentProgressManager() {
  const [students, setStudents] = useState<StudentProgressSummary[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [presences, setPresences] = useState<Record<string, StudentPresenceRecord>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTrade, setSelectedTrade] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");

  // Messaging Modal State
  const [messagingTarget, setMessagingTarget] = useState<StudentProgressSummary | 'behind' | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    loadData();

    // Auto refresh presences every 5 seconds
    const interval = setInterval(async () => {
      const livePresences = await getAllStudentPresences();
      setPresences(livePresences);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [summaries, allTrades, livePresences] = await Promise.all([
      getStudentProgressSummaries(),
      getAllTrades(),
      getAllStudentPresences(),
    ]);
    setStudents(summaries);
    setTrades(allTrades);
    setPresences(livePresences);
    setLoading(false);
  };

  const tradesMap = trades.reduce((acc, t) => {
    acc[t.id] = t.name;
    return acc;
  }, {} as Record<string, string>);

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      s.username.toLowerCase().includes(search.toLowerCase());

    const matchesTrade = selectedTrade === "all" || s.tradeId === selectedTrade;
    const matchesLevel = selectedLevel === "all" || s.level === selectedLevel;

    return matchesSearch && matchesTrade && matchesLevel;
  });

  const behindCount = students.filter((s) => s.progressPercent < 30).length;
  
  // Real-Time Attention & Presence counts
  const activeLearningCount = students.filter(s => presences[s.userId]?.state === 'actively_reading').length;
  const tabUnfocusedCount = students.filter(s => presences[s.userId]?.state === 'tab_unfocused').length;
  const offlineCount = students.length - (activeLearningCount + tabUnfocusedCount);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !messagingTarget) return;
    setSending(true);

    const admin = getAdminSession();
    const senderName = admin ? admin.fullName : "Teacher Admin";

    if (messagingTarget === 'behind') {
      const behindStudents = students.filter((s) => s.progressPercent < 30);
      for (const st of behindStudents) {
        await sendStudentNotification(st.userId, senderName, messageText);
      }
      if (admin) {
        await logActivity({
          userId: admin.uid,
          userName: admin.fullName,
          userEmail: admin.email,
          userLevel: admin.level,
          action: "SEND_STUDENT_MESSAGE",
          details: `Broadcast notification to ${behindStudents.length} students flagged behind schedule.`,
        });
      }
      setSuccessNotice(`Notification successfully sent to ${behindStudents.length} students behind schedule!`);
    } else {
      await sendStudentNotification(messagingTarget.userId, senderName, messageText);
      if (admin) {
        await logActivity({
          userId: admin.uid,
          userName: admin.fullName,
          userEmail: admin.email,
          userLevel: admin.level,
          action: "SEND_STUDENT_MESSAGE",
          details: `Sent direct message to student ${messagingTarget.fullName} (${messagingTarget.email}).`,
        });
      }
      setSuccessNotice(`Notification sent to ${messagingTarget.fullName}!`);
    }

    setSending(false);
    setMessagingTarget(null);
    setMessageText("");

    setTimeout(() => setSuccessNotice(null), 4000);
    loadData();
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Broadcast Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#334155] pb-4 gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center space-x-2">
            <Users className="h-5 w-5 text-[#06B6D4]" />
            <span>Student Progress & Attention Monitoring Center</span>
          </h3>
          <p className="text-xs text-[#94A3B8]">
            Real-time tracking of active student reading focus, tab switching alerts, and module completion progress.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            className="inline-flex items-center space-x-1.5 rounded-xl border border-[#334155] bg-[#1E293B] px-3 py-2 text-xs font-semibold text-[#CBD5E1] hover:text-white transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {behindCount > 0 && (
            <button
              onClick={() => {
                setMessagingTarget('behind');
                setMessageText("Notice: You are currently behind on your assigned syllabus modules. Please log in and review your subtopic learning outcomes.");
              }}
              className="inline-flex items-center space-x-2 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-all shadow-lg"
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Notify All Behind ({behindCount})</span>
            </button>
          )}
        </div>
      </div>

      {successNotice && (
        <div className="rounded-xl border border-[#10B981]/30 bg-[#10B981]/15 p-4 text-xs font-semibold text-[#10B981] flex items-center space-x-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Overview Stat Cards with Live Attention Status */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-mono font-bold text-[#94A3B8] uppercase tracking-wider block mb-1">
              Total Enrolled Students
            </span>
            <span className="text-3xl font-extrabold text-white font-mono">{students.length}</span>
            <span className="text-[11px] text-[#94A3B8] block mt-1">Across all trades & levels</span>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#06B6D4]/20 text-[#06B6D4]">
            <Users className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-2xl border border-[#10B981]/40 bg-[#10B981]/10 p-5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-mono font-bold text-[#10B981] uppercase tracking-wider block mb-1">
              🟢 Actively Learning
            </span>
            <span className="text-3xl font-extrabold text-[#10B981] font-mono">{activeLearningCount}</span>
            <span className="text-[11px] text-[#94A3B8] block mt-1">Tab active & focused</span>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#10B981]/20 text-[#10B981]">
            <Radio className="h-6 w-6 animate-pulse" />
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider block mb-1">
              🟡 Switched Tab / Away
            </span>
            <span className="text-3xl font-extrabold text-amber-400 font-mono">{tabUnfocusedCount}</span>
            <span className="text-[11px] text-[#94A3B8] block mt-1">Left syllabus browser tab</span>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
            <EyeOff className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-mono font-bold text-[#94A3B8] uppercase tracking-wider block mb-1">
              ⚪ Offline
            </span>
            <span className="text-3xl font-extrabold text-slate-400 font-mono">{offlineCount}</span>
            <span className="text-[11px] text-[#94A3B8] block mt-1">Inactive &gt; 2 mins</span>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-700/30 text-slate-400">
            <Clock className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#1E293B] p-4 rounded-2xl border border-[#334155]">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter students by name, email, or username..."
            className="w-full rounded-xl bg-[#0B0F19] border border-[#334155] pl-10 pr-4 py-2 text-xs text-white placeholder-[#94A3B8] focus:border-[#06B6D4] focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <select
            value={selectedTrade}
            onChange={(e) => setSelectedTrade(e.target.value)}
            className="rounded-xl bg-[#0B0F19] border border-[#334155] px-3 py-2 text-xs font-semibold text-[#CBD5E1] focus:border-[#06B6D4] focus:outline-none"
          >
            <option value="all">All Academic Trades</option>
            {trades.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="rounded-xl bg-[#0B0F19] border border-[#334155] px-3 py-2 text-xs font-semibold text-[#CBD5E1] focus:border-[#06B6D4] focus:outline-none font-mono"
          >
            <option value="all">All Levels</option>
            <option value="Level 3">Level 3</option>
            <option value="Level 4">Level 4</option>
            <option value="Level 5">Level 5</option>
          </select>
        </div>
      </div>

      {/* Student Progress & Live Presence Table */}
      {loading ? (
        <div className="py-20 text-center text-[#94A3B8]">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#06B6D4] border-t-transparent mb-3" />
          Analyzing student progress matrices and live tab presence...
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="py-16 text-center text-[#94A3B8] bg-[#1E293B]/40 rounded-2xl border border-[#334155]">
          No approved students matching the selected trade and level filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#334155] bg-[#1E293B]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#334155] bg-[#0B0F19]/50 font-mono text-[#94A3B8] uppercase">
              <tr>
                <th className="px-6 py-4">Student Profile</th>
                <th className="px-6 py-4">Live Attention Status</th>
                <th className="px-6 py-4">Trade & Level</th>
                <th className="px-6 py-4">Subtopic Progress</th>
                <th className="px-6 py-4">Academic Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]">
              {filteredStudents.map((st) => {
                const presence = presences[st.userId];
                const presenceState = presence?.state || 'offline';

                return (
                  <tr key={st.userId} className="hover:bg-[#0B0F19]/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-white text-sm flex items-center space-x-2">
                        <span>{st.fullName}</span>
                      </div>
                      <div className="text-[11px] text-[#94A3B8] font-mono flex items-center space-x-2 mt-0.5">
                        <span>@{st.username}</span>
                        {st.email ? (
                          <span>• {st.email}</span>
                        ) : (
                          <span className="text-amber-400 font-mono">(No Email)</span>
                        )}
                      </div>
                    </td>

                    {/* LIVE ATTENTION STATUS COLUMN */}
                    <td className="px-6 py-4">
                      {presenceState === 'actively_reading' ? (
                        <div className="flex flex-col">
                          <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#10B981]">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10B981]"></span>
                            </span>
                            <span>Actively Learning</span>
                          </span>
                          {presence?.currentSubtopicTitle && (
                            <span className="text-[10px] text-[#94A3B8] line-clamp-1 mt-0.5 font-mono">
                              Reading: {presence.currentSubtopicTitle}
                            </span>
                          )}
                        </div>
                      ) : presenceState === 'tab_unfocused' ? (
                        <div className="flex flex-col">
                          <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-amber-400">
                            <span className="h-2.5 w-2.5 rounded-full bg-amber-400"></span>
                            <span>Left Tab / Switched Away</span>
                          </span>
                          <span className="text-[10px] text-[#94A3B8] mt-0.5 font-mono">
                            Unfocused / Inactive window
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 font-mono">
                          <span className="h-2 w-2 rounded-full bg-slate-600"></span>
                          <span>Offline</span>
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-semibold text-[#CBD5E1]">
                        {tradesMap[st.tradeId] || 'General'}
                      </div>
                      <span className="inline-block mt-1 rounded bg-[#06B6D4]/15 px-2 py-0.5 font-mono text-[10px] text-[#06B6D4] font-bold border border-[#06B6D4]/30">
                        {st.level}
                      </span>
                    </td>

                    <td className="px-6 py-4 min-w-[180px]">
                      <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                        <span className="text-[#CBD5E1]">
                          {st.completedSubtopicsCount} / {st.totalSubtopicsCount}
                        </span>
                        <span className="font-bold text-white">{st.progressPercent}%</span>
                      </div>

                      <div className="h-2 w-full rounded-full bg-[#0B0F19] overflow-hidden border border-[#334155]">
                        <div
                          className={`h-full transition-all ${
                            st.progressPercent < 30
                              ? 'bg-amber-500'
                              : st.progressPercent >= 70
                              ? 'bg-[#10B981]'
                              : 'bg-[#06B6D4]'
                          }`}
                          style={{ width: `${Math.max(5, st.progressPercent)}%` }}
                        />
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {st.progressPercent < 30 ? (
                        <span className="inline-flex items-center space-x-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-400 border border-amber-500/30">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Behind</span>
                        </span>
                      ) : st.progressPercent >= 70 ? (
                        <span className="inline-flex items-center space-x-1 rounded-full bg-[#10B981]/15 px-2.5 py-1 text-[11px] font-bold text-[#10B981] border border-[#10B981]/30">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>On Track</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 rounded-full bg-[#06B6D4]/15 px-2.5 py-1 text-[11px] font-bold text-[#06B6D4] border border-[#06B6D4]/30">
                          <Clock className="h-3 w-3" />
                          <span>In Progress</span>
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          setMessagingTarget(st);
                          setMessageText(`Hi ${st.fullName}, here is a quick note regarding your syllabus progress...`);
                        }}
                        className="inline-flex items-center space-x-1.5 rounded-xl border border-[#334155] bg-[#0B0F19] px-3 py-1.5 text-xs font-semibold text-[#06B6D4] hover:border-[#06B6D4] hover:text-white transition-all shadow-md"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>Send Message</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* DIRECT MESSAGING MODAL */}
      {messagingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[#334155] bg-[#1E293B] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#334155] pb-3">
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-5 w-5 text-[#06B6D4]" />
                <h4 className="text-base font-bold text-white">
                  {messagingTarget === 'behind'
                    ? `Broadcast Message to ${behindCount} Students`
                    : `Notify ${messagingTarget.fullName}`}
                </h4>
              </div>
              <button
                onClick={() => setMessagingTarget(null)}
                className="text-[#94A3B8] hover:text-white text-xs font-mono"
              >
                Cancel
              </button>
            </div>

            <div>
              <label className="block text-xs font-mono text-[#94A3B8] mb-2">
                Message Content (Student will see this upon login / refresh):
              </label>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={4}
                placeholder="Write message to student..."
                className="w-full rounded-xl bg-[#0B0F19] border border-[#334155] p-3 text-xs text-white placeholder-[#94A3B8] focus:border-[#06B6D4] focus:outline-none leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-[#94A3B8] font-mono">
                Delivered via in-app alert banner
              </span>

              <button
                onClick={handleSendMessage}
                disabled={sending || !messageText.trim()}
                className="inline-flex items-center space-x-2 rounded-xl bg-[#06B6D4] px-4 py-2 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all disabled:opacity-50 shadow-lg"
              >
                <Send className="h-4 w-4" />
                <span>{sending ? "Sending..." : "Dispatch Notification"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
