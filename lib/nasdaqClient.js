/**
 * nasdaqClient.js
 * Nasdaq Data Link (formerly Quandl) Client.
 * 
 * Uses process.env.NASDAQ_API_KEY to fetch institutional financial data,
 * macro indicators, and market series.
 */

import './env.js';
import { DiskCache, defaultCache } from './cache.js';

export class NasdaqClient {
  /**
   * @param {Object} [options]
   * @param {string} [options.apiKey]
   * @param {DiskCache} [options.cache]
   * @param {number} [options.cacheTtlMs]
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.NASDAQ_API_KEY || '';
    this.cache = options.cache || defaultCache;
    this.cacheTtlMs = options.cacheTtlMs ?? 24 * 60 * 60 * 1000;
    this.baseUrl = 'https://data.nasdaq.com/api/v3/datasets';
  }

  get isConfigured() {
    return Boolean(this.apiKey && this.apiKey.length > 5);
  }

  /**
   * Fetches dataset from Nasdaq Data Link.
   * @param {string} databaseCode e.g. "USTREASURY"
   * @param {string} datasetCode e.g. "YIELD"
   */
  async getDataset(databaseCode, datasetCode) {
    const cacheKey = `${databaseCode}_${datasetCode}`;
    const namespace = 'nasdaq';

    const cached = this.cache.get(cacheKey, namespace, this.cacheTtlMs);
    if (cached) return cached;

    if (!this.isConfigured) return null;

    try {
      const url = `${this.baseUrl}/${databaseCode}/${datasetCode}.json?api_key=${this.apiKey}&rows=1`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Nasdaq Data Link HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      const dataset = data.dataset || {};
      this.cache.set(cacheKey, dataset, namespace);
      return dataset;
    } catch (err) {
      console.warn(`[Nasdaq Data Link] Error for ${databaseCode}/${datasetCode}: ${err.message}`);
      const stale = this.cache.getStale(cacheKey, namespace);
      if (stale) return stale;
      return null;
    }
  }
}

