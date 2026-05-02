import { prisma } from '../src/db/prisma';

async function updateSettings() {
  console.log('⚙️ Updating Bot Settings to High Growth Mode...');
  
  await prisma.botSettings.upsert({
    where: { id: 'global' },
    update: {
      strategyMode: 'WAR',
      riskPerTrade: 5.0, // 5% Risk per trade for faster compounding
      maxOpenPositions: 5, // Allow more concurrent trades
    },
    create: {
      id: 'global',
      strategyMode: 'WAR',
      riskPerTrade: 5.0,
      maxOpenPositions: 5,
    }
  });

  console.log('✅ Settings Updated:');
  console.log('   ► Mode: WAR');
  console.log('   ► Risk: 5.0%');
  console.log('   ► Max Positions: 5');
}

updateSettings()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
