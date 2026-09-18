import { StudentLevel } from "./auth";

export type ActivityActionType = 
  | "STUDENT_REGISTER"
  | "STUDENT_LOGIN"
  | "ADMIN_LOGIN"
  | "VIEW_SYLLABUS"
  | "VIEW_SUBTOPIC"
  | "RUN_CODE"
  | "ASK_AI"
  | "SWITCH_LEVEL"
  | "APPROVE_STUDENT"
  | "APPROVE_STUDENT_BATCH"
  | "REJECT_STUDENT"
  | "CREATE_TRADE"
  | "DELETE_TRADE"
  | "SAVE_SYLLABUS"
  | "DELETE_SYLLABUS"
  | "SEND_STUDENT_MESSAGE"
  | "STUDENT_LOGOUT"
  | "AUTO_TIMEOUT_LOGOUT"
  | "RESET_FOCUS_STRIKES"
  | "STUDENT_SUSPENDED_FOCUS";

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userLevel?: StudentLevel | string;
  action: ActivityActionType;
  details: string;
  syllabusId?: string;
  syllabusTitle?: string;
  timestamp: string;
}
