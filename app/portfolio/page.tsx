"use client";

import { useEffect, useState } from "react";
import { CandlestickChart } from "@/components/CandlestickChart";
import { PositionCard } from "@/components/PositionCard";
import { Wallet, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";

export default function PortfolioPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = () => {
    setLoading(true);
    fetch('/api/bot/status', { cache: 'no-store' })
      .then(r => r.json())
      .then(setStatus)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStatus();
    const t = setInterval(fetchStatus, 30_000);
    return () => clearInterval(t);
  }, []);

  const equity = status?.equity;
  const positions = status?.positions || [];
  const perf = status?.performance;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black uppercase tracking-tight">Portfolio</h1>
        <button onClick={fetchStatus} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Equity Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Equity', value: `Rp ${Math.round(equity?.total || 0).toLocaleString('id-ID')}`, icon: <Wallet className="w-4 h-4" />, color: 'text-blue-400' },
          { label: 'Saldo IDR', value: `Rp ${Math.round(equity?.idr || 0).toLocaleString('id-ID')}`, icon: <Wallet className="w-4 h-4" />, color: 'text-zinc-300' },
          { label: 'Total PnL', value: `Rp ${Math.round(perf?.totalPnl || 0).toLocaleString('id-ID')}`, icon: (perf?.totalPnl || 0) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />, color: (perf?.totalPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Win Rate', value: `${(perf?.winRate || 0).toFixed(1)}%`, icon: <TrendingUp className="w-4 h-4" />, color: (perf?.winRate || 0) >= 50 ? 'text-green-400' : 'text-red-400' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
            <div className="flex items-center justify-between mb-2 opacity-50">{icon}<span className="text-[9px] uppercase tracking-widest">{label}</span></div>
            <div className={`font-black text-sm ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Candlestick Chart */}
      <CandlestickChart />

      {/* Open Positions */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">Posisi Terbuka</h2>
          <span className="text-[10px] text-zinc-500">{positions.length} aktif</span>
        </div>
        {positions.length === 0 ? (
          <p className="text-zinc-600 text-xs text-center py-6">Tidak ada posisi terbuka</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {positions.map((pos: any) => <PositionCard key={pos.id} pos={pos} />)}
          </div>
        )}
      </div>

      {/* Wallet Assets */}
      {equity?.assets?.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-3">Aset di Wallet</h2>
          <div className="space-y-2">
            {equity.assets.map((a: any) => (
              <div key={a.coin} className="flex items-center justify-between text-xs">
                <span className="font-black text-zinc-200 w-16">{a.coin}</span>
                <div className="flex-1 mx-3 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500/60 rounded-full"
                    style={{ width: `${Math.min(100, (a.value / (equity.total || 1)) * 100)}%` }} />
                </div>
                <span className="text-zinc-400 w-24 text-right">{a.amount.toFixed(4)}</span>
                <span className="font-bold w-28 text-right">Rp {Math.round(a.value).toLocaleString('id-ID')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
