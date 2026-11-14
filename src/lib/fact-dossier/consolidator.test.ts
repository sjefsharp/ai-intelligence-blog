/**
 * Canonical Fact Dossier — Regression Tests
 *
 * SYNTHETIC TEST DATA throughout. The fixtures are invented and must not be
 * read as real research findings, vendor announcements or editorial judgements.
 *
 * Coverage:
 * - Candidate and claim identifier integrity
 * - Source-to-claim traceability
 * - Preservation of original evidence URLs
 * - Publication / disclosure / event / update timestamp distinctions
 * - Accurate inheritance of novelty classifications
 * - Preservation of evidence classifications
 * - Multiple claims and sources per candidate
 * - Contradictory evidence and unresolved uncertainty
 * - Research methodology and strategic findings
 * - Historical overlap and unavailable previous editions
 * - Duplicate prevention and idempotent updates
 * - Schema validation and backward compatibility
 * - Persistence, readback and recovery
 * - Prevention of unsupported factual promotion
 * - Editorial readiness without premature selection
 * - Optional enrichment degradation
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs, readFileSync } from "fs";
import path from "path";
import Ajv from "ajv";

import {
	buildDossier,
	buildCanonicalCandidate,
	buildCandidateCore,
	consolidateClaims,
	deriveTemporalEligibilityStatus,
	type ConsolidationContext,
} from "./consolidator.js";
import { validateFactDossier } from "./validate.js";
import { FactDossierStore } from "./store.js";
import {
	canonicalJson,
	computeDossierContentHash,
	verifyDossierContentHash,
} from "./canonical.js";
import { enrichDossier, type EnrichmentProvider } from "./enrichment.js";
import {
	CanonicalFactDossierSchema,
	FACT_DOSSIER_SCHEMA_VERSION,
	ID_PATTERNS,
	type CanonicalFactDossier,
} from "./schema.js";
import {
	EDITION_DATE,
	createContext,
	createRepresentativeFixtures,
	createMockCandidate,
	createMockClaim,
	createMockDiscovery,
	createMockEvidence,
	createSourceRegistry,
	type RepresentativeFixture,
} from "./fixtures.js";

// ============================================================================
// Helpers
// ============================================================================

const TEST_DIR = path.join(process.cwd(), "data", "test-fact-dossiers");

function buildEditionDossier(
	context: ConsolidationContext = createContext(),
	items: Array<
		| RepresentativeFixture
		| import("./consolidator.js").CandidateConsolidationInput
	> = createRepresentativeFixtures(),
): CanonicalFactDossier {
	const inputs = items.map((item) => ("input" in item ? item.input : item));
	return buildDossier(EDITION_DATE, inputs, context);
}

function fixtureByKey(key: string): RepresentativeFixture {
	const fixture = createRepresentativeFixtures().find((f) => f.key === key);
	if (!fixture) throw new Error(`Unknown fixture: ${key}`);
	return fixture;
}

// ============================================================================
// Schema & validation
// ============================================================================

describe("Canonical Fact Dossier — Schema & Validation", () => {
	it("produces a schema-valid dossier for the representative fixtures", () => {
		const dossier = buildEditionDossier();
		const result = validateFactDossier(dossier);
		expect(result.errors).toEqual([]);
		expect(result.valid).toBe(true);
	});

	it("validates against the generated draft-07 JSON Schema (AJV)", () => {
		const schemaPath = path.join(
			process.cwd(),
			"data",
			"schemas",
			"canonical-fact-dossier.json",
		);
		const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
		const ajv = new Ajv({
			allErrors: true,
			strict: false,
			formats: { "date-time": true, uri: true },
		});
		const validate = ajv.compile(schema);
		const dossier = buildEditionDossier();
		expect(validate(dossier)).toBe(true);
		if (validate.errors) {
			// eslint-disable-next-line no-console
			console.error(JSON.stringify(validate.errors, null, 2));
		}
	});

	it("declares an explicit schema version", () => {
		const dossier = buildEditionDossier();
		expect(dossier.schemaVersion).toBe(FACT_DOSSIER_SCHEMA_VERSION);
	});

	it("computes a verifiable content hash", () => {
		const dossier = buildEditionDossier();
		expect(dossier.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
		expect(verifyDossierContentHash(dossier)).toBe(true);
		expect(computeDossierContentHash(dossier)).toBe(dossier.contentHash);
	});

	it("serializes deterministically", () => {
		const a = buildEditionDossier();
		const b = buildEditionDossier();
		expect(canonicalJson(a)).toBe(canonicalJson(b));
	});
});

// ============================================================================
// Identifier integrity
// ============================================================================

describe("Canonical Fact Dossier — Identifier Integrity", () => {
	it("assigns unique candidate identifiers matching the stable pattern", () => {
		const dossier = buildEditionDossier();
		const ids = dossier.candidates.map((c) => c.candidateId);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) expect(id).toMatch(ID_PATTERNS.candidate);
	});

	it("assigns unique claim identifiers matching the stable pattern", () => {
		const dossier = buildEditionDossier();
		const ids = dossier.candidates.flatMap((c) =>
			c.claims.map((cl) => cl.claimId),
		);
		expect(ids.length).toBeGreaterThan(0);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) expect(id).toMatch(ID_PATTERNS.claim);
	});

	it("uses one stable dossier identifier per edition", () => {
		const a = buildEditionDossier();
		const b = buildEditionDossier();
		expect(a.dossierId).toBe(b.dossierId);
		expect(a.dossierId).toMatch(ID_PATTERNS.dossier);
		expect(a.editionId).toBe(`edition_${EDITION_DATE}`);
	});
});

// ============================================================================
// Source-to-claim traceability
// ============================================================================

describe("Canonical Fact Dossier — Source-to-Claim Traceability", () => {
	it("preserves original evidence URLs for every claim", () => {
		const fixture = fixtureByKey("scientific-paper");
		const claim = fixture.input.claims[0];
		const expectedUrl = claim.supportingEvidence[0].url;
		const dossier = buildEditionDossier(createContext(), [fixture]);
		const consolidated = dossier.candidates[0].claims[0];
		expect(consolidated.supportingEvidenceUrls).toContain(expectedUrl);
	});

	it("links every claim to its candidate and records source provenance", () => {
		const dossier = buildEditionDossier();
		const candidateIds = new Set(
			dossier.candidates.map((c) => c.candidateId),
		);
		for (const candidate of dossier.candidates) {
			expect(candidate.claims.length).toBeGreaterThan(0);
			for (const claim of candidate.claims) {
				expect(claim.candidateId).toBe(candidate.candidateId);
				expect(candidateIds.has(claim.candidateId)).toBe(true);
				expect(claim.sourceProvenance.sourceId).toBeTruthy();
				expect(claim.sourceProvenance.url).toMatch(/^https?:\/\//);
				expect(
					claim.sourceProvenance.verificationTimestamp,
				).toBeTruthy();
			}
		}
	});

	it("records source references with canonical URLs and retrieval status", () => {
		const dossier = buildEditionDossier();
		for (const candidate of dossier.candidates) {
			expect(candidate.sources.length).toBeGreaterThan(0);
			for (const source of candidate.sources) {
				expect(source.sourceId).toMatch(ID_PATTERNS.source);
				expect(source.canonicalUrl).toMatch(/^https?:\/\//);
			}
		}
	});
});

// ============================================================================
// Timestamp distinctions
// ============================================================================

describe("Canonical Fact Dossier — Timestamp Distinctions", () => {
	it("preserves publication, first disclosure, underlying event and update timestamps separately", () => {
		const fixture = fixtureByKey("original-reporting-older-event");
		const dossier = buildEditionDossier(createContext(), [fixture]);
		const timestamps = dossier.candidates[0].timestamps;

		expect(timestamps.originalPublicationTimestamp).toContain("2025-01-14");
		expect(timestamps.earliestSupportedPublicDisclosureTimestamp).toContain(
			"2025-01-14",
		);
		expect(timestamps.underlyingEventDate).toContain("2023-03-15");
		expect(timestamps.originalPublicationTimestamp).not.toBe(
			timestamps.underlyingEventDate,
		);
		expect(timestamps.retrievalTimestamp).toContain("2025-01-15");
		expect(timestamps.timezone).toBeTruthy();
		expect(timestamps.timestampConfidence).toBeGreaterThan(0);
	});

	it("preserves a substantive update timestamp distinctly", () => {
		const fixture = fixtureByKey("substantive-update");
		const dossier = buildEditionDossier(createContext(), [fixture]);
		const timestamps = dossier.candidates[0].timestamps;
		expect(timestamps.substantiveUpdateTimestamp).toBeTruthy();
		expect(timestamps.originalPublicationTimestamp).toBeTruthy();
	});

	it("marks unavailable timestamps explicitly instead of inferring them", () => {
		const fixture = fixtureByKey("time-unverified");
		const dossier = buildEditionDossier(createContext(), [fixture]);
		const timestamps = dossier.candidates[0].timestamps;
		expect(timestamps.timestampAvailability).toBe("unavailable");
		expect(timestamps.originalPublicationTimestamp).toBeUndefined();
	});
});

// ============================================================================
// Novelty inheritance
// ============================================================================

describe("Canonical Fact Dossier — Novelty Inheritance", () => {
	it("maps NEW in-window items to NEW_PASS", () => {
		const fixture = fixtureByKey("scientific-paper");
		const dossier = buildEditionDossier(createContext(), [fixture]);
		expect(dossier.candidates[0].temporalEligibility.status).toBe(
			"NEW_PASS",
		);
		expect(
			dossier.candidates[0].temporalEligibility.noveltyClassification
				.classification,
		).toBe("NEW");
	});

	it("maps in-window reposts/summaries to NEW_FAIL", () => {
		const fixture = fixtureByKey("new-fail-repost");
		const dossier = buildEditionDossier(createContext(), [fixture]);
		const eligibility = dossier.candidates[0].temporalEligibility;
		expect(eligibility.status).toBe("NEW_FAIL");
		expect(eligibility.noveltyClassification.isRepostOrSummary).toBe(true);
		expect(eligibility.noveltyClassification.inWindow).toBe(true);
	});

	it("maps explicitly dated older material to CATCH_UP", () => {
		const fixture = fixtureByKey("catch-up");
		const dossier = buildEditionDossier(createContext(), [fixture]);
		const eligibility = dossier.candidates[0].temporalEligibility;
		expect(eligibility.status).toBe("CATCH_UP");
		expect(eligibility.noveltyClassification.classification).toBe(
			"CATCH_UP",
		);
	});

	it("maps unverifiable publication timing to TIME_UNVERIFIED", () => {
		const fixture = fixtureByKey("time-unverified");
		const dossier = buildEditionDossier(createContext(), [fixture]);
		expect(dossier.candidates[0].temporalEligibility.status).toBe(
			"TIME_UNVERIFIED",
		);
	});

	it("stores the inherited novelty classification verbatim with provenance", () => {
		const fixture = fixtureByKey("scientific-paper");
		const dossier = buildEditionDossier(createContext(), [fixture]);
		const eligibility = dossier.candidates[0].temporalEligibility;
		expect(eligibility.derivedFrom).toBe("novelty-classification");
		expect(
			eligibility.noveltyClassification.evidence.length,
		).toBeGreaterThan(0);
		expect(eligibility.noveltyClassification.reasoning).toBeTruthy();
		expect(eligibility.editionBoundary.timezone).toBe("Europe/Amsterdam");
	});

	it("derives eligibility status deterministically from the inherited classification", () => {
		const fixture = fixtureByKey("new-fail-repost");
		const result = fixture.input.claims[0] ? undefined : undefined;
		expect(result).toBeUndefined();
		const dossier = buildEditionDossier(createContext(), [fixture]);
		const eligibility = dossier.candidates[0].temporalEligibility;
		expect(
			deriveTemporalEligibilityStatus(eligibility.noveltyClassification),
		).toBe(eligibility.status);
	});
});

// ============================================================================
// Evidence classification preservation
// ============================================================================

describe("Canonical Fact Dossier — Evidence Classification Preservation", () => {
	it("preserves VENDOR_CLAIM without promoting it", () => {
		const fixture = fixtureByKey("coding-agent-release");
		const dossier = buildEditionDossier(createContext(), [fixture]);
		const claim = dossier.candidates[0].claims[0];
		expect(claim.evidenceClassification).toBe("VENDOR_CLAIM");
		expect(claim.verificationStatus).toBe("unverified");
		expect(claim.verificationLevel).toBe("L0");
		expect(claim.inclusionNote).toMatch(/NOT independently verified/i);
	});

	it("preserves RESEARCH_FINDING with methodology context", () => {
		const fixture = fixtureByKey("scientific-paper");
		const dossier = buildEditionDossier(createContext(), [fixture]);
		const claim = dossier.candidates[0].claims[0];
		expect(claim.evidenceClassification).toBe("RESEARCH_FINDING");
		expect(claim.verificationLevel).toBe("L2");
		expect(claim.methodologicalContext?.methodology).toBeTruthy();
		expect(
			claim.methodologicalContext?.reproducibility?.artifactAvailable,
		).toBe(true);
	});

	it("preserves EXPERT_INTERPRETATION for advisory findings", () => {
		const fixture = fixtureByKey("advisory-finding");
		const dossier = buildEditionDossier(createContext(), [fixture]);
		const claim = dossier.candidates[0].claims[0];
		expect(claim.evidenceClassification).toBe("EXPERT_INTERPRETATION");
		expect(claim.verificationStatus).toBe("partially-verified");
	});

	it("preserves ORIGINAL_REPORTING for first-hand disclosure", () => {
		const fixture = fixtureByKey("original-reporting-older-event");
		const dossier = buildEditionDossier(createContext(), [fixture]);
		const claim = dossier.candidates[0].claims[0];
		expect(claim.evidenceClassification).toBe("ORIGINAL_REPORTING");
	});
});

// ============================================================================
// Multiple claims and sources per candidate
// ============================================================================

describe("Canonical Fact Dossier — Multiple Claims and Sources", () => {
	it("consolidates multiple claims and multiple sources for one candidate", () => {
		const candidateId = "cand_0000000000000100";
		const input = {
			candidate: createMockCandidate({
				id: candidateId,
				sourceIds: ["arxiv-cs-lg", "github-copilot-vscode"],
				tier: 1,
				ringClassificationDistribution: { 1: 1, 2: 1, 3: 0 },
			}),
			discovery: createMockDiscovery({
				sourceId: "arxiv-cs-lg",
				publishedAt: "2025-01-14T12:00:00+01:00[Europe/Amsterdam]",
				url: "https://arxiv.org/abs/multi-claim",
			}),
			claims: [
				createMockClaim({
					id: "claim_0000000000000100",
					candidateId,
					claim: "First synthetic claim.",
					claimType: "scientific-research",
					evidenceClassification: "RESEARCH_FINDING",
					verificationStatus: "verified",
					verificationLevel: "L1",
					supportingEvidence: [
						createMockEvidence({
							sourceId: "arxiv-cs-lg",
							url: "https://arxiv.org/abs/multi-claim",
						}),
					],
				}),
				createMockClaim({
					id: "claim_0000000000000101",
					candidateId,
					claim: "Second synthetic claim.",
					claimType: "vendor-announcement",
					evidenceClassification: "VENDOR_CLAIM",
					verificationStatus: "unverified",
					verificationLevel: "L0",
					supportingEvidence: [
						createMockEvidence({
							sourceId: "github-copilot-vscode",
							url: "https://github.blog/changelog/second",
						}),
					],
				}),
			],
		};

		const dossier = buildEditionDossier(createContext(), [input]);
		expect(dossier.candidates[0].claims).toHaveLength(2);
		expect(dossier.candidates[0].sources).toHaveLength(2);
		expect(dossier.candidates[0].discoveryRings).toEqual([1, 2]);
		expect(dossier.editionSummary.totalClaims).toBe(2);
	});
});

// ============================================================================
// Contradictory evidence and unresolved uncertainty
// ============================================================================

describe("Canonical Fact Dossier — Contradictory Evidence & Uncertainty", () => {
	it("records contradictory evidence and blocking uncertainties", () => {
		const fixture = fixtureByKey("contradictory-evidence");
		const dossier = buildEditionDossier(createContext(), [fixture]);
		const claim = dossier.candidates[0].claims[0];

		expect(claim.contradictoryEvidence).toHaveLength(1);
		expect(claim.contradictoryEvidence[0].contradictionType).toBe("direct");
		expect(claim.verificationStatus).toBe("contradicted");
		expect(claim.uncertainty.unresolved.length).toBeGreaterThan(0);
		expect(claim.uncertainty.unresolved.some((u) => u.blocking)).toBe(true);
		expect(
			dossier.candidates[0].unresolvedQuestions.some((q) =>
				q.includes("Contradictory evidence"),
			),
		).toBe(true);
		expect(
			dossier.uncertaintyRegister.some(
				(u) => u.claimId === claim.claimId,
			),
		).toBe(true);
	});

	it("preserves the counterevidence source and URL", () => {
		const fixture = fixtureByKey("contradictory-evidence");
		const dossier = buildEditionDossier(createContext(), [fixture]);
		const contradictory =
			dossier.candidates[0].claims[0].contradictoryEvidence[0];
		expect(contradictory.sourceId).toBe("independent-lab");
		expect(contradictory.url).toMatch(/^https?:\/\//);
	});
});

// ============================================================================
// Research methodology and strategic findings
// ============================================================================

describe("Canonical Fact Dossier — Research Methodology & Strategic Findings", () => {
	it("preserves advisory research methodology and integrity context", () => {
		const fixture = fixtureByKey("advisory-finding");
		const dossier = buildEditionDossier(createContext(), [fixture]);
		const strategic = dossier.candidates[0].claims[0].strategicContext;

		expect(strategic).toBeDefined();
		expect(strategic?.researchPurpose).toBeTruthy();
		expect(strategic?.sampleSize).toBe(1000);
		expect(strategic?.geographicScope).toBeTruthy();
		expect(strategic?.industryCoverage).toBeTruthy();
		expect(strategic?.researchPeriod).toBeTruthy();
		expect(strategic?.statisticalUncertainty).toBeTruthy();
		expect(strategic?.fundingSources).toContain(
			"McKinsey Global Institute",
		);
		expect(strategic?.conflictsOfInterest?.length).toBeGreaterThan(0);
		expect(strategic?.causalClaimType).toBe("prediction");
		expect(strategic?.generalizability).toBeTruthy();
		expect(strategic?.competingExplanations?.length).toBeGreaterThan(0);
	});

	it("preserves enterprise, economic, workforce and governance implications", () => {
		const fixture = fixtureByKey("advisory-finding");
		const dossier = buildEditionDossier(createContext(), [fixture]);
		const strategic = dossier.candidates[0].claims[0].strategicContext;

		expect(strategic?.economicImpact?.length).toBeGreaterThan(0);
		expect(strategic?.workforceImplications?.length).toBeGreaterThan(0);
		expect(strategic?.governanceImplications?.length).toBeGreaterThan(0);
		expect(strategic?.measuredOutcome).toBeTruthy();
		expect(strategic?.baseline).toBeTruthy();
	});

	it("preserves vendor productivity context without promoting it", () => {
		const fixture = fixtureByKey("vendor-productivity-claim");
		const dossier = buildEditionDossier(createContext(), [fixture]);
		const claim = dossier.candidates[0].claims[0];
		expect(claim.claimType).toBe("productivity-claim");
		expect(claim.evidenceClassification).toBe("VENDOR_CLAIM");
		expect(claim.strategicContext?.measuredOutcome).toMatch(/55%/);
		expect(claim.strategicContext?.baseline).toBeTruthy();
		expect(dossier.candidates[0].evidenceGaps.length).toBeGreaterThan(0);
	});
});

// ============================================================================
// Historical continuity
// ============================================================================

describe("Canonical Fact Dossier — Historical Continuity", () => {
	it("references actually available earlier editions", () => {
		const context = createContext({
			previousEditions: {
				availableEditionDates: new Set(["2025-01-14"]),
				candidates: [
					{
						candidateId: "cand_0000000000009999",
						editionDate: "2025-01-14",
						title: "Mixture-of-Experts scaling laws show sublinear expert growth",
						sourceIds: ["arxiv-cs-lg"],
						publicationId: "pub_0000000000009999",
						evidenceUrl: "https://example.com/previous",
					},
				],
			},
		});
		const fixture = fixtureByKey("scientific-paper");
		const dossier = buildEditionDossier(context, [fixture]);
		const coverage = dossier.candidates[0].previousCoverage;
		const match = coverage.find((p) => p.editionDate === "2025-01-14");
		expect(match).toBeDefined();
		expect(match?.available).toBe(true);
		expect(match?.candidateId).toBe("cand_0000000000009999");
	});

	it("keeps missing earlier editions as explicit uncertainty", () => {
		const context = createContext({
			previousEditions: {
				availableEditionDates: new Set(),
				candidates: [],
			},
		});
		const fixture = fixtureByKey("scientific-paper");
		const dossier = buildEditionDossier(context, [fixture]);
		const coverage = dossier.candidates[0].previousCoverage;
		const missing = coverage.filter((p) => !p.available);
		expect(missing.length).toBeGreaterThan(0);
		expect(
			missing.every((p) => p.note?.includes("cannot be established")),
		).toBe(true);
	});

	it("does not interpret missing editions as proof of no prior coverage", () => {
		const context = createContext({
			previousEditions: {
				availableEditionDates: new Set(),
				candidates: [],
			},
		});
		const fixture = fixtureByKey("scientific-paper");
		const dossier = buildEditionDossier(context, [fixture]);
		const continuity = dossier.historicalContinuity.find(
			(h) => h.candidateId === dossier.candidates[0].candidateId,
		);
		expect(continuity).toBeDefined();
		expect(continuity?.missingEditions.length).toBeGreaterThan(0);
		expect(continuity?.note).toMatch(/cannot be established/i);
		expect(
			dossier.candidates[0].unresolvedQuestions.some((q) =>
				q.includes("unavailable"),
			),
		).toBe(true);
	});
});

// ============================================================================
// Duplicate prevention and idempotent updates
// ============================================================================

describe("Canonical Fact Dossier — Duplicate Prevention & Idempotent Updates", () => {
	it("does not duplicate candidates when rebuilt from the same inputs", () => {
		const inputs = createRepresentativeFixtures().map((f) => f.input);
		const dossier = buildDossier(EDITION_DATE, inputs, createContext());
		const ids = dossier.candidates.map((c) => c.candidateId);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("save is a no-op for identical content", async () => {
		const store = new FactDossierStore(TEST_DIR);
		await store.initialize();
		const dossier = buildEditionDossier();

		const first = await store.save(dossier);
		expect(first.saved).toBe(true);
		expect(first.reason).toBe("written");

		const second = await store.save(dossier);
		expect(second.saved).toBe(false);
		expect(second.reason).toBe("identical");
	});

	it("save writes a new version with previousVersionHash for changed content", async () => {
		const store = new FactDossierStore(TEST_DIR);
		await store.initialize();
		const original = buildEditionDossier();
		await store.save(original);

		const changed = {
			...original,
			candidates: original.candidates.map((c, index) =>
				index === 0
					? {
							...c,
							factualHeadline: `${c.factualHeadline} (updated)`,
						}
					: c,
			),
		};
		changed.contentHash = computeDossierContentHash(changed);

		const result = await store.save(changed);
		expect(result.saved).toBe(true);
		expect(result.reason).toBe("updated");
		expect(result.previousVersionHash).toBe(original.contentHash);

		const loaded = await store.load(EDITION_DATE);
		expect(loaded?.previousVersionHash).toBe(original.contentHash);
		expect(loaded?.candidates[0].factualHeadline).toContain("(updated)");
	});
});

// ============================================================================
// Persistence, readback and recovery
// ============================================================================

describe("Canonical Fact Dossier — Persistence, Readback & Recovery", () => {
	beforeEach(async () => {
		await fs.rm(TEST_DIR, { recursive: true, force: true });
	});

	afterEach(async () => {
		await fs.rm(TEST_DIR, { recursive: true, force: true });
	});

	it("persists and reads back with byte-level verification", async () => {
		const store = new FactDossierStore(TEST_DIR);
		const dossier = buildEditionDossier();
		const result = await store.save(dossier);
		expect(result.saved).toBe(true);

		const loaded = await store.load(EDITION_DATE);
		expect(loaded).not.toBeNull();
		expect(canonicalJson(loaded)).toBe(canonicalJson(dossier));

		const { validation } = await store.loadAndValidate(EDITION_DATE);
		expect(validation.errors).toEqual([]);
		expect(validation.valid).toBe(true);
	});

	it("lists persisted editions", async () => {
		const store = new FactDossierStore(TEST_DIR);
		await store.save(buildEditionDossier());
		const editions = await store.listEditions();
		expect(editions).toContain(EDITION_DATE);
	});

	it("isolates per-candidate failures and records them in the processing audit", async () => {
		const failingInput = {
			candidate: createMockCandidate({
				id: "cand_0000000000000200",
				sourceIds: ["unknown-source-not-in-registry"],
				ringClassificationDistribution: { 1: 0, 2: 0, 3: 1 },
			}),
			discovery: createMockDiscovery({
				sourceId: "test-source",
				publishedAt: "2025-01-14T12:00:00+01:00[Europe/Amsterdam]",
				url: "https://example.com/article",
			}),
			claims: [
				createMockClaim({
					id: "claim_0000000000000200",
					candidateId: "cand_0000000000000200",
					evidenceClassification: "UNVERIFIED",
					verificationStatus: "unverified",
					verificationLevel: "L0",
				}),
			],
		};

		const goodFixture = fixtureByKey("scientific-paper");
		const dossier = buildDossier(
			EDITION_DATE,
			[goodFixture.input, failingInput],
			createContext(),
		);

		expect(dossier.status).toBe("partial");
		expect(dossier.processingAudit.failedCandidateIds).toContain(
			"cand_0000000000000200",
		);
		expect(dossier.processingAudit.completedCandidateIds).toContain(
			goodFixture.input.candidate.id,
		);
		expect(dossier.candidates.map((c) => c.candidateId)).toContain(
			goodFixture.input.candidate.id,
		);
		expect(dossier.candidates.map((c) => c.candidateId)).not.toContain(
			"cand_0000000000000200",
		);

		const validation = validateFactDossier(dossier);
		expect(validation.valid).toBe(true);
	});

	it("marks the dossier failed when no candidate can be consolidated", () => {
		const failingInput = {
			candidate: createMockCandidate({
				id: "cand_0000000000000201",
				sourceIds: ["unknown-source-not-in-registry"],
				ringClassificationDistribution: { 1: 0, 2: 0, 3: 1 },
			}),
			discovery: createMockDiscovery({ sourceId: "test-source" }),
			claims: [],
		};
		const dossier = buildDossier(
			EDITION_DATE,
			[failingInput],
			createContext(),
		);
		expect(dossier.status).toBe("failed");
		expect(dossier.candidates).toHaveLength(0);
	});
});

// ============================================================================
// Prevention of unsupported factual promotion
// ============================================================================

describe("Canonical Fact Dossier — Prevention of Unsupported Factual Promotion", () => {
	it("rejects a VENDOR_CLAIM marked verified", () => {
		const dossier = buildEditionDossier();
		const candidate = dossier.candidates[0];
		const claim = candidate.claims[0];
		const tampered = {
			...dossier,
			candidates: [
				{
					...candidate,
					claims: [
						{
							...claim,
							evidenceClassification: "VENDOR_CLAIM",
							verificationStatus: "verified",
							verificationLevel: "L2",
						},
					],
				},
				...dossier.candidates.slice(1),
			],
		};
		const result = validateFactDossier(tampered);
		expect(result.valid).toBe(false);
		expect(
			result.errors.some((e) =>
				e.includes("must not claim verification level L2"),
			),
		).toBe(true);
		expect(
			result.errors.some((e) =>
				e.includes("must not be marked 'verified'"),
			),
		).toBe(true);
	});

	it("rejects an inclusion note that promotes an unverified classification", () => {
		const dossier = buildEditionDossier();
		const candidate = dossier.candidates[0];
		const claim = candidate.claims[0];
		const tampered = {
			...dossier,
			candidates: [
				{
					...candidate,
					claims: [
						{
							...claim,
							evidenceClassification: "SPECULATION",
							verificationStatus: "unverified",
							verificationLevel: "L0",
							inclusionNote: "Included as a verified fact.",
						},
					],
				},
				...dossier.candidates.slice(1),
			],
		};
		const result = validateFactDossier(tampered);
		expect(result.valid).toBe(false);
		expect(
			result.errors.some((e) =>
				e.includes("promotes an unverified classification"),
			),
		).toBe(true);
	});

	it("rejects a verified status without an allowed classification", () => {
		const dossier = buildEditionDossier();
		const candidate = dossier.candidates[0];
		const claim = candidate.claims[0];
		const tampered = {
			...dossier,
			candidates: [
				{
					...candidate,
					claims: [
						{
							...claim,
							evidenceClassification: "EXPERT_INTERPRETATION",
							verificationStatus: "verified",
							verificationLevel: "L1",
						},
					],
				},
				...dossier.candidates.slice(1),
			],
		};
		const result = validateFactDossier(tampered);
		expect(result.valid).toBe(false);
		expect(
			result.errors.some((e) =>
				e.includes("verification status 'verified' requires"),
			),
		).toBe(true);
	});

	it("rejects a temporal eligibility status inconsistent with the inherited classification", () => {
		const dossier = buildEditionDossier();
		const candidate = dossier.candidates[0];
		const tampered = {
			...dossier,
			candidates: [
				{
					...candidate,
					temporalEligibility: {
						...candidate.temporalEligibility,
						status: "CATCH_UP",
					},
				},
				...dossier.candidates.slice(1),
			],
		};
		const result = validateFactDossier(tampered);
		expect(result.valid).toBe(false);
		expect(
			result.errors.some((e) =>
				e.includes("does not match inherited novelty classification"),
			),
		).toBe(true);
	});

	it("rejects a content hash that does not match the content", () => {
		const dossier = buildEditionDossier();
		const tampered = {
			...dossier,
			contentHash:
				"sha256:0000000000000000000000000000000000000000000000000000000000000000",
		};
		const result = validateFactDossier(tampered);
		expect(result.valid).toBe(false);
		expect(
			result.errors.some((e) => e.includes("contentHash does not match")),
		).toBe(true);
	});
});

// ============================================================================
// Editorial readiness without premature selection
// ============================================================================

describe("Canonical Fact Dossier — Editorial Readiness Without Premature Selection", () => {
	it("produces descriptive indicators with traceable references", () => {
		const dossier = buildEditionDossier();
		const candidate = dossier.candidates[0];
		const indicators = candidate.editorialReadiness;

		const keys = [
			"materialNovelty",
			"technicalScientificSignificance",
			"realWorldConsequences",
			"enterpriseEconomicImplications",
			"generalizability",
			"evidenceStrength",
			"evidenceLimitations",
			"practicalEngineeringRelevance",
			"availabilityMaturity",
			"potentialOverlap",
		] as const;
		for (const key of keys) {
			const indicator = indicators[key];
			expect(indicator.level).toMatch(/^(high|medium|low|unclear)$/);
			expect(indicator.evidence.length).toBeGreaterThan(0);
			expect(indicator.traceableTo.length).toBeGreaterThan(0);
		}
		expect(indicators.selectionNote).toMatch(/no editorial ranking/i);
	});

	it("does not rank candidates or introduce quotas/weights", () => {
		const dossier = buildEditionDossier();
		expect(dossier.processingAudit.inferenceUsed).toBe(false);
		for (const candidate of dossier.candidates) {
			expect(candidate.editorialReadiness.selectionNote).toBe(
				"Descriptive indicators only — no editorial ranking, quotas, topic weights or publication decisions are made at this stage.",
			);
		}
		// No ranking field exists anywhere in the dossier.
		expect(JSON.stringify(dossier)).not.toMatch(
			/"rank"|"score"|"quota"|"weight"/i,
		);
	});

	it("flags potential overlap with other candidates sharing a source", () => {
		const fixtures = createRepresentativeFixtures();
		const copilot = fixtures.find((f) => f.key === "coding-agent-release")!;
		const productivity = fixtures.find(
			(f) => f.key === "vendor-productivity-claim",
		)!;
		const dossier = buildEditionDossier(createContext(), [
			copilot,
			productivity,
		]);
		const byId = new Map(dossier.candidates.map((c) => [c.candidateId, c]));
		const overlap = byId.get(copilot.input.candidate.id)?.editorialReadiness
			.potentialOverlap;
		expect(overlap?.level).toBe("high");
		expect(
			overlap?.evidence.some((e) => e.includes("Shares a source")),
		).toBe(true);
	});
});

// ============================================================================
// Optional enrichment
// ============================================================================

describe("Canonical Fact Dossier — Optional Enrichment", () => {
	it("degrades gracefully without a provider", async () => {
		const dossier = buildEditionDossier();
		const enriched = await enrichDossier(dossier, undefined);
		expect(enriched.candidates[0].enrichment?.status).toBe("disabled");
		expect(enriched.candidates[0].enrichment?.exactStatementSource).toBe(
			"deterministic",
		);
		expect(enriched.candidates[0].exactStatement).toBe(
			dossier.candidates[0].exactStatement,
		);
		expect(validateFactDossier(enriched).valid).toBe(true);
	});

	it("marks model-assisted statements explicitly without implying verification", async () => {
		const provider: EnrichmentProvider = {
			async enrich() {
				return {
					exactStatement: "Model-assisted synthetic statement.",
					provider: "synthetic-provider",
					model: "synthetic-model",
				};
			},
		};
		const dossier = buildEditionDossier();
		const enriched = await enrichDossier(
			dossier,
			provider,
			"2025-01-15T06:35:00Z",
		);
		const candidate = enriched.candidates[0];
		expect(candidate.exactStatement).toBe(
			"Model-assisted synthetic statement.",
		);
		expect(candidate.enrichment?.status).toBe("enriched");
		expect(candidate.enrichment?.exactStatementSource).toBe(
			"model-assisted",
		);
		expect(candidate.enrichment?.note).toMatch(
			/not independently verified/i,
		);
		expect(enriched.processingAudit.inferenceUsed).toBe(true);
		expect(validateFactDossier(enriched).valid).toBe(true);
	});

	it("preserves deterministic statements when the provider fails", async () => {
		const provider: EnrichmentProvider = {
			async enrich() {
				throw new Error("synthetic provider failure");
			},
		};
		const dossier = buildEditionDossier();
		const enriched = await enrichDossier(
			dossier,
			provider,
			"2025-01-15T06:35:00Z",
		);
		expect(enriched.candidates[0].enrichment?.status).toBe("unavailable");
		expect(enriched.candidates[0].exactStatement).toBe(
			dossier.candidates[0].exactStatement,
		);
		expect(validateFactDossier(enriched).valid).toBe(true);
	});

	it("does not manufacture analysis when the provider returns insufficient evidence", async () => {
		const provider: EnrichmentProvider = {
			async enrich() {
				return {
					exactStatement: "INSUFFICIENT_EVIDENCE",
					provider: "synthetic",
					model: "synthetic",
				};
			},
		};
		const dossier = buildEditionDossier();
		const enriched = await enrichDossier(
			dossier,
			provider,
			"2025-01-15T06:35:00Z",
		);
		expect(enriched.candidates[0].enrichment?.status).toBe("failed");
		expect(enriched.candidates[0].exactStatement).toBe(
			dossier.candidates[0].exactStatement,
		);
	});
});

// ============================================================================
// Representative fixtures coverage
// ============================================================================

describe("Canonical Fact Dossier — Representative Fixture Coverage", () => {
	const fixtures = createRepresentativeFixtures();

	it("covers all required representative cases", () => {
		const keys = fixtures.map((f) => f.key);
		expect(keys).toContain("coding-agent-release");
		expect(keys).toContain("scientific-paper");
		expect(keys).toContain("advisory-finding");
		expect(keys).toContain("vendor-productivity-claim");
		expect(keys).toContain("original-reporting-older-event");
		expect(keys).toContain("substantive-update");
		expect(keys).toContain("contradictory-evidence");
	});

	it("consolidates every fixture with the expected temporal and evidence outcomes", () => {
		for (const fixture of fixtures) {
			const dossier = buildEditionDossier(createContext(), [fixture]);
			expect(dossier.candidates).toHaveLength(1);
			const candidate = dossier.candidates[0];
			expect(candidate.temporalEligibility.status).toBe(
				fixture.expected.temporalStatus,
			);
			if (fixture.expected.classification) {
				expect(candidate.claims[0].evidenceClassification).toBe(
					fixture.expected.classification,
				);
			}
			if (fixture.expected.verificationStatus) {
				expect(candidate.claims[0].verificationStatus).toBe(
					fixture.expected.verificationStatus,
				);
			}
			if (fixture.expected.verificationLevel) {
				expect(candidate.claims[0].verificationLevel).toBe(
					fixture.expected.verificationLevel,
				);
			}
			const result = validateFactDossier(dossier);
			expect(result.errors).toEqual([]);
		}
	});

	it("does not generate publication content or editorial decisions", () => {
		const dossier = buildEditionDossier();
		const serialized = JSON.stringify(dossier);
		expect(serialized).not.toMatch(/"article"/i);
		expect(serialized).not.toMatch(/"publish"/i);
		expect(dossier.status).not.toBe("published");
		expect(
			dossier.candidates.every(
				(c) => c.processingStatus === "consolidated",
			),
		).toBe(true);
	});
});

// ============================================================================
// BuildCanonicalCandidate / buildCandidateCore direct checks
// ============================================================================

describe("Canonical Fact Dossier — Builder API", () => {
	it("buildCandidateCore returns a candidate without editorial readiness", () => {
		const fixture = fixtureByKey("scientific-paper");
		const core = buildCandidateCore(fixture.input, createContext());
		expect(core.candidateId).toBe(fixture.input.candidate.id);
		expect(
			(core as { editorialReadiness?: unknown }).editorialReadiness,
		).toBeUndefined();
	});

	it("buildCanonicalCandidate attaches editorial readiness", () => {
		const fixture = fixtureByKey("scientific-paper");
		const candidate = buildCanonicalCandidate(
			fixture.input,
			createContext(),
		);
		expect(candidate.editorialReadiness.materialNovelty.level).toMatch(
			/^(high|medium|low|unclear)$/,
		);
	});

	it("consolidateClaims preserves claim order by stable identifier", () => {
		const candidateId = "cand_0000000000000300";
		const claims = [
			createMockClaim({ id: "claim_0000000000000302", candidateId }),
			createMockClaim({ id: "claim_0000000000000301", candidateId }),
		];
		const consolidated = consolidateClaims(candidateId, claims);
		expect(consolidated.map((c) => c.claimId)).toEqual([
			"claim_0000000000000301",
			"claim_0000000000000302",
		]);
	});
});
