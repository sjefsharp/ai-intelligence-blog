/**
 * Canonical Fact Dossier — Schema Layer
 *
 * Defines the authoritative, versioned, machine-readable data contract for the
 * per-edition canonical fact dossier. The dossier is the single factual
 * foundation consumed by every downstream representation (newsletter, website,
 * visual explanations, technical audit).
 *
 * Design rules:
 * - Schemas are defined with Zod (TypeScript schemas) and inferred into static
 *   types, so the runtime validator and the compile-time types cannot drift.
 * - A JSON Schema (draft-07) is generated from the same Zod schemas via
 *   `z.toJSONSchema`, so the on-disk data contract and the TypeScript contract
 *   are generated from one source of truth.
 * - Every identifier pattern reuses the existing stable identifier conventions
 *   (cand_, claim_, disc_, source registry kebab-case, edition_YYYY-MM-DD).
 * - The dossier never performs editorial ranking, quotas, weights or publication
 *   decisions. Readiness indicators are descriptive and traceable only.
 */

import { z } from "astro/zod";

// ============================================================================
// Constants
// ============================================================================

/** Current canonical fact dossier schema version. */
export const FACT_DOSSIER_SCHEMA_VERSION = "1.0.0";

/** Prefix for canonical fact dossier identifiers. */
export const FACT_DOSSIER_ID_PREFIX = "fd_";

/** Prefix for edition identifiers. */
export const EDITION_ID_PREFIX = "edition_";

/** Stable identifier patterns reused from the existing pipeline. */
export const ID_PATTERNS = {
	candidate: /^cand_[a-z0-9]{16}$/,
	claim: /^claim_[a-z0-9]{16}$/,
	discovery: /^disc_[a-z0-9]{16}$/,
	dossier: /^fd_[a-z0-9]{16}$/,
	edition: /^edition_\d{4}-\d{2}-\d{2}$/,
	editionDate: /^\d{4}-\d{2}-\d{2}$/,
	source: /^[a-z0-9-]+$/,
	subdomain: /^DOM-\d{2}-SD\d{2}$/,
} as const;

// ============================================================================
// Enumerations (inherited from the existing pipeline — never redefined)
// ============================================================================

/** Evidence classification — inherited verbatim from evidence-verification. */
export const EvidenceClassificationSchema = z.enum([
	"VERIFIED_FACT",
	"VENDOR_CLAIM",
	"RESEARCH_FINDING",
	"ORIGINAL_REPORTING",
	"EXPERT_INTERPRETATION",
	"INFERENCE",
	"SPECULATION",
	"UNVERIFIED",
]);

/** Verification status — inherited verbatim from evidence-verification. */
export const VerificationStatusSchema = z.enum([
	"verified",
	"partially-verified",
	"unverified",
	"contradicted",
	"insufficient-evidence",
	"downgraded",
	"retracted",
	"superseded",
]);

/** Verification level per contract §4.1. */
export const VerificationLevelSchema = z.enum(["L0", "L1", "L2", "L3"]);

/** Claim type — inherited verbatim from evidence-verification. */
export const ClaimTypeSchema = z.enum([
	"technical-announcement",
	"software-release",
	"scientific-research",
	"benchmark-result",
	"strategic-research",
	"advisory-finding",
	"enterprise-adoption",
	"productivity-claim",
	"roi-claim",
	"economic-impact",
	"original-reporting",
	"vendor-announcement",
	"policy-regulation",
	"security-vulnerability",
]);

/** Verification method — inherited verbatim from evidence-verification. */
export const VerificationMethodSchema = z.enum([
	"primary-source-inspection",
	"methodology-review",
	"artifact-reproduction",
	"independent-replication",
	"cross-reference",
	"expert-consultation",
	"statistical-analysis",
	"source-document-review",
	"api-documentation-check",
	"benchmark-methodology-audit",
	"paywall-accessible-review",
]);

/** Timestamp type — inherited verbatim from evidence-verification. */
export const TimestampTypeSchema = z.enum([
	"original-publication",
	"first-public-disclosure",
	"underlying-event",
	"substantive-update",
	"retrieval",
	"indexing",
]);

/** Retrieval status — inherited verbatim from discovery-ledger. */
export const RetrievalStatusSchema = z.enum([
	"CHECKED_FOUND",
	"CHECKED_NONE",
	"INACCESSIBLE",
	"NOT_CHECKED",
	"ERROR",
]);

/** Discovery ring — inherited verbatim from the collection pipeline. */
export const DiscoveryRingSchema = z.union([
	z.literal(1),
	z.literal(2),
	z.literal(3),
]);

/**
 * Temporal eligibility gate derived from the inherited novelty classification.
 * This is a deterministic derivation, not an independent novelty decision:
 * - NEW_PASS: classification NEW and not a repost/summary of established info.
 * - NEW_FAIL: classification NEW but identified as a repost/summary.
 * - TIME_UNVERIFIED: publication time could not be verified.
 * - CATCH_UP: explicitly dated older material with traceable evidence.
 */
export const TemporalEligibilityStatusSchema = z.enum([
	"NEW_PASS",
	"NEW_FAIL",
	"TIME_UNVERIFIED",
	"CATCH_UP",
]);

/** Lifecycle status of the canonical dossier. */
export const DossierStatusSchema = z.enum([
	"draft",
	"consolidating",
	"ready-for-omission-review",
	"complete",
	"partial",
	"failed",
]);

/** Per-candidate processing status. */
export const ProcessingStatusSchema = z.enum([
	"pending",
	"consolidated",
	"failed",
	"skipped",
]);

/** Release maturity — inherited from evidence-verification product context. */
export const ReleaseMaturitySchema = z.enum([
	"ga",
	"preview",
	"experimental",
	"deprecated",
	"unknown",
]);

/** Availability — inherited from evidence-verification product context. */
export const AvailabilitySchema = z.enum([
	"general",
	"limited",
	"waitlist",
	"internal",
	"unknown",
]);

/** Implementation status — inherited from evidence-verification technical context. */
export const ImplementationStatusSchema = z.enum([
	"released",
	"preview",
	"announced",
	"research",
	"unknown",
]);

/** Causal claim type — inherited from evidence-verification research context. */
export const CausalClaimTypeSchema = z.enum([
	"correlation",
	"causation",
	"prediction",
	"interpretation",
]);

/** Contradiction type — inherited from evidence-verification counterevidence. */
export const ContradictionTypeSchema = z.enum([
	"direct",
	"qualifying",
	"contextual",
	"methodological",
]);

/** Replication result — inherited from evidence-verification scientific context. */
export const ReplicationResultSchema = z.enum([
	"confirmed",
	"partial",
	"failed",
	"mixed",
]);

/** Access limitation type — inherited from discovery-ledger. */
export const AccessLimitationTypeSchema = z.enum([
	"paywall",
	"authentication-required",
	"rate-limited",
	"cloudflare-protection",
	"cors",
	"no-native-rss",
	"intermittent",
	"deprecated",
	"geographic",
	"other",
]);

/** Access limitation severity — inherited from discovery-ledger. */
export const AccessLimitationSeveritySchema = z.enum([
	"blocks-all",
	"blocks-partial",
	"degrades-quality",
	"informational",
]);

/** Previous coverage relationship type. */
export const PreviousCoverageRelationshipSchema = z.enum([
	"same-event",
	"same-development",
	"related-topic",
	"substantive-update",
]);

/** Edition-level uncertainty type. */
export const EditionUncertaintyTypeSchema = z.enum([
	"evidence-gap",
	"methodological",
	"definitional",
	"temporal",
	"scope",
	"generalizability",
	"historical-continuity",
	"access-limitation",
]);

/** Readiness indicator level. */
export const ReadinessLevelSchema = z.enum([
	"high",
	"medium",
	"low",
	"unclear",
]);

/** Processing step status. */
export const ProcessingStepStatusSchema = z.enum([
	"pending",
	"running",
	"completed",
	"failed",
	"skipped",
]);

// ============================================================================
// Inherited novelty classification (consumed verbatim)
// ============================================================================

export const ClassificationEvidenceSchema = z.strictObject({
	type: z.enum([
		"source_publication_date",
		"source_modification_date",
		"archive_snapshot",
		"author_statement",
		"version_history",
	]),
	reference: z.string(),
	timestamp: z.string(),
	description: z.string(),
	confidence: z.number().min(0).max(1),
});

/**
 * The full novelty classification result produced by `classifyNovelty`.
 * The dossier stores this verbatim as provenance; it never re-decides novelty.
 */
export const NoveltyClassificationResultSchema = z.strictObject({
	classification: z.enum(["NEW", "CATCH_UP", "TIME_UNVERIFIED"]),
	editionDate: z.string(),
	inWindow: z.boolean(),
	evidence: z.array(ClassificationEvidenceSchema),
	reasoning: z.string(),
	primaryPublicationTimestamp: z.string(),
	isSubstantiveUpdate: z.boolean(),
	isNewlyRevealedFact: z.boolean(),
	confidence: z.number().min(0).max(1),
	isRepostOrSummary: z.optional(z.boolean()),
});

// ============================================================================
// Shared sub-records
// ============================================================================

export const AccessLimitationSchema = z.strictObject({
	type: AccessLimitationTypeSchema,
	description: z.string(),
	affectedSections: z.array(z.string()),
	workaround: z.optional(z.string()),
	severity: AccessLimitationSeveritySchema,
	firstObserved: z.string(),
	lastObserved: z.string(),
});

export const EditionWindowSchema = z.strictObject({
	editionDate: z.string().regex(ID_PATTERNS.editionDate),
	start: z.string(),
	end: z.string(),
	timezone: z.literal("Europe/Amsterdam"),
	durationHours: z.number().int().positive(),
});

export const CanonicalSourceReferenceSchema = z.strictObject({
	sourceId: z.string().regex(ID_PATTERNS.source),
	canonicalUrl: z.string().url(),
	title: z.optional(z.string()),
	tier: z.optional(z.union([z.literal(1), z.literal(2), z.literal(3)])),
	discoveryIds: z.array(z.string()),
	retrievalStatus: RetrievalStatusSchema,
	accessedAt: z.optional(z.string()),
});

export const CandidateTimestampsSchema = z.strictObject({
	/** Original publication timestamp; absent when no traceable value exists. */
	originalPublicationTimestamp: z.optional(z.string()),
	/** Earliest supported public disclosure timestamp (distinct from publication). */
	earliestSupportedPublicDisclosureTimestamp: z.optional(z.string()),
	/** Underlying event date, when different from publication/disclosure. */
	underlyingEventDate: z.optional(z.string()),
	/** Substantive update timestamp, when the item updates prior reporting. */
	substantiveUpdateTimestamp: z.optional(z.string()),
	/** When the source was retrieved by the pipeline. */
	retrievalTimestamp: z.string().min(1),
	/** Timezone applicable to the source timestamps. */
	timezone: z.string(),
	/** Confidence in the timestamp values (0-1). */
	timestampConfidence: z.number().min(0).max(1),
	/** Precision of the timestamp evidence. */
	timestampPrecision: z.enum([
		"exact",
		"source-stated",
		"inferred",
		"unknown",
	]),
	/** Explicit availability marker so missing metadata is never silently inferred. */
	timestampAvailability: z.enum(["available", "partial", "unavailable"]),
});

export const TemporalEligibilitySchema = z.strictObject({
	status: TemporalEligibilityStatusSchema,
	rationale: z.string(),
	noveltyClassification: NoveltyClassificationResultSchema,
	editionBoundary: z.strictObject({
		start: z.string(),
		end: z.string(),
		timezone: z.literal("Europe/Amsterdam"),
	}),
	/** Timestamp used for the publication-date-first classification, if available. */
	publicationTimestampUsed: z.optional(z.string()),
	/** First-disclosure timestamp used for the classification, if distinct/available. */
	firstDisclosureTimestampUsed: z.optional(z.string()),
	/** Underlying event timestamp used for the classification, if distinct/available. */
	underlyingEventTimestampUsed: z.optional(z.string()),
	derivedFrom: z.literal("novelty-classification"),
	derivedAt: z.string(),
});

export const PreviousCoverageReferenceSchema = z.strictObject({
	editionDate: z.string().regex(ID_PATTERNS.editionDate),
	editionId: z.string().regex(ID_PATTERNS.edition),
	candidateId: z.optional(z.string().regex(ID_PATTERNS.candidate)),
	publicationId: z.optional(z.string()),
	relationship: PreviousCoverageRelationshipSchema,
	available: z.boolean(),
	evidenceUrl: z.optional(z.string().url()),
	note: z.optional(z.string()),
});

export const SourceAccessibilityRecordSchema = z.strictObject({
	sourceId: z.string().regex(ID_PATTERNS.source),
	canonicalUrl: z.string().url(),
	retrievalStatus: RetrievalStatusSchema,
	accessible: z.boolean(),
	accessMethod: z.optional(z.string()),
	limitations: z.array(AccessLimitationSchema),
	lastCheckedAt: z.optional(z.string()),
	note: z.optional(z.string()),
});

// ============================================================================
// Claim-level factual consolidation
// ============================================================================

export const IndependentCorroborationSchema = z.strictObject({
	established: z.boolean(),
	sourceIds: z.array(z.string()),
	urls: z.array(z.string().url()),
	method: z.optional(VerificationMethodSchema),
	note: z.optional(z.string()),
});

export const ContradictoryEvidenceSchema = z.strictObject({
	evidenceId: z.string(),
	sourceId: z.string(),
	url: z.string().url(),
	contradictionType: ContradictionTypeSchema,
	description: z.string(),
	confidence: z.number().min(0).max(1),
});

export const TechnicalContextSchema = z.strictObject({
	mechanism: z.optional(z.string()),
	architecture: z.optional(z.array(z.string())),
	capabilities: z.optional(z.array(z.string())),
	limitations: z.optional(z.array(z.string())),
	productVersion: z.optional(z.string()),
	releaseMaturity: z.optional(ReleaseMaturitySchema),
	compatibility: z.optional(z.array(z.string())),
	agenticImplications: z.optional(z.array(z.string())),
	securityAssumptions: z.optional(z.array(z.string())),
	trustBoundaries: z.optional(z.array(z.string())),
	implementationStatus: z.optional(ImplementationStatusSchema),
});

export const BenchmarkConditionsSchema = z.strictObject({
	warmupRuns: z.boolean(),
	batchSize: z.optional(z.number().int().nonnegative()),
	precision: z.optional(z.string()),
	hardwareSpecified: z.boolean(),
	confoundersAddressed: z.array(z.string()),
});

export const ReproducibilitySchema = z.strictObject({
	artifactAvailable: z.boolean(),
	artifactUrl: z.optional(z.string().url()),
	independentReplications: z.number().int().nonnegative(),
	replicationResults: z.optional(ReplicationResultSchema),
});

export const MethodologicalContextSchema = z.strictObject({
	studyDesign: z.optional(z.string()),
	methodology: z.optional(z.string()),
	dataset: z.optional(z.string()),
	evaluationConditions: z.optional(z.string()),
	benchmarkConditions: z.optional(BenchmarkConditionsSchema),
	reproducibility: z.optional(ReproducibilitySchema),
	alternativeExplanations: z.optional(z.array(z.string())),
	counterevidence: z.optional(z.array(z.string())),
});

export const StrategicContextSchema = z.strictObject({
	researchPurpose: z.optional(z.string()),
	sampleSize: z.optional(z.number().int().nonnegative()),
	sampleComposition: z.optional(z.string()),
	geographicScope: z.optional(z.string()),
	industryCoverage: z.optional(z.string()),
	researchPeriod: z.optional(z.string()),
	measuredOutcome: z.optional(z.string()),
	baseline: z.optional(z.string()),
	statisticalUncertainty: z.optional(z.string()),
	fundingSources: z.optional(z.array(z.string())),
	conflictsOfInterest: z.optional(z.array(z.string())),
	causalClaimType: z.optional(CausalClaimTypeSchema),
	generalizability: z.optional(z.string()),
	enterpriseImplications: z.optional(z.array(z.string())),
	productivityConsequences: z.optional(z.array(z.string())),
	economicImpact: z.optional(z.array(z.string())),
	workforceImplications: z.optional(z.array(z.string())),
	governanceImplications: z.optional(z.array(z.string())),
	competingExplanations: z.optional(z.array(z.string())),
});

export const ClaimUncertaintySchema = z.strictObject({
	unresolved: z.array(
		z.strictObject({
			type: z.string(),
			uncertainty: z.string(),
			impact: z.enum(["high", "medium", "low"]),
			blocking: z.boolean(),
		}),
	),
	assumptions: z.array(z.string()),
	falsificationCriteria: z.array(z.string()),
});

export const ClaimSourceProvenanceSchema = z.strictObject({
	sourceId: z.string(),
	url: z.string().url(),
	title: z.string(),
	publicationTimestamp: z.string(),
	firstDisclosureTimestamp: z.optional(z.string()),
	retrievedAt: z.string(),
	verificationTimestamp: z.string(),
	verifiedBy: z.string(),
});

export const ProductContextSchema = z.strictObject({
	productName: z.string(),
	version: z.string(),
	releaseMaturity: ReleaseMaturitySchema,
	availability: z.enum([
		"general",
		"limited",
		"waitlist",
		"internal",
		"unknown",
	]),
	rolloutRestrictions: z.array(z.string()).optional(),
	licensing: z.string().optional(),
	pricing: z.string().optional(),
});

export const ConsolidatedClaimSchema = z.strictObject({
	claimId: z.string().regex(ID_PATTERNS.claim),
	candidateId: z.string().regex(ID_PATTERNS.candidate),
	claimStatement: z.string().min(1),
	claimType: ClaimTypeSchema,
	evidenceClassification: EvidenceClassificationSchema,
	supportingEvidenceUrls: z.array(z.string().url()),
	independentCorroboration: z.optional(IndependentCorroborationSchema),
	contradictoryEvidence: z.array(ContradictoryEvidenceSchema),
	limitingEvidence: z.array(z.string()),
	technicalContext: z.optional(TechnicalContextSchema),
	productContext: z.optional(ProductContextSchema),
	methodologicalContext: z.optional(MethodologicalContextSchema),
	strategicContext: z.optional(StrategicContextSchema),
	confidence: z.number().min(0).max(1),
	verificationLevel: VerificationLevelSchema,
	verificationStatus: VerificationStatusSchema,
	verificationRationale: z.string(),
	verificationMethods: z.array(VerificationMethodSchema),
	uncertainty: ClaimUncertaintySchema,
	sourceProvenance: ClaimSourceProvenanceSchema,
	inclusionNote: z.string(),
});

// ============================================================================
// Editorial readiness (descriptive only — no ranking, quotas or weights)
// ============================================================================

export const ReadinessIndicatorSchema = z.strictObject({
	level: ReadinessLevelSchema,
	evidence: z.array(z.string()),
	traceableTo: z.array(z.string()),
});

export const SELECTION_NOTE =
	"Descriptive indicators only — no editorial ranking, quotas, topic weights or publication decisions are made at this stage.";

export const EditorialReadinessIndicatorsSchema = z.strictObject({
	materialNovelty: ReadinessIndicatorSchema,
	technicalScientificSignificance: ReadinessIndicatorSchema,
	realWorldConsequences: ReadinessIndicatorSchema,
	enterpriseEconomicImplications: ReadinessIndicatorSchema,
	generalizability: ReadinessIndicatorSchema,
	evidenceStrength: ReadinessIndicatorSchema,
	evidenceLimitations: ReadinessIndicatorSchema,
	practicalEngineeringRelevance: ReadinessIndicatorSchema,
	availabilityMaturity: ReadinessIndicatorSchema,
	potentialOverlap: ReadinessIndicatorSchema,
	selectionNote: z.literal(SELECTION_NOTE),
});

// ============================================================================
// Canonical candidate record
// ============================================================================

export const CandidateAuditSchema = z.strictObject({
	discoveredAt: z.optional(z.string()),
	retrievedAt: z.string(),
	noveltyClassifiedAt: z.string(),
	claimsVerifiedAt: z.optional(z.string()),
	consolidatedAt: z.string(),
	consolidatedBy: z.string(),
	revision: z.number().int().nonnegative(),
});

/** Optional model-assisted enrichment provenance. Never implied verification. */
export const CandidateEnrichmentSchema = z.strictObject({
	status: z.enum(["enriched", "unavailable", "disabled", "failed"]),
	exactStatementSource: z.enum(["deterministic", "model-assisted"]),
	note: z.optional(z.string()),
	provider: z.optional(z.string()),
	model: z.optional(z.string()),
	enrichedAt: z.optional(z.string()),
});

export const CandidateProvenanceSchema = z.strictObject({
	discoveryIds: z.array(z.string()),
	candidateStableId: z.optional(z.string()),
	pipeline: z.array(z.string()),
	consumedFrom: z.array(z.string()),
});

export const CanonicalCandidateSchema = z.strictObject({
	candidateId: z.string().regex(ID_PATTERNS.candidate),
	editionId: z.string().regex(ID_PATTERNS.edition),
	editionDate: z.string().regex(ID_PATTERNS.editionDate),
	factualHeadline: z.string().min(1),
	exactStatement: z.string().min(1),
	researchDomains: z.array(z.string()),
	subdomainTags: z.array(z.string().regex(ID_PATTERNS.subdomain)),
	discoveryRings: z.array(DiscoveryRingSchema).min(1),
	organizations: z.array(z.string()),
	products: z.array(z.string()),
	technologies: z.array(z.string()),
	researchProjects: z.array(z.string()),
	sources: z.array(CanonicalSourceReferenceSchema).min(1),
	timestamps: CandidateTimestampsSchema,
	temporalEligibility: TemporalEligibilitySchema,
	previousCoverage: z.array(PreviousCoverageReferenceSchema),
	sourceAccessibility: z.array(SourceAccessibilityRecordSchema),
	claims: z.array(ConsolidatedClaimSchema),
	unresolvedQuestions: z.array(z.string()),
	evidenceGaps: z.array(z.string()),
	editorialReadiness: EditorialReadinessIndicatorsSchema,
	processingStatus: ProcessingStatusSchema,
	processingNote: z.optional(z.string()),
	enrichment: z.optional(CandidateEnrichmentSchema),
	audit: CandidateAuditSchema,
	provenance: CandidateProvenanceSchema,
});

// ============================================================================
// Edition-level aggregate records
// ============================================================================

export const EditionSummarySchema = z.strictObject({
	totalCandidates: z.number().int().nonnegative(),
	byTemporalEligibility: z.record(z.string(), z.number().int().nonnegative()),
	byEvidenceClassification: z.record(
		z.string(),
		z.number().int().nonnegative(),
	),
	byVerificationStatus: z.record(z.string(), z.number().int().nonnegative()),
	byResearchDomain: z.record(z.string(), z.number().int().nonnegative()),
	totalClaims: z.number().int().nonnegative(),
	claimsWithCounterevidence: z.number().int().nonnegative(),
	claimsWithUnresolvedUncertainties: z.number().int().nonnegative(),
	candidatesWithEvidenceGaps: z.number().int().nonnegative(),
	averageClaimConfidence: z.number().min(0).max(1),
	strategicResearchCandidates: z.number().int().nonnegative(),
	technicalCandidates: z.number().int().nonnegative(),
});

export const EditionUncertaintySchema = z.strictObject({
	uncertaintyId: z.string().min(1),
	candidateId: z.optional(z.string().regex(ID_PATTERNS.candidate)),
	claimId: z.optional(z.string().regex(ID_PATTERNS.claim)),
	type: EditionUncertaintyTypeSchema,
	description: z.string().min(1),
	impact: z.enum(["high", "medium", "low"]),
	blocking: z.boolean(),
	researchNeeded: z.string().min(1),
});

export const HistoricalContinuityRecordSchema = z.strictObject({
	candidateId: z.string().regex(ID_PATTERNS.candidate),
	checkedEditionDates: z.array(z.string().regex(ID_PATTERNS.editionDate)),
	missingEditions: z.array(z.string().regex(ID_PATTERNS.editionDate)),
	note: z.string(),
});

export const ProcessingStepSchema = z.strictObject({
	step: z.string(),
	status: ProcessingStepStatusSchema,
	startedAt: z.optional(z.string()),
	completedAt: z.optional(z.string()),
	inputCount: z.optional(z.number().int().nonnegative()),
	outputCount: z.optional(z.number().int().nonnegative()),
	error: z.optional(z.string()),
});

export const ProcessingAuditSchema = z.strictObject({
	startedAt: z.string(),
	completedAt: z.optional(z.string()),
	durationMs: z.number().int().nonnegative(),
	steps: z.array(ProcessingStepSchema),
	completedCandidateIds: z.array(z.string()),
	failedCandidateIds: z.array(z.string()),
	skippedCandidateIds: z.array(z.string()),
	resumePoint: z.optional(z.string()),
	inferenceUsed: z.boolean(),
	inferenceNote: z.optional(z.string()),
});

// ============================================================================
// Canonical fact dossier (one authoritative logical dossier per edition)
// ============================================================================

export const CanonicalFactDossierSchema = z.strictObject({
	schemaVersion: z.literal(FACT_DOSSIER_SCHEMA_VERSION),
	dossierId: z.string().regex(ID_PATTERNS.dossier),
	editionId: z.string().regex(ID_PATTERNS.edition),
	editionDate: z.string().regex(ID_PATTERNS.editionDate),
	editionWindow: EditionWindowSchema,
	status: DossierStatusSchema,
	createdAt: z.string(),
	updatedAt: z.string(),
	generatedBy: z.string(),
	candidates: z.array(CanonicalCandidateSchema),
	editionSummary: EditionSummarySchema,
	uncertaintyRegister: z.array(EditionUncertaintySchema),
	historicalContinuity: z.array(HistoricalContinuityRecordSchema),
	processingAudit: ProcessingAuditSchema,
	contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
	previousVersionHash: z.optional(z.string().regex(/^sha256:[a-f0-9]{64}$/)),
});

// ============================================================================
// Inferred TypeScript types (single source of truth)
// ============================================================================

export type EvidenceClassification = z.infer<
	typeof EvidenceClassificationSchema
>;
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;
export type VerificationLevel = z.infer<typeof VerificationLevelSchema>;
export type ClaimType = z.infer<typeof ClaimTypeSchema>;
export type VerificationMethod = z.infer<typeof VerificationMethodSchema>;
export type TimestampType = z.infer<typeof TimestampTypeSchema>;
export type RetrievalStatus = z.infer<typeof RetrievalStatusSchema>;
export type DiscoveryRing = z.infer<typeof DiscoveryRingSchema>;
export type TemporalEligibilityStatus = z.infer<
	typeof TemporalEligibilityStatusSchema
>;
export type DossierStatus = z.infer<typeof DossierStatusSchema>;
export type ProcessingStatus = z.infer<typeof ProcessingStatusSchema>;
export type ReleaseMaturity = z.infer<typeof ReleaseMaturitySchema>;
export type Availability = z.infer<typeof AvailabilitySchema>;
export type ImplementationStatus = z.infer<typeof ImplementationStatusSchema>;
export type CausalClaimType = z.infer<typeof CausalClaimTypeSchema>;
export type ContradictionType = z.infer<typeof ContradictionTypeSchema>;
export type ReplicationResult = z.infer<typeof ReplicationResultSchema>;
export type AccessLimitationType = z.infer<typeof AccessLimitationTypeSchema>;
export type AccessLimitationSeverity = z.infer<
	typeof AccessLimitationSeveritySchema
>;
export type PreviousCoverageRelationship = z.infer<
	typeof PreviousCoverageRelationshipSchema
>;
export type EditionUncertaintyType = z.infer<
	typeof EditionUncertaintyTypeSchema
>;
export type ReadinessLevel = z.infer<typeof ReadinessLevelSchema>;
export type ProcessingStepStatus = z.infer<typeof ProcessingStepStatusSchema>;

export type ClassificationEvidence = z.infer<
	typeof ClassificationEvidenceSchema
>;
export type NoveltyClassificationResult = z.infer<
	typeof NoveltyClassificationResultSchema
>;
export type AccessLimitation = z.infer<typeof AccessLimitationSchema>;
export type EditionWindow = z.infer<typeof EditionWindowSchema>;
export type CanonicalSourceReference = z.infer<
	typeof CanonicalSourceReferenceSchema
>;
export type CandidateTimestamps = z.infer<typeof CandidateTimestampsSchema>;
export type TemporalEligibility = z.infer<typeof TemporalEligibilitySchema>;
export type PreviousCoverageReference = z.infer<
	typeof PreviousCoverageReferenceSchema
>;
export type SourceAccessibilityRecord = z.infer<
	typeof SourceAccessibilityRecordSchema
>;
export type IndependentCorroboration = z.infer<
	typeof IndependentCorroborationSchema
>;
export type ContradictoryEvidence = z.infer<typeof ContradictoryEvidenceSchema>;
export type TechnicalContext = z.infer<typeof TechnicalContextSchema>;
export type BenchmarkConditions = z.infer<typeof BenchmarkConditionsSchema>;
export type Reproducibility = z.infer<typeof ReproducibilitySchema>;
export type MethodologicalContext = z.infer<typeof MethodologicalContextSchema>;
export type StrategicContext = z.infer<typeof StrategicContextSchema>;
export type ClaimUncertainty = z.infer<typeof ClaimUncertaintySchema>;
export type ClaimSourceProvenance = z.infer<typeof ClaimSourceProvenanceSchema>;
export type ConsolidatedClaim = z.infer<typeof ConsolidatedClaimSchema>;
export type ReadinessIndicator = z.infer<typeof ReadinessIndicatorSchema>;
export type EditorialReadinessIndicators = z.infer<
	typeof EditorialReadinessIndicatorsSchema
>;
export type CandidateAudit = z.infer<typeof CandidateAuditSchema>;
export type CandidateProvenance = z.infer<typeof CandidateProvenanceSchema>;
export type CanonicalCandidate = z.infer<typeof CanonicalCandidateSchema>;
export type EditionSummary = z.infer<typeof EditionSummarySchema>;
export type EditionUncertainty = z.infer<typeof EditionUncertaintySchema>;
export type HistoricalContinuityRecord = z.infer<
	typeof HistoricalContinuityRecordSchema
>;
export type ProcessingStep = z.infer<typeof ProcessingStepSchema>;
export type ProcessingAudit = z.infer<typeof ProcessingAuditSchema>;
export type CanonicalFactDossier = z.infer<typeof CanonicalFactDossierSchema>;

/** Candidate record before editorial readiness indicators are attached. */
export type CanonicalCandidateCore = Omit<
	CanonicalCandidate,
	"editorialReadiness"
>;

// ============================================================================
// JSON Schema generation (single source of truth → machine-readable contract)
// ============================================================================

/**
 * Generate the draft-07 JSON Schema for the canonical fact dossier.
 * The output is written to `data/schemas/canonical-fact-dossier.json` so the
 * on-disk contract and the TypeScript contract stay in sync.
 */
export function generateCanonicalFactDossierJsonSchema(): Record<
	string,
	unknown
> {
	const generated = z.toJSONSchema(CanonicalFactDossierSchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/canonical-fact-dossier.json",
		title: "Canonical Fact Dossier",
		description:
			"Authoritative per-edition factual foundation consumed by every downstream representation. Consolidates verified research findings, source evidence, temporal eligibility, technical explanations, strategic implications and unresolved uncertainty without duplicating or replacing discovery, novelty classification or claim verification.",
		...generated,
	};
}
