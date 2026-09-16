"use client";

import React, { Suspense } from "react";
import StudentViewerClient from "@/components/viewer/StudentViewerClient";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import { useSearchParams } from "next/navigation";

function SyllabusViewerInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  if (!id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0F19] text-[#94A3B8] font-mono text-sm p-4 text-center">
        No syllabus ID provided in URL. Please access this page through a valid syllabus link.
      </div>
    );
  }

  return (
    <ErrorBoundary fallbackTitle="Error Loading Syllabus Viewer">
      <StudentViewerClient syllabusId={id} />
    </ErrorBoundary>
  );
}

export default function SyllabusViewPage() {
  return (
    <ErrorBoundary fallbackTitle="Application Error">
      <Suspense fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0B0F19]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#06B6D4] border-t-transparent"></div>
        </div>
      }>
        <SyllabusViewerInner />
      </Suspense>
    </ErrorBoundary>
  );
}
