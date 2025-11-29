/**
 * AI Service Interface
 * Abstracts AI/LLM operations for analysis
 */

export interface AIAnalysisRequest {
  prompt: string;
  context?: Record<string, unknown>;
  maxTokens?: number;
  temperature?: number;
}

export interface AIAnalysisResponse {
  content: string;
  model: string;
  tokensUsed: number;
  timestamp: number;
}

export interface SentimentAnalysisResult {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  score: number; // 0-100
  confidence: number; // 0-100
  reasoning: string;
}

export interface MarketAnalysisResult {
  summary: string;
  signals: {
    type: 'LONG' | 'SHORT' | 'NEUTRAL';
    confidence: number;
    reasoning: string;
  }[];
  risks: string[];
  opportunities: string[];
}

export interface TradeReviewResult {
  score: number; // 0-100
  feedback: string;
  strengths: string[];
  improvements: string[];
  lessonsLearned: string[];
}

/**
 * AI Service Interface
 * All AI services must implement this interface
 */
export interface IAIService {
  /**
   * Service identifier
   */
  readonly name: string;

  /**
   * Check if AI service is available
   */
  isAvailable(): boolean;

  /**
   * Raw prompt completion
   */
  complete(request: AIAnalysisRequest): Promise<AIAnalysisResponse>;

  /**
   * Analyze market sentiment from data
   */
  analyzeSentiment(
    marketData: Record<string, unknown>
  ): Promise<SentimentAnalysisResult>;

  /**
   * Generate market analysis
   */
  analyzeMarket(
    marketData: Record<string, unknown>
  ): Promise<MarketAnalysisResult>;

  /**
   * Review a completed trade
   */
  reviewTrade(
    tradeData: Record<string, unknown>
  ): Promise<TradeReviewResult>;

  /**
   * Generate trading strategy suggestions
   */
  suggestStrategy(
    context: Record<string, unknown>
  ): Promise<string>;
}

/**
 * AI Agent Interface
 * Specialized AI agents for specific tasks
 */
export interface IAIAgent {
  /**
   * Agent identifier
   */
  readonly id: string;

  /**
   * Agent role/name
   */
  readonly name: string;

  /**
   * Agent description
   */
  readonly description: string;

  /**
   * Execute agent's primary function
   */
  execute(context: Record<string, unknown>): Promise<{
    result: unknown;
    confidence: number;
    reasoning: string;
  }>;

  /**
   * Get agent's current status
   */
  getStatus(): 'idle' | 'working' | 'success' | 'failure' | 'timeout';
}
