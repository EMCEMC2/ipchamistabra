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

interface OrderBookLevel {
  price: string;
  size: string;
}

export const ExecutionPanelPro: React.FC = () => {
  const {
    price: currentPrice,
    balance,
    addPosition,
    activeTradeSetup,
    isLiveMode,
    setIsLiveMode
  } = useStore();

  // === ZONE A: ORDER LOGIC ===
  const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET' | 'STOP' | 'OCO'>('LIMIT');
  const [marginMode, setMarginMode] = useState<'CROSS' | 'ISOLATED'>('CROSS');
  const [leverage, setLeverage] = useState<number>(5);
  const [price, setPrice] = useState<string>(currentPrice.toFixed(2));
  const [sizeBTC, setSizeBTC] = useState<string>('0.01');
  const [sizeUSDT, setSizeUSDT] = useState<string>('');
  const [sizeMode, setSizeMode] = useState<'BTC' | 'USDT'>('BTC');

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

  // WebSocket Order Book Feed (Binance)
  useEffect(() => {
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@depth10@100ms');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setBids(data.bids?.slice(0, 5) || []);
      setAsks(data.asks?.slice(0, 5) || []);

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

  // Execute Order
  const handleExecute = async (side: 'BUY' | 'SELL') => {
    if (!sizeBTC || parseFloat(sizeBTC) <= 0) {
      setErrorMsg('Invalid size');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    const executionPrice = parseFloat(price);
    const size = parseFloat(sizeBTC);
    const liqPrice = calculateLiquidationPrice(executionPrice, leverage, side === 'BUY' ? 'LONG' : 'SHORT');

    try {
      if (isLiveMode) {
        await binanceApi.placeOrder('BTCUSDT', side, orderType, size);
        console.log(`[LIVE] ${side} ${size} BTC @ ${executionPrice}`);
      } else {
        // Paper Trading
        const position: Position = {
          id: Date.now().toString(),
          pair: 'BTC/USD',
          type: side === 'BUY' ? 'LONG' : 'SHORT',
          entryPrice: executionPrice,
          size: size,
          leverage: leverage,
          stopLoss: 0, // Set separately
          takeProfit: 0, // Set separately
          timestamp: Date.now(),
          pnl: 0,
          pnlPercent: 0,
          liquidationPrice: liqPrice
        };
        addPosition(position);
        console.log(`[PAPER] ${side} ${size} BTC @ ${executionPrice}`);
      }

      setShowConfirmation(false);
    } catch (err: any) {
      console.error('Execution Error:', err);
      setErrorMsg(err.message || 'Order Failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-terminal-card border border-terminal-border rounded-lg overflow-hidden">
      {/* === ZONE A: ORDER LOGIC === */}
      <div className="shrink-0 border-b border-terminal-border">
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
      </div>

      {/* === ZONE B: MICRO DEPTH === */}
      <div className="flex-1 min-h-0 flex flex-col text-[10px] font-mono">
        {/* Asks (Sells) - Top 5, Reverse Order */}
        <div className="flex flex-col-reverse">
          {asks.slice(0, 5).reverse().map(([askPrice, askSize], i) => {
            const sizeFloat = parseFloat(askSize);
            const maxSize = Math.max(...asks.slice(0, 5).map(([, s]) => parseFloat(s)));
            const barWidth = (sizeFloat / maxSize) * 100;

            return (
              <button
                key={i}
                onClick={() => setPrice(parseFloat(askPrice).toFixed(2))}
                className="flex justify-between items-center px-2 py-0.5 hover:bg-red-500/10 relative transition-colors"
              >
                <div className="absolute inset-0 bg-red-500/5 origin-right" style={{ width: `${barWidth}%` }} />
                <span className="text-red-400 relative z-10">{parseFloat(askPrice).toFixed(2)}</span>
                <span className="text-gray-500 relative z-10">{sizeFloat.toFixed(4)}</span>
              </button>
            );
          })}
        </div>

        {/* Spread Indicator */}
        <div className="px-2 py-1 bg-yellow-500/10 border-y border-yellow-500/20 text-center text-[9px] text-yellow-400 font-bold">
          SPREAD: {spread.toFixed(2)} USDT
        </div>

        {/* Bids (Buys) - Top 5 */}
        <div className="flex flex-col">
          {bids.slice(0, 5).map(([bidPrice, bidSize], i) => {
            const sizeFloat = parseFloat(bidSize);
            const maxSize = Math.max(...bids.slice(0, 5).map(([, s]) => parseFloat(s)));
            const barWidth = (sizeFloat / maxSize) * 100;

            return (
              <button
                key={i}
                onClick={() => setPrice(parseFloat(bidPrice).toFixed(2))}
                className="flex justify-between items-center px-2 py-0.5 hover:bg-green-500/10 relative transition-colors"
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
      <div className="shrink-0 border-t border-terminal-border p-2 space-y-2">
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
            className="flex flex-col items-center justify-center py-3 bg-green-600/20 border-2 border-green-500 text-green-400 rounded hover:bg-green-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-[11px] font-bold tracking-wide">BUY LONG</span>
            <span className="text-[9px] text-green-300 mt-0.5">≈ {orderCostUSDT.toFixed(2)} USDT</span>
          </button>

          <button
            onClick={() => handleExecute('SELL')}
            disabled={isSubmitting}
            className="flex flex-col items-center justify-center py-3 bg-red-600/20 border-2 border-red-500 text-red-400 rounded hover:bg-red-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-[11px] font-bold tracking-wide">SELL SHORT</span>
            <span className="text-[9px] text-red-300 mt-0.5">≈ {orderCostUSDT.toFixed(2)} USDT</span>
          </button>
        </div>

        {/* Live Mode Indicator */}
        <div className="text-center text-[9px] text-gray-500 font-mono">
          {isLiveMode ? '🔴 TESTNET LIVE' : '📝 PAPER MODE'}
        </div>
      </div>
    </div>
  );
};
