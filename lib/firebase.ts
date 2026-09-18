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

      // Startup storage hygiene: preserve active session and offline syllabus caches
      if (typeof window !== "undefined") {
        try {
          const preservedKeys = new Set([
            "syllabus_platform_current_user_v1",
            "syllabus_platform_admin_session_v1",
            "syllabus_admin_session_v1",
            "syllabus_auth_session_v1",
            "syllabus_admin_presence_sound",
            "syllabus_platform_syllabi_v1",
            "syllabus_platform_trades_v1",
            "syllabus_platform_progress_v1"
          ]);

          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            if (preservedKeys.has(key)) continue;
            if (key.startsWith("firebase:authUser")) continue;
            if (key.startsWith("syllabus_single_v2_")) continue; // Preserve modern single syllabus caches

            // Purge old firestore internal tokens and obsolete v1 dumps
            if (
              key.startsWith("firestore_") ||
              key.startsWith("firebase:") ||
              key.startsWith("syllabus_single_v1_") ||
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

      // Initialize Firestore with memoryLocalCache and experimentalForceLongPolling.
      // experimentalForceLongPolling ensures 100% reliable connectivity on public networks,
      // school/university firewalls, proxies, and captive portals that block or drop WebSockets (wss://).
      try {
        db = initializeFirestore(app, {
          localCache: memoryLocalCache(),
          experimentalForceLongPolling: true,
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
