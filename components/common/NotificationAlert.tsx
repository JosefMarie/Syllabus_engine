"use client";

import React, { useEffect, useState, useRef } from "react";
import { StudentNotification } from "@/types/notification";
import { subscribeToStudentNotifications, markNotificationAsRead } from "@/lib/db";
import { Bell, Check, X, MessageSquare, ChevronLeft, ChevronRight, Volume2 } from "lucide-react";

export default function NotificationAlert({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(true);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialMountRef = useRef(true);

  // Synthesize a gentle audio chime when a new message arrives in real time
  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {
      // Audio context might be blocked by autoplay policies until user interaction
    }
  };

  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeToStudentNotifications(userId, (list) => {
      const unread = list.filter((n) => !n.read && !(n as any).isRead);

      // Detect if new unread message arrived that wasn't previously loaded
      let hasNewMessage = false;
      unread.forEach((n) => {
        if (!seenIdsRef.current.has(n.id)) {
          seenIdsRef.current.add(n.id);
          if (!initialMountRef.current) {
            hasNewMessage = true;
          }
        }
      });

      if (hasNewMessage) {
        playChime();
        setIsOpen(true);
      }

      initialMountRef.current = false;
      setNotifications(unread);
      if (unread.length === 0) {
        setCurrentIndex(0);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [userId]);

  if (!isOpen || notifications.length === 0) return null;

  const activeNotif = notifications[Math.min(currentIndex, notifications.length - 1)];
  if (!activeNotif) return null;

  const handleMarkAsRead = async () => {
    const targetId = activeNotif.id;
    await markNotificationAsRead(targetId);

    const remaining = notifications.filter((n) => n.id !== targetId);
    setNotifications(remaining);
    if (currentIndex >= remaining.length) {
      setCurrentIndex(Math.max(0, remaining.length - 1));
    }
    if (remaining.length === 0) {
      setIsOpen(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <aside 
      aria-label="Teacher Announcement"
      className="fixed top-20 right-4 sm:right-6 z-[9999] w-[calc(100vw-2rem)] sm:w-full max-w-md animate-in slide-in-from-top-4 fade-in-50 duration-300 pointer-events-auto"
    >
      <div className="relative rounded-2xl border-2 border-[#06B6D4]/50 bg-[#111827]/95 p-5 shadow-[0_20px_60px_-15px_rgba(6,182,212,0.35)] backdrop-blur-xl text-white border-l-4 border-l-[#06B6D4]">
        {/* Glow halo */}
        <div className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#06B6D4] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-[#06B6D4]"></span>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#06B6D4]/30 to-[#3B82F6]/30 text-[#06B6D4] border border-[#06B6D4]/40 shadow-inner">
              <Bell className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold text-[#06B6D4] uppercase tracking-wider">
                  Teacher Message
                </span>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                <span className="text-[10px] text-emerald-400 font-mono font-semibold">
                  LIVE
                </span>
              </div>
              <span className="text-xs text-slate-300 font-semibold block mt-0.5">
                From: <strong className="text-white font-bold">{activeNotif.senderName}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={handleClose}
              title="Close alert"
              className="rounded-lg p-1 text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Message Content */}
        <div className="mt-3.5 rounded-xl border border-[#334155]/80 bg-[#0B0F19]/80 p-3.5 shadow-inner">
          <p className="text-xs text-slate-100 leading-relaxed font-sans select-text">
            &ldquo;{activeNotif.message}&rdquo;
          </p>
          <div className="mt-2 text-[10px] text-[#94A3B8] font-mono flex items-center justify-between border-t border-[#334155]/50 pt-1.5">
            <span>
              Sent: {new Date(activeNotif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {notifications.length > 1 && (
              <span className="font-bold text-cyan-400">
                Message {currentIndex + 1} of {notifications.length}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-4 flex items-center justify-between pt-1">
          {notifications.length > 1 ? (
            <div className="flex items-center space-x-1">
              <button
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                className="rounded-lg p-1.5 text-xs text-[#94A3B8] hover:text-white disabled:opacity-30 disabled:hover:text-[#94A3B8] transition-all"
                title="Previous message"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-[11px] font-mono text-[#94A3B8] px-1">
                {currentIndex + 1} / {notifications.length}
              </span>
              <button
                disabled={currentIndex === notifications.length - 1}
                onClick={() => setCurrentIndex((prev) => Math.min(notifications.length - 1, prev + 1))}
                className="rounded-lg p-1.5 text-xs text-[#94A3B8] hover:text-white disabled:opacity-30 disabled:hover:text-[#94A3B8] transition-all"
                title="Next message"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <span className="text-[11px] font-mono text-cyan-400/90 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping"></span>
              Real-time teacher notification
            </span>
          )}

          <div className="flex items-center space-x-2">
            <button
              onClick={handleClose}
              className="rounded-xl border border-[#334155] px-2.5 py-1.5 text-xs font-semibold text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-all"
            >
              Later
            </button>
            <button
              onClick={handleMarkAsRead}
              className="inline-flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-[#06B6D4] to-[#10B981] px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:brightness-110 transition-all shadow-md active:scale-95"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Mark as Read</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
