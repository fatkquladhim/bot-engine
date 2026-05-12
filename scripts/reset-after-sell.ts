import * as dotenv from 'dotenv';
dotenv.config();
import { prisma } from '../src/db/prisma';

async function main() {
  console.log('🧹 RESET STATE BOT — Semua data trade lama dihapus\n');

  // 1. Hapus semua analysis
  const deleted = await prisma.analysis.deleteMany({});
  console.log(`   ✅ ${deleted.count} analysis dihapus`);

  // 2. Hapus activity log
  const logs = await (prisma as any).activityLog.deleteMany({});
  console.log(`   ✅ ${logs.count} activity log dihapus`);

  // 3. Reset bot settings ke default
  await (prisma as any).botSettings.upsert({
    where: { id: 'global' },
    update: {
      isBotEnabled: true,
      strategyMode: 'SURVIVAL',
      riskPerTrade: 1,
      maxOpenPositions: 3,
      dailyLossLimit: 5,
    },
    create: {
      id: 'global',
      isBotEnabled: true,
      strategyMode: 'SURVIVAL',
      riskPerTrade: 1,
      maxOpenPositions: 3,
      dailyLossLimit: 5,
    }
  });
  console.log(`   ✅ Bot settings direset ke SURVIVAL mode`);

  // 4. Hapus chat & performance (biar bersih)
  await (prisma as any).chatMessage.deleteMany({});
  await (prisma as any).chatSession.deleteMany({});
  await (prisma as any).dailyPerformance.deleteMany({});
  console.log(`   ✅ Chat & performance history dihapus`);

  console.log('\n✅ SELESAI! Sekarang tinggal restart bot.');
  console.log('   pm2 restart alpha-bot --update-env');

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
