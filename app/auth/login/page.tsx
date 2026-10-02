"use client";

import React, { useState, useEffect, Suspense } from "react";
import { loginUser, getRememberedStudent, saveRememberedStudent, RememberedStudent } from "@/lib/auth";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PasswordRecoveryModal from "@/components/common/PasswordRecoveryModal";
import { 
  LogIn, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  ArrowLeft,
  GraduationCap,
  ShieldCheck,
  Info,
  UserCheck,
  KeyRound,
  RotateCcw
} from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [rememberedStudent, setRememberedStudent] = useState<RememberedStudent | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shakeError, setShakeError] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  useEffect(() => {
    const remembered = getRememberedStudent();
    if (remembered) {
      setRememberedStudent(remembered);
      setIdentifier(remembered.username);
    }
  }, []);

  const triggerErrorShake = (msg: string) => {
    setErrorMsg(msg);
    setShakeError(true);
    setTimeout(() => setShakeError(false), 450);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!identifier || !password) {
      triggerErrorShake("Please enter your Email/Username and Password.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await loginUser(identifier, password);

      if (!res.success) {
        triggerErrorShake(res.message || "Login failed.");
      } else {
        if (rememberMe && res.user) {
          saveRememberedStudent({
            username: res.user.username,
            fullName: res.user.fullName,
            level: res.user.level,
            avatarLetter: (res.user.fullName || res.user.username).charAt(0).toUpperCase(),
            lastLogin: Date.now()
          });
        }
        router.push("/");
      }
    } catch (err: any) {
      triggerErrorShake(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgetQuickAccount = () => {
    saveRememberedStudent(null);
    setRememberedStudent(null);
    setIdentifier("");
    setPassword("");
  };

  return (
    <>
      <div className={`w-full max-w-md rounded-3xl border border-[#334155]/80 bg-[#1E293B]/85 backdrop-blur-2xl p-7 sm:p-8 shadow-2xl transition-all ${
        shakeError ? "animate-shake border-rose-500/60" : ""
      }`}>
        <div className="mb-6 flex items-center justify-between border-b border-[#334155]/60 pb-4">
          <Link
            href="/"
            prefetch={false}
            className="inline-flex items-center space-x-1.5 text-xs text-[#94A3B8] hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Catalog</span>
          </Link>

          <div className="flex items-center space-x-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <GraduationCap className="h-4 w-4" />
            </div>
            <span className="font-mono text-sm font-bold text-white">Student Login</span>
          </div>
        </div>

        {/* Quick Switcher / Remembered Student Avatar Card */}
        {rememberedStudent && (
          <div className="mb-5 rounded-2xl border border-cyan-500/40 bg-cyan-500/10 p-3.5 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-teal-400 text-slate-950 font-bold font-mono shadow-md">
                {rememberedStudent.avatarLetter}
              </div>
              <div>
                <span className="block text-xs font-bold text-white">
                  {rememberedStudent.fullName}
                </span>
                <span className="block text-[10px] font-mono text-cyan-300">
                  {rememberedStudent.level} • @{rememberedStudent.username}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleForgetQuickAccount}
              className="text-[10px] font-mono text-[#94A3B8] hover:text-rose-400 p-1.5 rounded-lg hover:bg-[#1E293B]/60 transition-colors"
              title="Sign in with a different account"
            >
              Switch Account
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {reason === 'timeout' && (
            <div className="flex items-center space-x-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs font-mono text-amber-400">
              <Info className="h-4 w-4 shrink-0" />
              <span>Your session timed out after 5 minutes of inactivity. Please log in again.</span>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center space-x-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-mono text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-mono text-[#CBD5E1]">Email or Username *</label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="josef.marie@school.edu or josef_m"
              className="mt-1 w-full rounded-xl border border-[#334155]/70 bg-[#0B0F19]/60 backdrop-blur-md p-3 text-xs text-white placeholder-[#64748B] focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition-all shadow-inner"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-[#CBD5E1]">Password *</label>
              <button
                type="button"
                onClick={() => setShowRecoveryModal(true)}
                className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 hover:underline"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative mt-1">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-[#334155]/70 bg-[#0B0F19]/60 backdrop-blur-md p-3 pr-10 text-xs text-white placeholder-[#64748B] focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition-all shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-[#94A3B8] hover:text-white transition-colors"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <label className="flex items-center space-x-2 text-[#94A3B8] hover:text-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-[#334155] bg-[#0B0F19] text-cyan-500 focus:ring-cyan-500/30"
              />
              <span className="font-mono text-[11px]">Remember on this device</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 py-3 text-xs font-bold text-slate-950 hover:brightness-110 active:scale-[0.99] transition-all shadow-lg shadow-cyan-950/30 disabled:opacity-50"
          >
            {submitting ? "Signing in..." : "Log In to Student Workspace"}
          </button>

          <div className="pt-4 border-t border-[#334155]/70 flex flex-col gap-2 text-center text-xs text-[#94A3B8]">
            <div>
              Don't have an account?{" "}
              <Link href="/auth/register" prefetch={false} className="font-bold text-cyan-400 hover:text-cyan-300 hover:underline">
                Create Student Account
              </Link>
            </div>

            <div className="pt-2">
              <Link
                href="/admin"
                prefetch={false}
                className="inline-flex items-center space-x-1.5 text-xs text-[#94A3B8] hover:text-cyan-400 transition-colors"
              >
                <ShieldCheck className="h-4 w-4 text-cyan-400" />
                <span>Teacher Admin Access</span>
              </Link>
            </div>
          </div>
        </form>
      </div>

      <PasswordRecoveryModal
        isOpen={showRecoveryModal}
        onClose={() => setShowRecoveryModal(false)}
        initialIdentifier={identifier}
        onPasswordResetSuccess={(id) => {
          setIdentifier(id);
          setErrorMsg(null);
        }}
      />
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent p-4 text-[#CBD5E1]">
      <Suspense fallback={
        <div className="w-full max-w-md rounded-2xl border border-[#334155]/80 bg-[#1E293B]/85 backdrop-blur-xl p-8 shadow-2xl flex justify-center items-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#06B6D4] border-t-transparent" />
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
