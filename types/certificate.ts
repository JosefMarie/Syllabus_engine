import { StudentLevel } from "./auth";

export interface CertificateStats {
  subtopicsCompleted: number;
  totalSubtopics: number;
  examAverage: number;
  assignmentsPassed: number;
  honorsStanding: boolean;
}

export interface CourseCertificate {
  id: string; // e.g. "CERT-2026-SWDDA401-8F2B"
  studentUid: string;
  studentName: string;
  studentUsername: string;
  studentEmail?: string;
  studentLevel: StudentLevel;
  tradeName: string;
  courseCode: string;
  courseTitle: string;
  syllabusId: string;
  issueDate: string;
  completionStats: CertificateStats;
  instructorSignature: string;
  certificateHash: string;
}
