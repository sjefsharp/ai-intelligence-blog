---
title: "Markdown Style Guide for Technical Architecture"
description: "Consistent conventions for headings, code, tables, callouts, and citations in architectural documentation."
pubDate: "Jun 19 2024"
updatedDate: "Nov 08 2026"
heroImage: "../../assets/blog-placeholder-1.jpg"
tags: ["Style Guide", "Documentation", "Markdown", "Conventions"]
sourceUrl: "https://github.com/example/arch-style-guide"
readingTime: 12
---

Consistent Markdown conventions reduce cognitive load for readers and authors. This guide documents the patterns used across this publication.

## Headings

Use ATX-style headings (`#` through `######`). Exactly one H1 per page (the article title).

```markdown
# Article Title (H1 - frontmatter only)

## Major Section (H2)

### Subsection (H3)

#### Detail Level (H4)
```

H2s become folded headings on the diagonal crease line. H3s appear in the crease graph as indented children.

## Code Blocks

Always specify the language for syntax highlighting:

````markdown
```rust
fn main() {
    println!("Hello, architecture!");
}
```
````

### Inline Code

Use backticks for inline code, parameters, and CLI commands:

> The `orchestrator` service uses `WasmSandbox` for isolation.

### Annotated Code

Use comments for inline explanations:

```typescript
interface AgentBounding {
  schema: JsonSchema; // traceability: every call validated
  sandbox: WasmSandbox; // isolation: untrusted code execution
  tokens: CapabilitySet; // cost control: token budget enforcement
}
```

## Tables

Use pipes for alignment. Header row required. Right-align numeric columns:

| Criterion    | Weight | Schema | Sandbox | Tokens |
| :----------- | -----: | :----: | :-----: | :----: |
| Traceability |   0.30 | ★★★★★  |  ★★☆☆☆  | ★★★★☆  |
| Cost Control |   0.25 | ★★★☆☆  |  ★★★★☆  | ★★★★★  |

## Callouts (Admonitions)

Use the `<Callout>` component with typed variants:

```mdx
<Callout type="evidence">Backed by benchmark data.</Callout>
<Callout type="failure">This approach fails under load.</Callout>
<Callout type="migration">
  Phase 1: Add validation. Phase 2: Enable breaker.
</Callout>
<Callout type="decision">Schema enforcement selected as primary.</Callout>
```

Types map to colors: gold (decision), blue (evidence), red (failure), green (migration).

## Blockquotes

Use for citations and extracted text. Attribute with `<cite>`:

> Don't communicate by sharing memory, share memory by communicating.
> — <cite>Rob Pike</cite>

## Lists

### Ordered

Use for sequential steps:

1. Instrument all LLM calls
2. Deploy budgets in shadow mode
3. Enable breakers with generous thresholds

### Unordered

Use for sets of related items:

- Zero paid services
- No tracking or analytics
- Self-hosted fonts only

### Task Lists

Use for checklists in migration paths:

- [x] Add JSON Schema validation
- [ ] Introduce capability token minting
- [ ] Deprecate raw tool access

## Footnotes

Use for references without breaking flow:

The orchestrator uses structured event logs[^1] for observability.

[^1]: See [Observability Patterns for Agent Systems](/blog/second-post/) for details.

## Citations

Inline citations use bracket notation with DOI/URL in footnotes:

The framework achieves 99.2% success rate[^2] under production load.

[^2]: Internal benchmark, Q3 2026. DOI: 10.5281/zenodo.1234567

## Images

Always include descriptive alt text. Use `heroImage` in frontmatter for article headers:

```markdown
![Architecture diagram: request flow through API gateway to agent orchestrator](./arch-flow.png)
```

## Horizontal Rules

Use `---` for major section breaks within content (not between H2s — those have automatic rules).

---

## References Section

Every article ends with a References section using footnote links:

## References

1. [JSON Schema Specification](https://json-schema.org/)
2. [WASM Component Model](https://github.com/WebAssembly/component-model)
3. [Capability-Based Security](https://erights.org/elib/capability/ode/ode.html)
