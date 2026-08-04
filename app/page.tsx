"use client";

import React, { useEffect, useState } from "react";
import { Syllabus } from "@/types/syllabus";
import { UserProfile, StudentLevel } from "@/types/auth";
import { getAllSyllabi, getAllTrades } from "@/lib/db";
import { getStoredSession, saveStoredSession, updateUserEmail, logoutStudent } from "@/lib/auth";
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
  Lock
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NotificationAlert from "@/components/common/NotificationAlert";
import PresenceTracker from "@/components/common/PresenceTracker";

export default function CatalogPage() {
  const router = useRouter();
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [tradesMap, setTradesMap] = useState<Record<string, string>>({});
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Auth requirement modal for unauthenticated viewers
  const [authPromptSyl, setAuthPromptSyl] = useState<Syllabus | null>(null);

  // Email prompt state
  const [newEmail, setNewEmail] = useState("");
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [emailSuccessMsg, setEmailSuccessMsg] = useState<string | null>(null);
  const [emailErrMsg, setEmailErrMsg] = useState<string | null>(null);

  // Level Filter state for logged in students ("all" or specific level)
  const [activeLevelFilter, setActiveLevelFilter] = useState<string>("all");

  useEffect(() => {
    async function loadData() {
      const user = getStoredSession();
      setCurrentUser(user);

      const data = await getAllSyllabi();
      setSyllabi(data);

      const trades = await getAllTrades();
      const tMap: Record<string, string> = {};
      trades.forEach((t) => (tMap[t.id] = t.name));
      setTradesMap(tMap);

      setLoading(false);
    }
    loadData();
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
  const getPermittedLevels = (): StudentLevel[] => {
    if (!currentUser || currentUser.role !== "student") return ["Level 3", "Level 4", "Level 5"];
    if (currentUser.level === "Level 3") return ["Level 3"];
    if (currentUser.level === "Level 4") return ["Level 4", "Level 3"];
    if (currentUser.level === "Level 5") return ["Level 5", "Level 4", "Level 3"];
    return ["Level 3", "Level 4", "Level 5"];
  };

  // Syllabi filtering logic
  let filtered = syllabi.filter((s) => 
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.courseCode.toLowerCase().includes(search.toLowerCase()) ||
    s.description.toLowerCase().includes(search.toLowerCase())
  );

  if (currentUser && currentUser.role === "student") {
    const permittedLevels = getPermittedLevels();
    filtered = filtered.filter((s) => {
      // Must be within student's permitted level hierarchy
      const isLevelPermitted = !s.level || permittedLevels.includes(s.level as StudentLevel);
      
      // Match active level filter button selection ("all" or specific level)
      const matchesActiveFilter = activeLevelFilter === "all" || !s.level || s.level === activeLevelFilter;

      return isLevelPermitted && matchesActiveFilter;
    });
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

            {(!currentUser || currentUser.role === 'teacher') && (
              <Link
                href="/admin/login"
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
                  placeholder="Enter email address..."
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
          <div className="py-16 text-center text-[#94A3B8] bg-[#1E293B]/40 rounded-2xl border border-[#334155]">
            No syllabi found matching your search or assigned level.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((syl) => (
              <div
                key={syl.id}
                onClick={() => {
                  if (!currentUser) {
                    setAuthPromptSyl(syl);
                  } else {
                    router.push(`/syllabus/${syl.id}`);
                  }
                }}
                className="group flex flex-col justify-between rounded-2xl border border-[#334155] bg-[#1E293B] p-6 shadow-xl hover:border-[#06B6D4] hover:shadow-[#06B6D4]/10 transition-all cursor-pointer"
              >
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
                  <span>Explore Syllabus</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
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
