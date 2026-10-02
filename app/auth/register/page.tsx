"use client";

import React, { useEffect, useState, useRef } from "react";
import { Trade, StudentLevel } from "@/types/auth";
import { getAllTrades } from "@/lib/db";
import { registerStudent, checkUsernameAvailability } from "@/lib/auth";
import { PasswordStrengthMeter } from "@/components/common/PasswordStrengthMeter";
import Link from "next/link";
import { 
  UserPlus, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  BookOpen, 
  ArrowLeft,
  GraduationCap,
  Loader2,
  Check,
  X
} from "lucide-react";

export default function RegisterPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(true);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [tradeId, setTradeId] = useState("");
  const [level, setLevel] = useState<StudentLevel>("Level 3");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Username availability state
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "unavailable">("idle");
  const [usernameMsg, setUsernameMsg] = useState("");
  const usernameTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Submission feedback
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      const list = await getAllTrades();
      setTrades(list);
      if (list.length > 0) setTradeId(list[0].id);
      setLoadingTrades(false);
    }
    load();
  }, []);

  // Debounced username availability checker
  useEffect(() => {
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) {
      setUsernameStatus("idle");
      setUsernameMsg("");
      return;
    }

    if (trimmed.length < 3) {
      setUsernameStatus("unavailable");
      setUsernameMsg("Username must be at least 3 characters");
      return;
    }

    setUsernameStatus("checking");
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);

    usernameTimerRef.current = setTimeout(async () => {
      try {
        const res = await checkUsernameAvailability(trimmed);
        if (res.available) {
          setUsernameStatus("available");
          setUsernameMsg("Username is available!");
        } else {
          setUsernameStatus("unavailable");
          setUsernameMsg(res.message || "Username is already taken");
        }
      } catch (e) {
        setUsernameStatus("idle");
        setUsernameMsg("");
      }
    }, 450);

    return () => {
      if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    };
  }, [username]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName || !username || !tradeId || !password || !confirmPassword) {
      setErrorMsg("Please fill in all required fields.");
      triggerShake();
      return;
    }

    if (usernameStatus === "unavailable") {
      setErrorMsg(usernameMsg || "Please select a valid, available username.");
      triggerShake();
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please verify your entry.");
      triggerShake();
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      triggerShake();
      return;
    }

    setSubmitting(true);
    try {
      const res = await registerStudent({
        fullName,
        email: email ? email.trim() : undefined,
        username: username.trim().toLowerCase(),
        tradeId,
        level,
        password,
      });

      if (!res.success) {
        setErrorMsg(res.message || "Registration failed.");
        triggerShake();
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
      triggerShake();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent p-4 text-[#CBD5E1]">
      <div className={`w-full max-w-lg rounded-2xl border border-[#334155]/80 bg-[#1E293B]/85 backdrop-blur-xl p-8 shadow-2xl transition-all ${shake ? "animate-shake border-rose-500/60" : ""}`}>
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
            <GraduationCap className="h-5 w-5 text-[#06B6D4]" />
            <span className="font-mono text-sm font-bold text-white">Student Registration</span>
          </div>
        </div>

        {success ? (
          <div className="space-y-4 text-center py-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#10B981]/20 text-[#10B981]">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-white">Registration Submitted!</h2>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Your account has been registered under <strong className="text-white">{level}</strong> and is currently <span className="text-[#F59E0B] font-mono">pending teacher verification</span>. Once approved by your instructor, you can log in to access your course syllabi.
            </p>

            <div className="pt-4">
              <Link
                href="/auth/login"
                prefetch={false}
                className="inline-flex w-full items-center justify-center rounded-xl bg-[#06B6D4] py-3 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-lg"
              >
                Go to Student Login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="flex items-center space-x-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-mono text-rose-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-mono text-[#94A3B8]">Full Name *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Josef Marie"
                className="mt-1 w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-mono text-[#94A3B8]">Email Address (Optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="josef.marie@school.edu"
                  className="mt-1 w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-[#94A3B8]">Username *</label>
                  {usernameStatus === "checking" && (
                    <span className="flex items-center space-x-1 text-[10px] text-[#94A3B8]">
                      <Loader2 className="h-2.5 w-2.5 animate-spin text-[#06B6D4]" />
                      <span>Checking...</span>
                    </span>
                  )}
                  {usernameStatus === "available" && (
                    <span className="flex items-center space-x-1 text-[10px] text-emerald-400 font-mono">
                      <Check className="h-3 w-3" />
                      <span>Available</span>
                    </span>
                  )}
                  {usernameStatus === "unavailable" && (
                    <span className="flex items-center space-x-1 text-[10px] text-rose-400 font-mono">
                      <X className="h-3 w-3" />
                      <span>Unavailable</span>
                    </span>
                  )}
                </div>
                <div className="relative mt-1">
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))}
                    placeholder="josef_m"
                    className={`w-full rounded-xl border bg-[#0B0F19] p-3 pr-8 text-xs text-white placeholder-[#64748B] focus:outline-none transition-colors ${
                      usernameStatus === "available"
                        ? "border-emerald-500/70 focus:border-emerald-400"
                        : usernameStatus === "unavailable"
                        ? "border-rose-500/70 focus:border-rose-400"
                        : "border-[#334155] focus:border-[#06B6D4]"
                    }`}
                  />
                  {usernameStatus === "available" && (
                    <Check className="absolute right-3 top-3.5 h-4 w-4 text-emerald-400 pointer-events-none" />
                  )}
                  {usernameStatus === "unavailable" && (
                    <X className="absolute right-3 top-3.5 h-4 w-4 text-rose-400 pointer-events-none" />
                  )}
                </div>
                {usernameMsg && (
                  <p className={`mt-1 text-[10px] font-mono ${usernameStatus === "available" ? "text-emerald-400" : "text-rose-400"}`}>
                    {usernameMsg}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-mono text-[#94A3B8]">Select Trade *</label>
                {loadingTrades ? (
                  <div className="mt-1 p-3 text-xs text-[#94A3B8]">Loading trades...</div>
                ) : (
                  <select
                    value={tradeId}
                    onChange={(e) => setTradeId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                  >
                    {trades.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="text-xs font-mono text-[#94A3B8]">Select Level *</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as StudentLevel)}
                  className="mt-1 w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                >
                  <option value="Level 3">Level 3</option>
                  <option value="Level 4">Level 4</option>
                  <option value="Level 5">Level 5</option>
                </select>
              </div>
            </div>

            {/* Password with Eye Toggle */}
            <div>
              <label className="text-xs font-mono text-[#94A3B8]">Password *</label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 pr-10 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-[#94A3B8] hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password Strength Meter */}
              <PasswordStrengthMeter password={password} />
            </div>

            {/* Confirm Password with Eye Toggle */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-[#94A3B8]">Confirm Password *</label>
                {confirmPassword && password && (
                  <span className={`text-[10px] font-mono ${password === confirmPassword ? "text-emerald-400" : "text-rose-400"}`}>
                    {password === confirmPassword ? "Passwords match ✓" : "Passwords do not match ✕"}
                  </span>
                )}
              </div>
              <div className="relative mt-1">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full rounded-xl border bg-[#0B0F19] p-3 pr-10 text-xs text-white placeholder-[#64748B] focus:outline-none ${
                    confirmPassword && password && password !== confirmPassword
                      ? "border-rose-500/70 focus:border-rose-400"
                      : confirmPassword && password && password === confirmPassword
                      ? "border-emerald-500/70 focus:border-emerald-400"
                      : "border-[#334155] focus:border-[#06B6D4]"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-[#94A3B8] hover:text-white"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || (usernameStatus === "unavailable")}
              className="mt-2 w-full rounded-xl bg-[#06B6D4] py-3 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-lg disabled:opacity-50"
            >
              {submitting ? "Submitting Registration..." : "Register Account"}
            </button>

            <div className="pt-2 text-center text-xs text-[#94A3B8]">
              Already have an account?{" "}
              <Link href="/auth/login" prefetch={false} className="font-bold text-[#06B6D4] hover:underline">
                Log In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
