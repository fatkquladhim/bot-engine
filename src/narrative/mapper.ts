export enum NarrativeType {
  AI_AGENTS = 'AI_AGENTS',
  RWA_DEFI = 'RWA_DEFI',
  MEME_COINS = 'MEME_COINS',
  GAMING = 'GAMING',
  DEPIN = 'DEPIN',
  L1_L2_ECOSYSTEM = 'L1_L2_ECOSYSTEM',
  SOCIALFI = 'SOCIALFI',
  UNKNOWN = 'UNKNOWN'
}

export type CoinSector = NarrativeType;

export class NarrativeMapper {
  private static readonly MAPPING: Record<string, CoinSector> = {
    // AI
    'fet': NarrativeType.AI_AGENTS,
    'rndr': NarrativeType.AI_AGENTS,
    'tao': NarrativeType.AI_AGENTS,
    'ocean': NarrativeType.AI_AGENTS,
    'agix': NarrativeType.AI_AGENTS,
    'akt': NarrativeType.AI_AGENTS,
    'near': NarrativeType.AI_AGENTS,
    'grt': NarrativeType.AI_AGENTS,
    'thg': NarrativeType.AI_AGENTS,
    'ai': NarrativeType.AI_AGENTS,
    'arkm': NarrativeType.AI_AGENTS,

    // RWA
    'ondo': NarrativeType.RWA_DEFI,
    'cfg': NarrativeType.RWA_DEFI,
    'polyx': NarrativeType.RWA_DEFI,
    'om': NarrativeType.RWA_DEFI,
    'tru': NarrativeType.RWA_DEFI,
    'mpl': NarrativeType.RWA_DEFI,
    'snx': NarrativeType.RWA_DEFI,
    'mkr': NarrativeType.RWA_DEFI,

    // MEME
    'pepe': NarrativeType.MEME_COINS,
    'doge': NarrativeType.MEME_COINS,
    'shib': NarrativeType.MEME_COINS,
    'bonk': NarrativeType.MEME_COINS,
    'floki': NarrativeType.MEME_COINS,
    'wif': NarrativeType.MEME_COINS,
    'fartcoin': NarrativeType.MEME_COINS,
    'pippin': NarrativeType.MEME_COINS,
    'goat': NarrativeType.MEME_COINS,
    'giga': NarrativeType.MEME_COINS,
    'brett': NarrativeType.MEME_COINS,
    'pnut': NarrativeType.MEME_COINS,
    'bome': NarrativeType.MEME_COINS,
    'neiro': NarrativeType.MEME_COINS,
    'turbo': NarrativeType.MEME_COINS,

    // GAMING
    'axs': NarrativeType.GAMING,
    'gala': NarrativeType.GAMING,
    'sand': NarrativeType.GAMING,
    'mana': NarrativeType.GAMING,
    'enj': NarrativeType.GAMING,
    'imx': NarrativeType.GAMING,
    'beam': NarrativeType.GAMING,
    'ron': NarrativeType.GAMING,
    'pixel': NarrativeType.GAMING,
    'not': NarrativeType.GAMING,

    // DEPIN
    'hnt': NarrativeType.DEPIN,
    'fil': NarrativeType.DEPIN,
    'ar': NarrativeType.DEPIN,
    'storj': NarrativeType.DEPIN,
    'theta': NarrativeType.DEPIN,
    'iotx': NarrativeType.DEPIN,
    'honey': NarrativeType.DEPIN,

    // LAYER 1 & 2 / INFRA
    'arb': NarrativeType.L1_L2_ECOSYSTEM,
    'op': NarrativeType.L1_L2_ECOSYSTEM,
    'matic': NarrativeType.L1_L2_ECOSYSTEM,
    'strk': NarrativeType.L1_L2_ECOSYSTEM,
    'manta': NarrativeType.L1_L2_ECOSYSTEM,
    'metis': NarrativeType.L1_L2_ECOSYSTEM,
    'zk': NarrativeType.L1_L2_ECOSYSTEM,
    'base': NarrativeType.L1_L2_ECOSYSTEM,
    'hype': NarrativeType.L1_L2_ECOSYSTEM,
    'eth': NarrativeType.L1_L2_ECOSYSTEM,
    'sol': NarrativeType.L1_L2_ECOSYSTEM,
    'ada': NarrativeType.L1_L2_ECOSYSTEM,
    'avax': NarrativeType.L1_L2_ECOSYSTEM,
    'dot': NarrativeType.L1_L2_ECOSYSTEM,
    'sui': NarrativeType.L1_L2_ECOSYSTEM,
    'apt': NarrativeType.L1_L2_ECOSYSTEM,
    'ton': NarrativeType.L1_L2_ECOSYSTEM,
    'bnb': NarrativeType.L1_L2_ECOSYSTEM,
    'pol': NarrativeType.L1_L2_ECOSYSTEM,
    'xrp': NarrativeType.L1_L2_ECOSYSTEM
  };

  /**
   * Mendapatkan sektor koin berdasarkan simbol (huruf kecil).
   */
  public static getNarrativeForPair(pair: string): NarrativeType {
    const symbol = pair.split('_')[0].toLowerCase();
    return this.MAPPING[symbol] || NarrativeType.UNKNOWN;
  }

  /**
   * Mendapatkan daftar koin dalam satu sektor.
   */
  public static getCoinsInSector(sector: NarrativeType): string[] {
    return Object.entries(this.MAPPING)
      .filter(([_, s]) => s === sector)
      .map(([coin, _]) => coin);
  }

  /**
   * Mendapatkan daftar pair untuk suatu narasi (e.g. ['pepe_idr', 'doge_idr'])
   */
  public static getPairsForNarrative(narrative: NarrativeType): string[] {
    return Object.entries(this.MAPPING)
      .filter(([_, s]) => s === narrative)
      .map(([coin, _]) => `${coin}_idr`);
  }

  /**
   * Mendapatkan Risk Multiplier berdasarkan sektor.
   * Meme & Gaming lebih berisiko -> SL lebih ketat.
   */
  public static getRiskProfile(sector: NarrativeType): { slMult: number; tpMult: number; confidenceReq: number } {
    switch (sector) {
      case NarrativeType.MEME_COINS:
      case NarrativeType.GAMING:
        return { slMult: 0.5, tpMult: 1.5, confidenceReq: 75 }; // High Risk: SL tipis, TP jauh, Butuh konf tinggi
      case NarrativeType.AI_AGENTS:
      case NarrativeType.DEPIN:
      case NarrativeType.RWA_DEFI:
        return { slMult: 1.0, tpMult: 1.2, confidenceReq: 60 }; // Standard
      case NarrativeType.L1_L2_ECOSYSTEM:
        return { slMult: 1.2, tpMult: 1.0, confidenceReq: 50 }; // Conservative: SL lebih lebar, TP standard
      default:
        return { slMult: 1.0, tpMult: 1.0, confidenceReq: 65 };
    }
  }
}
