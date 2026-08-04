"use server";

import { parseSyllabusWithGemini } from "@/lib/gemini";
import { SyllabusExtractionResult } from "@/types/syllabus";

export async function extractSyllabusAction(rawText: string): Promise<SyllabusExtractionResult> {
  if (!rawText || rawText.trim().length === 0) {
    throw new Error("Syllabus input text cannot be empty.");
  }
  return await parseSyllabusWithGemini(rawText);
}
