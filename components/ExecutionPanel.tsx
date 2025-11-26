import React, { useState, useEffect } from 'react';
import { PlayCircle, Shield, ArrowRight, AlertTriangle, Zap } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Position } from '../types';
import { calculatePositionSize, calculateLiquidationPrice } from '../utils/tradingCalculations';
import { binanceApi } from '../services/binanceApi';

export const ExecutionPanel: React.FC = () => {
    const { 
        price: currentPrice, 
        balance, 
        addPosition: onExecute, 
        activeTradeSetup: initialValues,
        isLiveMode,
        setIsLiveMode
    } = useStore();

    const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG');
    const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
    const [leverage, setLeverage] = useState(5);
    const [riskPercent, setRiskPercent] = useState(1); // 1% risk
    const [stopLoss, setStopLoss] = useState<string>('');
    const [takeProfit, setTakeProfit] = useState<string>('');
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Load draft if available
    useEffect(() => {
        if (initialValues) {
            if (initialValues.type) setSide(initialValues.type);
            if (initialValues.stopLoss) setStopLoss(initialValues.stopLoss.toString());
            if (initialValues.takeProfit) setTakeProfit(initialValues.takeProfit.toString());
        }
    }, [initialValues]);

    // Calculated values
    const [positionSizeBTC, setPositionSizeBTC] = useState(0);
    const [marginUSD, setMarginUSD] = useState(0);

    // Auto-calc logic using REAL trading calculations
    useEffect(() => {
        if (currentPrice === 0) return;

        // Auto Set SL/TP defaults if empty and Market order
        if (orderType === 'MARKET' && !stopLoss && !initialValues) {
            // Use 1.5% as standard stop distance (typical for BTC volatility)
            const stopDistance = currentPrice * 0.015;
            if (side === 'LONG') {
                setStopLoss((currentPrice - stopDistance).toFixed(2));
                setTakeProfit((currentPrice + (stopDistance * 2)).toFixed(2));
            } else {
                setStopLoss((currentPrice + stopDistance).toFixed(2));
                setTakeProfit((currentPrice - (stopDistance * 2)).toFixed(2));
            }
        }

        // Calculate position size using proper risk management
        const slPrice = parseFloat(stopLoss) || (side === 'LONG' ? currentPrice * 0.985 : currentPrice * 1.015);
        const size = calculatePositionSize(balance, riskPercent, currentPrice, slPrice, leverage);
        setPositionSizeBTC(size);

        // Calculate margin (collateral) required
        const positionValue = currentPrice * size;
        const margin = positionValue / leverage;
        setMarginUSD(margin);

    }, [currentPrice, balance, riskPercent, leverage, side, orderType, stopLoss, initialValues]);

    const handleExecute = async () => {
        if (currentPrice === 0) return;
        setErrorMsg(null);
        setIsSubmitting(true);

        const slPrice = parseFloat(stopLoss) || (side === 'LONG' ? currentPrice * 0.95 : currentPrice * 1.05);
        const tpPrice = parseFloat(takeProfit) || (side === 'LONG' ? currentPrice * 1.05 : currentPrice * 0.95);
        const liqPrice = calculateLiquidationPrice(currentPrice, leverage, side);

        try {
            if (isLiveMode) {
                // Execute on Binance Testnet
                const sideParam = side === 'LONG' ? 'BUY' : 'SELL';
                await binanceApi.placeOrder('BTCUSDT', sideParam, orderType, positionSizeBTC);
                
                // Note: We don't manually add to store in Live Mode. 
                // The WebSocket or Polling should pick up the new position.
                // But for immediate feedback in this POC, we might want to fetch positions.
                // For now, let's just log success.
                console.log("Binance Order Placed Successfully");
            } else {
                // Paper Trading Execution
                const position: Position = {
                    id: Date.now().toString(),
                    pair: 'BTC/USD',
                    type: side,
                    entryPrice: currentPrice,
                    size: positionSizeBTC,
                    leverage: leverage,
                    stopLoss: slPrice,
                    takeProfit: tpPrice,
                    timestamp: Date.now(),
                    pnl: 0,
                    pnlPercent: 0,
                    liquidationPrice: liqPrice
                };
                onExecute(position);
                console.log(`[Execution] ${side} position opened @ $${currentPrice.toFixed(2)} | Size: ${positionSizeBTC.toFixed(4)} BTC | Liq: $${liqPrice.toFixed(2)}`);
            }
            
            setShowConfirmation(false);
        } catch (err: any) {
            console.error("Execution Error:", err);
            setErrorMsg(err.message || "Order Failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-terminal-card border border-terminal-border rounded-lg p-5 shadow-xl relative">
            {/* Confirmation Modal Overlay */}
            {showConfirmation && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 rounded-lg animate-in fade-in duration-200">
                    <div className="bg-terminal-card border border-terminal-border rounded-lg w-full p-4 shadow-2xl">
                        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                            <Shield size={16} className="text-terminal-accent" />
                            CONFIRM {isLiveMode ? 'LIVE' : 'PAPER'} ORDER
                        </h3>
                        
                        {isLiveMode && (
                            <div className="mb-4 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-[10px] text-yellow-500 flex items-center gap-2">
                                <AlertTriangle size={12} />
                                <span>WARNING: This will place a REAL order on Binance Testnet.</span>
                            </div>
                        )}

                        {errorMsg && (
                            <div className="mb-4 p-2 bg-red-500/10 border border-red-500/30 rounded text-[10px] text-red-500">
                                {errorMsg}
                            </div>
                        )}
                        
                        <div className="space-y-3 text-xs font-mono mb-6">
                            <div className="flex justify-between">
                                <span className="text-gray-500">SIDE</span>
                                <span className={`font-bold ${side === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>{side}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">SIZE</span>
                                <span className="text-white">{positionSizeBTC.toFixed(4)} BTC</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">ENTRY</span>
                                <span className="text-white">${currentPrice.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">LEVERAGE</span>
                                <span className="text-yellow-400">{leverage}x</span>
                            </div>
                            <div className="border-t border-white/10 pt-2 flex justify-between">
                                <span className="text-gray-500">MARGIN</span>
                                <span className="text-white">${marginUSD.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => { setShowConfirmation(false); setErrorMsg(null); }}
                                className="py-2 rounded border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white transition-colors text-xs font-bold"
                                disabled={isSubmitting}
                            >
                                CANCEL
                            </button>
                            <button 
                                onClick={handleExecute}
                                disabled={isSubmitting}
                                className={`py-2 rounded text-white text-xs font-bold shadow-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-2 ${
                                    side === 'LONG' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'
                                } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isSubmitting ? 'SENDING...' : 'CONFIRM'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mb-6 pb-4 border-b border-terminal-border">
                <div className="flex items-center gap-2 text-terminal-accent">
                    <div className="p-2 bg-terminal-accent/10 rounded-lg">
                        <PlayCircle size={20} />
                    </div>
                    <div>
                        <h2 className="font-mono font-bold tracking-wider text-sm">EXECUTION ENGINE</h2>
                        <div className="text-[10px] text-terminal-muted font-mono">ORDER ENTRY TERMINAL</div>
                    </div>
                </div>
                
                {/* Live Mode Toggle */}
                <button
                    onClick={() => setIsLiveMode(!isLiveMode)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-bold transition-all ${
                        isLiveMode 
                        ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.2)]' 
                        : 'bg-terminal-bg border-terminal-border text-gray-500 hover:text-gray-300'
                    }`}
                >
                    <Zap size={10} className={isLiveMode ? 'fill-yellow-500' : ''} />
                    {isLiveMode ? 'TESTNET LIVE' : 'PAPER MODE'}
                </button>
            </div>

            {/* Order Type Tabs */}
            <div className="grid grid-cols-2 gap-2 mb-4 p-1 bg-terminal-bg rounded-lg border border-terminal-border">
                {['MARKET', 'LIMIT'].map(t => (
                    <button
                        key={t}
                        onClick={() => setOrderType(t as any)}
                        className={`text-xs py-2 rounded font-mono font-bold transition-all ${orderType === t
                                ? 'bg-terminal-card text-terminal-text shadow-sm border border-terminal-border'
                                : 'text-terminal-muted hover:text-terminal-text'
                            }`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {/* Side Selector */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                    onClick={() => setSide('LONG')}
                    className={`py-4 rounded-lg font-mono font-bold text-sm border transition-all flex flex-col items-center gap-1 ${side === 'LONG'
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                            : 'bg-terminal-bg border-terminal-border text-terminal-muted opacity-50 hover:opacity-100'
                        }`}
                >
                    <span>LONG</span>
                    <span className="text-[10px] opacity-70 font-normal">BUY</span>
                </button>
                <button
                    onClick={() => setSide('SHORT')}
                    className={`py-4 rounded-lg font-mono font-bold text-sm border transition-all flex flex-col items-center gap-1 ${side === 'SHORT'
                            ? 'bg-red-500/10 border-red-500 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                            : 'bg-terminal-bg border-terminal-border text-terminal-muted opacity-50 hover:opacity-100'
                        }`}
                >
                    <span>SHORT</span>
                    <span className="text-[10px] opacity-70 font-normal">SELL</span>
                </button>
            </div>

            {/* Inputs */}
            <div className="space-y-5 flex-1">

                {/* Leverage Slider */}
                <div className="bg-terminal-bg/30 p-3 rounded-lg border border-terminal-border/50">
                    <div className="flex justify-between text-xs font-mono text-terminal-muted mb-3">
                        <span className="flex items-center gap-1">LEVERAGE <span className="text-[9px] bg-terminal-border px-1 rounded">MAX 100x</span></span>
                        <span className="text-terminal-warn font-bold">{leverage}x</span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="100"
                        value={leverage}
                        onChange={(e) => setLeverage(parseInt(e.target.value))}
                        className="w-full accent-terminal-accent h-1.5 bg-terminal-border rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                {/* Risk Slider */}
                <div className="bg-terminal-bg/30 p-3 rounded-lg border border-terminal-border/50">
                    <div className="flex justify-between text-xs font-mono text-terminal-muted mb-3">
                        <span>RISK PER TRADE</span>
                        <span className="text-terminal-danger font-bold">{riskPercent}%</span>
                    </div>
                    <input
                        type="range"
                        min="0.1"
                        max="5"
                        step="0.1"
                        value={riskPercent}
                        onChange={(e) => setRiskPercent(parseFloat(e.target.value))}
                        className="w-full accent-terminal-danger h-1.5 bg-terminal-border rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-mono text-terminal-muted pl-1">STOP LOSS</label>
                        <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-terminal-muted text-xs">$</span>
                            <input
                                type="number"
                                value={stopLoss}
                                onChange={e => setStopLoss(e.target.value)}
                                className="w-full bg-terminal-bg border border-terminal-border rounded p-2 pl-5 text-xs font-mono text-terminal-danger focus:border-terminal-danger outline-none transition-colors"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-mono text-terminal-muted pl-1">TAKE PROFIT</label>
                        <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-terminal-muted text-xs">$</span>
                            <input
                                type="number"
                                value={takeProfit}
                                onChange={e => setTakeProfit(e.target.value)}
                                className="w-full bg-terminal-bg border border-terminal-border rounded p-2 pl-5 text-xs font-mono text-terminal-accent focus:border-terminal-accent outline-none transition-colors"
                            />
                        </div>
                    </div>
                </div>

                {/* Summary */}
                <div className="bg-terminal-bg border border-terminal-border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between text-xs font-mono">
                        <span className="text-terminal-muted">SIZE (BTC)</span>
                        <span className="text-terminal-text font-bold">{positionSizeBTC.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-mono">
                        <span className="text-terminal-muted">MARGIN REQ.</span>
                        <span className="text-terminal-text font-bold">${marginUSD.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-mono border-t border-terminal-border/50 pt-3 mt-1">
                        <span className="text-terminal-muted">EST. LIQ PRICE</span>
                        <span className="text-terminal-warn">
                            {currentPrice > 0 ? `$${calculateLiquidationPrice(currentPrice, leverage, side).toFixed(2)}` : '-'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Execute Button */}
            <button
                onClick={() => setShowConfirmation(true)}
                className={`w-full py-4 mt-4 rounded-lg font-mono font-bold text-sm tracking-wider transition-all hover:brightness-110 hover:scale-[1.02] shadow-lg flex items-center justify-center gap-2 ${side === 'LONG'
                        ? 'bg-emerald-600 text-white shadow-emerald-900/30'
                        : 'bg-red-600 text-white shadow-red-900/30'
                    }`}
            >
                {side === 'LONG' ? 'PLACE LONG ORDER' : 'PLACE SHORT ORDER'} <ArrowRight size={16} />
            </button>

            <div className="mt-4 flex items-center gap-2 justify-center text-[10px] text-terminal-muted opacity-70">
                <Shield size={10} />
                <span>SMART RISK GUARD: ACTIVE</span>
            </div>
        </div>
    );
};
