/**
 * cache.js
 * Multi-tier caching utility for API calls:
 * 1. Local/MCP Mode: Persistent disk caching (.cache/) to preserve API rate limits and offline fallback.
 * 2. Firebase/Cloud Mode: Safe ephemeral /tmp or memory cache fallback when running in serverless containers.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveDefaultCacheDir() {
  const localDir = path.join(__dirname, '..', '.cache');
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    // Test write permission
    const testFile = path.join(localDir, '.write_test');
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    return localDir;
  } catch {
    // In restricted serverless / cloud environments, fallback to os tmpdir
    const tmpDir = path.join(os.tmpdir(), 'ai_growth_syntax_cache');
    try {
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      return tmpDir;
    } catch {
      return null;
    }
  }
}

export class DiskCache {
  constructor(baseDir = null) {
    this.baseDir = baseDir || resolveDefaultCacheDir();
    this.memoryFallback = new Map();
  }

  _getFilePath(key, namespace = 'default') {
    if (!this.baseDir) return null;
    const cleanNs = namespace.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dir = path.join(this.baseDir, cleanNs);
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      return path.join(dir, `${cleanKey}.json`);
    } catch {
      return null;
    }
  }

  /**
   * Retrieves data from cache if it exists and hasn't exceeded ttlMs.
   */
  get(key, namespace = 'default', ttlMs = 24 * 60 * 60 * 1000) {
    const memKey = `${namespace}:${key}`;
    const memEntry = this.memoryFallback.get(memKey);
    if (memEntry) {
      if (ttlMs <= 0 || (Date.now() - memEntry.timestamp <= ttlMs)) {
        return memEntry.data;
      }
    }

    const file = this._getFilePath(key, namespace);
    if (!file || !fs.existsSync(file)) return null;

    try {
      const stats = fs.statSync(file);
      if (ttlMs > 0 && Date.now() - stats.mtimeMs > ttlMs) {
        return null; // Expired
      }
      const raw = fs.readFileSync(file, 'utf8');
      const parsed = JSON.parse(raw);
      // Populate memory cache
      this.memoryFallback.set(memKey, { data: parsed, timestamp: stats.mtimeMs });
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Retrieves data from cache regardless of expiration (for rate-limit fallback).
   */
  getStale(key, namespace = 'default') {
    const memKey = `${namespace}:${key}`;
    const memEntry = this.memoryFallback.get(memKey);
    if (memEntry) return memEntry.data;

    const file = this._getFilePath(key, namespace);
    if (!file || !fs.existsSync(file)) return null;
    try {
      const raw = fs.readFileSync(file, 'utf8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Stores data in cache (writes both to disk and memory).
   */
  set(key, data, namespace = 'default') {
    const memKey = `${namespace}:${key}`;
    this.memoryFallback.set(memKey, { data, timestamp: Date.now() });

    const file = this._getFilePath(key, namespace);
    if (!file) return true;

    try {
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (err) {
      // In serverless / read-only contexts, memoryFallback still succeeded
      return true;
    }
  }

  /**
   * Retrieves data from cache only if it was saved today.
   * If saved yesterday or earlier (i.e. it became the next day), returns null.
   */
  getToday(key, namespace = 'default') {
    const today = new Date().toISOString().slice(0, 10);
    const memKey = `${namespace}:${key}`;
    const memEntry = this.memoryFallback.get(memKey);
    if (memEntry) {
      const entryDay = new Date(memEntry.timestamp).toISOString().slice(0, 10);
      if (entryDay === today) {
        return memEntry.data;
      }
    }

    const file = this._getFilePath(key, namespace);
    if (!file || !fs.existsSync(file)) return null;

    try {
      const stats = fs.statSync(file);
      const fileDay = new Date(stats.mtimeMs).toISOString().slice(0, 10);
      if (fileDay !== today) {
        return null; // Next day has arrived -> stale
      }
      const raw = fs.readFileSync(file, 'utf8');
      const parsed = JSON.parse(raw);
      this.memoryFallback.set(memKey, { data: parsed, timestamp: stats.mtimeMs });
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Checks if key exists in cache.
   */
  has(key, namespace = 'default') {
    const memKey = `${namespace}:${key}`;
    if (this.memoryFallback.has(memKey)) return true;

    const file = this._getFilePath(key, namespace);
    return file ? fs.existsSync(file) : false;
  }

  /**
   * Deletes an item from both memory and disk cache.
   */
  delete(key, namespace = 'default') {
    const memKey = `${namespace}:${key}`;
    this.memoryFallback.delete(memKey);
    const file = this._getFilePath(key, namespace);
    if (file && fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch {}
    }
  }
}

export const defaultCache = new DiskCache();
