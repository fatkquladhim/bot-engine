import { AIResult } from '../../ai/AISentinel';

export class ProbabilityEngine {
  /**
   * Calculates the probability of success based on AI consensus, variance, and confidence levels.
   */
  public static calculate(signals: AIResult[]): number {
    if (signals.length === 0) return 0;

    const avgScore = signals.reduce((sum, s) => sum + (s.score || 0), 0) / signals.length;
    
    // Variance Penalty: If AI agents disagree significantly, probability drops.
    const scores = signals.map(s => s.score || 0);
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    const variance = max - min;

    let probability = avgScore;
    
    if (variance > 20) probability -= 10;
    if (variance > 40) probability -= 25;

    // Weight by action agreement
    const buySignals = signals.filter(s => s.action === 'BUY').length;
    const agreementFactor = buySignals / signals.length;

    probability = probability * agreementFactor;

    return Math.min(100, Math.max(0, probability));
  }
}
