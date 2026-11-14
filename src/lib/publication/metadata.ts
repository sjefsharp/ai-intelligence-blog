/**
 * Canonical Daily Publication — Metadata Management
 *
 * Handles creation, validation, and persistence of publication metadata
 * for all three canonical publications and their derivatives.
 */

import { createHash, randomBytes } from "node:crypto";
import {
	PUBLICATION_SCHEMA_VERSION,
	CANONICAL_ARTIFACT_FILENAMES,
	PublicationContentTypeSchema,
	PublicationLanguageSchema,
	PublicationLifecycleStatusSchema,
	PublicationMetadataSchema,
	DailyIndexSchema,
	ArticleIdentitySchema,
	EditionIdentitySchema,
	CanonicalReferencesSchema,
	type PublicationContentType,
	type PublicationLanguage,
	type PublicationLifecycleStatus,
	type PublicationMetadata,
	type DailyIndex,
	type ArticleIdentity,
	type EditionIdentity,
	type CanonicalReferences,
} from "./schema.js";

export type {
	PublicationMetadata,
	DailyIndex,
	ArticleIdentity,
	EditionIdentity,
	CanonicalReferences,
} from "./schema.js";

/** Generate a stable artifact ID. */
export function generateArtifactId(): string {
	return `pubart_${randomBytes(8).toString("hex")}`;
}

/** Generate a stable article ID. */
export function generateArticleId(): string {
	return `art_${randomBytes(8).toString("hex")}`;
}

/** Generate a stable package ID. */
export function generatePackageId(): string {
	return `pubpkg_${randomBytes(8).toString("hex")}`;
}

/** Compute SHA-256 content hash. */
export function computeContentHash(content: string): string {
	return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

/** Canonical JSON stringify with sorted keys at all levels for deterministic hashing. */
export function canonicalStringify(obj: Record<string, unknown>): string {
	return JSON.stringify(
		obj,
		(key, value) => {
			if (value && typeof value === "object" && !Array.isArray(value)) {
				// Sort keys for nested objects
				return Object.fromEntries(
					Object.entries(value).sort(([a], [b]) =>
						a.localeCompare(b),
					),
				);
			}
			return value;
		},
		2,
	);
}

/** Compute SHA-256 hash of an object (canonical JSON with sorted keys). */
export function computeObjectHash(obj: Record<string, unknown>): string {
	const canonical = canonicalStringify(obj);
	return computeContentHash(canonical);
}

/**
 * Create metadata for a canonical Dutch publication artifact.
 */
export function createCanonicalPublicationMetadata(
	editionIdentity: EditionIdentity,
	canonicalReferences: CanonicalReferences,
	contentType: "newsletter" | "research-audit" | "listening-narrative",
	articleIdentity: ArticleIdentity | null, // null for research-audit which covers the whole edition
	title: string,
	description: string,
	generatedBy: string,
	options: {
		readingTimeMinutes?: number;
		estimatedListeningDurationMinutes?: number;
		lifecycleStatus?: PublicationLifecycleStatus;
		validationStatus?: "pending" | "passed" | "failed" | "skipped";
		validationResults?: PublicationMetadata["validationResults"];
		relatedVariants?: PublicationMetadata["relatedVariants"];
		version?: number;
	} = {},
): PublicationMetadata {
	const now = new Date().toISOString();
	const artifactId = generateArtifactId();

	const filenameMap: Record<string, string> = {
		newsletter: CANONICAL_ARTIFACT_FILENAMES.newsletter,
		"research-audit": CANONICAL_ARTIFACT_FILENAMES.researchAudit,
		"listening-narrative":
			typeof CANONICAL_ARTIFACT_FILENAMES.listeningNarrative ===
			"function"
				? (
						CANONICAL_ARTIFACT_FILENAMES.listeningNarrative as (
							editionDate: string,
						) => string
					)(editionIdentity.editionDate)
				: CANONICAL_ARTIFACT_FILENAMES.listeningNarrative,
	};

	return {
		artifactId,
		editionId: editionIdentity.editionId,
		editionDate: editionIdentity.editionDate,
		contentType,
		language: "nl",
		canonicalFilename: filenameMap[contentType],
		title,
		description,
		articleId: articleIdentity?.articleId ?? undefined,
		publicationTimestamp: now,
		originalNewsDisclosureTimestamp: undefined, // Filled by editorial process
		lastSubstantiveUpdateTimestamp: now,
		readingTimeMinutes: options.readingTimeMinutes,
		estimatedListeningDurationMinutes:
			options.estimatedListeningDurationMinutes,
		sourceReferences: articleIdentity?.sourceReferences ?? [],
		claimReferences: articleIdentity?.claimIds ?? [],
		topics: articleIdentity?.researchDomains ?? [],
		organizations: articleIdentity?.organizations ?? [],
		lifecycleStatus: options.lifecycleStatus ?? "DRAFT",
		validationStatus: options.validationStatus ?? "pending",
		validationResults: options.validationResults ?? [],
		relatedVariants: options.relatedVariants ?? [],
		version: options.version ?? 1,
		schemaVersion: PUBLICATION_SCHEMA_VERSION,
	};
}

/**
 * Create metadata for an English derivative artifact.
 */
export function createEnglishDerivativeMetadata(
	editionIdentity: EditionIdentity,
	canonicalReferences: CanonicalReferences,
	sourceArtifactId: string,
	articleIdentity: ArticleIdentity,
	contentType: "english-derivative" | "english-listening",
	title: string,
	description: string,
	generatedBy: string,
	options: {
		readingTimeMinutes?: number;
		estimatedListeningDurationMinutes?: number;
		lifecycleStatus?: PublicationLifecycleStatus;
		validationStatus?: "pending" | "passed" | "failed" | "skipped";
		validationResults?: PublicationMetadata["validationResults"];
		version?: number;
	} = {},
): PublicationMetadata {
	const now = new Date().toISOString();
	const artifactId = generateArtifactId();

	return {
		artifactId,
		editionId: editionIdentity.editionId,
		editionDate: editionIdentity.editionDate,
		contentType,
		language: "en",
		canonicalFilename: `${artifactId}-${articleIdentity.articleId}.md`, // Will be overridden with actual filename
		title,
		description,
		articleId: articleIdentity.articleId,
		publicationTimestamp: now,
		originalNewsDisclosureTimestamp: undefined,
		lastSubstantiveUpdateTimestamp: now,
		readingTimeMinutes: options.readingTimeMinutes,
		estimatedListeningDurationMinutes:
			options.estimatedListeningDurationMinutes,
		sourceReferences: articleIdentity.sourceReferences,
		claimReferences: articleIdentity.claimIds,
		topics: articleIdentity.researchDomains,
		organizations: articleIdentity.organizations,
		lifecycleStatus: options.lifecycleStatus ?? "DRAFT",
		validationStatus: options.validationStatus ?? "pending",
		validationResults: options.validationResults ?? [],
		relatedVariants: [
			{
				contentType:
					contentType === "english-derivative"
						? "newsletter"
						: "listening-narrative",
				language: "nl",
				artifactId: sourceArtifactId,
				relationship:
					contentType === "english-derivative"
						? "translation"
						: "listening-text",
			},
		],
		version: options.version ?? 1,
		schemaVersion: PUBLICATION_SCHEMA_VERSION,
	};
}

/**
 * Create the daily index (navigational metadata).
 */
export function createDailyIndex(
	editionIdentity: EditionIdentity,
	canonicalReferences: CanonicalReferences,
	canonicalPublications: Array<{
		contentType: "newsletter" | "research-audit" | "listening-narrative";
		artifactId: string;
		title: string;
		description: string;
		lifecycleStatus: PublicationLifecycleStatus;
		readingTimeMinutes?: number;
		estimatedListeningDurationMinutes?: number;
	}>,
	englishDerivatives: Array<{
		contentType: "english-derivative" | "english-listening";
		artifactId: string;
		title: string;
		description: string;
		lifecycleStatus: PublicationLifecycleStatus;
		sourceArtifactId: string;
	}> = [],
	availableNavigation: DailyIndex["availableNavigation"],
	missingArtifacts: DailyIndex["missingArtifacts"] = [],
	generatedBy: string,
): DailyIndex {
	const now = new Date().toISOString();

	// Explicitly construct nested objects to ensure all required fields are present
	// This prevents any potential issue with incomplete input objects
	const editionWindow = {
		editionDate: editionIdentity.editionWindow.editionDate,
		start: editionIdentity.editionWindow.start,
		end: editionIdentity.editionWindow.end,
		timezone: editionIdentity.editionWindow.timezone,
		durationHours: editionIdentity.editionWindow.durationHours,
	};

	const reportingWindow = {
		start: editionIdentity.reportingWindow.start,
		end: editionIdentity.reportingWindow.end,
		timezone: editionIdentity.reportingWindow.timezone,
	};

	return {
		editionId: editionIdentity.editionId,
		editionDate: editionIdentity.editionDate,
		editionWindow,
		reportingWindow,
		canonicalPublications: canonicalPublications.map((p) => {
			const filenameKey =
				p.contentType === "newsletter"
					? "newsletter"
					: p.contentType === "research-audit"
						? "researchAudit"
						: "listeningNarrative";
			const filename =
				typeof CANONICAL_ARTIFACT_FILENAMES[filenameKey] === "function"
					? (
							CANONICAL_ARTIFACT_FILENAMES[filenameKey] as (
								editionDate: string,
							) => string
						)(editionIdentity.editionDate)
					: CANONICAL_ARTIFACT_FILENAMES[filenameKey];

			return {
				contentType: p.contentType,
				language: "nl" as const,
				artifactId: p.artifactId,
				filename,
				title: p.title,
				description: p.description,
				lifecycleStatus: p.lifecycleStatus,
				relativePath: `canonical/${filename}`,
				readingTimeMinutes: p.readingTimeMinutes,
				estimatedListeningDurationMinutes:
					p.estimatedListeningDurationMinutes,
			};
		}),
		englishDerivatives:
			englishDerivatives.length > 0
				? englishDerivatives.map((d) => ({
						contentType: d.contentType,
						language: "en" as const,
						artifactId: d.artifactId,
						filename: `${d.artifactId}-${d.contentType}.md`, // Placeholder; actual filename set during packaging
						title: d.title,
						description: d.description,
						lifecycleStatus: d.lifecycleStatus,
						relativePath: `derivatives/${d.contentType === "english-derivative" ? "en/articles" : "en/listening"}/${d.artifactId}-${d.contentType}.md`,
						sourceArtifactId: d.sourceArtifactId,
					}))
				: undefined,
		availableNavigation,
		missingArtifacts,
		generatedAt: now,
		generatedBy,
		schemaVersion: PUBLICATION_SCHEMA_VERSION,
	};
}

/**
 * Validate publication metadata against the schema.
 */
export function validatePublicationMetadata(
	metadata: unknown,
): PublicationMetadata {
	return PublicationMetadataSchema.parse(metadata);
}

/**
 * Validate daily index against the schema.
 */
export function validateDailyIndex(index: unknown): DailyIndex {
	return DailyIndexSchema.parse(index);
}

/**
 * Validate article identity against the schema.
 */
export function validateArticleIdentity(identity: unknown): ArticleIdentity {
	return ArticleIdentitySchema.parse(identity);
}

/**
 * Validate edition identity against the schema.
 */
export function validateEditionIdentity(identity: unknown): EditionIdentity {
	return EditionIdentitySchema.parse(identity);
}

/**
 * Validate canonical references against the schema.
 */
export function validateCanonicalReferences(
	refs: unknown,
): CanonicalReferences {
	return CanonicalReferencesSchema.parse(refs);
}
