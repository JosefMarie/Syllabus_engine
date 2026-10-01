"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, 
  BookOpen, 
  FileQuestion, 
  Users, 
  Layers, 
  Award, 
  Sparkles, 
  ShieldCheck, 
  Sliders, 
  X, 
  ArrowRight,
  CornerDownLeft,
  Command
} from "lucide-react";
import { Syllabus } from "@/types/syllabus";
import { getAllSyllabi, getLocalSyllabi } from "@/lib/db";
import { getStoredSession, getAdminSession } from "@/lib/auth";

interface PaletteItem {
  id: string;
  title: string;
  subtitle?: string;
  category: "Courses" | "Student Portal" | "Instructor & Admin" | "Navigation";
  icon: React.ElementType;
  url?: string;
  action?: () => void;
  badge?: string;
}

export default function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load initial local syllabi
    setSyllabi(getLocalSyllabi());
    getAllSyllabi().then(setSyllabi).catch(() => {});

    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle palette on Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      // Close on Escape
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  const studentUser = getStoredSession();
  const adminUser = getAdminSession();

  // Build static navigation items
  const baseItems: PaletteItem[] = [
    {
      id: "nav-courses",
      title: "Course Catalog & Syllabus Viewer",
      subtitle: "Browse all accredited syllabus modules and study notes",
      category: "Navigation",
      icon: BookOpen,
      action: () => router.push("/")
    },
    {
      id: "nav-exams",
      title: "Examinations & Quizzes",
      subtitle: "View active exams, time-limits, and question attempts",
      category: "Student Portal",
      icon: FileQuestion,
      badge: "Student",
      action: () => router.push("/?tab=exams")
    },
    {
      id: "nav-assignments",
      title: "Course Assignments & Homework",
      subtitle: "Submit individual and group deliverables",
      category: "Student Portal",
      icon: Layers,
      badge: "Student",
      action: () => router.push("/?tab=assignments")
    },
    {
      id: "nav-groups",
      title: "Study Teams & Group Presentations",
      subtitle: "Manage teams, view PowerPoint defense scores and feedback",
      category: "Student Portal",
      icon: Users,
      badge: "Student",
      action: () => router.push("/?tab=groups")
    },
    {
      id: "nav-defense-marks",
      title: "Presentation Defense Marks",
      subtitle: "Check dual group/individual marks and instructor critique",
      category: "Student Portal",
      icon: Award,
      badge: "Defense",
      action: () => router.push("/?tab=groups&sub=evaluations")
    }
  ];

  if (adminUser || !studentUser) {
    baseItems.push(
      {
        id: "nav-admin",
        title: "Instructor Control Panel",
        subtitle: "Class overview, live presence, approvals & restrictions",
        category: "Instructor & Admin",
        icon: ShieldCheck,
        badge: "Admin",
        action: () => router.push("/admin")
      },
      {
        id: "nav-admin-builder",
        title: "Syllabus Curriculum Builder",
        subtitle: "Create, edit, and organize 5-level curriculum structures",
        category: "Instructor & Admin",
        icon: Sparkles,
        badge: "Admin",
        action: () => router.push("/admin/builder")
      },
      {
        id: "nav-admin-groups",
        title: "Group Management & Live Presentation Grader",
        subtitle: "Live dual-grading classroom defense for PowerPoint pitches",
        category: "Instructor & Admin",
        icon: Sliders,
        badge: "Admin",
        action: () => router.push("/admin?tab=groups")
      }
    );
  }

  // Add Dynamic Syllabi items
  const courseItems: PaletteItem[] = syllabi.map((s) => ({
    id: `course-${s.id}`,
    title: `${s.courseCode}: ${s.title}`,
    subtitle: `${s.level || "Class"} • ${s.learningOutcomes?.length || 0} Learning Outcomes • ${s.description?.substring(0, 70) || ""}...`,
    category: "Courses",
    icon: BookOpen,
    badge: s.level || "Course",
    action: () => router.push(`/syllabus/${s.id}`)
  }));

  const allItems = [...baseItems, ...courseItems];

  const filteredItems = query.trim()
    ? allItems.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.subtitle?.toLowerCase().includes(query.toLowerCase()) ||
          item.category.toLowerCase().includes(query.toLowerCase())
      )
    : allItems;

  const handleSelect = (item: PaletteItem) => {
    setIsOpen(false);
    if (item.action) {
      item.action();
    } else if (item.url) {
      router.push(item.url);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === "Enter" && filteredItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(filteredItems[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-md pt-[12vh] px-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-cyan-500/40 bg-[#1E293B]/85 backdrop-blur-2xl shadow-2xl shadow-cyan-950/40"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#334155]/70 bg-[#0B0F19]/50 backdrop-blur-md">
          <Search className="h-5 w-5 text-cyan-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Type a command, course code, topic, or destination..."
            className="w-full bg-transparent text-sm text-white placeholder-[#64748B] focus:outline-none"
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              className="text-[#64748B] hover:text-white p-1 rounded-md"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded bg-[#1E293B]/80 px-2 py-0.5 text-[10px] font-mono text-[#94A3B8] border border-[#334155]/70">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#94A3B8]">
              No results found for <strong className="text-white">&quot;{query}&quot;</strong>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = item.icon;

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 cursor-pointer transition-all ${
                    isSelected
                      ? "bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-white border border-cyan-500/40"
                      : "text-[#CBD5E1] hover:bg-[#1E293B]/70 border border-transparent"
                  }`}
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                      isSelected ? "bg-cyan-500/30 text-cyan-300" : "bg-[#1E293B] text-[#94A3B8]"
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="truncate">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white truncate">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                            item.badge === "Admin"
                              ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                              : item.badge === "Defense"
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                              : "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className="text-[11px] text-[#94A3B8] truncate">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <div className="flex items-center space-x-1 text-[10px] text-cyan-300 font-mono shrink-0 ml-2">
                      <span>Jump</span>
                      <CornerDownLeft className="h-3 w-3" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Helper */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-[#334155]/60 bg-[#0B0F19]/50 backdrop-blur-md text-[10px] text-[#64748B]">
          <div className="flex items-center space-x-3">
            <span>&uarr;&darr; Navigate</span>
            <span>&crarr; Select</span>
            <span>ESC Close</span>
          </div>
          <div className="flex items-center space-x-1">
            <Command className="h-3 w-3" />
            <span>+ K to open anywhere</span>
          </div>
        </div>
      </div>
    </div>
  );
}
