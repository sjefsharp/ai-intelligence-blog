# Book Delta — Educational Knowledge Proposal Capability

**Status:** Implemented (2026-11-13)
**Module:** `src/lib/book-delta/`
**Script:** `scripts/run-book-delta.ts`
**Schemas:** `data/schemas/book-delta-proposal.json`, `book-delta-artifact.json`, `book-delta-evaluation.json`, `book-delta-knowledge-continuity.json`
**Documentation:** this file

---

## 1. Purpose

Book Delta is the proposal-generation and review capability inside the existing
**K — Knowledge Continuity** stage. It identifies meaningful, reusable knowledge
emerging from verified daily research and formulates structured proposals for
improving future educational content, technical explanations, reference material
and learning resources.

The processing sequence is preserved:

```text
Source Discovery → Retrieval → Temporal Classification → Claim Verification
  → Canonical Fact Dossier → Omission Review → Historical Regression
  → Editorial Selection → Publication Production → Quality Evaluation
  → Knowledge Continuity (Thesaurus → Architecture Principles → Book Delta)
  → Publication Validation → Deployment
```

Book Delta is **not**:

- a separate source of factual truth;
- a replacement for the canonical thesaurus;
- a mechanism for automatically modifying architecture principles;
- an autonomous book editor;
- a fourth canonical daily publication.

It never approves, implements or validates an educational change. A generated
candidate is always `CANDIDATE` and requires explicit human authorization.

A valid outcome is explicitly `NONE` when no actionable improvement is supported
by evidence. A skipped assessment is never reported as `NONE`.

---

## 2. Authoritative boundaries

| Register                         | Authority                                          | Book Delta relationship                                                       |
| -------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------- |
| Canonical Fact Dossier           | Factual evidence                                   | References verified claims; never re-interprets them as an independent source |
| Editorial Selection Manifest     | Publication selection and ordering                 | Read-only context                                                             |
| Persistent Thesaurus             | Canonical definitions and conceptual relationships | Consulted; terminology changes route to the existing terminology mechanism    |
| Architecture Principles Register | Normative architectural principles                 | Consulted; new principles route to the existing principles-validation process |
| Book Delta                       | Proposed educational improvements                  | This capability; proposals only                                               |
| Research Audit                   | Traceable reporting                                | Receives the per-edition Book Delta report                                    |
| Publication Acceptance Gates     | Final publication readiness                        | Receive Book Delta evidence through the K gate                                |

---

## 3. Proposal categories

| Category      | Meaning                                                                               |
| ------------- | ------------------------------------------------------------------------------------- |
| `ADD`         | Introduce a missing educational concept, explanation, example or substantive section  |
| `REFINE`      | Improve an existing explanation's technical accuracy, clarity, applicability or depth |
| `CORRECT`     | Address a materially incorrect, misleading or outdated statement                      |
| `EXTEND`      | Add relevant evidence, alternative perspectives, limitations or technical detail      |
| `RESTRUCTURE` | Improve educational sequencing, conceptual dependencies or information organization   |
| `DEPRECATE`   | Identify educational content that should be retired or replaced                       |
| `NONE`        | The edition produced no justified educational improvement proposals                   |

Categories are distinct from the architecture-principles change classifications
(`ADD`, `CONFIRM`, `REFINE`, `MERGE`, `SUPERSEDE`, `NONE`).

---

## 4. Data model

`BookDeltaProposal` (schema version `1.0.0`) carries:

- stable proposal ID (`bdp_<16 hex>`), edition ID and edition date;
- category, bilingual title, knowledge domain, target audience;
- target concept and, when known, the target document/section with an explicit
  access status (`accessed`, `inaccessible`, `unidentified`, `does-not-exist`);
- current gap, proposed change, rationale (bilingual);
- supporting canonical claim IDs and original authoritative source references;
- research date range, evidence classification, confidence, material uncertainty;
- expected educational value, limitations, durability and accessibility assessments;
- methodological caveats and counterevidence;
- terminology, architecture-principle and historical-proposal references;
- conflicts/dependencies, acceptance criteria, lifecycle status, revision history;
- schema version and audit metadata.

An unspecified destination remains explicitly `unidentified`; Book Delta never
invents a target document, section, repository or book chapter.

---

## 5. Discovery sequence

The engine consumes the validated canonical fact dossier and then:

1. identifies findings with potential enduring educational value;
2. distinguishes novel knowledge from temporary release information;
3. compares findings with existing educational knowledge when accessible;
4. consults the canonical thesaurus;
5. consults the architecture-principles register;
6. inspects available historical Book Delta proposals;
7. identifies actual gaps, contradictions or improvement opportunities;
8. examines counterevidence and applicability boundaries;
9. formulates a specific proposed change;
10. attaches supporting evidence;
11. validates uniqueness and completeness;
12. persists the proposal in the established knowledge workflow;
13. reports its status in the research audit.

Deterministic TypeScript performs ID management, schema validation, state
transitions, evidence-reference integrity, historical comparison, duplicate
filtering, serialization, persistence, readback and audit integration. Model
reasoning is used only for semantic judgments (educational value, conceptual
gaps, explanatory weakness, counterarguments, learning sequence), through the
existing free inference route. Deterministic string matching never proves
semantic novelty.

---

## 6. Existing knowledge inspection

Target inspection is read-only and project-local (`src/content`, `docs`,
`editions`). A lexical match is recorded as `accessed` with
`comparisonResult: inconclusive` — string matching alone never confirms a defect.
When no project-local document addresses the concept, the destination is
`unidentified`, `comparisonPerformed: false`, and the proposal is preserved as a
candidate rather than a verified correction.

---

## 7. Historical continuity and lifecycle

Lifecycle states:

`CANDIDATE → READY_FOR_REVIEW → APPROVED → IMPLEMENTED → VALIDATED`, with
`REJECTED` and `SUPERSEDED` as terminal/alternative states. Transitions are
validated by `validateLifecycleTransition`.

Proposal identity is deterministic from the normalized target concept, so the
same educational concept keeps one stable identifier across editions. New
evidence strengthens the existing proposal through a revision entry; it is never
recreated as a duplicate. A rejected proposal is not silently reintroduced — the
candidate is dropped and the blocked reintroduction is reported as an unresolved
evidence gap.

The engine never emits `APPROVED`, `IMPLEMENTED` or `VALIDATED`.

---

## 8. Research-audit integration

`renderBookDeltaAuditSection` derives the `## Kennisregister Wijzigingen & Book
Delta Voorstellen` section of `research-audit.md` from the persisted evaluation
result. It reports whether the evaluation ran, which evidence was considered, new
and updated proposals, duplicates, `NONE` decisions, unresolved gaps, target
access limitations, review requirements, persistence/readback and inference use.
A missing assessment is reported as **NIET UITGEVOERD** and is explicitly not a
`NONE` result.

---

## 9. Knowledge-continuity gate integration

`src/lib/publication-acceptance/knowledge-continuity-evidence.ts` reads the
persisted Book Delta evaluation, knowledge-continuity result and artifact, and
derives the K-gate inputs:

- `bookDeltaExecuted`
- `bookDeltaProposalsEvaluated`
- `bookDeltaDeduplication`
- `bookDeltaApprovalBoundaries`
- `bookDeltaResultsRecorded`

A legitimate `NONE` is acceptable; a skipped assessment is not. Book Delta never
marks an edition `VALIDATED` or `PUBLISHED`.

---

## 10. Persistence

Repository-local, version-controlled storage under `data/book-delta/<edition>/`:

- `bdp_<id>.json` — one proposal record;
- `bdp_<id>.json.meta.json` — content-hash metadata;
- `book-delta-artifact.json` — complete derived register;
- `book-delta-evaluation.json` — research-audit integration result;
- `book-delta-knowledge-continuity.json` — K-gate evidence;
- `historical-index.json` — cross-edition proposal index.

Writes are atomic, idempotent and followed by independent readback with
content-hash verification. Historical proposal files are never rewritten by a
newer edition.

---

## 11. Inference and cost

Deterministic evaluation always runs. Model-assisted discovery is enabled only
when free-tier credentials are configured, using the existing wrapper:

- Primary: NVIDIA Nemotron via OpenRouter (free tier).

No paid inference, external database or additional infrastructure is introduced.
When inference cannot complete, deterministic findings are preserved and the
evaluation reports that inference was not used successfully. Measured request and
token counts are reported in the stage output.

---

## 12. Usage

```bash
# Evaluate one edition (requires a built canonical fact dossier)
pnpm exec tsx scripts/run-book-delta.ts --edition 2025-01-15
pnpm exec tsx scripts/run-book-delta.ts --edition 2025-01-15 --json

# Regenerate the JSON schemas from the Zod contracts
pnpm run generate:schemas
```

`BOOK_DELTA_DATA_DIR` overrides the persistence root for isolated test runs.

---

## 13. Tests

- `src/lib/book-delta/book-delta.test.ts` — schema integrity, categories,
  lifecycle transitions, evidence references, all 24 representative fixtures,
  serialization, hashing, knowledge-continuity and `NONE` semantics.
- `src/lib/book-delta/engine.test.ts` — end-to-end deterministic engine runs in
  an isolated `BOOK_DELTA_DATA_DIR`: proposal creation, persistence, independent
  readback, `NONE`, deduplication and strengthening, blocked reintroduction,
  target-document handling, approval boundaries, failure states, research-audit
  rendering, K-gate evidence loading and the workflow entry point.

All fixture data is synthetic and clearly labelled. No test generates or
publishes a real edition.

---

## 14. Known limitations

- The existing published edition `editions/edition_2025-01-15` predates Book
  Delta. Its `research-audit.md` is a historical record and is not rewritten;
  Book Delta evidence for that edition is therefore absent and the K gate
  reports the assessment as not executed rather than `NONE`.
- `pnpm astro check` now runs: the `@astrojs/astro2tsx` WASM bridge is pinned
  to 0.1.4 (stable `@emnapi/runtime`) through a pnpm override in
  `pnpm-workspace.yaml`. The repository still carries a large pre-existing
  type-error backlog outside Book Delta; Book Delta sources are type-clean.
- The canonical thesaurus artifact now validates against
  `TerminologyEntrySchema` (research-taxonomy domain ids and nullable optional
  lifecycle fields are accepted), so Book Delta can consult it directly.
