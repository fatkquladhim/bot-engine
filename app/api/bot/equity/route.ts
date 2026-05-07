import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Ambil dari DailyPerformance jika ada
  const daily = await (prisma as any).dailyPerformance.findMany({
    orderBy: { date: 'asc' },
    take: 60,
  }).catch(() => []);

  if (daily.length > 0) {
    const curve = daily.map((d: any) => ({
      date: new Date(d.date).toISOString().split('T')[0],
      equity: d.endEquity,
      pnl: d.totalPnlIdr,
    }));
    return NextResponse.json({ curve });
  }

  // Fallback: rekonstruksi dari trade history
  const trades = await (prisma as any).analysis.findMany({
    where: { status: { in: ['PROFIT', 'LOSS'] } },
    orderBy: { updatedAt: 'asc' },
    select: { updatedAt: true, realizedPnlIdr: true, status: true },
  });

  // Mulai dari equity awal (estimasi dari data yang ada)
  let equity = 500000; // default jika tidak ada data
  const byDay: Record<string, number> = {};

  for (const t of trades) {
    const day = new Date(t.updatedAt).toISOString().split('T')[0];
    equity += (t.realizedPnlIdr || 0);
    byDay[day] = equity;
  }

  const curve = Object.entries(byDay).map(([date, eq]) => ({ date, equity: eq, pnl: 0 }));
  return NextResponse.json({ curve });
}
