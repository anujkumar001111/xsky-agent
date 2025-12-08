
/**
 * Simple Circuit Breaker implementation to prevent cascading failures
 * when external services (like LLM providers) are down.
 */
export class CircuitBreaker {
    private failures = new Map<string, number>();
    private openUntil = new Map<string, number>();

    constructor(
        private readonly failureThreshold: number = 3,
        private readonly cooldownMs: number = 60000
    ) { }

    /**
     * Checks if the circuit is open (broken) for a given key.
     */
    isOpen(key: string): boolean {
        const until = this.openUntil.get(key);
        if (until && Date.now() < until) return true;
        return false;
    }

    /**
     * Records a failure for a key. Opens the circuit if threshold reached.
     */
    recordFailure(key: string) {
        const count = (this.failures.get(key) || 0) + 1;
        this.failures.set(key, count);
        if (count >= this.failureThreshold) {
            this.openUntil.set(key, Date.now() + this.cooldownMs);
            this.failures.delete(key); // Reset count so it starts fresh after cooldown
        }
    }

    /**
     * Records a success, resetting any failure counts.
     */
    recordSuccess(key: string) {
        this.failures.delete(key);
        this.openUntil.delete(key);
    }
}
