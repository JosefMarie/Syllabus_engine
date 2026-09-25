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
