import { ExamQuestion, QuestionType } from "@/types/exam";

/**
 * Standard CSV Template Content covering all 5 question types
 */
export const CSV_EXAM_TEMPLATE = `type,prompt,points,options,correct_answer,explanation
multiple_choice,"What is the main function of an operating system's kernel?",2,"Manages hardware resources and memory | Provides graphic design tools | Compiles high-level code | Formats USB flash drives",1,"The kernel is the core component that manages system hardware, CPU, and memory allocation."
multiple_select,"Which of the following are primary renewable energy sources? (Select all that apply)",3,"Solar photovoltaic | Bituminous Coal | Wind turbine | Natural Gas | Hydroelectric",1,3,5,"Solar, wind, and hydroelectric are non-depleting renewable energy sources."
true_false,"In modern web development, HTTPS encrypts network communication using TLS.",1,"True | False",True,"HTTPS uses Transport Layer Security (TLS) to encrypt all HTTP communication."
short_answer,"What unit is used to measure electrical frequency in the SI system?",2,"",Hertz,"Electrical frequency is measured in Hertz (Hz), representing cycles per second."
essay,"Explain the key differences between synchronous and asynchronous program execution with an everyday analogy.",5,"","Rubric: 1) Blocking vs non-blocking definition (2 pts), 2) Real-world analogy such as waiting in line vs order buzzer (2 pts), 3) Practical programming benefit (1 pt).","Synchronous execution halts subsequent operations until the current one finishes; asynchronous allows tasks to run concurrently without blocking the main thread."
`;

/**
 * Standard JSON Template Content covering all 5 question types
 */
export const JSON_EXAM_TEMPLATE: Omit<ExamQuestion, "id">[] = [
  {
    type: "multiple_choice",
    prompt: "What is the primary function of an electric transformer?",
    points: 2,
    options: [
      "Convert AC voltage from one level to another",
      "Convert AC electricity directly to DC electricity",
      "Store electrical energy as chemical energy",
      "Increase total electrical power in a circuit"
    ],
    correctAnswer: "0",
    explanation: "A transformer uses electromagnetic induction to step up or step down AC voltage."
  },
  {
    type: "multiple_select",
    prompt: "Which of the following protocols operate at the Application Layer of the OSI model? (Select all that apply)",
    points: 3,
    options: [
      "HTTP / HTTPS",
      "TCP (Transmission Control Protocol)",
      "DNS (Domain Name System)",
      "IP (Internet Protocol)",
      "SSH (Secure Shell)"
    ],
    correctAnswer: ["0", "2", "4"],
    explanation: "HTTP, DNS, and SSH are Application Layer protocols. TCP is Transport layer and IP is Network layer."
  },
  {
    type: "true_false",
    prompt: "A database transaction must satisfy the ACID properties (Atomicity, Consistency, Isolation, Durability).",
    points: 1,
    options: ["True", "False"],
    correctAnswer: true,
    explanation: "ACID properties guarantee reliable transaction processing in database management systems."
  },
  {
    type: "short_answer",
    prompt: "What Git command is used to record changes to the repository with a descriptive message?",
    points: 2,
    options: [],
    correctAnswer: "git commit",
    explanation: "'git commit -m \"message\"' creates a new commit containing the staged snapshots."
  },
  {
    type: "essay",
    prompt: "Describe the primary principles of Defensive Programming and give two concrete code design examples.",
    points: 5,
    options: [],
    correctAnswer: "Rubric: Input validation, asserting invariants, handling unexpected edge cases gracefully.",
    explanation: "Defensive programming ensures software functions predictably under unforeseen conditions."
  }
];

/**
 * Downloads a string as a file using a browser anchor
 */
function triggerBrowserDownload(filename: string, content: string, mimeType: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads the starter CSV template
 */
export function downloadExamTemplateCSV(): void {
  triggerBrowserDownload(
    "exam_questions_template.csv",
    CSV_EXAM_TEMPLATE,
    "text/csv;charset=utf-8;"
  );
}

/**
 * Downloads the starter JSON template
 */
export function downloadExamTemplateJSON(): void {
  triggerBrowserDownload(
    "exam_questions_template.json",
    JSON.stringify(JSON_EXAM_TEMPLATE, null, 2),
    "application/json;charset=utf-8;"
  );
}

/**
 * Exports existing questions as CSV
 */
export function exportExamQuestionsToCSV(questions: ExamQuestion[], examTitle: string): void {
  const sanitizeCSV = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return '""';
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  const rows: string[] = ["type,prompt,points,options,correct_answer,explanation"];

  for (const q of questions) {
    const type = q.type;
    const prompt = sanitizeCSV(q.prompt);
    const points = q.points;
    const options = sanitizeCSV((q.options || []).join(" | "));
    
    let answerStr = "";
    if (Array.isArray(q.correctAnswer)) {
      answerStr = q.correctAnswer.join(",");
    } else if (typeof q.correctAnswer === "boolean") {
      answerStr = q.correctAnswer ? "True" : "False";
    } else if (q.correctAnswer !== undefined) {
      answerStr = String(q.correctAnswer);
    }
    const correctAnswer = sanitizeCSV(answerStr);
    const explanation = sanitizeCSV(q.explanation || "");

    rows.push(`${type},${prompt},${points},${options},${correctAnswer},${explanation}`);
  }

  const safeName = (examTitle || "questions").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  triggerBrowserDownload(`${safeName}_export.csv`, rows.join("\n"), "text/csv;charset=utf-8;");
}

/**
 * Exports existing questions as JSON
 */
export function exportExamQuestionsToJSON(questions: ExamQuestion[], examTitle: string): void {
  const safeName = (examTitle || "questions").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const cleanQuestions = questions.map(({ id: _, ...rest }) => rest);
  triggerBrowserDownload(
    `${safeName}_export.json`,
    JSON.stringify(cleanQuestions, null, 2),
    "application/json;charset=utf-8;"
  );
}

/**
 * RFC-4180 compliant CSV parser that handles multiline fields and escaped quotes
 */
function parseRFC4180CSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let insideQuotes = false;
  let i = 0;

  // Normalize CRLF to LF
  const cleanText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  while (i < cleanText.length) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i += 2;
        continue;
      } else {
        insideQuotes = !insideQuotes;
        i++;
        continue;
      }
    }

    if (!insideQuotes) {
      if (char === ",") {
        currentRow.push(currentField.trim());
        currentField = "";
        i++;
        continue;
      } else if (char === "\n") {
        currentRow.push(currentField.trim());
        // Only push row if it contains non-empty fields
        if (currentRow.some(f => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = "";
        i++;
        continue;
      }
    }

    currentField += char;
    i++;
  }

  // Push remaining field / row
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Normalizes question type aliases from CSV or external tools
 */
function normalizeQuestionType(raw: string): QuestionType {
  const clean = (raw || "").toLowerCase().trim().replace(/[- ]/g, "_");
  if (clean.includes("select") || clean.includes("checkbox") || clean.includes("multi_choice") || clean === "multiple_answers") {
    return "multiple_select";
  }
  if (clean.includes("choice") || clean === "mcq" || clean === "single" || clean === "radio") {
    return "multiple_choice";
  }
  if (clean.includes("true") || clean.includes("false") || clean === "tf" || clean === "boolean") {
    return "true_false";
  }
  if (clean.includes("short") || clean === "text" || clean === "phrase" || clean === "keyword") {
    return "short_answer";
  }
  if (clean.includes("essay") || clean.includes("long") || clean.includes("code") || clean.includes("written")) {
    return "essay";
  }
  return "multiple_choice";
}

/**
 * Parses options split by pipe '|', double semicolon ';;', or line breaks
 */
function parseOptionsField(raw: string): string[] {
  if (!raw) return [];
  if (raw.includes("|")) {
    return raw.split("|").map(s => s.trim()).filter(Boolean);
  }
  if (raw.includes(";;")) {
    return raw.split(";;").map(s => s.trim()).filter(Boolean);
  }
  if (raw.includes("\n")) {
    return raw.split("\n").map(s => s.trim()).filter(Boolean);
  }
  return [raw.trim()];
}

/**
 * Letter to index mapper: A -> 0, B -> 1, C -> 2, D -> 3, etc.
 */
function letterToIndex(val: string): number | null {
  const trimmed = val.trim().toUpperCase();
  if (/^[A-Z]$/.test(trimmed)) {
    return trimmed.charCodeAt(0) - 65;
  }
  return null;
}

/**
 * Converts a CSV string into a validated array of ExamQuestion objects
 */
export function parseCSVToQuestions(csvText: string): { questions: ExamQuestion[]; errors: string[] } {
  const errors: string[] = [];
  const questions: ExamQuestion[] = [];

  if (!csvText || !csvText.trim()) {
    errors.push("The provided CSV file or text is empty.");
    return { questions, errors };
  }

  const rawRows = parseRFC4180CSV(csvText);
  if (rawRows.length < 2) {
    errors.push("The CSV file must contain a header row and at least one question row.");
    return { questions, errors };
  }

  // Find column indexes from header
  const header = rawRows[0].map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const typeIdx = header.findIndex(h => h.includes("type"));
  const promptIdx = header.findIndex(h => h.includes("prompt") || h.includes("question") || h.includes("title"));
  const pointsIdx = header.findIndex(h => h.includes("point") || h.includes("score") || h.includes("mark"));
  const optionsIdx = header.findIndex(h => h.includes("option") || h.includes("choice"));
  const answerIdx = header.findIndex(h => h.includes("answer") || h.includes("correct"));
  const explanationIdx = header.findIndex(h => h.includes("explanation") || h.includes("reason") || h.includes("rationale"));

  if (promptIdx === -1) {
    errors.push("CSV header is missing the 'Prompt' or 'Question' column.");
    return { questions, errors };
  }

  for (let r = 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    const rowNum = r + 1;

    const rawType = typeIdx >= 0 ? row[typeIdx] : "multiple_choice";
    const type = normalizeQuestionType(rawType);
    const prompt = (promptIdx >= 0 ? row[promptIdx] : "").trim();
    const rawPoints = pointsIdx >= 0 ? row[pointsIdx] : "1";
    const points = Math.max(1, parseInt(rawPoints, 10) || 1);
    const rawOptions = optionsIdx >= 0 ? row[optionsIdx] : "";
    const rawAnswer = answerIdx >= 0 ? row[answerIdx] : "";
    const explanation = explanationIdx >= 0 ? row[explanationIdx] : "";

    if (!prompt) {
      errors.push(`Row ${rowNum}: Skipped because Question Prompt is empty.`);
      continue;
    }

    let options = parseOptionsField(rawOptions);
    let correctAnswer: string | string[] | boolean = "";

    if (type === "multiple_choice") {
      if (options.length < 2) {
        // Fallback default options if teacher didn't provide enough
        if (options.length === 0) {
          options = ["Option A", "Option B", "Option C", "Option D"];
        } else {
          errors.push(`Row ${rowNum}: Multiple choice question requires at least 2 options.`);
        }
      }

      // Check if answer is letter (A, B, C, D)
      const letterIdx = letterToIndex(rawAnswer);
      if (letterIdx !== null && letterIdx < options.length) {
        correctAnswer = String(letterIdx);
      } else {
        const num = parseInt(rawAnswer, 10);
        if (!isNaN(num)) {
          // If answer is 1-based (e.g. 1, 2, 3, 4) and within bounds
          if (num >= 1 && num <= options.length) {
            correctAnswer = String(num - 1);
          } else if (num >= 0 && num < options.length) {
            correctAnswer = String(num);
          } else {
            correctAnswer = "0";
          }
        } else {
          // Search if rawAnswer matches any option text exactly or closely
          const matchIdx = options.findIndex(o => o.toLowerCase() === rawAnswer.toLowerCase().trim());
          if (matchIdx !== -1) {
            correctAnswer = String(matchIdx);
          } else {
            correctAnswer = "0"; // Default to first option
          }
        }
      }
    } else if (type === "multiple_select") {
      if (options.length < 2) {
        if (options.length === 0) {
          options = ["Choice 1", "Choice 2", "Choice 3", "Choice 4"];
        }
      }

      // Parse comma or pipe separated answers
      const parts = (rawAnswer || "0")
        .split(/[,|;]/)
        .map(p => p.trim())
        .filter(Boolean);

      const indices: string[] = [];
      for (const p of parts) {
        const lIdx = letterToIndex(p);
        if (lIdx !== null && lIdx < options.length) {
          indices.push(String(lIdx));
          continue;
        }
        const num = parseInt(p, 10);
        if (!isNaN(num)) {
          if (num >= 1 && num <= options.length) {
            indices.push(String(num - 1));
          } else if (num >= 0 && num < options.length) {
            indices.push(String(num));
          }
          continue;
        }
        const matchIdx = options.findIndex(o => o.toLowerCase() === p.toLowerCase());
        if (matchIdx !== -1) {
          indices.push(String(matchIdx));
        }
      }

      correctAnswer = indices.length > 0 ? Array.from(new Set(indices)) : ["0"];
    } else if (type === "true_false") {
      options = ["True", "False"];
      const lower = rawAnswer.toLowerCase().trim();
      correctAnswer = lower === "true" || lower === "t" || lower === "1" || lower === "yes";
    } else if (type === "short_answer") {
      options = options.length > 0 ? options : [];
      correctAnswer = rawAnswer.trim();
    } else if (type === "essay") {
      options = [];
      correctAnswer = rawAnswer.trim(); // Can store rubric or guideline
    }

    questions.push({
      id: `q_imp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${r}`,
      prompt,
      type,
      options,
      correctAnswer,
      explanation,
      points
    });
  }

  return { questions, errors };
}

/**
 * Validates and parses raw JSON text or objects into ExamQuestion array
 */
export function parseJSONToQuestions(jsonText: string): { questions: ExamQuestion[]; errors: string[] } {
  const errors: string[] = [];
  const questions: ExamQuestion[] = [];

  if (!jsonText || !jsonText.trim()) {
    errors.push("The provided JSON file or text is empty.");
    return { questions, errors };
  }

  try {
    const parsed = JSON.parse(jsonText);
    const list = Array.isArray(parsed) ? parsed : parsed.questions || [parsed];

    if (!Array.isArray(list) || list.length === 0) {
      errors.push("JSON data must be an array of question objects, or contain a 'questions' array.");
      return { questions, errors };
    }

    list.forEach((item, idx) => {
      const num = idx + 1;
      if (!item || typeof item !== "object") {
        errors.push(`Item ${num}: Invalid question object.`);
        return;
      }

      const prompt = String(item.prompt || item.question || item.title || "").trim();
      if (!prompt) {
        errors.push(`Item ${num}: Missing question prompt.`);
        return;
      }

      const type = normalizeQuestionType(String(item.type || "multiple_choice"));
      const points = Math.max(1, parseInt(String(item.points || item.score || 1), 10) || 1);
      const explanation = String(item.explanation || item.reason || "");
      
      let options: string[] = [];
      if (Array.isArray(item.options)) {
        options = (item.options as any[]).map(String).map((s: string) => s.trim()).filter(Boolean);
      } else if (typeof item.options === "string") {
        options = parseOptionsField(item.options);
      }

      let correctAnswer = item.correctAnswer ?? item.correct_answer ?? item.answer;

      if (type === "multiple_choice") {
        if (options.length < 2) {
          options = options.length === 0 ? ["Option A", "Option B"] : [...options, "Option B"];
        }
        if (typeof correctAnswer === "number") {
          correctAnswer = String(correctAnswer);
        } else if (typeof correctAnswer === "string") {
          const lIdx = letterToIndex(correctAnswer);
          if (lIdx !== null && lIdx < options.length) {
            correctAnswer = String(lIdx);
          } else {
            const matchIdx = options.findIndex(o => o.toLowerCase() === (correctAnswer as string).toLowerCase().trim());
            if (matchIdx !== -1) {
              correctAnswer = String(matchIdx);
            }
          }
        } else {
          correctAnswer = "0";
        }
      } else if (type === "multiple_select") {
        if (options.length < 2) {
          options = ["Choice 1", "Choice 2", "Choice 3"];
        }
        if (Array.isArray(correctAnswer)) {
          correctAnswer = correctAnswer.map(String);
        } else if (typeof correctAnswer === "string") {
          correctAnswer = correctAnswer.split(/[,|;]/).map(s => s.trim()).filter(Boolean);
        } else {
          correctAnswer = ["0"];
        }
      } else if (type === "true_false") {
        options = ["True", "False"];
        if (typeof correctAnswer === "string") {
          const l = correctAnswer.toLowerCase().trim();
          correctAnswer = l === "true" || l === "t" || l === "1" || l === "yes";
        } else {
          correctAnswer = Boolean(correctAnswer);
        }
      } else if (type === "short_answer") {
        correctAnswer = String(correctAnswer || "");
      } else if (type === "essay") {
        options = [];
        correctAnswer = String(correctAnswer || "");
      }

      questions.push({
        id: `q_imp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${idx}`,
        prompt,
        type,
        options,
        correctAnswer,
        explanation,
        points
      });
    });

  } catch (err: any) {
    errors.push(`JSON Syntax Error: ${err.message || "Failed to parse JSON content."}`);
  }

  return { questions, errors };
}
