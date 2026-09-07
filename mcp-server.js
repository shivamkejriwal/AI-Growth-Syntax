#!/usr/bin/env node
/**
 * mcp-server.js
 * Native, zero-dependency Model Context Protocol (MCP) Server for AI-Growth-Syntax.
 * Protocol: JSON-RPC 2.0 over stdio (specification 2024-11-05).
 * 
 * Provides:
 * 1. analyze_company: 4-pillar investment research dossier (Lynch, Fisher, Buffett, Damodaran)
 * 2. get_investment_memo: Full institutional markdown investment decision memorandum
 * 3. get_competitors: Peer discovery, SEC SIC classification & relative valuation matrix
 * 4. get_macro_snapshot: FRED macroeconomic context (10Y yield, CPI, Fed Funds, ERP)
 * 5. simulate_trading_desk: 6-stage institutional desk debate & PM order proposal
 */

import readline from 'node:readline';
import './lib/env.js';
import { CompositeInvestor } from './lib/compositeInvestor.js';
import { CompetitorEngine } from './lib/competitorEngine.js';
import { InstitutionalDesk } from './lib/institutionalDesk.js';
import { ExpertsDesk } from './lib/expertsDesk.js';
import { EdgarClient } from './lib/edgarClient.js';
import { FoddaClient } from './lib/foddaClient.js';
import { DEMO_DATASETS } from './lib/demoData.js';

const investor = new CompositeInvestor();
const competitorEngine = new CompetitorEngine();
const desk = new InstitutionalDesk(investor);
const expertsDesk = new ExpertsDesk(investor);
const edgar = new EdgarClient();
const fodda = new FoddaClient();

const SERVER_INFO = {
  name: 'ai-growth-syntax-mcp',
  version: '1.0.0'
};

const TOOLS = [
  {
    name: 'analyze_company',
    description: 'Generates a comprehensive 4-pillar investment research dossier (Peter Lynch taxonomy, Philip Fisher scuttlebutt & tech moat, Warren Buffett owner earnings & ROIC, Aswath Damodaran cost of capital & 3 Ps filter). Returns full JSON dossier with valuation metrics, visual scorecard data, and executive synthesis.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Equity ticker symbol (e.g. MSFT, AAPL, NVDA, TSLA, RKLB)'
        },
        mode: {
          type: 'string',
          enum: ['live', 'demo'],
          description: 'Data ingestion mode: "live" (real-time APIs) or "demo" (fast cached benchmark data). Default: "live"'
        }
      },
      required: ['ticker']
    }
  },
  {
    name: 'get_investment_memo',
    description: 'Generates a formatted Markdown Investment Decision Memorandum for an equity, structured to Section 6 of the Composite Investment Approach framework.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Equity ticker symbol (e.g. MSFT, AAPL, NVDA)'
        },
        mode: {
          type: 'string',
          enum: ['live', 'demo'],
          description: 'Data ingestion mode: "live" or "demo"'
        }
      },
      required: ['ticker']
    }
  },
  {
    name: 'get_competitors',
    description: 'Discovers direct competitors and peer benchmarking matrix for a given ticker based on SEC SIC classification, industry peers, and relative financial multiples.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Equity ticker symbol (e.g. RKLB, MSFT, TSLA)'
        }
      },
      required: ['ticker']
    }
  },
  {
    name: 'get_macro_snapshot',
    description: 'Retrieves live macroeconomic benchmark context from FRED: 10-year Treasury yield (Rf), CPI inflation, Effective Fed Funds rate, BBB corporate credit spread, yield curve regime, and NYU Stern Implied Equity Risk Premium (ERP).',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'simulate_trading_desk',
    description: 'Simulates a 6-stage institutional trading desk debate: Specialist Domain Analysts -> Bull vs Bear Adversarial Debate -> Research Manager Synthesis -> Trader Order Proposal (ATR Stop-Loss) -> Risk Committee -> Portfolio Manager Sign-Off.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Equity ticker symbol (e.g. MSFT, TSLA)'
        }
      },
      required: ['ticker']
    }
  }
];

function sendJsonRpcResponse(id, result, error = null) {
  const response = {
    jsonrpc: '2.0',
    id
  };
  if (error) {
    response.error = error;
  } else {
    response.result = result;
  }
  process.stdout.write(JSON.stringify(response) + '\n');
}

async function handleToolCall(name, args = {}) {
  switch (name) {
    case 'analyze_company': {
      const ticker = (args.ticker || '').toUpperCase().trim();
      if (!ticker) throw new Error('ticker is required');
      const isDemo = args.mode === 'demo';
      const dossier = await investor.generateCompositeDossier(ticker, {
        offlineMode: isDemo,
        offlineData: isDemo ? DEMO_DATASETS[ticker] : undefined
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(dossier, null, 2)
          }
        ]
      };
    }

    case 'get_investment_memo': {
      const ticker = (args.ticker || '').toUpperCase().trim();
      if (!ticker) throw new Error('ticker is required');
      const isDemo = args.mode === 'demo';
      const dossier = await investor.generateCompositeDossier(ticker, {
        offlineMode: isDemo,
        offlineData: isDemo ? DEMO_DATASETS[ticker] : undefined
      });
      const memo = investor.generateMarkdownMemorandum(dossier);
      return {
        content: [
          {
            type: 'text',
            text: memo
          }
        ]
      };
    }

    case 'get_competitors': {
      const ticker = (args.ticker || '').toUpperCase().trim();
      if (!ticker) throw new Error('ticker is required');
      const analysis = await competitorEngine.getCompetitorAnalysis(ticker);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(analysis, null, 2)
          }
        ]
      };
    }

    case 'get_macro_snapshot': {
      const macro = await investor.fred.getMacroSnapshot();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(macro, null, 2)
          }
        ]
      };
    }

    case 'simulate_trading_desk': {
      const ticker = (args.ticker || '').toUpperCase().trim();
      if (!ticker) throw new Error('ticker is required');
      const simulation = await desk.simulateTradingDesk(ticker);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(simulation, null, 2)
          }
        ]
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function handleMessage(line) {
  const trimmed = line.trim();
  if (!trimmed) return;

  let request;
  try {
    request = JSON.parse(trimmed);
  } catch (err) {
    sendJsonRpcResponse(null, null, {
      code: -32700,
      message: `Parse error: ${err.message}`
    });
    return;
  }

  const { id, method, params } = request;

  try {
    switch (method) {
      case 'initialize':
        sendJsonRpcResponse(id, {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: SERVER_INFO
        });
        break;

      case 'notifications/initialized':
        // No response needed for notification
        break;

      case 'ping':
        sendJsonRpcResponse(id, {});
        break;

      case 'tools/list':
        sendJsonRpcResponse(id, {
          tools: TOOLS
        });
        break;

      case 'tools/call': {
        const { name, arguments: toolArgs } = params || {};
        const result = await handleToolCall(name, toolArgs || {});
        sendJsonRpcResponse(id, result);
        break;
      }

      default:
        if (id !== undefined && id !== null) {
          sendJsonRpcResponse(id, null, {
            code: -32601,
            message: `Method not found: ${method}`
          });
        }
        break;
    }
  } catch (err) {
    if (id !== undefined && id !== null) {
      sendJsonRpcResponse(id, null, {
        code: -32603,
        message: `Internal error: ${err.message}`
      });
    }
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', handleMessage);
rl.on('close', () => {
  process.exit(0);
});
