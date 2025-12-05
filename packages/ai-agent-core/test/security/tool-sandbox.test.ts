
import { ToolExecutionSandbox } from '../../src/security/tool-sandbox';
import { DefaultPermissionEvaluator } from '../../src/security/permission-evaluator';
import { InMemoryAuditLogger } from '../../src/security/audit-logger';
import { SecurityConfig } from '../../src/types/security.types';
import { AgentContext } from '../../src/core/context';

// Mock AgentContext
const mockAgentContext = {
  agent: { Name: 'test-agent' },
  variables: new Map(),
  context: {
    taskId: 'test-task-id',
    config: {
      hooks: {}
    }
  }
} as unknown as AgentContext;

describe('ToolExecutionSandbox', () => {
  const defaultConfig: SecurityConfig = {
    enabled: true,
    defaultPermissionLevel: 'allow',
    requireApprovalForHighRisk: true,
    auditLogging: { enabled: true, logAllExecutions: true, onlyFailures: false },
    sandboxingEnabled: false,
    permissions: []
  };

  let sandbox: ToolExecutionSandbox;
  let auditLogger: InMemoryAuditLogger;
  let permissionEvaluator: DefaultPermissionEvaluator;

  beforeEach(() => {
    auditLogger = new InMemoryAuditLogger();
    permissionEvaluator = new DefaultPermissionEvaluator(defaultConfig);
    sandbox = new ToolExecutionSandbox({
      auditLogger,
      permissionEvaluator,
      config: defaultConfig
    });
  });

  it('should execute allowed tool successfully', async () => {
    const toolExecutor = jest.fn().mockResolvedValue('success');

    const result = await sandbox.execute(
      mockAgentContext,
      'safe_tool',
      {},
      toolExecutor,
      []
    );

    expect(result.allowed).toBe(true);
    expect(result.result).toBe('success');
    expect(toolExecutor).toHaveBeenCalled();

    // Check audit log
    const logs = await auditLogger.query({});
    expect(logs.length).toBe(1);
    expect(logs[0].outcome).toBe('success');
  });

  it('should block denied tool execution', async () => {
    // Re-configure to deny
    const denyConfig = { ...defaultConfig, defaultPermissionLevel: 'deny' as const };
    permissionEvaluator = new DefaultPermissionEvaluator(denyConfig);
    sandbox = new ToolExecutionSandbox({
      auditLogger,
      permissionEvaluator,
      config: denyConfig
    });

    const toolExecutor = jest.fn().mockResolvedValue('success');

    const result = await sandbox.execute(
      mockAgentContext,
      'unsafe_tool',
      {},
      toolExecutor,
      []
    );

    expect(result.allowed).toBe(false);
    expect(result.result).toBeUndefined();
    expect(toolExecutor).not.toHaveBeenCalled();

    // Check audit log
    const logs = await auditLogger.query({});
    expect(logs.length).toBe(1);
    expect(logs[0].outcome).toBe('blocked');
  });

  it('should handle execution errors', async () => {
    const toolExecutor = jest.fn().mockRejectedValue(new Error('Tool failed'));

    const result = await sandbox.execute(
      mockAgentContext,
      'failing_tool',
      {},
      toolExecutor,
      []
    );

    expect(result.allowed).toBe(true); // Was allowed to run
    expect(result.error).toBeDefined();
    expect(result.error?.message).toBe('Tool failed');

    // Check audit log
    const logs = await auditLogger.query({});
    expect(logs.length).toBe(1);
    expect(logs[0].outcome).toBe('failed');
  });

  it('should request approval when required', async () => {
    // Configure high risk
    const highRiskConfig = {
      ...defaultConfig,
      highRiskPatterns: { tools: ['risky_tool'], resources: [] }
    };
    permissionEvaluator = new DefaultPermissionEvaluator(highRiskConfig);
    sandbox = new ToolExecutionSandbox({
      auditLogger,
      permissionEvaluator,
      config: highRiskConfig
    });

    // Mock approval hook
    const onApprovalRequired = jest.fn().mockResolvedValue({ approved: true });
    const contextWithHook = {
      ...mockAgentContext,
      context: {
        taskId: 'test-task-id',
        config: {
          hooks: {
            onApprovalRequired
          }
        }
      }
    } as unknown as AgentContext;

    const toolExecutor = jest.fn().mockResolvedValue('success');

    const result = await sandbox.execute(
      contextWithHook,
      'risky_tool',
      {},
      toolExecutor,
      []
    );

    expect(result.requiresApproval).toBe(true);
    expect(result.approved).toBe(true);
    expect(result.allowed).toBe(true);
    expect(onApprovalRequired).toHaveBeenCalled();
    expect(toolExecutor).toHaveBeenCalled();
  });

  it('should deny when approval is rejected', async () => {
    // Configure high risk
    const highRiskConfig = {
      ...defaultConfig,
      highRiskPatterns: { tools: ['risky_tool'], resources: [] }
    };
    permissionEvaluator = new DefaultPermissionEvaluator(highRiskConfig);
    sandbox = new ToolExecutionSandbox({
      auditLogger,
      permissionEvaluator,
      config: highRiskConfig
    });

    // Mock approval hook - REJECTED
    const onApprovalRequired = jest.fn().mockResolvedValue({ approved: false });
    const contextWithHook = {
      ...mockAgentContext,
      context: {
        taskId: 'test-task-id',
        config: {
          hooks: {
            onApprovalRequired
          }
        }
      }
    } as unknown as AgentContext;

    const toolExecutor = jest.fn().mockResolvedValue('success');

    const result = await sandbox.execute(
      contextWithHook,
      'risky_tool',
      {},
      toolExecutor,
      []
    );

    expect(result.requiresApproval).toBe(true);
    expect(result.approved).toBe(false);
    expect(result.allowed).toBe(false);
    expect(toolExecutor).not.toHaveBeenCalled();

    const logs = await auditLogger.query({});
    expect(logs[0].outcome).toBe('blocked');
  });
});
