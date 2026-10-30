import { StudentLevel } from "./auth";

export type BulletinPriority = "critical" | "important" | "info" | "celebration";
export type BulletinAudienceType = "all" | "level" | "trade" | "trade_level";

export interface BulletinReadReceipt {
  studentUid: string;
  studentName: string;
  readAt: string;
}

export interface BroadcastBulletin {
  id: string;
  title: string;
  message: string;
  priority: BulletinPriority;
  targetAudience: BulletinAudienceType;
  targetTradeId?: string; // 'all' or specific trade ID
  targetLevel?: StudentLevel | "all";
  actionUrl?: string; // Optional internal or external link
  actionLabel?: string;
  expiresAt?: string; // Optional expiry ISO string
  requireAcknowledgment?: boolean; // If true, pops up modal until dismissed
  readReceipts?: BulletinReadReceipt[];
  createdByName: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
  active: boolean;
}
