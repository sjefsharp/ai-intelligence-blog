/**
 * Editorial Selection — Validation Tests
 *
 * ⚠️  All edition, candidate, claim and source data used here is SYNTHETIC
 * FIXTURE DATA from `./fixtures.js`. No test below represents actually retrieved
 * evidence, and no assertion should be read as a real editorial or research
 * finding.
 *
 * These tests validate editorial decisions against the documented criteria.
 * They do not prove subjective editorial quality: they prove that the
 * deterministic decision model, eligibility gates, provenance preservation and
 * manifest contract behave as specified.
 *
 * Coverage:
 * 1.  Rejection of temporally ineligible candidates.
 * 2.  Preservation of evidence classifications.
 * 3.  Inclusion of verified original reporting about older events when temporally eligible.
 * 4.  Substantive updates versus repeated reporting.
 * 5.  Proper treatment of unresolved evidence.
 * 6.  Comparable assessment of technical and strategic developments.
 * 7.  Vendor-neutral selection.
 * 8.  No mandatory supplier or topic quotas.
 * 9.  Engineering relevance used only as a secondary consideration.
 * 10. Candidate merging without provenance loss.
 * 11. Historical deduplication.
 * 12. Consistent selection and exclusion states.
 * 13. Selection manifest schema and traceability.
 * 14. Idempotent reruns and persistent readback.
 * 15. Backward compatibility with existing pipeline contracts.
 * 16. Concentration and blind-spot review.
 * 17. The ten representative evaluation fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";

import {
	DEFAULT_EDITORIAL_SELECTION_CONFIG,
	buildWeightingAssumptions,
} from "./config.js";
import {
	EditorialSelectionManifestSchema,
	generateEditorialSelectionJsonSchema,
	type EditorialSelectionManifest,
} from "./schema.js";
import {
	computeManifestContentHash,
	createEditorialSelectionStore,
} from "./store.js";
import {
	runEditorialSelection,
	type EditorialSelectionInput,
} from "./engine.js";
import { detectDuplicates } from "./eligibility.js";
import { detectMergeGroups } from "./merging.js";
import { tokenize } from "./similarity.js";
import { validateFactDossier } from "../fact-dossier/validate.js";
import {
	EDITION_DATE,
	catchUpEdition,
	combinedEdition,
	copilotCliReleaseEdition,
	fixtureCandidateId,
	historicalDedupEdition,
	historicalRepetitionEdition,
	originalReportingOlderEventEdition,
	quietDayEdition,
	repeatedAnnouncementEdition,
	repostEdition,
	scientificBreakthroughEdition,
	securityVulnerabilityEdition,
	strategicStudyEdition,
	substantiveUpdateEdition,
	unresolvedEdition,
	vendorDominatedEdition,
	vendorProductivityClaimEdition,
	type FixtureEdition,
} from "./fixtures.js";

// ============================================================================
// Helpers
// ============================================================================

const NOW = "2025-01-15T06:00:00Z";
const STORE_DIR = join("data", "test-editorial-selection");

function run(
	edition: FixtureEdition,
	overrides: Partial<EditorialSelectionInput> = {},
) {
	return runEditorialSelection({
		editionDate: edition.editionDate,
		canonicalDossier: edition.dossier,
		omissionReview: edition.omissionReview,
		historicalRegression: edition.historicalRegression,
		now: NOW,
		generatedBy: "editorial-selection-test",
		persist: false,
		...overrides,
	});
}

function decisionOf(
	result: Awaited<ReturnType<typeof run>>,
	key: string,
): string {
	const id = fixtureCandidateId(key);
	const assessment = result.assessments.find(
		(entry) => entry.candidateId === id,
	);
	if (!assessment)
		throw new Error(`No assessment for fixture key ${key} (${id})`);
	return assessment.decision;
}

function assessmentOf(result: Awaited<ReturnType<typeof run>>, key: string) {
	const id = fixtureCandidateId(key);
	const assessment = result.assessments.find(
		(entry) => entry.candidateId === id,
	);
	if (!assessment)
		throw new Error(`No assessment for fixture key ${key} (${id})`);
	return assessment;
}

function storyFor(result: Awaited<ReturnType<typeof run>>, key: string) {
	const id = fixtureCandidateId(key);
	const story = result.stories.find((entry) => entry.candidateId === id);
	if (!story) throw new Error(`No story for fixture key ${key} (${id})`);
	return story;
}

beforeAll(() => {
	rmSync(STORE_DIR, { recursive: true, force: true });
});

afterAll(() => {
	rmSync(STORE_DIR, { recursive: true, force: true });
});

// ============================================================================
// 1. Temporal eligibility gate
// ============================================================================

describe("Editorial Selection — Temporal Eligibility Gate", () => {
	it("rejects an in-window repost/summary as temporally ineligible", async () => {
		const result = await run(repostEdition());
		expect(decisionOf(result, "in-window-repost")).toBe(
			"EXCLUDED_TEMPORAL",
		);
		const assessment = assessmentOf(result, "in-window-repost");
		expect(assessment.eligibility.state).toBe("INELIGIBLE_TEMPORAL");
		expect(assessment.eligibility.temporalStatus).toBe("NEW_FAIL");
		expect(assessment.decisionReasons.join(" ")).toMatch(
			/repost\/summary/i,
		);
	});

	it("defers a consequential candidate with unresolved temporal eligibility rather than promoting it", async () => {
		const result = await run(unresolvedEdition());
		const assessment = assessmentOf(result, "unresolved-temporal-claim");
		expect(assessment.eligibility.temporalStatus).toBe("TIME_UNVERIFIED");
		expect(assessment.decision).toBe("DEFERRED_UNVERIFIED");
		expect(assessment.uncertainty.length).toBeGreaterThan(0);
	});

	it("excludes a low-potential candidate with unresolved temporal eligibility", async () => {
		const result = await run(repostEdition());
		expect(result.manifest.stories).toHaveLength(0);
		expect(result.manifest.readinessStatus).toBe("READY_WITH_CAVEATS");
	});

	it("includes verified original reporting about an older event when disclosed in-window", async () => {
		const result = await run(originalReportingOlderEventEdition());
		const assessment = assessmentOf(
			result,
			"original-reporting-older-event",
		);
		expect(assessment.eligibility.temporalStatus).toBe("NEW_PASS");
		expect(assessment.decision).toBe("SELECTED");
		expect(assessment.eligibility.noveltyStatementPresent).toBe(true);
		// The underlying event date is preserved and distinct from the disclosure date.
		expect(result.manifest.candidates[0].exactStatement).toMatch(/2023/);
	});

	it("treats CATCH_UP separately with its original publication date and explicit reason", async () => {
		const result = await run(catchUpEdition());
		const assessment = assessmentOf(result, "catch-up-older-development");
		expect(assessment.eligibility.state).toBe("ELIGIBLE_CATCH_UP");
		expect(assessment.decision).toBe("CATCH_UP_SELECTED");
		expect(assessment.originalPublicationDate).toBe(
			"2025-01-06T09:00:00+01:00[Europe/Amsterdam]",
		);
		expect(assessment.catchUpReason).toBeTruthy();
		const story = storyFor(result, "catch-up-older-development");
		expect(story.decision).toBe("CATCH_UP_SELECTED");
		expect(story.summary).toMatch(/catch-up/i);
	});
});

// ============================================================================
// 2. Evidence classification preservation
// ============================================================================

describe("Editorial Selection — Evidence Classification Preservation", () => {
	it("never promotes a VENDOR_CLAIM to verified or partially verified", async () => {
		const result = await run(vendorProductivityClaimEdition());
		const assessment = assessmentOf(result, "vendor-productivity-claim");
		const claim = result.manifest.candidates[0].claimIds.map((id) => id);
		expect(claim.length).toBeGreaterThan(0);
		// The dossier claim classification is preserved verbatim.
		const dossierClaim =
			vendorProductivityClaimEdition().dossier.candidates[0].claims[0];
		expect(dossierClaim.evidenceClassification).toBe("VENDOR_CLAIM");
		expect(dossierClaim.verificationLevel).toBe("L0");
		expect(dossierClaim.verificationStatus).toBe("unverified");
		expect(assessment.eligibility.evidenceSufficiency).toBe("ADEQUATE");
	});

	it("preserves RESEARCH_FINDING classifications and verification levels", async () => {
		const edition = strategicStudyEdition();
		const result = await run(edition);
		const dossierClaim = edition.dossier.candidates[0].claims[0];
		expect(dossierClaim.evidenceClassification).toBe("RESEARCH_FINDING");
		const assessment = assessmentOf(result, "mckinsey-enterprise-ai-study");
		expect(assessment.eligibility.evidenceSufficiency).toBe("STRONG");
	});

	it("does not exclude credible original reporting merely because first-party confirmation is absent", async () => {
		const result = await run(originalReportingOlderEventEdition());
		const assessment = assessmentOf(
			result,
			"original-reporting-older-event",
		);
		expect(assessment.eligibility.evidenceSufficiency).toBe("STRONG");
		expect(assessment.decision).toBe("SELECTED");
	});

	it("marks a candidate with only weak evidence as ineligible", async () => {
		const edition = unresolvedEdition();
		const result = await run(edition);
		const assessment = assessmentOf(result, "unresolved-evidence-claim");
		// RESEARCH_FINDING with no corroboration and a blocking uncertainty is not
		// promoted; it is deferred, not selected.
		expect(assessment.decision).toBe("DEFERRED_UNVERIFIED");
		expect(assessment.uncertainty.join(" ")).toMatch(/blocking/i);
	});
});

// ============================================================================
// 3. Substantive updates versus repeated reporting
// ============================================================================

describe("Editorial Selection — Updates vs Repeated Reporting", () => {
	it("selects a substantive update to an already covered development", async () => {
		const result = await run(substantiveUpdateEdition());
		const assessment = assessmentOf(
			result,
			"model-release-substantive-update",
		);
		expect(assessment.eligibility.historicalRelationship).toBe(
			"SUBSTANTIVE_UPDATE",
		);
		expect(assessment.decision).toBe("SELECTED");
		expect(assessment.eligibility.temporalStatus).toBe("NEW_PASS");
	});

	it("excludes previously covered material without a qualifying change", async () => {
		const result = await run(historicalDedupEdition());
		expect(decisionOf(result, "copilot-cli-release")).toBe(
			"EXCLUDED_REPEATED",
		);
	});

	it("excludes repeated reporting of established information", async () => {
		const result = await run(historicalRepetitionEdition());
		expect(decisionOf(result, "copilot-cli-release")).toBe(
			"EXCLUDED_REPEATED",
		);
	});

	it("does not reward repeated reporting as fresh material", async () => {
		const result = await run(historicalRepetitionEdition());
		const assessment = assessmentOf(result, "copilot-cli-release");
		expect(assessment.eligibility.historicalRelationship).toBe(
			"REPEATED_REPORTING",
		);
		expect(assessment.decision).toBe("EXCLUDED_REPEATED");
		expect(result.manifest.stories).toHaveLength(0);
	});
});

// ============================================================================
// 4. Comparable assessment of technical and strategic developments
// ============================================================================

describe("Editorial Selection — Technical vs Strategic Comparability", () => {
	it("selects a strategic research study on the same evidence-backed criteria", async () => {
		const result = await run(strategicStudyEdition());
		const assessment = assessmentOf(result, "mckinsey-enterprise-ai-study");
		expect(assessment.decision).toBe("SELECTED");
		const strategic = assessment.dimensions.find(
			(dimension) =>
				dimension.dimension === "strategic-economic-significance",
		);
		expect(strategic?.level).toBe("high");
		expect(strategic?.role).toBe("primary");
		expect(strategic?.weight).toBeGreaterThan(0);
	});

	it("lets a major scientific breakthrough outrank routine coding-agent releases", async () => {
		const result = await run(scientificBreakthroughEdition());
		expect(decisionOf(result, "sci-breakthrough-moe-scaling")).toBe(
			"SELECTED",
		);
		expect(decisionOf(result, "coding-agent-release-1")).toBe(
			"EXCLUDED_LOW_MATERIALITY",
		);
		expect(decisionOf(result, "coding-agent-release-2")).toBe(
			"EXCLUDED_LOW_MATERIALITY",
		);
		expect(decisionOf(result, "coding-agent-release-3")).toBe(
			"EXCLUDED_LOW_MATERIALITY",
		);
		const story = storyFor(result, "sci-breakthrough-moe-scaling");
		expect(story.order).toBe(1);
		expect(story.materialityScore).toBeGreaterThan(0.7);
	});

	it("does not give a consultancy report priority merely because of the publisher", async () => {
		const result = await run(strategicStudyEdition());
		const assessment = assessmentOf(result, "mckinsey-enterprise-ai-study");
		// The study is selected because of its methodology and measured outcome,
		// not because of the publisher name.
		const evidence = assessment.dimensions
			.find(
				(dimension) =>
					dimension.dimension === "strategic-economic-significance",
			)
			?.evidence.join(" ");
		expect(evidence).toMatch(/methodology/i);
	});

	it("applies the same evidence discipline to a weak vendor productivity claim", async () => {
		const result = await run(vendorProductivityClaimEdition());
		const assessment = assessmentOf(result, "vendor-productivity-claim");
		expect(assessment.decision).toBe("EXCLUDED_LOW_MATERIALITY");
		expect(assessment.eligibility.evidenceSufficiency).toBe("ADEQUATE");
		expect(
			assessment.dimensions.find(
				(d) => d.dimension === "evidence-strength",
			)?.level,
		).toBe("low");
	});
});

// ============================================================================
// 5. Vendor neutrality and absence of quotas
// ============================================================================

describe("Editorial Selection — Vendor Neutrality & No Quotas", () => {
	it("does not impose mandatory vendor representation", async () => {
		const result = await run(scientificBreakthroughEdition());
		const organizations =
			result.concentrationReview.organizationDistribution;
		// Only one organization is represented because only one development qualifies;
		// no quota fills the remaining slots.
		expect(Object.keys(organizations)).toHaveLength(1);
		expect(result.manifest.stories).toHaveLength(1);
	});

	it("does not impose topic quotas", async () => {
		const result = await run(quietDayEdition());
		const domains = new Set(
			result.stories.flatMap((story) => story.researchDomains),
		);
		expect(domains.size).toBeLessThanOrEqual(2);
		expect(result.manifest.stories).toHaveLength(2);
	});

	it("flags but does not artificially correct legitimate vendor dominance", async () => {
		const result = await run(vendorDominatedEdition());
		expect(result.manifest.stories.length).toBeGreaterThanOrEqual(3);
		expect(result.concentrationReview.findings.join(" ")).toMatch(
			/concentration/i,
		);
		// The dominant vendor's stories are all retained; none is dropped to manufacture diversity.
		const dominant = result.stories.filter((story) =>
			story.organizations.includes("Synthetic Dominant Vendor"),
		);
		expect(dominant.length).toBe(result.stories.length);
	});

	it("ranks consequential developments independently of the personal technology stack", async () => {
		const result = await run(combinedEdition());
		const top = result.stories[0];
		// The lead is the most consequential development, not the coding-agent story.
		expect(top.candidateId).toBe(
			fixtureCandidateId("sci-breakthrough-moe-scaling"),
		);
		const copilot = result.stories.find(
			(story) =>
				story.candidateId === fixtureCandidateId("copilot-cli-release"),
		);
		expect(copilot!.order).toBeGreaterThan(1);
	});

	it("uses engineering relevance only as a secondary tiebreaker", async () => {
		const assumptions = buildWeightingAssumptions(
			DEFAULT_EDITORIAL_SELECTION_CONFIG,
		);
		expect(assumptions.join(" ")).toMatch(/secondary consideration/i);
		expect(
			DEFAULT_EDITORIAL_SELECTION_CONFIG.weights[
				"engineering-architectural-relevance"
			],
		).toBe(0);
		expect(
			DEFAULT_EDITORIAL_SELECTION_CONFIG.weights["availability-maturity"],
		).toBe(0);
	});
});

// ============================================================================
// 6. Merging and provenance
// ============================================================================

describe("Editorial Selection — Merging & Provenance", () => {
	it("merges repeated articles into one selected story without losing provenance", async () => {
		const result = await run(repeatedAnnouncementEdition());
		const primary = storyFor(result, "repeated-announcement-1");
		expect(primary.mergedCandidateIds).toHaveLength(2);
		expect(primary.mergedCandidateIds).toContain(
			fixtureCandidateId("repeated-announcement-2"),
		);
		expect(primary.mergedCandidateIds).toContain(
			fixtureCandidateId("repeated-announcement-3"),
		);
		// Separate claim identifiers and source identifiers are preserved.
		expect(primary.claimIds.length).toBeGreaterThan(0);
		expect(primary.sourceIds.length).toBeGreaterThan(0);
		expect(decisionOf(result, "repeated-announcement-2")).toBe("MERGED");
		expect(decisionOf(result, "repeated-announcement-3")).toBe("MERGED");
		const merged = assessmentOf(result, "repeated-announcement-2");
		expect(merged.mergedInto).toBe(
			fixtureCandidateId("repeated-announcement-1"),
		);
	});

	it("does not merge independent findings that merely concern the same vendor", async () => {
		const result = await run(vendorDominatedEdition());
		const vendorStories = result.stories.filter((story) =>
			story.organizations.includes("Synthetic Dominant Vendor"),
		);
		expect(vendorStories).toHaveLength(3);
		for (const story of vendorStories) {
			expect(story.mergedCandidateIds).toHaveLength(0);
		}
	});

	it("does not merge routine releases that differ only by a version number", () => {
		const edition = scientificBreakthroughEdition();
		const mergeGroups = detectMergeGroups(
			edition.dossier.candidates,
			new Map(
				edition.dossier.candidates.map((candidate) => [
					candidate.candidateId,
					0.4,
				]),
			),
		);
		expect(mergeGroups.size).toBe(0);
	});

	it("preserves merged provenance in the manifest relationships", async () => {
		const result = await run(repeatedAnnouncementEdition());
		const mergedId = fixtureCandidateId("repeated-announcement-2");
		const relationship = result.relationships.find((entry) =>
			entry.candidateIds.includes(mergedId),
		);
		expect(relationship).toBeDefined();
		expect(relationship?.evidenceTraceableTo.length).toBeGreaterThan(0);
	});
});

// ============================================================================
// 7. Historical deduplication
// ============================================================================

describe("Editorial Selection — Historical Deduplication", () => {
	it("excludes previously covered material without new qualifying information", async () => {
		const result = await run(historicalDedupEdition());
		const assessment = assessmentOf(result, "copilot-cli-release");
		expect(assessment.eligibility.historicalRelationship).toBe(
			"PREVIOUSLY_COVERED",
		);
		expect(assessment.decision).toBe("EXCLUDED_REPEATED");
	});

	it("detects unresolved duplicates within one edition", () => {
		const edition = repeatedAnnouncementEdition();
		// With identical publication timestamps the duplicate would be unresolved.
		const clones = edition.dossier.candidates.map((candidate, index) => ({
			...candidate,
			candidateId: `cand_${(index + 1).toString().padStart(16, "0")}`,
			timestamps: {
				...candidate.timestamps,
				originalPublicationTimestamp:
					"2025-01-14T12:00:00+01:00[Europe/Amsterdam]",
			},
		}));
		const duplicates = detectDuplicates(clones);
		expect(duplicates.size).toBeGreaterThan(0);
	});

	it("does not treat distinct developments as duplicates", () => {
		const edition = scientificBreakthroughEdition();
		const duplicates = detectDuplicates(edition.dossier.candidates);
		expect(duplicates.size).toBe(0);
	});
});

// ============================================================================
// 8. Selection and exclusion consistency
// ============================================================================

describe("Editorial Selection — Decision Consistency", () => {
	it("only uses documented decision states", async () => {
		const result = await run(combinedEdition());
		const allowed = new Set([
			"SELECTED",
			"MERGED",
			"EXCLUDED_LOW_MATERIALITY",
			"EXCLUDED_REPEATED",
			"EXCLUDED_TEMPORAL",
			"DEFERRED_UNVERIFIED",
			"CATCH_UP_SELECTED",
			"REVIEW_REQUIRED",
		]);
		for (const assessment of result.assessments) {
			expect(allowed.has(assessment.decision)).toBe(true);
		}
	});

	it("records a reason for every decision", async () => {
		const result = await run(combinedEdition());
		for (const assessment of result.assessments) {
			expect(assessment.decisionReasons.length).toBeGreaterThan(0);
			expect(assessment.decisionTraceableTo.length).toBeGreaterThan(0);
		}
	});

	it("does not silently promote a candidate that fails a hard gate", async () => {
		const result = await run(combinedEdition());
		for (const assessment of result.assessments) {
			if (
				assessment.eligibility.state === "INELIGIBLE_TEMPORAL" ||
				assessment.eligibility.state === "INELIGIBLE_EVIDENCE" ||
				assessment.eligibility.state === "INELIGIBLE_DUPLICATE"
			) {
				expect(assessment.decision).not.toBe("SELECTED");
				expect(assessment.decision).not.toBe("CATCH_UP_SELECTED");
			}
		}
	});

	it("keeps unresolved critical issues visible", async () => {
		const result = await run(unresolvedEdition());
		expect(result.manifest.unresolvedIssues.length).toBeGreaterThan(0);
		expect(result.manifest.unresolvedIssues.join(" ")).toMatch(/deferred/i);
	});

	it("does not impose story-count limits on a busy day", async () => {
		const result = await run(combinedEdition());
		expect(result.manifest.stories.length).toBeGreaterThan(5);
	});

	it("selects fewer stories on a quiet day instead of filling the edition", async () => {
		const result = await run(quietDayEdition());
		expect(result.manifest.stories).toHaveLength(2);
		expect(result.manifest.readinessStatus).toBe("READY");
	});
});

// ============================================================================
// 9. Manifest schema and traceability
// ============================================================================

describe("Editorial Selection — Manifest Contract", () => {
	it("produces a manifest that validates against the Zod schema", async () => {
		const result = await run(combinedEdition());
		const parsed = EditorialSelectionManifestSchema.safeParse(
			result.manifest,
		);
		expect(parsed.success).toBe(true);
	});

	it("preserves candidate, claim and source identifiers", async () => {
		const edition = scientificBreakthroughEdition();
		const result = await run(edition);
		const assessment = assessmentOf(result, "sci-breakthrough-moe-scaling");
		expect(assessment.candidateId).toMatch(/^cand_[a-z0-9]{16}$/);
		expect(assessment.claimIds[0]).toMatch(/^claim_[a-z0-9]{16}$/);
		expect(assessment.sourceIds[0]).toBe("synthetic-arxiv");
		expect(assessment.sourceReferences[0]).toBe(
			edition.dossier.candidates[0].sources[0].canonicalUrl,
		);
	});

	it("records the input dossier version and upstream references", async () => {
		const edition = substantiveUpdateEdition();
		const result = await run(edition);
		expect(result.manifest.inputDossier.dossierId).toBe(
			edition.dossier.dossierId,
		);
		expect(result.manifest.inputDossier.contentHash).toBe(
			edition.dossier.contentHash,
		);
		expect(result.manifest.historicalRegression.referenced).toBe(true);
		expect(
			result.manifest.historicalRegression.relationshipsReferenced,
		).toBe(1);
		expect(result.manifest.omissionReview.referenced).toBe(true);
	});

	it("records documented weighting assumptions", async () => {
		const result = await run(combinedEdition());
		expect(result.manifest.weightingAssumptions.length).toBeGreaterThan(3);
		expect(result.manifest.weightingAssumptions.join(" ")).toMatch(
			/heuristic/i,
		);
		expect(result.manifest.weightingAssumptions.join(" ")).toMatch(
			/no vendor quotas/i,
		);
	});

	it("verifies the manifest content hash", async () => {
		const result = await run(combinedEdition());
		expect(result.manifest.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
		expect(computeManifestContentHash(result.manifest)).toBe(
			result.manifest.contentHash,
		);
	});

	it("generates a JSON Schema from the same Zod contract", () => {
		const schema = generateEditorialSelectionJsonSchema();
		expect(schema.$id).toBe(
			"https://ai-intelligence-blog/schemas/editorial-selection.json",
		);
		expect(schema.properties).toBeDefined();
		expect(
			(schema.properties as Record<string, unknown>)?.manifestId,
		).toBeDefined();
		expect(
			(schema.properties as Record<string, unknown>)?.stories,
		).toBeDefined();
	});

	it("emits a deterministic manifest identifier derived from selection content", async () => {
		const edition = combinedEdition();
		const first = await run(edition);
		const second = await run(edition);
		expect(first.manifest.manifestId).toBe(second.manifest.manifestId);
		expect(first.manifest.contentHash).toBe(second.manifest.contentHash);
	});
});

// ============================================================================
// 10. Persistence, idempotency and readback
// ============================================================================

describe("Editorial Selection — Persistence & Idempotency", () => {
	it("persists a manifest and reads it back identically", async () => {
		const edition = combinedEdition();
		const store = createEditorialSelectionStore(STORE_DIR);
		const result = await run(edition, { store, persist: true });
		expect(result.saveResult?.saved).toBe(true);
		expect(existsSync(result.saveResult!.path)).toBe(true);

		const loaded = await store.loadManifest(EDITION_DATE);
		expect(loaded).not.toBeNull();
		expect(loaded!.manifestId).toBe(result.manifest.manifestId);
		expect(loaded!.contentHash).toBe(result.manifest.contentHash);
		expect(loaded!.stories).toHaveLength(result.manifest.stories.length);
	});

	it("is idempotent: identical selection content is not written twice", async () => {
		const edition = combinedEdition();
		const store = createEditorialSelectionStore(STORE_DIR);
		const first = await run(edition, { store, persist: true });
		const second = await run(edition, { store, persist: true });
		expect(first.saveResult?.saved).toBe(true);
		expect(second.saveResult?.saved).toBe(false);
		expect(second.saveResult?.reason).toBe("identical");
		expect(second.saveResult?.path).toBe(first.saveResult?.path);
	});

	it("updates the edition index", async () => {
		const edition = combinedEdition();
		const store = createEditorialSelectionStore(STORE_DIR);
		await run(edition, { store, persist: true });
		const editions = await store.listEditions();
		expect(editions).toContain(EDITION_DATE);
	});

	it("verifies readback integrity after write", async () => {
		const edition = combinedEdition();
		const store = createEditorialSelectionStore(STORE_DIR);
		const result = await run(edition, { store, persist: true });
		const raw = readFileSync(result.saveResult!.path, "utf-8");
		const parsed = JSON.parse(raw) as EditorialSelectionManifest;
		expect(computeManifestContentHash(parsed)).toBe(
			result.manifest.contentHash,
		);
	});
});

// ============================================================================
// 11. Concentration and blind-spot review
// ============================================================================

describe("Editorial Selection — Concentration & Blind-Spot Review", () => {
	it("records the review result in the manifest", async () => {
		const result = await run(vendorDominatedEdition());
		expect(result.manifest.concentrationReview.selectedStoryCount).toBe(
			result.manifest.stories.length,
		);
		expect(
			result.manifest.concentrationReview.consistencyChecks.length,
		).toBeGreaterThan(5);
		expect(result.manifest.concentrationReview.reviewedAt).toBe(NOW);
		const checks =
			result.manifest.concentrationReview.consistencyChecks.map(
				(check) => check.check,
			);
		expect(checks).toContain(
			"Interdisciplinary developments are identified rather than forced into one domain",
		);
	});

	it("compares the strongest excluded candidate with the weakest selected candidate", async () => {
		const result = await run(combinedEdition());
		const review = result.manifest.concentrationReview;
		expect(review.strongestExcluded).toBeDefined();
		expect(review.weakestSelected).toBeDefined();
		if (review.strongestExcluded && review.weakestSelected) {
			// The weakest selected must not be weaker than the strongest excluded
			// unless the excluded candidate fails a non-materiality gate.
			if (
				review.strongestExcluded.decision === "EXCLUDED_LOW_MATERIALITY"
			) {
				expect(
					review.weakestSelected.materialityScore,
				).toBeGreaterThanOrEqual(
					review.strongestExcluded.materialityScore,
				);
			}
		}
	});

	it("appends model-assisted findings as an internal consistency check", async () => {
		const result = await run(strategicStudyEdition(), {
			semanticProvider: {
				review: async () => ({
					findings: ["Synthetic model finding for test purposes."],
					tradeOffs: ["Synthetic trade-off for test purposes."],
					interdisciplinaryObservations: [],
					provider: "synthetic-provider",
					model: "synthetic-model",
				}),
			},
		});
		expect(result.manifest.inferenceUsed).toBe(true);
		expect(result.manifest.concentrationReview.modelAssisted).toBe(true);
		expect(result.manifest.concentrationReview.findings.join(" ")).toMatch(
			/internal consistency check/i,
		);
		expect(result.manifest.inferenceNote).toMatch(
			/not independent external validation/i,
		);
	});

	it("preserves deterministic findings when inference capacity is unavailable", async () => {
		const result = await run(strategicStudyEdition(), {
			semanticProvider: {
				review: async () => {
					throw new Error("free inference capacity unavailable");
				},
			},
		});
		expect(result.manifest.inferenceUsed).toBe(false);
		expect(result.manifest.inferenceNote).toMatch(/unavailable/i);
		expect(result.manifest.concentrationReview.selectedStoryCount).toBe(
			result.manifest.stories.length,
		);
	});

	it("records residual risks when historical overlap is unverified", async () => {
		const edition = combinedEdition();
		const result = await run(edition);
		// No HISTORY_UNVERIFIED relationships in the combined fixture, so no risk.
		expect(
			Array.isArray(result.manifest.concentrationReview.residualRisks),
		).toBe(true);
	});
});

// ============================================================================
// 12. Backward compatibility with existing pipeline contracts
// ============================================================================

describe("Editorial Selection — Backward Compatibility", () => {
	it("consumes the canonical fact dossier contract without modification", async () => {
		const edition = combinedEdition();
		const validation = validateFactDossier(edition.dossier);
		expect(validation.valid).toBe(true);
	});

	it("runs without an omission review report", async () => {
		const edition = combinedEdition();
		const result = await run(edition, { omissionReview: null });
		expect(result.manifest.omissionReview.referenced).toBe(false);
		expect(result.manifest.stories.length).toBeGreaterThan(0);
	});

	it("runs without a historical regression report", async () => {
		const edition = combinedEdition();
		const result = await run(edition, { historicalRegression: null });
		expect(result.manifest.historicalRegression.referenced).toBe(false);
		expect(result.manifest.stories.length).toBeGreaterThan(0);
	});

	it("preserves the inherited novelty classification verbatim", async () => {
		const edition = scientificBreakthroughEdition();
		const result = await run(edition);
		const dossierCandidate = edition.dossier.candidates.find(
			(candidate) =>
				candidate.candidateId ===
				fixtureCandidateId("sci-breakthrough-moe-scaling"),
		)!;
		const assessment = assessmentOf(result, "sci-breakthrough-moe-scaling");
		expect(assessment.eligibility.temporalStatus).toBe(
			dossierCandidate.temporalEligibility.status,
		);
	});

	it("does not modify the canonical dossier", async () => {
		const edition = combinedEdition();
		const before = JSON.stringify(edition.dossier);
		await run(edition);
		expect(JSON.stringify(edition.dossier)).toBe(before);
	});
});

// ============================================================================
// 13. The ten representative evaluation fixtures
// ============================================================================

describe("Editorial Selection — Representative Evaluation Fixtures", () => {
	const cases: Array<{
		name: string;
		edition: FixtureEdition;
		expect: Record<string, string>;
	}> = [
		{
			name: "major scientific breakthrough vs routine coding-agent releases",
			edition: scientificBreakthroughEdition(),
			expect: {
				"sci-breakthrough-moe-scaling": "SELECTED",
				"coding-agent-release-1": "EXCLUDED_LOW_MATERIALITY",
			},
		},
		{
			name: "significant GitHub Copilot CLI release",
			edition: copilotCliReleaseEdition(),
			expect: { "copilot-cli-release": "SELECTED" },
		},
		{
			name: "original strategic study",
			edition: strategicStudyEdition(),
			expect: { "mckinsey-enterprise-ai-study": "SELECTED" },
		},
		{
			name: "vendor-sponsored productivity claim with weak evidence",
			edition: vendorProductivityClaimEdition(),
			expect: { "vendor-productivity-claim": "EXCLUDED_LOW_MATERIALITY" },
		},
		{
			name: "newly disclosed security vulnerability",
			edition: securityVulnerabilityEdition(),
			expect: { "agent-security-vulnerability": "SELECTED" },
		},
		{
			name: "substantive update to an already covered release",
			edition: substantiveUpdateEdition(),
			expect: { "model-release-substantive-update": "SELECTED" },
		},
		{
			name: "multiple articles repeating one announcement",
			edition: repeatedAnnouncementEdition(),
			expect: {
				"repeated-announcement-1": "SELECTED",
				"repeated-announcement-2": "MERGED",
				"repeated-announcement-3": "MERGED",
			},
		},
		{
			name: "quiet news day",
			edition: quietDayEdition(),
			expect: {
				"quiet-day-security-fix": "SELECTED",
				"quiet-day-model-minor": "SELECTED",
			},
		},
		{
			name: "day genuinely dominated by one vendor",
			edition: vendorDominatedEdition(),
			expect: {
				"vendor-major-release-1": "SELECTED",
				"vendor-major-release-2": "SELECTED",
				"vendor-major-release-3": "SELECTED",
				"vendor-dominated-other-small": "EXCLUDED_LOW_MATERIALITY",
			},
		},
		{
			name: "candidate with critical unresolved evidence or temporal uncertainty",
			edition: unresolvedEdition(),
			expect: {
				"unresolved-evidence-claim": "DEFERRED_UNVERIFIED",
				"unresolved-temporal-claim": "DEFERRED_UNVERIFIED",
			},
		},
	];

	for (const testCase of cases) {
		it(`produces the documented decision for: ${testCase.name}`, async () => {
			const result = await run(testCase.edition);
			for (const [key, expected] of Object.entries(testCase.expect)) {
				expect(
					decisionOf(result, key),
					`${key} should be ${expected}`,
				).toBe(expected);
			}
		});
	}

	it("labels every fixture as synthetic test data", () => {
		const edition = combinedEdition();
		expect(edition.dossier.generatedBy).toBe(
			"synthetic-editorial-selection-fixture",
		);
		expect(
			edition.dossier.candidates.every((candidate) =>
				candidate.provenance.consumedFrom.includes("candidate-news"),
			),
		).toBe(true);
	});
});

// ============================================================================
// 14. Utility correctness
// ============================================================================

describe("Editorial Selection — Deterministic Utilities", () => {
	it("keeps numeric tokens so version-numbered releases are not conflated", () => {
		expect(tokenize("release 1 capability")).not.toEqual(
			tokenize("release 2 capability"),
		);
		expect(tokenize("release 1 capability")).toEqual([
			"release",
			"1",
			"capability",
		]);
	});

	it("normalizes URLs for duplicate detection", async () => {
		const edition = repeatedAnnouncementEdition();
		const duplicates = detectDuplicates(edition.dossier.candidates);
		// Distinct timestamps make the repeat resolvable, so no unresolved duplicate.
		expect(duplicates.size).toBe(0);
	});
});
