import { MarketIntelligence } from '../scanner/MarketIntelligence';

export class EmergencyShield {
  /**
   * Mendeteksi crash tiba-tiba pada BTC.
   * Jika BTC dump > 2% dalam 1 jam, bot akan masuk mode FREEZE.
   */
  public static async checkGlobalEmergency(): Promise<{ isEmergency: boolean; reason?: string }> {
    try {
      const bars = await MarketIntelligence.fetchCandles('BTCIDR', '60');
      if (bars.length < 2) return { isEmergency: false };

      const last = bars[bars.length - 1];
      const prev = bars[bars.length - 2];
      
      const dropPct = (prev.close - last.close) / prev.close;

      if (dropPct >= 0.02) {
        return { 
          isEmergency: true, 
          reason: `BTC FLASH DUMP DETECTED: ${(dropPct * 100).toFixed(2)}% in 1H` 
        };
      }

      return { isEmergency: false };
    } catch {
      return { isEmergency: false };
    }
  }
}
