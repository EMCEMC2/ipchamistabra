/**
 * RBAC (Role-Based Access Control) System
 * Implements permission checks for trading operations
 */

// Define all possible permissions
export type Permission =
  | 'read:market'
  | 'read:portfolio'
  | 'read:signals'
  | 'read:agents'
  | 'write:position'
  | 'write:order'
  | 'write:journal'
  | 'write:settings'
  | 'admin:config'
  | 'admin:api-keys'
  | 'admin:export';

// Define user roles
export type Role = 'viewer' | 'trader' | 'admin';

// Permission matrix: which permissions each role has
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  viewer: [
    'read:market',
    'read:portfolio',
    'read:signals',
    'read:agents'
  ],
  trader: [
    'read:market',
    'read:portfolio',
    'read:signals',
    'read:agents',
    'write:position',
    'write:order',
    'write:journal',
    'write:settings'
  ],
  admin: [
    'read:market',
    'read:portfolio',
    'read:signals',
    'read:agents',
    'write:position',
    'write:order',
    'write:journal',
    'write:settings',
    'admin:config',
    'admin:api-keys',
    'admin:export'
  ]
};

// Current user session (default to trader for single-user mode)
interface UserSession {
  role: Role;
  permissions: Permission[];
  sessionStart: number;
  lastActivity: number;
}

let currentSession: UserSession | null = null;

/**
 * Initialize user session with a role
 */
export function initSession(role: Role = 'trader'): UserSession {
  const permissions = ROLE_PERMISSIONS[role];
  currentSession = {
    role,
    permissions,
    sessionStart: Date.now(),
    lastActivity: Date.now()
  };
  return currentSession;
}

/**
 * Get current session (auto-initialize if needed)
 */
export function getSession(): UserSession {
  if (!currentSession) {
    return initSession('trader');
  }
  currentSession.lastActivity = Date.now();
  return currentSession;
}

/**
 * Check if current user has a specific permission
 */
export function hasPermission(permission: Permission): boolean {
  const session = getSession();
  return session.permissions.includes(permission);
}

/**
 * Check if current user has ALL specified permissions
 */
export function hasAllPermissions(permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(p));
}

/**
 * Check if current user has ANY of specified permissions
 */
export function hasAnyPermission(permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(p));
}

/**
 * Get current user's role
 */
export function getCurrentRole(): Role {
  return getSession().role;
}

/**
 * Change user role (for testing/admin purposes)
 */
export function setRole(role: Role): void {
  initSession(role);
}

/**
 * Permission guard decorator for functions
 * Throws error if permission check fails
 */
export function requirePermission<T extends (...args: unknown[]) => unknown>(
  permission: Permission,
  fn: T
): T {
  return ((...args: unknown[]) => {
    if (!hasPermission(permission)) {
      throw new PermissionDeniedError(permission);
    }
    return fn(...args);
  }) as T;
}

/**
 * Custom error for permission violations
 */
export class PermissionDeniedError extends Error {
  public readonly permission: Permission;
  public readonly role: Role;

  constructor(permission: Permission) {
    const role = getCurrentRole();
    super(`Permission denied: '${permission}' not granted for role '${role}'`);
    this.name = 'PermissionDeniedError';
    this.permission = permission;
    this.role = role;
  }
}

/**
 * React hook-compatible permission check
 * Returns { allowed, role, check }
 */
export function createPermissionChecker() {
  return {
    allowed: (permission: Permission) => hasPermission(permission),
    role: getCurrentRole(),
    check: (permission: Permission) => {
      if (!hasPermission(permission)) {
        throw new PermissionDeniedError(permission);
      }
    }
  };
}

/**
 * Validate session is still active (not expired)
 * Default timeout: 8 hours
 */
export function isSessionValid(timeoutMs: number = 8 * 60 * 60 * 1000): boolean {
  if (!currentSession) return false;
  const elapsed = Date.now() - currentSession.lastActivity;
  return elapsed < timeoutMs;
}

/**
 * Clear current session (logout)
 */
export function clearSession(): void {
  currentSession = null;
}

// Auto-initialize session on module load for single-user mode
initSession('trader');
