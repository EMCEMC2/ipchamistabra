import React, { useEffect, useRef, useState } from 'react';
import { Brain, TrendingUp, TrendingDown, Minus, Activity, Target, BarChart3 } from 'lucide-react';
import { useChartWithVix } from '../store/selectors';
import { ChartDataPoint } from '../types';
import { LinearRegression, KMeans } from '../utils/ml';
import { analyzeMarketRegime, calculateVolatility, calculateTrendStrength } from '../services/mlService';
import {
  subscribeToBacktest,
  buildPatternVisualizationData,
  PatternVisualizationData
} from '../services/backtestIntegration';
import { BacktestResults } from '../services/backtestEngine';

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

// Learning Curve Chart - shows win rate evolution over trades
const LearningCurveChart: React.FC<{ data: PatternVisualizationData['learningCurve'] }> = ({ data }) => {
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

        // 50% reference line
        const y50 = height - padding - 0.5 * (height - 2 * padding);
        ctx.strokeStyle = '#f59e0b';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(padding, y50);
        ctx.lineTo(width - padding, y50);
        ctx.stroke();
        ctx.setLineDash([]);

        // Cumulative win rate line (blue)
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        data.forEach((point, i) => {
            const x = padding + (width - 2 * padding) * i / (data.length - 1);
            const y = height - padding - point.cumulativeWinRate * (height - 2 * padding);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Rolling win rate line (green)
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        data.forEach((point, i) => {
            const x = padding + (width - 2 * padding) * i / (data.length - 1);
            const y = height - padding - point.rollingWinRate * (height - 2 * padding);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Labels
        ctx.fillStyle = '#52525b';
        ctx.font = '10px monospace';
        ctx.fillText('100%', 5, padding + 5);
        ctx.fillText('50%', 5, y50 + 4);
        ctx.fillText('0%', 5, height - padding + 12);

        // Legend
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(width - 100, 10, 10, 10);
        ctx.fillStyle = '#52525b';
        ctx.fillText('Cumulative', width - 85, 18);

        ctx.fillStyle = '#22c55e';
        ctx.fillRect(width - 100, 25, 10, 10);
        ctx.fillStyle = '#52525b';
        ctx.fillText('Rolling 20', width - 85, 33);

    }, [data]);

    return <canvas ref={canvasRef} width={600} height={200} className="w-full h-full" />;
};

// Regime Performance Bar Chart
const RegimePerformanceChart: React.FC<{ clusters: PatternVisualizationData['regimeClusters'] }> = ({ clusters }) => {
    if (clusters.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-terminal-muted text-xs font-mono">
                No regime data available
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {clusters.map((cluster, idx) => (
                <div key={idx} className="flex items-center gap-2">
                    <div className="w-20 text-xs font-mono text-terminal-muted truncate">
                        {cluster.regime}
                    </div>
                    <div className="flex-1 h-4 bg-terminal-bg rounded overflow-hidden">
                        <div
                            className="h-full rounded transition-all"
                            style={{
                                width: `${cluster.winRate * 100}%`,
                                backgroundColor: cluster.color
                            }}
                        />
                    </div>
                    <div className="w-24 text-xs font-mono text-right">
                        <span style={{ color: cluster.color }}>{(cluster.winRate * 100).toFixed(0)}%</span>
                        <span className="text-terminal-muted ml-1">({cluster.count})</span>
                    </div>
                </div>
            ))}
        </div>
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
    const { chartData, vix } = useChartWithVix();
    const safeChartData = chartData || [];
    const [volHistory, setVolHistory] = useState<number[]>([]);
    const [regimeHistory, setRegimeHistory] = useState<{ vol: number; trend: number; regime: string; color: string }[]>([]);
    const [currentRegime, setCurrentRegime] = useState({ regime: 'LOADING...', color: '#6b7280' });
    const [currentStats, setCurrentStats] = useState({ vol: 0, trend: 0 });

    // Backtest integration state
    const [patternVizData, setPatternVizData] = useState<PatternVisualizationData | null>(null);
    const [backtestSummary, setBacktestSummary] = useState<{
        totalTrades: number;
        winRate: number;
        profitFactor: number;
        expectancy: number;
    } | null>(null);

    // Subscribe to backtest results
    useEffect(() => {
        const unsubscribe = subscribeToBacktest((results: BacktestResults | null) => {
            if (results) {
                setBacktestSummary({
                    totalTrades: results.totalTrades,
                    winRate: results.winRate,
                    profitFactor: results.profitFactor,
                    expectancy: results.expectancy
                });
                setPatternVizData(buildPatternVisualizationData());
            } else {
                setBacktestSummary(null);
                setPatternVizData(null);
            }
        });

        return () => unsubscribe();
    }, []);

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
            <div className="col-span-6 bg-terminal-card border border-terminal-border rounded-lg p-4 h-[300px]">
                <h3 className="font-mono text-sm text-terminal-muted mb-2">REGIME CLASSIFICATION MAP</h3>
                <div className="w-full h-[calc(100%-2rem)]">
                    <RegimeScatter data={regimeHistory} />
                </div>
            </div>

            {/* Backtest Integration - Regime Performance */}
            <div className="col-span-6 bg-terminal-card border border-terminal-border rounded-lg p-4 h-[300px]">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-mono text-sm text-terminal-muted flex items-center gap-2">
                        <Target size={14} className="text-purple-400" />
                        REGIME PERFORMANCE (BACKTEST)
                    </h3>
                    {backtestSummary && (
                        <span className="text-xs font-mono px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded">
                            {backtestSummary.totalTrades} trades
                        </span>
                    )}
                </div>
                {patternVizData ? (
                    <RegimePerformanceChart clusters={patternVizData.regimeClusters} />
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-terminal-muted">
                        <BarChart3 size={32} className="mb-2 opacity-30" />
                        <span className="text-xs font-mono">Run backtest to see regime analysis</span>
                    </div>
                )}
            </div>

            {/* Pattern Learning Curve */}
            {patternVizData && patternVizData.learningCurve.length > 0 && (
                <div className="col-span-8 bg-terminal-card border border-terminal-border rounded-lg p-4 h-[280px]">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-mono text-sm text-terminal-muted">LEARNING CURVE (WIN RATE EVOLUTION)</h3>
                        {backtestSummary && (
                            <div className="flex gap-4 text-xs font-mono">
                                <span className="text-blue-400">Cumulative: {(backtestSummary.winRate * 100).toFixed(1)}%</span>
                                <span className="text-green-400">
                                    Rolling: {(patternVizData.learningCurve[patternVizData.learningCurve.length - 1].rollingWinRate * 100).toFixed(1)}%
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="flex-1 h-[calc(100%-2rem)]">
                        <LearningCurveChart data={patternVizData.learningCurve} />
                    </div>
                </div>
            )}

            {/* Best/Worst Patterns */}
            {patternVizData && (patternVizData.bestPatterns.length > 0 || patternVizData.worstPatterns.length > 0) && (
                <div className="col-span-4 bg-terminal-card border border-terminal-border rounded-lg p-4 h-[280px]">
                    <h3 className="font-mono text-sm text-terminal-muted mb-3">PATTERN PERFORMANCE</h3>
                    <div className="space-y-4 overflow-y-auto h-[calc(100%-2rem)]">
                        {patternVizData.bestPatterns.length > 0 && (
                            <div>
                                <div className="text-xs font-mono text-green-400 mb-2">BEST PATTERNS</div>
                                {patternVizData.bestPatterns.map((pattern, idx) => (
                                    <div key={idx} className="text-xs font-mono text-terminal-muted py-1 border-l-2 border-green-500/50 pl-2 mb-1">
                                        {pattern}
                                    </div>
                                ))}
                            </div>
                        )}
                        {patternVizData.worstPatterns.length > 0 && (
                            <div>
                                <div className="text-xs font-mono text-red-400 mb-2">AVOID PATTERNS</div>
                                {patternVizData.worstPatterns.map((pattern, idx) => (
                                    <div key={idx} className="text-xs font-mono text-terminal-muted py-1 border-l-2 border-red-500/50 pl-2 mb-1">
                                        {pattern}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Backtest Summary Stats */}
            {backtestSummary && (
                <div className="col-span-12 bg-purple-500/5 border border-purple-500/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Brain size={16} className="text-purple-400" />
                        <span className="text-sm font-mono font-bold text-purple-400">BACKTEST INTEGRATION ACTIVE</span>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                        <div className="text-center">
                            <div className="text-xs font-mono text-terminal-muted">WIN RATE</div>
                            <div className={`text-xl font-bold font-mono ${backtestSummary.winRate >= 0.5 ? 'text-green-400' : 'text-red-400'}`}>
                                {(backtestSummary.winRate * 100).toFixed(1)}%
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs font-mono text-terminal-muted">PROFIT FACTOR</div>
                            <div className={`text-xl font-bold font-mono ${backtestSummary.profitFactor >= 1.5 ? 'text-green-400' : backtestSummary.profitFactor >= 1 ? 'text-yellow-400' : 'text-red-400'}`}>
                                {backtestSummary.profitFactor.toFixed(2)}
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs font-mono text-terminal-muted">EXPECTANCY</div>
                            <div className={`text-xl font-bold font-mono ${backtestSummary.expectancy >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {backtestSummary.expectancy.toFixed(2)}R
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs font-mono text-terminal-muted">TOTAL TRADES</div>
                            <div className="text-xl font-bold font-mono text-blue-400">
                                {backtestSummary.totalTrades}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
