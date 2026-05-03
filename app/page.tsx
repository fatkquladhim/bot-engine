import { prisma } from "@/lib/prisma";
import { IndodaxClient } from "@/lib/indodax";
export const dynamic = 'force-dynamic';
import axios from "axios";
import {
  SniperButton,
  PanicSellButton,
  EmergencyAllButton
} from "@/components/TradeButtons";
import { BotControlPanel } from "@/components/BotControl";
import { RefreshTimer } from "@/components/RefreshTimer";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  ShieldCheck,
  Zap,
  History,
  Target,
  AlertCircle,
  Wallet,
  Globe,
  Coins,
  ArrowRight,
  Terminal,
  Cpu,
  BarChart3
} from "lucide-react";

async function getStats() {
  const client = new IndodaxClient();

  const [closedAnalyses, openAnalyses, latestSignal, botSettings, recentLogs] = await Promise.all([
    (prisma as any).analysis.findMany({
      where: {
        status: { in: ['PROFIT', 'LOSS'] },
        updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      }
    }),
    (prisma as any).analysis.findMany({ where: { status: 'TRADING' }, orderBy: { createdAt: 'desc' } }),
    (prisma as any).analysis.findFirst({ orderBy: { createdAt: 'desc' } }),
    (prisma as any).botSettings.findUnique({ where: { id: 'global' } }),
    (prisma as any).activityLog.findMany({ take: 15, orderBy: { createdAt: 'desc' } })
  ]);

  // Dynamically calculate performance from closed trades
  const totalTrades = closedAnalyses.length;
  const winningTrades = closedAnalyses.filter((a: any) => a.status === 'PROFIT').length;
  const totalPnlIdr = closedAnalyses.reduce((sum: number, a: any) => sum + (a.realizedPnlIdr || 0), 0);

  const performance = { totalTrades, winningTrades, totalPnlIdr };

  let walletAssets: any[] = [];
  let idrBalance = 0;
  let idrHold = 0;
  let totalEquity = 0;

  try {
    const [info, summaries] = await Promise.all([
      client.getInfo(),
      IndodaxClient.getAllTickers()
    ]);

    if (info.success) {
      idrBalance = parseFloat(info.return.balance.idr || "0");
      idrHold = parseFloat(info.return.balance_hold.idr || "0");

      const balances = info.return.balance;
      const holds = info.return.balance_hold;
      const tickers = summaries.tickers;

      for (const coin of Object.keys(balances)) {
        if (coin === 'idr') continue;
        const total = parseFloat(balances[coin]) + parseFloat(holds[coin] || "0");
        if (total > 0) {
          const price = tickers[`${coin}_idr`] ? parseFloat(tickers[`${coin}_idr`].last) : 0;
          const value = total * price;
          if (value > 100) {
            walletAssets.push({ coin: coin.toUpperCase(), amount: total, price, value });
            totalEquity += value;
          }
        }
      }
      totalEquity += idrBalance + idrHold;
    }
  } catch (e) { }

  let btcPrice = 0;
  let fgIndex = 50;
  let fgLabel = "Neutral";
  try {
    const [btcTicker, fgRes] = await Promise.all([
      IndodaxClient.getTicker('btc_idr'),
      axios.get('https://api.alternative.me/fng/?limit=1')
    ]);
    btcPrice = parseFloat(btcTicker.ticker.last);
    fgIndex = parseInt(fgRes.data.data?.[0]?.value || "50");
    fgLabel = fgRes.data.data?.[0]?.value_classification || "Neutral";
  } catch (e) { }

  const enrichedPositions = await Promise.all(openAnalyses.map(async (pos: any) => {
    try {
      const ticker = await IndodaxClient.getTicker(pos.assetName);
      let livePrice = parseFloat(ticker.ticker.last);

      // SANITY CHECK: Jika livePrice > 10,000x entryPrice, kemungkinan besar data API tertukar dengan Volume
      // FET case: Entry 3.5k, Live 1.3B (Volume). Kita deteksi dan cegah.
      if (pos.entryPrice > 0 && livePrice > pos.entryPrice * 10000) {
        livePrice = pos.currentPrice || pos.entryPrice;
      }

      return { ...pos, livePrice };
    } catch (e) {
      return { ...pos, livePrice: pos.currentPrice || pos.entryPrice };
    }
  }));

  return {
    performance, openAnalyses: enrichedPositions, latestSignal, botSettings, recentLogs,
    walletAssets: walletAssets.sort((a, b) => b.value - a.value), idrBalance, idrHold, totalEquity,
    btcPrice, fgIndex, fgLabel
  };
}

export default async function DashboardPage() {
  const { performance, openAnalyses, latestSignal, botSettings, recentLogs, walletAssets, idrBalance, idrHold, totalEquity, btcPrice, fgIndex, fgLabel } = await getStats();

  const winRate = performance?.totalTrades > 0 ? Math.round((performance.winningTrades / performance.totalTrades) * 100) : 0;

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">
      <RefreshTimer />
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-500/30">
            <Cpu className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-white flex items-center gap-2">
              ALPHA OMEGA <span className="text-blue-500 text-sm tracking-widest font-mono">V2.0</span>
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <p className="text-zinc-500 font-bold uppercase tracking-[0.2em] text-[9px]">Live Trading System • Institutional Grade</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-center w-full lg:w-auto">
          <div className="flex-1 lg:flex-none p-3 px-6 bg-white/5 rounded-xl border border-white/10 text-center">
            <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Global Sentiment</p>
            <p className={`text-lg font-black ${fgIndex > 60 ? 'text-green-500' : fgIndex < 40 ? 'text-red-500' : 'text-amber-500'}`}>
              {fgIndex} <span className="text-[10px] opacity-70">({fgLabel})</span>
            </p>
          </div>
          <div className="flex-1 lg:flex-none p-3 px-6 bg-white/5 rounded-xl border border-white/10 text-center">
            <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">BTC Index</p>
            <p className="text-lg font-black text-white">Rp {(btcPrice / 1e6).toFixed(1)}M</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* LEFT COLUMN - STATS & POSITIONS */}
        <div className="lg:col-span-3 space-y-6">

          {/* TOP METRICS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card neon-border-blue flex flex-col justify-between h-32">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Total Equity</span>
              <div className="text-2xl font-black text-white">Rp {totalEquity.toLocaleString()}</div>
            </div>
            <div className="card neon-border-green flex flex-col justify-between h-32">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Growth (24H)</span>
              <div className={`text-2xl font-black ${(performance?.totalPnlIdr || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                Rp {(performance?.totalPnlIdr || 0).toLocaleString()}
              </div>
            </div>
            <div className="card neon-border-purple flex flex-col justify-between h-32">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Win Rate</span>
              <div className="text-2xl font-black text-purple-400">{winRate}%</div>
            </div>
            <div className="card flex flex-col justify-between h-32">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Available Cash</span>
              <div className="text-2xl font-black text-zinc-200">Rp {idrBalance.toLocaleString()}</div>
            </div>
          </div>

          {/* ACTIVE POSITIONS */}
          <div className="card relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[1px] animate-scan opacity-20" />
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Target className="w-5 h-5 text-blue-500" />
                </div>
                <h2 className="text-xl font-black tracking-tight uppercase">Active Commands</h2>
              </div>
              <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800/50 px-2 py-1 rounded border border-white/5">
                {openAnalyses.length} Position(s) Live
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5 text-left">
                    <th className="pb-4 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Asset Profile</th>
                    <th className="pb-4 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Entry / Live</th>
                    <th className="pb-4 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">P&L Analysis</th>
                    <th className="pb-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {openAnalyses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-zinc-600 italic text-sm">No active positions. Scanning for elite setups...</td>
                    </tr>
                  ) : (
                    openAnalyses.map((pos: any) => {
                      const pnl = ((pos.livePrice - pos.entryPrice) / pos.entryPrice) * 100;
                      return (
                        <tr key={pos.id} className="group hover:bg-white/[0.01] transition-colors">
                          <td className="py-5">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${pnl >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                {pos.assetName.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-black text-white text-lg">{pos.assetName.replace('_idr', '').toUpperCase()}</div>
                                <div className="text-[10px] text-zinc-500 font-mono">UUID: {pos.id.substring(0, 8)}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-5">
                            <div className="flex flex-col">
                              <span className="text-xs text-zinc-500">In: Rp {pos.entryPrice.toLocaleString()}</span>
                              <span className="text-sm font-black text-white">Rp {pos.livePrice.toLocaleString()}</span>
                            </div>
                          </td>
                          <td className="py-5">
                            <div className="flex items-center gap-4">
                              <div className={`text-xl font-black ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                              </div>
                              <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden hidden md:block">
                                <div
                                  className={`h-full ${pnl >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                                  style={{ width: `${Math.min(100, Math.abs(pnl) * 10)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-5 text-right">
                            <PanicSellButton analysisId={pos.id} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* PORTFOLIO GRID */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 ml-2">
              <BarChart3 className="w-5 h-5 text-zinc-400" />
              <h2 className="text-lg font-black tracking-tight uppercase">Portfolio Allocation</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {walletAssets.map((asset) => (
                <div key={asset.coin} className="card bg-zinc-900/50 hover:scale-[1.02] active:scale-95 cursor-pointer">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center font-black text-[10px]">
                      {asset.coin.substring(0, 2)}
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Value</div>
                      <div className="text-sm font-black text-white">Rp {asset.value.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="text-lg font-black text-white">{asset.coin}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">{asset.amount.toLocaleString()} Units</div>
                    </div>
                    <div className="text-[9px] text-zinc-600 font-bold">@ Rp {asset.price.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - COMMANDS & LOGS */}
        <div className="space-y-6">

          {/* BOT CONTROL */}
          <BotControlPanel settings={botSettings} />

          {/* ELITE SIGNAL */}
          <div className="card border-blue-500/30 bg-blue-500/[0.03] relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Zap className="w-4 h-4 text-blue-400" />
              </div>
              <h2 className="text-sm font-black tracking-widest uppercase">Next Target</h2>
            </div>

            {latestSignal ? (
              <div className="space-y-6 relative z-10">
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                  <div className="text-[9px] text-blue-400 font-black uppercase tracking-[0.3em] mb-2">Alpha Signal Detected</div>
                  <div className="text-3xl font-black text-white tracking-tighter">{latestSignal.assetName.replace('_idr', '').toUpperCase()}</div>
                  <div className="mt-2 text-[10px] text-zinc-500 font-medium">Confidence: 85% • Risk: Low</div>
                </div>
                <SniperButton analysisId={latestSignal.id} />
              </div>
            ) : (
              <div className="py-8 text-center relative z-10">
                <div className="w-12 h-12 border-2 border-t-blue-500 border-white/5 rounded-full animate-spin mx-auto mb-4" />
                <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Neural Scanning...</span>
              </div>
            )}
          </div>

          {/* INTELLIGENCE FEED */}
          <div className="card flex flex-col h-[400px]">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Terminal className="w-4 h-4 text-purple-500" />
              </div>
              <h2 className="text-sm font-black tracking-widest uppercase">Intelligence Feed</h2>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide">
              {recentLogs.length === 0 ? (
                <div className="text-[10px] text-zinc-600 italic p-4 text-center">Waiting for uplink...</div>
              ) : (
                recentLogs.map((log: any) => (
                  <div key={log.id} className="text-[10px] leading-relaxed border-l border-zinc-800 pl-3 py-1 hover:border-blue-500 transition-colors">
                    <div className="flex justify-between items-center mb-1">
                      <span className={`font-black tracking-widest ${log.type === 'TRADE' ? 'text-green-400' :
                          log.type === 'ERROR' ? 'text-red-400' : 'text-blue-400'
                        }`}>
                        [{log.type}]
                      </span>
                      <span className="text-[9px] text-zinc-700 font-mono">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-zinc-400 font-medium line-clamp-2">{log.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* KILL SWITCH */}
          <div className="card border-red-500/20 bg-red-500/[0.02] group hover:bg-red-500/[0.05]">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 text-red-500 group-hover:animate-pulse" />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-red-500">Emergency Protocol</h2>
            </div>
            <EmergencyAllButton />
          </div>

        </div>
      </div>
    </main>
  );
}
