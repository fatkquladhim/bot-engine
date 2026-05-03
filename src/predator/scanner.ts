import { MarketRegime } from './macro';

export interface ScannerFilters {
  minVolume: number;
  maxSpread: number;
  minScore: number;
  prioritizeMemes: boolean;
}

export class DynamicScanner {
  public static getFilters(regime: MarketRegime): ScannerFilters {
    switch (regime) {
      case MarketRegime.DEFENSE:
        return { minVolume: 10_000_000, maxSpread: 2.5, minScore: 52, prioritizeMemes: false };
      case MarketRegime.WAR:
        return { minVolume: 20_000_000, maxSpread: 2.0, minScore: 55, prioritizeMemes: false };
      case MarketRegime.PREDATOR:
        return { minVolume: 30_000_000, maxSpread: 1.5, minScore: 65, prioritizeMemes: true };
      default:
        return { minVolume: 15_000_000, maxSpread: 2.0, minScore: 53, prioritizeMemes: false };
    }
  }
}
