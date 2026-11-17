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
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-[#2E2E34] bg-[#1C1C1F] p-6 shadow-2xl md:bottom-6 md:right-6 md:left-auto md:w-[420px] md:rounded-2xl md:border"
          >
            {/* Mobile Drag Indicator */}
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#2E2E34] md:hidden" />

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
                className="rounded-full bg-[#141416] p-2 text-[#A1A1AA] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-[#2E2E34] bg-[#141416] p-4 text-sm leading-relaxed text-[#EAEAE6]">
                <p>{citation.explanation}</p>
              </div>

              {citation.source && (
                <div className="flex items-center justify-between text-xs text-[#A1A1AA] font-mono bg-[#141416]/50 px-3 py-2 rounded-lg border border-[#2E2E34]/60">
                  <span className="flex items-center space-x-1.5">
                    <BookmarkCheck className="w-3.5 h-3.5 text-[#EAEAE6]" />
                    <span>Source: {citation.source}</span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#A1A1AA]" />
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="inline-flex items-center text-[11px] font-mono text-[#EAEAE6] bg-[#EAEAE6]/10 px-2.5 py-1 rounded-full border border-[#EAEAE6]/30">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Gemini Deep-Dive Term
                </span>
                <button
                  onClick={onClose}
                  className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold text-[#141416] hover:bg-emerald-400 transition-colors"
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
