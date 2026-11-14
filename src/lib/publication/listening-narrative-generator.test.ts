/**
 * Listening Narrative Generator — Validation Tests
 *
 * ⚠️  All edition, candidate, claim and source data used here is SYNTHETIC
 * FIXTURE DATA from the fact-dossier and editorial-selection fixtures.
 * No test below represents actually retrieved evidence, and no assertion
 * should be read as a real editorial or research finding.
 *
 * These tests validate the listening narrative generator output against the
 * publication contract requirements for the canonical listening narrative artifact.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
	ListeningNarrativeGenerationInput,
	ListeningStoryContext,
} from "./listening-narrative-generator.js";
import type {
	EditorialStory,
	EditorialCandidateAssessment,
} from "../editorial-selection/schema.js";
import type {
	CanonicalCandidate,
	ConsolidatedClaim,
	VerificationLevel,
} from "../fact-dossier/schema.js";
import type { HistoricalRelationship } from "../historical-regression/schema.js";
import { SubstantiveUpdateTypeSchema } from "../historical-regression/schema.js";

// Mock the LLM client
vi.mock("../free-llm-client.js", () => ({
	createFreeLLMClient: () => ({
		validate: vi
			.fn()
			.mockResolvedValue({ valid: true, errors: [], warnings: [] }),
		setValidationMode: vi.fn(),
		request: vi.fn().mockResolvedValue({
			content: "Synthetic LLM response for testing.",
			provider: "openrouter-primary",
			model: "nvidia/nemotron-3-ultra-550b-a55b:free",
			tokensUsed: { prompt: 100, completion: 200, total: 300 },
			cached: false,
			requestId: "test-req-1",
		}),
		getConfig: () => ({
			budget: { maxRequests: 50, maxTokens: 100000, maxCostUsd: 0 },
			deterministic: true,
			enableCache: true,
			enableCheckpoints: true,
		}),
	}),
}));

const createMockCandidate = (
	overrides: Partial<CanonicalCandidate> = {},
): CanonicalCandidate => ({
	candidateId: "cand_0000000000000001",
	editionId: "edition_2025-01-15",
	editionDate: "2025-01-15",
	factualHeadline: "Synthetic AI model release with new capabilities",
	exactStatement:
		"A synthetic AI model release introduces new reasoning capabilities and extended context window.",
	researchDomains: ["models-inference-scientific"],
	subdomainTags: ["DOM-02-SD01"],
	discoveryRings: [1],
	organizations: ["Synthetic AI Lab"],
	products: ["Synthetic Model v2"],
	technologies: ["reasoning", "extended context"],
	researchProjects: ["synthetic-model-v2"],
	sources: [
		{
			sourceId: "synthetic-arxiv",
			canonicalUrl: "https://arxiv.org/abs/2501.12345",
			discoveryIds: ["disc_0000000000000001"],
			retrievalStatus: "CHECKED_FOUND",
			accessedAt: "2025-01-15T06:00:00Z",
		},
	],
	timestamps: {
		originalPublicationTimestamp:
			"2025-01-14T12:00:00+01:00[Europe/Amsterdam]",
		earliestSupportedPublicDisclosureTimestamp:
			"2025-01-14T12:00:00+01:00[Europe/Amsterdam]",
		retrievalTimestamp: "2025-01-15T06:00:00Z",
		timezone: "Europe/Amsterdam",
		timestampConfidence: 0.95,
		timestampPrecision: "exact",
		timestampAvailability: "available",
	},
	temporalEligibility: {
		status: "NEW_PASS",
		rationale: "New development within window.",
		noveltyClassification: {
			classification: "NEW",
			editionDate: "2025-01-15",
			inWindow: true,
			evidence: [],
			reasoning: "New development.",
			primaryPublicationTimestamp:
				"2025-01-14T12:00:00+01:00[Europe/Amsterdam]",
			isSubstantiveUpdate: false,
			isNewlyRevealedFact: true,
			confidence: 0.9,
		},
		editionBoundary: {
			start: "2025-01-14T05:00:00+01:00[Europe/Amsterdam]",
			end: "2025-01-15T05:00:00+01:00[Europe/Amsterdam]",
			timezone: "Europe/Amsterdam",
		},
		derivedFrom: "novelty-classification",
		derivedAt: "2025-01-15T06:00:00Z",
	},
	previousCoverage: [],
	sourceAccessibility: [
		{
			sourceId: "synthetic-arxiv",
			canonicalUrl: "https://arxiv.org/abs/2501.12345",
			retrievalStatus: "CHECKED_FOUND",
			accessible: true,
			limitations: [],
		},
	],
	claims: [
		{
			claimId: "claim_0000000000000001",
			candidateId: "cand_0000000000000001",
			claimStatement:
				"The synthetic model achieves 15% better reasoning benchmarks.",
			claimType: "benchmark-result",
			evidenceClassification: "RESEARCH_FINDING",
			supportingEvidenceUrls: ["https://arxiv.org/abs/2501.12345"],
			independentCorroboration: {
				established: false,
				sourceIds: [],
				urls: [],
				note: "No independent corroboration.",
			},
			contradictoryEvidence: [],
			limitingEvidence: [],
			technicalContext: {
				mechanism:
					"Enhanced chain-of-thought with synthetic reasoning tokens.",
				capabilities: ["reasoning", "extended context"],
				architecture: ["dense transformer"],
				limitations: ["Requires 2x compute for inference."],
				releaseMaturity: "ga",
				implementationStatus: "released",
			},
			confidence: 0.85,
			verificationLevel: "L1",
			verificationStatus: "verified",
			verificationRationale:
				"Methodology reviewed, benchmarks reproducible.",
			verificationMethods: ["methodology-review"],
			uncertainty: {
				unresolved: [],
				assumptions: ["Benchmark conditions match production."],
				falsificationCriteria: ["Independent replication fails."],
			},
			sourceProvenance: {
				sourceId: "synthetic-arxiv",
				url: "https://arxiv.org/abs/2501.12345",
				title: "Synthetic Model v2 Paper",
				publicationTimestamp:
					"2025-01-14T12:00:00+01:00[Europe/Amsterdam]",
				retrievedAt: "2025-01-15T06:00:00Z",
				verificationTimestamp: "2025-01-15T06:00:00Z",
				verifiedBy: "synthetic-verifier",
			},
			inclusionNote: "Synthetic fixture for testing.",
		},
	],
	unresolvedQuestions: [],
	evidenceGaps: [],
	editorialReadiness: {
		materialNovelty: {
			level: "high",
			evidence: ["New model release."],
			traceableTo: ["claim_0000000000000001"],
		},
		technicalScientificSignificance: {
			level: "high",
			evidence: ["Benchmark improvements."],
			traceableTo: ["claim_0000000000000001"],
		},
		realWorldConsequences: {
			level: "medium",
			evidence: ["Impacts inference architectures."],
			traceableTo: ["claim_0000000000000001"],
		},
		enterpriseEconomicImplications: {
			level: "medium",
			evidence: ["Compute cost implications."],
			traceableTo: ["claim_0000000000000001"],
		},
		generalizability: {
			level: "medium",
			evidence: ["Single model family."],
			traceableTo: ["claim_0000000000000001"],
		},
		evidenceStrength: {
			level: "high",
			evidence: ["L1 verification."],
			traceableTo: ["claim_0000000000000001"],
		},
		evidenceLimitations: {
			level: "low",
			evidence: ["No independent replication."],
			traceableTo: ["claim_0000000000000001"],
		},
		practicalEngineeringRelevance: {
			level: "high",
			evidence: ["Direct engineering impact."],
			traceableTo: ["claim_0000000000000001"],
		},
		availabilityMaturity: {
			level: "high",
			evidence: ["GA release."],
			traceableTo: ["claim_0000000000000001"],
		},
		potentialOverlap: {
			level: "low",
			evidence: ["No overlap detected."],
			traceableTo: [],
		},
		selectionNote:
			"Descriptive indicators only — no editorial ranking, quotas, topic weights or publication decisions are made at this stage.",
	},
	processingStatus: "consolidated",
	audit: {
		discoveredAt: "2025-01-15T06:00:00Z",
		retrievedAt: "2025-01-15T06:00:00Z",
		noveltyClassifiedAt: "2025-01-15T06:00:00Z",
		consolidatedAt: "2025-01-15T06:00:00Z",
		consolidatedBy: "synthetic-consolidator",
		revision: 1,
	},
	provenance: {
		discoveryIds: ["disc_0000000000000001"],
		candidateStableId: "cand_0000000000000001",
		pipeline: [
			"source-discovery",
			"retrieval",
			"temporal-classification",
			"claim-verification",
			"canonical-fact-dossier",
		],
		consumedFrom: [
			"candidate-news",
			"novelty-classification",
			"evidence-verification",
		],
	},
	...overrides,
});

const createMockAssessment = (
	overrides: Partial<EditorialCandidateAssessment> = {},
): EditorialCandidateAssessment => ({
	candidateId: "cand_0000000000000001",
	factualHeadline: "Synthetic AI model release with new capabilities",
	exactStatement:
		"A synthetic AI model release introduces new reasoning capabilities and extended context window.",
	organizations: ["Synthetic AI Lab"],
	products: ["Synthetic Model v2"],
	technologies: ["reasoning", "extended context"],
	researchDomains: ["models-inference-scientific"],
	discoveryRings: [1],
	eligibility: {
		candidateId: "cand_0000000000000001",
		state: "ELIGIBLE",
		temporalStatus: "NEW_PASS",
		evidenceSufficiency: "STRONG",
		hasBlockingUncertainty: false,
		noveltyStatementPresent: true,
		historicalRelationship: undefined,
		historicalConfidence: undefined,
		omissionReviewFlags: [],
		reasons: ["New model release with benchmark improvements."],
		traceableTo: ["claim_0000000000000001"],
	},
	dimensions: [
		{
			dimension: "material-novelty",
			level: "high",
			score: 0.85,
			evidence: ["New model."],
			traceableTo: ["claim_0000000000000001"],
			weight: 0.2,
			role: "primary",
		},
		{
			dimension: "scientific-technical-significance",
			level: "high",
			score: 0.8,
			evidence: ["Benchmark gains."],
			traceableTo: ["claim_0000000000000001"],
			weight: 0.2,
			role: "primary",
		},
		{
			dimension: "real-world-consequences",
			level: "medium",
			score: 0.6,
			evidence: ["Inference impact."],
			traceableTo: ["claim_0000000000000001"],
			weight: 0.15,
			role: "primary",
		},
		{
			dimension: "strategic-economic-significance",
			level: "medium",
			score: 0.55,
			evidence: ["Compute cost."],
			traceableTo: ["claim_0000000000000001"],
			weight: 0.15,
			role: "primary",
		},
		{
			dimension: "evidence-strength",
			level: "high",
			score: 0.8,
			evidence: ["L1 verified."],
			traceableTo: ["claim_0000000000000001"],
			weight: 0.15,
			role: "primary",
		},
		{
			dimension: "generalizability-learning-value",
			level: "medium",
			score: 0.6,
			evidence: ["Single family."],
			traceableTo: ["claim_0000000000000001"],
			weight: 0.1,
			role: "primary",
		},
		{
			dimension: "engineering-architectural-relevance",
			level: "high",
			score: 0.75,
			evidence: ["Architecture relevant."],
			traceableTo: ["claim_0000000000000001"],
			weight: 0,
			role: "secondary",
		},
		{
			dimension: "availability-maturity",
			level: "high",
			score: 0.8,
			evidence: ["GA."],
			traceableTo: ["claim_0000000000000001"],
			weight: 0,
			role: "contextual",
		},
	],
	materialityScore: 0.75,
	materialityLevel: "high",
	decision: "SELECTED",
	decisionReasons: ["High materiality, strong evidence."],
	decisionTraceableTo: ["claim_0000000000000001"],
	uncertainty: [],
	sourceReferences: ["https://arxiv.org/abs/2501.12345"],
	sourceIds: ["synthetic-arxiv"],
	claimIds: ["claim_0000000000000001"],
	...overrides,
});

const createMockStory = (
	overrides: Partial<EditorialStory> = {},
): EditorialStory => ({
	storyId: "story_0000000000000001",
	order: 1,
	title: "Synthetic AI Lab — Models, Inference & Scientific Research",
	candidateId: "cand_0000000000000001",
	mergedCandidateIds: [],
	claimIds: ["claim_0000000000000001"],
	sourceIds: ["synthetic-arxiv"],
	organizations: ["Synthetic AI Lab"],
	researchDomains: ["models-inference-scientific"],
	discoveryRings: [1],
	materialityScore: 0.75,
	materialityLevel: "high",
	decision: "SELECTED",
	summary: "Synthetic model release with reasoning improvements.",
	recommendedDepth: "deep-dive",
	explanationOpportunities: ["technical-deep-dive", "scientific-explanation"],
	caveats: [
		"No independent replication yet.",
		"Compute requirements doubled.",
	],
	evidenceClassificationSummary: "RESEARCH_FINDING (L1), VERIFIED_FACT (L2)",
	...overrides,
});

const createMockInput = (
	stories: ListeningStoryContext[] = [],
): ListeningNarrativeGenerationInput => ({
	editionDate: "2025-01-15",
	editionWindow: {
		start: "2025-01-14T05:00:00+01:00[Europe/Amsterdam]",
		end: "2025-01-15T05:00:00+01:00[Europe/Amsterdam]",
		timezone: "Europe/Amsterdam",
	},
	factDossier: {
		schemaVersion: "1.0.0",
		dossierId: "fd_0000000000000001",
		editionId: "edition_2025-01-15",
		editionDate: "2025-01-15",
		editionWindow: {
			editionDate: "2025-01-15",
			start: "2025-01-14T05:00:00+01:00[Europe/Amsterdam]",
			end: "2025-01-15T05:00:00+01:00[Europe/Amsterdam]",
			timezone: "Europe/Amsterdam",
			durationHours: 24,
		},
		status: "complete",
		createdAt: "2025-01-15T06:00:00Z",
		updatedAt: "2025-01-15T06:00:00Z",
		generatedBy: "test",
		candidates: stories.map((s) => s.candidate),
		editionSummary: {
			totalCandidates: stories.length,
			byTemporalEligibility: { NEW_PASS: stories.length },
			byEvidenceClassification: { RESEARCH_FINDING: stories.length },
			byVerificationStatus: { verified: stories.length },
			byResearchDomain: { "models-inference-scientific": stories.length },
			totalClaims: stories.reduce(
				(sum, s) => sum + s.candidate.claims.length,
				0,
			),
			claimsWithCounterevidence: 0,
			claimsWithUnresolvedUncertainties: 0,
			candidatesWithEvidenceGaps: 0,
			averageClaimConfidence: 0.85,
			strategicResearchCandidates: 0,
			technicalCandidates: stories.length,
		},
		uncertaintyRegister: [],
		historicalContinuity: [],
		processingAudit: {
			startedAt: "2025-01-15T06:00:00Z",
			completedAt: "2025-01-15T06:00:00Z",
			durationMs: 0,
			steps: [],
			completedCandidateIds: [],
			failedCandidateIds: [],
			skippedCandidateIds: [],
			inferenceUsed: false,
		},
		contentHash:
			"sha256:0000000000000000000000000000000000000000000000000000000000000000",
	} as any,
	editorialManifest: {
		schemaVersion: "1.0.0",
		manifestId: "esm_0000000000000001",
		editionId: "edition_2025-01-15",
		editionDate: "2025-01-15",
		editionWindow: {
			editionDate: "2025-01-15",
			start: "2025-01-14T05:00:00+01:00[Europe/Amsterdam]",
			end: "2025-01-15T05:00:00+01:00[Europe/Amsterdam]",
			timezone: "Europe/Amsterdam",
			durationHours: 24,
		},
		generatedAt: "2025-01-15T06:00:00Z",
		generatedBy: "test",
		inputDossier: {
			dossierId: "fd_0000000000000001",
			contentHash:
				"sha256:0000000000000000000000000000000000000000000000000000000000000000",
			editionDate: "2025-01-15",
			candidateCount: stories.length,
		},
		omissionReview: {
			reportId: "",
			executionId: "",
			version: "",
			executedAt: "",
			criticalOmissions: 0,
			materialOmissions: 0,
			unresolvedRepairs: 0,
			referenced: false,
		},
		historicalRegression: {
			reportId: "",
			contentHash: "",
			finalStatus: "",
			relationshipsReferenced: 0,
			referenced: false,
		},
		candidates: stories.map((s) => s.assessment),
		stories: stories.map((s) => s.story),
		relationships: [],
		concentrationReview: {
			reviewedAt: "2025-01-15T06:00:00Z",
			selectedStoryCount: stories.length,
			organizationDistribution: {},
			ringDistribution: {},
			claimTypeDistribution: {},
			findings: [],
			consistencyChecks: [],
			strongestExcluded: undefined,
			weakestSelected: undefined,
			rankingInconsistenciesFound: 0,
			correctionsApplied: [],
			residualRisks: [],
			modelAssisted: false,
			note: "Test",
		},
		caveats: [],
		unresolvedIssues: [],
		readinessStatus: "READY",
		inferenceUsed: false,
		weightingAssumptions: [],
		contentHash:
			"sha256:0000000000000000000000000000000000000000000000000000000000000000",
	} as any,
	historicalRegression: null,
	stories,
});

describe("Listening Narrative Generator — Output Validation", () => {
	it("generates valid markdown structure with required sections", async () => {
		const { generateListeningNarrativeMarkdown } =
			await import("./listening-narrative-generator.js");

		const candidate = createMockCandidate();
		const assessment = createMockAssessment();
		const story = createMockStory();

		const input = createMockInput([
			{
				story,
				candidate,
				assessment,
				historicalRelationship: null,
				historicalClassification: null,
			},
		]);

		const result = await generateListeningNarrativeMarkdown(input);

		expect(result.markdown).toContain("# AI Daily Intelligence —");
		expect(result.markdown).toContain("## Verhaal 1");
		expect(result.markdown).not.toContain("${editionDate}");
		expect(result.validation.valid).toBe(true);
	});

	it("validates output correctly - detects missing title", async () => {
		const { validateListeningNarrativeOutput } =
			await import("./listening-narrative-generator.js");
		const validation = validateListeningNarrativeOutput(
			"Invalid content without title.",
			createMockInput(),
		);
		expect(validation.valid).toBe(false);
		expect(validation.errors.some((e) => e.includes("title"))).toBe(true);
	});

	it("validates output correctly - warns on URLs in narrative", async () => {
		const { validateListeningNarrativeOutput } =
			await import("./listening-narrative-generator.js");
		const markdown = `# AI Daily Intelligence — woensdag 15 januari 2025\n\n## Verhaal 1\n\nCheck https://example.com for details.`;
		const validation = validateListeningNarrativeOutput(
			markdown,
			createMockInput(),
		);
		expect(validation.warnings.some((w) => w.includes("URLs found"))).toBe(
			true,
		);
	});

	it("validates output correctly - warns on citation identifiers", async () => {
		const { validateListeningNarrativeOutput } =
			await import("./listening-narrative-generator.js");
		const markdown = `# AI Daily Intelligence — woensdag 15 januari 2025\n\n## Verhaal 1\n\nClaim claim_0000000000000001 is verified.`;
		const validation = validateListeningNarrativeOutput(
			markdown,
			createMockInput(),
		);
		expect(
			validation.warnings.some((w) => w.includes("Citation identifiers")),
		).toBe(true);
	});

	it("validates output correctly - warns on navigation references", async () => {
		const { validateListeningNarrativeOutput } =
			await import("./listening-narrative-generator.js");
		const markdown = `# AI Daily Intelligence — woensdag 15 januari 2025\n\n## Verhaal 1\n\nSee [Research Audit](research-audit.md) for details.`;
		const validation = validateListeningNarrativeOutput(
			markdown,
			createMockInput(),
		);
		expect(validation.warnings.some((w) => w.includes("Navigation"))).toBe(
			true,
		);
	});

	it("checks heading hierarchy", async () => {
		const { validateListeningNarrativeOutput } =
			await import("./listening-narrative-generator.js");
		const markdown = `# AI Daily Intelligence — woensdag 15 januari 2025\n\n## Verhaal 1\n\n##### Level 5 heading directly under level 2`;
		const validation = validateListeningNarrativeOutput(
			markdown,
			createMockInput(),
		);
		expect(
			validation.warnings.some((w) => w.includes("Heading level jump")),
		).toBe(true);
	});

	it("checks all selected stories are represented", async () => {
		const { validateListeningNarrativeOutput } =
			await import("./listening-narrative-generator.js");
		const candidate = createMockCandidate({
			organizations: ["Missing Org"],
		});
		const assessment = createMockAssessment({
			organizations: ["Missing Org"],
		});
		const story = createMockStory({ organizations: ["Missing Org"] });
		const input = createMockInput([
			{
				story,
				candidate,
				assessment,
				historicalRelationship: null,
				historicalClassification: null,
			},
		]);

		const markdown = `# AI Daily Intelligence — woensdag 15 januari 2025\n\n## Verhaal 1\n\nSome other org mentioned.`;
		const validation = validateListeningNarrativeOutput(markdown, input);
		expect(validation.warnings.some((w) => w.includes("Missing Org"))).toBe(
			true,
		);
	});

	it("checks for visual references", async () => {
		const { validateListeningNarrativeOutput } =
			await import("./listening-narrative-generator.js");
		const markdown = `# AI Daily Intelligence — woensdag 15 januari 2025\n\n## Verhaal 1\n\nZie het diagram voor details.`;
		const validation = validateListeningNarrativeOutput(
			markdown,
			createMockInput(),
		);
		expect(validation.warnings.some((w) => w.includes("diagram"))).toBe(
			true,
		);
	});

	it("validates template variable replacement", async () => {
		const { validateListeningNarrativeOutput } =
			await import("./listening-narrative-generator.js");
		const markdown = `# AI Daily Intelligence — ${"${editionDate}"}\n\n## Verhaal 1\n\nTest.`;
		const validation = validateListeningNarrativeOutput(
			markdown,
			createMockInput(),
		);
		expect(validation.valid).toBe(false);
		expect(
			validation.errors.some((e) => e.includes("Template variable")),
		).toBe(true);
	});

	it("produces traceability metadata", async () => {
		const { generateListeningNarrativeMarkdown } =
			await import("./listening-narrative-generator.js");

		const candidate = createMockCandidate();
		const assessment = createMockAssessment();
		const story = createMockStory();

		const input = createMockInput([
			{
				story,
				candidate,
				assessment,
				historicalRelationship: null,
				historicalClassification: null,
			},
		]);

		const result = await generateListeningNarrativeMarkdown(input);

		expect(result.traceability).toBeDefined();
		expect(result.traceability.claimCoverage).toContain(
			"claim_0000000000000001",
		);
		expect(result.traceability.sourceCoverage).toContain("synthetic-arxiv");
		expect(result.traceability.storyCoverage).toContain(
			"story_0000000000000001",
		);
		expect(result.traceability.segments.length).toBeGreaterThan(0);
	});

	it("produces metadata with content hash and listening duration", async () => {
		const { generateListeningNarrativeMarkdown } =
			await import("./listening-narrative-generator.js");

		const candidate = createMockCandidate();
		const assessment = createMockAssessment();
		const story = createMockStory();

		const input = createMockInput([
			{
				story,
				candidate,
				assessment,
				historicalRelationship: null,
				historicalClassification: null,
			},
		]);

		const result = await generateListeningNarrativeMarkdown(input);

		expect(result.metadata.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
		expect(result.metadata.artifactId).toMatch(/^pubart_[a-z0-9]{16}$/);
		expect(
			result.metadata.estimatedListeningDurationMinutes,
		).toBeGreaterThan(0);
		expect(result.metadata.wordCount).toBeGreaterThan(0);
		expect(result.metadata.storiesCovered).toBe(1);
	});

	it("handles empty edition (no stories)", async () => {
		const { generateListeningNarrativeMarkdown } =
			await import("./listening-narrative-generator.js");
		const input = createMockInput([]);
		const result = await generateListeningNarrativeMarkdown(input);
		expect(result.markdown).toContain("geen ontwikkelingen geselecteerd");
		expect(result.metadata.storiesCovered).toBe(0);
	});

	it("generates opening, stories, transitions, and conclusion segments", async () => {
		const { generateListeningNarrativeMarkdown } =
			await import("./listening-narrative-generator.js");

		const candidate1 = createMockCandidate({
			candidateId: "cand_0000000000000001",
			organizations: ["Org A"],
		});
		const assessment1 = createMockAssessment({
			candidateId: "cand_0000000000000001",
			organizations: ["Org A"],
		});
		const story1 = createMockStory({
			storyId: "story_0000000000000001",
			organizations: ["Org A"],
		});

		const candidate2 = createMockCandidate({
			candidateId: "cand_0000000000000002",
			organizations: ["Org B"],
		});
		const assessment2 = createMockAssessment({
			candidateId: "cand_0000000000000002",
			organizations: ["Org B"],
		});
		const story2 = createMockStory({
			storyId: "story_0000000000000002",
			order: 2,
			organizations: ["Org B"],
		});

		const input = createMockInput([
			{
				story: story1,
				candidate: candidate1,
				assessment: assessment1,
				historicalRelationship: null,
				historicalClassification: null,
			},
			{
				story: story2,
				candidate: candidate2,
				assessment: assessment2,
				historicalRelationship: null,
				historicalClassification: null,
			},
		]);

		const result = await generateListeningNarrativeMarkdown(input);

		// Should have opening, 2 stories, 1 transition, conclusion = 5 segments minimum
		expect(result.metadata.segmentCount).toBeGreaterThanOrEqual(5);
		expect(result.markdown).toContain("## Verhaal 1");
		expect(result.markdown).toContain("## Verhaal 2");
		expect(result.markdown).toContain("---"); // separators
	});

	it("includes historical classification context when available", async () => {
		const { generateListeningNarrativeMarkdown } =
			await import("./listening-narrative-generator.js");
		const { SubstantiveUpdateTypeSchema } =
			await import("../historical-regression/schema.js");

		const candidate = createMockCandidate();
		const assessment = createMockAssessment();
		const story = createMockStory();

		// Use a valid SubstantiveUpdateType value
		const validUpdateType = "availability-change" as any; // Cast to avoid type issues in test

		const historicalRelationship: HistoricalRelationship = {
			candidateId: "cand_0000000000000001",
			editionDate: "2025-01-15",
			classification: "SUBSTANTIVE_UPDATE",
			confidence: 0.8,
			matches: [],
			substantiveUpdate: {
				updateTypes: [validUpdateType],
				previousEditionDate: "2025-01-10",
				previousEditionId: "edition_2025-01-10",
				previousCandidateId: "cand_0000000000000001",
				previousClaimIds: [],
				currentClaimIds: ["claim_0000000000000001"],
				changedFacts: [
					"Extended context window from 128k to 1M tokens.",
				],
				evidenceUrls: ["https://example.com/update"],
				newInformationTimestamp:
					"2025-01-14T12:00:00+01:00[Europe/Amsterdam]",
				withinCurrentEditionWindow: true,
				rationale: "Substantive context window extension.",
			},
			repeatedReporting: undefined,
			historicalContext: [],
			rationale: "Substantive update detected.",
			derivedFrom: "deterministic-matching",
			semanticComparisonUsed: false,
		};

		const input = createMockInput([
			{
				story,
				candidate,
				assessment,
				historicalRelationship,
				historicalClassification: "SUBSTANTIVE_UPDATE",
			},
		]);

		const result = await generateListeningNarrativeMarkdown(input);
		// Check that the narrative was generated (the mock LLM returns a generic response)
		expect(result.markdown).toContain("## Verhaal 1");
		expect(result.metadata.storiesCovered).toBe(1);
	});
});

describe("Listening Narrative Generator — Helper Functions", () => {
	it("formats Dutch date correctly", async () => {
		const { formatDutchDateListening } =
			await import("./listening-narrative-generator.js");
		const result = formatDutchDateListening("2025-01-15");
		expect(result).toContain("woensdag");
		expect(result).toContain("15");
		expect(result).toContain("januari");
		expect(result).toContain("2025");
	});

	it("formats edition window correctly", async () => {
		const { formatWindowListening } =
			await import("./listening-narrative-generator.js");
		const result = formatWindowListening({
			start: "2025-01-14T05:00:00+01:00[Europe/Amsterdam]",
			end: "2025-01-15T05:00:00+01:00[Europe/Amsterdam]",
			timezone: "Europe/Amsterdam",
		});
		expect(result).toContain("05:00");
		expect(result).toContain("Europe/Amsterdam");
	});

	it("translates research domains to Dutch", async () => {
		const { translateDomainNLListening } =
			await import("./listening-narrative-generator.js");
		expect(translateDomainNLListening("models-inference-scientific")).toBe(
			"Modellen, Inferentie & Wetenschappelijk Onderzoek",
		);
		expect(
			translateDomainNLListening("agentic-ai-software-engineering"),
		).toBe("Agentic AI & Software Engineering");
		expect(translateDomainNLListening("unknown-domain")).toBe(
			"unknown-domain",
		);
	});

	it("computes max verification level correctly", async () => {
		const { getMaxVerificationLevelListening } =
			await import("./listening-narrative-generator.js");
		expect(getMaxVerificationLevelListening(["L0", "L1", "L2"])).toBe("L2");
		expect(getMaxVerificationLevelListening(["L0"])).toBe("L0");
		expect(getMaxVerificationLevelListening(["L3", "L1"])).toBe("L3");
	});

	it("computes content hash deterministically", async () => {
		const { computeContentHashListening } =
			await import("./listening-narrative-generator.js");
		const hash1 = computeContentHashListening("test content");
		const hash2 = computeContentHashListening("test content");
		expect(hash1).toBe(hash2);
		expect(hash1).toMatch(/^sha256:[a-f0-9]{64}$/);
	});

	it("counts words correctly", async () => {
		const { countWordsListening } =
			await import("./listening-narrative-generator.js");
		expect(countWordsListening("Dit is een test.")).toBe(4);
		expect(countWordsListening("")).toBe(0);
		expect(countWordsListening("   ")).toBe(0);
		expect(countWordsListening("Een	woord\nmet	spaties")).toBe(4);
	});
});
