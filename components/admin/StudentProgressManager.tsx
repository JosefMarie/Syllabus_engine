"use client";

import React, { useEffect, useState, useMemo } from "react";
import { StudentProgressSummary } from "@/types/notification";
import { Trade } from "@/types/auth";
import { StudentPresenceRecord } from "@/types/presence";
import { Syllabus } from "@/types/syllabus";
import { StudentTopicTimeRecord, DateRangePreset } from "@/types/timeTracking";
import { 
  getStudentProgressSummaries, 
  getLocalStudentProgressSummaries,
  getAllTrades, 
  sendStudentNotification, 
  logActivity,
  getAllStudentTopicTimeRecords,
  getLocalStudentTopicTimeRecords,
  subscribeToStudentTopicTimeRecords,
  clearAllStudentTopicTimeRecords,
  getAllSyllabi,
  getLocalSyllabi,
  resetStudentUnfocusedCount
} from "@/lib/db";
import { 
  getAllStudentPresences, 
  getLocalStudentPresences, 
  subscribeToStudentPresences 
} from "@/lib/presence";
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
  RefreshCw, 
  EyeOff, 
  Radio, 
  BarChart3, 
  Calendar, 
  BookOpen, 
  Download, 
  Layers, 
  FileSpreadsheet, 
  ChevronRight, 
  TrendingUp, 
  Flame, 
  Award, 
  ExternalLink, 
  X,
  Trash2,
  RotateCcw
} from "lucide-react";

export default function StudentProgressManager() {
  // Navigation View: 'attention' (realtime focus & progress) | 'time_reports' (active minutes & charts)
  const [activeTab, setActiveTab] = useState<'attention' | 'time_reports'>('time_reports');

  // Common Data State - Initialized immediately from local cache so UI renders in 0ms
  const [students, setStudents] = useState<StudentProgressSummary[]>(() => {
    if (typeof window !== "undefined") {
      return getLocalStudentProgressSummaries();
    }
    return [];
  });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [presences, setPresences] = useState<Record<string, StudentPresenceRecord>>(() => {
    if (typeof window !== "undefined") {
      return getLocalStudentPresences();
    }
    return {};
  });
  const [syllabi, setSyllabi] = useState<Syllabus[]>(() => {
    if (typeof window !== "undefined") {
      return getLocalSyllabi();
    }
    return [];
  });
  const [timeRecords, setTimeRecords] = useState<StudentTopicTimeRecord[]>(() => {
    if (typeof window !== "undefined") {
      return getLocalStudentTopicTimeRecords();
    }
    return [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const local = getLocalStudentProgressSummaries();
      return local.length === 0;
    }
    return true;
  });
  const [refreshing, setRefreshing] = useState(false);

  // Attention Tab Filters
  const [search, setSearch] = useState("");
  const [selectedTrade, setSelectedTrade] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");

  // Messaging Modal State
  const [messagingTarget, setMessagingTarget] = useState<StudentProgressSummary | 'behind' | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Time Reports Tab Filters
  const [reportDatePreset, setReportDatePreset] = useState<DateRangePreset>("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [reportSyllabusId, setReportSyllabusId] = useState<string>("all");
  const [reportTopicId, setReportTopicId] = useState<string>("all");
  const [reportStudentId, setReportStudentId] = useState<string>("all");
  const [reportSearch, setReportSearch] = useState<string>("");

  // Detailed Student Modal State
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<{
    userId: string;
    studentName: string;
    studentEmail: string;
    records: StudentTopicTimeRecord[];
    totalMinutes: number;
  } | null>(null);

  useEffect(() => {
    // 1. Subscribe to instant real-time student presences (onSnapshot + local events)
    const unsubPresences = subscribeToStudentPresences((livePresences) => {
      setPresences(livePresences);
    });

    // 2. Subscribe to instant real-time student topic time records (onSnapshot + local events)
    const unsubTimeRecords = subscribeToStudentTopicTimeRecords((liveRecords) => {
      setTimeRecords(liveRecords);
    });

    // 3. Load full data (syllabi, trades, progress summaries)
    loadData();

    // 4. Low-frequency background sync for progress matrices (every 20s) with concurrency guard
    let isSyncing = false;
    const interval = setInterval(async () => {
      if (isSyncing) return;
      isSyncing = true;
      try {
        const summaries = await getStudentProgressSummaries();
        if (summaries && summaries.length > 0) {
          setStudents(summaries);
        }
      } catch (e) {
        // silent
      } finally {
        isSyncing = false;
      }
    }, 20000);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "syllabus_platform_notifications_v1" || e.key === "syllabus_platform_users_v1") {
        getStudentProgressSummaries().then(setStudents).catch(() => {});
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("syllabus_notification_received", () => {
      getStudentProgressSummaries().then(setStudents).catch(() => {});
    });

    return () => {
      unsubPresences();
      unsubTimeRecords();
      clearInterval(interval);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const loadData = async () => {
    setRefreshing(true);
    try {
      // 3.5-second timeout safeguard so slow/offline network never hangs loading
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500));

      const fetchPromise = Promise.all([
        getStudentProgressSummaries(),
        getAllTrades(),
        getAllStudentPresences(),
        getAllSyllabi(),
        getAllStudentTopicTimeRecords(),
      ]);

      const results: any = await Promise.race([fetchPromise, timeoutPromise]);
      if (results) {
        const [summaries, allTrades, livePresences, allSyllabi, allTimeRecords] = results;
        if (summaries) setStudents(summaries);
        if (allTrades) setTrades(allTrades);
        if (livePresences) setPresences(livePresences);
        if (allSyllabi) setSyllabi(allSyllabi);
        if (allTimeRecords) setTimeRecords(allTimeRecords);
      }
    } catch (err) {
      console.warn("loadData encountered an issue, staying on current/local data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const tradesMap = useMemo(() => {
    return trades.reduce((acc, t) => {
      acc[t.id] = t.name;
      return acc;
    }, {} as Record<string, string>);
  }, [trades]);

  // Extract all available topics based on selected syllabus filter
  const availableTopics = useMemo(() => {
    const topicMap: Record<string, { id: string; title: string; syllabusTitle: string }> = {};
    const relevantSyllabi = reportSyllabusId === "all" 
      ? syllabi 
      : syllabi.filter(s => s.id === reportSyllabusId);

    relevantSyllabi.forEach(s => {
      s.learningOutcomes?.forEach(lo => {
        lo.indicativeContents?.forEach(ic => {
          ic.topics?.forEach(t => {
            if (!topicMap[t.id]) {
              topicMap[t.id] = {
                id: t.id,
                title: t.title,
                syllabusTitle: s.title
              };
            }
          });
        });
      });
    });

    // Also include topics that exist in recorded logs in case they differ
    timeRecords.forEach(r => {
      if (reportSyllabusId === "all" || r.syllabusId === reportSyllabusId) {
        if (!topicMap[r.topicId]) {
          topicMap[r.topicId] = {
            id: r.topicId,
            title: r.topicTitle,
            syllabusTitle: r.syllabusTitle
          };
        }
      }
    });

    return Object.values(topicMap);
  }, [syllabi, timeRecords, reportSyllabusId]);

  // ====================================================
  // FILTERING TIME RECORDS (Active Time Only, Away Excluded)
  // ====================================================
  const filteredTimeRecords = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const d7 = new Date(today);
    d7.setDate(d7.getDate() - 7);
    const d7Str = d7.toISOString().split('T')[0];

    const d30 = new Date(today);
    d30.setDate(d30.getDate() - 30);
    const d30Str = d30.toISOString().split('T')[0];

    return timeRecords.filter((rec) => {
      // Date Filter
      if (reportDatePreset === "today" && rec.date !== todayStr) return false;
      if (reportDatePreset === "7days" && rec.date < d7Str) return false;
      if (reportDatePreset === "30days" && rec.date < d30Str) return false;
      if (reportDatePreset === "custom") {
        if (customStartDate && rec.date < customStartDate) return false;
        if (customEndDate && rec.date > customEndDate) return false;
      }

      // Syllabus Filter
      if (reportSyllabusId !== "all" && rec.syllabusId !== reportSyllabusId) return false;

      // Topic Filter
      if (reportTopicId !== "all" && rec.topicId !== reportTopicId) return false;

      // Student Filter
      if (reportStudentId !== "all" && rec.userId !== reportStudentId) return false;

      // Search Filter
      if (reportSearch.trim()) {
        const q = reportSearch.toLowerCase();
        const matchesName = rec.studentName?.toLowerCase().includes(q);
        const matchesEmail = rec.studentEmail?.toLowerCase().includes(q);
        const matchesTopic = rec.topicTitle?.toLowerCase().includes(q);
        const matchesSyllabus = rec.syllabusTitle?.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesTopic && !matchesSyllabus) return false;
      }

      return true;
    });
  }, [
    timeRecords, 
    reportDatePreset, 
    customStartDate, 
    customEndDate, 
    reportSyllabusId, 
    reportTopicId, 
    reportStudentId, 
    reportSearch
  ]);

  // ====================================================
  // STUDENT-BY-STUDENT ROW AGGREGATION
  // ====================================================
  const studentRowsReport = useMemo(() => {
    // Map userId -> Aggregated Student Row
    const map: Record<string, {
      userId: string;
      studentName: string;
      studentEmail: string;
      studentUsername: string;
      studentTradeId: string;
      studentLevel: string;
      unfocusedCount: number;
      suspensionReason?: string;
      totalActiveMinutes: number;
      topicMap: Record<string, { topicId: string; topicTitle: string; syllabusTitle: string; minutes: number }>;
      syllabiSet: Set<string>;
      datesSet: Set<string>;
      lastActive: string;
      records: StudentTopicTimeRecord[];
    }> = {};

    // Initialize with all filtered students so even students with 0 time in this filter are represented if viewing all
    students.forEach((st) => {
      if (reportStudentId !== "all" && st.userId !== reportStudentId) return;
      if (reportSearch.trim()) {
        const q = reportSearch.toLowerCase();
        const matches = st.fullName.toLowerCase().includes(q) || st.email?.toLowerCase().includes(q) || st.username?.toLowerCase().includes(q);
        if (!matches) return;
      }

      map[st.userId] = {
        userId: st.userId,
        studentName: st.fullName,
        studentEmail: st.email || "",
        studentUsername: st.username,
        studentTradeId: st.tradeId || "",
        studentLevel: st.level || "",
        unfocusedCount: presences[st.userId]?.unfocusedCount ?? st.unfocusedCount ?? 0,
        suspensionReason: st.suspensionReason || "",
        totalActiveMinutes: 0,
        topicMap: {},
        syllabiSet: new Set(),
        datesSet: new Set(),
        lastActive: st.lastActive || "",
        records: [],
      };
    });

    // Accumulate matching filtered records
    filteredTimeRecords.forEach((rec) => {
      if (!map[rec.userId]) {
        map[rec.userId] = {
          userId: rec.userId,
          studentName: rec.studentName,
          studentEmail: rec.studentEmail || "",
          studentUsername: rec.studentUsername || "",
          studentTradeId: rec.studentTradeId || "",
          studentLevel: rec.studentLevel || "",
          unfocusedCount: presences[rec.userId]?.unfocusedCount ?? 0,
          suspensionReason: "",
          totalActiveMinutes: 0,
          topicMap: {},
          syllabiSet: new Set(),
          datesSet: new Set(),
          lastActive: rec.lastUpdated,
          records: [],
        };
      }

      const stObj = map[rec.userId];
      stObj.totalActiveMinutes += rec.activeMinutes;
      stObj.syllabiSet.add(rec.syllabusTitle);
      stObj.datesSet.add(rec.date);
      stObj.records.push(rec);

      if (!stObj.lastActive || rec.lastUpdated > stObj.lastActive) {
        stObj.lastActive = rec.lastUpdated;
      }

      if (!stObj.topicMap[rec.topicId]) {
        stObj.topicMap[rec.topicId] = {
          topicId: rec.topicId,
          topicTitle: rec.topicTitle,
          syllabusTitle: rec.syllabusTitle,
          minutes: 0,
        };
      }
      stObj.topicMap[rec.topicId].minutes += rec.activeMinutes;
    });

    // Convert map to sorted array (highest active time first)
    return Object.values(map)
      .map((st) => ({
        ...st,
        totalActiveMinutes: Math.round(st.totalActiveMinutes * 10) / 10,
        topics: Object.values(st.topicMap).sort((a, b) => b.minutes - a.minutes),
        syllabiTitles: Array.from(st.syllabiSet),
        activeDaysCount: st.datesSet.size,
      }))
      .sort((a, b) => b.totalActiveMinutes - a.totalActiveMinutes);
  }, [students, presences, filteredTimeRecords, reportStudentId, reportSearch]);

  // ====================================================
  // CHARTS DATA
  // ====================================================

  // 1. Topic Engagement Chart Data (Top topics by total minutes)
  const topicEngagementChartData = useMemo(() => {
    const map: Record<string, { topicId: string; topicTitle: string; syllabusTitle: string; totalMinutes: number; studentCount: Set<string> }> = {};

    filteredTimeRecords.forEach((r) => {
      if (!map[r.topicId]) {
        map[r.topicId] = {
          topicId: r.topicId,
          topicTitle: r.topicTitle,
          syllabusTitle: r.syllabusTitle,
          totalMinutes: 0,
          studentCount: new Set(),
        };
      }
      map[r.topicId].totalMinutes += r.activeMinutes;
      map[r.topicId].studentCount.add(r.userId);
    });

    const list = Object.values(map).map((t) => ({
      ...t,
      totalMinutes: Math.round(t.totalMinutes * 10) / 10,
      studentCount: t.studentCount.size,
    }));

    list.sort((a, b) => b.totalMinutes - a.totalMinutes);
    return list.slice(0, 8); // Top 8 topics
  }, [filteredTimeRecords]);

  // 2. Student Active Time Comparison Chart Data (Top 6 students)
  const studentComparisonChartData = useMemo(() => {
    return studentRowsReport.slice(0, 6);
  }, [studentRowsReport]);

  // KPI Metrics
  const totalFilteredMinutes = useMemo(() => {
    const sum = filteredTimeRecords.reduce((acc, r) => acc + r.activeMinutes, 0);
    return Math.round(sum * 10) / 10;
  }, [filteredTimeRecords]);

  const activeStudentsCount = useMemo(() => {
    const set = new Set(filteredTimeRecords.map(r => r.userId));
    return set.size;
  }, [filteredTimeRecords]);

  const averageMinutesPerStudent = useMemo(() => {
    if (activeStudentsCount === 0) return 0;
    return Math.round((totalFilteredMinutes / activeStudentsCount) * 10) / 10;
  }, [totalFilteredMinutes, activeStudentsCount]);

  const topTopic = useMemo(() => {
    return topicEngagementChartData[0] || null;
  }, [topicEngagementChartData]);

  // CSV Export
  const handleExportCSV = () => {
    if (filteredTimeRecords.length === 0) {
      alert("No time records matching the current filter to export.");
      return;
    }

    const headers = [
      "Student Name",
      "Email",
      "Username",
      "Level",
      "Syllabus",
      "Topic",
      "Subtopic",
      "Date",
      "Active Minutes",
      "Active Seconds (excluding away)",
      "Last Updated"
    ];

    const rows = filteredTimeRecords.map((r) => [
      `"${r.studentName.replace(/"/g, '""')}"`,
      `"${(r.studentEmail || '').replace(/"/g, '""')}"`,
      `"${(r.studentUsername || '').replace(/"/g, '""')}"`,
      `"${(r.studentLevel || '').replace(/"/g, '""')}"`,
      `"${r.syllabusTitle.replace(/"/g, '""')}"`,
      `"${r.topicTitle.replace(/"/g, '""')}"`,
      `"${(r.subtopicTitle || '').replace(/"/g, '""')}"`,
      r.date,
      r.activeMinutes,
      r.activeSeconds,
      r.lastUpdated
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `student_topic_time_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper formatting minutes to "Xh Ym" or "X mins"
  const formatTimeDisplay = (mins: number) => {
    if (mins < 60) return `${Math.round(mins)} mins`;
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h}h ${m}m (${Math.round(mins)}m)`;
  };

  // Attention Tab Handlers
  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      s.username.toLowerCase().includes(search.toLowerCase());

    const matchesTrade = selectedTrade === "all" || s.tradeId === selectedTrade;
    const matchesLevel = selectedLevel === "all" || s.level === selectedLevel;

    return matchesSearch && matchesTrade && matchesLevel;
  });

  const behindCount = students.filter((s) => s.totalSubtopicsCount > 0 && s.progressPercent < 30).length;
  const activeLearningCount = students.filter(s => presences[s.userId]?.state === 'actively_reading').length;
  const idleCount = students.filter(s => presences[s.userId]?.state === 'idle').length;
  const tabUnfocusedCount = students.filter(s => presences[s.userId]?.state === 'tab_unfocused').length;
  const offlineCount = students.length - (activeLearningCount + idleCount + tabUnfocusedCount);

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

  const [clearingTime, setClearingTime] = useState(false);

  const handleClearTimeRecords = async () => {
    const ok = window.confirm(
      "Are you sure you want to remove all student topic reading time records and start fresh? All charts and learning totals will be reset to 0 minutes."
    );
    if (!ok) return;

    setClearingTime(true);
    await clearAllStudentTopicTimeRecords();
    setTimeRecords([]);
    setSuccessNotice("All topic time tracking records have been cleared. Platform is fresh at 0 minutes.");
    setTimeout(() => setSuccessNotice(null), 4000);
    setClearingTime(false);
    loadData();
  };

  return (
    <div className="space-y-6">
      {/* Top Main Navigation Header with Tab Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#334155] pb-4 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#06B6D4]/20 text-[#06B6D4]">
              {activeTab === 'time_reports' ? <Clock className="h-4 w-4" /> : <Users className="h-4 w-4" />}
            </span>
            <h3 className="text-xl font-extrabold text-white tracking-tight">
              Student Progress & Learning Analytics Center
            </h3>
          </div>
          <p className="text-xs text-[#94A3B8] mt-1">
            Active topic duration (away time excluded), syllabus engagement charts, real-time focus states, and student reports.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Main View Mode Selector */}
          <div className="flex items-center rounded-xl bg-[#0B0F19] p-1 border border-[#334155]">
            <button
              onClick={() => setActiveTab('time_reports')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'time_reports'
                  ? 'bg-[#06B6D4] text-slate-950 shadow-md'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Topic Time Reports & Charts</span>
            </button>

            <button
              onClick={() => setActiveTab('attention')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'attention'
                  ? 'bg-[#06B6D4] text-slate-950 shadow-md'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Live Attention & Focus</span>
            </button>
          </div>

          <button
            onClick={loadData}
            title="Refresh records from database"
            className="inline-flex items-center space-x-1.5 rounded-xl border border-[#334155] bg-[#1E293B] px-3 py-2 text-xs font-semibold text-[#CBD5E1] hover:text-white transition-all shadow"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {successNotice && (
        <div className="rounded-xl border border-[#10B981]/30 bg-[#10B981]/15 p-4 text-xs font-semibold text-[#10B981] flex items-center space-x-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: TOPIC TIME REPORTS & CHARTS (CALCULATED IN MINUTES, AWAY EXCLUDED) */}
      {/* ========================================================================= */}
      {activeTab === 'time_reports' && (
        <div className="space-y-6">
          {/* Away Time Guarantee Banner */}
          <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-slate-900/40 p-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 text-[#06B6D4]">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                    <span>Active Topic Reading Time Calculation</span>
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono text-emerald-400 font-bold border border-emerald-500/30">
                      Away Time Filter Active
                    </span>
                  </h4>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Time is calculated in <strong>minutes</strong> strictly during active student reading. Moments where the student switched tabs, blurred the window, or was idle for &gt;1 minute are <strong>automatically excluded</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={handleClearTimeRecords}
                  disabled={clearingTime}
                  title="Remove all topic time records and reset analytics to fresh 0m"
                  className="inline-flex items-center space-x-1.5 rounded-xl bg-[#1E293B] border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/60 px-3 py-2 text-xs font-bold transition-all shadow"
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                  <span>{clearingTime ? "Resetting..." : "Start Fresh (Clear Time)"}</span>
                </button>

                <button
                  onClick={handleExportCSV}
                  className="inline-flex items-center space-x-2 rounded-xl bg-[#1E293B] border border-[#334155] px-3.5 py-2 text-xs font-bold text-[#CBD5E1] hover:text-white hover:border-[#06B6D4] transition-all shadow"
                >
                  <FileSpreadsheet className="h-4 w-4 text-[#10B981]" />
                  <span>Export Report (CSV)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick KPI Overview Stat Cards */}
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-5 shadow-lg flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-[#94A3B8] uppercase tracking-wider block mb-1">
                  Total Active Learning Time
                </span>
                <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
                  {formatTimeDisplay(totalFilteredMinutes)}
                </span>
                <span className="text-[11px] text-cyan-400 block mt-1">
                  In selected filter window
                </span>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#06B6D4]/20 text-[#06B6D4]">
                <Clock className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-5 shadow-lg flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-[#94A3B8] uppercase tracking-wider block mb-1">
                  Avg. Focus Time / Student
                </span>
                <span className="text-2xl sm:text-3xl font-extrabold text-[#10B981] font-mono">
                  {averageMinutesPerStudent} mins
                </span>
                <span className="text-[11px] text-[#94A3B8] block mt-1">
                  Across {activeStudentsCount} active students
                </span>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#10B981]/20 text-[#10B981]">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-5 shadow-lg flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-[#94A3B8] uppercase tracking-wider block mb-1">
                  Most Studied Topic
                </span>
                <span className="text-sm font-bold text-amber-300 line-clamp-1 block">
                  {topTopic ? topTopic.topicTitle : "None yet"}
                </span>
                <span className="text-[11px] text-[#94A3B8] block mt-1 font-mono">
                  {topTopic ? `${topTopic.totalMinutes} mins spent` : "No activity"}
                </span>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                <Flame className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-5 shadow-lg flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-[#94A3B8] uppercase tracking-wider block mb-1">
                  Active Students Studied
                </span>
                <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
                  {activeStudentsCount} / {students.length}
                </span>
                <span className="text-[11px] text-[#94A3B8] block mt-1">
                  Enrolled student body
                </span>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
                <Users className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* ==================================================== */}
          {/* COMPREHENSIVE MULTI-DIMENSIONAL FILTER TOOLBAR */}
          {/* ==================================================== */}
          <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-[#334155] pb-3">
              <span className="text-xs font-mono font-bold text-[#94A3B8] uppercase flex items-center space-x-2">
                <Filter className="h-4 w-4 text-[#06B6D4]" />
                <span>Filter Learning Time Reports by Date, Syllabus, Topic & Student</span>
              </span>
              
              <button
                onClick={() => {
                  setReportDatePreset("all");
                  setReportSyllabusId("all");
                  setReportTopicId("all");
                  setReportStudentId("all");
                  setReportSearch("");
                  setCustomStartDate("");
                  setCustomEndDate("");
                }}
                className="text-[11px] text-[#06B6D4] hover:underline font-mono"
              >
                Reset All Filters
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Date Filter Presets */}
              <div>
                <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">
                  Date Range
                </label>
                <select
                  value={reportDatePreset}
                  onChange={(e) => setReportDatePreset(e.target.value as DateRangePreset)}
                  className="w-full rounded-xl bg-[#0B0F19] border border-[#334155] px-3 py-2 text-xs font-semibold text-[#CBD5E1] focus:border-[#06B6D4] focus:outline-none"
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="7days">Past 7 Days</option>
                  <option value="30days">Past 30 Days</option>
                  <option value="custom">Custom Date Range...</option>
                </select>
              </div>

              {/* Syllabus Filter */}
              <div>
                <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">
                  Syllabus
                </label>
                <select
                  value={reportSyllabusId}
                  onChange={(e) => {
                    setReportSyllabusId(e.target.value);
                    setReportTopicId("all"); // reset topic when syllabus changes
                  }}
                  className="w-full rounded-xl bg-[#0B0F19] border border-[#334155] px-3 py-2 text-xs font-semibold text-[#CBD5E1] focus:border-[#06B6D4] focus:outline-none truncate"
                >
                  <option value="all">All Syllabi</option>
                  {syllabi.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.courseCode})
                    </option>
                  ))}
                </select>
              </div>

              {/* Topic Filter */}
              <div>
                <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">
                  Topic
                </label>
                <select
                  value={reportTopicId}
                  onChange={(e) => setReportTopicId(e.target.value)}
                  className="w-full rounded-xl bg-[#0B0F19] border border-[#334155] px-3 py-2 text-xs font-semibold text-[#CBD5E1] focus:border-[#06B6D4] focus:outline-none truncate"
                >
                  <option value="all">All Topics ({availableTopics.length})</option>
                  {availableTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Student Filter (Single student or all) */}
              <div>
                <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">
                  Student View
                </label>
                <select
                  value={reportStudentId}
                  onChange={(e) => setReportStudentId(e.target.value)}
                  className="w-full rounded-xl bg-[#0B0F19] border border-[#334155] px-3 py-2 text-xs font-semibold text-[#CBD5E1] focus:border-[#06B6D4] focus:outline-none truncate"
                >
                  <option value="all">All Students (Row by Row)</option>
                  {students.map((st) => (
                    <option key={st.userId} value={st.userId}>
                      {st.fullName} ({st.username})
                    </option>
                  ))}
                </select>
              </div>

              {/* Search input */}
              <div>
                <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">
                  Search Query
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8]" />
                  <input
                    type="text"
                    value={reportSearch}
                    onChange={(e) => setReportSearch(e.target.value)}
                    placeholder="Student name, topic..."
                    className="w-full rounded-xl bg-[#0B0F19] border border-[#334155] pl-8 pr-3 py-2 text-xs text-white placeholder-[#94A3B8] focus:border-[#06B6D4] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Custom Date Pickers when 'custom' is selected */}
            {reportDatePreset === "custom" && (
              <div className="pt-2 border-t border-[#334155]/60 flex flex-wrap items-center gap-3 bg-[#0B0F19]/40 p-3 rounded-xl">
                <span className="text-xs font-mono text-[#94A3B8] flex items-center space-x-1.5">
                  <Calendar className="h-3.5 w-3.5 text-[#06B6D4]" />
                  <span>Specify Custom Date Bounds:</span>
                </span>
                <div className="flex items-center space-x-2">
                  <label className="text-[11px] text-[#94A3B8]">From:</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="rounded-lg bg-[#0B0F19] border border-[#334155] px-2.5 py-1 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-[11px] text-[#94A3B8]">To:</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="rounded-lg bg-[#0B0F19] border border-[#334155] px-2.5 py-1 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ==================================================== */}
          {/* VISUAL CHARTS SECTION */}
          {/* ==================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Topic Engagement Bar Chart */}
            <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-[#334155] pb-3">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-4 w-4 text-[#06B6D4]" />
                  <h4 className="text-sm font-bold text-white">
                    Topic Engagement Breakdown (Active Minutes)
                  </h4>
                </div>
                <span className="text-[11px] font-mono text-[#94A3B8]">
                  Top {topicEngagementChartData.length} Topics
                </span>
              </div>

              {topicEngagementChartData.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#94A3B8]">
                  No topic learning activity recorded under this filter criteria.
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  {(() => {
                    const maxTopicMinutes = Math.max(...topicEngagementChartData.map(t => t.totalMinutes), 1);
                    return topicEngagementChartData.map((item, idx) => {
                      const percentage = Math.min(100, Math.round((item.totalMinutes / maxTopicMinutes) * 100));
                      return (
                        <div key={item.topicId} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-2 truncate max-w-[75%]">
                              <span className="font-mono text-[10px] text-[#06B6D4] font-bold">
                                #{idx + 1}
                              </span>
                              <span className="font-semibold text-[#CBD5E1] truncate" title={item.topicTitle}>
                                {item.topicTitle}
                              </span>
                              <span className="text-[10px] text-[#94A3B8] font-mono shrink-0 hidden sm:inline">
                                ({item.studentCount} students)
                              </span>
                            </div>
                            <div className="font-mono font-bold text-white text-xs">
                              {item.totalMinutes} mins
                            </div>
                          </div>

                          <div className="h-2.5 w-full rounded-full bg-[#0B0F19] overflow-hidden border border-[#334155]">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#06B6D4] to-[#10B981] transition-all duration-500"
                              style={{ width: `${Math.max(5, percentage)}%` }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            {/* Chart 2: Student Learning Time Comparison Chart */}
            <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-[#334155] pb-3">
                <div className="flex items-center space-x-2">
                  <Award className="h-4 w-4 text-amber-400" />
                  <h4 className="text-sm font-bold text-white">
                    Student Active Time Ranking (Minutes)
                  </h4>
                </div>
                <span className="text-[11px] font-mono text-[#94A3B8]">
                  Comparing Students
                </span>
              </div>

              {studentComparisonChartData.length === 0 || studentComparisonChartData.every(s => s.totalActiveMinutes === 0) ? (
                <div className="py-12 text-center text-xs text-[#94A3B8]">
                  No student learning time recorded for this selection.
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  {(() => {
                    const maxStudentMinutes = Math.max(...studentComparisonChartData.map(s => s.totalActiveMinutes), 1);
                    return studentComparisonChartData.map((st, idx) => {
                      const percentage = Math.min(100, Math.round((st.totalActiveMinutes / maxStudentMinutes) * 100));
                      return (
                        <div key={st.userId} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-2 truncate max-w-[70%]">
                              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-mono font-bold ${
                                idx === 0 ? 'bg-amber-500 text-slate-950' : idx === 1 ? 'bg-slate-300 text-slate-950' : 'bg-[#0B0F19] text-[#CBD5E1] border border-[#334155]'
                              }`}>
                                {idx + 1}
                              </span>
                              <span className="font-bold text-white truncate">
                                {st.studentName}
                              </span>
                              {st.studentLevel && (
                                <span className="rounded bg-[#06B6D4]/15 px-1.5 py-0.5 text-[9px] font-mono text-[#06B6D4] font-bold border border-[#06B6D4]/30 hidden sm:inline">
                                  {st.studentLevel}
                                </span>
                              )}
                            </div>
                            <div className="font-mono font-bold text-[#10B981] text-xs">
                              {formatTimeDisplay(st.totalActiveMinutes)}
                            </div>
                          </div>

                          <div className="h-2.5 w-full rounded-full bg-[#0B0F19] overflow-hidden border border-[#334155]">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-[#10B981] transition-all duration-500"
                              style={{ width: `${Math.max(4, percentage)}%` }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* ==================================================== */}
          {/* STUDENT-BY-STUDENT REPORT TABLE IN ROWS */}
          {/* ==================================================== */}
          <div className="rounded-2xl border border-[#334155] bg-[#1E293B] shadow-lg overflow-hidden space-y-0">
            <div className="p-5 border-b border-[#334155] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0B0F19]/40">
              <div>
                <h4 className="text-base font-bold text-white flex items-center space-x-2">
                  <Users className="h-4 w-4 text-[#06B6D4]" />
                  <span>Student Active Learning Reports (Student-by-Student Rows)</span>
                </h4>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Detailed active minutes per student broken down by specific syllabus topics with away-time pauses filtered out.
                </p>
              </div>

              <div className="text-xs font-mono text-[#94A3B8]">
                Showing <strong className="text-white">{studentRowsReport.length}</strong> student rows
              </div>
            </div>

            {loading && studentRowsReport.length === 0 ? (
              <div className="py-20 text-center text-[#94A3B8]">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#06B6D4] border-t-transparent mb-3" />
                Aggregating active learning minutes and topic logs...
              </div>
            ) : studentRowsReport.length === 0 ? (
              <div className="py-16 text-center text-[#94A3B8]">
                No student reports matching the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#334155] bg-[#0B0F19]/70 font-mono text-[#94A3B8] uppercase">
                    <tr>
                      <th className="px-6 py-4">Student</th>
                      <th className="px-6 py-4">Trade & Level</th>
                      <th className="px-6 py-4">Syllabus Studied</th>
                      <th className="px-6 py-4 min-w-[260px]">Topics & Time Spent (Minutes)</th>
                      <th className="px-6 py-4">Total Active Time</th>
                      <th className="px-6 py-4">Side Windows / Strikes</th>
                      <th className="px-6 py-4">Active Sessions</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#334155]">
                    {studentRowsReport.map((st) => (
                      <tr key={st.userId} className="hover:bg-[#0B0F19]/30 transition-colors">
                        {/* Student Details */}
                        <td className="px-6 py-4">
                          <div className="font-bold text-white text-sm">
                            {st.studentName}
                          </div>
                          <div className="text-[11px] text-[#94A3B8] font-mono flex items-center space-x-2 mt-0.5">
                            <span>@{st.studentUsername || 'student'}</span>
                            {st.studentEmail && (
                              <span>• {st.studentEmail}</span>
                            )}
                          </div>
                        </td>

                        {/* Trade & Level */}
                        <td className="px-6 py-4">
                          <div className="font-semibold text-[#CBD5E1]">
                            {tradesMap[st.studentTradeId] || 'General'}
                          </div>
                          <span className="inline-block mt-1 rounded bg-[#06B6D4]/15 px-2 py-0.5 font-mono text-[10px] text-[#06B6D4] font-bold border border-[#06B6D4]/30">
                            {st.studentLevel || 'Level 4'}
                          </span>
                        </td>

                        {/* Syllabus Studied */}
                        <td className="px-6 py-4">
                          {st.syllabiTitles.length > 0 ? (
                            <div className="space-y-1">
                              {st.syllabiTitles.map((title, idx) => (
                                <span
                                  key={idx}
                                  className="inline-block rounded-md bg-[#0B0F19] px-2 py-1 text-[11px] font-semibold text-[#CBD5E1] border border-[#334155] line-clamp-1 max-w-[200px]"
                                  title={title}
                                >
                                  {title}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-500 font-mono text-[11px] italic">
                              No syllabi logged
                            </span>
                          )}
                        </td>

                        {/* Topics & Minutes Spent Badges */}
                        <td className="px-6 py-4">
                          {st.topics.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 max-w-md">
                              {st.topics.slice(0, 4).map((tp) => (
                                <span
                                  key={tp.topicId}
                                  className="inline-flex items-center space-x-1.5 rounded-lg bg-[#0B0F19] border border-[#334155] px-2.5 py-1 text-[11px]"
                                  title={`${tp.topicTitle}: ${tp.minutes} active minutes`}
                                >
                                  <span className="text-[#CBD5E1] font-medium max-w-[130px] truncate">
                                    {tp.topicTitle}
                                  </span>
                                  <span className="font-mono font-bold text-[#10B981] bg-[#10B981]/15 px-1.5 py-0.2 rounded">
                                    {Math.round(tp.minutes)}m
                                  </span>
                                </span>
                              ))}
                              {st.topics.length > 4 && (
                                <button
                                  onClick={() => setSelectedStudentDetail({
                                    userId: st.userId,
                                    studentName: st.studentName,
                                    studentEmail: st.studentEmail,
                                    records: st.records,
                                    totalMinutes: st.totalActiveMinutes
                                  })}
                                  className="inline-flex items-center text-[10px] font-mono text-[#06B6D4] hover:underline font-bold px-1"
                                >
                                  +{st.topics.length - 4} more topics
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500 font-mono text-[11px] italic">
                              0 active minutes recorded
                            </span>
                          )}
                        </td>

                        {/* Total Active Time */}
                        <td className="px-6 py-4">
                          <div className="font-mono text-sm font-extrabold text-white flex items-center space-x-1.5">
                            <Clock className="h-3.5 w-3.5 text-[#06B6D4]" />
                            <span>{st.totalActiveMinutes} mins</span>
                          </div>
                          <span className="text-[10px] font-mono text-[#94A3B8] block mt-0.5">
                            {st.totalActiveMinutes >= 60 ? formatTimeDisplay(st.totalActiveMinutes) : 'Active focus'}
                          </span>
                        </td>

                        {/* Side Windows / Focus Strikes */}
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            {st.unfocusedCount >= 10 ? (
                              <span className="inline-flex items-center space-x-1 rounded-full bg-rose-500/20 border border-rose-500/40 px-2.5 py-1 text-[11px] font-mono font-bold text-rose-300">
                                <AlertTriangle className="h-3 w-3" />
                                <span>10/10 SUSPENDED</span>
                              </span>
                            ) : st.unfocusedCount > 0 ? (
                              <span className="inline-flex items-center space-x-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-[11px] font-mono font-bold text-amber-400">
                                <span>{st.unfocusedCount} / 10 Side Windows</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[11px] font-mono text-emerald-400">
                                <span>0/10 Strikes</span>
                              </span>
                            )}

                            {st.unfocusedCount > 0 && (
                              <button
                                onClick={async () => {
                                  await resetStudentUnfocusedCount(st.userId);
                                  setStudents(prev => prev.map(s => s.userId === st.userId ? { ...s, unfocusedCount: 0, suspensionReason: '', status: 'pending_approval' } : s));
                                  setSuccessNotice(`Reset strikes for ${st.studentName} (account moved to Pending Approval)`);
                                  setTimeout(() => setSuccessNotice(null), 4000);
                                }}
                                title="Reset side-window strikes to 0 (moves to Pending Approval)"
                                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-amber-400 hover:bg-slate-700 border border-slate-700 transition-all"
                              >
                                <RotateCcw className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Active Sessions */}
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center space-x-1 rounded-md bg-[#0B0F19] px-2.5 py-1 text-[11px] font-mono font-bold text-[#CBD5E1] border border-[#334155]">
                            <Calendar className="h-3 w-3 text-[#06B6D4]" />
                            <span>{st.activeDaysCount} {st.activeDaysCount === 1 ? 'day' : 'days'}</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setSelectedStudentDetail({
                              userId: st.userId,
                              studentName: st.studentName,
                              studentEmail: st.studentEmail,
                              records: st.records,
                              totalMinutes: st.totalActiveMinutes
                            })}
                            className="inline-flex items-center space-x-1.5 rounded-xl border border-[#334155] bg-[#0B0F19] px-3 py-1.5 text-xs font-semibold text-[#06B6D4] hover:border-[#06B6D4] hover:text-white transition-all shadow-md"
                          >
                            <span>Detailed Log</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: LIVE ATTENTION, FOCUS STATES & PROGRESS COMPLETION */}
      {/* ========================================================================= */}
      {activeTab === 'attention' && (
        <div className="space-y-6">
          {/* Top Actions & Broadcast */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-[#94A3B8] uppercase">
              Live Real-Time Tab Presences & Attention Monitoring
            </span>

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

          {/* Overview Stat Cards with Live Attention Status */}
          <div className="grid gap-4 sm:grid-cols-5">
            <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-5 shadow-lg flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-[#94A3B8] uppercase tracking-wider block mb-1">
                  Total Enrolled
                </span>
                <span className="text-3xl font-extrabold text-white font-mono">{students.length}</span>
                <span className="text-[11px] text-[#94A3B8] block mt-1">Enrolled students</span>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#06B6D4]/20 text-[#06B6D4]">
                <Users className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-2xl border border-[#10B981]/40 bg-[#10B981]/10 p-5 shadow-lg flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-[#10B981] uppercase tracking-wider block mb-1">
                  🟢 Active Focus
                </span>
                <span className="text-3xl font-extrabold text-[#10B981] font-mono">{activeLearningCount}</span>
                <span className="text-[11px] text-[#94A3B8] block mt-1">Focused & interacting</span>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#10B981]/20 text-[#10B981]">
                <Radio className="h-5 w-5 animate-pulse" />
              </div>
            </div>

            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 shadow-lg flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider block mb-1">
                  🟡 Side Window
                </span>
                <span className="text-3xl font-extrabold text-amber-400 font-mono">{tabUnfocusedCount}</span>
                <span className="text-[11px] text-[#94A3B8] block mt-1">Clicked outside window</span>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                <EyeOff className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-2xl border border-orange-500/40 bg-orange-500/10 p-5 shadow-lg flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-orange-400 uppercase tracking-wider block mb-1">
                  🟠 Idle (&gt;1 min)
                </span>
                <span className="text-3xl font-extrabold text-orange-400 font-mono">{idleCount}</span>
                <span className="text-[11px] text-[#94A3B8] block mt-1">No mouse / key input</span>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400">
                <Clock className="h-5 w-5" />
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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-700/30 text-slate-400">
                <Clock className="h-5 w-5" />
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
          {loading && filteredStudents.length === 0 ? (
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
                    <th className="px-6 py-4">Side Windows / Strikes</th>
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
                    const strikes = presence?.unfocusedCount ?? st.unfocusedCount ?? 0;
                    const isSuspended = strikes >= 10;

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
                                <span>Actively Interacting</span>
                              </span>
                              {presence?.currentSubtopicTitle && (
                                <span className="text-[10px] text-[#94A3B8] line-clamp-1 mt-0.5 font-mono">
                                  Reading: {presence.currentSubtopicTitle}
                                </span>
                              )}
                            </div>
                          ) : presenceState === 'idle' ? (
                            <div className="flex flex-col">
                              <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-orange-400">
                                <span className="h-2.5 w-2.5 rounded-full bg-orange-400"></span>
                                <span>Idle (No Input &gt;1m)</span>
                              </span>
                              <span className="text-[10px] text-[#94A3B8] mt-0.5 font-mono">
                                Window open but no input
                              </span>
                            </div>
                          ) : presenceState === 'tab_unfocused' ? (
                            <div className="flex flex-col">
                              <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-amber-400">
                                <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                                <span>Side Window / Unfocused</span>
                              </span>
                              <span className="text-[10px] text-amber-300/90 mt-0.5 font-mono">
                                {presence?.unfocusedDurationSeconds && presence.unfocusedDurationSeconds > 0
                                  ? `${Math.floor(presence.unfocusedDurationSeconds / 60)}m ${presence.unfocusedDurationSeconds % 60}s away (3m limit)`
                                  : "Clicked outside student window"}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 font-mono">
                              <span className="h-2 w-2 rounded-full bg-slate-600"></span>
                              <span>Offline</span>
                            </span>
                          )}
                        </td>

                        {/* SIDE WINDOWS / FOCUS STRIKES */}
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            {isSuspended ? (
                              <span className="inline-flex items-center space-x-1 rounded-full bg-rose-500/20 border border-rose-500/40 px-2.5 py-1 text-[11px] font-mono font-bold text-rose-300">
                                <AlertTriangle className="h-3 w-3" />
                                <span>10/10 SUSPENDED</span>
                              </span>
                            ) : strikes > 0 ? (
                              <span className="inline-flex items-center space-x-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-[11px] font-mono font-bold text-amber-400">
                                <span>{strikes} / 10 Side Windows</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[11px] font-mono text-emerald-400">
                                <span>0/10 Strikes</span>
                              </span>
                            )}

                            {strikes > 0 && (
                              <button
                                onClick={async () => {
                                  await resetStudentUnfocusedCount(st.userId);
                                  setStudents(prev => prev.map(s => s.userId === st.userId ? { ...s, unfocusedCount: 0, suspensionReason: '', status: 'pending_approval' } : s));
                                  setSuccessNotice(`Reset strikes for ${st.fullName} (account moved to Pending Approval)`);
                                  setTimeout(() => setSuccessNotice(null), 4000);
                                }}
                                title="Reset focus strikes to 0 (moves to Pending Approval)"
                                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-amber-400 hover:bg-slate-700 border border-slate-700 transition-all"
                              >
                                <RotateCcw className="h-3 w-3" />
                              </button>
                            )}
                          </div>
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
                                st.totalSubtopicsCount === 0
                                  ? 'bg-slate-700'
                                  : st.progressPercent < 30
                                  ? 'bg-amber-500'
                                  : st.progressPercent >= 70
                                  ? 'bg-[#10B981]'
                                  : 'bg-[#06B6D4]'
                              }`}
                              style={{ width: `${st.totalSubtopicsCount === 0 ? 0 : Math.max(5, st.progressPercent)}%` }}
                            />
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          {st.totalSubtopicsCount === 0 ? (
                            <span className="inline-flex items-center space-x-1 rounded-full bg-slate-700/30 px-2.5 py-1 text-[11px] font-bold text-slate-400 border border-slate-600/30">
                              <Clock className="h-3 w-3" />
                              <span>No Published Syllabi</span>
                            </span>
                          ) : st.progressPercent < 30 ? (
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
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => {
                                setReportStudentId(st.userId);
                                setActiveTab('time_reports');
                              }}
                              title="View time spent report for this student"
                              className="inline-flex items-center space-x-1 rounded-xl border border-[#334155] bg-[#0B0F19] px-2.5 py-1.5 text-xs font-semibold text-[#10B981] hover:border-[#10B981] transition-all"
                            >
                              <Clock className="h-3.5 w-3.5" />
                              <span>Time</span>
                            </button>

                            <button
                              onClick={() => {
                                setMessagingTarget(st);
                                setMessageText(`Hi ${st.fullName}, here is a quick note regarding your syllabus progress...`);
                              }}
                              className="inline-flex items-center space-x-1.5 rounded-xl border border-[#334155] bg-[#0B0F19] px-3 py-1.5 text-xs font-semibold text-[#06B6D4] hover:border-[#06B6D4] hover:text-white transition-all shadow-md"
                            >
                              <Send className="h-3.5 w-3.5" />
                              <span>Message</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETAILED STUDENT TIME LOG MODAL */}
      {/* ========================================================================= */}
      {selectedStudentDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-[#334155] bg-[#1E293B] p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#334155] pb-3 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#06B6D4]/20 text-[#06B6D4]">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">
                    {selectedStudentDetail.studentName} — Active Time Log
                  </h4>
                  <p className="text-xs text-[#94A3B8] font-mono">
                    Total Active Time: <span className="text-[#10B981] font-bold">{selectedStudentDetail.totalMinutes} mins</span> ({formatTimeDisplay(selectedStudentDetail.totalMinutes)})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudentDetail(null)}
                className="text-[#94A3B8] hover:text-white rounded-lg p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pr-1 space-y-3">
              {selectedStudentDetail.records.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#94A3B8]">
                  No active learning records found for this student in the current date/syllabus filter.
                </div>
              ) : (
                <div className="rounded-xl border border-[#334155] bg-[#0B0F19] overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#334155] bg-[#1E293B] font-mono text-[#94A3B8] uppercase text-[11px]">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Syllabus & Topic</th>
                        <th className="px-4 py-3">Subtopic</th>
                        <th className="px-4 py-3 text-right">Active Time (Minutes)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#334155]">
                      {selectedStudentDetail.records.map((r) => (
                        <tr key={r.id} className="hover:bg-[#1E293B]/30">
                          <td className="px-4 py-3 font-mono text-[#CBD5E1] whitespace-nowrap">
                            {r.date}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-white text-xs">{r.topicTitle}</div>
                            <div className="text-[10px] text-[#94A3B8] line-clamp-1">{r.syllabusTitle}</div>
                          </td>
                          <td className="px-4 py-3 text-[11px] text-[#CBD5E1]">
                            {r.subtopicTitle || 'Overview'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-[#10B981]">
                            {r.activeMinutes} mins
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#334155] flex items-center justify-between shrink-0">
              <span className="text-[11px] text-[#94A3B8] font-mono">
                Away & idle &gt;1m time is strictly omitted from recorded minutes
              </span>
              <button
                onClick={() => setSelectedStudentDetail(null)}
                className="rounded-xl bg-[#334155] hover:bg-slate-600 px-4 py-2 text-xs font-bold text-white transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DIRECT MESSAGING MODAL */}
      {/* ========================================================================= */}
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
                placeholder="Write message to student (e.g. Hi Josef Marie, great work on LO1!)..."
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
