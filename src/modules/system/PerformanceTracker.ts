import { prisma } from '../../../lib/prisma';

export class PerformanceTracker {
  /**
   * Record the daily performance of the bot.
   */
  public static async recordDaily(totalEquity: number, pnlIdr: number, pnlPercent: number): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await (prisma as any).dailyPerformance.upsert({
        where: { date: today },
        update: {
          endEquity: totalEquity,
          totalPnlIdr: pnlIdr,
          maxDrawdown: pnlPercent < 0 ? Math.abs(pnlPercent) : 0
        },
        create: {
          date: today,
          startEquity: totalEquity - pnlIdr,
          endEquity: totalEquity,
          totalPnlIdr: pnlIdr,
          totalTrades: 0,
          winningTrades: 0,
          maxDrawdown: pnlPercent < 0 ? Math.abs(pnlPercent) : 0,
          profitFactor: 0,
          avgWinIdr: 0,
          avgLossIdr: 0,
          aiAccuracy: 0
        }
      });

      console.log(`📊 [PERFORMANCE] Daily stats recorded: Equity Rp ${totalEquity.toLocaleString()} | PnL ${pnlPercent.toFixed(2)}%`);
    } catch (e: any) {
      console.error(`❌ [PERFORMANCE] Failed to record stats: ${e.message}`);
    }
  }
}
