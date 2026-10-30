"use client";

import React, { useState, useEffect } from "react";
import { StudentSuggestion, SuggestionStatus } from "@/types/suggestion";
import { UserProfile } from "@/types/auth";
import { subscribeToSuggestions, toggleSuggestionUpvote } from "@/lib/db";
import { SUGGESTION_CATEGORIES } from "@/components/common/SuggestionBoxModal";
import { STATUS_METADATA } from "@/components/admin/SuggestionsInbox";
import { 
  MessageSquare, 
  ThumbsUp, 
  Sparkles, 
  Plus, 
  Clock, 
  CheckCircle2, 
  Send,
  Users,
  Compass,
  Filter,
  Check,
  ShieldCheck
} from "lucide-react";

interface StudentFeedbackViewProps {
  currentUser: UserProfile;
  onOpenNewSuggestion: () => void;
}

export default function StudentFeedbackView({ currentUser, onOpenNewSuggestion }: StudentFeedbackViewProps) {
  const [suggestions, setSuggestions] = useState<StudentSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<"my_submissions" | "community">("my_submissions");
  const [upvotingId, setUpvotingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  useEffect(() => {
    const unsub = subscribeToSuggestions((data) => {
      setSuggestions(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Filter student submissions
  const mySubmissions = suggestions.filter(s => {
    if (s.studentUid && s.studentUid === currentUser.uid) return true;
    if (s.studentEmail && s.studentEmail.toLowerCase() === currentUser.email?.toLowerCase()) return true;
    return false;
  });

  // Filter public suggestions
  const communitySuggestions = suggestions.filter(s => s.isPublic);

  const myRepliesCount = mySubmissions.filter(s => !!s.adminReply).length;

  const handleUpvote = async (id: string) => {
    setUpvotingId(id);
    try {
      await toggleSuggestionUpvote(id, currentUser.uid);
    } catch (err) {
      console.error("Failed to upvote:", err);
    } finally {
      setTimeout(() => setUpvotingId(null), 300);
    }
  };

  const filteredCommunity = communitySuggestions.filter(s => {
    if (filterCategory !== "all" && s.category !== filterCategory) return false;
    return true;
  }).sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Action */}
      <div className="rounded-3xl border border-[#334155] bg-gradient-to-r from-[#1E293B] via-[#0F172A] to-[#1E293B] p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-cyan-400 font-mono text-xs font-semibold uppercase tracking-wider mb-1">
              <Sparkles className="h-4 w-4" />
              <span>Voice of the Student Body</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Feedback, Requests &amp; Ideas Hub
            </h2>
            <p className="text-xs sm:text-sm text-[#94A3B8] mt-1 max-w-xl">
              Track responses to your suggestions, see what instructors are working on, and vote on fellow students' ideas.
            </p>
          </div>

          <button
            onClick={onOpenNewSuggestion}
            type="button"
            className="inline-flex items-center space-x-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 text-slate-950 font-mono font-black text-xs shadow-lg shadow-cyan-500/20 active:scale-95 transition-all self-start md:self-auto"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            <span>Submit New Idea</span>
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 pt-5 border-t border-[#334155]/60">
          <div className="rounded-2xl bg-[#0B0F19]/60 border border-[#334155] p-3.5">
            <span className="text-[11px] font-mono text-[#94A3B8] block">My Ideas Sent</span>
            <span className="text-xl font-mono font-black text-white mt-0.5 block">{mySubmissions.length}</span>
          </div>
          <div className="rounded-2xl bg-[#0B0F19]/60 border border-cyan-500/30 p-3.5">
            <span className="text-[11px] font-mono text-cyan-300 block">Faculty Replies</span>
            <span className="text-xl font-mono font-black text-cyan-400 mt-0.5 block">{myRepliesCount}</span>
          </div>
          <div className="rounded-2xl bg-[#0B0F19]/60 border border-purple-500/30 p-3.5 col-span-2 sm:col-span-1">
            <span className="text-[11px] font-mono text-purple-300 block">Campus Ideas</span>
            <span className="text-xl font-mono font-black text-purple-400 mt-0.5 block">{communitySuggestions.length}</span>
          </div>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex items-center space-x-2 border-b border-[#334155] pb-2">
        <button
          onClick={() => setActiveSubTab("my_submissions")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
            activeSubTab === "my_submissions"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
              : "text-[#94A3B8] hover:text-white hover:bg-[#1E293B]"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span>My Submissions &amp; Replies</span>
          {myRepliesCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-cyan-400 text-slate-950 font-black">
              {myRepliesCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab("community")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
            activeSubTab === "community"
              ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm"
              : "text-[#94A3B8] hover:text-white hover:bg-[#1E293B]"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Campus Ideas &amp; Upvoting</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-500/30 text-purple-200">
            {communitySuggestions.length}
          </span>
        </button>
      </div>

      {/* SUB-TAB 1: My Submissions & Replies */}
      {activeSubTab === "my_submissions" && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-12 text-center text-xs font-mono text-[#94A3B8]">
              Loading your feedback submissions...
            </div>
          ) : mySubmissions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#334155] bg-[#1E293B]/40 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#0B0F19] border border-[#334155] flex items-center justify-center mx-auto text-xl">
                💡
              </div>
              <h4 className="text-sm font-bold text-white">No submissions yet</h4>
              <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
                Have an idea for a new Developer Tip, course improvement, or platform feature? Let the faculty know!
              </p>
              <button
                onClick={onOpenNewSuggestion}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-mono font-bold text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Submit Your First Suggestion</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {mySubmissions.map((item) => {
                const catMeta = SUGGESTION_CATEGORIES[item.category] || SUGGESTION_CATEGORIES.general_feedback;
                const statusMeta = STATUS_METADATA[item.status] || STATUS_METADATA.new;

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-[#334155] bg-[#1E293B] p-5 space-y-3.5 hover:border-[#475569] transition-all"
                  >
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-mono font-bold border ${catMeta.bg} ${catMeta.border} ${catMeta.color}`}>
                          <span>{catMeta.icon}</span>
                          <span>{catMeta.label}</span>
                        </span>

                        <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold border ${statusMeta.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
                          <span>{statusMeta.label}</span>
                        </span>
                      </div>

                      <span className="text-[11px] font-mono text-[#64748B]">
                        Submitted {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Title & Message */}
                    <div>
                      <h4 className="text-sm font-bold text-white">{item.title}</h4>
                      <p className="text-xs text-[#CBD5E1] mt-1.5 leading-relaxed whitespace-pre-wrap">
                        {item.message}
                      </p>
                    </div>

                    {/* Faculty Official Reply Card */}
                    {item.adminReply ? (
                      <div className="rounded-2xl bg-[#0B0F19] border border-cyan-500/40 p-4 space-y-2 relative overflow-hidden">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-cyan-400 font-bold flex items-center space-x-1.5">
                            <ShieldCheck className="h-4 w-4" />
                            <span>Faculty Response ({item.adminRepliedBy || "Instructor"})</span>
                          </span>
                          {item.adminRepliedAt && (
                            <span className="text-[10px] text-[#64748B]">
                              {new Date(item.adminRepliedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white leading-relaxed font-sans pl-2 border-l-2 border-cyan-400">
                          {item.adminReply}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-[#0B0F19]/60 border border-[#334155]/50 px-3 py-2 flex items-center space-x-2 text-[11px] font-mono text-[#94A3B8]">
                        <Clock className="h-3.5 w-3.5 text-amber-400 animate-spin" />
                        <span>Awaiting faculty review. You will be notified here when an instructor responds.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: Campus Ideas & Upvoting */}
      {activeSubTab === "community" && (
        <div className="space-y-4">
          {/* Category Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-[#94A3B8] flex items-center space-x-1 mr-1">
              <Filter className="h-3.5 w-3.5" />
              <span>Filter:</span>
            </span>
            <button
              onClick={() => setFilterCategory("all")}
              className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all ${
                filterCategory === "all"
                  ? "bg-purple-500 text-white"
                  : "bg-[#1E293B] text-[#94A3B8] hover:text-white"
              }`}
            >
              All Ideas ({communitySuggestions.length})
            </button>
            {Object.entries(SUGGESTION_CATEGORIES).map(([key, meta]) => {
              const count = communitySuggestions.filter(s => s.category === key).length;
              if (count === 0) return null;
              return (
                <button
                  key={key}
                  onClick={() => setFilterCategory(key)}
                  className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all ${
                    filterCategory === key
                      ? "bg-purple-500 text-white"
                      : "bg-[#1E293B] text-[#94A3B8] hover:text-white"
                  }`}
                >
                  {meta.icon} {meta.label} ({count})
                </button>
              );
            })}
          </div>

          {filteredCommunity.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#334155] bg-[#1E293B]/40 p-12 text-center space-y-2">
              <p className="text-xs font-mono text-[#94A3B8]">
                No public community ideas currently posted.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCommunity.map((item) => {
                const catMeta = SUGGESTION_CATEGORIES[item.category] || SUGGESTION_CATEGORIES.general_feedback;
                const statusMeta = STATUS_METADATA[item.status] || STATUS_METADATA.new;
                const hasUpvoted = (item.upvotedBy || []).includes(currentUser.uid);

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-[#334155] bg-[#1E293B] p-5 space-y-3 hover:border-purple-500/40 transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-xl text-[11px] font-mono font-bold border ${catMeta.bg} ${catMeta.border} ${catMeta.color}`}>
                          <span>{catMeta.icon}</span>
                          <span>{catMeta.label}</span>
                        </span>

                        <span className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-xl text-[11px] font-mono font-bold border ${statusMeta.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
                          <span>{statusMeta.label}</span>
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-white">{item.title}</h4>
                      <p className="text-xs text-[#CBD5E1] leading-relaxed whitespace-pre-wrap">
                        {item.message}
                      </p>

                      {/* If faculty replied */}
                      {item.adminReply && (
                        <div className="rounded-xl bg-[#0B0F19] border border-cyan-500/30 p-2.5 text-xs text-cyan-200 mt-2">
                          <span className="font-mono text-[10px] text-cyan-400 block mb-0.5">Faculty Update:</span>
                          <span className="italic">{item.adminReply}</span>
                        </div>
                      )}
                    </div>

                    {/* Upvote Button */}
                    <div className="flex sm:flex-col items-center justify-between sm:justify-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleUpvote(item.id)}
                        disabled={upvotingId === item.id}
                        className={`flex sm:flex-col items-center justify-center space-x-1.5 sm:space-x-0 sm:space-y-1 px-4 py-2.5 rounded-2xl border font-mono font-bold text-xs transition-all active:scale-95 ${
                          hasUpvoted
                            ? "bg-purple-500/25 border-purple-500 text-purple-300 shadow-lg shadow-purple-500/20"
                            : "bg-[#0B0F19] border-[#334155] text-[#94A3B8] hover:text-white hover:border-[#475569]"
                        }`}
                      >
                        <ThumbsUp className={`h-4 w-4 ${hasUpvoted ? "fill-purple-400 text-purple-400" : ""}`} />
                        <span>{item.upvotes || 0}</span>
                      </button>
                      <span className="text-[10px] font-mono text-[#64748B]">
                        {hasUpvoted ? "Upvoted!" : "Upvote"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
