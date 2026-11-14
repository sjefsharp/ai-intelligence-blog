# AGENTS.md — Scripts Guidelines

This file contains scoped engineering rules for `scripts/`. Load only when working in this directory.

## Script Conventions

### Language & Runtime
- **TypeScript** (`.ts`) with `tsx` executor
- **Node.js ≥ 22.23.4** (ESM only)
- Shebang not needed — run via `pnpm tsx scripts/name.ts`

### Entry Points
Each script is a CLI command registered in `package.json`:
```json
"run:workflow": "tsx scripts/run-workflow.ts",
"run:workflow:plan": "tsx scripts/run-workflow.ts --mode PLAN"
```

### Argument Parsing
Use `commander` for CLI interfaces:
```ts
import { Command } from 'commander';

const program = new Command();
program
  .name('run-workflow')
  .option('--mode <mode>', 'Execution mode', 'EXECUTE')
  .option('--edition <date>', 'Edition date (YYYY-MM-DD)')
  .option('--demo', 'Run with demo data')
  .parse();
```

### Exit Codes
- `0` — Success
- `1` — General error
- `2` — Invalid arguments
- `3` — Validation failed
- `4` — External dependency unavailable (rate limit, auth)

### Logging
- Structured JSON logs to stdout for CI parsing
- Human-readable summary to stderr
- Progress indicators for long-running operations
- Verbose mode: `--verbose` or `DEBUG=1`

### Error Handling
- Typed error classes with `code`, `message`, `retryable`
- Graceful degradation: preserve progress, exit cleanly
- No unhandled promise rejections
- Cleanup on SIGINT/SIGTERM

### Determinism
- Fixed seeds for any randomness
- Temperature = 0 for LLM calls
- Cached responses (SHA-256 keyed)
- Checkpoint persistence for resumable ops

### Free-Tier Only
- LLM calls via `createFreeLLMClient()` from `src/lib/free-llm-client.ts`
- Request budgets: max requests, tokens, cost ($0)
- Automatic fallback through configured free providers
- Stop gracefully when all exhausted

### Testing
- Unit tests: `*.test.ts` alongside script (Vitest)
- Integration tests: `--demo` mode with fixture data
- Dry-run mode: `--mode DRY_RUN` or `--validate-only`
- No network calls in unit tests

## Script Categories

### Editorial Pipeline
| Script | Purpose | Key Flags |
|--------|---------|-----------|
| `run-workflow.ts` | Full pipeline orchestration | `--mode PLAN\|VALIDATE\|DRY_RUN\|EXECUTE` |
| `run-acceptance.ts` | Multi-gate quality acceptance | `--mode PLAN\|VALIDATE\|DRY_RUN\|EXECUTE` |
| `run-editorial-selection.ts` | Story curation | `--demo`, `--validate-only` |
| `run-historical-regression.ts` | 7-day regression | `--demo` |
| `run-omission-review.ts` | Coverage gap detection | — |
| `build-fact-dossier.ts` | Evidence compilation | `--demo` |
| `build-publication.ts` | Edition assembly | `--demo` |
| `validate-publication.ts` | Publication validation | — |
| `run-book-delta.ts` | Knowledge continuity | — |
| `run-listening-quality-evaluation.ts` | Audio quality eval | `--demo`, `--validate-only`, `--repair` |
| `run-audio-evaluation.ts` | Audio evaluation | `--demo` |
| `run-listening-narrative.ts` | Listening narrative gen | — |

### Utility Scripts
| Script | Purpose |
|--------|---------|
| `validate-data.ts` | Data integrity checks |
| `validate-fact-dossier.ts` | Fact dossier validation |
| `validate-llm-config.ts` | LLM configuration validation |
| `generate-schemas.ts` | JSON Schema generation |
| `init-thesaurus.js` | Thesaurus initialization (CommonJS) |

## Configuration

### Environment Variables (via `.env.local`)
```env
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
NOUS_API_KEY=...
NOUS_BASE_URL=https://inference.nousresearch.com/v1
```

### Data Directories
- `data/schemas/` — JSON schemas (versioned)
- `data/dossiers/` — Fact dossiers
- `data/publications/` — Edition artifacts
- `data/checkpoints/` — Workflow checkpoints
- `data/llm-cache/` — LLM response cache
- `data/evidence-packages/` — Evidence packages

## Forbidden Patterns
- ❌ `npm`/`yarn` commands (use `pnpm`)
- ❌ Paid LLM models or endpoints
- ❌ Hardcoded secrets or API keys
- ❌ Unbounded loops or recursion
- ❌ Mutable global state across runs
- ❌ Synchronous I/O in hot paths
- ❌ Network calls without timeout/retry
- ❌ `console.log` for structured output (use JSON)
