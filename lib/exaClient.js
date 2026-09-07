/**
 * exaClient.js
 * Exa Neural Search Client for Deep Semantic Financial Web Discovery.
 * 
 * Uses process.env.EXA_API_KEY to search for supplier disruptions,
 * customer sentiment, competitive shifts, and executive intelligence.
 */

import './env.js';
import { DiskCache, defaultCache } from './cache.js';

export class ExaClient {
  /**
   * @param {Object} [options]
   * @param {string} [options.apiKey]
   * @param {DiskCache} [options.cache]
   * @param {number} [options.cacheTtlMs]
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.EXA_API_KEY || '';
    this.cache = options.cache || defaultCache;
    this.cacheTtlMs = options.cacheTtlMs ?? 7 * 24 * 60 * 60 * 1000;
    this.endpoint = 'https://api.exa.ai/search';
  }

  get isConfigured() {
    return Boolean(this.apiKey && this.apiKey.length > 10);
  }

  /**
   * Searches the web using Exa's semantic neural embeddings.
   * @param {string} query
   * @param {number} [numResults=5]
   */
  async search(query, numResults = 5) {
    if (!this.isConfigured) return [];
    const cleanQuery = query.trim();
    const cacheKey = `EXA_${cleanQuery.replace(/[^a-zA-Z0-9]/g, '_')}_${numResults}`;
    const namespace = 'exa';

    const cached = this.cache.get(cacheKey, namespace, this.cacheTtlMs);
    if (cached) return cached;

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: cleanQuery,
          numResults,
          useAutoprompt: true
        })
      });

      if (!res.ok) {
        throw new Error(`Exa HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const results = (data.results || []).map(r => ({
        title: r.title,
        url: r.url,
        publishedDate: r.publishedDate,
        author: r.author
      }));

      this.cache.set(cacheKey, results, namespace);
      return results;
    } catch (err) {
      console.warn(`[Exa Search] Error for query '${cleanQuery}': ${err.message}`);
      const stale = this.cache.getStale(cacheKey, namespace);
      if (stale) return stale;
      return [];
    }
  }
}

