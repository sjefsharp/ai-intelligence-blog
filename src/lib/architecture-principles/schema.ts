/**
 * Architecture Principles Register — Schema Layer
 *
 * Defines the authoritative, versioned, machine-readable data contract for the
 * persistent register of evidence-backed architectural principles. The register
 * is a durable knowledge asset independent of individual news editions, fully
 * traceable to verified evidence from the canonical fact dossier and established
 * architectural foundations.
 *
 * Design rules:
 * - Schemas are defined with Zod (TypeScript schemas) and inferred into static
 *   types, so the runtime validator and the compile-time types cannot drift.
 * - A JSON Schema (draft-07) is generated from the same Zod schemas via
 *   `z.toJSONSchema`, so the on-disk data contract and the TypeScript contract
 *   are generated from one source of truth.
 * - Every identifier pattern reuses the existing stable identifier conventions.
 * - The register preserves separation from: Source Registry, Research Taxonomy,
 *   Canonical Fact Dossier, Thesaurus, Editorial Selection, Publication Generators.
 * - Architectural reasoning remains separate from editorial story selection.
 */

import { z } from "astro/zod";

// ============================================================================
// Constants
// ============================================================================

/** Current architecture principles register schema version. */
export const ARCHITECTURE_PRINCIPLES_SCHEMA_VERSION = "1.0.0";

/** Prefix for architecture principle identifiers. */
export const ARCHITECTURE_PRINCIPLE_ID_PREFIX = "AP-";

/** Prefix for architecture principles register artifact identifiers. */
export const ARCHITECTURE_PRINCIPLES_ARTIFACT_ID_PREFIX = "apr_";

/** Stable identifier patterns reused from the existing pipeline. */
export const ARCHITECTURE_PRINCIPLE_ID_PATTERNS = {
	principle: /^AP-\d{3}$/,
	artifact: /^apr_[a-z0-9]{16}$/,
	edition: /^edition_\d{4}-\d{2}-\d{2}$/,
	editionDate: /^\d{4}-\d{2}-\d{2}$/,
	candidate: /^cand_[a-z0-9]{16}$/,
	claim: /^claim_[a-z0-9]{16}$/,
	discovery: /^disc_[a-z0-9]{16}$/,
	source: /^[a-z0-9-]+$/,
	subdomain: /^DOM-\d{2}-SD\d{2}$/,
	domain: /^DOM-\d{2}$/,
	thesaurusEntry: /^thes_[a-z0-9]{16}$/,
	factDossier: /^fd_[a-z0-9]{16}$/,
} as const;

// ============================================================================
// Enumerations
// ============================================================================

/**
 * Architecture Principle Lifecycle Status
 * - CANDIDATE: A proposed principle requiring further validation
 * - ESTABLISHED: A principle with sufficient supporting evidence and justified applicability
 * - REVISED: An established principle whose formulation or scope has materially changed
 * - SUPERSEDED: A principle replaced by another principle while retaining historical traceability
 */
export const ArchitecturePrincipleLifecycleSchema = z.enum([
	"CANDIDATE",
	"ESTABLISHED",
	"REVISED",
	"SUPERSEDED",
]);

/**
 * Principle Change Classification — the six explicit decisions
 * - ADD: Introduce a genuinely new, sufficiently supported architectural principle
 * - CONFIRM: Record additional evidence supporting an existing principle without unnecessarily rewriting it
 * - REFINE: Improve a principle's scope, wording, rationale, exceptions or design consequences based on material evidence
 * - MERGE: Consolidate substantially overlapping principles while retaining their historical identifiers and references
 * - SUPERSEDE: Replace a principle when new evidence or a more accurate architectural formulation justifies doing so
 * - NONE: Make no register change when available evidence does not justify one
 */
export const PrincipleChangeClassificationSchema = z.enum([
	"ADD",
	"CONFIRM",
	"REFINE",
	"MERGE",
	"SUPERSEDE",
	"NONE",
]);

/**
 * Evidence Classification — inherited from evidence-verification pipeline
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
 * Verification Status — inherited from evidence-verification pipeline
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
 * Verification Level per contract §4.1
 */
export const VerificationLevelSchema = z.enum(["L0", "L1", "L2", "L3"]);

/**
 * Relationship types between architecture principles
 * - reinforces: Supporting or strengthening another principle
 * - specializes: Narrowing a broader principle to a specific scope
 * - extends: Adding a distinct applicable concern
 * - conflicts-with: Identifying a genuine trade-off or incompatibility
 * - no-established-match: No defensible relationship currently exists
 */
export const PrincipleRelationshipTypeSchema = z.enum([
	"reinforces",
	"specializes",
	"extends",
	"conflicts-with",
	"no-established-match",
]);

/**
 * Architectural Quality Attributes — established software architecture quality attributes
 */
export const QualityAttributeSchema = z.enum([
	"availability",
	"interoperability",
	"modifiability",
	"performance",
	"security",
	"testability",
	"usability",
	"deployability",
	"scalability",
	"reliability",
	"maintainability",
	"portability",
	"integrity",
	"confidentiality",
	"auditability",
	"traceability",
	"observability",
	"reproducibility",
	"cost-efficiency",
	"operational-simplicity",
]);

/**
 * Research Domain IDs — mirrors research taxonomy domains
 */
export const ResearchDomainSchema = z.enum([
	"agentic-ai-software-engineering",
	"models-inference-scientific",
	"architecture-security-governance",
	"enterprise-adoption-organizational",
	"economics-business-impact",
	"independent-research-advisory",
]);

/**
 * Source Tier — mirrors source registry
 */
export const SourceTierSchema = z.union([
	z.literal(1),
	z.literal(2),
	z.literal(3),
]);

/**
 * Standards Authority — established standards bodies
 */
export const StandardsAuthoritySchema = z.enum([
	"ISO",
	"IEC",
	"NIST",
	"OWASP",
	"IETF",
	"W3C",
	"CNCF",
	"OASIS",
	"ECMA",
	"ITU-T",
]);

/**
 * Knowledge Continuity Gate Status — reused from publication gates
 */
export const KnowledgeContinuityGateStatusSchema = z.enum([
	"PASS",
	"FAIL",
	"UNVERIFIED",
	"NOT_ASSESSABLE",
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
	sourceId: z.string().regex(ARCHITECTURE_PRINCIPLE_ID_PATTERNS.source),
	url: z.string().url(),
	title: z.string().min(1),
	tier: SourceTierSchema,
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

/** Evidence reference specific to a principle claim. */
export const PrincipleEvidenceReferenceSchema = z.strictObject({
	evidenceId: z.string().min(1),
	sourceReference: AuthoritativeSourceReferenceSchema,
	evidenceClassification: EvidenceClassificationSchema,
	verificationStatus: VerificationStatusSchema,
	verificationLevel: VerificationLevelSchema,
	claimSupported: z.string().min(1),
	locator: z.string().min(1),
	confidence: z.number().min(0).max(1),
	isContradictory: z.boolean().default(false),
	contradictionType: z
		.enum(["direct", "qualifying", "contextual", "methodological"])
		.optional(),
	note: z.string().optional(),
});

/** Standards reference with verified scope. */
export const StandardsReferenceSchema = z.strictObject({
	authority: StandardsAuthoritySchema,
	standardId: z.string().min(1),
	title: z.string().min(1),
	version: z.string().min(1),
	section: z.string().optional(),
	url: z.string().url().optional(),
	directRequirement: z.boolean().default(false),
	applicabilityNote: z.string().min(1),
	verifiedAt: z.string(),
	verifiedBy: z.string().min(1),
});

/** Testable design consequence — must be observable or inspectable. */
export const TestableDesignConsequenceSchema = z.strictObject({
	consequenceId: z.string().min(1),
	description: z.string().min(1),
	qualityAttributes: z.array(QualityAttributeSchema).min(1),
	verificationMechanism: z.enum([
		"architecture-conformance-check",
		"interface-contract-validation",
		"dependency-analysis",
		"security-policy-verification",
		"authorization-test",
		"runtime-observability-check",
		"failure-injection-test",
		"reproducible-evaluation-suite",
		"architectural-fitness-function",
		"traceability-audit-inspection",
		"configuration-provenance-check",
		"human-architecture-review",
	]),
	verificationCriteria: z.string().min(1),
	automationFeasibility: z.enum([
		"fully-automated",
		"semi-automated",
		"manual-review",
	]),
	exampleScenario: z.string().optional(),
});

/** Trade-off with explicit characterization. */
export const TradeoffSchema = z.strictObject({
	tradeoffId: z.string().min(1),
	description: z.string().min(1),
	qualityAttributesAffected: z.array(QualityAttributeSchema).min(1),
	mitigatingFactors: z.array(z.string()).default([]),
	residualRisk: z.enum(["low", "medium", "high"]).default("medium"),
	decisionGuidance: z.string().min(1),
});

/** Principle relationship with full traceability. */
export const PrincipleRelationshipSchema = z.strictObject({
	targetPrincipleId: z
		.string()
		.regex(ARCHITECTURE_PRINCIPLE_ID_PATTERNS.principle),
	type: PrincipleRelationshipTypeSchema,
	rationale: z.string().min(1),
	evidence: z.array(AuthoritativeSourceReferenceSchema).optional(),
	confidence: z.number().min(0).max(1).default(1),
	establishedAt: z.string(),
	establishedBy: z.string().min(1),
});

/** Revision history entry. */
export const PrincipleRevisionSchema = z.strictObject({
	revisionId: z.string().min(1),
	changeClassification: PrincipleChangeClassificationSchema,
	revisedAt: z.string(),
	revisedBy: z.string().min(1),
	previousLifecycleStatus: ArchitecturePrincipleLifecycleSchema.optional(),
	newLifecycleStatus: ArchitecturePrincipleLifecycleSchema.optional(),
	fieldsChanged: z.array(z.string()),
	previousValues: z.record(z.string(), z.string()).optional(),
	newValues: z.record(z.string(), z.string()).optional(),
	justification: z.string().min(1),
	evidence: z.array(AuthoritativeSourceReferenceSchema).optional(),
	relatedPrincipleIds: z
		.array(z.string().regex(ARCHITECTURE_PRINCIPLE_ID_PATTERNS.principle))
		.optional(),
	supersededBy: z
		.string()
		.regex(ARCHITECTURE_PRINCIPLE_ID_PATTERNS.principle)
		.optional(),
	supersedes: z
		.string()
		.regex(ARCHITECTURE_PRINCIPLE_ID_PATTERNS.principle)
		.optional(),
});

/** Applicability and scope boundaries. */
export const ApplicabilityScopeSchema = z.strictObject({
	domains: z.array(ResearchDomainSchema).min(1),
	subdomains: z
		.array(z.string().regex(ARCHITECTURE_PRINCIPLE_ID_PATTERNS.subdomain))
		.optional(),
	applicableContexts: z.array(z.string()).default([]),
	explicitBoundaries: z.array(z.string()).min(1),
	exceptions: z.array(z.string()).default([]),
	outOfScope: z.array(z.string()).default([]),
});

/** Evidence synthesis for a principle. */
export const PrincipleEvidenceSynthesisSchema = z.strictObject({
	supportingEvidence: z.array(PrincipleEvidenceReferenceSchema).default([]),
	contradictoryEvidence: z
		.array(PrincipleEvidenceReferenceSchema)
		.default([]),
	limitingEvidence: z.array(PrincipleEvidenceReferenceSchema).default([]),
	overallConfidence: z.number().min(0).max(1),
	evidenceGaps: z.array(z.string()).default([]),
	verificationSummary: z.string().min(1),
	standardsAlignment: z.array(StandardsReferenceSchema).default([]),
});

/** Architectural reasoning trace. */
export const ArchitecturalReasoningSchema = z.strictObject({
	verifiedFinding: z.string().min(1),
	underlyingConcern: z.string().min(1),
	causalAssumptions: z.array(z.string()).default([]),
	existingPrinciplesExamined: z
		.array(z.string().regex(ARCHITECTURE_PRINCIPLE_ID_PATTERNS.principle))
		.default([]),
	generalizabilityAssessment: z.string().min(1),
	alternativeExplanations: z.array(z.string()).default([]),
	counterevidenceExamined: z.array(z.string()).default([]),
	qualityAttributesIdentified: z.array(QualityAttributeSchema).min(1),
	normativeRuleDerived: z.string().min(1),
	scopeDefined: ApplicabilityScopeSchema,
	testableConsequencesSpecified: z
		.array(TestableDesignConsequenceSchema)
		.min(1),
	tradeoffsIdentified: z.array(TradeoffSchema).default([]),
	lifecycleRecommendation: ArchitecturePrincipleLifecycleSchema,
	changeClassification: PrincipleChangeClassificationSchema,
	uncertaintyAcknowledged: z.array(z.string()).default([]),
});

/** Knowledge continuity gate result for principles. */
export const PrinciplesKnowledgeContinuityResultSchema = z.strictObject({
	gateStatus: KnowledgeContinuityGateStatusSchema,
	registerAvailable: z.boolean(),
	existingPrinciplesRead: z.number().int().nonnegative(),
	proposedDeltas: z.array(
		z.strictObject({
			principleId: z
				.string()
				.regex(ARCHITECTURE_PRINCIPLE_ID_PATTERNS.principle)
				.optional(),
			changeClassification: PrincipleChangeClassificationSchema,
			evidenceVerified: z.boolean(),
			relationshipsValidated: z.boolean(),
			lifecycleTransitionValid: z.boolean(),
		}),
	),
	persistenceVerified: z.boolean(),
	independentReadbackVerified: z.boolean(),
	unresolvedHypotheses: z.array(z.string()).default([]),
	failedUpdates: z.array(z.string()).default([]),
	details: z.string().min(1),
	evaluatedAt: z.string(),
	evaluatedBy: z.string().min(1),
});

// ============================================================================
// Main Architecture Principle Schema
// ============================================================================

export const ArchitecturePrincipleSchema = z.strictObject({
	// Stable identifier (AP-001, AP-002, etc.)
	principleId: z.string().regex(ARCHITECTURE_PRINCIPLE_ID_PATTERNS.principle),

	// Concise descriptive title
	title: BilingualStringSchema,

	// Normative principle statement — the actual architectural rule
	statement: BilingualStringSchema,

	// Architectural concern or problem addressed
	concern: BilingualStringSchema,

	// Rationale with evidence traceability
	rationale: BilingualStringSchema,

	// Applicability and scope boundaries
	applicability: ApplicabilityScopeSchema,

	// Testable design consequences (at least one required)
	testableConsequences: z.array(TestableDesignConsequenceSchema).min(1),

	// Relevant quality attributes
	qualityAttributes: z.array(QualityAttributeSchema).min(1),

	// Important trade-offs
	tradeoffs: z.array(TradeoffSchema).default([]),

	// Evidence synthesis
	evidence: PrincipleEvidenceSynthesisSchema,

	// Standards alignment (verified, not claimed)
	standards: z.array(StandardsReferenceSchema).default([]),

	// Research domains this principle draws from
	researchDomains: z.array(ResearchDomainSchema).min(1),

	// Related terminology identifiers (thesaurus entry IDs)
	terminologyReferences: z
		.array(
			z.string().regex(ARCHITECTURE_PRINCIPLE_ID_PATTERNS.thesaurusEntry),
		)
		.default([]),

	// Relationships with other principles
	relationships: z.array(PrincipleRelationshipSchema).default([]),

	// Lifecycle management
	lifecycleStatus: ArchitecturePrincipleLifecycleSchema,

	// Temporal tracking
	firstVerifiedObservationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	lastReviewedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	establishedAt: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.optional(),
	revisedAt: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.optional(),
	supersededAt: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.optional(),
	supersededBy: z
		.string()
		.regex(ARCHITECTURE_PRINCIPLE_ID_PATTERNS.principle)
		.optional(),

	// Revision history
	revisionHistory: z.array(PrincipleRevisionSchema).default([]),

	// Architectural reasoning trace (how this principle was derived)
	reasoningTrace: ArchitecturalReasoningSchema,

	// Metadata
	schemaVersion: z.literal(ARCHITECTURE_PRINCIPLES_SCHEMA_VERSION),
	createdAt: z.string(),
	updatedAt: z.string(),
	createdBy: z.string().min(1),
	tags: z.array(z.string()).default([]),
});

// ============================================================================
// Architecture Principles Register Artifact (Complete Register)
// ============================================================================

export const ArchitecturePrinciplesRegisterSchema = z.strictObject({
	artifactId: z.string().regex(ARCHITECTURE_PRINCIPLE_ID_PATTERNS.artifact),
	schemaVersion: z.literal(ARCHITECTURE_PRINCIPLES_SCHEMA_VERSION),
	editionDate: z
		.string()
		.regex(ARCHITECTURE_PRINCIPLE_ID_PATTERNS.editionDate)
		.optional(),
	generatedAt: z.string(),
	generatedBy: z.string().min(1),
	principles: z.array(ArchitecturePrincipleSchema),
	contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
	previousVersionHash: z
		.string()
		.regex(/^sha256:[a-f0-9]{64}$/)
		.optional(),
	stats: z.strictObject({
		totalPrinciples: z.number().int().nonnegative(),
		byLifecycleStatus: z.record(
			ArchitecturePrincipleLifecycleSchema,
			z.number().int().nonnegative(),
		),
		byDomain: z.record(z.string(), z.number().int().nonnegative()),
		candidatePrinciples: z.number().int().nonnegative(),
		establishedPrinciples: z.number().int().nonnegative(),
		revisedPrinciples: z.number().int().nonnegative(),
		supersededPrinciples: z.number().int().nonnegative(),
		principlesWithTestableConsequences: z.number().int().nonnegative(),
		principlesWithStandardsAlignment: z.number().int().nonnegative(),
		crossReferences: z.number().int().nonnegative(),
	}),
	validationResults: z
		.array(
			z.strictObject({
				rule: z.string(),
				passed: z.boolean(),
				details: z.string().optional(),
				affectedPrincipleIds: z
					.array(
						z
							.string()
							.regex(
								ARCHITECTURE_PRINCIPLE_ID_PATTERNS.principle,
							),
					)
					.optional(),
			}),
		)
		.default([]),
	knowledgeContinuityResult:
		PrinciplesKnowledgeContinuityResultSchema.optional(),
});

// ============================================================================
// Principle Delta (for daily research integration)
// ============================================================================

export const PrincipleDeltaSchema = z.strictObject({
	deltaId: z.string().regex(/^apd_[a-z0-9]{16}$/),
	editionDate: z
		.string()
		.regex(ARCHITECTURE_PRINCIPLE_ID_PATTERNS.editionDate),
	generatedAt: z.string(),
	generatedBy: z.string().min(1),
	proposedChanges: z.array(
		z.strictObject({
			changeClassification: PrincipleChangeClassificationSchema,
			targetPrincipleId: z
				.string()
				.regex(ARCHITECTURE_PRINCIPLE_ID_PATTERNS.principle)
				.optional(),
			proposedPrinciple: ArchitecturePrincipleSchema.partial().optional(),
			evidence: z.array(AuthoritativeSourceReferenceSchema).min(1),
			reasoningTrace: ArchitecturalReasoningSchema,
			relatedPrincipleIds: z
				.array(
					z
						.string()
						.regex(ARCHITECTURE_PRINCIPLE_ID_PATTERNS.principle),
				)
				.default([]),
			autoEligible: z.boolean().default(false),
			status: z
				.enum(["pending", "approved", "rejected", "needs-review"])
				.default("pending"),
		}),
	),
	validationResults: z
		.array(
			z.strictObject({
				rule: z.string(),
				passed: z.boolean(),
				details: z.string().optional(),
			}),
		)
		.default([]),
	contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
});

// ============================================================================
// Inferred TypeScript Types (single source of truth)
// ============================================================================

export type ArchitecturePrincipleLifecycle = z.infer<
	typeof ArchitecturePrincipleLifecycleSchema
>;
export type PrincipleChangeClassification = z.infer<
	typeof PrincipleChangeClassificationSchema
>;
export type EvidenceClassification = z.infer<
	typeof EvidenceClassificationSchema
>;
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;
export type VerificationLevel = z.infer<typeof VerificationLevelSchema>;
export type PrincipleRelationshipType = z.infer<
	typeof PrincipleRelationshipTypeSchema
>;
export type QualityAttribute = z.infer<typeof QualityAttributeSchema>;
export type ResearchDomain = z.infer<typeof ResearchDomainSchema>;
export type SourceTier = z.infer<typeof SourceTierSchema>;
export type StandardsAuthority = z.infer<typeof StandardsAuthoritySchema>;
export type KnowledgeContinuityGateStatus = z.infer<
	typeof KnowledgeContinuityGateStatusSchema
>;

export type BilingualString = z.infer<typeof BilingualStringSchema>;
export type AuthoritativeSourceReference = z.infer<
	typeof AuthoritativeSourceReferenceSchema
>;
export type PrincipleEvidenceReference = z.infer<
	typeof PrincipleEvidenceReferenceSchema
>;
export type StandardsReference = z.infer<typeof StandardsReferenceSchema>;
export type TestableDesignConsequence = z.infer<
	typeof TestableDesignConsequenceSchema
>;
export type Tradeoff = z.infer<typeof TradeoffSchema>;
export type PrincipleRelationship = z.infer<typeof PrincipleRelationshipSchema>;
export type PrincipleRevision = z.infer<typeof PrincipleRevisionSchema>;
export type ApplicabilityScope = z.infer<typeof ApplicabilityScopeSchema>;
export type PrincipleEvidenceSynthesis = z.infer<
	typeof PrincipleEvidenceSynthesisSchema
>;
export type ArchitecturalReasoning = z.infer<
	typeof ArchitecturalReasoningSchema
>;
export type PrinciplesKnowledgeContinuityResult = z.infer<
	typeof PrinciplesKnowledgeContinuityResultSchema
>;

export type ArchitecturePrinciple = z.infer<typeof ArchitecturePrincipleSchema>;
export type ArchitecturePrinciplesRegister = z.infer<
	typeof ArchitecturePrinciplesRegisterSchema
>;
export type PrincipleDelta = z.infer<typeof PrincipleDeltaSchema>;

// ============================================================================
// JSON Schema Generation (single source of truth → machine-readable contract)
// ============================================================================

/**
 * Generate the draft-07 JSON Schema for an architecture principle.
 */
export function generateArchitecturePrincipleJsonSchema(): Record<
	string,
	unknown
> {
	const generated = z.toJSONSchema(ArchitecturePrincipleSchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/architecture-principle.json",
		title: "Architecture Principle",
		description:
			"Evidence-backed, reusable normative architectural guidance with full traceability to verified evidence and established foundations.",
		...generated,
	};
}

/**
 * Generate the draft-07 JSON Schema for the complete architecture principles register.
 */
export function generateArchitecturePrinciplesRegisterJsonSchema(): Record<
	string,
	unknown
> {
	const generated = z.toJSONSchema(ArchitecturePrinciplesRegisterSchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/architecture-principles-register.json",
		title: "Architecture Principles Register",
		description:
			"Complete persistent register of evidence-backed architectural principles with lifecycle management, relationships, and knowledge continuity integration.",
		...generated,
	};
}

/**
 * Generate the draft-07 JSON Schema for a principle delta.
 */
export function generatePrincipleDeltaJsonSchema(): Record<string, unknown> {
	const generated = z.toJSONSchema(PrincipleDeltaSchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/principle-delta.json",
		title: "Principle Delta",
		description:
			"Proposed changes to the architecture principles register with supporting evidence and reasoning trace.",
		...generated,
	};
}
