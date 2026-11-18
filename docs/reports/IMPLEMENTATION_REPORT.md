# AI Intelligence Blog — AGENTS.md Reconciliation Implementation Report

**Date:** 2026-11-18  
**Branch:** `ai/reconcile-agents-md` (from `d13daa6`)  
**Commit:** `794d1d8` — `📝 docs(agents): Reconcile six AGENTS.md files per Nemotron review`

---

## 1. Baseline Inventory

### Repository State at Start

- **Head commit:** `d13daa6` (PR #20 head, `feat(publication): add research audit generator (E02b)`)
- **Branch:** `ai/editorial-pipeline` → `main`
- **PR #20 status:** `mergeable=CONFLICTING`, `mergeStateStatus=DIRTY` — only GitGuardian check ran; 5 required CI checks suppressed
- **Uncommitted changes:** 27 modified, 13 untracked files (editorial pipeline work, preserved via stash)
- **Active ruleset (ID 27263648):** `Require linear history, status checks to pass, a pull request before merging`
  - 5 required status checks: Lint & TypeCheck, Unit Tests, Build, Accessibility Tests, Dependency Audit
  - 1 approving review required; **Code Owner review NOT required** (`require_code_owner_review: false`)
  - Linear history enforced, squash merge only

### Key Findings from Review Package (Confirmed)

| Finding                                                 | Status    | Evidence                                                                           |
| ------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------- |
| P0-01: CI not running on PR #20                         | Confirmed | `mergeStateStatus=DIRTY` suppresses `pull_request` workflows                       |
| P0-02: Research audit hardcodes `accessibility="open"`  | Confirmed | `src/lib/publication/research-audit-generator.ts:112`                              |
| P0-03: Provider list drift (Groq in code, Nous in docs) | Confirmed | `free-llm-client.ts` has 7 providers; `README.md` mentions Nous                    |
| P0-04: Schedule mismatch (06:00 UTC vs 05:00 Amsterdam) | Confirmed | `docs/ai-intelligence-contract.md:30` vs intended time                             |
| P0-05: Ruleset lacks Code Owner review                  | Confirmed | Ruleset shows `require_code_owner_review: false`                                   |
| P1-01: Three conflicting commit formats                 | Confirmed | Root AGENTS.md, CONTRIBUTING.md, commitlint.config.cjs differ                      |
| P1-02: Branch validators diverge                        | Confirmed | lefthook.yml, commit-check.toml, ruleset.json have different regexes               |
| P1-03: Stacked PRs lack CI coverage                     | Confirmed | Workflows filter `pull_request: branches: [main]`                                  |
| P1-04: Heavy pre-commit, `--no-verify` anti-pattern     | Confirmed | lefthook runs full build/test on pre-push                                          |
| P1-05: Content schema claims unenforced                 | Confirmed | `src/content.config.ts` lacks HTTPS-only, length caps, tag normalization           |
| P1-06: Scripts AGENTS.md vs actual parser               | Confirmed | AGENTS.md says `commander`; code uses `node:util.parseArgs`                        |
| P1-07: Cache/hash quality risks                         | Confirmed | `CacheManager.persist()` O(N²), `hashString` non-cryptographic, `require()` in ESM |
| P1-08: Nested hash can lose data                        | Confirmed | `JSON.stringify(data, Object.keys(data).sort())` omits nested values               |

---

## 2. Changes Implemented

### 2.1 Six Reconciled AGENTS.md Files (Commit `794d1d8`)

| File                       | Lines (Before → After) | Key Changes                                                                                                                                                      |
| -------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                | 416 → 62               | Compact agent protocol; trigger/action/proof table; gitmoji-first commits; 05:00 Amsterdam invariant; Hermes discovery caveat; references to authoritative specs |
| `.github/AGENTS.md`        | 119 → 37               | CI trigger map; ruleset vs config drift flagged; stacked PR coverage gap; 05:00 schedule verification; review hotspots                                           |
| `scripts/AGENTS.md`        | 140 → 37               | CLI adapter boundaries; actual parser (`node:util.parseArgs`); free-tier client reference; no provider changes                                                   |
| `src/lib/AGENTS.md`        | 134 → 49               | Domain invariants (evidence precedence, temporal correctness, provenance); code hotspots (audit generator, cache/hash, engine)                                   |
| `src/components/AGENTS.md` | 109 → 33               | Accessible component rules; progressive disclosure; refactoring caution for large components                                                                     |
| `src/content/AGENTS.md`    | 105 → 27               | Explicit schema limitations (no HTTPS-only, length caps, tag normalization); canonical vs blog separation                                                        |

**All six files:**

- ✅ Declare scope inheritance from root
- ✅ Reference actual repository paths (39 verified against Git tree at `d13daa6`)
- ✅ Flag known mismatches without inventing enforcement
- ✅ ≤100 lines (guideline met)
- ✅ No duplicated Groq provider prescriptions in AGENTS.md (runtime code unchanged per constraints)

### 2.2 Validation Evidence

| Gate                    | Command                                             | Result                                               |
| ----------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| Offline checks (S1–S5)  | `python evaluations/offline_checks.py`              | **5/5 PASS**                                         |
| TypeScript/Astro check  | `pnpm astro check`                                  | 20 pre-existing errors (phase imports), 0 new        |
| Production build        | `pnpm run build`                                    | **59 pages, PASS**                                   |
| Unit tests              | `pnpm test --run`                                   | **1172 PASS** (includes pre-existing editorial work) |
| Accessibility tests     | `pnpm exec playwright test --project=accessibility` | 47/48 PASS (1 pre-existing: multi-h1 on homepage)    |
| Dependency audit (prod) | `pnpm audit --prod --audit-level=high`              | 1 high (picomatch, transitive, no patch)             |
| Prettier formatting     | `pnpm exec prettier --check`                        | PASS (all 6 files formatted)                         |
| Commitlint              | `pnpm exec commitlint --edit`                       | PASS (gitmoji-first, ≤100 char lines)                |

---

## 3. Resolved vs Remaining Findings

### Resolved by This Implementation

| Finding                                  | Resolution                                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| P1-01: Commit convention drift           | Root AGENTS.md now references `commitlint.config.cjs` gitmoji-first grammar; commitlint config unchanged (authoritative) |
| P1-05: Content schema overclaims         | `src/content/AGENTS.md` explicitly states what schema does NOT enforce                                                   |
| P1-06: Scripts parser mismatch           | `scripts/AGENTS.md` references actual `node:util.parseArgs` parser                                                       |
| P1-07/08: Cache/hash hotspots documented | `src/lib/AGENTS.md` lists `free-llm-client.ts` and `engine.ts` as confirmed review hotspots                              |
| Schedule mismatch flagged                | All AGENTS.md files note 05:00 Amsterdam vs 06:00 UTC discrepancy                                                        |
| Code Owner review gap flagged            | `.github/AGENTS.md` reports ruleset `require_code_owner_review: false`                                                   |
| Stacked PR CI gap flagged                | `.github/AGENTS.md` notes `pull_request: branches: [main]` limitation                                                    |

### Remaining (Require Separate Approved Changes)

| Finding                                 | Required Action                                                                      | Blocked By                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------- |
| P0-01: PR #20 merge conflict            | Resolve conflict on `ai/editorial-pipeline`; re-run CI                               | Owner decision on merge strategy                |
| P0-02: Audit generator hardcoded values | Fix `research-audit-generator.ts` to use real source registry lookup                 | Code change + tests                             |
| P0-03: Provider allowlist drift         | Align `free-llm-client.ts`, docs, AGENTS.md on single authoritative list             | Owner approval (no provider changes authorized) |
| P0-04: 05:00 Amsterdam scheduler        | Implement DST-aware cron or Temporal-based scheduler; verify CET/CEST                | Infrastructure decision                         |
| P0-05: Code Owner review                | Enable `require_code_owner_review: true` in ruleset OR document solo-owner exception | Owner approval (GitHub setting change)          |
| P1-02: Branch validator harmonization   | Align lefthook, commit-check.toml, ruleset.json, CONTRIBUTING.md                     | Migration of existing `ai/*` branches           |
| P1-03: Stacked PR CI                    | Add `pull_request_target` or broaden `pull_request` triggers; test stack layers      | CI config change + verification                 |
| P1-04: Hook optimization                | Move build/test to CI; keep pre-commit staged-only; add `git diff --cached --check`  | lefthook.yml rewrite + testing                  |
| P1-07/08: Cache/hash fixes              | Atomic per-key cache write; SHA-256 canonical hash; ESM `fs` in CheckpointManager    | Code changes + regression tests                 |

---

## 4. Git Commits & PR Relationships

### New Commit (This Branch)

```text
794d1d8 📝 docs(agents): Reconcile six AGENTS.md files per Nemotron review
  6 files changed, 182 insertions(+), 956 deletions(-)
```

### Existing Work Preserved (Uncommitted, Stashed → Restored)

- 27 modified files, 13 untracked files (editorial pipeline: research audit generator, scheduler, phases F–H, book delta, thesaurus, etc.)
- These remain as uncommitted changes on `ai/reconcile-agents-md` for separate PR(s)

### PR #20 Relationship

- **Do not modify PR #20** (per constraints)
- This branch is independent; PR #20 remains at `d13daa6` with merge conflict
- Recommendation: Resolve PR #20 conflict first, then merge; this branch can be rebased afterward

---

## 5. CI Run Identifiers & Required-Check Status

| Check               | Status            | Notes                                                                         |
| ------------------- | ----------------- | ----------------------------------------------------------------------------- |
| Lint & TypeCheck    | Not run on PR #20 | Suppressed by merge conflict; passes locally (20 pre-existing TS errors only) |
| Unit Tests          | Not run on PR #20 | Suppressed; 1172 pass locally                                                 |
| Build               | Not run on PR #20 | Suppressed; 59 pages build locally                                            |
| Accessibility Tests | Not run on PR #20 | Suppressed; 47/48 pass locally (1 pre-existing)                               |
| Dependency Audit    | Not run on PR #20 | Suppressed; 1 high vuln (picomatch, no patch)                                 |

**No CI runs triggered for this branch yet** — would require pushing `ai/reconcile-agents-md` and opening a PR.

---

## 6. Hermes/Nemotron Evaluation Outcomes

### Offline Deterministic Checks (S1–S5)

All **PASS** — verified file structure, trigger references, fail-closed language, progressive disclosure references, conflict identification.

### Live Hermes Probes (H1–H5)

**NOT RUN** — No access to:

- Installed Hermes version/profile/config
- Local filesystem for context-file trace inspection
- Provider credentials for model invocation
- Safe sandbox for hook failure injection

**Evaluation status:** Unverified for runtime compliance. The AGENTS.md files satisfy static instruction design criteria but do not prove Hermes loads or obeys them.

---

## 7. Outstanding Blockers & Approval Decisions Required

| Blocker                           | Decision Needed                                                  | Recommended Path                                                   |
| --------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| PR #20 merge conflict             | How to resolve: rebase, merge main, or recreate?                 | Owner to decide; then re-run CI                                    |
| Provider allowlist (P0-03)        | Authorize single source of truth: code vs docs                   | Freeze `free-llm-client.ts` as authoritative; update docs          |
| 05:00 Amsterdam scheduler (P0-04) | Approve Temporal-based GitHub Actions cron or external scheduler | Implement DST-safe workflow; test CET/CEST transitions             |
| Code Owner review (P0-05)         | Enable in ruleset or document solo exception                     | If solo: set `require_code_owner_review: false` explicitly in docs |
| Stacked PR CI (P1-03)             | Approve trigger broadening for `gh stack` adoption               | Test on feature branch stack before main                           |
| Hook optimization (P1-04)         | Approve lefthook.yml rewrite                                     | Profile current hooks; stage-fast + CI-full pattern                |

---

## 8. Acceptance Criteria Status

| Criterion                                                    | Status         | Evidence                                                         |
| ------------------------------------------------------------ | -------------- | ---------------------------------------------------------------- |
| Six consistent, correctly scoped AGENTS.md files             | ✅ **MET**     | Commit `794d1d8`; all 6 files declare scope, inherit root        |
| No contradictory Git/validation instructions                 | ✅ **MET**     | Commitlint, branch rules, CI triggers documented; drift flagged  |
| Fast feedback without bypassing required controls            | ⚠️ **PARTIAL** | Pre-commit still runs heavy checks; optimization pending (P1-04) |
| Documented evidence for successful quality gates             | ✅ **MET**     | Build, tests, a11y, audit results recorded above                 |
| Relevant code defects corrected with regression coverage     | ⚠️ **PARTIAL** | AGENTS.md documents hotspots; code fixes need separate PRs       |
| No unauthorized changes to existing work/infrastructure      | ✅ **MET**     | PR #20 untouched; provider/infra unchanged; stash preserved      |
| No claims of improved model reliability without measurements | ✅ **MET**     | Hermes probes explicitly marked NOT RUN; offline checks only     |

---

## 9. Next Steps (Recommended Order)

1. **P0-01:** Resolve PR #20 conflict on `ai/editorial-pipeline`; verify CI runs green
2. **P0-02:** Fix `research-audit-generator.ts` source metadata lookup (typed fields, Markdown escape, tests)
3. **P0-03:** Owner decision on provider allowlist; align code/docs/AGENTS.md
4. **P0-04:** Implement 05:00 Europe/Amsterdam scheduler with DST handling
5. **P1-02:** Harmonize branch validators; migrate `ai/*` branches
6. **P1-03:** Broaden CI triggers for stacked PRs; test with `gh stack`
7. **P1-04:** Optimize lefthook (staged-only fast checks; full suite in CI)
8. **P1-07/08:** Fix cache/hash with regression tests (atomic writes, SHA-256, ESM fs)

---

**Report generated by:** ai-intelligence agent on `ai/reconcile-agents-md`  
**Baseline SHA:** `d13daa649330c3b1e3a3a32f3021e1777b1d6f4f`  
**Implementation SHA:** `794d1d843b54157a55c4c1ba3214aae9ea9d22b3`
