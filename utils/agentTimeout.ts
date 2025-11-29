/**
 * AGENT TIMEOUT UTILITY
 * Wraps agent tasks with SLA-based timeouts
 */

import { AgentRole, AGENT_SLA, AgentTaskResult } from '../types';

export class AgentTimeoutError extends Error {
  constructor(role: AgentRole, slaMs: number) {
    super(`Agent ${role} exceeded SLA timeout of ${slaMs}ms`);
    this.name = 'AgentTimeoutError';
  }
}

/**
 * Wraps an async agent task with a timeout based on the agent's SLA
 */
export async function withAgentTimeout<T>(
  role: AgentRole,
  task: () => Promise<T>,
  customTimeoutMs?: number
): Promise<T> {
  const timeoutMs = customTimeoutMs ?? AGENT_SLA[role];

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new AgentTimeoutError(role, timeoutMs));
    }, timeoutMs);

    task()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Run an agent task with timeout and return a standardized result
 */
export async function runAgentWithTimeout(
  role: AgentRole,
  task: () => Promise<AgentTaskResult>,
  customTimeoutMs?: number
): Promise<AgentTaskResult> {
  try {
    return await withAgentTimeout(role, task, customTimeoutMs);
  } catch (error) {
    if (error instanceof AgentTimeoutError) {
      return {
        success: false,
        message: `TIMEOUT: ${role} did not respond within ${AGENT_SLA[role] / 1000}s SLA`,
        data: { timeout: true, slaMs: AGENT_SLA[role] }
      };
    }
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      data: { error: true }
    };
  }
}

/**
 * Get the SLA for a specific agent role
 */
export function getAgentSLA(role: AgentRole): number {
  return AGENT_SLA[role];
}

/**
 * Check if an agent duration exceeded its SLA
 */
export function isOverSLA(role: AgentRole, durationMs: number): boolean {
  return durationMs > AGENT_SLA[role];
}

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
