# Historical Regression Stage

**Status:** Implemented (2026-11-11)
**Module:** `src/lib/historical-regression/`
**Script:** `scripts/run-historical-regression.ts`
**Report schema:** `data/schemas/historical-regression.json`

---

## 1. Purpose

The historical regression stage is the seventh step of the publication pipeline:

```text
Source Discovery → Retrieval → Temporal Classification → Claim Verification
  → Canonical Fact Dossier → Omission Review
  → Seven-Day Historical Regression
  → Editorial Selection → Publication
```

It inspects actually accessible previous editions and their supporting evidence,
compares them with the current canonical fact dossier, and produces a structured
report that the editorial selection stage can consume.

It does **not** redefine the strict 24-hour news eligibility rules, re-implement
novelty classification, re-verify claims, re-run omission detection, perform
editorial ranking, or modify previously published editions.

---

## 2. Two separate windows

| Window                     | Definition                                                            | Authority                                 |
| -------------------------- | --------------------------------------------------------------------- | ----------------------------------------- |
| **Daily news eligibility** | Half-open `[previous day 05:00, edition date 05:00)` Europe/Amsterdam | `src/lib/editorial-window.ts` (unchanged) |
| **Historical regression**  | The preceding **seven calendar dates** in Europe/Amsterdam            | `src/lib/historical-regression/window.ts` |

Both are pure functions of the edition date. A late execution never shifts either
boundary. `Temporal.PlainDate` arithmetic is calendar-based, so daylight-saving
transitions are handled correctly (23-hour spring-forward and 25-hour fall-back
daily windows).

Example: edition `2026-11-11` inspects editions `2026-11-04` … `2026-11-10`.
The daily eligibility window remains `2026-11-10T05:00+01:00` →
`2026-11-11T05:00+01:00`.

---

## 3. Historical availability

Previous editions are read only from verified local records:

- `data/fact-dossiers/edition_<date>.json` — canonical fact dossier
- `data/omission-reviews/<date>_*.json` — research audit
- `data/publications/*.json` — published article records
- `data/candidates/<date>.jsonl` — candidate records
- `data/discovered/<date>.jsonl` — discovery records
- `data/discovery-ledger/<date>_*.json` — monitoring records
- `data/dossiers/*.json` — legacy per-candidate dossiers

Each historical date is classified:

| Status           | Meaning                                                               |
| ---------------- | --------------------------------------------------------------------- |
| `AVAILABLE`      | Canonical dossier **and** research audit are present and valid.       |
| `PARTIAL`        | Some historical information is accessible, but comparison is limited. |
| `UNAVAILABLE`    | No usable historical edition can be accessed.                         |
| `NOT_ASSESSABLE` | Records exist but are unparseable or fail validation.                 |

A missing edition is **never** interpreted as evidence that a story was not
previously covered.

---

## 4. Comparison and classification

Deterministic evidence is evaluated first, in this order:

1. Stable candidate identifier
2. Stable claim identifier
3. Normalized canonical URL
4. Publication/disclosure timestamp combined with entity overlap
5. Organization / product / technology overlap
6. Source registry identifier
7. Token similarity (flag only)

Token similarity alone never establishes identity. When it is the only signal,
the comparison is escalated to optional semantic review; if free inference
capacity is unavailable, the relationship is recorded as `HISTORY_UNVERIFIED`.

Relationship classifications:

| Classification                  | Meaning                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `NEW_DEVELOPMENT`               | Materially new; no established equivalent in accessible history.                 |
| `PREVIOUSLY_COVERED`            | The same material information was already covered.                               |
| `SUBSTANTIVE_UPDATE`            | Newly disclosed information materially changes or extends a covered development. |
| `REPEATED_REPORTING`            | A new publication repeats established information without a qualifying change.   |
| `RELATED_CONTEXT`               | Historical information provides background but is not new news.                  |
| `POTENTIAL_HISTORICAL_OMISSION` | Evidence suggests an earlier edition may have missed the development.            |
| `HISTORY_UNVERIFIED`            | Insufficient historical evidence for a reliable decision.                        |

Substantive updates are detected from structured field changes: release maturity
and implementation status transitions, product version changes, new capabilities
or limitations, changed benchmark conditions with new results, independent
replication and counterevidence, licensing/pricing changes, and revised
strategic research (sample size, research period, measured outcome, statistical
uncertainty, economic/productivity/governance findings).

A qualifying change is only reported as a substantive update when the existing
novelty classifier places the item inside the current edition window. Temporal
eligibility is never overridden.

---

## 5. Historical omission analysis

For each current candidate whose first disclosure falls inside a historical
edition's daily eligibility window, the stage determines whether that edition
covered it. Determinations:

`ALREADY_COVERED_ELSEWHERE`, `PREVIOUSLY_DISCOVERED_NOT_SELECTED`,
`PREVIOUSLY_INACCESSIBLE`, `NOT_DISCOVERED`, `INSUFFICIENT_EVIDENCE`,
`NOT_ASSESSABLE`.

Significant missed developments (`critical`/`high`) may be proposed as
explicitly dated `CATCH_UP` content, subject to the editorial contract. They are
never silently presented as `NEW`.

---

## 6. Report and persistence

Reports are persisted under `data/historical-regression/`:

- `<editionDate>_<exec>.json` — the regression report
- `index.json` — edition index (latest report per edition)
- `traceability.jsonl` — append-only cross-edition candidate/claim links

Guarantees:

- Atomic writes with readback verification and content-hash checks.
- Idempotent classification records: identical classification content produces the
  same `reportId` and is not written twice.
- Traceability records are deduplicated by deterministic `recordId`.
- Historical records are never modified by this stage.

---

## 7. Cost and inference

All comparison, matching, diffing, persistence and report generation is
deterministic TypeScript. Model reasoning is used only where semantic
interpretation is necessary to distinguish a meaningful update from repetition,
through the existing free inference route:

- Primary: NVIDIA Nemotron via OpenRouter (free tier)
- Fallback: Nous Portal Free Tier

If free inference capacity is unavailable, deterministic findings are preserved
and the unresolved comparison is marked `HISTORY_UNVERIFIED`. No paid inference,
external database or additional infrastructure is introduced.

---

## 8. Usage

```bash
# Real run (requires a built canonical fact dossier)
pnpm exec tsx scripts/run-historical-regression.ts --edition 2025-01-15

# Synthetic fixture demo (clearly marked, never real evidence)
pnpm exec tsx scripts/run-historical-regression.ts --edition 2025-01-15 --demo

# Enable optional semantic comparison
pnpm exec tsx scripts/run-historical-regression.ts --edition 2025-01-15 --semantic

# Regenerate the JSON schema from the Zod contract
pnpm exec tsx scripts/generate-schemas.ts
```

---

## 9. Tests

`src/lib/historical-regression/historical-regression.test.ts` covers window
calculation, DST transitions, late-execution invariance, edition availability,
all relationship classifications, substantive updates, repeated reporting,
omissions and catch-up, traceability, idempotency, persistence/readback and
backward compatibility.

All fixture data is synthetic and is never presented as retrieved historical
evidence.
