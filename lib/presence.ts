import { PresenceState, StudentPresenceRecord } from "@/types/presence";
import { db, isFirebaseConfigured } from "./firebase";
import { collection, doc, setDoc, getDocs, onSnapshot } from "firebase/firestore";

const PRESENCE_KEY = "syllabus_student_presence_records";

export function getLocalStudentPresences(): Record<string, StudentPresenceRecord> {
  if (typeof window === "undefined") return {};
  try {
    const saved = localStorage.getItem(PRESENCE_KEY);
    if (!saved) return {};
    const map: Record<string, StudentPresenceRecord> = JSON.parse(saved);
    const nowMs = Date.now();
    Object.keys(map).forEach((uid) => {
      const lastMs = new Date(map[uid].lastActive).getTime();
      if (nowMs - lastMs > 120000) {
        map[uid].state = 'offline';
      }
    });
    return map;
  } catch (e) {
    return {};
  }
}

export async function updateStudentPresence(
  userId: string,
  fullName: string,
  state: PresenceState,
  currentSubtopicTitle?: string,
  syllabusTitle?: string,
  unfocusedDurationSeconds?: number
): Promise<StudentPresenceRecord> {
  const now = new Date().toISOString();
  const record: StudentPresenceRecord = {
    userId,
    fullName,
    state,
    currentSubtopicTitle: currentSubtopicTitle || "",
    syllabusTitle: syllabusTitle || "",
    lastActive: now,
    lastFocused: state === 'actively_reading' ? now : new Date().toISOString(),
    unfocusedDurationSeconds: typeof unfocusedDurationSeconds === 'number' ? unfocusedDurationSeconds : 0,
  };

  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "presence", userId), record, { merge: true });
    } catch (e) {
      console.warn("Firestore updateStudentPresence error:", e);
    }
  }

  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(PRESENCE_KEY);
      const map: Record<string, StudentPresenceRecord> = saved ? JSON.parse(saved) : {};
      map[userId] = { ...map[userId], ...record };
      localStorage.setItem(PRESENCE_KEY, JSON.stringify(map));
      window.dispatchEvent(new CustomEvent("syllabus_presence_updated", { detail: map }));
    } catch (e) {
      console.error("Localstorage updateStudentPresence error:", e);
    }
  }

  return record;
}

export async function getAllStudentPresences(): Promise<Record<string, StudentPresenceRecord>> {
  const map: Record<string, StudentPresenceRecord> = getLocalStudentPresences();

  if (isFirebaseConfigured && db) {
    try {
      // Timeout query after 3 seconds so it never hangs
      const fetchPromise = getDocs(collection(db, "presence"));
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
      const snap: any = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (snap && !snap.empty) {
        snap.docs.forEach((d: any) => {
          const rec = d.data() as StudentPresenceRecord;
          map[rec.userId] = rec;
        });
      }
    } catch (e) {
      console.warn("Firestore getAllStudentPresences error:", e);
    }
  }

  // Determine offline threshold (2 minutes = 120000ms)
  const nowMs = Date.now();
  Object.keys(map).forEach((uid) => {
    const lastMs = new Date(map[uid].lastActive).getTime();
    if (nowMs - lastMs > 120000) {
      map[uid].state = 'offline';
    }
  });

  return map;
}

/**
 * Real-time instant subscription to all students' presence & attention states.
 * Combines Firestore onSnapshot with local storage and custom events for 0ms reactivity.
 */
export function subscribeToStudentPresences(
  callback: (presences: Record<string, StudentPresenceRecord>) => void
): () => void {
  let unsubFirestore: (() => void) | null = null;

  // 1. Immediately emit local data so UI renders instantaneously
  callback(getLocalStudentPresences());

  // 2. Attach real-time Firestore listener
  if (isFirebaseConfigured && db) {
    try {
      unsubFirestore = onSnapshot(
        collection(db, "presence"),
        (snap) => {
          const map: Record<string, StudentPresenceRecord> = getLocalStudentPresences();
          snap.docs.forEach((d) => {
            const rec = d.data() as StudentPresenceRecord;
            map[rec.userId] = rec;
          });
          const nowMs = Date.now();
          Object.keys(map).forEach((uid) => {
            const lastMs = new Date(map[uid].lastActive).getTime();
            if (nowMs - lastMs > 120000) {
              map[uid].state = 'offline';
            }
          });
          callback({ ...map });
        },
        (err) => {
          console.warn("Firestore presence subscription error:", err);
          callback(getLocalStudentPresences());
        }
      );
    } catch (e) {
      console.warn("Failed to attach presence onSnapshot:", e);
    }
  }

  // 3. Attach local cross-tab event listeners
  const handleStorage = (e: StorageEvent) => {
    if (e.key === PRESENCE_KEY) {
      callback(getLocalStudentPresences());
    }
  };

  const handleCustom = (e: any) => {
    if (e.detail) {
      callback({ ...e.detail });
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
    window.addEventListener("syllabus_presence_updated", handleCustom);
  }

  return () => {
    if (unsubFirestore) unsubFirestore();
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("syllabus_presence_updated", handleCustom);
    }
  };
}
