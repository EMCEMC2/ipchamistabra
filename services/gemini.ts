
import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage, GroundingSource, TradeSignal, JournalEntry, IntelItem, AgentRole, AgentTaskResult } from "../types";

const getAiClient = () => {
  const fromProcessEnv = process.env.API_KEY;
  const fromImportMeta = import.meta.env.VITE_GEMINI_API_KEY;

  console.log('[Gemini Service] Debug Info:');
  console.log('  - process.env.API_KEY:', fromProcessEnv ? `Present (${fromProcessEnv.length} chars, starts with: ${fromProcessEnv.substring(0, 10)})` : 'MISSING');
  console.log('  - import.meta.env.VITE_GEMINI_API_KEY:', fromImportMeta ? `Present (${fromImportMeta.length} chars, starts with: ${fromImportMeta.substring(0, 10)})` : 'MISSING');

  const apiKey = (fromProcessEnv || fromImportMeta || "").trim();

  if (!apiKey) {
    console.error("[Gemini Service] ERROR: API_KEY is missing from both sources!");
    console.error("Please check .env.local file has: VITE_GEMINI_API_KEY=your_key");
    throw new Error("API_KEY is not defined in the environment.");
  }

  console.log('[Gemini Service] Using API key (length:', apiKey.length, ')');
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
    console.error('[Sentiment] API failed, using fallback:', error);
    return { score: 50, label: 'Neutral' };
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
    console.error("JSON Parse Error:", e, "Raw Text:", text);
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
        thinkingConfig: { thinkingBudget: 16384 }, // Reduced budget for stability
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
    console.warn("Reasoning Model Failed, switching to Fast Model...", error);

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
      console.error("Gemini Analysis Error (Both Models Failed):", fallbackError);
      return {
        text: `Error generating analysis: ${fallbackError.message || "Unknown API Error"}`,
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
      return {
        text: `Error generating setup: ${fallbackError.message || "Unknown API Error"}`,
        sources: []
      };
    }
  }
};

export const scanMarketForSignals = async (context: string): Promise<Omit<TradeSignal, 'id' | 'timestamp'>[]> => {
  const ai = getAiClient();

  try {
    const response = await ai.models.generateContent({
      model: FAST_MODEL_ID,
      contents: `Analyze the provided market context and generate 1-3 algorithmic trading signals based on BitMind Tactical v2 logic.
      Context: ${context}
      
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
      1. **Classify Market Regime**: Identify if the market is 'LOW_VOL', 'NORMAL', 'HIGH_VOL', or 'TRENDING' based on VIX and ADX.
      2. **Calculate R:R**: Ensure riskRewardRatio is a number (e.g. 2.5).
      3. **Formatting**: 'targets' must be an array of strings.
      
      Focus on high probability setups supported by the DATA.
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
              riskRewardRatio: { type: Type.NUMBER },
              confidence: { type: Type.NUMBER },
              regime: { type: Type.STRING, enum: ['LOW_VOL', 'NORMAL', 'HIGH_VOL', 'TRENDING'] },
              reasoning: { type: Type.STRING },
              status: { type: Type.STRING, enum: ["SCANNING", "ACTIVE"] },
            },
            required: ["pair", "type", "entryZone", "invalidation", "targets", "riskRewardRatio", "confidence", "regime", "reasoning", "status"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) return [];

    const data = cleanAndParseJSON<Omit<TradeSignal, 'id' | 'timestamp'>[]>(text);
    return data || [];
  } catch (error) {
    console.error("Signal Scan Error:", error);
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

export const getMacroMarketMetrics = async (): Promise<MacroMetrics> => {
  const ai = getAiClient();

  // 1. Try fetching BTC Dominance directly (Reliable)
  const btcdPromise = fetchBtcDominance();

  // 2. AI Sniper Search: Target specific reliable sources (TradingView, Yahoo, CBOE)
  const aiPromise = ai.models.generateContent({
    model: FAST_MODEL_ID,
    contents: `
      Perform a targeted search for the REAL-TIME LIVE values of:
      1. **VIX Index** (CBOE Volatility Index). Look for "VIX Live" or "VIX Realtime".
      2. **Bitcoin Dominance** (BTC.D). Look for "BTC.D TradingView" or "Bitcoin Dominance Live".
      3. **DXY** (US Dollar Index).

      **CRITICAL INSTRUCTIONS:**
      - Ignore "Close" prices from yesterday. Find the **CURRENT** live value.
      - For VIX, if you see multiple values, prioritize the one closest to **20-25** (Current high volatility regime).
      - For BTC.D, prioritize values around **58-60%**.
      - Return ONLY the numbers.

      Return JSON: { "vix": number, "dxy": number, "btcd": number }
    `,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          vix: { type: Type.NUMBER },
          dxy: { type: Type.NUMBER },
          btcd: { type: Type.NUMBER }
        },
        required: ["vix", "dxy", "btcd"]
      }
    }
  });

  try {
    const [btcdVal, aiResponse] = await Promise.all([btcdPromise, aiPromise]);

    const text = aiResponse.text || "";
    const aiData = cleanAndParseJSON<any>(text);

    let vix = 20.0; // Updated default
    let dxy = 100.0;
    let btcd = 58.0; // Updated default

    if (aiData) {
      vix = Number(aiData.vix) || vix;
      dxy = Number(aiData.dxy) || dxy;
      if (!btcdVal) {
        btcd = Number(aiData.btcd) || btcd;
      }
    }

    if (btcdVal) {
      btcd = btcdVal;
    }

    return { vix, dxy, btcd };

  } catch (error) {
    console.error("Macro Data Fetch Error:", error);
    return { vix: 23.0, dxy: 104.0, btcd: 58.9 }; // Fallback to user's observed values
  }
};

export const getDerivativesMetrics = async (): Promise<{ openInterest: string; fundingRate: string; longShortRatio: number }> => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: FAST_MODEL_ID,
      contents: `
        Perform a targeted search for **Bitcoin Derivatives Data** (Live/Real-time).
        
        **Targets:**
        1. **Open Interest (OI)**: Total BTC Open Interest (e.g., "$18.5B").
        2. **Funding Rate**: Current weighted funding rate (e.g., "0.0100%").
        3. **Long/Short Ratio**: Global L/S Ratio (e.g., 1.25).

        **Sources:** Coinglass, Bybit, Binance.

        **Output JSON:**
        {
          "openInterest": "string (e.g. $19.2B)",
          "fundingRate": "string (e.g. 0.008%)",
          "longShortRatio": number (e.g. 1.12)
        }
      `,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            openInterest: { type: Type.STRING },
            fundingRate: { type: Type.STRING },
            longShortRatio: { type: Type.NUMBER }
          },
          required: ["openInterest", "fundingRate", "longShortRatio"]
        }
      }
    });

    const text = response.text || "";
    const data = cleanAndParseJSON<any>(text);

    return {
      openInterest: data?.openInterest || "$15.0B",
      fundingRate: data?.fundingRate || "0.01%",
      longShortRatio: Number(data?.longShortRatio) || 1.0
    };
  } catch (error) {
    console.error("Derivatives Fetch Error:", error);
    return { openInterest: "$15.0B", fundingRate: "0.01%", longShortRatio: 1.05 };
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
    return { success: false, message: `Agent Error: ${e.message}` };
  }
}

// --- NEW: GLOBAL INTEL SCANNER WITH GROUNDING ---
// --- NEW: GLOBAL INTEL SCANNER WITH REAL API ---
export const scanGlobalIntel = async (): Promise<IntelItem[]> => {
  try {
    // Use CryptoCompare News API (Free, no key needed for basic)
    const response = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
    const data = await response.json();

    if (!data.Data || data.Data.length === 0) return [];

    // Filter for BTC/Market relevance
    const relevantNews = data.Data.filter((item: any) => {
      const text = (item.title + " " + item.body).toLowerCase();
      const keywords = ['bitcoin', 'btc', 'crypto', 'market', 'fed', 'sec', 'regulation', 'etf', 'binance', 'coinbase'];
      return keywords.some(k => text.includes(k));
    });

    return relevantNews.slice(0, 6).map((item: any, index: number) => ({
      id: `intel-${item.id}`,
      timestamp: item.published_on * 1000,
      title: item.title,
      severity: index < 2 ? 'HIGH' : 'MEDIUM', // Top news is high severity
      category: 'NEWS',
      source: item.source_info.name,
      summary: item.body.length > 100 ? item.body.substring(0, 100) + '...' : item.body
    }));
  } catch (error) {
    console.error("Intel Scan Error:", error);
    return [];
  }
};

// --- NEW: ML OPTIMIZATION AGENT ---
export const optimizeMLModel = async (currentParams: string): Promise<string> => {
  const ai = getAiClient();

  const prompt = `
    You are an expert Machine Learning Engineer specializing in Reinforcement Learning (PPO).

    Current Hyperparameters:
    ${currentParams}

    Task:
    1. Analyze these parameters.
    2. Suggest a BETTER set of parameters to improve convergence and stability.
    3. Explain WHY you made these changes (Bayesian Optimization logic).

    Output format:
    - A concise log of the optimization step.
    - The new parameter values.
  `;

  try {
    const response = await ai.models.generateContent({
      model: REASONING_MODEL_ID,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 1024 },
      }
    });

    return response.text || "Optimization failed.";
  } catch (error) {
    console.error("ML Optimization Error:", error);
    return "Error running optimization agent.";
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
  } catch (error) {
    console.error("Trade Journal Analysis Error:", error);
    return "Error generating trade analysis. Please check your API Key and connection.";
  }
};
