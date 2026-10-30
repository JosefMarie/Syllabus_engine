export type SuggestionCategory = 
  | "feature_request" 
  | "course_content" 
  | "dev_tip_request" 
  | "bug_report" 
  | "general_feedback";

export type SuggestionStatus = "new" | "in_review" | "resolved" | "archived";

export interface StudentSuggestion {
  id: string;
  category: SuggestionCategory;
  title: string;
  message: string;
  isAnonymous: boolean;
  studentName?: string;
  studentEmail?: string;
  studentUid?: string;
  studentLevel?: string;
  studentTradeId?: string;
  status: SuggestionStatus;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}
