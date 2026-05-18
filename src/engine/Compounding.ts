export interface WalletAllocation {
  safeWalletIdr: number;
  sniperWalletIdr: number;
}

export class CompoundingEngine {
  private safeRatio = 0.60;   // 60% → Midcap (BTC, ETH, SOL, ADA, XRP, dll rank 50-250)
  private sniperRatio = 0.40; // 40% → Lowcap/Meme (DOGE, PEPE, PIPPIN, FARTCOIN, dll)

  /**
   * Membagi modal secara virtual menjadi 2 kantong.
   */
  public allocateWallets(totalEquityIdr: number): WalletAllocation {
    return {
      safeWalletIdr: totalEquityIdr * this.safeRatio,
      sniperWalletIdr: totalEquityIdr * this.sniperRatio
    };
  }

  /**
   * Menghitung besaran modal yang akan di-entry berdasarkan skor AI dan tipe koin.
   * Menggunakan konsep "Confidence Sizing".
   * 
   * @param totalEquityIdr Total modal di akun
   * @param isLowCapGem True jika koin ini low-cap (Sniper Wallet), False jika blue-chip (Safe Wallet)
   * @param aiScore Skor dari AI Sentinel (0-100)
   * @param riskPerTradePercent Berapa persen risiko maksimal dari modal
   * @returns Nominal IDR yang boleh dipertaruhkan untuk trade ini
   */
  public getOptimalPositionSize(
    totalEquityIdr: number, 
    isLowCapGem: boolean, 
    aiScore: number, 
    riskPerTradePercent: number,
    slDistancePercent: number = 5, // Default 5% jika tidak dikirim
    recentResults: boolean[] = [] // Performance tracking untuk Adaptive Risk
  ): number {
    
    // 1. Tentukan kantong mana yang dipakai
    const wallets = this.allocateWallets(totalEquityIdr);
    const activeWalletIdr = isLowCapGem ? wallets.sniperWalletIdr : wallets.safeWalletIdr;

    // ===== ADAPTIVE RISK MODIFIER (SELF-LEARNING) =====
    let riskModifier = 1.0;
    
    // Hitung streak dari belakang
    if (recentResults.length > 0) {
      let streak = 0;
      const isLastWin = recentResults[recentResults.length - 1];
      for (let i = recentResults.length - 1; i >= 0; i--) {
        if (recentResults[i] === isLastWin) streak++;
        else break;
      }
      
      if (isLastWin && streak >= 3) {
        riskModifier = 1.2; // Sedang panas (Hot Hand) -> Naikkan risk 20%
        console.log(`🔥 [ADAPTIVE RISK] Winning Streak (${streak}x)! Meningkatkan alokasi risiko +20%`);
      } else if (!isLastWin && streak >= 2) {
        riskModifier = 0.5; // Sedang berdarah (Cold Hand) -> Pangkas risk 50%
        console.log(`❄️ [ADAPTIVE RISK] Losing Streak (${streak}x)! Mengurangi alokasi risiko -50% untuk bertahan`);
      }
    }

    // 2. Hitung True Risk Allocation (Maksimal Rupiah yang siap HILANG)
    const maxLossAmountIdr = activeWalletIdr * ((riskPerTradePercent * riskModifier) / 100);

    // 3. Volatility-Adjusted Sizing (Position Size = Max Loss / SL Distance)
    // Jika SL jauh (volatilitas tinggi), size lebih kecil. Jika SL dekat, size bisa besar.
    const slDecimal = Math.max(0.01, slDistancePercent / 100); // Hindari division by zero, min 1% SL
    const basePositionSizeIdr = maxLossAmountIdr / slDecimal;

    // 4. Adaptive Position Sizing (WAR MODE FOCUS)
    // Confidence tinggi = size besar. Confidence rendah = size kecil.
    let confidenceMultiplier = 0;

    if (aiScore >= 85) {
      confidenceMultiplier = 1.2;
      console.log(`⚡ [COMPOUNDING] Score ${aiScore.toFixed(0)} (A+ Setup). AGGRESSIVE SIZING (120%).`);
    } else if (aiScore >= 75) {
      confidenceMultiplier = 1.0;
      console.log(`⚡ [COMPOUNDING] Score ${aiScore.toFixed(0)} (A Setup). FULL SIZING (100%).`);
    } else if (aiScore >= 60) {
      confidenceMultiplier = 0.7;
      console.log(`⚖️ [COMPOUNDING] Score ${aiScore.toFixed(0)} (B Setup). OPTIMAL SIZING (70%).`);
    } else if (aiScore >= 42) {
      confidenceMultiplier = 0.4;
      console.log(`🐢 [COMPOUNDING] Score ${aiScore.toFixed(0)} (C Setup). REDUCED SIZING (40%).`);
    } else {
      confidenceMultiplier = 0.0;
      console.log(`🛑 [COMPOUNDING] Score ${aiScore.toFixed(0)} (D Setup). NO ENTRY.`);
    }

    // Nominal yang direkomendasikan untuk dibeli
    let recommendedSizeIdr = basePositionSizeIdr * confidenceMultiplier;

    // HARD CAP: Jangan pernah alokasikan lebih dari 30% wallet ke satu koin
    const MAX_SINGLE_TRADE_PCT = 0.30;
    const maxHardCapIdr = activeWalletIdr * MAX_SINGLE_TRADE_PCT;
    if (recommendedSizeIdr > maxHardCapIdr) {
      console.log(`🛡️ [COMPOUNDING] Position size dikurangi ke cap 30% (Rp ${Math.round(maxHardCapIdr).toLocaleString()})`);
      recommendedSizeIdr = maxHardCapIdr;
    }

    // FLOOR LOGIC: Jangan entry di bawah 10rb (minimum order asli Indodax)
    const MIN_ENTRY = 10000;
    if (recommendedSizeIdr > 0 && recommendedSizeIdr < MIN_ENTRY) {
      // Jika saldo dompet mencukupi, naikkan ke 10rb
      if (activeWalletIdr >= MIN_ENTRY) {
        recommendedSizeIdr = MIN_ENTRY;
      }
    }

    // Sanity check: Jangan pernah melebihi 100% dari active wallet dalam 1 trade
    if (recommendedSizeIdr > activeWalletIdr) {
      recommendedSizeIdr = activeWalletIdr;
    }

    return Math.floor(recommendedSizeIdr);
  }

  /**
   * Growth Scale Adjuster
   * Jika modal sudah di atas target tertentu, rasio dompet bisa diubah lebih agresif.
   * Fase C (Rp 1.2M - Rp 2M): Boleh agak agresif ke sniper.
   */
  public autoAdjustRatios(totalEquityIdr: number) {
    // Rasio tetap sesuai konfigurasi: 60% Midcap, 40% Lowcap
    console.log(`\n💼 [PORTFOLIO REBALANCING] Total Equity: Rp ${totalEquityIdr.toLocaleString()}`);
    console.log(`   ► Midcap Wallet (60%) : Rp ${(totalEquityIdr * this.safeRatio).toLocaleString()}`);
    console.log(`   ► Lowcap Wallet (40%) : Rp ${(totalEquityIdr * this.sniperRatio).toLocaleString()}`);
  }
}
