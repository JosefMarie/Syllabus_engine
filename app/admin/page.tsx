"use client";

import React, { useEffect, useState, useRef } from "react";
import { Syllabus } from "@/types/syllabus";
import { UserProfile } from "@/types/auth";
import { getAllSyllabi, deleteSyllabus, getAllUserProfiles, getLocalSyllabi, getLocalTrades, getAllTrades, getLocalUserProfiles } from "@/lib/db";
import { getAdminSession, logoutAdmin, getStoredSession, subscribeToAdminSessionRevocation, revokeAllAdminSessions, triggerGlobalClientRefresh } from "@/lib/auth";
import dynamic from "next/dynamic";
import { Trade } from "@/types/auth";
import { useRouter } from "next/navigation";

const TabLoadingPlaceholder = () => (
  <div className="flex flex-col items-center justify-center p-16 rounded-2xl border border-[#2E2E34]/60 bg-[#141416]/50 backdrop-blur-md text-[#A1A1AA]">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent mb-3" />
    <span className="text-xs font-semibold tracking-wide">Loading module workspace...</span>
  </div>
);

const TradesManager = dynamic(() => import("@/components/admin/TradesManager"), { ssr: false, loading: TabLoadingPlaceholder });
const StudentApprovals = dynamic(() => import("@/components/admin/StudentApprovals"), { ssr: false, loading: TabLoadingPlaceholder });
const StudentProgressManager = dynamic(() => import("@/components/admin/StudentProgressManager"), { ssr: false, loading: TabLoadingPlaceholder });
const AssignmentManager = dynamic(() => import("@/components/admin/AssignmentManager"), { ssr: false, loading: TabLoadingPlaceholder });
const ExamManager = dynamic(() => import("@/components/admin/ExamManager"), { ssr: false, loading: TabLoadingPlaceholder });
const GroupManager = dynamic(() => import("@/components/admin/GroupManager"), { ssr: false, loading: TabLoadingPlaceholder });
const MasterGradebook = dynamic(() => import("@/components/admin/MasterGradebook"), { ssr: false, loading: TabLoadingPlaceholder });
import AdminPresenceAlert from "@/components/admin/AdminPresenceAlert";
import RestrictionsControl from "@/components/admin/RestrictionsControl";
import { downloadSyllabusAsJSON, downloadSyllabusAsText, downloadAllSyllabiAsJSON } from "@/lib/exportSyllabus";
import { 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Edit3, 
  Eye, 
  ArrowLeft,
  Briefcase,
  UserCheck,
  BookOpen,
  LogOut,
  Activity,
  Users,
  Award,
  Download,
  FileText,
  FileCode,
  Lock,
  AlertTriangle,
  Smartphone,
  FileQuestion,
  Sparkles,
  Inbox,
  Radio,
  Megaphone,
  GraduationCap,
  Code2,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  TrendingUp,
  RefreshCw
} from "lucide-react";
import Link from "next/link";

export default function AdminDashboardPage() {
  const router = useRouter();

  const [adminUser, setAdminUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'syllabi' | 'trades' | 'students' | 'progress' | 'assignments' | 'groups' | 'exams' | 'gradebook'>('syllabi');
  const [syllabi, setSyllabi] = useState<Syllabus[]>(() => getLocalSyllabi());
  const [trades, setTrades] = useState<Trade[]>(() => getLocalTrades());
  const [pendingCount, setPendingCount] = useState(() => {
    if (typeof window !== "undefined") {
      return getLocalUserProfiles().filter(u => u.status === 'pending_approval').length;
    }
    return 0;
  });
  const [loading, setLoading] = useState(false);

  const [studentSession, setStudentSession] = useState<UserProfile | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("syllabus_admin_sidebar_collapsed") === "1";
    } catch { return false; }
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("syllabus_admin_sidebar_collapsed", next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Real-time listener: kick out this device if session was revoked centrally
    const unsubRevocation = subscribeToAdminSessionRevocation(() => {
      if (isMounted) {
        setAdminUser(null);
        router.push("/admin/login");
      }
    });

    async function init() {
      try {
        const currentAdmin = getAdminSession();
        const currentStudent = getStoredSession();

        if (!currentAdmin || currentAdmin.role !== "teacher") {
          if (isMounted) {
            setStudentSession(currentStudent);
            setAdminUser(null);
            setLoading(false);
          }
          return;
        }
        if (isMounted) setAdminUser(currentAdmin);

        // Fetch syllabi, trades, and pending approvals count in one-time queries
        const [syllabiRes, tradesRes, profilesRes] = await Promise.allSettled([
          getAllSyllabi(),
          getAllTrades(),
          getAllUserProfiles(),
        ]);

        if (!isMounted) return;
        if (syllabiRes.status === "fulfilled") setSyllabi(syllabiRes.value);
        if (tradesRes.status === "fulfilled") setTrades(tradesRes.value);
        if (profilesRes.status === "fulfilled") {
          setPendingCount(profilesRes.value.filter(u => u.status === 'pending_approval').length);
        }
      } catch (globalErr) {
        console.error("Admin dashboard initialization error:", globalErr);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    const handleTradesUpdated = () => {
      if (isMounted) setTrades(getLocalTrades());
    };
    if (typeof window !== "undefined") {
      window.addEventListener("syllabus_trades_updated", handleTradesUpdated);
    }

    init();

    // 4-second safety timer: guarantee loading spinner never locks the screen permanently
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 4000);

    return () => {
      isMounted = false;
      unsubRevocation();
      clearTimeout(safetyTimer);
      if (typeof window !== "undefined") {
        window.removeEventListener("syllabus_trades_updated", handleTradesUpdated);
      }
    };
  }, [router]);

  const handleLogout = async () => {
    await logoutAdmin();
    router.push("/admin/login");
  };

  const handleRevokeAll = async () => {
    if (confirm("Are you sure you want to log out all other devices? This will instantly disconnect all phones, tablets, and student computers currently holding an admin session.")) {
      await revokeAllAdminSessions("Instructor requested all devices log out");
    }
  };

  const handleForceRefreshAll = async () => {
    if (confirm("Force refresh all student and admin browsers? This will clear old cached chunks and local data caches for everyone currently online or when they next open the app (without logging them out).")) {
      try {
        await triggerGlobalClientRefresh("Instructor triggered global cache & content refresh");
      } catch (err) {
        console.error("Failed to trigger global client refresh:", err);
        alert("Failed to send global refresh signal. Please try again.");
      }
    }
  };

  const handleDelete = async (id: string, title?: string) => {
    const courseLabel = title ? `"${title}"` : "this syllabus";
    if (confirm(`Are you sure you want to permanently delete ${courseLabel}? This action cannot be undone.`)) {
      try {
        await deleteSyllabus(id);
        setSyllabi(prev => prev.filter(s => s.id !== id));
      } catch (err) {
        console.error("Delete syllabus error:", err);
        alert("Failed to delete syllabus. Please try again.");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#141416] text-[#EAEAE6]">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#EAEAE6] border-t-transparent mb-3" />
          <p className="text-xs font-mono text-[#A1A1AA]">Authenticating Admin Session...</p>
        </div>
      </div>
    );
  }

  if (!adminUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent p-4 text-[#EAEAE6]">
        <div className="w-full max-w-md rounded-2xl border border-[#2E2E34]/70 bg-[#1C1C1F]/85 backdrop-blur-xl p-8 text-center shadow-2xl space-y-6 animate-in fade-in zoom-in duration-200">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Lock className="h-8 w-8" />
          </div>

          <div>
            <div className="inline-flex items-center space-x-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-mono font-bold text-amber-400 border border-amber-500/30 mb-3">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Teacher Access Restricted</span>
            </div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              Teacher Admin Portal
            </h2>
            <p className="mt-2 text-xs text-[#A1A1AA] leading-relaxed">
              {studentSession
                ? `You are signed in as student "${studentSession.fullName}". The teacher management portal is restricted to authorized faculty.`
                : "This teacher management dashboard is reserved for authorized instructors and school administrators."}
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center space-x-2 rounded-xl bg-[#EAEAE6] py-3 text-xs font-bold text-[#141416] hover:bg-white hover:text-[#141416] transition-all shadow-lg"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Course Catalog</span>
            </Link>

            {!studentSession && (
              <Link
                href="/admin/login"
                className="inline-flex w-full items-center justify-center space-x-2 rounded-xl border border-[#2E2E34] bg-[#141416] py-3 text-xs font-semibold text-white hover:border-[#EAEAE6] transition-all"
              >
                <ShieldCheck className="h-4 w-4 text-[#EAEAE6]" />
                <span>Instructor Login</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  type AdminTabId = 'syllabi' | 'trades' | 'students' | 'progress' | 'assignments' | 'groups' | 'exams' | 'gradebook';

  const navSections: Array<{
    title: string;
    items: Array<{
      id: AdminTabId;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      iconClass?: string;
      badgeText?: string;
      badgeTone?: "cyan" | "amber" | "rose";
      pulse?: boolean;
    }>;
  }> = [
    {
      title: "Curriculum",
      items: [
        {
          id: "syllabi",
          label: "Course Syllabi",
          icon: BookOpen,
          badgeText: String(syllabi.length),
          badgeTone: "cyan"
        },
        { id: "trades", label: "Academic Trades", icon: Briefcase }
      ]
    },
    {
      title: "Students & Grading",
      items: [
        { id: "assignments", label: "Class Assignments", icon: Award },
        { id: "exams", label: "Exams & Quizzes", icon: FileQuestion },
        { id: "gradebook", label: "Master Gradebook", icon: GraduationCap, iconClass: "text-emerald-400" },
        { id: "groups", label: "Student Groups", icon: Users },
        {
          id: "students",
          label: "Student Approvals",
          icon: UserCheck,
          badgeText: pendingCount > 0 ? `${pendingCount} Pending` : undefined,
          badgeTone: "amber"
        }
      ]
    },
    {
      title: "Live Classroom Control",
      items: [
        { id: "progress", label: "Online & Focus Monitor", icon: TrendingUp, iconClass: "text-[#EAEAE6]" }
      ]
    }
  ];

  const activeNavItem =
    navSections.flatMap((sec) => sec.items).find((item) => item.id === activeTab) ||
    navSections[0].items[0];

  const renderSidebarContent = (collapsed: boolean, isMobileDrawer: boolean = false) => (
    <nav className="flex flex-col gap-5 py-4 px-3">
      {navSections.map((section) => (
        <div key={section.title} className="space-y-1">
          {!collapsed && (
            <div className="px-3 pb-1 text-[10px] font-mono font-bold uppercase tracking-wider text-[#71717A]">
              {section.title}
            </div>
          )}
          {section.items.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const badgeClasses =
              item.badgeTone === "rose"
                ? "bg-rose-500 text-white"
                : item.badgeTone === "amber"
                ? "bg-amber-400 text-[#141416]"
                : isActive
                ? "bg-[#141416] text-[#EAEAE6]"
                : "bg-[#27272B] text-[#EAEAE6] border border-[#323238]";

            return (
              <button
                key={item.id}
                type="button"
                title={collapsed ? item.label : undefined}
                onClick={() => {
                  setActiveTab(item.id);
                  if (isMobileDrawer) setMobileNavOpen(false);
                }}
                className={`relative w-full flex items-center ${
                  collapsed ? "justify-center px-2 py-2.5" : "justify-between px-3.5 py-2.5"
                } rounded-full text-xs font-bold transition-all ${
                  isActive
                    ? "bg-[#EAEAE6] text-[#141416] shadow-sm"
                    : "text-[#A1A1AA] hover:text-white hover:bg-[#27272B]"
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? "text-[#141416]" : "text-[#A1A1AA]"
                    } ${item.pulse ? "animate-pulse" : ""}`}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </div>

                {!collapsed && item.badgeText && (
                  <span
                    className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-mono font-extrabold ${badgeClasses} ${
                      item.pulse ? "animate-pulse" : ""
                    }`}
                  >
                    {item.badgeText}
                  </span>
                )}

                {collapsed && item.badgeText && item.badgeTone !== "cyan" && (
                  <span
                    className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full ${
                      item.badgeTone === "rose" ? "bg-rose-500" : "bg-amber-400"
                    } ${item.pulse ? "animate-ping" : ""}`}
                  />
                )}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#141416] text-[#EAEAE6] flex flex-col">
      {/* Slim Sticky Admin Top Header (Design.jpeg Monochrome) */}
      <header className="sticky top-0 z-30 h-16 border-b border-[#2E2E34] bg-[#1C1C1F]/95 px-3 sm:px-6 backdrop-blur-xl flex items-center justify-between gap-3">
        {/* Left: Sidebar Toggle, Brand & Active Section Breadcrumb */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
          {/* Mobile Drawer Trigger */}
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="lg:hidden inline-flex items-center justify-center h-9 w-9 rounded-full border border-[#323238] bg-[#141416] text-[#EAEAE6] hover:border-[#EAEAE6] transition-all shrink-0"
            title="Open navigation menu"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Desktop Sidebar Collapse Toggle */}
          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            className="hidden lg:inline-flex items-center justify-center h-9 w-9 rounded-full border border-[#323238] bg-[#141416] text-[#A1A1AA] hover:text-white hover:border-[#EAEAE6] transition-all shrink-0"
            title={sidebarCollapsed ? "Expand sidebar menu" : "Collapse sidebar to icons"}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4 text-[#EAEAE6]" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>

          <Link
            href="/"
            className="hidden sm:inline-flex items-center space-x-1.5 text-xs text-[#A1A1AA] hover:text-white transition-colors bg-[#141416] px-3 py-1.5 rounded-full border border-[#323238] shrink-0"
            title="Return to Public Course Catalog"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Catalog</span>
          </Link>

          <div className="flex items-center space-x-2 min-w-0">
            <span className="hidden sm:inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#EAEAE6] text-[#141416] shrink-0">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight whitespace-nowrap">
              Teacher Admin
            </h1>
            <span className="hidden md:inline text-[#52525B]">/</span>
            <span className="hidden md:inline rounded-full bg-[#141416] border border-[#2E2E34] px-2.5 py-0.5 text-[11px] font-mono font-bold text-[#EAEAE6] truncate">
              {activeNavItem.label}
            </span>
          </div>
        </div>

        {/* Right: Classroom Controls, Primary CTA & Instructor Menu */}
        <div className="flex items-center space-x-2 shrink-0">
          <RestrictionsControl adminUser={adminUser} compact={true} />

          <AdminPresenceAlert adminUser={adminUser} />

          <Link
            href="/admin/builder"
            title="Create New Syllabus"
            className="inline-flex items-center space-x-1.5 rounded-full bg-emerald-500 p-2 sm:px-4 sm:py-2 text-xs font-bold text-[#141416] hover:bg-emerald-400 transition-all shadow-sm shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Syllabus</span>
          </Link>

          {/* Instructor Account Dropdown */}
          <div className="relative" ref={accountMenuRef}>
            <button
              type="button"
              onClick={() => setAccountMenuOpen((prev) => !prev)}
              className="inline-flex items-center space-x-2 rounded-xl border border-[#2E2E34] bg-[#1C1C1F] px-2.5 py-1.5 text-xs font-semibold text-white hover:border-[#EAEAE6] transition-all shrink-0"
              title="Instructor account & security actions"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#EAEAE6]/20 text-[10px] font-mono font-extrabold text-[#EAEAE6] border border-[#EAEAE6]/30">
                JM
              </span>
              <span className="hidden md:inline max-w-[110px] truncate">Josef Marie</span>
              <ChevronDown className={`h-3.5 w-3.5 text-[#A1A1AA] transition-transform ${accountMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {accountMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-[#2E2E34] bg-[#141416]/95 backdrop-blur-xl p-2 shadow-2xl z-50 space-y-1">
                <div className="px-3 py-2 border-b border-[#2E2E34]/70">
                  <p className="text-xs font-extrabold text-white">Josef Marie</p>
                  <p className="text-[11px] font-mono text-[#A1A1AA] truncate">
                    {adminUser?.email || "Instructor Admin"}
                  </p>
                </div>

                <Link
                  href="/"
                  onClick={() => setAccountMenuOpen(false)}
                  className="sm:hidden flex items-center space-x-2 rounded-xl px-3 py-2 text-xs font-semibold text-[#EAEAE6] hover:bg-[#1C1C1F] hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5 text-[#EAEAE6]" />
                  <span>Back to Course Catalog</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    handleForceRefreshAll();
                  }}
                  className="w-full flex items-center space-x-2 rounded-xl px-3 py-2 text-xs font-semibold text-[#EAEAE6] hover:bg-[#EAEAE6]/15 hover:text-[#EAEAE6] transition-colors text-left"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-[#EAEAE6] shrink-0" />
                  <span>Force Refresh All Accounts</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    handleRevokeAll();
                  }}
                  className="w-full flex items-center space-x-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/15 hover:text-rose-200 transition-colors text-left"
                >
                  <Smartphone className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                  <span>Log Out All Devices</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center space-x-2 rounded-xl px-3 py-2 text-xs font-semibold text-[#EAEAE6] hover:bg-[#1C1C1F] hover:text-white transition-colors text-left"
                >
                  <LogOut className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Slide-Over Sidebar Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] h-full bg-[#141416] border-r border-[#2E2E34] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 h-16 border-b border-[#2E2E34]">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="h-5 w-5 text-[#EAEAE6]" />
                <span className="text-sm font-extrabold text-white">Admin Navigation</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-white hover:bg-[#1C1C1F]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {renderSidebarContent(false, true)}
            </div>
          </aside>
        </div>
      )}

      {/* Workspace Body: Collapsible Left Sidebar + Main Content */}
      <div className="flex flex-1 min-w-0">
        {/* Desktop Collapsible Sidebar */}
        <aside
          className={`hidden lg:flex flex-col shrink-0 border-r border-[#2E2E34] bg-[#1C1C1F] sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto transition-all duration-200 ${
            sidebarCollapsed ? "w-[72px]" : "w-64"
          }`}
        >
          {renderSidebarContent(sidebarCollapsed, false)}
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 px-3 sm:px-6 lg:px-8 py-5 sm:py-7">
          <div className="mx-auto max-w-7xl">

        {/* TAB 1: SYLLABI MANAGEMENT (OFF-WHITE EDITORIAL SHEET MATCHING Design.jpeg) */}
        {activeTab === 'syllabi' && (
          <div className="rounded-[28px] bg-[#EAEAE6] text-[#141416] p-5 sm:p-8 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#D4D4CE] pb-5 gap-3 sm:gap-4">
              <div>
                <span className="inline-block rounded-full bg-[#141416] text-[#EAEAE6] px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider mb-2">
                  Curriculum Management
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-[#141416] tracking-tight">
                  Course Syllabi Management
                </h2>
                <p className="mt-1 text-xs text-[#52525B]">
                  Manage published Software Development syllabi or parse new course documents with Gemini AI.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                <button
                  onClick={() => downloadAllSyllabiAsJSON(syllabi)}
                  className="inline-flex items-center space-x-1.5 rounded-full bg-[#141416] px-3.5 py-1.5 font-sans text-xs font-bold text-[#EAEAE6] hover:bg-[#27272B] transition-all shrink-0"
                  title="Export all course syllabi as a single JSON backup"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export All (JSON)</span>
                </button>
                <span className="rounded-full bg-white px-3 py-1.5 text-[#141416] border border-[#D4D4CE] font-bold shrink-0">
                  Published: {syllabi.filter(s => s.status === 'published').length}
                </span>
                <span className="rounded-full bg-white px-3 py-1.5 text-[#52525B] border border-[#D4D4CE] font-bold shrink-0">
                  Drafts: {syllabi.filter(s => s.status === 'draft').length}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="py-20 text-center text-[#52525B]">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#141416] border-t-transparent mb-3" />
                Loading Course Syllabi...
              </div>
            ) : syllabi.length === 0 ? (
              <div className="py-20 text-center text-[#52525B] bg-white rounded-2xl border border-[#D4D4CE] mt-6 p-6">
                <BookOpen className="mx-auto h-12 w-12 text-[#71717A] mb-3" />
                <p className="font-bold text-[#141416]">No Syllabi Found</p>
                <p className="text-xs mt-1 mb-4">Get started by creating your first syllabus.</p>
                <Link
                  href="/admin/builder"
                  className="inline-flex items-center space-x-2 rounded-full bg-emerald-500 px-5 py-2.5 text-xs font-bold text-[#141416] hover:bg-emerald-400 transition-all shadow-lg"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create First Syllabus</span>
                </Link>
              </div>
            ) : (
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {syllabi.map((syllabus) => (
                  <div
                    key={syllabus.id}
                    className="flex flex-col justify-between rounded-[22px] border border-[#D4D4CE] bg-white p-4 shadow-sm hover:border-[#141416] hover:shadow-xl transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="rounded-full bg-[#EAEAE6] px-2.5 py-1 font-mono text-[10px] font-bold text-[#141416]">
                          {syllabus.courseCode}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold font-mono uppercase ${
                            syllabus.status === "published"
                              ? "bg-[#141416] text-[#EAEAE6]"
                              : "bg-amber-500/20 text-amber-800 border border-amber-500/30"
                          }`}
                        >
                          {syllabus.status}
                        </span>
                      </div>

                      <div className="rounded-2xl bg-[#18181B] text-[#EAEAE6] p-4 min-h-[104px] flex flex-col justify-between mb-3">
                        <div className="flex items-center justify-between text-[10px] font-mono text-[#A1A1AA]">
                          <span>{syllabus.learningOutcomes?.length || 0} Outcomes</span>
                          {syllabus.level && <span className="text-white font-bold">{syllabus.level}</span>}
                        </div>
                        <h3 className="text-sm font-extrabold text-white line-clamp-2 mt-2">{syllabus.title}</h3>
                      </div>

                      <p className="text-xs text-[#52525B] line-clamp-2 leading-relaxed px-1">
                        {syllabus.description}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-end gap-1.5 border-t border-[#E4E4DE] pt-3">
                      <button
                        onClick={() => downloadSyllabusAsText(syllabus)}
                        className="inline-flex items-center space-x-1 rounded-full border border-[#D4D4CE] bg-[#EAEAE6] px-2.5 py-1 text-[11px] font-semibold text-[#141416] hover:border-[#141416]"
                        title="Download Formatted Text Document (.txt)"
                      >
                        <FileText className="h-3 w-3" />
                        <span>Doc</span>
                      </button>

                      <button
                        onClick={() => downloadSyllabusAsJSON(syllabus)}
                        className="inline-flex items-center space-x-1 rounded-full border border-[#D4D4CE] bg-[#EAEAE6] px-2.5 py-1 text-[11px] font-semibold text-[#141416] hover:border-[#141416]"
                        title="Download Raw JSON Data (.json)"
                      >
                        <FileCode className="h-3 w-3" />
                        <span>JSON</span>
                      </button>

                      <Link
                        href={`/syllabus/view?id=${syllabus.id}`}
                        target="_blank"
                        className="inline-flex items-center space-x-1 rounded-full border border-[#D4D4CE] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#141416] hover:border-[#141416]"
                      >
                        <Eye className="h-3 w-3" />
                        <span>View</span>
                      </Link>

                      <Link
                        href={`/admin/builder?id=${syllabus.id}`}
                        className="inline-flex items-center space-x-1 rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-emerald-500 transition-colors"
                      >
                        <Edit3 className="h-3 w-3" />
                        <span>Edit</span>
                      </Link>

                      <button
                        onClick={() => handleDelete(syllabus.id, syllabus.title)}
                        className="rounded-full bg-rose-500 p-1.5 text-white hover:bg-rose-600 transition-colors shadow-sm"
                        title="Permanently Delete Syllabus"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab !== 'syllabi' && (
          <div className="rounded-[28px] bg-[#1C1C1F] border border-[#2E2E34] p-4 sm:p-6 shadow-2xl">
            {activeTab === 'trades' && <TradesManager />}
            {activeTab === 'students' && <StudentApprovals />}
            {activeTab === 'progress' && <StudentProgressManager />}
            {activeTab === 'assignments' && (
              <AssignmentManager 
                syllabi={syllabi} 
                trades={trades} 
                adminEmail={adminUser?.email} 
              />
            )}
            {activeTab === 'exams' && (
              <ExamManager
                syllabi={syllabi}
                trades={trades}
                adminUser={adminUser}
              />
            )}
            {activeTab === 'groups' && (
              <GroupManager
                syllabi={syllabi}
                trades={trades}
                adminEmail={adminUser?.email}
                adminUser={adminUser}
              />
            )}
            {activeTab === 'gradebook' && <MasterGradebook adminUser={adminUser} trades={trades} />}
          </div>
        )}
          </div>
        </main>
      </div>
    </div>
  );
}
