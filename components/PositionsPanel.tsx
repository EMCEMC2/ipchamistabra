import React from 'react';
import { TrendingUp, TrendingDown, X, AlertTriangle, Shield, Wallet } from 'lucide-react';
import { useStore } from '../store/useStore';
import { calculatePositionPnL } from '../utils/tradingCalculations';

export const PositionsPanel: React.FC = () => {
    const { positions, price, closePosition, addJournalEntry } = useStore();

    const handleClose = (positionId: string) => {
        const position = positions.find(p => p.id === positionId);
        if (!position) return;

        const { pnlUSD, pnlPercent } = calculatePositionPnL(position, price);

        // Close in store
        closePosition(positionId, pnlUSD);

        // Add to journal
        addJournalEntry({
            id: `journal-${Date.now()}`,
            date: Date.now(),
            pair: position.pair,
            type: position.type,
            entryPrice: position.entryPrice,
            exitPrice: price,
            size: position.size,
            leverage: position.leverage,
            pnl: pnlUSD,
            pnlPercent: pnlPercent,
            entryTime: position.timestamp,
            exitTime: Date.now(),
            notes: 'Manual Close',
            tags: ['MANUAL', position.type],
            mood: pnlUSD > 0 ? 'CONFIDENT' : 'NEUTRAL',
            result: pnlUSD > 0 ? 'WIN' : pnlUSD < 0 ? 'LOSS' : 'BE'
        });
    };

    if (positions.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-terminal-muted opacity-60">
                <Wallet size={32} className="mb-2 opacity-50" />
                <span className="text-xs font-mono">NO OPEN POSITIONS</span>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col gap-2 overflow-y-auto custom-scrollbar p-1">
            {positions.map((pos) => {
                const { pnlUSD, pnlPercent } = calculatePositionPnL(pos, price);
                const isProfit = pnlUSD >= 0;

                return (
                    <div key={pos.id} className="bg-white/5 border border-white/10 rounded p-2 hover:bg-white/10 transition-colors group relative overflow-hidden">
                        {/* Side Indicator Bar */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${pos.type === 'LONG' ? 'bg-green-500' : 'bg-red-500'}`} />

                        <div className="pl-2 flex flex-col gap-1.5">
                            {/* Header */}
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <span className={`font-bold text-xs ${pos.type === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>
                                        {pos.type} {pos.leverage}x
                                    </span>
                                    <span className="text-[10px] text-gray-400 font-mono">{pos.pair}</span>
                                </div>
                                <button
                                    onClick={() => handleClose(pos.id)}
                                    className="text-gray-500 hover:text-red-400 transition-colors p-1"
                                    title="Close Position"
                                >
                                    <X size={14} />
                                </button>
                            </div>

                            {/* Prices */}
                            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                                <div>
                                    <div className="text-gray-500">ENTRY</div>
                                    <div className="text-gray-200">${pos.entryPrice.toLocaleString()}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-gray-500">CURRENT</div>
                                    <div className="text-gray-200">${price.toLocaleString()}</div>
                                </div>
                            </div>

                            {/* PnL & Liq */}
                            <div className="flex justify-between items-end border-t border-white/5 pt-1.5 mt-0.5">
                                <div className="flex flex-col">
                                    <span className="text-[9px] text-gray-500 flex items-center gap-1">
                                        <AlertTriangle size={8} /> LIQ: <span className="text-terminal-warn">${pos.liquidationPrice.toLocaleString()}</span>
                                    </span>
                                </div>
                                <div className={`text-right font-mono font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                                    <div className="text-sm">
                                        {isProfit ? '+' : ''}{pnlUSD.toFixed(2)}
                                    </div>
                                    <div className="text-[10px] opacity-80">
                                        {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
