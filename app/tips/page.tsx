"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { DeveloperTip, TipLanguage, TipDifficulty, TipCategory } from "@/types/tip";
import { getDeveloperTips, subscribeToDeveloperTips } from "@/lib/db";
import DeveloperTipCard, { LANGUAGE_METADATA } from "@/components/tips/DeveloperTipCard";
import DeveloperTipModal from "@/components/tips/DeveloperTipModal";
import SuggestionBoxModal from "@/components/common/SuggestionBoxModal";
import { 
  Sparkles, 
  Search, 
  Bookmark, 
  BookOpen, 
  Code2, 
  Flame, 
  ArrowLeft, 
  Layers, 
  Filter, 
  RotateCcw,
  SlidersHorizontal,
  X
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function TipsContent() {
  const searchParams = useSearchParams();
  const [tips, setTips] = useState<DeveloperTip[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [search, setSearch] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
  
  // Bookmarks saved in localStorage
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  
  // Active Deep Dive Modal
  const [activeModalTip, setActiveModalTip] = useState<DeveloperTip | null>(null);

  // Load bookmarks from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("saved_developer_tips");
        if (raw) setBookmarkedIds(JSON.parse(raw));
      } catch (e) {}
    }
  }, []);

  const handleToggleBookmark = (tipId: string) => {
    setBookmarkedIds((prev) => {
      const next = prev.includes(tipId) 
        ? prev.filter(id => id !== tipId) 
        : [...prev, tipId];
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("saved_developer_tips", JSON.stringify(next));
        } catch (e) {}
      }
      return next;
    });
  };

  // Load tips & subscribe
  useEffect(() => {
    const unsub = subscribeToDeveloperTips((data) => {
      setTips(data);
      setLoading(false);
    }, false);

    return () => unsub();
  }, []);

  // Direct link query param support: ?id=...
  useEffect(() => {
    const tipId = searchParams.get("id");
    if (tipId && tips.length > 0) {
      const found = tips.find(t => t.id === tipId);
      if (found) {
        setActiveModalTip(found);
      }
    }
  }, [searchParams, tips]);

  // Featured tip for the spotlight
  const featuredTip = useMemo(() => {
    return tips.find(t => t.isFeatured) || tips[0] || null;
  }, [tips]);

  // Filtered tips
  const filteredTips = useMemo(() => {
    return tips.filter((t) => {
      // Language filter
      if (selectedLanguage !== "all" && t.language !== selectedLanguage) return false;
      
      // Difficulty filter
      if (selectedDifficulty !== "all" && t.difficulty !== selectedDifficulty) return false;
      
      // Category filter
      if (selectedCategory !== "all" && t.category !== selectedCategory) return false;
      
      // Bookmarks filter
      if (showBookmarksOnly && !bookmarkedIds.includes(t.id)) return false;

      // Text search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesSummary = t.summary.toLowerCase().includes(q);
        const matchesTags = t.tags?.some(tag => tag.toLowerCase().includes(q));
        const matchesCode = (t.goodCode && t.goodCode.toLowerCase().includes(q)) || (t.badCode && t.badCode.toLowerCase().includes(q));
        const matchesExplanation = t.explanation?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesSummary && !matchesTags && !matchesCode && !matchesExplanation) return false;
      }

      return true;
    });
  }, [tips, selectedLanguage, selectedDifficulty, selectedCategory, showBookmarksOnly, bookmarkedIds, search]);

  const languagesList: TipLanguage[] = [
    "python", 
    "typescript", 
    "javascript", 
    "dart", 
    "rust", 
    "java", 
    "sql", 
    "git", 
    "cleancode"
  ];

  return (
    <div className="min-h-screen bg-[#070B14] text-[#E2E8F0] selection:bg-cyan-500/30 selection:text-white flex flex-col">
      {/* Top Ambient Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-cyan-500/10 via-purple-500/5 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-[#334155]/80 bg-[#070B14]/85 backdrop-blur-xl px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="inline-flex items-center space-x-1.5 text-xs font-mono font-semibold text-[#94A3B8] hover:text-white transition-colors bg-[#0B0F19] border border-[#334155] px-3 py-1.5 rounded-xl hover:border-cyan-400/50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Back to Platform</span>
          </Link>

          <div className="flex items-center space-x-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white font-black text-sm shadow-lg shadow-cyan-500/20">
              💡
            </span>
            <div>
              <h1 className="text-sm font-extrabold text-white tracking-tight">
                Developer Tips &amp; Insights
              </h1>
              <p className="text-[10px] text-[#94A3B8] font-mono hidden sm:block">
                Curated programming superpowers &bull; Publicly Accessible
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setShowBookmarksOnly(prev => !prev)}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold border transition-all ${
              showBookmarksOnly
                ? "bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-md"
                : "bg-[#0B0F19] border-[#334155] text-[#94A3B8] hover:text-white"
            }`}
          >
            <Bookmark className={`h-3.5 w-3.5 ${showBookmarksOnly ? "fill-current" : ""}`} />
            <span>Saved ({bookmarkedIds.length})</span>
          </button>

          <Link
            href="/admin"
            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-[#0B0F19] border border-[#334155] text-[#94A3B8] hover:text-cyan-400 hover:border-cyan-400/50 transition-all"
          >
            <span>Admin</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-8">
        
        {/* Hero Section */}
        <div className="relative rounded-3xl border border-[#334155] bg-gradient-to-r from-[#0F172A] via-[#1E293B]/70 to-[#0F172A] p-6 sm:p-10 shadow-2xl overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="max-w-2xl space-y-3 relative z-10">
            <div className="inline-flex items-center space-x-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-mono text-cyan-300">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Free Engineering Knowledge Hub</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              Level Up Your Code with Daily Developer Tips
            </h2>

            <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
              Explore bite-sized pro tricks, idiomatic syntax patterns, terminal wizardry, and performance optimizations across modern languages.
            </p>
          </div>

          {/* Quick Search Bar inside Hero */}
          <div className="mt-6 max-w-xl relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search tips, code snippets, tags (e.g. python, async, git)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl bg-[#0B0F19]/90 border border-[#334155] pl-10 pr-10 py-3 text-xs sm:text-sm text-white placeholder-[#64748B] focus:border-cyan-400 focus:outline-none shadow-inner"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Navigation Bar */}
        <div className="space-y-3">
          {/* Language Chips */}
          <div className="flex items-center overflow-x-auto gap-2 pb-2 scrollbar-none">
            <button
              onClick={() => setSelectedLanguage("all")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all shrink-0 border ${
                selectedLanguage === "all"
                  ? "bg-cyan-400 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20"
                  : "bg-[#0B0F19] text-[#94A3B8] border-[#334155] hover:text-white hover:border-[#475569]"
              }`}
            >
              All Languages
            </button>

            {languagesList.map((lang) => {
              const meta = LANGUAGE_METADATA[lang];
              const isSelected = selectedLanguage === lang;
              return (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(lang)}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all shrink-0 border ${
                    isSelected
                      ? `${meta.bg} ${meta.border} ${meta.color} font-bold shadow-md`
                      : "bg-[#0B0F19] text-[#94A3B8] border-[#334155] hover:text-white hover:border-[#475569]"
                  }`}
                >
                  <span>{meta.icon}</span>
                  <span>{meta.name}</span>
                </button>
              );
            })}
          </div>

          {/* Secondary Sub-Filters (Difficulty, Category, Active Count) */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-[#334155]/60 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {/* Difficulty Dropdown */}
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="rounded-xl bg-[#0B0F19] border border-[#334155] px-3 py-1.5 text-xs font-mono text-[#CBD5E1] focus:border-cyan-400 focus:outline-none"
              >
                <option value="all">All Difficulties</option>
                <option value="beginner">Beginner Friendly</option>
                <option value="intermediate">Intermediate</option>
                <option value="pro">Pro Tricks</option>
              </select>

              {/* Category Dropdown */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-xl bg-[#0B0F19] border border-[#334155] px-3 py-1.5 text-xs font-mono text-[#CBD5E1] focus:border-cyan-400 focus:outline-none"
              >
                <option value="all">All Categories</option>
                <option value="syntax">Syntax Superpowers</option>
                <option value="performance">Performance &amp; Scale</option>
                <option value="best-practices">Clean Code Practices</option>
                <option value="tooling">Git &amp; CLI Tooling</option>
                <option value="architecture">Architecture &amp; Design</option>
              </select>

              {(selectedLanguage !== "all" || selectedDifficulty !== "all" || selectedCategory !== "all" || showBookmarksOnly || search) && (
                <button
                  onClick={() => {
                    setSelectedLanguage("all");
                    setSelectedDifficulty("all");
                    setSelectedCategory("all");
                    setShowBookmarksOnly(false);
                    setSearch("");
                  }}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-mono text-rose-400 hover:text-rose-300 bg-rose-500/10 border border-rose-500/30"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>

            <span className="text-xs font-mono text-[#64748B]">
              Showing <strong className="text-white">{filteredTips.length}</strong> of {tips.length} tips
            </span>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="rounded-3xl border border-[#334155] bg-[#1E293B]/40 p-16 text-center text-xs font-mono text-[#94A3B8]">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent mb-3" />
            Loading developer knowledge cards...
          </div>
        ) : filteredTips.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#334155] bg-[#1E293B]/20 p-16 text-center space-y-3">
            <Code2 className="mx-auto h-12 w-12 text-[#64748B]" />
            <h3 className="text-base font-bold text-white">No developer tips matched your filters</h3>
            <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
              Try adjusting your search query, difficulty, or language selection to discover more cards.
            </p>
          </div>
        ) : (
          /* Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTips.map((tip) => (
              <DeveloperTipCard
                key={tip.id}
                tip={tip}
                isBookmarked={bookmarkedIds.includes(tip.id)}
                onToggleBookmark={handleToggleBookmark}
                onOpenDeepDive={(t) => setActiveModalTip(t)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#334155]/80 py-8 text-center text-xs text-[#64748B] font-mono mt-12 bg-[#070B14]">
        <p>Built for students, aspiring engineers, and passionate programmers &bull; Updated weekly</p>
      </footer>

      {/* Interactive Deep Dive Modal */}
      <DeveloperTipModal
        tip={activeModalTip}
        onClose={() => setActiveModalTip(null)}
        isBookmarked={activeModalTip ? bookmarkedIds.includes(activeModalTip.id) : false}
        onToggleBookmark={handleToggleBookmark}
      />

      {/* Floating Suggestion Box */}
      <SuggestionBoxModal />
    </div>
  );
}

export default function TipsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#070B14] flex items-center justify-center text-cyan-400 text-xs font-mono">
        Loading Developer Hub...
      </div>
    }>
      <TipsContent />
    </Suspense>
  );
}
