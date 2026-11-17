import { StudentLevel } from "./auth";

export type CalendarEventType = "event" | "task" | "exam" | "holiday";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm optional
  type: CalendarEventType;
  level: StudentLevel | "all";
  courseCode?: string;
  createdBy?: string;
  createdAt: string;
}
