"use client";

import React from "react";
import { Check, X, Shield, ShieldCheck, ShieldAlert } from "lucide-react";

interface PasswordStrengthMeterProps {
  password: string;
  showRules?: boolean;
}

export function calculatePasswordStrength(password: string) {
  let score = 0;
  if (!password) return { score: 0, label: "Empty", color: "bg-slate-700", textColor: "text-slate-500" };

  const checks = {
    hasLength: password.length >= 6,
    hasLengthBonus: password.length >= 10,
    hasNumber: /\d/.test(password),
    hasMixedCase: /[a-z]/.test(password) && /[A-Z]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };

  if (checks.hasLength) score += 1;
  if (checks.hasNumber) score += 1;
  if (checks.hasMixedCase) score += 1;
  if (checks.hasSpecial || checks.hasLengthBonus) score += 1;

  if (score <= 1) return { score: 1, label: "Weak", color: "bg-rose-500", textColor: "text-rose-400", checks };
  if (score === 2) return { score: 2, label: "Fair", color: "bg-amber-500", textColor: "text-amber-400", checks };
  if (score === 3) return { score: 3, label: "Good", color: "bg-cyan-400", textColor: "text-cyan-400", checks };
  return { score: 4, label: "Strong", color: "bg-emerald-400", textColor: "text-emerald-400", checks };
}

export default function PasswordStrengthMeter({ password, showRules = true }: PasswordStrengthMeterProps) {
  if (!password) return null;

  const { score, label, color, textColor, checks } = calculatePasswordStrength(password);

  return (
    <div className="space-y-2 pt-1 animate-in fade-in duration-200">
      {/* Bars & Label */}
      <div className="flex items-center justify-between gap-2">
        <div className="grid grid-cols-4 gap-1.5 flex-1">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                step <= score ? color : "bg-[#334155]/60"
              }`}
            />
          ))}
        </div>
        <span className={`text-[11px] font-mono font-bold shrink-0 ${textColor}`}>
          {label}
        </span>
      </div>

      {/* Rules Breakdown Checklist */}
      {showRules && checks && (
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 text-[10px] font-mono text-[#94A3B8]">
          <div className={`flex items-center space-x-1.5 ${checks.hasLength ? "text-emerald-400" : ""}`}>
            {checks.hasLength ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0 opacity-40" />}
            <span>Min. 6 chars</span>
          </div>

          <div className={`flex items-center space-x-1.5 ${checks.hasNumber ? "text-emerald-400" : ""}`}>
            {checks.hasNumber ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0 opacity-40" />}
            <span>Has number (0-9)</span>
          </div>

          <div className={`flex items-center space-x-1.5 ${checks.hasMixedCase ? "text-emerald-400" : ""}`}>
            {checks.hasMixedCase ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0 opacity-40" />}
            <span>Upper & lowercase</span>
          </div>

          <div className={`flex items-center space-x-1.5 ${checks.hasSpecial ? "text-emerald-400" : ""}`}>
            {checks.hasSpecial ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0 opacity-40" />}
            <span>Symbol (!@#$)</span>
          </div>
        </div>
      )}
    </div>
  );
}

export { PasswordStrengthMeter };
