import { SystemRestrictionsConfig } from "@/types/restrictions";
import { db, isFirebaseConfigured } from "./firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

const RESTRICTIONS_STORAGE_KEY = "syllabus_system_restrictions_config";
const RESTRICTIONS_EVENT = "syllabus_restrictions_updated";

const DEFAULT_CONFIG: SystemRestrictionsConfig = {
  restrictionsDisabled: false,
  disabledAt: null,
  disabledBy: null,
  reason: "",
  updatedAt: new Date().toISOString(),
};

/**
 * Retrieve local cached restrictions config
 */
export function getLocalRestrictions(): SystemRestrictionsConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const saved = localStorage.getItem(RESTRICTIONS_STORAGE_KEY);
    if (!saved) return DEFAULT_CONFIG;
    return JSON.parse(saved);
  } catch (e) {
    return DEFAULT_CONFIG;
  }
}

/**
 * Fetch authoritative restrictions config from Firestore with localStorage fallback
 */
export async function getSystemRestrictions(): Promise<SystemRestrictionsConfig> {
  let config: SystemRestrictionsConfig = getLocalRestrictions();

  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDoc(doc(db, "systemSettings", "restrictions"));
      if (snap.exists()) {
        const data = snap.data() as SystemRestrictionsConfig;
        config = {
          ...DEFAULT_CONFIG,
          ...data,
          restrictionsDisabled: !!data.restrictionsDisabled,
        };
        if (typeof window !== "undefined") {
          localStorage.setItem(RESTRICTIONS_STORAGE_KEY, JSON.stringify(config));
        }
      }
    } catch (e) {
      console.warn("Firestore getSystemRestrictions error:", e);
    }
  }

  return config;
}

/**
 * Update system restrictions mode (Enable / Disable restrictions for Group Work)
 */
export async function setSystemRestrictions(
  disabled: boolean,
  adminName: string = "Instructor",
  reason: string = disabled ? "Group Work in Progress" : "Standard Focus Mode"
): Promise<SystemRestrictionsConfig> {
  const now = new Date().toISOString();
  const config: SystemRestrictionsConfig = {
    restrictionsDisabled: disabled,
    disabledAt: disabled ? now : null,
    disabledBy: disabled ? adminName : null,
    reason,
    updatedAt: now,
  };

  // 1. Persist to Firestore
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "systemSettings", "restrictions"), config, { merge: true });
    } catch (e) {
      console.warn("Firestore setSystemRestrictions error:", e);
    }
  }

  // 2. Persist to localStorage and dispatch real-time events
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(RESTRICTIONS_STORAGE_KEY, JSON.stringify(config));
      window.dispatchEvent(new CustomEvent(RESTRICTIONS_EVENT, { detail: config }));

      if ("BroadcastChannel" in window) {
        const channel = new BroadcastChannel("syllabus_system_channel");
        channel.postMessage({ type: "RESTRICTIONS_UPDATED", config });
        channel.close();
      }
    } catch (e) {
      console.error("Local setSystemRestrictions error:", e);
    }
  }

  return config;
}

/**
 * Real-time subscription to System Restrictions Config
 * Reacts immediately to Firestore onSnapshot changes or cross-tab local events.
 */
export function subscribeToSystemRestrictions(
  callback: (config: SystemRestrictionsConfig) => void
): () => void {
  // Initial broadcast from local cache
  callback(getLocalRestrictions());

  let unsubFirestore: (() => void) | null = null;

  if (isFirebaseConfigured && db) {
    try {
      unsubFirestore = onSnapshot(
        doc(db, "systemSettings", "restrictions"),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as SystemRestrictionsConfig;
            const updatedConfig: SystemRestrictionsConfig = {
              ...DEFAULT_CONFIG,
              ...data,
              restrictionsDisabled: !!data.restrictionsDisabled,
            };

            if (typeof window !== "undefined") {
              try {
                localStorage.setItem(RESTRICTIONS_STORAGE_KEY, JSON.stringify(updatedConfig));
              } catch (e) {}
            }

            callback(updatedConfig);
          } else {
            callback(DEFAULT_CONFIG);
          }
        },
        (err) => {
          console.warn("subscribeToSystemRestrictions Firestore listener warning:", err);
        }
      );
    } catch (e) {
      console.warn("Error setting up restrictions listener:", e);
    }
  }

  // Local window event listener for instant multi-tab reactivity
  const handleLocalUpdate = (e: any) => {
    if (e.detail) {
      callback(e.detail);
    } else {
      callback(getLocalRestrictions());
    }
  };

  let broadcastChannel: BroadcastChannel | null = null;
  if (typeof window !== "undefined") {
    window.addEventListener(RESTRICTIONS_EVENT, handleLocalUpdate);
    window.addEventListener("storage", (e) => {
      if (e.key === RESTRICTIONS_STORAGE_KEY) {
        callback(getLocalRestrictions());
      }
    });

    if ("BroadcastChannel" in window) {
      broadcastChannel = new BroadcastChannel("syllabus_system_channel");
      broadcastChannel.onmessage = (event) => {
        if (event.data?.type === "RESTRICTIONS_UPDATED" && event.data.config) {
          callback(event.data.config);
        }
      };
    }
  }

  return () => {
    if (unsubFirestore) {
      unsubFirestore();
    }
    if (typeof window !== "undefined") {
      window.removeEventListener(RESTRICTIONS_EVENT, handleLocalUpdate);
      if (broadcastChannel) {
        broadcastChannel.close();
      }
    }
  };
}
