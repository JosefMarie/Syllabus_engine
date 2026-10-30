"use client";

import React, { useState, useEffect, useMemo } from "react";
import { CodingChallenge, ChallengeSubmission, ChallengeDifficulty } from "@/types/challenge";
import { UserProfile } from "@/types/auth";
import { 
  getChallenges, 
  subscribeToChallenges, 
  saveChallengeSubmission, 
  getChallengeSubmissions, 
  subscribeToChallengeSubmissions 
} from "@/lib/db";
import { runChallengeTests, RunResultsSummary } from "@/lib/challengeRunner";
import { 
  Code2, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Trophy, 
  Sparkles, 
  RotateCcw, 
  Terminal, 
  ChevronRight, 
  Award, 
  AlertCircle, 
  Flame, 
  Users, 
  Send, 
  Filter, 
  Check, 
  BookOpen, 
  Clock,
  Layers
} from "lucide-react";

interface StudentChallengeArenaProps {
  currentUser: UserProfile | null;
}

export default function StudentChallengeArena({ currentUser }: StudentChallengeArenaProps) {
  const [challenges, setChallenges] = useState<CodingChallenge[]>([]);
  const [submissions, setSubmissions] = useState<ChallengeSubmission[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<CodingChallenge | null>(null);
  const [code, setCode] = useState<string>("");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"arena" | "leaderboard">("arena");

  // Runner execution states
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [runResults, setRunResults] = useState<RunResultsSummary | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  // Subscribe to challenges and submissions
  useEffect(() => {
    const unsubC = subscribeToChallenges((list) => {
      const activeList = list.filter((c) => c.active !== false);
      setChallenges(activeList);
      if (!selectedChallenge && activeList.length > 0) {
        setSelectedChallenge(activeList[0]);
        setCode(activeList[0].starterCode);
      }
    });

    const unsubS = subscribeToChallengeSubmissions((subs) => {
      setSubmissions(subs || []);
    });

    return () => {
      unsubC();
      unsubS();
    };
  }, []);

  // Update editor code when switching challenge
  const handleSelectChallenge = (ch: CodingChallenge) => {
    setSelectedChallenge(ch);
    // If student has a past successful submission, load it; otherwise load starter code
    const existing = submissions.find(
      (s) => s.challengeId === ch.id && s.studentUid === currentUser?.uid && s.passed
    );
    setCode(existing ? existing.code : ch.starterCode);
    setRunResults(null);
  };

  // Filtered challenges
  const filteredChallenges = useMemo(() => {
    return challenges.filter((c) => {
      if (filterDifficulty !== "all" && c.difficulty !== filterDifficulty) return false;
      return true;
    });
  }, [challenges, filterDifficulty]);

  // Solved Challenge IDs for current student
  const solvedChallengeIds = useMemo(() => {
    if (!currentUser) return new Set<string>();
    const solved = new Set<string>();
    submissions.forEach((s) => {
      if (s.studentUid === currentUser.uid && s.passed) {
        solved.add(s.challengeId);
      }
    });
    return solved;
  }, [submissions, currentUser]);

  // Total XP/Points earned by current student
  const studentTotalPoints = useMemo(() => {
    if (!currentUser) return 0;
    const solvedChallenges = challenges.filter((c) => solvedChallengeIds.has(c.id));
    return solvedChallenges.reduce((sum, c) => sum + c.points, 0);
  }, [challenges, solvedChallengeIds, currentUser]);

  // Leaderboard data
  const leaderboard = useMemo(() => {
    const studentStats: Record<string, { name: string; username: string; points: number; solvedCount: number }> = {};
    submissions.forEach((s) => {
      if (!s.passed) return;
      if (!studentStats[s.studentUid]) {
        studentStats[s.studentUid] = {
          name: s.studentName,
          username: s.studentUsername,
          points: 0,
          solvedCount: 0
        };
      }
      studentStats[s.studentUid].points += s.awardedPoints;
      studentStats[s.studentUid].solvedCount += 1;
    });

    return Object.entries(studentStats)
      .map(([uid, stat]) => ({ uid, ...stat }))
      .sort((a, b) => b.points - a.points || b.solvedCount - a.solvedCount);
  }, [submissions]);

  // Handle Run Tests locally
  const handleRun = async () => {
    if (!selectedChallenge) return;
    setRunning(true);
    setRunResults(null);
    try {
      const results = await runChallengeTests(
        code,
        selectedChallenge.functionName,
        selectedChallenge.testCases
      );
      setRunResults(results);
    } catch (err: any) {
      console.error("Test run error:", err);
    } finally {
      setRunning(false);
    }
  };

  // Handle Official Submission
  const handleSubmit = async () => {
    if (!selectedChallenge || !currentUser) return;
    setSubmitting(true);
    try {
      const results = await runChallengeTests(
        code,
        selectedChallenge.functionName,
        selectedChallenge.testCases
      );
      setRunResults(results);

      const submission: ChallengeSubmission = {
        id: `sub_${selectedChallenge.id}_${currentUser.uid}_${Date.now()}`,
        challengeId: selectedChallenge.id,
        challengeTitle: selectedChallenge.title,
        studentUid: currentUser.uid,
        studentName: currentUser.fullName,
        studentUsername: currentUser.username,
        code,
        passed: results.allPassed,
        testsPassed: results.testsPassed,
        testsTotal: results.testsTotal,
        executionTimeMs: results.executionTimeMs,
        awardedPoints: results.allPassed ? selectedChallenge.points : 0,
        submittedAt: new Date().toISOString()
      };

      await saveChallengeSubmission(submission);

      if (results.allPassed) {
        setShowCelebration(true);
      }
    } catch (err) {
      console.error("Submission error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const getDifficultyBadge = (diff: ChallengeDifficulty) => {
    switch (diff) {
      case "easy":
        return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
      case "medium":
        return "bg-amber-500/15 text-amber-300 border-amber-500/30";
      case "hard":
        return "bg-rose-500/15 text-rose-300 border-rose-500/30";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="rounded-2xl border border-[#334155]/80 bg-[#1E293B]/75 backdrop-blur-xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 h-44 w-44 bg-gradient-to-bl from-amber-500/15 via-rose-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#334155]/80 pb-5">
          <div className="flex items-center space-x-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500/20 to-rose-500/20 border border-amber-500/40 text-amber-400 shadow-inner shrink-0">
              <Code2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  Interactive Weekly Coding Arena
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  ⚡ Live Sandbox
                </span>
              </div>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Solve weekly algorithm puzzles, run automated test suites in-browser, and rank on the campus leaderboard.
              </p>
            </div>
          </div>

          {/* Student Arena Score Pill */}
          {currentUser && (
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-xl bg-[#0B0F19]/80 border border-amber-500/30 flex items-center gap-2.5 shadow-inner">
                <Flame className="w-5 h-5 text-amber-400 animate-pulse" />
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block">Your Arena XP</span>
                  <span className="text-lg font-extrabold font-mono text-amber-400">
                    {studentTotalPoints} PTS
                  </span>
                </div>
              </div>

              <div className="px-4 py-2 rounded-xl bg-[#0B0F19]/80 border border-cyan-500/30 flex items-center gap-2.5 shadow-inner">
                <Trophy className="w-5 h-5 text-cyan-400" />
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block">Solved</span>
                  <span className="text-lg font-extrabold font-mono text-cyan-300">
                    {solvedChallengeIds.size}/{challenges.length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center space-x-2 pt-4">
          <button
            type="button"
            onClick={() => setActiveTab("arena")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "arena"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-950/40"
                : "bg-[#0B0F19]/60 text-slate-400 hover:text-white"
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Coding Playground</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("leaderboard")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "leaderboard"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-950/40"
                : "bg-[#0B0F19]/60 text-slate-400 hover:text-white"
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Arena Leaderboard ({leaderboard.length})</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: CODING PLAYGROUND ARENA */}
      {activeTab === "arena" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Challenge List Picker */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl border border-[#334155]/70 bg-[#1E293B]/75 backdrop-blur-xl p-4 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Weekly Challenges
                </span>
                <select
                  value={filterDifficulty}
                  onChange={(e) => setFilterDifficulty(e.target.value)}
                  className="rounded-lg border border-[#334155]/80 bg-[#0B0F19]/70 py-1 px-2.5 text-xs text-white focus:outline-none"
                >
                  <option value="all">All Levels</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {filteredChallenges.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No challenges available in this category.
                  </div>
                ) : (
                  filteredChallenges.map((ch) => {
                    const isSelected = selectedChallenge?.id === ch.id;
                    const isSolved = solvedChallengeIds.has(ch.id);
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => handleSelectChallenge(ch)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start justify-between gap-2.5 ${
                          isSelected
                            ? "bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-950/20"
                            : "bg-[#0B0F19]/50 border-[#334155]/60 hover:border-[#334155] hover:bg-[#0B0F19]/80"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-mono font-bold text-slate-400">
                              Week {ch.weekNumber || 1}
                            </span>
                            <span
                              className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${getDifficultyBadge(
                                ch.difficulty
                              )}`}
                            >
                              {ch.difficulty}
                            </span>
                            {isSolved && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Solved</span>
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-white truncate">
                            {ch.title}
                          </h4>
                          <span className="text-[11px] font-mono text-amber-400 mt-1 block">
                            +{ch.points} XP Points
                          </span>
                        </div>
                        <ChevronRight
                          className={`w-4 h-4 mt-1 transition-transform ${
                            isSelected ? "text-amber-400 translate-x-1" : "text-slate-600"
                          }`}
                        />
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Split Screen Problem Brief & Code Studio */}
          <div className="lg:col-span-8 space-y-4">
            {selectedChallenge ? (
              <>
                {/* Challenge Details Card */}
                <div className="rounded-2xl border border-[#334155]/70 bg-[#1E293B]/75 backdrop-blur-xl p-5 shadow-xl space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#334155]/70 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${getDifficultyBadge(
                            selectedChallenge.difficulty
                          )}`}
                        >
                          {selectedChallenge.difficulty}
                        </span>
                        <h3 className="text-lg font-bold text-white">
                          {selectedChallenge.title}
                        </h3>
                      </div>
                      <span className="text-xs text-slate-400 mt-0.5 block">
                        Target Function: <code className="text-cyan-400 font-mono font-bold">{selectedChallenge.functionName}(...)</code> • Reward: <strong className="text-amber-400 font-mono">+{selectedChallenge.points} XP</strong>
                      </span>
                    </div>

                    {solvedChallengeIds.has(selectedChallenge.id) && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Completed & XP Claimed</span>
                      </span>
                    )}
                  </div>

                  {/* Problem Description */}
                  <div className="bg-[#0B0F19]/70 border border-[#334155]/60 rounded-xl p-4 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
                    {selectedChallenge.descriptionMarkdown}
                  </div>
                </div>

                {/* In-Browser Code Editor & Terminal */}
                <div className="rounded-2xl border border-[#334155]/70 bg-[#0B0F19] shadow-2xl overflow-hidden">
                  {/* Editor Header Bar */}
                  <div className="bg-[#1E293B]/90 border-b border-[#334155]/80 px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex space-x-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500/70" />
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                      </div>
                      <span className="text-xs font-mono font-semibold text-slate-300 ml-2">
                        solution.js (JavaScript Runner)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCode(selectedChallenge.starterCode)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1"
                        title="Reset to starter template"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRun}
                        disabled={running || submitting}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Play className={`w-3.5 h-3.5 text-cyan-400 ${running ? "animate-spin" : ""}`} />
                        <span>{running ? "Testing..." : "Run Tests"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting || running}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white shadow-md shadow-rose-950/40 transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{submitting ? "Submitting..." : "Submit Solution"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Code Textarea */}
                  <div className="relative">
                    <textarea
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      onKeyDown={(e) => {
                        // Support Tab key in code editor
                        if (e.key === "Tab") {
                          e.preventDefault();
                          const start = e.currentTarget.selectionStart;
                          const end = e.currentTarget.selectionEnd;
                          setCode(code.substring(0, start) + "  " + code.substring(end));
                          setTimeout(() => {
                            e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
                          }, 0);
                        }
                      }}
                      rows={14}
                      spellCheck={false}
                      className="w-full bg-[#0B0F19] text-cyan-300 font-mono text-xs p-4 leading-relaxed focus:outline-none resize-y border-none"
                      placeholder="Write your JavaScript function here..."
                    />
                  </div>

                  {/* Terminal / Test Execution Results */}
                  {runResults && (
                    <div className="border-t border-[#334155]/80 bg-slate-950 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Terminal className="w-4 h-4 text-cyan-400" />
                          <span className="text-xs font-bold text-white font-mono">
                            Test Suite Execution ({runResults.executionTimeMs}ms)
                          </span>
                        </div>
                        <span
                          className={`text-xs font-bold font-mono px-2.5 py-0.5 rounded-full ${
                            runResults.allPassed
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          }`}
                        >
                          {runResults.allPassed
                            ? "ALL TESTS PASSED! 🎉"
                            : `${runResults.testsPassed} / ${runResults.testsTotal} Passed`}
                        </span>
                      </div>

                      {runResults.generalError && (
                        <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-mono">
                          {runResults.generalError}
                        </div>
                      )}

                      {/* Test Cases Output List */}
                      <div className="space-y-2">
                        {runResults.results.map((r, i) => (
                          <div
                            key={r.testId}
                            className={`p-3 rounded-xl border text-xs font-mono space-y-1 ${
                              r.passed
                                ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
                                : "bg-rose-950/20 border-rose-500/30 text-rose-200"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold flex items-center gap-1.5">
                                {r.passed ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                                )}
                                <span>Test Case #{i + 1} {r.description ? `• ${r.description}` : ""}</span>
                              </span>
                              <span className="text-[10px] uppercase font-bold">
                                {r.passed ? "Passed" : "Failed"}
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-300 space-y-0.5 pt-1">
                              <div><span className="text-slate-500">Input:</span> {r.input}</div>
                              <div><span className="text-slate-500">Expected:</span> <code className="text-emerald-300">{r.expected}</code></div>
                              <div><span className="text-slate-500">Received:</span> <code className={r.passed ? "text-emerald-300" : "text-rose-300 font-bold"}>{r.actual || r.error || "undefined"}</code></div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Console logs */}
                      {runResults.logs.length > 0 && (
                        <div className="pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400">
                          <span className="text-slate-500 uppercase text-[10px] block mb-1">Standard Console Output:</span>
                          {runResults.logs.map((log, idx) => (
                            <div key={idx} className="truncate">{log}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-slate-500 bg-[#1E293B]/40 rounded-2xl border border-slate-800">
                Select a weekly challenge to start coding.
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: ARENA LEADERBOARD */}
      {activeTab === "leaderboard" && (
        <div className="rounded-2xl border border-[#334155]/70 bg-[#1E293B]/75 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="p-5 border-b border-[#334155]/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Campus Algorithm Arena Leaderboard</h3>
                <p className="text-xs text-slate-400">Ranked by weekly challenge points earned and algorithms solved</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#334155]/80 bg-[#0B0F19]/80 text-[#94A3B8] font-mono">
                  <th className="py-3.5 px-4 w-16 text-center">Rank</th>
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4 text-center">Puzzles Solved</th>
                  <th className="py-3.5 px-4 text-right">Coding Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]/60 text-slate-300">
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-500">
                      No challenge submissions recorded yet. Be the first to solve!
                    </td>
                  </tr>
                ) : (
                  leaderboard.map((item, index) => {
                    const isCurrentStudent = currentUser?.uid === item.uid;
                    return (
                      <tr
                        key={item.uid}
                        className={`hover:bg-[#0B0F19]/40 transition-colors ${
                          isCurrentStudent ? "bg-amber-500/10 font-bold" : ""
                        }`}
                      >
                        <td className="py-3.5 px-4 text-center font-mono font-extrabold text-sm">
                          {index === 0 ? (
                            <span className="text-amber-400">🥇 1</span>
                          ) : index === 1 ? (
                            <span className="text-slate-300">🥈 2</span>
                          ) : index === 2 ? (
                            <span className="text-amber-600">🥉 3</span>
                          ) : (
                            <span className="text-slate-500">{index + 1}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-bold">{item.name}</span>
                            <span className="text-slate-400 text-[11px]">@{item.username}</span>
                            {isCurrentStudent && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                You
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-white">
                          {item.solvedCount}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-extrabold text-amber-400 text-sm">
                          +{item.points} XP
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CELEBRATION MODAL ON SUCCESS */}
      {showCelebration && selectedChallenge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl shadow-amber-950/60 text-center space-y-5 relative overflow-hidden">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 mx-auto flex items-center justify-center text-amber-400 text-3xl animate-bounce">
              🏆
            </div>

            <div>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-2">
                Challenge Solved!
              </span>
              <h3 className="text-xl font-extrabold text-white">
                {selectedChallenge.title}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                All test cases passed. You earned <strong className="text-amber-400 font-mono font-bold">+{selectedChallenge.points} XP Points</strong>!
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowCelebration(false)}
              className="w-full py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 shadow-lg shadow-amber-950/50 transition-all"
            >
              Claim XP & Keep Coding!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
