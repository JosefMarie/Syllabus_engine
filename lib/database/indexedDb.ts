/**
 * Lightweight native IndexedDB storage helper
 * Solves the browser 5MB localStorage quota limit for large course syllabi and exam records.
 * Falls back gracefully to localStorage in unsupported or SSR environments.
 */

const DB_NAME = "SyllabusEngineDB";
const DB_VERSION = 1;

export const IDB_STORES = {
  SYLLABI: "syllabi",
  EXAMS: "exams",
  ATTEMPTS: "exam_attempts",
  GROUPS: "groups",
  EVALUATIONS: "evaluations",
  CACHE: "cache"
} as const;

export type StoreName = (typeof IDB_STORES)[keyof typeof IDB_STORES];

let dbPromise: Promise<IDBDatabase> | null = null;

function getIDB(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB not supported in this environment"));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        Object.values(IDB_STORES).forEach((store) => {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store);
          }
        });
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };
    } catch (err) {
      dbPromise = null;
      reject(err);
    }
  });

  return dbPromise;
}

export async function idbGet<T>(storeName: StoreName, key: string): Promise<T | null> {
  try {
    const db = await getIDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result !== undefined ? (request.result as T) : null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    // Fallback to localStorage
    if (typeof window !== "undefined") {
      try {
        const fallbackRaw = localStorage.getItem(`${storeName}_${key}`);
        if (fallbackRaw) return JSON.parse(fallbackRaw) as T;
      } catch {}
    }
    return null;
  }
}

export async function idbSet<T>(storeName: StoreName, key: string, value: T): Promise<void> {
  try {
    const db = await getIDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.put(value, key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    // Fallback to localStorage
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`${storeName}_${key}`, JSON.stringify(value));
      } catch (lsErr) {
        console.warn(`IndexedDB and LocalStorage fallback failed for key ${key}:`, lsErr);
      }
    }
  }
}

export async function idbDelete(storeName: StoreName, key: string): Promise<void> {
  try {
    const db = await getIDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(`${storeName}_${key}`);
      } catch {}
    }
  }
}

export async function idbGetAll<T>(storeName: StoreName): Promise<T[]> {
  try {
    const db = await getIDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve((request.result as T[]) || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    return [];
  }
}
