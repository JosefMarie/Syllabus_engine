"use client";

import React, { useEffect, useState, useRef } from "react";
import { updateStudentPresence } from "@/lib/presence";
import { PresenceState } from "@/types/presence";
import { AlertTriangle, Layers } from "lucide-react";

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
  const [multiWindowDetected, setMultiWindowDetected] = useState(false);
  const lastInteractionRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!userId) return;

    // Track user inputs (mousemove, scroll, keydown, click)
    const recordInteraction = () => {
      lastInteractionRef.current = Date.now();
    };

    window.addEventListener("mousemove", recordInteraction);
    window.addEventListener("scroll", recordInteraction);
    window.addEventListener("keydown", recordInteraction);
    window.addEventListener("click", recordInteraction);

    // Compute precise status
    const computePresenceState = (): PresenceState => {
      if (document.hidden || !document.hasFocus()) {
        return 'tab_unfocused';
      }
      
      const secondsSinceLastInput = (Date.now() - lastInteractionRef.current) / 1000;
      if (secondsSinceLastInput > 30) {
        return 'idle';
      }

      return 'actively_reading';
    };

    const reportPresence = () => {
      const state = computePresenceState();
      updateStudentPresence(userId, fullName, state, subtopicTitle, syllabusTitle);
    };

    // Initial report
    reportPresence();

    // Fast heartbeat every 5 seconds for live responsiveness
    const interval = setInterval(reportPresence, 5000);

    const handleVisibilityChange = () => reportPresence();
    const handleBlur = () => updateStudentPresence(userId, fullName, 'tab_unfocused', subtopicTitle, syllabusTitle);
    const handleFocus = () => {
      lastInteractionRef.current = Date.now();
      reportPresence();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    // Multi-Window Broadcast Channel Detection
    let broadcastChannel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      broadcastChannel = new BroadcastChannel(`student_session_${userId}`);
      
      // Broadcast current window opening
      broadcastChannel.postMessage({ type: "WINDOW_OPENED", timestamp: Date.now() });

      broadcastChannel.onmessage = (event) => {
        if (event.data?.type === "WINDOW_OPENED") {
          setMultiWindowDetected(true);
        }
      };
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener("mousemove", recordInteraction);
      window.removeEventListener("scroll", recordInteraction);
      window.removeEventListener("keydown", recordInteraction);
      window.removeEventListener("click", recordInteraction);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      if (broadcastChannel) broadcastChannel.close();
    };
  }, [userId, fullName, subtopicTitle, syllabusTitle]);

  if (multiWindowDetected) {
    return (
      <div className="fixed bottom-4 left-4 z-50 max-w-md rounded-2xl border border-amber-500/50 bg-[#1E293B] p-4 text-xs shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom">
        <div className="flex items-start space-x-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-bold text-white flex items-center space-x-1">
              <span>Multiple Windows Active</span>
            </h4>
            <p className="mt-1 text-[#94A3B8] leading-relaxed">
              We noticed another session window open for your account. Please keep only your primary syllabus window active for accurate progress tracking.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null; // Invisible tracker
}
