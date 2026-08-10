"use client";

import React, { useRef, useState } from "react";
import { 
  Bold, 
  Italic, 
  Underline, 
  Superscript, 
  Subscript, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignJustify, 
  Indent, 
  List, 
  ListOrdered, 
  Quote, 
  X 
} from "lucide-react";
import { uploadFileToStorage } from "@/lib/storage";

interface Citation {
  id: string;
  term: string;
  explanation: string;
  source: string;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onAddCitation: (citation: Citation) => void;
  placeholder?: string;
  rows?: number;
}

export default function MarkdownEditor({
  value,
  onChange,
  onAddCitation,
  placeholder,
  rows = 4,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [citationModalOpen, setCitationModalOpen] = useState(false);
  const [citationData, setCitationData] = useState({ term: "", explanation: "", source: "" });

  // Handle Drag & Drop Images
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const prevContent = value;
      onChange(prevContent + "\n[Uploading image...]\n");
      try {
        const url = await uploadFileToStorage(file, "syllabus_images");
        onChange(prevContent + `\n![${file.name}](${url})\n`);
      } catch (err) {
        console.error("Image upload failed", err);
        onChange(prevContent + "\n[Image upload failed]\n");
      }
    }
  };

  const applyFormat = (prefix: string, suffix: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    let newText = "";
    if (selectedText.length > 0) {
      newText = value.substring(0, start) + prefix + selectedText + suffix + value.substring(end);
    } else {
      // If nothing selected, just insert the syntax and put cursor in middle
      newText = value.substring(0, start) + prefix + "text" + suffix + value.substring(end);
    }

    onChange(newText);

    // Focus and reset cursor position after React re-renders
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, selectedText.length > 0 ? end + prefix.length : start + prefix.length + 4);
    }, 10);
  };

  const applyListFormat = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    // Split by newline and prepend prefix
    const listText = selectedText.split("\n").map((line, i) => {
      // For numbered list, increment number
      if (prefix === "1. ") return `${i + 1}. ${line}`;
      return `${prefix}${line}`;
    }).join("\n");

    let newText = value.substring(0, start) + (listText || prefix + "Item") + value.substring(end);
    onChange(newText);
    setTimeout(() => textarea.focus(), 10);
  };

  const openCitationModal = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    if (!selectedText.trim()) {
      alert("Please highlight a specific term in the text to add a citation.");
      return;
    }

    setCitationData({ term: selectedText, explanation: "", source: "" });
    setCitationModalOpen(true);
  };

  const submitCitation = () => {
    if (!citationData.explanation.trim()) {
      alert("Explanation is required.");
      return;
    }

    // Call the parent callback to save the citation metadata
    onAddCitation({ 
      id: `cit-${Date.now()}`,
      ...citationData 
    });

    setCitationModalOpen(false);
  };

  return (
    <div className="flex flex-col w-full rounded-xl border border-[#334155] bg-[#0B0F19] overflow-hidden relative">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-[#334155] bg-[#1E293B] p-2">
        <button type="button" onClick={() => applyFormat("**", "**")} className="p-1.5 text-[#94A3B8] hover:text-white hover:bg-[#334155] rounded transition-colors" title="Bold (**text**)">
          <Bold className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => applyFormat("*", "*")} className="p-1.5 text-[#94A3B8] hover:text-white hover:bg-[#334155] rounded transition-colors" title="Italic (*text*)">
          <Italic className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => applyFormat("<u>", "</u>")} className="p-1.5 text-[#94A3B8] hover:text-white hover:bg-[#334155] rounded transition-colors" title="Underline (<u>text</u>)">
          <Underline className="h-4 w-4" />
        </button>

        <div className="w-px h-5 bg-[#334155] mx-1"></div>

        <button type="button" onClick={() => applyFormat("<sup>", "</sup>")} className="p-1.5 text-[#94A3B8] hover:text-[#06B6D4] hover:bg-[#334155] rounded transition-colors font-bold text-xs" title="Superscript (<sup>X²</sup>)">
          <Superscript className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => applyFormat("<sub>", "</sub>")} className="p-1.5 text-[#94A3B8] hover:text-[#06B6D4] hover:bg-[#334155] rounded transition-colors font-bold text-xs" title="Subscript (<sub>X₂</sub>)">
          <Subscript className="h-4 w-4" />
        </button>
        
        <div className="w-px h-5 bg-[#334155] mx-1"></div>

        <button type="button" onClick={() => applyFormat('<div align="left">\n', '\n</div>')} className="p-1.5 text-[#94A3B8] hover:text-white hover:bg-[#334155] rounded transition-colors" title="Align Left">
          <AlignLeft className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => applyFormat('<div align="center">\n', '\n</div>')} className="p-1.5 text-[#94A3B8] hover:text-white hover:bg-[#334155] rounded transition-colors" title="Align Center">
          <AlignCenter className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => applyFormat('<div align="right">\n', '\n</div>')} className="p-1.5 text-[#94A3B8] hover:text-white hover:bg-[#334155] rounded transition-colors" title="Align Right">
          <AlignRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => applyFormat('<div align="justify">\n', '\n</div>')} className="p-1.5 text-[#94A3B8] hover:text-white hover:bg-[#334155] rounded transition-colors" title="Align Justify">
          <AlignJustify className="h-4 w-4" />
        </button>

        <div className="w-px h-5 bg-[#334155] mx-1"></div>

        <button type="button" onClick={() => applyFormat('<div style="margin-left: 24px">\n', '\n</div>')} className="p-1.5 text-[#94A3B8] hover:text-white hover:bg-[#334155] rounded transition-colors" title="Indent Block">
          <Indent className="h-4 w-4" />
        </button>
        
        <div className="w-px h-5 bg-[#334155] mx-1"></div>
        
        <button type="button" onClick={() => applyListFormat("- ")} className="p-1.5 text-[#94A3B8] hover:text-white hover:bg-[#334155] rounded transition-colors" title="Bullet List">
          <List className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => applyListFormat("1. ")} className="p-1.5 text-[#94A3B8] hover:text-white hover:bg-[#334155] rounded transition-colors" title="Numbered List">
          <ListOrdered className="h-4 w-4" />
        </button>
        
        <div className="w-px h-5 bg-[#334155] mx-1"></div>
        
        <button 
          type="button" 
          onClick={openCitationModal}
          className="flex items-center space-x-1 px-2 py-1.5 text-[11px] font-bold text-[#10B981] hover:bg-[#10B981]/10 rounded border border-transparent hover:border-[#10B981]/30 transition-colors ml-auto" 
          title="Add Citation to Highlighted Text"
        >
          <Quote className="h-3 w-3" />
          <span>ADD CITATION</span>
        </button>
      </div>

      {/* Editor */}
      <textarea
        ref={textareaRef}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        placeholder={placeholder}
        className="w-full bg-transparent p-4 text-xs font-mono text-white placeholder-[#64748B] focus:outline-none resize-y"
      />

      {/* Citation Custom Modal */}
      {citationModalOpen && (
        <div className="fixed inset-0 bg-[#0B0F19]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-5 w-full max-w-sm shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-sm font-bold text-white">Add Citation</h4>
              <button onClick={() => setCitationModalOpen(false)} className="text-[#94A3B8] hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8] mb-1 block">Term / Highlighted Text</label>
                <input 
                  type="text" 
                  value={citationData.term} 
                  disabled
                  className="w-full rounded-lg border border-[#334155] bg-[#0B0F19] p-2 text-xs font-bold text-[#06B6D4] opacity-70"
                />
              </div>
              
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8] mb-1 block">Explanation *</label>
                <textarea 
                  rows={3}
                  value={citationData.explanation} 
                  onChange={e => setCitationData({...citationData, explanation: e.target.value})}
                  placeholder="Explain the term here..."
                  className="w-full rounded-lg border border-[#334155] bg-[#0B0F19] p-2 text-xs text-white focus:border-[#10B981] focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8] mb-1 block">Source URL (Optional)</label>
                <input 
                  type="url" 
                  value={citationData.source} 
                  onChange={e => setCitationData({...citationData, source: e.target.value})}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-[#334155] bg-[#0B0F19] p-2 text-xs text-white focus:border-[#10B981] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button 
                  onClick={() => setCitationModalOpen(false)}
                  className="flex-1 py-2 text-xs font-bold text-white bg-[#334155] hover:bg-[#475569] rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={submitCitation}
                  className="flex-1 py-2 text-xs font-bold text-[#0B0F19] bg-[#10B981] hover:bg-[#059669] rounded-lg transition-colors"
                >
                  Add Citation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
