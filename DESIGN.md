# DESIGN.md — Miura-fold Design System

**Status:** Active • **Version:** 1.0 • **Mode:** Read • **Surface:** Article page (primary), Blog index, Home, About

This document records the durable visual decisions for the AI Intelligence Blog. It is generated from the built implementation, not authored before it. Every token, component, and pattern here ships in the current build.

---

## 1. Design Thesis

A technical publication that _is_ a deployed Miura-fold sheet: the masthead is the compact packet, the navigation rail is the crease line, the reading column is the fully deployed field. The diagonal fold — one precise geometric gesture — carries the entire section hierarchy, wayfinding, and progressive disclosure. It refuses the category default of a passive article column with a sticky TOC; here the structure _is_ the navigation.

**Product clarity:** System architects need to scan, study, and reference. The Miura-fold geometry makes hierarchy spatial: the fold line _is_ the TOC, the crease markers _are_ the scroll position, the parallelogram grid _is_ the code/table structure. Nothing is decoration.

---

## 2. Palette & Material

| Token              | Value             | Role                | Usage                                                        |
| ------------------ | ----------------- | ------------------- | ------------------------------------------------------------ |
| `--sheet`          | `#FAFAFA`         | Ground              | Page background, card surfaces                               |
| `--sheet-darker`   | `#F0F0F0`         | Elevation           | Code blocks, callouts, hover states                          |
| `--ink`            | `#1A1A1A`         | Primary text        | Body copy, headings                                          |
| `--ink-muted`      | `#4A4A4A`         | Secondary text      | Meta, captions, footnotes                                    |
| `--gold`           | `#C8A951`         | **Single accent**   | Fold line, active states, critical callouts, site-title mark |
| `--gold-dim`       | `#B89941`         | Accent hover        | Link hover, button active                                    |
| `--mountain`       | `#6B6B6B`         | Structure           | Mountain crease lines, code rules, table borders             |
| `--mountain-light` | `#6B6B6B66` (40%) | Subtle structure    | Grid lines, hr, table row borders                            |
| `--valley`         | `#A8C8E8`         | Secondary structure | Valley crease lines, link underlines, secondary callouts     |
| `--valley-light`   | `#A8C8E84D` (30%) | Subtle secondary    | Hover backgrounds, focus rings                               |
| `--focus`          | `#C8A951`         | Focus               | `:focus-visible` outlines                                    |

**Color strategy:** Restrained — one saturated accent (gold) on a near-white ground. Dark/light mode not needed; the sheet metaphor is inherently light. High-contrast media query hardens tokens for accessibility.

**Material honesty:** No gradients, glass, shadows beyond `--shadow-fold` (subtle elevation for sticky masthead) and `--shadow-packet` (masthead depth). The parallelogram grid is a _faint_ CSS background (15% opacity) — it's the construction lines of the sheet, not a pattern.

---

## 3. Typography

| Role           | Face           | CSS Variable        | Weights  | Use                                                                       |
| -------------- | -------------- | ------------------- | -------- | ------------------------------------------------------------------------- |
| **Reading**    | Atkinson       | `--font-reading`    | 400, 700 | Body text, headings, UI labels                                            |
| **Structural** | JetBrains Mono | `--font-structural` | 400, 700 | Code, parameters, table headers, crease IDs, folded heading numbers, meta |
| **Display**    | Atkinson Bold  | `--font-display`    | 700      | Masthead title, folded headings                                           |

**Type scale (fluid):**

- Base: `clamp(1.125rem, 1rem + 0.5vw, 1.25rem)` → 18–20px
- `--size-sm`: 0.875rem (14px)
- `--size-xs`: 0.75rem (12px)
- `--size-lg`: 1.5rem (24px)
- `--size-xl`: 2rem (32px)
- `--size-2xl`: 3rem (48px)
- `--size-3xl`: 4rem (64px)

**Leading:**

- `--leading-tight`: 1.2 (headings)
- `--leading-normal`: 1.5 (code, abstract)
- `--leading-relaxed`: 1.7 (body)

**Measure:** `--measure: 68ch` (reading column), `--measure-narrow: 52ch` (code/tables)

**Folded heading treatment:** Rotated `-30deg` (aligned to fold line), anchored by a gold rule. Section number in JetBrains Mono, gold. This is the signature typographic moment.

---

## 4. Geometry & Grid

| Token                   | Value    | Meaning                                            |
| ----------------------- | -------- | -------------------------------------------------- |
| `--fold-angle`          | `-30deg` | Diagonal fold line angle (top-left → bottom-right) |
| `--fold-width`          | `2px`    | Primary fold line weight                           |
| `--fold-margin-width`   | `1px`    | Margin fold line weight                            |
| `--parallelogram-angle` | `60deg`  | Construction grid angle                            |
| `--radius`              | `4px`    | Subtle rounding (cards, code blocks, buttons)      |

**Parallelogram grid:** 60°/120° repeating linear gradients at 40px intervals, 15% opacity, `pointer-events: none`, `z-index: -1`. Applied via `.parallelogram-grid` utility class on code blocks, tables, diagrams.

**Layout grid (desktop):**

```text
[margin] [fold-margin:40px] [content:68ch] [flex:1fr] [margin]
   3rem        40px           68ch          auto       3rem
```

**Responsive breakpoints:**

- `≤1200px`: Fold margin shrinks to 24px, crease graph becomes inline
- `≤720px`: Single column, fold margin hidden, margins 1rem, type scale compresses

---

## 5. Components

### 5.1 Masthead (Packet)

**File:** `src/components/Masthead.astro`

Sticky, z-index 100. Contains:

- Site title (Atkinson Bold, gold diamond mark)
- Primary nav (Home, Blog, About) — inline, no hamburger
- Language toggle (EN/NL) — prepared, buttons use JetBrains Mono

**States:** `aria-current="page"` → gold text. Hover/focus → gold text + valley-light background.

### 5.2 Fold Margin

**CSS:** `.fold-margin` + `.fold-margin-marker`

Fixed 40px column left of content. Gold line (1px, 30% opacity) runs full viewport height. Markers (12px gold circles with 2px white border) at each H2 position. Activated by IntersectionObserver — `opacity: 1`, `transform: translateX(0)`.

**Hidden on mobile** (`≤1200px`).

### 5.3 Reading Column

**CSS:** `.reading-column`

Centered, max-width `--measure`, padded `var(--space-6)` top/bottom. Article header (meta, title, abstract), hero image, content slot, footnotes.

### 5.4 Crease Graph (TOC)

**File:** `src/components/CreaseGraph.astro`

Desktop: Fixed right sidebar (280px, max-height 70vh). Mobile: Inline at article top.

- `<details>` wrapper, open by default
- Summary: "On this page" (Atkinson Bold, gold chevron rotates on open)
- Nav: Links to each heading, H3 children indented
- Active link: gold text + valley-light background, indent animation

**Keyboard:** Fully navigable. `Enter/Space` toggles summary. Links are standard anchors.

### 5.5 Folded Heading

**CSS:** `.folded-heading`

```css
.folded-heading {
  transform: rotate(-30deg);
  transform-origin: left center;
  padding-left: var(--space-4);
  margin-left: calc(var(--space-4) * -1);
}
.folded-heading::before {
  /* gold rule, 2px, var(--space-3) wide */
}
.section-number {
  font-family: var(--font-structural);
  color: var(--gold);
}
```

Used for all H2s in article content. The rotation makes the heading _sit on_ the fold line.

### 5.6 Callout / Admonition

**CSS:** `.callout[data-type="..."]`

| Type                 | Border     | Label            | Color      |
| -------------------- | ---------- | ---------------- | ---------- |
| `decision` (default) | `--gold`   | "Decision"       | `--gold`   |
| `evidence`           | `--valley` | "Evidence"       | `--valley` |
| `failure`            | `#C0392B`  | "Failure Mode"   | `#C0392B`  |
| `migration`          | `#27AE60`  | "Migration Path" | `#27AE60`  |

Label rendered via `::before` using `attr(data-label)` — no extra DOM.

### 5.7 Code Blocks

**CSS:** `pre`, `pre > code`

- Background: `--ink` (near-black)
- Text: `#E8E8E8`
- Font: JetBrains Mono, `--size-sm`, `--leading-normal`
- Left border: 3px solid `--gold`
- Full-width bleed: negative margins into page margins
- Parallelogram grid via `.parallelogram-grid` wrapper

### 5.8 Tables

**CSS:** `table`, `th`, `td`

- Max-width: `--measure-narrow`
- Header: JetBrains Mono, uppercase, tracking, `--sheet-darker` bg, 2px `--mountain` bottom border
- Rows: hover → `--sheet-darker`
- Parallelogram grid on wrapper

### 5.9 Diagrams / Figures

**CSS:** `.diagram`, `figure`

- Dark ground (`--ink`), border-radius, horizontal scroll
- Mermaid/SVG rendered inline
- Caption: italic, centered, `--ink-muted`, `--size-sm`

### 5.10 Footer

**File:** `src/components/Footer.astro`

Minimal: copyright, "No tracking · No cookies · No third-party scripts", RSS/Sitemap links. No social icons (publication has no social media by design).

---

## 6. Interaction & Motion

| Interaction                     | Implementation                                                         | Reduced Motion |
| ------------------------------- | ---------------------------------------------------------------------- | -------------- |
| Fold margin marker activation   | IntersectionObserver, CSS `transition: opacity 300ms, transform 300ms` | Instant (0ms)  |
| Crease graph chevron rotate     | CSS `transition: transform 200ms`                                      | Instant        |
| Crease graph active link indent | CSS `transition: padding-left 200ms, color 200ms`                      | Instant        |
| Link underline color            | CSS `transition: color 200ms, text-decoration-color 200ms`             | Instant        |
| Button/lang toggle hover        | CSS `transition: color 200ms, background 200ms`                        | Instant        |
| Scroll behavior                 | `scroll-behavior: smooth` on `html`                                    | Instant        |

**Global:** `@media (prefers-reduced-motion: reduce)` sets all transitions to 0.01ms, disables animations.

**Signature motion:** The fold margin marker slide-in (`translateX(-100%)` → `0`) is the only spatial animation. It mirrors the physical Miura-fold deployment.

---

## 7. Accessibility

**Baseline:** WCAG 2.2 AA (enforced via AGENTS.md gates).

**ADHD-specific (beyond WCAG):**

- Predictable landmark structure: `<header>`, `<main>`, `<aside>` (TOC), `<footer>` on every page
- Single `<h1>` per page; H2s are folded headings; H3s standard
- Crease graph = persistent, keyboard-navigable TOC with scroll position sync
- Fold margin = non-visual scroll progress (markers activate via IntersectionObserver)
- No auto-play, carousels, popups, interstitials
- `:focus-visible` on all interactive elements (gold, 2px, 2px offset)
- Reduced motion respected globally
- High contrast mode hardens palette
- Print stylesheet hides UI, shows URLs, avoids breaks in code/figures

**Keyboard:**

- Masthead nav: Tab → Enter
- Language toggle: Tab → arrow keys → Enter/Space
- Crease graph: Tab through links, Enter to scroll
- All links/buttons: standard focus

**Screen reader:**

- `sr-only` utility for icon labels
- `aria-label` on masthead nav, language toggle, crease graph
- `aria-current="page"` on active nav
- `aria-pressed` on language toggle buttons
- Heading hierarchy validated by content schema

---

## 8. Content Schema Integration

The design system assumes content frontmatter (enforced by `src/content.config.ts`):

```ts
schema: z.object({
  title: z.string(),
  description: z.string(), // → article-abstract
  pubDate: z.coerce.date(), // → article-meta time
  updatedDate: z.coerce.date().optional(), // → article-meta (if present)
  heroImage: z.optional(image()), // → hero-image figure
});
```

**MDX components available in content:**

- `<Callout type="evidence|failure|migration|decision">...</Callout>` → `.callout`
- `<Diagram>...</Diagram>` → `.diagram`
- Standard Markdown: tables, code fences, blockquotes, footnotes

---

## 9. Performance Budget

| Metric                    | Target                             | Enforcement                       |
| ------------------------- | ---------------------------------- | --------------------------------- |
| Lighthouse Performance    | 100                                | CI gate                           |
| Lighthouse Accessibility  | 100                                | CI gate                           |
| Lighthouse Best Practices | 100                                | CI gate                           |
| Lighthouse SEO            | 100                                | CI gate                           |
| Total JS (content pages)  | 0 KB                               | Astro default                     |
| Fonts                     | 2 local (Atkinson, JetBrains Mono) | Self-hosted, `font-display: swap` |
| Images                    | Sharp-optimized WebP/AVIF          | Build-time                        |
| CSS                       | Single global.css, no framework    | ~15 KB gzipped                    |

---

## 10. Bilingual Readiness (NL/EN)

**Prepared, not implemented.** Infrastructure in place:

- Language toggle in masthead (EN/NL buttons, `aria-pressed`)
- CSS custom properties for all text colors (easy override)
- No hardcoded English strings in components (except "On this page" in CreaseGraph — needs i18n)
- `lang` attribute on `<html>` (currently hardcoded `en`)

**Next steps:** Per-article `lang` frontmatter field, Astro i18n routing (`/nl/...`, `/en/...`), translated UI strings.

---

## 11. File Map

```text
src/
├── styles/
│   └── global.css              # Complete design system (tokens, components, layout)
├── components/
│   ├── Masthead.astro          # Packet header
│   ├── CreaseGraph.astro       # TOC sidebar
│   ├── Footer.astro            # Minimal footer
│   ├── BaseHead.astro          # SEO, OG, fonts (unchanged)
│   ├── FormattedDate.astro     # Date formatting (unchanged)
│   └── HeaderLink.astro        # DEPRECATED (unused)
├── layouts/
│   └── BlogPost.astro          # Article shell (fold margin, reading column, crease graph)
├── pages/
│   ├── index.astro             # Home (reading-column layout)
│   ├── about.astro             # About (uses BlogPost layout)
│   ├── blog/
│   │   ├── index.astro         # Blog index (reading-column layout)
│   │   └── [...slug].astro     # Article page (uses BlogPost layout)
│   └── rss.xml.js              # RSS feed (unchanged)
└── content/
    └── blog/                   # MDX content (unchanged)
```

---

## 12. Drift Detection

**Automated checks (run in CI):**

- `pnpm astro check` — TypeScript + Astro validation
- `pnpm run build` — Build succeeds
- `pnpm exec playwright test --project=accessibility` — a11y gate
- `pnpm audit --prod` — No high/critical vulns

**Manual review (per PR):**

- Visual regression: compare `dist/` screenshots at 1440px and 390px
- Keyboard tab-through on article page
- Screen reader spot-check (NVDA/VoiceOver)
- `prefers-reduced-motion: reduce` verification
- 200% zoom reflow check
- Print preview verification

---

## 13. Change Log

| Date       | Change                                       | Author |
| ---------- | -------------------------------------------- | ------ |
| 2026-11-08 | Initial Miura-fold design system implemented | Agent  |

---

**End of DESIGN.md** — This file describes the shipped system. Edit only when the built implementation changes.
