export interface Citation {
  id: string;
  term: string;
  explanation: string;
  source?: string;
  category?: 'concept' | 'syntax' | 'tool' | 'architecture';
}

export interface CodeSnippet {
  id?: string;
  title?: string;
  language: 'javascript' | 'typescript' | 'html' | 'css' | 'json';
  code: string;
  template?: 'vanilla' | 'react' | 'node';
}

export interface ImageRef {
  id: string;
  url: string;
  caption: string;
  alt: string;
}

// Level 5: Subtopic
export interface Subtopic {
  id: string;
  title: string;
  order: number;
  contentMarkdown: string;
  codeSnippet?: CodeSnippet;
  citations?: Citation[];
  images?: ImageRef[];
  completed?: boolean;
}

// Level 4: Topic
export interface Topic {
  id: string;
  title: string;
  order: number;
  description?: string;
  subtopics: Subtopic[];
}

// Level 3: Indicative Content (IC)
export interface IndicativeContent {
  id: string;
  code: string; // e.g. "IC-1.1"
  title: string;
  order: number;
  topics: Topic[];
}

// Level 2: Learning Outcome (LO)
export interface LearningOutcome {
  id: string;
  code: string; // e.g. "LO-1"
  title: string;
  order: number;
  description?: string;
  indicativeContents: IndicativeContent[];
}

// Level 1: Syllabus Name / Overview
export interface Syllabus {
  id: string;
  title: string;
  courseCode: string;
  description: string;
  department?: string;
  instructor?: string;
  semester?: string;
  tradeId?: string;
  level?: 'Level 3' | 'Level 4' | 'Level 5';
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
  learningOutcomes: LearningOutcome[];
  citationsDictionary?: Record<string, Citation>; // Fast lookup by lowercase term
}

export interface SyllabusExtractionResult {
  syllabus: Syllabus;
  extractedCount: {
    los: number;
    ics: number;
    topics: number;
    subtopics: number;
    citations: number;
  };
  rawJsonResponse?: string;
}
