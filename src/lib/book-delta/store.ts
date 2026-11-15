/**
 * Book Delta — Persistence & Store
 *
 * Handles atomic writes, readback verification, and idempotent persistence
 * of Book Delta proposals and artifacts.
 */

import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	type BookDeltaProposal,
	type BookDeltaArtifact,
	type BookDeltaEvaluationResult,
	type BookDeltaKnowledgeContinuityResult,
	BOOK_DELTA_ID_PATTERNS,
	BOOK_DELTA_PROPOSAL_ID_PREFIX,
	BOOK_DELTA_ARTIFACT_ID_PREFIX,
	BOOK_DELTA_SCHEMA_VERSION,
} from "./schema.js";
import {
	validateBookDeltaProposal,
	validateBookDeltaArtifact,
	validateBookDeltaEvaluationResult,
	validateBookDeltaKnowledgeContinuityResult,
	computeContentHash,
	computeObjectHash,
	canonicalStringify,
} from "./validate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..", "..");

/**
 * Root directory for Book Delta persistence.
 *
 * Overridable through BOOK_DELTA_DATA_DIR so tests and isolated runs can use a
 * temporary workspace without touching repository history. Production uses the
 * repository-local `data/book-delta/` convention.
 */
function resolveDataRoot(): string {
	const override = process.env.BOOK_DELTA_DATA_DIR;
	return override && override.trim().length > 0
		? override
		: join(PROJECT_ROOT, "data", "book-delta");
}

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
		const actualHash = await computeContentHash(content);
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
 * Generate a stable, random proposal ID.
 *
 * Prefer {@link generateDeterministicProposalId} for pipeline proposals so the
 * same educational concept maps to the same identifier across editions.
 */
export function generateProposalId(): string {
	return `${BOOK_DELTA_PROPOSAL_ID_PREFIX}${generateRandomHex(16)}`;
}

/** Generate a stable, random artifact ID. */
export function generateArtifactId(): string {
	return `${BOOK_DELTA_ARTIFACT_ID_PREFIX}${generateRandomHex(16)}`;
}

/**
 * Derive a deterministic proposal ID from the proposal category and normalized
 * target concept. Identical concepts therefore keep one stable identifier and
 * are never recreated as duplicates by a newer edition.
 */
export async function generateDeterministicProposalId(
	category: string,
	targetConcept: string,
): Promise<string> {
	const normalized = normalizeConcept(targetConcept);
	const hash = await computeContentHash(`${category}:${normalized}`);
	return `${BOOK_DELTA_PROPOSAL_ID_PREFIX}${hash.slice("sha256:".length, "sha256:".length + 16)}`;
}

/**
 * Derive a deterministic artifact ID per edition so repeated runs of the same
 * edition produce byte-stable register identity.
 */
export async function generateDeterministicArtifactId(
	editionDate: string,
): Promise<string> {
	const hash = await computeContentHash(`artifact:${editionDate}`);
	return `${BOOK_DELTA_ARTIFACT_ID_PREFIX}${hash.slice("sha256:".length, "sha256:".length + 16)}`;
}

/** Normalize a concept string for stable identity comparison. */
export function normalizeConcept(concept: string): string {
	return concept
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.replace(/\s+/g, " ");
}

/** Generate random hex string. */
function generateRandomHex(length: number): string {
	const bytes = new Uint8Array(Math.ceil(length / 2));
	crypto.getRandomValues(bytes);
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")
		.slice(0, length);
}

/** Get the Book Delta directory for an edition. */
export function getBookDeltaDir(editionDate: string): string {
	return join(resolveDataRoot(), editionDate);
}

/** Get the proposal file path. */
export function getProposalPath(
	editionDate: string,
	proposalId: string,
): string {
	return join(getBookDeltaDir(editionDate), `${proposalId}.json`);
}

/** Get the artifact file path. */
export function getArtifactPath(editionDate: string): string {
	return join(getBookDeltaDir(editionDate), "book-delta-artifact.json");
}

/** Get the evaluation result file path. */
export function getEvaluationResultPath(editionDate: string): string {
	return join(getBookDeltaDir(editionDate), "book-delta-evaluation.json");
}

/** Get the knowledge continuity result file path. */
export function getKnowledgeContinuityResultPath(editionDate: string): string {
	return join(
		getBookDeltaDir(editionDate),
		"book-delta-knowledge-continuity.json",
	);
}

/** Get the historical proposals index path. */
export function getHistoricalProposalsIndexPath(): string {
	return join(resolveDataRoot(), "historical-index.json");
}

/**
 * Persist a Book Delta proposal.
 */
export async function persistBookDeltaProposal(
	editionDate: string,
	proposal: BookDeltaProposal,
): Promise<string> {
	const proposalPath = getProposalPath(editionDate, proposal.proposalId);
	const metadataPath = `${proposalPath}.meta.json`;

	// Validate proposal
	const validatedProposal = validateBookDeltaProposal(proposal);

	// Compute hashes
	const contentHash = await computeObjectHash(validatedProposal);
	const proposalWithHash = { ...validatedProposal, contentHash };
	const metadataHash = await computeObjectHash(proposalWithHash);

	// Atomic writes
	await atomicWrite(proposalPath, canonicalStringify(validatedProposal));
	await atomicWrite(metadataPath, canonicalStringify(proposalWithHash));

	// Readback verification
	const verifiedContent = await verifyContentHash(proposalPath, contentHash);
	const verifiedMetadata = await verifyContentHash(
		metadataPath,
		metadataHash,
	);

	if (!verifiedContent || !verifiedMetadata) {
		const actualContentHash = computeContentHash(
			await readFileUtf8(proposalPath),
		);
		const actualMetadataHash = computeContentHash(
			await readFileUtf8(metadataPath),
		);
		throw new Error(
			`Readback verification failed for proposal ${proposal.proposalId}: ` +
				`content hash mismatch (expected: ${contentHash}, actual: ${actualContentHash}), ` +
				`metadata hash mismatch (expected: ${metadataHash}, actual: ${actualMetadataHash})`,
		);
	}

	return contentHash;
}

/**
 * Persist the complete Book Delta artifact (register).
 */
export async function persistBookDeltaArtifact(
	editionDate: string,
	artifact: BookDeltaArtifact,
): Promise<string> {
	const artifactPath = getArtifactPath(editionDate);

	// Compute content hash of the artifact WITHOUT the contentHash field
	const { contentHash: _unused, ...artifactWithoutHash } = artifact;
	const contentHash = await computeObjectHash(artifactWithoutHash);

	// Create artifact with the computed hash
	const artifactWithHash = { ...artifactWithoutHash, contentHash };

	// Validate
	validateBookDeltaArtifact(artifactWithHash);

	await atomicWrite(artifactPath, canonicalStringify(artifactWithHash));

	// Verify by reading back and computing hash
	const savedContent = await readFileUtf8(artifactPath);
	const savedArtifact = JSON.parse(savedContent);
	const { contentHash: savedHash, ...savedWithoutHash } = savedArtifact;
	const verifiedHash = await computeObjectHash(savedWithoutHash);

	if (verifiedHash !== contentHash) {
		throw new Error(
			`Readback verification failed for Book Delta artifact ${editionDate}: ` +
				`content hash mismatch (expected: ${contentHash}, actual: ${verifiedHash})`,
		);
	}

	if (savedHash !== contentHash) {
		throw new Error(
			`Readback verification failed for Book Delta artifact ${editionDate}: ` +
				`stored hash mismatch (expected: ${contentHash}, stored: ${savedHash})`,
		);
	}

	return contentHash;
}

/**
 * Persist the Book Delta evaluation result.
 */
export async function persistBookDeltaEvaluationResult(
	editionDate: string,
	result: BookDeltaEvaluationResult,
): Promise<string> {
	const resultPath = getEvaluationResultPath(editionDate);

	// Hash covers the result WITHOUT the hash field, so the stored document can
	// be read back, stripped, and verified deterministically.
	const contentHash = await computeObjectHash(result);
	const resultWithHash = { ...result, contentHash };

	validateBookDeltaEvaluationResult(resultWithHash);

	await atomicWrite(resultPath, canonicalStringify(resultWithHash));

	// Independent readback: re-parse the persisted document, strip its hash and
	// recompute the content hash from the remaining fields.
	const savedContent = await readFileUtf8(resultPath);
	const savedParsed = JSON.parse(savedContent) as Record<string, unknown>;
	const { contentHash: savedHash, ...savedWithoutHash } = savedParsed;
	const verifiedHash = await computeObjectHash(savedWithoutHash);

	if (verifiedHash !== contentHash || savedHash !== contentHash) {
		throw new Error(
			`Readback verification failed for Book Delta evaluation result ${editionDate}: ` +
				`content hash mismatch (expected: ${contentHash}, actual: ${verifiedHash}, stored: ${savedHash})`,
		);
	}

	return contentHash;
}

/**
 * Persist the Book Delta knowledge continuity result.
 */
export async function persistBookDeltaKnowledgeContinuityResult(
	editionDate: string,
	result: BookDeltaKnowledgeContinuityResult,
): Promise<string> {
	const resultPath = getKnowledgeContinuityResultPath(editionDate);

	// Hash covers the result WITHOUT the hash field (see evaluation result).
	const contentHash = await computeObjectHash(result);
	const resultWithHash = { ...result, contentHash };

	validateBookDeltaKnowledgeContinuityResult(resultWithHash);

	await atomicWrite(resultPath, canonicalStringify(resultWithHash));

	const savedContent = await readFileUtf8(resultPath);
	const savedParsed = JSON.parse(savedContent) as Record<string, unknown>;
	const { contentHash: savedHash, ...savedWithoutHash } = savedParsed;
	const verifiedHash = await computeObjectHash(savedWithoutHash);

	if (verifiedHash !== contentHash || savedHash !== contentHash) {
		throw new Error(
			`Readback verification failed for Book Delta knowledge continuity result ${editionDate}: ` +
				`content hash mismatch (expected: ${contentHash}, actual: ${verifiedHash}, stored: ${savedHash})`,
		);
	}

	return contentHash;
}

/**
 * Read and validate a Book Delta proposal.
 */
export async function readBookDeltaProposal(
	editionDate: string,
	proposalId: string,
): Promise<BookDeltaProposal> {
	const proposalPath = getProposalPath(editionDate, proposalId);
	const content = await readFileUtf8(proposalPath);
	const parsed = JSON.parse(content);
	return validateBookDeltaProposal(parsed);
}

/**
 * Read and validate the Book Delta artifact.
 */
export async function readBookDeltaArtifact(
	editionDate: string,
): Promise<BookDeltaArtifact> {
	const artifactPath = getArtifactPath(editionDate);
	const content = await readFileUtf8(artifactPath);
	const parsed = JSON.parse(content);
	return validateBookDeltaArtifact(parsed);
}

/**
 * Read and validate the Book Delta evaluation result.
 */
export async function readBookDeltaEvaluationResult(
	editionDate: string,
): Promise<BookDeltaEvaluationResult> {
	const resultPath = getEvaluationResultPath(editionDate);
	const content = await readFileUtf8(resultPath);
	const parsed = JSON.parse(content);
	return validateBookDeltaEvaluationResult(parsed);
}

/**
 * Read and validate the Book Delta knowledge continuity result.
 */
export async function readBookDeltaKnowledgeContinuityResult(
	editionDate: string,
): Promise<BookDeltaKnowledgeContinuityResult> {
	const resultPath = getKnowledgeContinuityResultPath(editionDate);
	const content = await readFileUtf8(resultPath);
	const parsed = JSON.parse(content);
	return validateBookDeltaKnowledgeContinuityResult(parsed);
}

/**
 * Check if Book Delta artifacts exist for an edition.
 */
export async function checkBookDeltaArtifactsExist(
	editionDate: string,
): Promise<{
	artifactExists: boolean;
	evaluationExists: boolean;
	knowledgeContinuityExists: boolean;
	proposalCount: number;
}> {
	const dir = getBookDeltaDir(editionDate);
	let artifactExists = false;
	let evaluationExists = false;
	let knowledgeContinuityExists = false;
	let proposalCount = 0;

	try {
		await fs.access(getArtifactPath(editionDate));
		artifactExists = true;
	} catch {}

	try {
		await fs.access(getEvaluationResultPath(editionDate));
		evaluationExists = true;
	} catch {}

	try {
		await fs.access(getKnowledgeContinuityResultPath(editionDate));
		knowledgeContinuityExists = true;
	} catch {}

	try {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		proposalCount = entries.filter(
			(e) =>
				e.isFile() &&
				e.name.startsWith("bdp_") &&
				e.name.endsWith(".json") &&
				!e.name.endsWith(".meta.json"),
		).length;
	} catch {}

	return {
		artifactExists,
		evaluationExists,
		knowledgeContinuityExists,
		proposalCount,
	};
}

/**
 * List all Book Delta proposal IDs for an edition.
 */
export async function listBookDeltaProposals(
	editionDate: string,
): Promise<string[]> {
	const dir = getBookDeltaDir(editionDate);
	try {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		return entries
			.filter(
				(e) =>
					e.isFile() &&
					e.name.startsWith("bdp_") &&
					e.name.endsWith(".json") &&
					!e.name.endsWith(".meta.json"),
			)
			.map((e) => e.name.slice(0, -5)) // Remove .json
			.sort();
	} catch {
		return [];
	}
}

/**
 * Read all Book Delta proposals for an edition.
 */
export async function readAllBookDeltaProposals(
	editionDate: string,
): Promise<BookDeltaProposal[]> {
	const proposalIds = await listBookDeltaProposals(editionDate);
	const proposals: BookDeltaProposal[] = [];

	for (const id of proposalIds) {
		try {
			const proposal = await readBookDeltaProposal(editionDate, id);
			proposals.push(proposal);
		} catch (error) {
			console.warn(`Failed to read proposal ${id}:`, error);
		}
	}

	return proposals;
}

/**
 * List all edition dates that have Book Delta data.
 */
export async function listBookDeltaEditions(): Promise<string[]> {
	const baseDir = join(resolveDataRoot());
	try {
		const entries = await fs.readdir(baseDir, { withFileTypes: true });
		return entries
			.filter(
				(e) => e.isDirectory() && e.name.match(/^\d{4}-\d{2}-\d{2}$/),
			)
			.map((e) => e.name)
			.sort();
	} catch {
		return [];
	}
}

/**
 * Historical Proposals Index — tracks all proposals across editions for deduplication.
 */
export interface HistoricalProposalsIndex {
	schemaVersion: string;
	updatedAt: string;
	proposals: Array<{
		proposalId: string;
		editionDate: string;
		category: string;
		targetConcept: string;
		title: { en: string; nl: string };
		lifecycleStatus: string;
		uniquenessStatus: string;
		supersededBy?: string;
		supersedes?: string;
		contentHash: string;
	}>;
}

/** Read a string-valued revision field without assuming its runtime shape. */
function readRevisionString(
	revisions: BookDeltaProposal["revisionHistory"],
	key: "supersededBy" | "supersedes",
): string | undefined {
	for (const revision of revisions) {
		const value = revision.newValues?.[key];
		if (typeof value === "string") return value;
	}
	return undefined;
}

/**
 * Read the historical proposals index.
 */
export async function readHistoricalProposalsIndex(): Promise<HistoricalProposalsIndex> {
	const indexPath = getHistoricalProposalsIndexPath();
	try {
		const content = await readFileUtf8(indexPath);
		return JSON.parse(content) as HistoricalProposalsIndex;
	} catch {
		return {
			schemaVersion: BOOK_DELTA_SCHEMA_VERSION,
			updatedAt: new Date().toISOString(),
			proposals: [],
		};
	}
}

/**
 * Update the historical proposals index with new proposals.
 */
export async function updateHistoricalProposalsIndex(
	editionDate: string,
	proposals: BookDeltaProposal[],
): Promise<void> {
	const index = await readHistoricalProposalsIndex();

	for (const proposal of proposals) {
		const contentHash = await computeObjectHash(proposal);
		const supersededBy = readRevisionString(
			proposal.revisionHistory,
			"supersededBy",
		);
		const supersedes = readRevisionString(
			proposal.revisionHistory,
			"supersedes",
		);

		const existingIndex = index.proposals.findIndex(
			(p) => p.proposalId === proposal.proposalId,
		);

		if (existingIndex >= 0) {
			// Preserve the original edition (history is never rewritten); refresh
			// the mutable lifecycle state and evidence hash.
			const existing = index.proposals[existingIndex];
			index.proposals[existingIndex] = {
				...existing,
				category: proposal.category,
				targetConcept: proposal.targetConcept,
				title: proposal.title,
				lifecycleStatus: proposal.lifecycleStatus,
				uniquenessStatus: proposal.uniquenessStatus,
				supersededBy: supersededBy ?? existing.supersededBy,
				supersedes: supersedes ?? existing.supersedes,
				contentHash,
			};
		} else {
			index.proposals.push({
				proposalId: proposal.proposalId,
				editionDate: proposal.editionDate || editionDate,
				category: proposal.category,
				targetConcept: proposal.targetConcept,
				title: proposal.title,
				lifecycleStatus: proposal.lifecycleStatus,
				uniquenessStatus: proposal.uniquenessStatus,
				supersededBy: supersededBy,
				supersedes: supersedes,
				contentHash,
			});
		}
	}

	index.updatedAt = new Date().toISOString();

	const indexPath = getHistoricalProposalsIndexPath();
	await atomicWrite(indexPath, canonicalStringify(index));
}

/**
 * Find historical proposals related to a target concept.
 */
export async function findHistoricalProposals(
	targetConcept: string,
	options: {
		categories?: string[];
		lifecycleStatuses?: string[];
		limit?: number;
	} = {},
): Promise<HistoricalProposalsIndex["proposals"]> {
	const index = await readHistoricalProposalsIndex();
	const { categories, lifecycleStatuses, limit = 50 } = options;

	let results = index.proposals;

	// Simple text matching on targetConcept (could be enhanced with semantic similarity)
	const searchTerms = targetConcept
		.toLowerCase()
		.split(/\s+/)
		.filter((t) => t.length > 2);
	results = results.filter((p) =>
		searchTerms.some(
			(term) =>
				p.targetConcept.toLowerCase().includes(term) ||
				p.title.en.toLowerCase().includes(term) ||
				p.title.nl.toLowerCase().includes(term),
		),
	);

	if (categories) {
		results = results.filter((p) => categories.includes(p.category));
	}

	if (lifecycleStatuses) {
		results = results.filter((p) =>
			lifecycleStatuses.includes(p.lifecycleStatus),
		);
	}

	// Sort by recency (editionDate descending)
	results.sort((a, b) => b.editionDate.localeCompare(a.editionDate));

	return results.slice(0, limit);
}

/**
 * Check for duplicate or related proposals.
 */
export async function checkProposalUniqueness(
	targetConcept: string,
	category: string,
	options: {
		excludeProposalIds?: string[];
		similarityThreshold?: number;
	} = {},
): Promise<{
	isDuplicate: boolean;
	relatedProposals: HistoricalProposalsIndex["proposals"];
	strongestMatch: HistoricalProposalsIndex["proposals"][0] | null;
	uniquenessStatus:
		| "unique"
		| "strengthens-existing"
		| "revises-scope"
		| "links-related"
		| "supersedes"
		| "duplicate";
}> {
	const historical = await findHistoricalProposals(targetConcept, {
		categories: [category],
		lifecycleStatuses: [
			"CANDIDATE",
			"READY_FOR_REVIEW",
			"APPROVED",
			"IMPLEMENTED",
			"VALIDATED",
		],
		limit: 100,
	});

	const { excludeProposalIds = [], similarityThreshold = 0.7 } = options;

	// Filter out excluded proposals
	const candidates = historical.filter(
		(p) => !excludeProposalIds.includes(p.proposalId),
	);

	// Simple similarity check based on shared terms
	const conceptTerms = new Set(
		targetConcept
			.toLowerCase()
			.split(/\s+/)
			.filter((t) => t.length > 2),
	);

	let strongestMatch: HistoricalProposalsIndex["proposals"][0] | null = null;
	let highestSimilarity = 0;

	for (const proposal of candidates) {
		const proposalTerms = new Set(
			[
				...proposal.targetConcept.toLowerCase().split(/\s+/),
				...proposal.title.en.toLowerCase().split(/\s+/),
				...proposal.title.nl.toLowerCase().split(/\s+/),
			].filter((t) => t.length > 2),
		);

		const intersection = new Set(
			[...conceptTerms].filter((x) => proposalTerms.has(x)),
		);
		const union = new Set([...conceptTerms, ...proposalTerms]);
		const similarity = union.size > 0 ? intersection.size / union.size : 0;

		if (similarity > highestSimilarity) {
			highestSimilarity = similarity;
			strongestMatch = proposal;
		}
	}

	let uniquenessStatus:
		| "unique"
		| "strengthens-existing"
		| "revises-scope"
		| "links-related"
		| "supersedes"
		| "duplicate" = "unique";

	if (strongestMatch && highestSimilarity >= similarityThreshold) {
		if (highestSimilarity > 0.9) {
			uniquenessStatus = "duplicate";
		} else if (strongestMatch.lifecycleStatus === "REJECTED") {
			uniquenessStatus = "revises-scope";
		} else if (
			["CANDIDATE", "READY_FOR_REVIEW", "APPROVED"].includes(
				strongestMatch.lifecycleStatus,
			)
		) {
			uniquenessStatus = "strengthens-existing";
		} else {
			uniquenessStatus = "links-related";
		}
	}

	return {
		isDuplicate: uniquenessStatus === "duplicate",
		relatedProposals: candidates.slice(0, 10),
		strongestMatch,
		uniquenessStatus,
	};
}

// ============================================================================
// Cross-Edition Continuity Helpers
// ============================================================================

/**
 * Read every persisted proposal across all editions, de-duplicated by stable
 * proposal ID. The latest update wins so historical records remain untouched
 * while the register reflects current lifecycle state.
 */
export async function readAllProposalsAcrossEditions(): Promise<
	BookDeltaProposal[]
> {
	const editions = await listBookDeltaEditions();
	const byId = new Map<string, BookDeltaProposal>();

	for (const editionDate of editions) {
		const proposals = await readAllBookDeltaProposals(editionDate);
		for (const proposal of proposals) {
			const existing = byId.get(proposal.proposalId);
			if (!existing || proposal.updatedAt > existing.updatedAt) {
				byId.set(proposal.proposalId, proposal);
			}
		}
	}

	return [...byId.values()].sort((a, b) =>
		a.proposalId.localeCompare(b.proposalId),
	);
}

/**
 * Load the artifact previously persisted for an edition, if any.
 */
export async function loadExistingArtifact(
	editionDate: string,
): Promise<BookDeltaArtifact | null> {
	try {
		return await readBookDeltaArtifact(editionDate);
	} catch {
		return null;
	}
}
