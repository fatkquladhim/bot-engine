"use server";

import { IndodaxClient } from "@/lib/indodax";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function executeSniperAction(analysisId: string) {
  try {
    const analysis = await (prisma as any).analysis.findUnique({ where: { id: analysisId } });
    if (!analysis) return { success: false, message: "Analysis not found" };

    const client = new IndodaxClient();
    
    // Default: use 2% of equity or fixed amount for MVP
    // Here we use a safe default for the user: Rp 100,000 if balance allows
    const amount = 100000; 

    const result = await client.trade(analysis.assetName, 'buy', analysis.entryPrice, amount);
    
    if (result.success === 1) {
      // Update DB status to TRADING
      await (prisma as any).analysis.update({
        where: { id: analysisId },
        data: { status: 'TRADING' }
      });
      revalidatePath('/');
      return { success: true, message: "Sniper Entry Executed!" };
    } else {
      return { success: false, message: result.error || "Execution failed" };
    }
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function panicSellAction(analysisId: string) {
  try {
    const analysis = await (prisma as any).analysis.findUnique({ where: { id: analysisId } });
    if (!analysis) return { success: false, message: "Analysis not found" };

    const client = new IndodaxClient();
    const info = await client.getInfo();
    const coin = analysis.assetName.split('_')[0];
    const amount = parseFloat(info.return.balance[coin] || "0");

    if (amount <= 0) return { success: false, message: "No balance to sell" };

    const ticker = await IndodaxClient.getTicker(analysis.assetName);
    const price = parseFloat(ticker.ticker.last);

    const result = await client.trade(analysis.assetName, 'sell', price, amount);
    
    if (result.success === 1) {
      await (prisma as any).analysis.update({
        where: { id: analysisId },
        data: { status: 'PROFIT' } // Marking as finished
      });
      revalidatePath('/');
      return { success: true, message: "Panic Sell Executed!" };
    } else {
      return { success: false, message: result.error || "Sell failed" };
    }
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function emergencyExitAll() {
  // Logic to sell all holdings with balance > 0
  try {
    const client = new IndodaxClient();
    const info = await client.getInfo();
    const balances = info.return.balance;
    const summaries = await IndodaxClient.getAllTickers();
    
    const results = [];
    for (const coin of Object.keys(balances)) {
      if (coin === 'idr') continue;
      const amount = parseFloat(balances[coin]);
      if (amount > 0) {
        const pair = `${coin}_idr`;
        const price = parseFloat(summaries.tickers[pair]?.last || "0");
        if (price > 0) {
          const res = await client.trade(pair, 'sell', price, amount);
          results.push({ coin, success: res.success === 1 });
        }
      }
    }
    revalidatePath('/');
    return { success: true, results };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function updateBotSettings(data: any) {
  try {
    const settings = await (prisma as any).botSettings.upsert({
      where: { id: "global" },
      update: data,
      create: { id: "global", ...data }
    });
    revalidatePath('/');
    return { success: true, settings };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function toggleBotPower() {
  try {
    const current = await (prisma as any).botSettings.findUnique({ where: { id: "global" } });
    const newState = current ? !current.isBotEnabled : false;
    
    await (prisma as any).botSettings.upsert({
      where: { id: "global" },
      update: { isBotEnabled: newState },
      create: { id: "global", isBotEnabled: newState }
    });
    revalidatePath('/');
    return { success: true, isEnabled: newState };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function forceCloseAction(analysisId: string) {
  try {
    await (prisma as any).analysis.update({
      where: { id: analysisId },
      data: { status: 'CANCELLED' }
    });
    revalidatePath('/');
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}
