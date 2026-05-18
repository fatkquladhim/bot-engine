import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { indodaxTapiPost, isPaused, getPauseRemaining } from '../utils/RateLimiter';
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

  public async tapiCall<T = any>(method: string, params: Record<string, any> = {}): Promise<T> {
    const timestamp = Date.now();
    const data = { method, timestamp, ...params };
    const postData = new URLSearchParams(data as any).toString();
    const sign = this.generateSignature(postData);

    const response = await indodaxTapiPost(
      this.tapiUrl,
      postData,
      { Key: this.apiKey, Sign: sign },
      15000
    );

    if (response.success !== 1) {
      throw new Error(`Indodax API Error: ${response.error || 'Unknown error'}`);
    }

    return response.return as T;
  }

  public async getInfo() {
    return this.tapiCall('getInfo');
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
    return this.tapiCall('trade', params);
  }

  public async openOrders(pair?: string) {
    return this.tapiCall('openOrders', pair ? { pair } : {});
  }

  public async cancelOrder(pair: string, order_id: string, type: 'buy' | 'sell') {
    return this.tapiCall('cancelOrder', { pair, order_id, type });
  }
}

// ============================================================
// SHARED BALANCE CACHE (60s TTL)
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
// SHARED EQUITY CACHE (30s TTL)
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
  const holds = info.balance_hold || {};
  const allTickers = await IndodaxPublicAPI.getAllTickers();

  const idrBalance = parseFloat(balances.idr || '0') + parseFloat(holds.idr || '0');
  let totalIdr = idrBalance;
  const assets: any[] = [];

  const allCoins = new Set([...Object.keys(balances), ...Object.keys(holds)]);

  for (const coin of allCoins) {
    if (coin === 'idr' || coin === 'timestamp') continue;
    const totalAmt = parseFloat(balances[coin] || '0') + parseFloat(holds[coin] || '0');
    if (totalAmt <= 0) continue;
    
    // FIX: Indodax Ticker All keys are inconsistent (btcidr vs btc_idr)
    const pairUnderscore = `${coin.toLowerCase()}_idr`;
    const pairNoUnderscore = `${coin.toLowerCase()}idr`;
    const ticker = allTickers[pairNoUnderscore] || allTickers[pairUnderscore];
    
    const price = ticker ? parseFloat(ticker.last) : 0;
    const value = price * totalAmt;
    if (value > 1000) {
      assets.push({ coin: coin.toUpperCase(), amount: totalAmt, value, price });
      totalIdr += value;
    }
  }

  cachedEquity = { total: totalIdr, idr: idrBalance, assets, tickers: allTickers };
  lastEquityFetch = now;
  return cachedEquity;
}

export function clearEquityCache() {
  cachedEquity = null;
  lastEquityFetch = 0;
}