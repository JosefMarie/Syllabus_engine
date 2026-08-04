"use client";

import React, { useState } from "react";
import { loginUser } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  LogIn, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  ArrowLeft,
  GraduationCap,
  ShieldCheck
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!identifier || !password) {
      setErrorMsg("Please enter your Email/Username and Password.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await loginUser(identifier, password);

      if (!res.success) {
        setErrorMsg(res.message || "Login failed.");
      } else {
        router.push("/");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0F19] p-4 text-[#CBD5E1]">
      <div className="w-full max-w-md rounded-2xl border border-[#334155] bg-[#1E293B] p-8 shadow-2xl">
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
            <span className="font-mono text-sm font-bold text-white">Student Login</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="flex items-center space-x-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-mono text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-mono text-[#94A3B8]">Email or Username *</label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="student@school.edu or alex_j"
              className="mt-1 w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
            />
          </div>

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

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-xl bg-[#06B6D4] py-3 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-lg disabled:opacity-50"
          >
            {submitting ? "Signing in..." : "Log In to Student Workspace"}
          </button>

          <div className="pt-4 border-t border-[#334155] flex flex-col gap-2 text-center text-xs text-[#94A3B8]">
            <div>
              Don't have an account?{" "}
              <Link href="/auth/register" className="font-bold text-[#06B6D4] hover:underline">
                Create Student Account
              </Link>
            </div>

            <div className="pt-2">
              <Link
                href="/admin"
                className="inline-flex items-center space-x-1.5 text-xs text-[#94A3B8] hover:text-[#06B6D4] transition-colors"
              >
                <ShieldCheck className="h-4 w-4 text-[#06B6D4]" />
                <span>Teacher Admin Access</span>
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
