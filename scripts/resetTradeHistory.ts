import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

const pool = new pg.Pool({ 
  connectionString,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

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

    // 3. Get remaining open positions
    const openPositions = await prisma.analysis.findMany({
      where: { status: { in: ['OPEN', 'TRADING'] } }
    });
    console.log(`\n📊 Remaining Open Positions: ${openPositions.length}`);
    openPositions.forEach(p => {
      console.log(`   - ${p.assetName}: ${p.status} @ Rp ${p.entryPrice}`);
    });

    console.log(`\n📈 [RESET STATS]`);
    console.log(`   Total Trades   : 0`);
    console.log(`   Winning Trades: 0`);
    console.log(`   Win Rate      : 0%`);
    console.log(`   Total PnL     : Rp 0`);
    console.log(`   Expectancy   : Rp 0`);

    console.log('\n✅ Trade History Reset Complete!');
    console.log('   Next run: Bot akan mulai fresh dengan stats = 0\n');

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
