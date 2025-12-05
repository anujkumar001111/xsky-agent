/**
 * Default permission evaluator for XSky security framework.
 * Implements trust boundary evaluation and resource access control.
 */

import Log from '../common/log';
import { uuidv4 } from '../common/utils';
import type { AgentContext } from '../core/context';
import {
  SecurityPermission,
  ResourceAccess,
  PermissionEvaluation,
  IPermissionEvaluator,
  PermissionLevel,
  ResourceType,
  SecurityConfig,
} from '../types/security.types';

/**
 * Default implementation of the permission evaluator.
 * Uses configuration-driven permission rules with pattern matching.
 */
export class DefaultPermissionEvaluator implements IPermissionEvaluator {
  private permissions: Map<string, SecurityPermission[]> = new Map();
  private config: SecurityConfig;

  /**
   * Creates a new DefaultPermissionEvaluator.
   * @param config - Security configuration with permission rules.
   */
  constructor(config: SecurityConfig) {
    this.config = config;
    this.initializePermissions();
  }

  /**
   * Initialize permissions from config.
   */
  private initializePermissions(): void {
    if (this.config.permissions) {
      for (const perm of this.config.permissions) {
        const key = perm.toolName;
        if (!this.permissions.has(key)) {
          this.permissions.set(key, []);
        }
        this.permissions.get(key)!.push(perm);
      }
    }
  }

  /**
   * Evaluate whether a tool can be executed with given arguments.
   */
  async evaluate(
    context: AgentContext,
    toolName: string,
    args: Record<string, any>,
    requestedResources: ResourceAccess[]
  ): Promise<PermissionEvaluation> {
    if (!this.config.enabled) {
      return {
        allowed: true,
        effectiveLevel: 'allow',
        applicablePermissions: [],
        constraints: [],
        reason: 'Security checks disabled',
      };
    }

    // Get applicable permissions
    const applicablePerms = await this.getApplicablePermissions(toolName);

    // Evaluate each resource access
    const evaluatedResources: ResourceAccess[] = [];
    let effectiveLevel: PermissionLevel = 'allow';
    let requiresApproval = false;

    // If no resources requested, use default level
    if (requestedResources.length === 0) {
      effectiveLevel = this.config.defaultPermissionLevel;
    }

    for (const resource of requestedResources) {
      const permission = await this.checkResourceAccess(context, resource, toolName);
      evaluatedResources.push({
        ...resource,
        permission,
        allowed: permission !== 'deny',
      });

      // Update effective permission (most restrictive wins)
      if (permission === 'deny') {
        effectiveLevel = 'deny';
      } else if (permission === 'require_approval' && effectiveLevel !== 'deny') {
        effectiveLevel = 'require_approval';
      } else if (
        permission === 'sandbox' &&
        effectiveLevel !== 'deny' &&
        effectiveLevel !== 'require_approval'
      ) {
        effectiveLevel = 'sandbox';
      }
    }

    // Determine if approval is required based on effective level
    if (effectiveLevel === 'require_approval' || effectiveLevel === 'sandbox') {
      requiresApproval = true;
    }

    // Collect applicable constraints
    const constraints: any[] = [];
    for (const perm of applicablePerms) {
      if (perm.constraints) {
        constraints.push(...perm.constraints);
      }
    }

    // Check high-risk patterns
    const isHighRisk = this.isHighRiskOperation(toolName);
    if (isHighRisk && this.config.requireApprovalForHighRisk) {
      requiresApproval = true;
      if (effectiveLevel === 'allow') {
        effectiveLevel = 'require_approval';
      }
    }

    const allowed = effectiveLevel !== 'deny';
    const reason =
      effectiveLevel === 'deny'
        ? 'Tool execution denied by security policy'
        : effectiveLevel === 'require_approval'
        ? 'High-risk operation requires approval'
        : effectiveLevel === 'sandbox'
        ? 'Tool execution will be sandboxed'
        : 'Tool execution allowed';

    return {
      allowed,
      effectiveLevel,
      applicablePermissions: applicablePerms,
      constraints,
      reason,
      requiresApproval,
    };
  }

  /**
   * Check if a specific resource access is allowed.
   */
  async checkResourceAccess(
    context: AgentContext,
    resource: ResourceAccess,
    toolName?: string
  ): Promise<PermissionLevel> {
    // Start with default
    let effectivePermission = this.config.defaultPermissionLevel;

    // Check applicable permissions
    const targetTool = toolName || context.agent.Name || '*';
    const applicablePerms = await this.getApplicablePermissions(targetTool);

    // Filter to matching permissions for this resource
    const matchingPerms: SecurityPermission[] = [];
    for (const perm of applicablePerms) {
      if (perm.resourceType !== resource.type) {
        continue;
      }
      if (
        perm.resourcePattern &&
        !this.matchesPattern(resource.identifier, perm.resourcePattern)
      ) {
        continue;
      }
      matchingPerms.push(perm);
    }

    // If no explicit permissions match, use default
    if (matchingPerms.length === 0) {
      return this.config.defaultPermissionLevel;
    }

    // Find most restrictive permission among matches
    let result: PermissionLevel = 'allow';

    for (const perm of matchingPerms) {
      const level = perm.grant ? perm.level : 'deny';

      if (level === 'deny') {
        return 'deny';
      }

      if (level === 'require_approval') {
        result = 'require_approval';
      } else if (level === 'sandbox' && result !== 'require_approval') {
        result = 'sandbox';
      }
    }

    return result;
  }

  /**
   * Get all permissions that apply to a tool.
   */
  async getApplicablePermissions(toolName: string): Promise<SecurityPermission[]> {
    const exact = this.permissions.get(toolName) || [];
    const wildcard = this.permissions.get('*') || [];

    return [...exact, ...wildcard].filter((p) => {
      // Check expiration
      if (p.expiresAt && p.expiresAt < Date.now()) {
        return false;
      }
      return true;
    });
  }

  /**
   * Check if operation is high-risk.
   */
  private isHighRiskOperation(toolName: string): boolean {
    if (!this.config.highRiskPatterns) {
      return false;
    }

    for (const pattern of this.config.highRiskPatterns.tools) {
      if (this.matchesPattern(toolName, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if resource matches a pattern (simple glob support).
   */
  private matchesPattern(resource: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(resource);
  }

  /**
   * Add a new permission at runtime.
   */
  addPermission(permission: SecurityPermission): void {
    const key = permission.toolName;
    if (!this.permissions.has(key)) {
      this.permissions.set(key, []);
    }
    this.permissions.get(key)!.push(permission);
    Log.debug(`Added permission for tool ${key}:`, permission);
  }

  /**
   * Revoke a permission by ID.
   */
  revokePermission(permissionId: string): void {
    for (const [, perms] of this.permissions) {
      const index = perms.findIndex((p) => p.id === permissionId);
      if (index >= 0) {
        perms.splice(index, 1);
        Log.debug(`Revoked permission ${permissionId}`);
        return;
      }
    }
  }
}
