import { StudentLevel } from "./auth";

export interface StudentNotification {
  id: string;
  userId: string;
  senderName: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface StudentProgressSummary {
  userId: string;
  fullName: string;
  email: string;
  username: string;
  tradeId: string;
  level: StudentLevel;
  status: string;
  completedSubtopicsCount: number;
  totalSubtopicsCount: number;
  progressPercent: number;
  lastActive: string;
  unreadNotificationsCount: number;
}
