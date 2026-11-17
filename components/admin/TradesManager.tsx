"use client";

import React, { useEffect, useState } from "react";
import { Trade } from "@/types/auth";
import { getAllTrades, saveTrade, deleteTrade } from "@/lib/db";
import { Plus, Trash2, Briefcase, AlertTriangle } from "lucide-react";

export default function TradesManager() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Inline Delete State
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const list = await getAllTrades();
        setTrades(list);
      } catch (err) {
        console.warn("Error loading trades:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleAddTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const newTrade: Trade = {
        id: `trade-${Date.now()}`,
        name: name.trim(),
        description: description.trim(),
        createdAt: new Date().toISOString()
      };

      await saveTrade(newTrade);
      setTrades(prev => [newTrade, ...prev]);
      setName("");
      setDescription("");
    } catch (err: any) {
      console.error("Failed to save trade:", err);
      alert("Failed to add trade: " + (err?.message || "Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const executeDelete = async (id: string) => {
    setTrades((prev) => prev.filter((t) => t.id !== id));
    setConfirmDeleteId(null);
    await deleteTrade(id);
  };

  return (
    <div className="space-y-6">
      {/* Add Trade Form */}
      <div className="rounded-2xl border border-[#2E2E34] bg-[#1C1C1F] p-6 space-y-4 shadow-xl">
        <div className="flex items-center space-x-2 text-xs font-mono text-[#EAEAE6]">
          <Briefcase className="h-4 w-4" />
          <span>Teacher Trades Management</span>
        </div>
        <h3 className="text-lg font-bold text-white">Create New Academic Trade</h3>
        <p className="text-xs text-[#A1A1AA]">
          Each Trade contains Level 3, Level 4, and Level 5 student levels automatically.
        </p>

        <form onSubmit={handleAddTrade} className="space-y-3 pt-2">
          <div>
            <label className="text-xs font-mono text-[#A1A1AA]">Trade Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cybersecurity & Network Defense"
              className="mt-1 w-full rounded-xl border border-[#2E2E34] bg-[#141416] p-3 text-xs text-white placeholder-[#71717A] focus:border-[#EAEAE6] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-[#A1A1AA]">Trade Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Overview of core competencies covered in this trade..."
              className="mt-1 w-full rounded-xl border border-[#2E2E34] bg-[#141416] p-3 text-xs text-white placeholder-[#71717A] focus:border-[#EAEAE6] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="inline-flex items-center space-x-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-[#141416] hover:bg-emerald-400 hover:text-[#141416] transition-all shadow-lg disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            <span>{saving ? "Saving..." : "Add Trade"}</span>
          </button>
        </form>
      </div>

      {/* Trades List */}
      <div className="space-y-3">
        <h4 className="text-xs font-mono text-[#A1A1AA] uppercase tracking-wider">
          Active Trades ({trades.length})
        </h4>

        {loading ? (
          <div className="py-8 text-center text-xs text-[#A1A1AA]">Loading Trades...</div>
        ) : trades.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#A1A1AA] bg-[#1C1C1F]/40 rounded-xl border border-[#2E2E34]">
            No trades created yet. Add one above.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {trades.map((t) => (
              <div
                key={t.id}
                className="flex items-start justify-between rounded-xl border border-[#2E2E34] bg-[#1C1C1F] p-4 shadow-md gap-3"
              >
                <div className="flex-1 min-w-0">
                  <h5 className="text-sm font-bold text-white truncate">{t.name}</h5>
                  <p className="mt-1 text-xs text-[#A1A1AA] line-clamp-2">{t.description || "No description."}</p>
                  
                  <div className="mt-3 flex items-center space-x-2 text-[10px] font-mono text-[#EAEAE6]">
                    <span className="rounded bg-[#EAEAE6]/10 px-2 py-0.5 border border-[#EAEAE6]/20">Level 3</span>
                    <span className="rounded bg-[#EAEAE6]/10 px-2 py-0.5 border border-[#EAEAE6]/20">Level 4</span>
                    <span className="rounded bg-[#EAEAE6]/10 px-2 py-0.5 border border-[#EAEAE6]/20">Level 5</span>
                  </div>
                </div>

                <div className="shrink-0 pt-0.5">
                  {confirmDeleteId === t.id ? (
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => executeDelete(t.id)}
                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 transition-all shadow-md flex items-center space-x-1"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-lg bg-[#2E2E34] px-2.5 py-1.5 text-xs text-[#EAEAE6] hover:text-white transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(t.id)}
                      title="Delete Academic Trade"
                      className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-rose-400 hover:bg-rose-500 hover:text-white transition-all shadow-md cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
