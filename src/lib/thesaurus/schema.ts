/**
 * AI Intelligence Terminology Thesaurus — Schema Layer
 *
 * Defines the authoritative, versioned, machine-readable data contract for the
 * persistent terminology thesaurus. The thesaurus is a durable knowledge asset
 * independent of individual news editions, fully traceable to authoritative sources.
 *
 * Design rules:
 * - Schemas are defined with Zod (TypeScript schemas) and inferred into static
 *   types, so the runtime validator and the compile-time types cannot drift.
 * - A JSON Schema (draft-07) is generated from the same Zod schemas via
 *   `z.toJSONSchema`, so the on-disk data contract and the TypeScript contract
 *   are generated from one source of truth.
 * - Every identifier pattern reuses the existing stable identifier conventions.
 * - The thesaurus preserves separation from: Source Registry, Research Taxonomy,
 *   Canonical Fact Dossier, Architecture Principles Register, Publication Generators.
 */

import { z } from "astro/zod";

// ============================================================================
// Constants
// ============================================================================

/** Current thesaurus schema version. */
export const THESAURUS_SCHEMA_VERSION = "1.0.0";

/** Prefix for thesaurus entry identifiers. */
export const THESAURUS_ENTRY_ID_PREFIX = "thes_";

/** Prefix for thesaurus artifact identifiers. */
export const THESAURUS_ARTIFACT_ID_PREFIX = "thesart_";

/** Stable identifier patterns reused from the existing pipeline. */
export const ID_PATTERNS = {
	thesaurusEntry: /^thes_[a-z0-9]{16}$/,
	thesaurusArtifact: /^thesart_[a-z0-9]{16}$/,
	edition: /^edition_\d{4}-\d{2}-\d{2}$/,
	candidate: /^cand_[a-z0-9]{16}$/,
	claim: /^claim_[a-z0-9]{16}$/,
	discovery: /^disc_[a-z0-9]{16}$/,
	source: /^[a-z0-9-]+$/,
	subdomain: /^DOM-\d{2}-SD\d{2}$/,
	editionDate: /^\d{4}-\d{2}-\d{2}$/,
	// Research taxonomy domain identifier (the taxonomy `id`, e.g.
	// "agentic-ai-software-engineering"). Subdomains use their stable
	// DOM-XX-SDXX identifier; domains use the canonical domain id.
	domain: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
} as const;

// ============================================================================
// Enumerations
// ============================================================================

/** Terminology lifecycle status. */
export const TerminologyLifecycleStatusSchema = z.enum([
	"CANDIDATE", // Proposed but not sufficiently verified
	"VERIFIED", // Evidence supports the definition
	"ESTABLISHED", // Accepted as part of the canonical terminology register
	"REVISED", // Definition updated with traceable justification
	"DEPRECATED", // Term remains historically relevant but no longer preferred
	"SUPERSEDED", // A replacement canonical concept or term is established
]);

/** Terminology change type for revision history. */
export const TerminologyChangeTypeSchema = z.enum([
	"ADD", // New entry added
	"CONFIRM", // Candidate promoted to verified/established
	"REFINE", // Definition improved without changing core meaning
	"MERGE", // Two entries merged into one
	"DEPRECATE", // Entry marked as deprecated
	"SUPERSEDE", // Entry replaced by another
	"NONE", // No change (e.g., periodic review)
]);

/** Evidence classification — inherited from evidence-verification. */
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

/** Verification status — inherited from evidence-verification. */
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

/** Relationship types between terminology concepts. */
export const TerminologyRelationshipTypeSchema = z.enum([
	"synonym-of", // Equivalent terminology
	"alias-of", // Alternative name for the same concept
	"broader-than", // More general concept
	"narrower-than", // More specific concept
	"related-to", // Relevant conceptual association
	"part-of", // Constituent element of a broader concept
	"extends", // Conceptual extension where substantiated
	"contrasts-with", // Important conceptual distinction
	"supersedes", // Replacement of obsolete terminology
	"conflicts-with", // Documented incompatible definitions or interpretations
]);

/** Source authority tier (mirrors source registry). */
export const SourceTierSchema = z.union([
	z.literal(1),
	z.literal(2),
	z.literal(3),
]);

/** Language codes supported. */
export const LanguageCodeSchema = z.union([z.literal("en"), z.literal("nl")]);

// ============================================================================
// Shared Sub-Records
// ============================================================================

/** Bilingual string pair (English + Dutch). */
export const BilingualStringSchema = z.strictObject({
	en: z.string().min(1),
	nl: z.string().min(1),
});

/** Language-specific aliases. */
export const LanguageAliasesSchema = z.strictObject({
	en: z.array(z.string()).optional(),
	nl: z.array(z.string()).optional(),
});

/** Language-specific forbidden terms. */
export const LanguageForbiddenSchema = z.strictObject({
	en: z.array(z.string()).optional(),
	nl: z.array(z.string()).optional(),
});

/** Authoritative source reference. */
export const AuthoritativeSourceReferenceSchema = z.strictObject({
	sourceId: z.string().regex(ID_PATTERNS.source),
	url: z.string().url(),
	title: z.string().min(1),
	tier: SourceTierSchema,
	section: z.string().optional(), // Section, paragraph, page, etc.
	accessedAt: z.string(), // ISO timestamp
	retrievalStatus: z.enum([
		"CHECKED_FOUND",
		"CHECKED_NONE",
		"INACCESSIBLE",
		"NOT_CHECKED",
		"ERROR",
	]),
	confidence: z.number().min(0).max(1),
});

/** Version-specific applicability. */
export const VersionApplicabilitySchema = z.strictObject({
	version: z.string().min(1), // e.g., "v1.0", "2024-01", "GA"
	applicable: z.boolean(),
	notes: z.string().optional(),
});

/** Terminology relationship with full traceability. */
export const TerminologyRelationshipSchema = z.strictObject({
	targetId: z.string().regex(ID_PATTERNS.thesaurusEntry),
	type: TerminologyRelationshipTypeSchema,
	rationale: z.string().min(1),
	evidence: z.array(AuthoritativeSourceReferenceSchema).optional(),
	confidence: z.number().min(0).max(1).default(1),
	establishedAt: z.string(), // ISO timestamp
	establishedBy: z.string().min(1),
});

/** Revision history entry. */
export const TerminologyRevisionSchema = z.strictObject({
	revisionId: z.string().min(1),
	changeType: TerminologyChangeTypeSchema,
	revisedAt: z.string(), // ISO timestamp
	revisedBy: z.string().min(1),
	previousLifecycleStatus: TerminologyLifecycleStatusSchema.optional(),
	newLifecycleStatus: TerminologyLifecycleStatusSchema.optional(),
	fieldChanged: z.string().optional(), // Which field was modified
	previousValue: z.string().optional(),
	newValue: z.string().optional(),
	justification: z.string().min(1),
	evidence: z.array(AuthoritativeSourceReferenceSchema).optional(),
	relatedEntryIds: z
		.array(z.string().regex(ID_PATTERNS.thesaurusEntry))
		.optional(),
});

/** Research domain membership (references research taxonomy domains). */
export const ResearchDomainMembershipSchema = z.strictObject({
	domainId: z.string().regex(ID_PATTERNS.domain), // research taxonomy domain id, e.g. "agentic-ai-software-engineering"
	subdomainIds: z.array(z.string().regex(ID_PATTERNS.subdomain)).optional(),
	primary: z.boolean().default(false),
});

/** Acronym/abbreviation record. */
export const AcronymSchema = z.strictObject({
	acronym: z.string().min(1),
	expansion: BilingualStringSchema,
	context: z.string().optional(), // When the acronym is used
	authority: z.string().optional(), // Standard or vendor that defines it
});

/** Historical observation record. */
export const HistoricalObservationSchema = z.strictObject({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
	sourceId: z.string().regex(ID_PATTERNS.source),
	sourceUrl: z.string().url(),
	context: z.string().min(1),
	confidence: z.number().min(0).max(1),
	isFirstObserved: z.boolean().default(false),
	note: z.string().optional(),
});

// ============================================================================
// Main Terminology Entry Schema
// ============================================================================

export const TerminologyEntrySchema = z.strictObject({
	// Stable identifier
	entryId: z.string().regex(ID_PATTERNS.thesaurusEntry),

	// Canonical term (preferred English form)
	canonicalTerm: z.string().min(1),

	// Original language of the term
	originalLanguage: LanguageCodeSchema,

	// Bilingual preferred terms/explanations
	preferredTerm: BilingualStringSchema,

	// Acronyms and abbreviations
	acronyms: z.array(AcronymSchema).default([]),

	// Alternative names and aliases per language
	aliases: LanguageAliasesSchema.default({}),

	// Concise, technically accurate definition
	definition: BilingualStringSchema,

	// Research domains this concept belongs to
	researchDomains: z.array(ResearchDomainMembershipSchema).min(1),

	// Relationships to other terminology entries
	relationships: z.array(TerminologyRelationshipSchema).default([]),

	// Authoritative source references
	sources: z.array(AuthoritativeSourceReferenceSchema).min(1),

	// Evidence and verification status
	evidenceClassification: EvidenceClassificationSchema,
	verificationStatus: VerificationStatusSchema,
	verificationConfidence: z.number().min(0).max(1),

	// Applicable standards or specifications
	standards: z.array(z.string()).default([]),

	// Version-specific applicability
	versionApplicability: z.array(VersionApplicabilitySchema).default([]),

	// Forbidden terms (terms that should NOT be used for this concept)
	forbidden: LanguageForbiddenSchema.default({}),

	// Lifecycle management
	lifecycleStatus: TerminologyLifecycleStatusSchema,

	// Temporal tracking
	firstObservedAt: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.optional(), // When concept first appeared in public record
	firstVerifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // When first verified in this thesaurus
	lastReviewedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // Last verification review date
	establishedAt: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.optional(), // When promoted to ESTABLISHED
	deprecatedAt: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.nullable()
		.optional(), // When deprecated
	supersededBy: z
		.string()
		.regex(ID_PATTERNS.thesaurusEntry)
		.nullable()
		.optional(), // Replacement entry ID

	// Revision history
	revisionHistory: z.array(TerminologyRevisionSchema).default([]),

	// Historical observations (for continuity tracking)
	historicalObservations: z.array(HistoricalObservationSchema).default([]),

	// Metadata
	schemaVersion: z.literal(THESAURUS_SCHEMA_VERSION),
	createdAt: z.string(),
	updatedAt: z.string(),
	createdBy: z.string().min(1),
	tags: z.array(z.string()).default([]),
});

// ============================================================================
// Thesaurus Artifact (Complete Register)
// ============================================================================

export const ThesaurusArtifactSchema = z.strictObject({
	artifactId: z.string().regex(ID_PATTERNS.thesaurusArtifact),
	schemaVersion: z.literal(THESAURUS_SCHEMA_VERSION),
	editionDate: z.string().regex(ID_PATTERNS.editionDate).optional(), // Edition date this artifact was generated for
	generatedAt: z.string(),
	generatedBy: z.string().min(1),
	entries: z.array(TerminologyEntrySchema),
	contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
	previousVersionHash: z
		.string()
		.regex(/^sha256:[a-f0-9]{64}$/)
		.nullable()
		.optional(),
	stats: z.strictObject({
		totalEntries: z.number().int().nonnegative(),
		byLifecycleStatus: z.record(
			TerminologyLifecycleStatusSchema,
			z.number().int().nonnegative(),
		),
		byDomain: z.record(z.string(), z.number().int().nonnegative()),
		verifiedEntries: z.number().int().nonnegative(),
		establishedEntries: z.number().int().nonnegative(),
		candidateEntries: z.number().int().nonnegative(),
		deprecatedEntries: z.number().int().nonnegative(),
		supersededEntries: z.number().int().nonnegative(),
		bilingualEntries: z.number().int().nonnegative(),
		entriesWithRelationships: z.number().int().nonnegative(),
	}),
	validationResults: z
		.array(
			z.strictObject({
				rule: z.string(),
				passed: z.boolean(),
				details: z.string().optional(),
				affectedEntryIds: z
					.array(z.string().regex(ID_PATTERNS.thesaurusEntry))
					.optional(),
			}),
		)
		.default([]),
});

// ============================================================================
// Change Proposal (for terminology discovery workflow)
// ============================================================================

export const TerminologyChangeProposalSchema = z.strictObject({
	proposalId: z.string().regex(/^prop_[a-z0-9]{16}$/),
	editionDate: z.string().regex(ID_PATTERNS.edition),
	changeType: TerminologyChangeTypeSchema,
	targetEntryId: z.string().regex(ID_PATTERNS.thesaurusEntry).optional(), // Absent for ADD
	proposedEntry: TerminologyEntrySchema.partial().optional(), // For ADD/REFINE
	evidence: z.array(AuthoritativeSourceReferenceSchema).min(1),
	justification: z.string().min(1),
	relatedEntryIds: z
		.array(z.string().regex(ID_PATTERNS.thesaurusEntry))
		.default([]),
	autoEligible: z.boolean().default(false), // Whether it meets automatic promotion criteria
	status: z.enum(["pending", "approved", "rejected", "needs-review"]),
	proposedAt: z.string(),
	proposedBy: z.string().min(1),
	decidedAt: z.string().optional(),
	decidedBy: z.string().optional(),
	decisionRationale: z.string().optional(),
});

// ============================================================================
// Inferred TypeScript Types
// ============================================================================

export type TerminologyLifecycleStatus = z.infer<
	typeof TerminologyLifecycleStatusSchema
>;
export type TerminologyChangeType = z.infer<typeof TerminologyChangeTypeSchema>;
export type EvidenceClassification = z.infer<
	typeof EvidenceClassificationSchema
>;
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;
export type TerminologyRelationshipType = z.infer<
	typeof TerminologyRelationshipTypeSchema
>;
export type SourceTier = z.infer<typeof SourceTierSchema>;
export type LanguageCode = z.infer<typeof LanguageCodeSchema>;

export type BilingualString = z.infer<typeof BilingualStringSchema>;
export type LanguageAliases = z.infer<typeof LanguageAliasesSchema>;
export type LanguageForbidden = z.infer<typeof LanguageForbiddenSchema>;
export type AuthoritativeSourceReference = z.infer<
	typeof AuthoritativeSourceReferenceSchema
>;
export type VersionApplicability = z.infer<typeof VersionApplicabilitySchema>;
export type TerminologyRelationship = z.infer<
	typeof TerminologyRelationshipSchema
>;
export type TerminologyRevision = z.infer<typeof TerminologyRevisionSchema>;
export type ResearchDomainMembership = z.infer<
	typeof ResearchDomainMembershipSchema
>;
export type Acronym = z.infer<typeof AcronymSchema>;
export type HistoricalObservation = z.infer<typeof HistoricalObservationSchema>;

export type TerminologyEntry = z.infer<typeof TerminologyEntrySchema>;
export type ThesaurusArtifact = z.infer<typeof ThesaurusArtifactSchema>;
export type TerminologyChangeProposal = z.infer<
	typeof TerminologyChangeProposalSchema
>;

// ============================================================================
// JSON Schema Generation (Single Source of Truth)
// ============================================================================

/**
 * Generate the draft-07 JSON Schema for a terminology entry.
 */
export function generateTerminologyEntryJsonSchema(): Record<string, unknown> {
	const generated = z.toJSONSchema(TerminologyEntrySchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/terminology-entry.json",
		title: "Terminology Entry",
		description:
			"Authoritative terminology entry with bilingual definitions, relationships, evidence, and lifecycle tracking.",
		...generated,
	};
}

/**
 * Generate the draft-07 JSON Schema for the complete thesaurus artifact.
 */
export function generateThesaurusArtifactJsonSchema(): Record<string, unknown> {
	const generated = z.toJSONSchema(ThesaurusArtifactSchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/thesaurus-artifact.json",
		title: "Thesaurus Artifact",
		description:
			"Complete persistent terminology thesaurus containing all verified and candidate entries.",
		...generated,
	};
}

/**
 * Generate the draft-07 JSON Schema for terminology change proposals.
 */
export function generateTerminologyChangeProposalJsonSchema(): Record<
	string,
	unknown
> {
	const generated = z.toJSONSchema(TerminologyChangeProposalSchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/terminology-change-proposal.json",
		title: "Terminology Change Proposal",
		description:
			"Proposal for adding, modifying, or deprecating terminology entries with supporting evidence.",
		...generated,
	};
}
