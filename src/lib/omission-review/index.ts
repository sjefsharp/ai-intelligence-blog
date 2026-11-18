/**
 * Omission Review — Module Exports
 *
 * Second discovery and omission-detection stage for the AI Intelligence pipeline.
 */

export * from "./types.js";
export * from "./engine.js";

import { createOmissionReviewEngine } from "./engine.js";
import { FACT_DOSSIER_SCHEMA_VERSION } from "../fact-dossier/schema.js";

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

	// Build a complete CanonicalFactDossier object with all required fields
	const editionDate = canonicalDossier.editionDate || input.editionDate;
	const now = new Date().toISOString();
	const editionWindow = {
		editionDate,
		start:
			canonicalDossier.editionWindow?.start ||
			`${editionDate}T05:00:00+01:00[Europe/Amsterdam]`,
		end:
			canonicalDossier.editionWindow?.end ||
			`${editionDate}T05:00:00+01:00[Europe/Amsterdam]`,
		timezone: "Europe/Amsterdam",
		durationHours: 24,
	};

	const fullCanonicalDossier = {
		schemaVersion: FACT_DOSSIER_SCHEMA_VERSION as "1.0.0",
		dossierId: canonicalDossier.dossierId || `fd_${editionDate}`,
		editionId: `edition_${editionDate}`,
		editionDate,
		editionWindow,
		status: canonicalDossier.status || "ready-for-omission-review",
		createdAt: canonicalDossier.createdAt || now,
		updatedAt: canonicalDossier.updatedAt || now,
		generatedBy: canonicalDossier.generatedBy || "omission-review",
		candidates: Array.isArray(canonicalDossier.candidates)
			? canonicalDossier.candidates
			: [],
		editionSummary: canonicalDossier.editionSummary || {
			totalCandidates: 0,
			byTemporalEligibility: {},
			byEvidenceClassification: {},
			byVerificationStatus: {},
			byResearchDomain: {},
			totalClaims: 0,
			claimsWithCounterevidence: 0,
			claimsWithUnresolvedUncertainties: 0,
			candidatesWithEvidenceGaps: 0,
			averageClaimConfidence: 0,
			strategicResearchCandidates: 0,
			technicalCandidates: 0,
		},
		uncertaintyRegister: canonicalDossier.uncertaintyRegister || [],
		historicalContinuity: canonicalDossier.historicalContinuity || [],
		processingAudit: canonicalDossier.processingAudit || {
			startedAt: now,
			completedAt: now,
			durationMs: 0,
			steps: [],
			completedCandidateIds: [],
			failedCandidateIds: [],
			skippedCandidateIds: [],
			inferenceUsed: false,
			inferenceNote:
				"No model inference was required for deterministic consolidation.",
		},
		contentHash: canonicalDossier.contentHash || `sha256:${Date.now()}`,
		previousVersionHash: canonicalDossier.previousVersionHash,
	};

	const omissionInput = {
		editionDate: input.editionDate,
		canonicalDossier: fullCanonicalDossier,
		discoveryLedgerRecords,
		sourceRegistry:
			sourceRegistry instanceof Map ? sourceRegistry : new Map(),
		gitCommit: input.gitCommit,
		reviewerId: input.reviewerId,
	};

	const engine = createOmissionReviewEngine();
	return engine.execute(omissionInput);
}
