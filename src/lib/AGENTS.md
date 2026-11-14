# AGENTS.md — Editorial Intelligence Library Guidelines

This file contains scoped engineering rules for `src/lib/`. Load only when working in this directory.

## Domain Overview

The `src/lib/` directory contains the **editorial intelligence pipeline** — a deterministic, evidence-first system for AI intelligence analysis. Each subdirectory is a bounded context with clear responsibilities.

## Bounded Contexts

| Context | Responsibility | Key Files |
|---------|---------------|-----------|
| `collection/` | Source acquisition (RSS, ArXiv, GitHub) | `adapters/*.ts`, `types.ts` |
| `editorial-window.ts` | Temporal correctness (Amsterdam timezone) | `editorial-window.ts`, `editorial-window.test.ts` |
| `historical-regression/` | 7-day regression analysis | `*.ts`, `schemas/*.json` |
| `omission-review/` | Coverage gap detection | `*.ts`, `schemas/*.json` |
| `evidence-verification/` | Source provenance validation | `*.ts`, `schemas/*.json` |
| `editorial-selection/` | Story curation | `*.ts`, `schemas/*.json` |
| `fact-dossier/` | Evidence compilation | `store.ts`, `schemas/*.json` |
| `publication/` | Edition assembly & validation | `astro-adapter.ts`, `metadata.ts`, `paths.ts`, `schema.ts` |
| `publication-acceptance/` | Multi-gate quality acceptance | `*.ts`, `schemas/*.json` |
| `signal-desk/` | Real-time signal processing | `signal-desk.ts`, `signal-desk.test.ts` |
| `novelty-classification/` | Publication-date-based novelty | `novelty-classification.ts`, `.test.ts` |
| `book-delta/` | Knowledge continuity across editions | `*.ts`, `schemas/*.json` |
| `workflow-orchestrator/` | Pipeline execution coordination | `engine.ts`, `graph.ts`, `schema.ts` |
| `free-llm-client.ts` | Free-tier LLM inference wrapper | `free-llm-client.ts` |
| `visualization/` | Diagram rendering & validation | `render.ts`, `validate.ts`, `schema.ts` |

## Core Principles

### Deterministic Enforcement
- **No model inference where objective code can enforce the rule**
- All validation via Zod schemas, TypeScript types, and deterministic functions
- LLM used only for synthesis/summarization with structured output validation

### Temporal Correctness
- All timestamps in **Amsterdam timezone (Europe/Amsterdam)**
- Half-open publication windows: `[start, end)`
- Daylight-saving transitions handled via `@js-temporal/polyfill`
- Edition identity: `edition_YYYY-MM-DD` format

### Provenance & Traceability
- Every artifact has: `artifactId`, `contentHash`, `sourceUrl`, `retrievedAt`
- Canonical references stored in `CanonicalReferences` (immutable)
- Evidence packages preserve original source metadata
- Content hashes: SHA-256 via `computeContentHash()`

### Data Validation
- Zod schemas for all external input (feeds, API responses, file content)
- TypeScript types inferred from Zod (`z.infer<typeof Schema>`)
- JSON Schema generated via `z.toJSONSchema()` for interop
- No `any` types in public APIs

### Free-Tier Only Inference
- Primary: OpenRouter `nvidia/nemotron-3-ultra-550b-a55b:free`
- Fallback: Nous Portal free models (see `free-llm-client.ts`)
- **Never** use paid models or non-configured endpoints
- Request budgets, retries, caching, checkpoints enforced

## Implementation Rules

### Adding New Pipeline Stages
1. Create subdirectory under `src/lib/` with descriptive name
2. Define Zod schemas in `schemas/` subdirectory
3. Export types from `schema.ts` or `types.ts`
4. Implement deterministic validation functions
5. Add unit tests (`*.test.ts`)
6. Document in `docs/` with ADR if architectural

### Schema Evolution
- Version schemas: `PUBLICATION_SCHEMA_VERSION = '1.0.0'`
- Backward compatibility: never remove fields, only add optional
- Migration scripts in `scripts/` if breaking change required

### Error Handling
- Typed error classes: `RetrievalError`, `ValidationError`, `ProcessingError`
- Error objects include: `code`, `message`, `url`, `timestamp`, `retryable`
- Never swallow errors — propagate with context

### Testing
- Unit tests for pure functions (Vitest)
- Fixture-based tests with deterministic inputs
- No network calls in tests — use mock adapters
- Integration tests via workflow orchestrator in `scripts/`

## Cross-Cutting Concerns

### Security
- All external content treated as untrusted
- No `eval()`, `Function()`, or dynamic code execution
- Content sanitization before rendering
- Rate limiting on external API calls

### Performance
- Streaming/chunked processing for large datasets
- In-memory + persistent caching (SHA-256 keyed)
- Bounded concurrency (max 3 parallel requests)
- Checkpoint persistence for resumable operations

### Observability
- Structured logging with correlation IDs
- Execution manifests for workflow runs
- Metrics: duration, token usage, error rates

## File Naming Conventions
- `*.ts` — Implementation
- `*.test.ts` — Unit tests
- `schema.ts` — Zod schemas & inferred types
- `schemas/*.json` — JSON Schema output
- `types.ts` — Shared type definitions
- `index.ts` — Public exports barrel file

## Forbidden Patterns
- ❌ `any` in public APIs
- ❌ Paid LLM models
- ❌ Untyped external data
- ❌ Hardcoded timezone offsets
- ❌ Mutable global state
- ❌ Network calls in unit tests
- ❌ Secrets in code or config files