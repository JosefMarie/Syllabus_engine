export type PresenceState = 'actively_reading' | 'tab_unfocused' | 'offline';

export interface StudentPresenceRecord {
  userId: string;
  fullName: string;
  state: PresenceState;
  currentSubtopicTitle?: string;
  syllabusTitle?: string;
  lastActive: string; // ISO String timestamp
  lastFocused: string; // ISO String timestamp
}
