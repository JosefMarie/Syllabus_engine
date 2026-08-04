"use client";

import React, { useEffect, useState } from "react";
import { Syllabus, Subtopic, Citation } from "@/types/syllabus";
import { getSyllabusById, getSubtopicProgress, toggleSubtopicProgress, logActivity } from "@/lib/db";
import { getStoredSession } from "@/lib/auth";
import SidebarTree from "@/components/viewer/SidebarTree";
import SubtopicView from "@/components/viewer/SubtopicView";
import CitationsDrawer from "@/components/viewer/CitationsDrawer";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function StudentViewerClient({ syllabusId }: { syllabusId: string }) {
  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [activeSubtopic, setActiveSubtopic] = useState<Subtopic | null>(null);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  // Flattened array of all subtopics for easy previous/next pagination
  const [allSubtopics, setAllSubtopics] = useState<Subtopic[]>([]);

  useEffect(() => {
    async function load() {
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
          trackSubtopicView(list[0], data);
        }
      }
      setLoading(false);
    }
    load();
  }, [syllabusId]);

  const trackSubtopicView = (sub: Subtopic, syl?: Syllabus | null) => {
    const s = syl || syllabus;
    const user = getStoredSession();
    logActivity({
      userId: user?.uid || "guest",
      userName: user?.fullName || "Guest Student",
      userEmail: user?.email || "guest@student.edu",
      userLevel: user?.level || "Guest",
      action: "VIEW_SUBTOPIC",
      details: `Viewed subtopic "${sub.title}" in ${s?.title || 'Syllabus'}`,
      syllabusId: s?.id,
      syllabusTitle: s?.title
    });
  };

  const handleSelectSubtopic = (sub: Subtopic) => {
    setActiveSubtopic(sub);
    trackSubtopicView(sub);
  };

  const handleToggleComplete = (subtopicId: string) => {
    const updated = toggleSubtopicProgress(subtopicId);
    setProgressMap((prev) => ({ ...prev, [subtopicId]: updated }));

    const user = getStoredSession();
    if (activeSubtopic) {
      logActivity({
        userId: user?.uid || "guest",
        userName: user?.fullName || "Guest Student",
        userEmail: user?.email || "guest@student.edu",
        userLevel: user?.level || "Guest",
        action: "VIEW_SUBTOPIC",
        details: `${updated ? 'Marked as Completed' : 'Unmarked'}: "${activeSubtopic.title}"`,
        syllabusId: syllabus?.id,
        syllabusTitle: syllabus?.title
      });
    }
  };

  const currentIdx = activeSubtopic ? allSubtopics.findIndex((s) => s.id === activeSubtopic.id) : -1;
  const prevSubtopic = currentIdx > 0 ? allSubtopics[currentIdx - 1] : undefined;
  const nextSubtopic = currentIdx >= 0 && currentIdx < allSubtopics.length - 1 ? allSubtopics[currentIdx + 1] : undefined;

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

  return (
    <div className="flex h-screen overflow-hidden bg-[#0B0F19] text-[#CBD5E1]">
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
            <Link
              href={`/admin/builder?id=${syllabus.id}`}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-[#334155] bg-[#1E293B] px-3 py-1.5 text-xs font-semibold text-white hover:border-[#06B6D4] transition-all"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-[#06B6D4]" />
              <span className="hidden sm:inline">Edit in Admin Portal</span>
            </Link>
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
  );
}
