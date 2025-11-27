/**
 * DATA SYNC STATUS COMPONENT
 * Real-time monitoring of data synchronization health
 */

import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { dataSyncAgent, useDataSyncStatus, DataSourceId, SyncStatus } from '../services/dataSyncAgent';

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

const StatusIcon: React.FC<{ status: SyncStatus; size?: number }> = ({ status, size = 12 }) => {
  switch (status) {
    case 'connected':
      return <CheckCircle size={size} className="text-green-400" />;
    case 'syncing':
      return <RefreshCw size={size} className="text-blue-400 animate-spin" />;
    case 'stale':
      return <AlertTriangle size={size} className="text-yellow-400" />;
    case 'error':
      return <XCircle size={size} className="text-red-400" />;
    default:
      return <Activity size={size} className="text-gray-500" />;
  }
};

const formatAge = (timestamp: number): string => {
  if (!timestamp) return 'Never';
  const age = Date.now() - timestamp;
  if (age < 1000) return 'Just now';
  if (age < 60000) return `${Math.floor(age / 1000)}s ago`;
  if (age < 3600000) return `${Math.floor(age / 60000)}m ago`;
  return `${Math.floor(age / 3600000)}h ago`;
};

interface DataSyncStatusProps {
  compact?: boolean;
  showAlerts?: boolean;
}

export const DataSyncStatus: React.FC<DataSyncStatusProps> = ({
  compact = false,
  showAlerts = true
}) => {
  const status = useDataSyncStatus();
  const [expanded, setExpanded] = useState(false);
  const alerts = dataSyncAgent.getAlerts();

  // Health score color
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

  if (compact) {
    return (
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 px-2 py-1 rounded text-[10px] font-mono transition-colors ${getHealthBg(status.healthScore)}`}
        title={`System Health: ${status.healthScore}%`}
      >
        <Activity size={12} className={getHealthColor(status.healthScore)} />
        <span className={getHealthColor(status.healthScore)}>{status.healthScore}%</span>
        {alerts.length > 0 && (
          <span className="bg-red-500 text-white text-[8px] px-1 rounded-full">
            {alerts.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="bg-terminal-card border border-terminal-border rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity size={14} className={getHealthColor(status.healthScore)} />
          <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wide">
            Data Sync Status
          </span>
        </div>
        <div className={`px-2 py-0.5 rounded text-[10px] font-mono ${getHealthBg(status.healthScore)}`}>
          <span className={getHealthColor(status.healthScore)}>{status.healthScore}%</span>
        </div>
      </div>

      {/* Data Sources Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {Object.entries(status.sources).map(([id, source]) => (
          <div
            key={id}
            className={`flex items-center justify-between px-2 py-1.5 rounded ${STATUS_BG[source.status]}`}
          >
            <div className="flex items-center gap-1.5">
              <StatusIcon status={source.status} size={10} />
              <span className="text-[9px] font-mono text-gray-400">{id.replace('_', ' ')}</span>
            </div>
            <span className="text-[8px] font-mono text-gray-500">
              {formatAge(source.lastUpdate)}
            </span>
          </div>
        ))}
      </div>

      {/* Active Alerts */}
      {showAlerts && alerts.length > 0 && (
        <div className="border-t border-terminal-border pt-2">
          <div className="text-[9px] font-mono text-gray-500 mb-1.5 uppercase">
            Active Alerts ({alerts.length})
          </div>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {alerts.slice(0, 5).map(alert => (
              <div
                key={alert.id}
                className={`flex items-start gap-1.5 px-2 py-1 rounded text-[9px] ${
                  alert.severity === 'critical' ? 'bg-red-500/10 text-red-400' :
                  alert.severity === 'high' ? 'bg-orange-500/10 text-orange-400' :
                  'bg-yellow-500/10 text-yellow-400'
                }`}
              >
                <AlertTriangle size={10} className="shrink-0 mt-0.5" />
                <span className="font-mono">{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent Status */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-terminal-border">
        <span className="text-[8px] font-mono text-gray-500">
          Agent: {status.isRunning ? 'Running' : 'Stopped'}
        </span>
        {status.startTime && (
          <span className="text-[8px] font-mono text-gray-500">
            Uptime: {formatAge(status.startTime).replace(' ago', '')}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Minimal inline status indicator for headers/toolbars
 */
export const DataSyncIndicator: React.FC = () => {
  const status = useDataSyncStatus();
  const alerts = dataSyncAgent.getAlerts();

  const getIndicatorColor = (): string => {
    if (status.healthScore >= 80) return 'bg-green-500';
    if (status.healthScore >= 60) return 'bg-yellow-500';
    if (status.healthScore >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-1.5" title={`System Health: ${status.healthScore}%`}>
      <div className={`w-2 h-2 rounded-full ${getIndicatorColor()} ${status.healthScore < 80 ? 'animate-pulse' : ''}`} />
      {alerts.length > 0 && (
        <span className="text-[8px] font-mono text-red-400">
          {alerts.length}
        </span>
      )}
    </div>
  );
};

export default DataSyncStatus;
