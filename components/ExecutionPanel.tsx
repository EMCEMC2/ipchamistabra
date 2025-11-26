import React, { useState, useEffect } from 'react';
import { Shield, Zap, AlertTriangle, ChevronDown } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useOrderBook } from '../hooks/useOrderBook';
import { calculatePositionSize, calculateLiquidationPrice } from '../utils/tradingCalculations';
import { binanceApi } from '../services/binanceApi';
import { Position } from '../types';

export const ExecutionPanel: React.FC = () => {
    const { 
        price: currentPrice, 
        balance, 
        addPosition: onExecute, 
        activeTradeSetup: initialValues,
        isLiveMode,
        setIsLiveMode,
        executionSide,
        setExecutionSide
    } = useStore();

    // -- STATE --
    const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET' | 'STOP' | 'OCO'>('LIMIT');
    const [marginMode, setMarginMode] = useState<'CROSS' | 'ISOLATED'>('CROSS');
    const [leverage, setLeverage] = useState(20);
    
    // Inputs
    const [priceInput, setPriceInput] = useState<string>('');
    const [sizeInput, setSizeInput] = useState<string>(''); // In BTC
    const [sizeUsdtInput, setSizeUsdtInput] = useState<string>(''); // In USDT

    // Order Book Data
    const { bids, asks, isLoading: isBookLoading } = useOrderBook('BTCUSDT');

    // Sync Price Input with Current Price on Mount/Update if empty
    useEffect(() => {
        if (currentPrice > 0 && !priceInput && orderType === 'MARKET') {
            setPriceInput(currentPrice.toFixed(2));
        }
    }, [currentPrice, orderType]);

    // Handle Size Conversion
    const handleSizeBtcChange = (val: string) => {
        setSizeInput(val);
        const btc = parseFloat(val);
        if (!isNaN(btc) && currentPrice > 0) {
            setSizeUsdtInput((btc * currentPrice).toFixed(2));
        } else {
            setSizeUsdtInput('');
        }
    };

    const handleSizeUsdtChange = (val: string) => {
        setSizeUsdtInput(val);
        const usdt = parseFloat(val);
        if (!isNaN(usdt) && currentPrice > 0) {
            setSizeInput((usdt / currentPrice).toFixed(4));
        } else {
            setSizeInput('');
        }
    };

    // Quick Percentages
    const setSizeByPercent = (percent: number) => {
        if (currentPrice === 0) return;
        // Calculate max size based on balance & leverage
        const maxUsd = balance * leverage;
        const targetUsd = maxUsd * percent;
        const targetBtc = targetUsd / currentPrice;
        
        setSizeInput(targetBtc.toFixed(4));
        setSizeUsdtInput(targetUsd.toFixed(2));
    };

    // Execution Logic
    const handleExecute = async (side: 'LONG' | 'SHORT') => {
        setExecutionSide(side);
        // ... (Existing execution logic adapted)
        console.log(`Executing ${side} ${orderType} Size: ${sizeInput} BTC @ ${priceInput}`);
        
        // Mock Execution for now
        if (!isLiveMode) {
             const entryPrice = parseFloat(priceInput) || currentPrice;
             const size = parseFloat(sizeInput);
             if (!size || !entryPrice) return;

             const liqPrice = calculateLiquidationPrice(entryPrice, leverage, side);
             
             const position: Position = {
                id: Date.now().toString(),
                pair: 'BTC/USD',
                type: side,
                entryPrice: entryPrice,
                size: size,
                leverage: leverage,
                stopLoss: 0, // TODO: Add SL input
                takeProfit: 0, // TODO: Add TP input
                timestamp: Date.now(),
                pnl: 0,
                pnlPercent: 0,
                liquidationPrice: liqPrice
            };
            onExecute(position);
        }
    };

    // Helper for Order Book Rows
    const BookRow = ({ price, size, type }: { price: number, size: number, type: 'bid' | 'ask' }) => (
        <div 
            className="grid grid-cols-2 text-[10px] font-mono cursor-pointer hover:bg-white/5 px-1 py-0.5"
            onClick={() => setPriceInput(price.toFixed(2))}
        >
            <span className={type === 'ask' ? 'text-red-400' : 'text-green-400'}>
                {price.toFixed(2)}
            </span>
            <span className="text-right text-gray-500">{size.toFixed(3)}</span>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-[#050505] border border-[#1a1a1a] rounded-sm overflow-hidden font-sans">
            
            {/* --- ZONE A: ORDER LOGIC --- */}
            <div className="p-2 border-b border-[#1a1a1a] space-y-2">
                
                {/* Row 1: Order Type Tabs */}
                <div className="flex bg-[#0f0f0f] rounded-sm p-0.5 border border-[#2a2a2a]">
                    {['LIMIT', 'MARKET', 'STOP', 'OCO'].map(t => (
                        <button
                            key={t}
                            onClick={() => setOrderType(t as any)}
                            className={`flex-1 text-[10px] font-medium py-1 rounded-sm transition-colors ${
                                orderType === t 
                                ? 'bg-[#2a2a2a] text-gray-100 shadow-sm' 
                                : 'text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                {/* Row 2: Leverage & Margin */}
                <div className="flex items-center justify-between px-1">
                    <button 
                        onClick={() => setMarginMode(m => m === 'CROSS' ? 'ISOLATED' : 'CROSS')}
                        className="text-[10px] text-gray-400 hover:text-gray-200 flex items-center gap-1"
                    >
                        {marginMode} <ChevronDown size={10} />
                    </button>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500">Lev:</span>
                        <input 
                            type="number" 
                            value={leverage}
                            onChange={e => setLeverage(parseInt(e.target.value))}
                            className="w-8 bg-transparent text-right text-[10px] text-yellow-500 font-mono focus:outline-none border-b border-dashed border-gray-700 hover:border-gray-500"
                        />
                        <span className="text-[10px] text-yellow-500">x</span>
                    </div>
                </div>

                {/* Row 3: Input Grid */}
                <div className="grid grid-cols-2 gap-2">
                    {/* Price Input */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-[9px] text-gray-500 px-1">
                            <span>PRICE</span>
                            <span 
                                className="cursor-pointer hover:text-blue-400"
                                onClick={() => setPriceInput(currentPrice.toFixed(2))}
                            >
                                LAST
                            </span>
                        </div>
                        <div className="relative group">
                            <input
                                type="number"
                                value={priceInput}
                                onChange={e => setPriceInput(e.target.value)}
                                className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-sm text-right pr-8 pl-2 py-1.5 text-xs font-mono text-white focus:border-blue-500/50 outline-none transition-colors tabular-nums"
                                placeholder="0.00"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-600 pointer-events-none">USDT</span>
                        </div>
                    </div>

                    {/* Size Input */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-[9px] text-gray-500 px-1">
                            <span>SIZE</span>
                            <span>BTC</span>
                        </div>
                        <div className="relative group">
                            <input
                                type="number"
                                value={sizeInput}
                                onChange={e => handleSizeBtcChange(e.target.value)}
                                className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-sm text-right pr-8 pl-2 py-1.5 text-xs font-mono text-white focus:border-blue-500/50 outline-none transition-colors tabular-nums"
                                placeholder="0.00"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-600 pointer-events-none">BTC</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- ZONE B: MICRO-DEPTH (MINI ORDER BOOK) --- */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-[#080808]">
                {/* Asks (Red) - Show lowest 5 */}
                <div className="flex-1 flex flex-col justify-end overflow-hidden pb-0.5">
                    {asks.slice(-5).map((ask, i) => (
                        <BookRow key={i} price={ask.price} size={ask.size} type="ask" />
                    ))}
                </div>
                
                {/* Spread / Current Price */}
                <div className="py-0.5 bg-[#121212] flex items-center justify-between px-2 border-y border-[#1a1a1a]">
                    <span className={`text-xs font-mono font-bold ${currentPrice > parseFloat(priceInput || '0') ? 'text-green-500' : 'text-red-500'}`}>
                        {currentPrice.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-gray-600">SPREAD 0.01%</span>
                </div>

                {/* Bids (Green) - Show highest 5 */}
                <div className="flex-1 flex flex-col justify-start overflow-hidden pt-0.5">
                    {bids.slice(0, 5).map((bid, i) => (
                        <BookRow key={i} price={bid.price} size={bid.size} type="bid" />
                    ))}
                </div>
            </div>

            {/* --- ZONE C: THE TRIGGER --- */}
            <div className="p-2 border-t border-[#1a1a1a] space-y-2 bg-[#050505]">
                
                {/* Row 1: Percentages */}
                <div className="flex gap-1">
                    {[0.25, 0.50, 0.75, 1.0].map(pct => (
                        <button
                            key={pct}
                            onClick={() => setSizeByPercent(pct)}
                            className="flex-1 bg-transparent border border-[#333] text-[#888] hover:border-[#666] hover:text-[#eee] text-[9px] py-1 rounded-sm transition-colors"
                        >
                            {pct * 100}%
                        </button>
                    ))}
                </div>

                {/* Row 2: Execution Buttons */}
                <div className="grid grid-cols-2 gap-2">
                    {/* BUY / LONG */}
                    <button
                        onClick={() => handleExecute('LONG')}
                        className="group relative flex flex-col items-center justify-center py-2 rounded-sm border border-green-900/50 bg-green-900/10 hover:bg-green-900/20 transition-all"
                    >
                        <span className="text-xs font-bold text-green-500 group-hover:text-green-400">BUY / LONG</span>
                        <span className="text-[9px] text-green-700/70 group-hover:text-green-600 font-mono">
                            ≈ ${sizeUsdtInput || '0'}
                        </span>
                    </button>

                    {/* SELL / SHORT */}
                    <button
                        onClick={() => handleExecute('SHORT')}
                        className="group relative flex flex-col items-center justify-center py-2 rounded-sm border border-red-900/50 bg-red-900/10 hover:bg-red-900/20 transition-all"
                    >
                        <span className="text-xs font-bold text-red-500 group-hover:text-red-400">SELL / SHORT</span>
                        <span className="text-[9px] text-red-700/70 group-hover:text-red-600 font-mono">
                            ≈ ${sizeUsdtInput || '0'}
                        </span>
                    </button>
                </div>

                {/* Live Mode Toggle (Compact) */}
                <div className="flex justify-center pt-1">
                     <button
                        onClick={() => setIsLiveMode(!isLiveMode)}
                        className={`text-[9px] flex items-center gap-1 px-2 py-0.5 rounded border transition-all ${
                            isLiveMode 
                            ? 'bg-yellow-900/20 border-yellow-700 text-yellow-500' 
                            : 'bg-transparent border-gray-800 text-gray-600 hover:text-gray-400'
                        }`}
                    >
                        <Zap size={8} className={isLiveMode ? 'fill-yellow-500' : ''} />
                        {isLiveMode ? 'LIVE EXECUTION' : 'PAPER TRADING'}
                    </button>
                </div>
            </div>
        </div>
    );
};
