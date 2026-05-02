import axios from 'axios';
import { MarketIntelligence } from '../scanner/MarketIntelligence';

export enum MarketRegime {
  DEFENSE = 'DEFENSE',   // High fear, BTC/ETH focus, tight SL
  WAR = 'WAR',           // Neutral market, swing trade strong alts
  PREDATOR = 'PREDATOR'  // Bullish/Altseason, aggressive on memes/lowcaps
}

export interface MacroMetrics {
  fearAndGreed: number;
  btcDominance: number;
  btcTrend: 'UP' | 'DOWN' | 'SIDEWAYS';
  ethStrength: number; // ETH/BTC ratio trend or similar
  altcoinVolume: number; // Relative volume compared to average
}

export class MacroRegimeEngine {
  private static FNG_API = 'https://api.alternative.me/fng/';

  public static async getCurrentRegime(): Promise<{ regime: MarketRegime; metrics: MacroMetrics }> {
    try {
      const metrics = await this.fetchMetrics();
      let regime = MarketRegime.WAR;

      // Logic for PREDATOR MODE
      if (metrics.fearAndGreed > 60 && metrics.btcTrend === 'UP') {
        regime = MarketRegime.PREDATOR;
      }
      
      // Logic for DEFENSE MODE
      if (metrics.fearAndGreed < 40 || metrics.btcTrend === 'DOWN') {
        regime = MarketRegime.DEFENSE;
      }

      // Overrides
      if (metrics.fearAndGreed < 25) regime = MarketRegime.DEFENSE; // Extreme Fear
      if (metrics.fearAndGreed > 75) regime = MarketRegime.PREDATOR; // Extreme Greed / Mooning

      return { regime, metrics };
    } catch (error) {
      console.error('Error in MacroRegimeEngine:', error);
      // Fallback to WAR
      return { 
        regime: MarketRegime.WAR, 
        metrics: { 
          fearAndGreed: 50, 
          btcDominance: 50, 
          btcTrend: 'SIDEWAYS', 
          ethStrength: 1, 
          altcoinVolume: 1 
        } 
      };
    }
  }

  private static async fetchMetrics(): Promise<MacroMetrics> {
    const [fngRes, btcTrendRes] = await Promise.allSettled([
      axios.get(this.FNG_API),
      MarketIntelligence.analyzeTrend('btc_idr')
    ]);

    const fearAndGreed = fngRes.status === 'fulfilled' 
      ? parseInt(fngRes.value.data.data[0].value) 
      : 50;

    const btcTrend = btcTrendRes.status === 'fulfilled' 
      ? btcTrendRes.value.trendDaily 
      : 'SIDEWAYS';

    // Mocking these for now as they require specific global market APIs 
    // or complex calculation from multiple pairs
    const btcDominance = 52; 
    const ethStrength = 1.0; 
    const altcoinVolume = 1.2;

    return {
      fearAndGreed,
      btcDominance,
      btcTrend,
      ethStrength,
      altcoinVolume
    };
  }
}
