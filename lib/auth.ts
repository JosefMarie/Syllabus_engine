import { UserProfile, StudentLevel } from "@/types/auth";
import { getAllUserProfiles, registerUserProfile, logActivity } from "./db";
import { auth, db, isFirebaseConfigured } from "./firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { verifyTOTPCode } from "./totp";

const CURRENT_USER_KEY = "syllabus_platform_current_user_v1";
const ADMIN_SESSION_KEY = "syllabus_platform_admin_session_v1";

export function getStoredSession(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function saveStoredSession(user: UserProfile | null) {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  } catch (e: any) {
    if (e?.name === "QuotaExceededError" || e?.code === 22) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith("firestore_") || key.startsWith("syllabus_offline_queue_"))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        if (user) localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      } catch (retryErr) {}
    }
    console.error("Error saving user session:", e);
  }
}

// ----------------------------------------------------
// TEACHER ADMIN FIREBASE AUTHENTICATION & 2FA
// ----------------------------------------------------
export function getAdminSession(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const session: UserProfile = JSON.parse(raw);

    // CRITICAL: Purge any legacy session that does not have 2FA issued timestamps
    if (!session.sessionIssuedAt || !session.sessionExpiresAt) {
      localStorage.removeItem(ADMIN_SESSION_KEY);
      return null;
    }

    // Auto-expire admin session after 30 minutes of inactivity
    if (Date.now() > session.sessionExpiresAt) {
      localStorage.removeItem(ADMIN_SESSION_KEY);
      return null;
    }

    if (session.role === "teacher" && (session.fullName === "Teacher Admin" || !session.fullName)) {
      session.fullName = "Josef Marie";
      try {
        localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
      } catch (e) {}
    }

    return session;
  } catch (e) {
    return null;
  }
}

/**
 * Real-time listener for centralized session revocation.
 * If the instructor changes their password or clicks 'Log Out All Devices',
 * any device holding a session issued BEFORE that timestamp will be immediately kicked out.
 */
export function subscribeToAdminSessionRevocation(onRevoked: () => void): () => void {
  if (typeof window === "undefined" || !isFirebaseConfigured || !db) {
    return () => {};
  }

  try {
    const unsub = onSnapshot(doc(db, "system", "admin_auth"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const minValid = typeof data?.minValidSessionTimestamp === "number" ? data.minValidSessionTimestamp : 0;
        const currentAdmin = getAdminSession();
        if (currentAdmin && currentAdmin.sessionIssuedAt && currentAdmin.sessionIssuedAt < minValid) {
          console.warn("[AUTH] Admin session revoked by central security authority.");
          localStorage.removeItem(ADMIN_SESSION_KEY);
          onRevoked();
        }
      }
    }, (err) => {
      console.warn("Error listening to admin session revocation:", err);
    });
    return unsub;
  } catch (e) {
    return () => {};
  }
}

/**
 * Centrally revokes all existing admin sessions across all devices (phones, tablets, student PCs, PWAs).
 */
export async function revokeAllAdminSessions(reason: string = "Instructor requested all devices log out"): Promise<void> {
  const now = Date.now();
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "system", "admin_auth"), {
        minValidSessionTimestamp: now,
        revokedAt: new Date().toISOString(),
        reason,
      }, { merge: true });
    } catch (e) {
      console.warn("Firestore revokeAllAdminSessions error:", e);
    }
  }

  if (typeof window !== "undefined") {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    window.location.href = "/admin/login";
  }
}

export function saveAdminSession(admin: UserProfile | null) {
  if (typeof window === "undefined") return;
  try {
    if (admin) {
      if (!admin.sessionExpiresAt) {
        admin.sessionIssuedAt = Date.now();
        admin.sessionExpiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes
      }
      localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(admin));
    } else {
      localStorage.removeItem(ADMIN_SESSION_KEY);
    }
  } catch (e: any) {
    if (e?.name === "QuotaExceededError" || e?.code === 22) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith("firestore_") || key.startsWith("syllabus_offline_queue_"))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        if (admin) localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(admin));
      } catch (retryErr) {}
    }
    console.error("Error saving admin session:", e);
  }
}

export async function loginAdmin(
  email: string,
  password: string,
  totpCode?: string
): Promise<{ success: boolean; admin?: UserProfile; requires2FA?: boolean; message?: string }> {
  const cleanEmail = email.trim().toLowerCase();

  // Strict email check: only the designated teacher email is permitted
  if (cleanEmail !== "layjoe0001@gmail.com") {
    return { success: false, message: "Unauthorized: This email does not have Teacher Admin privileges." };
  }

  if (!auth) {
    return { success: false, message: "Authentication service unavailable." };
  }

  // 1. Authenticate credentials with Firebase Authentication
  let authenticatedUid = "";
  let displayName = "Josef Marie";

  try {
    const userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
    authenticatedUid = userCred.user.uid;
    displayName = userCred.user.displayName || "Josef Marie";
  } catch (err: any) {
    // If account doesn't exist in Firebase Auth yet, try creating it with this password
    if (err.code === "auth/user-not-found" || err.message?.includes("user-not-found")) {
      try {
        const newCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        authenticatedUid = newCred.user.uid;
        displayName = "Josef Marie";
      } catch (createErr: any) {
        return { success: false, message: "Failed to initialize teacher admin: " + (createErr.message || "") };
      }
    } else {
      console.warn("Firebase Auth sign in failed:", err.code || err.message);
      return { 
        success: false, 
        message: "Invalid Teacher Admin email or password. Access denied." 
      };
    }
  }

  // 2. If password is verified, check 2FA code
  if (!totpCode) {
    return { 
      success: false, 
      requires2FA: true, 
      message: "Password verified. Please enter your 6-digit Authenticator code to complete login." 
    };
  }

  // 3. Verify the 6-digit TOTP code
  const isCodeValid = await verifyTOTPCode(totpCode);
  if (!isCodeValid) {
    return { 
      success: false, 
      requires2FA: true, 
      message: "Invalid or expired 6-digit code. Please check your Google Authenticator app and try again." 
    };
  }

  // 4. Issue Admin Session with 30-minute expiry
  const adminProfile: UserProfile = {
    uid: authenticatedUid,
    fullName: "Josef Marie",
    email: cleanEmail,
    username: "layjoe",
    tradeId: "all",
    level: "Level 5",
    role: "teacher",
    status: "approved",
    createdAt: new Date().toISOString(),
    sessionIssuedAt: Date.now(),
    sessionExpiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
  };

  saveAdminSession(adminProfile);
  saveStoredSession(null); // Clear student session to prevent crossover

  await logActivity({
    userId: adminProfile.uid,
    userName: "Josef Marie",
    userEmail: adminProfile.email,
    userLevel: adminProfile.level,
    action: "ADMIN_LOGIN",
    details: "Josef Marie logged into management portal (2FA Authenticator Verified)",
  });

  return { success: true, admin: adminProfile };
}

export async function logoutAdmin() {
  if (auth) {
    try {
      await signOut(auth);
    } catch (e) {}
  }
  saveAdminSession(null);
}

export async function logoutStudent(user?: UserProfile | null, isAutoTimeout: boolean = false) {
  const current = user || getStoredSession();
  if (current) {
    try {
      const { updateStudentPresence } = await import("./presence");
      await updateStudentPresence(current.uid, current.fullName, "offline");

      await logActivity({
        userId: current.uid,
        userName: current.fullName,
        userEmail: current.email || `${current.username} (No Email)`,
        userLevel: current.level,
        action: isAutoTimeout ? "AUTO_TIMEOUT_LOGOUT" : "STUDENT_LOGOUT",
        details: isAutoTimeout
          ? "Student session automatically logged out after 5 minutes of inactivity."
          : "Student logged out of their session.",
      });
    } catch (e) {
      console.warn("Logout presence / audit update error:", e);
    }
  }

  saveStoredSession(null);
}

// ----------------------------------------------------
// STUDENT AUTHENTICATION
// ----------------------------------------------------
export async function loginUser(
  identifier: string,
  password: string
): Promise<{ success: boolean; user?: UserProfile; message?: string }> {
  const users = await getAllUserProfiles();
  const trimmed = identifier.trim().toLowerCase();

  const found = users.find(
    (u) =>
      u.email.toLowerCase() === trimmed || u.username.toLowerCase() === trimmed
  );

  if (!found) {
    return { success: false, message: "No account found matching that Email or Username." };
  }

  if (found.passwordHash && found.passwordHash !== password) {
    return { success: false, message: "Incorrect password. Please try again." };
  }

  if (found.status === "pending_approval") {
    return {
      success: false,
      message: "Your registration is pending approval by your teacher. Please check back soon.",
    };
  }

  if (found.status === "rejected") {
    return {
      success: false,
      message: found.suspensionReason || "Account Suspended: Exceeded 10 side-window / focus violations. Re-approval by your instructor is required.",
    };
  }

  saveStoredSession(found);
  saveAdminSession(null); // Clear any lingering admin session

  await logActivity({
    userId: found.uid,
    userName: found.fullName,
    userEmail: found.email,
    userLevel: found.level,
    action: "STUDENT_LOGIN",
    details: `Student logged in under ${found.level}`,
  });

  return { success: true, user: found };
}

export async function registerStudent(data: {
  fullName: string;
  email?: string;
  username: string;
  tradeId: string;
  level: StudentLevel;
  password: string;
}): Promise<{ success: boolean; user?: UserProfile; message?: string }> {
  const users = await getAllUserProfiles();

  const cleanEmail = (data.email || "").trim();

  if (cleanEmail) {
    const emailExists = users.some(
      (u) => u.email && u.email.toLowerCase() === cleanEmail.toLowerCase()
    );
    if (emailExists) {
      return { success: false, message: "An account with this email already exists." };
    }
  }

  const usernameExists = users.some(
    (u) => u.username.toLowerCase() === data.username.trim().toLowerCase()
  );
  if (usernameExists) {
    return { success: false, message: "Username is already taken. Please choose another." };
  }

  const newProfile: UserProfile = {
    uid: `user-${Date.now()}`,
    fullName: data.fullName,
    email: cleanEmail,
    username: data.username.trim(),
    tradeId: data.tradeId,
    level: data.level,
    role: "student",
    status: "pending_approval",
    passwordHash: data.password,
    createdAt: new Date().toISOString(),
  };

  await registerUserProfile(newProfile);

  await logActivity({
    userId: newProfile.uid,
    userName: newProfile.fullName,
    userEmail: newProfile.email || `${newProfile.username} (No Email)`,
    userLevel: newProfile.level,
    action: "STUDENT_REGISTER",
    details: `Registered account requested level ${newProfile.level} (Pending Approval)`,
  });

  return { success: true, user: newProfile };
}

export async function updateUserEmail(
  uid: string,
  newEmail: string
): Promise<{ success: boolean; message?: string }> {
  const clean = newEmail.trim();
  if (!clean || !clean.includes("@")) {
    return { success: false, message: "Please provide a valid email address." };
  }

  const users = await getAllUserProfiles();
  const existing = users.find(u => u.email && u.email.toLowerCase() === clean.toLowerCase() && u.uid !== uid);
  if (existing) {
    return { success: false, message: "This email address is already associated with another account." };
  }

  const user = users.find(u => u.uid === uid);
  if (user) {
    user.email = clean;
    await registerUserProfile(user);

    // Update current session if logged in
    const current = getStoredSession();
    if (current && current.uid === uid) {
      current.email = clean;
      saveStoredSession(current);
    }
    return { success: true };
  }

  return { success: false, message: "User profile not found." };
}
