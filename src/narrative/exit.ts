import { NarrativeType, NarrativeMapper } from './mapper';
import { MarketIntelligence } from '../scanner/MarketIntelligence';

export class NarrativeExitDetector {
  public static async shouldExitNarrative(pair: string): Promise<{ shouldExit: boolean; reason?: string }> {
    const narrative = NarrativeMapper.getNarrativeForPair(pair);
    const pairs = NarrativeMapper.getPairsForNarrative(narrative);
    
    if (pairs.length === 0) return { shouldExit: false };

    // Check leader coin performance
    const leader = pairs[0]; // Assuming first is leader for now
    const leaderTrend = await MarketIntelligence.analyzeTrend(leader);
    
    if (leaderTrend.alignment === 'BEARISH') {
      return { shouldExit: true, reason: `Narrative Leader ${leader} turned BEARISH` };
    }

    // Check average volume trend of the sector
    let totalDrop = 0;
    for (const p of pairs.slice(0, 3)) { // Check top 3
      const bars = await MarketIntelligence.fetchCandles(p, '60');
      if (bars.length < 5) continue;
      
      const last = bars[bars.length - 1];
      const avgVol = bars.slice(-10, -1).reduce((sum, b) => sum + b.volume, 0) / 9;
      
      if (last.volume < avgVol * 0.5) totalDrop++;
    }

    if (totalDrop >= 2) {
      return { shouldExit: true, reason: `Narrative ${narrative} losing volume momentum` };
    }

    return { shouldExit: false };
  }
}
