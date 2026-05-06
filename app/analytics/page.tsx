"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/bot/analytics').then(r => r.json()).then(setData);
  }, []);

  if (!data) return <div className="flex items-center justify-center h-64 text-zinc-600 text-sm">Memuat analytics...</div>;

  const { dailyPnl, topPairs } = data;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-black uppercase tracking-tight">Analytics</h1>

      {/* Daily PnL Chart */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4">PnL Harian (14 Hari)</h2>
        {dailyPnl?.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyPnl} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#52525b' }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 9, fill: '#52525b' }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 11 }}
                formatter={(v: any) => [`Rp ${Math.round(v).toLocaleString('id-ID')}`, 'PnL']}
                labelFormatter={l => `Tanggal: ${l}`}
              />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {dailyPnl.map((entry: any, i: number) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-zinc-600 text-xs text-center py-8">Belum ada data trade</p>
        )}
      </div>

      {/* Top Pairs */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4">Top Pairs by PnL</h2>
        {topPairs?.length > 0 ? (
          <div className="space-y-2">
            {topPairs.map((p: any) => (
              <div key={p.pair} className="flex items-center gap-3">
                <span className="font-black text-xs w-20 uppercase">{p.pair}</span>
                <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${p.pnl >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, Math.abs(p.pnl) / Math.max(...topPairs.map((x: any) => Math.abs(x.pnl)), 1) * 100)}%` }}
                  />
                </div>
                <span className={`text-xs font-bold w-28 text-right ${p.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {p.pnl >= 0 ? '+' : ''}Rp {Math.round(p.pnl).toLocaleString('id-ID')}
                </span>
                <span className="text-[10px] text-zinc-500 w-16 text-right">
                  {p.wins}W / {p.losses}L
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-600 text-xs text-center py-8">Belum ada data</p>
        )}
      </div>
    </div>
  );
}
