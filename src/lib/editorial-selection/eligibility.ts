/**
 * Editorial Selection — Eligibility Gate
 *
 * Deterministic eligibility evaluation that consumes the authoritative upstream
 * results. This stage never re-decides novelty and never re-verifies claims:
 * it reads the inherited temporal eligibility gate, the inherited evidence
 * classifications, the omission review report and the historical regression
 * report, and records an explicit eligibility state with reasons.
 *
 * Gates applied (specification §2):
 * - Temporal novelty: material new information first disclosed inside the exact
 *   05:00–05:00 Europe/Amsterdam edition window.
 * - Evidence sufficiency: the candidate has sufficient evidence to support its
 *   material claims.
 * - Novelty statement: the exact statement identifies what actually changed.
 * - Historical comparison: distinguishes new facts from repeated reporting.
 * - Uncertainty: critical uncertainties and evidence limitations are explicit.
 * - Duplicates: the candidate is not an unresolved duplicate.
 * - Omission review: significant findings are incorporated or explicitly flagged.
 *
 * Credible original investigative reporting is NOT excluded merely because
 * official first-party confirmation is absent: ORIGINAL_REPORTING and
 * EXPERT_INTERPRETATION with traceable evidence remain eligible, with their
 * uncertainty surfaced.
 */

import type {
	CanonicalCandidate,
	ConsolidatedClaim,
} from "../fact-dossier/schema.js";
import type { HistoricalRelationship } from "../historical-regression/schema.js";
import type { OmissionReviewReport } from "../omission-review/types.js";
import {
	type EditorialEligibility,
	type EditorialEligibilityState,
	type EvidenceSufficiency,
} from "./schema.js";
import { normalizeStatement, normalizeUrl } from "./similarity.js";

/** Classifications that can support a material claim without independent verification. */
const STRONG_CLASSIFICATIONS = new Set([
	"VERIFIED_FACT",
	"RESEARCH_FINDING",
	"ORIGINAL_REPORTING",
]);

/** Classifications that remain eligible when traceable evidence is present. */
const ADEQUATE_CLASSIFICATIONS = new Set([
	"VERIFIED_FACT",
	"RESEARCH_FINDING",
	"ORIGINAL_REPORTING",
	"VENDOR_CLAIM",
	"EXPERT_INTERPRETATION",
]);

export interface EligibilityContext {
	/** All candidates in the edition dossier (used for duplicate detection). */
	allCandidates: CanonicalCandidate[];
	/** Historical regression relationships keyed by candidate identifier. */
	historicalRelationships: Map<string, HistoricalRelationship>;
	/** Omission review report for the edition, when available. */
	omissionReview: OmissionReviewReport | null;
}

/**
 * Determine whether the candidate's material claims have sufficient evidence.
 * Evidence classifications are inherited from the verification pipeline and
 * are never re-decided here.
 */
export function computeEvidenceSufficiency(
	candidate: CanonicalCandidate,
): EvidenceSufficiency {
	const claims = candidate.claims;
	if (claims.length === 0) return "WEAK";

	const hasTraceableEvidence = (claim: ConsolidatedClaim) =>
		claim.supportingEvidenceUrls.length > 0;

	const strong = claims.some(
		(claim) =>
			STRONG_CLASSIFICATIONS.has(claim.evidenceClassification) &&
			hasTraceableEvidence(claim) &&
			(claim.verificationLevel !== "L0" ||
				claim.independentCorroboration?.established === true),
	);
	if (strong) return "STRONG";

	const adequate = claims.some(
		(claim) =>
			ADEQUATE_CLASSIFICATIONS.has(claim.evidenceClassification) &&
			hasTraceableEvidence(claim),
	);
	if (adequate) return "ADEQUATE";

	return "WEAK";
}

/** Whether any claim carries a blocking unresolved uncertainty. */
export function hasBlockingUncertainty(candidate: CanonicalCandidate): boolean {
	return candidate.claims.some((claim) =>
		claim.uncertainty.unresolved.some(
			(uncertainty) => uncertainty.blocking,
		),
	);
}

/**
 * Whether the exact statement identifies what actually changed beyond the
 * headline. A statement that merely repeats the headline does not satisfy the
 * novelty-statement gate.
 */
export function hasNoveltyStatement(candidate: CanonicalCandidate): boolean {
	const statement = candidate.exactStatement.trim();
	const headline = candidate.factualHeadline.trim();
	if (statement.length < 20) return false;
	return normalizeStatement(statement) !== normalizeStatement(headline);
}

/**
 * Detect UNRESOLVED duplicates within one edition. A candidate is an unresolved
 * duplicate when it describes the same source document and the same material as
 * another candidate with no determinable primary — identical normalized exact
 * statement and identical publication timestamp.
 *
 * Resolved duplicates (same document with a determinable primary, for example
 * through distinct publication timestamps) are handled by the merge model, not
 * by this gate. Independent findings concerning the same vendor or topic are
 * never treated as duplicates.
 */
export function detectDuplicates(
	candidates: CanonicalCandidate[],
): Map<string, string> {
	const duplicates = new Map<string, string>();
	const sorted = [...candidates].sort((a, b) =>
		a.candidateId.localeCompare(b.candidateId),
	);

	for (let i = 0; i < sorted.length; i++) {
		for (let j = i + 1; j < sorted.length; j++) {
			const first = sorted[i];
			const second = sorted[j];
			if (
				duplicates.has(first.candidateId) ||
				duplicates.has(second.candidateId)
			)
				continue;
			if (isUnresolvedDuplicate(first, second)) {
				duplicates.set(second.candidateId, first.candidateId);
			}
		}
	}
	return duplicates;
}

function isUnresolvedDuplicate(
	a: CanonicalCandidate,
	b: CanonicalCandidate,
): boolean {
	const aUrls = new Set(
		a.sources.map((source) => normalizeUrl(source.canonicalUrl)),
	);
	const bUrls = new Set(
		b.sources.map((source) => normalizeUrl(source.canonicalUrl)),
	);
	const sharesUrl = [...aUrls].some((url) => bUrls.has(url));
	if (!sharesUrl) return false;

	const sameStatement =
		normalizeStatement(a.exactStatement) ===
		normalizeStatement(b.exactStatement);
	if (!sameStatement) return false;

	return (
		a.timestamps.originalPublicationTimestamp ===
		b.timestamps.originalPublicationTimestamp
	);
}

/** Collect omission-review findings that must be incorporated or explicitly flagged. */
export function collectOmissionReviewFlags(
	candidateId: string,
	report: OmissionReviewReport | null,
): string[] {
	if (!report) return [];
	const flags: string[] = [];

	for (const update of report.substantiveUpdates) {
		if (update.existingCandidateId === candidateId) {
			flags.push(
				`Omission review recorded a substantive update: ${update.updateTitle} ` +
					`(${update.newlyRevealedFacts.length} newly revealed fact(s)).`,
			);
		}
	}

	for (const repair of report.criticalAndMaterialOmissionsRepaired) {
		if (
			repair.candidateId === candidateId &&
			repair.repairAction === "UNRESOLVED"
		) {
			flags.push(
				"Omission review left a critical/material omission repair unresolved.",
			);
		}
	}

	const blockingGaps = report.remainingCoverageGaps.filter(
		(gap) => gap.significance === "critical" || gap.significance === "high",
	);
	if (blockingGaps.length > 0) {
		flags.push(
			`${blockingGaps.length} blocking or critical omission-review coverage gap(s) remain: ` +
				blockingGaps.map((gap) => gap.description).join(" | "),
		);
	}

	return [...new Set(flags)].sort();
}

/**
 * Evaluate one candidate's editorial eligibility from authoritative upstream
 * results. Pure and deterministic.
 */
export function evaluateEligibility(
	candidate: CanonicalCandidate,
	context: EligibilityContext,
): EditorialEligibility {
	const temporalStatus = candidate.temporalEligibility.status;
	const evidenceSufficiency = computeEvidenceSufficiency(candidate);
	const blocking = hasBlockingUncertainty(candidate);
	const noveltyStatementPresent = hasNoveltyStatement(candidate);
	const historicalRelationship = context.historicalRelationships.get(
		candidate.candidateId,
	);
	const omissionReviewFlags = collectOmissionReviewFlags(
		candidate.candidateId,
		context.omissionReview,
	);
	const duplicateOf = detectDuplicates(context.allCandidates).get(
		candidate.candidateId,
	);

	const reasons: string[] = [];
	const traceableTo = [
		candidate.candidateId,
		"novelty-classification",
		...candidate.claims.map((claim) => claim.claimId),
		...candidate.sources.map((source) => source.sourceId),
	];

	let state: EditorialEligibilityState;

	if (temporalStatus === "NEW_FAIL") {
		state = "INELIGIBLE_TEMPORAL";
		reasons.push(
			"In-window item identified by the authoritative novelty classifier as a repost/summary of established information.",
		);
	} else if (temporalStatus === "TIME_UNVERIFIED") {
		state = "INELIGIBLE_TEMPORAL";
		reasons.push(
			"Publication/disclosure time could not be verified by the authoritative novelty classifier.",
		);
	} else if (duplicateOf) {
		state = "INELIGIBLE_DUPLICATE";
		reasons.push(`Unresolved duplicate of candidate ${duplicateOf}.`);
	} else if (evidenceSufficiency === "WEAK") {
		state = "INELIGIBLE_EVIDENCE";
		reasons.push(
			"No claim reaches adequate evidence sufficiency; material claims rest on inference, speculation or unverified assertions.",
		);
	} else if (temporalStatus === "CATCH_UP") {
		state = "ELIGIBLE_CATCH_UP";
		reasons.push(
			"Explicitly dated older material with traceable evidence; eligible only as dated catch-up.",
		);
	} else {
		state = "ELIGIBLE";
		reasons.push(
			"Passes temporal, evidence, novelty-statement and duplicate gates.",
		);
	}

	if (!noveltyStatementPresent) {
		reasons.push(
			"Exact statement does not clearly identify what materially changed beyond the headline.",
		);
		if (state === "ELIGIBLE") state = "CONDITIONAL";
	}

	if (state === "ELIGIBLE" && (blocking || omissionReviewFlags.length > 0)) {
		state = "CONDITIONAL";
		reasons.push(
			"Passes hard gates but carries flagged uncertainty that must be surfaced.",
		);
	}

	if (blocking) {
		reasons.push(
			"At least one claim carries a blocking unresolved uncertainty.",
		);
	}

	if (historicalRelationship) {
		traceableTo.push(
			`historical-regression:${historicalRelationship.candidateId}`,
		);
		switch (historicalRelationship.classification) {
			case "REPEATED_REPORTING":
				reasons.push(
					"Historical regression classifies this as repeated reporting of established information.",
				);
				break;
			case "PREVIOUSLY_COVERED":
				reasons.push(
					"Historical regression classifies this as previously covered material without a qualifying change.",
				);
				break;
			case "SUBSTANTIVE_UPDATE":
				reasons.push(
					"Historical regression identifies a substantive update with qualifying new material.",
				);
				break;
			case "HISTORY_UNVERIFIED":
				reasons.push(
					"Historical regression could not establish a reliable relationship; historical overlap remains uncertain.",
				);
				break;
			case "POTENTIAL_HISTORICAL_OMISSION":
				reasons.push(
					"Historical regression suggests an earlier edition may have missed this development.",
				);
				break;
			case "RELATED_CONTEXT":
				reasons.push(
					"Historical regression treats this as related background context.",
				);
				break;
			case "NEW_DEVELOPMENT":
				reasons.push(
					"Historical regression identifies no established equivalent in accessible history.",
				);
				break;
		}
	}

	return {
		candidateId: candidate.candidateId,
		state,
		temporalStatus,
		evidenceSufficiency,
		hasBlockingUncertainty: blocking,
		noveltyStatementPresent,
		historicalRelationship: historicalRelationship?.classification,
		historicalConfidence: historicalRelationship?.confidence,
		omissionReviewFlags,
		duplicateOf,
		reasons: [...new Set(reasons)].sort(),
		traceableTo: [...new Set(traceableTo)].sort(),
	};
}

/**
 * Evaluate eligibility for every candidate in an edition. Returns assessments
 * keyed by candidate identifier along with the duplicate map.
 */
export function evaluateEligibilityForEdition(
	candidates: CanonicalCandidate[],
	context: Omit<EligibilityContext, "allCandidates">,
): {
	eligibility: Map<string, EditorialEligibility>;
	duplicates: Map<string, string>;
} {
	const duplicates = detectDuplicates(candidates);
	const fullContext: EligibilityContext = {
		...context,
		allCandidates: candidates,
	};
	const eligibility = new Map<string, EditorialEligibility>();
	for (const candidate of candidates) {
		eligibility.set(
			candidate.candidateId,
			evaluateEligibility(candidate, fullContext),
		);
	}
	return { eligibility, duplicates };
}
