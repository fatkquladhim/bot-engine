import { BaseStrategy, Signal } from './BaseStrategy';
import { IndodaxPublicAPI } from '../core/IndodaxPublicAPI';

/**
 * Example Strategy: Dollar Cost Averaging
 * Simple strategy that always signals BUY for a fixed amount.
 */
export class DCAStrategy extends BaseStrategy {
  private fixedAmountIdr: number;

  constructor(engine: any, fixedAmountIdr: number) {
    super('DCA_Bot', engine);
    this.fixedAmountIdr = fixedAmountIdr;
  }

  public async evaluate(pair: string): Promise<Signal> {
    // In a real DCA, we check if it's the right time to buy (e.g., once a day)
    // For this demonstration, we just fetch price and signal BUY
    
    const ticker = await IndodaxPublicAPI.getTicker(pair);
    console.log(`[DCA] Current price of ${pair} is Rp ${parseInt(ticker.ticker.sell).toLocaleString('id-ID')}`);
    
    return {
      pair,
      action: 'BUY',
      amountIdr: this.fixedAmountIdr
    };
  }
}
