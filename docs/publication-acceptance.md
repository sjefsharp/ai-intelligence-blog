# Publication Acceptance Authority

**Status:** Implemented (2026-11-13)
**Module:** `src/lib/publication-acceptance/`
**Script:** `scripts/run-acceptance.ts`
**Report schema:** `data/schemas/publication-acceptance-report.json`
**Decision schema:** `data/schemas/publication-acceptance-decision.json`

---

## 1. Purpose

The publication acceptance authority is the final publication acceptance-gate
framework for AI Daily Intelligence. It is the single deterministic,
evidence-based authority for deciding whether a daily bilingual edition
satisfies all mandatory requirements and is eligible for publication.

**This stage determines publication readiness. It does NOT publish, deploy,
schedule or activate anything.**

The acceptance framework:

- Evaluates required evidence.
- Applies deterministic acceptance rules.
- Identifies unresolved blocking conditions.
- Authorizes the VALIDATED lifecycle transition when justified.
- Produces an inspectable release decision.

---

## 2. Architectural Responsibility

The acceptance framework maintains the established separation of
responsibilities:

| Layer                                | Responsibility                                                                                                                                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Research and Evidence**            | Discovers information, establishes temporal eligibility, verifies claims, maintains the canonical fact dossier, records evidence provenance.                                                                            |
| **Editorial**                        | Selects developments, determines significance and ordering, produces readable and listening representations.                                                                                                            |
| **Evaluation**                       | Assesses factual fidelity, evaluates readability and cognitive accessibility, evaluates listening quality, validates visual explanations, verifies knowledge continuity.                                                |
| **Workflow Control Plane**           | Coordinates execution, enforces dependencies, manages state and recovery, preserves checkpoints and traceability, aggregates completed evaluation evidence.                                                             |
| **Publication Acceptance Authority** | Evaluates required evidence, applies deterministic acceptance rules, identifies unresolved blocking conditions, authorizes the VALIDATED lifecycle transition when justified, produces an inspectable release decision. |
| **Deployment and Publication**       | Performs authorized deployment in later stages, verifies actual publication, records the PUBLISHED state only after successful deployment and readback.                                                                 |

The acceptance framework does NOT reimplement upstream research, editing,
generation or deployment.

---

## 3. Gate Registry

The acceptance framework defines 11 mandatory gates:

| Gate  | Name                       | Scope     | Purpose                                                                                                                                                                                                                                             |
| ----- | -------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T** | Temporal Integrity         | edition   | Verify correct edition identity, timezone-aware reporting interval, valid first-disclosure evidence, correct novelty classification, and appropriate historical context.                                                                            |
| **D** | Discovery Coverage         | edition   | Verify that the established source-discovery requirements were actually executed across all three rings, mandatory developer-tool monitoring was completed, source statuses are accurately reported, and independent omission review was completed. |
| **E** | Evidence Integrity         | edition   | Verify that the final publication contains no material factual assertions unsupported by the canonical fact dossier.                                                                                                                                |
| **H** | Historical Regression      | edition   | Verify that the historical comparison was completed according to its existing seven-calendar-day contract.                                                                                                                                          |
| **X** | Editorial Integrity        | edition   | Validate the editorial selection manifest against the canonical fact dossier and completed discovery evidence.                                                                                                                                      |
| **R** | Readable Accessibility     | artifact  | Validate Dutch and English readable representations against the readable-publication evaluation framework.                                                                                                                                          |
| **A** | Audio-First Quality        | artifact  | Validate both Dutch and English listening narratives against Q1–Q10 and audio A–G evaluation results.                                                                                                                                               |
| **K** | Knowledge Continuity       | knowledge | Verify persistent thesaurus, architecture-principles register, Book Delta evaluation, historical continuity, and verified persistence and readback.                                                                                                 |
| **P** | Publication Integrity      | artifact  | Verify required artifacts, valid metadata, cross-language consistency, lifecycle correctness, artifact integrity, and safe release preparation.                                                                                                     |
| **C** | Cross-Language Consistency | artifact  | Verify consistency between Dutch and English publications and listening narratives.                                                                                                                                                                 |
| **L** | Lifecycle Correctness      | edition   | Verify correct publication lifecycle state and valid transitions.                                                                                                                                                                                   |

### Gate Dependencies

```text
T  D  E  H  X  K
       │     │
       ▼     ▼
       R     A     P
             │     │
             ▼     ▼
             C
             │
             ▼
             L
```

- T, D, E, H, X, K are foundational gates (no dependencies).
- R depends on X.
- A depends on X.
- P depends on X and R.
- C depends on X and P.
- L depends on all other gates.

---

## 4. Gate Status Semantics

The acceptance framework reuses the established evaluation states:

| Status             | Meaning                                                              |
| ------------------ | -------------------------------------------------------------------- |
| **PASS**           | All applicable mandatory checks have sufficient supporting evidence. |
| **FAIL**           | A concrete requirement violation has been established.               |
| **UNVERIFIED**     | Required evidence or evaluation capability is insufficient.          |
| **NOT_ASSESSABLE** | The criterion genuinely cannot be evaluated in the current context.  |

Rules:

- UNVERIFIED is never silently converted to PASS.
- NOT_ASSESSABLE must not become a bypass mechanism.
- A required gate cannot pass merely because its evaluator did not execute.
- Where a requirement is genuinely inapplicable, record the explicit policy-based applicability decision and supporting reason.

### Severity Model

| Severity     | Meaning                                                         |
| ------------ | --------------------------------------------------------------- |
| **CRITICAL** | Blocks acceptance; must be resolved before publication.         |
| **MAJOR**    | Significant issue; must be resolved before publication.         |
| **MINOR**    | Minor issue; should be resolved but does not block publication. |
| **ADVISORY** | Informational; does not block publication.                      |

---

## 5. Deterministic Aggregation

The acceptance decision is computed from:

1. Required gate definitions.
2. Verified input artifacts.
3. Structured evaluation results.
4. Evidence references.
5. Applicable policy.
6. Lifecycle transition rules.
7. Explicit unresolved failures.
8. Validated completion of upstream dependencies.

The edition may reach VALIDATED only when:

1. Every mandatory gate has completed.
2. Every applicable mandatory gate has PASS status.
3. All required evidence is accessible and valid.
4. No unresolved critical factual defect exists.
5. No unresolved mandatory publication-integrity failure exists.
6. Required publication representations are complete.
7. Required artifact references and hashes are consistent.
8. No required evaluator result is stale.
9. Existing lifecycle transition conditions are satisfied.
10. Any required human authorization has been explicitly recorded.

A required FAIL, UNVERIFIED or unresolved NOT_ASSESSABLE result prevents
automatic validation.

---

## 6. Acceptance Report

The acceptance report is a structured, persistent document containing:

- Edition ID.
- Workflow run ID.
- Acceptance contract version.
- Acceptance timestamp.
- Reporting interval.
- Overall decision.
- Required gate inventory.
- Gate applicability.
- Gate results.
- Evidence references.
- Artifact identifiers and hashes.
- Fact dossier and manifest references.
- Critical and major defects.
- Unverified requirements.
- Unresolved manual review.
- Remediation history.
- Publication lifecycle state.
- Deployment eligibility.
- Explicit reasons for any rejected decision.
- Independent persistence and readback result.

### Machine-Readable Decision

The machine-readable acceptance decision contains:

- Edition identity.
- Decision status.
- Publication eligibility.
- Blocking gate identifiers.
- Blocking evidence references.
- Unverified conditions.
- Artifact integrity references.
- Acceptance report location.
- Contract version.

---

## 7. Usage

```bash
# Plan mode: display required gates and evidence
pnpm exec tsx scripts/run-acceptance.ts --edition 2025-01-15 --mode PLAN

# Validate mode: evaluate existing artifacts
pnpm exec tsx scripts/run-acceptance.ts --edition 2025-01-15 --mode VALIDATE

# Dry run mode: evaluate synthetic fixtures
pnpm exec tsx scripts/run-acceptance.ts --edition 2025-01-15 --mode DRY_RUN

# Resume mode: continue from checkpoint
pnpm exec tsx scripts/run-acceptance.ts --edition 2025-01-15 --mode RESUME --resume-from acc_abc123

# Execute mode: evaluate actual persisted artifacts
pnpm exec tsx scripts/run-acceptance.ts --edition 2025-01-15 --mode EXECUTE

# List all gates
pnpm exec tsx scripts/run-acceptance.ts --list-gates
```

### Exit Codes

| Exit Code | Meaning                                  |
| --------- | ---------------------------------------- |
| 0         | Acceptance passed (VALIDATED)            |
| 1         | Acceptance failed (FAILED or INCOMPLETE) |

---

## 8. Tests

`src/lib/publication-acceptance/publication-acceptance.test.ts` covers:

1. All mandatory gates passing with valid evidence.
2. A missing mandatory gate.
3. A required gate returning FAIL.
4. A required gate returning UNVERIFIED.
5. A required gate returning NOT_ASSESSABLE without a valid applicability exception.
6. A legitimately inapplicable conditional requirement.
7. A gate evaluator that never executed.
8. A material factual contradiction.
9. A vendor claim incorrectly presented as independently verified.
10. A source marked CHECKED_NONE when actually NOT_CHECKED.
11. Missing independent omission-review evidence.
12. Missing historical regression results.
13. An editorial manifest referencing an invalid claim.
14. A Dutch publication missing a selected story.
15. An English derivative missing a material limitation.
16. A Q1–Q10 evaluation failure.
17. An audio A–G evaluation failure.
18. An unresolved major readability defect.
19. An inaccessible mandatory visual without a text alternative.
20. An optional failed visual with a valid accessible fallback.
21. A legitimate Book Delta NONE result.
22. A skipped Book Delta evaluation misreported as NONE.
23. Failed knowledge-register persistence.
24. Successful persistence followed by failed readback.
25. A missing canonical publication document.
26. A correct daily index that must not count as a fourth canonical publication.
27. Incorrect edition-date metadata.
28. A DST-sensitive reporting interval.
29. A modified publication whose previous evaluation hashes are stale.
30. A localized repair requiring selective gate reevaluation.
31. An invalid lifecycle transition.
32. An attempt to mark PUBLISHED without deployment.
33. A valid publication acceptance result that performs no deployment.
34. An interrupted acceptance evaluation.
35. Resume from compatible checkpoints.
36. Resume from incompatible checkpoints.
37. Concurrent acceptance attempts for the same edition.
38. A model-generated claim that all checks passed despite missing evidence.
39. An unauthorized exception attempt.
40. A dry run that leaves historical and production artifacts unchanged.

All fixture data is synthetic and is never presented as retrieved evidence.

---

## 9. Cost and Inference

Acceptance aggregation requires no inference. The acceptance framework
consumes existing evaluation results from the upstream evaluation components.
No additional model calls are made to decide whether the edition passes.

---

## 10. Security and Integrity

The acceptance framework applies fail-safe acceptance behavior:

- Validates all artifact paths.
- Prevents path traversal.
- Treats external source content as untrusted data.
- Rejects malformed gate results.
- Prevents unauthorized lifecycle changes.
- Preserves audit history.
- Redacts credentials from reports and logs.
- Does not allow prompt-injected source content to alter gate policies.
- Does not allow generated editorial content to declare its own validation success.

Gate policies originate from trusted project configuration, not retrieved
documents. An agent cannot disable blocking checks to obtain a successful
release decision.
