export interface RiskMetrics {
  dailyDrawdown: number;
  totalLossesToday: number;
  maxDrawdownLimit: number;
  isCircuitBroken: boolean;
}

export class RiskDomain {
  private static state: RiskMetrics = {
    dailyDrawdown: 0,
    totalLossesToday: 0,
    maxDrawdownLimit: 5.0,
    isCircuitBroken: false
  };

  private static startingEquity: number = 0;

  /**
   * Set starting equity untuk hari ini (dipanggil sekali saat bot start).
   */
  public static setStartingEquity(equity: number): void {
    if (this.startingEquity === 0) {
      this.startingEquity = equity;
      console.log(`📊 [RISK DOMAIN] Starting equity set: Rp ${equity.toLocaleString()}`);
    }
  }

  private static lastResetDate: string = '';

  /**
   * Monitor for global circuit break conditions.
   * Dipanggil setiap siklus autopilot dengan equity terkini.
   */
  public static monitor(currentEquity: number, startingEquity?: number): boolean {
    const today = new Date().toDateString();
    if (this.lastResetDate !== today) {
      this.resetCircuit();
      this.startingEquity = 0; // Force re-sync
      this.lastResetDate = today;
      console.log(`🔄 [RISK DOMAIN] Reset harian otomatis untuk ${today}`);
    }

    const base = startingEquity || this.startingEquity || currentEquity;
    if (base <= 0) return false;

    const drawdown = ((base - currentEquity) / base) * 100;
    this.state.dailyDrawdown = drawdown;

    if (drawdown >= this.state.maxDrawdownLimit) {
      this.state.isCircuitBroken = true;
      console.error(`\n🚨 [RISK DOMAIN] CIRCUIT BREAKER TRIGGERED! Drawdown: ${drawdown.toFixed(2)}%`);
      return true;
    }

    return false;
  }

  public static isSafeToTrade(): boolean {
    return !this.state.isCircuitBroken;
  }

  public static resetCircuit(): void {
    this.state.isCircuitBroken = false;
    this.state.dailyDrawdown = 0;
    console.log(`✅ [RISK DOMAIN] Circuit Breaker reset.`);
  }

  public static getMetrics(): RiskMetrics {
    return { ...this.state };
  }
}
