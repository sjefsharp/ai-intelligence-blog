# Signal Desk — Expert Contributor Monitoring & Discovery

**Version:** 1.0

**Status:** Authoritative Specification

**Last Updated:** 2025-11-10

**Integrates with:** AI Intelligence Publication Contract §3, Discovery Rings Specification v2.0, Research Taxonomy v2.0

---

## 1. Purpose & Scope

The Signal Desk systematically discovers, monitors, and evaluates **original contributions from influential AI researchers, software engineers, maintainers, architects, and emerging technical experts**. It operates as a curated layer atop the three discovery rings, providing:

- **Named expert tracking** for designated high-signal contributors
- **Dynamic discovery** of emerging contributors across all research domains
- **Evidence classification** distinguishing original findings from interpretation and speculation
- **Ring-aware classification** based on each contribution's evidentiary role
- **Lifecycle management** for contributors and their source channels

The Signal Desk **does not** automatically promote findings to publication. All items pass through the same editorial gates (temporal eligibility, novelty classification, evidence verification, vendor-neutral ranking) as other sources.

---

## 2. Mandatory Coverage — Designated Experts

The following contributors are **mandatory coverage targets**. Each entry includes verified identity, canonical profiles, and actual source URLs. **Account ownership, expertise, and authenticity must be verified independently — never inferred from names alone.**

| Expert               | Domain Focus                                                         | Verified Identity                                                        | Canonical Profile(s)                                                                                   | Primary Source URLs                                                                                                                                                          | Ring Affinity                                                                              |
| -------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Burke Holland**    | VS Code, Developer Experience, AI-assisted Development               | Microsoft Principal Cloud Advocate; VS Code team                         | GitHub: `@burkeholland`<br>X: `@burkeholland`<br>Blog: `burkeholland.com`                              | Blog RSS: `https://burkeholland.com/rss.xml`<br>GitHub: `https://github.com/burkeholland`<br>X: `https://x.com/burkeholland`                                                 | Ring 1 (VS Code releases), Ring 3 (practitioner insights)                                  |
| **Daniel Mettler**   | AI Engineering, Agentic Development                                  | Independent AI Engineer; Founder Mettler.io                              | GitHub: `@mettler`<br>X: `@daniel_mettler`<br>Blog: `mettler.io`                                       | Blog RSS: `https://mettler.io/feed.xml`<br>GitHub: `https://github.com/mettler`<br>X: `https://x.com/daniel_mettler`                                                         | Ring 2 (technical analysis), Ring 3 (practitioner patterns)                                |
| **Matt Pocock**      | TypeScript, Developer Tooling, AI-assisted Software Engineering      | TypeScript Expert; XState Core Team; total-type-script.com               | GitHub: `@mattpocockuk`<br>X: `@mattpocockuk`<br>Blog: `mattpocock.com`                                | Blog RSS: `https://mattpocock.com/rss.xml`<br>GitHub: `https://github.com/mattpocockuk`<br>X: `https://x.com/mattpocockuk`<br>YouTube: `https://www.youtube.com/@mattpocock` | Ring 1 (TypeScript releases), Ring 2 (type system research), Ring 3 (tooling deep-dives)   |
| **Robert C. Martin** | Software Craftsmanship, Architecture, Engineering Principles         | "Uncle Bob"; Author Clean Code, Clean Architecture; Founder Clean Coders | Blog: `blog.cleancoder.com`<br>X: `@unclebobmartin`<br>GitHub: `@unclebob`                             | Blog: `https://blog.cleancoder.com/atom.xml`<br>GitHub: `https://github.com/unclebob`<br>X: `https://x.com/unclebobmartin`                                                   | Ring 2 (architectural principles), Ring 3 (craftsmanship philosophy)                       |
| **Boris Cherny**     | Claude Code, Coding Agents, Agentic Software Engineering             | Anthropic Engineer; Author "Programming TypeScript"                      | GitHub: `@borischerny`<br>X: `@borischerny`<br>Anthropic: `anthropic.com/people/boris-cherny`          | GitHub: `https://github.com/borischerny`<br>X: `https://x.com/borischerny`<br>Anthropic Blog (filtered): `https://www.anthropic.com/research`                                | Ring 1 (Claude Code releases), Ring 2 (agent architecture), Ring 3 (practitioner insights) |
| **Andrej Karpathy**  | Neural Networks, Language Models, AI Education, Software Development | Former Tesla AI Director; OpenAI Founding Member; Stanford PhD           | GitHub: `@karpathy`<br>X: `@karpathy`<br>YouTube: `youtube.com/@andrejkarpathy`<br>Blog: `karpathy.ai` | GitHub: `https://github.com/karpathy`<br>X: `https://x.com/karpathy`<br>YouTube: `https://www.youtube.com/@andrejkarpathy`<br>Blog: `https://karpathy.ai`                    | Ring 1 (model releases), Ring 2 (research/education), Ring 3 (implementation insights)     |

### Verification Requirements for Mandatory Experts

Each expert entry **must** have:

- ✅ Verified canonical profile URLs (GitHub, X, personal blog, employer page)
- ✅ Confirmed authorship of listed sources (not fan accounts, not impersonation)
- ✅ At least one working RSS/Atom feed or GitHub Atom feed for automated discovery
- ✅ Documented access limitations (Cloudflare, auth walls, rate limits)
- ✅ Last verification timestamp
- ✅ Research domain mapping per Taxonomy v2.0
- ✅ Ring affinity classification with justification

---

## 3. Dynamic Expert Discovery

Beyond the mandatory six, the Signal Desk **continuously identifies emerging contributors** across all six research domains:

### Discovery Criteria (All Must Be Met)

| Criterion                           | Threshold                                                                       | Evidence Required                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Original technical contribution** | ≥1 novel finding, reproducible demo, or first-hand disclosure in last 12 months | Link to artifact (code, paper, benchmark, postmortem)             |
| **Domain relevance**                | Active in ≥1 research domain (Taxonomy v2.0)                                    | Tagged contributions matching subdomain keywords                  |
| **Signal-to-noise ratio**           | ≥70% technical substance vs. commentary/marketing                               | Manual review of last 20 items                                    |
| **Independence**                    | Not primarily vendor marketing channel                                          | Affiliation disclosure; content not exclusively product promotion |
| **Accessibility**                   | ≥1 publicly monitorable channel (RSS, GitHub, YouTube, etc.)                    | Working feed URL verified                                         |

### Discovery Mechanisms

| Method                                    | Frequency  | Domains Covered            |
| ----------------------------------------- | ---------- | -------------------------- |
| **GitHub trending + topic search**        | Weekly     | All (code artifacts)       |
| **arXiv author tracking**                 | Daily      | Models/Inference, Research |
| **Conference speaker tracking**           | Per event  | All (talks with slides)    |
| **Citation network analysis**             | Monthly    | Research, Architecture     |
| **Community nomination**                  | Continuous | All (editor review gate)   |
| **Cross-reference from Ring 2/3 sources** | Continuous | All                        |

### Promotion/Demotion Gates

| Action                   | Trigger                                              | Authority                             |
| ------------------------ | ---------------------------------------------------- | ------------------------------------- |
| **Add to watchlist**     | Meets all discovery criteria                         | Editor (Source Acceptance gate §11.3) |
| **Promote to mandatory** | Sustained high signal ≥6 months; fills domain gap    | Editor-in-Chief + 1 reviewer          |
| **Demote to archive**    | No original contributions ≥12 months; access lost    | Editor                                |
| **Retire**               | Identity unverifiable; account compromised; deceased | Editor-in-Chief                       |

---

## 4. Source Discovery & Monitoring

### Monitored Channel Types

| Channel Type                   | Discovery Mechanism                                        | Access Method                                         | Verification                                 |
| ------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------- |
| **Personal/Engineering Blogs** | RSS/Atom feed; HTML scraping (if no feed)                  | Public HTTP; Feeder-generated feeds for blocked sites | HTTP 200; valid RSS/XML; author byline match |
| **GitHub Repositories**        | GitHub API (releases, commits, issues, discussions)        | GitHub API (authenticated); public Atom feeds         | Repo ownership verified; CI status checked   |
| **Research Papers**            | arXiv API; Semantic Scholar; OpenReview                    | Public APIs                                           | Author affiliation match; venue verified     |
| **Conference Talks**           | YouTube channel RSS; conference GitHub repos; Speaker Deck | Public RSS; GitHub API                                | Slides linked; speaker identity confirmed    |
| **Podcasts/Interviews**        | Podcast RSS; YouTube channel; newsletter mentions          | Public RSS; manual curation                           | Transcript available; speaker confirmed      |
| **X (Twitter)**                | X API v2 (if accessible); Nitter instances; RSS bridges    | API / public HTML                                     | Verified account; not parody/impersonation   |
| **LinkedIn**                   | Public posts only; RSS bridges                             | Public HTML (limited)                                 | Verified profile; employer match             |
| **YouTube**                    | Channel RSS; playlist monitoring                           | Public RSS                                            | Verified channel; transcript availability    |

### Access Limitations & Mitigations

| Platform                 | Limitation                                     | Mitigation                                                                    |
| ------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------- |
| **X (Twitter)**          | API v2 paid; rate limits; auth wall            | Nitter instances; RSS bridges (rsshub); manual review for high-value accounts |
| **LinkedIn**             | No public API; auth wall; limited RSS          | Monitor only public posts via RSS bridges; manual curation                    |
| **Substack/Medium**      | Some paywalled; no standard RSS                | RSS for free posts; Feeder-generated feeds                                    |
| **Cloudflare-protected** | Blocks automated fetches (Gartner, some blogs) | Browser-like fetcher; manual review; Feeder-generated feeds                   |
| **YouTube**              | No transcripts for all videos; API quota       | yt-dlp for transcripts; Whisper fallback; manual curation                     |
| **GitHub**               | API rate limits (5000/hr authenticated)        | Authenticated requests; conditional requests (ETag); prioritized polling      |

### Monitoring Cadence

| Source Type             | Automated Check | Human Review  |
| ----------------------- | --------------- | ------------- |
| RSS/Atom feeds          | Every 6 hours   | Weekly triage |
| GitHub releases/commits | Every 4 hours   | Weekly triage |
| arXiv author matches    | Daily           | Weekly triage |
| YouTube channels        | Daily           | Bi-weekly     |
| X/LinkedIn              | Manual only     | As-needed     |
| Podcasts                | Per episode     | Per episode   |

---

## 5. Evidence & Signal Classification

Every Signal Desk item receives an **evidence classification** at ingestion. This is distinct from the contract's verification levels (L0–L3) and operates at the **claim level**.

### Classification Taxonomy

| Class                     | Definition                                                                                            | Examples                                                                                       | Ring Affinity                                 | Publication Eligibility                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------- |
| **ORIGINAL_FINDING**      | Novel technical result, reproducible demo, benchmark, or artifact first disclosed by this contributor | New benchmark result; novel attack; architecture pattern with code; measured latency/cost data | Ring 1 (if first-party), Ring 2 (if research) | Eligible for all formats (L1+ verification required) |
| **FIRST_HAND_DISCLOSURE** | Author announces their own work, release, or decision directly                                        | Model release post; tool launch; RFC author comment; ADR author note                           | Ring 1                                        | Eligible (primary source)                            |
| **INDEPENDENT_ANALYSIS**  | Evidence-supported analysis of others' work; methodology disclosed                                    | Reproduction study; benchmark comparison; security audit; architecture critique with evidence  | Ring 2                                        | Eligible (L1+ verification)                          |
| **EXPERT_INTERPRETATION** | Informed opinion/hypothesis/prediction without new evidence                                           | "I think X will happen"; "This implies Y"; architectural opinion without data                  | Ring 3                                        | Not directly publishable; leads only                 |
| **UNVERIFIED_CLAIM**      | Speculation, hearsay, repeated reporting without traceable source                                     | "Rumor says"; "People are saying"; aggregated summaries without links                          | Ring 3 (flagged)                              | Excluded from publication                            |

### Classification Rules

1. **Single contribution → multiple claims → each claim classified independently**
2. **ORIGINAL_FINDING requires**: artifact link (GitHub, paper, benchmark repo) + reproducibility indicators (code, data, Docker, CI)
3. **FIRST_HAND_DISCLOSURE requires**: author identity verified + announcement on canonical channel
4. **INDEPENDENT_ANALYSIS requires**: methodology disclosure + evidence citations + independence statement (no vendor funding for subject)
5. **EXPERT_INTERPRETATION**: explicitly labeled; never auto-promoted
6. **UNVERIFIED_CLAIM**: quarantined; requires independent corroboration before any use

### Deduplication & Corroboration

| Scenario                                      | Handling                                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Same finding from multiple designated experts | Each gets ORIGINAL_FINDING if independent verification; else FIRST_HAND_DISCLOSURE for author, INDEPENDENT_ANALYSIS for others |
| Expert reposts vendor announcement            | Classified as FIRST_HAND_DISCLOSURE (vendor) + EXPERT_INTERPRETATION (expert commentary)                                       |
| Multiple experts cite same paper              | Paper = ORIGINAL_FINDING (authors); expert posts = INDEPENDENT_ANALYSIS or EXPERT_INTERPRETATION                               |
| Expert summarizes own prior work              | FIRST_HAND_DISCLOSURE if new synthesis; EXPERT_INTERPRETATION if pure recap                                                    |

---

## 6. Integration with Three Discovery Rings

Each Signal Desk contribution is classified into **one or more rings** based on its **evidentiary role**, not the contributor's reputation.

### Ring Classification Logic

| Evidence Class                 | Primary Ring       | Secondary Ring | Rationale                                   |
| ------------------------------ | ------------------ | -------------- | ------------------------------------------- |
| ORIGINAL_FINDING (first-party) | Ring 1             | Ring 2         | Canonical disclosure from originator        |
| ORIGINAL_FINDING (research)    | Ring 2             | —              | Methodological rigor; peer-review track     |
| FIRST_HAND_DISCLOSURE          | Ring 1             | —              | Authoritative originator statement          |
| INDEPENDENT_ANALYSIS           | Ring 2             | Ring 3         | Methodology-driven scrutiny                 |
| EXPERT_INTERPRETATION          | Ring 3             | —              | Practitioner signal; requires corroboration |
| UNVERIFIED_CLAIM               | None (quarantined) | —              | Excluded until corroborated                 |

### Multi-Ring Classification

A single contribution **may span rings** when it contains claims of different types:

```text
Example: Boris Cherny posts about Claude Code release (Ring 1: FIRST_HAND_DISCLOSURE)
         + includes benchmark comparison he ran (Ring 2: INDEPENDENT_ANALYSIS)
         + speculates on agent architecture future (Ring 3: EXPERT_INTERPRETATION)
```

**Each claim gets its own ring classification.** The discovery ledger entry records all applicable rings.

### Reputation Never Determines Ring

> **An individual's reputation must never automatically determine the credibility or discovery ring of every contribution.**

- Andrej Karpathy's tutorial → Ring 3 (practitioner insight)
- Andrej Karpathy's nn-zero-to-hero release → Ring 1 (first-party artifact)
- Andrej Karpathy's speculation on AGI timeline → Ring 3 (expert interpretation)

---

## 7. Signal Relevance & Lifecycle Management

### Contributor Registry Schema

```yaml
contributors:
  - id: "burke-holland" # Stable kebab-case ID
    name: "Burke Holland"
    verified: true # Identity confirmed
    verificationDate: "2025-11-10T06:00:00Z"
    verificationMethod: "github-profile + employer-page + blog-byline"
    canonicalProfiles:
      github: "https://github.com/burkeholland"
      x: "https://x.com/burkeholland"
      blog: "https://burkeholland.com"
      employer: "https://learn.microsoft.com/en-us/users/burkeholland"
    sourceChannels:
      - type: "rss"
        url: "https://burkeholland.com/rss.xml"
        status: "active"
        lastFetched: "2025-11-10T06:00:00Z"
        accessNotes: "Standard RSS; no auth"
      - type: "github"
        url: "https://github.com/burkeholland"
        status: "active"
        lastFetched: "2025-11-10T06:00:00Z"
        accessNotes: "Public repos only; GitHub API"
    researchDomains: # Per Taxonomy v2.0
      - "agentic-ai-software-engineering"
      - "architecture-security-governance"
    subdomainTags:
      - "DOM-01-SD03" # Autonomous coding agents
      - "DOM-03-SD01" # Enterprise architecture
    ringAffinity: [1, 3] # Primary rings
    mandatory: true # Designated expert
    status: "active" # active | watchlisted | archived | retired
    addedDate: "2025-11-10T06:00:00Z"
    lastReviewed: "2025-11-10T06:00:00Z"
    notes: "VS Code team; high-signal on AI-assisted dev; RSS verified"
```

### Lifecycle States

| State           | Criteria                                                | Actions                                                    |
| --------------- | ------------------------------------------------------- | ---------------------------------------------------------- |
| **active**      | Meets all discovery criteria; ≥1 channel working        | Automated monitoring; weekly triage                        |
| **watchlisted** | Signal declining; access issues; domain drift           | Increased human review; monthly assessment                 |
| **archived**    | No original contributions ≥12 months; channels inactive | Monitoring paused; historical data preserved               |
| **retired**     | Identity unverifiable; compromised; deceased            | Monitoring stopped; provenance preserved; marked in ledger |

### Provenance Preservation

When classifications change:

- **Original classification retained** in discovery ledger with `classificationHistory` array
- **New classification added** with timestamp, authority, and rationale
- **Source registry entries** updated with `status` change but `addedDate` immutable
- **Cross-references** in dossiers updated via `updatedDate` and diff links

---

## 8. Editorial Independence

### Signal Desk → Publication Pipeline

```text
Signal Desk Discovery
        │
        ▼
Discovery Ledger (ring-classified, evidence-classified)
        │
        ▼
Human Triage Gate (§11.3 Source Acceptance)
        │
        ▼
Candidate News (temporal eligibility, novelty, evidence verification)
        │
        ▼
Editorial Review (vendor-neutral ranking, BLUF, ADHD readability)
        │
        ▼
Publication
```

### Guardrails

| Guardrail                           | Implementation                                                         |
| ----------------------------------- | ---------------------------------------------------------------------- |
| **No auto-promotion**               | Signal Desk items enter same candidate pipeline as all sources         |
| **Temporal eligibility enforced**   | Contract §5.1 windows applied per content type                         |
| **Novelty classification required** | `NEW` / `CATCH_UP` / `TIME_UNVERIFIED` per `novelty-classification.ts` |
| **Evidence verification required**  | L1+ for all claims per contract §4.1                                   |
| **Vendor-neutral ranking**          | No preferential treatment for designated experts                       |
| **Blind spot detection**            | Quarterly audit: domain coverage vs. Signal Desk contributors          |

### Blind Spot Detection

| Check                         | Frequency   | Method                                                    |
| ----------------------------- | ----------- | --------------------------------------------------------- |
| Domain coverage gap analysis  | Quarterly   | Compare Taxonomy subdomains vs. active contributor tags   |
| Emerging topic detection      | Monthly     | Keyword clustering on Ring 2/3 items without expert match |
| Geographic/language diversity | Bi-annually | Contributor location/language audit                       |
| Affiliation concentration     | Quarterly   | Employer distribution analysis                            |

---

## 9. Implementation & Validation

### Files Created/Modified

| File                                     | Purpose                                                                | Status       |
| ---------------------------------------- | ---------------------------------------------------------------------- | ------------ |
| `docs/signal-desk.md`                    | This specification                                                     | **NEW**      |
| `data/contributors.yml`                  | Contributor registry (stable IDs, channels, domains)                   | **NEW**      |
| `data/schemas/contributor-registry.json` | JSON Schema for contributor entries                                    | **NEW**      |
| `data/schemas/discovery-ledger.json`     | Extended with `evidenceClass`, `ringClassification[]`, `contributorId` | **MODIFIED** |
| `data/schemas/candidate-news.json`       | Extended with `signalDeskOrigin`, `evidenceClassDistribution`          | **MODIFIED** |
| `src/lib/signal-desk.ts`                 | Core logic: classification, ring mapping, lifecycle                    | **NEW**      |
| `src/lib/signal-desk.test.ts`            | Validation tests                                                       | **NEW**      |
| `docs/discovery-rings.md`                | Updated Ring 3 with Signal Desk integration                            | **MODIFIED** |

### Validation Checklist

| Check                                 | Command                                                                         | Expected                          |
| ------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------- |
| Contributor registry validates        | `pnpm exec vitest run src/lib/signal-desk.test.ts`                              | All tests pass                    |
| Discovery ledger schema validates     | `ajv validate -s data/schemas/discovery-ledger.json -d data/discovered/*.jsonl` | No errors                         |
| Candidate news schema validates       | `ajv validate -s data/schemas/candidate-news.json -d data/candidates/*.jsonl`   | No errors                         |
| Mandatory expert channels accessible  | Manual verification script                                                      | All 6 experts: ≥1 working channel |
| Ring classification logic correct     | Unit tests                                                                      | 100% coverage on mapping table    |
| Evidence classification logic correct | Unit tests                                                                      | 100% coverage on taxonomy         |
| Build passes                          | `pnpm run build`                                                                | Success                           |
| TypeScript checks                     | `pnpm astro check`                                                              | No errors                         |

### Verification Evidence Required

For each mandatory expert, the implementation **must** produce:

```text
✅ Contributor entry in data/contributors.yml with stable ID
✅ Verified canonical profile URLs (GitHub, X, blog, employer)
✅ At least one working RSS/Atom/GitHub Atom feed URL
✅ Documented access limitations (if any)
✅ Research domain tags mapping to Taxonomy v2.0
✅ Ring affinity with justification
✅ Last verification timestamp within 30 days
```

### Unresolved Access Limitations (Known)

| Expert           | Channel        | Limitation                     | Status                   |
| ---------------- | -------------- | ------------------------------ | ------------------------ |
| Burke Holland    | X              | API v2 paid; Nitter fallback   | RSS blog works; X manual |
| Daniel Mettler   | X              | API v2 paid; Nitter fallback   | Blog RSS works           |
| Matt Pocock      | YouTube        | Transcript availability varies | RSS blog + GitHub work   |
| Robert C. Martin | Blog           | No native RSS (Atom only)      | Atom feed works          |
| Boris Cherny     | Anthropic Blog | No native RSS; Cloudflare      | Feeder-generated feed    |
| Andrej Karpathy  | YouTube        | Transcript availability varies | GitHub + blog RSS work   |

---

## 10. Governance

| Aspect                                         | Authority                                                       |
| ---------------------------------------------- | --------------------------------------------------------------- |
| Mandatory expert list changes                  | Editor-in-Chief + 2 reviewers (contract amendment §12.2)        |
| Dynamic discovery criteria                     | Editor (Source Acceptance gate)                                 |
| Evidence classification rules                  | Editor + 1 reviewer                                             |
| Ring classification logic                      | Editor (aligned with Discovery Rings spec)                      |
| Contributor lifecycle (promote/demote/archive) | Editor (demote/archive); Editor-in-Chief (promote to mandatory) |
| Blind spot audit                               | Editor-in-Chief (quarterly)                                     |

---

**End of Signal Desk Specification** — This document operationalizes expert contributor monitoring per the AI Intelligence Publication Contract. All automation, tooling, and human processes must conform.
