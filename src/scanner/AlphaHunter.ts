import axios from 'axios';
import { IndodaxPublicAPI } from '../core/IndodaxPublicAPI';
import { MarketIntelligence } from './MarketIntelligence';
import { MacroRegimeEngine } from '../predator/macro';
import { DynamicScanner } from '../predator/scanner';
import { NarrativeEngine } from '../narrative/engine';
import { CacheDomain } from '../modules/system/CacheDomain';

// ============================================================
// TYPES
// ============================================================

export interface CoinProfile {
  symbol: string;           // e.g. "fet"
  pair: string;             // e.g. "fet_idr"
  name: string;
  type: 'MIDCAP' | 'LOWCAP' | 'BLUECHIP' | 'UNKNOWN';
  marketCapRank: number;
  marketCapUsd: number;
  // Indodax Data
  priceIdr: number;
  high24h: number;
  low24h: number;
  volIdr: number;
  spread: number;           // % spread bid/ask
  positionIn24hRange: number; // 0-100%
  // Scores
  // Scores (New CTO Weights)
  trendScore: number;       // Max 25
  momentumScore: number;    // Max 20
  volumeScore: number;      // Max 15
  btcContextScore: number;  // Max 20
  spreadScore: number;      // Max 10
  rrScore: number;          // Max 10
  totalScore: number;       // Max 100
  // Signal
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  whyBuy: string;
  rejected: boolean;
  rejectReason?: string;
  // Intelligence
  trendAlignment?: string;
  obSummary?: string;
}

export interface MacroContext {
  fearGreedIndex: number;   // 0-100 (0=Fear, 100=Greed)
  fearGreedLabel: string;
  btcDominance: number;     // % BTC dominance
  marketRegime: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL';
  macroScore: number;       // 0-20
}

// ============================================================
// ALPHA HUNTER ENGINE
// ============================================================

export class AlphaHunter {
  private geminiKey?: string;

  // Tidak ada REJECT_LIST — biarkan pasar yang bicara.
  // Filter murni berdasarkan spread dan volume, bukan nama koin.
  private readonly STABLECOIN_LIST = ['usdt', 'usdc', 'dai', 'busd', 'tusd', 'bidr'];

  constructor() {
    const geminiEnv = process.env.GEMINI_API_KEY || "";
    const keys = geminiEnv.split(',').map(k => k.trim()).filter(k => k.length > 10);
    this.geminiKey = keys[0]; // Use first valid key
  }

  // ============================================================
  // MAIN: HUNT TOP OPPORTUNITIES
  // ============================================================
  public async hunt(topN: number = 10): Promise<CoinProfile[]> {
    console.log('\n⚡ [ALPHA OMEGA: SCAN MODE] Memulai pencarian Asymmetric Edge...');

    // Step 1: Macro Context (Global)
    const { regime, metrics } = await MacroRegimeEngine.getCurrentRegime();
    const filters = DynamicScanner.getFilters(regime);
    const narrativeReport = await NarrativeEngine.generateReport();
    
    const macro: MacroContext = {
      fearGreedIndex: metrics.fearAndGreed,
      fearGreedLabel: metrics.fearAndGreed > 60 ? 'Greed' : metrics.fearAndGreed < 40 ? 'Fear' : 'Neutral',
      btcDominance: 50, 
      marketRegime: regime === 'PREDATOR' ? 'RISK_ON' : regime === 'DEFENSE' ? 'RISK_OFF' : 'NEUTRAL',
      macroScore: metrics.fearAndGreed / 5
    };
    
    console.log(`\n🌐 [MACRO] F&G: ${metrics.fearAndGreed} | BTC Trend: ${metrics.btcTrend} | Regime: ${regime}`);
    console.log(`🧠 [NARRATIVE] Hot: ${narrativeReport.hotNow.slice(0, 3).map(n => `${n.type} (${n.score})`).join(', ')}`);
    console.log(`🛡️ [DYNAMIC FILTER] Min Vol: ${filters.minVolume.toLocaleString()} | Max Spread: ${filters.maxSpread}% | Min Score: ${filters.minScore}`);

    // Step 2: Get all Indodax pairs + all tickers (2 API calls total)
    console.log('\n📡 [SCANNER] Mengambil semua koin dari Indodax...');
    const [allPairs, allTickers] = await Promise.all([
      IndodaxPublicAPI.getAllPairs(),
      IndodaxPublicAPI.getAllTickers()
    ]);

    const idrPairs = allPairs.map(p => ({
      symbol: p.symbol,
      pair:   `${p.symbol}_idr`
    }));

    // Step 3: QUICK FILTER - Reduce 510 pairs to top 50 by 24h Volume (Speed Hack)
    const quickShortlist = idrPairs
      .map(p => ({ ...p, ticker: allTickers[`${p.symbol}_idr`] || allTickers[`${p.symbol}idr`] }))
      .filter(p => p.ticker && parseFloat(p.ticker.vol_idr) > 1_000_000) // At least 1M volume
      .sort((a, b) => parseFloat(b.ticker?.vol_idr || '0') - parseFloat(a.ticker?.vol_idr || '0'))
      .slice(0, 50);

    console.log(`   ⚡ [QUICK SCAN] Shortlisted ${quickShortlist.length} most liquid pairs.`);

    // Step 4: Get Cached CoinGecko data
    console.log('📊 [COINGECKO] Fetching market data (Cached)...');
    let cgData = CacheDomain.get<any[]>('cg_markets');
    if (!cgData) {
      cgData = await this.getCoinGeckoMarkets();
      CacheDomain.set('cg_markets', cgData, 600); // 10 min cache
      console.log(`   ✓ Fetched 500 koin from CoinGecko API.`);
    } else {
      console.log(`   ✓ Using 10-minute cache for CoinGecko.`);
    }

    const cgMap = new Map<string, any>();
    for (const coin of cgData || []) {
      cgMap.set(coin.symbol.toLowerCase(), coin);
    }

    // Ticker_all keys: try 'btcidr' format (no underscore) first
    const tickerKeys = Object.keys(allTickers);
    const usesUnderscore = tickerKeys.length > 0 && tickerKeys[0].includes('_');

    // Step 4: Score every pair
    const candidates: CoinProfile[] = [];
    let rejectedSpread = 0;
    let rejectedVolume = 0;
    let rejectedNoTicker = 0;

    for (const { symbol, pair, ticker } of (quickShortlist as any)) {
      if (this.STABLECOIN_LIST.includes(symbol)) continue;
      if (!ticker) { rejectedNoTicker++; continue; }


      const priceIdr = parseFloat(ticker.last) || 0;
      const high24h  = parseFloat(ticker.high)  || priceIdr;
      const low24h   = parseFloat(ticker.low)   || priceIdr;
      const volIdr   = parseFloat(ticker.vol_idr) || 0;
      // FIX: In Indodax API, buy = best bid (harga beli), sell = best ask (harga jual)
      const bestBid  = parseFloat(ticker.buy)  || 0;
      const bestAsk  = parseFloat(ticker.sell) || 0;
      const spread   = bestAsk > 0 && bestBid > 0 ? ((bestAsk - bestBid) / bestAsk) * 100 : 9.9;

      if (priceIdr === 0 || volIdr === 0) continue;

      const range = high24h - low24h || 1;
      const positionIn24hRange = ((priceIdr - low24h) / range) * 100;

      // === NEW PENALTY SYSTEM (CTO REVISION) ===
      let penalty = 0;
      if (spread > filters.maxSpread) penalty -= 15;
      if (volIdr < filters.minVolume) penalty -= 10;




      // CoinGecko match
      const cg = cgMap.get(symbol);
      const rank = cg?.market_cap_rank || 9999;
      const mcapUsd = cg?.market_cap || 0;

      // Klasifikasi tipe koin berdasarkan rank CoinGecko
      // SEMUA tipe diproses — tidak ada yang dibuang berdasarkan ukuran
      let type: CoinProfile['type'] = 'UNKNOWN';
      if (rank >= 1 && rank <= 49) type = 'BLUECHIP';
      else if (rank >= 50 && rank <= 250) type = 'MIDCAP';
      else if (rank >= 251 && rank <= 1000) type = 'LOWCAP';
      else type = 'UNKNOWN'; // Koin sangat kecil / tidak terdaftar CG

      // PRE-SCORE menggunakan fungsi scoring yang sudah ada
      const fundamentalScore = this.scoreFundamental(cg, rank);
      const technicalScore = this.scoreTechnical(priceIdr, high24h, low24h, volIdr, spread, positionIn24hRange);

      // Narrative Score
      const narrativeType = require('../narrative/mapper').NarrativeMapper.getNarrativeForPair(pair);
      const narrativeInsight = narrativeReport.hotNow.find(n => n.type === narrativeType);
      const narrativeScore = narrativeInsight ? narrativeInsight.score / 5 : 5;

      // Diversifikasi bonus: bluechip dan midcap dapat bonus agar tidak kalah dari meme
      let diversityBonus = 0;
      if (type === 'BLUECHIP') diversityBonus = 12;       // BTC, ETH, SOL, BNB, XRP
      else if (type === 'MIDCAP') diversityBonus = 6;     // ADA, DOT, AVAX, dll
      // Meme coin tidak dapat bonus — mereka sudah dapat dari narrative

      const preScore = fundamentalScore + technicalScore + narrativeScore + diversityBonus + penalty;


      // Entry/SL/TP menggunakan ATR-based (akan di-override di step Market Intelligence)
      // SL sementara: max 3% di bawah harga sekarang (bukan 24h low yang bisa sangat jauh)
      const entry = priceIdr;
      const sl = Math.max(low24h, priceIdr * 0.97); // max 3% SL, tidak lebih rendah dari 24h low
      const tp1 = entry * 1.04;
      const tp2 = entry * 1.08;

      // Hitung komponen individual untuk totalScore recalculation di step Market Intelligence
      const volScore = volIdr > 2_000_000_000 ? 15 : volIdr > 500_000_000 ? 12 : volIdr > 100_000_000 ? 8 : 3;
      const sprdScore = spread < 0.2 ? 10 : spread < 0.5 ? 7 : spread < 0.8 ? 4 : 0;
      const momScore = positionIn24hRange >= 20 && positionIn24hRange <= 50 ? 20 :
                       positionIn24hRange > 50 && positionIn24hRange <= 80 ? 15 :
                       positionIn24hRange > 80 ? 5 : 10;

      candidates.push({
        symbol, pair, name: cg?.name || symbol.toUpperCase(),
        type, marketCapRank: rank, marketCapUsd: mcapUsd,
        priceIdr, high24h, low24h, volIdr, spread,
        positionIn24hRange,
        trendScore: 0,
        momentumScore: momScore,
        volumeScore: volScore,
        btcContextScore: macro.macroScore,
        spreadScore: sprdScore,
        rrScore: 0,
        totalScore: Math.max(0, preScore),
        entry: priceIdr,
        sl: Math.max(low24h, priceIdr * 0.97),
        tp1: priceIdr * 1.04,
        tp2: priceIdr * 1.08,
        whyBuy: '',
        rejected: false
      });

    }

    // Step 5: Pre-Rank — Biarkan algoritma scoring yang menentukan pemenangnya (Termasuk Bluechip)
    const topScorers = candidates
      .filter(c => !c.rejected)
      .sort((a, b) => b.totalScore - a.totalScore);

    const preValid = topScorers.slice(0, 15); // Ambil top 15 untuk dianalisis lebih dalam
    let rejectedDowntrend = 0;
    let rejectedSpoof = 0;

    console.log(`\n🧠 [MARKET INTELLIGENCE] Menganalisa Trend, Orderbook, dan ATR untuk Top ${preValid.length} kandidat...`);
    
    // Process sequentially or in small batches to avoid rate limits
    for (const c of preValid) {
      // Delay 300ms to avoid burst block
      await new Promise(r => setTimeout(r, 300));

      const [trend, ob, atr, vol5mBars] = await Promise.all([
        MarketIntelligence.analyzeTrend(c.pair),
        MarketIntelligence.analyzeOrderbook(c.pair),
        MarketIntelligence.calculateATRTargets(c.pair, c.priceIdr),
        MarketIntelligence.fetchCandles(c.pair, '5')
      ]);

      const recentVolIdr = vol5mBars.slice(-3).reduce((sum, b) => sum + b.volume, 0);
      
      c.trendAlignment = trend.alignment;
      c.obSummary = ob.summary;

      // === TREND SCORE (Max 25) ===
      c.trendScore = trend.alignment === 'BULLISH'      ? 25 :
                     trend.alignment === 'MOMENTUM'     ? 22 :
                     trend.alignment === 'RANGE_BREAKOUT' ? 20 :
                     trend.alignment === 'LEAN_BULLISH' ? 18 :
                     trend.alignment === 'ACCUMULATION' ? 14 : // Setup bagus untuk entry awal
                     trend.alignment === 'MIXED'        ? 8  : 0;

      if (trend.trendScore > 10) c.trendScore = Math.min(25, c.trendScore + 5);
      if (trend.rsiRegime === 'OVERSOLD')   c.trendScore = Math.min(25, c.trendScore + 5);
      else if (trend.rsiRegime === 'OVERBOUGHT') c.trendScore = Math.max(0, c.trendScore - 10);

      // Risk/Reward Score (Max 10)
      c.rrScore = atr.rrRatio >= 2.0 ? 10 : atr.rrRatio >= 1.5 ? 6 : atr.rrRatio >= 1.0 ? 3 : 0;

      // Final Total Score Recalculation
      c.totalScore = c.trendScore + c.momentumScore + c.volumeScore + c.btcContextScore + c.spreadScore + c.rrScore + ob.obScore;
      
      console.log(`   - ${c.pair.toUpperCase()} | Trend: ${c.trendAlignment} | RSI: ${trend.rsiRegime} | Score: ${c.totalScore}`);

      // Update Targets with ATR
      c.entry = c.priceIdr;
      c.sl = atr.sl;
      c.tp1 = atr.tp1;
      c.tp2 = atr.tp2;

      // Hard Filters (Refined with Dynamic Volume)
      if (trend.alignment === 'BEARISH' || trend.alignment === 'LEAN_BEARISH') {
        c.rejected = true;
        c.rejectReason = `Downtrend (${trend.alignment})`;
        rejectedDowntrend++;
      } else if (ob.hasSpoofWall) {
        c.rejected = true;
        c.rejectReason = 'Terdeteksi Spoof Wall (Manipulasi)';
        rejectedSpoof++;
      } else if (recentVolIdr < 200000 && c.volIdr < 50_000_000 && c.totalScore < 85) { 
        c.rejected = true;
        c.rejectReason = `Volume mati (15m: Rp ${Math.round(recentVolIdr).toLocaleString()}, 24h: Rp ${Math.round(c.volIdr).toLocaleString()})`;
        rejectedVolume++;
      }
    }

    // Final Rank after Intelligence (CTO REVISION)
    const sorted = preValid
      .filter(c => !c.rejected)
      .sort((a, b) => b.totalScore - a.totalScore);

    const entryCandidates = sorted.filter(c => c.totalScore >= filters.minScore);
    const watchlistCandidates = sorted.filter(c => c.totalScore < filters.minScore && c.totalScore >= 55);

    const valid = entryCandidates.slice(0, topN);

    console.log(`\n📊 [ALPHA HUNTER SUMMARY]`);
    console.log(`   ✓ ${idrPairs.length} pair IDR ditemukan`);
    console.log(`   ✗ ${rejectedNoTicker} tanpa data ticker`);
    console.log(`   ✗ ${rejectedDowntrend} ditolak: Downtrend Multi-Timeframe`);
    console.log(`   ✗ ${rejectedSpoof} ditolak: Spoof Wall / Manipulasi`);
    
    console.log(`\n🔥 [CANDIDATES]`);
    if (valid.length > 0) {
      valid.forEach(c => console.log(`   ✅ ENTRY     : ${c.pair.toUpperCase()} (Score: ${c.totalScore.toFixed(1)}) | Trend: ${c.trendAlignment}`));
    } else {
      console.log(`   ❌ ENTRY     : No candidates passed threshold (${filters.minScore})`);
      // Fallback: If no entry but high watchlist, show them clearly
      if (watchlistCandidates.length > 0) {
        console.log(`   💡 Fallback : Picking top 3 from watchlist for Predator targeting.`);
      }
    }

    if (watchlistCandidates.length > 0) {
      watchlistCandidates.slice(0, 3).forEach(c => console.log(`   👀 WATCHLIST : ${c.pair.toUpperCase()} (Score: ${c.totalScore.toFixed(1)}) | Trend: ${c.trendAlignment}`));
    }

    // FINAL REJECTION LOG (Why didn't they make it?)
    const failedToPass = preValid.filter(c => c.rejected).slice(0, 5);
    if (failedToPass.length > 0) {
       console.log(`\n🚫 [REJECTED REASON]`);
       failedToPass.forEach(c => console.log(`   ✗ ${c.pair.toUpperCase()}: ${c.rejectReason}`));
    }

    if (valid.length === 0 && watchlistCandidates.length === 0) {
      console.log('\n   ❌ Tidak ada peluang hari ini. Market lemah atau semua koin sudah pump.');
      return [];
    }

    // Step 6: AI Enrichment (Trade of the Day reasoning)
    const toEnrich = valid.length > 0 ? valid : watchlistCandidates;
    
    // Predator Target Update: Top ENTRY or top WATCHLIST
    const predatorTargets = toEnrich.slice(0, 5).map(c => c.pair);
    console.log(`\n🦅 [PREDATOR TARGETS]: ${predatorTargets.join(', ').toUpperCase()}`);

    if (this.geminiKey && toEnrich.length > 0) {
      console.log(`\n🧠 [GEMINI AI] Menyusun Smart Entry Thesis untuk Top Candidate...`);
      await this.enrichWithAI(toEnrich.slice(0, 1), macro); 
    }

    return toEnrich.slice(0, topN); // Return entry candidates or top watchlist
  }


  // ============================================================
  // MACRO CONTEXT (Fear & Greed + BTC Dominance)
  // ============================================================
  private async getMacroContext(): Promise<MacroContext> {
    try {
      const [fgRes, globalRes] = await Promise.allSettled([
        axios.get('https://api.alternative.me/fng/?limit=1'),
        axios.get('https://api.coingecko.com/api/v3/global')
      ]);

      let fearGreedIndex = 50;
      let fearGreedLabel = 'Neutral';
      if (fgRes.status === 'fulfilled') {
        fearGreedIndex = parseInt(fgRes.value.data.data?.[0]?.value || '50');
        fearGreedLabel = fgRes.value.data.data?.[0]?.value_classification || 'Neutral';
      }

      let btcDominance = 50;
      if (globalRes.status === 'fulfilled') {
        btcDominance = globalRes.value.data.data?.market_cap_percentage?.btc || 50;
      }

      // Regime detection
      let marketRegime: MacroContext['marketRegime'] = 'NEUTRAL';
      if (fearGreedIndex >= 55 && btcDominance < 55) marketRegime = 'RISK_ON';
      else if (fearGreedIndex <= 30 || btcDominance > 60) marketRegime = 'RISK_OFF';

      // Macro score 0-20
      let macroScore = 10; // neutral baseline
      if (marketRegime === 'RISK_ON') macroScore = 18;
      else if (marketRegime === 'RISK_OFF') macroScore = 4;
      // Bonus: Extreme Fear = accumulation opportunity
      if (fearGreedIndex < 20) macroScore = 14; // contrarian play

      return { fearGreedIndex, fearGreedLabel, btcDominance, marketRegime, macroScore };
    } catch {
      return { fearGreedIndex: 50, fearGreedLabel: 'Neutral', btcDominance: 50, marketRegime: 'NEUTRAL', macroScore: 10 };
    }
  }

  // ============================================================
  // COINGECKO: Get market data for up to 250 coins (ranks 1-500)
  // ============================================================
  private async getCoinGeckoMarkets(): Promise<any[]> {
    try {
      const [page1, page2] = await Promise.allSettled([
        axios.get('https://api.coingecko.com/api/v3/coins/markets', {
          params: { vs_currency: 'usd', order: 'market_cap_desc', per_page: 250, page: 1, sparkline: false }
        }),
        axios.get('https://api.coingecko.com/api/v3/coins/markets', {
          params: { vs_currency: 'usd', order: 'market_cap_desc', per_page: 250, page: 2, sparkline: false }
        })
      ]);

      const results: any[] = [];
      if (page1.status === 'fulfilled') results.push(...page1.value.data);
      if (page2.status === 'fulfilled') results.push(...page2.value.data);
      return results;
    } catch {
      return [];
    }
  }

  // ============================================================
  // SCORING: Fundamental (0-40)
  // ============================================================
  private scoreFundamental(cg: any, rank: number): number {
    if (!cg) return 10;

    let score = 0;

    // Rank bonus (lower rank = stronger)
    if (rank <= 100) score += 20;
    else if (rank <= 200) score += 15;
    else if (rank <= 350) score += 10;
    else score += 5;

    // 24h price change on CoinGecko
    const change24h = cg.price_change_percentage_24h || 0;
    if (change24h > 5) score += 10;
    else if (change24h > 2) score += 7;
    else if (change24h > 0) score += 4;
    else if (change24h > -3) score += 2;
    else score -= 2;

    // Volume / Market Cap ratio (healthy = 0.1+)
    const volToMcap = cg.market_cap > 0 ? (cg.total_volume / cg.market_cap) : 0;
    if (volToMcap > 0.3) score += 10;
    else if (volToMcap > 0.1) score += 6;
    else if (volToMcap > 0.05) score += 2;

    return Math.max(0, Math.min(40, score));
  }

  // ============================================================
  // SCORING: Technical (0-40)
  // ============================================================
  private scoreTechnical(
    price: number, high: number, low: number,
    volIdr: number, spread: number, position: number
  ): number {
    let score = 0;

    // Position in 24h range (sweet spot: accumulation zone 20-40%)
    if (position >= 20 && position <= 45) score += 15;      // Support zone
    else if (position >= 45 && position <= 65) score += 8;  // Middle range
    else if (position > 65) score += 3;                     // Near top (FOMO risk)
    else score += 10;                                       // Very low = potential bounce

    // Volume (higher Indodax IDR volume = more liquid & tradeable)
    if (volIdr > 1_000_000_000) score += 15;
    else if (volIdr > 100_000_000) score += 12;
    else if (volIdr > 20_000_000) score += 8;
    else score += 3;

    // Spread quality
    if (spread < 0.2) score += 10;
    else if (spread < 0.5) score += 7;
    else if (spread < 0.8) score += 4;
    else score += 1;

    return Math.max(0, Math.min(40, score));
  }

  // ============================================================
  // AI ENRICHMENT: Generate "Why Buy" for top picks
  // ============================================================
  private async enrichWithAI(candidates: CoinProfile[], macro: MacroContext): Promise<void> {
    if (!this.geminiKey) return;

    const brief = candidates.map(c =>
      `${c.pair.toUpperCase()} | Rank ${c.marketCapRank} | Score ${c.totalScore} | Vol Rp ${(c.volIdr / 1e9).toFixed(2)}B | Spread ${c.spread.toFixed(2)}% | Position in range ${c.positionIn24hRange.toFixed(0)}%`
    ).join('\n');

    const prompt = `Kamu adalah Chief Quant Trader di desk institusional. Market regime: ${macro.marketRegime}. Fear&Greed: ${macro.fearGreedIndex}. BTC Dom: ${macro.btcDominance.toFixed(1)}%.

Kandidat "Trade of the Day" dari mesin AlphaHunter:
${brief}

Berikan "Smart Entry Thesis" singkat (1-2 kalimat). Fokus pada: Breakout valid, Pullback ke support, Liquidity sweep, atau Volume spike.
Gunakan format JSON array eksak:
[{"pair": "...", "whyBuy": "..."}]`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${this.geminiKey}`;
      
      const res = await axios.post(url, {
        contents: [{
          parts: [{ text: prompt }]
        }]
      });

      const raw = res.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) return;

      const parsed: { pair: string; whyBuy: string }[] = JSON.parse(match[0]);
      for (const item of parsed) {
        const target = candidates.find(c => c.pair === item.pair.toLowerCase());
        if (target) target.whyBuy = item.whyBuy;
      }
    } catch {
      // AI enrichment is best-effort, no crash
    }
  }

  // ============================================================
  // HELPER
  // ============================================================
  private makeRejected(symbol: string, pair: string, price: number, vol: number, reason: string): CoinProfile {
    return {
      symbol, pair, name: symbol.toUpperCase(),
      type: 'UNKNOWN', marketCapRank: 9999, marketCapUsd: 0,
      priceIdr: price, high24h: 0, low24h: 0, volIdr: vol, spread: 99,
      positionIn24hRange: 0, trendScore: 0, momentumScore: 0, volumeScore: 0,
      btcContextScore: 0, spreadScore: 0, rrScore: 0, totalScore: 0, entry: price, sl: 0, tp1: 0, tp2: 0,
      whyBuy: '', rejected: true, rejectReason: reason
    };
  }
}
