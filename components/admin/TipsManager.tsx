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
  Copy,
  ImageIcon,
  Upload,
  ArrowUp,
  ArrowDown,
  Bot
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TipsManagerProps {
  adminUser?: UserProfile | null;
}

export const GEMINI_PROMPT_TEMPLATE = `You are an elite Senior Engineer and Computer Science Teacher.
Generate a high-impact Developer Tip for students in JSON format.

A tip can be:
1. A CODE TIP: comparing a naive/slow anti-pattern vs an idiomatic, clean, recommended pro way.
2. A VISUAL / CONCEPT TIP: architecture patterns, system design, git workflows, interview insights, or cheatsheets without requiring code snippets.

Respond with ONLY valid JSON strictly matching this schema:
{
  "title": "Short punchy title (e.g. Python: Fast Lookups with Dictionary Comprehensions)",
  "summary": "1-2 sentence overview explaining the problem and solution.",
  "language": "python" | "typescript" | "javascript" | "dart" | "rust" | "java" | "sql" | "git" | "cleancode" | "general",
  "category": "syntax" | "performance" | "best-practices" | "debugging" | "architecture" | "security" | "tooling",
  "difficulty": "beginner" | "intermediate" | "pro",
  "tags": ["tag1", "tag2"],
  "whyItMatters": "1-liner punchline explaining why engineers must know this.",
  "goodCode": "Optional: Recommended Pro Code snippet (leave empty string if concept-only)",
  "goodCodeTitle": "Optional label (e.g. Recommended Pro Way)",
  "badCode": "Optional: Naive / Anti-pattern code (leave empty string if none)",
  "badCodeTitle": "Optional label (e.g. Common Naive Approach)",
  "explanation": "Detailed Markdown explanation covering how it works under the hood, edge cases, and best practices.",
  "documentationUrl": "Optional official docs link (e.g. https://docs.python.org/...)"
}`;

export default function TipsManager({ adminUser }: TipsManagerProps) {
  const [tips, setTips] = useState<DeveloperTip[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterLang, setFilterLang] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTip, setEditingTip] = useState<DeveloperTip | null>(null);

  // Gemini Importer Modal State
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);
  const [geminiPasteText, setGeminiPasteText] = useState("");
  const [geminiParseError, setGeminiParseError] = useState<string | null>(null);
  const [geminiCopied, setGeminiCopied] = useState(false);

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
  
  // Media / Slideshow Images State
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formImageCaptions, setFormImageCaptions] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState("");

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
    setFormImages([]);
    setFormImageCaptions([]);
    setImageUrlInput("");
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
    setFormImages(tip.images ? [...tip.images] : []);
    setFormImageCaptions(tip.imageCaptions ? [...tip.imageCaptions] : (tip.images ? tip.images.map(() => "") : []));
    setImageUrlInput("");
    setIsModalOpen(true);
  };

  // Image Upload & Slide Management Handlers
  const handleImageFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          setFormImages((prev) => [...prev, result]);
          setFormImageCaptions((prev) => [...prev, file.name.replace(/\.[^/.]+$/, "")]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddImageUrl = () => {
    if (!imageUrlInput.trim()) return;
    setFormImages((prev) => [...prev, imageUrlInput.trim()]);
    setFormImageCaptions((prev) => [...prev, ""]);
    setImageUrlInput("");
  };

  const handleRemoveImage = (index: number) => {
    setFormImages((prev) => prev.filter((_, idx) => idx !== index));
    setFormImageCaptions((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleMoveImage = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= formImages.length) return;
    const newImgs = [...formImages];
    const newCaps = [...formImageCaptions];
    [newImgs[index], newImgs[targetIndex]] = [newImgs[targetIndex], newImgs[index]];
    [newCaps[index], newCaps[targetIndex]] = [newCaps[targetIndex], newCaps[index]];
    setFormImages(newImgs);
    setFormImageCaptions(newCaps);
  };

  const handleCaptionChange = (index: number, text: string) => {
    setFormImageCaptions((prev) => {
      const updated = [...prev];
      updated[index] = text;
      return updated;
    });
  };

  // Gemini Importer Handler
  const handleApplyGeminiJson = () => {
    setGeminiParseError(null);
    try {
      let clean = geminiPasteText.trim();
      if (clean.startsWith("```json")) {
        clean = clean.replace(/^```json/, "").replace(/```$/, "").trim();
      } else if (clean.startsWith("```")) {
        clean = clean.replace(/^```/, "").replace(/```$/, "").trim();
      }
      const data = JSON.parse(clean);
      if (!data.title) {
        throw new Error("Missing required 'title' field in JSON.");
      }
      setFormTitle(data.title || "");
      if (data.summary) setFormSummary(data.summary);
      if (data.language) setFormLanguage(data.language);
      if (data.category) setFormCategory(data.category);
      if (data.difficulty) setFormDifficulty(data.difficulty);
      if (data.tags) {
        setFormTags(Array.isArray(data.tags) ? data.tags.join(", ") : data.tags);
      }
      if (data.goodCode) setFormGoodCode(data.goodCode);
      if (data.goodCodeTitle) setFormGoodCodeTitle(data.goodCodeTitle);
      if (data.badCode) setFormBadCode(data.badCode);
      if (data.badCodeTitle) setFormBadCodeTitle(data.badCodeTitle);
      if (data.explanation) setFormExplanation(data.explanation);
      if (data.whyItMatters) setFormWhyItMatters(data.whyItMatters);
      if (data.documentationUrl) setFormDocsUrl(data.documentationUrl);
      if (Array.isArray(data.images) && data.images.length > 0) {
        setFormImages(data.images);
        setFormImageCaptions(data.images.map(() => ""));
      }

      setIsGeminiModalOpen(false);
      setGeminiPasteText("");
      showToast("Gemini Developer Tip parsed & autofilled!");
    } catch (err: any) {
      setGeminiParseError(err.message || "Invalid JSON syntax. Please check Gemini output.");
    }
  };

  const handleCopyGeminiPrompt = async () => {
    try {
      await navigator.clipboard.writeText(GEMINI_PROMPT_TEMPLATE);
      setGeminiCopied(true);
      setTimeout(() => setGeminiCopied(false), 2500);
    } catch (e) {}
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert("Please provide at least a title for this tip.");
      return;
    }

    if (!formGoodCode.trim() && formImages.length === 0 && !formSummary.trim() && !formExplanation.trim()) {
      alert("Please provide either a code snippet, at least one visual slide, or a summary/explanation.");
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
        goodCode: formGoodCode.trim() ? formGoodCode : undefined,
        goodCodeTitle: formGoodCode.trim() ? (formGoodCodeTitle.trim() || "Recommended Pro Way") : undefined,
        badCode: formBadCode.trim() ? formBadCode : undefined,
        badCodeTitle: formBadCode.trim() ? (formBadCodeTitle.trim() || "Common Naive Way") : undefined,
        images: formImages.length > 0 ? formImages : undefined,
        imageCaptions: formImages.length > 0 ? formImageCaptions : undefined,
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
            onClick={() => {
              setGeminiPasteText("");
              setGeminiParseError(null);
              setIsGeminiModalOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-bold bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/40 text-purple-300 hover:text-white hover:border-purple-400 transition-all shadow-sm"
          >
            <Bot className="h-4 w-4 text-purple-400" />
            <span>AI Import with Gemini</span>
          </button>

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
              
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setGeminiPasteText("");
                    setGeminiParseError(null);
                    setIsGeminiModalOpen(true);
                  }}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 transition-all"
                  title="Autofill form by pasting JSON from Google Gemini"
                >
                  <Bot className="h-3.5 w-3.5" />
                  <span>Gemini Autofill</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-xl text-[#94A3B8] hover:text-white bg-[#0B0F19] border border-[#334155]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
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

              {/* Visual Slideshow & Image Attachments Section */}
              <div className="space-y-3 pt-2 border-t border-[#334155]">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold text-white uppercase tracking-wider block flex items-center space-x-1.5">
                      <ImageIcon className="h-4 w-4 text-cyan-400" />
                      <span>Visual Slideshow &amp; Image Attachments (Optional)</span>
                    </span>
                    <p className="text-[11px] text-[#94A3B8]">
                      Upload diagrams, infographics, or screenshots. Multiple images become a swipeable slide deck.
                    </p>
                  </div>
                </div>

                {/* Upload & URL Input Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#0B0F19] p-3 rounded-2xl border border-[#334155]">
                  {/* File Upload */}
                  <div>
                    <label className="text-[11px] font-mono text-[#CBD5E1] block mb-1.5 flex items-center space-x-1">
                      <Upload className="h-3 w-3 text-cyan-400" />
                      <span>Upload Image File(s)</span>
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleImageFiles(e.target.files)}
                      className="w-full text-xs text-[#94A3B8] file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-mono file:bg-cyan-500/20 file:text-cyan-300 hover:file:bg-cyan-500/30 cursor-pointer"
                    />
                  </div>

                  {/* Direct Image URL */}
                  <div>
                    <label className="text-[11px] font-mono text-[#CBD5E1] block mb-1.5">
                      Or Add by Image URL
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="url"
                        placeholder="https://example.com/diagram.png"
                        value={imageUrlInput}
                        onChange={(e) => setImageUrlInput(e.target.value)}
                        className="flex-1 rounded-xl bg-[#121826] border border-[#334155] px-3 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddImageUrl}
                        className="px-3 py-1.5 rounded-xl bg-[#1E293B] hover:bg-cyan-500 hover:text-slate-950 text-xs font-mono font-bold text-white border border-[#334155] transition-all"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* Attached Slides Preview & Captioning */}
                {formImages.length > 0 && (
                  <div className="space-y-2 mt-2">
                    <span className="text-[11px] font-mono text-[#94A3B8] block">
                      {formImages.length} {formImages.length === 1 ? "Slide Attached" : "Slides Attached"} (Reorder with arrows):
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {formImages.map((img, idx) => (
                        <div
                          key={idx}
                          className="flex items-center space-x-3 rounded-xl border border-[#334155] bg-[#0B0F19] p-2.5 relative"
                        >
                          <div className="relative h-14 w-20 shrink-0 rounded-lg overflow-hidden border border-[#334155] bg-slate-950 flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img} alt={`Slide ${idx + 1}`} className="w-full h-full object-cover" />
                            <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-black/80 text-[9px] font-mono text-cyan-300">
                              #{idx + 1}
                            </span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              value={formImageCaptions[idx] || ""}
                              onChange={(e) => handleCaptionChange(idx, e.target.value)}
                              placeholder={`Slide ${idx + 1} Caption (Optional)`}
                              className="w-full rounded-lg bg-[#121826] border border-[#334155] px-2 py-1 text-xs text-white focus:border-cyan-400 focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center space-x-1 shrink-0">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveImage(idx, "up")}
                              className="p-1 rounded text-[#94A3B8] hover:text-white disabled:opacity-30"
                              title="Move Slide Up"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === formImages.length - 1}
                              onClick={() => handleMoveImage(idx, "down")}
                              className="p-1 rounded text-[#94A3B8] hover:text-white disabled:opacity-30"
                              title="Move Slide Down"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(idx)}
                              className="p-1 rounded text-rose-400 hover:bg-rose-500/20"
                              title="Remove Slide"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Code Snippets Section (Optional) */}
              <div className="space-y-4 pt-2 border-t border-[#334155]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider block">
                    Code Comparison (Optional)
                  </span>
                  <span className="text-[11px] text-[#64748B] font-mono">
                    Leave blank if this is a concept, diagram, or visual slide tip
                  </span>
                </div>

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
                        ✅ Recommended Pro Way (Optional)
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

      {/* ========================================================================= */}
      {/* GOOGLE GEMINI AI IMPORTER MODAL */}
      {/* ========================================================================= */}
      {isGeminiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-purple-500/40 bg-[#0F172A] shadow-2xl flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#334155] px-6 py-4 bg-[#1E293B]/80 shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Google Gemini Tip Importer</h3>
                  <p className="text-[11px] text-[#94A3B8] font-mono">Generate tips in Gemini, then paste the JSON here to autofill</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsGeminiModalOpen(false)}
                className="p-1.5 rounded-xl text-[#94A3B8] hover:text-white bg-[#0B0F19] border border-[#334155]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Importer Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Step 1: Copy Prompt Template */}
              <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-purple-300 text-xs">
                    Step 1 &bull; Copy Gemini Prompt Template
                  </span>

                  <button
                    type="button"
                    onClick={handleCopyGeminiPrompt}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold bg-purple-500 hover:bg-purple-600 text-white transition-all shadow-md active:scale-95"
                  >
                    {geminiCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Prompt for Gemini</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-[11px] text-[#CBD5E1] leading-relaxed">
                  Paste this prompt into Google Gemini along with any specific topic you want (e.g. <em>"Give me a tip on Python list comprehension vs generator expressions"</em> or <em>"A tip on Git rebase vs merge"</em>). Gemini will respond in the exact JSON format needed.
                </p>
              </div>

              {/* Step 2: Paste Output */}
              <div className="space-y-2">
                <label className="font-mono font-bold text-white block flex items-center justify-between">
                  <span>Step 2 &bull; Paste Gemini's JSON Output Below:</span>
                  <span className="text-[10px] text-[#64748B] font-normal">Supports markdown code blocks or raw JSON</span>
                </label>

                <textarea
                  rows={9}
                  value={geminiPasteText}
                  onChange={(e) => {
                    setGeminiPasteText(e.target.value);
                    if (geminiParseError) setGeminiParseError(null);
                  }}
                  placeholder={'{\n  "title": "Python: Generator Expressions for Low Memory",\n  "summary": "...",\n  "language": "python",\n  "difficulty": "intermediate",\n  "goodCode": "...",\n  "explanation": "..."\n}'}
                  className="w-full rounded-2xl bg-[#0B0F19] border border-[#334155] p-3.5 font-mono text-xs text-[#E2E8F0] focus:border-purple-400 focus:outline-none"
                />
              </div>

              {/* Error Banner */}
              {geminiParseError && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300 font-mono">
                  {geminiParseError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-[#334155] px-6 py-4 bg-[#1E293B]/60 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setIsGeminiModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#94A3B8] hover:text-white bg-[#0B0F19] border border-[#334155]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  handleApplyGeminiJson();
                  setIsModalOpen(true);
                }}
                disabled={!geminiPasteText.trim()}
                className="inline-flex items-center space-x-2 px-6 py-2 rounded-xl text-xs font-extrabold text-slate-950 bg-gradient-to-r from-purple-400 to-cyan-400 hover:from-purple-500 hover:to-cyan-500 transition-all shadow-lg active:scale-95 disabled:opacity-40"
              >
                <Sparkles className="h-4 w-4" />
                <span>Parse &amp; Autofill Form</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
