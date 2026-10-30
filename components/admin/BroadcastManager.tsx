"use client";

import React, { useState, useEffect } from "react";
import { BroadcastBulletin, BulletinPriority, BulletinAudienceType } from "@/types/bulletin";
import { Trade, StudentLevel, UserProfile } from "@/types/auth";
import { 
  getBulletins, 
  saveBulletin, 
  deleteBulletin, 
  toggleBulletinActive, 
  subscribeToBulletins 
} from "@/lib/db";
import { 
  Megaphone, 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Trash2, 
  Eye, 
  EyeOff, 
  Send, 
  Sparkles, 
  Users, 
  ShieldAlert, 
  Info, 
  PartyPopper, 
  Filter, 
  X, 
  Check, 
  ExternalLink,
  ChevronDown
} from "lucide-react";

interface BroadcastManagerProps {
  adminUser?: UserProfile | null;
  trades?: Trade[];
}

export const PRIORITY_METADATA: Record<BulletinPriority, { label: string; badge: string; border: string; bg: string; icon: string }> = {
  critical: { label: "Critical Urgent", badge: "bg-rose-500/15 text-rose-300 border-rose-500/30", border: "border-rose-500/50", bg: "bg-rose-950/20", icon: "🚨" },
  important: { label: "Important Notice", badge: "bg-amber-500/15 text-amber-300 border-amber-500/30", border: "border-amber-500/40", bg: "bg-amber-950/20", icon: "⚠️" },
  info: { label: "General Info", badge: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30", border: "border-cyan-500/40", bg: "bg-cyan-950/20", icon: "ℹ️" },
  celebration: { label: "Celebration & Event", badge: "bg-purple-500/15 text-purple-300 border-purple-500/30", border: "border-purple-500/40", bg: "bg-purple-950/20", icon: "🎉" }
};

export default function BroadcastManager({ adminUser, trades = [] }: BroadcastManagerProps) {
  const [bulletins, setBulletins] = useState<BroadcastBulletin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  
  // Modal State
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [viewingReceiptsBulletin, setViewingReceiptsBulletin] = useState<BroadcastBulletin | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formPriority, setFormPriority] = useState<BulletinPriority>("important");
  const [formAudience, setFormAudience] = useState<BulletinAudienceType>("all");
  const [formTargetTradeId, setFormTargetTradeId] = useState("all");
  const [formTargetLevel, setFormTargetLevel] = useState<StudentLevel | "all">("all");
  const [formActionUrl, setFormActionUrl] = useState("");
  const [formActionLabel, setFormActionLabel] = useState("");
  const [formExpiresAt, setFormExpiresAt] = useState("");
  const [formRequireAck, setFormRequireAck] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsub = subscribeToBulletins((data) => {
      setBulletins(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleCreateBulletin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formMessage.trim()) return;

    setSubmitting(true);
    try {
      const newBulletin: BroadcastBulletin = {
        id: `bul_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: formTitle.trim(),
        message: formMessage.trim(),
        priority: formPriority,
        targetAudience: formAudience,
        targetTradeId: formTargetTradeId === "all" ? undefined : formTargetTradeId,
        targetLevel: formTargetLevel === "all" ? undefined : formTargetLevel,
        actionUrl: formActionUrl.trim() || undefined,
        actionLabel: formActionLabel.trim() || undefined,
        expiresAt: formExpiresAt ? new Date(formExpiresAt).toISOString() : undefined,
        requireAcknowledgment: formRequireAck,
        readReceipts: [],
        createdByName: adminUser?.fullName || "Faculty Instructor",
        createdByEmail: adminUser?.email || "admin@school.edu",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        active: true
      };

      await saveBulletin(newBulletin);
      setIsComposerOpen(false);
      resetForm();
    } catch (err) {
      console.error("Failed to publish bulletin:", err);
      alert("Error publishing bulletin. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormTitle("");
    setFormMessage("");
    setFormPriority("important");
    setFormAudience("all");
    setFormTargetTradeId("all");
    setFormTargetLevel("all");
    setFormActionUrl("");
    setFormActionLabel("");
    setFormExpiresAt("");
    setFormRequireAck(false);
  };

  const handleDelete = async (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete announcement: "${title}"?`)) {
      try {
        await deleteBulletin(id);
      } catch (err) {
        console.error("Failed to delete bulletin:", err);
      }
    }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    try {
      await toggleBulletinActive(id, !currentActive);
    } catch (err) {
      console.error("Failed to toggle bulletin status:", err);
    }
  };

  const activeCount = bulletins.filter(b => b.active).length;
  const criticalCount = bulletins.filter(b => b.active && b.priority === "critical").length;

  const filtered = bulletins.filter(b => {
    if (priorityFilter !== "all" && b.priority !== priorityFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const match = b.title.toLowerCase().includes(q) || b.message.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="rounded-3xl border border-[#334155] bg-gradient-to-r from-[#1E293B] via-[#0F172A] to-[#1E293B] p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-cyan-400 font-mono text-xs font-semibold uppercase tracking-wider mb-1">
              <Megaphone className="h-4 w-4" />
              <span>Campus Announcement Dispatch</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center space-x-2">
              <span>School &amp; Class Broadcast Bulletin</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#94A3B8] mt-1 max-w-xl">
              Post urgent notices, deadline extensions, and campus alerts targeted by trade, level, or school-wide with live read receipts.
            </p>
          </div>

          <button
            onClick={() => setIsComposerOpen(true)}
            type="button"
            className="inline-flex items-center space-x-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 text-slate-950 font-mono font-black text-xs shadow-lg shadow-cyan-500/20 active:scale-95 transition-all self-start md:self-auto"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            <span>Compose Announcement</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 pt-5 border-t border-[#334155]/60">
          <div className="rounded-2xl bg-[#0B0F19]/60 border border-cyan-500/30 p-3.5">
            <span className="text-xs font-mono text-cyan-300 block">Active Broadcasts</span>
            <span className="text-2xl font-black text-white font-mono mt-1 block">{activeCount}</span>
          </div>

          <div className="rounded-2xl bg-[#0B0F19]/60 border border-rose-500/30 p-3.5">
            <span className="text-xs font-mono text-rose-300 block flex items-center space-x-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-400 animate-ping" />
              <span>Critical Alerts</span>
            </span>
            <span className="text-2xl font-black text-rose-400 font-mono mt-1 block">{criticalCount}</span>
          </div>

          <div className="rounded-2xl bg-[#0B0F19]/60 border border-[#334155] p-3.5">
            <span className="text-xs font-mono text-[#94A3B8] block">Total Dispatched</span>
            <span className="text-2xl font-black text-white font-mono mt-1 block">{bulletins.length}</span>
          </div>

          <div className="rounded-2xl bg-[#0B0F19]/60 border border-purple-500/30 p-3.5">
            <span className="text-xs font-mono text-purple-300 block">Total Read Receipts</span>
            <span className="text-2xl font-black text-purple-300 font-mono mt-1 block">
              {bulletins.reduce((acc, b) => acc + (b.readReceipts?.length || 0), 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#1E293B] p-3.5 rounded-2xl border border-[#334155]">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
          <input
            type="text"
            placeholder="Search announcements by title or content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#0B0F19] border border-[#334155] rounded-xl text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-cyan-400 font-mono"
          />
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-mono text-[#94A3B8] flex items-center space-x-1 shrink-0">
            <Filter className="h-3.5 w-3.5" />
            <span>Priority:</span>
          </span>
          <button
            onClick={() => setPriorityFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all shrink-0 ${
              priorityFilter === "all" ? "bg-cyan-500 text-slate-950" : "bg-[#0B0F19] text-[#94A3B8] hover:text-white"
            }`}
          >
            All
          </button>
          {Object.entries(PRIORITY_METADATA).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => setPriorityFilter(key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all shrink-0 ${
                priorityFilter === key ? "bg-cyan-500 text-slate-950" : "bg-[#0B0F19] text-[#94A3B8] hover:text-white"
              }`}
            >
              {meta.icon} {meta.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulletins List */}
      {loading ? (
        <div className="p-16 text-center text-xs font-mono text-[#94A3B8]">
          <div className="h-8 w-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin mx-auto mb-3" />
          Loading announcements...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#334155] bg-[#1E293B]/40 p-16 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0B0F19] border border-[#334155] flex items-center justify-center mx-auto text-xl">
            📢
          </div>
          <h4 className="text-sm font-bold text-white">No announcements found</h4>
          <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
            Click "Compose Announcement" above to dispatch a new notice to students.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const prio = PRIORITY_METADATA[item.priority] || PRIORITY_METADATA.info;
            const readCount = item.readReceipts?.length || 0;
            const isExpired = item.expiresAt && new Date(item.expiresAt).getTime() < Date.now();

            return (
              <div
                key={item.id}
                className={`rounded-2xl border transition-all p-5 space-y-4 ${
                  !item.active || isExpired
                    ? "border-[#334155]/60 bg-[#1E293B]/40 opacity-70"
                    : `${prio.border} ${prio.bg} shadow-lg`
                }`}
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-mono font-bold border ${prio.badge}`}>
                      <span>{prio.icon}</span>
                      <span>{prio.label}</span>
                    </span>

                    {/* Target Audience Badge */}
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold bg-[#0B0F19] text-[#94A3B8] border border-[#334155]">
                      <Users className="h-3 w-3 text-cyan-400" />
                      <span>
                        {item.targetAudience === "all" ? "Campus Wide (All Students)" : 
                         item.targetLevel ? `Level ${item.targetLevel}` : "Targeted Class"}
                      </span>
                    </span>

                    {item.requireAcknowledgment && (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        Imperative Modal
                      </span>
                    )}

                    <span className="text-[11px] font-mono text-[#64748B]">
                      {new Date(item.createdAt).toLocaleDateString()} by {item.createdByName}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    {/* Active toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggle(item.id, item.active)}
                      className={`inline-flex items-center space-x-1 px-3 py-1 rounded-xl text-[11px] font-mono font-bold border transition-all ${
                        item.active
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {item.active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      <span>{item.active ? "Active" : "Archived"}</span>
                    </button>

                    {/* Read Receipts Inspector Button */}
                    <button
                      type="button"
                      onClick={() => setViewingReceiptsBulletin(item)}
                      className="inline-flex items-center space-x-1 px-3 py-1 rounded-xl text-[11px] font-mono font-bold bg-[#0B0F19] text-cyan-300 border border-cyan-500/30 hover:border-cyan-400 transition-all"
                      title="View students who read this announcement"
                    >
                      <Users className="h-3 w-3" />
                      <span>{readCount} Read{readCount !== 1 ? "s" : ""}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(item.id, item.title)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-[#0B0F19] transition-all"
                      title="Delete announcement"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div>
                  <h3 className="text-base font-extrabold text-white tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#CBD5E1] mt-1.5 leading-relaxed whitespace-pre-wrap">
                    {item.message}
                  </p>
                </div>

                {/* Action Link & Expiry Footer */}
                {(item.actionUrl || item.expiresAt) && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#334155]/60 text-xs font-mono">
                    {item.actionUrl ? (
                      <a
                        href={item.actionUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 text-cyan-400 hover:underline"
                      >
                        <span>{item.actionLabel || "View Attached Link"}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : <div />}

                    {item.expiresAt && (
                      <span className={`text-[11px] ${isExpired ? "text-rose-400 font-bold" : "text-[#64748B]"}`}>
                        {isExpired ? "⚠️ Expired on " : "Expires: "} {new Date(item.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Compose Announcement */}
      {isComposerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="relative max-h-[92vh] w-full max-w-xl overflow-hidden rounded-3xl border border-[#334155] bg-[#0F172A] shadow-2xl flex flex-col">
            <div className="h-1.5 w-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-rose-500" />
            
            <div className="flex items-center justify-between border-b border-[#334155] px-6 py-4 bg-[#1E293B]/70 shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Compose Campus Broadcast</h3>
                  <p className="text-xs text-[#94A3B8]">Dispatch an announcement to students</p>
                </div>
              </div>
              <button
                onClick={() => setIsComposerOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBulletin} className="overflow-y-auto p-6 space-y-4 text-xs font-mono">
              {/* Priority */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                  Announcement Urgency / Priority
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(PRIORITY_METADATA).map(([key, meta]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormPriority(key as BulletinPriority)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex items-center space-x-2 ${
                        formPriority === key
                          ? "border-cyan-400 bg-cyan-500/15 text-white"
                          : "border-[#334155] bg-[#0B0F19] text-[#94A3B8] hover:text-white"
                      }`}
                    >
                      <span className="text-base">{meta.icon}</span>
                      <span className="font-bold">{meta.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
                  Announcement Headline
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Level 4 Lab Deadline Extended to Sunday Midnight"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full rounded-xl bg-[#0B0F19] border border-[#334155] p-2.5 text-xs text-white placeholder-[#64748B] focus:border-cyan-400 focus:outline-none"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
                  Notice Details / Body
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Provide comprehensive instructions, rationale, or event details..."
                  value={formMessage}
                  onChange={(e) => setFormMessage(e.target.value)}
                  className="w-full rounded-xl bg-[#0B0F19] border border-[#334155] p-2.5 text-xs text-white placeholder-[#64748B] focus:border-cyan-400 focus:outline-none resize-none leading-relaxed font-sans"
                />
              </div>

              {/* Audience Targeting */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
                    Target Class / Level
                  </label>
                  <select
                    value={formTargetLevel}
                    onChange={(e) => setFormTargetLevel(e.target.value as any)}
                    className="w-full rounded-xl bg-[#0B0F19] border border-[#334155] p-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none cursor-pointer"
                  >
                    <option value="all">🌐 All Academic Levels</option>
                    <option value="Level 1">Level 1</option>
                    <option value="Level 2">Level 2</option>
                    <option value="Level 3">Level 3</option>
                    <option value="Level 4">Level 4</option>
                    <option value="Level 5">Level 5</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
                    Target Academic Trade
                  </label>
                  <select
                    value={formTargetTradeId}
                    onChange={(e) => setFormTargetTradeId(e.target.value)}
                    className="w-full rounded-xl bg-[#0B0F19] border border-[#334155] p-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none cursor-pointer"
                  >
                    <option value="all">🌐 All Trades</option>
                    {trades.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Optional Expiry & Link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
                    Expiry Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formExpiresAt}
                    onChange={(e) => setFormExpiresAt(e.target.value)}
                    className="w-full rounded-xl bg-[#0B0F19] border border-[#334155] p-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1 uppercase tracking-wider text-[11px]">
                    Action Link (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. /tips or https://..."
                    value={formActionUrl}
                    onChange={(e) => setFormActionUrl(e.target.value)}
                    className="w-full rounded-xl bg-[#0B0F19] border border-[#334155] p-2.5 text-xs text-white placeholder-[#64748B] focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Imperative Modal Checkbox */}
              <label className="flex items-center space-x-2.5 p-3 rounded-xl bg-[#0B0F19] border border-rose-500/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formRequireAck}
                  onChange={(e) => setFormRequireAck(e.target.checked)}
                  className="rounded border-[#334155] text-rose-500 focus:ring-rose-500"
                />
                <span className="text-xs text-rose-300 font-sans">
                  <strong>Require Imperative Acknowledgment:</strong> Shows an un-dismissible popup modal on student login until they click "I Acknowledge".
                </span>
              </label>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#334155]">
                <button
                  type="button"
                  onClick={() => setIsComposerOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#334155] text-[#94A3B8] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold active:scale-95 transition-all flex items-center space-x-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{submitting ? "Publishing..." : "Broadcast Notice"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Read Receipts Inspector */}
      {viewingReceiptsBulletin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="relative max-h-[85vh] w-full max-w-md overflow-hidden rounded-3xl border border-[#334155] bg-[#0F172A] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-[#334155] px-6 py-4 bg-[#1E293B]/70 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                  <Users className="h-4 w-4 text-cyan-400" />
                  <span>Read Receipts ({viewingReceiptsBulletin.readReceipts?.length || 0})</span>
                </h3>
                <p className="text-[11px] font-mono text-[#94A3B8] truncate max-w-xs mt-0.5">
                  {viewingReceiptsBulletin.title}
                </p>
              </div>
              <button
                onClick={() => setViewingReceiptsBulletin(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-2">
              {(viewingReceiptsBulletin.readReceipts || []).length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-[#94A3B8]">
                  No students have acknowledged or opened this announcement yet.
                </div>
              ) : (
                viewingReceiptsBulletin.readReceipts?.map((rec, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#1E293B] border border-[#334155] text-xs font-mono"
                  >
                    <span className="font-bold text-white">{rec.studentName}</span>
                    <span className="text-[10px] text-emerald-400 flex items-center space-x-1">
                      <Check className="h-3 w-3" />
                      <span>{new Date(rec.readAt).toLocaleDateString()} {new Date(rec.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
