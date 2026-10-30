import { ACADEMY_BADGES, AchievementBadge, StudentAchievementRecord } from "@/types/achievement";
import { UserProfile } from "@/types/auth";
import { ExamAttempt } from "@/types/exam";
import { AssignmentSubmission } from "@/types/assignment";
import { db, isFirebaseConfigured } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

const ACHIEVEMENTS_STORAGE_KEY = "syllabus_platform_student_achievements_v1";

export async function getStudentAchievements(studentUid: string): Promise<StudentAchievementRecord[]> {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(`${ACHIEVEMENTS_STORAGE_KEY}_${studentUid}`);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
  }

  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDoc(doc(db, "student_achievements", studentUid));
      if (snap.exists()) {
        const records = snap.data().badges as StudentAchievementRecord[];
        if (typeof window !== "undefined") {
          localStorage.setItem(`${ACHIEVEMENTS_STORAGE_KEY}_${studentUid}`, JSON.stringify(records));
        }
        return records || [];
      }
    } catch (e) {
      console.warn("Firestore getStudentAchievements error:", e);
    }
  }

  return [];
}

export async function saveStudentAchievements(
  studentUid: string,
  records: StudentAchievementRecord[]
): Promise<void> {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`${ACHIEVEMENTS_STORAGE_KEY}_${studentUid}`, JSON.stringify(records));
    } catch (e) {}
  }

  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "student_achievements", studentUid), {
        badges: records,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.warn("Firestore saveStudentAchievements error:", e);
    }
  }
}

export interface EvaluationInput {
  subtopicsCompleted: number;
  hasFinishedAnySyllabus: boolean;
  examAttempts: ExamAttempt[];
  submissions: AssignmentSubmission[];
  challengesSolvedCount: number;
  suggestionsCount: number;
}

export async function evaluateStudentAchievements(
  student: UserProfile,
  input: EvaluationInput
): Promise<{ allEarned: StudentAchievementRecord[]; newlyUnlocked: AchievementBadge[] }> {
  const existing = await getStudentAchievements(student.uid);
  const earnedSet = new Set(existing.map((e) => e.badgeId));
  const newlyUnlocked: AchievementBadge[] = [];
  const now = new Date().toISOString();

  const grantBadge = (badgeId: string) => {
    if (!earnedSet.has(badgeId)) {
      earnedSet.add(badgeId);
      existing.push({
        badgeId,
        studentUid: student.uid,
        earnedAt: now
      });
      const badge = ACADEMY_BADGES.find((b) => b.id === badgeId);
      if (badge) newlyUnlocked.push(badge);
    }
  };

  // 1. First Step: at least 1 subtopic completed
  if (input.subtopicsCompleted >= 1) {
    grantBadge("first_step");
  }

  // 2. Master Scholar: 100% on any syllabus
  if (input.hasFinishedAnySyllabus) {
    grantBadge("syllabus_finisher");
  }

  // 3. Arena Gladiator: 1 coding challenge solved
  if (input.challengesSolvedCount >= 1) {
    grantBadge("code_warrior");
  }

  // 4. Algorithm Grandmaster: 3+ coding challenges solved
  if (input.challengesSolvedCount >= 3) {
    grantBadge("arena_grandmaster");
  }

  // 5. Perfect Score Ace: 100% on any exam
  const hasPerfectExam = input.examAttempts.some((a) => {
    if (a.percentage === 100) return true;
    if (a.score !== undefined && a.maxScore > 0 && a.score >= a.maxScore) return true;
    return false;
  });
  if (hasPerfectExam) {
    grantBadge("exam_ace");
  }

  // 6. Project Practitioner: 3+ graded assignments
  const gradedCount = input.submissions.filter((s) => s.status === "graded").length;
  if (gradedCount >= 3) {
    grantBadge("assignment_hero");
  }

  // 7. Campus Innovator: 1+ suggestion
  if (input.suggestionsCount >= 1) {
    grantBadge("campus_innovator");
  }

  // 8. Undivided Attention: 0 strikes and at least 5 completed subtopics
  if ((student.unfocusedCount || 0) === 0 && input.subtopicsCompleted >= 5) {
    grantBadge("laser_focus");
  }

  if (newlyUnlocked.length > 0) {
    await saveStudentAchievements(student.uid, existing);
  }

  return {
    allEarned: existing,
    newlyUnlocked
  };
}
