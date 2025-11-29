/**
 * Dependency Injection Container
 * Manages service registration and resolution
 */

type ServiceFactory<T> = () => T;
type ServiceInstance<T> = T;

interface ServiceBinding<T> {
  factory?: ServiceFactory<T>;
  instance?: ServiceInstance<T>;
  singleton: boolean;
}

/**
 * Service Container for Dependency Injection
 * Supports singletons, factories, and lazy initialization
 */
class ServiceContainer {
  private bindings: Map<string, ServiceBinding<unknown>> = new Map();
  private aliases: Map<string, string> = new Map();

  /**
   * Register a singleton service
   * Instance is created once and reused
   */
  singleton<T>(key: string, factory: ServiceFactory<T>): this {
    this.bindings.set(key, {
      factory,
      singleton: true
    });
    return this;
  }

  /**
   * Register a transient service
   * New instance created on each resolve
   */
  transient<T>(key: string, factory: ServiceFactory<T>): this {
    this.bindings.set(key, {
      factory,
      singleton: false
    });
    return this;
  }

  /**
   * Register an existing instance
   */
  instance<T>(key: string, instance: T): this {
    this.bindings.set(key, {
      instance,
      singleton: true
    });
    return this;
  }

  /**
   * Register an alias for a service
   */
  alias(alias: string, target: string): this {
    this.aliases.set(alias, target);
    return this;
  }

  /**
   * Resolve a service by key
   */
  resolve<T>(key: string): T {
    // Check for alias
    const resolvedKey = this.aliases.get(key) || key;
    const binding = this.bindings.get(resolvedKey);

    if (!binding) {
      throw new Error(`Service not registered: ${key}`);
    }

    // Return existing instance
    if (binding.instance !== undefined) {
      return binding.instance as T;
    }

    // Create instance
    if (!binding.factory) {
      throw new Error(`No factory for service: ${key}`);
    }

    const instance = binding.factory() as T;

    // Cache singleton instances
    if (binding.singleton) {
      binding.instance = instance;
    }

    return instance;
  }

  /**
   * Try to resolve a service, return null if not found
   */
  tryResolve<T>(key: string): T | null {
    try {
      return this.resolve<T>(key);
    } catch {
      return null;
    }
  }

  /**
   * Check if service is registered
   */
  has(key: string): boolean {
    const resolvedKey = this.aliases.get(key) || key;
    return this.bindings.has(resolvedKey);
  }

  /**
   * Remove a service registration
   */
  unbind(key: string): boolean {
    return this.bindings.delete(key);
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.bindings.clear();
    this.aliases.clear();
  }

  /**
   * Get all registered service keys
   */
  getRegisteredServices(): string[] {
    return Array.from(this.bindings.keys());
  }

  /**
   * Create a child container that inherits from this one
   */
  createChild(): ServiceContainer {
    const child = new ServiceContainer();
    // Copy bindings (shallow)
    for (const [key, binding] of this.bindings) {
      child.bindings.set(key, { ...binding });
    }
    for (const [alias, target] of this.aliases) {
      child.aliases.set(alias, target);
    }
    return child;
  }
}

// Global container instance
const container = new ServiceContainer();

/**
 * Service Keys
 * Use these constants to avoid typos
 */
export const ServiceKeys = {
  // Market Data
  MARKET_DATA: 'MarketDataService',
  SIGNAL_GENERATOR: 'SignalGenerator',
  CHART_DATA: 'ChartDataProvider',

  // AI Services
  AI_SERVICE: 'AIService',
  SENTIMENT_ANALYZER: 'SentimentAnalyzer',

  // Storage
  STORAGE: 'StorageService',
  CACHE: 'CacheService',
  STATE_PERSISTENCE: 'StatePersistence',

  // WebSocket
  WEBSOCKET: 'WebSocketService',
  WEBSOCKET_POOL: 'WebSocketPool',
  MARKET_STREAM: 'MarketDataStream',

  // Agents
  AGENT_ORCHESTRATOR: 'AgentOrchestrator',
  AGENT_VANGUARD: 'AgentVanguard',
  AGENT_DATAMIND: 'AgentDatamind',
  AGENT_IRONCLAD: 'AgentIronclad',
  AGENT_WATCHDOG: 'AgentWatchdog'
} as const;

/**
 * Register default services
 * Called at application startup
 */
export function registerDefaultServices(): void {
  // These will be implemented by concrete service classes
  // For now, registrations are done lazily by each service module
  console.log('[Container] Default services registered');
}

/**
 * Get the global container
 */
export function getContainer(): ServiceContainer {
  return container;
}

/**
 * Helper to resolve a service
 */
export function resolve<T>(key: string): T {
  return container.resolve<T>(key);
}

/**
 * Helper to try resolve a service
 */
export function tryResolve<T>(key: string): T | null {
  return container.tryResolve<T>(key);
}

/**
 * Helper to register a singleton
 */
export function registerSingleton<T>(key: string, factory: ServiceFactory<T>): void {
  container.singleton(key, factory);
}

/**
 * Helper to register a transient
 */
export function registerTransient<T>(key: string, factory: ServiceFactory<T>): void {
  container.transient(key, factory);
}

/**
 * Helper to register an instance
 */
export function registerInstance<T>(key: string, instance: T): void {
  container.instance(key, instance);
}

/**
 * Environment-based service selection
 * Returns mock services in test mode, real services in production
 */
export function isTestEnvironment(): boolean {
  return typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
}

/**
 * Create environment-aware service factory
 */
export function createServiceFactory<T>(
  realFactory: ServiceFactory<T>,
  mockFactory?: ServiceFactory<T>
): ServiceFactory<T> {
  return () => {
    if (isTestEnvironment() && mockFactory) {
      return mockFactory();
    }
    return realFactory();
  };
}

export { ServiceContainer };
export default container;
