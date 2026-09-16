import { Syllabus, Citation } from "@/types/syllabus";
import { Trade, UserProfile, AccountStatus } from "@/types/auth";
import { StudentNotification, StudentProgressSummary } from "@/types/notification";
import { ActivityLog } from "@/types/activity";
import { StudentTopicTimeRecord } from "@/types/timeTracking";
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
  orderBy,
  onSnapshot
} from "firebase/firestore";
import { 
  queueOfflineSyllabus, 
  removePendingOfflineSyllabus, 
  getPendingOfflineSyllabi,
  queueOfflineProgress, 
  syncPendingOfflineChanges 
} from "./sync";

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
/**
 * Sanitizes object by converting undefined values to null or deleting them,
 * preventing Firestore 'invalid data: undefined' rejection errors.
 */
export function sanitizeForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.filter((item) => item !== undefined).map(sanitizeForFirestore);
  }
  if (typeof obj === "object") {
    if (obj instanceof Date) {
      return obj.toISOString();
    }
    const clean: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined && typeof val !== "function") {
        clean[key] = sanitizeForFirestore(val);
      }
    }
    return clean;
  }
  return obj;
}

// Helper to check if a syllabus is obsolete mock/demo data
function isDemoOrMockSyllabus(s: Syllabus): boolean {
  if (!s) return true;
  const id = (s.id || "").toLowerCase();
  const code = (s.courseCode || "").toLowerCase();
  const title = (s.title || "").toLowerCase();

  if (
    id.includes("demo-") ||
    id === "cs100" ||
    id === "cs101" ||
    id === "cs102" ||
    code === "cs100" ||
    code === "cs101" ||
    code === "cs102" ||
    title.includes("fundamentals of computer systems") ||
    title.includes("modern full-stack web development") ||
    title.includes("advanced distributed systems & llm")
  ) {
    return true;
  }
  return false;
}

const SINGLE_SYLLABUS_PREFIX = "syllabus_single_v2_";

/**
 * Frees up localStorage if QuotaExceededError is encountered.
 * Aggressively purges bloated caches and preserves only critical session tokens.
 */
export function cleanupLocalStorageQuota(): void {
  if (typeof window === "undefined") return;
  try {
    const preservedKeys = new Set([
      "syllabus_platform_current_user_v1",
      "syllabus_admin_session_v1",
      "syllabus_auth_session_v1",
      "syllabus_admin_presence_sound"
    ]);

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (preservedKeys.has(k)) continue;
      if (k.startsWith("firebase:authUser")) continue;

      // Purge all firestore internal tokens, old offline queues, activities, and old dumps
      if (
        k.startsWith("firestore_") ||
        k.startsWith("firebase:") ||
        k.startsWith("syllabus_offline_queue_") ||
        k === "syllabus_platform_activities_v1" ||
        k === "syllabus_platform_syllabi_v1" ||
        k.startsWith("syllabus_single_")
      ) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    // Ignore cleanup errors
  }
}

/**
 * Creates a lightweight summary of a syllabus for the catalog/admin list
 * to prevent exceeding browser localStorage 5MB quota.
 */
function getSyllabusSummary(s: Syllabus): Syllabus {
  return {
    ...s,
    learningOutcomes: (s.learningOutcomes || []).map((lo) => ({
      id: lo.id,
      code: lo.code,
      order: lo.order,
      title: lo.title,
      description: lo.description,
      indicativeContents: (lo.indicativeContents || []).map((ic) => ({
        id: ic.id,
        code: ic.code,
        order: ic.order,
        title: ic.title,
        topics: (ic.topics || []).map((top) => ({
          id: top.id,
          order: top.order,
          title: top.title,
          subtopics: (top.subtopics || []).map((sub) => ({
            id: sub.id,
            order: sub.order,
            title: sub.title,
            contentMarkdown: "", // Truncate content in summary to save localStorage quota
          }))
        }))
      }))
    }))
  };
}

// Helper to load local storage syllabi
export function getLocalSyllabi(): Syllabus[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    // Scrub any legacy mock/demo syllabi from past sessions
    const cleaned = parsed.filter((s) => !isDemoOrMockSyllabus(s));
    return cleaned;
  } catch (e) {
    console.error("Error reading local syllabi store:", e);
    return [];
  }
}

// Helper to save local storage syllabi safely without throwing QuotaExceededError
function saveLocalSyllabi(list: Syllabus[]) {
  if (typeof window === "undefined") return;
  try {
    const summaryList = list.map((s) => getSyllabusSummary(s));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(summaryList));
  } catch (e) {
    console.warn("Storage quota warning on saveLocalSyllabi, cleaning up quota...", e);
    try {
      cleanupLocalStorageQuota();
      const minimalList = list.map((s) => ({
        id: s.id,
        title: s.title || "Untitled Course",
        courseCode: s.courseCode || "",
        department: s.department || "",
        instructor: s.instructor || "",
        description: s.description || "",
        status: s.status || "draft",
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        tradeId: s.tradeId,
        level: s.level,
        learningOutcomes: []
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalList));
    } catch (e2) {
      console.error("Error saving minimal local syllabi store:", e2);
    }
  }
}

export function getSingleLocalSyllabus(id: string): Syllabus | null {
  if (typeof window === "undefined" || !id) return null;
  const key = `${SINGLE_SYLLABUS_PREFIX}${id}`;
  // 1. Check sessionStorage first (per-tab buffer, never hits localStorage quota)
  try {
    const sessRaw = sessionStorage.getItem(key);
    if (sessRaw) {
      const parsed = JSON.parse(sessRaw);
      if (parsed && parsed.id === id) return parsed;
    }
  } catch (e) {
    // Ignore
  }

  // 2. Check localStorage
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id === id) return parsed;
    }
  } catch (e) {
    // Ignore
  }
  return null;
}

export function saveSingleLocalSyllabus(syllabus: Syllabus): void {
  if (typeof window === "undefined" || !syllabus || !syllabus.id) return;
  const key = `${SINGLE_SYLLABUS_PREFIX}${syllabus.id}`;
  const serialized = JSON.stringify(syllabus);

  // 1. Always save in sessionStorage (failsafe against localStorage quota exhaustion)
  try {
    sessionStorage.setItem(key, serialized);
  } catch (sessErr) {
    // Ignore session storage errors
  }

  // 2. Save in localStorage with auto-cleanup
  try {
    localStorage.setItem(key, serialized);
  } catch (quotaErr) {
    try {
      cleanupLocalStorageQuota();
      localStorage.setItem(key, serialized);
    } catch (e) {
      console.warn("Could not cache single syllabus to localStorage even after cleanup:", e);
    }
  }
}

export function removeSingleLocalSyllabus(id: string): void {
  if (typeof window === "undefined" || !id) return;
  try {
    localStorage.removeItem(`${SINGLE_SYLLABUS_PREFIX}${id}`);
  } catch (e) {
    // Ignore
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
            if (cit && cit.term && cit.term.trim()) {
              const lower = cit.term.trim().toLowerCase();
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
  const mergedMap = new Map<string, Syllabus>();

  const localList = getLocalSyllabi();
  const pendingList = getPendingOfflineSyllabi();
  const localCandidates = [...localList, ...pendingList];

  // Prime map with local candidates immediately so UI displays instantly without lag
  localCandidates.forEach((localSyl) => {
    if (!localSyl || !localSyl.id || isDemoOrMockSyllabus(localSyl)) return;
    mergedMap.set(localSyl.id, localSyl);
  });

  if (isFirebaseConfigured && db) {
    try {
      const q = query(collection(db, "syllabi"));
      const fetchPromise = getDocs(q);
      // If we already have local syllabi, allow 4s. If starting empty, allow 12s for cloud fetch.
      const timeoutMs = localCandidates.length > 0 ? 4000 : 12000;
      const timeoutPromise = new Promise<null>((resolve) => 
        setTimeout(() => resolve(null), timeoutMs)
      );
      const snapshot = await Promise.race([fetchPromise, timeoutPromise]);
      if (snapshot && 'forEach' in snapshot) {
        const firestoreList: Syllabus[] = [];
        snapshot.forEach((docSnap) => {
          const val = { id: docSnap.id, ...docSnap.data() } as Syllabus;
          if (!isDemoOrMockSyllabus(val)) {
            firestoreList.push(val);
            const existing = mergedMap.get(docSnap.id);
            if (!existing) {
              mergedMap.set(docSnap.id, val);
            } else {
              const firestoreTime = new Date(val.updatedAt || 0).getTime();
              const existingTime = new Date(existing.updatedAt || 0).getTime();
              if (firestoreTime >= existingTime) {
                mergedMap.set(docSnap.id, val);
              }
            }
          }
        });
        // Cache refreshed list locally
        if (firestoreList.length > 0) {
          saveLocalSyllabi(Array.from(mergedMap.values()));
        }
      }
    } catch (err) {
      console.warn("Firestore fetch error, using cached store:", err);
    }
  }

  const items = Array.from(mergedMap.values());
  return items;
}

export async function getSyllabusById(id: string): Promise<Syllabus | null> {
  if (!id) return null;

  // 1. Check dedicated single syllabus cache first (has full content markdown)
  const singleDoc = getSingleLocalSyllabus(id);
  const localList = getLocalSyllabi();
  const localDoc = singleDoc || localList.find((s) => s.id === id) || null;
  const pendingList = getPendingOfflineSyllabi();
  const pendingDoc = pendingList.find((s) => s.id === id) || null;

  let firestoreDoc: Syllabus | null = null;
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, "syllabi", id);
      // If we already have a complete local version with content, allow 3s. Otherwise allow 15s.
      const hasFullContent = Boolean(
        localDoc &&
        localDoc.learningOutcomes &&
        localDoc.learningOutcomes.length > 0 &&
        localDoc.learningOutcomes[0]?.indicativeContents?.[0]?.topics?.[0]?.subtopics?.[0]?.contentMarkdown
      );
      const timeoutMs = hasFullContent ? 3000 : 15000;
      const fetchPromise = getDoc(docRef);
      const timeoutPromise = new Promise<null>((resolve) => 
        setTimeout(() => resolve(null), timeoutMs)
      );
      const docSnap = await Promise.race([fetchPromise, timeoutPromise]);
      if (docSnap && 'exists' in docSnap && docSnap.exists()) {
        firestoreDoc = { id: docSnap.id, ...docSnap.data() } as Syllabus;
        saveSingleLocalSyllabus(firestoreDoc);
      }
    } catch (err) {
      console.warn("Firestore doc fetch error:", err);
    }
  }

  // Resolve freshest version between cloud, local cache, and pending offline edits
  let freshest: Syllabus | null = firestoreDoc;

  if (localDoc) {
    if (!freshest) {
      freshest = localDoc;
    } else {
      const freshestTime = new Date(freshest.updatedAt || 0).getTime();
      const localTime = new Date(localDoc.updatedAt || 0).getTime();
      if (localTime >= freshestTime) {
        freshest = localDoc;
      }
    }
  }

  if (pendingDoc) {
    if (!freshest) {
      freshest = pendingDoc;
    } else {
      const freshestTime = new Date(freshest.updatedAt || 0).getTime();
      const pendingTime = new Date(pendingDoc.updatedAt || 0).getTime();
      if (pendingTime >= freshestTime) {
        freshest = pendingDoc;
      }
    }
  }

  if (freshest) {
    freshest.citationsDictionary = buildCitationsDictionary(freshest);
  }
  return freshest;
}

export async function saveSyllabus(syllabus: Syllabus): Promise<Syllabus> {
  const updated: Syllabus = {
    ...syllabus,
    updatedAt: new Date().toISOString(),
    citationsDictionary: buildCitationsDictionary(syllabus),
  };

  const sanitized = sanitizeForFirestore(updated);

  let firestoreSaved = false;
  let firestoreError: any = null;

  // 1. Always save full syllabus in dedicated local cache immediately
  saveSingleLocalSyllabus(updated);

  // 2. Update summary list in local storage
  try {
    const list = getLocalSyllabi();
    const index = list.findIndex((s) => s.id === updated.id);
    if (index >= 0) {
      list[index] = updated;
    } else {
      list.unshift(updated);
    }
    saveLocalSyllabi(list);
  } catch (localErr) {
    console.warn("Local storage cache save warning:", localErr);
  }

  // 3. Persist to Firestore if online
  if (isFirebaseConfigured && db && (typeof navigator === "undefined" || navigator.onLine)) {
    try {
      const setPromise = setDoc(doc(db, "syllabi", updated.id), sanitized);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Database write took longer than expected")), 15000)
      );
      await Promise.race([setPromise, timeoutPromise]);
      firestoreSaved = true;
      removePendingOfflineSyllabus(updated.id);
    } catch (err: any) {
      console.warn("Firestore write slow or queued for background sync:", err);
      firestoreError = err;
      queueOfflineSyllabus(updated);
    }
  } else {
    // Offline mode: queue for sync
    queueOfflineSyllabus(updated);
  }

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
  removeSingleLocalSyllabus(id);
  removePendingOfflineSyllabus(id);
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
  purgeStaleMockDataOnce();
  let items: UserProfile[] = [];
  if (isFirebaseConfigured && db) {
    try {
      const fetchPromise = getDocs(collection(db, "users"));
      const timeoutPromise = new Promise<null>((resolve) => 
        setTimeout(() => resolve(null), 3000)
      );
      const snapshot = await Promise.race([fetchPromise, timeoutPromise]);
      if (snapshot && 'forEach' in snapshot) {
        snapshot.forEach((docSnap) => {
          items.push({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
        });
        if (items.length > 0) {
          return items.filter(u => !u.uid.startsWith("demo-") && u.fullName !== "Alson Johns" && u.fullName !== "Angel Vanca");
        }
      }
    } catch (err) {
      console.warn("Firestore fetch users error:", err);
    }
  }

  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(USERS_KEY);
    const list: UserProfile[] = saved ? JSON.parse(saved) : [];
    return list.filter(u => !u.uid.startsWith("demo-") && u.fullName !== "Alson Johns" && u.fullName !== "Angel Vanca");
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
  const updatePayload: any = { status };
  if (status === 'approved') {
    updatePayload.unfocusedCount = 0;
    updatePayload.suspensionReason = "";
  }

  if (isFirebaseConfigured && db) {
    try {
      await updateDoc(doc(db, "users", uid), updatePayload);
      if (status === 'approved') {
        await setDoc(doc(db, "presence", uid), { unfocusedCount: 0 }, { merge: true });
      }
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
        if (status === 'approved') {
          users[idx].unfocusedCount = 0;
          users[idx].suspensionReason = "";
        }
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
      }
    }

    const current = getLocalCurrentUser();
    if (current && current.uid === uid) {
      current.status = status;
      if (status === 'approved') {
        current.unfocusedCount = 0;
        current.suspensionReason = "";
      }
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(current));
    }
    window.dispatchEvent(new CustomEvent("syllabus_presence_updated"));
    window.dispatchEvent(new CustomEvent("syllabus_user_profile_updated", { detail: { uid, status, unfocusedCount: status === 'approved' ? 0 : undefined } }));
  } catch (e) {
    console.error("Error updating user status locally:", e);
  }
}

/**
 * Records a student side-window / unfocused incident (strike).
 * If strikes reach 10, the student's account is automatically set to 'rejected' (suspended),
 * requiring the teacher to re-approve them in the admin portal before they can study again.
 */
export async function recordStudentUnfocusedIncident(userId: string): Promise<{ unfocusedCount: number; suspended: boolean }> {
  let count = 0;
  let user: UserProfile | null = null;

  // 1. Fetch latest authoritative user doc from Firestore if available
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDoc(doc(db, "users", userId));
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        user = { ...data, uid: data.uid || snap.id };
        count = typeof data.unfocusedCount === 'number' ? data.unfocusedCount : 0;

        // If the account is already suspended/rejected, lock at 10 and do NOT keep incrementing to 11, 12, 14...
        if (data.status === 'rejected') {
          return { unfocusedCount: Math.min(count || 10, 10), suspended: true };
        }
        // If the account is pending approval, do NOT increment strikes
        if (data.status === 'pending_approval') {
          return { unfocusedCount: 0, suspended: false };
        }
      }
    } catch (e) {}
  }

  // 2. Check local storage if Firestore wasn't queried or user wasn't found
  if (!user && typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(USERS_KEY);
      if (saved) {
        const users: UserProfile[] = JSON.parse(saved);
        user = users.find(u => u.uid === userId) || null;
        if (user) {
          count = user.unfocusedCount || 0;
          if (user.status === 'rejected') {
            return { unfocusedCount: Math.min(count || 10, 10), suspended: true };
          }
          if (user.status === 'pending_approval') {
            return { unfocusedCount: 0, suspended: false };
          }
        }
      }
    } catch (e) {}
  }

  // Also check if current local session is already suspended or pending approval
  if (typeof window !== "undefined") {
    const current = getLocalCurrentUser();
    if (current && current.uid === userId) {
      if (current.status === 'rejected') {
        return { unfocusedCount: Math.min(current.unfocusedCount || 10, 10), suspended: true };
      }
      if (current.status === 'pending_approval') {
        return { unfocusedCount: 0, suspended: false };
      }
    }
  }

  const newCount = count + 1;
  const suspended = newCount >= 10;
  const suspensionReason = suspended ? "Account suspended: Exceeded 10 side-window / focus violations." : "";

  // 3. Persist to Firestore
  if (isFirebaseConfigured && db) {
    try {
      const updateData: any = { unfocusedCount: newCount };
      if (suspended) {
        updateData.status = 'rejected';
        updateData.suspensionReason = suspensionReason;
      }
      await updateDoc(doc(db, "users", userId), updateData);
      // Mirror strike count to presence doc so admin sees it in real time
      await setDoc(doc(db, "presence", userId), { unfocusedCount: newCount }, { merge: true });
    } catch (e) {
      console.warn("Firestore recordStudentUnfocusedIncident error:", e);
    }
  }

  // 4. Persist to localStorage
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(USERS_KEY);
      if (saved) {
        const users: UserProfile[] = JSON.parse(saved);
        const idx = users.findIndex(u => u.uid === userId);
        if (idx >= 0) {
          users[idx].unfocusedCount = newCount;
          if (suspended) {
            users[idx].status = 'rejected';
            users[idx].suspensionReason = suspensionReason;
          }
          localStorage.setItem(USERS_KEY, JSON.stringify(users));
        }
      }

      // If current session is this student, update session and fire suspension event
      const current = getLocalCurrentUser();
      if (current && current.uid === userId) {
        current.unfocusedCount = newCount;
        if (suspended) {
          current.status = 'rejected';
          current.suspensionReason = suspensionReason;
        }
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(current));
        if (suspended) {
          window.dispatchEvent(new CustomEvent("syllabus_student_suspended", { 
            detail: { userId, count: newCount, reason: suspensionReason } 
          }));
        }
      }

      window.dispatchEvent(new CustomEvent("syllabus_presence_updated"));
      window.dispatchEvent(new CustomEvent("syllabus_user_profile_updated", { detail: { uid: userId, unfocusedCount: newCount, status: suspended ? 'rejected' : undefined } }));
    } catch (e) {
      console.error("Localstorage recordStudentUnfocusedIncident error:", e);
    }
  }

  // 5. Log activity if suspended
  if (suspended && user) {
    logActivity({
      userId: user.uid,
      userName: user.fullName,
      userEmail: user.email,
      userLevel: user.level,
      action: "REJECT_STUDENT",
      details: `Account auto-suspended: Student ${user.fullName} exceeded 10 side-window/unfocused violations. Requires teacher approval.`,
    }).catch(() => {});
  }

  return { unfocusedCount: newCount, suspended };
}

/**
 * Automatically suspends and locks down a student who remained continuously in a side window
 * or unfocused application for >= 3 minutes (180 seconds).
 */
export async function suspendStudentForUnfocusedTimeout(userId: string): Promise<boolean> {
  const suspensionReason = "Account suspended: Exceeded 3 minutes continuously in a side window / unfocused application without learning focus.";
  let user: UserProfile | null = null;

  // 1. Fetch user doc to get details for audit log
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDoc(doc(db, "users", userId));
      if (snap.exists()) {
        user = snap.data() as UserProfile;
      }
    } catch (e) {}
  }

  if (!user && typeof window !== "undefined") {
    user = getLocalCurrentUser();
  }

  // 2. Persist to Firestore
  if (isFirebaseConfigured && db) {
    try {
      await updateDoc(doc(db, "users", userId), {
        status: "rejected",
        suspensionReason,
      });
      await setDoc(doc(db, "presence", userId), { 
        state: "tab_unfocused",
        unfocusedDurationSeconds: 180 
      }, { merge: true });
    } catch (e) {
      console.warn("Firestore suspendStudentForUnfocusedTimeout error:", e);
    }
  }

  // 3. Persist to localStorage and notify active UI
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(USERS_KEY);
      if (saved) {
        const users: UserProfile[] = JSON.parse(saved);
        const idx = users.findIndex((u) => u.uid === userId);
        if (idx >= 0) {
          users[idx].status = "rejected";
          users[idx].suspensionReason = suspensionReason;
          localStorage.setItem(USERS_KEY, JSON.stringify(users));
        }
      }

      const current = getLocalCurrentUser();
      if (current && current.uid === userId) {
        current.status = "rejected";
        current.suspensionReason = suspensionReason;
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(current));
        window.dispatchEvent(new CustomEvent("syllabus_student_suspended", { 
          detail: { userId, count: current.unfocusedCount || 10, reason: suspensionReason } 
        }));
      }

      window.dispatchEvent(new CustomEvent("syllabus_presence_updated"));
      window.dispatchEvent(new CustomEvent("syllabus_user_profile_updated", { 
        detail: { uid: userId, status: "rejected" } 
      }));
    } catch (e) {
      console.error("Localstorage suspendStudentForUnfocusedTimeout error:", e);
    }
  }

  // 4. Log to teacher audit log
  if (user) {
    logActivity({
      userId: user.uid,
      userName: user.fullName,
      userEmail: user.email,
      userLevel: user.level,
      action: "REJECT_STUDENT",
      details: `Disciplinary lockdown: Student ${user.fullName} remained in a side window for over 3 minutes continuously without focus.`,
    }).catch(() => {});
  }

  return true;
}

/**
 * Resets a student's unfocused strikes back to 0 and transitions account to pending_approval.
 * This changes the student's disciplinary lockdown screen to pending approval in real-time,
 * allowing the instructor to approve them to resume studying where they left off.
 */
export async function resetStudentUnfocusedCount(userId: string): Promise<void> {
  const updateData = {
    unfocusedCount: 0,
    suspensionReason: "",
    status: "pending_approval" as AccountStatus,
  };

  if (isFirebaseConfigured && db) {
    try {
      await updateDoc(doc(db, "users", userId), updateData);
      await setDoc(doc(db, "presence", userId), { unfocusedCount: 0 }, { merge: true });
    } catch (e) {
      console.warn("Firestore resetStudentUnfocusedCount error:", e);
    }
  }

  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(USERS_KEY);
      if (saved) {
        const users: UserProfile[] = JSON.parse(saved);
        const idx = users.findIndex(u => u.uid === userId);
        if (idx >= 0) {
          users[idx].unfocusedCount = 0;
          users[idx].suspensionReason = "";
          users[idx].status = "pending_approval";
          localStorage.setItem(USERS_KEY, JSON.stringify(users));
        }
      }

      const current = getLocalCurrentUser();
      if (current && current.uid === userId) {
        current.unfocusedCount = 0;
        current.suspensionReason = "";
        current.status = "pending_approval";
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(current));
      }
      window.dispatchEvent(new CustomEvent("syllabus_presence_updated"));
      window.dispatchEvent(new CustomEvent("syllabus_user_profile_updated", { 
        detail: { uid: userId, unfocusedCount: 0, status: "pending_approval" } 
      }));
    } catch (e) {}
  }
}

/**
 * Real-time subscription to a specific student's profile (status, unfocusedCount, etc.)
 * Listens to Firestore onSnapshot on /users/{userId} and syncs cross-device updates in real time.
 */
export function subscribeToUserProfile(
  userId: string,
  callback: (user: UserProfile | null) => void
): () => void {
  if (!userId) {
    return () => {};
  }

  let unsubFirestore: (() => void) | null = null;

  if (isFirebaseConfigured && db) {
    try {
      unsubFirestore = onSnapshot(
        doc(db, "users", userId),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            const updatedProfile: UserProfile = {
              ...data,
              uid: data.uid || snap.id,
            };

            // Keep local storage synchronized in real-time across devices
            if (typeof window !== "undefined") {
              try {
                const current = getLocalCurrentUser();
                if (current && current.uid === userId) {
                  const merged = { ...current, ...updatedProfile };
                  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(merged));
                }

                const saved = localStorage.getItem(USERS_KEY);
                if (saved) {
                  const users: UserProfile[] = JSON.parse(saved);
                  const idx = users.findIndex((u) => u.uid === userId);
                  if (idx >= 0) {
                    users[idx] = { ...users[idx], ...updatedProfile };
                    localStorage.setItem(USERS_KEY, JSON.stringify(users));
                  }
                }
              } catch (e) {}
            }

            callback(updatedProfile);
          } else {
            callback(null);
          }
        },
        (err) => {
          console.warn("Firestore subscribeToUserProfile error:", err);
        }
      );
    } catch (e) {
      console.warn("Failed to attach subscribeToUserProfile onSnapshot:", e);
    }
  }

  // Also listen to local custom events for instant same-tab or cross-tab updates
  const handleLocalUpdate = (e: any) => {
    if (e.detail && e.detail.uid === userId) {
      const user = getLocalCurrentUser();
      if (user && user.uid === userId) {
        callback(user);
      }
    }
  };

  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === CURRENT_USER_KEY || e.key === USERS_KEY) {
      const user = getLocalCurrentUser();
      if (user && user.uid === userId) {
        callback(user);
      }
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("syllabus_user_profile_updated", handleLocalUpdate);
    window.addEventListener("storage", handleStorageChange);
  }

  return () => {
    if (unsubFirestore) unsubFirestore();
    if (typeof window !== "undefined") {
      window.removeEventListener("syllabus_user_profile_updated", handleLocalUpdate);
      window.removeEventListener("storage", handleStorageChange);
    }
  };
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
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    queueOfflineProgress({ userId, syllabusId: "", progressMap });
  } else if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "userProgress", userId), { progressMap, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      console.warn("Firestore progress save error, queueing offline:", err);
      queueOfflineProgress({ userId, syllabusId: "", progressMap });
    }
  }

  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${PROGRESS_KEY}_${userId}`, JSON.stringify(progressMap));
  } catch (e) {
    console.error("Error saving progress map locally:", e);
  }
}

export function getLocalStudentProgressSummaries(): StudentProgressSummary[] {
  if (typeof window === "undefined") return [];
  try {
    const savedUsers = localStorage.getItem(USERS_KEY);
    const users: UserProfile[] = savedUsers ? JSON.parse(savedUsers) : [];
    const students = users.filter(u => u.role === 'student' && !u.uid.startsWith("demo-") && u.fullName !== "Alson Johns" && u.fullName !== "Angel Vanca");
    const allSyllabi = getLocalSyllabi();
    const publishedSyllabi = allSyllabi.filter(s => s.status === 'published' || !s.status);

    const savedNotifs = localStorage.getItem(NOTIFICATIONS_KEY);
    const notifs: StudentNotification[] = savedNotifs ? JSON.parse(savedNotifs) : [];

    const summaries: StudentProgressSummary[] = [];
    for (const student of students) {
      const pMap = getSubtopicProgress(student.uid);
      const unreadCount = notifs.filter(n => 
        (n.userId === student.uid || (n as any).studentUid === student.uid) && !n.read && !(n as any).isRead
      ).length;

      const studentSyllabi = publishedSyllabi.filter(syl => {
        const sylLevel = syl.level || (syl.courseCode?.includes("5") ? "Level 5" : syl.courseCode?.includes("3") ? "Level 3" : "Level 4");
        const matchesLevel = !student.level || sylLevel === student.level;
        const matchesTrade = !student.tradeId || student.tradeId === "all" || syl.tradeId === student.tradeId;
        return matchesLevel && matchesTrade;
      });

      let totalSubtopicsCount = 0;
      let completedSubtopicsCount = 0;

      studentSyllabi.forEach(syl => {
        syl.learningOutcomes?.forEach(lo => {
          lo.indicativeContents?.forEach(ic => {
            ic.topics?.forEach(top => {
              top.subtopics?.forEach(sub => {
                totalSubtopicsCount++;
                if (pMap && pMap[sub.id]) completedSubtopicsCount++;
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
        unreadNotificationsCount: unreadCount,
        unfocusedCount: student.unfocusedCount || 0,
        suspensionReason: student.suspensionReason || ""
      });
    }
    return summaries;
  } catch (e) {
    return [];
  }
}

export async function getAllStudentProgressSummaries(): Promise<StudentProgressSummary[]> {
  try {
    // 1. Initial fast local emission to avoid waiting on network
    const localSummaries = getLocalStudentProgressSummaries();

    if (!isFirebaseConfigured || !db) {
      return localSummaries;
    }

    // 2. Fetch all collections in parallel with a 3.5s timeout wrapper
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500));

    const result: any = await Promise.race([
      Promise.all([
        getDocs(collection(db, "users")),
        getAllSyllabi(),
        getDocs(collection(db, "userProgress")),
        getDocs(collection(db, "studentNotifications")),
      ]),
      timeoutPromise
    ]);

    if (!result || !result[0]) {
      return localSummaries;
    }

    const [usersSnap, syllabiList, progressSnap, notifsSnap] = result;

    // Process users
    const users: UserProfile[] = [];
    usersSnap.forEach((docSnap: any) => {
      users.push({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
    });
    const students = users.filter(u => u.role === 'student' && !u.uid.startsWith("demo-") && u.fullName !== "Alson Johns" && u.fullName !== "Angel Vanca");

    const publishedSyllabi = (syllabiList || []).filter((s: Syllabus) => s.status === 'published' || !s.status);

    // Map progress by user
    const progressMapByUser: Record<string, Record<string, boolean>> = {};
    if (progressSnap) {
      progressSnap.forEach((d: any) => {
        progressMapByUser[d.id] = d.data()?.progressMap || {};
      });
    }

    // Map unread notifications by user
    const unreadCountByUser: Record<string, number> = {};
    if (notifsSnap) {
      notifsSnap.forEach((d: any) => {
        const data = d.data();
        const uid = data.userId || data.studentUid;
        if (uid && !data.read && !data.isRead) {
          unreadCountByUser[uid] = (unreadCountByUser[uid] || 0) + 1;
        }
      });
    }

    const summaries: StudentProgressSummary[] = [];
    for (const student of students) {
      const pMap = progressMapByUser[student.uid] || getSubtopicProgress(student.uid);
      const unreadCount = unreadCountByUser[student.uid] || 0;

      const studentSyllabi = publishedSyllabi.filter((syl: Syllabus) => {
        const sylLevel = syl.level || (syl.courseCode?.includes("5") ? "Level 5" : syl.courseCode?.includes("3") ? "Level 3" : "Level 4");
        const matchesLevel = !student.level || sylLevel === student.level;
        const matchesTrade = !student.tradeId || student.tradeId === "all" || syl.tradeId === student.tradeId;
        return matchesLevel && matchesTrade;
      });

      let totalSubtopicsCount = 0;
      let completedSubtopicsCount = 0;

      studentSyllabi.forEach((syl: Syllabus) => {
        syl.learningOutcomes?.forEach(lo => {
          lo.indicativeContents?.forEach(ic => {
            ic.topics?.forEach(top => {
              top.subtopics?.forEach(sub => {
                totalSubtopicsCount++;
                if (pMap && pMap[sub.id]) {
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
        unreadNotificationsCount: unreadCount,
        unfocusedCount: student.unfocusedCount || 0,
        suspensionReason: student.suspensionReason || ""
      });
    }

    return summaries.length > 0 ? summaries : localSummaries;
  } catch (err) {
    console.warn("getAllStudentProgressSummaries encountered an error, falling back to local:", err);
    return getLocalStudentProgressSummaries();
  }
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
      window.dispatchEvent(new CustomEvent("syllabus_notification_received", { detail: newNotif }));
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
      if (items.length > 0) {
        return items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      }
    } catch (err) {
      console.warn("Firestore notifications fetch error:", err);
    }
  }

  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(NOTIFICATIONS_KEY);
    const list: StudentNotification[] = saved ? JSON.parse(saved) : [];
    return list
      .filter(n => n.userId === studentUid || (n as any).studentUid === studentUid)
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  } catch (e) {
    return [];
  }
}

/**
 * Real-time subscription to student messages/notifications without page refresh.
 * Combines Firestore onSnapshot with local cross-tab event listeners and safety polling.
 */
export function subscribeToStudentNotifications(
  studentUid: string,
  callback: (notifications: StudentNotification[]) => void
): () => void {
  if (!studentUid) return () => {};

  let unsubFirestore: (() => void) | null = null;

  const emitLatest = async () => {
    try {
      const notifs = await getStudentNotifications(studentUid);
      callback(notifs);
    } catch (e) {}
  };

  // 1. Initial emission
  emitLatest();

  // 2. Real-time Firestore live listener
  if (isFirebaseConfigured && db) {
    try {
      const q = query(
        collection(db, "studentNotifications"),
        where("userId", "==", studentUid)
      );
      unsubFirestore = onSnapshot(
        q,
        (snapshot) => {
          const items: StudentNotification[] = [];
          snapshot.forEach((docSnap) => {
            items.push({ id: docSnap.id, ...docSnap.data() } as StudentNotification);
          });
          items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
          callback(items);
        },
        (err) => {
          console.warn("Firestore real-time notification listener error:", err);
          emitLatest();
        }
      );
    } catch (e) {
      console.warn("Failed to attach Firestore snapshot listener:", e);
    }
  }

  // 3. Browser Storage and Custom Event Listeners (for cross-tab & local instant delivery)
  const handleStorage = (e: StorageEvent) => {
    if (e.key === NOTIFICATIONS_KEY) {
      emitLatest();
    }
  };

  const handleCustomEvent = (e: any) => {
    const notif = e.detail as StudentNotification;
    if (notif && (notif.userId === studentUid || (notif as any).studentUid === studentUid)) {
      emitLatest();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
    window.addEventListener("syllabus_notification_received", handleCustomEvent);
  }

  // 4. Fallback polling heartbeat (every 3.5s) to guarantee real-time receipt even if stream drops
  const intervalId = setInterval(() => {
    emitLatest();
  }, 3500);

  return () => {
    if (unsubFirestore) {
      unsubFirestore();
    }
    clearInterval(intervalId);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("syllabus_notification_received", handleCustomEvent);
    }
  };
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
          window.dispatchEvent(new CustomEvent("syllabus_notification_received", { detail: list[idx] }));
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

// ==========================================
// STUDENT LAST READ SUBTOPIC TRACKING (RESUME WHERE LEFT OFF)
// ==========================================

const LAST_READ_KEY = "syllabus_platform_last_read_v1";

export async function saveLastReadSubtopic(syllabusId: string, subtopicId: string, userId?: string): Promise<void> {
  if (!syllabusId || !subtopicId) return;
  const user = userId ? null : getLocalCurrentUser();
  const uid = userId || user?.uid || "guest";

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`${LAST_READ_KEY}_${uid}_${syllabusId}`, subtopicId);
    } catch (e) {}
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    queueOfflineProgress({ 
      userId: uid, 
      syllabusId, 
      progressMap: getSubtopicProgress(uid), 
      lastReadSubtopicId: subtopicId 
    });
  } else if (isFirebaseConfigured && db && uid !== "guest") {
    try {
      await setDoc(doc(db, "userProgress", uid), {
        lastReadSubtopics: { [syllabusId]: subtopicId },
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn("Firestore last-read save error, queueing offline:", err);
      queueOfflineProgress({ 
        userId: uid, 
        syllabusId, 
        progressMap: getSubtopicProgress(uid), 
        lastReadSubtopicId: subtopicId 
      });
    }
  }
}

export async function getLastReadSubtopic(syllabusId: string, userId?: string): Promise<string | null> {
  if (!syllabusId) return null;
  const user = userId ? null : getLocalCurrentUser();
  const uid = userId || user?.uid || "guest";

  if (typeof window !== "undefined") {
    try {
      const local = localStorage.getItem(`${LAST_READ_KEY}_${uid}_${syllabusId}`);
      if (local) return local;
    } catch (e) {}
  }

  if (isFirebaseConfigured && db && uid !== "guest") {
    try {
      const fetchPromise = getDoc(doc(db, "userProgress", uid));
      const timeoutPromise = new Promise<null>((resolve) => 
        setTimeout(() => resolve(null), 2000)
      );
      const docSnap = await Promise.race([fetchPromise, timeoutPromise]);
      if (docSnap && 'exists' in docSnap && docSnap.exists()) {
        const data = docSnap.data();
        return data.lastReadSubtopics?.[syllabusId] || null;
      }
    } catch (err) {
      console.warn("Firestore last-read fetch error:", err);
    }
  }

  return null;
}

// ==========================================
// ACTIVE TOPIC TIME TRACKING (EXCLUDING AWAY TIME)
// ==========================================

const TOPIC_TIME_KEY = "syllabus_platform_topic_time_records_v1";

export async function recordActiveTopicTime(params: {
  userId: string;
  studentName: string;
  studentEmail?: string;
  studentUsername?: string;
  studentTradeId?: string;
  studentLevel?: string;
  syllabusId: string;
  syllabusTitle: string;
  topicId: string;
  topicTitle: string;
  subtopicId?: string;
  subtopicTitle?: string;
  date?: string;
  secondsToAdd: number;
}): Promise<StudentTopicTimeRecord> {
  const dateStr = params.date || new Date().toISOString().split('T')[0];
  const recordId = `${params.userId}_${params.syllabusId}_${params.topicId}_${dateStr}`.replace(/[^a-zA-Z0-9_-]/g, "_");

  let localList: StudentTopicTimeRecord[] = [];
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(TOPIC_TIME_KEY);
      localList = saved ? JSON.parse(saved) : [];
    } catch (e) {
      localList = [];
    }
  }

  const existingIndex = localList.findIndex(r => r.id === recordId);
  const currentSeconds = existingIndex >= 0 ? localList[existingIndex].activeSeconds : 0;
  const newSeconds = currentSeconds + params.secondsToAdd;
  const newMinutes = Math.round((newSeconds / 60) * 10) / 10;

  const record: StudentTopicTimeRecord = {
    id: recordId,
    userId: params.userId,
    studentName: params.studentName,
    studentEmail: params.studentEmail || "",
    studentUsername: params.studentUsername || "",
    studentTradeId: params.studentTradeId || "",
    studentLevel: params.studentLevel || "",
    syllabusId: params.syllabusId,
    syllabusTitle: params.syllabusTitle,
    topicId: params.topicId,
    topicTitle: params.topicTitle,
    subtopicId: params.subtopicId,
    subtopicTitle: params.subtopicTitle,
    date: dateStr,
    activeSeconds: newSeconds,
    activeMinutes: newMinutes,
    lastUpdated: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    localList[existingIndex] = record;
  } else {
    localList.unshift(record);
  }

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(TOPIC_TIME_KEY, JSON.stringify(localList));
    } catch (e) {
      console.error("Error saving topic time locally:", e);
    }
  }

  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "topicTimeRecords", recordId), sanitizeForFirestore(record), { merge: true });
    } catch (err) {
      console.warn("Firestore save topicTimeRecord error:", err);
    }
  }

  return record;
}

export function getLocalStudentTopicTimeRecords(): StudentTopicTimeRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(TOPIC_TIME_KEY);
    const list: StudentTopicTimeRecord[] = saved ? JSON.parse(saved) : [];
    return list.sort((a, b) => (b.lastUpdated || "").localeCompare(a.lastUpdated || ""));
  } catch (e) {
    return [];
  }
}

export async function getAllStudentTopicTimeRecords(): Promise<StudentTopicTimeRecord[]> {
  const recordsMap: Record<string, StudentTopicTimeRecord> = {};

  // 1. Preload local records
  const localList = getLocalStudentTopicTimeRecords();
  localList.forEach(r => {
    recordsMap[r.id] = r;
  });

  if (isFirebaseConfigured && db) {
    try {
      const q = query(collection(db, "topicTimeRecords"), orderBy("lastUpdated", "desc"));
      const fetchPromise = getDocs(q);
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
      const snapshot: any = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (snapshot && !snapshot.empty) {
        snapshot.forEach((docSnap: any) => {
          const item = { id: docSnap.id, ...docSnap.data() } as StudentTopicTimeRecord;
          recordsMap[item.id] = item;
        });
      }
    } catch (err) {
      console.warn("Firestore fetch topicTimeRecords error:", err);
    }
  }

  const result = Object.values(recordsMap);
  return result.sort((a, b) => (b.lastUpdated || "").localeCompare(a.lastUpdated || ""));
}

/**
 * Real-time instant subscription to topic time records.
 * Listens to Firestore onSnapshot with local event fallbacks.
 */
export function subscribeToStudentTopicTimeRecords(
  callback: (records: StudentTopicTimeRecord[]) => void
): () => void {
  let unsubFirestore: (() => void) | null = null;

  // 1. Immediate local emission
  callback(getLocalStudentTopicTimeRecords());

  // 2. Real-time Firestore snapshot listener
  if (isFirebaseConfigured && db) {
    try {
      unsubFirestore = onSnapshot(
        collection(db, "topicTimeRecords"),
        (snap) => {
          const recordsMap: Record<string, StudentTopicTimeRecord> = {};
          snap.docs.forEach((docSnap) => {
            const item = { id: docSnap.id, ...docSnap.data() } as StudentTopicTimeRecord;
            recordsMap[item.id] = item;
          });
          const local = getLocalStudentTopicTimeRecords();
          local.forEach((r) => {
            recordsMap[r.id] = { ...recordsMap[r.id], ...r };
          });
          const result = Object.values(recordsMap).sort((a, b) => 
            (b.lastUpdated || "").localeCompare(a.lastUpdated || "")
          );
          callback(result);
        },
        (err) => {
          console.warn("Firestore topicTimeRecords subscription error:", err);
          callback(getLocalStudentTopicTimeRecords());
        }
      );
    } catch (e) {
      console.warn("Failed to attach topicTimeRecords onSnapshot:", e);
    }
  }

  // 3. Storage event listener for cross-tab updates
  const handleStorage = (e: StorageEvent) => {
    if (e.key === TOPIC_TIME_KEY) {
      callback(getLocalStudentTopicTimeRecords());
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }

  return () => {
    if (unsubFirestore) unsubFirestore();
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

// Stale mock data cleaner routine for browsers
export function purgeStaleMockDataOnce() {
  if (typeof window === "undefined") return;
  try {
    const PURGE_FLAG = "syllabus_mock_data_purged_v4";
    if (!localStorage.getItem(PURGE_FLAG)) {
      // 1. Clear fake seeded topic time records from browser
      localStorage.removeItem(TOPIC_TIME_KEY);
      // 2. Clear old test activities from browser
      localStorage.removeItem(ACTIVITIES_KEY);
      // 3. Clear old mock notifications from browser
      localStorage.removeItem(NOTIFICATIONS_KEY);
      // 4. Remove mock students from localStorage
      const savedUsers = localStorage.getItem(USERS_KEY);
      if (savedUsers) {
        const users: UserProfile[] = JSON.parse(savedUsers);
        const cleaned = users.filter(u => 
          !u.uid.startsWith("demo-") && 
          u.fullName !== "Alson Johns" && 
          u.fullName !== "Angel Vanca"
        );
        localStorage.setItem(USERS_KEY, JSON.stringify(cleaned));
      }
      localStorage.setItem(PURGE_FLAG, "true");
    }
  } catch (e) {
    console.error("Error purging stale mock data:", e);
  }
}

// Run purge immediately on load in browser
if (typeof window !== "undefined") {
  purgeStaleMockDataOnce();
}

export async function clearAllStudentTopicTimeRecords(): Promise<void> {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(TOPIC_TIME_KEY);
    } catch (e) {
      console.error("Error clearing local topic time records:", e);
    }
  }

  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, "topicTimeRecords"));
      for (const d of snap.docs) {
        await deleteDoc(doc(db, "topicTimeRecords", d.id));
      }
    } catch (e) {
      console.warn("Error clearing Firestore topic time records:", e);
    }
  }
}

export async function clearAllActivityLogs(): Promise<void> {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(ACTIVITIES_KEY);
    } catch (e) {
      console.error("Error clearing local activity logs:", e);
    }
  }

  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, "activities"));
      for (const d of snap.docs) {
        await deleteDoc(doc(db, "activities", d.id));
      }
    } catch (e) {
      console.warn("Error clearing Firestore activity logs:", e);
    }
  }
}

export async function deleteUserProfile(uid: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, "users", uid));
    } catch (e) {
      console.warn("Error deleting Firestore user:", e);
    }
  }

  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(USERS_KEY);
      if (saved) {
        const users: UserProfile[] = JSON.parse(saved);
        const filtered = users.filter(u => u.uid !== uid);
        localStorage.setItem(USERS_KEY, JSON.stringify(filtered));
      }
    } catch (e) {
      console.error("Error deleting local user:", e);
    }
  }
}

export async function seedInitialTopicTimeRecordsIfEmpty(): Promise<StudentTopicTimeRecord[]> {
  // Mock data seeding has been removed so the platform starts completely fresh.
  return [];
}


