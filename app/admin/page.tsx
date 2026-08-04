"use client";

import React, { useEffect, useState } from "react";
import { Syllabus } from "@/types/syllabus";
import { getAllSyllabi, deleteSyllabus } from "@/lib/db";
import { 
  ShieldCheck, 
  Plus, 
  BookOpen, 
  Trash2, 
  Edit3, 
  Eye, 
  Sparkles, 
  ArrowLeft,
  CheckCircle2,
  Clock
} from "lucide-react";
import Link from "next/link";

export default function AdminDashboardPage() {
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await getAllSyllabi();
      setSyllabi(data);
      setLoading(false);
    }
    load();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this syllabus?")) {
      await deleteSyllabus(id);
      setSyllabi(syllabi.filter(s => s.id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#CBD5E1]">
      {/* Admin Top Header */}
      <header className="sticky top-0 z-30 border-b border-[#334155] bg-[#0B0F19]/90 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="text-[#94A3B8] hover:text-white transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <span className="text-[#334155]">/</span>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="h-5 w-5 text-[#06B6D4]" />
              <h1 className="text-lg font-extrabold text-white tracking-tight">
                Teacher Admin Portal
              </h1>
            </div>
          </div>

          <Link
            href="/admin/builder"
            className="inline-flex items-center space-x-2 rounded-xl bg-[#06B6D4] px-4 py-2 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-lg"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Syllabus</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#334155] pb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Course Syllabi Management</h2>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Manage published student syllabi or parse new course documents with Gemini 2.5 Pro.
            </p>
          </div>

          <div className="flex items-center space-x-3 text-xs font-mono">
            <span className="rounded-lg bg-[#10B981]/15 px-3 py-1 text-[#10B981] border border-[#10B981]/30">
              Published: {syllabi.filter(s => s.status === 'published').length}
            </span>
            <span className="rounded-lg bg-[#F59E0B]/15 px-3 py-1 text-[#F59E0B] border border-[#F59E0B]/30">
              Drafts: {syllabi.filter(s => s.status === 'draft').length}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-[#94A3B8]">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#06B6D4] border-t-transparent mb-3" />
            Loading Admin Dashboard...
          </div>
        ) : syllabi.length === 0 ? (
          <div className="py-16 text-center text-[#94A3B8] bg-[#1E293B]/40 rounded-2xl border border-[#334155] my-6">
            <p className="mb-4">No syllabi created yet.</p>
            <Link
              href="/admin/builder"
              className="inline-flex items-center space-x-2 rounded-xl bg-[#06B6D4] px-4 py-2 text-xs font-bold text-slate-950"
            >
              <Plus className="h-4 w-4" />
              <span>Create First Syllabus</span>
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {syllabi.map((syllabus) => (
              <div
                key={syllabus.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl border border-[#334155] bg-[#1E293B] p-5 shadow-lg gap-4"
              >
                <div className="flex items-start space-x-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B0F19] text-xs font-bold font-mono text-[#06B6D4] border border-[#334155]">
                    {syllabus.courseCode.slice(0, 4)}
                  </span>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-bold text-white leading-snug">
                        {syllabus.title}
                      </h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold uppercase ${
                        syllabus.status === 'published'
                          ? 'bg-[#10B981]/15 text-[#10B981]'
                          : 'bg-[#F59E0B]/15 text-[#F59E0B]'
                      }`}>
                        {syllabus.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#94A3B8] line-clamp-1">
                      {syllabus.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <Link
                    href={`/syllabus/${syllabus.id}`}
                    className="inline-flex items-center space-x-1 rounded-xl bg-[#0B0F19] px-3 py-2 text-xs font-semibold text-[#CBD5E1] hover:text-white border border-[#334155]"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>View</span>
                  </Link>

                  <Link
                    href={`/admin/builder?id=${syllabus.id}`}
                    className="inline-flex items-center space-x-1 rounded-xl bg-[#06B6D4]/10 px-3 py-2 text-xs font-semibold text-[#06B6D4] hover:bg-[#06B6D4]/20 border border-[#06B6D4]/30"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </Link>

                  <button
                    onClick={() => handleDelete(syllabus.id)}
                    className="rounded-xl bg-rose-500/10 p-2 text-rose-400 hover:bg-rose-500/20 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
