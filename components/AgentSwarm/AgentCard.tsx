import React from 'react';
import { motion } from 'framer-motion';
import { AgentState } from '../../types';
import { Brain, Shield, Activity, Search, Zap, Terminal } from 'lucide-react';
import clsx from 'clsx';

interface AgentCardProps {
    agent: AgentState;
    isActive: boolean;
}

const roleIcons = {
    'ORCHESTRATOR': Brain,
    'INSPECTOR': Search,
    'STRATEGIST': Zap,
    'QUANT_RESEARCHER': Activity,
    'MODEL_OPTIMIZER': Terminal,
    'RISK_OFFICER': Shield,
    'ENGINEER': Terminal
};

export const AgentCard: React.FC<AgentCardProps> = ({ agent, isActive }) => {
    const Icon = roleIcons[agent.role] || Brain;

    return (
        <motion.div
            layout
            className={clsx(
                "relative p-4 rounded-xl border backdrop-blur-md transition-all duration-500 overflow-hidden group",
                isActive
                    ? "bg-terminal-accent/10 border-terminal-accent shadow-[0_0_30px_rgba(16,185,129,0.2)]"
                    : "bg-terminal-card/50 border-terminal-border hover:border-terminal-muted/50"
            )}
        >
            {/* Holographic Scanline Effect */}
            {isActive && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-terminal-accent/5 to-transparent animate-scanline" />
                </div>
            )}

            <div className="flex items-start gap-4 relative z-10">
                <div className={clsx(
                    "p-3 rounded-lg border transition-colors duration-300",
                    isActive ? "bg-terminal-accent/20 border-terminal-accent text-terminal-accent" : "bg-terminal-bg border-terminal-border text-terminal-muted"
                )}>
                    <Icon size={24} className={isActive ? "animate-pulse" : ""} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className={clsx(
                                "font-mono font-bold text-sm tracking-wider",
                                isActive ? "text-terminal-accent text-glow" : "text-terminal-text"
                            )}>
                                {agent.name}
                            </h3>
                            <p className="text-[10px] text-terminal-muted uppercase tracking-widest mt-0.5">
                                {agent.role.replace('_', ' ')}
                            </p>
                        </div>
                        <div className={clsx(
                            "px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border",
                            agent.status === 'WORKING' ? "bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse" :
                                agent.status === 'SUCCESS' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                    agent.status === 'FAILURE' ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                        "bg-terminal-border text-terminal-muted border-transparent"
                        )}>
                            {agent.status}
                        </div>
                    </div>

                    {/* Live Thought Log */}
                    <div className="mt-3 font-mono text-xs relative">
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-terminal-border"></div>
                        <p className={clsx(
                            "pl-3 leading-relaxed whitespace-pre-wrap break-words",
                            isActive ? "text-terminal-text" : "text-terminal-muted/60"
                        )}>
                            <span className="text-terminal-accent/50 mr-2">{'>'}</span>
                            {agent.lastLog}
                        </p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
