/**
 * db.js
 * High-performance, zero-dependency Database layer for AI-Growth-Syntax.
 * 
 * Adapters:
 * 1. SqliteStore: Fast, persistent, ACID SQLite database leveraging Node 22's built-in `node:sqlite`
 *    for Local and MCP modes. Stored at `.data/growth_syntax.sqlite`.
 * 2. FirestoreStore: Cloud Firestore document store for Deployed / Firebase Mode.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getActiveMode, APP_MODES } from './modes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Returns current calendar day string in YYYY-MM-DD format.
 * Once midnight passes, this returns a new date string, triggering "next day" refresh.
 * @param {Date|number} [date]
 * @returns {string}
 */
export function getTodayDateStr(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
}

/**
 * Checks if the given date string is today.
 * @param {string} dateStr 
 * @returns {boolean}
 */
export function isToday(dateStr) {
  return dateStr === getTodayDateStr();
}

/**
 * Local SQLite Database Store using Node 22 native `node:sqlite`.
 */
export class SqliteStore {
  constructor(dbPath = null) {
    this.baseDir = path.join(__dirname, '..', '.data');
    if (!fs.existsSync(this.baseDir)) {
      try {
        fs.mkdirSync(this.baseDir, { recursive: true });
      } catch (e) {
        // Fallback to /tmp if write restricted
        this.baseDir = path.join('/tmp', 'ai_growth_syntax_data');
        if (!fs.existsSync(this.baseDir)) fs.mkdirSync(this.baseDir, { recursive: true });
      }
    }

    this.dbFile = dbPath || path.join(this.baseDir, 'growth_syntax.sqlite');
    this.db = null;
    this.memoryFallback = new Map();
    this._init();
  }

  _init() {
    try {
      // Import synchronous Database from node:sqlite (Node 22+)
      const { DatabaseSync } = requireNodeSqlite();
      this.db = new DatabaseSync(this.dbFile);

      // Performance optimizations: WAL mode & persistent table
      this.db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        CREATE TABLE IF NOT EXISTS data_store (
          namespace TEXT NOT NULL,
          key TEXT NOT NULL,
          data TEXT NOT NULL,
          date_str TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (namespace, key)
        );
        CREATE INDEX IF NOT EXISTS idx_data_store_ns_key ON data_store(namespace, key);
      `);
    } catch (err) {
      console.warn('[SqliteStore] Could not initialize native node:sqlite, using memory fallback:', err.message);
      this.db = null;
    }
  }

  /**
   * Retrieves data if present and from today.
   * If stored on a previous day, returns null (triggers next-day re-fetch).
   * @param {string} key 
   * @param {string} namespace 
   * @returns {any|null}
   */
  get(key, namespace = 'default') {
    const today = getTodayDateStr();
    if (this.db) {
      try {
        const stmt = this.db.prepare(`
          SELECT data, date_str, updated_at FROM data_store
          WHERE namespace = ? AND key = ?
        `);
        const row = stmt.get(namespace, key);
        if (!row) return null;

        // Daily TTL check: valid only if stored today
        if (row.date_str !== today) {
          return null; // Next day has arrived -> needs fresh pull
        }

        return JSON.parse(row.data);
      } catch (err) {
        console.warn(`[SqliteStore] Error reading ${namespace}:${key}:`, err.message);
        return null;
      }
    }

    // Memory fallback
    const memKey = `${namespace}:${key}`;
    const memEntry = this.memoryFallback.get(memKey);
    if (memEntry && memEntry.date_str === today) {
      return memEntry.data;
    }
    return null;
  }

  /**
   * Retrieves data regardless of expiration date (used when source fetch fails).
   * @param {string} key 
   * @param {string} namespace 
   * @returns {any|null}
   */
  getStale(key, namespace = 'default') {
    if (this.db) {
      try {
        const stmt = this.db.prepare(`
          SELECT data, date_str, updated_at FROM data_store
          WHERE namespace = ? AND key = ?
        `);
        const row = stmt.get(namespace, key);
        if (!row) return null;
        return {
          ...JSON.parse(row.data),
          _dbMetadata: {
            dateStr: row.date_str,
            updatedAt: row.updated_at,
            isStale: row.date_str !== getTodayDateStr()
          }
        };
      } catch {
        return null;
      }
    }

    const memKey = `${namespace}:${key}`;
    const memEntry = this.memoryFallback.get(memKey);
    return memEntry ? memEntry.data : null;
  }

  /**
   * Upserts data into the database stamped with today's date.
   * @param {string} key 
   * @param {any} data 
   * @param {string} namespace 
   * @param {string} [dateStr]
   * @returns {boolean}
   */
  set(key, data, namespace = 'default', dateStr = getTodayDateStr()) {
    const serialized = JSON.stringify(data);
    const now = Date.now();

    if (this.db) {
      try {
        const stmt = this.db.prepare(`
          INSERT INTO data_store (namespace, key, data, date_str, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(namespace, key) DO UPDATE SET
            data = excluded.data,
            date_str = excluded.date_str,
            updated_at = excluded.updated_at
        `);
        stmt.run(namespace, key, serialized, dateStr, now);
        return true;
      } catch (err) {
        console.warn(`[SqliteStore] Error writing ${namespace}:${key}:`, err.message);
      }
    }

    // Fallback to memory
    const memKey = `${namespace}:${key}`;
    this.memoryFallback.set(memKey, { data, date_str: dateStr, updated_at: now });
    return true;
  }

  /**
   * Deletes a record from DB.
   */
  delete(key, namespace = 'default') {
    if (this.db) {
      try {
        const stmt = this.db.prepare(`DELETE FROM data_store WHERE namespace = ? AND key = ?`);
        stmt.run(namespace, key);
      } catch {}
    }
    this.memoryFallback.delete(`${namespace}:${key}`);
  }

  /**
   * Clears an entire namespace.
   */
  clear(namespace = 'default') {
    if (this.db) {
      try {
        const stmt = this.db.prepare(`DELETE FROM data_store WHERE namespace = ?`);
        stmt.run(namespace);
      } catch {}
    }
    for (const k of this.memoryFallback.keys()) {
      if (k.startsWith(`${namespace}:`)) this.memoryFallback.delete(k);
    }
  }

  close() {
    if (this.db) {
      try {
        this.db.close();
      } catch {}
      this.db = null;
    }
  }
}

/**
 * Cloud Firestore Database Store for Deployed / Firebase Mode.
 */
export class FirestoreStore {
  constructor(options = {}) {
    this.projectId = options.projectId || process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'ai-growth-syntax';
    this.collectionName = options.collectionName || 'growth_syntax_store';
    this.firestore = null;
    this.memoryFallback = new Map();
    this._initialized = false;
  }

  async _ensureInit() {
    if (this._initialized) return;
    this._initialized = true;

    try {
      const { Firestore } = await import('@google-cloud/firestore');
      this.firestore = new Firestore({ projectId: this.projectId });
    } catch {
      this.firestore = null;
    }
  }

  _getDocId(key, namespace) {
    const cleanNs = namespace.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${cleanNs}__${cleanKey}`;
  }

  /**
   * Retrieves document from Firestore if stored today.
   */
  async get(key, namespace = 'default') {
    await this._ensureInit();
    const docId = this._getDocId(key, namespace);
    const today = getTodayDateStr();

    if (this.firestore) {
      try {
        const docRef = this.firestore.collection(this.collectionName).doc(docId);
        const snap = await docRef.get();
        if (!snap.exists) return null;
        const record = snap.data();
        if (record.date_str !== today) return null; // Expired (next day)
        return record.data;
      } catch (err) {
        console.warn(`[FirestoreStore] Error reading ${docId}:`, err.message);
      }
    }

    const memKey = `${namespace}:${key}`;
    const mem = this.memoryFallback.get(memKey);
    if (mem && mem.date_str === today) return mem.data;

    return null;
  }

  /**
   * Retrieves document regardless of date.
   */
  async getStale(key, namespace = 'default') {
    await this._ensureInit();
    const docId = this._getDocId(key, namespace);

    if (this.firestore) {
      try {
        const docRef = this.firestore.collection(this.collectionName).doc(docId);
        const snap = await docRef.get();
        if (!snap.exists) return null;
        const record = snap.data();
        return record.data;
      } catch {}
    }

    const memKey = `${namespace}:${key}`;
    const mem = this.memoryFallback.get(memKey);
    return mem ? mem.data : null;
  }

  /**
   * Sets document in Firestore.
   */
  async set(key, data, namespace = 'default', dateStr = getTodayDateStr()) {
    await this._ensureInit();
    const docId = this._getDocId(key, namespace);
    const payload = {
      namespace,
      key,
      data,
      date_str: dateStr,
      updated_at: Date.now()
    };

    if (this.firestore) {
      try {
        const docRef = this.firestore.collection(this.collectionName).doc(docId);
        await docRef.set(payload, { merge: true });
        return true;
      } catch (err) {
        console.warn(`[FirestoreStore] Error writing ${docId}:`, err.message);
      }
    }

    // Update memory fallback
    const memKey = `${namespace}:${key}`;
    this.memoryFallback.set(memKey, payload);
    return true;
  }

  async delete(key, namespace = 'default') {
    await this._ensureInit();
    const docId = this._getDocId(key, namespace);
    if (this.firestore) {
      try {
        await this.firestore.collection(this.collectionName).doc(docId).delete();
      } catch {}
    }
    this.memoryFallback.delete(`${namespace}:${key}`);
  }
}

/**
 * Helper to dynamically load node:sqlite without breaking bundlers or older runtimes.
 */
function requireNodeSqlite() {
  try {
    const sqlite = process.getBuiltinModule('node:sqlite');
    if (sqlite) return sqlite;
  } catch {}
  throw new Error('node:sqlite not available in this Node runtime');
}

let _dbInstance = null;

/**
 * Returns the appropriate database store based on current operational mode.
 * - FIREBASE mode -> FirestoreStore
 * - LOCAL / MCP mode -> SqliteStore
 * @returns {SqliteStore|FirestoreStore}
 */
export function getDatabase() {
  if (_dbInstance) return _dbInstance;

  const mode = getActiveMode();
  if (mode === APP_MODES.FIREBASE) {
    _dbInstance = new FirestoreStore();
  } else {
    _dbInstance = new SqliteStore();
  }

  return _dbInstance;
}

export const defaultDb = getDatabase();

export default {
  SqliteStore,
  FirestoreStore,
  getDatabase,
  defaultDb,
  getTodayDateStr,
  isToday
};

