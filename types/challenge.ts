import { StudentLevel } from "./auth";

export type ChallengeDifficulty = "easy" | "medium" | "hard";
export type ChallengeLanguage = "javascript" | "typescript" | "python" | "sql" | "html_css";

export interface ChallengeTestCase {
  id: string;
  input: string; // JSON or string argument passed to function
  expectedOutput: string; // Expected return string/JSON
  description?: string;
  isHidden?: boolean; // Hidden test case for grading
}

export interface CodingChallenge {
  id: string;
  title: string;
  slug: string;
  difficulty: ChallengeDifficulty;
  language: ChallengeLanguage;
  tradeId: string; // 'all' or specific trade
  level: StudentLevel | "all";
  descriptionMarkdown: string;
  functionName: string; // e.g. "twoSum" or "findLongestWord"
  starterCode: string;
  solutionCode?: string;
  testCases: ChallengeTestCase[];
  points: number;
  weekNumber?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  createdByName: string;
}

export interface ChallengeSubmission {
  id: string;
  challengeId: string;
  challengeTitle: string;
  studentUid: string;
  studentName: string;
  studentUsername: string;
  code: string;
  passed: boolean;
  testsPassed: number;
  testsTotal: number;
  executionTimeMs?: number;
  error?: string;
  awardedPoints: number;
  submittedAt: string;
}
