/**
 * Historical Regression — Schema Layer
 *
 * Defines the authoritative, versioned, machine-readable data contract for the
 * rolling seven-calendar-day historical regression report. The report is the
 * structured input consumed by the subsequent editorial selection stage; it is
 * NOT a competing canonical publication and NOT a redundant factual inventory.
 *
 * Processing sequence preserved:
 *   Source Discovery → Retrieval → Temporal Classification → Claim Verification
 *     → Canonical Fact Dossier → Omission Review
 *     → Seven-Day Historical Regression (this module)
 *     → Editorial Selection → Publication
 *
 * Hard rules:
 * - The seven-calendar-day historical comparison window is separate from the
 *   strict half-open 05:00–05:00 Europe/Amsterdam daily news eligibility window.
 * - The existing novelty classifier remains authoritative. Historical
 *   relationship classifications are stored separately and never override it.
 * - Missing historical editions are never interpreted as evidence that a story
 *   was not previously covered.
 * - Historical records remain immutable; regression findings are appended as
 *   new relationships and never rewrite original evidence.
 */

import { z } from "astro/zod";

// ============================================================================
// Constants
// ============================================================================

/** Current historical regression report schema version. */
export const HISTORICAL_REGRESSION_SCHEMA_VERSION = "1.0.0";

/** Prefix for historical regression report identifiers. */
export const HISTORICAL_REGRESSION_ID_PREFIX = "hr_";

/** Prefix for cross-edition traceability record identifiers. */
export const HISTORICAL_TRACEABILITY_ID_PREFIX = "htr_";

/** Number of preceding calendar dates inspected for historical regression. */
export const HISTORICAL_REGRESSION_DAYS = 7;

/** IANA timezone used for every date calculation in this module. */
export const HISTORICAL_REGRESSION_TIMEZONE = "Europe/Amsterdam";

/** Stable identifier patterns reused from the existing pipeline. */
export const HISTORICAL_ID_PATTERNS = {
	report: /^hr_[a-z0-9]{16}$/,
	traceability: /^htr_[a-z0-9]{16}$/,
	editionDate: /^\d{4}-\d{2}-\d{2}$/,
	edition: /^edition_\d{4}-\d{2}-\d{2}$/,
	candidate: /^cand_[a-z0-9]{16}$/,
	claim: /^claim_[a-z0-9]{16}$/,
} as const;

// ============================================================================
// Enumerations
// ============================================================================

/**
 * Availability of one historical edition.
 * - AVAILABLE: required historical information is accessible and sufficiently complete.
 * - PARTIAL: some historical information is accessible, but comparison is limited.
 * - UNAVAILABLE: no usable historical edition can be accessed.
 * - NOT_ASSESSABLE: available information is insufficient to establish reliable
 *   historical coverage.
 */
export const HistoricalEditionStatusSchema = z.enum([
	"AVAILABLE",
	"PARTIAL",
	"UNAVAILABLE",
	"NOT_ASSESSABLE",
]);

/**
 * Relationship between a current candidate and accessible historical coverage.
 * Stored separately from temporal novelty eligibility.
 */
export const HistoricalRelationshipClassificationSchema = z.enum([
	"NEW_DEVELOPMENT",
	"PREVIOUSLY_COVERED",
	"SUBSTANTIVE_UPDATE",
	"REPEATED_REPORTING",
	"RELATED_CONTEXT",
	"POTENTIAL_HISTORICAL_OMISSION",
	"HISTORY_UNVERIFIED",
]);

/** Deterministic signal that produced a historical match. */
export const HistoricalMatchTypeSchema = z.enum([
	"candidate-id",
	"claim-id",
	"source-url",
	"source-id",
	"entity",
	"timestamp",
	"semantic-similarity",
	"none",
]);

/** Categories of qualifying substantive change. */
export const SubstantiveUpdateTypeSchema = z.enum([
	"availability-change",
	"benchmark-change",
	"independent-replication",
	"security-incident",
	"behavior-change",
	"licensing-pricing-availability",
	"technical-limitation",
	"original-reporting",
	"follow-up-research",
	"strategic-research-revision",
	"measured-outcome",
	"methodology-change",
]);

/** Determination for a potential historical omission. */
export const HistoricalOmissionClassificationSchema = z.enum([
	"ALREADY_COVERED_ELSEWHERE",
	"PREVIOUSLY_DISCOVERED_NOT_SELECTED",
	"PREVIOUSLY_INACCESSIBLE",
	"NOT_DISCOVERED",
	"INSUFFICIENT_EVIDENCE",
	"NOT_ASSESSABLE",
]);

/** Final regression run status. */
export const HistoricalRegressionStatusSchema = z.enum([
	"COMPLETE",
	"PARTIAL",
	"UNAVAILABLE",
	"NOT_ASSESSABLE",
]);

/** How a relationship classification was derived. */
export const HistoricalRelationshipDerivationSchema = z.enum([
	"deterministic-matching",
	"semantic-comparison",
	"history-unavailable",
]);

/** Significance of a potential historical omission. */
export const HistoricalOmissionSignificanceSchema = z.enum([
	"critical",
	"high",
	"medium",
	"low",
]);

// ============================================================================
// Sub-records
// ============================================================================

export const HistoricalEditionWindowSchema = z.strictObject({
	editionDate: z.string().regex(HISTORICAL_ID_PATTERNS.editionDate),
	start: z.string().min(1),
	end: z.string().min(1),
	timezone: z.literal(HISTORICAL_REGRESSION_TIMEZONE),
	durationHours: z.number().int().positive(),
});

/** Availability and completeness of one historical edition. */
export const HistoricalEditionAvailabilitySchema = z.strictObject({
	editionDate: z.string().regex(HISTORICAL_ID_PATTERNS.editionDate),
	editionId: z.string().regex(HISTORICAL_ID_PATTERNS.edition),
	/** Whether any historical record exists for this edition date. */
	exists: z.boolean(),
	/** Canonical fact dossier for this edition is present and parseable. */
	dossierAvailable: z.boolean(),
	/** Canonical fact dossier passes schema/invariant validation. */
	dossierValid: z.boolean(),
	/** Research audit (omission review) for this edition is present and parseable. */
	researchAuditAvailable: z.boolean(),
	/** Research audit passes structural validation. */
	researchAuditValid: z.boolean(),
	/** Published article records attributable to this edition are present. */
	publishedArticleRecordsAvailable: z.boolean(),
	/** Candidate records (data/candidates/<date>.jsonl) are present and parseable. */
	candidateRecordsAvailable: z.boolean(),
	/** Discovery records (data/discovered/<date>.jsonl) are present and parseable. */
	discoveryRecordsAvailable: z.boolean(),
	/** Monitoring records (data/discovery-ledger/<date>_*.json) are present and parseable. */
	monitoringRecordsAvailable: z.boolean(),
	candidateIds: z.array(z.string()),
	claimIds: z.array(z.string()),
	sourceIds: z.array(z.string()),
	publicationIds: z.array(z.string()),
	/** Whether the edition can be reliably compared. */
	canBeReliablyCompared: z.boolean(),
	status: HistoricalEditionStatusSchema,
	missing: z.array(z.string()),
	notes: z.array(z.string()),
});

/** One deterministic (or flagged semantic) match between a current candidate and one historical edition. */
export const HistoricalMatchEvidenceSchema = z.strictObject({
	editionDate: z.string().regex(HISTORICAL_ID_PATTERNS.editionDate),
	editionId: z.string().regex(HISTORICAL_ID_PATTERNS.edition),
	matched: z.boolean(),
	matchType: HistoricalMatchTypeSchema,
	matchedCandidateIds: z.array(z.string()),
	matchedClaimIds: z.array(z.string()),
	matchedSourceIds: z.array(z.string()),
	/** Historical candidate implicated by a semantic similarity match, when any. */
	semanticMatchCandidateId: z.string().optional(),
	/** Normalized canonical URLs shared between the current and historical candidate. */
	matchedUrls: z.array(z.string()),
	sharedOrganizations: z.array(z.string()),
	sharedProducts: z.array(z.string()),
	sharedTechnologies: z.array(z.string()),
	sharedResearchDomains: z.array(z.string()),
	/** Deterministic token similarity of headline + exact statement (0-1). */
	headlineSimilarity: z.number().min(0).max(1),
	/** Deterministic token similarity of claim statements (0-1). */
	claimSimilarity: z.number().min(0).max(1),
	/** Publication / disclosure timestamps are equal (string equality after normalization). */
	timestampMatch: z.boolean(),
	previousPublicationId: z.string().optional(),
	evidenceReferences: z.array(z.string()),
	note: z.string(),
});

/** A qualifying substantive change relative to an earlier edition. */
export const SubstantiveUpdateFindingSchema = z.strictObject({
	updateTypes: z.array(SubstantiveUpdateTypeSchema).min(1),
	previousEditionDate: z.string().regex(HISTORICAL_ID_PATTERNS.editionDate),
	previousEditionId: z.string().regex(HISTORICAL_ID_PATTERNS.edition),
	previousCandidateId: z.string(),
	previousClaimIds: z.array(z.string()),
	currentClaimIds: z.array(z.string()),
	changedFacts: z.array(z.string()).min(1),
	evidenceUrls: z.array(z.string()),
	/** Timestamp of the newly disclosed information. */
	newInformationTimestamp: z.string(),
	/** Whether the newly disclosed facts qualify within the current edition window. */
	withinCurrentEditionWindow: z.boolean(),
	rationale: z.string(),
});

/** A new publication repeating established information without a qualifying change. */
export const RepeatedReportingFindingSchema = z.strictObject({
	previousEditionDate: z.string().regex(HISTORICAL_ID_PATTERNS.editionDate),
	previousEditionId: z.string().regex(HISTORICAL_ID_PATTERNS.edition),
	previousCandidateId: z.string(),
	previousClaimIds: z.array(z.string()),
	repeatedClaimIds: z.array(z.string()),
	qualifyingChange: z.literal(null),
	evidenceUrls: z.array(z.string()),
	rationale: z.string(),
});

/** A potential development that may have been missed by an earlier edition. */
export const HistoricalOmissionFindingSchema = z.strictObject({
	candidateId: z.string(),
	suspectedMissedEditionDate: z
		.string()
		.regex(HISTORICAL_ID_PATTERNS.editionDate),
	suspectedMissedEditionId: z.string().regex(HISTORICAL_ID_PATTERNS.edition),
	firstDisclosureTimestamp: z.string(),
	classification: HistoricalOmissionClassificationSchema,
	significance: HistoricalOmissionSignificanceSchema,
	rationale: z.string(),
	evidenceUrls: z.array(z.string()),
	/** Whether this may be proposed as explicitly dated CATCH_UP content. */
	proposedCatchUp: z.boolean(),
	catchUpNote: z.string().optional(),
});

/** Relationship classification for one current candidate. */
export const HistoricalRelationshipSchema = z.strictObject({
	candidateId: z.string(),
	editionDate: z.string().regex(HISTORICAL_ID_PATTERNS.editionDate),
	classification: HistoricalRelationshipClassificationSchema,
	confidence: z.number().min(0).max(1),
	matches: z.array(HistoricalMatchEvidenceSchema),
	primaryMatchEditionDate: z
		.string()
		.regex(HISTORICAL_ID_PATTERNS.editionDate)
		.optional(),
	primaryMatchCandidateId: z.string().optional(),
	primaryMatchType: HistoricalMatchTypeSchema.optional(),
	substantiveUpdate: SubstantiveUpdateFindingSchema.optional(),
	repeatedReporting: RepeatedReportingFindingSchema.optional(),
	historicalContext: z.array(z.string()),
	rationale: z.string(),
	derivedFrom: HistoricalRelationshipDerivationSchema,
	semanticComparisonUsed: z.boolean(),
});

// ============================================================================
// Historical regression report
// ============================================================================

export const HistoricalRegressionWindowSchema = z.strictObject({
	days: z.literal(HISTORICAL_REGRESSION_DAYS),
	timezone: z.literal(HISTORICAL_REGRESSION_TIMEZONE),
	/** Preceding calendar dates examined, ascending. */
	editionDates: z
		.array(z.string().regex(HISTORICAL_ID_PATTERNS.editionDate))
		.length(HISTORICAL_REGRESSION_DAYS),
	/** The strict daily news eligibility window is reported separately and unchanged. */
	dailyEligibilityWindow: HistoricalEditionWindowSchema,
	/** Explicit marker: historical regression never replaces/expands/shifts the daily window. */
	dailyEligibilityWindowUnchanged: z.literal(true),
});

export const HistoricalRegressionReportSchema = z.strictObject({
	schemaVersion: z.literal(HISTORICAL_REGRESSION_SCHEMA_VERSION),
	reportId: z.string().regex(HISTORICAL_ID_PATTERNS.report),
	editionId: z.string().regex(HISTORICAL_ID_PATTERNS.edition),
	editionDate: z.string().regex(HISTORICAL_ID_PATTERNS.editionDate),
	editionWindow: HistoricalEditionWindowSchema,
	executionId: z.string().min(1),
	executedAt: z.string().min(1),
	generatedBy: z.string().min(1),
	/** Current dossier version (dossierId) evaluated by this regression. */
	currentDossierVersion: z.string().min(1),
	currentDossierContentHash: z
		.string()
		.regex(/^sha256:[a-f0-9]{64}$/)
		.optional(),
	historicalWindow: HistoricalRegressionWindowSchema,
	historicalEditions: z.array(HistoricalEditionAvailabilitySchema),
	candidatesEvaluated: z.number().int().nonnegative(),
	relationships: z.array(HistoricalRelationshipSchema),
	substantiveUpdates: z.array(SubstantiveUpdateFindingSchema),
	repeatedReporting: z.array(RepeatedReportingFindingSchema),
	potentialOmissions: z.array(HistoricalOmissionFindingSchema),
	missingHistoricalEvidence: z.array(z.string()),
	unresolvedQuestions: z.array(z.string()),
	finalStatus: HistoricalRegressionStatusSchema,
	inferenceUsed: z.boolean(),
	inferenceNote: z.string().optional(),
	contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
});

// ============================================================================
// Cross-edition traceability record (append-only)
// ============================================================================

export const HistoricalTraceabilityRecordSchema = z.strictObject({
	recordId: z.string().regex(HISTORICAL_ID_PATTERNS.traceability),
	reportId: z.string().regex(HISTORICAL_ID_PATTERNS.report),
	editionDate: z.string().regex(HISTORICAL_ID_PATTERNS.editionDate),
	editionId: z.string().regex(HISTORICAL_ID_PATTERNS.edition),
	candidateId: z.string(),
	claimIds: z.array(z.string()),
	classification: HistoricalRelationshipClassificationSchema,
	previousEditionDate: z
		.string()
		.regex(HISTORICAL_ID_PATTERNS.editionDate)
		.optional(),
	previousEditionId: z
		.string()
		.regex(HISTORICAL_ID_PATTERNS.edition)
		.optional(),
	previousCandidateId: z.string().optional(),
	previousClaimIds: z.array(z.string()),
	previousPublicationId: z.string().optional(),
	evidenceUrls: z.array(z.string()),
	substantiveUpdateTypes: z.array(SubstantiveUpdateTypeSchema),
	semanticComparisonUsed: z.boolean(),
	executedAt: z.string().min(1),
});

// ============================================================================
// Inferred TypeScript types (single source of truth)
// ============================================================================

export type HistoricalEditionStatus = z.infer<
	typeof HistoricalEditionStatusSchema
>;
export type HistoricalRelationshipClassification = z.infer<
	typeof HistoricalRelationshipClassificationSchema
>;
export type HistoricalMatchType = z.infer<typeof HistoricalMatchTypeSchema>;
export type SubstantiveUpdateType = z.infer<typeof SubstantiveUpdateTypeSchema>;
export type HistoricalOmissionClassification = z.infer<
	typeof HistoricalOmissionClassificationSchema
>;
export type HistoricalRegressionStatus = z.infer<
	typeof HistoricalRegressionStatusSchema
>;
export type HistoricalRelationshipDerivation = z.infer<
	typeof HistoricalRelationshipDerivationSchema
>;
export type HistoricalOmissionSignificance = z.infer<
	typeof HistoricalOmissionSignificanceSchema
>;

export type HistoricalEditionWindow = z.infer<
	typeof HistoricalEditionWindowSchema
>;
export type HistoricalEditionAvailability = z.infer<
	typeof HistoricalEditionAvailabilitySchema
>;
export type HistoricalMatchEvidence = z.infer<
	typeof HistoricalMatchEvidenceSchema
>;
export type SubstantiveUpdateFinding = z.infer<
	typeof SubstantiveUpdateFindingSchema
>;
export type RepeatedReportingFinding = z.infer<
	typeof RepeatedReportingFindingSchema
>;
export type HistoricalOmissionFinding = z.infer<
	typeof HistoricalOmissionFindingSchema
>;
export type HistoricalRelationship = z.infer<
	typeof HistoricalRelationshipSchema
>;
export type HistoricalRegressionWindow = z.infer<
	typeof HistoricalRegressionWindowSchema
>;
export type HistoricalRegressionReport = z.infer<
	typeof HistoricalRegressionReportSchema
>;
export type HistoricalTraceabilityRecord = z.infer<
	typeof HistoricalTraceabilityRecordSchema
>;

// ============================================================================
// JSON Schema generation (single source of truth → machine-readable contract)
// ============================================================================

/**
 * Generate the draft-07 JSON Schema for the historical regression report.
 * Written to `data/schemas/historical-regression.json` so the on-disk contract
 * and the TypeScript contract stay in sync.
 */
export function generateHistoricalRegressionJsonSchema(): Record<
	string,
	unknown
> {
	const generated = z.toJSONSchema(HistoricalRegressionReportSchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/historical-regression.json",
		title: "Historical Regression Report",
		description:
			"Structured findings from the rolling seven-calendar-day historical regression stage. Compares the current canonical fact dossier against accessible previous editions and their supporting evidence without redefining the strict daily news eligibility window and without modifying previously published editions.",
		...generated,
	};
}
