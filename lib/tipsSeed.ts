import { DeveloperTip } from "@/types/tip";

export const INITIAL_DEVELOPER_TIPS: DeveloperTip[] = [
  {
    id: "tip-py-dict-comprehension",
    title: "Python: Supercharge Data Transformations with Dictionary Comprehensions",
    summary: "Stop writing 5-line for loops just to build a lookup dictionary. Use dictionary comprehensions for clean, fast, and idiomatic Python.",
    language: "python",
    category: "syntax",
    difficulty: "beginner",
    tags: ["python", "clean-code", "collections", "data-structures"],
    badCodeTitle: "Old For-Loop Way",
    badCode: `# Slow, verbose, and imperatively mutated
user_lookup = {}
for user in user_list:
    if user["is_active"]:
        user_lookup[user["id"]] = user["username"]`,
    goodCodeTitle: "Idiomatic Comprehension",
    goodCode: `# Concise, readable, and optimized in CPython bytecode
user_lookup = {
    u["id"]: u["username"] 
    for u in user_list 
    if u["is_active"]
}`,
    explanation: `### Why Dictionary Comprehensions Win
1. **Performance:** Comprehensions execute at C speed inside Python without the bytecode overhead of repeated \`.append()\` or index hashing.
2. **Readability:** Expresses **intent** declaratively: "create a map of active user IDs to usernames" in a single visual block.
3. **Immutability Mindset:** Eliminates the intermediate state of an empty mutable dictionary sitting around waiting to be populated.`,
    whyItMatters: "Standard in every senior Python codebase and interview standard.",
    documentationUrl: "https://docs.python.org/3/tutorial/datastructures.html#dictionaries",
    status: "published",
    isFeatured: true,
    createdAt: "2026-10-30T09:00:00Z",
    updatedAt: "2026-10-30T09:00:00Z",
    authorName: "Staff Tech Lead",
    likesCount: 42,
    viewsCount: 310
  },
  {
    id: "tip-ts-discriminated-unions",
    title: "TypeScript: Type-Safe State with Discriminated Unions",
    summary: "Eliminate impossible UI states by using discriminated unions instead of optional boolean flags like isLoading, error, data.",
    language: "typescript",
    category: "architecture",
    difficulty: "intermediate",
    tags: ["typescript", "type-safety", "react", "architecture"],
    badCodeTitle: "Confusing Multiple Booleans",
    badCode: `// Can be both loading AND have error? Impossible state!
interface RequestState {
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  data?: UserProfile;
}`,
    goodCodeTitle: "Exhaustive Discriminated Union",
    goodCode: `// Only one state can exist at a time!
type RequestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: UserProfile }
  | { status: "error"; message: string };

function renderUI(state: RequestState) {
  switch (state.status) {
    case "success": return state.data.fullName; // data is 100% defined!
    case "error": return state.message;         // message is 100% defined!
    default: return "Please wait...";
  }
}`,
    explanation: `### Eliminate Impossible States
When you have multiple boolean flags (\`isLoading\`, \`isSuccess\`, \`isError\`), there are 2^3 = 8 possible permutations, 5 of which are completely invalid (e.g. \`isLoading: true\` and \`isSuccess: true\`).

Using a **discriminated union** (sharing a literal \`status\` property) instructs TypeScript's compiler to narrow types automatically. Inside \`case "success"\`, TypeScript knows with 100% mathematical certainty that \`data\` exists without needing optional chaining (\`state.data?.name\`).`,
    whyItMatters: "Prevents runtime 'Cannot read properties of undefined' crashes in React/Next.js.",
    documentationUrl: "https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions",
    status: "published",
    isFeatured: false,
    createdAt: "2026-10-30T09:10:00Z",
    updatedAt: "2026-10-30T09:10:00Z",
    authorName: "Frontend Architect",
    likesCount: 38,
    viewsCount: 285
  },
  {
    id: "tip-cleancode-guard-clauses",
    title: "Clean Code: Flatten Nested IFs with Early Return Guard Clauses",
    summary: "Avoid the 'Arrow Anti-Pattern' of deeply nested if-statements. Return early to keep your happy path unindented and readable.",
    language: "cleancode",
    category: "best-practices",
    difficulty: "beginner",
    tags: ["clean-code", "refactoring", "readability", "design"],
    badCodeTitle: "The Pyramid of Doom (Nested Ifs)",
    badCode: `function registerStudent(student) {
  if (student != null) {
    if (student.email.includes("@")) {
      if (student.age >= 18) {
        // Deeply nested business logic
        saveToDatabase(student);
        sendWelcomeEmail(student);
      }
    }
  }
}`,
    goodCodeTitle: "Flat Guard Clauses (Early Return)",
    goodCode: `function registerStudent(student) {
  if (!student) return;
  if (!student.email.includes("@")) throw new Error("Invalid email");
  if (student.age < 18) throw new Error("Must be 18+");

  // Happy path stays at root indentation level!
  saveToDatabase(student);
  sendWelcomeEmail(student);
}`,
    explanation: `### The Bouncer Pattern
Guard clauses act like a bouncer at a club entrance:
1. Check edge cases and failures at the very top.
2. Exit immediately with \`return\` or \`throw\`.
3. Leave the main happy path execution code clean, flat, and at the zero-indentation level.

This reduces cognitive load when reading functions because developers don't have to mentally track 4 open curly braces.`,
    whyItMatters: "Drastically lowers cyclomatic complexity and simplifies code reviews.",
    status: "published",
    isFeatured: true,
    createdAt: "2026-10-30T09:15:00Z",
    updatedAt: "2026-10-30T09:15:00Z",
    authorName: "Staff Engineer",
    likesCount: 56,
    viewsCount: 420
  },
  {
    id: "tip-git-undo-commit",
    title: "Git: Undo the Last Commit Without Losing Any of Your Code",
    summary: "Accidentally committed before testing, or forgot to add a file? Undo the commit while keeping all your modified files in your staging area.",
    language: "git",
    category: "tooling",
    difficulty: "beginner",
    tags: ["git", "terminal", "workflow", "productivity"],
    badCodeTitle: "Destructive Reset (Loses Work!)",
    badCode: `# DANGER: Destroys uncommitted changes and modified files!
git reset --hard HEAD~1`,
    goodCodeTitle: "Soft Reset (Safe & Reversible)",
    goodCode: `# Keeps all your code staged and ready to re-commit!
git reset --soft HEAD~1

# Or to simply add forgotten files to the last commit:
git add forgotten_file.ts
git commit --amend --no-edit`,
    explanation: `### What Happens Under the Hood
* \`HEAD~1\` moves the current branch pointer back by one commit.
* \`--soft\` leaves your **working directory** and **staging index (git cache)** completely intact!
* All your modified files will be staged in green (\`git status\`), allowing you to edit them or commit with a new message.`,
    whyItMatters: "Saves hours of frantic panic when you make an accidental or incomplete commit.",
    documentationUrl: "https://git-scm.com/docs/git-reset",
    status: "published",
    isFeatured: false,
    createdAt: "2026-10-30T09:20:00Z",
    updatedAt: "2026-10-30T09:20:00Z",
    authorName: "DevOps Engineer",
    likesCount: 49,
    viewsCount: 380
  },
  {
    id: "tip-dart-pattern-matching",
    title: "Dart 3: Powerful Destructuring & Switch Expressions",
    summary: "Take full advantage of Dart 3's exhaustive switch expressions and record destructuring to write concise, bug-free Flutter logic.",
    language: "dart",
    category: "syntax",
    difficulty: "intermediate",
    tags: ["dart", "flutter", "pattern-matching", "modern-dart"],
    badCodeTitle: "Verbose If-Else Cascades",
    badCode: `String getStatusBadge(ExamStatus status) {
  if (status == ExamStatus.inProgress) {
    return '🟡 Active Exam';
  } else if (status == ExamStatus.submitted) {
    return '🟢 Submitted';
  } else if (status == ExamStatus.graded) {
    return '🏆 Graded';
  }
  return '⚪ Unknown';
}`,
    goodCodeTitle: "Exhaustive Switch Expression",
    goodCode: `// Concise, expression-based, and compiler-verified!
String getStatusBadge(ExamStatus status) => switch (status) {
  ExamStatus.inProgress => '🟡 Active Exam',
  ExamStatus.submitted  => '🟢 Submitted',
  ExamStatus.graded     => '🏆 Graded',
};`,
    explanation: `### Why Switch Expressions in Dart 3 Rule
1. **Exhaustiveness Checking:** If you add a new enum value (e.g. \`ExamStatus.disqualified\`), the Dart compiler will immediately trigger a build error if you forget to handle it!
2. **Arrow Function Ready:** Because it's an expression rather than a statement, you can assign it directly to variables or return it with \`=>\`.`,
    whyItMatters: "Crucial for writing idiomatic, high-performance Flutter apps and state reducers.",
    documentationUrl: "https://dart.dev/language/branches#switch-expressions",
    status: "published",
    isFeatured: false,
    createdAt: "2026-10-30T09:25:00Z",
    updatedAt: "2026-10-30T09:25:00Z",
    authorName: "Mobile Lead",
    likesCount: 31,
    viewsCount: 190
  },
  {
    id: "tip-sql-indexing-nplusone",
    title: "SQL & Backend: Avoid the Deadly N+1 Query Trap",
    summary: "Fetching items in a loop fires hundreds of database queries. Use SQL JOINs or eager loading to fetch everything in 1 optimized roundtrip.",
    language: "sql",
    category: "performance",
    difficulty: "intermediate",
    tags: ["sql", "database", "backend", "performance"],
    badCodeTitle: "The N+1 Query Anti-Pattern",
    badCode: `-- 1 query to get 50 students
SELECT * FROM students WHERE level = 'Level 4';

-- Then 50 separate queries executed in a programming loop!
SELECT * FROM exam_attempts WHERE student_id = 'stu_1';
SELECT * FROM exam_attempts WHERE student_id = 'stu_2';
...
-- Total: 51 queries over the network!`,
    goodCodeTitle: "Single Efficient Joined Query",
    goodCode: `-- 1 single roundtrip query with an index
SELECT 
  s.id AS student_id,
  s.full_name,
  a.score,
  a.percentage
FROM students s
LEFT JOIN exam_attempts a ON a.student_id = s.id
WHERE s.level = 'Level 4';`,
    explanation: `### Network Roundtrips Are Expensive
Database queries are limited by network latency. If each query takes 20ms:
* **N+1 Approach:** 1 + 50 queries = 51 × 20ms = **1,020ms (over 1 second!)**.
* **Single Joined Query:** 1 × 20ms = **20ms (50x faster!)**.

Always batch IDs using \`WHERE id IN (...)\` or perform a relational \`JOIN\`.`,
    whyItMatters: "The #1 reason production database servers slow down under user traffic.",
    status: "published",
    isFeatured: false,
    createdAt: "2026-10-30T09:30:00Z",
    updatedAt: "2026-10-30T09:30:00Z",
    authorName: "Database Administrator",
    likesCount: 65,
    viewsCount: 512
  },
  {
    id: "tip-js-structured-clone",
    title: "JavaScript: Deep Clone Objects Safely with structuredClone()",
    summary: "Stop using JSON.parse(JSON.stringify(obj)) to clone objects. The built-in structuredClone() handles Dates, Maps, Sets, and circular references.",
    language: "javascript",
    category: "syntax",
    difficulty: "beginner",
    tags: ["javascript", "web-standards", "data", "es2022"],
    badCodeTitle: "The Old JSON Hack (Breaks Dates & Sets)",
    badCode: `const original = {
  createdAt: new Date(),
  tags: new Set(["react", "vite"]),
};

// BUG: Dates turn into strings! Sets turn into empty objects!
const copy = JSON.parse(JSON.stringify(original));`,
    goodCodeTitle: "Modern Native structuredClone()",
    goodCode: `const original = {
  createdAt: new Date(),
  tags: new Set(["react", "vite"]),
};

// Safe, preserves native types, handles circular references
const copy = structuredClone(original);`,
    explanation: `### Why JSON.parse(JSON.stringify) is dangerous
* Dates lose their \`.toISOString()\` and become raw strings.
* \`undefined\`, \`NaN\`, \`Infinity\`, and \`Symbol\` are silently dropped.
* \`Map\` and \`Set\` turn into empty objects \`{}\`.
* Throws an error on circular references.

\`structuredClone()\` is supported in all modern browsers and Node.js 17+.`,
    whyItMatters: "Eliminates silent data corruption when copying objects in state management.",
    documentationUrl: "https://developer.mozilla.org/en-US/docs/Web/API/structuredClone",
    status: "published",
    isFeatured: false,
    createdAt: "2026-10-30T09:35:00Z",
    updatedAt: "2026-10-30T09:35:00Z",
    authorName: "Web Standards Advocate",
    likesCount: 44,
    viewsCount: 360
  },
  {
    id: "tip-rust-match-option",
    title: "Rust: Safe Null-Handling with Option & if-let Expressions",
    summary: "Rust has no null or undefined pointer exceptions. Master pattern matching on Option<T> for bulletproof error-free code.",
    language: "rust",
    category: "architecture",
    difficulty: "pro",
    tags: ["rust", "memory-safety", "pattern-matching", "systems"],
    badCodeTitle: "Dangerous Unwrapping (Panics at Runtime)",
    badCode: `// Will crash the application if student_id was None!
let student = find_student("STU_99").unwrap();
println!("Name: {}", student.name);`,
    goodCodeTitle: "Safe Pattern Matching with if-let",
    goodCode: `// Graceful, memory-safe, and zero runtime crashes
if let Some(student) = find_student("STU_99") {
    println!("Found student: {}", student.name);
} else {
    eprintln!("Student not found in registry.");
}`,
    explanation: `### Tony Hoare's 'Billion-Dollar Mistake' Solved
In languages with null pointers, any object can unexpectedly be null at runtime.
Rust completely replaces null with the algebraic enum:
\`\`\`rust
enum Option<T> {
    Some(T),
    None,
}
\`\`\`
The compiler physically refuses to compile your code unless you handle both the \`Some\` and \`None\` possibilities.`,
    whyItMatters: "Guarantees zero null-pointer exceptions in production software.",
    documentationUrl: "https://doc.rust-lang.org/book/ch06-02-match.html",
    status: "published",
    isFeatured: false,
    createdAt: "2026-10-30T09:40:00Z",
    updatedAt: "2026-10-30T09:40:00Z",
    authorName: "Systems Programmer",
    likesCount: 39,
    viewsCount: 240
  }
];
