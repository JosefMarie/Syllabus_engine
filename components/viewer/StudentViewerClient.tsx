"use client";

import React, { useEffect, useState, useRef } from "react";
import { Syllabus, Subtopic, Citation } from "@/types/syllabus";
import { getSyllabusById, getSubtopicProgress, toggleSubtopicProgress, logActivity, saveLastReadSubtopic, getLastReadSubtopic, subscribeToUserProfile } from "@/lib/db";
import { getStoredSession, getAdminSession } from "@/lib/auth";
import SidebarTree from "@/components/viewer/SidebarTree";
import SubtopicView from "@/components/viewer/SubtopicView";
import CitationsDrawer from "@/components/viewer/CitationsDrawer";
import Link from "next/link";
import ContentProtection from "@/components/common/ContentProtection";
import { downloadSyllabusAsJSON, downloadSyllabusAsText } from "@/lib/exportSyllabus";
import { ArrowLeft, Menu, ShieldCheck, Lock, AlertTriangle, LogIn, UserPlus, Download, FileText, FileCode, CheckCircle2, Circle, AlertCircle, ArrowRight, Eye, RotateCcw, BookOpen, Maximize2, Minimize2, X, Sparkles } from "lucide-react";
import { UserProfile, StudentLevel } from "@/types/auth";
import NotificationAlert from "@/components/common/NotificationAlert";
import PresenceTracker from "@/components/common/PresenceTracker";
import DisciplinaryLockdown from "@/components/common/DisciplinaryLockdown";

export default function StudentViewerClient({ syllabusId }: { syllabusId: string }) {
  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [activeSubtopic, setActiveSubtopic] = useState<Subtopic | null>(null);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [toastData, setToastData] = useState<{
    message: string;
    subtopicTitle?: string;
    isCompleted: boolean;
    completedCount: number;
    totalCount: number;
  } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerToast = (message: string, isCompleted: boolean, subtopicTitle?: string, currentMap?: Record<string, boolean>) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    const mapToUse = currentMap || progressMap;
    const completedCount = allSubtopics.filter(s => mapToUse[s.id]).length;

    setToastData({
      message,
      subtopicTitle,
      isCompleted,
      completedCount,
      totalCount: allSubtopics.length,
    });

    toastTimeoutRef.current = setTimeout(() => {
      setToastData(null);
    }, 4500);
  };

  // Flattened array of all subtopics for easy previous/next pagination
  const [allSubtopics, setAllSubtopics] = useState<Subtopic[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const activeTopicInfo = React.useMemo(() => {
    if (!syllabus || !activeSubtopic) return null;
    for (const lo of (syllabus.learningOutcomes || [])) {
      for (const ic of (lo?.indicativeContents || [])) {
        for (const top of (ic?.topics || [])) {
          if ((top?.subtopics || []).some((sub) => sub?.id === activeSubtopic.id)) {
            return {
              topicId: top.id,
              topicTitle: top.title,
            };
          }
        }
      }
    }
    return null;
  }, [syllabus, activeSubtopic]);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      const user = getStoredSession();
      const admin = getAdminSession();
      if (isMounted) {
        setCurrentUser(user);
        setIsAdminLoggedIn(Boolean(admin));
      }

      const data = await getSyllabusById(syllabusId);
      if (!isMounted) return;

      if (data) {
        setSyllabus(data);
        const progress = getSubtopicProgress();
        setProgressMap(progress);

        // Collect subtopics across 5 levels defensively
        const list: Subtopic[] = [];
        (data.learningOutcomes || []).forEach((lo) => {
          (lo?.indicativeContents || []).forEach((ic) => {
            (ic?.topics || []).forEach((top) => {
              (top?.subtopics || []).forEach((sub) => {
                if (sub) list.push(sub);
              });
            });
          });
        });

        setAllSubtopics(list);
        if (list.length > 0) {
          // Check for saved reading position or first uncompleted subtopic
          const lastReadId = await getLastReadSubtopic(syllabusId, user?.uid);
          let targetSubtopic = list[0];

          if (lastReadId) {
            const found = list.find((s) => s.id === lastReadId);
            if (found) {
              targetSubtopic = found;
              setResumeNotice(`Resumed where you left off: "${found.title}"`);
            }
          } else {
            const firstIncomplete = list.find((s) => !progress[s.id]);
            if (firstIncomplete && Object.values(progress).some(Boolean)) {
              targetSubtopic = firstIncomplete;
              setResumeNotice(`Continuing your course: "${firstIncomplete.title}"`);
            }
          }

          setActiveSubtopic(targetSubtopic);
          if (user || admin) {
            trackSubtopicView(targetSubtopic, data);
          }
        }
      }
      setLoading(false);
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [syllabusId, reloadKey]);

  // Real-time listener for current user profile (status changes, strike resets, re-approvals)
  useEffect(() => {
    const session = getStoredSession();
    if (!session?.uid) return;

    const unsubscribe = subscribeToUserProfile(session.uid, (freshUser) => {
      if (freshUser) {
        setCurrentUser(freshUser);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Auto-dismiss resume toast after 5 seconds
  useEffect(() => {
    if (resumeNotice) {
      const timer = setTimeout(() => setResumeNotice(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [resumeNotice]);

  const trackSubtopicView = (sub: Subtopic, syl?: Syllabus | null) => {
    const s = syl || syllabus;
    const user = getStoredSession();
    const admin = getAdminSession();
    
    if (user || admin) {
      logActivity({
        userId: user?.uid || admin?.uid || "guest",
        userName: user?.fullName || admin?.fullName || "Guest",
        userEmail: user?.email || admin?.email || "guest@student.edu",
        userLevel: user?.level || admin?.level || "Admin",
        action: "VIEW_SUBTOPIC",
        details: `Viewed subtopic "${sub.title}" in ${s?.title || 'Syllabus'}`,
        syllabusId: s?.id,
        syllabusTitle: s?.title
      });
    }
  };

  const handleSelectSubtopic = (sub: Subtopic) => {
    setActiveSubtopic(sub);
    trackSubtopicView(sub);
    saveLastReadSubtopic(syllabusId, sub.id, currentUser?.uid);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const scrollTotal = el.scrollHeight - el.clientHeight;
    if (scrollTotal > 0) {
      const p = Math.min(100, Math.max(0, (el.scrollTop / scrollTotal) * 100));
      setScrollProgress(p);
    } else {
      setScrollProgress(100);
    }
  };

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    setScrollProgress(0);
  }, [activeSubtopic?.id]);

  const handleToggleComplete = async (subtopicId: string) => {
    const updatedMap = await toggleSubtopicProgress(subtopicId);
    setProgressMap(updatedMap);
    saveLastReadSubtopic(syllabusId, subtopicId, currentUser?.uid);
    const isCompletedNow = Boolean(updatedMap[subtopicId]);
    triggerToast(
      isCompletedNow ? "Subtopic completed! 🎉 Great focus!" : "Subtopic marked as Incomplete",
      isCompletedNow,
      activeSubtopic?.title,
      updatedMap
    );

    const user = getStoredSession();
    const admin = getAdminSession();

    if (activeSubtopic && (user || admin)) {
      logActivity({
        userId: user?.uid || admin?.uid || "guest",
        userName: user?.fullName || admin?.fullName || "Guest",
        userEmail: user?.email || admin?.email || "guest@student.edu",
        userLevel: user?.level || admin?.level || "Admin",
        action: "VIEW_SUBTOPIC",
        details: `${isCompletedNow ? 'Marked as Completed' : 'Unmarked'}: "${activeSubtopic.title}"`,
        syllabusId: syllabus?.id,
        syllabusTitle: syllabus?.title
      });
    }
  };

  const currentIdx = activeSubtopic ? allSubtopics.findIndex((s) => s.id === activeSubtopic.id) : -1;
  const prevSubtopic = currentIdx > 0 ? allSubtopics[currentIdx - 1] : undefined;
  const nextSubtopic = currentIdx >= 0 && currentIdx < allSubtopics.length - 1 ? allSubtopics[currentIdx + 1] : undefined;

  // Level validation helper
  const isLevelAllowed = (): boolean => {
    if (isAdminLoggedIn) return true; // Teachers can view all levels
    if (!currentUser || currentUser.role !== "student") return false;
    if (!syllabus?.level) return true;

    const studentLevel = currentUser.level;
    const sylLevel = syllabus.level;

    if (studentLevel === "Level 3") return sylLevel === "Level 3";
    if (studentLevel === "Level 4") return sylLevel === "Level 3" || sylLevel === "Level 4";
    if (studentLevel === "Level 5") return true; // Level 5 can view 3, 4, 5

    return true;
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0B0F19] text-[#CBD5E1]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#06B6D4] border-t-transparent mb-4" />
          <p className="text-sm font-mono text-[#94A3B8]">Loading Digital Syllabus Hierarchy...</p>
        </div>
      </div>
    );
  }

  if (!syllabus) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0F19] p-6 text-[#CBD5E1]">
        <div className="w-full max-w-md rounded-2xl border border-[#334155] bg-[#1E293B] p-8 text-center shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <BookOpen className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-white">Course Curriculum Not Loaded</h2>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            The course data could not be retrieved from the server. This may happen on slower connections or if the document is still syncing.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setLoading(true);
                setReloadKey(k => k + 1);
              }}
              className="inline-flex items-center space-x-2 rounded-xl bg-[#06B6D4] px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-md active:scale-95"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Retry Loading Course</span>
            </button>
            <Link
              href="/"
              className="rounded-xl border border-[#334155] bg-[#0B0F19] px-4 py-2.5 text-xs font-semibold text-[#CBD5E1] hover:text-white hover:border-[#06B6D4] transition-all"
            >
              Back to Catalog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 1. GUEST USER PROTECTION: Not logged in
  if (!currentUser && !isAdminLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0F19] p-6 text-[#CBD5E1]">
        <div className="w-full max-w-md rounded-2xl border border-[#334155] bg-[#1E293B] p-8 text-center shadow-2xl space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#06B6D4]/15 text-[#06B6D4] border border-[#06B6D4]/30">
            <Lock className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              Authentication Required
            </h2>
            <p className="mt-2 text-xs text-[#94A3B8] leading-relaxed">
              Please log in or register a student account to view <strong className="text-white">{syllabus.title}</strong>, explore learning outcomes, and track your subtopic notes.
            </p>
          </div>

          <div className="grid gap-3 pt-2">
            <Link
              href="/auth/login"
              className="inline-flex w-full items-center justify-center space-x-2 rounded-xl bg-[#06B6D4] py-3 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-lg"
            >
              <LogIn className="h-4 w-4" />
              <span>Log In to Student Account</span>
            </Link>

            <Link
              href="/auth/register"
              className="inline-flex w-full items-center justify-center space-x-2 rounded-xl border border-[#334155] bg-[#0B0F19] py-3 text-xs font-semibold text-white hover:border-[#06B6D4] transition-all"
            >
              <UserPlus className="h-4 w-4 text-[#06B6D4]" />
              <span>Register New Account</span>
            </Link>

            <Link
              href="/"
              className="mt-2 inline-flex items-center justify-center space-x-1.5 text-xs text-[#94A3B8] hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Return to Catalog</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. LEVEL HIERARCHY PROTECTION: Student level not permitted
  if (!isLevelAllowed()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0F19] p-6 text-[#CBD5E1]">
        <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-[#1E293B] p-8 text-center shadow-2xl space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              Level Access Restricted
            </h2>
            <p className="mt-2 text-xs text-[#94A3B8] leading-relaxed">
              Your account is approved for <strong className="text-[#10B981] font-mono">{currentUser?.level}</strong>. This syllabus requires <strong className="text-[#06B6D4] font-mono">{syllabus.level}</strong> authorization.
            </p>
          </div>

          <div className="pt-2 space-y-3">
            <p className="text-[11px] font-mono text-[#94A3B8] bg-[#0B0F19] p-3 rounded-xl border border-[#334155]">
              Please contact your instructor or trade teacher to upgrade your student study level.
            </p>

            <Link
              href="/"
              className="inline-flex w-full items-center justify-center space-x-2 rounded-xl bg-[#06B6D4] py-3 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-lg"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Allowed Syllabi</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. ACCOUNT STATUS PROTECTION: Account suspended / rejected (e.g. 10 side-window violations)
  if (currentUser && currentUser.status === "rejected" && !isAdminLoggedIn) {
    return (
      <DisciplinaryLockdown
        studentName={currentUser.fullName}
        studentUsername={currentUser.username}
        reason={currentUser.suspensionReason}
        violationsCount={currentUser.unfocusedCount || 10}
      />
    );
  }

  if (currentUser && currentUser.status === "pending_approval" && !isAdminLoggedIn) {
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
                ? "Your side-window focus strikes have been reset to 0/10 by your teacher. Your account is now pending faculty approval. As soon as your teacher approves, your study session will automatically resume right here."
                : "Your account registration is awaiting faculty verification. Once approved, you will have immediate access to your accredited syllabus."}
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
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center space-x-2 rounded-xl bg-slate-800 py-3 text-xs font-bold text-[#CBD5E1] hover:bg-slate-700 transition-all border border-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ContentProtection
      isProtected={!isAdminLoggedIn}
      userFullName={currentUser?.fullName}
      userEmail={currentUser?.email}
    >
      <div className="flex h-screen overflow-hidden bg-[#0B0F19] text-[#CBD5E1]">
        {currentUser && (
          <>
            <NotificationAlert userId={currentUser.uid} />
            <PresenceTracker
              userId={currentUser.uid}
              fullName={currentUser.fullName}
              email={currentUser.email}
              username={currentUser.username}
              tradeId={currentUser.tradeId}
              level={currentUser.level}
              syllabusId={syllabus?.id}
              syllabusTitle={syllabus?.title}
              topicId={activeTopicInfo?.topicId}
              topicTitle={activeTopicInfo?.topicTitle}
              subtopicId={activeSubtopic?.id}
              subtopicTitle={activeSubtopic?.title}
            />
          </>
        )}
        {/* 5-Level Sidebar Navigation */}
        {!isFocusMode && (
          <SidebarTree
            syllabus={syllabus}
            activeSubtopicId={activeSubtopic?.id || null}
            onSelectSubtopic={handleSelectSubtopic}
            progressMap={progressMap}
            mobileOpen={isMobileSidebarOpen}
            onMobileOpenChange={setIsMobileSidebarOpen}
          />
        )}

        {/* Main Workspace Pane */}
        <div ref={scrollContainerRef} onScroll={handleScroll} className="flex flex-1 flex-col overflow-y-auto w-full min-w-0 relative">
          {/* Top Sticky Header */}
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#334155] bg-[#0B0F19]/95 px-3 sm:px-6 py-2.5 sm:py-3 backdrop-blur-md relative">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              {/* Mobile & Tablet Outline Drawer Trigger */}
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                title="Open Course Syllabus Outline"
                className="inline-flex lg:hidden items-center space-x-1.5 rounded-lg border border-[#334155] bg-[#1E293B] px-2.5 py-1.5 text-xs font-semibold text-[#CBD5E1] hover:text-white hover:border-[#06B6D4] transition-all shrink-0"
              >
                <Menu className="h-4 w-4 text-[#06B6D4]" />
                <span className="hidden xs:inline font-mono text-[11px]">Outline</span>
              </button>

              <Link
                href="/"
                className="inline-flex items-center space-x-1 text-xs text-[#94A3B8] hover:text-white transition-colors shrink-0"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Catalog</span>
              </Link>
              <span className="text-[#334155] shrink-0">/</span>
              <span className="text-xs font-mono text-[#06B6D4] font-semibold truncate max-w-[120px] sm:max-w-none">{syllabus?.courseCode || "Syllabus"}</span>
            </div>

            <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
              {/* Reading Progress Percentage */}
              {activeSubtopic && (
                <div className="flex items-center space-x-1 sm:space-x-1.5 rounded-lg border border-[#06B6D4]/30 bg-[#06B6D4]/10 px-2 py-1 text-[11px] sm:text-xs font-mono text-[#06B6D4]">
                  <BookOpen className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#06B6D4]" />
                  <span>{Math.round(scrollProgress)}%</span>
                  <span className="hidden sm:inline">Read</span>
                </div>
              )}

              {/* Focus Mode Button (hidden on tiny screens, visible on sm+) */}
              {activeSubtopic && (
                <button
                  onClick={() => setIsFocusMode(!isFocusMode)}
                  title={isFocusMode ? "Exit Focus Mode (Show Sidebar)" : "Enter Focus Mode (Full-Width Reading Canvas)"}
                  className={`hidden sm:inline-flex items-center space-x-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all border ${
                    isFocusMode
                      ? "bg-[#06B6D4] text-slate-950 font-bold border-[#06B6D4] shadow-md shadow-[#06B6D4]/30"
                      : "border-[#334155] bg-[#1E293B] text-[#CBD5E1] hover:text-white hover:border-[#06B6D4]"
                  }`}
                >
                  {isFocusMode ? (
                    <>
                      <Minimize2 className="h-3.5 w-3.5" />
                      <span className="hidden md:inline">Exit Focus</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-3.5 w-3.5 text-[#06B6D4]" />
                      <span className="hidden md:inline">Focus Mode</span>
                    </>
                  )}
                </button>
              )}
              {isAdminLoggedIn && (
                <>
                  <div className="relative">
                    <button
                      onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                      className="inline-flex items-center space-x-1.5 rounded-lg border border-[#06B6D4]/40 bg-[#06B6D4]/10 px-3 py-1.5 text-xs font-bold text-[#06B6D4] hover:bg-[#06B6D4]/20 transition-all"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download Syllabus</span>
                    </button>

                    {showDownloadMenu && (
                      <div className="absolute right-0 mt-2 w-52 rounded-xl border border-[#334155] bg-[#1E293B] p-1.5 shadow-2xl z-30">
                        <button
                          onClick={() => {
                            downloadSyllabusAsText(syllabus);
                            setShowDownloadMenu(false);
                          }}
                          className="flex w-full items-center space-x-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-[#CBD5E1] hover:bg-[#0B0F19] hover:text-white transition-colors"
                        >
                          <FileText className="h-3.5 w-3.5 text-[#06B6D4]" />
                          <span>Formatted Document (.txt)</span>
                        </button>
                        <button
                          onClick={() => {
                            downloadSyllabusAsJSON(syllabus);
                            setShowDownloadMenu(false);
                          }}
                          className="flex w-full items-center space-x-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-[#CBD5E1] hover:bg-[#0B0F19] hover:text-white transition-colors"
                        >
                          <FileCode className="h-3.5 w-3.5 text-[#10B981]" />
                          <span>Raw JSON Data (.json)</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <Link
                    href={`/admin/builder?id=${syllabus.id}`}
                    className="inline-flex items-center space-x-1.5 rounded-lg border border-[#334155] bg-[#1E293B] px-3 py-1.5 text-xs font-semibold text-white hover:border-[#06B6D4] transition-all"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-[#06B6D4]" />
                    <span className="hidden sm:inline">Edit in Admin Portal</span>
                  </Link>
                </>
              )}
            </div>
            {/* Sticky Reading Progress Bar on bottom edge of header */}
            {activeSubtopic && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800/80 overflow-hidden pointer-events-none">
                <div 
                  className="h-full bg-gradient-to-r from-[#06B6D4] via-[#3B82F6] to-[#10B981] transition-all duration-150 shadow-[0_0_12px_rgba(6,182,212,0.9)]"
                  style={{ width: `${scrollProgress}%` }}
                />
              </div>
            )}
          </header>

          {/* Content Pane */}
          <main className="flex-1 pb-16">
            {activeSubtopic ? (
              <SubtopicView
                subtopic={activeSubtopic}
                citationsMap={syllabus.citationsDictionary || {}}
                onSelectCitation={(cit) => setActiveCitation(cit)}
                isCompleted={Boolean(progressMap[activeSubtopic.id])}
                onToggleComplete={() => handleToggleComplete(activeSubtopic.id)}
                onPrevSubtopic={prevSubtopic ? () => handleSelectSubtopic(prevSubtopic) : undefined}
                onNextSubtopic={nextSubtopic ? () => handleSelectSubtopic(nextSubtopic) : undefined}
                currentIndex={currentIdx + 1}
                totalSubtopics={allSubtopics.length}
              />
            ) : (
              <div className="max-w-4xl mx-auto py-10 px-6 space-y-6">
                {/* Hello & Study Focus Welcome Card */}
                <div className="rounded-2xl border border-[#334155] bg-[#1E293B]/90 backdrop-blur-md p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6">
                  <div className="absolute top-0 right-0 h-44 w-44 bg-gradient-to-bl from-[#06B6D4]/15 to-transparent rounded-full blur-2xl pointer-events-none" />

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#334155]/80 pb-5">
                    <div>
                      <div className="inline-flex items-center space-x-2 rounded-full border border-[#06B6D4]/30 bg-[#06B6D4]/10 px-3 py-0.5 text-xs font-mono text-[#06B6D4] mb-2.5">
                        <span>{syllabus?.courseCode}</span>
                        <span>•</span>
                        <span>{syllabus?.level || 'Academic Syllabus'}</span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                        Hello, {currentUser?.fullName || 'Student'}! 👋
                      </h2>
                      <p className="text-sm text-[#94A3B8] mt-1">
                        Welcome to <strong className="text-white">{syllabus?.title}</strong>
                      </p>
                    </div>

                    {/* Live Focus Standing Badge */}
                    {currentUser && (
                      <div className="shrink-0">
                        {(currentUser.unfocusedCount || 0) >= 10 ? (
                          <span className="inline-flex items-center space-x-1.5 rounded-full bg-rose-500/20 border border-rose-500/40 px-3.5 py-1.5 text-xs font-mono font-bold text-rose-300">
                            <AlertTriangle className="h-4 w-4" />
                            <span>Account Suspended (10/10 Violations)</span>
                          </span>
                        ) : (currentUser.unfocusedCount || 0) > 0 ? (
                          <span className="inline-flex items-center space-x-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 px-3.5 py-1.5 text-xs font-mono font-bold text-amber-300">
                            <AlertTriangle className="h-4 w-4" />
                            <span>{currentUser.unfocusedCount} / 10 Side Windows</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3.5 py-1.5 text-xs font-mono font-bold text-emerald-400">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>0 / 10 Strikes (Good Standing)</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {syllabus?.description && (
                    <p className="text-xs text-[#CBD5E1] leading-relaxed bg-[#0B0F19]/60 p-4 rounded-xl border border-[#334155]/60">
                      {syllabus.description}
                    </p>
                  )}

                  {/* Focus & Side-Window Instructions */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-[#06B6D4] font-bold flex items-center gap-1.5">
                      <Eye className="h-4 w-4" />
                      <span>Classroom Study Instructions & Side-Window Rules</span>
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
                      <div className="rounded-xl bg-[#0B0F19] border border-[#334155] p-4 space-y-1.5">
                        <div className="font-bold text-[#06B6D4] flex items-center space-x-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#06B6D4]/20 text-[11px] font-mono">1</span>
                          <span>Active Focus Mandatory</span>
                        </div>
                        <p className="text-[#94A3B8] text-[11px] leading-relaxed">
                          Keep this tab open and in front of you. Your reading and topic study time is actively counted while this window remains in focus.
                        </p>
                      </div>

                      <div className="rounded-xl bg-[#0B0F19] border border-amber-500/30 p-4 space-y-1.5">
                        <div className="font-bold text-amber-400 flex items-center space-x-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-mono">2</span>
                          <span>Side Windows Monitored</span>
                        </div>
                        <p className="text-[#94A3B8] text-[11px] leading-relaxed">
                          Clicking outside this tab, opening side windows, or minimizing registers an inattention strike immediately.
                        </p>
                      </div>

                      <div className="rounded-xl bg-[#0B0F19] border border-rose-500/40 bg-rose-950/10 p-4 space-y-1.5">
                        <div className="font-bold text-rose-400 flex items-center space-x-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/20 text-[11px] font-mono">3</span>
                          <span>10 Strikes Rejection</span>
                        </div>
                        <p className="text-[#CBD5E1] text-[11px] leading-relaxed">
                          Accumulating <strong>10 side-window strikes</strong> automatically rejects and suspends your account. You will be locked out until your teacher approves your account again.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Getting Started Action */}
                  <div className="pt-2 rounded-xl bg-[#0B0F19]/70 border border-[#334155] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-[#94A3B8]">
                      Ready to begin? Select any topic or subtopic from the hierarchy on the left.
                    </div>
                    {allSubtopics.length > 0 && (
                      <button
                        onClick={() => handleSelectSubtopic(allSubtopics[0])}
                        className="inline-flex items-center space-x-1.5 rounded-xl bg-[#06B6D4] px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-lg shrink-0"
                      >
                        <span>Start First Topic</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Citations Side Drawer / Mobile Bottom Sheet */}
        <CitationsDrawer
          citation={activeCitation}
          onClose={() => setActiveCitation(null)}
        />

        {/* Reading Position Auto-Resume Notification Toast */}
        {resumeNotice && (
          <div className="fixed bottom-24 right-6 z-40 flex items-center gap-2 rounded-xl border border-[#06B6D4]/40 bg-[#1E293B]/95 px-4 py-3 text-xs text-white shadow-2xl backdrop-blur-md transition-all">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#06B6D4] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#06B6D4]"></span>
            </span>
            <span className="font-mono text-[#06B6D4] font-bold">Auto-Resume:</span>
            <span className="max-w-xs truncate">{resumeNotice}</span>
            <button 
              onClick={() => setResumeNotice(null)} 
              className="ml-2 text-slate-400 hover:text-white text-base leading-none p-0.5"
              title="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* Prominent Floating Completion Toast */}
        {toastData && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[92%] sm:w-auto flex items-center space-x-3.5 rounded-2xl border-2 border-[#10B981] bg-[#0F172A]/98 p-4 text-white shadow-[0_12px_45px_rgba(16,185,129,0.45)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-300">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981]">
              {toastData.isCompleted ? (
                <CheckCircle2 className="h-6 w-6 text-[#10B981]" />
              ) : (
                <Circle className="h-6 w-6 text-slate-400" />
              )}
            </div>
            <div className="flex-1 min-w-0 pr-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#10B981]">
                  {toastData.isCompleted ? "Goal Completed! 🎉" : "Progress Updated"}
                </span>
                <span className="text-[10px] font-mono text-[#94A3B8]">
                  ({toastData.completedCount}/{toastData.totalCount} completed)
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-100 truncate mt-0.5 max-w-[280px] sm:max-w-xs">
                {toastData.subtopicTitle ? `"${toastData.subtopicTitle}"` : toastData.message}
              </p>
            </div>
            <button
              onClick={() => setToastData(null)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors shrink-0"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </ContentProtection>
  );
}
