"use client";

import React, { useEffect, useState } from "react";
import { Syllabus, Subtopic, Citation } from "@/types/syllabus";
import { getSyllabusById, getSubtopicProgress, toggleSubtopicProgress, logActivity } from "@/lib/db";
import { getStoredSession, getAdminSession } from "@/lib/auth";
import SidebarTree from "@/components/viewer/SidebarTree";
import SubtopicView from "@/components/viewer/SubtopicView";
import CitationsDrawer from "@/components/viewer/CitationsDrawer";
import Link from "next/link";
import ContentProtection from "@/components/common/ContentProtection";
import { downloadSyllabusAsJSON, downloadSyllabusAsText } from "@/lib/exportSyllabus";
import { ArrowLeft, ShieldCheck, Lock, AlertTriangle, LogIn, UserPlus, Download, FileText, FileCode } from "lucide-react";
import { UserProfile, StudentLevel } from "@/types/auth";
import NotificationAlert from "@/components/common/NotificationAlert";
import PresenceTracker from "@/components/common/PresenceTracker";

export default function StudentViewerClient({ syllabusId }: { syllabusId: string }) {
  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [activeSubtopic, setActiveSubtopic] = useState<Subtopic | null>(null);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  // Flattened array of all subtopics for easy previous/next pagination
  const [allSubtopics, setAllSubtopics] = useState<Subtopic[]>([]);

  useEffect(() => {
    async function load() {
      const user = getStoredSession();
      const admin = getAdminSession();
      setCurrentUser(user);
      setIsAdminLoggedIn(Boolean(admin));

      const data = await getSyllabusById(syllabusId);
      if (data) {
        setSyllabus(data);
        const progress = getSubtopicProgress();
        setProgressMap(progress);

        // Collect subtopics across 5 levels
        const list: Subtopic[] = [];
        data.learningOutcomes.forEach((lo) => {
          lo.indicativeContents.forEach((ic) => {
            ic.topics.forEach((top) => {
              top.subtopics.forEach((sub) => {
                list.push(sub);
              });
            });
          });
        });

        setAllSubtopics(list);
        if (list.length > 0) {
          setActiveSubtopic(list[0]);
          if (user || admin) {
            trackSubtopicView(list[0], data);
          }
        }
      }
      setLoading(false);
    }
    load();
  }, [syllabusId]);

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
  };

  const handleToggleComplete = async (subtopicId: string) => {
    const updatedMap = await toggleSubtopicProgress(subtopicId);
    setProgressMap(updatedMap);
    const isCompletedNow = Boolean(updatedMap[subtopicId]);

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
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#0B0F19] text-[#CBD5E1]">
        <h2 className="text-2xl font-bold text-white mb-2">Syllabus Not Found</h2>
        <p className="text-sm text-[#94A3B8] mb-6">The requested syllabus ID could not be retrieved.</p>
        <Link href="/" className="rounded-xl bg-[#06B6D4] px-4 py-2 text-xs font-semibold text-slate-950">
          Back to Catalogue
        </Link>
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
              subtopicTitle={activeSubtopic?.title}
              syllabusTitle={syllabus?.title}
            />
          </>
        )}
        {/* 5-Level Sidebar Navigation */}
        <SidebarTree
          syllabus={syllabus}
          activeSubtopicId={activeSubtopic?.id || null}
          onSelectSubtopic={handleSelectSubtopic}
          progressMap={progressMap}
        />

        {/* Main Workspace Pane */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          {/* Top Sticky Header */}
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#334155] bg-[#0B0F19]/90 px-6 py-3 backdrop-blur-md">
            <div className="flex items-center space-x-3">
              <Link
                href="/"
                className="inline-flex items-center space-x-1.5 text-xs text-[#94A3B8] hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Catalog</span>
              </Link>
              <span className="text-[#334155]">/</span>
              <span className="text-xs font-mono text-[#06B6D4] font-semibold">{syllabus.courseCode}</span>
            </div>

            <div className="flex items-center space-x-3">
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
              <div className="py-20 text-center text-[#94A3B8]">
                Select a subtopic from the 5-level hierarchy sidebar to view course content.
              </div>
            )}
          </main>
        </div>

        {/* Citations Side Drawer / Mobile Bottom Sheet */}
        <CitationsDrawer
          citation={activeCitation}
          onClose={() => setActiveCitation(null)}
        />
      </div>
    </ContentProtection>
  );
}
