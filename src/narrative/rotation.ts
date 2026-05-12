export enum MarketPhase {
  BTC_PUMP = 'BTC_PUMP',           // Money in BTC
  ETH_REBOUND = 'ETH_REBOUND',     // Money moving to ETH
  ALT_LARGE_CAP = 'ALT_LARGE_CAP', // Money moving to SOL, DOT, ADA
  MEME_MANIA = 'MEME_MANIA',       // Money moving to Memes
  FULL_ALTSEASON = 'FULL_ALTSEASON', // Everything up
  CAPITULATION = 'CAPITULATION'    // Everything down
}

export class RotationEngine {
  public static determinePhase(btcTrend: string, ethTrend: string, altVol: number): MarketPhase {
    if (btcTrend === 'DOWN' && ethTrend === 'DOWN') return MarketPhase.CAPITULATION;
    
    if (btcTrend === 'UP' && ethTrend !== 'UP') return MarketPhase.BTC_PUMP;
    if (btcTrend === 'SIDEWAYS' && ethTrend === 'UP') return MarketPhase.ETH_REBOUND;
    
    if (altVol > 1.5) return MarketPhase.MEME_MANIA; // Vol spike in alts/memes
    
    if (btcTrend === 'UP' && ethTrend === 'UP') return MarketPhase.FULL_ALTSEASON;
    
    return MarketPhase.ALT_LARGE_CAP;
  }

  public static getTargetSectors(phase: MarketPhase): string[] {
    switch (phase) {
      case MarketPhase.BTC_PUMP: return ['L1_L2_ECOSYSTEM'];
      case MarketPhase.ETH_REBOUND: return ['L1_L2_ECOSYSTEM', 'DEFI'];
      case MarketPhase.ALT_LARGE_CAP: return ['L1_L2_ECOSYSTEM', 'RWA_DEFI', 'AI_AGENTS'];
      case MarketPhase.MEME_MANIA: return ['MEME_COINS'];
      case MarketPhase.FULL_ALTSEASON: return ['MEME_COINS', 'GAMING', 'DEPIN'];
      default: return ['L1_L2_ECOSYSTEM'];
    }
  }
}
