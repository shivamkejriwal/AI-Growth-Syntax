/**
 * foddaClient.js
 * High-performance, zero-dependency Model Context Protocol (MCP) Client for Fodda AI.
 * Endpoint: https://mcp.fodda.ai/mcp
 * 
 * Provides financial research tools including:
 * - Company Earnings Intelligence (transcripts, management tone, Q&A directness, analyst concerns)
 * - Brand Intelligence & Graph Footprint (curated trend graphs, competitive positioning)
 * - Quantitative Sector Statistics & Qualitative Expert Insights
 * 
 * Protocol: JSON-RPC 2.0 over HTTP/SSE with Mcp-Session-Id state tracking.
 */

import './env.js';
import { DiskCache, defaultCache } from './cache.js';

export class FoddaClient {
  /**
   * @param {Object} [options]
   * @param {string} [options.apiKey]
   * @param {string} [options.baseUrl]
   * @param {DiskCache} [options.cache]
   * @param {number} [options.cacheTtlMs]
   */
  constructor(options = {}) {
    this.apiKey = (options.apiKey || process.env.FODDA_API_KEY || '').trim();
    this.baseUrl = (options.baseUrl || process.env.FODDA_MCP_URL || 'https://mcp.fodda.ai/mcp').trim();
    this.cache = options.cache || defaultCache;
    this.cacheTtlMs = options.cacheTtlMs ?? 4 * 60 * 60 * 1000; // 4 hours default
    this.sessionId = null;
    this.serverInfo = null;
    this.capabilities = null;
    this.reqId = 1;
    this.isInitializing = null;
  }

  get isConfigured() {
    return Boolean(this.apiKey && this.apiKey.length > 5);
  }

  /**
   * Ensures an active MCP session with Fodda AI.
   * Performs handshake (initialize -> notifications/initialized) if no session exists.
   */
  async ensureSession() {
    if (this.sessionId) return this.sessionId;
    if (this.isInitializing) return this.isInitializing;

    this.isInitializing = (async () => {
      try {
        const headers = {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        };

        const authKey = this.apiKey || 'anonymous_discovery';
        headers['X-API-Key'] = authKey;

        const initPayload = {
          jsonrpc: '2.0',
          id: this.reqId++,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: { listChanged: true }
            },
            clientInfo: {
              name: 'composite-investment-engine',
              version: '1.0.0'
            }
          }
        };

        const res = await fetch(this.baseUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(initPayload)
        });

        const sessionId = res.headers.get('mcp-session-id');
        if (!sessionId) {
          throw new Error(`Fodda MCP handshake did not return Mcp-Session-Id header (HTTP ${res.status})`);
        }

        this.sessionId = sessionId;

        const rawText = await res.text();
        const initData = this._parseRpcResponse(rawText);
        if (initData?.result) {
          this.serverInfo = initData.result.serverInfo || null;
          this.capabilities = initData.result.capabilities || null;
        }

        // Send notifications/initialized per MCP specification
        await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'X-API-Key': authKey,
            'Mcp-Session-Id': this.sessionId
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'notifications/initialized'
          })
        }).catch(() => {});

        return this.sessionId;
      } catch (err) {
        this.sessionId = null;
        throw err;
      } finally {
        this.isInitializing = null;
      }
    })();

    return this.isInitializing;
  }

  /**
   * Parses JSON-RPC responses formatted as raw JSON or Server-Sent Events (data: {...}).
   * @private
   */
  _parseRpcResponse(text) {
    if (!text) return null;
    const clean = text.trim();
    if (clean.startsWith('{')) {
      try {
        return JSON.parse(clean);
      } catch {
        // fallback to SSE line scan
      }
    }

    const lines = clean.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data:')) {
        const jsonStr = trimmed.slice(5).trim();
        try {
          return JSON.parse(jsonStr);
        } catch {
          continue;
        }
      }
    }
    return null;
  }

  /**
   * Executes a JSON-RPC method over HTTP/SSE with automatic session reconnection.
   * @param {string} method
   * @param {Object} [params]
   */
  async sendRpc(method, params = {}) {
    const sessionId = await this.ensureSession();
    const authKey = this.apiKey || 'anonymous_handshake';

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'X-API-Key': authKey,
      'Mcp-Session-Id': sessionId
    };

    const payload = {
      jsonrpc: '2.0',
      id: this.reqId++,
      method,
      params
    };

    let res = await fetch(this.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    // If session expired or invalid, reset and retry once
    if (res.status === 400 || res.status === 404) {
      const errText = await res.text();
      if (errText.includes('Session required') || errText.includes('Session not found')) {
        this.sessionId = null;
        const newSessionId = await this.ensureSession();
        headers['Mcp-Session-Id'] = newSessionId;
        res = await fetch(this.baseUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
      } else {
        const parsed = this._parseRpcResponse(errText);
        throw new Error(parsed?.error?.message || `Fodda HTTP ${res.status}: ${errText}`);
      }
    }

    const raw = await res.text();
    const data = this._parseRpcResponse(raw);

    if (!data) {
      throw new Error(`Unable to parse response from Fodda MCP (${res.status}): ${raw.slice(0, 150)}`);
    }

    if (data.error) {
      throw new Error(data.error.message || JSON.stringify(data.error));
    }

    return data.result;
  }

  /**
   * Retrieves server health, capabilities, and tool status.
   */
  async getStatus() {
    try {
      await this.ensureSession();
      const tools = await this.listTools();
      return {
        online: true,
        configured: this.isConfigured,
        serverInfo: this.serverInfo || { name: 'fodda_mcp', version: '1.46.x' },
        toolsCount: tools.length,
        sessionId: this.sessionId,
        endpoint: this.baseUrl,
        authRequired: !this.isConfigured,
        note: this.isConfigured 
          ? 'Authenticated Fodda AI integration active.' 
          : 'Connected to Fodda MCP server in discovery mode. Add FODDA_API_KEY from https://app.fodda.ai to enable live tool data.'
      };
    } catch (err) {
      return {
        online: false,
        configured: this.isConfigured,
        error: err.message,
        endpoint: this.baseUrl,
        note: 'Could not connect to Fodda MCP server.'
      };
    }
  }

  /**
   * Lists all available tools from the Fodda MCP server.
   * @param {boolean} [forceRefresh=false]
   */
  async listTools(forceRefresh = false) {
    const cacheKey = 'FODDA_TOOLS_LIST';
    const namespace = 'fodda';

    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey, namespace, 24 * 60 * 60 * 1000);
      if (cached) return cached;
    }

    try {
      const result = await this.sendRpc('tools/list', {});
      const tools = result?.tools || [];
      if (tools.length > 0) {
        this.cache.set(cacheKey, tools, namespace);
      }
      return tools;
    } catch (err) {
      console.warn(`[Fodda MCP] Failed to list tools: ${err.message}`);
      const stale = this.cache.getStale(cacheKey, namespace);
      return stale || [];
    }
  }

  /**
   * Calls an arbitrary MCP tool on Fodda AI.
   * @param {string} name
   * @param {Object} [args]
   */
  async callTool(name, args = {}) {
    if (!this.isConfigured) {
      return {
        success: false,
        error: 'FODDA_API_KEY is not configured. Add your API key to .env from https://app.fodda.ai to execute live tools.',
        isDemo: true
      };
    }

    try {
      const result = await this.sendRpc('tools/call', {
        name,
        arguments: args
      });

      // Format MCP tool content
      const content = result?.content || [];
      let textOutput = '';
      for (const item of content) {
        if (item.type === 'text' && item.text) {
          textOutput += item.text;
        }
      }

      let parsed = null;
      try {
        parsed = JSON.parse(textOutput);
      } catch {
        parsed = textOutput;
      }

      return {
        success: !result?.isError,
        data: parsed,
        raw: result
      };
    } catch (err) {
      console.warn(`[Fodda MCP] Tool '${name}' execution error: ${err.message}`);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Fetches earnings intelligence for a specific ticker.
   * @param {string} ticker Company ticker symbol (e.g. MSFT, AAPL, RKLB)
   * @param {Object} [options]
   * @param {'snapshot'|'history'|'qa'|'compare'|'coverage'|'guidance'} [options.view='snapshot']
   * @param {string} [options.period] e.g. 'Q1-2026'
   * @param {string} [options.metrics] comma-separated metrics
   * @param {string} [options.analyst] analyst name filter
   */
  async getCompanyEarnings(ticker, options = {}) {
    const sym = (ticker || '').trim().toUpperCase();
    const view = options.view || 'snapshot';
    const cacheKey = `FODDA_EARNINGS_${sym}_${view}_${options.period || 'LATEST'}`;
    const namespace = 'fodda';

    const cached = this.cache.get(cacheKey, namespace, this.cacheTtlMs);
    if (cached) return cached;

    if (!this.isConfigured) {
      const fallback = {
        ticker: sym,
        view,
        available: false,
        source: 'fodda_mcp',
        message: 'Fodda AI Earnings Intelligence is available via MCP. Add FODDA_API_KEY to .env to unlock AI transcript intelligence, management sentiment, and Q&A directness scoring.',
        data: null
      };
      return fallback;
    }

    const toolArgs = {
      ticker: sym,
      view,
      mode: view
    };
    if (options.period) toolArgs.period = options.period;
    if (options.metrics) toolArgs.metrics = options.metrics;
    if (options.analyst) toolArgs.analyst = options.analyst;

    const result = await this.callTool('get_company_earnings', toolArgs);
    if (result.success && result.data) {
      const payload = {
        ticker: sym,
        view,
        available: true,
        source: 'fodda_mcp',
        data: result.data,
        timestamp: new Date().toISOString()
      };
      this.cache.set(cacheKey, payload, namespace);
      return payload;
    }

    const stale = this.cache.getStale(cacheKey, namespace);
    if (stale) return stale;

    return {
      ticker: sym,
      view,
      available: false,
      error: result.error || 'Failed to fetch earnings from Fodda MCP',
      source: 'fodda_mcp'
    };
  }

  /**
   * Builds a complete Brand Intelligence Profile across Fodda's knowledge graphs.
   * @param {string} brandName Name of brand/company (e.g. 'Rocket Lab', 'Microsoft')
   */
  async getBrandTracker(brandName) {
    const cleanBrand = (brandName || '').trim();
    if (!cleanBrand) return null;

    const cacheKey = `FODDA_BRAND_${cleanBrand.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
    const namespace = 'fodda';

    const cached = this.cache.get(cacheKey, namespace, this.cacheTtlMs);
    if (cached) return cached;

    if (!this.isConfigured) {
      return {
        brand: cleanBrand,
        available: false,
        source: 'fodda_mcp',
        message: 'Brand Intelligence Graph tracking available via Fodda MCP. Configure FODDA_API_KEY in .env.'
      };
    }

    const result = await this.callTool('brand_tracker', {
      brand_name: cleanBrand,
      include_evidence: true,
      max_evidence: 10
    });

    if (result.success && result.data) {
      const payload = {
        brand: cleanBrand,
        available: true,
        source: 'fodda_mcp',
        data: result.data,
        timestamp: new Date().toISOString()
      };
      this.cache.set(cacheKey, payload, namespace);
      return payload;
    }

    const stale = this.cache.getStale(cacheKey, namespace);
    if (stale) return stale;

    return {
      brand: cleanBrand,
      available: false,
      error: result.error || 'Failed to fetch brand tracker profile',
      source: 'fodda_mcp'
    };
  }

  /**
   * Searches expert knowledge graphs for trends, market signals, and consumer shifts.
   * @param {string} query
   */
  async searchGraph(query) {
    if (!this.isConfigured) return { available: false, query, results: [] };
    const res = await this.callTool('search_graph', { query });
    return {
      available: res.success,
      query,
      results: res.data || []
    };
  }

  /**
   * Queries quantitative statistics and market size data.
   * @param {string} query
   */
  async searchStatistics(query) {
    if (!this.isConfigured) return { available: false, query, statistics: [] };
    const res = await this.callTool('search_statistics', { query });
    return {
      available: res.success,
      query,
      statistics: res.data || []
    };
  }

  /**
   * Queries expert narrative insights and strategic commentary.
   * @param {string} query
   */
  async searchInsights(query) {
    if (!this.isConfigured) return { available: false, query, insights: [] };
    const res = await this.callTool('search_insights', { query });
    return {
      available: res.success,
      query,
      insights: res.data || []
    };
  }
}
