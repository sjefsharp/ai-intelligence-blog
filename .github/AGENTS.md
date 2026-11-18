# GitHub automation — scoped instructions

Scope: `.github/**`; inherit repository root `AGENTS.md`. Applicable when changing workflows, branch rules, CODEOWNERS or PR automation.

## Source map

- `.github/workflows/ci.yml`: full repository checks and stable job names.
- `.github/workflows/super-linter.yml`: complementary linting; do not overlap incompatible ESLint/Markdownlint owners.
- `.github/workflows/codeql.yml`: security analysis; `.github/workflows/sonarcloud.yml`: external advisory scan if configured.
- `.github/commit-check.toml`: branch-name rules; `commitlint.config.cjs`: actual commit grammar.
- `.github/conventional-branch-ruleset.json`: **proposal** only; effective rules live in GitHub repository settings.
- `.github/CODEOWNERS` and `.github/pull_request_template.md`: declared ownership and review evidence, not proof of enforced Code Owner approval.

## Operational checks

1. **Before editing any workflow:** inspect workflow on PR head and base, the actual status-check names, effective ruleset, event filters and failing run logs.
2. **If Actions appear missing:** inspect PR mergeability first. At reviewed PR #20 SHA `d13daa6`, GitHub reported merge conflicts; `pull_request` workflows may not run until those are resolved. Do not weaken triggers before testing that hypothesis.
3. **If adopting stacked PRs:** `pull_request` filtered to `main` does **not** cover upper PRs targeting feature branches. Require CI for each layer, verify actual run creation, and review trigger permissions before broadening filters.
4. **For a workflow change:** run applicable syntax/static checks, open a scoped PR, then verify an actual event creates the intended job(s). Record run URL, SHA, job conclusion and any missing status context. A valid YAML file alone is not an acceptance test.
5. **Before merge/release:** compare all required check names with the _current_ GitHub ruleset; all must be green for the final SHA and human review must satisfy the enforced policy.

## Invariants

- Minimal `permissions`, vetted immutable action SHAs, bounded `timeout-minutes`, no exposed tokens or secrets in logs. Avoid `pull_request_target` for executing untrusted PR code.
- Do not use `continue-on-error` or shell masking to turn a required failure green. Differentiate required from optional SonarQube/other checks.
- Do not rename required job contexts without updating and testing the GitHub ruleset.
- Keep branch prefix policies consistent across `.github/commit-check.toml`, `lefthook.yml`, `CONTRIBUTING.md` and effective remote settings; validator allowlists **currently differ**.
- Commit/branch checks are enforced by tools, not by prose. Dependabot/bot branch behavior requires a real test, not an assumption.
- Daily schedule target is **05:00 Europe/Amsterdam**, but a fixed UTC cron cannot meet that time in both CET and CEST. Discover the actual scheduler before proposing changes; verify one publication per local edition, including DST and late runs.

## Review hotspots

- The reviewed `main` ruleset required five CI status checks and one approval, but **not** Code Owner approval. Report the difference from committed guidance; do not change GitHub settings without approval.
- `ci.yml` currently has `pull_request.branches: [main]`; check actual stack-layer coverage before using `gh stack`.
- `sonarcloud.yml` relies on `SONAR_TOKEN`; credential availability and advisory status are not proved by workflow presence.

Reference: `https://docs.github.com/en/actions`; `https://github.com/github/gh-stack`.
