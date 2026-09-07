import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CompositeInvestor } from '../lib/compositeInvestor.js';
import { CompetitorEngine } from '../lib/competitorEngine.js';
import { DEMO_DATASETS } from '../lib/demoData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_FILE = path.join(__dirname, '..', 'public', 'bundled-demo.js');

async function build() {
  console.log('Building bundled-demo.js for Firebase Static Web Mode...');
  const investor = new CompositeInvestor();
  const competitorEngine = new CompetitorEngine();

  const tickers = ['MSFT', 'AAPL', 'NVDA', 'TSLA', 'AMZN'];
  const dossiers = {};
  const memos = {};
  const competitors = {};

  for (const ticker of tickers) {
    console.log(`- Compiling ${ticker}...`);
    try {
      const mockData = DEMO_DATASETS[ticker];
      const d = await investor.generateCompositeDossier(ticker, { offlineData: mockData });
      dossiers[ticker] = d;
      memos[ticker] = investor.generateMarkdownMemorandum(d);
      competitors[ticker] = await competitorEngine.getCompetitorAnalysis(ticker, d.metadata?.name);
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
  competitors: ${JSON.stringify(competitors, null, 2)}
};

export default BUNDLED_DEMO;
`;

  fs.writeFileSync(OUT_FILE, content, 'utf8');
  console.log(`Successfully compiled ${OUT_FILE} (${(content.length / 1024).toFixed(1)} KB)`);
}

build().catch(console.error);
