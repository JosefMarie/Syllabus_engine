"use client";

import React, { useEffect, useState } from "react";
import { ShieldAlert, Lock } from "lucide-react";
import { subscribeToSystemRestrictions } from "@/lib/restrictions";

interface Props {
  children: React.ReactNode;
  isProtected: boolean;
  userFullName?: string;
  userEmail?: string;
}

export default function ContentProtection({
  children,
  isProtected,
  userFullName = "Student",
  userEmail = "student@institution.edu",
}: Props) {
  const [showWarning, setShowWarning] = useState(false);
  const [warningText, setWarningText] = useState("");
  const [isWindowBlurred, setIsWindowBlurred] = useState(false);
  const [restrictionsDisabled, setRestrictionsDisabled] = useState(false);

  useEffect(() => {
    const unsub = subscribeToSystemRestrictions((cfg) => {
      setRestrictionsDisabled(cfg.restrictionsDisabled);
      if (cfg.restrictionsDisabled) {
        setIsWindowBlurred(false);
        setShowWarning(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isProtected || restrictionsDisabled) {
      setIsWindowBlurred(false);
      return;
    }

    const triggerWarning = (msg: string) => {
      setWarningText(msg);
      setShowWarning(true);
      setTimeout(() => setShowWarning(false), 3500);
    };

    // Prevent Right Click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      triggerWarning("Right-click context menu is disabled on syllabus materials.");
    };

    // Prevent Text Copy / Cut
    const handleCopyCut = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerWarning("Copying and cutting text content is strictly prohibited.");
    };

    // Prevent Drag & Drop selection
    const handleSelectStart = (e: Event) => {
      const target = e.target as HTMLElement;
      // Allow interaction in input fields or textareas if any exist
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      e.preventDefault();
    };

    // Keydown combinations (Ctrl+C, Cmd+C, Ctrl+P, Cmd+P, Ctrl+S, Cmd+S, PrintScreen, F12, Ctrl+Shift+I)
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;

      if (
        (isCmdOrCtrl && (e.key === "c" || e.key === "C")) ||
        (isCmdOrCtrl && (e.key === "p" || e.key === "P")) ||
        (isCmdOrCtrl && (e.key === "s" || e.key === "S")) ||
        (isCmdOrCtrl && (e.key === "a" || e.key === "A")) ||
        (isCmdOrCtrl && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "S" || e.key === "s" || e.key === "4" || e.key === "3")) ||
        e.key === "PrintScreen" ||
        e.key === "F12"
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerWarning(`Shortcut (${e.key}) disabled. Copying, printing, & screenshots are prohibited.`);
      }
    };

    // Handle Window Blur (e.g. Snipping tool, Share window, Defocus)
    const handleBlur = () => {
      setIsWindowBlurred(true);
    };

    const handleFocus = () => {
      setIsWindowBlurred(false);
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("copy", handleCopyCut);
    window.addEventListener("cut", handleCopyCut);
    window.addEventListener("selectstart", handleSelectStart);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("copy", handleCopyCut);
      window.removeEventListener("cut", handleCopyCut);
      window.removeEventListener("selectstart", handleSelectStart);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [isProtected, restrictionsDisabled]);

  if (!isProtected || restrictionsDisabled) {
    return <>{children}</>;
  }

  return (
    <div className="relative select-none print:hidden">
      {/* Dynamic Watermark Background Grid */}
      <div 
        className="pointer-events-none fixed inset-0 z-50 flex flex-wrap items-center justify-around overflow-hidden opacity-[0.035] mix-blend-overlay"
        aria-hidden="true"
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="m-8 rotate-[-25deg] text-center font-mono text-xs font-black tracking-widest text-white uppercase">
            RESTRICTED CONTENT • PREPARED FOR {(userFullName || "STUDENT").toUpperCase()} ({userEmail || "student@institution.edu"}) • PROHIBITED FROM REPRODUCTION
          </div>
        ))}
      </div>

      {/* Security Toast Warning Banner */}
      {showWarning && (
        <div className="fixed top-5 left-1/2 z-[100] -translate-x-1/2 animate-bounce">
          <div className="flex items-center space-x-2.5 rounded-2xl border border-rose-500/40 bg-rose-950/90 px-4 py-3 text-xs font-bold text-rose-200 shadow-2xl backdrop-blur-md">
            <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{warningText}</span>
          </div>
        </div>
      )}

      {/* Window Unfocus Blur Protection (Triggered when taking screenshots or defocusing) */}
      <div className={`transition-all duration-300 ${isWindowBlurred ? "filter blur-md opacity-25" : ""}`}>
        {children}
      </div>

      {isWindowBlurred && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0B0F19]/80 backdrop-blur-lg">
          <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-6 text-center shadow-2xl max-w-sm">
            <Lock className="mx-auto h-10 w-10 text-[#06B6D4] mb-3" />
            <h3 className="text-sm font-bold text-white">Content Protected</h3>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Syllabus material is blurred while window is unfocused or screenshot tool is active. Click back to resume reading.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
