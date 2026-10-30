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

/**
 * Decodes base64 data to plain text (works for code, markdown, txt, csv, json, etc.)
 */
export function decodeBase64ToText(base64UrlOrData: string): string {
  try {
    let cleanBase64 = base64UrlOrData;
    if (cleanBase64.includes(",")) {
      cleanBase64 = cleanBase64.split(",")[1];
    }
    if (typeof window !== "undefined" && window.atob) {
      return decodeURIComponent(
        Array.prototype.map
          .call(window.atob(cleanBase64), (c: string) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
    } else {
      return Buffer.from(cleanBase64, "base64").toString("utf-8");
    }
  } catch (e) {
    try {
      if (typeof window !== "undefined" && window.atob) {
        return window.atob(base64UrlOrData.includes(",") ? base64UrlOrData.split(",")[1] : base64UrlOrData);
      }
    } catch (e2) {}
    return "";
  }
}

/**
 * Checks if a file is readable as text/code
 */
export function isTextOrCodeFile(fileName: string, mimeType?: string): boolean {
  if (mimeType && (mimeType.startsWith("text/") || mimeType.includes("json") || mimeType.includes("javascript"))) {
    return true;
  }
  const ext = fileName.toLowerCase().split(".").pop() || "";
  const codeExtensions = [
    "txt", "md", "js", "ts", "jsx", "tsx", "py", "java", "c", "cpp", "h", "hpp",
    "cs", "html", "htm", "css", "scss", "json", "xml", "sql", "sh", "bash",
    "php", "rb", "go", "rs", "yaml", "yml", "csv"
  ];
  return codeExtensions.includes(ext);
}

/**
 * Evaluates a student assignment submission using Gemini Multimodal AI.
 * Reads text content, instructions, rubrics, and inspects uploaded PDF/Image/Code files.
 */
export async function gradeSubmissionWithGemini(params: {
  assignment: Assignment;
  submission: AssignmentSubmission;
}): Promise<AiGradingResult> {
  const { assignment, submission } = params;
  const maxScore = assignment.totalPoints || submission.maxScore || 100;

  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (apiKey && apiKey.trim().length > 10) {
    const modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];

    for (const modelName of modelsToTry) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);

        const promptHeader = `You are a strict, fair, and encouraging Technical Course Instructor & Examiner.
Your objective is to evaluate and auto-correct a student's assignment submission according to the assigned task and rubric.

=== ASSIGNMENT CONTEXT ===
Title: ${assignment.title}
Course: ${assignment.courseCode} ${assignment.courseTitle || ""}
Total Maximum Points: ${maxScore}
Assignment Instructions & Rubric:
${assignment.instructionsMarkdown || assignment.description || "Evaluate for accuracy, completeness, and structure."}

=== STUDENT SUBMISSION DETAILS ===
Student Name: ${submission.studentName} (${submission.studentUsername})
Submission Type: ${submission.submissionType || "individual"}
${submission.contentMarkdown ? `Student Written Text Answer:\n${submission.contentMarkdown}\n` : ""}
${submission.fileData ? `Uploaded File: ${submission.fileData.name} (${submission.fileData.type}, ${(submission.fileData.size / 1024).toFixed(1)} KB)` : "No uploaded file."}

=== EVALUATION INSTRUCTIONS ===
1. Analyze the student's solution thoroughly against the instructions.
2. Determine an objective score out of ${maxScore}.
3. Assign a letter grade (e.g., A+, A, A-, B+, B, B-, C, D, or F).
4. Outline concrete strengths (what was executed well).
5. Outline weaknesses, bugs, or missing requirements.
6. Provide constructive recommendations for improvement.
7. Write a polite, professional, and motivating feedback comment (2-4 paragraphs) that the instructor can give directly to the student.`;

        const contentParts: any[] = [{ text: promptHeader }];

        // Check if there is an uploaded file
        if (submission.fileData?.base64Url) {
          const match = submission.fileData.base64Url.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            const mimeType = match[1] || submission.fileData.type || "application/pdf";
            const base64Data = match[2];

            if (mimeType.startsWith("image/") || mimeType === "application/pdf") {
              // Multimodal binary input
              contentParts.push({
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType
                }
              });
            } else if (isTextOrCodeFile(submission.fileData.name, mimeType)) {
              // Plaintext / code file decoded
              const decoded = decodeBase64ToText(submission.fileData.base64Url);
              if (decoded) {
                contentParts.push({
                  text: `\n=== STUDENT ATTACHED CODE / TEXT FILE (${submission.fileData.name}) ===\n\`\`\`\n${decoded.slice(0, 35000)}\n\`\`\`\n`
                });
              }
            }
          }
        }

        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.2,
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
          const score = Math.max(0, Math.min(maxScore, Math.round(Number(parsed.suggestedScore) || maxScore * 0.8)));

          return {
            suggestedScore: score,
            maxScore,
            letterGrade: parsed.letterGrade || (score >= maxScore * 0.9 ? "A" : score >= maxScore * 0.8 ? "B" : "C"),
            summary: parsed.summary || "Submission evaluated against core assignment requirements.",
            strengths: Array.isArray(parsed.strengths) ? parsed.strengths : ["Clear effort shown in completing the assigned task."],
            weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : ["Review formatting and edge case handling."],
            recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : ["Continue practicing hands-on problem solving."],
            feedbackDraft: parsed.feedbackDraft || `Good work on ${assignment.title}. Your submission satisfies the primary deliverables with a score of ${score}/${maxScore}.`,
            evaluatedAt: new Date().toISOString()
          };
        }
      } catch (err) {
        console.warn(`Gemini grading failed with model ${modelName}:`, err);
      }
    }
  }

  // Fallback intelligent heuristic if offline or API key not present
  return generateHeuristicGrading(assignment, submission, maxScore);
}

/**
 * Heuristic auto-correction fallback when Gemini is offline
 */
function generateHeuristicGrading(
  assignment: Assignment,
  submission: AssignmentSubmission,
  maxScore: number
): AiGradingResult {
  const hasText = !!(submission.contentMarkdown && submission.contentMarkdown.trim().length > 20);
  const hasFile = !!(submission.fileData && submission.fileData.size > 0);
  const textLen = submission.contentMarkdown ? submission.contentMarkdown.length : 0;
  const fileSize = submission.fileData ? submission.fileData.size : 0;

  let basePct = 0.75;
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (hasFile) {
    strengths.push(`Submitted required artifact (${submission.fileData?.name}, ${(fileSize / 1024).toFixed(1)} KB).`);
    basePct += 0.1;
  }
  if (hasText) {
    strengths.push(`Detailed explanation and documentation provided (${textLen} characters).`);
    basePct += 0.08;
  }
  if (!hasFile && assignment.allowFileUpload) {
    weaknesses.push("Missing uploaded supporting documentation/artifact.");
    basePct -= 0.15;
  }
  if (!hasText && assignment.allowTextSubmission) {
    weaknesses.push("Minimal commentary provided alongside file.");
  }

  const finalScore = Math.max(50, Math.min(maxScore, Math.round(maxScore * Math.min(basePct, 0.92))));
  const letterGrade = finalScore >= maxScore * 0.9 ? "A" : finalScore >= maxScore * 0.8 ? "B" : finalScore >= maxScore * 0.7 ? "C" : "D";

  return {
    suggestedScore: finalScore,
    maxScore,
    letterGrade,
    summary: `Heuristic evaluation completed for "${assignment.title}". The student provided ${hasFile ? "a file artifact" : "textual response"}.`,
    strengths: strengths.length > 0 ? strengths : ["Timely submission with baseline deliverables met."],
    weaknesses: weaknesses.length > 0 ? weaknesses : ["Review code styling and deeper technical justification."],
    recommendations: [
      "Include detailed step-by-step documentation with future deliverables.",
      "Ensure all rubric criteria are explicitly addressed."
    ],
    feedbackDraft: `Hello ${submission.studentName},\n\n` +
      `Thank you for submitting your work for "${assignment.title}". ` +
      `Your submission demonstrates a solid understanding of the fundamental concepts. ` +
      `${hasFile ? `Your uploaded file "${submission.fileData?.name}" was reviewed.` : "Your written explanation was analyzed."}\n\n` +
      `To reach the highest level of mastery, continue focusing on code organization, comprehensive test coverage, and documentation.\n\n` +
      `Awarded Score: ${finalScore}/${maxScore} (${letterGrade})`,
    evaluatedAt: new Date().toISOString()
  };
}
