"use client";

import { useEffect, useState } from "react";
import { Save, Power } from "lucide-react";
import { updateBotSettings, toggleBotPower } from "@/app/actions";

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/bot/status').then(r => r.json()).then(d => setSettings(d.botSettings));
  }, []);

  const save = async () => {
    setSaving(true);
    await updateBotSettings({
      riskPerTrade: Number(settings.riskPerTrade),
      maxOpenPositions: Number(settings.maxOpenPositions),
      dailyLossLimit: Number(settings.dailyLossLimit),
      strategyMode: settings.strategyMode,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggle = async () => {
    await toggleBotPower();
    setSettings((s: any) => ({ ...s, isBotEnabled: !s.isBotEnabled }));
  };

  if (!settings) return <div className="flex items-center justify-center h-64 text-zinc-600 text-sm">Memuat settings...</div>;

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-black uppercase tracking-tight">Settings</h1>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-5">

        {/* Power Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-sm">Bot Status</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Aktifkan atau matikan bot</div>
          </div>
          <button onClick={toggle}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${
              settings.isBotEnabled
                ? 'bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500 hover:text-white'
                : 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white'
            }`}>
            <Power className="w-3 h-3" />
            {settings.isBotEnabled ? 'Online' : 'Offline'}
          </button>
        </div>

        <hr className="border-zinc-800" />

        {/* Strategy Mode */}
        <div className="space-y-2">
          <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Strategy Mode</label>
          <div className="grid grid-cols-3 gap-2">
            {['SURVIVAL', 'WAR', 'SNIPER'].map(m => (
              <button key={m} onClick={() => setSettings((s: any) => ({ ...s, strategyMode: m }))}
                className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  settings.strategyMode === m ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                }`}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Risk Per Trade */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Risk Per Trade</label>
            <span className="text-[10px] font-black text-white">{settings.riskPerTrade}%</span>
          </div>
          <input type="range" min="1" max="10" step="0.5" value={settings.riskPerTrade}
            onChange={e => setSettings((s: any) => ({ ...s, riskPerTrade: e.target.value }))}
            className="w-full accent-orange-500" />
          <div className="flex justify-between text-[9px] text-zinc-600"><span>1%</span><span>10%</span></div>
        </div>

        {/* Max Positions */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Max Open Positions</label>
            <span className="text-[10px] font-black text-white">{settings.maxOpenPositions}</span>
          </div>
          <input type="range" min="1" max="10" step="1" value={settings.maxOpenPositions}
            onChange={e => setSettings((s: any) => ({ ...s, maxOpenPositions: e.target.value }))}
            className="w-full accent-orange-500" />
          <div className="flex justify-between text-[9px] text-zinc-600"><span>1</span><span>10</span></div>
        </div>

        {/* Daily Loss Limit */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Daily Loss Limit</label>
            <span className="text-[10px] font-black text-white">{settings.dailyLossLimit}%</span>
          </div>
          <input type="range" min="1" max="20" step="0.5" value={settings.dailyLossLimit}
            onChange={e => setSettings((s: any) => ({ ...s, dailyLossLimit: e.target.value }))}
            className="w-full accent-orange-500" />
          <div className="flex justify-between text-[9px] text-zinc-600"><span>1%</span><span>20%</span></div>
        </div>

        <button onClick={save} disabled={saving}
          className="w-full py-3 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-black font-black text-[10px] uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2">
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Menyimpan...' : saved ? '✓ Tersimpan!' : 'Simpan Settings'}
        </button>
      </div>
    </div>
  );
}
