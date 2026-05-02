import { IndodaxPublicAPI } from '../../core/IndodaxPublicAPI';
import { RiskDomain } from '../risk/RiskDomain';

export class ExecutionDomain {
  /**
   * Execute a sell order with safety checks and retries.
   */
  public static async executeSafeSell(pair: string, amount: number, client: any): Promise<any> {
    if (amount <= 0) return null;

    let retries = 3;
    while (retries > 0) {
      try {
        console.log(`📡 [EXECUTION] Attempting SELL ${pair.toUpperCase()} | Amount: ${amount}`);
        const result = await client.trade(pair, 'sell', amount);
        return result;
      } catch (e: any) {
        retries--;
        console.error(`⚠️ [EXECUTION] Sell failed: ${e.message}. Retries left: ${retries}`);
        if (retries === 0) throw e;
        await new Promise(r => setTimeout(r, 2000)); // 2s backoff
      }
    }
  }

  /**
   * Execute a buy order with risk validation.
   */
  public static async executeSafeBuy(pair: string, amountIdr: number, client: any): Promise<any> {
    if (!RiskDomain.isSafeToTrade()) {
      throw new Error('Trading suspended by Risk Domain (Circuit Breaker)');
    }

    try {
      console.log(`📡 [EXECUTION] Attempting BUY ${pair.toUpperCase()} | Budget: Rp ${amountIdr.toLocaleString()}`);
      // In Indodax, for buy, we usually specify the IDR amount
      const result = await client.trade(pair, 'buy', amountIdr);
      return result;
    } catch (e: any) {
      console.error(`❌ [EXECUTION] Buy failed: ${e.message}`);
      throw e;
    }
  }
}
