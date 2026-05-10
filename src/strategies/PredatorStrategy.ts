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
    let consensus = AIWarConsensus.calculateConsensus(aiResults);
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
    // smcScore max = 80 (20+15+25+10+10), bukan 100
    const SMC_MAX = 80;
    let confidenceScore = 0;
    
    // PRIORITY 1: Narrative Strength (30% weight - INCREASED)
    confidenceScore += (narrativeScore / 100) * 30;
    
    // PRIORITY 2: Hype Level (15% weight)
    if (narrativeScores?.hypeLevel) {
      confidenceScore += (narrativeScores.hypeLevel / 100) * 15;
    } else {
      confidenceScore += (narrativeScore / 100) * 10; // Fallback
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
    
    // PRIORITY 7: Technical Confirmation (5% weight - REDUCED)
    confidenceScore += (sniper.confidence / 100) * 5;
    
    // Additional factors
    confidenceScore += (whale.isWhaleActive ? 10 : 0);      // Whale: 10%
    confidenceScore += (alphaHunterScore / 100) * 10;       // AlphaHunter: 10%
    confidenceScore += (ob.obScore / 20) * 5;              // OB Score: 5%
    
    // Meme Boost for MEME_MANIA
    if (marketPhase === 'MEME_MANIA') {
      confidenceScore += Math.min(memeBoost, 15); // Up to +15 for memes in mania
    } else {
      confidenceScore += Math.min(memeBoost, 8); // Normal +8
    }
    
    // BONUS: AlphaHunter kandidat
    if (alphaHunterScore > 60) confidenceScore += 8;
    
    // Apply narrative override boost
    if (narrativeOverride.isOverride) {
      confidenceScore = Math.min(100, confidenceScore + narrativeOverride.confidenceBoost);
    }

    let finalScore = Math.min(100, confidenceScore);
    
    // === REGIME BIAS: Adjust berdasarkan market phase ===
    
    // MEME_MANIA: Ultra aggressive
    if (marketPhase === 'MEME_MANIA') {
      finalScore = Math.min(100, finalScore + 10); // +10 boost for meme mania
    }
    // ALTSEASON: Aggressive
    else if (marketPhase === 'ALTSEASON') {
      finalScore = Math.min(100, finalScore + 8);
    }
    // PREDATOR BULL: Moderate aggressive
    else if (marketPhase === 'PREDATOR_BULL') {
      finalScore = Math.min(100, finalScore + 5);
    }
    // DEFENSE: Keep baseline (no extra boost)
    
    // NO 4H CONFIRMATION POLICY
    // Kurangi penalti untuk missing HTF setup
    if (smc.bos === 'NONE' && smc.choch === 'NONE') {
      // Missing confirmation = tidak langsung reject
      // Tapi tetap kurangi score sedikit di DEFENSE
      if (marketPhase === 'DEFENSE') {
        finalScore = Math.max(0, finalScore - 5);
      }
    }

    // 8. TIERED EXECUTION ENGINE - Aggressive Thresholds
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

    // Dynamic thresholds berdasarkan market phase
    let marketBuyThreshold = 60;   // Lowered from 65
    let limitEntryThreshold = 45;  // Lowered from 55
    let scoutEntryThreshold = 35;   // Lowered from 45

    // MEME_MANIA: Even more aggressive thresholds
    if (marketPhase === 'MEME_MANIA') {
      marketBuyThreshold = 50;
      limitEntryThreshold = 40;
      scoutEntryThreshold = 30;
    }
    // ALTSEASON: Aggressive thresholds
    else if (marketPhase === 'ALTSEASON') {
      marketBuyThreshold = 55;
      limitEntryThreshold = 40;
      scoutEntryThreshold = 30;
    }
    // PREDATOR BULL: Moderate aggressive
    else if (marketPhase === 'PREDATOR_BULL') {
      marketBuyThreshold = 58;
      limitEntryThreshold = 43;
      scoutEntryThreshold = 33;
    }

    // === EXECUTION DECISION ===
    
    if (finalScore >= marketBuyThreshold) {
      return {
        shouldBuy: true,
        action: 'MARKET_BUY',
        reason: `🦅 ELITE (100%): ${narrativeOverride.isOverride ? narrativeOverride.reason : marketPhase} | ${smc.summary}`,
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
        reason: `🎯 PRO (50%): ${marketPhase} | ${smc.summary}`,
        score: finalScore,
        targets: plan,
        sizeMultiplier: 0.5,
        consensusOverride: narrativeOverride,
        marketPhase
      };
    }

    // SCOUT ENTRY: khusus accumulation phase dengan narrative kuat
    if (finalScore >= scoutEntryThreshold && 
        (marketPhase === 'MEME_MANIA' || marketPhase === 'ALTSEASON' || narrativeScore >= 70) && 
        smc.premiumDiscount === 'DISCOUNT') {
      return {
        shouldBuy: true,
        action: 'LIMIT_ENTRY',
        reason: `🔭 SCOUT (25%): Accumulation + ${marketPhase} | ${smc.summary}`,
        score: finalScore,
        targets: plan,
        sizeMultiplier: 0.25,
        consensusOverride: narrativeOverride,
        marketPhase
      };
    }

    // === REDUCED WATCHLIST CONTROL ===
    // WATCHLIST hanya jika benar-benar lemah
    if (finalScore >= 25) {
      return { 
        shouldBuy: false, 
        action: 'SNIPER_WATCHLIST',
        reason: `👀 WATCH: ${marketPhase} | Score ${finalScore.toFixed(0)} | ${smc.summary}`, 
        score: finalScore,
        consensusOverride: narrativeOverride,
        marketPhase
      };
    }

    return { 
      shouldBuy: false, 
      action: 'SKIP',
      reason: `🚫 SKIP: ${marketPhase} | Score ${finalScore.toFixed(0)} < 25`, 
      score: finalScore,
      consensusOverride: narrativeOverride,
      marketPhase
    };
  }
}
