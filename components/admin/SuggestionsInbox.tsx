"use client";

import React, { useState, useEffect } from "react";
import { StudentSuggestion, SuggestionCategory, SuggestionStatus } from "@/types/suggestion";
import { UserProfile } from "@/types/auth";
import { 
  getSuggestions, 
  updateSuggestionStatus, 
  deleteSuggestion, 
  subscribeToSuggestions 
} from "@/lib/db";
import { SUGGESTION_CATEGORIES } from "@/components/common/SuggestionBoxModal";
import { 
  Inbox, 
  Search, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Archive, 
  User, 
  Shield, 
  MessageSquare, 
  Filter, 
  RotateCcw,
  Sparkles,
  Save,
  Check
} from "lucide-react";

interface SuggestionsInboxProps {
  adminUser?: UserProfile | null;
}

export const STATUS_METADATA: Record<SuggestionStatus, { label: string; badge: string; dot: string }> = {
  new: { label: "New", badge: "bg-amber-500/15 text-amber-300 border-amber-500/30", dot: "bg-amber-400" },
  in_review: { label: "Under Review", badge: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30", dot: "bg-cyan-400" },
  resolved: { label: "Resolved / Implemented", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-400" },
  archived: { label: "Archived", badge: "bg-slate-500/15 text-slate-400 border-slate-500/30", dot: "bg-slate-400" }
};

export default function SuggestionsInbox({ adminUser }: SuggestionsInboxProps) {
  const [suggestions, setSuggestions] = useState<StudentSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToSuggestions((data) => {
      setSuggestions(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleStatusChange = async (id: string, newStatus: SuggestionStatus) => {
    try {
      await updateSuggestionStatus(id, newStatus);
    } catch (e) {
      console.error("Failed to update suggestion status:", e);
    }
  };

  const handleSaveNotes = async (id: string) => {
    setSavingNoteId(id);
    try {
      const note = editingNotes[id] ?? "";
      await updateSuggestionStatus(id, suggestions.find(s => s.id === id)?.status || "new", note);
      setTimeout(() => setSavingNoteId(null), 1000);
    } catch (e) {
      console.error("Failed to save note:", e);
      setSavingNoteId(null);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete suggestion: "${title}"?`)) {
      try {
        await deleteSuggestion(id);
      } catch (e) {
        console.error("Failed to delete suggestion:", e);
      }
    }
  };

  const filtered = suggestions.filter((s) => {
    if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const match = s.title.toLowerCase().includes(q) || s.message.toLowerCase().includes(q) || (s.studentName && s.studentName.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const newCount = suggestions.filter(s => s.status === "new").length;
  const inReviewCount = suggestions.filter(s => s.status === "in_review").length;
  const resolvedCount = suggestions.filter(s => s.status === "resolved").length;

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#334155] pb-5">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center space-x-2">
            <span className="text-xl">📬</span>
            <span>Student Suggestions &amp; Feedback Inbox</span>
          </h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Review, prioritize, and respond to suggestions, feature requests, and bug reports sent by students and visitors.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-4">
          <span className="text-xs font-mono text-[#94A3B8] block">Total Received</span>
          <span className="text-2xl font-black text-white font-mono mt-1">{suggestions.length}</span>
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-[#1E293B] p-4">
          <span className="text-xs font-mono text-amber-300 block flex items-center space-x-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <span>New &amp; Unread</span>
          </span>
          <span className="text-2xl font-black text-amber-400 font-mono mt-1">{newCount}</span>
        </div>

        <div className="rounded-2xl border border-cyan-500/30 bg-[#1E293B] p-4">
          <span className="text-xs font-mono text-cyan-300 block">Under Review</span>
          <span className="text-2xl font-black text-cyan-400 font-mono mt-1">{inReviewCount}</span>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-[#1E293B] p-4">
          <span className="text-xs font-mono text-emerald-300 block">Resolved / Done</span>
          <span className="text-2xl font-black text-emerald-400 font-mono mt-1">{resolvedCount}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0B0F19]/60 border border-[#334155] p-3 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Search suggestions or student names..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl bg-[#1E293B] border border-[#334155] pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#64748B] focus:border-cyan-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl bg-[#1E293B] border border-[#334155] px-3 py-1.5 text-xs font-mono text-[#CBD5E1] focus:border-cyan-400 focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="feature_request">💡 Feature Request</option>
            <option value="course_content">📚 Course / Syllabus</option>
            <option value="dev_tip_request">💻 Dev Tip Request</option>
            <option value="bug_report">🐛 Bug Report</option>
            <option value="general_feedback">💬 General Feedback</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl bg-[#1E293B] border border-[#334155] px-3 py-1.5 text-xs font-mono text-[#CBD5E1] focus:border-cyan-400 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="new">New (Unread)</option>
            <option value="in_review">Under Review</option>
            <option value="resolved">Resolved</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Suggestions List */}
      {loading ? (
        <div className="rounded-3xl border border-[#334155] bg-[#1E293B]/40 p-12 text-center text-xs font-mono text-[#94A3B8]">
          <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent mb-3" />
          Loading suggestion box submissions...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#334155] bg-[#1E293B]/20 p-12 text-center space-y-2">
          <Inbox className="mx-auto h-12 w-12 text-[#64748B]" />
          <h3 className="text-base font-bold text-white">No suggestions found</h3>
          <p className="text-xs text-[#94A3B8]">
            {suggestions.length === 0 
              ? "Your suggestion box is clean! When students submit ideas or bug reports, they will show up here."
              : "No submissions matched your filter criteria."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const catMeta = SUGGESTION_CATEGORIES[item.category] || SUGGESTION_CATEGORIES.general_feedback;
            const statusMeta = STATUS_METADATA[item.status] || STATUS_METADATA.new;
            const isExpanded = expandedId === item.id;
            const noteValue = editingNotes[item.id] !== undefined ? editingNotes[item.id] : (item.adminNotes || "");

            return (
              <div
                key={item.id}
                className={`rounded-2xl border transition-all ${
                  item.status === "new"
                    ? "border-amber-500/40 bg-gradient-to-r from-[#1E293B] to-[#1E293B]/80 shadow-lg"
                    : "border-[#334155] bg-[#1E293B] hover:border-[#475569]"
                } p-4 sm:p-5 space-y-3`}
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Category */}
                    <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-mono font-bold border ${catMeta.bg} ${catMeta.border} ${catMeta.color}`}>
                      <span>{catMeta.icon}</span>
                      <span>{catMeta.label}</span>
                    </span>

                    {/* Status Dropdown */}
                    <select
                      value={item.status}
                      onChange={(e) => handleStatusChange(item.id, e.target.value as SuggestionStatus)}
                      className={`rounded-xl px-2.5 py-1 text-[11px] font-mono font-bold border focus:outline-none cursor-pointer ${statusMeta.badge}`}
                    >
                      <option value="new">🟡 New</option>
                      <option value="in_review">🔵 Under Review</option>
                      <option value="resolved">🟢 Resolved / Done</option>
                      <option value="archived">⚪ Archived</option>
                    </select>

                    {/* Date */}
                    <span className="text-[11px] font-mono text-[#64748B]">
                      {new Date(item.createdAt).toLocaleDateString()} at {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Student / Author Badge */}
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono text-[#CBD5E1] flex items-center space-x-1.5 bg-[#0B0F19] px-2.5 py-1 rounded-xl border border-[#334155]">
                      <span>{item.isAnonymous ? "🕶️" : "👤"}</span>
                      <strong className={item.isAnonymous ? "text-amber-300" : "text-white"}>
                        {item.studentName || "Anonymous"}
                      </strong>
                      {item.studentLevel && (
                        <span className="text-[#06B6D4]">({item.studentLevel})</span>
                      )}
                    </span>

                    <button
                      onClick={() => handleDelete(item.id, item.title)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-[#0B0F19] transition-all"
                      title="Delete Suggestion"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Subject & Summary */}
                <div>
                  <h4 className="text-sm font-extrabold text-white tracking-tight">
                    {item.title}
                  </h4>
                  <p className="text-xs text-[#CBD5E1] mt-1.5 leading-relaxed whitespace-pre-wrap">
                    {item.message}
                  </p>
                </div>

                {/* Internal Teacher Notes Accordion */}
                <div className="pt-2 border-t border-[#334155]/60">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-mono font-bold text-[#94A3B8] uppercase tracking-wider">
                      Teacher Internal Notes &amp; Action Plan
                    </span>
                    {item.adminNotes && (
                      <span className="text-[10px] text-emerald-400 font-mono">Saved</span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="e.g. Added to sprint backlog, or discussed in faculty meeting..."
                      value={noteValue}
                      onChange={(e) => setEditingNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                      className="flex-1 rounded-xl bg-[#0B0F19] border border-[#334155] px-3 py-1.5 text-xs text-white placeholder-[#64748B] focus:border-cyan-400 focus:outline-none"
                    />
                    <button
                      onClick={() => handleSaveNotes(item.id)}
                      disabled={savingNoteId === item.id}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-500 transition-all shrink-0 active:scale-95"
                    >
                      {savingNoteId === item.id ? (
                        <>
                          <Check className="h-3 w-3" />
                          <span>Saved!</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-3 w-3" />
                          <span>Save Note</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
