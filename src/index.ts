import * as dotenv from 'dotenv';
import { TradingEngine } from './engine/TradingEngine';

// Load environment variables
dotenv.config();

async function main() {
  console.log('🚀 Starting Indodax Advanced Trading Engine...\n');

  const apiKey = process.env.INDODAX_API_KEY;
  const secretKey = process.env.INDODAX_SECRET_KEY;

  if (!apiKey || !secretKey) {
    console.error('❌ Error: API Keys are missing in .env file.');
    process.exit(1);
  }

  // Initialize Trading Engine with Risk Parameters
  const engine = new TradingEngine({
    api: {
      apiKey,
      secretKey,
    },
    risk: {
      maxPositionSizePercent: 10, // Max 10% of total IDR per trade
      maxDrawdownDailyPercent: 5, // Stop bot if lost 5% in a day
      defaultStopLossPercent: 2,  // Auto SL 2%
    },
    isDryRun: true, // ⚠️ SET TO FALSE FOR REAL TRADING
  });

  try {
    console.log('📡 Fetching Account Info...');
    const info = await engine.client.getInfo();
    console.log(`💰 IDR Balance: Rp ${parseInt(info.balance.idr).toLocaleString('id-ID')}`);
    
    // Example: Attempt to buy BTC with Rp 100.000
    // Because DryRun is TRUE, this will only simulate and check risk, not spend real money.
    await engine.executeBuy('btc_idr', 100000);

  } catch (error: any) {
    console.error('\n❌ Execution Error:', error.message);
  }
}

main();
