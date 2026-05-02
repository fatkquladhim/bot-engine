export enum NarrativeType {
  AI_AGENTS = 'AI_AGENTS',
  MEME_COINS = 'MEME_COINS',
  RWA = 'RWA',
  DEPIN = 'DEPIN',
  GAMING = 'GAMING',
  L1_L2 = 'L1_L2',
  DEFI = 'DEFI',
  UNKNOWN = 'UNKNOWN'
}

export class NarrativeMapper {
  private static MAPPING: Record<NarrativeType, string[]> = {
    [NarrativeType.AI_AGENTS]: ['FET_IDR', 'AI_IDR', 'GRT_IDR', 'NEAR_IDR', 'OCEAN_IDR'],
    [NarrativeType.MEME_COINS]: ['DOGE_IDR', 'SHIB_IDR', 'PEPE_IDR', 'BONK_IDR', 'WIF_IDR', 'ZEREBRO_IDR', 'PUMP_IDR', 'PIPPIN_IDR', 'FARTCOIN_IDR', 'MOODENG_IDR'],
    [NarrativeType.RWA]: ['LINK_IDR', 'ONDO_IDR', 'MKR_IDR', 'POLYX_IDR'],
    [NarrativeType.DEPIN]: ['FIL_IDR', 'RNDR_IDR', 'HNT_IDR', 'AR_IDR', 'THETA_IDR'],
    [NarrativeType.GAMING]: ['GALA_IDR', 'AXS_IDR', 'SAND_IDR', 'MANA_IDR', 'IMX_IDR', 'BEAM_IDR'],
    [NarrativeType.L1_L2]: ['ETH_IDR', 'SOL_IDR', 'MATIC_IDR', 'OP_IDR', 'ARB_IDR', 'AVAX_IDR', 'DOT_IDR', 'ADA_IDR'],
    [NarrativeType.DEFI]: ['UNI_IDR', 'AAVE_IDR', 'CAKE_IDR', 'COMP_IDR', 'SNX_IDR'],
    [NarrativeType.UNKNOWN]: []
  };

  public static getPairsForNarrative(narrative: NarrativeType): string[] {
    return this.MAPPING[narrative] || [];
  }

  public static getNarrativeForPair(pair: string): NarrativeType {
    const p = pair.toUpperCase();
    for (const [narrative, pairs] of Object.entries(this.MAPPING)) {
      if (pairs.includes(p)) return narrative as NarrativeType;
    }
    return NarrativeType.UNKNOWN;
  }
}
