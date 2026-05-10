import { AIResult } from '../ai/AISentinel';
import { MarketRegime, MacroRegimeEngine } from '../predator/macro';

export interface ConsensusInput {
  narrativeScore: number;
  hypeLevel: number;
  volumeAcceleration: number;
  smartMoneyProbability: number;
  explosivePotential: number;
  momentumScore: number;
  technicalConfirmation: number;
}

export class AIWarConsensus {
  /**
   * Enhanced Consensus Engine - PREDATOR MODE
   * Mengintegrasikan sinyal dari beberapa agen AI dengan prioritas narrative.
   * Logic: Narrative-First + Momentum Execution
   */
  public static calculateConsensus(results: AIResult[]): { 
    finalScore: number; 
    action: 'BUY' | 'WATCHLIST' | 'WAIT' | 'AVOID'; 
    isManipulated: boolean;
    summary: string;
  } {
    if (results.length === 0) {
      return { finalScore: 0, action: 'AVOID', isManipulated: false, summary: 'No signals' };
    }

    const scores = results.map(r => r.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const variance = maxScore - minScore;
    const isManipulated = variance > 40;

    // Get current regime for aggressive adjustments
    let regime = MarketRegime.WAR;
    try {
      const regimeResult = MacroRegimeEngine.getCurrentRegime();
      if (regimeResult && 'regime' in regimeResult) {
        regime = (regimeResult as any).regime || MarketRegime.WAR;
      }
    } catch { /* Use default WAR */ }

    // 3-model voting: hitung berapa yang BUY
    const buyVotes = results.filter(r => r.action === 'BUY').length;
    const totalVotes = results.length;

    let action: 'BUY' | 'WATCHLIST' | 'WAIT' | 'AVOID' = 'AVOID';
    
    // === PREDATOR MODE: Aggressive thresholds ===
    
    // HIGH NARRATIVE EXECUTION: Jika score tinggi, langsung BUY
    if (buyVotes >= 2 && avgScore >= 65) {
      action = 'BUY'; // Aggressive: langsung BUY dengan score 65+
    }
    // MODERATE: Score 55-64 = WATCHLIST, bukan WAIT
    else if (buyVotes >= 2 && avgScore >= 50) {
      action = 'BUY'; // Aggressive: langsung BUY
    }
    // MINIMAL CONSENSUS: 1 BUY vote = WATCHLIST (bukan AVOID)
    else if (buyVotes >= 1 && avgScore >= 40) {
      action = 'WATCHLIST'; // Still opportunity to watch
    }
    // WEAK SIGNAL: Score 30-39 = WATCHLIST
    else if (avgScore >= 30) {
      action = 'WATCHLIST';
    }
    // VERY WEAK: Di bawah 30 = AVOID
    else {
      action = 'AVOID';
    }

    // === MEME MANIA MODE: Ultra Aggressive ===
    if (regime === MarketRegime.MEME_MANIA) {
      if (buyVotes >= 1 && avgScore >= 50) action = 'BUY';
      else if (buyVotes >= 1 && avgScore >= 30) action = 'WATCHLIST';
      else action = 'AVOID';
    }

    // === PREDATOR MODE: More lenient ===
    if (regime === MarketRegime.PREDATOR) {
      if (buyVotes >= 2 && avgScore >= 55) action = 'BUY';
      else if (buyVotes >= 1 && avgScore >= 40) action = 'WATCHLIST';
    }

    // === DEFENSE MODE: Keep original behavior ===
    if (regime === MarketRegime.DEFENSE) {
      if (buyVotes >= 2 && avgScore >= 70) action = 'BUY';
      else if (buyVotes >= 2 && avgScore >= 55) action = 'WATCHLIST';
      else if (buyVotes >= 1 && avgScore >= 45) action = 'WAIT';
      else action = 'AVOID';
    }

    // Manipulation warning - but not a hard block in PREDATOR/MEME_MANIA
    if (isManipulated && regime === MarketRegime.DEFENSE) {
      action = 'WAIT';
    }

    return {
      finalScore: Math.round(avgScore),
      action,
      isManipulated,
      summary: `Avg: ${avgScore.toFixed(0)} | Votes: ${buyVotes}/${totalVotes} BUY | Var: ${variance} | ${regime} | ${isManipulated ? '⚠️ DIVERGE' : '✅ OK'}`
    };
  }

  /**
   * Narrative Execution Override Check
   * Jika narrative sangat kuat, boost BUY confidence secara signifikan
   */
  public static checkNarrativeExecutionOverride(input: ConsensusInput): {
    isOverride: boolean;
    confidenceBoost: number;
    reason: string;
  } {
    const { narrativeScore, hypeLevel, volumeAcceleration, smartMoneyProbability, explosivePotential } = input;

    // Check override conditions
    const isNarrativeStrong = narrativeScore >= 85;
    const isHypeHigh = hypeLevel >= 90;
    const isVolumeAccelerating = volumeAcceleration >= 85;
    const isSmartMoneyActive = smartMoneyProbability >= 60;
    const hasExplosivePotential = explosivePotential >= 30;

    // All conditions met = EXECUTE NOW
    if (isNarrativeStrong && isHypeHigh && isVolumeAccelerating && isSmartMoneyActive && hasExplosivePotential) {
      return {
        isOverride: true,
        confidenceBoost: 30, // +30 to confidence
        reason: '🚀 NARRATIVE EXECUTION OVERRIDE: Strong narrative + hype + volume + smart money'
      };
    }

    // Partial conditions = Significant boost
    const conditionsMet = [isNarrativeStrong, isHypeHigh, isVolumeAccelerating, isSmartMoneyActive, hasExplosivePotential]
      .filter(Boolean).length;

    if (conditionsMet >= 4) {
      return {
        isOverride: true,
        confidenceBoost: 20,
        reason: '⚡ STRONG NARRATIVE SIGNAL: Multiple conditions met'
      };
    }

    if (conditionsMet >= 3) {
      return {
        isOverride: true,
        confidenceBoost: 15,
        reason: '📈 NARRATIVE MOMENTUM: Core conditions met'
      };
    }

    return {
      isOverride: false,
      confidenceBoost: 0,
      reason: 'Standard consensus flow'
    };
  }

  /**
   * Calculate consensus with narrative override
   * Enhanced version that considers narrative execution override
   */
  public static calculateEnhancedConsensus(
    results: AIResult[],
    narrativeInput: ConsensusInput
  ): {
    finalScore: number;
    action: 'BUY' | 'WATCHLIST' | 'WAIT' | 'AVOID';
    isManipulated: boolean;
    summary: string;
    override: { isOverride: boolean; confidenceBoost: number; reason: string };
  } {
    // Base consensus
    const baseConsensus = this.calculateConsensus(results);
    
    // Check narrative override
    const override = this.checkNarrativeExecutionOverride(narrativeInput);
    
    // Apply boost
    let finalScore = baseConsensus.finalScore;
    if (override.isOverride) {
      finalScore = Math.min(100, finalScore + override.confidenceBoost);
    }

    // Determine action based on enhanced score
    let action = baseConsensus.action;
    
    // Override can upgrade action
    if (override.isOverride && finalScore >= 60) {
      if (action === 'WATCHLIST' || action === 'WAIT') {
        action = 'BUY';
      }
    }

    return {
      ...baseConsensus,
      finalScore,
      action,
      override
    };
  }
}
