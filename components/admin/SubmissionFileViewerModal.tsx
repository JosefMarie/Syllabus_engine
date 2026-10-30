"use client";

import React, { useState, useMemo } from "react";
import { Assignment, AssignmentSubmission } from "@/types/assignment";
import { decodeBase64ToText, isTextOrCodeFile } from "@/lib/aiGrading";
import { 
  X, 
  FileText, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Minimize2, 
  Copy, 
  Check, 
  Sparkles, 
  FileCode, 
  File, 
  ExternalLink,
  Code2
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface SubmissionFileViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: AssignmentSubmission | null;
  assignment?: Assignment | null;
  onTriggerAiGrade?: (submission: AssignmentSubmission) => void;
  isAiGrading?: boolean;
}

export function SubmissionFileViewerModal({
  isOpen,
  onClose,
  submission,
  assignment,
  onTriggerAiGrade,
  isAiGrading = false
}: SubmissionFileViewerModalProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isCopied, setIsCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"file" | "text" | "instructions">("file");

  const fileData = submission?.fileData;
  const fileName = fileData?.name || "Uploaded File";
  const fileType = fileData?.type || "";
  const base64Url = fileData?.base64Url || "";

  // Determine file category
  const isPdf = fileType.includes("pdf") || fileName.toLowerCase().endsWith(".pdf");
  const isImage = fileType.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(fileName);
  const isCodeOrText = isTextOrCodeFile(fileName, fileType);

  // Decoded text content if it's code or text
  const decodedText = useMemo(() => {
    if (!isCodeOrText || !base64Url) return "";
    return decodeBase64ToText(base64Url);
  }, [isCodeOrText, base64Url]);

  if (!isOpen || !submission) return null;

  const handleCopyCode = () => {
    if (decodedText) {
      navigator.clipboard.writeText(decodedText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-6xl h-[92vh] rounded-2xl border border-cyan-500/30 bg-[#0F172A] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700/60 bg-[#1E293B]/90 px-5 py-3.5 backdrop-blur-md">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              {isPdf ? (
                <FileText className="h-5 w-5" />
              ) : isCodeOrText ? (
                <FileCode className="h-5 w-5" />
              ) : (
                <File className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white truncate max-w-md">
                  {fileData ? fileName : "Submission Details"}
                </h3>
                {fileData && (
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-cyan-400 border border-slate-700">
                    {(fileData.size / 1024).toFixed(1)} KB
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate">
                Student: <span className="text-white font-medium">{submission.studentName}</span> ({submission.studentUsername}) • {submission.courseCode}
              </p>
            </div>
          </div>

          {/* Navigation / Action bar */}
          <div className="flex items-center space-x-2">
            {/* View tabs if student provided both file and text */}
            <div className="flex rounded-xl bg-slate-900/80 p-0.5 border border-slate-700">
              {fileData && (
                <button
                  onClick={() => setActiveTab("file")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === "file"
                      ? "bg-cyan-500 text-slate-950 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  File Preview
                </button>
              )}
              {submission.contentMarkdown && (
                <button
                  onClick={() => setActiveTab("text")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === "text"
                      ? "bg-cyan-500 text-slate-950 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Written Answer
                </button>
              )}
              {assignment && (
                <button
                  onClick={() => setActiveTab("instructions")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === "instructions"
                      ? "bg-cyan-500 text-slate-950 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Rubric
                </button>
              )}
            </div>

            {/* AI Auto-Correct Button */}
            {onTriggerAiGrade && (
              <button
                onClick={() => onTriggerAiGrade(submission)}
                disabled={isAiGrading}
                className="inline-flex items-center space-x-1.5 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-3.5 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/30 transition-all shadow-sm disabled:opacity-50"
                title="Evaluate and suggest score & feedback with Gemini AI"
              >
                <Sparkles className={`h-3.5 w-3.5 text-amber-400 ${isAiGrading ? "animate-spin" : ""}`} />
                <span>{isAiGrading ? "Analyzing..." : "Auto-Correct with AI"}</span>
              </button>
            )}

            {/* Optional Download button */}
            {base64Url && (
              <a
                href={base64Url}
                download={fileName}
                className="inline-flex items-center space-x-1 rounded-xl border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-600 transition-all"
                title="Download local copy (optional)"
              >
                <Download className="h-3.5 w-3.5 text-slate-400" />
                <span className="hidden sm:inline">Download</span>
              </a>
            )}

            {/* Close button */}
            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              title="Close Preview (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-auto bg-[#0B0F19] p-4 relative">
          {activeTab === "file" && (
            <>
              {/* PDF Previewer */}
              {isPdf && base64Url && (
                <div className="w-full h-full min-h-[500px] flex flex-col rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
                  <div className="flex items-center justify-between bg-slate-950 px-4 py-2 border-b border-slate-800 text-xs text-slate-400">
                    <span className="font-mono">In-App PDF Reader: {fileName}</span>
                    <a
                      href={base64Url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center space-x-1 text-cyan-400 hover:underline"
                    >
                      <span>Open in New Tab</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <iframe
                    src={base64Url}
                    className="w-full h-full flex-1 border-0"
                    title={fileName}
                  />
                </div>
              )}

              {/* Code / Text File Previewer */}
              {isCodeOrText && decodedText && (
                <div className="w-full h-full flex flex-col rounded-xl border border-slate-800 bg-[#090D16] overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 px-4 py-2 text-xs">
                    <div className="flex items-center space-x-2">
                      <Code2 className="h-4 w-4 text-cyan-400" />
                      <span className="font-mono font-bold text-slate-200">{fileName}</span>
                      <span className="text-[10px] font-mono text-slate-500">
                        ({decodedText.split("\n").length} lines)
                      </span>
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className="inline-flex items-center space-x-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white transition-all"
                    >
                      {isCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{isCopied ? "Copied" : "Copy Code"}</span>
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-300 select-text">
                    <pre className="whitespace-pre">
                      {decodedText.split("\n").map((line, idx) => (
                        <div key={idx} className="flex hover:bg-slate-800/30 px-1 rounded">
                          <span className="w-10 shrink-0 text-right pr-4 text-slate-600 select-none">
                            {idx + 1}
                          </span>
                          <span className="flex-1 text-slate-200">{line || " "}</span>
                        </div>
                      ))}
                    </pre>
                  </div>
                </div>
              )}

              {/* Image Previewer */}
              {isImage && base64Url && (
                <div className="flex flex-col items-center justify-center h-full overflow-auto p-4">
                  <div className="flex items-center space-x-2 mb-3 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-1.5">
                    <button
                      onClick={() => setZoomLevel((prev) => Math.max(50, prev - 25))}
                      className="p-1 text-slate-400 hover:text-white"
                      title="Zoom Out"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </button>
                    <span className="text-xs font-mono text-cyan-400">{zoomLevel}%</span>
                    <button
                      onClick={() => setZoomLevel((prev) => Math.min(250, prev + 25))}
                      className="p-1 text-slate-400 hover:text-white"
                      title="Zoom In"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setZoomLevel(100)}
                      className="text-[10px] text-slate-400 hover:text-white px-1.5"
                    >
                      Reset
                    </button>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={base64Url}
                    alt={fileName}
                    style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "center center" }}
                    className="max-h-[70vh] rounded-xl shadow-2xl border border-slate-700 transition-transform duration-200 object-contain"
                  />
                </div>
              )}

              {/* Other file type fallback */}
              {!isPdf && !isCodeOrText && !isImage && (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <File className="h-16 w-16 text-slate-600 mb-3" />
                  <h4 className="text-base font-bold text-white mb-1">{fileName}</h4>
                  <p className="text-xs text-slate-400 max-w-md mb-4">
                    This file format ({fileType || "binary"}) cannot be rendered directly in the embedded viewport.
                    You can inspect it by downloading or using Gemini AI auto-correction above.
                  </p>
                  {base64Url && (
                    <a
                      href={base64Url}
                      download={fileName}
                      className="inline-flex items-center space-x-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-all shadow-lg"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download {fileName}</span>
                    </a>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === "text" && submission.contentMarkdown && (
            <div className="max-w-4xl mx-auto rounded-xl border border-slate-800 bg-[#0F172A] p-6 shadow-inner">
              <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-4 pb-2 border-b border-slate-800">
                Student Written Text Answer
              </h4>
              <div className="prose prose-invert prose-sm max-w-none text-slate-200 leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {submission.contentMarkdown}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {activeTab === "instructions" && assignment && (
            <div className="max-w-4xl mx-auto rounded-xl border border-slate-800 bg-[#0F172A] p-6 shadow-inner">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                <div>
                  <h4 className="text-sm font-bold text-white">{assignment.title}</h4>
                  <span className="text-xs text-cyan-400 font-mono">
                    Total Marks: {assignment.totalPoints} pts
                  </span>
                </div>
              </div>
              <div className="prose prose-invert prose-sm max-w-none text-slate-200 leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {assignment.instructionsMarkdown || assignment.description}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-[#1E293B] px-5 py-2.5 text-xs text-slate-400">
          <div className="flex items-center space-x-4">
            <span>
              Status:{" "}
              <strong className={submission.status === "graded" ? "text-emerald-400" : "text-amber-400"}>
                {submission.status.toUpperCase()}
              </strong>
            </span>
            {submission.score !== undefined && (
              <span>
                Awarded Score: <strong className="text-cyan-400">{submission.score}</strong> / {submission.maxScore}
              </span>
            )}
          </div>
          <span className="font-mono text-[11px] text-slate-500">
            Submitted on {new Date(submission.submittedAt).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
