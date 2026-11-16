import { Syllabus } from "@/types/syllabus";

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
// ONLINE-ALWAYS COMPATIBILITY STUBS
// Offline queues have been disabled for real-time speed and consistency.
// ==========================================

export function getPendingOfflineSyllabi(): Syllabus[] {
  return [];
}

export function queueOfflineSyllabus(_syllabus: Syllabus): void {}

export function removePendingOfflineSyllabus(_id: string): void {}

export function getPendingOfflineProgress(): PendingProgressRecord[] {
  return [];
}

export function queueOfflineProgress(_record: Omit<PendingProgressRecord, "timestamp">): void {}

export function removePendingOfflineProgress(_userId: string): void {}

export function onSyncStatusChange(callback: (status: "online" | "offline" | "syncing") => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onOnline = () => callback("online");
  const onOffline = () => callback("offline");
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  return () => {
    window.removeEventListener("online", handleOnlineSafe(onOnline));
    window.removeEventListener("offline", handleOnlineSafe(onOffline));
  };
}

function handleOnlineSafe(fn: () => void): () => void {
  return fn;
}

export async function syncPendingOfflineChanges(): Promise<{ syllabiCount: number; progressCount: number }> {
  return { syllabiCount: 0, progressCount: 0 };
}
