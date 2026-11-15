/**
 * Canonical Daily Publication — Schema Layer
 *
 * Defines the authoritative, versioned, machine-readable data contract for the
 * three canonical daily publications per edition:
 * 1. publication.md — Dutch technical newsletter
 * 2. research-audit.md — Technical evidence and editorial accountability
 * 3. AI Daily Intelligence — YYYY-MM-DD.md — Dutch listening narrative
 *
 * Plus the daily index.md (navigational metadata, not a fourth publication).
 *
 * Design rules:
 * - Schemas are defined with Zod (TypeScript schemas) and inferred into static
 *   types, so the runtime validator and the compile-time types cannot drift.
 * - A JSON Schema (draft-07) is generated from the same Zod schemas via
 *   `z.toJSONSchema`, so the on-disk data contract and the TypeScript contract
 *   are generated from one source of truth.
 * - Every identifier pattern reuses the existing stable identifier conventions.
 * - The publication artifacts must consume the canonical fact dossier and
 *   editorial selection manifest without independently changing factual eligibility,
 *   evidence classifications or editorial decisions.
 */

import { z } from "astro/zod";

// ============================================================================
// Constants
// ============================================================================

/** Current canonical publication schema version. */
export const PUBLICATION_SCHEMA_VERSION = "1.0.0";

/** Prefix for edition identifiers. */
export const EDITION_ID_PREFIX = "edition_";

/** Prefix for article identifiers (stable across languages). */
export const ARTICLE_ID_PREFIX = "art_";

/** Prefix for publication artifact identifiers. */
export const PUBLICATION_ARTIFACT_ID_PREFIX = "pubart_";

/** Canonical publication artifact filenames (exact, no variations). */
export const CANONICAL_ARTIFACT_FILENAMES = {
	newsletter: "publication.md",
	researchAudit: "research-audit.md",
	listeningNarrative: (editionDate: string) =>
		`AI Daily Intelligence — ${editionDate}.md`,
	dailyIndex: "index.md",
} as const;

/** Supported locales. */
export const LOCALE_SCHEMA = z.union([z.literal("nl"), z.literal("en")]);

/** Publication lifecycle states per contract §11. */
export const PublicationLifecycleStatusSchema = z.enum([
	"DRAFT",
	"READY_FOR_VALIDATION",
	"VALIDATED",
	"PUBLISHED",
	"FAILED",
	"INCOMPLETE",
	"SUPERSEDED",
]);

/** Content type for the three canonical publications + index. */
export const PublicationContentTypeSchema = z.enum([
	"newsletter", // publication.md — Dutch technical newsletter
	"research-audit", // research-audit.md — Technical evidence and editorial accountability
	"listening-narrative", // AI Daily Intelligence — YYYY-MM-DD.md — Dutch listening narrative
	"daily-index", // index.md — Navigational metadata (not a publication)
	"english-derivative", // English website article (derived, not canonical)
	"english-listening", // English listening-text derivative (derived, not canonical)
]);

/** Language of the content. */
export const PublicationLanguageSchema = z.enum(["nl", "en"]);

/** Edition date pattern (YYYY-MM-DD in Europe/Amsterdam). */
export const EDITION_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// ============================================================================
// Edition Identity
// ============================================================================

/** Edition window schema (reusable). */
export const EditionWindowSchema = z.strictObject({
	editionDate: z.string().regex(EDITION_DATE_PATTERN),
	start: z.string().min(1),
	end: z.string().min(1),
	timezone: z.literal("Europe/Amsterdam"),
	durationHours: z.number().int().positive().max(25),
});

/** Reporting window schema (reusable). */
export const ReportingWindowSchema = z.strictObject({
	start: z.string().min(1),
	end: z.string().min(1),
	timezone: z.literal("Europe/Amsterdam"),
});

/**
 * Edition identity and reporting window.
 * Fixed by edition date (Europe/Amsterdam), never by execution time.
 */
export const EditionIdentitySchema = z.strictObject({
	editionId: z.string().regex(/^edition_\d{4}-\d{2}-\d{2}$/),
	editionDate: z.string().regex(EDITION_DATE_PATTERN),
	editionWindow: EditionWindowSchema,
	reportingWindow: ReportingWindowSchema,
});

// ============================================================================
// Canonical References
// ============================================================================

/**
 * References to the authoritative upstream artifacts this publication derives from.
 */
export const CanonicalReferencesSchema = z.strictObject({
	factDossier: z.strictObject({
		dossierId: z.string().regex(/^fd_[a-z0-9]{16}$/),
		editionId: z.string().regex(/^edition_\d{4}-\d{2}-\d{2}$/),
		contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
	}),
	editorialSelection: z.strictObject({
		manifestId: z.string().regex(/^esm_[a-z0-9]{16}$/),
		editionId: z.string().regex(/^edition_\d{4}-\d{2}-\d{2}$/),
		contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
	}),
	historicalRegression: z.strictObject({
		reportId: z.string().regex(/^hr_[a-z0-9]{16}$/),
		editionId: z.string().regex(/^edition_\d{4}-\d{2}-\d{2}$/),
		contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
		referenced: z.boolean(),
	}),
	omissionReview: z.strictObject({
		reportId: z.string().min(1),
		executionId: z.string().min(1),
		referenced: z.boolean(),
	}),
});

// ============================================================================
// Article Identity (Stable Across Languages)
// ============================================================================

/**
 * Stable article identity used across all language variants.
 * The articleId never changes; locale-specific files reference it.
 */
export const ArticleIdentitySchema = z.strictObject({
	articleId: z.string().regex(/^art_[a-z0-9]{16}$/),
	storyId: z.string().regex(/^story_[a-z0-9]{16}$/), // From editorial selection manifest
	candidateIds: z.array(z.string().regex(/^cand_[a-z0-9]{16}$/)).min(1),
	claimIds: z.array(z.string().regex(/^claim_[a-z0-9]{16}$/)).min(1),
	sourceIds: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1),
	sourceReferences: z.array(z.string().url()).min(1), // Original source URLs
	organizations: z.array(z.string()).min(1),
	researchDomains: z.array(z.string()).min(1),
	discoveryRings: z
		.array(z.union([z.literal(1), z.literal(2), z.literal(3)]))
		.min(1),
	materialityScore: z.number().min(0).max(1),
	materialityLevel: z.enum(["high", "medium", "low", "unclear"]),
	recommendedDepth: z.enum(["brief", "standard", "deep-dive"]),
	explanationOpportunities: z.array(
		z.enum([
			"technical-deep-dive",
			"scientific-explanation",
			"strategic-interpretation",
			"accessible-comparison",
			"diagram",
			"timeline",
			"historical-context",
			"practical-engineering",
		]),
	),
	evidenceClassificationSummary: z.string().min(1),
	caveats: z.array(z.string()),
});

// ============================================================================
// Publication Metadata (Per Artifact)
// ============================================================================

/**
 * Metadata for a single publication artifact.
 * Shared structure for all three canonical publications + derivatives.
 */
export const PublicationMetadataSchema = z.strictObject({
	artifactId: z.string().regex(/^pubart_[a-z0-9]{16}$/),
	editionId: z.string().regex(/^edition_\d{4}-\d{2}-\d{2}$/),
	editionDate: z.string().regex(EDITION_DATE_PATTERN),
	contentType: PublicationContentTypeSchema,
	language: PublicationLanguageSchema,
	canonicalFilename: z.string().min(1), // Exact filename per CANONICAL_ARTIFACT_FILENAMES
	title: z.string().min(1),
	description: z.string().min(1),
	articleId: z.optional(z.string().regex(/^art_[a-z0-9]{16}$/)), // Absent for index.md
	publicationTimestamp: z.string().min(1), // When this artifact was generated
	originalNewsDisclosureTimestamp: z.optional(z.string()), // When underlying news was first disclosed
	lastSubstantiveUpdateTimestamp: z.optional(z.string()), // Last content change
	readingTimeMinutes: z.optional(z.number().int().positive()), // For readable content
	estimatedListeningDurationMinutes: z.optional(z.number().int().positive()), // For audio content
	sourceReferences: z.array(z.string().url()), // Original source URLs
	claimReferences: z.array(z.string().regex(/^claim_[a-z0-9]{16}$/)), // Claim IDs from dossier
	topics: z.array(z.string()),
	organizations: z.array(z.string()),
	lifecycleStatus: PublicationLifecycleStatusSchema,
	validationStatus: z.enum(["pending", "passed", "failed", "skipped"]),
	validationResults: z.array(
		z.strictObject({
			gate: z.string(),
			passed: z.boolean(),
			details: z.optional(z.string()),
			timestamp: z.string(),
		}),
	),
	relatedVariants: z.array(
		z.strictObject({
			contentType: PublicationContentTypeSchema,
			language: PublicationLanguageSchema,
			artifactId: z.string().regex(/^pubart_[a-z0-9]{16}$/),
			relationship: z.enum([
				"translation",
				"derivative",
				"source",
				"listening-text",
			]),
		}),
	),
	version: z.number().int().positive().default(1),
	schemaVersion: z.literal(PUBLICATION_SCHEMA_VERSION),
	contentHash: z.optional(z.string().regex(/^sha256:[a-f0-9]{64}$/)),
});

// ============================================================================
// Daily Index (Navigational Metadata)
// ============================================================================

/**
 * Daily index.md — navigational metadata only, not a fourth publication.
 * References the three canonical publications and their derivatives.
 */
export const DailyIndexSchema = z.strictObject({
	editionId: z.string().regex(/^edition_\d{4}-\d{2}-\d{2}$/),
	editionDate: z.string().regex(EDITION_DATE_PATTERN),
	editionWindow: EditionWindowSchema,
	reportingWindow: ReportingWindowSchema,
	canonicalPublications: z
		.array(
			z.strictObject({
				contentType: z.enum([
					"newsletter",
					"research-audit",
					"listening-narrative",
				]),
				language: z.literal("nl"),
				artifactId: z.string().regex(/^pubart_[a-z0-9]{16}$/),
				filename: z.string().min(1),
				title: z.string().min(1),
				description: z.string().min(1),
				lifecycleStatus: PublicationLifecycleStatusSchema,
				relativePath: z.string().min(1), // Relative path from index.md
				readingTimeMinutes: z.optional(z.number().int().positive()),
				estimatedListeningDurationMinutes: z.optional(
					z.number().int().positive(),
				),
			}),
		)
		.length(3),
	englishDerivatives: z
		.array(
			z.strictObject({
				contentType: z.enum([
					"english-derivative",
					"english-listening",
				]),
				language: z.literal("en"),
				artifactId: z.string().regex(/^pubart_[a-z0-9]{16}$/),
				filename: z.string().min(1),
				title: z.string().min(1),
				description: z.string().min(1),
				lifecycleStatus: PublicationLifecycleStatusSchema,
				relativePath: z.string().min(1),
				sourceArtifactId: z.string().regex(/^pubart_[a-z0-9]{16}$/), // Dutch canonical it derives from
			}),
		)
		.optional(),
	availableNavigation: z.strictObject({
		byTopic: z.array(
			z.strictObject({
				topic: z.string(),
				articleIds: z.array(z.string().regex(/^art_[a-z0-9]{16}$/)),
			}),
		),
		bySource: z.array(
			z.strictObject({
				sourceId: z.string().regex(/^[a-z0-9-]+$/),
				articleIds: z.array(z.string().regex(/^art_[a-z0-9]{16}$/)),
			}),
		),
		byOrganization: z.array(
			z.strictObject({
				organization: z.string(),
				articleIds: z.array(z.string().regex(/^art_[a-z0-9]{16}$/)),
			}),
		),
		byResearchDomain: z.array(
			z.strictObject({
				domain: z.string(),
				articleIds: z.array(z.string().regex(/^art_[a-z0-9]{16}$/)),
			}),
		),
	}),
	missingArtifacts: z.array(
		z.strictObject({
			contentType: PublicationContentTypeSchema,
			language: PublicationLanguageSchema,
			reason: z.string(),
		}),
	),
	generatedAt: z.string().min(1),
	generatedBy: z.string().min(1),
	schemaVersion: z.literal(PUBLICATION_SCHEMA_VERSION),
	contentHash: z.optional(z.string().regex(/^sha256:[a-f0-9]{64}$/)),
});

// ============================================================================
// Publication Package (Complete Edition Output)
// ============================================================================

/**
 * Complete publication package for one edition.
 * Contains all artifacts, metadata, and validation results.
 */
export const PublicationPackageSchema = z.strictObject({
	schemaVersion: z.literal(PUBLICATION_SCHEMA_VERSION),
	packageId: z.string().regex(/^pubpkg_[a-z0-9]{16}$/),
	editionIdentity: EditionIdentitySchema,
	canonicalReferences: CanonicalReferencesSchema,
	articles: z.array(ArticleIdentitySchema),
	artifacts: z.array(PublicationMetadataSchema),
	dailyIndex: DailyIndexSchema,
	validationSummary: z.strictObject({
		totalArtifacts: z.number().int().nonnegative(),
		validatedArtifacts: z.number().int().nonnegative(),
		failedArtifacts: z.number().int().nonnegative(),
		incompleteArtifacts: z.number().int().nonnegative(),
		allGatesPassed: z.boolean(),
		validationTimestamp: z.string(),
	}),
	generatedAt: z.string().min(1),
	generatedBy: z.string().min(1),
	contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
});

// ============================================================================
// Directory Structure
// ============================================================================

/**
 * Predictable, validated relative paths for edition artifacts.
 * Follows existing repository conventions.
 */
export const EditionDirectorySchema = z.strictObject({
	editionDir: z.string().regex(/^editions\/edition_\d{4}-\d{2}-\d{2}$/),
	canonicalDir: z
		.string()
		.regex(/^editions\/edition_\d{4}-\d{2}-\d{2}\/canonical$/),
	derivativesDir: z
		.string()
		.regex(/^editions\/edition_\d{4}-\d{2}-\d{2}\/derivatives$/),
	auditDir: z.string().regex(/^editions\/edition_\d{4}-\d{2}-\d{2}\/audit$/),
	indexFile: z
		.string()
		.regex(/^editions\/edition_\d{4}-\d{2}-\d{2}\/index\.md$/),
	// Canonical artifact paths
	newsletterPath: z
		.string()
		.regex(
			/^editions\/edition_\d{4}-\d{2}-\d{2}\/canonical\/publication\.md$/,
		),
	researchAuditPath: z
		.string()
		.regex(
			/^editions\/edition_\d{4}-\d{2}-\d{2}\/canonical\/research-audit\.md$/,
		),
	listeningNarrativePath: z
		.string()
		.regex(
			/^editions\/edition_\d{4}-\d{2}-\d{2}\/canonical\/AI Daily Intelligence — \d{4}-\d{2}-\d{2}\.md$/,
		),
	// Derivative paths (language-specific subdirs)
	englishArticlesDir: z
		.string()
		.regex(
			/^editions\/edition_\d{4}-\d{2}-\d{2}\/derivatives\/en\/articles$/,
		),
	englishListeningDir: z
		.string()
		.regex(
			/^editions\/edition_\d{4}-\d{2}-\d{2}\/derivatives\/en\/listening$/,
		),
});

// ============================================================================
// Visual Content Contracts
// ============================================================================

/**
 * Optional visual content references (diagrams, tables, timelines).
 * Only included when they materially improve understanding and are evidence-based.
 */
export const VisualContentReferenceSchema = z.strictObject({
	assetId: z.string().regex(/^asset_[a-z0-9]{16}$/),
	articleId: z.string().regex(/^art_[a-z0-9]{16}$/),
	type: z.enum([
		"technical-diagram",
		"architecture-illustration",
		"timeline",
		"comparison-table",
		"numerical-chart",
		"concept-map",
	]),
	title: z.string().min(1),
	caption: z.string().min(1), // Accessible text alternative explaining the intended insight
	altText: z.string().min(1), // For screen readers
	sourceAttribution: z.string().min(1), // Evidence source
	relativePath: z.string().min(1), // Path to asset file
	fallbackText: z.string().min(1), // Textual fallback when rendering unavailable
	responsive: z.boolean().default(true),
	evidenceBased: z.boolean().default(true), // Must be true per contract §9
});

// ============================================================================
// Knowledge Continuity References
// ============================================================================

/**
 * References to persistent knowledge artifacts (thesaurus, architecture principles,
 * source registry, research taxonomy, historical indexes, Book Delta proposals).
 * These are NOT additional daily publications.
 */
export const KnowledgeContinuityReferenceSchema = z.strictObject({
	artifactId: z.string().regex(/^knowledge_[a-z0-9]{16}$/),
	type: z.enum([
		"thesaurus",
		"architecture-principles",
		"source-registry",
		"research-taxonomy",
		"historical-index",
		"book-delta-proposal",
	]),
	title: z.string().min(1),
	relativePath: z.string().min(1),
	editionScope: z.enum(["current", "cumulative", "all-time"]),
	lastUpdated: z.string().min(1),
});

// ============================================================================
// Inferred TypeScript Types
// ============================================================================

export type PublicationContentType = z.infer<
	typeof PublicationContentTypeSchema
>;
export type PublicationLanguage = z.infer<typeof PublicationLanguageSchema>;
export type PublicationLifecycleStatus = z.infer<
	typeof PublicationLifecycleStatusSchema
>;
export type EditionIdentity = z.infer<typeof EditionIdentitySchema>;
export type CanonicalReferences = z.infer<typeof CanonicalReferencesSchema>;
export type ArticleIdentity = z.infer<typeof ArticleIdentitySchema>;
export type PublicationMetadata = z.infer<typeof PublicationMetadataSchema>;
export type DailyIndex = z.infer<typeof DailyIndexSchema>;
export type PublicationPackage = z.infer<typeof PublicationPackageSchema>;
export type EditionDirectory = z.infer<typeof EditionDirectorySchema>;
export type VisualContentReference = z.infer<
	typeof VisualContentReferenceSchema
>;
export type KnowledgeContinuityReference = z.infer<
	typeof KnowledgeContinuityReferenceSchema
>;

// ============================================================================
// JSON Schema Generation (Single Source of Truth)
// ============================================================================

/**
 * Generate the draft-07 JSON Schema for the publication package.
 * The output is written to `data/schemas/publication-package.json` so the
 * on-disk contract and the TypeScript contract stay in sync.
 */
export function generatePublicationPackageJsonSchema(): Record<
	string,
	unknown
> {
	const generated = z.toJSONSchema(PublicationPackageSchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/publication-package.json",
		title: "Publication Package",
		description:
			"Complete daily publication package containing three canonical UTF-8 Markdown publications, daily index, English derivatives, and validation metadata. All artifacts derive from the canonical fact dossier and editorial selection manifest without introducing competing factual inventories.",
		...generated,
	};
}

/**
 * Generate the draft-07 JSON Schema for the daily index.
 */
export function generateDailyIndexJsonSchema(): Record<string, unknown> {
	const generated = z.toJSONSchema(DailyIndexSchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/daily-index.json",
		title: "Daily Index",
		description:
			"Navigational metadata for a daily edition, referencing the three canonical publications and their English derivatives. Not a fourth publication.",
		...generated,
	};
}

/**
 * Generate the draft-07 JSON Schema for publication metadata.
 */
export function generatePublicationMetadataJsonSchema(): Record<
	string,
	unknown
> {
	const generated = z.toJSONSchema(PublicationMetadataSchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/publication-metadata.json",
		title: "Publication Metadata",
		description:
			"Metadata for a single publication artifact (canonical or derivative).",
		...generated,
	};
}

/**
 * Generate the draft-07 JSON Schema for article identity.
 */
export function generateArticleIdentityJsonSchema(): Record<string, unknown> {
	const generated = z.toJSONSchema(ArticleIdentitySchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/article-identity.json",
		title: "Article Identity",
		description:
			"Stable article identity used across all language variants. The articleId never changes; locale-specific files reference it.",
		...generated,
	};
}

/**
 * Generate the draft-07 JSON Schema for edition identity.
 */
export function generateEditionIdentityJsonSchema(): Record<string, unknown> {
	const generated = z.toJSONSchema(EditionIdentitySchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/edition-identity.json",
		title: "Edition Identity",
		description:
			"Edition identity and reporting window. Fixed by edition date (Europe/Amsterdam), never by execution time.",
		...generated,
	};
}
