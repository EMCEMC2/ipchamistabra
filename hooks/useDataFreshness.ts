import { useState, useEffect } from 'react';

/**
 * Hook to monitor data freshness and return staleness status
 * @param lastUpdateTimestamp - Timestamp of last data update (ms)
 * @param thresholdSeconds - Seconds before data is considered stale (default: 5)
 * @returns 'fresh' | 'stale' | 'critical' status
 */
export function useDataFreshness(lastUpdateTimestamp: number, thresholdSeconds: number = 5): 'fresh' | 'stale' | 'critical' {
  const [status, setStatus] = useState<'fresh' | 'stale' | 'critical'>('fresh');

  useEffect(() => {
    const checkFreshness = () => {
      if (lastUpdateTimestamp === 0) {
        // No data yet
        setStatus('critical');
        return;
      }

      const now = Date.now();
      const ageSeconds = (now - lastUpdateTimestamp) / 1000;

      if (ageSeconds > thresholdSeconds * 3) {
        // 3x threshold = critical (red)
        setStatus('critical');
      } else if (ageSeconds > thresholdSeconds) {
        // Over threshold = stale (yellow)
        setStatus('stale');
      } else {
        // Within threshold = fresh (green)
        setStatus('fresh');
      }
    };

    // Check immediately
    checkFreshness();

    // Check every second
    const interval = setInterval(checkFreshness, 1000);

    return () => clearInterval(interval);
  }, [lastUpdateTimestamp, thresholdSeconds]);

  return status;
}

/**
 * Get color class for freshness status
 */
export function getFreshnessColor(status: 'fresh' | 'stale' | 'critical'): string {
  switch (status) {
    case 'fresh':
      return 'text-green-400';
    case 'stale':
      return 'text-yellow-400';
    case 'critical':
      return 'text-red-400';
  }
}

/**
 * Get background color class for freshness dot indicator
 */
export function getFreshnessDotColor(status: 'fresh' | 'stale' | 'critical'): string {
  switch (status) {
    case 'fresh':
      return 'bg-green-400';
    case 'stale':
      return 'bg-yellow-400';
    case 'critical':
      return 'bg-red-400';
  }
}
