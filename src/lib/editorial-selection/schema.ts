/**
 * Editorial Selection — Schema Layer
 *
 * Defines the authoritative, versioned, machine-readable data contract for the
 * per-edition editorial selection manifest. The manifest is the single
 * structured hand-off from research to publication: it records which verified
 * developments were selected, merged, excluded or deferred, why, and in what
 * order they should be published.
 *
 * Processing sequence preserved:
 *   Source Discovery → Retrieval → Temporal Classification → Claim Verification
 *     → Canonical Fact Dossier → Omission Review
 *     → Seven-Day Historical Regression
 *     → Editorial Selection (this module)
 *     → Publication
 *
 * Hard rules:
 * - Every editorial candidate originates from the canonical fact dossier.
 * - Temporal and evidentiary eligibility gates remain authoritative; this stage
 *   never re-decides novelty or re-verifies claims.
 * - No fixed vendor quotas, artificial topic diversity or mandatory supplier
 *   representation are introduced.
 * - Numerical ranking is a documented, deterministic heuristic over
 *   evidence-backed levels — never an apparently objective measurement.
 * - Exclusions, uncertainty, trade-offs and selection rationale are recorded.
 * - The manifest is consumable by downstream Dutch and English publication
 *   generators without requiring them to re-select or reinterpret the news.
 */

import { z } from "astro/zod";

import {
	DiscoveryRingSchema,
	EditionWindowSchema,
	ReadinessLevelSchema,
	TemporalEligibilityStatusSchema,
} from "../fact-dossier/schema.js";
import { HistoricalRelationshipClassificationSchema } from "../historical-regression/schema.js";

// ============================================================================
// Constants
// ============================================================================

/** Current editorial selection manifest schema version. */
export const EDITORIAL_SELECTION_SCHEMA_VERSION = "1.0.0";

/** Prefix for editorial selection manifest identifiers. */
export const EDITORIAL_SELECTION_ID_PREFIX = "esm_";

/** Prefix for selected story identifiers. */
export const EDITORIAL_STORY_ID_PREFIX = "story_";

/** Prefix for inter-story relationship identifiers. */
export const EDITORIAL_RELATIONSHIP_ID_PREFIX = "esrel_";

/** Stable identifier patterns reused from the existing pipeline. */
export const EDITORIAL_ID_PATTERNS = {
	manifest: /^esm_[a-z0-9]{16}$/,
	story: /^story_[a-z0-9]{16}$/,
	relationship: /^esrel_[a-z0-9]{16}$/,
	editionDate: /^\d{4}-\d{2}-\d{2}$/,
	edition: /^edition_\d{4}-\d{2}-\d{2}$/,
	candidate: /^cand_[a-z0-9]{16}$/,
	claim: /^claim_[a-z0-9]{16}$/,
} as const;

// ============================================================================
// Enumerations
// ============================================================================

/**
 * Explicit editorial decision model (specification §8).
 * - SELECTED: eligible, sufficiently evidenced and materially important.
 * - MERGED: covered within another selected story, provenance preserved.
 * - EXCLUDED_LOW_MATERIALITY: eligible but insufficiently consequential.
 * - EXCLUDED_REPEATED: no qualifying new material information.
 * - EXCLUDED_TEMPORAL: fails the authoritative novelty eligibility gate.
 * - DEFERRED_UNVERIFIED: potentially important but blocked by unresolved
 *   critical evidence or timing.
 * - CATCH_UP_SELECTED: older development explicitly selected as dated catch-up.
 * - REVIEW_REQUIRED: consequential candidate with an unresolved editorial or
 *   evidence decision.
 */
export const EditorialDecisionSchema = z.enum([
	"SELECTED",
	"MERGED",
	"EXCLUDED_LOW_MATERIALITY",
	"EXCLUDED_REPEATED",
	"EXCLUDED_TEMPORAL",
	"DEFERRED_UNVERIFIED",
	"CATCH_UP_SELECTED",
	"REVIEW_REQUIRED",
]);

/**
 * Eligibility state derived from the authoritative upstream gates.
 * - ELIGIBLE: passes temporal, evidence, novelty-statement and duplicate gates.
 * - ELIGIBLE_CATCH_UP: older material that qualifies only as dated catch-up.
 * - CONDITIONAL: passes the hard gates but carries flagged uncertainty that
 *   must be surfaced in the manifest.
 * - INELIGIBLE_TEMPORAL: fails the novelty eligibility gate.
 * - INELIGIBLE_EVIDENCE: fails the evidence sufficiency gate.
 * - INELIGIBLE_DUPLICATE: unresolved duplicate of another candidate.
 */
export const EditorialEligibilityStateSchema = z.enum([
	"ELIGIBLE",
	"ELIGIBLE_CATCH_UP",
	"CONDITIONAL",
	"INELIGIBLE_TEMPORAL",
	"INELIGIBLE_EVIDENCE",
	"INELIGIBLE_DUPLICATE",
]);

/** Evidence sufficiency tiers derived from inherited claim classifications. */
export const EvidenceSufficiencySchema = z.enum(["STRONG", "ADEQUATE", "WEAK"]);

/**
 * Editorial evaluation dimensions (specification §3, A–H).
 * The first six are primary ranking drivers; engineering relevance (G) is a
 * documented secondary consideration and availability/maturity (H) is
 * contextual. See `weightingAssumptions` on the manifest.
 */
export const EditorialDimensionSchema = z.enum([
	"material-novelty",
	"scientific-technical-significance",
	"real-world-consequences",
	"strategic-economic-significance",
	"evidence-strength",
	"generalizability-learning-value",
	"engineering-architectural-relevance",
	"availability-maturity",
]);

/** Role of a dimension in the ranking heuristic. */
export const EditorialDimensionRoleSchema = z.enum([
	"primary",
	"secondary",
	"contextual",
]);

/** Final readiness status of the edition's editorial selection. */
export const EditorialReadinessStatusSchema = z.enum([
	"READY",
	"READY_WITH_CAVEATS",
	"BLOCKED",
]);

/** Recommended explanation depth for a selected story. */
export const EditorialDepthSchema = z.enum(["brief", "standard", "deep-dive"]);

/** Opportunities for accessible explanation identified during ordering. */
export const EditorialExplanationOpportunitySchema = z.enum([
	"technical-deep-dive",
	"scientific-explanation",
	"strategic-interpretation",
	"accessible-comparison",
	"diagram",
	"timeline",
	"historical-context",
	"practical-engineering",
]);

/** Relationship type between selected or assessed developments. */
export const EditorialRelationshipTypeSchema = z.enum([
	"same-development",
	"related-development",
	"background-context",
	"contradicts",
	"extends",
]);

// ============================================================================
// Eligibility
// ============================================================================

export const EditorialEligibilitySchema = z.strictObject({
	candidateId: z.string().regex(EDITORIAL_ID_PATTERNS.candidate),
	state: EditorialEligibilityStateSchema,
	/** Authoritative temporal eligibility gate inherited from the dossier. */
	temporalStatus: TemporalEligibilityStatusSchema,
	evidenceSufficiency: EvidenceSufficiencySchema,
	hasBlockingUncertainty: z.boolean(),
	noveltyStatementPresent: z.boolean(),
	/** Historical regression relationship for this candidate, when available. */
	historicalRelationship:
		HistoricalRelationshipClassificationSchema.optional(),
	/** Historical regression confidence, when available. */
	historicalConfidence: z.number().min(0).max(1).optional(),
	/** Omission-review findings that must be incorporated or explicitly flagged. */
	omissionReviewFlags: z.array(z.string()),
	/** Candidate this candidate duplicates, when an unresolved duplicate exists. */
	duplicateOf: z.string().regex(EDITORIAL_ID_PATTERNS.candidate).optional(),
	reasons: z.array(z.string()),
	traceableTo: z.array(z.string()),
});

// ============================================================================
// Dimension assessments
// ============================================================================

export const EditorialDimensionAssessmentSchema = z.strictObject({
	dimension: EditorialDimensionSchema,
	level: ReadinessLevelSchema,
	/** Deterministic heuristic score in [0,1]; documented, not objective. */
	score: z.number().min(0).max(1),
	evidence: z.array(z.string()),
	traceableTo: z.array(z.string()),
	/** Weight applied by the ranking heuristic (0 for secondary/contextual). */
	weight: z.number().min(0).max(1),
	role: EditorialDimensionRoleSchema,
});

// ============================================================================
// Candidate assessment
// ============================================================================

export const EditorialCandidateAssessmentSchema = z.strictObject({
	candidateId: z.string().regex(EDITORIAL_ID_PATTERNS.candidate),
	factualHeadline: z.string(),
	exactStatement: z.string(),
	organizations: z.array(z.string()),
	products: z.array(z.string()),
	technologies: z.array(z.string()),
	researchDomains: z.array(z.string()),
	discoveryRings: z.array(DiscoveryRingSchema),
	eligibility: EditorialEligibilitySchema,
	dimensions: z.array(EditorialDimensionAssessmentSchema),
	materialityScore: z.number().min(0).max(1),
	materialityLevel: ReadinessLevelSchema,
	decision: EditorialDecisionSchema,
	decisionReasons: z.array(z.string()),
	decisionTraceableTo: z.array(z.string()),
	/** Primary story this candidate was merged into, when MERGED. */
	mergedInto: z.string().regex(EDITORIAL_ID_PATTERNS.candidate).optional(),
	/** Original publication date for CATCH_UP_SELECTED candidates. */
	originalPublicationDate: z.string().optional(),
	/** Explicit reason for CATCH_UP inclusion. */
	catchUpReason: z.string().optional(),
	/** Reason a consequential candidate requires an unresolved decision. */
	reviewReason: z.string().optional(),
	uncertainty: z.array(z.string()),
	sourceReferences: z.array(z.string()),
	sourceIds: z.array(z.string()),
	claimIds: z.array(z.string().regex(EDITORIAL_ID_PATTERNS.claim)),
});

// ============================================================================
// Selected stories
// ============================================================================

export const EditorialStorySchema = z.strictObject({
	storyId: z.string().regex(EDITORIAL_ID_PATTERNS.story),
	order: z.number().int().positive(),
	title: z.string().min(1),
	candidateId: z.string().regex(EDITORIAL_ID_PATTERNS.candidate),
	/** Additional candidates merged into this story (provenance preserved). */
	mergedCandidateIds: z.array(
		z.string().regex(EDITORIAL_ID_PATTERNS.candidate),
	),
	claimIds: z.array(z.string().regex(EDITORIAL_ID_PATTERNS.claim)),
	sourceIds: z.array(z.string()),
	organizations: z.array(z.string()),
	researchDomains: z.array(z.string()),
	discoveryRings: z.array(DiscoveryRingSchema),
	materialityScore: z.number().min(0).max(1),
	materialityLevel: ReadinessLevelSchema,
	decision: z.enum(["SELECTED", "CATCH_UP_SELECTED"]),
	summary: z.string().min(1),
	recommendedDepth: EditorialDepthSchema,
	explanationOpportunities: z.array(EditorialExplanationOpportunitySchema),
	caveats: z.array(z.string()),
	evidenceClassificationSummary: z.string(),
});

// ============================================================================
// Relationships
// ============================================================================

export const EditorialRelationshipSchema = z.strictObject({
	relationshipId: z.string().regex(EDITORIAL_ID_PATTERNS.relationship),
	storyIds: z.array(z.string().regex(EDITORIAL_ID_PATTERNS.story)),
	candidateIds: z.array(z.string().regex(EDITORIAL_ID_PATTERNS.candidate)),
	type: EditorialRelationshipTypeSchema,
	description: z.string().min(1),
	evidenceTraceableTo: z.array(z.string()),
});

// ============================================================================
// Concentration and blind-spot review
// ============================================================================

export const ConsistencyCheckSchema = z.strictObject({
	check: z.string().min(1),
	passed: z.boolean(),
	detail: z.string().min(1),
});

export const RankedCandidateSummarySchema = z.strictObject({
	candidateId: z.string().regex(EDITORIAL_ID_PATTERNS.candidate),
	materialityScore: z.number().min(0).max(1),
	decision: EditorialDecisionSchema,
});

export const ConcentrationReviewSchema = z.strictObject({
	reviewedAt: z.string().min(1),
	selectedStoryCount: z.number().int().nonnegative(),
	organizationDistribution: z.record(
		z.string(),
		z.number().int().nonnegative(),
	),
	ringDistribution: z.record(z.string(), z.number().int().nonnegative()),
	claimTypeDistribution: z.record(z.string(), z.number().int().nonnegative()),
	findings: z.array(z.string()),
	consistencyChecks: z.array(ConsistencyCheckSchema),
	strongestExcluded: RankedCandidateSummarySchema.optional(),
	weakestSelected: RankedCandidateSummarySchema.optional(),
	rankingInconsistenciesFound: z.number().int().nonnegative(),
	correctionsApplied: z.array(z.string()),
	residualRisks: z.array(z.string()),
	modelAssisted: z.boolean(),
	note: z.string().min(1),
});

// ============================================================================
// Upstream references
// ============================================================================

export const OmissionReviewReferenceSchema = z.strictObject({
	reportId: z.string().optional(),
	executionId: z.string().optional(),
	version: z.string().optional(),
	executedAt: z.string().optional(),
	criticalOmissions: z.number().int().nonnegative(),
	materialOmissions: z.number().int().nonnegative(),
	unresolvedRepairs: z.number().int().nonnegative(),
	referenced: z.boolean(),
});

export const HistoricalRegressionReferenceSchema = z.strictObject({
	reportId: z.string().optional(),
	contentHash: z.string().optional(),
	finalStatus: z.string().optional(),
	relationshipsReferenced: z.number().int().nonnegative(),
	referenced: z.boolean(),
});

export const InputDossierReferenceSchema = z.strictObject({
	dossierId: z.string().min(1),
	contentHash: z.string().min(1),
	editionDate: z.string().regex(EDITORIAL_ID_PATTERNS.editionDate),
	candidateCount: z.number().int().nonnegative(),
});

// ============================================================================
// Editorial selection manifest
// ============================================================================

export const EditorialSelectionManifestSchema = z.strictObject({
	schemaVersion: z.literal(EDITORIAL_SELECTION_SCHEMA_VERSION),
	manifestId: z.string().regex(EDITORIAL_ID_PATTERNS.manifest),
	editionId: z.string().regex(EDITORIAL_ID_PATTERNS.edition),
	editionDate: z.string().regex(EDITORIAL_ID_PATTERNS.editionDate),
	editionWindow: EditionWindowSchema,
	generatedAt: z.string().min(1),
	generatedBy: z.string().min(1),
	inputDossier: InputDossierReferenceSchema,
	omissionReview: OmissionReviewReferenceSchema,
	historicalRegression: HistoricalRegressionReferenceSchema,
	candidates: z.array(EditorialCandidateAssessmentSchema),
	stories: z.array(EditorialStorySchema),
	relationships: z.array(EditorialRelationshipSchema),
	concentrationReview: ConcentrationReviewSchema,
	caveats: z.array(z.string()),
	unresolvedIssues: z.array(z.string()),
	readinessStatus: EditorialReadinessStatusSchema,
	inferenceUsed: z.boolean(),
	inferenceNote: z.string().optional(),
	/** Documented weighting assumptions and sensitivity of the ranking heuristic. */
	weightingAssumptions: z.array(z.string()),
	contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
});

// ============================================================================
// Inferred TypeScript types (single source of truth)
// ============================================================================

export type EditorialDecision = z.infer<typeof EditorialDecisionSchema>;
export type EditorialEligibilityState = z.infer<
	typeof EditorialEligibilityStateSchema
>;
export type EvidenceSufficiency = z.infer<typeof EvidenceSufficiencySchema>;
export type EditorialDimension = z.infer<typeof EditorialDimensionSchema>;
export type EditorialDimensionRole = z.infer<
	typeof EditorialDimensionRoleSchema
>;
export type EditorialReadinessStatus = z.infer<
	typeof EditorialReadinessStatusSchema
>;
export type EditorialDepth = z.infer<typeof EditorialDepthSchema>;
export type EditorialExplanationOpportunity = z.infer<
	typeof EditorialExplanationOpportunitySchema
>;
export type EditorialRelationshipType = z.infer<
	typeof EditorialRelationshipTypeSchema
>;

export type EditorialEligibility = z.infer<typeof EditorialEligibilitySchema>;
export type EditorialDimensionAssessment = z.infer<
	typeof EditorialDimensionAssessmentSchema
>;
export type EditorialCandidateAssessment = z.infer<
	typeof EditorialCandidateAssessmentSchema
>;
export type EditorialStory = z.infer<typeof EditorialStorySchema>;
export type EditorialRelationship = z.infer<typeof EditorialRelationshipSchema>;
export type ConsistencyCheck = z.infer<typeof ConsistencyCheckSchema>;
export type RankedCandidateSummary = z.infer<
	typeof RankedCandidateSummarySchema
>;
export type ConcentrationReview = z.infer<typeof ConcentrationReviewSchema>;
export type OmissionReviewReference = z.infer<
	typeof OmissionReviewReferenceSchema
>;
export type HistoricalRegressionReference = z.infer<
	typeof HistoricalRegressionReferenceSchema
>;
export type InputDossierReference = z.infer<typeof InputDossierReferenceSchema>;
export type EditorialSelectionManifest = z.infer<
	typeof EditorialSelectionManifestSchema
>;

// ============================================================================
// JSON Schema generation (single source of truth → machine-readable contract)
// ============================================================================

/**
 * Generate the draft-07 JSON Schema for the editorial selection manifest.
 * Written to `data/schemas/editorial-selection.json` so the on-disk contract
 * and the TypeScript contract stay in sync.
 */
export function generateEditorialSelectionJsonSchema(): Record<
	string,
	unknown
> {
	const generated = z.toJSONSchema(EditorialSelectionManifestSchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/editorial-selection.json",
		title: "Editorial Selection Manifest",
		description:
			"Structured per-edition editorial selection manifest. Records eligibility, evidence-backed assessments, selection/merge/exclusion/deferral decisions, final story ordering, relationships, concentration and blind-spot review results, caveats and readiness status for downstream publication generators.",
		...generated,
	};
}
