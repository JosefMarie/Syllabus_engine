"use client";

import React, { useEffect, useState, Suspense } from "react";
import { Syllabus } from "@/types/syllabus";
import { getSyllabusById } from "@/lib/db";
import { getAdminSession, getStoredSession, subscribeToAdminSessionRevocation } from "@/lib/auth";
import { UserProfile } from "@/types/auth";
import SyllabusBuilder from "@/components/admin/SyllabusBuilder";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Lock, AlertTriangle } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";

function BuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [studentSession, setStudentSession] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsub = subscribeToAdminSessionRevocation(() => {
      setIsAuthorized(false);
      router.push("/admin/login");
    });

    const admin = getAdminSession();
    const student = getStoredSession();

    if (!admin || admin.role !== "teacher") {
      setIsAuthorized(false);
      setStudentSession(student);
      setLoading(false);
      return;
    }

    setIsAuthorized(true);

    if (id) {
      async function load() {
        const found = await getSyllabusById(id!);
        if (found) setSyllabus(found);
        setLoading(false);
      }
      load();
    } else {
      setLoading(false);
    }

    return () => {
      unsub();
    };
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#0B0F19] text-[#CBD5E1]">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#06B6D4] border-t-transparent mb-3" />
          <p className="text-xs font-mono text-[#94A3B8]">Verifying Instructor Permissions...</p>
        </div>
      </div>
    );
  }

  // Access Denied / Student Guard
  if (isAuthorized === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0F19] p-4 text-[#CBD5E1]">
        <div className="w-full max-w-md rounded-2xl border border-[#334155] bg-[#1E293B] p-8 text-center shadow-2xl space-y-6 animate-in fade-in zoom-in duration-200">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Lock className="h-8 w-8" />
          </div>

          <div>
            <div className="inline-flex items-center space-x-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-mono font-bold text-amber-400 border border-amber-500/30 mb-3">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Teacher Access Restricted</span>
            </div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              Teacher Portal Only
            </h2>
            <p className="mt-2 text-xs text-[#94A3B8] leading-relaxed">
              {studentSession
                ? `You are signed in as student "${studentSession.fullName}". The syllabus structure editor is strictly reserved for course instructors.`
                : "This syllabus creation and editing portal is reserved for authorized instructors and teachers."}
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center space-x-2 rounded-xl bg-[#06B6D4] py-3 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-lg"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Course Catalog</span>
            </Link>

            {!studentSession && (
              <Link
                href="/admin/login"
                className="inline-flex w-full items-center justify-center space-x-2 rounded-xl border border-[#334155] bg-[#0B0F19] py-3 text-xs font-semibold text-white hover:border-[#06B6D4] transition-all"
              >
                <ShieldCheck className="h-4 w-4 text-[#06B6D4]" />
                <span>Teacher Admin Login</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[#334155] bg-[#0B0F19]/90 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link
              href="/admin"
              className="inline-flex items-center space-x-1.5 text-xs text-[#94A3B8] hover:text-white transition-colors bg-[#1E293B] px-3 py-1.5 rounded-lg border border-[#334155]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Dashboard</span>
            </Link>
            <Link
              href="/"
              className="inline-flex items-center space-x-1.5 text-xs text-[#94A3B8] hover:text-white transition-colors bg-[#1E293B] px-3 py-1.5 rounded-lg border border-[#334155]"
            >
              <span>Catalog</span>
            </Link>
            <span className="text-[#334155]">/</span>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="h-5 w-5 text-[#06B6D4]" />
              <span className="text-sm font-bold text-white font-mono">
                {id ? `Editing Syllabus #${id}` : "Create Syllabus Hub"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="pb-16">
        <SyllabusBuilder initialSyllabus={syllabus} />
      </main>
    </>
  );
}

export default function BuilderPage() {
  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#CBD5E1]">
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center bg-[#0B0F19] text-[#CBD5E1]">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#06B6D4] border-t-transparent mb-3" />
              <p className="text-xs font-mono text-[#94A3B8]">Initializing Builder...</p>
            </div>
          </div>
        }
      >
        <BuilderContent />
      </Suspense>
    </div>
  );
}
