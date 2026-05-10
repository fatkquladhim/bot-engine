import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetTradeHistory() {
  console.log('🔄 [RESET TRADE HISTORY] Memulai reset...\n');

  try {
    // 1. Delete all history trades (PROFIT, LOSS, CANCELLED)
    const deletedHistory = await prisma.analysis.deleteMany({
      where: {
        status: { in: ['PROFIT', 'LOSS', 'CANCELLED'] }
      }
    });
    console.log(`✅ Deleted ${deletedHistory.count} history trades`);

    // 2. Reset Daily Performance records
    const deletedPerformance = await prisma.dailyPerformance.deleteMany({});
    console.log(`✅ Deleted ${deletedPerformance.count} daily performance records`);

    // 3. Reset Activity Logs (optional - keeping for debugging)
    // const deletedLogs = await prisma.activityLog.deleteMany({});
    // console.log(`✅ Deleted ${deletedLogs.count} activity logs`);

    // 4. Get remaining open positions
    const openPositions = await prisma.analysis.findMany({
      where: { status: { in: ['OPEN', 'TRADING'] } }
    });
    console.log(`\n📊 Remaining Open Positions: ${openPositions.length}`);
    openPositions.forEach(p => {
      console.log(`   - ${p.assetName}: ${p.status} @ Rp ${p.entryPrice}`);
    });

    // 5. Calculate new stats (should be 0 after reset)
    const totalTrades = 0;
    const winningTrades = 0;
    const totalPnL = 0;
    const winRate = 0;
    const expectancy = 0;

    console.log(`\n📈 [RESET STATS]`);
    console.log(`   Total Trades   : ${totalTrades}`);
    console.log(`   Winning Trades: ${winningTrades}`);
    console.log(`   Win Rate      : ${winRate}%`);
    console.log(`   Total PnL     : Rp ${totalPnL.toLocaleString()}`);
    console.log(`   Expectancy   : Rp ${expectancy.toLocaleString()}`);

    console.log('\n✅ Trade History Reset Complete!');
    console.log('   Next run: Bot akan mulai fresh dengan stats = 0');
    console.log('   Performance filter akan skip (butuh 20 trades minimum)\n');

  } catch (error) {
    console.error('❌ Error resetting trade history:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

resetTradeHistory()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
