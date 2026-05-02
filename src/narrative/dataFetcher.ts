import axios from 'axios';

export interface NarrativeData {
  fng: number;
  trendingCoins: string[];
  dexTrends: any[];
  googleTrends: Record<string, number>;
  newsCatalysts: string[];
}

export class NarrativeDataFetcher {
  private static FNG_API = 'https://api.alternative.me/fng/?limit=1';
  private static COINGECKO_TRENDING = 'https://api.coingecko.com/api/v3/search/trending';
  private static DEXSCREENER_SEARCH = 'https://api.dexscreener.com/latest/dex/search?q=';
  
  // News RSS Feeds
  private static RSS_FEEDS = [
    'https://www.coindesk.com/arc/outboundfeeds/rss/',
    'https://cointelegraph.com/rss'
  ];

  public static async fetchAll(): Promise<NarrativeData> {
    const [fng, cgTrending, dex] = await Promise.allSettled([
      this.fetchFNG(),
      this.fetchCGTrending(),
      this.fetchDexScreener('solana') // Focusing on Solana for meme narrative
    ]);

    return {
      fng: fng.status === 'fulfilled' ? fng.value : 50,
      trendingCoins: cgTrending.status === 'fulfilled' ? cgTrending.value : [],
      dexTrends: dex.status === 'fulfilled' ? dex.value : [],
      googleTrends: await this.fetchGoogleTrends(),
      newsCatalysts: await this.fetchNews()
    };
  }

  private static async fetchFNG(): Promise<number> {
    const res = await axios.get(this.FNG_API);
    return parseInt(res.data.data[0].value);
  }

  private static async fetchCGTrending(): Promise<string[]> {
    const res = await axios.get(this.COINGECKO_TRENDING);
    return res.data.coins.map((c: any) => c.item.symbol);
  }

  private static async fetchDexScreener(query: string): Promise<any[]> {
    const res = await axios.get(`${this.DEXSCREENER_SEARCH}${query}`);
    return res.data.pairs || [];
  }

  private static async fetchGoogleTrends(): Promise<Record<string, number>> {
    // Google Trends requires specific scrapers or API keys (like SerpApi)
    // For now, we return a mock object that can be filled via manual input or proxy
    return {
      'crypto': 75,
      'bitcoin': 60,
      'ai': 90,
      'meme': 95
    };
  }

  private static async fetchNews(): Promise<string[]> {
    // Simple RSS fetch (without full XML parser for brevity)
    // In a real app, use 'rss-parser'
    try {
      const res = await axios.get(this.RSS_FEEDS[0]);
      const titles = res.data.match(/<title>(.*?)<\/title>/g) || [];
      return titles.slice(1, 5).map((t: string) => t.replace(/<\/?title>/g, ''));
    } catch {
      return ['No recent news found'];
    }
  }
}
