import { StudentLevel } from './auth';

export type AssignmentStatus = 'draft' | 'published' | 'archived';
export type SubmissionStatus = 'submitted' | 'graded' | 'returned';

export interface AssignmentStudentReceipt {
  studentUid: string;
  studentName: string;
  studentUsername: string;
  level?: string;
  receivedAt?: string; // ISO string when student's portal received/loaded the assignment
  openedAt?: string;   // ISO string when student clicked "Start" / opened the assignment
  openCount?: number;
}

export interface Assignment {
  id: string;
  assignmentCode?: string; // Short shareable Assignment ID (e.g. "ASG-K9M4") for linking self-submissions
  title: string;
  courseCode: string;
  courseTitle?: string;
  syllabusId?: string; // Optional link to syllabus
  tradeId: string; // Specific trade ID or 'all'
  level: StudentLevel | 'all'; // Target academic level or all
  description: string;
  instructionsMarkdown: string;
  totalPoints: number;
  dueDate?: string; // ISO string
  allowFileUpload: boolean;
  allowTextSubmission: boolean;
  status: AssignmentStatus;
  submissionType?: 'individual' | 'group'; // 'individual' (default) or 'group'
  targetGroupId?: string; // 'all_groups' or specific group id
  forceAssignedStudentUids?: string[]; // Explicit list of student UIDs force-assigned by instructor
  studentReceipts?: Record<string, AssignmentStudentReceipt>; // Map of studentUid -> delivery & "Start" click receipt
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  attachments?: {
    name: string;
    url?: string;
    size?: number;
    type?: string;
  }[];
}

export interface AssignmentSubmission {
  id: string; // e.g. `${assignmentId}_${studentUid}` or `indep_${studentUid}_${Date.now()}`
  assignmentId: string; // "independent" or specific assignment id
  courseCode: string; // e.g. "SWDDA401"
  courseTitle?: string; // e.g. "Data Structures and Algorithms"
  submissionTitle?: string; // Custom title for independent work or assignment title
  isIndependentSubmission?: boolean; // True if student self-submitted under course
  linkedAssignmentId?: string; // Official Assignment ID linked by code or instructor
  linkedAssignmentCode?: string; // Shareable Assignment ID code entered by student or linked by instructor
  archived?: boolean; // Hidden from active teacher submission queues once graded
  archivedAt?: string;
  studentUid: string;
  studentName: string;
  studentUsername: string;
  tradeId: string;
  level: StudentLevel;
  contentMarkdown?: string;
  fileData?: {
    name: string;
    base64Url?: string; // base64 data url or storage url
    size: number;
    type: string;
  };
  status: SubmissionStatus;
  submissionType?: 'individual' | 'group';
  groupId?: string;
  groupName?: string;
  groupMembers?: {
    uid: string;
    fullName: string;
    username: string;
  }[];
  submittedByUid?: string;
  submittedByName?: string;
  score?: number;
  maxScore: number;
  feedback?: string;
  submittedAt: string;
  gradedAt?: string;
  gradedBy?: string;
}


