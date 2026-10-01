"use client";

import React, { useState, useEffect, useRef } from "react";
import { StudentNotification } from "@/types/notification";
import { subscribeToStudentNotifications, markNotificationAsRead } from "@/lib/db";
import { Bell, Check, CheckCheck, X, Clock, MessageSquare, ExternalLink } from "lucide-react";

interface NotificationBellProps {
  userId: string;
}

export default function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;
    const unsubscribe = subscribeToStudentNotifications(userId, (list) => {
      setNotifications(list);
    });
    return () => unsubscribe();
  }, [userId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const unreadList = notifications.filter((n) => !n.read && !(n as any).isRead);
  const unreadCount = unreadList.length;

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await markNotificationAsRead(id);
    } catch (err) {
      console.error("Error marking notification read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await Promise.all(unreadList.map((n) => markNotificationAsRead(n.id)));
    } catch (err) {
      console.error("Error marking all read:", err);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#334155] bg-[#1E293B] text-[#94A3B8] hover:border-[#06B6D4] hover:text-white transition-all shadow-sm"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white shadow-md animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-[#334155]/70 bg-[#1E293B]/90 backdrop-blur-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#334155]/70 bg-[#0B0F19]/50 backdrop-blur-md px-4 py-3">
            <div className="flex items-center space-x-2">
              <Bell className="h-4 w-4 text-[#06B6D4]" />
              <span className="text-xs font-bold text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-cyan-500/20 px-2 py-0.2 text-[10px] font-bold text-cyan-300 border border-cyan-500/30">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#94A3B8]">
                <Bell className="h-8 w-8 text-[#64748B] mx-auto mb-2 opacity-50" />
                No notifications yet.
              </div>
            ) : (
              notifications.slice(0, 15).map((n) => {
                const isUnread = !n.read && !(n as any).isRead;

                return (
                  <div
                    key={n.id}
                    className={`rounded-xl border p-3 transition-all ${
                      isUnread
                        ? "border-cyan-500/40 bg-cyan-500/10 text-white backdrop-blur-sm"
                        : "border-[#334155]/60 bg-[#0B0F19]/50 backdrop-blur-sm text-[#94A3B8]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-white">
                            {n.senderName || "Instructor"}
                          </span>
                          <span className="text-[10px] text-[#64748B]">
                            {new Date(n.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                          </span>
                        </div>
                        <p className="text-xs text-[#CBD5E1] leading-relaxed">
                          {n.message}
                        </p>
                      </div>

                      {isUnread && (
                        <button
                          type="button"
                          onClick={(e) => handleMarkAsRead(n.id, e)}
                          title="Mark read"
                          className="rounded-lg p-1 text-[#64748B] hover:text-cyan-300 transition-colors"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
