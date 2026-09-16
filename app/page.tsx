"use client";

import React, { useEffect, useState } from "react";
import { Syllabus } from "@/types/syllabus";
import { UserProfile, StudentLevel } from "@/types/auth";
import { getAllSyllabi, getAllTrades, getSubtopicProgress, getSubtopicProgressAsync, subscribeToUserProfile } from "@/lib/db";
import { getStoredSession, saveStoredSession, updateUserEmail, logoutStudent, getAdminSession } from "@/lib/auth";
import { 
  BookOpen, 
  Sparkles, 
  Search, 
  ArrowRight, 
  ShieldCheck, 
  Building2, 
  User, 
  Terminal,
  Plus,
  LogIn,
  UserPlus,
  LogOut,
  GraduationCap,
  Layers,
  Filter,
  Mail,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Eye,
  Lock
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NotificationAlert from "@/components/common/NotificationAlert";
import PresenceTracker from "@/components/common/PresenceTracker";
import DisciplinaryLockdown from "@/components/common/DisciplinaryLockdown";

export default function CatalogPage() {
  const router = useRouter();
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [tradesMap, setTradesMap] = useState<Record<string, string>>({});
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [navigatingSyllabusId, setNavigatingSyllabusId] = useState<string | null>(null);

  // Auth requirement modal for unauthenticated viewers
  const [authPromptSyl, setAuthPromptSyl] = useState<Syllabus | null>(null);

  // Email prompt state
  const [newEmail, setNewEmail] = useState("");
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [emailSuccessMsg, setEmailSuccessMsg] = useState<string | null>(null);
  const [emailErrMsg, setEmailErrMsg] = useState<string | null>(null);

  // Level Filter state for logged in students ("all" or specific level)
  const [activeLevelFilter, setActiveLevelFilter] = useState<string>("all");
  const [studentProgressMap, setStudentProgressMap] = useState<Record<string, boolean>>({});
  const [adminUser, setAdminUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    async function loadData() {
      const user = getStoredSession();
      setCurrentUser(user);

      const admin = getAdminSession();
      if (admin && admin.role === "teacher") {
        setAdminUser(admin);
      }

      if (user && user.role === "student" && user.level) {
        setActiveLevelFilter(user.level);
        const map = await getSubtopicProgressAsync(user.uid);
        setStudentProgressMap(map);
      }

      const data = await getAllSyllabi();
      setSyllabi(data);

      const trades = await getAllTrades();
      const tMap: Record<string, string> = {};
      trades.forEach((t) => (tMap[t.id] = t.name));
      setTradesMap(tMap);

      setLoading(false);
    }
    loadData();

    const handlePresenceUpdate = () => {
      const u = getStoredSession();
      if (u) setCurrentUser(u);
    };
    window.addEventListener("syllabus_presence_updated", handlePresenceUpdate);
    window.addEventListener("focus", handlePresenceUpdate);

    let unsubProfile: (() => void) | null = null;
    const session = getStoredSession();
    if (session?.uid) {
      unsubProfile = subscribeToUserProfile(session.uid, (freshUser) => {
        if (freshUser) setCurrentUser(freshUser);
      });
    }

    return () => {
      window.removeEventListener("syllabus_presence_updated", handlePresenceUpdate);
      window.removeEventListener("focus", handlePresenceUpdate);
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const handleLogout = async () => {
    if (currentUser) {
      await logoutStudent(currentUser, false);
    }
    setCurrentUser(null);
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newEmail) return;

    setUpdatingEmail(true);
    setEmailErrMsg(null);
    setEmailSuccessMsg(null);

    const res = await updateUserEmail(currentUser.uid, newEmail);
    if (res.success) {
      setEmailSuccessMsg("Email successfully saved to your profile!");
      setCurrentUser({ ...currentUser, email: newEmail.trim() });
    } else {
      setEmailErrMsg(res.message || "Failed to update email.");
    }
    setUpdatingEmail(false);
  };

  // Permitted levels based on student level hierarchy
  const resolveSyllabusLevel = (s: Syllabus): StudentLevel => {
    if (s.level) return s.level as StudentLevel;
    const str = `${s.courseCode} ${s.title} ${s.description}`.toLowerCase();
    if (/level\s*5|cert(ificate)?\s*5|cert(ificate)?\s*v|\b\w*5\d{2}\w*\b/i.test(str)) return "Level 5";
    if (/level\s*3|cert(ificate)?\s*3|cert(ificate)?\s*iii|\b\w*3\d{2}\w*\b/i.test(str)) return "Level 3";
    return "Level 4";
  };

  const getPermittedLevels = (): StudentLevel[] => {
    if (!currentUser || currentUser.role !== "student") return ["Level 3", "Level 4", "Level 5"];
    if (currentUser.level === "Level 3") return ["Level 3"];
    if (currentUser.level === "Level 4") return ["Level 4", "Level 3"];
    if (currentUser.level === "Level 5") return ["Level 5", "Level 4", "Level 3"];
    return ["Level 3", "Level 4", "Level 5"];
  };

  // Syllabi filtering logic: ONLY show published syllabi to catalog viewers (Drafts hidden)
  let filtered = syllabi.filter((s) => {
    // 1. MUST BE PUBLISHED (or legacy without status) -> DRAFT IS STUCTLY HIDDEN FROM CATALOG
    const isPublished = !s.status || s.status === "published";
    if (!isPublished) return false;

    // 2. Search filter matching
    const matchesSearch = 
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.courseCode.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase());

    return matchesSearch;
  });

  if (currentUser && currentUser.role === "student") {
    const permittedLevels = getPermittedLevels();
    filtered = filtered.filter((s) => {
      const sLevel = resolveSyllabusLevel(s);

      // Must be within student's permitted level hierarchy
      const isLevelPermitted = permittedLevels.includes(sLevel);
      
      // Match active level filter button selection ("all" or specific level tab)
      const matchesActiveFilter = activeLevelFilter === "all" || sLevel === activeLevelFilter;

      return isLevelPermitted && matchesActiveFilter;
    });
  }

  // Compute level-specific progress stats for logged-in student
  let levelTotalSubtopics = 0;
  let levelCompletedSubtopics = 0;

  if (currentUser && currentUser.role === "student") {
    const progressMap = Object.keys(studentProgressMap).length > 0 ? studentProgressMap : getSubtopicProgress(currentUser.uid);
    const studentLevelSyllabi = syllabi.filter((syl) => 
      (syl.status === "published" || !syl.status) &&
      resolveSyllabusLevel(syl) === currentUser.level &&
      (!currentUser.tradeId || currentUser.tradeId === "all" || syl.tradeId === currentUser.tradeId)
    );

    studentLevelSyllabi.forEach((syl) => {
      syl.learningOutcomes?.forEach((lo) => {
        lo.indicativeContents?.forEach((ic) => {
          ic.topics?.forEach((top) => {
            top.subtopics?.forEach((sub) => {
              levelTotalSubtopics++;
              if (progressMap[sub.id]) levelCompletedSubtopics++;
            });
          });
        });
      });
    });
  }

  const levelProgressPercent = levelTotalSubtopics > 0 
    ? Math.round((levelCompletedSubtopics / levelTotalSubtopics) * 100) 
    : 0;

  if (currentUser && currentUser.status === "rejected" && currentUser.role === "student") {
    return (
      <DisciplinaryLockdown
        studentName={currentUser.fullName}
        studentUsername={currentUser.username}
        reason={currentUser.suspensionReason}
        violationsCount={currentUser.unfocusedCount || 10}
      />
    );
  }

  if (currentUser && currentUser.status === "pending_approval" && currentUser.role === "student") {
    const wasReset = (currentUser.unfocusedCount || 0) === 0;
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0F19] p-6 text-[#CBD5E1]">
        <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-[#1E293B] p-8 text-center shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <div>
            <div className="inline-flex items-center space-x-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-mono font-bold text-amber-400 border border-amber-500/30 mb-3">
              <span>{wasReset ? "Strikes Reset • Pending Approval" : "Pending Verification"}</span>
            </div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              {wasReset ? "Account Reset By Instructor" : "Registration Under Review"}
            </h2>
            <p className="mt-2 text-xs text-[#CBD5E1] leading-relaxed">
              {wasReset 
                ? "Your side-window focus strikes have been reset to 0/10 by your teacher. Your account is currently awaiting teacher approval before your study session resumes."
                : "Your student account registration is awaiting faculty verification. Once approved, you will have immediate access to your accredited syllabus."}
            </p>
          </div>

          <div className="flex items-center justify-center space-x-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 py-2 px-4 rounded-xl mx-auto">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-mono text-[11px]">Auto-resumes when instructor approves...</span>
          </div>

          <div className="pt-2">
            <button
              onClick={handleLogout}
              className="inline-flex w-full items-center justify-center space-x-2 rounded-xl bg-slate-800 py-3 text-xs font-bold text-[#CBD5E1] hover:bg-slate-700 transition-all border border-slate-700"
            >
              <LogOut className="h-4 w-4 text-rose-400" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#CBD5E1]">
      {currentUser && (
        <>
          <NotificationAlert userId={currentUser.uid} />
          <PresenceTracker userId={currentUser.uid} fullName={currentUser.fullName} />
        </>
      )}
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-[#334155] bg-[#0B0F19]/90 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-[#06B6D4] to-[#3B82F6] text-white shadow-lg group-hover:scale-105 transition-transform">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-extrabold text-white tracking-tight">Digital Syllabus Platform</span>
              <span className="block text-[10px] font-mono text-[#06B6D4]">Student & Teacher Portal</span>
            </div>
          </Link>

          <div className="flex items-center space-x-3">
            {currentUser ? (
              <div className="flex items-center space-x-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-bold text-white">{currentUser.fullName}</span>
                  <span className="text-[10px] font-mono text-[#06B6D4]">
                    {currentUser.role === 'teacher' ? 'Teacher Admin' : `${currentUser.level} • ${tradesMap[currentUser.tradeId] || 'General'}`}
                  </span>
                </div>

                <button
                  onClick={handleLogout}
                  className="inline-flex items-center space-x-1.5 rounded-xl border border-[#334155] bg-[#1E293B] px-3.5 py-2 text-xs font-semibold text-[#CBD5E1] hover:text-white hover:border-rose-500/50 transition-all"
                >
                  <LogOut className="h-3.5 w-3.5 text-rose-400" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center space-x-1.5 rounded-xl border border-[#334155] bg-[#1E293B] px-3.5 py-2 text-xs font-semibold text-[#CBD5E1] hover:text-white transition-all"
                >
                  <LogIn className="h-3.5 w-3.5 text-[#06B6D4]" />
                  <span>Student Login</span>
                </Link>

                <Link
                  href="/auth/register"
                  className="inline-flex items-center space-x-1.5 rounded-xl bg-[#06B6D4] px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-lg"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Register</span>
                </Link>
              </div>
            )}

            {(!currentUser || adminUser) && (
              <Link
                href={adminUser ? "/admin" : "/admin/login"}
                className="inline-flex items-center space-x-1.5 rounded-xl border border-[#334155] bg-[#1E293B] px-3 py-2 text-xs font-semibold text-white hover:border-[#06B6D4] transition-all"
              >
                <ShieldCheck className="h-4 w-4 text-[#06B6D4]" />
                <span className="hidden sm:inline">Teacher Portal</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* OPTIONAL EMAIL SUGGESTION BANNER */}
      {currentUser && currentUser.role === "student" && !currentUser.email && (
        <div className="bg-gradient-to-r from-[#06B6D4]/20 via-[#1E293B] to-[#3B82F6]/20 border-b border-[#06B6D4]/30 px-6 py-3">
          <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-2 text-xs text-white">
              <Mail className="h-4 w-4 text-[#06B6D4] shrink-0" />
              <span>
                <strong>Profile Suggestion:</strong> You registered without an email address. Add your email now to receive course updates and teacher notifications!
              </span>
            </div>

            {emailSuccessMsg ? (
              <span className="text-xs font-mono text-[#10B981] font-bold flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> {emailSuccessMsg}
              </span>
            ) : (
              <form onSubmit={handleSaveEmail} className="flex items-center space-x-2 shrink-0">
                {emailErrMsg && <span className="text-[11px] text-rose-400">{emailErrMsg}</span>}
                <input
                  type="email"
                  required
                  placeholder="josef.marie@school.edu"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="rounded-xl border border-[#334155] bg-[#0B0F19] px-3 py-1.5 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={updatingEmail}
                  className="rounded-xl bg-[#06B6D4] px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-md disabled:opacity-50"
                >
                  {updatingEmail ? "Saving..." : "Add Email"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="border-b border-[#334155] bg-gradient-to-b from-[#1E293B]/40 to-transparent px-6 py-12">
        <div className="mx-auto max-w-7xl text-center sm:text-left">
          <div className="inline-flex items-center space-x-2 rounded-full border border-[#06B6D4]/30 bg-[#06B6D4]/10 px-3.5 py-1 text-xs font-mono text-[#06B6D4] mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Interactive Competency-Based Education Catalog</span>
          </div>

          <h2 className="text-3xl font-extrabold text-white sm:text-4xl tracking-tight leading-tight">
            Explore Accredited Syllabi & Learning Modules
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[#94A3B8] leading-relaxed">
            Access structured syllabus frameworks, learning outcomes, topic breakdowns, code execution playgrounds, and AI concept explanations.
          </p>

          {/* Search Bar */}
          <div className="mt-6 relative max-w-xl">
            <Search className="absolute left-4 top-3.5 h-4 w-4 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search course title, code (e.g. CS101), or topic..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-[#334155] bg-[#1E293B] py-3 pl-11 pr-4 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none shadow-xl"
            />
          </div>

          {/* Hello & Study Focus Instructions Banner */}
          <div className="mt-8 rounded-2xl border border-[#334155] bg-[#1E293B]/90 backdrop-blur-md p-5 sm:p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 h-40 w-40 bg-gradient-to-bl from-[#06B6D4]/15 to-transparent rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#334155]/80 pb-4">
              <div className="flex items-center space-x-3.5 text-left">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#06B6D4]/20 to-[#3B82F6]/20 border border-[#06B6D4]/40 text-[#06B6D4] shadow-inner shrink-0">
                  <Eye className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-white flex items-center gap-2 tracking-tight">
                    <span>Hello, {currentUser ? currentUser.fullName : 'Student'}!</span>
                    <span className="text-xl">👋</span>
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Essential Classroom Study Rules & Side-Window Focus Policy
                  </p>
                </div>
              </div>

              {/* Focus Standing Badge */}
              {currentUser && (
                <div className="flex items-center gap-2 shrink-0">
                  {(currentUser.unfocusedCount || 0) >= 10 ? (
                    <span className="inline-flex items-center space-x-1.5 rounded-full bg-rose-500/20 border border-rose-500/40 px-3.5 py-1 text-xs font-mono font-bold text-rose-300">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>Account Suspended ({currentUser.unfocusedCount || 10}/10 Violations)</span>
                    </span>
                  ) : (currentUser.unfocusedCount || 0) > 0 ? (
                    <span className="inline-flex items-center space-x-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 px-3.5 py-1 text-xs font-mono font-bold text-amber-300">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>Focus Warning: {currentUser.unfocusedCount} / 10 Side Windows</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3.5 py-1 text-xs font-mono font-bold text-emerald-400">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>Focus Standing: 0 / 10 Strikes (Good Standing)</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Instruction Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-4 text-xs text-left">
              <div className="rounded-xl bg-[#0B0F19]/80 border border-[#334155]/60 p-4 space-y-1.5 hover:border-[#06B6D4]/40 transition-colors">
                <div className="font-bold text-[#06B6D4] flex items-center space-x-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#06B6D4]/20 text-[11px] font-mono">1</span>
                  <span>Keep Active Focus</span>
                </div>
                <p className="text-[#94A3B8] leading-relaxed text-[11px]">
                  Keep your syllabus window in active focus while studying. Your reading time pauses automatically whenever you leave or stay idle.
                </p>
              </div>

              <div className="rounded-xl bg-[#0B0F19]/80 border border-amber-500/30 p-4 space-y-1.5 hover:border-amber-500/50 transition-colors">
                <div className="font-bold text-amber-400 flex items-center space-x-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-mono">2</span>
                  <span>Side Windows Are Monitored</span>
                </div>
                <p className="text-[#94A3B8] leading-relaxed text-[11px]">
                  Opening side windows, switching tabs, or clicking outside the syllabus during class is recorded in real time as an inattention strike.
                </p>
              </div>

              <div className="rounded-xl bg-[#0B0F19]/80 border border-rose-500/40 bg-rose-950/10 p-4 space-y-1.5 hover:border-rose-500/60 transition-colors">
                <div className="font-bold text-rose-400 flex items-center space-x-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/20 text-[11px] font-mono">3</span>
                  <span>10 Strikes = Account Rejection</span>
                </div>
                <p className="text-[#CBD5E1] leading-relaxed text-[11px]">
                  If you accumulate <strong>10 side-window violations</strong>, your account is immediately <strong>rejected & suspended</strong>. You will be locked out and will require your teacher to approve your account again.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Student Level Tabs (if logged in as student) */}
        {currentUser && currentUser.role === "student" && (
          <div className="mb-8 rounded-2xl border border-[#334155] bg-[#1E293B] p-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#334155] pb-3 gap-3">
              <div className="flex items-center space-x-2">
                <GraduationCap className="h-5 w-5 text-[#06B6D4]" />
                <span className="text-sm font-bold text-white">
                  Syllabi for {tradesMap[currentUser.tradeId] || "Your Academic Trade"}
                </span>
              </div>

              <div className="flex items-center space-x-2 text-xs font-mono text-[#94A3B8]">
                <span>Approved Level: <strong className="text-[#10B981]">{currentUser.level}</strong></span>
              </div>
            </div>

            {/* Level-Specific Subtopic Progress Bar */}
            <div className="mt-4 p-3 rounded-xl border border-[#334155] bg-[#0B0F19]">
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className="text-[#CBD5E1]">
                  <strong className="text-[#06B6D4]">{currentUser.level}</strong> Required Academic Progress
                </span>
                <span className="text-[#10B981] font-bold">
                  {levelCompletedSubtopics} / {levelTotalSubtopics} Subtopics ({levelProgressPercent}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#1E293B]">
                <div 
                  className="h-full bg-gradient-to-r from-[#06B6D4] to-[#10B981] transition-all duration-300"
                  style={{ width: `${levelProgressPercent}%` }}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono text-[#94A3B8] mr-2 flex items-center gap-1">
                <Filter className="h-3.5 w-3.5 text-[#06B6D4]" /> Select Level View:
              </span>

              <button
                onClick={() => setActiveLevelFilter("all")}
                className={`rounded-xl px-4 py-2 text-xs font-mono font-bold transition-all ${
                  activeLevelFilter === "all"
                    ? 'bg-[#06B6D4] text-slate-950 shadow-lg'
                    : 'bg-[#0B0F19] text-[#94A3B8] hover:text-white border border-[#334155]'
                }`}
              >
                All Accessible Levels
              </button>

              {getPermittedLevels().map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setActiveLevelFilter(lvl)}
                  className={`rounded-xl px-4 py-2 text-xs font-mono font-bold transition-all ${
                    activeLevelFilter === lvl
                      ? 'bg-[#06B6D4] text-slate-950 shadow-lg'
                      : 'bg-[#0B0F19] text-[#94A3B8] hover:text-white border border-[#334155]'
                  }`}
                >
                  {lvl} {lvl === currentUser.level ? '(Your Level)' : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Syllabi Grid */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white">Available Course Syllabi</h3>
          <span className="text-xs font-mono text-[#94A3B8]">Showing {filtered.length} courses</span>
        </div>

        {loading ? (
          <div className="py-20 text-center text-[#94A3B8]">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#06B6D4] border-t-transparent mb-3" />
            Loading Course Syllabi...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-[#94A3B8] bg-[#1E293B]/40 rounded-2xl border border-[#334155] p-6 space-y-3">
            <BookOpen className="mx-auto h-10 w-10 text-[#64748B]" />
            <h4 className="text-base font-bold text-white">No course syllabi available</h4>
            <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
              {currentUser?.role === "student"
                ? "No published syllabi found matching your assigned level or trade. Please check back soon as your instructors publish course curriculum."
                : "No course syllabi have been published yet. Instructors can sign in to the Teacher Portal to create, organize, and publish accredited courses."}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((syl) => {
              const isNavigatingThis = navigatingSyllabusId === syl.id;
              const isLocked = Boolean(navigatingSyllabusId);

              return (
                <div
                  key={syl.id}
                  onClick={() => {
                    if (isLocked) return;
                    if (!currentUser) {
                      setAuthPromptSyl(syl);
                    } else {
                      setNavigatingSyllabusId(syl.id);
                      // Fallback timer so UI never gets permanently stuck
                      setTimeout(() => {
                        setNavigatingSyllabusId(null);
                      }, 8000);
                      router.push(`/syllabus/view?id=${syl.id}`);
                    }
                  }}
                  onMouseEnter={() => {
                    if (currentUser) {
                      try {
                        router.prefetch(`/syllabus/view?id=${syl.id}`);
                      } catch (e) {}
                    }
                  }}
                  className={`group relative flex flex-col justify-between rounded-2xl border transition-all overflow-hidden p-6 shadow-xl ${
                    isNavigatingThis
                      ? 'border-[#06B6D4] bg-[#162032] shadow-[#06B6D4]/20 ring-2 ring-[#06B6D4]/50 cursor-wait scale-[1.01]'
                      : isLocked
                      ? 'opacity-60 border-[#334155] bg-[#1E293B] cursor-not-allowed'
                      : 'border-[#334155] bg-[#1E293B] hover:border-[#06B6D4] hover:shadow-[#06B6D4]/10 cursor-pointer'
                  }`}
                >
                  {isNavigatingThis && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#06B6D4] to-transparent animate-pulse" />
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="rounded-lg bg-[#0B0F19] px-2.5 py-1 font-mono text-xs font-bold text-[#06B6D4] border border-[#334155]">
                        {syl.courseCode}
                      </span>
                      {syl.level && (
                        <span className="rounded bg-[#10B981]/15 px-2.5 py-0.5 font-mono text-[10px] text-[#10B981] font-bold border border-[#10B981]/30">
                          {syl.level}
                        </span>
                      )}
                    </div>

                    <h4 className="text-base font-bold text-white group-hover:text-[#06B6D4] transition-colors leading-snug">
                      {syl.title}
                    </h4>
                    <p className="mt-2 text-xs text-[#94A3B8] line-clamp-2 leading-relaxed">
                      {syl.description}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-[#334155] pt-4 text-xs font-semibold text-[#06B6D4]">
                    {isNavigatingThis ? (
                      <div className="flex items-center space-x-2 text-[#06B6D4] font-bold">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#06B6D4] border-t-transparent" />
                        <span>Opening Course...</span>
                      </div>
                    ) : (
                      <>
                        <span>Explore Syllabus</span>
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Global Floating Pill while opening a course */}
        {navigatingSyllabusId && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center space-x-3 rounded-full border border-[#06B6D4]/60 bg-[#0F172A]/95 px-5 py-2.5 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#06B6D4] border-t-transparent" />
            <span className="text-xs font-semibold text-white">
              Loading course curriculum... Please wait
            </span>
          </div>
        )}
      </main>

      {/* AUTHENTICATION REQUIRED MODAL FOR GUESTS */}
      {authPromptSyl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-[#334155] bg-[#1E293B] p-7 text-center shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#06B6D4]/15 text-[#06B6D4] border border-[#06B6D4]/30">
              <Lock className="h-8 w-8" />
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-white tracking-tight">
                Student Authentication Required
              </h3>
              <p className="mt-2 text-xs text-[#94A3B8] leading-relaxed">
                To view syllabus modules, learning outcomes, and topic breakdown for <strong className="text-white">{authPromptSyl.title}</strong> ({authPromptSyl.courseCode}), please log in or register your student account.
              </p>
            </div>

            <div className="grid gap-3 pt-2">
              <Link
                href="/auth/login"
                className="inline-flex w-full items-center justify-center space-x-2 rounded-xl bg-[#06B6D4] py-3 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-lg"
              >
                <LogIn className="h-4 w-4" />
                <span>Log In to Access Content</span>
              </Link>

              <Link
                href="/auth/register"
                className="inline-flex w-full items-center justify-center space-x-2 rounded-xl border border-[#334155] bg-[#0B0F19] py-3 text-xs font-semibold text-white hover:border-[#06B6D4] transition-all"
              >
                <UserPlus className="h-4 w-4 text-[#06B6D4]" />
                <span>Register Student Account</span>
              </Link>
            </div>

            <button
              onClick={() => setAuthPromptSyl(null)}
              className="text-xs font-mono text-[#94A3B8] hover:text-white pt-2 transition-colors"
            >
              Close Window
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
