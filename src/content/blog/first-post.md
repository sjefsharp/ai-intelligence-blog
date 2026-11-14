---
title: "Bounding LLM Agents: A Decision Record"
description: "Schema enforcement vs. sandboxing vs. capability tokens — evaluated against five architectural criteria."
pubDate: "Jul 08 2022"
updatedDate: "Nov 08 2026"
heroImage: "../../assets/blog-placeholder-3.jpg"
tags:
  [
    "Agent Architecture",
    "Decision Records",
    "Schema Enforcement",
    "Cost Control",
  ]
sourceUrl: "https://github.com/example/adr-bounding-llm-agents"
readingTime: 18
---

We evaluate three bounding strategies for LLM agents in production — schema enforcement, tool sandboxing, and capability tokens — against five architectural criteria: traceability, cost control, isolation, latency, and operability.

## Context & Motivation

The industry ships agent frameworks faster than architecture reviews can evaluate them. This record documents our bounding decision for the `orchestrator` service, a long-running agent that coordinates multi-step workflows across internal APIs.

## Evaluation Criteria

| Criterion    | Weight | Schema Enforcement | Tool Sandboxing | Capability Tokens |
| ------------ | ------ | :----------------: | :-------------: | :---------------: |
| Traceability | 0.30   |       ★★★★★        |      ★★☆☆☆      |       ★★★★☆       |
| Cost Control | 0.25   |       ★★★☆☆        |      ★★★★☆      |       ★★★★★       |
| Isolation    | 0.20   |       ★★☆☆☆        |      ★★★★★      |       ★★★☆☆       |
| Latency      | 0.15   |       ★★★★☆        |      ★★☆☆☆      |       ★★★★☆       |
| Operability  | 0.10   |       ★★★★☆        |      ★★★☆☆      |       ★★★★☆       |

<Callout type="evidence">
Scores derived from benchmarking `orchestrator` v2.1–v2.4 under production load (500 req/min, p99 < 2s).
</Callout>

## Decision

**Schema enforcement** selected as primary bounding mechanism. Capability tokens adopted for cost-critical paths. Tool sandboxing reserved for untrusted plugin execution.

```typescript
interface AgentBounding {
  schema: JsonSchema; // traceability
  sandbox: WasmSandbox; // isolation
  tokens: CapabilitySet; // cost control
}
```

## Migration Path

1. **Phase 1** (v2.5): Add JSON Schema validation to all tool calls
2. **Phase 2** (v2.6): Introduce capability token minting for `llm.call` and `api.request`
3. **Phase 3** (v2.7): Deprecate raw tool access; all calls go through bounding layer

<Callout type="migration">
Estimated effort: 3 sprints. Zero-downtime deployment via feature flags.
</Callout>

## Failure Modes

| Mode             | Detection                  | Mitigation                          |
| ---------------- | -------------------------- | ----------------------------------- |
| Schema drift     | CI validation on PR        | Automated schema regeneration       |
| Token exhaustion | Budget alerts at 80%       | Circuit breaker + graceful degrade  |
| Sandbox escape   | WASM runtime monitoring    | Process isolation + seccomp         |
| Cascade timeout  | Distributed trace analysis | Deadline propagation + cancellation |

<Callout type="failure">
Cascade timeout is the highest-risk mode; invests in observability spine (see ADR-0042).
</Callout>

## References

- [JSON Schema Specification](https://json-schema.org/)
- [WASM Component Model](https://github.com/WebAssembly/component-model)
- [Capability-Based Security](https://erights.org/elib/capability/ode/ode.html)
