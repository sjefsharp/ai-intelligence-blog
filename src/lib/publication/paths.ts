/**
 * Canonical Daily Publication — Directory & Path Conventions
 *
 * Defines predictable, validated relative paths for edition artifacts.
 * Follows existing repository conventions and enforces the exact
 * canonical filenames per contract §2 and §3.
 */

import { EDITION_ID_PREFIX, EDITION_DATE_PATTERN } from "./schema.js";

/** Base directory for all editions. */
export const EDITIONS_BASE_DIR = "editions";

/** Subdirectory for canonical (Dutch) publications. */
export const CANONICAL_SUBDIR = "canonical";

/** Subdirectory for derivative (English) publications. */
export const DERIVATIVES_SUBDIR = "derivatives";

/** Subdirectory for audit artifacts. */
export const AUDIT_SUBDIR = "audit";

/** Canonical filenames (exact, per contract §2). */
export const CANONICAL_FILENAMES = {
	newsletter: "publication.md",
	researchAudit: "research-audit.md",
	listeningNarrative: (editionDate: string) =>
		`AI Daily Intelligence — ${editionDate}.md`,
	dailyIndex: "index.md",
} as const;

/** Derivative directory structure. */
export const DERIVATIVE_PATHS = {
	englishArticles: "en/articles",
	englishListening: "en/listening",
} as const;

/**
 * Build the edition directory path from an edition date.
 * Edition date must be in YYYY-MM-DD format (Europe/Amsterdam calendar date).
 */
export function getEditionDir(editionDate: string): string {
	if (!EDITION_DATE_PATTERN.test(editionDate)) {
		throw new Error(
			`Invalid edition date format: ${editionDate}. Expected YYYY-MM-DD.`,
		);
	}
	return `${EDITIONS_BASE_DIR}/${EDITION_ID_PREFIX}${editionDate}`;
}

/**
 * Get the canonical publications directory for an edition.
 */
export function getCanonicalDir(editionDate: string): string {
	return `${getEditionDir(editionDate)}/${CANONICAL_SUBDIR}`;
}

/**
 * Get the derivatives directory for an edition.
 */
export function getDerivativesDir(editionDate: string): string {
	return `${getEditionDir(editionDate)}/${DERIVATIVES_SUBDIR}`;
}

/**
 * Get the audit directory for an edition.
 */
export function getAuditDir(editionDate: string): string {
	return `${getEditionDir(editionDate)}/${AUDIT_SUBDIR}`;
}

/**
 * Get the full path to the daily index.md (navigational metadata).
 */
export function getDailyIndexPath(editionDate: string): string {
	return `${getEditionDir(editionDate)}/${CANONICAL_FILENAMES.dailyIndex}`;
}

/**
 * Get the full path to the Dutch technical newsletter (publication.md).
 */
export function getNewsletterPath(editionDate: string): string {
	return `${getCanonicalDir(editionDate)}/${CANONICAL_FILENAMES.newsletter}`;
}

/**
 * Get the full path to the research audit (research-audit.md).
 */
export function getResearchAuditPath(editionDate: string): string {
	return `${getCanonicalDir(editionDate)}/${CANONICAL_FILENAMES.researchAudit}`;
}

/**
 * Get the full path to the Dutch listening narrative.
 */
export function getListeningNarrativePath(editionDate: string): string {
	return `${getCanonicalDir(editionDate)}/${CANONICAL_FILENAMES.listeningNarrative(editionDate)}`;
}

/**
 * Get the English articles directory for an edition.
 */
export function getEnglishArticlesDir(editionDate: string): string {
	return `${getDerivativesDir(editionDate)}/${DERIVATIVE_PATHS.englishArticles}`;
}

/**
 * Get the English listening directory for an edition.
 */
export function getEnglishListeningDir(editionDate: string): string {
	return `${getDerivativesDir(editionDate)}/${DERIVATIVE_PATHS.englishListening}`;
}

/**
 * Build the English article filename from article ID and title slug.
 * Uses stable article ID as prefix for traceability.
 */
export function getEnglishArticleFilename(
	articleId: string,
	titleSlug: string,
): string {
	return `${articleId}-${titleSlug}.md`;
}

/**
 * Build the English listening-text filename from article ID and title slug.
 */
export function getEnglishListeningFilename(
	articleId: string,
	titleSlug: string,
): string {
	return `${articleId}-${titleSlug}-listening.md`;
}

/**
 * Get all canonical artifact paths for an edition (for validation).
 */
export function getAllCanonicalPaths(editionDate: string): string[] {
	return [
		getDailyIndexPath(editionDate),
		getNewsletterPath(editionDate),
		getResearchAuditPath(editionDate),
		getListeningNarrativePath(editionDate),
	];
}

/**
 * Validate that a path follows the edition directory conventions.
 */
export function validateEditionPath(
	path: string,
	editionDate: string,
): boolean {
	const expectedPrefix = getEditionDir(editionDate);
	return path.startsWith(expectedPrefix);
}

/**
 * Extract edition date from a valid edition path.
 */
export function extractEditionDateFromPath(path: string): string | null {
	const match = path.match(
		new RegExp(
			`${EDITIONS_BASE_DIR}/${EDITION_ID_PREFIX}(\\d{4}-\\d{2}-\\d{2})`,
		),
	);
	return match ? match[1] : null;
}

/**
 * Get the relative path from the edition root to an artifact.
 * Useful for generating relative links in the daily index.
 */
export function getRelativePathFromEditionRoot(
	editionDate: string,
	artifactPath: string,
): string {
	const editionRoot = getEditionDir(editionDate);
	if (!artifactPath.startsWith(editionRoot)) {
		throw new Error(
			`Artifact path ${artifactPath} is not within edition ${editionDate}`,
		);
	}
	return artifactPath.slice(editionRoot.length + 1); // +1 for the slash
}

/**
 * Build the English derivative path for a specific article.
 */
export function getEnglishArticlePath(
	editionDate: string,
	articleId: string,
	titleSlug: string,
): string {
	return `${getEnglishArticlesDir(editionDate)}/${getEnglishArticleFilename(articleId, titleSlug)}`;
}

/**
 * Build the English listening-text derivative path for a specific article.
 */
export function getEnglishListeningPath(
	editionDate: string,
	articleId: string,
	titleSlug: string,
): string {
	return `${getEnglishListeningDir(editionDate)}/${getEnglishListeningFilename(articleId, titleSlug)}`;
}
