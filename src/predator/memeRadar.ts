import { MarketIntelligence } from '../scanner/MarketIntelligence';

export class MemeRadar {
  private static MEME_LIST = [
    'zerebro_idr', 'pump_idr', 'pippin_idr', 'fartcoin_idr', 
    'moodeng_idr', 'doge_idr', 'shib_idr', 'pepe_idr', 
    'bonk_idr', 'wif_idr'
  ];

  public static async analyzeMemeRotation(): Promise<{ topMemes: string[]; boosts: Record<string, number> }> {
    const boosts: Record<string, number> = {};
    const candidates: string[] = [];

    for (const pair of this.MEME_LIST) {
      const bars = await MarketIntelligence.fetchCandles(pair, '60');
      if (bars.length < 5) continue;

      const lastBar = bars[bars.length - 1];
      const avgVol = bars.slice(-20, -1).reduce((sum, b) => sum + b.volume, 0) / 19;

      // Volume Spike Detection
      if (lastBar.volume > avgVol * 2) {
        boosts[pair] = 15;
        candidates.push(pair);
      }

      // Breakout Detection
      const high = Math.max(...bars.slice(-20, -1).map(b => b.high));
      if (lastBar.close > high) {
        boosts[pair] = (boosts[pair] || 0) + 10;
        if (!candidates.includes(pair)) candidates.push(pair);
      }
    }

    return { 
      topMemes: candidates.sort((a, b) => (boosts[b] || 0) - (boosts[a] || 0)), 
      boosts 
    };
  }

  public static isMeme(pair: string): boolean {
    return this.MEME_LIST.includes(pair.toLowerCase());
  }
}
