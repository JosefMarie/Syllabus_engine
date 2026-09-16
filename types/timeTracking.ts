export interface StudentTopicTimeRecord {
  id: string; // e.g. `${userId}_${syllabusId}_${topicId}_${date}`
  userId: string;
  studentName: string;
  studentEmail?: string;
  studentUsername?: string;
  studentTradeId?: string;
  studentLevel?: string;
  syllabusId: string;
  syllabusTitle: string;
  topicId: string;
  topicTitle: string;
  subtopicId?: string;
  subtopicTitle?: string;
  date: string; // Format "YYYY-MM-DD"
  activeSeconds: number; // accumulated active seconds (excluding idle/away)
  activeMinutes: number; // activeSeconds / 60 rounded to 1 decimal place or integer
  lastUpdated: string; // ISO string
}

export type DateRangePreset = 'all' | 'today' | '7days' | '30days' | 'custom';

export interface TopicTimeFilter {
  datePreset: DateRangePreset;
  startDate?: string;
  endDate?: string;
  syllabusId: string; // 'all' or specific ID
  topicId: string; // 'all' or specific ID
  studentId: string; // 'all' or specific UID
  searchQuery?: string;
}

export interface StudentTopicSummary {
  topicId: string;
  topicTitle: string;
  syllabusId: string;
  syllabusTitle: string;
  activeMinutes: number;
}

export interface AggregatedStudentReport {
  userId: string;
  studentName: string;
  studentEmail?: string;
  studentUsername?: string;
  studentTradeId?: string;
  studentLevel?: string;
  totalActiveMinutes: number;
  topics: StudentTopicSummary[];
  syllabiTitles: string[];
  activeDatesCount: number;
  lastActive: string;
}
