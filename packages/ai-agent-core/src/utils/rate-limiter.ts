/**
 * Rate Limiter for controlling tool/action execution frequency.
 * Implements sliding window rate limiting per tool.
 */

import type { RateLimitConfig } from "../types/hooks.types";

/**
 * A sliding window rate limiter that tracks operations per tool.
 */
export class RateLimiter {
  private operations: Map<string, number[]> = new Map();

  /**
   * Creates a new RateLimiter instance.
   * @param config - The rate limit configuration.
   */
  constructor(private config: RateLimitConfig) {}

  /**
   * Checks if an operation is allowed under the rate limit.
   * Records the operation if allowed.
   *
   * @param toolName - The name of the tool to check.
   * @returns True if the operation is allowed, false if rate limited.
   */
  checkLimit(toolName: string): boolean {
    const limit = this.getLimit(toolName);
    const now = Date.now();
    const ops = this.operations.get(toolName) || [];

    // Remove expired operations outside the window
    const valid = ops.filter((t) => now - t < limit.windowMs);

    if (valid.length >= limit.maxOperations) {
      return false; // Rate limited
    }

    // Record this operation
    valid.push(now);
    this.operations.set(toolName, valid);
    return true;
  }

  /**
   * Gets the time in milliseconds until the next operation is allowed.
   *
   * @param toolName - The name of the tool to check.
   * @returns Milliseconds until next allowed operation, or 0 if allowed now.
   */
  getWaitTime(toolName: string): number {
    const limit = this.getLimit(toolName);
    const now = Date.now();
    const ops = this.operations.get(toolName) || [];

    // Remove expired operations
    const valid = ops.filter((t) => now - t < limit.windowMs);

    if (valid.length < limit.maxOperations) {
      return 0; // Can execute now
    }

    // Find the oldest operation and calculate when it expires
    const oldest = Math.min(...valid);
    return oldest + limit.windowMs - now;
  }

  /**
   * Waits until an operation is allowed under the rate limit.
   *
   * @param toolName - The name of the tool to wait for.
   * @returns Promise that resolves when the operation is allowed.
   */
  async waitForLimit(toolName: string): Promise<void> {
    const waitTime = this.getWaitTime(toolName);
    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    // After waiting, record the operation
    this.checkLimit(toolName);
  }

  /**
   * Gets the current usage stats for a tool.
   *
   * @param toolName - The name of the tool.
   * @returns Object with current count and max allowed.
   */
  getUsage(toolName: string): { current: number; max: number; windowMs: number } {
    const limit = this.getLimit(toolName);
    const now = Date.now();
    const ops = this.operations.get(toolName) || [];
    const valid = ops.filter((t) => now - t < limit.windowMs);

    return {
      current: valid.length,
      max: limit.maxOperations,
      windowMs: limit.windowMs,
    };
  }

  /**
   * Resets the rate limit counters for a specific tool or all tools.
   *
   * @param toolName - Optional tool name. If not provided, resets all.
   */
  reset(toolName?: string): void {
    if (toolName) {
      this.operations.delete(toolName);
    } else {
      this.operations.clear();
    }
  }

  /**
   * Gets the rate limit config for a specific tool.
   */
  private getLimit(toolName: string): { maxOperations: number; windowMs: number } {
    return this.config.perTool?.[toolName] || {
      maxOperations: this.config.maxOperations,
      windowMs: this.config.windowMs,
    };
  }
}

/**
 * Default rate limit configurations for common use cases.
 */
export const RateLimitPresets = {
  /**
   * Conservative rate limit for web scraping (3 requests per 10 seconds).
   */
  scraping: {
    maxOperations: 3,
    windowMs: 10000,
  } as RateLimitConfig,

  /**
   * Standard API rate limit (60 requests per minute).
   */
  api: {
    maxOperations: 60,
    windowMs: 60000,
  } as RateLimitConfig,

  /**
   * Aggressive rate limit for expensive operations (5 per minute).
   */
  expensive: {
    maxOperations: 5,
    windowMs: 60000,
  } as RateLimitConfig,

  /**
   * Burst-friendly rate limit (100 per second, good for batch operations).
   */
  burst: {
    maxOperations: 100,
    windowMs: 1000,
  } as RateLimitConfig,
};
