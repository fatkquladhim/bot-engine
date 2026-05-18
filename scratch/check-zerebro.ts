import * as dotenv from 'dotenv';
import { IndodaxClient } from '../src/core/IndodaxClient';
import { IndodaxPublicAPI } from '../src/core/IndodaxPublicAPI';

dotenv.config();

async function main() {
  const apiKey = process.env.INDODAX_API_KEY || '';
  const secretKey = process.env.INDODAX_SECRET_KEY || '';
  
  const client = new IndodaxClient({ apiKey, secretKey });
  console.log('Fetching private info...');
  const info = await client.getInfo();
  console.log('Balances:', info.balance);
  
  console.log('\nFetching tickers...');
  const summaries = await IndodaxPublicAPI.getAllTickers();
  const keys = Object.keys(summaries);
  console.log('Total tickers:', keys.length);
  
  const zerebroTickers = keys.filter(k => k.includes('zerebro') || k.includes('zreb'));
  console.log('Matching tickers:', zerebroTickers);
  if (zerebroTickers.length > 0) {
    console.log('Ticker info:', summaries[zerebroTickers[0]]);
  }
}

main();
