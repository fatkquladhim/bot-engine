import { MarketRegime, MacroRegimeEngine } from '../predator/macro';
import { NarrativeEngine } from '../narrative/engine';
import { SMCEngine } from '../predator/smc';
import { MemeRadar } from '../predator/memeRadar';
import { WhaleDetector } from '../modules/market/WhaleDetector';
import { MarketIntelligence } from '../scanner/MarketIntelligence';
import { AIResult } from '../ai/AISentinel';
import { AIWarConsensus } from './aiWar';

export interface ConsensusExecutionSignal {
  pair: string;
  action: 'EXECUTE_NOW' | 'LIMIT_ENTRY' | 'WATCH' | 'SKIP';
  confidence: number;
  marketPhase: string;
  narrativeStrength: number;
  hypeLevel: number;
  smartMoneyActive: boolean;
  volumeAcceleration: boolean;
  momentumConfirmed: boolean;
  htfConfirmed: boolean;
  spoofRisk: boolean;
  reason: string;
  urgency: 'IMMEDIATE' | 'WITHIN_HOUR' | 'PATIENT';
}

export class ConsensusExecutionLayer {
  /**
   * NO 4H CONFIRMATION POLICY
   * Missing HTF confirmation is NOT an automatic reason to reject entry.
   * Momentum often appears before HTF confirmation is formed.
   */
  public static async evaluateExecutionOpportunity(
    pair: string,
    aiResults: AIResult[],
    narrativeScores?: {
      narrativeScore: number;
      hypeLevel: number;
      volumeAcceleration: number;
      smartMoneyProbability: number;
      explosivePotential: number;
      momentumScore: number;
    }
  ): Promise<ConsensusExecutionSignal> {
    // 1. Get Market Regime
    const { regime, metrics } = await MacroRegimeEngine.getCurrentRegime();
    
    // 2. Market Phase Detection
    let marketPhase = 'NEUTRAL';
    if (regime === MarketRegime.MEME_MANIA) marketPhase = 'MEME_MANIA';
    else if (regime === MarketRegime.PREDATOR) marketPhase = 'PREDATOR';
    else if (this.isAltseasonActive(metrics)) marketPhase = 'ALTSEASON';
    else if (regime === MarketRegime.DEFENSE) marketPhase = 'DEFENSE';
    
    // 3. Parallel Analysis
    const [smc, whale, ob] = await Promise.all([
      SMCEngine.analyze(pair),
      WhaleDetector.detect(pair),
      MarketIntelligence.analyzeOrderbook(pair)
    ]);
    
    // Get meme boost
    let memeBoost = 0;
    if (MemeRadar.isMeme(pair)) {
      const radar = await MemeRadar.analyzeMemeRotation();
      memeBoost = radar.boosts[pair] || 0;
    }
    
    // 4. AI Consensus
    const consensus = AIWarConsensus.calculateConsensus(aiResults);
    
    // 5. Narrative Override Check
    let narrativeOverride = { isOverride: false, confidenceBoost: 0, reason: '' };
    if (narrativeScores) {
      narrativeOverride = AIWarConsensus.checkNarrativeExecutionOverride({
        narrativeScore: narrativeScores.narrativeScore,
        hypeLevel: narrativeScores.hypeLevel,
        volumeAcceleration: narrativeScores.volumeAcceleration,
        smartMoneyProbability: narrativeScores.smartMoneyProbability,
        explosivePotential: narrativeScores.explosivePotential,
        momentumScore: narrativeScores.momentumScore,
        technicalConfirmation: smc.smcScore
      });
    }
    
    // 6. Calculate Confidence with Narrative Priority
    let confidence = 0;
    
    // PRIORITY 1: Narrative Strength (30%)
    confidence += (narrativeScores?.narrativeScore || 50) / 100 * 30;
    
    // PRIORITY 2: Hype Level (15%)
    confidence += (narrativeScores?.hypeLevel || 50) / 100 * 15;
    
    // PRIORITY 3: Volume Acceleration (15%)
    confidence += (narrativeScores?.volumeAcceleration || 50) / 100 * 15;
    
    // PRIORITY 4: Smart Money Probability (10%)
    confidence += (narrativeScores?.smartMoneyProbability || 50) / 100 * 10;
    
    // PRIORITY 5: Explosive Potential (10%)
    confidence += (narrativeScores?.explosivePotential || 50) / 100 * 10;
    
    // PRIORITY 6: Momentum (10%)
    confidence += (narrativeScores?.momentumScore || 50) / 100 * 10;
    
    // PRIORITY 7: Technical Confirmation (10%) - REDUCED importance
    // NO 4H CONFIRMATION POLICY: Kurangi penalti untuk missing HTF setup
    if (marketPhase === 'MEME_MANIA') {
      confidence += smc.smcScore / 100 * 5; // Minimal technical weight in meme mania
    } else if (marketPhase === 'ALTSEASON' || marketPhase === 'PREDATOR') {
      confidence += smc.smcScore / 100 * 8; // Moderate technical weight
    } else {
      confidence += smc.smcScore / 100 * 10; // Normal technical weight in defense
    }
    
    // Additional factors
    if (whale.isWhaleActive) confidence += 10;
    if (memeBoost > 15) confidence += 10;
    confidence += (consensus.finalScore / 100) * 10;
    
    // Apply narrative override
    if (narrativeOverride.isOverride) {
      confidence = Math.min(100, confidence + narrativeOverride.confidenceBoost);
    }
    
    // Apply regime boost
    if (marketPhase === 'MEME_MANIA') confidence = Math.min(100, confidence + 10);
    else if (marketPhase === 'ALTSEASON') confidence = Math.min(100, confidence + 8);
    else if (marketPhase === 'PREDATOR') confidence = Math.min(100, confidence + 5);
    
    // 7. Assess Key Factors
    const narrativeStrength = narrativeScores?.narrativeScore || 50;
    const hypeLevel = narrativeScores?.hypeLevel || 50;
    const smartMoneyActive = smc.smcScore >= 40 || whale.isWhaleActive;
    const volumeAcceleration = (narrativeScores?.volumeAcceleration || 50) >= 70;
    const momentumConfirmed = smc.bos === 'BULLISH' || smc.choch === 'BULLISH';
    const htfConfirmed = smc.bos !== 'NONE' || smc.choch !== 'NONE';
    const spoofRisk = ob.hasSpoofWall && marketPhase !== 'MEME_MANIA';
    
    // 8. NO 4H CONFIRMATION POLICY CHECK
    // Missing 4H confirmation is NOT a hard block in PREDATOR/MEME_MANIA
    let missingHtfPenalty = 0;
    if (!htfConfirmed) {
      if (marketPhase === 'MEME_MANIA') {
        missingHtfPenalty = 0; // NO penalty
      } else if (marketPhase === 'ALTSEASON') {
        missingHtfPenalty = -3; // Minimal penalty
      } else if (marketPhase === 'PREDATOR') {
        missingHtfPenalty = -5; // Small penalty
      } else {
        missingHtfPenalty = -10; // Normal penalty
      }
      confidence = Math.max(0, confidence + missingHtfPenalty);
    }
    
    // 9. Execution Decision with REDUCED WATCHLIST CONTROL
    let action: 'EXECUTE_NOW' | 'LIMIT_ENTRY' | 'WATCH' | 'SKIP' = 'SKIP';
    let reason = '';
    let urgency: 'IMMEDIATE' | 'WITHIN_HOUR' | 'PATIENT' = 'PATIENT';
    
    // Dynamic thresholds based on market phase
    let executeNowThreshold = 70;
    let limitEntryThreshold = 55;
    let watchThreshold = 35;
    
    if (marketPhase === 'MEME_MANIA') {
      executeNowThreshold = 50;
      limitEntryThreshold = 40;
      watchThreshold = 25;
    } else if (marketPhase === 'ALTSEASON') {
      executeNowThreshold = 60;
      limitEntryThreshold = 45;
      watchThreshold = 30;
    } else if (marketPhase === 'PREDATOR') {
      executeNowThreshold = 65;
      limitEntryThreshold = 50;
      watchThreshold = 35;
    }
    
    // === EXECUTION LOGIC ===
    
    // Hard blocks (only in DEFENSE)
    if (spoofRisk && marketPhase === 'DEFENSE') {
      action = 'SKIP';
      reason = '🚨 Spoof Wall + DEFENSE = No Entry';
      return this.buildSignal(pair, action, confidence, marketPhase, narrativeStrength, hypeLevel, smartMoneyActive, volumeAcceleration, momentumConfirmed, htfConfirmed, spoofRisk, reason, urgency);
    }
    
    // Strong narrative execution override
    if (narrativeOverride.isOverride && narrativeStrength >= 85 && hypeLevel >= 90) {
      action = 'EXECUTE_NOW';
      reason = `🚀 NARRATIVE EXECUTION OVERRIDE: ${narrativeOverride.reason}`;
      urgency = 'IMMEDIATE';
      return this.buildSignal(pair, action, confidence, marketPhase, narrativeStrength, hypeLevel, smartMoneyActive, volumeAcceleration, momentumConfirmed, htfConfirmed, spoofRisk, reason, urgency);
    }
    
    // MEME MANIA mode: Ultra aggressive
    if (marketPhase === 'MEME_MANIA') {
      if (confidence >= executeNowThreshold) {
        action = 'EXECUTE_NOW';
        reason = `🚀 MEME MANIA: Execute before FOMO`;
        urgency = 'IMMEDIATE';
      } else if (confidence >= limitEntryThreshold) {
        action = 'LIMIT_ENTRY';
        reason = `⚡ MEME MOMENTUM: Limited entry during mania`;
        urgency = 'IMMEDIATE';
      } else if (confidence >= watchThreshold) {
        action = 'WATCH';
        reason = `👀 MEME WATCH: Score ${confidence.toFixed(0)} | ${smc.summary}`;
        urgency = 'WITHIN_HOUR';
      } else {
        action = 'SKIP';
        reason = `🚫 SKIP: Score ${confidence.toFixed(0)} < ${watchThreshold}`;
      }
      return this.buildSignal(pair, action, confidence, marketPhase, narrativeStrength, hypeLevel, smartMoneyActive, volumeAcceleration, momentumConfirmed, htfConfirmed, spoofRisk, reason, urgency);
    }
    
    // ALTSEASON mode: Aggressive on altcoins
    if (marketPhase === 'ALTSEASON') {
      if (confidence >= executeNowThreshold) {
        action = 'EXECUTE_NOW';
        reason = `📈 ALTSEASON: Strong altcoin momentum`;
        urgency = 'IMMEDIATE';
      } else if (confidence >= limitEntryThreshold) {
        action = 'LIMIT_ENTRY';
        reason = `⚡ ALTSEASON ENTRY: ${smc.summary}`;
        urgency = 'IMMEDIATE';
      } else if (confidence >= watchThreshold) {
        action = 'WATCH';
        reason = `👀 ALTSEASON WATCH: Score ${confidence.toFixed(0)}`;
        urgency = 'WITHIN_HOUR';
      } else {
        action = 'SKIP';
        reason = `🚫 SKIP: Score ${confidence.toFixed(0)} < ${watchThreshold}`;
      }
      return this.buildSignal(pair, action, confidence, marketPhase, narrativeStrength, hypeLevel, smartMoneyActive, volumeAcceleration, momentumConfirmed, htfConfirmed, spoofRisk, reason, urgency);
    }
    
    // PREDATOR mode: Moderate aggressive
    if (marketPhase === 'PREDATOR') {
      if (confidence >= executeNowThreshold) {
        action = 'EXECUTE_NOW';
        reason = `🦅 PREDATOR ELITE: High confidence setup`;
        urgency = 'IMMEDIATE';
      } else if (confidence >= limitEntryThreshold) {
        action = 'LIMIT_ENTRY';
        reason = `🎯 PREDATOR PRO: Good setup | ${smc.summary}`;
        urgency = 'WITHIN_HOUR';
      } else if (confidence >= watchThreshold) {
        action = 'WATCH';
        reason = `👀 PREDATOR WATCH: Score ${confidence.toFixed(0)}`;
        urgency = 'PATIENT';
      } else {
        action = 'SKIP';
        reason = `🚫 SKIP: Score ${confidence.toFixed(0)} < ${watchThreshold}`;
      }
      return this.buildSignal(pair, action, confidence, marketPhase, narrativeStrength, hypeLevel, smartMoneyActive, volumeAcceleration, momentumConfirmed, htfConfirmed, spoofRisk, reason, urgency);
    }
    
    // DEFENSE mode: Conservative but not paralyzed
    if (marketPhase === 'DEFENSE') {
      if (confidence >= executeNowThreshold && htfConfirmed) {
        action = 'EXECUTE_NOW';
        reason = `🛡️ DEFENSE ELITE: Full confirmation | ${smc.summary}`;
        urgency = 'WITHIN_HOUR';
      } else if (confidence >= limitEntryThreshold) {
        action = 'LIMIT_ENTRY';
        reason = `🎯 DEFENSE PRO: Limited exposure | ${smc.summary}`;
        urgency = 'PATIENT';
      } else if (confidence >= watchThreshold) {
        action = 'WATCH';
        reason = `👀 DEFENSE WATCH: Score ${confidence.toFixed(0)}`;
        urgency = 'PATIENT';
      } else {
        action = 'SKIP';
        reason = `🚫 DEFENSE SKIP: Score ${confidence.toFixed(0)} < ${watchThreshold}`;
      }
      return this.buildSignal(pair, action, confidence, marketPhase, narrativeStrength, hypeLevel, smartMoneyActive, volumeAcceleration, momentumConfirmed, htfConfirmed, spoofRisk, reason, urgency);
    }
    
    // Default: NEUTRAL market
    if (confidence >= executeNowThreshold) {
      action = 'EXECUTE_NOW';
      reason = `📊 NEUTRAL ELITE: Score ${confidence.toFixed(0)}`;
      urgency = 'WITHIN_HOUR';
    } else if (confidence >= limitEntryThreshold) {
      action = 'LIMIT_ENTRY';
      reason = `🎯 NEUTRAL PRO: Score ${confidence.toFixed(0)}`;
      urgency = 'PATIENT';
    } else if (confidence >= watchThreshold) {
      action = 'WATCH';
      reason = `👀 NEUTRAL WATCH: Score ${confidence.toFixed(0)}`;
      urgency = 'PATIENT';
    } else {
      action = 'SKIP';
      reason = `🚫 SKIP: Score ${confidence.toFixed(0)} < ${watchThreshold}`;
    }
    
    return this.buildSignal(pair, action, confidence, marketPhase, narrativeStrength, hypeLevel, smartMoneyActive, volumeAcceleration, momentumConfirmed, htfConfirmed, spoofRisk, reason, urgency);
  }
  
  private static isAltseasonActive(metrics: any): boolean {
    return metrics.altcoinVolume > 1.8 && metrics.btcDominance < 50;
  }
  
  private static buildSignal(
    pair: string,
    action: 'EXECUTE_NOW' | 'LIMIT_ENTRY' | 'WATCH' | 'SKIP',
    confidence: number,
    marketPhase: string,
    narrativeStrength: number,
    hypeLevel: number,
    smartMoneyActive: boolean,
    volumeAcceleration: boolean,
    momentumConfirmed: boolean,
    htfConfirmed: boolean,
    spoofRisk: boolean,
    reason: string,
    urgency: 'IMMEDIATE' | 'WITHIN_HOUR' | 'PATIENT'
  ): ConsensusExecutionSignal {
    return {
      pair,
      action,
      confidence: Math.min(100, Math.max(0, confidence)),
      marketPhase,
      narrativeStrength,
      hypeLevel,
      smartMoneyActive,
      volumeAcceleration,
      momentumConfirmed,
      htfConfirmed,
      spoofRisk,
      reason,
      urgency
    };
  }
}
