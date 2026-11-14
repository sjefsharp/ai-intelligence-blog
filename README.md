# AI Intelligence Blog

> Architectural reasoning for AI-intensive systems. Evidence-first. ADHD-friendly by structure. Written by a system architect for system architects.

A professionally governed, multilingual (English/Dutch) Astro static site for publishing AI intelligence analysis with rigorous editorial standards, provenance tracking, and accessibility compliance.

## Features

- **Multilingual**: English and Dutch with proper `hreflang` and localized routing
- **Evidence-first editorial pipeline**: Source discovery → verification → synthesis → publication
- **WCAG 2.2 AA compliant**: Semantic HTML, keyboard navigation, focus management, contrast ratios
- **ADHD-friendly**: Reduced motion, reading mode, progressive disclosure, structured layouts
- **Theme system**: System/light/dark with persistence and print styles
- **Content collections**: Type-safe frontmatter with Zod validation
- **RSS & Sitemap**: Automatic generation for SEO and syndication
- **Local fonts**: Atkinson (reading) + JetBrains Mono (structural) — no external requests
- **Free-tier only**: OpenRouter (Nemotron 3 Ultra) + Nous Portal for AI inference

## Technology Stack

| Layer           | Technology                                                       |
| --------------- | ---------------------------------------------------------------- |
| Framework       | Astro 7+ (static site generation)                                |
| Runtime         | Node.js ≥ 22.23.4 (ESM only)                                     |
| Package Manager | pnpm only                                                        |
| Language        | TypeScript (strict), Astro components, MDX                       |
| Styling         | CSS Custom Properties (no framework)                             |
| Content         | Astro Content Collections + Zod                                  |
| Fonts           | Local (Atkinson, JetBrains Mono) via Astro Fonts                 |
| Testing         | Vitest (unit), Playwright + axe-core (a11y/e2e)                  |
| CI/CD           | GitHub Actions                                                   |
| Deployment      | Static hosting (Netlify, Vercel, Cloudflare Pages, GitHub Pages) |

## Architecture Overview

```text
Content (src/content/blog/*.md)
  → Content Collections Loader (glob)
  → Zod Schema Validation
  → Typed CollectionEntry<'blog'>
  → Page Components (src/pages/[lang]/blog/[...slug].astro)
  → Layout (src/layouts/BlogPost.astro)
  → BaseHead (SEO, OG, Twitter cards)
  → Static HTML + Assets (dist/)
```

**Editorial Pipeline** (in `src/lib/`):

- `collection/` — Source acquisition (RSS, ArXiv, GitHub)
- `editorial-window.ts` — Temporal correctness (Amsterdam timezone)
- `historical-regression/` — 7-day regression analysis
- `omission-review/` — Coverage gap detection
- `evidence-verification/` — Source provenance validation
- `editorial-selection/` — Story curation
- `fact-dossier/` — Evidence compilation
- `publication/` — Edition assembly and validation
- `publication-acceptance/` — Multi-gate quality acceptance
- `signal-desk/` — Real-time signal processing
- `novelty-classification/` — Publication-date-based novelty
- `book-delta/` — Knowledge continuity across editions
- `workflow-orchestrator/` — Pipeline execution coordination

## Prerequisites

- Node.js ≥ 22.23.4
- pnpm ≥ 9.0.0
- Git ≥ 2.40

## Installation

```bash
# Clone the repository
git clone https://github.com/<owner>/ai-intelligence-blog.git
cd ai-intelligence-blog

# Install dependencies (frozen lockfile — CI safe)
pnpm install --frozen-lockfile
```

## Local Development

```bash
# Start development server (background mode)
astro dev --background

# Or run in foreground
pnpm run dev
```

Visit `http://localhost:4321/en/` for English or `http://localhost:4321/nl/` for Dutch.

## Build and Testing

```bash
# Production build
pnpm run build

# Preview production build locally
pnpm run preview

# Type-check (Astro + TypeScript)
pnpm astro check

# Run unit tests
pnpm test

# Run accessibility tests (requires dev server running)
pnpm exec playwright test

# Full local validation (pre-push checklist)
pnpm install --frozen-lockfile
pnpm astro check
pnpm run build
pnpm exec playwright test
```

## Environment Configuration

Create `.env.local` for local development (never committed):

```env
# OpenRouter (free tier only)
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free

# Nous Portal (free tier fallback)
NOUS_API_KEY=...
NOUS_BASE_URL=https://inference.nousresearch.com/v1
```

See `.env.example` for all available configuration options.

## Localization

The site supports two locales with prefix-default-locale routing:

- `/en/` — English (default)
- `/nl/` — Dutch

All user-facing strings are in `src/i18n/en.ts` and `src/i18n/nl.ts`. Add new translations to both files.

Language switching is handled by the `LangToggle` component in the masthead.

## Deployment

### Static Hosting (Recommended)

Deploy the `dist/` output to any static host:

#### Netlify

```toml
# netlify.toml
[build]
  command = "pnpm run build"
  publish = "dist"
```

#### Vercel

```json
// vercel.json
{
  "buildCommand": "pnpm run build",
  "outputDirectory": "dist",
  "framework": "astro"
}
```

#### Cloudflare Pages

- Build command: `pnpm run build`
- Output directory: `dist`
- Node version: `22`

#### GitHub Pages

- Use `actions/deploy-pages` workflow
- Set Pages source to "GitHub Actions"

### Environment Variables (Production)

Configure in your hosting provider's dashboard:

- `OPENROUTER_API_KEY` (if using AI features at build time)
- `NOUS_API_KEY` (fallback)
- `SITE_URL` (canonical URL, e.g., `https://your-domain.com`)

## Security

- **No secrets in repository** — ever
- **Local development**: `.env.local` (gitignored)
- **CI/CD**: Repository secrets only
- **Dependency audit**: `pnpm audit --prod` before releases
- **Content Security Policy**: Compatible with `script-src 'self'`
- **External links**: `rel="noopener noreferrer"` enforced

See [SECURITY.md](SECURITY.md) for vulnerability disclosure.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow, branch conventions, commit standards, and review expectations.

## License

See [LICENSE](LICENSE) for licensing terms.

## Support

See [SUPPORT.md](SUPPORT.md) for troubleshooting and support channels.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.
