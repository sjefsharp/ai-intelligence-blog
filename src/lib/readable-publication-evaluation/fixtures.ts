/**
 * Readable Publication Quality Evaluation — Test Fixtures
 *
 * ⚠️  All edition, candidate, claim and source data used here is SYNTHETIC
 * FIXTURE DATA. Nothing represents actually retrieved evidence or real findings.
 *
 * Fixtures cover the 22 representative cases required by the specification:
 * 1. A newsletter with excellent first-screen orientation
 * 2. A newsletter opening with vague generic AI commentary
 * 3. Technical details presented before necessary context
 * 4. Appropriate progressive disclosure of a complex agentic mechanism
 * 5. Superficial explanation of an important scientific breakthrough
 * 6. A detailed but cognitively accessible technical explanation
 * 7. An article with excessive acronym and product-name density
 * 8. A Gartner or McKinsey study presented without critical methodological limitations
 * 9. A consultancy forecast incorrectly presented as measured fact
 * 10. A vendor benchmark incorrectly described as independently verified
 * 11. A missing original source link
 * 12. A materially selected development omitted from the publication
 * 13. An unsupported causal inference
 * 14. A visually attractive but factually misleading diagram
 * 15. An inaccessible table or visualization without an adequate text equivalent
 * 16. An article with poor heading hierarchy
 * 17. A Dutch publication and English derivative containing contradictory numerical results
 * 18. A quiet edition that remains complete without unnecessary padding
 * 19. An edition with several major scientific, technical and strategic developments
 * 20. A localized repair introducing a factual or accessibility regression
 * 21. A publication whose semantic quality cannot be established deterministically
 * 22. An evaluation interrupted by exhausted free inference capacity
 */

import type { ReadableQualityEvaluationInput } from "../readable-publication-evaluation/schema.js";
import type {
	CanonicalFactDossier,
	CanonicalCandidate,
} from "../fact-dossier/schema.js";
import type {
	EditorialSelectionManifest,
	EditorialStory,
	EditorialCandidateAssessment,
} from "../editorial-selection/schema.js";
import type { HistoricalRegressionReport } from "../historical-regression/schema.js";
import type {
	PublicationMetadata,
	ArticleIdentity,
} from "../publication/schema.js";
import type { VisualizationSpecification } from "../visualization/schema.js";

// ============================================================================
// Mock Data Builders
// ============================================================================

const createMockCandidate = (
	overrides: Partial<CanonicalCandidate> = {},
): CanonicalCandidate => ({
	candidateId: "cand_0000000000000001",
	editionId: "edition_2025-01-15",
	editionDate: "2025-01-15",
	factualHeadline: "Test AI model release with new capabilities",
	exactStatement:
		"A test AI model release introduces new reasoning capabilities and extended context window.",
	researchDomains: ["models-inference-scientific"],
	subdomainTags: ["DOM-02-SD01"],
	discoveryRings: [1],
	organizations: ["Test AI Lab"],
	products: ["Test Model v2"],
	technologies: ["reasoning", "extended context"],
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
	claims: [
		{
			claimId: "claim_0000000000000001",
			candidateId: "cand_0000000000000001",
			claimStatement:
				"The test model achieves 15% better reasoning benchmarks.",
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
				sourceId: "test-arxiv",
				url: "https://arxiv.org/abs/2501.12345",
				title: "Test Model v2 Paper",
				publicationTimestamp:
					"2025-01-14T12:00:00+01:00[Europe/Amsterdam]",
				retrievedAt: "2025-01-15T06:00:00Z",
				verificationTimestamp: "2025-01-15T06:00:00Z",
				verifiedBy: "test-verifier",
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
	...overrides,
});

const createMockAssessment = (
	overrides: Partial<EditorialCandidateAssessment> = {},
): EditorialCandidateAssessment => ({
	candidateId: "cand_0000000000000001",
	factualHeadline: "Test AI model release with new capabilities",
	exactStatement:
		"A test AI model release introduces new reasoning capabilities and extended context window.",
	organizations: ["Test AI Lab"],
	products: ["Test Model v2"],
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
	sourceIds: ["test-arxiv"],
	claimIds: ["claim_0000000000000001"],
	...overrides,
});

const createMockStory = (
	overrides: Partial<EditorialStory> = {},
): EditorialStory => ({
	storyId: "story_0000000000000001",
	order: 1,
	title: "Test AI Lab — Models, Inference & Scientific Research",
	candidateId: "cand_0000000000000001",
	mergedCandidateIds: [],
	claimIds: ["claim_0000000000000001"],
	sourceIds: ["test-arxiv"],
	organizations: ["Test AI Lab"],
	researchDomains: ["models-inference-scientific"],
	discoveryRings: [1],
	materialityScore: 0.75,
	materialityLevel: "high",
	decision: "SELECTED",
	summary: "Test model release with reasoning improvements.",
	recommendedDepth: "deep-dive",
	explanationOpportunities: ["technical-deep-dive", "scientific-explanation"],
	caveats: [
		"No independent replication yet.",
		"Compute requirements doubled.",
	],
	evidenceClassificationSummary: "RESEARCH_FINDING (L1), VERIFIED_FACT (L2)",
	...overrides,
});

const createMockDossier = (
	candidates: CanonicalCandidate[] = [],
): CanonicalFactDossier => ({
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
	candidates: candidates.length > 0 ? candidates : [createMockCandidate()],
	editionSummary: {
		totalCandidates: candidates.length || 1,
		byTemporalEligibility: { NEW_PASS: candidates.length || 1 },
		byEvidenceClassification: { RESEARCH_FINDING: candidates.length || 1 },
		byVerificationStatus: { verified: candidates.length || 1 },
		byResearchDomain: {
			"models-inference-scientific": candidates.length || 1,
		},
		totalClaims: candidates.length || 1,
		claimsWithCounterevidence: 0,
		claimsWithUnresolvedUncertainties: 0,
		candidatesWithEvidenceGaps: 0,
		averageClaimConfidence: 0.85,
		strategicResearchCandidates: 0,
		technicalCandidates: candidates.length || 1,
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

const createMockManifest = (
	stories: EditorialStory[] = [],
	candidates: EditorialCandidateAssessment[] = [],
): EditorialSelectionManifest => ({
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
		candidateCount: stories.length || 1,
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
	candidates: candidates.length > 0 ? candidates : [createMockAssessment()],
	stories: stories.length > 0 ? stories : [createMockStory()],
	relationships: [],
	concentrationReview: {
		reviewedAt: "2025-01-15T06:00:00Z",
		selectedStoryCount: stories.length || 1,
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

const createMockHistoricalRegression = (): HistoricalRegressionReport => ({
	schemaVersion: "1.0.0",
	reportId: "hr_0000000000000001",
	editionId: "edition_2025-01-15",
	editionDate: "2025-01-15",
	editionWindow: {
		editionDate: "2025-01-15",
		start: "2025-01-14T05:00:00+01:00[Europe/Amsterdam]",
		end: "2025-01-15T05:00:00+01:00[Europe/Amsterdam]",
		timezone: "Europe/Amsterdam",
		durationHours: 24,
	},
	executionId: "exec_0000000000000001",
	executedAt: "2025-01-15T06:00:00Z",
	generatedBy: "test",
	currentDossierVersion: "fd_0000000000000001",
	currentDossierContentHash:
		"sha256:0000000000000000000000000000000000000000000000000000000000000000",
	historicalWindow: {
		days: 7,
		timezone: "Europe/Amsterdam",
		editionDates: [],
		dailyEligibilityWindow: {
			editionDate: "2025-01-15",
			start: "2025-01-14T05:00:00+01:00[Europe/Amsterdam]",
			end: "2025-01-15T05:00:00+01:00[Europe/Amsterdam]",
			timezone: "Europe/Amsterdam",
			durationHours: 24,
		},
		dailyEligibilityWindowUnchanged: true,
	},
	historicalEditions: [],
	candidatesEvaluated: 1,
	relationships: [],
	substantiveUpdates: [],
	repeatedReporting: [],
	potentialOmissions: [],
	missingHistoricalEvidence: [],
	unresolvedQuestions: [],
	finalStatus: "COMPLETE",
	inferenceUsed: false,
	inferenceNote: "Test",
	contentHash:
		"sha256:0000000000000000000000000000000000000000000000000000000000000000",
});

const createMockPublicationMetadata = (): PublicationMetadata => ({
	artifactId: "pubart_0000000000000001",
	editionId: "edition_2025-01-15",
	editionDate: "2025-01-15",
	contentType: "newsletter",
	language: "nl",
	canonicalFilename: "publication.md",
	title: "AI Intelligence — 15 januari 2025",
	description: "Nederlandse technische nieuwsbrief",
	articleId: "art_0000000000000001",
	publicationTimestamp: "2025-01-15T06:00:00Z",
	originalNewsDisclosureTimestamp:
		"2025-01-14T12:00:00+01:00[Europe/Amsterdam]",
	lastSubstantiveUpdateTimestamp: "2025-01-15T06:00:00Z",
	readingTimeMinutes: 5,
	estimatedListeningDurationMinutes: 5,
	sourceReferences: ["https://arxiv.org/abs/2501.12345"],
	claimReferences: ["claim_0000000000000001"],
	topics: ["AI", "Models"],
	organizations: ["Test AI Lab"],
	lifecycleStatus: "DRAFT",
	validationStatus: "pending",
	validationResults: [],
	relatedVariants: [],
	version: 1,
	schemaVersion: "1.0.0",
	contentHash:
		"sha256:0000000000000000000000000000000000000000000000000000000000000000",
});

const createMockArticleIdentities = (): ArticleIdentity[] => [];

const createMockVisualization = (): VisualizationSpecification => ({
	schemaVersion: "1.0.0",
	visualizationId: "viz_0000000000000001",
	editionId: "edition_2025-01-15",
	editionDate: "2025-01-15",
	articleId: "art_0000000000000001",
	candidateIds: ["cand_0000000000000001"],
	claimIds: ["claim_0000000000000001"],
	sourceIds: ["test-arxiv"],
	explanatoryPurpose: "Show benchmark comparison of test model vs baseline",
	type: "quantitative-chart",
	data: {
		type: "quantitative-chart",
		data: {
			chartType: "bar",
			showUncertainty: false,
			series: [
				{
					id: "test-model",
					label: "Test Model v2",
					isBaseline: false,
					data: [
						{
							x: "MMLU",
							y: 0.85,
							measurement: {
								value: 0.85,
								unit: "accuracy",
								valueType: "measured",
								sourceReference:
									"https://arxiv.org/abs/2501.12345",
							},
						},
					],
				},
			],
			xAxis: { label: "Benchmark", type: "category" },
			yAxis: {
				label: "Accuracy",
				unit: "percentage",
				includeZero: true,
				scale: "linear",
			},
			accessibleTable: {
				columns: [
					{ id: "benchmark", header: "Benchmark", type: "text" },
					{ id: "score", header: "Score", type: "number", unit: "%" },
				],
				rows: [
					{
						id: "r1",
						label: "MMLU",
						cells: { benchmark: "MMLU", score: 85 },
						isGroupHeader: false,
					},
				],
				caption: "Benchmark comparison",
			},
		},
	},
	languageVariants: [
		{
			language: "nl",
			title: "Benchmark vergelijking",
			caption: "Test Model v2 vs baseline",
			altText: "Staafdiagram met benchmark scores",
			longDescription: "Vergelijking van test model prestaties",
			localizedLabels: {},
		},
		{
			language: "en",
			title: "Benchmark Comparison",
			caption: "Test Model v2 vs baseline",
			altText: "Bar chart with benchmark scores",
			longDescription: "Comparison of test model performance",
			localizedLabels: {},
		},
	],
	accessibility: {
		targetLevel: "AA",
		hasAccessibleTable: true,
		hasLongDescription: true,
		readingOrder: [],
		keyboardAccessible: false,
		focusManagement: false,
	},
	measurements: [
		{
			value: 0.85,
			unit: "accuracy",
			valueType: "measured",
			sourceReference: "https://arxiv.org/abs/2501.12345",
		},
	],
	uncertainty: {
		assumptions: ["Benchmark conditions match production."],
		limitations: ["Single benchmark suite."],
		unsupportedInferences: [],
		evidenceGaps: ["No independent replication."],
		causalityRisk: false,
		colorOnlyRisk: false,
		boundarySimplificationRisk: false,
	},
	rendering: {
		outputFormats: ["SVG", "HTML_TABLE"],
		primaryFormat: "SVG",
		responsive: true,
		minReadableWidth: 320,
		reducedMotion: true,
		colorScheme: {
			contrastAA: true,
			noColorOnly: true,
			highContrast: true,
		},
		themes: ["light", "dark"],
	},
	status: {
		renderStatus: "VALIDATED",
		validated: true,
		validatedAt: "2025-01-15T06:00:00Z",
		generatedAt: "2025-01-15T06:00:00Z",
		generatedBy: "test",
		contentHash:
			"sha256:0000000000000000000000000000000000000000000000000000000000000000",
	},
	qualityEvaluation: [],
});

// ============================================================================
// Dutch Publication Fixtures (22 Representative Cases)
// ============================================================================

/** Fixture 1: Excellent first-screen orientation */
export const fixture1_excellentFirstScreen = `# AI Intelligence — woensdag 15 januari 2025

*Reporting window: 05:00–05:00 Europe/Amsterdam*

Deze editie belicht de meest consequentievolle AI-ontwikkelingen van de afgelopen 24 uur. **Test AI Lab** in **Models, Inference & Scientific Research** lanceert Test Model v2 met 15% verbetering op redeneringsbenchmarks.

Verder in deze editie: **Research Institute** (Architecture, Security & Governance) en **Enterprise Corp** (Enterprise AI Adoption).

---

### 1. Test AI Lab — Models, Inference & Scientific Research

#### Wat is veranderd
Test AI Lab heeft Test Model v2 uitgebracht met een verbeterde chain-of-thought mechanisme.

**Publicatiedatum:** 14 januari 2025 12:00 (Europe/Amsterdam).
**Betrokken organisaties:** Test AI Lab.
**Producten:** Test Model v2.

#### Waarom dit belangrijk is
**Materiële gewicht:** Hoog (score: 0.75).
**Real-world gevolgen:** De verbeterde redenering vermindert inferentiekosten met 15%.

#### Hoe het werkt
**Technisch mechanisme:** Enhanced chain-of-thought met synthetische redenering tokens.
**Capaciteiten:** reasoning, extended context.
**Architectuur:** dense transformer.
**Technische beperkingen:** Vereist 2x compute voor inferentie.
**Releasematuring:** Algemeen Beschikbaar (GA).

#### Beperkingen en tegenbewijs
**Vendor-claim:** Een of meer beweringen stammen van de aanbieder zonder onafhankelijke verificatie.
**Verificatieniveau:** L1 (methodologie beoordeeld, geen artefactreproductie).

#### Bronnen
- https://arxiv.org/abs/2501.12345
**Claim-identificaties:** claim_0000000000000001

---

### 2. Research Institute — Architecture, Security & Governance

#### Wat is veranderd
Research Institute publiceert nieuw beveiligingsframework voor agentische systemen.

#### Waarom dit belangrijk is
**Materiële gewicht:** Matig (score: 0.55).
**Beveiligingsassumpties:** Nieuw framework introduceert capability-based sandboxing.

#### Hoe het werkt
**Technisch mechanisme:** Capability tokens valideren alle tool calls.
**Releasematuring:** Preview.

#### Bronnen
- https://example.com/security-framework
**Claim-identificaties:** claim_0000000000000002

---

## Navigatie
- [Research Audit](research-audit.md) — Technisch bewijs en editoriële verantwoording
- [Luisterverhaal](AI Daily Intelligence — 2025-01-15.md) — Volledig Nederlandse luisternarratief

---
*Deze publicatie is gegenereerd vanuit het canoniek feiten dossier en de editoriële selectie manifest. Feitelijke claims zijn traceerbaar naar bronnen via claim-identificaties.*`;

/** Fixture 2: Vague generic AI commentary opening */
export const fixture2_genericOpening = `# AI Intelligence — woensdag 15 januari 2025

Goedemorgen. Welkom bij onze dagelijkse AI briefing. In deze editie bespreken we de nieuwste ontwikkelingen in kunstmatige intelligentie. Vandaag hebben we verschillende interessante verhalen over AI modellen en tools.

---

### 1. Test AI Lab — Models, Inference & Scientific Research

#### Wat is veranderd
Test AI Lab heeft Test Model v2 uitgebracht.

#### Waarom dit belangrijk is
AI modellen verbeteren constant. Dit is een nieuwe release.

#### Hoe het werkt
Het model gebruikt transformer architectuur.

#### Bronnen
- https://arxiv.org/abs/2501.12345
**Claim-identificaties:** claim_0000000000000001

---
*Disclaimer.*`;

/** Fixture 3: Technical details before context */
export const fixture3_technicalBeforeContext = `# AI Intelligence — woensdag 15 januari 2025

Deze editie belicht ontwikkelingen.

---

### 1. Test AI Lab — Models, Inference & Scientific Research

#### Wat is veranderd
Test AI Lab lanceert Test Model v2 met enhanced chain-of-thought met synthetische redenering tokens, dense transformer architectuur, 2x compute vereiste, GA release maturing, MMLU 85% accuracy, reasoning capabilities, extended context window.

#### Waarom dit belangrijk is
Deze technische specificaties zijn relevant voor architects.

#### Hoe het werkt
De chain-of-thought mechanisme werkt door tokens te genereren die redenering stapjes vertegenwoordigen. De dense transformer architectuur verwerkt deze tokens in parallelle aandachtskoppen. De synthetische redenering tokens zijn getraind op een specifieke dataset. De GA release betekent algemeen beschikbaar.

#### Bronnen
- https://arxiv.org/abs/2501.12345
**Claim-identificaties:** claim_0000000000000001`;

/** Fixture 4: Appropriate progressive disclosure */
export const fixture4_progressiveDisclosure = `# AI Intelligence — woensdag 15 januari 2025

*Reporting window: 05:00–05:00 Europe/Amsterdam*

Deze editie belicht de meest consequentievolle AI-ontwikkelingen. **Test AI Lab** lanceert Test Model v2 — een redeneringsmodel dat inferentiekosten met 15% reduceert.

---

### 1. Test AI Lab — Models, Inference & Scientific Research

#### Wat is veranderd
Test AI Lab heeft Test Model v2 uitgebracht, een nieuw foundation model met verbeterde redeneringscapaciteiten.

**Publicatiedatum:** 14 januari 2025 12:00 (Europe/Amsterdam).
**Betrokken organisaties:** Test AI Lab.

#### Waarom dit belangrijk is
De 15% verbetering op redeneringsbenchmarks betekent concrete kostenbesparing voor organisaties die AI-inferentie op schaal draaien. Voor architects betekent dit: minder compute voor dezelfde kwaliteit.

#### Hoe het werkt
**Op hoog niveau:** Het model gebruikt een verbeterde chain-of-thought aanpak waarbij redeneringstappen expliciet worden gegenereerd als tokens.

**Technisch mechanisme:** Enhanced chain-of-thought met synthetische redenering tokens. Deze tokens worden ingevoegd tijdens inferentie om het model te dwingen stap-voor-stap te redeneren.

**Capaciteiten:** reasoning, extended context.
**Architectuur:** dense transformer.
**Technische beperkingen:** Vereist 2x compute voor inferentie.
**Releasematuring:** Algemeen Beschikbaar (GA).

#### Beperkingen en tegenbewijs
**Vendor-claim:** Bewering van 15% verbetering komt van de aanbieder zonder onafhankelijke replicatie.
**Verificatieniveau:** L1.

#### Bronnen
- https://arxiv.org/abs/2501.12345
**Claim-identificaties:** claim_0000000000000001

---

## Navigatie
- [Research Audit](research-audit.md)
- [Luisterverhaal](AI Daily Intelligence — 2025-01-15.md)

---
*Deze publicatie is gegenereerd vanuit het canoniek feiten dossier en de editoriële selectie manifest.*`;

/** Fixture 5: Superficial explanation of scientific breakthrough */
export const fixture5_superficialScience = `# AI Intelligence — woensdag 15 januari 2025

Deze editie belicht ontwikkelingen.

---

### 1. Research Institute — Models, Inference & Scientific Research

#### Wat is veranderd
Research Institute publiceert breakthrough in protein vouwing met 40% nauwkeurigheidsverbetering.

#### Waarom dit belangrijk is
Dit is een grote doorbraak voor wetenschap.

#### Hoe het werkt
Het model gebruikt diep leren om proteïnen te vouwen. Het is heel accuraat.

#### Bronnen
- https://nature.com/articles/breakthrough
**Claim-identificaties:** claim_0000000000000003`;

/** Fixture 6: Detailed but cognitively accessible technical explanation */
export const fixture6_accessibleTechnical = `# AI Intelligence — woensdag 15 januari 2025

*Reporting window: 05:00–05:00 Europe/Amsterdam*

**Test AI Lab** lanceert Test Model v2 met 15% betere redenering — directe kostenimpact voor AI-inferentie.

---

### 1. Test AI Lab — Models, Inference & Scientific Research

#### Wat is veranderd
Test AI Lab introduceert Test Model v2, een foundation model met verbeterde chain-of-thought redenering.

#### Waarom dit belangrijk is
Voor system architects: 15% minder compute voor gelijke redeneringskwaliteit. Dat is materieel voor kostenbeheersing op schaal.

#### Hoe het werkt
**Context:** Traditionele modellen redeneren impliciet. Test Model v2 maakt redenering expliciet door synthetische tokens.

**Mechanisme:** Tijdens training leert het model 'redenering tokens' te genereren die tussenstappen vastleggen. Bij inferentie forceert dit stap-voor-stap redenering.

**Architectuur:** Dense transformer met uitgebreide context window (32K tokens).

**Beperkingen:** 2x compute overhead tijdens inferentie. Compenseert door minder herhalingen nodig.

**Release:** GA (algemeen beschikbaar) sinds 14 januari.

#### Beperkingen en tegenbewijs
Vendor-claim (15% verbetering) — geen onafhankelijke replicatie. L1 verificatie.

#### Bronnen
- https://arxiv.org/abs/2501.12345
**Claim-identificaties:** claim_0000000000000001

---

## Navigatie
- [Research Audit](research-audit.md)
- [Luisterverhaal](AI Daily Intelligence — 2025-01-15.md)

---
*Canoniek feiten dossier en editoriële selectie manifest.*`;

/** Fixture 7: Excessive acronym and product-name density */
export const fixture7_excessiveAcronyms = `# AI Intelligence — woensdag 15 januari 2025

Deze editie belicht: Test AI Lab (Test Model v2, MMLU, GSM8K, BBH, CoT, PoT, ToT, GoT, RAG, RLHF, DPO, PPO, GA, API, SDK, CLI, GUI, TUI, VUI, LLM, SLM, MoE, LoRA, QLoRA, PEFT, FSDP, ZeRO, AMP, BF16, FP16, FP8, INT8, INT4, GPTQ, AWQ, EXL2, GGML, GGUF, llama.cpp, vLLM, TGI, SGLan, TensorRT-LLM, DeepSpeed, Megatron, ColossalAI, FairScale, PyTorch, JAX, TensorFlow, ONNX, Triton, CUDA, cuDNN, NCCL, MPI, Horovod, Ray, Dask, Spark, Kubernetes, Docker, Helm, Kustomize, ArgoCD, Flux, Tekton, Knative, Istio, Linkerd, Envoy, gRPC, REST, GraphQL, gRPC-Web, ProtoBuf, Avro, Thrift, Cap'n Proto, FlatBuffers, MessagePack, CBOR, JSON, YAML, TOML, XML, HTML, CSS, JS, TS, WASM, SIMD, AVX, AVX2, AVX-512, NEON, SVE, RISC-V, x86, ARM, AArch64, GPU, TPU, NPU, IPU, DPU, CPU, RAM, VRAM, HBM, DDR, LPDDR, NVMe, SSD, HDD, RAID, ZFS, Btrfs, ext4, XFS, NFS, SMB, iSCSI, FC, RoCE, InfiniBand, Ethernet, TCP, UDP, QUIC, HTTP, HTTPS, TLS, SSL, mTLS, OAuth, OIDC, SAML, JWT, JWK, JWE, JWS, PASETO, Fernet, AES, ChaCha20, Poly1305, HMAC, SHA, SHA-256, SHA-512, BLAKE2, BLAKE3, Argon2, bcrypt, scrypt, PBKDF2, Ed25519, X25519, RSA, ECDSA, ECDH, Kyber, Dilithium, Falcon, SPHINCS+, NTRU, Classic McEliece, HQC, BIKE, SIKE, Rainbow, GeMSS, MQDSS, LUOV, RaCoSS, MAYO, QR-UOV, HFEv-, HFEm, HFEf, MQ, IP, UOV, SLASH, LegRoast, MPC, FHE, ZK, ZK-SNARK, ZK-STARK, PLONK, Halo2, Nova, Spartan, Virgo, Libra, Aquarius, Gemini, Taurus, Cancer, Leo, Virgo, Libra, Scorpio, Sagittarius, Capricorn, Aquarius, Pisces.

---

### 1. Test AI Lab — Models, Inference & Scientific Research
Test Model v2 MMLU GSM8K BBH CoT PoT ToT GoT RAG RLHF DPO PPO GA.`;

/** Fixture 8: Gartner study without methodological limitations */
export const fixture8_gartnerWithoutLimitations = `# AI Intelligence — woensdag 15 januari 2025

Deze editie belicht ontwikkelingen.

---

### 1. Gartner — Economics, Business Impact & Strategic Intelligence

#### Wat is veranderd
Gartner rapporteert: AI adopitie levert 250% ROI binnen 18 maanden voor enterprise organisaties.

#### Waarom dit belangrijk is
Dit bewijst dat AI investeringen zich snel terugverdienen.

#### Hoe het werkt
De studie befragde 500 CIO's en meet productiviteitswinst.

#### Bronnen
- https://gartner.com/report/ai-roi (paywall)
**Claim-identificaties:** claim_0000000000000004`;

/** Fixture 9: Consultancy forecast as measured fact */
export const fixture9_forecastAsFact = `# AI Intelligence — woensdag 15 januari 2025

Deze editie belicht ontwikkelingen.

---

### 1. McKinsey — Economics, Business Impact & Strategic Intelligence

#### Wat is veranderd
McKinsey meet: Generatieve AI voegt $4.4 trillion toe aan wereldwijde economie.

#### Waarom dit belangrijk is
Deze gemeten impact toont de kracht van AI.

#### Hoe het werkt
Econometrisch model berekent de waarde.

#### Bronnen
- https://mckinsey.com/insights/genai-value
**Claim-identificaties:** claim_0000000000000005`;

/** Fixture 10: Vendor benchmark as independently verified */
export const fixture10_vendorBenchmarkAsVerified = `# AI Intelligence — woensdag 15 januari 2025

Deze editie belicht ontwikkelingen.

---

### 1. Test AI Lab — Models, Inference & Scientific Research

#### Wat is veranderd
Onafhankelijk geverifieerd: Test Model v2 haalt 95% op MMLU.

#### Waarom dit belangrijk is
De onafhankelijke verificatie bevestigt de prestaties.

#### Hoe het werkt
Benchmark gedraaid op standaard hardware.

#### Bronnen
- https://testailab.com/benchmarks (vendor site)
**Claim-identificaties:** claim_0000000000000006`;

/** Fixture 11: Missing original source link */
export const fixture11_missingSourceLink = `# AI Intelligence — woensdag 15 januari 2025

Deze editie belicht ontwikkelingen.

---

### 1. Test AI Lab — Models, Inference & Scientific Research

#### Wat is veranderd
Test AI Lab lanceert Test Model v2 met 15% verbetering.

#### Waarom dit belangrijk is
Kostenreductie voor inferentie.

#### Hoe het werkt
Verbeterde chain-of-thought mechanisme.

#### Beperkingen en tegenbewijs
Geen significante beperkingen.

#### Bronnen
**Claim-identificaties:** claim_0000000000000001`;

/** Fixture 12: Materially selected development omitted */
export const fixture12_omittedDevelopment = `# AI Intelligence — woensdag 15 januari 2025

Deze editie belicht ontwikkelingen.

---

### 1. Research Institute — Architecture, Security & Governance

#### Wat is veranderd
Research Institute publiceert beveiligingsframework.

#### Waarom dit belangrijk is
Beveiliging is belangrijk.

#### Bronnen
- https://example.com/security
**Claim-identificaties:** claim_0000000000000002`;

/** Fixture 13: Unsupported causal inference */
export const fixture13_unsupportedCausal = `# AI Intelligence — woensdag 15 januari 2025

Deze editie belicht ontwikkelingen.

---

### 1. Test AI Lab — Models, Inference & Scientific Research

#### Wat is veranderd
Test AI Lab lanceert Test Model v2.

#### Waarom dit belangrijk is
De 15% verbetering **veroorzaakt** directe winststijging voor alle adopters.

#### Hoe het werkt
Verbeterde redenering leidt tot betere beslissingen.

#### Bronnen
- https://arxiv.org/abs/2501.12345
**Claim-identificaties:** claim_0000000000000001`;

/** Fixture 14: Visually attractive but factually misleading diagram */
export const fixture14_misleadingDiagram = `# AI Intelligence — woensdag 15 januari 2025

Deze editie belicht ontwikkelingen.

Zie het diagram voor de prestaties.

---

### 1. Test AI Lab — Models, Inference & Scientific Research

#### Wat is veranderd
Test AI Lab lanceert Test Model v2.

#### Hoe het werkt
![Benchmark chart](chart.png)

#### Bronnen
- https://arxiv.org/abs/2501.12345
**Claim-identificaties:** claim_0000000000000001`;

/** Fixture 15: Inaccessible table without text equivalent */
export const fixture15_inaccessibleTable = `# AI Intelligence — woensdag 15 januari 2025

Deze editie belicht ontwikkelingen.

---

### 1. Test AI Lab — Models, Inference & Scientific Research

#### Wat is veranderd
Test AI Lab lanceert Test Model v2.

#### Hoe het werkt
| Model | MMLU | GSM8K |
| Test Model v2 | 95% | 88% |
| Baseline | 80% | 72% |

#### Bronnen
- https://arxiv.org/abs/2501.12345
**Claim-identificaties:** claim_0000000000000001`;

/** Fixture 16: Poor heading hierarchy */
export const fixture16_poorHeadingHierarchy = `# AI Intelligence — woensdag 15 januari 2025

Deze editie belicht ontwikkelingen.

### 1. Test AI Lab

#### Wat is veranderd
Test AI Lab lanceert Test Model v2.

##### Waarom dit belangrijk is
Belangrijk.

#### Hoe het werkt
Mechanisme.

###### Te diep geneste kop
Detail.

#### Bronnen
- https://arxiv.org/abs/2501.12345`;

/** Fixture 17: Contradictory numerical results between languages */
export const fixture17_contradictoryNumbers = `# AI Intelligence — woensdag 15 januari 2025

Deze editie belicht ontwikkelingen.

---

### 1. Test AI Lab — Models, Inference & Scientific Research

#### Wat is veranderd
Test AI Lab lanceert Test Model v2 met **20% verbetering** op redeneringsbenchmarks.

#### Waarom dit belangrijk is
De 20% verbetering reduceert kosten.

#### Hoe het werkt
Enhanced chain-of-thought mechanisme.

#### Bronnen
- https://arxiv.org/abs/2501.12345
**Claim-identificaties:** claim_0000000000000001`;

// English version with contradictory number (15% vs 20%)
export const fixture17_contradictoryNumbers_en = `# AI Intelligence — Wednesday 15 January 2025

*Reporting window: 05:00–05:00 Europe/Amsterdam*

This edition examines the most consequential AI developments. **Test AI Lab** launches Test Model v2 with **15% improvement** on reasoning benchmarks.

---

## 1. Test AI Lab — Models, Inference & Scientific Research

### What Changed
Test AI Lab introduces Test Model v2 with improved chain-of-thought reasoning.

### Why It Matters
The 15% improvement reduces inference costs.

### How It Works
Enhanced chain-of-thought mechanism.

## References
- https://arxiv.org/abs/2501.12345

---
*Independently authored from canonical fact dossier.*`;

/** Fixture 18: Quiet edition without padding */
export const fixture18_quietEdition = `# AI Intelligence — woensdag 15 januari 2025

*Reporting window: 05:00–05:00 Europe/Amsterdam*

Deze editie van **AI Intelligence** belicht de afgelopen 24 uur. Er zijn geen ontwikkelingen geselecteerd die de materiële drempel bereiken.

---

## Navigatie
- [Research Audit](research-audit.md) — Technisch bewijs en editoriële verantwoording
- [Luisterverhaal](AI Daily Intelligence — 2025-01-15.md) — Volledig Nederlandse luisternarratief

---
*Deze publicatie is gegenereerd vanuit het canoniek feiten dossier en de editoriële selectie manifest.*`;

/** Fixture 19: Multiple major developments */
export const fixture19_multipleMajorDevelopments = `# AI Intelligence — woensdag 15 januari 2025

*Reporting window: 05:00–05:00 Europe/Amsterdam*

Deze editie belicht 4 consequentiejke ontwikkelingen: **Test AI Lab** (Models, 15% redeneringsverbetering), **Research Institute** (Architecture, nieuw beveiligingsframework), **Gartner** (Economics, 250% ROI studie), **Enterprise Corp** (Enterprise Adoption, 40% productiviteitswinst).

---

### 1. Test AI Lab — Models, Inference & Scientific Research

#### Wat is veranderd
Test AI Lab lanceert Test Model v2 met 15% redeneringsverbetering.

**Publicatiedatum:** 14 januari 2025.
**Betrokken organisaties:** Test AI Lab.

#### Waarom dit belangrijk is
**Materiële gewicht:** Hoog (0.80). Directe kostenimpact voor inferentie architecturen.

#### Hoe het werkt
**Technisch mechanisme:** Enhanced chain-of-thought.
**Releasematuring:** GA.

#### Bronnen
- https://arxiv.org/abs/2501.12345
**Claim-identificaties:** claim_0000000000000001

---

### 2. Research Institute — Architecture, Security & Governance

#### Wat is veranderd
Research Institute publiceert capability-based sandboxing framework.

#### Waarom dit belangrijk is
**Materiële gewicht:** Hoog (0.78). Nieuw vertrouwensgrens model voor agentische systemen.

#### Hoe het werkt
**Technisch mechanisme:** Capability tokens valideren tool calls.
**Releasematuring:** Preview.

#### Bronnen
- https://example.com/security-framework
**Claim-identificaties:** claim_0000000000000002

---

### 3. Gartner — Economics, Business Impact & Strategic Intelligence

#### Wat is veranderd
Gartner studie: 250% ROI voor enterprise AI adopters binnen 18 maanden.

#### Waarom dit belangrijk is
**Materiële gewicht:** Hoog (0.75). Strategische beleggingsbeslissingen.

#### Hoe het werkt
**Onderzoeksdesign:** Survey van 500 CIO's.
**Steekproef:** 500 enterprise organisaties.
**Statistische onzekerheid:** ±15% betrouwbaarheidsinterval.
**Causale claim type:** Correlatie.

#### Beperkingen en tegenbewijs
**Onderzoeksbeperking:** Correlatie, geen causaliteit. Paywall bron.
**Financiering:** Gartner (adviseursorganisatie).

#### Bronnen
- https://gartner.com/ai-roi-study
**Claim-identificaties:** claim_0000000000000003

---

### 4. Enterprise Corp — Enterprise AI Adoption & Organizational Transformation

#### Wat is veranderd
Enterprise Corp rapporteert 40% productiviteitswinst na Copilot deploy.

#### Waarom dit belangrijk is
**Materiële gewicht:** Matig (0.60). Organisatie-transformatie case study.

#### Hoe het werkt
**Gemeten uitkomst:** Code velocity + PR throughput.
**Baseline:** Pre-Copilot productiviteit.
**Steekproef:** 200 ontwikkelaars, 6 maanden.

#### Beperkingen en tegenbewijs
**Vendor-claim:** Enterprise Corp is Copilot klant.
**Generaliseerbaarheid:** Enkele organisatie, specifieke context.

#### Bronnen
- https://enterprisecorp.com/copilot-case-study
**Claim-identificaties:** claim_0000000000000004

---

## Navigatie
- [Research Audit](research-audit.md)
- [Luisterverhaal](AI Daily Intelligence — 2025-01-15.md)

---
*Canoniek feiten dossier en editoriële selectie manifest.*`;

/** Fixture 20: Localized repair introducing regression */
export const fixture20_repairRegression = `# AI Intelligence — woensdag 15 januari 2025

Deze editie belicht ontwikkelingen.

---

### 1. Test AI Lab — Models, Inference & Scientific Research

#### Wat is veranderd
Test AI Lab lanceert Test Model v2 met 15% verbetering. **Nieuwe claim: Model haalt 99% op MMLU.**

#### Waarom dit belangrijk is
Kostenreductie.

#### Bronnen
- https://arxiv.org/abs/2501.12345
**Claim-identificaties:** claim_0000000000000001`;

/** Fixture 21: Semantic quality not deterministically assessable */
export const fixture21_semanticNotDeterministic = `# AI Intelligence — woensdag 15 januari 2025

Deze editie belicht een nuanceerde ontwikkelingslijn waarin de grens tussen product announcement en onderzoek bevinding vervaagt. De interpretatie hangt af van de lezer's achtergrond.

---

### 1. Test AI Lab — Models, Inference & Scientific Research

#### Wat is veranderd
Test AI Lab introduceert Test Model v2.

#### Waarom dit belangrijk is
De betekenis is context-afhankelijk en resisteert binaire classificatie.

#### Hoe het werkt
Een mechanisme dat simultaan technische verbetering en filosofische vraag over intelligentie is.

#### Bronnen
- https://arxiv.org/abs/2501.12345
**Claim-identificaties:** claim_0000000000000001`;

/** Fixture 22: Evaluation interrupted by exhausted free inference */
export const fixture22_inferenceExhausted = `# AI Intelligence — woensdag 15 januari 2025

Deze editie belicht ontwikkelingen.

---

### 1. Test AI Lab — Models, Inference & Scientific Research

#### Wat is veranderd
Test AI Lab lanceert Test Model v2.

#### Waarom dit belangrijk is
Significant.

#### Bronnen
- https://arxiv.org/abs/2501.12345
**Claim-identificaties:** claim_0000000000000001`;

// ============================================================================
// All Fixtures Collections
// ============================================================================

export const allDutchFixtures = [
	fixture1_excellentFirstScreen,
	fixture2_genericOpening,
	fixture3_technicalBeforeContext,
	fixture4_progressiveDisclosure,
	fixture5_superficialScience,
	fixture6_accessibleTechnical,
	fixture7_excessiveAcronyms,
	fixture8_gartnerWithoutLimitations,
	fixture9_forecastAsFact,
	fixture10_vendorBenchmarkAsVerified,
	fixture11_missingSourceLink,
	fixture12_omittedDevelopment,
	fixture13_unsupportedCausal,
	fixture14_misleadingDiagram,
	fixture15_inaccessibleTable,
	fixture16_poorHeadingHierarchy,
	fixture17_contradictoryNumbers,
	fixture18_quietEdition,
	fixture19_multipleMajorDevelopments,
	fixture20_repairRegression,
	fixture21_semanticNotDeterministic,
	fixture22_inferenceExhausted,
];

export const allEnglishFixtures = [
	fixture1_excellentFirstScreen, // Same for now
	fixture2_genericOpening,
	fixture3_technicalBeforeContext,
	fixture4_progressiveDisclosure,
	fixture5_superficialScience,
	fixture6_accessibleTechnical,
	fixture7_excessiveAcronyms,
	fixture8_gartnerWithoutLimitations,
	fixture9_forecastAsFact,
	fixture10_vendorBenchmarkAsVerified,
	fixture11_missingSourceLink,
	fixture12_omittedDevelopment,
	fixture13_unsupportedCausal,
	fixture14_misleadingDiagram,
	fixture15_inaccessibleTable,
	fixture16_poorHeadingHierarchy,
	fixture17_contradictoryNumbers_en,
	fixture18_quietEdition,
	fixture19_multipleMajorDevelopments,
	fixture20_repairRegression,
	fixture21_semanticNotDeterministic,
	fixture22_inferenceExhausted,
];

// ============================================================================
// Mock Input Builders
// ============================================================================

export function createMockInput(
	dutchMarkdown: string,
	englishMarkdown?: string,
	overrides: Partial<ReadableQualityEvaluationInput> = {},
): ReadableQualityEvaluationInput {
	const dossier = createMockDossier();
	const manifest = createMockManifest();
	const traceability = {
		segments: [
			{ type: "opening", claimIds: [], sourceIds: [] },
			{
				type: "story",
				claimIds: ["claim_0000000000000001"],
				sourceIds: ["test-arxiv"],
				storyId: "story_0000000000000001",
			},
			{ type: "navigation", claimIds: [], sourceIds: [] },
		],
		claimCoverage: ["claim_0000000000000001"],
		sourceCoverage: ["test-arxiv"],
		storyCoverage: ["story_0000000000000001"],
	};

	const enTraceability = englishMarkdown
		? {
				segments: [
					{ type: "opening", claimIds: [], sourceIds: [] },
					{
						type: "story",
						claimIds: ["claim_0000000000000001"],
						sourceIds: ["test-arxiv"],
						storyId: "story_0000000000000001",
					},
					{ type: "references", claimIds: [], sourceIds: [] },
				],
				claimCoverage: ["claim_0000000000000001"],
				sourceCoverage: ["test-arxiv"],
				storyCoverage: ["story_0000000000000001"],
			}
		: undefined;

	return {
		editionDate: "2025-01-15",
		editionId: "edition_2025-01-15",
		dutchPublicationMarkdown: dutchMarkdown,
		dutchPublicationArtifactId: "pubart_0000000000000001",
		dutchPublicationTraceability: traceability,
		englishPublicationMarkdown: englishMarkdown,
		englishPublicationArtifactId: englishMarkdown
			? "pubart_0000000000000002"
			: undefined,
		englishPublicationTraceability: enTraceability,
		factDossier: dossier,
		editorialManifest: manifest,
		historicalRegression: createMockHistoricalRegression(),
		publicationMetadata: createMockPublicationMetadata(),
		articleIdentities: createMockArticleIdentities(),
		visualizations: [createMockVisualization()],
		validationMode: true,
		...overrides,
	};
}

// Fixture-specific inputs with customized dossiers/manifests
export function createInputForFixture1(): ReadableQualityEvaluationInput {
	const candidate1 = createMockCandidate({ organizations: ["Test AI Lab"] });
	const candidate2 = createMockCandidate({
		candidateId: "cand_0000000000000002",
		organizations: ["Research Institute"],
		researchDomains: ["architecture-security-governance"],
	});
	const candidate3 = createMockCandidate({
		candidateId: "cand_0000000000000003",
		organizations: ["Enterprise Corp"],
		researchDomains: ["enterprise-adoption-organizational"],
	});

	const assessment1 = createMockAssessment({
		organizations: ["Test AI Lab"],
	});
	const assessment2 = createMockAssessment({
		candidateId: "cand_0000000000000002",
		organizations: ["Research Institute"],
	});
	const assessment3 = createMockAssessment({
		candidateId: "cand_0000000000000003",
		organizations: ["Enterprise Corp"],
	});

	const story1 = createMockStory({
		organizations: ["Test AI Lab"],
		researchDomains: ["models-inference-scientific"],
	});
	const story2 = createMockStory({
		storyId: "story_0000000000000002",
		order: 2,
		organizations: ["Research Institute"],
		researchDomains: ["architecture-security-governance"],
	});
	const story3 = createMockStory({
		storyId: "story_0000000000000003",
		order: 3,
		organizations: ["Enterprise Corp"],
		researchDomains: ["enterprise-adoption-organizational"],
	});

	const dossier = createMockDossier([candidate1, candidate2, candidate3]);
	const manifest = createMockManifest(
		[story1, story2, story3],
		[assessment1, assessment2, assessment3],
	);

	return createMockInput(fixture1_excellentFirstScreen, undefined, {
		factDossier: dossier,
		editorialManifest: manifest,
	});
}

export function createInputForFixture17(): ReadableQualityEvaluationInput {
	const candidate = createMockCandidate({ organizations: ["Test AI Lab"] });
	const assessment = createMockAssessment({ organizations: ["Test AI Lab"] });
	const story = createMockStory({ organizations: ["Test AI Lab"] });

	const dossier = createMockDossier([candidate]);
	const manifest = createMockManifest([story], [assessment]);

	return createMockInput(
		fixture17_contradictoryNumbers,
		fixture17_contradictoryNumbers_en,
		{ factDossier: dossier, editorialManifest: manifest },
	);
}

export function createInputForFixture19(): ReadableQualityEvaluationInput {
	const candidates = [
		createMockCandidate({
			candidateId: "cand_0000000000000001",
			organizations: ["Test AI Lab"],
			researchDomains: ["models-inference-scientific"],
		}),
		createMockCandidate({
			candidateId: "cand_0000000000000002",
			organizations: ["Research Institute"],
			researchDomains: ["architecture-security-governance"],
		}),
		createMockCandidate({
			candidateId: "cand_0000000000000003",
			organizations: ["Gartner"],
			researchDomains: ["economics-business-impact"],
		}),
		createMockCandidate({
			candidateId: "cand_0000000000000004",
			organizations: ["Enterprise Corp"],
			researchDomains: ["enterprise-adoption-organizational"],
		}),
	];

	const assessments = candidates.map((c, i) =>
		createMockAssessment({
			candidateId: c.candidateId,
			organizations: c.organizations,
			researchDomains: c.researchDomains,
		}),
	);

	const stories = candidates.map((c, i) =>
		createMockStory({
			storyId: `story_000000000000000${i + 1}`,
			order: i + 1,
			organizations: c.organizations,
			researchDomains: c.researchDomains,
		}),
	);

	const dossier = createMockDossier(candidates);
	const manifest = createMockManifest(stories, assessments);

	return createMockInput(fixture19_multipleMajorDevelopments, undefined, {
		factDossier: dossier,
		editorialManifest: manifest,
	});
}
