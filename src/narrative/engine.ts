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
  public static async generateReport(): Promise<NarrativeReport> {
    const hotNow = await HotNarrativeScanner.scan();
    const nextWeek = NextWeekPredictor.predict(hotNow);
    
    const { metrics } = await MacroRegimeEngine.getCurrentRegime();
    const phase = RotationEngine.determinePhase(metrics.btcTrend, 'SIDEWAYS', metrics.altcoinVolume);
    const topSectors = RotationEngine.getTargetSectors(phase);

    // Integrate Social Hype into hotNow scores
    for (const insight of hotNow) {
      const hype = await SocialHypeRadar.getHypeScore(insight.type);
      insight.score = Math.round((insight.score * 0.7) + (hype * 0.3));
    }

    return {
      hotNow: hotNow.sort((a, b) => b.score - a.score),
      nextWeek,
      marketPhase: phase,
      topSectors
    };
  }

  public static async getNarrativeScore(pair: string): Promise<number> {
    const report = await this.generateReport();
    const { NarrativeMapper } = require('./mapper');
    const narrative = NarrativeMapper.getNarrativeForPair(pair);
    
    const insight = report.hotNow.find(h => h.type === narrative);
    let score = insight ? insight.score : 50;

    // Phase alignment bonus
    if (report.topSectors.includes(narrative)) {
      score += 15;
    }

    return Math.min(100, score);
  }
}
