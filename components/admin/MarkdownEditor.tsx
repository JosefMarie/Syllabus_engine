"use client";

import React, { useRef, useState, useEffect } from "react";
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
  IndentIncrease, 
  IndentDecrease, 
  Quote, 
  X,
  Eye,
  Code,
  FileText,
  Sparkles,
  Image as ImageIcon,
  Loader2
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { uploadFileToStorage, uploadBlobOrDataUrl } from "@/lib/storage";
import { Citation } from "@/types/syllabus";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onAddCitation: (citation: Citation) => void;
  citationsMap?: Record<string, Citation>;
  placeholder?: string;
  rows?: number;
}

// Clean and sanitize HTML to prevent fixed/absolute positioning overlaps and broken layouts
function cleanPastedHtml(html: string): string {
  if (!html || typeof window === "undefined") return html || "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Remove unwanted non-visual tags
    const toRemove = doc.querySelectorAll("script, style, meta, link, noscript, title");
    toRemove.forEach((el) => el.remove());

    // Sanitize all elements: strip layout-breaking styles
    const allElements = doc.querySelectorAll("*");
    allElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.style) {
        // Strip out dangerous position, coordinates, floats, and fixed heights
        htmlEl.style.removeProperty("position");
        htmlEl.style.removeProperty("top");
        htmlEl.style.removeProperty("left");
        htmlEl.style.removeProperty("right");
        htmlEl.style.removeProperty("bottom");
        htmlEl.style.removeProperty("transform");
        htmlEl.style.removeProperty("float");
        htmlEl.style.removeProperty("z-index");
        htmlEl.style.removeProperty("height");
        htmlEl.style.removeProperty("min-height");
        htmlEl.style.removeProperty("max-height");
        htmlEl.style.removeProperty("line-height");
        htmlEl.style.removeProperty("clear");

        // Clean dark or clashing backgrounds
        const bg = htmlEl.style.backgroundColor;
        if (bg && bg !== "transparent" && bg !== "inherit") {
          htmlEl.style.removeProperty("background-color");
        }

        // Clean white/light text colors so text is always readable on white paper
        const c = (htmlEl.style.color || "").toLowerCase().replace(/\s/g, "");
        if (c === "white" || c === "#fff" || c === "#ffffff" || c === "rgb(255,255,255)") {
          htmlEl.style.removeProperty("color");
        }

        if (!htmlEl.getAttribute("style") || htmlEl.getAttribute("style")?.trim() === "") {
          htmlEl.removeAttribute("style");
        }
      }
    });

    // Convert list items into clean paragraphs and unwrap lists
    const listItems = doc.querySelectorAll("li");
    listItems.forEach((li) => {
      const p = doc.createElement("p");
      p.innerHTML = li.innerHTML;
      li.parentNode?.replaceChild(p, li);
    });

    const lists = doc.querySelectorAll("ul, ol");
    lists.forEach((list) => {
      const parent = list.parentNode;
      while (list.firstChild) {
        parent?.insertBefore(list.firstChild, list);
      }
      list.remove();
    });

    return doc.body.innerHTML;
  } catch (err) {
    console.warn("Error cleaning HTML:", err);
    return html;
  }
}

// Convert legacy markdown symbols to visual HTML
function markdownToVisualHtml(md: string): string {
  if (!md) return "";
  let html = md;
  // Convert markdown bold **text** to <strong>text</strong>
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Convert markdown italic *text* to <em>text</em>
  html = html.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

  // If plain text with newlines and no block tags, format nicely into paragraphs
  if (!html.includes("<p>") && !html.includes("<div>") && !html.includes("<br>")) {
    html = html
      .split(/\r?\n\r?\n/)
      .map((para) => `<p>${para.split(/\r?\n/).join("<br>")}</p>`)
      .join("");
  }

  return cleanPastedHtml(html);
}

export default function MarkdownEditor({
  value,
  onChange,
  onAddCitation,
  citationsMap = {},
  placeholder = "Type your course text here... Use Bold, Italic, Underline, or Indent like in Word!",
  rows = 6,
}: MarkdownEditorProps) {
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastHtmlRef = useRef<string>("");
  const savedRangeRef = useRef<Range | null>(null);

  const [citationModalOpen, setCitationModalOpen] = useState(false);
  const [citationData, setCitationData] = useState({ term: "", explanation: "", source: "" });
  const [editorMode, setEditorMode] = useState<'visual' | 'source' | 'preview'>('visual');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize and sync visual editor when value prop changes externally
  useEffect(() => {
    if (editorMode === 'visual' && contentEditableRef.current) {
      if (value !== lastHtmlRef.current) {
        const visualHtml = markdownToVisualHtml(value || "");
        contentEditableRef.current.innerHTML = visualHtml;
        lastHtmlRef.current = value;
      }
    }
  }, [value, editorMode]);

  // Handle content changes inside Visual ContentEditable
  const handleVisualInput = () => {
    if (!contentEditableRef.current) return;
    const currentHtml = contentEditableRef.current.innerHTML;
    lastHtmlRef.current = currentHtml;
    onChange(currentHtml);
  };

  // Execute formatting in visual mode
  const execVisual = (command: string, arg?: string) => {
    if (editorMode !== 'visual') return;
    const editor = contentEditableRef.current;
    if (!editor) return;

    editor.focus();
    document.execCommand(command, false, arg);
    handleVisualInput();
  };

  // Keyboard events in visual editor (Tab = Indent, Shift+Tab = Outdent)
  const handleVisualKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        execVisual("outdent");
      } else {
        execVisual("indent");
      }
    }
  };

  // Source mode format applier (fallback for source code mode)
  const applySourceFormat = (prefix: string, suffix: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    let newText = "";
    if (selectedText.length > 0) {
      newText = value.substring(0, start) + prefix + selectedText + suffix + value.substring(end);
    } else {
      newText = value.substring(0, start) + prefix + "text" + suffix + value.substring(end);
    }

    lastHtmlRef.current = newText;
    onChange(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, selectedText.length > 0 ? end + prefix.length : start + prefix.length + 4);
    }, 10);
  };

  // Upload and insert an image permanently
  const uploadAndInsertImage = async (fileOrBlob: File | Blob) => {
    setUploadingImage(true);
    try {
      const permanentUrl = await uploadBlobOrDataUrl(fileOrBlob, "syllabus_images");
      if (editorMode === 'visual') {
        execVisual("insertImage", permanentUrl);
      } else {
        const name = (fileOrBlob as File).name || "Image";
        onChange(value + `\n![${name}](${permanentUrl})\n`);
      }
    } catch (err) {
      console.error("Image upload failed:", err);
      alert("Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  };

  // Clipboard Paste handler (supports screenshots, copied images, and rich HTML with images)
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await uploadAndInsertImage(file);
            return;
          }
        }
      }
    }

    // In Visual Word Processor mode, intercept text/HTML paste to prevent layout breakage
    if (editorMode === 'visual') {
      const htmlData = e.clipboardData?.getData("text/html");
      const plainText = e.clipboardData?.getData("text/plain");

      if (htmlData) {
        e.preventDefault();
        const cleaned = cleanPastedHtml(htmlData);
        document.execCommand("insertHTML", false, cleaned);
        handleVisualInput();
        return;
      } else if (plainText) {
        e.preventDefault();
        const paragraphs = plainText
          .split(/\r?\n\r?\n/)
          .map((para) => {
            const lines = para.split(/\r?\n/).join("<br>");
            return `<p>${lines}</p>`;
          })
          .join("");
        document.execCommand("insertHTML", false, paragraphs);
        handleVisualInput();
        return;
      }
    }

    // If pasted HTML contains blob: or data:image URLs, scan and upload them permanently
    setTimeout(async () => {
      if (contentEditableRef.current) {
        const imgs = contentEditableRef.current.querySelectorAll("img");
        let changed = false;
        for (let j = 0; j < imgs.length; j++) {
          const img = imgs[j];
          const src = img.getAttribute("src") || "";
          if (src.startsWith("blob:") || src.startsWith("data:image/")) {
            try {
              const permUrl = await uploadBlobOrDataUrl(src, "syllabus_images");
              img.setAttribute("src", permUrl);
              changed = true;
            } catch (err) {
              console.warn("Could not permanently upload pasted image:", err);
            }
          }
        }
        if (changed) {
          handleVisualInput();
        }
      }
    }, 60);
  };

  // File input change for Picture button
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadAndInsertImage(file);
      e.target.value = "";
    }
  };

  // Drag & drop image uploads
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      await uploadAndInsertImage(file);
    }
  };

  // Open citation modal
  const openCitationModal = () => {
    if (editorMode === 'visual') {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        alert("Please highlight a specific term in the text to add a citation.");
        return;
      }
      const text = selection.toString().trim();
      if (!text) {
        alert("Please highlight a specific term in the text to add a citation.");
        return;
      }
      savedRangeRef.current = selection.getRangeAt(0).cloneRange();
      setCitationData({ term: text, explanation: "", source: "" });
      setCitationModalOpen(true);
    } else {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.substring(start, end).trim();

      if (!selectedText) {
        alert("Please highlight a specific term in the text to add a citation.");
        return;
      }

      setCitationData({ term: selectedText, explanation: "", source: "" });
      setCitationModalOpen(true);
    }
  };

  // Submit citation
  const submitCitation = () => {
    if (!citationData.explanation.trim()) {
      alert("Explanation is required.");
      return;
    }

    const citation: Citation = { 
      id: `cit-${Date.now()}`,
      term: citationData.term,
      explanation: citationData.explanation,
      source: citationData.source || undefined
    };

    if (editorMode === 'visual' && savedRangeRef.current) {
      const span = document.createElement("span");
      span.className = "citation-highlight";
      span.title = `Citation: ${citation.term} — ${citation.explanation}`;
      span.setAttribute("data-citation-id", citation.id);
      span.textContent = citationData.term;

      savedRangeRef.current.deleteContents();
      savedRangeRef.current.insertNode(span);
      handleVisualInput();
    }

    onAddCitation(citation);
    setCitationModalOpen(false);
  };

  // Switch between visual, source, and preview modes
  const handleModeChange = (mode: 'visual' | 'source' | 'preview') => {
    if (editorMode === 'visual' && contentEditableRef.current) {
      const html = contentEditableRef.current.innerHTML;
      lastHtmlRef.current = html;
      onChange(html);
    }
    setEditorMode(mode);
  };

  // Preview component with citations highlighting
  const renderPreviewWithCitations = (content: string) => {
    if (!content) return "";
    const termKeys = citationsMap ? Object.keys(citationsMap) : [];
    if (termKeys.length === 0) return content;

    const pattern = new RegExp(`\\b(${termKeys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|")})\\b`, "gi");
    const parts = content.split(pattern);
    return parts.map((part, idx) => {
      const lower = part.toLowerCase();
      if (citationsMap && citationsMap[lower]) {
        const cit = citationsMap[lower];
        return (
          <span
            key={idx}
            className="font-bold italic underline decoration-[#EA580C] decoration-2 underline-offset-4 text-[#EA580C] bg-[#EA580C]/10 px-1 rounded cursor-help citation-highlight"
            title={`Citation: ${cit.term} — ${cit.explanation}`}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const previewComponents = {
    p: ({ children }: any) => <p className="my-2.5 text-black text-xs leading-relaxed">{children}</p>,
    ul: ({ children }: any) => <div className="my-2 space-y-1.5">{children}</div>,
    ol: ({ children }: any) => <div className="my-2 space-y-1.5">{children}</div>,
    li: ({ children }: any) => <p className="my-1.5 text-black text-xs leading-relaxed">{children}</p>,
    strong: ({ children }: any) => (
      <strong className="font-extrabold text-[#CA8A04]">
        {children}
      </strong>
    ),
    b: ({ children }: any) => (
      <strong className="font-extrabold text-[#CA8A04]">
        {children}
      </strong>
    ),
    u: ({ children }: any) => (
      <u className="underline underline-offset-4 decoration-[#06B6D4] decoration-2 text-black font-medium">
        {children}
      </u>
    ),
    blockquote: ({ children }: any) => (
      <div className="my-2 pl-4 border-l-3 border-[#06B6D4] bg-[#06B6D4]/10 p-2 rounded-r-lg text-black">
        {children}
      </div>
    ),
    h3: ({ children }: any) => (
      <div className="mt-3 mb-2 border-l-3 border-[#06B6D4] bg-[#06B6D4]/10 p-2 rounded-r-lg">
        <h3 className="text-xs font-bold text-black tracking-tight flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#06B6D4]" />
          <span>{children}</span>
        </h3>
      </div>
    ),
    img: ({ src, alt }: any) => {
      let cleanSrc = src || "";
      if (typeof cleanSrc === "string" && cleanSrc.trim().startsWith("data:image/")) {
        const commaIdx = cleanSrc.indexOf(",");
        if (commaIdx !== -1) {
          const prefix = cleanSrc.slice(0, commaIdx + 1);
          const base64Data = cleanSrc.slice(commaIdx + 1).replace(/\s+/g, "");
          cleanSrc = prefix + base64Data;
        }
      }

      return (
        <div className="my-3 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 p-2 shadow-xs max-w-xl">
          <img 
            src={cleanSrc} 
            alt={alt || "Educational Diagram"} 
            className="rounded-lg max-h-80 w-auto object-contain mx-auto" 
            loading="lazy"
          />
          {alt && alt !== "Educational Diagram" && alt !== "Syllabus image" && (
            <p className="text-[11px] text-slate-500 font-mono text-center mt-1.5 italic">{alt}</p>
          )}
        </div>
      );
    },
  };

  const safeUrlTransform = (url: string) => {
    if (!url) return "";
    const clean = url.trim();
    if (/^(javascript|vbscript):/i.test(clean)) {
      return "";
    }
    return clean;
  };

  return (
    <div className="visual-editor flex flex-col w-full rounded-xl border border-[#334155] bg-[#0B0F19] overflow-hidden relative shadow-lg">
      {/* Top Header & Formatting Controls */}
      <div className="flex flex-wrap items-center justify-between border-b border-[#334155] bg-[#1E293B] px-3 py-2 gap-2">
        {/* Formatting Toolbar */}
        <div className="flex flex-wrap items-center gap-1">
          {/* Instant Yellow Bold Button */}
          <button 
            type="button" 
            onClick={() => {
              if (editorMode === 'visual') execVisual("bold");
              else applySourceFormat("**", "**");
            }} 
            className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-bold text-[#FACC15] bg-[#FACC15]/10 border border-[#FACC15]/30 hover:bg-[#FACC15]/20 rounded-lg transition-colors shadow-xs" 
            title="Bold Key Concept (Yellow) — Highlight text and click to turn yellow instantly without **"
          >
            <Bold className="h-3.5 w-3.5 text-[#FACC15]" />
            <span className="text-[11px] font-mono tracking-tight font-extrabold">Yellow Bold</span>
          </button>

          {/* Italic */}
          <button 
            type="button" 
            onClick={() => {
              if (editorMode === 'visual') execVisual("italic");
              else applySourceFormat("*", "*");
            }} 
            className="p-1.5 text-[#94A3B8] hover:text-white hover:bg-[#334155] rounded transition-colors" 
            title="Italic (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </button>

          {/* Underline */}
          <button 
            type="button" 
            onClick={() => {
              if (editorMode === 'visual') execVisual("underline");
              else applySourceFormat("<u>", "</u>");
            }} 
            className="p-1.5 text-[#94A3B8] hover:text-white hover:bg-[#334155] rounded transition-colors" 
            title="Underline (Ctrl+U)"
          >
            <Underline className="h-4 w-4" />
          </button>

          <div className="w-px h-5 bg-[#334155] mx-1"></div>

          {/* Indent (Increase Indent) */}
          <button 
            type="button" 
            onClick={() => {
              if (editorMode === 'visual') execVisual("indent");
              else applySourceFormat('<div style="margin-left: 24px">\n', '\n</div>');
            }} 
            className="flex items-center space-x-1 px-2 py-1 text-[#06B6D4] hover:text-white hover:bg-[#06B6D4]/20 rounded border border-[#06B6D4]/30 bg-[#06B6D4]/5 transition-colors" 
            title="Indent Block (Tab) — Indents text visually without adding code tags"
          >
            <IndentIncrease className="h-3.5 w-3.5 text-[#06B6D4]" />
            <span className="text-[10px] font-mono font-bold hidden sm:inline">Indent</span>
          </button>

          {/* Outdent (Decrease Indent) */}
          <button 
            type="button" 
            onClick={() => {
              if (editorMode === 'visual') execVisual("outdent");
            }} 
            className="flex items-center space-x-1 px-2 py-1 text-[#94A3B8] hover:text-white hover:bg-[#334155] rounded border border-[#334155] transition-colors" 
            title="Outdent (Shift+Tab) — Decreases block indentation"
          >
            <IndentDecrease className="h-3.5 w-3.5" />
            <span className="text-[10px] font-mono font-bold hidden sm:inline">Outdent</span>
          </button>

          <div className="w-px h-5 bg-[#334155] mx-1"></div>

          {/* Alignment */}
          <button type="button" onClick={() => execVisual("justifyLeft")} className="p-1.5 text-[#94A3B8] hover:text-white hover:bg-[#334155] rounded transition-colors" title="Align Left">
            <AlignLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => execVisual("justifyCenter")} className="p-1.5 text-[#94A3B8] hover:text-white hover:bg-[#334155] rounded transition-colors" title="Align Center">
            <AlignCenter className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => execVisual("justifyRight")} className="p-1.5 text-[#94A3B8] hover:text-white hover:bg-[#334155] rounded transition-colors" title="Align Right">
            <AlignRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => execVisual("justifyFull")} className="p-1.5 text-[#94A3B8] hover:text-white hover:bg-[#334155] rounded transition-colors" title="Align Justify">
            <AlignJustify className="h-4 w-4" />
          </button>

          <div className="w-px h-5 bg-[#334155] mx-1"></div>

          {/* Superscript & Subscript */}
          <button type="button" onClick={() => execVisual("superscript")} className="p-1.5 text-[#94A3B8] hover:text-[#06B6D4] hover:bg-[#334155] rounded transition-colors" title="Superscript">
            <Superscript className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => execVisual("subscript")} className="p-1.5 text-[#94A3B8] hover:text-[#06B6D4] hover:bg-[#334155] rounded transition-colors" title="Subscript">
            <Subscript className="h-4 w-4" />
          </button>

          <div className="w-px h-5 bg-[#334155] mx-1"></div>

          {/* Insert Picture / Upload Image */}
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            className="flex items-center space-x-1 px-2 py-1 text-[11px] font-bold text-[#06B6D4] bg-[#06B6D4]/10 hover:bg-[#06B6D4]/20 rounded-lg border border-[#06B6D4]/30 transition-colors disabled:opacity-50" 
            title="Insert Picture — Upload image file or paste directly with Ctrl+V"
          >
            {uploadingImage ? (
              <Loader2 className="h-3 w-3 animate-spin text-[#06B6D4]" />
            ) : (
              <ImageIcon className="h-3 w-3" />
            )}
            <span>{uploadingImage ? "Uploading..." : "Picture"}</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            accept="image/*" 
            className="hidden" 
            onChange={handleFileSelect} 
          />

          {/* Contextual Citation */}
          <button 
            type="button" 
            onClick={openCitationModal}
            className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold text-[#F59E0B] bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 rounded-lg border border-[#F59E0B]/30 transition-colors" 
            title="Add Contextual Citation — Highlight term and click to mark orange"
          >
            <Quote className="h-3 w-3" />
            <span>ORANGE CITATION</span>
          </button>
        </div>

        {/* Editor Mode Selector: Visual (Word Processor) vs Source vs Preview */}
        <div className="flex items-center space-x-1 bg-[#0B0F19] p-1 rounded-lg border border-[#334155] shrink-0">
          <button
            type="button"
            onClick={() => handleModeChange('visual')}
            className={`flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
              editorMode === 'visual'
                ? "bg-[#06B6D4] text-slate-950 shadow-sm"
                : "text-[#94A3B8] hover:text-white"
            }`}
            title="Word Processor Mode — Visual formatting without special characters"
          >
            <FileText className="w-3 h-3" />
            <span>Visual (Word)</span>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('source')}
            className={`flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
              editorMode === 'source'
                ? "bg-[#06B6D4] text-slate-950 shadow-sm"
                : "text-[#94A3B8] hover:text-white"
            }`}
            title="Source Code Mode — Edit raw Markdown / HTML tags"
          >
            <Code className="w-3 h-3" />
            <span>Source</span>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('preview')}
            className={`flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
              editorMode === 'preview'
                ? "bg-[#06B6D4] text-slate-950 shadow-sm"
                : "text-[#94A3B8] hover:text-white"
            }`}
            title="Student Preview — View how this subtopic appears to students"
          >
            <Eye className="w-3 h-3" />
            <span>Preview</span>
          </button>
        </div>
      </div>

      {/* Editor Body */}
      {editorMode === 'visual' ? (
        /* MODE 1: WYSIWYG WORD PROCESSOR (DEFAULT) */
        <div className="relative bg-white rounded-b-xl overflow-hidden">
          <div
            ref={contentEditableRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleVisualInput}
            onKeyDown={handleVisualKeyDown}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            data-placeholder={placeholder}
            className="w-full bg-white p-6 min-h-[320px] text-sm leading-relaxed text-black focus:outline-none visual-word-sheet selection:bg-yellow-100 selection:text-black"
            style={{ minHeight: `${Math.max(rows * 32, 320)}px`, backgroundColor: '#FFFFFF', color: '#000000' }}
          />
          {/* Helpful Bottom Helper Bar */}
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-100 px-4 py-2 text-[11px] text-slate-600 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <strong>Visual Word Processor</strong> • White Paper Sheet • Black Text • Yellow Bold • Orange Citation
            </span>
            <span>Tab: Indent • Shift+Tab: Outdent • Ctrl+B: Yellow Bold</span>
          </div>
        </div>
      ) : editorMode === 'source' ? (
        /* MODE 2: RAW SOURCE CODE */
        <div>
          <textarea
            ref={textareaRef}
            rows={rows}
            value={value}
            onChange={(e) => {
              lastHtmlRef.current = e.target.value;
              onChange(e.target.value);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onPaste={handlePaste}
            placeholder={placeholder}
            className="w-full bg-transparent p-4 text-xs font-mono text-white placeholder-[#64748B] focus:outline-none resize-y"
          />
          <div className="flex items-center justify-between border-t border-[#334155]/50 bg-[#0B0F19]/80 px-3 py-1 text-[10px] text-[#64748B] font-mono">
            <span>Source Code Mode (Raw Markdown & HTML)</span>
          </div>
        </div>
      ) : (
        /* MODE 3: STUDENT PREVIEW */
        <div className="p-4 bg-slate-900/60 min-h-[160px] max-h-[460px] overflow-y-auto">
          {/* Visual Legend Bar */}
          <div className="flex items-center gap-4 text-[11px] font-mono bg-[#1E293B] p-2 rounded-lg border border-[#334155] mb-3 text-[#94A3B8]">
            <span className="flex items-center gap-1.5 text-[#CA8A04] font-bold">
              <span className="h-2 w-2 rounded-full bg-[#CA8A04]"></span>
              Bold Text = Yellow
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 text-[#EA580C] font-bold">
              <span className="h-2 w-2 rounded-full bg-[#EA580C]"></span>
              Citations = Orange
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 text-white font-bold">
              <span className="h-2 w-2 rounded-full bg-white"></span>
              Sheet = White Paper
            </span>
          </div>

          {/* White Paper Preview Sheet */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-md text-black visual-word-sheet">
            {value.trim() ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                urlTransform={safeUrlTransform}
                components={previewComponents}
              >
                {renderPreviewWithCitations(value) as any}
              </ReactMarkdown>
            ) : (
              <p className="text-slate-400 italic text-xs">Nothing to preview yet. Type content to see student preview.</p>
            )}
          </div>
        </div>
      )}

      {/* Citation Custom Modal */}
      {citationModalOpen && (
        <div className="fixed inset-0 bg-[#0B0F19]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-5 w-full max-w-sm shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-sm font-bold text-white flex items-center space-x-1.5">
                <Quote className="h-4 w-4 text-[#F59E0B]" />
                <span>Add Contextual Citation</span>
              </h4>
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
                  className="w-full rounded-lg border border-[#334155] bg-[#0B0F19] p-2 text-xs font-bold text-[#F59E0B] opacity-90"
                />
              </div>
              
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8] mb-1 block">Explanation *</label>
                <textarea 
                  rows={3}
                  value={citationData.explanation} 
                  onChange={e => setCitationData({...citationData, explanation: e.target.value})}
                  placeholder="Explain the concept for students..."
                  className="w-full rounded-lg border border-[#334155] bg-[#0B0F19] p-2 text-xs text-white focus:border-[#F59E0B] focus:outline-none"
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
                  className="w-full rounded-lg border border-[#334155] bg-[#0B0F19] p-2 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
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
                  className="flex-1 py-2 text-xs font-bold text-slate-950 bg-[#F59E0B] hover:bg-[#D97706] rounded-lg transition-colors shadow-md"
                >
                  Save Citation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
