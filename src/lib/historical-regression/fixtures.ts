/**
 * Historical Regression — Synthetic Fixtures
 *
 * ⚠️  SYNTHETIC TEST DATA. Every edition, candidate, claim, source and
 * timestamp below is invented for regression testing. Nothing in this file is
 * a real research finding, vendor announcement, publication or editorial
 * judgement, and no fixture represents actually retrieved historical evidence.
 *
 * The fixtures cover the ten representative cases required by the specification:
 *   1. A GitHub Copilot release already covered in an earlier edition.
 *   2. A subsequent material GitHub Copilot capability update.
 *   3. An older scientific paper summarized in a newly published article.
 *   4. A new independent study revising previously accepted findings.
 *   5. A Gartner report repeating established conclusions.
 *   6. A strategic research report containing genuinely new empirical findings.
 *   7. An important AI announcement missed in an earlier edition.
 *   8. A historical edition that cannot be accessed.
 *   9. New original reporting about an older underlying event.
 *  10. Late execution during a daylight-saving transition (covered by the
 *      window tests, which need no fixture records).
 */

import crypto from "crypto";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

import { getEditorialWindow } from "../editorial-window.js";
import { computeDossierContentHash } from "../fact-dossier/canonical.js";
import { classifyNovelty } from "../novelty-classification.js";
import { deriveTemporalEligibilityStatus } from "../fact-dossier/consolidator.js";
import { SELECTION_NOTE } from "../fact-dossier/schema.js";
import type {
	CanonicalCandidate,
	CanonicalFactDossier,
	ClaimType,
	ConsolidatedClaim,
	EvidenceClassification,
	MethodologicalContext,
	StrategicContext,
	TechnicalContext,
	VerificationStatus,
} from "../fact-dossier/schema.js";
import type { OmissionReviewReport } from "../omission-review/types.js";

export const CURRENT_EDITION = "2025-01-15";
export const HISTORICAL_EDITIONS = [
	"2025-01-08",
	"2025-01-09",
	"2025-01-10",
	"2025-01-11",
	"2025-01-12",
	"2025-01-13",
	"2025-01-14",
] as const;

export const FIXTURE_DATA_DIR = "data/test-historical-regression";

// ============================================================================
// Builders
// ============================================================================

export interface ClaimSpec {
	claimId: string;
	text: string;
	claimType: ClaimType;
	classification: EvidenceClassification;
	verificationStatus: VerificationStatus;
	verificationLevel: "L0" | "L1" | "L2" | "L3";
	technicalContext?: TechnicalContext;
	methodologicalContext?: MethodologicalContext;
	strategicContext?: StrategicContext;
	counterevidenceCount?: number;
	corroboration?: boolean;
}

export interface CandidateSpec {
	candidateId: string;
	title: string;
	statement?: string;
	sourceId: string;
	sourceUrl: string;
	tier: 1 | 2 | 3;
	organizations?: string[];
	products?: string[];
	technologies?: string[];
	researchDomains?: string[];
	publicationTimestamp: string;
	firstDisclosureTimestamp?: string;
	underlyingEventDate?: string;
	substantiveUpdateTimestamp?: string;
	isKnownUpdate?: boolean;
	updateDescription?: string;
	claims: ClaimSpec[];
}

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

const toCandidateId = fixtureCandidateId;
const toClaimId = fixtureClaimId;

function buildClaim(
	candidateId: string,
	sourceUrl: string,
	spec: ClaimSpec,
): ConsolidatedClaim {
	const counterevidenceCount = spec.counterevidenceCount ?? 0;
	return {
		claimId: toClaimId(spec.claimId),
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
				evidenceId: `ce_${sha16(`${spec.claimId}:${index}`)}`,
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
		confidence:
			spec.verificationLevel === "L2"
				? 0.9
				: spec.verificationLevel === "L1"
					? 0.75
					: 0.5,
		verificationLevel: spec.verificationLevel,
		verificationStatus: spec.verificationStatus,
		verificationRationale: "Synthetic fixture verification rationale.",
		verificationMethods: ["primary-source-inspection"],
		uncertainty: {
			unresolved:
				counterevidenceCount > 0
					? [
							{
								type: "evidence-gap",
								uncertainty:
									"Synthetic counterevidence requires resolution.",
								impact: "high" as const,
								blocking: true,
							},
						]
					: [],
			assumptions: [],
			falsificationCriteria: [],
		},
		sourceProvenance: {
			sourceId: "synthetic-source",
			url: "https://example.com/synthetic-source",
			title: "Synthetic Source",
			publicationTimestamp: "2025-01-01T00:00:00Z",
			retrievedAt: "2025-01-15T06:00:00Z",
			verificationTimestamp: "2025-01-15T06:00:00Z",
			verifiedBy: "synthetic-verifier",
		},
		inclusionNote:
			"Synthetic fixture claim included for regression testing only.",
	};
}

function buildCandidate(
	spec: CandidateSpec,
	editionDate: string,
): CanonicalCandidate {
	const novelty = classifyNovelty({
		title: spec.title,
		summary: spec.statement ?? spec.title,
		proposedPublicationTimestamp: spec.publicationTimestamp,
		sourceUrls: [spec.sourceUrl],
		sourceTier: spec.tier,
		editionDate,
		isKnownUpdate: spec.isKnownUpdate ?? false,
		updateDescription: spec.updateDescription,
	});
	const status = deriveTemporalEligibilityStatus(novelty);
	const now = `${editionDate}T06:00:00Z`;
	const candidateId = toCandidateId(spec.candidateId);

	return {
		candidateId,
		editionId: `edition_${editionDate}`,
		editionDate,
		factualHeadline: spec.title,
		exactStatement: spec.statement ?? spec.title,
		researchDomains: spec.researchDomains ?? [
			"agentic-ai-software-engineering",
		],
		subdomainTags: [],
		discoveryRings: [spec.tier === 1 ? 2 : spec.tier === 2 ? 1 : 3],
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
			timestampAvailability: "available",
		},
		temporalEligibility: {
			status,
			rationale: `Synthetic fixture eligibility: ${status}.`,
			noveltyClassification: novelty,
			editionBoundary: {
				start: getEditorialWindow(editionDate).start,
				end: getEditorialWindow(editionDate).end,
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
		editorialReadiness: {
			materialNovelty: { level: "medium", evidence: [], traceableTo: [] },
			technicalScientificSignificance: {
				level: "medium",
				evidence: [],
				traceableTo: [],
			},
			realWorldConsequences: {
				level: "medium",
				evidence: [],
				traceableTo: [],
			},
			enterpriseEconomicImplications: {
				level: "medium",
				evidence: [],
				traceableTo: [],
			},
			generalizability: {
				level: "medium",
				evidence: [],
				traceableTo: [],
			},
			evidenceStrength: {
				level: "medium",
				evidence: [],
				traceableTo: [],
			},
			evidenceLimitations: {
				level: "medium",
				evidence: [],
				traceableTo: [],
			},
			practicalEngineeringRelevance: {
				level: "medium",
				evidence: [],
				traceableTo: [],
			},
			availabilityMaturity: {
				level: "medium",
				evidence: [],
				traceableTo: [],
			},
			potentialOverlap: { level: "low", evidence: [], traceableTo: [] },
			selectionNote: SELECTION_NOTE,
		},
		processingStatus: "consolidated",
		audit: {
			discoveredAt: now,
			retrievedAt: now,
			noveltyClassifiedAt: now,
			consolidatedAt: now,
			consolidatedBy: "synthetic-historical-regression-fixture",
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

export function buildDossier(
	editionDate: string,
	candidates: CanonicalCandidate[],
): CanonicalFactDossier {
	const now = `${editionDate}T06:00:00Z`;
	const window = getEditorialWindow(editionDate);
	const dossier: CanonicalFactDossier = {
		schemaVersion: "1.0.0",
		dossierId: `fd_${sha16(`fact-dossier:${editionDate}`)}`,
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
		generatedBy: "synthetic-historical-regression-fixture",
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

export function buildAudit(
	editionDate: string,
	dossierId: string,
): OmissionReviewReport {
	const executionId = `exec_${crypto.randomBytes(8).toString("hex")}`;
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
			reviewerId: "synthetic-fixture-audit",
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
		criticalAndMaterialOmissionsRepaired: [],
		existingCandidatesUpdated: [],
		remainingCoverageGaps: [],
		finalDossierVersion: dossierId,
		executionTimestamps: {
			startedAt: `${editionDate}T06:00:00Z`,
			reportFinalizedAt: `${editionDate}T06:30:00Z`,
		},
		verificationOutcomes: {
			totalCandidatesInvestigated: 0,
			verifiedAndAdded: 0,
			verifiedAndRejected: 0,
			evidenceUnavailable: 0,
			unresolved: 0,
		},
	};
}

// ============================================================================
// Historical edition fixtures
// ============================================================================

const COPILOT_ORGS = ["GitHub"];
const COPILOT_PRODUCTS = ["GitHub Copilot coding agent"];
const COPILOT_TECHS = ["background agents", "checkpointing"];

/** Historical editions actually covered by the fixture set. */
export function createHistoricalEditionFixtures(): Record<
	string,
	CanonicalFactDossier
> {
	const editions: Record<string, CanonicalFactDossier> = {};

	// --- 2025-01-08 (AVAILABLE) -------------------------------------------
	editions["2025-01-08"] = buildDossier("2025-01-08", [
		buildCandidate(
			{
				candidateId: "cand_copilot_release_0108",
				title: "GitHub Copilot coding agent adds background delegation",
				statement:
					"GitHub Copilot coding agent delegates tasks to background agents with checkpointing.",
				sourceId: "github-copilot-vscode",
				sourceUrl:
					"https://github.blog/changelog/copilot-coding-agent-background-delegation",
				tier: 2,
				organizations: COPILOT_ORGS,
				products: COPILOT_PRODUCTS,
				technologies: COPILOT_TECHS,
				researchDomains: ["agentic-ai-software-engineering"],
				publicationTimestamp:
					"2025-01-07T12:00:00+01:00[Europe/Amsterdam]",
				claims: [
					{
						claimId: "claim_copilot_release_0108",
						text: "GitHub Copilot coding agent delegates tasks to background agents with checkpointing.",
						claimType: "vendor-announcement",
						classification: "VENDOR_CLAIM",
						verificationStatus: "unverified",
						verificationLevel: "L0",
						technicalContext: {
							releaseMaturity: "preview",
							implementationStatus: "preview",
							productVersion: "1.0",
							capabilities: [
								"background task delegation",
								"checkpointing",
							],
						},
					},
				],
			},
			"2025-01-08",
		),
		buildCandidate(
			{
				candidateId: "cand_moe_paper_0108",
				title: "Mixture-of-Experts scaling laws show sublinear expert growth",
				statement:
					"A synthetic study derives scaling laws for Mixture-of-Experts models with documented methodology.",
				sourceId: "arxiv-cs-lg",
				sourceUrl: "https://arxiv.org/abs/2501.12345",
				tier: 1,
				organizations: ["Synthetic Research Lab"],
				technologies: ["Mixture-of-Experts", "scaling laws"],
				researchDomains: ["models-inference-scientific"],
				publicationTimestamp:
					"2025-01-07T18:00:00+01:00[Europe/Amsterdam]",
				claims: [
					{
						claimId: "claim_moe_paper_0108",
						text: "Optimal Mixture-of-Experts count scales sublinearly with model size (E_opt ∝ N^0.3).",
						claimType: "scientific-research",
						classification: "RESEARCH_FINDING",
						verificationStatus: "verified",
						verificationLevel: "L2",
						methodologicalContext: {
							studyDesign:
								"Controlled scaling experiments with fixed compute budget.",
							methodology:
								"Synthetic controlled experiments on 8x H100, bfloat16, batch size 64.",
							reproducibility: {
								artifactAvailable: true,
								artifactUrl:
									"https://github.com/synthetic/moe-scaling",
								independentReplications: 0,
							},
							benchmarkConditions: {
								warmupRuns: true,
								batchSize: 64,
								precision: "bfloat16",
								hardwareSpecified: true,
								confoundersAddressed: [],
							},
						},
					},
				],
			},
			"2025-01-08",
		),
		buildCandidate(
			{
				candidateId: "cand_mckinsey_0108",
				title: "Synthetic advisory finding on generative AI economic potential",
				statement:
					"A synthetic advisory study estimates generative AI economic potential with disclosed methodology.",
				sourceId: "mckinsey-insights",
				sourceUrl:
					"https://www.mckinsey.com/insights/synthetic-generative-ai-economic-potential",
				tier: 2,
				organizations: ["McKinsey Global Institute"],
				technologies: ["generative AI"],
				researchDomains: [
					"economics-business-impact",
					"independent-research-advisory",
				],
				publicationTimestamp:
					"2025-01-07T12:00:00+01:00[Europe/Amsterdam]",
				claims: [
					{
						claimId: "claim_mckinsey_0108",
						text: "Generative AI could add $2.6T-$4.4T annually across 63 use cases.",
						claimType: "advisory-finding",
						classification: "EXPERT_INTERPRETATION",
						verificationStatus: "partially-verified",
						verificationLevel: "L1",
						strategicContext: {
							measuredOutcome:
								"Potential annual value of $2.6T-$4.4T across 63 use cases.",
							sampleSize: 1000,
							researchPeriod: "2023 to 2024",
							statisticalUncertainty:
								"Estimates span $2.6T-$4.4T.",
						},
					},
				],
			},
			"2025-01-08",
		),
	]);

	// --- 2025-01-09 (AVAILABLE) -------------------------------------------
	editions["2025-01-09"] = buildDossier("2025-01-09", [
		buildCandidate(
			{
				candidateId: "cand_gartner_0109",
				title: "Gartner predicts 75% of enterprises will operationalize AI by 2026",
				statement:
					"A synthetic Gartner forecast predicts enterprise AI operationalization.",
				sourceId: "gartner-newsroom",
				sourceUrl:
					"https://www.gartner.com/en/newsroom/synthetic-ai-operationalization",
				tier: 2,
				organizations: ["Gartner"],
				technologies: ["enterprise AI"],
				researchDomains: [
					"enterprise-adoption-organizational",
					"independent-research-advisory",
				],
				publicationTimestamp:
					"2025-01-08T12:00:00+01:00[Europe/Amsterdam]",
				claims: [
					{
						claimId: "claim_gartner_0109",
						text: "By 2026, 75% of enterprises will operationalize AI.",
						claimType: "advisory-finding",
						classification: "EXPERT_INTERPRETATION",
						verificationStatus: "partially-verified",
						verificationLevel: "L1",
						strategicContext: {
							measuredOutcome:
								"75% of enterprises operationalizing AI by 2026.",
							researchPeriod: "2024 to 2025",
						},
					},
				],
			},
			"2025-01-09",
		),
		buildCandidate(
			{
				candidateId: "cand_productivity_0109",
				title: "Synthetic vendor study claims 55% faster task completion",
				statement:
					"A synthetic vendor study reports faster task completion with a coding assistant.",
				sourceId: "github-copilot-vscode",
				sourceUrl:
					"https://github.blog/research/synthetic-copilot-productivity-study",
				tier: 2,
				organizations: ["GitHub"],
				products: ["Synthetic coding assistant"],
				technologies: ["coding assistant"],
				researchDomains: ["enterprise-adoption-organizational"],
				publicationTimestamp:
					"2025-01-08T14:00:00+01:00[Europe/Amsterdam]",
				claims: [
					{
						claimId: "claim_productivity_0109",
						text: "Developers using the synthetic coding assistant complete tasks 55% faster (1.2h vs 2.7h).",
						claimType: "productivity-claim",
						classification: "VENDOR_CLAIM",
						verificationStatus: "unverified",
						verificationLevel: "L0",
						strategicContext: {
							measuredOutcome:
								"55% faster task completion (1.2h vs 2.7h).",
							baseline:
								"Control group without the coding assistant.",
						},
					},
				],
			},
			"2025-01-09",
		),
	]);

	// --- 2025-01-10 (AVAILABLE, does NOT contain the missed announcement) --
	editions["2025-01-10"] = buildDossier("2025-01-10", [
		buildCandidate(
			{
				candidateId: "cand_cloud_pricing_0110",
				title: "Synthetic Cloud reduces inference pricing by 12%",
				statement:
					"A synthetic cloud provider reduces inference pricing.",
				sourceId: "synthetic-cloud-blog",
				sourceUrl:
					"https://synthetic-cloud.example.com/blog/inference-pricing-reduction",
				tier: 2,
				organizations: ["Synthetic Cloud Provider"],
				products: ["Synthetic Cloud"],
				technologies: ["inference"],
				researchDomains: ["economics-business-impact"],
				publicationTimestamp:
					"2025-01-09T12:00:00+01:00[Europe/Amsterdam]",
				claims: [
					{
						claimId: "claim_cloud_pricing_0110",
						text: "Synthetic Cloud reduces inference pricing by 12%.",
						claimType: "vendor-announcement",
						classification: "VENDOR_CLAIM",
						verificationStatus: "unverified",
						verificationLevel: "L0",
					},
				],
			},
			"2025-01-10",
		),
	]);

	// --- 2025-01-11: UNAVAILABLE (no records) ------------------------------

	// --- 2025-01-12 (PARTIAL: dossier only, no research audit) ------------
	editions["2025-01-12"] = buildDossier("2025-01-12", [
		buildCandidate(
			{
				candidateId: "cand_cloud_security_0112",
				title: "Synthetic Cloud provider acknowledges 2023 security incident",
				statement:
					"A synthetic cloud provider acknowledged a 2023 security incident without detail.",
				sourceId: "synthetic-cloud-blog",
				sourceUrl:
					"https://synthetic-cloud.example.com/blog/2023-incident-statement",
				tier: 2,
				organizations: ["Synthetic Cloud Provider"],
				products: ["Synthetic Cloud"],
				technologies: ["cloud security"],
				researchDomains: ["architecture-security-governance"],
				publicationTimestamp:
					"2025-01-11T12:00:00+01:00[Europe/Amsterdam]",
				claims: [
					{
						claimId: "claim_cloud_security_0112",
						text: "Synthetic Cloud provider acknowledged a 2023 security incident.",
						claimType: "vendor-announcement",
						classification: "VENDOR_CLAIM",
						verificationStatus: "unverified",
						verificationLevel: "L0",
					},
				],
			},
			"2025-01-12",
		),
	]);

	// --- 2025-01-13 (AVAILABLE) -------------------------------------------
	editions["2025-01-13"] = buildDossier("2025-01-13", [
		buildCandidate(
			{
				candidateId: "cand_context_compression_0113",
				title: "Context compression reduces token cost by 40% on long documents",
				statement:
					"A synthetic study measures context compression effects on token cost.",
				sourceId: "arxiv-cs-lg",
				sourceUrl: "https://arxiv.org/abs/2501.99999",
				tier: 1,
				organizations: ["Synthetic Research Lab"],
				technologies: ["context compression"],
				researchDomains: ["models-inference-scientific"],
				publicationTimestamp:
					"2025-01-12T12:00:00+01:00[Europe/Amsterdam]",
				claims: [
					{
						claimId: "claim_context_compression_0113",
						text: "Context compression reduces token cost by 40% on long documents.",
						claimType: "scientific-research",
						classification: "RESEARCH_FINDING",
						verificationStatus: "verified",
						verificationLevel: "L2",
						methodologicalContext: {
							methodology:
								"Synthetic controlled experiments on long documents.",
						},
					},
				],
			},
			"2025-01-13",
		),
	]);

	// --- 2025-01-14 (AVAILABLE) -------------------------------------------
	editions["2025-01-14"] = buildDossier("2025-01-14", [
		buildCandidate(
			{
				candidateId: "cand_forrester_0114",
				title: "Forrester forecasts AI governance spending to reach $50B",
				statement:
					"A synthetic Forrester forecast covers AI governance spending.",
				sourceId: "forrester-blogs",
				sourceUrl:
					"https://www.forrester.com/synthetic/ai-governance-spending",
				tier: 2,
				organizations: ["Forrester"],
				technologies: ["AI governance"],
				researchDomains: [
					"economics-business-impact",
					"independent-research-advisory",
				],
				publicationTimestamp:
					"2025-01-13T12:00:00+01:00[Europe/Amsterdam]",
				claims: [
					{
						claimId: "claim_forrester_0114",
						text: "AI governance spending will reach $50B by 2027.",
						claimType: "advisory-finding",
						classification: "EXPERT_INTERPRETATION",
						verificationStatus: "partially-verified",
						verificationLevel: "L1",
						strategicContext: {
							measuredOutcome:
								"AI governance spending reaching $50B by 2027.",
						},
					},
				],
			},
			"2025-01-14",
		),
	]);

	return editions;
}

// ============================================================================
// Current edition fixture
// ============================================================================

export function createCurrentEditionDossier(): CanonicalFactDossier {
	const editionDate = CURRENT_EDITION;
	const inWindow = "2025-01-14T12:00:00+01:00[Europe/Amsterdam]";

	return buildDossier(editionDate, [
		// 1. Previously covered GitHub Copilot release (exact repeat).
		buildCandidate(
			{
				candidateId: "cand_copilot_release_0108",
				title: "GitHub Copilot coding agent adds background delegation",
				statement:
					"GitHub Copilot coding agent delegates tasks to background agents with checkpointing.",
				sourceId: "github-copilot-vscode",
				sourceUrl:
					"https://github.blog/changelog/copilot-coding-agent-background-delegation",
				tier: 2,
				organizations: COPILOT_ORGS,
				products: COPILOT_PRODUCTS,
				technologies: COPILOT_TECHS,
				researchDomains: ["agentic-ai-software-engineering"],
				publicationTimestamp: inWindow,
				claims: [
					{
						claimId: "claim_copilot_release_repeat_0115",
						text: "GitHub Copilot coding agent delegates tasks to background agents with checkpointing.",
						claimType: "vendor-announcement",
						classification: "VENDOR_CLAIM",
						verificationStatus: "unverified",
						verificationLevel: "L0",
						technicalContext: {
							releaseMaturity: "preview",
							implementationStatus: "preview",
							productVersion: "1.0",
							capabilities: [
								"background task delegation",
								"checkpointing",
							],
						},
					},
				],
			},
			editionDate,
		),

		// 2. Material GitHub Copilot capability update (substantive update).
		buildCandidate(
			{
				candidateId: "cand_copilot_update_0115",
				title: "GitHub Copilot coding agent adds agent teams and general availability",
				statement:
					"GitHub Copilot coding agent adds agent teams and background delegation reaches general availability.",
				sourceId: "github-copilot-vscode",
				sourceUrl:
					"https://github.blog/changelog/copilot-coding-agent-agent-teams-ga",
				tier: 2,
				organizations: COPILOT_ORGS,
				products: COPILOT_PRODUCTS,
				technologies: [...COPILOT_TECHS, "agent teams"],
				researchDomains: ["agentic-ai-software-engineering"],
				publicationTimestamp: inWindow,
				substantiveUpdateTimestamp: inWindow,
				isKnownUpdate: true,
				updateDescription:
					"Background delegation reaches general availability and agent teams are added.",
				claims: [
					{
						claimId: "claim_copilot_release_0108",
						text: "GitHub Copilot coding agent now supports agent teams and background delegation is generally available.",
						claimType: "software-release",
						classification: "VENDOR_CLAIM",
						verificationStatus: "unverified",
						verificationLevel: "L0",
						technicalContext: {
							releaseMaturity: "ga",
							implementationStatus: "released",
							productVersion: "2.0",
							capabilities: [
								"background task delegation",
								"checkpointing",
								"agent teams",
							],
						},
					},
				],
			},
			editionDate,
		),

		// 3. Older scientific paper summarized in a newly published article.
		buildCandidate(
			{
				candidateId: "cand_paper_summary_0115",
				title: "New article summarizes Mixture-of-Experts scaling laws",
				statement:
					"A new article summarizes the synthetic Mixture-of-Experts scaling study.",
				sourceId: "synthetic-blog",
				sourceUrl:
					"https://synthetic-blog.example.com/moe-scaling-summary",
				tier: 3,
				organizations: ["Synthetic Blog"],
				technologies: ["Mixture-of-Experts"],
				researchDomains: ["models-inference-scientific"],
				publicationTimestamp: inWindow,
				claims: [
					{
						claimId: "claim_moe_paper_0108",
						text: "Optimal Mixture-of-Experts count scales sublinearly with model size (E_opt ∝ N^0.3).",
						claimType: "scientific-research",
						classification: "RESEARCH_FINDING",
						verificationStatus: "verified",
						verificationLevel: "L2",
					},
				],
			},
			editionDate,
		),

		// 4. New independent study revising previously accepted findings.
		buildCandidate(
			{
				candidateId: "cand_independent_replication_0115",
				title: "Independent replication finds 22% faster task completion, not 55%",
				statement:
					"An independent replication revises the synthetic coding assistant productivity claim.",
				sourceId: "synthetic-independent-lab",
				sourceUrl:
					"https://independent.example.com/synthetic-replication-productivity",
				tier: 1,
				organizations: ["Synthetic Independent Lab"],
				technologies: ["coding assistant"],
				researchDomains: [
					"enterprise-adoption-organizational",
					"developer-productivity-software-delivery",
				],
				publicationTimestamp:
					"2025-01-14T14:00:00+01:00[Europe/Amsterdam]",
				isKnownUpdate: true,
				updateDescription:
					"Independent replication revises the previously accepted 55% productivity claim.",
				claims: [
					{
						claimId: "claim_productivity_0109",
						text: "Independent replication finds 22% faster task completion (1.9h vs 2.7h); the 55% claim was not reproduced.",
						claimType: "productivity-claim",
						classification: "RESEARCH_FINDING",
						verificationStatus: "verified",
						verificationLevel: "L2",
						corroboration: true,
						counterevidenceCount: 1,
						strategicContext: {
							measuredOutcome:
								"22% faster task completion (1.9h vs 2.7h).",
							baseline:
								"Control group without the coding assistant.",
						},
					},
				],
			},
			editionDate,
		),

		// 5. Gartner report repeating established conclusions.
		buildCandidate(
			{
				candidateId: "cand_gartner_repeat_0115",
				title: "Gartner repeats 75% enterprise AI operationalization forecast",
				statement:
					"A new Gartner publication repeats the established enterprise AI forecast.",
				sourceId: "gartner-newsroom",
				sourceUrl:
					"https://www.gartner.com/en/newsroom/synthetic-ai-operationalization-repeat",
				tier: 2,
				organizations: ["Gartner"],
				technologies: ["enterprise AI"],
				researchDomains: [
					"enterprise-adoption-organizational",
					"independent-research-advisory",
				],
				publicationTimestamp: inWindow,
				claims: [
					{
						claimId: "claim_gartner_0109",
						text: "By 2026, 75% of enterprises will operationalize AI.",
						claimType: "advisory-finding",
						classification: "EXPERT_INTERPRETATION",
						verificationStatus: "partially-verified",
						verificationLevel: "L1",
						strategicContext: {
							measuredOutcome:
								"75% of enterprises operationalizing AI by 2026.",
							researchPeriod: "2024 to 2025",
						},
					},
				],
			},
			editionDate,
		),

		// 6. Strategic research report with genuinely new empirical findings.
		buildCandidate(
			{
				candidateId: "cand_mckinsey_new_0115",
				title: "McKinsey revises generative AI economic potential upward",
				statement:
					"A new synthetic McKinsey report reports new empirical findings on generative AI value.",
				sourceId: "mckinsey-insights",
				sourceUrl:
					"https://www.mckinsey.com/insights/synthetic-generative-ai-economic-potential-2025",
				tier: 2,
				organizations: ["McKinsey Global Institute"],
				technologies: ["generative AI"],
				researchDomains: [
					"economics-business-impact",
					"independent-research-advisory",
				],
				publicationTimestamp: inWindow,
				substantiveUpdateTimestamp: inWindow,
				isKnownUpdate: true,
				updateDescription:
					"New survey data revises the economic potential estimate.",
				claims: [
					{
						claimId: "claim_mckinsey_0108",
						text: "Generative AI could add $3.1T-$5.2T annually across 74 use cases, based on a 2025 survey of 1,500 organizations.",
						claimType: "strategic-research",
						classification: "EXPERT_INTERPRETATION",
						verificationStatus: "partially-verified",
						verificationLevel: "L1",
						strategicContext: {
							measuredOutcome:
								"Potential annual value of $3.1T-$5.2T across 74 use cases.",
							sampleSize: 1500,
							researchPeriod: "2024 to 2025",
							statisticalUncertainty:
								"Estimates span $3.1T-$5.2T.",
						},
					},
				],
			},
			editionDate,
		),

		// 7. Important AI announcement missed in an earlier edition.
		buildCandidate(
			{
				candidateId: "cand_missed_announcement_0115",
				title: "Synthetic AI lab announces general-purpose coding model",
				statement:
					"A synthetic AI lab announced a general-purpose coding model during an earlier edition window.",
				sourceId: "synthetic-ai-lab",
				sourceUrl:
					"https://synthetic-ai-lab.example.com/announcements/general-purpose-coding-model",
				tier: 1,
				organizations: ["Synthetic AI Lab"],
				products: ["Synthetic Coding Model"],
				technologies: ["coding model"],
				researchDomains: ["models-inference-scientific"],
				publicationTimestamp:
					"2025-01-09T12:00:00+01:00[Europe/Amsterdam]",
				firstDisclosureTimestamp:
					"2025-01-09T12:00:00+01:00[Europe/Amsterdam]",
				claims: [
					{
						claimId: "claim_missed_announcement_0115",
						text: "Synthetic AI Lab announced a general-purpose coding model with a 1M token context window.",
						claimType: "software-release",
						classification: "VENDOR_CLAIM",
						verificationStatus: "unverified",
						verificationLevel: "L0",
					},
				],
			},
			editionDate,
		),

		// 8. Historical edition that cannot be accessed (01-11 window).
		buildCandidate(
			{
				candidateId: "cand_inaccessible_window_0115",
				title: "Synthetic security advisory published during an inaccessible edition",
				statement:
					"A synthetic security advisory was published while edition records are inaccessible.",
				sourceId: "synthetic-security-feed",
				sourceUrl:
					"https://synthetic-security.example.com/advisories/2025-01-10",
				tier: 1,
				organizations: ["Synthetic Security Feed"],
				technologies: ["security advisory"],
				researchDomains: ["architecture-security-governance"],
				publicationTimestamp:
					"2025-01-10T12:00:00+01:00[Europe/Amsterdam]",
				firstDisclosureTimestamp:
					"2025-01-10T12:00:00+01:00[Europe/Amsterdam]",
				claims: [
					{
						claimId: "claim_inaccessible_window_0115",
						text: "A synthetic security advisory documented CVE-2025-0001.",
						claimType: "security-vulnerability",
						classification: "RESEARCH_FINDING",
						verificationStatus: "verified",
						verificationLevel: "L1",
					},
				],
			},
			editionDate,
		),

		// 9. New original reporting about an older underlying event.
		buildCandidate(
			{
				candidateId: "cand_breach_exclusive_0115",
				title: "Exclusive: synthetic cloud provider hid 2023 breach",
				statement:
					"Original reporting reveals a synthetic 2023 data breach that was not publicly disclosed at the time.",
				sourceId: "mit-technology-review-ai",
				sourceUrl:
					"https://www.technologyreview.com/synthetic/cloud-provider-2023-breach",
				tier: 2,
				organizations: [
					"Synthetic Cloud Provider",
					"MIT Technology Review",
				],
				products: ["Synthetic Cloud"],
				technologies: ["cloud infrastructure"],
				researchDomains: ["architecture-security-governance"],
				publicationTimestamp:
					"2025-01-14T14:00:00+01:00[Europe/Amsterdam]",
				firstDisclosureTimestamp:
					"2025-01-14T14:00:00+01:00[Europe/Amsterdam]",
				underlyingEventDate: "2023-03-15T00:00:00Z",
				claims: [
					{
						claimId: "claim_breach_exclusive_0115",
						text: "A synthetic cloud provider experienced an unreported 2023 data breach affecting 10M users.",
						claimType: "original-reporting",
						classification: "ORIGINAL_REPORTING",
						verificationStatus: "verified",
						verificationLevel: "L1",
					},
				],
			},
			editionDate,
		),

		// 10. Semantic-only match (token similarity, no shared identifiers).
		buildCandidate(
			{
				candidateId: "cand_context_update_0115",
				title: "New method cuts token cost by 40% for long documents",
				statement:
					"A synthetic independent group reports a new method that cuts token cost for long documents.",
				sourceId: "synthetic-independent-blog",
				sourceUrl:
					"https://synthetic-independent.example.com/context-token-cost",
				tier: 2,
				organizations: ["Synthetic Independent Group"],
				technologies: ["context engineering"],
				researchDomains: ["models-inference-scientific"],
				publicationTimestamp: inWindow,
				claims: [
					{
						claimId: "claim_context_update_0115",
						text: "A new method cuts token cost by 40% for long documents.",
						claimType: "scientific-research",
						classification: "RESEARCH_FINDING",
						verificationStatus: "verified",
						verificationLevel: "L2",
					},
				],
			},
			editionDate,
		),

		// 11. Different study covering a similar topic (IDC vs Forrester).
		buildCandidate(
			{
				candidateId: "cand_idc_0115",
				title: "IDC forecasts AI infrastructure spending to reach $120B",
				statement:
					"A synthetic IDC forecast covers AI infrastructure spending.",
				sourceId: "idc-press-releases",
				sourceUrl:
					"https://www.idc.com/synthetic/ai-infrastructure-spending",
				tier: 2,
				organizations: ["IDC"],
				technologies: ["AI infrastructure"],
				researchDomains: [
					"economics-business-impact",
					"independent-research-advisory",
				],
				publicationTimestamp: inWindow,
				claims: [
					{
						claimId: "claim_idc_0115",
						text: "AI infrastructure spending will reach $120B by 2028.",
						claimType: "advisory-finding",
						classification: "EXPERT_INTERPRETATION",
						verificationStatus: "partially-verified",
						verificationLevel: "L1",
						strategicContext: {
							measuredOutcome:
								"AI infrastructure spending reaching $120B by 2028.",
						},
					},
				],
			},
			editionDate,
		),
	]);
}

// ============================================================================
// Fixture persistence
// ============================================================================

export interface HistoricalFixtureSet {
	dataDir: string;
	historical: Record<string, CanonicalFactDossier>;
	current: CanonicalFactDossier;
}

export function createHistoricalFixtures(): HistoricalFixtureSet {
	return {
		dataDir: FIXTURE_DATA_DIR,
		historical: createHistoricalEditionFixtures(),
		current: createCurrentEditionDossier(),
	};
}

/**
 * Write the synthetic fixture records to a local data directory, mirroring the
 * real persistence layout. Editions marked unavailable are deliberately absent.
 */
export function writeHistoricalFixtures(
	dataDir: string = FIXTURE_DATA_DIR,
): HistoricalFixtureSet {
	rmSync(dataDir, { recursive: true, force: true });
	const fixtures = createHistoricalFixtures();

	for (const [editionDate, dossier] of Object.entries(fixtures.historical)) {
		// 2025-01-12 is intentionally PARTIAL: dossier only, no research audit.
		const hasAudit = editionDate !== "2025-01-12";
		const dossierDir = join(dataDir, "fact-dossiers");
		mkdirSync(dossierDir, { recursive: true });
		writeFileSync(
			join(dossierDir, `edition_${editionDate}.json`),
			JSON.stringify(dossier, null, 2),
			"utf-8",
		);

		if (hasAudit) {
			const auditDir = join(dataDir, "omission-reviews");
			mkdirSync(auditDir, { recursive: true });
			const audit = buildAudit(editionDate, dossier.dossierId);
			writeFileSync(
				join(
					auditDir,
					`${editionDate}_${audit.context.executionId.slice(0, 8)}.json`,
				),
				JSON.stringify(audit, null, 2),
				"utf-8",
			);
		}
	}

	// --- Cross-edition traceability fixtures --------------------------------
	// A legacy per-candidate dossier plus a publication-history record for the
	// 2025-01-08 Copilot release, so previous publication references can be
	// resolved without inventing coverage.
	const copilotCandidateId = fixtureCandidateId("cand_copilot_release_0108");
	const legacyDossierId = `dossier_${sha16(`legacy:${copilotCandidateId}`)}`;
	const publicationId = `pub_${sha16(`publication:${copilotCandidateId}`)}`;

	const legacyDir = join(dataDir, "dossiers");
	const publicationsDir = join(dataDir, "publications");
	mkdirSync(legacyDir, { recursive: true });
	mkdirSync(publicationsDir, { recursive: true });

	writeFileSync(
		join(legacyDir, `${legacyDossierId}.json`),
		JSON.stringify(
			{
				id: legacyDossierId,
				candidateId: copilotCandidateId,
				slug: "copilot-background-delegation",
				type: "daily-brief",
				locale: "en",
				status: "published",
			},
			null,
			2,
		),
		"utf-8",
	);
	writeFileSync(
		join(publicationsDir, `${publicationId}.json`),
		JSON.stringify(
			{
				id: publicationId,
				dossierId: legacyDossierId,
				slug: "copilot-background-delegation",
				type: "daily-brief",
				locale: "en",
				title: "GitHub Copilot coding agent adds background delegation",
				publishedAt: "2025-01-08T07:00:00+01:00",
				status: "published",
			},
			null,
			2,
		),
		"utf-8",
	);

	return fixtures;
}
