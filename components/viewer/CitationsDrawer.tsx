"use client";

import React from "react";
import { Citation } from "@/types/syllabus";
import { X, BookOpen, ExternalLink, BookmarkCheck, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  citation: Citation | null;
  onClose: () => void;
}

export default function CitationsDrawer({ citation, onClose }: Props) {
  return (
    <AnimatePresence>
      {citation && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm"
          />

          {/* Desktop Side Drawer (md:flex) & Mobile Bottom Sheet (default) */}
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-[#334155] bg-[#1E293B] p-6 shadow-2xl md:bottom-6 md:right-6 md:left-auto md:w-[420px] md:rounded-2xl md:border"
          >
            {/* Mobile Drag Indicator */}
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#334155] md:hidden" />

            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F59E0B]/20 text-[#F59E0B]">
                  <BookOpen className="w-4 h-4" />
                </span>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#F59E0B] font-mono">
                    Contextual Citation
                  </span>
                  <h3 className="text-xl font-bold text-white leading-tight">
                    {citation.term}
                  </h3>
                </div>
              </div>

              <button
                onClick={onClose}
                className="rounded-full bg-[#0B0F19] p-2 text-[#94A3B8] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-[#334155] bg-[#0B0F19] p-4 text-sm leading-relaxed text-[#CBD5E1]">
                <p>{citation.explanation}</p>
              </div>

              {citation.source && (
                <div className="flex items-center justify-between text-xs text-[#94A3B8] font-mono bg-[#0B0F19]/50 px-3 py-2 rounded-lg border border-[#334155]/60">
                  <span className="flex items-center space-x-1.5">
                    <BookmarkCheck className="w-3.5 h-3.5 text-[#06B6D4]" />
                    <span>Source: {citation.source}</span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#94A3B8]" />
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="inline-flex items-center text-[11px] font-mono text-[#06B6D4] bg-[#06B6D4]/10 px-2.5 py-1 rounded-full border border-[#06B6D4]/30">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Gemini Deep-Dive Term
                </span>
                <button
                  onClick={onClose}
                  className="rounded-lg bg-[#06B6D4] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0891B2] transition-colors"
                >
                  Got It
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
