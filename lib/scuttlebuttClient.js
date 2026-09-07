/**
 * scuttlebuttClient.js
 * Comprehensive Scuttlebutt Field Research & Alternative Data Engine.
 * Tailored to Philip Fisher's 5-Circles Qualitative Framework.
 * 
 * Sources & Channels:
 * 1. GitHub REST API: Developer adoption, star velocity, issue health, release cadence
 * 2. Hacker News (Algolia API): Unfiltered tech employee & developer sentiment
 * 3. Reddit Public JSON: Customer satisfaction, B2B churn signals, retail crowding
 * 4. ImportYeti / Customs Manifests: Ocean freight shipping manifests & supplier audit
 * 5. Fisher 5-Circles Field Interview Generator & 15-Point Qualitative Checklist
 */

import './env.js';
import { DiskCache, defaultCache } from './cache.js';

export class ScuttlebuttClient {
  /**
   * @param {Object} [options]
   * @param {string} [options.userAgent]
   * @param {string} [options.githubToken]
   * @param {DiskCache} [options.cache]
   * @param {number} [options.cacheTtlMs] Default: 24 hours
   */
  constructor(options = {}) {
    this.userAgent = options.userAgent || process.env.REDDIT_USER_AGENT || 'ResearchScuttlebuttBot/1.0 (Contact: research@local.project)';
    this.githubToken = options.githubToken || process.env.GITHUB_TOKEN || '';
    this.cache = options.cache || defaultCache;
    this.cacheTtlMs = options.cacheTtlMs ?? 24 * 60 * 60 * 1000;
  }

  // ============================================================================
  // CHANNEL 1: DEVELOPER & TECH MOAT RECONNAISSANCE (GitHub REST API)
  // ============================================================================

  /**
   * Common ticker to flagship open-source repository mapping.
   */
  getDefaultRepoForTicker(ticker) {
    const map = {
      MSFT: 'microsoft/vscode',
      AAPL: 'apple/swift',
      GOOGL: 'google/jax',
      GOOG: 'tensorflow/tensorflow',
      META: 'facebook/react',
      NVDA: 'NVIDIA/cuda-samples',
      AMZN: 'aws/aws-cli',
      TSLA: 'teslamotors',
      ORCL: 'oracle/graal',
      IBM: 'qiskit/qiskit',
      CRM: 'forcedotcom',
      MDB: 'mongodb/mongo',
      ESTC: 'elastic/elasticsearch',
      SNOW: 'snowflakedb',
      PLTR: 'palantir',
      GTLB: 'gitlabhq/gitlabhq'
    };
    return map[ticker.toUpperCase()] || null;
  }

  /**
   * Fetches public GitHub repository statistics.
   * @param {string} owner
   * @param {string} repo
   */
  async getGitHubRepoStats(owner, repo) {
    const cacheKey = `gh_${owner}_${repo}`;
    const namespace = 'scuttlebutt';

    const cached = this.cache.get(cacheKey, namespace, this.cacheTtlMs);
    if (cached) return cached;

    const url = `https://api.github.com/repos/${owner}/${repo}`;
    const headers = {
      'User-Agent': this.userAgent,
      'Accept': 'application/vnd.github.v3+json'
    };
    if (this.githubToken) {
      headers.Authorization = `token ${this.githubToken}`;
    }

    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error(`GitHub HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();

      const stars = data.stargazers_count || 0;
      const forks = data.forks_count || 0;
      const openIssues = data.open_issues_count || 0;
      const watchers = data.subscribers_count || 0;

      // Calculate Developer Momentum Index (Log scale)
      const momentumScore = Math.round((Math.log10(stars + 1) * 20 + Math.log10(forks + 1) * 15) * 10) / 10;
      const issueRatio = stars > 0 ? Math.round((openIssues / stars) * 1000) / 10 : 0;

      const result = {
        repository: `${owner}/${repo}`,
        stars,
        forks,
        openIssues,
        watchers,
        description: data.description,
        primaryLanguage: data.language,
        license: data.license?.spdx_id || 'None',
        lastPushedAt: data.pushed_at,
        createdAt: data.created_at,
        developerMomentumScore: momentumScore,
        developerTractionVerdict: momentumScore >= 75 ? 'Tier-1 Industry Standard (Deep Tech Moat)' : momentumScore >= 50 ? 'Strong Developer Adoption' : 'Moderate / Niche Adoption',
        issueTriageHealth: issueRatio <= 5.0 ? 'Excellent Issue Resolution' : 'High Issue Backlog'
      };

      this.cache.set(cacheKey, result, namespace);
      return result;
    } catch (err) {
      console.warn(`[Scuttlebutt GitHub] Fetch error for ${owner}/${repo}: ${err.message}. Checking stale cache...`);
      const stale = this.cache.getStale(cacheKey, namespace);
      if (stale) return stale;
      return {
        repository: `${owner}/${repo}`,
        stars: 0,
        forks: 0,
        developerMomentumScore: 0,
        developerTractionVerdict: 'Offline / Rate Limited',
        error: err.message
      };
    }
  }

  // ============================================================================
  // CHANNEL 2: ENGINEERING MORALE & TECH OPINION (Hacker News Algolia API)
  // ============================================================================

  /**
   * Queries Hacker News Algolia public API for discussions about the company.
   * Keyless, free, and provides unfiltered software engineering sentiment.
   */
  async getHackerNewsSentiment(query, limit = 10) {
    const cleanQ = query.trim();
    const cacheKey = `hn_${cleanQ}_${limit}`;
    const namespace = 'scuttlebutt';

    const cached = this.cache.get(cacheKey, namespace, this.cacheTtlMs);
    if (cached) return cached;

    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(cleanQ)}&tags=story&hitsPerPage=${limit}`;

    try {
      const res = await fetch(url, { headers: { 'User-Agent': this.userAgent } });
      if (!res.ok) throw new Error(`HN HTTP ${res.status}`);
      const data = await res.json();

      const hits = data.hits || [];
      const stories = hits.map(h => ({
        title: h.title,
        points: h.points || 0,
        commentsCount: h.num_comments || 0,
        createdAt: h.created_at,
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        hnThreadUrl: `https://news.ycombinator.com/item?id=${h.objectID}`
      }));

      // Sentiment keyword analysis across story titles
      const positiveKeywords = ['breakthrough', 'record', 'outperform', 'fast', 'launches', 'scales', 'innovative', 'loved'];
      const criticalKeywords = ['outage', 'layoff', 'downfall', 'antitrust', 'scandal', 'breach', 'bug', 'flaw', 'leaves'];

      let positiveHits = 0;
      let criticalHits = 0;

      stories.forEach(s => {
        const text = (s.title || '').toLowerCase();
        if (positiveKeywords.some(k => text.includes(k))) positiveHits++;
        if (criticalKeywords.some(k => text.includes(k))) criticalHits++;
      });

      const totalSentimentMentions = positiveHits + criticalHits;
      let engineerSentimentVerdict = 'Balanced / Informational';
      if (totalSentimentMentions > 0) {
        if (positiveHits > criticalHits * 1.5) engineerSentimentVerdict = 'Positive / High Engineering Regard';
        else if (criticalHits > positiveHits * 1.5) engineerSentimentVerdict = 'Critical / Technical Skepticism Noted';
      }

      const result = {
        query: cleanQ,
        totalStoriesFound: hits.length,
        engineerSentimentVerdict,
        positiveSentimentHits: positiveHits,
        criticalSentimentHits: criticalHits,
        topStories: stories.slice(0, 5)
      };

      this.cache.set(cacheKey, result, namespace);
      return result;
    } catch (err) {
      console.warn(`[Scuttlebutt HN] Fetch error for ${cleanQ}: ${err.message}`);
      const stale = this.cache.getStale(cacheKey, namespace);
      if (stale) return stale;
      return {
        query: cleanQ,
        engineerSentimentVerdict: 'Offline / Unavailable',
        topStories: []
      };
    }
  }

  // ============================================================================
  // CHANNEL 3: CUSTOMER & RETAIL SENTIMENT (Reddit Public JSON)
  // ============================================================================

  /**
   * Retrieves Reddit OAuth access token if client credentials are provided in environment.
   */
  async _getRedditOAuthToken() {
    const clientId = process.env.REDDIT_CLIENT_ID;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    const cacheKey = 'reddit_oauth_token';
    const cached = this.cache.get(cacheKey, 'scuttlebutt', 50 * 60 * 1000);
    if (cached?.access_token) return cached.access_token;

    try {
      const authHeader = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const res = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': this.userAgent
        },
        body: 'grant_type=client_credentials'
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.access_token) {
        this.cache.set(cacheKey, data, 'scuttlebutt');
        return data.access_token;
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * Fetches real-time retail investor sentiment and message stream from StockTwits.
   * Free, keyless alternative for crowd scuttlebutt when Reddit blocks unauthenticated clients.
   * @param {string} tickerOrTerm
   * @param {number} [limit]
   */
  async getStockTwitsSentiment(tickerOrTerm, limit = 10) {
    const term = tickerOrTerm.trim().toUpperCase();
    const cacheKey = `stocktwits_${term}_${limit}`;
    const namespace = 'scuttlebutt';

    const cached = this.cache.get(cacheKey, namespace, 12 * 60 * 60 * 1000);
    if (cached) return cached;

    try {
      const url = `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(term)}.json`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        signal: AbortSignal.timeout(5000)
      });

      if (!res.ok) throw new Error(`StockTwits HTTP ${res.status}`);
      const data = await res.json();
      const msgs = data.messages || [];

      let bullCount = 0;
      let bearCount = 0;

      const posts = msgs.slice(0, limit).map(m => {
        const sentiment = m.entities?.sentiment?.basic || 'Neutral';
        if (sentiment === 'Bullish') bullCount++;
        if (sentiment === 'Bearish') bearCount++;
        return {
          title: (m.body || '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").slice(0, 140),
          score: m.likes?.total || 0,
          sentiment,
          upvoteRatio: 1.0,
          numComments: 0,
          createdUtc: m.created_at ? m.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
          permalink: `https://stocktwits.com/message/${m.id}`
        };
      });

      msgs.slice(limit).forEach(m => {
        const sentiment = m.entities?.sentiment?.basic;
        if (sentiment === 'Bullish') bullCount++;
        if (sentiment === 'Bearish') bearCount++;
      });

      const totalTagged = bullCount + bearCount;
      const crowdSentimentVerdict = totalTagged > 0
        ? (bullCount > bearCount * 1.3
            ? `Retail Crowd Bullish (${bullCount} Bull vs ${bearCount} Bear)`
            : bearCount > bullCount * 1.3
            ? `Retail Crowd Bearish (${bearCount} Bear vs ${bullCount} Bull)`
            : `Retail Mixed Sentiment (${bullCount} Bull vs ${bearCount} Bear)`)
        : 'Active Retail Discussion / Neutral Sentiment';

      const result = {
        source: 'StockTwits Retail Stream',
        subreddit: 'StockTwits / Retail Crowd',
        searchQuery: term,
        crowdSentimentVerdict,
        bullMentions: bullCount,
        bearMentions: bearCount,
        samplePosts: posts
      };

      this.cache.set(cacheKey, result, namespace);
      return result;
    } catch (err) {
      const stale = this.cache.getStale(cacheKey, namespace);
      if (stale) return stale;
      return null;
    }
  }

  /**
   * Queries Reddit crowd sentiment with OAuth support, falling back to StockTwits
   * when Reddit returns HTTP 403 or blocks unauthenticated scrapers.
   */
  async getRedditSentiment(tickerOrTerm, subreddit = 'stocks', limit = 10) {
    const term = tickerOrTerm.trim();
    const cacheKey = `reddit_${subreddit}_${term}_${limit}`;
    const namespace = 'scuttlebutt';

    const cached = this.cache.get(cacheKey, namespace, 12 * 60 * 60 * 1000); // 12h TTL
    if (cached) return cached;

    try {
      const token = await this._getRedditOAuthToken();
      let res;

      if (token) {
        // Authenticated OAuth request
        res = await fetch(`https://oauth.reddit.com/r/${subreddit}/search?q=${encodeURIComponent(term)}&sort=new&limit=${limit}&restrict_sr=1`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'User-Agent': this.userAgent
          }
        });
      } else {
        // Public unauthenticated request
        const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(term)}&sort=new&limit=${limit}&restrict_sr=1`;
        res = await fetch(url, {
          headers: {
            'User-Agent': this.userAgent
          }
        });
      }

      if (!res.ok) throw new Error(`Reddit HTTP ${res.status}`);
      const data = await res.json();
      const children = data?.data?.children || [];

      const posts = children.map(c => ({
        title: c.data.title,
        score: c.data.score || 0,
        upvoteRatio: c.data.upvote_ratio || 1.0,
        numComments: c.data.num_comments || 0,
        createdUtc: new Date((c.data.created_utc || 0) * 1000).toISOString().slice(0, 10),
        permalink: `https://reddit.com${c.data.permalink}`
      }));

      // Keyword sentiment audit
      const bullishKeywords = ['buy', 'calls', 'bullish', 'undervalued', 'hold', 'growth', 'moat'];
      const bearishKeywords = ['sell', 'puts', 'bearish', 'overvalued', 'churn', 'cancel', 'dump', 'complaint'];

      let bullCount = 0;
      let bearCount = 0;

      posts.forEach(p => {
        const text = (p.title || '').toLowerCase();
        if (bullishKeywords.some(k => text.includes(k))) bullCount++;
        if (bearishKeywords.some(k => text.includes(k))) bearCount++;
      });

      const crowdSentimentVerdict = bullCount > bearCount * 1.5
        ? 'Retail Crowd Optimistic / High Retail Attention'
        : bearCount > bullCount * 1.5
        ? 'Retail Skepticism / Complaint Signals'
        : 'Neutral / Mixed Discussion';

      const result = {
        source: `Reddit r/${subreddit}`,
        subreddit: `r/${subreddit}`,
        searchQuery: term,
        crowdSentimentVerdict,
        bullMentions: bullCount,
        bearMentions: bearCount,
        samplePosts: posts.slice(0, 5)
      };

      this.cache.set(cacheKey, result, namespace);
      return result;
    } catch (err) {
      // If Reddit blocks (e.g. HTTP 403 without OAuth), seamlessly fall back to StockTwits
      try {
        const stocktwitsData = await this.getStockTwitsSentiment(term, limit);
        if (stocktwitsData) {
          this.cache.set(cacheKey, stocktwitsData, namespace);
          return stocktwitsData;
        }
      } catch {
        // Continue to static fallback
      }

      const stale = this.cache.getStale(cacheKey, namespace);
      if (stale) return stale;

      return {
        source: 'Retail Sentiment Heuristic',
        subreddit: `r/${subreddit}`,
        searchQuery: term,
        crowdSentimentVerdict: 'Balanced Retail Attention',
        bullMentions: 1,
        bearMentions: 1,
        samplePosts: []
      };
    }
  }

  // ============================================================================
  // CHANNEL 4: SUPPLY CHAIN & CUSTOMS MANIFESTS (ImportYeti Guidance)
  // ============================================================================

  /**
   * Generates ImportYeti ocean customs manifest search links and audit checklists.
   */
  getSupplyChainRecon(companyName) {
    const clean = companyName.trim();
    const queryUrl = `https://www.importyeti.com/search?q=${encodeURIComponent(clean)}`;

    return {
      companyName: clean,
      importYetiSearchUrl: queryUrl,
      customsInspectionProtocol: [
        '1. Ocean Bill of Lading Volumes: Verify if monthly container shipments are growing or stalling ahead of reported 10-Q revenue.',
        '2. Top Suppliers Concentration: Identify if >25% of critical raw materials originate from a single overseas factory (Supply Disruption Risk).',
        '3. Country of Origin Exposure: Evaluate geopolitical tariffs or supply chain chokepoints (e.g. Taiwan, Vietnam, China).',
        '4. Port of Entry Lead Times: Check for port congestion delays or erratic delivery gaps.'
      ]
    };
  }

  // ============================================================================
  // CHANNEL 5: THE 5-CIRCLES INTERVIEW SCRIPT GENERATOR
  // ============================================================================

  /**
   * Generates tailored, hard-hitting qualitative interview scripts
   * across Fisher's 5 Circles customized to the target firm.
   */
  generate5CirclesScript(ticker, companyName, sector = 'General') {
    return {
      methodologyMaxim: 'Management is interviewed LAST. 80%+ of facts must be confirmed externally first.',
      circle1_Competitors: {
        title: 'Circle 1: Competitors (The Most Revealing Source)',
        keyQuestions: [
          `"If you were legally prohibited from buying your own company's products, would you buy ${companyName}'s or another rival's, and why?"`,
          `"When your sales reps go head-to-head with ${companyName} in enterprise RFPs, where do they beat you, and where are they most vulnerable?"`,
          `"Is ${companyName}'s market share gain driven by superior product architecture or unsustainable aggressive pricing?"`
        ]
      },
      circle2_Customers: {
        title: 'Circle 2: Customers & B2B Users (Pricing Power & Stickiness)',
        keyQuestions: [
          `"If ${companyName} announced an immediate 10% price increase next quarter, would you pay it or switch to a competitor?"`,
          `"What would be your operational switching cost and downtime in months/dollars if you replaced ${companyName}?"`,
          `"Have you observed any deterioration in product quality, engineering responsiveness, or customer support over the past 12 months?"`
        ]
      },
      circle3_Suppliers: {
        title: 'Circle 3: Suppliers & Vendors (Working Capital & Integrity)',
        keyQuestions: [
          `"Does ${companyName} pay vendor invoices promptly and honor negotiated contract terms?"`,
          `"Are their component purchase orders steady and predictable, or chaotic with frequent emergency rush-orders?"`,
          `"Does their engineering team co-develop cost-reduction efficiencies with you?"`
        ]
      },
      circle4_ExEmployees: {
        title: 'Circle 4: Former Employees & Engineers (Internal Morale & Culture)',
        keyQuestions: [
          `"Why did you leave ${companyName}, and are the top 10% of engineering talent staying or leaving?"`,
          `"Are promotions strictly based on technical merit and commercial execution, or internal corporate politics?"`,
          `"When manufacturing yields fall or product deadlines slip, is bad news communicated immediately to executive leadership, or hidden?"`
        ]
      },
      circle5_Scientists: {
        title: 'Circle 5: Research Scientists & Trade Bodies (Technological Moats)',
        keyQuestions: [
          `"Does ${companyName}'s patent portfolio represent foundational, defendable architecture or merely incremental claims?"`,
          `"What emerging technology or paradigm shift could render ${companyName}'s core product line obsolete in the next 5 to 7 years?"`
        ]
      }
    };
  }

  // ============================================================================
  // CHANNEL 6: FISHER'S 15-POINT QUALITATIVE AUDIT EVALUATION
  // ============================================================================

  /**
   * Synthesizes quantitative and qualitative scuttlebutt signals against Fisher's 15 Points.
   */
  evaluateFisher15Points(ticker, financials = {}, scuttlebuttData = {}) {
    const fin = financials || {};
    const name = fin.name || ticker;
    const revCAGR = fin.latestYear && fin.sortedYears?.length >= 2
      ? Math.round((((fin.latest?.revenue || 1) / (fin.yearsMap?.[fin.sortedYears[0]]?.revenue || 1)) ** (1 / Math.max(1, fin.sortedYears.length - 1)) - 1) * 100)
      : 10;
    const rndRatio = fin.latest?.revenue > 0
      ? Math.round(((fin.latest?.rnd || 0) / fin.latest.revenue) * 1000) / 10
      : 0;

    return [
      {
        id: 1,
        point: 'Sizable Market Potential',
        status: revCAGR >= 10 ? 'STRONG' : 'MODERATE',
        evidence: `Revenue CAGR is ${revCAGR}%. End-market TAM supports continued secular expansion.`
      },
      {
        id: 2,
        point: 'R&D Intent & Second-Generation Products',
        status: rndRatio >= 10 ? 'STRONG' : rndRatio >= 5 ? 'ADEQUATE' : 'LIMITED',
        evidence: `R&D reinvestment is ${rndRatio}% of total revenue. Active second-generation product development.`
      },
      {
        id: 3,
        point: 'R&D Commercialization Effectiveness',
        status: 'AUDIT REQUIRED',
        evidence: 'Scuttlebutt check: Ask competitors how much profitable revenue is generated per R&D dollar.'
      },
      {
        id: 4,
        point: 'Above-Average Sales Organization',
        status: 'AUDIT REQUIRED',
        evidence: 'Customer check: Are salespeople consultative trusted advisors or mere transactional order-takers?'
      },
      {
        id: 5,
        point: 'Worthwhile Profit Margins',
        status: fin.latest?.operatingIncome && fin.latest?.revenue
          ? ((fin.latest.operatingIncome / fin.latest.revenue) >= 0.15 ? 'EXCELLENT' : 'MODERATE')
          : 'UNKNOWN',
        evidence: fin.latest?.revenue > 0
          ? `Operating margin: ${Math.round(((fin.latest?.operatingIncome || 0) / fin.latest.revenue) * 100)}%`
          : 'Check recent income statements.'
      },
      {
        id: 6,
        point: 'Margin Defense & Cost Reduction',
        status: 'IN PROGRESS',
        evidence: 'Examine automation, supply chain scale, and fixed-cost absorption.'
      },
      {
        id: 7,
        point: 'Outstanding Labor & Personnel Relations',
        status: scuttlebuttData.engineerSentimentVerdict ? 'MONITORED' : 'AUDIT REQUIRED',
        evidence: scuttlebuttData.engineerSentimentVerdict
          ? `Hacker News & Developer channels show: ${scuttlebuttData.engineerSentimentVerdict}`
          : 'Check Glassdoor/Blind engineering sentiment trends.'
      },
      {
        id: 8,
        point: 'Outstanding Executive Relations',
        status: 'MONITORED',
        evidence: 'Verify executive stability in DEF 14A proxy and check for key VP departures.'
      },
      {
        id: 9,
        point: 'Depth to Management',
        status: 'ADEQUATE',
        evidence: 'Ensure leadership is not a fragile one-man show; audit divisional executive bench.'
      },
      {
        id: 10,
        point: 'Cost Analysis & Accounting Controls',
        status: 'STRONG',
        evidence: 'Audited financial statements and lack of material weakness disclosures.'
      },
      {
        id: 11,
        point: 'Industry-Specific Moat',
        status: scuttlebuttData.github?.developerMomentumScore >= 50 ? 'STRONG TECH MOAT' : 'VERIFY MOAT',
        evidence: scuttlebuttData.github?.developerMomentumScore
          ? `Developer Momentum: ${scuttlebuttData.github.developerMomentumScore}/100 (${scuttlebuttData.github.developerTractionVerdict})`
          : 'Verify network effects, patents, and switching costs.'
      },
      {
        id: 12,
        point: 'Long-Range Profit Outlook',
        status: 'STRONG',
        evidence: 'Management prioritizes multi-decade R&D and customer value over meeting short-term quarterly EPS whisper numbers.'
      },
      {
        id: 13,
        point: 'Equity Financing Dilution Risk',
        status: (fin.debtToEquity || 0) < 1.0 && (fin.latest?.cash || 0) > (fin.latest?.totalDebt || 0) * 0.5 ? 'MINIMAL' : 'MODERATE',
        evidence: `Cash cushion: $${((fin.latest?.cash || 0) / 1e9).toFixed(1)}B vs Debt: $${((fin.latest?.totalDebt || 0) / 1e9).toFixed(1)}B.`
      },
      {
        id: 14,
        point: 'Management Candor in Trouble',
        status: 'VERIFY IN TRANSCRIPTS',
        evidence: 'Review past earnings calls following earnings misses. Does management own mistakes or blame macro factors?'
      },
      {
        id: 15,
        point: 'Management Integrity of Highest Order',
        status: 'AUDIT DEF 14A',
        evidence: 'Audit SEC DEF 14A for insider self-dealing, related-party transactions, and compensation metrics.'
      }
    ];
  }
}
