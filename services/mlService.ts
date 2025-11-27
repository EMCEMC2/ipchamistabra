
import { ChartDataPoint } from '../types';
import { LinearRegression, KMeans } from '../utils/ml';

export interface MarketRegimeAnalysis {
    regime: string;
    regimeColor: string;
    volatility: number;
    trendStrength: number;
    predictedTrend: number;
    confidence: number;
    clusterIdx: number;
}

// Calculate real volatility from chart data
export const calculateVolatility = (data: ChartDataPoint[], window = 20): number => {
    if (data.length < window) return 0;
    const recent = data.slice(-window);
    const returns = recent.map((d, i) => {
        if (i === 0) return 0;
        return (d.close - recent[i - 1].close) / recent[i - 1].close;
    });
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    return Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized vol %
};

// Calculate trend strength from chart data
export const calculateTrendStrength = (data: ChartDataPoint[], window = 20): number => {
    if (data.length < window) return 0;
    const recent = data.slice(-window);
    const prices = recent.map(d => d.close);
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;
    return priceChange;
};

// Main analysis function
export const analyzeMarketRegime = (
    chartData: ChartDataPoint[],
    macroVix?: number
): MarketRegimeAnalysis => {
    if (!chartData || chartData.length < 50) {
        return {
            regime: 'INSUFFICIENT DATA',
            regimeColor: '#6b7280',
            volatility: 0,
            trendStrength: 0,
            predictedTrend: 0,
            confidence: 0,
            clusterIdx: -1
        };
    }

    // Prepare data for ML
    const closes = chartData.map(d => d.close);
    const indices = chartData.map((_, i) => i);

    // 1. Linear Regression for Trend Prediction
    const lr = new LinearRegression();
    lr.fit(indices.slice(-50), closes.slice(-50));
    const predictedNextClose = lr.predict(indices.length);
    const currentClose = closes[closes.length - 1];
    const predictedTrend = ((predictedNextClose - currentClose) / currentClose) * 100;

    // 2. Volatility Calculation
    const vol = calculateVolatility(chartData, 20);
    const effectiveVol = macroVix ? Math.max(vol, macroVix) : vol;
    const trendStrength = calculateTrendStrength(chartData, 20);

    // 3. K-Means for Regime Clustering (Training on historical Vol/Trend pairs)
    // We construct a dataset of (Vol, Trend) pairs from history
    const trainingData: number[][] = [];
    for (let i = 20; i < chartData.length; i += 5) {
        const slice = chartData.slice(i - 20, i);
        const v = calculateVolatility(slice, 20);
        const t = calculateTrendStrength(slice, 20);
        trainingData.push([v, t]);
    }

    const kmeans = new KMeans(3); // 3 Clusters: Low, Med, High Vol/Activity
    kmeans.fit(trainingData);
    const clusterIdx = kmeans.predict([effectiveVol, predictedTrend]);

    // Map Cluster to Regime Label (Heuristic mapping based on centroid characteristics)
    const centroid = kmeans.centroids[clusterIdx];
    let regimeLabel = 'NEUTRAL';
    let regimeColor = '#6b7280';

    // Logic: Analyze centroid to name the regime
    // Centroid[0] is Vol, Centroid[1] is Trend
    if (centroid[0] > 25) { // High Vol
        if (centroid[1] > 1) { regimeLabel = 'HIGH VOL BULL'; regimeColor = '#22c55e'; }
        else if (centroid[1] < -1) { regimeLabel = 'HIGH VOL BEAR'; regimeColor = '#dc2626'; }
        else { regimeLabel = 'HIGH VOL CHOP'; regimeColor = '#f59e0b'; }
    } else { // Low Vol
        if (centroid[1] > 1) { regimeLabel = 'STEADY UPTREND'; regimeColor = '#10b981'; }
        else if (centroid[1] < -1) { regimeLabel = 'STEADY DOWNTREND'; regimeColor = '#ef4444'; }
        else { regimeLabel = 'RANGING'; regimeColor = '#3b82f6'; }
    }

    return {
        regime: regimeLabel,
        regimeColor,
        volatility: effectiveVol,
        trendStrength,
        predictedTrend,
        confidence: 0.85, // Placeholder for now
        clusterIdx
    };
};
