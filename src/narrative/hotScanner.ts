import { NarrativeType, NarrativeMapper } from './mapper';
import { MarketIntelligence } from '../scanner/MarketIntelligence';
import { NarrativeDataFetcher } from './dataFetcher';

export interface NarrativeInsight {
  type: NarrativeType;
  score: number;
  momentum: 'RISING' | 'STABLE' | 'COOLING';
  leader: string;
}

export class HotNarrativeScanner {
  public static async scan(): Promise<NarrativeInsight[]> {
    const realData = await NarrativeDataFetcher.fetchAll();
    const insights: NarrativeInsight[] = [];
    const narratives = Object.values(NarrativeType).filter(t => t !== NarrativeType.UNKNOWN);

    for (const narrative of narratives) {
      const pairs = NarrativeMapper.getPairsForNarrative(narrative as NarrativeType);
      if (pairs.length === 0) continue;

      let totalVol = 0;
      let totalChange = 0;
      let leader = '';
      let maxVol = 0;

      for (const pair of pairs) {
        try {
          const bars = await MarketIntelligence.fetchCandles(pair, '60');
          if (bars.length < 2) continue;
          
          const last = bars[bars.length - 1];
          const prev = bars[bars.length - 2];
          
          totalVol += last.volume;
          const change = ((last.close - prev.close) / prev.close) * 100;
          totalChange += change;

          if (last.volume > maxVol) {
            maxVol = last.volume;
            leader = pair;
          }
        } catch { continue; }
      }

      const avgChange = totalChange / pairs.length;
      let score = 50; // Base score
      
      score += (avgChange * 2); // Momentum factor
      if (totalVol > 100_000_000) score += 10; // High liquidity bonus

      // Real Data Bonuses (Phase 4.5)
      // 1. Trending Coins Check
      const hasTrending = pairs.some(p => realData.trendingCoins.includes(p.split('_')[0].toUpperCase()));
      if (hasTrending) score += 15;

      // 2. DexScreener Check (Hype on DEX)
      if (narrative === NarrativeType.MEME_COINS && realData.dexTrends.length > 0) score += 10;

      // 3. Google Trends / Social Keywords (Mocked)
      const trendKey = narrative.toLowerCase().split('_')[0];
      if (realData.googleTrends[trendKey] > 80) score += 15;

      // 4. News Catalyst Check
      const hasNews = realData.newsCatalysts.some(n => n.toLowerCase().includes(trendKey));
      if (hasNews) score += 10;

      let momentum: NarrativeInsight['momentum'] = 'STABLE';
      if (avgChange > 5) momentum = 'RISING';
      else if (avgChange < -3) momentum = 'COOLING';

      insights.push({
        type: narrative as NarrativeType,
        score: Math.min(100, Math.max(0, score)),
        momentum,
        leader
      });
    }

    return insights.sort((a, b) => b.score - a.score);
  }
}
