
import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage, GroundingSource, TradeSignal, JournalEntry, IntelItem, AgentRole, AgentTaskResult, IntelItemSchema, TradeSignalSchema } from "../types";
import { z } from 'zod';
import { validateSignal, calculateRiskReward, parsePrice, classifyMarketRegime } from '../utils/tradingCalculations';

export const isAiAvailable = (): boolean => {
  const fromProcessEnv = process.env.API_KEY;
  const fromImportMeta = import.meta.env.VITE_GEMINI_API_KEY;
  const fromStorage = typeof window !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY') : null;
  const apiKey = (fromProcessEnv || fromImportMeta || fromStorage || "").trim();
  return !!apiKey;
};

const getAiClient = () => {
  const fromProcessEnv = process.env.API_KEY;
  const fromImportMeta = import.meta.env.VITE_GEMINI_API_KEY;

  const fromStorage = typeof window !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY') : null;
  const apiKey = (fromProcessEnv || fromImportMeta || fromStorage || "").trim();

  if (!apiKey) {
    console.error("[Gemini Service] ERROR: API_KEY is missing from both sources!");
    throw new Error("API_KEY is not defined. Please add VITE_GEMINI_API_KEY to your environment or settings.");
  }

  // Basic validation for Google AI keys (usually start with AIza)
  if (!apiKey.startsWith("AIza")) {
    console.warn("[Gemini Service] WARNING: API Key does not start with 'AIza'. It might be invalid.");
  }

  return new GoogleGenAI({ apiKey });
};

// UPGRADED MODELS
const FAST_MODEL_ID = "gemini-2.0-flash";
const REASONING_MODEL_ID = "gemini-2.0-flash-thinking-exp-01-21"; // Stable thinking model

export interface AiResponse {
  text: string;
  sources: GroundingSource[];
}

export type { TradeSignal, IntelItem, AgentRole, AgentTaskResult } from '../types';

export const getSentimentAnalysis = async (): Promise<{ score: number; label: string }> => {
  try {
    const response = await fetch('https://api.alternative.me/fng/');
    const data = await response.json();
    const score = parseInt(data.data[0].value);
    const label = data.data[0].value_classification;
    return { score, label };
  } catch (error) {
    console.error('[Sentiment] API failed:', error);
    return { score: 0, label: 'No Data' };
  }
};

export interface MacroMetrics {
  vix: number;
  dxy: number;
  btcd: number;
}

/**
 * Helper to aggressively clean and parse JSON from AI responses.
 */
function cleanAndParseJSON<T>(text: string): T | null {
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
    // Silently handle parse errors - caller will use fallback
    return null;
  }
}

const BITMIND_STRATEGY_CONTEXT = `
You are BitMind, an elite algorithmic trading assistant running the "Tactical v2" System.
**System Logic (Proprietary):**
1. **Market Regime Detection:** Uses ATR & ADX. 
   - "LOW_VOL": Compression (Use 27/72 EMAs).
   - "NORMAL": Standard (Use 21/55 EMAs).
   - "HIGH_VOL": Expansion (Use 15/39 EMAs).
   - "TRENDING": Strong Trend (ADX > 25).
2. **Confluence Scoring (0-10):** 
   - Scores based on EMA Alignment, RSI trend, MACD Crossover, and K-Means Support/Resistance Clusters.
   - Buy Signal: Bull Score > 5.0 (Adaptive).
   - Sell Signal: Bear Score > 5.0 (Adaptive).
3. **Risk Management:**
   - Stop Loss: 1.5x ATR.
   - Take Profit: 3.0x ATR.
   
When analyzing, always reference these specific mechanics. Interpret signals based on the detected regime.

**FORMATTING INSTRUCTIONS:**
- Use Markdown headers (##) for main sections.
- Use bullet points for lists.
- Use **bold** for key metrics and emphasis.
- Keep paragraphs short and readable.
- Do NOT use code blocks for normal text.
`;

/**
 * Generate real-time AI market analysis with active signals context
 */
export const generateMarketAnalysis = async (query: string, activeSignals?: TradeSignal[]): Promise<AiResponse> => {
  const ai = getAiClient();

  let contents = query;
  if (activeSignals && activeSignals.length > 0) {
    const signalsStr = activeSignals.map(s =>
      `[${s.pair} ${s.type}] Entry: ${s.entryZone}, Regime: ${s.regime}, Conf: ${s.confidence}%`
    ).join('\n');
    contents += `\n\nCURRENT ACTIVE ALGO SIGNALS:\n${signalsStr}\n\nAnalyze these signals in the context of the strategy.`;
  }

  // Attempt 1: Reasoning Model
  try {
    const response = await ai.models.generateContent({
      model: REASONING_MODEL_ID,
      contents: contents,
      config: {
        systemInstruction: BITMIND_STRATEGY_CONTEXT + " Focus on key metrics: Price action, Support/Resistance, Volume anomalies, VIX (Volatility), DXY (Dollar Index) correlation, and BTC Dominance. Use professional trader terminology. Leverage deep thinking to analyze multi-timeframe market structures before responding.",
        thinkingConfig: { thinkingBudget: 8192 },
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "Analysis unavailable.";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: GroundingSource[] = chunks
      .filter((c: any) => c.web?.uri && c.web?.title)
      .map((c: any) => ({ title: c.web.title, uri: c.web.uri }));

    return { text, sources };

  } catch (error: any) {
    console.warn("[AI Analysis] Reasoning Model Failed, switching to Fast Model...", error.message);

    // Attempt 2: Fast Model Fallback
    try {
      const response = await ai.models.generateContent({
        model: FAST_MODEL_ID,
        contents: contents,
        config: {
          systemInstruction: BITMIND_STRATEGY_CONTEXT + " Provide a concise market analysis. Focus on key levels and current trend.",
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text || "Analysis unavailable.";
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources: GroundingSource[] = chunks
        .filter((c: any) => c.web?.uri && c.web?.title)
        .map((c: any) => ({ title: c.web.title, uri: c.web.uri }));

      return { text, sources };

    } catch (fallbackError: any) {
      console.error("[AI Analysis] Both Models Failed:", fallbackError.message);

      // Dispatch event for leaked/revoked API key errors
      const errorMsg = fallbackError.message || '';
      if (errorMsg.includes('leaked') || errorMsg.includes('403') || errorMsg.includes('PERMISSION_DENIED')) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('gemini-api-error', {
            detail: { message: errorMsg }
          }));
        }
      }

      return {
        text: `Analysis temporarily unavailable. ${fallbackError.message || "API Error"}`,
        sources: []
      };
    }
  }
};

export const generateTradeSetup = async (context: string): Promise<AiResponse> => {
  const ai = getAiClient();

  const prompt = `
    Based on the following market context:
    "${context}"
    
    Generate a hypothetical trade setup for BTC/USD using the BitMind Tactical v2 logic.
    Include:
    1. Bias (Long/Short)
    2. Entry Zone (Align with K-Means Clusters)
    3. Invalidation Level (Stop Loss - 1.5x ATR logic)
    4. Take Profit Targets (conservative and extended)
    5. Key Risk Factors
    
    Think deeply about the probability of this setup. Consider counter-arguments and risk-to-reward ratios before finalizing the plan.
    Keep it strictly formatted and concise.
  `;

  // Attempt 1: Reasoning Model
  try {
    const response = await ai.models.generateContent({
      model: REASONING_MODEL_ID,
      contents: prompt,
      config: {
        systemInstruction: "You are a senior trade strategist running the BitMind Tactical v2 system. Output actionable trade plans based on probability. Use your thinking capabilities to validate levels against recent volatility.",
        thinkingConfig: { thinkingBudget: 16384 }, // Reduced budget
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "Setup unavailable.";
    return { text, sources: [] };

  } catch (error: any) {
    console.warn("Reasoning Model Failed for Setup, switching to Fast Model...", error);

    // Attempt 2: Fast Model Fallback
    try {
      const response = await ai.models.generateContent({
        model: FAST_MODEL_ID,
        contents: prompt,
        config: {
          systemInstruction: "You are a senior trade strategist. Provide a concise, actionable trade setup based on the context.",
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text || "Setup unavailable.";
      return { text, sources: [] };

    } catch (fallbackError: any) {
      console.error("Gemini Setup Error (Both Models Failed):", fallbackError);

      // Dispatch event for leaked/revoked API key errors
      const errorMsg = fallbackError.message || '';
      if (errorMsg.includes('leaked') || errorMsg.includes('403') || errorMsg.includes('PERMISSION_DENIED')) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('gemini-api-error', {
            detail: { message: errorMsg }
          }));
        }
      }

      return {
        text: `Error generating setup: ${fallbackError.message || "Unknown API Error"}`,
        sources: []
      };
    }
  }
};

export const scanMarketForSignals = async (
  context: string,
  tacticalSignal?: { signal: any; bullScore: number; bearScore: number; regime: string; reasoning: string[] }
): Promise<Omit<TradeSignal, 'id' | 'timestamp'>[]> => {
  const ai = getAiClient();

  // If Tactical v2 generated a signal, enhance it with AI validation
  const tacticalContext = tacticalSignal
    ? `\n\nTACTICAL V2 SIGNAL (Rule-based system):
       Type: ${tacticalSignal.signal?.type || 'NONE'}
       Bull Score: ${tacticalSignal.bullScore.toFixed(1)}
       Bear Score: ${tacticalSignal.bearScore.toFixed(1)}
       Regime: ${tacticalSignal.regime}
       Reasoning: ${tacticalSignal.reasoning.join(' | ')}

       **IMPORTANT: Validate this signal. If scores are strong (>5.0) and reasoning is sound, include it.**`
    : '';

  try {
    const response = await ai.models.generateContent({
      model: FAST_MODEL_ID,
      contents: `Analyze the provided market context and generate 1-3 algorithmic trading signals based on BitMind Tactical v2 logic.
      Context: ${context}${tacticalContext}

      **System Rules (STRICTLY FOLLOW PROVIDED INDICATORS):**
      - **RSI**: Use the provided "RSI (14)" value. Overbought > 70, Oversold < 30.
      - **Trend**: Use the provided "Trend Alignment" (EMA 21 vs 55).
      - **Momentum**: Use the provided "MACD Histogram".
      - **Strength**: Use "ADX". If ADX > 25, trend is strong.

      **Strategy Logic:**
      - **Long**: Bullish Trend + RSI < 60 + Positive Momentum.
      - **Short**: Bearish Trend + RSI > 40 + Negative Momentum.
      - **Mean Reversion**: RSI Extremes (>75 or <25) + Low Volatility (VIX < 15).

      **Task Requirements:**
      1. Provide entry zone, stop loss, and target prices as numbers or ranges (e.g., "84200" or "84000-84500")
      2. Provide confidence 0-100
      3. Explain reasoning clearly

      **IMPORTANT:** Do NOT calculate R:R or regime yourself. Just provide the prices and confidence.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              pair: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["LONG", "SHORT"] },
              entryZone: { type: Type.STRING },
              invalidation: { type: Type.STRING },
              targets: { type: Type.ARRAY, items: { type: Type.STRING } },
              confidence: { type: Type.NUMBER },
              reasoning: { type: Type.STRING },
              status: { type: Type.STRING, enum: ["SCANNING", "ACTIVE"] },
            },
            required: ["pair", "type", "entryZone", "invalidation", "targets", "confidence", "reasoning", "status"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) return [];

    const rawData = cleanAndParseJSON<any[]>(text);
    if (!rawData) return [];

    // CRITICAL: Validate and calculate R:R in TypeScript (NOT AI)
    const validatedSignals: TradeSignal[] = [];

    for (const rawSignal of rawData) {
      // Extract technical data from context for regime calculation
      const contextMatch = context.match(/ADX[^\d]*(\d+\.?\d*)/i);
      const adx = contextMatch ? parseFloat(contextMatch[1]) : 0;

      // Determine regime based on actual data (not AI hallucination)
      let regime: TradeSignal['regime'] = 'NORMAL';
      if (adx > 25) {
        regime = 'TRENDING';
      } else {
        const vixMatch = context.match(/VIX[^\d]*(\d+\.?\d*)/i);
        const vix = vixMatch ? parseFloat(vixMatch[1]) : 20;
        if (vix < 15) regime = 'LOW_VOL';
        if (vix > 25) regime = 'HIGH_VOL';
      }

      // Parse prices
      const entry = parsePrice(rawSignal.entryZone);
      const stop = parsePrice(rawSignal.invalidation);
      const target = parsePrice(rawSignal.targets?.[0] || '');

      if (!entry || !stop || !target) {
        console.warn('[Signal Validation] Skipping invalid signal (bad prices):', rawSignal);
        continue;
      }

      // Calculate REAL R:R (TypeScript, not AI)
      const rr = calculateRiskReward(entry, stop, target);

      // Build validated signal
      const validated = validateSignal({
        ...rawSignal,
        regime, // Our calculation
        riskRewardRatio: rr, // Our calculation
      });

      if (validated) {
        validatedSignals.push(validated);
      }
    }

    console.log(`[Signal Scan] Generated ${validatedSignals.length} validated signals (from ${rawData.length} raw)`);
    return validatedSignals;

  } catch (error: any) {
    console.error("Signal Scan Error:", error);

    // Dispatch event for leaked/revoked API key errors
    const errorMsg = error.message || '';
    if (errorMsg.includes('leaked') || errorMsg.includes('403') || errorMsg.includes('PERMISSION_DENIED')) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gemini-api-error', {
          detail: { message: errorMsg }
        }));
      }
    }

    return [];
  }
};

// Helper to fetch BTC Dominance from CoinGecko
const fetchBtcDominance = async (): Promise<number | null> => {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/global');
    if (!response.ok) throw new Error('CoinGecko API failed');
    const data = await response.json();
    return data.data.market_cap_percentage.btc || null;
  } catch (error) {
    console.warn("CoinGecko BTC.D Fetch Error:", error);
    return null;
  }
};



// --- NEW: AGENT SIMULATION WITH STRUCTURED OUTPUT ---
export const runAgentSimulation = async (role: AgentRole, context: any): Promise<AgentTaskResult> => {
  const ai = getAiClient();
  let systemPrompt = "";
  let userContent = "";

  // Define specific personas
  const personas: Record<AgentRole, string> = {
    'ORCHESTRATOR': "You are OVERMIND, the system coordinator. You delegate tasks and synthesize results.",
    'INSPECTOR': "You are WATCHDOG, the system inspector. You verify data integrity and flag anomalies.",
    'STRATEGIST': "You are VANGUARD, the lead strategist. You determine market bias and trade direction.",
    'QUANT_RESEARCHER': "You are DATAMIND, the quant researcher. You analyze statistical features and correlations.",
    'MODEL_OPTIMIZER': "You are OPTIMUS, the ML engineer. You tune hyperparameters for the current regime.",
    'RISK_OFFICER': "You are IRONCLAD, the risk officer. You protect capital and enforce position limits.",
    'ENGINEER': "You are BUILDER, the software engineer. You generate code snippets for backtesting."
  };

  systemPrompt = personas[role] || "You are an AI agent.";

  switch (role) {
    case 'INSPECTOR':
      userContent = `Inspect this system state: ${JSON.stringify(context)}. Are metrics (Price, VIX) valid? Is the data fresh? Output a brief status report.`;
      break;
    case 'STRATEGIST':
      userContent = `Context: ${JSON.stringify(context)}. Look at Price Change, Sentiment, and VIX. Should we be looking for Longs, Shorts, or Wait? Provide a 1-sentence strategic directive.`;
      break;
    case 'QUANT_RESEARCHER':
      userContent = `Market Context: ${JSON.stringify(context)}. Which features should the Neural Network prioritize? Options: Momentum, Mean Reversion, Order Flow, Sentiment. Select the top 2 features and explain why in 1 sentence.`;
      break;
    case 'RISK_OFFICER':
      userContent = `Balance: ${context.balance}. Positions: ${context.positions?.length || 0}. Calculate if the user is over-leveraged or safe. Output a strict decision: "SAFE" or "CAUTION" followed by reasoning.`;
      break;
    default:
      userContent = `Analyze the following context: ${JSON.stringify(context)}`;
  }

  try {
    console.log(`[runAgentSimulation] Starting for role: ${role}`);
    console.log(`[runAgentSimulation] Model: ${FAST_MODEL_ID}`);
    console.log(`[runAgentSimulation] Context:`, context);

    const response = await ai.models.generateContent({
      model: FAST_MODEL_ID,
      contents: userContent,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            success: { type: Type.BOOLEAN },
            message: { type: Type.STRING }
          },
          required: ["success", "message"]
        }
      }
    });

    const text = response.text;
    console.log(`[runAgentSimulation] Response received for ${role}:`, text);

    if (!text) {
      console.error(`[runAgentSimulation] No response text from agent ${role}`);
      return { success: false, message: "No response from agent." };
    }

    const result = JSON.parse(text) as AgentTaskResult;
    console.log(`[runAgentSimulation] Parsed result for ${role}:`, result);
    return result;
  } catch (e: any) {
    console.error(`[runAgentSimulation] ERROR for ${role}:`, e);
    console.error(`[runAgentSimulation] Error details:`, {
      message: e.message,
      stack: e.stack,
      response: e.response?.data
    });

    // Dispatch event for leaked/revoked API key errors
    const errorMsg = e.message || '';
    if (errorMsg.includes('leaked') || errorMsg.includes('403') || errorMsg.includes('PERMISSION_DENIED')) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gemini-api-error', {
          detail: { message: errorMsg }
        }));
      }
    }

    return { success: false, message: `Agent Error: ${e.message}` };
  }
}

// --- GLOBAL INTEL SCANNER: BTC-FOCUSED WITH SENTIMENT ANALYSIS ---
// --- FALLBACK MOCK DATA ---


export const scanGlobalIntel = async (): Promise<IntelItem[]> => {
  const ai = getAiClient();

  try {
    const prompt = `
      ROLE: Global Intelligence Officer (WATCHDOG)
      TASK: Scan for REAL-TIME crypto market news, specifically affecting Bitcoin (BTC).
      
      SOURCES TO SIMULATE/SEARCH:
      1. NEWS: Coindesk, Cointelegraph, Bloomberg Crypto
      2. MACRO: Fed meetings, CPI data, Interest rates
      3. ONCHAIN: Large BTC transfers, miner activity, exchange reserves
      4. WHALE: Major BTC purchases/sales (> $50M)

      **SENTIMENT ANALYSIS (Critical):**
      Analyze if the news is BULLISH, BEARISH, or NEUTRAL for Bitcoin price:
      - BULLISH examples: Fed rate cuts, positive ETF flows, institutional adoption, bullish whale buys
      - BEARISH examples: Fed rate hikes, exchange hacks, negative regulations, whale dumps
      - NEUTRAL: Informative updates without clear directional bias

      Return a JSON array of 4-6 items:
      [
        {
          "id": "unique_id",
          "title": "Concise headline (BTC-specific)",
          "severity": "HIGH" | "MEDIUM" | "LOW",
          "category": "NEWS" | "ONCHAIN" | "MACRO" | "WHALE",
          "timestamp": ${Date.now()},
          "source": "Source name",
          "summary": "One sentence explaining BTC impact",
          "btcSentiment": "BULLISH" | "BEARISH" | "NEUTRAL"
        }
      ]

      Use real-time search to find ACTUAL current events. Do NOT fabricate news.
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
      console.warn("[Intel] No response text");
      return [];
    }

    const parsed = cleanAndParseJSON(text);

    if (!parsed) {
      console.warn("[Intel] API response couldn't be parsed");
      return [];
    }

    // Ensure parsed is an array
    const arrayData = Array.isArray(parsed) ? parsed : [parsed];

    try {
      const validated = z.array(IntelItemSchema).safeParse(arrayData);
      if (validated.success) {
        console.log("✅ Intel fetched:", validated.data.length, "BTC-related items");
        return validated.data as IntelItem[];
      } else {
        console.warn("[Intel] Schema validation failed");
        return []; // Fallback on validation failure
      }
    } catch (validationError) {
      console.warn("[Intel] Validation error");
      return []; // Fallback on validation error
    }

  } catch (e: any) {
    console.error("Intel Scan Error:", e);

    // Dispatch event for leaked/revoked API key errors
    const errorMsg = e.message || '';
    if (errorMsg.includes('leaked') || errorMsg.includes('403') || errorMsg.includes('PERMISSION_DENIED')) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gemini-api-error', {
          detail: { message: errorMsg }
        }));
      }
    }

    return []; // Fallback on API error
  }
};



export const analyzeTradeJournal = async (entry: JournalEntry): Promise<string> => {
  const ai = getAiClient();

  const prompt = `
    You are a professional trading psychologist and performance analyst.

    Analyze the following trade execution:

    Pair: ${entry.pair}
    Type: ${entry.type}
    Entry Price: $${entry.entryPrice}
    Exit Price: $${entry.exitPrice}
    Size: ${entry.size}
    PnL: ${entry.pnl >= 0 ? '+' : ''}${entry.pnl.toFixed(2)}
    ROE: ${entry.pnlPercent.toFixed(2)}%
    Duration: ${Math.round((entry.exitTime - entry.entryTime) / 60000)} minutes
    Notes: ${entry.notes || 'None'}

    Provide a concise post-trade analysis covering:
    1. Execution Quality: Was the entry/exit timing optimal?
    2. Risk Management: Was the position size appropriate?
    3. Psychology: What emotional factors may have influenced this trade?
    4. Key Takeaway: One actionable lesson for future trades

    Keep it under 200 words. Be honest and constructive.
  `;

  try {
    const response = await ai.models.generateContent({
      model: FAST_MODEL_ID,
      contents: prompt,
      config: {
        systemInstruction: BITMIND_STRATEGY_CONTEXT + " Analyze this trade from the perspective of the Tactical v2 system. Was it aligned with regime detection rules?",
      }
    });

    return response.text || "Analysis unavailable.";
  } catch (error: any) {
    console.error("Trade Journal Analysis Error:", error);

    // Dispatch event for leaked/revoked API key errors
    const errorMsg = error.message || '';
    if (errorMsg.includes('leaked') || errorMsg.includes('403') || errorMsg.includes('PERMISSION_DENIED')) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gemini-api-error', {
          detail: { message: errorMsg }
        }));
      }
    }

    return "Error generating trade analysis. Please check your API Key and connection.";
  }
};
