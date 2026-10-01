import { StudentLevel } from './auth';

export interface GroupMember {
  uid: string;
  fullName: string;
  username: string;
  joinedAt: string;
  isLeader: boolean;
}

export interface StudentGroup {
  id: string; // e.g. "grp_17272718291_a9f"
  name: string; // e.g. "Code Crafters"
  courseCode?: string; // Optional/legacy: groups represent whole class cohort across all courses
  courseTitle?: string; // Optional/legacy
  tradeId: string;
  level: StudentLevel;
  joinCode: string; // 6-char alphanumeric, e.g. "CC-482"
  createdByUid: string;
  leaderName: string;
  members: GroupMember[];
  maxMembers: number; // default 4, flexible capacity (2-100+)
  isLocked: boolean; // teacher lock prevents joining/leaving
  createdAt: string;
  updatedAt: string;
}

export type MemberParticipationStatus = 'present' | 'partial' | 'minimal' | 'absent';

export interface MemberEvaluation {
  uid: string;
  studentName: string;
  username?: string;
  individualScore: number; // 0 - 100
  finalScore: number;      // Calculated weighted mark e.g. (Group * Wg + Indiv * Wi)
  status: MemberParticipationStatus;
  privateFeedback?: string;
}

export interface GroupEvaluation {
  id: string;
  groupId: string;
  groupName: string;
  presentationTitle: string; // e.g. "PowerPoint Presentation: Chapter 4"
  courseCode?: string;
  courseTitle?: string;
  evaluatedAt: string;
  evaluatedBy: string; // Teacher email or name
  groupScore: number; // 0 - 100
  groupWeight: number; // default 50 (50%)
  individualWeight: number; // default 50 (50%)
  strictAbsentZero: boolean; // If student is absent, final score is strictly 0%
  groupFeedback?: string;
  members: Record<string, MemberEvaluation>;
  createdAt: string;
  updatedAt: string;
}

