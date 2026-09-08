/**
 * index.js
 * Main entry point for Investing/My_App.
 * 
 * Exports:
 * - AlphaVantageClient
 * - EdgarClient
 * - FredClient
 * - CompositeInvestor
 * - DiskCache
 * - loadEnv
 */

export { AlphaVantageClient, safeFloat, roundVal } from './lib/alphaVantageClient.js';
export { EdgarClient } from './lib/edgarClient.js';
export { FredClient } from './lib/fredClient.js';
export { ScuttlebuttClient } from './lib/scuttlebuttClient.js';
export { DamodaranClient } from './lib/damodaranClient.js';
export { PerplexityClient } from './lib/perplexityClient.js';
export { GeminiClient } from './lib/geminiClient.js';
export { NasdaqClient } from './lib/nasdaqClient.js';
export { ExaClient } from './lib/exaClient.js';
export { DuckDuckGoClient } from './lib/duckduckgoClient.js';
export { CompetitorEngine } from './lib/competitorEngine.js';
export { FoddaClient } from './lib/foddaClient.js';
export { CongressionalClient } from './lib/congressionalClient.js';
export { InstitutionalHoldingsClient } from './lib/institutionalHoldingsClient.js';
export { CompositeInvestor, formatCurrency } from './lib/compositeInvestor.js';
export { getDemoFinancials, DEMO_DATASETS } from './lib/demoData.js';
export { DiskCache, defaultCache } from './lib/cache.js';
export { loadEnv } from './lib/env.js';
export { startServer } from './server.js';


