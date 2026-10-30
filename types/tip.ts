export type TipLanguage = 
  | "python" 
  | "typescript" 
  | "javascript" 
  | "dart" 
  | "rust" 
  | "java" 
  | "sql" 
  | "git" 
  | "cleancode" 
  | "general";

export type TipDifficulty = "beginner" | "intermediate" | "pro";

export type TipCategory = 
  | "syntax" 
  | "performance" 
  | "best-practices" 
  | "debugging" 
  | "architecture" 
  | "security" 
  | "tooling";

export interface DeveloperTip {
  id: string;
  title: string;
  summary: string;
  language: TipLanguage;
  category: TipCategory;
  difficulty: TipDifficulty;
  tags: string[];
  
  // Code snippets
  goodCode: string;
  goodCodeTitle?: string;
  badCode?: string;
  badCodeTitle?: string;
  
  // Deep dive explanation
  explanation: string;
  whyItMatters?: string;
  documentationUrl?: string;
  
  // Status and metadata
  status: "published" | "draft";
  isFeatured?: boolean; // Tip of the Day / Featured Spotlight
  createdAt: string;
  updatedAt: string;
  authorName?: string;
  authorUid?: string;
  
  // Telemetry
  likesCount?: number;
  viewsCount?: number;
}
