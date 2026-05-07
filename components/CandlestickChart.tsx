"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType } from "lightweight-charts";

const PAIRS = ['btc_idr', 'eth_idr', 'doge_idr', 'pepe_idr', 'sol_idr', 'fartcoin_idr', 'zerebro_idr', 'pippin_idr'];
const RESOLUTIONS = [
  { label: '1H', value: '60' },
  { label: '4H', value: '240' },
  { label: '1D', value: 'D' },
];

export function CandlestickChart() {
  const chartRef = useRef<HTMLDivElement>(null);
  const [pair, setPair] = useState('btc_idr');
  const [resolution, setResolution] = useState('60');
  const [loading, setLoading] = useState(false);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = createChart(chartRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#09090b' }, textColor: '#71717a' },
      grid: { vertLines: { color: '#18181b' }, horzLines: { color: '#18181b' } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#27272a' },
      timeScale: { borderColor: '#27272a', timeVisible: true },
      width: chartRef.current.clientWidth,
      height: 320,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e', downColor: '#ef4444',
      borderUpColor: '#22c55e', borderDownColor: '#ef4444',
      wickUpColor: '#22c55e', wickDownColor: '#ef4444',
    });

    const volumeSeries = chart.addHistogramSeries({
      color: '#3f3f46', priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    setLoading(true);
    fetch(`/api/bot/candles?pair=${pair}&resolution=${resolution}`)
      .then(r => r.json())
      .then(({ candles }) => {
        if (!candles?.length) return;
        candleSeries.setData(candles);
        volumeSeries.setData(candles.map((c: any) => ({
          time: c.time,
          value: c.volume,
          color: c.close >= c.open ? '#22c55e33' : '#ef444433',
        })));
        chart.timeScale().fitContent();

        const last = candles[candles.length - 1];
        const first = candles[0];
        setLastPrice(last.close);
        setPriceChange(((last.close - first.open) / first.open) * 100);
      })
      .finally(() => setLoading(false));

    const handleResize = () => chart.applyOptions({ width: chartRef.current?.clientWidth || 600 });
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [pair, resolution]);

  const isUp = (priceChange || 0) >= 0;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <select value={pair} onChange={e => setPair(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-white text-xs font-bold rounded-lg px-3 py-1.5 uppercase focus:outline-none">
            {PAIRS.map(p => <option key={p} value={p}>{p.replace('_idr', '').toUpperCase()}/IDR</option>)}
          </select>
          <div className="flex gap-1">
            {RESOLUTIONS.map(r => (
              <button key={r.value} onClick={() => setResolution(r.value)}
                className={`px-2.5 py-1 rounded text-[10px] font-black uppercase transition-all ${resolution === r.value ? 'bg-orange-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {lastPrice && (
          <div className="flex items-center gap-2">
            <span className="font-black text-sm text-white">Rp {lastPrice.toLocaleString('id-ID')}</span>
            <span className={`text-xs font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
              {isUp ? '+' : ''}{priceChange?.toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 z-10 rounded-lg">
            <span className="text-zinc-500 text-xs">Memuat chart...</span>
          </div>
        )}
        <div ref={chartRef} className="w-full" />
      </div>
    </div>
  );
}
