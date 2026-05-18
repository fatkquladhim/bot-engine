import axios from 'axios';
import { indodaxGet, isPaused, getPauseRemaining } from '../utils/RateLimiter';

export interface TickerResponse {
  ticker: {
    high: string; low: string; vol_asset: string; vol_idr: string;
    last: string; buy: string; sell: string; server_time: number;
  };
}
export interface DepthResponse { buy: [string, string][]; sell: [string, string][]; }
export interface PairInfo { id: string; symbol: string; base_currency: string; traded_currency: string; description: string; }

const cache: Map<string, { data: any; expiry: number }> = new Map();

export class IndodaxPublicAPI {

  public static async getTicker(pair: string): Promise<TickerResponse> {
    const cached = cache.get(`ticker_${pair}`);
    if (cached && Date.now() < cached.expiry) return cached.data as TickerResponse;
    const data = await indodaxGet(
      `https://indodax.com/api/${pair}/ticker`,
      `ticker_${pair}`,
      cache,
      30_000
    );
    return data as TickerResponse;
  }

  public static async getDepth(pair: string): Promise<DepthResponse> {
    const cached = cache.get(`depth_${pair}`);
    if (cached && Date.now() < cached.expiry) return cached.data as DepthResponse;
    const data = await indodaxGet(
      `https://indodax.com/api/depth/${pair}`,
      `depth_${pair}`,
      cache,
      60_000
    );
    return data as DepthResponse;
  }

  public static async getServerTime(): Promise<number> {
    const cached = cache.get('server_time');
    if (cached && Date.now() < cached.expiry) return (cached.data as any).server_time;
    const data = await indodaxGet(
      'https://indodax.com/api/server_time',
      'server_time',
      cache,
      5_000
    );
    return (data as any).server_time;
  }

  public static async getAllPairs(): Promise<PairInfo[]> {
    const cached = cache.get('all_pairs');
    if (cached && Date.now() < cached.expiry) return cached.data as PairInfo[];
    const raw = await indodaxGet(
      'https://indodax.com/api/pairs',
      'all_pairs',
      cache,
      3_600_000
    );
    if (!Array.isArray(raw)) return [];
    const pairs = (raw as any[]).map((p: any) => ({
      id: p.id || '',
      symbol: (p.traded_currency || '').toLowerCase(),
      base_currency: (p.base_currency || '').toLowerCase(),
      traded_currency: (p.traded_currency || '').toLowerCase(),
      description: p.description || ''
    })).filter((p: PairInfo) => p.base_currency === 'idr' && p.traded_currency !== 'idr');
    return pairs;
  }

  public static async getAllTickers(): Promise<Record<string, any>> {
    const cached = cache.get('all_tickers');
    if (cached && Date.now() < cached.expiry) return cached.data as Record<string, any>;
    const data: any = await indodaxGet(
      'https://indodax.com/api/summaries',
      'all_tickers',
      cache,
      60_000
    );
    
    if (data && data.tickers && Object.keys(data.tickers).length > 0) {
      return data.tickers;
    }

    // Fallback: If API fails, try to return previous cache even if expired
    return (cached?.data as any)?.tickers || (data as any)?.tickers || {};
  }

  public static clearCache() {
    cache.clear();
  }

  public static isPaused() { return isPaused(); }
  public static getPauseRemaining() { return getPauseRemaining(); }
}
