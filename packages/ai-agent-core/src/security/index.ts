/**
 * Security sandboxing module for XSky agent framework.
 * Provides trust boundaries, permission management, and audit logging for tool execution.
 */

export { DefaultPermissionEvaluator } from './permission-evaluator';
export { InMemoryAuditLogger, AuditLoggerFactory } from './audit-logger';
export {
  ToolExecutionSandbox,
  ToolSandboxFactory,
  type ToolSandboxOptions,
  type SandboxResult,
} from './tool-sandbox';

export type {
  PermissionLevel,
  ResourceType,
  SecurityPermission,
  ToolConstraint,
  SecurityContext,
  ResourceAccess,
  PermissionEvaluation,
  AuditLogEntry,
  SecurityConfig,
  IPermissionEvaluator,
  IAuditLogger,
} from '../types/security.types';
