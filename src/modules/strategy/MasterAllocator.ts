import { MarketRegime } from '../../predator/macro';
import { MarketPhase } from '../../narrative/rotation';

export enum StrategyFocus {
  PREDATOR = 'PREDATOR',   // Aggressive hunting
  DEFENSE = 'DEFENSE',     // Capital preservation
  DCA = 'DCA',             // Range-bound accumulation
  SWING = 'SWING'          // Trend following
}

export class MasterAllocator {
  /**
   * Decide the primary strategy focus based on Market Regime and Narrative Phase.
   */
  public static allocate(regime: MarketRegime, phase: MarketPhase): StrategyFocus {
    // 1. Priority One: Defense
    if (regime === MarketRegime.DEFENSE || phase === MarketPhase.CAPITULATION) {
      return StrategyFocus.DEFENSE;
    }

    // 2. Priority Two: Predator (Meme Mania or Full Altseason in Predator Regime)
    if (regime === MarketRegime.PREDATOR) {
      if (phase === MarketPhase.MEME_MANIA || phase === MarketPhase.FULL_ALTSEASON) {
        return StrategyFocus.PREDATOR;
      }
      return StrategyFocus.SWING;
    }

    // 3. Priority Three: Range-bound / Sideways
    if (phase === MarketPhase.BTC_PUMP || phase === MarketPhase.ALT_LARGE_CAP) {
      return StrategyFocus.SWING;
    }

    return StrategyFocus.DCA;
  }

  public static getRiskMultiplier(focus: StrategyFocus): number {
    switch (focus) {
      case StrategyFocus.PREDATOR: return 1.5; // More aggressive
      case StrategyFocus.DEFENSE: return 0.5;   // Very conservative
      case StrategyFocus.SWING: return 1.0;
      case StrategyFocus.DCA: return 0.8;
      default: return 1.0;
    }
  }
}
