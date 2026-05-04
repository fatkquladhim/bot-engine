import * as fs from 'fs';
import * as path from 'path';
import { IndodaxClient, IndodaxConfig } from '../core/IndodaxClient';
import { IndodaxPublicAPI } from '../core/IndodaxPublicAPI';
import { RiskManager, RiskConfig } from './RiskManager';
import { Notifier } from '../utils/Notifier';
import { RiskDomain } from '../modules/risk/RiskDomain';
import { ExecutionDomain } from '../modules/execution/ExecutionDomain';
import { OrderRecovery } from '../modules/execution/OrderRecovery';

export interface EngineConfig {
  api: IndodaxConfig;
  risk: RiskConfig;
  isDryRun?: boolean; // If true, won't place real orders
  maxPortfolioExposurePercent?: number; // Max total modal yang boleh di-tradingkan
  maxOpenPositions?: number;
}

export interface TradeState {
  openPositions: Record<string, { 
    amountIdr: number, 
    amountCrypto: number, 
    entryPrice: number,
    entryTimestamp?: number, // unix ms untuk time-based exit
    sl?: number,
    tp1?: number,
    tp2?: number,
    tp3?: number,
    tpHits?: number[]
  }>;
  totalExposureIdr: number;
  // Execution Tracking & Performance Metrics
  totalTrades: number;
  winningTrades: number;
  totalPnL: number;
  executionLogs: Array<{ pair: string, expectedPrice: number, actualPrice: number, slippagePercent: number, latencyMs: number }>;
  recentResults: boolean[]; // true = win, false = loss (Max 10)
  
  // Tambahan untuk Growth Machine
  maxTradesPerDay?: number;
  activeMode?: string;
}

export class TradingEngine {
  public client: IndodaxClient;
  public riskManager: RiskManager;
  private isDryRun: boolean;
  private maxExposurePercent: number;
  private maxPositions: number;
  private consecutiveApiErrors: number = 0;
  
  // State Persistence (MIGRATED TO DATABASE)
  public state: TradeState = { 
    openPositions: {}, 
    totalExposureIdr: 0,
    totalTrades: 0,
    winningTrades: 0,
    totalPnL: 0,
    executionLogs: [],
    recentResults: []
  };

  constructor(config: EngineConfig) {
    this.client = new IndodaxClient(config.api);
    this.riskManager = new RiskManager(config.risk);
    this.isDryRun = config.isDryRun ?? true;
    this.maxExposurePercent = config.maxPortfolioExposurePercent ?? 90; // FULL WAR MODE: 90%
    this.maxPositions = config.maxOpenPositions ?? 5; // 5 koin sekaligus

    this.loadState();

    if (this.isDryRun) {
      console.log('🛡️  Trading Engine running in DRY RUN mode.');
    } else {
      console.warn('⚠️  Trading Engine running in LIVE mode.');
    }
  }

  // =========================
  // STATE PERSISTENCE (MIGRATED TO DATABASE)
  // =========================
  private loadState() {
    // No-op: State recovery is now handled by cli.ts via Database
  }

  public saveState() {
    // No-op: State persistence is now handled by DB updates in real-time
  }

  // =========================
  // LIVE PERFORMANCE FILTER (EDGE)
  // =========================
  private validateLivePerformance(): boolean {
    if (this.state.totalTrades < 20) return true; // Butuh minimal 20 trades untuk statistik valid

    const winRate = (this.state.winningTrades / this.state.totalTrades) * 100;
    const expectancy = this.state.totalPnL / this.state.totalTrades;

    console.log(`\n📈 [PERFORMANCE TRACKER] Win Rate: ${winRate.toFixed(1)}% | Expectancy: Rp ${Math.round(expectancy).toLocaleString()}`);

    // FAILSAFE AUTO PAUSE (10 Trades Rule)
    if (this.state.recentResults.length === 10) {
      const recentLosses = this.state.recentResults.filter(win => !win).length;
      if (recentLosses >= 7) { // 7 loss dari 10 trade terakhir = stop
        console.log(`🛑 [FAILSAFE TRIGGERED] 7 Loss dalam 10 trade terakhir! Sistem dihentikan otomatis.`);
        return false;
      }
    }

    if (expectancy < 0) {
      console.log("💀 [PERFORMANCE FILTER] EXPECTANCY NEGATIF! Strategi saat ini terbukti rugi di Live Market. Bot di-pause otomatis.");
      return false;
    }

    if (winRate < 40) {
      console.log("⚠️ [PERFORMANCE FILTER] Win Rate anjlok di bawah 40%. Bot di-pause untuk menghindari kerugian beruntun.");
      return false;
    }

    return true;
  }

  // =========================
  // PORTFOLIO MANAGEMENT
  // =========================
  public async calculateTotalEquity(): Promise<number> {
    try {
      const isMockKey = this.client['apiKey'] === 'mock_key' || this.client['apiKey'] === 'mock_data' || this.client['apiKey'] === 'your_api_key_here';
      if (this.isDryRun && isMockKey) return 10000000;

      const info = await this.client.getInfo();
      const tickers = await IndodaxPublicAPI.getAllTickers();
      
      let totalValue = parseFloat(info.balance.idr || "0") + parseFloat(info.balance_hold.idr || "0");
      
      const balances = info.balance || {};
      const holds = info.balance_hold || {};
      const allCoins = new Set([...Object.keys(balances), ...Object.keys(holds)]);

      for (const coin of allCoins) {
        if (coin === 'idr') continue;
        const amount = parseFloat(balances[coin] || "0") + parseFloat(holds[coin] || "0");
        if (amount > 0) {
          const pair = `${coin.toLowerCase()}_idr`;
          const price = parseFloat(tickers[pair]?.last || "0");
          totalValue += amount * price;
        }
      }
      return totalValue;
    } catch (e) {
      console.log('⚠️ [EQUITY CALC] Gagal menghitung total equity, fallback ke balance IDR.');
      const info = await this.client.getInfo();
      return parseFloat(info.balance.idr || "0") + this.state.totalExposureIdr;
    }
  }

  private async canOpenNewPosition(currentTotalCapital: number, newAmountIdr: number): Promise<boolean> {
    const currentPositionsCount = Object.keys(this.state.openPositions).length;
    if (currentPositionsCount >= this.maxPositions) {
      console.log(`❌ [PORTFOLIO RISK] Ditolak: Batas maksimal koin aktif tercapai (${this.maxPositions}).`);
      return false;
    }

    const projectedExposure = this.state.totalExposureIdr + newAmountIdr;
    const maxAllowedExposure = currentTotalCapital * (this.maxExposurePercent / 100);
    
    if (projectedExposure > maxAllowedExposure) {
      console.log(`❌ [PORTFOLIO RISK] Ditolak: Exposure melebihi batas (Projected: Rp ${Math.round(projectedExposure).toLocaleString()} > Limit: Rp ${Math.round(maxAllowedExposure).toLocaleString()}).`);
      return false;
    }

    return true;
  }

  /**
   * Execute a Buy Order with Risk, Portfolio, and Performance Checks
   */
  public async executeBuy(pair: string, amountIdr: number, expectedPrice?: number, targets?: { sl: number, tp1: number, tp2: number }): Promise<any> {
    try {
      // 0. RISK DOMAIN GUARD
      if (!RiskDomain.isSafeToTrade()) {
        throw new Error('Trading suspended by Risk Domain (Circuit Breaker)');
      }

      // 0.1 STUCK ORDER RECOVERY
      await OrderRecovery.reconcileStuckOrders(this.client, pair);

      // 0.2 Performance Filter & Systemic Risk Check
      if (!this.validateLivePerformance()) {
        throw new Error('Trade rejected by Performance Filter (Expectancy < 0).');
      }

      // Check BTC Drop (Systemic Risk) - bandingkan harga sekarang vs 1 jam lalu
      let btcDrop = 0;
      try {
        const { MarketIntelligence } = require('../scanner/MarketIntelligence');
        const btcBars = await MarketIntelligence.fetchCandles('BTCIDR', '60');
        if (btcBars.length >= 2) {
          const btcNow = btcBars[btcBars.length - 1].close;
          const btcPrev = btcBars[btcBars.length - 2].close;
          btcDrop = ((btcNow - btcPrev) / btcPrev) * 100;
        }
      } catch (e) {
        console.log('⚠️ Gagal memuat data BTC untuk Kill Switch.');
      }

      const totalCapital = await this.calculateTotalEquity();
      RiskDomain.setStartingEquity(totalCapital);
      if (RiskDomain.monitor(totalCapital)) {
        throw new Error('Trade rejected by Risk Domain Circuit Breaker.');
      }

      // 1. Portfolio & Risk Check
      if (this.riskManager.isKillSwitchEngaged(totalCapital, btcDrop, this.consecutiveApiErrors)) {
         throw new Error('Trade rejected by Global Kill Switch.');
      }
      if (!await this.canOpenNewPosition(totalCapital, amountIdr)) {
        throw new Error('Trade rejected by Portfolio Manager.');
      }
      if (!this.riskManager.validateTradeSize(totalCapital, amountIdr)) {
        throw new Error('Trade rejected by Risk Manager: Position too large.');
      }
      if (!this.riskManager.validateCorrelation(pair, Object.keys(this.state.openPositions))) {
        throw new Error('Trade rejected by Correlation Guard.');
      }

      const startTime = Date.now();
      const ticker = await IndodaxPublicAPI.getTicker(pair);
      const ask = parseFloat(ticker.ticker.sell);
      const bid = parseFloat(ticker.ticker.buy);
      const spread = ((ask - bid) / ask) * 100;
      const latencyMs = Date.now() - startTime;

      // ===== SMART ORDER ROUTING =====
      let executionPrice = ask;
      let orderTypeLabel = "MARKET (Taker)";

      // Jika spread lebar (>0.3%), gunakan Limit order agresif (di atas bid sedikit)
      if (spread > 0.3) {
         executionPrice = bid + ((ask - bid) * 0.3); // 30% dari spread (mengantri)
         orderTypeLabel = "SMART LIMIT (Maker)";
      }

      // Hitung Slippage vs Rekomendasi AI
      let slippagePercent = 0;
      if (expectedPrice) {
        slippagePercent = ((executionPrice - expectedPrice) / expectedPrice) * 100;
      }

      console.log(`\n📊 Attempting to BUY ${pair}`);
      console.log(`- Amount: Rp ${amountIdr.toLocaleString()}`);
      console.log(`- Execution: ${orderTypeLabel}`);
      console.log(`- Price: Rp ${executionPrice.toLocaleString()} (Slippage: ${slippagePercent.toFixed(2)}%)`);
      console.log(`- Execution Latency: ${latencyMs}ms`);

      if (this.isDryRun) {
        console.log(`[DRY RUN] Order generated: BUY ${pair} | Price: ${executionPrice}`);
      } else {
        const safeAmountIdr = Math.floor(amountIdr);
        let tradeResult: any;
        
        // ===== ICEBERG ORDERS =====
        if (safeAmountIdr >= 200000) {
           console.log(`🧊 [ICEBERG] Memecah order besar Rp ${safeAmountIdr.toLocaleString()} menjadi 3 batch...`);
           const batchSize = Math.floor(safeAmountIdr / 3);
           for (let i = 0; i < 3; i++) {
             const amt = (i === 2) ? (safeAmountIdr - (batchSize * 2)) : batchSize;
             tradeResult = await this.client.trade(pair, 'buy', executionPrice, amt);
             if (i < 2) await new Promise(r => setTimeout(r, 4000));
           }
        } else {
           tradeResult = await this.client.trade(pair, 'buy', executionPrice, safeAmountIdr);
        }

        // ===== PARTIAL FILL VERIFICATION =====
        // Wait a moment for order to settle then check actual balance increase
        await new Promise(r => setTimeout(r, 2000));
        const finalInfo = await this.client.getInfo();
        const coin = pair.split('_')[0];
        const actualCryptoAmount = parseFloat(finalInfo.balance?.[coin] || "0");
        
        if (actualCryptoAmount <= 0 && !this.isDryRun) {
          console.log(`⚠️ [ORDER MANAGER] Order Rp ${safeAmountIdr.toLocaleString()} terkirim tapi saldo koin tetap 0. Kemungkinan Limit Order belum terisi.`);
          // We still create the position but with 0 amountCrypto for now? 
          // No, better to use the estimated if we can't find balance, but log warning.
        }

        Notifier.sendTelegram(`🟢 *TRADE BUY*\nPair: ${pair.toUpperCase()}\nPrice: Rp ${executionPrice.toLocaleString()}\nType: ${orderTypeLabel}\nStatus: ${actualCryptoAmount > 0 ? 'Filled' : 'Queued/Partial'}`);
        
        // Update State & Logs
        const finalCrypto = actualCryptoAmount > 0 ? actualCryptoAmount : (amountIdr / executionPrice);
        this.state.openPositions[pair] = { 
          amountIdr, 
          amountCrypto: finalCrypto, 
          entryPrice: executionPrice,
          entryTimestamp: Date.now(),
          sl: targets?.sl,
          tp1: targets?.tp1,
          tp2: (targets as any)?.tp2,
          tp3: (targets as any)?.tp3,
          tpHits: []
        };
      }
      
      this.state.totalExposureIdr += amountIdr;
      this.state.executionLogs.push({ pair, expectedPrice: expectedPrice || executionPrice, actualPrice: executionPrice, slippagePercent, latencyMs });
      this.consecutiveApiErrors = 0;
      this.saveState();

      return { success: true, actualPrice: executionPrice };

    } catch (error: any) {
      const errMsg = error.message || '';
      
      // ===== NETWORK TIMEOUT DOUBLE-BUY GUARD =====
      if (errMsg.includes('timeout') || errMsg.includes('ECONNRESET') || errMsg.includes('504') || errMsg.includes('Network Error')) {
        console.log(`\n⚠️ [TIMEOUT GUARD] Koneksi terputus saat BUY ${pair}. Memverifikasi apakah order masuk...`);
        try {
          await new Promise(r => setTimeout(r, 3000)); // Wait 3s for settlement
          const verifyInfo = await this.client.getInfo();
          const coin = pair.split('_')[0];
          const coinBalance = parseFloat(verifyInfo.balance?.[coin] || "0");
          if (coinBalance > 0) {
            console.log(`🔍 [TIMEOUT GUARD] TERDETEKSI: Saldo ${coin.toUpperCase()} = ${coinBalance}. Order KEMUNGKINAN MASUK. Sinkronisasi state...`);
            const ticker = await IndodaxPublicAPI.getTicker(pair);
            const syncPrice = parseFloat(ticker.ticker.last);
            this.state.openPositions[pair] = {
              amountIdr, amountCrypto: coinBalance, entryPrice: syncPrice, ...targets
            };
            this.state.totalExposureIdr += amountIdr;
            this.saveState();
            return { success: true, actualPrice: syncPrice };
          } else {
            console.log(`✅ [TIMEOUT GUARD] Saldo ${coin.toUpperCase()} = 0. Order TIDAK masuk. Aman untuk retry.`);
          }
        } catch (verifyErr) {
          console.log(`❌ [TIMEOUT GUARD] Gagal memverifikasi. MENAHAN DIRI dari retry untuk keamanan.`);
          throw new Error('Trade rejected: Cannot verify post-timeout state.');
        }
      }
      
      if (!errMsg.includes('rejected')) {
        this.consecutiveApiErrors++;
      }
      console.error(`❌ Buy Failed: ${errMsg}`);
      throw error;
    }
  }

  /**
   * Execute a Sell Order & Hitung PnL
   */
  public async executeSell(pair: string, amountCrypto: number, expectedPrice?: number): Promise<any> {
    try {
      const startTime = Date.now();
      
      // STUCK ORDER RECOVERY
      await OrderRecovery.reconcileStuckOrders(this.client, pair);

      const ticker = await IndodaxPublicAPI.getTicker(pair);
      const actualPrice = parseFloat(ticker.ticker.buy);
      const latencyMs = Date.now() - startTime;

      let slippagePercent = 0;
      if (expectedPrice) {
        // Slippage jual: harga lebih murah dari ekspektasi = slippage negatif (merugikan)
        slippagePercent = ((actualPrice - expectedPrice) / expectedPrice) * 100;
      }

      console.log(`\n📊 Attempting to SELL ${pair}`);
      console.log(`- Amount Crypto: ${amountCrypto}`);
      console.log(`- Actual Price: Rp ${actualPrice.toLocaleString()} (Slippage: ${slippagePercent.toFixed(2)}%)`);

      // DUST FILTER: Indodax minimum order is roughly 10k-15k IDR
      const totalValueIdr = amountCrypto * actualPrice;
      if (totalValueIdr < 15000) {
        console.log(`⚠️  [DUST FILTER] Nilai koin terlalu kecil (Rp ${totalValueIdr.toLocaleString()}). Mengabaikan order jual.`);
        // Tetap hapus dari state agar tidak menghambat slot posisi
        if (this.state.openPositions[pair]) {
          this.state.totalExposureIdr -= this.state.openPositions[pair].amountIdr;
          delete this.state.openPositions[pair];
          this.saveState();
        }
        return { success: true, message: 'Dust ignored' };
      }

      if (this.isDryRun) {
        console.log(`[DRY RUN] Order generated: SELL ${pair} | Price: ${actualPrice}`);
      } else {
        try {
          await this.client.trade(pair, 'sell', actualPrice, amountCrypto);
          Notifier.sendTelegram(`🔴 *TRADE SELL*\nPair: ${pair.toUpperCase()}\nPrice: Rp ${actualPrice.toLocaleString()}`);
        } catch (sellErr: any) {
          if (sellErr.message && sellErr.message.includes("amount can't be in decimal")) {
            console.log(`⚠️ Decimal amount rejected by Indodax. Retrying with floored amount...`);
            const flooredAmount = Math.floor(amountCrypto);
            if (flooredAmount <= 0) throw new Error("Floored amount is 0, cannot sell.");
            await this.client.trade(pair, 'sell', actualPrice, flooredAmount);
            Notifier.sendTelegram(`🔴 *TRADE SELL (Floored)*\nPair: ${pair.toUpperCase()}\nPrice: Rp ${actualPrice.toLocaleString()}`);
          } else {
            throw sellErr;
          }
        }
      }

      // Update State, PnL, & Performance Metrics
      if (this.state.openPositions[pair]) {
        const entryPrice = this.state.openPositions[pair].entryPrice;
        const grossPnl = (actualPrice - entryPrice) * amountCrypto;
        
        // ===== FEE-AWARE PnL =====
        // Indodax fees: Taker 0.31% per side (Buy + Sell = 0.62% round-trip)
        const INDODAX_FEE_PERCENT = 0.0062; // 0.62%
        const totalFeeIdr = this.state.openPositions[pair].amountIdr * INDODAX_FEE_PERCENT;
        const pnl = grossPnl - totalFeeIdr;
        
        this.state.totalTrades += 1;
        this.state.totalPnL += pnl;
        
        const isWin = pnl > 0;
        if (isWin) {
          this.state.winningTrades += 1;
          this.riskManager.recordWin();
        } else {
          this.riskManager.recordLoss(Math.abs(pnl));
        }

        // Failsafe tracking (capped at 10)
        this.state.recentResults.push(isWin);
        while (this.state.recentResults.length > 10) {
          this.state.recentResults.shift();
        }

        const pnlEmoji = isWin ? '🟢' : '🔴';
        console.log(`${pnlEmoji} Trade Closed! PnL: Rp ${Math.round(pnl).toLocaleString()} | Win Rate: ${((this.state.winningTrades / this.state.totalTrades) * 100).toFixed(1)}% | Total: ${this.state.totalTrades}`);

        this.state.totalExposureIdr -= this.state.openPositions[pair].amountIdr;
        delete this.state.openPositions[pair];
      }
      
      this.state.executionLogs.push({ pair, expectedPrice: expectedPrice || actualPrice, actualPrice, slippagePercent, latencyMs });
      this.consecutiveApiErrors = 0; // Reset errors on success
      this.saveState();

      return { success: true, actualPrice };

    } catch (error: any) {
      // Hanya naikkan error API jika bukan penolakan strategi/internal
      if (!error.message.includes('rejected')) {
        this.consecutiveApiErrors++;
      }
      console.error(`❌ Sell Failed: ${error.message}`);
      throw error;
    }
  }
}
