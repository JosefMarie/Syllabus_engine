import { Syllabus, Citation } from "@/types/syllabus";
import { Trade, UserProfile, AccountStatus } from "@/types/auth";
import { StudentNotification, StudentProgressSummary } from "@/types/notification";
import { DEMO_SYLLABI_LIST, DEMO_SYLLABUS } from "./demoData";
import { db, isFirebaseConfigured } from "./firebase";
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc,
  deleteDoc, 
  query,
  where,
  orderBy
} from "firebase/firestore";

const STORAGE_KEY = "syllabus_platform_syllabi_v1";
const PROGRESS_KEY = "syllabus_platform_progress_v1";
const TRADES_KEY = "syllabus_platform_trades_v1";
const USERS_KEY = "syllabus_platform_users_v1";

const DEFAULT_TRADES: Trade[] = [
  {
    id: "trade-sw-eng",
    name: "Software Engineering & Web Systems",
    description: "Full-stack web application development, algorithms, and cloud systems.",
    createdAt: new Date().toISOString()
  },
  {
    id: "trade-networking",
    name: "Networking & Cyber Security",
    description: "Network architecture, security protocols, and ethical hacking.",
    createdAt: new Date().toISOString()
  },
  {
    id: "trade-data-ai",
    name: "Data Science & Applied AI",
    description: "Machine learning models, data pipelines, and AI engineering.",
    createdAt: new Date().toISOString()
  }
];

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
      
      // Seed default demo syllabi to Firestore if collection is empty
      for (const demoSyllabus of DEMO_SYLLABI_LIST) {
        await setDoc(doc(db, "syllabi", demoSyllabus.id), demoSyllabus);
      }
      return DEMO_SYLLABI_LIST;
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

// ----------------------------------------------------
// TRADES MANAGEMENT (Teacher Created)
// ----------------------------------------------------
export async function getAllTrades(): Promise<Trade[]> {
  if (isFirebaseConfigured && db) {
    try {
      const q = query(collection(db, "trades"));
      const snapshot = await getDocs(q);
      const items: Trade[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as Trade);
      });
      if (items.length > 0) return items;

      // Seed default trades to Firestore if collection is empty
      for (const t of DEFAULT_TRADES) {
        await setDoc(doc(db, "trades", t.id), t);
      }
      return DEFAULT_TRADES;
    } catch (e) {
      console.warn("Firestore trades fetch error, using local trades:", e);
    }
  }

  if (typeof window === "undefined") return DEFAULT_TRADES;
  try {
    const saved = localStorage.getItem(TRADES_KEY);
    if (!saved) {
      localStorage.setItem(TRADES_KEY, JSON.stringify(DEFAULT_TRADES));
      return DEFAULT_TRADES;
    }
    return JSON.parse(saved);
  } catch (e) {
    return DEFAULT_TRADES;
  }
}

export async function saveTrade(trade: Trade): Promise<Trade> {
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "trades", trade.id), trade);
    } catch (e) {
      console.warn("Firestore saveTrade error:", e);
    }
  }

  const list = await getAllTrades();
  const idx = list.findIndex(t => t.id === trade.id);
  if (idx >= 0) list[idx] = trade;
  else list.unshift(trade);
  if (typeof window !== "undefined") {
    localStorage.setItem(TRADES_KEY, JSON.stringify(list));
  }
  return trade;
}

export async function deleteTrade(id: string): Promise<boolean> {
  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, "trades", id));
    } catch (e) {
      console.warn("Firestore deleteTrade error:", e);
    }
  }

  const list = (await getAllTrades()).filter(t => t.id !== id);
  if (typeof window !== "undefined") {
    localStorage.setItem(TRADES_KEY, JSON.stringify(list));
  }
  return true;
}

// ----------------------------------------------------
// USER & STUDENT APPROVAL MANAGEMENT
// ----------------------------------------------------
export async function getAllUserProfiles(): Promise<UserProfile[]> {
  if (isFirebaseConfigured && db) {
    try {
      const q = query(collection(db, "userProfiles"));
      const snapshot = await getDocs(q);
      const items: UserProfile[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
      });
      return items; // Return all user profiles fetched from Firestore
    } catch (e) {
      console.warn("Firestore userProfiles fetch error:", e);
    }
  }

  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(USERS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
}

export async function registerUserProfile(profile: UserProfile): Promise<UserProfile> {
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "userProfiles", profile.uid), profile);
    } catch (e) {
      console.warn("Firestore user profile save error:", e);
    }
  }

  const users = await getAllUserProfiles();
  const idx = users.findIndex(u => u.uid === profile.uid);
  if (idx >= 0) users[idx] = profile;
  else users.push(profile);
  if (typeof window !== "undefined") {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
  return profile;
}

export async function updateStudentStatus(uid: string, status: AccountStatus): Promise<boolean> {
  const users = await getAllUserProfiles();
  const user = users.find(u => u.uid === uid);
  if (user) {
    user.status = status;
    await registerUserProfile(user);
    return true;
  }
  return false;
}

// ----------------------------------------------------
// ACTIVITY & AUDIT LOGGING MANAGEMENT
// ----------------------------------------------------
import { ActivityLog } from "@/types/activity";
const ACTIVITIES_KEY = "syllabus_platform_activities_v1";

export async function getAllActivities(): Promise<ActivityLog[]> {
  if (isFirebaseConfigured && db) {
    try {
      const q = query(collection(db, "activities"));
      const snapshot = await getDocs(q);
      const items: ActivityLog[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as ActivityLog);
      });
      if (items.length > 0) {
        return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }
    } catch (e) {
      console.warn("Firestore activities fetch error:", e);
    }
  }

  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(ACTIVITIES_KEY);
    const list: ActivityLog[] = saved ? JSON.parse(saved) : [];
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (e) {
    return [];
  }
}

export async function logActivity(log: Omit<ActivityLog, "id" | "timestamp">): Promise<ActivityLog> {
  const fullLog: ActivityLog = {
    ...log,
    id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    timestamp: new Date().toISOString(),
  };

  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "activities", fullLog.id), fullLog);
    } catch (e) {
      console.warn("Firestore logActivity error:", e);
    }
  }

  if (typeof window !== "undefined") {
    try {
      const existing = await getAllActivities();
      existing.unshift(fullLog);
      // Keep latest 200 activity logs
      localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(existing.slice(0, 200)));
    } catch (e) {
      console.error("Localstorage logActivity error:", e);
    }
  }

  return fullLog;
}

// NOTIFICATION STORAGE & RETRIEVAL SYSTEM
const NOTIFICATIONS_KEY = "syllabus_student_notifications";

export async function sendStudentNotification(
  userId: string,
  senderName: string,
  message: string
): Promise<StudentNotification> {
  const notif: StudentNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    userId,
    senderName,
    message,
    createdAt: new Date().toISOString(),
    read: false,
  };

  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "notifications", notif.id), notif);
    } catch (e) {
      console.warn("Firestore sendNotification error:", e);
    }
  }

  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(NOTIFICATIONS_KEY);
      const list: StudentNotification[] = saved ? JSON.parse(saved) : [];
      list.unshift(notif);
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(list));
    } catch (e) {
      console.error("Localstorage sendNotification error:", e);
    }
  }

  return notif;
}

export async function getStudentNotifications(userId: string): Promise<StudentNotification[]> {
  if (isFirebaseConfigured && db) {
    try {
      const q = query(
        collection(db, "notifications"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs.map((d) => d.data() as StudentNotification);
      }
    } catch (e) {
      console.warn("Firestore getStudentNotifications error:", e);
    }
  }

  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(NOTIFICATIONS_KEY);
      const list: StudentNotification[] = saved ? JSON.parse(saved) : [];
      return list
        .filter((n) => n.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (e) {
      return [];
    }
  }

  return [];
}

export async function markNotificationAsRead(id: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
    } catch (e) {
      console.warn("Firestore markNotificationAsRead error:", e);
    }
  }

  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(NOTIFICATIONS_KEY);
      if (saved) {
        const list: StudentNotification[] = JSON.parse(saved);
        const updated = list.map((n) => (n.id === id ? { ...n, read: true } : n));
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
      }
    } catch (e) {
      console.error("Localstorage markNotificationAsRead error:", e);
    }
  }
}

export async function getStudentProgressSummaries(): Promise<StudentProgressSummary[]> {
  const users = await getAllUserProfiles();
  const students = users.filter((u) => u.role === "student");
  const syllabi = await getAllSyllabi();
  const activities = await getAllActivities();
  const progressMap = getSubtopicProgress();

  // Total count of subtopics in system
  let totalSubtopics = 0;
  syllabi.forEach((s) => {
    s.learningOutcomes.forEach((lo) => {
      lo.indicativeContents.forEach((ic) => {
        ic.topics.forEach((top) => {
          totalSubtopics += top.subtopics.length;
        });
      });
    });
  });

  const completedIds = Object.keys(progressMap).filter((k) => progressMap[k]);
  const completedCount = completedIds.length;

  const summaries: StudentProgressSummary[] = [];

  for (const s of students) {
    const studentActs = activities.filter((a) => a.userId === s.uid);
    const lastAct = studentActs.length > 0 ? studentActs[0].timestamp : s.createdAt;
    const notifs = await getStudentNotifications(s.uid);
    const unread = notifs.filter((n) => !n.read).length;

    // Estimate progress based on activity or local progress map
    const studentCompleted = completedCount;
    const totalCount = Math.max(totalSubtopics, 1);
    const percent = Math.min(100, Math.round((studentCompleted / totalCount) * 100));

    summaries.push({
      userId: s.uid,
      fullName: s.fullName,
      email: s.email,
      username: s.username,
      tradeId: s.tradeId,
      level: s.level,
      status: s.status,
      completedSubtopicsCount: studentCompleted,
      totalSubtopicsCount: totalCount,
      progressPercent: percent,
      lastActive: lastAct,
      unreadNotificationsCount: unread,
    });
  }

  return summaries;
}
