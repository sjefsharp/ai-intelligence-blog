# CLI adapters — scoped instructions

Scope: `scripts/**`; inherit root `AGENTS.md`. Use this when changing commands that invoke domain processing, verification or publication.

## Discover the existing interface

- `package.json` defines supported command names; the specific `scripts/*.ts` parser defines arguments. **Do not invent flags or substitute a similarly named command.**
- Workflow entry: `scripts/run-workflow.ts`; acceptance entry: `scripts/run-acceptance.ts`.
- Publication: `scripts/build-publication.ts`, `scripts/validate-publication.ts`; domain validation and evaluation scripts are also listed in `package.json`.
- `src/lib/workflow-orchestrator/graph.ts` defines stage dependencies; do not maintain a parallel stage registry in scripts.

## Trigger → action → verification

| Trigger                           | Action                                                                      | Verification                                                                    |
| --------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| CLI flag/interface changes        | Read current argument parser and `package.json`; update both where required | Assert successful and invalid-argument outcomes in a targeted CLI test          |
| PLAN / VALIDATE / DRY_RUN touched | Inspect supported mode contract and call paths before modifying             | No unapproved inference, canonical publication or external side effects         |
| EXECUTE/resume touched            | Preserve stable edition/run IDs, checkpoints, and expected output paths     | Re-run same edition safely; no duplicate or partial canonical publication       |
| Provider/network unavailable      | Return structured failure, preserve checkpoints and respect retry budget    | Nonzero exit for blocking failures; no fabricated output or unapproved fallback |
| Command ready for commit          | Run affected unit/CLI tests and existing hooks                              | Report exact command, exit code, output and remaining blockers                  |

## Boundaries

- Keep input parsing, logging, command exit status and side effects in CLI adapters; editorial classification, source validation, selection and publication rules belong to `src/lib/`.
- Node >=22.23.4, TypeScript ESM. Invoke the **existing** `pnpm run <script>` or `pnpm exec tsx scripts/<file>.ts` only after checking its declaration and flags.
- Apply schemas to inputs/outputs; use Amsterdam-aware edition dates from existing domain code. Never convert invalid data into success defaults.
- Retry only transient failures with bounded attempts; no retry loop for deterministic schema failures. Preserve actionable error context, no credentials in logs.
- Respect the current shared inference client (`src/lib/free-llm-client.ts`); **do not modify providers, fallback order, terms or payment settings** as part of an agent-instructions review.
- No raw `process.exit` in domain utilities; choose CLI exit code after resource cleanup. Prefer atomic persistence for canonical artifacts.

## Consult only when relevant

- `docs/ai-intelligence-contract.md`: publication outputs and acceptance; note the **unresolved** schedule mismatch in that file.
- `src/lib/workflow-orchestrator/{graph,engine,schema}.ts`: phase/execution contracts.
- `src/lib/publication/{schema,store,paths}.ts`: publication format and identity.
- `src/lib/editorial-window.ts`: time boundaries and DST.
- Tests colocated under `src/lib/**` and `package.json` for actual runnable commands.
