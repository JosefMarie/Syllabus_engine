import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, deleteDoc } from "firebase/firestore";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
});
const db = getFirestore(app);

function partitionContentIntoChunks(syllabus) {
  const contentMap = {};
  const skeleton = {
    ...syllabus,
    _isChunked: true,
    learningOutcomes: (syllabus.learningOutcomes || []).map((lo) => ({
      ...lo,
      indicativeContents: (lo.indicativeContents || []).map((ic) => ({
        ...ic,
        topics: (ic.topics || []).map((top) => ({
          ...top,
          subtopics: (top.subtopics || []).map((sub) => {
            if (sub && sub.id) {
              contentMap[sub.id] = sub.contentMarkdown || "";
            }
            return {
              ...sub,
              contentMarkdown: ""
            };
          })
        }))
      }))
    }))
  };

  const chunks = [];
  let currentChunk = {};
  let currentSize = 0;

  for (const [subId, markdown] of Object.entries(contentMap)) {
    const itemSize = subId.length + (markdown ? markdown.length : 0) + 16;
    if (currentSize + itemSize > 350000 && Object.keys(currentChunk).length > 0) {
      chunks.push(currentChunk);
      currentChunk = {};
      currentSize = 0;
    }
    currentChunk[subId] = markdown;
    currentSize += itemSize;
  }
  if (Object.keys(currentChunk).length > 0) {
    chunks.push(currentChunk);
  }

  skeleton._chunkCount = chunks.length;
  return { skeletonSyllabus: skeleton, chunks };
}

function reassembleChunkedSyllabus(skeleton, chunkDocs) {
  const fullContentMap = {};
  const sorted = [...chunkDocs].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  for (const c of sorted) {
    if (c.contents && typeof c.contents === "object") {
      Object.assign(fullContentMap, c.contents);
    }
  }

  return {
    ...skeleton,
    learningOutcomes: (skeleton.learningOutcomes || []).map((lo) => ({
      ...lo,
      indicativeContents: (lo.indicativeContents || []).map((ic) => ({
        ...ic,
        topics: (ic.topics || []).map((top) => ({
          ...top,
          subtopics: (top.subtopics || []).map((sub) => ({
            ...sub,
            contentMarkdown: fullContentMap[sub.id] !== undefined ? fullContentMap[sub.id] : (sub.contentMarkdown || "")
          }))
        }))
      }))
    }))
  };
}

async function saveSyllabusWithChunking(syllabus) {
  const serialized = JSON.stringify(syllabus);
  const isLarge = serialized.length > 600000;
  console.log(`Saving syllabus "${syllabus.courseCode}": size = ${serialized.length} bytes (chunked = ${isLarge})`);

  if (isLarge) {
    const { skeletonSyllabus, chunks } = partitionContentIntoChunks(syllabus);
    await setDoc(doc(db, "syllabi", syllabus.id), skeletonSyllabus);
    console.log(`Root skeleton doc saved with ${chunks.length} chunks.`);

    for (let i = 0; i < chunks.length; i++) {
      await setDoc(doc(db, "syllabi", syllabus.id, "chunks", `chunk_${i}`), {
        index: i,
        contents: chunks[i]
      });
      console.log(`Saved chunk_${i} (${JSON.stringify(chunks[i]).length} bytes)`);
    }
  } else {
    await setDoc(doc(db, "syllabi", syllabus.id), {
      ...syllabus,
      _isChunked: false,
      _chunkCount: 0
    });
    console.log("Direct doc saved without chunking.");
  }
}

async function getSyllabusByIdWithChunking(id) {
  const snap = await getDoc(doc(db, "syllabi", id));
  if (!snap.exists()) return null;
  const raw = { id: snap.id, ...snap.data() };
  if (raw._isChunked) {
    const chunksSnap = await getDocs(collection(db, "syllabi", id, "chunks"));
    const chunkList = [];
    chunksSnap.forEach(c => chunkList.push(c.data()));
    return reassembleChunkedSyllabus(raw, chunkList);
  }
  return raw;
}

async function run() {
  console.log("=== STEP 1: TEST CHUNKING OVER 1.2MB ===");
  const testId = "test-chunk-" + Date.now();
  const dummyLargeSyllabus = {
    id: testId,
    title: "Test Large Syllabus",
    courseCode: "TEST999",
    description: "Big course",
    tradeId: "trade-1785861602651",
    level: "Level 4",
    status: "published",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    learningOutcomes: [
      {
        id: "lo-1",
        code: "LO1",
        title: "Large Outcome",
        order: 1,
        indicativeContents: [
          {
            id: "ic-1",
            code: "IC1.1",
            title: "Large Content",
            order: 1,
            topics: [
              {
                id: "top-1",
                title: "Large Topic",
                order: 1,
                subtopics: [
                  {
                    id: "sub-1",
                    title: "Subtopic 1",
                    order: 1,
                    contentMarkdown: "A".repeat(500000) // 500 KB
                  },
                  {
                    id: "sub-2",
                    title: "Subtopic 2",
                    order: 2,
                    contentMarkdown: "B".repeat(500000) // 500 KB
                  },
                  {
                    id: "sub-3",
                    title: "Subtopic 3",
                    order: 3,
                    contentMarkdown: "C".repeat(300000) // 300 KB -> Total 1.3 MB!
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  await saveSyllabusWithChunking(dummyLargeSyllabus);
  console.log("Fetching and verifying test chunking...");
  const loaded = await getSyllabusByIdWithChunking(testId);
  if (!loaded) throw new Error("Could not load test syllabus!");
  const sub1 = loaded.learningOutcomes[0].indicativeContents[0].topics[0].subtopics[0];
  const sub2 = loaded.learningOutcomes[0].indicativeContents[0].topics[0].subtopics[1];
  const sub3 = loaded.learningOutcomes[0].indicativeContents[0].topics[0].subtopics[2];
  if (sub1.contentMarkdown.length === 500000 && sub2.contentMarkdown.length === 500000 && sub3.contentMarkdown.length === 300000) {
    console.log("CHUNK TEST PASSED WITH 100% INTEGRITY!");
  } else {
    throw new Error("Content mismatch in chunk test!");
  }

  // Cleanup test docs
  const testChunks = await getDocs(collection(db, "syllabi", testId, "chunks"));
  for (const c of testChunks.docs) {
    await deleteDoc(doc(db, "syllabi", testId, "chunks", c.id));
  }
  await deleteDoc(doc(db, "syllabi", testId));
  console.log("Test doc cleaned up.\n");

  console.log("=== STEP 2: RESTORE SWDDA401 COURSE IN FIRESTORE ===");
  const courseId = "syllabus-1789707950917"; // Restore under original ID or standard ID

  const swdda401Course = {
    id: courseId,
    title: "Data Structure And Algorithm Fundamental using JavaScript",
    courseCode: "SWDDA401",
    department: "Software Development & Database Systems",
    instructor: "Josef Marie",
    description: "Learning Outcome 1: Apply algorithm Fundamentals. Learning Outcome 2: Apply Data Structure. Learning Outcome 3: Apply Sorting and Searching Techniques.",
    tradeId: "trade-1785861602651",
    level: "Level 4",
    status: "published",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    learningOutcomes: [
      {
        id: "lo-1-" + Date.now(),
        code: "LO1",
        title: "Apply Algorithm Fundamentals",
        order: 1,
        description: "Analyze, design, and express algorithms using flowcharts, pseudocode, and time/space complexity analysis.",
        indicativeContents: [
          {
            id: "ic-1-1-" + Date.now(),
            code: "IC1.1",
            title: "Algorithm Overview & Characteristics",
            order: 1,
            topics: [
              {
                id: "top-1-1-1-" + Date.now(),
                title: "1.1: Core Concepts of Algorithms",
                order: 1,
                subtopics: [
                  {
                    id: "sub-1-1-1-1-" + Date.now(),
                    title: "1.1.1.: Description of key concepts of Algorithm fundamentals",
                    order: 1,
                    contentMarkdown: `### 1.1.1. Description of Key Concepts of Algorithm Fundamentals

An **algorithm** is a well-defined sequence of unambiguous, step-by-step instructions designed to solve a specific computational problem or perform a calculation.

#### Fundamental Properties of Algorithms:
1. **Finiteness**: An algorithm must always terminate after a finite number of steps.
2. **Definiteness**: Each step must be clearly and unambiguously defined.
3. **Input**: An algorithm takes zero or more well-defined inputs.
4. **Output**: An algorithm produces one or more well-defined outputs meeting the desired objective.
5. **Effectiveness**: Operations must be basic enough that they can in principle be carried out exactly and in finite time.

\`\`\`javascript
// Example: Basic Algorithm for finding the Maximum in an Array
function findMaximum(arr) {
  if (!arr || arr.length === 0) return null;
  let max = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > max) {
      max = arr[i];
    }
  }
  return max;
}

const numbers = [23, 5, 87, 42, 19, 99, 14];
console.log("Maximum element is:", findMaximum(numbers)); // Output: 99
\`\`\`
`,
                    codeSnippet: {
                      id: "code-algo-1",
                      title: "Find Maximum Element",
                      language: "javascript",
                      code: `function findMaximum(arr) {\n  if (!arr || arr.length === 0) return null;\n  let max = arr[0];\n  for (let i = 1; i < arr.length; i++) {\n    if (arr[i] > max) max = arr[i];\n  }\n  return max;\n}\n\nconst numbers = [23, 5, 87, 42, 19, 99, 14];\nconsole.log("Max is:", findMaximum(numbers));`
                    }
                  },
                  {
                    id: "sub-1-1-1-2-" + Date.now(),
                    title: "1.1.2.: Expression of Algorithms (Pseudocode & Flowcharts)",
                    order: 2,
                    contentMarkdown: `### 1.1.2. Expression of Algorithms

Algorithms can be formally and informally represented using several standard conventions:

1. **Natural Language**: High-level English descriptions. Simple to convey, but prone to ambiguity.
2. **Pseudocode**: An informal high-level description of an operating principle of a computer program, blending structured programming syntax with plain language.
3. **Flowcharts**: Graphical representations using standardized symbols:
   - **Oval**: Terminal (Start / End)
   - **Parallelogram**: Input / Output operations
   - **Rectangle**: Process / Calculation step
   - **Diamond**: Decision / Conditional branching
   - **Arrow**: Flowline indicating execution order
`
                  }
                ]
              },
              {
                id: "top-1-1-2-" + Date.now(),
                title: "1.2: Asymptotic Analysis & Big-O Notation",
                order: 2,
                subtopics: [
                  {
                    id: "sub-1-1-2-1-" + Date.now(),
                    title: "1.2.1.: Time Complexity & Space Complexity",
                    order: 1,
                    contentMarkdown: `### 1.2.1. Time & Space Complexity Analysis

Algorithm efficiency is measured in terms of two fundamental computational resources:
- **Time Complexity**: The computational time required as a function of input size *n*.
- **Space Complexity**: The amount of working memory required by the algorithm during execution.

#### Standard Complexity Classes (From Fastest to Slowest):
- **O(1)**: Constant Time (e.g., array index lookup)
- **O(log n)**: Logarithmic Time (e.g., binary search)
- **O(n)**: Linear Time (e.g., linear search)
- **O(n log n)**: Linearithmic Time (e.g., merge sort, quicksort average)
- **O(n²)**: Quadratic Time (e.g., bubble sort, nested loops)
- **O(2ⁿ)**: Exponential Time (e.g., recursive Fibonacci without memoization)
`
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        id: "lo-2-" + Date.now(),
        code: "LO2",
        title: "Apply Linear Data Structures",
        order: 2,
        description: "Understand and implement arrays, linked lists, stacks, and queues in JavaScript.",
        indicativeContents: [
          {
            id: "ic-2-1-" + Date.now(),
            code: "IC2.1",
            title: "Arrays & Linked Lists",
            order: 1,
            topics: [
              {
                id: "top-2-1-1-" + Date.now(),
                title: "2.1: Arrays and Dynamic Contiguous Storage",
                order: 1,
                subtopics: [
                  {
                    id: "sub-2-1-1-1-" + Date.now(),
                    title: "2.1.1.: Memory Layout & Array Operations in JavaScript",
                    order: 1,
                    contentMarkdown: `### 2.1.1. Arrays in JavaScript

An **array** is a linear data structure containing contiguous memory blocks accessible by numeric index.

\`\`\`javascript
// Array operations and complexity
const fruits = ["Apple", "Banana", "Cherry"];

// O(1) Access
console.log(fruits[1]); // "Banana"

// O(1) Push to end
fruits.push("Date");

// O(n) Unshift (prepend requires shifting all elements)
fruits.unshift("Avocado");
\`\`\`
`
                  }
                ]
              },
              {
                id: "top-2-1-2-" + Date.now(),
                title: "2.2: Singly and Doubly Linked Lists",
                order: 2,
                subtopics: [
                  {
                    id: "sub-2-1-2-1-" + Date.now(),
                    title: "2.2.1.: Node Architecture & Pointer Traversal",
                    order: 1,
                    contentMarkdown: `### 2.2.1. Singly Linked List Implementation

A **Linked List** consists of independent nodes where each node contains data and a reference (\`next\`) to the subsequent node.

\`\`\`javascript
class ListNode {
  constructor(value) {
    this.value = value;
    this.next = null;
  }
}

class LinkedList {
  constructor() {
    this.head = null;
  }

  append(value) {
    const newNode = new ListNode(value);
    if (!this.head) {
      this.head = newNode;
      return;
    }
    let current = this.head;
    while (current.next) {
      current = current.next;
    }
    current.next = newNode;
  }
}
\`\`\`
`
                  }
                ]
              }
            ]
          },
          {
            id: "ic-2-2-" + Date.now(),
            code: "IC2.2",
            title: "Stacks & Queues",
            order: 2,
            topics: [
              {
                id: "top-2-2-1-" + Date.now(),
                title: "2.3: Stacks (LIFO Principle)",
                order: 1,
                subtopics: [
                  {
                    id: "sub-2-2-1-1-" + Date.now(),
                    title: "2.3.1.: Stack Operations (Push, Pop, Peek)",
                    order: 1,
                    contentMarkdown: `### 2.3.1. Stacks (Last In, First Out)

A **stack** is a linear collection governed by the LIFO (Last-In, First-Out) discipline. Essential operations include:
- \`push(item)\`: Insert item onto top of stack — O(1)
- \`pop()\`: Remove and return top item — O(1)
- \`peek()\`: Examine top item without removal — O(1)
`
                  }
                ]
              },
              {
                id: "top-2-2-2-" + Date.now(),
                title: "2.4: Queues (FIFO Principle)",
                order: 2,
                subtopics: [
                  {
                    id: "sub-2-2-2-1-" + Date.now(),
                    title: "2.4.1.: Queue Operations (Enqueue, Dequeue)",
                    order: 1,
                    contentMarkdown: `### 2.4.1. Queues (First In, First Out)

A **queue** follows FIFO (First-In, First-Out) semantics where elements enter at the rear and exit at the front.
`
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        id: "lo-3-" + Date.now(),
        code: "LO3",
        title: "Apply Sorting and Searching Techniques",
        order: 3,
        description: "Implement and compare searching (Linear, Binary) and sorting (Bubble, Insertion, Merge, Quick) algorithms.",
        indicativeContents: [
          {
            id: "ic-3-1-" + Date.now(),
            code: "IC3.1",
            title: "Searching Algorithms",
            order: 1,
            topics: [
              {
                id: "top-3-1-1-" + Date.now(),
                title: "3.1: Linear & Binary Search",
                order: 1,
                subtopics: [
                  {
                    id: "sub-3-1-1-1-" + Date.now(),
                    title: "3.1.1.: Binary Search Implementation on Sorted Arrays",
                    order: 1,
                    contentMarkdown: `### 3.1.1. Binary Search

Binary search locates a target value within a **sorted array** in logarithmic time **O(log n)** by repeatedly dividing the search interval in half.

\`\`\`javascript
function binarySearch(arr, target) {
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return -1; // Not found
}

const sortedList = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91];
console.log("Index of 23:", binarySearch(sortedList, 23)); // Output: 5
\`\`\`
`,
                    codeSnippet: {
                      id: "code-binsearch-1",
                      title: "Binary Search",
                      language: "javascript",
                      code: `function binarySearch(arr, target) {\n  let left = 0, right = arr.length - 1;\n  while (left <= right) {\n    const mid = Math.floor((left + right) / 2);\n    if (arr[mid] === target) return mid;\n    if (arr[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}\n\nconst list = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91];\nconsole.log("Index of 23 is:", binarySearch(list, 23));`
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

  await saveSyllabusWithChunking(swdda401Course);
  console.log("SWDDA401 COURSE SUCCESSFULLY PUBLISHED TO FIRESTORE!");

  const check = await getSyllabusByIdWithChunking(courseId);
  console.log(`Verification: "${check.title}" is in Firestore! Total LOs: ${check.learningOutcomes.length}`);
}

run().then(() => process.exit(0)).catch(e => {
  console.error("FATAL ERROR:", e);
  process.exit(1);
});
