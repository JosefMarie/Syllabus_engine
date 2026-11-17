"use client";

import React, { useState, useEffect } from "react";
import { CalendarEvent, CalendarEventType } from "@/types/calendar";
import { StudentLevel, UserProfile } from "@/types/auth";
import { Syllabus } from "@/types/syllabus";
import { getCalendarEvents, saveCalendarEvent, deleteCalendarEvent } from "@/lib/db";
import { CalendarDays, Plus, Trash2, Clock, Edit3, Check, X } from "lucide-react";

interface CalendarManagerProps {
  adminUser?: UserProfile | null;
  syllabi?: Syllabus[];
}

export default function CalendarManager({ adminUser, syllabi = [] }: CalendarManagerProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [type, setType] = useState<CalendarEventType>("event");
  const [level, setLevel] = useState<StudentLevel | "all">("all");
  const [courseCode, setCourseCode] = useState("");

  const loadEvents = async () => {
    setLoading(true);
    try {
      const list = await getCalendarEvents();
      setEvents(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setDate(new Date().toISOString().slice(0, 10));
    setTime("");
    setType("event");
    setLevel("all");
    setCourseCode("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    setSaving(true);
    try {
      const payload: CalendarEvent = {
        id: editingId || `cal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: title.trim(),
        description: description.trim() || undefined,
        date,
        time: time.trim() || undefined,
        type,
        level,
        courseCode: courseCode.trim() || undefined,
        createdBy: adminUser?.fullName || "Instructor",
        createdAt: new Date().toISOString(),
      };
      await saveCalendarEvent(payload);
      await loadEvents();
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (ev: CalendarEvent) => {
    setEditingId(ev.id);
    setTitle(ev.title);
    setDescription(ev.description || "");
    setDate(ev.date);
    setTime(ev.time || "");
    setType(ev.type);
    setLevel(ev.level);
    setCourseCode(ev.courseCode || "");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this calendar event/task?")) return;
    await deleteCalendarEvent(id);
    setEvents((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#2E2E34] pb-4">
        <div className="flex items-center space-x-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-lg font-extrabold text-white tracking-tight">
              Academic Calendar &amp; Tasks Manager
            </h3>
            <p className="text-xs text-[#A1A1AA]">
              Schedule events, study tasks, deadlines, and exam reminders visible to students in the top bar calendar.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form */}
        <form onSubmit={handleSave} className="lg:col-span-5 rounded-2xl border border-[#2E2E34] bg-[#141416] p-5 space-y-4 h-fit">
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
            {editingId ? "Edit Event / Task" : "Add Event or Task"}
          </h4>

          <div>
            <label className="block text-[11px] font-bold text-[#A1A1AA] mb-1">Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Dart Practical Lab Review"
              className="w-full rounded-xl border border-[#2E2E34] bg-[#1C1C1F] px-3 py-2 text-xs text-white placeholder-[#71717A] focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#A1A1AA] mb-1">Date *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-[#2E2E34] bg-[#1C1C1F] px-3 py-2 text-xs font-mono text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#A1A1AA] mb-1">Time (Optional)</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-xl border border-[#2E2E34] bg-[#1C1C1F] px-3 py-2 text-xs font-mono text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#A1A1AA] mb-1">Category</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as CalendarEventType)}
                className="w-full rounded-xl border border-[#2E2E34] bg-[#1C1C1F] px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="event">Event</option>
                <option value="task">Task / Deadline</option>
                <option value="exam">Exam / Quiz</option>
                <option value="holiday">Holiday / Break</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#A1A1AA] mb-1">Target Level</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as StudentLevel | "all")}
                className="w-full rounded-xl border border-[#2E2E34] bg-[#1C1C1F] px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">All Levels</option>
                <option value="Level 3">Level 3</option>
                <option value="Level 4">Level 4</option>
                <option value="Level 5">Level 5</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#A1A1AA] mb-1">Course Code (Optional)</label>
            <select
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              className="w-full rounded-xl border border-[#2E2E34] bg-[#1C1C1F] px-3 py-2 text-xs font-mono text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="">General (All Courses)</option>
              {syllabi.map((s) => (
                <option key={s.id} value={s.courseCode}>
                  {s.courseCode} - {s.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#A1A1AA] mb-1">Description / Instructions</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details for students..."
              className="w-full rounded-xl border border-[#2E2E34] bg-[#1C1C1F] px-3 py-2 text-xs text-white placeholder-[#71717A] focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center space-x-1.5 rounded-full bg-emerald-500 py-2.5 text-xs font-bold text-[#141416] hover:bg-emerald-400 transition-all disabled:opacity-50"
            >
              {editingId ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              <span>{saving ? "Saving..." : editingId ? "Update Event" : "Add to Calendar"}</span>
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-[#2E2E34] bg-[#1C1C1F] px-4 py-2.5 text-xs font-bold text-[#A1A1AA] hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </form>

        {/* List */}
        <div className="lg:col-span-7 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-xs font-mono text-[#A1A1AA]">Loading calendar events...</div>
          ) : events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#2E2E34] bg-[#141416] p-10 text-center text-xs text-[#A1A1AA]">
              No calendar events or tasks scheduled yet. Add your first event on the left.
            </div>
          ) : (
            events.map((ev) => (
              <div
                key={ev.id}
                className="rounded-2xl border border-[#2E2E34] bg-[#141416] p-4 flex items-start justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#1C1C1F] border border-[#2E2E34] px-2.5 py-0.5 text-[10px] font-mono font-bold text-white uppercase">
                      {ev.type}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400">{ev.date}</span>
                    {ev.time && (
                      <span className="inline-flex items-center space-x-1 text-[11px] font-mono text-[#A1A1AA]">
                        <Clock className="h-3 w-3" />
                        <span>{ev.time}</span>
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-[#71717A]">
                      {ev.level === "all" ? "All Levels" : ev.level}
                      {ev.courseCode ? ` • ${ev.courseCode}` : ""}
                    </span>
                  </div>
                  <h5 className="text-sm font-bold text-white">{ev.title}</h5>
                  {ev.description && <p className="text-xs text-[#A1A1AA]">{ev.description}</p>}
                </div>

                <div className="flex items-center space-x-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEdit(ev)}
                    className="rounded-full bg-emerald-500/15 border border-emerald-500/30 p-2 text-emerald-300 hover:bg-emerald-500 hover:text-[#141416] transition-all"
                    title="Edit Event"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(ev.id)}
                    className="rounded-full bg-rose-500/15 border border-rose-500/30 p-2 text-rose-300 hover:bg-rose-500 hover:text-white transition-all"
                    title="Delete Event"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
