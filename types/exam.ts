import { StudentLevel } from './auth';

export type QuestionType = 
  | 'multiple_choice'   // Single correct choice
  | 'multiple_select'   // Multiple correct choices (checkboxes)
  | 'true_false'        // Binary True / False
  | 'short_answer'      // Exact keyword or phrase match
  | 'essay';            // Extended text or code snippet for teacher manual grading

export type ExamType = 'quiz' | 'exam';
export type ExamStatus = 'draft' | 'published' | 'archived';

export interface ExamQuestion {
  id: string;
  prompt: string; // Markdown supported for code snippets and formatting
  type: QuestionType;
  options?: string[]; // For multiple choice / select
  correctAnswer?: string | string[] | boolean; // For auto-grading (e.g. index string '0', array ['0','2'], or boolean)
  explanation?: string; // Helpful explanation shown after evaluation
  points: number;
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
