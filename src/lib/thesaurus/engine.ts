/**
 * Thesaurus Engine — Core Terminology Operations
 *
 * Implements deterministic terminology normalization, duplicate detection,
 * identifier validation, alias matching, relationship checks, schema validation,
 * and evidence verification integration.
 */

import type {
	TerminologyEntry,
	ThesaurusArtifact,
	TerminologyChangeProposal,
	TerminologyLifecycleStatus,
	TerminologyChangeType,
	LanguageCode,
	BilingualString,
	LanguageAliases,
	Acronym,
} from "./schema.js";
import {
	TerminologyEntrySchema,
	ThesaurusArtifactSchema,
	THESAURUS_ENTRY_ID_PREFIX,
	ID_PATTERNS,
	TerminologyChangeTypeSchema,
	generateTerminologyEntryJsonSchema,
	generateThesaurusArtifactJsonSchema,
	generateTerminologyChangeProposalJsonSchema,
} from "./schema.js";
import {
	loadThesaurusArtifact,
	saveThesaurusArtifact,
	createThesaurusArtifact,
	saveChangeProposal,
	writeThesaurusMarkdown,
} from "./store.js";

// ============================================================================
// Type Definitions for Engine Operations
// ============================================================================

/** Result of a terminology operation. */
export interface TerminologyOperationResult {
	success: boolean;
	entryId?: string;
	artifactId?: string;
	errors: string[];
	warnings: string[];
	changes: TerminologyChangeSummary[];
}

/** Summary of a change made. */
export interface TerminologyChangeSummary {
	entryId: string;
	changeType: TerminologyChangeType;
	field?: string;
	previousValue?: string;
	newValue?: string;
}

/** Validation result for a terminology entry. */
export interface TerminologyValidationResult {
	valid: boolean;
	errors: TerminologyValidationError[];
	warnings: TerminologyValidationWarning[];
}

/** Validation error. */
export interface TerminologyValidationError {
	code: string;
	message: string;
	field?: string;
	entryId?: string;
	relatedEntryId?: string;
}

/** Validation warning. */
export interface TerminologyValidationWarning {
	code: string;
	message: string;
	field?: string;
	entryId?: string;
	relatedEntryId?: string;
}

/** Duplicate detection result. */
export interface DuplicateDetectionResult {
	isDuplicate: boolean;
	existingEntryId?: string;
	matchType:
		| "exact-canonical"
		| "exact-alias"
		| "fuzzy-canonical"
		| "fuzzy-alias"
		| "acronym-conflict";
	confidence: number;
	details: string;
}

/** Relationship validation result. */
export interface RelationshipValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
	cyclesDetected: string[][];
	invalidTargets: string[];
}

// ============================================================================
// Term Normalization
// ============================================================================

/**
 * Normalize a term for comparison (lowercase, trim, remove extra whitespace).
 */
export function normalizeTerm(term: string): string {
	return term
		.toLowerCase()
		.trim()
		.replace(/\s+/g, " ")
		.replace(/[^\p{L}\p{N}\s\-\(\)\/\.]/gu, ""); // Keep letters, numbers, spaces, hyphens, parentheses, slashes, dots
}

/**
 * Normalize an acronym for comparison.
 */
export function normalizeAcronym(acronym: string): string {
	return acronym
		.toUpperCase()
		.trim()
		.replace(/[^A-Z0-9]/g, "");
}

/**
 * Generate a stable entry ID from a canonical term.
 */
export function generateEntryIdFromTerm(canonicalTerm: string): string {
	// This is a deterministic fallback; the actual ID should use crypto.randomBytes
	const normalized = normalizeTerm(canonicalTerm);
	const hash = Array.from(normalized).reduce(
		(acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) & 0xffffffff,
		0,
	);
	const hex = Math.abs(hash).toString(16).padStart(8, "0");
	return `${THESAURUS_ENTRY_ID_PREFIX}${hex}${randomBytes(4).toString("hex")}`;
}

// Need to import randomBytes
import { randomBytes } from "node:crypto";

/**
 * Check if two bilingual strings are equivalent.
 */
export function bilingualEquivalent(
	a: BilingualString,
	b: BilingualString,
): boolean {
	return (
		normalizeTerm(a.en) === normalizeTerm(b.en) &&
		normalizeTerm(a.nl) === normalizeTerm(b.nl)
	);
}

// ============================================================================
// Duplicate Detection
// ============================================================================

/**
 * Detect if a proposed entry duplicates an existing entry.
 */
export function detectDuplicate(
	proposedEntry: Partial<TerminologyEntry> & {
		canonicalTerm: string;
		preferredTerm: BilingualString;
		aliases?: LanguageAliases;
		acronyms?: Acronym[];
	},
	existingEntries: TerminologyEntry[],
): DuplicateDetectionResult {
	const proposedCanonical = normalizeTerm(proposedEntry.canonicalTerm);
	const proposedPreferredEn = normalizeTerm(proposedEntry.preferredTerm.en);
	const proposedPreferredNl = normalizeTerm(proposedEntry.preferredTerm.nl);

	// Check exact canonical term match
	for (const existing of existingEntries) {
		if (normalizeTerm(existing.canonicalTerm) === proposedCanonical) {
			return {
				isDuplicate: true,
				existingEntryId: existing.entryId,
				matchType: "exact-canonical",
				confidence: 1.0,
				details: `Exact canonical term match: "${existing.canonicalTerm}"`,
			};
		}
	}

	// Check exact preferred term match (EN)
	for (const existing of existingEntries) {
		if (normalizeTerm(existing.preferredTerm.en) === proposedPreferredEn) {
			return {
				isDuplicate: true,
				existingEntryId: existing.entryId,
				matchType: "exact-alias",
				confidence: 0.95,
				details: `Exact EN preferred term match: "${existing.preferredTerm.en}"`,
			};
		}
	}

	// Check exact preferred term match (NL)
	for (const existing of existingEntries) {
		if (normalizeTerm(existing.preferredTerm.nl) === proposedPreferredNl) {
			return {
				isDuplicate: true,
				existingEntryId: existing.entryId,
				matchType: "exact-alias",
				confidence: 0.95,
				details: `Exact NL preferred term match: "${existing.preferredTerm.nl}"`,
			};
		}
	}

	// Check acronym conflicts (before aliases, as acronyms are more specific identifiers)
	const proposedAcronyms =
		proposedEntry.acronyms?.map((a) => normalizeAcronym(a.acronym)) ?? [];
	for (const existing of existingEntries) {
		const existingAcronyms = existing.acronyms.map((a) =>
			normalizeAcronym(a.acronym),
		);
		for (const acronym of proposedAcronyms) {
			if (existingAcronyms.includes(acronym)) {
				return {
					isDuplicate: true,
					existingEntryId: existing.entryId,
					matchType: "acronym-conflict",
					confidence: 0.85,
					details: `Acronym conflict: "${acronym}" already used by "${existing.canonicalTerm}"`,
				};
			}
		}
	}

	// Check aliases
	const proposedAliasesEn =
		proposedEntry.aliases?.en?.map(normalizeTerm) ?? [];
	const proposedAliasesNl =
		proposedEntry.aliases?.nl?.map(normalizeTerm) ?? [];

	for (const existing of existingEntries) {
		const existingAliasesEn = existing.aliases.en?.map(normalizeTerm) ?? [];
		const existingAliasesNl = existing.aliases.nl?.map(normalizeTerm) ?? [];

		for (const alias of proposedAliasesEn) {
			if (existingAliasesEn.includes(alias)) {
				return {
					isDuplicate: true,
					existingEntryId: existing.entryId,
					matchType: "exact-alias",
					confidence: 0.9,
					details: `Exact EN alias match: "${alias}"`,
				};
			}
		}

		for (const alias of proposedAliasesNl) {
			if (existingAliasesNl.includes(alias)) {
				return {
					isDuplicate: true,
					existingEntryId: existing.entryId,
					matchType: "exact-alias",
					confidence: 0.9,
					details: `Exact NL alias match: "${alias}"`,
				};
			}
		}
	}

	// Fuzzy matching (simple Levenshtein-like check for very similar terms)
	for (const existing of existingEntries) {
		const existingCanonical = normalizeTerm(existing.canonicalTerm);
		if (calculateSimilarity(proposedCanonical, existingCanonical) > 0.9) {
			return {
				isDuplicate: true,
				existingEntryId: existing.entryId,
				matchType: "fuzzy-canonical",
				confidence: 0.8,
				details: `High similarity to existing term: "${existing.canonicalTerm}" (${(calculateSimilarity(proposedCanonical, existingCanonical) * 100).toFixed(0)}%)`,
			};
		}
	}

	return {
		isDuplicate: false,
		matchType: "exact-canonical",
		confidence: 0,
		details: "No duplicates detected",
	};
}

/**
 * Simple string similarity (Jaro-Winkler-like approximation).
 */
function calculateSimilarity(a: string, b: string): number {
	if (a === b) return 1;
	if (a.length === 0 || b.length === 0) return 0;

	// Simple approach: longest common subsequence ratio
	const shorter = a.length < b.length ? a : b;
	const longer = a.length < b.length ? b : a;

	let matches = 0;
	for (let i = 0; i < shorter.length; i++) {
		if (longer.includes(shorter[i])) matches++;
	}

	return matches / longer.length;
}

// ============================================================================
// Entry Validation
// ============================================================================

/**
 * Validate a terminology entry against schema and business rules.
 */
export function validateTerminologyEntry(
	entry: TerminologyEntry,
	existingEntries: TerminologyEntry[] = [],
): TerminologyValidationResult {
	const errors: TerminologyValidationError[] = [];
	const warnings: TerminologyValidationWarning[] = [];

	// Schema validation
	const schemaResult = TerminologyEntrySchema.safeParse(entry);
	if (!schemaResult.success) {
		for (const issue of schemaResult.error.issues) {
			errors.push({
				code: "SCHEMA_VALIDATION",
				message: `${issue.path.join(".")}: ${issue.message}`,
				field: issue.path.join("."),
				entryId: entry.entryId,
			});
		}
	}

	// Business rule validations
	if (!errors.some((e) => e.code === "SCHEMA_VALIDATION")) {
		// Check ID pattern
		if (!ID_PATTERNS.thesaurusEntry.test(entry.entryId)) {
			errors.push({
				code: "INVALID_ENTRY_ID",
				message: `Entry ID "${entry.entryId}" does not match pattern ${ID_PATTERNS.thesaurusEntry}`,
				field: "entryId",
				entryId: entry.entryId,
			});
		}

		// Check canonical term is not empty
		if (!entry.canonicalTerm || entry.canonicalTerm.trim().length === 0) {
			errors.push({
				code: "EMPTY_CANONICAL_TERM",
				message: "Canonical term cannot be empty",
				field: "canonicalTerm",
				entryId: entry.entryId,
			});
		}

		// Check bilingual definitions are substantive
		if (entry.definition.en.length < 10) {
			warnings.push({
				code: "SHORT_EN_DEFINITION",
				message:
					"English definition is very short (< 10 chars); consider expanding",
				field: "definition.en",
				entryId: entry.entryId,
			});
		}
		if (entry.definition.nl.length < 10) {
			warnings.push({
				code: "SHORT_NL_DEFINITION",
				message:
					"Dutch definition is very short (< 10 chars); consider expanding",
				field: "definition.nl",
				entryId: entry.entryId,
			});
		}

		// Check at least one source
		if (entry.sources.length === 0) {
			errors.push({
				code: "NO_SOURCES",
				message:
					"At least one authoritative source reference is required",
				field: "sources",
				entryId: entry.entryId,
			});
		}

		// Check source IDs are valid
		for (const source of entry.sources) {
			if (!ID_PATTERNS.source.test(source.sourceId)) {
				warnings.push({
					code: "INVALID_SOURCE_ID_FORMAT",
					message: `Source ID "${source.sourceId}" does not match expected pattern`,
					field: "sources[].sourceId",
					entryId: entry.entryId,
				});
			}
		}

		// Check lifecycle status consistency
		if (entry.lifecycleStatus === "ESTABLISHED" && !entry.establishedAt) {
			warnings.push({
				code: "MISSING_ESTABLISHED_DATE",
				message:
					"ESTABLISHED entries should have an establishedAt date",
				field: "establishedAt",
				entryId: entry.entryId,
			});
		}

		if (entry.lifecycleStatus === "DEPRECATED" && !entry.deprecatedAt) {
			warnings.push({
				code: "MISSING_DEPRECATED_DATE",
				message: "DEPRECATED entries should have a deprecatedAt date",
				field: "deprecatedAt",
				entryId: entry.entryId,
			});
		}

		if (entry.lifecycleStatus === "SUPERSEDED" && !entry.supersededBy) {
			errors.push({
				code: "MISSING_SUPERSEDED_BY",
				message:
					"SUPERSEDED entries must reference the replacement entry",
				field: "supersededBy",
				entryId: entry.entryId,
			});
		}

		// Check supersededBy references valid entry
		if (entry.supersededBy) {
			const target = existingEntries.find(
				(e) => e.entryId === entry.supersededBy,
			);
			if (!target) {
				errors.push({
					code: "INVALID_SUPERSEDED_BY",
					message: `supersededBy references non-existent entry "${entry.supersededBy}"`,
					field: "supersededBy",
					entryId: entry.entryId,
					relatedEntryId: entry.supersededBy,
				});
			} else if (
				target.lifecycleStatus === "DEPRECATED" ||
				target.lifecycleStatus === "SUPERSEDED"
			) {
				warnings.push({
					code: "SUPERSEDED_BY_DEPRECATED",
					message: `Replacement entry "${entry.supersededBy}" is itself ${target.lifecycleStatus.toLowerCase()}`,
					field: "supersededBy",
					entryId: entry.entryId,
					relatedEntryId: entry.supersededBy,
				});
			}
		}

		// Check relationship targets exist
		for (const rel of entry.relationships) {
			const target = existingEntries.find(
				(e) => e.entryId === rel.targetId,
			);
			if (!target) {
				errors.push({
					code: "INVALID_RELATIONSHIP_TARGET",
					message: `Relationship targets non-existent entry "${rel.targetId}"`,
					field: "relationships[].targetId",
					entryId: entry.entryId,
					relatedEntryId: rel.targetId,
				});
			} else if (rel.targetId === entry.entryId) {
				errors.push({
					code: "SELF_REFERENCE_RELATIONSHIP",
					message: "Relationship cannot reference the entry itself",
					field: "relationships[].targetId",
					entryId: entry.entryId,
				});
			}
		}

		// Check for contradictory relationships
		const synonymTargets = entry.relationships
			.filter((r) => r.type === "synonym-of")
			.map((r) => r.targetId);
		const conflictsTargets = entry.relationships
			.filter((r) => r.type === "conflicts-with")
			.map((r) => r.targetId);
		for (const targetId of synonymTargets) {
			if (conflictsTargets.includes(targetId)) {
				errors.push({
					code: "CONTRADICTORY_RELATIONSHIPS",
					message: `Entry has both synonym-of and conflicts-with relationships to "${targetId}"`,
					field: "relationships",
					entryId: entry.entryId,
					relatedEntryId: targetId,
				});
			}
		}

		// Check duplicate detection against existing entries (excluding self)
		const otherEntries = existingEntries.filter(
			(e) => e.entryId !== entry.entryId,
		);
		const duplicate = detectDuplicate(entry, otherEntries);
		if (duplicate.isDuplicate) {
			errors.push({
				code: "DUPLICATE_ENTRY",
				message: duplicate.details,
				field: "canonicalTerm",
				entryId: entry.entryId,
				relatedEntryId: duplicate.existingEntryId,
			});
		}

		// Check for missing firstObservedAt when possible
		if (!entry.firstObservedAt && entry.historicalObservations.length > 0) {
			const firstObs = entry.historicalObservations
				.filter((o) => o.isFirstObserved)
				.sort((a, b) => a.date.localeCompare(b.date))[0];
			if (firstObs) {
				warnings.push({
					code: "MISSING_FIRST_OBSERVED",
					message: `Historical observation marks ${firstObs.date} as first observed but firstObservedAt is not set`,
					field: "firstObservedAt",
					entryId: entry.entryId,
				});
			}
		}

		// Check historical observations are sorted
		const sortedObs = entry.historicalObservations.toSorted((a, b) =>
			a.date.localeCompare(b.date),
		);
		const isSorted = entry.historicalObservations.every(
			(o, i) => o.date === sortedObs[i].date,
		);
		if (!isSorted) {
			warnings.push({
				code: "UNSORTED_HISTORICAL_OBSERVATIONS",
				message: "Historical observations should be sorted by date",
				field: "historicalObservations",
				entryId: entry.entryId,
			});
		}

		// Check revision history has valid change types
		for (const rev of entry.revisionHistory) {
			const changeTypeResult = TerminologyChangeTypeSchema.safeParse(
				rev.changeType,
			);
			if (!changeTypeResult.success) {
				errors.push({
					code: "INVALID_CHANGE_TYPE",
					message: `Invalid change type "${rev.changeType}" in revision ${rev.revisionId}`,
					field: "revisionHistory[].changeType",
					entryId: entry.entryId,
				});
			}
		}
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
	};
}

/**
 * Validate a complete thesaurus artifact.
 */
export function validateThesaurusArtifact(
	artifact: ThesaurusArtifact,
): TerminologyValidationResult {
	const errors: TerminologyValidationError[] = [];
	const warnings: TerminologyValidationWarning[] = [];

	// Schema validation
	const schemaResult = ThesaurusArtifactSchema.safeParse(artifact);
	if (!schemaResult.success) {
		for (const issue of schemaResult.error.issues) {
			errors.push({
				code: "SCHEMA_VALIDATION",
				message: `${issue.path.join(".")}: ${issue.message}`,
				field: issue.path.join("."),
			});
		}
	}

	// Cross-entry validations
	const entryIds = new Set(artifact.entries.map((e) => e.entryId));

	// Check for duplicate entry IDs
	const duplicateIds = artifact.entries
		.map((e) => e.entryId)
		.filter((id, i, arr) => arr.indexOf(id) !== i);
	if (duplicateIds.length > 0) {
		errors.push({
			code: "DUPLICATE_ENTRY_IDS",
			message: `Duplicate entry IDs found: ${duplicateIds.join(", ")}`,
			field: "entries[].entryId",
		});
	}

	// Validate each entry
	for (const entry of artifact.entries) {
		const entryValidation = validateTerminologyEntry(
			entry,
			artifact.entries,
		);
		errors.push(...entryValidation.errors);
		warnings.push(...entryValidation.warnings);
	}

	// Check relationship integrity across all entries
	for (const entry of artifact.entries) {
		for (const rel of entry.relationships) {
			if (!entryIds.has(rel.targetId)) {
				errors.push({
					code: "BROKEN_RELATIONSHIP",
					message: `Entry "${entry.canonicalTerm}" (\`${entry.entryId}\`) references missing target \`${rel.targetId}\``,
					field: "relationships[].targetId",
					entryId: entry.entryId,
					relatedEntryId: rel.targetId,
				});
			}
		}
	}

	// Check for relationship cycles (simple 2-cycle detection)
	for (const entry of artifact.entries) {
		for (const rel of entry.relationships) {
			if (["synonym-of", "alias-of", "supersedes"].includes(rel.type)) {
				// These should be symmetric - check reverse
				const target = artifact.entries.find(
					(e) => e.entryId === rel.targetId,
				);
				if (target) {
					const reverseRel = target.relationships.find(
						(r) => r.targetId === entry.entryId,
					);
					if (!reverseRel) {
						warnings.push({
							code: "ASYMMETRIC_RELATIONSHIP",
							message: `Relationship ${rel.type} from "${entry.canonicalTerm}" to "${target.canonicalTerm}" lacks reciprocal`,
							field: "relationships",
							entryId: entry.entryId,
							relatedEntryId: target.entryId,
						});
					}
				}
			}
		}
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
	};
}

// ============================================================================
// Relationship Validation
// ============================================================================

/**
 * Validate the relationship graph for consistency.
 */
export function validateRelationships(
	entries: TerminologyEntry[],
): RelationshipValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];
	const cyclesDetected: string[][] = [];
	const invalidTargets: string[] = [];

	const entryMap = new Map(entries.map((e) => [e.entryId, e]));

	// Check all targets exist
	for (const entry of entries) {
		for (const rel of entry.relationships) {
			if (!entryMap.has(rel.targetId)) {
				invalidTargets.push(rel.targetId);
				errors.push(
					`Entry ${entry.entryId} references non-existent target ${rel.targetId}`,
				);
			}
		}
	}

	// Detect cycles (simple DFS for 3-hop cycles)
	for (const entry of entries) {
		const visited = new Set<string>();
		const path: string[] = [];

		function dfs(currentId: string, depth: number) {
			if (depth > 3) return; // Limit depth
			if (visited.has(currentId)) {
				// Cycle detected
				const cycleStart = path.indexOf(currentId);
				if (cycleStart >= 0) {
					const cycle = [...path.slice(cycleStart), currentId];
					if (cycle.length > 1) {
						cyclesDetected.push(cycle);
					}
				}
				return;
			}

			visited.add(currentId);
			path.push(currentId);

			const current = entryMap.get(currentId);
			if (current) {
				for (const rel of current.relationships) {
					if (
						[
							"synonym-of",
							"broader-than",
							"narrower-than",
							"part-of",
							"extends",
						].includes(rel.type)
					) {
						dfs(rel.targetId, depth + 1);
					}
				}
			}

			path.pop();
		}

		dfs(entry.entryId, 0);
	}

	// Deduplicate cycles
	const uniqueCycles = cyclesDetected
		.map((c) => c.toSorted().join(">"))
		.filter((c, i, arr) => arr.indexOf(c) === i)
		.map((c) => c.split(">"));

	// Check for invalid self-references
	for (const entry of entries) {
		for (const rel of entry.relationships) {
			if (rel.targetId === entry.entryId) {
				errors.push(
					`Entry ${entry.entryId} has self-referencing relationship`,
				);
			}
		}
	}

	return {
		valid: errors.length === 0 && invalidTargets.length === 0,
		errors,
		warnings,
		cyclesDetected: uniqueCycles,
		invalidTargets,
	};
}

// ============================================================================
// Core Engine Operations
// ============================================================================

/**
 * Add a new terminology entry to the thesaurus.
 */
export async function addTerminologyEntry(
	entry: TerminologyEntry,
	options: {
		editionDate?: string;
		generatedBy?: string;
		autoPromote?: boolean;
	} = {},
): Promise<TerminologyOperationResult> {
	const artifact = await loadThesaurusArtifact();
	const existingEntries = artifact?.entries ?? [];

	// Validate the new entry
	const validation = validateTerminologyEntry(entry, existingEntries);
	if (!validation.valid) {
		return {
			success: false,
			errors: validation.errors.map((e) => e.message),
			warnings: validation.warnings.map((w) => w.message),
			changes: [],
		};
	}

	// Check for duplicates
	const duplicate = detectDuplicate(entry, existingEntries);
	if (duplicate.isDuplicate) {
		return {
			success: false,
			errors: [`Duplicate detected: ${duplicate.details}`],
			warnings: [],
			changes: [],
		};
	}

	// Add entry
	const newEntries = [...existingEntries, entry];

	// Create new artifact
	const newArtifact = await createThesaurusArtifact(newEntries, {
		editionDate: options.editionDate,
		generatedBy: options.generatedBy ?? "thesaurus-engine",
		previousVersionHash: artifact?.contentHash,
	});

	await saveThesaurusArtifact(newArtifact, {
		previousVersionHash: artifact?.contentHash,
	});
	await writeThesaurusMarkdown(newEntries);

	return {
		success: true,
		entryId: entry.entryId,
		artifactId: newArtifact.artifactId,
		errors: [],
		warnings: validation.warnings.map((w) => w.message),
		changes: [
			{
				entryId: entry.entryId,
				changeType: "ADD",
				newValue: entry.canonicalTerm,
			},
		],
	};
}

/**
 * Update an existing terminology entry.
 */
export async function updateTerminologyEntry(
	entryId: string,
	updates: Partial<TerminologyEntry>,
	options: {
		editionDate?: string;
		generatedBy?: string;
		justification: string;
		revisedBy: string;
	},
): Promise<TerminologyOperationResult> {
	const artifact = await loadThesaurusArtifact();
	if (!artifact) {
		return {
			success: false,
			errors: ["No thesaurus artifact found"],
			warnings: [],
			changes: [],
		};
	}

	const entryIndex = artifact.entries.findIndex((e) => e.entryId === entryId);
	if (entryIndex === -1) {
		return {
			success: false,
			errors: [`Entry ${entryId} not found`],
			warnings: [],
			changes: [],
		};
	}

	const existingEntry = artifact.entries[entryIndex];

	// Determine change type
	let changeType: TerminologyChangeType = "REFINE";
	if (
		updates.lifecycleStatus &&
		updates.lifecycleStatus !== existingEntry.lifecycleStatus
	) {
		if (
			updates.lifecycleStatus === "ESTABLISHED" &&
			existingEntry.lifecycleStatus === "VERIFIED"
		) {
			changeType = "CONFIRM";
		} else if (updates.lifecycleStatus === "DEPRECATED") {
			changeType = "DEPRECATE";
		} else if (updates.lifecycleStatus === "SUPERSEDED") {
			changeType = "SUPERSEDE";
		}
	}

	// Build updated entry
	const updatedEntry: TerminologyEntry = {
		...existingEntry,
		...updates,
		entryId, // Preserve ID
		updatedAt: new Date().toISOString(),
		revisionHistory: [
			...existingEntry.revisionHistory,
			{
				revisionId: `rev_${randomBytes(8).toString("hex")}`,
				changeType,
				revisedAt: new Date().toISOString(),
				revisedBy: options.revisedBy,
				previousLifecycleStatus: existingEntry.lifecycleStatus,
				newLifecycleStatus: updates.lifecycleStatus,
				fieldChanged: Object.keys(updates).join(", "),
				previousValue: JSON.stringify(
					Object.fromEntries(
						Object.keys(updates).map((k) => [
							k,
							(existingEntry as any)[k],
						]),
					),
				),
				newValue: JSON.stringify(
					Object.fromEntries(
						Object.keys(updates).map((k) => [
							k,
							(updates as any)[k],
						]),
					),
				),
				justification: options.justification,
			},
		],
	};

	// Set lifecycle dates
	if (
		updates.lifecycleStatus === "ESTABLISHED" &&
		!existingEntry.establishedAt
	) {
		updatedEntry.establishedAt = new Date().toISOString().split("T")[0];
	}
	if (
		updates.lifecycleStatus === "DEPRECATED" &&
		!existingEntry.deprecatedAt
	) {
		updatedEntry.deprecatedAt = new Date().toISOString().split("T")[0];
	}

	// Validate
	const validation = validateTerminologyEntry(
		updatedEntry,
		artifact.entries.filter((_, i) => i !== entryIndex),
	);
	if (!validation.valid) {
		return {
			success: false,
			errors: validation.errors.map((e) => e.message),
			warnings: validation.warnings.map((w) => w.message),
			changes: [],
		};
	}

	// Update entries
	const newEntries = [...artifact.entries];
	newEntries[entryIndex] = updatedEntry;

	// Create new artifact
	const newArtifact = await createThesaurusArtifact(newEntries, {
		editionDate: options.editionDate,
		generatedBy: options.generatedBy ?? "thesaurus-engine",
		previousVersionHash: artifact.contentHash,
	});

	await saveThesaurusArtifact(newArtifact, {
		previousVersionHash: artifact.contentHash,
	});
	await writeThesaurusMarkdown(newEntries);

	return {
		success: true,
		entryId,
		artifactId: newArtifact.artifactId,
		errors: [],
		warnings: validation.warnings.map((w) => w.message),
		changes: [
			{
				entryId,
				changeType,
				field: Object.keys(updates).join(", "),
				previousValue: JSON.stringify(
					Object.fromEntries(
						Object.keys(updates).map((k) => [
							k,
							(existingEntry as any)[k],
						]),
					),
				),
				newValue: JSON.stringify(
					Object.fromEntries(
						Object.keys(updates).map((k) => [
							k,
							(updates as any)[k],
						]),
					),
				),
			},
		],
	};
}

/**
 * Merge two terminology entries.
 */
export async function mergeTerminologyEntries(
	primaryEntryId: string,
	secondaryEntryId: string,
	options: {
		editionDate?: string;
		generatedBy?: string;
		justification: string;
		revisedBy: string;
	},
): Promise<TerminologyOperationResult> {
	const artifact = await loadThesaurusArtifact();
	if (!artifact) {
		return {
			success: false,
			errors: ["No thesaurus artifact found"],
			warnings: [],
			changes: [],
		};
	}

	const primaryIndex = artifact.entries.findIndex(
		(e) => e.entryId === primaryEntryId,
	);
	const secondaryIndex = artifact.entries.findIndex(
		(e) => e.entryId === secondaryEntryId,
	);

	if (primaryIndex === -1 || secondaryIndex === -1) {
		return {
			success: false,
			errors: ["One or both entries not found"],
			warnings: [],
			changes: [],
		};
	}

	const primary = artifact.entries[primaryIndex];
	const secondary = artifact.entries[secondaryIndex];

	// Merge: combine aliases, acronyms, relationships, sources, historical observations
	const merged: TerminologyEntry = {
		...primary,
		aliases: {
			en: [
				...new Set([
					...(primary.aliases.en ?? []),
					...(secondary.aliases.en ?? []),
				]),
			],
			nl: [
				...new Set([
					...(primary.aliases.nl ?? []),
					...(secondary.aliases.nl ?? []),
				]),
			],
		},
		acronyms: [
			...primary.acronyms,
			...secondary.acronyms.filter(
				(a) =>
					!primary.acronyms.some(
						(p) =>
							normalizeAcronym(p.acronym) ===
							normalizeAcronym(a.acronym),
					),
			),
		],
		relationships: [
			...primary.relationships,
			...secondary.relationships.filter(
				(r) =>
					!primary.relationships.some(
						(p) => p.targetId === r.targetId && p.type === r.type,
					),
			),
		],
		sources: [
			...primary.sources,
			...secondary.sources.filter(
				(s) =>
					!primary.sources.some(
						(p) => p.sourceId === s.sourceId && p.url === s.url,
					),
			),
		],
		historicalObservations: [
			...primary.historicalObservations,
			...secondary.historicalObservations,
		].sort((a, b) => a.date.localeCompare(b.date)),
		revisionHistory: [
			...primary.revisionHistory,
			{
				revisionId: `rev_${randomBytes(8).toString("hex")}`,
				changeType: "MERGE",
				revisedAt: new Date().toISOString(),
				revisedBy: options.revisedBy,
				previousLifecycleStatus: primary.lifecycleStatus,
				newLifecycleStatus: primary.lifecycleStatus,
				fieldChanged: "merged",
				previousValue: `Merged ${secondary.canonicalTerm} (${secondaryEntryId})`,
				newValue: primary.canonicalTerm,
				justification: options.justification,
				relatedEntryIds: [secondaryEntryId],
			},
		],
		updatedAt: new Date().toISOString(),
	};

	// Update secondary to SUPERSEDED
	const supersededSecondary: TerminologyEntry = {
		...secondary,
		lifecycleStatus: "SUPERSEDED",
		supersededBy: primaryEntryId,
		deprecatedAt: new Date().toISOString().split("T")[0],
		revisionHistory: [
			...secondary.revisionHistory,
			{
				revisionId: `rev_${randomBytes(8).toString("hex")}`,
				changeType: "SUPERSEDE",
				revisedAt: new Date().toISOString(),
				revisedBy: options.revisedBy,
				previousLifecycleStatus: secondary.lifecycleStatus,
				newLifecycleStatus: "SUPERSEDED",
				fieldChanged: "lifecycleStatus",
				justification: `Merged into ${primary.canonicalTerm} (${primaryEntryId}): ${options.justification}`,
				relatedEntryIds: [primaryEntryId],
			},
		],
		updatedAt: new Date().toISOString(),
	};

	// Validate both
	const primaryValidation = validateTerminologyEntry(
		merged,
		artifact.entries.filter(
			(_, i) => i !== primaryIndex && i !== secondaryIndex,
		),
	);
	if (!primaryValidation.valid) {
		return {
			success: false,
			errors: primaryValidation.errors.map((e) => e.message),
			warnings: primaryValidation.warnings.map((w) => w.message),
			changes: [],
		};
	}

	// Create new entries array
	const newEntries = artifact.entries.map((e, i) => {
		if (i === primaryIndex) return merged;
		if (i === secondaryIndex) return supersededSecondary;
		return e;
	});

	const newArtifact = await createThesaurusArtifact(newEntries, {
		editionDate: options.editionDate,
		generatedBy: options.generatedBy ?? "thesaurus-engine",
		previousVersionHash: artifact.contentHash,
	});

	await saveThesaurusArtifact(newArtifact, {
		previousVersionHash: artifact.contentHash,
	});
	await writeThesaurusMarkdown(newEntries);

	return {
		success: true,
		entryId: primaryEntryId,
		artifactId: newArtifact.artifactId,
		errors: [],
		warnings: primaryValidation.warnings.map((w) => w.message),
		changes: [
			{
				entryId: primaryEntryId,
				changeType: "MERGE",
				newValue: `Merged ${secondaryEntryId}`,
			},
			{
				entryId: secondaryEntryId,
				changeType: "SUPERSEDE",
				newValue: `Superseded by ${primaryEntryId}`,
			},
		],
	};
}

/**
 * Deprecate a terminology entry.
 */
export async function deprecateTerminologyEntry(
	entryId: string,
	options: {
		editionDate?: string;
		generatedBy?: string;
		justification: string;
		revisedBy: string;
		replacementId?: string;
	},
): Promise<TerminologyOperationResult> {
	const updates: Partial<TerminologyEntry> = {
		lifecycleStatus: options.replacementId ? "SUPERSEDED" : "DEPRECATED",
		supersededBy: options.replacementId,
	};

	return updateTerminologyEntry(entryId, updates, options);
}

/**
 * Promote a CANDIDATE to VERIFIED or ESTABLISHED.
 */
export async function promoteTerminologyEntry(
	entryId: string,
	targetStatus: "VERIFIED" | "ESTABLISHED",
	options: {
		editionDate?: string;
		generatedBy?: string;
		justification: string;
		revisedBy: string;
	},
): Promise<TerminologyOperationResult> {
	return updateTerminologyEntry(
		entryId,
		{ lifecycleStatus: targetStatus },
		options,
	);
}

/**
 * Search terminology entries.
 */
export function searchTerminologyEntries(
	entries: TerminologyEntry[],
	query: string,
	options: {
		language?: LanguageCode;
		includeDeprecated?: boolean;
		lifecycleStatus?: TerminologyLifecycleStatus[];
	} = {},
): TerminologyEntry[] {
	const normalizedQuery = normalizeTerm(query);
	const { includeDeprecated = false, lifecycleStatus } = options;

	return entries.filter((entry) => {
		if (
			!includeDeprecated &&
			(entry.lifecycleStatus === "DEPRECATED" ||
				entry.lifecycleStatus === "SUPERSEDED")
		) {
			return false;
		}
		if (
			lifecycleStatus &&
			!lifecycleStatus.includes(entry.lifecycleStatus)
		) {
			return false;
		}

		const searchTerms = [
			entry.canonicalTerm,
			entry.preferredTerm.en,
			entry.preferredTerm.nl,
			...(entry.aliases.en ?? []),
			...(entry.aliases.nl ?? []),
			...entry.acronyms.map((a) => a.acronym),
			entry.definition.en,
			entry.definition.nl,
		].map(normalizeTerm);

		return searchTerms.some((term) => term.includes(normalizedQuery));
	});
}

/**
 * Get entry by ID.
 */
export function getTerminologyEntryById(
	entries: TerminologyEntry[],
	entryId: string,
): TerminologyEntry | undefined {
	return entries.find((e) => e.entryId === entryId);
}

/**
 * Get all entries for a research domain.
 */
export function getEntriesByDomain(
	entries: TerminologyEntry[],
	domainId: string,
): TerminologyEntry[] {
	return entries.filter((e) =>
		e.researchDomains.some((d) => d.domainId === domainId),
	);
}

/**
 * Generate JSON schemas for the thesaurus.
 */
export function generateAllJsonSchemas(): {
	terminologyEntry: Record<string, unknown>;
	thesaurusArtifact: Record<string, unknown>;
	changeProposal: Record<string, unknown>;
} {
	return {
		terminologyEntry: generateTerminologyEntryJsonSchema(),
		thesaurusArtifact: generateThesaurusArtifactJsonSchema(),
		changeProposal: generateTerminologyChangeProposalJsonSchema(),
	};
}

/**
 * Validate and persist change proposals.
 */
export async function processChangeProposals(
	proposals: TerminologyChangeProposal[],
	options: { generatedBy: string } = { generatedBy: "thesaurus-engine" },
): Promise<TerminologyOperationResult[]> {
	const results: TerminologyOperationResult[] = [];

	for (const proposal of proposals) {
		if (proposal.status !== "pending") continue;

		let result: TerminologyOperationResult;

		switch (proposal.changeType) {
			case "ADD":
				if (!proposal.proposedEntry) {
					result = {
						success: false,
						errors: ["ADD proposal missing proposedEntry"],
						warnings: [],
						changes: [],
					};
				} else {
					result = await addTerminologyEntry(
						proposal.proposedEntry as TerminologyEntry,
						{
							editionDate: proposal.editionDate,
							generatedBy: options.generatedBy,
						},
					);
				}
				break;

			case "REFINE":
			case "CONFIRM":
			case "DEPRECATE":
			case "SUPERSEDE":
				if (!proposal.targetEntryId) {
					result = {
						success: false,
						errors: [
							`${proposal.changeType} proposal missing targetEntryId`,
						],
						warnings: [],
						changes: [],
					};
				} else {
					result = await updateTerminologyEntry(
						proposal.targetEntryId,
						proposal.proposedEntry ?? {},
						{
							editionDate: proposal.editionDate,
							generatedBy: options.generatedBy,
							justification: proposal.justification,
							revisedBy: options.generatedBy,
						},
					);
				}
				break;

			case "MERGE":
				if (!proposal.targetEntryId || !proposal.relatedEntryIds[0]) {
					result = {
						success: false,
						errors: [
							"MERGE proposal missing targetEntryId or relatedEntryIds",
						],
						warnings: [],
						changes: [],
					};
				} else {
					result = await mergeTerminologyEntries(
						proposal.targetEntryId,
						proposal.relatedEntryIds[0],
						{
							editionDate: proposal.editionDate,
							generatedBy: options.generatedBy,
							justification: proposal.justification,
							revisedBy: options.generatedBy,
						},
					);
				}
				break;

			default:
				result = {
					success: false,
					errors: [`Unknown change type: ${proposal.changeType}`],
					warnings: [],
					changes: [],
				};
		}

		// Update proposal status
		proposal.status = result.success ? "approved" : "rejected";
		proposal.decidedAt = new Date().toISOString();
		proposal.decidedBy = options.generatedBy;
		proposal.decisionRationale = result.errors.join("; ") || "Approved";
		await saveChangeProposal(proposal);

		results.push(result);
	}

	return results;
}
