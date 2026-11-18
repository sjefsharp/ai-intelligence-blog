# AGENTS.md — Architecture & Operating Rules

This file is the single source of truth for how autonomous agents (and humans) work in this repository. It is **not** documentation — it is executable policy. Every agent must load and follow it before acting.

---

## 1. Project Identity

- **Name**: ai-intelligence-blog
- **Type**: Astro 7+ static site (blog, content-driven)
- **Runtime**: Node.js ≥ 22.23.4 (ESM only)
- **Package Manager**: **pnpm only** — `npm` and `yarn` are forbidden
- **Language**: TypeScript (strict), Astro components, MDX content
- **Deploy Target**: Static hosting (Netlify, Vercel, Cloudflare Pages, GitHub Pages — no server runtime)

---

## 2. Architecture

### 2.1 High-Level Structure

```text
├── public/                    # Static assets served as-is
├── src/
│   ├── assets/                # Fonts, images processed by Astro
│   ├── components/            # Reusable .astro components (Header, Footer, BaseHead, etc.)
│   ├── content/               # Content collections (blog posts in Markdown/MDX)
│   │   └── blog/              # Blog collection — typed via content.config.ts
│   ├── layouts/               # Page shells (BlogPost.astro, etc.)
│   ├── pages/                 # File-based routing (index.astro, blog/[...slug].astro, rss.xml.js)
│   ├── styles/                # Global CSS (global.css — CSS custom properties, no Tailwind)
│   ├── consts.ts              # Site-wide constants (SITE_TITLE, SITE_DESCRIPTION)
│   └── content.config.ts      # Content collection schemas (Zod)
├── astro.config.mjs           # Astro config: integrations, fonts, site URL
├── tsconfig.json              # Extends astro/tsconfigs/strict
├── package.json               # Scripts, deps, engines
└── pnpm-lock.yaml             # Lockfile — committed, source of truth
```

### 2.2 Key Architectural Decisions

| Decision                               | Rationale                                                   |
| -------------------------------------- | ----------------------------------------------------------- |
| **No UI framework** (React/Vue/Svelte) | Zero JS by default; Astro components suffice for a blog     |
| **CSS custom properties + global.css** | No build-time CSS framework; minimal, auditable, performant |
| **Local fonts (Atkinson)**             | No external font requests; privacy + performance            |
| **Content Collections + Zod**          | Type-safe frontmatter; compile-time validation              |
| **MDX via @astrojs/mdx**               | Component embedding in content when needed                  |
| **RSS + Sitemap integrations**         | SEO and syndication out of the box                          |
| **Sharp for image optimization**       | Build-time image processing, no runtime cost                |

### 2.3 Data Flow

```text
Content (src/content/blog/*.md)
  → Content Collections Loader (glob)
  → Zod Schema Validation
  → Typed CollectionEntry<'blog'>
  → Page Components (blog/[...slug].astro)
  → Layout (BlogPost.astro)
  → BaseHead (SEO, OG, Twitter cards)
  → Static HTML + Assets (dist/)
```

---

## 3. pnpm-Only Workflow

### 3.1 Mandatory Commands

```bash
# Install (frozen lockfile — CI safe)
pnpm install --frozen-lockfile

# Development (background mode — non-blocking)
astro dev --background

# Build (production)
pnpm run build

# Preview production build locally
pnpm run preview

# Type-check (Astro + TS)
pnpm astro check

# Lint (if configured)
pnpm run lint
```

### 3.2 Forbidden Actions

- ❌ `npm install`, `npm ci`, `npm run …`
- ❌ `yarn install`, `yarn …`
- ❌ Editing `pnpm-lock.yaml` manually
- ❌ Adding dependencies without `pnpm add <pkg>`
- ❌ Using `npx` — use `pnpm exec` or `pnpm dlx` instead
- ❌ Symlink hacks or hard-coded `node_modules/.bin` paths — let the package manager link and resolve its own binaries (`pnpm exec`)
- ❌ Reward hacking in any form — no gaming checks, metrics, rate limits, or tool output; fix the root cause instead

### 3.3 Dependency Policy

- **Production deps only** in `dependencies` (astro, @astrojs/mdx, @astrojs/rss, @astrojs/sitemap, sharp)
- **Dev deps only** in `devDependencies` (@axe-core/playwright, @playwright/test, supabase)
- **No peer dependency hacks** — if a peer is missing, fix the dependency tree
- **Version pinning**: Exact versions for Astro ecosystem packages; `^` for others only when semver is trusted

---

## 4. Accessible Design Standards (WCAG 2.2 AA Minimum)

### 4.1 Non-Negotiable Requirements

| Criterion                    | Implementation                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| **Semantic HTML**            | Use `<header>`, `<nav>`, `<main>`, `<article>`, `<footer>`, `<h1>`–`<h6>` in order |
| **Color Contrast**           | ≥ 4.5:1 text, ≥ 3:1 large text/UI — verify in `global.css` custom properties       |
| **Focus Visible**            | `:focus-visible` outlines on all interactive elements (links, buttons)             |
| **Keyboard Navigation**      | All interactive elements reachable and operable via Tab/Enter/Space                |
| **ARIA Only When Necessary** | Prefer native HTML; `aria-label`/`sr-only` only where semantics are insufficient   |
| **Alt Text**                 | Every `<Image>` and `<img>` has meaningful `alt` (empty `alt=""` for decorative)   |
| **Heading Hierarchy**        | Single `<h1>` per page; no skipped levels                                          |
| **Reduced Motion**           | `@media (prefers-reduced-motion: reduce)` disables transitions/animations          |
| **Zoom/Resize**              | Content reflows at 200% zoom; no horizontal scrolling                              |

### 4.2 Component Checklist (apply to every `.astro` component)

- [ ] Semantic landmark structure
- [ ] Heading order validated
- [ ] Interactive elements have focus styles
- [ ] Images have `alt` (or `alt=""` + `role="presentation"`)
- [ ] Color contrast verified against `--accent`, `--gray-dark`, `--black`
- [ ] No `onclick` on non-interactive elements (`<div>`, `<span>`)
- [ ] Forms: `<label>` associated, error messages via `aria-describedby`

### 4.3 Testing Gates

```bash
# Automated a11y testing (Playwright + axe-core)
pnpm exec playwright test --project=accessibility

# Manual checks per PR:
# - Tab through entire page
# - Screen reader spot-check (NVDA/VoiceOver)
# - 200% zoom in browser
# - prefers-reduced-motion: reduce
```

---

## 5. Git Discipline

### 5.1 Branch Strategy

- **`main`** — protected, deployable, linear history
- **Feature branches** — `feat/<short-name>`, `fix/<short-name>`, `chore/<short-name>`
- **No long-lived branches** — sync with `main` via merge within 2 days (see §5.4)

### 5.2 Commit Conventions

```text
<type>(<scope>): <imperative summary>

[optional body: motivation, context, breaking changes]

[optional footer: Closes #123, Breaking: ...]
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `build`, `ci`, `a11y`, `security`

**Scope**: Component, page, or system affected (e.g., `header`, `blog-layout`, `content-schema`, `deps`)

### 5.3 Branch Naming (Conventional Branch)

Branch names follow the [Conventional Branch](https://conventionalbranch.org/) specification: `<type>/<description>`, lowercase, hyphen-separated.

Types: `feature/` (or `feat/`), `bugfix/` (or `fix/`), `hotfix/`, `release/`, `chore/`. AI-source types: `ai/`, `claude/`, `codex/`, `copilot/`, `cursor/`. `main`, `master` and `develop` take no prefix.

Examples: `feature/add-login-page`, `bugfix/fix-header-overflow`, `release/v1.2.0`, `chore/update-dependencies`, `claude/refactor-auth`.

When you create a branch yourself rather than at a person's direction, prefix it with your own agent name instead — `claude/`, `codex/`, `copilot/`, `cursor/`, or the vendor-neutral `ai/` — so the branch records who wrote it.

### 5.4 Keeping a Branch Current — Merge, Never Rewrite

- When a PR branch is behind `main`, sync it with a merge so history is never rewritten:
  ```bash
  git fetch origin main
  git merge origin/main
  ```
- A merge preserves GitHub/GitLab review diffs and inline comments; do not rebase just to "clean up" a stale branch.
- **Rebase or amend only when explicitly requested**, and only after checking for other authors:
  ```bash
  git log -n 5 --format='%h %an %s'
  ```
  If any commit in that range is authored by someone else, stop and ask — never rewrite shared history solo.

### 5.5 Conflict Resolution

Resolve conflicts by understanding, never by discarding:

- **Read the surrounding context from both sides** before editing, so the intended logic of both the PR and `main` survives.
- **Lockfiles** (`pnpm-lock.yaml` in this repo): accept `main`'s version, then re-run the package manager so it regenerates cleanly:
  ```bash
  git restore --source=origin/main -- pnpm-lock.yaml
  pnpm install
  ```
- ❌ **Never** run `git checkout --ours` or `git checkout --theirs` on source files — teammate changes must never be silently wiped out.
- **Escalate instead of guessing** when conflicts touch database migrations, authentication, billing, or more than 5 files with heavy overlap:
  ```bash
  git merge --abort
  ```
  then hand the conflict to a human before a critical path breaks.
- **Verify before pushing**:
  ```bash
  git diff --check
  grep -rn '<<<<<<<\|>>>>>>>' --exclude-dir=node_modules --exclude-dir=.git .
  pnpm run lint
  pnpm astro check
  pnpm test
  ```
  Only passing code gets pushed.

### 5.6 Push Policy

- After a standard `git merge`, push normally (`git push`) so review diffs and inline comments stay intact.
- After an **approved** rebase or amend, use `git push --force-with-lease` — never `--force` or `-f`.
- If `--force-with-lease` fails with `stale info`, **stop immediately**. Do not fetch and retry; a human must review the newly arrived commits.
- ❌ Never force-push (`--force`, `--force-with-lease`, `-f`) against `main`, `master`, `develop`, or any release branch.

### 5.7 Required Hooks (configure via `pnpm exec husky install` if added)

- **pre-commit**: `pnpm astro check`, `pnpm run lint` (if exists), staged files only
- **commit-msg**: Conventional Commits validation
- **pre-push**: `pnpm run build` must pass

### 5.8 PR / Merge Rules

- Squash merge to `main` (one commit per logical change)
- Delete branch after merge
- No merge commits on `main`
- CI must pass (build, type-check, a11y tests)

---

## 6. Security Boundaries

### 6.1 Secrets Management

- **No secrets in repo** — ever (not in history, not in `.env`, not in code)
- **Local development**: `.env.local` (gitignored) for OpenRouter API key only
- **CI/CD**: Repository secrets (GitHub Actions, Netlify, Vercel) — never in logs
- **Rotation**: Rotate OpenRouter key quarterly; document in private vault

### 6.2 Dependency Security

```bash
# Run before every release
pnpm audit --prod
pnpm audit --dev
```

- **No `supabase` in production** — it is a devDependency only (CLI tooling)
- **Audit CI gate**: Fail build on `high` or `critical` production vulns

### 6.3 Content Security

- **No user-generated content** — blog is author-only
- **No inline scripts** — Astro strips them; CSP `script-src 'self'` compatible
- **External links**: `rel="noopener noreferrer"` on all `target="_blank"` (enforced in Header.astro)
- **Images**: Only local assets or trusted CDN (Astro `Image` component)

### 6.4 AI Model Access (OpenRouter + Groq)

- **Primary Model**: `nvidia/nemotron-3-ultra-550b-a55b:free` via OpenRouter (free tier only)
- **Fallback Models** (in priority order):
  1. OpenRouter — `nvidia/nemotron-3.5-lightning:free`
  2. Groq — `llama-3.3-70b-versatile`
  3. Groq — `llama-3.1-8b-instant`
  4. Groq — `mixtral-8x7b-32768`
  5. Groq — `gemma2-9b-it`
  6. OpenRouter — `nvidia/nemotron-3.5-lightning:free` (alternative)
- **Provider**: OpenRouter (API key in `.env.local` / CI secret) + Groq (API key in `.env.local` / CI secret)
- **Usage**: Read-only inference; no training, no fine-tuning, no data export
- **Rate Limits**: Respect OpenRouter free-tier limits (20 req/min, 50k tokens/min) and Groq free-tier limits (30 req/min, 6000 tokens/min); implement exponential backoff
- **Prohibited**: Any paid model, any non-configured endpoint, any key sharing
- **Fallback Policy**: Automatic sequential fallback through configured free providers; stop gracefully when all exhausted

### 6.5 Free LLM Client Wrapper (src/lib/free-llm-client.ts)

Single entry point for all inference with:

- **Request budgets**: configurable max requests, tokens, cost (always $0)
- **Bounded retries**: exponential backoff with jitter (max 3 attempts, retryable: 408, 429, 5xx)
- **Response caching**: in-memory + persistent (SHA-256 keyed, per-provider)
- **Checkpoint persistence**: resumable operations with step tracking
- **Deterministic operations**: temperature=0, fixed seed for structured tasks
- **Validation mode**: dry-run without API calls
- **Graceful degradation**: stops cleanly when all free providers exhausted, preserves progress
- **Free-only enforcement**: hard-coded $0 cost budget, never uses paid models

---

## 7. Free NVIDIA Nemotron via OpenRouter — Integration Rules

### 7.1 Configuration

```env
# .env.local (never committed)
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
```

### 7.2 Client Wrapper (if added)

```ts
// src/lib/llm.ts — single entry point
export async function callNemotron(prompt: string): Promise<string> {
  const res = await fetch(
    import.meta.env.OPENROUTER_BASE_URL + "/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${import.meta.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://your-site.com",
        "X-Title": "ai-intelligence-blog",
      },
      body: JSON.stringify({
        model: import.meta.env.OPENROUTER_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2048,
      }),
    },
  );
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0]?.message?.content ?? "";
}
```

### 7.3 Usage Constraints

- **No streaming** in static build — use at build time only (e.g., content generation scripts)
- **Cache responses** — avoid duplicate calls; store in `src/content/generated/` if needed
- **Prompt templates** — version-controlled in `src/prompts/`
- **Output validation** — Zod schema on every response before writing to content

---

## 8. Validation Gates (Must Pass Before Merge)

| Gate                          | Command                                             | Failure = Block Merge |
| ----------------------------- | --------------------------------------------------- | --------------------- |
| **TypeScript + Astro Check**  | `pnpm astro check`                                  | ✅                    |
| **Production Build**          | `pnpm run build`                                    | ✅                    |
| **Accessibility (automated)** | `pnpm exec playwright test --project=accessibility` | ✅                    |
| **Dependency Audit (prod)**   | `pnpm audit --prod`                                 | ✅ (high/critical)    |
| **Dependency Audit (dev)**    | `pnpm audit --dev`                                  | ⚠️ (warn only)        |
| **Link Check (optional)**     | `pnpm exec lychee --fail-on-error ./dist`           | ⚠️                    |

### 8.1 Local Pre-Push Checklist

```bash
pnpm install --frozen-lockfile  # ensure lockfile sync
pnpm astro check                # types
pnpm run build                  # build succeeds
pnpm exec playwright test       # a11y + any e2e
```

---

## 9. Prohibition of Paid Services

**Absolute rule**: No paid SaaS, paid APIs, paid hosting tiers, paid CI minutes, paid CDN, paid analytics, paid font services, paid image optimization, or any recurring cost may be introduced without explicit written approval from the repository owner.

### 9.1 Approved Free Tiers Only

| Service                                 | Free Tier Use Case            |
| --------------------------------------- | ----------------------------- |
| **OpenRouter**                          | Nemotron 3 Ultra (free model) |
| **GitHub Actions**                      | Public repo CI (unlimited)    |
| **Netlify / Vercel / Cloudflare Pages** | Static hosting (free tier)    |
| **GitHub Pages**                        | Static hosting (free)         |
| **Let's Encrypt**                       | TLS (automatic via host)      |

### 9.2 Explicitly Forbidden (Without Approval)

- ❌ Supabase paid plan (devDependency CLI only)
- ❌ Algolia / Meilisearch Cloud
- ❌ Sentry / Datadog / LogRocket
- ❌ Cloudinary / Imgix / Uploadcare
- ❌ Google Fonts / Adobe Fonts (use local fonts only)
- ❌ Any "Pro" / "Team" / "Enterprise" tier
- ❌ Custom domains on paid DNS (Cloudflare free is OK)

---

## 10. Agent Operating Protocol

When an agent works in this repo:

1. **Read this AGENTS.md first** — no exceptions
2. **Inspect existing code** — `read_file`, `search_files` before writing
3. **Batch independent operations** — parallel reads, searches, extracts
4. **Edit via `patch` / `write_file`** — never print code blocks as substitute
5. **Verify with terminal** — run build, type-check, tests after changes
6. **Report real output** — never fabricate tool results
7. **Respect boundaries** — no paid services, no secrets, no npm/yarn
8. **Look up current docs** — Context7 first, plus web search/fetch for the authoritative pages (see §11)
9. **Follow documented defaults** — implement fixes exactly as the official documentation and language/tool defaults prescribe; never invent workarounds (symlink hacks, check-gaming, fabricated output). If the documented path cannot work, stop and ask the user before deviating
10. **Merge and push per §5.4–5.6** — merge (never rewrite) to sync, resolve conflicts by reading both sides, push normally unless a rebase/amend was approved

---

## 11. Documentation Lookup — Context7 + Web Sources

**Actionable rule**: before writing code or making a claim about a programming language, library, framework, runtime, or CLI, retrieve current documentation. Use Context7 MCP as the primary structured source **and** web search/fetch to locate the authoritative pages (official docs, specs, release notes). Memory and training data are not authoritative for APIs, defaults, or version-specific behavior.

### 11.1 Mandatory procedure

1. Discover the authoritative source with `web_search` + `web_extract` — search for the concept + library + version, then extract the top official result (docs site, spec, release notes). Prefer primary sources over aggregated blogs.
2. Resolve the exact Context7 library ID:
   `mcp__context7__resolve_library_id(query: "<concept>", libraryName: "<official name>")`
3. Query one concept at a time:
   `mcp__context7__query_docs(libraryId: "<resolved-id>", query: "<specific concept>", language: "TypeScript")`
4. Cross-check: if Context7 and the fetched official page disagree, prefer the official page and note the discrepancy.
5. Version-pin when the answer depends on a version: use `/<org>/<project>/<version>` with the version from `package.json`.
6. Cite the result: any API signature, option, or default you rely on must come from Context7 or the fetched official docs — not from memory.

### 11.2 Source hierarchy

| Question type                                           | First source                                           | Fallback / cross-check          |
| ------------------------------------------------------- | ------------------------------------------------------ | ------------------------------- |
| Language / library / framework / runtime / CLI API      | Context7 MCP                                           | official docs via `web_extract` |
| Platform or vendor behavior (GitHub, OpenRouter, hosts) | Official product docs via `web_search` + `web_extract` | Context7 if indexed             |
| Repository-specific rules                               | this AGENTS.md, scoped `AGENTS.md`, `docs/`            | —                               |

### 11.3 Pitfalls

- Always `resolve_library_id` before `query_docs`; never guess an ID.
- One concept per `query_docs` call; max 3 calls per question.
- Never send secrets, tokens, or private code in a query or search.
- Prefer primary sources (official docs, specs, release notes) over aggregated blog posts; verify the page matches the installed version.
- If Context7 has no coverage, say so explicitly and fall back to the official docs, citing the URL.
- When a docs lookup changes an implementation decision, record the source URL / resolved ID and version in the code comment or PR description.

---

## 12. Change Log

| Date       | Change                                                                                                                                                                                                                                                                                      | Author |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 2026-11-08 | Initial AGENTS.md created from repo inspection                                                                                                                                                                                                                                              | Agent  |
| 2026-11-11 | Added the Seven-Day Historical Regression stage (`src/lib/historical-regression/`, `scripts/run-historical-regression.ts`, `data/schemas/historical-regression.json`, `docs/historical-regression.md`) between Omission Review and Editorial Selection; see `docs/historical-regression.md` | Agent  |
| 2026-11-13 | Implemented Book Delta capability (`src/lib/book-delta/`, `scripts/run-book-delta.ts`, `docs/book-delta.md`) within Knowledge Continuity gate; cleared pre-existing `astro check` backlog (596 → 0 errors), all gates green; see `docs/book-delta.md`                                       | Agent  |

| 2026-11-14 | Added §11 "Documentation Lookup — Context7 + Web Sources" (Context7 MCP plus web search/fetch for authoritative docs, with mandatory procedure and source hierarchy) and §10 item 8 | Agent |
| 2026-11-14 | Added the "no symlink hacks / no reward hacking / follow documented defaults, ask before deviating" rule to §3.2 and §10; CI now installs with corepack + pnpm instead of the deleted `scripts/ci-setup.sh` symlink hack | Agent |
| 2026-11-18 | Added §5.4–5.6 (merge-not-rewrite sync, conflict resolution with lockfile/escalation/verification rules, push policy with `--force-with-lease` and shared-branch protection); renumbered §5.7–5.8; §10 item 10 | Agent |

---

**End of AGENTS.md** — This file is executable policy. Violations are regressions.
