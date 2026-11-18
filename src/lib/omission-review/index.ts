/**
 * Omission Review — Module Exports
 *
 * Second discovery and omission-detection stage for the AI Intelligence pipeline.
 */

export * from "./types.js";
export * from "./engine.js";

import { createOmissionReviewEngine } from "./engine.js";

/**
 * Execute the omission review.
 * Entry point for workflow stage C04_OMISSION_REVIEW.
 */
export async function executeOmissionReview(input: any): Promise<any> {
	// Build the expected input structure from workflow artifacts
	const canonicalDossier =
		input["canonical-fact-dossier"] || input.canonicalDossier || input;
	const discoveryLedger =
		input["complete-discovery-ledger"] || input.discoveryLedger || {};
	const sourceRegistry =
		input["validated-source-registry"] || input.sourceRegistry;

	// Ensure discoveryLedgerRecords is an array
	const discoveryLedgerRecords = Array.isArray(discoveryLedger.records)
		? discoveryLedger.records
		: Array.isArray(discoveryLedger.entries)
			? discoveryLedger.entries
			: Array.isArray(discoveryLedger.items)
				? discoveryLedger.items
				: [];

	const omissionInput = {
		editionDate: input.editionDate,
		canonicalDossier: {
			dossierId:
				canonicalDossier.dossierId ||
				`fd_${canonicalDossier.editionDate || input.editionDate}`,
			candidates: Array.isArray(canonicalDossier.candidates)
				? canonicalDossier.candidates
				: [],
			editionDate: canonicalDossier.editionDate || input.editionDate,
		},
		discoveryLedgerRecords,
		sourceRegistry:
			sourceRegistry instanceof Map ? sourceRegistry : new Map(),
		gitCommit: input.gitCommit,
		reviewerId: input.reviewerId,
	};

	const engine = createOmissionReviewEngine();
	return engine.execute(omissionInput);
}
