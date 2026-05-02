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
        return {
          minVolume: 10_000_000, // 10 Million IDR
          maxSpread: 2.5,
          minScore: 58,
          prioritizeMemes: false
        };
      
      case MarketRegime.WAR:
        return {
          minVolume: 20_000_000, // 20 Million IDR
          maxSpread: 2.0,
          minScore: 65,
          prioritizeMemes: false
        };

      case MarketRegime.PREDATOR:
        return {
          minVolume: 30_000_000, // 30 Million IDR
          maxSpread: 1.5,
          minScore: 74,
          prioritizeMemes: true
        };

      default:
        return {
          minVolume: 15_000_000,
          maxSpread: 2.0,
          minScore: 60,
          prioritizeMemes: false
        };
    }
  }
}
