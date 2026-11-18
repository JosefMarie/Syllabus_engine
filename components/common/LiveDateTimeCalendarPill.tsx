"use client";

import React, { useState, useEffect, useMemo } from "react";
import { CalendarEvent, CalendarEventType } from "@/types/calendar";
import { UserProfile } from "@/types/auth";
import { getCalendarEvents, getLocalCalendarEvents } from "@/lib/db";
import { CalendarDays, Clock, ChevronLeft, ChevronRight, X, Sparkles, CheckSquare, FileQuestion, Calendar } from "lucide-react";

interface LiveDateTimeCalendarPillProps {
  currentUser?: UserProfile | null;
}

const TYPE_META: Record<CalendarEventType, { label: string; dot: string; badge: string }> = {
  event: {
    label: "Event",
    dot: "bg-emerald-400",
    badge: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
  },
  task: {
    label: "Task",
    dot: "bg-amber-400",
    badge: "bg-amber-500/15 border-amber-500/40 text-amber-300",
  },
  exam: {
    label: "Exam",
    dot: "bg-rose-400",
    badge: "bg-rose-500/15 border-rose-500/40 text-rose-300",
  },
  holiday: {
    label: "Holiday",
    dot: "bg-sky-400",
    badge: "bg-sky-500/15 border-sky-500/40 text-sky-300",
  },
};

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function LiveDateTimeCalendarPill({ currentUser }: LiveDateTimeCalendarPillProps) {
  const [now, setNow] = useState<Date>(() => new Date());
  const [isOpen, setIsOpen] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>(() => getLocalCalendarEvents());
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => toDateKey(new Date()));

  // Live 1-second clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Load calendar events on mount and whenever modal opens
  useEffect(() => {
    let active = true;
    getCalendarEvents().then((list) => {
      if (active) setEvents(list);
    });
    return () => {
      active = false;
    };
  }, [isOpen]);

  // Filter events by student's level (or show all for guests/teachers)
  const visibleEvents = useMemo(() => {
    if (!currentUser || currentUser.role === "teacher") return events;
    return events.filter((ev) => ev.level === "all" || ev.level === currentUser.level);
  }, [events, currentUser]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    visibleEvents.forEach((ev) => {
      const list = map.get(ev.date) || [];
      list.push(ev);
      map.set(ev.date, list);
    });
    return map;
  }, [visibleEvents]);

  const todayKey = toDateKey(now);
  const todayCount = eventsByDate.get(todayKey)?.length || 0;

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const selectedDayEvents = eventsByDate.get(selectedDateKey) || [];
  const upcomingEvents = useMemo(
    () => visibleEvents.filter((ev) => ev.date >= todayKey).slice(0, 6),
    [visibleEvents, todayKey]
  );

  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeLabel = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSelectedDateKey(toDateKey(new Date()));
          setIsOpen(true);
        }}
        className="glow-border inline-flex items-center space-x-2 rounded-full border border-[#323238] bg-[#141416] px-3.5 py-1.5 text-xs text-[#EAEAE6] hover:bg-[#1C1C1F] transition-all shadow-sm"
        title="Click to open Academic Calendar & Tasks"
      >
        <CalendarDays className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        <span className="hidden sm:inline font-semibold">{dateLabel}</span>
        <span className="hidden sm:inline text-[#52525B]">&bull;</span>
        <span className="font-mono font-bold text-white">{timeLabel}</span>
        {todayCount > 0 && (
          <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-mono font-extrabold text-[#141416]">
            {todayCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-[28px] border border-[#2E2E34] bg-[#141416] text-[#EAEAE6] shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#2E2E34] bg-[#1C1C1F] px-6 py-4 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white tracking-tight">
                    Academic Calendar &amp; Scheduled Tasks
                  </h3>
                  <p className="text-[11px] font-mono text-[#A1A1AA]">
                    {now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })} &bull; {timeLabel}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-2 text-[#A1A1AA] hover:bg-[#2E2E34] hover:text-white transition-colors"
                title="Close Calendar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Month Calendar Grid */}
              <div className="lg:col-span-7 rounded-2xl border border-[#2E2E34] bg-[#1C1C1F] p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-extrabold text-white">
                    {viewMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                  </h4>
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => setViewMonth(new Date(year, month - 1, 1))}
                      className="rounded-xl border border-[#2E2E34] bg-[#141416] p-1.5 text-[#EAEAE6] hover:border-[#EAEAE6] transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                        setSelectedDateKey(toDateKey(d));
                      }}
                      className="rounded-xl border border-[#2E2E34] bg-[#141416] px-3 py-1 text-[11px] font-mono font-bold text-[#EAEAE6] hover:border-emerald-500/50 transition-colors"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMonth(new Date(year, month + 1, 1))}
                      className="rounded-xl border border-[#2E2E34] bg-[#141416] p-1.5 text-[#EAEAE6] hover:border-[#EAEAE6] transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-mono font-bold uppercase text-[#71717A]">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="py-1">{d}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: firstWeekday }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-11 rounded-xl" />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayNum = i + 1;
                    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                    const dayEvents = eventsByDate.get(key) || [];
                    const isToday = key === todayKey;
                    const isSelected = key === selectedDateKey;

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedDateKey(key)}
                        className={`h-11 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                          isSelected
                            ? "border-emerald-400 bg-emerald-500 text-[#141416] font-extrabold shadow-md"
                            : isToday
                            ? "border-[#EAEAE6] bg-[#141416] text-white font-bold"
                            : "border-[#2E2E34] bg-[#141416]/60 text-[#EAEAE6] hover:border-[#52525B]"
                        }`}
                      >
                        <span className="text-xs font-mono leading-none">{dayNum}</span>
                        {dayEvents.length > 0 && (
                          <div className="flex items-center gap-0.5">
                            {dayEvents.slice(0, 3).map((ev) => (
                              <span
                                key={ev.id}
                                className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-[#141416]" : TYPE_META[ev.type]?.dot || "bg-emerald-400"}`}
                              />
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#2E2E34] text-[10px] font-mono text-[#A1A1AA]">
                  {(Object.keys(TYPE_META) as CalendarEventType[]).map((t) => (
                    <span key={t} className="inline-flex items-center space-x-1.5">
                      <span className={`h-2 w-2 rounded-full ${TYPE_META[t].dot}`} />
                      <span>{TYPE_META[t].label}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Right: Selected Date Events + Upcoming */}
              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-2xl border border-[#2E2E34] bg-[#1C1C1F] p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-[#2E2E34] pb-2.5">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-[#71717A] block">Selected Date</span>
                      <h4 className="text-sm font-extrabold text-white">
                        {new Date(`${selectedDateKey}T00:00:00`).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </h4>
                    </div>
                    <span className="rounded-full bg-[#141416] border border-[#2E2E34] px-2.5 py-0.5 text-[10px] font-mono text-[#EAEAE6]">
                      {selectedDayEvents.length} item(s)
                    </span>
                  </div>

                  {selectedDayEvents.length === 0 ? (
                    <p className="py-6 text-center text-xs text-[#71717A] font-mono">
                      No events or tasks scheduled for this date.
                    </p>
                  ) : (
                    <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                      {selectedDayEvents.map((ev) => (
                        <div key={ev.id} className="rounded-xl border border-[#2E2E34] bg-[#141416] p-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-mono font-bold uppercase ${TYPE_META[ev.type]?.badge || ""}`}>
                              {TYPE_META[ev.type]?.label || ev.type}
                            </span>
                            {ev.time && (
                              <span className="inline-flex items-center space-x-1 text-[10px] font-mono text-[#A1A1AA]">
                                <Clock className="h-3 w-3" />
                                <span>{ev.time}</span>
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-bold text-white">{ev.title}</div>
                          {ev.description && (
                            <p className="text-[11px] text-[#A1A1AA] leading-relaxed">{ev.description}</p>
                          )}
                          <div className="flex items-center gap-2 text-[10px] font-mono text-[#71717A]">
                            <span>{ev.level === "all" ? "All Levels" : ev.level}</span>
                            {ev.courseCode && <span>&bull; {ev.courseCode}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Upcoming Schedule */}
                <div className="rounded-2xl border border-[#2E2E34] bg-[#1C1C1F] p-4 sm:p-5 space-y-3">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#A1A1AA] block">
                    Upcoming Schedule
                  </span>
                  {upcomingEvents.length === 0 ? (
                    <p className="text-xs text-[#71717A] font-mono">No upcoming events posted yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {upcomingEvents.map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => setSelectedDateKey(ev.date)}
                          className="w-full text-left rounded-xl border border-[#2E2E34] bg-[#141416] px-3 py-2 hover:border-emerald-500/40 transition-colors flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{ev.title}</div>
                            <div className="text-[10px] font-mono text-[#71717A]">
                              {ev.date} {ev.time ? `• ${ev.time}` : ""}
                            </div>
                          </div>
                          <span className={`h-2 w-2 rounded-full shrink-0 ${TYPE_META[ev.type]?.dot || "bg-emerald-400"}`} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
