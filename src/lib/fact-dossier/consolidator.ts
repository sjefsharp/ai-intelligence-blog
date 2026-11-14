/**
 * Canonical Fact Dossier — Consolidator
 *
 * Builds the authoritative per-edition factual foundation by consuming the
 * results of the earlier pipeline stages:
 *
 *   Source Discovery → Retrieval → Candidate Identification
 *     → Temporal Classification → Claim Verification
 *     → Canonical Fact Dossier (this module)
 *     → Omission Review → Editorial Selection → Publication
 *
 * The consolidator never re-implements novelty or verification business rules.
 * It calls `classifyNovelty` for temporal classification and consumes
 * `ClaimVerificationRecord` objects verbatim for claim-level consolidation.
 * Missing metadata is recorded as an explicit uncertainty — never inferred.
 */

import crypto from "crypto";
import { Temporal } from "@js-temporal/polyfill";

import type { CandidateNewsItem, DiscoveredItem } from "../signal-desk.js";
import type { ClaimVerificationRecord } from "../evidence-verification/types.js";
import type { SourceMonitoringRecord } from "../discovery-ledger/types.js";
import {
	classifyNovelty,
	type ClassificationEvidence,
	type NoveltyClassificationInput,
	type NoveltyClassificationResult,
} from "../novelty-classification.js";
import type { EditorialWindow } from "../editorial-window.js";
import {
	FACT_DOSSIER_SCHEMA_VERSION,
	type CanonicalCandidate,
	type CanonicalCandidateCore,
	type CanonicalFactDossier,
	type CanonicalSourceReference,
	type CandidateTimestamps,
	type ClaimSourceProvenance,
	type ClaimType,
	type ConsolidatedClaim,
	type ContradictoryEvidence,
	type DiscoveryRing,
	type DossierStatus,
	type EditionSummary,
	type EditionUncertainty,
	type HistoricalContinuityRecord,
	type MethodologicalContext,
	type PreviousCoverageReference,
	type ProcessingAudit,
	type ProcessingStep,
	type SourceAccessibilityRecord,
	type StrategicContext,
	type TemporalEligibility,
	type TemporalEligibilityStatus,
	type TechnicalContext,
	type VerificationMethod,
} from "./schema.js";
import { computeEditorialReadinessIndicators } from "./indicators.js";
import { computeDossierContentHash } from "./canonical.js";

// ============================================================================
// Errors
// ============================================================================

/** Thrown when a candidate cannot be consolidated from the available evidence. */
export class ConsolidationError extends Error {
	readonly candidateId: string;
	constructor(candidateId: string, message: string) {
		super(message);
		this.name = "ConsolidationError";
		this.candidateId = candidateId;
	}
}

// ============================================================================
// Input types
// ============================================================================

/** Minimal source registry entry shape required by the consolidator. */
export interface SourceRegistryEntry {
	id: string;
	tier: 1 | 2 | 3;
	type: string;
	url: string;
	title?: string;
	status?: string;
	ringAffinity?: DiscoveryRing[];
	[key: string]: unknown;
}

/** Summary of a candidate from an earlier edition, used for overlap detection. */
export interface PreviousEditionCandidateSummary {
	candidateId: string;
	editionDate: string;
	title: string;
	sourceIds: string[];
	publicationId?: string;
	evidenceUrl?: string;
}

/** Index of earlier editions actually available to the pipeline. */
export interface PreviousEditionIndex {
	availableEditionDates: Set<string>;
	candidates: PreviousEditionCandidateSummary[];
}

/** Explicit hints for novelty classification (from triage or discovery metadata). */
export interface NoveltyHints {
	isKnownUpdate?: boolean;
	updateDescription?: string;
	newlyRevealedFacts?: string[];
	additionalEvidence?: ClassificationEvidence[];
}

/** Explicit entity involvement hints (organizations, products, technologies, projects). */
export interface EntityHints {
	organizations?: string[];
	products?: string[];
	technologies?: string[];
	researchProjects?: string[];
}

/** Consolidation context shared across all candidates in an edition. */
export interface ConsolidationContext {
	editionDate: string;
	editionWindow: EditorialWindow;
	taxonomyDomains: Set<string>;
	sourceRegistry: Map<string, SourceRegistryEntry>;
	previousEditions: PreviousEditionIndex;
	generatedBy: string;
	/** Deterministic timestamp override (tests, reproducible builds). */
	now?: string;
}

/** All inputs required to consolidate one candidate. */
export interface CandidateConsolidationInput {
	candidate: CandidateNewsItem;
	discovery?: DiscoveredItem;
	claims: ClaimVerificationRecord[];
	sourceRecords?: SourceMonitoringRecord[];
	previousCoverage?: PreviousCoverageReference[];
	accessibilityOverrides?: SourceAccessibilityRecord[];
	noveltyHints?: NoveltyHints;
	entityHints?: EntityHints;
}

// ============================================================================
// Helpers
// ============================================================================

function nowOr(context: ConsolidationContext): string {
	return context.now ?? new Date().toISOString();
}

function sortedUnique(values: string[]): string[] {
	return [...new Set(values)].sort();
}

function earliestString(values: (string | undefined)[]): string | undefined {
	const present = values.filter((v): v is string => Boolean(v));
	if (present.length === 0) return undefined;
	return present.slice().sort()[0];
}

function deriveDossierId(editionDate: string): string {
	return `fd_${crypto.createHash("sha256").update(`fact-dossier:${editionDate}`).digest("hex").slice(0, 16)}`;
}

function deriveStableUncertaintyId(parts: string[]): string {
	return `unc_${crypto.createHash("sha256").update(parts.join(":")).digest("hex").slice(0, 16)}`;
}

function getPreviousEditionDates(editionDate: string, count: number): string[] {
	const date = Temporal.PlainDate.from(editionDate);
	const result: string[] = [];
	for (let i = 1; i <= count; i++) {
		result.push(date.subtract({ days: i }).toString());
	}
	return result;
}

function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.split(" ")
		.filter((token) => token.length > 2);
}

function candidateOverlaps(
	a: { sourceIds: string[]; title: string },
	b: { sourceIds: string[]; title: string },
): boolean {
	if (a.sourceIds.some((s) => b.sourceIds.includes(s))) return true;
	const aTokens = new Set(tokenize(a.title));
	const bTokens = tokenize(b.title);
	const intersection = bTokens.filter((t) => aTokens.has(t));
	return (
		intersection.length >=
		Math.max(2, Math.min(aTokens.size, bTokens.length) * 0.5)
	);
}

// ============================================================================
// Temporal eligibility (consumes classifyNovelty)
// ============================================================================

/**
 * Derive the NEW_PASS / NEW_FAIL / TIME_UNVERIFIED / CATCH_UP eligibility gate
 * from the inherited novelty classification. This is a deterministic mapping,
 * not an independent novelty decision.
 */
export function deriveTemporalEligibilityStatus(
	result: NoveltyClassificationResult,
): TemporalEligibilityStatus {
	// In-window reposts/summaries fail the novelty gate even though the
	// publication timestamp itself is inside the window.
	if (result.isRepostOrSummary && result.inWindow) {
		return "NEW_FAIL";
	}
	switch (result.classification) {
		case "NEW":
			return "NEW_PASS";
		case "CATCH_UP":
			return "CATCH_UP";
		case "TIME_UNVERIFIED":
			return "TIME_UNVERIFIED";
	}
}

function buildTemporalRationale(
	status: TemporalEligibilityStatus,
	result: NoveltyClassificationResult,
): string {
	return [
		`Eligibility gate: ${status}.`,
		`Inherited novelty classification: ${result.classification} (confidence ${result.confidence.toFixed(2)}).`,
		result.reasoning,
		`Repost/summary flag: ${result.isRepostOrSummary ?? false}.`,
	].join(" ");
}

function deriveTemporalEligibility(
	input: CandidateConsolidationInput,
	context: ConsolidationContext,
	now: string,
): TemporalEligibility {
	const { candidate, discovery, claims } = input;
	const hints = input.noveltyHints ?? {};

	// Publication timestamp: prefer the discovery record, then the earliest claim.
	// Never infer a timestamp that no earlier stage produced.
	const timestamp =
		discovery?.publishedAt ??
		earliestString(
			claims.map(
				(c) => c.temporalVerification.originalPublicationTimestamp,
			),
		) ??
		"";

	const sourceUrls = candidate.sourceIds
		.map((id) => context.sourceRegistry.get(id)?.url)
		.filter((u): u is string => Boolean(u));
	if (sourceUrls.length === 0 && discovery?.url)
		sourceUrls.push(discovery.url);

	const noveltyInput: NoveltyClassificationInput = {
		title: candidate.title,
		summary: candidate.summary,
		proposedPublicationTimestamp: timestamp,
		sourceUrls,
		sourceTier: candidate.tier,
		isKnownUpdate: hints.isKnownUpdate ?? false,
		updateDescription: hints.updateDescription,
		newlyRevealedFacts: hints.newlyRevealedFacts ?? [],
		editionDate: context.editionDate,
		additionalEvidence: hints.additionalEvidence ?? [],
	};

	let result: NoveltyClassificationResult;
	try {
		result = classifyNovelty(noveltyInput);
	} catch {
		// No traceable publication timestamp exists. Preserve the classifier's own
		// semantics for unparseable timestamps instead of inferring a timestamp.
		result = {
			classification: "TIME_UNVERIFIED",
			editionDate: context.editionDate,
			inWindow: false,
			evidence: [
				{
					type: "source_publication_date",
					reference: noveltyInput.sourceUrls[0] ?? "unknown",
					timestamp,
					description:
						"Could not parse proposed publication timestamp",
					confidence: 0,
				},
			],
			reasoning:
				"Unable to parse proposed publication timestamp; no traceable publication timestamp was available from earlier stages.",
			primaryPublicationTimestamp: timestamp,
			isSubstantiveUpdate: false,
			isNewlyRevealedFact: false,
			isRepostOrSummary: false,
			confidence: 0,
		};
	}
	const status = deriveTemporalEligibilityStatus(result);

	const firstDisclosureFromClaims = claims
		.map((c) => c.temporalVerification.firstPublicDisclosureTimestamp)
		.find(Boolean);
	const underlyingEventFromClaims = claims
		.map((c) => c.temporalVerification.underlyingEventTimestamp)
		.find(Boolean);

	return {
		status,
		rationale: buildTemporalRationale(status, result),
		noveltyClassification: result,
		editionBoundary: {
			start: context.editionWindow.start,
			end: context.editionWindow.end,
			timezone: "Europe/Amsterdam",
		},
		publicationTimestampUsed:
			result.primaryPublicationTimestamp || undefined,
		firstDisclosureTimestampUsed:
			discovery?.firstDisclosedAt ?? firstDisclosureFromClaims,
		underlyingEventTimestampUsed:
			discovery?.eventDate ?? underlyingEventFromClaims,
		derivedFrom: "novelty-classification",
		derivedAt: now,
	};
}

// ============================================================================
// Timestamps
// ============================================================================

function buildCandidateTimestamps(
	input: CandidateConsolidationInput,
	now: string,
): CandidateTimestamps {
	const { discovery, claims } = input;

	const originalPublicationTimestamp =
		discovery?.publishedAt ??
		earliestString(
			claims.map(
				(c) => c.temporalVerification.originalPublicationTimestamp,
			),
		);

	const firstDisclosure =
		discovery?.firstDisclosedAt ??
		claims
			.map((c) => c.temporalVerification.firstPublicDisclosureTimestamp)
			.find(Boolean);

	const eventDate =
		discovery?.eventDate ??
		claims
			.map((c) => c.temporalVerification.underlyingEventTimestamp)
			.find(Boolean);

	const substantiveUpdate =
		discovery?.lastUpdatedAt ??
		claims
			.map((c) => c.temporalVerification.substantiveUpdateTimestamp)
			.find(Boolean);

	const firstClaim = claims
		.slice()
		.sort((a, b) => a.verifiedAt.localeCompare(b.verifiedAt))[0];
	const timezone =
		firstClaim?.supportingEvidence.find((e) => e.sourceTimezone)
			?.sourceTimezone ?? "unknown";
	const timestampConfidence =
		firstClaim?.temporalVerification.timestampConfidence ?? 0;
	const timestampPrecision =
		firstClaim?.temporalVerification.timezonePrecision ?? "unknown";

	return {
		originalPublicationTimestamp,
		earliestSupportedPublicDisclosureTimestamp: firstDisclosure,
		underlyingEventDate: eventDate,
		substantiveUpdateTimestamp: substantiveUpdate,
		retrievalTimestamp: discovery?.discoveredAt ?? now,
		timezone,
		timestampConfidence,
		timestampPrecision,
		timestampAvailability: originalPublicationTimestamp
			? "available"
			: "unavailable",
	};
}

// ============================================================================
// Claim consolidation (consumes ClaimVerificationRecord verbatim)
// ============================================================================

const VERIFICATION_LEVEL_ORDER: Record<string, number> = {
	L0: 0,
	L1: 1,
	L2: 2,
	L3: 3,
};

function buildInclusionNote(record: ClaimVerificationRecord): string {
	switch (record.evidenceClassification) {
		case "VERIFIED_FACT":
			return "Included as a verified fact with primary evidence and independent corroboration or explicit verification.";
		case "RESEARCH_FINDING":
			return "Included as a research finding; methodology reviewed. Not an independently replicated fact unless corroboration is recorded.";
		case "ORIGINAL_REPORTING":
			return "Included as original reporting of a first-hand disclosure; not independently verified unless corroboration is recorded.";
		case "EXPERT_INTERPRETATION":
			return "Included as expert interpretation; not independently verified.";
		case "VENDOR_CLAIM":
			return "Included as a vendor assertion; NOT independently verified. Inclusion does not imply verification.";
		case "INFERENCE":
			return "Included as an inference; not directly established by primary evidence.";
		case "SPECULATION":
			return "Included as speculation; insufficient evidence. Not a verified fact.";
		case "UNVERIFIED":
			return "Included as unverified information; no independent check established.";
	}
}

function buildVerificationRationale(record: ClaimVerificationRecord): string {
	const parts = [
		`Evidence classification: ${record.evidenceClassification}.`,
		`Verification status: ${record.verificationStatus} at level ${record.verificationLevel}.`,
		`Confidence: ${record.confidence.toFixed(2)}.`,
	];
	if (record.verificationMethods.length > 0) {
		parts.push(`Methods: ${record.verificationMethods.join(", ")}.`);
	}
	if (record.counterevidence.length > 0) {
		parts.push(
			`${record.counterevidence.length} piece(s) of contradictory evidence recorded.`,
		);
	}
	if (record.unresolvedUncertainties.length > 0) {
		parts.push(
			`${record.unresolvedUncertainties.length} unresolved uncertainties recorded.`,
		);
	}
	return parts.join(" ");
}

function buildTechnicalContext(
	record: ClaimVerificationRecord,
): TechnicalContext | undefined {
	const tc = record.technicalContext;
	const pc = record.productContext;
	if (!tc && !pc) return undefined;
	return {
		mechanism: tc?.technicalMechanism,
		architecture: tc?.architecturalImplications
			? sortedUnique(tc.architecturalImplications)
			: undefined,
		capabilities: tc?.capabilities
			? sortedUnique(tc.capabilities)
			: undefined,
		limitations: tc?.knownLimitations
			? sortedUnique(tc.knownLimitations)
			: undefined,
		productVersion: pc?.version,
		releaseMaturity: pc?.releaseMaturity,
		compatibility: tc?.compatibility
			? sortedUnique(tc.compatibility)
			: undefined,
		agenticImplications: tc?.agenticImplications
			? sortedUnique(tc.agenticImplications)
			: undefined,
		securityAssumptions: tc?.securityAssumptions
			? sortedUnique(tc.securityAssumptions)
			: undefined,
		trustBoundaries: tc?.trustBoundaries
			? sortedUnique(tc.trustBoundaries)
			: undefined,
		implementationStatus: tc?.implementationStatus,
	};
}

function buildMethodologicalContext(
	record: ClaimVerificationRecord,
): MethodologicalContext | undefined {
	const sc = record.scientificContext;
	const details = record.verificationDetails;
	if (!sc && !details) return undefined;
	return {
		studyDesign: sc?.studyDesign,
		methodology: sc?.methodology,
		dataset: sc?.dataset,
		evaluationConditions: sc?.evaluationConditions,
		benchmarkConditions: sc?.benchmarkMethodology,
		reproducibility: sc?.reproducibility,
		alternativeExplanations: record.alternativeExplanations
			.map((a) => a.explanation)
			.sort(),
		counterevidence: sc?.contradictoryFindings
			? sortedUnique(sc.contradictoryFindings)
			: undefined,
	};
}

function buildStrategicContext(
	record: ClaimVerificationRecord,
): StrategicContext | undefined {
	const rc = record.researchContext;
	const ec = record.enterpriseContext;
	if (!rc && !ec) return undefined;
	return {
		researchPurpose: rc?.researchPurpose,
		sampleSize: rc?.sampleSize,
		sampleComposition: rc?.sampleComposition,
		geographicScope: rc?.geographicScope,
		industryCoverage: rc?.industryCoverage,
		researchPeriod: rc?.researchPeriod,
		measuredOutcome: ec?.measuredOutcome,
		baseline: ec?.baseline,
		statisticalUncertainty: rc?.statisticalUncertainty,
		fundingSources: rc?.fundingSources
			? sortedUnique(rc.fundingSources)
			: undefined,
		conflictsOfInterest: rc?.conflictsOfInterest
			? sortedUnique(rc.conflictsOfInterest)
			: undefined,
		causalClaimType: rc?.causalClaimType,
		generalizability: rc?.generalizabilityAssessment,
		enterpriseImplications: ec?.enterpriseImplications
			? sortedUnique(ec.enterpriseImplications)
			: undefined,
		productivityConsequences: ec?.productivityConsequences
			? sortedUnique(ec.productivityConsequences)
			: undefined,
		economicImpact: ec?.economicImpact
			? sortedUnique(ec.economicImpact)
			: undefined,
		workforceImplications: ec?.workforceImplications
			? sortedUnique(ec.workforceImplications)
			: undefined,
		governanceImplications: ec?.governanceImplications
			? sortedUnique(ec.governanceImplications)
			: undefined,
		competingExplanations: record.alternativeExplanations
			.map((a) => a.explanation)
			.sort(),
	};
}

function buildSourceProvenance(
	record: ClaimVerificationRecord,
): ClaimSourceProvenance {
	return {
		sourceId: record.originalSource.sourceId,
		url: record.originalSource.url,
		title: record.originalSource.title,
		publicationTimestamp: record.originalSource.publicationTimestamp,
		firstDisclosureTimestamp:
			record.originalSource.firstDisclosureTimestamp,
		retrievedAt: record.temporalVerification.retrievalTimestamp,
		verificationTimestamp: record.verifiedAt,
		verifiedBy: record.verifiedBy,
	};
}

/**
 * Consolidate verification records into dossier claim records. The evidence
 * classification, verification status, confidence and provenance are inherited
 * verbatim; nothing is re-classified here.
 */
export function consolidateClaims(
	candidateId: string,
	claims: ClaimVerificationRecord[],
): ConsolidatedClaim[] {
	return claims
		.slice()
		.sort((a, b) => a.id.localeCompare(b.id))
		.map((record) => {
			const corroborating = record.supportingEvidence.filter(
				(e) =>
					e.evidenceRole === "corroborating" &&
					e.sourceId !== record.originalSource.sourceId,
			);
			const independentReplication =
				record.verificationDetails?.independentReplication;
			const replicationSourceIds = independentReplication?.confirmed
				? [independentReplication.sourceId]
				: [];
			const replicationUrls = independentReplication?.confirmed
				? [independentReplication.url]
				: [];
			const established =
				corroborating.length > 0 ||
				Boolean(independentReplication?.confirmed);

			const independentCorroboration = established
				? {
						established: true,
						sourceIds: sortedUnique([
							...corroborating.map((e) => e.sourceId),
							...replicationSourceIds,
						]),
						urls: sortedUnique([
							...corroborating.map((e) => e.url),
							...replicationUrls,
						]),
						method: corroborating.some((e) =>
							e.applicableMethods.includes(
								"independent-replication",
							),
						)
							? ("independent-replication" as const)
							: undefined,
						note: "Corroboration established from independent source(s) in the verification pipeline.",
					}
				: {
						established: false,
						sourceIds: [],
						urls: [],
						note: "No independent corroboration established in the verification pipeline.",
					};

			const contradictoryEvidence: ContradictoryEvidence[] =
				record.counterevidence
					.slice()
					.sort((a, b) => a.id.localeCompare(b.id))
					.map((ce) => ({
						evidenceId: ce.id,
						sourceId: ce.sourceId,
						url: ce.evidenceReference.url,
						contradictionType: ce.contradictionType,
						description: ce.description,
						confidence: ce.confidence,
					}));

			const limitingEvidence = sortedUnique([
				...record.supportingEvidence.flatMap(
					(e) => e.limitations ?? [],
				),
				...record.counterevidence
					.filter((ce) => ce.contradictionType !== "direct")
					.map((ce) => ce.description),
			]);

			return {
				claimId: record.id,
				candidateId,
				claimStatement: record.claim,
				claimType: record.claimType,
				evidenceClassification: record.evidenceClassification,
				supportingEvidenceUrls: sortedUnique(
					record.supportingEvidence.map((e) => e.url),
				),
				independentCorroboration,
				contradictoryEvidence,
				limitingEvidence,
				technicalContext: buildTechnicalContext(record),
				methodologicalContext: buildMethodologicalContext(record),
				strategicContext: buildStrategicContext(record),
				confidence: record.confidence,
				verificationLevel: record.verificationLevel,
				verificationStatus: record.verificationStatus,
				verificationRationale: buildVerificationRationale(record),
				verificationMethods: sortedUnique(
					record.verificationMethods,
				) as VerificationMethod[],
				uncertainty: {
					unresolved: record.unresolvedUncertainties
						.slice()
						.sort((a, b) => a.id.localeCompare(b.id))
						.map((u) => ({
							type: u.type,
							uncertainty: u.uncertainty,
							impact: u.impact,
							blocking: u.blockingVerification,
						})),
					assumptions: sortedUnique(
						record.assumptions.map((a) => a.assumption),
					),
					falsificationCriteria: sortedUnique(
						record.falsificationCriteria.map((f) => f.criterion),
					),
				},
				sourceProvenance: buildSourceProvenance(record),
				inclusionNote: buildInclusionNote(record),
			};
		});
}

// ============================================================================
// Sources & accessibility
// ============================================================================

function resolveSourceIds(input: CandidateConsolidationInput): string[] {
	return sortedUnique([
		...(input.discovery?.sourceId ? [input.discovery.sourceId] : []),
		...input.candidate.sourceIds,
	]);
}

function buildSourceReferences(
	input: CandidateConsolidationInput,
	context: ConsolidationContext,
): CanonicalSourceReference[] {
	const { candidate, discovery } = input;
	return resolveSourceIds(input).map((sourceId) => {
		const registryEntry = context.sourceRegistry.get(sourceId);
		const url =
			registryEntry?.url ??
			(discovery?.sourceId === sourceId ? discovery.url : undefined);
		if (!url) {
			throw new ConsolidationError(
				candidate.id,
				`No canonical URL available for source "${sourceId}" — source registry entry missing and discovery URL unavailable.`,
			);
		}
		const record = input.sourceRecords?.find(
			(r) => r.sourceId === sourceId,
		);
		const discoveryIds = sortedUnique([
			...(candidate.discoveryId ? [candidate.discoveryId] : []),
			...(discovery?.id ? [discovery.id] : []),
		]);
		return {
			sourceId,
			canonicalUrl: url,
			title: registryEntry?.title,
			tier: registryEntry?.tier,
			discoveryIds,
			retrievalStatus: record?.status ?? "NOT_CHECKED",
			accessedAt: record?.checkedAt,
		};
	});
}

function buildSourceAccessibility(
	input: CandidateConsolidationInput,
	context: ConsolidationContext,
): SourceAccessibilityRecord[] {
	const { candidate, discovery } = input;
	return resolveSourceIds(input).map((sourceId) => {
		const override = input.accessibilityOverrides?.find(
			(o) => o.sourceId === sourceId,
		);
		if (override) return override;
		const registryEntry = context.sourceRegistry.get(sourceId);
		const url =
			registryEntry?.url ??
			(discovery?.sourceId === sourceId ? discovery.url : "");
		const record = input.sourceRecords?.find(
			(r) => r.sourceId === sourceId,
		);
		const limitations = (record?.accessLimitations ?? []).map((l) => ({
			...l,
		}));
		return {
			sourceId,
			canonicalUrl: url,
			retrievalStatus: record?.status ?? "NOT_CHECKED",
			accessible: record
				? record.status === "CHECKED_FOUND" ||
					record.status === "CHECKED_NONE"
				: false,
			accessMethod: record?.accessMethod,
			limitations,
			lastCheckedAt: record?.checkedAt,
			note: record
				? undefined
				: "No discovery ledger monitoring record available for this source; accessibility unverified.",
		};
	});
}

// ============================================================================
// Previous coverage / historical continuity
// ============================================================================

const HISTORICAL_LOOKBACK_DAYS = 7;

function derivePreviousCoverage(
	candidate: CandidateNewsItem,
	context: ConsolidationContext,
): PreviousCoverageReference[] {
	const result: PreviousCoverageReference[] = [];
	const previousDates = getPreviousEditionDates(
		context.editionDate,
		HISTORICAL_LOOKBACK_DAYS,
	);

	for (const date of previousDates) {
		const available =
			context.previousEditions.availableEditionDates.has(date);
		if (!available) {
			// Missing historical publications remain an explicit uncertainty.
			result.push({
				editionDate: date,
				editionId: `edition_${date}`,
				relationship: "related-topic",
				available: false,
				note: "Earlier edition not available; absence of previous coverage cannot be established.",
			});
			continue;
		}
		const matches = context.previousEditions.candidates.filter(
			(c) => c.editionDate === date && candidateOverlaps(candidate, c),
		);
		for (const match of matches) {
			result.push({
				editionDate: date,
				editionId: `edition_${date}`,
				candidateId: match.candidateId,
				publicationId: match.publicationId,
				relationship: "same-development",
				available: true,
				evidenceUrl: match.evidenceUrl,
				note: "Historical overlap detected in an available earlier edition.",
			});
		}
	}
	return result;
}

// ============================================================================
// Uncertainty collection
// ============================================================================

function collectUncertainty(
	claims: ConsolidatedClaim[],
	temporalEligibility: TemporalEligibility,
	previousCoverage: PreviousCoverageReference[],
): { unresolvedQuestions: string[]; evidenceGaps: string[] } {
	const unresolvedQuestions = new Set<string>();
	const evidenceGaps = new Set<string>();

	if (claims.length === 0) {
		evidenceGaps.add(
			"No verified claims associated with this candidate; factual consolidation is incomplete.",
		);
	}

	if (temporalEligibility.status === "TIME_UNVERIFIED") {
		unresolvedQuestions.add(
			"Publication/disclosure time could not be verified; temporal eligibility is TIME_UNVERIFIED.",
		);
	}
	if (temporalEligibility.noveltyClassification.isRepostOrSummary) {
		unresolvedQuestions.add(
			"Item appears to be a repost/summary; the original disclosure timing must be established.",
		);
	}

	for (const claim of claims) {
		for (const u of claim.uncertainty.unresolved) {
			if (u.blocking) {
				evidenceGaps.add(`[${claim.claimId}] ${u.uncertainty}`);
			} else {
				unresolvedQuestions.add(`[${claim.claimId}] ${u.uncertainty}`);
			}
		}
		if (claim.contradictoryEvidence.length > 0) {
			unresolvedQuestions.add(
				`[${claim.claimId}] Contradictory evidence requires resolution.`,
			);
		}
		if (
			claim.evidenceClassification === "VENDOR_CLAIM" ||
			claim.evidenceClassification === "UNVERIFIED" ||
			claim.evidenceClassification === "SPECULATION"
		) {
			evidenceGaps.add(
				`[${claim.claimId}] ${claim.evidenceClassification} requires independent verification before factual use.`,
			);
		}
	}

	for (const pc of previousCoverage) {
		if (!pc.available) {
			unresolvedQuestions.add(
				`Earlier edition ${pc.editionDate} unavailable; previous coverage cannot be ruled out.`,
			);
		}
	}

	return {
		unresolvedQuestions: [...unresolvedQuestions].sort(),
		evidenceGaps: [...evidenceGaps].sort(),
	};
}

// ============================================================================
// Entity derivation
// ============================================================================

function deriveFactualHeadline(candidate: CandidateNewsItem): string {
	return candidate.title.trim().replace(/\s+/g, " ");
}

function deriveExactStatement(
	candidate: CandidateNewsItem,
	claims: ConsolidatedClaim[],
): string {
	const summary = candidate.summary.trim().replace(/\s+/g, " ");
	if (claims.length === 0) return summary;
	const primary = claims
		.slice()
		.sort(
			(a, b) =>
				(VERIFICATION_LEVEL_ORDER[b.verificationLevel] ?? 0) -
				(VERIFICATION_LEVEL_ORDER[a.verificationLevel] ?? 0),
		)[0];
	return `${summary} Material change: ${primary.claimStatement}`;
}

function deriveDiscoveryRings(
	candidate: CandidateNewsItem,
	context: ConsolidationContext,
): DiscoveryRing[] {
	const distribution = candidate.ringClassificationDistribution ?? {};
	const rings = (Object.entries(distribution) as [string, number][])
		.filter(([, count]) => count > 0)
		.map(([ring]) => Number(ring) as DiscoveryRing)
		.sort((a, b) => a - b);
	if (rings.length > 0) return rings;

	// Fallback: source registry ring affinity (never inferred from tier/reputation).
	const fromRegistry = candidate.sourceIds
		.flatMap((id) => context.sourceRegistry.get(id)?.ringAffinity ?? [])
		.filter(
			(ring): ring is DiscoveryRing =>
				ring === 1 || ring === 2 || ring === 3,
		);
	if (fromRegistry.length > 0) {
		return [...new Set(fromRegistry)].sort((a, b) => a - b);
	}

	throw new ConsolidationError(
		candidate.id,
		"Candidate has no discovery ring classification; cannot consolidate without an evidentiary ring.",
	);
}

// ============================================================================
// Candidate assembly
// ============================================================================

/**
 * Build a canonical candidate record without editorial readiness indicators.
 * Indicators require the full edition candidate set and are attached by
 * {@link buildCanonicalCandidate} or {@link buildDossier}.
 */
export function buildCandidateCore(
	input: CandidateConsolidationInput,
	context: ConsolidationContext,
): CanonicalCandidateCore {
	const { candidate } = input;
	const now = nowOr(context);

	const temporalEligibility = deriveTemporalEligibility(input, context, now);
	const timestamps = buildCandidateTimestamps(input, now);
	const claims = consolidateClaims(candidate.id, input.claims);
	const sources = buildSourceReferences(input, context);
	const sourceAccessibility = buildSourceAccessibility(input, context);
	const previousCoverage =
		input.previousCoverage ?? derivePreviousCoverage(candidate, context);
	const { unresolvedQuestions, evidenceGaps } = collectUncertainty(
		claims,
		temporalEligibility,
		previousCoverage,
	);

	const factualHeadline = deriveFactualHeadline(candidate);
	const exactStatement = deriveExactStatement(candidate, claims);

	const hints = input.entityHints ?? {};
	const organizations = sortedUnique(hints.organizations ?? []);
	const products = sortedUnique(hints.products ?? []);
	const technologies = sortedUnique(hints.technologies ?? []);
	const researchProjects = sortedUnique(hints.researchProjects ?? []);

	if (
		organizations.length === 0 &&
		products.length === 0 &&
		technologies.length === 0
	) {
		unresolvedQuestions.push(
			"Entity involvement (organizations/products/technologies) not established from available metadata.",
		);
	}

	const researchDomains = sortedUnique(
		candidate.researchDomains?.filter((d) =>
			context.taxonomyDomains.has(d),
		) ?? [],
	);
	if (researchDomains.length === 0) {
		unresolvedQuestions.push(
			"No research domain from the taxonomy could be established for this candidate.",
		);
	}

	return {
		candidateId: candidate.id,
		editionId: `edition_${context.editionDate}`,
		editionDate: context.editionDate,
		factualHeadline,
		exactStatement,
		researchDomains,
		subdomainTags: sortedUnique(candidate.subdomainTags ?? []),
		discoveryRings: deriveDiscoveryRings(candidate, context),
		organizations,
		products,
		technologies,
		researchProjects,
		sources,
		timestamps,
		temporalEligibility,
		previousCoverage,
		sourceAccessibility,
		claims,
		unresolvedQuestions: [...new Set(unresolvedQuestions)].sort(),
		evidenceGaps: [...new Set(evidenceGaps)].sort(),
		processingStatus: "consolidated",
		audit: {
			discoveredAt: input.discovery?.discoveredAt,
			retrievedAt: timestamps.retrievalTimestamp,
			noveltyClassifiedAt: temporalEligibility.derivedAt,
			claimsVerifiedAt: claims[0]?.sourceProvenance.verificationTimestamp,
			consolidatedAt: now,
			consolidatedBy: context.generatedBy,
			revision: 1,
		},
		provenance: {
			discoveryIds: sortedUnique([
				...(candidate.discoveryId ? [candidate.discoveryId] : []),
				...(input.discovery?.id ? [input.discovery.id] : []),
			]),
			candidateStableId: candidate.id,
			pipeline: [
				"source-discovery",
				"retrieval",
				"candidate-identification",
				"temporal-classification",
				"claim-verification",
				"canonical-fact-dossier",
			],
			consumedFrom: [
				"candidate-news",
				"discovery-ledger",
				"novelty-classification",
				"evidence-verification",
				"source-registry",
			],
		},
	};
}

/**
 * Build a canonical candidate with editorial readiness indicators computed
 * against the full edition candidate set.
 */
export function buildCanonicalCandidate(
	input: CandidateConsolidationInput,
	context: ConsolidationContext,
	editionCandidates: CanonicalCandidateCore[] = [],
): CanonicalCandidate {
	const core = buildCandidateCore(input, context);
	const editorialReadiness = computeEditorialReadinessIndicators(core, {
		editionCandidates: editionCandidates as CanonicalCandidate[],
		editionDate: context.editionDate,
	});
	return { ...core, editorialReadiness };
}

// ============================================================================
// Edition-level assembly
// ============================================================================

function buildEditionSummary(candidates: CanonicalCandidate[]): EditionSummary {
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

		const claimTypes = new Set(candidate.claims.map((c) => c.claimType));
		if ([...claimTypes].some((t) => strategicTypes.has(t)))
			strategicResearchCandidates++;
		if ([...claimTypes].some((t) => technicalTypes.has(t)))
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

function mapUncertaintyType(type: string): EditionUncertainty["type"] {
	const valid: EditionUncertainty["type"][] = [
		"evidence-gap",
		"methodological",
		"definitional",
		"temporal",
		"scope",
		"generalizability",
		"historical-continuity",
		"access-limitation",
	];
	return valid.includes(type as EditionUncertainty["type"])
		? (type as EditionUncertainty["type"])
		: "evidence-gap";
}

function buildUncertaintyRegister(
	candidates: CanonicalCandidate[],
): EditionUncertainty[] {
	const register: EditionUncertainty[] = [];
	for (const candidate of candidates) {
		for (const gap of candidate.evidenceGaps) {
			register.push({
				uncertaintyId: deriveStableUncertaintyId([
					candidate.candidateId,
					"gap",
					gap,
				]),
				candidateId: candidate.candidateId,
				type: "evidence-gap",
				description: gap,
				impact: "high",
				blocking: true,
				researchNeeded:
					"Resolve the evidence gap before downstream editorial use.",
			});
		}
		for (const question of candidate.unresolvedQuestions) {
			register.push({
				uncertaintyId: deriveStableUncertaintyId([
					candidate.candidateId,
					"question",
					question,
				]),
				candidateId: candidate.candidateId,
				type: "temporal",
				description: question,
				impact: "medium",
				blocking: false,
				researchNeeded:
					"Investigate and resolve; missing historical publications must not be read as proof of no prior coverage.",
			});
		}
		for (const claim of candidate.claims) {
			for (const u of claim.uncertainty.unresolved) {
				register.push({
					uncertaintyId: deriveStableUncertaintyId([
						candidate.candidateId,
						claim.claimId,
						u.uncertainty,
					]),
					candidateId: candidate.candidateId,
					claimId: claim.claimId,
					type: mapUncertaintyType(u.type),
					description: u.uncertainty,
					impact: u.impact,
					blocking: u.blocking,
					researchNeeded:
						"See the originating claim verification record for research requirements.",
				});
			}
		}
	}
	return register.sort((a, b) =>
		a.uncertaintyId.localeCompare(b.uncertaintyId),
	);
}

function buildHistoricalContinuity(
	candidate: CanonicalCandidate,
	context: ConsolidationContext,
): HistoricalContinuityRecord {
	const checkedEditionDates = getPreviousEditionDates(
		context.editionDate,
		HISTORICAL_LOOKBACK_DAYS,
	);
	const missingEditions = checkedEditionDates.filter(
		(d) => !context.previousEditions.availableEditionDates.has(d),
	);
	return {
		candidateId: candidate.candidateId,
		checkedEditionDates,
		missingEditions,
		note:
			missingEditions.length > 0
				? `${missingEditions.length} earlier edition(s) unavailable; absence of previous coverage cannot be established.`
				: "All checked earlier editions are available.",
	};
}

function buildProcessingAudit(params: {
	startedAt: string;
	completedAt: string;
	steps: ProcessingStep[];
	completedCandidateIds: string[];
	failedCandidateIds: string[];
	skippedCandidateIds: string[];
	inferenceUsed: boolean;
	inferenceNote?: string;
}): ProcessingAudit {
	return {
		startedAt: params.startedAt,
		completedAt: params.completedAt,
		durationMs: Math.max(
			0,
			new Date(params.completedAt).getTime() -
				new Date(params.startedAt).getTime(),
		),
		steps: params.steps,
		completedCandidateIds: params.completedCandidateIds,
		failedCandidateIds: params.failedCandidateIds,
		skippedCandidateIds: params.skippedCandidateIds,
		inferenceUsed: params.inferenceUsed,
		inferenceNote: params.inferenceNote,
	};
}

// ============================================================================
// Dossier build
// ============================================================================

/**
 * Build the canonical fact dossier for one edition.
 *
 * Per-candidate failures are isolated: the failing candidate is recorded in
 * `processingAudit.failedCandidateIds` and the dossier is still produced with
 * status `partial` (or `failed` when nothing could be consolidated). This makes
 * processing resumable after failures.
 */
export function buildDossier(
	editionDate: string,
	inputs: CandidateConsolidationInput[],
	context: ConsolidationContext,
): CanonicalFactDossier {
	const startedAt = nowOr(context);
	const steps: ProcessingStep[] = [];
	const completedCandidateIds: string[] = [];
	const failedCandidateIds: string[] = [];
	const skippedCandidateIds: string[] = [];
	const cores: CanonicalCandidateCore[] = [];

	steps.push({
		step: "candidate-consolidation",
		status: "running",
		startedAt,
		inputCount: inputs.length,
	});

	for (const input of inputs) {
		try {
			cores.push(buildCandidateCore(input, context));
			completedCandidateIds.push(input.candidate.id);
		} catch (error) {
			failedCandidateIds.push(input.candidate.id);
			steps.push({
				step: `consolidate:${input.candidate.id}`,
				status: "failed",
				completedAt: nowOr(context),
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	steps[0] = {
		...steps[0],
		status: failedCandidateIds.length > 0 ? "failed" : "completed",
		completedAt: nowOr(context),
		outputCount: cores.length,
	};

	// Indicators require the full edition candidate set for overlap detection.
	steps.push({
		step: "editorial-readiness-indicators",
		status: "running",
		startedAt,
	});
	const candidates: CanonicalCandidate[] = cores
		.map((core) => ({
			...core,
			editorialReadiness: computeEditorialReadinessIndicators(core, {
				editionCandidates: cores,
				editionDate,
			}),
		}))
		.sort((a, b) => a.candidateId.localeCompare(b.candidateId));
	steps[1] = {
		...steps[1],
		status: "completed",
		completedAt: nowOr(context),
		outputCount: candidates.length,
	};

	steps.push({
		step: "edition-summary",
		status: "completed",
		completedAt: nowOr(context),
	});
	steps.push({
		step: "uncertainty-register",
		status: "completed",
		completedAt: nowOr(context),
	});
	steps.push({
		step: "historical-continuity",
		status: "completed",
		completedAt: nowOr(context),
	});

	const editionSummary = buildEditionSummary(candidates);
	const uncertaintyRegister = buildUncertaintyRegister(candidates);
	const historicalContinuity = candidates.map((c) =>
		buildHistoricalContinuity(c, context),
	);

	const status: DossierStatus =
		failedCandidateIds.length > 0
			? candidates.length > 0
				? "partial"
				: "failed"
			: "ready-for-omission-review";

	const completedAt = nowOr(context);
	const processingAudit = buildProcessingAudit({
		startedAt,
		completedAt,
		steps,
		completedCandidateIds,
		failedCandidateIds,
		skippedCandidateIds,
		inferenceUsed: false,
		inferenceNote:
			"No model inference was required for deterministic consolidation.",
	});

	const dossier: CanonicalFactDossier = {
		schemaVersion: FACT_DOSSIER_SCHEMA_VERSION,
		dossierId: deriveDossierId(editionDate),
		editionId: `edition_${editionDate}`,
		editionDate,
		editionWindow: {
			editionDate: context.editionWindow.editionDate,
			start: context.editionWindow.start,
			end: context.editionWindow.end,
			timezone: "Europe/Amsterdam",
			durationHours: context.editionWindow.durationHours,
		},
		status,
		createdAt: startedAt,
		updatedAt: completedAt,
		generatedBy: context.generatedBy,
		candidates,
		editionSummary,
		uncertaintyRegister,
		historicalContinuity,
		processingAudit,
		contentHash: "",
	};
	dossier.contentHash = computeDossierContentHash(dossier);
	return dossier;
}
