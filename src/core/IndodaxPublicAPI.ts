import axios from 'axios';

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
  // In-memory cache: key → { data, expiry }
  private static cache: Map<string, { data: any; expiry: number }> = new Map();

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

  public static async getTicker(pair: string): Promise<TickerResponse> {
    // Ticker cache 30 detik — cukup untuk exit manager, tidak perlu real-time
    const key = `ticker_${pair}`;
    const cached = this.getCached<TickerResponse>(key);
    if (cached) return cached;
    const res = await axios.get<TickerResponse>(`${this.baseURL}/${pair}/ticker`, { headers: this.getHeaders(), timeout: 8000 });
    this.setCached(key, res.data, 30_000);
    return res.data;
  }

  public static async getDepth(pair: string): Promise<DepthResponse> {
    // Orderbook cache 60 detik
    const key = `depth_${pair}`;
    const cached = this.getCached<DepthResponse>(key);
    if (cached) return cached;
    const res = await axios.get<DepthResponse>(`${this.baseURL}/depth/${pair}`, { headers: this.getHeaders(), timeout: 8000 });
    this.setCached(key, res.data, 60_000);
    return res.data;
  }

  public static async getServerTime(): Promise<number> {
    const res = await axios.get(`${this.baseURL}/server_time`, { headers: this.getHeaders(), timeout: 5000 });
    return res.data.server_time;
  }

  public static async getAllPairs(): Promise<PairInfo[]> {
    // Pairs list cache 1 jam — tidak berubah sering
    const key = 'all_pairs';
    const cached = this.getCached<PairInfo[]>(key);
    if (cached) return cached;
    const res = await axios.get(`${this.baseURL}/pairs`, { headers: this.getHeaders(), timeout: 10000 });
    const raw = res.data;
    if (!Array.isArray(raw)) return [];
    const pairs = raw.map((p: any) => ({
      id: p.id || '',
      symbol: (p.traded_currency || '').toLowerCase(),
      base_currency: (p.base_currency || '').toLowerCase(),
      traded_currency: (p.traded_currency || '').toLowerCase(),
      description: p.description || ''
    })).filter((p: PairInfo) => p.base_currency === 'idr' && p.traded_currency !== 'idr');
    this.setCached(key, pairs, 3_600_000);
    return pairs;
  }

  public static async getAllTickers(): Promise<Record<string, any>> {
    // All tickers cache 60 detik — 1 call untuk semua pair
    const key = 'all_tickers';
    const cached = this.getCached<Record<string, any>>(key);
    if (cached) return cached;
    const res = await axios.get('https://indodax.com/api/ticker_all', { headers: this.getHeaders(), timeout: 10000 });
    const data = res.data.tickers || {};
    this.setCached(key, data, 60_000);
    return data;
  }
}
