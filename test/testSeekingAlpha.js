/**
 * testSeekingAlpha.js
 * Unit and integration tests for Seeking Alpha RSS Client.
 */

import assert from 'node:assert';
import { SeekingAlphaClient } from '../lib/seekingAlphaClient.js';

console.log('====================================================');
console.log(' SEEKING ALPHA RSS CLIENT TEST SUITE');
console.log('====================================================\n');

let passed = 0;
let total = 0;

async function testAsync(desc, fn) {
  total++;
  try {
    await fn();
    console.log(`✅ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${desc}`);
    console.error(err);
  }
}

const client = new SeekingAlphaClient();

await testAsync('SeekingAlphaClient: Fetches and parses live RSS feed for MSFT', async () => {
  const feed = await client.getTickerFeed('MSFT', 10);
  assert.strictEqual(feed.success, true);
  assert.strictEqual(feed.ticker, 'MSFT');
  assert.ok(Array.isArray(feed.articles));
  assert.ok(feed.articles.length > 0, 'Should return articles');

  const first = feed.articles[0];
  assert.ok(first.title, 'Article should have title');
  assert.ok(first.link?.startsWith('https://seekingalpha.com'), 'Article should have valid Seeking Alpha link');
  assert.ok(first.pubDate, 'Article should have pubDate');
  assert.ok(first.timeAgo, 'Article should have relative time string');
  assert.ok(first.author, 'Article should have author name');
  assert.ok(['Analyst Research', 'Breaking News', 'Insider Form 4', 'Earnings & Filings'].includes(first.category));
  assert.ok(['Bullish', 'Bearish', 'Neutral'].includes(first.sentiment));
});

await testAsync('SeekingAlphaClient: Fallback dataset when offline or errored', async () => {
  const fallback = client._getFallbackFeed('NVDA');
  assert.strictEqual(fallback.success, true);
  assert.strictEqual(fallback.ticker, 'NVDA');
  assert.ok(fallback.articles.length >= 3);
  assert.strictEqual(fallback.articles[0].category, 'Analyst Research');
});

await testAsync('SeekingAlphaClient: Market-wide feed parsing', async () => {
  const market = await client.getMarketNews(5);
  assert.strictEqual(market.success, true);
  assert.ok(Array.isArray(market.articles));
});

console.log(`\n====================================================`);
console.log(`TEST RESULTS: ${passed}/${total} PASSED`);
console.log('====================================================\n');

if (passed !== total) {
  process.exit(1);
}
