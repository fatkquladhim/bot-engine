import axios from "axios";
import { IndodaxPublicAPI } from "../core/IndodaxPublicAPI";
import { TradingEngine } from "../engine/TradingEngine";
import { MarketIntelligence } from "../scanner/MarketIntelligence";
import { AIWarConsensus } from "../predator/aiWar";
import { PredatorStrategy } from "../strategies/PredatorStrategy";
import { MacroRegimeEngine } from "../predator/macro";
import { CompoundingEngine } from "../engine/Compounding";

export type AIResult = {
  pair: string;
  is_held: boolean;
  regime: string;
  structure: string;
  volume_status: string;
  momentum: string;
  liquidity: string;
  risk_assessment: string;
  support: number;
  resistance: number;
  precise_entry: number | null;
  precise_sl: number | null;
  precise_tp: number | null;
  action: string;
  score: number;
  confidence: string;
  edge_strength: "Weak" | "Good" | "Elite";
  why_now: string;
};

export class AISentinel {
  private isEnabled = false;
  private interval: NodeJS.Timeout | null = null;
  private targetPairs: string[];
  private engine: TradingEngine;
  private predatorStrategy: PredatorStrategy;
  private compounding: CompoundingEngine;
  private sumopodKey: string;
  private sumopodBaseUrl: string;
  private freeModels: string[] = [];
  private fallbackModels: string[] = [];
  private currentModelIndex = 0;
  private currentFallbackIndex = 0;
  public alphaScores: Record<string, number> = {};

  constructor(engine: TradingEngine, targetPairs: string[] = ["btc_idr", "eth_idr"]) {
    this.engine = engine;
    this.targetPairs = targetPairs;
    this.predatorStrategy = new PredatorStrategy();
    this.compounding = new CompoundingEngine();
    this.sumopodKey = process.env.SUMOPOD_API_KEY || "";
    this.sumopodBaseUrl = process.env.SUMOPOD_BASE_URL || "https://ai.sumopod.com/v1";

    // 2026-05-12 Update: Optimized Trio for Performance & Cost
    this.freeModels = ["gemini/gemini-2.0-flash-lite", "qwen/qwen3-30b-a3b-instruct-2507"];
    this.fallbackModels = ["glm-5-turbo", "deepseek-v4-flash", "MiniMax-M2.7-highspeed"];

    if (this.sumopodKey) {
      this.isEnabled = true;
      console.log(`🚀 [ALPHA OMEGA] AI Council Engine Aktif (Collaborative)`);
      console.log(`   - Tier 1 (Hunter): gemini/gemini-2.0-flash-lite`);
      console.log(`   - Tier 2 (Critic): deepseek-v4-flash`);
      console.log(`   - Tier 3 (Judge) : glm-5-turbo`);
    } else {
      console.error("❌ [CRITICAL] SUMOPOD_API_KEY tidak ditemukan!");
    }
  }

  public start(intervalMs: number = 600000) {
    if (!this.isEnabled) return;
    this.analyzeMarket();
    this.interval = setInterval(() => this.analyzeMarket(), intervalMs);
  }

  public stop() {
    if (this.interval) clearInterval(this.interval);
  }

  public async analyzePair(pair: string): Promise<AIResult | null> {
    try {
      const isHeld = !!this.engine.state.openPositions[pair];
      const marketData = await this.buildMarketDataForPair(pair);
      for (const model of [...this.fallbackModels, ...this.freeModels]) {
        try {
          const raw = await this.callSumopodAI(marketData, isHeld, pair, model);
          const result = this.parseAI(raw, model);
          if (result) { result.pair = pair; return result; }
        } catch { continue; }
      }
      return null;
    } catch { return null; }
  }

  public async analyzeMarket(): Promise<AIResult[]> {
    const { regime } = await MacroRegimeEngine.getCurrentRegime();
    const maxPairs = regime === 'DEFENSE' ? 3 : regime === 'PREDATOR' ? 5 : 4;
    const pairsToAnalyze = this.targetPairs.slice(0, maxPairs);
    console.log(`\n🦅 [PREDATOR MODE] ON | Regime: ${regime} | Target Count: ${pairsToAnalyze.length}`);

    const results: AIResult[] = [];
    const settled: (AIResult | null)[] = [];
    for (const [index, pair] of pairsToAnalyze.entries()) {
      try {
        await new Promise(r => setTimeout(r, index * 3000));
        const result = await this.analyzePairSequential(pair);
        if (result) settled.push(result);
      } catch (e: any) {
        console.error(`   ❌ Error menganalisa ${pair}:`, e.message);
        settled.push(null);
      }
    }
    for (const res of settled) { if (res) results.push(res); }
    return results;
  }

  private async analyzePairSequential(pair: string): Promise<AIResult | null> {
    const withTimeout = (p: Promise<any>, ms: number) =>
      Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('TIMEOUT')), ms))]);

    const isHeld = !!this.engine.state.openPositions[pair];
    const marketData = await this.buildMarketDataForPair(pair);
    console.log(`   🤝 [CONSENSUS] Fetching signals for ${pair.toUpperCase()}...`);

    // Tier 1: THE HUNTER (Gemini-Lite - Scanner)
    const modelHunter = "gemini/gemini-2.0-flash-lite";
    const rawA = await withTimeout(this.callSumopodAI(marketData, isHeld, pair, modelHunter, 'hunter'), 60000).catch(() => "");
    const resA = this.parseAI(rawA as string, modelHunter);

    // Tier 2: THE CRITIC (DeepSeek-V4 - Risk Analyst)
    // Evaluasi Hunter Thesis
    const auditData = `${marketData}\n\n[HUNTER THESIS]: ${rawA}`;
    const modelCritic = "deepseek-v4-flash";
    const rawB = rawA ? await withTimeout(this.callSumopodAI(auditData, isHeld, pair, modelCritic, 'critic'), 60000).catch(() => "") : "";
    const resB = this.parseAI(rawB as string, modelCritic);

    // Tier 3: THE JUDGE (GLM-5-Turbo - Final Decision)
    // Evaluasi Hunter vs Critic
    const judgeData = `${marketData}\n\n[HUNTER]: ${rawA}\n\n[CRITIC]: ${rawB}`;
    const modelJudge = "glm-5-turbo";
    const rawC = (rawA || rawB) ? await withTimeout(this.callSumopodAI(judgeData, isHeld, pair, modelJudge, 'judge'), 60000).catch(() => "") : "";
    const resC = this.parseAI(rawC as string, modelJudge);

    const aiSignals = [resA, resB, resC].filter(Boolean) as AIResult[];

    if (aiSignals.length === 0) {
      console.log(`   ⚠️ [COUNCIL] ${pair.toUpperCase()}: Semua model gagal. Skip.`);
      return null;
    }

    const buyVotes = aiSignals.filter(s => s.action === 'BUY').length;
    const avgScore = aiSignals.reduce((s, r) => s + r.score, 0) / aiSignals.length;
    console.log(`   ✅ [COUNCIL] ${pair.toUpperCase()}: ${aiSignals.length}/3 | BUY: ${buyVotes} | Avg: ${avgScore.toFixed(0)}`);

    const evaluation = await this.predatorStrategy.evaluateTrade(pair, aiSignals, this.alphaScores[pair] || 0, {
      narrativeScore: this.alphaScores[pair] ? await this.getAlphaHunterNarrativeScore(pair) : 50,
      hypeLevel: 50,
      volumeAcceleration: this.alphaScores[pair] ? (this.alphaScores[pair] > 70 ? 80 : 50) : 50,
      smartMoneyProbability: 50,
      explosivePotential: this.alphaScores[pair] || 50,
      momentumScore: 50
    });

    const sep = '━'.repeat(52);
    const bias = (await MarketIntelligence.analyzeTrend(pair)).alignment;
    console.log(`\n🦅 ${pair.toUpperCase()}`);
    console.log(`   ${sep}`);
    console.log(`   Bias  : ${bias.padEnd(41)}`);
    console.log(`   Tier  : ${evaluation.action.padEnd(41)}`);
    console.log(`   Score : ${evaluation.score.toFixed(1).padEnd(41)}`);

    if (evaluation.shouldBuy && evaluation.targets) {
      const t = evaluation.targets;
      const entry = (aiSignals[0]?.precise_entry && aiSignals[0].precise_entry > 0)
        ? aiSignals[0].precise_entry
        : parseFloat((await IndodaxPublicAPI.getTicker(pair)).ticker.last);

      const MIDCAP_PAIRS = ['btc_idr','eth_idr','sol_idr','bnb_idr','xrp_idr','ada_idr',
        'avax_idr','dot_idr','matic_idr','link_idr','uni_idr','atom_idr',
        'near_idr','op_idr','arb_idr','sui_idr','apt_idr','hype_idr'];
      const isLowCap = !MIDCAP_PAIRS.includes(pair);
      const slDistPct = entry > 0 && t.sl > 0 ? Math.abs((entry - t.sl) / entry) * 100 : 5;
      const totalCapital = await this.engine.calculateTotalEquity();
      const baseSize = this.compounding.getOptimalPositionSize(
        totalCapital, isLowCap, evaluation.score, 2, slDistPct, this.engine.state.recentResults
      );
      const amountIdr = Math.floor(baseSize * (evaluation.sizeMultiplier || 1.0));

      console.log(`   Entry : ${Math.round(entry).toLocaleString().padEnd(41)}`);
      console.log(`   SL    : ${Math.round(t.sl).toLocaleString().padEnd(41)}`);
      console.log(`   TP1   : ${Math.round(t.tp1).toLocaleString().padEnd(41)}`);
      console.log(`   Size  : Rp ${amountIdr.toLocaleString()} (dieksekusi via cli)`.padEnd(42));
      console.log(`   Status: 💥 ${evaluation.action} — EXECUTING...`.padEnd(42));
    } else {
      console.log(`   Status: ⚖️ ${evaluation.action} — ${evaluation.reason.substring(0, 30)}`);
    }
    console.log(`   ${sep}`);

    if (evaluation.shouldBuy) {
      const finalRes = aiSignals[0] || {} as AIResult;
      finalRes.score = evaluation.score;
      finalRes.pair = pair;
      finalRes.action = evaluation.action === 'MARKET_BUY' ? 'BUY' :
                        evaluation.action === 'LIMIT_ENTRY' ? 'BUY' :
                        evaluation.action;
      finalRes.confidence = evaluation.score >= 70 ? 'HIGH' :
                           evaluation.score >= 50 ? 'MID' : 'LOW';
      finalRes.edge_strength = evaluation.score >= 80 ? 'Elite' :
                              evaluation.score >= 60 ? 'Good' : 'Weak';
      finalRes.why_now = evaluation.reason;
      finalRes.precise_entry = evaluation.targets?.sl ?
        parseFloat((await IndodaxPublicAPI.getTicker(pair)).ticker.last) :
        (finalRes.precise_entry || parseFloat((await IndodaxPublicAPI.getTicker(pair)).ticker.last));
      if (evaluation.targets) {
        finalRes.precise_sl = evaluation.targets.sl;
        finalRes.precise_tp = evaluation.targets.tp1;
      }
      return finalRes;
    }
    return null;
  }

  private rotateFreeModel() {
    this.currentModelIndex = (this.currentModelIndex + 1) % this.freeModels.length;
  }

  private rotateFallbackModel() {
    this.currentFallbackIndex = (this.currentFallbackIndex + 1) % this.fallbackModels.length;
  }

  private async callSumopodAI(
    marketData: string, isHeld: boolean, pair: string,
    model: string, role: 'hunter' | 'critic' | 'judge' = 'hunter'
  ): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await axios.post(
          `${this.sumopodBaseUrl}/chat/completions`,
          { model, messages: [{ role: "user", content: this.buildPrompt(marketData, isHeld, pair, role) }], temperature: 0.2 },
          { headers: { 'Authorization': `Bearer ${this.sumopodKey}` }, timeout: 30000 }
        );
        return res.data.choices?.[0]?.message?.content || "";
      } catch (e: any) {
        const status = e?.response?.status;

        if (status === 429) {
          const retryAfter = parseInt(e?.response?.headers?.['retry-after'] || '30');
          console.log(`   ⏳ [RATE LIMIT] ${model} - Waiting ${retryAfter}s before retry (attempt ${attempt + 1}/3)`);
          await new Promise(r => setTimeout(r, retryAfter * 1000));
          continue;
        }

        if (status === 500 || status === 502 || status === 503 || status === 504 || !status) {
          const waitTime = (attempt + 1) * 5000;
          console.log(`   ⏳ [RETRY] ${model} - Server error, retry in ${waitTime/1000}s (attempt ${attempt + 1}/3)`);
          await new Promise(r => setTimeout(r, waitTime));
          continue;
        }

        throw e;
      }
    }
    console.log(`   ⚠️ [FAILED] ${model} - All attempts exhausted`);
    return "";
  }

  private async buildMarketDataForPair(pair: string): Promise<string> {
    const ticker = await IndodaxPublicAPI.getTicker(pair);
    const trend = await MarketIntelligence.analyzeTrend(pair);
    const ob = await MarketIntelligence.analyzeOrderbook(pair);
    return `Pair: ${pair.toUpperCase()}
Price: Rp ${ticker.ticker.last}
24h High/Low: ${ticker.ticker.high} / ${ticker.ticker.low}
Spread: ${((Number(ticker.ticker.sell) - Number(ticker.ticker.buy)) / Number(ticker.ticker.sell) * 100).toFixed(2)}%
Trend: ${trend.alignment} (Score: ${trend.trendScore})
RSI: ${trend.rsiRegime}
Orderbook: ${ob.summary} (Score: ${ob.obScore})
Delta Volume: ${ob.deltaVolume > 0 ? 'More Buyers' : 'More Sellers'}
Absorption: ${ob.isAbsorbing ? 'YES - DANGER' : 'No'}`.trim();
  }

  private buildPrompt(data: string, isHeld: boolean, pair: string, role: 'hunter' | 'critic' | 'judge' = 'hunter'): string {
    const roles: Record<string, string> = {
      hunter: `Kamu adalah THE HUNTER. Tugasmu mencari peluang entry agresif berdasarkan data trend dan volume. Proposisikan sebuah Thesis Entry jika ada setup menarik.`,
      critic: `Kamu adalah THE CRITIC. Tugasmu mengevaluasi [HUNTER THESIS] secara skeptis. Cari alasan kenapa kita TIDAK boleh masuk (red flags, spoofing, bad spread). Jangan takut memberikan skor rendah jika Hunter terlalu FOMO.`,
      judge:  `Kamu adalah THE JUDGE (Keputusan Final). Tinjau argumen dari HUNTER dan CRITIC. Ambil keputusan objektif berdasarkan Risk-to-Reward (RR) dan probabilitas SMC. Kamu adalah filter terakhir sebelum uang nyata dieksekusi.`,
    };
    return `${roles[role]}

DATA PASAR ${pair.toUpperCase()}:
${data}

SKORING: 80-100=ELITE | 60-79=VALID | 40-59=WAIT | 0-39=AVOID

RESPON JSON SAJA:
{"action":"BUY"|"SELL"|"AVOID","score":number,"regime":"BULLISH"|"SIDEWAYS"|"BEARISH","confidence":"HIGH"|"MID"|"LOW","precise_entry":number,"precise_sl":number,"precise_tp":number,"why_now":"alasan 1 kalimat"}`.trim();
  }

  private async getAlphaHunterNarrativeScore(pair: string): Promise<number> {
    const alphaScore = this.alphaScores[pair] || 50;
    return Math.min(100, alphaScore);
  }

  private parseAI(raw: string, modelName: string): AIResult | null {
    try {
      const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
      const match = clean.match(/\{[\s\S]*\}/);
      return match ? JSON.parse(match[0]) : null;
    } catch { return null; }
  }
}