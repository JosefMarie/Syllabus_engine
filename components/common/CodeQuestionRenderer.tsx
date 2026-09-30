"use client";

import React, { useState } from "react";
import { ExamQuestion, QuestionGrade } from "@/types/exam";
import { 
  Code2, 
  Terminal, 
  ArrowUp, 
  ArrowDown, 
  Check, 
  X, 
  Sparkles, 
  HelpCircle,
  Play,
  RotateCcw
} from "lucide-react";

interface CodeQuestionRendererProps {
  question: ExamQuestion;
  mode: "take" | "review" | "preview";
  studentAnswer?: any;
  onChange?: (answer: any) => void;
  grade?: QuestionGrade;
  showCorrectAnswer?: boolean;
}

export default function CodeQuestionRenderer({
  question,
  mode,
  studentAnswer,
  onChange,
  grade,
  showCorrectAnswer = false
}: CodeQuestionRendererProps) {
  const language = question.codeLanguage || "typescript";

  // =========================================================================
  // TYPE 1: CODE COMPLETION (FILL IN THE CODE BLANKS)
  // =========================================================================
  if (question.type === "code_completion") {
    const rawCode = question.codeSnippet || "";
    const lines = rawCode.split("\n");
    const currentAnswers = (typeof studentAnswer === "object" && studentAnswer !== null) ? studentAnswer : {};

    // Helper to render a single line with inline interactive input blanks
    const renderLineWithBlanks = (lineText: string, lineIndex: number) => {
      // Regex matches: ___1___, ___blank1___, {{1}}, {{blank1}}, [blank1], [1]
      const blankRegex = /(___\w+___|\{\{\w+\}\}|\[(?:blank\s*)?\w+\])/gi;
      const parts = lineText.split(blankRegex);

      return (
        <div key={lineIndex} className="flex items-center text-xs font-mono py-0.5 leading-relaxed flex-wrap gap-y-1">
          {/* Line number gutter */}
          <span className="w-8 shrink-0 select-none text-slate-600 text-right pr-3 font-mono text-[11px]">
            {lineIndex + 1}
          </span>

          <div className="flex-1 flex items-center flex-wrap gap-x-1">
            {parts.map((part, pIdx) => {
              const isBlankToken = blankRegex.test(part);
              // Reset regex state after test
              blankRegex.lastIndex = 0;

              if (isBlankToken) {
                // Extract clean blank ID: e.g. "___1___" -> "1", "{{count}}" -> "count"
                const blankId = part.replace(/[^a-zA-Z0-9_-]/g, "");
                const enteredVal = currentAnswers[blankId] ?? "";

                // Find blank metadata if configured
                const blankMeta = question.codeBlanks?.find(b => b.id === blankId);
                const accepted = blankMeta?.acceptedAnswers || [];

                if (mode === "take") {
                  return (
                    <input
                      key={pIdx}
                      type="text"
                      value={enteredVal}
                      onChange={(e) => {
                        if (onChange) {
                          onChange({
                            ...currentAnswers,
                            [blankId]: e.target.value
                          });
                        }
                      }}
                      placeholder={blankMeta?.placeholder || `___${blankId}___`}
                      className="px-2 py-0.5 rounded-lg border border-cyan-500/50 bg-[#0B0F19] text-cyan-300 font-bold font-mono text-xs focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 focus:bg-[#07131e] outline-none shadow-inner min-w-[70px] max-w-[160px] text-center transition-all"
                    />
                  );
                }

                // In Review or Preview Mode
                const isCorrect = accepted.some(a => a.trim().toLowerCase() === String(enteredVal).trim().toLowerCase());

                return (
                  <span key={pIdx} className="inline-flex items-center space-x-1">
                    <span className={`px-2 py-0.5 rounded-lg font-mono text-xs font-bold border inline-flex items-center space-x-1 ${
                      isCorrect
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                        : "border-rose-500/50 bg-rose-500/10 text-rose-300"
                    }`}>
                      <span>{enteredVal || "(empty)"}</span>
                      {isCorrect ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    </span>

                    {!isCorrect && (showCorrectAnswer || mode === "preview") && accepted.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-[10px] font-mono text-emerald-300">
                        Ans: {accepted[0]}
                      </span>
                    )}
                  </span>
                );
              }

              // Normal code token
              return (
                <span key={pIdx} className="text-slate-200 whitespace-pre">
                  {part}
                </span>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-3">
        {/* Code Editor Frame */}
        <div className="rounded-2xl border border-[#334155] bg-[#030712] overflow-hidden shadow-2xl">
          {/* Editor Header Bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-[#334155]/60 bg-[#0B0F19]">
            <div className="flex items-center space-x-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80 inline-block" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80 inline-block" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80 inline-block" />
              <span className="text-[11px] font-mono text-[#94A3B8] ml-2 flex items-center space-x-1">
                <Code2 className="h-3.5 w-3.5 text-cyan-400" />
                <span>exercise.{language === "python" ? "py" : language === "javascript" ? "js" : language === "sql" ? "sql" : "ts"}</span>
              </span>
            </div>

            <span className="rounded bg-[#1E293B] px-2 py-0.5 text-[10px] font-mono uppercase font-bold text-cyan-300 border border-[#334155]">
              {language}
            </span>
          </div>

          {/* Editor Code Canvas */}
          <div className="p-4 overflow-x-auto space-y-0.5 font-mono selection:bg-cyan-500/30">
            {lines.map((line, lIdx) => renderLineWithBlanks(line, lIdx))}
          </div>
        </div>

        {/* Instructions / Blanks Checklist helper */}
        {question.codeBlanks && question.codeBlanks.length > 0 && mode === "take" && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[#94A3B8]">
            <span className="text-slate-400 font-bold flex items-center space-x-1">
              <HelpCircle className="h-3 w-3 text-cyan-400" />
              <span>Blanks to fill:</span>
            </span>
            {question.codeBlanks.map((b, idx) => {
              const isFilled = Boolean(currentAnswers[b.id]?.trim());
              return (
                <span
                  key={b.id}
                  className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold transition-all ${
                    isFilled
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-[#334155] bg-[#0B0F19] text-slate-400"
                  }`}
                >
                  Blank #{idx + 1} {isFilled ? "✓" : "..."}
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // TYPE 2: CODE ORDERING (PARSON'S PUZZLE)
  // =========================================================================
  if (question.type === "code_ordering") {
    const rawLines = question.codeLines || [];
    
    // Initialize student order if not set
    const currentOrder: string[] = Array.isArray(studentAnswer) && studentAnswer.length === rawLines.length
      ? studentAnswer
      : rawLines;

    const handleMoveLine = (fromIdx: number, toIdx: number) => {
      if (toIdx < 0 || toIdx >= currentOrder.length) return;
      const next = [...currentOrder];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      if (onChange) {
        onChange(next);
      }
    };

    const handleResetOrder = () => {
      if (onChange) {
        // Scramble lines
        const shuffled = [...rawLines].sort(() => Math.random() - 0.5);
        onChange(shuffled);
      }
    };

    const expectedOrder = rawLines;
    const isPerfectMatch = expectedOrder.length > 0 &&
      expectedOrder.length === currentOrder.length &&
      expectedOrder.every((l, i) => l.trim() === (currentOrder[i] || "").trim());

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-[#94A3B8]">
          <span className="flex items-center space-x-1.5 font-mono">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>Arrange the scrambled lines of code into the correct execution sequence:</span>
          </span>

          {mode === "take" && (
            <button
              type="button"
              onClick={handleResetOrder}
              className="text-[11px] font-mono text-cyan-400 hover:underline flex items-center space-x-1"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Shuffle</span>
            </button>
          )}
        </div>

        {/* Interactive Line Cards */}
        <div className="space-y-2">
          {currentOrder.map((line, idx) => {
            const isTargetLine = expectedOrder[idx]?.trim() === line.trim();

            return (
              <div
                key={idx}
                className={`flex items-center justify-between rounded-xl border p-3 bg-[#0B0F19] transition-all font-mono text-xs ${
                  mode === "take"
                    ? "border-[#334155] hover:border-cyan-500/50"
                    : isTargetLine
                      ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-200"
                      : "border-rose-500/40 bg-rose-500/5 text-rose-200"
                }`}
              >
                <div className="flex items-center space-x-3 flex-1 overflow-x-auto mr-3">
                  <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#1E293B] text-[10px] font-bold text-cyan-300 shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-white whitespace-pre font-mono">
                    {line}
                  </span>
                </div>

                {mode === "take" ? (
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveLine(idx, idx - 1)}
                      className="p-1.5 rounded-lg border border-[#334155] bg-[#1E293B] text-[#94A3B8] hover:text-white hover:border-cyan-400 disabled:opacity-30 transition-all"
                      title="Move line up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === currentOrder.length - 1}
                      onClick={() => handleMoveLine(idx, idx + 1)}
                      className="p-1.5 rounded-lg border border-[#334155] bg-[#1E293B] text-[#94A3B8] hover:text-white hover:border-cyan-400 disabled:opacity-30 transition-all"
                      title="Move line down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="shrink-0">
                    {isTargetLine ? (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold flex items-center space-x-1">
                        <Check className="h-3 w-3" />
                        <span>Correct position</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 font-bold flex items-center space-x-1">
                        <X className="h-3 w-3" />
                        <span>Incorrect position</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Live Program Preview */}
        <div className="rounded-2xl border border-[#334155] bg-[#030712] p-4 space-y-1.5">
          <div className="flex items-center justify-between border-b border-[#334155]/60 pb-1.5 mb-2">
            <span className="text-[10px] font-mono uppercase font-bold text-[#64748B] flex items-center space-x-1">
              <Play className="h-3 w-3 text-emerald-400" />
              <span>Resulting Program Code Preview:</span>
            </span>
            <span className="text-[10px] font-mono text-[#94A3B8]">{language}</span>
          </div>

          <pre className="text-xs font-mono text-cyan-200 overflow-x-auto whitespace-pre leading-relaxed">
            {currentOrder.join("\n")}
          </pre>
        </div>
      </div>
    );
  }

  // =========================================================================
  // TYPE 3: PREDICT THE OUTPUT
  // =========================================================================
  if (question.type === "predict_output") {
    const rawCode = question.codeSnippet || "";
    const lines = rawCode.split("\n");
    const enteredVal = String(studentAnswer ?? "");
    const expectedVal = String(question.correctAnswer ?? "");
    const isCorrect = enteredVal.trim().toLowerCase() === expectedVal.trim().toLowerCase();

    return (
      <div className="space-y-4">
        {/* Code Canvas */}
        <div className="rounded-2xl border border-[#334155] bg-[#030712] overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-4 py-2 border-b border-[#334155]/60 bg-[#0B0F19]">
            <div className="flex items-center space-x-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80 inline-block" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80 inline-block" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80 inline-block" />
              <span className="text-[11px] font-mono text-[#94A3B8] ml-2">code_to_evaluate.{language === "python" ? "py" : "js"}</span>
            </div>
            <span className="rounded bg-[#1E293B] px-2 py-0.5 text-[10px] font-mono uppercase font-bold text-cyan-300 border border-[#334155]">
              {language}
            </span>
          </div>

          <div className="p-4 overflow-x-auto space-y-0.5 font-mono text-xs">
            {lines.map((line, lIdx) => (
              <div key={lIdx} className="flex items-center">
                <span className="w-8 shrink-0 select-none text-slate-600 text-right pr-3 font-mono text-[11px]">
                  {lIdx + 1}
                </span>
                <span className="text-slate-200 whitespace-pre">{line}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Terminal Stdout Prediction Box */}
        <div className="rounded-2xl border border-[#334155] bg-[#0B0F19] p-4 space-y-2">
          <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400 font-bold">
            <Terminal className="h-4 w-4" />
            <span>Predicted Terminal Output (stdout / return value):</span>
          </div>

          {mode === "take" ? (
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-emerald-400 font-mono text-xs font-bold">&gt;</span>
              <input
                type="text"
                value={enteredVal}
                onChange={(e) => {
                  if (onChange) onChange(e.target.value);
                }}
                placeholder="Type the exact output here (e.g. 42 or true or Hello, World)..."
                className="w-full rounded-xl border border-[#334155] bg-[#030712] pl-8 pr-4 py-2.5 text-xs font-mono text-emerald-400 font-bold focus:border-[#06B6D4] focus:outline-none"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-xl border border-[#334155] bg-[#030712] p-3 text-xs font-mono">
                <span className="text-[10px] text-[#94A3B8] block mb-1">Your Prediction:</span>
                <span className={isCorrect ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                  &gt; {enteredVal || "(No output entered)"}
                </span>
              </div>

              {!isCorrect && (showCorrectAnswer || mode === "preview") && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-mono">
                  <span className="text-[10px] text-emerald-300 block mb-1 font-bold">Expected Output:</span>
                  <span className="text-emerald-400 font-bold">&gt; {expectedVal}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
