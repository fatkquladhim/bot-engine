import axios from 'axios';
import fs from 'fs';
import path from 'path';

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class MarketDataFetcher {
  private dataDir: string;

  constructor() {
    // Pastikan folder data ada
    this.dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Mengambil data historis dari CoinGecko API (Bypass Internet Positif Sepenuhnya)
   * Karena ISP Anda memblokir Binance & KuCoin, kita gunakan Aggregator Data.
   */
  public async fetchRealCandles(pair: string, interval: string = '1hour', days: number = 30): Promise<CandleData[]> {
    // Kita gunakan data Bitcoin dalam mata uang IDR langsung dari CoinGecko
    const symbol = 'bitcoin'; 
    const currency = 'idr';

    const fileName = `${symbol}_${currency}_${days}d.json`;
    const filePath = path.join(this.dataDir, fileName);

    // 1. Cek Cache Lokal
    if (fs.existsSync(filePath)) {
      console.log(`\n📦 [DATA ENGINE] Memuat data lokal: ${fileName}`);
      const rawData = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(rawData);
    }

    console.log(`\n🌐 [DATA ENGINE] Mengunduh K-Line asli ${symbol} dari CoinGecko (Anti-Blokir)...`);
    
    try {
      // Endpoint OHLC CoinGecko: mengembalikan array of [time, open, high, low, close]
      // Jika days=30, interval otomatis 4 jam.
      const url = `https://api.coingecko.com/api/v3/coins/${symbol}/ohlc?vs_currency=${currency}&days=${days}`;
      const response = await axios.get(url);
      
      const resData = response.data;
      if (!Array.isArray(resData)) {
        throw new Error(`CoinGecko Error: Format data tidak dikenali.`);
      }

      // 2. Normalisasi Data CoinGecko
      // Format: [ time(ms), open, high, low, close ]
      const candles: CandleData[] = [];
      
      for (const row of resData) {
        const time = row[0]; 
        const open = parseFloat(row[1]);
        const high = parseFloat(row[2]);
        const low = parseFloat(row[3]);
        const close = parseFloat(row[4]);
        const volume = 0; // CoinGecko OHLC tidak memberikan data volume. Kita abaikan di simulasi ini.

        if (high < low) throw new Error(`Data Corrupt pada timestamp ${time}: High < Low`);

        candles.push({ time, open, high, low, close, volume });
      }

      // 3. Simpan ke lokal
      fs.writeFileSync(filePath, JSON.stringify(candles, null, 2));
      console.log(`✅ [DATA ENGINE] Sukses menyimpan ${candles.length} candle ke ${fileName}`);

      return candles;

    } catch (error: any) {
      console.error(`\n❌ [DATA ENGINE ERROR] Gagal mengunduh data dari CoinGecko: ${error.message}`);
      return []; 
    }
  }
}
