"use client";

import React, { useState, useEffect } from "react";
import { loginAdmin, getAdminSession, getStoredSession } from "@/lib/auth";
import { getTOTPQRCodeUrl, DEFAULT_ADMIN_TOTP_SECRET } from "@/lib/totp";
import { UserProfile } from "@/types/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  ArrowLeft,
  Lock,
  UserCheck,
  Smartphone,
  KeyRound,
  QrCode,
  Check,
  Copy
} from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();

  // Login steps: 'credentials' -> 'totp_2fa'
  const [step, setStep] = useState<'credentials' | 'totp_2fa'>('credentials');

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [totpCode, setTotpCode] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [studentUser, setStudentUser] = useState<UserProfile | null>(null);

  // Authenticator QR Setup Modal
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Rate Limiting: Lockout after 5 failed attempts
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutRemainingSec, setLockoutRemainingSec] = useState<number>(0);

  useEffect(() => {
    const admin = getAdminSession();
    if (admin && admin.role === "teacher") {
      router.push("/admin");
      return;
    }
    const student = getStoredSession();
    if (student) {
      setStudentUser(student);
    }

    // Check stored lockout state
    const savedLockout = localStorage.getItem("syllabus_admin_login_lockout");
    if (savedLockout) {
      const until = parseInt(savedLockout, 10);
      if (until > Date.now()) {
        setLockoutUntil(until);
      } else {
        localStorage.removeItem("syllabus_admin_login_lockout");
      }
    }
  }, [router]);

  // Lockout countdown timer
  useEffect(() => {
    if (!lockoutUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setLockoutRemainingSec(remaining);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setFailedAttempts(0);
        localStorage.removeItem("syllabus_admin_login_lockout");
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (lockoutUntil && Date.now() < lockoutUntil) {
      setErrorMsg(`Too many failed attempts. Login locked for ${Math.ceil(lockoutRemainingSec / 60)} more minutes.`);
      return;
    }

    if (!email.trim() || !password) {
      setErrorMsg("Please enter your Admin Email and Password.");
      return;
    }

    setSubmitting(true);
    try {
      // Step 1 check (credentials only, no totpCode)
      const res = await loginAdmin(email, password);

      if (res.requires2FA) {
        // Password verified! Advance to Step 2
        setStep('totp_2fa');
        setErrorMsg(null);
      } else if (res.success) {
        router.push("/admin");
      } else {
        const nextFailed = failedAttempts + 1;
        setFailedAttempts(nextFailed);
        if (nextFailed >= 5) {
          const lockTime = Date.now() + 15 * 60 * 1000; // 15 minutes lockout
          setLockoutUntil(lockTime);
          localStorage.setItem("syllabus_admin_login_lockout", lockTime.toString());
          setErrorMsg("Maximum failed attempts exceeded. Admin login locked for 15 minutes.");
        } else {
          setErrorMsg(res.message || `Invalid admin credentials. (${5 - nextFailed} attempts remaining)`);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Authentication error.");
    } finally {
      setSubmitting(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanCode = totpCode.trim().replace(/\s+/g, "");
    if (cleanCode.length !== 6) {
      setErrorMsg("Please enter the 6-digit code from Google Authenticator.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await loginAdmin(email, password, cleanCode);

      if (res.success) {
        router.push("/admin");
      } else {
        setErrorMsg(res.message || "Invalid 6-digit Authenticator code. Check your phone app.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Verification failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const copySecretKey = () => {
    navigator.clipboard.writeText(DEFAULT_ADMIN_TOTP_SECRET);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const isLockedOut = Boolean(lockoutUntil && Date.now() < lockoutUntil);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0F19] p-4 text-[#CBD5E1]">
      <div className="w-full max-w-md rounded-2xl border border-[#334155] bg-[#1E293B] p-8 shadow-2xl relative">
        <div className="mb-6 flex items-center justify-between border-b border-[#334155] pb-4">
          <Link
            href="/"
            className="inline-flex items-center space-x-1.5 text-xs text-[#94A3B8] hover:text-white transition-colors bg-[#0B0F19] px-3 py-1.5 rounded-lg border border-[#334155]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Catalog</span>
          </Link>

          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-[#06B6D4]" />
            <span className="font-mono text-sm font-bold text-white">Teacher Portal Login</span>
          </div>
        </div>

        {studentUser && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            <div className="flex items-center space-x-2 font-bold mb-1">
              <UserCheck className="h-4 w-4 text-amber-400" />
              <span>Signed in as Student</span>
            </div>
            <p className="text-[11px] text-amber-300/80">
              You are currently signed in as <strong>{studentUser.fullName}</strong>. Only the authorized instructor can log into this portal.
            </p>
          </div>
        )}

        {isLockedOut && (
          <div className="mb-4 rounded-xl border border-rose-500/50 bg-rose-500/10 p-4 text-xs font-mono text-rose-300 text-center">
            <AlertCircle className="h-6 w-6 text-rose-400 mx-auto mb-2" />
            <p className="font-bold">Security Lockout Active</p>
            <p className="mt-1 text-rose-400/80">Too many failed login attempts.</p>
            <p className="mt-2 text-base font-bold text-white font-mono">
              Unlocks in {Math.floor(lockoutRemainingSec / 60)}:{(lockoutRemainingSec % 60).toString().padStart(2, "0")}
            </p>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 flex items-center space-x-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-mono text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: CREDENTIALS */}
        {step === 'credentials' && (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-mono text-[#94A3B8]">Teacher Admin Email *</label>
              <input
                type="email"
                required
                disabled={isLockedOut}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Teacher email"
                className="mt-1 w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="text-xs font-mono text-[#94A3B8]">Admin Password *</label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  disabled={isLockedOut}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 pr-10 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-[#94A3B8] hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || isLockedOut}
              className="mt-2 flex w-full items-center justify-center space-x-2 rounded-xl bg-[#06B6D4] py-3 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-lg disabled:opacity-50"
            >
              <Lock className="h-4 w-4" />
              <span>{submitting ? "Verifying Credentials..." : "Continue to 2-Step Verification"}</span>
            </button>

            <div className="pt-4 border-t border-[#334155] text-center text-xs text-[#94A3B8]">
              Need Student Portal access?{" "}
              <Link href="/auth/login" className="font-bold text-[#06B6D4] hover:underline">
                Student Login
              </Link>
            </div>
          </form>
        )}

        {/* STEP 2: GOOGLE AUTHENTICATOR 2FA */}
        {step === 'totp_2fa' && (
          <form onSubmit={handle2FASubmit} className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="rounded-xl border border-[#06B6D4]/30 bg-[#06B6D4]/10 p-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#06B6D4]/20 text-[#06B6D4] mb-2">
                <Smartphone className="h-6 w-6 animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-white">Google Authenticator (2FA)</h3>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Open the Authenticator app on your phone and enter your current 6-digit confirmation code.
              </p>
            </div>

            <div>
              <label className="text-xs font-mono text-[#94A3B8] block text-center mb-2">
                6-Digit Confirmation Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                autoFocus
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full tracking-[0.5em] text-center font-mono text-2xl font-black rounded-xl border border-[#06B6D4]/50 bg-[#0B0F19] p-3 text-white placeholder-[#334155] focus:border-[#06B6D4] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || totpCode.trim().length !== 6}
              className="flex w-full items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-[#06B6D4] to-cyan-400 py-3 text-xs font-bold text-slate-950 hover:brightness-110 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              <KeyRound className="h-4 w-4" />
              <span>{submitting ? "Verifying Authenticator Code..." : "Authorize & Enter Admin Portal"}</span>
            </button>

            <div className="flex items-center justify-between pt-3 border-t border-[#334155] text-xs">
              <button
                type="button"
                onClick={() => {
                  setStep('credentials');
                  setErrorMsg(null);
                }}
                className="text-[#94A3B8] hover:text-white transition-colors"
              >
                ← Back
              </button>

              <button
                type="button"
                onClick={() => setShowSetupModal(true)}
                className="inline-flex items-center space-x-1 text-[#06B6D4] hover:underline"
              >
                <QrCode className="h-3.5 w-3.5" />
                <span>Pair / View QR Code</span>
              </button>
            </div>
          </form>
        )}

        {/* SETUP / QR CODE MODAL */}
        {showSetupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl border border-[#334155] bg-[#1E293B] p-6 text-center shadow-2xl">
              <h3 className="text-sm font-bold text-white mb-1">Pair Google Authenticator</h3>
              <p className="text-xs text-[#94A3B8] mb-4">
                Scan this QR code with Google Authenticator or Microsoft Authenticator on your phone.
              </p>

              {/* QR Code Image */}
              <div className="mx-auto my-3 flex justify-center rounded-2xl bg-white p-3 w-fit shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getTOTPQRCodeUrl(email || "layjoe0001@gmail.com")}
                  alt="Google Authenticator QR Code"
                  className="h-48 w-48"
                />
              </div>

              {/* Manual Secret Key */}
              <div className="mt-4 text-left">
                <label className="text-[11px] font-mono text-[#94A3B8]">Manual Setup Key:</label>
                <div className="flex items-center justify-between rounded-lg bg-[#0B0F19] p-2 border border-[#334155] mt-1">
                  <span className="font-mono text-xs text-amber-300 select-all break-all">
                    {DEFAULT_ADMIN_TOTP_SECRET}
                  </span>
                  <button
                    type="button"
                    onClick={copySecretKey}
                    className="ml-2 p-1.5 rounded-md hover:bg-[#1E293B] text-[#94A3B8] hover:text-white"
                  >
                    {copiedKey ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSetupModal(false)}
                className="mt-5 w-full rounded-xl bg-[#334155] py-2.5 text-xs font-bold text-white hover:bg-[#475569] transition-colors"
              >
                Close & Return
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
