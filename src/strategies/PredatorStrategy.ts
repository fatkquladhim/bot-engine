import { MarketRegime, MacroRegimeEngine } from '../predator/macro';
import { DynamicScanner } from '../predator/scanner';
import { SMCEngine } from '../predator/smc';
import { MemeRadar } from '../predator/memeRadar';
import { AIWarConsensus, ConsensusInput } from '../predator/aiWar';
import { SniperEntry } from '../predator/sniper';
import { ExitManager2 } from '../predator/exit2';
import { EmergencyShield } from '../predator/shield';
import { AIResult } from '../ai/AISentinel';
import { NarrativeEngine } from '../narrative/engine';
import { WhaleDetector } from '../modules/market/WhaleDetector';
import { MarketIntelligence } from '../scanner/MarketIntelligence';
import { ProbabilityEngine } from '../modules/ai/ProbabilityEngine';
import { NarrativeMapper, NarrativeType } from '../narrative/mapper';

export interface TradingDecision {
  shouldBuy: boolean;
  action: 'MARKET_BUY' | 'LIMIT_ENTRY' | 'SNIPER_WATCHLIST' | 'SKIP';
  reason: string;
  score: number;
  targets?: { sl: number; tp1: number; tp2: number; tp3: number };
  sizeMultiplier?: number;
  consensusOverride?: { isOverride: boolean; confidenceBoost: number; reason: string };
  marketPhase?: string;
}

export class PredatorStrategy {
  /**
   * CONSENSUS EXECUTION LAYER - PREDATOR MODE
   * Enhanced brain for aggressive narrative-driven trading
   */
  public async evaluateTrade(
    pair: string, 
    aiResults: AIResult[], 
    alphaHunterScore: number = 0,
    narrativeScores?: {
      narrativeScore: number;
      hypeLevel: number;
      volumeAcceleration: number;
      smartMoneyProbability: number;
      explosivePotential: number;
      momentumScore: number;
    }
  ): Promise<TradingDecision> {
    // 1. Emergency Check (BENTENG PERTAHANAN)
    const emergency = await EmergencyShield.checkGlobalEmergency();
    if (emergency.isEmergency) {
      return { 
        shouldBuy: false, 
        action: 'SKIP', 
        reason: emergency.reason || 'Global Emergency', 
        score: 0 
      };
    }

    // 2. Macro Regime Detection
    const { regime, metrics } = await MacroRegimeEngine.getCurrentRegime();
    
    // 3. AI Consensus with Narrative Override
    let consensus = await AIWarConsensus.calculateConsensus(aiResults);
    let narrativeOverride = { isOverride: false, confidenceBoost: 0, reason: '' };
    
    if (narrativeScores) {
      const narrativeInput: ConsensusInput = {
        narrativeScore: narrativeScores.narrativeScore,
        hypeLevel: narrativeScores.hypeLevel,
        volumeAcceleration: narrativeScores.volumeAcceleration,
        smartMoneyProbability: narrativeScores.smartMoneyProbability,
        explosivePotential: narrativeScores.explosivePotential,
        momentumScore: narrativeScores.momentumScore,
        technicalConfirmation: 0
      };
      
      narrativeOverride = AIWarConsensus.checkNarrativeExecutionOverride(narrativeInput);
      
      if (narrativeOverride.isOverride) {
        consensus.finalScore = Math.min(100, consensus.finalScore + narrativeOverride.confidenceBoost);
        if (consensus.action === 'WATCHLIST' || consensus.action === 'WAIT') {
          consensus.action = 'BUY';
        }
      }
    }
    
    // 4. Technical Analysis (SMC + Sniper)
    const [smc, sniper] = await Promise.all([
      SMCEngine.analyze(pair),
      SniperEntry.scan(pair)
    ]);
    
    // 5. Narrative, Whale, dan Orderbook Microstructure
    const [narrativeScore, whale, ob] = await Promise.all([
      NarrativeEngine.getNarrativeScore(pair),
      WhaleDetector.detect(pair),
      MarketIntelligence.analyzeOrderbook(pair)
    ]);

    // EXECUTION GUARD: Jika ada absorption atau spoof, skip entry
    // Tapi TIDAK untuk MEME_MANIA (meme bisa pump through spoof)
    if (ob.isAbsorbing && ob.hasSpoofWall && regime !== MarketRegime.MEME_MANIA) {
      return { 
        shouldBuy: false, 
        action: 'SKIP', 
        reason: `🚨 Market Manipulation: Absorption + Spoof Wall terdeteksi`, 
        score: 0 
      };
    }
    
    // Soft warning untuk spoof (tidak hard skip di PREDATOR/MEME_MANIA)
    const hasSpoofWarning = ob.hasSpoofWall;

    // 6. Meme Boost & Market Phase Detection
    let memeBoost = 0;
    let marketPhase = 'NEUTRAL';
    if (MemeRadar.isMeme(pair)) {
      const radar = await MemeRadar.analyzeMemeRotation();
      memeBoost = radar.boosts[pair] || 0;
    }
    
    // Determine market phase
    if (regime === MarketRegime.MEME_MANIA) {
      marketPhase = 'MEME_MANIA';
    } else if (regime === MarketRegime.PREDATOR) {
      marketPhase = 'PREDATOR_BULL';
    } else if (metrics.altcoinVolume > 1.8 && metrics.btcDominance < 50) {
      marketPhase = 'ALTSEASON';
    } else if (regime === MarketRegime.DEFENSE) {
      marketPhase = 'DEFENSE';
    }

    // 7. CONSENSUS PRIORITY ORDER - Narrative First
    const SMC_MAX = 80;
    let confidenceScore = 0;
    
    // PRIORITY 1: Narrative Strength (30% weight)
    confidenceScore += (narrativeScore / 100) * 30;
    
    // PRIORITY 2: Hype Level (15% weight)
    if (narrativeScores?.hypeLevel) {
      confidenceScore += (narrativeScores.hypeLevel / 100) * 15;
    } else {
      confidenceScore += (narrativeScore / 100) * 10;
    }
    
    // PRIORITY 3: Volume Acceleration (15% weight)
    if (narrativeScores?.volumeAcceleration) {
      confidenceScore += (narrativeScores.volumeAcceleration / 100) * 15;
    }
    
    // PRIORITY 4: Smart Money Probability (10% weight)
    confidenceScore += (Math.min(smc.smcScore, SMC_MAX) / SMC_MAX) * 10;
    
    // PRIORITY 5: Explosive Potential (10% weight)
    if (narrativeScores?.explosivePotential) {
      confidenceScore += (narrativeScores.explosivePotential / 100) * 10;
    }
    
    // PRIORITY 6: Momentum (5% weight)
    confidenceScore += (narrativeScores?.momentumScore || 50) / 100 * 5;
    
    // PRIORITY 7: Technical Confirmation (5% weight)
    confidenceScore += (sniper.confidence / 100) * 5;
    
    // Additional factors
    confidenceScore += (whale.isWhaleActive ? 10 : 0);
    confidenceScore += (alphaHunterScore / 100) * 10;
    confidenceScore += (ob.obScore / 20) * 5;
    
    if (marketPhase === 'MEME_MANIA') {
      confidenceScore += Math.min(memeBoost, 15);
    } else {
      confidenceScore += Math.min(memeBoost, 8);
    }
    
    if (alphaHunterScore > 60) confidenceScore += 8;
    if (narrativeOverride.isOverride) {
      confidenceScore = Math.min(100, confidenceScore + narrativeOverride.confidenceBoost);
    }

    let finalScore = Math.min(100, confidenceScore);
    
    if (marketPhase === 'MEME_MANIA') {
      finalScore = Math.min(100, finalScore + 10);
    } else if (marketPhase === 'ALTSEASON') {
      finalScore = Math.min(100, finalScore + 8);
    } else if (marketPhase === 'PREDATOR_BULL') {
      finalScore = Math.min(100, finalScore + 5);
    }
    
    if (smc.bos === 'NONE' && smc.choch === 'NONE') {
      if (marketPhase === 'DEFENSE') {
        finalScore = Math.max(0, finalScore - 5);
      }
    }

    // 8. TIERED EXECUTION ENGINE
    const entryPrice = sniper.entryPrice || aiResults[0]?.precise_entry || 0;
    let resolvedEntry = entryPrice;
    if (!resolvedEntry || resolvedEntry <= 0) {
      try {
        const { IndodaxPublicAPI } = require('../core/IndodaxPublicAPI');
        const ticker = await IndodaxPublicAPI.getTicker(pair);
        resolvedEntry = parseFloat(ticker.ticker.last);
      } catch { resolvedEntry = 0; }
    }
    
    const plan = ExitManager2.calculateInitialPlan(resolvedEntry);

    // 7.5 Sector-Specific Risk Profiling (The "May Meta" 2026)
    const sector = NarrativeMapper.getNarrativeForPair(pair);
    const riskProfile = NarrativeMapper.getRiskProfile(sector);
    
    if (plan && resolvedEntry > 0) {
      const currentSLPct = (Math.abs(resolvedEntry - plan.sl) / resolvedEntry);
      const newSLPct = currentSLPct * riskProfile.slMult;
      plan.sl = resolvedEntry * (1 - newSLPct);
      
      plan.tp1 = resolvedEntry + (plan.tp1 - resolvedEntry) * riskProfile.tpMult;
      plan.tp2 = resolvedEntry + (plan.tp2 - resolvedEntry) * riskProfile.tpMult;
      plan.tp3 = resolvedEntry + (plan.tp3 - resolvedEntry) * riskProfile.tpMult;
    }

    let marketBuyThreshold = 60;
    let limitEntryThreshold = 45;
    let scoutEntryThreshold = 35;

    if (marketPhase === 'MEME_MANIA') {
      marketBuyThreshold = 50;
      limitEntryThreshold = 40;
      scoutEntryThreshold = 30;
    } else if (marketPhase === 'ALTSEASON') {
      marketBuyThreshold = 55;
      limitEntryThreshold = 40;
      scoutEntryThreshold = 30;
    } else if (marketPhase === 'PREDATOR_BULL') {
      marketBuyThreshold = 58;
      limitEntryThreshold = 43;
      scoutEntryThreshold = 33;
    }

    // Adjust thresholds based on sector confidence requirements
    marketBuyThreshold = Math.max(marketBuyThreshold, riskProfile.confidenceReq - 10);
    limitEntryThreshold = Math.max(limitEntryThreshold, riskProfile.confidenceReq - 20);

    // === EXECUTION DECISION ===
    if (finalScore >= marketBuyThreshold) {
      return {
        shouldBuy: true,
        action: 'MARKET_BUY',
        reason: `🦅 ELITE (100%): ${narrativeOverride.isOverride ? narrativeOverride.reason : marketPhase} | Sector: ${sector} | ${smc.summary}`,
        score: finalScore,
        targets: plan,
        sizeMultiplier: 1.0,
        consensusOverride: narrativeOverride,
        marketPhase
      };
    }

    if (finalScore >= limitEntryThreshold) {
      return {
        shouldBuy: true,
        action: 'LIMIT_ENTRY',
        reason: `🎯 PRO (50%): ${marketPhase} | Sector: ${sector} | ${smc.summary}`,
        score: finalScore,
        targets: plan,
        sizeMultiplier: 0.5,
        consensusOverride: narrativeOverride,
        marketPhase
      };
    }

    if (finalScore >= scoutEntryThreshold && 
        (marketPhase === 'MEME_MANIA' || marketPhase === 'ALTSEASON' || narrativeScore >= 70) && 
        smc.premiumDiscount === 'DISCOUNT') {
      return {
        shouldBuy: true,
        action: 'LIMIT_ENTRY',
        reason: `🔭 SCOUT (25%): ${sector} Accumulation | ${smc.summary}`,
        score: finalScore,
        targets: plan,
        sizeMultiplier: 0.25,
        consensusOverride: narrativeOverride,
        marketPhase
      };
    }

    if (finalScore >= 25) {
      return { 
        shouldBuy: false, 
        action: 'SNIPER_WATCHLIST',
        reason: `👀 WATCH: ${sector} | Score ${finalScore.toFixed(0)}`, 
        score: finalScore,
        consensusOverride: narrativeOverride,
        marketPhase
      };
    }

    return { 
      shouldBuy: false, 
      action: 'SKIP',
      reason: `🚫 SKIP: ${sector} | Score ${finalScore.toFixed(0)} < 25`, 
      score: finalScore,
      consensusOverride: narrativeOverride,
      marketPhase
    };
  }
}
