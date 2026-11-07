import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Assignment, AssignmentSubmission } from "@/types/assignment";

export interface AiGradingResult {
  suggestedScore: number;
  maxScore: number;
  letterGrade: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  feedbackDraft: string;
  evaluatedAt: string;
}

export interface ExtractedArchiveEntry {
  path: string;
  content: string;
  size: number;
}

/**
 * Strictly supported file extensions for student assignment uploads.
 * Excludes opaque archives (.zip, .rar, .7z, .exe) so every submission is directly readable
 * in the In-App Previewer and evaluable by the AI Auto-Grader.
 */
export const ALLOWED_SUBMISSION_EXTENSIONS = [
  // Documents & Markdown
  "pdf", "docx", "md", "txt",
  // Structured Data & Configs
  "json", "csv", "xml", "yaml", "yml",
  // Source Code
  "js", "jsx", "ts", "tsx", "dart", "py", "java", "c", "cpp", "h", "hpp",
  "cs", "html", "htm", "css", "scss", "sql", "sh", "bash", "php", "rb", "go", "rs",
  // Diagrams & Screenshots
  "png", "jpg", "jpeg", "webp", "svg"
];

export const ACCEPT_FILE_ATTRIBUTE = ALLOWED_SUBMISSION_EXTENSIONS.map(ext => `.${ext}`).join(",");

export function isAllowedSubmissionFile(fileName: string): { allowed: boolean; ext: string; reason?: string } {
  const ext = (fileName.toLowerCase().split(".").pop() || "").trim();
  if (!ext) {
    return { allowed: false, ext: "", reason: "File must have a valid extension (e.g. .pdf, .docx, .md, .json, .js, .dart)." };
  }
  if (["zip", "rar", "7z", "tar", "gz", "tgz"].includes(ext)) {
    return {
      allowed: false,
      ext,
      reason: `Archive files (.${ext}) are not accepted. Please upload your document or code directly as .pdf, .docx, .md, .txt, .json, or source code files (.js, .jsx, .ts, .tsx, .dart, .py, .html, .css, .sql).`
    };
  }
  if (ext === "doc") {
    return {
      allowed: false,
      ext,
      reason: "Legacy Word 97 (.doc) format is not supported. Please save your document as .docx or .pdf before uploading."
    };
  }
  if (!ALLOWED_SUBMISSION_EXTENSIONS.includes(ext)) {
    return {
      allowed: false,
      ext,
      reason: `Unsupported file format (.${ext}). Allowed formats: PDF, DOCX, MD, TXT, JSON, CSV, Source Code (.js, .jsx, .ts, .tsx, .dart, .py, .html, .css, .sql), or Images (.png, .jpg).`
    };
  }
  return { allowed: true, ext };
}

/**
 * Decodes base64 data URL or string to a Uint8Array
 */
export function base64ToUint8Array(base64UrlOrData: string): Uint8Array {
  try {
    let cleanBase64 = base64UrlOrData.trim();
    if (cleanBase64.includes(",")) {
      cleanBase64 = cleanBase64.split(",")[1];
    }
    cleanBase64 = cleanBase64.replace(/\s/g, "");
    if (typeof window !== "undefined" && window.atob) {
      const binaryString = window.atob(cleanBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } else {
      return new Uint8Array(Buffer.from(cleanBase64, "base64"));
    }
  } catch (e) {
    return new Uint8Array(0);
  }
}

/**
 * Decodes base64 data to plain text (works for code, markdown, txt, csv, json, etc.)
 */
export function decodeBase64ToText(base64UrlOrData: string): string {
  try {
    const bytes = base64ToUint8Array(base64UrlOrData);
    if (bytes.length === 0) return "";
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch (e) {
    return "";
  }
}

/**
 * Checks if a file is readable as plain text / source code
 */
export function isTextOrCodeFile(fileName: string, mimeType?: string): boolean {
  const ext = (fileName.toLowerCase().split(".").pop() || "").trim();
  if (["pdf", "docx", "doc", "zip", "rar", "7z", "png", "jpg", "jpeg", "gif", "webp"].includes(ext)) {
    return false;
  }
  if (mimeType && (mimeType.startsWith("text/") || mimeType.includes("json") || mimeType.includes("javascript") || mimeType.includes("xml"))) {
    return true;
  }
  const codeExtensions = [
    "txt", "md", "js", "ts", "jsx", "tsx", "py", "java", "c", "cpp", "h", "hpp",
    "cs", "html", "htm", "css", "scss", "json", "xml", "sql", "sh", "bash",
    "php", "rb", "go", "rs", "yaml", "yml", "csv", "dart", "kt", "swift", "gradle", "lock"
  ];
  return codeExtensions.includes(ext);
}

export function isDocxFile(fileName: string, mimeType?: string): boolean {
  const ext = (fileName.toLowerCase().split(".").pop() || "").trim();
  return ext === "docx" || Boolean(mimeType && mimeType.includes("officedocument.wordprocessingml.document"));
}

export function isZipFile(fileName: string, mimeType?: string): boolean {
  const ext = (fileName.toLowerCase().split(".").pop() || "").trim();
  return ext === "zip" || Boolean(mimeType && (mimeType.includes("application/zip") || mimeType.includes("x-zip")));
}

/**
 * Decompresses raw DEFLATE bytes using the standard Web DecompressionStream API
 */
async function inflateRawBytes(compressedBytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    return new Uint8Array(0);
  }
  try {
    const ds = new DecompressionStream("deflate-raw");
    const writer = ds.writable.getWriter();
    // Pass a clean copy of the slice
    const copy = new Uint8Array(compressedBytes.byteLength);
    copy.set(compressedBytes);
    writer.write(copy).catch(() => {});
    writer.close().catch(() => {});
    const ab = await new Response(ds.readable).arrayBuffer();
    return new Uint8Array(ab);
  } catch (e) {
    return new Uint8Array(0);
  }
}

/**
 * Low-level PKZIP Central Directory & Local Header parser.
 * Used to unpack both .docx (Word XML) and .zip (source code bundles) in the browser.
 */
async function parseZipEntriesFromBytes(zipBytes: Uint8Array): Promise<Array<{ name: string; data: Uint8Array }>> {
  if (zipBytes.byteLength < 22) return [];
  const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);

  // Locate End of Central Directory (EOCD) signature: 0x06054b50
  let eocdPos = -1;
  const minPos = Math.max(0, zipBytes.byteLength - 65557);
  for (let i = zipBytes.byteLength - 22; i >= minPos; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdPos = i;
      break;
    }
  }

  const results: Array<{ name: string; data: Uint8Array }> = [];

  if (eocdPos !== -1) {
    const cdCount = view.getUint16(eocdPos + 10, true);
    let ptr = view.getUint32(eocdPos + 16, true);

    for (let i = 0; i < cdCount; i++) {
      if (ptr + 46 > zipBytes.byteLength) break;
      const sig = view.getUint32(ptr, true);
      if (sig !== 0x02014b50) break;

      const method = view.getUint16(ptr + 10, true);
      const compSize = view.getUint32(ptr + 20, true);
      const uncompSize = view.getUint32(ptr + 24, true);
      const nameLen = view.getUint16(ptr + 28, true);
      const extraLen = view.getUint16(ptr + 30, true);
      const commentLen = view.getUint16(ptr + 32, true);
      const localOffset = view.getUint32(ptr + 42, true);

      const name = new TextDecoder("utf-8").decode(zipBytes.subarray(ptr + 46, ptr + 46 + nameLen));
      ptr += 46 + nameLen + extraLen + commentLen;

      // Skip directories and oversized binary blobs (> 2MB uncompressed)
      if (name.endsWith("/") || uncompSize > 2 * 1024 * 1024) continue;
      if (localOffset + 30 > zipBytes.byteLength) continue;

      const localNameLen = view.getUint16(localOffset + 26, true);
      const localExtraLen = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLen + localExtraLen;
      if (dataStart + compSize > zipBytes.byteLength) continue;

      const compSlice = zipBytes.subarray(dataStart, dataStart + compSize);
      let outBytes: Uint8Array | null = null;
      if (method === 0) {
        outBytes = compSlice;
      } else if (method === 8) {
        outBytes = await inflateRawBytes(compSlice);
      }
      if (outBytes && outBytes.byteLength > 0) {
        results.push({ name, data: outBytes });
      }
    }
  }

  return results;
}

/**
 * Converts WordprocessingML XML (word/document.xml) into clean, readable text
 */
function wordXmlToPlainText(xml: string): string {
  return xml
    .replace(/<w:tab\b[^>]*\/?>/gi, "\t")
    .replace(/<w:br\b[^>]*\/?>/gi, "\n")
    .replace(/<\/w:tc>/gi, " | ")
    .replace(/<\/w:tr>/gi, "\n")
    .replace(/<\/w:p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extracts full plain text from a .docx (Microsoft Word) base64 data URL
 */
export async function extractDocxTextFromBase64(base64Url: string): Promise<string> {
  try {
    const bytes = base64ToUint8Array(base64Url);
    if (bytes.byteLength === 0) return "";
    const entries = await parseZipEntriesFromBytes(bytes);
    const docEntry = entries.find(e => e.name === "word/document.xml" || e.name.endsWith("/document.xml"));
    if (!docEntry) return "";
    const xmlStr = new TextDecoder("utf-8").decode(docEntry.data);
    return wordXmlToPlainText(xmlStr);
  } catch (e) {
    console.warn("DOCX text extraction failed:", e);
    return "";
  }
}

/**
 * Extracts readable source code and document files from a .zip base64 data URL
 */
export async function extractZipFilesFromBase64(base64Url: string): Promise<ExtractedArchiveEntry[]> {
  try {
    const bytes = base64ToUint8Array(base64Url);
    if (bytes.byteLength === 0) return [];
    const entries = await parseZipEntriesFromBytes(bytes);
    const extracted: ExtractedArchiveEntry[] = [];

    for (const entry of entries) {
      const lower = entry.name.toLowerCase();
      // Ignore dependency directories, build artifacts, OS metadata, and lockfiles
      if (
        lower.includes("node_modules/") ||
        lower.includes(".git/") ||
        lower.includes("__macosx/") ||
        lower.includes(".next/") ||
        lower.includes("/dist/") ||
        lower.includes("/build/") ||
        lower.endsWith("package-lock.json") ||
        lower.endsWith("yarn.lock") ||
        lower.endsWith(".ds_store")
      ) {
        continue;
      }

      if (isTextOrCodeFile(entry.name)) {
        const text = new TextDecoder("utf-8", { fatal: false }).decode(entry.data);
        if (text && !text.includes("\u0000")) {
          extracted.push({
            path: entry.name,
            content: text,
            size: entry.data.byteLength
          });
        }
      } else if (lower.endsWith(".docx")) {
        // Nested .docx inside a .zip
        const subEntries = await parseZipEntriesFromBytes(entry.data);
        const docXml = subEntries.find(e => e.name === "word/document.xml");
        if (docXml) {
          const xmlText = wordXmlToPlainText(new TextDecoder("utf-8").decode(docXml.data));
          if (xmlText) {
            extracted.push({
              path: entry.name,
              content: xmlText,
              size: entry.data.byteLength
            });
          }
        }
      }
    }

    return extracted;
  } catch (e) {
    console.warn("ZIP extraction failed:", e);
    return [];
  }
}

/**
 * Extracts text from a PDF base64 data URL using pdfjs-dist in the browser
 */
export async function extractPdfTextFromBase64(base64Url: string): Promise<string> {
  if (typeof window === "undefined") return "";
  try {
    const bytes = base64ToUint8Array(base64Url);
    if (bytes.byteLength === 0) return "";
    const pdfjsLib = await import("pdfjs-dist");
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    } catch {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
    }

    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    let extractedText = "";
    const maxPages = Math.min(pdf.numPages, 35);
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str || "").join(" ");
      extractedText += pageText + "\n\n";
    }
    return extractedText.trim();
  } catch (e) {
    console.warn("PDF text extraction warning:", e);
    return "";
  }
}

/**
 * Extracts all readable text across a submission's written Markdown and attached file (.pdf, .docx, .md, .json, code, or .zip)
 */
export async function extractSubmissionReadableText(submission: AssignmentSubmission): Promise<{
  writtenText: string;
  fileText: string;
  combinedText: string;
  fileFormatLabel: string;
  isUnreadableBinary: boolean;
}> {
  const writtenText = (submission.contentMarkdown || "").trim();
  let fileText = "";
  let fileFormatLabel = "No File";
  let isUnreadableBinary = false;

  const fileData = submission.fileData;
  if (fileData && fileData.base64Url) {
    const name = fileData.name || "";
    const mime = fileData.type || "";
    const lowerName = name.toLowerCase();

    if (isDocxFile(name, mime)) {
      fileFormatLabel = "Word Document (.docx)";
      fileText = await extractDocxTextFromBase64(fileData.base64Url);
    } else if (lowerName.endsWith(".pdf") || mime.includes("pdf")) {
      fileFormatLabel = "PDF Document (.pdf)";
      fileText = await extractPdfTextFromBase64(fileData.base64Url);
    } else if (isZipFile(name, mime)) {
      fileFormatLabel = "ZIP Archive (.zip)";
      const entries = await extractZipFilesFromBase64(fileData.base64Url);
      if (entries.length > 0) {
        fileText = entries
          .map(e => `// === FILE: ${e.path} ===\n${e.content.slice(0, 12000)}`)
          .join("\n\n");
      } else {
        isUnreadableBinary = true;
      }
    } else if (isTextOrCodeFile(name, mime)) {
      fileFormatLabel = `Source/Text File (${name.split(".").pop()?.toUpperCase() || "TEXT"})`;
      fileText = decodeBase64ToText(fileData.base64Url).trim();
    } else if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(lowerName)) {
      fileFormatLabel = "Image / Diagram";
    } else {
      fileFormatLabel = `Unsupported Binary (${name})`;
      isUnreadableBinary = true;
    }
  }

  const combinedText = [writtenText, fileText].filter(Boolean).join("\n\n").trim();
  return {
    writtenText,
    fileText,
    combinedText,
    fileFormatLabel,
    isUnreadableBinary
  };
}

/**
 * Parses an Assignment's instructionsMarkdown into individual questions/tasks/requirements
 * so grading is strictly anchored to what the instructor asked.
 */
export interface ParsedAssignmentQuestion {
  index: number;
  title: string;
  rawText: string;
  keywords: string[];
}

const STOP_WORDS = new Set([
  "the", "and", "for", "that", "this", "with", "from", "your", "have", "will", "are", "was",
  "were", "been", "being", "into", "using", "used", "use", "make", "create", "write", "build",
  "design", "implement", "should", "must", "can", "may", "each", "all", "any", "both", "such",
  "than", "then", "them", "they", "their", "there", "where", "when", "what", "which", "who",
  "whom", "whose", "why", "how", "about", "above", "after", "again", "against", "below",
  "between", "during", "before", "under", "over", "some", "other", "more", "most", "only",
  "same", "so", "too", "very", "just", "also", "now", "task", "requirements", "requirement",
  "assignment", "overview", "section", "page", "pages", "following", "example", "examples",
  "given", "take", "takes", "print", "return", "returns", "output", "input", "value", "values"
]);

function extractImportantKeywords(text: string): string[] {
  const words = text
    .replace(/[^a-zA-Z0-9_/-]/g, " ")
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w.toLowerCase()) && !/^\d+$/.test(w));

  const unique = new Set<string>();
  for (const w of words) {
    unique.add(w.toLowerCase());
  }
  return Array.from(unique).slice(0, 20);
}

export function parseAssignmentQuestions(assignment: Assignment): ParsedAssignmentQuestion[] {
  const raw = (assignment.instructionsMarkdown || assignment.description || "").trim();
  if (!raw) return [];

  const lines = raw.split(/\r?\n/);
  const sections: Array<{ title: string; body: string[] }> = [];
  let current: { title: string; body: string[] } | null = null;

  // Match numbered tasks/questions like: "1:", "1.", "1)", "Question 1", "Task 1", "I)", "II)", "III)", or Markdown headers "### 1."
  const questionHeaderRegex = /^(?:#{1,4}\s*)?(?:(?:Question|Task|Part|Exercise|Problem)\s*\d+|[1-9]\d?\s*[:.)]|[I|V|X]{1,4}\s*[.)])\s*(.+)$/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(questionHeaderRegex);
    if (match) {
      if (current) sections.push(current);
      current = {
        title: trimmed.replace(/^#{1,4}\s*/, ""),
        body: [trimmed]
      };
    } else if (current) {
      current.body.push(trimmed);
    }
  }
  if (current) sections.push(current);

  if (sections.length > 0) {
    return sections.map((sec, idx) => {
      const fullText = sec.body.join("\n");
      return {
        index: idx + 1,
        title: sec.title.slice(0, 90),
        rawText: fullText,
        keywords: extractImportantKeywords(fullText)
      };
    });
  }

  // Fallback: split by paragraphs or bullet groups if no numbered headers found
  const paragraphs = raw
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 25);

  return paragraphs.slice(0, 10).map((p, idx) => ({
    index: idx + 1,
    title: p.split("\n")[0].slice(0, 80),
    rawText: p,
    keywords: extractImportantKeywords(p)
  }));
}

function computeLetterGrade(score: number, maxScore: number): string {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  if (pct >= 90) return "A+";
  if (pct >= 85) return "A";
  if (pct >= 80) return "A-";
  if (pct >= 75) return "B+";
  if (pct >= 70) return "B";
  if (pct >= 65) return "B-";
  if (pct >= 60) return "C+";
  if (pct >= 50) return "C";
  if (pct >= 40) return "D";
  return "F";
}

/**
 * Evaluates a student assignment submission using Gemini Multimodal AI + Strict Question-by-Question Rubric Verification.
 * Reads written text, extracted PDF/DOCX/ZIP/Code text, and checks every question in the assignment instructions.
 */
export async function gradeSubmissionWithGemini(params: {
  assignment: Assignment;
  submission: AssignmentSubmission;
}): Promise<AiGradingResult> {
  const { assignment, submission } = params;
  const maxScore = assignment.totalPoints || submission.maxScore || 100;

  // 1. Extract all readable text from written answer + attached file (.pdf, .docx, .md, .json, code, or .zip)
  const extracted = await extractSubmissionReadableText(submission);
  const parsedQuestions = parseAssignmentQuestions(assignment);

  const wordList = extracted.combinedText
    .replace(/[^a-zA-Z0-9_]/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 2);
  const wordCount = wordList.length;
  const charCount = extracted.combinedText.length;

  const isImageSubmission = Boolean(
    submission.fileData &&
    (submission.fileData.type?.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(submission.fileData.name || ""))
  );

  // 2. STRICT GATE FOR EMPTY OR TRIVIAL ONE-LINE SUBMISSIONS
  if (!isImageSubmission) {
    if (wordCount === 0 && !submission.fileData) {
      return {
        suggestedScore: 0,
        maxScore,
        letterGrade: "F",
        summary: "No work, text, or file was submitted by the student.",
        strengths: ["None — submission is completely empty."],
        weaknesses: [
          "0 questions answered out of the assigned tasks.",
          "No written explanation, code, or document file attached."
        ],
        recommendations: [
          "Read the assignment instructions carefully and complete all required tasks before submitting."
        ],
        feedbackDraft: `Hello ${submission.studentName},\n\nYour submission for "${assignment.title}" is completely empty and contains no answers or attached work. As a result, a score of 0/${maxScore} (F) has been recorded.\n\nPlease review the assignment instructions and submit your completed work in an accepted format (.pdf, .docx, .md, .json, or code files).`,
        evaluatedAt: new Date().toISOString()
      };
    }

    if (wordCount === 0 && extracted.isUnreadableBinary) {
      return {
        suggestedScore: 0,
        maxScore,
        letterGrade: "F",
        summary: `The uploaded file (${submission.fileData?.name}) could not be read and no written answer was provided.`,
        strengths: ["File upload attempted."],
        weaknesses: [
          `Uploaded file "${submission.fileData?.name}" is in an unreadable or empty binary format.`,
          "No readable answers to the assignment questions were found."
        ],
        recommendations: [
          "Re-submit your work using an accepted readable format: .pdf, .docx, .md, .txt, .json, or source code files."
        ],
        feedbackDraft: `Hello ${submission.studentName},\n\nYour uploaded file "${submission.fileData?.name}" for "${assignment.title}" is not in a readable format and no written solution was provided. Please re-upload your assignment as a PDF (.pdf), Word document (.docx), Markdown (.md), JSON (.json), or source code file so your work can be evaluated.\n\nAwarded Score: 0/${maxScore} (F)`,
        evaluatedAt: new Date().toISOString()
      };
    }

    // One-line sentence check: student wrote < 15 words (e.g. one short line) and didn't attach a valid file
    if (wordCount < 15 && charCount < 90) {
      // Check if even a single keyword from the assignment was matched
      const allKeywords = parsedQuestions.flatMap(q => q.keywords);
      const lowerCombined = extracted.combinedText.toLowerCase();
      const matchedKw = allKeywords.filter(k => lowerCombined.includes(k));
      const trivialScore = matchedKw.length > 0 ? Math.min(Math.round(maxScore * 0.08), 8) : 0;

      return {
        suggestedScore: trivialScore,
        maxScore,
        letterGrade: "F",
        summary: `Incomplete one-line submission (${wordCount} words). The student did not answer the required questions for "${assignment.title}".`,
        strengths: trivialScore > 0 ? ["Briefly mentioned a related term, but provided no solution."] : ["None — only a single short line was submitted."],
        weaknesses: [
          `Only ${wordCount} word(s) (${charCount} characters) submitted: "${extracted.combinedText.slice(0, 80)}".`,
          ...parsedQuestions.slice(0, 5).map(q => `Missing answer for: ${q.title}`)
        ],
        recommendations: [
          "Answer every numbered question and requirement in the assignment instructions.",
          "Provide complete explanations, mathematical steps, or working source code as requested."
        ],
        feedbackDraft: `Hello ${submission.studentName},\n\nYour submission for "${assignment.title}" consists of only a single short line (${wordCount} words) and does not address the questions or deliverables required in the assignment instructions.\n\nTo earn credit, you must complete the assigned tasks and provide full answers or attach your completed document (.pdf, .docx, .md, or code).\n\nAwarded Score: ${trivialScore}/${maxScore} (F)`,
        evaluatedAt: new Date().toISOString()
      };
    }
  }

  // 3. ATTEMPT GEMINI AI QUESTION-BY-QUESTION EVALUATION
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (apiKey && apiKey.trim().length > 10) {
    const modelsToTry = [
      "gemini-flash-latest",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-pro-latest",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-pro"
    ];

    const questionsBreakdownText = parsedQuestions.length > 0
      ? parsedQuestions.map((q, i) => `Question/Task #${i + 1} (${(maxScore / parsedQuestions.length).toFixed(1)} pts): ${q.rawText}`).join("\n\n")
      : assignment.instructionsMarkdown || assignment.description;

    for (const modelName of modelsToTry) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);

        const promptHeader = `You are a strict, accurate, and fair Academic Course Examiner.
Your task is to grade a student's assignment submission strictly based on the questions and requirements in the assignment rubric.

=== ASSIGNMENT RUBRIC & QUESTIONS ===
Assignment Title: ${assignment.title}
Course: ${assignment.courseCode} ${assignment.courseTitle || ""}
Total Maximum Score: ${maxScore} Points
Number of Detected Questions / Tasks: ${parsedQuestions.length || 1}

Full Assignment Instructions:
${assignment.instructionsMarkdown || assignment.description}

Parsed Questions Breakdown:
${questionsBreakdownText}

=== STUDENT SUBMISSION ===
Student: ${submission.studentName} (${submission.studentUsername})
Attached File Info: ${submission.fileData ? `${submission.fileData.name} (${extracted.fileFormatLabel}, ${(submission.fileData.size / 1024).toFixed(1)} KB)` : "No file attached"}
Total Extracted Word Count: ${wordCount} words

${extracted.writtenText ? `--- Student Written Text Answer ---\n${extracted.writtenText.slice(0, 25000)}\n` : ""}
${extracted.fileText ? `--- Extracted Content from Student Attached File (${submission.fileData?.name}) ---\n${extracted.fileText.slice(0, 35000)}\n` : ""}

=== STRICT GRADING RULES ===
1. Evaluate the student's work QUESTION BY QUESTION against the assignment instructions above.
2. Divide the ${maxScore} total points proportionally across all required questions/tasks.
3. DO NOT give sympathy points or a 60% floor for incomplete, off-topic, or one-line submissions.
4. If the student only answered half of the questions, their score CANNOT exceed 50% of ${maxScore}.
5. If the student's answer is wrong, superficial, or missing required code/steps, deduct points accordingly.
6. In "strengths", list the specific questions or requirements the student answered correctly.
7. In "weaknesses", list the specific questions, edge cases, or requirements that were missed, incomplete, or incorrect.
8. Write a clear, constructive "feedbackDraft" addressed to ${submission.studentName} explaining their score breakdown.`;

        const contentParts: any[] = [{ text: promptHeader }];

        // Also attach raw PDF or Image inlineData for multimodal inspection if applicable
        if (submission.fileData?.base64Url) {
          const match = submission.fileData.base64Url.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            const mimeType = match[1] || submission.fileData.type || "";
            const base64Data = match[2];
            if (mimeType.startsWith("image/") || (mimeType === "application/pdf" && !extracted.fileText)) {
              contentParts.push({
                inlineData: {
                  data: base64Data,
                  mimeType
                }
              });
            }
          }
        }

        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: {
              type: SchemaType.OBJECT,
              properties: {
                suggestedScore: { type: SchemaType.NUMBER },
                letterGrade: { type: SchemaType.STRING },
                summary: { type: SchemaType.STRING },
                strengths: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING }
                },
                weaknesses: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING }
                },
                recommendations: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING }
                },
                feedbackDraft: { type: SchemaType.STRING }
              },
              required: ["suggestedScore", "letterGrade", "summary", "strengths", "weaknesses", "recommendations", "feedbackDraft"]
            }
          }
        });

        const response = await model.generateContent(contentParts);
        const text = response.response.text();
        if (text) {
          const parsed = JSON.parse(text);
          const rawNumeric = parsed.suggestedScore !== undefined && parsed.suggestedScore !== null && !Number.isNaN(Number(parsed.suggestedScore))
            ? Number(parsed.suggestedScore)
            : 0;
          const score = Math.max(0, Math.min(maxScore, Math.round(rawNumeric)));
          const letter = computeLetterGrade(score, maxScore);

          return {
            suggestedScore: score,
            maxScore,
            letterGrade: parsed.letterGrade || letter,
            summary: parsed.summary || `Evaluated against ${parsedQuestions.length || 1} assignment requirement(s).`,
            strengths: Array.isArray(parsed.strengths) && parsed.strengths.length > 0 ? parsed.strengths : ["See detailed feedback below."],
            weaknesses: Array.isArray(parsed.weaknesses) && parsed.weaknesses.length > 0 ? parsed.weaknesses : ["Review missed requirements in the rubric."],
            recommendations: Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0 ? parsed.recommendations : ["Verify all assignment tasks before final submission."],
            feedbackDraft: parsed.feedbackDraft || `Evaluated "${assignment.title}". Score: ${score}/${maxScore} (${letter}).`,
            evaluatedAt: new Date().toISOString()
          };
        }
      } catch (err) {
        console.warn(`Gemini grading attempt with ${modelName} failed:`, err);
      }
    }
  }

  // 4. CONTENT-AWARE QUESTION-BY-QUESTION RUBRIC ANALYZER (Offline / Fallback Engine)
  return evaluateByQuestionRubric(assignment, submission, extracted, parsedQuestions, maxScore, wordCount);
}

/**
 * Deterministic Question-by-Question Rubric Analyzer.
 * Inspects the student's actual text + extracted PDF/DOCX/ZIP/Code content against every question
 * and technical keyword in the assignment instructions. Never awards blind 60% scores.
 */
function evaluateByQuestionRubric(
  assignment: Assignment,
  submission: AssignmentSubmission,
  extracted: {
    writtenText: string;
    fileText: string;
    combinedText: string;
    fileFormatLabel: string;
    isUnreadableBinary: boolean;
  },
  questions: ParsedAssignmentQuestion[],
  maxScore: number,
  wordCount: number
): AiGradingResult {
  const lowerContent = extracted.combinedText.toLowerCase();
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  const totalQuestions = Math.max(1, questions.length);
  const pointsPerQuestion = maxScore / totalQuestions;
  let earnedPoints = 0;
  let answeredCount = 0;

  if (questions.length > 0) {
    for (const q of questions) {
      const kws = q.keywords;
      if (kws.length === 0) {
        earnedPoints += pointsPerQuestion * 0.5;
        continue;
      }
      const matched = kws.filter(k => lowerContent.includes(k));
      const matchRatio = matched.length / Math.min(kws.length, 6); // Expect at least up to 6 core terms per question

      if (matchRatio >= 0.55) {
        answeredCount++;
        const qScore = pointsPerQuestion * Math.min(1, 0.75 + matchRatio * 0.25);
        earnedPoints += qScore;
        strengths.push(`Addressed Task #${q.index}: "${q.title}" (matched key concepts: ${matched.slice(0, 4).join(", ")}).`);
      } else if (matchRatio >= 0.25) {
        answeredCount += 0.5;
        const qScore = pointsPerQuestion * (0.35 + matchRatio * 0.4);
        earnedPoints += qScore;
        weaknesses.push(`Partially addressed Task #${q.index}: "${q.title}" — missing some required details or terms (${kws.filter(k => !lowerContent.includes(k)).slice(0, 3).join(", ")}).`);
      } else {
        weaknesses.push(`Missing or unanswered Task #${q.index}: "${q.title}".`);
      }
    }
  } else {
    // Fallback if assignment had no structured text
    const allKw = extractImportantKeywords(assignment.title + " " + (assignment.description || ""));
    const matched = allKw.filter(k => lowerContent.includes(k));
    const ratio = allKw.length > 0 ? matched.length / allKw.length : 0.5;
    earnedPoints = maxScore * Math.min(1, ratio);
  }

  // Depth & completeness adjustment based on expected length per question
  const expectedMinWords = Math.max(40, totalQuestions * 25);
  let depthMultiplier = 1.0;
  if (wordCount < expectedMinWords * 0.35) {
    depthMultiplier = 0.45;
    weaknesses.push(`Submission is very brief (${wordCount} words) relative to the ${totalQuestions} required task(s).`);
  } else if (wordCount < expectedMinWords * 0.65) {
    depthMultiplier = 0.78;
    weaknesses.push(`Explanations/code could be more thorough (${wordCount} words provided).`);
  } else {
    strengths.push(`Substantial submission depth (${wordCount} words across ${submission.fileData ? extracted.fileFormatLabel : "written response"}).`);
  }

  // Bonus verification for code constructs or mathematical expressions when present
  const hasCodeOrMath = /function\s+\w+|const\s+\w+|class\s+\w+|import\s+|return\s+|for\s*\(|if\s*\(|<[A-Z]\w+|[01]{4,}|\b(?:AND|OR|NOT|XOR|NAND|NOR)\b/i.test(extracted.combinedText);
  if (hasCodeOrMath) {
    strengths.push("Contains concrete technical implementation (code syntax, logic expressions, or structured steps).");
  }

  const rawFinal = Math.round(earnedPoints * depthMultiplier);
  const finalScore = Math.max(0, Math.min(maxScore, rawFinal));
  const letterGrade = computeLetterGrade(finalScore, maxScore);

  if (weaknesses.length > 0) {
    recommendations.push("Review the missed or partially completed tasks listed under Weaknesses and provide complete solutions for each numbered requirement.");
  }
  recommendations.push("Verify that every question in the assignment instructions has a clearly labeled section or code function.");

  const summary = `Question-by-question rubric evaluation completed for "${assignment.title}": ${answeredCount} of ${totalQuestions} task(s) addressed (${wordCount} words analyzed from ${submission.fileData ? extracted.fileFormatLabel : "written text"}).`;

  const feedbackDraft =
    `Hello ${submission.studentName},\n\n` +
    `Your submission for "${assignment.title}" has been evaluated against the ${totalQuestions} required task(s) in the assignment rubric.\n\n` +
    `• Tasks Addressed: ${answeredCount} / ${totalQuestions}\n` +
    `• Content Analyzed: ${wordCount} words (${submission.fileData ? `${submission.fileData.name} — ${extracted.fileFormatLabel}` : "Written Markdown Answer"})\n` +
    (strengths.length > 0 ? `\nWhat you did well:\n- ${strengths.slice(0, 4).join("\n- ")}\n` : "") +
    (weaknesses.length > 0 ? `\nAreas needing improvement / missing tasks:\n- ${weaknesses.slice(0, 4).join("\n- ")}\n` : "") +
    `\nAwarded Score: ${finalScore} / ${maxScore} (${letterGrade})`;

  return {
    suggestedScore: finalScore,
    maxScore,
    letterGrade,
    summary,
    strengths: strengths.length > 0 ? strengths : ["Submitted work on time, but core assignment questions were not adequately answered."],
    weaknesses: weaknesses.length > 0 ? weaknesses : ["No major omissions detected across the assigned tasks."],
    recommendations,
    feedbackDraft,
    evaluatedAt: new Date().toISOString()
  };
}
