import { Syllabus } from "@/types/syllabus";

export const DEMO_SYLLABUS: Syllabus = {
  id: "cs101-fullstack-ai",
  title: "CS101: Modern Full-Stack Web Development & AI Architecture",
  courseCode: "CS101",
  department: "School of Computing & Artificial Intelligence",
  instructor: "Dr. Elena Rostova",
  semester: "Fall 2026",
  description: "A comprehensive modern syllabus covering Next.js 15, Tailwind v4, Framer Motion, and Google Gemini 2.5 Pro integration for high-performance interactive web applications.",
  status: "published",
  createdAt: "2026-08-01T09:00:00Z",
  updatedAt: "2026-08-04T10:00:00Z",
  citationsDictionary: {
    "server actions": {
      id: "cit-1",
      term: "Server Actions",
      explanation: "Asynchronous JavaScript functions executed on the server in Next.js. They eliminate manual API route creation and handle mutation operations directly from UI components.",
      source: "Next.js Documentation - Server Actions & Mutations",
      category: "architecture"
    },
    "hydration": {
      id: "cit-2",
      term: "Hydration",
      explanation: "The process where client-side React attaches event listeners to static HTML rendered by the server, turning static content into an interactive single-page app.",
      source: "React Core Architecture Specification",
      category: "concept"
    },
    "vector embeddings": {
      id: "cit-3",
      term: "Vector Embeddings",
      explanation: "Numerical dense vector representations of textual concepts in high-dimensional mathematical space. Similar semantic meanings sit close to each other in distance calculations.",
      source: "Google Gemini AI SDK Docs",
      category: "tool"
    },
    "structured outputs": {
      id: "cit-4",
      term: "Structured Outputs",
      explanation: "Configuring LLM generation with JSON Schema parameters (`responseSchema`) so response tokens strictly conform to typed interfaces without parsing errors.",
      source: "Google Gemini 2.5 Pro API Guide",
      category: "syntax"
    },
    "firestore": {
      id: "cit-5",
      term: "Firestore",
      explanation: "A flexible, scalable NoSQL cloud database from Firebase and Google Cloud Platform designed to store data in documents organized in collections with real-time sync.",
      source: "Firebase Firestore Reference Docs",
      category: "tool"
    },
    "framer motion": {
      id: "cit-6",
      term: "Framer Motion",
      explanation: "A production-ready animation library for React that provides declarative layout transitions, physics-based springs, gesture detection, and mobile bottom sheet gestures.",
      source: "Framer Motion Developer Guide",
      category: "tool"
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
              description: "Deep dive into execution boundaries and zero-bundle-size server modules.",
              subtopics: [
                {
                  id: "sub-1-1-1-1",
                  order: 1,
                  title: "Understanding Server Execution & Hydration",
                  contentMarkdown: `### Next.js 15 Execution Boundaries

In Next.js 15, components render on the server by default. This delivers pure static HTML to the client browser, reducing JavaScript payload size dramatically.

When a client component is mounted, React performs **Hydration** to hook interactivity (event listeners, state Hooks) back into the DOM structure.

#### Key Directives:
- \`'use client'\`: Demarcates client-side boundary where hooks (\`useState\`, \`useEffect\`) are permitted.
- \`'use server'\`: Used for **Server Actions** to mutate backend state directly.

> [!TIP]
> Keep client components as far down the DOM component tree as possible to maximize server performance and minimize client JavaScript bundle size.`,
                  codeSnippet: {
                    id: "code-1",
                    title: "Interactive Counter Component",
                    language: "javascript",
                    template: "react",
                    code: `import React, { useState } from 'react';

export default function CounterApp() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', color: '#fff', backgroundColor: '#1e293b', borderRadius: '8px' }}>
      <h3 style={{ color: '#06b6d4' }}>Hydration Demo Counter</h3>
      <p>Current Count: <strong>{count}</strong></p>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button 
          onClick={() => setCount(count + 1)}
          style={{ padding: '8px 16px', backgroundColor: '#06b6d4', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Increment (+)
        </button>
        <button 
          onClick={() => setCount(0)}
          style={{ padding: '8px 16px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}`
                  },
                  citations: [
                    {
                      id: "cit-2",
                      term: "Hydration",
                      explanation: "The process where client-side React attaches event listeners to static HTML rendered by the server.",
                      source: "React Core Docs"
                    }
                  ],
                  images: [
                    {
                      id: "img-1",
                      url: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80",
                      caption: "Figure 1.1: Component Boundary Architecture Diagram",
                      alt: "Next.js Component Architecture"
                    }
                  ]
                },
                {
                  id: "sub-1-1-1-2",
                  order: 2,
                  title: "Mutating Data with Server Actions",
                  contentMarkdown: `### Form Submissions & Server Actions

**Server Actions** allow you to trigger server-side functions directly from form elements or client event handlers without explicitly configuring \`fetch()\` REST calls.

#### Example Server Action Pattern:

\`\`\`typescript
'use server'

import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

export async function createSyllabusAction(formData: FormData) {
  const title = formData.get('title') as string;
  const courseCode = formData.get('courseCode') as string;
  
  // Directly interact with backend storage / Firestore
  console.log("Processing syllabus creation on server:", title);
  return { success: true, message: "Syllabus created successfully!" };
}
\`\`\`

When combined with **Firestore**, Server Actions provide a seamless bridge between user interactions and persistent cloud storage.`,
                  codeSnippet: {
                    id: "code-2",
                    title: "Simulated Server Action Form Handler",
                    language: "javascript",
                    template: "react",
                    code: `import React, { useState } from 'react';

export default function ActionForm() {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.target);
    const term = formData.get('term');
    
    // Simulate async server action latency
    await new Promise(res => setTimeout(res, 800));
    setStatus(\`Submitted term "\${term}" to Server Action!\`);
    setLoading(false);
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#0b0f19', color: '#cbd5e1', borderRadius: '8px', border: '1px solid #334155' }}>
      <h4 style={{ color: '#10b981', marginTop: 0 }}>Server Action Simulation</h4>
      <form onSubmit={handleSubmit}>
        <input 
          name="term"
          placeholder="Enter concept term..."
          defaultValue="Vector Embeddings"
          style={{ width: '80%', padding: '8px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff', marginBottom: '12px' }}
        />
        <br/>
        <button 
          type="submit" 
          disabled={loading}
          style={{ padding: '8px 20px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          {loading ? 'Processing on Server...' : 'Dispatch Action'}
        </button>
      </form>
      {status && <p style={{ color: '#06b6d4', marginTop: '12px' }}>{status}</p>}
    </div>
  );
}`
                  },
                  citations: [
                    {
                      id: "cit-1",
                      term: "Server Actions",
                      explanation: "Asynchronous JavaScript functions executed on the server in Next.js.",
                      source: "Next.js Documentation"
                    },
                    {
                      id: "cit-5",
                      term: "Firestore",
                      explanation: "A flexible, scalable NoSQL cloud database from Firebase.",
                      source: "Firebase Firestore Reference Docs"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      id: "lo-2",
      code: "LO2",
      order: 2,
      title: "Integrate Generative AI & Gemini 2.5 Pro Engine",
      description: "Implement automated document parsing, prompt engineering, structured JSON outputs, and vector semantic search.",
      indicativeContents: [
        {
          id: "ic-2-1",
          code: "IC2.1",
          order: 1,
          title: "Structured Outputs with @google/genai SDK",
          topics: [
            {
              id: "top-2-1-1",
              order: 1,
              title: "Parsing Syllabi with Gemini 2.5 Pro",
              description: "Extracting strict multi-level JSON objects from unstructured course files.",
              subtopics: [
                {
                  id: "sub-2-1-1-1",
                  order: 1,
                  title: "Guaranteed JSON Schemas with responseSchema",
                  contentMarkdown: `### Gemini 2.5 Pro & Structured Outputs

When parsing arbitrary PDF or TXT syllabus uploads, traditional prompt engineering can yield unstructured or inconsistent text outputs.

By utilizing **Structured Outputs** with the \`@google/genai\` SDK, we provide a strict JSON Schema definition. Gemini 2.5 Pro guarantees that returned responses match the specified interface.

#### Configuration Snippet:

\`\`\`typescript
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const response = await ai.models.generateContent({
  model: 'gemini-2.5-pro',
  contents: rawSyllabusText,
  config: {
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        learningOutcomes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              code: { type: Type.STRING },
              title: { type: Type.STRING },
            }
          }
        }
      }
    }
  }
});
\`\`\`

This ensures that technical terms are extracted into **Vector Embeddings** or structured citation objects automatically!`,
                  codeSnippet: {
                    id: "code-3",
                    title: "Gemini JSON Schema Generator Tester",
                    language: "javascript",
                    template: "vanilla",
                    code: `console.log("=== Testing Gemini 2.5 Pro Response Schema ===");

const mockSchema = {
  model: "gemini-2.5-pro",
  responseMimeType: "application/json",
  structuredOutputs: true,
  extractedTerms: ["Structured Outputs", "Vector Embeddings", "Server Actions"]
};

console.log("Schema config ready:", JSON.stringify(mockSchema, null, 2));
`
                  },
                  citations: [
                    {
                      id: "cit-4",
                      term: "Structured Outputs",
                      explanation: "Configuring LLM generation with JSON Schema parameters so responses strictly conform to typed interfaces.",
                      source: "Google Gemini 2.5 Pro API Guide"
                    },
                    {
                      id: "cit-3",
                      term: "Vector Embeddings",
                      explanation: "Numerical dense vector representations of textual concepts in high-dimensional mathematical space.",
                      source: "Google Gemini AI SDK Docs"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};

export const DEMO_SYLLABI_LIST: Syllabus[] = [DEMO_SYLLABUS];
