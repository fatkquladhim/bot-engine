import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('📡 Menghubungkan ke Supabase...');
  
  await prisma.botSettings.upsert({
    where: { id: 'global' },
    update: { 
      riskPerTrade: 3, 
      maxOpenPositions: 4, 
      strategyMode: 'WAR', 
      isBotEnabled: true 
    },
    create: { 
      id: 'global', 
      riskPerTrade: 3, 
      maxOpenPositions: 4, 
      strategyMode: 'WAR', 
      isBotEnabled: true 
    }
  });

  console.log('\n🚀 TARGET MEI BERHASIL DIAKTIFKAN!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('► Target Utama : Rp 750.000');
  console.log('► Target Bonus : Rp 1.000.000');
  console.log('► Mode Strategi: WAR (Aggressive Growth)');
  console.log('► Risk / Trade : 3% (Optimized)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Sekarang bot akan otomatis mengikuti aturan ini.');
}

main()
  .catch((e) => {
    console.error('❌ Gagal mengunci target:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
