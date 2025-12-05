# XSky Core Benchmarks

This directory contains performance benchmarks for the XSky AI Agent Core framework.

## Running Benchmarks

To run the benchmarks, execute the following command from the root of the repository:

```bash
pnpm bench
```

Or directly:

```bash
npx tsx benchmarks/core.bench.ts
```

## What is Benchmarked

The benchmarks measure the overhead of the core framework components by mocking the LLM layer. This isolates the framework's performance from network latency and LLM generation time.

Scenarios benchmarked:
1. **Eko.generate (Simple)**: Measures the time to generate a workflow plan.
2. **Eko.run (Simple)**: Measures the time to execute a simple workflow (generate + execute).
3. **Eko.run (Complex)**: Measures the time to execute a complex workflow with 50 agents.
4. **Eko.generate (Large Context)**: Measures overhead with a large 1000-message conversation history (~100k characters).
5. **Agent.run (Heavy Tools)**: Measures overhead of an agent with 50 complex tools (schema conversion & prompt building).
6. **Eko.generate (Large Output)**: Measures parsing overhead for a large 500-agent XML workflow plan (~50KB).

## Results Interpretation

The results (as of Dec 2025) show extremely high performance across all dimensions:

| Scenario | Latency (avg) | Ops/Sec |
|----------|---------------|---------|
| Simple Generate | ~35 μs | ~30,000 |
| Simple Run | ~38 μs | ~29,000 |
| Complex (50 agents) | ~300 μs | ~3,500 |
| Large Context (100k chars) | ~120 μs | ~10,000 |
| Heavy Tools (50 tools) | ~45 μs | ~28,000 |
| Large Output (500 agents) | ~38 μs | ~30,000 |

**Key Findings**:
- **Per-Agent Overhead**: ~6 μs (derived from Complex vs Simple run).
- **Context Overhead**: ~1 μs per 1KB of context.
- **Tool Overhead**: ~1 μs per tool.

**Conclusion**: The framework overhead is negligible (< 1ms) compared to typical LLM latencies (500ms+). No significant bottlenecks were found in the core orchestration, parsing, or tool management logic.
