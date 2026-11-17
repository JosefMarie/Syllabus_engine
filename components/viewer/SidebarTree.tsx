"use client";

import React, { useState } from "react";
import { Syllabus, Subtopic } from "@/types/syllabus";
import { 
  ChevronRight, 
  ChevronDown, 
  CheckCircle2, 
  Circle, 
  BookOpen, 
  Search, 
  Menu, 
  X,
  Layers,
  FolderGit2,
  FileCode2,
  Award
} from "lucide-react";
import Link from "next/link";

interface Props {
  syllabus: Syllabus;
  activeSubtopicId: string | null;
  onSelectSubtopic: (subtopic: Subtopic) => void;
  progressMap: Record<string, boolean>;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

export default function SidebarTree({
  syllabus,
  activeSubtopicId,
  onSelectSubtopic,
  progressMap,
  mobileOpen: externalMobileOpen,
  onMobileOpenChange,
}: Props) {
  const [internalMobileOpen, setInternalMobileOpen] = useState(false);
  const isDrawerOpen = externalMobileOpen !== undefined ? externalMobileOpen : internalMobileOpen;
  const setDrawerOpen = (open: boolean) => {
    if (onMobileOpenChange) {
      onMobileOpenChange(open);
    } else {
      setInternalMobileOpen(open);
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  
  // Safely extract first identifiers with complete optional chaining to prevent undefined[0] runtime errors
  const firstLOId = syllabus?.learningOutcomes?.[0]?.id || "";
  const firstICId = syllabus?.learningOutcomes?.[0]?.indicativeContents?.[0]?.id || "";
  const firstTopicId = syllabus?.learningOutcomes?.[0]?.indicativeContents?.[0]?.topics?.[0]?.id || "";

  // Expanded state maps for levels 2, 3, 4
  const [expandedLOs, setExpandedLOs] = useState<Record<string, boolean>>({
    [firstLOId]: true,
  });
  const [expandedICs, setExpandedICs] = useState<Record<string, boolean>>({
    [firstICId]: true,
  });
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({
    [firstTopicId]: true,
  });

  const toggleLO = (id: string) => {
    setExpandedLOs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleIC = (id: string) => {
    setExpandedICs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleTopic = (id: string) => {
    setExpandedTopics((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Compute overall progress defensively
  let totalSubtopics = 0;
  let completedSubtopics = 0;

  (syllabus?.learningOutcomes || []).forEach((lo) => {
    (lo?.indicativeContents || []).forEach((ic) => {
      (ic?.topics || []).forEach((top) => {
        (top?.subtopics || []).forEach((sub) => {
          totalSubtopics++;
          if (progressMap?.[sub?.id]) completedSubtopics++;
        });
      });
    });
  });

  const percentComplete = totalSubtopics > 0 ? Math.round((completedSubtopics / totalSubtopics) * 100) : 0;
  const courseCodeDisplay = syllabus?.courseCode || "SYL";
  const courseTitleDisplay = syllabus?.title || "Syllabus";

  const contentTree = (
    <div className="flex h-full flex-col bg-[#1C1C1F]/80 backdrop-blur-xl border-r border-[#2E2E34]/60 text-[#EAEAE6]">
      {/* Syllabus Header */}
      <div className="border-b border-[#2E2E34]/60 p-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2 text-white hover:text-[#EAEAE6] transition-colors">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAEAE6] text-xs font-bold font-mono text-[#141416]">
              {courseCodeDisplay.slice(0, 3)}
            </span>
            <span className="text-sm font-bold font-mono tracking-tight">{courseCodeDisplay}</span>
          </Link>
          <div className="flex items-center space-x-2">
            <span className="rounded-full bg-[#EAEAE6]/10 px-2 py-0.5 text-[10px] font-mono text-[#EAEAE6] border border-[#EAEAE6]/30">
              {percentComplete}% Complete
            </span>
            <button
              onClick={() => setDrawerOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-[#2E2E34] hover:text-white lg:hidden transition-colors"
              title="Close Syllabus Outline"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <h2 className="mt-2 text-base font-bold text-white leading-snug line-clamp-2">
          {courseTitleDisplay}
        </h2>
        
        {/* Progress Bar */}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#141416]">
          <div 
            className="h-full bg-gradient-to-r from-[#EAEAE6] to-[#10B981] transition-all duration-300" 
            style={{ width: `${percentComplete}%` }}
          />
        </div>

        {/* Filter Search */}
        <div className="relative mt-3">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#A1A1AA]" />
          <input 
            type="text"
            placeholder="Search 5-level hierarchy..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-[#2E2E34]/60 bg-[#141416]/50 backdrop-blur-md py-1.5 pl-8 pr-3 text-xs text-white placeholder-[#A1A1AA] focus:border-[#EAEAE6] focus:outline-none"
          />
        </div>
      </div>

      {/* 5-Level Nested Tree */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {(syllabus?.learningOutcomes || []).length === 0 ? (
          <div className="p-4 text-center text-xs text-[#A1A1AA] font-mono">
            No learning outcomes defined in this syllabus yet.
          </div>
        ) : (
          (syllabus?.learningOutcomes || []).map((lo) => {
            const isLOOpen = Boolean(expandedLOs[lo.id] || searchQuery.length > 0);
            return (
              <div key={lo.id} className="rounded-xl border border-[#2E2E34]/60 bg-[#141416]/40 backdrop-blur-sm overflow-hidden">
                {/* Level 2: Learning Outcome (LO) Header */}
                <button
                  onClick={() => toggleLO(lo.id)}
                  className="flex w-full items-center justify-between p-2.5 text-left hover:bg-[#1C1C1F]/70 transition-colors"
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    {isLOOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-[#EAEAE6]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#A1A1AA]" />
                    )}
                    <Award className="h-4 w-4 shrink-0 text-[#EAEAE6]" />
                    <span className="text-xs font-bold text-white truncate">
                      <span className="text-[#EAEAE6] font-mono mr-1.5">{lo.code || 'LO'}:</span>
                      {lo.title}
                    </span>
                  </div>
                </button>

                {/* Level 3: Indicative Content (IC) */}
                {isLOOpen && (
                  <div className="border-t border-[#2E2E34]/40 pl-2 pr-1 py-1 space-y-1.5">
                    {(lo?.indicativeContents || []).map((ic) => {
                      const isICOpen = Boolean(expandedICs[ic.id] || searchQuery.length > 0);
                      return (
                        <div key={ic.id} className="ml-2 rounded-lg border-l-2 border-[#EAEAE6]/40 bg-[#1C1C1F]/30 backdrop-blur-xs">
                          <button
                            onClick={() => toggleIC(ic.id)}
                            className="flex w-full items-center justify-between p-2 text-left hover:bg-[#1C1C1F]/70 transition-colors"
                          >
                            <div className="flex items-center space-x-2 min-w-0">
                              {isICOpen ? (
                                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#F59E0B]" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#A1A1AA]" />
                              )}
                              <FolderGit2 className="h-3.5 w-3.5 shrink-0 text-[#F59E0B]" />
                              <span className="text-xs font-semibold text-[#EAEAE6] truncate">
                                <span className="text-[#F59E0B] font-mono mr-1">{ic.code || 'IC'}:</span>
                                {ic.title}
                              </span>
                            </div>
                          </button>

                          {/* Level 4: Topic */}
                          {isICOpen && (
                            <div className="pl-3 pr-1 py-1 space-y-1">
                              {(ic?.topics || []).map((top) => {
                                const isTopicOpen = Boolean(expandedTopics[top.id] || searchQuery.length > 0);
                                return (
                                  <div key={top.id} className="ml-2 border-l border-[#2E2E34] pl-2">
                                    <button
                                      onClick={() => toggleTopic(top.id)}
                                      className="flex w-full items-center justify-between py-1 text-left hover:text-white"
                                    >
                                      <div className="flex items-center space-x-1.5 min-w-0">
                                        {isTopicOpen ? (
                                          <ChevronDown className="h-3 w-3 shrink-0 text-[#A1A1AA]" />
                                        ) : (
                                          <ChevronRight className="h-3 w-3 shrink-0 text-[#71717A]" />
                                        )}
                                        <Layers className="h-3 w-3 shrink-0 text-[#A1A1AA]" />
                                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#A1A1AA] truncate">
                                          {top.title}
                                        </span>
                                      </div>
                                    </button>

                                    {/* Level 5: Subtopic */}
                                    {isTopicOpen && (
                                      <div className="mt-1 space-y-0.5 pl-2">
                                        {(top?.subtopics || [])
                                          .filter((s) => !searchQuery || (s?.title || "").toLowerCase().includes(searchQuery.toLowerCase()))
                                          .map((sub) => {
                                            const isActive = activeSubtopicId === sub.id;
                                            const isCompleted = Boolean(progressMap?.[sub.id]);

                                            return (
                                              <button
                                                key={sub.id}
                                                onClick={() => {
                                                  onSelectSubtopic(sub);
                                                  setDrawerOpen(false);
                                                }}
                                                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-all ${
                                                  isActive
                                                    ? "bg-[#EAEAE6]/15 text-[#EAEAE6] font-medium border-l-2 border-[#EAEAE6]"
                                                    : "text-[#EAEAE6] hover:bg-[#2E2E34]/40 hover:text-white"
                                                }`}
                                              >
                                                <div className="flex items-center space-x-2 truncate">
                                                  <FileCode2 className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-[#EAEAE6]" : "text-[#A1A1AA]"}`} />
                                                  <span className="truncate">{sub.title}</span>
                                                </div>
                                                {isCompleted ? (
                                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#10B981]" />
                                                ) : (
                                                  <Circle className="h-3.5 w-3.5 shrink-0 text-[#2E2E34]" />
                                                )}
                                              </button>
                                            );
                                          })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Permanent on lg+ viewports) */}
      <div className="hidden h-screen w-80 shrink-0 border-r border-[#2E2E34] lg:block">
        {contentTree}
      </div>

      {/* Mobile & Tablet Slide-Out Drawer (< lg viewports) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div 
            className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity" 
            onClick={() => setDrawerOpen(false)} 
          />
          <div className="relative z-50 w-80 max-w-[85vw] h-full bg-[#1C1C1F]/95 backdrop-blur-2xl shadow-2xl flex flex-col animate-in slide-in-from-left duration-200 border-r border-[#2E2E34]/70">
            {contentTree}
          </div>
        </div>
      )}
    </>
  );
}
