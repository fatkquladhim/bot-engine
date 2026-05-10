import axios from 'axios';

let isGlobalPause = false;
let pauseUntil = 0;

export function isPaused(): boolean {
  return isGlobalPause && Date.now() < pauseUntil;
}

export function getPauseRemaining(): number {
  if (!isGlobalPause) return 0;
  if (Date.now() >= pauseUntil) {
    isGlobalPause = false;
    return 0;
  }
  return Math.ceil((pauseUntil - Date.now()) / 1000);
}

export function triggerGlobalPause(retryAfterSeconds: number) {
  isGlobalPause = true;
  pauseUntil = Date.now() + (retryAfterSeconds * 1000);
  console.log(`⏸️ [GLOBAL PAUSE] Indodax rate limited. Pausing all requests for ${retryAfterSeconds}s until ${new Date(pauseUntil).toLocaleTimeString()}`);
}

export function clearGlobalPause() {
  isGlobalPause = false;
  pauseUntil = 0;
}

export async function waitIfPaused(): Promise<void> {
  if (!isPaused()) return;
  const remaining = getPauseRemaining();
  if (remaining > 0) {
    console.log(`⏸️ [INDODAX PAUSE] Waiting ${remaining}s for rate limit reset...`);
    await new Promise(r => setTimeout(r, Math.min(remaining * 1000, 60000)));
  }
}

export async function indodaxGet(
  url: string,
  cacheKey: string,
  cache: Map<string, { data: any; expiry: number }>,
  ttlMs: number,
  headers?: Record<string, string>
): Promise<any> {
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) return cached.data;

  await waitIfPaused();

  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://indodax.com/',
        ...headers
      },
      timeout: 8000
    });
    cache.set(cacheKey, { data: res.data, expiry: Date.now() + ttlMs });
    return res.data;
  } catch (e: any) {
    if (e?.response?.status === 429) {
      const retryAfter = parseInt(e?.response?.headers?.['retry-after'] || '1800');
      triggerGlobalPause(retryAfter);
      cache.clear();
      await new Promise(r => setTimeout(r, 5000));
      throw new Error(`Indodax 429 — retry after ${retryAfter}s`);
    }
    throw e;
  }
}

export async function indodaxTapiPost(
  url: string,
  postData: string,
  headers: Record<string, string>,
  timeout = 15000
): Promise<any> {
  await waitIfPaused();

  try {
    const res = await axios.post(url, postData, {
      headers,
      timeout
    });
    return res.data;
  } catch (e: any) {
    if (e?.response?.status === 429) {
      const retryAfter = parseInt(e?.response?.headers?.['retry-after'] || '1800');
      triggerGlobalPause(retryAfter);
      await new Promise(r => setTimeout(r, 5000));
      throw new Error(`Indodax TAPI 429 — retry after ${retryAfter}s`);
    }
    throw e;
  }
}