"use client";

import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

const PERIODS = [
  { label: '7D',  value: '7' },
  { label: '14D', value: '14' },
  { label: '30D', value: '30' },
  { label: '90D', value: '90' },
  { label: 'All', value: 'all' },
];

export function EquityCurve() {
  const [period, setPeriod] = useState('30');
  const [data, setData] = useState<{ date: string; equity: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/bot/equity?period=${period}`)
      .then(r => r.json())
      .then(d => setData(d.curve || []))
      .finally(() => setLoading(false));
  }, [period]);

  const first = data[0]?.equity || 0;
  const last = data[data.length - 1]?.equity || 0;
  const isUp = last >= first;
  const change = first > 0 ? ((last - first) / first) * 100 : 0;
  const changeIdr = last - first;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-2xl font-black text-white">
            Rp {Math.round(last || 0).toLocaleString('id-ID')}
          </div>
          {data.length > 1 && (
            <div className={`flex items-center gap-2 text-xs mt-0.5 ${isUp ? 'text-green-400' : 'text-red-400'}`}>
              <span className="font-bold">{isUp ? '+' : ''}{change.toFixed(2)}%</span>
              <span className="text-zinc-500">({isUp ? '+' : ''}Rp {Math.round(changeIdr).toLocaleString('id-ID')})</span>
              <span className="text-zinc-600">dalam {period === 'all' ? 'semua waktu' : period + ' hari'}</span>
            </div>
          )}
        </div>

        {/* Timeframe buttons */}
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              className={`px-2.5 py-1 rounded text-[10px] font-black uppercase transition-all ${
                period === p.value
                  ? 'bg-orange-500 text-black'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-zinc-600 text-xs">Memuat...</div>
      ) : data.length < 2 ? (
        <div className="flex items-center justify-center h-48 text-zinc-600 text-xs text-center">
          Belum ada data untuk periode ini.<br />Bot perlu jalan beberapa hari untuk mengisi grafik.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isUp ? '#22c55e' : '#ef4444'} stopOpacity={0.25} />
                <stop offset="95%" stopColor={isUp ? '#22c55e' : '#ef4444'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#52525b' }}
              tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9, fill: '#52525b' }}
              tickFormatter={v => `${(v / 1000).toFixed(0)}k`} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 11 }}
              formatter={(v: any) => [`Rp ${Math.round(v).toLocaleString('id-ID')}`, 'Equity']}
              labelFormatter={l => `Tanggal: ${l}`}
            />
            <ReferenceLine y={first} stroke="#3f3f46" strokeDasharray="4 4" />
            <Area type="monotone" dataKey="equity"
              stroke={isUp ? '#22c55e' : '#ef4444'} strokeWidth={2}
              fill="url(#equityGrad)" dot={false} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
