"use client";

import React, { useEffect, useState, Suspense } from "react";
import { Syllabus } from "@/types/syllabus";
import { getSyllabusById } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import SyllabusBuilder from "@/components/admin/SyllabusBuilder";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";

function BuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const admin = getAdminSession();
    if (!admin) {
      router.push("/admin/login");
      return;
    }

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
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex py-20 items-center justify-center bg-[#0B0F19] text-[#CBD5E1]">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#06B6D4] border-t-transparent mb-3" />
          <p className="text-xs font-mono text-[#94A3B8]">Loading Syllabus Builder...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[#334155] bg-[#0B0F19]/90 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/admin" className="text-[#94A3B8] hover:text-white transition-colors">
              <ArrowLeft className="h-5 w-5" />
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
      <Suspense fallback={
        <div className="flex h-screen items-center justify-center bg-[#0B0F19] text-[#CBD5E1]">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#06B6D4] border-t-transparent mb-3" />
            <p className="text-xs font-mono text-[#94A3B8]">Initializing Builder Suspense Boundary...</p>
          </div>
        </div>
      }>
        <BuilderContent />
      </Suspense>
    </div>
  );
}
