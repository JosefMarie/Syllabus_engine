"use client";

import React, { useEffect, useState } from "react";
import { Syllabus } from "@/types/syllabus";
import { UserProfile } from "@/types/auth";
import { getAllSyllabi, deleteSyllabus } from "@/lib/db";
import { getAdminSession, logoutAdmin } from "@/lib/auth";
import TradesManager from "@/components/admin/TradesManager";
import StudentApprovals from "@/components/admin/StudentApprovals";
import ActivityLogger from "@/components/admin/ActivityLogger";
import { useRouter } from "next/navigation";
import { 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Edit3, 
  Eye, 
  ArrowLeft,
  Briefcase,
  UserCheck,
  BookOpen,
  LogOut,
  Activity
} from "lucide-react";
import Link from "next/link";

export default function AdminDashboardPage() {
  const router = useRouter();

  const [adminUser, setAdminUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'syllabi' | 'trades' | 'students' | 'activity'>('syllabi');
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const currentAdmin = getAdminSession();
      if (!currentAdmin) {
        router.push("/admin/login");
        return;
      }
      setAdminUser(currentAdmin);

      const data = await getAllSyllabi();
      setSyllabi(data);
      setLoading(false);
    }
    init();
  }, [router]);

  const handleLogout = async () => {
    await logoutAdmin();
    router.push("/admin/login");
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this syllabus?")) {
      await deleteSyllabus(id);
      setSyllabi(syllabi.filter(s => s.id !== id));
    }
  };

  if (!adminUser && loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0B0F19] text-[#CBD5E1]">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#06B6D4] border-t-transparent mb-3" />
          <p className="text-xs font-mono text-[#94A3B8]">Authenticating Admin Session...</p>
        </div>
      </div>
    );
  }

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

          <div className="flex items-center space-x-3">
            <span className="hidden sm:inline text-xs font-mono text-[#94A3B8]">
              Logged in: <strong className="text-white">{adminUser?.email}</strong>
            </span>

            <Link
              href="/admin/builder"
              className="inline-flex items-center space-x-1.5 rounded-xl bg-[#06B6D4] px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-lg"
            >
              <Plus className="h-4 w-4" />
              <span>New Syllabus</span>
            </Link>

            <button
              onClick={handleLogout}
              className="inline-flex items-center space-x-1.5 rounded-xl border border-[#334155] bg-[#1E293B] px-3.5 py-2 text-xs font-semibold text-[#CBD5E1] hover:text-white hover:border-rose-500/50 transition-all"
            >
              <LogOut className="h-3.5 w-3.5 text-rose-400" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8 flex flex-wrap gap-2 sm:gap-4 border-b border-[#334155]">
          <button
            onClick={() => setActiveTab('syllabi')}
            className={`flex items-center space-x-2 border-b-2 pb-3 text-sm font-bold transition-all ${
              activeTab === 'syllabi'
                ? 'border-[#06B6D4] text-[#06B6D4]'
                : 'border-transparent text-[#94A3B8] hover:text-white'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span>Course Syllabi ({syllabi.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('trades')}
            className={`flex items-center space-x-2 border-b-2 pb-3 text-sm font-bold transition-all ${
              activeTab === 'trades'
                ? 'border-[#06B6D4] text-[#06B6D4]'
                : 'border-transparent text-[#94A3B8] hover:text-white'
            }`}
          >
            <Briefcase className="h-4 w-4" />
            <span>Academic Trades</span>
          </button>

          <button
            onClick={() => setActiveTab('students')}
            className={`flex items-center space-x-2 border-b-2 pb-3 text-sm font-bold transition-all ${
              activeTab === 'students'
                ? 'border-[#06B6D4] text-[#06B6D4]'
                : 'border-transparent text-[#94A3B8] hover:text-white'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            <span>Student Approvals</span>
          </button>

          <button
            onClick={() => setActiveTab('activity')}
            className={`flex items-center space-x-2 border-b-2 pb-3 text-sm font-bold transition-all ${
              activeTab === 'activity'
                ? 'border-[#06B6D4] text-[#06B6D4]'
                : 'border-transparent text-[#94A3B8] hover:text-white'
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>Activity Logs & Audit</span>
          </button>
        </div>

        {/* TAB 1: SYLLABI MANAGEMENT */}
        {activeTab === 'syllabi' && (
          <div>
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
                          {syllabus.level && (
                            <span className="rounded bg-[#06B6D4]/10 px-2 py-0.5 font-mono text-[10px] text-[#06B6D4] border border-[#06B6D4]/20">
                              {syllabus.level}
                            </span>
                          )}
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
          </div>
        )}

        {/* TAB 2: ACADEMIC TRADES MANAGER */}
        {activeTab === 'trades' && <TradesManager />}

        {/* TAB 3: STUDENT REGISTRATION APPROVALS */}
        {activeTab === 'students' && <StudentApprovals />}

        {/* TAB 4: ACTIVITY LOGS & AUDIT */}
        {activeTab === 'activity' && <ActivityLogger />}
      </main>
    </div>
  );
}
