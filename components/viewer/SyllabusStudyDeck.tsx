"use client";

import React, { useState, useMemo } from "react";
import { Syllabus, LearningOutcome } from "@/types/syllabus";
import { CourseFlashcard, FlashcardMastery } from "@/types/flashcard";
import { 
  BookOpen, 
  Sparkles, 
  RotateCw, 
  CheckCircle2, 
  HelpCircle, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Layers, 
  Award,
  Zap
} from "lucide-react";

interface SyllabusStudyDeckProps {
  syllabus: Syllabus;
  isOpen: boolean;
  onClose: () => void;
}

export default function SyllabusStudyDeck({
  syllabus,
  isOpen,
  onClose
}: SyllabusStudyDeckProps) {
  // Extract flashcards from syllabus learning outcomes and subtopics
  const cards: CourseFlashcard[] = useMemo(() => {
    const list: CourseFlashcard[] = [];
    let idx = 1;

    syllabus.learningOutcomes?.forEach((lo) => {
      // 1. Learning Outcome card
      list.push({
        id: `card_${idx++}`,
        syllabusId: syllabus.id,
        courseCode: syllabus.courseCode,
        topicTitle: lo.title,
        frontPrompt: `What is the core competence and outcome of: "${lo.title}"?`,
        backAnswer: `${lo.title}\n\nOutcome Overview:\n${lo.description || "Understand core principles and standard industry practices for this unit of learning."}`,
        tags: ["Outcome", syllabus.courseCode]
      });

      // 2. Subtopic cards
      lo.indicativeContents?.forEach((ic) => {
        ic.topics?.forEach((top) => {
          top.subtopics?.forEach((sub) => {
            list.push({
              id: `card_${idx++}`,
              syllabusId: syllabus.id,
              courseCode: syllabus.courseCode,
              topicTitle: sub.title,
              frontPrompt: `Define & explain the practical role of: "${sub.title}"`,
              backAnswer: `Topic: ${top.title}\nConcept: ${sub.title}\n\nKey takeaways:\n• Theoretical foundation and standard industrial practices\n• Implementation within ${syllabus.title}\n• Associated assessment outcome for ${lo.title}`,
              tags: [top.title]
            });
          });
        });
      });
    });

    return list;
  }, [syllabus]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteryMap, setMasteryMap] = useState<Record<string, FlashcardMastery>>({});

  if (!isOpen || cards.length === 0) return null;

  const currentCard = cards[currentIndex];
  const totalCards = cards.length;
  const currentMastery = masteryMap[currentCard.id] || "new";

  const masteredCount = Object.values(masteryMap).filter((m) => m === "mastered").length;
  const learningCount = Object.values(masteryMap).filter((m) => m === "learning").length;

  const handleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % totalCards);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + totalCards) % totalCards);
  };

  const handleRate = (mastery: FlashcardMastery) => {
    setMasteryMap((prev) => ({ ...prev, [currentCard.id]: mastery }));
    handleNext();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-left">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Course Study Deck & Flashcards</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {syllabus.courseCode}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Spaced repetition card deck built from syllabus learning outcomes
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Tracker */}
        <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-3">
            <span className="text-slate-400">Card {currentIndex + 1} of {totalCards}</span>
            <span className="text-emerald-400">✓ {masteredCount} Mastered</span>
            <span className="text-amber-400">⚡ {learningCount} Learning</span>
          </div>

          <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-400 rounded-full transition-all"
              style={{ width: `${((currentIndex + 1) / totalCards) * 100}%` }}
            />
          </div>
        </div>

        {/* Card Body with 3D Flip */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-slate-950">
          <div
            onClick={handleFlip}
            className="w-full max-w-lg min-h-[280px] p-8 rounded-3xl border-2 cursor-pointer transition-all duration-300 flex flex-col justify-between select-none relative overflow-hidden group shadow-xl"
            style={{
              backgroundColor: isFlipped ? "#0F172A" : "#1E293B",
              borderColor: isFlipped ? "rgba(6, 182, 212, 0.6)" : "rgba(51, 65, 85, 0.8)"
            }}
          >
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono uppercase tracking-wider text-[10px] text-cyan-400">
                {isFlipped ? "Back: Explanation & Details" : "Front: Prompt & Concept"}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-slate-500 group-hover:text-cyan-400 transition-colors">
                <RotateCw className="w-3.5 h-3.5" />
                <span>Click to Flip</span>
              </span>
            </div>

            <div className="my-auto py-4 text-center">
              {isFlipped ? (
                <div className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap text-left font-sans animate-in fade-in duration-150">
                  {currentCard.backAnswer}
                </div>
              ) : (
                <div className="text-lg sm:text-xl font-bold text-white leading-relaxed animate-in fade-in duration-150">
                  {currentCard.frontPrompt}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
              <span className="truncate max-w-[200px] text-slate-500">
                {currentCard.topicTitle}
              </span>
              <span className="font-mono text-cyan-400 font-bold">
                Status: {currentMastery.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Self-Rating Controls */}
          {isFlipped && (
            <div className="mt-5 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <button
                type="button"
                onClick={() => handleRate("learning")}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all"
              >
                ⚡ Still Learning
              </button>
              <button
                type="button"
                onClick={() => handleRate("mastered")}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-950/40 transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mastered Concept!</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrev}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <span className="text-xs text-slate-500 font-mono">
            Spacebar / Click card to reveal
          </span>

          <button
            type="button"
            onClick={handleNext}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors flex items-center gap-1"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
