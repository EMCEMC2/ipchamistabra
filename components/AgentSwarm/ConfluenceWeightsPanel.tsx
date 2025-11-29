import React, { useState } from 'react';
import { Settings2, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '../../store/useStore';
import {
  ConfluenceWeights,
  DEFAULT_CONFLUENCE_WEIGHTS
} from '../../services/agentConsensus';

interface WeightSliderProps {
  label: string;
  agentName: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
}

const WeightSlider: React.FC<WeightSliderProps> = ({ label, agentName, value, max, onChange }) => {
  const percentage = Math.round((value / max) * 100);

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-terminal-muted truncate" title={label}>{agentName}</span>
      <div className="flex-1 relative h-1.5 bg-terminal-border rounded overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-terminal-accent/60 rounded transition-all"
          style={{ width: `${percentage}%` }}
        />
        <input
          type="range"
          min={0}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
      </div>
      <span className="w-6 text-right text-terminal-accent tabular-nums">{value}</span>
    </div>
  );
};

export const ConfluenceWeightsPanel: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const weights = useStore((state) => state.confluenceWeights);
  const setConfluenceWeights = useStore((state) => state.setConfluenceWeights);

  const handleReset = () => {
    setConfluenceWeights({ ...DEFAULT_CONFLUENCE_WEIGHTS });
  };

  const updateWeight = (key: keyof ConfluenceWeights, value: number) => {
    setConfluenceWeights({ [key]: value });
  };

  const maxWeights: Record<keyof ConfluenceWeights, number> = {
    technical: 15,
    volatility: 10,
    sentiment: 10,
    orderFlow: 10,
    macro: 10
  };

  const agentLabels: Record<keyof ConfluenceWeights, { name: string; description: string }> = {
    technical: { name: 'VANGUARD', description: 'Technical Analysis' },
    volatility: { name: 'DATAMIND', description: 'Volatility Regime' },
    sentiment: { name: 'OVERMIND', description: 'Market Sentiment' },
    orderFlow: { name: 'WATCHDOG', description: 'Order Flow' },
    macro: { name: 'MACRO', description: 'VIX/DXY/BTC.D' }
  };

  return (
    <div className="bg-black/30 rounded-lg border border-white/5 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2 text-xs text-terminal-muted uppercase tracking-wider">
          <Settings2 size={12} />
          Confluence Weights
        </div>
        {isExpanded ? <ChevronUp size={12} className="text-gray-500" /> : <ChevronDown size={12} className="text-gray-500" />}
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-2">
          {(Object.keys(weights) as (keyof ConfluenceWeights)[]).map((key) => (
            <WeightSlider
              key={key}
              label={agentLabels[key].description}
              agentName={agentLabels[key].name}
              value={weights[key]}
              max={maxWeights[key]}
              onChange={(val) => updateWeight(key, val)}
            />
          ))}

          <div className="flex justify-between items-center pt-2 border-t border-white/5">
            <span className="text-xs text-terminal-muted">
              Total max: {Object.values(weights).reduce((a, b) => a + b, 0)} pts
            </span>
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-xs text-terminal-muted hover:text-terminal-accent transition-colors"
            >
              <RotateCcw size={10} />
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
