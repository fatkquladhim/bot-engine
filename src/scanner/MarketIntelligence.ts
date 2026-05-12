import axios from 'axios';
import { IndodaxPublicAPI } from '../core/IndodaxPublicAPI';

// ============================================================
// TYPES
// ============================================================

export interface TrendAnalysis {
  trend1H: 'UP' | 'DOWN' | 'SIDEWAYS';
  trend4H: 'UP' | 'DOWN' | 'SIDEWAYS';
  trendDaily: 'UP' | 'DOWN' | 'SIDEWAYS';
  alignment: 'BULLISH' | 'LEAN_BULLISH' | 'MIXED' | 'LEAN_BEARISH' | 'BEARISH' | 'RANGE_BREAKOUT' | 'ACCUMULATION' | 'MOMENTUM';
  rsiRegime: 'OVERBOUGHT' | 'OVERSOLD' | 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  trendScore: number; // -20 to +20 bonus/penalty for scorer
}

export interface OrderbookAnalysis {
  bidWallStrength: number;
  askWallStrength: number;
  hasSpoofWall: boolean;
  whaleAbsorbing: boolean;
  isAbsorbing: boolean;     // Seller besar absorb buying pressure (bahaya)
  deltaVolume: number;      // bid IDR - ask IDR (positif = lebih banyak buyer)
  obScore: number;
  summary: string;
}

export interface ATRTarget {
  atr: number;       // Average True Range in IDR
  atrPct: number;    // ATR as % of price
  sl: number;        // Dynamic SL: entry - 1.5x ATR
  tp1: number;       // Dynamic TP1: entry + 1.5x ATR
  tp2: number;       // Dynamic TP2: entry + 3.0x ATR (trailing zone)
  rrRatio: number;   // Reward/Risk ratio (target: >= 2)
}

interface OHLCBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ============================================================
// MARKET INTELLIGENCE MODULE
// ============================================================

export class MarketIntelligence {

  // ============================================================
  // 1. MULTI-TIMEFRAME TREND ANALYSIS
  // Uses Indodax TradingView history endpoint
  // ============================================================
  public static async analyzeTrend(symbol: string): Promise<TrendAnalysis> {
    try {
      const symbolClean = symbol.replace('_idr', '').toUpperCase();
      const tvSymbol = `${symbolClean}IDR`; // Indodax TV uses BTCIDR format
      const now = Math.floor(Date.now() / 1000);

      // Fetch 1H (last 48 bars), 4H (last 30 bars), Daily (last 30 bars) — sequential to avoid burst
      const h1Bars    = await this.fetchCandles(tvSymbol, '60',   now - 48 * 3600,   now);
      await new Promise(r => setTimeout(r, 1500));
      const h4Bars    = await this.fetchCandles(tvSymbol, '240',  now - 30 * 4 * 3600, now);
      await new Promise(r => setTimeout(r, 1500));
      const dailyBars = await this.fetchCandles(tvSymbol, 'D',    now - 30 * 86400,  now);

      const trend1H    = this.detectTrend(h1Bars);
      const trend4H    = this.detectTrend(h4Bars);
      const trendDaily = this.detectTrend(dailyBars);

      // Alignment Logic (Phase 5.2 — Precision)
      const bullCount = [trend1H, trend4H, trendDaily].filter(t => t === 'UP').length;
      const bearCount = [trend1H, trend4H, trendDaily].filter(t => t === 'DOWN').length;
      const sideCount = [trend1H, trend4H, trendDaily].filter(t => t === 'SIDEWAYS').length;

      let alignment: TrendAnalysis['alignment'];
      let trendScore = 0;

      // Detect Specialized Regimes (Basic Detection)
      const lastPrice = h1Bars.length > 0 ? h1Bars[h1Bars.length - 1].close : 0;
      
      if (bullCount === 3) {
        alignment = 'BULLISH';
        trendScore = 20;
      } else if (sideCount >= 2 && trend1H === 'UP') {
        alignment = 'RANGE_BREAKOUT';
        trendScore = 18;
      } else if (sideCount === 3) {
        alignment = 'ACCUMULATION';
        trendScore = 12;
      } else if (bullCount >= 2 && trend1H === 'UP') {
        alignment = 'MOMENTUM';
        trendScore = 15;
      } else if (bullCount === 2 && bearCount === 0) {
        alignment = 'LEAN_BULLISH';
        trendScore = 12;
      } else if (bullCount === 2 && bearCount === 1) {
        alignment = 'LEAN_BULLISH';
        trendScore = 5;
      } else if (bearCount === 3) {
        alignment = 'BEARISH';
        trendScore = -20;
      } else if (bearCount === 2 && bullCount === 0) {
        alignment = 'LEAN_BEARISH';
        trendScore = -12;
      } else if (bearCount === 2 && bullCount === 1) {
        alignment = 'LEAN_BEARISH';
        trendScore = -5;
      } else {
        alignment = 'MIXED';
        trendScore = 0;
      }

      const closes4H = h4Bars.map(b => b.close);
      const closesDaily = dailyBars.map(b => b.close);
      const rsi4H = this.calculateRSI(closes4H, 14);
      const rsiDaily = this.calculateRSI(closesDaily, 14);

      let rsiRegime: TrendAnalysis['rsiRegime'] = 'NEUTRAL';
      if (rsiDaily > 70) rsiRegime = 'OVERBOUGHT';
      else if (rsiDaily < 30) rsiRegime = 'OVERSOLD';
      else if (rsiDaily > 55) rsiRegime = 'BULLISH';
      else if (rsiDaily < 45) rsiRegime = 'BEARISH';

      // RSI Bonus/Penalty
      if (rsiRegime === 'OVERSOLD') trendScore += 5; // Accumulation
      if (rsiRegime === 'OVERBOUGHT') trendScore -= 15; // High FOMO risk

      return { trend1H, trend4H, trendDaily, alignment, rsiRegime, trendScore };
    } catch {
      // API failure — return FAILED state to prevent false-positives
      return { trend1H: 'SIDEWAYS', trend4H: 'SIDEWAYS', trendDaily: 'SIDEWAYS', alignment: 'MIXED', rsiRegime: 'NEUTRAL', trendScore: -100 }; // -100 will trigger rejection
    }
  }

  // Simple in-memory cache for TradingView history
  private static tvCache: Map<string, { data: OHLCBar[]; expiry: number }> = new Map();

  public static async fetchCandles(symbol: string, resolution: string, from?: number, to?: number, headers?: any): Promise<OHLCBar[]> {
    const symbolClean = symbol.replace('_idr', '').toUpperCase();
    const tvSymbol = symbolClean.includes('IDR') ? symbolClean : `${symbolClean}IDR`;
    
    const now = Math.floor(Date.now() / 1000);
    const effectiveFrom = from || (now - 3600 * 24);
    const effectiveTo = to || now;

    // Cache key per symbol+resolution+time window (5 min TTL)
    const cacheKey = `${tvSymbol}_${resolution}_${Math.floor(effectiveFrom / 300)}_${Math.floor(effectiveTo / 300)}`;
    const cached = this.tvCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) return cached.data;

    const url = 'https://indodax.com/tradingview/history';
    try {
      const res = await axios.get(url, {
        params: { symbol: tvSymbol, resolution, from: effectiveFrom, to: effectiveTo },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://indodax.com/'
        },
        timeout: 8000
      });

      const d = res.data;
      if (!d || d.s !== 'ok' || !d.t) return [];

      const bars: OHLCBar[] = d.t.map((t: number, i: number) => ({
        time:  t,
        open:  parseFloat(d.o[i]),
        high:  parseFloat(d.h[i]),
        low:   parseFloat(d.l[i]),
        close: parseFloat(d.c[i]),
        volume: parseFloat(d.v[i] || "0"),
      }));

      // Cache for 5 min
      this.tvCache.set(cacheKey, { data: bars, expiry: Date.now() + 300_000 });
      return bars;
    } catch {
      return [];
    }
  }

  /**
   * Simple HH/HL or LL/LH detection using EMA crossover proxy
   * Uses last 14 bars: EMA7 vs EMA14
   */
  private static detectTrend(bars: OHLCBar[]): 'UP' | 'DOWN' | 'SIDEWAYS' {
    if (bars.length < 5) return 'SIDEWAYS';

    const closes = bars.map(b => b.close);
    const ema7   = this.ema(closes, 7);
    const ema14  = this.ema(closes, 14);

    const lastEma7  = ema7[ema7.length - 1];
    const lastEma14 = ema14[ema14.length - 1];
    const prevEma7  = ema7[ema7.length - 2] || lastEma7;
    const prevEma14 = ema14[ema14.length - 2] || lastEma14;

    // Bull: EMA7 > EMA14 and rising
    if (lastEma7 > lastEma14 && lastEma7 > prevEma7) return 'UP';
    // Bear: EMA7 < EMA14 and falling
    if (lastEma7 < lastEma14 && lastEma7 < prevEma7) return 'DOWN';
    return 'SIDEWAYS';
  }

  private static ema(values: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const result: number[] = [];
    let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    result.push(prev);
    for (let i = period; i < values.length; i++) {
      prev = values[i] * k + prev * (1 - k);
      result.push(prev);
    }
    return result;
  }

  // ============================================================
  // RSI (Relative Strength Index) CALCULATOR
  // ============================================================
  private static calculateRSI(closes: number[], period: number = 14): number {
    if (closes.length <= period) return 50; // Default neutral

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const difference = closes[i] - closes[i - 1];
      if (difference >= 0) gains += difference;
      else losses -= difference;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < closes.length; i++) {
      const difference = closes[i] - closes[i - 1];
      if (difference >= 0) {
        avgGain = (avgGain * (period - 1) + difference) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) - difference) / period;
      }
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  // ============================================================
  // SMART MONEY CONCEPT (SMC) DETECTOR
  // ============================================================
  public static async analyzeSMC(pair: string): Promise<{
    bos: 'BULLISH' | 'BEARISH' | 'NONE';
    choch: 'BULLISH' | 'BEARISH' | 'NONE';
    liquiditySweep: 'BUY_SIDE' | 'SELL_SIDE' | 'NONE';
    orderBlock: number;
    summary: string;
  }> {
    try {
      const h4Bars = await this.fetchCandles(pair, '240'); // 4H chart for institutional view
      if (h4Bars.length < 10) return this.neutralSMC();

      const last = h4Bars[h4Bars.length - 1];
      
      // Swing High / Low (Simplified 10-bar window excluding current)
      const recentBars = h4Bars.slice(-11, -1);
      const swingHigh = Math.max(...recentBars.map(b => b.high));
      const swingLow = Math.min(...recentBars.map(b => b.low));

      let bos: 'BULLISH' | 'BEARISH' | 'NONE' = 'NONE';
      let choch: 'BULLISH' | 'BEARISH' | 'NONE' = 'NONE';
      let liquiditySweep: 'BUY_SIDE' | 'SELL_SIDE' | 'NONE' = 'NONE';
      let orderBlock = 0;

      // 1. Detect BoS (Break of Structure) & ChoCh (Change of Character)
      if (last.close > swingHigh) {
        bos = 'BULLISH';
        choch = 'BULLISH';
      } else if (last.close < swingLow) {
        bos = 'BEARISH';
        choch = 'BEARISH';
      }

      // 2. Detect Liquidity Sweep
      // High sweeps swing high but closes below it (Bull Trap / Buy-side sweep)
      if (last.high > swingHigh && last.close < swingHigh) {
        liquiditySweep = 'BUY_SIDE';
      }
      // Low sweeps swing low but closes above it (Bear Trap / Sell-side sweep)
      else if (last.low < swingLow && last.close > swingLow) {
        liquiditySweep = 'SELL_SIDE';
      }

      // 3. Detect Order Block (Bullish OB = Last down candle before strong up move)
      if (bos === 'BULLISH') {
         const obCandle = h4Bars.slice(-4, -1).reduce((min, b) => b.low < min.low ? b : min);
         if (obCandle.close < obCandle.open) { // Must be a bearish candle
            orderBlock = obCandle.low;
         }
      }

      let summary = ``;
      if (bos !== 'NONE') summary += `[${bos} BoS] `;
      if (liquiditySweep !== 'NONE') summary += `[Swept ${liquiditySweep}] `;
      if (orderBlock > 0) summary += `[OB: ${orderBlock.toLocaleString()}]`;
      if (summary === ``) summary = "[Accumulation/Distribution inside range]";

      return { bos, choch, liquiditySweep, orderBlock, summary: summary.trim() };

    } catch (e) {
      return this.neutralSMC();
    }
  }

  private static neutralSMC() {
    return { bos: 'NONE' as const, choch: 'NONE' as const, liquiditySweep: 'NONE' as const, orderBlock: 0, summary: 'Data tidak tersedia' };
  }

  // ============================================================
  // 2. ORDERBOOK TRAP DETECTION
  // ============================================================
  public static async analyzeOrderbook(pair: string): Promise<OrderbookAnalysis> {
    try {
      const data = await IndodaxPublicAPI.getDepth(pair);
      const buy = data.buy;
      const sell = data.sell;

      if (!buy?.length || !sell?.length) {
        return this.neutralOB();
      }

      const bids: [number, number][] = buy.map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]);
      const asks: [number, number][] = sell.map((s: string[]) => [parseFloat(s[0]), parseFloat(s[1])]);

      const bestBid = bids[0]?.[0] || 0;
      const bestAsk = asks[0]?.[0] || 0;

      // Total IDR value in bid/ask walls (top 20 levels)
      const bidIdr = bids.slice(0, 20).reduce((sum, [p, q]) => sum + p * q, 0);
      const askIdr = asks.slice(0, 20).reduce((sum, [p, q]) => sum + p * q, 0);
      const total  = bidIdr + askIdr || 1;

      const bidWallStrength = Math.min(100, (bidIdr / total) * 100);
      const askWallStrength = Math.min(100, (askIdr / total) * 100);

      // Spoof Wall Detection: a single level > 30% of total book volume
      const maxBidLevel = Math.max(...bids.slice(0, 10).map(([p, q]) => p * q));
      const maxAskLevel = Math.max(...asks.slice(0, 10).map(([p, q]) => p * q));
      // Spoof Wall: single level > 25% of total book (lebih ketat dari sebelumnya 40%)
      const hasSpoofWall = maxBidLevel > bidIdr * 0.25 || maxAskLevel > askIdr * 0.25;

      // Whale Absorbing: bid wall strength >> ask wall (smart money loading)
      const whaleAbsorbing = bidWallStrength > 65;

      // Delta Volume: selisih bid vs ask IDR (positif = lebih banyak buyer)
      const deltaVolume = bidIdr - askIdr;

      // Absorption Detection: ask wall sangat kuat tapi harga tidak turun = seller absorb buying
      // Ini tanda bahaya — ada hidden seller besar
      const isAbsorbing = askWallStrength > 60 && bidWallStrength > 50;

      // OB Score
      let obScore = 0;
      if (whaleAbsorbing) obScore += 8;
      else if (bidWallStrength > 50) obScore += 4;
      if (hasSpoofWall) obScore -= 8;
      if (askWallStrength > 70) obScore -= 5;
      if (isAbsorbing) obScore -= 6;  // penalty untuk absorption
      if (deltaVolume > 0) obScore += 3; // bonus jika lebih banyak buyer

      const summary = [
        `Bid: ${bidWallStrength.toFixed(0)}% | Ask: ${askWallStrength.toFixed(0)}%`,
        `Δ: ${deltaVolume > 0 ? '+' : ''}${(deltaVolume / 1e6).toFixed(1)}M`,
        whaleAbsorbing ? '🐋 Whale Absorbing' : '',
        isAbsorbing    ? '⚠️ Seller Absorbing' : '',
        hasSpoofWall   ? '🚨 Spoof Wall' : '',
      ].filter(Boolean).join(' | ');

      return { bidWallStrength, askWallStrength, hasSpoofWall, whaleAbsorbing, isAbsorbing, deltaVolume, obScore, summary };
    } catch {
      return this.neutralOB();
    }
  }

  private static neutralOB(): OrderbookAnalysis {
    return { bidWallStrength: 50, askWallStrength: 50, hasSpoofWall: false, whaleAbsorbing: false, isAbsorbing: false, deltaVolume: 0, obScore: 0, summary: 'No data' };
  }

  // ============================================================
  // 3. ATR-BASED DYNAMIC TARGETS
  // ============================================================
  public static async calculateATRTargets(pair: string, entryPrice: number): Promise<ATRTarget> {
    try {
      const symbolClean = pair.replace('_idr', '').toUpperCase();
      const tvSymbol = `${symbolClean}IDR`;
      const now      = Math.floor(Date.now() / 1000);
      // Fetch 1H bars (last 14) to compute ATR(14) — cached
      const bars = await this.fetchCandles(tvSymbol, '60', now - 20 * 3600, now);

      if (bars.length < 5) {
        // Fallback: ATR = 3% of price
        const atr = entryPrice * 0.03;
        return this.buildTargets(entryPrice, atr);
      }

      // ATR = Wilder's ATR(14)
      const atr = this.calcATR(bars, 14);
      return this.buildTargets(entryPrice, atr);
    } catch {
      const atr = entryPrice * 0.03;
      return this.buildTargets(entryPrice, atr);
    }
  }

  private static buildTargets(entry: number, atr: number): ATRTarget {
    const atrPct = (atr / entry) * 100;
    const sl     = entry - 1.5 * atr;    // SL: 1.5x ATR below entry
    const tp1    = entry + 1.5 * atr;    // TP1: 1:1 R:R minimum
    const tp2    = entry + 3.0 * atr;    // TP2: 1:2 R:R (trailing zone)
    const rrRatio = (tp1 - entry) / (entry - sl);

    return { atr, atrPct, sl, tp1, tp2, rrRatio };
  }

  private static calcATR(bars: OHLCBar[], period: number): number {
    const trueRanges: number[] = [];
    for (let i = 1; i < bars.length; i++) {
      const tr = Math.max(
        bars[i].high - bars[i].low,
        Math.abs(bars[i].high - bars[i - 1].close),
        Math.abs(bars[i].low  - bars[i - 1].close)
      );
      trueRanges.push(tr);
    }
    if (trueRanges.length === 0) return 0;
    // Simple average for first ATR, then Wilder's smooth
    const firstATR = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / Math.min(period, trueRanges.length);
    let atr = firstATR;
    for (let i = period; i < trueRanges.length; i++) {
      atr = (atr * (period - 1) + trueRanges[i]) / period;
    }
    return atr;
  }
}
