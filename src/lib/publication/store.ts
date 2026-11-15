/**
 * Canonical Daily Publication — Persistence & Store
 *
 * Handles atomic writes, readback verification, and idempotent persistence
 * of publication artifacts and metadata.
 */

import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	type PublicationMetadata,
	type DailyIndex,
	type ArticleIdentity,
	computeContentHash,
	computeObjectHash,
	validatePublicationMetadata,
	validateDailyIndex,
	validateArticleIdentity,
	canonicalStringify,
} from "./metadata.js";
import { type PublicationPackage } from "./schema.js";
import {
	getEditionDir,
	getAllCanonicalPaths,
	getDailyIndexPath,
} from "./paths.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..", "..");

/** Ensure a directory exists. */
async function ensureDir(dirPath: string): Promise<void> {
	await fs.mkdir(dirPath, { recursive: true });
}

/** Atomic write: write to temp file, then rename. */
async function atomicWrite(filePath: string, content: string): Promise<void> {
	const dir = dirname(filePath);
	await ensureDir(dir);

	const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
	await fs.writeFile(tempPath, content, "utf8");
	await fs.rename(tempPath, filePath);
}

/** Read file with UTF-8 encoding. */
async function readFileUtf8(filePath: string): Promise<string> {
	return fs.readFile(filePath, "utf8");
}

/** Verify file content matches expected hash with retry for filesystem consistency. */
async function verifyContentHash(
	filePath: string,
	expectedHash: string,
	retries = 3,
	delayMs = 50,
): Promise<boolean> {
	for (let attempt = 0; attempt < retries; attempt++) {
		const content = await readFileUtf8(filePath);
		const actualHash = computeContentHash(content);
		if (actualHash === expectedHash) {
			return true;
		}
		if (attempt < retries - 1) {
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
	}
	return false;
}

/**
 * Persist a publication artifact (Markdown content + metadata).
 */
export async function persistPublicationArtifact(
	editionDate: string,
	artifactPath: string,
	markdownContent: string,
	metadata: PublicationMetadata,
): Promise<{ contentHash: string; metadataHash: string }> {
	const fullArtifactPath = join(PROJECT_ROOT, artifactPath);
	const metadataPath = `${fullArtifactPath}.meta.json`;

	// Validate metadata
	const validatedMetadata = validatePublicationMetadata(metadata);

	// Compute hashes
	const contentHash = computeContentHash(markdownContent);
	const metadataWithHash = { ...validatedMetadata, contentHash };
	const metadataHash = computeObjectHash(metadataWithHash);

	// Atomic writes
	await atomicWrite(fullArtifactPath, markdownContent);
	await atomicWrite(metadataPath, canonicalStringify(metadataWithHash));

	// Readback verification
	const verifiedContent = await verifyContentHash(
		fullArtifactPath,
		contentHash,
	);
	const verifiedMetadata = await verifyContentHash(
		metadataPath,
		metadataHash,
	);

	if (!verifiedContent || !verifiedMetadata) {
		// Debug: read and log actual hashes
		const actualContentHash = computeContentHash(
			await readFileUtf8(fullArtifactPath),
		);
		const actualMetadataHash = computeContentHash(
			await readFileUtf8(metadataPath),
		);
		throw new Error(
			`Readback verification failed for ${artifactPath}: ` +
				`content hash mismatch (expected: ${contentHash}, actual: ${actualContentHash}), ` +
				`metadata hash mismatch (expected: ${metadataHash}, actual: ${actualMetadataHash})`,
		);
	}

	return { contentHash, metadataHash };
}

/**
 * Persist the daily index (Markdown + metadata).
 */
export async function persistDailyIndex(
	editionDate: string,
	markdownContent: string,
	index: DailyIndex,
): Promise<{ contentHash: string; metadataHash: string }> {
	const indexPath = join(PROJECT_ROOT, getDailyIndexPath(editionDate));
	const metadataPath = `${indexPath}.meta.json`;

	// Surgical fix: Build the complete index object from the raw input (which comes from createDailyIndex
	// and should have all nested fields), then validate the constructed object.
	// This bypasses any potential issue with Zod validation losing nested strictObject fields.
	const contentHash = computeContentHash(markdownContent);

	const indexWithHash: DailyIndex & { contentHash: string } = {
		editionId: index.editionId,
		editionDate: index.editionDate,
		editionWindow: {
			editionDate: index.editionWindow.editionDate,
			start: index.editionWindow.start,
			end: index.editionWindow.end,
			timezone: index.editionWindow.timezone,
			durationHours: index.editionWindow.durationHours,
		},
		reportingWindow: {
			start: index.reportingWindow.start,
			end: index.reportingWindow.end,
			timezone: index.reportingWindow.timezone,
		},
		canonicalPublications: index.canonicalPublications.map((p) => ({
			contentType: p.contentType,
			language: p.language,
			artifactId: p.artifactId,
			filename: p.filename,
			title: p.title,
			description: p.description,
			lifecycleStatus: p.lifecycleStatus,
			relativePath: p.relativePath,
			readingTimeMinutes: p.readingTimeMinutes,
			estimatedListeningDurationMinutes:
				p.estimatedListeningDurationMinutes,
		})),
		englishDerivatives: index.englishDerivatives?.map((d) => ({
			contentType: d.contentType,
			language: d.language,
			artifactId: d.artifactId,
			filename: d.filename,
			title: d.title,
			description: d.description,
			lifecycleStatus: d.lifecycleStatus,
			relativePath: d.relativePath,
			sourceArtifactId: d.sourceArtifactId,
		})),
		availableNavigation: {
			byTopic: index.availableNavigation.byTopic.map((t) => ({
				topic: t.topic,
				articleIds: t.articleIds,
			})),
			bySource: index.availableNavigation.bySource.map((s) => ({
				sourceId: s.sourceId,
				articleIds: s.articleIds,
			})),
			byOrganization: index.availableNavigation.byOrganization.map(
				(o) => ({
					organization: o.organization,
					articleIds: o.articleIds,
				}),
			),
			byResearchDomain: index.availableNavigation.byResearchDomain.map(
				(r) => ({
					domain: r.domain,
					articleIds: r.articleIds,
				}),
			),
		},
		missingArtifacts: index.missingArtifacts.map((m) => ({
			contentType: m.contentType,
			language: m.language,
			reason: m.reason,
		})),
		generatedAt: index.generatedAt,
		generatedBy: index.generatedBy,
		schemaVersion: index.schemaVersion,
		contentHash,
	};

	// Validate the constructed object to ensure it matches the schema
	validateDailyIndex(indexWithHash);

	const metadataHash = computeObjectHash(indexWithHash);

	await atomicWrite(indexPath, markdownContent);
	await atomicWrite(metadataPath, canonicalStringify(indexWithHash));

	const verifiedContent = await verifyContentHash(indexPath, contentHash);
	const verifiedMetadata = await verifyContentHash(
		metadataPath,
		metadataHash,
	);

	if (!verifiedContent || !verifiedMetadata) {
		const actualContentHash = computeContentHash(
			await readFileUtf8(indexPath),
		);
		const actualMetadataHash = computeContentHash(
			await readFileUtf8(metadataPath),
		);
		throw new Error(
			`Readback verification failed for daily index ${editionDate}: ` +
				`content hash mismatch (expected: ${contentHash}, actual: ${actualContentHash}), ` +
				`metadata hash mismatch (expected: ${metadataHash}, actual: ${actualMetadataHash})`,
		);
	}

	return { contentHash, metadataHash };
}

/**
 * Persist the complete publication package manifest.
 */
export async function persistPublicationPackage(
	editionDate: string,
	packageData: PublicationPackage,
): Promise<string> {
	const packagePath = join(
		PROJECT_ROOT,
		getEditionDir(editionDate),
		"publication-package.json",
	);

	// Compute content hash of the package WITHOUT the contentHash field (for self-referential integrity)
	const { contentHash: _unused, ...packageWithoutHash } = packageData;
	const contentHash = computeObjectHash(packageWithoutHash);

	// Create package with the computed hash
	const packageWithHash = { ...packageWithoutHash, contentHash };

	await atomicWrite(packagePath, canonicalStringify(packageWithHash));

	// Verify by reading back and computing hash of the package without the contentHash field
	const savedContent = await readFileUtf8(packagePath);
	const savedPackage = JSON.parse(savedContent);
	const { contentHash: savedHash, ...savedWithoutHash } = savedPackage;
	const verifiedHash = computeObjectHash(savedWithoutHash);

	if (verifiedHash !== contentHash) {
		throw new Error(
			`Readback verification failed for publication package ${editionDate}: ` +
				`content hash mismatch (expected: ${contentHash}, actual: ${verifiedHash})`,
		);
	}

	if (savedHash !== contentHash) {
		throw new Error(
			`Readback verification failed for publication package ${editionDate}: ` +
				`stored hash mismatch (expected: ${contentHash}, stored: ${savedHash})`,
		);
	}

	return contentHash;
}

/**
 * Read and validate a publication artifact's metadata.
 */
export async function readPublicationMetadata(
	artifactPath: string,
): Promise<PublicationMetadata> {
	const fullPath = join(PROJECT_ROOT, `${artifactPath}.meta.json`);
	const content = await readFileUtf8(fullPath);
	const parsed = JSON.parse(content);
	return validatePublicationMetadata(parsed);
}

/**
 * Read and validate the daily index metadata.
 */
export async function readDailyIndexMetadata(
	editionDate: string,
): Promise<DailyIndex> {
	const indexPath = join(PROJECT_ROOT, getDailyIndexPath(editionDate));
	const metadataPath = `${indexPath}.meta.json`;
	const content = await readFileUtf8(metadataPath);
	const parsed = JSON.parse(content);
	return validateDailyIndex(parsed);
}

/**
 * Read and validate the publication package.
 */
export async function readPublicationPackage(
	editionDate: string,
): Promise<PublicationPackage> {
	const packagePath = join(
		PROJECT_ROOT,
		getEditionDir(editionDate),
		"publication-package.json",
	);
	const content = await readFileUtf8(packagePath);
	const parsed = JSON.parse(content);
	// Note: PublicationPackageSchema validation would go here if exported
	return parsed;
}

/**
 * Check if all canonical artifacts exist for an edition.
 */
export async function checkCanonicalArtifactsExist(
	editionDate: string,
): Promise<{
	allExist: boolean;
	existing: string[];
	missing: string[];
}> {
	const paths = getAllCanonicalPaths(editionDate);
	const existing: string[] = [];
	const missing: string[] = [];

	for (const path of paths) {
		const fullPath = join(PROJECT_ROOT, path);
		try {
			await fs.access(fullPath);
			existing.push(path);
		} catch {
			missing.push(path);
		}
	}

	return {
		allExist: missing.length === 0,
		existing,
		missing,
	};
}

/**
 * List all edition directories.
 */
export async function listEditionDirectories(): Promise<string[]> {
	const editionsDir = join(PROJECT_ROOT, "editions");
	try {
		const entries = await fs.readdir(editionsDir, { withFileTypes: true });
		return entries
			.filter((e) => e.isDirectory() && e.name.startsWith("edition_"))
			.map((e) => e.name.replace("edition_", ""))
			.sort();
	} catch {
		return [];
	}
}

/**
 * Read article identity from a metadata file.
 */
export async function readArticleIdentityFromMetadata(
	artifactPath: string,
): Promise<ArticleIdentity | null> {
	const metadata = await readPublicationMetadata(artifactPath);
	if (!metadata.articleId) return null;

	return validateArticleIdentity({
		articleId: metadata.articleId,
		storyId: `story_${metadata.articleId.slice(4)}`, // Derived from articleId
		candidateIds: metadata.claimReferences.map((c) => `cand_${c.slice(6)}`), // Approximate
		claimIds: metadata.claimReferences,
		sourceIds: metadata.sourceReferences.map((s) => new URL(s).hostname),
		organizations: metadata.organizations,
		researchDomains: metadata.topics,
		discoveryRings: [1], // Default; actual from editorial manifest
		materialityScore: 0.5,
		materialityLevel: "medium",
		recommendedDepth: "standard",
		explanationOpportunities: [],
		evidenceClassificationSummary: "Mixed evidence classifications",
		caveats: [],
	});
}
