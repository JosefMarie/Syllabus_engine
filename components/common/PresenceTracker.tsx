"use client";

import React, { useEffect, useState, useRef } from "react";
import { updateStudentPresence } from "@/lib/presence";
import { logoutStudent } from "@/lib/auth";
import { 
  recordActiveTopicTime, 
  recordStudentUnfocusedIncident, 
  suspendStudentForUnfocusedTimeout, 
  subscribeToUserProfile 
} from "@/lib/db";
import { subscribeToSystemRestrictions } from "@/lib/restrictions";
import { PresenceState } from "@/types/presence";
import { Layers, AlertTriangle, EyeOff, Clock, Users } from "lucide-react";
import DisciplinaryLockdown from "@/components/common/DisciplinaryLockdown";

interface PresenceTrackerProps {
  userId: string;
  fullName: string;
  email?: string;
  username?: string;
  tradeId?: string;
  level?: string;
  syllabusId?: string;
  syllabusTitle?: string;
  topicId?: string;
  topicTitle?: string;
  subtopicId?: string;
  subtopicTitle?: string;
}

export default function PresenceTracker({
  userId,
  fullName,
  email,
  username,
  tradeId,
  level,
  syllabusId,
  syllabusTitle,
  topicId,
  topicTitle,
  subtopicId,
  subtopicTitle,
}: PresenceTrackerProps) {
  const [multiWindowDetected, setMultiWindowDetected] = useState(false);
  const [isLockdown, setIsLockdown] = useState(false);
  const [lockdownReason, setLockdownReason] = useState<string>("Exceeded 10 side-window / focus violations during active syllabus study.");
  const [showAttentionPrompt, setShowAttentionPrompt] = useState(false);
  const [promptCountdown, setPromptCountdown] = useState(60);
  const [restrictionsDisabled, setRestrictionsDisabled] = useState(false);
  const restrictionsDisabledRef = useRef(false);

  useEffect(() => {
    const unsubRestrictions = subscribeToSystemRestrictions((cfg) => {
      setRestrictionsDisabled(cfg.restrictionsDisabled);
      restrictionsDisabledRef.current = cfg.restrictionsDisabled;
      if (cfg.restrictionsDisabled) {
        setShowAttentionPrompt(false);
        setMultiWindowDetected(false);
        unfocusedStartTimeRef.current = null;
      }
    });
    return () => unsubRestrictions();
  }, []);

  const lastInteractionRef = useRef<number>(Date.now());
  const unfocusedStartTimeRef = useRef<number | null>(null);
  const isTimingOutRef = useRef(false);

  // Accumulate active seconds spent on the current topic
  const activeSecondsAccumulatorRef = useRef<number>(0);
  const currentTopicRef = useRef({
    syllabusId,
    syllabusTitle,
    topicId,
    topicTitle,
    subtopicId,
    subtopicTitle,
  });

  useEffect(() => {
    currentTopicRef.current = {
      syllabusId,
      syllabusTitle,
      topicId,
      topicTitle,
      subtopicId,
      subtopicTitle,
    };
  }, [syllabusId, syllabusTitle, topicId, topicTitle, subtopicId, subtopicTitle]);

  const OFFLINE_STUDY_KEY = `syllabus_offline_time_${userId}`;

  // Flush active seconds helper with offline queueing
  const flushActiveSeconds = () => {
    const cur = currentTopicRef.current;
    if (activeSecondsAccumulatorRef.current > 0 && cur.topicId && cur.syllabusId) {
      const secondsToAdd = activeSecondsAccumulatorRef.current;
      activeSecondsAccumulatorRef.current = 0;

      // If browser is offline, store locally until connectivity is restored
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        try {
          const existing = parseInt(localStorage.getItem(OFFLINE_STUDY_KEY) || "0", 10);
          localStorage.setItem(OFFLINE_STUDY_KEY, String(existing + secondsToAdd));
        } catch (e) {
          console.warn("Error saving offline study time:", e);
        }
        return;
      }

      recordActiveTopicTime({
        userId,
        studentName: fullName,
        studentEmail: email,
        studentUsername: username,
        studentTradeId: tradeId,
        studentLevel: level,
        syllabusId: cur.syllabusId,
        syllabusTitle: cur.syllabusTitle || "Syllabus",
        topicId: cur.topicId,
        topicTitle: cur.topicTitle || "Topic",
        subtopicId: cur.subtopicId,
        subtopicTitle: cur.subtopicTitle,
        secondsToAdd,
      }).catch((err) => console.warn("Error flushing active topic time:", err));
    }
  };

  // Reconnection listener to flush any queued offline study seconds
  useEffect(() => {
    if (!userId) return;
    const handleOnline = () => {
      try {
        const queued = parseInt(localStorage.getItem(OFFLINE_STUDY_KEY) || "0", 10);
        if (queued > 0) {
          localStorage.removeItem(OFFLINE_STUDY_KEY);
          activeSecondsAccumulatorRef.current += queued;
          flushActiveSeconds();
        }
      } catch (e) {}
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [userId]);

  // Real-Time Cross-Tab / Multi-Window Collision Detection
  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window) || !userId) return;
    const channelName = `syllabus_tab_detector_${userId}`;
    const channel = new BroadcastChannel(channelName);

    // Announce to other tabs that this tab is active
    channel.postMessage({ type: "PROBE_OTHER_TABS", tabTime: Date.now() });

    channel.onmessage = (e) => {
      if (e.data?.type === "PROBE_OTHER_TABS") {
        channel.postMessage({ type: "ACK_TAB_PRESENT" });
        setMultiWindowDetected(true);
      } else if (e.data?.type === "ACK_TAB_PRESENT") {
        setMultiWindowDetected(true);
      }
    };

    return () => {
      channel.close();
    };
  }, [userId]);

  // Helper: Detect if browser focus or visibility APIs have been hijacked by extensions or scripts
  const isFocusTampered = (): boolean => {
    if (typeof window === "undefined") return false;
    try {
      // 1. Native document.hasFocus check
      const hasFocusStr = Function.prototype.toString.call(document.hasFocus);
      if (!hasFocusStr.includes("[native code]")) {
        return true;
      }

      // 2. Check if property descriptor has been hijacked on document instance
      const hasOwnHidden = Object.prototype.hasOwnProperty.call(document, "hidden");
      const hasOwnVisibilityState = Object.prototype.hasOwnProperty.call(document, "visibilityState");
      const hasOwnHasFocus = Object.prototype.hasOwnProperty.call(document, "hasFocus");
      if (hasOwnHidden || hasOwnVisibilityState || hasOwnHasFocus) {
        return true;
      }

      // 3. Check Document.prototype getter functions
      const hiddenDesc = Object.getOwnPropertyDescriptor(Document.prototype, "hidden");
      if (hiddenDesc?.get && !Function.prototype.toString.call(hiddenDesc.get).includes("[native code]")) {
        return true;
      }

      const visDesc = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");
      if (visDesc?.get && !Function.prototype.toString.call(visDesc.get).includes("[native code]")) {
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  };

  // Countdown timer for Active Learning Verification Prompt
  useEffect(() => {
    if (!showAttentionPrompt || isLockdown) return;

    const timer = setInterval(() => {
      setPromptCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          const inactiveReason = "Account suspended: Exceeded 3 minutes of inactivity without confirming active learning focus.";
          setLockdownReason(inactiveReason);
          setIsLockdown(true);
          setShowAttentionPrompt(false);
          suspendStudentForUnfocusedTimeout(userId).catch(console.error);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showAttentionPrompt, isLockdown, userId]);

  const handleAttentionConfirm = (e: React.MouseEvent) => {
    // Only accept genuine user mouse click, ignore synthetic automation scripts
    if (e && 'isTrusted' in e && !e.isTrusted) return;
    lastInteractionRef.current = Date.now();
    unfocusedStartTimeRef.current = null;
    setShowAttentionPrompt(false);
    setPromptCountdown(60);
  };

  useEffect(() => {
    if (!userId) return;

    // Track user inputs with genuine entropy & synthetic event filtering
    const recordInteraction = (e: Event) => {
      // Synthetic automation check: bots fire events with isTrusted === false
      if (e && 'isTrusted' in e && !e.isTrusted) {
        return; // Ignore fake bot events
      }
      lastInteractionRef.current = Date.now();
      if (showAttentionPrompt) {
        setShowAttentionPrompt(false);
        setPromptCountdown(60);
      }
    };

    // Helper: Determine if native file picker dialog is currently open
    const isFilePickerActive = (): boolean => {
      if (typeof window === "undefined") return false;
      const w = window as any;
      if (!w.__SYLLABUS_FILE_PICKER_TIMESTAMP) return false;
      const elapsed = Date.now() - w.__SYLLABUS_FILE_PICKER_TIMESTAMP;
      // Allow up to 3 minutes for browsing and selecting files
      return w.__SYLLABUS_FILE_PICKER_ACTIVE === true && elapsed < 180000;
    };

    const markFilePickerActive = () => {
      if (typeof window === "undefined") return;
      (window as any).__SYLLABUS_FILE_PICKER_ACTIVE = true;
      (window as any).__SYLLABUS_FILE_PICKER_TIMESTAMP = Date.now();
    };

    const markFilePickerInactive = (delayMs: number = 1000) => {
      if (typeof window === "undefined") return;
      setTimeout(() => {
        (window as any).__SYLLABUS_FILE_PICKER_ACTIVE = false;
        (window as any).__SYLLABUS_FILE_PICKER_TIMESTAMP = 0;
      }, delayMs);
    };

    // Global capture listener for file uploads
    const handleGlobalFileClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (
        target.matches('input[type="file"]') ||
        target.closest('input[type="file"]') ||
        target.closest('label')?.querySelector('input[type="file"]')
      ) {
        markFilePickerActive();
      }
    };

    const handleGlobalFileChangeOrCancel = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target?.matches('input[type="file"]')) {
        markFilePickerInactive(1500);
      }
    };

    document.addEventListener("click", handleGlobalFileClick, true);
    document.addEventListener("change", handleGlobalFileChangeOrCancel, true);
    document.addEventListener("cancel", handleGlobalFileChangeOrCancel, true);

    window.addEventListener("mousemove", recordInteraction, { passive: true });
    window.addEventListener("scroll", recordInteraction, { passive: true });
    window.addEventListener("keydown", recordInteraction, { passive: true });
    window.addEventListener("click", recordInteraction, { passive: true });
    window.addEventListener("touchstart", recordInteraction, { passive: true });

    // Compute precise status: idle threshold is 60 seconds (1 minute)
    const computePresenceState = (): PresenceState => {
      // If student is currently selecting a file through native OS file dialog, keep active
      if (isFilePickerActive()) {
        return 'actively_reading';
      }

      // 1. Anti-Tamper check: If extension hijacked document.hasFocus or document.hidden
      if (isFocusTampered()) {
        return 'tab_unfocused';
      }

      // 2. Standard browser unfocused / hidden
      if (document.hidden || !document.hasFocus()) {
        return 'tab_unfocused';
      }
      
      // 3. Interaction entropy: if no trusted human inputs for > 60 seconds, mark as idle
      const secondsSinceLastInput = (Date.now() - lastInteractionRef.current) / 1000;
      if (secondsSinceLastInput > 60) {
        return 'idle';
      }

      return 'actively_reading';
    };

    const reportPresence = () => {
      if (isTimingOutRef.current) return;

      // Anti-tamper lockdown (only when restrictions are active)
      if (isFocusTampered() && !isLockdown && !restrictionsDisabledRef.current) {
        const tamperReason = "Account suspended: Security violation detected. Unauthorized browser extension or script tampering with focus detection.";
        setLockdownReason(tamperReason);
        setIsLockdown(true);
        suspendStudentForUnfocusedTimeout(userId).catch(console.error);
        return;
      }

      const state = computePresenceState();
      let unfocusedDuration = 0;
      const secondsSinceLastInput = (Date.now() - lastInteractionRef.current) / 1000;

      // 3-Minute Continuous Side-Window & Abandonment Tracking
      if (state === 'tab_unfocused') {
        if (!unfocusedStartTimeRef.current) {
          unfocusedStartTimeRef.current = Date.now();
        }
        unfocusedDuration = Math.floor((Date.now() - unfocusedStartTimeRef.current) / 1000);

        // If continuously unfocused for 3 minutes (180s), immediately trigger disciplinary lockdown ONLY if restrictions are active
        if (unfocusedDuration >= 180 && !isLockdown && !restrictionsDisabledRef.current) {
          const timeoutReason = "Account suspended: Exceeded 3 minutes continuously in a side window / unfocused application without learning focus.";
          setLockdownReason(timeoutReason);
          setIsLockdown(true);
          suspendStudentForUnfocusedTimeout(userId).catch(console.error);
        }
      } else if (secondsSinceLastInput >= 180 && !restrictionsDisabledRef.current) {
        // Even if tab claims to be open, 3 minutes of zero human interaction = abandoned study
        unfocusedDuration = Math.floor(secondsSinceLastInput);
        if (!isLockdown) {
          const inactiveReason = "Account suspended: Exceeded 3 minutes of total inactivity without active learning focus.";
          setLockdownReason(inactiveReason);
          setIsLockdown(true);
          setShowAttentionPrompt(false);
          suspendStudentForUnfocusedTimeout(userId).catch(console.error);
        }
      } else if (secondsSinceLastInput >= 120 && !showAttentionPrompt && !isLockdown && !restrictionsDisabledRef.current) {
        // Warning prompt at 2 minutes of idle time with 60s countdown before 3-minute suspension
        setShowAttentionPrompt(true);
        setPromptCountdown(60);
      } else {
        // Returned to syllabus window and actively engaging -> reset continuous unfocused duration
        unfocusedStartTimeRef.current = null;
      }

      const now = Date.now();
      const stateChanged = state !== lastReportedStateRef.current;
      const subtopicChanged = (subtopicTitle || "") !== lastReportedSubtopicRef.current;
      const routineHeartbeatDue = (now - lastPresenceWriteRef.current) >= 20000;
      const isUnfocusedTracking = unfocusedDuration > 0;

      // Adaptive Write: Immediate on state/topic shift or active unfocused tracking, 20s steady-state heartbeat
      if (stateChanged || subtopicChanged || routineHeartbeatDue || isUnfocusedTracking) {
        lastReportedStateRef.current = state;
        lastReportedSubtopicRef.current = subtopicTitle || "";
        lastPresenceWriteRef.current = now;
        updateStudentPresence(userId, fullName, state, subtopicTitle, syllabusTitle, unfocusedDuration);
      }

      // ACCUMULATE ACTIVE LEARNING TIME:
      // Count when actively reading/interacting, or in group work mode while active
      if (state === 'actively_reading' || (restrictionsDisabledRef.current && secondsSinceLastInput < 120)) {
        activeSecondsAccumulatorRef.current += 5; // 5 second tick
        
        // Flush every 15 seconds of active study to persist progress
        if (activeSecondsAccumulatorRef.current >= 15) {
          flushActiveSeconds();
        }
      }
    };

    const lastReportedStateRef = { current: "" as PresenceState | "" };
    const lastReportedSubtopicRef = { current: "" };
    const lastPresenceWriteRef = { current: 0 };

    // Initial report
    reportPresence();

    // Fast heartbeat every 5 seconds for live responsiveness & accurate time counting
    const interval = setInterval(reportPresence, 5000);

    const lastUnfocusRecordedRef = { current: 0 };

    const handleUnfocusedStrike = async () => {
      // Do not record strikes if already in lockdown or suspended
      if (isLockdown) return;
      // Do not record strikes if restrictions are disabled (Group Work Mode)
      if (restrictionsDisabledRef.current) return;
      // Do not record strikes if student is currently selecting a file
      if (isFilePickerActive()) return;

      const now = Date.now();
      if (now - lastUnfocusRecordedRef.current < 4000) return; // 4 second debouncing
      lastUnfocusRecordedRef.current = now;

      try {
        const result = await recordStudentUnfocusedIncident(userId);
        if (result.suspended) {
          setLockdownReason("Account suspended: Exceeded 10 side-window / focus violations.");
          setIsLockdown(true);
        }
      } catch (e) {
        console.warn("Error tracking unfocused strike:", e);
      }
    };

    // Real-time listener for student status changes (reset strikes -> pending_approval, approved)
    const unsubProfile = subscribeToUserProfile(userId, (profile) => {
      if (profile) {
        if (profile.status === "rejected") {
          if (profile.suspensionReason) {
            setLockdownReason(profile.suspensionReason);
          }
          setIsLockdown(true);
        } else if (profile.status === "pending_approval" || profile.status === "approved") {
          setIsLockdown(false);
          unfocusedStartTimeRef.current = null;
        }
      }
    });

    const handleStudentSuspended = (e: any) => {
      if (e.detail?.userId === userId) {
        if (e.detail?.reason) {
          setLockdownReason(e.detail.reason);
        }
        setIsLockdown(true);
      }
    };
    window.addEventListener("syllabus_student_suspended", handleStudentSuspended);

    const handleVisibilityChange = () => {
      if (isFilePickerActive()) {
        return;
      }
      if (document.hidden) {
        flushActiveSeconds();
        if (!unfocusedStartTimeRef.current) {
          unfocusedStartTimeRef.current = Date.now();
        }
        updateStudentPresence(userId, fullName, 'tab_unfocused', subtopicTitle, syllabusTitle, 0);
        handleUnfocusedStrike();
      } else {
        lastInteractionRef.current = Date.now();
        unfocusedStartTimeRef.current = null;
        reportPresence();
      }
    };

    const handleBlur = () => {
      // If student is browsing files in the OS file picker, do NOT treat as tab unfocused or side-window strike
      if (isFilePickerActive()) {
        return;
      }
      flushActiveSeconds();
      if (!unfocusedStartTimeRef.current) {
        unfocusedStartTimeRef.current = Date.now();
      }
      updateStudentPresence(userId, fullName, 'tab_unfocused', subtopicTitle, syllabusTitle, 0);
      handleUnfocusedStrike();
    };

    const handleFocus = () => {
      // Returning focus after file selection or dialog dismissal
      if (isFilePickerActive()) {
        markFilePickerInactive(1000);
      }
      lastInteractionRef.current = Date.now();
      unfocusedStartTimeRef.current = null;
      reportPresence();
    };

    const handleBeforeUnload = () => {
      flushActiveSeconds();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Multi-Window Broadcast Channel Detection
    let broadcastChannel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      broadcastChannel = new BroadcastChannel(`student_session_${userId}`);
      broadcastChannel.postMessage({ type: "WINDOW_OPENED", timestamp: Date.now() });

      broadcastChannel.onmessage = (event) => {
        if (event.data?.type === "WINDOW_OPENED" && !restrictionsDisabledRef.current) {
          setMultiWindowDetected(true);
        }
      };
    }

    return () => {
      flushActiveSeconds();
      clearInterval(interval);
      unsubProfile();
      document.removeEventListener("click", handleGlobalFileClick, true);
      document.removeEventListener("change", handleGlobalFileChangeOrCancel, true);
      document.removeEventListener("cancel", handleGlobalFileChangeOrCancel, true);
      window.removeEventListener("syllabus_student_suspended", handleStudentSuspended);
      window.removeEventListener("mousemove", recordInteraction);
      window.removeEventListener("scroll", recordInteraction);
      window.removeEventListener("keydown", recordInteraction);
      window.removeEventListener("click", recordInteraction);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (broadcastChannel) broadcastChannel.close();
    };
  }, [userId, fullName, email, username, tradeId, level, subtopicTitle, syllabusTitle, isLockdown]);

  if (isLockdown) {
    return (
      <DisciplinaryLockdown
        studentName={fullName}
        studentUsername={username}
        reason={lockdownReason}
        violationsCount={10}
      />
    );
  }

  return (
    <>
      {/* Floating indicator when Instructor has enabled Group Work Mode */}
      {restrictionsDisabled && (
        <div className="fixed top-3 right-4 z-40 flex items-center space-x-2 rounded-xl bg-purple-950/85 border border-purple-500/40 px-3 py-1.5 text-[11px] font-mono font-bold text-purple-300 shadow-2xl backdrop-blur-md animate-in fade-in">
          <Users className="h-3.5 w-3.5 text-purple-400 shrink-0" />
          <span>Group Work Mode Active • Restrictions Paused</span>
        </div>
      )}

      {showAttentionPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-amber-500/30 bg-[#0F172A] p-6 shadow-2xl text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="h-8 w-8 animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-white">Active Learning Verification</h3>
            <p className="mt-2 text-sm text-[#94A3B8] leading-relaxed">
              You haven&apos;t interacted with this topic for 2 minutes. Continuous syllabus focus is mandatory. Please confirm you are actively studying.
            </p>
            <div className="mt-4 inline-flex items-center space-x-2 rounded-xl bg-[#1E293B] px-4 py-2 border border-slate-700">
              <span className="text-xs text-slate-400">Automatic suspension in:</span>
              <span className="font-mono text-base font-bold text-amber-400">{promptCountdown}s</span>
            </div>
            <div className="mt-6">
              <button
                type="button"
                onClick={handleAttentionConfirm}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] focus:outline-none"
              >
                I&apos;m Here — Continue Studying
              </button>
            </div>
          </div>
        </div>
      )}

      {multiWindowDetected && !restrictionsDisabled && (
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
      )}
    </>
  );
}
