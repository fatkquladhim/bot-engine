import { BaseStrategy, Signal } from './BaseStrategy';

export interface TradingPlan {
  pair: string;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  entryPrice: number;
  targetPrice1: number;
  targetPrice2: number;
  stopLoss: number;
  allocatedIdr: number; // Berapa modal yang dipakai untuk plan ini
}

/**
 * Strategy canggih yang dirancang khusus untuk menerima hasil analisa dari SwingVision AI.
 * Bot akan menunggu ("mengintai") harga sampai menyentuh entryPrice, lalu pasang jaring TP dan SL.
 */
export class SwingStrategy extends BaseStrategy {
  private plan: TradingPlan;
  private status: 'WAITING_ENTRY' | 'POSITION_OPEN' | 'PARTIAL_PROFIT' | 'COMPLETED';
  private currentStopLoss: number;

  constructor(engine: any, plan: TradingPlan, initialStatus: 'WAITING_ENTRY' | 'POSITION_OPEN' | 'PARTIAL_PROFIT' | 'COMPLETED' = 'WAITING_ENTRY') {
    super(`SwingVision_${plan.pair}`, engine);
    this.plan = plan;
    this.status = initialStatus;
    this.currentStopLoss = plan.stopLoss; // Inisialisasi awal SL
    
    // Jika posisi sudah terbuka (resumed), pastikan SL diatur (nanti bisa dibikin lebih cerdas)
    if (initialStatus === 'PARTIAL_PROFIT') {
      this.currentStopLoss = plan.entryPrice;
    }
  }

  /**
   * Dievaluasi setiap detik oleh Live Radar
   */
  public async evaluate(pair: string, currentPrice?: number): Promise<Signal> {
    if (pair !== this.plan.pair || !currentPrice) {
      return { pair, action: 'HOLD' };
    }

    // Kondisi 1: Mengintai Entry
    if (this.status === 'WAITING_ENTRY') {
      // Jika harga menyentuh atau turun di bawah harga Entry (buy limit logic)
      if (currentPrice <= this.plan.entryPrice) {
        console.log(`\n🎯 [${this.name}] HARGA ENTRY TERSENTUH di Rp ${currentPrice.toLocaleString()}!`);
        this.status = 'POSITION_OPEN';
        return {
          pair,
          action: 'BUY',
          amountIdr: this.plan.allocatedIdr
        };
      }
    }

    // Kondisi 2: Posisi sudah terbuka, jaga TP dan SL
    if (this.status === 'POSITION_OPEN' || this.status === 'PARTIAL_PROFIT') {
      
      // Kena Stop Loss (Bisa SL asli, atau SL yang sudah digeser / Trailing SL)
      if (currentPrice <= this.currentStopLoss) {
        console.log(`\n⚠️ [${this.name}] STOP LOSS HIT di Rp ${currentPrice.toLocaleString()}!`);
        const sellPct = this.status === 'PARTIAL_PROFIT' ? 100 : 100; // Sell the remaining 100% of the currently held bag
        this.status = 'COMPLETED';
        return { pair, action: 'SELL', sellPercentage: sellPct }; 
      }

      // Kena Take Profit 1 (Amankan 50% modal, geser SL ke harga Entry)
      if (currentPrice >= this.plan.targetPrice1 && this.status === 'POSITION_OPEN') {
        console.log(`\n💰 [${this.name}] TAKE PROFIT 1 HIT di Rp ${currentPrice.toLocaleString()}!`);
        console.log(`🛡️  Mengamankan 50% profit. Menggeser Stop Loss naik ke harga Entry (Rp ${this.plan.entryPrice.toLocaleString()})!`);
        
        this.status = 'PARTIAL_PROFIT';
        this.currentStopLoss = this.plan.entryPrice; // Trailing SL / Break Even
        
        return { pair, action: 'SELL', sellPercentage: 50 }; // Jual setengah (50%) dari total posisi saat ini
      }

      // Kena Take Profit 2 (Jual sisa 50%)
      if (currentPrice >= this.plan.targetPrice2 && this.status === 'PARTIAL_PROFIT') {
         console.log(`\n🚀 [${this.name}] TAKE PROFIT 2 (FINAL) HIT di Rp ${currentPrice.toLocaleString()}! Trading sukses maksimal!`);
         this.status = 'COMPLETED';
         return { pair, action: 'SELL', sellPercentage: 100 }; // Jual sisanya (100% dari sisa bag)
      }
    }

    return { pair, action: 'HOLD' };
  }
}
