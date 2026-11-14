# AI Intelligence Publication Contract

**Version:** 1.0
**Status:** Authoritative Specification
**Last Updated:** 2025-01-15
**Classification:** Public — no confidential material

---

## 1. Mission & Scope

### 1.1 Purpose

This publication delivers **architectural intelligence** for AI-intensive systems. It serves system architects, principal engineers, and technical decision-makers who need evidence-first analysis of patterns, trade-offs, and failure modes — not hype, vendor placements, or prompt engineering tutorials.

### 1.2 Audience

- **Primary:** System architects, principal engineers, ML platform leads, technical CTOs
- **Secondary:** Senior engineers on AI/ML track, security architects, cost engineers
- **Accessibility Commitment:** Readers with ADHD are first-class citizens — structure, progressive disclosure, and reduced cognitive load are non-negotiable

### 1.3 Languages

- **English (en)** — default locale, ISO 639-1 `en`
- **Dutch (nl)** — full parity, ISO 639-1 `nl`
- **Terminology consistency:** Concepts map 1:1 across languages; idioms do not

### 1.4 Publication Cadence

- **Daily brief:** 06:00 UTC — 3–5 items, ~5 min read
- **Weekly deep-dive:** Thursday 06:00 UTC — 1 architectural essay, ~15–25 min read
- **Monthly pattern catalog:** First Thursday — reusable patterns with code
- **Ad-hoc ADR:** When a material architectural decision warrants documentation

### 1.5 Non-Goals (Explicit Exclusions)

- ❌ Model benchmarks without architectural context
- ❌ Vendor announcements, product launches, funding rounds
- ❌ Prompt engineering tips, "how to use ChatGPT"
- ❌ Opinion pieces without traceable evidence
- ❌ Affiliate links, sponsored content, native advertising
- ❌ Paywalls, newsletters, tracking pixels, third-party cookies

---

## 2. Editorial Principles

### 2.1 Evidence Is Structural

Every claim traces to a **primary source** or **reproducible artifact**:

| Claim Type            | Minimum Evidence                                             |
| --------------------- | ------------------------------------------------------------ |
| Performance / latency | Benchmark methodology + raw data link + hardware spec        |
| Cost assertion        | Token accounting + pricing model + date of pricing           |
| Correctness / safety  | Test harness + failure injection results + pass criteria     |
| Architectural pattern | Decision record (ADR) + migration path + known failure modes |
| Vendor capability     | Public API docs + SLA + deprecation policy                   |

**No evidence = no publication.** "According to experts" is not evidence.

### 2.2 Architecture Over Aesthetics

Visual design serves **scannability and comprehension**; it never leads.

- Hierarchy > decoration
- Consistent signposting > visual novelty
- Motion reduction baked into component system

### 2.3 ADHD-Friendly by Default

- **BLUF (Bottom Line Up Front):** Key findings first, then detail
- **Progressive disclosure:** Collapsible sections for complexity
- **Chunking:** Max 3–4 sentences per paragraph, max 80 chars line width
- **Predictable layout:** Same landmark structure on every page
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` disables all transitions

### 2.4 Cost Discipline as Craft

Zero recurring cost is a **design constraint** that sharpens decisions:

- Local fonts only (Atkinson, JetBrains Mono)
- Static hosting (Netlify / Vercel / Cloudflare Pages free tier)
- No third-party SaaS (analytics, search, comments, auth)
- Build-time optimization only (Sharp images, Astro islands)

### 2.5 Bilingual Precision

- Terminology consistent across EN/NL
- Translation is **architectural** — concepts map 1:1
- No machine translation without human review
- Locale-specific formatting (dates, numbers, currency)

---

## 3. Source Discovery

### 3.1 Source Tiers

| Tier                                | Sources                                                                                                                                                                                                     | Trust Weight | Max Age   |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------- |
| **Tier 1 — Primary**                | RFCs, standards bodies (W3C, IETF, ISO), cloud provider API docs, SLA pages, deprecation notices, official benchmark repos (MLPerf, LLMPerf), peer-reviewed venues (NeurIPS, ICML, ICLR, MLSys, OSDI, SOSP) | 1.0          | 24 months |
| **Tier 2 — Verified Secondary**     | Major cloud engineering blogs (AWS, GCP, Azure, Cloudflare), foundation model release notes with reproducible artifacts, CNCF project graduation posts, LWN.net kernel coverage                             | 0.85         | 18 months |
| **Tier 3 — Corroborated Community** | Reproducible GitHub repos (≥50 stars + CI green), technical posts from known practitioners with track record, conference talk recordings with slides                                                        | 0.65         | 12 months |
| **Tier 4 — Excluded**               | Press releases, marketing pages, vendor comparison matrices, influencer threads, unsubstantiated benchmarks, paywalled analyst reports                                                                      | 0.0          | N/A       |

### 3.2 Discovery Mechanisms

- **RSS/Atom feeds** from Tier 1/2 sources (curated OPML)
- **GitHub watch** on benchmark repos + model release repos
- **arXiv categories:** `cs.LG`, `cs.CL`, `cs.DC`, `cs.SE`, `stat.ML` (daily query)
- **Conference proceedings** at publication (NeurIPS, ICML, ICLR, MLSys, OSDI, SOSP, PLDI, ASPLOS)
- **Security advisories:** CVE feeds, GHSA, cloud provider security bulletins

### 3.3 Source Registry

Maintained as `data/sources.yml`:

```yaml
sources:
  - id: aws-architecture-blog
    tier: 2
    type: rss
    url: https://aws.amazon.com/blogs/architecture/feed/
    tags: [cloud, patterns, cost]
    lang: en
  - id: mlperf-results
    tier: 1
    type: github
    repo: mlcommons/results
    tags: [benchmark, hardware, reproducibility]
    lang: en
```

---

## 4. Evidence Verification

### 4.1 Verification Levels

| Level                            | Requirement                                                                                      | Applied To                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| **L0 — Unverified**              | Source cited, no independent check                                                               | Tier 3 only, flagged in UI                         |
| **L1 — Methodology Check**       | Benchmark methodology reviewed for confounders (warm-up, batch size, precision, hardware parity) | All performance claims                             |
| **L2 — Artifact Reproduction**   | CI pipeline reproduces key result (docker-compose / GitHub Actions)                              | Pattern catalogs, ADRs                             |
| **L3 — Independent Replication** | Third-party replication cited (different lab / cloud)                                            | Safety/correctness claims, foundational benchmarks |

### 4.2 Verification Checklist (Per Claim)

```markdown
- [ ] Primary source URL accessible (HTTP 200)
- [ ] Source date within temporal eligibility
- [ ] Methodology documented (or linked)
- [ ] Hardware / environment specified
- [ ] Precision / quantization stated (FP32, FP16, BF16, INT8, INT4)
- [ ] Batch size / concurrency specified
- [ ] Warm-up runs excluded from measurement
- [ ] Statistical rigor: n ≥ 30, confidence interval reported
- [ ] Confounders addressed (thermal throttling, noisy neighbors, network variance)
- [ ] Raw data available (CSV, JSON, Parquet)
- [ ] Reproduction artifact linked (Docker, Conda, Nix, GitHub Actions)
```

### 4.3 Failure to Verify

- Claim **downgraded** to L0 with visible badge
- If Tier 1 source fails L1 → **retraction** with explanation
- Pattern catalog items **require L2** minimum

---

## 5. Temporal Eligibility

### 5.1 Windows by Content Type

| Content Type               | Max Source Age                     | Rationale                              |
| -------------------------- | ---------------------------------- | -------------------------------------- |
| **Daily brief**            | 14 days                            | News relevance                         |
| **Weekly deep-dive**       | 90 days                            | Architectural patterns evolve slower   |
| **Pattern catalog**        | 24 months                          | Patterns have longer half-life         |
| **ADR**                    | 12 months (context) / ∞ (decision) | Decision record immortal; context ages |
| **Security / deprecation** | 30 days                            | Urgency                                |
| **Cost / pricing**         | 60 days                            | Pricing changes frequently             |

### 5.2 Freshness Indicators

- `🟢 Fresh` — within 72 hours
- `🟡 Current` — within window
- `🟠 Aging` — >75% of window elapsed
- `🔴 Expired` — beyond window (archived, not published)

### 5.3 Versioning

- Sources with **multiple versions** (e.g., model v1 → v2): cite specific version
- **Deprecation notices** override age limit (always eligible)

---

## 6. Fact Dossier

### 6.1 Structure

Every published item carries a **machine-readable fact dossier** (`frontmatter + sidecar JSON`):

```yaml
# Frontmatter (Astro content collection)
title: "Bounding LLM Agents: Schema vs Sandbox vs Capability Tokens"
slug: bounding-llm-agents
type: architectural-essay
locale: en
publishDate: 2025-01-15T06:00:00Z
updatedDate: 2025-01-15T06:00:00Z
authors: ["architect@example.com"]
tags: ["Agent Architecture", "Decision Records", "Cost Control"]
readingTime: 18

# Evidence & verification
evidenceLevel: L2
sourceWindowDays: 90
sources:
  - id: adr-bounding-llm-agents
    tier: 1
    url: https://github.com/example/adr-bounding-llm-agents
    title: "ADR-0042: Bounding Strategy for Orchestrator Service"
    accessed: 2025-01-14
    claims: ["schema_traceability", "token_cost_control", "sandbox_isolation"]
    verification: L2
    reproduction:
      type: github-actions
      url: https://github.com/example/adr-bounding-llm-agents/actions
```

### 6.2 Claim-Level Granularity

Each **atomic claim** in the article maps to a source paragraph:

```json
{
  "claims": [
    {
      "id": "schema_traceability",
      "text": "Schema enforcement provides ★★★★★ traceability",
      "source": "adr-bounding-llm-agents",
      "locator": "section:Evaluation Criteria > Traceability",
      "verification": "L2",
      "confidence": 0.92
    }
  ]
}
```

### 6.3 Dossier Lifecycle

1. **Draft** — Author compiles sources, claims, verification
2. **Review** — Editor checks dossier completeness, L1+ verification
3. **Lock** — Dossier frozen at publication (immutable hash stored)
4. **Update** — New dossier version with `updatedDate`, diff visible
5. **Retraction** — `retracted: true`, `retractionReason`, `supersededBy`

---

## 7. Publication Formats

### 7.1 Format Registry

| Format                        | Purpose                               | Structure                                                                           | Cadence    |
| ----------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------- | ---------- |
| **Architectural Essay**       | Deep-dive analysis of design decision | Context → Criteria → Evaluation → Decision → Migration → Failure Modes → References | Weekly     |
| **Pattern Catalog**           | Reusable pattern with code            | Problem → Forces → Solution → Trade-offs → Implementation → Anti-patterns           | Monthly    |
| **Decision Record (ADR)**     | Documented architectural choice       | Status → Context → Decision → Consequences → Alternatives Considered                | Ad-hoc     |
| **Model/Provider Evaluation** | Reproducible benchmark                | Criteria → Methodology → Results → Sensitivity Analysis → Recommendation            | Quarterly  |
| **Tooling Deep-Dive**         | Framework/infrastructure analysis     | Architecture → Boundaries → Observability → Operations → Migration Path             | Bi-monthly |
| **Daily Brief**               | Curated signal                        | 3–5 items: title, 1-sentence summary, source, tier, relevance tag                   | Daily      |

### 7.2 Content Schema (Zod)

```typescript
const ContentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("architectural-essay"),
    context: z.string(),
    criteria: z.array(CriterionSchema),
    evaluation: z.record(z.string(), z.array(ScoreSchema)),
    decision: z.string(),
    migration: z.array(MigrationStepSchema),
    failureModes: z.array(FailureModeSchema),
    references: z.array(ReferenceSchema),
  }),
  z.object({
    type: "pattern-catalog",
    problem: z.string(),
    forces: z.array(z.string()),
    solution: z.string(),
    tradeoffs: z.array(TradeoffSchema),
    implementation: z.string(), // code block
    antipatterns: z.array(AntipatternSchema),
  }),
  // ... other types
]);
```

### 7.3 Bilingual Parity Rules

- **Identical structure** across locales
- **Translated, not localized:** No cultural adaptation of technical content
- **Terminology glossary** enforced (`data/glossary.yml`)
- **Review gate:** Both locales must pass before publish

---

## 8. Quality Gates

### 8.1 Pre-Publication Checklist (All Formats)

| Gate                         | Automated      | Manual | Blocking |
| ---------------------------- | -------------- | ------ | -------- |
| **TypeScript + Astro check** | ✅             |        | ✅       |
| **Build passes**             | ✅             |        | ✅       |
| **WCAG 2.2 AA (axe-core)**   | ✅             |        | ✅       |
| **Link check (no 404)**      | ✅             |        | ✅       |
| **Dossier completeness**     | ✅ (schema)    |        | ✅       |
| **Verification level ≥ L1**  | ✅ (claims)    |        | ✅       |
| **Temporal eligibility**     | ✅ (date math) |        | ✅       |
| **Bilingual parity**         | ✅ (keys)      |        | ✅       |
| **Editorial review**         |                | ✅     | ✅       |
| **ADHD readability**         | ✅ (metrics)   |        | ✅       |
| **Glossary compliance**      | ✅ (terms)     |        | ✅       |

### 8.2 Automated Metrics (CI)

```yaml
# .github/workflows/quality.yml
readability:
  maxSentenceLength: 25
  maxParagraphSentences: 4
  passiveVoiceThreshold: 0.15
  jargonDensity: 0.08 # terms not in glossary per 100 words
  headingFrequency: 300 # words per heading
accessibility:
  wcagLevel: AA
  colorContrast: true
  focusVisible: true
  landmarksPresent: true
  headingOrder: true
  altTextCoverage: 1.0
```

### 8.3 Failure Handling

- **Automated gate failure** → PR blocked, no manual override
- **Editorial review failure** → Returned to author with specific feedback
- **Post-publication error** → Correction workflow (see §8.4)

### 8.4 Correction & Retraction Workflow

| Severity                      | Action                                                  | Timeline  |
| ----------------------------- | ------------------------------------------------------- | --------- |
| **Typo / formatting**         | Silent fix, `updatedDate` bump                          | Immediate |
| **Fact error (non-material)** | Correction notice at top, `updatedDate`, diff link      | < 24h     |
| **Material fact error**       | Retraction notice, full dossier diff, `retracted: true` | < 4h      |
| **Verification downgrade**    | Badge change, explanation appended                      | < 24h     |

---

## 9. Accessibility Specification

### 9.1 WCAG 2.2 AA — Mandatory Baseline

| Criterion                        | Implementation                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------- |
| **1.1.1 Non-text Content**       | All images have `alt`; decorative = `alt=""`                                      |
| **1.3.1 Info & Relationships**   | Semantic HTML5: `<header>`, `<nav>`, `<main>`, `<article>`, `<aside>`, `<footer>` |
| **1.3.2 Meaningful Sequence**    | DOM order = visual order                                                          |
| **1.4.3 Contrast (Minimum)**     | 4.5:1 text, 3:1 large text/UI — verified in CI                                    |
| **1.4.4 Resize Text**            | 200% zoom, no horizontal scroll                                                   |
| **1.4.10 Reflow**                | Single column at 320px CSS pixels                                                 |
| **2.1.1 Keyboard**               | All interactive elements reachable/operable                                       |
| **2.1.2 No Keyboard Trap**       | Focus trap only in modals, Escape exits                                           |
| **2.4.3 Focus Order**            | Logical tab order                                                                 |
| **2.4.7 Focus Visible**          | `:focus-visible` 2px gold outline on all interactive                              |
| **2.5.3 Label in Name**          | Accessible name includes visible label                                            |
| **3.2.3 Consistent Navigation**  | Same landmark structure every page                                                |
| **3.3.2 Labels or Instructions** | Form inputs have associated `<label>`                                             |

### 9.2 ADHD-Specific Requirements (Beyond WCAG)

| Requirement                | Implementation                                                             |
| -------------------------- | -------------------------------------------------------------------------- |
| **BLUF Pattern**           | Key findings component at article top                                      |
| **Progressive Disclosure** | Native `<details>/<summary>` for complexity                                |
| **Reading Mode**           | Adjustable font size (87.5–150%), line height (1.4–2.2), measure (45–90ch) |
| **Focus Mode**             | Hides chrome (nav, TOC, footer), centers content                           |
| **Reduced Motion**         | `@media (prefers-reduced-motion: reduce)` disables all transitions         |
| **Consistent Signposting** | Crease graph (TOC) with scroll position, reading time, section numbers     |
| **Chunking**               | Max 80ch measure, short paragraphs, frequent headings                      |

### 9.3 Testing Gates

- **Automated:** axe-core in CI (zero violations)
- **Manual per release:** NVDA + Firefox, VoiceOver + Safari
- **Keyboard-only:** Tab through entire site
- **Zoom test:** 200% in Chrome/Firefox/Safari
- **Reduced motion:** OS setting verified

---

## 10. Knowledge Management

### 10.1 Information Architecture

```text
src/
├── content/
│   ├── blog/           # Essays, briefs, evaluations (MDX)
│   ├── patterns/       # Pattern catalogs (MDX + code)
│   ├── adrs/           # Decision records (MDX)
│   └── glossary/       # Term definitions (YAML)
├── data/
│   ├── sources.yml     # Source registry
│   ├── glossary.yml    # Terminology (EN/NL)
│   └── dossiers/       # Sidecar JSON per article
├── components/
│   ├── Callout.astro   # Evidence/Failure/Migration/Decision
│   ├── KeyFindings.astro
│   ├── ProgressiveDisclosure.astro
│   ├── ReadAloud.astro
│   └── CookieConsent.astro
└── i18n/
    ├── en.ts
    └── nl.ts
```

### 10.2 Glossary (Terminology Control)

```yaml
# data/glossary.yml
terms:
  - term: "Agent"
    definition: "Autonomous software entity that plans and executes actions toward a goal using tools"
    nl: "Agent"
    aliases: ["LLM Agent", "Autonomous Agent"]
    forbidden: ["Bot", "Chatbot"]
  - term: "Capability Token"
    definition: "Unforgeable token granting specific permission (model call, API request, budget)"
    nl: "Capability Token"
    aliases: ["Auth Token", "Permission Token"]
```

### 10.3 Cross-Linking & Traceability

- **Source → Article:** `data/dossiers/*.json` maps each claim to source paragraph
- **Article → Pattern:** Pattern catalogs reference essays that motivated them
- **Essay → ADR:** Essays cite ADRs; ADRs cite motivating essays
- **Tag taxonomy:** Controlled vocabulary (`data/tags.yml`)

### 10.4 Version Control & History

- **Git** for all content + code
- **Conventional Commits** with scope: `feat(essay)`, `fix(pattern)`, `chore(glossary)`
- **Immutable dossiers:** SHA-256 of dossier JSON stored at publish
- **Diff visibility:** `updatedDate` triggers sidebar diff link

---

## 11. Automation

### 11.1 Pipeline Overview

```text
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Discover   │────▶│  Curate     │────▶│  Author     │────▶│  Review     │
│  (Sources)  │     │  (Triage)   │     │  (Draft)    │     │  (Gates)    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                    │
                                                                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Monitor    │◀────│  Publish    │◀────│  Build      │◀────│  Translate  │
│  (Alerts)   │     │  (Deploy)   │     │  (Astro)    │     │  (i18n)     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### 11.2 Automated Stages

| Stage             | Trigger             | Tools                                 | Output                              |
| ----------------- | ------------------- | ------------------------------------- | ----------------------------------- |
| **Discover**      | Cron (06:00 UTC)    | RSS parser, GitHub API, arXiv API     | `data/discovered/*.json`            |
| **Triage**        | PR to `discovered/` | Schema validation, tier assignment    | `data/sources.yml` updates          |
| **Draft**         | Author creates PR   | Astro content collections, Zod        | `src/content/**/*.mdx`              |
| **Translate**     | Draft merged        | Human review + glossary check         | `src/i18n/*.ts` + localized content |
| **Build**         | PR to `main`        | `pnpm astro check`, `pnpm run build`  | `dist/`                             |
| **Quality Gates** | Build success       | axe-core, link check, dossier schema  | Pass/Fail                           |
| **Deploy**        | Gates pass          | Netlify/Vercel/Cloudflare Pages       | Live site                           |
| **Monitor**       | Post-deploy         | Uptime, Lighthouse CI, error tracking | Alerts                              |

### 11.3 Human-in-the-Loop Gates

| Gate                     | Who                | Criteria                                 |
| ------------------------ | ------------------ | ---------------------------------------- |
| **Source Acceptance**    | Editor             | Tier assignment, credibility             |
| **Claim Verification**   | Author + Editor    | L1+ for all claims                       |
| **Editorial Review**     | Editor             | Coherence, BLUF, ADHD readability        |
| **Translation Parity**   | Bilingual reviewer | 1:1 concept mapping, glossary compliance |
| **Publication Approval** | Editor-in-Chief    | All gates pass, schedule slot            |

### 11.4 Alerting & Monitoring

- **Build failure** → Slack/email immediate
- **Accessibility regression** → Lighthouse CI < 90% → alert
- **Link rot** → Weekly check, >5% 404s → alert
- **Source staleness** → Tier 1 source >90 days no updates → review
- **Verification expiry** → Claim L2 artifact CI failing → alert

---

## 12. Governance & Evolution

### 12.1 Contract Versioning

- **Semantic versioning:** `MAJOR.MINOR.PATCH`
- **MAJOR:** Breaking change to content schema, verification levels, or mission
- **MINOR:** New format, gate, source tier, accessibility requirement
- **PATCH:** Clarifications, typo fixes, metric threshold adjustments

### 12.2 Amendment Process

1. **Proposal** — Issue with `contract-amendment` label
2. **Discussion** — 14-day comment period
3. **Decision** — Editor-in-Chief + 1 reviewer approve
4. **Implementation** — PR with tests, version bump
5. **Migration** — Content migration script if schema changes

### 12.3 Immutable Principles (Never Amend Without Consensus)

- Evidence-first, no vendor influence
- Zero recurring cost
- WCAG 2.2 AA + ADHD-specific requirements
- Bilingual EN/NL parity
- Static-first, no server runtime
- Open source, no tracking

---

## Appendix A: Quick Reference — Verification Levels

| Level | Name                    | Min Tier | Repro Artifact         | Used For                        |
| ----- | ----------------------- | -------- | ---------------------- | ------------------------------- |
| L0    | Unverified              | 3        | None                   | Tier 3 only, flagged            |
| L1    | Methodology Check       | 1–2      | None                   | All performance claims          |
| L2    | Artifact Reproduction   | 1–2      | Docker/CI              | Patterns, ADRs                  |
| L3    | Independent Replication | 1        | Third-party paper/repo | Safety, foundational benchmarks |

---

## Appendix B: Content Type Decision Matrix

| You Want To…                            | Use Format          |
| --------------------------------------- | ------------------- |
| Analyze a design decision with criteria | Architectural Essay |
| Share a reusable solution with code     | Pattern Catalog     |
| Record an architectural choice          | ADR                 |
| Compare models/providers rigorously     | Model Evaluation    |
| Dissect a framework's internals         | Tooling Deep-Dive   |
| Curate 3–5 signals for daily readers    | Daily Brief         |

---

## Appendix C: Glossary Excerpt (Core Terms)

| Term                    | Definition (EN)                                                                      | Definition (NL)                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| **Agent**               | Autonomous software entity that plans and executes actions toward a goal using tools | Autonome software-entiteit die plant en acties uitvoert naar een doel met tools                |
| **Capability Token**    | Unforgeable token granting specific permission (model call, API request, budget)     | Onvervalschbare token die specifieke toestemming geeft (model call, API request, budget)       |
| **Schema Enforcement**  | Validating all tool calls against JSON Schema before execution                       | Validatie van alle tool calls tegen JSON Schema voor uitvoering                                |
| **Tool Sandbox**        | Isolated execution environment (WASM, process, container) for untrusted tool code    | Geïsoleerde uitvoeromgeving (WASM, proces, container) voor onvertrouwde tool code              |
| **Observability Spine** | Structured logging + distributed tracing + evaluation hooks as shared infrastructure | Gestructureerde logging + gedistribueerde tracing + evaluatiehooks als gedeelde infrastructuur |
| **Cost Envelope**       | Token budget + circuit breaker + capability-based pricing for an agent workflow      | Tokenbudget + circuitbreaker + capability-based pricing voor een agent workflow                |

---

**End of Contract** — This document is the single source of truth for editorial, technical, and operational decisions. All automation, tooling, and human processes must conform.
