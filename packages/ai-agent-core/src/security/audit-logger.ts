/**
 * Audit logging system for XSky security framework.
 * Tracks tool execution, permissions, and approval decisions for compliance.
 */

import Log from '../common/log';
import { uuidv4 } from '../common/utils';
import { AuditLogEntry, IAuditLogger } from '../types/security.types';

/**
 * In-memory audit logger for XSky framework.
 * Suitable for development and testing; implement persistent backend for production.
 */
export class InMemoryAuditLogger implements IAuditLogger {
  private logs: AuditLogEntry[] = [];
  private maxLogs: number;

  /**
   * Creates a new InMemoryAuditLogger.
   * @param maxLogs - Maximum number of logs to retain (default: 10000).
   */
  constructor(maxLogs: number = 10000) {
    this.maxLogs = maxLogs;
  }

  /**
   * Log a tool execution.
   */
  async log(entry: AuditLogEntry): Promise<void> {
    // Add auto-generated ID if not present
    if (!entry.id) {
      entry.id = uuidv4();
    }

    this.logs.push(entry);

    // Trim old logs if exceeding max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    Log.debug(`Audit log entry created:`, {
      id: entry.id,
      taskId: entry.taskId,
      tool: entry.securityContext.toolName,
      outcome: entry.outcome,
    });
  }

  /**
   * Query audit logs with flexible filtering.
   */
  async query(filter: {
    taskId?: string;
    toolName?: string;
    agentName?: string;
    outcome?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): Promise<AuditLogEntry[]> {
    let results = [...this.logs];

    // Apply filters
    if (filter.taskId) {
      results = results.filter((e) => e.taskId === filter.taskId);
    }

    if (filter.toolName) {
      results = results.filter((e) => e.securityContext.toolName === filter.toolName);
    }

    if (filter.agentName) {
      results = results.filter((e) => e.securityContext.agentName === filter.agentName);
    }

    if (filter.outcome) {
      results = results.filter((e) => e.outcome === filter.outcome);
    }

    if (filter.startTime) {
      results = results.filter((e) => e.loggedAt >= filter.startTime!);
    }

    if (filter.endTime) {
      results = results.filter((e) => e.loggedAt <= filter.endTime!);
    }

    // Apply limit (newest first)
    const limit = filter.limit || 100;
    return results.slice(-limit).reverse();
  }

  /**
   * Export audit logs in JSON or CSV format.
   */
  async export(format: 'json' | 'csv'): Promise<string> {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    }

    // CSV export
    const headers = [
      'ID',
      'TaskID',
      'Agent',
      'Tool',
      'ResourceType',
      'Outcome',
      'Decision',
      'Approved',
      'ExecutionTime(ms)',
      'Timestamp',
    ];

    const rows = this.logs.map((log) => {
      const ctx = log.securityContext;
      const executionTime = ctx.executionCompletedAt
        ? ctx.executionCompletedAt - (ctx.executionStartedAt || ctx.createdAt)
        : null;

      return [
        log.id,
        log.taskId,
        ctx.agentName,
        ctx.toolName,
        ctx.requestedResources[0]?.type || 'unknown',
        log.outcome,
        ctx.decision,
        log.approval?.approved ? 'Yes' : log.approval?.required ? 'Pending' : 'N/A',
        executionTime || '',
        new Date(log.loggedAt).toISOString(),
      ]
        .map((v) => `"${v}"`)
        .join(',');
    });

    return [headers.map((h) => `"${h}"`).join(','), ...rows].join('\n');
  }

  /**
   * Get statistics about audit logs.
   */
  getStatistics(): {
    totalEntries: number;
    successCount: number;
    blockedCount: number;
    failedCount: number;
    escalatedCount: number;
    approvalRate: number;
  } {
    const stats = {
      totalEntries: this.logs.length,
      successCount: 0,
      blockedCount: 0,
      failedCount: 0,
      escalatedCount: 0,
      approvalRate: 0,
    };

    let approvedCount = 0;

    for (const log of this.logs) {
      switch (log.outcome) {
        case 'success':
          stats.successCount++;
          break;
        case 'blocked':
          stats.blockedCount++;
          break;
        case 'failed':
          stats.failedCount++;
          break;
        case 'escalated':
          stats.escalatedCount++;
          break;
      }

      if (log.approval?.approved) {
        approvedCount++;
      }
    }

    const approvalsRequired = this.logs.filter((l) => l.approval?.required).length;
    if (approvalsRequired > 0) {
      stats.approvalRate = (approvedCount / approvalsRequired) * 100;
    }

    return stats;
  }

  /**
   * Clear all audit logs.
   */
  clear(): void {
    this.logs = [];
    Log.info('Audit logs cleared');
  }
}

/**
 * Factory for creating audit logger instances.
 */
export class AuditLoggerFactory {
  private static instance: IAuditLogger | null = null;

  /**
   * Create or get the singleton audit logger instance.
   */
  static getInstance(type: 'memory' = 'memory'): IAuditLogger {
    if (!this.instance) {
      this.instance = new InMemoryAuditLogger();
    }
    return this.instance;
  }

  /**
   * Set a custom audit logger instance.
   */
  static setInstance(logger: IAuditLogger): void {
    this.instance = logger;
  }

  /**
   * Reset to null (useful for testing).
   */
  static reset(): void {
    this.instance = null;
  }
}
