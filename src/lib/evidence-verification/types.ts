/**
 * Evidence Verification Pipeline — Types & Interfaces
 *
 * Extends the existing discovery pipeline with systematic claim verification,
 * evidence classification, and traceability per AI Intelligence Publication Contract §4, §6.
 */

/** Evidence classification categories per contract §4.2 */
export type EvidenceClassification =
	| "VERIFIED_FACT"
	| "VENDOR_CLAIM"
	| "RESEARCH_FINDING"
	| "ORIGINAL_REPORTING"
	| "EXPERT_INTERPRETATION"
	| "INFERENCE"
	| "SPECULATION"
	| "UNVERIFIED";

/** Verification status */
export type VerificationStatus =
	| "verified"
	| "partially-verified"
	| "unverified"
	| "contradicted"
	| "insufficient-evidence"
	| "downgraded"
	| "retracted"
	| "superseded";

/** Claim type for specialized verification */
export type ClaimType =
	| "technical-announcement"
	| "software-release"
	| "scientific-research"
	| "benchmark-result"
	| "strategic-research"
	| "advisory-finding"
	| "enterprise-adoption"
	| "productivity-claim"
	| "roi-claim"
	| "economic-impact"
	| "original-reporting"
	| "vendor-announcement"
	| "policy-regulation"
	| "security-vulnerability";

/** Verification method used */
export type VerificationMethod =
	| "primary-source-inspection"
	| "methodology-review"
	| "artifact-reproduction"
	| "independent-replication"
	| "cross-reference"
	| "expert-consultation"
	| "statistical-analysis"
	| "source-document-review"
	| "api-documentation-check"
	| "benchmark-methodology-audit"
	| "paywall-accessible-review";

/** Evidence source tier (mirrors source registry) */
export type EvidenceTier = 1 | 2 | 3;

/** Timestamp types for temporal verification */
export type TimestampType =
	| "original-publication"
	| "first-public-disclosure"
	| "underlying-event"
	| "substantive-update"
	| "retrieval"
	| "indexing";

/** Evidence reference with full traceability */
export interface EvidenceReference {
	/** Stable evidence ID */
	id: string;
	/** Source registry ID */
	sourceId: string;
	/** Evidence classification */
	classification: EvidenceClassification;
	/** Canonical URL */
	url: string;
	/** Precise locator (section, paragraph, timestamp, line numbers) */
	locator: string;
	/** Extracted evidence text */
	extractedText: string;
	/** Timestamp of this evidence */
	timestamp: string;
	/** Timestamp type */
	timestampType: TimestampType;
	/** Source timezone */
	sourceTimezone?: string;
	/** Confidence in this evidence (0-1) */
	confidence: number;
	/** Evidence tier */
	tier: EvidenceTier;
	/** Whether this is primary or secondary evidence */
	evidenceRole: "primary" | "secondary" | "corroborating" | "counterevidence";
	/** Verification methods applicable to this evidence */
	applicableMethods: VerificationMethod[];
	/** Limitations of this evidence */
	limitations?: string[];
	/** Retrieval metadata */
	retrievalMetadata: {
		retrievedAt: string;
		retrievalMethod: string;
		httpStatus?: number;
		contentHash: string;
	};
}

/** Counterevidence record */
export interface Counterevidence {
	id: string;
	claimId: string;
	evidenceReference: EvidenceReference;
	contradictsClaim: string; // The claim text it contradicts
	contradictionType:
		"direct" | "qualifying" | "contextual" | "methodological";
	description: string;
	confidence: number;
	sourceId: string;
	discoveredAt: string;
}

/** Assumption required for a claim to hold */
export interface RequiredAssumption {
	id: string;
	claimId: string;
	assumption: string;
	type:
		| "technical"
		| "methodological"
		| "contextual"
		| "economic"
		| "organizational";
	criticality: "essential" | "important" | "minor";
	evidenceForAssumption?: EvidenceReference[];
	evidenceAgainstAssumption?: EvidenceReference[];
	status: "supported" | "unsupported" | "contradicted" | "unknown";
}

/** Alternative explanation for observed evidence */
export interface AlternativeExplanation {
	id: string;
	claimId: string;
	explanation: string;
	type:
		| "confounding-variable"
		| "selection-bias"
		| "measurement-artifact"
		| "different-causal-mechanism"
		| "statistical-fluke";
	supportingEvidence?: EvidenceReference[];
	plausibility: "high" | "medium" | "low";
}

/** Falsification criterion */
export interface FalsificationCriterion {
	id: string;
	claimId: string;
	criterion: string;
	type: "observation" | "experiment" | "reproduction" | "benchmark" | "audit";
	feasibility: "feasible" | "difficult" | "infeasible";
	estimatedCost?: "low" | "medium" | "high";
	timeframe?: string;
	prerequisites?: string[];
}

/** Unresolved uncertainty */
export interface UnresolvedUncertainty {
	id: string;
	claimId: string;
	uncertainty: string;
	type:
		| "evidence-gap"
		| "methodological"
		| "definitional"
		| "temporal"
		| "scope"
		| "generalizability";
	impact: "high" | "medium" | "low";
	blockingVerification: boolean;
	researchNeeded: string;
}

/** Complete claim verification record */
export interface ClaimVerificationRecord {
	/** Stable claim ID */
	id: string;
	/** Candidate ID this claim belongs to */
	candidateId: string;
	/** Stable candidate ID */
	candidateStableId: string;
	/** Exact claim text */
	claim: string;
	/** Claim type for specialized verification */
	claimType: ClaimType;
	/** Original source of the claim */
	originalSource: {
		sourceId: string;
		url: string;
		title: string;
		author?: string[];
		publisher?: string;
		publicationTimestamp: string;
		firstDisclosureTimestamp?: string;
	};
	/** Evidence supporting this claim */
	supportingEvidence: EvidenceReference[];
	/** Evidence contradicting this claim */
	counterevidence: Counterevidence[];
	/** Required assumptions */
	assumptions: RequiredAssumption[];
	/** Alternative explanations */
	alternativeExplanations: AlternativeExplanation[];
	/** Falsification criteria */
	falsificationCriteria: FalsificationCriterion[];
	/** Unresolved uncertainties */
	unresolvedUncertainties: UnresolvedUncertainty[];
	/** Evidence classification */
	evidenceClassification: EvidenceClassification;
	/** Verification status */
	verificationStatus: VerificationStatus;
	/** Verification methods used */
	verificationMethods: VerificationMethod[];
	/** Verification confidence (0-1) */
	confidence: number;
	/** Verification level achieved (L0-L3 per contract §4.1) */
	verificationLevel: "L0" | "L1" | "L2" | "L3";
	/** Verification details for L1-L3 */
	verificationDetails?: {
		methodologyChecked: boolean;
		hardwareSpecified: boolean;
		precisionStated: boolean;
		batchSizeStated: boolean;
		warmupExcluded: boolean;
		statisticalRigor: boolean;
		confoundersAddressed: boolean;
		rawDataAvailable: boolean;
		reproductionArtifact?: string;
		independentReplication?: {
			sourceId: string;
			url: string;
			confirmed: boolean;
		};
	};
	/** Temporal verification */
	temporalVerification: {
		originalPublicationTimestamp: string;
		firstPublicDisclosureTimestamp?: string;
		underlyingEventTimestamp?: string;
		substantiveUpdateTimestamp?: string;
		retrievalTimestamp: string;
		indexingTimestamp: string;
		timezonePrecision: "exact" | "source-stated" | "inferred" | "unknown";
		timestampConfidence: number;
	};
	/** Product/version specifics if applicable */
	productContext?: {
		productName: string;
		version: string;
		releaseMaturity:
			"ga" | "preview" | "experimental" | "deprecated" | "unknown";
		availability:
			"general" | "limited" | "waitlist" | "internal" | "unknown";
		rolloutRestrictions?: string[];
		licensing?: string;
		pricing?: string;
	};
	/** Technical specifics for technical claims */
	technicalContext?: {
		implementationStatus:
			"released" | "preview" | "announced" | "research" | "unknown";
		technicalMechanism?: string;
		architecturalImplications?: string[];
		/** Demonstrated or announced model/system capabilities. */
		capabilities?: string[];
		compatibility?: string[];
		knownLimitations?: string[];
		securityAssumptions?: string[];
		trustBoundaries?: string[];
		/** Agentic workflow and software engineering implications. */
		agenticImplications?: string[];
	};
	/** Scientific/benchmark specifics */
	scientificContext?: {
		studyDesign?: string;
		methodology?: string;
		dataset?: string;
		evaluationConditions?: string;
		reproducibility?: {
			artifactAvailable: boolean;
			artifactUrl?: string;
			independentReplications: number;
			replicationResults?: "confirmed" | "partial" | "failed" | "mixed";
		};
		benchmarkMethodology?: {
			warmupRuns: boolean;
			batchSize: number;
			precision: string;
			hardwareSpecified: boolean;
			confoundersAddressed: string[];
		};
		contradictoryFindings?: string[];
	};
	/** Strategic research specifics */
	researchContext?: {
		researchPurpose?: string;
		hypotheses?: string[];
		researchDesign?: string;
		sampleSize?: number;
		sampleComposition?: string;
		geographicScope?: string;
		industryCoverage?: string;
		/** Research/data collection period (e.g., "2024-01 to 2024-09"). */
		researchPeriod?: string;
		statisticalMethods?: string[];
		/** Statistical uncertainty and methodological limitations. */
		statisticalUncertainty?: string;
		methodologicalLimitations?: string[];
		fundingSources?: string[];
		conflictsOfInterest?: string[];
		definitionsUsed?: Record<string, string>;
		causalClaimType?:
			"correlation" | "causation" | "prediction" | "interpretation";
		generalizabilityAssessment?: string;
		paywallDetails?: {
			accessibleSections: string[];
			inaccessibleSections: string[];
			methodologyVerifiable: boolean;
		};
	};
	/** Enterprise/economic specifics */
	enterpriseContext?: {
		measuredOutcome?: string;
		operationalDefinition?: string;
		baseline?: string;
		comparisonGroup?: string;
		individualVsTeamVsOrg:
			"individual" | "team" | "organizational" | "mixed" | "unclear";
		implementationCosts?: string;
		inferenceCosts?: string;
		governanceCosts?: string;
		operatingCosts?: string;
		/** Return on investment, when stated. */
		roi?: string;
		/** Total cost of ownership, when stated. */
		totalCostOfOwnership?: string;
		selectionBias?: string;
		survivorshipBias?: string;
		confoundingVariables?: string[];
		shortTermVsSustained: "short-term" | "sustained" | "unknown";
		realizedVsEstimatedVsProjected:
			"realized" | "estimated" | "projected" | "unknown";
		organizationalDependencies?: string[];
		technicalDependencies?: string[];
		/** Enterprise AI adoption implications. */
		enterpriseImplications?: string[];
		/** Productivity and software delivery consequences. */
		productivityConsequences?: string[];
		/** Economic impact statements. */
		economicImpact?: string[];
		/** Workforce and organizational transformation implications. */
		workforceImplications?: string[];
		/** Governance and operational implications. */
		governanceImplications?: string[];
	};
	/** Metadata */
	verifiedAt: string;
	verifiedBy: string;
	verificationDurationMs: number;
	revisionHistory: VerificationRevision[];
}

/** Verification revision record */
export interface VerificationRevision {
	revisionId: string;
	revisedAt: string;
	revisedBy: string;
	changes: string[];
	previousClassification?: EvidenceClassification;
	previousStatus?: VerificationStatus;
	previousConfidence?: number;
	reason: string;
}

/** Verification session for batch processing */
export interface VerificationSession {
	id: string;
	editionDate: string;
	startedAt: string;
	completedAt?: string;
	claimsProcessed: number;
	claimsVerified: number;
	claimsUnverified: number;
	claimsContradicted: number;
	claimsDowngraded: number;
	averageConfidence: number;
	executionDurationMs: number;
	verifierId: string;
}

/** Query options for verification records */
export interface VerificationQuery {
	candidateId?: string;
	claimId?: string;
	claimType?: ClaimType;
	evidenceClassification?: EvidenceClassification;
	verificationStatus?: VerificationStatus;
	verificationLevel?: "L0" | "L1" | "L2" | "L3";
	sourceId?: string;
	editionDate?: string;
	startDate?: string;
	endDate?: string;
	minConfidence?: number;
	maxConfidence?: number;
	hasCounterevidence?: boolean;
	hasUnresolvedUncertainties?: boolean;
	limit?: number;
	offset?: number;
}

/** Verification statistics */
export interface VerificationStats {
	totalClaims: number;
	byClassification: Record<EvidenceClassification, number>;
	byStatus: Record<VerificationStatus, number>;
	byLevel: Record<"L0" | "L1" | "L2" | "L3", number>;
	byClaimType: Record<ClaimType, number>;
	averageConfidence: number;
	claimsWithCounterevidence: number;
	claimsWithUnresolvedUncertainties: number;
	verificationCoveragePercent: number;
}

/** Input for claim verification */
export interface ClaimVerificationInput {
	candidateId: string;
	candidateStableId: string;
	claim: string;
	claimType: ClaimType;
	sourceId: string;
	sourceUrl: string;
	sourceTitle: string;
	sourceAuthor?: string[];
	sourcePublisher?: string;
	publicationTimestamp: string;
	firstDisclosureTimestamp?: string;
	supportingEvidence: Omit<EvidenceReference, "id" | "retrievalMetadata">[];
	productContext?: ClaimVerificationRecord["productContext"];
	technicalContext?: ClaimVerificationRecord["technicalContext"];
	scientificContext?: ClaimVerificationRecord["scientificContext"];
	researchContext?: ClaimVerificationRecord["researchContext"];
	enterpriseContext?: ClaimVerificationRecord["enterpriseContext"];
	existingVerification?: Partial<ClaimVerificationRecord>;
}
