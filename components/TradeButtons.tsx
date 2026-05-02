"use client";

import { useState } from "react";
import { Zap, Target, AlertCircle } from "lucide-react";
import { executeSniperAction, panicSellAction, emergencyExitAll } from "@/app/actions";

export function SniperButton({ analysisId }: { analysisId: string }) {
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!confirm("Konfirmasi Eksekusi SNIPER ENTRY?")) return;
    setLoading(true);
    const res = await executeSniperAction(analysisId);
    alert(res.message);
    setLoading(false);
  };

  return (
    <button 
      onClick={handle}
      disabled={loading}
      className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-[0.2em] shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50 relative overflow-hidden group"
    >
      <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
      {loading ? (
        <span className="animate-pulse">EXECUTING PROTOCOL...</span>
      ) : (
        <><Target className="w-4 h-4" /> Initialize Sniper Entry</>
      )}
    </button>
  );
}

export function PanicSellButton({ analysisId }: { analysisId: string }) {
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!confirm("Konfirmasi PANIC SELL untuk aset ini?")) return;
    setLoading(true);
    const res = await panicSellAction(analysisId);
    alert(res.message);
    setLoading(false);
  };

  return (
    <div className="flex items-center gap-2">
      <button 
        onClick={handle}
        disabled={loading}
        className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-[9px] font-black text-red-500 hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest disabled:opacity-50 active:scale-95"
      >
        {loading ? "..." : "Panic Sell"}
      </button>
      <ForceCloseButton analysisId={analysisId} />
    </div>
  );
}

export function ForceCloseButton({ analysisId }: { analysisId: string }) {
  const [loading, setLoading] = useState(false);
  const { forceCloseAction } = require("@/app/actions"); // Dynamic import to avoid SSR issues if needed

  const handle = async () => {
    if (!confirm("HAPUS DATA? (Hanya membersihkan dashboard, tidak menjual koin)")) return;
    setLoading(true);
    const res = await forceCloseAction(analysisId);
    if (res.success) window.location.reload();
    else alert(res.message);
    setLoading(false);
  };

  return (
    <button 
      onClick={handle}
      disabled={loading}
      title="Force Close (Database Only)"
      className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg transition-all disabled:opacity-50"
    >
      <AlertCircle className="w-3.5 h-3.5" />
    </button>
  );
}

export function EmergencyAllButton() {
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!confirm("PERINGATAN KRITIS: Jual SEMUA aset di portfolio sekarang?")) return;
    setLoading(true);
    const res = await emergencyExitAll();
    alert(res.success ? "Emergency Exit Complete!" : res.message);
    setLoading(false);
  };

  return (
    <button 
      onClick={handle}
      disabled={loading}
      className="w-full py-3 bg-red-600/10 border border-red-600/20 text-red-500 text-[10px] font-black rounded-xl hover:bg-red-600 hover:text-white transition-all uppercase tracking-widest disabled:opacity-50 active:scale-[0.98]"
    >
      {loading ? "TERMINATING ALL POSITIONS..." : "Execute Emergency Kill-Switch"}
    </button>
  );
}
