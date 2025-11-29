import React from 'react';

interface Adjustment {
  label: string;
  value: number;
  type: 'boost' | 'penalty';
}

interface ConfidenceBreakdownProps {
  baseScore: number;
  adjustments: Adjustment[];
  finalScore: number;
}

export const ConfidenceBreakdown: React.FC<ConfidenceBreakdownProps> = ({ 
  baseScore, 
  adjustments, 
  finalScore 
}) => {
  return (
    <div className="space-y-2 text-xs">
      <div className="flex justify-between items-center text-gray-400">
        <span>Base Score (Confluence)</span>
        <span className="font-mono">{baseScore}</span>
      </div>

      {adjustments.length > 0 && (
        <div className="space-y-1 py-2 border-y border-white/5">
          {adjustments.map((adj, i) => (
            <div key={i} className="flex justify-between items-center">
              <span className={adj.type === 'boost' ? 'text-green-400/80' : 'text-red-400/80'}>
                {adj.type === 'boost' ? '+' : '-'}{Math.abs(adj.value)} {adj.label}
              </span>
              <span className={`font-mono ${adj.type === 'boost' ? 'text-green-400' : 'text-red-400'}`}>
                {adj.type === 'boost' ? '+' : ''}{adj.value}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center font-bold pt-1">
        <span className="text-gray-200">Final Confidence</span>
        <span className={`font-mono ${
            finalScore >= 70 ? 'text-green-400' :
            finalScore >= 50 ? 'text-yellow-400' :
            'text-gray-400'
        }`}>
            {finalScore}%
        </span>
      </div>
    </div>
  );
};
