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

    // COUNCIL OF THREE: Hunter, Critic, Judge
    const freeEnv = process.env.SUMOPOD_FREE_MODELS || "qwen/qwen3-30b-a3b-instruct-2507,nvidia/nemotron-3-nano-30b,openai/gpt-oss-20b";
    this.freeModels = freeEnv.split(',').map(m => m.trim());

    const fallbackEnv = process.env.SUMOPOD_FALLBACK_MODELS || "MiniMax-M2.7-highspeed,gemini/gemini-2.0-flash-lite,deepseek-v4-flash";
    this.fallbackModels = fallbackEnv.split(',').map(m => m.trim());

    if (this.sumopodKey) {
      this.isEnabled = true;
      console.log(`🚀 [ALPHA OMEGA] Sumopod Engine Aktif`);
      console.log(`   - Tier 1 (Scanner): ${this.freeModels[0]}`);
      console.log(`   - Tier 2 (Consensus): ${this.fallbackModels[0]}`);
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
    const maxPairs = regime === 'DEFENSE' ? 5 : regime === 'PREDATOR' ? 10 : 7;
    const pairsToAnalyze = this.targetPairs.slice(0, maxPairs);
    console.log(`\n🦅 [PREDATOR MODE] ON | Regime: ${regime} | Target Count: ${pairsToAnalyze.length}`);

    const results: AIResult[] = [];
    const withTimeout = (p: Promise<any>, ms: number) =>
      Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('TIMEOUT')), ms))]);

    const analysisPromises = pairsToAnalyze.map(async (pair, index) => {
      try {
        await new Promise(r => setTimeout(r, index * 2000));
        const isHeld = !!this.engine.state.openPositions[pair];
        const marketData = await this.buildMarketDataForPair(pair);

        console.log(`   🤝 [CONSENSUS] Fetching signals for ${pair.toUpperCase()}...`);

        // COUNCIL OF THREE — Sequential Self-Correction
        const modelA = this.freeModels[0]; // Hunter (Analyst)
        const modelB = this.freeModels[1]; // Critic (Auditor)
        const modelC = this.freeModels[2]; // Judge (Executor)

        // Step 1: Hunter membuat analisa awal
        const rawA = await withTimeout(this.callSumopodAI(marketData, isHeld, pair, modelA, 'hunter'), 20000).catch(() => "");
        const resA = this.parseAI(rawA as string, modelA);

        // Step 2: Critic mengaudit analisa Hunter
        const auditData = `${marketData}\n\n[HUNTER THESIS]: ${rawA}`;
        const rawB = rawA ? await withTimeout(this.callSumopodAI(auditData, isHeld, pair, modelB, 'critic'), 20000).catch(() => "") : "";
        const resB = this.parseAI(rawB as string, modelB);

        // Step 3: Judge membuat keputusan final
        const judgeData = `${marketData}\n\n[HUNTER]: ${rawA}\n\n[CRITIC]: ${rawB}`;
        const rawC = (rawA || rawB) ? await withTimeout(this.callSumopodAI(judgeData, isHeld, pair, modelC, 'judge'), 20000).catch(() => "") : "";
        const resC = this.parseAI(rawC as string, modelC);

        const aiSignals = [resA, resB, resC].filter(Boolean) as AIResult[];

        if (aiSignals.length === 0) {
          console.log(`   ⚠️ [COUNCIL] ${pair.toUpperCase()}: Semua model gagal. Skip.`);
          return null;
        }

        const buyVotes = aiSignals.filter(s => s.action === 'BUY').length;
        const avgScore = aiSignals.reduce((s, r) => s + r.score, 0) / aiSignals.length;
        console.log(`   ✅ [COUNCIL] ${pair.toUpperCase()}: ${aiSignals.length}/3 | BUY: ${buyVotes} | Avg: ${avgScore.toFixed(0)}`);

        const evaluation = await this.predatorStrategy.evaluateTrade(pair, aiSignals, this.alphaScores[pair] || 0);

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
          const finalRes = aiSignals[0];
          finalRes.score = evaluation.score;
          finalRes.pair = pair;
          return finalRes;
        }
        return null;
      } catch (e: any) {
        console.error(`   ❌ Error menganalisa ${pair}:`, e.message);
        return null;
      }
    });

    const settled = await Promise.all(analysisPromises);
    for (const res of settled) { if (res) results.push(res); }
    return results;
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
          { headers: { 'Authorization': `Bearer ${this.sumopodKey}` }, timeout: 45000 }
        );
        return res.data.choices?.[0]?.message?.content || "";
      } catch (e: any) {
        if (e?.response?.status === 429 && attempt < 2) {
          await new Promise(r => setTimeout(r, (attempt + 1) * 5000));
          continue;
        }
        throw e;
      }
    }
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
      hunter: `Kamu THE HUNTER — cari peluang entry terbaik. Fokus: trend, momentum. Beri skor tinggi jika setup kuat.`,
      critic: `Kamu THE CRITIC — cari alasan TIDAK masuk. Fokus: risiko, spread, manipulasi. Beri skor rendah jika ada red flag.`,
      judge:  `Kamu THE JUDGE — keputusan final objektif. BUY hanya jika RR ≥ 1.5 dan tidak ada red flag besar.`,
    };
    return `${roles[role]}

DATA PASAR ${pair.toUpperCase()}:
${data}

SKORING: 80-100=ELITE | 60-79=VALID | 40-59=WAIT | 0-39=AVOID

RESPON JSON SAJA:
{"action":"BUY"|"SELL"|"AVOID","score":number,"regime":"BULLISH"|"SIDEWAYS"|"BEARISH","confidence":"HIGH"|"MID"|"LOW","precise_entry":number,"precise_sl":number,"precise_tp":number,"why_now":"alasan 1 kalimat"}`.trim();
  }

  private parseAI(raw: string, modelName: string): AIResult | null {
    try {
      const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
      const match = clean.match(/\{[\s\S]*\}/);
      return match ? JSON.parse(match[0]) : null;
    } catch { return null; }
  }
}
