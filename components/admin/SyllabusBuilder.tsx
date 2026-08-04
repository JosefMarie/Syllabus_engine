"use client";

import React, { useState } from "react";
import { Syllabus, LearningOutcome, IndicativeContent, Topic, Subtopic } from "@/types/syllabus";
import { parseSyllabusWithGemini } from "@/lib/gemini";
import { saveSyllabus, getAllTrades } from "@/lib/db";
import { useRouter } from "next/navigation";
import { Trade, StudentLevel } from "@/types/auth";
import { 
  Sparkles, 
  Plus, 
  Trash2, 
  Save, 
  FileText, 
  Code2, 
  BookOpen, 
  Layers, 
  Award, 
  FolderGit2, 
  FileCode, 
  CheckCircle2,
  Upload,
  Eye,
  Sliders
} from "lucide-react";

interface Props {
  initialSyllabus?: Syllabus | null;
}

export default function SyllabusBuilder({ initialSyllabus }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'scratch' | 'ai'>('ai');
  const [tradesList, setTradesList] = useState<Trade[]>([]);

  React.useEffect(() => {
    async function loadTrades() {
      const list = await getAllTrades();
      setTradesList(list);
    }
    loadTrades();
  }, []);

  // Syllabus Form State
  const [syllabus, setSyllabus] = useState<Syllabus>(
    initialSyllabus || {
      id: `syllabus-${Date.now()}`,
      title: "New Modern Software Syllabus",
      courseCode: "CS202",
      department: "Computer Science & Engineering",
      instructor: "Instructor Name",
      description: "Comprehensive software development syllabus.",
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      learningOutcomes: [
        {
          id: `lo-init-${Date.now()}`,
          code: "LO1",
          order: 1,
          title: "Primary Learning Objective",
          description: "Description of objective",
          indicativeContents: [
            {
              id: `ic-init-${Date.now()}`,
              code: "IC1.1",
              order: 1,
              title: "Indicative Module Content",
              topics: [
                {
                  id: `top-init-${Date.now()}`,
                  order: 1,
                  title: "Topic 1",
                  subtopics: [
                    {
                      id: `sub-init-${Date.now()}`,
                      order: 1,
                      title: "Introduction to Subtopic",
                      contentMarkdown: "### Welcome to the Course\nWrite markdown content here.",
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  );

  // AI Extractor State
  const [rawText, setRawText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractSuccess, setExtractSuccess] = useState<string | null>(null);

  // Save Syllabus Action
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveSyllabus(syllabus);
      router.push(`/syllabus/${saved.id}`);
    } catch (e) {
      console.error("Save error:", e);
      setSaving(false);
    }
  };

  const handleExtractAI = async () => {
    if (!rawText.trim()) return;
    setExtracting(true);
    setExtractSuccess(null);
    try {
      const result = await parseSyllabusWithGemini(rawText);
      setSyllabus(result.syllabus);
      setExtractSuccess(`Successfully extracted ${result.extractedCount.los} LOs, ${result.extractedCount.ics} ICs, and ${result.extractedCount.citations} citations!`);
      setActiveTab('scratch');
    } catch (err: any) {
      console.error("AI Extraction failed:", err);
      alert(`Extraction failed: ${err.message || err}`);
    } finally {
      setExtracting(false);
    }
  };

  // 5-Level Node Mutators
  const addLO = () => {
    const loNum = syllabus.learningOutcomes.length + 1;
    const newLO: LearningOutcome = {
      id: `lo-${Date.now()}`,
      code: `LO${loNum}`,
      order: loNum,
      title: `Learning Outcome ${loNum}`,
      indicativeContents: []
    };
    setSyllabus({
      ...syllabus,
      learningOutcomes: [...syllabus.learningOutcomes, newLO]
    });
  };

  const deleteLO = (loId: string) => {
    setSyllabus({
      ...syllabus,
      learningOutcomes: syllabus.learningOutcomes.filter(lo => lo.id !== loId)
    });
  };

  const addIC = (loId: string) => {
    const lo = syllabus.learningOutcomes.find(l => l.id === loId);
    if (!lo) return;
    const icNum = lo.indicativeContents.length + 1;
    const newIC: IndicativeContent = {
      id: `ic-${Date.now()}`,
      code: `IC${lo.order}.${icNum}`,
      order: icNum,
      title: `Indicative Content ${icNum}`,
      topics: []
    };
    setSyllabus({
      ...syllabus,
      learningOutcomes: syllabus.learningOutcomes.map(l => 
        l.id === loId ? { ...l, indicativeContents: [...l.indicativeContents, newIC] } : l
      )
    });
  };

  const addTopic = (loId: string, icId: string) => {
    const newTopic: Topic = {
      id: `top-${Date.now()}`,
      order: 1,
      title: "New Topic",
      subtopics: []
    };
    setSyllabus({
      ...syllabus,
      learningOutcomes: syllabus.learningOutcomes.map(lo => 
        lo.id === loId ? {
          ...lo,
          indicativeContents: lo.indicativeContents.map(ic => 
            ic.id === icId ? { ...ic, topics: [...ic.topics, newTopic] } : ic
          )
        } : lo
      )
    });
  };

  const addSubtopic = (loId: string, icId: string, topicId: string) => {
    const newSub: Subtopic = {
      id: `sub-${Date.now()}`,
      order: 1,
      title: "New Subtopic",
      contentMarkdown: "### New Content Section\nWrite subtopic markdown content here."
    };
    setSyllabus({
      ...syllabus,
      learningOutcomes: syllabus.learningOutcomes.map(lo => 
        lo.id === loId ? {
          ...lo,
          indicativeContents: lo.indicativeContents.map(ic => 
            ic.id === icId ? {
              ...ic,
              topics: ic.topics.map(top => 
                top.id === topicId ? { ...top, subtopics: [...top.subtopics, newSub] } : top
              )
            } : ic
          )
        } : lo
      )
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Creation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#334155] pb-6 gap-4">
        <div>
          <span className="text-xs font-mono text-[#06B6D4] uppercase tracking-wider">
            Teacher Admin Portal
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Syllabus Creation & Review Editor
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          {/* Draft vs Published Toggle */}
          <div className="flex items-center rounded-xl bg-[#1E293B] p-1 border border-[#334155]">
            <button
              onClick={() => setSyllabus({ ...syllabus, status: 'draft' })}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                syllabus.status === 'draft' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : 'text-[#94A3B8]'
              }`}
            >
              Draft Mode
            </button>
            <button
              onClick={() => setSyllabus({ ...syllabus, status: 'published' })}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                syllabus.status === 'published' ? 'bg-[#10B981]/20 text-[#10B981]' : 'text-[#94A3B8]'
              }`}
            >
              Published
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center space-x-2 rounded-xl bg-[#06B6D4] px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-lg"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving...' : 'Save & Publish'}</span>
          </button>
        </div>
      </div>

      {/* Creation Mode Tabs */}
      <div className="mt-6 flex space-x-4 border-b border-[#334155]">
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex items-center space-x-2 border-b-2 pb-3 text-sm font-bold transition-all ${
            activeTab === 'ai'
              ? 'border-[#06B6D4] text-[#06B6D4]'
              : 'border-transparent text-[#94A3B8] hover:text-white'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>Path 1: AI Syllabus Extractor (Gemini 2.5 Pro)</span>
        </button>

        <button
          onClick={() => setActiveTab('scratch')}
          className={`flex items-center space-x-2 border-b-2 pb-3 text-sm font-bold transition-all ${
            activeTab === 'scratch'
              ? 'border-[#06B6D4] text-[#06B6D4]'
              : 'border-transparent text-[#94A3B8] hover:text-white'
          }`}
        >
          <Sliders className="h-4 w-4" />
          <span>Path 2: Visual 5-Level Tree Builder</span>
        </button>
      </div>

      {/* TAB 1: AI SYLLABUS EXTRACTOR */}
      {activeTab === 'ai' && (
        <div className="mt-6 space-y-6">
          <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-6 shadow-xl">
            <div className="flex items-center space-x-2 text-xs font-mono text-[#06B6D4] mb-2">
              <Sparkles className="h-4 w-4 text-[#06B6D4]" />
              <span>Automated 5-Level Document Extractor</span>
            </div>
            <h3 className="text-lg font-bold text-white">
              Upload or Paste Course Syllabus Document
            </h3>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Gemini 2.5 Pro will parse raw document text into the 5-level hierarchy, auto-extract technical terms into citations, and generate code runner snippets.
            </p>

            <div className="mt-4">
              <textarea
                rows={8}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste course syllabus document text here (PDF, Word, or TXT content)..."
                className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-4 text-xs font-mono text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
              />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs font-mono text-[#94A3B8]">
                Length: {rawText.length} characters
              </span>

              <button
                onClick={handleExtractAI}
                disabled={extracting || !rawText.trim()}
                className="inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-[#06B6D4] to-[#10B981] px-6 py-3 text-xs font-bold text-slate-950 hover:opacity-90 transition-all shadow-xl disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                <span>{extracting ? 'Parsing Document with Gemini...' : 'Extract 5-Level Syllabus'}</span>
              </button>
            </div>

            {extractSuccess && (
              <div className="mt-4 rounded-xl border border-[#10B981]/40 bg-[#10B981]/10 p-3 text-xs font-mono text-[#10B981] flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>{extractSuccess} Switch to the Visual Tree tab below to tweak details.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: VISUAL 5-LEVEL TREE BUILDER */}
      {activeTab === 'scratch' && (
        <div className="mt-6 space-y-6">
          {/* General Metadata */}
          <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Level 1: Syllabus Metadata
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-mono text-[#94A3B8]">Course Title</label>
                <input
                  type="text"
                  value={syllabus.title}
                  onChange={(e) => setSyllabus({ ...syllabus, title: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#334155] bg-[#0B0F19] p-2.5 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-[#94A3B8]">Course Code</label>
                <input
                  type="text"
                  value={syllabus.courseCode}
                  onChange={(e) => setSyllabus({ ...syllabus, courseCode: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#334155] bg-[#0B0F19] p-2.5 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-mono text-[#94A3B8]">Assigned Trade</label>
                <select
                  value={syllabus.tradeId || ''}
                  onChange={(e) => setSyllabus({ ...syllabus, tradeId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#334155] bg-[#0B0F19] p-2.5 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                >
                  <option value="">Select Trade...</option>
                  {tradesList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-mono text-[#94A3B8]">Assigned Level</label>
                <select
                  value={syllabus.level || 'Level 4'}
                  onChange={(e) => setSyllabus({ ...syllabus, level: e.target.value as StudentLevel })}
                  className="mt-1 w-full rounded-lg border border-[#334155] bg-[#0B0F19] p-2.5 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                >
                  <option value="Level 3">Level 3</option>
                  <option value="Level 4">Level 4</option>
                  <option value="Level 5">Level 5</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-[#94A3B8]">Course Overview & Objectives</label>
              <textarea
                rows={3}
                value={syllabus.description}
                onChange={(e) => setSyllabus({ ...syllabus, description: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[#334155] bg-[#0B0F19] p-2.5 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
              />
            </div>
          </div>

          {/* 5-Level Tree Interactive Editor */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Level 2 to Level 5 Hierarchy Tree
              </h3>
              <button
                onClick={addLO}
                className="inline-flex items-center space-x-1 rounded-lg bg-[#06B6D4]/10 border border-[#06B6D4]/40 px-3 py-1.5 text-xs font-semibold text-[#06B6D4] hover:bg-[#06B6D4]/20"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Learning Outcome (LO)</span>
              </button>
            </div>

            {syllabus.learningOutcomes.map((lo, loIdx) => (
              <div key={lo.id} className="rounded-2xl border border-[#334155] bg-[#1E293B] p-5 space-y-4">
                {/* Level 2: LO */}
                <div className="flex items-center justify-between gap-3 border-b border-[#334155] pb-3">
                  <div className="flex items-center space-x-2 flex-1">
                    <Award className="h-4 w-4 text-[#06B6D4]" />
                    <input
                      type="text"
                      value={lo.code}
                      onChange={(e) => {
                        const code = e.target.value;
                        setSyllabus({
                          ...syllabus,
                          learningOutcomes: syllabus.learningOutcomes.map(l => l.id === lo.id ? { ...l, code } : l)
                        });
                      }}
                      className="w-20 rounded bg-[#0B0F19] px-2 py-1 font-mono text-xs font-bold text-[#06B6D4] border border-[#334155]"
                    />
                    <input
                      type="text"
                      value={lo.title}
                      onChange={(e) => {
                        const title = e.target.value;
                        setSyllabus({
                          ...syllabus,
                          learningOutcomes: syllabus.learningOutcomes.map(l => l.id === lo.id ? { ...l, title } : l)
                        });
                      }}
                      className="flex-1 rounded bg-[#0B0F19] px-3 py-1 text-sm font-bold text-white border border-[#334155]"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => addIC(lo.id)}
                      className="rounded bg-[#F59E0B]/10 px-2.5 py-1 text-xs font-semibold text-[#F59E0B] border border-[#F59E0B]/30"
                    >
                      + Add IC
                    </button>
                    <button
                      onClick={() => deleteLO(lo.id)}
                      className="rounded bg-rose-500/10 p-1.5 text-rose-400 hover:bg-rose-500/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Level 3: IC */}
                <div className="pl-4 space-y-3">
                  {lo.indicativeContents.map((ic) => (
                    <div key={ic.id} className="rounded-xl border border-[#334155]/60 bg-[#0B0F19]/40 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3 border-b border-[#334155]/40 pb-2">
                        <div className="flex items-center space-x-2 flex-1">
                          <FolderGit2 className="h-4 w-4 text-[#F59E0B]" />
                          <input
                            type="text"
                            value={ic.code}
                            onChange={(e) => {
                              const code = e.target.value;
                              setSyllabus({
                                ...syllabus,
                                learningOutcomes: syllabus.learningOutcomes.map(l => 
                                  l.id === lo.id ? {
                                    ...l,
                                    indicativeContents: l.indicativeContents.map(i => i.id === ic.id ? { ...i, code } : i)
                                  } : l
                                )
                              });
                            }}
                            className="w-20 rounded bg-[#0B0F19] px-2 py-1 font-mono text-xs text-[#F59E0B] border border-[#334155]"
                          />
                          <input
                            type="text"
                            value={ic.title}
                            onChange={(e) => {
                              const title = e.target.value;
                              setSyllabus({
                                ...syllabus,
                                learningOutcomes: syllabus.learningOutcomes.map(l => 
                                  l.id === lo.id ? {
                                    ...l,
                                    indicativeContents: l.indicativeContents.map(i => i.id === ic.id ? { ...i, title } : i)
                                  } : l
                                )
                              });
                            }}
                            className="flex-1 rounded bg-[#0B0F19] px-3 py-1 text-xs font-semibold text-white border border-[#334155]"
                          />
                        </div>
                        <button
                          onClick={() => addTopic(lo.id, ic.id)}
                          className="rounded bg-[#06B6D4]/10 px-2.5 py-1 text-xs font-semibold text-[#06B6D4]"
                        >
                          + Add Topic
                        </button>
                      </div>

                      {/* Level 4: Topic */}
                      <div className="pl-4 space-y-2">
                        {ic.topics.map((top) => (
                          <div key={top.id} className="rounded-lg border border-[#334155]/40 bg-[#1E293B]/40 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2 flex-1">
                                <Layers className="h-3.5 w-3.5 text-[#94A3B8]" />
                                <input
                                  type="text"
                                  value={top.title}
                                  onChange={(e) => {
                                    const title = e.target.value;
                                    setSyllabus({
                                      ...syllabus,
                                      learningOutcomes: syllabus.learningOutcomes.map(l => 
                                        l.id === lo.id ? {
                                          ...l,
                                          indicativeContents: l.indicativeContents.map(i => 
                                            i.id === ic.id ? {
                                              ...i,
                                              topics: i.topics.map(t => t.id === top.id ? { ...t, title } : t)
                                            } : i
                                          )
                                        } : l
                                      )
                                    });
                                  }}
                                  className="flex-1 rounded bg-[#0B0F19] px-2.5 py-1 text-xs font-semibold text-white border border-[#334155]"
                                />
                              </div>
                              <button
                                onClick={() => addSubtopic(lo.id, ic.id, top.id)}
                                className="rounded bg-[#10B981]/10 px-2 py-0.5 text-[11px] font-semibold text-[#10B981]"
                              >
                                + Add Subtopic
                              </button>
                            </div>

                            {/* Level 5: Subtopic */}
                            <div className="pl-4 space-y-2">
                              {top.subtopics.map((sub) => (
                                <div key={sub.id} className="rounded border border-[#334155]/30 bg-[#0B0F19] p-3 space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <FileCode className="h-3.5 w-3.5 text-[#10B981]" />
                                    <input
                                      type="text"
                                      value={sub.title}
                                      onChange={(e) => {
                                        const title = e.target.value;
                                        setSyllabus({
                                          ...syllabus,
                                          learningOutcomes: syllabus.learningOutcomes.map(l => 
                                            l.id === lo.id ? {
                                              ...l,
                                              indicativeContents: l.indicativeContents.map(i => 
                                                i.id === ic.id ? {
                                                  ...i,
                                                  topics: i.topics.map(t => 
                                                    t.id === top.id ? {
                                                      ...t,
                                                      subtopics: t.subtopics.map(s => s.id === sub.id ? { ...s, title } : s)
                                                    } : t
                                                  )
                                                } : i
                                              )
                                            } : l
                                          )
                                        });
                                      }}
                                      className="flex-1 rounded bg-[#1E293B] px-2.5 py-1 text-xs text-white border border-[#334155]"
                                    />
                                  </div>

                                  <textarea
                                    rows={3}
                                    value={sub.contentMarkdown}
                                    onChange={(e) => {
                                      const contentMarkdown = e.target.value;
                                      setSyllabus({
                                        ...syllabus,
                                        learningOutcomes: syllabus.learningOutcomes.map(l => 
                                          l.id === lo.id ? {
                                            ...l,
                                            indicativeContents: l.indicativeContents.map(i => 
                                              i.id === ic.id ? {
                                                ...i,
                                                topics: i.topics.map(t => 
                                                  t.id === top.id ? {
                                                    ...t,
                                                    subtopics: t.subtopics.map(s => s.id === sub.id ? { ...s, contentMarkdown } : s)
                                                  } : t
                                                )
                                              } : i
                                            )
                                          } : l
                                        )
                                      });
                                    }}
                                    placeholder="Subtopic Markdown Content..."
                                    className="w-full rounded bg-[#1E293B] p-2 text-xs font-mono text-[#CBD5E1] border border-[#334155]"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
