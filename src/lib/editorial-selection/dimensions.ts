/**
 * Editorial Selection — Evaluation Dimensions & Materiality
 *
 * Evaluates every eligible candidate across the eight specification dimensions
 * (A–H) using evidence-backed levels inherited from the canonical fact dossier
 * and the upstream review stages. Levels are primary; the numeric score is a
 * documented deterministic heuristic, never an apparently objective measurement.
 *
 * Dimension semantics (specification §3):
 * - A. Material novelty: what genuinely changed; whether it reveals previously
 *   unknown capabilities, findings, consequences or limitations.
 * - B. Scientific and technical significance: new mechanisms, results or
 *   engineering capabilities; reproducibility and independent evaluation.
 * - C. Real-world consequences: who or what is materially affected; availability
 *   and demonstrated vs. proposed status.
 * - D. Strategic and economic significance: enterprise adoption, competition,
 *   business models, productivity, cost, workforce and governance.
 * - E. Evidence strength and uncertainty: directness, corroboration,
 *   inspectability, counterevidence and unresolved uncertainty.
 * - F. Generalizability and learning value: applicability beyond one vendor,
 *   product or organization; transferable insight.
 * - G. Engineering and architectural relevance: software engineering, agentic
 *   workflows, architecture, security, interoperability and operations.
 * - H. Availability and maturity: GA / preview / experimental / announced, and
 *   known access, pricing, licensing and rollout restrictions.
 *
 * G and H are recorded but carry no primary ranking weight: G is a documented
 * secondary consideration (tiebreaker) and H is contextual.
 */

import type {
	CanonicalCandidate,
	ConsolidatedClaim,
	ReadinessLevel,
} from "../fact-dossier/schema.js";
import type { HistoricalRelationship } from "../historical-regression/schema.js";
import {
	DEFAULT_DIMENSION_WEIGHTS,
	LEVEL_VALUES,
	type EditorialSelectionConfig,
} from "./config.js";
import type { EditorialEligibility } from "./schema.js";
import type {
	EditorialDimension,
	EditorialDimensionAssessment,
} from "./schema.js";

/** Claim types with direct real-world operational consequences. */
const APPLIED_CLAIM_TYPES = new Set([
	"enterprise-adoption",
	"productivity-claim",
	"economic-impact",
	"security-vulnerability",
	"policy-regulation",
]);

/** Claim types carrying strategic, organizational or economic substance. */
const STRATEGIC_CLAIM_TYPES = new Set([
	"strategic-research",
	"advisory-finding",
	"enterprise-adoption",
	"productivity-claim",
	"roi-claim",
	"economic-impact",
]);

function levelValue(level: ReadinessLevel): number {
	return LEVEL_VALUES[level] ?? 0;
}

function pushUnique(target: string[], values: string[]): void {
	for (const value of values) {
		if (value.trim().length > 0 && !target.includes(value))
			target.push(value);
	}
}

function claimTypeSummary(claims: ConsolidatedClaim[]): string {
	const counts = new Map<string, number>();
	for (const claim of claims) {
		counts.set(claim.claimType, (counts.get(claim.claimType) ?? 0) + 1);
	}
	return [...counts.entries()]
		.sort()
		.map(([type, count]) => `${type}×${count}`)
		.join(", ");
}

/**
 * Assess dimension A — material novelty.
 * Consumes the inherited temporal eligibility gate and the historical
 * regression relationship; never re-decides novelty.
 */
function assessMaterialNovelty(
	candidate: CanonicalCandidate,
	eligibility: EditorialEligibility,
	historicalRelationship: HistoricalRelationship | undefined,
): EditorialDimensionAssessment {
	const readiness = candidate.editorialReadiness.materialNovelty;
	const evidence: string[] = [...readiness.evidence];
	const traceableTo = [...readiness.traceableTo];
	const novelty = candidate.temporalEligibility.noveltyClassification;

	pushUnique(evidence, [
		`Temporal eligibility: ${candidate.temporalEligibility.status}`,
		`Inherited novelty classification: ${novelty.classification} (confidence ${novelty.confidence.toFixed(2)})`,
	]);

	if (novelty.isSubstantiveUpdate) {
		pushUnique(evidence, [
			"Substantive update to a previously reported development",
		]);
	}
	if (novelty.isNewlyRevealedFact) {
		pushUnique(evidence, [
			"Newly revealed facts about an older underlying event",
		]);
	}
	if (candidate.timestamps.underlyingEventDate) {
		pushUnique(evidence, [
			`Underlying event date ${candidate.timestamps.underlyingEventDate} differs from the disclosure date`,
		]);
	}

	let level: ReadinessLevel = readiness.level;
	switch (candidate.temporalEligibility.status) {
		case "NEW_PASS":
			if (
				historicalRelationship?.classification === "REPEATED_REPORTING"
			) {
				level = "low";
				pushUnique(evidence, [
					"Historical regression finds no qualifying new material.",
				]);
			} else if (
				historicalRelationship?.classification ===
					"SUBSTANTIVE_UPDATE" ||
				novelty.isSubstantiveUpdate ||
				novelty.isNewlyRevealedFact
			) {
				level = "high";
			} else if (level === "unclear") {
				level = "medium";
			}
			break;
		case "CATCH_UP":
			level = "medium";
			pushUnique(evidence, [
				"Explicitly dated older material; eligible only as catch-up.",
			]);
			break;
		case "NEW_FAIL":
			level = "low";
			pushUnique(evidence, [
				"In-window repost/summary of established information.",
			]);
			break;
		case "TIME_UNVERIFIED":
			level = "unclear";
			pushUnique(evidence, ["Disclosure time could not be verified."]);
			break;
	}

	if (historicalRelationship?.classification === "RELATED_CONTEXT") {
		level = level === "high" ? "medium" : level;
		pushUnique(evidence, [
			"Historical regression treats this as related background context.",
		]);
	}

	return {
		dimension: "material-novelty",
		level,
		score: levelValue(level),
		evidence: [...new Set(evidence)].sort(),
		traceableTo: [...new Set(traceableTo)].sort(),
		weight: DEFAULT_DIMENSION_WEIGHTS["material-novelty"],
		role: "primary",
	};
}

/**
 * Assess dimension B — scientific and technical significance.
 */
function assessScientificTechnicalSignificance(
	candidate: CanonicalCandidate,
): EditorialDimensionAssessment {
	const readiness =
		candidate.editorialReadiness.technicalScientificSignificance;
	const evidence: string[] = [...readiness.evidence];
	const traceableTo = [...readiness.traceableTo];
	const claims = candidate.claims;

	const scientific = claims.filter(
		(claim) =>
			claim.claimType === "scientific-research" ||
			claim.claimType === "benchmark-result",
	);
	const technical = claims.filter(
		(claim) =>
			claim.claimType === "technical-announcement" ||
			claim.claimType === "software-release" ||
			claim.claimType === "security-vulnerability",
	);
	const methodology = claims.filter(
		(claim) =>
			claim.methodologicalContext?.methodology ||
			claim.methodologicalContext?.studyDesign,
	);
	const reproducible = claims.filter(
		(claim) =>
			claim.methodologicalContext?.reproducibility?.artifactAvailable,
	);
	const independentlyReplicated = claims.filter(
		(claim) =>
			(claim.methodologicalContext?.reproducibility
				?.independentReplications ?? 0) > 0 ||
			claim.independentCorroboration?.established === true,
	);
	const highVerification = claims.filter(
		(claim) =>
			claim.verificationLevel === "L2" ||
			claim.verificationLevel === "L3",
	);

	pushUnique(evidence, [
		`Claim types: ${claimTypeSummary(claims) || "none"}`,
		`${scientific.length} scientific/benchmark claim(s), ${technical.length} technical claim(s)`,
	]);
	if (methodology.length > 0)
		pushUnique(evidence, ["Methodology or study design documented"]);
	if (reproducible.length > 0)
		pushUnique(evidence, ["Reproduction artifact available"]);
	if (independentlyReplicated.length > 0) {
		pushUnique(evidence, [
			"Independent replication or corroboration recorded",
		]);
	}
	if (highVerification.length > 0) {
		pushUnique(evidence, [
			`${highVerification.length} claim(s) verified at L2 or L3`,
		]);
	}

	let level: ReadinessLevel = readiness.level;
	const releasedWithCapabilities = claims.some(
		(claim) =>
			(claim.technicalContext?.implementationStatus === "released" ||
				claim.technicalContext?.releaseMaturity === "ga") &&
			(claim.technicalContext?.capabilities?.length ?? 0) > 0,
	);
	const strategicResearchWithMethodology = claims.some(
		(claim) =>
			(claim.claimType === "strategic-research" ||
				claim.claimType === "advisory-finding") &&
			(claim.strategicContext?.researchPurpose ||
				claim.strategicContext?.researchPeriod),
	);
	const securityWithMechanism = claims.some(
		(claim) =>
			claim.claimType === "security-vulnerability" &&
			((claim.technicalContext?.securityAssumptions?.length ?? 0) > 0 ||
				(claim.technicalContext?.trustBoundaries?.length ?? 0) > 0),
	);

	if (
		scientific.length > 0 &&
		(methodology.length > 0 || reproducible.length > 0)
	) {
		level =
			highVerification.length > 0 || independentlyReplicated.length > 0
				? "high"
				: "medium";
	} else if (scientific.length > 0 || technical.length > 0) {
		level =
			releasedWithCapabilities ||
			securityWithMechanism ||
			strategicResearchWithMethodology
				? level === "low" || level === "unclear"
					? "medium"
					: level
				: level === "unclear"
					? "medium"
					: level;
	} else if (strategicResearchWithMethodology) {
		level = level === "unclear" ? "medium" : level;
	} else if (level === "unclear") {
		level = "low";
	}

	return {
		dimension: "scientific-technical-significance",
		level,
		score: levelValue(level),
		evidence: [...new Set(evidence)].sort(),
		traceableTo: [...new Set(traceableTo)].sort(),
		weight: DEFAULT_DIMENSION_WEIGHTS["scientific-technical-significance"],
		role: "primary",
	};
}

/**
 * Assess dimension C — real-world consequences.
 */
function assessRealWorldConsequences(
	candidate: CanonicalCandidate,
): EditorialDimensionAssessment {
	const readiness = candidate.editorialReadiness.realWorldConsequences;
	const evidence: string[] = [...readiness.evidence];
	const traceableTo = [...readiness.traceableTo];
	const claims = candidate.claims;

	const applied = claims.filter((claim) =>
		APPLIED_CLAIM_TYPES.has(claim.claimType),
	);
	const measured = claims.filter((claim) =>
		Boolean(claim.strategicContext?.measuredOutcome),
	);
	const withBaseline = claims.filter((claim) =>
		Boolean(claim.strategicContext?.baseline),
	);
	const demonstrated = claims.filter(
		(claim) =>
			claim.technicalContext?.implementationStatus === "released" ||
			claim.technicalContext?.releaseMaturity === "ga",
	);
	const scientific = claims.filter(
		(claim) =>
			claim.claimType === "scientific-research" ||
			claim.claimType === "benchmark-result",
	);
	const technical = claims.filter(
		(claim) =>
			claim.claimType === "technical-announcement" ||
			claim.claimType === "software-release" ||
			claim.claimType === "security-vulnerability",
	);
	const reproducible = claims.filter(
		(claim) =>
			claim.methodologicalContext?.reproducibility?.artifactAvailable,
	);

	pushUnique(evidence, [
		`${applied.length} applied claim(s) with direct operational consequences`,
	]);
	if (measured.length > 0)
		pushUnique(evidence, [
			`${measured.length} claim(s) with a measured outcome`,
		]);
	if (withBaseline.length > 0)
		pushUnique(evidence, [
			`${withBaseline.length} claim(s) with a baseline`,
		]);
	if (demonstrated.length > 0) {
		pushUnique(evidence, [
			`${demonstrated.length} claim(s) describe released/GA capabilities`,
		]);
	}

	let level: ReadinessLevel = readiness.level;
	const releasedWithCapabilities =
		demonstrated.length > 0 &&
		claims.some(
			(claim) => (claim.technicalContext?.capabilities?.length ?? 0) > 0,
		);
	const scientificReproducible =
		scientific.length > 0 && reproducible.length > 0;
	const securityDisclosed = claims.some(
		(claim) =>
			claim.claimType === "security-vulnerability" &&
			(claim.technicalContext?.releaseMaturity === "ga" ||
				claim.technicalContext?.implementationStatus === "released"),
	);

	if (
		applied.length >= 2 ||
		(applied.length === 1 && measured.length > 0) ||
		securityDisclosed
	) {
		level = "high";
	} else if (
		applied.length === 1 ||
		releasedWithCapabilities ||
		scientificReproducible
	) {
		level = level === "unclear" ? "medium" : level;
	} else if (scientific.length > 0 || technical.length > 0) {
		level = level === "unclear" ? "low" : level;
	} else if (level === "unclear") {
		level = "low";
	}

	return {
		dimension: "real-world-consequences",
		level,
		score: levelValue(level),
		evidence: [...new Set(evidence)].sort(),
		traceableTo: [...new Set(traceableTo)].sort(),
		weight: DEFAULT_DIMENSION_WEIGHTS["real-world-consequences"],
		role: "primary",
	};
}

/**
 * Assess dimension D — strategic and economic significance.
 * Strategic research competes on the same evidence-backed criteria as technical
 * announcements; publisher reputation confers no priority.
 */
function assessStrategicEconomicSignificance(
	candidate: CanonicalCandidate,
): EditorialDimensionAssessment {
	const readiness =
		candidate.editorialReadiness.enterpriseEconomicImplications;
	const evidence: string[] = [...readiness.evidence];
	const traceableTo = [...readiness.traceableTo];
	const claims = candidate.claims;

	const strategic = claims.filter((claim) =>
		STRATEGIC_CLAIM_TYPES.has(claim.claimType),
	);
	const economicImpact = claims.filter(
		(claim) =>
			(claim.strategicContext?.economicImpact?.length ?? 0) > 0 ||
			(claim.strategicContext?.productivityConsequences?.length ?? 0) >
				0 ||
			(claim.strategicContext?.workforceImplications?.length ?? 0) > 0 ||
			(claim.strategicContext?.governanceImplications?.length ?? 0) > 0,
	);
	const withMethodology = claims.filter(
		(claim) =>
			claim.strategicContext?.researchPurpose ||
			claim.strategicContext?.researchPeriod,
	);
	const withSample = claims.filter(
		(claim) => typeof claim.strategicContext?.sampleSize === "number",
	);
	const withUncertainty = claims.filter(
		(claim) =>
			Boolean(claim.strategicContext?.statisticalUncertainty) ||
			Boolean(claim.strategicContext?.generalizability),
	);

	pushUnique(evidence, [
		`${strategic.length} strategic/economic claim(s): ${claimTypeSummary(strategic) || "none"}`,
	]);
	if (economicImpact.length > 0) {
		pushUnique(evidence, [
			"Economic, productivity, workforce or governance implications documented",
		]);
	}
	if (withMethodology.length > 0)
		pushUnique(evidence, ["Research methodology disclosed"]);
	if (withSample.length > 0) {
		pushUnique(evidence, [
			`Sample size documented (${withSample.length} claim(s))`,
		]);
	}
	if (withUncertainty.length > 0) {
		pushUnique(evidence, [
			"Statistical uncertainty or generalizability documented",
		]);
	}

	let level: ReadinessLevel = readiness.level;
	if (
		strategic.length > 0 &&
		economicImpact.length > 0 &&
		withMethodology.length > 0
	) {
		level = "high";
	} else if (strategic.length > 0 && economicImpact.length > 0) {
		level = level === "unclear" ? "medium" : level;
	} else if (strategic.length > 0) {
		level = level === "unclear" ? "medium" : level;
	} else if (level === "unclear") {
		level = "low";
	}

	return {
		dimension: "strategic-economic-significance",
		level,
		score: levelValue(level),
		evidence: [...new Set(evidence)].sort(),
		traceableTo: [...new Set(traceableTo)].sort(),
		weight: DEFAULT_DIMENSION_WEIGHTS["strategic-economic-significance"],
		role: "primary",
	};
}

/**
 * Assess dimension E — evidence strength and uncertainty.
 * Combines the inherited evidence-strength indicator with evidence limitations:
 * strong evidence with high limitations is not treated as strong.
 */
function assessEvidenceStrength(
	candidate: CanonicalCandidate,
	eligibility: EditorialEligibility,
): EditorialDimensionAssessment {
	const strength = candidate.editorialReadiness.evidenceStrength;
	const limitations = candidate.editorialReadiness.evidenceLimitations;
	const evidence: string[] = [...strength.evidence, ...limitations.evidence];
	const traceableTo = [...strength.traceableTo, ...limitations.traceableTo];

	const corroborated = candidate.claims.filter(
		(claim) => claim.independentCorroboration?.established,
	);
	const counterevidence = candidate.claims.filter(
		(claim) => claim.contradictoryEvidence.length > 0,
	);
	const blocking = candidate.claims.flatMap((claim) =>
		claim.uncertainty.unresolved.filter(
			(uncertainty) => uncertainty.blocking,
		),
	);
	const unresolved = candidate.claims.flatMap(
		(claim) => claim.uncertainty.unresolved,
	);
	const uninspectable = candidate.claims.filter(
		(claim) =>
			claim.verificationRationale.toLowerCase().includes("paywall") ||
			claim.limitingEvidence.some((limit) =>
				limit.toLowerCase().includes("paywall"),
			),
	);

	pushUnique(evidence, [
		`Evidence sufficiency: ${eligibility.evidenceSufficiency}`,
		`${corroborated.length} claim(s) with independent corroboration`,
		`${counterevidence.length} claim(s) with contradictory evidence`,
		`${blocking.length} blocking unresolved uncertainty(ies)`,
	]);
	if (unresolved.length > 0) {
		pushUnique(evidence, [
			`${unresolved.length} unresolved uncertainty(ies) recorded`,
		]);
	}
	if (uninspectable.length > 0) {
		pushUnique(evidence, ["Paywall or inaccessible methodology noted"]);
	}

	const strengthValue = levelValue(strength.level);
	const limitationValue = levelValue(limitations.level);
	const score =
		Math.round((0.7 * strengthValue + 0.3 * (1 - limitationValue)) * 1000) /
		1000;

	let level: ReadinessLevel;
	if (score >= 0.8) level = "high";
	else if (score >= 0.5) level = "medium";
	else if (score > 0) level = "low";
	else level = "unclear";

	return {
		dimension: "evidence-strength",
		level,
		score,
		evidence: [...new Set(evidence)].sort(),
		traceableTo: [...new Set(traceableTo)].sort(),
		weight: DEFAULT_DIMENSION_WEIGHTS["evidence-strength"],
		role: "primary",
	};
}

/**
 * Assess dimension F — generalizability and learning value.
 */
function assessGeneralizability(
	candidate: CanonicalCandidate,
): EditorialDimensionAssessment {
	const readiness = candidate.editorialReadiness.generalizability;
	const evidence: string[] = [...readiness.evidence];
	const traceableTo = [...readiness.traceableTo];

	const withScope = candidate.claims.filter(
		(claim) =>
			claim.strategicContext?.generalizability !== undefined ||
			claim.strategicContext?.sampleSize !== undefined ||
			claim.strategicContext?.geographicScope !== undefined ||
			claim.strategicContext?.industryCoverage !== undefined,
	);
	const multiDomain = candidate.researchDomains.length > 1;
	const crossVendor = candidate.organizations.length > 1;

	pushUnique(evidence, [
		`${withScope.length} claim(s) with documented research scope`,
		`${candidate.researchDomains.length} research domain(s)`,
	]);
	if (multiDomain) pushUnique(evidence, ["Spans multiple research domains"]);
	if (crossVendor) {
		pushUnique(evidence, [
			`Involves multiple organizations (${candidate.organizations.join(", ")})`,
		]);
	}

	let level: ReadinessLevel = readiness.level;
	const scientificWithMethodology = candidate.claims.some(
		(claim) =>
			(claim.claimType === "scientific-research" ||
				claim.claimType === "benchmark-result") &&
			(claim.methodologicalContext?.methodology ||
				claim.methodologicalContext?.studyDesign),
	);
	if (withScope.length > 0 && (multiDomain || crossVendor)) {
		level = level === "low" || level === "unclear" ? "medium" : "high";
	} else if (withScope.length > 0) {
		level = level === "unclear" ? "medium" : level;
	} else if (scientificWithMethodology) {
		level = level === "low" || level === "unclear" ? "medium" : level;
	} else if (level === "unclear") {
		level = "low";
	}

	return {
		dimension: "generalizability-learning-value",
		level,
		score: levelValue(level),
		evidence: [...new Set(evidence)].sort(),
		traceableTo: [...new Set(traceableTo)].sort(),
		weight: DEFAULT_DIMENSION_WEIGHTS["generalizability-learning-value"],
		role: "primary",
	};
}

/**
 * Assess dimension G — engineering and architectural relevance.
 * Recorded for every candidate; used as a secondary consideration only.
 */
function assessEngineeringRelevance(
	candidate: CanonicalCandidate,
): EditorialDimensionAssessment {
	const readiness =
		candidate.editorialReadiness.practicalEngineeringRelevance;
	const evidence: string[] = [...readiness.evidence];
	const traceableTo = [...readiness.traceableTo];

	const agentic = candidate.claims.filter(
		(claim) =>
			(claim.technicalContext?.agenticImplications?.length ?? 0) > 0 ||
			claim.claimType === "software-release",
	);
	const security = candidate.claims.filter(
		(claim) =>
			(claim.technicalContext?.securityAssumptions?.length ?? 0) > 0 ||
			(claim.technicalContext?.trustBoundaries?.length ?? 0) > 0 ||
			claim.claimType === "security-vulnerability",
	);
	const interoperability = candidate.claims.filter(
		(claim) =>
			(claim.technicalContext?.compatibility?.length ?? 0) > 0 ||
			candidate.researchDomains.includes(
				"architecture-interoperability-open-standards",
			),
	);

	pushUnique(evidence, [
		`${agentic.length} claim(s) with agentic/workflow implications`,
		`${security.length} claim(s) with security or trust-boundary implications`,
		`${interoperability.length} claim(s) with interoperability implications`,
	]);

	let level: ReadinessLevel = readiness.level;
	if (
		(agentic.length > 0 && security.length > 0) ||
		(security.length > 0 && interoperability.length > 0)
	) {
		level = "high";
	} else if (
		agentic.length > 0 ||
		security.length > 0 ||
		interoperability.length > 0
	) {
		level = level === "unclear" ? "medium" : level;
	} else if (level === "unclear") {
		level = "low";
	}

	return {
		dimension: "engineering-architectural-relevance",
		level,
		score: levelValue(level),
		evidence: [...new Set(evidence)].sort(),
		traceableTo: [...new Set(traceableTo)].sort(),
		weight: DEFAULT_DIMENSION_WEIGHTS[
			"engineering-architectural-relevance"
		],
		role: "secondary",
	};
}

/**
 * Assess dimension H — availability and maturity.
 * Recorded as contextual information; informs recommended explanation depth.
 */
function assessAvailabilityMaturity(
	candidate: CanonicalCandidate,
): EditorialDimensionAssessment {
	const readiness = candidate.editorialReadiness.availabilityMaturity;
	const evidence: string[] = [...readiness.evidence];
	const traceableTo = [...readiness.traceableTo];

	const maturities = candidate.claims
		.map((claim) => claim.technicalContext?.releaseMaturity)
		.filter((value): value is NonNullable<typeof value> => Boolean(value));
	const implementations = candidate.claims
		.map((claim) => claim.technicalContext?.implementationStatus)
		.filter((value): value is NonNullable<typeof value> => Boolean(value));
	const limitations = candidate.claims.flatMap(
		(claim) => claim.technicalContext?.limitations ?? [],
	);
	const compatibility = candidate.claims.flatMap(
		(claim) => claim.technicalContext?.compatibility ?? [],
	);

	pushUnique(evidence, [
		...maturities.map((value) => `Release maturity: ${value}`),
		...implementations.map((value) => `Implementation status: ${value}`),
	]);
	if (limitations.length > 0) {
		pushUnique(evidence, [`Documented limitations: ${limitations.length}`]);
	}
	if (compatibility.length > 0) {
		pushUnique(evidence, [
			`Compatibility considerations: ${compatibility.length}`,
		]);
	}

	let level: ReadinessLevel = readiness.level;
	if (maturities.includes("ga") || implementations.includes("released")) {
		level = "high";
	} else if (
		maturities.includes("preview") ||
		implementations.includes("preview")
	) {
		level = level === "unclear" ? "medium" : level;
	} else if (
		maturities.includes("experimental") ||
		maturities.includes("deprecated")
	) {
		level = "low";
	}

	return {
		dimension: "availability-maturity",
		level,
		score: levelValue(level),
		evidence: [...new Set(evidence)].sort(),
		traceableTo: [...new Set(traceableTo)].sort(),
		weight: DEFAULT_DIMENSION_WEIGHTS["availability-maturity"],
		role: "contextual",
	};
}

/**
 * Assess all eight dimensions for one candidate. Pure and deterministic.
 */
export function assessDimensions(
	candidate: CanonicalCandidate,
	eligibility: EditorialEligibility,
	historicalRelationship: HistoricalRelationship | undefined,
): EditorialDimensionAssessment[] {
	return [
		assessMaterialNovelty(candidate, eligibility, historicalRelationship),
		assessScientificTechnicalSignificance(candidate),
		assessRealWorldConsequences(candidate),
		assessStrategicEconomicSignificance(candidate),
		assessEvidenceStrength(candidate, eligibility),
		assessGeneralizability(candidate),
		assessEngineeringRelevance(candidate),
		assessAvailabilityMaturity(candidate),
	];
}

/**
 * Compute the documented materiality heuristic from dimension assessments.
 * Primary dimensions are weighted; secondary and contextual dimensions are
 * excluded from the score by weight 0.
 *
 * `exclude` optionally removes one dimension from the weighting. This is used
 * for "potential materiality": when a candidate is blocked by an unresolved
 * temporal or evidence failure, importance is judged on the dimensions that are
 * not blocked, so the blocked dimension does not mask genuine consequence.
 */
export function computeMateriality(
	dimensions: EditorialDimensionAssessment[],
	config: EditorialSelectionConfig = {
		weights: DEFAULT_DIMENSION_WEIGHTS,
	} as EditorialSelectionConfig,
	exclude?: EditorialDimension,
): { score: number; level: ReadinessLevel } {
	let weightedSum = 0;
	let weightTotal = 0;
	for (const dimension of dimensions) {
		if (exclude && dimension.dimension === exclude) continue;
		const weight = config.weights[dimension.dimension] ?? dimension.weight;
		if (weight <= 0) continue;
		weightedSum += weight * dimension.score;
		weightTotal += weight;
	}
	const score =
		weightTotal === 0
			? 0
			: Math.round((weightedSum / weightTotal) * 1000) / 1000;

	let level: ReadinessLevel;
	if (score >= config.majorThreshold) level = "high";
	else if (score >= config.selectThreshold) level = "medium";
	else if (score > 0) level = "low";
	else level = "unclear";

	return { score, level };
}
