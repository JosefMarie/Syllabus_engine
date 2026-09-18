"use client";

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { StudentPresenceRecord } from "@/types/presence";
import { subscribeToStudentPresences } from "@/lib/presence";
import { sendStudentNotification, logActivity } from "@/lib/db";
import { UserProfile } from "@/types/auth";
import { 
  EyeOff, 
  AlertTriangle, 
  X, 
  MessageSquare, 
  Send, 
  Volume2, 
  VolumeX, 
  Clock, 
  CheckCircle2, 
  Bell, 
  BellRing,
  Radio
} from "lucide-react";

export interface AttentionAlertItem {
  id: string;
  userId: string;
  studentName: string;
  state: 'tab_unfocused' | 'idle';
  syllabusTitle: string;
  topicTitle: string;
  timestamp: string;
  timeFormatted: string;
  unfocusedCount?: number;
}

interface AdminPresenceAlertProps {
  adminUser: UserProfile | null;
}

export default function AdminPresenceAlert({ adminUser }: AdminPresenceAlertProps) {
  const [activeToasts, setActiveToasts] = useState<AttentionAlertItem[]>([]);
  const [alertHistory, setAlertHistory] = useState<AttentionAlertItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Quick Message Modal State
  const [messagingTarget, setMessagingTarget] = useState<AttentionAlertItem | null>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  // State reference tracking to only alert on new transitions
  const prevPresencesRef = useRef<Record<string, string>>({});
  const initialMountRef = useRef(true);

  // Load sound preference from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("syllabus_admin_presence_sound");
      if (saved !== null) {
        setSoundEnabled(saved === "true");
      }
    }
  }, []);

  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("syllabus_admin_presence_sound", String(next));
      }
      return next;
    });
  };

  // Synthesize a gentle alert chime when a student loses focus
  const playAlertChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Two-tone warning chime (E5 -> C5)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.setValueAtTime(523.25, now + 0.15); // C5

      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {
      // Audio context might be restricted before user interaction
    }
  };

  useEffect(() => {
    const unsubscribe = subscribeToStudentPresences((presences) => {
      // First mount: snapshot existing states so we don't alert for existing state
      if (initialMountRef.current) {
        Object.values(presences).forEach((rec) => {
          prevPresencesRef.current[rec.userId] = rec.state;
        });
        initialMountRef.current = false;
        return;
      }

      // Check transitions
      Object.values(presences).forEach((rec) => {
        const prevState = prevPresencesRef.current[rec.userId];
        const currentState = rec.state;

        // Trigger alert when student transitions into 'tab_unfocused' (Side Window)
        if (
          currentState === 'tab_unfocused' && 
          prevState && 
          prevState !== 'tab_unfocused' && 
          prevState !== 'offline'
        ) {
          const now = new Date();
          const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

          const newAlert: AttentionAlertItem = {
            id: `alert-${rec.userId}-${Date.now()}`,
            userId: rec.userId,
            studentName: rec.fullName || "Student",
            state: 'tab_unfocused',
            syllabusTitle: rec.syllabusTitle || "Active Syllabus",
            topicTitle: rec.currentSubtopicTitle || "Current Topic",
            timestamp: now.toISOString(),
            timeFormatted,
            unfocusedCount: rec.unfocusedCount || 1,
          };

          // Add to active toast stack
          setActiveToasts((prev) => [newAlert, ...prev.slice(0, 3)]); // Keep max 4 toasts
          setAlertHistory((prev) => [newAlert, ...prev.slice(0, 29)]); // Keep last 30 history

          playAlertChime();

          // Automatically dismiss notification after 3 seconds (3000ms)
          setTimeout(() => {
            dismissToast(newAlert.id);
          }, 3000);
        }

        // Update tracking ref
        prevPresencesRef.current[rec.userId] = currentState;
      });
    });

    return () => {
      unsubscribe();
    };
  }, [soundEnabled]);

  // Dismiss a specific toast
  const dismissToast = (id: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Open quick message modal for an alert
  const openMessaging = (alert: AttentionAlertItem) => {
    setMessagingTarget(alert);
    setCustomMessage(
      `Hi ${alert.studentName}, please return to your syllabus study tab ("${alert.topicTitle}"). Active learning is currently paused.`
    );
    dismissToast(alert.id);
  };

  // Send real-time notification to the student
  const handleSendMessage = async () => {
    if (!messagingTarget || !customMessage.trim()) return;

    setSending(true);
    const senderName = (adminUser && adminUser.fullName && adminUser.fullName !== "Teacher Admin") ? adminUser.fullName : "Josef Marie";

    try {
      await sendStudentNotification(
        messagingTarget.userId,
        senderName,
        customMessage.trim()
      );

      if (adminUser) {
        await logActivity({
          userId: adminUser.uid,
          userName: adminUser.fullName,
          userEmail: adminUser.email,
          userLevel: adminUser.level,
          action: "SEND_STUDENT_MESSAGE",
          details: `Sent real-time side-window alert to student ${messagingTarget.studentName} on topic "${messagingTarget.topicTitle}".`,
        });
      }

      setSendSuccess(`Direct message sent in real time to ${messagingTarget.studentName}!`);
      setTimeout(() => {
        setSendSuccess(null);
        setMessagingTarget(null);
        setCustomMessage("");
      }, 2500);
    } catch (e) {
      console.error("Failed to send real-time notification to student:", e);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Header Badge / Control Trigger in Top Bar */}
      <div className="flex items-center space-x-1 sm:space-x-2">
        <button
          onClick={() => setIsHistoryOpen(true)}
          title="Open real-time attention alerts"
          className="relative inline-flex items-center space-x-1 sm:space-x-1.5 rounded-xl border border-[#334155] bg-[#1E293B] px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-[#CBD5E1] hover:text-white hover:border-amber-500/50 shadow-sm transition-all shrink-0"
        >
          {alertHistory.length > 0 ? (
            <BellRing className="h-3.5 w-3.5 text-amber-400 animate-pulse shrink-0" />
          ) : (
            <Bell className="h-3.5 w-3.5 text-[#94A3B8] shrink-0" />
          )}
          <span className="hidden md:inline">Alerts</span>
          {alertHistory.length > 0 && (
            <span className="ml-0.5 sm:ml-1 rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-bold text-slate-950 font-mono">
              {alertHistory.length}
            </span>
          )}
        </button>

        <button
          onClick={toggleSound}
          title={soundEnabled ? "Mute alert chimes" : "Enable alert chimes"}
          className={`hidden sm:inline-flex items-center justify-center h-8 w-8 rounded-xl border transition-all shrink-0 ${
            soundEnabled
              ? "border-[#334155] bg-[#1E293B] text-amber-400 hover:text-white"
              : "border-[#334155] bg-[#1E293B]/60 text-[#64748B] hover:text-[#94A3B8]"
          }`}
        >
          {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Floating Live Alert Toasts & Modals (Rendered via Portal to document.body for true viewport positioning) */}
      {isMounted && createPortal(
        <>
          {/* Floating Live Alert Toasts (Responsive: centered at bottom on mobile, bottom-right on sm+) */}
          <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 z-[9999] flex flex-col space-y-2.5 max-w-sm w-auto sm:w-full pointer-events-none">
            {activeToasts.map((toast) => (
              <div
                key={toast.id}
                className={`pointer-events-auto rounded-2xl border-2 p-4 text-white shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-300 relative overflow-hidden ${
                  (toast.unfocusedCount || 0) >= 10
                    ? 'border-rose-500 bg-[#1E1015] shadow-rose-950/60'
                    : 'border-amber-500/80 bg-[#0F172A] shadow-amber-950/50'
                }`}
              >
                {/* Ambient glow accent */}
                <div className={`absolute top-0 left-0 right-0 h-1 animate-pulse ${
                  (toast.unfocusedCount || 0) >= 10
                    ? 'bg-gradient-to-r from-rose-500 via-red-400 to-rose-600'
                    : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600'
                }`} />

                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-xl ${
                      (toast.unfocusedCount || 0) >= 10
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {(toast.unfocusedCount || 0) >= 10 ? <AlertTriangle className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </span>
                    <div>
                      <span className={`text-[10px] font-mono font-extrabold uppercase tracking-wider flex items-center space-x-1 ${
                        (toast.unfocusedCount || 0) >= 10 ? 'text-rose-400' : 'text-amber-400'
                      }`}>
                        <span className={`h-2 w-2 rounded-full animate-ping inline-block ${
                          (toast.unfocusedCount || 0) >= 10 ? 'bg-rose-400' : 'bg-amber-400'
                        }`} />
                        <span>
                          {(toast.unfocusedCount || 0) >= 10
                            ? "🚨 10th Violation: Auto-Suspended"
                            : `Side Window Alert (Strike #${toast.unfocusedCount || 1} of 10)`}
                        </span>
                      </span>
                      <p className="text-xs font-bold text-white leading-snug">
                        {toast.studentName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <span className="text-[10px] font-mono text-[#94A3B8]">
                      {toast.timeFormatted}
                    </span>
                    <button
                      onClick={() => dismissToast(toast.id)}
                      className="rounded-lg p-1 text-[#94A3B8] hover:text-white hover:bg-slate-800 transition-colors"
                      title="Dismiss alert"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <p className="mt-2 text-xs text-[#CBD5E1] leading-relaxed">
                  Clicked outside or switched away from active tab while on:{" "}
                  <strong className="text-amber-300 font-semibold">{toast.topicTitle}</strong>
                </p>

                <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#334155]/60 gap-2">
                  <span className="text-[10px] font-mono text-[#64748B] truncate max-w-[150px]">
                    {toast.syllabusTitle}
                  </span>

                  <button
                    onClick={() => openMessaging(toast)}
                    className="inline-flex items-center space-x-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-all shadow-md active:scale-95"
                  >
                    <MessageSquare className="h-3 w-3" />
                    <span>Message Student</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Alert History Drawer / Modal */}
          {isHistoryOpen && (
            <div className="fixed inset-0 z-[9999] flex items-start justify-end bg-black/60 p-4 sm:p-6 backdrop-blur-sm animate-in fade-in duration-150">
              <div className="w-full max-w-md rounded-2xl border border-[#334155] bg-[#0F172A] p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col mt-12">
                <div className="flex items-center justify-between border-b border-[#334155] pb-3">
                  <div className="flex items-center space-x-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                      <BellRing className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Student Attention Log</h4>
                      <p className="text-[11px] text-[#94A3B8]">Real-time side window & unfocused events</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 sm:space-x-2">
                    <button
                      onClick={toggleSound}
                      title={soundEnabled ? "Mute alert chimes" : "Enable alert chimes"}
                      className={`inline-flex items-center justify-center h-7 w-7 rounded-lg border text-xs transition-all ${
                        soundEnabled
                          ? "border-[#334155] bg-[#1E293B] text-amber-400 hover:text-white"
                          : "border-[#334155] bg-[#1E293B]/60 text-[#64748B] hover:text-[#94A3B8]"
                      }`}
                    >
                      {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => setAlertHistory([])}
                      className="text-xs text-[#94A3B8] hover:text-white px-2 py-1 rounded bg-[#1E293B] border border-[#334155]"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => setIsHistoryOpen(false)}
                      className="rounded-lg p-1.5 text-[#94A3B8] hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-[#334155]/40">
                  {alertHistory.length === 0 ? (
                    <div className="py-12 text-center text-xs text-[#94A3B8]">
                      <CheckCircle2 className="mx-auto h-8 w-8 text-[#10B981]/50 mb-2" />
                      No students currently unfocused. All active students are engaged.
                    </div>
                  ) : (
                    alertHistory.map((item) => (
                      <div key={item.id} className="pt-2 pb-2 flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-1.5">
                            <span className="h-2 w-2 rounded-full bg-amber-400" />
                            <span className="text-xs font-bold text-white">{item.studentName}</span>
                            <span className="text-[10px] font-mono text-[#64748B]">({item.timeFormatted})</span>
                          </div>
                          <p className="text-[11px] text-[#94A3B8]">
                            Unfocused on: <span className="text-amber-300 font-medium">{item.topicTitle}</span>
                          </p>
                          <p className="text-[10px] text-[#64748B]">{item.syllabusTitle}</p>
                        </div>

                        <button
                          onClick={() => {
                            setIsHistoryOpen(false);
                            openMessaging(item);
                          }}
                          className="shrink-0 inline-flex items-center space-x-1 rounded-lg bg-[#1E293B] border border-[#334155] px-2.5 py-1 text-[11px] font-semibold text-amber-400 hover:bg-amber-500 hover:text-slate-950 transition-all shadow-sm"
                        >
                          <MessageSquare className="h-3 w-3" />
                          <span>Message</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Quick Direct Messaging Modal */}
          {messagingTarget && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-150">
              <div className="w-full max-w-lg rounded-2xl border border-amber-500/50 bg-[#1E293B] p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-[#334155] pb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                      <Send className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        Send Real-Time Alert to {messagingTarget.studentName}
                      </h4>
                      <p className="text-[11px] text-[#94A3B8]">
                        This notification will pop up on the student's screen with an audio chime in real time.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setMessagingTarget(null)}
                    className="rounded-lg p-1 text-[#94A3B8] hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {sendSuccess ? (
                  <div className="rounded-xl border border-[#10B981]/40 bg-[#10B981]/15 p-4 text-xs font-semibold text-[#10B981] flex items-center space-x-2">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>{sendSuccess}</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-[#0B0F19] p-3 border border-[#334155] text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-[#94A3B8]">
                        <span>Current Subtopic:</span>
                        <strong className="text-white">{messagingTarget.topicTitle}</strong>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#94A3B8]">
                        <span>Syllabus:</span>
                        <span className="text-[#CBD5E1] truncate max-w-[240px]">{messagingTarget.syllabusTitle}</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-[#94A3B8] mb-1.5">
                        Message to Student
                      </label>
                      <textarea
                        rows={3}
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        placeholder="Enter message for the student..."
                        className="w-full rounded-xl bg-[#0B0F19] border border-[#334155] p-3 text-xs text-white placeholder-[#64748B] focus:border-amber-400 focus:outline-none leading-relaxed"
                      />
                    </div>

                    {/* Preset Quick Responses */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setCustomMessage(`Hi ${messagingTarget.studentName}, please return to your syllabus tab. Your study timer is currently paused.`)}
                        className="rounded-lg border border-[#334155] bg-[#0B0F19] px-2.5 py-1 text-[11px] text-[#CBD5E1] hover:text-white hover:border-amber-400 transition-all"
                      >
                        Reminder: Return to Tab
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomMessage(`Hi ${messagingTarget.studentName}, please stay focused on "${messagingTarget.topicTitle}" to complete your required topic minutes.`)}
                        className="rounded-lg border border-[#334155] bg-[#0B0F19] px-2.5 py-1 text-[11px] text-[#CBD5E1] hover:text-white hover:border-amber-400 transition-all"
                      >
                        Focus Warning
                      </button>
                    </div>

                    <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#334155]">
                      <button
                        type="button"
                        onClick={() => setMessagingTarget(null)}
                        className="rounded-xl border border-[#334155] px-4 py-2 text-xs font-semibold text-[#CBD5E1] hover:text-white transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={sending || !customMessage.trim()}
                        onClick={handleSendMessage}
                        className="inline-flex items-center space-x-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition-all shadow-md"
                      >
                        {sending ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        <span>Send Real-Time Message</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>,
        document.body
      )}
    </>
  );
}
