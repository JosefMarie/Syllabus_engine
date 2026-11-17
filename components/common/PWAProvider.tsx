"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { WifiOff, RefreshCw, ExternalLink, X } from "lucide-react";
import { subscribeToGlobalClientRefresh } from "@/lib/auth";

interface PWAContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  canInstall: boolean;
  promptInstall: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const PWAContext = createContext<PWAContextType>({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  canInstall: false,
  promptInstall: async () => {},
  syncNow: async () => {},
});

export function usePWA() {
  return useContext(PWAContext);
}

/**
 * Online-Always Provider:
 * - Removes any legacy Service Worker registrations and PWA caches from user devices.
 * - Disables browser app-install prompts so the platform always runs live from the web host.
 * - Displays a simple connection-lost indicator if the device drops offline.
 */
export default function PWAProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isStandaloneApp, setIsStandaloneApp] = useState(false);
  const [standaloneNoticeDismissed, setStandaloneNoticeDismissed] = useState(false);
  const [isForcingRefresh, setIsForcingRefresh] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);

    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      Boolean((window.navigator as any).standalone);
    setIsStandaloneApp(standalone);
    try {
      if (sessionStorage.getItem("syllabus_standalone_notice_dismissed") === "1") {
        setStandaloneNoticeDismissed(true);
      }
    } catch {}

    // 1. Automatically unregister any previously installed Service Workers
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          registrations.forEach((reg) => {
            reg.unregister().catch(() => {});
          });
        })
        .catch(() => {});
    }

    // 2. Purge any leftover Cache Storage from legacy PWA builds
    if ("caches" in window) {
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .catch(() => {});
    }

    // 3. Clean up legacy offline queue storage keys
    try {
      localStorage.removeItem("syllabus_offline_queue_syllabi_v1");
      localStorage.removeItem("syllabus_offline_queue_progress_v1");
      sessionStorage.removeItem("syllabus_offline_queue_syllabi_v1");
    } catch {}

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // 4. Listen for global instructor-triggered cache & chunk refresh
    const unsubRefresh = subscribeToGlobalClientRefresh(() => {
      setIsForcingRefresh(true);
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubRefresh();
    };
  }, []);

  const promptInstall = async () => {};
  const syncNow = async () => {};

  return (
    <PWAContext.Provider
      value={{
        isOnline,
        isSyncing: false,
        pendingCount: 0,
        canInstall: false,
        promptInstall,
        syncNow,
      }}
    >
      {children}

      {/* Global Forced Refresh Banner */}
      {isForcingRefresh && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="flex items-center space-x-3 rounded-2xl border border-[#EAEAE6]/50 bg-[#141416] px-6 py-4 shadow-2xl">
            <RefreshCw className="h-5 w-5 animate-spin text-[#EAEAE6]" />
            <div>
              <p className="text-sm font-bold text-white">Updating Platform Content...</p>
              <p className="text-xs text-[#A1A1AA]">Clearing old browser chunks and reloading fresh data.</p>
            </div>
          </div>
        </div>
      )}

      {/* Minimal Offline Warning Banner (Online-Always Mode) */}
      {!isOnline && (
        <div className="fixed bottom-4 left-4 z-40 pointer-events-auto flex items-center gap-3 rounded-xl border border-rose-500/40 bg-[#141416]/95 px-4 py-2.5 text-xs text-rose-200 shadow-2xl backdrop-blur-md">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400">
            <WifiOff className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold font-mono tracking-tight text-white flex items-center gap-1.5">
              <span>Internet Connection Lost</span>
              <RefreshCw className="h-3 w-3 animate-spin text-rose-400" />
            </span>
            <span className="text-[11px] text-rose-300/80">
              This platform requires an active internet connection. Waiting to reconnect...
            </span>
          </div>
        </div>
      )}

      {/* Helpful notice for users still opening the legacy installed PWA shortcut */}
      {isStandaloneApp && !standaloneNoticeDismissed && (
        <div className="fixed bottom-4 right-4 z-40 max-w-sm pointer-events-auto flex items-start gap-3 rounded-xl border border-[#EAEAE6]/40 bg-[#141416]/95 px-4 py-3 text-xs text-slate-200 shadow-2xl backdrop-blur-md">
          <ExternalLink className="h-4 w-4 text-[#EAEAE6] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="block font-bold text-white">Installed App Retired (Online Mode)</span>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Offline app mode has been removed for faster performance. You can uninstall this app shortcut and use{" "}
              <strong className="text-[#EAEAE6]">{typeof window !== "undefined" ? window.location.origin : "the website"}</strong>{" "}
              directly in your browser.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setStandaloneNoticeDismissed(true);
              try {
                sessionStorage.setItem("syllabus_standalone_notice_dismissed", "1");
              } catch {}
            }}
            className="text-slate-400 hover:text-white p-0.5 shrink-0"
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </PWAContext.Provider>
  );
}
