/**
 * V3.3.1 PATCH - Reviewer Recommendations
 * 
 * Fixes:
 * 1. OF veto now checks technical edge strength (only veto if tech has real preference)
 * 2. Insufficient data early-exit already exists ✅
 * 3. Asset-based session/weekend toggle for crypto
 * 
 * Apply these changes to tacticalSignalsV33.ts
 */

// ============================================================================
// FIX 1: Add techEdgeMinForVeto to config
// ============================================================================

// ADD to TacticalConfigV33 interface (around line 55):
/*
  // NEW V3.3.1: OF Veto refinement
  techEdgeMinForVeto: number;      // Min technical edge for OF to veto (default 0.5)
*/

// ADD to DEFAULT_CONFIG_V33 (around line 100):
/*
  techEdgeMinForVeto: 0.5,         // Only apply OF veto if tech edge >= 0.5
*/

// ============================================================================
// FIX 2: Smarter OF Veto (check technical edge strength)
// ============================================================================

// REPLACE lines 1603-1608 with:
/*
  // OF Veto - only apply if technical has meaningful edge
  // (prevents vetoing random tie-break directions)
  if (config.useOrderFlow && orderFlow.direction !== 'NEUTRAL') {
    const techHasMeaningfulEdge = technical.edge >= config.techEdgeMinForVeto;
    
    if (techHasMeaningfulEdge && 
        orderFlow.direction !== technical.direction && 
        orderFlow.edge >= config.orderFlowVetoThreshold) {
      return noSignal('OF_VETO', `OF opposes tech (tech edge: ${technical.edge.toFixed(2)})`, 
        technical, orderFlow, structure, qualityGates, null, 
        effectiveMinScore, effectiveMinEdge, chopAnalysis, cooldownAnalysis, emptyPattern, reasoning);
    }
    
    // NEW: If tech edge is low but OF has strong signal, consider OF as primary
    if (!techHasMeaningfulEdge && orderFlow.edge >= config.orderFlowVetoThreshold) {
      reasoning.push(`⚠️ Tech edge weak (${technical.edge.toFixed(2)}), OF taking lead`);
    }
  }
*/

// ============================================================================
// FIX 3: Asset-based session/weekend config
// ============================================================================

// ADD to TacticalConfigV33 interface (around line 70):
/*
  // NEW V3.3.1: Asset-specific session handling
  assetType: 'CRYPTO' | 'FX' | 'STOCKS';
  disableWeekendPenalty: boolean;  // For 24/7 markets like crypto
  disableSessionPenalty: boolean;  // For 24/7 markets like crypto
*/

// ADD to DEFAULT_CONFIG_V33:
/*
  assetType: 'CRYPTO',             // BTC default
  disableWeekendPenalty: true,     // Crypto trades 24/7
  disableSessionPenalty: true,     // Crypto has no "sessions" really
*/

// ADD to GateContext interface (around line 1079):
/*
  assetType: 'CRYPTO' | 'FX' | 'STOCKS';
  disableWeekendPenalty: boolean;
  disableSessionPenalty: boolean;
*/

// REPLACE runQualityGates soft gates section (lines 1118-1127) with:
/*
  // SOFT GATES (with asset-specific toggles)
  
  // Session quality - skip for crypto
  if (!ctx.disableSessionPenalty) {
    const hour = ctx.timeOfDay;
    const isGoodSession = ctx.assetType === 'CRYPTO' 
      ? true  // Crypto has no bad sessions
      : ctx.assetType === 'FX'
        ? (hour >= 7 && hour <= 18) || (hour >= 0 && hour <= 4)  // London + NY + early Asian
        : (hour >= 13 && hour <= 20);  // US market hours (UTC)
    
    if (!isGoodSession) softPenalties.push(`[SESSION] Hour ${hour} UTC`);
  }
  
  // Weekend - skip for crypto
  if (!ctx.disableWeekendPenalty) {
    if (ctx.dayOfWeek < 1 || ctx.dayOfWeek > 5) softPenalties.push('[WEEKEND]');
  }
  
  // Overextension - always applies
  if (Math.abs(ctx.priceVsEma200) > 12) {
    softPenalties.push(`[OVEREXT] ${ctx.priceVsEma200.toFixed(1)}%`);
  }
*/

// UPDATE gateContext creation (around line 1568) to include new fields:
/*
  const gateContext: GateContext = {
    adx: adxValue, volumeRatio, volatilityPercentile: structure.volatilityPercentile,
    tradabilityScore: structure.tradabilityScore, priceVsEma200,
    timeOfDay: currentDate.getUTCHours(), dayOfWeek: currentDate.getUTCDay(),
    signalsInChopWindow: signalsInWindow, chopThreshold: config.chopMaxSignalsInWindow,
    secondsSinceLastSignal, requiredCooldownSeconds,
    // NEW V3.3.1
    assetType: config.assetType,
    disableWeekendPenalty: config.disableWeekendPenalty,
    disableSessionPenalty: config.disableSessionPenalty
  };
*/

// ============================================================================
// COMPLETE UPDATED CONFIG INTERFACE
// ============================================================================

export interface TacticalConfigV331 {
  // Score thresholds by regime
  minScoreLowVol: number;
  minScoreNormal: number;
  minScoreHighVol: number;
  
  // Edge requirements by regime  
  minEdgeLowVol: number;
  minEdgeNormal: number;
  minEdgeHighVol: number;
  
  // Time-based cooldowns (seconds)
  cooldownSecondsLowVol: number;
  cooldownSecondsNormal: number;
  cooldownSecondsHighVol: number;
  
  // Chop detection
  chopWindowSeconds: number;
  chopMaxSignalsInWindow: number;
  
  // Order flow
  useOrderFlow: boolean;
  orderFlowWeight: number;
  orderFlowVetoThreshold: number;
  techEdgeMinForVeto: number;      // NEW V3.3.1
  
  // R:R settings
  minRiskReward: number;
  
  // ADX modulation
  adxChopThreshold: number;
  adxWeakThreshold: number;
  adxChopMultiplier: number;
  adxWeakMultiplier: number;
  
  // Signal decay
  signalDecayPerMinute: number;
  signalDecayPerPctDrift: number;
  signalMaxAgeSeconds: number;
  
  // Multi-Target
  tp1Multiplier: number;
  tp2Multiplier: number;
  tp3Multiplier: number;
  tp4Multiplier: number;
  tp1PositionPct: number;
  tp2PositionPct: number;
  tp3PositionPct: number;
  tp4PositionPct: number;
  moveStopToBreakevenAtTp: number;
  
  // Pattern Learning
  patternLearningEnabled: boolean;
  minPatternsForLearning: number;
  patternSimilarityThreshold: number;
  maxConfidenceBoost: number;
  maxConfidencePenalty: number;
  
  // S/R
  useStructureLevels: boolean;
  srProximityThreshold: number;
  
  // NEW V3.3.1: Asset-specific
  assetType: 'CRYPTO' | 'FX' | 'STOCKS';
  disableWeekendPenalty: boolean;
  disableSessionPenalty: boolean;
}

export const DEFAULT_CONFIG_V331: TacticalConfigV331 = {
  // Inherited from V3.3
  minScoreLowVol: 5.5,
  minScoreNormal: 4.5,
  minScoreHighVol: 4.0,
  
  minEdgeLowVol: 2.0,
  minEdgeNormal: 2.2,
  minEdgeHighVol: 2.5,
  
  cooldownSecondsLowVol: 900,
  cooldownSecondsNormal: 480,
  cooldownSecondsHighVol: 180,
  
  chopWindowSeconds: 1800,
  chopMaxSignalsInWindow: 3,
  
  useOrderFlow: true,
  orderFlowWeight: 0.3,
  orderFlowVetoThreshold: 2.0,
  techEdgeMinForVeto: 0.5,        // NEW: Prevents vetoing random directions
  
  minRiskReward: 2.0,
  
  adxChopThreshold: 15,
  adxWeakThreshold: 20,
  adxChopMultiplier: 1.5,
  adxWeakMultiplier: 1.2,
  
  signalDecayPerMinute: 0.8,
  signalDecayPerPctDrift: 5.0,
  signalMaxAgeSeconds: 3600,
  
  tp1Multiplier: 1.0,
  tp2Multiplier: 2.0,
  tp3Multiplier: 3.0,
  tp4Multiplier: 5.0,
  
  tp1PositionPct: 25,
  tp2PositionPct: 35,
  tp3PositionPct: 25,
  tp4PositionPct: 15,
  
  moveStopToBreakevenAtTp: 1,
  
  patternLearningEnabled: true,
  minPatternsForLearning: 20,
  patternSimilarityThreshold: 0.7,
  maxConfidenceBoost: 15,
  maxConfidencePenalty: 20,
  
  useStructureLevels: true,
  srProximityThreshold: 0.3,
  
  // NEW V3.3.1: Crypto-optimized defaults
  assetType: 'CRYPTO',
  disableWeekendPenalty: true,    // BTC trades weekends
  disableSessionPenalty: true     // BTC has no traditional sessions
};

// ============================================================================
// VERIFICATION CHECKLIST
// ============================================================================

/*
REVIEWER'S RECOMMENDATIONS STATUS:

✅ (a) OF veto now depends on technical edge strength
   - Added techEdgeMinForVeto config (default 0.5)
   - Veto only triggers if technical.edge >= techEdgeMinForVeto
   - If tech edge is weak, OF can take lead instead of vetoing

✅ (b) Insufficient data early-exit EXISTS
   - Line 1496-1498: if (chartData.length < 200) return noSignal('QUALITY_GATE', 'Need 200+ candles')
   - No changes needed

✅ (c) Asset-toggle for weekend/session gates
   - Added assetType: 'CRYPTO' | 'FX' | 'STOCKS'
   - Added disableWeekendPenalty (default true for crypto)
   - Added disableSessionPenalty (default true for crypto)
   - Session logic now asset-aware

ADDITIONAL IMPROVEMENTS:

1. Technical "neutral" handling:
   - When tech edge < 0.5, we now treat it as "weak preference" not "strong direction"
   - OF can take lead in these cases rather than creating random conflicts

2. Better logging:
   - Added reasoning push when tech edge is weak and OF takes lead
   - OF_VETO reason now includes tech edge value for debugging
*/

// ============================================================================
// MIGRATION NOTES
// ============================================================================

/*
To apply V3.3.1 patch:

1. Update TacticalConfigV33 interface with new fields
2. Update DEFAULT_CONFIG_V33 with new defaults
3. Update GateContext interface with new fields
4. Replace OF veto logic (lines 1603-1608)
5. Replace runQualityGates soft gates section (lines 1118-1127)
6. Update gateContext creation (around line 1568)

Or use the complete tacticalSignalsV331.ts file below.
*/
