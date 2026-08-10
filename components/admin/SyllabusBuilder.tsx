"use client";

import React, { useState } from "react";
import { Syllabus, LearningOutcome, IndicativeContent, Topic, Subtopic } from "@/types/syllabus";
import { parseSyllabusWithGemini } from "@/lib/gemini";
import { saveSyllabus, getAllTrades } from "@/lib/db";
import { uploadFileToStorage } from "@/lib/storage";
import MarkdownEditor from "./MarkdownEditor";
import SandpackPlayground from "@/components/viewer/SandpackPlayground";
import { useRouter } from "next/navigation";
import { Trade, StudentLevel } from "@/types/auth";
import { downloadSyllabusAsJSON, downloadSyllabusAsText } from "@/lib/exportSyllabus";
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
  Sliders,
  Terminal,
  Download,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen
} from "lucide-react";

interface Props {
  initialSyllabus?: Syllabus | null;
}

export default function SyllabusBuilder({ initialSyllabus }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'scratch' | 'ai'>('scratch');
  const [tradesList, setTradesList] = useState<Trade[]>([]);

  // Split-Pane Active Navigation & Expansion State
  const [selectedKey, setSelectedKey] = useState<string>("course");
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [treeSearchQuery, setTreeSearchQuery] = useState<string>("");

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
      title: "",
      courseCode: "",
      department: "Computer Science & Engineering",
      instructor: "Instructor Name",
      description: "",
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      learningOutcomes: [
        {
          id: `lo-init-${Date.now()}`,
          code: "LO1",
          order: 1,
          title: "Primary Learning Outcome",
          description: "Overview of learning goals for this outcome.",
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
                  title: "Topic 1: Core Fundamentals",
                  subtopics: [
                    {
                      id: `sub-init-${Date.now()}`,
                      order: 1,
                      title: "Subtopic 1.1: Getting Started",
                      contentMarkdown: "### Welcome to Subtopic 1.1\nWrite detailed course markdown content here...",
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

  // Auto expand initially
  React.useEffect(() => {
    if (syllabus.learningOutcomes.length > 0) {
      const initialMap: Record<string, boolean> = {};
      syllabus.learningOutcomes.forEach((lo) => {
        initialMap[`lo-${lo.id}`] = true;
        lo.indicativeContents.forEach((ic) => {
          initialMap[`ic-${ic.id}`] = true;
          ic.topics.forEach((top) => {
            initialMap[`topic-${top.id}`] = true;
          });
        });
      });
      setExpandedKeys(initialMap);
    }
  }, []);

  // AI Extractor State
  const [rawText, setRawText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractSuccess, setExtractSuccess] = useState<string | null>(null);
  
  // Drag and Drop File State
  const [isDragging, setIsDragging] = useState(false);
  const [extractingFile, setExtractingFile] = useState(false);

  const toggleExpandKey = (key: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAllTree = () => {
    const map: Record<string, boolean> = {};
    syllabus.learningOutcomes.forEach(lo => {
      map[`lo-${lo.id}`] = true;
      lo.indicativeContents.forEach(ic => {
        map[`ic-${ic.id}`] = true;
        ic.topics.forEach(top => {
          map[`topic-${top.id}`] = true;
        });
      });
    });
    setExpandedKeys(map);
  };

  const collapseAllTree = () => {
    setExpandedKeys({});
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setExtractingFile(true);
    setExtractSuccess(null);

    try {
      let extractedText = "";

      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        // @ts-ignore
        const pdfjsLib = await import('pdfjs-dist');
        try {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
        } catch (e) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str + (item.hasEOL ? '\n' : ' '))
            .join('');
          fullText += pageText + '\n';
        }
        extractedText = fullText;
      } else if (file.type.includes("text") || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
        extractedText = await file.text();
      } else {
        throw new Error("Unsupported file format. Please upload PDF or Text documents.");
      }

      if (!extractedText.trim()) {
        throw new Error("Extracted document is empty or could not be read.");
      }

      setRawText(extractedText);
      setExtractSuccess("Document text read! Starting AI 5-level hierarchy extraction...");

      uploadFileToStorage(file, "syllabi_docs")
        .then((url) => {
          setSyllabus(prev => ({ ...prev, documentUrl: url }));
        })
        .catch((err) => console.error("Failed to upload document to storage:", err));

      // Auto trigger AI extraction for instant seamless result
      await handleExtractAI(extractedText);

    } catch (err: any) {
      console.error("Extraction error:", err);
      alert(err.message || "An unexpected error occurred while parsing the file.");
    } finally {
      setExtractingFile(false);
    }
  };

  // Save Syllabus Action
  const [saving, setSaving] = useState(false);

  const handleSave = async (targetStatus: 'draft' | 'published' = 'published') => {
    setSaving(true);
    try {
      const updatedSyllabus = { ...syllabus, status: targetStatus };
      const saved = await saveSyllabus(updatedSyllabus);
      if (targetStatus === 'draft') {
        alert("Syllabus Saved as Draft!");
        router.push("/admin");
      } else {
        alert("Syllabus Published!");
        router.push(`/syllabus/view?id=${saved.id}`);
      }
    } catch (err: any) {
      console.error("Save error:", err);
      setSaving(false);
    }
  };

  const [extractionStatusStep, setExtractionStatusStep] = useState<string | null>(null);

  const handleExtractAI = async (textOverride?: string) => {
    const textToProcess = textOverride || rawText;
    if (!textToProcess.trim()) return;
    setExtracting(true);
    setExtractSuccess(null);
    setExtractionStatusStep("Step 1/3: Reading document text...");

    try {
      setTimeout(() => setExtractionStatusStep("Step 2/3: Parsing 5-Level Hierarchy (LOs, ICs, Key Readings)..."), 800);
      setTimeout(() => setExtractionStatusStep("Step 3/3: Auto-extracting Acronym Citations & Formatting..."), 1600);

      const result = await parseSyllabusWithGemini(textToProcess);
      setSyllabus(result.syllabus);
      
      const successMsg = `Successfully extracted ${result.extractedCount.los} LOs, ${result.extractedCount.ics} ICs, ${result.extractedCount.topics} Topics, ${result.extractedCount.subtopics} Subtopics, and ${result.extractedCount.citations} Automatic Acronym Citations across the entire document!`;
      setExtractSuccess(successMsg);
      setActiveTab('scratch');
      setSelectedKey("course");
      expandAllTree();
    } catch (err: any) {
      console.error("AI Extraction failed:", err);
      alert(`Extraction failed: ${err.message || err}`);
    } finally {
      setExtracting(false);
      setExtractionStatusStep(null);
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
    setExpandedKeys(prev => ({ ...prev, [`lo-${newLO.id}`]: true }));
    setSelectedKey(`lo-${newLO.id}`);
  };

  const deleteLO = (loId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm("Are you sure you want to delete this Learning Outcome and all nested contents?")) {
      setSyllabus({
        ...syllabus,
        learningOutcomes: syllabus.learningOutcomes.filter(lo => lo.id !== loId)
      });
      if (selectedKey === `lo-${loId}`) setSelectedKey("course");
    }
  };

  const addIC = (loId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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
    setExpandedKeys(prev => ({ ...prev, [`lo-${loId}`]: true, [`ic-${newIC.id}`]: true }));
    setSelectedKey(`ic-${newIC.id}`);
  };

  const deleteIC = (loId: string, icId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm("Are you sure you want to delete this Indicative Content?")) {
      setSyllabus({
        ...syllabus,
        learningOutcomes: syllabus.learningOutcomes.map(l => 
          l.id === loId ? {
            ...l,
            indicativeContents: l.indicativeContents.filter(i => i.id !== icId)
          } : l
        )
      });
      if (selectedKey === `ic-${icId}`) setSelectedKey(`lo-${loId}`);
    }
  };

  const addTopic = (loId: string, icId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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
    setExpandedKeys(prev => ({ ...prev, [`lo-${loId}`]: true, [`ic-${icId}`]: true, [`topic-${newTopic.id}`]: true }));
    setSelectedKey(`topic-${newTopic.id}`);
  };

  const deleteTopic = (loId: string, icId: string, topicId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm("Are you sure you want to delete this Topic?")) {
      setSyllabus({
        ...syllabus,
        learningOutcomes: syllabus.learningOutcomes.map(lo => 
          lo.id === loId ? {
            ...lo,
            indicativeContents: lo.indicativeContents.map(ic => 
              ic.id === icId ? {
                ...ic,
                topics: ic.topics.filter(t => t.id !== topicId)
              } : ic
            )
          } : lo
        )
      });
      if (selectedKey === `topic-${topicId}`) setSelectedKey(`ic-${icId}`);
    }
  };

  const addSubtopic = (loId: string, icId: string, topicId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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
    setExpandedKeys(prev => ({ ...prev, [`lo-${loId}`]: true, [`ic-${icId}`]: true, [`topic-${topicId}`]: true }));
    setSelectedKey(`sub-${newSub.id}`);
  };

  const deleteSubtopic = (loId: string, icId: string, topicId: string, subId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm("Delete this Subtopic?")) {
      setSyllabus({
        ...syllabus,
        learningOutcomes: syllabus.learningOutcomes.map(lo => 
          lo.id === loId ? {
            ...lo,
            indicativeContents: lo.indicativeContents.map(ic => 
              ic.id === icId ? {
                ...ic,
                topics: ic.topics.map(top => 
                  top.id === topicId ? {
                    ...top,
                    subtopics: top.subtopics.filter(s => s.id !== subId)
                  } : top
                )
              } : ic
            )
          } : lo
        )
      });
      if (selectedKey === `sub-${subId}`) setSelectedKey(`topic-${topicId}`);
    }
  };

  // Helper to find selected items for detail editor workbench
  const getSelectedContext = () => {
    if (selectedKey === "course") return { type: "course" as const };

    for (const lo of syllabus.learningOutcomes) {
      if (selectedKey === `lo-${lo.id}`) return { type: "lo" as const, lo };

      for (const ic of lo.indicativeContents) {
        if (selectedKey === `ic-${ic.id}`) return { type: "ic" as const, lo, ic };

        for (const topic of ic.topics) {
          if (selectedKey === `topic-${topic.id}`) return { type: "topic" as const, lo, ic, topic };

          for (const subtopic of topic.subtopics) {
            if (selectedKey === `sub-${subtopic.id}`) return { type: "subtopic" as const, lo, ic, topic, subtopic };
          }
        }
      }
    }
    return { type: "course" as const };
  };

  const selectedCtx = getSelectedContext();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Top Creation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#334155] pb-6 gap-4">
        <div>
          <span className="text-xs font-mono text-[#06B6D4] uppercase tracking-wider font-bold">
            Teacher Admin Portal
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            5-Level Master-Detail Syllabus Workbench
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => downloadSyllabusAsText(syllabus)}
            className="inline-flex items-center space-x-1.5 rounded-xl border border-[#334155] bg-[#1E293B] px-3.5 py-2.5 text-xs font-bold text-[#06B6D4] hover:bg-[#334155] transition-all shadow-md"
            title="Download Formatted Text Document (.txt)"
          >
            <Download className="h-4 w-4" />
            <span>Download Doc</span>
          </button>

          <button
            onClick={() => downloadSyllabusAsJSON(syllabus)}
            className="inline-flex items-center space-x-1.5 rounded-xl border border-[#334155] bg-[#1E293B] px-3.5 py-2.5 text-xs font-bold text-[#10B981] hover:bg-[#334155] transition-all shadow-md"
            title="Download Raw JSON Data (.json)"
          >
            <FileCode className="h-4 w-4" />
            <span>Download JSON</span>
          </button>

          <button
            onClick={() => handleSave('draft')}
            disabled={saving}
            className="inline-flex items-center space-x-2 rounded-xl border border-[#334155] bg-[#1E293B] px-4 py-2.5 text-xs font-bold text-[#CBD5E1] hover:bg-[#334155] hover:text-white transition-all shadow-md disabled:opacity-50"
          >
            <FileText className="h-4 w-4 text-[#F59E0B]" />
            <span>{saving ? 'Saving...' : 'Save Draft'}</span>
          </button>

          <button
            onClick={() => handleSave('published')}
            disabled={saving}
            className="inline-flex items-center space-x-2 rounded-xl bg-[#06B6D4] px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-lg disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving...' : 'Save & Publish'}</span>
          </button>
        </div>
      </div>

      {/* Creation Mode Tabs */}
      <div className="mt-6 flex space-x-4 border-b border-[#334155]">
        <button
          onClick={() => setActiveTab('scratch')}
          className={`flex items-center space-x-2 border-b-2 pb-3 text-sm font-bold transition-all ${
            activeTab === 'scratch'
              ? 'border-[#06B6D4] text-[#06B6D4]'
              : 'border-transparent text-[#94A3B8] hover:text-white'
          }`}
        >
          <Sliders className="h-4 w-4" />
          <span>Path 1: Split-Panel Master-Detail Builder</span>
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`flex items-center space-x-2 border-b-2 pb-3 text-sm font-bold transition-all ${
            activeTab === 'ai'
              ? 'border-[#06B6D4] text-[#06B6D4]'
              : 'border-transparent text-[#94A3B8] hover:text-white'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>Path 2: AI Document Extractor (Gemini 2.5 Pro)</span>
        </button>
      </div>

      {/* TAB 2: AI SYLLABUS EXTRACTOR */}
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

            {/* AI Metadata Inputs */}
            <div className="mt-6 border-t border-[#334155] pt-6">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono mb-4">
                Target Syllabus Metadata
              </h4>
              <div className="grid gap-4 sm:grid-cols-2 mb-4">
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
              
              <div className="grid gap-4 sm:grid-cols-2 mb-6">
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
            </div>

            <div className="mt-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                className={`relative mb-4 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
                  isDragging 
                    ? "border-[#06B6D4] bg-[#06B6D4]/10" 
                    : "border-[#334155] bg-[#0B0F19]/50 hover:border-[#06B6D4]/50"
                }`}
              >
                <Upload className="mx-auto h-8 w-8 text-[#06B6D4] mb-2" />
                <p className="text-xs font-semibold text-white">
                  {extractingFile ? "Reading Document File..." : "Drag and drop your Syllabus PDF or Text file here"}
                </p>
                <span className="text-[10px] text-[#94A3B8] mt-1">Supports .pdf, .txt, .md formats</span>

                <input
                  type="file"
                  accept=".pdf,.txt,.md"
                  onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>

              <textarea
                rows={8}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Or paste course syllabus document text here manually..."
                className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-4 text-xs font-mono text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
              />
            </div>

            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <span className="text-xs font-mono text-[#94A3B8]">
                  Length: {rawText.length} characters
                </span>
                {extractionStatusStep && (
                  <span className="text-xs font-mono text-[#06B6D4] animate-pulse font-bold bg-[#06B6D4]/10 px-2.5 py-1 rounded-lg border border-[#06B6D4]/30">
                    ⚡ {extractionStatusStep}
                  </span>
                )}
              </div>

              <button
                onClick={() => handleExtractAI()}
                disabled={extracting || !rawText.trim()}
                className="inline-flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-[#06B6D4] to-[#10B981] px-6 py-3 text-xs font-bold text-slate-950 hover:opacity-90 transition-all shadow-xl disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                <span>{extracting ? 'Processing 300+ Page Document...' : 'Extract 5-Level Syllabus'}</span>
              </button>
            </div>

            {extractSuccess && (
              <div className="mt-4 rounded-xl border border-[#10B981]/40 bg-[#10B981]/10 p-3 text-xs font-mono text-[#10B981] flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{extractSuccess} Loading into Master-Detail workbench...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: SPLIT-PANEL MASTER-DETAIL BUILDER */}
      {activeTab === 'scratch' && (
        <div className="mt-6 flex flex-col lg:flex-row gap-6 min-h-[700px] items-start">
          {/* LEFT COLUMN: 5-LEVEL TREE NAVIGATION PANEL (Master - 320px) */}
          <div className="w-full lg:w-80 rounded-2xl border border-[#334155] bg-[#1E293B] p-4 flex flex-col shrink-0 shadow-xl self-stretch">
            <div className="border-b border-[#334155] pb-3 mb-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Folder className="h-4 w-4 text-[#06B6D4]" />
                  <span>Syllabus Hierarchy</span>
                </span>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={expandAllTree}
                    className="rounded px-2 py-1 text-[10px] font-mono text-[#06B6D4] hover:bg-[#06B6D4]/10 transition-colors"
                    title="Expand All Nodes"
                  >
                    Expand
                  </button>
                  <button
                    onClick={collapseAllTree}
                    className="rounded px-2 py-1 text-[10px] font-mono text-[#94A3B8] hover:bg-[#334155] transition-colors"
                    title="Collapse All Nodes"
                  >
                    Collapse
                  </button>
                </div>
              </div>

              {/* Tree Quick Search Input */}
              <input
                type="text"
                value={treeSearchQuery}
                onChange={(e) => setTreeSearchQuery(e.target.value)}
                placeholder="🔍 Search LOs, ICs, Topics..."
                className="w-full rounded-lg border border-[#334155] bg-[#0B0F19] px-2.5 py-1.5 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
              />
            </div>

            {/* Tree Navigation Container */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[650px]">
              {/* Level 1: Course Metadata Node */}
              <div
                onClick={() => setSelectedKey("course")}
                className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-xs cursor-pointer transition-all border ${
                  selectedKey === "course"
                    ? "border-[#06B6D4] bg-[#06B6D4]/15 font-bold text-white shadow-md"
                    : "border-transparent text-[#CBD5E1] hover:bg-[#0B0F19]/60 hover:text-white"
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <BookOpen className="h-4 w-4 text-[#06B6D4] shrink-0" />
                  <span className="truncate">
                    {syllabus.courseCode || "General"} - {syllabus.title || "Untitled Course"}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#06B6D4] font-bold shrink-0">L1</span>
              </div>

              {/* Add LO Quick Action */}
              <button
                onClick={addLO}
                className="w-full flex items-center justify-center space-x-1.5 rounded-xl border border-dashed border-[#06B6D4]/40 bg-[#06B6D4]/5 py-2 text-xs font-bold text-[#06B6D4] hover:bg-[#06B6D4]/15 transition-all my-2"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Learning Outcome (LO)</span>
              </button>

              {/* Level 2: Learning Outcomes */}
              {syllabus.learningOutcomes
                .filter(lo => {
                  if (!treeSearchQuery.trim()) return true;
                  const q = treeSearchQuery.toLowerCase().trim();
                  const matchLo = lo.code.toLowerCase().includes(q) || lo.title.toLowerCase().includes(q);
                  const matchIc = lo.indicativeContents.some(ic => ic.code.toLowerCase().includes(q) || ic.title.toLowerCase().includes(q));
                  const matchTopic = lo.indicativeContents.some(ic => ic.topics.some(t => t.title.toLowerCase().includes(q)));
                  return matchLo || matchIc || matchTopic;
                })
                .map((lo) => {
                const loKey = `lo-${lo.id}`;
                const isLoExpanded = Boolean(expandedKeys[loKey]) || Boolean(treeSearchQuery.trim());
                const isLoSelected = selectedKey === loKey;

                return (
                  <div key={lo.id} className="space-y-1">
                    {/* LO Header Node */}
                    <div
                      onClick={() => setSelectedKey(loKey)}
                      className={`group flex items-center justify-between rounded-xl px-2.5 py-2 text-xs cursor-pointer transition-all border ${
                        isLoSelected
                          ? "border-[#06B6D4] bg-[#06B6D4]/15 font-bold text-white"
                          : "border-transparent text-[#CBD5E1] hover:bg-[#0B0F19]/50"
                      }`}
                    >
                      <div className="flex items-center space-x-1.5 truncate flex-1 min-w-0">
                        <button
                          onClick={(e) => toggleExpandKey(loKey, e)}
                          className="p-0.5 hover:text-white text-[#94A3B8]"
                        >
                          {isLoExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-[#06B6D4]" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-[#94A3B8]" />
                          )}
                        </button>
                        <Award className="h-3.5 w-3.5 text-[#06B6D4] shrink-0" />
                        <span className="truncate font-semibold">{lo.code || 'LO'}: {lo.title || 'Untitled LO'}</span>
                      </div>

                      <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 shrink-0">
                        <button
                          onClick={(e) => addIC(lo.id, e)}
                          className="rounded bg-[#F59E0B]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#F59E0B] hover:bg-[#F59E0B]/20"
                          title="Add Indicative Content"
                        >
                          +IC
                        </button>
                        <button
                          onClick={(e) => deleteLO(lo.id, e)}
                          className="p-1 text-rose-400 hover:text-rose-300"
                          title="Delete LO"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Level 3: Indicative Contents */}
                    {isLoExpanded && (
                      <div className="pl-4 space-y-1 border-l border-[#334155]/60 ml-3">
                        {lo.indicativeContents.map((ic) => {
                          const icKey = `ic-${ic.id}`;
                          const isIcExpanded = Boolean(expandedKeys[icKey]);
                          const isIcSelected = selectedKey === icKey;

                          return (
                            <div key={ic.id} className="space-y-1">
                              {/* IC Header Node */}
                              <div
                                onClick={() => setSelectedKey(icKey)}
                                className={`group flex items-center justify-between rounded-lg px-2 py-1.5 text-xs cursor-pointer transition-all border ${
                                  isIcSelected
                                    ? "border-[#F59E0B] bg-[#F59E0B]/15 font-bold text-white"
                                    : "border-transparent text-[#CBD5E1] hover:bg-[#0B0F19]/40"
                                }`}
                              >
                                <div className="flex items-center space-x-1.5 truncate flex-1 min-w-0">
                                  <button
                                    onClick={(e) => toggleExpandKey(icKey, e)}
                                    className="p-0.5 text-[#94A3B8]"
                                  >
                                    {isIcExpanded ? (
                                      <ChevronDown className="h-3 w-3 text-[#F59E0B]" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3 text-[#94A3B8]" />
                                    )}
                                  </button>
                                  <FolderGit2 className="h-3.5 w-3.5 text-[#F59E0B] shrink-0" />
                                  <span className="truncate">{ic.code || 'IC'}: {ic.title || 'Untitled IC'}</span>
                                </div>

                                <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 shrink-0">
                                  <button
                                    onClick={(e) => addTopic(lo.id, ic.id, e)}
                                    className="rounded bg-[#06B6D4]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#06B6D4] hover:bg-[#06B6D4]/20"
                                    title="Add Topic"
                                  >
                                    +Top
                                  </button>
                                  <button
                                    onClick={(e) => deleteIC(lo.id, ic.id, e)}
                                    className="p-1 text-rose-400 hover:text-rose-300"
                                    title="Delete IC"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>

                              {/* Level 4: Topics */}
                              {isIcExpanded && (
                                <div className="pl-3 space-y-1 border-l border-[#334155]/40 ml-2">
                                  {ic.topics.map((top) => {
                                    const topKey = `topic-${top.id}`;
                                    const isTopExpanded = Boolean(expandedKeys[topKey]);
                                    const isTopSelected = selectedKey === topKey;

                                    return (
                                      <div key={top.id} className="space-y-1">
                                        {/* Topic Header Node */}
                                        <div
                                          onClick={() => setSelectedKey(topKey)}
                                          className={`group flex items-center justify-between rounded-md px-2 py-1 text-xs cursor-pointer transition-all border ${
                                            isTopSelected
                                              ? "border-[#10B981] bg-[#10B981]/15 font-bold text-white"
                                              : "border-transparent text-[#CBD5E1] hover:bg-[#0B0F19]/30"
                                          }`}
                                        >
                                          <div className="flex items-center space-x-1.5 truncate flex-1 min-w-0">
                                            <button
                                              onClick={(e) => toggleExpandKey(topKey, e)}
                                              className="p-0.5 text-[#94A3B8]"
                                            >
                                              {isTopExpanded ? (
                                                <ChevronDown className="h-3 w-3 text-[#10B981]" />
                                              ) : (
                                                <ChevronRight className="h-3 w-3 text-[#94A3B8]" />
                                              )}
                                            </button>
                                            <Layers className="h-3 w-3 text-[#10B981] shrink-0" />
                                            <span className="truncate">{top.title || 'Untitled Topic'}</span>
                                          </div>

                                          <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 shrink-0">
                                            <button
                                              onClick={(e) => addSubtopic(lo.id, ic.id, top.id, e)}
                                              className="rounded bg-[#10B981]/10 px-1 py-0.5 text-[9px] font-bold text-[#10B981] hover:bg-[#10B981]/20"
                                              title="Add Subtopic"
                                            >
                                              +Sub
                                            </button>
                                            <button
                                              onClick={(e) => deleteTopic(lo.id, ic.id, top.id, e)}
                                              className="p-0.5 text-rose-400 hover:text-rose-300"
                                              title="Delete Topic"
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </button>
                                          </div>
                                        </div>

                                        {/* Level 5: Subtopics */}
                                        {isTopExpanded && (
                                          <div className="pl-3 space-y-0.5 border-l border-[#334155]/30 ml-2">
                                            {top.subtopics.map((sub) => {
                                              const subKey = `sub-${sub.id}`;
                                              const isSubSelected = selectedKey === subKey;

                                              return (
                                                <div
                                                  key={sub.id}
                                                  onClick={() => setSelectedKey(subKey)}
                                                  className={`group flex items-center justify-between rounded px-2 py-1 text-[11px] cursor-pointer transition-all border ${
                                                    isSubSelected
                                                      ? "border-[#06B6D4] bg-[#06B6D4]/20 font-bold text-white shadow"
                                                      : "border-transparent text-[#94A3B8] hover:bg-[#0B0F19] hover:text-white"
                                                  }`}
                                                >
                                                  <div className="flex items-center space-x-1.5 truncate flex-1 min-w-0">
                                                    <FileCode className="h-3 w-3 text-[#06B6D4] shrink-0" />
                                                    <span className="truncate">{sub.title || 'Untitled Subtopic'}</span>
                                                  </div>

                                                  <div className="flex items-center space-x-1 shrink-0">
                                                    {sub.codeSnippet && (
                                                      <span className="rounded bg-[#06B6D4]/20 px-1 text-[9px] text-[#06B6D4] font-bold" title="Has JS Terminal">
                                                        ⚡
                                                      </span>
                                                    )}
                                                    <button
                                                      onClick={(e) => deleteSubtopic(lo.id, ic.id, top.id, sub.id, e)}
                                                      className="p-0.5 text-rose-400 opacity-0 group-hover:opacity-100 hover:text-rose-300 transition-opacity"
                                                      title="Delete Subtopic"
                                                    >
                                                      <Trash2 className="h-2.5 w-2.5" />
                                                    </button>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN: FOCUSED DETAIL WORKBENCH PANEL (Detail - flex-1) */}
          <div className="flex-1 w-full rounded-2xl border border-[#334155] bg-[#1E293B] p-6 shadow-xl space-y-6 self-stretch">
            {/* Header Breadcrumb Navigation */}
            <div className="flex flex-wrap items-center justify-between border-b border-[#334155] pb-4 gap-2">
              <div className="flex flex-wrap items-center space-x-1.5 text-xs font-mono">
                <span className="text-[#06B6D4] font-bold">{syllabus.courseCode || "Course"}</span>
                {selectedCtx.type !== 'course' && (
                  <>
                    <span className="text-[#64748B]">&gt;</span>
                    <span className="text-[#CBD5E1]">{selectedCtx.lo?.code || 'LO'}</span>
                  </>
                )}
                {(selectedCtx.type === 'ic' || selectedCtx.type === 'topic' || selectedCtx.type === 'subtopic') && (
                  <>
                    <span className="text-[#64748B]">&gt;</span>
                    <span className="text-[#F59E0B]">{selectedCtx.ic?.code || 'IC'}</span>
                  </>
                )}
                {(selectedCtx.type === 'topic' || selectedCtx.type === 'subtopic') && (
                  <>
                    <span className="text-[#64748B]">&gt;</span>
                    <span className="text-[#10B981]">{selectedCtx.topic?.title || 'Topic'}</span>
                  </>
                )}
                {selectedCtx.type === 'subtopic' && (
                  <>
                    <span className="text-[#64748B]">&gt;</span>
                    <span className="text-white font-bold">{selectedCtx.subtopic?.title || 'Subtopic'}</span>
                  </>
                )}
              </div>

              <span className="rounded-lg bg-[#0B0F19] px-2.5 py-1 text-[10px] font-mono text-[#06B6D4] uppercase font-bold border border-[#334155]">
                {selectedCtx.type.toUpperCase()} EDITOR
              </span>
            </div>

            {/* DETAIL EDITOR CONTENT: LEVEL 1 (COURSE) */}
            {selectedCtx.type === 'course' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center space-x-2 text-xs font-mono text-[#06B6D4]">
                  <BookOpen className="h-4 w-4" />
                  <span>Level 1: Course General Metadata</span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-mono text-[#94A3B8]">Course Title</label>
                    <input
                      type="text"
                      value={syllabus.title}
                      onChange={(e) => setSyllabus({ ...syllabus, title: e.target.value })}
                      placeholder="e.g. Modern Software Engineering & Web Architecture"
                      className="mt-1 w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-mono text-[#94A3B8]">Course Code</label>
                    <input
                      type="text"
                      value={syllabus.courseCode}
                      onChange={(e) => setSyllabus({ ...syllabus, courseCode: e.target.value })}
                      placeholder="e.g. CS202"
                      className="mt-1 w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-mono text-[#94A3B8]">Assigned Academic Trade</label>
                    <select
                      value={syllabus.tradeId || ''}
                      onChange={(e) => setSyllabus({ ...syllabus, tradeId: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
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
                    <label className="text-xs font-mono text-[#94A3B8]">Assigned Academic Level</label>
                    <select
                      value={syllabus.level || 'Level 4'}
                      onChange={(e) => setSyllabus({ ...syllabus, level: e.target.value as StudentLevel })}
                      className="mt-1 w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
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
                    rows={4}
                    value={syllabus.description}
                    onChange={(e) => setSyllabus({ ...syllabus, description: e.target.value })}
                    placeholder="Describe the main objectives and scope of this syllabus..."
                    className="mt-1 w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* DETAIL EDITOR CONTENT: LEVEL 2 (LEARNING OUTCOME) */}
            {selectedCtx.type === 'lo' && selectedCtx.lo && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-mono text-[#06B6D4]">
                    <Award className="h-4 w-4" />
                    <span>Level 2: Learning Outcome Editor</span>
                  </div>
                  <button
                    onClick={() => addIC(selectedCtx.lo!.id)}
                    className="rounded-lg bg-[#F59E0B]/10 px-3 py-1.5 text-xs font-bold text-[#F59E0B] border border-[#F59E0B]/30"
                  >
                    + Add Indicative Content (IC)
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-mono text-[#94A3B8]">LO Code</label>
                    <input
                      type="text"
                      value={selectedCtx.lo.code}
                      onChange={(e) => {
                        const code = e.target.value;
                        setSyllabus({
                          ...syllabus,
                          learningOutcomes: syllabus.learningOutcomes.map(l => l.id === selectedCtx.lo!.id ? { ...l, code } : l)
                        });
                      }}
                      placeholder="e.g. LO1"
                      className="mt-1 w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-xs font-mono font-bold text-[#06B6D4] focus:border-[#06B6D4] focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-mono text-[#94A3B8]">LO Title</label>
                    <input
                      type="text"
                      value={selectedCtx.lo.title}
                      onChange={(e) => {
                        const title = e.target.value;
                        setSyllabus({
                          ...syllabus,
                          learningOutcomes: syllabus.learningOutcomes.map(l => l.id === selectedCtx.lo!.id ? { ...l, title } : l)
                        });
                      }}
                      placeholder="e.g. Understand Relational Database Architecture"
                      className="mt-1 w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-xs font-bold text-white focus:border-[#06B6D4] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-mono text-[#94A3B8]">LO Detailed Description</label>
                  <textarea
                    rows={3}
                    value={selectedCtx.lo.description || ""}
                    onChange={(e) => {
                      const description = e.target.value;
                      setSyllabus({
                        ...syllabus,
                        learningOutcomes: syllabus.learningOutcomes.map(l => l.id === selectedCtx.lo!.id ? { ...l, description } : l)
                      });
                    }}
                    placeholder="Describe specific learning goals for this outcome..."
                    className="mt-1 w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* DETAIL EDITOR CONTENT: LEVEL 3 (INDICATIVE CONTENT) */}
            {selectedCtx.type === 'ic' && selectedCtx.ic && selectedCtx.lo && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-mono text-[#F59E0B]">
                    <FolderGit2 className="h-4 w-4" />
                    <span>Level 3: Indicative Content Editor</span>
                  </div>
                  <button
                    onClick={() => addTopic(selectedCtx.lo!.id, selectedCtx.ic!.id)}
                    className="rounded-lg bg-[#06B6D4]/10 px-3 py-1.5 text-xs font-bold text-[#06B6D4] border border-[#06B6D4]/30"
                  >
                    + Add Topic
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-mono text-[#94A3B8]">IC Code</label>
                    <input
                      type="text"
                      value={selectedCtx.ic.code}
                      onChange={(e) => {
                        const code = e.target.value;
                        setSyllabus({
                          ...syllabus,
                          learningOutcomes: syllabus.learningOutcomes.map(l => 
                            l.id === selectedCtx.lo!.id ? {
                              ...l,
                              indicativeContents: l.indicativeContents.map(i => i.id === selectedCtx.ic!.id ? { ...i, code } : i)
                            } : l
                          )
                        });
                      }}
                      placeholder="e.g. IC1.1"
                      className="mt-1 w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-xs font-mono font-bold text-[#F59E0B] focus:border-[#F59E0B] focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-mono text-[#94A3B8]">IC Title</label>
                    <input
                      type="text"
                      value={selectedCtx.ic.title}
                      onChange={(e) => {
                        const title = e.target.value;
                        setSyllabus({
                          ...syllabus,
                          learningOutcomes: syllabus.learningOutcomes.map(l => 
                            l.id === selectedCtx.lo!.id ? {
                              ...l,
                              indicativeContents: l.indicativeContents.map(i => i.id === selectedCtx.ic!.id ? { ...i, title } : i)
                            } : l
                          )
                        });
                      }}
                      placeholder="e.g. Core Database Normalization & Indexing"
                      className="mt-1 w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-xs font-bold text-white focus:border-[#F59E0B] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* DETAIL EDITOR CONTENT: LEVEL 4 (TOPIC) */}
            {selectedCtx.type === 'topic' && selectedCtx.topic && selectedCtx.lo && selectedCtx.ic && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-mono text-[#10B981]">
                    <Layers className="h-4 w-4" />
                    <span>Level 4: Topic Editor</span>
                  </div>
                  <button
                    onClick={() => addSubtopic(selectedCtx.lo!.id, selectedCtx.ic!.id, selectedCtx.topic!.id)}
                    className="rounded-lg bg-[#10B981]/10 px-3 py-1.5 text-xs font-bold text-[#10B981] border border-[#10B981]/30"
                  >
                    + Add Subtopic
                  </button>
                </div>

                <div>
                  <label className="text-xs font-mono text-[#94A3B8]">Topic Title</label>
                  <input
                    type="text"
                    value={selectedCtx.topic.title}
                    onChange={(e) => {
                      const title = e.target.value;
                      setSyllabus({
                        ...syllabus,
                        learningOutcomes: syllabus.learningOutcomes.map(l => 
                          l.id === selectedCtx.lo!.id ? {
                            ...l,
                            indicativeContents: l.indicativeContents.map(i => 
                              i.id === selectedCtx.ic!.id ? {
                                ...i,
                                topics: i.topics.map(t => t.id === selectedCtx.topic!.id ? { ...t, title } : t)
                              } : i
                            )
                          } : l
                        )
                      });
                    }}
                    placeholder="e.g. Topic 1: B-Tree Indexing Strategies"
                    className="mt-1 w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-xs font-bold text-white focus:border-[#10B981] focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* DETAIL EDITOR CONTENT: LEVEL 5 (SUBTOPIC) */}
            {selectedCtx.type === 'subtopic' && selectedCtx.subtopic && selectedCtx.lo && selectedCtx.ic && selectedCtx.topic && (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-[#334155] pb-3">
                  <div className="flex items-center space-x-2 text-xs font-mono text-[#06B6D4]">
                    <FileCode className="h-4 w-4" />
                    <span>Level 5: Focused Subtopic & Code Workbench</span>
                  </div>

                  <span className="text-[11px] font-mono text-[#94A3B8]">
                    Index Order #{selectedCtx.subtopic.order}
                  </span>
                </div>

                {/* Subtopic Title */}
                <div>
                  <label className="text-xs font-mono text-[#94A3B8]">Subtopic Title</label>
                  <input
                    type="text"
                    value={selectedCtx.subtopic.title}
                    onChange={(e) => {
                      const title = e.target.value;
                      setSyllabus({
                        ...syllabus,
                        learningOutcomes: syllabus.learningOutcomes.map(l => 
                          l.id === selectedCtx.lo!.id ? {
                            ...l,
                            indicativeContents: l.indicativeContents.map(i => 
                              i.id === selectedCtx.ic!.id ? {
                                ...i,
                                topics: i.topics.map(t => 
                                  t.id === selectedCtx.topic!.id ? {
                                    ...t,
                                    subtopics: t.subtopics.map(s => s.id === selectedCtx.subtopic!.id ? { ...s, title } : s)
                                  } : t
                                )
                              } : i
                            )
                          } : l
                        )
                      });
                    }}
                    placeholder="e.g. Subtopic 1: Logic Gates & Binary Conversions"
                    className="mt-1 w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-sm font-bold text-white focus:border-[#06B6D4] focus:outline-none"
                  />
                </div>

                {/* Markdown Editor */}
                <div>
                  <label className="text-xs font-mono text-[#94A3B8] block mb-1">
                    Detailed Educational Text Content (Markdown + Media)
                  </label>
                  <MarkdownEditor
                    rows={8}
                    value={selectedCtx.subtopic.contentMarkdown || ""}
                    placeholder="Write comprehensive course content... Drag & drop diagrams/images directly into the editor!"
                    onChange={(contentMarkdown) => {
                      setSyllabus({
                        ...syllabus,
                        learningOutcomes: syllabus.learningOutcomes.map(l => 
                          l.id === selectedCtx.lo!.id ? {
                            ...l,
                            indicativeContents: l.indicativeContents.map(i => 
                              i.id === selectedCtx.ic!.id ? {
                                ...i,
                                topics: i.topics.map(t => 
                                  t.id === selectedCtx.topic!.id ? {
                                    ...t,
                                    subtopics: t.subtopics.map(s => s.id === selectedCtx.subtopic!.id ? { ...s, contentMarkdown } : s)
                                  } : t
                                )
                              } : i
                            )
                          } : l
                        )
                      });
                    }}
                    onAddCitation={(citation) => {
                      setSyllabus({
                        ...syllabus,
                        learningOutcomes: syllabus.learningOutcomes.map(l => 
                          l.id === selectedCtx.lo!.id ? {
                            ...l,
                            indicativeContents: l.indicativeContents.map(i => 
                              i.id === selectedCtx.ic!.id ? {
                                ...i,
                                topics: i.topics.map(t => 
                                  t.id === selectedCtx.topic!.id ? {
                                    ...t,
                                    subtopics: t.subtopics.map(s => 
                                      s.id === selectedCtx.subtopic!.id ? { 
                                        ...s, 
                                        citations: [...(s.citations || []), citation] 
                                      } : s
                                    )
                                  } : t
                                )
                              } : i
                            )
                          } : l
                        )
                      });
                    }}
                  />
                </div>

                {/* Interactive JS Code Playground Section */}
                <div>
                  {!selectedCtx.subtopic.codeSnippet ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSyllabus({
                          ...syllabus,
                          learningOutcomes: syllabus.learningOutcomes.map(l => 
                            l.id === selectedCtx.lo!.id ? {
                              ...l,
                              indicativeContents: l.indicativeContents.map(i => 
                                i.id === selectedCtx.ic!.id ? {
                                  ...i,
                                  topics: i.topics.map(t => 
                                    t.id === selectedCtx.topic!.id ? {
                                      ...t,
                                      subtopics: t.subtopics.map(s => 
                                        s.id === selectedCtx.subtopic!.id ? { 
                                          ...s, 
                                          codeSnippet: {
                                            id: `snippet-${Date.now()}`,
                                            title: "Interactive JS Code Playground",
                                            language: "javascript",
                                            template: "vanilla",
                                            code: `// Interactive JavaScript Example\n// Try changing values below!\n\nfunction calculateProgress(completed, total) {\n  return ((completed / total) * 100).toFixed(1) + "%";\n}\n\nconsole.log("Calculated Progress:", calculateProgress(4, 5));\n`
                                          } 
                                        } : s
                                      )
                                    } : t
                                  )
                                } : i
                              )
                            } : l
                          )
                        });
                      }}
                      className="w-full py-3 px-4 border border-dashed border-[#06B6D4]/40 hover:border-[#06B6D4] bg-[#06B6D4]/5 hover:bg-[#06B6D4]/10 rounded-xl text-xs font-bold text-[#06B6D4] transition-all flex items-center justify-center space-x-2"
                    >
                      <Terminal className="w-4 h-4" />
                      <span>+ Attach Interactive JavaScript Coding Terminal Playground</span>
                    </button>
                  ) : (
                    <div className="p-4 rounded-xl border border-[#334155] bg-[#0B0F19]/80 space-y-4">
                      <div className="flex items-center justify-between border-b border-[#334155] pb-2">
                        <div className="flex items-center space-x-2">
                          <Terminal className="w-4 h-4 text-[#06B6D4]" />
                          <span className="text-xs font-bold text-white uppercase tracking-wider">
                            Interactive JS Coding Terminal Playground
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSyllabus({
                              ...syllabus,
                              learningOutcomes: syllabus.learningOutcomes.map(l => 
                                l.id === selectedCtx.lo!.id ? {
                                  ...l,
                                  indicativeContents: l.indicativeContents.map(i => 
                                    i.id === selectedCtx.ic!.id ? {
                                      ...i,
                                      topics: i.topics.map(t => 
                                        t.id === selectedCtx.topic!.id ? {
                                          ...t,
                                          subtopics: t.subtopics.map(s => 
                                            s.id === selectedCtx.subtopic!.id ? { ...s, codeSnippet: undefined } : s
                                          )
                                        } : t
                                      )
                                    } : i
                                  )
                                } : l
                              )
                            });
                          }}
                          className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center space-x-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove Playground</span>
                        </button>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold text-[#94A3B8] block mb-1">
                          Playground Title
                        </label>
                        <input 
                          type="text"
                          value={selectedCtx.subtopic.codeSnippet.title || ""}
                          onChange={(e) => {
                            const newTitle = e.target.value;
                            setSyllabus({
                              ...syllabus,
                              learningOutcomes: syllabus.learningOutcomes.map(l => 
                                l.id === selectedCtx.lo!.id ? {
                                  ...l,
                                  indicativeContents: l.indicativeContents.map(i => 
                                    i.id === selectedCtx.ic!.id ? {
                                      ...i,
                                      topics: i.topics.map(t => 
                                        t.id === selectedCtx.topic!.id ? {
                                          ...t,
                                          subtopics: t.subtopics.map(s => 
                                            s.id === selectedCtx.subtopic!.id && s.codeSnippet ? { 
                                              ...s, 
                                              codeSnippet: { ...s.codeSnippet, title: newTitle } 
                                            } : s
                                          )
                                        } : t
                                      )
                                    } : i
                                  )
                                } : l
                              )
                            });
                          }}
                          placeholder="e.g. Logic Gates & Binary Conversions"
                          className="w-full rounded-lg border border-[#334155] bg-[#1E293B] px-3 py-2 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold text-[#94A3B8] block mb-1">
                          Initial Starter Code (JavaScript Only)
                        </label>
                        <textarea 
                          rows={6}
                          value={selectedCtx.subtopic.codeSnippet.code || ""}
                          onChange={(e) => {
                            const newCode = e.target.value;
                            setSyllabus({
                              ...syllabus,
                              learningOutcomes: syllabus.learningOutcomes.map(l => 
                                l.id === selectedCtx.lo!.id ? {
                                  ...l,
                                  indicativeContents: l.indicativeContents.map(i => 
                                    i.id === selectedCtx.ic!.id ? {
                                      ...i,
                                      topics: i.topics.map(t => 
                                        t.id === selectedCtx.topic!.id ? {
                                          ...t,
                                          subtopics: t.subtopics.map(s => 
                                            s.id === selectedCtx.subtopic!.id && s.codeSnippet ? { 
                                              ...s, 
                                              codeSnippet: { ...s.codeSnippet, code: newCode } 
                                            } : s
                                          )
                                        } : t
                                      )
                                    } : i
                                  )
                                } : l
                              )
                            });
                          }}
                          placeholder="// Write starter JavaScript code here..."
                          className="w-full rounded-lg border border-[#334155] bg-[#0F172A] p-3 text-xs font-mono text-[#06B6D4] focus:border-[#06B6D4] focus:outline-none"
                        />
                      </div>

                      {/* Live Playground Preview in Admin */}
                      <div className="pt-2">
                        <span className="text-[10px] uppercase font-bold text-[#10B981] block mb-2">
                          Live Interactive Student Preview Terminal
                        </span>
                        <SandpackPlayground snippet={selectedCtx.subtopic.codeSnippet} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
