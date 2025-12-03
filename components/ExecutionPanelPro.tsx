import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Target, Shield, AlertTriangle, ChevronDown, ChevronUp, Calculator, Download, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { checkRiskVeto, TradeProposal } from '../services/riskOfficer';
import { exportAuditLog } from '../services/auditService';
import { binanceApi } from '../services/binanceApi';
import {
  TradingMachineState,
  INITIAL_MACHINE_STATE,
  transition,
  canStartTrade,
  checkTimeout,
  getStatusMessage,
  isTerminal
} from '../services/tradingStateMachine';

export const ExecutionPanelPro: React.FC = () => {
  const { 
    price, 
    activeTradeSetup, 
    balance, 
    positions, 
    addPosition, 
    setActiveTradeSetup,
    dailyLossLimit,
    dailyPnL,
    riskOfficer
  } = useStore();

  // Local State
  const [riskPercent, setRiskPercent] = useState(1.0);
  const [leverage, setLeverage] = useState(5);
  const [isLong, setIsLong] = useState(true);
  
  // Risk Override State
  const [showRiskWarning, setShowRiskWarning] = useState(false);
  const [riskWarningAck, setRiskWarningAck] = useState(false);
  
  // Audit Log State
  const [showAudit, setShowAudit] = useState(false);

  // Trading State Machine
  const [machineState, setMachineState] = useState<TradingMachineState>(INITIAL_MACHINE_STATE);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Derived execution state from state machine
  const isExecuting = !canStartTrade(machineState) && !isTerminal(machineState.state);
  const executionError = machineState.state === 'FAILED' ? machineState.context.error : null;

  // State machine dispatch helper
  const dispatch = useCallback((event: Parameters<typeof transition>[1]) => {
    setMachineState(prev => transition(prev, event));
  }, []);

  // Timeout checker effect
  useEffect(() => {
    if (timeoutRef.current) {
      clearInterval(timeoutRef.current);
    }

    timeoutRef.current = setInterval(() => {
      if (checkTimeout(machineState)) {
        dispatch({ type: 'TIMEOUT' });
      }
    }, 1000);

    return () => {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
      }
    };
  }, [machineState, dispatch]);

  // Reset state machine when in terminal state after delay
  useEffect(() => {
    if (isTerminal(machineState.state)) {
      const timer = setTimeout(() => {
        dispatch({ type: 'RESET' });
      }, 5000); // Auto-reset after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [machineState.state, dispatch]);

  // Initialize from setup
  useEffect(() => {
    if (activeTradeSetup) {
      setIsLong(activeTradeSetup.type === 'LONG');
    }
  }, [activeTradeSetup]);

  // Handle Risk Change
  const handleRiskChange = (val: number) => {
    setRiskPercent(val);
    if (val > 1.0) { // Default is 1.0
        setShowRiskWarning(true);
        setRiskWarningAck(false);
    } else {
        setShowRiskWarning(false);
        setRiskWarningAck(true);
    }
  };

  // Calculations
  const riskAmount = (balance * riskPercent) / 100;
  const entryPrice = price; // Market order for now
  const stopLoss = activeTradeSetup?.stopLoss || (isLong ? price * 0.99 : price * 1.01);
  const takeProfit = activeTradeSetup?.takeProfit || (isLong ? price * 1.03 : price * 0.97);
  
  const stopDistance = Math.abs(entryPrice - stopLoss);
  const positionSizeBTC = stopDistance > 0 ? riskAmount / stopDistance : 0;
  const positionSizeUSD = positionSizeBTC * entryPrice;
  const marginRequired = positionSizeUSD / leverage;

  // Risk Veto Check
  const proposal: TradeProposal = {
    type: isLong ? 'LONG' : 'SHORT',
    entryPrice,
    stopLoss,
    takeProfit,
    size: positionSizeBTC,
    leverage
  };
  
  const riskCheck = checkRiskVeto(proposal, { dailyPnL, dailyLossLimit, balance, positions }, riskOfficer);

  const handleExecute = useCallback(async () => {
    // State machine prevents double execution
    if (!canStartTrade(machineState)) return;
    if (riskCheck.blocked) return;
    if (showRiskWarning && !riskWarningAck) return;

    // Generate idempotent order ID
    const orderId = crypto.randomUUID();

    // Step 1: Start trade (IDLE -> VALIDATING)
    dispatch({ type: 'START_TRADE', orderId });

    try {
      // Step 2: Run validation (live mode checks)
      const { isLiveMode } = useStore.getState();
      if (isLiveMode) {
        const freshBalance = await binanceApi.getBalance();
        const currentBalance = useStore.getState().balance;

        // If balance dropped significantly (>10%), fail validation
        if (freshBalance < currentBalance * 0.9) {
          dispatch({
            type: 'VALIDATION_FAILED',
            reason: `Balance changed significantly. Was: $${currentBalance.toFixed(2)}, Now: $${freshBalance.toFixed(2)}`
          });
          return;
        }

        // Re-check risk with fresh balance
        const freshRiskCheck = checkRiskVeto(proposal, {
          dailyPnL: useStore.getState().dailyPnL,
          dailyLossLimit: useStore.getState().dailyLossLimit,
          balance: freshBalance,
          positions: useStore.getState().positions
        }, useStore.getState().riskOfficer);

        if (freshRiskCheck.blocked) {
          dispatch({
            type: 'VALIDATION_FAILED',
            reason: freshRiskCheck.message || 'Risk check failed'
          });
          return;
        }
      }

      // Step 3: Validation passed (VALIDATING -> AWAITING_CONFIRMATION)
      dispatch({ type: 'VALIDATION_PASSED' });

      // For now, auto-confirm (future: show confirmation dialog)
      // Step 4: User confirmed (AWAITING_CONFIRMATION -> EXECUTING)
      dispatch({ type: 'USER_CONFIRMED' });

      // Step 5: Start execution (EXECUTING -> CONFIRMING_FILL)
      dispatch({ type: 'EXECUTION_STARTED' });

      const newPosition = {
        id: orderId,
        pair: 'BTCUSDT',
        type: (isLong ? 'LONG' : 'SHORT') as 'LONG' | 'SHORT',
        entryPrice,
        size: positionSizeBTC,
        leverage,
        liquidationPrice: isLong ? entryPrice * (1 - 1/leverage) : entryPrice * (1 + 1/leverage),
        stopLoss,
        takeProfit,
        pnl: 0,
        pnlPercent: 0,
        timestamp: Date.now()
      };

      addPosition(newPosition);
      setActiveTradeSetup(null);

      // Step 6: Order filled (CONFIRMING_FILL -> COMPLETED)
      dispatch({ type: 'ORDER_FILLED', exchangeOrderId: orderId });

    } catch (error: any) {
      console.error('[Execution] Failed:', error);
      dispatch({
        type: 'ORDER_REJECTED',
        reason: error.message || 'Execution failed'
      });
    }
  }, [machineState, riskCheck, showRiskWarning, riskWarningAck, proposal, isLong, entryPrice, positionSizeBTC, leverage, stopLoss, takeProfit, addPosition, setActiveTradeSetup, dispatch]);

  return (
    <div className="h-full flex flex-col bg-gray-900/50 rounded-lg border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-white/5 flex justify-between items-center bg-black/20">
        <div className="flex items-center gap-2">
          <Target size={14} className="text-blue-400" />
          <span className="font-bold text-xs tracking-wider text-gray-300">EXECUTION</span>
        </div>
        <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500">Balance:</span>
            <span className="text-xs font-mono text-gray-300">${balance.toLocaleString()}</span>
        </div>
      </div>

      <div className="p-3 space-y-4 overflow-y-auto flex-1">
        {/* Direction Toggle */}
        <div className="flex bg-black/40 rounded-lg p-1 border border-white/5">
          <button
            onClick={() => setIsLong(true)}
            className={`flex-1 py-1.5 text-xs font-bold rounded transition-all ${
              isLong ? 'bg-green-500/20 text-green-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            LONG
          </button>
          <button
            onClick={() => setIsLong(false)}
            className={`flex-1 py-1.5 text-xs font-bold rounded transition-all ${
              !isLong ? 'bg-red-500/20 text-red-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            SHORT
          </button>
        </div>

        {/* Risk Settings */}
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] text-gray-400 uppercase tracking-wider">
            <span>Risk per Trade</span>
            <span>${riskAmount.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.5"
              value={riskPercent}
              onChange={(e) => handleRiskChange(parseFloat(e.target.value))}
              className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className={`text-xs font-mono font-bold w-12 text-right ${riskPercent > 1 ? 'text-yellow-400' : 'text-blue-400'}`}>
                {riskPercent}%
            </span>
          </div>
          
          {/* Risk Override Warning */}
          {showRiskWarning && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-2 mt-2 animate-in fade-in">
                <div className="flex items-start gap-2">
                    <AlertTriangle size={12} className="text-yellow-400 mt-0.5 shrink-0" />
                    <div className="space-y-2">
                        <p className="text-[10px] text-yellow-200 leading-tight">
                            Risk increased above default (1%). This is {riskPercent}x your standard risk.
                        </p>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={riskWarningAck}
                                onChange={(e) => setRiskWarningAck(e.target.checked)}
                                className="rounded border-yellow-500/30 bg-black/20 text-yellow-500 focus:ring-0 w-3 h-3"
                            />
                            <span className="text-[10px] text-yellow-400/80">I understand the risk</span>
                        </label>
                    </div>
                </div>
            </div>
          )}
        </div>

        {/* Position Size Preview */}
        <div className="bg-black/20 rounded border border-white/5 p-2 space-y-1">
            <div className="flex justify-between text-xs">
                <span className="text-gray-500">Size (BTC)</span>
                <span className="font-mono text-gray-200">{positionSizeBTC.toFixed(4)} BTC</span>
            </div>
            <div className="flex justify-between text-xs">
                <span className="text-gray-500">Notional</span>
                <span className="font-mono text-gray-200">${positionSizeUSD.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
            </div>
            <div className="flex justify-between text-xs">
                <span className="text-gray-500">Leverage</span>
                <span className="font-mono text-gray-200">{leverage}x</span>
            </div>
        </div>

        {/* Audit Log Toggle */}
        <button 
            onClick={() => setShowAudit(!showAudit)}
            className="w-full flex items-center justify-between text-[10px] text-gray-500 hover:text-gray-300 py-1"
        >
            <div className="flex items-center gap-1">
                <Calculator size={10} />
                <span>Calculation Audit</span>
            </div>
            {showAudit ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>

        {/* Audit Log Details */}
        {showAudit && (
            <div className="bg-black/40 rounded p-2 text-[10px] font-mono text-gray-400 space-y-1 border border-white/5">
                <div className="flex justify-between">
                    <span>Balance:</span>
                    <span>${balance}</span>
                </div>
                <div className="flex justify-between">
                    <span>Risk Amount:</span>
                    <span>${balance} * {riskPercent}% = ${riskAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                    <span>Stop Dist:</span>
                    <span>|{entryPrice.toFixed(0)} - {stopLoss.toFixed(0)}| = {stopDistance.toFixed(0)}</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-1 mt-1">
                    <span>Raw Size:</span>
                    <span>{riskAmount.toFixed(2)} / {stopDistance.toFixed(0)} = {positionSizeBTC.toFixed(4)}</span>
                </div>
                
                <button 
                    onClick={exportAuditLog}
                    className="w-full mt-2 flex items-center justify-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded py-1.5 transition-colors"
                >
                    <Download size={10} />
                    <span>Export Full Audit Log (JSON)</span>
                </button>
            </div>
        )}

        {/* State Machine Status */}
        {machineState.state !== 'IDLE' && (
            <div className={`rounded p-2 flex items-start gap-2 ${
              machineState.state === 'COMPLETED' ? 'bg-green-500/10 border border-green-500/30' :
              machineState.state === 'FAILED' ? 'bg-red-500/10 border border-red-500/30' :
              machineState.state === 'CANCELLED' ? 'bg-gray-500/10 border border-gray-500/30' :
              'bg-blue-500/10 border border-blue-500/30'
            }`}>
                <Loader2 size={14} className={`mt-0.5 shrink-0 ${
                  isTerminal(machineState.state) ? '' : 'animate-spin'
                } ${
                  machineState.state === 'COMPLETED' ? 'text-green-400' :
                  machineState.state === 'FAILED' ? 'text-red-400' :
                  machineState.state === 'CANCELLED' ? 'text-gray-400' :
                  'text-blue-400'
                }`} />
                <div>
                    <span className={`text-xs font-bold block ${
                      machineState.state === 'COMPLETED' ? 'text-green-400' :
                      machineState.state === 'FAILED' ? 'text-red-400' :
                      machineState.state === 'CANCELLED' ? 'text-gray-400' :
                      'text-blue-400'
                    }`}>{machineState.state}</span>
                    <span className="text-[10px] text-gray-300/80 leading-tight">{getStatusMessage(machineState)}</span>
                </div>
            </div>
        )}

        {/* Veto Banner */}
        {riskCheck.blocked && (
            <div className="bg-red-500/10 border border-red-500/30 rounded p-2 flex items-start gap-2">
                <Shield size={14} className="text-red-400 mt-0.5 shrink-0" />
                <div>
                    <span className="text-xs font-bold text-red-400 block">Trade Blocked</span>
                    <span className="text-[10px] text-red-300/80 leading-tight">{riskCheck.message}</span>
                </div>
            </div>
        )}

        {/* Execution Error Banner */}
        {executionError && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded p-2 flex items-start gap-2">
                <AlertTriangle size={14} className="text-orange-400 mt-0.5 shrink-0" />
                <div>
                    <span className="text-xs font-bold text-orange-400 block">Execution Failed</span>
                    <span className="text-[10px] text-orange-300/80 leading-tight">{executionError}</span>
                </div>
            </div>
        )}

        {/* Execute Button */}
        <button
          onClick={handleExecute}
          disabled={riskCheck.blocked || (showRiskWarning && !riskWarningAck) || isExecuting}
          className={`w-full py-3 rounded-lg font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-2 ${
            riskCheck.blocked || (showRiskWarning && !riskWarningAck) || isExecuting
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : isLong
                ? 'bg-green-500 hover:bg-green-400 text-black shadow-[0_0_15px_rgba(34,197,94,0.4)]'
                : 'bg-red-500 hover:bg-red-400 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]'
          }`}
        >
          {isExecuting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>EXECUTING...</span>
            </>
          ) : (
            isLong ? 'BUY / LONG' : 'SELL / SHORT'
          )}
        </button>
      </div>
    </div>
  );
};
