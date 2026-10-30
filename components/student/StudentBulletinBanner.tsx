"use client";

import React, { useState, useEffect } from "react";
import { BroadcastBulletin } from "@/types/bulletin";
import { UserProfile } from "@/types/auth";
import { subscribeToBulletins, acknowledgeBulletin } from "@/lib/db";
import { 
  Megaphone, 
  AlertTriangle, 
  Info, 
  PartyPopper, 
  ExternalLink, 
  X, 
  CheckCircle2, 
  ChevronRight, 
  Bell, 
  Calendar,
  ShieldAlert
} from "lucide-react";

interface StudentBulletinBannerProps {
  currentUser: UserProfile | null;
}

export default function StudentBulletinBanner({ currentUser }: StudentBulletinBannerProps) {
  const [bulletins, setBulletins] = useState<BroadcastBulletin[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  // Load session/local dismissed IDs
  useEffect(() => {
    if (!currentUser) return;
    try {
      const stored = localStorage.getItem(`dismissed_bulletins_${currentUser.uid}`);
      if (stored) {
        setDismissedIds(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, [currentUser]);

  // Subscribe to real-time bulletins
  useEffect(() => {
    const unsub = subscribeToBulletins((list) => {
      setBulletins(list || []);
    });
    return () => unsub();
  }, []);

  if (!currentUser) return null;

  // Filter bulletins for this student
  const now = new Date().getTime();
  const relevantBulletins = bulletins.filter((b) => {
    if (b.active === false) return false;
    
    // Check expiration
    if (b.expiresAt) {
      const exp = new Date(b.expiresAt).getTime();
      if (!isNaN(exp) && exp < now) return false;
    }

    // Check audience targeting
    if (currentUser.role === "student") {
      if (b.targetAudience === "level") {
        if (b.targetLevel && b.targetLevel !== "all" && b.targetLevel !== currentUser.level) {
          return false;
        }
      } else if (b.targetAudience === "trade") {
        if (b.targetTradeId && b.targetTradeId !== "all" && b.targetTradeId !== currentUser.tradeId) {
          return false;
        }
      } else if (b.targetAudience === "trade_level") {
        if (b.targetLevel && b.targetLevel !== "all" && b.targetLevel !== currentUser.level) {
          return false;
        }
        if (b.targetTradeId && b.targetTradeId !== "all" && b.targetTradeId !== currentUser.tradeId) {
          return false;
        }
      }
    }
    return true;
  });

  // Critical bulletins requiring acknowledgment that student has not yet acknowledged
  const unacknowledgedCritical = relevantBulletins.filter((b) => {
    if (!b.requireAcknowledgment) return false;
    const hasRead = b.readReceipts?.some((r) => r.studentUid === currentUser.uid);
    return !hasRead;
  });

  // Active banners to display (not dismissed and not blocked in unacknowledged modal)
  const activeBanners = relevantBulletins.filter((b) => {
    if (dismissedIds.includes(b.id)) return false;
    // If it's in unacknowledged modal, don't also duplicate as a banner
    if (unacknowledgedCritical.some((c) => c.id === b.id)) return false;
    return true;
  });

  const handleDismiss = (id: string) => {
    const next = [...dismissedIds, id];
    setDismissedIds(next);
    if (currentUser) {
      try {
        localStorage.setItem(`dismissed_bulletins_${currentUser.uid}`, JSON.stringify(next));
      } catch {
        // ignore
      }
    }
  };

  const handleAcknowledge = async (bulletinId: string) => {
    setAcknowledgingId(bulletinId);
    try {
      await acknowledgeBulletin(bulletinId, currentUser.uid, currentUser.fullName);
    } catch (e) {
      console.error("Acknowledge error:", e);
    } finally {
      setAcknowledgingId(null);
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case "critical":
        return {
          bg: "bg-gradient-to-r from-rose-950/80 via-rose-900/60 to-slate-900/80",
          border: "border-rose-500/50",
          text: "text-rose-200",
          accent: "text-rose-400",
          badge: "bg-rose-500/20 text-rose-300 border-rose-500/40",
          icon: <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse flex-shrink-0" />,
        };
      case "important":
        return {
          bg: "bg-gradient-to-r from-amber-950/80 via-amber-900/50 to-slate-900/80",
          border: "border-amber-500/50",
          text: "text-amber-200",
          accent: "text-amber-400",
          badge: "bg-amber-500/20 text-amber-300 border-amber-500/40",
          icon: <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />,
        };
      case "celebration":
        return {
          bg: "bg-gradient-to-r from-purple-950/80 via-fuchsia-900/50 to-slate-900/80",
          border: "border-purple-500/50",
          text: "text-purple-200",
          accent: "text-purple-400",
          badge: "bg-purple-500/20 text-purple-300 border-purple-500/40",
          icon: <PartyPopper className="w-5 h-5 text-purple-400 flex-shrink-0" />,
        };
      default:
        return {
          bg: "bg-gradient-to-r from-cyan-950/80 via-blue-900/50 to-slate-900/80",
          border: "border-cyan-500/50",
          text: "text-cyan-200",
          accent: "text-cyan-400",
          badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
          icon: <Info className="w-5 h-5 text-cyan-400 flex-shrink-0" />,
        };
    }
  };

  return (
    <>
      {/* 1. IMPERATIVE MANDATORY ACKNOWLEDGMENT MODAL (For Critical Notices) */}
      {unacknowledgedCritical.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-rose-500/60 rounded-2xl p-6 sm:p-8 max-w-xl w-full shadow-2xl shadow-rose-950/60 space-y-5 text-left relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500 animate-pulse" />
            
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-6 h-6 text-rose-400 animate-bounce" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 mb-1.5">
                  Action Required • Official Notice
                </div>
                <h3 className="text-xl font-bold text-white leading-tight">
                  {unacknowledgedCritical[0].title}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Issued by {unacknowledgedCritical[0].createdByName} • {new Date(unacknowledgedCritical[0].createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-slate-200 text-sm leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
              {unacknowledgedCritical[0].message}
            </div>

            {unacknowledgedCritical[0].actionUrl && (
              <a
                href={unacknowledgedCritical[0].actionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-400 hover:text-cyan-300 hover:underline"
              >
                <span>{unacknowledgedCritical[0].actionLabel || "Open Attached Link"}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800/80">
              <span className="text-xs text-slate-400">
                {unacknowledgedCritical.length > 1
                  ? `Notice 1 of ${unacknowledgedCritical.length} urgent notices requiring confirmation`
                  : "Confirmation receipt recorded upon acknowledgment"}
              </span>
              <button
                type="button"
                onClick={() => handleAcknowledge(unacknowledgedCritical[0].id)}
                disabled={acknowledgingId === unacknowledgedCritical[0].id}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white shadow-lg shadow-rose-950/50 hover:shadow-rose-900/60 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{acknowledgingId === unacknowledgedCritical[0].id ? "Confirming..." : "I Have Read & Acknowledge"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. TOP DISMISSIBLE ANNOUNCEMENT BANNERS */}
      {activeBanners.length > 0 && (
        <div className="space-y-2 mb-6">
          {activeBanners.map((bulletin) => {
            const style = getPriorityStyle(bulletin.priority);
            return (
              <div
                key={bulletin.id}
                className={`${style.bg} border ${style.border} rounded-xl p-3.5 sm:p-4 backdrop-blur-md shadow-lg transition-all animate-in slide-in-from-top-2 duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="mt-0.5">{style.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${style.badge}`}>
                        {bulletin.priority}
                      </span>
                      <h4 className="text-sm font-bold text-white truncate max-w-md">
                        {bulletin.title}
                      </h4>
                      <span className="text-[11px] text-slate-400 hidden md:inline">
                        • {new Date(bulletin.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className={`text-xs ${style.text} leading-relaxed line-clamp-2 sm:line-clamp-1`}>
                      {bulletin.message}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                  {bulletin.actionUrl && (
                    <a
                      href={bulletin.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all flex items-center gap-1.5"
                    >
                      <span>{bulletin.actionLabel || "View Details"}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowHistoryModal(true)}
                    title="View All Campus Bulletins"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
                  >
                    <Bell className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDismiss(bulletin.id)}
                    title="Dismiss Announcement"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Bulletin History Button if banners are dismissed but bulletins exist */}
      {activeBanners.length === 0 && relevantBulletins.length > 0 && (
        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-900/80 hover:bg-slate-800/90 text-slate-300 hover:text-cyan-300 border border-slate-700/60 backdrop-blur-md transition-all shadow-sm"
          >
            <Megaphone className="w-3.5 h-3.5 text-cyan-400" />
            <span>Campus Bulletins ({relevantBulletins.length})</span>
          </button>
        </div>
      )}

      {/* 3. BULLETIN HISTORY & ARCHIVE MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Campus Bulletins & Notices</h3>
                  <p className="text-xs text-slate-400">Official updates for your trade and class</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {relevantBulletins.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No current bulletins or announcements.</p>
                </div>
              ) : (
                relevantBulletins.map((b) => {
                  const style = getPriorityStyle(b.priority);
                  const isAcknowledged = b.readReceipts?.some((r) => r.studentUid === currentUser.uid);
                  return (
                    <div
                      key={b.id}
                      className={`p-4 rounded-xl border ${style.border} ${style.bg} space-y-2`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${style.badge}`}>
                            {b.priority}
                          </span>
                          <h4 className="text-sm font-bold text-white">{b.title}</h4>
                        </div>
                        <span className="text-[11px] text-slate-400 flex-shrink-0">
                          {new Date(b.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className={`text-xs ${style.text} whitespace-pre-wrap leading-relaxed`}>
                        {b.message}
                      </p>
                      
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                        <div className="text-slate-400">
                          Issued by <span className="text-slate-300 font-medium">{b.createdByName}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {b.actionUrl && (
                            <a
                              href={b.actionUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 font-semibold"
                            >
                              <span>{b.actionLabel || "Link"}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {b.requireAcknowledgment && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Acknowledged</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-between items-center text-xs text-slate-400">
              <span>Showing {relevantBulletins.length} active announcements</span>
              <button
                type="button"
                onClick={() => {
                  setDismissedIds([]);
                  localStorage.removeItem(`dismissed_bulletins_${currentUser.uid}`);
                }}
                className="text-cyan-400 hover:underline font-medium"
              >
                Reset dismissed banners
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
