/**
 * Book Delta — Schema Layer
 *
 * Defines the authoritative, versioned, machine-readable data contract for
 * Book Delta proposals. Book Delta identifies meaningful, reusable knowledge
 * emerging from verified daily research and formulates structured proposals
 * for improving future educational content, technical explanations, reference
 * material and learning resources.
 *
 * Processing sequence preserved:
 *   Source Discovery → Retrieval → Temporal Classification → Claim Verification
 *     → Canonical Fact Dossier → Omission Review → Historical Regression
 *     → Editorial Selection → Publication → Quality Evaluation
 *     → Knowledge Continuity (includes Book Delta evaluation)
 *     → Publication Validation → Deployment
 *
 * Hard rules:
 * - Book Delta is a proposal-generation and review capability, NOT a separate
 *   source of factual truth, NOT a replacement for the thesaurus, and NOT a
 *   mechanism for automatically modifying architecture principles.
 * - Every material proposal must retain traceability to source evidence in the
 *   canonical fact dossier.
 * - The canonical fact dossier remains authoritative for factual assertions.
 * - Book Delta must not create duplicate glossary definitions inside Book Delta.
 * - If an issue concerns the canonical meaning of a term, route it to the
 *   existing terminology change mechanism.
 * - If an issue concerns how that term is taught, Book Delta may propose an
 *   educational improvement.
 * - A valid outcome is explicitly NONE when no actionable improvement is
 *   supported by evidence.
 * - Do not generate proposals merely to demonstrate activity.
 */

import { z } from "astro/zod";

// ============================================================================
// Constants
// ============================================================================

/** Current Book Delta schema version. */
export const BOOK_DELTA_SCHEMA_VERSION = "1.0.0";

/** Prefix for Book Delta proposal identifiers. */
export const BOOK_DELTA_PROPOSAL_ID_PREFIX = "bdp_";

/** Prefix for Book Delta artifact identifiers (complete register). */
export const BOOK_DELTA_ARTIFACT_ID_PREFIX = "bdart_";

/** Stable identifier patterns reused from the existing pipeline. */
export const BOOK_DELTA_ID_PATTERNS = {
	proposal: /^bdp_[a-z0-9]{16}$/,
	artifact: /^bdart_[a-z0-9]{16}$/,
	edition: /^edition_\d{4}-\d{2}-\d{2}$/,
	editionDate: /^\d{4}-\d{2}-\d{2}$/,
	candidate: /^cand_[a-z0-9]{16}$/,
	claim: /^claim_[a-z0-9]{16}$/,
	discovery: /^disc_[a-z0-9]{16}$/,
	source: /^[a-z0-9-]+$/,
	subdomain: /^DOM-\d{2}-SD\d{2}$/,
	domain: /^DOM-\d{2}$/,
	thesaurusEntry: /^thes_[a-z0-9]{16}$/,
	principle: /^AP-\d{3}$/,
	factDossier: /^fd_[a-z0-9]{16}$/,
	editorialManifest: /^esm_[a-z0-9]{16}$/,
	historicalReport: /^hr_[a-z0-9]{16}$/,
} as const;

// ============================================================================
// Enumerations
// ============================================================================

/**
 * Book Delta Proposal Categories — the seven explicit decisions.
 * - ADD: Introduce a missing educational concept, explanation, example or substantive section
 * - REFINE: Improve an existing explanation's technical accuracy, clarity, applicability or depth
 * - CORRECT: Address a materially incorrect, misleading or outdated statement
 * - EXTEND: Add relevant evidence, alternative perspectives, limitations or technical detail to an existing subject
 * - RESTRUCTURE: Improve educational sequencing, conceptual dependencies or information organization
 * - DEPRECATE: Identify educational content that should be retired or replaced because it is obsolete or no longer defensible
 * - NONE: Record that the edition produced no justified educational improvement proposals
 *
 * Keep proposal categories distinct from the architecture-principles change
 * classifications (ADD, CONFIRM, REFINE, MERGE, SUPERSEDE, NONE).
 */
export const BookDeltaCategorySchema = z.enum([
	"ADD",
	"REFINE",
	"CORRECT",
	"EXTEND",
	"RESTRUCTURE",
	"DEPRECATE",
	"NONE",
]);

/**
 * Proposal Lifecycle Status
 * - CANDIDATE: Potential improvement requiring additional evidence or inspection
 * - READY_FOR_REVIEW: Sufficiently specified proposal awaiting a decision
 * - APPROVED: Explicitly authorized for implementation
 * - REJECTED: Reviewed and not accepted
 * - SUPERSEDED: Replaced by a newer proposal
 * - IMPLEMENTED: Change completed with inspectable evidence
 * - VALIDATED: Implemented change verified against its acceptance criteria
 */
export const BookDeltaLifecycleSchema = z.enum([
	"CANDIDATE",
	"READY_FOR_REVIEW",
	"APPROVED",
	"REJECTED",
	"SUPERSEDED",
	"IMPLEMENTED",
	"VALIDATED",
]);

/**
 * Evidence Classification — inherited from evidence-verification pipeline.
 */
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

/**
 * Verification Status — inherited from evidence-verification pipeline.
 */
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

/**
 * Verification Level per contract §4.1.
 */
export const VerificationLevelSchema = z.enum(["L0", "L1", "L2", "L3"]);

/**
 * Target audience for the educational improvement.
 */
export const TargetAudienceSchema = z.enum([
	"system-architects",
	"principal-engineers",
	"ml-platform-leads",
	"technical-ctos",
	"senior-engineers-ai-track",
	"security-architects",
	"cost-engineers",
	"general-technical",
	"interdisciplinary",
]);

/**
 * Knowledge domain — mirrors research taxonomy domains.
 */
export const KnowledgeDomainSchema = z.enum([
	"agentic-ai-software-engineering",
	"models-inference-scientific",
	"architecture-security-governance",
	"enterprise-adoption-organizational",
	"economics-business-impact",
	"independent-research-advisory",
	"cross-cutting",
]);

/**
 * Educational value assessment.
 */
export const EducationalValueSchema = z.enum([
	"foundational", // Core concept essential for progressive learning
	"significant", // Important for practical application or deeper understanding
	"supplementary", // Valuable context but not essential
	"niche", // Specialized audience, limited reusability
]);

/**
 * Material uncertainty level.
 */
export const MaterialUncertaintySchema = z.enum([
	"low", // Well-established, multiple independent verifications
	"medium", // Supported by evidence but some limitations acknowledged
	"high", // Significant uncertainty, further verification needed
	"speculative", // Insufficient evidence for confident educational use
]);

/**
 * Target document accessibility status.
 */
export const TargetDocumentAccessSchema = z.enum([
	"accessed", // Target material was inspected
	"inaccessible", // Target material exists but could not be accessed
	"unidentified", // No specific target document identified
	"does-not-exist", // Confirmed no existing material covers this topic
]);

/**
 * Proposal uniqueness status relative to historical proposals.
 */
export const UniquenessStatusSchema = z.enum([
	"unique", // No related historical proposal found
	"strengthens-existing", // Adds stronger evidence to existing proposal
	"revises-scope", // Revises scope of existing proposal
	"links-related", // Links to related proposals
	"supersedes", // Explicitly supersedes an older proposal
	"duplicate", // Conceptually duplicates an existing proposal
]);

// ============================================================================
// Shared Sub-Records
// ============================================================================

/** Bilingual string pair (English + Dutch). */
export const BilingualStringSchema = z.strictObject({
	en: z.string().min(1),
	nl: z.string().min(1),
});

/** Authoritative source reference with full traceability. */
export const AuthoritativeSourceReferenceSchema = z.strictObject({
	sourceId: z.string().regex(BOOK_DELTA_ID_PATTERNS.source),
	url: z.string().url(),
	title: z.string().min(1),
	tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
	section: z.string().optional(),
	accessedAt: z.string(),
	retrievalStatus: z.enum([
		"CHECKED_FOUND",
		"CHECKED_NONE",
		"INACCESSIBLE",
		"NOT_CHECKED",
		"ERROR",
	]),
	confidence: z.number().min(0).max(1),
});

/** Claim reference from the canonical fact dossier. */
export const CanonicalClaimReferenceSchema = z.strictObject({
	claimId: z.string().regex(BOOK_DELTA_ID_PATTERNS.claim),
	claimStatement: z.string().min(1),
	evidenceClassification: EvidenceClassificationSchema,
	verificationStatus: VerificationStatusSchema,
	verificationLevel: VerificationLevelSchema,
	confidence: z.number().min(0).max(1),
	sourceIds: z.array(z.string().regex(BOOK_DELTA_ID_PATTERNS.source)),
});

/** Research date range relevant to the proposal. */
export const ResearchDateRangeSchema = z.strictObject({
	earliestFinding: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	latestFinding: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	primaryEditionDates: z
		.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
		.min(1),
});

/** Acceptance criteria for a proposal. */
export const AcceptanceCriterionSchema = z.strictObject({
	criterionId: z.string().min(1),
	description: z.string().min(1),
	measurable: z.boolean(),
	verificationMethod: z.enum([
		"content-inspection",
		"expert-review",
		"learner-feedback",
		"accessibility-audit",
		"technical-validation",
		"cross-reference-check",
	]),
	evidenceRequired: z.array(z.string()),
});

/** Revision history entry. */
export const ProposalRevisionSchema = z.strictObject({
	revisionId: z.string().min(1),
	changedAt: z.string(),
	changedBy: z.string().min(1),
	previousLifecycleStatus: BookDeltaLifecycleSchema.optional(),
	newLifecycleStatus: BookDeltaLifecycleSchema.optional(),
	fieldsChanged: z.array(z.string()),
	previousValues: z.record(z.string(), z.unknown()).optional(),
	newValues: z.record(z.string(), z.unknown()).optional(),
	justification: z.string().min(1),
	evidence: z.array(AuthoritativeSourceReferenceSchema).optional(),
	relatedProposalIds: z
		.array(z.string().regex(BOOK_DELTA_ID_PATTERNS.proposal))
		.optional(),
});

/** Potential conflict or dependency with another proposal. */
export const ProposalConflictSchema = z.strictObject({
	otherProposalId: z.string().regex(BOOK_DELTA_ID_PATTERNS.proposal),
	conflictType: z.enum([
		"overlapping-scope",
		"contradictory-change",
		"dependency",
		"sequence-required",
	]),
	description: z.string().min(1),
	resolutionApproach: z.string().optional(),
});

/** Target document or section reference, when known. */
export const TargetDocumentReferenceSchema = z.strictObject({
	documentId: z.string().optional(),
	documentTitle: z.string().optional(),
	sectionPath: z.string().optional(),
	accessibility: TargetDocumentAccessSchema,
	lastAccessedAt: z.string().optional(),
	accessNote: z.string().optional(),
	comparisonPerformed: z.boolean(),
	comparisonResult: z
		.enum(["gap-confirmed", "no-gap", "inconclusive", "not-performed"])
		.optional(),
});

/** Historical proposal reference. */
export const HistoricalProposalReferenceSchema = z.strictObject({
	proposalId: z.string().regex(BOOK_DELTA_ID_PATTERNS.proposal),
	editionDate: z.string().regex(BOOK_DELTA_ID_PATTERNS.editionDate),
	relationship: UniquenessStatusSchema,
	resolutionNote: z.string().optional(),
});

/** Terminology reference. */
export const TerminologyReferenceSchema = z.strictObject({
	entryId: z.string().regex(BOOK_DELTA_ID_PATTERNS.thesaurusEntry),
	term: z.string().min(1),
	relationship: z.enum([
		"prerequisite",
		"subject-of-proposal",
		"related-concept",
		"ambiguous-usage",
	]),
	note: z.string().optional(),
});

/** Architecture principle reference. */
export const PrincipleReferenceSchema = z.strictObject({
	principleId: z.string().regex(BOOK_DELTA_ID_PATTERNS.principle),
	title: z.string().min(1),
	relationship: z.enum([
		"illustrates",
		"requires-explanation",
		"tradeoff-example",
		"scope-clarification",
	]),
	note: z.string().optional(),
});

/** Counterevidence or applicability boundary. */
export const CounterevidenceSchema = z.strictObject({
	description: z.string().min(1),
	sourceReference: AuthoritativeSourceReferenceSchema,
	evidenceClassification: EvidenceClassificationSchema,
	impact: z.enum(["qualifying", "limiting", "contradictory"]),
	note: z.string().optional(),
});

/** Educational accessibility considerations. */
export const AccessibilityConsiderationsSchema = z.strictObject({
	explicitObjectives: z.boolean().default(false),
	explicitPrerequisites: z.boolean().default(false),
	progressiveDisclosure: z.boolean().default(false),
	contextBeforeComplexity: z.boolean().default(false),
	meaningfulSequencing: z.boolean().default(false),
	concreteExamples: z.boolean().default(false),
	accurateAnalogies: z.boolean().default(false),
	clearDistinctions: z.boolean().default(false),
	manageableDensity: z.boolean().default(false),
	independentExploration: z.boolean().default(false),
	reducedRepetition: z.boolean().default(false),
	cognitiveLoadAssessment: z.string().optional(),
});

/** Durability assessment. */
export const DurabilityAssessmentSchema = z.strictObject({
	conceptualImportance: z.enum(["high", "medium", "low"]),
	technicalAccuracy: z.enum(["high", "medium", "low"]),
	reusability: z.enum([
		"cross-domain",
		"domain-specific",
		"product-specific",
	]),
	multiContextRelevance: z.boolean(),
	prerequisiteDependencies: z.array(z.string()),
	likelihoodOfFutureChange: z.enum(["low", "medium", "high"]),
	authoritativeEvidenceAvailable: z.boolean(),
	practicalApplicability: z.enum(["high", "medium", "low"]),
	correctsRecurringMisconception: z.boolean(),
	progressiveLearningValue: z.enum(["high", "medium", "low"]),
	maintenanceCostEstimate: z.enum(["low", "medium", "high"]),
});

/** Methodological caveats for research-based proposals. */
export const MethodologicalCaveatsSchema = z.strictObject({
	empiricalVsInterpretation: z.string().optional(),
	correlationVsCausation: z.string().optional(),
	measuredVsForecast: z.string().optional(),
	vendorClaimVsIndependent: z.string().optional(),
	experimentalVsProduction: z.string().optional(),
	populationScope: z.string().optional(),
	generalizabilityLimitations: z.array(z.string()),
	conflictingStudies: z.array(z.string()).optional(),
});

// ============================================================================
// Main Book Delta Proposal Schema
// ============================================================================

export const BookDeltaProposalSchema = z.strictObject({
	// Stable identifier
	proposalId: z.string().regex(BOOK_DELTA_ID_PATTERNS.proposal),

	// Edition this proposal was generated for
	editionId: z.string().regex(BOOK_DELTA_ID_PATTERNS.edition),
	editionDate: z.string().regex(BOOK_DELTA_ID_PATTERNS.editionDate),

	// Proposal category
	category: BookDeltaCategorySchema,

	// Descriptive title
	title: BilingualStringSchema,

	// Knowledge domain
	knowledgeDomain: KnowledgeDomainSchema,

	// Target audience
	targetAudience: z.array(TargetAudienceSchema).min(1),

	// Target concept or educational topic
	targetConcept: z.string().min(1),

	// Existing target document or section, when known
	targetDocument: TargetDocumentReferenceSchema.optional(),

	// Current knowledge gap or observed problem
	currentGap: BilingualStringSchema,

	// Proposed change
	proposedChange: BilingualStringSchema,

	// Rationale
	rationale: BilingualStringSchema,

	// Supporting canonical claim IDs
	supportingClaimIds: z
		.array(z.string().regex(BOOK_DELTA_ID_PATTERNS.claim))
		.min(0),

	// Original source references
	originalSources: z.array(AuthoritativeSourceReferenceSchema).min(0),

	// Relevant research dates
	researchDates: ResearchDateRangeSchema,

	// Evidence classification of the supporting evidence
	evidenceClassification: EvidenceClassificationSchema,

	// Confidence and material uncertainty
	confidence: z.number().min(0).max(1),
	materialUncertainty: MaterialUncertaintySchema,

	// Expected educational value
	educationalValue: EducationalValueSchema,

	// Important limitations
	limitations: z.array(z.string()).default([]),

	// Relevant terminology identifiers
	terminologyReferences: z.array(TerminologyReferenceSchema).default([]),

	// Related architecture principle identifiers
	principleReferences: z.array(PrincipleReferenceSchema).default([]),

	// Related historical proposal identifiers
	historicalProposalReferences: z
		.array(HistoricalProposalReferenceSchema)
		.default([]),

	// Potential conflicts or dependencies
	conflicts: z.array(ProposalConflictSchema).default([]),

	// Counterevidence and applicability boundaries
	counterevidence: z.array(CounterevidenceSchema).default([]),

	// Proposed acceptance criteria
	acceptanceCriteria: z.array(AcceptanceCriterionSchema).min(1),

	// Durability assessment
	durability: DurabilityAssessmentSchema,

	// Methodological caveats
	methodologicalCaveats: MethodologicalCaveatsSchema.optional(),

	// Educational accessibility considerations
	accessibility: AccessibilityConsiderationsSchema,

	// Lifecycle management
	lifecycleStatus: BookDeltaLifecycleSchema,

	// Revision history
	revisionHistory: z.array(ProposalRevisionSchema).default([]),

	// Uniqueness status relative to historical proposals
	uniquenessStatus: UniquenessStatusSchema,

	// Metadata
	schemaVersion: z.literal(BOOK_DELTA_SCHEMA_VERSION),
	createdAt: z.string(),
	updatedAt: z.string(),
	createdBy: z.string().min(1),
	tags: z.array(z.string()).default([]),
});

// ============================================================================
// Book Delta Artifact (Complete Register)
// ============================================================================

export const BookDeltaArtifactSchema = z.strictObject({
	artifactId: z.string().regex(BOOK_DELTA_ID_PATTERNS.artifact),
	schemaVersion: z.literal(BOOK_DELTA_SCHEMA_VERSION),
	editionDate: z
		.string()
		.regex(BOOK_DELTA_ID_PATTERNS.editionDate)
		.optional(),
	generatedAt: z.string(),
	generatedBy: z.string().min(1),
	proposals: z.array(BookDeltaProposalSchema),
	contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
	previousVersionHash: z
		.string()
		.regex(/^sha256:[a-f0-9]{64}$/)
		.optional(),
	stats: z.strictObject({
		totalProposals: z.number().int().nonnegative(),
		byCategory: z.record(
			BookDeltaCategorySchema,
			z.number().int().nonnegative(),
		),
		byLifecycleStatus: z.record(
			BookDeltaLifecycleSchema,
			z.number().int().nonnegative(),
		),
		byDomain: z.record(z.string(), z.number().int().nonnegative()),
		candidateProposals: z.number().int().nonnegative(),
		readyForReviewProposals: z.number().int().nonnegative(),
		approvedProposals: z.number().int().nonnegative(),
		rejectedProposals: z.number().int().nonnegative(),
		supersededProposals: z.number().int().nonnegative(),
		implementedProposals: z.number().int().nonnegative(),
		validatedProposals: z.number().int().nonnegative(),
		noneProposals: z.number().int().nonnegative(),
		proposalsWithTargetDocument: z.number().int().nonnegative(),
		proposalsWithoutTargetDocument: z.number().int().nonnegative(),
		uniqueProposals: z.number().int().nonnegative(),
		strengtheningProposals: z.number().int().nonnegative(),
		supersedingProposals: z.number().int().nonnegative(),
	}),
	validationResults: z
		.array(
			z.strictObject({
				rule: z.string(),
				passed: z.boolean(),
				details: z.string().optional(),
				affectedProposalIds: z
					.array(z.string().regex(BOOK_DELTA_ID_PATTERNS.proposal))
					.optional(),
			}),
		)
		.default([]),
});

// ============================================================================
// Book Delta Daily Evaluation Result (for research-audit integration)
// ============================================================================

export const BookDeltaEvaluationResultSchema = z.strictObject({
	editionId: z.string().regex(BOOK_DELTA_ID_PATTERNS.edition),
	editionDate: z.string().regex(BOOK_DELTA_ID_PATTERNS.editionDate),
	evaluatedAt: z.string(),
	evaluatedBy: z.string().min(1),
	evaluationPerformed: z.boolean(),
	factDossierConsidered: z.boolean(),
	thesaurusConsulted: z.boolean(),
	architecturePrinciplesConsulted: z.boolean(),
	historicalProposalsInspected: z.boolean(),
	targetDocumentsInspected: z.boolean(),
	newProposals: z.array(z.string().regex(BOOK_DELTA_ID_PATTERNS.proposal)),
	updatedHistoricalProposals: z.array(
		z.string().regex(BOOK_DELTA_ID_PATTERNS.proposal),
	),
	duplicateProposalsIdentified: z.array(
		z.string().regex(BOOK_DELTA_ID_PATTERNS.proposal),
	),
	noChangeDecisions: z.number().int().nonnegative(),
	unresolvedEvidenceGaps: z.array(z.string()),
	targetDocumentAccessLimitations: z.array(z.string()),
	reviewRequirements: z.array(z.string()),
	persistenceSucceeded: z.boolean(),
	readbackSucceeded: z.boolean(),
	inferenceUsed: z.boolean(),
	inferenceNote: z.string().optional(),
	/** Hash of the persisted result document (added at write time; backward compatible). */
	contentHash: z
		.string()
		.regex(/^sha256:[a-f0-9]{64}$/)
		.optional(),
});

// ============================================================================
// Knowledge Continuity Gate Integration
// ============================================================================

export const BookDeltaKnowledgeContinuityResultSchema = z.strictObject({
	gateStatus: z.enum(["PASS", "FAIL", "UNVERIFIED", "NOT_ASSESSABLE"]),
	editionId: z.string().regex(BOOK_DELTA_ID_PATTERNS.edition),
	editionDate: z.string().regex(BOOK_DELTA_ID_PATTERNS.editionDate),
	evaluationRan: z.boolean(),
	evidenceInspected: z.boolean(),
	candidatesEvaluated: z.boolean(),
	proposalsRecorded: z.boolean(),
	duplicatesHandled: z.boolean(),
	persistenceSucceeded: z.boolean(),
	readbackSucceeded: z.boolean(),
	limitationsReported: z.boolean(),
	unresolvedLimitations: z.array(z.string()),
	details: z.string().min(1),
	evaluatedAt: z.string(),
	evaluatedBy: z.string().min(1),
	/** Hash of the persisted knowledge continuity document (backward compatible). */
	contentHash: z
		.string()
		.regex(/^sha256:[a-f0-9]{64}$/)
		.optional(),
});

// ============================================================================
// Inferred TypeScript Types (single source of truth)
// ============================================================================

export type BookDeltaCategory = z.infer<typeof BookDeltaCategorySchema>;
export type BookDeltaLifecycle = z.infer<typeof BookDeltaLifecycleSchema>;
export type EvidenceClassification = z.infer<
	typeof EvidenceClassificationSchema
>;
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;
export type VerificationLevel = z.infer<typeof VerificationLevelSchema>;
export type TargetAudience = z.infer<typeof TargetAudienceSchema>;
export type KnowledgeDomain = z.infer<typeof KnowledgeDomainSchema>;
export type EducationalValue = z.infer<typeof EducationalValueSchema>;
export type MaterialUncertainty = z.infer<typeof MaterialUncertaintySchema>;
export type TargetDocumentAccess = z.infer<typeof TargetDocumentAccessSchema>;
export type UniquenessStatus = z.infer<typeof UniquenessStatusSchema>;

export type BilingualString = z.infer<typeof BilingualStringSchema>;
export type AuthoritativeSourceReference = z.infer<
	typeof AuthoritativeSourceReferenceSchema
>;
export type CanonicalClaimReference = z.infer<
	typeof CanonicalClaimReferenceSchema
>;
export type ResearchDateRange = z.infer<typeof ResearchDateRangeSchema>;
export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;
export type ProposalRevision = z.infer<typeof ProposalRevisionSchema>;
export type ProposalConflict = z.infer<typeof ProposalConflictSchema>;
export type TargetDocumentReference = z.infer<
	typeof TargetDocumentReferenceSchema
>;
export type HistoricalProposalReference = z.infer<
	typeof HistoricalProposalReferenceSchema
>;
export type TerminologyReference = z.infer<typeof TerminologyReferenceSchema>;
export type PrincipleReference = z.infer<typeof PrincipleReferenceSchema>;
export type Counterevidence = z.infer<typeof CounterevidenceSchema>;
export type AccessibilityConsiderations = z.infer<
	typeof AccessibilityConsiderationsSchema
>;
export type DurabilityAssessment = z.infer<typeof DurabilityAssessmentSchema>;
export type MethodologicalCaveats = z.infer<typeof MethodologicalCaveatsSchema>;

export type BookDeltaProposal = z.infer<typeof BookDeltaProposalSchema>;
export type BookDeltaArtifact = z.infer<typeof BookDeltaArtifactSchema>;
export type BookDeltaEvaluationResult = z.infer<
	typeof BookDeltaEvaluationResultSchema
>;
export type BookDeltaKnowledgeContinuityResult = z.infer<
	typeof BookDeltaKnowledgeContinuityResultSchema
>;

// ============================================================================
// JSON Schema Generation (single source of truth → machine-readable contract)
// ============================================================================

/**
 * Generate the draft-07 JSON Schema for a Book Delta proposal.
 */
export function generateBookDeltaProposalJsonSchema(): Record<string, unknown> {
	const generated = z.toJSONSchema(BookDeltaProposalSchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/book-delta-proposal.json",
		title: "Book Delta Proposal",
		description:
			"Structured proposal for improving educational knowledge and explanatory material based on verified daily research findings. Not a source of factual truth, not a replacement for thesaurus or architecture principles.",
		...generated,
	};
}

/**
 * Generate the draft-07 JSON Schema for the complete Book Delta artifact.
 */
export function generateBookDeltaArtifactJsonSchema(): Record<string, unknown> {
	const generated = z.toJSONSchema(BookDeltaArtifactSchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/book-delta-artifact.json",
		title: "Book Delta Artifact",
		description:
			"Complete register of Book Delta proposals with lifecycle management, historical continuity, and evidence traceability.",
		...generated,
	};
}

/**
 * Generate the draft-07 JSON Schema for Book Delta daily evaluation result.
 */
export function generateBookDeltaEvaluationResultJsonSchema(): Record<
	string,
	unknown
> {
	const generated = z.toJSONSchema(BookDeltaEvaluationResultSchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/book-delta-evaluation.json",
		title: "Book Delta Evaluation Result",
		description:
			"Structured result of the daily Book Delta evaluation for integration into research-audit.md.",
		...generated,
	};
}

/**
 * Generate the draft-07 JSON Schema for Book Delta knowledge continuity result.
 */
export function generateBookDeltaKnowledgeContinuityJsonSchema(): Record<
	string,
	unknown
> {
	const generated = z.toJSONSchema(BookDeltaKnowledgeContinuityResultSchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/book-delta-knowledge-continuity.json",
		title: "Book Delta Knowledge Continuity Result",
		description:
			"Evidence for the Book Delta contribution to the Knowledge Continuity gate (K gate).",
		...generated,
	};
}
