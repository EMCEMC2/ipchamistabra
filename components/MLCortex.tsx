import React, { useEffect, useRef, useState } from 'react';
import { Brain, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { useStore } from '../store/useStore';
import { ChartDataPoint } from '../types';
import { LinearRegression, KMeans } from '../utils/ml';
import { analyzeMarketRegime, calculateVolatility, calculateTrendStrength } from '../services/mlService';

// Local helper functions removed in favor of shared mlService


// Scatter plot component for regime clusters
const RegimeScatter: React.FC<{ data: { vol: number; trend: number; regime: string; color: string }[] }> = ({ data }) => {
    return (
        <svg viewBox="0 0 300 200" className="w-full h-full">
            {/* Grid */}
            <line x1="0" y1="100" x2="300" y2="100" stroke="#27272a" strokeWidth="0.5" />
            <line x1="150" y1="0" x2="150" y2="200" stroke="#27272a" strokeWidth="0.5" />

            {/* Axes labels */}
            <text x="5" y="15" fontSize="8" fill="#52525b" fontFamily="monospace">High Vol</text>
            <text x="5" y="195" fontSize="8" fill="#52525b" fontFamily="monospace">Low Vol</text>
            <text x="280" y="105" fontSize="8" fill="#52525b" fontFamily="monospace">+%</text>
            <text x="5" y="105" fontSize="8" fill="#52525b" fontFamily="monospace">-%</text>

            {/* Plot points */}
            {data.map((point, i) => {
                const x = 150 + (point.trend * 5); // Scale trend to x-axis
                const y = 100 - (point.vol * 2); // Scale vol to y-axis
                return (
                    <circle
                        key={i}
                        cx={Math.max(10, Math.min(290, x))}
                        cy={Math.max(10, Math.min(190, y))}
                        r="3"
                        fill={point.color}
                        opacity="0.7"
                    />
                );
            })}

            {/* Current point (larger) */}
            {data.length > 0 && (
                <circle
                    cx={Math.max(10, Math.min(290, 150 + data[data.length - 1].trend * 5))}
                    cy={Math.max(10, Math.min(190, 100 - data[data.length - 1].vol * 2))}
                    r="6"
                    fill={data[data.length - 1].color}
                    opacity="1"
                    stroke="#ffffff"
                    strokeWidth="1"
                />
            )}
        </svg>
    );
};

// Volatility chart using Canvas
const VolatilityChart: React.FC<{ data: number[] }> = ({ data }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || data.length === 0) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const padding = 30;

        // Clear
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, width, height);

        // Grid
        ctx.strokeStyle = '#27272a';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padding + (height - 2 * padding) * i / 4;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(width - padding, y);
            ctx.stroke();
        }

        // Data
        const max = Math.max(...data, 1);
        const min = Math.min(...data, 0);
        const range = max - min || 1;

        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();

        data.forEach((val, i) => {
            const x = padding + (width - 2 * padding) * i / (data.length - 1);
            const y = height - padding - ((val - min) / range) * (height - 2 * padding);

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        ctx.stroke();

        // Labels
        ctx.fillStyle = '#52525b';
        ctx.font = '10px monospace';
        ctx.fillText(`${max.toFixed(1)}%`, 5, padding + 10);
        ctx.fillText(`${min.toFixed(1)}%`, 5, height - padding + 15);

    }, [data]);

    return <canvas ref={canvasRef} width={600} height={200} className="w-full h-full" />;
};

export const MLCortex: React.FC = () => {
    const { chartData, vix } = useStore();
    const safeChartData = chartData || [];
    const [volHistory, setVolHistory] = useState<number[]>([]);
    const [regimeHistory, setRegimeHistory] = useState<{ vol: number; trend: number; regime: string; color: string }[]>([]);
    const [currentRegime, setCurrentRegime] = useState({ regime: 'LOADING...', color: '#6b7280' });
    const [currentStats, setCurrentStats] = useState({ vol: 0, trend: 0 });

    useEffect(() => {
        if (safeChartData.length < 50) return;

        // Use shared ML Service for analysis
        const analysis = analyzeMarketRegime(safeChartData, vix);

        setCurrentRegime({ regime: analysis.regime, color: analysis.regimeColor });
        setCurrentStats({ vol: analysis.volatility, trend: analysis.predictedTrend });

        // Reconstruct history for the scatter plot (using shared helpers)
        // We do this locally for the UI visualization
        const history: { vol: number; trend: number; regime: string; color: string }[] = [];
        const volHist: number[] = [];

        for (let i = 50; i < safeChartData.length; i++) {
            const slice = safeChartData.slice(0, i + 1);
            // We run a "light" analysis for history to avoid re-training KMeans 100 times
            // Just calculate metrics and use the *current* model's classification logic (simplified)
            const v = calculateVolatility(slice, 20);
            const t = calculateTrendStrength(slice, 20);

            // Simple heuristic for history coloring (matching the ML service logic roughly)
            let color = '#6b7280';
            let label = 'NEUTRAL';
            if (v > 25) {
                if (t > 1) { label = 'HIGH VOL BULL'; color = '#22c55e'; }
                else if (t < -1) { label = 'HIGH VOL BEAR'; color = '#dc2626'; }
                else { label = 'HIGH VOL CHOP'; color = '#f59e0b'; }
            } else {
                if (t > 1) { label = 'STEADY UPTREND'; color = '#10b981'; }
                else if (t < -1) { label = 'STEADY DOWNTREND'; color = '#ef4444'; }
                else { label = 'RANGING'; color = '#3b82f6'; }
            }

            history.push({ vol: v, trend: t, regime: label, color });
            volHist.push(v);
        }

        setVolHistory(volHist);
        setRegimeHistory(history);

    }, [chartData, vix]);

    const getTrendIcon = () => {
        if (currentStats.trend > 2) return <TrendingUp className="text-green-500" size={24} />;
        if (currentStats.trend < -2) return <TrendingDown className="text-red-500" size={24} />;
        return <Minus className="text-gray-500" size={24} />;
    };

    return (
        <div className="h-full grid grid-cols-12 gap-4 p-4 overflow-y-auto">
            {/* Header */}
            <div className="col-span-12 bg-terminal-card border border-terminal-border rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-terminal-accent/10 rounded border border-terminal-accent/20">
                        <Brain className="text-terminal-accent" size={24} />
                    </div>
                    <div>
                        <h2 className="font-mono font-bold text-lg text-terminal-text">
                            MARKET REGIME ANALYZER <span className="text-xs text-terminal-accent bg-terminal-accent/10 px-2 py-0.5 rounded ml-2 border border-terminal-accent/20">LIVE</span>
                        </h2>
                        <div className="flex gap-4 text-xs font-mono text-terminal-muted mt-1">
                            <span className="flex items-center gap-1"><Activity size={12} /> REAL-TIME VOLATILITY TRACKING</span>
                            <span className="flex items-center gap-1">Based on {safeChartData.length} candles</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {getTrendIcon()}
                    <div className="text-right">
                        <div className="text-2xl font-bold font-mono" style={{ color: currentRegime.color }}>
                            {currentRegime.regime}
                        </div>
                        <div className="text-xs text-terminal-muted font-mono mt-1">
                            Vol: {currentStats.vol.toFixed(1)}% • Trend: {currentStats.trend > 0 ? '+' : ''}{currentStats.trend.toFixed(2)}%
                        </div>
                    </div>
                </div>
            </div>

            {/* Volatility Time Series */}
            <div className="col-span-8 bg-terminal-card border border-terminal-border rounded-lg p-4 flex flex-col h-[280px]">
                <h3 className="font-mono text-sm text-terminal-muted mb-2">ROLLING VOLATILITY (20-Period)</h3>
                <div className="flex-1">
                    <VolatilityChart data={volHistory} />
                </div>
            </div>

            {/* Current Stats */}
            <div className="col-span-4 bg-terminal-card border border-terminal-border rounded-lg p-4 flex flex-col h-[280px]">
                <h3 className="font-mono text-sm text-terminal-muted mb-4">REGIME PARAMETERS</h3>
                <div className="space-y-4">
                    <div className="p-3 bg-terminal-bg border border-terminal-border rounded">
                        <div className="text-xs font-mono text-terminal-muted">VOLATILITY</div>
                        <div className="text-2xl font-mono text-blue-400 mt-1">{currentStats.vol.toFixed(2)}%</div>
                        <div className="text-[10px] text-terminal-muted mt-1">Annualized</div>
                    </div>
                    <div className="p-3 bg-terminal-bg border border-terminal-border rounded">
                        <div className="text-xs font-mono text-terminal-muted">TREND STRENGTH</div>
                        <div className="text-2xl font-mono text-yellow-400 mt-1">
                            {currentStats.trend > 0 ? '+' : ''}{currentStats.trend.toFixed(2)}%
                        </div>
                        <div className="text-[10px] text-terminal-muted mt-1">20-Period Change</div>
                    </div>
                    <div className="p-3 bg-terminal-bg border border-terminal-border rounded">
                        <div className="text-xs font-mono text-terminal-muted">DATA POINTS</div>
                        <div className="text-2xl font-mono text-green-400 mt-1">{safeChartData.length}</div>
                        <div className="text-[10px] text-terminal-muted mt-1">Candles Loaded</div>
                    </div>
                </div>
            </div>

            {/* Regime Scatter Plot */}
            <div className="col-span-12 bg-terminal-card border border-terminal-border rounded-lg p-4 h-[300px]">
                <h3 className="font-mono text-sm text-terminal-muted mb-2">REGIME CLASSIFICATION MAP</h3>
                <div className="w-full h-[calc(100%-2rem)]">
                    <RegimeScatter data={regimeHistory} />
                </div>
            </div>
        </div>
    );
};
