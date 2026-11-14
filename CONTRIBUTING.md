# Contributing to AI Intelligence Blog

Thank you for contributing. This document describes the development workflow, conventions, and expectations for this repository.

## Development Setup

### Prerequisites

- Node.js ≥ 22.23.4
- pnpm ≥ 9.0.0
- Git ≥ 2.40

### Installation

```bash
git clone https://github.com/<owner>/ai-intelligence-blog.git
cd ai-intelligence-blog
pnpm install --frozen-lockfile
```

### Git Hooks

This repository uses **Lefthook** for Git hooks. Install once:

```bash
pnpm exec lefthook install
```

Hooks configured:

- **pre-commit**: Format, lint, type-check staged files
- **commit-msg**: Conventional Commits validation
- **pre-push**: Build and type-check

## Trunk-Based Development

We follow [Trunk-Based Development](https://trunkbaseddevelopment.com/):

- **One authoritative trunk**: `master` (protected, deployable, linear history)
- **Short-lived branches**: `feat/<short-name>`, `fix/<short-name>`, `chore/<short-name>`
- **Frequent integration**: Merge or rebase within 2 days
- **Small reviewable changes**: Single logical concern per PR
- **No permanent development branches**
- **Feature flags** when necessary for incomplete work

## Branch Naming

Follow [Conventional Branch](https://conventionalbranch.org/):

```
<type>/<short-description>
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `a11y`, `security`

Examples:

- `feat/editorial-validation`
- `fix/accessibility-navigation`
- `chore/repository-governance`

## Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) with [Gitmoji](https://github.com/carloscuesta/gitmoji/blob/master/packages/gitmojis/src/gitmojis.json):

```
<type>(<scope>): <gitmoji> <imperative summary>

[optional body: motivation, context, breaking changes]

[optional footer: Closes #123, Breaking: ...]
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `build`, `ci`, `a11y`, `security`

**Scope**: Component, page, or system affected (e.g., `header`, `blog-layout`, `content-schema`, `deps`)

**Gitmoji** (authoritative catalog): Must not replace Conventional Commit type.

Examples:

```
feat(editorial): ✨ implement provenance validation
fix(accessibility): ♿ correct keyboard focus order
chore(ci): 👷 configure quality checks
docs(readme): 📝 update deployment instructions
refactor(components): ♻️ extract shared masthead logic
```

Validate locally: `pnpm exec commitlint --edit`

## Worktree Usage

For parallel development, use the shared sibling worktree container:

```
~/projects/
├── ai-intelligence-blog/           # Main worktree (master)
└── ai-intelligence-blog.worktrees/ # Sibling container
    ├── governance/
    ├── quality/
    └── editorial/
```

Create a worktree:

```bash
git worktree add ../ai-intelligence-blog.worktrees/feature-name feat/feature-name
```

Rules:

- One sibling container per repository
- No worktrees inside the main repository
- Preserve uncommitted work before switching
- Verify `git status` before and after changes

## Pull Requests

### Independent PRs (Preferred)

For changes that can be reviewed and integrated independently:

- Create feature branch from `master`
- Implement, validate, commit
- Push and open PR targeting `master`
- Human review required before merge
- Squash merge (one commit per logical change)
- Delete branch after merge

### Stacked PRs (When Dependencies Exist)

Use `gh stack` only when changes have actual dependencies:

```
main
  |
  +-- chore/repository-standards
        |
        +-- chore/git-hooks
              |
              +-- chore/quality-foundation
```

Each PR must contain only its intended incremental diff.

Install `gh stack`:

```bash
gh extension install github/gh-stack
```

## PR Template

All PRs must address the template in `.github/pull_request_template.md`:

- Purpose and scope
- Relevant technical/domain area
- Changes made
- Architecture impact
- Security impact
- Validation evidence
- Accessibility impact
- Breaking changes
- Stack dependencies
- Changelog impact
- Reviewer checklist

## Review Expectations

- **Author**: Self-review before requesting review; ensure CI passes
- **Reviewer**: Verify correctness, architecture alignment, security, accessibility
- **Merge**: Squash merge to `master` after approval; CI must pass
- **No automatic merges** — human approval required

## Formatting and Linting

```bash
# Check formatting (Prettier)
pnpm format:check

# Apply formatting
pnpm format

# Lint (ESLint + Markdownlint + YAML/JSON validation)
pnpm lint

# Type-check
pnpm astro check
```

Pre-commit hooks run these on staged files automatically.

## Testing

```bash
# Unit tests (Vitest)
pnpm test

# Accessibility tests (Playwright + axe-core)
# Requires dev server: astro dev --background
pnpm exec playwright test

# Full test suite
pnpm test && pnpm exec playwright test
```

## Validation Gates (Must Pass Before Merge)

| Gate                      | Command                                   | Failure = Block Merge |
| ------------------------- | ----------------------------------------- | --------------------- |
| TypeScript + Astro Check  | `pnpm astro check`                        | ✅                    |
| Production Build          | `pnpm run build`                          | ✅                    |
| Accessibility (automated) | `pnpm exec playwright test`               | ✅                    |
| Dependency Audit (prod)   | `pnpm audit --prod`                       | ✅ (high/critical)    |
| Dependency Audit (dev)    | `pnpm audit --dev`                        | ⚠️ (warn only)        |
| Link Check (optional)     | `pnpm exec lychee --fail-on-error ./dist` | ⚠️                    |

## Accessibility Standards

Target: **WCAG 2.2 AA Minimum**

- Semantic HTML landmarks (`<header>`, `<nav>`, `<main>`, `<article>`, `<footer>`)
- Heading hierarchy (single `<h1>`, no skipped levels)
- Color contrast ≥ 4.5:1 text, ≥ 3:1 large text/UI
- Focus visible on all interactive elements
- Keyboard navigation (Tab/Enter/Space)
- ARIA only when native HTML insufficient
- Alt text on all images (empty `alt=""` for decorative)
- Reduced motion support
- 200% zoom reflow, no horizontal scrolling

Validate with: `pnpm exec playwright test`

## Security Rules

- **No secrets in repo** — ever
- **Local**: `.env.local` (gitignored) for OpenRouter/ Nous keys only
- **CI/CD**: Repository secrets only
- **Dependencies**: `pnpm audit --prod` before releases; fail on high/critical
- **No paid services** without explicit approval

## Documentation Standards

- Update `README.md` for user-facing changes
- Update `CHANGELOG.md` under "Unreleased" for notable changes
- Update `AGENTS.md` for agent-relevant engineering rules
- Create ADRs (`docs/adr/`) for significant architectural decisions
- Keep nested `AGENTS.md` files in sync with directory responsibilities

## Release Conventions

- **Semantic Versioning** (https://semver.org/)
- **Keep a Changelog** (https://keepachangelog.com/en/1.1.0/)
- Human approval required for releases
- Tag format: `v<major>.<minor>.<patch>`
- Release notes from CHANGELOG

## Agent Skills

Reusable procedures are encoded as Agent Skills in `.hermes/skills/` (symlinked from `~/.agents/skills/`). Load with `skill_view(name)`.

## Getting Help

- Check existing documentation in `docs/`
- Review `AGENTS.md` and nested `AGENTS.md` files
- Search skills: `skill_view('skill-name')`
- Open a GitHub Discussion for questions

---

**Remember**: This is a governed repository. Follow the conventions. Keep changes small. Validate before pushing. Humans approve merges.
