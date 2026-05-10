import { MarketIntelligence } from '../scanner/MarketIntelligence';

export class MemeRadar {
  private static MEME_LIST = [
    'zerebro_idr', 'pump_idr', 'pippin_idr', 'fartcoin_idr', 
    'moodeng_idr', 'doge_idr', 'shib_idr', 'pepe_idr', 
    'bonk_idr', 'wif_idr', 'pengu_idr', 'floki_idr',
    'brett_idr', 'popcat_idr', 'neiro_idr', 'turbo_idr',
    'pepe2_idr', 'babydoge_idr', 'floki2_idr', 'wojak_idr',
    'based_idr', 'degen_idr', 'mog_idr', 'chungus_idr'
  ];

  public static async analyzeMemeRotation(): Promise<{ topMemes: string[]; boosts: Record<string, number> }> {
    const boosts: Record<string, number> = {};
    const candidates: string[] = [];

    for (const pair of this.MEME_LIST) {
      try {
        const bars = await MarketIntelligence.fetchCandles(pair, '60');
        if (bars.length < 5) continue;

        const lastBar = bars[bars.length - 1];
        const avgVol = bars.slice(-20, -1).reduce((sum, b) => sum + b.volume, 0) / 19;

        // Enhanced Volume Spike Detection
        if (lastBar.volume > avgVol * 3) {
          boosts[pair] = 30; // Very strong volume spike
          candidates.push(pair);
        } else if (lastBar.volume > avgVol * 2) {
          boosts[pair] = 20; // Volume spike = strong meme signal
          candidates.push(pair);
        }

        // Breakout Detection with multiple timeframes
        const high1h = Math.max(...bars.slice(-5, -1).map(b => b.high));
        const high4h = Math.max(...bars.slice(-10, -1).map(b => b.high));
        const high24h = Math.max(...bars.slice(-20, -1).map(b => b.high));
        
        if (lastBar.close > high24h) {
          boosts[pair] = (boosts[pair] || 0) + 25; // 24h breakout
          if (!candidates.includes(pair)) candidates.push(pair);
        } else if (lastBar.close > high4h) {
          boosts[pair] = (boosts[pair] || 0) + 20; // 4h breakout
          if (!candidates.includes(pair)) candidates.push(pair);
        } else if (lastBar.close > high1h) {
          boosts[pair] = (boosts[pair] || 0) + 10; // 1h breakout
          if (!candidates.includes(pair)) candidates.push(pair);
        }

        // RSI-based momentum detection
        const rsi = this.calculateRSI(bars.slice(-14));
        if (rsi > 70) {
          boosts[pair] = (boosts[pair] || 0) + 15; // Strong momentum
          if (!candidates.includes(pair)) candidates.push(pair);
        } else if (rsi > 60) {
          boosts[pair] = (boosts[pair] || 0) + 10; // Moderate momentum
          if (!candidates.includes(pair)) candidates.push(pair);
        }

        // Price acceleration detection
        if (bars.length >= 3) {
          const priceChange1 = ((bars[bars.length - 1].close - bars[bars.length - 2].close) / bars[bars.length - 2].close) * 100;
          const priceChange2 = ((bars[bars.length - 2].close - bars[bars.length - 3].close) / bars[bars.length - 3].close) * 100;
          
          if (priceChange1 > 5 && priceChange2 > 3) {
            boosts[pair] = (boosts[pair] || 0) + 15; // Accelerating gains
            if (!candidates.includes(pair)) candidates.push(pair);
          }
        }
      } catch (error) {
        // Continue with other pairs if one fails
        continue;
      }
    }

    return { 
      topMemes: candidates.sort((a, b) => (boosts[b] || 0) - (boosts[a] || 0)), 
      boosts 
    };
  }

  private static calculateRSI(bars: any[]): number {
    if (bars.length < 2) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i < bars.length; i++) {
      const change = bars[i].close - bars[i-1].close;
      if (change > 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }
    
    const avgGain = gains / (bars.length - 1);
    const avgLoss = losses / (bars.length - 1);
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  public static isMeme(pair: string): boolean {
    return this.MEME_LIST.includes(pair.toLowerCase());
  }
}
