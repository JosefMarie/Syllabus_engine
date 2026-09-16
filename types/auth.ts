export type StudentLevel = 'Level 3' | 'Level 4' | 'Level 5';
export type UserRole = 'student' | 'teacher';
export type AccountStatus = 'pending_approval' | 'approved' | 'rejected';

export interface Trade {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  username: string;
  tradeId: string;
  level: StudentLevel;
  role: UserRole;
  status: AccountStatus;
  passwordHash?: string; // Stored in demo mode
  createdAt: string;
  unfocusedCount?: number;
  suspensionReason?: string;
  sessionIssuedAt?: number;
  sessionExpiresAt?: number;
}
