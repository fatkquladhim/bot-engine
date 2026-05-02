import { NarrativeType } from './mapper';
import { NarrativeInsight } from './hotScanner';

export class NextWeekPredictor {
  /**
   * Prediksi narasi minggu depan berdasarkan market fatigue dan rotasi modal.
   */
  public static predict(currentInsights: NarrativeInsight[]): NarrativeInsight[] {
    const predictions: NarrativeInsight[] = [];
    
    // Logic: Jika sebuah narasi sedang HOT (score > 85), narasi lain yang berkorelasi 
    // atau narasi yang sedang COOLING di harga bawah akan diprediksi sebagai REBOUND.
    
    for (const insight of currentInsights) {
      let predictedScore = insight.score;
      let predictedMomentum = insight.momentum;

      if (insight.score > 85) {
        // Overheated: kemungkinan minggu depan cooling down
        predictedScore -= 10;
        predictedMomentum = 'COOLING';
      } else if (insight.score < 40) {
        // Bottom: kemungkinan minggu depan rebound
        predictedScore += 15;
        predictedMomentum = 'RISING';
      } else {
        // Trending: kemungkinan berlanjut
        predictedScore += 5;
      }

      predictions.push({
        ...insight,
        score: Math.min(100, Math.max(0, predictedScore)),
        momentum: predictedMomentum
      });
    }

    return predictions.sort((a, b) => b.score - a.score);
  }
}
