"use client";

import React, { useState, useEffect } from "react";
import { CodingChallenge, ChallengeSubmission, ChallengeDifficulty, ChallengeTestCase } from "@/types/challenge";
import { UserProfile } from "@/types/auth";
import { 
  getChallenges, 
  saveChallenge, 
  deleteChallenge, 
  toggleChallengeActive, 
  subscribeToChallenges,
  getChallengeSubmissions,
  subscribeToChallengeSubmissions
} from "@/lib/db";
import { 
  Code2, 
  Plus, 
  Trash2, 
  Edit3, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Trophy, 
  Flame, 
  Sparkles, 
  Eye, 
  EyeOff, 
  Send, 
  Users, 
  X, 
  Check, 
  Search,
  Filter
} from "lucide-react";

interface ChallengeStudioProps {
  adminUser?: UserProfile | null;
}

export default function ChallengeStudio({ adminUser }: ChallengeStudioProps) {
  const [challenges, setChallenges] = useState<CodingChallenge[]>([]);
  const [submissions, setSubmissions] = useState<ChallengeSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");

  // Modal Composer State
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingChallengeId, setEditingChallengeId] = useState<string | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDifficulty, setFormDifficulty] = useState<ChallengeDifficulty>("easy");
  const [formPoints, setFormPoints] = useState<number>(50);
  const [formWeekNumber, setFormWeekNumber] = useState<number>(1);
  const [formFunctionName, setFormFunctionName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStarterCode, setFormStarterCode] = useState("");
  const [formTestCases, setFormTestCases] = useState<ChallengeTestCase[]>([
    { id: "tc-1", input: "[]", expectedOutput: "true", description: "Default case" }
  ]);

  useEffect(() => {
    const unsubC = subscribeToChallenges((list) => {
      setChallenges(list || []);
      setLoading(false);
    });
    const unsubS = subscribeToChallengeSubmissions((subs) => {
      setSubmissions(subs || []);
    });

    return () => {
      unsubC();
      unsubS();
    };
  }, []);

  const openComposer = (existing?: CodingChallenge) => {
    if (existing) {
      setEditingChallengeId(existing.id);
      setFormTitle(existing.title);
      setFormSlug(existing.slug);
      setFormDifficulty(existing.difficulty);
      setFormPoints(existing.points);
      setFormWeekNumber(existing.weekNumber || 1);
      setFormFunctionName(existing.functionName);
      setFormDescription(existing.descriptionMarkdown);
      setFormStarterCode(existing.starterCode);
      setFormTestCases(existing.testCases || []);
    } else {
      setEditingChallengeId(null);
      setFormTitle("");
      setFormSlug("");
      setFormDifficulty("easy");
      setFormPoints(50);
      setFormWeekNumber(1);
      setFormFunctionName("solve");
      setFormDescription("### Challenge Description\nExplain the problem, inputs, and outputs here.");
      setFormStarterCode("function solve(input) {\n  // Write solution\n  return true;\n}");
      setFormTestCases([
        { id: "tc-1", input: "[1, 2]", expectedOutput: "3", description: "Basic addition case" }
      ]);
    }
    setIsComposerOpen(true);
  };

  const handleSaveChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formFunctionName.trim()) return;

    const challenge: CodingChallenge = {
      id: editingChallengeId || `ch_${Date.now()}`,
      title: formTitle.trim(),
      slug: formSlug.trim() || formTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      difficulty: formDifficulty,
      language: "javascript",
      tradeId: "all",
      level: "all",
      descriptionMarkdown: formDescription,
      functionName: formFunctionName.trim(),
      starterCode: formStarterCode,
      testCases: formTestCases,
      points: Number(formPoints) || 50,
      weekNumber: Number(formWeekNumber) || 1,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdByName: adminUser?.fullName || "Admin"
    };

    await saveChallenge(challenge);
    setIsComposerOpen(false);
  };

  const handleAddTestCase = () => {
    setFormTestCases([
      ...formTestCases,
      {
        id: `tc_${Date.now()}`,
        input: '""',
        expectedOutput: '""',
        description: `Test Case #${formTestCases.length + 1}`
      }
    ]);
  };

  const handleRemoveTestCase = (index: number) => {
    setFormTestCases(formTestCases.filter((_, i) => i !== index));
  };

  const handleUpdateTestCase = (index: number, field: keyof ChallengeTestCase, val: any) => {
    const updated = [...formTestCases];
    updated[index] = { ...updated[index], [field]: val };
    setFormTestCases(updated);
  };

  const filteredChallenges = challenges.filter((c) => {
    if (difficultyFilter !== "all" && c.difficulty !== difficultyFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return c.title.toLowerCase().includes(q) || c.functionName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
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
                  Weekly Coding Challenges Studio
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  ⚡ Algorithm Arena
                </span>
              </div>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Publish weekly coding puzzles with automated unit tests for students to solve in-browser.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => openComposer()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 shadow-lg shadow-amber-950/40 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create Challenge</span>
            </button>
          </div>
        </div>

        {/* Stat Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5">
          <div className="rounded-xl bg-[#0B0F19]/60 border border-[#334155]/60 p-4">
            <span className="text-xs text-slate-400 block mb-1">Active Challenges</span>
            <span className="text-2xl font-bold font-mono text-white">
              {challenges.filter((c) => c.active !== false).length}
            </span>
          </div>

          <div className="rounded-xl bg-[#0B0F19]/60 border border-[#334155]/60 p-4">
            <span className="text-xs text-slate-400 block mb-1">Student Submissions</span>
            <span className="text-2xl font-bold font-mono text-cyan-300">
              {submissions.length}
            </span>
          </div>

          <div className="rounded-xl bg-[#0B0F19]/60 border border-[#334155]/60 p-4">
            <span className="text-xs text-slate-400 block mb-1">Successful Solves</span>
            <span className="text-2xl font-bold font-mono text-emerald-400">
              {submissions.filter((s) => s.passed).length}
            </span>
          </div>

          <div className="rounded-xl bg-[#0B0F19]/60 border border-[#334155]/60 p-4">
            <span className="text-xs text-slate-400 block mb-1">Total XP Awarded</span>
            <span className="text-2xl font-bold font-mono text-amber-400">
              {submissions.filter((s) => s.passed).reduce((sum, s) => sum + s.awardedPoints, 0)} XP
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Challenge List */}
      <div className="rounded-2xl border border-[#334155]/70 bg-[#1E293B]/75 backdrop-blur-xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Search challenges by title or function name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[#334155]/80 bg-[#0B0F19]/70 py-2.5 pl-10 pr-4 text-xs text-white placeholder-[#64748B] focus:border-amber-400 focus:outline-none"
          />
        </div>

        <select
          value={difficultyFilter}
          onChange={(e) => setDifficultyFilter(e.target.value)}
          className="rounded-xl border border-[#334155]/80 bg-[#0B0F19]/70 py-2 px-3 text-xs text-white focus:outline-none shrink-0"
        >
          <option value="all">All Difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>

      {/* Challenge Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredChallenges.map((ch) => (
          <div
            key={ch.id}
            className="rounded-2xl border border-[#334155]/70 bg-[#1E293B]/75 backdrop-blur-xl p-5 shadow-xl flex flex-col justify-between space-y-4 hover:border-amber-500/40 transition-all"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    Week {ch.weekNumber || 1}
                  </span>
                  <span
                    className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                      ch.difficulty === "easy"
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : ch.difficulty === "medium"
                        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                        : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                    }`}
                  >
                    {ch.difficulty}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleChallengeActive(ch.id, !ch.active)}
                    title={ch.active ? "Pause challenge" : "Activate challenge"}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    {ch.active ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4 text-slate-500" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => openComposer(ch)}
                    title="Edit challenge"
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <Edit3 className="w-4 h-4 text-cyan-400" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete challenge "${ch.title}"?`)) {
                        deleteChallenge(ch.id);
                      }
                    }}
                    title="Delete challenge"
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                  >
                    <Trash2 className="w-4 h-4 text-rose-400" />
                  </button>
                </div>
              </div>

              <h4 className="text-base font-bold text-white leading-snug">
                {ch.title}
              </h4>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                Function: <code className="text-cyan-400 font-mono font-bold">{ch.functionName}(...)</code>
              </p>
            </div>

            <div className="pt-3 border-t border-[#334155]/60 flex items-center justify-between text-xs font-mono">
              <span className="text-amber-400 font-bold">+{ch.points} XP Points</span>
              <span className="text-slate-500">{ch.testCases?.length || 0} Test Cases</span>
            </div>
          </div>
        ))}
      </div>

      {/* COMPOSER / EDIT MODAL */}
      {isComposerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-left">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingChallengeId ? "Edit Coding Challenge" : "Author New Weekly Challenge"}
                  </h3>
                  <p className="text-xs text-slate-400">Configure function prototype, starter code, and test cases</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsComposerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveChallenge} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Challenge Title *</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Reverse Linked List"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Function Name *</label>
                  <input
                    type="text"
                    required
                    value={formFunctionName}
                    onChange={(e) => setFormFunctionName(e.target.value)}
                    placeholder="e.g. reverseList"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-cyan-300 font-mono focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Difficulty</label>
                  <select
                    value={formDifficulty}
                    onChange={(e) => setFormDifficulty(e.target.value as ChallengeDifficulty)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:outline-none"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Points (XP)</label>
                  <input
                    type="number"
                    min={10}
                    value={formPoints}
                    onChange={(e) => setFormPoints(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-amber-400 font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Week Number</label>
                  <input
                    type="number"
                    min={1}
                    value={formWeekNumber}
                    onChange={(e) => setFormWeekNumber(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Problem Description (Markdown)</label>
                <textarea
                  rows={4}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-slate-200 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Starter Code Template</label>
                <textarea
                  rows={4}
                  value={formStarterCode}
                  onChange={(e) => setFormStarterCode(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-cyan-300 font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>

              {/* Test Cases Builder */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                    Automated Test Cases ({formTestCases.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddTestCase}
                    className="text-amber-400 hover:text-amber-300 text-xs font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Test Case</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {formTestCases.map((tc, idx) => (
                    <div
                      key={tc.id || idx}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono font-bold text-slate-400">
                          Case #{idx + 1}
                        </span>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={tc.isHidden || false}
                              onChange={(e) => handleUpdateTestCase(idx, "isHidden", e.target.checked)}
                              className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0"
                            />
                            <span>Hidden validation test</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRemoveTestCase(idx)}
                            className="text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-500 block mb-0.5">Input Argument(s) (JSON)</span>
                          <input
                            type="text"
                            value={tc.input}
                            onChange={(e) => handleUpdateTestCase(idx, "input", e.target.value)}
                            placeholder='e.g. "[2, 7, 11, 15], 9"'
                            className="w-full rounded-lg border border-slate-800 bg-slate-900 p-2 text-cyan-300 font-mono text-xs focus:outline-none"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block mb-0.5">Expected Output (JSON)</span>
                          <input
                            type="text"
                            value={tc.expectedOutput}
                            onChange={(e) => handleUpdateTestCase(idx, "expectedOutput", e.target.value)}
                            placeholder='e.g. "[0, 1]" or "true"'
                            className="w-full rounded-lg border border-slate-800 bg-slate-900 p-2 text-emerald-300 font-mono text-xs focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsComposerOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 shadow-md transition-all"
                >
                  {editingChallengeId ? "Save Changes" : "Publish Challenge"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
