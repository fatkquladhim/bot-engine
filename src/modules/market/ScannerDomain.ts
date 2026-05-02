import { MarketRegime } from '../../predator/macro';

export interface ScannerFilters {
  minVolume: number;
  maxSpread: number;
  minScore: number;
  prioritizeMemes: boolean;
}

export class ScannerDomain {
  public static getFilters(regime: MarketRegime): ScannerFilters {
    switch (regime) {
      case MarketRegime.DEFENSE:
        return {
          minVolume: 5_000_000, // Lowered from 10M to be less restrictive
          maxSpread: 3.5,       // Raised from 2.5 to allow more pairs
          minScore: 54,         // Lowered from 58 for "Survival" mode
          prioritizeMemes: false
        };
      case MarketRegime.WAR:
        return {
          minVolume: 10_000_000,
          maxSpread: 3.0,
          minScore: 60,
          prioritizeMemes: false
        };
      case MarketRegime.PREDATOR:
        return {
          minVolume: 20_000_000,
          maxSpread: 2.5,
          minScore: 66,
          prioritizeMemes: true
        };
      default:
        return {
          minVolume: 10_000_000,
          maxSpread: 2.5,
          minScore: 60,
          prioritizeMemes: false
        };
    }
  }
}
