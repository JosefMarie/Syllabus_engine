"use client";

import React, { useEffect, useState } from "react";
import { ShieldAlert, AlertOctagon, Volume2, VolumeX, LogOut, Lock, XCircle, ArrowRight } from "lucide-react";
import { saveStoredSession } from "@/lib/auth";

interface DisciplinaryLockdownProps {
  studentName?: string;
  studentUsername?: string;
  reason?: string;
  violationsCount?: number;
  onUnlock?: () => void;
}

export default function DisciplinaryLockdown({
  studentName = "Student",
  studentUsername = "student",
  reason = "Exceeded 10 side-window / focus violations during active syllabus study.",
  violationsCount = 10,
}: DisciplinaryLockdownProps) {
  const [muted, setMuted] = useState(false);
  const [tabCloseFailed, setTabCloseFailed] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminTotpCode, setAdminTotpCode] = useState("");
  const [adminError, setAdminError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  // Play continuous disciplinary alert buzzer / siren using Web Audio API
  useEffect(() => {
    let isCancelled = false;
    let audioCtx: AudioContext | null = null;
    let timer: any = null;

    const playAlarmCycle = () => {
      if (isCancelled || muted) return;
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        if (!audioCtx || audioCtx.state === "closed") {
          audioCtx = new AudioContextClass();
        }
        if (audioCtx.state === "suspended") {
          audioCtx.resume();
        }

        const now = audioCtx.currentTime;

        // Alarm burst: 3 intense alternating pulses
        [
          { freq: 880, start: 0, dur: 0.16 },
          { freq: 587.33, start: 0.2, dur: 0.16 },
          { freq: 880, start: 0.4, dur: 0.16 },
          { freq: 587.33, start: 0.6, dur: 0.22 },
        ].forEach(({ freq, start, dur }) => {
          if (!audioCtx) return;
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(freq, now + start);

          gain.gain.setValueAtTime(0.2, now + start);
          gain.gain.exponentialRampToValueAtTime(0.01, now + start + dur);

          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + start);
          osc.stop(now + start + dur);
        });
      } catch (e) {
        // AudioContext may be restricted by browser until user gestures
      }
    };

    // Play first cycle
    playAlarmCycle();
    // Repeat alert pattern every 3.5 seconds
    timer = setInterval(playAlarmCycle, 3500);

    return () => {
      isCancelled = true;
      clearInterval(timer);
      if (audioCtx && audioCtx.state !== "closed") {
        try {
          audioCtx.close();
        } catch (e) {}
      }
    };
  }, [muted]);

  // Trap back navigation and key shortcuts
  useEffect(() => {
    // Attempt fullscreen if allowed
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (e) {}

    // Lock navigation stack
    window.history.pushState(null, "", window.location.href);
    const onPopState = () => {
      window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", onPopState);

    // Trap keyboard shortcuts (Ctrl+W, F11, Alt+F4, etc.)
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" ||
        e.key === "F11" ||
        (e.altKey && e.key === "Tab") ||
        (e.ctrlKey && (e.key === "w" || e.key === "W" || e.key === "r" || e.key === "R"))
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const handleCloseTab = () => {
    // Attempt window.close
    window.close();
    // In standard browsers where window.close() is blocked for non-popup tabs:
    setTimeout(() => {
      setTabCloseFailed(true);
    }, 400);
  };

  const handleInstructorUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlocking(true);
    setAdminError(null);

    try {
      const { loginAdmin } = await import("@/lib/auth");
      const res = await loginAdmin(adminEmail, adminPassword, adminTotpCode);
      if (res.success) {
        // If teacher is unlocking student in person, re-approve student
        const { updateStudentStatus } = await import("@/lib/db");
        const currentSession = JSON.parse(localStorage.getItem("syllabus_platform_current_user_v1") || "{}");
        if (currentSession?.uid) {
          await updateStudentStatus(currentSession.uid, "approved");
        }
        window.location.href = "/admin";
      } else {
        setAdminError(res.message || "Invalid instructor credentials or 6-digit Authenticator code.");
      }
    } catch (err: any) {
      setAdminError(err.message || "Authentication failed.");
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-[#07090E] p-4 sm:p-6 text-center select-none overflow-y-auto"
      style={{
        border: "12px solid #E11D48",
        boxShadow: "inset 0 0 100px rgba(225, 29, 72, 0.4)",
      }}
    >
      {/* Background glowing red radial haze */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-rose-950/50 via-[#0B0F19] to-black -z-10 pointer-events-none" />

      {/* Top Floating Siren Badge */}
      <div className="animate-bounce inline-flex items-center space-x-2 rounded-full bg-rose-600 border border-rose-400 px-5 py-2 text-xs sm:text-sm font-mono font-black text-white uppercase tracking-widest shadow-[0_0_30px_rgba(225,29,72,0.8)] mb-6">
        <ShieldAlert className="h-5 w-5 animate-pulse" />
        <span>DISCIPLINARY SYSTEM LOCKDOWN</span>
      </div>

      {/* Main Lockout Dialog */}
      <div className="w-full max-w-xl rounded-3xl border-2 border-rose-500/60 bg-[#121824]/95 p-6 sm:p-10 shadow-[0_0_80px_rgba(225,29,72,0.3)] backdrop-blur-xl space-y-6">
        {/* Pulsing Alarm Icon */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-500/20 text-rose-400 border-2 border-rose-500/50 shadow-[0_0_40px_rgba(244,63,94,0.6)]">
          <AlertOctagon className="h-10 w-10 animate-pulse" />
        </div>

        {/* Lockout Headline */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight uppercase leading-tight">
            Study Session Terminated
          </h1>
          <p className="text-sm sm:text-base font-mono font-bold text-rose-400">
            Violation Limit Reached: {violationsCount} / 10 Side Windows
          </p>
        </div>

        {/* Violation Notice Box */}
        <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 text-left text-xs space-y-2.5">
          <div className="flex justify-between items-center border-b border-rose-500/20 pb-2">
            <span className="text-[#94A3B8] font-mono">Student Account:</span>
            <span className="font-bold text-white font-mono">{studentName} (@{studentUsername})</span>
          </div>

          <div className="flex justify-between items-center border-b border-rose-500/20 pb-2">
            <span className="text-[#94A3B8] font-mono">Disciplinary Action:</span>
            <span className="font-bold text-rose-400 font-mono">Account Rejected / Suspended</span>
          </div>

          <div className="text-[11px] text-[#CBD5E1] leading-relaxed pt-1">
            {reason}
          </div>
        </div>

        {/* Strict Instructor Re-approval Notice */}
        <div className="rounded-xl bg-[#0B0F19] border border-[#334155] p-4 text-xs text-[#94A3B8] leading-relaxed">
          <p className="font-semibold text-white mb-1">
            🔒 This workstation is locked out of the syllabus platform.
          </p>
          Learning timers and subtopic access have been frozen. To unlock this account, your course instructor must re-approve you in the Teacher Admin Portal.
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {/* Close / Terminate Tab button */}
            <button
              onClick={handleCloseTab}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 rounded-xl bg-rose-600 px-6 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-rose-500 transition-all shadow-lg hover:shadow-rose-600/50"
            >
              <LogOut className="h-4 w-4" />
              <span>Close Window</span>
            </button>

            {/* Mute Audio Siren */}
            <button
              onClick={() => setMuted(!muted)}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 rounded-xl border border-[#334155] bg-[#0B0F19] px-4 py-3 text-xs font-semibold text-[#CBD5E1] hover:text-white hover:border-slate-500 transition-all"
            >
              {muted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-[#06B6D4]" />}
              <span>{muted ? "Unmute Alarm" : "Silence Siren"}</span>
            </button>
          </div>

          {/* If window.close was blocked by browser */}
          {tabCloseFailed && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
              Browser security prevented closing this tab automatically. Please press <strong>Ctrl + W</strong> (or close the tab manually) and report to your teacher.
            </div>
          )}

          {/* Teacher In-Person Override Toggle */}
          <div className="pt-2">
            <button
              onClick={() => setShowAdminLogin(!showAdminLogin)}
              className="text-[11px] font-mono text-[#64748B] hover:text-[#06B6D4] underline transition-colors"
            >
              {showAdminLogin ? "Hide Instructor Unlock" : "Teacher In-Person Unlock"}
            </button>
          </div>

          {/* Teacher Unlock Form */}
          {showAdminLogin && (
            <form onSubmit={handleInstructorUnlock} className="mt-3 p-4 rounded-2xl bg-[#0B0F19] border border-[#334155] space-y-3 text-left">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-[#06B6D4]" />
                <span>Instructor Authorization Override</span>
              </div>

              {adminError && (
                <div className="text-[11px] text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/30">
                  {adminError}
                </div>
              )}

              <input
                type="email"
                required
                placeholder="Instructor Email (e.g. layjoe0001@gmail.com)"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full rounded-xl bg-[#1E293B] border border-[#334155] px-3 py-2 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
              />

              <input
                type="password"
                required
                placeholder="Instructor Password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full rounded-xl bg-[#1E293B] border border-[#334155] px-3 py-2 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
              />

              <input
                type="text"
                required
                maxLength={6}
                placeholder="6-Digit Google Authenticator Code"
                value={adminTotpCode}
                onChange={(e) => setAdminTotpCode(e.target.value.replace(/\D/g, ""))}
                className="w-full font-mono text-center tracking-widest rounded-xl bg-[#1E293B] border border-[#334155] px-3 py-2 text-xs text-white placeholder-[#64748B] focus:border-[#06B6D4] focus:outline-none"
              />

              <button
                type="submit"
                disabled={unlocking}
                className="w-full inline-flex items-center justify-center space-x-2 rounded-xl bg-[#10B981] py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-all disabled:opacity-50"
              >
                <span>{unlocking ? "Verifying..." : "Authorize & Reactivate Student"}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
