import { prisma } from './prisma';
import { LiveRadar } from '../engine/LiveRadar';
import { SwingStrategy, TradingPlan } from '../strategies/SwingStrategy';
import { TradingEngine } from '../engine/TradingEngine';

export class DBBridge {
  private prisma = prisma;
  private radar: LiveRadar;
  private engine: TradingEngine;
  private trackedAnalysisIds: Set<string> = new Set();
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(radar: LiveRadar, engine: TradingEngine) {
    this.radar = radar;
    this.engine = engine;
    DBBridge.instance = this;
  }

  private static instance: DBBridge | null = null;

  public static async logActivity(type: 'SCAN' | 'TRADE' | 'ERROR' | 'SYSTEM', message: string) {
    if (!DBBridge.instance) return;
    try {
      await DBBridge.instance.withRetry(() => (DBBridge.instance!.prisma as any).activityLog.create({
        data: { type, message }
      }));
    } catch (e) {
      // Ignore DB log errors to prevent bot crash
    }
  }

  /**
   * Helper untuk menangani retry otomatis jika koneksi database goyang
   */
  private async withRetry<T>(operation: () => Promise<T>, retries: number = 3): Promise<T> {
    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (error: any) {
        if (i === retries - 1) throw error;
        const delay = Math.pow(2, i) * 1000;
        console.warn(`⚠️ [DB-BRIDGE] Koneksi database gagal (Attempt ${i + 1}/${retries}). Mencoba lagi dalam ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Retry failed');
  }

  /**
   * Starts polling the database for new OPEN analyses
   */
  public startSync(intervalMs: number = 10000) {
    console.log(`\n🔗 [DB-BRIDGE] Sinkronisasi Supabase aktif. Mengecek AI Plan setiap ${intervalMs / 1000} detik...`);
    this.pollInterval = setInterval(() => this.checkForNewPlans(), intervalMs);
    this.checkForNewPlans(); // initial check
  }

  public stopSync() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  private async checkForNewPlans() {
    try {
      // Wrap query dengan retry otomatis
      const openAnalyses = await this.withRetry(() => this.prisma.analysis.findMany({
        where: {
          status: { in: ['OPEN', 'TRADING'] }
        }
      }));

      for (const analysis of openAnalyses) {
        if (!this.trackedAnalysisIds.has(analysis.id)) {
          await this.registerNewPlan(analysis);
        }
      }
    } catch (error: any) {
      console.error(`[DB-BRIDGE ERROR] Gagal mengambil data setelah beberapa kali percobaan: ${error.message}`);
    }
  }

  private async registerNewPlan(analysis: any) {
    console.log(`\n📥 [DB-BRIDGE] Plan baru didapatkan dari SwingVision AI! ID: ${analysis.id}`);
    
    // Convert Database schema to TradingPlan format
    const pairFormat = analysis.assetName.toLowerCase().replace('/', '_');

    // Ambil Balance untuk Hedge Fund Position Sizing (2% Risk)
    let totalCapital = 0;
    const isMockKey = this.engine.client['apiKey'] === 'mock_key' || this.engine.client['apiKey'] === 'mock_data' || this.engine.client['apiKey'] === 'your_api_key_here';
    if ((this.engine as any).isDryRun && isMockKey) {
      totalCapital = 10000000;
    } else {
      try {
        const info = await this.engine.client.getInfo();
        totalCapital = parseInt(info.balance.idr) + this.engine.state.totalExposureIdr;
      } catch (e) {
        totalCapital = 10000000; // Fallback jika gagal ambil info
      }
    }

    const optimalIdr = this.engine.riskManager.calculatePositionSize(
      totalCapital, 
      analysis.entryPrice, 
      analysis.stopLoss, 
      2 // 2% Risk per trade
    );

    console.log(`📈 [POSITION SIZING] Jarak SL: ${(((analysis.entryPrice - analysis.stopLoss)/analysis.entryPrice)*100).toFixed(2)}% | Alokasi Modal Optimal: Rp ${optimalIdr.toLocaleString()}`);

    const plan: TradingPlan = {
      pair: pairFormat,
      sentiment: (analysis.sentiment as any) || 'Neutral',
      entryPrice: analysis.entryPrice,
      targetPrice1: analysis.targetPrice1,
      targetPrice2: analysis.targetPrice2,
      stopLoss: analysis.stopLoss,
      allocatedIdr: optimalIdr > 0 ? optimalIdr : 100000 // Fallback minimum
    };

    // Buat strategi baru
    // Mapping status: 'OPEN' -> 'WAITING_ENTRY', 'TRADING' -> 'POSITION_OPEN'
    const initialStatus = analysis.status === 'TRADING' ? 'POSITION_OPEN' : 'WAITING_ENTRY';
    const strategy = new SwingStrategy(this.engine, plan, initialStatus);
    
    // Override method complete untuk write-back ke database
    const originalEvaluate = strategy.evaluate.bind(strategy);
    strategy.evaluate = async (pair: string, currentPrice?: number) => {
      const signal = await originalEvaluate(pair, currentPrice);
      
      // Update: Bot Berhasil Beli -> Ubah status jadi TRADING
      if (signal.action === 'BUY' && strategy['status'] === 'POSITION_OPEN') {
        console.log(`\n📝 [DB-BRIDGE] Order Entry tereksekusi! Mengupdate Supabase: Status -> TRADING`);
        try {
          await this.withRetry(() => this.prisma.analysis.update({
            where: { id: analysis.id },
            data: { status: 'TRADING' }
          }));
        } catch (e: any) {
          console.error(`⚠️ Gagal update status TRADING: ${e.message}`);
        }
      }

      // Update: Bot Berhasil Jual -> Ubah status jadi PROFIT / LOSS
      if (signal.action === 'SELL' && strategy['status'] === 'COMPLETED') {
        let newStatus: 'PROFIT' | 'LOSS' = 'PROFIT';
        if (currentPrice && currentPrice <= plan.stopLoss) {
          newStatus = 'LOSS';
        }

        // Kalkulasi Cuan/Rugi Asli
        const exitPrice = currentPrice || plan.stopLoss;
        const pnlPercent = ((exitPrice - plan.entryPrice) / plan.entryPrice) * 100;
        const realizedPnlIdr = (pnlPercent / 100) * plan.allocatedIdr;

        console.log(`\n📝 [DB-BRIDGE] Trading Selesai! Mengupdate Supabase...`);
        console.log(`   Status: ${newStatus} | PnL: ${pnlPercent.toFixed(2)}% | Keuntungan: Rp ${Math.round(realizedPnlIdr).toLocaleString('id-ID')}`);
        
        try {
          await this.withRetry(() => (this.prisma.analysis as any).update({
            where: { id: analysis.id },
            data: { 
              status: newStatus, 
              pnlPercent: parseFloat(pnlPercent.toFixed(2)),
              realizedPnlIdr: Math.round(realizedPnlIdr),
              exitPrice: exitPrice
            } 
          }));
        } catch (e: any) {
          console.error(`⚠️ Gagal update status ${newStatus}: ${e.message}`);
        }
        
        this.trackedAnalysisIds.delete(analysis.id);
      }

      // UPDATE: Update currentPrice in DB for Floating P&L tracking while TRADING
      if (strategy['status'] === 'POSITION_OPEN' || strategy['status'] === 'PARTIAL_PROFIT') {
        try {
          await this.withRetry(() => (this.prisma.analysis as any).update({
            where: { id: analysis.id },
            data: { currentPrice: currentPrice }
          }));
        } catch (e: any) {
          // ignore silent errors for frequency
        }
      }

      return signal;
    };

    // Daftarkan ke radar
    this.radar.registerStrategy(strategy, plan.pair);
    this.trackedAnalysisIds.add(analysis.id);
  }
}
