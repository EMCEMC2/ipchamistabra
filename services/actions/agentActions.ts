/**
 * Agent Actions
 * Decouples agent operations from store mutations
 */

import { useStore } from '../../store/useStore';
import { AgentRole, AgentState } from '../../types';
import { RiskOfficerState } from '../riskOfficer';
import { ConfluenceWeights } from '../agentConsensus';

/**
 * Update agent status action
 */
export function updateAgentStatus(
  role: AgentRole,
  status: AgentState['status'],
  log?: string
): void {
  useStore.getState().updateAgentStatus(role, status, log);
}

/**
 * Add council log action
 */
export function addCouncilLog(agentName: string, message: string): void {
  useStore.getState().addCouncilLog(agentName, message);
}

/**
 * Set risk officer state action
 */
export function setRiskOfficerState(state: Partial<RiskOfficerState>): void {
  useStore.getState().setRiskOfficerState(state);
}

/**
 * Set confluence weights action
 */
export function setConfluenceWeights(weights: Partial<ConfluenceWeights>): void {
  useStore.getState().setConfluenceWeights(weights);
}

/**
 * Get current agent swarm state (read-only)
 */
export function getAgentSwarmState() {
  const state = useStore.getState();
  return {
    agents: state.agents,
    isSwarmActive: state.isSwarmActive,
    councilLogs: state.councilLogs,
    riskOfficer: state.riskOfficer,
    confluenceWeights: state.confluenceWeights
  };
}

/**
 * Get specific agent state
 */
export function getAgentByRole(role: AgentRole): AgentState | undefined {
  const { agents } = getAgentSwarmState();
  return agents.find(a => a.role === role);
}

/**
 * Get agent by name
 */
export function getAgentByName(name: string): AgentState | undefined {
  const { agents } = getAgentSwarmState();
  return agents.find(a => a.name === name);
}

/**
 * Get agents by status
 */
export function getAgentsByStatus(status: AgentState['status']): AgentState[] {
  const { agents } = getAgentSwarmState();
  return agents.filter(a => a.status === status);
}

/**
 * Check if all agents are idle
 */
export function areAllAgentsIdle(): boolean {
  const { agents } = getAgentSwarmState();
  return agents.every(a => a.status === 'IDLE');
}

/**
 * Check if any agent is working
 */
export function isAnyAgentWorking(): boolean {
  const { agents } = getAgentSwarmState();
  return agents.some(a => a.status === 'WORKING');
}

/**
 * Get recent council logs
 */
export function getRecentCouncilLogs(limit: number = 50): typeof useStore extends { getState: () => { councilLogs: infer T } } ? T : never {
  const { councilLogs } = getAgentSwarmState();
  return councilLogs.slice(-limit) as any;
}

/**
 * Get council logs by agent
 */
export function getCouncilLogsByAgent(agentName: string, limit: number = 20) {
  const { councilLogs } = getAgentSwarmState();
  return councilLogs
    .filter(log => log.agentName === agentName)
    .slice(-limit);
}

/**
 * Clear old council logs (keep last N)
 */
export function pruneCouncilLogs(keepCount: number = 100): void {
  const state = useStore.getState();
  if (state.councilLogs.length > keepCount) {
    // Note: This would need a new action in the store to actually prune
    // For now, this is a placeholder for the interface
    console.log(`[AgentActions] Would prune to ${keepCount} logs`);
  }
}

/**
 * Batch update multiple agents
 */
export function batchUpdateAgents(
  updates: Array<{
    role: AgentRole;
    status: AgentState['status'];
    log?: string;
  }>
): void {
  for (const update of updates) {
    updateAgentStatus(update.role, update.status, update.log);
  }
}

/**
 * Reset all agents to idle
 */
export function resetAllAgents(): void {
  const { agents } = getAgentSwarmState();
  for (const agent of agents) {
    updateAgentStatus(agent.role, 'IDLE', 'Reset');
  }
}

/**
 * Subscribe to agent state changes
 */
export function subscribeToAgents(
  callback: (state: ReturnType<typeof getAgentSwarmState>) => void
): () => void {
  return useStore.subscribe((state) => {
    callback({
      agents: state.agents,
      isSwarmActive: state.isSwarmActive,
      councilLogs: state.councilLogs,
      riskOfficer: state.riskOfficer,
      confluenceWeights: state.confluenceWeights
    });
  });
}

/**
 * Get agent performance stats
 */
export function getAgentStats(role: AgentRole): {
  totalRuns: number;
  avgDuration: number;
  successRate: number;
} | null {
  const agent = getAgentByRole(role);
  if (!agent) return null;

  // This would ideally pull from historical data
  // For now, return basic stats from current state
  return {
    totalRuns: agent.completedAt ? 1 : 0,
    avgDuration: agent.duration || 0,
    successRate: agent.status === 'SUCCESS' ? 100 :
                 agent.status === 'FAILURE' ? 0 : 50
  };
}
