"use client";

import React, { useEffect, useState } from "react";
import { StudentNotification } from "@/types/notification";
import { getStudentNotifications, markNotificationAsRead } from "@/lib/db";
import { Bell, Check, X, MessageSquare, AlertCircle } from "lucide-react";

export default function NotificationAlert({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [activeNotif, setActiveNotif] = useState<StudentNotification | null>(null);

  useEffect(() => {
    async function load() {
      if (!userId) return;
      const list = await getStudentNotifications(userId);
      const unread = list.filter((n) => !n.read);
      setNotifications(unread);
      if (unread.length > 0) {
        setActiveNotif(unread[0]);
      }
    }
    load();
  }, [userId]);

  const handleDismiss = async () => {
    if (!activeNotif) return;
    await markNotificationAsRead(activeNotif.id);
    const updated = notifications.filter((n) => n.id !== activeNotif.id);
    setNotifications(updated);
    setActiveNotif(updated.length > 0 ? updated[0] : null);
  };

  if (!activeNotif) return null;

  return (
    <div className="fixed top-20 right-6 z-50 w-full max-w-md animate-in slide-in-from-top duration-300">
      <div className="rounded-2xl border border-[#06B6D4]/40 bg-[#1E293B]/95 p-5 shadow-2xl backdrop-blur-md text-white border-l-4 border-l-[#06B6D4]">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#06B6D4]/20 text-[#06B6D4]">
              <Bell className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <span className="text-xs font-mono font-bold text-[#06B6D4] uppercase tracking-wider block">
                Teacher Message • {activeNotif.senderName}
              </span>
              <span className="text-[10px] text-[#94A3B8] font-mono">
                {new Date(activeNotif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="text-[#94A3B8] hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-200 leading-relaxed font-sans bg-[#0B0F19]/60 p-3 rounded-xl border border-[#334155]">
          "{activeNotif.message}"
        </p>

        <div className="mt-4 flex items-center justify-between pt-1">
          <span className="text-[11px] font-mono text-[#94A3B8]">
            {notifications.length > 1 ? `+${notifications.length - 1} more unread message(s)` : 'Urgent academic notice'}
          </span>
          <button
            onClick={handleDismiss}
            className="inline-flex items-center space-x-1.5 rounded-xl bg-[#06B6D4] px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-[#0891B2] hover:text-white transition-all shadow-md"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Mark as Read</span>
          </button>
        </div>
      </div>
    </div>
  );
}
