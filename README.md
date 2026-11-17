# Syllabus Engine

A high-contrast, monochrome bento learning management, syllabus delivery, assignment, and proctored examination platform built with **Next.js 16**, **React 19**, **Tailwind CSS v4**, and **Firebase**.

---

## Vision

To provide technical and vocational education programs (TVET / Software Development cohorts) with a fast, distraction-free, offline-resilient digital classroom where curriculum notes, hands-on coding assignments, group collaboration, and proctored assessments live in one unified workspace.

---

## Objectives

1. **Structured Curriculum Delivery:** Present 5-level course syllabi (Course -> Learning Outcomes -> Indicative Content -> Topics -> Subtopics) in both presentation **Slide Deck** and **Page View** modes, with interactive code playgrounds and AI-assisted concept explanations.
2. **Accountable Assignment Workflows:** Enable students to submit work, edit submissions before deadlines, and request/receive per-student deadline extensions approved by their instructor.
3. **Secure, Fair Examinations:** Support timed quizzes and formal exams with random question-bank draws, scheduled open/close windows, anti-cheat focus & screenshot shields, auto-grading, and manual teacher review.
4. **Low-Latency & Quota-Efficient Performance:** Minimize unnecessary Firestore reads/writes using persistent multi-tab local caching, student-scoped queries, event-driven presence tracking, and local exam session recovery.
5. **Clear Visual Hierarchy:** Use a monochrome charcoal (`#141416` / `#1C1C1F`) and off-white (`#EAEAE6`) bento interface paired with intuitive **green** (constructive/submit/approve) and **red** (destructive/warning/logout) action buttons.

---

## Key Features

### 1. Interactive Course Syllabi & Viewer (`/syllabus/view`)
- **5-Level Hierarchy Outline:** Searchable sidebar tree with completion progress tracking.
- **Dual Reading Modes:** Switch between **Slide Deck** (keyboard arrow navigation) and **Page View** (continuous document).
- **Interactive Learning Tools:** Inline **Sandpack** live code playground, term citations drawer, image lightbox zoom, spaced-repetition **Study Deck**, and Gemini-powered **Explain Concept** summaries.

### 2. Assignments & Submissions (`StudentAssignmentsView` / `AssignmentManager`)
- Submit files or written solutions for instructor-assigned tasks and self-submitted coursework.
- **Pre-Deadline Editing:** Students can update or replace their uploaded work anytime before the deadline.
- **Per-Student Deadline Extensions:** Instructors can approve deadline extensions for individual students after a due date has passed.

### 3. Examination & Proctoring Studio (`StudentExamsView` / `ExamManager`)
- **8 Question Types:** Multiple Choice, Multiple Select, True/False, Short Answer, Essay (manual grading), Code Completion, Code Ordering (Parson's puzzle), and Predict Output.
- **Scheduled Exam Windows:** Configure `Scheduled Opens At` and `Scheduled Closes At` timestamps.
- **Question Bank & Random Subset Draw:** Draw a randomized subset of questions per attempt (`questionDrawCount`) and grade strictly against the drawn set.
- **Anti-Cheat & Screenshot Shield:**
  - Fullscreen exam hall mode, tab-switch/focus tracking, and optional auto-submit after a maximum number of tab switches.
  - Copy/paste/right-click lock, print hiding, instant blackout privacy curtain on `PrintScreen` / `Win+Shift+S` / focus loss, and dynamic student identity watermarking.
- **Resilience & Recovery:** Continuous `localStorage` backup recovers answers if power or internet drops, with an **Offline/Retry Submit Guard** that preserves local answers until Firestore confirms submission.
- **Grouped Student Attempts & Grants:** Multiple attempts by the same student are grouped under one student row in the Admin Attempts view, with per-student **Grant** overrides for extra attempts, extra minutes, or extended deadlines.
- **Exam Analytics:** View unique students, pass rate, average score/duration, and per-question difficulty breakdown (`Hard (Reteach)` / `Moderate` / `Strong`).
- **Bulk Import / Export:** Import questions from Plain Text, CSV, JSON, Markdown, AI prompts, or AMS sync; export questions and student marks to CSV.

### 4. Study & Project Groups (`StudentGroupsView` / `GroupManager`)
- Form teams, join via invite codes, collaborate on group assignments, and track presentation/defense marks.

### 5. Academic Standing & Presence (`StudentAcademicStanding` / `AdminPresenceAlert`)
- Real-time cumulative grade summary across curriculum progress, exam average, live defense, and assignment marks.
- Event-driven online presence tracking and classroom focus/restriction controls for instructors.

---

## Tech Stack

- **Framework:** Next.js `16.4.5` (App Router, static export configured in `next.config.ts`)
- **UI & Styling:** React `19.0.0`, Tailwind CSS `v4`, Framer Motion, Lucide Icons
- **Backend & Persistence:** Firebase (`13.2.0`) — Firestore with persistent local cache, Firebase Hosting
- **AI & Code Execution:** `@google/generative-ai`, `@codesandbox/sandpack-react`, `react-markdown` (`remark-gfm`, `rehype-raw`), `pdfjs-dist`

---

## How to Use This Web App

### For Students
1. **Register / Log In:**
   - Visit `/auth/register` to create an account (select your Trade and Level: `Level 3`, `Level 4`, or `Level 5`), then wait for instructor approval if required.
   - Sign in at `/auth/login` using your email or username.
2. **Browse & Study Syllabi:**
   - Filter courses by your level on the home page (`/`) and open any published syllabus to read notes, run interactive code, and mark subtopics complete.
3. **Complete Assignments:**
   - Open the **Class Assignments** tab on the dashboard to view due dates, upload submissions, and edit your work before the deadline.
4. **Take Quizzes & Exams:**
   - Open the **Exams & Groups** tab to see scheduled tests. Click **Start Test**, review the exam rules, and complete questions using the top question palette. Stay inside the exam window until you click **Finish & Submit** (or wait for the timer to auto-submit).
5. **Collaborate in Groups:**
   - Join or create a study team using a group join code to submit team coursework.

### For Instructors (Admin Portal)
1. **Sign In:**
   - Navigate to `/admin/login`, enter your admin email/password, and complete the 2-Step Google Authenticator (TOTP) verification.
2. **Manage Curriculum (`/admin` & `/admin/builder`):**
   - Create, edit, publish, or export course syllabi with 5-level outcomes, topics, markdown notes, diagrams, and citations.
3. **Approve Students & Monitor Classroom:**
   - Approve pending student registrations, monitor active online students, manage trades/levels, and toggle classroom restrictions.
4. **Create Assignments & Grade Work:**
   - Post assignments with due dates, grade submissions, and grant per-student deadline extensions when needed.
5. **Run Exams & Review Analytics:**
   - Build or bulk-import exams, set open/close windows, anti-cheat thresholds, and random draw counts.
   - Open **Attempts** to inspect grouped student attempts, grade subjective essays, **Grant** extra attempts/time, release answer explanations, or open **Analytics** to spot the hardest questions.

---

## Development & Deployment

### Prerequisites
- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`) configured with your `.env.local` Firebase keys

### Run Locally
```bash
npm install
npm run dev
```

### Type Check & Production Static Export Build
```bash
npx tsc --noEmit
npx next build --webpack
```

### Deploy to Firebase Hosting
```bash
firebase deploy --only hosting
```
