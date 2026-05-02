export interface ExitPlan {
  tp1: number; // +7%
  tp2: number; // +15%
  tp3: number; // +25%
  sl: number;  // -4% initial
}

export interface PositionUpdate {
  shouldClose: boolean;
  closeReason?: string;
  newSL?: number;
  tpHit?: number;
}

export class ExitManager2 {
  public static calculateInitialPlan(entry: number): ExitPlan {
    return {
      tp1: entry * 1.07,
      tp2: entry * 1.15,
      tp3: entry * 1.25,
      sl: entry * 0.96
    };
  }

  public static monitor(currentPrice: number, entryPrice: number, currentSL: number, tpsHit: number[]): PositionUpdate {
    const profitPct = (currentPrice - entryPrice) / entryPrice;
    
    // 1. Check Initial SL
    if (currentPrice <= currentSL) {
      return { shouldClose: true, closeReason: 'STOP_LOSS' };
    }

    // 2. Break Even Point (BEP) Adjustment
    // If profit +5%, move SL to Entry + 0.5% (to cover fees)
    if (profitPct >= 0.05 && currentSL < entryPrice) {
      return { shouldClose: false, newSL: entryPrice * 1.005, closeReason: 'MOVE_TO_BEP' };
    }

    // 3. Trailing SL
    // If profit +10%, move SL to +4%
    if (profitPct >= 0.10 && currentSL < entryPrice * 1.04) {
      return { shouldClose: false, newSL: entryPrice * 1.04, closeReason: 'TRAILING_STOP' };
    }

    // 4. Tiered TP Hit Detection
    const plan = this.calculateInitialPlan(entryPrice);
    if (currentPrice >= plan.tp1 && !tpsHit.includes(1)) {
      return { shouldClose: false, tpHit: 1, closeReason: 'TP1_HIT' };
    }
    if (currentPrice >= plan.tp2 && !tpsHit.includes(2)) {
      return { shouldClose: false, tpHit: 2, closeReason: 'TP2_HIT' };
    }
    if (currentPrice >= plan.tp3 && !tpsHit.includes(3)) {
      return { shouldClose: true, tpHit: 3, closeReason: 'TP3_FULL_EXIT' };
    }

    return { shouldClose: false };
  }
}
