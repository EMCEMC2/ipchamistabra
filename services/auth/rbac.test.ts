/**
 * Unit Tests for RBAC System
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  initSession,
  getSession,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getCurrentRole,
  setRole,
  clearSession,
  isSessionValid,
  requirePermission,
  PermissionDeniedError
} from './rbac';

describe('RBAC Session Management', () => {
  beforeEach(() => {
    clearSession();
  });

  it('initializes session with default trader role', () => {
    const session = initSession();
    expect(session.role).toBe('trader');
    expect(session.permissions).toContain('read:market');
    expect(session.permissions).toContain('write:position');
  });

  it('initializes session with specified role', () => {
    const session = initSession('viewer');
    expect(session.role).toBe('viewer');
    expect(session.permissions).toContain('read:market');
    expect(session.permissions).not.toContain('write:position');
  });

  it('auto-initializes session on getSession', () => {
    clearSession();
    const session = getSession();
    expect(session).not.toBeNull();
    expect(session.role).toBe('trader');
  });

  it('updates lastActivity on getSession', () => {
    initSession();
    const before = getSession().lastActivity;
    // Small delay
    const start = Date.now();
    while (Date.now() - start < 5) { /* wait */ }
    const after = getSession().lastActivity;
    expect(after).toBeGreaterThanOrEqual(before);
  });
});

describe('Permission Checks', () => {
  beforeEach(() => {
    clearSession();
  });

  it('viewer has read permissions only', () => {
    initSession('viewer');
    expect(hasPermission('read:market')).toBe(true);
    expect(hasPermission('read:portfolio')).toBe(true);
    expect(hasPermission('write:position')).toBe(false);
    expect(hasPermission('admin:config')).toBe(false);
  });

  it('trader has read and write permissions', () => {
    initSession('trader');
    expect(hasPermission('read:market')).toBe(true);
    expect(hasPermission('write:position')).toBe(true);
    expect(hasPermission('write:order')).toBe(true);
    expect(hasPermission('admin:config')).toBe(false);
  });

  it('admin has all permissions', () => {
    initSession('admin');
    expect(hasPermission('read:market')).toBe(true);
    expect(hasPermission('write:position')).toBe(true);
    expect(hasPermission('admin:config')).toBe(true);
    expect(hasPermission('admin:api-keys')).toBe(true);
  });
});

describe('hasAllPermissions', () => {
  beforeEach(() => {
    clearSession();
    initSession('trader');
  });

  it('returns true if user has all permissions', () => {
    expect(hasAllPermissions(['read:market', 'write:position'])).toBe(true);
  });

  it('returns false if user lacks any permission', () => {
    expect(hasAllPermissions(['read:market', 'admin:config'])).toBe(false);
  });

  it('returns true for empty array', () => {
    expect(hasAllPermissions([])).toBe(true);
  });
});

describe('hasAnyPermission', () => {
  beforeEach(() => {
    clearSession();
    initSession('viewer');
  });

  it('returns true if user has any permission', () => {
    expect(hasAnyPermission(['admin:config', 'read:market'])).toBe(true);
  });

  it('returns false if user has none of the permissions', () => {
    expect(hasAnyPermission(['admin:config', 'write:position'])).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(hasAnyPermission([])).toBe(false);
  });
});

describe('Role Management', () => {
  beforeEach(() => {
    clearSession();
  });

  it('getCurrentRole returns current role', () => {
    initSession('admin');
    expect(getCurrentRole()).toBe('admin');
  });

  it('setRole changes role', () => {
    initSession('viewer');
    expect(getCurrentRole()).toBe('viewer');
    setRole('admin');
    expect(getCurrentRole()).toBe('admin');
    expect(hasPermission('admin:config')).toBe(true);
  });
});

describe('Session Validity', () => {
  beforeEach(() => {
    clearSession();
  });

  it('isSessionValid returns false when no session', () => {
    expect(isSessionValid()).toBe(false);
  });

  it('isSessionValid returns true for active session', () => {
    initSession();
    expect(isSessionValid()).toBe(true);
  });

  it('clearSession removes session', () => {
    initSession();
    expect(isSessionValid()).toBe(true);
    clearSession();
    expect(isSessionValid()).toBe(false);
  });
});

describe('requirePermission Guard', () => {
  beforeEach(() => {
    clearSession();
  });

  it('allows execution with permission', () => {
    initSession('trader');
    const fn = requirePermission('write:position', () => 'success');
    expect(fn()).toBe('success');
  });

  it('throws PermissionDeniedError without permission', () => {
    initSession('viewer');
    const fn = requirePermission('write:position', () => 'success');
    expect(() => fn()).toThrow(PermissionDeniedError);
  });

  it('PermissionDeniedError contains permission and role', () => {
    initSession('viewer');
    try {
      const fn = requirePermission('admin:config', () => 'success');
      fn();
    } catch (e) {
      expect(e).toBeInstanceOf(PermissionDeniedError);
      expect((e as PermissionDeniedError).permission).toBe('admin:config');
      expect((e as PermissionDeniedError).role).toBe('viewer');
    }
  });
});
