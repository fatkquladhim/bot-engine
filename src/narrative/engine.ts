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
    
    const { metrics } = await MacroRegimeEngine.getCurrentRegime();
    const phase = RotationEngine.determinePhase(metrics.btcTrend, metrics.ethTrend, metrics.altcoinVolume);
    const topSectors = RotationEngine.getTargetSectors(phase);

    for (const insight of hotNow) {
      const hype = await SocialHypeRadar.getHypeScore(insight.type);
      insight.score = Math.round((insight.score * 0.7) + (hype * 0.3));
    }

    const report: NarrativeReport = {
      hotNow: hotNow.sort((a, b) => b.score - a.score),
      nextWeek,
      marketPhase: phase,
      topSectors
    };

    this.reportCache = report;
    this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;

    return report;
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
}
