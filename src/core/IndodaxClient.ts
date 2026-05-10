import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { indodaxPublicLimiter } from '../utils/RateLimiter';
import { IndodaxPublicAPI } from './IndodaxPublicAPI';

export interface IndodaxConfig {
  apiKey: string;
  secretKey: string;
  tapiUrl?: string;
}

export interface TapiResponse<T = any> {
  success: number;
  return: T;
  error?: string;
}

let globalPauseUntil = 0;

export class IndodaxClient {
  private apiKey: string;
  private secretKey: string;
  private tapiUrl: string;
  private client: AxiosInstance;

  constructor(config: IndodaxConfig) {
    if (!config.apiKey || !config.secretKey) {
      throw new Error('API Key and Secret Key are required.');
    }

    this.apiKey = config.apiKey;
    this.secretKey = config.secretKey;
    this.tapiUrl = config.tapiUrl || 'https://indodax.com/tapi';

    this.client = axios.create({
      baseURL: this.tapiUrl,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  private generateSignature(postData: string): string {
    return crypto
      .createHmac('sha512', this.secretKey)
      .update(postData)
      .digest('hex');
  }

  private async tapiCallWithRateLimit<T = any>(method: string, params: Record<string, any> = {}): Promise<T> {
    if (Date.now() < globalPauseUntil) {
      const wait = Math.ceil((globalPauseUntil - Date.now()) / 1000);
      console.log(`   ⏸️ [TAPI PAUSE] Waiting ${wait}s for rate limit reset...`);
      await new Promise(r => setTimeout(r, Math.min(wait * 1000, 60000)));
    }

    return indodaxPublicLimiter.schedule(async () => {
      try {
        const timestamp = Date.now();
        const data = { method, timestamp, ...params };
        const postData = new URLSearchParams(data as any).toString();
        const sign = this.generateSignature(postData);

        const response = await this.client.post<TapiResponse<T>>('', postData, {
          headers: { Key: this.apiKey, Sign: sign },
        });

        if (response.data.success !== 1) {
          const errMsg = response.data.error || 'Unknown error';
          throw new Error(`Indodax API Error: ${errMsg}`);
        }

        return response.data.return;
      } catch (e: any) {
        if (e?.response?.status === 429) {
          const retryAfter = parseInt(e?.response?.headers?.['retry-after'] || '1800');
          console.log(`   🚫 [TAPI 429] Pausing all TAPI requests for ${retryAfter}s`);
          globalPauseUntil = Date.now() + (retryAfter * 1000);
        }
        if (axios.isAxiosError(e)) {
          throw new Error(`Network Error: ${e.message}`);
        }
        throw e;
      }
    });
  }

  public async getInfo() {
    return this.tapiCallWithRateLimit('getInfo');
  }

  public async trade(pair: string, type: 'buy' | 'sell', price: number, amount: number) {
    if (type === 'buy' && amount < 10000) {
      throw new Error(`Minimum buy amount is Rp 10,000 (Requested: Rp ${amount})`);
    }
    const cleanPrice = price >= 1 ? Math.floor(price) : parseFloat(price.toFixed(8));
    if (cleanPrice <= 0) {
      throw new Error(`Invalid price: ${price} for pair ${pair}`);
    }
    const params: Record<string, any> = { pair, type, price: cleanPrice };
    if (type === 'buy') {
      params[pair.split('_')[1]] = Math.floor(amount);
    } else {
      params[pair.split('_')[0]] = parseFloat(amount.toFixed(8));
    }
    return this.tapiCallWithRateLimit('trade', params);
  }

  public async openOrders(pair?: string) {
    return this.tapiCallWithRateLimit('openOrders', pair ? { pair } : {});
  }

  public async cancelOrder(pair: string, order_id: string, type: 'buy' | 'sell') {
    return this.tapiCallWithRateLimit('cancelOrder', { pair, order_id, type });
  }
}

// ============================================================
// SHARED BALANCE CACHE (60s TTL) - Avoid repeated getInfo calls
// ============================================================

let cachedBalance: any = null;
let lastBalanceFetch = 0;
const BALANCE_CACHE_TTL = 60_000;

export async function getCachedBalance(client: IndodaxClient): Promise<any> {
  const now = Date.now();
  if (cachedBalance && now - lastBalanceFetch < BALANCE_CACHE_TTL) {
    return cachedBalance;
  }
  cachedBalance = await client.getInfo();
  lastBalanceFetch = now;
  return cachedBalance;
}

export function clearBalanceCache() {
  cachedBalance = null;
  lastBalanceFetch = 0;
}

// ============================================================
// SHARED EQUITY CACHE (30s TTL) - All strategies read from this
// ============================================================

let cachedEquity: { total: number; idr: number; assets: any[]; tickers: any } | null = null;
let lastEquityFetch = 0;
const EQUITY_CACHE_TTL = 30_000;

export async function getCachedEquity(client: IndodaxClient): Promise<{ total: number; idr: number; assets: any[]; tickers: any }> {
  const now = Date.now();
  if (cachedEquity && now - lastEquityFetch < EQUITY_CACHE_TTL) {
    return cachedEquity;
  }

  const info = await getCachedBalance(client);
  const balances = info.balance || {};
  const allTickers = await IndodaxPublicAPI.getAllTickers();

  let totalIdr = parseFloat(balances.idr || '0');
  const assets: any[] = [];

  for (const [coin, amt] of Object.entries(balances)) {
    if (coin === 'idr' || coin === 'timestamp' || parseFloat(amt as string) <= 0) continue;
    const pair = `${coin.toLowerCase()}_idr`;
    const ticker = allTickers[`${coin.toLowerCase()}idr`] || allTickers[pair];
    const price = ticker ? parseFloat(ticker.last) : 0;
    const value = price * parseFloat(amt as string);
    if (value > 1000) {
      assets.push({ coin, amount: parseFloat(amt as string), value, price });
      totalIdr += value;
    }
  }

  cachedEquity = { total: totalIdr, idr: parseFloat(balances.idr || '0'), assets, tickers: allTickers };
  lastEquityFetch = now;
  return cachedEquity;
}

export function clearEquityCache() {
  cachedEquity = null;
  lastEquityFetch = 0;
}