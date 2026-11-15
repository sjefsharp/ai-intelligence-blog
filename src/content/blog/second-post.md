---
title: "Observability Patterns for Agent Systems"
description: "Three patterns for tracing, evaluating, and debugging multi-agent workflows without vendor lock-in."
pubDate: "Oct 28 2026"
heroImage: "../../assets/blog-placeholder-1.jpg"
tags: ["Observability", "Distributed Tracing", "Agent Systems", "Patterns"]
sourceUrl: "https://github.com/example/agent-observability-patterns"
readingTime: 22
---

Multi-agent systems introduce causal chains that span services, models, and tools. Traditional logging fails to capture the _why_ behind agent decisions. This pattern catalog documents three field-tested approaches.

## Context

Agents in our `orchestrator` service execute 5–50 steps per request. Each step may invoke LLMs, call APIs, or delegate to sub-agents. Debugging a 20-step failure without structured observability takes hours.

## Pattern 1: Structured Event Log (SEL)

Emit a single JSON event per agent step with fixed schema:

```json
{
  "traceId": "abc-123",
  "spanId": "span-7",
  "parentSpanId": "span-3",
  "agent": "planner",
  "step": "decompose",
  "input": { "goal": "..." },
  "output": { "subgoals": [...] },
  "tokens": { "in": 1200, "out": 340 },
  "latencyMs": 840,
  "status": "ok"
}
```

<Callout type="evidence">
Reduced mean debugging time from 47min to 12min in production incidents (n=23).
</Callout>

## Pattern 2: Evaluation Harness

Run deterministic evaluations against recorded traces:

```typescript
interface Evaluation {
  traceId: string;
  criteria: [
    { name: "hallucination_rate"; threshold: 0.02 },
    { name: "tool_correctness"; threshold: 0.95 },
    { name: "plan_coherence"; threshold: 0.9 },
  ];
  results: Record<string, boolean>;
}
```

## Pattern 3: Replay Debugger

Re-execute agent steps from recorded traces with modified inputs:

```bash
# Replay trace with patched LLM response
agent replay --trace abc-123 --patch step=3 --input '{"fixed": true}'
```

<Callout type="decision">
All three patterns implemented in `obs-agent` crate (Rust, Apache-2.0). Zero vendor dependencies.
</Callout>

## References

- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/)
- [LangSmith Evaluation Guide](https://docs.smith.langchain.com/evaluation)
- [Agent Observability at Scale](https://example.com/agent-obs-scale)
