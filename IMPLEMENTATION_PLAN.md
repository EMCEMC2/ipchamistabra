# IPCHA MISTABRA - Comprehensive Implementation Plan

**Generated:** 2025-11-29
**Current State:** 52% of planned features implemented
**Architecture:** Frontend-only (Direct Gemini, no backend proxy)

---

## Executive Summary

This plan addresses 5 critical gaps and 3 performance issues in priority order.
Estimated effort: 40-60 hours across 8 phases.

---

## Current Architecture

```
DEPLOYED (Railway):
Frontend (Vite) ─────┬──→ Gemini AI (direct, API key in env)
                     ├──→ Binance REST/WS (direct)
                     ├──→ Alternative.me, CoinGecko (direct)
                     └──→ localStorage (persistence)

NOT USED:
server/ folder (trading proxy, audit logs) - exists but not deployed
```

---

## Phase 1: Performance Critical - Store Selectors
**Priority:** CRITICAL | **Effort:** 4-6 hours | **Risk:** Low

### Problem
Every price update (100ms) triggers re-renders in 14+ components because they use `useStore()` without selectors.

### Files to Modify
```
components/AiCommandCenter.tsx
components/ChartPanel.tsx
components/SignalsPanel.tsx
components/OrderFlowPanel.tsx
components/MLCortex.tsx
components/PositionMonitor.tsx
components/ExecutionPanelPro.tsx
components/IntelFeed.tsx
components/TechnicalIndicators.tsx
components/DerivativesPanel.tsx
components/MacroPanel.tsx
components/AgentSwarm.tsx
components/SentimentGauge.tsx
components/VolatilityMeter.tsx
```

### Implementation

#### 1.1 Add shallow import to all component files
```typescript
import { useStore } from '../store/useStore';
import { shallow } from 'zustand/shallow';
```

#### 1.2 Replace broad subscriptions with targeted selectors

**Before (bad):**
```typescript
const { price, priceChange, sentimentScore, derivatives, technicals } = useStore();
```

**After (good):**
```typescript
// Option A: Multiple single selectors (best for unrelated values)
const price = useStore(state => state.price);
const priceChange = useStore(state => state.priceChange);

// Option B: Grouped selector with shallow compare (best for related values)
const { sentimentScore, sentimentLabel } = useStore(
  state => ({
    sentimentScore: state.sentimentScore,
    sentimentLabel: state.sentimentLabel
  }),
  shallow
);

// Option C: Derived selector (best for computed values)
const isPriceUp = useStore(state => state.priceChange >= 0);
```

#### 1.3 Create selector hooks in store/selectors.ts (NEW FILE)
```typescript
import { useStore } from './useStore';
import { shallow } from 'zustand/shallow';

// Price selectors
export const usePrice = () => useStore(state => state.price);
export const usePriceChange = () => useStore(state => state.priceChange);
export const usePriceData = () => useStore(
  state => ({ price: state.price, priceChange: state.priceChange }),
  shallow
);

// Signal selectors
export const useSignals = () => useStore(state => state.signals);
export const useActiveSignals = () => useStore(
  state => state.signals.filter(s => s.status === 'ACTIVE')
);

// Feed selectors
export const useFeeds = () => useStore(state => state.feeds);
export const useFeedHealth = (feedId: string) => useStore(
  state => state.feeds[feedId]?.state || 'connecting'
);

// Technical selectors
export const useTechnicals = () => useStore(state => state.technicals, shallow);
export const useDerivatives = () => useStore(state => state.derivatives, shallow);

// Macro selectors
export const useMacro = () => useStore(state => state.macro, shallow);
export const useSentiment = () => useStore(
  state => ({ score: state.sentimentScore, label: state.sentimentLabel }),
  shallow
);
```

### Verification
```bash
# Before: Open React DevTools Profiler
# Trigger price update via WebSocket
# Count re-rendered components

# After: Same test
# Should see 60-80% fewer re-renders
```

---

## Phase 2: Security - Remove localStorage API Key Storage
**Priority:** CRITICAL | **Effort:** 2-3 hours | **Risk:** Low

### Problem
API key stored in localStorage is exposed to XSS attacks.

### Files to Modify
```
components/ApiKeyModal.tsx
services/gemini.ts
App.tsx
```

### Implementation

#### 2.1 Remove localStorage storage from ApiKeyModal.tsx

**Before:**
```typescript
localStorage.setItem('GEMINI_API_KEY', key);
window.location.reload();
```

**After:**
```typescript
// Don't store in localStorage - rely only on env var
// Show message that key must be set in Railway environment
setError('API key must be configured in Railway environment variables, not in browser.');
```

#### 2.2 Update ApiKeyModal UI to guide users

```typescript
// Add info section explaining:
// 1. Go to Railway dashboard
// 2. Select project
// 3. Add VITE_GEMINI_API_KEY variable
// 4. Redeploy
```

#### 2.3 Remove localStorage fallback from gemini.ts

**Current (gemini.ts:7):**
```typescript
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
```

**Keep as-is** - this is correct. Just ensure no localStorage fallback is added.

#### 2.4 Clean up any existing localStorage keys on app load

```typescript
// In App.tsx useEffect
useEffect(() => {
  // Remove legacy localStorage keys
  localStorage.removeItem('GEMINI_API_KEY');
  localStorage.removeItem('gemini_api_key');
}, []);
```

---

## Phase 3: Chart Overlay - Entry/SL/TP Lines
**Priority:** HIGH | **Effort:** 6-8 hours | **Risk:** Medium

### Problem
Signal data contains entry/SL/TP prices but they're not visualized on the chart.

### Files to Modify
```
components/ChartPanel.tsx
types.ts (add PriceLine types)
```

### Implementation

#### 3.1 Add price line references to ChartPanel state

```typescript
interface ChartPriceLines {
  entry: ISeriesApi<'Line'> | null;
  stopLoss: ISeriesApi<'Line'> | null;
  takeProfit1: ISeriesApi<'Line'> | null;
  takeProfit2: ISeriesApi<'Line'> | null;
}

const [priceLines, setPriceLines] = useState<ChartPriceLines>({
  entry: null,
  stopLoss: null,
  takeProfit1: null,
  takeProfit2: null,
});
```

#### 3.2 Create price line drawing function

```typescript
const drawSignalLevels = (signal: TradeSignal | null) => {
  // Clear existing lines
  Object.values(priceLines).forEach(line => {
    if (line) candleSeries.current?.removePriceLine(line);
  });

  if (!signal || !candleSeries.current) return;

  const entryPrice = parsePrice(signal.entryZone);
  const stopPrice = parsePrice(signal.invalidation);
  const target1 = parsePrice(signal.targets?.[0]);
  const target2 = parsePrice(signal.targets?.[1]);

  const isLong = signal.type === 'LONG';

  // Entry line (white/yellow)
  if (entryPrice) {
    const entryLine = candleSeries.current.createPriceLine({
      price: entryPrice,
      color: '#facc15',
      lineWidth: 2,
      lineStyle: 0, // Solid
      axisLabelVisible: true,
      title: `Entry ${signal.type}`,
    });
    setPriceLines(prev => ({ ...prev, entry: entryLine }));
  }

  // Stop Loss line (red)
  if (stopPrice) {
    const slLine = candleSeries.current.createPriceLine({
      price: stopPrice,
      color: '#ef4444',
      lineWidth: 2,
      lineStyle: 2, // Dashed
      axisLabelVisible: true,
      title: 'SL',
    });
    setPriceLines(prev => ({ ...prev, stopLoss: slLine }));
  }

  // Take Profit lines (green)
  if (target1) {
    const tp1Line = candleSeries.current.createPriceLine({
      price: target1,
      color: '#22c55e',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: 'TP1',
    });
    setPriceLines(prev => ({ ...prev, takeProfit1: tp1Line }));
  }

  if (target2) {
    const tp2Line = candleSeries.current.createPriceLine({
      price: target2,
      color: '#22c55e',
      lineWidth: 1,
      lineStyle: 1, // Dotted
      axisLabelVisible: true,
      title: 'TP2',
    });
    setPriceLines(prev => ({ ...prev, takeProfit2: tp2Line }));
  }
};
```

#### 3.3 Subscribe to active signal changes

```typescript
const activeSignal = useStore(state =>
  state.signals.find(s => s.status === 'ACTIVE')
);

useEffect(() => {
  drawSignalLevels(activeSignal || null);
}, [activeSignal?.id, activeSignal?.entryZone]);
```

#### 3.4 Add entry zone shading (optional enhancement)

```typescript
// Shade area between entry and current price
const drawEntryZone = (entryPrice: number, currentPrice: number, isLong: boolean) => {
  // Use area series or rectangle drawing
  // Green if in profit direction, red if against
};
```

---

## Phase 4: Agent SLAs and Timeout Protection
**Priority:** HIGH | **Effort:** 8-10 hours | **Risk:** Medium

### Problem
No timeout protection on AI calls. Agent can hang indefinitely.

### Files to Create/Modify
```
services/agentSLA.ts (NEW)
services/gemini.ts (add timeout wrapper)
types.ts (add SLA types)
```

### Implementation

#### 4.1 Create services/agentSLA.ts

```typescript
export interface AgentSLA {
  agentId: string;
  timeoutMs: number;
  softTimeoutMs: number;
  critical: boolean;
  degradeConfidenceOnTimeout: number;
}

export const AGENT_SLAS: Record<string, AgentSLA> = {
  'INSPECTOR': {
    agentId: 'INSPECTOR',
    timeoutMs: 8000,
    softTimeoutMs: 5000,
    critical: true,
    degradeConfidenceOnTimeout: 0
  },
  'STRATEGIST': {
    agentId: 'STRATEGIST',
    timeoutMs: 10000,
    softTimeoutMs: 7000,
    critical: false,
    degradeConfidenceOnTimeout: 15
  },
  'QUANT_RESEARCHER': {
    agentId: 'QUANT_RESEARCHER',
    timeoutMs: 10000,
    softTimeoutMs: 7000,
    critical: false,
    degradeConfidenceOnTimeout: 10
  },
  'RISK_OFFICER': {
    agentId: 'RISK_OFFICER',
    timeoutMs: 5000,
    softTimeoutMs: 3000,
    critical: true,
    degradeConfidenceOnTimeout: 0
  },
};

export const GLOBAL_PIPELINE_TIMEOUT = 30000; // 30s max total

export interface AgentExecutionLog {
  runId: string;
  timestamp: number;
  agents: AgentLogEntry[];
  totalDurationMs: number;
  result: 'success' | 'degraded' | 'failed' | 'timeout';
  degradedAgents: string[];
  confidencePenalty: number;
}

export interface AgentLogEntry {
  agentId: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  status: 'success' | 'timeout' | 'error' | 'skipped';
  softTimeoutExceeded: boolean;
  error?: string;
}

// Execution log storage
const executionLogs: AgentExecutionLog[] = [];
const MAX_LOGS = 20;

export const logAgentExecution = (log: AgentExecutionLog) => {
  executionLogs.push(log);
  if (executionLogs.length > MAX_LOGS) {
    executionLogs.shift();
  }
};

export const getExecutionLogs = () => [...executionLogs];
```

#### 4.2 Create timeout wrapper utility

```typescript
// utils/withTimeout.ts
export const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError = 'Operation timed out'
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutError)), timeoutMs)
    )
  ]);
};
```

#### 4.3 Wrap agent calls in gemini.ts

```typescript
import { withTimeout } from '../utils/withTimeout';
import { AGENT_SLAS, logAgentExecution } from './agentSLA';

export const runAgentSimulation = async (
  role: AgentRole,
  context: any
): Promise<AgentTaskResult> => {
  const sla = AGENT_SLAS[role];
  const startTime = Date.now();

  try {
    const result = await withTimeout(
      callGeminiDirect(FAST_MODEL_ID, userContent, config),
      sla?.timeoutMs || 10000,
      `Agent ${role} timed out after ${sla?.timeoutMs}ms`
    );

    const duration = Date.now() - startTime;
    const softExceeded = duration > (sla?.softTimeoutMs || 7000);

    if (softExceeded) {
      console.warn(`[Agent ${role}] Soft timeout exceeded: ${duration}ms`);
    }

    return {
      success: true,
      message: result.text,
      metadata: { duration, softTimeoutExceeded: softExceeded }
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    const isTimeout = error.message.includes('timed out');

    return {
      success: false,
      message: isTimeout
        ? `Agent ${role} timed out (${duration}ms)`
        : `Agent ${role} error: ${error.message}`,
      metadata: {
        duration,
        timedOut: isTimeout,
        confidencePenalty: sla?.degradeConfidenceOnTimeout || 0
      }
    };
  }
};
```

---

## Phase 5: Confluence Factor Weighting
**Priority:** MEDIUM | **Effort:** 6-8 hours | **Risk:** Medium

### Problem
Simple additive scoring without proper weighting or neutralization for missing data.

### Files to Create/Modify
```
services/confluenceEngine.ts (NEW)
types.ts (add ConfluenceFactor types)
components/ConfluencePanel.tsx (NEW or modify existing)
```

### Implementation

#### 5.1 Create types in types.ts

```typescript
export interface ConfluenceFactor {
  id: string;
  name: string;
  met: boolean;
  neutralized: boolean;
  neutralizedReason?: string;
  value: string;
  rawWeight: number;
  effectiveWeight: number;
  sourceFeeds: string[];
  impact: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface ConfluenceResult {
  factors: ConfluenceFactor[];
  score: number;
  maxScore: number;
  neutralizedCount: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
}
```

#### 5.2 Create services/confluenceEngine.ts

```typescript
import { ConfluenceFactor, ConfluenceResult } from '../types';
import { useStore } from '../store/useStore';

const CONFLUENCE_FACTORS: Omit<ConfluenceFactor, 'met' | 'neutralized' | 'effectiveWeight' | 'value'>[] = [
  { id: 'cvd', name: 'CVD Direction', rawWeight: 20, sourceFeeds: ['orderFlow'], impact: 'NEUTRAL' },
  { id: 'oi_price', name: 'OI + Price', rawWeight: 20, sourceFeeds: ['orderFlow', 'binancePrice'], impact: 'NEUTRAL' },
  { id: 'regime', name: 'Market Regime', rawWeight: 15, sourceFeeds: ['regime'], impact: 'NEUTRAL' },
  { id: 'ema_stack', name: 'EMA Stack', rawWeight: 15, sourceFeeds: ['binancePrice'], impact: 'NEUTRAL' },
  { id: 'funding', name: 'Funding Rate', rawWeight: 15, sourceFeeds: ['funding'], impact: 'NEUTRAL' },
  { id: 'sentiment', name: 'Sentiment', rawWeight: 15, sourceFeeds: ['sentiment'], impact: 'NEUTRAL' },
];

export const calculateConfluence = (
  technicals: TechnicalIndicators,
  derivatives: DerivativesData,
  feeds: Record<string, FeedState>,
  sentiment: { score: number; label: string }
): ConfluenceResult => {

  // Step 1: Evaluate each factor
  const evaluatedFactors = CONFLUENCE_FACTORS.map(factor => {
    // Check if source feeds are healthy
    const feedsHealthy = factor.sourceFeeds.every(
      feedId => feeds[feedId]?.state === 'fresh'
    );

    if (!feedsHealthy) {
      return {
        ...factor,
        met: false,
        neutralized: true,
        neutralizedReason: 'Data unavailable',
        effectiveWeight: 0,
        value: 'N/A',
      };
    }

    // Evaluate factor based on current data
    const evaluation = evaluateFactor(factor.id, technicals, derivatives, sentiment);

    return {
      ...factor,
      met: evaluation.met,
      neutralized: false,
      effectiveWeight: factor.rawWeight,
      value: evaluation.value,
      impact: evaluation.impact,
    };
  });

  // Step 2: Redistribute weights (always sum to 100)
  const activeFactors = evaluatedFactors.filter(f => !f.neutralized);
  const totalActiveWeight = activeFactors.reduce((sum, f) => sum + f.rawWeight, 0);

  if (totalActiveWeight > 0 && totalActiveWeight !== 100) {
    const scale = 100 / totalActiveWeight;
    activeFactors.forEach(f => {
      f.effectiveWeight = Math.round(f.rawWeight * scale);
    });

    // Fix rounding to exactly 100
    const sum = activeFactors.reduce((s, f) => s + f.effectiveWeight, 0);
    if (sum !== 100 && activeFactors.length > 0) {
      activeFactors[0].effectiveWeight += (100 - sum);
    }
  }

  // Step 3: Calculate score
  const bullishScore = evaluatedFactors
    .filter(f => f.met && !f.neutralized && f.impact === 'BULLISH')
    .reduce((sum, f) => sum + f.effectiveWeight, 0);

  const bearishScore = evaluatedFactors
    .filter(f => f.met && !f.neutralized && f.impact === 'BEARISH')
    .reduce((sum, f) => sum + f.effectiveWeight, 0);

  const score = bullishScore - bearishScore;
  const direction = score > 20 ? 'LONG' : score < -20 ? 'SHORT' : 'NEUTRAL';

  return {
    factors: evaluatedFactors,
    score: Math.abs(score),
    maxScore: 100,
    neutralizedCount: evaluatedFactors.filter(f => f.neutralized).length,
    direction,
  };
};

const evaluateFactor = (
  factorId: string,
  technicals: TechnicalIndicators,
  derivatives: DerivativesData,
  sentiment: { score: number; label: string }
): { met: boolean; value: string; impact: 'BULLISH' | 'BEARISH' | 'NEUTRAL' } => {
  switch (factorId) {
    case 'cvd':
      // CVD positive = bullish
      return {
        met: true,
        value: 'Accumulation',
        impact: 'BULLISH', // Would come from actual CVD data
      };

    case 'ema_stack':
      const bullishStack = technicals.ema21 > technicals.ema55;
      return {
        met: true,
        value: bullishStack ? 'Bullish Stack' : 'Bearish Stack',
        impact: bullishStack ? 'BULLISH' : 'BEARISH',
      };

    case 'funding':
      const funding = parseFloat(derivatives.fundingRate);
      const crowded = Math.abs(funding) > 0.01;
      return {
        met: crowded,
        value: `${funding.toFixed(4)}%`,
        impact: funding > 0.01 ? 'BEARISH' : funding < -0.01 ? 'BULLISH' : 'NEUTRAL',
      };

    case 'sentiment':
      const extremeFear = sentiment.score < 25;
      const extremeGreed = sentiment.score > 75;
      return {
        met: extremeFear || extremeGreed,
        value: `${sentiment.score} (${sentiment.label})`,
        impact: extremeFear ? 'BULLISH' : extremeGreed ? 'BEARISH' : 'NEUTRAL',
      };

    default:
      return { met: false, value: 'N/A', impact: 'NEUTRAL' };
  }
};
```

---

## Phase 6: State Versioning and Migrations
**Priority:** MEDIUM | **Effort:** 4-6 hours | **Risk:** Low

### Problem
No version tracking for state schema changes. Breaking changes can corrupt persisted data.

### Files to Modify
```
store/useStore.ts
store/migrations.ts (NEW)
types.ts
```

### Implementation

#### 6.1 Create store/migrations.ts

```typescript
export interface StateMeta {
  version: number;
  lastMigration: number;
  migrationLog: MigrationEntry[];
}

export interface MigrationEntry {
  timestamp: number;
  fromVersion: number;
  toVersion: number;
  success: boolean;
  error?: string;
}

export const CURRENT_VERSION = 2;

type Migration = (state: any) => any;

const migrations: Record<number, Migration> = {
  // v1 -> v2: Add riskOfficer state
  1: (state) => ({
    ...state,
    riskOfficer: {
      lastVeto: null,
      vetoHistory: [],
      cooldown: null,
    },
  }),

  // v2 -> v3: Add feed metadata
  2: (state) => ({
    ...state,
    feeds: Object.fromEntries(
      Object.entries(state.feeds || {}).map(([k, v]: [string, any]) => [
        k,
        { ...v, lastGoodData: v.lastGoodData || null }
      ])
    ),
  }),
};

export const migrateState = (persistedState: any): any => {
  const currentVersion = persistedState?._meta?.version || 0;

  if (currentVersion >= CURRENT_VERSION) {
    return persistedState;
  }

  let state = { ...persistedState };
  const log: MigrationEntry[] = state._meta?.migrationLog || [];

  for (let v = currentVersion; v < CURRENT_VERSION; v++) {
    const migration = migrations[v];
    if (migration) {
      try {
        state = migration(state);
        log.push({
          timestamp: Date.now(),
          fromVersion: v,
          toVersion: v + 1,
          success: true,
        });
      } catch (error: any) {
        log.push({
          timestamp: Date.now(),
          fromVersion: v,
          toVersion: v + 1,
          success: false,
          error: error.message,
        });
        console.error(`Migration v${v} -> v${v + 1} failed:`, error);
      }
    }
  }

  state._meta = {
    version: CURRENT_VERSION,
    lastMigration: Date.now(),
    migrationLog: log.slice(-20), // Keep last 20 entries
  };

  return state;
};
```

#### 6.2 Update useStore.ts persist config

```typescript
import { migrateState, CURRENT_VERSION } from './migrations';

// In persist config:
persist(
  (set, get) => ({
    // ... store definition
    _meta: {
      version: CURRENT_VERSION,
      lastMigration: 0,
      migrationLog: [],
    },
  }),
  {
    name: 'ipcha-mistabra-storage',
    version: CURRENT_VERSION,
    migrate: migrateState,
  }
)
```

---

## Phase 7: Signal Composer Integration
**Priority:** MEDIUM | **Effort:** 4-6 hours | **Risk:** Low

### Problem
Consensus voting exists but isn't integrated into the main signal flow.

### Files to Modify
```
services/gemini.ts
services/agentConsensus.ts
components/SignalsPanel.tsx
```

### Implementation

#### 7.1 Add consensus to signal generation in gemini.ts

```typescript
import { generateConsensus } from './agentConsensus';

export const scanMarketForSignals = async (
  context: string,
  tacticalSignal?: TacticalSignalData
): Promise<TradeSignal[]> => {
  // ... existing signal generation ...

  // After generating signals, add consensus
  for (const signal of validatedSignals) {
    const consensus = await generateConsensus({
      price: currentPrice,
      technicals,
      sentiment,
      signal,
    });

    signal.consensus = consensus;
    signal.confidenceBreakdown = calculateConfidenceBreakdown(
      signal.confidence,
      consensus
    );
  }

  return validatedSignals;
};
```

#### 7.2 Display consensus in SignalsPanel

```typescript
// In signal card render:
{signal.consensus && (
  <div className="mt-2 pt-2 border-t border-white/10">
    <div className="text-xs text-gray-400">
      Agent Consensus: {signal.consensus.agreementRatio}
    </div>
    <div className="flex gap-1 mt-1">
      {signal.consensus.votes.map(vote => (
        <span
          key={vote.agentName}
          className={`text-[10px] px-1.5 py-0.5 rounded ${
            vote.vote === 'BULLISH' ? 'bg-green-500/20 text-green-400' :
            vote.vote === 'BEARISH' ? 'bg-red-500/20 text-red-400' :
            'bg-gray-500/20 text-gray-400'
          }`}
        >
          {vote.agentName}: {vote.vote}
        </span>
      ))}
    </div>
  </div>
)}
```

---

## Phase 8: Cleanup and Documentation
**Priority:** LOW | **Effort:** 2-4 hours | **Risk:** None

### Tasks

1. **Remove unused server references**
   - Delete or comment out `VITE_TRADING_API_URL` references in:
     - `services/binanceApi.ts` (if trading not used)
     - `.env.example`

2. **Update .env.example**
```env
# Required
VITE_GEMINI_API_KEY=your_gemini_api_key

# Optional (not currently used)
# VITE_TRADING_API_URL=http://localhost:3000
# VITE_TRADING_API_KEY=your_trading_key
```

3. **Add JSDoc to key functions**
   - `callGeminiDirect`
   - `calculateConfluence`
   - `runAgentSimulation`

4. **Create ARCHITECTURE.md**
   - Document current data flow
   - List all external API dependencies
   - Explain state management patterns

---

## Implementation Order

| Phase | Feature | Effort | Dependencies |
|-------|---------|--------|--------------|
| 1 | Store Selectors | 4-6h | None |
| 2 | Remove localStorage Key | 2-3h | None |
| 3 | Chart Overlay | 6-8h | Phase 1 |
| 4 | Agent SLAs | 8-10h | None |
| 5 | Confluence Engine | 6-8h | Phase 4 |
| 6 | State Versioning | 4-6h | None |
| 7 | Signal Composer | 4-6h | Phase 5 |
| 8 | Cleanup | 2-4h | All |

**Total: 36-51 hours**

---

## Verification Checklist

### Phase 1 Complete When:
- [ ] All 14 components use selectors
- [ ] React DevTools shows <5 re-renders per price update
- [ ] No TypeScript errors

### Phase 2 Complete When:
- [ ] localStorage.getItem('GEMINI_API_KEY') returns null
- [ ] App works with only VITE_GEMINI_API_KEY env var
- [ ] ApiKeyModal shows Railway instructions

### Phase 3 Complete When:
- [ ] Active signal shows entry line on chart
- [ ] SL line visible in red
- [ ] TP lines visible in green
- [ ] Lines update when signal changes

### Phase 4 Complete When:
- [ ] Agent calls timeout after SLA limit
- [ ] Timed out agents return graceful degradation
- [ ] Execution logs show duration for each agent

### Phase 5 Complete When:
- [ ] Confluence shows factor weights summing to 100
- [ ] Missing feed data shows "neutralized" factor
- [ ] Direction derived from weighted scores

### Phase 6 Complete When:
- [ ] State version persisted in localStorage
- [ ] Old state migrates to new schema
- [ ] Migration log shows history

### Phase 7 Complete When:
- [ ] Signal cards show agent consensus
- [ ] Confidence breakdown visible
- [ ] Agreement ratio displayed

### Phase 8 Complete When:
- [ ] No unused imports/variables
- [ ] .env.example accurate
- [ ] ARCHITECTURE.md exists

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Store selector changes break components | Test each component individually after change |
| Chart overlay causes performance issues | Use debouncing on signal changes |
| State migration corrupts data | Keep backup of localStorage before testing |
| Agent timeouts too aggressive | Start with generous timeouts, tune down |

---

## Post-Implementation Monitoring

1. **Performance**: Check React DevTools Profiler weekly
2. **Errors**: Monitor errorMonitor.getStats() in console
3. **Agent Health**: Review execution logs for timeout patterns
4. **User Reports**: Track any data persistence issues

---

**Plan Version:** 1.0
**Author:** Claude Code
**Status:** Ready for Implementation
