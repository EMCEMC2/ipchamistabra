/**
 * Simple Linear Regression for Trend Prediction
 */
export class LinearRegression {
    slope: number = 0;
    intercept: number = 0;

    fit(x: number[], y: number[]) {
        const n = x.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

        for (let i = 0; i < n; i++) {
            sumX += x[i];
            sumY += y[i];
            sumXY += x[i] * y[i];
            sumXX += x[i] * x[i];
        }

        this.slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        this.intercept = (sumY - this.slope * sumX) / n;
    }

    predict(x: number): number {
        return this.slope * x + this.intercept;
    }
}

/**
 * K-Means Clustering for Market Regime Detection
 */
export class KMeans {
    centroids: number[][] = [];
    k: number;

    constructor(k: number = 3) {
        this.k = k;
    }

    // Simple 2D K-Means (Volatility, Trend)
    fit(data: number[][], maxIterations: number = 100) {
        if (data.length < this.k) return;

        // Initialize centroids randomly
        this.centroids = data.slice(0, this.k);

        for (let i = 0; i < maxIterations; i++) {
            const clusters: number[][][] = Array.from({ length: this.k }, () => []);

            // Assign points to nearest centroid
            data.forEach(point => {
                let minDist = Infinity;
                let clusterIdx = 0;
                this.centroids.forEach((centroid, idx) => {
                    const dist = Math.hypot(point[0] - centroid[0], point[1] - centroid[1]);
                    if (dist < minDist) {
                        minDist = dist;
                        clusterIdx = idx;
                    }
                });
                clusters[clusterIdx].push(point);
            });

            // Update centroids
            const newCentroids = clusters.map(cluster => {
                if (cluster.length === 0) return [0, 0];
                const sumX = cluster.reduce((a, b) => a + b[0], 0);
                const sumY = cluster.reduce((a, b) => a + b[1], 0);
                return [sumX / cluster.length, sumY / cluster.length];
            });

            // Check convergence (simplified)
            if (JSON.stringify(newCentroids) === JSON.stringify(this.centroids)) break;
            this.centroids = newCentroids;
        }
    }

    predict(point: number[]): number {
        let minDist = Infinity;
        let clusterIdx = 0;
        this.centroids.forEach((centroid, idx) => {
            const dist = Math.hypot(point[0] - centroid[0], point[1] - centroid[1]);
            if (dist < minDist) {
                minDist = dist;
                clusterIdx = idx;
            }
        });
        return clusterIdx;
    }
}
