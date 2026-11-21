/**
 * Historical Regression — Relationship Classification
 *
 * Classifies the relationship between a current canonical candidate and the
 * accessible historical editions. Deterministic evidence is evaluated first;
 * model reasoning is used only when deterministic evidence is insufficient.
 *
 * The existing novelty classifier remains authoritative: this module never
 * overrides temporal eligibility. A candidate that is not inside the current
 * edition window is never promoted to SUBSTANTIVE_UPDATE.
 */

import { Temporal } from "@js-temporal/polyfill";

import type {
	CanonicalCandidate,
	ConsolidatedClaim,
} from "../fact-dossier/schema.js";
import { getEditorialWindow } from "../editorial-window.js";
import type { HistoricalEditionBundle } from "./edition-store.js";
import type {
	HistoricalMatchEvidence,
	HistoricalMatchType,
	HistoricalOmissionFinding,
	HistoricalRelationship,
	HistoricalRelationshipClassification,
	HistoricalRelationshipDerivation,
	RepeatedReportingFinding,
	SubstantiveUpdateFinding,
	SubstantiveUpdateType,
} from "./schema.js";
import type { HistoricalComparisonWindow } from "./window.js";
import type { SemanticComparisonProvider } from "./semantic.js";
import {
	DEFAULT_SEMANTIC_SIMILARITY_THRESHOLD,
	STRONG_MATCH_TYPES,
	WEAK_MATCH_TYPES,
	compareVersions,
	containmentSimilarity,
	tokenize,
	type HistoricalEditionIndex,
} from "./matching.js";

// Re-exported for convenience so the engine can build the index map.
export type { HistoricalEditionIndex } from "./matching.js";

/** Budget for optional semantic comparisons (cost control). */
export interface SemanticBudget {
	remaining: number;
}

/** Historical context available to the classifier. */
export interface HistoricalClassificationContext {
	/** Whether at least one historical edition could be reliably compared. */
	available: boolean;
	/** Indexes of reliably comparable editions, keyed by edition date. */
	indexes: Map<string, HistoricalEditionIndex>;
	/** Optional semantic comparison provider. */
	semanticProvider?: SemanticComparisonProvider;
	/** Mutable semantic comparison budget. */
	semanticBudget: SemanticBudget;
	/** Deterministic timestamp override (tests, reproducible builds). */
	now: string;
}

// ============================================================================
// Numeric / textual signal extraction
// ============================================================================

const NUMBER_PATTERN =
	/\b\d+(?:[.,]\d+)?(?:\s?(?:%|percent|x|×|ms|s|seconds?|minutes?|hours?|days?|weeks?|months?|years?|usd|dollars?|euros?|€|\$|£|gb|tb|mb|kb|b|t|m|k|n))?\b/gi;

const NUMBER_TEST_PATTERN =
	/\d+(?:[.,]\d+)?(?:\s?(?:%|percent|x|×|ms|s|seconds?|minutes?|hours?|days?|weeks?|months?|years?|usd|dollars?|euros?|€|\$|£|gb|tb|mb|kb|b|t|m|k|n))?/i;

/** Extract normalized numeric tokens from free text. */
export function extractNumbers(text: string): string[] {
	const matches = text.match(NUMBER_PATTERN) ?? [];
	return matches
		.map((value) =>
			value.replace(",", ".").toLowerCase().replace(/\s+/g, " ").trim(),
		)
		.filter(Boolean)
		.sort();
}

/** Normalize free text for exact comparison. */
function normalizeText(text: string): string {
	return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Keywords indicating a material (qualifying) factual statement. */
const MATERIAL_KEYWORDS = [
	"generally available",
	"general availability",
	"limited availability",
	"waitlist",
	"deprecated",
	"deprecat",
	"pricing",
	"price",
	"license",
	"licensing",
	"cost",
	"costs",
	"vulnerability",
	"cve-",
	"breach",
	"incident",
	"exploit",
	"recall",
	"limitation",
	"limitations",
	"requires",
	"require",
	"no longer",
	"discontinued",
	"retract",
	"correct",
	"revision",
	"replicat",
	"reproduc",
	"benchmark",
	"measured",
	"roi",
	"productivity",
	"adoption",
];

function hasMaterialContent(text: string): boolean {
	if (NUMBER_TEST_PATTERN.test(text)) return true;
	const lower = text.toLowerCase();
	return MATERIAL_KEYWORDS.some((keyword) => lower.includes(keyword));
}

// ============================================================================
// Claim pairing
// ============================================================================

export interface ClaimPair {
	currentClaim: ConsolidatedClaim;
	previousClaim?: ConsolidatedClaim;
}

/** Pair current claims with historical claims by claim ID, then token containment. */
export function pairClaims(
	current: CanonicalCandidate,
	previous: CanonicalCandidate,
): ClaimPair[] {
	const available = new Map(
		previous.claims.map((claim) => [claim.claimId, claim]),
	);

	const pairs: ClaimPair[] = [];
	for (const claim of current.claims) {
		const byId = available.get(claim.claimId);
		if (byId) {
			pairs.push({ currentClaim: claim, previousClaim: byId });
			available.delete(claim.claimId);
			continue;
		}
		const currentTokens = new Set(tokenize(claim.claimStatement));
		let best: ConsolidatedClaim | undefined;
		let bestScore = 0;
		for (const candidate of available.values()) {
			const score = containmentSimilarity(
				currentTokens,
				new Set(tokenize(candidate.claimStatement)),
			);
			if (score > bestScore) {
				bestScore = score;
				best = candidate;
			}
		}
		if (best && bestScore >= 0.7) {
			pairs.push({ currentClaim: claim, previousClaim: best });
			available.delete(best.claimId);
		} else {
			pairs.push({ currentClaim: claim });
		}
	}
	return pairs;
}

// ============================================================================
// Substantive change detection
// ============================================================================

export interface SubstantiveChangeResult {
	hasQualifyingChange: boolean;
	updateTypes: SubstantiveUpdateType[];
	changedFacts: string[];
	evidenceUrls: string[];
	/** Wording changed without a qualifying factual change. */
	superficialWordingChangeOnly: boolean;
}

const MATURITY_ORDER: Record<string, number> = {
	research: 0,
	experimental: 1,
	preview: 2,
	ga: 3,
	deprecated: 4,
};

const IMPLEMENTATION_ORDER: Record<string, number> = {
	research: 0,
	announced: 1,
	preview: 2,
	released: 3,
	unknown: -1,
};

function addedValues(current: string[], previous: string[]): string[] {
	const previousSet = new Set(previous.map((value) => normalizeText(value)));
	return [
		...new Set(
			current.filter((value) => !previousSet.has(normalizeText(value))),
		),
	].sort();
}

function changedValue(
	label: string,
	current: string | undefined,
	previous: string | undefined,
): string | null {
	if (current === previous) return null;
	if (current === undefined) return null;
	if (previous === undefined) {
		return `${label} newly recorded as "${current}" (previously absent)`;
	}
	if (normalizeText(current) === normalizeText(previous)) return null;
	return `${label} changed from "${previous}" to "${current}"`;
}

/** Infer substantive update types from model-reported changed facts. */
export function inferUpdateTypesFromChangedFacts(
	facts: string[],
): SubstantiveUpdateType[] {
	const types = new Set<SubstantiveUpdateType>();
	const text = facts.join(" ").toLowerCase();
	if (
		/(generally available|general availability|ga\b|availability|released|deprecated)/.test(
			text,
		)
	) {
		types.add("availability-change");
	}
	if (
		/(benchmark|latency|throughput|precision|batch size|hardware)/.test(
			text,
		)
	) {
		types.add("benchmark-change");
	}
	if (/(replicat|reproduc|independent|corroborat)/.test(text)) {
		types.add("independent-replication");
	}
	if (/(security|vulnerability|breach|incident|exploit|cve)/.test(text)) {
		types.add("security-incident");
	}
	if (/(pricing|price|licen[cs]|cost)/.test(text)) {
		types.add("licensing-pricing-availability");
	}
	if (
		/(limitation|limitation|constraint|no longer|discontinued)/.test(text)
	) {
		types.add("technical-limitation");
	}
	if (
		/(sample size|research period|statistical|methodology|study design)/.test(
			text,
		)
	) {
		types.add("strategic-research-revision");
	}
	if (/(measured|productivity|roi|outcome|adoption)/.test(text)) {
		types.add("measured-outcome");
	}
	if (/(originally|undisclosed|exclusive|documents show)/.test(text)) {
		types.add("original-reporting");
	}
	if (types.size === 0) types.add("behavior-change");
	return [...types].sort();
}

/**
 * Compare the current candidate against one historical candidate and detect
 * qualifying substantive changes. Superficial wording changes, repeated
 * predictions and republished conclusions are explicitly NOT qualifying.
 */
export function computeSubstantiveChange(
	current: CanonicalCandidate,
	previous: CanonicalCandidate,
): SubstantiveChangeResult {
	const updateTypes = new Set<SubstantiveUpdateType>();
	const changedFacts: string[] = [];
	const evidenceUrls = new Set<string>();
	let wordingChanged = false;

	for (const url of [
		...current.claims.flatMap((claim) => claim.supportingEvidenceUrls),
		...current.sources.map((source) => source.canonicalUrl),
	]) {
		evidenceUrls.add(url);
	}

	const pairs = pairClaims(current, previous);

	for (const pair of pairs) {
		const { currentClaim, previousClaim } = pair;
		const claimLabel = `[${currentClaim.claimId}]`;

		if (!previousClaim) {
			// A genuinely new claim. Qualifying only when it introduces material facts.
			if (hasMaterialContent(currentClaim.claimStatement)) {
				updateTypes.add("follow-up-research");
				changedFacts.push(
					`${claimLabel} New claim introduces material information: ${currentClaim.claimStatement}`,
				);
				if (currentClaim.claimType === "security-vulnerability") {
					updateTypes.add("security-incident");
				}
			} else {
				changedFacts.push(
					`${claimLabel} New claim without independently material content: ${currentClaim.claimStatement}`,
				);
			}
			continue;
		}

		// --- Text / numbers -------------------------------------------------
		const textChanged =
			normalizeText(currentClaim.claimStatement) !==
			normalizeText(previousClaim.claimStatement);
		if (textChanged) wordingChanged = true;

		const currentNumbers = extractNumbers(currentClaim.claimStatement);
		const previousNumbers = extractNumbers(previousClaim.claimStatement);
		const numbersChanged =
			currentNumbers.join("|") !== previousNumbers.join("|");

		if (numbersChanged) {
			changedFacts.push(
				`${claimLabel} Numeric facts changed: [${previousNumbers.join(", ")}] → [${currentNumbers.join(", ")}]`,
			);
			if (
				currentClaim.claimType === "benchmark-result" ||
				previousClaim.claimType === "benchmark-result"
			) {
				updateTypes.add("benchmark-change");
			} else if (
				[
					"productivity-claim",
					"roi-claim",
					"economic-impact",
					"enterprise-adoption",
				].includes(currentClaim.claimType)
			) {
				updateTypes.add("measured-outcome");
			} else if (currentClaim.claimType === "scientific-research") {
				updateTypes.add("benchmark-change");
			} else if (
				currentClaim.claimType === "strategic-research" ||
				currentClaim.claimType === "advisory-finding"
			) {
				updateTypes.add("strategic-research-revision");
			} else {
				updateTypes.add("behavior-change");
			}
		}

		// --- Release maturity / implementation status -----------------------
		const currentMaturity = currentClaim.technicalContext?.releaseMaturity;
		const previousMaturity =
			previousClaim.technicalContext?.releaseMaturity;
		if (
			currentMaturity &&
			previousMaturity &&
			currentMaturity !== previousMaturity
		) {
			const currentOrder = MATURITY_ORDER[currentMaturity] ?? -1;
			const previousOrder = MATURITY_ORDER[previousMaturity] ?? -1;
			if (
				currentOrder > previousOrder ||
				currentMaturity === "deprecated"
			) {
				updateTypes.add("availability-change");
				changedFacts.push(
					`${claimLabel} Release maturity advanced from ${previousMaturity} to ${currentMaturity}.`,
				);
			} else if (currentOrder < previousOrder) {
				updateTypes.add("availability-change");
				changedFacts.push(
					`${claimLabel} Release maturity regressed from ${previousMaturity} to ${currentMaturity}.`,
				);
			}
		}

		const currentImplementation =
			currentClaim.technicalContext?.implementationStatus;
		const previousImplementation =
			previousClaim.technicalContext?.implementationStatus;
		if (
			currentImplementation &&
			previousImplementation &&
			currentImplementation !== previousImplementation
		) {
			const currentOrder =
				IMPLEMENTATION_ORDER[currentImplementation] ?? -1;
			const previousOrder =
				IMPLEMENTATION_ORDER[previousImplementation] ?? -1;
			if (currentOrder > previousOrder) {
				updateTypes.add("availability-change");
				changedFacts.push(
					`${claimLabel} Implementation status advanced from ${previousImplementation} to ${currentImplementation}.`,
				);
			}
		}

		// --- Product version ------------------------------------------------
		const versionComparison = compareVersions(
			currentClaim.technicalContext?.productVersion,
			previousClaim.technicalContext?.productVersion,
		);
		if (versionComparison !== null && versionComparison !== 0) {
			updateTypes.add("behavior-change");
			changedFacts.push(
				`${claimLabel} Product version changed from ${
					previousClaim.technicalContext?.productVersion ?? "unknown"
				} to ${currentClaim.technicalContext?.productVersion ?? "unknown"}.`,
			);
		}

		// --- Capabilities / limitations / compatibility ---------------------
		const addedCapabilities = addedValues(
			currentClaim.technicalContext?.capabilities ?? [],
			previousClaim.technicalContext?.capabilities ?? [],
		);
		if (addedCapabilities.length > 0) {
			updateTypes.add("behavior-change");
			changedFacts.push(
				`${claimLabel} New capabilities disclosed: ${addedCapabilities.join("; ")}.`,
			);
		}

		const addedLimitations = addedValues(
			currentClaim.technicalContext?.limitations ?? [],
			previousClaim.technicalContext?.limitations ?? [],
		);
		if (addedLimitations.length > 0) {
			updateTypes.add("technical-limitation");
			changedFacts.push(
				`${claimLabel} New technical limitations disclosed: ${addedLimitations.join("; ")}.`,
			);
		}

		const addedCompatibility = addedValues(
			currentClaim.technicalContext?.compatibility ?? [],
			previousClaim.technicalContext?.compatibility ?? [],
		);
		if (addedCompatibility.length > 0) {
			updateTypes.add("behavior-change");
			changedFacts.push(
				`${claimLabel} New compatibility information: ${addedCompatibility.join("; ")}.`,
			);
		}

		// --- Licensing / pricing --------------------------------------------
		const licensingKeywords = [
			"pricing",
			"price",
			"license",
			"licensing",
			"cost",
			"costs",
		];
		const currentLower = currentClaim.claimStatement.toLowerCase();
		const previousLower = previousClaim.claimStatement.toLowerCase();
		const licensingChanged = licensingKeywords.some(
			(keyword) =>
				(currentLower.includes(keyword) &&
					!previousLower.includes(keyword)) ||
				(!currentLower.includes(keyword) &&
					previousLower.includes(keyword)),
		);
		if (licensingChanged && numbersChanged) {
			updateTypes.add("licensing-pricing-availability");
			changedFacts.push(
				`${claimLabel} Licensing, pricing or cost information changed.`,
			);
		}

		// --- Benchmark / methodological conditions --------------------------
		const currentBenchmark =
			currentClaim.methodologicalContext?.benchmarkConditions;
		const previousBenchmark =
			previousClaim.methodologicalContext?.benchmarkConditions;
		if (currentBenchmark && previousBenchmark) {
			const conditionsChanged =
				currentBenchmark.precision !== previousBenchmark.precision ||
				currentBenchmark.batchSize !== previousBenchmark.batchSize ||
				currentBenchmark.hardwareSpecified !==
					previousBenchmark.hardwareSpecified ||
				currentBenchmark.warmupRuns !== previousBenchmark.warmupRuns;
			if (conditionsChanged && numbersChanged) {
				updateTypes.add("benchmark-change");
				changedFacts.push(
					`${claimLabel} Experimental conditions changed (precision/batch/hardware/warmup) alongside new results.`,
				);
			}
		}

		const methodologyChanged = changedValue(
			"Methodology",
			currentClaim.methodologicalContext?.methodology,
			previousClaim.methodologicalContext?.methodology,
		);
		if (methodologyChanged) {
			updateTypes.add("methodology-change");
			changedFacts.push(`${claimLabel} ${methodologyChanged}.`);
		}

		const studyDesignChanged = changedValue(
			"Study design",
			currentClaim.methodologicalContext?.studyDesign,
			previousClaim.methodologicalContext?.studyDesign,
		);
		if (studyDesignChanged) {
			updateTypes.add("methodology-change");
			changedFacts.push(`${claimLabel} ${studyDesignChanged}.`);
		}

		// --- Reproducibility / replication ----------------------------------
		const currentReplications =
			currentClaim.methodologicalContext?.reproducibility
				?.independentReplications ?? 0;
		const previousReplications =
			previousClaim.methodologicalContext?.reproducibility
				?.independentReplications ?? 0;
		if (currentReplications > previousReplications) {
			updateTypes.add("independent-replication");
			changedFacts.push(
				`${claimLabel} Independent replications increased from ${previousReplications} to ${currentReplications}.`,
			);
		}

		const replicationChanged = changedValue(
			"Replication result",
			currentClaim.methodologicalContext?.reproducibility
				?.replicationResults,
			previousClaim.methodologicalContext?.reproducibility
				?.replicationResults,
		);
		if (replicationChanged) {
			updateTypes.add("independent-replication");
			changedFacts.push(`${claimLabel} ${replicationChanged}.`);
		}

		const corroborationEstablished =
			currentClaim.independentCorroboration?.established === true &&
			previousClaim.independentCorroboration?.established !== true;
		if (corroborationEstablished) {
			updateTypes.add("independent-replication");
			changedFacts.push(
				`${claimLabel} Independent corroboration newly established.`,
			);
		}

		const counterevidenceAdded =
			currentClaim.contradictoryEvidence.length >
			previousClaim.contradictoryEvidence.length;
		if (counterevidenceAdded) {
			updateTypes.add("independent-replication");
			changedFacts.push(
				`${claimLabel} New counterevidence recorded (${previousClaim.contradictoryEvidence.length} → ${currentClaim.contradictoryEvidence.length}).`,
			);
		}

		const verificationChanged = changedValue(
			"Verification status",
			currentClaim.verificationStatus,
			previousClaim.verificationStatus,
		);
		if (verificationChanged) {
			updateTypes.add("independent-replication");
			changedFacts.push(`${claimLabel} ${verificationChanged}.`);
		}

		// --- Strategic / enterprise context ---------------------------------
		const currentStrategic = currentClaim.strategicContext;
		const previousStrategic = previousClaim.strategicContext;
		if (currentStrategic && previousStrategic) {
			const measuredOutcomeChanged = changedValue(
				"Measured outcome",
				currentStrategic.measuredOutcome,
				previousStrategic.measuredOutcome,
			);
			if (measuredOutcomeChanged) {
				updateTypes.add("measured-outcome");
				changedFacts.push(`${claimLabel} ${measuredOutcomeChanged}.`);
			}

			if (currentStrategic.sampleSize !== previousStrategic.sampleSize) {
				updateTypes.add("strategic-research-revision");
				changedFacts.push(
					`${claimLabel} Sample size changed from ${previousStrategic.sampleSize ?? "unspecified"} to ${
						currentStrategic.sampleSize ?? "unspecified"
					}.`,
				);
			}

			const researchPeriodChanged = changedValue(
				"Research period",
				currentStrategic.researchPeriod,
				previousStrategic.researchPeriod,
			);
			if (researchPeriodChanged) {
				updateTypes.add("strategic-research-revision");
				changedFacts.push(`${claimLabel} ${researchPeriodChanged}.`);
			}

			const uncertaintyChanged = changedValue(
				"Statistical uncertainty",
				currentStrategic.statisticalUncertainty,
				previousStrategic.statisticalUncertainty,
			);
			if (uncertaintyChanged) {
				updateTypes.add("strategic-research-revision");
				changedFacts.push(`${claimLabel} ${uncertaintyChanged}.`);
			}

			const addedEconomic = addedValues(
				currentStrategic.economicImpact ?? [],
				previousStrategic.economicImpact ?? [],
			);
			if (addedEconomic.length > 0) {
				updateTypes.add("strategic-research-revision");
				changedFacts.push(
					`${claimLabel} New economic impact findings: ${addedEconomic.join("; ")}.`,
				);
			}

			const addedProductivity = addedValues(
				currentStrategic.productivityConsequences ?? [],
				previousStrategic.productivityConsequences ?? [],
			);
			if (addedProductivity.length > 0) {
				updateTypes.add("measured-outcome");
				changedFacts.push(
					`${claimLabel} New measured productivity consequences: ${addedProductivity.join("; ")}.`,
				);
			}

			const addedGovernance = addedValues(
				currentStrategic.governanceImplications ?? [],
				previousStrategic.governanceImplications ?? [],
			);
			if (addedGovernance.length > 0) {
				updateTypes.add("strategic-research-revision");
				changedFacts.push(
					`${claimLabel} New governance findings: ${addedGovernance.join("; ")}.`,
				);
			}
		}

		// --- Security -------------------------------------------------------
		if (
			currentClaim.claimType === "security-vulnerability" &&
			numbersChanged
		) {
			updateTypes.add("security-incident");
			changedFacts.push(
				`${claimLabel} New security evidence with changed facts.`,
			);
		}

		// --- Original reporting ---------------------------------------------
		if (currentClaim.claimType === "original-reporting" && textChanged) {
			updateTypes.add("original-reporting");
			changedFacts.push(
				`${claimLabel} Original reporting reveals previously undisclosed facts.`,
			);
		}
	}

	// A candidate-level claim type change is itself material.
	const currentTypes = new Set(
		current.claims.map((claim) => claim.claimType),
	);
	const previousTypes = new Set(
		previous.claims.map((claim) => claim.claimType),
	);
	const addedTypes = [...currentTypes].filter(
		(type) => !previousTypes.has(type),
	);
	if (addedTypes.length > 0 && hasMaterialContent(current.exactStatement)) {
		updateTypes.add("follow-up-research");
		changedFacts.push(
			`New claim type(s) introduced: ${addedTypes.join(", ")}.`,
		);
	}

	const hasQualifyingChange = updateTypes.size > 0;
	return {
		hasQualifyingChange,
		updateTypes: [...updateTypes].sort(),
		changedFacts: [...new Set(changedFacts)].sort(),
		evidenceUrls: [...evidenceUrls].sort(),
		superficialWordingChangeOnly: wordingChanged && !hasQualifyingChange,
	};
}

// ============================================================================
// Match selection
// ============================================================================

const MATCH_TYPE_PRIORITY: Record<HistoricalMatchType, number> = {
	"candidate-id": 0,
	"claim-id": 1,
	"source-url": 2,
	timestamp: 3,
	entity: 4,
	"source-id": 5,
	"semantic-similarity": 6,
	none: 7,
};

export function pickPrimaryMatch(
	matches: HistoricalMatchEvidence[],
): HistoricalMatchEvidence | null {
	const matched = matches.filter((match) => match.matched);
	if (matched.length === 0) return null;
	return matched.toSorted((a, b) => {
		const priority =
			MATCH_TYPE_PRIORITY[a.matchType] - MATCH_TYPE_PRIORITY[b.matchType];
		if (priority !== 0) return priority;
		return b.editionDate.localeCompare(a.editionDate);
	})[0];
}

/** Whether the current candidate is a new publication relative to the historical candidate. */
export function isNewPublication(
	current: CanonicalCandidate,
	previous: CanonicalCandidate | undefined,
): boolean {
	if (!previous) return false;
	if (current.candidateId === previous.candidateId) return false;
	const previousUrls = new Set([
		...previous.sources.map((source) => source.canonicalUrl),
		...previous.claims.flatMap((claim) => claim.supportingEvidenceUrls),
	]);
	const currentUrls = [
		...current.sources.map((source) => source.canonicalUrl),
		...current.claims.flatMap((claim) => claim.supportingEvidenceUrls),
	];
	if (currentUrls.length === 0) return false;
	// A shared canonical URL means this is not a new publication of the same
	// underlying item, even when the candidate identifier differs.
	return !currentUrls.some((url) => previousUrls.has(url));
}

// ============================================================================
// Relationship classification
// ============================================================================

export interface ClassifyRelationshipParams {
	current: CanonicalCandidate;
	matches: HistoricalMatchEvidence[];
	context: HistoricalClassificationContext;
	/** Potential omission finding for this candidate, when one exists. */
	omission?: HistoricalOmissionFinding | null;
}

export interface ClassifyRelationshipResult {
	relationship: HistoricalRelationship;
	/** Whether the classification was escalated to semantic comparison. */
	semanticUsed: boolean;
	/** Unresolved classification questions for the report. */
	unresolvedQuestions: string[];
}

/**
 * Classify one current candidate against the accessible historical editions.
 * Deterministic evidence first; semantic comparison only when necessary.
 */
export async function classifyRelationship(
	params: ClassifyRelationshipParams,
): Promise<ClassifyRelationshipResult> {
	const { current, matches, context, omission } = params;

	if (!context.available) {
		return {
			semanticUsed: false,
			unresolvedQuestions: [
				`Candidate ${current.candidateId}: historical coverage could not be assessed because no previous edition is reliably comparable.`,
			],
			relationship: buildRelationship({
				current,
				matches,
				classification: "HISTORY_UNVERIFIED",
				confidence: 0,
				primary: null,
				rationale:
					"No accessible historical edition can be reliably compared; absence of previous coverage cannot be established.",
				derivation: "history-unavailable",
				semanticUsed: false,
			}),
		};
	}

	const strongMatches = matches.filter((match) =>
		STRONG_MATCH_TYPES.has(match.matchType),
	);
	const weakMatches = matches.filter((match) =>
		WEAK_MATCH_TYPES.has(match.matchType),
	);

	// --- Deterministic strong match ----------------------------------------
	if (strongMatches.length > 0) {
		const primary = pickPrimaryMatch(strongMatches)!;
		const previous = resolveHistoricalCandidate(context, primary);
		const inWindow =
			current.temporalEligibility.noveltyClassification.inWindow;
		const change = previous
			? computeSubstantiveChange(current, previous)
			: null;

		if (change?.hasQualifyingChange && inWindow) {
			const substantiveUpdate: SubstantiveUpdateFinding = {
				updateTypes: change.updateTypes,
				previousEditionDate: primary.editionDate,
				previousEditionId: primary.editionId,
				previousCandidateId:
					previous?.candidateId ??
					primary.matchedCandidateIds[0] ??
					"",
				previousClaimIds:
					previous?.claims.map((claim) => claim.claimId) ?? [],
				currentClaimIds: current.claims.map((claim) => claim.claimId),
				changedFacts: change.changedFacts,
				evidenceUrls: change.evidenceUrls,
				newInformationTimestamp:
					current.timestamps.substantiveUpdateTimestamp ??
					current.timestamps
						.earliestSupportedPublicDisclosureTimestamp ??
					current.timestamps.originalPublicationTimestamp ??
					context.now,
				withinCurrentEditionWindow: true,
				rationale: `Qualifying change detected against edition ${primary.editionDate}: ${change.changedFacts.length} changed fact(s). The existing novelty classifier places this item inside the current edition window.`,
			};
			return {
				semanticUsed: false,
				unresolvedQuestions: [],
				relationship: buildRelationship({
					current,
					matches,
					classification: "SUBSTANTIVE_UPDATE",
					confidence: 0.9,
					primary,
					rationale: substantiveUpdate.rationale,
					derivation: "deterministic-matching",
					semanticUsed: false,
					substantiveUpdate,
					historicalContext: previous
						? [
								`Previously covered in edition ${primary.editionDate} as ${previous.candidateId}.`,
							]
						: [],
				}),
			};
		}

		if (change?.hasQualifyingChange && !inWindow) {
			return {
				semanticUsed: false,
				unresolvedQuestions: [
					`Candidate ${current.candidateId}: substantive change detected outside the current edition window; temporal eligibility remains with the novelty classifier.`,
				],
				relationship: buildRelationship({
					current,
					matches,
					classification: "RELATED_CONTEXT",
					confidence: 0.85,
					primary,
					rationale: `A qualifying change exists relative to edition ${primary.editionDate}, but the existing novelty classifier does not place this item inside the current edition window. The change is recorded as historical context; temporal eligibility remains decided by the novelty classifier.`,
					derivation: "deterministic-matching",
					semanticUsed: false,
					historicalContext: [
						`Edition ${primary.editionDate} covered an earlier state of this development.`,
					],
				}),
			};
		}

		// No qualifying change: previously covered or repeated reporting.
		const newPublication = isNewPublication(current, previous);
		const classification: HistoricalRelationshipClassification =
			newPublication ? "REPEATED_REPORTING" : "PREVIOUSLY_COVERED";

		const repeatedReporting: RepeatedReportingFinding | undefined =
			newPublication
				? {
						previousEditionDate: primary.editionDate,
						previousEditionId: primary.editionId,
						previousCandidateId:
							previous?.candidateId ??
							primary.matchedCandidateIds[0] ??
							"",
						previousClaimIds:
							previous?.claims.map((claim) => claim.claimId) ??
							[],
						repeatedClaimIds: current.claims.map(
							(claim) => claim.claimId,
						),
						qualifyingChange: null,
						evidenceUrls: [
							...new Set([
								...(previous?.sources.map(
									(source) => source.canonicalUrl,
								) ?? []),
								...current.sources.map(
									(source) => source.canonicalUrl,
								),
							]),
						].sort(),
						rationale:
							"A new publication repeats substantially established information without a qualifying factual change.",
					}
				: undefined;

		return {
			semanticUsed: false,
			unresolvedQuestions: [],
			relationship: buildRelationship({
				current,
				matches,
				classification,
				confidence: 0.9,
				primary,
				rationale: newPublication
					? `No qualifying change detected. The current item is a new publication repeating information already covered in edition ${primary.editionDate}${
							change?.superficialWordingChangeOnly
								? " (wording changed without a qualifying factual change)"
								: ""
						}.`
					: `The same material information was already covered in edition ${primary.editionDate} without a qualifying factual change${
							change?.superficialWordingChangeOnly
								? " (wording changed without a qualifying factual change)"
								: ""
						}.`,
				derivation: "deterministic-matching",
				semanticUsed: false,
				repeatedReporting,
				historicalContext: [
					`Previously covered in edition ${primary.editionDate}${
						previous ? ` as ${previous.candidateId}` : ""
					}.`,
				],
			}),
		};
	}

	// --- Weak matches -------------------------------------------------------
	// Token similarity (and strong entity overlap with high similarity) is the
	// only signal that can require semantic interpretation. Everything else is
	// deterministic context.
	const semanticMatches = weakMatches.filter(
		(match) => match.matchType === "semantic-similarity",
	);
	const entityMatches = weakMatches.filter(
		(match) => match.matchType === "entity",
	);
	const similarityThreshold = DEFAULT_SEMANTIC_SIMILARITY_THRESHOLD;
	const escalatableMatches =
		semanticMatches.length > 0
			? semanticMatches
			: entityMatches.filter(
					(match) => match.headlineSimilarity >= similarityThreshold,
				);

	if (
		escalatableMatches.length > 0 &&
		context.semanticProvider &&
		context.semanticBudget.remaining > 0
	) {
		const primary = pickPrimaryMatch(escalatableMatches)!;
		const previous = resolveHistoricalCandidate(context, primary);
		if (previous) {
			try {
				context.semanticBudget.remaining -= 1;
				const outcome = await context.semanticProvider.compare({
					current: toSemanticCandidate(current),
					previous: {
						...toSemanticCandidate(previous),
						editionDate: primary.editionDate,
					},
					deterministicMatchType: primary.matchType,
				});
				const inWindow =
					current.temporalEligibility.noveltyClassification.inWindow;

				let classification: HistoricalRelationshipClassification;
				let substantiveUpdate: SubstantiveUpdateFinding | undefined;
				let repeatedReporting: RepeatedReportingFinding | undefined;
				const unresolved: string[] = [];

				switch (outcome.relationship) {
					case "same-development":
						classification = "PREVIOUSLY_COVERED";
						break;
					case "distinct-development":
						classification = "NEW_DEVELOPMENT";
						break;
					case "repeated-reporting":
						classification = "REPEATED_REPORTING";
						repeatedReporting = {
							previousEditionDate: primary.editionDate,
							previousEditionId: primary.editionId,
							previousCandidateId: previous.candidateId,
							previousClaimIds: previous.claims.map(
								(claim) => claim.claimId,
							),
							repeatedClaimIds: current.claims.map(
								(claim) => claim.claimId,
							),
							qualifyingChange: null,
							evidenceUrls: [
								...new Set([
									...previous.sources.map(
										(source) => source.canonicalUrl,
									),
									...current.sources.map(
										(source) => source.canonicalUrl,
									),
								]),
							].sort(),
							rationale: outcome.rationale,
						};
						break;
					case "substantive-update":
						if (inWindow) {
							classification = "SUBSTANTIVE_UPDATE";
							substantiveUpdate = {
								updateTypes: inferUpdateTypesFromChangedFacts(
									outcome.changedFacts,
								),
								previousEditionDate: primary.editionDate,
								previousEditionId: primary.editionId,
								previousCandidateId: previous.candidateId,
								previousClaimIds: previous.claims.map(
									(claim) => claim.claimId,
								),
								currentClaimIds: current.claims.map(
									(claim) => claim.claimId,
								),
								changedFacts: outcome.changedFacts,
								evidenceUrls: [
									...new Set([
										...previous.sources.map(
											(source) => source.canonicalUrl,
										),
										...current.sources.map(
											(source) => source.canonicalUrl,
										),
									]),
								].sort(),
								newInformationTimestamp:
									current.timestamps
										.substantiveUpdateTimestamp ??
									current.timestamps
										.originalPublicationTimestamp ??
									context.now,
								withinCurrentEditionWindow: true,
								rationale: outcome.rationale,
							};
						} else {
							classification = "RELATED_CONTEXT";
							unresolved.push(
								`Candidate ${current.candidateId}: semantic comparison suggests a substantive update, but the item is outside the current edition window; novelty eligibility remains with the novelty classifier.`,
							);
						}
						break;
					case "insufficient-evidence":
					default:
						classification = "HISTORY_UNVERIFIED";
						unresolved.push(
							`Candidate ${current.candidateId}: semantic comparison could not establish a reliable relationship.`,
						);
						break;
				}

				return {
					semanticUsed: true,
					unresolvedQuestions: unresolved,
					relationship: buildRelationship({
						current,
						matches,
						classification,
						confidence: outcome.confidence,
						primary,
						rationale: `${outcome.rationale} (model-assisted: ${outcome.provider ?? "unknown"}/${
							outcome.model ?? "unknown"
						})`,
						derivation: "semantic-comparison",
						semanticUsed: true,
						substantiveUpdate,
						repeatedReporting,
						historicalContext: [
							`Semantic comparison against edition ${primary.editionDate} (${primary.matchType}).`,
						],
					}),
				};
			} catch (error) {
				// Free inference unavailable: preserve deterministic findings and mark
				// the unresolved semantic comparison explicitly.
				return {
					semanticUsed: false,
					unresolvedQuestions: [
						`Candidate ${current.candidateId}: semantic comparison could not be performed because free inference capacity was unavailable.`,
					],
					relationship: buildRelationship({
						current,
						matches,
						classification: "HISTORY_UNVERIFIED",
						confidence: 0,
						primary,
						rationale: `Semantic comparison was required but free inference capacity was unavailable: ${
							error instanceof Error
								? error.message
								: String(error)
						}. Deterministic findings are preserved and the comparison is marked unresolved.`,
						derivation: "deterministic-matching",
						semanticUsed: false,
					}),
				};
			}
		}
	}

	if (escalatableMatches.length > 0) {
		// Semantic interpretation was required but no free inference capacity or
		// budget was available. Preserve deterministic findings and mark the
		// comparison explicitly as unresolved.
		const primary = pickPrimaryMatch(escalatableMatches)!;
		return {
			semanticUsed: false,
			unresolvedQuestions: [
				`Candidate ${current.candidateId}: semantic comparison was required but no free inference provider or comparison budget was available.`,
			],
			relationship: buildRelationship({
				current,
				matches,
				classification: "HISTORY_UNVERIFIED",
				confidence: 0,
				primary,
				rationale:
					"Deterministic evidence was insufficient to distinguish a meaningful update from repetition, and no free inference capacity was available. The comparison is preserved as unresolved.",
				derivation: "deterministic-matching",
				semanticUsed: false,
			}),
		};
	}

	if (weakMatches.length > 0) {
		// Entity or source-identifier overlap only: relevant historical context,
		// but no established equivalent. A new development is never suppressed by
		// weak signals alone.
		const primary = pickPrimaryMatch(weakMatches)!;
		return {
			semanticUsed: false,
			unresolvedQuestions: [],
			relationship: buildRelationship({
				current,
				matches,
				classification: "NEW_DEVELOPMENT",
				confidence: 0.7,
				primary,
				rationale:
					"Only weak deterministic signals (organization/product/technology or source identifier) overlap; no established equivalent exists in the accessible historical coverage.",
				derivation: "deterministic-matching",
				semanticUsed: false,
				historicalContext: [
					`Related coverage in edition ${primary.editionDate}${
						primary.sharedOrganizations.length > 0
							? ` (shared organizations: ${primary.sharedOrganizations.join(", ")})`
							: ""
					}.`,
				],
			}),
		};
	}

	// --- No historical match ------------------------------------------------
	if (
		omission &&
		[
			"NOT_DISCOVERED",
			"PREVIOUSLY_DISCOVERED_NOT_SELECTED",
			"PREVIOUSLY_INACCESSIBLE",
		].includes(omission.classification)
	) {
		return {
			semanticUsed: false,
			unresolvedQuestions: [],
			relationship: buildRelationship({
				current,
				matches,
				classification: "POTENTIAL_HISTORICAL_OMISSION",
				confidence: 0.6,
				primary: null,
				rationale: omission.rationale,
				derivation: "deterministic-matching",
				semanticUsed: false,
				historicalContext: [
					`First disclosure ${omission.firstDisclosureTimestamp} fell inside edition ${omission.suspectedMissedEditionDate}'s daily eligibility window.`,
				],
			}),
		};
	}

	return {
		semanticUsed: false,
		unresolvedQuestions: omission
			? [
					`Candidate ${current.candidateId}: historical coverage for edition ${omission.suspectedMissedEditionDate} could not be assessed (${omission.classification}).`,
				]
			: [],
		relationship: buildRelationship({
			current,
			matches,
			classification: "NEW_DEVELOPMENT",
			confidence: 0.8,
			primary: null,
			rationale:
				"No established equivalent in the accessible historical coverage; classified as a materially new development.",
			derivation: "deterministic-matching",
			semanticUsed: false,
			historicalContext: omission
				? [
						`Historical records for edition ${omission.suspectedMissedEditionDate} are unavailable; no previous coverage can be ruled out.`,
					]
				: [],
		}),
	};
}

// ============================================================================
// Historical omission analysis
// ============================================================================

export interface AnalyzeOmissionParams {
	current: CanonicalCandidate;
	window: HistoricalComparisonWindow;
	bundles: HistoricalEditionBundle[];
	matches: HistoricalMatchEvidence[];
}

/**
 * Determine whether the current candidate's first disclosure fell inside an
 * earlier edition's daily eligibility window that did not cover it.
 * Returns null when no omission can be suspected.
 */
export function analyzePotentialOmission(
	params: AnalyzeOmissionParams,
): HistoricalOmissionFinding | null {
	const { current, window, bundles, matches } = params;

	const firstDisclosure =
		current.timestamps.earliestSupportedPublicDisclosureTimestamp ??
		current.timestamps.originalPublicationTimestamp;
	if (!firstDisclosure) return null;

	const missedEditionDate = findHistoricalEditionForDisclosure(
		firstDisclosure,
		window.editionDates,
	);
	if (!missedEditionDate) return null;

	const bundle = bundles.find(
		(candidate) => candidate.editionDate === missedEditionDate,
	);
	if (!bundle) return null;

	// Covered in the suspected missed edition?
	const strongInMissedEdition = matches.some(
		(match) =>
			match.editionDate === missedEditionDate &&
			STRONG_MATCH_TYPES.has(match.matchType),
	);
	if (strongInMissedEdition) return null;

	// Already covered by another available edition?
	const coveredElsewhere = matches.some(
		(match) =>
			STRONG_MATCH_TYPES.has(match.matchType) &&
			match.editionDate !== missedEditionDate,
	);

	const evidenceUrls = [
		...current.sources.map((source) => source.canonicalUrl),
		...current.claims.flatMap((claim) => claim.supportingEvidenceUrls),
	].sort();

	const significance = classifyOmissionSignificance(current);

	if (coveredElsewhere) {
		return {
			candidateId: current.candidateId,
			suspectedMissedEditionDate: missedEditionDate,
			suspectedMissedEditionId: `edition_${missedEditionDate}`,
			firstDisclosureTimestamp: firstDisclosure,
			classification: "ALREADY_COVERED_ELSEWHERE",
			significance,
			rationale: `Edition ${missedEditionDate} did not cover this development, but another accessible edition did; the development is not lost.`,
			evidenceUrls,
			proposedCatchUp: false,
			catchUpNote:
				"Not proposed as CATCH_UP: the development was covered by another edition.",
		};
	}

	if (
		bundle.availability.status === "UNAVAILABLE" ||
		bundle.availability.status === "NOT_ASSESSABLE"
	) {
		return {
			candidateId: current.candidateId,
			suspectedMissedEditionDate: missedEditionDate,
			suspectedMissedEditionId: `edition_${missedEditionDate}`,
			firstDisclosureTimestamp: firstDisclosure,
			classification: "NOT_ASSESSABLE",
			significance: "low",
			rationale: `First disclosure falls inside edition ${missedEditionDate}'s daily eligibility window, but that edition's historical records are ${bundle.availability.status}. Previous coverage cannot be established either way.`,
			evidenceUrls,
			proposedCatchUp: false,
			catchUpNote:
				"Not proposed as CATCH_UP: historical coverage is not assessable.",
		};
	}

	// Previously discovered but not selected?
	const discoveredEarlier =
		bundle.candidateRecords.some(
			(record) => record.id === current.candidateId,
		) ||
		bundle.candidateRecords.some((record) =>
			record.sourceIds.some((sourceId) =>
				current.sources.some((source) => source.sourceId === sourceId),
			),
		) ||
		bundle.discoveryRecords.some((record) => {
			const url = (record as { url?: string }).url;
			return url
				? current.sources.some((source) => source.canonicalUrl === url)
				: false;
		}) ||
		Boolean(
			bundle.dossier?.candidates.some(
				(candidate) => candidate.candidateId === current.candidateId,
			),
		);

	if (discoveredEarlier) {
		return {
			candidateId: current.candidateId,
			suspectedMissedEditionDate: missedEditionDate,
			suspectedMissedEditionId: `edition_${missedEditionDate}`,
			firstDisclosureTimestamp: firstDisclosure,
			classification: "PREVIOUSLY_DISCOVERED_NOT_SELECTED",
			significance,
			rationale: `Edition ${missedEditionDate} discovered this development (candidate or discovery records) but did not select it for publication.`,
			evidenceUrls,
			proposedCatchUp:
				significance === "critical" || significance === "high",
			catchUpNote:
				significance === "critical" || significance === "high"
					? `May be proposed as explicitly dated CATCH_UP content: discovered in edition ${missedEditionDate} but not selected.`
					: undefined,
		};
	}

	// Previously inaccessible?
	const sourceInaccessible = current.sources.some((source) =>
		bundle.monitoringRecords.some(
			(record) =>
				record.sourceId === source.sourceId &&
				(record.status === "INACCESSIBLE" || record.status === "ERROR"),
		),
	);
	if (sourceInaccessible) {
		return {
			candidateId: current.candidateId,
			suspectedMissedEditionDate: missedEditionDate,
			suspectedMissedEditionId: `edition_${missedEditionDate}`,
			firstDisclosureTimestamp: firstDisclosure,
			classification: "PREVIOUSLY_INACCESSIBLE",
			significance,
			rationale: `Edition ${missedEditionDate} could not access at least one source for this development (monitoring records report INACCESSIBLE/ERROR).`,
			evidenceUrls,
			proposedCatchUp:
				significance === "critical" || significance === "high",
			catchUpNote:
				significance === "critical" || significance === "high"
					? `May be proposed as explicitly dated CATCH_UP content: the source was inaccessible during edition ${missedEditionDate}.`
					: undefined,
		};
	}

	if (bundle.availability.status === "AVAILABLE") {
		return {
			candidateId: current.candidateId,
			suspectedMissedEditionDate: missedEditionDate,
			suspectedMissedEditionId: `edition_${missedEditionDate}`,
			firstDisclosureTimestamp: firstDisclosure,
			classification: "NOT_DISCOVERED",
			significance,
			rationale: `Edition ${missedEditionDate} is available and does not contain this development in its canonical dossier, candidate records, discovery records or monitoring records.`,
			evidenceUrls,
			proposedCatchUp:
				significance === "critical" || significance === "high",
			catchUpNote:
				significance === "critical" || significance === "high"
					? `May be proposed as explicitly dated CATCH_UP content: the development was public during edition ${missedEditionDate}'s eligibility window and was not discovered.`
					: undefined,
		};
	}

	return {
		candidateId: current.candidateId,
		suspectedMissedEditionDate: missedEditionDate,
		suspectedMissedEditionId: `edition_${missedEditionDate}`,
		firstDisclosureTimestamp: firstDisclosure,
		classification: "INSUFFICIENT_EVIDENCE",
		significance: "low",
		rationale: `Edition ${missedEditionDate} is only partially accessible; it cannot be established whether this development was discovered.`,
		evidenceUrls,
		proposedCatchUp: false,
		catchUpNote:
			"Not proposed as CATCH_UP: historical evidence is insufficient.",
	};
}

/** Significance of a potential historical omission. */
export function classifyOmissionSignificance(
	candidate: CanonicalCandidate,
): HistoricalOmissionFinding["significance"] {
	const claimTypes = new Set(
		candidate.claims.map((claim) => claim.claimType),
	);
	const hasVerifiedSecurity =
		claimTypes.has("security-vulnerability") &&
		candidate.claims.some(
			(claim) => claim.verificationStatus === "verified",
		);
	if (hasVerifiedSecurity) return "critical";
	if (claimTypes.has("security-vulnerability")) return "high";
	if (claimTypes.has("original-reporting")) return "high";
	if (
		claimTypes.has("scientific-research") ||
		claimTypes.has("strategic-research")
	)
		return "high";
	if (claimTypes.has("software-release")) return "high";
	if (
		claimTypes.has("benchmark-result") ||
		claimTypes.has("technical-announcement") ||
		claimTypes.has("vendor-announcement") ||
		claimTypes.has("productivity-claim") ||
		claimTypes.has("roi-claim") ||
		claimTypes.has("economic-impact") ||
		claimTypes.has("enterprise-adoption")
	) {
		return "medium";
	}
	return "low";
}

// ============================================================================
// Helpers
// ============================================================================

function resolveHistoricalCandidate(
	context: HistoricalClassificationContext,
	match: HistoricalMatchEvidence,
): CanonicalCandidate | undefined {
	const index = context.indexes.get(match.editionDate);
	if (!index) return undefined;
	const candidateId = index.resolveCandidateId(match);
	if (!candidateId) return undefined;
	return index.byCandidateId.get(candidateId);
}

function toSemanticCandidate(candidate: CanonicalCandidate) {
	return {
		candidateId: candidate.candidateId,
		headline: candidate.factualHeadline,
		statement: candidate.exactStatement,
		claims: candidate.claims.map((claim) => claim.claimStatement),
		organizations: candidate.organizations,
		products: candidate.products,
		technologies: candidate.technologies,
		sourceUrls: [
			...new Set([
				...candidate.sources.map((source) => source.canonicalUrl),
				...candidate.claims.flatMap(
					(claim) => claim.supportingEvidenceUrls,
				),
			]),
		].sort(),
		publicationTimestamp:
			candidate.timestamps.originalPublicationTimestamp ??
			candidate.timestamps.earliestSupportedPublicDisclosureTimestamp,
	};
}

interface BuildRelationshipParams {
	current: CanonicalCandidate;
	matches: HistoricalMatchEvidence[];
	classification: HistoricalRelationshipClassification;
	confidence: number;
	primary: HistoricalMatchEvidence | null;
	rationale: string;
	derivation: HistoricalRelationshipDerivation;
	semanticUsed: boolean;
	substantiveUpdate?: SubstantiveUpdateFinding;
	repeatedReporting?: RepeatedReportingFinding;
	historicalContext?: string[];
}

function buildRelationship(
	params: BuildRelationshipParams,
): HistoricalRelationship {
	const { current, matches, classification, confidence, primary } = params;
	const sortedMatches = matches.toSorted((a, b) =>
		b.editionDate.localeCompare(a.editionDate),
	);
	return {
		candidateId: current.candidateId,
		editionDate: current.editionDate,
		classification,
		confidence,
		matches: sortedMatches,
		primaryMatchEditionDate: primary?.editionDate,
		primaryMatchCandidateId: primary?.matchedCandidateIds[0],
		primaryMatchType: primary?.matchType,
		substantiveUpdate: params.substantiveUpdate,
		repeatedReporting: params.repeatedReporting,
		historicalContext: params.historicalContext ?? [],
		rationale: params.rationale,
		derivedFrom: params.derivation,
		semanticComparisonUsed: params.semanticUsed,
	};
}

/**
 * Locate the historical edition whose daily eligibility window contains a
 * disclosure timestamp. Uses the authoritative `getEditorialWindow` so the
 * daily window definition (and its DST handling) is shared with the novelty
 * classifier. Returns null when the timestamp falls outside the historical
 * comparison window (for example, inside the current edition window).
 */
export function findHistoricalEditionForDisclosure(
	timestamp: string,
	editionDates: string[],
): string | null {
	let instant: Temporal.Instant;
	try {
		instant = Temporal.Instant.from(timestamp);
	} catch {
		// A malformed disclosure timestamp cannot be placed in any window.
		return null;
	}
	for (const editionDate of editionDates) {
		const window = getEditorialWindow(editionDate);
		const start = window.startZoned.toInstant();
		const end = window.endZoned.toInstant();
		if (
			Temporal.Instant.compare(instant, start) >= 0 &&
			Temporal.Instant.compare(instant, end) < 0
		) {
			return editionDate;
		}
	}
	return null;
}
