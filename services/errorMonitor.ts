/**
 * ERROR MONITORING SERVICE
 * Tracks errors, warnings, and critical issues for debugging
 * Can be upgraded to Sentry/LogRocket later with minimal changes
 */

export interface ErrorLog {
  id: string;
  timestamp: number;
  level: 'error' | 'warning' | 'critical';
  message: string;
  context?: string;
  stack?: string;
  metadata?: Record<string, any>;
}

class ErrorMonitor {
  private errors: ErrorLog[] = [];
  private maxLogs = 100; // Keep last 100 errors
  private listeners: Array<(error: ErrorLog) => void> = [];

  constructor() {
    // Global error handler
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.captureError(event.error || new Error(event.message), 'Global Error Handler');
      });

      // Unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.captureError(new Error(event.reason), 'Unhandled Promise Rejection');
      });
    }
  }

  /**
   * Capture an error with context
   */
  captureError(error: Error | string, context?: string, metadata?: Record<string, any>): void {
    const errorLog: ErrorLog = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      level: 'error',
      message: typeof error === 'string' ? error : error.message,
      context,
      stack: typeof error === 'string' ? undefined : error.stack,
      metadata
    };

    this.addLog(errorLog);
    console.error(`[Error Monitor] ${context || 'Error'}:`, error, metadata);
  }

  /**
   * Capture a warning
   */
  captureWarning(message: string, context?: string, metadata?: Record<string, any>): void {
    const errorLog: ErrorLog = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      level: 'warning',
      message,
      context,
      metadata
    };

    this.addLog(errorLog);
    console.warn(`[Error Monitor] ${context || 'Warning'}:`, message, metadata);
  }

  /**
   * Capture a critical error (requires immediate attention)
   */
  captureCritical(error: Error | string, context?: string, metadata?: Record<string, any>): void {
    const errorLog: ErrorLog = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      level: 'critical',
      message: typeof error === 'string' ? error : error.message,
      context,
      stack: typeof error === 'string' ? undefined : error.stack,
      metadata
    };

    this.addLog(errorLog);
    console.error(`[Error Monitor] CRITICAL - ${context || 'Error'}:`, error, metadata);

    // Notify listeners immediately for critical errors
    this.notifyListeners(errorLog);
  }

  /**
   * Add breadcrumb for debugging context
   */
  addBreadcrumb(message: string, category?: string, metadata?: Record<string, any>): void {
    // Store breadcrumb in session storage for debugging
    if (typeof window !== 'undefined') {
      try {
        const breadcrumbs = JSON.parse(sessionStorage.getItem('error_breadcrumbs') || '[]');
        breadcrumbs.push({
          timestamp: Date.now(),
          message,
          category,
          metadata
        });

        // Keep last 50 breadcrumbs
        if (breadcrumbs.length > 50) {
          breadcrumbs.shift();
        }

        sessionStorage.setItem('error_breadcrumbs', JSON.stringify(breadcrumbs));
      } catch (e) {
        // Ignore storage errors
      }
    }
  }

  /**
   * Get all error logs
   */
  getLogs(): ErrorLog[] {
    return [...this.errors];
  }

  /**
   * Get errors by level
   */
  getLogsByLevel(level: 'error' | 'warning' | 'critical'): ErrorLog[] {
    return this.errors.filter(log => log.level === level);
  }

  /**
   * Get recent errors (last N)
   */
  getRecentLogs(count: number = 10): ErrorLog[] {
    return this.errors.slice(-count);
  }

  /**
   * Clear all error logs
   */
  clearLogs(): void {
    this.errors = [];
  }

  /**
   * Subscribe to error events
   */
  subscribe(listener: (error: ErrorLog) => void): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Get error statistics
   */
  getStats(): {
    total: number;
    errors: number;
    warnings: number;
    critical: number;
    lastError?: ErrorLog;
  } {
    const errors = this.errors.filter(log => log.level === 'error');
    const warnings = this.errors.filter(log => log.level === 'warning');
    const critical = this.errors.filter(log => log.level === 'critical');

    return {
      total: this.errors.length,
      errors: errors.length,
      warnings: warnings.length,
      critical: critical.length,
      lastError: this.errors[this.errors.length - 1]
    };
  }

  /**
   * Export logs for analysis
   */
  exportLogs(): string {
    return JSON.stringify({
      exported: new Date().toISOString(),
      logs: this.errors,
      breadcrumbs: typeof window !== 'undefined'
        ? JSON.parse(sessionStorage.getItem('error_breadcrumbs') || '[]')
        : []
    }, null, 2);
  }

  private addLog(log: ErrorLog): void {
    this.errors.push(log);

    // Trim to max size
    if (this.errors.length > this.maxLogs) {
      this.errors.shift();
    }
  }

  private notifyListeners(error: ErrorLog): void {
    this.listeners.forEach(listener => {
      try {
        listener(error);
      } catch (e) {
        console.error('[Error Monitor] Listener error:', e);
      }
    });
  }
}

// Singleton instance
export const errorMonitor = new ErrorMonitor();

// Helper functions for convenience
export const captureError = (error: Error | string, context?: string, metadata?: Record<string, any>) =>
  errorMonitor.captureError(error, context, metadata);

export const captureWarning = (message: string, context?: string, metadata?: Record<string, any>) =>
  errorMonitor.captureWarning(message, context, metadata);

export const captureCritical = (error: Error | string, context?: string, metadata?: Record<string, any>) =>
  errorMonitor.captureCritical(error, context, metadata);

export const addBreadcrumb = (message: string, category?: string, metadata?: Record<string, any>) =>
  errorMonitor.addBreadcrumb(message, category, metadata);
