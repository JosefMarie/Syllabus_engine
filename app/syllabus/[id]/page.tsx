import React from "react";
import StudentViewerClient from "@/components/viewer/StudentViewerClient";

export async function generateStaticParams() {
  return [
    { id: "cs100-fundamentals" },
    { id: "cs101-fullstack-ai" },
    { id: "cs102-advanced-ai" }
  ];
}

export default async function StudentViewerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  return <StudentViewerClient syllabusId={resolvedParams.id} />;
}
