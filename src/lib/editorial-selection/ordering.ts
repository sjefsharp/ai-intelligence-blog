/**
 * Editorial Selection — Ordering & Narrative Preparation
 *
 * Determines a justified publication order from actual consequence, significance,
 * coherence and audience comprehension. The most consequential development leads;
 * the user's preferred toolchain does not automatically lead.
 *
 * Closely related developments are grouped where this improves understanding,
 * without obscuring their separate facts. Opportunities for technical deep
 * dives, scientific explanation, strategic interpretation, accessible
 * comparisons, diagrams, timelines, historical context and practical engineering
 * implications are identified.
 *
 * Editorial selection is kept distinct from final article composition: this
 * stage does not prescribe a forced central theme or a uniform article
 * structure, and it does not generate articles.
 */

import type { EditorialCandidateAssessment, EditorialStory } from "./schema.js";
import { EDITORIAL_STORY_ID_PREFIX } from "./schema.js";
import type { EditorialSelectionConfig } from "./config.js";
import type { EditorialEligibility } from "./schema.js";
import crypto from "crypto";

function sha16(value: string): string {
	return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function deriveStoryId(candidateId: string): string {
	return `${EDITORIAL_STORY_ID_PREFIX}${sha16(`story:${candidateId}`)}`;
}

/** Tiebreaker window for the engineering-relevance secondary consideration. */
const TIEBREAKER_WINDOW = 0.005;

export interface OrderingResult {
	stories: EditorialStory[];
}

/**
 * Build the final ordered story list from selected assessments.
 */
export function orderStories(
	assessments: EditorialCandidateAssessment[],
	config: EditorialSelectionConfig,
	relationships: { candidateIds: string[]; type: string }[],
	mergeGroups: Map<string, string>,
): OrderingResult {
	const selected = assessments.filter(
		(assessment) =>
			assessment.decision === "SELECTED" ||
			assessment.decision === "CATCH_UP_SELECTED",
	);

	// --- 1. Materiality ordering with engineering-relevance tiebreaker ------
	const ordered = selected.toSorted((a, b) => {
		const delta = b.materialityScore - a.materialityScore;
		if (Math.abs(delta) > TIEBREAKER_WINDOW) return delta;
		// Secondary consideration only: engineering relevance breaks near-ties.
		const engineeringA = dimensionLevel(
			a,
			"engineering-architectural-relevance",
		);
		const engineeringB = dimensionLevel(
			b,
			"engineering-architectural-relevance",
		);
		const engineeringDelta = engineeringB - engineeringA;
		if (engineeringDelta !== 0) return engineeringDelta;
		return a.candidateId.localeCompare(b.candidateId);
	});

	// --- 2. Coherence grouping ---------------------------------------------
	// Related stories are placed adjacent when this improves understanding.
	const grouped = groupRelated(ordered, relationships);

	// --- 3. Build stories ---------------------------------------------------
	const stories: EditorialStory[] = grouped.map((assessment, index) =>
		buildStory(assessment, index + 1, config, mergeGroups),
	);

	return { stories };
}

function dimensionLevel(
	assessment: EditorialCandidateAssessment,
	dimension: string,
): number {
	const match = assessment.dimensions.find(
		(entry) => entry.dimension === dimension,
	);
	if (!match) return 0;
	switch (match.level) {
		case "high":
			return 2;
		case "medium":
			return 1;
		default:
			return 0;
	}
}

/**
 * Reorder so that related stories are adjacent, preserving materiality order as
 * the primary constraint. Only adjacent swaps are performed so the lead story
 * is never displaced.
 */
function groupRelated(
	ordered: EditorialCandidateAssessment[],
	relationships: { candidateIds: string[]; type: string }[],
): EditorialCandidateAssessment[] {
	if (ordered.length < 3) return ordered;
	const result = [...ordered];
	const relatedPairs = new Set<string>();
	for (const relationship of relationships) {
		if (
			relationship.type !== "same-development" &&
			relationship.type !== "related-development"
		)
			continue;
		const [a, b] = relationship.candidateIds;
		relatedPairs.add(`${a}|${b}`);
		relatedPairs.add(`${b}|${a}`);
	}

	for (let i = 0; i < result.length - 1; i++) {
		for (let j = i + 1; j < result.length; j++) {
			if (
				relatedPairs.has(
					`${result[i].candidateId}|${result[j].candidateId}`,
				)
			) {
				// Move the related candidate next to position i, but never above the lead.
				if (j === i + 1) break;
				const [moved] = result.splice(j, 1);
				result.splice(i + 1, 0, moved);
				break;
			}
		}
	}
	return result;
}

function buildStory(
	assessment: EditorialCandidateAssessment,
	order: number,
	config: EditorialSelectionConfig,
	mergeGroups: Map<string, string>,
): EditorialStory {
	const dimensionLevel = (dimension: string) =>
		assessment.dimensions.find((entry) => entry.dimension === dimension)
			?.level ?? "unclear";

	const scientific = dimensionLevel("scientific-technical-significance");
	const engineering = dimensionLevel("engineering-architectural-relevance");
	const strategic = dimensionLevel("strategic-economic-significance");
	const novelty = dimensionLevel("material-novelty");
	const availability = dimensionLevel("availability-maturity");

	const recommendedDepth = recommendDepth(assessment, config, {
		scientific,
		engineering,
		strategic,
	});

	const explanationOpportunities = identifyExplanationOpportunities(
		assessment,
		{
			scientific,
			engineering,
			strategic,
			novelty,
			availability,
		},
	);

	const mergedCandidateIds = [...mergeGroups.entries()]
		.filter(([, primary]) => primary === assessment.candidateId)
		.map(([merged]) => merged)
		.sort();

	const summary = buildSummary(assessment);

	return {
		storyId: deriveStoryId(assessment.candidateId),
		order,
		title: assessment.factualHeadline,
		candidateId: assessment.candidateId,
		mergedCandidateIds,
		claimIds: assessment.claimIds.toSorted(),
		sourceIds: assessment.sourceIds.toSorted(),
		organizations: assessment.organizations,
		researchDomains: assessment.researchDomains,
		discoveryRings: assessment.discoveryRings,
		materialityScore: assessment.materialityScore,
		materialityLevel: assessment.materialityLevel,
		decision:
			assessment.decision === "CATCH_UP_SELECTED"
				? "CATCH_UP_SELECTED"
				: "SELECTED",
		summary,
		recommendedDepth,
		explanationOpportunities,
		caveats: assessment.uncertainty.slice(0, 8),
		evidenceClassificationSummary: buildEvidenceSummary(
			assessment.eligibility,
		),
	};
}

function recommendDepth(
	assessment: EditorialCandidateAssessment,
	config: EditorialSelectionConfig,
	levels: { scientific: string; engineering: string; strategic: string },
): "brief" | "standard" | "deep-dive" {
	if (
		assessment.materialityScore >= config.majorThreshold ||
		levels.scientific === "high" ||
		(levels.engineering === "high" &&
			assessment.materialityScore >= config.selectThreshold)
	) {
		return "deep-dive";
	}
	if (
		assessment.materialityScore < config.selectThreshold + 0.08 &&
		levels.scientific !== "high" &&
		levels.strategic !== "high"
	) {
		return "brief";
	}
	return "standard";
}

function identifyExplanationOpportunities(
	assessment: EditorialCandidateAssessment,
	levels: {
		scientific: string;
		engineering: string;
		strategic: string;
		novelty: string;
		availability: string;
	},
): EditorialStory["explanationOpportunities"] {
	const opportunities = new Set<
		EditorialStory["explanationOpportunities"][number]
	>();

	if (levels.scientific === "high") {
		opportunities.add("scientific-explanation");
		opportunities.add("technical-deep-dive");
	}
	if (levels.engineering === "high") {
		opportunities.add("technical-deep-dive");
		opportunities.add("practical-engineering");
	}
	if (levels.strategic === "high") {
		opportunities.add("strategic-interpretation");
	}
	if (levels.novelty === "high" && levels.availability !== "high") {
		opportunities.add("accessible-comparison");
	}
	if (
		assessment.eligibility.historicalRelationship &&
		assessment.eligibility.historicalRelationship !== "NEW_DEVELOPMENT"
	) {
		opportunities.add("historical-context");
	}
	if (assessment.decision === "CATCH_UP_SELECTED") {
		opportunities.add("historical-context");
		opportunities.add("timeline");
	}
	if (
		assessment.organizations.length > 1 ||
		assessment.technologies.length > 2
	) {
		opportunities.add("diagram");
	}
	if (
		assessment.dimensions.some(
			(dimension) =>
				dimension.dimension === "evidence-strength" &&
				dimension.level === "medium",
		)
	) {
		opportunities.add("accessible-comparison");
	}

	return [...opportunities].sort();
}

function buildSummary(assessment: EditorialCandidateAssessment): string {
	const parts: string[] = [assessment.exactStatement];
	if (
		assessment.decision === "CATCH_UP_SELECTED" &&
		assessment.catchUpReason
	) {
		parts.push(assessment.catchUpReason);
	}
	if (
		assessment.eligibility.historicalRelationship === "SUBSTANTIVE_UPDATE"
	) {
		parts.push(
			"Substantive update to previously covered material; new material is identified in the manifest.",
		);
	}
	return parts.join(" ");
}

function buildEvidenceSummary(eligibility: EditorialEligibility): string {
	const bits = [
		`Temporal eligibility: ${eligibility.temporalStatus}`,
		`Evidence sufficiency: ${eligibility.evidenceSufficiency}`,
	];
	if (eligibility.historicalRelationship) {
		bits.push(
			`Historical relationship: ${eligibility.historicalRelationship}`,
		);
	}
	if (eligibility.hasBlockingUncertainty) {
		bits.push("Blocking uncertainty present");
	}
	return bits.join("; ");
}
