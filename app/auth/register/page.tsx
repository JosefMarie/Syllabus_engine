"use client";

import React, { useEffect, useState } from "react";
import { Trade, StudentLevel } from "@/types/auth";
import { getAllTrades } from "@/lib/db";
import { registerStudent } from "@/lib/auth";
import Link from "next/link";
import { 
  UserPlus, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  BookOpen, 
  ArrowLeft,
  GraduationCap
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

  // Visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Submission feedback
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName || !username || !tradeId || !password || !confirmPassword) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please verify your entry.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await registerStudent({
        fullName,
        email: email ? email.trim() : undefined,
        username,
        tradeId,
        level,
        password,
      });

      if (!res.success) {
        setErrorMsg(res.message || "Registration failed.");
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0F19] p-4 text-[#CBD5E1]">
      <div className="w-full max-w-lg rounded-2xl border border-[#334155] bg-[#1E293B] p-8 shadow-2xl">
        <div className="mb-6 flex items-center justify-between border-b border-[#334155] pb-4">
          <Link
            href="/"
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
                  placeholder="josef.marie@school.edu (Optional)"
                  className="mt-1 w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-[#94A3B8]">Username *</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="josef_m"
                  className="mt-1 w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
                />
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
            </div>

            {/* Confirm Password with Eye Toggle */}
            <div>
              <label className="text-xs font-mono text-[#94A3B8]">Confirm Password *</label>
              <div className="relative mt-1">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 pr-10 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
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
              disabled={submitting}
              className="mt-2 w-full rounded-xl bg-[#06B6D4] py-3 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-lg disabled:opacity-50"
            >
              {submitting ? "Submitting Registration..." : "Register Account"}
            </button>

            <div className="pt-2 text-center text-xs text-[#94A3B8]">
              Already have an account?{" "}
              <Link href="/auth/login" className="font-bold text-[#06B6D4] hover:underline">
                Log In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
