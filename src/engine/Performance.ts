import { PrismaClient } from '@prisma/client';

export interface TradeRecord {
  pair: string;
  isWin: boolean;
  pnlIdr: number;
}

export class PerformanceEngine {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Merekam hasil harian bot ke database.
   * Dipanggil setiap jam 23:59 atau sebelum reset harian.
   */
  public async logDailyPerformance(
    startEquity: number,
    endEquity: number,
    trades: TradeRecord[],
    maxDrawdown: number
  ) {
    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => t.isWin).length;
    const aiAccuracy = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    let grossProfit = 0;
    let grossLoss = 0;

    const pairPnl: Record<string, number> = {};

    for (const trade of trades) {
      if (trade.pnlIdr > 0) grossProfit += trade.pnlIdr;
      else grossLoss += Math.abs(trade.pnlIdr);

      if (!pairPnl[trade.pair]) pairPnl[trade.pair] = 0;
      pairPnl[trade.pair] += trade.pnlIdr;
    }

    const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;
    const totalPnlIdr = endEquity - startEquity;

    const avgWinIdr = winningTrades > 0 ? grossProfit / winningTrades : 0;
    const losingTrades = totalTrades - winningTrades;
    const avgLossIdr = losingTrades > 0 ? grossLoss / losingTrades : 0;

    // Tentukan Best dan Worst Pair
    let bestPair: string | null = null;
    let worstPair: string | null = null;
    let highestPnl = -Infinity;
    let lowestPnl = Infinity;

    for (const [pair, pnl] of Object.entries(pairPnl)) {
      if (pnl > highestPnl) {
        highestPnl = pnl;
        bestPair = pair;
      }
      if (pnl < lowestPnl) {
        lowestPnl = pnl;
        worstPair = pair;
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    try {
      await this.prisma.dailyPerformance.upsert({
        where: { date: today },
        update: {
          endEquity,
          totalTrades,
          winningTrades,
          totalPnlIdr,
          maxDrawdown,
          profitFactor,
          avgWinIdr,
          avgLossIdr,
          bestPair,
          worstPair,
          aiAccuracy
        },
        create: {
          date: today,
          startEquity,
          endEquity,
          totalTrades,
          winningTrades,
          totalPnlIdr,
          maxDrawdown,
          profitFactor,
          avgWinIdr,
          avgLossIdr,
          bestPair,
          worstPair,
          aiAccuracy
        }
      });
      console.log(`📊 [PERFORMANCE] Rapor harian berhasil disimpan. Profit Factor: ${profitFactor.toFixed(2)}`);
    } catch (e: any) {
      console.error(`❌ [PERFORMANCE] Gagal menyimpan rapor harian:`, e.message);
    }
  }

  /**
   * Mengembalikan insight performa, apakah bot layak masuk Fase B/C.
   */
  public async getGrowthInsights() {
     // TODO: Baca performa minggu lalu untuk menentukan kenaikan modal otomatis.
  }
}
