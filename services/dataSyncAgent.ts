/**
 * DATA SYNC AGENT
 * Centralized controller for data validation, consistency, and synchronization
 * Ensures all data across components is correct and in sync
 */

import { z } from 'zod';
import { useStore } from '../store/useStore';
import { ChartDataPoint, Position, TradeSignal } from '../types';
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
  type: 'DATA_STALE' | 'VALIDATION_ERROR' | 'CONSISTENCY_FAIL' | 'SOURCE_ERROR' | 'AUTO_FIX';
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
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private consistencyCheckInterval: NodeJS.Timeout | null = null;

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

    // Start health checks every 10s
    this.healthCheckInterval = setInterval(() => this.runHealthCheck(), 10000);

    // Start consistency checks every 30s
    this.consistencyCheckInterval = setInterval(() => this.runConsistencyChecks(), 30000);

    // Initial checks
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
        e.errors.forEach(err => {
          result.errors.push({ field: 'price', message: err.message, value: price });
        });
      }
    }

    // Additional business logic validation
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

    // Validate each candle
    const invalidCandles: number[] = [];
    data.forEach((candle, index) => {
      try {
        ChartDataPointSchema.parse(candle);

        // OHLC logic validation
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
          e.errors.forEach(err => {
            result.errors.push({
              field: `chartData[${index}].${err.path.join('.')}`,
              message: err.message,
              value: candle
            });
          });
        }
      }
    });

    // Check time sequence
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
        e.errors.forEach(err => {
          result.errors.push({
            field: err.path.join('.'),
            message: err.message,
            value: position
          });
        });
      }
    }

    // Business logic validation
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

    // Validate liquidation price
    const liqPriceValid = this.validateLiquidationPrice(position);
    if (!liqPriceValid.passed) {
      result.warnings.push({
        field: 'liquidationPrice',
        message: liqPriceValid.details
      });

      // Auto-correct liquidation price if needed
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
        e.errors.forEach(err => {
          result.errors.push({
            field: err.path.join('.'),
            message: err.message,
            value: data
          });
        });
      }
    }

    // Check for zero values (API failures)
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

  runConsistencyChecks(): void {
    if (!this.isRunning) return;

    const state = useStore.getState();
    const results: ConsistencyResult[] = [];

    // Check 1: Price matches latest chart close
    results.push(this.checkPriceChartSync(state.price, state.chartData));

    // Check 2: Position PnL calculations are correct
    state.positions.forEach(pos => {
      results.push(this.checkPositionPnL(pos, state.price));
    });

    // Check 3: Liquidation prices are valid
    state.positions.forEach(pos => {
      results.push(this.validateLiquidationPrice(pos));
    });

    // Check 4: Balance consistency
    results.push(this.checkBalanceConsistency(state.balance, state.positions));

    // Check 5: Data freshness
    results.push(this.checkDataFreshness());

    // Log results
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

  private checkPriceChartSync(currentPrice: number, chartData: ChartDataPoint[]): ConsistencyResult {
    if (!chartData || chartData.length === 0) {
      return { checkId: 'PRICE_CHART_SYNC', passed: true, details: 'No chart data to compare' };
    }

    const latestClose = chartData[chartData.length - 1].close;
    const delta = Math.abs(currentPrice - latestClose);
    const deltaPercent = (delta / latestClose) * 100;

    // Allow 2% deviation (normal for real-time vs candle close)
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

    // Calculate expected PnL
    let expectedPnL: number;
    if (type === 'LONG') {
      expectedPnL = (currentPrice - entryPrice) * size;
    } else {
      expectedPnL = (entryPrice - currentPrice) * size;
    }

    const delta = Math.abs(pnl - expectedPnL);
    const passed = delta < 1; // Allow $1 tolerance

    if (!passed) {
      // Auto-fix PnL
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

    // Calculate expected liquidation price
    // For LONG: Liq = Entry * (1 - 1/leverage + maintenance margin)
    // For SHORT: Liq = Entry * (1 + 1/leverage - maintenance margin)
    const maintenanceMargin = 0.004; // 0.4% typical
    let expectedLiq: number;

    if (type === 'LONG') {
      expectedLiq = entryPrice * (1 - (1 / leverage) + maintenanceMargin);
    } else {
      expectedLiq = entryPrice * (1 + (1 / leverage) - maintenanceMargin);
    }

    const delta = Math.abs(liquidationPrice - expectedLiq);
    const deltaPercent = (delta / expectedLiq) * 100;
    const passed = deltaPercent < 1; // Allow 1% tolerance

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
    // Check that balance is positive and reasonable
    if (balance < 0) {
      return {
        checkId: 'BALANCE_CONSISTENCY',
        passed: false,
        details: 'Balance is negative - this should not be possible'
      };
    }

    // Check total margin usage doesn't exceed balance
    const totalMarginUsed = positions.reduce((sum, pos) => {
      return sum + (pos.entryPrice * pos.size / pos.leverage);
    }, 0);

    if (totalMarginUsed > balance * 1.5) { // Allow some buffer for unrealized PnL
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
    const staleSourcess: string[] = [];

    Object.entries(this.sources).forEach(([id, source]) => {
      const config = DATA_SOURCE_CONFIGS[id as DataSourceId];
      const age = now - source.lastUpdate;

      if (age > config.maxStaleness) {
        staleSourcess.push(`${id} (${Math.round(age / 1000)}s old)`);
        source.status = 'stale';
      }
    });

    if (staleSourcess.length > 0) {
      return {
        checkId: 'DATA_FRESHNESS',
        passed: false,
        details: `Stale data sources: ${staleSourcess.join(', ')}`
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

    // Check each data source
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

    // Check error monitor
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

  updateOrderFlowStats(stats: AggrStats): void {
    this.lastOrderFlowStats = stats;
    this.markDataUpdated('ORDER_FLOW');

    // Validate order flow data
    if (stats.totalVolume < 0 || stats.buyVolume < 0 || stats.sellVolume < 0) {
      this.createAlert('VALIDATION_ERROR', 'medium', 'Invalid order flow volumes', 'ORDER_FLOW');
    }

    // Check buy + sell roughly equals total
    const volumeSum = stats.buyVolume + stats.sellVolume;
    if (Math.abs(volumeSum - stats.totalVolume) > stats.totalVolume * 0.1) {
      this.log('warn', 'Order flow volume mismatch', {
        total: stats.totalVolume,
        buyPlusSell: volumeSum
      });
    }
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
    // Check for duplicate active alerts
    const existingAlert = this.alerts.find(
      a => a.type === type && a.sourceId === sourceId && !a.resolved
    );

    if (existingAlert) return;

    const alert: SyncAlert = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      sourceId,
      message,
      timestamp: Date.now(),
      resolved: false
    };

    this.alerts.push(alert);

    // Keep only last 100 alerts
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

// Need React import for the hook
import React from 'react';
