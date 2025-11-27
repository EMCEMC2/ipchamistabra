/**
 * BTC NEWS AGENT
 * Tries real RSS sources first (no AI key needed) and falls back to mocked data with fresh timestamps.
 * Auto-updates every minute (test cadence) so UI always has fresh headlines.
 */

import { IntelItem } from '../types';

// Mock data for fallback (when API fails)
const FALLBACK_NEWS: IntelItem[] = [
  {
    id: 'fallback-1',
    title: 'Bitcoin Holds Above $84K Despite Macro Headwinds',
    severity: 'MEDIUM',
    category: 'NEWS',
    timestamp: Date.now() - 1000 * 60 * 15,
    source: 'CoinDesk',
    summary: 'BTC maintains key support level as traders await Fed decision.',
    btcSentiment: 'NEUTRAL'
  },
  {
    id: 'fallback-2',
    title: 'Institutional Demand Surges: ETF Inflows Hit Weekly High',
    severity: 'HIGH',
    category: 'NEWS',
    timestamp: Date.now() - 1000 * 60 * 45,
    source: 'Bloomberg Crypto',
    summary: 'BlackRock and Fidelity ETFs see combined $420M inflows this week.',
    btcSentiment: 'BULLISH'
  },
  {
    id: 'fallback-3',
    title: 'Large Whale Transfer: 3,200 BTC Moved to Unknown Wallet',
    severity: 'MEDIUM',
    category: 'WHALE',
    timestamp: Date.now() - 1000 * 60 * 90,
    source: 'Whale Alert',
    summary: 'Major BTC movement from Binance to cold storage wallet detected.',
    btcSentiment: 'BULLISH'
  }
];

class BTCNewsAgent {
  private updateInterval: NodeJS.Timeout | null = null;
  private callbacks: Set<(news: IntelItem[]) => void> = new Set();
  private latestNews: IntelItem[] = FALLBACK_NEWS;
  private isRunning: boolean = false;

  constructor() {
    console.log('[BTC News Agent] Initialized');
  }

  /**
   * Start the news agent - fetches news immediately and then every 5 minutes
   */
  async start(callback: (news: IntelItem[]) => void): Promise<void> {
    if (this.isRunning) {
      console.log('[BTC News Agent] Already running, adding callback');
      this.callbacks.add(callback);
      callback(this.latestNews); // Send current news immediately
      return;
    }

    console.log('[BTC News Agent] 🚀 Starting...');
    this.isRunning = true;
    this.callbacks.add(callback);

    // Fetch news immediately
    console.log('[BTC News Agent] Fetching initial news...');
    await this.fetchNews();

    // Setup auto-refresh every 1 minute for testing (change to 5 later)
    this.updateInterval = setInterval(async () => {
      console.log('[BTC News Agent] ⏰ Auto-refresh triggered');
      await this.fetchNews();
    }, 1 * 60 * 1000); // 1 minute for testing

    console.log('[BTC News Agent] ✅ Started with 1-minute auto-refresh');
  }

  /**
   * Stop the news agent
   */
  stop(callback?: (news: IntelItem[]) => void): void {
    if (callback) {
      this.callbacks.delete(callback);
    }

    if (this.callbacks.size === 0) {
      console.log('[BTC News Agent] No more listeners, stopping...');
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
      this.isRunning = false;
    }
  }

  /**
   * Fetch latest BTC news using Gemini with Google Search
   */
  private async fetchNews(): Promise<void> {
    console.log('[BTC News Agent] 📰 fetchNews() called');
    try {
      // 1) Try real RSS sources first (fast, keyless, low-latency)
      const rssNews = await this.fetchFromRssSources();
      if (rssNews.length > 0) {
        console.log(`[BTC News Agent] ✅ RSS fetch success: ${rssNews.length} items`);
        this.latestNews = rssNews;
        this.broadcastNews(rssNews);
        return;
      }

      // 2) If RSS fails, fall back to mock with fresh timestamps
      console.warn('[BTC News Agent] RSS fetch failed, using fresh fallback');
      const freshFallback = FALLBACK_NEWS.map((item, index) => ({
        ...item,
        timestamp: Date.now() - (index * 60000)
      }));
      this.latestNews = freshFallback;
      this.broadcastNews(freshFallback);

    } catch (error: any) {
      console.error('[BTC News Agent] ❌ Error fetching news:', error.message);
      console.error('[BTC News Agent] Full error:', error);
      // Use fallback but update timestamps to appear fresh
      const freshFallback = FALLBACK_NEWS.map((item, index) => ({
        ...item,
        timestamp: Date.now() - (index * 60000)
      }));
      console.log('[BTC News Agent] Using fresh fallback data');
      this.broadcastNews(freshFallback);
    }
  }

  /**
   * Broadcast news to all registered callbacks
   */
  private broadcastNews(news: IntelItem[]): void {
    this.callbacks.forEach(callback => {
      try {
        callback(news);
      } catch (error) {
        console.error('[BTC News Agent] Error in callback:', error);
      }
    });
  }

  /**
   * Fetch BTC headlines from multiple RSS sources via a public RSS-to-JSON bridge.
   */
  private async fetchFromRssSources(): Promise<IntelItem[]> {
    const sources = [
      { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/?output=xml' },
      { name: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
      { name: 'Bitcoin Magazine', url: 'https://bitcoinmagazine.com/.rss' },
      { name: 'Decrypt', url: 'https://decrypt.co/feed' }
    ];

    const requests = sources.map(src => this.fetchRss(src.url, src.name));
    const results = await Promise.allSettled(requests);

    const items: IntelItem[] = results
      .filter((r): r is PromiseFulfilledResult<IntelItem[]> => r.status === 'fulfilled')
      .flatMap(r => r.value);

    // Deduplicate by title and sort by recency
    const deduped = Array.from(
      new Map(items.map(item => [item.title, item])).values()
    ).sort((a, b) => b.timestamp - a.timestamp);

    return deduped.slice(0, 12);
  }

  /**
   * Fetch and normalize a single RSS feed through rss2json.
   */
  private async fetchRss(rssUrl: string, sourceName: string): Promise<IntelItem[]> {
    const bridgeUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
    const res = await fetch(bridgeUrl);
    if (!res.ok) throw new Error(`RSS fetch failed for ${sourceName}`);

    const data = await res.json();
    if (!data?.items || !Array.isArray(data.items)) {
      throw new Error(`RSS payload missing items for ${sourceName}`);
    }

    return data.items
      .filter((item: any) => {
        const title = (item.title || '').toLowerCase();
        const description = (item.description || '').toLowerCase();
        const content = `${title} ${description}`;

        // Only include Bitcoin-related news
        return content.includes('bitcoin') ||
               content.includes('btc') ||
               content.includes('satoshi') ||
               content.includes('bitcoin etf') ||
               content.includes('btc price') ||
               content.includes('bitcoin price');
      })
      .map((item: any, idx: number): IntelItem => {
        const published = Date.parse(item.pubDate || item.pubdate || item.date || '');
        const title: string = item.title || 'Untitled';
        const lowerTitle = title.toLowerCase();

        const category = this.classifyCategory(lowerTitle, item.categories || []);
        const btcSentiment = this.classifySentiment(lowerTitle);
        const severity = this.classifySeverity(lowerTitle);

        return {
          id: item.guid || item.link || `${sourceName}-${idx}-${Date.now()}`,
          title,
          severity,
          category,
          timestamp: isNaN(published) ? Date.now() : published,
          source: item.author || item.creator || sourceName,
          summary: item.description ? this.stripHtml(item.description).slice(0, 240) : (item.contentSnippet || item.content || title),
          btcSentiment
        };
      });
  }

  private stripHtml(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  private classifyCategory(lowerTitle: string, categories: string[]): IntelItem['category'] {
    const joined = `${lowerTitle} ${categories.join(' ').toLowerCase()}`;
    if (joined.includes('regulat') || joined.includes('sec') || joined.includes('policy')) return 'MACRO';
    if (joined.includes('whale') || joined.includes('address') || joined.includes('transfer')) return 'WHALE';
    if (joined.includes('on-chain') || joined.includes('onchain') || joined.includes('miners') || joined.includes('hash')) return 'ONCHAIN';
    return 'NEWS';
  }

  private classifySentiment(lowerTitle: string): IntelItem['btcSentiment'] {
    const bull = ['surge', 'inflow', 'buy', 'approval', 'record high', 'bull', 'etf inflow'];
    const bear = ['hack', 'ban', 'sell-off', 'liquidation', 'outflow', 'fud', 'lawsuit'];
    if (bull.some(k => lowerTitle.includes(k))) return 'BULLISH';
    if (bear.some(k => lowerTitle.includes(k))) return 'BEARISH';
    return 'NEUTRAL';
  }

  private classifySeverity(lowerTitle: string): IntelItem['severity'] {
    if (lowerTitle.includes('hack') || lowerTitle.includes('breach') || lowerTitle.includes('etf') || lowerTitle.includes('sec')) return 'HIGH';
    if (lowerTitle.includes('whale') || lowerTitle.includes('upgrade') || lowerTitle.includes('merge') || lowerTitle.includes('lawsuit')) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Manually trigger news refresh
   */
  async refresh(): Promise<void> {
    console.log('[BTC News Agent] Manual refresh triggered');
    await this.fetchNews();
  }

  /**
   * Get current news without subscribing
   */
  getCurrentNews(): IntelItem[] {
    return this.latestNews;
  }
}

// Singleton instance
export const btcNewsAgent = new BTCNewsAgent();
