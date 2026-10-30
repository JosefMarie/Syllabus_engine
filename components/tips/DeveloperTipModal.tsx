"use client";

import React, { useState } from "react";
import { DeveloperTip } from "@/types/tip";
import { LANGUAGE_METADATA, DIFFICULTY_BADGES } from "./DeveloperTipCard";
import { 
  X, 
  Copy, 
  Check, 
  Bookmark, 
  Share2, 
  ExternalLink, 
  CheckCircle2, 
  XCircle, 
  Lightbulb, 
  BookOpen, 
  Code2, 
  Sparkles 
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface DeveloperTipModalProps {
  tip: DeveloperTip | null;
  onClose: () => void;
  isBookmarked: boolean;
  onToggleBookmark: (tipId: string) => void;
}

export default function DeveloperTipModal({
  tip,
  onClose,
  isBookmarked,
  onToggleBookmark
}: DeveloperTipModalProps) {
  const [copiedGood, setCopiedGood] = useState(false);
  const [copiedBad, setCopiedBad] = useState(false);
  const [shared, setShared] = useState(false);

  if (!tip) return null;

  const langMeta = LANGUAGE_METADATA[tip.language] || LANGUAGE_METADATA.general;
  const diffBadge = DIFFICULTY_BADGES[tip.difficulty] || DIFFICULTY_BADGES.beginner;

  const handleCopy = async (code: string, isGood: boolean) => {
    try {
      await navigator.clipboard.writeText(code);
      if (isGood) {
        setCopiedGood(true);
        setTimeout(() => setCopiedGood(false), 2000);
      } else {
        setCopiedBad(true);
        setTimeout(() => setCopiedBad(false), 2000);
      }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="relative max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-[#334155] bg-[#0F172A] shadow-2xl flex flex-col">
        
        {/* Modal Top Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#334155] px-6 py-4 bg-[#1E293B]/70 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center space-x-1.5 rounded-xl px-2.5 py-1 text-xs font-mono font-bold border ${langMeta.bg} ${langMeta.border} ${langMeta.color}`}>
              <span>{langMeta.icon}</span>
              <span>{langMeta.name}</span>
            </span>

            <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-mono font-semibold border ${diffBadge.bg}`}>
              {diffBadge.label}
            </span>

            {tip.isFeatured && (
              <span className="inline-flex items-center space-x-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider">
                <Sparkles className="h-3 w-3 text-amber-400" />
                <span>Featured Tip</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleShare}
              title={shared ? "Link Copied!" : "Share Tip"}
              className="p-2 rounded-xl text-[#94A3B8] hover:text-white bg-[#0B0F19] border border-[#334155] hover:border-cyan-400/50 transition-all"
            >
              {shared ? <Check className="h-4 w-4 text-emerald-400" /> : <Share2 className="h-4 w-4" />}
            </button>

            <button
              onClick={() => onToggleBookmark(tip.id)}
              title={isBookmarked ? "Remove Bookmark" : "Save to Favorites"}
              className={`p-2 rounded-xl border transition-all ${
                isBookmarked 
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-400" 
                  : "bg-[#0B0F19] border-[#334155] text-[#94A3B8] hover:text-white"
              }`}
            >
              <Bookmark className={`h-4 w-4 ${isBookmarked ? "fill-current" : ""}`} />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#94A3B8] hover:text-white bg-[#0B0F19] border border-[#334155] hover:border-rose-500/40 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
              {tip.title}
            </h2>
            <p className="text-xs sm:text-sm text-[#CBD5E1] mt-2 leading-relaxed">
              {tip.summary}
            </p>
          </div>

          {/* Why It Matters Callout */}
          {tip.whyItMatters && (
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4 flex items-start space-x-3">
              <Lightbulb className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider block">
                  Why This Matters
                </span>
                <p className="text-xs text-[#CBD5E1] mt-1 leading-relaxed">
                  {tip.whyItMatters}
                </p>
              </div>
            </div>
          )}

          {/* Code Comparison Grid (Bad vs Good) */}
          <div className="space-y-4">
            <span className="text-xs font-mono font-bold text-[#94A3B8] uppercase tracking-wider block">
              Code Comparison
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Naive / Common Way */}
              {tip.badCode && (
                <div className="rounded-2xl border border-rose-500/30 bg-[#0B0F19] overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between border-b border-rose-500/20 px-4 py-2.5 bg-rose-950/30">
                    <span className="text-xs font-mono font-bold text-rose-400 flex items-center space-x-1.5">
                      <XCircle className="h-4 w-4" />
                      <span>{tip.badCodeTitle || "Common Naive Way"}</span>
                    </span>
                    <button
                      onClick={() => handleCopy(tip.badCode!, false)}
                      className="p-1 rounded text-slate-400 hover:text-white"
                      title="Copy code"
                    >
                      {copiedBad ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <div className="p-4 font-mono text-xs overflow-x-auto text-[#CBD5E1] leading-relaxed flex-1">
                    <pre><code>{tip.badCode}</code></pre>
                  </div>
                </div>
              )}

              {/* Idiomatic / Recommended Pro Way */}
              <div className={`rounded-2xl border border-emerald-500/30 bg-[#0B0F19] overflow-hidden flex flex-col ${
                !tip.badCode ? "md:col-span-2" : ""
              }`}>
                <div className="flex items-center justify-between border-b border-emerald-500/20 px-4 py-2.5 bg-emerald-950/30">
                  <span className="text-xs font-mono font-bold text-emerald-400 flex items-center space-x-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{tip.goodCodeTitle || "Recommended Pro Way"}</span>
                  </span>
                  <button
                    onClick={() => handleCopy(tip.goodCode, true)}
                    className="p-1 rounded text-slate-400 hover:text-white"
                    title="Copy code"
                  >
                    {copiedGood ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <div className="p-4 font-mono text-xs overflow-x-auto text-[#E2E8F0] leading-relaxed flex-1">
                  <pre><code>{tip.goodCode}</code></pre>
                </div>
              </div>
            </div>
          </div>

          {/* Deep Dive Explanation */}
          <div className="rounded-2xl border border-[#334155] bg-[#1E293B]/60 p-6 space-y-3">
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider block border-b border-[#334155] pb-2">
              Detailed Explanation &amp; Under the Hood
            </span>

            <div className="prose prose-invert prose-xs max-w-none text-xs text-[#CBD5E1] leading-relaxed space-y-3">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {tip.explanation}
              </ReactMarkdown>
            </div>
          </div>

          {/* Official Docs Link */}
          {tip.documentationUrl && (
            <div className="pt-2">
              <a
                href={tip.documentationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 text-xs font-mono text-cyan-400 hover:text-cyan-300 underline underline-offset-4"
              >
                <span>Read Official Documentation &amp; Specifications</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-[#334155] px-6 py-3.5 bg-[#1E293B]/70 flex items-center justify-between shrink-0">
          <span className="text-xs font-mono text-[#64748B]">
            Published by {tip.authorName || "Faculty Instructor"} &bull; {new Date(tip.createdAt).toLocaleDateString()}
          </span>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold font-mono text-white bg-slate-800 hover:bg-slate-700 border border-[#334155] transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
