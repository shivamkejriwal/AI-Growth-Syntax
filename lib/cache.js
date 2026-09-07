/**
 * cache.js
 * Persistent disk caching utility for API calls to preserve rate limits
 * and provide offline/stale fallback capability.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_CACHE_BASE = path.join(__dirname, '..', '.cache');

export class DiskCache {
  constructor(baseDir = DEFAULT_CACHE_BASE) {
    this.baseDir = baseDir;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  _getFilePath(key, namespace = 'default') {
    const cleanNs = namespace.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dir = path.join(this.baseDir, cleanNs);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return path.join(dir, `${cleanKey}.json`);
  }

  /**
   * Retrieves data from cache if it exists and hasn't exceeded ttlMs.
   * @param {string} key
   * @param {string} namespace
   * @param {number} ttlMs - TTL in milliseconds. 0 or negative means indefinite.
   * @returns {any|null}
   */
  get(key, namespace = 'default', ttlMs = 24 * 60 * 60 * 1000) {
    const file = this._getFilePath(key, namespace);
    if (!fs.existsSync(file)) return null;

    try {
      const stats = fs.statSync(file);
      if (ttlMs > 0 && Date.now() - stats.mtimeMs > ttlMs) {
        return null; // Expired
      }
      const raw = fs.readFileSync(file, 'utf8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Retrieves data from cache regardless of expiration (for rate-limit fallback).
   */
  getStale(key, namespace = 'default') {
    const file = this._getFilePath(key, namespace);
    if (!fs.existsSync(file)) return null;
    try {
      const raw = fs.readFileSync(file, 'utf8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Stores data in cache.
   */
  set(key, data, namespace = 'default') {
    const file = this._getFilePath(key, namespace);
    try {
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.warn(`[Cache] Error writing to ${file}:`, err.message);
      return false;
    }
  }

  /**
   * Checks if key exists in cache.
   */
  has(key, namespace = 'default') {
    const file = this._getFilePath(key, namespace);
    return fs.existsSync(file);
  }
}

export const defaultCache = new DiskCache();

