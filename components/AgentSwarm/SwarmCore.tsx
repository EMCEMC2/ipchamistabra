import React, { useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { AgentCard } from './AgentCard';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Terminal, Cpu, Activity } from 'lucide-react';
import { runAgentSimulation } from '../../services/gemini';
import { analyzeMarketRegime } from '../../services/mlService';
import { AgentRole } from '../../types';
import clsx from 'clsx';
import { generateConsensus } from '../../services/agentConsensus';
import { TacticalSignalResult } from '../../services/tacticalSignals';
import { runAgentWithTimeout } from '../../utils/agentTimeout';
import { ConfluenceWeightsPanel } from './ConfluenceWeightsPanel';

export const AgentSwarm: React.FC = () => {
    const agents = useStore((state) => state.agents) || [];
    const isScanning = useStore((state) => state.isScanning);
    const councilLogs = useStore((state) => state.councilLogs) || [];
    const updateAgentStatus = useStore((state) => state.updateAgentStatus);
    const addCouncilLog = useStore((state) => state.addCouncilLog);
    const setIsScanning = useStore((state) => state.setIsScanning);

    // Select individual metrics to avoid creating a new object in the selector
    const price = useStore((state) => state.price);
    const vix = useStore((state) => state.vix);
    const sentimentScore = useStore((state) => state.sentimentScore);
    const chartData = useStore((state) => state.chartData);
    const technicals = useStore((state) => state.technicals);

    const marketMetrics = {
        price,
        vix,
        sentiment: sentimentScore
    };

    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        console.log("SwarmCore Mounted. Agents:", agents);
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [councilLogs, agents]);

    // Generate Live Consensus
    const liveConsensus = React.useMemo(() => {
        // Construct a partial result based on current technicals to get a "Live" reading
        // even if no specific trade signal is active.
        const bullScore = technicals.trend === 'BULLISH' ? 7 : (technicals.rsi < 30 ? 6 : 3);
        const bearScore = technicals.trend === 'BEARISH' ? 7 : (technicals.rsi > 70 ? 6 : 3);
        
        const liveResult: TacticalSignalResult = {
            signal: null,
            bullScore,
            bearScore,
            regime: technicals.atr > price * 0.02 ? 'HIGH_VOL' : 'NORMAL', // Approx regime check
            reasoning: [],
            lastSignalBar: 0
        };
        return generateConsensus(liveResult, useStore.getState());
    }, [technicals, price, sentimentScore]); // Re-calc on key changes

    // Calculate Net Sentiment (guard against division by zero)
    // Count votes by type - only BULLISH/BEARISH contribute to sentiment calculation
    const bullVotes = liveConsensus.votes.filter(v => v.vote === 'BULLISH').length;
    const bearVotes = liveConsensus.votes.filter(v => v.vote === 'BEARISH').length;

    // Use only directional votes (exclude NEUTRAL) for sentiment calculation
    const directionalVotes = bullVotes + bearVotes;
    const sentimentPercent = directionalVotes > 0
        ? ((bullVotes - bearVotes + directionalVotes) / (2 * directionalVotes)) * 100
        : 50; // Default to neutral (50%) when no directional votes

    const startSwarm = async () => {
        setIsScanning(true);
        addCouncilLog('OVERMIND', 'Initializing Swarm Protocol v2.1...');

        // Helper to run agent with timeout and status tracking
        const runAgent = async (
            role: AgentRole,
            context: any,
            logName: string,
            workingMsg: string
        ) => {
            updateAgentStatus(role, 'WORKING', workingMsg);
            const result = await runAgentWithTimeout(role, () => runAgentSimulation(role, context));

            if (result.data?.timeout) {
                updateAgentStatus(role, 'TIMEOUT', result.message);
                addCouncilLog(logName, `TIMEOUT: ${role} exceeded SLA`);
            } else {
                updateAgentStatus(role, result.success ? 'SUCCESS' : 'FAILURE', result.message);
                addCouncilLog(logName, result.message);
            }

            return result;
        };

        try {
            // 1. Inspector Check
            const inspectRes = await runAgent('INSPECTOR', marketMetrics, 'WATCHDOG', 'Verifying data integrity...');

            if (!inspectRes.success) {
                setIsScanning(false);
                return;
            }

            // 2. Quant Research - Run ML Analysis
            const mlAnalysis = analyzeMarketRegime(chartData, vix);
            const quantContext = {
                ...marketMetrics,
                mlAnalysis: {
                    regime: mlAnalysis.regime,
                    volatility: mlAnalysis.volatility.toFixed(2),
                    trend: mlAnalysis.predictedTrend.toFixed(2)
                }
            };

            const quantRes = await runAgent('QUANT_RESEARCHER', quantContext, 'DATAMIND', 'Analyzing market regime features...');

            // 3. Risk Assessment
            const balance = useStore.getState().balance;
            const positions = useStore.getState().positions;
            const riskRes = await runAgent('RISK_OFFICER', { balance, positions }, 'IRONCLAD', 'Calculating exposure limits...');

            // 4. Strategy Formulation
            const strategistContext = {
                marketMetrics,
                mlAnalysis: {
                    regime: mlAnalysis.regime,
                    volatility: mlAnalysis.volatility,
                    trend: mlAnalysis.predictedTrend
                },
                quantInsight: quantRes.message,
                riskAssessment: riskRes.message,
                inspectorStatus: inspectRes.message
            };

            const stratRes = await runAgent('STRATEGIST', strategistContext, 'VANGUARD', 'Synthesizing alpha signals...');

            addCouncilLog('OVERMIND', 'Swarm Cycle Complete. Waiting for next tick.');
        } catch (error: any) {
            console.error("Swarm Execution Error:", error);
            addCouncilLog('OVERMIND', `CRITICAL FAILURE: ${error.message || 'Unknown Error'}`);
            updateAgentStatus('ORCHESTRATOR', 'FAILURE', 'System Halt');
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <div className="h-full flex flex-col gap-6 p-6 bg-terminal-bg/50 relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-terminal-accent/5 via-transparent to-transparent opacity-50" />

            {/* Header / Control Deck */}
            <div className="flex items-center justify-between shrink-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-terminal-accent/10 rounded-lg border border-terminal-accent/20">
                        <Cpu className="text-terminal-accent" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-mono font-bold text-terminal-text tracking-tight">SWARM COUNCIL</h1>
                        <div className="flex items-center gap-2 text-xs font-mono text-terminal-muted uppercase">
                            <span className="w-2 h-2 rounded-full bg-terminal-success animate-pulse"></span>
                            Neural Link Active
                        </div>
                    </div>
                </div>

                {/* LIVE CONSENSUS WIDGET */}
                <div className="hidden md:flex items-center gap-4 bg-black/30 px-4 py-2 rounded-lg border border-white/5">
                    <div className="flex flex-col items-end">
                        <span className="text-xs text-terminal-muted uppercase tracking-wider">Live Consensus</span>
                        <div className="flex items-center gap-2">
                            <span className={`font-bold font-mono ${sentimentPercent > 60 ? 'text-terminal-success' : sentimentPercent < 40 ? 'text-terminal-danger' : 'text-terminal-muted'}`}>
                                {sentimentPercent > 60 ? 'BULLISH' : sentimentPercent < 40 ? 'BEARISH' : 'NEUTRAL'}
                            </span>
                            <div className="flex gap-0.5">
                                {liveConsensus.votes.map((v, i) => (
                                    <div key={i} className={`w-1.5 h-4 rounded-sm ${
                                        v.vote === 'BULLISH' ? 'bg-terminal-success' :
                                        v.vote === 'BEARISH' ? 'bg-terminal-danger' : 'bg-terminal-border'
                                    }`} title={`${v.agentName}: ${v.vote}`} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* CONFLUENCE WEIGHTS CONFIG */}
                <div className="hidden lg:block w-56">
                    <ConfluenceWeightsPanel />
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                        <div className="text-xs text-terminal-muted uppercase tracking-widest">Active Agents</div>
                        <div className="font-mono font-bold text-terminal-text text-lg">{agents.filter(a => a.status !== 'IDLE').length} / {agents.length}</div>
                    </div>
                    <button
                        onClick={startSwarm}
                        disabled={isScanning}
                        className="flex items-center gap-2 px-6 py-3 bg-terminal-accent text-terminal-bg font-bold font-mono rounded hover:bg-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)]"
                    >
                        {isScanning ? <Activity className="animate-spin" size={18} /> : <Play size={18} fill="currentColor" />}
                        {isScanning ? 'PROCESSING...' : 'INITIATE SWARM'}
                    </button>
                </div>
            </div>

            {/* Main Grid */}
            <div className="flex-1 grid grid-cols-12 gap-6 min-h-0 z-10">

                {/* Left: Agent Grid */}
                <div className="col-span-8 grid grid-cols-2 gap-4 overflow-y-auto pr-2 content-start">
                    <AnimatePresence>
                        {agents.map((agent) => (
                            <AgentCard
                                key={agent.role}
                                agent={agent}
                                isActive={agent.status === 'WORKING'}
                            />
                        ))}
                    </AnimatePresence>
                </div>

                {/* Right: Council Log (Terminal) */}
                <div className="col-span-4 bg-terminal-card border border-terminal-border rounded-xl flex flex-col overflow-hidden shadow-2xl">
                    <div className="p-3 border-b border-terminal-border bg-terminal-bg/50 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-terminal-muted text-xs font-mono uppercase tracking-wider">
                            <Terminal size={14} />
                            System Logs
                        </div>
                        <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/50"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/50"></div>
                        </div>
                    </div>

                    <div className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-3 bg-black/40">
                        {councilLogs.length === 0 && (
                            <div className="text-terminal-muted/30 text-center mt-10 italic">Waiting for transmission...</div>
                        )}
                        {councilLogs.map((log) => (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                key={log.id}
                                className="flex gap-3"
                            >
                                <span className="text-terminal-muted/50 shrink-0">
                                    [{new Date(log.timestamp).toLocaleTimeString('en-IL', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jerusalem' })}]
                                </span>
                                <div>
                                    <span className={clsx(
                                        "font-bold mr-2",
                                        log.agentName === 'OVERMIND' ? "text-terminal-accent" :
                                            log.agentName === 'WATCHDOG' ? "text-blue-400" :
                                                log.agentName === 'IRONCLAD' ? "text-red-400" :
                                                    "text-amber-400"
                                    )}>
                                        {log.agentName}:
                                    </span>
                                    <span className="text-terminal-text/90">{log.message}</span>
                                </div>
                            </motion.div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>
                </div>

            </div>
        </div>
    );
};
