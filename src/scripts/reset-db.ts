import { prisma } from '../db/prisma';

async function main() {
  console.log('🔄 [DATABASE RESET] Memulai proses pembersihan database...');

  try {
    // 1. Hapus Chat Messages & Sessions
    const deletedMessages = await (prisma as any).chatMessage.deleteMany({});
    const deletedSessions = await (prisma as any).chatSession.deleteMany({});
    console.log(`🧹 [CHAT] Berhasil menghapus ${deletedMessages.count} pesan dan ${deletedSessions.count} sesi chat.`);

    // 2. Hapus Activity Logs
    const deletedLogs = await (prisma as any).activityLog.deleteMany({});
    console.log(`🧹 [LOGS] Berhasil menghapus ${deletedLogs.count} log aktivitas.`);

    // 3. Hapus Daily Performance
    const deletedPerf = await (prisma as any).dailyPerformance.deleteMany({});
    console.log(`🧹 [PERFORMANCE] Berhasil menghapus ${deletedPerf.count} rekaman performa harian.`);

    // 4. Hapus Semua Trade / Analisis (Stale active positions & history)
    const deletedAnalysis = await (prisma as any).analysis.deleteMany({});
    console.log(`🧹 [TRADES] Berhasil menghapus ${deletedAnalysis.count} data analisis & transaksi.`);

    // 5. Inisialisasi ulang Bot Settings ke global default
    await (prisma as any).botSettings.upsert({
      where: { id: 'global' },
      update: {
        isBotEnabled: true,
        strategyMode: 'SURVIVAL',
        riskPerTrade: 2.0,
        maxOpenPositions: 3,
        dailyLossLimit: 5.0,
        trailingStopPct: 5.0
      },
      create: {
        id: 'global',
        isBotEnabled: true,
        strategyMode: 'SURVIVAL',
        riskPerTrade: 2.0,
        maxOpenPositions: 3,
        dailyLossLimit: 5.0,
        trailingStopPct: 5.0
      }
    });
    console.log('⚙️ [SETTINGS] Bot Settings direset ke default: Mode SURVIVAL | Risk 2% | Max Positions 3.');

    console.log('\n✅ [SUCCESS] Database berhasil disinkronkan & direset ke keadaan bersih!');
    console.log('   Semua statistik performa, transaksi aktif, dan log lama telah dibersihkan.');
    console.log('   Tabel User dan CoinMetadata tetap dipertahankan demi kestabilan sistem.');

  } catch (error) {
    console.error('❌ [ERROR] Gagal melakukan reset database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
