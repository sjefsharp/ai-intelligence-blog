# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro 7+ (static), TypeScript strict, pnpm, Node ≥ 22.23.4, MDX via @astrojs/mdx, local fonts (Atkinson), CSS custom properties (no framework), Sharp image optimization, GitHub Actions CI, Netlify/Vercel/Cloudflare Pages hosting

## Users

**Primary:** System architects and principal engineers who design, evaluate, and govern AI-intensive systems. They operate at the boundary of software architecture, data engineering, and ML ops. They think in bounded contexts, traceability matrices, and decision records — not prompts.

**Secondary:** Senior engineers stepping into architecture roles; technical leaders (CTOs, VPs Eng, Tech Leads) who need architectural signal without noise.

**Situation:** Evaluating whether an AI capability belongs in their system, and if so, how to bound it, observe it, and evolve it without accumulating technical debt. Time-poor, context-heavy, allergic to hype.

**Job:** Stay current on AI architecture without noise. Build mental models that survive contact with production. Make adoption decisions grounded in evidence, not benchmarks cherry-picked by vendors.

## Product Purpose

A publication that treats AI as a _systems engineering discipline_ — not a magic box, not a chat interface, not a prompt library. Every article applies architectural reasoning: boundaries, contracts, observability, failure modes, evolution paths, cost envelopes.

**Success means:** A reader forwards an article to their team with "this is why we're doing it this way" — not "this is cool." The publication becomes a cited reference in ADRs, RFCs, and architecture review decks.

## Positioning

**The only AI publication written by and for system architects.** Neighboring products (vendor blogs, prompt newsletters, research aggregators, practitioner mediums) cannot truthfully claim:

- Every claim traces to a primary source or reproducible benchmark
- Every pattern includes its failure mode and migration path
- ADHD-friendly by architecture: hierarchy, scannability, and progressive disclosure are _structural_, not cosmetic
- Bilingual (NL/EN) with architectural precision — terminology is deliberate, not decorative
- Zero paid placements, zero affiliate links, zero vendor-influenced framing

## Operating Context

**Author workflow:** Research → Distill → Structure → Publish as MDX in `src/content/blog/`. Content collections enforce frontmatter schema (title, description, pubDate, updatedDate, heroImage). No CMS, no editorial calendar, no external dependencies.

**Reader workflows:**

- _Scan:_ TOC, headings, callouts, code snippets → decide depth
- _Study:_ Full article with citations, references, runnable examples
- _Reference:_ Bookmark pattern catalogs, decision records, evaluation matrices
- _Translate:_ NL/EN toggle per article (future)

**Environment:** Desktop-first reading; mobile for scanning. No JS required for content. Print stylesheet for deep reading.

**Rituals:** Weekly deep-dive (Sunday); monthly pattern catalog update; quarterly architecture review synthesis.

## Capabilities and Constraints

**Confirmed capabilities:**

- Static site: zero server, zero runtime cost, global CDN by default
- Content collections with Zod schemas: type-safe frontmatter, compile-time validation
- MDX: executable code blocks, embedded components, interactive diagrams (future)
- RSS + sitemap + Open Graph: syndication and SEO out of the box
- Local fonts: privacy, performance, zero external requests
- pnpm-only workflow: reproducible installs, locked dependencies
- Accessibility baseline: WCAG 2.2 AA via semantic HTML, contrast, focus management

**Constraints (hard):**

- No paid services (hosting, fonts, analytics, search, CI, CDN, APIs)
- No user-generated content, no comments, no auth, no database
- No third-party scripts (analytics, trackers, chat widgets)
- Build must complete in < 2 min on free CI tier
- Lighthouse 100/100 performance budget
- All content author-owned; no syndication without permission

**Explicitly undecided:**

- NL/EN bilingual toggle implementation (i18n strategy)
- Search implementation (client-side index vs. pagefind vs. none)
- Pattern catalog as separate collection vs. tagged articles
- Newsletter/email distribution (if any — must be free tier)
- Diagram/visualization approach (Mermaid, Excalidraw, custom SVG, plantUML)

## Brand Commitments

**Name:** AI Intelligence Blog (working title; may evolve to reflect "architecture" explicitly)

**Voice:** Precise, modern, editorial, calm, professional. No hype verbs ("supercharge," "unlock," "revolutionize"). No anthropomorphism of models. Active voice. Dutch and English with identical architectural precision.

**Tone markers:**

- "The boundary is…" not "You should…"
- "Evidence: [link]" not "Studies show…"
- "Failure mode: …" not "Watch out for…"
- "Migration path: …" not "Consider…"

**Visual identity:** Greenfield. No committed palette, logo, or type system beyond current Atkinson font. Design must emerge from _Read_ mode requirements: scannability, hierarchy, calm, ADHD-friendly structure.

## Evidence on Hand

**Existing content (style guide):**

- `src/content/blog/markdown-style-guide.md` — author documentation for Markdown conventions (not a verified finding)

The former `first-post.md`, `second-post.md`, `third-post.md` and `using-mdx.mdx` example posts were removed: they carried `github.com/example/...` placeholder sources and unsubstantiated performance claims, so they must not be presented as verified editorial evidence.

**Author assets:**

- Architecture decision records (private, can be sanitized)
- Pattern library (private, code + diagrams)
- Benchmark data (local, reproducible)
- Technical vocabulary (NL/EN glossary)

**Absences (must not fabricate):**

- No case studies with real company names (without explicit permission)
- No benchmarks not reproducible from public artifacts
- No "industry expert" testimonials
- No vendor-provided imagery or copy

## Product Principles

1. **Architecture over aesthetics.** Visual design serves scannability and comprehension; it never leads. If a visual choice cannot be justified by reading ergonomics, it is discarded.

2. **Evidence is structural.** Citations, references, reproducibility artifacts, and failure modes are first-class content elements — not footnotes. The CMS/schema enforces them.

3. **ADHD-friendly by default.** Hierarchy, progressive disclosure, chunking, consistent signposting, and motion reduction are baked into the component system, not bolted on.

4. **Cost discipline as craft.** Zero recurring cost is a design constraint that sharpens decisions: local fonts, static hosting, no third-party SaaS, no build-time services.

5. **Bilingual precision.** Terminology is consistent across NL/EN. Translation is architectural — concepts map 1:1; idioms do not.

## Accessibility & Inclusion

**Standard:** WCAG 2.2 AA minimum (enforced via AGENTS.md gates).

**ADHD-specific requirements (beyond WCAG):**

- Clear heading hierarchy (enforced by content schema)
- Predictable layout: same landmark structure on every article
- Progress indicators: reading time, TOC with scroll position
- Reduced motion: `@media (prefers-reduced-motion: reduce)` disables all transitions
- High contrast mode compatible: CSS custom properties enable user overrides
- No auto-play, no carousels, no popups, no interstitials
- Keyboard navigation: every interactive element reachable and operable
- Focus visible: `:focus-visible` outlines on all links, buttons, code copy buttons

**Language:** Dutch and English. `lang` attribute per page. Future: per-article language toggle with URL persistence.
