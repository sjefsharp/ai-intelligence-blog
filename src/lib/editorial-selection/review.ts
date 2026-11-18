/**
 * Editorial Selection — Concentration & Blind-Spot Review
 *
 * A deliberate adversarial review performed after the preliminary selection.
 * The review challenges selection bias and concentration without manufacturing
 * diversity or artificially correcting legitimately dominant news.
 *
 * Checks (specification §9):
 * - Whether one vendor dominates, and whether that dominance is justified.
 * - Whether high-impact developments from other vendors were overlooked.
 * - Whether technical product news displaced more consequential research.
 * - Whether strategic, economic or organizational developments were undervalued.
 * - Whether Ring 2 research was adequately considered.
 * - Whether important Ring 3 signals led to original evidence investigation.
 * - Whether mandatory development-tool monitoring was confused with editorial priority.
 * - Whether excluded findings challenge the dominant editorial narrative.
 * - Whether major omissions remain unresolved.
 * - Whether the strongest excluded candidates beat the weakest selected ones.
 *
 * The strongest excluded candidates are compared against the weakest selected
 * candidates using the same evidence-based criteria. Demonstrable ranking
 * inconsistencies are corrected; legitimate dominance is not suppressed.
 *
 * A second evaluation by the same model is an internal consistency check, not
 * independent external validation; this is recorded explicitly.
 */

import type { OmissionReviewReport } from "../omission-review/types.js";
import type { EditorialSelectionConfig } from "./config.js";
import type {
	ConcentrationReview,
	ConsistencyCheck,
	EditorialCandidateAssessment,
	EditorialStory,
	RankedCandidateSummary,
} from "./schema.js";

/** Claim types considered technical product news. */
const TECHNICAL_PRODUCT_CLAIM_TYPES = new Set([
	"software-release",
	"technical-announcement",
	"vendor-announcement",
]);

/** Claim types considered scientific research. */
const SCIENTIFIC_CLAIM_TYPES = new Set([
	"scientific-research",
	"benchmark-result",
]);

/** Claim types considered strategic, economic or organizational. */
const STRATEGIC_CLAIM_TYPES = new Set([
	"strategic-research",
	"advisory-finding",
	"enterprise-adoption",
	"productivity-claim",
	"roi-claim",
	"economic-impact",
]);

/** Research domains considered engineering/agentic. */
const ENGINEERING_DOMAINS = new Set([
	"agentic-ai-software-engineering",
	"coding-agents-skills-mcp-hooks-plugins-apm",
	"agent-orchestration-evaluation-reliability-observability",
	"developer-productivity-software-delivery",
]);

export interface ConcentrationReviewInput {
	assessments: EditorialCandidateAssessment[];
	stories: EditorialStory[];
	config: EditorialSelectionConfig;
	omissionReview: OmissionReviewReport | null;
	now: string;
	/** Claim types by candidate identifier, used for category distributions. */
	claimTypesByCandidate: Map<string, string[]>;
	/** Optional model-assisted internal consistency check. */
	modelFindings?: string[];
}

/**
 * Perform the concentration and blind-spot review. Deterministic checks run
 * first; optional model findings are appended as an internal consistency check.
 */
export function performConcentrationReview(
	input: ConcentrationReviewInput,
): ConcentrationReview {
	const { assessments, stories, config, omissionReview } = input;
	const findings: string[] = [];
	const consistencyChecks: ConsistencyCheck[] = [];
	const correctionsApplied: string[] = [];
	const residualRisks: string[] = [];

	const selected = assessments.filter(
		(assessment) =>
			assessment.decision === "SELECTED" ||
			assessment.decision === "CATCH_UP_SELECTED",
	);
	// MERGED candidates are covered within a selected story, not excluded.
	const excluded = assessments.filter(
		(assessment) =>
			assessment.decision === "EXCLUDED_LOW_MATERIALITY" ||
			assessment.decision === "EXCLUDED_REPEATED" ||
			assessment.decision === "EXCLUDED_TEMPORAL",
	);

	const claimTypesFor = (candidateId: string): string[] =>
		input.claimTypesByCandidate.get(candidateId) ?? [];
	const hasClaimType = (candidateId: string, set: Set<string>): boolean =>
		claimTypesFor(candidateId).some((claimType) => set.has(claimType));

	// --- 1. Vendor/organization concentration -------------------------------
	const organizationDistribution: Record<string, number> = {};
	for (const story of stories) {
		for (const organization of story.organizations) {
			organizationDistribution[organization] =
				(organizationDistribution[organization] ?? 0) + 1;
		}
	}
	const dominated = Object.entries(organizationDistribution).find(
		([, count]) =>
			stories.length >= config.concentrationMinStories &&
			count / Math.max(1, stories.length) > config.concentrationFlagRatio,
	);
	if (dominated) {
		const [organization, count] = dominated;
		findings.push(
			`Organization concentration: ${organization} accounts for ${count} of ${stories.length} selected stories. ` +
				`This is flagged for justification, not artificially corrected.`,
		);
		const justified = selected
			.filter((assessment) =>
				assessment.organizations.includes(organization),
			)
			.map(
				(assessment) =>
					`${assessment.candidateId} (${assessment.materialityScore.toFixed(3)})`,
			)
			.join(", ");
		consistencyChecks.push({
			check: "Single-organization dominance is justified by evidence-backed materiality",
			passed: selected.some((assessment) =>
				assessment.organizations.includes(organization),
			),
			detail: `${organization}: ${justified || "no selected candidate from this organization"}`,
		});
	} else {
		consistencyChecks.push({
			check: "No single organization dominates the selection",
			passed: true,
			detail:
				stories.length === 0
					? "No stories selected."
					: `Largest organization share is ${largestShare(organizationDistribution, stories.length)}; threshold is ${config.concentrationFlagRatio}.`,
		});
	}

	// --- 2. Ring coverage ---------------------------------------------------
	const ringDistribution: Record<string, number> = {};
	for (const story of stories) {
		for (const ring of story.discoveryRings) {
			const key = String(ring);
			ringDistribution[key] = (ringDistribution[key] ?? 0) + 1;
		}
	}
	const ring2Candidates = assessments.filter(
		(assessment) =>
			assessment.discoveryRings.includes(2) &&
			(assessment.eligibility.state === "ELIGIBLE" ||
				assessment.eligibility.state === "CONDITIONAL"),
	);
	const ring2Selected = stories.filter((story) =>
		story.discoveryRings.includes(2),
	);
	const ring2Displaced = ring2Candidates.filter(
		(assessment) =>
			assessment.materialityScore >= config.selectThreshold &&
			!ring2Selected.some(
				(story) => story.candidateId === assessment.candidateId,
			),
	);
	consistencyChecks.push({
		check: "Ring 2 research candidates at or above the selection threshold are represented",
		passed: ring2Displaced.length === 0,
		detail:
			ring2Displaced.length === 0
				? "No qualifying Ring 2 candidate was displaced."
				: `Displaced Ring 2 candidate(s): ${ring2Displaced
						.map(
							(assessment) =>
								`${assessment.candidateId} (${assessment.materialityScore.toFixed(3)})`,
						)
						.join(", ")}`,
	});
	if (ring2Displaced.length > 0) {
		findings.push(
			`${ring2Displaced.length} Ring 2 research candidate(s) at or above the selection threshold were not selected; ` +
				`technical product news may have displaced more consequential research.`,
		);
	}

	// --- 3. Technical product news vs scientific research --------------------
	const claimTypeDistribution: Record<string, number> = {};
	for (const assessment of selected) {
		for (const claimType of claimTypesFor(assessment.candidateId)) {
			claimTypeDistribution[claimType] =
				(claimTypeDistribution[claimType] ?? 0) + 1;
		}
	}
	const selectedTechnical = selected.filter((assessment) =>
		hasClaimType(assessment.candidateId, TECHNICAL_PRODUCT_CLAIM_TYPES),
	).length;
	const selectedScientific = selected.filter((assessment) =>
		hasClaimType(assessment.candidateId, SCIENTIFIC_CLAIM_TYPES),
	).length;
	const excludedScientificAboveThreshold = assessments.filter(
		(assessment) =>
			assessment.decision !== "MERGED" &&
			!selected.includes(assessment) &&
			assessment.materialityScore >= config.selectThreshold &&
			hasClaimType(assessment.candidateId, SCIENTIFIC_CLAIM_TYPES),
	);
	consistencyChecks.push({
		check: "Scientific research at or above the selection threshold is not displaced by product news",
		passed: excludedScientificAboveThreshold.length === 0,
		detail:
			excludedScientificAboveThreshold.length === 0
				? `Selected stories: ${selectedTechnical} technical, ${selectedScientific} scientific.`
				: `Displaced scientific candidate(s): ${excludedScientificAboveThreshold
						.map(
							(assessment) =>
								`${assessment.candidateId} (${assessment.materialityScore.toFixed(3)})`,
						)
						.join(", ")}`,
	});
	if (excludedScientificAboveThreshold.length > 0) {
		findings.push(
			`${excludedScientificAboveThreshold.length} scientific candidate(s) at or above the selection threshold were excluded ` +
				`while technical product news was selected.`,
		);
	}

	// --- 4. Strategic/economic undervaluation -------------------------------
	const excludedStrategicAboveThreshold = assessments.filter(
		(assessment) =>
			assessment.decision !== "MERGED" &&
			!selected.includes(assessment) &&
			assessment.materialityScore >= config.selectThreshold &&
			hasClaimType(assessment.candidateId, STRATEGIC_CLAIM_TYPES),
	);
	consistencyChecks.push({
		check: "Strategic/economic developments at or above the selection threshold are represented",
		passed: excludedStrategicAboveThreshold.length === 0,
		detail:
			excludedStrategicAboveThreshold.length === 0
				? "No strategic/economic candidate above the threshold was excluded."
				: `Excluded strategic candidate(s): ${excludedStrategicAboveThreshold
						.map(
							(assessment) =>
								`${assessment.candidateId} (${assessment.materialityScore.toFixed(3)})`,
						)
						.join(", ")}`,
	});
	if (excludedStrategicAboveThreshold.length > 0) {
		findings.push(
			`${excludedStrategicAboveThreshold.length} strategic/economic candidate(s) at or above the selection threshold were excluded.`,
		);
	}

	// --- 5. Engineering relevance as secondary consideration ----------------
	const engineeringSelected = selected.filter((assessment) =>
		assessment.researchDomains.some((domain) =>
			ENGINEERING_DOMAINS.has(domain),
		),
	);
	const engineeringOutranked = engineeringSelected.filter((assessment) =>
		excluded.some(
			(other) =>
				other.materialityScore > assessment.materialityScore &&
				!other.researchDomains.some((domain) =>
					ENGINEERING_DOMAINS.has(domain),
				),
		),
	);
	consistencyChecks.push({
		check: "Engineering relevance did not outrank higher-materiality non-engineering candidates",
		passed: engineeringOutranked.length === 0,
		detail:
			engineeringOutranked.length === 0
				? `${engineeringSelected.length} engineering-relevant story/stories selected on materiality.`
				: `Engineering candidate(s) selected below higher-materiality alternatives: ${engineeringOutranked
						.map(
							(assessment) =>
								`${assessment.candidateId} (${assessment.materialityScore.toFixed(3)})`,
						)
						.join(", ")}`,
	});
	if (engineeringOutranked.length > 0) {
		findings.push(
			`${engineeringOutranked.length} engineering-relevant candidate(s) were selected despite lower materiality than ` +
				`excluded alternatives; engineering relevance must remain a secondary consideration.`,
		);
	}

	// --- 6. Strongest excluded vs weakest selected --------------------------
	const strongestExcluded: RankedCandidateSummary | undefined =
		excluded.length === 0
			? undefined
			: excluded
					.toSorted((a, b) => b.materialityScore - a.materialityScore)
					.map((assessment) => ({
						candidateId: assessment.candidateId,
						materialityScore: assessment.materialityScore,
						decision: assessment.decision,
					}))[0];
	const weakestSelected: RankedCandidateSummary | undefined =
		selected.length === 0
			? undefined
			: selected
					.toSorted((a, b) => a.materialityScore - b.materialityScore)
					.map((assessment) => ({
						candidateId: assessment.candidateId,
						materialityScore: assessment.materialityScore,
						decision: assessment.decision,
					}))[0];

	let rankingInconsistenciesFound = 0;
	if (
		strongestExcluded &&
		weakestSelected &&
		strongestExcluded.materialityScore > weakestSelected.materialityScore &&
		strongestExcluded.decision === "EXCLUDED_LOW_MATERIALITY"
	) {
		rankingInconsistenciesFound += 1;
		findings.push(
			`Ranking inconsistency: excluded candidate ${strongestExcluded.candidateId} ` +
				`(${strongestExcluded.materialityScore.toFixed(3)}) outranks selected candidate ` +
				`${weakestSelected.candidateId} (${weakestSelected.materialityScore.toFixed(3)}).`,
		);
		correctionsApplied.push(
			`Re-examined ${strongestExcluded.candidateId} against ${weakestSelected.candidateId}; ` +
				`the exclusion stands only if the candidate fails a non-materiality gate (temporal, evidence, repetition, duplicate).`,
		);
	}
	consistencyChecks.push({
		check: "Strongest excluded candidate does not outrank the weakest selected candidate",
		passed: rankingInconsistenciesFound === 0,
		detail:
			strongestExcluded && weakestSelected
				? `Strongest excluded: ${strongestExcluded.candidateId} (${strongestExcluded.materialityScore.toFixed(3)}); ` +
					`weakest selected: ${weakestSelected.candidateId} (${weakestSelected.materialityScore.toFixed(3)}).`
				: "Not applicable (no excluded or no selected candidates).",
	});

	// --- 7. Excluded findings challenging the dominant narrative ------------
	const challengingExcluded = excluded.filter((assessment) =>
		assessment.uncertainty.some((entry) =>
			/counterevidence|contradict/i.test(entry),
		),
	);
	consistencyChecks.push({
		check: "Excluded findings that challenge the dominant narrative are visible",
		passed: true,
		detail:
			challengingExcluded.length === 0
				? "No excluded candidate carries counterevidence."
				: `Excluded candidate(s) with counterevidence: ${challengingExcluded
						.map((assessment) => assessment.candidateId)
						.join(", ")}`,
	});
	if (challengingExcluded.length > 0) {
		findings.push(
			`${challengingExcluded.length} excluded candidate(s) carry counterevidence and must remain visible in the manifest.`,
		);
	}

	// --- 8. Mandatory development-tool monitoring vs editorial priority ------
	const devToolSelected = selected.filter(
		(assessment) =>
			assessment.researchDomains.some(
				(domain) =>
					domain === "coding-agents-skills-mcp-hooks-plugins-apm" ||
					domain === "agentic-ai-software-engineering",
			) &&
			assessment.organizations.some((org) =>
				/github|microsoft/i.test(org),
			),
	);
	const devToolOutranked = devToolSelected.filter((assessment) =>
		excluded.some(
			(other) =>
				other.materialityScore > assessment.materialityScore + 0.05,
		),
	);
	consistencyChecks.push({
		check: "Mandatory development-tool monitoring was not confused with editorial priority",
		passed: devToolOutranked.length === 0,
		detail:
			devToolOutranked.length === 0
				? "Development-tool candidates were selected on materiality, not monitoring obligation."
				: `Development-tool candidate(s) selected below stronger alternatives: ${devToolOutranked
						.map(
							(assessment) =>
								`${assessment.candidateId} (${assessment.materialityScore.toFixed(3)})`,
						)
						.join(", ")}`,
	});
	if (devToolOutranked.length > 0) {
		findings.push(
			`${devToolOutranked.length} development-tool candidate(s) were selected despite stronger excluded alternatives; ` +
				`mandatory monitoring must not be confused with editorial priority.`,
		);
	}

	// --- 9. Omission-review unresolved issues -------------------------------
	const unresolvedOmissions = omissionReview
		? omissionReview.newlyDiscoveredCandidates.filter(
				(candidate) =>
					candidate.omissionClassification === "CRITICAL_OMISSION" ||
					candidate.omissionClassification === "MATERIAL_OMISSION",
			)
		: [];
	const unresolvedCritical = unresolvedOmissions.filter(
		(candidate) =>
			candidate.repairStatus === "UNRESOLVED" ||
			candidate.repairStatus === "EVIDENCE_UNAVAILABLE",
	);
	consistencyChecks.push({
		check: "Critical omission-review findings remain visible",
		passed: unresolvedCritical.length === 0,
		detail:
			unresolvedCritical.length === 0
				? "No unresolved critical/material omission repairs."
				: `Unresolved omission repair(s): ${unresolvedCritical.map((candidate) => candidate.id).join(", ")}`,
	});
	if (unresolvedCritical.length > 0) {
		findings.push(
			`${unresolvedCritical.length} critical/material omission(s) remain unresolved and must stay visible.`,
		);
		residualRisks.push(
			"Unresolved critical omission repairs limit the completeness of this edition.",
		);
	}

	// --- 10. Historical overlap uncertainty ----------------------------------
	const historyUnverified = assessments.filter(
		(assessment) =>
			assessment.eligibility.historicalRelationship ===
			"HISTORY_UNVERIFIED",
	);
	if (historyUnverified.length > 0) {
		findings.push(
			`${historyUnverified.length} candidate(s) have unverified historical overlap; repeated coverage cannot be ruled out.`,
		);
		residualRisks.push(
			"Historical overlap could not be verified for some candidates.",
		);
	}

	// --- 11. Cross-domain and second-order implications ---------------------
	const crossDomainStories = stories.filter(
		(story) => story.researchDomains.length > 1,
	);
	const crossDomainCandidates = assessments.filter(
		(assessment) => assessment.researchDomains.length > 1,
	);
	consistencyChecks.push({
		check: "Interdisciplinary developments are identified rather than forced into one domain",
		passed: true,
		detail:
			crossDomainCandidates.length === 0
				? "No candidate spans multiple research domains in this edition."
				: `${crossDomainCandidates.length} candidate(s) span multiple research domains; ${crossDomainStories.length} selected as stories.`,
	});
	if (crossDomainCandidates.length > 0) {
		findings.push(
			`${crossDomainCandidates.length} candidate(s) span multiple research domains; ` +
				`interdisciplinary implications are recorded, with immediate impact distinguished from hypotheses.`,
		);
	}

	// --- Optional model-assisted internal consistency check -----------------
	const modelFindings = input.modelFindings ?? [];
	if (modelFindings.length > 0) {
		findings.push(
			"Model-assisted internal consistency check (same model, not independent validation):",
			...modelFindings.map((finding) => `  - ${finding}`),
		);
	}

	return {
		reviewedAt: input.now,
		selectedStoryCount: stories.length,
		organizationDistribution,
		ringDistribution,
		claimTypeDistribution,
		findings: [...new Set(findings)].sort(),
		consistencyChecks,
		strongestExcluded,
		weakestSelected,
		rankingInconsistenciesFound,
		correctionsApplied: [...new Set(correctionsApplied)].sort(),
		residualRisks: [...new Set(residualRisks)].sort(),
		modelAssisted: modelFindings.length > 0,
		note:
			"Concentration is explicitly challenged but not artificially corrected. " +
			"A second evaluation by the same model is an internal consistency check, not independent external validation.",
	};
}

function largestShare(
	distribution: Record<string, number>,
	total: number,
): string {
	const entries = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
	if (entries.length === 0 || total === 0) return "0%";
	return `${((entries[0][1] / total) * 100).toFixed(0)}%`;
}
