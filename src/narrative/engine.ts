import { HotNarrativeScanner, NarrativeInsight } from './hotScanner';
import { NextWeekPredictor } from './nextWeek';
import { RotationEngine, MarketPhase } from './rotation';
import { SocialHypeRadar } from './social';
import { MacroRegimeEngine } from '../predator/macro';
import { NarrativeType } from './mapper';

export interface NarrativeReport {
  hotNow: NarrativeInsight[];
  nextWeek: NarrativeInsight[];
  marketPhase: MarketPhase;
  topSectors: string[];
  executionReadiness: 'AGGRESSIVE' | 'MODERATE' | 'CONSERVATIVE';
  recommendedActionBias: 'ENTRY' | 'WATCH' | 'SKIP';
}

export class NarrativeEngine {
  private static reportCache: NarrativeReport | null = null;
  private static cacheExpiry: number = 0;
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 menit

  public static async generateReport(): Promise<NarrativeReport> {
    // Return cache jika masih valid
    if (this.reportCache && Date.now() < this.cacheExpiry) {
      return this.reportCache;
    }

    const hotNow = await HotNarrativeScanner.scan();
    const nextWeek = NextWeekPredictor.predict(hotNow);
    
    const { metrics, regime } = await MacroRegimeEngine.getCurrentRegime();
    const phase = RotationEngine.determinePhase(metrics.btcTrend, metrics.ethTrend, metrics.altcoinVolume);
    const topSectors = RotationEngine.getTargetSectors(phase);

    // Apply narrative boosting based on market regime
    const boostedHotNow = await this.applyNarrativeBoost(hotNow, metrics, regime);

    // Determine execution readiness
    const executionReadiness = this.determineExecutionReadiness(metrics, regime, boostedHotNow);
    const recommendedActionBias = this.determineActionBias(executionReadiness, metrics);

    const report: NarrativeReport = {
      hotNow: boostedHotNow.sort((a, b) => b.score - a.score),
      nextWeek,
      marketPhase: phase,
      topSectors,
      executionReadiness,
      recommendedActionBias
    };

    this.reportCache = report;
    this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;

    return report;
  }

  private static determineExecutionReadiness(metrics: any, regime: any, insights: NarrativeInsight[]): 'AGGRESSIVE' | 'MODERATE' | 'CONSERVATIVE' {
    // AGGRESSIVE: MEME_MANIA or strong altseason
    if (regime === 'MEME_MANIA') return 'AGGRESSIVE';
    
    // Check for strong narrative momentum
    const topNarrative = insights[0];
    if (topNarrative && topNarrative.score >= 85 && topNarrative.momentum === 'RISING') {
      if (metrics.fearAndGreed >= 70 && metrics.altcoinVolume >= 2.0) {
        return 'AGGRESSIVE';
      }
    }
    
    // MODERATE: PREDATOR or strong market
    if (regime === 'PREDATOR') return 'MODERATE';
    if (metrics.fearAndGreed >= 60 && metrics.btcTrend === 'UP') return 'MODERATE';
    if (metrics.altcoinVolume >= 1.8) return 'MODERATE';
    
    // CONSERVATIVE: DEFENSE or weak market
    return 'CONSERVATIVE';
  }

  private static determineActionBias(
    readiness: 'AGGRESSIVE' | 'MODERATE' | 'CONSERVATIVE',
    metrics: any
  ): 'ENTRY' | 'WATCH' | 'SKIP' {
    if (readiness === 'AGGRESSIVE') return 'ENTRY';
    if (readiness === 'MODERATE') return 'ENTRY';
    if (metrics.fearAndGreed < 40 || metrics.btcTrend === 'DOWN') return 'SKIP';
    return 'WATCH';
  }

  private static async applyNarrativeBoost(insights: NarrativeInsight[], metrics: any, regime: any): Promise<NarrativeInsight[]> {
    const { fearAndGreed, btcTrend, altcoinVolume } = metrics;
    
    // Determine boost factors based on market conditions
    let memeBoost = 1.0;
    let altcoinBoost = 1.0;
    let hypeBoost = 1.0;
    
    // Meme mania detection - AGGRESSIVE BOOST
    if (fearAndGreed > 80 && altcoinVolume > 3.0) {
      memeBoost = 1.5; // Strong meme mania
    } else if (fearAndGreed > 70 && altcoinVolume > 2.0) {
      memeBoost = 1.3; // Strong meme mania
    } else if (fearAndGreed > 60) {
      memeBoost = 1.15; // Moderate meme enthusiasm
    }
    
    // Altseason detection - AGGRESSIVE BOOST
    if (btcTrend === 'DOWN' || (btcTrend === 'SIDEWAYS' && altcoinVolume > 1.5)) {
      altcoinBoost = 1.35; // Strong altseason
    } else if (altcoinVolume > 1.2) {
      altcoinBoost = 1.1; // Growing altcoin interest
    }
    
    // Apply boosts
    return insights.map(insight => {
      const boostedInsight = { ...insight };
      
      // Apply meme boost to meme coins - MORE AGGRESSIVE
      if (insight.type === 'MEME_COINS') {
        boostedInsight.score = Math.min(100, insight.score * memeBoost);
      }
      
      // Apply altcoin boost to L1/L2, DeFi, etc.
      if (['L1_L2_ECOSYSTEM', 'RWA_DEFI', 'LOWCAP_TRENDING'].includes(insight.type)) {
        boostedInsight.score = Math.min(100, insight.score * altcoinBoost);
      }
      
      // Apply AI Agents boost in altseason
      if (insight.type === 'AI_AGENTS' && altcoinVolume > 1.5) {
        boostedInsight.score = Math.min(100, insight.score * 1.2);
      }
      
      // Apply general hype boost during extreme greed
      if (fearAndGreed > 75) {
        boostedInsight.score = Math.min(100, insight.score * 1.1);
      }
      
      return boostedInsight;
    });
  }

  public static async getNarrativeScore(pair: string): Promise<number> {
    const report = await this.generateReport();
    const { NarrativeMapper } = require('./mapper');
    const narrative = NarrativeMapper.getNarrativeForPair(pair);
    
    const insight = report.hotNow.find(h => h.type === narrative);
    let score = insight ? insight.score : 50;

    if (report.topSectors.includes(narrative)) {
      score += 15;
    }

    return Math.min(100, score);
  }

  /**
   * Get Hype Level for a specific narrative type
   */
  public static async getHypeLevel(narrativeType: NarrativeType): Promise<number> {
    try {
      return await SocialHypeRadar.getHypeScore(narrativeType);
    } catch {
      return 50; // Neutral fallback
    }
  }
}
