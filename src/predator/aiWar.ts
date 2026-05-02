import { AIResult } from '../ai/AISentinel';

export class AIWarConsensus {
  /**
   * Mengintegrasikan sinyal dari beberapa agen AI.
   * Logic: Weighted Average + Manipulation Warning (Variance Check)
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
    
    // Variance check for manipulation detection
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const variance = maxScore - minScore;
    const isManipulated = variance > 40; // Jika beda > 40 poin antara agen

    let action: 'BUY' | 'WATCHLIST' | 'WAIT' | 'AVOID' = 'AVOID';
    
    if (avgScore > 72) action = 'BUY';
    else if (avgScore >= 60) action = 'WATCHLIST';
    else if (avgScore >= 45) action = 'WAIT';
    else action = 'AVOID';

    if (isManipulated) {
      action = 'WAIT'; // Turunkan prioritas jika agen tidak sepakat jauh
    }

    return {
      finalScore: Math.round(avgScore),
      action,
      isManipulated,
      summary: `Avg: ${avgScore.toFixed(0)} | Var: ${variance} | ${isManipulated ? '⚠️ FAKE MOVE ALERT' : '✅ CONSENSUS OK'}`
    };
  }
}
