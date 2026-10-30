"use client";

import React, { useState, useEffect } from "react";
import { DeveloperTip, TipLanguage, TipDifficulty, TipCategory } from "@/types/tip";
import { UserProfile } from "@/types/auth";
import { 
  getDeveloperTips, 
  saveDeveloperTip, 
  deleteDeveloperTip, 
  subscribeToDeveloperTips 
} from "@/lib/db";
import { LANGUAGE_METADATA, DIFFICULTY_BADGES } from "@/components/tips/DeveloperTipCard";
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  FileCode, 
  X, 
  Check, 
  Lightbulb, 
  ExternalLink,
  Code2,
  Copy
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TipsManagerProps {
  adminUser?: UserProfile | null;
}

export default function TipsManager({ adminUser }: TipsManagerProps) {
  const [tips, setTips] = useState<DeveloperTip[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterLang, setFilterLang] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTip, setEditingTip] = useState<DeveloperTip | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState("");
  const [formSummary, setFormSummary] = useState("");
  const [formLanguage, setFormLanguage] = useState<TipLanguage>("python");
  const [formCategory, setFormCategory] = useState<TipCategory>("syntax");
  const [formDifficulty, setFormDifficulty] = useState<TipDifficulty>("beginner");
  const [formTags, setFormTags] = useState("");
  const [formGoodCode, setFormGoodCode] = useState("");
  const [formGoodCodeTitle, setFormGoodCodeTitle] = useState("Recommended Pro Way");
  const [formBadCode, setFormBadCode] = useState("");
  const [formBadCodeTitle, setFormBadCodeTitle] = useState("Common Naive Way");
  const [formExplanation, setFormExplanation] = useState("");
  const [formWhyItMatters, setFormWhyItMatters] = useState("");
  const [formDocsUrl, setFormDocsUrl] = useState("");
  const [formStatus, setFormStatus] = useState<"published" | "draft">("published");
  const [formIsFeatured, setFormIsFeatured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToDeveloperTips((data) => {
      setTips(data);
      setLoading(false);
    }, true); // true = include drafts

    return () => unsub();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const openCreateModal = () => {
    setEditingTip(null);
    setFormTitle("");
    setFormSummary("");
    setFormLanguage("python");
    setFormCategory("syntax");
    setFormDifficulty("beginner");
    setFormTags("python, clean-code");
    setFormGoodCode("");
    setFormGoodCodeTitle("Recommended Pro Way");
    setFormBadCode("");
    setFormBadCodeTitle("Common Naive Way");
    setFormExplanation("");
    setFormWhyItMatters("");
    setFormDocsUrl("");
    setFormStatus("published");
    setFormIsFeatured(false);
    setIsModalOpen(true);
  };

  const openEditModal = (tip: DeveloperTip) => {
    setEditingTip(tip);
    setFormTitle(tip.title);
    setFormSummary(tip.summary);
    setFormLanguage(tip.language);
    setFormCategory(tip.category);
    setFormDifficulty(tip.difficulty);
    setFormTags(tip.tags ? tip.tags.join(", ") : "");
    setFormGoodCode(tip.goodCode || "");
    setFormGoodCodeTitle(tip.goodCodeTitle || "Recommended Pro Way");
    setFormBadCode(tip.badCode || "");
    setFormBadCodeTitle(tip.badCodeTitle || "Common Naive Way");
    setFormExplanation(tip.explanation || "");
    setFormWhyItMatters(tip.whyItMatters || "");
    setFormDocsUrl(tip.documentationUrl || "");
    setFormStatus(tip.status);
    setFormIsFeatured(!!tip.isFeatured);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formGoodCode.trim()) {
      alert("Please provide at least a title and recommended code snippet.");
      return;
    }

    setSaving(true);
    try {
      const tagList = formTags
        .split(",")
        .map(t => t.trim().toLowerCase().replace(/^#/, ""))
        .filter(Boolean);

      const tipId = editingTip ? editingTip.id : `tip_${Date.now()}`;
      
      const payload: DeveloperTip = {
        id: tipId,
        title: formTitle.trim(),
        summary: formSummary.trim(),
        language: formLanguage,
        category: formCategory,
        difficulty: formDifficulty,
        tags: tagList,
        goodCode: formGoodCode,
        goodCodeTitle: formGoodCodeTitle.trim() || "Recommended Pro Way",
        badCode: formBadCode.trim() ? formBadCode : undefined,
        badCodeTitle: formBadCode.trim() ? (formBadCodeTitle.trim() || "Common Naive Way") : undefined,
        explanation: formExplanation.trim() || "Explanation coming soon.",
        whyItMatters: formWhyItMatters.trim() || undefined,
        documentationUrl: formDocsUrl.trim() || undefined,
        status: formStatus,
        isFeatured: formIsFeatured,
        createdAt: editingTip ? editingTip.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        authorName: editingTip?.authorName || adminUser?.fullName || "Faculty Instructor",
        authorUid: editingTip?.authorUid || adminUser?.uid,
        likesCount: editingTip?.likesCount || 0,
        viewsCount: editingTip?.viewsCount || 0
      };

      // If featured is checked, unfeature others
      if (formIsFeatured) {
        for (const other of tips) {
          if (other.id !== tipId && other.isFeatured) {
            await saveDeveloperTip({ ...other, isFeatured: false });
          }
        }
      }

      await saveDeveloperTip(payload);
      showToast(editingTip ? "Tip updated successfully!" : "New tip created and published!");
      setIsModalOpen(false);
    } catch (err) {
      console.error("Failed to save developer tip:", err);
      alert("Error saving tip. Please check console.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      try {
        await deleteDeveloperTip(id);
        showToast("Tip deleted.");
      } catch (e) {
        console.error("Failed to delete tip:", e);
      }
    }
  };

  const handleToggleFeatured = async (tip: DeveloperTip) => {
    try {
      const willFeature = !tip.isFeatured;
      if (willFeature) {
        // Unfeature other tips
        for (const other of tips) {
          if (other.id !== tip.id && other.isFeatured) {
            await saveDeveloperTip({ ...other, isFeatured: false });
          }
        }
      }
      await saveDeveloperTip({ ...tip, isFeatured: willFeature });
      showToast(willFeature ? `"${tip.title}" is now Tip of the Day!` : "Removed from Tip of the Day.");
    } catch (e) {
      console.error(e);
    }
  };

  // Filtered tips for the table
  const filteredTips = tips.filter((t) => {
    if (filterLang !== "all" && t.language !== filterLang) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const match = t.title.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q) || t.tags?.some(tag => tag.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[9999] bg-cyan-500 text-slate-950 font-bold px-4 py-2.5 rounded-2xl shadow-2xl flex items-center space-x-2 animate-bounce">
          <CheckCircle2 className="h-4 w-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#334155] pb-5">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center space-x-2">
            <span className="text-xl">💡</span>
            <span>Developer Tips &amp; Insights Studio</span>
          </h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Publish bite-sized programming wisdom, code comparison cards, and pro tricks visible to all students and public visitors.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <a
            href="/tips"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-bold bg-[#0B0F19] border border-[#334155] text-[#94A3B8] hover:text-white hover:border-cyan-400/50 transition-all shadow-sm"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>View Public Hub</span>
          </a>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-500 transition-all shadow-lg shadow-cyan-500/20 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Tip</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-4">
          <span className="text-xs font-mono text-[#94A3B8] block">Total Cards</span>
          <span className="text-2xl font-black text-white font-mono mt-1">{tips.length}</span>
        </div>
        <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-4">
          <span className="text-xs font-mono text-[#94A3B8] block">Published Live</span>
          <span className="text-2xl font-black text-emerald-400 font-mono mt-1">
            {tips.filter(t => t.status === "published").length}
          </span>
        </div>
        <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-4">
          <span className="text-xs font-mono text-[#94A3B8] block">Drafts</span>
          <span className="text-2xl font-black text-amber-400 font-mono mt-1">
            {tips.filter(t => t.status === "draft").length}
          </span>
        </div>
        <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-4">
          <span className="text-xs font-mono text-[#94A3B8] block">Tip of the Day</span>
          <span className="text-xs font-bold text-cyan-300 font-mono mt-1 truncate block">
            {tips.find(t => t.isFeatured)?.title || "None Set"}
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0B0F19]/60 border border-[#334155] p-3 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Search tip titles or tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl bg-[#1E293B] border border-[#334155] pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#64748B] focus:border-cyan-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={filterLang}
            onChange={(e) => setFilterLang(e.target.value)}
            className="rounded-xl bg-[#1E293B] border border-[#334155] px-3 py-1.5 text-xs font-mono text-[#CBD5E1] focus:border-cyan-400 focus:outline-none"
          >
            <option value="all">All Languages</option>
            <option value="python">Python</option>
            <option value="typescript">TypeScript</option>
            <option value="javascript">JavaScript</option>
            <option value="dart">Dart / Flutter</option>
            <option value="rust">Rust</option>
            <option value="java">Java</option>
            <option value="sql">SQL &amp; DB</option>
            <option value="git">Git &amp; CLI</option>
            <option value="cleancode">Clean Code</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl bg-[#1E293B] border border-[#334155] px-3 py-1.5 text-xs font-mono text-[#CBD5E1] focus:border-cyan-400 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Drafts Only</option>
          </select>
        </div>
      </div>

      {/* Tips Table */}
      {loading ? (
        <div className="rounded-3xl border border-[#334155] bg-[#1E293B]/40 p-12 text-center text-xs font-mono text-[#94A3B8]">
          <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent mb-3" />
          Loading developer tips repository...
        </div>
      ) : filteredTips.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#334155] bg-[#1E293B]/20 p-12 text-center space-y-2">
          <p className="text-xs text-[#94A3B8]">No developer tips found matching your filter criteria.</p>
          <button
            onClick={openCreateModal}
            className="text-xs font-bold font-mono text-cyan-400 hover:underline"
          >
            + Create your first tip
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#334155] bg-[#1E293B] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0B0F19] text-[#94A3B8] font-mono border-b border-[#334155]">
                <tr>
                  <th className="px-4 py-3">Tip / Card Title</th>
                  <th className="px-4 py-3">Language</th>
                  <th className="px-4 py-3">Difficulty</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Tip of Day</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]/60 text-[#CBD5E1]">
                {filteredTips.map((tip) => {
                  const langMeta = LANGUAGE_METADATA[tip.language] || LANGUAGE_METADATA.general;
                  const diffBadge = DIFFICULTY_BADGES[tip.difficulty] || DIFFICULTY_BADGES.beginner;

                  return (
                    <tr key={tip.id} className="hover:bg-[#0B0F19]/40 transition-colors">
                      <td className="px-4 py-3 max-w-sm">
                        <div className="font-bold text-white truncate">{tip.title}</div>
                        <div className="text-[11px] text-[#94A3B8] truncate">{tip.summary}</div>
                      </td>

                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[11px] font-mono border ${langMeta.bg} ${langMeta.border} ${langMeta.color}`}>
                          <span>{langMeta.icon}</span>
                          <span>{langMeta.name}</span>
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-mono border ${diffBadge.bg}`}>
                          {diffBadge.label}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold ${
                          tip.status === "published"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        }`}>
                          <span>{tip.status}</span>
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleFeatured(tip)}
                          title={tip.isFeatured ? "Featured as Tip of the Day" : "Set as Tip of the Day"}
                          className={`p-1.5 rounded-lg border transition-all ${
                            tip.isFeatured
                              ? "bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-md"
                              : "bg-[#0B0F19] border-[#334155] text-slate-500 hover:text-amber-400"
                          }`}
                        >
                          <Sparkles className="h-4 w-4" />
                        </button>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center space-x-1.5">
                          <button
                            onClick={() => openEditModal(tip)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-[#0B0F19] transition-all"
                            title="Edit Tip"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(tip.id, tip.title)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-[#0B0F19] transition-all"
                            title="Delete Tip"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* AUTHORING & EDITING MODAL */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="relative max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-[#334155] bg-[#0F172A] shadow-2xl flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#334155] px-6 py-4 bg-[#1E293B]/70 shrink-0">
              <h3 className="text-base font-extrabold text-white flex items-center space-x-2">
                <span>{editingTip ? "Edit Developer Tip" : "Author New Developer Tip"}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-[#94A3B8] hover:text-white bg-[#0B0F19] border border-[#334155]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-5">
              {/* Title & Summary */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-mono text-[#94A3B8] block mb-1">
                    Card Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Python: Fast Lookups with Dictionary Comprehensions"
                    className="w-full rounded-xl bg-[#0B0F19] border border-[#334155] px-3.5 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono text-[#94A3B8] block mb-1">
                    Short Summary (1-2 sentences) *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={formSummary}
                    onChange={(e) => setFormSummary(e.target.value)}
                    placeholder="Brief overview explaining what problem this solves..."
                    className="w-full rounded-xl bg-[#0B0F19] border border-[#334155] px-3.5 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Language, Category, Difficulty Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-mono text-[#94A3B8] block mb-1">Language</label>
                  <select
                    value={formLanguage}
                    onChange={(e) => setFormLanguage(e.target.value as TipLanguage)}
                    className="w-full rounded-xl bg-[#0B0F19] border border-[#334155] px-3 py-2 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="python">Python 🐍</option>
                    <option value="typescript">TypeScript ⚡</option>
                    <option value="javascript">JavaScript 🟨</option>
                    <option value="dart">Dart / Flutter 🎯</option>
                    <option value="rust">Rust 🦀</option>
                    <option value="java">Java ☕</option>
                    <option value="sql">SQL &amp; DB 🗄️</option>
                    <option value="git">Git &amp; CLI 🐙</option>
                    <option value="cleancode">Clean Code 🧠</option>
                    <option value="general">General Dev 💡</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono text-[#94A3B8] block mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as TipCategory)}
                    className="w-full rounded-xl bg-[#0B0F19] border border-[#334155] px-3 py-2 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="syntax">Syntax Superpowers</option>
                    <option value="performance">Performance &amp; Scale</option>
                    <option value="best-practices">Clean Code Practices</option>
                    <option value="tooling">Git &amp; CLI Tooling</option>
                    <option value="architecture">Architecture &amp; Design</option>
                    <option value="debugging">Debugging</option>
                    <option value="security">Security</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono text-[#94A3B8] block mb-1">Difficulty</label>
                  <select
                    value={formDifficulty}
                    onChange={(e) => setFormDifficulty(e.target.value as TipDifficulty)}
                    className="w-full rounded-xl bg-[#0B0F19] border border-[#334155] px-3 py-2 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="pro">Pro Trick</option>
                  </select>
                </div>
              </div>

              {/* Tags & Why It Matters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-mono text-[#94A3B8] block mb-1">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="python, clean-code, algorithms"
                    className="w-full rounded-xl bg-[#0B0F19] border border-[#334155] px-3.5 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono text-[#94A3B8] block mb-1">
                    Why This Matters (1-liner punchline)
                  </label>
                  <input
                    type="text"
                    value={formWhyItMatters}
                    onChange={(e) => setFormWhyItMatters(e.target.value)}
                    placeholder="e.g. Standard question in tech screening interviews."
                    className="w-full rounded-xl bg-[#0B0F19] border border-[#334155] px-3.5 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Code Snippets Section */}
              <div className="space-y-4 pt-2 border-t border-[#334155]">
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider block">
                  Code Comparison
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Naive Code */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-mono text-rose-400 font-bold">
                        ❌ Common Naive Way (Optional)
                      </label>
                      <input
                        type="text"
                        value={formBadCodeTitle}
                        onChange={(e) => setFormBadCodeTitle(e.target.value)}
                        placeholder="Label"
                        className="rounded-lg bg-[#0B0F19] border border-[#334155] px-2 py-0.5 text-[11px] text-white"
                      />
                    </div>
                    <textarea
                      rows={6}
                      value={formBadCode}
                      onChange={(e) => setFormBadCode(e.target.value)}
                      placeholder="# The old / slow / verbose way..."
                      className="w-full rounded-xl bg-[#0B0F19] border border-rose-500/30 p-3 text-xs font-mono text-[#CBD5E1] focus:border-rose-400 focus:outline-none"
                    />
                  </div>

                  {/* Pro Code */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-mono text-emerald-400 font-bold">
                        ✅ Recommended Pro Way *
                      </label>
                      <input
                        type="text"
                        value={formGoodCodeTitle}
                        onChange={(e) => setFormGoodCodeTitle(e.target.value)}
                        placeholder="Label"
                        className="rounded-lg bg-[#0B0F19] border border-[#334155] px-2 py-0.5 text-[11px] text-white"
                      />
                    </div>
                    <textarea
                      rows={6}
                      required
                      value={formGoodCode}
                      onChange={(e) => setFormGoodCode(e.target.value)}
                      placeholder="# The modern / idiomatic way..."
                      className="w-full rounded-xl bg-[#0B0F19] border border-emerald-500/30 p-3 text-xs font-mono text-[#E2E8F0] focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Deep Dive Explanation (Markdown) */}
              <div className="space-y-2 pt-2 border-t border-[#334155]">
                <label className="text-xs font-mono text-[#94A3B8] block">
                  Detailed Explanation (Supports Markdown &amp; Bullet Points)
                </label>
                <textarea
                  rows={5}
                  value={formExplanation}
                  onChange={(e) => setFormExplanation(e.target.value)}
                  placeholder="### Why this works under the hood..."
                  className="w-full rounded-xl bg-[#0B0F19] border border-[#334155] p-3 text-xs text-[#CBD5E1] focus:border-cyan-400 focus:outline-none"
                />
              </div>

              {/* Documentation URL */}
              <div>
                <label className="text-xs font-mono text-[#94A3B8] block mb-1">
                  Official Documentation URL (Optional)
                </label>
                <input
                  type="url"
                  value={formDocsUrl}
                  onChange={(e) => setFormDocsUrl(e.target.value)}
                  placeholder="https://docs.python.org/..."
                  className="w-full rounded-xl bg-[#0B0F19] border border-[#334155] px-3.5 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>

              {/* Status & Featured Toggles */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-[#334155]">
                <div className="flex items-center space-x-5">
                  <label className="flex items-center space-x-2 text-xs font-mono text-[#CBD5E1] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formStatus === "published"}
                      onChange={(e) => setFormStatus(e.target.checked ? "published" : "draft")}
                      className="h-4 w-4 rounded accent-cyan-400"
                    />
                    <span>Publish live on site</span>
                  </label>

                  <label className="flex items-center space-x-2 text-xs font-mono text-amber-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsFeatured}
                      onChange={(e) => setFormIsFeatured(e.target.checked)}
                      className="h-4 w-4 rounded accent-amber-400"
                    />
                    <span>Feature as "Tip of the Day" ⭐</span>
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-[#94A3B8] hover:text-white bg-[#0B0F19] border border-[#334155]"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2 rounded-xl text-xs font-extrabold text-slate-950 bg-cyan-400 hover:bg-cyan-500 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : (editingTip ? "Save Changes" : "Create Tip Card")}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
