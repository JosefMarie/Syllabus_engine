"use client";

import React, { useState } from "react";
import { UserProfile } from "@/types/auth";
import { StudentSuggestion, SuggestionCategory } from "@/types/suggestion";
import { saveSuggestion } from "@/lib/db";
import { 
  MessageSquarePlus, 
  X, 
  Send, 
  CheckCircle2, 
  Lightbulb, 
  BookOpen, 
  Bug, 
  Sparkles, 
  Shield, 
  User,
  Heart
} from "lucide-react";

interface SuggestionBoxModalProps {
  currentUser?: UserProfile | null;
}

export const SUGGESTION_CATEGORIES: Record<SuggestionCategory, { label: string; icon: string; description: string; color: string; border: string; bg: string }> = {
  feature_request: {
    label: "Feature Request",
    icon: "💡",
    description: "Suggest a new tool, calculator, or feature for the app",
    color: "text-amber-400",
    border: "border-amber-500/40",
    bg: "bg-amber-500/10"
  },
  course_content: {
    label: "Course / Syllabus",
    icon: "📚",
    description: "Propose topic additions or corrections in course modules",
    color: "text-cyan-400",
    border: "border-cyan-500/40",
    bg: "bg-cyan-500/10"
  },
  dev_tip_request: {
    label: "Dev Tip Request",
    icon: "💻",
    description: "Request a specific programming language or framework tip",
    color: "text-purple-400",
    border: "border-purple-500/40",
    bg: "bg-purple-500/10"
  },
  bug_report: {
    label: "Bug Report",
    icon: "🐛",
    description: "Report an issue, visual glitch, or broken link",
    color: "text-rose-400",
    border: "border-rose-500/40",
    bg: "bg-rose-500/10"
  },
  general_feedback: {
    label: "General Feedback",
    icon: "💬",
    description: "Share thoughts, feedback, or appreciation for faculty",
    color: "text-emerald-400",
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10"
  }
};

export default function SuggestionBoxModal({ currentUser }: SuggestionBoxModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<SuggestionCategory>("feature_request");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    setSubmitting(true);
    try {
      const suggestionPayload: StudentSuggestion = {
        id: `sug_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        category,
        title: title.trim(),
        message: message.trim(),
        isAnonymous,
        studentName: isAnonymous 
          ? "Anonymous Student" 
          : (currentUser ? currentUser.fullName : (guestName.trim() || "Guest Visitor")),
        studentEmail: isAnonymous 
          ? undefined 
          : (currentUser?.email || (guestEmail.trim() || undefined)),
        studentUid: isAnonymous ? undefined : currentUser?.uid,
        studentLevel: isAnonymous ? undefined : currentUser?.level,
        studentTradeId: isAnonymous ? undefined : currentUser?.tradeId,
        status: "new",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await saveSuggestion(suggestionPayload);
      setIsSuccess(true);
      setTitle("");
      setMessage("");
    } catch (err) {
      console.error("Failed to submit suggestion:", err);
      alert("Error sending suggestion. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setIsSuccess(false);
    }, 300);
  };

  return (
    <>
      {/* Floating Action Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        type="button"
        title="Submit a suggestion or feedback"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center space-x-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 px-4 py-3 text-xs font-bold text-white shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 ring-2 ring-cyan-400/40 group backdrop-blur-md"
      >
        <span className="text-base group-hover:rotate-12 transition-transform">💡</span>
        <span className="hidden sm:inline">Suggestion Box</span>
      </button>

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="relative max-h-[92vh] w-full max-w-xl overflow-hidden rounded-3xl border border-[#334155] bg-[#0F172A] shadow-2xl flex flex-col">
            
            {/* Top Accent Stripe */}
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-cyan-400 to-purple-500" />

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#334155] px-6 py-4 bg-[#1E293B]/70 shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500/20 to-cyan-500/20 border border-cyan-500/40 text-cyan-400 shadow-inner">
                  <MessageSquarePlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Suggestion &amp; Feedback Box</h3>
                  <p className="text-[11px] text-[#94A3B8] font-mono">Direct line to teachers &amp; engineering staff</p>
                </div>
              </div>

              <button
                onClick={resetAndClose}
                className="p-1.5 rounded-xl text-[#94A3B8] hover:text-white bg-[#0B0F19] border border-[#334155] hover:border-rose-500/40 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            {isSuccess ? (
              <div className="p-8 sm:p-12 text-center space-y-4 flex flex-col items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-xl animate-bounce">
                  <CheckCircle2 className="h-8 w-8" />
                </div>

                <h4 className="text-xl font-extrabold text-white">Suggestion Received!</h4>
                <p className="text-xs text-[#CBD5E1] max-w-sm leading-relaxed">
                  Thank you for contributing to our academic community! Your feedback has been safely submitted to the instructor portal for review.
                </p>

                <div className="pt-4 flex items-center space-x-3">
                  <button
                    onClick={() => setIsSuccess(false)}
                    className="px-4 py-2 rounded-xl text-xs font-mono font-bold text-[#CBD5E1] bg-[#1E293B] border border-[#334155] hover:text-white transition-all"
                  >
                    Submit Another
                  </button>

                  <button
                    onClick={resetAndClose}
                    className="px-6 py-2 rounded-xl text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-500 transition-all shadow-lg active:scale-95"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Category Selection */}
                <div>
                  <label className="text-xs font-mono text-[#94A3B8] block mb-2">
                    Select Suggestion Category:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(Object.keys(SUGGESTION_CATEGORIES) as SuggestionCategory[]).map((catKey) => {
                      const item = SUGGESTION_CATEGORIES[catKey];
                      const isSelected = category === catKey;
                      return (
                        <button
                          key={catKey}
                          type="button"
                          onClick={() => setCategory(catKey)}
                          className={`flex items-center space-x-2 p-2.5 rounded-xl border text-left transition-all ${
                            isSelected
                              ? `${item.bg} ${item.border} ${item.color} font-bold ring-1 ring-cyan-400/50 shadow-md`
                              : "bg-[#0B0F19] border-[#334155] text-[#94A3B8] hover:text-white hover:border-[#475569]"
                          }`}
                        >
                          <span className="text-base">{item.icon}</span>
                          <span className="text-xs truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="text-xs font-mono text-[#94A3B8] block mb-1">
                    Suggestion Summary / Subject *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Could we add a developer tip explaining Docker containers?"
                    className="w-full rounded-xl bg-[#0B0F19] border border-[#334155] px-3.5 py-2.5 text-xs text-white placeholder-[#64748B] focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="text-xs font-mono text-[#94A3B8] block mb-1">
                    Detailed Message &amp; Explanation *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Share any context, how this will help your learning, or details about the issue..."
                    className="w-full rounded-xl bg-[#0B0F19] border border-[#334155] p-3 text-xs text-white placeholder-[#64748B] focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                {/* Anonymous Toggle & Identity */}
                <div className="rounded-2xl border border-[#334155] bg-[#0B0F19] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center space-x-2 text-xs font-mono text-[#CBD5E1] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAnonymous}
                        onChange={(e) => setIsAnonymous(e.target.checked)}
                        className="h-4 w-4 rounded accent-cyan-400"
                      />
                      <span>Submit Anonymously 🕶️</span>
                    </label>

                    <span className="text-[10px] font-mono text-[#64748B]">
                      {isAnonymous ? "Identity Hidden" : "Attached to Profile"}
                    </span>
                  </div>

                  {!isAnonymous && (
                    <div className="text-xs text-[#94A3B8] pt-1 border-t border-[#334155]/60 flex items-center justify-between">
                      {currentUser ? (
                        <span>
                          Submitting as: <strong className="text-white">{currentUser.fullName}</strong> ({currentUser.level || "Student"})
                        </span>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 w-full pt-1">
                          <input
                            type="text"
                            placeholder="Your Name (Optional)"
                            value={guestName}
                            onChange={(e) => setGuestName(e.target.value)}
                            className="rounded-lg bg-[#1E293B] border border-[#334155] px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-400"
                          />
                          <input
                            type="email"
                            placeholder="Your Email (Optional)"
                            value={guestEmail}
                            onChange={(e) => setGuestEmail(e.target.value)}
                            className="rounded-lg bg-[#1E293B] border border-[#334155] px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-400"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="pt-2 flex items-center justify-between border-t border-[#334155]">
                  <span className="text-[11px] text-[#64748B] font-mono">
                    All feedback is strictly confidential &bull; TVET Academic Council
                  </span>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center space-x-2 rounded-xl bg-cyan-400 hover:bg-cyan-500 px-6 py-2.5 text-xs font-black text-slate-950 transition-all shadow-xl active:scale-95 disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{submitting ? "Sending..." : "Submit Suggestion"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
