import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pair = searchParams.get('pair') || 'btc_idr';
  const resolution = searchParams.get('resolution') || '60'; // 60 = 1H

  const symbol = pair.replace('_idr', '').toUpperCase() + 'IDR';
  const now = Math.floor(Date.now() / 1000);
  const from = now - (resolution === 'D' ? 90 : 7) * 24 * 3600;

  try {
    const res = await axios.get('https://indodax.com/tradingview/history', {
      params: { symbol, resolution, from, to: now },
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://indodax.com/' },
      timeout: 8000,
    });

    const d = res.data;
    if (!d || d.s !== 'ok' || !d.t?.length) {
      return NextResponse.json({ candles: [] });
    }

    const candles = d.t.map((t: number, i: number) => ({
      time: t,
      open: parseFloat(d.o[i]),
      high: parseFloat(d.h[i]),
      low: parseFloat(d.l[i]),
      close: parseFloat(d.c[i]),
      volume: parseFloat(d.v?.[i] || '0'),
    }));

    return NextResponse.json({ candles });
  } catch (e: any) {
    return NextResponse.json({ candles: [], error: e.message }, { status: 500 });
  }
}
