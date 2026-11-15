---
title: "Cost Envelopes: Bounding LLM Spend in Production"
description: "Token budgets, capability tokens, and circuit breakers — a framework for predictable AI economics."
pubDate: "Nov 08 2026"
heroImage: "../../assets/blog-placeholder-2.jpg"
tags: ["Cost Control", "Token Budgets", "Circuit Breakers", "Production"]
sourceUrl: "https://github.com/example/cost-envelopes"
readingTime: 15
---

LLM costs scale unpredictably with usage patterns. This essay presents a cost envelope framework that bounds spend without hard limits that break user workflows.

## The Problem

- Variable token consumption per request (100–50k tokens)
- No correlation between token count and business value
- Burst traffic causes budget overruns
- Per-request limits degrade UX for complex tasks

## Cost Envelope Model

```text
Envelope = {
  budget: TokenBudget;      // Rolling window (hour/day/month)
  tiers: CapabilityTier[];  // Capability → token cost mapping
  breaker: CircuitBreaker;  // Opens at 90% budget
  alert: AlertPolicy;       // Notifies at 50%, 75%, 90%
}
```

## Capability Tiers

| Tier     | Capabilities                 | Token Cost | Budget Share |
| -------- | ---------------------------- | ---------- | ------------ |
| Base     | `llm.chat`, `tool.search`    | 1×         | 40%          |
| Extended | `llm.reason`, `tool.code`    | 3×         | 35%          |
| Premium  | `llm.plan`, `agent.delegate` | 10×        | 25%          |

## Circuit Breaker

```rust
struct Breaker {
  budget: Arc<TokenBudget>,
  threshold: f32,  // 0.90
  state: Atomic<State>, // Closed | HalfOpen | Open
}

impl Breaker {
  fn check(&self, estimated: u64) -> Result<Permit, BreakerOpen> {
    if self.budget.used + estimated > self.budget.limit * self.threshold {
      self.trip();
      return Err(BreakerOpen);
    }
    Ok(Permit::new(self.budget.reserve(estimated)))
  }
}
```

<Callout type="evidence">
Production deployment (Q3 2026): 0 budget overruns, 99.2% request success rate, <2% latency overhead.
</Callout>

## Migration Path

1. Instrument all LLM calls with token counters
2. Deploy budgets in shadow mode (observe only)
3. Enable breakers with generous thresholds
4. Tighten based on observed distributions

## References

- [Token Budgeting at Scale](https://example.com/token-budgets)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Capability-Based Pricing](https://example.com/capability-pricing)
