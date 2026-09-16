import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { 
  initializeFirestore,
  getFirestore, 
  memoryLocalCache,
  Firestore 
} from "firebase/firestore";
import { getAuth, Auth, GoogleAuthProvider } from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;
let storage: FirebaseStorage | null = null;

if (typeof window !== "undefined" || isFirebaseConfigured) {
  try {
    if (isFirebaseConfigured) {
      app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

      // Aggressive localStorage cleanup to permanently resolve QuotaExceededError
      if (typeof window !== "undefined") {
        try {
          const preservedKeys = new Set([
            "syllabus_platform_current_user_v1",
            "syllabus_admin_session_v1",
            "syllabus_auth_session_v1",
            "syllabus_admin_presence_sound"
          ]);

          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            if (preservedKeys.has(key)) continue;
            if (key.startsWith("firebase:authUser")) continue;

            // Purge all firestore internal tokens/mutations/clients that choked localStorage
            if (key.startsWith("firestore_") || key.startsWith("firebase:")) {
              keysToRemove.push(key);
              continue;
            }
            // Purge old bloated offline queues and raw syllabus monolithic dumps
            if (
              key.startsWith("syllabus_offline_queue_") ||
              key.startsWith("syllabus_single_") ||
              key === "syllabus_platform_syllabi_v1" ||
              key === "syllabus_platform_activities_v1"
            ) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach((k) => localStorage.removeItem(k));
        } catch (storageCleanupErr) {
          console.warn("Storage cleanup warning:", storageCleanupErr);
        }
      }

      // Initialize Firestore with memoryLocalCache to eliminate IndexedDB and localStorage tab manager locks
      try {
        db = initializeFirestore(app, {
          localCache: memoryLocalCache()
        });
      } catch (cacheErr) {
        try {
          db = getFirestore(app);
        } catch (getErr) {
          console.warn("Error getting Firestore instance:", getErr);
          db = null;
        }
      }

      auth = getAuth(app);
      storage = getStorage(app);
      googleProvider = new GoogleAuthProvider();
    }
  } catch (error) {
    console.warn("Firebase initialization error (using local storage fallback):", error);
  }
}

export { app, db, auth, googleProvider, storage };
