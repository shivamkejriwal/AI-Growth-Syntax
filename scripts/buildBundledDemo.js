import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CompositeInvestor } from '../lib/compositeInvestor.js';
import { CompetitorEngine } from '../lib/competitorEngine.js';
import { InstitutionalDesk } from '../lib/institutionalDesk.js';
import { ExpertsDesk } from '../lib/expertsDesk.js';
import { defaultMockDataManager } from '../lib/mockDataManager.js';
import { DEMO_DATASETS } from '../lib/demoData.js';
import { defaultCompanyAnalysisOrchestrator } from '../lib/companyAnalysisOrchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_FILE = path.join(__dirname, '..', 'public', 'bundled-demo.js');

async function build() {
  console.log('Building bundled-demo.js for Firebase Static Web Mode...');
  const investor = new CompositeInvestor();
  const competitorEngine = new CompetitorEngine();
  const institutionalDesk = new InstitutionalDesk();
  const expertsDesk = new ExpertsDesk();

  const tickers = ['MSFT', 'AAPL', 'NVDA', 'TSLA', 'AMZN'];
  const dossiers = {};
  const memos = {};
  const competitors = {};
  const desk = {};
  const experts = {};
  const fodda = {};
  const seekingAlpha = {};
  const ddg = {};
  const companyAnalysis = {};

  for (const ticker of tickers) {
    console.log(`- Compiling ${ticker}...`);
    try {
      const mockData = DEMO_DATASETS[ticker];
      const d = await investor.generateCompositeDossier(ticker, { offlineData: mockData, mode: 'mock' });
      
      ddg[ticker] = defaultMockDataManager._buildMockDuckDuckGoAudit(ticker);
      fodda[ticker] = defaultMockDataManager._buildMockFoddaEarnings(ticker);
      seekingAlpha[ticker] = defaultMockDataManager._buildMockSeekingAlphaFeed(ticker);

      if (d?.pillar2_Fisher) {
        d.pillar2_Fisher.duckduckgoIntel = ddg[ticker];
        d.pillar2_Fisher.seekingAlphaIntel = seekingAlpha[ticker];
        d.pillar2_Fisher.foddaIntel = fodda[ticker];
      }

      dossiers[ticker] = d;
      memos[ticker] = investor.generateMarkdownMemorandum(d);
      competitors[ticker] = await competitorEngine.getCompetitorAnalysis(ticker, d.metadata?.name);
      
      try {
        desk[ticker] = await institutionalDesk.runDeskSimulation(ticker, { mode: 'demo' });
      } catch {
        desk[ticker] = defaultMockDataManager._buildFallbackInstitutionalDesk(ticker);
      }

      try {
        experts[ticker] = await expertsDesk.runExpertsDebate(ticker, { mode: 'demo' });
      } catch {
        experts[ticker] = defaultMockDataManager._buildFallbackExpertsDebate(ticker);
      }

      try {
        companyAnalysis[ticker] = await defaultCompanyAnalysisOrchestrator.runAnalysis(ticker, { mode: 'demo' });
      } catch (caErr) {
        console.warn(`Error compiling company analysis for ${ticker}:`, caErr.message);
      }
    } catch (e) {
      console.warn(`Error compiling ${ticker}:`, e.message);
    }
  }

  const macro = await investor.fred.getMacroSnapshot();

  const content = `/**
 * bundled-demo.js
 * Precompiled static datasets for Firebase Web App Mode (fallback when serverless backend is not running).
 * Generated: ${new Date().toISOString()}
 */

export const BUNDLED_DEMO = {
  macro: ${JSON.stringify(macro, null, 2)},
  dossiers: ${JSON.stringify(dossiers, null, 2)},
  memos: ${JSON.stringify(memos, null, 2)},
  competitors: ${JSON.stringify(competitors, null, 2)},
  desk: ${JSON.stringify(desk, null, 2)},
  experts: ${JSON.stringify(experts, null, 2)},
  fodda: ${JSON.stringify(fodda, null, 2)},
  seekingAlpha: ${JSON.stringify(seekingAlpha, null, 2)},
  ddg: ${JSON.stringify(ddg, null, 2)},
  companyAnalysis: ${JSON.stringify(companyAnalysis, null, 2)}
};

export default BUNDLED_DEMO;
`;

  fs.writeFileSync(OUT_FILE, content, 'utf8');
  console.log(`Successfully compiled ${OUT_FILE} (${(content.length / 1024).toFixed(1)} KB)`);
}

build().catch(console.error);

