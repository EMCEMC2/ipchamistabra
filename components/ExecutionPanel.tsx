
import React, { useState, useEffect } from 'react';
import { DollarSign, Percent, Activity, Shield, PlayCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { Position } from '../types';

interface ExecutionPanelProps {
    currentPrice: number;
    balance: number;
    onExecute: (pos: Omit<Position, 'id' | 'timestamp' | 'pnl' | 'pnlPercent' | 'liquidationPrice'>) => void;
    initialValues?: Partial<Position> | null;
}

export const ExecutionPanel: React.FC<ExecutionPanelProps> = ({ currentPrice, balance, onExecute, initialValues }) => {
    const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG');
    const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
    const [leverage, setLeverage] = useState(5);
    const [riskPercent, setRiskPercent] = useState(1); // 1% risk
    const [stopLoss, setStopLoss] = useState<string>('');
    const [takeProfit, setTakeProfit] = useState<string>('');

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

    // Auto-calc logic
    useEffect(() => {
        if (currentPrice === 0) return;

        // Simple Position Sizing: Risk Amount / Distance to SL
        // For demo, we simplify: Margin = (Balance * Risk%) * Factor
        const calcMargin = (balance * (riskPercent / 100)) * 10; // boosting purely for UX demo size
        setMarginUSD(calcMargin);

        const size = (calcMargin * leverage) / currentPrice;
        setPositionSizeBTC(size);

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
    }, [currentPrice, balance, riskPercent, leverage, side, orderType]);

    const handleExecute = () => {
        if (currentPrice === 0) return;

        onExecute({
            pair: 'BTC/USD',
            type: side,
            entryPrice: currentPrice,
            size: positionSizeBTC,
            leverage: leverage,
            stopLoss: parseFloat(stopLoss) || (side === 'LONG' ? currentPrice * 0.95 : currentPrice * 1.05),
            takeProfit: parseFloat(takeProfit) || (side === 'LONG' ? currentPrice * 1.05 : currentPrice * 0.95),
        });
    };

    return (
        <div className="h-full flex flex-col bg-terminal-card border border-terminal-border rounded-lg p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-6 text-terminal-accent pb-4 border-b border-terminal-border">
                <div className="p-2 bg-terminal-accent/10 rounded-lg">
                    <PlayCircle size={20} />
                </div>
                <div>
                    <h2 className="font-mono font-bold tracking-wider text-sm">EXECUTION ENGINE</h2>
                    <div className="text-[10px] text-terminal-muted font-mono">ORDER ENTRY TERMINAL</div>
                </div>
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
                            {currentPrice > 0 ? (side === 'LONG' ? (currentPrice * (1 - 1 / leverage)).toFixed(0) : (currentPrice * (1 + 1 / leverage)).toFixed(0)) : '-'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Execute Button */}
            <button
                onClick={handleExecute}
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
