import axios from 'axios';

export interface BinanceTicker {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

export class BinancePublicAPI {
  private static baseURL = 'https://api.binance.com/api/v3';

  public static async getTicker(symbol: string): Promise<BinanceTicker> {
    const url = `${this.baseURL}/ticker/24hr?symbol=${symbol.toUpperCase()}`;
    const response = await axios.get<BinanceTicker>(url);
    return response.data;
  }

  public static async getKlines(symbol: string, interval: string = '1h', limit: number = 24): Promise<any[][]> {
    const url = `${this.baseURL}/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`;
    const response = await axios.get<any[][]>(url);
    return response.data; // [ [openTime, open, high, low, close, volume, ...], ... ]
  }
}
