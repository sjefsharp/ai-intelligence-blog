# Editorial Selection Stage

**Status:** Implemented (2026-11-11)
**Module:** `src/lib/editorial-selection/`
**Script:** `scripts/run-editorial-selection.ts`
**Report schema:** `data/schemas/editorial-selection.json`

---

## 1. Purpose

The editorial selection stage is the eighth step of the publication pipeline:

```text
Source Discovery → Retrieval → Temporal Classification → Claim Verification
  → Canonical Fact Dossier → Omission Review
  → Seven-Day Historical Regression
  → Editorial Ranking & Selection (this stage)
  → Publication
```

It consumes the validated canonical fact dossier, the omission-review report and
the seven-day historical regression report, and determines which verified AI
developments deserve coverage in the daily AI Intelligence edition.

It does **not** re-implement source retrieval, temporal classification, evidence
verification, omission detection or historical regression. It does not generate
articles, publish content, activate scheduled jobs, modify provider
configuration or deploy the website.

---

## 2. Architectural responsibility

### 2.1 Inputs

| Input                        | Source                                   | Required                 |
| ---------------------------- | ---------------------------------------- | ------------------------ |
| Canonical fact dossier       | `data/fact-dossiers/edition_<date>.json` | Yes                      |
| Omission review report       | `data/omission-reviews/<date>_*.json`    | No (flagged when absent) |
| Historical regression report | `data/historical-regression/`            | No (flagged when absent) |

### 2.2 Outputs

One structured, versioned editorial selection manifest per edition:

```text
data/editorial-selection/<editionDate>_<generatedAt>.json
data/editorial-selection/index.json
```

The manifest is the single hand-off to downstream Dutch and English publication
generators. They must not independently select or reinterpret the news.

### 2.3 Processing sequence

1. **Eligibility** — authoritative temporal, evidence, novelty-statement and
   duplicate gates.
2. **Dimension assessment** — eight evidence-backed dimensions (A–H).
3. **Materiality** — documented deterministic heuristic over primary dimensions.
4. **Merge detection** — combine related candidates, preserve provenance.
5. **Decision model** — SELECTED / MERGED / EXCLUDED_* / DEFERRED / CATCH_UP / REVIEW.
6. **Ordering** — justified publication order and narrative preparation.
7. **Concentration & blind-spot review** — adversarial review of the selection.
8. **Optional model-assisted internal consistency check** — free inference only.
9. **Manifest assembly and persistence**.

---

## 3. Editorial eligibility gate

Before ranking, every candidate's eligibility is established from authoritative
upstream results:

- Material new information was first publicly disclosed inside the exact
  05:00–05:00 Europe/Amsterdam edition window.
- The candidate has sufficient evidence to support its material claims.
- Its novelty statement identifies what actually changed.
- Historical comparisons distinguish new facts from repeated reporting.
- Critical uncertainties and evidence limitations are explicit.
- The candidate is not an unresolved duplicate.
- Significant findings from the omission review are incorporated or flagged.

### 3.1 Eligibility states

| State                  | Meaning                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| `ELIGIBLE`             | Passes temporal, evidence, novelty-statement and duplicate gates. |
| `ELIGIBLE_CATCH_UP`    | Older material that qualifies only as dated catch-up.             |
| `CONDITIONAL`          | Passes hard gates but carries flagged uncertainty.                |
| `INELIGIBLE_TEMPORAL`  | Fails the novelty eligibility gate.                               |
| `INELIGIBLE_EVIDENCE`  | Fails the evidence sufficiency gate.                              |
| `INELIGIBLE_DUPLICATE` | Unresolved duplicate of another candidate.                        |

### 3.2 Evidence sufficiency

| Tier       | Rule                                                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `STRONG`   | ≥1 claim classified `VERIFIED_FACT`, `RESEARCH_FINDING` or `ORIGINAL_REPORTING` with traceable evidence and either L1+ verification or independent corroboration. |
| `ADEQUATE` | ≥1 claim classified in the strong set or `VENDOR_CLAIM` / `EXPERT_INTERPRETATION` with traceable evidence.                                                        |
| `WEAK`     | Only `INFERENCE`, `SPECULATION` or `UNVERIFIED`, or no traceable evidence.                                                                                        |

Credible original investigative reporting is **not** excluded merely because
official first-party confirmation is absent. Attribution, corroboration, evidence
quality and uncertainty are assessed and surfaced.

### 3.3 Duplicates

- **Unresolved duplicate** (same document, identical statement, identical
  publication timestamp) → `INELIGIBLE_DUPLICATE`.
- **Resolved duplicate** (same document with a determinable primary, for example
  through distinct publication timestamps) → handled by the merge model.
- Independent findings concerning the same vendor or topic are never treated as
  duplicates.

---

## 4. Evaluation dimensions

Every eligible candidate is assessed across eight dimensions. Levels are primary;
numeric scores are a documented deterministic heuristic, never an apparently
objective measurement.

| Dimension                                  | Role       | Weight |
| ------------------------------------------ | ---------- | ------ |
| A. Material novelty                        | primary    | 0.20   |
| B. Scientific and technical significance   | primary    | 0.15   |
| C. Real-world consequences                 | primary    | 0.20   |
| D. Strategic and economic significance     | primary    | 0.15   |
| E. Evidence strength and uncertainty       | primary    | 0.20   |
| F. Generalizability and learning value     | primary    | 0.10   |
| G. Engineering and architectural relevance | secondary  | 0.00   |
| H. Availability and maturity               | contextual | 0.00   |

**Engineering relevance is a secondary consideration.** It is recorded for every
candidate and used only as a tiebreaker between otherwise comparable candidates
(window ≤ 0.005) and to justify deeper technical explanation. It never outranks
a more consequential development elsewhere.

**Availability and maturity** is contextual: it informs recommended explanation
depth, not ranking weight.

Strategic research from Gartner, McKinsey, Forrester, IDC, academic institutions
and credible independent organizations competes on the same evidence-backed
criteria as technical announcements. A consultancy report receives no priority
merely because of the publisher's reputation.

---

## 5. Decision model

| Decision                   | Meaning                                                                      |
| -------------------------- | ---------------------------------------------------------------------------- |
| `SELECTED`                 | Eligible, sufficiently evidenced and materially important.                   |
| `MERGED`                   | Covered within another selected story, provenance preserved.                 |
| `EXCLUDED_LOW_MATERIALITY` | Eligible but insufficiently consequential.                                   |
| `EXCLUDED_REPEATED`        | No qualifying new material information.                                      |
| `EXCLUDED_TEMPORAL`        | Fails the authoritative novelty eligibility gate.                            |
| `DEFERRED_UNVERIFIED`      | Potentially important but blocked by unresolved critical evidence or timing. |
| `CATCH_UP_SELECTED`        | Older development explicitly selected as dated catch-up.                     |
| `REVIEW_REQUIRED`          | Consequential candidate with an unresolved editorial or evidence decision.   |

### 5.1 Thresholds and potential materiality

- Selection threshold: materiality ≥ 0.50.
- Major/lead threshold: materiality ≥ 0.72.
- Deferral threshold: potential materiality ≥ 0.40.

When a candidate is blocked by an unresolved temporal or evidence failure,
**potential materiality** excludes the blocked dimension, so genuine consequence
is not masked by the failure that blocks it.

There are **no arbitrary story-count limits**. On quiet days fewer stories are
selected rather than filling the edition with stale or insignificant material.

---

## 6. Merging

Candidates are merged only when they describe one coherent development:

- They share a normalized canonical URL, or
- They share a source registry entry and repeat an identical normalized claim
  statement.

Within a merge group the earliest publication is the primary story; materiality
and identifier order are deterministic tiebreakers. Separate source IDs, claim
IDs and evidence provenance are preserved on the story and in the manifest
relationships.

Independent findings are never merged merely because they concern the same vendor
or topic.

---

## 7. Concentration and blind-spot review

After the preliminary selection, a deliberate adversarial review evaluates:

- Whether one vendor dominates, and whether that dominance is justified.
- Whether high-impact developments from other vendors were overlooked.
- Whether technical product news displaced more consequential research.
- Whether strategic, economic or organizational developments were undervalued.
- Whether Ring 2 research was adequately considered.
- Whether important Ring 3 signals led to original evidence investigation.
- Whether mandatory development-tool monitoring was confused with editorial priority.
- Whether excluded findings challenge the dominant editorial narrative.
- Whether major omissions remain unresolved.
- Whether the strongest excluded candidates beat the weakest selected ones.

The review is recorded in the manifest with consistency checks, findings,
corrections applied and residual risks. Concentration is explicitly challenged but
**not artificially corrected**: legitimate dominance is not suppressed and no
diversity is manufactured.

A second evaluation by the same model is an internal consistency check, not
independent external validation.

---

## 8. Manifest

`EditorialSelectionManifest` (Zod → draft-07 JSON Schema) contains:

- Edition identifier and reporting window.
- Input fact dossier version and content hash.
- Omission-review and historical-regression references.
- Per-candidate eligibility states, dimension assessments, materiality and
  decisions with reasons and traceable identifiers.
- Final story ordering with merged provenance and recommended explanation depth.
- Relationships between related developments.
- Concentration and blind-spot review results.
- Material caveats, unresolved issues and final readiness status.
- Documented weighting assumptions.

Readiness status:

| Status               | Meaning                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| `READY`              | Selection complete with no unresolved caveats.                         |
| `READY_WITH_CAVEATS` | Selection complete with caveats, residual risks or an empty selection. |
| `BLOCKED`            | Consequential candidates require an explicit editorial decision.       |

---

## 9. Persistence guarantees

- Atomic writes (temp file + rename).
- Readback verification (byte equality + content hash).
- Idempotent manifests: identical selection content produces the same
  `manifestId` and is not written twice.
- Execution timestamps vary per run but are excluded from the selection identity.
- Local filesystem only; no external database.
- Historical manifests are never modified.

---

## 10. Cost and inference

All eligibility, dimension assessment, merging, decision-making, ordering and
persistence is deterministic TypeScript. Model reasoning is used only for
materiality assessment, interdisciplinary interpretation, editorial trade-offs
and adversarial review, through the existing `FreeLLMClient`:

- Primary: NVIDIA Nemotron via OpenRouter (free tier).
- Fallback: Nous Portal Free Tier.

If free inference capacity is unavailable, deterministic findings are preserved
and the manifest records that the model-assisted review was skipped. No paid
inference, external database or additional infrastructure is introduced.

---

## 11. Usage

```bash
# Real run (requires a built canonical fact dossier and upstream reports)
pnpm exec tsx scripts/run-editorial-selection.ts --edition 2025-01-15

# Synthetic fixture demo (clearly marked, never real evidence)
pnpm exec tsx scripts/run-editorial-selection.ts --edition 2025-01-15 --demo

# Enable the optional model-assisted internal consistency check
pnpm exec tsx scripts/run-editorial-selection.ts --edition 2025-01-15 --semantic

# Regenerate the JSON schema from the Zod contract
pnpm exec tsx scripts/generate-schemas.ts

# Validate all editorial data files against their JSON schemas
pnpm run validate:data
```

---

## 12. Tests

`src/lib/editorial-selection/editorial-selection.test.ts` covers:

1. Rejection of temporally ineligible candidates.
2. Preservation of evidence classifications.
3. Inclusion of verified original reporting about older events when temporally eligible.
4. Substantive updates versus repeated reporting.
5. Proper treatment of unresolved evidence.
6. Comparable assessment of technical and strategic developments.
7. Vendor-neutral selection.
8. No mandatory supplier or topic quotas.
9. Engineering relevance used only as a secondary consideration.
10. Candidate merging without provenance loss.
11. Historical deduplication.
12. Consistent selection and exclusion states.
13. Selection manifest schema and traceability.
14. Idempotent reruns and persistent readback.
15. Backward compatibility.
16. Concentration and blind-spot review.
17. The ten representative evaluation fixtures.

All fixture data is synthetic and is never presented as retrieved evidence.
Deterministic tests validate editorial decisions against the documented criteria;
they do not prove subjective editorial quality.

---

## 13. Representative evaluation fixtures

1. A major scientific breakthrough competing with routine coding-agent releases.
2. A significant GitHub Copilot CLI release with direct engineering consequences.
3. An original Gartner/McKinsey/Forrester/IDC study identifying material enterprise
   AI adoption or productivity changes.
4. A vendor-sponsored productivity claim with weak independent evidence.
5. A newly disclosed security vulnerability affecting multiple agent platforms.
6. A substantive update to an already covered AI model release.
7. Multiple articles repeating the same underlying announcement.
8. A quiet news day containing only a few eligible developments.
9. A day genuinely dominated by one vendor's major releases.
10. A candidate carrying critical unresolved evidence or temporal uncertainty.
