/**
 * tieredStore.js
 * High-Performance "Cache-First, DB-First, Source-Fallback" Orchestration Engine.
 * 
 * Retrieval Pipeline:
 * 1. Check L1 Cache (in-memory & fast disk). If fresh today -> Return immediately (Cache Hit).
 * 2. If Cache Miss -> Check L2 Database (SQLite in Local mode, Firestore in Deployed mode).
 *    - If DB Hit -> Automatically "warm" L1 Cache from DB and return.
 * 3. If DB Miss or Next-Day Expiry -> Pull fresh data from external source fetcher.
 * 4. Dual-Write Ingestion: Automatically populate BOTH L1 Cache and L2 Database with today's timestamp.
 * 5. Resilient Degradation: If source pull fails (rate-limit, timeout, network error),
 *    gracefully serve stale data from DB or Cache with `isStale: true`.
 */

import { defaultCache } from './cache.js';
import { getDatabase, defaultDb, getTodayDateStr } from './db.js';

export class TieredDataStore {
  /**
   * @param {Object} [options]
   * @param {Object} [options.cache] L1 Cache implementation (defaults to defaultCache)
   * @param {Object} [options.db] L2 Database implementation (defaults to defaultDb)
   */
  constructor(options = {}) {
    this.cache = options.cache || defaultCache;
    this.db = options.db || defaultDb;
  }

  /**
   * Core retrieval pipeline: Cache-First -> DB-First -> Source-Fallback -> Dual Write.
   * 
   * @param {Object} params
   * @param {string} params.key Unique identifier for the data item (e.g., 'SA_FEED_AAPL')
   * @param {string} [params.namespace='default'] Logical partition / domain
   * @param {Function} params.fetcher Async function that queries the external source
   * @param {boolean} [params.forceRefresh=false] If true, bypasses Cache & DB to fetch from source
   * @returns {Promise<{ data: any, source: 'cache'|'db'|'source'|'stale_db'|'stale_cache', isStale: boolean, error?: string }>}
   */
  async retrieveOrFetch({ key, namespace = 'default', fetcher, forceRefresh = false }) {
    if (!key) throw new Error('[TieredDataStore] Missing required parameter: key');
    if (!fetcher && !forceRefresh) throw new Error('[TieredDataStore] Missing required parameter: fetcher function');

    const today = getTodayDateStr();

    // -------------------------------------------------------------
    // Step 1: Check L1 Cache (Fast In-Memory / Disk)
    // -------------------------------------------------------------
    if (!forceRefresh) {
      try {
        const cachedData = this.cache.getToday(key, namespace);
        if (cachedData !== null && cachedData !== undefined) {
          return {
            data: cachedData,
            source: 'cache',
            isStale: false
          };
        }
      } catch (cacheErr) {
        console.warn(`[TieredStore] Cache read warning for ${namespace}:${key}:`, cacheErr.message);
      }

      // -------------------------------------------------------------
      // Step 2: Check L2 Database (SQLite / Firestore)
      // -------------------------------------------------------------
      try {
        const dbData = await this.db.get(key, namespace);
        if (dbData !== null && dbData !== undefined) {
          // Cache Warming: Populate L1 Cache so subsequent requests are fast cache hits
          try {
            this.cache.set(key, dbData, namespace);
          } catch (warmErr) {
            console.warn(`[TieredStore] Cache warming error for ${namespace}:${key}:`, warmErr.message);
          }

          return {
            data: dbData,
            source: 'db',
            isStale: false
          };
        }
      } catch (dbErr) {
        console.warn(`[TieredStore] DB read warning for ${namespace}:${key}:`, dbErr.message);
      }
    }

    // -------------------------------------------------------------
    // Step 3: Pull New Data from External Source
    // -------------------------------------------------------------
    try {
      const freshData = await fetcher();
      if (freshData !== null && freshData !== undefined) {
        // Step 4: Populate BOTH L1 Cache and L2 Database with today's date stamp
        await this.populateBoth(key, freshData, namespace, today);

        return {
          data: freshData,
          source: 'source',
          isStale: false
        };
      }
    } catch (sourceErr) {
      console.warn(`[TieredStore] Source fetch failed for ${namespace}:${key} (${sourceErr.message}). Initiating fallback degradation.`);

      // -------------------------------------------------------------
      // Step 5: Resilient Graceful Degradation (Stale DB or Stale Cache)
      // -------------------------------------------------------------
      try {
        const staleDb = await this.db.getStale(key, namespace);
        if (staleDb !== null && staleDb !== undefined) {
          return {
            data: staleDb,
            source: 'stale_db',
            isStale: true,
            error: sourceErr.message
          };
        }
      } catch {}

      try {
        const staleCache = this.cache.getStale(key, namespace);
        if (staleCache !== null && staleCache !== undefined) {
          return {
            data: staleCache,
            source: 'stale_cache',
            isStale: true,
            error: sourceErr.message
          };
        }
      } catch {}

      // If no stale data exists, re-throw the original source error
      throw sourceErr;
    }

    throw new Error(`[TieredStore] Fetcher returned empty/null data for ${namespace}:${key}`);
  }

  /**
   * Dual-write utility: Writes synchronously/concurrently to both Cache and DB.
   * @param {string} key 
   * @param {any} data 
   * @param {string} namespace 
   * @param {string} [dateStr] 
   */
  async populateBoth(key, data, namespace = 'default', dateStr = getTodayDateStr()) {
    const operations = [
      Promise.resolve().then(() => this.cache.set(key, data, namespace)),
      Promise.resolve().then(() => this.db.set(key, data, namespace, dateStr))
    ];

    const results = await Promise.allSettled(operations);
    for (const r of results) {
      if (r.status === 'rejected') {
        console.warn(`[TieredStore] Warning writing to store for ${namespace}:${key}:`, r.reason?.message);
      }
    }
  }

  /**
   * Manually sets data in both Cache and DB.
   */
  async set(key, data, namespace = 'default') {
    return this.populateBoth(key, data, namespace);
  }

  /**
   * Evicts a key from both Cache and DB.
   */
  async invalidate(key, namespace = 'default') {
    try {
      this.cache.delete(key, namespace);
    } catch {}

    try {
      await this.db.delete(key, namespace);
    } catch {}
  }

  /**
   * Inspects storage status across Cache and DB tiers.
   */
  async getStatus(key, namespace = 'default') {
    const hasCache = this.cache.has(key, namespace);
    const cachedFresh = this.cache.getToday(key, namespace) !== null;
    const dbData = await this.db.get(key, namespace);
    const staleDb = await this.db.getStale(key, namespace);

    return {
      key,
      namespace,
      today: getTodayDateStr(),
      cache: {
        present: hasCache,
        freshToday: cachedFresh
      },
      database: {
        present: staleDb !== null,
        freshToday: dbData !== null
      }
    };
  }
}

export const defaultTieredStore = new TieredDataStore();

export default {
  TieredDataStore,
  defaultTieredStore
};

