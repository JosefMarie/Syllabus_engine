# Comprehensive Feature Enhancement Roadmap
**Platform**: Syllabus Engine & Academic Management System  
**Prepared For**: Instructor Josef Marie  
**Date**: November 2026  
**Status**: Planning & Evaluation  

---

## Executive Overview
This document compiles the 9 strategic architectural and feature enhancement tracks designed to expand the platform from its current foundation into an enterprise-grade, AI-assisted Learning Management System (LMS). Each module outlines current functionality, proposed sub-features, user value, and implementation feasibility.

---

## Track 1: Interactive Syllabus & Student Learning Experience
*Current Foundation: Subtopic markdown notes, progress checkboxes, last-read tracking, text-to-speech audio reader, and search.*

### Sub-Features to Enhance:
- [ ] **1.1. AI-Powered "Ask My Syllabus" Tutor (RAG Chat)**
  - Floating contextual AI study assistant embedded in the syllabus view.
  - Strictly grounded in the syllabus notes and code samples (retrieval-augmented generation) to eliminate hallucinations.
  - Capable of generating on-the-fly flashcards, instant concept summaries, and practice checks for difficult subtopics.
- [ ] **1.2. Offline Study Mode (Progressive Web App & Service Worker)**
  - "Download Course for Offline Reading" button using the Cache Storage API and IndexedDB.
  - Students can read complete subtopic notes, view code snippets, and mark progress with zero internet connection in remote or low-connectivity classroom environments.
- [ ] **1.3. Interactive In-Browser Code Sandboxes**
  - Embedded executable coding environments (e.g., Monaco Editor, WebContainer, or Pyodide) for programming, database, and technical courses.
  - Students run and test example code directly within the syllabus reading page without installing local tools.
- [ ] **1.4. Study Streaks & Micro-Gamification**
  - Daily reading activity tracking (e.g., *7-Day Study Streak 🔥*).
  - Milestone achievement badges awarded upon finishing full modules or completing study hours.

---

## Track 2: Exams, Quizzes & Assessment Engine
*Current Foundation: Multiple-choice, true/false, fill-in-the-blank code snippets, automated grading, student attempts desk with search, and manual grading review.*

### Sub-Features to Enhance:
- [ ] **2.1. One-Click AI Exam Generator from Syllabus / PDF**
  - Instructor selects a syllabus module or uploads a lecture PDF; Gemini AI parses key competencies and generates a 10–30 question assessment categorized by Bloom's Taxonomy (knowledge, comprehension, application).
  - Review, edit, or reject generated questions before publishing.
- [ ] **2.2. Question Bank Pools & Randomized Anti-Leak Shuffling**
  - Instructors create question pools (e.g., author 50 questions; each student receives 15 randomly selected questions).
  - Shuffles question ordering and answer options per student to deter peer collusion during hall exams.
- [ ] **2.3. Regex & Fuzzy-Matching for Fill-in-the-Blank Questions**
  - Flexible matching for short answer questions to prevent penalizing students for minor capitalization differences, whitespace variations, or non-critical spelling typos.
- [ ] **2.4. LaTeX Math & Chemical Equation Rendering**
  - Native KaTeX / MathJax rendering support for mathematical symbols, complex formulas (`$$E=mc^2$$`), and chemical reactions in STEM courses.

---

## Track 3: Live Exam Hall Monitor & Real-Time Integrity
*Current Foundation: Real-time tab switch and blur strike detection, audio violation alerts, live connectivity status (online/idle/offline), remote time extension grant, force submit, and timeout auto-submission.*

### Sub-Features to Enhance:
- [ ] **3.1. Lightweight Periodic Webcam Verification (Opt-In)**
  - Periodic low-resolution snapshot captures (e.g., every 30–60 seconds) using the student's front camera to confirm presence without consuming continuous streaming bandwidth.
- [ ] **3.2. Second-Device / Mobile Desk Proctoring via QR Code**
  - Student scans a QR code with their mobile phone to position the phone as a secondary desk-view camera during high-stakes finals.
- [ ] **3.3. Configurable Strike Threshold Actions**
  - Policy automation rules per exam:
    - *Auto-lock test after 3 strikes*
    - *Automatically deduct 5% per unauthorized window blur*
    - *Instant instructor push notification upon strike*
- [ ] **3.4. Printable Proctoring Audit & Incident Reports**
  - Generate a downloadable, timestamped PDF report for any attempt detailing precise violation events and timestamps to support formal academic dispute resolution.

---

## Track 4: Class Assignments & Homework Submissions
*Current Foundation: Document ingestion, cohort/level targeting, rubric grading, batch AI auto-grading, file uploads, and rich text submissions.*

### Sub-Features to Enhance:
- [ ] **4.1. In-Browser PDF Annotation & Visual Markup**
  - Visual grading interface allowing instructors to highlight text, draw annotations, and leave sticky comment notes directly on student PDF submissions (similar to Google Classroom or Turnitin).
- [ ] **4.2. Code & Text Plagiarism / Similarity Checking**
  - Internal cross-comparison between cohort submissions to calculate similarity percentages and flag identical code blocks or copied essays.
- [ ] **4.3. Automated Late Submission Penalties**
  - Customizable submission windows with automated grade deductions (e.g., *-10% per 24 hours past deadline*).
- [ ] **4.4. Student Revision & Resubmission Workflows**
  - Allow students to submit a second draft based on instructor comments, preserving submission history for side-by-side revision tracking.

---

## Track 5: Student Study & Project Groups
*Current Foundation: Group creation, join codes, cohort filtering, and PowerPoint & Project Presentation Evaluation Gradebook with customizable group/individual weight ratios.*

### Sub-Features to Enhance:
- [ ] **5.1. Collaborative In-App Group Workspaces**
  - Dedicated group hub with Kanban task boards, shared research notes, and presentation file upload repositories.
- [ ] **5.2. Anonymous Peer Review & Contribution Rating**
  - Group members anonymously rate peers on criteria such as teamwork, effort, and punctuality at project conclusion to give instructors objective data on individual contribution.
- [ ] **5.3. Live Presentation HUD with Timer & Touch Scoring**
  - Stopwatch, transition alerts, and quick-tap rubric sliders designed for tablet/laptop use while grading live speeches at the podium.

---

## Track 6: Master Academic Gradebook & Transcripts
*Current Foundation: Automatic computation of exam averages, assignment scores, reading progress %, composite grades, focus strike resets, and CSV export.*

### Sub-Features to Enhance:
- [ ] **6.1. Official School-Branded PDF Transcript Generator**
  - 1-click generation of high-resolution, printable student transcripts featuring institution branding, student photo, GPA, course breakdowns, attendance records, and instructor signature section.
- [ ] **6.2. Custom Course Category Weighting**
  - Configurable gradebook weight profiles per syllabus (e.g., *Exams: 40%, Assignments: 30%, Presentations: 20%, Subtopic Reading: 10%*).
- [ ] **6.3. Early-Warning At-Risk Student Detection**
  - Visual indicators and automated alerts for students whose composite average falls below passing or who have shown zero activity for 5+ consecutive days.

---

## Track 7: Student Suggestions & Continuous Feedback
*Current Foundation: Category classification, voting/upvotes, admin replies, public/private toggles, and persistent local/cloud synchronization.*

### Sub-Features to Enhance:
- [ ] **7.1. Public "What We Built" Feedback Roadmap**
  - A dedicated view showcasing student suggestions marked as `"Planned"` or `"Implemented"`, reinforcing trust by demonstrating responsive leadership.
- [ ] **7.2. AI Sentiment & Topic Clustering Dashboard**
  - Gemini AI analysis summarizing overall student sentiment and clustering recurring feedback (e.g., *“30% of feedback relates to exam timing flexibility”*).

---

## Track 8: Announcements & Broadcast Bulletins
*Current Foundation: Broadcast bulletins, priority tags, and level/role targeting.*

### Sub-Features to Enhance:
- [ ] **8.1. Web Push Notifications**
  - Browser push notifications alerting students when a new exam is scheduled, an assignment deadline is approaching, or an urgent bulletin is published.
- [ ] **8.2. Direct 1-on-1 Student Messaging & Praise Badges**
  - Ability for instructors to send private encouragement notes or academic commendation badges directly to individual student profiles.

---

## Track 9: Security, Multi-Role Governance & Backup Tools
*Current Foundation: Student approval/rejection workflows, role authentication, and open database access.*

### Sub-Features to Enhance:
- [ ] **9.1. Granular Role-Based Access Control (RBAC)**
  - Support for multiple roles: *Lead Instructor*, *Assistant Teacher / TA* (can grade but cannot delete courses), and *Academic Registrar*.
- [ ] **9.2. One-Click Complete Database Backup & Restore Tool**
  - Admin button to export a complete JSON snapshot of all syllabi, users, submissions, and exam records for offline archival security.

---

## Suggested Phasing & Prioritization

```
Phase 1: High-Impact / Fast Wins
├── 2.1. One-Click AI Exam Generator from Syllabus
├── 6.1. Official School-Branded PDF Transcript Generator
└── 9.2. One-Click Complete Database Backup Tool

Phase 2: Classroom & Grading Productivity
├── 4.1. In-Browser PDF Annotation & Visual Markup
├── 5.2. Anonymous Peer Review & Contribution Rating
└── 6.2. Custom Course Category Weighting

Phase 3: Real-Time & Mobile Enhancements
├── 1.2. Offline Study Mode (PWA & Service Worker)
├── 3.1. Lightweight Periodic Webcam Verification
└── 8.1. Web Push Notifications
```

---
*Note: Test all existing modules on the live deployment (https://syllabus-ad688.web.app/admin) first. When ready, pick any feature above to begin implementation.*
