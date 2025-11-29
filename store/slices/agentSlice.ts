/**
 * Agent Slice
 * Handles agent swarm state, council logs, and consensus
 */

import { StateCreator } from 'zustand';
import { AgentState, AgentRole } from '../../types';
import {
  ConfluenceWeights,
  DEFAULT_CONFLUENCE_WEIGHTS,
  setConfluenceWeights as setGlobalConfluenceWeights
} from '../../services/agentConsensus';

export interface CouncilLog {
  id: string;
  agentName: string;
  message: string;
  timestamp: number;
}

export interface AgentSwarmState {
  agents: AgentState[];
  isSwarmActive: boolean;
  councilLogs: CouncilLog[];
  confluenceWeights: ConfluenceWeights;
}

export interface AgentActions {
  updateAgentStatus: (role: AgentRole, status: AgentState['status'], log?: string) => void;
  addCouncilLog: (agentName: string, message: string) => void;
  setConfluenceWeights: (weights: Partial<ConfluenceWeights>) => void;
  clearCouncilLogs: () => void;
  setSwarmActive: (active: boolean) => void;
}

export type AgentSlice = AgentSwarmState & AgentActions;

// Default agents configuration
const defaultAgents: AgentState[] = [
  { role: 'ORCHESTRATOR', name: 'OVERMIND', description: 'System Coordinator', status: 'IDLE', lastLog: 'Standby' },
  { role: 'STRATEGIST', name: 'VANGUARD', description: 'Lead Strategist', status: 'IDLE', lastLog: 'Standby' },
  { role: 'QUANT_RESEARCHER', name: 'DATAMIND', description: 'Data Analysis', status: 'IDLE', lastLog: 'Standby' },
  { role: 'RISK_OFFICER', name: 'IRONCLAD', description: 'Risk Management', status: 'IDLE', lastLog: 'Standby' },
  { role: 'INSPECTOR', name: 'WATCHDOG', description: 'System Integrity', status: 'IDLE', lastLog: 'Standby' }
];

export const createAgentSlice: StateCreator<
  AgentSlice,
  [],
  [],
  AgentSlice
> = (set) => ({
  // Initial state
  agents: defaultAgents,
  isSwarmActive: false,
  councilLogs: [],
  confluenceWeights: { ...DEFAULT_CONFLUENCE_WEIGHTS },

  // Actions
  updateAgentStatus: (role, status, log) => set((state) => ({
    agents: state.agents.map((a) => {
      if (a.role !== role) return a;

      const now = Date.now();
      const updates: Partial<typeof a> = {
        status,
        lastLog: log || a.lastLog
      };

      if (status === 'WORKING') {
        updates.startedAt = now;
        updates.completedAt = undefined;
        updates.duration = undefined;
      } else if (status === 'SUCCESS' || status === 'FAILURE' || status === 'TIMEOUT') {
        updates.completedAt = now;
        if (a.startedAt) {
          updates.duration = now - a.startedAt;
        }
      }

      return { ...a, ...updates };
    })
  })),

  addCouncilLog: (agentName, message) => set((state) => {
    const newLogs = [
      ...state.councilLogs,
      {
        id: Date.now().toString(),
        agentName,
        message,
        timestamp: Date.now()
      }
    ];
    // Keep only last 500 logs
    return {
      councilLogs: newLogs.slice(-500)
    };
  }),

  setConfluenceWeights: (weights) => set((state) => {
    const newWeights = { ...state.confluenceWeights, ...weights };
    setGlobalConfluenceWeights(newWeights);
    return { confluenceWeights: newWeights };
  }),

  clearCouncilLogs: () => set({ councilLogs: [] }),

  setSwarmActive: (active) => set({ isSwarmActive: active })
});

// Selectors
export const selectAgents = (state: AgentSlice) => state.agents;
export const selectCouncilLogs = (state: AgentSlice) => state.councilLogs;
export const selectConfluenceWeights = (state: AgentSlice) => state.confluenceWeights;
export const selectIsSwarmActive = (state: AgentSlice) => state.isSwarmActive;

export const selectAgentByRole = (role: AgentRole) => (state: AgentSlice) =>
  state.agents.find(a => a.role === role);

export const selectAgentByName = (name: string) => (state: AgentSlice) =>
  state.agents.find(a => a.name === name);
