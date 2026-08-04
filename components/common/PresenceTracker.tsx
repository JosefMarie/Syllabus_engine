"use client";

import React, { useEffect } from "react";
import { updateStudentPresence } from "@/lib/presence";

interface PresenceTrackerProps {
  userId: string;
  fullName: string;
  subtopicTitle?: string;
  syllabusTitle?: string;
}

export default function PresenceTracker({
  userId,
  fullName,
  subtopicTitle,
  syllabusTitle,
}: PresenceTrackerProps) {
  useEffect(() => {
    if (!userId) return;

    const reportPresence = (state: 'actively_reading' | 'tab_unfocused') => {
      updateStudentPresence(userId, fullName, state, subtopicTitle, syllabusTitle);
    };

    // Initial report
    const initialState = document.hidden ? 'tab_unfocused' : 'actively_reading';
    reportPresence(initialState);

    // Heartbeat every 15 seconds
    const interval = setInterval(() => {
      const state = document.hidden ? 'tab_unfocused' : 'actively_reading';
      reportPresence(state);
    }, 15000);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportPresence('tab_unfocused');
      } else {
        reportPresence('actively_reading');
      }
    };

    const handleBlur = () => reportPresence('tab_unfocused');
    const handleFocus = () => reportPresence('actively_reading');

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [userId, fullName, subtopicTitle, syllabusTitle]);

  return null; // Invisible tracker component
}
