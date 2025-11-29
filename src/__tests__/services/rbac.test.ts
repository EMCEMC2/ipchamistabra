/**
 * RBAC Tests
 * Tests for Role-Based Access Control
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createRBACContext,
  hasPermission,
  requirePermission,
  getRole,
  setRole,
  getPermissions,
  PERMISSIONS,
  type Role,
  type RBACContext
} from '../../services/auth/rbac';

describe('RBAC', () => {
  let context: RBACContext;

  beforeEach(() => {
    context = createRBACContext('viewer');
  });

  describe('createRBACContext', () => {
    it('should create context with specified role', () => {
      const ctx = createRBACContext('admin');
      expect(ctx.role).toBe('admin');
    });

    it('should initialize with correct permissions', () => {
      const viewerCtx = createRBACContext('viewer');
      const adminCtx = createRBACContext('admin');

      expect(viewerCtx.permissions.size).toBeLessThan(adminCtx.permissions.size);
    });
  });

  describe('hasPermission', () => {
    it('should return true for allowed permissions', () => {
      const traderCtx = createRBACContext('trader');
      expect(hasPermission(traderCtx, 'trade:execute')).toBe(true);
      expect(hasPermission(traderCtx, 'market:read')).toBe(true);
    });

    it('should return false for denied permissions', () => {
      const viewerCtx = createRBACContext('viewer');
      expect(hasPermission(viewerCtx, 'trade:execute')).toBe(false);
      expect(hasPermission(viewerCtx, 'settings:write')).toBe(false);
    });

    it('should grant all permissions to admin', () => {
      const adminCtx = createRBACContext('admin');
      expect(hasPermission(adminCtx, 'trade:execute')).toBe(true);
      expect(hasPermission(adminCtx, 'settings:write')).toBe(true);
      expect(hasPermission(adminCtx, 'system:admin')).toBe(true);
    });
  });

  describe('requirePermission', () => {
    it('should not throw for allowed permissions', () => {
      const traderCtx = createRBACContext('trader');
      expect(() => requirePermission(traderCtx, 'trade:execute')).not.toThrow();
    });

    it('should throw for denied permissions', () => {
      const viewerCtx = createRBACContext('viewer');
      expect(() => requirePermission(viewerCtx, 'trade:execute')).toThrow();
    });

    it('should include permission name in error', () => {
      const viewerCtx = createRBACContext('viewer');
      try {
        requirePermission(viewerCtx, 'settings:write');
      } catch (e) {
        expect((e as Error).message).toContain('settings:write');
      }
    });
  });

  describe('role hierarchy', () => {
    const roles: Role[] = ['viewer', 'trader', 'admin'];
    const permissionCounts = roles.map(r => {
      const ctx = createRBACContext(r);
      return ctx.permissions.size;
    });

    it('should have increasing permissions from viewer to admin', () => {
      expect(permissionCounts[0]).toBeLessThan(permissionCounts[1]);
      expect(permissionCounts[1]).toBeLessThan(permissionCounts[2]);
    });
  });

  describe('getRole and setRole', () => {
    it('should get current role', () => {
      const ctx = createRBACContext('trader');
      expect(getRole(ctx)).toBe('trader');
    });

    it('should update role and permissions', () => {
      let ctx = createRBACContext('viewer');
      expect(hasPermission(ctx, 'trade:execute')).toBe(false);

      ctx = setRole(ctx, 'trader');
      expect(getRole(ctx)).toBe('trader');
      expect(hasPermission(ctx, 'trade:execute')).toBe(true);
    });
  });

  describe('getPermissions', () => {
    it('should return array of permissions', () => {
      const ctx = createRBACContext('trader');
      const perms = getPermissions(ctx);

      expect(Array.isArray(perms)).toBe(true);
      expect(perms.length).toBeGreaterThan(0);
    });

    it('should include expected permissions for role', () => {
      const viewerCtx = createRBACContext('viewer');
      const viewerPerms = getPermissions(viewerCtx);

      expect(viewerPerms).toContain('market:read');
      expect(viewerPerms).not.toContain('trade:execute');
    });
  });

  describe('PERMISSIONS constant', () => {
    it('should have all expected permission categories', () => {
      expect(PERMISSIONS).toHaveProperty('MARKET_READ');
      expect(PERMISSIONS).toHaveProperty('TRADE_EXECUTE');
      expect(PERMISSIONS).toHaveProperty('SETTINGS_WRITE');
      expect(PERMISSIONS).toHaveProperty('SYSTEM_ADMIN');
    });
  });

  describe('edge cases', () => {
    it('should handle unknown permissions gracefully', () => {
      const ctx = createRBACContext('admin');
      // Even admin shouldn't have made-up permissions
      expect(hasPermission(ctx, 'fake:permission' as never)).toBe(false);
    });

    it('should be immutable - setRole returns new context', () => {
      const original = createRBACContext('viewer');
      const updated = setRole(original, 'admin');

      expect(original.role).toBe('viewer');
      expect(updated.role).toBe('admin');
      expect(original).not.toBe(updated);
    });
  });
});
