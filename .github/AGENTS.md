# AGENTS.md — GitHub Configuration Guidelines

This file contains scoped engineering rules for `.github/`. Load only when working in this directory.

## Workflow Principles

### Least Privilege

- `permissions:` block on every job — minimal required
- `contents: read` default, add `security-events: write` only for CodeQL
- No `pull-requests: write` unless bot automation requires it
- Secrets: only in repository settings, never in workflow files

### Action Pinning

- Pin to full SHA for immutability (e.g., `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683`)
- Exception: Major version tags for official actions (`actions/checkout@v4`) when SHA tracking is impractical
- Dependabot configured for weekly updates

### Concurrency Control

- Cancel in-progress runs for same ref: `concurrency: group: ${{ github.workflow }}-${{ github.ref }}`
- Prevents queue buildup and resource waste

### Timeout Limits

- Every job has `timeout-minutes:` (default 15-30 min)
- Prevents runaway workflows consuming free minutes

## Workflow Structure

### CI Pipeline (`.github/workflows/ci.yml`)

Jobs (in dependency order):

1. `lint-and-typecheck` — Prettier, ESLint, Markdownlint, Astro Check
2. `test` — Vitest unit tests
3. `build` — Production build (needs lint + test)
4. `accessibility` — Playwright + axe-core (needs build)
5. `dependency-audit` — pnpm audit (independent)
6. `secret-scan` — Gitleaks (independent)
7. `commitlint` — PR commit messages (PR only)
8. `branch-name` — PR branch validation (PR only)

### Security Scanning (`.github/workflows/codeql.yml`)

- Matrix: TypeScript, JavaScript
- Queries: `security-and-quality` extended
- Schedule: Weekly Monday 06:00 UTC
- Permissions: `security-events: write`

### Super-Linter (`.github/workflows/super-linter.yml`)

- `VALIDATE_ALL_CODEBASE: false` (changed files only)
- Config files: `.markdownlint.json`, `.yamllint.yml`, `eslint.config.js`
- Excludes: `dist/`, `.astro/`, `node_modules/`, `data/`

### SonarCloud (`.github/workflows/sonarcloud.yml`)

- Placeholders: `SONAR_PROJECT_KEY`, `SONAR_ORGANIZATION` (GitHub Secrets)
- Requires: `SONAR_TOKEN` secret
- Not mandatory until project connected

## Required Status Checks (Branch Protection)

When branch protection is enabled, these checks must pass:

- `Lint & TypeCheck`
- `Unit Tests`
- `Build`
- `Accessibility Tests`
- `Dependency Audit`

## Dependabot (`.github/dependabot.yml`)

- Weekly Monday 06:00 Europe/Amsterdam
- Groups: `astro-ecosystem`, `dev-tools`, `linting`
- Labels: `dependencies`, `pnpm` / `github-actions`
- Commit prefix: `chore(deps)` / `chore(ci)`

## PR Template (`.github/pull_request_template.md`)

Required sections:

- Description & scope
- Related area (checkboxes)
- Changes made
- Architecture impact
- Security impact
- Validation evidence (checkboxes)
- Accessibility impact
- Breaking changes
- Stack dependencies
- Changelog impact
- Reviewer checklist

## CODEOWNERS (`.github/CODEOWNERS`)

- Global: `@sjefsharp`
- Per-directory ownership matching bounded contexts
- All PRs require review from code owner

## Repository Settings (Manual Configuration)

- **Branch protection**: `master` — require PR, require status checks, require linear history
- **Rulesets**: Import `.github/conventional-branch-ruleset.json` via **Settings → Rules → Rulesets → New ruleset → Import a ruleset** (or `gh api repos/OWNER/REPO/rulesets --method POST --input .github/conventional-branch-ruleset.json`). Start with `"enforcement": "evaluate"` to audit, then switch to `"active"`. Rulesets are available on public repositories with every plan, and on private repositories with GitHub Pro, Team, and Enterprise Cloud.
- **Secrets**: `OPENROUTER_API_KEY`, `NOUS_API_KEY`, `SONAR_TOKEN`, `SONAR_PROJECT_KEY`, `SONAR_ORGANIZATION`
- **Environments**: `production` (for deployment)
- **Actions permissions**: Allow all actions (verified creators only)

## Forbidden Patterns

- ❌ `pull_request_target` without explicit justification
- ❌ Self-hosted runners without approval
- ❌ Secrets in workflow files or logs
- ❌ Unpinned action versions (except major tags)
- ❌ Workflows without `timeout-minutes`
- ❌ `permissions: write-all` or broad permissions
- ❌ Paid GitHub features without approval
