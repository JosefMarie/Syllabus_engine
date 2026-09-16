"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Download, 
  CheckCircle2, 
  CloudOff, 
  X 
} from "lucide-react";
import { 
  isDeviceOnline, 
  onSyncStatusChange, 
  syncPendingOfflineChanges, 
  getPendingOfflineSyllabi, 
  getPendingOfflineProgress 
} from "@/lib/sync";

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

export default function PWAProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [syncSuccessToast, setSyncSuccessToast] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const calculatePending = () => {
    const syllabiCount = getPendingOfflineSyllabi().length;
    const progressCount = getPendingOfflineProgress().length;
    setPendingCount(syllabiCount + progressCount);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);
    calculatePending();

    // 1. Register Service Worker & trigger update check
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          reg.update().catch(() => {});
          console.log("[PWA] Service Worker registered with scope:", reg.scope);
        })
        .catch((err) => {
          console.warn("[PWA] Service Worker registration failed:", err);
        });

      // Reload when new service worker takes control so the app immediately reflects the updated code
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        console.log("[PWA] New version activated, refreshing application...");
        window.location.reload();
      });
    }

    // 2. Capture install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // 3. Listen to online/offline and sync queue events
    const unsubscribeSync = onSyncStatusChange((status) => {
      setIsOnline(status !== "offline");
      setIsSyncing(status === "syncing");
      calculatePending();
    });

    const handleOnline = () => {
      setIsOnline(true);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then((reg) => reg.update().catch(() => {}));
      }
      syncPendingOfflineChanges();
    };
    window.addEventListener("online", handleOnline);

    const handleQueueUpdated = () => calculatePending();
    const handleSynced = (e: any) => {
      calculatePending();
      const count = (e?.detail?.syllabiCount || 0) + (e?.detail?.progressCount || 0);
      if (count > 0) {
        setSyncSuccessToast(`Successfully synced ${count} item${count > 1 ? 's' : ''} to cloud!`);
        setTimeout(() => setSyncSuccessToast(null), 4500);
      }
    };

    window.addEventListener("syllabus_pwa_queue_updated", handleQueueUpdated);
    window.addEventListener("syllabus_pwa_synced", handleSynced);

    // Initial check for pending items upon loading while online
    if (navigator.onLine) {
      syncPendingOfflineChanges();
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("syllabus_pwa_queue_updated", handleQueueUpdated);
      window.removeEventListener("syllabus_pwa_synced", handleSynced);
      unsubscribeSync();
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setCanInstall(false);
      setDeferredPrompt(null);
    }
  };

  const syncNow = async () => {
    setIsSyncing(true);
    await syncPendingOfflineChanges();
    setIsSyncing(false);
  };

  return (
    <PWAContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingCount,
        canInstall,
        promptInstall,
        syncNow,
      }}
    >
      {children}

      {/* Floating Connectivity & Offline Sync Status Bar */}
      <div className="fixed bottom-4 left-4 z-40 flex flex-col gap-2 pointer-events-none">
        {/* Offline Warning Banner */}
        {!isOnline && !bannerDismissed && (
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-amber-500/40 bg-[#0F172A]/95 px-4 py-2.5 text-xs text-amber-200 shadow-2xl backdrop-blur-md transition-all">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
              <WifiOff className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold font-mono tracking-tight text-white">
                Offline Mode Active
              </span>
              <span className="text-[11px] text-amber-300/80">
                You can browse and create courses offline. {pendingCount > 0 ? `(${pendingCount} changes queued)` : "Changes will auto-sync when online."}
              </span>
            </div>
            <button
              onClick={() => setBannerDismissed(true)}
              className="ml-2 text-slate-400 hover:text-white p-1"
              title="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Syncing Activity Banner */}
        {isSyncing && (
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-[#06B6D4]/40 bg-[#0F172A]/95 px-3.5 py-2 text-xs text-white shadow-xl backdrop-blur-md animate-pulse">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#06B6D4]" />
            <span className="font-mono font-bold text-[#06B6D4]">Cloud Sync:</span>
            <span>Synchronizing offline changes...</span>
          </div>
        )}

        {/* Sync Success Toast */}
        {syncSuccessToast && (
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-[#0F172A]/95 px-3.5 py-2 text-xs text-emerald-200 shadow-2xl backdrop-blur-md">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="font-mono font-bold text-white">{syncSuccessToast}</span>
          </div>
        )}

        {/* Install PWA Prompt Pill */}
        {canInstall && (
          <button
            onClick={promptInstall}
            className="pointer-events-auto group flex items-center gap-2 rounded-xl border border-[#06B6D4]/50 bg-gradient-to-r from-[#06B6D4] to-[#0891B2] px-3.5 py-2 text-xs font-bold text-slate-950 shadow-2xl hover:scale-105 transition-all"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Install Syllabus App</span>
          </button>
        )}
      </div>
    </PWAContext.Provider>
  );
}
