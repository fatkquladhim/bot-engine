"use client";

import { useEffect, useState } from "react";
import { EquityCurve } from "@/components/EquityCurve";
import { PositionCard } from "@/components/PositionCard";
import { Wallet, TrendingUp, TrendingDown, RefreshCw, BarChart3, Target } from "lucide-react";

export default function PortfolioPage() {
  const [status, setStatus] = useState<any>(null);
  const [equityData, setEquityData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/bot/status', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/bot/equity', { cache: 'no-store' }).then(r => r.json()),
    ]).then(([s, e]) => {
      setStatus(s);
      setEquityData(e.curve || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 60_000); // refresh 1 menit
    return () => clearInterval(t);
  }, []);

  const equity = status?.equity;
  const positions = status?.positions || [];
  const perf = status?.performance;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black uppercase tracking-tight">Portfolio</h1>
          <p className="text-[10px] text-zinc-500 mt-0.5">Pergerakan modal kamu dari waktu ke waktu</p>
        </div>
        <button onClick={fetchAll} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Equity Curve */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4">
          📈 Equity Curve — Pergerakan Modal
        </h2>
        {loading && !equityData.length ? (
          <div className="flex items-center justify-center h-48 text-zinc-600 text-xs">Memuat...</div>
        ) : (
          <EquityCurve data={equityData} />
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Equity', value: `Rp ${Math.round(equity?.total || 0).toLocaleString('id-ID')}`, icon: <Wallet className="w-4 h-4" />, color: 'text-blue-400' },
          { label: 'Saldo IDR', value: `Rp ${Math.round(equity?.idr || 0).toLocaleString('id-ID')}`, icon: <Wallet className="w-4 h-4" />, color: 'text-zinc-300' },
          { label: 'Total PnL', value: `${(perf?.totalPnl || 0) >= 0 ? '+' : ''}Rp ${Math.round(perf?.totalPnl || 0).toLocaleString('id-ID')}`, icon: (perf?.totalPnl || 0) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />, color: (perf?.totalPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Win Rate', value: `${(perf?.winRate || 0).toFixed(1)}% (${perf?.totalTrades || 0} trades)`, icon: <Target className="w-4 h-4" />, color: (perf?.winRate || 0) >= 50 ? 'text-green-400' : 'text-orange-400' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
            <div className="flex items-center justify-between mb-2 opacity-50">{icon}
              <span className="text-[9px] uppercase tracking-widest">{label}</span>
            </div>
            <div className={`font-black text-sm ${color}`}>{value}</div>
          </div>
        ))}
      </div>

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
              <div key={a.coin} className="flex items-center gap-3 text-xs">
                <span className="font-black text-zinc-200 w-16">{a.coin}</span>
                <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
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
