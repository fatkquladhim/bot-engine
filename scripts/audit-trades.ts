import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/db/prisma';

async function main() {
  console.log('\n========================================');
  console.log('  TRADE HISTORY & PORTFOLIO REPORT');
  console.log('========================================\n');

  // 1. All trades
  const trades = await prisma.analysis.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  console.log(`Total trades in DB: ${trades.length}`);
  console.log('');

  if (trades.length === 0) {
    console.log('⚠️  Belum ada data trade di database.');
  } else {
    // Stats
    const total = trades.length;
    const open = trades.filter(t => t.status === 'OPEN').length;
    const trading = trades.filter(t => t.status === 'TRADING').length;
    const profit = trades.filter(t => t.status === 'PROFIT').length;
    const loss = trades.filter(t => t.status === 'LOSS').length;
    const cancelled = trades.filter(t => t.status === 'CANCELLED').length;

    const totalPnl = trades.reduce((sum, t) => sum + (t.realizedPnlIdr || 0), 0);
    const winRate = total > 0 ? ((profit / (profit + loss)) * 100).toFixed(1) : '0';

    console.log('📊 PORTFOLIO SUMMARY');
    console.log('────────────────────');
    console.log(`  Status: ${open} OPEN | ${trading} TRADING | ${profit} PROFIT | ${loss} LOSS | ${cancelled} CANCELLED`);
    console.log(`  Win Rate : ${winRate}%`);
    console.log(`  Total PnL: Rp ${totalPnl.toLocaleString('id-ID')}`);
    console.log(`  Avg PnL  : Rp ${(totalPnl / total).toLocaleString('id-ID')} / trade`);
    console.log('');

    // Recent trades
    console.log('📋 RECENT TRADES (Last 20)');
    console.log('─────────────────────────');
    const recent = trades.slice(0, 20);
    for (const t of recent) {
      const pnlStr = t.realizedPnlIdr
        ? `${t.realizedPnlIdr > 0 ? '+' : ''}Rp ${t.realizedPnlIdr.toLocaleString('id-ID')}`
        : '-';
      const pnlPctStr = t.pnlPercent
        ? `${t.pnlPercent > 0 ? '+' : ''}${t.pnlPercent.toFixed(2)}%`
        : '-';
      const statusIcon = t.status === 'PROFIT' ? '🟢' : t.status === 'LOSS' ? '🔴' : t.status === 'TRADING' ? '🟡' : '⚪';
      console.log(`  ${statusIcon} ${t.assetName?.toUpperCase().padEnd(14)} | Entry: Rp ${(t.entryPrice || 0).toLocaleString('id-ID').padStart(12)} | Exit: Rp ${(t.exitPrice || 0).toLocaleString('id-ID').padStart(12)} | ${pnlPctStr.padStart(10)} | ${pnlStr.padStart(16)} | ${t.createdAt.toLocaleDateString()}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
