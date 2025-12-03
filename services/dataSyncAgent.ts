/**
 * DATA SYNC AGENT
 * Centralized controller for data validation, consistency, and synchronization
 * Ensures all data across components is correct and in sync
 */

import { z } from 'zod';
import { useStore } from '../store/useStore';
import { ChartDataPoint, Position } from '../types';
import { AggrStats } from '../types/aggrTypes';
import { errorMonitor, captureError, captureWarning, addBreadcrumb } from './errorMonitor';

// ==================== TYPE DEFINITIONS ====================

export type DataSourceId =
  | 'BINANCE_PRICE'
  | 'BINANCE_CHART'
  | 'MACRO_DATA'
  | 'ORDER_FLOW'
  | 'POSITIONS'
  | 'SIGNALS';

export type SyncStatus = 'connected' | 'syncing' | 'stale' | 'disconnected' | 'error';

export interface DataSourceStatus {
  id: DataSourceId;
  status: SyncStatus;
  lastUpdate: number;
  lastError: string | null;
  errorCount: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{ field: string; message: string; value: any }>;
  warnings: Array<{ field: string; message: string }>;
  correctedData?: any;
}

export interface ConsistencyResult {
  checkId: string;
  passed: boolean;
  details: string;
  discrepancy?: { expected: any; actual: any; delta?: number };
  autoFixed?: boolean;
}

export interface SyncAlert {
  id: string;
  type: 'DATA_STALE' | 'VALIDATION_ERROR' | 'CONSISTENCY_FAIL' | 'SOURCE_ERROR' | 'AUTO_FIX' | 'HEALTH_DEGRADED';
  severity: 'critical' | 'high' | 'medium' | 'low';
  sourceId?: DataSourceId;
  message: string;
  timestamp: number;
  resolved: boolean;
}

// ==================== ZOD SCHEMAS ====================

const PriceSchema = z.number().positive().max(1000000);

const ChartDataPointSchema = z.object({
  time: z.number().positive(),
  open: z.number().positive(),
  high: z.number().positive(),
  low: z.number().positive(),
  close: z.number().positive(),
  volume: z.number().nonnegative()
});

const PositionSchema = z.object({
  id: z.string().min(1),
  pair: z.string().min(1),
  type: z.enum(['LONG', 'SHORT']),
  entryPrice: z.number().positive(),
  size: z.number().positive(),
  leverage: z.number().positive().max(125),
  liquidationPrice: z.number().positive(),
  stopLoss: z.number().nonnegative(),
  takeProfit: z.number().nonnegative(),
  pnl: z.number(),
  pnlPercent: z.number(),
  timestamp: z.number().positive()
});

const MacroDataSchema = z.object({
  vix: z.number().nonnegative().max(100),
  dxy: z.number().nonnegative().max(200),
  btcd: z.number().nonnegative().max(100)
});

// ==================== ORDER FLOW SCHEMAS ====================

const CVDDataSchema = z.object({
  timestamp: z.number().positive(),
  buyVolume: z.number().nonnegative(),
  sellVolume: z.number().nonnegative(),
  delta: z.number(),
  cumulativeDelta: z.number()
});

const MarketPressureSchema = z.object({
  buyPressure: z.number().min(0).max(100),
  sellPressure: z.number().min(0).max(100),
  netPressure: z.number().min(-100).max(100),
  dominantSide: z.enum(['buy', 'sell', 'neutral']),
  strength: z.enum(['weak', 'moderate', 'strong', 'extreme'])
});

const ExchangeFlowSchema = z.object({
  exchange: z.string().min(1),
  buyVolume: z.number().nonnegative(),
  sellVolume: z.number().nonnegative(),
  netFlow: z.number(),
  dominance: z.number().min(0).max(100)
});

const OpenInterestDataSchema = z.object({
  openInterest: z.number().nonnegative(),
  openInterestUsd: z.number().nonnegative(),
  change1h: z.number(),
  timestamp: z.number().positive()
}).optional();

const LongShortRatioSchema = z.object({
  longRatio: z.number().min(0).max(100),
  shortRatio: z.number().min(0).max(100),
  longShortRatio: z.number().nonnegative(),
  topTraderRatio: z.number().nonnegative(),
  timestamp: z.number().positive()
}).optional();

const FundingDataSchema = z.object({
  rate: z.number(),
  predictedRate: z.number(),
  nextFundingTime: z.number().positive(),
  annualizedRate: z.number()
}).optional();

const AggrLiquidationSchema = z.object({
  exchange: z.string().min(1),
  timestamp: z.number().positive(),
  price: z.number().positive(),
  amount: z.number().nonnegative(),
  side: z.enum(['long', 'short']),
  usdValue: z.number().nonnegative()
});

const AggrTradeSchema = z.object({
  exchange: z.string().min(1),
  timestamp: z.number().positive(),
  price: z.number().positive(),
  amount: z.number().nonnegative(),
  side: z.enum(['buy', 'sell']),
  isLiquidation: z.boolean(),
  usdValue: z.number().nonnegative()
});

const BanStatusSchema = z.object({
  isBanned: z.boolean(),
  expiryTime: z.number().positive(),
  remainingMinutes: z.number().nonnegative()
}).optional();

const AggrStatsSchema = z.object({
  totalVolume: z.number().nonnegative(),
  buyVolume: z.number().nonnegative(),
  sellVolume: z.number().nonnegative(),
  largeTradeCount: z.number().nonnegative().int(),
  liquidationCount: z.number().nonnegative().int(),
  liquidationVolume: z.number().nonnegative(),
  cvd: CVDDataSchema,
  pressure: MarketPressureSchema,
  exchanges: z.array(ExchangeFlowSchema),
  recentLiquidations: z.array(AggrLiquidationSchema),
  recentLargeTrades: z.array(AggrTradeSchema),
  openInterest: OpenInterestDataSchema,
  longShortRatio: LongShortRatioSchema,
  funding: FundingDataSchema,
  banned: BanStatusSchema,
  lastUpdate: z.number().positive().optional()
}).passthrough(); // Allow unknown fields for forward compatibility

// ==================== DATA SOURCE CONFIGS ====================

const DATA_SOURCE_CONFIGS: Record<DataSourceId, { maxStaleness: number; priority: number }> = {
  BINANCE_PRICE: { maxStaleness: 5000, priority: 1 },
  BINANCE_CHART: { maxStaleness: 60000, priority: 2 },
  MACRO_DATA: { maxStaleness: 120000, priority: 3 },
  ORDER_FLOW: { maxStaleness: 5000, priority: 2 },
  POSITIONS: { maxStaleness: 30000, priority: 1 },
  SIGNALS: { maxStaleness: 14400000, priority: 3 }
};

// ==================== DATA SYNC AGENT CLASS ====================

class DataSyncAgent {
  private isRunning: boolean = false;
  private startTime: number | null = null;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private consistencyCheckInterval: ReturnType<typeof setInterval> | null = null;

  private sources: Record<DataSourceId, DataSourceStatus> = {
    BINANCE_PRICE: { id: 'BINANCE_PRICE', status: 'disconnected', lastUpdate: 0, lastError: null, errorCount: 0 },
    BINANCE_CHART: { id: 'BINANCE_CHART', status: 'disconnected', lastUpdate: 0, lastError: null, errorCount: 0 },
    MACRO_DATA: { id: 'MACRO_DATA', status: 'disconnected', lastUpdate: 0, lastError: null, errorCount: 0 },
    ORDER_FLOW: { id: 'ORDER_FLOW', status: 'disconnected', lastUpdate: 0, lastError: null, errorCount: 0 },
    POSITIONS: { id: 'POSITIONS', status: 'connected', lastUpdate: Date.now(), lastError: null, errorCount: 0 },
    SIGNALS: { id: 'SIGNALS', status: 'connected', lastUpdate: Date.now(), lastError: null, errorCount: 0 }
  };

  private alerts: SyncAlert[] = [];
  private eventListeners: Array<(event: any) => void> = [];
  private lastOrderFlowStats: AggrStats | null = null;

  constructor() {
    this.log('info', 'DataSyncAgent initialized');
  }

  // ==================== LIFECYCLE ====================

  start(): void {
    if (this.isRunning) {
      this.log('warn', 'Agent already running');
      return;
    }

    this.isRunning = true;
    this.startTime = Date.now();
    addBreadcrumb('DataSyncAgent started', 'sync');

    this.healthCheckInterval = setInterval(() => this.runHealthCheck(), 10000);
    this.consistencyCheckInterval = setInterval(() => this.runConsistencyChecks(), 30000);

    this.runHealthCheck();
    this.runConsistencyChecks();

    this.emit({ type: 'AGENT_STARTED', timestamp: Date.now() });
    this.log('info', 'Agent started');
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.startTime = null;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.consistencyCheckInterval) {
      clearInterval(this.consistencyCheckInterval);
      this.consistencyCheckInterval = null;
    }

    this.emit({ type: 'AGENT_STOPPED', timestamp: Date.now() });
    this.log('info', 'Agent stopped');
  }

  // ==================== DATA SOURCE TRACKING ====================

  updateSourceStatus(sourceId: DataSourceId, status: SyncStatus, error?: string): void {
    const source = this.sources[sourceId];
    const prevStatus = source.status;

    source.status = status;
    source.lastUpdate = Date.now();

    if (error) {
      source.lastError = error;
      source.errorCount++;
      this.createAlert('SOURCE_ERROR', 'high', `${sourceId} error: ${error}`, sourceId);
    } else if (status === 'connected' && prevStatus !== 'connected') {
      source.errorCount = 0;
      source.lastError = null;
      this.resolveAlerts(sourceId);
    }

    this.emit({ type: 'SOURCE_STATUS_CHANGED', sourceId, status, timestamp: Date.now() });
  }

  markDataUpdated(sourceId: DataSourceId): void {
    this.sources[sourceId].lastUpdate = Date.now();
    this.sources[sourceId].status = 'connected';
  }

  // ==================== DATA VALIDATION ====================

  validatePrice(price: number): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] };

    try {
      PriceSchema.parse(price);
    } catch (e) {
      if (e instanceof z.ZodError) {
        result.isValid = false;
        e.issues.forEach((issue) => {
          result.errors.push({ field: 'price', message: issue.message, value: price });
        });
      }
    }

    if (price <= 0) {
      result.isValid = false;
      result.errors.push({ field: 'price', message: 'Price must be positive', value: price });
    }

    if (price > 500000) {
      result.warnings.push({ field: 'price', message: 'Price seems unusually high' });
    }

    if (!result.isValid) {
      this.createAlert('VALIDATION_ERROR', 'high', `Invalid price: ${price}`, 'BINANCE_PRICE');
    }

    return result;
  }

  validateChartData(data: ChartDataPoint[]): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] };

    if (!Array.isArray(data) || data.length === 0) {
      result.isValid = false;
      result.errors.push({ field: 'chartData', message: 'Chart data must be non-empty array', value: data });
      return result;
    }

    const invalidCandles: number[] = [];
    data.forEach((candle, index) => {
      try {
        ChartDataPointSchema.parse(candle);

        if (candle.high < candle.low) {
          invalidCandles.push(index);
          result.errors.push({
            field: `chartData[${index}]`,
            message: 'High must be >= Low',
            value: candle
          });
        }

        if (candle.high < candle.open || candle.high < candle.close) {
          result.warnings.push({
            field: `chartData[${index}]`,
            message: 'High should be >= Open and Close'
          });
        }

        if (candle.low > candle.open || candle.low > candle.close) {
          result.warnings.push({
            field: `chartData[${index}]`,
            message: 'Low should be <= Open and Close'
          });
        }
      } catch (e) {
        invalidCandles.push(index);
        if (e instanceof z.ZodError) {
          e.issues.forEach((issue) => {
            result.errors.push({
              field: `chartData[${index}].${issue.path.join('.')}`,
              message: issue.message,
              value: candle
            });
          });
        }
      }
    });

    for (let i = 1; i < data.length; i++) {
      if (data[i].time <= data[i - 1].time) {
        result.warnings.push({
          field: `chartData[${i}].time`,
          message: 'Time sequence should be ascending'
        });
      }
    }

    result.isValid = invalidCandles.length === 0;

    if (!result.isValid) {
      this.createAlert('VALIDATION_ERROR', 'medium', `Invalid chart data: ${invalidCandles.length} candles`, 'BINANCE_CHART');
    }

    return result;
  }

  validatePosition(position: Position): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [], correctedData: { ...position } };

    try {
      PositionSchema.parse(position);
    } catch (e) {
      if (e instanceof z.ZodError) {
        result.isValid = false;
        e.issues.forEach((issue) => {
          result.errors.push({
            field: issue.path.join('.'),
            message: issue.message,
            value: position
          });
        });
      }
    }

    if (position.type === 'LONG') {
      if (position.stopLoss > 0 && position.stopLoss >= position.entryPrice) {
        result.warnings.push({
          field: 'stopLoss',
          message: 'Stop loss should be below entry for LONG positions'
        });
      }
      if (position.takeProfit > 0 && position.takeProfit <= position.entryPrice) {
        result.warnings.push({
          field: 'takeProfit',
          message: 'Take profit should be above entry for LONG positions'
        });
      }
    } else {
      if (position.stopLoss > 0 && position.stopLoss <= position.entryPrice) {
        result.warnings.push({
          field: 'stopLoss',
          message: 'Stop loss should be above entry for SHORT positions'
        });
      }
      if (position.takeProfit > 0 && position.takeProfit >= position.entryPrice) {
        result.warnings.push({
          field: 'takeProfit',
          message: 'Take profit should be below entry for SHORT positions'
        });
      }
    }

    const liqPriceValid = this.validateLiquidationPrice(position);
    if (!liqPriceValid.passed) {
      result.warnings.push({
        field: 'liquidationPrice',
        message: liqPriceValid.details
      });

      if (liqPriceValid.discrepancy?.expected) {
        result.correctedData.liquidationPrice = liqPriceValid.discrepancy.expected;
      }
    }

    return result;
  }

  validateMacroData(data: { vix: number; dxy: number; btcd: number }): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] };

    try {
      MacroDataSchema.parse(data);
    } catch (e) {
      if (e instanceof z.ZodError) {
        result.isValid = false;
        e.issues.forEach((issue) => {
          result.errors.push({
            field: issue.path.join('.'),
            message: issue.message,
            value: data
          });
        });
      }
    }

    if (data.vix === 0) {
      result.warnings.push({ field: 'vix', message: 'VIX is 0 - possible API failure' });
    }
    if (data.dxy === 0) {
      result.warnings.push({ field: 'dxy', message: 'DXY is 0 - possible API failure' });
    }
    if (data.btcd === 0) {
      result.warnings.push({ field: 'btcd', message: 'BTC.D is 0 - possible API failure' });
    }

    return result;
  }

  // ==================== CONSISTENCY CHECKS ====================

  async runConsistencyChecks(): Promise<void> {
    if (!this.isRunning) return;

    const state = useStore.getState();
    const results: ConsistencyResult[] = [];

    // Async checks
    results.push(await this.checkTimeSync());

    // Synchronous checks
    results.push(this.checkPriceChartSync(state.price, state.chartData));

    state.positions.forEach((pos: Position) => {
      results.push(this.checkPositionPnL(pos, state.price));
    });

    state.positions.forEach((pos: Position) => {
      results.push(this.validateLiquidationPrice(pos));
    });

    results.push(this.checkBalanceConsistency(state.balance, state.positions));
    results.push(this.checkDataFreshness());

    const failed = results.filter(r => !r.passed);
    if (failed.length > 0) {
      this.log('warn', `Consistency checks: ${failed.length} failed`, failed);
      failed.forEach(f => {
        if (!f.autoFixed) {
          this.createAlert('CONSISTENCY_FAIL', 'medium', f.details);
        }
      });
    }

    this.emit({ type: 'CONSISTENCY_CHECKS_COMPLETE', results, timestamp: Date.now() });
  }

  private async checkTimeSync(): Promise<ConsistencyResult> {
      try {
          const start = Date.now();
          const response = await fetch('https://api.binance.com/api/v3/time');
          const data = await response.json();
          const serverTime = data.serverTime;
          const end = Date.now();
          const rtt = end - start;
          
          // Adjust server time by half RTT to estimate "now"
          const adjustedServerTime = serverTime + (rtt / 2);
          const localTime = Date.now();
          const skew = Math.abs(localTime - adjustedServerTime);

          if (skew > 5000) { // 5 seconds threshold
              return {
                  checkId: 'TIME_SYNC',
                  passed: false,
                  details: `System clock skewed by ${Math.round(skew)}ms`,
                  discrepancy: { expected: adjustedServerTime, actual: localTime, delta: skew }
              };
          }

          return {
              checkId: 'TIME_SYNC',
              passed: true,
              details: `Time sync OK (skew: ${Math.round(skew)}ms)`
          };
      } catch (e) {
          return {
              checkId: 'TIME_SYNC',
              passed: true, // Pass on error to avoid noise if offline
              details: 'Time sync check failed (network error)'
          };
      }
  }

  private checkPriceChartSync(currentPrice: number, chartData: ChartDataPoint[]): ConsistencyResult {
    if (!chartData || chartData.length === 0) {
      return { checkId: 'PRICE_CHART_SYNC', passed: true, details: 'No chart data to compare' };
    }

    const latestClose = chartData[chartData.length - 1].close;
    const delta = Math.abs(currentPrice - latestClose);
    const deltaPercent = (delta / latestClose) * 100;

    const passed = deltaPercent < 2;

    return {
      checkId: 'PRICE_CHART_SYNC',
      passed,
      details: passed
        ? `Price-Chart sync OK (${deltaPercent.toFixed(2)}% delta)`
        : `Price deviation from chart: ${deltaPercent.toFixed(2)}%`,
      discrepancy: passed ? undefined : { expected: latestClose, actual: currentPrice, delta: deltaPercent }
    };
  }

  private checkPositionPnL(position: Position, currentPrice: number): ConsistencyResult {
    const { entryPrice, size, type, pnl, leverage } = position;

    let expectedPnL: number;
    if (type === 'LONG') {
      expectedPnL = (currentPrice - entryPrice) * size;
    } else {
      expectedPnL = (entryPrice - currentPrice) * size;
    }

    const delta = Math.abs(pnl - expectedPnL);
    const passed = delta < 1;

    if (!passed) {
      const pnlPercent = (expectedPnL / (entryPrice * size / leverage)) * 100;
      useStore.getState().updatePositionPnl(position.id, expectedPnL, pnlPercent);

      return {
        checkId: `POSITION_PNL_${position.id}`,
        passed: false,
        details: `PnL auto-corrected for position ${position.id}`,
        discrepancy: { expected: expectedPnL, actual: pnl, delta },
        autoFixed: true
      };
    }

    return {
      checkId: `POSITION_PNL_${position.id}`,
      passed: true,
      details: `Position ${position.id} PnL valid`
    };
  }

  private validateLiquidationPrice(position: Position): ConsistencyResult {
    const { entryPrice, leverage, type, liquidationPrice } = position;

    const maintenanceMargin = 0.004;
    let expectedLiq: number;

    if (type === 'LONG') {
      expectedLiq = entryPrice * (1 - (1 / leverage) + maintenanceMargin);
    } else {
      expectedLiq = entryPrice * (1 + (1 / leverage) - maintenanceMargin);
    }

    const delta = Math.abs(liquidationPrice - expectedLiq);
    const deltaPercent = (delta / expectedLiq) * 100;
    const passed = deltaPercent < 1;

    return {
      checkId: `LIQ_PRICE_${position.id}`,
      passed,
      details: passed
        ? `Liquidation price valid for ${position.id}`
        : `Liquidation price mismatch: expected ${expectedLiq.toFixed(2)}, got ${liquidationPrice.toFixed(2)}`,
      discrepancy: passed ? undefined : { expected: expectedLiq, actual: liquidationPrice, delta: deltaPercent }
    };
  }

  private checkBalanceConsistency(balance: number, positions: Position[]): ConsistencyResult {
    if (balance < 0) {
      return {
        checkId: 'BALANCE_CONSISTENCY',
        passed: false,
        details: 'Balance is negative - this should not be possible'
      };
    }

    const totalMarginUsed = positions.reduce((sum, pos) => {
      return sum + (pos.entryPrice * pos.size / pos.leverage);
    }, 0);

    if (totalMarginUsed > balance * 1.5) {
      return {
        checkId: 'BALANCE_CONSISTENCY',
        passed: false,
        details: `Margin usage (${totalMarginUsed.toFixed(2)}) exceeds balance (${balance.toFixed(2)})`,
        discrepancy: { expected: balance, actual: totalMarginUsed }
      };
    }

    return {
      checkId: 'BALANCE_CONSISTENCY',
      passed: true,
      details: `Balance consistent: ${balance.toFixed(2)} USDT, margin used: ${totalMarginUsed.toFixed(2)}`
    };
  }

  private checkDataFreshness(): ConsistencyResult {
    const now = Date.now();
    const staleSources: string[] = [];

    Object.entries(this.sources).forEach(([id, source]) => {
      const config = DATA_SOURCE_CONFIGS[id as DataSourceId];
      const age = now - source.lastUpdate;

      if (age > config.maxStaleness) {
        staleSources.push(`${id} (${Math.round(age / 1000)}s old)`);
        source.status = 'stale';
      }
    });

    if (staleSources.length > 0) {
      return {
        checkId: 'DATA_FRESHNESS',
        passed: false,
        details: `Stale data sources: ${staleSources.join(', ')}`
      };
    }

    return {
      checkId: 'DATA_FRESHNESS',
      passed: true,
      details: 'All data sources fresh'
    };
  }

  // ==================== HEALTH CHECK ====================

  runHealthCheck(): void {
    if (!this.isRunning) return;

    const now = Date.now();
    let healthScore = 100;
    const issues: string[] = [];

    Object.entries(this.sources).forEach(([id, source]) => {
      const config = DATA_SOURCE_CONFIGS[id as DataSourceId];
      const age = now - source.lastUpdate;

      if (source.status === 'error') {
        healthScore -= 20 * config.priority;
        issues.push(`${id}: Error state`);
      } else if (source.status === 'disconnected') {
        healthScore -= 15 * config.priority;
        issues.push(`${id}: Disconnected`);
      } else if (age > config.maxStaleness) {
        healthScore -= 10 * config.priority;
        issues.push(`${id}: Stale (${Math.round(age / 1000)}s)`);
        this.createAlert('DATA_STALE', 'medium', `${id} data is stale`, id as DataSourceId);
      }
    });

    const errorStats = errorMonitor.getStats();
    if (errorStats.critical > 0) {
      healthScore -= 30;
      issues.push(`${errorStats.critical} critical errors`);
    }

    healthScore = Math.max(0, Math.min(100, healthScore));

    if (healthScore < 50) {
      this.createAlert('HEALTH_DEGRADED', 'high', `System health degraded: ${healthScore}%`);
    }

    this.emit({
      type: 'HEALTH_CHECK_COMPLETE',
      healthScore,
      issues,
      timestamp: now
    });

    if (issues.length > 0) {
      this.log('warn', `Health: ${healthScore}%`, issues);
    }
  }

  // ==================== ORDER FLOW SYNC ====================

  /**
   * Validate order flow stats against Zod schema.
   * Returns validation result with any errors/warnings.
   */
  validateOrderFlowStats(stats: AggrStats): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] };

    try {
      AggrStatsSchema.parse(stats);
    } catch (e) {
      if (e instanceof z.ZodError) {
        // Schema validation failed - collect errors but don't block
        e.issues.forEach((issue) => {
          const field = issue.path.join('.');
          if (issue.code === 'invalid_type' || issue.code === 'invalid_union' || issue.code === 'invalid_value') {
            result.errors.push({ field, message: issue.message, value: issue.path.reduce((obj: any, key) => obj?.[key], stats) });
          } else {
            result.warnings.push({ field, message: issue.message });
          }
        });
      }
    }

    // Additional semantic validations
    if (stats.totalVolume < 0 || stats.buyVolume < 0 || stats.sellVolume < 0) {
      result.errors.push({ field: 'volume', message: 'Volume cannot be negative', value: { total: stats.totalVolume, buy: stats.buyVolume, sell: stats.sellVolume } });
    }

    // Check volume consistency (buy + sell should equal total within 10%)
    const volumeSum = stats.buyVolume + stats.sellVolume;
    if (stats.totalVolume > 0 && Math.abs(volumeSum - stats.totalVolume) > stats.totalVolume * 0.1) {
      result.warnings.push({ field: 'totalVolume', message: `Volume mismatch: buy(${stats.buyVolume}) + sell(${stats.sellVolume}) != total(${stats.totalVolume})` });
    }

    // Check pressure consistency (should sum to ~100)
    if (stats.pressure) {
      const pressureSum = stats.pressure.buyPressure + stats.pressure.sellPressure;
      if (Math.abs(pressureSum - 100) > 1) {
        result.warnings.push({ field: 'pressure', message: `Pressure sum (${pressureSum.toFixed(1)}%) deviates from 100%` });
      }
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  updateOrderFlowStats(stats: AggrStats): void {
    // Validate using Zod schema
    const validation = this.validateOrderFlowStats(stats);

    if (!validation.isValid) {
      this.createAlert('VALIDATION_ERROR', 'medium', `Invalid order flow data: ${validation.errors.map(e => e.message).join(', ')}`, 'ORDER_FLOW');
      this.log('warn', 'Order flow validation failed', validation.errors);
    }

    if (validation.warnings.length > 0) {
      this.log('debug', 'Order flow validation warnings', validation.warnings);
    }

    // Store stats even if validation has warnings (only block on critical errors)
    this.lastOrderFlowStats = stats;
    this.markDataUpdated('ORDER_FLOW');
  }

  getOrderFlowStats(): AggrStats | null {
    return this.lastOrderFlowStats;
  }

  // ==================== ALERTS ====================

  private createAlert(
    type: SyncAlert['type'],
    severity: SyncAlert['severity'],
    message: string,
    sourceId?: DataSourceId
  ): void {
    const existingAlert = this.alerts.find(
      a => a.type === type && a.sourceId === sourceId && !a.resolved
    );

    if (existingAlert) return;

    const alert: SyncAlert = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      type,
      severity,
      sourceId,
      message,
      timestamp: Date.now(),
      resolved: false
    };

    this.alerts.push(alert);

    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    this.emit({ type: 'ALERT_CREATED', alert, timestamp: Date.now() });

    if (severity === 'critical' || severity === 'high') {
      captureWarning(message, 'DataSyncAgent', { type, sourceId });
    }
  }

  private resolveAlerts(sourceId: DataSourceId): void {
    this.alerts
      .filter(a => a.sourceId === sourceId && !a.resolved)
      .forEach(a => {
        a.resolved = true;
        this.emit({ type: 'ALERT_RESOLVED', alert: a, timestamp: Date.now() });
      });
  }

  getAlerts(): SyncAlert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  getAllAlerts(): SyncAlert[] {
    return [...this.alerts];
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
    }
  }

  // ==================== STATUS & EVENTS ====================

  getStatus(): {
    isRunning: boolean;
    startTime: number | null;
    sources: Record<DataSourceId, DataSourceStatus>;
    healthScore: number;
    activeAlerts: number;
  } {
    let healthScore = 100;
    const now = Date.now();

    Object.entries(this.sources).forEach(([id, source]) => {
      const config = DATA_SOURCE_CONFIGS[id as DataSourceId];
      if (source.status === 'error') healthScore -= 20;
      else if (source.status === 'stale' || (now - source.lastUpdate) > config.maxStaleness) healthScore -= 10;
      else if (source.status === 'disconnected') healthScore -= 15;
    });

    return {
      isRunning: this.isRunning,
      startTime: this.startTime,
      sources: { ...this.sources },
      healthScore: Math.max(0, healthScore),
      activeAlerts: this.alerts.filter(a => !a.resolved).length
    };
  }

  subscribe(handler: (event: any) => void): () => void {
    this.eventListeners.push(handler);
    return () => {
      this.eventListeners = this.eventListeners.filter(h => h !== handler);
    };
  }

  private emit(event: any): void {
    this.eventListeners.forEach(handler => {
      try {
        handler(event);
      } catch (e) {
        captureError(e as Error, 'DataSyncAgent event handler error');
      }
    });
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    const prefix = '[DataSyncAgent]';
    switch (level) {
      case 'debug':
        if (import.meta.env.DEV) console.log(prefix, message, data || '');
        break;
      case 'info':
        console.log(prefix, message, data || '');
        break;
      case 'warn':
        console.warn(prefix, message, data || '');
        break;
      case 'error':
        console.error(prefix, message, data || '');
        break;
    }
  }
}

// ==================== SINGLETON EXPORT ====================

export const dataSyncAgent = new DataSyncAgent();

// ==================== REACT HOOK ====================

import React from 'react';

export function useDataSyncStatus() {
  const [status, setStatus] = React.useState(dataSyncAgent.getStatus());

  React.useEffect(() => {
    const unsubscribe = dataSyncAgent.subscribe(() => {
      setStatus(dataSyncAgent.getStatus());
    });

    return unsubscribe;
  }, []);

  return status;
}
