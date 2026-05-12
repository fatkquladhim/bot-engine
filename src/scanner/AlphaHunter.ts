import axios from 'axios';
import { IndodaxPublicAPI } from '../core/IndodaxPublicAPI';
import { MarketIntelligence } from './MarketIntelligence';
import { MacroRegimeEngine, MarketRegime } from '../predator/macro';
import { DynamicScanner } from '../predator/scanner';
import { NarrativeEngine } from '../narrative/engine';
import { CacheDomain } from '../modules/system/CacheDomain';
import { SMCEngine } from '../predator/smc';
import { NarrativeMapper, NarrativeType } from '../narrative/mapper';

// ============================================================
// TYPES
// ============================================================

export interface CoinProfile {
  symbol: string;
  pair: string;
  name: string;
  type: 'MIDCAP' | 'LOWCAP' | 'BLUECHIP' | 'UNKNOWN';
  marketCapRank: number;
  marketCapUsd: number;
  priceIdr: number;
  high24h: number;
  low24h: number;
  volIdr: number;
  spread: number;
  positionIn24hRange: number;
  trendScore: number;
  momentumScore: number;
  volumeScore: number;
  btcContextScore: number;
  spreadScore: number;
  rrScore: number;
  narrativeScore: number;
  smartMoneyProbability: number;
  volumeAcceleration: number;
  hypeLevel: number;
  explosivePotential: number;
  riskLevel: number;
  entryConfidence: number;
  totalScore: number;
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  whyBuy: string;
  rejected: boolean;
  rejectReason?: string;
  trendAlignment?: string;
  obSummary?: string;
  sector: NarrativeType;
}

export interface MacroContext {
  fearGreedIndex: number;
  fearGreedLabel: string;
  btcDominance: number;
  marketRegime: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL' | 'EXTREME_RISK_ON';
  macroScore: number;
}

// ============================================================
// ALPHA HUNTER ENGINE
// ============================================================

export class AlphaHunter {
  private geminiKey?: string;
  private readonly STABLECOIN_LIST = ['usdt', 'usdc', 'dai', 'busd', 'tusd', 'bidr'];

  constructor() {
    const geminiEnv = process.env.GEMINI_API_KEY || "";
    const keys = geminiEnv.split(',').map(k => k.trim()).filter(k => k.length > 10);
    this.geminiKey = keys[0];
  }

  public async hunt(topN: number = 10): Promise<CoinProfile[]> {
    console.log('\n⚡ [ALPHA OMEGA: SCAN MODE] Memulai pencarian Asymmetric Edge...');

    const { regime, metrics } = await MacroRegimeEngine.getCurrentRegime();
    const filters = DynamicScanner.getFilters(regime);
    const narrativeReport = await NarrativeEngine.generateReport();
    
    const macro: MacroContext = {
      fearGreedIndex: metrics.fearAndGreed,
      fearGreedLabel: metrics.fearAndGreed > 60 ? 'Greed' : metrics.fearAndGreed < 40 ? 'Fear' : 'Neutral',
      btcDominance: metrics.btcDominance || 50, 
      marketRegime: regime === MarketRegime.MEME_MANIA ? 'EXTREME_RISK_ON' : 
                   regime === MarketRegime.PREDATOR ? 'RISK_ON' : 
                   regime === MarketRegime.DEFENSE ? 'RISK_OFF' : 'NEUTRAL',
      macroScore: regime === MarketRegime.MEME_MANIA ? 20 : 
                 regime === MarketRegime.PREDATOR ? Math.min(20, metrics.fearAndGreed / 4) : 
                 metrics.fearAndGreed / 5
    };
    
    console.log(`\n🌐 [MACRO] F&G: ${metrics.fearAndGreed} | BTC Trend: ${metrics.btcTrend} | Regime: ${regime}`);
    console.log(`🧠 [NARRATIVE] Hot: ${narrativeReport.hotNow.slice(0, 3).map(n => `${n.type} (${n.score})`).join(', ')}`);
    console.log(`🛡️ [DYNAMIC FILTER] Min Vol: ${filters.minVolume.toLocaleString()} | Max Spread: ${filters.maxSpread}% | Min Score: ${filters.minScore}`);

    const [allPairs, allTickers] = await Promise.all([
      IndodaxPublicAPI.getAllPairs(),
      IndodaxPublicAPI.getAllTickers()
    ]);

    const idrPairs = allPairs.map(p => ({
      symbol: p.symbol,
      pair: `${p.symbol}_idr`
    }));

    const quickShortlist = idrPairs
      .map(p => ({ ...p, ticker: allTickers[`${p.symbol}_idr`] || allTickers[`${p.symbol}idr`] }))
      .filter(p => p.ticker && parseFloat(p.ticker.vol_idr) > 1_000_000)
      .sort((a, b) => parseFloat(b.ticker?.vol_idr || '0') - parseFloat(a.ticker?.vol_idr || '0'))
      .slice(0, 50);

    console.log(`   ⚡ [QUICK SCAN] Shortlisted ${quickShortlist.length} most liquid pairs.`);

    let cgData = CacheDomain.get<any[]>('cg_markets');
    if (!cgData) {
      cgData = await this.getCoinGeckoMarkets();
      CacheDomain.set('cg_markets', cgData, 600);
      console.log(`   ✓ Fetched 500 koin from CoinGecko API.`);
    }

    const cgMap = new Map<string, any>();
    for (const coin of cgData || []) {
      cgMap.set(coin.symbol.toLowerCase(), coin);
    }

    const candidates: CoinProfile[] = [];
    let rejectedNoTicker = 0;

    for (const { symbol, pair, ticker } of (quickShortlist as any)) {
      if (this.STABLECOIN_LIST.includes(symbol)) continue;
      if (!ticker) { rejectedNoTicker++; continue; }

      const priceIdr = parseFloat(ticker.last) || 0;
      const high24h = parseFloat(ticker.high) || priceIdr;
      const low24h = parseFloat(ticker.low) || priceIdr;
      const volIdr = parseFloat(ticker.vol_idr) || 0;
      const bestBid = parseFloat(ticker.buy) || 0;
      const bestAsk = parseFloat(ticker.sell) || 0;
      const spread = bestAsk > 0 && bestBid > 0 ? ((bestAsk - bestBid) / bestAsk) * 100 : 9.9;

      if (priceIdr === 0 || volIdr === 0) continue;

      const positionIn24hRange = ((priceIdr - low24h) / (high24h - low24h || 1)) * 100;

      let penalty = 0;
      if (spread > filters.maxSpread) penalty -= 15;
      if (volIdr < filters.minVolume) penalty -= 10;

      const cg = cgMap.get(symbol);
      const rank = cg?.market_cap_rank || 9999;
      const mcapUsd = cg?.market_cap || 0;

      let type: CoinProfile['type'] = 'UNKNOWN';
      if (rank >= 1 && rank <= 49) type = 'BLUECHIP';
      else if (rank >= 50 && rank <= 250) type = 'MIDCAP';
      else if (rank >= 251 && rank <= 1000) type = 'LOWCAP';

      const fundamentalScore = this.scoreFundamental(cg, rank);
      const technicalScore = this.scoreTechnical(priceIdr, high24h, low24h, volIdr, spread, positionIn24hRange);
      
      let diversityBonus = (type === 'BLUECHIP') ? 12 : (type === 'MIDCAP') ? 6 : 0;
      const preScore = fundamentalScore + technicalScore + diversityBonus + penalty;

      const volScore = volIdr > 2_000_000_000 ? 15 : volIdr > 500_000_000 ? 12 : volIdr > 100_000_000 ? 8 : 3;
      const sprdScore = spread < 0.2 ? 10 : spread < 0.5 ? 7 : spread < 0.8 ? 4 : 0;
      const momScore = positionIn24hRange >= 20 && positionIn24hRange <= 50 ? 20 :
                       positionIn24hRange > 50 && positionIn24hRange <= 80 ? 15 : 5;

      candidates.push({
        symbol, pair, name: cg?.name || symbol.toUpperCase(),
        type, marketCapRank: rank, marketCapUsd: mcapUsd,
        priceIdr, high24h, low24h, volIdr, spread,
        positionIn24hRange,
        trendScore: 0, momentumScore: momScore, volumeScore: volScore,
        btcContextScore: macro.macroScore, spreadScore: sprdScore, rrScore: 0,
        narrativeScore: 0, smartMoneyProbability: 0, volumeAcceleration: 0,
        hypeLevel: 0, explosivePotential: 0, riskLevel: 0, entryConfidence: 0,
        totalScore: Math.max(0, preScore),
        entry: priceIdr, sl: priceIdr * 0.97, tp1: priceIdr * 1.04, tp2: priceIdr * 1.08,
        whyBuy: '', rejected: false,
        sector: NarrativeMapper.getNarrativeForPair(pair)
      });
    }

    const preValid = candidates
      .filter(c => !c.rejected)
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 15);

    console.log(`\n🧠 [MARKET INTELLIGENCE] Menganalisa Trend, Orderbook, dan ATR untuk Top ${preValid.length} kandidat...`);
    
    let rejectedDowntrend = 0;
    let rejectedSpoof = 0;
    let rejectedVolume = 0;

    for (const c of preValid) {
      await new Promise(r => setTimeout(r, 1000));
      const [trend, ob, atr, smcSignal, candles] = await Promise.all([
        MarketIntelligence.analyzeTrend(c.pair),
        MarketIntelligence.analyzeOrderbook(c.pair),
        MarketIntelligence.calculateATRTargets(c.pair, c.priceIdr),
        SMCEngine.analyze(c.pair),
        MarketIntelligence.fetchCandles(c.pair, '5')
      ]);

      const recentVol = candles.slice(-3).reduce((sum, b) => sum + b.volume, 0);
      c.trendAlignment = trend.alignment;
      c.obSummary = ob.summary;

      c.trendScore = trend.alignment === 'BULLISH' ? 25 : trend.alignment === 'MOMENTUM' ? 22 : trend.alignment === 'RANGE_BREAKOUT' ? 20 : trend.alignment === 'ACCUMULATION' ? 14 : 0;
      c.rrScore = atr.rrRatio >= 1.5 ? 10 : 0;
      
      c.totalScore = c.trendScore + c.momentumScore + c.volumeScore + c.btcContextScore + c.spreadScore + c.rrScore + ob.obScore + (smcSignal.smcScore * 0.5);
      
      // SECTOR BOOST
      if (c.sector === NarrativeType.AI_AGENTS) c.totalScore += 12;
      else if (c.sector === NarrativeType.RWA_DEFI) c.totalScore += 10;
      else if (c.sector === NarrativeType.MEME_COINS && regime === MarketRegime.MEME_MANIA) c.totalScore += 15;

      c.narrativeScore = await NarrativeEngine.getNarrativeScore(c.pair);
      c.smartMoneyProbability = Math.min(100, smcSignal.smcScore * 2);
      c.volumeAcceleration = Math.min(100, (c.volIdr > 0) ? Math.log10(c.volIdr) * 10 : 0);
      c.hypeLevel = await this.getHypeLevelForPair(c.pair);
      c.explosivePotential = this.calculateExplosivePotential(trend, smcSignal, c.volIdr, c.priceIdr, c.high24h, c.low24h);
      c.riskLevel = this.calculateRiskLevel(c.spread, c.volIdr, trend, smcSignal);
      c.entryConfidence = this.calculateEntryConfidence(c.narrativeScore, c.smartMoneyProbability, c.volumeAcceleration, c.hypeLevel, c.explosivePotential, c.riskLevel, trend);

      console.log(`   - ${c.pair.toUpperCase()} [${c.sector}] | Trend: ${c.trendAlignment} | Score: ${c.totalScore.toFixed(1)}`);

      c.entry = c.priceIdr; c.sl = atr.sl; c.tp1 = atr.tp1; c.tp2 = atr.tp2;

      if (trend.alignment.includes('BEAR') || trend.trendScore <= -50) { 
        c.rejected = true; 
        c.rejectReason = trend.trendScore <= -50 ? 'API/Data Failure' : 'Downtrend'; 
        rejectedDowntrend++; 
      }
      else if (ob.hasSpoofWall) { c.rejected = true; c.rejectReason = 'Spoof Wall'; rejectedSpoof++; }
      else if (recentVol < 200000 && c.volIdr < 25000000) { c.rejected = true; c.rejectReason = 'Low Vol'; rejectedVolume++; }
      else if (trend.alignment === 'MIXED') { c.rejected = true; c.rejectReason = 'Mixed/No Bias'; rejectedDowntrend++; }
    }

    const valid = preValid.filter(c => !c.rejected && c.totalScore >= filters.minScore).slice(0, topN);
    
    console.log(`\n📊 [ALPHA HUNTER SUMMARY]`);
    console.log(`   ✓ ${candidates.length} pairs | ✗ ${rejectedDowntrend} Bear/Fail | ✗ ${rejectedSpoof} Spoof | ✗ ${rejectedVolume} Low Vol`);
    
    if (valid.length > 0) {
      valid.forEach(c => console.log(`   ✅ ENTRY : ${c.pair.toUpperCase()} (Score: ${c.totalScore.toFixed(1)}) | Sector: ${c.sector}`));
    }

    const predatorTargets = valid.slice(0, 5).map(c => c.pair);
    console.log(`\n🦅 [PREDATOR TARGETS]: ${predatorTargets.join(', ').toUpperCase()}`);

    return valid;
  }

  private async getCoinGeckoMarkets(): Promise<any[]> {
    try {
      const res = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
        params: { vs_currency: 'usd', order: 'market_cap_desc', per_page: 250, page: 1 }
      });
      return res.data;
    } catch { return []; }
  }

  private scoreFundamental(cg: any, rank: number): number {
    let score = rank <= 100 ? 20 : rank <= 500 ? 10 : 5;
    if (cg?.price_change_percentage_24h > 0) score += 10;
    return score;
  }

  private scoreTechnical(p: number, h: number, l: number, v: number, s: number, pos: number): number {
    let score = (pos > 10 && pos < 50) ? 15 : 5;
    score += v > 100000000 ? 15 : 5;
    score += s < 0.5 ? 10 : 0;
    return score;
  }

  private async getHypeLevelForPair(pair: string): Promise<number> {
    return 50; // Placeholder
  }

  private calculateExplosivePotential(trend: any, smc: any, vol: number, price: number, h: number, l: number): number {
    return (trend.alignment === 'MOMENTUM' ? 40 : 20) + (smc.smcScore / 2);
  }

  private calculateRiskLevel(spread: number, vol: number, trend: any, smc: any): number {
    return (spread > 1 ? 30 : 10) + (trend.alignment.includes('BEAR') ? 40 : 0);
  }

  private calculateEntryConfidence(nar: number, sm: number, va: number, hype: number, exp: number, risk: number, trend: any): number {
    let conf = (nar * 0.3) + (sm * 0.25) + (va * 0.15) + (hype * 0.1) + (exp * 0.2);
    return conf * ((100 - risk) / 100);
  }
}
