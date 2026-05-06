export class GrowthStrategy {
  
  /**
   * Mengevaluasi apakah sinyal dari AI layak dieksekusi berdasarkan Sniper Formula.
   * Aturan:
   * 1. Jarak Stop Loss minimal (jangan terlalu tipis agar tidak kena whipsaw).
   * 2. RR (Risk to Reward) Ratio harus minimal 1:2.
   * 
   * @param entry Harga beli rekomendasi
   * @param sl Harga stop loss
   * @param tp Harga target profit akhir
   * @returns boolean (True jika lolos filter Sniper)
   */
  public validateSniperEntry(entry: number, sl: number, tp: number): boolean {
    if (!entry || !sl || !tp) return false;

    const risk = Math.abs(entry - sl);
    const reward = Math.abs(tp - entry);

    // Jika target TP lebih kecil dari SL, buang.
    if (reward <= 0 || risk <= 0) return false;

    const rrRatio = reward / risk;

    if (rrRatio < 1.5) {
      console.log(`⚖️ [SNIPER GUARD] Batal Entry. RR Ratio tidak memenuhi syarat 1:1.5 (Current RR: 1:${rrRatio.toFixed(2)})`);
      return false;
    }

    // SL Maksimal dilebarkan ke 15% (CTO Hyper-Growth Rule)
    // Kenapa 15%? Karena CompoundingEngine akan secara otomatis mengecilkan Position Size
    // sehingga kerugian Rupiah (R) tetap terkontrol di 2-3%. Ini memberi nafas pada koin volatil.
    const slPercent = (risk / entry) * 100;
    if (slPercent > 15) {
      console.log(`⚖️ [SNIPER GUARD] Batal Entry. Jarak SL terlalu jauh (${slPercent.toFixed(2)}% > 15%). Cari koin yang sedang koreksi sehat.`);
      return false;
    }

    return true;
  }

  /**
   * Menghitung target exit dinamis berbasis Risiko / Volatilitas
   * Jika SL disediakan, TP1 dan TP2 dihitung berdasarkan kelipatan Risk (ATR-proxy).
   */
  public calculateDynamicExits(entryPrice: number, slPrice?: number) {
    if (slPrice && slPrice < entryPrice) {
       const risk = entryPrice - slPrice;
       return {
         tp1: entryPrice + (risk * 1.5), // 1:1.5 RR Minimum
         tp2: entryPrice + (risk * 3.0)  // 1:3 RR Maximum Runner
       };
    }
    
    // Fallback statis jika SL tidak logis
    return {
      tp1: entryPrice * 1.10, // Target 10%
      tp2: entryPrice * 1.25  // Target 25%
    };
  }

  /**
   * Multi-Level Trailing Stop Engine
   * Level 1: Halfway to TP1 -> Move SL to Breakeven
   * Level 2: Hit TP1 -> Lock BEP + 2%
   * Level 3: Runner (Way past TP1) -> Tight 5% trailing
   */
  public getTrailingStop(entryPrice: number, currentPrice: number, currentSl: number, tp1: number): number {
    let newSl = currentSl;

    // Level 3: Runner Trailing (Tight 5%)
    if (currentPrice > tp1 * 1.05) {
      newSl = currentPrice * 0.95;
    }
    // Level 2: Free Trade + Tip
    else if (currentPrice >= tp1) {
      newSl = entryPrice * 1.02; // Lock 2%
    }
    // Level 1: Risk Reduction (Halfway to TP1)
    else if (currentPrice >= entryPrice + (tp1 - entryPrice) * 0.6) {
      newSl = entryPrice * 1.005; // Breakeven + fee cover
    }

    if (newSl > currentSl) {
      console.log(`🛡️ [TRAILING STOP] Harga naik! SL dinaikkan ke Rp ${newSl.toLocaleString()} (Lock Profit / BEP)`);
      return newSl;
    }

    return currentSl;
  }
}
