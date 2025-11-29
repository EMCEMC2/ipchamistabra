/**
 * Worker Pool Manager
 * Manages multiple web workers for parallel computation
 * Supports task queuing, load balancing, and automatic scaling
 */

export interface PooledTask<T, R> {
  id: string;
  type: string;
  payload: T;
  priority: 'high' | 'normal' | 'low';
  resolve: (result: R) => void;
  reject: (error: Error) => void;
  startedAt?: number;
  timeout?: number;
}

interface WorkerState {
  worker: Worker;
  busy: boolean;
  currentTask: string | null;
  completedTasks: number;
  errors: number;
  lastActivity: number;
}

interface PoolConfig {
  minWorkers?: number;
  maxWorkers?: number;
  taskTimeout?: number;
  idleTimeout?: number;
  workerScript: URL;
}

export class WorkerPool<T = unknown, R = unknown> {
  private workers: Map<string, WorkerState> = new Map();
  private taskQueue: PooledTask<T, R>[] = [];
  private config: Required<PoolConfig>;
  private isShuttingDown: boolean = false;
  private idleCheckInterval: number | null = null;

  constructor(config: PoolConfig) {
    this.config = {
      minWorkers: config.minWorkers ?? 1,
      maxWorkers: config.maxWorkers ?? (navigator.hardwareConcurrency || 4),
      taskTimeout: config.taskTimeout ?? 30000,
      idleTimeout: config.idleTimeout ?? 60000,
      workerScript: config.workerScript
    };

    // Initialize minimum workers
    for (let i = 0; i < this.config.minWorkers; i++) {
      this.createWorker();
    }

    // Start idle worker cleanup
    this.startIdleCheck();
  }

  /**
   * Submit a task to the pool
   */
  public async submit(
    type: string,
    payload: T,
    options: { priority?: 'high' | 'normal' | 'low'; timeout?: number } = {}
  ): Promise<R> {
    if (this.isShuttingDown) {
      throw new Error('Worker pool is shutting down');
    }

    return new Promise((resolve, reject) => {
      const task: PooledTask<T, R> = {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type,
        payload,
        priority: options.priority ?? 'normal',
        timeout: options.timeout ?? this.config.taskTimeout,
        resolve,
        reject
      };

      // Insert based on priority
      if (task.priority === 'high') {
        // Find first non-high priority task
        const insertIdx = this.taskQueue.findIndex(t => t.priority !== 'high');
        if (insertIdx >= 0) {
          this.taskQueue.splice(insertIdx, 0, task);
        } else {
          this.taskQueue.push(task);
        }
      } else if (task.priority === 'low') {
        this.taskQueue.push(task);
      } else {
        // Normal priority - insert after high, before low
        const insertIdx = this.taskQueue.findIndex(t => t.priority === 'low');
        if (insertIdx >= 0) {
          this.taskQueue.splice(insertIdx, 0, task);
        } else {
          this.taskQueue.push(task);
        }
      }

      this.processQueue();
    });
  }

  /**
   * Process the task queue
   */
  private processQueue(): void {
    if (this.isShuttingDown || this.taskQueue.length === 0) return;

    // Find available worker
    let availableWorker: WorkerState | null = null;
    for (const [_, state] of this.workers) {
      if (!state.busy) {
        availableWorker = state;
        break;
      }
    }

    // Scale up if needed and possible
    if (!availableWorker && this.workers.size < this.config.maxWorkers) {
      availableWorker = this.createWorker();
    }

    if (!availableWorker) {
      // All workers busy, task stays in queue
      return;
    }

    const task = this.taskQueue.shift();
    if (!task) return;

    this.runTask(availableWorker, task);
  }

  /**
   * Run a task on a specific worker
   */
  private runTask(workerState: WorkerState, task: PooledTask<T, R>): void {
    workerState.busy = true;
    workerState.currentTask = task.id;
    task.startedAt = Date.now();

    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (workerState.currentTask === task.id) {
        workerState.errors++;
        task.reject(new Error(`Task ${task.id} timed out after ${task.timeout}ms`));
        this.recycleWorker(workerState);
      }
    }, task.timeout);

    // Handle response
    const messageHandler = (event: MessageEvent) => {
      if (event.data.requestId === task.id) {
        clearTimeout(timeoutId);
        workerState.worker.removeEventListener('message', messageHandler);
        workerState.busy = false;
        workerState.currentTask = null;
        workerState.completedTasks++;
        workerState.lastActivity = Date.now();

        if (event.data.type === 'ERROR') {
          workerState.errors++;
          task.reject(new Error(event.data.payload.error));
        } else {
          task.resolve(event.data.payload);
        }

        // Process next task
        this.processQueue();
      }
    };

    workerState.worker.addEventListener('message', messageHandler);

    // Send task to worker
    workerState.worker.postMessage({
      type: task.type,
      payload: task.payload,
      requestId: task.id
    });
  }

  /**
   * Create a new worker
   */
  private createWorker(): WorkerState {
    const id = `worker-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const worker = new Worker(this.config.workerScript, { type: 'module' });

    const state: WorkerState = {
      worker,
      busy: false,
      currentTask: null,
      completedTasks: 0,
      errors: 0,
      lastActivity: Date.now()
    };

    worker.onerror = (error) => {
      console.error(`[WorkerPool] Worker ${id} error:`, error);
      state.errors++;
      if (state.errors > 5) {
        this.recycleWorker(state);
      }
    };

    this.workers.set(id, state);
    console.log(`[WorkerPool] Created worker ${id}. Total: ${this.workers.size}`);

    return state;
  }

  /**
   * Recycle a problematic worker
   */
  private recycleWorker(state: WorkerState): void {
    // Find and remove the worker
    for (const [id, ws] of this.workers) {
      if (ws === state) {
        ws.worker.terminate();
        this.workers.delete(id);
        console.log(`[WorkerPool] Recycled worker ${id}`);

        // Create replacement if below minimum
        if (this.workers.size < this.config.minWorkers) {
          this.createWorker();
        }
        break;
      }
    }
  }

  /**
   * Start periodic idle worker cleanup
   */
  private startIdleCheck(): void {
    this.idleCheckInterval = window.setInterval(() => {
      const now = Date.now();
      const idleThreshold = now - this.config.idleTimeout;

      // Keep minimum workers, remove idle extras
      let removeCount = 0;
      for (const [id, state] of this.workers) {
        if (
          !state.busy &&
          state.lastActivity < idleThreshold &&
          this.workers.size - removeCount > this.config.minWorkers
        ) {
          state.worker.terminate();
          this.workers.delete(id);
          removeCount++;
          console.log(`[WorkerPool] Terminated idle worker ${id}`);
        }
      }
    }, 30000);
  }

  /**
   * Get pool statistics
   */
  public getStats(): {
    totalWorkers: number;
    busyWorkers: number;
    queuedTasks: number;
    completedTasks: number;
    totalErrors: number;
  } {
    let busyCount = 0;
    let completedTasks = 0;
    let totalErrors = 0;

    for (const [_, state] of this.workers) {
      if (state.busy) busyCount++;
      completedTasks += state.completedTasks;
      totalErrors += state.errors;
    }

    return {
      totalWorkers: this.workers.size,
      busyWorkers: busyCount,
      queuedTasks: this.taskQueue.length,
      completedTasks,
      totalErrors
    };
  }

  /**
   * Shutdown the pool gracefully
   */
  public async shutdown(timeout: number = 5000): Promise<void> {
    this.isShuttingDown = true;

    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
    }

    // Wait for current tasks to complete
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      let allIdle = true;
      for (const [_, state] of this.workers) {
        if (state.busy) {
          allIdle = false;
          break;
        }
      }
      if (allIdle) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Reject remaining queued tasks
    for (const task of this.taskQueue) {
      task.reject(new Error('Worker pool shutdown'));
    }
    this.taskQueue = [];

    // Terminate all workers
    for (const [id, state] of this.workers) {
      state.worker.terminate();
      console.log(`[WorkerPool] Terminated worker ${id} during shutdown`);
    }
    this.workers.clear();
  }

  /**
   * Force terminate all workers immediately
   */
  public terminate(): void {
    this.isShuttingDown = true;

    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
    }

    for (const task of this.taskQueue) {
      task.reject(new Error('Worker pool terminated'));
    }
    this.taskQueue = [];

    for (const [_, state] of this.workers) {
      state.worker.terminate();
    }
    this.workers.clear();
  }
}

/**
 * Create a singleton indicator worker pool
 */
let indicatorPool: WorkerPool | null = null;

export function getIndicatorWorkerPool(): WorkerPool {
  if (!indicatorPool) {
    indicatorPool = new WorkerPool({
      minWorkers: 1,
      maxWorkers: 2,
      taskTimeout: 10000,
      idleTimeout: 120000,
      workerScript: new URL('./indicatorWorker.ts', import.meta.url)
    });
  }
  return indicatorPool;
}

/**
 * Shutdown indicator pool
 */
export function shutdownIndicatorPool(): void {
  if (indicatorPool) {
    indicatorPool.terminate();
    indicatorPool = null;
  }
}
