import { Syllabus } from "@/types/syllabus";

export const DEMO_SYLLABUS_L3: Syllabus = {
  id: "cs100-fundamentals",
  title: "CS100: Level 3 Fundamentals of Computer Systems",
  courseCode: "CS100",
  department: "School of Computing & Artificial Intelligence",
  instructor: "Prof. Marcus Vance",
  semester: "Fall 2026",
  tradeId: "trade-sw-eng",
  level: "Level 3",
  description: "Introductory Level 3 syllabus covering hardware principles, operating systems, and basic programming syntax.",
  status: "published",
  createdAt: "2026-08-01T09:00:00Z",
  updatedAt: "2026-08-04T10:00:00Z",
  learningOutcomes: [
    {
      id: "lo-l3-1",
      code: "LO1",
      order: 1,
      title: "Level 3 Introduction to Programming",
      description: "Basics of variables, control flow, and functions.",
      indicativeContents: [
        {
          id: "ic-l3-1-1",
          code: "IC1.1",
          order: 1,
          title: "Programming Logic",
          topics: [
            {
              id: "top-l3-1-1-1",
              order: 1,
              title: "Control Flow & Syntax",
              subtopics: [
                {
                  id: "sub-l3-1-1-1-1",
                  order: 1,
                  title: "Variables and Data Types",
                  contentMarkdown: `### Level 3 Basics\nWelcome to Level 3 Computer Systems. Here you learn core syntax and variables.`,
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};

export const DEMO_SYLLABUS: Syllabus = {
  id: "cs101-fullstack-ai",
  title: "CS101: Modern Full-Stack Web Development & AI Architecture",
  courseCode: "CS101",
  department: "School of Computing & Artificial Intelligence",
  instructor: "Dr. Elena Rostova",
  semester: "Fall 2026",
  tradeId: "trade-sw-eng",
  level: "Level 4",
  description: "A comprehensive modern Level 4 syllabus covering Next.js 15, Tailwind v4, Framer Motion, and Google Gemini 2.5 Pro integration.",
  status: "published",
  createdAt: "2026-08-01T09:00:00Z",
  updatedAt: "2026-08-04T10:00:00Z",
  citationsDictionary: {
    "server actions": {
      id: "cit-1",
      term: "Server Actions",
      explanation: "Asynchronous JavaScript functions executed on the server in Next.js. They eliminate manual API route creation.",
      source: "Next.js Documentation",
      category: "architecture"
    },
    "hydration": {
      id: "cit-2",
      term: "Hydration",
      explanation: "The process where client-side React attaches event listeners to static HTML rendered by the server.",
      source: "React Core Docs",
      category: "concept"
    }
  },
  learningOutcomes: [
    {
      id: "lo-1",
      code: "LO1",
      order: 1,
      title: "Master Next.js 15 & React 19 Full-Stack Architecture",
      description: "Understand server rendering, client-side hydration, streaming HTML, and Next.js App Router paradigms.",
      indicativeContents: [
        {
          id: "ic-1-1",
          code: "IC1.1",
          order: 1,
          title: "App Router Paradigms & React Server Components",
          topics: [
            {
              id: "top-1-1-1",
              order: 1,
              title: "Server Components vs Client Components",
              description: "Deep dive into execution boundaries.",
              subtopics: [
                {
                  id: "sub-1-1-1-1",
                  order: 1,
                  title: "Understanding Server Execution & Hydration",
                  contentMarkdown: `### Level 4 Next.js Execution Boundaries\nIn Level 4, components render on the server by default. This delivers pure static HTML to the client browser.`,
                  codeSnippet: {
                    id: "code-1",
                    title: "Interactive Counter Component",
                    language: "javascript",
                    template: "react",
                    code: `import React, { useState } from 'react';\n\nexport default function CounterApp() {\n  const [count, setCount] = useState(0);\n  return <div>Count: {count}</div>;\n}`
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};

export const DEMO_SYLLABUS_L5: Syllabus = {
  id: "cs102-advanced-ai",
  title: "CS102: Level 5 Advanced Distributed Systems & LLM Agents",
  courseCode: "CS102",
  department: "School of Computing & Artificial Intelligence",
  instructor: "Dr. Alexander Vance",
  semester: "Fall 2026",
  tradeId: "trade-sw-eng",
  level: "Level 5",
  description: "Advanced Level 5 course covering distributed consensus, autonomous agentic workflows, and micro-architecture scaling.",
  status: "published",
  createdAt: "2026-08-01T09:00:00Z",
  updatedAt: "2026-08-04T10:00:00Z",
  learningOutcomes: [
    {
      id: "lo-l5-1",
      code: "LO1",
      order: 1,
      title: "Level 5 Autonomous Multi-Agent Workflows",
      description: "Distributed task orchestrations and tool invocation pipelines.",
      indicativeContents: [
        {
          id: "ic-l5-1-1",
          code: "IC1.1",
          order: 1,
          title: "Agentic Systems",
          topics: [
            {
              id: "top-l5-1-1-1",
              order: 1,
              title: "Autonomous Tool Use",
              subtopics: [
                {
                  id: "sub-l5-1-1-1-1",
                  order: 1,
                  title: "Function Calling & Orchestration",
                  contentMarkdown: `### Level 5 Agentic Systems\nLevel 5 explores advanced multi-agent orchestrations and LLM function calling pipelines.`,
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};

export const DEMO_SYLLABI_LIST: Syllabus[] = [
  DEMO_SYLLABUS_L3,
  DEMO_SYLLABUS,
  DEMO_SYLLABUS_L5
];
