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
    maxDrawdownLimit: 5.0, // 5% default
    isCircuitBroken: false
  };

  /**
   * Monitor for global circuit break conditions.
   */
  public static monitor(currentEquity: number, startingEquity: number): boolean {
    const drawdown = ((startingEquity - currentEquity) / startingEquity) * 100;
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
