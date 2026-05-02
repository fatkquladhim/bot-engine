import axios from 'axios';

export interface TickerResponse {
  ticker: {
    high: string;
    low: string;
    vol_asset: string;
    vol_idr: string;
    last: string;
    buy: string;
    sell: string;
    server_time: number;
  };
}

export interface DepthResponse {
  buy: [string, string][]; // [price, amount]
  sell: [string, string][];
}

export interface PairInfo {
  id: string;          // e.g. "btcidr"
  symbol: string;      // e.g. "btc"
  base_currency: string;
  traded_currency: string;
  description: string;
}

export class IndodaxPublicAPI {
  private static baseURL = 'https://indodax.com/api';

  private static getHeaders() {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
      'Referer': 'https://indodax.com/',
      'Origin': 'https://indodax.com',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-site',
      'Cache-Control': 'no-cache'
    };
  }

  public static async getTicker(pair: string): Promise<TickerResponse> {
    const url = `${this.baseURL}/${pair}/ticker`;
    const response = await axios.get<TickerResponse>(url, { headers: this.getHeaders() });
    return response.data;
  }

  public static async getDepth(pair: string): Promise<DepthResponse> {
    const url = `${this.baseURL}/depth/${pair}`;
    const response = await axios.get<DepthResponse>(url, { headers: this.getHeaders() });
    return response.data;
  }

  public static async getServerTime(): Promise<number> {
    const url = `${this.baseURL}/server_time`;
    const response = await axios.get(url, { headers: this.getHeaders() });
    return response.data.server_time;
  }

  /**
   * Get all available trading pairs from Indodax
   * Indodax API format: { base_currency: 'idr', traded_currency: 'btc', ... }
   */
  public static async getAllPairs(): Promise<PairInfo[]> {
    const url = `${this.baseURL}/pairs`;
    const response = await axios.get(url, { headers: this.getHeaders() });
    const raw = response.data;

    // Debug: log first entry to confirm field names (only once at startup)
    if (Array.isArray(raw) && raw.length > 0) {
      const sample = raw[0];
      // Indodax uses base_currency='idr', traded_currency='btc'
      // Normalise whatever structure we get
      return raw.map((p: any) => ({
        id: p.id || '',
        symbol: (p.traded_currency || p.base_currency || '').toLowerCase(),
        base_currency: (p.base_currency || '').toLowerCase(),
        traded_currency: (p.traded_currency || '').toLowerCase(),
        description: p.description || ''
      })).filter((p: PairInfo) => p.base_currency === 'idr' && p.traded_currency !== 'idr');
    }
    return [];
  }

  /**
   * Get all tickers in one shot (more efficient than looping)
   */
  public static async getAllTickers(): Promise<Record<string, any>> {
    const url = `https://indodax.com/api/ticker_all`;
    const response = await axios.get(url, { headers: this.getHeaders() });
    return response.data.tickers || {};
  }
}
