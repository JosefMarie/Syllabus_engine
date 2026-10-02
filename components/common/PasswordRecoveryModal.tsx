"use client";

import React, { useState } from "react";
import { requestPasswordReset, resetPasswordWithRecoveryCode } from "@/lib/auth";
import PasswordStrengthMeter from "./PasswordStrengthMeter";
import { 
  KeyRound, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Lock, 
  User, 
  ShieldCheck,
  HelpCircle,
  Copy,
  Check
} from "lucide-react";

interface PasswordRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPasswordResetSuccess: (identifier: string) => void;
  initialIdentifier?: string;
}

export default function PasswordRecoveryModal({
  isOpen,
  onClose,
  onPasswordResetSuccess,
  initialIdentifier = ""
}: PasswordRecoveryModalProps) {
  const [step, setStep] = useState<"request" | "verify" | "success">("request");
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!identifier.trim()) {
      setErrorMsg("Please enter your student username or email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await requestPasswordReset(identifier);
      if (!res.success) {
        setErrorMsg(res.message);
      } else {
        if (res.recoveryCode) {
          setGeneratedCode(res.recoveryCode);
          setRecoveryCode(res.recoveryCode);
        }
        setStep("verify");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to generate recovery code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!recoveryCode.trim()) {
      setErrorMsg("Please enter the 6-digit recovery code.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await resetPasswordWithRecoveryCode(identifier, recoveryCode, newPassword);
      if (!res.success) {
        setErrorMsg(res.message);
      } else {
        setStep("success");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md rounded-3xl border border-cyan-500/40 bg-[#1E293B]/90 backdrop-blur-2xl p-6 sm:p-7 shadow-2xl shadow-cyan-950/40 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow halo */}
        <div className="absolute -top-20 -right-20 h-44 w-44 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#334155]/60 pb-3.5 mb-4">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Student Account Recovery</h3>
              <span className="text-[10px] font-mono text-[#94A3B8]">
                {step === "request" ? "Step 1 of 2: Request Code" : step === "verify" ? "Step 2 of 2: Create New Password" : "Reset Complete"}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#94A3B8] hover:text-white hover:bg-[#334155]/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 flex items-center space-x-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-mono text-rose-400 animate-shake">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: REQUEST CODE */}
        {step === "request" && (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Enter your student username or school email address. We will generate a one-time 6-digit recovery code for your account.
            </p>

            <div>
              <label className="text-xs font-mono text-[#CBD5E1] block mb-1">
                Student Username or Email *
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 h-4 w-4 text-[#64748B]" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. josef_m or josef@school.edu"
                  className="w-full rounded-xl border border-[#334155]/70 bg-[#0B0F19]/60 backdrop-blur-md py-2.5 pl-10 pr-3 text-xs text-white placeholder-[#64748B] focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] font-mono text-amber-300 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold">
                <HelpCircle className="h-3.5 w-3.5" />
                <span>Classroom Instructor Assistance:</span>
              </div>
              <p className="text-[10px] text-amber-300/80 leading-relaxed font-sans">
                If you are in a computer lab with no external email access, your teacher can also reset your password directly from the Teacher Portal.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#334155]/70 bg-[#1E293B]/70 px-4 py-2 text-xs font-semibold text-[#CBD5E1] hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center space-x-1.5 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-all shadow-lg disabled:opacity-50"
              >
                <span>{loading ? "Generating..." : "Generate Code"}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: ENTER CODE & NEW PASSWORD */}
        {step === "verify" && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            {generatedCode && (
              <div className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 p-3.5 flex items-center justify-between">
                <div>
                  <span className="block text-[10px] font-mono text-[#94A3B8] uppercase">
                    Your One-Time Recovery Code:
                  </span>
                  <span className="text-xl font-mono font-black text-cyan-300 tracking-wider">
                    {generatedCode}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(generatedCode)}
                  className="inline-flex items-center space-x-1 rounded-lg border border-cyan-500/40 bg-cyan-500/20 px-2.5 py-1 text-xs font-mono font-bold text-cyan-200 hover:bg-cyan-500/30 transition-all"
                >
                  {copiedCode ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedCode ? "Copied" : "Copy"}</span>
                </button>
              </div>
            )}

            <div>
              <label className="text-xs font-mono text-[#CBD5E1] block mb-1">
                6-Digit Recovery Code *
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                placeholder="123456"
                className="w-full rounded-xl border border-[#334155]/70 bg-[#0B0F19]/60 backdrop-blur-md py-2.5 px-3 text-center text-sm font-mono tracking-widest text-white placeholder-[#64748B] focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-mono text-[#CBD5E1] block mb-1">
                New Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-[#64748B]" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full rounded-xl border border-[#334155]/70 bg-[#0B0F19]/60 backdrop-blur-md py-2.5 pl-10 pr-10 text-xs text-white placeholder-[#64748B] focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-[#94A3B8] hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <PasswordStrengthMeter password={newPassword} showRules={true} />
            </div>

            <div>
              <label className="text-xs font-mono text-[#CBD5E1] block mb-1">
                Confirm New Password *
              </label>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full rounded-xl border border-[#334155]/70 bg-[#0B0F19]/60 backdrop-blur-md py-2.5 px-3 text-xs text-white placeholder-[#64748B] focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep("request")}
                className="text-xs font-mono text-[#94A3B8] hover:text-white transition-colors"
              >
                &larr; Back to request
              </button>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 px-4 py-2 text-xs font-bold text-slate-950 hover:brightness-110 transition-all shadow-lg disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>{loading ? "Updating..." : "Update Password"}</span>
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: SUCCESS */}
        {step === "success" && (
          <div className="py-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <h4 className="text-base font-bold text-white">Password Updated Successfully!</h4>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Your password has been securely reset. You can now sign into your student account immediately.
            </p>

            <button
              type="button"
              onClick={() => {
                onPasswordResetSuccess(identifier);
                onClose();
              }}
              className="inline-flex w-full items-center justify-center space-x-2 rounded-xl bg-cyan-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-all shadow-lg"
            >
              <span>Continue to Log In</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
