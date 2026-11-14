/**
 * Canonical Fact Dossier — Validation
 *
 * Validates a dossier against the versioned Zod schema and enforces the
 * invariants that protect the dossier's role as the single source of factual
 * truth:
 * - identifier integrity and uniqueness,
 * - source-to-claim traceability,
 * - preservation of original evidence URLs,
 * - publication / disclosure / event timestamp distinctions,
 * - accurate inheritance of novelty classifications,
 * - preservation of evidence classifications,
 * - prevention of unsupported factual promotion,
 * - editorial readiness traceability,
 * - edition summary consistency,
 * - content hash integrity.
 */

import {
	CanonicalFactDossierSchema,
	type CanonicalFactDossier,
	type CanonicalCandidate,
	type ConsolidatedClaim,
	type TemporalEligibilityStatus,
} from "./schema.js";
import { canonicalJson, verifyDossierContentHash } from "./canonical.js";

export interface ValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
}

/** Classifications that must never be presented as independently verified facts. */
const UNVERIFIED_CLASSIFICATIONS = new Set([
	"VENDOR_CLAIM",
	"INFERENCE",
	"SPECULATION",
	"UNVERIFIED",
]);

/** Classifications allowed to carry a 'verified' status. */
const VERIFIED_STATUS_CLASSIFICATIONS = new Set([
	"VERIFIED_FACT",
	"RESEARCH_FINDING",
	"ORIGINAL_REPORTING",
]);

function expectedEligibilityStatus(
	candidate: CanonicalCandidate,
): TemporalEligibilityStatus {
	const nc = candidate.temporalEligibility.noveltyClassification;
	if (nc.isRepostOrSummary && nc.inWindow) {
		return "NEW_FAIL";
	}
	switch (nc.classification) {
		case "NEW":
			return "NEW_PASS";
		case "CATCH_UP":
			return "CATCH_UP";
		case "TIME_UNVERIFIED":
			return "TIME_UNVERIFIED";
	}
}

function validateCandidate(
	candidate: CanonicalCandidate,
	dossier: CanonicalFactDossier,
	errors: string[],
	warnings: string[],
): void {
	const candidateIds = new Set(dossier.candidates.map((c) => c.candidateId));
	const allClaimIds = new Set(
		dossier.candidates.flatMap((c) => c.claims.map((cl) => cl.claimId)),
	);
	const allSourceIds = new Set(
		dossier.candidates.flatMap((c) => c.sources.map((s) => s.sourceId)),
	);

	// --- Sources -----------------------------------------------------------
	const sourceIds = new Set<string>();
	for (const source of candidate.sources) {
		if (sourceIds.has(source.sourceId)) {
			errors.push(
				`Candidate ${candidate.candidateId}: duplicate sourceId ${source.sourceId}`,
			);
		}
		sourceIds.add(source.sourceId);
		if (!source.canonicalUrl) {
			errors.push(
				`Candidate ${candidate.candidateId}: source ${source.sourceId} has no canonical URL`,
			);
		}
		if (source.discoveryIds.length === 0) {
			warnings.push(
				`Candidate ${candidate.candidateId}: source ${source.sourceId} has no discovery ID link`,
			);
		}
	}

	// --- Timestamp distinctions -------------------------------------------
	const ts = candidate.timestamps;
	if (ts.timestampAvailability === "unavailable") {
		warnings.push(
			`Candidate ${candidate.candidateId}: original publication timestamp unavailable; temporal eligibility is uncertain`,
		);
	}
	// Note: publication and first-disclosure timestamps MAY legitimately be equal
	// for originator sources. The dossier keeps them as distinct fields so the
	// distinction is never collapsed; equality alone is not an error.

	// --- Temporal eligibility inheritance ---------------------------------
	const expectedStatus = expectedEligibilityStatus(candidate);
	if (candidate.temporalEligibility.status !== expectedStatus) {
		errors.push(
			`Candidate ${candidate.candidateId}: temporal eligibility ${candidate.temporalEligibility.status} ` +
				`does not match inherited novelty classification ${candidate.temporalEligibility.noveltyClassification.classification} ` +
				`(expected ${expectedStatus})`,
		);
	}
	if (
		candidate.temporalEligibility.derivedFrom !== "novelty-classification"
	) {
		errors.push(
			`Candidate ${candidate.candidateId}: temporal eligibility must be derived from novelty-classification`,
		);
	}

	// --- Claims ------------------------------------------------------------
	for (const claim of candidate.claims) {
		if (claim.candidateId !== candidate.candidateId) {
			errors.push(
				`Claim ${claim.claimId}: candidateId ${claim.candidateId} does not match containing candidate ${candidate.candidateId}`,
			);
		}
		if (claim.supportingEvidenceUrls.length === 0) {
			warnings.push(
				`Claim ${claim.claimId}: no supporting evidence URLs recorded`,
			);
		}

		// Prevention of unsupported factual promotion.
		if (UNVERIFIED_CLASSIFICATIONS.has(claim.evidenceClassification)) {
			if (claim.verificationLevel !== "L0") {
				errors.push(
					`Claim ${claim.claimId}: classification ${claim.evidenceClassification} must not claim verification level ${claim.verificationLevel}`,
				);
			}
			if (
				claim.verificationStatus === "verified" ||
				claim.verificationStatus === "partially-verified"
			) {
				errors.push(
					`Claim ${claim.claimId}: classification ${claim.evidenceClassification} must not be marked '${claim.verificationStatus}'`,
				);
			}
			if (/verified fact/i.test(claim.inclusionNote)) {
				errors.push(
					`Claim ${claim.claimId}: inclusion note promotes an unverified classification to a verified fact`,
				);
			}
		}
		if (
			claim.verificationStatus === "verified" &&
			!VERIFIED_STATUS_CLASSIFICATIONS.has(claim.evidenceClassification)
		) {
			errors.push(
				`Claim ${claim.claimId}: verification status 'verified' requires classification VERIFIED_FACT, RESEARCH_FINDING or ORIGINAL_REPORTING`,
			);
		}

		// Contradictory evidence must be reflected in uncertainty.
		if (
			claim.contradictoryEvidence.length > 0 &&
			claim.uncertainty.unresolved.length === 0
		) {
			errors.push(
				`Claim ${claim.claimId}: contradictory evidence present but no unresolved uncertainty recorded`,
			);
		}
	}

	// --- Editorial readiness traceability ---------------------------------
	const knownIds = new Set([
		candidate.candidateId,
		...candidate.claims.map((c) => c.claimId),
		...candidate.sources.map((s) => s.sourceId),
		"novelty-classification",
	]);
	for (const [key, value] of Object.entries(candidate.editorialReadiness)) {
		if (key === "selectionNote") continue;
		const indicator = value as { traceableTo: string[] };
		for (const ref of indicator.traceableTo) {
			if (
				!knownIds.has(ref) &&
				!allClaimIds.has(ref) &&
				!allSourceIds.has(ref) &&
				!candidateIds.has(ref)
			) {
				warnings.push(
					`Candidate ${candidate.candidateId}: indicator '${key}' traceableTo unknown id '${ref}'`,
				);
			}
		}
	}
}

/**
 * Validate a canonical fact dossier.
 */
export function validateFactDossier(dossier: unknown): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	const parsed = CanonicalFactDossierSchema.safeParse(dossier);
	if (!parsed.success) {
		for (const issue of parsed.error.issues) {
			errors.push(
				`${issue.path.join(".") || "<root>"}: ${issue.message}`,
			);
		}
		return { valid: false, errors, warnings };
	}

	const d = parsed.data as CanonicalFactDossier;

	// --- Identifier integrity ---------------------------------------------
	const candidateIds: string[] = [];
	const claimIds: string[] = [];
	for (const candidate of d.candidates) {
		candidateIds.push(candidate.candidateId);
		for (const claim of candidate.claims) {
			claimIds.push(claim.claimId);
		}
	}
	if (new Set(candidateIds).size !== candidateIds.length) {
		errors.push("Duplicate candidate identifiers in dossier");
	}
	if (new Set(claimIds).size !== claimIds.length) {
		errors.push("Duplicate claim identifiers in dossier");
	}

	for (const candidate of d.candidates) {
		validateCandidate(candidate, d, errors, warnings);
	}

	// --- Edition summary consistency --------------------------------------
	const totalClaims = d.candidates.reduce(
		(sum, c) => sum + c.claims.length,
		0,
	);
	if (d.editionSummary.totalCandidates !== d.candidates.length) {
		errors.push(
			`Edition summary totalCandidates ${d.editionSummary.totalCandidates} does not match ${d.candidates.length} candidates`,
		);
	}
	if (d.editionSummary.totalClaims !== totalClaims) {
		errors.push(
			`Edition summary totalClaims ${d.editionSummary.totalClaims} does not match ${totalClaims} claims`,
		);
	}
	const claimsWithCounterevidence = d.candidates.reduce(
		(sum, c) =>
			sum +
			c.claims.filter((cl) => cl.contradictoryEvidence.length > 0).length,
		0,
	);
	if (
		d.editionSummary.claimsWithCounterevidence !== claimsWithCounterevidence
	) {
		errors.push(
			"Edition summary claimsWithCounterevidence does not match the candidate records",
		);
	}

	// --- Historical continuity --------------------------------------------
	for (const record of d.historicalContinuity) {
		if (!candidateIds.includes(record.candidateId)) {
			errors.push(
				`Historical continuity references unknown candidate ${record.candidateId}`,
			);
		}
		if (record.missingEditions.length === 0 && !record.note) {
			warnings.push(
				`Historical continuity for ${record.candidateId} has no note`,
			);
		}
	}

	// --- Content hash ------------------------------------------------------
	if (!verifyDossierContentHash(d)) {
		errors.push("contentHash does not match the canonical dossier content");
	}

	// --- Deterministic serialization --------------------------------------
	const canonical = canonicalJson(d);
	if (canonicalJson(JSON.parse(canonical)) !== canonical) {
		errors.push(
			"Dossier is not canonically serializable (round-trip instability)",
		);
	}

	return { valid: errors.length === 0, errors, warnings };
}
