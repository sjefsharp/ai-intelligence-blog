/**
 * Cross-Language Validator — Validation Tests
 *
 * ⚠️  All edition, candidate, claim and source data used here is SYNTHETIC
 * FIXTURE DATA. No test below represents actually retrieved evidence.
 */

import { describe, it, expect } from "vitest";
import { validateCrossLanguageConsistency } from "./cross-language-validator.js";
import type {
	CanonicalFactDossier,
	CanonicalCandidate,
	ConsolidatedClaim,
} from "../fact-dossier/schema.js";
import type {
	EditorialSelectionManifest,
	EditorialStory,
	EditorialCandidateAssessment,
} from "../editorial-selection/schema.js";

const createMockClaim = (id: string, text: string): ConsolidatedClaim => ({
	claimId: id,
	candidateId: "cand_0000000000000001",
	claimStatement: text,
	claimType: "benchmark-result",
	evidenceClassification: "RESEARCH_FINDING",
	supportingEvidenceUrls: ["https://example.com/source"],
	independentCorroboration: {
		established: false,
		sourceIds: [],
		urls: [],
		note: "No independent corroboration.",
	},
	contradictoryEvidence: [],
	limitingEvidence: [],
	technicalContext: {
		mechanism: "Test mechanism",
		capabilities: [],
		architecture: [],
		limitations: [],
		releaseMaturity: "ga",
		implementationStatus: "released",
	},
	confidence: 0.85,
	verificationLevel: "L1",
	verificationStatus: "verified",
	verificationRationale: "Test rationale",
	verificationMethods: ["methodology-review"],
	uncertainty: { unresolved: [], assumptions: [], falsificationCriteria: [] },
	sourceProvenance: {
		sourceId: "test-source",
		url: "https://example.com/source",
		title: "Test Source",
		publicationTimestamp: "2025-01-14T12:00:00+01:00[Europe/Amsterdam]",
		retrievedAt: "2025-01-15T06:00:00Z",
		verificationTimestamp: "2025-01-15T06:00:00Z",
		verifiedBy: "test-verifier",
	},
	inclusionNote: "Test claim.",
});

const createMockCandidate = (claimIds: string[]): CanonicalCandidate => ({
	candidateId: "cand_0000000000000001",
	editionId: "edition_2025-01-15",
	editionDate: "2025-01-15",
	factualHeadline: "Test AI model release",
	exactStatement: "A test AI model release introduces new capabilities.",
	researchDomains: ["models-inference-scientific"],
	subdomainTags: ["DOM-02-SD01"],
	discoveryRings: [1],
	organizations: ["Test AI Lab"],
	products: ["Test Model v2"],
	technologies: ["reasoning"],
	researchProjects: ["test-model-v2"],
	sources: [
		{
			sourceId: "test-arxiv",
			canonicalUrl: "https://arxiv.org/abs/2501.12345",
			discoveryIds: [],
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
			sourceId: "test-arxiv",
			canonicalUrl: "https://arxiv.org/abs/2501.12345",
			retrievalStatus: "CHECKED_FOUND",
			accessible: true,
			limitations: [],
		},
	],
	claims: claimIds.map((id) => createMockClaim(id, `Test claim ${id}`)),
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
		consolidatedBy: "test-consolidator",
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
});

const createMockAssessment = (): EditorialCandidateAssessment => ({
	candidateId: "cand_0000000000000001",
	factualHeadline: "Test AI model release",
	exactStatement: "A test AI model release introduces new capabilities.",
	organizations: ["Test AI Lab"],
	products: ["Test Model v2"],
	technologies: ["reasoning"],
	researchDomains: ["models-inference-scientific"],
	discoveryRings: [1],
	eligibility: {
		candidateId: "cand_0000000000000001",
		state: "ELIGIBLE",
		temporalStatus: "NEW_PASS",
		evidenceSufficiency: "STRONG",
		hasBlockingUncertainty: false,
		noveltyStatementPresent: true,
		omissionReviewFlags: [],
		reasons: ["New model release."],
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
	],
	materialityScore: 0.75,
	materialityLevel: "high",
	decision: "SELECTED",
	decisionReasons: ["High materiality."],
	decisionTraceableTo: ["claim_0000000000000001"],
	uncertainty: [],
	sourceReferences: ["https://arxiv.org/abs/2501.12345"],
	sourceIds: ["test-arxiv"],
	claimIds: ["claim_0000000000000001", "claim_0000000000000002"],
});

const createMockStory = (): EditorialStory => ({
	storyId: "story_0000000000000001",
	order: 1,
	title: "Test AI Lab — Models, Inference & Scientific Research",
	candidateId: "cand_0000000000000001",
	mergedCandidateIds: [],
	claimIds: ["claim_0000000000000001", "claim_0000000000000002"],
	sourceIds: ["test-arxiv"],
	organizations: ["Test AI Lab"],
	researchDomains: ["models-inference-scientific"],
	discoveryRings: [1],
	materialityScore: 0.75,
	materialityLevel: "high",
	decision: "SELECTED",
	summary: "Test model release.",
	recommendedDepth: "deep-dive",
	explanationOpportunities: ["technical-deep-dive"],
	caveats: ["Test caveat."],
	evidenceClassificationSummary: "RESEARCH_FINDING (L1)",
});

const createMockDossier = (): CanonicalFactDossier => ({
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
	candidates: [
		createMockCandidate([
			"claim_0000000000000001",
			"claim_0000000000000002",
		]),
	],
	editionSummary: {
		totalCandidates: 1,
		byTemporalEligibility: { NEW_PASS: 1 },
		byEvidenceClassification: { RESEARCH_FINDING: 2 },
		byVerificationStatus: { verified: 2 },
		byResearchDomain: { "models-inference-scientific": 1 },
		totalClaims: 2,
		claimsWithCounterevidence: 0,
		claimsWithUnresolvedUncertainties: 0,
		candidatesWithEvidenceGaps: 0,
		averageClaimConfidence: 0.85,
		strategicResearchCandidates: 0,
		technicalCandidates: 1,
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
});

const createMockManifest = (): EditorialSelectionManifest => ({
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
		contentHash: "sha256:000",
		editionDate: "2025-01-15",
		candidateCount: 1,
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
	candidates: [createMockAssessment()],
	stories: [createMockStory()],
	relationships: [],
	concentrationReview: {
		reviewedAt: "2025-01-15T06:00:00Z",
		selectedStoryCount: 1,
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
});

const createMockTraceability = () => ({
	segments: [
		{
			type: "lead",
			claimIds: ["claim_0000000000000001", "claim_0000000000000002"],
			sourceIds: ["test-arxiv"],
		},
		{
			type: "story",
			claimIds: ["claim_0000000000000001", "claim_0000000000000002"],
			sourceIds: ["test-arxiv"],
			storyId: "story_0000000000000001",
		},
	],
	claimCoverage: ["claim_0000000000000001", "claim_0000000000000002"],
	sourceCoverage: ["test-arxiv"],
	storyCoverage: ["story_0000000000000001"],
});

const createMockListeningTraceability = () => ({
	segments: [
		{ type: "opening", claimIds: [], sourceIds: [] },
		{
			type: "story",
			claimIds: ["claim_0000000000000001", "claim_0000000000000002"],
			sourceIds: ["test-arxiv"],
			storyId: "story_0000000000000001",
		},
		{ type: "transition", claimIds: [], sourceIds: [] },
		{ type: "conclusion", claimIds: [], sourceIds: [] },
	],
	claimCoverage: ["claim_0000000000000001", "claim_0000000000000002"],
	sourceCoverage: ["test-arxiv"],
	storyCoverage: ["story_0000000000000001"],
});

describe("Cross-Language Validator — Output Validation", () => {
	it("detects consistent claims across all four representations", async () => {
		const dutchNewsletter = `# AI Intelligence — Wednesday 15 January 2025\n\nTest article with claim_0000000000000001 and claim_0000000000000002 mentioned.`;
		const dutchListening = `# AI Daily Intelligence — Wednesday 15 January 2025\n\nOpening.\n\n## Story 1\n\nTest story with claim_0000000000000001 and claim_0000000000000002.`;
		const englishArticle = `# AI Intelligence — Wednesday 15 January 2025\n\nTest article with claim_0000000000000001 and claim_0000000000000002.`;
		const englishListening = `# AI Daily Intelligence — Wednesday 15 January 2025\n\nOpening.\n\n## Story 1\n\nTest story with claim_0000000000000001 and claim_0000000000000002.`;

		const result = await validateCrossLanguageConsistency(
			{
				dutchNewsletterMarkdown: dutchNewsletter,
				dutchNewsletterArtifactId: "pubart_dutch_nl",
				dutchNewsletterTraceability: createMockTraceability(),
				dutchListeningMarkdown: dutchListening,
				dutchListeningArtifactId: "pubart_dutch_listening",
				dutchListeningTraceability: createMockListeningTraceability(),
				englishArticleMarkdown: englishArticle,
				englishArticleArtifactId: "pubart_english_article",
				englishArticleTraceability: createMockTraceability(),
				englishListeningMarkdown: englishListening,
				englishListeningArtifactId: "pubart_english_listening",
				englishListeningTraceability: createMockListeningTraceability(),
			},
			createMockDossier(),
			createMockManifest(),
		);

		expect(result.overallStatus).toBe("consistent");
		expect(result.summary.consistentClaims).toBe(2);
		expect(result.summary.divergentClaims).toBe(0);
		expect(result.summary.missingEnglishArticle).toBe(0);
		expect(result.summary.missingEnglishListening).toBe(0);
	});

	it("detects missing claims in English article", async () => {
		const dutchNewsletter = `# AI Intelligence — Wednesday 15 January 2025\n\nTest article with claim_0000000000000001.`;
		const dutchListening = `# AI Daily Intelligence — Wednesday 15 January 2025\n\nOpening.\n\n## Story 1\n\nTest story with claim_0000000000000001.`;
		const englishArticle = `# AI Intelligence — Wednesday 15 January 2025\n\nTest article WITHOUT the claim.`;
		const englishListening = `# AI Daily Intelligence — Wednesday 15 January 2025\n\nOpening.\n\n## Story 1\n\nTest story with claim_0000000000000001.`;

		const result = await validateCrossLanguageConsistency(
			{
				dutchNewsletterMarkdown: dutchNewsletter,
				dutchNewsletterArtifactId: "pubart_dutch_nl",
				dutchNewsletterTraceability: createMockTraceability(),
				dutchListeningMarkdown: dutchListening,
				dutchListeningArtifactId: "pubart_dutch_listening",
				dutchListeningTraceability: createMockListeningTraceability(),
				englishArticleMarkdown: englishArticle,
				englishArticleArtifactId: "pubart_english_article",
				englishArticleTraceability: createMockTraceability(),
				englishListeningMarkdown: englishListening,
				englishListeningArtifactId: "pubart_english_listening",
				englishListeningTraceability: createMockListeningTraceability(),
			},
			createMockDossier(),
			createMockManifest(),
		);

		expect(result.overallStatus).toBe("incomplete");
		expect(result.summary.missingEnglishArticle).toBeGreaterThan(0);
	});

	it("detects numerical differences", async () => {
		const dutchNewsletter = `# AI Intelligence — Wednesday 15 January 2025\n\nThe model achieves 15% better performance. claim_0000000000000001 claim_0000000000000002`;
		const dutchListening = `# AI Daily Intelligence — Wednesday 15 January 2025\n\nThe model achieves 15% better performance. claim_0000000000000001 claim_0000000000000002`;
		const englishArticle = `# AI Intelligence — Wednesday 15 January 2025\n\nThe model achieves 25% better performance. claim_0000000000000001 claim_0000000000000002`;
		const englishListening = `# AI Daily Intelligence — Wednesday 15 January 2025\n\nThe model achieves 15% better performance. claim_0000000000000001 claim_0000000000000002`;

		const result = await validateCrossLanguageConsistency(
			{
				dutchNewsletterMarkdown: dutchNewsletter,
				dutchNewsletterArtifactId: "pubart_dutch_nl",
				dutchNewsletterTraceability: createMockTraceability(),
				dutchListeningMarkdown: dutchListening,
				dutchListeningArtifactId: "pubart_dutch_listening",
				dutchListeningTraceability: createMockListeningTraceability(),
				englishArticleMarkdown: englishArticle,
				englishArticleArtifactId: "pubart_english_article",
				englishArticleTraceability: createMockTraceability(),
				englishListeningMarkdown: englishListening,
				englishListeningArtifactId: "pubart_english_listening",
				englishListeningTraceability: createMockListeningTraceability(),
			},
			createMockDossier(),
			createMockManifest(),
		);

		expect(result.overallStatus).toBe("divergences-found");
		expect(result.summary.divergentClaims).toBeGreaterThan(0);
		const divergence = result.claimMappings.find((m) =>
			m.divergenceDetails.some((d) => d.type === "numerical-difference"),
		);
		expect(divergence).toBeDefined();
	});

	it("detects maturity differences", async () => {
		const dutchNewsletter = `# AI Intelligence — Wednesday 15 January 2025\n\nThe feature is generally available (GA). claim_0000000000000001 claim_0000000000000002`;
		const dutchListening = `# AI Daily Intelligence — Wednesday 15 January 2025\n\nThe feature is generally available. claim_0000000000000001 claim_0000000000000002`;
		const englishArticle = `# AI Intelligence — Wednesday 15 January 2025\n\nThe feature is in preview. claim_0000000000000001 claim_0000000000000002`;
		const englishListening = `# AI Daily Intelligence — Wednesday 15 January 2025\n\nThe feature is generally available. claim_0000000000000001 claim_0000000000000002`;

		const result = await validateCrossLanguageConsistency(
			{
				dutchNewsletterMarkdown: dutchNewsletter,
				dutchNewsletterArtifactId: "pubart_dutch_nl",
				dutchNewsletterTraceability: createMockTraceability(),
				dutchListeningMarkdown: dutchListening,
				dutchListeningArtifactId: "pubart_dutch_listening",
				dutchListeningTraceability: createMockListeningTraceability(),
				englishArticleMarkdown: englishArticle,
				englishArticleArtifactId: "pubart_english_article",
				englishArticleTraceability: createMockTraceability(),
				englishListeningMarkdown: englishListening,
				englishListeningArtifactId: "pubart_english_listening",
				englishListeningTraceability: createMockListeningTraceability(),
			},
			createMockDossier(),
			createMockManifest(),
		);

		expect(result.overallStatus).toBe("divergences-found");
		const divergence = result.claimMappings.find((m) =>
			m.divergenceDetails.some((d) => d.type === "maturity-difference"),
		);
		expect(divergence).toBeDefined();
		expect(
			divergence!.divergenceDetails.find(
				(d) => d.type === "maturity-difference",
			)!.severity,
		).toBe("critical");
	});

	it("produces valid content hash", async () => {
		const dutchNewsletter = `# AI Intelligence — Wednesday 15 January 2025\n\nTest article with claim_0000000000000001.`;
		const dutchListening = `# AI Daily Intelligence — Wednesday 15 January 2025\n\nOpening.\n\n## Story 1\n\nTest story with claim_0000000000000001.`;
		const englishArticle = `# AI Intelligence — Wednesday 15 January 2025\n\nTest article with claim_0000000000000001.`;
		const englishListening = `# AI Daily Intelligence — Wednesday 15 January 2025\n\nOpening.\n\n## Story 1\n\nTest story with claim_0000000000000001.`;

		const result = await validateCrossLanguageConsistency(
			{
				dutchNewsletterMarkdown: dutchNewsletter,
				dutchNewsletterArtifactId: "pubart_dutch_nl",
				dutchNewsletterTraceability: createMockTraceability(),
				dutchListeningMarkdown: dutchListening,
				dutchListeningArtifactId: "pubart_dutch_listening",
				dutchListeningTraceability: createMockListeningTraceability(),
				englishArticleMarkdown: englishArticle,
				englishArticleArtifactId: "pubart_english_article",
				englishArticleTraceability: createMockTraceability(),
				englishListeningMarkdown: englishListening,
				englishListeningArtifactId: "pubart_english_listening",
				englishListeningTraceability: createMockListeningTraceability(),
			},
			createMockDossier(),
			createMockManifest(),
		);

		expect(result.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
	});
});
