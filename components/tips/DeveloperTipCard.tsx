"use client";

import React, { useState } from "react";
import { DeveloperTip, TipLanguage } from "@/types/tip";
import { 
  Check, 
  Copy, 
  Bookmark, 
  Share2, 
  ArrowRight, 
  Sparkles, 
  Code2, 
  Terminal, 
  Flame, 
  CheckCircle2, 
  XCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ImageIcon
} from "lucide-react";

interface DeveloperTipCardProps {
  tip: DeveloperTip;
  isBookmarked: boolean;
  onToggleBookmark: (tipId: string) => void;
  onOpenDeepDive: (tip: DeveloperTip) => void;
}

export const LANGUAGE_METADATA: Record<TipLanguage, { name: string; color: string; bg: string; border: string; icon: string }> = {
  python: { name: "Python", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", icon: "🐍" },
  typescript: { name: "TypeScript", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30", icon: "⚡" },
  javascript: { name: "JavaScript", color: "text-yellow-300", bg: "bg-yellow-500/10", border: "border-yellow-500/30", icon: "🟨" },
  dart: { name: "Dart / Flutter", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", icon: "🎯" },
  rust: { name: "Rust", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", icon: "🦀" },
  java: { name: "Java", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", icon: "☕" },
  sql: { name: "SQL & DB", color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/30", icon: "🗄️" },
  git: { name: "Git & CLI", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30", icon: "🐙" },
  cleancode: { name: "Clean Code", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: "🧠" },
  general: { name: "General Dev", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30", icon: "💡" }
};

export const DIFFICULTY_BADGES = {
  beginner: { label: "Beginner", bg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  intermediate: { label: "Intermediate", bg: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  pro: { label: "Pro Trick", bg: "bg-purple-500/15 text-purple-400 border-purple-500/30" }
};

export default function DeveloperTipCard({
  tip,
  isBookmarked,
  onToggleBookmark,
  onOpenDeepDive
}: DeveloperTipCardProps) {
  const [activeCodeTab, setActiveCodeTab] = useState<"good" | "bad">("good");
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const langMeta = LANGUAGE_METADATA[tip.language] || LANGUAGE_METADATA.general;
  const diffBadge = DIFFICULTY_BADGES[tip.difficulty] || DIFFICULTY_BADGES.beginner;

  const hasCode = Boolean(tip.goodCode || tip.badCode);
  const hasImages = Boolean(tip.images && tip.images.length > 0);
  const images = tip.images || [];

  const currentCode = activeCodeTab === "good" ? (tip.goodCode || "") : (tip.badCode || tip.goodCode || "");
  const currentTitle = activeCodeTab === "good" 
    ? (tip.goodCodeTitle || "Recommended Idiomatic Way") 
    : (tip.badCodeTitle || "Common Pitfall / Anti-Pattern");

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(currentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  const handleShare = async () => {
    try {
      const url = typeof window !== "undefined" 
        ? `${window.location.origin}/tips?id=${tip.id}` 
        : `/tips?id=${tip.id}`;
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2200);
    } catch (e) {}
  };

  return (
    <div className={`flex flex-col justify-between rounded-3xl border ${
      tip.isFeatured 
        ? "border-cyan-500/60 bg-gradient-to-b from-[#1E293B] via-[#0F172A] to-[#0B0F19] shadow-2xl ring-1 ring-cyan-500/30" 
        : "border-[#334155] bg-[#1E293B]/90 hover:border-[#06B6D4]/50 shadow-xl"
    } p-5 sm:p-6 transition-all duration-300 group relative overflow-hidden backdrop-blur-md`}>
      
      {/* Top ambient glow stripe */}
      <div className={`absolute top-0 left-0 right-0 h-1.5 ${
        tip.isFeatured
          ? "bg-gradient-to-r from-amber-400 via-cyan-400 to-purple-500"
          : "bg-gradient-to-r from-cyan-500/80 via-indigo-500/80 to-purple-500/80"
      }`} />

      <div>
        {/* Header Badges & Actions */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Language Badge */}
            <span className={`inline-flex items-center space-x-1.5 rounded-xl px-2.5 py-1 text-xs font-mono font-bold border ${langMeta.bg} ${langMeta.border} ${langMeta.color}`}>
              <span>{langMeta.icon}</span>
              <span>{langMeta.name}</span>
            </span>

            {/* Difficulty Badge */}
            <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-mono font-semibold border ${diffBadge.bg}`}>
              {diffBadge.label}
            </span>

            {/* Featured Badge */}
            {tip.isFeatured && (
              <span className="inline-flex items-center space-x-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider">
                <Sparkles className="h-3 w-3 text-amber-400 animate-pulse" />
                <span>Tip of the Day</span>
              </span>
            )}
          </div>

          {/* Quick Actions (Bookmark & Share) */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              onClick={handleShare}
              title={shared ? "Link Copied!" : "Share this tip"}
              className="p-2 rounded-xl text-[#94A3B8] hover:text-white bg-[#0B0F19]/60 hover:bg-[#0B0F19] border border-[#334155] transition-all relative"
            >
              {shared ? <Check className="h-4 w-4 text-emerald-400" /> : <Share2 className="h-4 w-4" />}
            </button>

            <button
              onClick={() => onToggleBookmark(tip.id)}
              title={isBookmarked ? "Remove Bookmark" : "Save Tip to Favorites"}
              className={`p-2 rounded-xl border transition-all ${
                isBookmarked
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-md"
                  : "bg-[#0B0F19]/60 hover:bg-[#0B0F19] border-[#334155] text-[#94A3B8] hover:text-white"
              }`}
            >
              <Bookmark className={`h-4 w-4 ${isBookmarked ? "fill-current" : ""}`} />
            </button>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight leading-snug group-hover:text-cyan-300 transition-colors">
          {tip.title}
        </h3>

        {/* Summary */}
        <p className="text-xs text-[#94A3B8] mt-2 line-clamp-2 leading-relaxed">
          {tip.summary}
        </p>

        {/* Media / Slideshow Carousel (If tip has images) */}
        {hasImages && (
          <div className="mt-4 rounded-2xl border border-[#334155] bg-[#0B0F19] overflow-hidden shadow-inner relative group/carousel">
            <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={images[currentImgIndex]}
                alt={tip.title}
                className="w-full h-full object-contain cursor-pointer transition-transform duration-300 hover:scale-[1.02]"
                onClick={() => onOpenDeepDive(tip)}
              />

              {/* Prev / Next Arrows if multiple slides */}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImgIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/70 hover:bg-cyan-500 text-white hover:text-slate-950 border border-white/20 transition-all opacity-80 hover:opacity-100 shadow-lg"
                    title="Previous Slide"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImgIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/70 hover:bg-cyan-500 text-white hover:text-slate-950 border border-white/20 transition-all opacity-80 hover:opacity-100 shadow-lg"
                    title="Next Slide"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  {/* Slide Counter Badge */}
                  <div className="absolute bottom-2 right-2 px-2.5 py-0.5 rounded-full bg-black/75 border border-white/20 text-[10px] font-mono text-cyan-300 backdrop-blur-md">
                    {currentImgIndex + 1} / {images.length} slides
                  </div>

                  {/* Indicator Dots */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center space-x-1">
                    {images.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentImgIndex(idx);
                        }}
                        className={`h-1.5 rounded-full transition-all ${
                          idx === currentImgIndex ? "w-4 bg-cyan-400" : "w-1.5 bg-white/40 hover:bg-white/80"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Optional Slide Caption */}
            {tip.imageCaptions && tip.imageCaptions[currentImgIndex] && (
              <div className="px-3 py-1.5 text-[11px] font-mono text-[#94A3B8] border-t border-[#334155]/60 bg-[#121826] truncate">
                {tip.imageCaptions[currentImgIndex]}
              </div>
            )}
          </div>
        )}

        {/* Interactive Code Box (If tip has code) */}
        {hasCode && (
          <div className="mt-4 rounded-2xl border border-[#334155] bg-[#0B0F19] overflow-hidden shadow-inner">
            {/* Code Header with Toggle Tabs & Copy Button */}
            <div className="flex items-center justify-between border-b border-[#334155] px-3 py-2 bg-[#121826]">
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => setActiveCodeTab("good")}
                  className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    activeCodeTab === "good"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                      : "text-[#94A3B8] hover:text-white"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Pro Way</span>
                </button>

                {tip.badCode && (
                  <button
                    type="button"
                    onClick={() => setActiveCodeTab("bad")}
                    className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      activeCodeTab === "bad"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm"
                        : "text-[#94A3B8] hover:text-white"
                    }`}
                  >
                    <XCircle className="h-3.5 w-3.5 text-rose-400" />
                    <span>Naive Way</span>
                  </button>
                )}
              </div>

              <button
                onClick={handleCopyCode}
                type="button"
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-mono text-[#94A3B8] hover:text-white bg-[#1E293B] border border-[#334155] hover:border-cyan-400/50 transition-all"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Code Body */}
            <div className="p-3.5 font-mono text-xs overflow-x-auto text-[#E2E8F0] leading-relaxed max-h-48 selection:bg-cyan-500/30">
              <pre>
                <code>{currentCode}</code>
              </pre>
            </div>

            {/* Sub-label under code */}
            <div className={`px-3 py-1.5 text-[11px] font-mono border-t border-[#334155]/60 flex items-center justify-between ${
              activeCodeTab === "good" ? "text-emerald-400/80 bg-emerald-950/20" : "text-rose-400/80 bg-rose-950/20"
            }`}>
              <span className="truncate">{currentTitle}</span>
              <span className="text-[10px] text-slate-500 uppercase">{tip.language}</span>
            </div>
          </div>
        )}

        {/* Pure Concept Card (If neither code nor images) */}
        {!hasCode && !hasImages && (
          <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 via-[#0B0F19] to-[#0F172A] p-4 text-xs text-[#CBD5E1] leading-relaxed shadow-inner">
            <span className="text-[11px] font-mono font-bold text-cyan-400 uppercase tracking-wider block mb-1.5 flex items-center space-x-1.5">
              <span>💡 Core Insight</span>
            </span>
            <p className="line-clamp-4 text-[#94A3B8]">
              {tip.whyItMatters || tip.explanation || tip.summary}
            </p>
          </div>
        )}

        {/* Tags */}
        {tip.tags && tip.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3.5">
            {tip.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-[#0B0F19] border border-[#334155]/70 px-2 py-0.5 text-[10px] font-mono text-[#94A3B8]"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer Details & Explore Button */}
      <div className="mt-5 pt-4 border-t border-[#334155] flex items-center justify-between gap-3">
        <span className="text-[11px] font-mono text-[#64748B]">
          {tip.authorName || "Faculty Instructor"}
        </span>

        <button
          onClick={() => onOpenDeepDive(tip)}
          className="inline-flex items-center space-x-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 hover:text-slate-950 px-3.5 py-1.5 text-xs font-bold font-mono transition-all border border-cyan-500/30 hover:border-cyan-400 active:scale-95"
        >
          <span>Deep Dive</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
