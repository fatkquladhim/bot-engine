import { MarketRegime, MacroRegimeEngine } from '../predator/macro';
import { DynamicScanner } from '../predator/scanner';
import { SMCEngine } from '../predator/smc';
import { MemeRadar } from '../predator/memeRadar';
import { AIWarConsensus } from '../predator/aiWar';
import { SniperEntry } from '../predator/sniper';
import { ExitManager2 } from '../predator/exit2';
import { EmergencyShield } from '../predator/shield';
import { AIResult } from '../ai/AISentinel';
import { NarrativeEngine } from '../narrative/engine';
import { WhaleDetector } from '../modules/market/WhaleDetector';
import { ProbabilityEngine } from '../modules/ai/ProbabilityEngine';

export class PredatorStrategy {
  /**
   * Main Brain for Phase 4 Predator Mode
   */
  public async evaluateTrade(pair: string, aiResults: AIResult[]): Promise<{
    shouldBuy: boolean;
    action: 'MARKET_BUY' | 'LIMIT_ENTRY' | 'SNIPER_WATCHLIST' | 'SKIP';
    reason: string;
    score: number;
    targets?: { sl: number; tp1: number; tp2: number; tp3: number };
  }> {
    // 1. Emergency Check
    const emergency = await EmergencyShield.checkGlobalEmergency();
    if (emergency.isEmergency) {
      return { shouldBuy: false, action: 'SKIP', reason: emergency.reason || 'Global Emergency', score: 0 };
    }

    // 2. Macro Regime
    const { regime } = await MacroRegimeEngine.getCurrentRegime();
    
    // 3. AI Consensus
    const consensus = AIWarConsensus.calculateConsensus(aiResults);
    
    // 4. Technical Analysis (SMC + Sniper)
    const [smc, sniper] = await Promise.all([
      SMCEngine.analyze(pair),
      SniperEntry.scan(pair)
    ]);
    
    // 5. Narrative & Whale Action
    const [narrativeScore, whale] = await Promise.all([
      NarrativeEngine.getNarrativeScore(pair),
      WhaleDetector.detect(pair)
    ]);

    // 6. Meme Boost
    let memeBoost = 0;
    if (MemeRadar.isMeme(pair)) {
      const radar = await MemeRadar.analyzeMemeRotation();
      memeBoost = radar.boosts[pair] || 0;
    }

    // 7. Confidence Matrix (Phase 5.2)
    let confidenceScore = 0;
    confidenceScore += (consensus.finalScore / 100) * 30; // AI Consensus (Max 30)
    confidenceScore += (smc.smcScore / 100) * 15;        // SMC (Max 15)
    confidenceScore += (narrativeScore / 100) * 20;      // Narrative (Max 20)
    confidenceScore += (sniper.confidence / 100) * 15;   // Sniper Technical (Max 15)
    confidenceScore += (whale.isWhaleActive ? 15 : 0);   // Whale Bonus (Max 15)
    confidenceScore += memeBoost;                        // Meme Bonus (Max 10)

    // Normalize and add regime-based bias (Agility Fix)
    let finalScore = Math.min(100, confidenceScore + 15);
    if (regime === MarketRegime.WAR) finalScore += 5; // Aggressive in War
    if (regime === MarketRegime.DEFENSE) finalScore -= 5; // Cautious in Defense

    // 8. TIERED EXECUTION ENGINE (Phase 5.2)
    const entryPrice = sniper.entryPrice || aiResults[0]?.precise_entry || 0;
    const plan = ExitManager2.calculateInitialPlan(entryPrice);

    if (finalScore >= 75) {
      return {
        shouldBuy: true,
        action: 'MARKET_BUY',
        reason: `🦅 PREDATOR ELITE: High confidence breakout | ${smc.summary}`,
        score: finalScore,
        targets: plan
      };
    }

    if (finalScore >= 68) {
      return {
        shouldBuy: true, // Mark as true so engine tries to execute
        action: 'LIMIT_ENTRY',
        reason: `🎯 PREDATOR LIMIT: Good value setup, waiting for entry | ${smc.summary}`,
        score: finalScore,
        targets: plan
      };
    }

    if (finalScore >= 60) {
      return {
        shouldBuy: false,
        action: 'SNIPER_WATCHLIST',
        reason: `👀 SNIPER WATCH: Technicals valid but volume/narrative weak | Score ${finalScore.toFixed(0)}`,
        score: finalScore,
        targets: plan
      };
    }

    return { 
      shouldBuy: false, 
      action: 'SKIP',
      reason: `Score ${finalScore.toFixed(0)} < 60 (Weak Alpha)`, 
      score: finalScore 
    };
  }
}
