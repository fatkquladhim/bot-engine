import { MarketRegime } from './macro';

export interface ScannerFilters {
  minVolume: number;
  maxSpread: number;
  minScore: number;
  prioritizeMemes: boolean;
  maxVolatilityTolerance: number; // New: volatility tolerance per regime
  htfConfirmationPenalty: number; // New: penalty for missing HTF confirmation
}

export class DynamicScanner {
  public static getFilters(regime: MarketRegime): ScannerFilters {
    switch (regime) {
      case MarketRegime.DEFENSE:
        return { 
          minVolume: 10_000_000, 
          maxSpread: 2.5, 
          minScore: 52, 
          prioritizeMemes: false,
          maxVolatilityTolerance: 0.5, // Low tolerance in defense
          htfConfirmationPenalty: 10 // High penalty for missing confirmation
        };
      case MarketRegime.WAR:
        return { 
          minVolume: 15_000_000, 
          maxSpread: 2.0, 
          minScore: 50, 
          prioritizeMemes: true,
          maxVolatilityTolerance: 1.0, // Moderate tolerance
          htfConfirmationPenalty: 5 // Moderate penalty
        };
      case MarketRegime.PREDATOR:
        return { 
          minVolume: 25_000_000, 
          maxSpread: 1.5, 
          minScore: 55, 
          prioritizeMemes: true,
          maxVolatilityTolerance: 2.0, // High tolerance in predator mode
          htfConfirmationPenalty: 3 // Low penalty - momentum first
        };
      case MarketRegime.MEME_MANIA:
        return { 
          minVolume: 20_000_000, 
          maxSpread: 2.0, 
          minScore: 45, 
          prioritizeMemes: true,
          maxVolatilityTolerance: 3.0, // Very high tolerance - memes can move fast
          htfConfirmationPenalty: 0 // NO penalty - no confirmation needed
        };
      default:
        return { 
          minVolume: 15_000_000, 
          maxSpread: 2.0, 
          minScore: 50, 
          prioritizeMemes: false,
          maxVolatilityTolerance: 1.0,
          htfConfirmationPenalty: 5
        };
    }
  }
}
