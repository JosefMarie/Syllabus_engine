"use client";

import React, { useState } from "react";
import { loginAdmin } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  ArrowLeft,
  Lock
} from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("layjoe0001@gmail.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email || !password) {
      setErrorMsg("Please enter your Admin Email and Password.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await loginAdmin(email, password);

      if (!res.success) {
        setErrorMsg(res.message || "Admin login failed.");
      } else {
        router.push("/admin");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Authentication error.");
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
            <ShieldCheck className="h-5 w-5 text-[#06B6D4]" />
            <span className="font-mono text-sm font-bold text-white">Teacher Portal Login</span>
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
            <label className="text-xs font-mono text-[#94A3B8]">Teacher Admin Email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="josef.marie@tvet.edu.rw or layjoe0001@gmail.com"
              className="mt-1 w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-3 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-[#94A3B8]">Admin Password *</label>
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
            className="mt-2 flex w-full items-center justify-center space-x-2 rounded-xl bg-[#06B6D4] py-3 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-lg disabled:opacity-50"
          >
            <Lock className="h-4 w-4" />
            <span>{submitting ? "Authenticating with Firebase..." : "Access Teacher Admin Portal"}</span>
          </button>

          <div className="pt-4 border-t border-[#334155] text-center text-xs text-[#94A3B8]">
            Need Student Portal access?{" "}
            <Link href="/auth/login" className="font-bold text-[#06B6D4] hover:underline">
              Student Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
