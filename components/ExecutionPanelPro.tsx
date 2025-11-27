/**
 * EXECUTION PANEL PRO - High-Frequency Trading Cockpit
 * Zero Scroll, One Glance Design
 * Architecture: Grid & Density > Stacked Blocks
 */

import React, { useState, useEffect } from 'react';
import { Shield, Zap, AlertTriangle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Position } from '../types';
import { calculatePositionSize, calculateLiquidationPrice } from '../utils/tradingCalculations';
import { binanceApi } from '../services/binanceApi';
import { captureError, captureCritical, addBreadcrumb } from '../services/errorMonitor';

type OrderBookLevel = [string, string];

export const ExecutionPanelPro: React.FC = () => {
  const {
    price: currentPrice,
    balance,
    addPosition,
    activeTradeSetup,
    isLiveMode,
    setIsLiveMode,
    checkCircuitBreaker,
    isCircuitBreakerTripped,
    dailyPnL,
    dailyLossLimit
  } = useStore();

  // === ZONE A: ORDER LOGIC ===
  const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET' | 'STOP' | 'OCO'>('LIMIT');
  const [marginMode, setMarginMode] = useState<'CROSS' | 'ISOLATED'>('CROSS');
  const [leverage, setLeverage] = useState<number>(5);
  const [price, setPrice] = useState<string>(currentPrice.toFixed(2));
  const [sizeBTC, setSizeBTC] = useState<string>('0.01');
  const [sizeUSDT, setSizeUSDT] = useState<string>('');
  const [sizeMode, setSizeMode] = useState<'BTC' | 'USDT'>('BTC');
  const [riskPercent, setRiskPercent] = useState<string>('1.0');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [takeProfit, setTakeProfit] = useState<string>('');

  // === ZONE B: MICRO DEPTH ===
  const [bids, setBids] = useState<OrderBookLevel[]>([]);
  const [asks, setAsks] = useState<OrderBookLevel[]>([]);
  const [spread, setSpread] = useState<number>(0);

  // === ZONE C: EXECUTION ===
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Update price when market price changes
  useEffect(() => {
    if (orderType === 'MARKET') {
      setPrice(currentPrice.toFixed(2));
    }
  }, [currentPrice, orderType]);

  // Sync from activeTradeSetup
  useEffect(() => {
    if (activeTradeSetup) {
      if (activeTradeSetup.entryPrice) setPrice(activeTradeSetup.entryPrice.toString());
      if (activeTradeSetup.size) setSizeBTC(activeTradeSetup.size.toString());
    }
  }, [activeTradeSetup]);

  // WebSocket Order Book Feed (Binance) - 20 levels for professional depth analysis
  useEffect(() => {
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@depth20@100ms');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setBids(data.bids?.slice(0, 20) || []);
      setAsks(data.asks?.slice(0, 20) || []);

      if (data.bids?.[0] && data.asks?.[0]) {
        const spreadValue = parseFloat(data.asks[0][0]) - parseFloat(data.bids[0][0]);
        setSpread(spreadValue);
      }
    };

    return () => ws.close();
  }, []);

  // Calculate order cost
  const orderCostUSDT = parseFloat(price) * parseFloat(sizeBTC || '0');
  const marginRequired = orderCostUSDT / leverage;

  // Quick size percentages
  const handleQuickSize = (percentage: number) => {
    const availableBalance = balance * (percentage / 100);
    const maxSizeBTC = (availableBalance * leverage) / parseFloat(price);
    setSizeBTC(maxSizeBTC.toFixed(4));
  };

  // Risk-based position sizing
  const calculateRiskBasedSize = () => {
    const entryPrice = parseFloat(price);
    const slPrice = parseFloat(stopLoss);
    const riskPct = parseFloat(riskPercent);

    if (!entryPrice || !slPrice || !riskPct || riskPct <= 0) {
      setErrorMsg('Enter entry price, stop loss, and risk % to calculate position size');
      return;
    }

    // Calculate risk per BTC
    const riskPerBTC = Math.abs(entryPrice - slPrice);

    // Calculate dollar risk (account balance * risk %)
    const dollarRisk = balance * (riskPct / 100);

    // Calculate position size: Dollar Risk / Risk per BTC
    const positionSizeBTC = dollarRisk / riskPerBTC;

    setSizeBTC(positionSizeBTC.toFixed(4));
    setErrorMsg(null);
  };

  // Execute Order
  const handleExecute = async (side: 'BUY' | 'SELL') => {
    // CRITICAL: Check circuit breaker before allowing trades
    if (checkCircuitBreaker()) {
      setErrorMsg(`⛔ TRADING HALTED: Daily loss limit reached (-$${dailyLossLimit.toFixed(2)}). Reset tomorrow.`);
      captureCritical('Circuit breaker tripped - daily loss limit exceeded', 'Trading Halted', {
        dailyPnL,
        dailyLossLimit,
        attemptedSide: side
      });
      return;
    }

    if (!sizeBTC || parseFloat(sizeBTC) <= 0) {
      setErrorMsg('Invalid size');
      return;
    }

    // CRITICAL: Stop loss is now MANDATORY
    if (!stopLoss || parseFloat(stopLoss) <= 0) {
      setErrorMsg('Stop Loss is required. Enter a stop loss price.');
      return;
    }

    // Validate stop loss is on correct side
    const executionPrice = parseFloat(price);
    const slPrice = parseFloat(stopLoss);

    if (side === 'BUY' && slPrice >= executionPrice) {
      setErrorMsg('Stop Loss must be BELOW entry price for LONG positions');
      return;
    }

    if (side === 'SELL' && slPrice <= executionPrice) {
      setErrorMsg('Stop Loss must be ABOVE entry price for SHORT positions');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    addBreadcrumb(`Executing ${side} order`, 'execution', { size: sizeBTC, price, leverage });

    const size = parseFloat(sizeBTC);
    const liqPrice = calculateLiquidationPrice(executionPrice, leverage, side === 'BUY' ? 'LONG' : 'SHORT');

    try {
      if (isLiveMode) {
        // Cast orderType to any to support STOP/OCO if API allows, or restrict UI
        await binanceApi.placeOrder('BTCUSDT', side, orderType as any, size);
        console.log(`[LIVE] ${side} ${size} BTC @ ${executionPrice}`);
        addBreadcrumb(`LIVE order executed: ${side} ${size} BTC`, 'execution');
      } else {
        // Paper Trading
        const position: Position = {
          id: Date.now().toString(),
          pair: 'BTC/USD',
          type: side === 'BUY' ? 'LONG' : 'SHORT',
          entryPrice: executionPrice,
          size: size,
          leverage: leverage,
          stopLoss: parseFloat(stopLoss) || 0,
          takeProfit: parseFloat(takeProfit) || 0,
          timestamp: Date.now(),
          pnl: 0,
          pnlPercent: 0,
          liquidationPrice: liqPrice
        };
        addPosition(position);
        console.log(`[PAPER] ${side} ${size} BTC @ ${executionPrice}`);
        addBreadcrumb(`Paper trade executed: ${side} ${size} BTC`, 'execution');
      }

      setShowConfirmation(false);
    } catch (err: any) {
      const errorContext = {
        side,
        size,
        price: executionPrice,
        leverage,
        isLiveMode,
        orderType
      };

      if (isLiveMode) {
        // CRITICAL: Live trading errors need immediate attention
        captureCritical(err, 'Live Order Execution Failed', errorContext);
      } else {
        captureError(err, 'Paper Trade Execution Failed', errorContext);
      }

      console.error('Execution Error:', err);
      setErrorMsg(err.message || 'Order Failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Visual Glue: Highlight panel when a signal is loaded
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    if (activeTradeSetup) {
      setHighlight(true);
      const timer = setTimeout(() => setHighlight(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [activeTradeSetup]);

  return (
    <div className={`h-full flex flex-col bg-terminal-card border rounded-lg overflow-hidden transition-all duration-500 ${
      highlight ? 'border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.4)] ring-1 ring-blue-500/50' : 'border-terminal-border'
    }`}>
      {/* === ZONE A: ORDER LOGIC === */}
      <div className="shrink-0 border-b border-terminal-border bg-terminal-card relative z-10">
        {/* Row 1: Order Type Tabs */}
        <div className="flex items-center border-b border-terminal-border">
          {(['LIMIT', 'MARKET', 'STOP', 'OCO'] as const).map(type => (
            <button
              key={type}
              onClick={() => setOrderType(type)}
              className={`flex-1 py-1.5 text-[10px] font-bold tracking-wide transition-colors ${
                orderType === type
                  ? 'bg-blue-500/10 text-blue-400 border-b-2 border-blue-500'
                  : 'text-gray-500 hover:text-gray-300 border-b-2 border-transparent'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Row 2: Leverage & Margin Mode */}
        <div className="flex items-center justify-between px-2 py-1.5 bg-white/5">
          <div className="flex items-center gap-2">
            <select
              value={marginMode}
              onChange={(e) => setMarginMode(e.target.value as any)}
              className="bg-black border border-white/10 rounded px-2 py-0.5 text-[10px] text-gray-300 outline-none"
            >
              <option value="CROSS">CROSS</option>
              <option value="ISOLATED">ISOLATED</option>
            </select>
            <span className="text-[9px] text-gray-500 font-mono">MARGIN</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              value={leverage}
              onChange={(e) => setLeverage(parseInt(e.target.value) || 1)}
              min="1"
              max="20"
              className="w-12 bg-black border border-white/10 rounded px-2 py-0.5 text-[10px] text-yellow-400 font-mono text-right outline-none"
            />
            <span className="text-[10px] text-gray-500 font-bold">x</span>
          </div>
        </div>

        {/* Row 3: Input Grid (CRITICAL - Monospace, Tabular Nums) */}
        <div className="grid grid-cols-2 gap-2 p-2">
          {/* Price Input */}
          <div>
            <label className="block text-[9px] text-gray-500 font-mono mb-1 uppercase">
              Price (USDT)
            </label>
            <div className="relative">
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={orderType === 'MARKET'}
                className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-sm px-2 py-1.5 pr-12 text-[11px] text-white font-mono text-right outline-none focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              />
              <button
                onClick={() => setPrice(currentPrice.toFixed(2))}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-blue-400 hover:text-blue-300 font-mono"
              >
                LAST
              </button>
            </div>
          </div>

          {/* Size Input */}
          <div>
            <label className="block text-[9px] text-gray-500 font-mono mb-1 uppercase">
              Size (BTC)
            </label>
            <input
              type="number"
              value={sizeBTC}
              onChange={(e) => setSizeBTC(e.target.value)}
              step="0.001"
              className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-sm px-2 py-1.5 text-[11px] text-white font-mono text-right outline-none focus:border-blue-500 transition-colors"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            />
          </div>
        </div>

        {/* Row 3.5: Risk-Based Position Sizing */}
        <div className="px-2 pb-2">
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-sm p-2">
            <label className="flex items-center gap-1 text-[9px] text-blue-400 font-mono mb-1.5 uppercase">
              <Shield size={10} />
              Risk % Calculator
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={riskPercent}
                onChange={(e) => setRiskPercent(e.target.value)}
                step="0.1"
                min="0.1"
                max="5"
                placeholder="1.0"
                className="flex-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded-sm px-2 py-1.5 text-[11px] text-blue-400 font-mono text-right outline-none focus:border-blue-500 transition-colors"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              />
              <span className="text-[10px] text-gray-500 font-mono">%</span>
              <button
                onClick={calculateRiskBasedSize}
                className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-sm text-[9px] text-blue-400 font-bold uppercase tracking-wide transition-colors"
              >
                Calc Size
              </button>
            </div>
            <div className="text-[8px] text-gray-500 font-mono mt-1">
              Risk {riskPercent || '0'}% = ${((balance * (parseFloat(riskPercent) / 100)) || 0).toFixed(2)} max loss
            </div>
          </div>
        </div>

        {/* Row 4: SL/TP Inputs */}
        <div className="grid grid-cols-2 gap-2 px-2 pb-2">
          {/* Stop Loss */}
          <div>
            <label className="block text-[9px] text-gray-500 font-mono mb-1 uppercase">
              Stop Loss
            </label>
            <input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              placeholder="Required"
              required
              className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-sm px-2 py-1.5 text-[11px] text-red-400 font-mono text-right outline-none focus:border-red-500 transition-colors placeholder:text-gray-700"
            />
          </div>

          {/* Take Profit */}
          <div>
            <label className="block text-[9px] text-gray-500 font-mono mb-1 uppercase">
              Take Profit
            </label>
            <input
              type="number"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              placeholder="Optional"
              className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-sm px-2 py-1.5 text-[11px] text-green-400 font-mono text-right outline-none focus:border-green-500 transition-colors placeholder:text-gray-700"
            />
          </div>
        </div>
      </div>

      {/* === ZONE B: MICRO DEPTH === */}
      <div className="flex-1 min-h-0 flex flex-col text-[10px] font-mono overflow-hidden relative z-0">
        {/* Asks (Sells) - 20 Levels, Reverse Order, Scrollable */}
        <div className="flex flex-col-reverse justify-end flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-red-500/20 scrollbar-track-transparent">
          {asks.slice(0, 20).reverse().map(([askPrice, askSize], i) => {
            const sizeFloat = parseFloat(askSize);
            const maxSize = Math.max(...asks.slice(0, 20).map(([, s]) => parseFloat(s)));
            const barWidth = (sizeFloat / maxSize) * 100;

            return (
              <button
                key={i}
                onClick={() => setPrice(parseFloat(askPrice).toFixed(2))}
                className="flex justify-between items-center px-2 py-0.5 hover:bg-red-500/10 relative transition-colors shrink-0"
              >
                <div className="absolute inset-0 bg-red-500/5 origin-right" style={{ width: `${barWidth}%` }} />
                <span className="text-red-400 relative z-10">{parseFloat(askPrice).toFixed(2)}</span>
                <span className="text-gray-500 relative z-10">{sizeFloat.toFixed(4)}</span>
              </button>
            );
          })}
        </div>

        {/* Spread Indicator */}
        <div className="px-2 py-1 bg-yellow-500/10 border-y border-yellow-500/20 text-center text-[9px] text-yellow-400 font-bold shrink-0">
          SPREAD: {spread.toFixed(2)} USDT
        </div>

        {/* Bids (Buys) - 20 Levels, Scrollable */}
        <div className="flex flex-col justify-start flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-green-500/20 scrollbar-track-transparent">
          {bids.slice(0, 20).map(([bidPrice, bidSize], i) => {
            const sizeFloat = parseFloat(bidSize);
            const maxSize = Math.max(...bids.slice(0, 20).map(([, s]) => parseFloat(s)));
            const barWidth = (sizeFloat / maxSize) * 100;

            return (
              <button
                key={i}
                onClick={() => setPrice(parseFloat(bidPrice).toFixed(2))}
                className="flex justify-between items-center px-2 py-0.5 hover:bg-green-500/10 relative transition-colors shrink-0"
              >
                <div className="absolute inset-0 bg-green-500/5 origin-right" style={{ width: `${barWidth}%` }} />
                <span className="text-green-400 relative z-10">{parseFloat(bidPrice).toFixed(2)}</span>
                <span className="text-gray-500 relative z-10">{sizeFloat.toFixed(4)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* === ZONE C: THE TRIGGER === */}
      <div className="shrink-0 border-t border-terminal-border p-2 space-y-2 bg-terminal-card relative z-10">
        {/* Quick Size Percentages */}
        <div className="flex gap-1">
          {[25, 50, 75, 100].map(pct => (
            <button
              key={pct}
              onClick={() => handleQuickSize(pct)}
              className="flex-1 py-1 bg-transparent border border-[#333] text-[#888] text-[10px] font-bold rounded hover:border-[#666] hover:text-[#eee] transition-colors"
            >
              {pct === 100 ? 'MAX' : `${pct}%`}
            </button>
          ))}
        </div>

        {/* Order Cost Display */}
        <div className="flex justify-between text-[9px] text-gray-500 font-mono px-1">
          <span>COST</span>
          <span className="text-gray-300">{orderCostUSDT.toFixed(2)} USDT</span>
        </div>
        <div className="flex justify-between text-[9px] text-gray-500 font-mono px-1">
          <span>MARGIN</span>
          <span className="text-yellow-400">{marginRequired.toFixed(2)} USDT</span>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/30 rounded px-2 py-1">
            {errorMsg}
          </div>
        )}

        {/* Execution Buttons (Side by Side) */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleExecute('BUY')}
            disabled={isSubmitting}
            className="btn-premium flex-col h-auto py-3 bg-green-500/10 border border-green-500/50 text-green-400 hover:bg-green-500/20 hover:border-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-[11px] font-bold tracking-wide">BUY LONG</span>
            <span className="text-[9px] text-green-300/70 mt-0.5 font-mono">≈ {orderCostUSDT.toFixed(2)} USDT</span>
          </button>

          <button
            onClick={() => handleExecute('SELL')}
            disabled={isSubmitting}
            className="btn-premium flex-col h-auto py-3 bg-red-500/10 border border-red-500/50 text-red-400 hover:bg-red-500/20 hover:border-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-[11px] font-bold tracking-wide">SELL SHORT</span>
            <span className="text-[9px] text-red-300/70 mt-0.5 font-mono">≈ {orderCostUSDT.toFixed(2)} USDT</span>
          </button>
        </div>

        {/* Live Mode Indicator */}
        <div className="flex items-center justify-center gap-2 py-1">
          <div className={`status-indicator ${isLiveMode ? 'status-live' : 'bg-yellow-500'}`} />
          <span className={`text-[9px] font-mono tracking-wider ${isLiveMode ? 'text-green-400' : 'text-yellow-400'}`}>
            {isLiveMode ? 'TESTNET LIVE' : 'PAPER TRADING'}
          </span>
        </div>
      </div>
    </div>
  );
};
