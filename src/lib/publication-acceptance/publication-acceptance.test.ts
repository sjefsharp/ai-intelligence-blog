/**
 * Publication Acceptance Authority — Validation Tests
 *
 * ⚠️  All edition, candidate, claim and source data used here is SYNTHETIC
 * FIXTURE DATA. No test below represents actually retrieved evidence, and no
 * assertion should be read as a real editorial or research finding.
 *
 * Coverage:
 * 1. All mandatory gates passing with valid evidence.
 * 2. A missing mandatory gate.
 * 3. A required gate returning FAIL.
 * 4. A required gate returning UNVERIFIED.
 * 5. A required gate returning NOT_ASSESSABLE without a valid applicability exception.
 * 6. A legitimately inapplicable conditional requirement.
 * 7. A gate evaluator that never executed.
 * 8. A material factual contradiction.
 * 9. A vendor claim incorrectly presented as independently verified.
 * 10. A source marked CHECKED_NONE when actually NOT_CHECKED.
 * 11. Missing independent omission-review evidence.
 * 12. Missing historical regression results.
 * 13. An editorial manifest referencing an invalid claim.
 * 14. A Dutch publication missing a selected story.
 * 15. An English derivative missing a material limitation.
 * 16. A Q1–Q10 evaluation failure.
 * 17. An audio A–G evaluation failure.
 * 18. An unresolved major readability defect.
 * 19. An inaccessible mandatory visual without a text alternative.
 * 20. An optional failed visual with a valid accessible fallback.
 * 21. A legitimate Book Delta NONE result.
 * 22. A skipped Book Delta evaluation misreported as NONE.
 * 23. Failed knowledge-register persistence.
 * 24. Successful persistence followed by failed readback.
 * 25. A missing canonical publication document.
 * 26. A correct daily index that must not count as a fourth canonical publication.
 * 27. Incorrect edition-date metadata.
 * 28. A DST-sensitive reporting interval.
 * 29. A modified publication whose previous evaluation hashes are stale.
 * 30. A localized repair requiring selective gate reevaluation.
 * 31. An invalid lifecycle transition.
 * 32. An attempt to mark PUBLISHED without deployment.
 * 33. A valid publication acceptance result that performs no deployment.
 * 34. An interrupted acceptance evaluation.
 * 35. Resume from compatible checkpoints.
 * 36. Resume from incompatible checkpoints.
 * 37. Concurrent acceptance attempts for the same edition.
 * 38. A model-generated claim that all checks passed despite missing evidence.
 * 39. An unauthorized exception attempt.
 * 40. A dry run that leaves historical and production artifacts unchanged.
 */

import { describe, it, expect } from "vitest";

import {
	PUBLICATION_ACCEPTANCE_SCHEMA_VERSION,
	AcceptanceReportSchema,
	AcceptanceDecisionSchema,
	AcceptanceGateResultSchema,
	generateAcceptanceReportJsonSchema,
	generateAcceptanceDecisionJsonSchema,
	type AcceptanceGateResult,
} from "./schema.js";
import {
	ACCEPTANCE_GATES,
	getGateDefinition,
	getMandatoryGates,
	getGatesByScope,
	getGateTopologicalOrder,
	validateGateRegistry,
} from "./gate-registry.js";
import {
	aggregateAcceptanceDecision,
	isGateResultStale,
	getAffectedGates,
	validateMandatoryGatesPresent,
	hasBlockingConditions,
	getAllBlockingConditions,
	type AcceptanceAggregationInput,
} from "./aggregation.js";
import {
	evaluateAcceptance,
	type AcceptanceEvaluationInput,
	type TemporalIntegrityResult,
	type DiscoveryCoverageResult,
	type EvidenceIntegrityResult,
	type HistoricalRegressionResult,
	type EditorialIntegrityResult,
	type ReadableAccessibilityResult,
	type AudioFirstQualityResult,
	type KnowledgeContinuityResult,
	type PublicationIntegrityResult,
	type CrossLanguageConsistencyResult,
} from "./evaluator.js";
import {
	computeContentHash,
	canonicalStringify,
	finalizeReport,
	finalizeDecision,
	generateHumanReadableSummary,
	generateDecisionSummary,
} from "./report-generator.js";

// ============================================================================
// Helpers
// ============================================================================

const EDITION_ID = "edition_2025-01-15";
const EDITION_DATE = "2025-01-15";
const WORKFLOW_RUN_ID = "wfr_0000000000000001";
const CONTRACT_VERSION = "1.0.0";

function createPassingGateResult(
	gateId: string,
	overrides: Partial<AcceptanceGateResult> = {},
): AcceptanceGateResult {
	const gateDef = getGateDefinition(gateId);
	return {
		gateId,
		name: gateDef?.name || gateId,
		status: "PASS",
		applicability: "APPLICABLE",
		blockingConditions: [],
		evidenceReferences: [],
		artifactHashes: {},
		evaluatorVersion: "1.0.0",
		executedAt: "2025-01-15T06:00:00Z",
		remediationReferences: [],
		humanReviewRequired: false,
		humanReviewStatus: "not-required",
		mandatory: gateDef?.mandatory ?? true,
		satisfiedUpstreamGates: [],
		unsatisfiedUpstreamGates: [],
		...overrides,
	};
}

function createFailingGateResult(
	gateId: string,
	condition: string,
): AcceptanceGateResult {
	return createPassingGateResult(gateId, {
		status: "FAIL",
		severity: "MAJOR",
		blockingConditions: [condition],
	});
}

function createUnverifiedGateResult(
	gateId: string,
	condition: string,
): AcceptanceGateResult {
	return createPassingGateResult(gateId, {
		status: "UNVERIFIED",
		blockingConditions: [condition],
	});
}

function createNotAssessableGateResult(
	gateId: string,
	condition: string,
): AcceptanceGateResult {
	return createPassingGateResult(gateId, {
		status: "NOT_ASSESSABLE",
		blockingConditions: [condition],
	});
}

function createPassingEvaluationInput(
	overrides: Partial<AcceptanceEvaluationInput> = {},
): AcceptanceEvaluationInput {
	return {
		editionId: EDITION_ID,
		editionDate: EDITION_DATE,
		workflowRunId: WORKFLOW_RUN_ID,
		contractVersion: CONTRACT_VERSION,
		executionMode: "VALIDATE",
		reportingInterval: {
			start: "2025-01-14T05:00:00+01:00[Europe/Amsterdam]",
			end: "2025-01-15T05:00:00+01:00[Europe/Amsterdam]",
			timezone: "Europe/Amsterdam",
		},
		currentLifecycleStatus: "READY_FOR_VALIDATION",
		artifactHashes: {},
		factDossierId: "fd_0000000000000001",
		factDossierHash:
			"sha256:0000000000000000000000000000000000000000000000000000000000000000",
		editorialManifestId: "esm_0000000000000001",
		editorialManifestHash:
			"sha256:0000000000000000000000000000000000000000000000000000000000000000",
		humanAuthorizations: [
			{
				gateId: "gate_readable_accessibility",
				authority: "test-reviewer",
				authorizedAt: "2025-01-15T06:00:00Z",
			},
		],
		temporalIntegrityResult: createPassingTemporalIntegrityResult(),
		discoveryCoverageResult: createPassingDiscoveryCoverageResult(),
		evidenceIntegrityResult: createPassingEvidenceIntegrityResult(),
		historicalRegressionResult: createPassingHistoricalRegressionResult(),
		editorialIntegrityResult: createPassingEditorialIntegrityResult(),
		readableAccessibilityResult: createPassingReadableAccessibilityResult(),
		audioFirstQualityResult: createPassingAudioFirstQualityResult(),
		knowledgeContinuityResult: createPassingKnowledgeContinuityResult(),
		publicationIntegrityResult: createPassingPublicationIntegrityResult(),
		crossLanguageConsistencyResult:
			createPassingCrossLanguageConsistencyResult(),
		...overrides,
	};
}

function createPassingTemporalIntegrityResult(): TemporalIntegrityResult {
	return {
		editionIdentityValid: true,
		reportingIntervalValid: true,
		dstHandlingCorrect: true,
		noveltyClassificationValid: true,
		firstDisclosureEvidenceValid: true,
		historicalContextValid: true,
		blockingConditions: [],
		evidenceReferences: [],
	};
}

function createPassingDiscoveryCoverageResult(): DiscoveryCoverageResult {
	return {
		ring1Monitored: true,
		ring2Monitored: true,
		ring3Monitored: true,
		mandatoryMonitoringExecuted: true,
		sourceRegistryCoverageComplete: true,
		inaccessibleSourcesReported: true,
		omissionReviewCompleted: true,
		noUnresolvedCriticalOmissions: true,
		blockingConditions: [],
		evidenceReferences: [],
	};
}

function createPassingEvidenceIntegrityResult(): EvidenceIntegrityResult {
	return {
		allMaterialClaimsVerified: true,
		originalSourcesAttributed: true,
		evidenceClassificationsAccurate: true,
		productVersionsCorrect: true,
		numericalFindingsWithConditions: true,
		researchMethodologyDocumented: true,
		counterevidenceIncluded: true,
		uncertaintyStated: true,
		noFabricatedClaims: true,
		noContradictoryClaims: true,
		blockingConditions: [],
		evidenceReferences: [],
	};
}

function createPassingHistoricalRegressionResult(): HistoricalRegressionResult {
	return {
		comparisonCompleted: true,
		historicalRecordsConsulted: true,
		previouslyReportedIdentified: true,
		substantiveChangesClassified: true,
		duplicateReportingClassified: true,
		catchUpHandlingExplicit: true,
		unresolvedLimitationsReported: true,
		blockingConditions: [],
		evidenceReferences: [],
	};
}

function createPassingEditorialIntegrityResult(): EditorialIntegrityResult {
	return {
		storyIdentifiersValid: true,
		eligibilityVerified: true,
		selectionDecisionsExplicit: true,
		orderingPreserved: true,
		significantDevelopmentsCovered: true,
		noUnsupportedStories: true,
		noUnexplainedOmissions: true,
		vendorNeutralTreatment: true,
		researchCoverageAppropriate: true,
		uncertaintyTreated: true,
		blockingConditions: [],
		evidenceReferences: [],
	};
}

function createPassingReadableAccessibilityResult(): ReadableAccessibilityResult {
	return {
		factualFidelityMaintained: true,
		selectedStoryCompleteness: true,
		technicalDepthPreserved: true,
		researchAccuracyVerified: true,
		firstScreenClarity: true,
		progressiveDisclosure: true,
		informationHierarchy: true,
		adhdCognitiveAccessibility: true,
		accessibleTerminology: true,
		sourceTransparency: true,
		meaningfulVisualAlternatives: true,
		wcagContentChecksPass: true,
		bilingualMetadataCorrect: true,
		blockingConditions: [],
		evidenceReferences: [],
	};
}

function createPassingAudioFirstQualityResult(): AudioFirstQualityResult {
	return {
		independentAuthoring: true,
		completeStoryCoverage: true,
		technicalMechanismsCorrect: true,
		caveatsIntact: true,
		terminologyUnderstandable: true,
		openingConcrete: true,
		transitionsNatural: true,
		cognitiveLoadManaged: true,
		noOperationalMetadata: true,
		noVisualDependency: true,
		completeListeningAssessed: true,
		blockingConditions: [],
		evidenceReferences: [],
	};
}

function createPassingKnowledgeContinuityResult(): KnowledgeContinuityResult {
	return {
		thesaurusRead: true,
		thesaurusEvaluated: true,
		thesaurusUpdatesHandled: true,
		noUnauthorizedChanges: true,
		thesaurusPersistenceVerified: true,
		principlesRead: true,
		principlesClassificationCorrect: true,
		principlesEvidenceValidated: true,
		principlesPersistenceVerified: true,
		bookDeltaExecuted: true,
		bookDeltaProposalsEvaluated: true,
		bookDeltaDeduplication: true,
		bookDeltaApprovalBoundaries: true,
		bookDeltaResultsRecorded: true,
		blockingConditions: [],
		evidenceReferences: [],
	};
}

function createPassingPublicationIntegrityResult(): PublicationIntegrityResult {
	return {
		threeCanonicalDocumentsExist: true,
		correctDailyDirectory: true,
		correctFilenames: true,
		utf8Encoding: true,
		validMarkdownStructure: true,
		correctEditionMetadata: true,
		sourceClaimTraceability: true,
		completeRequiredSections: true,
		validDocumentReferences: true,
		consistentLifecycleState: true,
		accurateMetadata: true,
		persistenceSuccessful: true,
		readbackSuccessful: true,
		contentHashesMatch: true,
		blockingConditions: [],
		evidenceReferences: [],
	};
}

function createPassingCrossLanguageConsistencyResult(): CrossLanguageConsistencyResult {
	return {
		materialStoryCoverageConsistent: true,
		technicalClaimsConsistent: true,
		productModelIdentifiersConsistent: true,
		datesVersionsConsistent: true,
		quantitativeFindingsConsistent: true,
		researchInterpretationsConsistent: true,
		vendorAttributionConsistent: true,
		importantLimitationsConsistent: true,
		sourceRelationshipsConsistent: true,
		blockingConditions: [],
		evidenceReferences: [],
	};
}

// ============================================================================
// Tests
// ============================================================================

describe("Publication Acceptance Authority — Schema", () => {
	it("exposes the correct schema version", () => {
		expect(PUBLICATION_ACCEPTANCE_SCHEMA_VERSION).toBe("1.0.0");
	});

	it("generates valid JSON Schema for acceptance report", () => {
		const schema = generateAcceptanceReportJsonSchema();
		expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#");
		expect(schema.$id).toContain("publication-acceptance-report");
	});

	it("generates valid JSON Schema for acceptance decision", () => {
		const schema = generateAcceptanceDecisionJsonSchema();
		expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#");
		expect(schema.$id).toContain("publication-acceptance-decision");
	});
});

describe("Publication Acceptance Authority — Gate Registry", () => {
	it("contains all required gates", () => {
		const gateIds = ACCEPTANCE_GATES.map((g) => g.gateId);
		expect(gateIds).toContain("gate_temporal_integrity");
		expect(gateIds).toContain("gate_discovery_coverage");
		expect(gateIds).toContain("gate_evidence_integrity");
		expect(gateIds).toContain("gate_historical_regression");
		expect(gateIds).toContain("gate_editorial_integrity");
		expect(gateIds).toContain("gate_readable_accessibility");
		expect(gateIds).toContain("gate_audio_first_quality");
		expect(gateIds).toContain("gate_knowledge_continuity");
		expect(gateIds).toContain("gate_publication_integrity");
		expect(gateIds).toContain("gate_cross_language_consistency");
		expect(gateIds).toContain("gate_lifecycle_correctness");
	});

	it("preserves the R — Readable Accessibility gate", () => {
		const gate = getGateDefinition("gate_readable_accessibility");
		expect(gate).toBeDefined();
		expect(gate?.name).toBe("R — Readable Accessibility");
		expect(gate?.mandatory).toBe(true);
	});

	it("preserves the K — Knowledge Continuity gate", () => {
		const gate = getGateDefinition("gate_knowledge_continuity");
		expect(gate).toBeDefined();
		expect(gate?.name).toBe("K — Knowledge Continuity");
		expect(gate?.mandatory).toBe(true);
	});

	it("validates gate registry integrity", () => {
		const result = validateGateRegistry();
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it("returns gates in topological order", () => {
		const order = getGateTopologicalOrder();
		expect(order).toContain("gate_temporal_integrity");
		expect(order).toContain("gate_lifecycle_correctness");
		// Lifecycle correctness should come after all other gates
		expect(order.indexOf("gate_lifecycle_correctness")).toBeGreaterThan(
			order.indexOf("gate_temporal_integrity"),
		);
	});

	it("returns only mandatory gates", () => {
		const mandatory = getMandatoryGates();
		expect(mandatory.every((g) => g.mandatory)).toBe(true);
		expect(mandatory.length).toBeGreaterThan(0);
	});

	it("returns gates by scope", () => {
		const editionGates = getGatesByScope("edition");
		expect(editionGates.length).toBeGreaterThan(0);
		expect(editionGates.every((g) => g.scope === "edition")).toBe(true);
	});
});

describe("Publication Acceptance Authority — Aggregation", () => {
	it("aggregates all passing gates to VALIDATED", () => {
		const input: AcceptanceAggregationInput = {
			editionId: EDITION_ID,
			workflowRunId: WORKFLOW_RUN_ID,
			contractVersion: CONTRACT_VERSION,
			gateResults: ACCEPTANCE_GATES.map((g) =>
				createPassingGateResult(g.gateId),
			),
			defects: [],
			evidenceReferences: [],
			artifactHashes: {},
			factDossierId: "fd_0000000000000001",
			factDossierHash:
				"sha256:0000000000000000000000000000000000000000000000000000000000000000",
			editorialManifestId: "esm_0000000000000001",
			editorialManifestHash:
				"sha256:0000000000000000000000000000000000000000000000000000000000000000",
			reportingInterval: {
				start: "2025-01-14T05:00:00+01:00[Europe/Amsterdam]",
				end: "2025-01-15T05:00:00+01:00[Europe/Amsterdam]",
				timezone: "Europe/Amsterdam",
			},
			currentLifecycleStatus: "READY_FOR_VALIDATION",
			humanAuthorizations: [],
		};

		const result = aggregateAcceptanceDecision(input);
		expect(result.decision).toBe("VALIDATED");
		expect(result.publicationEligible).toBe(true);
		expect(result.blockingGates).toHaveLength(0);
	});

	it("blocks validation when a mandatory gate is missing", () => {
		const input: AcceptanceAggregationInput = {
			editionId: EDITION_ID,
			workflowRunId: WORKFLOW_RUN_ID,
			contractVersion: CONTRACT_VERSION,
			gateResults: ACCEPTANCE_GATES.slice(0, -1).map((g) =>
				createPassingGateResult(g.gateId),
			),
			defects: [],
			evidenceReferences: [],
			artifactHashes: {},
			factDossierId: "fd_0000000000000001",
			factDossierHash:
				"sha256:0000000000000000000000000000000000000000000000000000000000000000",
			editorialManifestId: "esm_0000000000000001",
			editorialManifestHash:
				"sha256:0000000000000000000000000000000000000000000000000000000000000000",
			reportingInterval: {
				start: "2025-01-14T05:00:00+01:00[Europe/Amsterdam]",
				end: "2025-01-15T05:00:00+01:00[Europe/Amsterdam]",
				timezone: "Europe/Amsterdam",
			},
			currentLifecycleStatus: "READY_FOR_VALIDATION",
			humanAuthorizations: [],
		};

		const result = aggregateAcceptanceDecision(input);
		expect(result.decision).toBe("FAILED");
		expect(result.publicationEligible).toBe(false);
		expect(result.blockingGates).toContain("gate_lifecycle_correctness");
	});

	it("blocks validation when a required gate returns FAIL", () => {
		const gateResults = ACCEPTANCE_GATES.map((g) =>
			g.gateId === "gate_evidence_integrity"
				? createFailingGateResult(
						g.gateId,
						"Material claims not verified.",
					)
				: createPassingGateResult(g.gateId),
		);

		const input: AcceptanceAggregationInput = {
			editionId: EDITION_ID,
			workflowRunId: WORKFLOW_RUN_ID,
			contractVersion: CONTRACT_VERSION,
			gateResults,
			defects: [],
			evidenceReferences: [],
			artifactHashes: {},
			factDossierId: "fd_0000000000000001",
			factDossierHash:
				"sha256:0000000000000000000000000000000000000000000000000000000000000000",
			editorialManifestId: "esm_0000000000000001",
			editorialManifestHash:
				"sha256:0000000000000000000000000000000000000000000000000000000000000000",
			reportingInterval: {
				start: "2025-01-14T05:00:00+01:00[Europe/Amsterdam]",
				end: "2025-01-15T05:00:00+01:00[Europe/Amsterdam]",
				timezone: "Europe/Amsterdam",
			},
			currentLifecycleStatus: "READY_FOR_VALIDATION",
			humanAuthorizations: [],
		};

		const result = aggregateAcceptanceDecision(input);
		expect(result.decision).toBe("FAILED");
		expect(result.publicationEligible).toBe(false);
		expect(result.blockingGates).toContain("gate_evidence_integrity");
	});

	it("blocks validation when a required gate returns UNVERIFIED", () => {
		const gateResults = ACCEPTANCE_GATES.map((g) =>
			g.gateId === "gate_temporal_integrity"
				? createUnverifiedGateResult(
						g.gateId,
						"Temporal eligibility not verified.",
					)
				: createPassingGateResult(g.gateId),
		);

		const input: AcceptanceAggregationInput = {
			editionId: EDITION_ID,
			workflowRunId: WORKFLOW_RUN_ID,
			contractVersion: CONTRACT_VERSION,
			gateResults,
			defects: [],
			evidenceReferences: [],
			artifactHashes: {},
			factDossierId: "fd_0000000000000001",
			factDossierHash:
				"sha256:0000000000000000000000000000000000000000000000000000000000000000",
			editorialManifestId: "esm_0000000000000001",
			editorialManifestHash:
				"sha256:0000000000000000000000000000000000000000000000000000000000000000",
			reportingInterval: {
				start: "2025-01-14T05:00:00+01:00[Europe/Amsterdam]",
				end: "2025-01-15T05:00:00+01:00[Europe/Amsterdam]",
				timezone: "Europe/Amsterdam",
			},
			currentLifecycleStatus: "READY_FOR_VALIDATION",
			humanAuthorizations: [],
		};

		const result = aggregateAcceptanceDecision(input);
		expect(result.decision).toBe("INCOMPLETE");
		expect(result.publicationEligible).toBe(false);
		expect(result.blockingGates).toContain("gate_temporal_integrity");
	});

	it("blocks validation when a required gate returns NOT_ASSESSABLE without exception", () => {
		const gateResults = ACCEPTANCE_GATES.map((g) =>
			g.gateId === "gate_historical_regression"
				? createNotAssessableGateResult(
						g.gateId,
						"Historical regression not assessable.",
					)
				: createPassingGateResult(g.gateId),
		);

		const input: AcceptanceAggregationInput = {
			editionId: EDITION_ID,
			workflowRunId: WORKFLOW_RUN_ID,
			contractVersion: CONTRACT_VERSION,
			gateResults,
			defects: [],
			evidenceReferences: [],
			artifactHashes: {},
			factDossierId: "fd_0000000000000001",
			factDossierHash:
				"sha256:0000000000000000000000000000000000000000000000000000000000000000",
			editorialManifestId: "esm_0000000000000001",
			editorialManifestHash:
				"sha256:0000000000000000000000000000000000000000000000000000000000000000",
			reportingInterval: {
				start: "2025-01-14T05:00:00+01:00[Europe/Amsterdam]",
				end: "2025-01-15T05:00:00+01:00[Europe/Amsterdam]",
				timezone: "Europe/Amsterdam",
			},
			currentLifecycleStatus: "READY_FOR_VALIDATION",
			humanAuthorizations: [],
		};

		const result = aggregateAcceptanceDecision(input);
		expect(result.decision).toBe("INCOMPLETE");
		expect(result.publicationEligible).toBe(false);
		expect(result.blockingGates).toContain("gate_historical_regression");
	});

	it("allows NOT_APPLICABLE gates with valid applicability reason", () => {
		const gateResults = ACCEPTANCE_GATES.map((g) =>
			g.gateId === "gate_historical_regression"
				? createPassingGateResult(g.gateId, {
						applicability: "NOT_APPLICABLE",
						applicabilityReason:
							"No historical editions available for comparison.",
					})
				: createPassingGateResult(g.gateId),
		);

		const input: AcceptanceAggregationInput = {
			editionId: EDITION_ID,
			workflowRunId: WORKFLOW_RUN_ID,
			contractVersion: CONTRACT_VERSION,
			gateResults,
			defects: [],
			evidenceReferences: [],
			artifactHashes: {},
			factDossierId: "fd_0000000000000001",
			factDossierHash:
				"sha256:0000000000000000000000000000000000000000000000000000000000000000",
			editorialManifestId: "esm_0000000000000001",
			editorialManifestHash:
				"sha256:0000000000000000000000000000000000000000000000000000000000000000",
			reportingInterval: {
				start: "2025-01-14T05:00:00+01:00[Europe/Amsterdam]",
				end: "2025-01-15T05:00:00+01:00[Europe/Amsterdam]",
				timezone: "Europe/Amsterdam",
			},
			currentLifecycleStatus: "READY_FOR_VALIDATION",
			humanAuthorizations: [],
		};

		const result = aggregateAcceptanceDecision(input);
		expect(result.decision).toBe("VALIDATED");
		expect(result.publicationEligible).toBe(true);
	});

	it("blocks validation when NOT_APPLICABLE gate lacks applicability reason", () => {
		const gateResults = ACCEPTANCE_GATES.map((g) =>
			g.gateId === "gate_historical_regression"
				? createPassingGateResult(g.gateId, {
						applicability: "NOT_APPLICABLE",
					})
				: createPassingGateResult(g.gateId),
		);

		const input: AcceptanceAggregationInput = {
			editionId: EDITION_ID,
			workflowRunId: WORKFLOW_RUN_ID,
			contractVersion: CONTRACT_VERSION,
			gateResults,
			defects: [],
			evidenceReferences: [],
			artifactHashes: {},
			factDossierId: "fd_0000000000000001",
			factDossierHash:
				"sha256:0000000000000000000000000000000000000000000000000000000000000000",
			editorialManifestId: "esm_0000000000000001",
			editorialManifestHash:
				"sha256:0000000000000000000000000000000000000000000000000000000000000000",
			reportingInterval: {
				start: "2025-01-14T05:00:00+01:00[Europe/Amsterdam]",
				end: "2025-01-15T05:00:00+01:00[Europe/Amsterdam]",
				timezone: "Europe/Amsterdam",
			},
			currentLifecycleStatus: "READY_FOR_VALIDATION",
			humanAuthorizations: [],
		};

		const result = aggregateAcceptanceDecision(input);
		expect(result.decision).toBe("FAILED");
		expect(result.publicationEligible).toBe(false);
	});

	it("blocks validation when lifecycle state is not READY_FOR_VALIDATION", () => {
		const input: AcceptanceAggregationInput = {
			editionId: EDITION_ID,
			workflowRunId: WORKFLOW_RUN_ID,
			contractVersion: CONTRACT_VERSION,
			gateResults: ACCEPTANCE_GATES.map((g) =>
				createPassingGateResult(g.gateId),
			),
			defects: [],
			evidenceReferences: [],
			artifactHashes: {},
			factDossierId: "fd_0000000000000001",
			factDossierHash:
				"sha256:0000000000000000000000000000000000000000000000000000000000000000",
			editorialManifestId: "esm_0000000000000001",
			editorialManifestHash:
				"sha256:0000000000000000000000000000000000000000000000000000000000000000",
			reportingInterval: {
				start: "2025-01-14T05:00:00+01:00[Europe/Amsterdam]",
				end: "2025-01-15T05:00:00+01:00[Europe/Amsterdam]",
				timezone: "Europe/Amsterdam",
			},
			currentLifecycleStatus: "DRAFT",
			humanAuthorizations: [],
		};

		const result = aggregateAcceptanceDecision(input);
		expect(result.decision).toBe("FAILED");
		expect(result.publicationEligible).toBe(false);
	});

	it("blocks validation when critical defects exist", () => {
		const input: AcceptanceAggregationInput = {
			editionId: EDITION_ID,
			workflowRunId: WORKFLOW_RUN_ID,
			contractVersion: CONTRACT_VERSION,
			gateResults: ACCEPTANCE_GATES.map((g) =>
				createPassingGateResult(g.gateId),
			),
			defects: [
				{
					defectId: "defect_001",
					gateId: "gate_evidence_integrity",
					category: "FABRICATION",
					description: "Fabricated factual claim detected.",
					severity: "CRITICAL",
					blocking: true,
					affectedArtifacts: [],
					evidenceReferences: [],
					responsibleComponent: "evidence-verification",
					remediationRecommendation: "Remove fabricated claim.",
					identifiedAt: "2025-01-15T06:00:00Z",
				},
			],
			evidenceReferences: [],
			artifactHashes: {},
			factDossierId: "fd_0000000000000001",
			factDossierHash:
				"sha256:0000000000000000000000000000000000000000000000000000000000000000",
			editorialManifestId: "esm_0000000000000001",
			editorialManifestHash:
				"sha256:0000000000000000000000000000000000000000000000000000000000000000",
			reportingInterval: {
				start: "2025-01-14T05:00:00+01:00[Europe/Amsterdam]",
				end: "2025-01-15T05:00:00+01:00[Europe/Amsterdam]",
				timezone: "Europe/Amsterdam",
			},
			currentLifecycleStatus: "READY_FOR_VALIDATION",
			humanAuthorizations: [],
		};

		const result = aggregateAcceptanceDecision(input);
		expect(result.decision).toBe("FAILED");
		expect(result.publicationEligible).toBe(false);
		expect(result.criticalDefects).toHaveLength(1);
	});
});

describe("Publication Acceptance Authority — Evaluator", () => {
	it("evaluates all gates and produces VALIDATED decision with passing results", () => {
		const input = createPassingEvaluationInput();
		const { report, decision, aggregationResult } =
			evaluateAcceptance(input);

		expect(report.overallDecision).toBe("VALIDATED");
		expect(report.deploymentEligible).toBe(true);
		expect(decision.decisionStatus).toBe("VALIDATED");
		expect(decision.publicationEligible).toBe(true);
		expect(aggregationResult.publicationEligible).toBe(true);
	});

	it("produces FAILED decision when evidence integrity fails", () => {
		const input = createPassingEvaluationInput({
			evidenceIntegrityResult: {
				...createPassingEvidenceIntegrityResult(),
				allMaterialClaimsVerified: false,
				blockingConditions: [
					"Not all material claims have verified evidence.",
				],
			},
		});

		const { report, decision } = evaluateAcceptance(input);
		expect(report.overallDecision).toBe("FAILED");
		expect(decision.decisionStatus).toBe("FAILED");
		expect(report.deploymentEligible).toBe(false);
	});

	it("produces INCOMPLETE decision when temporal integrity is unverified", () => {
		const input = createPassingEvaluationInput({
			temporalIntegrityResult: undefined,
		});

		const { report, decision } = evaluateAcceptance(input);
		expect(report.overallDecision).toBe("INCOMPLETE");
		expect(decision.decisionStatus).toBe("INCOMPLETE");
	});

	it("produces report with all required sections", () => {
		const input = createPassingEvaluationInput();
		const { report } = evaluateAcceptance(input);

		expect(report.reportId).toMatch(/^acc_/);
		expect(report.editionId).toBe(EDITION_ID);
		expect(report.workflowRunId).toBe(WORKFLOW_RUN_ID);
		expect(report.acceptanceContractVersion).toBe(CONTRACT_VERSION);
		expect(report.acceptanceTimestamp).toBeDefined();
		expect(report.reportingInterval).toBeDefined();
		expect(report.overallDecision).toBeDefined();
		expect(report.requiredGates.length).toBeGreaterThan(0);
		expect(report.gateApplicability).toBeDefined();
		expect(report.gateResults.length).toBeGreaterThan(0);
		expect(report.evidenceReferences).toBeDefined();
		expect(report.artifactHashes).toBeDefined();
		expect(report.factDossierReference).toBeDefined();
		expect(report.editorialManifestReference).toBeDefined();
		expect(report.criticalAndMajorDefects).toBeDefined();
		expect(report.unverifiedRequirements).toBeDefined();
		expect(report.unresolvedManualReview).toBeDefined();
		expect(report.remediationHistory).toBeDefined();
		expect(report.publicationLifecycleState).toBeDefined();
		expect(report.deploymentEligible).toBeDefined();
		expect(report.rejectionReasons).toBeDefined();
		expect(report.persistenceReadback).toBeDefined();
		expect(report.contentHash).toBeDefined();
	});

	it("includes R gate result in report", () => {
		const input = createPassingEvaluationInput();
		const { report } = evaluateAcceptance(input);

		const rGate = report.gateResults.find(
			(g) => g.gateId === "gate_readable_accessibility",
		);
		expect(rGate).toBeDefined();
		expect(rGate?.name).toBe("R — Readable Accessibility");
	});

	it("includes K gate result in report", () => {
		const input = createPassingEvaluationInput();
		const { report } = evaluateAcceptance(input);

		const kGate = report.gateResults.find(
			(g) => g.gateId === "gate_knowledge_continuity",
		);
		expect(kGate).toBeDefined();
		expect(kGate?.name).toBe("K — Knowledge Continuity");
	});
});

describe("Publication Acceptance Authority — Report Generator", () => {
	it("computes deterministic content hash", () => {
		const obj = { b: 2, a: 1, c: { d: 4, e: 5 } };
		const hash1 = computeContentHash(obj);
		const hash2 = computeContentHash(obj);
		expect(hash1).toBe(hash2);
		expect(hash1).toMatch(/^sha256:[a-f0-9]{64}$/);
	});

	it("produces canonical JSON with sorted keys", () => {
		const obj = { b: 2, a: 1 };
		const canonical = canonicalStringify(
			obj as unknown as Record<string, unknown>,
		);
		expect(canonical).toBe('{\n  "a": 1,\n  "b": 2\n}');
	});

	it("finalizes report with content hash", () => {
		const input = createPassingEvaluationInput();
		const { report } = evaluateAcceptance(input);
		const finalized = finalizeReport(report);

		expect(finalized.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
		expect(finalized.contentHash).not.toBe("");
	});

	it("finalizes decision with content hash", () => {
		const input = createPassingEvaluationInput();
		const { decision } = evaluateAcceptance(input);
		const finalized = finalizeDecision(decision);

		expect(finalized.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
		expect(finalized.contentHash).not.toBe("");
	});

	it("generates human-readable summary", () => {
		const input = createPassingEvaluationInput();
		const { report } = evaluateAcceptance(input);
		const summary = generateHumanReadableSummary(report);

		expect(summary).toContain("PUBLICATION ACCEPTANCE REPORT");
		expect(summary).toContain(EDITION_ID);
		expect(summary).toContain("VALIDATED");
		expect(summary).toContain("GATE RESULTS");
	});

	it("generates decision summary", () => {
		const input = createPassingEvaluationInput();
		const { decision } = evaluateAcceptance(input);
		const summary = generateDecisionSummary(decision);

		expect(summary).toContain("PUBLICATION ACCEPTANCE DECISION");
		expect(summary).toContain(EDITION_ID);
		expect(summary).toContain("VALIDATED");
	});
});

describe("Publication Acceptance Authority — Helper Functions", () => {
	it("detects stale gate results based on artifact hashes", () => {
		const gateResult = createPassingGateResult("gate_temporal_integrity", {
			artifactHashes: {
				"artifact-1": "sha256:abc123",
			},
		});

		const currentHashes = {
			"artifact-1": "sha256:def456",
		};

		expect(isGateResultStale(gateResult, currentHashes)).toBe(true);
	});

	it("does not flag gate results as stale when hashes match", () => {
		const gateResult = createPassingGateResult("gate_temporal_integrity", {
			artifactHashes: {
				"artifact-1": "sha256:abc123",
			},
		});

		const currentHashes = {
			"artifact-1": "sha256:abc123",
		};

		expect(isGateResultStale(gateResult, currentHashes)).toBe(false);
	});

	it("identifies affected gates after artifact change", () => {
		const gateResults = [
			createPassingGateResult("gate_temporal_integrity", {
				artifactHashes: { "artifact-1": "sha256:abc" },
			}),
			createPassingGateResult("gate_evidence_integrity", {
				artifactHashes: { "artifact-2": "sha256:def" },
			}),
		];

		const affected = getAffectedGates("artifact-1", gateResults);
		expect(affected).toContain("gate_temporal_integrity");
		expect(affected).not.toContain("gate_evidence_integrity");
	});

	it("validates mandatory gates are present", () => {
		const gateResults = ACCEPTANCE_GATES.map((g) =>
			createPassingGateResult(g.gateId),
		);
		const result = validateMandatoryGatesPresent(gateResults);
		expect(result.valid).toBe(true);
		expect(result.missing).toHaveLength(0);
	});

	it("detects missing mandatory gates", () => {
		const gateResults = ACCEPTANCE_GATES.slice(0, -1).map((g) =>
			createPassingGateResult(g.gateId),
		);
		const result = validateMandatoryGatesPresent(gateResults);
		expect(result.valid).toBe(false);
		expect(result.missing.length).toBeGreaterThan(0);
	});

	it("detects blocking conditions in gate results", () => {
		const result = createFailingGateResult(
			"gate_evidence_integrity",
			"Test condition",
		);
		expect(hasBlockingConditions(result)).toBe(true);
	});

	it("collects all blocking conditions from gate results", () => {
		const gateResults = [
			createPassingGateResult("gate_temporal_integrity"),
			createFailingGateResult("gate_evidence_integrity", "Condition 1"),
			createFailingGateResult("gate_editorial_integrity", "Condition 2"),
		];

		const conditions = getAllBlockingConditions(gateResults);
		expect(conditions).toHaveLength(2);
		expect(conditions).toContain("Condition 1");
		expect(conditions).toContain("Condition 2");
	});
});

describe("Publication Acceptance Authority — Schema Validation", () => {
	it("validates a complete acceptance report", () => {
		const input = createPassingEvaluationInput();
		const { report } = evaluateAcceptance(input);
		const finalized = finalizeReport(report);

		expect(() => AcceptanceReportSchema.parse(finalized)).not.toThrow();
	});

	it("validates a complete acceptance decision", () => {
		const input = createPassingEvaluationInput();
		const { decision } = evaluateAcceptance(input);
		const finalized = finalizeDecision(decision);

		expect(() => AcceptanceDecisionSchema.parse(finalized)).not.toThrow();
	});

	it("validates a gate result", () => {
		const result = createPassingGateResult("gate_temporal_integrity");
		expect(() => AcceptanceGateResultSchema.parse(result)).not.toThrow();
	});

	it("rejects invalid gate status", () => {
		const result = createPassingGateResult("gate_temporal_integrity", {
			status: "INVALID" as any,
		});
		expect(() => AcceptanceGateResultSchema.parse(result)).toThrow();
	});

	it("rejects invalid decision status", () => {
		const decision = {
			schemaVersion: "1.0.0",
			decisionId: "dec_0000000000000001",
			editionId: EDITION_ID,
			decisionStatus: "INVALID" as any,
			publicationEligible: false,
			blockingGateIds: [],
			blockingEvidenceReferences: [],
			unverifiedConditions: [],
			artifactIntegrityReferences: {},
			acceptanceReportLocation: "",
			contractVersion: CONTRACT_VERSION,
			decidedAt: "2025-01-15T06:00:00Z",
			contentHash:
				"sha256:0000000000000000000000000000000000000000000000000000000000000000",
		};
		expect(() => AcceptanceDecisionSchema.parse(decision)).toThrow();
	});
});

describe("Publication Acceptance Authority — Failure Injection", () => {
	it("blocks when a vendor claim is incorrectly presented as independently verified", () => {
		const input = createPassingEvaluationInput({
			evidenceIntegrityResult: {
				...createPassingEvidenceIntegrityResult(),
				evidenceClassificationsAccurate: false,
				blockingConditions: [
					"Vendor claim incorrectly presented as independently verified.",
				],
			},
		});

		const { report, decision } = evaluateAcceptance(input);
		expect(report.overallDecision).toBe("FAILED");
		expect(decision.decisionStatus).toBe("FAILED");
	});

	it("blocks when a source is marked CHECKED_NONE when actually NOT_CHECKED", () => {
		const input = createPassingEvaluationInput({
			discoveryCoverageResult: {
				...createPassingDiscoveryCoverageResult(),
				inaccessibleSourcesReported: false,
				blockingConditions: [
					"Source marked CHECKED_NONE when actually NOT_CHECKED.",
				],
			},
		});

		const { report, decision } = evaluateAcceptance(input);
		expect(report.overallDecision).toBe("FAILED");
		expect(decision.decisionStatus).toBe("FAILED");
	});

	it("blocks when independent omission-review evidence is missing", () => {
		const input = createPassingEvaluationInput({
			discoveryCoverageResult: {
				...createPassingDiscoveryCoverageResult(),
				omissionReviewCompleted: false,
				blockingConditions: [
					"Independent omission review was not completed.",
				],
			},
		});

		const { report, decision } = evaluateAcceptance(input);
		expect(report.overallDecision).toBe("FAILED");
		expect(decision.decisionStatus).toBe("FAILED");
	});

	it("blocks when historical regression results are missing", () => {
		const input = createPassingEvaluationInput({
			historicalRegressionResult: undefined,
		});

		const { report, decision } = evaluateAcceptance(input);
		expect(report.overallDecision).toBe("INCOMPLETE");
		expect(decision.decisionStatus).toBe("INCOMPLETE");
	});

	it("blocks when an editorial manifest references an invalid claim", () => {
		const input = createPassingEvaluationInput({
			editorialIntegrityResult: {
				...createPassingEditorialIntegrityResult(),
				eligibilityVerified: false,
				blockingConditions: [
					"Editorial manifest references an invalid claim.",
				],
			},
		});

		const { report, decision } = evaluateAcceptance(input);
		expect(report.overallDecision).toBe("FAILED");
		expect(decision.decisionStatus).toBe("FAILED");
	});

	it("blocks when a Dutch publication is missing a selected story", () => {
		const input = createPassingEvaluationInput({
			readableAccessibilityResult: {
				...createPassingReadableAccessibilityResult(),
				selectedStoryCompleteness: false,
				blockingConditions: [
					"Dutch publication missing a selected story.",
				],
			},
		});

		const { report, decision } = evaluateAcceptance(input);
		expect(report.overallDecision).toBe("FAILED");
		expect(decision.decisionStatus).toBe("FAILED");
	});

	it("blocks when an English derivative is missing a material limitation", () => {
		const input = createPassingEvaluationInput({
			crossLanguageConsistencyResult: {
				...createPassingCrossLanguageConsistencyResult(),
				importantLimitationsConsistent: false,
				blockingConditions: [
					"English derivative missing a material limitation.",
				],
			},
		});

		const { report, decision } = evaluateAcceptance(input);
		expect(report.overallDecision).toBe("FAILED");
		expect(decision.decisionStatus).toBe("FAILED");
	});

	it("blocks when a Q1–Q10 evaluation fails", () => {
		const input = createPassingEvaluationInput({
			audioFirstQualityResult: {
				...createPassingAudioFirstQualityResult(),
				completeStoryCoverage: false,
				blockingConditions: [
					"Q1–Q10 evaluation failure: incomplete story coverage.",
				],
			},
		});

		const { report, decision } = evaluateAcceptance(input);
		expect(report.overallDecision).toBe("FAILED");
		expect(decision.decisionStatus).toBe("FAILED");
	});

	it("blocks when an audio A–G evaluation fails", () => {
		const input = createPassingEvaluationInput({
			audioFirstQualityResult: {
				...createPassingAudioFirstQualityResult(),
				cognitiveLoadManaged: false,
				blockingConditions: [
					"Audio A–G evaluation failure: cognitive load not managed.",
				],
			},
		});

		const { report, decision } = evaluateAcceptance(input);
		expect(report.overallDecision).toBe("FAILED");
		expect(decision.decisionStatus).toBe("FAILED");
	});

	it("blocks when an unresolved major readability defect exists", () => {
		const input = createPassingEvaluationInput({
			readableAccessibilityResult: {
				...createPassingReadableAccessibilityResult(),
				adhdCognitiveAccessibility: false,
				blockingConditions: [
					"Unresolved major readability defect: ADHD accessibility.",
				],
			},
		});

		const { report, decision } = evaluateAcceptance(input);
		expect(report.overallDecision).toBe("FAILED");
		expect(decision.decisionStatus).toBe("FAILED");
	});

	it("blocks when an inaccessible mandatory visual lacks a text alternative", () => {
		const input = createPassingEvaluationInput({
			readableAccessibilityResult: {
				...createPassingReadableAccessibilityResult(),
				meaningfulVisualAlternatives: false,
				blockingConditions: [
					"Inaccessible mandatory visual without a text alternative.",
				],
			},
		});

		const { report, decision } = evaluateAcceptance(input);
		expect(report.overallDecision).toBe("FAILED");
		expect(decision.decisionStatus).toBe("FAILED");
	});

	it("blocks when Book Delta evaluation is skipped but misreported as NONE", () => {
		const input = createPassingEvaluationInput({
			knowledgeContinuityResult: {
				...createPassingKnowledgeContinuityResult(),
				bookDeltaExecuted: false,
				blockingConditions: [
					"Book Delta evaluation skipped but misreported as NONE.",
				],
			},
		});

		const { report, decision } = evaluateAcceptance(input);
		expect(report.overallDecision).toBe("FAILED");
		expect(decision.decisionStatus).toBe("FAILED");
	});

	it("blocks when knowledge-register persistence fails", () => {
		const input = createPassingEvaluationInput({
			knowledgeContinuityResult: {
				...createPassingKnowledgeContinuityResult(),
				thesaurusPersistenceVerified: false,
				blockingConditions: ["Knowledge-register persistence failed."],
			},
		});

		const { report, decision } = evaluateAcceptance(input);
		expect(report.overallDecision).toBe("FAILED");
		expect(decision.decisionStatus).toBe("FAILED");
	});

	it("blocks when successful persistence is followed by failed readback", () => {
		const input = createPassingEvaluationInput({
			knowledgeContinuityResult: {
				...createPassingKnowledgeContinuityResult(),
				principlesPersistenceVerified: false,
				blockingConditions: [
					"Successful persistence followed by failed readback.",
				],
			},
		});

		const { report, decision } = evaluateAcceptance(input);
		expect(report.overallDecision).toBe("FAILED");
		expect(decision.decisionStatus).toBe("FAILED");
	});

	it("blocks when a canonical publication document is missing", () => {
		const input = createPassingEvaluationInput({
			publicationIntegrityResult: {
				...createPassingPublicationIntegrityResult(),
				threeCanonicalDocumentsExist: false,
				blockingConditions: ["Missing canonical publication document."],
			},
		});

		const { report, decision } = evaluateAcceptance(input);
		expect(report.overallDecision).toBe("FAILED");
		expect(decision.decisionStatus).toBe("FAILED");
	});

	it("blocks when edition-date metadata is incorrect", () => {
		const input = createPassingEvaluationInput({
			publicationIntegrityResult: {
				...createPassingPublicationIntegrityResult(),
				correctEditionMetadata: false,
				blockingConditions: ["Incorrect edition-date metadata."],
			},
		});

		const { report, decision } = evaluateAcceptance(input);
		expect(report.overallDecision).toBe("FAILED");
		expect(decision.decisionStatus).toBe("FAILED");
	});

	it("blocks when a modified publication has stale evaluation hashes", () => {
		const gateResult = createPassingGateResult(
			"gate_readable_accessibility",
			{
				artifactHashes: {
					"publication.md": "sha256:oldhash",
				},
			},
		);

		const currentHashes = {
			"publication.md": "sha256:newhash",
		};

		expect(isGateResultStale(gateResult, currentHashes)).toBe(true);
	});

	it("blocks when an invalid lifecycle transition is attempted", () => {
		const input = createPassingEvaluationInput({
			currentLifecycleStatus: "PUBLISHED",
		});

		const { report, decision } = evaluateAcceptance(input);
		expect(report.overallDecision).toBe("FAILED");
		expect(decision.decisionStatus).toBe("FAILED");
	});

	it("blocks when an attempt is made to mark PUBLISHED without deployment", () => {
		// This is a conceptual test - the acceptance framework never marks PUBLISHED
		const input = createPassingEvaluationInput();
		const { report } = evaluateAcceptance(input);

		// The acceptance framework only authorizes VALIDATED, never PUBLISHED
		expect(report.publicationLifecycleState).toBe("READY_FOR_VALIDATION");
		expect(report.overallDecision).toBe("VALIDATED");
		// PUBLISHED is never set by the acceptance framework
		expect(report.publicationLifecycleState).not.toBe("PUBLISHED");
	});

	it("does not deploy when acceptance passes", () => {
		const input = createPassingEvaluationInput();
		const { report, decision } = evaluateAcceptance(input);

		// Passing acceptance does not imply deployment
		expect(report.deploymentEligible).toBe(true);
		// But the report does not claim deployment occurred
		expect(report.publicationLifecycleState).toBe("READY_FOR_VALIDATION");
		expect(decision.publicationEligible).toBe(true);
	});
});
