# Editorial domain — scoped instructions

Scope: `src/lib/**`; inherit root `AGENTS.md`. Use for changes to the domain pipeline, evidence handling, inference client or evaluations. **Do not treat this file as a runtime prompt to the publication LLM.**

## Context locator

| Change touches…                            | Read first…                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| Discovery, source retrieval                | `collection/`, `discovery-ledger/`, `docs/discovery-rings.md`                 |
| Temporal eligibility, novelty              | `editorial-window.ts`, `novelty-classification.ts`, their tests               |
| Source claims and fact dossier             | `evidence-verification/`, `fact-dossier/`, their schemas and tests            |
| Editorial selection, omissions, regression | `editorial-selection/`, `omission-review/`, `historical-regression/`          |
| Canonical outputs and acceptance           | `publication/`, `publication-acceptance/`, `docs/ai-intelligence-contract.md` |
| Readable/listening quality                 | `readable-publication-evaluation/`, `listening-quality-evaluation/`           |
| Workflow stages/side effects               | `workflow-orchestrator/{graph,engine,schema}.ts`                              |
| Provider, retry, cache, cost               | `free-llm-client.ts` (existing runtime configuration is authoritative)        |
| Visual/continuity contracts                | `visualization/`, `thesaurus/`, `book-delta/`, `architecture-principles/`     |

## Invariants to preserve

- Discovery and evidence verification precede editorial acceptance. Claims need verifiable provenance; unknown source accessibility, timestamps or source tiers must remain **unknown**, not fabricated.
- Publication windows use `Europe/Amsterdam` and local 05:00 boundaries, accounting for DST; historical comparisons use **calendar days**.
- Canonical factual records must not be silently rewritten by selection, prose generation, translation or evaluation. Output schema, IDs, hashes, cross-links and audit evidence remain consistent.
- Deterministic code owns dates, validation, hashes, source identity, selection preconditions and gates. Model-generated prose/assessments cannot replace those checks.
- Runtime providers, paid/free constraints and fallbacks are separate from coding-agent instructions. Do not change `free-llm-client.ts` provider choices in response to documentation or model-card suggestions alone.

## Trigger → action → verification

| Trigger                              | Action                                                                                                   | Verification                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Schema or persisted contract changed | Examine schema, consumers, examples and existing records; add migration/compatibility tests where needed | Old/new legitimate artifacts parse as specified; failures explicit |
| Source or claim fields mapped        | Match field semantics to their actual source; do not infer tier from verification level                  | Test unknown/inaccessible and mismatched source cases              |
| Hash/cache/checkpoint code changed   | Check key construction, nested serialization, persistence and recoverability                             | Collision/regression and clear/restart tests pass                  |
| LLM result consumed                  | Validate response and provenance at the boundary; handle absent/truncated/invalid output                 | No unverified claim can reach canonical output                     |
| Workflow/acceptance changed          | Inspect stage graph, retry, state transitions and acceptance checks                                      | Targeted deterministic tests; fail closed on missing evidence      |
| Refactoring proposed                 | Capture existing behavior and smallest responsibility seam first                                         | Characterization and regression tests retain required behavior     |

## Confirmed code review hotspots (not automatic refactor orders)

- `publication/research-audit-generator.ts`: hardcoded `accessibility = "open"`; verification level used as tier; Markdown table escaping needs tests.
- `free-llm-client.ts`: cache writes entire entry map per insert, uses non-cryptographic `hashString`; `CheckpointManager.delete` uses `require()` in ESM; provider policy differs across runtime/code/docs. **Report** drift; do not modify providers in this review.
- `workflow-orchestrator/engine.ts`: `JSON.stringify(data, Object.keys(data as object).sort())` can omit nested values; verify hash invariants before refactoring.
- `workflow-orchestrator/graph.ts` and large evaluation modules: size suggests a review seam, not a proven defect. Extract only with test-backed benefit.

## Engineering rules

- Validate untrusted boundaries with the existing Zod schemas; avoid `any` and unchecked casts for evidence. Use explicit errors and diagnostics for mandatory gate failures.
- Keep pure calculation separate from networking, clock, filesystem, model and rendering effects where it demonstrably improves testability.
- Tests are colocated `*.test.ts`. Use existing Vitest command (`pnpm exec vitest run`), selecting affected test files first; run full CI before merge.
- **Clean Code Principles** (root `AGENTS.md`) apply: KISS, DRY, YAGNI, Least Surprise, SOLID, Meaningful Naming, Single Responsibility, Minimal Arguments, No Side Effects, Fail Fast, SLAP, Vertical Density, Consistent Formatting, Self-Documenting Code, No Dead Code, Boy Scout Rule.
