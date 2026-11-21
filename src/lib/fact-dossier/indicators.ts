/**
 * Canonical Fact Dossier — Editorial Readiness Indicators
 *
 * Produces descriptive, evidence-backed indicators that prepare the dossier for
 * the subsequent omission review and editorial ranking stages. The indicators
 * deliberately avoid:
 *   - fixed vendor quotas or topic weights,
 *   - automatic publication decisions,
 *   - final editorial ranking.
 *
 * Every indicator carries the evidence it was derived from and the stable
 * identifiers it is traceable to, so downstream stages can audit each claim.
 */

import type {
	CanonicalCandidateCore,
	ClaimType,
	EditorialReadinessIndicators,
	ReadinessIndicator,
	ReadinessLevel,
	TemporalEligibilityStatus,
} from "./schema.js";

/** Claim types that carry strategic, organizational or economic substance. */
const STRATEGIC_CLAIM_TYPES: ReadonlySet<ClaimType> = new Set<ClaimType>([
	"strategic-research",
	"advisory-finding",
	"enterprise-adoption",
	"productivity-claim",
	"roi-claim",
	"economic-impact",
]);

/** Claim types with direct real-world operational consequences. */
const APPLIED_CLAIM_TYPES: ReadonlySet<ClaimType> = new Set<ClaimType>([
	"enterprise-adoption",
	"productivity-claim",
	"economic-impact",
	"security-vulnerability",
	"policy-regulation",
]);

const VERIFICATION_LEVEL_ORDER: Record<string, number> = {
	L0: 0,
	L1: 1,
	L2: 2,
	L3: 3,
};

export interface IndicatorContext {
	/** All candidates consolidated for the same edition (used for overlap detection). */
	editionCandidates: CanonicalCandidateCore[];
	/** Edition date (YYYY-MM-DD). */
	editionDate: string;
}

function makeIndicator(
	level: ReadinessLevel,
	evidence: string[],
	traceableTo: string[],
	fallbackEvidence?: string,
): ReadinessIndicator {
	const resolved =
		evidence.length === 0 && fallbackEvidence
			? [fallbackEvidence]
			: [...new Set(evidence)].sort();
	return {
		level,
		evidence: resolved,
		traceableTo: [...new Set(traceableTo)].sort(),
	};
}

function average(values: number[]): number {
	return values.length === 0
		? 0
		: values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Compute all editorial readiness indicators for a canonical candidate.
 * Pure and deterministic: same candidate + edition context ⇒ same indicators.
 */
export function computeEditorialReadinessIndicators(
	candidate: CanonicalCandidateCore,
	context: IndicatorContext,
): EditorialReadinessIndicators {
	const claims = candidate.claims;
	const claimIds = claims.map((c) => c.claimId);
	const sourceIds = candidate.sources.map((s) => s.sourceId);
	const baseTraceableTo = [candidate.candidateId, ...claimIds, ...sourceIds];

	// --------------------------------------------------------------------------
	// 1. Material novelty
	// --------------------------------------------------------------------------
	const temporalEligibility: TemporalEligibilityStatus =
		candidate.temporalEligibility.status;
	const novelty = candidate.temporalEligibility.noveltyClassification;
	const noveltyEvidence: string[] = [
		`Temporal eligibility: ${temporalEligibility}`,
		`Inherited novelty classification: ${novelty.classification} (confidence ${novelty.confidence.toFixed(2)})`,
	];
	if (novelty.isSubstantiveUpdate) {
		noveltyEvidence.push(
			"Substantive update to a previously reported development",
		);
	}
	if (novelty.isNewlyRevealedFact) {
		noveltyEvidence.push(
			"Newly revealed facts about an older underlying event",
		);
	}
	let materialNovelty: ReadinessLevel;
	switch (temporalEligibility) {
		case "NEW_PASS":
			materialNovelty = novelty.confidence >= 0.85 ? "high" : "medium";
			noveltyEvidence.push(
				"Material information first publicly disclosed inside the edition window",
			);
			break;
		case "CATCH_UP":
			materialNovelty = "medium";
			noveltyEvidence.push(
				"Explicitly dated older material with traceable evidence",
			);
			break;
		case "NEW_FAIL":
			materialNovelty = "low";
			noveltyEvidence.push(
				"In-window item identified as a repost/summary of established information",
			);
			break;
		case "TIME_UNVERIFIED":
			materialNovelty = "unclear";
			noveltyEvidence.push(
				"Publication/disclosure time could not be verified",
			);
			break;
	}

	// --------------------------------------------------------------------------
	// 2. Technical or scientific significance
	// --------------------------------------------------------------------------
	const scientificClaims = claims.filter(
		(c) =>
			c.claimType === "scientific-research" ||
			c.claimType === "benchmark-result",
	);
	const technicalClaims = claims.filter(
		(c) =>
			c.claimType === "technical-announcement" ||
			c.claimType === "software-release" ||
			c.claimType === "security-vulnerability",
	);
	const hasMethodology = claims.some(
		(c) =>
			c.methodologicalContext?.methodology ||
			c.methodologicalContext?.studyDesign,
	);
	const hasReproducibility = claims.some(
		(c) => c.methodologicalContext?.reproducibility?.artifactAvailable,
	);
	const hasHighVerification = claims.some(
		(c) => c.verificationLevel === "L2" || c.verificationLevel === "L3",
	);
	const technicalEvidence: string[] = [];
	if (scientificClaims.length > 0) {
		technicalEvidence.push(
			`${scientificClaims.length} scientific-research/benchmark claim(s)`,
		);
	}
	if (technicalClaims.length > 0) {
		technicalEvidence.push(
			`${technicalClaims.length} technical-announcement/software-release/security claim(s)`,
		);
	}
	if (hasMethodology)
		technicalEvidence.push("Methodology or study design documented");
	if (hasReproducibility)
		technicalEvidence.push("Reproduction artifact available");
	if (hasHighVerification)
		technicalEvidence.push("At least one claim verified at L2 or L3");
	let technicalScientificSignificance: ReadinessLevel;
	if (
		scientificClaims.length > 0 &&
		(hasMethodology || hasReproducibility) &&
		hasHighVerification
	) {
		technicalScientificSignificance = "high";
	} else if (
		scientificClaims.length > 0 ||
		(technicalClaims.length > 0 && hasMethodology)
	) {
		technicalScientificSignificance = "medium";
	} else if (technicalClaims.length > 0) {
		technicalScientificSignificance = "low";
	} else {
		technicalScientificSignificance = "unclear";
	}

	// --------------------------------------------------------------------------
	// 3. Real-world consequences
	// --------------------------------------------------------------------------
	const appliedClaims = claims.filter((c) =>
		APPLIED_CLAIM_TYPES.has(c.claimType),
	);
	const hasMeasuredOutcome = claims.some((c) =>
		Boolean(c.strategicContext?.measuredOutcome),
	);
	const realWorldEvidence: string[] = appliedClaims.map(
		(c) => `${c.claimType}: ${c.claimStatement.slice(0, 120)}`,
	);
	if (hasMeasuredOutcome)
		realWorldEvidence.push("Measured outcome with baseline reported");
	let realWorldConsequences: ReadinessLevel;
	if (
		appliedClaims.length >= 2 ||
		(appliedClaims.length === 1 && hasMeasuredOutcome)
	) {
		realWorldConsequences = "high";
	} else if (appliedClaims.length === 1) {
		realWorldConsequences = "medium";
	} else {
		realWorldConsequences = "unclear";
	}

	// --------------------------------------------------------------------------
	// 4. Enterprise and economic implications
	// --------------------------------------------------------------------------
	const economicClaims = claims.filter((c) =>
		STRATEGIC_CLAIM_TYPES.has(c.claimType),
	);
	const hasEconomicImpact = claims.some(
		(c) =>
			(c.strategicContext?.economicImpact?.length ?? 0) > 0 ||
			(c.strategicContext?.productivityConsequences?.length ?? 0) > 0,
	);
	const hasBaseline = claims.some((c) =>
		Boolean(c.strategicContext?.baseline),
	);
	const enterpriseEvidence: string[] = economicClaims.map(
		(c) => `${c.claimType}: ${c.claimStatement.slice(0, 120)}`,
	);
	if (hasEconomicImpact)
		enterpriseEvidence.push(
			"Economic impact, ROI or productivity consequences documented",
		);
	if (hasBaseline)
		enterpriseEvidence.push("Baseline/comparison group documented");
	let enterpriseEconomicImplications: ReadinessLevel;
	if (economicClaims.length > 0 && hasEconomicImpact && hasBaseline) {
		enterpriseEconomicImplications = "high";
	} else if (economicClaims.length > 0) {
		enterpriseEconomicImplications = "medium";
	} else {
		enterpriseEconomicImplications = "unclear";
	}

	// --------------------------------------------------------------------------
	// 5. Generalizability
	// --------------------------------------------------------------------------
	const withResearchContext = claims.filter(
		(c) =>
			c.strategicContext?.generalizability !== undefined ||
			c.strategicContext?.sampleSize !== undefined ||
			c.strategicContext?.geographicScope !== undefined ||
			c.strategicContext?.industryCoverage !== undefined,
	);
	const smallSample = claims.some(
		(c) =>
			c.strategicContext?.sampleSize !== undefined &&
			c.strategicContext.sampleSize < 100,
	);
	const scopeLimited = claims.some(
		(c) =>
			Boolean(c.strategicContext?.geographicScope) ||
			Boolean(c.strategicContext?.industryCoverage),
	);
	const generalizabilityUncertainty = claims.some((c) =>
		c.uncertainty.unresolved.some(
			(u) => u.type === "generalizability" || u.type === "scope",
		),
	);
	const generalizabilityEvidence: string[] = [];
	if (withResearchContext.length > 0) {
		generalizabilityEvidence.push(
			`${withResearchContext.length} claim(s) with documented research scope`,
		);
	}
	if (smallSample)
		generalizabilityEvidence.push(
			"Sample size below 100 — limited generalizability",
		);
	if (scopeLimited)
		generalizabilityEvidence.push(
			"Geographic or industry scope explicitly bounded",
		);
	if (generalizabilityUncertainty) {
		generalizabilityEvidence.push(
			"Unresolved generalizability/scope uncertainty recorded",
		);
	}
	let generalizability: ReadinessLevel;
	if (withResearchContext.length === 0) {
		generalizability = "unclear";
	} else if (smallSample || generalizabilityUncertainty) {
		generalizability = "low";
	} else {
		generalizability = "medium";
	}

	// --------------------------------------------------------------------------
	// 6. Strength of evidence
	// --------------------------------------------------------------------------
	const averageLevel = average(
		claims.map((c) => VERIFICATION_LEVEL_ORDER[c.verificationLevel] ?? 0),
	);
	const averageConfidence = average(claims.map((c) => c.confidence));
	const hasCounterevidence = claims.some(
		(c) => c.contradictoryEvidence.length > 0,
	);
	const hasCorroboration = claims.some(
		(c) => c.independentCorroboration?.established,
	);
	const evidenceStrengthEvidence: string[] = [
		`Average verification level: ${averageLevel.toFixed(2)} (L0-L3 scale)`,
		`Average claim confidence: ${averageConfidence.toFixed(2)}`,
	];
	if (hasCorroboration)
		evidenceStrengthEvidence.push("Independent corroboration established");
	if (hasCounterevidence)
		evidenceStrengthEvidence.push("Contradictory evidence present");
	let evidenceStrength: ReadinessLevel;
	if (hasCounterevidence) {
		evidenceStrength = "low";
	} else if (averageLevel >= 2 && hasCorroboration) {
		evidenceStrength = "high";
	} else if (averageLevel >= 1) {
		evidenceStrength = "medium";
	} else {
		evidenceStrength = "low";
	}

	// --------------------------------------------------------------------------
	// 7. Limitations of evidence
	// --------------------------------------------------------------------------
	const blockingUncertainties = claims.flatMap((c) =>
		c.uncertainty.unresolved.filter((u) => u.blocking),
	);
	const accessLimitedSources = candidate.sourceAccessibility.filter(
		(s) => s.limitations.length > 0,
	);
	const hasPaywall = claims.some(
		(c) =>
			c.verificationRationale.toLowerCase().includes("paywall") ||
			c.limitingEvidence.some((l) => l.toLowerCase().includes("paywall")),
	);
	const limitationsEvidence: string[] = [];
	if (hasCounterevidence)
		limitationsEvidence.push("Contradictory evidence present");
	if (blockingUncertainties.length > 0) {
		limitationsEvidence.push(
			`${blockingUncertainties.length} blocking unresolved uncertainties`,
		);
	}
	if (accessLimitedSources.length > 0) {
		limitationsEvidence.push(
			`${accessLimitedSources.length} source(s) with access limitations`,
		);
	}
	if (hasPaywall)
		limitationsEvidence.push("Paywall or inaccessible methodology noted");
	let evidenceLimitations: ReadinessLevel;
	if (hasCounterevidence || blockingUncertainties.length > 0) {
		evidenceLimitations = "high";
	} else if (
		accessLimitedSources.length > 0 ||
		claims.some((c) => c.uncertainty.unresolved.length > 0)
	) {
		evidenceLimitations = "medium";
	} else {
		evidenceLimitations = "low";
	}

	// --------------------------------------------------------------------------
	// 8. Practical engineering relevance
	// --------------------------------------------------------------------------
	const agenticImplications = claims.some(
		(c) =>
			(c.technicalContext?.agenticImplications?.length ?? 0) > 0 ||
			c.claimType === "software-release",
	);
	const securityRelevance = claims.some(
		(c) =>
			(c.technicalContext?.securityAssumptions?.length ?? 0) > 0 ||
			(c.technicalContext?.trustBoundaries?.length ?? 0) > 0,
	);
	const compatibilityRelevance = claims.some(
		(c) => (c.technicalContext?.compatibility?.length ?? 0) > 0,
	);
	const agenticDomain = candidate.researchDomains.includes(
		"agentic-ai-software-engineering",
	);
	const engineeringEvidence: string[] = [];
	if (agenticImplications)
		engineeringEvidence.push(
			"Agentic workflow or software-release implications documented",
		);
	if (securityRelevance)
		engineeringEvidence.push(
			"Security assumptions or trust boundaries documented",
		);
	if (compatibilityRelevance)
		engineeringEvidence.push(
			"Compatibility/interoperability considerations documented",
		);
	if (agenticDomain)
		engineeringEvidence.push(
			"Maps to the agentic AI & software engineering domain",
		);
	let practicalEngineeringRelevance: ReadinessLevel;
	if (
		(agenticImplications && agenticDomain) ||
		(securityRelevance && compatibilityRelevance)
	) {
		practicalEngineeringRelevance = "high";
	} else if (
		agenticImplications ||
		securityRelevance ||
		compatibilityRelevance
	) {
		practicalEngineeringRelevance = "medium";
	} else {
		practicalEngineeringRelevance = "unclear";
	}

	// --------------------------------------------------------------------------
	// 9. Availability and maturity
	// --------------------------------------------------------------------------
	const maturities = claims
		.map((c) => c.technicalContext?.releaseMaturity)
		.filter((m): m is NonNullable<typeof m> => Boolean(m));
	const implementationStatuses = claims
		.map((c) => c.technicalContext?.implementationStatus)
		.filter((s): s is NonNullable<typeof s> => Boolean(s));
	const availabilityEvidence: string[] = [
		...maturities.map((m) => `Release maturity: ${m}`),
		...implementationStatuses.map((s) => `Implementation status: ${s}`),
	];
	let availabilityMaturity: ReadinessLevel;
	if (
		maturities.includes("ga") ||
		implementationStatuses.includes("released")
	) {
		availabilityMaturity = "high";
	} else if (
		maturities.includes("preview") ||
		implementationStatuses.includes("preview")
	) {
		availabilityMaturity = "medium";
	} else if (
		maturities.includes("experimental") ||
		maturities.includes("deprecated")
	) {
		availabilityMaturity = "low";
	} else {
		availabilityMaturity = "unclear";
	}

	// --------------------------------------------------------------------------
	// 10. Potential overlap with other candidates
	// --------------------------------------------------------------------------
	const others = context.editionCandidates.filter(
		(c) => c.candidateId !== candidate.candidateId,
	);
	const candidateSourceIds = new Set(
		candidate.sources.map((s) => s.sourceId),
	);
	const candidateOrgs = new Set(candidate.organizations);
	const candidateTech = new Set(candidate.technologies);
	const sharedSourceCandidates = others.filter((o) =>
		o.sources.some((s) => candidateSourceIds.has(s.sourceId)),
	);
	const sharedOrgCandidates = others.filter((o) =>
		o.organizations.some((org) => candidateOrgs.has(org)),
	);
	const sharedTechCandidates = others.filter((o) =>
		o.technologies.some((t) => candidateTech.has(t)),
	);
	const previousSameEvent = candidate.previousCoverage.filter(
		(p) =>
			p.relationship === "same-event" ||
			p.relationship === "substantive-update",
	);
	const overlapEvidence: string[] = [];
	if (previousSameEvent.length > 0) {
		overlapEvidence.push(
			`${previousSameEvent.length} previous edition coverage(s) for the same event/development`,
		);
	}
	if (sharedSourceCandidates.length > 0) {
		overlapEvidence.push(
			`Shares a source with ${sharedSourceCandidates.length} other candidate(s)`,
		);
	}
	if (sharedOrgCandidates.length > 0) {
		overlapEvidence.push(
			`Shares an organization with ${sharedOrgCandidates.length} other candidate(s)`,
		);
	}
	if (sharedTechCandidates.length > 0) {
		overlapEvidence.push(
			`Shares a technology with ${sharedTechCandidates.length} other candidate(s)`,
		);
	}
	let potentialOverlap: ReadinessLevel;
	if (previousSameEvent.length > 0 || sharedSourceCandidates.length > 0) {
		potentialOverlap = "high";
	} else if (
		sharedOrgCandidates.length > 0 ||
		sharedTechCandidates.length > 0
	) {
		potentialOverlap = "medium";
	} else {
		potentialOverlap = "low";
	}

	return {
		materialNovelty: makeIndicator(materialNovelty, noveltyEvidence, [
			candidate.candidateId,
			"novelty-classification",
		]),
		technicalScientificSignificance: makeIndicator(
			technicalScientificSignificance,
			technicalEvidence,
			baseTraceableTo,
			"No technical or scientific claims recorded for this candidate.",
		),
		realWorldConsequences: makeIndicator(
			realWorldConsequences,
			realWorldEvidence,
			claimIds,
			"No applied claim types recorded for this candidate.",
		),
		enterpriseEconomicImplications: makeIndicator(
			enterpriseEconomicImplications,
			enterpriseEvidence,
			claimIds,
			"No strategic or economic claim types recorded for this candidate.",
		),
		generalizability: makeIndicator(
			generalizability,
			generalizabilityEvidence,
			claimIds,
			"No research scope context recorded for this candidate.",
		),
		evidenceStrength: makeIndicator(
			evidenceStrength,
			evidenceStrengthEvidence,
			baseTraceableTo,
		),
		evidenceLimitations: makeIndicator(
			evidenceLimitations,
			limitationsEvidence,
			baseTraceableTo,
			"No contradictory evidence, blocking uncertainties, or access limitations recorded.",
		),
		practicalEngineeringRelevance: makeIndicator(
			practicalEngineeringRelevance,
			engineeringEvidence,
			baseTraceableTo,
			"No engineering relevance signals recorded for this candidate.",
		),
		availabilityMaturity: makeIndicator(
			availabilityMaturity,
			availabilityEvidence,
			claimIds,
			"No release maturity or implementation status recorded for this candidate.",
		),
		potentialOverlap: makeIndicator(
			potentialOverlap,
			overlapEvidence,
			[candidate.candidateId, ...others.map((o) => o.candidateId)],
			"No overlapping sources, organizations, or technologies detected in this edition.",
		),
		selectionNote:
			"Descriptive indicators only — no editorial ranking, quotas, topic weights or publication decisions are made at this stage.",
	};
}
