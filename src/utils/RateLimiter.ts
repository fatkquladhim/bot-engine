import Bottleneck from 'bottleneck';
import axios from 'axios';

export const indodaxLimiter = new Bottleneck({
  minTime: 1500,
  maxConcurrent: 1
});

export const externalLimiter = new Bottleneck({
  minTime: 2000,
  maxConcurrent: 2
});

export async function rateLimitedGet(
  url: string,
  options: {
    headers?: Record<string, string>;
    timeout?: number;
    cacheKey?: string;
    cacheTTL?: number;
    limiter?: Bottleneck;
  } = {}
): Promise<any> {
  const limiter = options.limiter || indodaxLimiter;
  return limiter.schedule(() => axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Referer': 'https://indodax.com/',
      ...options.headers
    },
    timeout: options.timeout || 8000
  }));
}