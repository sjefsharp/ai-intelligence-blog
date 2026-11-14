/**
 * Canonical Fact Dossier — Deterministic Serialization & Content Hashing
 *
 * The dossier is persisted as JSON and must be byte-for-byte reproducible for
 * the same factual content. Object keys are sorted recursively; arrays are
 * expected to be placed in a deterministic order by the builder (identifier
 * order for sets, processing order for pipelines). The content hash is
 * computed over the canonical form, excluding the hash fields themselves.
 */

import crypto from "crypto";

/**
 * Recursively sort object keys. Arrays are preserved (the builder is
 * responsible for placing array elements in deterministic order).
 */
export function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(canonicalize);
	}
	if (value !== null && typeof value === "object") {
		const source = value as Record<string, unknown>;
		const sorted: Record<string, unknown> = {};
		for (const key of Object.keys(source).sort()) {
			sorted[key] = canonicalize(source[key]);
		}
		return sorted;
	}
	return value;
}

/** Deterministic compact JSON representation. */
export function canonicalJson(value: unknown): string {
	return JSON.stringify(canonicalize(value));
}

/** Deterministic pretty JSON representation (used for on-disk persistence). */
export function canonicalPrettyJson(value: unknown): string {
	return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

/** SHA-256 hash of the canonical compact JSON. */
export function sha256Canonical(value: unknown): string {
	return `sha256:${crypto.createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

/**
 * Compute the content hash for a dossier.
 *
 * The hash covers the factual content only. `contentHash` and
 * `previousVersionHash` are excluded so that the hash identifies the factual
 * state of the edition rather than its position in a version chain.
 */
export function computeDossierContentHash(dossier: {
	contentHash?: string;
	previousVersionHash?: string;
	[key: string]: unknown;
}): string {
	const {
		contentHash: _contentHash,
		previousVersionHash: _previousVersionHash,
		...rest
	} = dossier;
	return sha256Canonical(rest);
}

/**
 * Verify that a dossier's stored content hash matches its content.
 */
export function verifyDossierContentHash(dossier: {
	contentHash: string;
	previousVersionHash?: string;
	[key: string]: unknown;
}): boolean {
	return computeDossierContentHash(dossier) === dossier.contentHash;
}
