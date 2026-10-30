import { StudentLevel, UserProfile } from "./auth";
import { ExamAttempt } from "./exam";
import { AssignmentSubmission } from "./assignment";

export type AcademicStanding = "honor" | "good" | "at_risk" | "critical_risk" | "suspended";

export interface StudentGradeRecord {
  studentUid: string;
  studentName: string;
  username: string;
  email: string;
  tradeId: string;
  tradeName: string;
  level: StudentLevel;
  status: string;
  unfocusedCount: number;
  lastActive?: string;
  
  // Exams
  examAttempts: ExamAttempt[];
  examAvg: number; // 0 - 100
  examsPassedCount: number;
  examsTotalCount: number;

  // Assignments
  assignmentSubmissions: AssignmentSubmission[];
  assignmentAvg: number; // 0 - 100
  assignmentsGradedCount: number;
  assignmentsSubmittedCount: number;

  // Syllabus Progress
  syllabusProgressPct: number; // 0 - 100
  completedSubtopics: number;
  totalSubtopics: number;

  // Composite Performance
  compositeScore: number; // 0 - 100
  letterGrade: "A+" | "A" | "B" | "C" | "D" | "F";
  standing: AcademicStanding;
}
