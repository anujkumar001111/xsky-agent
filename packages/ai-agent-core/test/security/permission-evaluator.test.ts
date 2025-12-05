
import { DefaultPermissionEvaluator } from '../../src/security/permission-evaluator';
import { SecurityConfig, ResourceAccess, PermissionEvaluation } from '../../src/types/security.types';
import { AgentContext } from '../../src/core/context';

// Mock AgentContext
const mockAgentContext = {
  agent: { Name: 'test-agent' },
  variables: new Map(),
} as unknown as AgentContext;

describe('DefaultPermissionEvaluator', () => {
  const defaultConfig: SecurityConfig = {
    enabled: true,
    defaultPermissionLevel: 'deny', // Default deny for testing
    requireApprovalForHighRisk: true,
    highRiskPatterns: {
      tools: ['dangerous_*'],
      resources: ['/secret/**'],
    },
    sandboxingEnabled: false,
    permissions: [
      {
        id: 'p1',
        toolName: 'read_file',
        resourceType: 'file_system',
        level: 'allow',
        resourcePattern: '/data/**',
        grant: true,
        createdAt: Date.now(),
      },
      {
        id: 'p2',
        toolName: '*', // Wildcard
        resourceType: 'system_command',
        level: 'deny',
        grant: true,
        createdAt: Date.now(),
      },
      {
        id: 'p3',
        toolName: 'sensitive_tool',
        resourceType: 'database',
        level: 'require_approval',
        grant: true,
        createdAt: Date.now(),
      }
    ],
  };

  let evaluator: DefaultPermissionEvaluator;

  beforeEach(() => {
    evaluator = new DefaultPermissionEvaluator(defaultConfig);
  });

  it('should allow access when permission is explicitly granted', async () => {
    const resource: ResourceAccess = {
      type: 'file_system',
      identifier: '/data/users.json',
      accessType: 'read',
      permission: 'allow', // Initial state
      allowed: true,
    };

    const result = await evaluator.evaluate(
      mockAgentContext,
      'read_file',
      { path: '/data/users.json' },
      [resource]
    );

    expect(result.allowed).toBe(true);
    expect(result.effectiveLevel).toBe('allow');
  });

  it('should deny access when resource does not match pattern', async () => {
    const resource: ResourceAccess = {
      type: 'file_system',
      identifier: '/etc/passwd',
      accessType: 'read',
      permission: 'allow',
      allowed: true,
    };

    const result = await evaluator.evaluate(
      mockAgentContext,
      'read_file',
      { path: '/etc/passwd' },
      [resource]
    );

    expect(result.allowed).toBe(false);
    expect(result.effectiveLevel).toBe('deny'); // Default level
  });

  it('should apply wildcard permissions', async () => {
    const resource: ResourceAccess = {
      type: 'system_command',
      identifier: 'rm -rf /',
      accessType: 'execute',
      permission: 'allow',
      allowed: true,
    };

    const result = await evaluator.evaluate(
      mockAgentContext,
      'any_tool',
      {},
      [resource]
    );

    expect(result.allowed).toBe(false);
    expect(result.effectiveLevel).toBe('deny');
  });

  it('should require approval for high-risk tools', async () => {
    // dangerous_tool matches highRiskPatterns.tools
    const result = await evaluator.evaluate(
      mockAgentContext,
      'dangerous_tool',
      {},
      []
    );

    expect(result.requiresApproval).toBe(true);
  });

  it('should require approval when permission level is require_approval', async () => {
    const resource: ResourceAccess = {
      type: 'database',
      identifier: 'users',
      accessType: 'read',
      permission: 'allow',
      allowed: true,
    };

    const result = await evaluator.evaluate(
      mockAgentContext,
      'sensitive_tool',
      {},
      [resource]
    );

    expect(result.allowed).toBe(true); // Still technically allowed, but requires approval
    expect(result.requiresApproval).toBe(true);
    expect(result.effectiveLevel).toBe('require_approval');
  });

  it('should allow everything when disabled', async () => {
    const disabledConfig = { ...defaultConfig, enabled: false };
    const disabledEvaluator = new DefaultPermissionEvaluator(disabledConfig);

    const resource: ResourceAccess = {
      type: 'file_system',
      identifier: '/etc/passwd',
      accessType: 'read',
      permission: 'allow',
      allowed: true,
    };

    const result = await disabledEvaluator.evaluate(
      mockAgentContext,
      'read_file',
      { path: '/etc/passwd' },
      [resource]
    );

    expect(result.allowed).toBe(true);
  });
});
