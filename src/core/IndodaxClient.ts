import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

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
      timeout: 10000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  /**
   * Generates HMAC-SHA512 signature for TAPI requests
   */
  private generateSignature(postData: string): string {
    return crypto
      .createHmac('sha512', this.secretKey)
      .update(postData)
      .digest('hex');
  }

  /**
   * Makes a request to the Private API (TAPI)
   */
  public async tapiCall<T = any>(method: string, params: Record<string, any> = {}): Promise<T> {
    const timestamp = Date.now();
    const data = {
      method,
      timestamp,
      ...params,
    };

    // Construct url-encoded string
    const postData = new URLSearchParams(data as any).toString();
    const sign = this.generateSignature(postData);

    try {
      const response = await this.client.post<TapiResponse<T>>('', postData, {
        headers: {
          Key: this.apiKey,
          Sign: sign,
        },
      });

      if (response.data.success !== 1) {
        throw new Error(`Indodax API Error: ${response.data.error || 'Unknown error'}`);
      }

      return response.data.return;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Network Error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get Account Balance
   */
  public async getInfo() {
    return this.tapiCall('getInfo');
  }

  /**
   * Place an order
   * @param pair e.g., 'btc_idr'
   * @param type 'buy' or 'sell'
   * @param price Price for limit order
   * @param amount Amount of crypto to buy/sell
   */
  public async trade(pair: string, type: 'buy' | 'sell', price: number, amount: number) {
    if (type === 'buy' && amount < 10000) {
      throw new Error(`Minimum buy amount is Rp 10,000 (Requested: Rp ${amount})`);
    }

    const cleanPrice = Math.floor(price);

    const params: Record<string, any> = {
      pair,
      type,
      price: cleanPrice,
    };

    if (type === 'buy') {
      params[pair.split('_')[1]] = Math.floor(amount); // IDR amount
    } else {
      params[pair.split('_')[0]] = parseFloat(amount.toFixed(8)); // Crypto amount
    }

    return this.tapiCall('trade', params);
  }

  /**
   * Get open orders
   */
  public async openOrders(pair?: string) {
    const params = pair ? { pair } : {};
    return this.tapiCall('openOrders', params);
  }

  /**
   * Cancel an order
   */
  public async cancelOrder(pair: string, order_id: string, type: 'buy' | 'sell') {
    return this.tapiCall('cancelOrder', {
      pair,
      order_id,
      type
    });
  }
}
