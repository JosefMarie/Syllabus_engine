"use client";

import React, { useState, useEffect } from "react";
import { Subtopic, Citation } from "@/types/syllabus";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import SandpackPlayground from "./SandpackPlayground";
import ImageLightbox from "./ImageLightbox";
import { CheckCircle2, Circle, BookOpen, Monitor, AlignLeft, ChevronLeft, ChevronRight, Sparkles, Lightbulb, ZoomIn, X, Image as ImageIcon } from "lucide-react";

interface Props {
  subtopic: Subtopic;
  citationsMap: Record<string, Citation>;
  onSelectCitation: (citation: Citation) => void;
  isCompleted: boolean;
  onToggleComplete: () => void;
  onPrevSubtopic?: () => void;
  onNextSubtopic?: () => void;
  currentIndex?: number;
  totalSubtopics?: number;
}

export default function SubtopicView({
  subtopic,
  citationsMap,
  onSelectCitation,
  isCompleted,
  onToggleComplete,
  onPrevSubtopic,
  onNextSubtopic,
  currentIndex = 1,
  totalSubtopics = 1,
}: Props) {
  const [viewMode, setViewMode] = useState<'slide' | 'continuous'>('slide');

  // Keyboard Left / Right arrow navigation for slides
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode !== 'slide') return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === "ArrowLeft" && onPrevSubtopic) {
        onPrevSubtopic();
      } else if (e.key === "ArrowRight" && onNextSubtopic) {
        onNextSubtopic();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, onPrevSubtopic, onNextSubtopic]);

  // Highlight terms in text based on citations map
  const renderMarkdownWithCitations = (content: string) => {
    if (!content) return "";
    const termKeys = citationsMap ? Object.keys(citationsMap) : [];
    if (termKeys.length === 0) return content;

    const pattern = new RegExp(`\\b(${termKeys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|")})\\b`, "gi");
    const parts = content.split(pattern);
    return parts.map((part, idx) => {
      const lower = part.toLowerCase();
      if (citationsMap[lower]) {
        const citation = citationsMap[lower];
        return (
          <span
            key={idx}
            onClick={() => onSelectCitation(citation)}
            className="font-bold italic underline decoration-[#EA580C] decoration-2 underline-offset-4 text-[#EA580C] cursor-pointer hover:bg-orange-100 rounded px-1 transition-colors citation-highlight"
            title={`Click for Explanation: ${citation.term}`}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Parse HTML formatting tags (<u>, <sup>, <sub>, <div align="...">, etc.) inside text nodes
  const parseInlineHtmlAndCitations = (text: string): React.ReactNode => {
    if (!text) return text;

    const tagRegex = /<(u|ins|sup|sub|div|span|strong|b|blockquote)([^>]*)>([\s\S]*?)<\/\1>/gi;
    if (!tagRegex.test(text)) {
      return renderMarkdownWithCitations(text);
    }
    tagRegex.lastIndex = 0;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = tagRegex.exec(text)) !== null) {
      const [fullMatch, tagName, attrString, innerContent] = match;
      const matchIndex = match.index;

      if (matchIndex > lastIndex) {
        const preceding = text.substring(lastIndex, matchIndex);
        parts.push(renderMarkdownWithCitations(preceding));
      }

      const tagLower = tagName.toLowerCase();
      const parsedInner = parseInlineHtmlAndCitations(innerContent);

      if (tagLower === "strong" || tagLower === "b") {
        parts.push(
          <strong key={matchIndex} className="font-bold text-[#CA8A04]">
            {parsedInner}
          </strong>
        );
      } else if (tagLower === "blockquote") {
        parts.push(
          <blockquote key={matchIndex} className="my-3 pl-4 border-l-2 border-[#06B6D4]/50 bg-[#06B6D4]/5 p-2 rounded-r-lg text-sm text-[#CBD5E1]">
            {parsedInner}
          </blockquote>
        );
      } else if (tagLower === "u" || tagLower === "ins") {
        parts.push(
          <u key={matchIndex} className="underline underline-offset-4 decoration-[#06B6D4] decoration-2 text-white font-medium">
            {parsedInner}
          </u>
        );
      } else if (tagLower === "sup") {
        parts.push(
          <sup key={matchIndex} className="text-[0.75em] leading-none align-super font-mono text-[#06B6D4] font-bold px-0.5">
            {parsedInner}
          </sup>
        );
      } else if (tagLower === "sub") {
        parts.push(
          <sub key={matchIndex} className="text-[0.75em] leading-none align-sub font-mono text-[#06B6D4] font-bold px-0.5">
            {parsedInner}
          </sub>
        );
      } else if (tagLower === "div" || tagLower === "span") {
        const isBlock = tagLower === "div";
        let alignClass = "";
        if (/align=["']?center/i.test(attrString) || /text-align:\s*center/i.test(attrString)) {
          alignClass = isBlock ? "text-center my-2 w-full block" : "block text-center";
        } else if (/align=["']?right/i.test(attrString) || /text-align:\s*right/i.test(attrString)) {
          alignClass = isBlock ? "text-right my-2 w-full block" : "block text-right";
        } else if (/align=["']?justify/i.test(attrString) || /text-align:\s*justify/i.test(attrString)) {
          alignClass = isBlock ? "text-justify my-2 w-full block" : "block text-justify";
        } else if (/align=["']?left/i.test(attrString) || /text-align:\s*left/i.test(attrString)) {
          alignClass = isBlock ? "text-left my-2 w-full block" : "block text-left";
        }

        let indentClass = "";
        if (/margin-left|padding-left|indent/i.test(attrString)) {
          indentClass = "pl-6 border-l-2 border-[#06B6D4]/40 bg-[#06B6D4]/5 p-3 rounded-r-xl my-3";
        }

        const Component = isBlock ? 'div' : 'span';
        parts.push(
          <Component key={matchIndex} className={`${alignClass} ${indentClass}`}>
            {parsedInner}
          </Component>
        );
      }

      lastIndex = matchIndex + fullMatch.length;
    }

    if (lastIndex < text.length) {
      const trailing = text.substring(lastIndex);
      parts.push(renderMarkdownWithCitations(trailing));
    }

    return parts;
  };

  const recursivelyRenderCitations = (node: React.ReactNode): React.ReactNode => {
    if (typeof node === "string") {
      return parseInlineHtmlAndCitations(node);
    }
    if (Array.isArray(node)) {
      return node.map((n, i) => <React.Fragment key={i}>{recursivelyRenderCitations(n)}</React.Fragment>);
    }
    if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
      if (node.props && node.props.children) {
        return React.cloneElement(node, {
          ...node.props,
          children: recursivelyRenderCitations(node.props.children)
        });
      }
    }
    return node;
  };

  const safeUrlTransform = (url: string) => {
    if (!url) return "";
    const clean = url.trim();
    if (/^(javascript|vbscript):/i.test(clean)) {
      return "";
    }
    return clean;
  };

  function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
    const [hasError, setHasError] = useState(false);
    const [isZoomed, setIsZoomed] = useState(false);

    // Clean up data URLs that may have accidental whitespace or linebreaks
    const cleanSrc = React.useMemo(() => {
      if (!src) return "";
      const trimmed = src.trim();
      if (trimmed.startsWith("data:image/")) {
        const commaIdx = trimmed.indexOf(",");
        if (commaIdx !== -1) {
          const prefix = trimmed.slice(0, commaIdx + 1);
          const base64Data = trimmed.slice(commaIdx + 1).replace(/\s+/g, "");
          return prefix + base64Data;
        }
      }
      return trimmed;
    }, [src]);

    if (hasError || !cleanSrc) {
      return (
        <div className="my-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center max-w-lg mx-auto">
          <div className="flex items-center justify-center text-slate-400 mb-1">
            <ImageIcon className="w-6 h-6" />
          </div>
          <p className="text-xs font-mono text-slate-500">{alt || "Educational illustration not available"}</p>
        </div>
      );
    }

    return (
      <>
        <figure className="my-5 max-w-2xl mx-auto rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs group">
          <div 
            onClick={() => setIsZoomed(true)} 
            className="relative overflow-hidden rounded-lg cursor-zoom-in bg-slate-50 flex items-center justify-center"
          >
            <img
              src={cleanSrc}
              alt={alt || "Curriculum Visual"}
              onError={() => setHasError(true)}
              className="max-h-96 w-auto object-contain mx-auto transition-transform duration-200 group-hover:scale-[1.01]"
              loading="lazy"
            />
            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white text-[10px] font-mono px-2 py-1 rounded-md flex items-center gap-1 backdrop-blur-xs">
              <ZoomIn className="w-3 h-3" />
              <span>Click to Zoom</span>
            </div>
          </div>
          {alt && alt !== "Syllabus image" && alt !== "Curriculum Visual" && (
            <figcaption className="mt-2 text-center text-xs font-mono text-slate-500 italic">
              {alt}
            </figcaption>
          )}
        </figure>

        {isZoomed && (
          <div 
            onClick={() => setIsZoomed(false)} 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm cursor-zoom-out"
          >
            <div className="relative max-h-[92vh] max-w-[92vw] overflow-hidden rounded-2xl bg-white p-2 shadow-2xl">
              <button 
                onClick={() => setIsZoomed(false)} 
                className="absolute top-3 right-3 z-10 rounded-full bg-black/70 text-white p-1.5 hover:bg-black transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <img 
                src={cleanSrc} 
                alt={alt || "Zoomed view"} 
                className="max-h-[85vh] max-w-[90vw] object-contain mx-auto rounded-xl"
              />
            </div>
          </div>
        )}
      </>
    );
  }

  // Custom components for ReactMarkdown to make lists & sections visually engaging
  const slideMarkdownComponents = {
    p: ({ children }: any) => <p className="my-4 text-black text-base leading-relaxed">{recursivelyRenderCitations(children)}</p>,
    strong: ({ children }: any) => (
      <strong className="font-bold text-[#CA8A04]">
        {recursivelyRenderCitations(children)}
      </strong>
    ),
    b: ({ children }: any) => (
      <strong className="font-bold text-[#CA8A04]">
        {recursivelyRenderCitations(children)}
      </strong>
    ),
    u: ({ children }: any) => <u className="underline underline-offset-4 decoration-[#06B6D4] decoration-2 text-black font-medium">{recursivelyRenderCitations(children)}</u>,
    ins: ({ children }: any) => <u className="underline underline-offset-4 decoration-[#06B6D4] decoration-2 text-black font-medium">{recursivelyRenderCitations(children)}</u>,
    sup: ({ children }: any) => <sup className="text-[0.75em] leading-none align-super font-mono text-[#06B6D4] font-bold px-0.5">{recursivelyRenderCitations(children)}</sup>,
    sub: ({ children }: any) => <sub className="text-[0.75em] leading-none align-sub font-mono text-[#06B6D4] font-bold px-0.5">{recursivelyRenderCitations(children)}</sub>,
    div: ({ align, style, children, className }: any) => {
      let alignClass = "";
      if (align === "center" || style?.textAlign === "center") alignClass = "text-center my-2 w-full block";
      else if (align === "right" || style?.textAlign === "right") alignClass = "text-right my-2 w-full block";
      else if (align === "justify" || style?.textAlign === "justify") alignClass = "text-justify my-2 w-full block";
      else if (align === "left" || style?.textAlign === "left") alignClass = "text-left my-2 w-full block";

      let indentClass = "";
      if (style?.marginLeft || style?.paddingLeft || className?.includes("indent") || className?.includes("visual-indent")) {
        indentClass = "pl-6 border-l-2 border-[#06B6D4]/40 bg-[#06B6D4]/5 p-3 rounded-r-xl my-3";
      }

      return (
        <div className={`${alignClass} ${indentClass} ${className || ""}`}>
          {recursivelyRenderCitations(children)}
        </div>
      );
    },
    span: ({ align, style, children, className }: any) => {
      let alignClass = "";
      if (align === "center" || style?.textAlign === "center") alignClass = "block text-center";
      else if (align === "right" || style?.textAlign === "right") alignClass = "block text-right";
      else if (align === "justify" || style?.textAlign === "justify") alignClass = "block text-justify";

      return (
        <span className={`${alignClass} ${className || ""}`} style={style}>
          {recursivelyRenderCitations(children)}
        </span>
      );
    },
    h3: ({ children }: any) => (
      <div className="mt-8 mb-4 border-l-4 border-[#06B6D4] bg-[#06B6D4]/10 p-3 rounded-r-xl">
        <h3 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#06B6D4]" />
          <span>{recursivelyRenderCitations(children)}</span>
        </h3>
      </div>
    ),
    blockquote: ({ children }: any) => (
      <div className="my-6 rounded-2xl border border-[#06B6D4]/40 bg-gradient-to-r from-[#06B6D4]/10 to-[#10B981]/10 p-5 shadow-xs">
        <div className="flex items-center space-x-2 text-xs font-mono font-bold text-[#06B6D4] uppercase tracking-wider mb-2">
          <Lightbulb className="w-4 h-4 text-[#EA580C]" />
          <span>Key Curriculum Insight</span>
        </div>
        <div className="italic text-slate-900 text-sm md:text-base leading-relaxed">
          {recursivelyRenderCitations(children)}
        </div>
      </div>
    ),
    ol: ({ children }: any) => <div className="my-3 space-y-2">{children}</div>,
    ul: ({ children }: any) => <div className="my-3 space-y-2">{children}</div>,
    li: ({ children }: any) => (
      <p className="my-2 text-black text-sm md:text-base leading-relaxed">
        {recursivelyRenderCitations(children)}
      </p>
    ),
    img: ({ src, alt }: any) => <MarkdownImage src={src} alt={alt} />,
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
      {/* Presentation View Mode Switcher Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1E293B] p-4 rounded-2xl border border-[#334155] shadow-xl mb-6">
        <div className="flex items-center space-x-2 text-xs font-mono text-[#94A3B8]">
          <Sparkles className="h-4 w-4 text-[#06B6D4]" />
          <span>Viewing Mode:</span>
          <span className="text-white font-bold">{viewMode === 'slide' ? 'Interactive Slide Deck' : 'Continuous Document'}</span>
        </div>

        <div className="flex items-center space-x-2 bg-[#0B0F19] p-1 rounded-xl border border-[#334155]">
          <button
            onClick={() => setViewMode('slide')}
            className={`inline-flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              viewMode === 'slide'
                ? "bg-[#06B6D4] text-slate-950 shadow-md"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <Monitor className="h-3.5 w-3.5" />
            <span>Slide Deck View</span>
          </button>

          <button
            onClick={() => setViewMode('continuous')}
            className={`inline-flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              viewMode === 'continuous'
                ? "bg-[#06B6D4] text-slate-950 shadow-md"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <AlignLeft className="h-3.5 w-3.5" />
            <span>Page View</span>
          </button>
        </div>
      </div>

      {/* RENDER MODE 1: SLIDE DECK PRESENTATION MODE */}
      {viewMode === 'slide' ? (
        <div className="relative space-y-6">
          {/* Main Presentation Slide Canvas Card */}
          <div className="relative rounded-3xl border border-[#06B6D4]/40 bg-gradient-to-b from-[#1E293B] via-[#0F172A] to-[#0B0F19] p-6 md:p-10 shadow-2xl overflow-hidden min-h-[500px]">
            {/* Slide Header & Progress */}
            <div className="flex items-center justify-between border-b border-[#334155] pb-4 mb-6">
              <div className="flex items-center space-x-2 text-xs font-mono text-[#06B6D4]">
                <span className="bg-[#06B6D4]/15 px-2.5 py-1 rounded-md border border-[#06B6D4]/30 font-bold uppercase tracking-wider">
                  Slide {currentIndex} of {totalSubtopics}
                </span>
                <span className="text-[#94A3B8] hidden sm:inline">•</span>
                <span className="text-[#94A3B8] hidden sm:inline">Use ← → Arrow Keys to Flip Slides</span>
              </div>

              <button
                onClick={onToggleComplete}
                className={`inline-flex items-center space-x-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                  isCompleted
                    ? "bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40"
                    : "bg-[#1E293B] text-[#CBD5E1] border border-[#334155] hover:border-[#06B6D4]"
                }`}
              >
                {isCompleted ? <CheckCircle2 className="w-4 h-4 text-[#10B981]" /> : <Circle className="w-4 h-4 text-[#94A3B8]" />}
                <span>{isCompleted ? "Completed" : "Mark Complete"}</span>
              </button>
            </div>

            {/* Slide Subtopic Title */}
            <div className="mb-6">
              <span className="text-xs font-mono text-[#94A3B8] uppercase tracking-wider">
                Level 5 Subtopic
              </span>
              <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight mt-1 leading-tight">
                {subtopic.title}
              </h1>
            </div>

            {/* Slide Smart Markdown Content (Rendered on White Paper Sheet) */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 text-black shadow-lg border border-slate-200 visual-word-sheet my-4">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                urlTransform={safeUrlTransform}
                components={slideMarkdownComponents}
              >
                {subtopic?.contentMarkdown || ""}
              </ReactMarkdown>
            </div>

            {/* Code Playground inside Slide */}
            {subtopic.codeSnippet && (
              <div className="mt-8">
                <SandpackPlayground snippet={subtopic.codeSnippet} />
              </div>
            )}

            {/* Graphics inside Slide */}
            {subtopic.images && subtopic.images.length > 0 && (
              <div className="mt-8 space-y-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Graphic Diagram
                </h4>
                {subtopic.images.map((img) => (
                  <ImageLightbox key={img.id} image={img} />
                ))}
              </div>
            )}

            {/* Slide Technical Citations Drawer */}
            {subtopic.citations && subtopic.citations.length > 0 && (
              <div className="mt-8 rounded-2xl border border-[#F59E0B]/30 bg-[#F59E0B]/5 p-4">
                <div className="flex items-center space-x-2 text-xs font-bold text-[#F59E0B] uppercase tracking-wider font-mono mb-2">
                  <BookOpen className="w-4 h-4" />
                  <span>Technical Citations ({subtopic.citations.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {subtopic.citations.map((cit) => (
                    <button
                      key={cit.id}
                      onClick={() => onSelectCitation(cit)}
                      className="inline-flex items-center rounded-lg bg-[#1E293B] px-3 py-1.5 text-xs text-[#CBD5E1] border border-[#334155] hover:border-[#F59E0B] hover:text-[#F59E0B] transition-colors"
                    >
                      <span className="font-semibold mr-1.5">{cit.term}:</span>
                      <span className="text-[#94A3B8] truncate max-w-[200px]">{cit.explanation}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Floating Slide Deck Controls Bar */}
          <div className="flex items-center justify-between bg-[#1E293B] p-4 rounded-2xl border border-[#334155] shadow-xl">
            {onPrevSubtopic ? (
              <button
                onClick={onPrevSubtopic}
                className="inline-flex items-center space-x-2 rounded-xl bg-[#0B0F19] px-5 py-3 text-xs font-bold text-white border border-[#334155] hover:border-[#06B6D4] hover:bg-[#334155] transition-all shadow-md"
              >
                <ChevronLeft className="w-4 h-4 text-[#06B6D4]" />
                <span>Previous Slide (←)</span>
              </button>
            ) : <div />}

            <div className="text-center font-mono text-xs text-[#06B6D4] font-bold bg-[#06B6D4]/10 px-4 py-2 rounded-xl border border-[#06B6D4]/30">
              Slide {currentIndex} / {totalSubtopics}
            </div>

            {onNextSubtopic ? (
              <button
                onClick={onNextSubtopic}
                className="inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-[#06B6D4] to-[#10B981] px-5 py-3 text-xs font-bold text-slate-950 hover:opacity-90 transition-all shadow-xl"
              >
                <span>Next Slide (→)</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : <div />}
          </div>
        </div>
      ) : (

        /* RENDER MODE 2: CONTINUOUS DOCUMENT PAGE VIEW */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#334155] pb-6 gap-4">
            <div>
              <div className="flex items-center space-x-2 text-xs font-mono text-[#94A3B8] uppercase tracking-wider">
                <span>Level 5 Subtopic</span>
                <span>•</span>
                <span className="text-[#06B6D4]">Index #{subtopic.order}</span>
              </div>
              <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                {subtopic.title}
              </h1>
            </div>

            <button
              onClick={onToggleComplete}
              className={`inline-flex items-center space-x-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-md transition-all ${
                isCompleted
                  ? "bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40"
                  : "bg-[#1E293B] text-[#CBD5E1] border border-[#334155] hover:border-[#06B6D4] hover:text-white"
              }`}
            >
              {isCompleted ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                  <span>Completed</span>
                </>
              ) : (
                <>
                  <Circle className="w-4 h-4 text-[#94A3B8]" />
                  <span>Mark as Complete</span>
                </>
              )}
            </button>
          </div>

          {/* Document Smart Markdown Content (Rendered on White Paper Sheet) */}
          <div className="bg-white rounded-2xl p-6 sm:p-10 text-black shadow-xl border border-slate-200 visual-word-sheet">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              urlTransform={safeUrlTransform}
              components={slideMarkdownComponents}
            >
              {subtopic?.contentMarkdown || ""}
            </ReactMarkdown>
          </div>

          {subtopic.codeSnippet && (
            <div className="mt-8">
              <SandpackPlayground snippet={subtopic.codeSnippet} />
            </div>
          )}

          {subtopic.images && subtopic.images.length > 0 && (
            <div className="mt-8 space-y-4">
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
                Architectural Graphics & Mockups
              </h4>
              {subtopic.images.map((img) => (
                <ImageLightbox key={img.id} image={img} />
              ))}
            </div>
          )}

          {subtopic.citations && subtopic.citations.length > 0 && (
            <div className="mt-10 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/5 p-4">
              <div className="flex items-center space-x-2 text-xs font-bold text-[#F59E0B] uppercase tracking-wider font-mono mb-2">
                <BookOpen className="w-4 h-4" />
                <span>Extracted Technical Citations ({subtopic.citations.length})</span>
              </div>
              <div className="flex flex-[#94A3B8] gap-2">
                {subtopic.citations.map((cit) => (
                  <button
                    key={cit.id}
                    onClick={() => onSelectCitation(cit)}
                    className="inline-flex items-center rounded-lg bg-[#1E293B] px-3 py-1.5 text-xs text-[#CBD5E1] border border-[#334155] hover:border-[#F59E0B] hover:text-[#F59E0B] transition-colors"
                  >
                    <span className="font-semibold mr-1.5">{cit.term}:</span>
                    <span className="text-[#94A3B8] truncate max-w-[200px]">{cit.explanation}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
