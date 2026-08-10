import { Syllabus, Citation } from "@/types/syllabus";
import { Trade, UserProfile, AccountStatus } from "@/types/auth";
import { StudentNotification, StudentProgressSummary } from "@/types/notification";
import { ActivityLog } from "@/types/activity";
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
const ACTIVITIES_KEY = "syllabus_platform_activities_v1";

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

/**
 * Sanitizes object by converting undefined values to null or deleting them,
 * preventing Firestore 'invalid data: undefined' rejection errors.
 */
function sanitizeForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore);
  }
  if (typeof obj === "object") {
    const clean: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        clean[key] = sanitizeForFirestore(val);
      }
    }
    return clean;
  }
  return obj;
}

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
  const firestoreMap = new Map<string, Syllabus>();

  if (isFirebaseConfigured && db) {
    try {
      const q = query(collection(db, "syllabi"));
      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => {
        firestoreMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as Syllabus);
      });
    } catch (err) {
      console.warn("Firestore fetch error, falling back to local store:", err);
    }
  }

  const localList = getLocalSyllabi();
  
  // Merge items: combine Firestore items with local storage items
  const mergedMap = new Map<string, Syllabus>();
  firestoreMap.forEach((val, key) => mergedMap.set(key, val));
  localList.forEach((val) => mergedMap.set(val.id, val));

  const items = Array.from(mergedMap.values());
  if (items.length === 0) return DEMO_SYLLABI_LIST;
  return items;
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
  const updated: Syllabus = {
    ...syllabus,
    updatedAt: new Date().toISOString(),
    citationsDictionary: buildCitationsDictionary(syllabus),
  };

  const sanitized = sanitizeForFirestore(updated);

  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "syllabi", updated.id), sanitized);
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

const CURRENT_USER_KEY = "syllabus_platform_current_user_v1";

export function getLocalCurrentUser(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function saveLocalCurrentUser(user: UserProfile | null) {
  if (typeof window === "undefined") return;
  if (!user) {
    localStorage.removeItem(CURRENT_USER_KEY);
  } else {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  }
}

export async function getAllUserProfiles(): Promise<UserProfile[]> {
  if (isFirebaseConfigured && db) {
    try {
      const snapshot = await getDocs(collection(db, "users"));
      const items: UserProfile[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
      });
      if (items.length > 0) return items;
    } catch (err) {
      console.warn("Firestore fetch users error:", err);
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

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const sanitized = sanitizeForFirestore(profile);
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "users", profile.uid), sanitized);
    } catch (err) {
      console.warn("Firestore save user error:", err);
    }
  }

  if (typeof window === "undefined") return;
  try {
    const saved = localStorage.getItem(USERS_KEY);
    const users: UserProfile[] = saved ? JSON.parse(saved) : [];
    const idx = users.findIndex((u) => u.uid === profile.uid);
    if (idx >= 0) {
      users[idx] = profile;
    } else {
      users.push(profile);
    }
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.error("Error saving user profile locally:", e);
  }
}

export async function updateUserStatus(uid: string, status: AccountStatus): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      await updateDoc(doc(db, "users", uid), { status });
    } catch (err) {
      console.warn("Firestore update status error:", err);
    }
  }

  if (typeof window === "undefined") return;
  try {
    const saved = localStorage.getItem(USERS_KEY);
    if (saved) {
      const users: UserProfile[] = JSON.parse(saved);
      const idx = users.findIndex((u) => u.uid === uid);
      if (idx >= 0) {
        users[idx].status = status;
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
      }
    }
  } catch (e) {
    console.error("Error updating user status locally:", e);
  }
}

const TRADES_INIT_KEY = "syllabus_platform_trades_init_v1";

export async function getAllTrades(): Promise<Trade[]> {
  if (isFirebaseConfigured && db) {
    try {
      const snapshot = await getDocs(collection(db, "trades"));
      const items: Trade[] = [];
      snapshot.forEach((docSnap) => {
        if (docSnap.id === "_meta") return;
        const data = docSnap.data();
        items.push({ ...data, id: data.id || docSnap.id } as Trade);
      });

      const metaSnap = await getDoc(doc(db, "trades", "_meta"));
      const isInitLocal = typeof window !== "undefined" && localStorage.getItem(TRADES_INIT_KEY);

      if (items.length > 0 || metaSnap.exists() || isInitLocal) {
        return items;
      }

      // First-time initialization ONLY: set _meta doc and seed default trades
      await setDoc(doc(db, "trades", "_meta"), { initialized: true });
      for (const trade of DEFAULT_TRADES) {
        await setDoc(doc(db, "trades", trade.id), trade);
      }
      if (typeof window !== "undefined") {
        localStorage.setItem(TRADES_INIT_KEY, "true");
        localStorage.setItem(TRADES_KEY, JSON.stringify(DEFAULT_TRADES));
      }
      return DEFAULT_TRADES;
    } catch (err) {
      console.warn("Firestore fetch trades error:", err);
    }
  }

  if (typeof window === "undefined") return DEFAULT_TRADES;
  try {
    const isInit = localStorage.getItem(TRADES_INIT_KEY);
    const saved = localStorage.getItem(TRADES_KEY);
    if (!saved && !isInit) {
      localStorage.setItem(TRADES_INIT_KEY, "true");
      localStorage.setItem(TRADES_KEY, JSON.stringify(DEFAULT_TRADES));
      return DEFAULT_TRADES;
    }
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
}

export async function saveTrade(trade: Trade): Promise<Trade> {
  const sanitized = sanitizeForFirestore(trade);
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "trades", "_meta"), { initialized: true });
      await setDoc(doc(db, "trades", trade.id), sanitized);
    } catch (err) {
      console.warn("Firestore save trade error:", err);
    }
  }

  let list: Trade[] = [];
  if (typeof window !== "undefined") {
    localStorage.setItem(TRADES_INIT_KEY, "true");
    const saved = localStorage.getItem(TRADES_KEY);
    if (saved) {
      try { list = JSON.parse(saved); } catch (e) {}
    }
  }
  const idx = list.findIndex((t) => t.id === trade.id);
  if (idx >= 0) {
    list[idx] = trade;
  } else {
    list.unshift(trade);
  }
  if (typeof window !== "undefined") {
    localStorage.setItem(TRADES_KEY, JSON.stringify(list));
  }
  return trade;
}

export async function deleteTrade(id: string): Promise<boolean> {
  if (isFirebaseConfigured && db) {
    try {
      // Set meta doc so empty collection doesn't re-seed default trades
      await setDoc(doc(db, "trades", "_meta"), { initialized: true });

      // 1. Delete directly by document ID matching id
      await deleteDoc(doc(db, "trades", id));

      // 2. Query and delete any docs where field 'id' matches (handles auto-generated Firestore doc IDs)
      const q = query(collection(db, "trades"), where("id", "==", id));
      const qSnap = await getDocs(q);
      for (const docSnap of qSnap.docs) {
        if (docSnap.id !== "_meta") {
          await deleteDoc(doc(db, "trades", docSnap.id));
        }
      }
    } catch (err) {
      console.warn("Firestore delete trade error:", err);
    }
  }

  if (typeof window !== "undefined") {
    localStorage.setItem(TRADES_INIT_KEY, "true");
    const saved = localStorage.getItem(TRADES_KEY);
    if (saved) {
      try {
        const list = JSON.parse(saved).filter((t: Trade) => t.id !== id);
        localStorage.setItem(TRADES_KEY, JSON.stringify(list));
      } catch (e) {}
    }
  }
  return true;
}

export async function getStudentProgressMap(userId: string): Promise<Record<string, boolean>> {
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, "userProgress", userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data().progressMap || {};
      }
    } catch (err) {
      console.warn("Firestore progress fetch error:", err);
    }
  }

  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`${PROGRESS_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export async function saveStudentProgressMap(userId: string, progressMap: Record<string, boolean>): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "userProgress", userId), { progressMap, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      console.warn("Firestore progress save error:", err);
    }
  }

  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${PROGRESS_KEY}_${userId}`, JSON.stringify(progressMap));
  } catch (e) {
    console.error("Error saving progress map locally:", e);
  }
}

export async function getAllStudentProgressSummaries(): Promise<StudentProgressSummary[]> {
  const users = await getAllUserProfiles();
  const students = users.filter(u => u.role === 'student');

  const allSyllabi = await getAllSyllabi();
  const publishedSyllabi = allSyllabi.filter(s => s.status === 'published' || !s.status);

  const summaries: StudentProgressSummary[] = [];
  for (const student of students) {
    const pMap = await getStudentProgressMap(student.uid);
    const notifs = await getStudentNotifications(student.uid);
    const unreadCount = notifs.filter(n => !n.read && !(n as any).isRead).length;

    // Filter published syllabi applicable to this student's level & trade
    const studentSyllabi = publishedSyllabi.filter(syl => {
      const sylLevel = syl.level || (syl.courseCode?.includes("5") ? "Level 5" : syl.courseCode?.includes("3") ? "Level 3" : "Level 4");
      const matchesLevel = !student.level || sylLevel === student.level;
      const matchesTrade = !student.tradeId || student.tradeId === "all" || syl.tradeId === student.tradeId;
      return matchesLevel && matchesTrade;
    });

    // Extract all valid subtopics from matching published syllabi
    let totalSubtopicsCount = 0;
    let completedSubtopicsCount = 0;

    studentSyllabi.forEach(syl => {
      syl.learningOutcomes.forEach(lo => {
        lo.indicativeContents.forEach(ic => {
          ic.topics.forEach(top => {
            top.subtopics.forEach(sub => {
              totalSubtopicsCount++;
              if (pMap[sub.id]) {
                completedSubtopicsCount++;
              }
            });
          });
        });
      });
    });

    const progressPercent = totalSubtopicsCount > 0
      ? Math.min(100, Math.round((completedSubtopicsCount / totalSubtopicsCount) * 100))
      : 0;

    summaries.push({
      userId: student.uid,
      fullName: student.fullName,
      email: student.email,
      username: student.username,
      tradeId: student.tradeId,
      level: student.level,
      status: student.status,
      completedSubtopicsCount,
      totalSubtopicsCount,
      progressPercent,
      lastActive: student.createdAt || new Date().toISOString(),
      unreadNotificationsCount: unreadCount
    });
  }
  return summaries;
}

const NOTIFICATIONS_KEY = "syllabus_platform_notifications_v1";

export async function sendNotificationToStudent(
  studentUidOrNotification: string | Omit<StudentNotification, 'id' | 'createdAt'>,
  senderNameArg?: string,
  messageArg?: string
): Promise<StudentNotification> {
  let notificationData: any;

  if (typeof studentUidOrNotification === 'string') {
    notificationData = {
      userId: studentUidOrNotification,
      senderName: senderNameArg || "Teacher Admin",
      message: messageArg || "",
      read: false,
    };
  } else {
    notificationData = {
      ...studentUidOrNotification,
      read: false,
    };
  }

  const newNotif: StudentNotification = {
    ...notificationData,
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
    read: false
  };

  const sanitized = sanitizeForFirestore(newNotif);

  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "studentNotifications", newNotif.id), sanitized);
    } catch (err) {
      console.warn("Firestore notification save error:", err);
    }
  }

  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(NOTIFICATIONS_KEY);
      const list: StudentNotification[] = saved ? JSON.parse(saved) : [];
      list.unshift(newNotif);
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(list));
    } catch (e) {
      console.error("Local notification save error:", e);
    }
  }

  return newNotif;
}

export async function getStudentNotifications(studentUid: string): Promise<StudentNotification[]> {
  if (isFirebaseConfigured && db) {
    try {
      const q = query(
        collection(db, "studentNotifications"),
        where("userId", "==", studentUid)
      );
      const snapshot = await getDocs(q);
      const items: StudentNotification[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as StudentNotification);
      });
      if (items.length > 0) return items;
    } catch (err) {
      console.warn("Firestore notifications fetch error:", err);
    }
  }

  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(NOTIFICATIONS_KEY);
    const list: StudentNotification[] = saved ? JSON.parse(saved) : [];
    return list.filter(n => n.userId === studentUid || (n as any).studentUid === studentUid);
  } catch (e) {
    return [];
  }
}

export async function markNotificationAsRead(id: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      await updateDoc(doc(db, "studentNotifications", id), { read: true, isRead: true });
    } catch (err) {
      console.warn("Firestore update notification error:", err);
    }
  }

  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(NOTIFICATIONS_KEY);
      if (saved) {
        const list: StudentNotification[] = JSON.parse(saved);
        const idx = list.findIndex(n => n.id === id);
        if (idx >= 0) {
          list[idx].read = true;
          (list[idx] as any).isRead = true;
          localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(list));
        }
      }
    } catch (e) {
      console.error("Local update notification error:", e);
    }
  }
}

export async function logActivity(entry: Omit<ActivityLog, 'id' | 'timestamp'>): Promise<ActivityLog> {
  const newLog: ActivityLog = {
    ...entry,
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString()
  };

  const sanitized = sanitizeForFirestore(newLog);

  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "activityLogs", newLog.id), sanitized);
    } catch (err) {
      console.warn("Firestore activity log error:", err);
    }
  }

  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(ACTIVITIES_KEY);
      const list: ActivityLog[] = saved ? JSON.parse(saved) : [];
      list.unshift(newLog);
      localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(list.slice(0, 200)));
    } catch (e) {
      console.error("Local activity log error:", e);
    }
  }

  return newLog;
}

export async function getAllActivityLogs(): Promise<ActivityLog[]> {
  if (isFirebaseConfigured && db) {
    try {
      const q = query(collection(db, "activityLogs"), orderBy("timestamp", "desc"));
      const snapshot = await getDocs(q);
      const items: ActivityLog[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as ActivityLog);
      });
      if (items.length > 0) return items;
    } catch (err) {
      console.warn("Firestore fetch activities error:", err);
    }
  }

  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(ACTIVITIES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
}

// Progress and user management aliases
export function getSubtopicProgress(userId?: string): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const user = userId ? null : getLocalCurrentUser();
    const uid = userId || user?.uid || "guest";
    const raw = localStorage.getItem(`${PROGRESS_KEY}_${uid}`);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export async function getSubtopicProgressAsync(userId: string): Promise<Record<string, boolean>> {
  return getStudentProgressMap(userId);
}

export function toggleSubtopicProgress(userIdOrSubtopicId: string, maybeSubtopicId?: string): Record<string, boolean> {
  let uid: string;
  let subtopicId: string;

  if (maybeSubtopicId) {
    uid = userIdOrSubtopicId;
    subtopicId = maybeSubtopicId;
  } else {
    const user = getLocalCurrentUser();
    uid = user?.uid || "guest";
    subtopicId = userIdOrSubtopicId;
  }

  const current = getSubtopicProgress(uid);
  const updated = { ...current, [subtopicId]: !current[subtopicId] };
  saveStudentProgressMap(uid, updated);
  return updated;
}

export const registerUserProfile = saveUserProfile;
export const updateStudentStatus = updateUserStatus;
export const getStudentProgressSummaries = getAllStudentProgressSummaries;
export const sendStudentNotification = sendNotificationToStudent;
export const getAllActivities = getAllActivityLogs;
