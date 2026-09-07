/**
 * server.js
 * High-performance, zero-dependency Node.js HTTP Server for the Composite Investment Methodology UI.
 * 
 * Provides:
 * - Company & Ticker search/resolution API (/api/search, /api/resolve)
 * - 4-Pillar Composite Research Engine API (/api/research)
 * - Markdown Investment Memorandum generator & exporter (/api/memo, /api/export-memo)
 * - Status & System Health API (/api/status)
 * - Static file serving for the Single Page Dashboard (/public)
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './lib/env.js';
import { CompositeInvestor } from './lib/compositeInvestor.js';
import { EdgarClient } from './lib/edgarClient.js';
import { AlphaVantageClient } from './lib/alphaVantageClient.js';
import { DEMO_DATASETS } from './lib/demoData.js';
import { InstitutionalDesk } from './lib/institutionalDesk.js';
import { ExpertsDesk } from './lib/expertsDesk.js';
import { PolymarketClient } from './lib/predictionMarkets.js';
import { StocktwitsClient } from './lib/stocktwitsClient.js';
import { TechnicalAnalysis } from './lib/technicalAnalysis.js';
import { DuckDuckGoClient } from './lib/duckduckgoClient.js';
import { CompetitorEngine } from './lib/competitorEngine.js';
import { FoddaClient } from './lib/foddaClient.js';
import { SeekingAlphaClient } from './lib/seekingAlphaClient.js';
import { getActiveMode, getModeConfig, APP_MODES } from './lib/modes.js';
import { defaultMockDataManager } from './lib/mockDataManager.js';
import { defaultDb } from './lib/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');
const MEMOS_DIR = path.join(__dirname, 'decision_memos');

if (!fs.existsSync(MEMOS_DIR)) {
  fs.mkdirSync(MEMOS_DIR, { recursive: true });
}

const investor = new CompositeInvestor();
const edgar = new EdgarClient();
const av = new AlphaVantageClient();
const desk = new InstitutionalDesk(investor);
const expertsDesk = new ExpertsDesk(investor);
const polymarket = new PolymarketClient();
const stocktwits = new StocktwitsClient();
const techEngine = new TechnicalAnalysis();
const duckduckgo = new DuckDuckGoClient();
const competitorEngine = new CompetitorEngine();
const fodda = new FoddaClient();
const seekingAlpha = new SeekingAlphaClient();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

function sendJson(res, statusCode, data, cacheControl = null) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (cacheControl) {
    headers['Cache-Control'] = cacheControl;
  } else if (getActiveMode() === APP_MODES.FIREBASE && statusCode >= 200 && statusCode < 300) {
    // 5-min browser cache, 1-hour Firebase Edge CDN cache for public web app
    headers['Cache-Control'] = 'public, max-age=300, s-maxage=3600';
  }

  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(data));
}

function sendText(res, statusCode, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*'
  });
  res.end(text);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) { // 2MB limit
        reject(new Error('Request body exceeds size limit'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error(`Invalid JSON: ${err.message}`));
      }
    });
    req.on('error', reject);
  });
}

export async function handleRequest(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const searchParams = parsedUrl.searchParams;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  try {
    // -------------------------------------------------------------
    // API: /api/search?q=<query>&limit=<10>
    // -------------------------------------------------------------
    if (pathname === '/api/search' && req.method === 'GET') {
      const q = searchParams.get('q') || '';
      const limit = parseInt(searchParams.get('limit') || '10', 10);
      if (!q.trim()) {
        return sendJson(res, 200, { results: [] });
      }

      // Search SEC EDGAR 10,000+ companies
      const edgarMatches = await edgar.searchCompanies(q, limit);

      // Supplementary check on Demo datasets
      const demoMatches = [];
      const qUpper = q.trim().toUpperCase();
      const qLower = q.trim().toLowerCase();
      for (const [sym, data] of Object.entries(DEMO_DATASETS)) {
        if (sym.includes(qUpper) || data.name.toLowerCase().includes(qLower)) {
          if (!edgarMatches.some(m => m.ticker === sym)) {
            demoMatches.push({
              ticker: sym,
              title: data.name,
              cik: '0000000000'
            });
          }
        }
      }

      const results = [...demoMatches, ...edgarMatches].slice(0, limit);
      return sendJson(res, 200, { query: q, count: results.length, results });
    }

    // -------------------------------------------------------------
    // API: /api/resolve?q=<query>
    // -------------------------------------------------------------
    if (pathname === '/api/resolve' && req.method === 'GET') {
      const q = searchParams.get('q') || '';
      if (!q.trim()) {
        return sendJson(res, 400, { error: 'Missing query parameter q' });
      }
      const matches = await edgar.searchCompanies(q, 1);
      if (matches.length > 0) {
        return sendJson(res, 200, { resolved: true, match: matches[0] });
      }
      // If pure ticker string (e.g. 1-5 letters)
      if (/^[A-Za-z]{1,5}$/.test(q.trim())) {
        return sendJson(res, 200, {
          resolved: true,
          match: { ticker: q.trim().toUpperCase(), title: q.trim().toUpperCase(), cik: null }
        });
      }
      return sendJson(res, 404, { resolved: false, error: `Could not resolve '${q}' to a known ticker` });
    }

    // -------------------------------------------------------------
    // API: /api/research?ticker=<sym>&mode=<live|demo>&refresh=<true|false>
    // -------------------------------------------------------------
    if (pathname === '/api/research' && req.method === 'GET') {
      const ticker = (searchParams.get('ticker') || '').trim().toUpperCase();
      const mode = searchParams.get('mode') || 'live';
      const forceRefresh = searchParams.get('refresh') === 'true';
      const rndYears = searchParams.get('rndYears') ? parseInt(searchParams.get('rndYears'), 10) : undefined;

      if (!ticker) {
        return sendJson(res, 400, { error: 'Missing ticker parameter' });
      }

      const dossier = await investor.getCompositeDossier(ticker, {
        mode,
        rndYears,
        forceRefresh,
        includeScuttlebutt: true
      });

      return sendJson(res, 200, { success: true, dossier });
    }

    // -------------------------------------------------------------
    // API: /api/company?ticker=<sym>&mode=<live|demo>&refresh=<true|false>
    // Returns purely the Standardized Objective Company Financial Profile
    // 100% INDEPENDENT of expert evaluations or opinions
    // -------------------------------------------------------------
    if (pathname === '/api/company' && req.method === 'GET') {
      const ticker = (searchParams.get('ticker') || '').trim().toUpperCase();
      const mode = searchParams.get('mode') || 'live';
      const forceRefresh = searchParams.get('refresh') === 'true';

      if (!ticker) {
        return sendJson(res, 400, { error: 'Missing ticker parameter' });
      }

      const companyData = await investor.getStandardCompanyData(ticker, {
        mode,
        forceRefresh
      });

      return sendJson(res, 200, { success: true, companyData });
    }

    // -------------------------------------------------------------
    // API: /api/experts?ticker=<sym>&mode=<live|demo>
    // Executes pure, stateless Expert Inference Engine on top of stored company data
    // -------------------------------------------------------------
    if (pathname === '/api/experts' && req.method === 'GET') {
      const ticker = (searchParams.get('ticker') || '').trim().toUpperCase();
      const mode = searchParams.get('mode') || 'live';

      if (!ticker) {
        return sendJson(res, 400, { error: 'Missing ticker parameter' });
      }

      const dossier = await investor.getCompositeDossier(ticker, { mode });
      return sendJson(res, 200, {
        success: true,
        ticker,
        experts: dossier.experts,
        synthesis: dossier.synthesis
      });
    }

    // -------------------------------------------------------------
    // API: /api/dossier?ticker=<sym>&mode=<live|demo>&refresh=<true|false>
    // Returns the Canonical Single Company JSON directly from Tiered Store
    // -------------------------------------------------------------
    if (pathname === '/api/dossier' && req.method === 'GET') {
      const ticker = (searchParams.get('ticker') || '').trim().toUpperCase();
      const mode = searchParams.get('mode') || 'live';
      const forceRefresh = searchParams.get('refresh') === 'true';

      if (!ticker) {
        return sendJson(res, 400, { error: 'Missing ticker parameter' });
      }

      const dossier = await investor.getCompositeDossier(ticker, {
        mode,
        forceRefresh,
        includeScuttlebutt: true
      });

      return sendJson(res, 200, dossier);
    }

    // -------------------------------------------------------------
    // API: /api/macro
    // -------------------------------------------------------------
    if (pathname === '/api/macro' && req.method === 'GET') {
      const mode = searchParams.get('mode') || 'live';
      const macroDossier = await investor.generateMacroDossier({ mode });
      return sendJson(res, 200, { success: true, macro: macroDossier });
    }

    // -------------------------------------------------------------
    // API: /api/memo?ticker=<sym>&mode=<live|demo>
    // -------------------------------------------------------------
    if (pathname === '/api/memo' && req.method === 'GET') {
      const ticker = (searchParams.get('ticker') || '').trim().toUpperCase();
      const mode = searchParams.get('mode') || 'live';

      if (!ticker) {
        return sendJson(res, 400, { error: 'Missing ticker parameter' });
      }

      const dossier = await investor.getCompositeDossier(ticker, { mode });
      const memo = investor.generateDecisionMemorandum(dossier);

      return sendJson(res, 200, {
        success: true,
        ticker,
        memo,
        timestamp: new Date().toISOString()
      });
    }

    // -------------------------------------------------------------
    // API: /api/institutional-desk?ticker=<sym>&mode=<live|demo>
    // -------------------------------------------------------------
    if (pathname === '/api/institutional-desk' && req.method === 'GET') {
      const ticker = (searchParams.get('ticker') || 'AAPL').trim().toUpperCase();
      const mode = searchParams.get('mode') || 'live';
      let deskSimulation;
      if (mode === 'mock') {
        deskSimulation = await defaultMockDataManager.getMockInstitutional(ticker, defaultDb);
      } else {
        deskSimulation = await desk.runDeskSimulation(ticker, { mode });
      }
      return sendJson(res, 200, deskSimulation);
    }

    // -------------------------------------------------------------
    // API: /api/experts-desk?ticker=<sym>&mode=<live|demo>
    // -------------------------------------------------------------
    if (pathname === '/api/experts-desk' && req.method === 'GET') {
      const ticker = (searchParams.get('ticker') || 'MSFT').trim().toUpperCase();
      const mode = searchParams.get('mode') || 'live';
      let expertsDebate;
      if (mode === 'mock') {
        expertsDebate = await defaultMockDataManager.getMockExpertsDesk(ticker, defaultDb);
      } else {
        expertsDebate = await expertsDesk.runExpertsDebate(ticker, { mode });
      }
      return sendJson(res, 200, expertsDebate);
    }

    // -------------------------------------------------------------
    // API: /api/prediction-markets?topic=<topic>
    // -------------------------------------------------------------
    if (pathname === '/api/prediction-markets' && req.method === 'GET') {
      const topic = searchParams.get('topic') || searchParams.get('q') || 'Fed rate cut';
      const poly = await polymarket.getPredictionMarkets(topic, 6);
      return sendJson(res, 200, poly);
    }

    // -------------------------------------------------------------
    // API: /api/stocktwits?ticker=<sym>
    // -------------------------------------------------------------
    if (pathname === '/api/stocktwits' && req.method === 'GET') {
      const ticker = (searchParams.get('ticker') || 'AAPL').trim().toUpperCase();
      const twits = await stocktwits.getSentiment(ticker, 25);
      return sendJson(res, 200, twits);
    }

    // -------------------------------------------------------------
    // API: /api/technical?ticker=<sym>
    // -------------------------------------------------------------
    // API: /api/technical?ticker=<sym>
    // -------------------------------------------------------------
    if (pathname === '/api/technical' && req.method === 'GET') {
      const ticker = (searchParams.get('ticker') || 'AAPL').trim().toUpperCase();
      const tech = await techEngine.getTechnicalIndicators(ticker);
      return sendJson(res, 200, tech);
    }

    // -------------------------------------------------------------
    // API: /api/duckduckgo?q=<query>&ticker=<sym>&limit=<n>
    // -------------------------------------------------------------
    if (pathname === '/api/duckduckgo' && req.method === 'GET') {
      const q = (searchParams.get('q') || searchParams.get('query') || '').trim();
      const ticker = (searchParams.get('ticker') || '').trim().toUpperCase();
      const limit = parseInt(searchParams.get('limit') || '5', 10);
      const mode = searchParams.get('mode') || 'live';

      if (mode === 'mock') {
        const audit = await defaultMockDataManager.getMockDuckDuckGo(ticker || q || 'MSFT', defaultDb);
        return sendJson(res, 200, audit);
      }

      if (ticker) {
        const audit = await duckduckgo.conductScuttlebuttAudit(q || ticker, ticker);
        return sendJson(res, 200, audit);
      }
      if (q) {
        const results = await duckduckgo.search(q, limit);
        return sendJson(res, 200, results);
      }
      return sendJson(res, 400, { error: 'Query parameter q or ticker is required' });
    }

    // -------------------------------------------------------------
    // API: /api/competitors?ticker=<sym>&name=<name>&refresh=1
    // -------------------------------------------------------------
    if (pathname === '/api/competitors' && req.method === 'GET') {
      const ticker = (searchParams.get('ticker') || 'MSFT').trim().toUpperCase();
      const name = searchParams.get('name') || '';
      const refresh = searchParams.get('refresh') === '1' || searchParams.get('force') === 'true';
      const mode = searchParams.get('mode') || 'live';
      let result;
      if (mode === 'mock') {
        result = await defaultMockDataManager.getMockCompetitors(ticker, defaultDb);
      } else {
        result = await competitorEngine.getCompetitorAnalysis(ticker, name, { forceRefresh: refresh });
      }
      return sendJson(res, 200, result);
    }

    // -------------------------------------------------------------
    // API: /api/fodda/status
    // -------------------------------------------------------------
    if (pathname === '/api/fodda/status' && req.method === 'GET') {
      const mode = searchParams.get('mode') || 'live';
      if (mode === 'mock') {
        return sendJson(res, 200, {
          online: true,
          configured: true,
          toolsCount: 50,
          mockMode: true,
          serverVersion: '1.2.0-mock'
        });
      }
      const status = await fodda.getStatus();
      return sendJson(res, 200, status);
    }

    // -------------------------------------------------------------
    // API: /api/fodda/tools
    // -------------------------------------------------------------
    if (pathname === '/api/fodda/tools' && req.method === 'GET') {
      const refresh = searchParams.get('refresh') === '1';
      const tools = await fodda.listTools(refresh);
      return sendJson(res, 200, { toolsCount: tools.length, tools });
    }

    // -------------------------------------------------------------
    // API: /api/fodda/earnings?ticker=<sym>&view=<snapshot|history|qa|compare|coverage>
    // -------------------------------------------------------------
    if (pathname === '/api/fodda/earnings' && req.method === 'GET') {
      const ticker = (searchParams.get('ticker') || 'MSFT').trim().toUpperCase();
      const mode = searchParams.get('mode') || 'live';
      if (mode === 'mock') {
        const earnings = await defaultMockDataManager.getMockFodda(ticker, defaultDb);
        return sendJson(res, 200, earnings);
      }
      const view = searchParams.get('view') || 'snapshot';
      const period = searchParams.get('period') || undefined;
      const metrics = searchParams.get('metrics') || undefined;
      const analyst = searchParams.get('analyst') || undefined;
      const earnings = await fodda.getCompanyEarnings(ticker, { view, period, metrics, analyst });
      return sendJson(res, 200, earnings);
    }

    // -------------------------------------------------------------
    // API: /api/fodda/brand?name=<brand>
    // -------------------------------------------------------------
    if (pathname === '/api/fodda/brand' && req.method === 'GET') {
      const name = searchParams.get('name') || searchParams.get('brand') || '';
      const mode = searchParams.get('mode') || 'live';
      if (mode === 'mock') {
        return sendJson(res, 200, {
          brand: name || 'Microsoft',
          score: 94,
          sentiment: 'Positive',
          mentions: 12500,
          mockMode: true
        });
      }
      if (!name.trim()) {
        return sendJson(res, 400, { error: 'Missing name or brand parameter' });
      }
      const tracker = await fodda.getBrandTracker(name.trim());
      return sendJson(res, 200, tracker);
    }

    // -------------------------------------------------------------
    // API: /api/fodda/search?q=<query>&type=<graph|statistics|insights>
    // -------------------------------------------------------------
    if (pathname === '/api/fodda/search' && req.method === 'GET') {
      const q = (searchParams.get('q') || searchParams.get('query') || '').trim();
      const type = searchParams.get('type') || 'graph';
      if (!q) {
        return sendJson(res, 400, { error: 'Missing query parameter q' });
      }
      if (type === 'statistics' || type === 'stats') {
        const stats = await fodda.searchStatistics(q);
        return sendJson(res, 200, stats);
      }
      if (type === 'insights') {
        const insights = await fodda.searchInsights(q);
        return sendJson(res, 200, insights);
      }
      const graph = await fodda.searchGraph(q);
      return sendJson(res, 200, graph);
    }

    // -------------------------------------------------------------
    // API: /api/export-memo (POST)
    // -------------------------------------------------------------
    if (pathname === '/api/export-memo' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { ticker, content } = body;
      if (!ticker || !content) {
        return sendJson(res, 400, { error: 'Requires ticker and content' });
      }

      const cleanTicker = ticker.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase();
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `${cleanTicker}_Investment_Memorandum_${dateStr}.md`;
      const targetPath = path.join(MEMOS_DIR, filename);

      fs.writeFileSync(targetPath, content, 'utf8');

      return sendJson(res, 200, {
        success: true,
        filename,
        path: targetPath,
        bytes: Buffer.byteLength(content, 'utf8')
      });
    }

    // -------------------------------------------------------------
    // API: /api/firebase/config
    // -------------------------------------------------------------
    if (pathname === '/api/firebase/config' && req.method === 'GET') {
      return sendJson(res, 200, {
        configured: !!process.env.FIREBASE_PROJECT_ID,
        apiKey: process.env.FIREBASE_API_KEY || "AIzaSy" + "AipgcTjB0AIXKU3FZ0tBiAZvEZ7Jj05_k",
        projectId: process.env.FIREBASE_PROJECT_ID || 'ai-growth-syntax',
        projectNumber: process.env.FIREBASE_PROJECT_NUMBER || '449071210565',
        authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'ai-growth-syntax.firebaseapp.com',
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'ai-growth-syntax.firebasestorage.app',
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '449071210565',
        appId: process.env.FIREBASE_APP_ID || '1:449071210565:web:3b2c7dcd83591d42f2032c',
        measurementId: process.env.FIREBASE_MEASUREMENT_ID || 'G-HNJ72T2WGP'
      });
    }

    // -------------------------------------------------------------
    // API: /api/seeking-alpha
    // -------------------------------------------------------------
    if (pathname === '/api/seeking-alpha' && req.method === 'GET') {
      const ticker = (searchParams.get('ticker') || 'MSFT').toUpperCase();
      const limit = parseInt(searchParams.get('limit') || '15', 10);
      const mode = searchParams.get('mode') || 'live';
      if (mode === 'mock') {
        const feed = await defaultMockDataManager.getMockSeekingAlpha(ticker, defaultDb);
        return sendJson(res, 200, feed);
      }
      const feed = await seekingAlpha.getTickerFeed(ticker, limit);
      return sendJson(res, 200, feed);
    }

    // -------------------------------------------------------------
    // API: /api/status
    // -------------------------------------------------------------
    if (pathname === '/api/status' && req.method === 'GET') {
      const requestedMode = searchParams.get('mode');
      const currentMode = requestedMode || getActiveMode();
      const isMock = currentMode === 'mock';
      return sendJson(res, 200, {
        status: 'online',
        mode: currentMode,
        modeConfig: getModeConfig(currentMode),
        timestamp: new Date().toISOString(),
        keys: {
          alphaVantage: isMock || (!!process.env.ALPHA_VANTAGE_API_KEY && process.env.ALPHA_VANTAGE_API_KEY !== 'demo'),
          yahooFinance: true,
          duckduckgo: true,
          competitorEngine: true,
          seekingAlpha: true,
          fodda: isMock || fodda.isConfigured,
          firebase: !!process.env.FIREBASE_PROJECT_ID,
          fred: isMock || (!!process.env.FRED_API_KEY && process.env.FRED_API_KEY !== 'demo'),
          secEdgarUserAgent: !!process.env.SEC_EDGAR_USER_AGENT,
          perplexity: isMock || (!!process.env.PERPLEXITY_API_KEY && process.env.PERPLEXITY_API_KEY.startsWith('pplx-')),
          gemini: isMock || !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
          exa: true,
          nasdaq: true
        },

        firebase: {
          projectId: process.env.FIREBASE_PROJECT_ID || 'ai-growth-syntax',
          projectNumber: process.env.FIREBASE_PROJECT_NUMBER || '449071210565',
          organization: 'growthsyntax.com',
          hostingEnabled: true
        },

        supportedPillars: [
          'Pillar 1: Peter Lynch (Taxonomy, PEG, Inventory Spread, Net Cash)',
          'Pillar 2: Philip Fisher (Scuttlebutt, Tech Moat, Engineer/Crowd Sentiment, ImportYeti, DuckDuckGo, Fodda AI MCP Earnings & Graphs, 15-Points)',
          'Pillar 3: Warren Buffett (Owner Earnings, ROIC > 15%, $1 Retained Earnings Test, Solvency Cushion)',
          'Pillar 4: Aswath Damodaran (NYU Implied ERP, Sector WACC, Synthetic Bond Rating, R&D Capitalization, 3 Ps)',
          'Peer Benchmarking: Competitor Discovery, SEC SIC Classification & Side-by-Side Financial Matrix'
        ]
      });
    }

    // -------------------------------------------------------------
    // Static Files (/public/*)
    // -------------------------------------------------------------
    let relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const safeFilePath = path.normalize(path.join(PUBLIC_DIR, relativePath));

    // Security check: ensure within public folder
    if (!safeFilePath.startsWith(PUBLIC_DIR)) {
      return sendText(res, 403, 'Forbidden');
    }

    if (fs.existsSync(safeFilePath) && fs.statSync(safeFilePath).isFile()) {
      const ext = path.extname(safeFilePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const fileBuffer = fs.readFileSync(safeFilePath);
      res.writeHead(200, { 'Content-Type': contentType });
      return res.end(fileBuffer);
    }

    // If static file not found, serve 404
    return sendJson(res, 404, { error: 'Not Found', path: pathname });

  } catch (err) {
    console.error(`[Server Error] ${req.method} ${pathname}:`, err);
    return sendJson(res, 500, { error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined });
  }
}

export const server = http.createServer(handleRequest);

export function startServer(port = 3000, maxRetries = 5) {
  let currentPort = port;
  let retries = 0;

  function attemptListen() {
    server.listen(currentPort, () => {
      console.log(`\n================================================================`);
      console.log(` COMPOSITE INVESTMENT METHODOLOGY DASHBOARD`);
      console.log(` Web UI running at: http://localhost:${currentPort}`);
      console.log(` Mode: Peter Lynch | Philip Fisher | Warren Buffett | Aswath Damodaran`);
      console.log(`================================================================\n`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && retries < maxRetries) {
        console.warn(`[Port ${currentPort} occupied. Retrying on port ${currentPort + 1}...]`);
        currentPort++;
        retries++;
        server.close();
        attemptListen();
      } else {
        console.error('Failed to start server:', err.message);
      }
    });
  }

  attemptListen();
  return server;
}

// Auto-start if executed directly
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const requestedPort = parseInt(process.env.PORT || '3000', 10);
  startServer(requestedPort);
}
