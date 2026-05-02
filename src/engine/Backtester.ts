import { RiskManager, RiskConfig } from './RiskManager';

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BacktestResult {
  totalTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  initialBalance: number;
  finalBalance: number;
  totalPnL: number;
  maxDrawdown: number;
  profitFactor: number;
  expectancy: number; // Tier 1: Harapan profit/loss per trade
}

export class Backtester {
  private balance: number;
  private riskManager: RiskManager;
  private trades: Array<{ pnl: number; isWin: boolean }> = [];
  private peakBalance: number;
  private maxDrawdown: number = 0;
  
  // Realism Parameters (Indodax)
  private feePercent: number = 0.0021; // 0.21% taker fee
  private slippagePercent: number = 0.001; // 0.1% slippage rata-rata

  constructor(initialBalance: number, riskConfig: RiskConfig) {
    this.balance = initialBalance;
    this.peakBalance = initialBalance;
    this.riskManager = new RiskManager(riskConfig);
  }

  /**
   * Menjalankan simulasi strategi ke masa lalu (Backtest)
   */
  public runSimulation(
    candles: CandleData[], 
    strategyLogic: (candle: CandleData) => 'BUY' | 'SELL' | 'HOLD'
  ): BacktestResult {
    console.log(`\n⚙️ [BACKTESTER] Memulai simulasi dengan ${candles.length} candle (Termasuk Fee & Slippage)...`);
    
    let position: { entry: number; sl: number; tp: number; sizeIdr: number } | null = null;
    let grossProfit = 0;
    let grossLoss = 0;

    for (const candle of candles) {
      // 1. Cek status posisi saat ini
      if (position) {
        if (candle.low <= position.sl) {
          // Kena SL (Rugi) + Slippage + Fee
          const exitPrice = position.sl * (1 - this.slippagePercent); // Slippage bikin jual lebih murah
          let pnlGross = position.sizeIdr * ((exitPrice - position.entry) / position.entry);
          let fee = position.sizeIdr * this.feePercent; // Fee jual
          
          const totalLoss = pnlGross - fee;
          this.closePosition(totalLoss, false);
          grossLoss += Math.abs(totalLoss);
          position = null;
          
        } else if (candle.high >= position.tp) {
          // Kena TP (Untung) - Slippage + Fee
          const exitPrice = position.tp * (1 - this.slippagePercent); // Slippage (susah jual di pucuk pas)
          let pnlGross = position.sizeIdr * ((exitPrice - position.entry) / position.entry);
          let fee = position.sizeIdr * this.feePercent; // Fee jual
          
          const totalProfit = pnlGross - fee;
          this.closePosition(totalProfit, totalProfit > 0);
          if (totalProfit > 0) grossProfit += totalProfit;
          else grossLoss += Math.abs(totalProfit); // Bisa jadi loss karena fee
          position = null;
        }
      }

      // 2. Jika tidak ada posisi, jalankan logika AI/Strategi
      if (!position) {
        const signal = strategyLogic(candle);
        
        if (signal === 'BUY') {
          // Simulasi SL 2% dan TP 4%
          const sl = candle.close * 0.98; 
          const tp = candle.close * 1.04;
          
          // Slippage entry (beli lebih mahal) + Fee Beli
          const realEntryPrice = candle.close * (1 + this.slippagePercent);
          
          // Gunakan Position Sizing Pro
          const lotSize = this.riskManager.calculatePositionSize(this.balance, realEntryPrice, sl, 1); // Risk 1%
          
          if (lotSize > 0) {
            const entryFee = lotSize * this.feePercent;
            this.balance -= entryFee; // Langsung potong saldo untuk fee beli
            position = { entry: realEntryPrice, sl, tp, sizeIdr: lotSize };
          }
        }
      }
    }

    const wins = this.trades.filter(t => t.isWin).length;
    const losses = this.trades.filter(t => !t.isWin).length;
    const winRate = this.trades.length > 0 ? (wins / this.trades.length) : 0;
    const lossRate = 1 - winRate;
    
    const avgWin = wins > 0 ? (grossProfit / wins) : 0;
    const avgLoss = losses > 0 ? (grossLoss / losses) : 0;
    
    // 🔥 TIER 1 PRO: Expectancy Formula
    // Expectancy = (Winrate × Avg Win) - (Lossrate × Avg Loss)
    const expectancy = (winRate * avgWin) - (lossRate * avgLoss);

    return {
      totalTrades: this.trades.length,
      winCount: wins,
      lossCount: losses,
      winRate: winRate * 100,
      initialBalance: 10000000, 
      finalBalance: this.balance,
      totalPnL: this.balance - 10000000,
      maxDrawdown: this.maxDrawdown,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0),
      expectancy: expectancy
    };
  }

  private closePosition(pnl: number, isWin: boolean) {
    this.balance += pnl;
    this.trades.push({ pnl, isWin });
    
    if (this.balance > this.peakBalance) {
      this.peakBalance = this.balance;
    } else {
      const currentDrawdown = ((this.peakBalance - this.balance) / this.peakBalance) * 100;
      if (currentDrawdown > this.maxDrawdown) {
        this.maxDrawdown = currentDrawdown;
      }
    }
  }
}
