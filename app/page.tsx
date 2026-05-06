"use client";

import { useEffect, useState, useCallback } from "react";
import { Activity, TrendingUp, TrendingDown, Wallet, Zap, ShieldCheck, BarChart3, RefreshCw } from "lucide-react";
import { PositionCard } from "@/components/PositionCard";
import { ActivityFeed } from "@/components/ActivityFeed";
import { BotControlPanel } from "@/components/BotControl";

const REFRESH_INTERVAL = 30_000; // 30 detik

export default function Dashboard() {
  const [status, setStatus] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000);

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, logsRes] = await Promise.all([
        fetch('/api/bot/status', { cache: 'no-store' }),
        fetch('/api/bot/logs', { cache: 'no-store' }),
      ]);
      const [statusData, logsData] = await Promise.all([statusRes.json(), logsRes.json()]);
      setStatus(statusData);
      setLogs(logsData.logs || []);
      setLastUpdate(new Date());
      setCountdown(REFRESH_INTERVAL / 1000);
    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Countdown timer
  useEffect(() => {
    const t = setInterval(() => setCountdown(c => c > 0 ? c - 1 : REFRESH_INTERVAL / 1000), 1000);
    return () => clearInterval(t);
  }, [lastUpdate]);

  const equity = status?.equity;
  const perf = status?.performance;
  const positions = status?.positions || [];
  const isOnline = status?.botSettings?.isBotEnabled ?? false;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black tracking-tight uppercase">Alpha Omega</h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">Bot Trading Dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full border ${isOnline ? 'border-green-500/30 text-green-400 bg-green-500/10' : 'border-red-500/30 text-red-400 bg-red-500/10'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </div>
          <button onClick={fetchData} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-all">
            <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !status ? (
        <div className="flex items-center justify-center h-64 text-zinc-600 text-sm">Memuat data...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Kolom Kiri */}
          <div className="lg:col-span-2 space-y-4">

            {/* Equity Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Total Equity"
                value={`Rp ${Math.round(equity?.total || 0).toLocaleString('id-ID')}`}
                icon={<Wallet className="w-4 h-4" />}
                accent="blue"
              />
              <StatCard
                label="Saldo IDR"
                value={`Rp ${Math.round(equity?.idr || 0).toLocaleString('id-ID')}`}
                icon={<Zap className="w-4 h-4" />}
                accent="zinc"
              />
              <StatCard
                label="Total PnL"
                value={`Rp ${Math.round(perf?.totalPnl || 0).toLocaleString('id-ID')}`}
                icon={(perf?.totalPnl || 0) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                accent={(perf?.totalPnl || 0) >= 0 ? 'green' : 'red'}
              />
              <StatCard
                label="Win Rate"
                value={`${(perf?.winRate || 0).toFixed(1)}%`}
                sub={`${perf?.totalTrades || 0} trades`}
                icon={<BarChart3 className="w-4 h-4" />}
                accent={(perf?.winRate || 0) >= 50 ? 'green' : 'orange'}
              />
            </div>

            {/* Open Positions */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-zinc-400" /> Posisi Terbuka
                </h2>
                <span className="text-[10px] text-zinc-500">{positions.length} aktif</span>
              </div>
              {positions.length === 0 ? (
                <p className="text-zinc-600 text-xs text-center py-6">Tidak ada posisi terbuka</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {positions.map((pos: any) => <PositionCard key={pos.id} pos={pos} />)}
                </div>
              )}
            </div>

            {/* Wallet Assets */}
            {(equity?.assets?.length > 0) && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <h2 className="text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-zinc-400" /> Aset di Wallet
                </h2>
                <div className="space-y-2">
                  {equity.assets.map((a: any) => (
                    <div key={a.coin} className="flex items-center justify-between text-xs">
                      <span className="font-bold text-zinc-300">{a.coin}</span>
                      <span className="text-zinc-500">{a.amount.toFixed(4)}</span>
                      <span className="font-bold">Rp {Math.round(a.value).toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Kolom Kanan */}
          <div className="space-y-4">
            {/* Bot Control */}
            <BotControlPanel settings={status?.botSettings} />

            {/* Activity Feed */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-4 h-4 text-zinc-400" /> Activity Log
                </h2>
                <span className="text-[9px] text-zinc-600">Refresh {countdown}s</span>
              </div>
              <ActivityFeed logs={logs} />
            </div>
          </div>

        </div>
      )}

      {lastUpdate && (
        <p className="text-center text-[9px] text-zinc-700 mt-6 uppercase tracking-widest">
          Last update: {lastUpdate.toLocaleTimeString('id-ID')}
        </p>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, icon, accent }: { label: string; value: string; sub?: string; icon: any; accent: string }) {
  const colors: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    green: 'text-green-400 bg-green-500/10 border-green-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    zinc: 'text-zinc-400 bg-zinc-800 border-zinc-700',
  };
  return (
    <div className={`rounded-xl border p-3 space-y-2 ${colors[accent]}`}>
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-widest opacity-70">{label}</span>
        <span className="opacity-60">{icon}</span>
      </div>
      <div className="font-black text-sm text-white">{value}</div>
      {sub && <div className="text-[9px] opacity-50">{sub}</div>}
    </div>
  );
}
