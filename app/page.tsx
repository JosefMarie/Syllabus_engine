"use client";

import React, { useEffect, useState } from "react";
import { Syllabus } from "@/types/syllabus";
import { UserProfile, StudentLevel } from "@/types/auth";
import { getAllSyllabi, getAllTrades, getSubtopicProgress, getSubtopicProgressAsync, subscribeToUserProfile, getLocalSyllabi, getLocalTrades } from "@/lib/db";
import { getStoredSession, saveStoredSession, updateUserEmail, logoutStudent, getAdminSession } from "@/lib/auth";
import SiteFooter from "@/components/common/SiteFooter";
import LiveDateTimeCalendarPill from "@/components/common/LiveDateTimeCalendarPill";
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
  Lock,
  Award,
  Users,
  FileQuestion,
  MessageSquare,
  Code2,
  Trophy
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NotificationAlert from "@/components/common/NotificationAlert";
import NotificationBell from "@/components/common/NotificationBell";
import PresenceTracker from "@/components/common/PresenceTracker";
import DisciplinaryLockdown from "@/components/common/DisciplinaryLockdown";
import StudentAssignmentsView from "@/components/student/StudentAssignmentsView";
import StudentGroupsView from "@/components/student/StudentGroupsView";
import StudentExamsView from "@/components/student/StudentExamsView";
import StudentAcademicStanding from "@/components/student/StudentAcademicStanding";

export default function CatalogPage() {
  const router = useRouter();
  const [syllabi, setSyllabi] = useState<Syllabus[]>(() => getLocalSyllabi());
  const [tradesMap, setTradesMap] = useState<Record<string, string>>(() => {
    const localTrades = getLocalTrades();
    const map: Record<string, string> = {};
    localTrades.forEach(t => { map[t.id] = t.name; });
    return map;
  });
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getStoredSession());
  const [studentPortalTab, setStudentPortalTab] = useState<"courses" | "assignments" | "groups" | "exams">("courses");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(() => getLocalSyllabi().length === 0);
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
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "courses" || tab === "assignments" || tab === "groups" || tab === "exams") {
        setStudentPortalTab(tab);
      }
    }
  }, []);

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
      if (!u) return;
      setCurrentUser(prev => {
        if (!prev) return u;
        if (
          prev.uid === u.uid &&
          prev.role === u.role &&
          prev.status === u.status &&
          prev.level === u.level &&
          prev.tradeId === u.tradeId &&
          prev.unfocusedCount === u.unfocusedCount &&
          prev.fullName === u.fullName &&
          prev.email === u.email
        ) {
          return prev;
        }
        return u;
      });
    };
    window.addEventListener("syllabus_presence_updated", handlePresenceUpdate);
    window.addEventListener("focus", handlePresenceUpdate);

    let unsubProfile: (() => void) | null = null;
    const session = getStoredSession();
    if (session?.uid) {
      unsubProfile = subscribeToUserProfile(session.uid, (freshUser) => {
        if (freshUser) {
          setCurrentUser(prev => {
            if (!prev) return freshUser;
            if (
              prev.uid === freshUser.uid &&
              prev.role === freshUser.role &&
              prev.status === freshUser.status &&
              prev.level === freshUser.level &&
              prev.tradeId === freshUser.tradeId &&
              prev.unfocusedCount === freshUser.unfocusedCount &&
              prev.fullName === freshUser.fullName &&
              prev.email === freshUser.email &&
              prev.suspensionReason === freshUser.suspensionReason
            ) {
              return prev;
            }
            return freshUser;
          });
        }
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
      <div className="flex min-h-screen items-center justify-center bg-transparent p-6 text-[#EAEAE6]">
        <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-[#1C1C1F]/85 backdrop-blur-xl p-8 text-center shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
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
            <p className="mt-2 text-xs text-[#EAEAE6] leading-relaxed">
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
              className="inline-flex w-full items-center justify-center space-x-2 rounded-full bg-rose-500/15 py-3 text-xs font-bold text-rose-300 hover:bg-rose-500 hover:text-white transition-all border border-rose-500/40"
            >
              <LogOut className="h-4 w-4" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-[#EAEAE6]">
      {currentUser && (
        <>
          <NotificationAlert userId={currentUser.uid} />
          {currentUser.role === "student" && (
            <PresenceTracker 
              userId={currentUser.uid} 
              fullName={currentUser.fullName}
              email={currentUser.email}
              username={currentUser.username}
              tradeId={currentUser.tradeId}
              level={currentUser.level}
              syllabusTitle="Student Portal"
              subtopicTitle={
                studentPortalTab === "assignments"
                  ? "My Class Assignments"
                  : studentPortalTab === "groups"
                  ? "My Study Groups"
                  : studentPortalTab === "exams"
                  ? "Exams & Quizzes"
                  : "Course Syllabi Catalog"
              }
            />
          )}
        </>
      )}
      {/* OUTER MONOCHROME BENTO SHELL (Design.jpeg) */}
      <div className="min-h-screen bg-[#141416] text-[#EAEAE6] px-3 sm:px-6 py-4 sm:py-6">
        <div className="mx-auto max-w-7xl space-y-5">

          {/* UPPER DARK-FRAMED BENTO CONTAINER */}
          <div className="rounded-[28px] bg-[#1C1C1F] border border-[#2D2D32] p-3 sm:p-4 shadow-2xl space-y-3 sm:space-y-4">

            {/* TOP NOTCHED HEADER BAR */}
            <header className="flex flex-wrap items-center justify-between gap-3 px-2 py-1">
              <Link
                href="/"
                className="inline-flex items-center space-x-2.5 rounded-full bg-[#EAEAE6] text-[#141416] px-4 py-2 shadow-sm hover:bg-white transition-colors"
              >
                <BookOpen className="h-4 w-4 text-[#141416]" />
                <span className="text-xs sm:text-sm font-extrabold tracking-tight">
                  Syllabus Engine
                </span>
              </Link>

              {currentUser ? (
                <nav className="flex items-center flex-wrap gap-1.5 sm:gap-2">
                  {[
                    { id: "courses", label: "Course Syllabi", icon: BookOpen },
                    { id: "assignments", label: "Assignments", icon: Award },
                    { id: "groups", label: "Study Groups", icon: Users },
                    { id: "exams", label: "Exams & Quizzes", icon: FileQuestion },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const active = studentPortalTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setStudentPortalTab(tab.id as any)}
                        className={`inline-flex items-center space-x-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                          active
                            ? "bg-[#EAEAE6] text-[#141416] shadow-sm"
                            : "text-[#A1A1AA] hover:text-white hover:bg-[#27272B]"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </nav>
              ) : (
                <div className="hidden md:flex items-center space-x-2 text-[11px] font-mono text-[#A1A1AA]">
                  <span className="rounded-full border border-[#2E2E34] bg-[#141416] px-3 py-1">Software Development</span>
                  <span className="rounded-full border border-[#2E2E34] bg-[#141416] px-3 py-1">Level 3</span>
                  <span className="rounded-full border border-[#2E2E34] bg-[#141416] px-3 py-1">Level 4</span>
                  <span className="rounded-full border border-[#2E2E34] bg-[#141416] px-3 py-1">Level 5</span>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <LiveDateTimeCalendarPill currentUser={currentUser} />

                {currentUser && <NotificationBell userId={currentUser.uid} />}

                {currentUser ? (
                  <div className="flex items-center space-x-2 rounded-full bg-[#141416] border border-[#2E2E34] pl-3.5 pr-1.5 py-1">
                    <div className="hidden sm:flex flex-col text-right leading-tight">
                      <span className="text-xs font-bold text-[#EAEAE6]">{currentUser.fullName}</span>
                      <span className="text-[10px] font-mono text-[#A1A1AA]">
                        {currentUser.role === 'teacher' ? 'Instructor' : `${currentUser.level} • Software Dev`}
                      </span>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="inline-flex items-center space-x-1 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-300 px-3 py-1.5 text-xs font-bold hover:bg-rose-500 hover:text-white transition-all"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Logout</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Link
                      href="/auth/login"
                      prefetch={false}
                      className="glow-border inline-flex items-center space-x-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500 hover:text-[#141416] transition-all"
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      <span>Student Login</span>
                    </Link>

                    <Link
                      href="/auth/register"
                      prefetch={false}
                      className="glow-border inline-flex items-center space-x-1.5 rounded-full bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-[#141416] hover:bg-emerald-400 transition-all shadow-sm"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>Register</span>
                    </Link>
                  </div>
                )}

                {(!currentUser || adminUser) && (
                  <Link
                    href={adminUser ? "/admin" : "/admin/login"}
                    prefetch={false}
                    className="glow-border inline-flex items-center space-x-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500 hover:text-[#141416] transition-all"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Teacher Portal</span>
                  </Link>
                )}
              </div>
            </header>

            {/* OPTIONAL EMAIL SUGGESTION BANNER */}
            {currentUser && currentUser.role === "student" && !currentUser.email && (
              <div className="rounded-2xl bg-[#141416] border border-[#2E2E34] px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center space-x-2 text-xs text-[#EAEAE6]">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>Profile Suggestion:</strong> Add your email address to receive course updates and notifications.
                  </span>
                </div>

                {emailSuccessMsg ? (
                  <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> {emailSuccessMsg}
                  </span>
                ) : (
                  <form onSubmit={handleSaveEmail} className="flex items-center space-x-2 shrink-0">
                    {emailErrMsg && <span className="text-[11px] text-rose-400">{emailErrMsg}</span>}
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="rounded-full border border-[#323238] bg-[#1C1C1F] px-3.5 py-1.5 text-xs text-white placeholder-[#71717A] focus:border-[#EAEAE6] focus:outline-none w-48 sm:w-56"
                    />
                    <button
                      type="submit"
                      disabled={updatingEmail}
                      className="rounded-full bg-[#EAEAE6] px-3.5 py-1.5 text-xs font-bold text-[#141416] hover:bg-white transition-all disabled:opacity-50"
                    >
                      {updatingEmail ? "Saving..." : "Add Email"}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* BENTO ROW 1: LEFT EDITORIAL CARD (OFF-WHITE) + RIGHT FEATURED PANEL (CHARCOAL) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
              <div className="lg:col-span-6 rounded-[24px] bg-[#EAEAE6] text-[#141416] p-6 sm:p-7 flex flex-col justify-between min-h-[230px]">
                <div>
                  <div className="inline-flex items-center space-x-2 rounded-full bg-[#141416] text-[#EAEAE6] px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider mb-4">
                    <span>Software Development</span>
                    <span>•</span>
                    <span>{currentUser?.role === "student" ? currentUser.level : "Levels 3 – 5"}</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight text-[#141416]">
                    {currentUser ? `Welcome back, ${currentUser.fullName.split(" ")[0]}.` : "Software Development Learning Hub."}
                  </h2>
                  <p className="mt-2.5 text-xs sm:text-sm text-[#3F3F46] leading-relaxed max-w-lg">
                    Structured course syllabi, class assignments, collaborative study groups, and timed assessments designed for focused mastery.
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (currentUser) {
                          setStudentPortalTab("assignments");
                        } else {
                          router.push("/auth/login");
                        }
                      }}
                      className="inline-flex items-center space-x-2 rounded-full bg-[#141416] text-[#EAEAE6] px-5 py-2.5 text-xs font-bold hover:bg-[#27272B] transition-all"
                    >
                      <span>{currentUser ? "Open Assignments" : "Student Sign In"}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>

                    {currentUser && (
                      <span className={`inline-flex items-center space-x-1.5 rounded-full px-3 py-2 text-[11px] font-mono font-bold border ${
                        (currentUser.unfocusedCount || 0) >= 10
                          ? "bg-rose-500/15 border-rose-500/40 text-rose-700"
                          : (currentUser.unfocusedCount || 0) > 0
                          ? "bg-amber-500/15 border-amber-500/40 text-amber-800"
                          : "bg-[#141416]/10 border-[#141416]/20 text-[#141416]"
                      }`}>
                        <Eye className="h-3.5 w-3.5" />
                        <span>Focus: {currentUser.unfocusedCount || 0}/10 Strikes</span>
                      </span>
                    )}
                  </div>

                  <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#141416] text-[#EAEAE6]">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6 rounded-[24px] bg-[#141416] border border-[#2E2E34] p-6 sm:p-7 flex flex-col justify-between min-h-[230px]">
                {currentUser && currentUser.role === "student" ? (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA]">
                          Academic Progress Overview
                        </span>
                        <h3 className="text-xl font-extrabold text-[#EAEAE6] mt-1">
                          {currentUser.level} • {tradesMap[currentUser.tradeId] || "Software Development"}
                        </h3>
                      </div>
                      <span className="rounded-full bg-[#EAEAE6] text-[#141416] px-3 py-1 text-xs font-mono font-extrabold">
                        {levelProgressPercent}% Done
                      </span>
                    </div>

                    <div className="my-4 space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono text-[#A1A1AA]">
                        <span>Completed Subtopics</span>
                        <span className="text-[#EAEAE6] font-bold">
                          {levelCompletedSubtopics} / {levelTotalSubtopics}
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#27272B]">
                        <div
                          className="h-full bg-[#EAEAE6] rounded-full transition-all duration-300"
                          style={{ width: `${levelProgressPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div className="rounded-xl bg-[#1C1C1F] border border-[#2E2E34] p-2.5">
                        <span className="block font-bold text-[#EAEAE6]">1. Active Focus</span>
                        <span className="text-[#A1A1AA] text-[10px]">Stay on study tab</span>
                      </div>
                      <div className="rounded-xl bg-[#1C1C1F] border border-[#2E2E34] p-2.5">
                        <span className="block font-bold text-amber-300">2. Monitored</span>
                        <span className="text-[#A1A1AA] text-[10px]">Tab-switch tracked</span>
                      </div>
                      <div className="rounded-xl bg-[#1C1C1F] border border-[#2E2E34] p-2.5">
                        <span className="block font-bold text-rose-300">3. 10 Strikes</span>
                        <span className="text-[#A1A1AA] text-[10px]">Auto-suspension</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA]">
                          Curriculum Architecture
                        </span>
                        <h3 className="text-xl font-extrabold text-[#EAEAE6] mt-1">
                          Software Development Track
                        </h3>
                      </div>
                      <span className="rounded-full border border-[#323238] bg-[#1C1C1F] px-3 py-1 text-[10px] font-mono text-[#EAEAE6]">
                        3 Levels
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 my-4">
                      {[
                        { lvl: "Level 3", desc: "Programming & Web Basics" },
                        { lvl: "Level 4", desc: "DSA, Logic & Databases" },
                        { lvl: "Level 5", desc: "React, Mobile & Systems" },
                      ].map((item) => (
                        <div key={item.lvl} className="rounded-2xl bg-[#1C1C1F] border border-[#2E2E34] p-3">
                          <span className="block text-xs font-extrabold text-[#EAEAE6]">{item.lvl}</span>
                          <span className="block text-[10px] text-[#A1A1AA] mt-1 leading-snug">{item.desc}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#A1A1AA] border-t border-[#2E2E34] pt-3">
                      <span>Classroom focus &amp; attendance tracking active</span>
                      <Link href="/auth/register" prefetch={false} className="font-bold text-[#EAEAE6] hover:underline">
                        Create Account →
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* BENTO ROW 2: LEFT SEARCH & LEVEL FILTER CARD + RIGHT 3 SQUARE BENTO TILES */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
              <div className="lg:col-span-5 rounded-[24px] bg-[#EAEAE6] text-[#141416] p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <span className="inline-block text-[10px] font-mono font-bold uppercase tracking-wider text-[#52525B]">
                    Filter &amp; Search Courses
                  </span>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#52525B]" />
                    <input
                      type="text"
                      placeholder="Search title, code (e.g. SWDFA501)..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full rounded-full border border-[#D4D4CE] bg-white py-2.5 pl-10 pr-4 text-xs text-[#141416] placeholder-[#71717A] focus:border-[#141416] focus:outline-none"
                    />
                  </div>
                </div>

                {currentUser && currentUser.role === "student" ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setActiveLevelFilter("all")}
                      className={`rounded-full px-3.5 py-1.5 text-[11px] font-mono font-bold transition-all ${
                        activeLevelFilter === "all"
                          ? "bg-[#141416] text-[#EAEAE6]"
                          : "bg-white text-[#3F3F46] border border-[#D4D4CE] hover:border-[#141416]"
                      }`}
                    >
                      All Permitted
                    </button>
                    {getPermittedLevels().map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => setActiveLevelFilter(lvl)}
                        className={`rounded-full px-3.5 py-1.5 text-[11px] font-mono font-bold transition-all ${
                          activeLevelFilter === lvl
                            ? "bg-[#141416] text-[#EAEAE6]"
                            : "bg-white text-[#3F3F46] border border-[#D4D4CE] hover:border-[#141416]"
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs text-[#3F3F46]">
                    <span>Sign in to access your level modules</span>
                    <Link
                      href="/auth/login"
                      prefetch={false}
                      className="rounded-full bg-[#141416] text-[#EAEAE6] px-4 py-1.5 font-bold hover:bg-[#27272B]"
                    >
                      Login
                    </Link>
                  </div>
                )}
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={() => setStudentPortalTab("courses")}
                  className={`text-left rounded-[24px] p-5 border transition-all flex flex-col justify-between min-h-[140px] ${
                    studentPortalTab === "courses"
                      ? "bg-[#EAEAE6] text-[#141416] border-[#EAEAE6]"
                      : "bg-[#141416] text-[#EAEAE6] border-[#2E2E34] hover:border-[#52525B]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <BookOpen className="h-5 w-5" />
                    <span className="text-xs font-mono font-bold opacity-75">{filtered.length}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold">Course Syllabi</h4>
                    <p className="text-[11px] opacity-75 mt-0.5">Notes &amp; learning outcomes</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (currentUser) setStudentPortalTab("assignments");
                    else router.push("/auth/login");
                  }}
                  className={`text-left rounded-[24px] p-5 border transition-all flex flex-col justify-between min-h-[140px] ${
                    studentPortalTab === "assignments"
                      ? "bg-[#EAEAE6] text-[#141416] border-[#EAEAE6]"
                      : "bg-[#141416] text-[#EAEAE6] border-[#2E2E34] hover:border-[#52525B]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Award className="h-5 w-5" />
                    <ArrowRight className="h-4 w-4 opacity-75" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold">Class Assignments</h4>
                    <p className="text-[11px] opacity-75 mt-0.5">Submit &amp; edit before due date</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (currentUser) setStudentPortalTab("exams");
                    else router.push("/auth/login");
                  }}
                  className={`text-left rounded-[24px] p-5 border transition-all flex flex-col justify-between min-h-[140px] ${
                    studentPortalTab === "exams" || studentPortalTab === "groups"
                      ? "bg-[#EAEAE6] text-[#141416] border-[#EAEAE6]"
                      : "bg-[#141416] text-[#EAEAE6] border-[#2E2E34] hover:border-[#52525B]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <FileQuestion className="h-5 w-5" />
                    <Users className="h-4 w-4 opacity-75" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold">Exams &amp; Groups</h4>
                    <p className="text-[11px] opacity-75 mt-0.5">Assessments &amp; team projects</p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* STUDENT ACADEMIC STANDING SUMMARY */}
          {currentUser && currentUser.role === "student" && studentPortalTab === "courses" && (
            <StudentAcademicStanding
              currentUser={currentUser}
              syllabi={syllabi}
              onTabChange={setStudentPortalTab as any}
            />
          )}

          {/* LOWER EDITORIAL SHEET (OFF-WHITE SURFACE MATCHING Design.jpeg) */}
          <main className="rounded-[28px] bg-[#EAEAE6] text-[#141416] p-5 sm:p-8 shadow-2xl">
            {currentUser && studentPortalTab === "assignments" ? (
              <div className="rounded-2xl bg-[#141416] text-[#EAEAE6] p-4 sm:p-6 border border-[#2E2E34]">
                <StudentAssignmentsView currentUser={currentUser} syllabi={syllabi} />
              </div>
            ) : currentUser && studentPortalTab === "groups" ? (
              <div className="rounded-2xl bg-[#141416] text-[#EAEAE6] p-4 sm:p-6 border border-[#2E2E34]">
                <StudentGroupsView
                  currentUser={currentUser}
                  syllabi={syllabi}
                  onNavigateToAssignments={() => setStudentPortalTab("assignments")}
                />
              </div>
            ) : currentUser && studentPortalTab === "exams" ? (
              <div className="rounded-2xl bg-[#141416] text-[#EAEAE6] p-4 sm:p-6 border border-[#2E2E34]">
                <StudentExamsView currentUser={currentUser} syllabi={syllabi} />
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-7 pb-4 border-b border-[#D4D4CE]">
                  <div>
                    <span className="inline-block rounded-full bg-[#141416] text-[#EAEAE6] px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider mb-2">
                      Curriculum Catalog
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#141416]">
                      Available Course Syllabi
                    </h3>
                  </div>
                  <span className="text-xs font-mono font-bold text-[#3F3F46] bg-white border border-[#D4D4CE] rounded-full px-3.5 py-1.5 self-start sm:self-auto">
                    Showing {filtered.length} {filtered.length === 1 ? "course" : "courses"}
                  </span>
                </div>

                {loading ? (
                  <div className="py-20 text-center text-[#52525B]">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#141416] border-t-transparent mb-3" />
                    Loading Course Syllabi...
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-16 text-center text-[#3F3F46] bg-white rounded-2xl border border-[#D4D4CE] p-6 space-y-3">
                    <BookOpen className="mx-auto h-10 w-10 text-[#71717A]" />
                    <h4 className="text-base font-bold text-[#141416]">No course syllabi available</h4>
                    <p className="text-xs text-[#52525B] max-w-md mx-auto">
                      {currentUser?.role === "student"
                        ? "No published syllabi found matching your assigned level. Please check back soon as your instructors publish course curriculum."
                        : "No course syllabi have been published yet. Instructors can sign in to the Teacher Portal to create and publish courses."}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((syl, idx) => {
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
                          className={`glow-border group flex flex-col justify-between rounded-[22px] bg-white border p-4 transition-all ${
                            idx % 3 === 1 ? "lg:translate-y-3" : ""
                          } ${
                            isNavigatingThis
                              ? "border-[#141416] ring-2 ring-[#141416] cursor-wait"
                              : isLocked
                              ? "opacity-60 border-[#D4D4CE] cursor-not-allowed"
                              : "border-[#D4D4CE] hover:border-[#141416] hover:shadow-xl cursor-pointer"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-3">
                              <span className="rounded-full bg-[#EAEAE6] px-2.5 py-1 font-mono text-[10px] font-bold text-[#141416]">
                                {syl.courseCode}
                              </span>
                              {syl.level && (
                                <span className="rounded-full bg-[#141416] px-2.5 py-1 font-mono text-[10px] font-bold text-[#EAEAE6]">
                                  {syl.level}
                                </span>
                              )}
                            </div>

                            <div className="rounded-2xl bg-[#18181B] text-[#EAEAE6] p-5 min-h-[120px] flex flex-col justify-between mb-3.5 group-hover:bg-[#141416] transition-colors">
                              <div className="flex items-center justify-between text-[10px] font-mono text-[#A1A1AA]">
                                <span>Software Development</span>
                                <span>{syl.learningOutcomes?.length || 0} Outcomes</span>
                              </div>
                              <h4 className="text-base font-extrabold text-white leading-snug mt-3">
                                {syl.title}
                              </h4>
                            </div>

                            <p className="text-xs text-[#52525B] line-clamp-2 leading-relaxed px-1">
                              {syl.description}
                            </p>
                          </div>

                          <div className="mt-4 flex items-center justify-between border-t border-[#E4E4DE] pt-3 px-1 text-xs font-bold text-[#141416]">
                            {isNavigatingThis ? (
                              <div className="flex items-center space-x-2">
                                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#141416] border-t-transparent" />
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
              </>
            )}
          </main>
        </div>

        <SiteFooter />

        {navigatingSyllabusId && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center space-x-3 rounded-full border border-[#323238] bg-[#141416] px-5 py-2.5 shadow-2xl">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#EAEAE6] border-t-transparent" />
            <span className="text-xs font-semibold text-[#EAEAE6]">
              Loading course curriculum... Please wait
            </span>
          </div>
        )}
      </div>

      {/* AUTHENTICATION REQUIRED MODAL FOR GUESTS */}
      {authPromptSyl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-[#2E2E34] bg-[#1C1C1F] p-7 text-center shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#EAEAE6] text-[#141416]">
              <Lock className="h-7 w-7" />
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-white tracking-tight">
                Student Authentication Required
              </h3>
              <p className="mt-2 text-xs text-[#A1A1AA] leading-relaxed">
                To view syllabus modules, learning outcomes, and topic breakdown for <strong className="text-white">{authPromptSyl.title}</strong> ({authPromptSyl.courseCode}), please log in or register your student account.
              </p>
            </div>

            <div className="grid gap-3 pt-2">
              <Link
                href="/auth/login"
                prefetch={false}
                className="inline-flex w-full items-center justify-center space-x-2 rounded-full bg-emerald-500 py-3 text-xs font-bold text-[#141416] hover:bg-emerald-400 transition-all shadow-lg"
              >
                <LogIn className="h-4 w-4" />
                <span>Log In to Access Content</span>
              </Link>

              <Link
                href="/auth/register"
                prefetch={false}
                className="inline-flex w-full items-center justify-center space-x-2 rounded-full border border-emerald-500/40 bg-emerald-500/15 py-3 text-xs font-bold text-emerald-300 hover:bg-emerald-500 hover:text-[#141416] transition-all"
              >
                <UserPlus className="h-4 w-4" />
                <span>Register Student Account</span>
              </Link>
            </div>

            <button
              onClick={() => setAuthPromptSyl(null)}
              className="text-xs font-mono text-[#A1A1AA] hover:text-white pt-2 transition-colors"
            >
              Close Window
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
