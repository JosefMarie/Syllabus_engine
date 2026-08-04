import { PresenceState, StudentPresenceRecord } from "@/types/presence";
import { db, isFirebaseConfigured } from "./firebase";
import { collection, doc, setDoc, getDocs } from "firebase/firestore";

const PRESENCE_KEY = "syllabus_student_presence_records";

export async function updateStudentPresence(
  userId: string,
  fullName: string,
  state: PresenceState,
  currentSubtopicTitle?: string,
  syllabusTitle?: string
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
    } catch (e) {
      console.error("Localstorage updateStudentPresence error:", e);
    }
  }

  return record;
}

export async function getAllStudentPresences(): Promise<Record<string, StudentPresenceRecord>> {
  const map: Record<string, StudentPresenceRecord> = {};

  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, "presence"));
      if (!snap.empty) {
        snap.docs.forEach((d) => {
          const rec = d.data() as StudentPresenceRecord;
          map[rec.userId] = rec;
        });
      }
    } catch (e) {
      console.warn("Firestore getAllStudentPresences error:", e);
    }
  }

  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(PRESENCE_KEY);
      if (saved) {
        const localMap: Record<string, StudentPresenceRecord> = JSON.parse(saved);
        Object.assign(map, localMap);
      }
    } catch (e) {
      console.error("Localstorage getAllStudentPresences error:", e);
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
