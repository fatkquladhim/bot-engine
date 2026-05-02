import axios from 'axios';
import crypto from 'crypto';
import querystring from 'querystring';

export class IndodaxClient {
  private apiKey: string;
  private apiSecret: string;

  constructor() {
    this.apiKey = process.env.INDODAX_API_KEY || '';
    this.apiSecret = process.env.INDODAX_SECRET_KEY || '';
  }

  private async tapiCall(method: string, params: any = {}) {
    const payload = querystring.stringify({
      method,
      nonce: Date.now(),
      ...params
    });

    const signature = crypto
      .createHmac('sha512', this.apiSecret)
      .update(payload)
      .digest('hex');

    const response = await axios.post('https://indodax.com/tapi', payload, {
      headers: {
        'Key': this.apiKey,
        'Sign': signature,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return response.data;
  }

  public async getInfo() {
    return this.tapiCall('getInfo');
  }

  public async trade(pair: string, type: 'buy' | 'sell', price: number, amount: number) {
    const params: any = {
      pair,
      type,
      price
    };
    if (type === 'buy') params.idr = Math.floor(amount);
    else params[pair.split('_')[0]] = amount;
    
    return this.tapiCall('trade', params);
  }

  public async cancelOrder(pair: string, order_id: string, type: 'buy' | 'sell') {
    return this.tapiCall('cancelOrder', { pair, order_id, type });
  }

  public static async getTicker(pair: string) {
    const res = await axios.get(`https://indodax.com/api/ticker/${pair}`);
    return res.data;
  }

  public static async getAllTickers() {
    const res = await axios.get('https://indodax.com/api/summaries');
    return res.data;
  }
}
