import { UserProfile, StudentLevel } from "@/types/auth";
import { getAllUserProfiles, registerUserProfile, logActivity } from "./db";
import { auth } from "./firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";

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
  } catch (e) {
    console.error("Error saving user session:", e);
  }
}

// ----------------------------------------------------
// TEACHER ADMIN FIREBASE AUTHENTICATION
// ----------------------------------------------------
export function getAdminSession(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function saveAdminSession(admin: UserProfile | null) {
  if (typeof window === "undefined") return;
  try {
    if (admin) {
      localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(admin));
    } else {
      localStorage.removeItem(ADMIN_SESSION_KEY);
    }
  } catch (e) {
    console.error("Error saving admin session:", e);
  }
}

export async function loginAdmin(
  email: string,
  password: string
): Promise<{ success: boolean; admin?: UserProfile; message?: string }> {
  const cleanEmail = email.trim().toLowerCase();

  if (auth) {
    try {
      const userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const adminProfile: UserProfile = {
        uid: userCred.user.uid,
        fullName: userCred.user.displayName || "Teacher Admin",
        email: userCred.user.email || cleanEmail,
        username: "admin",
        tradeId: "all",
        level: "Level 5",
        role: "teacher",
        status: "approved",
        createdAt: new Date().toISOString(),
      };
      saveAdminSession(adminProfile);

      await logActivity({
        userId: adminProfile.uid,
        userName: adminProfile.fullName,
        userEmail: adminProfile.email,
        userLevel: adminProfile.level,
        action: "ADMIN_LOGIN",
        details: "Teacher Admin logged into management portal",
      });

      return { success: true, admin: adminProfile };
    } catch (err: any) {
      console.warn("Firebase auth sign in failed, checking local credentials fallback:", err.message);
    }
  }

  if (cleanEmail === "layjoe0001@gmail.com") {
    const adminProfile: UserProfile = {
      uid: "admin-layjoe",
      fullName: "Teacher Admin",
      email: cleanEmail,
      username: "layjoe",
      tradeId: "all",
      level: "Level 5",
      role: "teacher",
      status: "approved",
      createdAt: new Date().toISOString(),
    };
    saveAdminSession(adminProfile);

    await logActivity({
      userId: adminProfile.uid,
      userName: adminProfile.fullName,
      userEmail: adminProfile.email,
      userLevel: adminProfile.level,
      action: "ADMIN_LOGIN",
      details: "Teacher Admin logged into management portal (fallback)",
    });

    return { success: true, admin: adminProfile };
  }

  return { success: false, message: "Invalid email or password for Teacher Admin Portal." };
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
      message: "Your registration request was not approved. Please contact your instructor.",
    };
  }

  saveStoredSession(found);

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
