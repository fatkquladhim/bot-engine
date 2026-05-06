"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

const FILTERS = ['all', 'profit', 'loss'] as const;

export default function HistoryPage() {
  const [data, setData] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'profit' | 'loss'>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setData(null);
    fetch(`/api/bot/history?filter=${filter}&page=${page}`)
      .then(r => r.json()).then(setData);
  }, [filter, page]);

  const s = data?.summary;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-black uppercase tracking-tight">Trade History</h1>

      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Trades', value: s.totalTrades, color: '' },
            { label: 'Win Rate', value: `${s.winRate.toFixed(1)}%`, color: s.winRate >= 50 ? 'text-green-400' : 'text-red-400' },
            { label: 'Total PnL', value: `Rp ${Math.round(s.totalPnl).toLocaleString('id-ID')}`, color: s.totalPnl >= 0 ? 'text-green-400' : 'text-red-400' },
            { label: 'Best Trade', value: `Rp ${Math.round(s.bestTrade).toLocaleString('id-ID')}`, color: 'text-green-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">{label}</div>
              <div className={`font-black text-sm ${color || 'text-white'}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {FILTERS.map(f => (
          <button key={f} onClick={() => { setFilter(f); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900">
              {['Pair', 'Status', 'Entry', 'Exit', 'PnL (Rp)', 'PnL (%)', 'Tanggal'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-[9px] text-zinc-500 uppercase tracking-widest font-bold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!data && <tr><td colSpan={7} className="text-center py-8 text-zinc-600">Memuat...</td></tr>}
            {data?.trades?.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-zinc-600">Tidak ada data</td></tr>}
            {data?.trades?.map((t: any) => {
              const isProfit = t.status === 'PROFIT';
              return (
                <tr key={t.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                  <td className="px-4 py-3 font-bold uppercase">{t.assetName?.replace('_idr', '')}</td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1 font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                      {isProfit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{t.entryPrice?.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3 text-zinc-400">{t.exitPrice?.toLocaleString('id-ID') || '-'}</td>
                  <td className={`px-4 py-3 font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                    {t.realizedPnlIdr != null ? `${isProfit ? '+' : ''}${Math.round(t.realizedPnlIdr).toLocaleString('id-ID')}` : '-'}
                  </td>
                  <td className={`px-4 py-3 font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                    {t.pnlPercent != null ? `${isProfit ? '+' : ''}${t.pnlPercent.toFixed(2)}%` : '-'}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {new Date(t.updatedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data?.pagination?.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs disabled:opacity-30 hover:bg-zinc-700">←</button>
          <span className="text-xs text-zinc-500">{page} / {data.pagination.pages}</span>
          <button onClick={() => setPage(p => Math.min(data.pagination.pages, p + 1))} disabled={page === data.pagination.pages}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs disabled:opacity-30 hover:bg-zinc-700">→</button>
        </div>
      )}
    </div>
  );
}
