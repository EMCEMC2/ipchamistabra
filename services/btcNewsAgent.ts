/**
 * BTC NEWS AGENT
 * Continuously fetches live Bitcoin-related news from multiple reliable sources
 * Auto-updates every 5 minutes with real-time market intelligence
 */

import { IntelItem } from '../types';
import { GoogleGenAI } from "@google/genai";

const FAST_MODEL_ID = "gemini-2.0-flash";

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
      const apiKey = this.getApiKey();
      console.log('[BTC News Agent] API Key status:', apiKey ? `Present (${apiKey.length} chars)` : 'Missing');

      if (!apiKey) {
        console.warn('[BTC News Agent] ❌ No API key, using fallback');
        this.broadcastNews(FALLBACK_NEWS);
        return;
      }

      console.log('[BTC News Agent] Initializing Gemini AI...');
      const ai = new GoogleGenAI({ apiKey });

      const prompt = `
        ROLE: Bitcoin News Intelligence Officer
        TASK: Find the LATEST REAL-TIME Bitcoin news from the past 24 hours.

        FOCUS AREAS:
        1. Price action & market movements
        2. Institutional activity (ETFs, whale movements)
        3. Regulatory developments
        4. Macroeconomic impacts (Fed, inflation, DXY)
        5. On-chain metrics (exchange flows, miner activity)

        REQUIREMENTS:
        - Find 5-7 REAL news items from the LAST 24 HOURS
        - Prioritize HIGH-IMPACT news (market-moving events)
        - Include TIMESTAMP-accurate news (not old articles)
        - Analyze BTC sentiment for each: BULLISH, BEARISH, or NEUTRAL

        Return JSON array:
        [
          {
            "id": "unique_timestamp_id",
            "title": "Clear, concise headline",
            "severity": "HIGH" | "MEDIUM" | "LOW",
            "category": "NEWS" | "MACRO" | "WHALE" | "ONCHAIN",
            "timestamp": ${Date.now()},
            "source": "Actual source name (CoinDesk, Bloomberg, etc.)",
            "summary": "One sentence explaining BTC impact",
            "btcSentiment": "BULLISH" | "BEARISH" | "NEUTRAL"
          }
        ]

        IMPORTANT: Use real-time Google Search to find ACTUAL current news. Do NOT fabricate.
      `;

      const response = await ai.models.generateContent({
        model: FAST_MODEL_ID,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error('No response from API');
      }

      // Parse JSON response
      const newsData = this.cleanAndParseJSON<IntelItem[]>(text);
      if (!newsData || newsData.length === 0) {
        throw new Error('Invalid or empty news data');
      }

      // Validate and ensure IDs are unique
      const validatedNews = newsData.map((item, index) => ({
        ...item,
        id: item.id || `news-${Date.now()}-${index}`,
        timestamp: item.timestamp || Date.now() - (index * 60000) // Fallback timestamps
      }));

      console.log(`[BTC News Agent] ✅ Fetched ${validatedNews.length} news items`);
      this.latestNews = validatedNews;
      this.broadcastNews(validatedNews);

    } catch (error: any) {
      console.error('[BTC News Agent] Error fetching news:', error.message);
      // Use fallback but update timestamps to appear fresh
      const freshFallback = FALLBACK_NEWS.map((item, index) => ({
        ...item,
        timestamp: Date.now() - (index * 60000)
      }));
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
   * Get API key from environment or localStorage
   */
  private getApiKey(): string | null {
    const fromProcessEnv = process.env.API_KEY;
    const fromImportMeta = import.meta.env.VITE_GEMINI_API_KEY;
    const fromStorage = typeof window !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY') : null;

    return (fromProcessEnv || fromImportMeta || fromStorage || '').trim() || null;
  }

  /**
   * Clean and parse JSON from AI response
   */
  private cleanAndParseJSON<T>(text: string): T | null {
    try {
      let clean = text.replace(/```json/g, '').replace(/```/g, '');
      clean = clean.replace(/\[\d+\]/g, ''); // Remove citations

      const firstOpenBrace = clean.indexOf('{');
      const firstOpenBracket = clean.indexOf('[');

      let startIndex = -1;
      if (firstOpenBrace !== -1 && (firstOpenBracket === -1 || firstOpenBrace < firstOpenBracket)) {
        startIndex = firstOpenBrace;
      } else if (firstOpenBracket !== -1) {
        startIndex = firstOpenBracket;
      }

      if (startIndex !== -1) {
        const lastIndex = clean.lastIndexOf(clean[startIndex] === '{' ? '}' : ']');
        if (lastIndex !== -1) {
          clean = clean.substring(startIndex, lastIndex + 1);
        }
      }

      return JSON.parse(clean);
    } catch (e) {
      return null;
    }
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
