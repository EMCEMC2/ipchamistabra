import React, { useEffect, useState } from 'react';
import { Layers, ArrowDown, ArrowUp, Shield, Ban, Activity, MoveHorizontal } from 'lucide-react';

interface LiquidityWall {
  price: number;
  volume: number;
  strength: number; // 0-100 based on relative volume
}

export const OrderBook: React.FC = () => {
  const [buyWalls, setBuyWalls] = useState<LiquidityWall[]>([]);
  const [sellWalls, setSellWalls] = useState<LiquidityWall[]>([]);
  const [imbalance, setImbalance] = useState<number>(50); // 50 = Neutral, >50 Bullish, <50 Bearish
  const [totalBidVol, setTotalBidVol] = useState(0);
  const [totalAskVol, setTotalAskVol] = useState(0);
  const [spreadInfo, setSpreadInfo] = useState({ val: 0, pct: 0 });

  useEffect(() => {
    const fetchBook = async () => {
      try {
        // Fetch deeper depth (200) to find actual Whale walls
        const res = await fetch('https://api.bybit.com/v5/market/orderbook?category=linear&symbol=BTCUSDT&limit=200');
        const data = await res.json();
        
        if (data.retCode === 0) {
          const rawBids = data.result.b;
          const rawAsks = data.result.a;

          // Calculate Spread
          if (rawBids.length > 0 && rawAsks.length > 0) {
              const bestBid = parseFloat(rawBids[0][0]);
              const bestAsk = parseFloat(rawAsks[0][0]);
              const spread = bestAsk - bestBid;
              const spreadPct = (spread / bestBid) * 100;
              setSpreadInfo({ val: spread, pct: spreadPct });
          }

          // --- INTEL ALGORITHM: AGGREGATION & WALL DETECTION ---
          
          // 1. Bucket Size (Group orders by $25 chunks to find "Zones")
          const bucketSize = 25; 
          
          const processSide = (list: string[][]): { walls: LiquidityWall[], totalVol: number } => {
              const buckets = new Map<number, number>();
              let volSum = 0;

              list.forEach(item => {
                  const price = parseFloat(item[0]);
                  const size = parseFloat(item[1]);
                  volSum += size;

                  // Round price to nearest bucket
                  const key = Math.round(price / bucketSize) * bucketSize;
                  buckets.set(key, (buckets.get(key) || 0) + size);
              });

              // Convert map to array and sort by Volume (finding the "Walls")
              const sortedBuckets = Array.from(buckets.entries())
                  .map(([price, volume]) => ({ price, volume }))
                  .sort((a, b) => b.volume - a.volume); // Descending volume

              // Normalize strength relative to the biggest wall found in this snapshot
              const maxWall = sortedBuckets[0]?.volume || 1;
              
              const topWalls = sortedBuckets.slice(0, 5).map(w => ({
                  price: w.price,
                  volume: w.volume,
                  strength: (w.volume / maxWall) * 100
              }));

              return { walls: topWalls, totalVol: volSum };
          };

          const bidsData = processSide(rawBids);
          const asksData = processSide(rawAsks);

          setBuyWalls(bidsData.walls);
          setSellWalls(asksData.walls);
          setTotalBidVol(bidsData.totalVol);
          setTotalAskVol(asksData.totalVol);

          // Calculate Pressure/Imbalance
          const totalVol = bidsData.totalVol + asksData.totalVol;
          const ratio = totalVol > 0 ? (bidsData.totalVol / totalVol) * 100 : 50;
          setImbalance(ratio);
        }
      } catch (e) {
        // Silent fail
      }
    };

    fetchBook();
    const interval = setInterval(fetchBook, 2000); 
    return () => clearInterval(interval);
  }, []);

  const getImbalanceColor = () => {
      if (imbalance > 55) return 'text-emerald-500';
      if (imbalance < 45) return 'text-red-500';
      return 'text-terminal-muted';
  };

  const getImbalanceText = () => {
      if (imbalance > 60) return 'STRONG BUY PRESSURE';
      if (imbalance > 52) return 'MILD BUY SKEW';
      if (imbalance < 40) return 'STRONG SELL PRESSURE';
      if (imbalance < 48) return 'MILD SELL SKEW';
      return 'NEUTRAL FLOW';
  };

  return (
    <div className="h-full bg-terminal-card border border-terminal-border rounded-lg flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-terminal-border bg-terminal-bg/50 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2 text-terminal-text">
          <Layers size={14} className="text-terminal-accent" />
          <span className="font-mono font-bold text-xs tracking-wider">LIQUIDITY INTEL</span>
        </div>
        <div className="flex items-center gap-2">
             <div className="flex items-center gap-1 text-[9px] text-terminal-muted">
                <MoveHorizontal size={10} />
                <span className="font-mono">{spreadInfo.val.toFixed(1)}</span>
             </div>
             <div className="flex items-center gap-1 text-[9px] text-terminal-muted bg-terminal-bg px-1 rounded border border-terminal-border">
                <Activity size={10} />
                <span className="animate-pulse">LIVE</span>
             </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-4 overflow-y-auto">
          
          {/* 1. Order Flow Pressure Gauge */}
          <div className="mb-6">
              <div className="flex justify-between text-[10px] font-mono text-terminal-muted mb-2 uppercase">
                  <span>Bid Vol: {totalBidVol.toFixed(0)}</span>
                  <span>Ask Vol: {totalAskVol.toFixed(0)}</span>
              </div>
              
              <div className="h-2 bg-terminal-bg rounded-full overflow-hidden flex border border-terminal-border relative">
                   {/* Center marker */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-terminal-text/20 z-10" />
                  
                  <div 
                    className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-500"
                    style={{ width: `${imbalance}%` }}
                  />
                  <div 
                    className="h-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] transition-all duration-500"
                    style={{ width: `${100 - imbalance}%` }}
                  />
              </div>
              
              <div className={`text-center mt-2 text-xs font-mono font-bold tracking-wider ${getImbalanceColor()}`}>
                  {getImbalanceText()}
              </div>
          </div>

          {/* 2. Sell Walls (Resistance) */}
          <div className="flex-1 flex flex-col justify-end space-y-1 mb-2">
               <div className="text-[10px] text-terminal-muted font-mono uppercase mb-1 flex items-center gap-1">
                   <Ban size={10} className="text-red-500"/> Supply Walls (Ask)
               </div>
               {sellWalls.slice().reverse().map((wall, i) => (
                   <div key={i} className="relative flex items-center justify-between text-xs font-mono p-1.5 rounded border border-transparent hover:border-red-500/30 hover:bg-red-500/5 transition-all group">
                       {/* Background Volume Bar */}
                       <div 
                           className="absolute right-0 top-0 bottom-0 bg-red-500/10 rounded-l" 
                           style={{ width: `${wall.strength}%` }}
                       />
                       <span className="relative z-10 text-red-400 font-bold">${wall.price.toLocaleString()}</span>
                       <span className="relative z-10 text-terminal-muted group-hover:text-terminal-text transition-colors">{wall.volume.toFixed(2)} BTC</span>
                   </div>
               ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-terminal-border w-full my-2 opacity-50"></div>

          {/* 3. Buy Walls (Support) */}
          <div className="flex-1 space-y-1">
               <div className="text-[10px] text-terminal-muted font-mono uppercase mb-1 flex items-center gap-1">
                   <Shield size={10} className="text-emerald-500"/> Demand Walls (Bid)
               </div>
               {buyWalls.map((wall, i) => (
                   <div key={i} className="relative flex items-center justify-between text-xs font-mono p-1.5 rounded border border-transparent hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all group">
                       {/* Background Volume Bar */}
                       <div 
                           className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 rounded-l" 
                           style={{ width: `${wall.strength}%` }}
                       />
                       <span className="relative z-10 text-emerald-400 font-bold">${wall.price.toLocaleString()}</span>
                       <span className="relative z-10 text-terminal-muted group-hover:text-terminal-text transition-colors">{wall.volume.toFixed(2)} BTC</span>
                   </div>
               ))}
          </div>

      </div>
    </div>
  );
};