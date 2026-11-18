/**
 * Editorial Selection — Decision Model
 *
 * Applies the explicit editorial decision model (specification §8) to each
 * candidate after eligibility and dimension assessment:
 *
 * - SELECTED: eligible, sufficiently evidenced and materially important.
 * - MERGED: covered within another selected story, provenance preserved.
 * - EXCLUDED_LOW_MATERIALITY: eligible but insufficiently consequential.
 * - EXCLUDED_REPEATED: no qualifying new material information.
 * - EXCLUDED_TEMPORAL: fails the authoritative novelty eligibility gate.
 * - DEFERRED_UNVERIFIED: potentially important but blocked by unresolved
 *   critical evidence or timing.
 * - CATCH_UP_SELECTED: older development explicitly selected as dated catch-up.
 * - REVIEW_REQUIRED: consequential candidate with an unresolved editorial or
 *   evidence decision.
 *
 * Upstream evidence and classifications remain the authority for factual
 * eligibility. No arbitrary story-count limits are applied: on quiet days fewer
 * stories are selected rather than filling the edition with stale material.
 */

import type {
	CanonicalCandidate,
	ReadinessLevel,
} from "../fact-dossier/schema.js";
import type { HistoricalRelationship } from "../historical-regression/schema.js";
import type { EditorialSelectionConfig } from "./config.js";
import { assessDimensions, computeMateriality } from "./dimensions.js";
import type {
	EditorialCandidateAssessment,
	EditorialDecision,
	EditorialDimensionAssessment,
	EditorialEligibility,
} from "./schema.js";

export interface DecisionContext {
	config: EditorialSelectionConfig;
	historicalRelationships: Map<string, HistoricalRelationship>;
	mergeGroups: Map<string, string>;
	now: string;
}

export interface DecisionInfo {
	decision: EditorialDecision;
	reasons: string[];
	reviewReason?: string;
	catchUpReason?: string;
}

export interface MaterialityInfo {
	dimensions: EditorialDimensionAssessment[];
	score: number;
	level: ReadinessLevel;
}

/**
 * Assess dimensions and compute the documented materiality heuristic.
 * Phase 1 of the two-phase assessment (merge detection needs materiality).
 */
export function assessMateriality(
	candidate: CanonicalCandidate,
	eligibility: EditorialEligibility,
	historicalRelationship: HistoricalRelationship | undefined,
	config: EditorialSelectionConfig,
): MaterialityInfo {
	const dimensions = assessDimensions(
		candidate,
		eligibility,
		historicalRelationship,
	);
	const { score, level } = computeMateriality(dimensions, config);
	return { dimensions, score, level };
}

/**
 * Apply the explicit decision model. Phase 2, after merge detection.
 */
export function decideCandidate(
	candidate: CanonicalCandidate,
	eligibility: EditorialEligibility,
	historicalRelationship: HistoricalRelationship | undefined,
	materiality: number,
	potentialMateriality: number,
	mergeGroups: Map<string, string>,
	selectedIds: Set<string>,
	config: EditorialSelectionConfig,
): DecisionInfo {
	const reasons: string[] = [];
	const novelty = candidate.temporalEligibility.noveltyClassification;

	// --- 1. Unresolved duplicate -------------------------------------------
	if (eligibility.state === "INELIGIBLE_DUPLICATE") {
		reasons.push(
			`Unresolved duplicate of candidate ${eligibility.duplicateOf}.`,
		);
		return { decision: "EXCLUDED_REPEATED", reasons };
	}

	// --- 2. Authoritative historical repetition ----------------------------
	if (
		historicalRelationship?.classification === "REPEATED_REPORTING" ||
		(historicalRelationship?.classification === "PREVIOUSLY_COVERED" &&
			!novelty.isSubstantiveUpdate &&
			!novelty.isNewlyRevealedFact)
	) {
		reasons.push(
			historicalRelationship!.classification === "REPEATED_REPORTING"
				? "Historical regression classifies this as repeated reporting of established information."
				: "Historical regression classifies this as previously covered material without a qualifying change.",
		);
		return { decision: "EXCLUDED_REPEATED", reasons };
	}

	// --- 3. Temporal gate ---------------------------------------------------
	if (eligibility.state === "INELIGIBLE_TEMPORAL") {
		if (eligibility.temporalStatus === "NEW_FAIL") {
			reasons.push(
				"Fails the authoritative novelty gate: in-window repost/summary of established information.",
			);
			return { decision: "EXCLUDED_TEMPORAL", reasons };
		}
		// TIME_UNVERIFIED
		if (potentialMateriality >= config.deferralThreshold) {
			reasons.push(
				"Temporal eligibility is unresolved, but the development is potentially important; deferred rather than silently promoted.",
			);
			return { decision: "DEFERRED_UNVERIFIED", reasons };
		}
		reasons.push(
			"Temporal eligibility is unresolved and potential materiality is below the deferral threshold.",
		);
		return { decision: "EXCLUDED_TEMPORAL", reasons };
	}

	// --- 4. Evidence gate ---------------------------------------------------
	if (eligibility.state === "INELIGIBLE_EVIDENCE") {
		if (potentialMateriality >= config.deferralThreshold) {
			reasons.push(
				"Evidence sufficiency is weak, but the development is potentially important; deferred pending verification.",
			);
			return { decision: "DEFERRED_UNVERIFIED", reasons };
		}
		reasons.push(
			"Evidence sufficiency is weak and potential materiality is below the deferral threshold.",
		);
		return { decision: "EXCLUDED_LOW_MATERIALITY", reasons };
	}

	// --- 5. Explicit catch-up ----------------------------------------------
	if (eligibility.state === "ELIGIBLE_CATCH_UP") {
		const original =
			candidate.timestamps.originalPublicationTimestamp ?? "unknown date";
		reasons.push(
			`Explicitly dated catch-up: originally published ${original}; included with its original publication date.`,
		);
		return {
			decision: "CATCH_UP_SELECTED",
			reasons,
			catchUpReason:
				`Older development (${original}) explicitly selected as dated catch-up because it ` +
				`remains materially consequential and was not previously covered in an accessible edition.`,
		};
	}

	// --- 6. Conditional: unresolved editorial/evidence decision ------------
	if (eligibility.state === "CONDITIONAL") {
		if (
			eligibility.hasBlockingUncertainty &&
			potentialMateriality >= config.deferralThreshold
		) {
			reasons.push(
				"A blocking unresolved uncertainty prevents silent promotion; deferred pending resolution.",
			);
			return { decision: "DEFERRED_UNVERIFIED", reasons };
		}
		if (materiality >= config.selectThreshold) {
			reasons.push(
				"Passes hard gates but carries flagged uncertainty that requires an explicit editorial decision.",
			);
			return {
				decision: "REVIEW_REQUIRED",
				reasons,
				reviewReason:
					"Consequential candidate with unresolved editorial or evidence uncertainty; requires an explicit decision before publication.",
			};
		}
		reasons.push(
			"Flagged uncertainty with materiality below the selection threshold.",
		);
		return { decision: "EXCLUDED_LOW_MATERIALITY", reasons };
	}

	// --- 7. Merged into a primary story ------------------------------------
	const mergedInto = mergeGroups.get(candidate.candidateId);
	if (mergedInto && selectedIds.has(mergedInto)) {
		reasons.push(
			`Describes the same coherent development as ${mergedInto}; merged with provenance preserved.`,
		);
		return { decision: "MERGED", reasons };
	}

	// --- 8. Materiality threshold ------------------------------------------
	if (materiality >= config.selectThreshold) {
		reasons.push(
			`Eligible, sufficiently evidenced and materially important (materiality ${materiality.toFixed(3)}).`,
		);
		return { decision: "SELECTED", reasons };
	}

	reasons.push(
		`Eligible but insufficiently consequential for this edition (materiality ${materiality.toFixed(3)}).`,
	);
	return { decision: "EXCLUDED_LOW_MATERIALITY", reasons };
}

/** Collect explicit uncertainty, counterevidence and evidence limitations. */
export function collectUncertainty(
	candidate: CanonicalCandidate,
	eligibility: EditorialEligibility,
	historicalRelationship: HistoricalRelationship | undefined,
): string[] {
	const uncertainty: string[] = [];

	for (const claim of candidate.claims) {
		for (const item of claim.uncertainty.unresolved) {
			uncertainty.push(
				`${item.type} (${item.impact}${item.blocking ? ", blocking" : ""}): ${item.uncertainty}`,
			);
		}
		for (const counter of claim.contradictoryEvidence) {
			uncertainty.push(
				`Counterevidence (${counter.contradictionType}): ${counter.description}`,
			);
		}
		for (const limit of claim.limitingEvidence) {
			uncertainty.push(`Limiting evidence: ${limit}`);
		}
	}

	for (const gap of candidate.evidenceGaps) {
		uncertainty.push(`Evidence gap: ${gap}`);
	}
	for (const question of candidate.unresolvedQuestions) {
		uncertainty.push(`Unresolved question: ${question}`);
	}

	for (const flag of eligibility.omissionReviewFlags) {
		uncertainty.push(`Omission review: ${flag}`);
	}

	if (eligibility.temporalStatus === "TIME_UNVERIFIED") {
		uncertainty.push(
			"Temporal eligibility is unresolved: publication/disclosure time could not be verified.",
		);
	}
	if (eligibility.temporalStatus === "NEW_FAIL") {
		uncertainty.push(
			"Temporal eligibility failed: the item is a repost/summary of established information.",
		);
	}

	if (historicalRelationship?.classification === "HISTORY_UNVERIFIED") {
		uncertainty.push(
			"Historical relationship could not be verified; historical overlap remains uncertain.",
		);
	}
	if (
		historicalRelationship?.classification ===
		"POTENTIAL_HISTORICAL_OMISSION"
	) {
		uncertainty.push(
			"Historical regression suggests a possible earlier omission.",
		);
	}

	return [...new Set(uncertainty)].sort();
}

/**
 * Assemble the final per-candidate assessment from the evaluated phases.
 */
export function buildCandidateAssessment(
	candidate: CanonicalCandidate,
	eligibility: EditorialEligibility,
	materiality: MaterialityInfo,
	decisionInfo: DecisionInfo,
	mergeGroups: Map<string, string>,
	uncertainty: string[],
	config: EditorialSelectionConfig,
): EditorialCandidateAssessment {
	const score = materiality.score;
	const isMajor =
		score >= config.majorThreshold && decisionInfo.decision === "SELECTED";

	const decisionReasons = [
		...decisionInfo.reasons,
		`Materiality heuristic: ${score.toFixed(3)} (${materiality.level}).`,
	];
	if (isMajor) {
		decisionReasons.push(
			"Major development: materiality at or above the lead threshold.",
		);
	}

	return {
		candidateId: candidate.candidateId,
		factualHeadline: candidate.factualHeadline,
		exactStatement: candidate.exactStatement,
		organizations: candidate.organizations.toSorted(),
		products: candidate.products.toSorted(),
		technologies: candidate.technologies.toSorted(),
		researchDomains: candidate.researchDomains.toSorted(),
		discoveryRings: candidate.discoveryRings.toSorted((a, b) => a - b),
		eligibility,
		dimensions: materiality.dimensions,
		materialityScore: score,
		materialityLevel: materiality.level,
		decision: decisionInfo.decision,
		decisionReasons: [...new Set(decisionReasons)].sort(),
		decisionTraceableTo: [
			candidate.candidateId,
			"novelty-classification",
			...candidate.claims.map((claim) => claim.claimId),
			...candidate.sources.map((source) => source.sourceId),
		].sort(),
		mergedInto:
			decisionInfo.decision === "MERGED"
				? mergeGroups.get(candidate.candidateId)
				: undefined,
		originalPublicationDate:
			decisionInfo.decision === "CATCH_UP_SELECTED"
				? candidate.timestamps.originalPublicationTimestamp
				: undefined,
		catchUpReason: decisionInfo.catchUpReason,
		reviewReason: decisionInfo.reviewReason,
		uncertainty,
		sourceReferences: candidate.sources
			.map((source) => source.canonicalUrl)
			.sort(),
		sourceIds: candidate.sources.map((source) => source.sourceId).sort(),
		claimIds: candidate.claims.map((claim) => claim.claimId).sort(),
	};
}
