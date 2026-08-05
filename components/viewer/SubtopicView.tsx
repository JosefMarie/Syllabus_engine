"use client";

import React from "react";
import { Subtopic, Citation } from "@/types/syllabus";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import SandpackPlayground from "./SandpackPlayground";
import ImageLightbox from "./ImageLightbox";
import { CheckCircle2, Circle, BookOpen, ArrowLeft, ArrowRight } from "lucide-react";

interface Props {
  subtopic: Subtopic;
  citationsMap: Record<string, Citation>;
  onSelectCitation: (citation: Citation) => void;
  isCompleted: boolean;
  onToggleComplete: () => void;
  onPrevSubtopic?: () => void;
  onNextSubtopic?: () => void;
}

export default function SubtopicView({
  subtopic,
  citationsMap,
  onSelectCitation,
  isCompleted,
  onToggleComplete,
  onPrevSubtopic,
  onNextSubtopic,
}: Props) {

  // Highlight terms in text based on citations map
  const renderMarkdownWithCitations = (content: string) => {
    const termKeys = Object.keys(citationsMap);
    if (termKeys.length === 0) return content;

    // Pattern matching citation terms
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
            className="font-bold italic underline decoration-[#F59E0B] decoration-2 underline-offset-4 text-[#F59E0B] cursor-pointer hover:bg-[#F59E0B]/20 rounded px-1 transition-colors"
            title={`Click for Explanation: ${citation.term}`}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const recursivelyRenderCitations = (node: React.ReactNode): React.ReactNode => {
    if (typeof node === "string") {
      return renderMarkdownWithCitations(node);
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      {/* Subtopic Header & Progress Action */}
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

      {/* Main Markdown Body */}
      <div className="mt-6 prose prose-invert max-w-none prose-[#06B6D4] text-[#CBD5E1] leading-relaxed">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p className="my-4">{recursivelyRenderCitations(children)}</p>,
            h3: ({ children }) => <h3 className="text-xl font-bold text-white mt-8 mb-4 border-b border-[#334155] pb-2">{recursivelyRenderCitations(children)}</h3>,
            blockquote: ({ children }) => (
              <blockquote className="my-4 border-l-4 border-[#06B6D4] bg-[#1E293B]/50 p-4 rounded-r-lg italic text-[#CBD5E1]">
                {recursivelyRenderCitations(children)}
              </blockquote>
            ),
            ul: ({ children }) => <ul className="my-4 list-disc pl-6 space-y-2">{recursivelyRenderCitations(children)}</ul>,
            ol: ({ children }) => <ol className="my-4 list-decimal pl-6 space-y-2">{recursivelyRenderCitations(children)}</ol>,
            li: ({ children }) => <li>{recursivelyRenderCitations(children)}</li>,
            img: ({ src, alt }) => (
              <img 
                src={src} 
                alt={alt || "Syllabus image"} 
                className="my-6 max-h-96 w-auto rounded-xl border border-[#334155] object-contain shadow-xl bg-[#0B0F19]"
              />
            ),
          }}
        >
          {subtopic.contentMarkdown}
        </ReactMarkdown>
      </div>

      {/* Executable Code Playground */}
      {subtopic.codeSnippet && (
        <div className="mt-8">
          <SandpackPlayground snippet={subtopic.codeSnippet} />
        </div>
      )}

      {/* Image Lightboxes */}
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

      {/* Contextual Terms Summary Footer */}
      {subtopic.citations && subtopic.citations.length > 0 && (
        <div className="mt-10 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/5 p-4">
          <div className="flex items-center space-x-2 text-xs font-bold text-[#F59E0B] uppercase tracking-wider font-mono mb-2">
            <BookOpen className="w-4 h-4" />
            <span>Extracted Technical Citations ({subtopic.citations.length})</span>
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

      {/* Bottom Subtopic Pagination */}
      <div className="mt-12 flex items-center justify-between border-t border-[#334155] pt-6">
        {onPrevSubtopic ? (
          <button
            onClick={onPrevSubtopic}
            className="flex items-center space-x-2 rounded-lg bg-[#1E293B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#334155] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Previous Subtopic</span>
          </button>
        ) : <div />}

        {onNextSubtopic ? (
          <button
            onClick={onNextSubtopic}
            className="flex items-center space-x-2 rounded-lg bg-[#06B6D4] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0891B2] transition-colors"
          >
            <span>Next Subtopic</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : <div />}
      </div>
    </div>
  );
}
