# Three Complementary Discovery Rings

**Derived from:** AI Intelligence Publication Contract §3 (Source Discovery), Research Taxonomy v2.0
**Status:** Authoritative Specification
**Version:** 2.0
**Last Updated:** 2025-11-10

---

## Discovery Philosophy

> **Discovery must precede editorial selection.**

The three rings operate in parallel, each with distinct source types, verification requirements, and latency profiles. No ring is "better" — they capture different classes of signal. An item discovered in Ring 2 (arXiv preprint) may be more architecturally significant than a Ring 1 vendor announcement. The contract's tier system (§3.1) governs trust weight, not the ring.

**Research Taxonomy Integration (v2.0):** Each discovered item is classified against the six research domains (Agentic AI & Software Engineering, Models/Inference/Scientific, Architecture/Security/Governance, Enterprise Adoption/Organizational, Economics/Business Impact, Independent Research/Advisory). Sources may span multiple domains; classification is by content, not source identity. Ring classification reflects the role and provenance of a source rather than assuming every publication from an organization has the same evidentiary status.

---

## Ring 1: Official & Authoritative Sources

**Primary purpose:** Capture canonical, versioned, traceable disclosures from originators

### Source Categories (Tier 1 & 2 per §3.1)

| Category                                 | Examples                                                                                                 | Discovery Mechanism                                                                                                                             | Tier | Max Age (§5.1)                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------- |
| **Standards bodies**                     | IETF RFCs, W3C Recommendations, ISO/IEC JTC1, OASIS                                                      | RSS/Atom feeds, API endpoints, GitHub org watches                                                                                               | 1    | 24 months                       |
| **Cloud provider API docs & SLA**        | AWS API Reference, GCP REST docs, Azure Swagger, SLA pages                                               | RSS (AWS/GCP/Azure blogs), doc change webhooks, versioned API changelogs                                                                        | 1    | 24 months                       |
| **Deprecation & sunset notices**         | AWS Deprecation Calendar, GCP Deprecation Policy, Azure Retirements                                      | Dedicated RSS feeds, email alerts, GitHub issue watches on provider docs repos                                                                  | 1    | 30 days (urgency override §5.3) |
| **Official benchmark repositories**      | MLPerf (mlcommons/results), LLMPerf, MLPerf Inference                                                    | GitHub releases, watch on `mlcommons/*`, `mlperf/*` orgs                                                                                        | 1    | 24 months                       |
| **Peer-reviewed venues (proceedings)**   | NeurIPS, ICML, ICLR, MLSys, OSDI, SOSP, PLDI, ASPLOS                                                     | Conference proceedings RSS, DBLP feeds, OpenReview API, venue GitHub orgs                                                                       | 1    | 24 months                       |
| **Cloud engineering blogs**              | AWS Architecture Blog, Google Cloud Blog, Azure Architecture Center, Cloudflare Blog                     | RSS/Atom (curated OPML per §3.2), tag/category filters for architecture/patterns/cost                                                           | 2    | 18 months                       |
| **Foundation model release notes**       | Meta Llama releases, Mistral releases, Anthropic model cards, Google Gemma                               | GitHub releases on org repos, Hugging Face model card RSS, vendor announcement feeds                                                            | 2    | 18 months                       |
| **CNCF project milestones**              | Graduation/incubation announcements, major version releases                                              | CNCF blog RSS, GitHub org watches (`cncf/*`), landscape change feeds                                                                            | 2    | 18 months                       |
| **LWN.net kernel coverage**              | LWN Kernel Index, feature merges, subsystem updates                                                      | LWN.net RSS (subscription), weekly edition parsing                                                                                              | 2    | 18 months                       |
| **AI-powered IDE & editor releases**     | Visual Studio Code (stable/Insiders), Cursor, Zed, Windsurf (Codeium)                                    | Official RSS feeds (vscode/feed.xml, cursor.com/changelog/rss.xml, zed.dev/blog.rss, windsurf.com/feed.xml), GitHub releases for extension APIs | 2    | 18 months                       |
| **Coding agent & CLI releases (vendor)** | GitHub Copilot CLI, Anthropic Claude Code, OpenAI Codex CLI, Google Gemini CLI, JetBrains Junie          | GitHub releases Atom feeds (github/copilot-cli, anthropics/claude-code, openai/codex, google-gemini/gemini-cli), Junie category RSS             | 2    | 18 months                       |
| **AI-integrated IDE platforms**          | Apple Xcode (AI coding intelligence), Visual Studio (GitHub Copilot SDK/BYOM), JetBrains IDEs (Junie/AI) | Apple Developer releases RSS, Microsoft Visual Studio Blog RSS, JetBrains Junie RSS                                                             | 2    | 18 months                       |
| **GitHub Copilot autonomous agent**      | Copilot coding agent (background agent), Copilot in VS Code agent mode                                   | GitHub Changelog RSS (filtered by copilot/coding-agent labels), Havoptic per-tool feeds                                                         | 2    | 18 months                       |

### Ring 1 Discovery Pipeline (Automated per §11.2)

```mermaid
flowchart LR
    RSS[RSS/Atom Feeds\n(Tier 1/2 OPML)] --> PARSE[Parse & Normalize]
    GH[GitHub API\n(Releases, Issues, Commits)] --> PARSE
    DOC[Doc Change Webhooks\n(API refs, SLAs)] --> PARSE
    PARSE --> DEDUPE[Content Hash\nDeduplication]
    DEDUPE --> ENRICH[Enrich: tier, tags,\npublishedAt, authors]
    ENRICH --> LEDGER[Discovery Ledger\n(data/discovered/*.jsonl)]
```

### Ring 1 Quality Signals (Automated Filters)

- **Version traceability:** Source must expose version/changelog (semver, date-based, or commit SHA)
- **Authoritative origin:** Domain matches known originator (aws.amazon.com, kubernetes.io, ietf.org, etc.)
- **Permalink stability:** URL pattern indicates permanent reference (not ephemeral marketing page)
- **Machine-readable metadata:** RFC frontmatter, OpenAPI spec, GitHub release JSON, arXiv metadata

### Ring 1 Exclusions (Per §1.5, §3.1 Tier 4)

- ❌ Vendor press releases, product launches, funding announcements
- ❌ Marketing comparison matrices, "top 10" lists
- ❌ Event keynotes without accompanying technical artifact
- ❌ Analyst reports behind paywalls

---

## Ring 2: Scientific Research & Technical Scrutiny

**Primary purpose:** Capture original research, independent experiments, security analysis with methodological rigor, **and authoritative research/advisory on enterprise AI adoption, economics, governance, productivity, and organizational transformation**

### Source Categories (Tier 1, 2 & 3 per §3.1)

| Category                                                  | Examples                                                                                                                                                                                                                                                                 | Discovery Mechanism                                                                                                                                                                                                      | Tier                                                             | Max Age (§5.1)             |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | -------------------------- |
| **arXiv preprints (daily query §3.2)**                    | `cs.LG` (Machine Learning), `cs.CL` (Computation & Language), `cs.DC` (Distributed/Parallel/Cluster), `cs.SE` (Software Engineering), `stat.ML` (ML Statistics)                                                                                                          | arXiv API daily query (categories + keywords), RSS per category, Semantic Scholar API for citations                                                                                                                      | 1 (venue-track) / 3 (preprint only)                              | 12–24 months               |
| **Conference proceedings (at publication §3.2)**          | NeurIPS, ICML, ICLR, MLSys, OSDI, SOSP, PLDI, ASPLOS, USENIX ATC, EuroSys                                                                                                                                                                                                | OpenReview API, DBLP XML, venue GitHub proceedings repos, conference YouTube channels                                                                                                                                    | 1                                                                | 24 months                  |
| **Security advisories**                                   | CVE (NVD), GHSA (GitHub Security), AWS/GCP/Azure Security Bulletins, CNCF Security Advisories                                                                                                                                                                            | NVD API / CVE RSS, GHSA API, cloud provider security RSS, OSV.dev API                                                                                                                                                    | 1                                                                | 30 days (urgency override) |
| **Authoritative research & advisory (public feeds only)** | Gartner press releases (Magic Quadrant, Hype Cycle, CIO surveys), McKinsey Global Institute (MGI) research on AI economics/workforce/productivity, Forrester public blogs (predictions, agentic AI), IDC RSS feeds (market forecasts, spending guides, agentic commerce) | RSS feeds: Gartner newsroom (Cloudflare-protected — requires browser-like fetcher), McKinsey Insights, Forrester blogs, IDC press releases + category feeds. **Only public content monitored — full reports paywalled.** | 2 (original research with methodology) / 3 (consultancy opinion) | 12–18 months               |
| **Independent reproduction studies**                      | "Reproducing [Paper X]", "Benchmarking [Model Y] on [Hardware Z]", artifact evaluation results                                                                                                                                                                           | GitHub search (topic:reproduction, replication), Papers with Code reproduction tracker, ML Reproducibility Challenge                                                                                                     | 3                                                                | 12 months                  |
| **Technical scrutiny & critique**                         | Distill.pub articles, peer review commentary (OpenReview), formal verification results, side-channel analyses                                                                                                                                                            | Distill RSS, OpenReview API (public reviews), conference artifact evaluation tracks, specialized venues (IEEE S&P, USENIX Security)                                                                                      | 1–3                                                              | 24 months                  |
| **Formal methods & verification**                         | TLA+ specs, Coq/Isabelle proofs, model checking results, contract verification                                                                                                                                                                                           | GitHub topics (tla, formal-verification, model-checking), conference artifact repos (CAV, FM, NFM)                                                                                                                       | 1                                                                | 24 months                  |

### Ring 2 Discovery Pipeline (Automated + Curated)

```mermaid
flowchart LR
    ARXIV[arXiv API\nDaily Category Query] --> FILTER[Keyword + Author\nFiltering]
    CONF[Conference Proceedings\n(OpenReview, DBLP)] --> FILTER
    SEC[Security Feeds\n(NVD, GHSA, OSV)] --> FILTER
    ADVISORY[Advisory RSS Feeds\n(Gartner, McKinsey, Forrester, IDC)] --> FILTER
    REPRO[Reproduction Repos\n(GitHub Search)] --> FILTER
    FILTER --> SCORE[Relevance Scoring\n(architectural signal)]
    SCORE --> CLASSIFY[Classify: Research vs Opinion\n(methodology check)]
    CLASSIFY --> HUMAN[Human Triage Gate\n(§11.3: Source Acceptance)]
    HUMAN --> LEDGER[Discovery Ledger]
```

### Ring 2 Quality Signals (Verification-Driven)

- **Methodology disclosure:** Explicit benchmark methodology, hardware spec, precision, batch size, warm-up (§4.2 checklist)
- **Artifact availability:** Code, data, Docker/Conda/Nix, GitHub Actions CI reproducing key results (§4.1 L2)
- **Statistical rigor:** n ≥ 30, confidence intervals, confounder handling (thermal, noisy neighbors) (§4.2)
- **Independent replication:** Third-party reproduction cited (different lab/cloud) — qualifies for L3 (§4.1)
- **Peer review signal:** OpenReview scores, artifact evaluation badges, Distill peer review
- **Advisory research quality gates:** Original research distinguished from consultancy opinion:
  - Methodology disclosed (survey design, sample, data sources) → Tier 2
  - Data cited with access path (even if aggregated) → Tier 2
  - Forecast track record documented → Tier 2
  - Analyst opinion without methodology/data → Tier 3 (L0 only)
  - Conflict of interest disclosed (vendor funding, consulting engagements) → noted in dossier

### Ring 2 Exclusions

- ❌ Preprints without methodological detail (abstract-only, position papers without experiments)
- ❌ ArXiv submissions in non-relevant categories (physics, math unless applied to AI systems)
- ❌ Security "news" without CVE/GHSA identifier or vendor advisory
- ❌ Benchmark claims without hardware/environment/precision specification
- ❌ **Paywalled full reports** — only public summaries (press releases, blog posts, RSS items) monitored
- ❌ **Analyst opinion without methodology** — classified as Tier 3, L0 only, flagged in UI
- ❌ **Vendor-funded research without disclosure** — excluded or downgraded

---

## Ring 3: Practitioner & Community Signal

**Primary purpose:** Capture operational experience, maintainer insights, and community-validated patterns from the field

### Source Categories (Tier 3 per §3.1)

| Category                                 | Examples                                                                                                                                         | Discovery Mechanism                                                                                                                | Tier | Max Age (§5.1) |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------- |
| **Reproducible GitHub repos**            | ≥50 stars + CI green, architecture patterns, operator tooling, cost analyzers                                                                    | GitHub Search API (stars:≥50, archived:false, topics:architecture/patterns/operators), Dependabot alerts for dependency signals    | 3    | 12 months      |
| **Practitioner technical posts**         | Known authors with track record (e.g., cloud advocate blogs, principal engineer posts, CNCF TAG leads)                                           | Curated author list RSS/Atom, Mastodon/Bluesky lists with RSS bridge, personal site feeds                                          | 3    | 12 months      |
| **Conference talk recordings + slides**  | KubeCon, CNCF member webinars, MLSys talks, cloud provider re:Invent/Next/Build recordings with slides                                           | YouTube channel RSS (with slides in description), conference GitHub repos (slides), Speaker Deck / SlideShare RSS                  | 3    | 12 months      |
| **Specialist newsletters**               | LWN.net (weekly), TLDR AI, The Batch (deeplearning.ai), Papers with Code, Architecture Notes, specific Substack/MailerLite technical newsletters | Newsletter RSS/Atom, email-to-RSS bridges, curated OPML import                                                                     | 3    | 12 months      |
| **Maintainer discussions**               | GitHub Discussions on flagship repos, RFC PRs, design docs in repos, CNCF TAG meeting notes                                                      | GitHub Discussions API (watched repos), GitHub PR search (label:design/rfc), HackMD/Google Docs public links from repos            | 3    | 12 months      |
| **Community incident reports**           | Postmortems (public), incident retrospectives, chaos engineering reports, game day results                                                       | GitHub repo search (postmortem, incident, retrospective), Statuspage.io public postmortems, Blameless/Incident.io public libraries | 3    | 12 months      |
| **Open source project milestones**       | CNCF sandbox→incubating→graduation, major version releases with migration guides, deprecation timelines                                          | CNCF landscape API, GitHub releases on graduated projects, CHANGELOG.md parsing                                                    | 3    | 12 months      |
| **Community coding agents & AI editors** | Cline, OpenCode, Aider, Kilo Code, Goose, Continue (acquired)                                                                                    | GitHub releases Atom feeds, official RSS (opencode.ai/changelog.xml), Havoptic per-tool feeds                                      | 3    | 12 months      |
| **AI coding tool aggregators**           | Havoptic (combined + per-tool feeds), Agentic Index, DevAgentRadar                                                                               | RSS feeds (havoptic.com/feed.xml, agenticindex.io/feeds/changes.xml, devagentradar.com/api/radar/feed.xml)                         | 3    | 12 months      |

### Ring 3 Discovery Pipeline (Curated + Semi-Automated)

```mermaid
flowchart LR
    AUTHORS[Curated Author List\n(~50 practitioners)] --> FETCH[Fetch RSS/Atom\n+ Social Bridges]
    REPOS[Watched Repos\n(~200 flagship)] --> FETCH
    NEWS[Specialist Newsletters\n(~15 curated)] --> FETCH
    SIGNALDESK[Signal Desk Contributors\n(Mandatory + Watchlist)] --> FETCH
    FETCH --> EXTRACT[Extract: claims,\npatterns, trade-offs]
    EXTRACT --> TRIAGE[Human Triage\n(§11.3: Source Acceptance)]
    TRIAGE --> LEDGER[Discovery Ledger]
```

### Ring 3 Quality Signals (Corroboration-Driven)

- **Track record:** Author has ≥3 prior Tier 1/2 citations or published pattern catalogs/ADRs
- **Reproducibility:** GitHub repo has CI green, README with run instructions, issue response < 30 days
- **Community validation:** ≥50 stars, ≥5 contributors, referenced in Tier 1/2 sources
- **Specificity:** Concrete trade-offs, failure modes, migration paths — not generic advice
- **Recency of practice:** Active maintenance (commit < 90 days), not archived/stale
- **Signal Desk evidence classification:** Items tagged with evidence class (ORIGINAL_FINDING, FIRST_HAND_DISCLOSURE, INDEPENDENT_ANALYSIS, EXPERT_INTERPRETATION, UNVERIFIED_CLAIM) and ring classification per Signal Desk §5–6

### Ring 3 Exclusions

- ❌ Generic "how-to" tutorials without architectural context
- ❌ Influencer threads, viral posts without technical substance
- ❌ Unmaintained repos (archived, no commits > 1 year, CI failing)
- ❌ Opinion pieces without traceable evidence or reproducible artifact
- ❌ Affiliate content, sponsored newsletters, vendor community programs
- ❌ UNVERIFIED_CLAIM items (quarantined pending corroboration)

---

## Cross-Ring Coordination

### Deduplication Strategy

| Scenario                                                                              | Resolution                                                                                                        |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Same paper appears in Ring 1 (conference proceedings) and Ring 2 (arXiv preprint)     | **Ring 1 wins** — conference version is peer-reviewed, canonical. arXiv version linked as `preprintOf` in ledger. |
| Vendor blog (Ring 1) announces feature; practitioner (Ring 3) publishes deep-dive     | **Both retained** — Ring 1 = canonical spec; Ring 3 = operational experience. Linked via `relatedTo` in ledger.   |
| Security advisory (Ring 2) + vendor bulletin (Ring 1) + community postmortem (Ring 3) | **All three** — each ring captures different dimension (vulnerability, patch, operational impact).                |

### Ring-Aware Triage Rules (Per §11.3 Source Acceptance Gate)

| Ring   | Minimum Tier for Auto-Promote      | Human Review Required                                                                                |
| ------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Ring 1 | Tier 1 → auto-promote to candidate | Tier 2 (editor validates credibility)                                                                |
| Ring 2 | Tier 1 (venue) → auto-promote      | Tier 2 advisory (editor checks methodology vs opinion); Tier 3 preprints (editor checks methodology) |
| Ring 3 | Never auto-promote                 | All Tier 3 (editor validates track record + reproducibility)                                         |

### Temporal Alignment (Per §5.1)

- **Ring 1** drives **Daily Brief** (14-day window) — official announcements, deprecations, releases
- **Ring 2** drives **Weekly Deep-Dive** (90-day window) — research, benchmarks, security analysis
- **Ring 3** drives **Pattern Catalog** (24-month window) — validated patterns, migration guides, anti-patterns
- **All rings** feed **ADRs** (12-month context window) — architectural decisions need multi-source corroboration

---

## Research Taxonomy Integration — Ring-to-Domain Mapping

Per Research Taxonomy v2.0, each ring has primary and secondary domain affinities. This mapping guides discovery pipeline configuration and triage prioritization.

### Ring 1: Official & Authoritative Sources — Domain Mapping

| Domain                                      | Subdomain Examples                                                                                           | Source Families                                                                                                                                                                         | Notes                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Agentic AI & Software Engineering**       | Agent Skills, MCP, Autonomous Coding Agents, Agent Evaluation, Agent Identity/Sandboxing, Agent Supply Chain | `github-releases-agent-frameworks`, `mcp-specifications`, `coding-agent-vendor-releases`, `ai-ide-releases`, `benchmark-repositories`, `agent-security-papers`, `supply-chain-security` | Vendor-originated releases, official specs               |
| **Models, Inference & Scientific Research** | Foundation Models, Open-Weight Models, Inference Engines, AI Hardware                                        | `major-ai-lab-blogs`, `model-release-repos`, `inference-engine-repos`, `hardware-vendor-blogs`, `mlperf-results`, `cloud-infrastructure-blogs`                                          | Model releases, benchmarks, hardware announcements       |
| **Architecture, Security & Governance**     | Enterprise Architecture, Open Standards, AI Security, Governance, Reliability                                | `cloud-architecture-blogs`, `standards-bodies`, `security-advisories`, `regulatory-bodies`, `reliability-engineering-blogs`, `finops-foundation`                                        | Standards, deprecations, security advisories, compliance |
| **Enterprise AI Adoption & Organizational** | Adoption Strategies (cloud provider guides)                                                                  | `cloud-provider-adoption-guides`                                                                                                                                                        | Official adoption frameworks                             |
| **Economics, Business Impact**              | Infrastructure Economics (cloud pricing), Market Structure (vendor financials)                               | `cloud-pricing`, `vendor-financials`                                                                                                                                                    | Authoritative pricing, public financials                 |
| **Independent Research & Advisory**         | Advisory Press Releases (public summaries)                                                                   | `gartner-public`, `mckinsey-mgi-public`, `forrester-public`, `idc-public`                                                                                                               | Public summaries only; full reports paywalled            |

### Ring 2: Scientific Research & Technical Scrutiny — Domain Mapping

| Domain                                      | Subdomain Examples                                                                                                     | Source Families                                                                                                                                             | Notes                                               |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Models, Inference & Scientific Research** | Foundation Models (papers), Open-Weight Optimization, Inference Architectures, Original Research/Reproducibility       | `arxiv-cs-cl-cs-lg`, `arxiv-cs-lg`, `conference-proceedings`, `openreview`, `distill-pub`, `reproduction-repos`, `quantization-tools`, `local-llm-runtimes` | Methodology-driven; preprints, peer-reviewed venues |
| **Architecture, Security & Governance**     | AI Security Research, Formal Methods, Governance Frameworks, XAI                                                       | `ai-security-research`, `threat-modeling-frameworks`, `governance-frameworks`, `xai-research`, `formal-verification-repos`                                  | Security papers, formal verification artifacts      |
| **Independent Research & Advisory**         | Academic Institutions, Independent Labs, Safety Institutes, Original Surveys/Empirical Studies, Methodology Assessment | `academic-institutions`, `independent-labs`, `safety-institutes`, `survey-research`, `empirical-studies`, `methodology-frameworks`, `evidence-frameworks`   | Methodology disclosure required for Tier 2          |
| **Enterprise AI Adoption & Organizational** | Developer Productivity Research, Workforce Studies, Skills Development                                                 | `developer-productivity-research`, `dora-reports`, `github-research`, `workforce-research`, `organizational-design`                                         | Empirical studies with disclosed methodology        |
| **Economics, Business Impact**              | Productivity Measurement, Market Analysis, Macroeconomic Research                                                      | `productivity-research`, `roi-frameworks`, `vendor-impact-studies`, `academic-economics`, `market-analysis`, `macroeconomic-research`, `labor-economics`    | Economic research with data/methodology             |
| **Agentic AI & Software Engineering**       | Agent Evaluation Benchmarks                                                                                            | `agent-evaluation-frameworks`, `benchmark-repositories`                                                                                                     | SWE-bench, AgentBench, τ-bench papers               |

### Ring 3: Practitioner & Community Signal — Domain Mapping

| Domain                                      | Subdomain Examples                                                    | Source Families                                                                                                                        | Notes                                     |
| ------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Agentic AI & Software Engineering**       | Community Coding Agents, Practitioner Blogs, AI Editor Communities    | `coding-agent-community-releases`, `havoptic-aggregated`, `agentic-index`, `devagentradar`, `simon-willison-blog`, `hamel-husain-blog` | Requires corroboration; track record key  |
| **Enterprise AI Adoption & Organizational** | Practitioner Adoption Experiences, DevEx Posts, Team Topology Changes | `github-research`, `engineering-blogs`, `cto-blogs`                                                                                    | Operational experience, not vendor claims |
| **Architecture, Security & Governance**     | Incident Reports, Postmortems, Operational Patterns                   | `community-incident-reports`, `postmortem-repos`, `srecon-talks`                                                                       | Real operational data                     |
| **Models, Inference & Scientific Research** | Local LLM Runtime Experiences, Quantization Tips, Hardware Tuning     | `local-llm-runtimes`, `practitioner-benchmarks`                                                                                        | Community-tested, not vendor specs        |
| **Economics, Business Impact**              | Practitioner Cost Optimization, FinOps Patterns                       | `finops-foundation`, `cost-optimization-blogs`                                                                                         | Field-tested cost patterns                |
| **Independent Research & Advisory**         | Credible Independent Analyst Posts                                    | `credible-analysts`                                                                                                                    | Curated list; track record required       |

---

## Implementation Checklist

### Ring 1 (Automated — High Volume, High Precision)

- [ ] Curate OPML with 50+ Tier 1/2 RSS feeds (standards, cloud docs, benchmarks, venues)
- [ ] GitHub App watching 30+ orgs/releases (mlcommons, cncf, kubernetes, cloud providers, **github/copilot-cli, anthropics/claude-code, openai/codex, google-gemini/gemini-cli**)
- [ ] Doc change webhooks for AWS/GCP/Azure API reference, SLA pages
- [ ] **AI IDE/editor RSS feeds:** vscode/feed.xml, cursor.com/changelog/rss.xml, zed.dev/blog.rss, windsurf.com/feed.xml
- [ ] **Coding agent CLI feeds:** GitHub releases Atom for copilot-cli, claude-code, codex, gemini-cli; Junie category RSS
- [ ] **AI-integrated IDE platforms:** Apple Developer releases RSS, Microsoft Visual Studio Blog RSS, JetBrains Junie RSS
- [ ] **GitHub Copilot autonomous agent:** GitHub Changelog RSS (label-filtered for copilot/coding-agent), Havoptic per-tool feeds
- [ ] Daily arXiv API query for Ring 2 categories (separate pipeline)
- [ ] Content hash deduplication across all Ring 1 sources
- [ ] Schema validation → `data/discovered/ring1-YYYY-MM-DD.jsonl`

### Ring 2 (Semi-Automated — Medium Volume, High Verification)

- [ ] arXiv daily query: `cs.LG`, `cs.CL`, `cs.DC`, `cs.SE`, `stat.ML` + keyword filter (architecture, systems, cost, agents, sandbox, verification)
- [ ] OpenReview API integration for NeurIPS/ICML/ICLR/MLSys/OSDI/SOSP
- [ ] NVD CVE feed + GHSA API + OSV.dev for security
- [ ] **Advisory RSS feeds:** Gartner newsroom (Cloudflare-protected — requires browser-like fetcher or manual review), McKinsey Insights, Forrester blogs, IDC press releases (`https://www.idc.com/rss/idcpressreleases.xml`) + category feeds (top10predictions, cloudcomputing, software, services, etc.)
- [ ] Papers with Code reproduction tracker API
- [ ] Relevance scoring model (architectural signal vs. pure ML metrics)
- [ ] **Advisory classification step:** methodology detection (survey design, sample, data cited) vs. opinion
- [ ] Human triage queue for editor review (Source Acceptance gate)
- [ ] Schema validation → `data/discovered/ring2-YYYY-MM-DD.jsonl`

### Ring 3 (Curated — Low Volume, High Context)

- [ ] Maintain curated author list (~50 practitioners with track record)
- [ ] Maintain watched repo list (~200 flagship: CNCF graduated, cloud provider SDKs, **agent frameworks: cline/cline, anomalyco/opencode, Aider-AI/aider, Kilo-Org/kilocode, aaif-goose/goose**)
- [ ] Curated newsletter OPML (~15 specialist newsletters)
- [ ] GitHub Discussions/RFC watch on watched repos
- [ ] YouTube channel RSS for conference recordings with slides
- [ ] **Community coding agent feeds:** GitHub releases Atom for Cline, OpenCode, Aider, Kilo Code, Goose; OpenCode changelog RSS
- [ ] **AI coding tool aggregators:** Havoptic combined/per-tool feeds, Agentic Index changes feed, DevAgentRadar feed
- [ ] Weekly human curation session (editor reviews, extracts claims/patterns)
- [ ] Schema validation → `data/discovered/ring3-YYYY-MM-DD.jsonl`

---

## Governance

| Aspect                              | Authority                                           |
| ----------------------------------- | --------------------------------------------------- |
| **Ring source list changes**        | Editor (Source Acceptance gate §11.3)               |
| **Tier reassignment**               | Editor + 1 reviewer (contract amendment §12.2)      |
| **Discovery pipeline failures**     | Automation alerts (§11.4) → Editor triage           |
| **Cross-ring deduplication policy** | This document (amendable per §12.2)                 |
| **Max age overrides**               | Contract §5.3 (deprecation notices always eligible) |

---

**End of Discovery Rings Specification** — This document operationalizes §3 of the AI Intelligence Publication Contract. All discovery automation, tooling, and human processes must conform.
