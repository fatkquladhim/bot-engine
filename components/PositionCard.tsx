"use client";

import { TrendingUp, TrendingDown, Target, ShieldAlert } from "lucide-react";

export function PositionCard({ pos }: { pos: any }) {
  const pnl = pos.floatingPnlPct ?? 0;
  const isProfit = pnl >= 0;
  const progress = pos.entryPrice && pos.targetPrice1
    ? Math.min(100, Math.max(0, ((pos.currentPrice - pos.entryPrice) / (pos.targetPrice1 - pos.entryPrice)) * 100))
    : 0;

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${isProfit ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
      <div className="flex items-center justify-between">
        <span className="font-black text-sm uppercase tracking-widest">
          {pos.assetName?.replace('_idr', '').toUpperCase()}
        </span>
        <span className={`text-sm font-black ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
          {isProfit ? '+' : ''}{pnl.toFixed(2)}%
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[10px] text-zinc-400">
        <div>
          <div className="text-zinc-600 uppercase tracking-widest mb-0.5">Entry</div>
          <div className="font-bold text-white">Rp {pos.entryPrice?.toLocaleString('id-ID')}</div>
        </div>
        <div>
          <div className="text-zinc-600 uppercase tracking-widest mb-0.5">Now</div>
          <div className={`font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
            Rp {pos.currentPrice?.toLocaleString('id-ID')}
          </div>
        </div>
        <div>
          <div className="text-zinc-600 uppercase tracking-widest mb-0.5">TP1</div>
          <div className="font-bold text-zinc-300">Rp {pos.targetPrice1?.toLocaleString('id-ID')}</div>
        </div>
      </div>

      {/* Progress bar entry → TP1 */}
      <div className="space-y-1">
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isProfit ? 'bg-green-500' : 'bg-red-500'}`}
            style={{ width: `${Math.max(2, progress)}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-zinc-600">
          <span className="flex items-center gap-1"><ShieldAlert className="w-2.5 h-2.5" /> SL {pos.stopLoss?.toLocaleString('id-ID')}</span>
          <span className="flex items-center gap-1"><Target className="w-2.5 h-2.5" /> TP {pos.targetPrice1?.toLocaleString('id-ID')}</span>
        </div>
      </div>
    </div>
  );
}
