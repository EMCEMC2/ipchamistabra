/**
 * SYNC STATUS INDICATOR
 * Displays real-time data synchronization health and alerts
 */

import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { dataSyncAgent, DataSourceId, SyncStatus, SyncAlert } from '../services/dataSyncAgent';

interface SyncStatusIndicatorProps {
  compact?: boolean;
  showAlerts?: boolean;
}

const STATUS_COLORS: Record<SyncStatus, string> = {
  connected: 'text-green-400',
  syncing: 'text-blue-400',
  stale: 'text-yellow-400',
  disconnected: 'text-gray-500',
  error: 'text-red-400'
};

const STATUS_BG: Record<SyncStatus, string> = {
  connected: 'bg-green-500/10',
  syncing: 'bg-blue-500/10',
  stale: 'bg-yellow-500/10',
  disconnected: 'bg-gray-500/10',
  error: 'bg-red-500/10'
};

const SOURCE_LABELS: Record<DataSourceId, string> = {
  BINANCE_PRICE: 'Price',
  BINANCE_CHART: 'Chart',
  MACRO_DATA: 'Macro',
  ORDER_FLOW: 'Flow',
  POSITIONS: 'Pos',
  SIGNALS: 'Sig'
};

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  compact = false,
  showAlerts = true
}) => {
  const [status, setStatus] = useState(dataSyncAgent.getStatus());
  const [alerts, setAlerts] = useState<SyncAlert[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const unsubscribe = dataSyncAgent.subscribe((event) => {
      setStatus(dataSyncAgent.getStatus());
      if (event.type === 'ALERT_CREATED' || event.type === 'ALERT_RESOLVED') {
        setAlerts(dataSyncAgent.getAlerts());
      }
    });

    // Initial state
    setAlerts(dataSyncAgent.getAlerts());

    return unsubscribe;
  }, []);

  const getHealthColor = (score: number): string => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getHealthBg = (score: number): string => {
    if (score >= 80) return 'bg-green-500/20';
    if (score >= 60) return 'bg-yellow-500/20';
    if (score >= 40) return 'bg-orange-500/20';
    return 'bg-red-500/20';
  };

  // Compact view - just the health indicator
  if (compact) {
    return (
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded ${getHealthBg(status.healthScore)} transition-colors hover:opacity-80`}
        title={`System Health: ${status.healthScore}%`}
      >
        <Activity size={12} className={getHealthColor(status.healthScore)} />
        <span className={`text-[10px] font-mono font-bold ${getHealthColor(status.healthScore)}`}>
          {status.healthScore}%
        </span>
        {status.activeAlerts > 0 && (
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-red-500/30 text-[9px] text-red-400 font-bold">
            {status.activeAlerts}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="bg-terminal-card border border-terminal-border rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className={`flex items-center justify-between px-3 py-2 cursor-pointer ${getHealthBg(status.healthScore)}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Activity size={14} className={getHealthColor(status.healthScore)} />
          <span className="text-[11px] font-bold text-gray-300">DATA SYNC</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[12px] font-mono font-bold ${getHealthColor(status.healthScore)}`}>
            {status.healthScore}%
          </span>
          {status.activeAlerts > 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/20 text-[9px] text-red-400 font-bold">
              <AlertTriangle size={10} />
              {status.activeAlerts}
            </span>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-terminal-border">
          {/* Data Sources Grid */}
          <div className="grid grid-cols-3 gap-1 p-2">
            {Object.entries(status.sources).map(([id, source]) => (
              <div
                key={id}
                className={`flex items-center gap-1.5 px-2 py-1 rounded ${STATUS_BG[source.status]}`}
                title={`Last update: ${new Date(source.lastUpdate).toLocaleTimeString()}`}
              >
                {source.status === 'connected' && <CheckCircle size={10} className={STATUS_COLORS[source.status]} />}
                {source.status === 'syncing' && <RefreshCw size={10} className={`${STATUS_COLORS[source.status]} animate-spin`} />}
                {source.status === 'stale' && <AlertTriangle size={10} className={STATUS_COLORS[source.status]} />}
                {source.status === 'disconnected' && <XCircle size={10} className={STATUS_COLORS[source.status]} />}
                {source.status === 'error' && <XCircle size={10} className={STATUS_COLORS[source.status]} />}
                <span className={`text-[9px] font-mono ${STATUS_COLORS[source.status]}`}>
                  {SOURCE_LABELS[id as DataSourceId]}
                </span>
              </div>
            ))}
          </div>

          {/* Alerts */}
          {showAlerts && alerts.length > 0 && (
            <div className="border-t border-terminal-border p-2 space-y-1">
              <div className="text-[9px] text-gray-500 font-mono uppercase mb-1">Active Alerts</div>
              {alerts.slice(0, 3).map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-2 px-2 py-1.5 rounded text-[10px] ${
                    alert.severity === 'critical' ? 'bg-red-500/10 text-red-400' :
                    alert.severity === 'high' ? 'bg-orange-500/10 text-orange-400' :
                    alert.severity === 'medium' ? 'bg-yellow-500/10 text-yellow-400' :
                    'bg-blue-500/10 text-blue-400'
                  }`}
                >
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono truncate">{alert.message}</div>
                    <div className="text-[8px] opacity-70 mt-0.5">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dataSyncAgent.acknowledgeAlert(alert.id);
                      setAlerts(dataSyncAgent.getAlerts());
                    }}
                    className="text-[8px] opacity-50 hover:opacity-100 transition-opacity"
                  >
                    Dismiss
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Status Info */}
          <div className="border-t border-terminal-border px-3 py-2 flex justify-between text-[9px] text-gray-500 font-mono">
            <span>Agent: {status.isRunning ? 'Running' : 'Stopped'}</span>
            {status.startTime && (
              <span>Uptime: {Math.round((Date.now() - status.startTime) / 60000)}m</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncStatusIndicator;
