/**
 * Editorial Selection — Synthetic Fixtures
 *
 * ⚠️  SYNTHETIC TEST DATA. Every edition, candidate, claim, source and
 * timestamp below is invented for editorial-selection testing. Nothing in this
 * file is a real research finding, vendor announcement, publication or
 * editorial judgement, and no fixture represents actually retrieved evidence.
 *
 * The fixtures cover the ten representative evaluation cases required by the
 * specification:
 *   1. A major scientific breakthrough competing with routine coding-agent releases.
 *   2. A significant GitHub Copilot CLI release with direct engineering consequences.
 *   3. An original Gartner/McKinsey/Forrester/IDC study identifying material
 *      enterprise AI adoption or productivity changes.
 *   4. A vendor-sponsored productivity claim with weak independent evidence.
 *   5. A newly disclosed security vulnerability affecting multiple agent platforms.
 *   6. A substantive update to an already covered AI model release.
 *   7. Multiple articles repeating the same underlying announcement.
 *   8. A quiet news day containing only a few eligible developments.
 *   9. A day genuinely dominated by one vendor's major releases.
 *  10. A candidate carrying critical unresolved evidence or temporal uncertainty.
 */

import crypto from "crypto";

import { getEditorialWindow } from "../editorial-window.js";
import { classifyNovelty } from "../novelty-classification.js";
import {
	SELECTION_NOTE,
	type CanonicalCandidate,
	type CanonicalCandidateCore,
	type CanonicalFactDossier,
	type ClaimType,
	type ConsolidatedClaim,
	type EvidenceClassification,
	type MethodologicalContext,
	type StrategicContext,
	type TechnicalContext,
	type VerificationStatus,
} from "../fact-dossier/schema.js";
import { computeDossierContentHash } from "../fact-dossier/canonical.js";
import { computeEditorialReadinessIndicators } from "../fact-dossier/indicators.js";
import { deriveTemporalEligibilityStatus } from "../fact-dossier/consolidator.js";
import type {
	HistoricalMatchEvidence,
	HistoricalRegressionReport,
	HistoricalRelationship,
	HistoricalRelationshipClassification,
	HistoricalRelationshipDerivation,
} from "../historical-regression/schema.js";
import type { OmissionReviewReport } from "../omission-review/types.js";

export const EDITION_DATE = "2025-01-15";
export const IN_WINDOW = "2025-01-14T12:00:00+01:00[Europe/Amsterdam]";
export const IN_WINDOW_LATE = "2025-01-15T01:30:00+01:00[Europe/Amsterdam]";
export const OUT_OF_WINDOW = "2025-01-06T09:00:00+01:00[Europe/Amsterdam]";
export const UNPARSEABLE_TIMESTAMP = "not-a-timestamp";

// ============================================================================
// Specification types
// ============================================================================

export interface ClaimSpec {
	key: string;
	text: string;
	claimType: ClaimType;
	classification: EvidenceClassification;
	verificationStatus: VerificationStatus;
	verificationLevel: "L0" | "L1" | "L2" | "L3";
	confidence: number;
	technicalContext?: TechnicalContext;
	methodologicalContext?: MethodologicalContext;
	strategicContext?: StrategicContext;
	counterevidenceCount?: number;
	blockingUncertainties?: {
		type: string;
		uncertainty: string;
		impact: "high" | "medium" | "low";
	}[];
	corroboration?: boolean;
}

export interface CandidateSpec {
	key: string;
	title: string;
	statement?: string;
	sourceId: string;
	sourceUrl: string;
	tier: 1 | 2 | 3;
	organizations?: string[];
	products?: string[];
	technologies?: string[];
	researchDomains?: string[];
	discoveryRings?: (1 | 2 | 3)[];
	publicationTimestamp: string;
	firstDisclosureTimestamp?: string;
	underlyingEventDate?: string;
	substantiveUpdateTimestamp?: string;
	isKnownUpdate?: boolean;
	updateDescription?: string;
	newlyRevealedFacts?: string[];
	/**
	 * When true, the novelty classifier derives the edition date from the
	 * publication timestamp instead of receiving it explicitly. This models the
	 * real pipeline behaviour for an unparseable timestamp, where the classifier
	 * must return TIME_UNVERIFIED rather than throw.
	 */
	deriveEditionDate?: boolean;
	/** Additional temporal evidence (for example archive snapshots) used by the novelty classifier. */
	additionalEvidence?: {
		type:
			| "source_publication_date"
			| "source_modification_date"
			| "archive_snapshot"
			| "author_statement"
			| "version_history";
		reference: string;
		timestamp: string;
		description: string;
		confidence: number;
	}[];
	claims: ClaimSpec[];
}

export interface FixtureEdition {
	editionDate: string;
	dossier: CanonicalFactDossier;
	omissionReview: OmissionReviewReport;
	historicalRegression: HistoricalRegressionReport;
}

// ============================================================================
// Identifier helpers
// ============================================================================

function sha16(value: string): string {
	return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

/** Map a fixture key to a stable identifier matching /^cand_[a-z0-9]{16}$/. */
export function fixtureCandidateId(key: string): string {
	return `cand_${sha16(`candidate:${key}`)}`;
}

/** Map a fixture key to a stable identifier matching /^claim_[a-z0-9]{16}$/. */
export function fixtureClaimId(key: string): string {
	return `claim_${sha16(`claim:${key}`)}`;
}

// ============================================================================
// Claim builder
// ============================================================================

function buildClaim(
	candidateId: string,
	sourceUrl: string,
	spec: ClaimSpec,
): ConsolidatedClaim {
	const counterevidenceCount = spec.counterevidenceCount ?? 0;
	const blocking = spec.blockingUncertainties ?? [];
	return {
		claimId: fixtureClaimId(spec.key),
		candidateId,
		claimStatement: spec.text,
		claimType: spec.claimType,
		evidenceClassification: spec.classification,
		supportingEvidenceUrls: [sourceUrl],
		independentCorroboration: {
			established: spec.corroboration ?? false,
			sourceIds: spec.corroboration
				? ["synthetic-independent-source"]
				: [],
			urls: spec.corroboration
				? ["https://example.com/synthetic-independent"]
				: [],
			note: spec.corroboration
				? "Independent corroboration established by the verification pipeline."
				: "No independent corroboration established in the verification pipeline.",
		},
		contradictoryEvidence: Array.from(
			{ length: counterevidenceCount },
			(_, index) => ({
				evidenceId: `ce_${sha16(`${spec.key}:${index}`)}`,
				sourceId: "synthetic-independent-source",
				url: "https://example.com/synthetic-counterevidence",
				contradictionType: "direct" as const,
				description:
					"Synthetic counterevidence attached by the fixture.",
				confidence: 0.8,
			}),
		),
		limitingEvidence: [],
		technicalContext: spec.technicalContext,
		methodologicalContext: spec.methodologicalContext,
		strategicContext: spec.strategicContext,
		confidence: spec.confidence,
		verificationLevel: spec.verificationLevel,
		verificationStatus: spec.verificationStatus,
		verificationRationale: "Synthetic fixture verification rationale.",
		verificationMethods: ["primary-source-inspection"],
		uncertainty: {
			unresolved: [
				...blocking.map((item) => ({
					type: item.type,
					uncertainty: item.uncertainty,
					impact: item.impact,
					blocking: true,
				})),
				...(counterevidenceCount > 0 && blocking.length === 0
					? [
							{
								type: "evidence-gap",
								uncertainty:
									"Synthetic counterevidence requires resolution.",
								impact: "high" as const,
								blocking: true,
							},
						]
					: []),
			],
			assumptions: [],
			falsificationCriteria: [],
		},
		sourceProvenance: {
			sourceId: "synthetic-source",
			url: sourceUrl,
			title: "Synthetic Source",
			publicationTimestamp: "2025-01-01T00:00:00Z",
			retrievedAt: `${EDITION_DATE}T06:00:00Z`,
			verificationTimestamp: `${EDITION_DATE}T06:00:00Z`,
			verifiedBy: "synthetic-verifier",
		},
		inclusionNote:
			"Synthetic fixture claim included for editorial-selection testing only.",
	};
}

// ============================================================================
// Candidate builder
// ============================================================================

function buildCandidateCore(
	spec: CandidateSpec,
	editionDate: string,
): CanonicalCandidateCore {
	const novelty = classifyNovelty({
		title: spec.title,
		summary: spec.statement ?? spec.title,
		proposedPublicationTimestamp: spec.publicationTimestamp,
		sourceUrls: [spec.sourceUrl],
		sourceTier: spec.tier,
		...(spec.deriveEditionDate ? {} : { editionDate }),
		isKnownUpdate: spec.isKnownUpdate ?? false,
		updateDescription: spec.updateDescription,
		newlyRevealedFacts: spec.newlyRevealedFacts ?? [],
		additionalEvidence: spec.additionalEvidence ?? [],
	});
	const status = deriveTemporalEligibilityStatus(novelty);
	const now = `${editionDate}T06:00:00Z`;
	const candidateId = fixtureCandidateId(spec.key);
	const window = getEditorialWindow(editionDate);

	return {
		candidateId,
		editionId: `edition_${editionDate}`,
		editionDate,
		factualHeadline: spec.title,
		exactStatement:
			spec.statement ??
			`${spec.title} — synthetic fixture statement describing what materially changed.`,
		researchDomains: spec.researchDomains ?? [
			"agentic-ai-software-engineering",
		],
		subdomainTags: [],
		discoveryRings: spec.discoveryRings ?? [
			spec.tier === 1 ? 2 : spec.tier === 2 ? 1 : 3,
		],
		organizations: spec.organizations ?? [],
		products: spec.products ?? [],
		technologies: spec.technologies ?? [],
		researchProjects: [],
		sources: [
			{
				sourceId: spec.sourceId,
				canonicalUrl: spec.sourceUrl,
				discoveryIds: [`disc_${sha16(candidateId)}`],
				retrievalStatus: "CHECKED_FOUND",
				accessedAt: now,
			},
		],
		timestamps: {
			originalPublicationTimestamp: spec.publicationTimestamp,
			earliestSupportedPublicDisclosureTimestamp:
				spec.firstDisclosureTimestamp ?? spec.publicationTimestamp,
			underlyingEventDate: spec.underlyingEventDate,
			substantiveUpdateTimestamp: spec.substantiveUpdateTimestamp,
			retrievalTimestamp: now,
			timezone: "Europe/Amsterdam",
			timestampConfidence: 0.95,
			timestampPrecision: "exact",
			timestampAvailability:
				spec.publicationTimestamp === UNPARSEABLE_TIMESTAMP
					? "unavailable"
					: "available",
		},
		temporalEligibility: {
			status,
			rationale: `Synthetic fixture eligibility: ${status}.`,
			noveltyClassification: novelty,
			editionBoundary: {
				start: window.start,
				end: window.end,
				timezone: "Europe/Amsterdam",
			},
			publicationTimestampUsed:
				novelty.primaryPublicationTimestamp || undefined,
			firstDisclosureTimestampUsed:
				spec.firstDisclosureTimestamp ?? spec.publicationTimestamp,
			underlyingEventTimestampUsed: spec.underlyingEventDate,
			derivedFrom: "novelty-classification",
			derivedAt: now,
		},
		previousCoverage: [],
		sourceAccessibility: [
			{
				sourceId: spec.sourceId,
				canonicalUrl: spec.sourceUrl,
				retrievalStatus: "CHECKED_FOUND",
				accessible: true,
				limitations: [],
			},
		],
		claims: spec.claims.map((claim) =>
			buildClaim(candidateId, spec.sourceUrl, claim),
		),
		unresolvedQuestions: [],
		evidenceGaps: [],
		processingStatus: "consolidated",
		audit: {
			discoveredAt: now,
			retrievedAt: now,
			noveltyClassifiedAt: now,
			consolidatedAt: now,
			consolidatedBy: "synthetic-editorial-selection-fixture",
			revision: 1,
		},
		provenance: {
			discoveryIds: [`disc_${sha16(candidateId)}`],
			candidateStableId: candidateId,
			pipeline: [
				"source-discovery",
				"retrieval",
				"temporal-classification",
				"claim-verification",
				"canonical-fact-dossier",
			],
			consumedFrom: [
				"candidate-news",
				"novelty-classification",
				"evidence-verification",
			],
		},
	};
}

// ============================================================================
// Dossier builder
// ============================================================================

function buildEditionSummary(candidates: CanonicalCandidate[]) {
	const byTemporalEligibility: Record<string, number> = {};
	const byEvidenceClassification: Record<string, number> = {};
	const byVerificationStatus: Record<string, number> = {};
	const byResearchDomain: Record<string, number> = {};
	let totalClaims = 0;
	let claimsWithCounterevidence = 0;
	let claimsWithUnresolvedUncertainties = 0;
	let candidatesWithEvidenceGaps = 0;
	let confidenceSum = 0;
	let strategicResearchCandidates = 0;
	let technicalCandidates = 0;

	const strategicTypes = new Set<ClaimType>([
		"strategic-research",
		"advisory-finding",
		"enterprise-adoption",
		"productivity-claim",
		"roi-claim",
		"economic-impact",
	]);
	const technicalTypes = new Set<ClaimType>([
		"scientific-research",
		"benchmark-result",
		"technical-announcement",
		"software-release",
		"security-vulnerability",
	]);

	for (const candidate of candidates) {
		byTemporalEligibility[candidate.temporalEligibility.status] =
			(byTemporalEligibility[candidate.temporalEligibility.status] ?? 0) +
			1;
		for (const domain of candidate.researchDomains) {
			byResearchDomain[domain] = (byResearchDomain[domain] ?? 0) + 1;
		}
		if (candidate.evidenceGaps.length > 0) candidatesWithEvidenceGaps++;
		const claimTypes = new Set(
			candidate.claims.map((claim) => claim.claimType),
		);
		if ([...claimTypes].some((type) => strategicTypes.has(type)))
			strategicResearchCandidates++;
		if ([...claimTypes].some((type) => technicalTypes.has(type)))
			technicalCandidates++;
		for (const claim of candidate.claims) {
			totalClaims++;
			byEvidenceClassification[claim.evidenceClassification] =
				(byEvidenceClassification[claim.evidenceClassification] ?? 0) +
				1;
			byVerificationStatus[claim.verificationStatus] =
				(byVerificationStatus[claim.verificationStatus] ?? 0) + 1;
			confidenceSum += claim.confidence;
			if (claim.contradictoryEvidence.length > 0)
				claimsWithCounterevidence++;
			if (claim.uncertainty.unresolved.length > 0)
				claimsWithUnresolvedUncertainties++;
		}
	}

	return {
		totalCandidates: candidates.length,
		byTemporalEligibility,
		byEvidenceClassification,
		byVerificationStatus,
		byResearchDomain,
		totalClaims,
		claimsWithCounterevidence,
		claimsWithUnresolvedUncertainties,
		candidatesWithEvidenceGaps,
		averageClaimConfidence:
			totalClaims > 0 ? confidenceSum / totalClaims : 0,
		strategicResearchCandidates,
		technicalCandidates,
	};
}

/**
 * Build a complete synthetic dossier from candidate specifications. Editorial
 * readiness indicators are computed by the real dossier indicator engine so the
 * fixtures exercise production logic rather than hardcoded levels.
 */
export function buildDossier(
	editionDate: string,
	specs: CandidateSpec[],
): CanonicalFactDossier {
	const now = `${editionDate}T06:00:00Z`;
	const window = getEditorialWindow(editionDate);
	const cores = specs.map((spec) => buildCandidateCore(spec, editionDate));

	const candidates: CanonicalCandidate[] = cores.map((core) => ({
		...core,
		editorialReadiness: computeEditorialReadinessIndicators(core, {
			editionCandidates: cores,
			editionDate,
		}),
	}));

	// Keep the descriptive selection note present on every fixture candidate.
	for (const candidate of candidates) {
		candidate.editorialReadiness.selectionNote = SELECTION_NOTE;
	}

	const dossier: CanonicalFactDossier = {
		schemaVersion: "1.0.0",
		dossierId: `fd_${sha16(`editorial-selection-fixture:${editionDate}`)}`,
		editionId: `edition_${editionDate}`,
		editionDate,
		editionWindow: {
			editionDate,
			start: window.start,
			end: window.end,
			timezone: "Europe/Amsterdam",
			durationHours: window.durationHours,
		},
		status: "ready-for-omission-review",
		createdAt: now,
		updatedAt: now,
		generatedBy: "synthetic-editorial-selection-fixture",
		candidates,
		editionSummary: buildEditionSummary(candidates),
		uncertaintyRegister: [],
		historicalContinuity: [],
		processingAudit: {
			startedAt: now,
			completedAt: now,
			durationMs: 0,
			steps: [
				{
					step: "candidate-consolidation",
					status: "completed",
					completedAt: now,
					outputCount: candidates.length,
				},
			],
			completedCandidateIds: candidates.map(
				(candidate) => candidate.candidateId,
			),
			failedCandidateIds: [],
			skippedCandidateIds: [],
			inferenceUsed: false,
			inferenceNote: "Synthetic fixture dossier; no inference used.",
		},
		contentHash: "",
	};
	dossier.contentHash = computeDossierContentHash(dossier);
	return dossier;
}

// ============================================================================
// Omission review fixture
// ============================================================================

export function buildOmissionReview(
	editionDate: string,
	dossierId: string,
	options: {
		criticalOmissions?: number;
		materialOmissions?: number;
		unresolvedRepairs?: number;
		coverageGaps?: {
			description: string;
			significance: "critical" | "high" | "medium" | "low";
		}[];
	} = {},
): OmissionReviewReport {
	const executionId = `exec_${crypto.randomBytes(8).toString("hex")}`;
	const criticalOmissions = options.criticalOmissions ?? 0;
	const materialOmissions = options.materialOmissions ?? 0;

	return {
		version: "1.0.0",
		context: {
			editionDate,
			dossierVersion: dossierId,
			initialCandidateCount: 0,
			dossierId,
			startedAt: `${editionDate}T06:00:00Z`,
			completedAt: `${editionDate}T06:30:00Z`,
			executedStrategies: [],
			executionId,
			reviewerId: "synthetic-editorial-selection-fixture",
		},
		reviewedDossierVersion: dossierId,
		initialCandidateCount: 0,
		alternativeStrategiesExecuted: [],
		sourcesAndDomainsInspected: {
			ringsAssessed: [1, 2, 3],
			researchDomainsAssessed: [],
			sourceFamiliesAssessed: [],
			organizationsAssessed: [],
		},
		newlyDiscoveredCandidates: [],
		substantiveUpdates: [],
		omissionClassifications: {},
		criticalAndMaterialOmissionsRepaired: Array.from(
			{ length: options.unresolvedRepairs ?? 0 },
			(_, index) => ({
				candidateId: fixtureCandidateId(`unresolved-omission-${index}`),
				repairAction: "UNRESOLVED" as const,
				verificationOutcome: "EVIDENCE_UNAVAILABLE" as const,
				timestamp: `${editionDate}T06:30:00Z`,
			}),
		),
		existingCandidatesUpdated: [],
		remainingCoverageGaps: (options.coverageGaps ?? []).map((gap) => ({
			type: "SOURCE_UNAVAILABLE" as const,
			description: gap.description,
			significance: gap.significance,
			affectedSources: [],
			affectedDomains: [],
		})),
		finalDossierVersion: dossierId,
		executionTimestamps: {
			startedAt: `${editionDate}T06:00:00Z`,
			reportFinalizedAt: `${editionDate}T06:30:00Z`,
		},
		verificationOutcomes: {
			totalCandidatesInvestigated: criticalOmissions + materialOmissions,
			verifiedAndAdded: 0,
			verifiedAndRejected: 0,
			evidenceUnavailable: 0,
			unresolved: options.unresolvedRepairs ?? 0,
		},
	};
}

// ============================================================================
// Historical regression fixture
// ============================================================================

export interface HistoricalRelationshipSpec {
	candidateKey: string;
	classification: HistoricalRelationshipClassification;
	confidence?: number;
	previousEditionDate?: string;
	previousCandidateKey?: string;
	rationale?: string;
}

function buildMatchEvidence(
	editionDate: string,
	previousCandidateKey?: string,
): HistoricalMatchEvidence[] {
	if (!previousCandidateKey) return [];
	return [
		{
			editionDate,
			editionId: `edition_${editionDate}`,
			matched: true,
			matchType: "candidate-id",
			matchedCandidateIds: [fixtureCandidateId(previousCandidateKey)],
			matchedClaimIds: [],
			matchedSourceIds: [],
			matchedUrls: [],
			sharedOrganizations: [],
			sharedProducts: [],
			sharedTechnologies: [],
			sharedResearchDomains: [],
			headlineSimilarity: 0.9,
			claimSimilarity: 0.85,
			timestampMatch: false,
			evidenceReferences: [],
			note: "Synthetic historical match.",
		},
	];
}

export function buildHistoricalRegression(
	editionDate: string,
	dossier: CanonicalFactDossier,
	specs: HistoricalRelationshipSpec[],
): HistoricalRegressionReport {
	const now = `${editionDate}T06:00:00Z`;
	const window = getEditorialWindow(editionDate);

	const relationships: HistoricalRelationship[] = specs.map((spec) => {
		const candidateId = fixtureCandidateId(spec.candidateKey);
		const previousEditionDate = spec.previousEditionDate ?? "2025-01-14";
		return {
			candidateId,
			editionDate,
			classification: spec.classification,
			confidence: spec.confidence ?? 0.8,
			matches: buildMatchEvidence(
				previousEditionDate,
				spec.previousCandidateKey,
			),
			primaryMatchEditionDate: spec.previousCandidateKey
				? previousEditionDate
				: undefined,
			primaryMatchCandidateId: spec.previousCandidateKey
				? fixtureCandidateId(spec.previousCandidateKey)
				: undefined,
			primaryMatchType: spec.previousCandidateKey
				? "candidate-id"
				: undefined,
			historicalContext: [],
			rationale:
				spec.rationale ?? "Synthetic historical regression fixture.",
			derivedFrom:
				"deterministic-matching" as HistoricalRelationshipDerivation,
			semanticComparisonUsed: false,
		};
	});

	const report = {
		schemaVersion: "1.0.0" as const,
		reportId: `hr_${sha16(`editorial-selection-fixture:${editionDate}`)}`,
		editionId: `edition_${editionDate}`,
		editionDate,
		editionWindow: {
			editionDate,
			start: window.start,
			end: window.end,
			timezone: "Europe/Amsterdam" as const,
			durationHours: window.durationHours,
		},
		executionId: `exec_${crypto.randomBytes(8).toString("hex")}`,
		executedAt: now,
		generatedBy: "synthetic-editorial-selection-fixture",
		currentDossierVersion: dossier.dossierId,
		currentDossierContentHash: dossier.contentHash,
		historicalWindow: {
			days: 7 as const,
			timezone: "Europe/Amsterdam" as const,
			editionDates: [],
			dailyEligibilityWindow: {
				editionDate,
				start: window.start,
				end: window.end,
				timezone: "Europe/Amsterdam" as const,
				durationHours: window.durationHours,
			},
			dailyEligibilityWindowUnchanged: true as const,
		},
		historicalEditions: [],
		candidatesEvaluated: dossier.candidates.length,
		relationships,
		substantiveUpdates: [],
		repeatedReporting: [],
		potentialOmissions: [],
		missingHistoricalEvidence: [],
		unresolvedQuestions: [],
		finalStatus:
			relationships.length > 0
				? ("COMPLETE" as const)
				: ("UNAVAILABLE" as const),
		inferenceUsed: false,
		inferenceNote: "Synthetic fixture; no inference used.",
		contentHash: "",
	};

	return report;
}

// ============================================================================
// Shared claim/candidate fragments
// ============================================================================

const SCIENTIFIC_METHODOLOGY: MethodologicalContext = {
	methodology:
		"Synthetic randomized controlled study across 3 model families.",
	studyDesign: "Controlled comparison with documented evaluation conditions.",
	evaluationConditions:
		"Fixed hardware, documented precision and batch size.",
	reproducibility: {
		artifactAvailable: true,
		artifactUrl: "https://example.com/synthetic-reproduction",
		independentReplications: 1,
		replicationResults: "confirmed",
	},
};

const STRATEGIC_STUDY_CONTEXT: StrategicContext = {
	researchPurpose:
		"Measure enterprise AI adoption and productivity outcomes.",
	sampleSize: 1200,
	sampleComposition: "Enterprise technology leaders across 14 industries.",
	geographicScope: "North America, Europe, Asia-Pacific",
	industryCoverage: "14 industries",
	researchPeriod: "2024-09 to 2024-12",
	measuredOutcome:
		"Reported productivity change relative to a pre-adoption baseline.",
	baseline: "Pre-adoption productivity measured over two quarters.",
	statisticalUncertainty:
		"Margin of error ±4 percentage points at 95% confidence.",
	causalClaimType: "correlation",
	generalizability: "Findings apply to the surveyed enterprise population.",
	enterpriseImplications: [
		"Adoption patterns differ materially by industry.",
	],
	productivityConsequences: [
		"Measured productivity changes vary widely across cohorts.",
	],
	economicImpact: ["Reported ROI ranges from negative to strongly positive."],
	conflictsOfInterest: ["Synthetic fixture; no real funding disclosures."],
};

const SECURITY_TECHNICAL_CONTEXT: TechnicalContext = {
	mechanism: "Synthetic prompt-injection path across agent tool boundaries.",
	capabilities: ["tool invocation", "context injection"],
	limitations: ["Requires a vulnerable agent configuration."],
	securityAssumptions: ["Agent tool calls are not fully sandboxed."],
	trustBoundaries: ["Tool output is trusted without validation."],
	implementationStatus: "released",
	releaseMaturity: "ga",
};

const COPILOT_TECHNICAL_CONTEXT: TechnicalContext = {
	mechanism: "Synthetic CLI agent orchestration with checkpointed sessions.",
	capabilities: ["CLI agent workflows", "checkpointing", "background tasks"],
	agenticImplications: [
		"Changes how engineers delegate multi-step coding work.",
	],
	compatibility: ["Requires the current CLI version."],
	implementationStatus: "released",
	releaseMaturity: "ga",
};

const CODING_AGENT_RELEASE_CONTEXT: TechnicalContext = {
	capabilities: ["synthetic capability"],
	implementationStatus: "preview",
	releaseMaturity: "preview",
};

// ============================================================================
// The ten representative evaluation cases
// ============================================================================

/** Case 1: major scientific breakthrough vs routine coding-agent releases. */
export function scientificBreakthroughSpecs(): CandidateSpec[] {
	return [
		{
			key: "sci-breakthrough-moe-scaling",
			title: "Synthetic study derives sublinear scaling law for sparse experts",
			statement:
				"A synthetic peer-reviewed study derives a sublinear scaling law for sparse Mixture-of-Experts models, with documented methodology and a reproduction artifact.",
			sourceId: "synthetic-arxiv",
			sourceUrl: "https://example.com/synthetic-arxiv/moe-scaling",
			tier: 1,
			organizations: ["Synthetic Research Lab"],
			products: ["Synthetic MoE family"],
			technologies: ["mixture-of-experts", "scaling laws"],
			researchDomains: ["models-inference-scientific"],
			discoveryRings: [2],
			publicationTimestamp: IN_WINDOW,
			claims: [
				{
					key: "sci-breakthrough-claim",
					text: "Sparse Mixture-of-Experts models exhibit a sublinear scaling law in the synthetic study, with a reproduction artifact.",
					claimType: "scientific-research",
					classification: "RESEARCH_FINDING",
					verificationStatus: "verified",
					verificationLevel: "L2",
					confidence: 0.9,
					methodologicalContext: SCIENTIFIC_METHODOLOGY,
					corroboration: true,
				},
			],
		},
		...[1, 2, 3].map((index): CandidateSpec => ({
			key: `coding-agent-release-${index}`,
			title: `Synthetic coding agent release ${index}: minor capability update`,
			statement: `A synthetic routine coding-agent release ${index} with a minor capability update.`,
			sourceId: "synthetic-coding-agent-blog",
			sourceUrl: `https://example.com/synthetic-coding-agent/release-${index}`,
			tier: 2,
			organizations: ["Synthetic Coding Tools"],
			products: ["Synthetic coding agent"],
			technologies: ["coding agents"],
			researchDomains: ["coding-agents-skills-mcp-hooks-plugins-apm"],
			discoveryRings: [1],
			publicationTimestamp: IN_WINDOW,
			claims: [
				{
					key: `coding-agent-release-${index}-claim`,
					text: `Synthetic coding agent release ${index} adds a minor capability.`,
					claimType: "software-release",
					classification: "VENDOR_CLAIM",
					verificationStatus: "unverified",
					verificationLevel: "L0",
					confidence: 0.5,
					technicalContext: CODING_AGENT_RELEASE_CONTEXT,
				},
			],
		})),
	];
}

/** Case 2: significant GitHub Copilot CLI release with direct engineering consequences. */
export function copilotCliReleaseSpecs(): CandidateSpec[] {
	return [
		{
			key: "copilot-cli-release",
			title: "Synthetic GitHub Copilot CLI release adds checkpointed agent workflows",
			statement:
				"A synthetic GitHub Copilot CLI release adds checkpointed agent workflows and is generally available, with direct consequences for engineering delegation.",
			sourceId: "synthetic-github-changelog",
			sourceUrl:
				"https://example.com/synthetic-github/copilot-cli-release",
			tier: 2,
			organizations: ["GitHub"],
			products: ["GitHub Copilot CLI"],
			technologies: ["CLI agents", "checkpointing"],
			researchDomains: ["coding-agents-skills-mcp-hooks-plugins-apm"],
			discoveryRings: [1],
			publicationTimestamp: IN_WINDOW,
			claims: [
				{
					key: "copilot-cli-release-claim",
					text: "Synthetic GitHub Copilot CLI release adds checkpointed agent workflows and is generally available.",
					claimType: "software-release",
					classification: "VERIFIED_FACT",
					verificationStatus: "verified",
					verificationLevel: "L2",
					confidence: 0.88,
					technicalContext: COPILOT_TECHNICAL_CONTEXT,
					corroboration: true,
				},
			],
		},
	];
}

/** Case 3: original strategic study identifying material enterprise AI changes. */
export function strategicStudySpecs(): CandidateSpec[] {
	return [
		{
			key: "mckinsey-enterprise-ai-study",
			title: "Synthetic McKinsey study finds material enterprise AI productivity variation",
			statement:
				"A synthetic McKinsey study of 1,200 enterprises finds material variation in AI productivity outcomes, with documented methodology, baseline and statistical uncertainty.",
			sourceId: "synthetic-mckinsey",
			sourceUrl: "https://example.com/synthetic-mckinsey/enterprise-ai",
			tier: 2,
			organizations: ["Synthetic Advisory"],
			products: [],
			technologies: ["enterprise AI"],
			researchDomains: [
				"enterprise-ai-adoption-organizational-transformation",
			],
			discoveryRings: [2],
			publicationTimestamp: IN_WINDOW,
			claims: [
				{
					key: "mckinsey-enterprise-ai-study-claim",
					text: "Enterprise AI productivity outcomes vary materially across cohorts in the synthetic study.",
					claimType: "strategic-research",
					classification: "RESEARCH_FINDING",
					verificationStatus: "verified",
					verificationLevel: "L1",
					confidence: 0.8,
					strategicContext: STRATEGIC_STUDY_CONTEXT,
				},
			],
		},
	];
}

/** Case 4: vendor-sponsored productivity claim with weak independent evidence. */
export function vendorProductivityClaimSpecs(): CandidateSpec[] {
	return [
		{
			key: "vendor-productivity-claim",
			title: "Synthetic vendor claims 40% productivity gain from its AI tool",
			statement:
				"A synthetic vendor claims a 40% productivity gain from its AI tool, without an independent baseline, disclosed methodology or corroboration.",
			sourceId: "synthetic-vendor-blog",
			sourceUrl:
				"https://example.com/synthetic-vendor/productivity-claim",
			tier: 2,
			organizations: ["Synthetic Vendor"],
			products: ["Synthetic AI tool"],
			technologies: ["AI assistants"],
			researchDomains: ["developer-productivity-software-delivery"],
			discoveryRings: [1],
			publicationTimestamp: IN_WINDOW,
			claims: [
				{
					key: "vendor-productivity-claim-claim",
					text: "The synthetic vendor claims a 40% productivity gain without independent corroboration.",
					claimType: "productivity-claim",
					classification: "VENDOR_CLAIM",
					verificationStatus: "unverified",
					verificationLevel: "L0",
					confidence: 0.4,
				},
			],
		},
	];
}

/** Case 5: newly disclosed security vulnerability affecting multiple agent platforms. */
export function securityVulnerabilitySpecs(): CandidateSpec[] {
	return [
		{
			key: "agent-security-vulnerability",
			title: "Synthetic advisory discloses agent prompt-injection vulnerability across platforms",
			statement:
				"A synthetic security advisory discloses a prompt-injection vulnerability affecting multiple agent platforms, with a CVE identifier and vendor acknowledgements.",
			sourceId: "synthetic-security-advisory",
			sourceUrl: "https://example.com/synthetic-security/advisory-001",
			tier: 1,
			organizations: [
				"Synthetic Security Consortium",
				"Synthetic Coding Tools",
				"Synthetic AI Lab",
			],
			products: [
				"Synthetic agent platform A",
				"Synthetic agent platform B",
			],
			technologies: ["prompt injection", "agent tool boundaries"],
			researchDomains: ["security-sandboxing-software-supply-chains"],
			discoveryRings: [1, 2],
			publicationTimestamp: IN_WINDOW,
			claims: [
				{
					key: "agent-security-vulnerability-claim",
					text: "A synthetic prompt-injection vulnerability affects multiple agent platforms and has been assigned a CVE identifier.",
					claimType: "security-vulnerability",
					classification: "VERIFIED_FACT",
					verificationStatus: "verified",
					verificationLevel: "L2",
					confidence: 0.92,
					technicalContext: SECURITY_TECHNICAL_CONTEXT,
					corroboration: true,
				},
			],
		},
	];
}

/** Case 6: substantive update to an already covered AI model release. */
export function substantiveUpdateSpecs(): CandidateSpec[] {
	return [
		{
			key: "model-release-substantive-update",
			title: "Synthetic model release receives a substantive context-window extension",
			statement:
				"A synthetic AI model release receives a substantive context-window extension and new benchmark results, first disclosed in this edition window.",
			sourceId: "synthetic-model-release-notes",
			sourceUrl:
				"https://example.com/synthetic-model/release-notes-update",
			tier: 1,
			organizations: ["Synthetic AI Lab"],
			products: ["Synthetic model family"],
			technologies: ["context windows", "benchmarks"],
			researchDomains: ["models-inference-scientific"],
			discoveryRings: [1, 2],
			publicationTimestamp: IN_WINDOW,
			isKnownUpdate: true,
			updateDescription:
				"Context window extended with new benchmark results under documented conditions.",
			claims: [
				{
					key: "model-release-substantive-update-claim",
					text: "The synthetic model release now supports an extended context window with new benchmark results.",
					claimType: "benchmark-result",
					classification: "RESEARCH_FINDING",
					verificationStatus: "verified",
					verificationLevel: "L1",
					confidence: 0.82,
					methodologicalContext: {
						methodology:
							"Synthetic benchmark methodology with documented hardware and precision.",
						reproducibility: {
							artifactAvailable: false,
							independentReplications: 0,
						},
					},
				},
			],
		},
	];
}

/** Case 7: multiple articles repeating the same underlying announcement. */
export function repeatedAnnouncementSpecs(): CandidateSpec[] {
	const sharedUrl = "https://example.com/synthetic-announcement/shared";
	return [1, 2, 3].map((index): CandidateSpec => ({
		key: `repeated-announcement-${index}`,
		title: "Synthetic announcement: agent platform adds generally available capability",
		statement:
			"A synthetic announcement that the agent platform adds a generally available capability, repeated across three synthetic articles.",
		sourceId: "synthetic-announcement-source",
		sourceUrl: sharedUrl,
		tier: 2,
		organizations: ["Synthetic AI Lab"],
		products: ["Synthetic agent platform"],
		technologies: ["agent capabilities"],
		researchDomains: ["agentic-ai-software-engineering"],
		discoveryRings: [1],
		// Distinct publication timestamps make the primary determinable, so the
		// repeat is a resolved duplicate handled by the merge model rather than an
		// unresolved duplicate blocked at the eligibility gate.
		publicationTimestamp:
			index === 1
				? IN_WINDOW
				: index === 2
					? "2025-01-14T12:30:00+01:00[Europe/Amsterdam]"
					: "2025-01-14T13:00:00+01:00[Europe/Amsterdam]",
		claims: [
			{
				key: `repeated-announcement-${index}-claim`,
				text: "The synthetic agent platform adds a generally available capability, as announced.",
				claimType: "software-release",
				classification: "VERIFIED_FACT",
				verificationStatus: "verified",
				verificationLevel: "L2",
				confidence: 0.85,
				technicalContext: {
					capabilities: ["generally available capability"],
					implementationStatus: "released",
					releaseMaturity: "ga",
				},
				corroboration: true,
			},
		],
	}));
}

/** Case 8: quiet news day containing only a few eligible developments. */
export function quietDaySpecs(): CandidateSpec[] {
	return [
		{
			key: "quiet-day-security-fix",
			title: "Synthetic advisory discloses a narrowly scoped agent sandbox fix",
			statement:
				"A synthetic advisory discloses a narrowly scoped agent sandbox fix with a CVE identifier.",
			sourceId: "synthetic-security-advisory",
			sourceUrl: "https://example.com/synthetic-security/advisory-quiet",
			tier: 1,
			organizations: ["Synthetic Security Consortium"],
			technologies: ["sandboxing"],
			researchDomains: ["security-sandboxing-software-supply-chains"],
			discoveryRings: [1],
			publicationTimestamp: IN_WINDOW,
			claims: [
				{
					key: "quiet-day-security-fix-claim",
					text: "A synthetic narrowly scoped agent sandbox fix is disclosed with a CVE identifier.",
					claimType: "security-vulnerability",
					classification: "VERIFIED_FACT",
					verificationStatus: "verified",
					verificationLevel: "L1",
					confidence: 0.75,
					technicalContext: {
						mechanism: "Synthetic sandbox escape path.",
						securityAssumptions: ["Sandbox isolation assumed."],
						implementationStatus: "released",
						releaseMaturity: "ga",
					},
				},
			],
		},
		{
			key: "quiet-day-model-minor",
			title: "Synthetic model release adds a minor quantization option",
			statement:
				"A synthetic model release adds a minor quantization option with a small benchmark improvement.",
			sourceId: "synthetic-model-release-notes",
			sourceUrl:
				"https://example.com/synthetic-model/quantization-option",
			tier: 2,
			organizations: ["Synthetic AI Lab"],
			products: ["Synthetic model family"],
			technologies: ["quantization"],
			researchDomains: ["models-inference-scientific"],
			discoveryRings: [1],
			publicationTimestamp: IN_WINDOW_LATE,
			claims: [
				{
					key: "quiet-day-model-minor-claim",
					text: "The synthetic model release adds a minor quantization option.",
					claimType: "software-release",
					classification: "VERIFIED_FACT",
					verificationStatus: "verified",
					verificationLevel: "L1",
					confidence: 0.7,
					technicalContext: {
						capabilities: ["quantization option"],
						implementationStatus: "released",
						releaseMaturity: "ga",
					},
				},
			],
		},
	];
}

/** Case 9: a day genuinely dominated by one vendor's major releases. */
export function vendorDominatedSpecs(): CandidateSpec[] {
	const vendorReleases = [1, 2, 3].map((index): CandidateSpec => ({
		key: `vendor-major-release-${index}`,
		title: `Synthetic major release ${index} from a single vendor`,
		statement: `A synthetic major release ${index} from a single vendor with broadly consequential capabilities.`,
		sourceId: "synthetic-vendor-blog",
		sourceUrl: `https://example.com/synthetic-vendor/major-release-${index}`,
		tier: 2,
		organizations: ["Synthetic Dominant Vendor"],
		products: [`Synthetic vendor product ${index}`],
		technologies: ["synthetic capability"],
		researchDomains: ["models-inference-scientific"],
		discoveryRings: [1],
		publicationTimestamp: IN_WINDOW,
		claims: [
			{
				key: `vendor-major-release-${index}-claim`,
				text: `Synthetic major release ${index} materially extends the vendor platform.`,
				claimType: "technical-announcement",
				classification: "VERIFIED_FACT",
				verificationStatus: "verified",
				verificationLevel: "L2",
				confidence: 0.85,
				technicalContext: {
					capabilities: ["synthetic capability"],
					implementationStatus: "released",
					releaseMaturity: "ga",
				},
				corroboration: true,
			},
		],
	}));

	return [
		...vendorReleases,
		{
			key: "vendor-dominated-other-small",
			title: "Synthetic small release from a different organization",
			statement:
				"A synthetic small release from a different organization with limited consequence.",
			sourceId: "synthetic-other-blog",
			sourceUrl: "https://example.com/synthetic-other/small-release",
			tier: 3,
			organizations: ["Synthetic Small Vendor"],
			technologies: ["synthetic niche"],
			researchDomains: ["coding-agents-skills-mcp-hooks-plugins-apm"],
			discoveryRings: [3],
			publicationTimestamp: IN_WINDOW,
			claims: [
				{
					key: "vendor-dominated-other-small-claim",
					text: "A synthetic small niche release with limited consequence.",
					claimType: "software-release",
					classification: "EXPERT_INTERPRETATION",
					verificationStatus: "unverified",
					verificationLevel: "L0",
					confidence: 0.45,
				},
			],
		},
	];
}

/** Verified original reporting about an older underlying event, disclosed in-window. */
export function originalReportingOlderEventSpecs(): CandidateSpec[] {
	return [
		{
			key: "original-reporting-older-event",
			title: "Synthetic investigation reveals previously undisclosed agent failure mode",
			statement:
				"A synthetic original investigation reveals a previously undisclosed agent failure mode in a 2023 system, with named sources and documentation.",
			sourceId: "synthetic-investigation",
			sourceUrl:
				"https://example.com/synthetic-investigation/agent-failure-mode",
			tier: 2,
			organizations: ["Synthetic Research Group"],
			technologies: ["agent failure modes"],
			researchDomains: [
				"agent-orchestration-evaluation-reliability-observability",
			],
			discoveryRings: [2],
			publicationTimestamp: IN_WINDOW,
			underlyingEventDate: "2023-05-01",
			newlyRevealedFacts: [
				"Previously undisclosed failure mode in a 2023 agent deployment.",
				"Named sources confirm the failure was known internally but not published.",
			],
			claims: [
				{
					key: "original-reporting-older-event-claim",
					text: "A previously undisclosed agent failure mode from 2023 is revealed with named sources.",
					claimType: "original-reporting",
					classification: "ORIGINAL_REPORTING",
					verificationStatus: "verified",
					verificationLevel: "L1",
					confidence: 0.78,
					technicalContext: {
						mechanism:
							"Synthetic failure mode in long-horizon agent tasks.",
						limitations: ["Based on a single named source."],
					},
				},
			],
		},
	];
}

/** Explicitly dated CATCH_UP material with traceable archive evidence. */
export function catchUpSpecs(): CandidateSpec[] {
	return [
		{
			key: "catch-up-older-development",
			title: "Synthetic older development revisited as dated catch-up",
			statement:
				"A synthetic older development from an earlier date, explicitly selected as dated catch-up because it remains consequential.",
			sourceId: "synthetic-archive",
			sourceUrl:
				"https://example.com/synthetic-archive/older-development",
			tier: 1,
			organizations: ["Synthetic AI Lab"],
			technologies: ["synthetic capability"],
			researchDomains: ["models-inference-scientific"],
			discoveryRings: [1],
			publicationTimestamp: OUT_OF_WINDOW,
			underlyingEventDate: "2025-01-06",
			additionalEvidence: [
				{
					type: "archive_snapshot",
					reference: "synthetic-archive-snapshot",
					timestamp: OUT_OF_WINDOW,
					description:
						"Synthetic archived publication snapshot confirming the original date.",
					confidence: 0.9,
				},
			],
			claims: [
				{
					key: "catch-up-older-development-claim",
					text: "A synthetic older development remains materially consequential and is selected as catch-up.",
					claimType: "technical-announcement",
					classification: "VERIFIED_FACT",
					verificationStatus: "verified",
					verificationLevel: "L2",
					confidence: 0.86,
					technicalContext: {
						capabilities: ["synthetic capability"],
						implementationStatus: "released",
						releaseMaturity: "ga",
					},
				},
			],
		},
	];
}

/** In-window repost/summary of established information. */
export function repostSpecs(): CandidateSpec[] {
	return [
		{
			key: "in-window-repost",
			title: "Synthetic recap: previously announced agent capability",
			statement:
				"A synthetic recap/summary of previously announced agent capability with no new material disclosure.",
			sourceId: "synthetic-newsletter",
			sourceUrl: "https://example.com/synthetic-newsletter/recap",
			tier: 2,
			organizations: ["Synthetic Newsletter"],
			technologies: ["agent capabilities"],
			researchDomains: ["agentic-ai-software-engineering"],
			discoveryRings: [1],
			publicationTimestamp: IN_WINDOW,
			claims: [
				{
					key: "in-window-repost-claim",
					text: "A synthetic recap repeats previously announced agent capability.",
					claimType: "vendor-announcement",
					classification: "VENDOR_CLAIM",
					verificationStatus: "unverified",
					verificationLevel: "L0",
					confidence: 0.4,
				},
			],
		},
	];
}

/** Case 10: candidates carrying critical unresolved evidence or temporal uncertainty. */
export function unresolvedSpecs(): CandidateSpec[] {
	return [
		{
			key: "unresolved-evidence-claim",
			title: "Synthetic research claim with a blocking unresolved uncertainty",
			statement:
				"A synthetic research claim carries a blocking unresolved uncertainty and direct counterevidence that prevent independent confirmation.",
			sourceId: "synthetic-research-blog",
			sourceUrl:
				"https://example.com/synthetic-research/unresolved-claim",
			tier: 2,
			organizations: ["Synthetic Research Group"],
			technologies: ["synthetic mechanism"],
			researchDomains: ["models-inference-scientific"],
			discoveryRings: [2],
			publicationTimestamp: IN_WINDOW,
			claims: [
				{
					key: "unresolved-evidence-claim-claim",
					text: "A synthetic research claim is contradicted by direct counterevidence and remains unresolved.",
					claimType: "scientific-research",
					classification: "RESEARCH_FINDING",
					verificationStatus: "unverified",
					verificationLevel: "L0",
					confidence: 0.3,
					methodologicalContext: {
						methodology: "Synthetic methodology under dispute.",
						counterevidence: ["Synthetic direct counterevidence."],
					},
					counterevidenceCount: 1,
					blockingUncertainties: [
						{
							type: "evidence-gap",
							uncertainty:
								"Direct counterevidence has not been resolved; independent confirmation is outstanding.",
							impact: "high",
						},
					],
				},
			],
		},
		{
			key: "unresolved-temporal-claim",
			title: "Synthetic consequential announcement with an unverifiable publication timestamp",
			statement:
				"A synthetic consequential announcement whose publication timestamp cannot be parsed, leaving temporal eligibility unresolved.",
			sourceId: "synthetic-unknown-source",
			sourceUrl: "https://example.com/synthetic-unknown/announcement",
			tier: 2,
			organizations: ["Synthetic Unknown"],
			products: ["Synthetic platform"],
			technologies: ["synthetic capability"],
			researchDomains: ["models-inference-scientific"],
			discoveryRings: [2],
			publicationTimestamp: UNPARSEABLE_TIMESTAMP,
			deriveEditionDate: true,
			claims: [
				{
					key: "unresolved-temporal-claim-claim",
					text: "A synthetic consequential announcement with an unverifiable publication timestamp.",
					claimType: "technical-announcement",
					classification: "VERIFIED_FACT",
					verificationStatus: "verified",
					verificationLevel: "L2",
					confidence: 0.85,
					technicalContext: {
						capabilities: ["synthetic capability"],
						implementationStatus: "released",
						releaseMaturity: "ga",
					},
					corroboration: true,
				},
			],
		},
	];
}

// ============================================================================
// Composite fixture editions
// ============================================================================

/**
 * Build a complete fixture edition (dossier + omission review + historical
 * regression) for a set of candidate specifications and optional historical
 * relationship specifications.
 */
export function createFixtureEdition(
	specs: CandidateSpec[],
	options: {
		editionDate?: string;
		historicalRelationships?: HistoricalRelationshipSpec[];
		omission?: {
			criticalOmissions?: number;
			materialOmissions?: number;
			unresolvedRepairs?: number;
			coverageGaps?: {
				description: string;
				significance: "critical" | "high" | "medium" | "low";
			}[];
		};
	} = {},
): FixtureEdition {
	const editionDate = options.editionDate ?? EDITION_DATE;
	const dossier = buildDossier(editionDate, specs);
	const omissionReview = buildOmissionReview(
		editionDate,
		dossier.dossierId,
		options.omission,
	);
	const historicalRegression = buildHistoricalRegression(
		editionDate,
		dossier,
		options.historicalRelationships ?? [],
	);
	return { editionDate, dossier, omissionReview, historicalRegression };
}

/** Case 1 fixture edition. */
export function scientificBreakthroughEdition(): FixtureEdition {
	return createFixtureEdition(scientificBreakthroughSpecs());
}

/** Case 2 fixture edition. */
export function copilotCliReleaseEdition(): FixtureEdition {
	return createFixtureEdition(copilotCliReleaseSpecs());
}

/** Case 3 fixture edition. */
export function strategicStudyEdition(): FixtureEdition {
	return createFixtureEdition(strategicStudySpecs());
}

/** Case 4 fixture edition. */
export function vendorProductivityClaimEdition(): FixtureEdition {
	return createFixtureEdition(vendorProductivityClaimSpecs());
}

/** Case 5 fixture edition. */
export function securityVulnerabilityEdition(): FixtureEdition {
	return createFixtureEdition(securityVulnerabilitySpecs());
}

/** Case 6 fixture edition with a historical substantive-update relationship. */
export function substantiveUpdateEdition(): FixtureEdition {
	return createFixtureEdition(substantiveUpdateSpecs(), {
		historicalRelationships: [
			{
				candidateKey: "model-release-substantive-update",
				classification: "SUBSTANTIVE_UPDATE",
				previousEditionDate: "2025-01-08",
				previousCandidateKey: "model-release-original",
				confidence: 0.85,
			},
		],
	});
}

/** Case 7 fixture edition: three articles repeating one underlying announcement. */
export function repeatedAnnouncementEdition(): FixtureEdition {
	return createFixtureEdition(repeatedAnnouncementSpecs());
}

/** Historical deduplication fixture: a candidate already covered in an earlier edition. */
export function historicalDedupEdition(): FixtureEdition {
	return createFixtureEdition(copilotCliReleaseSpecs(), {
		historicalRelationships: [
			{
				candidateKey: "copilot-cli-release",
				classification: "PREVIOUSLY_COVERED",
				previousEditionDate: "2025-01-14",
				previousCandidateKey: "copilot-cli-release-previous",
				confidence: 0.9,
			},
		],
	});
}

/** Historical repetition fixture: repeated reporting without a qualifying change. */
export function historicalRepetitionEdition(): FixtureEdition {
	return createFixtureEdition(copilotCliReleaseSpecs(), {
		historicalRelationships: [
			{
				candidateKey: "copilot-cli-release",
				classification: "REPEATED_REPORTING",
				previousEditionDate: "2025-01-14",
				previousCandidateKey: "copilot-cli-release-previous",
				confidence: 0.9,
			},
		],
	});
}

/** Case 8 fixture edition. */
export function quietDayEdition(): FixtureEdition {
	return createFixtureEdition(quietDaySpecs());
}

/** Case 9 fixture edition. */
export function vendorDominatedEdition(): FixtureEdition {
	return createFixtureEdition(vendorDominatedSpecs());
}

/** Case 10 fixture edition. */
export function unresolvedEdition(): FixtureEdition {
	return createFixtureEdition(unresolvedSpecs());
}

/** Original reporting about an older event, disclosed in-window. */
export function originalReportingOlderEventEdition(): FixtureEdition {
	return createFixtureEdition(originalReportingOlderEventSpecs());
}

/** Explicitly dated CATCH_UP material. */
export function catchUpEdition(): FixtureEdition {
	return createFixtureEdition(catchUpSpecs());
}

/** In-window repost/summary fixture. */
export function repostEdition(): FixtureEdition {
	return createFixtureEdition(repostSpecs());
}

/**
 * A combined edition containing all ten cases, used to exercise selection,
 * vendor neutrality, merging and ordering across heterogeneous developments.
 */
export function combinedEdition(): FixtureEdition {
	return createFixtureEdition([
		...scientificBreakthroughSpecs(),
		...copilotCliReleaseSpecs(),
		...strategicStudySpecs(),
		...vendorProductivityClaimSpecs(),
		...securityVulnerabilitySpecs(),
		...substantiveUpdateSpecs(),
		...repeatedAnnouncementSpecs(),
		...quietDaySpecs(),
		...vendorDominatedSpecs(),
		...unresolvedSpecs(),
	]);
}
