/**
 * Publication Acceptance Authority — Evaluator
 *
 * Integrates the acceptance framework with existing evaluation modules.
 * Evaluates each gate by consuming structured evaluation results from the
 * existing Q1-Q10, Audio A-G, readable quality, knowledge continuity, and
 * other evaluation components.
 *
 * The evaluator does NOT reimplement upstream research, editing, generation
 * or deployment. It consumes existing evaluation evidence and applies
 * deterministic acceptance rules.
 */

import {
	type AcceptanceGateResult,
	type AcceptanceDefect,
	type AcceptanceGateStatus,
	type AcceptanceSeverity,
	type AcceptanceReport,
	type AcceptanceDecision,
	type AcceptanceGateDefinition,
	PUBLICATION_ACCEPTANCE_SCHEMA_VERSION,
} from "./schema.js";
import { ACCEPTANCE_GATES } from "./gate-registry.js";
import {
	aggregateAcceptanceDecision,
	createAcceptanceDecision,
	type AcceptanceAggregationInput,
	type AcceptanceAggregationResult,
} from "./aggregation.js";

// ============================================================================
// Evaluation Input Types
// ============================================================================

/**
 * Input to the acceptance evaluator.
 * Consumes existing evaluation results from upstream components.
 */
export interface AcceptanceEvaluationInput {
	editionId: string;
	editionDate: string;
	workflowRunId: string;
	contractVersion: string;
	executionMode: "PLAN" | "VALIDATE" | "DRY_RUN" | "RESUME" | "EXECUTE";

	// Reporting interval
	reportingInterval: {
		start: string;
		end: string;
		timezone: "Europe/Amsterdam";
	};

	// Current lifecycle status
	currentLifecycleStatus: string;

	// Existing evaluation results
	temporalIntegrityResult?: TemporalIntegrityResult;
	discoveryCoverageResult?: DiscoveryCoverageResult;
	evidenceIntegrityResult?: EvidenceIntegrityResult;
	historicalRegressionResult?: HistoricalRegressionResult;
	editorialIntegrityResult?: EditorialIntegrityResult;
	readableAccessibilityResult?: ReadableAccessibilityResult;
	audioFirstQualityResult?: AudioFirstQualityResult;
	knowledgeContinuityResult?: KnowledgeContinuityResult;
	publicationIntegrityResult?: PublicationIntegrityResult;
	crossLanguageConsistencyResult?: CrossLanguageConsistencyResult;

	// Artifact hashes
	artifactHashes: Record<string, string>;

	// References
	factDossierId: string;
	factDossierHash: string;
	editorialManifestId: string;
	editorialManifestHash: string;

	// Human authorizations
	humanAuthorizations: Array<{
		gateId: string;
		authority: string;
		authorizedAt: string;
	}>;
}

// ============================================================================
// Individual Gate Result Types (consuming existing evaluation results)
// ============================================================================

export interface TemporalIntegrityResult {
	editionIdentityValid: boolean;
	reportingIntervalValid: boolean;
	dstHandlingCorrect: boolean;
	noveltyClassificationValid: boolean;
	firstDisclosureEvidenceValid: boolean;
	historicalContextValid: boolean;
	blockingConditions: string[];
	evidenceReferences: string[];
}

export interface DiscoveryCoverageResult {
	ring1Monitored: boolean;
	ring2Monitored: boolean;
	ring3Monitored: boolean;
	mandatoryMonitoringExecuted: boolean;
	sourceRegistryCoverageComplete: boolean;
	inaccessibleSourcesReported: boolean;
	omissionReviewCompleted: boolean;
	noUnresolvedCriticalOmissions: boolean;
	blockingConditions: string[];
	evidenceReferences: string[];
}

export interface EvidenceIntegrityResult {
	allMaterialClaimsVerified: boolean;
	originalSourcesAttributed: boolean;
	evidenceClassificationsAccurate: boolean;
	productVersionsCorrect: boolean;
	numericalFindingsWithConditions: boolean;
	researchMethodologyDocumented: boolean;
	counterevidenceIncluded: boolean;
	uncertaintyStated: boolean;
	noFabricatedClaims: boolean;
	noContradictoryClaims: boolean;
	blockingConditions: string[];
	evidenceReferences: string[];
}

export interface HistoricalRegressionResult {
	comparisonCompleted: boolean;
	historicalRecordsConsulted: boolean;
	previouslyReportedIdentified: boolean;
	substantiveChangesClassified: boolean;
	duplicateReportingClassified: boolean;
	catchUpHandlingExplicit: boolean;
	unresolvedLimitationsReported: boolean;
	blockingConditions: string[];
	evidenceReferences: string[];
}

export interface EditorialIntegrityResult {
	storyIdentifiersValid: boolean;
	eligibilityVerified: boolean;
	selectionDecisionsExplicit: boolean;
	orderingPreserved: boolean;
	significantDevelopmentsCovered: boolean;
	noUnsupportedStories: boolean;
	noUnexplainedOmissions: boolean;
	vendorNeutralTreatment: boolean;
	researchCoverageAppropriate: boolean;
	uncertaintyTreated: boolean;
	blockingConditions: string[];
	evidenceReferences: string[];
}

export interface ReadableAccessibilityResult {
	factualFidelityMaintained: boolean;
	selectedStoryCompleteness: boolean;
	technicalDepthPreserved: boolean;
	researchAccuracyVerified: boolean;
	firstScreenClarity: boolean;
	progressiveDisclosure: boolean;
	informationHierarchy: boolean;
	adhdCognitiveAccessibility: boolean;
	accessibleTerminology: boolean;
	sourceTransparency: boolean;
	meaningfulVisualAlternatives: boolean;
	wcagContentChecksPass: boolean;
	bilingualMetadataCorrect: boolean;
	blockingConditions: string[];
	evidenceReferences: string[];
}

export interface AudioFirstQualityResult {
	independentAuthoring: boolean;
	completeStoryCoverage: boolean;
	technicalMechanismsCorrect: boolean;
	caveatsIntact: boolean;
	terminologyUnderstandable: boolean;
	openingConcrete: boolean;
	transitionsNatural: boolean;
	cognitiveLoadManaged: boolean;
	noOperationalMetadata: boolean;
	noVisualDependency: boolean;
	completeListeningAssessed: boolean;
	blockingConditions: string[];
	evidenceReferences: string[];
}

export interface KnowledgeContinuityResult {
	thesaurusRead: boolean;
	thesaurusEvaluated: boolean;
	thesaurusUpdatesHandled: boolean;
	noUnauthorizedChanges: boolean;
	thesaurusPersistenceVerified: boolean;
	principlesRead: boolean;
	principlesClassificationCorrect: boolean;
	principlesEvidenceValidated: boolean;
	principlesPersistenceVerified: boolean;
	bookDeltaExecuted: boolean;
	bookDeltaProposalsEvaluated: boolean;
	bookDeltaDeduplication: boolean;
	bookDeltaApprovalBoundaries: boolean;
	bookDeltaResultsRecorded: boolean;
	blockingConditions: string[];
	evidenceReferences: string[];
}

export interface PublicationIntegrityResult {
	threeCanonicalDocumentsExist: boolean;
	correctDailyDirectory: boolean;
	correctFilenames: boolean;
	utf8Encoding: boolean;
	validMarkdownStructure: boolean;
	correctEditionMetadata: boolean;
	sourceClaimTraceability: boolean;
	completeRequiredSections: boolean;
	validDocumentReferences: boolean;
	consistentLifecycleState: boolean;
	accurateMetadata: boolean;
	persistenceSuccessful: boolean;
	readbackSuccessful: boolean;
	contentHashesMatch: boolean;
	blockingConditions: string[];
	evidenceReferences: string[];
}

export interface CrossLanguageConsistencyResult {
	materialStoryCoverageConsistent: boolean;
	technicalClaimsConsistent: boolean;
	productModelIdentifiersConsistent: boolean;
	datesVersionsConsistent: boolean;
	quantitativeFindingsConsistent: boolean;
	researchInterpretationsConsistent: boolean;
	vendorAttributionConsistent: boolean;
	importantLimitationsConsistent: boolean;
	sourceRelationshipsConsistent: boolean;
	blockingConditions: string[];
	evidenceReferences: string[];
}

// ============================================================================
// Acceptance Evaluator
// ============================================================================

/**
 * Evaluate all acceptance gates and produce the acceptance report.
 */
export function evaluateAcceptance(input: AcceptanceEvaluationInput): {
	report: AcceptanceReport;
	decision: AcceptanceDecision;
	aggregationResult: AcceptanceAggregationResult;
} {
	const {
		editionId,
		workflowRunId,
		contractVersion,
		reportingInterval,
		currentLifecycleStatus,
		artifactHashes,
		factDossierId,
		factDossierHash,
		editorialManifestId,
		editorialManifestHash,
		humanAuthorizations,
	} = input;

	// Evaluate each gate
	const gateResults: AcceptanceGateResult[] = [];

	for (const gateDef of ACCEPTANCE_GATES) {
		const result = evaluateGate(gateDef, input);
		gateResults.push(result);
	}

	// Collect all defects
	const defects: AcceptanceDefect[] = [];
	for (const result of gateResults) {
		for (const condition of result.blockingConditions) {
			defects.push({
				defectId: `defect_${generateId()}`,
				gateId: result.gateId,
				category: "OTHER",
				description: condition,
				severity: result.severity || "MAJOR",
				blocking: true,
				affectedArtifacts: [],
				evidenceReferences: result.evidenceReferences,
				responsibleComponent: result.gateId,
				remediationRecommendation: `Address blocking condition: ${condition}`,
				identifiedAt: new Date().toISOString(),
			});
		}
	}

	// Aggregate results
	const aggregationInput: AcceptanceAggregationInput = {
		editionId,
		workflowRunId,
		contractVersion,
		gateResults,
		defects,
		evidenceReferences: collectEvidenceReferences(gateResults),
		artifactHashes,
		factDossierId,
		factDossierHash,
		editorialManifestId,
		editorialManifestHash,
		reportingInterval,
		currentLifecycleStatus,
		humanAuthorizations,
	};

	const aggregationResult = aggregateAcceptanceDecision(aggregationInput);

	// Create acceptance report
	const report: AcceptanceReport = {
		schemaVersion: PUBLICATION_ACCEPTANCE_SCHEMA_VERSION,
		reportId: `acc_${generateId()}`,
		editionId,
		workflowRunId,
		acceptanceContractVersion: contractVersion,
		acceptanceTimestamp: aggregationResult.aggregationTimestamp,
		reportingInterval,
		overallDecision: aggregationResult.decision,
		requiredGates: ACCEPTANCE_GATES,
		gateApplicability: buildGateApplicability(gateResults),
		gateResults,
		evidenceReferences: aggregationInput.evidenceReferences,
		artifactHashes,
		factDossierReference: {
			dossierId: factDossierId,
			contentHash: factDossierHash,
		},
		editorialManifestReference: {
			manifestId: editorialManifestId,
			contentHash: editorialManifestHash,
		},
		criticalAndMajorDefects: [
			...aggregationResult.criticalDefects,
			...aggregationResult.majorDefects,
		],
		unverifiedRequirements: aggregationResult.unverifiedConditions,
		unresolvedManualReview: collectUnresolvedManualReview(gateResults),
		remediationHistory: [],
		publicationLifecycleState: currentLifecycleStatus as any,
		deploymentEligible: aggregationResult.publicationEligible,
		rejectionReasons: aggregationResult.blockingConditions,
		persistenceReadback: {
			persisted: false,
			readbackVerified: false,
		},
		contentHash: "", // Will be computed by the report generator
	};

	// Create machine-readable decision
	const decision = createAcceptanceDecision(
		editionId,
		aggregationResult,
		contractVersion,
		"", // Report location will be set by the caller
		artifactHashes,
	);

	return { report, decision, aggregationResult };
}

// ============================================================================
// Individual Gate Evaluation
// ============================================================================

/**
 * Evaluate a single gate based on the input evaluation results.
 */
function evaluateGate(
	gateDef: AcceptanceGateDefinition,
	input: AcceptanceEvaluationInput,
): AcceptanceGateResult {
	const baseResult: AcceptanceGateResult = {
		gateId: gateDef.gateId,
		name: gateDef.name,
		status: "PASS",
		applicability: "APPLICABLE",
		blockingConditions: [],
		evidenceReferences: [],
		artifactHashes: {},
		evaluatorVersion: gateDef.evaluatorVersion,
		executedAt: new Date().toISOString(),
		remediationReferences: [],
		humanReviewRequired: gateDef.humanReviewRequired,
		humanReviewStatus: gateDef.humanReviewRequired
			? "pending"
			: "not-required",
		mandatory: gateDef.mandatory,
		satisfiedUpstreamGates: [],
		unsatisfiedUpstreamGates: [],
	};

	// If the gate requires human review, check if authorization is recorded
	if (gateDef.humanReviewRequired) {
		const hasAuthorization = input.humanAuthorizations.some(
			(auth) => auth.gateId === gateDef.gateId,
		);
		if (hasAuthorization) {
			baseResult.humanReviewStatus = "approved";
		}
	}

	// Evaluate based on gate type
	switch (gateDef.gateId) {
		case "gate_temporal_integrity":
			return evaluateTemporalIntegrity(
				baseResult,
				input.temporalIntegrityResult,
			);
		case "gate_discovery_coverage":
			return evaluateDiscoveryCoverage(
				baseResult,
				input.discoveryCoverageResult,
			);
		case "gate_evidence_integrity":
			return evaluateEvidenceIntegrity(
				baseResult,
				input.evidenceIntegrityResult,
			);
		case "gate_historical_regression":
			return evaluateHistoricalRegression(
				baseResult,
				input.historicalRegressionResult,
			);
		case "gate_editorial_integrity":
			return evaluateEditorialIntegrity(
				baseResult,
				input.editorialIntegrityResult,
			);
		case "gate_readable_accessibility":
			return evaluateReadableAccessibility(
				baseResult,
				input.readableAccessibilityResult,
			);
		case "gate_audio_first_quality":
			return evaluateAudioFirstQuality(
				baseResult,
				input.audioFirstQualityResult,
			);
		case "gate_knowledge_continuity":
			return evaluateKnowledgeContinuity(
				baseResult,
				input.knowledgeContinuityResult,
			);
		case "gate_publication_integrity":
			return evaluatePublicationIntegrity(
				baseResult,
				input.publicationIntegrityResult,
			);
		case "gate_cross_language_consistency":
			return evaluateCrossLanguageConsistency(
				baseResult,
				input.crossLanguageConsistencyResult,
			);
		case "gate_lifecycle_correctness":
			return evaluateLifecycleCorrectness(baseResult, input);
		default:
			return {
				...baseResult,
				status: "UNVERIFIED",
				blockingConditions: [`Unknown gate: ${gateDef.gateId}`],
			};
	}
}

function evaluateTemporalIntegrity(
	base: AcceptanceGateResult,
	result: TemporalIntegrityResult | undefined,
): AcceptanceGateResult {
	if (!result) {
		return {
			...base,
			status: "UNVERIFIED",
			blockingConditions: [
				"Temporal integrity evaluation has not been executed.",
			],
		};
	}

	const blockingConditions: string[] = [];
	let status: AcceptanceGateStatus = "PASS";
	let severity: AcceptanceSeverity | undefined;

	if (!result.editionIdentityValid) {
		blockingConditions.push("Edition identity is invalid.");
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.reportingIntervalValid) {
		blockingConditions.push("Reporting interval is invalid.");
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.dstHandlingCorrect) {
		blockingConditions.push("DST handling is incorrect.");
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.noveltyClassificationValid) {
		blockingConditions.push("Novelty classification is invalid.");
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.firstDisclosureEvidenceValid) {
		blockingConditions.push("First-disclosure evidence is invalid.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.historicalContextValid) {
		blockingConditions.push("Historical context is invalid.");
		status = "FAIL";
		severity = "MAJOR";
	}

	if (
		blockingConditions.length === 0 &&
		result.blockingConditions.length > 0
	) {
		blockingConditions.push(...result.blockingConditions);
		status = "FAIL";
		severity = "MAJOR";
	}

	return {
		...base,
		status,
		severity,
		blockingConditions,
		evidenceReferences: result.evidenceReferences,
	};
}

function evaluateDiscoveryCoverage(
	base: AcceptanceGateResult,
	result: DiscoveryCoverageResult | undefined,
): AcceptanceGateResult {
	if (!result) {
		return {
			...base,
			status: "UNVERIFIED",
			blockingConditions: [
				"Discovery coverage evaluation has not been executed.",
			],
		};
	}

	const blockingConditions: string[] = [];
	let status: AcceptanceGateStatus = "PASS";
	let severity: AcceptanceSeverity | undefined;

	if (!result.ring1Monitored) {
		blockingConditions.push(
			"Ring 1 official first-party sources were not monitored.",
		);
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.ring2Monitored) {
		blockingConditions.push(
			"Ring 2 independent research sources were not monitored.",
		);
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.ring3Monitored) {
		blockingConditions.push(
			"Ring 3 expert and community sources were not monitored.",
		);
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.mandatoryMonitoringExecuted) {
		blockingConditions.push(
			"Mandatory developer-tool and coding-agent monitoring was not executed.",
		);
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.sourceRegistryCoverageComplete) {
		blockingConditions.push("Source registry coverage is incomplete.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.inaccessibleSourcesReported) {
		blockingConditions.push(
			"Inaccessible sources are not explicitly reported.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.omissionReviewCompleted) {
		blockingConditions.push(
			"Independent omission review was not completed.",
		);
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.noUnresolvedCriticalOmissions) {
		blockingConditions.push(
			"Omission review has unresolved critical omissions.",
		);
		status = "FAIL";
		severity = "CRITICAL";
	}

	if (
		blockingConditions.length === 0 &&
		result.blockingConditions.length > 0
	) {
		blockingConditions.push(...result.blockingConditions);
		status = "FAIL";
		severity = "MAJOR";
	}

	return {
		...base,
		status,
		severity,
		blockingConditions,
		evidenceReferences: result.evidenceReferences,
	};
}

function evaluateEvidenceIntegrity(
	base: AcceptanceGateResult,
	result: EvidenceIntegrityResult | undefined,
): AcceptanceGateResult {
	if (!result) {
		return {
			...base,
			status: "UNVERIFIED",
			blockingConditions: [
				"Evidence integrity evaluation has not been executed.",
			],
		};
	}

	const blockingConditions: string[] = [];
	let status: AcceptanceGateStatus = "PASS";
	let severity: AcceptanceSeverity | undefined;

	if (!result.allMaterialClaimsVerified) {
		blockingConditions.push(
			"Not all material claims have verified evidence.",
		);
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.originalSourcesAttributed) {
		blockingConditions.push(
			"Original sources are not correctly attributed.",
		);
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.evidenceClassificationsAccurate) {
		blockingConditions.push("Evidence classifications are not accurate.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.productVersionsCorrect) {
		blockingConditions.push("Product versions are not correctly stated.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.numericalFindingsWithConditions) {
		blockingConditions.push(
			"Numerical findings lack benchmark conditions.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.researchMethodologyDocumented) {
		blockingConditions.push("Research methodology is not documented.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.counterevidenceIncluded) {
		blockingConditions.push("Relevant counterevidence is not included.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.uncertaintyStated) {
		blockingConditions.push("Uncertainty is not explicitly stated.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.noFabricatedClaims) {
		blockingConditions.push("Fabricated factual claims exist.");
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.noContradictoryClaims) {
		blockingConditions.push("Contradictory factual claims exist.");
		status = "FAIL";
		severity = "CRITICAL";
	}

	if (
		blockingConditions.length === 0 &&
		result.blockingConditions.length > 0
	) {
		blockingConditions.push(...result.blockingConditions);
		status = "FAIL";
		severity = "MAJOR";
	}

	return {
		...base,
		status,
		severity,
		blockingConditions,
		evidenceReferences: result.evidenceReferences,
	};
}

function evaluateHistoricalRegression(
	base: AcceptanceGateResult,
	result: HistoricalRegressionResult | undefined,
): AcceptanceGateResult {
	if (!result) {
		return {
			...base,
			status: "UNVERIFIED",
			blockingConditions: [
				"Historical regression evaluation has not been executed.",
			],
		};
	}

	const blockingConditions: string[] = [];
	let status: AcceptanceGateStatus = "PASS";
	let severity: AcceptanceSeverity | undefined;

	if (!result.comparisonCompleted) {
		blockingConditions.push(
			"Seven-calendar-day comparison was not completed.",
		);
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.historicalRecordsConsulted) {
		blockingConditions.push("Historical records were not consulted.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.previouslyReportedIdentified) {
		blockingConditions.push(
			"Previously reported developments are not identified.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.substantiveChangesClassified) {
		blockingConditions.push(
			"Genuine substantive changes are not classified.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.duplicateReportingClassified) {
		blockingConditions.push("Duplicated reporting is not classified.");
		status = "FAIL";
		severity = "MINOR";
	}
	if (!result.catchUpHandlingExplicit) {
		blockingConditions.push(
			"Explicit catch-up classifications are not recorded.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.unresolvedLimitationsReported) {
		blockingConditions.push(
			"Unresolved comparison limitations are not reported.",
		);
		status = "FAIL";
		severity = "MINOR";
	}

	if (
		blockingConditions.length === 0 &&
		result.blockingConditions.length > 0
	) {
		blockingConditions.push(...result.blockingConditions);
		status = "FAIL";
		severity = "MAJOR";
	}

	return {
		...base,
		status,
		severity,
		blockingConditions,
		evidenceReferences: result.evidenceReferences,
	};
}

function evaluateEditorialIntegrity(
	base: AcceptanceGateResult,
	result: EditorialIntegrityResult | undefined,
): AcceptanceGateResult {
	if (!result) {
		return {
			...base,
			status: "UNVERIFIED",
			blockingConditions: [
				"Editorial integrity evaluation has not been executed.",
			],
		};
	}

	const blockingConditions: string[] = [];
	let status: AcceptanceGateStatus = "PASS";
	let severity: AcceptanceSeverity | undefined;

	if (!result.storyIdentifiersValid) {
		blockingConditions.push("Story identifiers are not valid.");
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.eligibilityVerified) {
		blockingConditions.push("Eligibility is not verified.");
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.selectionDecisionsExplicit) {
		blockingConditions.push(
			"Editorial selection decisions are not explicit.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.orderingPreserved) {
		blockingConditions.push("Required ordering is not preserved.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.significantDevelopmentsCovered) {
		blockingConditions.push(
			"Coverage of materially significant developments is incomplete.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.noUnsupportedStories) {
		blockingConditions.push("Unsupported additional stories are included.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.noUnexplainedOmissions) {
		blockingConditions.push(
			"Unexplained omission of selected stories exists.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.vendorNeutralTreatment) {
		blockingConditions.push(
			"Vendor-neutral editorial treatment is not maintained.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.researchCoverageAppropriate) {
		blockingConditions.push(
			"Scientific, economic and strategic research coverage is not appropriate.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.uncertaintyTreated) {
		blockingConditions.push("Uncertainty is not explicitly treated.");
		status = "FAIL";
		severity = "MINOR";
	}

	if (
		blockingConditions.length === 0 &&
		result.blockingConditions.length > 0
	) {
		blockingConditions.push(...result.blockingConditions);
		status = "FAIL";
		severity = "MAJOR";
	}

	return {
		...base,
		status,
		severity,
		blockingConditions,
		evidenceReferences: result.evidenceReferences,
	};
}

function evaluateReadableAccessibility(
	base: AcceptanceGateResult,
	result: ReadableAccessibilityResult | undefined,
): AcceptanceGateResult {
	if (!result) {
		return {
			...base,
			status: "UNVERIFIED",
			blockingConditions: [
				"Readable accessibility evaluation has not been executed.",
			],
		};
	}

	const blockingConditions: string[] = [];
	let status: AcceptanceGateStatus = "PASS";
	let severity: AcceptanceSeverity | undefined;

	if (!result.factualFidelityMaintained) {
		blockingConditions.push("Factual fidelity is not maintained.");
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.selectedStoryCompleteness) {
		blockingConditions.push("Selected-story completeness is not verified.");
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.technicalDepthPreserved) {
		blockingConditions.push("Technical depth is not preserved.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.researchAccuracyVerified) {
		blockingConditions.push(
			"Scientific and strategic research accuracy is not verified.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.firstScreenClarity) {
		blockingConditions.push("First-screen clarity is not established.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.progressiveDisclosure) {
		blockingConditions.push("Progressive disclosure is not implemented.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.informationHierarchy) {
		blockingConditions.push("Information hierarchy is not correct.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.adhdCognitiveAccessibility) {
		blockingConditions.push(
			"ADHD-aware cognitive accessibility is not verified.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.accessibleTerminology) {
		blockingConditions.push("Accessible terminology is not used.");
		status = "FAIL";
		severity = "MINOR";
	}
	if (!result.sourceTransparency) {
		blockingConditions.push("Source transparency is not maintained.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.meaningfulVisualAlternatives) {
		blockingConditions.push(
			"Meaningful visual alternatives are not provided.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.wcagContentChecksPass) {
		blockingConditions.push(
			"Relevant WCAG 2.2 AA content checks do not pass.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.bilingualMetadataCorrect) {
		blockingConditions.push("Correct bilingual metadata is not present.");
		status = "FAIL";
		severity = "MINOR";
	}

	if (
		blockingConditions.length === 0 &&
		result.blockingConditions.length > 0
	) {
		blockingConditions.push(...result.blockingConditions);
		status = "FAIL";
		severity = "MAJOR";
	}

	return {
		...base,
		status,
		severity,
		blockingConditions,
		evidenceReferences: result.evidenceReferences,
	};
}

function evaluateAudioFirstQuality(
	base: AcceptanceGateResult,
	result: AudioFirstQualityResult | undefined,
): AcceptanceGateResult {
	if (!result) {
		return {
			...base,
			status: "UNVERIFIED",
			blockingConditions: [
				"Audio-first quality evaluation has not been executed.",
			],
		};
	}

	const blockingConditions: string[] = [];
	let status: AcceptanceGateStatus = "PASS";
	let severity: AcceptanceSeverity | undefined;

	if (!result.independentAuthoring) {
		blockingConditions.push(
			"Each narrative is not independently authored from the canonical factual foundation.",
		);
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.completeStoryCoverage) {
		blockingConditions.push(
			"Every materially selected story is not represented.",
		);
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.technicalMechanismsCorrect) {
		blockingConditions.push(
			"Technical mechanisms are not explained correctly.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.caveatsIntact) {
		blockingConditions.push("Important caveats do not remain intact.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.terminologyUnderstandable) {
		blockingConditions.push("Terminology is not understandable.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.openingConcrete) {
		blockingConditions.push("The opening is not concrete.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.transitionsNatural) {
		blockingConditions.push("Narrative transitions are not natural.");
		status = "FAIL";
		severity = "MINOR";
	}
	if (!result.cognitiveLoadManaged) {
		blockingConditions.push("Cognitive load is not appropriately managed.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.noOperationalMetadata) {
		blockingConditions.push("Spoken text contains operational metadata.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.noVisualDependency) {
		blockingConditions.push("The narrative depends on visual references.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.completeListeningAssessed) {
		blockingConditions.push(
			"The complete listening experience has not been assessed.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}

	if (
		blockingConditions.length === 0 &&
		result.blockingConditions.length > 0
	) {
		blockingConditions.push(...result.blockingConditions);
		status = "FAIL";
		severity = "MAJOR";
	}

	return {
		...base,
		status,
		severity,
		blockingConditions,
		evidenceReferences: result.evidenceReferences,
	};
}

function evaluateKnowledgeContinuity(
	base: AcceptanceGateResult,
	result: KnowledgeContinuityResult | undefined,
): AcceptanceGateResult {
	if (!result) {
		return {
			...base,
			status: "UNVERIFIED",
			blockingConditions: [
				"Knowledge continuity evaluation has not been executed.",
			],
		};
	}

	const blockingConditions: string[] = [];
	let status: AcceptanceGateStatus = "PASS";
	let severity: AcceptanceSeverity | undefined;

	// Thesaurus checks
	if (!result.thesaurusRead) {
		blockingConditions.push(
			"Existing thesaurus register was not successfully read.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.thesaurusEvaluated) {
		blockingConditions.push("Candidate terminology was not evaluated.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.thesaurusUpdatesHandled) {
		blockingConditions.push(
			"Verified updates were not handled according to policy.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.noUnauthorizedChanges) {
		blockingConditions.push("Unauthorized definition changes were made.");
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.thesaurusPersistenceVerified) {
		blockingConditions.push(
			"Thesaurus persistence and readback were not verified.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}

	// Architecture principles checks
	if (!result.principlesRead) {
		blockingConditions.push(
			"Existing architecture principles register was not successfully read.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.principlesClassificationCorrect) {
		blockingConditions.push(
			"ADD, CONFIRM, REFINE, MERGE, SUPERSEDE or NONE not correctly recorded.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.principlesEvidenceValidated) {
		blockingConditions.push(
			"Evidence and relationships were not validated.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.principlesPersistenceVerified) {
		blockingConditions.push(
			"Architecture principles persistence and readback were not verified.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}

	// Book Delta checks
	if (!result.bookDeltaExecuted) {
		blockingConditions.push(
			"Book Delta assessment was not actually executed.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.bookDeltaProposalsEvaluated) {
		blockingConditions.push(
			"Educational improvement proposals were not evaluated.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.bookDeltaDeduplication) {
		blockingConditions.push("Historical proposals were not deduplicated.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.bookDeltaApprovalBoundaries) {
		blockingConditions.push("Approval boundaries were not respected.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.bookDeltaResultsRecorded) {
		blockingConditions.push(
			"Results were not recorded in research-audit.md.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}

	if (
		blockingConditions.length === 0 &&
		result.blockingConditions.length > 0
	) {
		blockingConditions.push(...result.blockingConditions);
		status = "FAIL";
		severity = "MAJOR";
	}

	return {
		...base,
		status,
		severity,
		blockingConditions,
		evidenceReferences: result.evidenceReferences,
	};
}

function evaluatePublicationIntegrity(
	base: AcceptanceGateResult,
	result: PublicationIntegrityResult | undefined,
): AcceptanceGateResult {
	if (!result) {
		return {
			...base,
			status: "UNVERIFIED",
			blockingConditions: [
				"Publication integrity evaluation has not been executed.",
			],
		};
	}

	const blockingConditions: string[] = [];
	let status: AcceptanceGateStatus = "PASS";
	let severity: AcceptanceSeverity | undefined;

	if (!result.threeCanonicalDocumentsExist) {
		blockingConditions.push(
			"Exactly three canonical daily Markdown documents do not exist.",
		);
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.correctDailyDirectory) {
		blockingConditions.push("Correct daily directory is not used.");
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.correctFilenames) {
		blockingConditions.push("Correct filenames are not used.");
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.utf8Encoding) {
		blockingConditions.push("UTF-8 encoding is not verified.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.validMarkdownStructure) {
		blockingConditions.push("Valid Markdown structure is not verified.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.correctEditionMetadata) {
		blockingConditions.push("Correct edition metadata is not present.");
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.sourceClaimTraceability) {
		blockingConditions.push(
			"Source and claim traceability is not verified.",
		);
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.completeRequiredSections) {
		blockingConditions.push("Complete required sections are not present.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.validDocumentReferences) {
		blockingConditions.push("Valid document references are not verified.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.consistentLifecycleState) {
		blockingConditions.push(
			"Consistent artifact lifecycle state is not maintained.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.accurateMetadata) {
		blockingConditions.push(
			"Accurate creation and modification metadata is not present.",
		);
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.persistenceSuccessful) {
		blockingConditions.push("Successful persistence is not verified.");
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.readbackSuccessful) {
		blockingConditions.push("Independent readback is not verified.");
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.contentHashesMatch) {
		blockingConditions.push(
			"Content hashes do not match evaluated artifacts.",
		);
		status = "FAIL";
		severity = "CRITICAL";
	}

	if (
		blockingConditions.length === 0 &&
		result.blockingConditions.length > 0
	) {
		blockingConditions.push(...result.blockingConditions);
		status = "FAIL";
		severity = "MAJOR";
	}

	return {
		...base,
		status,
		severity,
		blockingConditions,
		evidenceReferences: result.evidenceReferences,
	};
}

function evaluateCrossLanguageConsistency(
	base: AcceptanceGateResult,
	result: CrossLanguageConsistencyResult | undefined,
): AcceptanceGateResult {
	if (!result) {
		return {
			...base,
			status: "UNVERIFIED",
			blockingConditions: [
				"Cross-language consistency evaluation has not been executed.",
			],
		};
	}

	const blockingConditions: string[] = [];
	let status: AcceptanceGateStatus = "PASS";
	let severity: AcceptanceSeverity | undefined;

	if (!result.materialStoryCoverageConsistent) {
		blockingConditions.push("Material story coverage is not consistent.");
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.technicalClaimsConsistent) {
		blockingConditions.push("Technical claims are not consistent.");
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.productModelIdentifiersConsistent) {
		blockingConditions.push(
			"Product and model identifiers are not consistent.",
		);
		status = "FAIL";
		severity = "CRITICAL";
	}
	if (!result.datesVersionsConsistent) {
		blockingConditions.push("Dates and versions are not consistent.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.quantitativeFindingsConsistent) {
		blockingConditions.push("Quantitative findings are not consistent.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.researchInterpretationsConsistent) {
		blockingConditions.push("Research interpretations are not consistent.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.vendorAttributionConsistent) {
		blockingConditions.push("Vendor attribution is not consistent.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.importantLimitationsConsistent) {
		blockingConditions.push("Important limitations are not consistent.");
		status = "FAIL";
		severity = "MAJOR";
	}
	if (!result.sourceRelationshipsConsistent) {
		blockingConditions.push("Source relationships are not consistent.");
		status = "FAIL";
		severity = "MAJOR";
	}

	if (
		blockingConditions.length === 0 &&
		result.blockingConditions.length > 0
	) {
		blockingConditions.push(...result.blockingConditions);
		status = "FAIL";
		severity = "MAJOR";
	}

	return {
		...base,
		status,
		severity,
		blockingConditions,
		evidenceReferences: result.evidenceReferences,
	};
}

function evaluateLifecycleCorrectness(
	base: AcceptanceGateResult,
	input: AcceptanceEvaluationInput,
): AcceptanceGateResult {
	const blockingConditions: string[] = [];
	let status: AcceptanceGateStatus = "PASS";
	let severity: AcceptanceSeverity | undefined;

	// Check lifecycle state
	if (input.currentLifecycleStatus !== "READY_FOR_VALIDATION") {
		blockingConditions.push(
			`Edition is in ${input.currentLifecycleStatus} state, not READY_FOR_VALIDATION.`,
		);
		status = "FAIL";
		severity = "CRITICAL";
	}

	// Check that all upstream gates have completed
	const upstreamGateResultMap: Record<string, unknown> = {
		gate_temporal_integrity: input.temporalIntegrityResult,
		gate_discovery_coverage: input.discoveryCoverageResult,
		gate_evidence_integrity: input.evidenceIntegrityResult,
		gate_historical_regression: input.historicalRegressionResult,
		gate_editorial_integrity: input.editorialIntegrityResult,
		gate_readable_accessibility: input.readableAccessibilityResult,
		gate_audio_first_quality: input.audioFirstQualityResult,
		gate_knowledge_continuity: input.knowledgeContinuityResult,
		gate_publication_integrity: input.publicationIntegrityResult,
		gate_cross_language_consistency: input.crossLanguageConsistencyResult,
	};

	const upstreamGateIds = Object.keys(upstreamGateResultMap);
	const satisfiedUpstreamGates: string[] = [];
	const unsatisfiedUpstreamGates: string[] = [];

	for (const gateId of upstreamGateIds) {
		const result = upstreamGateResultMap[gateId];
		if (result !== undefined) {
			satisfiedUpstreamGates.push(gateId);
		} else {
			unsatisfiedUpstreamGates.push(gateId);
		}
	}

	if (unsatisfiedUpstreamGates.length > 0) {
		blockingConditions.push(
			`Required upstream gates have not completed: ${unsatisfiedUpstreamGates.join(", ")}`,
		);
		// Propagate UNVERIFIED if upstream gates are not completed (not a hard failure)
		if (status === "PASS") {
			status = "UNVERIFIED";
		}
	}

	return {
		...base,
		status,
		severity,
		blockingConditions,
		satisfiedUpstreamGates,
		unsatisfiedUpstreamGates,
	};
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildGateApplicability(
	gateResults: AcceptanceGateResult[],
): Record<string, "APPLICABLE" | "NOT_APPLICABLE"> {
	const applicability: Record<string, "APPLICABLE" | "NOT_APPLICABLE"> = {};
	for (const result of gateResults) {
		applicability[result.gateId] = result.applicability;
	}
	return applicability;
}

function collectEvidenceReferences(
	gateResults: AcceptanceGateResult[],
): string[] {
	const references = new Set<string>();
	for (const result of gateResults) {
		for (const ref of result.evidenceReferences) {
			references.add(ref);
		}
	}
	return Array.from(references);
}

function collectUnresolvedManualReview(
	gateResults: AcceptanceGateResult[],
): string[] {
	const unresolved: string[] = [];
	for (const result of gateResults) {
		if (
			result.humanReviewRequired &&
			result.humanReviewStatus === "pending"
		) {
			unresolved.push(result.gateId);
		}
	}
	return unresolved;
}

function generateId(): string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
	let result = "";
	for (let i = 0; i < 16; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}
