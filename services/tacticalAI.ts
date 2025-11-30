/**
 * TACTICAL AI SERVICE
 * Provides intelligent, context-aware responses to user queries about market conditions,
 * trading signals, and strategic decisions. Integrates data from multiple sources:
 * - Store state (price, sentiment, technicals)
 * - Active trade signals
 * - BTC news agent
 * - Order flow intelligence
 * - Agent swarm consensus
 */

import { TacticalChatMessage, IntelligenceQuery, TradeSignal, IntelItem, GroundingSource } from '../types';
import { generateMarketAnalysis, AiResponse } from './gemini';
import { btcNewsAgent } from './btcNewsAgent';
import { orderFlowIntel } from './orderFlowIntel';
import { useStore } from '../store/useStore';
import { AggrStats } from '../types/aggrTypes';

/**
 * Format a number with appropriate precision and locale formatting.
 * Handles NaN and undefined gracefully.
 */
function formatNumber(value: number | undefined | null, decimals: number = 2): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'N/A';
  }
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Format USD value with appropriate suffix (K, M, B).
 */
function formatUSD(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'N/A';
  }
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

/**
 * Sanitize user input before sending to AI.
 * Strips HTML tags, escapes special characters, enforces length limit.
 */
function sanitizeUserInput(input: string, maxLength: number = 2000): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    // Strip HTML tags
    .replace(/<[^>]*>/g, '')
    // Escape potential prompt injection patterns
    .replace(/\{\{[^}]*\}\}/g, '') // Remove template-like patterns
    .replace(/\[\[.*?\]\]/g, '')   // Remove wiki-style brackets
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()
    // Enforce max length
    .slice(0, maxLength);
}

/**
 * Format timestamp to Israel timezone.
 */
function formatTimeIsrael(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString('en-IL', {
      timeZone: 'Asia/Jerusalem',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch {
    return new Date(timestamp).toLocaleTimeString();
  }
}

/**
 * Determine sentiment label based on score.
 */
function getSentimentLabel(score: number): string {
  if (score >= 60) return 'Bullish';
  if (score <= 40) return 'Bearish';
  return 'Neutral';
}

/**
 * Determine RSI condition.
 */
function getRsiCondition(rsi: number): string {
  if (rsi > 70) return 'Overbought';
  if (rsi < 30) return 'Oversold';
  return 'Normal';
}

/**
 * Determine market regime based on ATR and price.
 */
function getMarketRegime(atr: number, price: number): string {
  if (price <= 0) return 'NORMAL';
  const atrPercent = (atr / price) * 100;
  if (atrPercent > 2) return 'HIGH_VOL';
  if (atrPercent < 1) return 'LOW_VOL';
  return 'NORMAL';
}

/**
 * Determine funding rate sentiment.
 */
function getFundingSentiment(rate: number): string {
  if (rate > 0.01) return 'Bullish';
  if (rate < -0.01) return 'Bearish';
  return 'Neutral';
}

/**
 * TacticalAI - Singleton service for processing intelligence queries
 */
class TacticalAI {
  private conversationHistory: TacticalChatMessage[] = [];
  private readonly MAX_HISTORY: number = 10;
  private readonly CACHE_TTL: number = 15000; // 15 seconds - crypto markets are volatile
  private queryCache: Map<string, { response: TacticalChatMessage; timestamp: number }> = new Map();

  constructor() {
    // Initialization complete
  }

  /**
   * Normalize query string for cache key lookup.
   */
  private normalizeQuery(query: string): string {
    return query.toLowerCase().trim();
  }

  /**
   * Check cache for existing response.
   */
  private checkCache(query: string): TacticalChatMessage | null {
    const key = this.normalizeQuery(query);
    const cached = this.queryCache.get(key);

    if (!cached) {
      return null;
    }

    const age = Date.now() - cached.timestamp;
    if (age > this.CACHE_TTL) {
      this.queryCache.delete(key);
      return null;
    }

    // Return cached response with new ID to maintain uniqueness
    return {
      ...cached.response,
      id: `msg-${Date.now()}`
    };
  }

  /**
   * Cache a query response.
   */
  private cacheQuery(query: string, response: TacticalChatMessage): void {
    const key = this.normalizeQuery(query);
    this.queryCache.set(key, { response, timestamp: Date.now() });

    // Prevent memory leak - remove oldest entries if cache exceeds 50
    if (this.queryCache.size > 50) {
      let oldest: { key: string; timestamp: number } | null = null;
      const entries = Array.from(this.queryCache.entries());
      for (let i = 0; i < entries.length; i++) {
        const [k, v] = entries[i];
        if (!oldest || v.timestamp < oldest.timestamp) {
          oldest = { key: k, timestamp: v.timestamp };
        }
      }
      if (oldest) {
        this.queryCache.delete(oldest.key);
      }
    }
  }

  /**
   * Add message to conversation history.
   */
  private addToHistory(message: TacticalChatMessage): void {
    this.conversationHistory.push(message);
    if (this.conversationHistory.length > this.MAX_HISTORY) {
      this.conversationHistory.shift();
    }
  }

  /**
   * Build market state context string from store.
   */
  private buildMarketStateContext(): string {
    const state = useStore.getState();
    const { price, priceChange, sentimentScore, technicals } = state;
    const { rsi, adx, atr, trend } = technicals;

    const sentimentLabel = getSentimentLabel(sentimentScore);
    const rsiCondition = getRsiCondition(rsi);
    const regime = getMarketRegime(atr, price);

    return `**CURRENT MARKET STATE:**
- BTC Price: $${formatNumber(price, 2)} (${priceChange >= 0 ? '+' : ''}${formatNumber(priceChange, 2)}% 24h)
- Sentiment Score: ${formatNumber(sentimentScore, 0)}/100 (${sentimentLabel})
- RSI (14): ${formatNumber(rsi, 1)} (${rsiCondition})
- Trend: ${trend} (EMA 21 vs 55)
- ADX: ${formatNumber(adx, 1)} (${adx > 25 ? 'Strong' : 'Weak'})
- ATR: ${formatNumber(atr, 2)}
- Regime: ${regime}`;
  }

  /**
   * Build active signals context string.
   */
  private buildSignalsContext(signals: TradeSignal[] | undefined): string {
    if (!signals || signals.length === 0) {
      return '**ACTIVE TRADING SIGNALS:** None currently active.';
    }

    const signalLines = signals.map(s => {
      const targets = s.targets && s.targets.length > 0 ? s.targets[0] : 'N/A';
      return `- ${s.pair} ${s.type} @ ${s.entryZone} | SL: ${s.invalidation} | TP: ${targets} | Conf: ${s.confidence}% | Regime: ${s.regime}`;
    });

    return `**ACTIVE TRADING SIGNALS (${signals.length}):**
${signalLines.join('\n')}`;
  }

  /**
   * Build news context string from btcNewsAgent.
   */
  private buildNewsContext(): string {
    const news: IntelItem[] = btcNewsAgent.getCurrentNews();

    if (!news || news.length === 0) {
      return '**RECENT BTC NEWS:** No recent news available.';
    }

    const top5 = news.slice(0, 5);
    const newsLines = top5.map(item => {
      const time = formatTimeIsrael(item.timestamp);
      return `- [${item.category}] ${item.title} (${item.btcSentiment}) - ${time}`;
    });

    return `**RECENT BTC NEWS (Last 5):**
${newsLines.join('\n')}`;
  }

  /**
   * Build order flow context string from orderFlowIntel.
   */
  private buildOrderFlowContext(): string {
    const stats: AggrStats | null = orderFlowIntel.getStats();

    if (!stats) {
      return '**ORDER FLOW:** Data unavailable.';
    }

    // Check if banned
    if (stats.banned?.isBanned) {
      return `**ORDER FLOW:** Data temporarily unavailable (API rate limit). Resuming in ${stats.banned.remainingMinutes} minutes.`;
    }

    const { cvd, pressure, liquidationCount, liquidationVolume, largeTradeCount, openInterest, funding, longShortRatio, recentLiquidations, recentLargeTrades } = stats;

    // CVD direction
    const cvdDirection = cvd.delta > 0 ? 'Net Buying' : cvd.delta < 0 ? 'Net Selling' : 'Neutral';
    const cvdDeltaM = cvd.delta / 1_000_000;

    // Pressure details
    const pressureSide = pressure.dominantSide === 'buy' ? 'Buy' : pressure.dominantSide === 'sell' ? 'Sell' : 'Neutral';
    const pressureStrength = pressure.strength.charAt(0).toUpperCase() + pressure.strength.slice(1);

    // Open Interest
    let oiStr = 'N/A';
    let oiChangeStr = '0%';
    if (openInterest && !isNaN(openInterest.openInterest)) {
      oiStr = formatNumber(openInterest.openInterest, 2);
      const change = openInterest.change1h;
      if (!isNaN(change)) {
        oiChangeStr = `${change >= 0 ? '+' : ''}${formatNumber(change, 2)}%`;
      }
    }

    // Funding Rate
    let fundingStr = 'N/A';
    let fundingSentiment = 'Neutral';
    if (funding && !isNaN(funding.rate)) {
      fundingStr = `${(funding.rate * 100).toFixed(4)}%`;
      fundingSentiment = getFundingSentiment(funding.rate);
    }

    // Long/Short Ratio
    let lsRatioStr = 'N/A';
    if (longShortRatio && !isNaN(longShortRatio.longShortRatio)) {
      lsRatioStr = formatNumber(longShortRatio.longShortRatio, 2);
    }

    // Build base context
    let context = `**ORDER FLOW (Last 10 minutes):**
- CVD: ${formatNumber(cvdDeltaM, 2)}M USD (${cvdDirection})
- Pressure: ${pressureSide} ${pressureStrength} (${formatNumber(pressure.buyPressure, 1)}% buy / ${formatNumber(pressure.sellPressure, 1)}% sell)
- Liquidations: ${liquidationCount} events totaling ${formatUSD(liquidationVolume)}
- Large Trades: ${largeTradeCount} detected ($500K+ each)
- Open Interest: ${oiStr} BTC (${oiChangeStr} 1h)
- Funding Rate: ${fundingStr} (${fundingSentiment})
- Long/Short Ratio: ${lsRatioStr}`;

    // Add recent liquidations if available
    if (recentLiquidations && recentLiquidations.length > 0) {
      const top3Liqs = recentLiquidations.slice(0, 3);
      const liqLines = top3Liqs.map(l => {
        const time = formatTimeIsrael(l.timestamp);
        return `  - ${l.side.toUpperCase()} ${formatUSD(l.usdValue)} @ $${formatNumber(l.price, 0)} (${time})`;
      });
      context += `\n\n**Recent Liquidations:**\n${liqLines.join('\n')}`;
    }

    // Add whale trades if available
    if (recentLargeTrades && recentLargeTrades.length > 0) {
      const top3Whales = recentLargeTrades.slice(0, 3);
      const whaleLines = top3Whales.map(t => {
        const time = formatTimeIsrael(t.timestamp);
        return `  - ${t.side.toUpperCase()} ${formatUSD(t.usdValue)} @ $${formatNumber(t.price, 0)} (${time})`;
      });
      context += `\n\n**Recent Whale Trades:**\n${whaleLines.join('\n')}`;
    }

    return context;
  }

  /**
   * Build comprehensive context for AI prompt.
   */
  private buildFullContext(query: IntelligenceQuery): string {
    const parts: string[] = [];

    // 1. Market State from store
    parts.push(this.buildMarketStateContext());

    // 2. Active Signals from query context
    parts.push(this.buildSignalsContext(query.context.activeSignals));

    // 3. Recent News from btcNewsAgent
    parts.push(this.buildNewsContext());

    // 4. Order Flow from orderFlowIntel
    parts.push(this.buildOrderFlowContext());

    // 5. Swarm Consensus if provided
    if (query.context.swarmConsensus) {
      parts.push(`**AGENT SWARM CONSENSUS:**\n${query.context.swarmConsensus}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Build the AI prompt with context and guidelines.
   */
  private buildAIPrompt(query: IntelligenceQuery): string {
    const contextData = this.buildFullContext(query);

    return `${contextData}

USER QUESTION: ${query.query}

RESPONSE GUIDELINES:
- Answer concisely (max 250 words)
- Cite specific metrics from the context above
- Use **bold** for key points and numbers
- Use bullet points for lists
- If insufficient data for a complete answer, say so explicitly
- Do NOT hallucinate or invent metrics not provided
- Maintain a professional trader tone`;
  }

  /**
   * Create a system message for errors.
   */
  private createSystemMessage(content: string): TacticalChatMessage {
    return {
      id: `msg-${Date.now()}`,
      role: 'system',
      content,
      timestamp: Date.now()
    };
  }

  /**
   * Process a user query and return an AI-generated response.
   */
  async processQuery(query: IntelligenceQuery): Promise<TacticalChatMessage> {
    try {
      // Sanitize user input before processing
      const sanitizedQuery: IntelligenceQuery = {
        ...query,
        query: sanitizeUserInput(query.query)
      };

      // Check cache first (using sanitized query)
      const cached = this.checkCache(sanitizedQuery.query);
      if (cached) {
        return cached;
      }

      // Reject empty queries after sanitization
      if (!sanitizedQuery.query.trim()) {
        return this.createSystemMessage('Please enter a valid question.');
      }

      // Get active signals from query context
      const activeSignals = sanitizedQuery.context.activeSignals || [];

      // Build prompt with full context (using sanitized query)
      const prompt = this.buildAIPrompt(sanitizedQuery);

      // Call Gemini AI
      const aiResponse: AiResponse = await generateMarketAnalysis(prompt, activeSignals);

      // Get current market snapshot for metadata
      const state = useStore.getState();

      // Build grounding sources from AI response
      const sources: GroundingSource[] = aiResponse.sources || [];

      // Map related signal IDs
      const relatedSignals: string[] = activeSignals.map(s => s.id);

      // Create response message
      const responseMessage: TacticalChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: aiResponse.text,
        timestamp: Date.now(),
        metadata: {
          sources: sources.length > 0 ? sources : undefined,
          relatedSignals: relatedSignals.length > 0 ? relatedSignals : undefined,
          marketContext: {
            price: state.price,
            sentiment: state.sentimentScore,
            regime: getMarketRegime(state.technicals.atr, state.price)
          }
        }
      };

      // Cache the response
      this.cacheQuery(query.query, responseMessage);

      // Add to conversation history
      this.addToHistory(responseMessage);

      return responseMessage;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('[TacticalAI] Error processing query:', errorMessage);

      // Return system message with error details
      const errorResponse = this.createSystemMessage(
        `Unable to process your query at this time. Error: ${errorMessage}. Please try again.`
      );

      return errorResponse;
    }
  }

  /**
   * Get the current conversation history.
   */
  getHistory(): TacticalChatMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Clear all conversation history and query cache.
   */
  clearAll(): void {
    this.conversationHistory = [];
    this.queryCache.clear();
  }
}

// Singleton instance
export const tacticalAI = new TacticalAI();
