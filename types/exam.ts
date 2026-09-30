import { StudentLevel } from './auth';

export type QuestionType = 
  | 'multiple_choice'   // Single correct choice
  | 'multiple_select'   // Multiple correct choices (checkboxes)
  | 'true_false'        // Binary True / False
  | 'short_answer'      // Exact keyword or phrase match
  | 'essay'             // Extended text or code snippet for teacher manual grading
  | 'code_completion'   // Interactive code with inline blank tokens (e.g. ___1___)
  | 'code_ordering'     // Parson's puzzle (scrambled lines to arrange into working sequence)
  | 'predict_output';   // Code snippet + predict terminal stdout/return value

export type ExamType = 'quiz' | 'exam';
export type ExamStatus = 'draft' | 'published' | 'archived';

export interface CodeBlank {
  id: string; // e.g. "1", "2"
  acceptedAnswers: string[]; // Variations accepted (e.g. ["reduce", ".reduce"])
  placeholder?: string;
  hint?: string;
}

export interface ExamQuestion {
  id: string;
  prompt: string; // Markdown supported for code snippets and formatting
  type: QuestionType;
  options?: string[]; // For multiple choice / select
  correctAnswer?: string | string[] | boolean | Record<string, string>; // For auto-grading
  explanation?: string; // Helpful explanation shown after evaluation
  points: number;

  // Dedicated coding fields
  codeSnippet?: string; // Code template containing blanks (e.g. `___1___`) or code snippet
  codeLanguage?: string; // 'javascript' | 'typescript' | 'python' | 'html' | 'css' | 'sql' | 'java' | 'bash'
  codeBlanks?: CodeBlank[]; // Configured blanks for code_completion
  codeLines?: string[]; // Original/scrambled lines for code_ordering
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  courseCode: string;
  courseTitle?: string;
  tradeId: string; // Specific trade ID or 'all'
  level: StudentLevel | 'all';
  type: ExamType; // 'quiz' (practice check) or 'exam' (formal assessment)
  status: ExamStatus;
  timeLimitMinutes: number; // 0 = untimed, e.g. 15, 30, 45, 60, 90
  passPercentage: number; // e.g. 70
  maxAttempts: number; // 1 for formal exam, 0 = unlimited for practice quiz
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  enableAntiCheating?: boolean; // Detects window blur, tab switching, and fullscreen exit
  showResultsImmediately?: boolean; // If true, reveals score and answers upon submit
  questions: ExamQuestion[];
  totalPoints: number;
  dueDate?: string; // Optional deadline ISO string
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface QuestionGrade {
  awardedPoints: number;
  maxPoints: number;
  feedback?: string;
  autoGraded: boolean;
}

export interface ExamAttempt {
  id: string; // `${examId}_${studentUid}_${attemptNumber}`
  examId: string;
  examTitle: string;
  courseCode: string;
  studentUid: string;
  studentName: string;
  studentUsername: string;
  studentTradeId?: string;
  studentLevel: StudentLevel;
  attemptNumber: number;
  answers: Record<string, any>; // questionId -> answer
  score?: number;
  maxScore: number;
  percentage?: number;
  passed?: boolean;
  status: 'in_progress' | 'submitted' | 'graded';
  startedAt: string;
  submittedAt?: string;
  timeSpentSeconds: number;
  tabSwitchCount: number; // Disciplinary tracking for tab switching/unfocusing during exam
  questionGrades?: Record<string, QuestionGrade>;
  teacherFeedback?: string;
  gradedBy?: string;
  gradedAt?: string;
}
