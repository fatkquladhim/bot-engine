"use client";

import { useState } from "react";
import { Power, Settings, Shield, Zap, Target, RefreshCw } from "lucide-react";
import { toggleBotPower, updateBotSettings } from "@/app/actions";

export function BotControlPanel({ settings }: { settings: any }) {
  const [loading, setLoading] = useState(false);
  const [currentMode, setCurrentMode] = useState(settings?.strategyMode || "SURVIVAL");

  const togglePower = async () => {
    setLoading(true);
    await toggleBotPower();
    setLoading(false);
  };

  const changeMode = async (mode: string) => {
    setLoading(true);
    await updateBotSettings({ strategyMode: mode });
    setCurrentMode(mode);
    setLoading(false);
  };

  const isEnabled = settings?.isBotEnabled ?? true;

  return (
    <div className="card space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-zinc-400" />
          <h2 className="text-lg font-black tracking-tight uppercase">Bot Control</h2>
        </div>
        <button 
          onClick={togglePower}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${
            isEnabled 
              ? 'bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500 hover:text-white' 
              : 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white'
          }`}
        >
          <Power className="w-3 h-3" />
          {isEnabled ? "System Online" : "System Offline"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button 
          onClick={() => changeMode("SURVIVAL")}
          className={`p-3 rounded-xl border transition-all flex flex-col gap-2 ${
            currentMode === "SURVIVAL" 
              ? 'bg-blue-500/10 border-blue-500/50 text-blue-500' 
              : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">Survival</span>
        </button>
        <button 
          onClick={() => changeMode("WAR")}
          className={`p-3 rounded-xl border transition-all flex flex-col gap-2 ${
            currentMode === "WAR" 
              ? 'bg-orange-500/10 border-orange-500/50 text-orange-500' 
              : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">War Mode</span>
        </button>
      </div>

      <div className="space-y-4 pt-4 border-t border-zinc-800">
        <div className="flex justify-between items-center text-[10px] font-bold">
          <span className="text-zinc-500 uppercase tracking-widest">Risk Per Trade</span>
          <span className="text-white">{settings?.riskPerTrade || 2}%</span>
        </div>
        <div className="flex justify-between items-center text-[10px] font-bold">
          <span className="text-zinc-500 uppercase tracking-widest">Max Positions</span>
          <span className="text-white">{settings?.maxOpenPositions || 3}</span>
        </div>
        <div className="flex justify-between items-center text-[10px] font-bold">
          <span className="text-zinc-500 uppercase tracking-widest">Daily Loss Cap</span>
          <span className="text-white">{settings?.dailyLossLimit || 5}%</span>
        </div>
      </div>

      <button 
        onClick={() => {
          setLoading(true);
          // Mengasumsikan ada endpoint API yang sudah di-set untuk memicu scan bot,
          // atau fungsi eksternal Vercel Cron.
          fetch('/api/bot/scan', { method: 'POST' }).finally(() => setLoading(false));
        }}
        disabled={loading}
        className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-black rounded-lg transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> 
        {loading ? "Scanning..." : "Force Scan Cycle"}
      </button>
    </div>
  );
}
