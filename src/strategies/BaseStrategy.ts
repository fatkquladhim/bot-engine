import { TradingEngine } from '../engine/TradingEngine';

export interface Signal {
  pair: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  amountIdr?: number; // For BUY
  amountCrypto?: number; // For SELL (absolute)
  sellPercentage?: number; // For SELL (1-100%)
  targetPrice?: number;
}

export abstract class BaseStrategy {
  public name: string;
  protected engine: TradingEngine;

  constructor(name: string, engine: TradingEngine) {
    this.name = name;
    this.engine = engine;
  }

  /**
   * Main method to be implemented by specific strategies
   * Evaluates the market and returns a trading signal.
   */
  public abstract evaluate(pair: string, currentPrice?: number): Promise<Signal>;

  /**
   * Helper to execute a signal safely
   */
  public async executeSignal(signal: Signal) {
    if (signal.action === 'HOLD') {
      console.log(`[${this.name}] Signal HOLD for ${signal.pair}`);
      return;
    }

    try {
      if (signal.action === 'BUY' && signal.amountIdr) {
        console.log(`[${this.name}] Executing BUY for ${signal.pair}`);
        await this.engine.executeBuy(signal.pair, signal.amountIdr);
      } else if (signal.action === 'SELL') {
        let amountToSell = signal.amountCrypto;
        // Check if we want to sell a percentage of our holdings
        if (signal.sellPercentage && this.engine.state.openPositions[signal.pair]) {
           amountToSell = this.engine.state.openPositions[signal.pair].amountCrypto * (signal.sellPercentage / 100);
        }
        if (amountToSell) {
          console.log(`[${this.name}] Executing SELL for ${signal.pair} (${signal.sellPercentage ? signal.sellPercentage + '%' : 'Absolute'})`);
          await this.engine.executeSell(signal.pair, amountToSell);
        } else {
          console.warn(`[${this.name}] Failed to SELL: amount is undefined or position not found.`);
        }
      }
    } catch (error: any) {
      console.error(`[${this.name}] Failed to execute signal: ${error.message}`);
    }
  }
}
