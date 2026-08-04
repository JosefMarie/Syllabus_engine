import { Syllabus, Citation } from "@/types/syllabus";
import { DEMO_SYLLABI_LIST, DEMO_SYLLABUS } from "./demoData";
import { db, isFirebaseConfigured } from "./firebase";
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from "firebase/firestore";

const STORAGE_KEY = "syllabus_platform_syllabi_v1";
const PROGRESS_KEY = "syllabus_platform_progress_v1";

// Helper to load local storage syllabi
function getLocalSyllabi(): Syllabus[] {
  if (typeof window === "undefined") return DEMO_SYLLABI_LIST;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_SYLLABI_LIST));
      return DEMO_SYLLABI_LIST;
    }
    return JSON.parse(saved);
  } catch (e) {
    console.error("Error reading local syllabi store:", e);
    return DEMO_SYLLABI_LIST;
  }
}

// Helper to save local storage syllabi
function saveLocalSyllabi(list: Syllabus[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Error saving local syllabi store:", e);
  }
}

// Build fast lookup citations map across the 5 levels
export function buildCitationsDictionary(syllabus: Syllabus): Record<string, Citation> {
  const dictionary: Record<string, Citation> = { ...(syllabus.citationsDictionary || {}) };

  syllabus.learningOutcomes?.forEach((lo) => {
    lo.indicativeContents?.forEach((ic) => {
      ic.topics?.forEach((top) => {
        top.subtopics?.forEach((sub) => {
          sub.citations?.forEach((cit) => {
            if (cit.term) {
              const lower = cit.term.toLowerCase();
              if (!dictionary[lower]) {
                dictionary[lower] = cit;
              }
            }
          });
        });
      });
    });
  });

  return dictionary;
}

export async function getAllSyllabi(): Promise<Syllabus[]> {
  if (isFirebaseConfigured && db) {
    try {
      const q = query(collection(db, "syllabi"));
      const snapshot = await getDocs(q);
      const items: Syllabus[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as Syllabus);
      });
      if (items.length > 0) return items;
    } catch (err) {
      console.warn("Firestore fetch error, falling back to local store:", err);
    }
  }
  return getLocalSyllabi();
}

export async function getSyllabusById(id: string): Promise<Syllabus | null> {
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, "syllabi", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as Syllabus;
        data.citationsDictionary = buildCitationsDictionary(data);
        return data;
      }
    } catch (err) {
      console.warn("Firestore doc fetch error:", err);
    }
  }
  
  const localList = getLocalSyllabi();
  const found = localList.find((s) => s.id === id) || (id === DEMO_SYLLABUS.id ? DEMO_SYLLABUS : null);
  if (found) {
    found.citationsDictionary = buildCitationsDictionary(found);
  }
  return found;
}

export async function saveSyllabus(syllabus: Syllabus): Promise<Syllabus> {
  const updated = {
    ...syllabus,
    updatedAt: new Date().toISOString(),
    citationsDictionary: buildCitationsDictionary(syllabus),
  };

  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "syllabi", updated.id), updated);
    } catch (err) {
      console.warn("Firestore save error, saving locally:", err);
    }
  }

  const list = getLocalSyllabi();
  const index = list.findIndex((s) => s.id === updated.id);
  if (index >= 0) {
    list[index] = updated;
  } else {
    list.unshift(updated);
  }
  saveLocalSyllabi(list);
  return updated;
}

export async function deleteSyllabus(id: string): Promise<boolean> {
  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, "syllabi", id));
    } catch (err) {
      console.warn("Firestore delete error:", err);
    }
  }
  const list = getLocalSyllabi().filter((s) => s.id !== id);
  saveLocalSyllabi(list);
  return true;
}

// Student Reading Progress tracking
export function getSubtopicProgress(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function toggleSubtopicProgress(subtopicId: string): boolean {
  if (typeof window === "undefined") return false;
  const current = getSubtopicProgress();
  const nextState = !current[subtopicId];
  current[subtopicId] = nextState;
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(current));
  } catch (e) {
    console.error("Error saving progress state:", e);
  }
  return nextState;
}
