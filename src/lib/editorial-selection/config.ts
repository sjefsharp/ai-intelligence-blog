/**
 * Editorial Selection — Configuration & Documented Ranking Assumptions
 *
 * The ranking heuristic is a deterministic aggregation of evidence-backed
 * dimension levels. It is a decision aid, not an objective measurement: the
 * weights below are explicit assumptions, and the manifest records them so a
 * reader can audit and challenge them.
 *
 * Hard rules:
 * - No vendor quotas, topic quotas or mandatory supplier representation.
 * - Engineering relevance is a secondary consideration (tiebreaker), never a
 *   primary driver that can outrank a more consequential development elsewhere.
 * - Weights are fixed per edition and recorded in the manifest.
 */

import type { EditorialDimension } from "./schema.js";

/**
 * Dimension weights. The six primary dimensions sum to 1.00.
 * Engineering relevance and availability/maturity are recorded as dimensions
 * but carry no primary weight: G is used as an ordering tiebreaker and H as
 * contextual information for depth recommendations.
 */
export const DEFAULT_DIMENSION_WEIGHTS: Record<EditorialDimension, number> = {
	"material-novelty": 0.2,
	"scientific-technical-significance": 0.15,
	"real-world-consequences": 0.2,
	"strategic-economic-significance": 0.15,
	"evidence-strength": 0.2,
	"generalizability-learning-value": 0.1,
	"engineering-architectural-relevance": 0,
	"availability-maturity": 0,
};

/** Level → heuristic value. `unclear` contributes nothing rather than guessing. */
export const LEVEL_VALUES: Record<string, number> = {
	high: 1.0,
	medium: 0.6,
	low: 0.3,
	unclear: 0.0,
};

export interface EditorialSelectionConfig {
	/** Primary dimension weights (must sum to 1.0 across primary dimensions). */
	weights: Record<EditorialDimension, number>;
	/** Materiality at or above this value qualifies a story for selection. */
	selectThreshold: number;
	/** Materiality at or above this value marks a major (lead) story. */
	majorThreshold: number;
	/** Materiality at or above this value keeps a blocked candidate visible as deferred. */
	deferralThreshold: number;
	/** Share of selected stories at which single-organization concentration is flagged. */
	concentrationFlagRatio: number;
	/** Minimum number of selected stories before concentration is assessed. */
	concentrationMinStories: number;
	/** Maximum optional model-assisted comparisons/reviews per run. */
	maxSemanticComparisons: number;
}

export const DEFAULT_EDITORIAL_SELECTION_CONFIG: EditorialSelectionConfig = {
	weights: { ...DEFAULT_DIMENSION_WEIGHTS },
	selectThreshold: 0.5,
	majorThreshold: 0.72,
	deferralThreshold: 0.4,
	concentrationFlagRatio: 0.5,
	concentrationMinStories: 3,
	maxSemanticComparisons: 10,
};

/**
 * Human-readable weighting assumptions persisted in the manifest. Keeping these
 * as data (rather than code comments) makes the editorial trade-off explicit
 * and auditable by downstream readers.
 */
export function buildWeightingAssumptions(
	config: EditorialSelectionConfig,
): string[] {
	const primary = (
		Object.entries(config.weights) as [EditorialDimension, number][]
	)
		.filter(([, weight]) => weight > 0)
		.map(([dimension, weight]) => `${dimension}: ${weight.toFixed(2)}`);
	return [
		"Ranking is a deterministic heuristic over evidence-backed dimension levels, not an objective measurement.",
		`Primary dimension weights: ${primary.join(", ")}.`,
		"Engineering/architectural relevance is recorded but carries no primary weight; it is used only as a secondary consideration (tiebreaker) between otherwise comparable candidates and to justify deeper technical explanation.",
		"Availability/maturity is recorded as contextual information and informs recommended explanation depth, not ranking weight.",
		`Selection threshold: materiality >= ${config.selectThreshold.toFixed(2)}; major/lead threshold: >= ${config.majorThreshold.toFixed(2)}.`,
		"Levels map to heuristic values high=1.0, medium=0.6, low=0.3, unclear=0.0; an unclear dimension contributes nothing rather than guessing.",
		"Sensitivity: a candidate within ±0.05 of the selection threshold should be treated as borderline and justified explicitly in the manifest.",
		"No vendor quotas, topic quotas or mandatory supplier representation are applied at any point.",
	];
}
