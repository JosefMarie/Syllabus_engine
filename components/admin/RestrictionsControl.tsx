"use client";

import React, { useState, useEffect } from "react";
import { SystemRestrictionsConfig } from "@/types/restrictions";
import { 
  getSystemRestrictions, 
  setSystemRestrictions, 
  subscribeToSystemRestrictions 
} from "@/lib/restrictions";
import { logActivity } from "@/lib/db";
import { UserProfile } from "@/types/auth";
import { 
  ShieldCheck, 
  ShieldAlert, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  X,
  Play,
  Pause
} from "lucide-react";

interface RestrictionsControlProps {
  adminUser?: UserProfile | null;
  compact?: boolean;
}

export default function RestrictionsControl({ adminUser, compact = false }: RestrictionsControlProps) {
  const [config, setConfig] = useState<SystemRestrictionsConfig>({
    restrictionsDisabled: false,
    updatedAt: new Date().toISOString(),
  });
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState("Group Work & Collaborative Projects");

  useEffect(() => {
    const unsub = subscribeToSystemRestrictions((latest) => {
      setConfig(latest);
    });
    return () => unsub();
  }, []);

  const handleToggle = async (disableRestrictions: boolean) => {
    setLoading(true);
    try {
      const adminName = adminUser?.fullName || "Instructor";
      const reason = disableRestrictions 
        ? selectedReason 
        : "Re-enabled standard focus mode (10 strikes & 3m timeout active)";

      const updated = await setSystemRestrictions(disableRestrictions, adminName, reason);
      setConfig(updated);

      // Log to system audit trail
      await logActivity({
        userId: adminUser?.uid || "admin",
        userName: adminName,
        userEmail: adminUser?.email || "admin@system.local",
        action: disableRestrictions ? "DISABLE_RESTRICTIONS" : "ENABLE_RESTRICTIONS",
        details: disableRestrictions
          ? `Instructor paused focus restrictions (10 strikes & 3-minute timeout) for group work: "${reason}". Live online presence remains active.`
          : `Instructor restored standard strict focus restrictions (10 strikes & 3-minute timeout active).`,
      }).catch(console.error);

      setIsModalOpen(false);
    } catch (e) {
      console.error("Error updating restrictions:", e);
      alert("Failed to update restrictions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isPaused = config.restrictionsDisabled;

  // COMPACT HEADER PILL VIEW
  if (compact) {
    return (
      <>
        <button
          onClick={() => setIsModalOpen(true)}
          title={isPaused 
            ? "Group Work Mode is ACTIVE: 10 strikes & 3-min suspensions are PAUSED. Click to re-enable strict mode." 
            : "Strict Focus Mode is ACTIVE: 10 strikes & 3-min suspensions enforced. Click to pause for group work."}
          className={`inline-flex items-center space-x-1.5 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs font-bold transition-all shadow-md shrink-0 border ${
            isPaused
              ? "bg-purple-950/70 border-purple-500/50 text-purple-300 hover:bg-purple-900/80 animate-pulse"
              : "bg-emerald-950/60 border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/70"
          }`}
        >
          {isPaused ? (
            <>
              <Users className="h-3.5 w-3.5 text-purple-400 shrink-0" />
              <span className="hidden sm:inline">Group Work:</span>
              <span>Restrictions Paused</span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">Focus Mode:</span>
              <span>Strict (10 Strikes)</span>
            </>
          )}
        </button>

        {/* Modal Dialog */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md rounded-2xl border border-[#334155] bg-[#1E293B] p-6 shadow-2xl space-y-5">
              <div className="flex items-start justify-between border-b border-[#334155] pb-4">
                <div className="flex items-center space-x-2.5">
                  <div className={`p-2 rounded-xl ${isPaused ? "bg-purple-500/20 text-purple-400" : "bg-cyan-500/20 text-[#06B6D4]"}`}>
                    {isPaused ? <Users className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">
                      {isPaused ? "Re-Enable Strict Focus Restrictions?" : "Pause Restrictions for Group Work?"}
                    </h3>
                    <p className="text-xs text-[#94A3B8]">
                      {isPaused ? "Switch from Group Work back to Strict Study" : "Allow students to collaborate freely"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg p-1.5 text-[#94A3B8] hover:text-white hover:bg-[#334155]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {isPaused ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3.5 text-xs text-purple-200 leading-relaxed">
                    <p>
                      <strong>Group Work Mode is currently ACTIVE.</strong> Students are free to switch tabs, consult documentation, and collaborate without triggering strikes or timeouts.
                    </p>
                  </div>

                  <p className="text-xs text-[#CBD5E1] leading-relaxed">
                    Re-enabling strict restrictions will re-activate:
                  </p>

                  <ul className="text-xs text-[#94A3B8] space-y-1.5 list-disc list-inside">
                    <li><strong className="text-white">10 Side-window strikes</strong> leading to automatic disciplinary suspension.</li>
                    <li><strong className="text-white">3-Minute continuous timeout</strong> for unfocused or abandoned reading.</li>
                    <li><strong className="text-white">Anti-copy &amp; screen blur</strong> content protection.</li>
                  </ul>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200 leading-relaxed">
                    <p>
                      <strong>Busy with Team / Group Work?</strong> Pausing restrictions lets students work collaboratively without fear of focus strikes or 3-minute timeouts.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#CBD5E1] mb-1.5">
                      Select Group Work Activity / Reason:
                    </label>
                    <select
                      value={selectedReason}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="w-full rounded-xl border border-[#334155] bg-[#0B0F19] p-2.5 text-xs text-white focus:border-[#06B6D4] focus:outline-none"
                    >
                      <option value="Group Work & Collaborative Projects">Group Work &amp; Collaborative Projects</option>
                      <option value="Lab Exercise & Multi-Tab Research">Lab Exercise &amp; Multi-Tab Research</option>
                      <option value="Open-Book Interactive Workshop">Open-Book Interactive Workshop</option>
                      <option value="Instructor Guided Demonstration">Instructor Guided Demonstration</option>
                    </select>
                  </div>

                  <div className="rounded-xl bg-[#0B0F19] border border-[#334155] p-3 text-xs space-y-1.5">
                    <div className="flex items-center space-x-2 text-emerald-400 font-semibold">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>Live Presence Still Active</span>
                    </div>
                    <p className="text-[11px] text-[#94A3B8]">
                      You will still be able to see who is online, what topic they are on, and active study time. Only the 10 strikes and 3-minute suspensions will be paused.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#334155]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-white bg-[#0B0F19] border border-[#334155]"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleToggle(!isPaused)}
                  className={`inline-flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-bold text-slate-950 transition-all shadow-lg ${
                    isPaused
                      ? "bg-emerald-400 hover:bg-emerald-300"
                      : "bg-purple-400 hover:bg-purple-300"
                  }`}
                >
                  {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                  <span>{loading ? "Updating..." : isPaused ? "Re-Enable 10 Strikes & Strict Mode" : "Pause Restrictions for Group Work"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // FULL CARD VIEW (For embedding in GroupManager or StudentProgressManager)
  return (
    <div className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-xl ${
      isPaused 
        ? "border-purple-500/50 bg-gradient-to-br from-purple-950/40 to-[#1E293B]" 
        : "border-[#334155] bg-[#1E293B]/90"
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start space-x-3">
          <div className={`p-2.5 rounded-xl shrink-0 ${isPaused ? "bg-purple-500/20 text-purple-400" : "bg-emerald-500/20 text-emerald-400"}`}>
            {isPaused ? <Users className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm sm:text-base font-extrabold text-white">
                {isPaused ? "Group Work Mode (Restrictions Paused)" : "Standard Strict Focus Mode"}
              </h3>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                isPaused 
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/40" 
                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
              }`}>
                {isPaused ? "RESTRICTIONS PAUSED" : "ACTIVE"}
              </span>
            </div>
            <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed max-w-2xl">
              {isPaused ? (
                <>
                  The <strong className="text-white">10-strike focus rule</strong> and <strong className="text-white">3-minute timeout suspension</strong> are currently disabled so students can collaborate freely. Real-time online attendance &amp; reading progress remain fully active.
                </>
              ) : (
                <>
                  Strict anti-distraction rules are active. Students receive side-window focus strikes (suspension at 10 strikes) and 3-minute continuous abandonment timeouts.
                </>
              )}
            </p>
          </div>
        </div>

        <button
          onClick={() => handleToggle(!isPaused)}
          disabled={loading}
          className={`inline-flex items-center space-x-2 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-950 transition-all shadow-lg shrink-0 ${
            isPaused
              ? "bg-emerald-400 hover:bg-emerald-300"
              : "bg-purple-400 hover:bg-purple-300"
          }`}
        >
          {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          <span>{loading ? "Updating..." : isPaused ? "Re-Enable Strict Focus Mode" : "Pause Restrictions for Group Work"}</span>
        </button>
      </div>
    </div>
  );
}
