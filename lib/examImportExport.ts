import { ExamQuestion, QuestionType } from "@/types/exam";

/**
 * Plain Text / Markdown Template - optimized for humans and AI generators (ChatGPT, Claude, Gemini)
 */
export const PLAIN_TEXT_EXAM_TEMPLATE = `1. What is the primary function of an operating system's kernel?
A) Manages hardware resources, CPU scheduling, and memory allocation
B) Provides graphical design tools for digital artists
C) Directly compiles high-level code to source text
D) Formats external flash drives automatically
Answer: A
Points: 2
Explanation: The kernel is the core component that manages system hardware, CPU, and memory allocation.

2. Which of the following are primary renewable energy sources? (Select all that apply)
A) Solar photovoltaic
B) Bituminous coal
C) Wind turbine power
D) Natural gas
E) Hydroelectric power
Answer: A, C, E
Points: 3
Explanation: Solar, wind, and hydroelectric are non-depleting renewable energy sources.

3. True or False: In modern web architecture, HTTPS encrypts all network communication using TLS.
Answer: True
Points: 1
Explanation: Transport Layer Security (TLS) encrypts all HTTP requests and responses.

4. What unit is used to measure electrical frequency in the International System of Units (SI)?
Type: Short Answer
Answer: Hertz
Points: 2
Explanation: Electrical frequency is measured in Hertz (Hz), representing cycles per second.

5. Explain the fundamental differences between synchronous and asynchronous program execution with an everyday analogy.
Type: Essay
Points: 5
Explanation: Synchronous halts subsequent operations until the current one finishes; asynchronous allows tasks to execute concurrently without blocking the main thread.

6. Complete the recursive function to compute the factorial of n:
Type: Code Completion
Language: python
\`\`\`python
def factorial(n):
    if n <= 1:
        return ___1___
    return n * factorial(___2___)
\`\`\`
Blank 1: 1
Blank 2: n - 1
Points: 3
Explanation: Base case returns 1, while recursive step multiplies n by factorial(n - 1).

7. Reorder the following scrambled lines into a valid function that finds the maximum value in an array:
Type: Code Ordering
Language: javascript
\`\`\`javascript
function findMax(arr) {
    let max = arr[0];
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] > max) max = arr[i];
    }
    return max;
}
\`\`\`
Points: 4
Explanation: Initializes max with first element, iterates through remaining elements, and returns max.

8. What will be printed to standard output when this code executes?
Type: Predict Output
Language: python
\`\`\`python
nums = [1, 2, 3, 4]
res = [x * 2 for x in nums if x % 2 == 0]
print(res)
\`\`\`
Answer: [4, 8]
Points: 2
Explanation: Only 2 and 4 are even. Multiplying each by 2 yields [4, 8].
`;

/**
 * Copyable AI Prompt template for teachers to generate questions in ChatGPT, Claude, Gemini, etc.
 */
export const AI_GENERATION_PROMPT = `Act as an expert technical instructor. Generate [NUMBER, e.g. 5 or 10] exam questions on the topic "[INSERT YOUR TOPIC HERE]" for my students.

Cover a balanced mix of:
- Multiple choice (single correct answer)
- Multiple select checkboxes (select all that apply)
- True / False
- Short answer (keyword or short phrase)
- Essay / open-ended explanation
- Code Completion (fill in the blanks using ___1___, ___2___)
- Code Ordering (scrambled code / Parson's puzzle with lines in correct order)
- Predict Output (provide code snippet and target printed stdout)

Strictly format every question using this clean plain-text standard so it can be automatically imported into our assessment engine:

1. [Question text here]
A) [Option 1]
B) [Option 2]
C) [Option 3]
D) [Option 4]
Answer: A
Points: 2
Explanation: [Brief rationale for the correct answer]

2. [Multi-select question prompt] (Select all that apply)
A) [Choice 1]
B) [Choice 2]
C) [Choice 3]
D) [Choice 4]
Answer: A, C
Points: 3
Explanation: [Brief explanation]

3. True or False: [Statement here]
Answer: True
Points: 1
Explanation: [Brief explanation]

4. [Short answer question prompt]
Type: Short Answer
Answer: [Expected short answer phrase or keyword]
Points: 2
Explanation: [Brief explanation]

5. [Essay question prompt]
Type: Essay
Points: 5
Explanation: [Grading rubric or evaluation guidelines for the instructor]

6. [Code completion question prompt]
Type: Code Completion
Language: [python / javascript / typescript / java / c / cpp]
\`\`\`[language]
[Code snippet containing inline blanks like ___1___ and ___2___]
\`\`\`
Blank 1: [Accepted answer for blank 1]
Blank 2: [Accepted answer for blank 2]
Points: 3
Explanation: [Explanation of the missing code tokens]

7. [Code ordering question prompt, e.g. 'Arrange the lines to implement...']
Type: Code Ordering
Language: [language]
\`\`\`[language]
[Write the complete code lines here in their CORRECT sequential order]
\`\`\`
Points: 4
Explanation: [Explanation of algorithmic sequence]

8. [Predict output question prompt, e.g. 'What will be printed to standard output?']
Type: Predict Output
Language: [language]
\`\`\`[language]
[Code snippet to execute]
\`\`\`
Answer: [Expected terminal stdout text]
Points: 2
Explanation: [Step-by-step trace of the execution]
`;

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
 * Downloads the starter Plain Text / AI friendly template
 */
export function downloadExamTemplatePlainText(): void {
  triggerBrowserDownload(
    "exam_questions_template.txt",
    PLAIN_TEXT_EXAM_TEMPLATE,
    "text/plain;charset=utf-8;"
  );
}

/**
 * Copies the AI prompt to user clipboard
 */
export async function copyAIPromptToClipboard(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(AI_GENERATION_PROMPT);
    return true;
  } catch (e) {
    console.error("Clipboard copy failed:", e);
    return false;
  }
}

/**
 * Exports existing questions as clean Plain Text / Markdown
 */
export function exportExamQuestionsToPlainText(questions: ExamQuestion[], examTitle: string): void {
  const blocks: string[] = [];

  questions.forEach((q, idx) => {
    let block = `${idx + 1}. ${q.prompt}\n`;
    
    if (q.type === "multiple_choice" || q.type === "multiple_select") {
      (q.options || []).forEach((opt, oIdx) => {
        const letter = String.fromCharCode(65 + oIdx);
        block += `${letter}) ${opt}\n`;
      });
      
      if (Array.isArray(q.correctAnswer)) {
        const letters = q.correctAnswer.map(ans => {
          const num = parseInt(ans, 10);
          return !isNaN(num) && num < 26 ? String.fromCharCode(65 + num) : ans;
        });
        block += `Answer: ${letters.join(", ")}\n`;
      } else {
        const num = parseInt(String(q.correctAnswer), 10);
        const letter = !isNaN(num) && num < 26 ? String.fromCharCode(65 + num) : String(q.correctAnswer);
        block += `Answer: ${letter}\n`;
      }
    } else if (q.type === "true_false") {
      block += `Answer: ${q.correctAnswer ? "True" : "False"}\n`;
    } else if (q.type === "short_answer") {
      block += `Type: Short Answer\n`;
      block += `Answer: ${q.correctAnswer || ""}\n`;
    } else if (q.type === "essay") {
      block += `Type: Essay\n`;
      if (q.correctAnswer) block += `Answer: ${q.correctAnswer}\n`;
    } else if (q.type === "code_completion") {
      block += `Type: Code Completion\n`;
      if (q.codeLanguage) block += `Language: ${q.codeLanguage}\n`;
      if (q.codeSnippet) {
        block += `\`\`\`${q.codeLanguage || ""}\n${q.codeSnippet}\n\`\`\`\n`;
      }
      if (q.codeBlanks && q.codeBlanks.length > 0) {
        q.codeBlanks.forEach(b => {
          block += `Blank ${b.id}: ${b.acceptedAnswers.join(", ")}\n`;
        });
      }
    } else if (q.type === "code_ordering") {
      block += `Type: Code Ordering\n`;
      if (q.codeLanguage) block += `Language: ${q.codeLanguage}\n`;
      if (Array.isArray(q.codeLines) && q.codeLines.length > 0) {
        block += `\`\`\`${q.codeLanguage || ""}\n${q.codeLines.join("\n")}\n\`\`\`\n`;
      }
    } else if (q.type === "predict_output") {
      block += `Type: Predict Output\n`;
      if (q.codeLanguage) block += `Language: ${q.codeLanguage}\n`;
      if (q.codeSnippet) {
        block += `\`\`\`${q.codeLanguage || ""}\n${q.codeSnippet}\n\`\`\`\n`;
      }
      block += `Answer: ${q.correctAnswer || ""}\n`;
    }

    block += `Points: ${q.points}\n`;
    if (q.explanation) {
      block += `Explanation: ${q.explanation}\n`;
    }

    blocks.push(block.trim());
  });

  const safeName = (examTitle || "questions").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  triggerBrowserDownload(`${safeName}_export.txt`, blocks.join("\n\n"), "text/plain;charset=utf-8;");
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
  if (clean.includes("completion") || clean.includes("fill_code") || clean.includes("blank") || clean === "code_completion") {
    return "code_completion";
  }
  if (clean.includes("ordering") || clean.includes("parson") || clean.includes("scramble") || clean === "code_ordering") {
    return "code_ordering";
  }
  if (clean.includes("predict") || clean.includes("output") || clean.includes("stdout") || clean === "predict_output") {
    return "predict_output";
  }
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
      } else if (type === "essay" || type === "predict_output") {
        options = [];
        correctAnswer = String(correctAnswer || "");
      } else if (type === "code_ordering") {
        options = [];
        if (Array.isArray(correctAnswer)) {
          correctAnswer = correctAnswer.map(String);
        }
      }

      questions.push({
        id: `q_imp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${idx}`,
        prompt,
        type,
        options,
        correctAnswer,
        explanation,
        points,
        codeSnippet: item.codeSnippet || item.code_snippet,
        codeLanguage: item.codeLanguage || item.code_language,
        codeBlanks: item.codeBlanks || item.code_blanks,
        codeLines: item.codeLines || item.code_lines
      });
    });

  } catch (err: any) {
    errors.push(`JSON Syntax Error: ${err.message || "Failed to parse JSON content."}`);
  }

  return { questions, errors };
}

/**
 * Parses natural Plain Text or Markdown into structured ExamQuestion objects.
 * Designed to seamlessly parse outputs from ChatGPT, Claude, Gemini, DeepSeek, and human teachers.
 */
export function parsePlainTextToQuestions(text: string): { questions: ExamQuestion[]; errors: string[] } {
  const errors: string[] = [];
  const questions: ExamQuestion[] = [];

  if (!text || !text.trim()) {
    errors.push("The text content is empty.");
    return { questions, errors };
  }

  // Normalize line endings
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const lines = normalized.split("\n");
  const rawBlocks: string[][] = [];
  let currentBlock: string[] = [];

  // Matches start of a question block, e.g.:
  // "1. ", "1) ", "Q1: ", "Q.1: ", "Question 1: ", "Question 1. ", "# 1. "
  const qStartRegex = /^(?:#+\s*)?(?:Question\s+|Q\.?\s*)?(\d+)[\.\)\:\-]\s+(.+)$/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentBlock.length > 0) {
        currentBlock.push(line);
      }
      continue;
    }

    if (qStartRegex.test(trimmed)) {
      if (currentBlock.some(l => l.trim().length > 0)) {
        rawBlocks.push(currentBlock);
      }
      currentBlock = [line];
    } else {
      currentBlock.push(line);
    }
  }

  if (currentBlock.some(l => l.trim().length > 0)) {
    rawBlocks.push(currentBlock);
  }

  // Fallback: If no numbered question headers were found, split by double newlines
  if (rawBlocks.length === 0) {
    const doubleNewlineBlocks = normalized.split(/\n\s*\n/).filter(b => b.trim().length > 0);
    for (const b of doubleNewlineBlocks) {
      rawBlocks.push(b.split("\n"));
    }
  }

  rawBlocks.forEach((blockLines, idx) => {
    const blockNum = idx + 1;
    let rawPrompt = "";
    let options: string[] = [];
    let checkedCheckboxIndices: string[] = [];
    let rawAnswer = "";
    let rawPoints: number | null = null;
    let explanation = "";
    let explicitType: QuestionType | null = null;

    let detectedCodeSnippet = "";
    let detectedCodeLanguage = "typescript";
    let detectedCodeBlanks: { id: string; acceptedAnswers: string[] }[] = [];
    let insideCodeFence = false;
    let codeFenceLines: string[] = [];

    let parsingState: "prompt" | "options" | "explanation" = "prompt";

    for (let li = 0; li < blockLines.length; li++) {
      const line = blockLines[li];
      const trimmed = line.trim();

      // Check for code fences (```python ... ```)
      if (trimmed.startsWith("```")) {
        if (!insideCodeFence) {
          insideCodeFence = true;
          const lang = trimmed.replace(/^```/, "").trim();
          if (lang) detectedCodeLanguage = lang;
          codeFenceLines = [];
        } else {
          insideCodeFence = false;
          detectedCodeSnippet = codeFenceLines.join("\n");
        }
        continue;
      }

      if (insideCodeFence) {
        codeFenceLines.push(line);
        continue;
      }

      if (!trimmed) continue;

      // Check for Points line: e.g. "Points: 2", "Marks: 3", "2 Points", "Score: 1"
      const pointsMatch = trimmed.match(/^(?:Points|Marks|Mark|Score|Pts)\s*[:\-]\s*(\d+)/i) ||
                          trimmed.match(/^(\d+)\s*(?:points|marks|pts)\b/i);
      if (pointsMatch) {
        rawPoints = parseInt(pointsMatch[1], 10);
        continue;
      }

      // Check for Language line: e.g. "Language: python"
      const langMatch = trimmed.match(/^(?:Language|Lang)\s*[:\-]\s*(.+)$/i);
      if (langMatch) {
        detectedCodeLanguage = langMatch[1].trim();
        continue;
      }

      // Check for Type line: e.g. "Type: Multiple Choice", "Type: Code Completion"
      const typeMatch = trimmed.match(/^(?:Type|Format)\s*[:\-]\s*(.+)$/i);
      if (typeMatch) {
        explicitType = normalizeQuestionType(typeMatch[1]);
        continue;
      }

      // Check for Answer line: e.g. "Answer: A", "Correct Answer: True", "Correct: B, C", "Ans: Hertz"
      const answerMatch = trimmed.match(/^(?:Correct\s+Answer|Answer|Ans|Correct|Key|Answer\s+Key)\s*[:\-]\s*(.+)$/i);
      if (answerMatch) {
        rawAnswer = answerMatch[1].trim();
        parsingState = "prompt";
        continue;
      }

      // Check for Blank line for code completion: e.g. "Blank 1: return", "Blank 2: n - 1"
      const blankMatch = trimmed.match(/^(?:Blank\s+)?\[?(\w+)\]?\s*[:\-]\s*(.+)$/i);
      if (blankMatch && (explicitType === "code_completion" || trimmed.toLowerCase().startsWith("blank"))) {
        const bId = blankMatch[1];
        const answers = blankMatch[2].split(/[,|]/).map(a => a.trim()).filter(Boolean);
        if (answers.length > 0) {
          detectedCodeBlanks.push({ id: bId, acceptedAnswers: answers });
          continue;
        }
      }

      // Check for Explanation line: e.g. "Explanation: ...", "Rationale: ..."
      const explMatch = trimmed.match(/^(?:Explanation|Rationale|Reason|Feedback|Note)\s*[:\-]\s*(.*)$/i);
      if (explMatch) {
        explanation = explMatch[1].trim();
        parsingState = "explanation";
        continue;
      }

      if (parsingState === "explanation") {
        explanation += (explanation ? " " : "") + trimmed;
        continue;
      }

      // Check for Option line:
      // A) Option text, A. Option text, (A) Option text, a) Option text, [ ] text, [x] text
      const optionMatch = trimmed.match(/^(?:\(?([A-Z0-9])\)|\(?([A-Z0-9])\.)\s+(.+)$/i) ||
                          trimmed.match(/^\[([ xX])\]\s+(.+)$/i);

      if (optionMatch) {
        parsingState = "options";
        if (optionMatch[1] && [" ", "x", "X"].includes(optionMatch[1])) {
          // Checkbox syntax: [ ] or [x]
          const isChecked = optionMatch[1].toLowerCase() === "x";
          const optText = optionMatch[2].trim();
          if (isChecked) {
            checkedCheckboxIndices.push(String(options.length));
          }
          options.push(optText);
        } else {
          // Letter or number syntax: A) ...
          const optText = (optionMatch[3] || optionMatch[2] || "").trim();
          options.push(optText);
        }
        continue;
      }

      // If we haven't seen options yet, this line is part of the question prompt
      if (parsingState === "prompt") {
        if (!rawPrompt) {
          // Strip leading question numbers from prompt: "1. What is ..." -> "What is ..."
          const cleanPrompt = trimmed.replace(/^(?:#+\s*)?(?:Question\s+|Q\.?\s*)?\d+[\.\)\:\-]\s*/i, "");
          rawPrompt = cleanPrompt;
        } else {
          rawPrompt += " " + trimmed;
        }
      }
    }

    if (!rawPrompt && !detectedCodeSnippet) {
      return; // Skip empty block
    }

    // Check if prompt contains bracketed points: e.g. "What is CPU? [2 points]" or "(3 pts)"
    const embeddedPoints = rawPrompt.match(/[\(\[]\s*(\d+)\s*(?:points|pts|marks)\s*[\)\]]/i);
    if (embeddedPoints && rawPoints === null) {
      rawPoints = parseInt(embeddedPoints[1], 10);
      rawPrompt = rawPrompt.replace(embeddedPoints[0], "").trim();
    }

    const points = Math.max(1, rawPoints || (explicitType === "essay" ? 5 : 2));

    // Determine Question Type
    let type: QuestionType = explicitType || "multiple_choice";

    if (!explicitType) {
      const lowerPrompt = rawPrompt.toLowerCase();
      const lowerAnswer = rawAnswer.toLowerCase();

      if (detectedCodeSnippet) {
        if (lowerPrompt.includes("ordering") || lowerPrompt.includes("reorder") || lowerPrompt.includes("arrange")) {
          type = "code_ordering";
        } else if (lowerPrompt.includes("predict") || lowerPrompt.includes("output") || lowerPrompt.includes("printed")) {
          type = "predict_output";
        } else if (detectedCodeBlanks.length > 0 || /(___\w+___|\{\{\w+\}\})/.test(detectedCodeSnippet)) {
          type = "code_completion";
        } else if (options.length >= 2) {
          type = "multiple_choice";
        } else {
          type = "essay";
        }
      } else if (lowerPrompt.includes("true or false") || lowerPrompt.includes("[true/false]") || lowerAnswer === "true" || lowerAnswer === "false") {
        type = "true_false";
      } else if (lowerPrompt.includes("select all") || lowerPrompt.includes("multiple select") || lowerPrompt.includes("checkbox") || checkedCheckboxIndices.length > 0 || (rawAnswer.includes(",") && options.length > 0)) {
        type = "multiple_select";
      } else if (options.length >= 2) {
        type = "multiple_choice";
      } else if (lowerPrompt.includes("essay") || lowerPrompt.includes("explain in detail") || lowerPrompt.includes("describe in detail") || points >= 5) {
        type = "essay";
      } else {
        type = "short_answer";
      }
    }

    // Resolve Correct Answer based on type
    let correctAnswer: any = "";
    let codeLines: string[] | undefined = undefined;

    if (type === "multiple_choice") {
      if (options.length < 2) {
        options = ["Option A", "Option B", "Option C", "Option D"];
      }

      const letterIdx = letterToIndex(rawAnswer);
      if (letterIdx !== null && letterIdx < options.length) {
        correctAnswer = String(letterIdx);
      } else {
        const num = parseInt(rawAnswer, 10);
        if (!isNaN(num)) {
          if (num >= 1 && num <= options.length) {
            correctAnswer = String(num - 1);
          } else if (num >= 0 && num < options.length) {
            correctAnswer = String(num);
          } else {
            correctAnswer = "0";
          }
        } else {
          const matchIdx = options.findIndex(o => o.toLowerCase() === rawAnswer.toLowerCase().trim());
          correctAnswer = matchIdx !== -1 ? String(matchIdx) : "0";
        }
      }
    } else if (type === "multiple_select") {
      if (options.length < 2) {
        options = ["Choice 1", "Choice 2", "Choice 3", "Choice 4"];
      }

      if (checkedCheckboxIndices.length > 0) {
        correctAnswer = checkedCheckboxIndices;
      } else {
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
      }
    } else if (type === "true_false") {
      options = ["True", "False"];
      const lower = rawAnswer.toLowerCase().trim();
      correctAnswer = lower === "true" || lower === "t" || lower === "1" || lower === "yes";
    } else if (type === "short_answer") {
      correctAnswer = rawAnswer.trim();
    } else if (type === "essay") {
      options = [];
      correctAnswer = rawAnswer.trim();
    } else if (type === "code_completion") {
      options = [];
      const blanksObj: Record<string, string> = {};
      if (detectedCodeBlanks.length > 0) {
        detectedCodeBlanks.forEach(b => {
          blanksObj[b.id] = b.acceptedAnswers[0] || "";
        });
      } else if (rawAnswer) {
        const parts = rawAnswer.split(/[,|]/).map(p => p.trim()).filter(Boolean);
        parts.forEach((p, pIdx) => {
          const bId = String(pIdx + 1);
          blanksObj[bId] = p;
          detectedCodeBlanks.push({ id: bId, acceptedAnswers: [p] });
        });
      }
      correctAnswer = blanksObj;
    } else if (type === "code_ordering") {
      options = [];
      if (detectedCodeSnippet) {
        codeLines = detectedCodeSnippet.split("\n").filter(l => l.trim().length > 0);
      }
      correctAnswer = codeLines || [];
    } else if (type === "predict_output") {
      options = [];
      correctAnswer = rawAnswer.trim();
    }

    questions.push({
      id: `q_txt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${blockNum}`,
      prompt: rawPrompt,
      type,
      options,
      correctAnswer,
      explanation,
      points,
      codeSnippet: detectedCodeSnippet || undefined,
      codeLanguage: detectedCodeLanguage || undefined,
      codeBlanks: detectedCodeBlanks.length > 0 ? detectedCodeBlanks : undefined,
      codeLines: codeLines || undefined
    });
  });

  if (questions.length === 0) {
    errors.push("Could not find any recognizable questions in the text. Make sure questions start with a number (e.g. '1. What is...') followed by options (A, B...) or answers.");
  }

  return { questions, errors };
}

/**
 * Automatically inspects the raw text and parses it using the best matching format
 */
export function autoDetectAndParseQuestions(
  text: string, 
  filenameHint?: string, 
  forcedFormat?: "auto" | "plain_text" | "csv" | "json"
): { questions: ExamQuestion[]; errors: string[]; detectedFormat: "plain_text" | "csv" | "json" } {
  const trimmed = text.trim();
  let format: "plain_text" | "csv" | "json" = "plain_text";

  if (forcedFormat && forcedFormat !== "auto") {
    format = forcedFormat;
  } else if (trimmed.startsWith("[") || trimmed.startsWith("{") || filenameHint?.endsWith(".json")) {
    format = "json";
  } else if (filenameHint?.endsWith(".csv")) {
    format = "csv";
  } else {
    // Check if first line has CSV headers like "type,prompt" or "prompt,points"
    const firstLine = trimmed.split("\n")[0].toLowerCase();
    if (
      firstLine.includes("type,") || 
      firstLine.includes("prompt,") || 
      firstLine.includes(",options,") || 
      firstLine.includes(",correct_answer") ||
      (firstLine.includes(",") && firstLine.includes("answer") && !firstLine.startsWith("1."))
    ) {
      format = "csv";
    } else {
      format = "plain_text";
    }
  }

  if (format === "json") {
    const res = parseJSONToQuestions(text);
    return { ...res, detectedFormat: "json" };
  } else if (format === "csv") {
    const res = parseCSVToQuestions(text);
    return { ...res, detectedFormat: "csv" };
  } else {
    const res = parsePlainTextToQuestions(text);
    return { ...res, detectedFormat: "plain_text" };
  }
}

