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
    
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const variance = maxScore - minScore;
    const isManipulated = variance > 40;

    // 3-model voting: hitung berapa yang BUY
    const buyVotes = results.filter(r => r.action === 'BUY').length;
    const totalVotes = results.length;

    let action: 'BUY' | 'WATCHLIST' | 'WAIT' | 'AVOID' = 'AVOID';
    
    if (buyVotes >= 2 && avgScore >= 75) action = 'BUY';           // 2/3 atau 3/3 setuju + score tinggi
    else if (buyVotes >= 2 && avgScore >= 55) action = 'WATCHLIST'; // 2/3 setuju tapi score sedang
    else if (buyVotes >= 1 && avgScore >= 45) action = 'WAIT';      // 1/3 setuju
    else action = 'AVOID';

    if (isManipulated) action = 'WAIT';

    return {
      finalScore: Math.round(avgScore),
      action,
      isManipulated,
      summary: `Avg: ${avgScore.toFixed(0)} | Votes: ${buyVotes}/${totalVotes} BUY | Var: ${variance} | ${isManipulated ? '⚠️ DIVERGE' : '✅ OK'}`
    };
  }
}
