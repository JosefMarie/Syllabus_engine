import { StudentGradeRecord, AcademicStanding } from "@/types/gradebook";
import { UserProfile } from "@/types/auth";

export function calculateLetterGrade(score: number): "A+" | "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

export function calculateAcademicStanding(
  student: UserProfile,
  examAvg: number,
  assignAvg: number,
  progressPct: number,
  compositeScore: number
): AcademicStanding {
  // If suspended or accumulated 10 violations
  if (student.status === "rejected" || (student.unfocusedCount || 0) >= 10) {
    return "suspended";
  }

  // Critical risk if very low score or high inattention strikes
  if (compositeScore < 45 || (student.unfocusedCount || 0) >= 7) {
    return "critical_risk";
  }

  // At risk if below passing (60%) or moderate inattention strikes
  if (compositeScore < 60 || (student.unfocusedCount || 0) >= 4) {
    return "at_risk";
  }

  // Honor roll: composite >= 85 and progress >= 75
  if (compositeScore >= 85 && progressPct >= 70 && (student.unfocusedCount || 0) <= 2) {
    return "honor";
  }

  return "good";
}

export function exportGradebookToCSV(records: StudentGradeRecord[], filename?: string): void {
  if (!records || records.length === 0) {
    alert("No student records available to export.");
    return;
  }

  const headers = [
    "Student Name",
    "Username",
    "Email",
    "Trade",
    "Academic Level",
    "Account Status",
    "Focus Strikes (Max 10)",
    "Syllabus Progress (%)",
    "Subtopics Completed",
    "Subtopics Total",
    "Exams Attempted",
    "Exams Passed",
    "Exam Average (%)",
    "Assignments Submitted",
    "Assignments Graded",
    "Assignment Average (%)",
    "Composite Overall Score (%)",
    "Letter Grade",
    "Academic Standing"
  ];

  const escapeCSV = (value: string | number | undefined | null) => {
    if (value === undefined || value === null) return '""';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = records.map((r) => [
    escapeCSV(r.studentName),
    escapeCSV(r.username),
    escapeCSV(r.email),
    escapeCSV(r.tradeName),
    escapeCSV(r.level),
    escapeCSV(r.status),
    escapeCSV(r.unfocusedCount || 0),
    escapeCSV(r.syllabusProgressPct.toFixed(1)),
    escapeCSV(r.completedSubtopics),
    escapeCSV(r.totalSubtopics),
    escapeCSV(r.examsTotalCount),
    escapeCSV(r.examsPassedCount),
    escapeCSV(r.examAvg.toFixed(1)),
    escapeCSV(r.assignmentsSubmittedCount),
    escapeCSV(r.assignmentsGradedCount),
    escapeCSV(r.assignmentAvg.toFixed(1)),
    escapeCSV(r.compositeScore.toFixed(1)),
    escapeCSV(r.letterGrade),
    escapeCSV(r.standing.toUpperCase())
  ]);

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateStr = new Date().toISOString().split("T")[0];
  link.setAttribute("href", url);
  link.setAttribute("download", filename || `academic_master_gradebook_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
