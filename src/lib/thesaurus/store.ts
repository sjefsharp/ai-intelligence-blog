/**
 * Thesaurus Store — Persistent Storage Layer
 *
 * Handles deterministic serialization, atomic writes, verified readback,
 * checkpoint persistence, and historical change preservation for the
 * terminology thesaurus.
 */

import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";
import type {
	TerminologyEntry,
	ThesaurusArtifact,
	TerminologyChangeProposal,
	TerminologyLifecycleStatus,
} from "./schema.js";
import {
	TerminologyEntrySchema,
	ThesaurusArtifactSchema,
	TerminologyChangeProposalSchema,
	ID_PATTERNS,
} from "./schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..", "..", "..");
const DATA_DIR = join(PROJECT_ROOT, "data");
const THESAURUS_DIR = join(DATA_DIR, "thesaurus");
const THESAURUS_ARTIFACTS_DIR = join(THESAURUS_DIR, "artifacts");
const THESAURUS_PROPOSALS_DIR = join(THESAURUS_DIR, "proposals");
const THESAURUS_CHECKPOINTS_DIR = join(THESAURUS_DIR, "checkpoints");
const THESAURUS_MARKDOWN_PATH = join(THESAURUS_DIR, "thesaurus.md");

/** Ensure all thesaurus directories exist. */
export async function ensureThesaurusDirectories(): Promise<void> {
	await fs.mkdir(THESAURUS_DIR, { recursive: true });
	await fs.mkdir(THESAURUS_ARTIFACTS_DIR, { recursive: true });
	await fs.mkdir(THESAURUS_PROPOSALS_DIR, { recursive: true });
	await fs.mkdir(THESAURUS_CHECKPOINTS_DIR, { recursive: true });
}

/** Generate a stable ID with prefix. */
function generateId(prefix: string): string {
	const random = randomBytes(8).toString("hex");
	return `${prefix}_${random}`;
}

/** Compute SHA-256 content hash. */
function computeContentHash(content: string): string {
	return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

/** Compute SHA-256 hash of an object (deterministic serialization). */
function computeObjectHash(obj: unknown): string {
	const json = JSON.stringify(obj, Object.keys(obj as object).sort());
	return computeContentHash(json);
}

/** Current date in YYYY-MM-DD format (Europe/Amsterdam). */
function getCurrentDate(): string {
	const now = new Date();
	// Use Europe/Amsterdam timezone
	const formatter = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Europe/Amsterdam",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	return formatter.format(now);
}

/** Current ISO timestamp. */
function getCurrentTimestamp(): string {
	return new Date().toISOString();
}

/**
 * Load the current thesaurus artifact (latest version).
 */
export async function loadThesaurusArtifact(): Promise<ThesaurusArtifact | null> {
	try {
		const files = await fs.readdir(THESAURUS_ARTIFACTS_DIR);
		const artifactFiles = files
			.filter((f) => f.endsWith(".json") && f.startsWith("thesart_"))
			.sort()
			.reverse(); // Latest first

		if (artifactFiles.length === 0) {
			return null;
		}

		const latest = artifactFiles[0];
		const content = await fs.readFile(
			join(THESAURUS_ARTIFACTS_DIR, latest),
			"utf-8",
		);
		const artifact = JSON.parse(content) as ThesaurusArtifact;

		// Validate against schema
		const result = ThesaurusArtifactSchema.safeParse(artifact);
		if (!result.success) {
			throw new Error(
				`Thesaurus artifact validation failed: ${result.error.message}`,
			);
		}

		// Verify content hash
		const { contentHash, ...artifactWithoutHash } = artifact;
		const computedHash = computeObjectHash(artifactWithoutHash);
		if (computedHash !== contentHash) {
			throw new Error(
				`Thesaurus artifact content hash mismatch: expected ${contentHash}, got ${computedHash}`,
			);
		}

		return result.data;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return null;
		}
		throw error;
	}
}

/**
 * Load a specific thesaurus artifact by artifact ID.
 */
export async function loadThesaurusArtifactById(
	artifactId: string,
): Promise<ThesaurusArtifact | null> {
	try {
		const files = await fs.readdir(THESAURUS_ARTIFACTS_DIR);
		const file = files.find(
			(f) => f.startsWith(artifactId) && f.endsWith(".json"),
		);
		if (!file) return null;

		const content = await fs.readFile(
			join(THESAURUS_ARTIFACTS_DIR, file),
			"utf-8",
		);
		return JSON.parse(content) as ThesaurusArtifact;
	} catch {
		return null;
	}
}

/**
 * Save a thesaurus artifact with atomic write and verified readback.
 */
export async function saveThesaurusArtifact(
	artifact: ThesaurusArtifact,
	options: { previousVersionHash?: string } = {},
): Promise<void> {
	await ensureThesaurusDirectories();

	// Compute content hash
	const {
		contentHash: _ignored,
		previousVersionHash: _ignored2,
		...artifactWithoutHashes
	} = artifact;
	const contentHash = computeObjectHash(artifactWithoutHashes);

	const artifactWithHash: ThesaurusArtifact = {
		...artifact,
		contentHash,
		previousVersionHash:
			options.previousVersionHash ?? artifact.previousVersionHash,
	};

	// Validate before writing
	const result = ThesaurusArtifactSchema.safeParse(artifactWithHash);
	if (!result.success) {
		throw new Error(
			`Thesaurus artifact validation failed: ${result.error.message}`,
		);
	}

	// Atomic write: write to temp file, then rename
	const filename = `${artifact.artifactId}.json`;
	const tempPath = join(THESAURUS_ARTIFACTS_DIR, `.${filename}.tmp`);
	const finalPath = join(THESAURUS_ARTIFACTS_DIR, filename);

	const json = JSON.stringify(artifactWithHash, null, 2);
	await fs.writeFile(tempPath, json, "utf-8");
	await fs.rename(tempPath, finalPath);

	// Verified readback
	const readback = await fs.readFile(finalPath, "utf-8");
	const parsed = JSON.parse(readback) as ThesaurusArtifact;

	if (parsed.contentHash !== contentHash) {
		throw new Error("Thesaurus artifact readback hash mismatch");
	}
}

/**
 * Create a new thesaurus artifact from entries.
 */
export async function createThesaurusArtifact(
	entries: TerminologyEntry[],
	options: {
		editionDate?: string;
		generatedBy?: string;
		previousVersionHash?: string;
	} = {},
): Promise<ThesaurusArtifact> {
	const now = getCurrentTimestamp();
	const artifactId = generateId("thesart");

	// Compute statistics
	const stats = computeThesaurusStats(entries);

	const artifact: ThesaurusArtifact = {
		artifactId,
		schemaVersion: "1.0.0",
		editionDate: options.editionDate,
		generatedAt: now,
		generatedBy: options.generatedBy ?? "thesaurus-engine",
		entries,
		contentHash: "", // Will be computed in saveThesaurusArtifact
		previousVersionHash: options.previousVersionHash,
		stats,
		validationResults: [],
	};

	return artifact;
}

/**
 * Compute thesaurus statistics from entries.
 */
export function computeThesaurusStats(entries: TerminologyEntry[]) {
	const byLifecycleStatus: Record<TerminologyLifecycleStatus, number> = {
		CANDIDATE: 0,
		VERIFIED: 0,
		ESTABLISHED: 0,
		REVISED: 0,
		DEPRECATED: 0,
		SUPERSEDED: 0,
	};

	const byDomain: Record<string, number> = {};

	let verifiedEntries = 0;
	let establishedEntries = 0;
	let candidateEntries = 0;
	let deprecatedEntries = 0;
	let supersededEntries = 0;
	let bilingualEntries = 0;
	let entriesWithRelationships = 0;

	for (const entry of entries) {
		byLifecycleStatus[entry.lifecycleStatus]++;

		for (const domain of entry.researchDomains) {
			byDomain[domain.domainId] = (byDomain[domain.domainId] || 0) + 1;
		}

		switch (entry.lifecycleStatus) {
			case "VERIFIED":
				verifiedEntries++;
				break;
			case "ESTABLISHED":
				establishedEntries++;
				break;
			case "CANDIDATE":
				candidateEntries++;
				break;
			case "DEPRECATED":
				deprecatedEntries++;
				break;
			case "SUPERSEDED":
				supersededEntries++;
				break;
		}

		// Check if both EN and NL definitions are substantive (not just placeholders)
		if (
			entry.preferredTerm.en.length > 0 &&
			entry.preferredTerm.nl.length > 0 &&
			entry.definition.en.length > 0 &&
			entry.definition.nl.length > 0
		) {
			bilingualEntries++;
		}

		if (entry.relationships.length > 0) {
			entriesWithRelationships++;
		}
	}

	return {
		totalEntries: entries.length,
		byLifecycleStatus,
		byDomain,
		verifiedEntries,
		establishedEntries,
		candidateEntries,
		deprecatedEntries,
		supersededEntries,
		bilingualEntries,
		entriesWithRelationships,
	};
}

/**
 * Load all change proposals.
 */
export async function loadChangeProposals(): Promise<
	TerminologyChangeProposal[]
> {
	await ensureThesaurusDirectories();

	try {
		const files = await fs.readdir(THESAURUS_PROPOSALS_DIR);
		const proposals: TerminologyChangeProposal[] = [];

		for (const file of files.filter((f) => f.endsWith(".json"))) {
			const content = await fs.readFile(
				join(THESAURUS_PROPOSALS_DIR, file),
				"utf-8",
			);
			const proposal = JSON.parse(content) as TerminologyChangeProposal;
			proposals.push(proposal);
		}

		return proposals.sort((a, b) =>
			a.proposedAt.localeCompare(b.proposedAt),
		);
	} catch {
		return [];
	}
}

/**
 * Save a change proposal.
 */
export async function saveChangeProposal(
	proposal: TerminologyChangeProposal,
): Promise<void> {
	await ensureThesaurusDirectories();

	const result = TerminologyChangeProposalSchema.safeParse(proposal);
	if (!result.success) {
		throw new Error(
			`Change proposal validation failed: ${result.error.message}`,
		);
	}

	const filename = `${proposal.proposalId}.json`;
	const tempPath = join(THESAURUS_PROPOSALS_DIR, `.${filename}.tmp`);
	const finalPath = join(THESAURUS_PROPOSALS_DIR, filename);

	const json = JSON.stringify(proposal, null, 2);
	await fs.writeFile(tempPath, json, "utf-8");
	await fs.rename(tempPath, finalPath);
}

/**
 * Create a new change proposal.
 */
export function createChangeProposal(
	editionDate: string,
	changeType: TerminologyChangeProposal["changeType"],
	evidence: TerminologyChangeProposal["evidence"],
	justification: string,
	proposedBy: string,
	options: {
		targetEntryId?: string;
		proposedEntry?: Partial<TerminologyEntry>;
		relatedEntryIds?: string[];
		autoEligible?: boolean;
	} = {},
): TerminologyChangeProposal {
	return {
		proposalId: generateId("prop"),
		editionDate,
		changeType,
		targetEntryId: options.targetEntryId,
		proposedEntry: options.proposedEntry as TerminologyEntry | undefined,
		evidence,
		justification,
		relatedEntryIds: options.relatedEntryIds ?? [],
		autoEligible: options.autoEligible ?? false,
		status: "pending",
		proposedAt: getCurrentTimestamp(),
		proposedBy,
	};
}

/**
 * Save a checkpoint for resumable operations.
 */
export async function saveCheckpoint(
	checkpointId: string,
	data: unknown,
): Promise<void> {
	await ensureThesaurusDirectories();

	const checkpointPath = join(
		THESAURUS_CHECKPOINTS_DIR,
		`${checkpointId}.json`,
	);
	const tempPath = `${checkpointPath}.tmp`;

	await fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf-8");
	await fs.rename(tempPath, checkpointPath);
}

/**
 * Load a checkpoint.
 */
export async function loadCheckpoint<T>(
	checkpointId: string,
): Promise<T | null> {
	try {
		const checkpointPath = join(
			THESAURUS_CHECKPOINTS_DIR,
			`${checkpointId}.json`,
		);
		const content = await fs.readFile(checkpointPath, "utf-8");
		return JSON.parse(content) as T;
	} catch {
		return null;
	}
}

/**
 * Generate the human-readable thesaurus.md from entries.
 */
export function generateThesaurusMarkdown(
	entries: TerminologyEntry[],
	options: {
		title?: string;
		generatedAt?: string;
		generatedBy?: string;
		includeCandidates?: boolean;
		includeDeprecated?: boolean;
	} = {},
): string {
	const {
		title = "AI Intelligence Terminology Thesaurus",
		generatedAt = getCurrentTimestamp(),
		generatedBy = "thesaurus-engine",
		includeCandidates = true,
		includeDeprecated = true,
	} = options;

	// Filter entries based on options
	let filteredEntries = entries;
	if (!includeCandidates) {
		filteredEntries = filteredEntries.filter(
			(e) => e.lifecycleStatus !== "CANDIDATE",
		);
	}
	if (!includeDeprecated) {
		filteredEntries = filteredEntries.filter(
			(e) =>
				e.lifecycleStatus !== "DEPRECATED" &&
				e.lifecycleStatus !== "SUPERSEDED",
		);
	}

	// Sort: established first, then verified, then candidate, then revised, then deprecated/superseded
	const statusOrder: Record<TerminologyLifecycleStatus, number> = {
		ESTABLISHED: 0,
		VERIFIED: 1,
		CANDIDATE: 2,
		REVISED: 3,
		DEPRECATED: 4,
		SUPERSEDED: 5,
	};

	filteredEntries.sort((a, b) => {
		const statusDiff =
			statusOrder[a.lifecycleStatus] - statusOrder[b.lifecycleStatus];
		if (statusDiff !== 0) return statusDiff;
		return a.canonicalTerm.localeCompare(b.canonicalTerm);
	});

	const lines: string[] = [
		`# ${title}`,
		"",
		`> **Generated:** ${generatedAt} by ${generatedBy}`,
		`> **Schema Version:** 1.0.0`,
		`> **Total Entries:** ${filteredEntries.length} (${entries.length} total)`,
		`> **Status:** Persistent knowledge asset — independent of individual news editions`,
		"",
		"---",
		"",
		"## Overview",
		"",
		"This thesaurus establishes consistent terminology for AI and software engineering concepts",
		"across daily AI Intelligence editions. It functions as a durable knowledge asset, fully traceable",
		"to authoritative sources, with bilingual (English/Dutch) definitions and validated relationships.",
		"",
		"### Lifecycle Status Legend",
		"",
		"- **ESTABLISHED** — Accepted as part of the canonical terminology register",
		"- **VERIFIED** — Evidence supports the definition; awaiting broader acceptance",
		"- **CANDIDATE** — Proposed but not sufficiently verified",
		"- **REVISED** — Definition updated with traceable justification",
		"- **DEPRECATED** — Historically relevant but no longer preferred",
		"- **SUPERSEDED** — Replaced by another canonical concept",
		"",
		"### Relationship Types",
		"",
		"- **synonym-of** — Equivalent terminology",
		"- **alias-of** — Alternative name for the same concept",
		"- **broader-than** — More general concept",
		"- **narrower-than** — More specific concept",
		"- **related-to** — Relevant conceptual association",
		"- **part-of** — Constituent element of a broader concept",
		"- **extends** — Conceptual extension where substantiated",
		"- **contrasts-with** — Important conceptual distinction",
		"- **supersedes** — Replacement of obsolete terminology",
		"- **conflicts-with** — Documented incompatible definitions",
		"",
		"---",
		"",
		"## Entries",
		"",
	];

	for (const entry of filteredEntries) {
		lines.push(...generateEntryMarkdown(entry));
		lines.push("---", "");
	}

	lines.push("---", "", "## Index by Domain", "");

	// Group by domain
	const domainGroups: Record<string, TerminologyEntry[]> = {};
	for (const entry of filteredEntries) {
		for (const domain of entry.researchDomains) {
			if (!domainGroups[domain.domainId])
				domainGroups[domain.domainId] = [];
			domainGroups[domain.domainId].push(entry);
		}
	}

	for (const [domainId, domainEntries] of Object.entries(
		domainGroups,
	).sort()) {
		lines.push(`### ${domainId}`, "");
		for (const entry of domainEntries.sort((a, b) =>
			a.canonicalTerm.localeCompare(b.canonicalTerm),
		)) {
			const statusBadge = `[${entry.lifecycleStatus}]`;
			lines.push(
				`- **${entry.canonicalTerm}** ${statusBadge} (\`${entry.entryId}\`)`,
			);
			if (entry.preferredTerm.nl !== entry.canonicalTerm) {
				lines.push(`  - NL: ${entry.preferredTerm.nl}`);
			}
			if (entry.acronyms.length > 0) {
				lines.push(
					`  - Acronyms: ${entry.acronyms.map((a) => a.acronym).join(", ")}`,
				);
			}
		}
		lines.push("");
	}

	lines.push("---", "", "## Revision History Summary", "");

	// Collect all revisions
	const allRevisions: Array<{
		entryId: string;
		entryTerm: string;
		revision: TerminologyEntry["revisionHistory"][0];
	}> = [];
	for (const entry of entries) {
		for (const rev of entry.revisionHistory) {
			allRevisions.push({
				entryId: entry.entryId,
				entryTerm: entry.canonicalTerm,
				revision: rev,
			});
		}
	}

	allRevisions.sort((a, b) =>
		b.revision.revisedAt.localeCompare(a.revision.revisedAt),
	);

	for (const { entryId, entryTerm, revision } of allRevisions.slice(0, 50)) {
		lines.push(
			`- **${entryTerm}** (\`${entryId}\`) — ${revision.changeType} at ${revision.revisedAt} by ${revision.revisedBy}: ${revision.justification.substring(0, 100)}${revision.justification.length > 100 ? "…" : ""}`,
		);
	}

	if (allRevisions.length > 50) {
		lines.push(`- … and ${allRevisions.length - 50} more revisions`);
	}

	return lines.join("\n");
}

/**
 * Generate markdown for a single terminology entry.
 */
function generateEntryMarkdown(entry: TerminologyEntry): string[] {
	const lines: string[] = [];

	// Header with status badge
	const statusBadge = `[${entry.lifecycleStatus}]`;
	lines.push(`### ${entry.canonicalTerm} ${statusBadge}`);
	lines.push("");
	lines.push(`**Entry ID:** \`${entry.entryId}\``);
	lines.push("");

	// Bilingual preferred terms
	lines.push("#### Preferred Terms");
	lines.push("");
	lines.push(`- **EN:** ${entry.preferredTerm.en}`);
	lines.push(`- **NL:** ${entry.preferredTerm.nl}`);
	lines.push("");

	// Original language
	lines.push(
		`**Original Language:** ${entry.originalLanguage.toUpperCase()}`,
	);
	lines.push("");

	// Acronyms
	if (entry.acronyms.length > 0) {
		lines.push("#### Acronyms & Abbreviations");
		lines.push("");
		for (const acronym of entry.acronyms) {
			lines.push(`- **${acronym.acronym}**`);
			lines.push(`  - EN: ${acronym.expansion.en}`);
			lines.push(`  - NL: ${acronym.expansion.nl}`);
			if (acronym.context) lines.push(`  - Context: ${acronym.context}`);
			if (acronym.authority)
				lines.push(`  - Authority: ${acronym.authority}`);
		}
		lines.push("");
	}

	// Aliases
	const hasAliases =
		(entry.aliases.en?.length ?? 0) > 0 ||
		(entry.aliases.nl?.length ?? 0) > 0;
	if (hasAliases) {
		lines.push("#### Aliases");
		lines.push("");
		if (entry.aliases.en?.length) {
			lines.push(`**EN:** ${entry.aliases.en!.join(", ")}`);
		}
		if (entry.aliases.nl?.length) {
			lines.push(`**NL:** ${entry.aliases.nl!.join(", ")}`);
		}
		lines.push("");
	}

	// Forbidden terms
	const hasForbidden =
		(entry.forbidden.en?.length ?? 0) > 0 ||
		(entry.forbidden.nl?.length ?? 0) > 0;
	if (hasForbidden) {
		lines.push("#### Forbidden Terms (Do Not Use)");
		lines.push("");
		if (entry.forbidden.en?.length) {
			lines.push(`**EN:** ${entry.forbidden.en!.join(", ")}`);
		}
		if (entry.forbidden.nl?.length) {
			lines.push(`**NL:** ${entry.forbidden.nl!.join(", ")}`);
		}
		lines.push("");
	}

	// Definition
	lines.push("#### Definition");
	lines.push("");
	lines.push(`**EN:** ${entry.definition.en}`);
	lines.push(`**NL:** ${entry.definition.nl}`);
	lines.push("");

	// Research domains
	lines.push("#### Research Domains");
	lines.push("");
	for (const domain of entry.researchDomains) {
		const primary = domain.primary ? " (primary)" : "";
		const subdomains = domain.subdomainIds?.length
			? ` → ${domain.subdomainIds.join(", ")}`
			: "";
		lines.push(`- ${domain.domainId}${primary}${subdomains}`);
	}
	lines.push("");

	// Relationships
	if (entry.relationships.length > 0) {
		lines.push("#### Relationships");
		lines.push("");
		for (const rel of entry.relationships) {
			const typeLabel = formatRelationshipType(rel.type);
			lines.push(`- **${typeLabel}** \`${rel.targetId}\``);
			lines.push(`  - Rationale: ${rel.rationale}`);
			lines.push(`  - Confidence: ${rel.confidence.toFixed(2)}`);
			lines.push(
				`  - Established: ${rel.establishedAt} by ${rel.establishedBy}`,
			);
			if (rel.evidence?.length) {
				lines.push(
					`  - Evidence: ${rel.evidence.map((e) => e.url).join("; ")}`,
				);
			}
		}
		lines.push("");
	}

	// Authoritative sources
	lines.push("#### Authoritative Sources");
	lines.push("");
	for (const source of entry.sources) {
		lines.push(`- **${source.title}**`);
		lines.push(`  - Source ID: \`${source.sourceId}\``);
		lines.push(`  - URL: ${source.url}`);
		lines.push(`  - Tier: ${source.tier}`);
		if (source.section) lines.push(`  - Section: ${source.section}`);
		lines.push(`  - Accessed: ${source.accessedAt}`);
		lines.push(`  - Retrieval: ${source.retrievalStatus}`);
		lines.push(`  - Confidence: ${source.confidence.toFixed(2)}`);
	}
	lines.push("");

	// Evidence classification
	lines.push("#### Evidence & Verification");
	lines.push("");
	lines.push(`- **Classification:** ${entry.evidenceClassification}`);
	lines.push(`- **Verification Status:** ${entry.verificationStatus}`);
	lines.push(
		`- **Verification Confidence:** ${entry.verificationConfidence.toFixed(2)}`,
	);
	lines.push("");

	// Standards
	if (entry.standards.length > 0) {
		lines.push("#### Standards & Specifications");
		lines.push("");
		for (const standard of entry.standards) {
			lines.push(`- ${standard}`);
		}
		lines.push("");
	}

	// Version applicability
	if (entry.versionApplicability.length > 0) {
		lines.push("#### Version Applicability");
		lines.push("");
		for (const va of entry.versionApplicability) {
			const status = va.applicable ? "✓" : "✗";
			lines.push(
				`- ${status} **${va.version}**${va.notes ? `: ${va.notes}` : ""}`,
			);
		}
		lines.push("");
	}

	// Lifecycle dates
	lines.push("#### Lifecycle");
	lines.push("");
	if (entry.firstObservedAt)
		lines.push(`- **First Observed:** ${entry.firstObservedAt}`);
	lines.push(`- **First Verified:** ${entry.firstVerifiedAt}`);
	lines.push(`- **Last Reviewed:** ${entry.lastReviewedAt}`);
	if (entry.establishedAt)
		lines.push(`- **Established:** ${entry.establishedAt}`);
	if (entry.deprecatedAt)
		lines.push(`- **Deprecated:** ${entry.deprecatedAt}`);
	if (entry.supersededBy)
		lines.push(`- **Superseded By:** \`${entry.supersededBy}\``);
	lines.push("");

	// Revision history
	if (entry.revisionHistory.length > 0) {
		lines.push("#### Revision History");
		lines.push("");
		for (const rev of entry.revisionHistory.slice().reverse()) {
			lines.push(
				`- **${rev.changeType}** at ${rev.revisedAt} by ${rev.revisedBy}`,
			);
			lines.push(`  - ${rev.justification}`);
			if (rev.fieldChanged) lines.push(`  - Field: ${rev.fieldChanged}`);
			if (rev.previousValue)
				lines.push(`  - Previous: ${rev.previousValue}`);
			if (rev.newValue) lines.push(`  - New: ${rev.newValue}`);
			if (rev.evidence?.length)
				lines.push(
					`  - Evidence: ${rev.evidence.map((e) => e.url).join("; ")}`,
				);
		}
		lines.push("");
	}

	// Historical observations
	if (entry.historicalObservations.length > 0) {
		lines.push("#### Historical Observations");
		lines.push("");
		for (const obs of entry.historicalObservations) {
			const firstBadge = obs.isFirstObserved ? " 🎯 **FIRST**" : "";
			lines.push(`- **${obs.date}**${firstBadge}`);
			lines.push(`  - Source: \`${obs.sourceId}\` (${obs.sourceUrl})`);
			lines.push(`  - Context: ${obs.context}`);
			lines.push(`  - Confidence: ${obs.confidence.toFixed(2)}`);
			if (obs.note) lines.push(`  - Note: ${obs.note}`);
		}
		lines.push("");
	}

	// Metadata
	lines.push("#### Metadata");
	lines.push("");
	lines.push(`- **Schema Version:** ${entry.schemaVersion}`);
	lines.push(`- **Created:** ${entry.createdAt} by ${entry.createdBy}`);
	lines.push(`- **Updated:** ${entry.updatedAt}`);
	if (entry.tags.length > 0)
		lines.push(`- **Tags:** ${entry.tags.join(", ")}`);
	lines.push("");

	return lines;
}

/** Format relationship type for display. */
function formatRelationshipType(type: string): string {
	const labels: Record<string, string> = {
		"synonym-of": "Synonym of",
		"alias-of": "Alias of",
		"broader-than": "Broader than",
		"narrower-than": "Narrower than",
		"related-to": "Related to",
		"part-of": "Part of",
		extends: "Extends",
		"contrasts-with": "Contrasts with",
		supersedes: "Supersedes",
		"conflicts-with": "Conflicts with",
	};
	return labels[type] ?? type;
}

/**
 * Write the thesaurus.md file.
 */
export async function writeThesaurusMarkdown(
	entries: TerminologyEntry[],
	options: Parameters<typeof generateThesaurusMarkdown>[1] = {},
): Promise<void> {
	await ensureThesaurusDirectories();
	const markdown = generateThesaurusMarkdown(entries, options);
	await fs.writeFile(THESAURUS_MARKDOWN_PATH, markdown, "utf-8");
}

/**
 * Read the thesaurus.md file.
 */
export async function readThesaurusMarkdown(): Promise<string | null> {
	try {
		return await fs.readFile(THESAURUS_MARKDOWN_PATH, "utf-8");
	} catch {
		return null;
	}
}

/**
 * Export all thesaurus data for backup/analysis.
 */
export async function exportThesaurusData(): Promise<{
	artifact: ThesaurusArtifact | null;
	proposals: TerminologyChangeProposal[];
	markdown: string | null;
}> {
	const [artifact, proposals, markdown] = await Promise.all([
		loadThesaurusArtifact(),
		loadChangeProposals(),
		readThesaurusMarkdown(),
	]);

	return { artifact, proposals, markdown };
}
