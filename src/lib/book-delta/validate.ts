/**
 * Book Delta — Validation & Serialization Utilities
 *
 * Provides schema validation, hash computation, and canonical serialization
 * for Book Delta data structures.
 */

import { z } from "astro/zod";
import {
	BookDeltaProposalSchema,
	BookDeltaArtifactSchema,
	BookDeltaEvaluationResultSchema,
	BookDeltaKnowledgeContinuityResultSchema,
	BOOK_DELTA_SCHEMA_VERSION,
	BOOK_DELTA_ID_PATTERNS,
	type BookDeltaProposal,
	type BookDeltaArtifact,
	type BookDeltaEvaluationResult,
	type BookDeltaKnowledgeContinuityResult,
} from "./schema.js";

/**
 * Compute SHA-256 hash of a string.
 */
export async function computeContentHash(content: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(content);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return (
		"sha256:" +
		hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
	);
}

/**
 * Compute SHA-256 hash of a JSON-serializable object.
 * Uses canonical JSON serialization for deterministic hashing.
 */
export async function computeObjectHash(obj: unknown): Promise<string> {
	const canonical = canonicalStringify(obj);
	return computeContentHash(canonical);
}

/**
 * Canonical JSON stringification for deterministic hashing.
 * Sorts object keys alphabetically.
 */
export function canonicalStringify(obj: unknown): string {
	if (obj === null || obj === undefined) {
		return "null";
	}

	if (typeof obj !== "object") {
		return JSON.stringify(obj);
	}

	if (Array.isArray(obj)) {
		return "[" + obj.map(canonicalStringify).join(",") + "]";
	}

	// Sort keys for deterministic output. Properties whose value is undefined
	// are omitted, matching JSON.stringify semantics and keeping optional schema
	// fields absent (never serialized as null).
	const keys = Object.keys(obj).sort();
	const pairs = keys
		.filter((key) => (obj as Record<string, unknown>)[key] !== undefined)
		.map((key) => {
			const value = (obj as Record<string, unknown>)[key];
			return JSON.stringify(key) + ":" + canonicalStringify(value);
		});
	return "{" + pairs.join(",") + "}";
}

/**
 * Validate a Book Delta proposal.
 */
export function validateBookDeltaProposal(
	proposal: unknown,
): BookDeltaProposal {
	const result = BookDeltaProposalSchema.safeParse(proposal);
	if (!result.success) {
		const errors = result.error.issues
			.map((i) => `${i.path.join(".")}: ${i.message}`)
			.join("; ");
		throw new Error(`Book Delta proposal validation failed: ${errors}`);
	}
	return result.data;
}

/**
 * Validate a Book Delta artifact.
 */
export function validateBookDeltaArtifact(
	artifact: unknown,
): BookDeltaArtifact {
	const result = BookDeltaArtifactSchema.safeParse(artifact);
	if (!result.success) {
		const errors = result.error.issues
			.map((i) => `${i.path.join(".")}: ${i.message}`)
			.join("; ");
		throw new Error(`Book Delta artifact validation failed: ${errors}`);
	}
	return result.data;
}

/**
 * Validate a Book Delta evaluation result.
 */
export function validateBookDeltaEvaluationResult(
	result: unknown,
): BookDeltaEvaluationResult {
	const parsed = BookDeltaEvaluationResultSchema.safeParse(result);
	if (!parsed.success) {
		const errors = parsed.error.issues
			.map((i) => `${i.path.join(".")}: ${i.message}`)
			.join("; ");
		throw new Error(
			`Book Delta evaluation result validation failed: ${errors}`,
		);
	}
	return parsed.data;
}

/**
 * Validate a Book Delta knowledge continuity result.
 */
export function validateBookDeltaKnowledgeContinuityResult(
	result: unknown,
): BookDeltaKnowledgeContinuityResult {
	const parsed = BookDeltaKnowledgeContinuityResultSchema.safeParse(result);
	if (!parsed.success) {
		const errors = parsed.error.issues
			.map((i) => `${i.path.join(".")}: ${i.message}`)
			.join("; ");
		throw new Error(
			`Book Delta knowledge continuity result validation failed: ${errors}`,
		);
	}
	return parsed.data;
}

/**
 * Generate all JSON schemas for Book Delta.
 */
export async function generateAllBookDeltaJsonSchemas(): Promise<
	Record<string, Record<string, unknown>>
> {
	const {
		generateBookDeltaProposalJsonSchema,
		generateBookDeltaArtifactJsonSchema,
		generateBookDeltaEvaluationResultJsonSchema,
		generateBookDeltaKnowledgeContinuityJsonSchema,
	} = await import("./schema.js");

	return {
		"book-delta-proposal.json": generateBookDeltaProposalJsonSchema(),
		"book-delta-artifact.json": generateBookDeltaArtifactJsonSchema(),
		"book-delta-evaluation.json":
			generateBookDeltaEvaluationResultJsonSchema(),
		"book-delta-knowledge-continuity.json":
			generateBookDeltaKnowledgeContinuityJsonSchema(),
	};
}

/**
 * Write all JSON schemas to the data/schemas directory.
 */
export async function writeBookDeltaJsonSchemas(): Promise<void> {
	const { promises: fs } = await import("node:fs");
	const { join } = await import("node:path");
	const { fileURLToPath } = await import("node:url");

	const __dirname = join(fileURLToPath(import.meta.url), "..");
	const schemasDir = join(__dirname, "..", "..", "..", "data", "schemas");

	const schemas = await generateAllBookDeltaJsonSchemas();

	for (const [filename, schema] of Object.entries(schemas)) {
		const filepath = join(schemasDir, filename);
		await fs.writeFile(filepath, JSON.stringify(schema, null, 2), "utf8");
	}
}

/**
 * Validate that a proposal ID matches the expected pattern.
 */
export function isValidProposalId(id: string): boolean {
	return BOOK_DELTA_ID_PATTERNS.proposal.test(id);
}

/**
 * Validate that an artifact ID matches the expected pattern.
 */
export function isValidArtifactId(id: string): boolean {
	return BOOK_DELTA_ID_PATTERNS.artifact.test(id);
}

/**
 * Validate that an edition date matches the expected pattern.
 */
export function isValidEditionDate(date: string): boolean {
	return BOOK_DELTA_ID_PATTERNS.editionDate.test(date);
}

/**
 * Validate that an edition ID matches the expected pattern.
 */
export function isValidEditionId(id: string): boolean {
	return BOOK_DELTA_ID_PATTERNS.edition.test(id);
}

/**
 * Validate that a claim ID matches the expected pattern.
 */
export function isValidClaimId(id: string): boolean {
	return BOOK_DELTA_ID_PATTERNS.claim.test(id);
}

/**
 * Validate that a candidate ID matches the expected pattern.
 */
export function isValidCandidateId(id: string): boolean {
	return BOOK_DELTA_ID_PATTERNS.candidate.test(id);
}

/**
 * Validate that a thesaurus entry ID matches the expected pattern.
 */
export function isValidThesaurusEntryId(id: string): boolean {
	return BOOK_DELTA_ID_PATTERNS.thesaurusEntry.test(id);
}

/**
 * Validate that an architecture principle ID matches the expected pattern.
 */
export function isValidPrincipleId(id: string): boolean {
	return BOOK_DELTA_ID_PATTERNS.principle.test(id);
}

/**
 * Validate proposal lifecycle transition.
 * Enforces valid state transitions.
 */
export function validateLifecycleTransition(
	currentStatus: string,
	newStatus: string,
): { valid: boolean; reason?: string } {
	const validTransitions: Record<string, string[]> = {
		CANDIDATE: ["READY_FOR_REVIEW", "REJECTED", "SUPERSEDED"],
		READY_FOR_REVIEW: ["APPROVED", "REJECTED", "CANDIDATE", "SUPERSEDED"],
		APPROVED: ["IMPLEMENTED", "REJECTED", "SUPERSEDED"],
		REJECTED: ["CANDIDATE", "SUPERSEDED"],
		SUPERSEDED: [],
		IMPLEMENTED: ["VALIDATED", "SUPERSEDED"],
		VALIDATED: ["SUPERSEDED"],
	};

	const allowed = validTransitions[currentStatus] || [];
	if (!allowed.includes(newStatus)) {
		return {
			valid: false,
			reason: `Invalid lifecycle transition from ${currentStatus} to ${newStatus}. Allowed: ${allowed.join(", ") || "none"}`,
		};
	}
	return { valid: true };
}

/**
 * Validate proposal completeness for review readiness.
 */
export function validateProposalForReview(proposal: BookDeltaProposal): {
	ready: boolean;
	missing: string[];
} {
	const missing: string[] = [];

	if (!proposal.title.en || !proposal.title.nl)
		missing.push("bilingual title");
	if (!proposal.currentGap.en || !proposal.currentGap.nl)
		missing.push("bilingual current gap");
	if (!proposal.proposedChange.en || !proposal.proposedChange.nl)
		missing.push("bilingual proposed change");
	if (!proposal.rationale.en || !proposal.rationale.nl)
		missing.push("bilingual rationale");
	if (proposal.supportingClaimIds.length === 0)
		missing.push("supporting claim IDs");
	if (proposal.originalSources.length === 0) missing.push("original sources");
	if (proposal.acceptanceCriteria.length === 0)
		missing.push("acceptance criteria");
	if (proposal.confidence < 0.5) missing.push("sufficient confidence (≥0.5)");
	if (proposal.materialUncertainty === "speculative")
		missing.push("non-speculative material uncertainty");

	return {
		ready: missing.length === 0,
		missing,
	};
}

/**
 * Check if a proposal has all required evidence references.
 */
export function validateProposalEvidenceReferences(
	proposal: BookDeltaProposal,
): { valid: boolean; issues: string[] } {
	const issues: string[] = [];

	// Check that all supporting claim IDs follow the pattern
	for (const claimId of proposal.supportingClaimIds) {
		if (!isValidClaimId(claimId)) {
			issues.push(`Invalid claim ID format: ${claimId}`);
		}
	}

	// Check that all terminology references follow the pattern
	for (const termRef of proposal.terminologyReferences) {
		if (!isValidThesaurusEntryId(termRef.entryId)) {
			issues.push(`Invalid thesaurus entry ID: ${termRef.entryId}`);
		}
	}

	// Check that all principle references follow the pattern
	for (const prinRef of proposal.principleReferences) {
		if (!isValidPrincipleId(prinRef.principleId)) {
			issues.push(`Invalid principle ID: ${prinRef.principleId}`);
		}
	}

	// Check that all historical proposal references follow the pattern
	for (const histRef of proposal.historicalProposalReferences) {
		if (!isValidProposalId(histRef.proposalId)) {
			issues.push(
				`Invalid historical proposal ID: ${histRef.proposalId}`,
			);
		}
	}

	return {
		valid: issues.length === 0,
		issues,
	};
}
