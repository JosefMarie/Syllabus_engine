"use client";

import React, { useState, useEffect } from "react";
import { ACADEMY_BADGES, AchievementBadge, StudentAchievementRecord, BadgeRarity } from "@/types/achievement";
import { UserProfile } from "@/types/auth";
import { getStudentAchievements } from "@/lib/achievements";
import { 
  Trophy, 
  Award, 
  Sparkles, 
  CheckCircle2, 
  Lock, 
  X, 
  Flame, 
  ShieldCheck, 
  Star 
} from "lucide-react";

interface AchievementBadgesModalProps {
  currentUser: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function AchievementBadgesModal({
  currentUser,
  isOpen,
  onClose
}: AchievementBadgesModalProps) {
  const [earnedRecords, setEarnedRecords] = useState<StudentAchievementRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser || !isOpen) return;
    getStudentAchievements(currentUser.uid).then((recs) => {
      setEarnedRecords(recs || []);
      setLoading(false);
    });
  }, [currentUser, isOpen]);

  if (!isOpen) return null;

  const earnedMap = new Map(earnedRecords.map((r) => [r.badgeId, r]));
  const unlockedCount = earnedRecords.length;
  const totalBadges = ACADEMY_BADGES.length;
  const totalXp = earnedRecords.reduce((sum, r) => {
    const b = ACADEMY_BADGES.find((badge) => badge.id === r.badgeId);
    return sum + (b?.xpReward || 0);
  }, 0);

  const getRarityBadge = (rarity: BadgeRarity) => {
    switch (rarity) {
      case "bronze":
        return {
          label: "Bronze",
          border: "border-amber-700/50",
          bg: "bg-amber-950/20",
          text: "text-amber-500",
          badge: "bg-amber-800/20 text-amber-400 border-amber-700/30"
        };
      case "silver":
        return {
          label: "Silver",
          border: "border-slate-400/50",
          bg: "bg-slate-800/30",
          text: "text-slate-300",
          badge: "bg-slate-700/20 text-slate-300 border-slate-600/30"
        };
      case "gold":
        return {
          label: "Gold",
          border: "border-yellow-500/60",
          bg: "bg-yellow-950/30",
          text: "text-yellow-400",
          badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
        };
      case "diamond":
        return {
          label: "Diamond",
          border: "border-cyan-400/60 shadow-lg shadow-cyan-950/40",
          bg: "bg-cyan-950/30",
          text: "text-cyan-300",
          badge: "bg-cyan-500/20 text-cyan-300 border-cyan-400/40"
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-left">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-yellow-500/20 to-cyan-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Trophy className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Student Mastery Badges</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {unlockedCount}/{totalBadges} Unlocked
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Earn badges and bonus XP by completing curriculum milestones and coding challenges
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overview Stats Bar */}
        <div className="px-6 py-3.5 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="text-slate-400">
              Total Bonus XP: <strong className="text-amber-400 font-mono">+{totalXp} XP</strong>
            </span>
            <span className="text-slate-400 hidden sm:inline">
              Student: <strong className="text-white">{currentUser?.fullName}</strong>
            </span>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-cyan-400 rounded-full"
                style={{ width: `${(unlockedCount / totalBadges) * 100}%` }}
              />
            </div>
            <span className="text-cyan-300 font-mono font-bold text-[11px]">
              {Math.round((unlockedCount / totalBadges) * 100)}%
            </span>
          </div>
        </div>

        {/* Badges Grid */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ACADEMY_BADGES.map((badge) => {
            const isEarned = earnedMap.has(badge.id);
            const record = earnedMap.get(badge.id);
            const style = getRarityBadge(badge.rarity);

            return (
              <div
                key={badge.id}
                className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                  isEarned
                    ? `${style.bg} ${style.border} shadow-md`
                    : "bg-slate-950/40 border-slate-800/80 opacity-60 grayscale-[40%]"
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 border ${
                    isEarned
                      ? `${style.bg} ${style.border} shadow-inner`
                      : "bg-slate-900 border-slate-800 text-slate-600"
                  }`}
                >
                  {badge.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-sm text-white truncate">
                      {badge.title}
                    </span>
                    <span
                      className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${style.badge}`}
                    >
                      {style.label}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    {badge.description}
                  </p>

                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                    <span className="text-amber-400 font-mono font-bold">
                      +{badge.xpReward} XP
                    </span>

                    {isEarned ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Unlocked {record?.earnedAt ? new Date(record.earnedAt).toLocaleDateString() : ""}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <Lock className="w-3 h-3" />
                        <span>Locked</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
