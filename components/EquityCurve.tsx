"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

export function EquityCurve({ data }: { data: { date: string; equity: number }[] }) {
  if (!data?.length) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-600 text-xs">
        Belum ada data equity. Bot perlu jalan beberapa hari untuk mengisi grafik ini.
      </div>
    );
  }

  const first = data[0].equity;
  const last = data[data.length - 1].equity;
  const isUp = last >= first;
  const change = ((last - first) / first) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-3">
        <span className="text-2xl font-black text-white">Rp {Math.round(last).toLocaleString('id-ID')}</span>
        <span className={`text-sm font-bold mb-0.5 ${isUp ? 'text-green-400' : 'text-red-400'}`}>
          {isUp ? '+' : ''}{change.toFixed(2)}%
        </span>
        <span className="text-xs text-zinc-500 mb-0.5">dari awal</span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={isUp ? '#22c55e' : '#ef4444'} stopOpacity={0.3} />
              <stop offset="95%" stopColor={isUp ? '#22c55e' : '#ef4444'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#52525b' }}
            tickFormatter={d => d.slice(5)} />
          <YAxis tick={{ fontSize: 9, fill: '#52525b' }}
            tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
            domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 11 }}
            formatter={(v: any) => [`Rp ${Math.round(v).toLocaleString('id-ID')}`, 'Equity']}
            labelFormatter={l => `Tanggal: ${l}`}
          />
          <ReferenceLine y={first} stroke="#52525b" strokeDasharray="3 3" />
          <Area type="monotone" dataKey="equity" stroke={isUp ? '#22c55e' : '#ef4444'}
            strokeWidth={2} fill="url(#equityGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
