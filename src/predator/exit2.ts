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
      tp1: entry * 1.10,  // +10% (RR 2.5:1 vs SL 4%)
      tp2: entry * 1.20,  // +20%
      tp3: entry * 1.35,  // +35%
      sl: entry * 0.96    // -4%
    };
  }

  public static monitor(
    currentPrice: number,
    entryPrice: number,
    currentSL: number,
    tpsHit: number[],
    entryTimestamp?: number, // unix ms, opsional untuk time-based exit
    customPlan?: ExitPlan // Custom TP/SL plan dari database
  ): PositionUpdate {
    const profitPct = (currentPrice - entryPrice) / entryPrice;
    
    // 0. Time-based exit: jika posisi stuck > 48 jam tanpa profit, keluar
    if (entryTimestamp) {
      const ageHours = (Date.now() - entryTimestamp) / 3600000;
      if (ageHours > 48 && profitPct < 0.01) {
        return { shouldClose: true, closeReason: 'TIME_EXIT_48H' };
      }
    }

    // 1. Check SL
    if (currentPrice <= currentSL) {
      return { shouldClose: true, closeReason: 'STOP_LOSS' };
    }

    // 2. BEP: profit +5% → geser SL ke entry + 0.5%
    if (profitPct >= 0.05 && currentSL < entryPrice) {
      return { shouldClose: false, newSL: entryPrice * 1.005, closeReason: 'MOVE_TO_BEP' };
    }

    // 3. Trailing SL: profit +10% → SL ke +4%
    if (profitPct >= 0.10 && currentSL < entryPrice * 1.04) {
      return { shouldClose: false, newSL: entryPrice * 1.04, closeReason: 'TRAILING_STOP' };
    }

    // 4. Tiered TP - Gunakan custom plan jika ada, jika tidak hitung dari entry
    const plan = customPlan || this.calculateInitialPlan(entryPrice);
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
