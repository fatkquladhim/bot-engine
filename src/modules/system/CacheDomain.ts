export class CacheDomain {
  private static cache: Map<string, { value: any; expiry: number }> = new Map();

  /**
   * Set a value in the cache with a specific TTL in seconds.
   */
  public static set(key: string, value: any, ttlSeconds: number): void {
    const expiry = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiry });
  }

  /**
   * Get a value from the cache if it hasn't expired.
   */
  public static get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value as T;
  }

  /**
   * Clears the entire cache.
   */
  public static clear(): void {
    this.cache.clear();
  }
}
