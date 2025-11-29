/**
 * Auth Module - Security & Access Control
 * Re-exports all auth-related functionality
 */

export {
  type Permission,
  type Role,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getCurrentRole,
  setRole,
  initSession,
  getSession,
  clearSession,
  isSessionValid,
  requirePermission,
  createPermissionChecker,
  PermissionDeniedError
} from './rbac';

export {
  validateCredentials,
  getGeminiApiKey,
  getGeminiApiKeyOrNull,
  getBinanceCredentials,
  getBinanceWsUrl,
  getBinanceRestUrl,
  isAiAvailable,
  isAuthenticatedTradingAvailable,
  logCredentialStatus,
  CredentialError,
  type CredentialStatus
} from './credentialValidator';
