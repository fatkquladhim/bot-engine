import axios from 'axios';
import { indodaxPublicLimiter } from '../utils/RateLimiter';

export interface TickerResponse {
  ticker: {
    high: string; low: string; vol_asset: string; vol_idr: string;
    last: string; buy: string; sell: string; server_time: number;
  };
}
export interface DepthResponse { buy: [string, string][]; sell: [string, string][]; }
export interface PairInfo { id: string; symbol: string; base_currency: string; traded_currency: string; description: string; }

export class IndodaxPublicAPI {
  private static baseURL = 'https://indodax.com/api';
  private static cache: Map<string, { data: any; expiry: number }> = new Map();
  private static isGlobalPause = false;
  private static pauseUntil = 0;

  private static getHeaders() {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Referer': 'https://indodax.com/',
      'Accept-Encoding': 'gzip, compress, deflate, br'
    };
  }

  private static getCached<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (item && Date.now() < item.expiry) return item.data as T;
    this.cache.delete(key);
    return null;
  }

  private static setCached(key: string, data: any, ttlMs: number) {
    this.cache.set(key, { data, expiry: Date.now() + ttlMs });
  }

  private static async safeGet<T>(url: string, cacheKey: string, ttlMs: number): Promise<T> {
    const cached = this.getCached<T>(cacheKey);
    if (cached) return cached;

    if (this.isGlobalPause && Date.now() < this.pauseUntil) {
      const wait = Math.ceil((this.pauseUntil - Date.now()) / 1000);
      console.log(`   ⏸️ [INDODAX PAUSE] Waiting ${wait}s for rate limit reset...`);
      await new Promise(r => setTimeout(r, Math.min(wait * 1000, 60000)));
    }

    return indodaxPublicLimiter.schedule(() => axios.get(url, {
      headers: this.getHeaders(),
      timeout: 8000
    }).then(res => {
      this.setCached(cacheKey, res.data, ttlMs);
      return res.data as T;
    }).catch((e: any) => {
      if (e?.response?.status === 429) {
        const retryAfter = parseInt(e?.response?.headers?.['retry-after'] || '1800');
        console.log(`   🚫 [INDODAX 429] Pausing all requests for ${retryAfter}s`);
        this.isGlobalPause = true;
        this.pauseUntil = Date.now() + (retryAfter * 1000);
        this.cache.clear();
        throw new Error(`Indodax rate limited. Retry after ${retryAfter}s`);
      }
      throw e;
    }));
  }

  public static async getTicker(pair: string): Promise<TickerResponse> {
    return this.safeGet<TickerResponse>(
      `${this.baseURL}/${pair}/ticker`,
      `ticker_${pair}`,
      30_000
    );
  }

  public static async getDepth(pair: string): Promise<DepthResponse> {
    return this.safeGet<DepthResponse>(
      `${this.baseURL}/depth/${pair}`,
      `depth_${pair}`,
      60_000
    );
  }

  public static async getServerTime(): Promise<number> {
    const res = await this.safeGet<{ server_time: number }>(
      `${this.baseURL}/server_time`,
      'server_time',
      5_000
    );
    return res.server_time;
  }

  public static async getAllPairs(): Promise<PairInfo[]> {
    return this.safeGet<PairInfo[]>(
      `${this.baseURL}/pairs`,
      'all_pairs',
      3_600_000
    ).then(raw => {
      if (!Array.isArray(raw)) return [];
      return (raw as any[]).map((p: any) => ({
        id: p.id || '',
        symbol: (p.traded_currency || '').toLowerCase(),
        base_currency: (p.base_currency || '').toLowerCase(),
        traded_currency: (p.traded_currency || '').toLowerCase(),
        description: p.description || ''
      })).filter((p: PairInfo) => p.base_currency === 'idr' && p.traded_currency !== 'idr');
    });
  }

  public static async getAllTickers(): Promise<Record<string, any>> {
    return this.safeGet<{ tickers: Record<string, any> }>(
      'https://indodax.com/api/ticker_all',
      'all_tickers',
      60_000
    ).then(res => res.tickers || {});
  }

  public static clearCache() {
    this.cache.clear();
  }
}