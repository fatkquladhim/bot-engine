import { MarketIntelligence } from '../../scanner/MarketIntelligence';

export interface WhaleActivity {
  pair: string;
  isWhaleActive: boolean;
  spikeMagnitude: number; // multiplier over avg vol
  lastBigVolIdr: number;
}

export class WhaleDetector {
  /**
   * Detects unusual volume activity (Whale Action) in the last few bars.
   */
  public static async detect(pair: string): Promise<WhaleActivity> {
    try {
      const bars = await MarketIntelligence.fetchCandles(pair, '60'); // 1H bars
      if (bars.length < 24) return { pair, isWhaleActive: false, spikeMagnitude: 0, lastBigVolIdr: 0 };

      const lastBar = bars[bars.length - 1];
      const avgVol = bars.slice(-24, -1).reduce((sum, b) => sum + b.volume, 0) / 23;

      const spikeMagnitude = lastBar.volume / (avgVol || 1);
      const isWhaleActive = spikeMagnitude >= 3.0; // 3x average volume is a whale/institution signal

      return {
        pair,
        isWhaleActive,
        spikeMagnitude,
        lastBigVolIdr: lastBar.volume
      };
    } catch {
      return { pair, isWhaleActive: false, spikeMagnitude: 0, lastBigVolIdr: 0 };
    }
  }
}
