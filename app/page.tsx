"use client";

import React, { useEffect, useState } from "react";
import { Syllabus } from "@/types/syllabus";
import { getAllSyllabi } from "@/lib/db";
import { 
  BookOpen, 
  Sparkles, 
  Search, 
  ArrowRight, 
  ShieldCheck, 
  Clock, 
  Building2, 
  User, 
  Terminal,
  Plus
} from "lucide-react";
import Link from "next/link";

export default function CatalogPage() {
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const data = await getAllSyllabi();
      setSyllabi(data);
      setLoading(false);
    }
    loadData();
  }, []);

  const filtered = syllabi.filter((s) => 
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.courseCode.toLowerCase().includes(search.toLowerCase()) ||
    s.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#CBD5E1]">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-30 border-b border-[#334155] bg-[#0B0F19]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-[#06B6D4] to-[#10B981] text-slate-950 shadow-lg shadow-[#06B6D4]/20">
              <BookOpen className="h-6 w-6 stroke-[2.5]" />
            </span>
            <div>
              <span className="text-xs font-bold font-mono text-[#06B6D4] uppercase tracking-wider">
                Digital Syllabus Platform
              </span>
              <h1 className="text-lg font-extrabold text-white tracking-tight leading-tight">
                Syllabus Engine
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/admin"
              className="inline-flex items-center space-x-2 rounded-xl border border-[#334155] bg-[#1E293B] px-4 py-2 text-xs font-semibold text-white hover:border-[#06B6D4] hover:bg-[#334155] transition-all"
            >
              <ShieldCheck className="h-4 w-4 text-[#06B6D4]" />
              <span>Teacher Admin Portal</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center space-x-2 rounded-full border border-[#06B6D4]/30 bg-[#06B6D4]/10 px-3 py-1 text-xs font-mono text-[#06B6D4] mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Next.js 15 & Gemini 2.5 Pro Powered</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Interactive Digital Syllabi for Modern Software & Design
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#94A3B8]">
            Explore 5-level structured course trees, live executable code playgrounds, contextual citations, and progress tracking.
          </p>

          {/* Search Bar */}
          <div className="relative mt-8 max-w-xl mx-auto">
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search course code, title, or keywords (e.g. CS101, React, AI)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-[#334155] bg-[#1E293B] py-3 pl-12 pr-4 text-sm text-white placeholder-[#94A3B8] shadow-xl focus:border-[#06B6D4] focus:outline-none"
            />
          </div>
        </div>

        {/* Syllabus Catalog Grid */}
        <div className="mt-14">
          <div className="flex items-center justify-between border-b border-[#334155] pb-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Terminal className="h-5 w-5 text-[#06B6D4]" />
              <span>Available Syllabi ({filtered.length})</span>
            </h3>
            <Link
              href="/admin/builder"
              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[#06B6D4] hover:underline"
            >
              <Plus className="h-4 w-4" />
              <span>Create New Syllabus</span>
            </Link>
          </div>

          {loading ? (
            <div className="py-20 text-center text-[#94A3B8]">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#06B6D4] border-t-transparent mb-3" />
              Loading Syllabi Catalogue...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-[#94A3B8] bg-[#1E293B]/40 rounded-2xl border border-[#334155] my-6">
              <p>No syllabi match your search query.</p>
            </div>
          ) : (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((syllabus) => {
                const loCount = syllabus.learningOutcomes.length;
                let subtopicCount = 0;
                syllabus.learningOutcomes.forEach((lo) => {
                  lo.indicativeContents.forEach((ic) => {
                    ic.topics.forEach((top) => {
                      subtopicCount += top.subtopics.length;
                    });
                  });
                });

                return (
                  <div
                    key={syllabus.id}
                    className="group relative flex flex-col justify-between rounded-2xl border border-[#334155] bg-[#1E293B] p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-[#06B6D4] hover:shadow-[#06B6D4]/10"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="rounded-lg bg-[#06B6D4]/10 px-3 py-1 font-mono text-xs font-bold text-[#06B6D4] border border-[#06B6D4]/20">
                          {syllabus.courseCode}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase ${
                          syllabus.status === 'published'
                            ? 'bg-[#10B981]/15 text-[#10B981]'
                            : 'bg-[#F59E0B]/15 text-[#F59E0B]'
                        }`}>
                          {syllabus.status}
                        </span>
                      </div>

                      <h4 className="mt-4 text-xl font-bold text-white group-hover:text-[#06B6D4] transition-colors leading-snug">
                        {syllabus.title}
                      </h4>

                      <p className="mt-2 text-xs text-[#94A3B8] line-clamp-3 leading-relaxed">
                        {syllabus.description}
                      </p>

                      <div className="mt-6 space-y-2 border-t border-[#334155]/60 pt-4 text-xs font-mono text-[#CBD5E1]">
                        {syllabus.department && (
                          <div className="flex items-center space-x-2 text-[#94A3B8]">
                            <Building2 className="h-3.5 w-3.5 text-[#06B6D4]" />
                            <span className="truncate">{syllabus.department}</span>
                          </div>
                        )}
                        {syllabus.instructor && (
                          <div className="flex items-center space-x-2 text-[#94A3B8]">
                            <User className="h-3.5 w-3.5 text-[#10B981]" />
                            <span>{syllabus.instructor}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-[#334155] flex items-center justify-between">
                      <div className="text-[11px] font-mono text-[#94A3B8]">
                        <span>{loCount} LOs</span> • <span>{subtopicCount} Subtopics</span>
                      </div>

                      <Link
                        href={`/syllabus/${syllabus.id}`}
                        className="inline-flex items-center space-x-1.5 rounded-xl bg-[#06B6D4] px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-md"
                      >
                        <span>Launch Viewer</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
