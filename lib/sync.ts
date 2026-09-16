import { Syllabus } from "@/types/syllabus";
import { db, isFirebaseConfigured } from "./firebase";
import { doc, setDoc } from "firebase/firestore";
import { sanitizeForFirestore } from "./db";

const OFFLINE_SYLLABI_QUEUE_KEY = "syllabus_offline_queue_syllabi_v1";
const OFFLINE_PROGRESS_QUEUE_KEY = "syllabus_offline_queue_progress_v1";

export interface PendingProgressRecord {
  userId: string;
  syllabusId: string;
  progressMap: Record<string, boolean>;
  lastReadSubtopicId?: string;
  timestamp: string;
}

export function isDeviceOnline(): boolean {
  if (typeof window === "undefined") return true;
  return navigator.onLine;
}

// ==========================================
// 1. INSTRUCTOR SYLLABI OFFLINE QUEUE
// ==========================================

export function getPendingOfflineSyllabi(): Syllabus[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(OFFLINE_SYLLABI_QUEUE_KEY) || localStorage.getItem(OFFLINE_SYLLABI_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function queueOfflineSyllabus(syllabus: Syllabus): void {
  if (typeof window === "undefined" || !syllabus) return;
  try {
    const queue = getPendingOfflineSyllabi();
    const idx = queue.findIndex((s) => s.id === syllabus.id);
    if (idx >= 0) {
      queue[idx] = syllabus;
    } else {
      queue.push(syllabus);
    }
    const str = JSON.stringify(queue);
    try {
      sessionStorage.setItem(OFFLINE_SYLLABI_QUEUE_KEY, str);
    } catch (sErr) {
      // Ignore
    }
    try {
      localStorage.setItem(OFFLINE_SYLLABI_QUEUE_KEY, str);
    } catch (qErr) {
      // Ignore if localStorage quota exceeded
    }
    notifySyncListeners();
  } catch (e) {
    console.warn("Could not queue offline syllabus:", e);
  }
}

export function removePendingOfflineSyllabus(id: string): void {
  if (typeof window === "undefined" || !id) return;
  try {
    const queue = getPendingOfflineSyllabi().filter((s) => s.id !== id);
    const str = JSON.stringify(queue);
    try {
      sessionStorage.setItem(OFFLINE_SYLLABI_QUEUE_KEY, str);
    } catch (e) {}
    try {
      localStorage.setItem(OFFLINE_SYLLABI_QUEUE_KEY, str);
    } catch (e) {}
    notifySyncListeners();
  } catch (e) {
    console.warn("Could not remove pending offline syllabus:", e);
  }
}

// ==========================================
// 2. STUDENT PROGRESS OFFLINE QUEUE
// ==========================================

export function getPendingOfflineProgress(): PendingProgressRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OFFLINE_PROGRESS_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function queueOfflineProgress(record: Omit<PendingProgressRecord, "timestamp">): void {
  if (typeof window === "undefined") return;
  try {
    const queue = getPendingOfflineProgress();
    const existingIdx = queue.findIndex(
      (q) => q.userId === record.userId && q.syllabusId === record.syllabusId
    );
    const fullRecord: PendingProgressRecord = {
      ...record,
      timestamp: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      queue[existingIdx] = {
        ...queue[existingIdx],
        progressMap: { ...queue[existingIdx].progressMap, ...record.progressMap },
        lastReadSubtopicId: record.lastReadSubtopicId || queue[existingIdx].lastReadSubtopicId,
        timestamp: fullRecord.timestamp
      };
    } else {
      queue.push(fullRecord);
    }

    localStorage.setItem(OFFLINE_PROGRESS_QUEUE_KEY, JSON.stringify(queue));
    notifySyncListeners();
  } catch (e) {
    console.error("Error queueing offline progress:", e);
  }
}

export function clearPendingOfflineProgress(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(OFFLINE_PROGRESS_QUEUE_KEY);
  notifySyncListeners();
}

// ==========================================
// 3. SYNCHRONIZATION RUNNER (ONLINE DRAIN)
// ==========================================

let isSyncing = false;

export async function syncPendingOfflineChanges(): Promise<{ syllabiCount: number; progressCount: number }> {
  if (typeof window === "undefined") return { syllabiCount: 0, progressCount: 0 };
  if (!navigator.onLine || !isFirebaseConfigured || !db) {
    return { syllabiCount: 0, progressCount: 0 };
  }
  if (isSyncing) return { syllabiCount: 0, progressCount: 0 };

  isSyncing = true;
  notifyStatusChange("syncing");

  let syncedSyllabi = 0;
  let syncedProgress = 0;

  try {
    // 1. Sync Pending Syllabi
    const pendingSyllabi = getPendingOfflineSyllabi();
    for (const syl of pendingSyllabi) {
      try {
        const sanitized = sanitizeForFirestore(syl);
        const setPromise = setDoc(doc(db, "syllabi", syl.id), sanitized);
        const timeoutPromise = new Promise<void>((_, reject) => 
          setTimeout(() => reject(new Error("Timeout syncing syllabus")), 12000)
        );
        await Promise.race([setPromise, timeoutPromise]);
        removePendingOfflineSyllabus(syl.id);
        syncedSyllabi++;
        console.log(`[PWA Sync] Successfully synced syllabus: "${syl.title}"`);
      } catch (err) {
        console.warn(`[PWA Sync] Failed to sync syllabus ${syl.id}:`, err);
      }
    }

    // 2. Sync Pending Student Progress Records
    const pendingProgress = getPendingOfflineProgress();
    for (const prog of pendingProgress) {
      try {
        const updatePayload: Record<string, any> = {
          progressMap: prog.progressMap,
          updatedAt: new Date().toISOString()
        };
        if (prog.lastReadSubtopicId && prog.syllabusId) {
          updatePayload.lastReadSubtopics = {
            [prog.syllabusId]: prog.lastReadSubtopicId
          };
        }
        await setDoc(doc(db, "userProgress", prog.userId), updatePayload, { merge: true });
        syncedProgress++;
        console.log(`[PWA Sync] Successfully synced student progress for user ${prog.userId}`);
      } catch (err) {
        console.warn(`[PWA Sync] Failed to sync progress for user ${prog.userId}:`, err);
      }
    }

    if (syncedProgress > 0) {
      clearPendingOfflineProgress();
    }
  } catch (globalErr) {
    console.error("[PWA Sync] Global sync error:", globalErr);
  } finally {
    isSyncing = false;
    notifyStatusChange(navigator.onLine ? "online" : "offline");
    if (syncedSyllabi > 0 || syncedProgress > 0) {
      window.dispatchEvent(
        new CustomEvent("syllabus_pwa_synced", {
          detail: { syllabiCount: syncedSyllabi, progressCount: syncedProgress }
        })
      );
    }
  }

  return { syllabiCount: syncedSyllabi, progressCount: syncedProgress };
}

// ==========================================
// 4. LISTENERS & STATUS
// ==========================================

type SyncStatus = "online" | "offline" | "syncing";
const listeners: Array<(status: SyncStatus) => void> = [];

export function onSyncStatusChange(cb: (status: SyncStatus) => void): () => void {
  listeners.push(cb);
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function notifyStatusChange(status: SyncStatus) {
  listeners.forEach((fn) => {
    try {
      fn(status);
    } catch (e) {}
  });
}

function notifySyncListeners() {
  window.dispatchEvent(new Event("syllabus_pwa_queue_updated"));
}

// Automatic online/offline browser event hooks
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    notifyStatusChange("online");
    syncPendingOfflineChanges();
  });

  window.addEventListener("offline", () => {
    notifyStatusChange("offline");
  });
}
