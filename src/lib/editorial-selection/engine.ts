/**
 * Editorial Selection — Engine
 *
 * Executes the editorial ranking and selection stage for one edition:
 *
 *   1. Consume the canonical fact dossier (authoritative factual foundation).
 *   2. Consume the omission review report and historical regression report.
 *   3. Evaluate eligibility using the authoritative upstream gates.
 *   4. Assess all eight editorial dimensions and compute materiality.
 *   5. Detect merge groups and apply the explicit decision model.
 *   6. Order the selected stories and identify relationships.
 *   7. Perform the concentration and blind-spot review.
 *   8. Optionally run a model-assisted internal consistency check.
 *   9. Produce and persist the editorial selection manifest.
 *
 * The stage never re-implements source retrieval, temporal classification,
 * evidence verification, omission detection or historical regression. It does
 * not generate articles or publish content.
 */

import type {
	CanonicalCandidate,
	CanonicalFactDossier,
} from "../fact-dossier/schema.js";
import type {
	HistoricalRegressionReport,
	HistoricalRelationship,
} from "../historical-regression/schema.js";
import type { OmissionReviewReport } from "../omission-review/types.js";
import {
	buildWeightingAssumptions,
	DEFAULT_EDITORIAL_SELECTION_CONFIG,
	type EditorialSelectionConfig,
} from "./config.js";
import {
	buildCandidateAssessment,
	collectUncertainty,
	decideCandidate,
	assessMateriality,
	type DecisionInfo,
} from "./decisions.js";
import { computeMateriality } from "./dimensions.js";
import {
	evaluateEligibilityForEdition,
	type EligibilityContext,
} from "./eligibility.js";
import { detectMergeGroups, identifyRelationships } from "./merging.js";
import { orderStories } from "./ordering.js";
import { performConcentrationReview } from "./review.js";
import type { EditorialSemanticProvider } from "./semantic.js";
import {
	EDITORIAL_SELECTION_SCHEMA_VERSION,
	type ConcentrationReview,
	type EditorialCandidateAssessment,
	type EditorialRelationship,
	type EditorialSelectionManifest,
	type EditorialStory,
} from "./schema.js";
import {
	computeManifestContentHash,
	createEditorialSelectionStore,
	deriveManifestId,
	type EditorialSelectionStore,
	type SaveManifestResult,
} from "./store.js";

export interface EditorialSelectionInput {
	/** Edition date in YYYY-MM-DD format. */
	editionDate: string;
	/** Current canonical fact dossier (authoritative factual foundation). */
	canonicalDossier: CanonicalFactDossier;
	/** Omission review report for the edition, when available. */
	omissionReview?: OmissionReviewReport | null;
	/** Historical regression report for the edition, when available. */
	historicalRegression?: HistoricalRegressionReport | null;
	/** Configuration overrides (weights, thresholds). */
	config?: Partial<EditorialSelectionConfig>;
	/** Optional model-assisted internal consistency check provider. */
	semanticProvider?: EditorialSemanticProvider;
	/** Local data root (default 'data'). */
	dataDir?: string;
	/** Deterministic timestamp override (tests, reproducible builds). */
	now?: string;
	/** Actor identifier recorded in the manifest. */
	generatedBy?: string;
	/** Persist the manifest (default true). */
	persist?: boolean;
	/** Injectable store (tests). */
	store?: EditorialSelectionStore;
}

export interface EditorialSelectionResult {
	manifest: EditorialSelectionManifest;
	assessments: EditorialCandidateAssessment[];
	stories: EditorialStory[];
	relationships: EditorialRelationship[];
	concentrationReview: ConcentrationReview;
	saveResult: SaveManifestResult | null;
}

function buildClaimTypeMap(
	dossier: CanonicalFactDossier,
): Map<string, string[]> {
	const map = new Map<string, string[]>();
	for (const candidate of dossier.candidates) {
		map.set(
			candidate.candidateId,
			candidate.claims.map((claim) => claim.claimType),
		);
	}
	return map;
}

function buildHistoricalRelationshipMap(
	report: HistoricalRegressionReport | null | undefined,
): Map<string, HistoricalRelationship> {
	const map = new Map<string, HistoricalRelationship>();
	if (!report) return map;
	for (const relationship of report.relationships) {
		map.set(relationship.candidateId, relationship);
	}
	return map;
}

function buildOmissionReviewReference(
	report: OmissionReviewReport | null | undefined,
) {
	if (!report) {
		return {
			criticalOmissions: 0,
			materialOmissions: 0,
			unresolvedRepairs: 0,
			referenced: false,
		};
	}
	const criticalOmissions = report.newlyDiscoveredCandidates.filter(
		(candidate) => candidate.omissionClassification === "CRITICAL_OMISSION",
	).length;
	const materialOmissions = report.newlyDiscoveredCandidates.filter(
		(candidate) => candidate.omissionClassification === "MATERIAL_OMISSION",
	).length;
	const unresolvedRepairs =
		report.criticalAndMaterialOmissionsRepaired.filter(
			(repair) => repair.repairAction === "UNRESOLVED",
		).length;
	return {
		reportId: report.context.executionId
			? `omission-${report.context.executionId}`
			: undefined,
		executionId: report.context.executionId,
		version: report.version,
		executedAt:
			report.executionTimestamps?.reportFinalizedAt ??
			report.context.startedAt,
		criticalOmissions,
		materialOmissions,
		unresolvedRepairs,
		referenced: true,
	};
}

function buildHistoricalRegressionReference(
	report: HistoricalRegressionReport | null | undefined,
) {
	if (!report) {
		return { relationshipsReferenced: 0, referenced: false };
	}
	return {
		reportId: report.reportId,
		contentHash: report.contentHash,
		finalStatus: report.finalStatus,
		relationshipsReferenced: report.relationships.length,
		referenced: true,
	};
}

/**
 * Execute the editorial selection stage for one edition.
 */
async function runEditorialSelection(
	input: EditorialSelectionInput,
): Promise<EditorialSelectionResult> {
	const dataDir = input.dataDir ?? "data";
	const now = input.now ?? new Date().toISOString();
	const generatedBy = input.generatedBy ?? "editorial-selection-engine";
	const config: EditorialSelectionConfig = {
		...DEFAULT_EDITORIAL_SELECTION_CONFIG,
		...input.config,
		weights: {
			...DEFAULT_EDITORIAL_SELECTION_CONFIG.weights,
			...input.config?.weights,
		},
	};

	const dossier = input.canonicalDossier;
	const omissionReview = input.omissionReview ?? null;
	const historicalRegression = input.historicalRegression ?? null;
	const historicalRelationships =
		buildHistoricalRelationshipMap(historicalRegression);

	// --- 1. Eligibility -----------------------------------------------------
	const eligibilityContext: EligibilityContext = {
		allCandidates: dossier.candidates,
		historicalRelationships,
		omissionReview,
	};
	const { eligibility } = evaluateEligibilityForEdition(
		dossier.candidates,
		eligibilityContext,
	);

	// --- 2. Dimensions + materiality (phase 1) -------------------------------
	const materialityByCandidate = new Map<
		string,
		ReturnType<typeof assessMateriality>
	>();
	const potentialMaterialityByCandidate = new Map<string, number>();
	for (const candidate of dossier.candidates) {
		const candidateEligibility = eligibility.get(candidate.candidateId)!;
		const materiality = assessMateriality(
			candidate,
			candidateEligibility,
			historicalRelationships.get(candidate.candidateId),
			config,
		);
		materialityByCandidate.set(candidate.candidateId, materiality);

		// Potential materiality excludes the dimension blocked by an unresolved
		// temporal or evidence failure, so genuine consequence is not masked.
		const exclude =
			candidateEligibility.temporalStatus === "TIME_UNVERIFIED"
				? ("material-novelty" as const)
				: candidateEligibility.evidenceSufficiency === "WEAK"
					? ("evidence-strength" as const)
					: undefined;
		const potential = exclude
			? computeMateriality(materiality.dimensions, config, exclude).score
			: materiality.score;
		potentialMaterialityByCandidate.set(candidate.candidateId, potential);
	}

	// --- 3. Merge detection (needs materiality) ------------------------------
	const materialityScores = new Map<string, number>();
	for (const [candidateId, materiality] of materialityByCandidate) {
		materialityScores.set(candidateId, materiality.score);
	}
	const mergeGroups = detectMergeGroups(
		dossier.candidates,
		materialityScores,
	);

	// --- 4. Decisions + assessments (phase 2) -------------------------------
	// Merge primaries are decided first so merged members can be marked MERGED
	// only when their primary is actually selected. A merged member whose primary
	// is not selected falls through to its own gate and materiality decision.
	const decisionInfoByCandidate = new Map<string, DecisionInfo>();
	const mergedMemberIds = new Set(mergeGroups.keys());

	const decideFor = (
		candidate: CanonicalCandidate,
		selectedIds: Set<string>,
	): DecisionInfo =>
		decideCandidate(
			candidate,
			eligibility.get(candidate.candidateId)!,
			historicalRelationships.get(candidate.candidateId),
			materialityByCandidate.get(candidate.candidateId)!.score,
			potentialMaterialityByCandidate.get(candidate.candidateId) ??
				materialityByCandidate.get(candidate.candidateId)!.score,
			mergeGroups,
			selectedIds,
			config,
		);

	for (const candidate of dossier.candidates) {
		if (mergedMemberIds.has(candidate.candidateId)) continue;
		decisionInfoByCandidate.set(
			candidate.candidateId,
			decideFor(candidate, new Set()),
		);
	}

	const selectedIds = new Set(
		[...decisionInfoByCandidate.entries()]
			.filter(
				([, info]) =>
					info.decision === "SELECTED" ||
					info.decision === "CATCH_UP_SELECTED",
			)
			.map(([id]) => id),
	);

	for (const candidate of dossier.candidates) {
		if (!mergedMemberIds.has(candidate.candidateId)) continue;
		decisionInfoByCandidate.set(
			candidate.candidateId,
			decideFor(candidate, selectedIds),
		);
	}

	const assessments: EditorialCandidateAssessment[] = [];
	for (const candidate of dossier.candidates) {
		const candidateEligibility = eligibility.get(candidate.candidateId)!;
		const materiality = materialityByCandidate.get(candidate.candidateId)!;
		const decisionInfo = decisionInfoByCandidate.get(
			candidate.candidateId,
		)!;
		const uncertainty = collectUncertainty(
			candidate,
			candidateEligibility,
			historicalRelationships.get(candidate.candidateId),
		);
		assessments.push(
			buildCandidateAssessment(
				candidate,
				candidateEligibility,
				materiality,
				decisionInfo,
				mergeGroups,
				uncertainty,
				config,
			),
		);
	}

	// Deterministic candidate ordering for the manifest.
	assessments.sort((a, b) => a.candidateId.localeCompare(b.candidateId));

	// --- 5. Ordering --------------------------------------------------------
	const preliminaryRelationships = identifyRelationships(
		assessments,
		[],
		historicalRelationships,
	);
	const { stories } = orderStories(
		assessments,
		config,
		preliminaryRelationships,
		mergeGroups,
	);

	// --- 6. Relationships between selected stories --------------------------
	const relationships = identifyRelationships(
		assessments,
		stories,
		historicalRelationships,
	);

	// --- 7. Concentration and blind-spot review ------------------------------
	let modelFindings: string[] = [];
	let inferenceUsed = false;
	let inferenceNote: string | undefined;

	if (input.semanticProvider) {
		try {
			const outcome = await input.semanticProvider.review({
				editionDate: input.editionDate,
				assessments,
				stories,
			});
			modelFindings = [
				...outcome.findings,
				...outcome.tradeOffs.map((entry) => `Trade-off: ${entry}`),
				...outcome.interdisciplinaryObservations.map(
					(entry) => `Interdisciplinary: ${entry}`,
				),
			];
			inferenceUsed = true;
			inferenceNote =
				`Model-assisted internal consistency check via ${outcome.provider ?? "unknown provider"}` +
				` (${outcome.model ?? "unknown model"}). Same-model review is not independent external validation.`;
		} catch (error) {
			inferenceNote =
				`Model-assisted review unavailable: ${error instanceof Error ? error.message : String(error)}. ` +
				"Deterministic findings were preserved.";
		}
	}

	const concentrationReview = performConcentrationReview({
		assessments,
		stories,
		config,
		omissionReview,
		now,
		modelFindings,
		claimTypesByCandidate: buildClaimTypeMap(dossier),
	});

	// --- 8. Manifest --------------------------------------------------------
	const caveats = buildCaveats(
		dossier,
		omissionReview,
		historicalRegression,
		assessments,
	);
	const unresolvedIssues = buildUnresolvedIssues(
		assessments,
		omissionReview,
		historicalRegression,
	);
	const readinessStatus = determineReadiness(
		assessments,
		unresolvedIssues,
		concentrationReview,
	);

	const manifestWithoutHash: EditorialSelectionManifest = {
		schemaVersion: EDITORIAL_SELECTION_SCHEMA_VERSION,
		manifestId: "",
		editionId: `edition_${input.editionDate}`,
		editionDate: input.editionDate,
		editionWindow: {
			editionDate: dossier.editionWindow.editionDate,
			start: dossier.editionWindow.start,
			end: dossier.editionWindow.end,
			timezone: dossier.editionWindow.timezone,
			durationHours: dossier.editionWindow.durationHours,
		},
		generatedAt: now,
		generatedBy,
		inputDossier: {
			dossierId: dossier.dossierId,
			contentHash: dossier.contentHash,
			editionDate: dossier.editionDate,
			candidateCount: dossier.candidates.length,
		},
		omissionReview: buildOmissionReviewReference(omissionReview),
		historicalRegression:
			buildHistoricalRegressionReference(historicalRegression),
		candidates: assessments,
		stories,
		relationships,
		concentrationReview,
		caveats,
		unresolvedIssues,
		readinessStatus,
		inferenceUsed,
		inferenceNote,
		weightingAssumptions: buildWeightingAssumptions(config),
		contentHash: "",
	};

	const contentHash = computeManifestContentHash(
		manifestWithoutHash as EditorialSelectionManifest,
	);
	const manifest: EditorialSelectionManifest = {
		...manifestWithoutHash,
		manifestId: deriveManifestId(contentHash),
		contentHash,
	};

	// --- 9. Persist ---------------------------------------------------------
	let saveResult: SaveManifestResult | null = null;
	if (input.persist !== false) {
		const store =
			input.store ??
			createEditorialSelectionStore(`${dataDir}/editorial-selection`);
		saveResult = await store.saveManifest(manifest);
	}

	return {
		manifest,
		assessments,
		stories,
		relationships,
		concentrationReview,
		saveResult,
	};
}

function buildCaveats(
	dossier: CanonicalFactDossier,
	omissionReview: OmissionReviewReport | null,
	historicalRegression: HistoricalRegressionReport | null,
	assessments: EditorialCandidateAssessment[],
): string[] {
	const caveats: string[] = [];

	if (dossier.status !== "complete") {
		caveats.push(
			`Canonical fact dossier status is '${dossier.status}', not 'complete'.`,
		);
	}

	const candidatesWithGaps = assessments.filter(
		(assessment) => assessment.uncertainty.length > 0,
	);
	if (candidatesWithGaps.length > 0) {
		caveats.push(
			`${candidatesWithGaps.length} candidate(s) carry explicit uncertainty or evidence limitations.`,
		);
	}

	const unverifiedHistory = assessments.filter(
		(assessment) =>
			assessment.eligibility.historicalRelationship ===
			"HISTORY_UNVERIFIED",
	);
	if (unverifiedHistory.length > 0) {
		caveats.push(
			`${unverifiedHistory.length} candidate(s) have unverified historical overlap; repeated coverage cannot be ruled out.`,
		);
	}

	if (omissionReview && omissionReview.remainingCoverageGaps.length > 0) {
		caveats.push(
			`Omission review recorded ${omissionReview.remainingCoverageGaps.length} remaining coverage gap(s).`,
		);
	}

	if (
		historicalRegression &&
		historicalRegression.missingHistoricalEvidence.length > 0
	) {
		caveats.push(
			`Historical regression could not access ${historicalRegression.missingHistoricalEvidence.length} historical record(s); absence of evidence is not evidence of no prior coverage.`,
		);
	}

	return [...new Set(caveats)].sort();
}

function buildUnresolvedIssues(
	assessments: EditorialCandidateAssessment[],
	omissionReview: OmissionReviewReport | null,
	historicalRegression: HistoricalRegressionReport | null,
): string[] {
	const issues: string[] = [];

	const deferred = assessments.filter(
		(assessment) => assessment.decision === "DEFERRED_UNVERIFIED",
	);
	if (deferred.length > 0) {
		issues.push(
			`${deferred.length} consequential candidate(s) deferred pending verification: ${deferred
				.map((assessment) => assessment.candidateId)
				.join(", ")}.`,
		);
	}

	const selected = assessments.filter(
		(assessment) =>
			assessment.decision === "SELECTED" ||
			assessment.decision === "CATCH_UP_SELECTED",
	);
	if (selected.length === 0) {
		issues.push(
			"No candidate met the selection threshold; the edition has no publishable stories rather than being filled with stale or insignificant material.",
		);
	}

	const reviewRequired = assessments.filter(
		(assessment) => assessment.decision === "REVIEW_REQUIRED",
	);
	if (reviewRequired.length > 0) {
		issues.push(
			`${reviewRequired.length} consequential candidate(s) require an explicit editorial decision: ${reviewRequired
				.map((assessment) => assessment.candidateId)
				.join(", ")}.`,
		);
	}

	if (omissionReview) {
		const unresolved =
			omissionReview.criticalAndMaterialOmissionsRepaired.filter(
				(repair) => repair.repairAction === "UNRESOLVED",
			);
		if (unresolved.length > 0) {
			issues.push(
				`${unresolved.length} critical/material omission repair(s) remain unresolved.`,
			);
		}
	}

	if (historicalRegression) {
		const unresolved = historicalRegression.unresolvedQuestions ?? [];
		if (unresolved.length > 0) {
			issues.push(...unresolved.slice(0, 5));
		}
	}

	return [...new Set(issues)].sort();
}

function determineReadiness(
	assessments: EditorialCandidateAssessment[],
	unresolvedIssues: string[],
	review: ConcentrationReview,
): EditorialSelectionManifest["readinessStatus"] {
	const selected = assessments.filter(
		(assessment) =>
			assessment.decision === "SELECTED" ||
			assessment.decision === "CATCH_UP_SELECTED",
	);
	const reviewRequired = assessments.filter(
		(assessment) => assessment.decision === "REVIEW_REQUIRED",
	);

	if (reviewRequired.length > 0) {
		return "BLOCKED";
	}
	if (selected.length === 0) {
		// Quiet day: the selection is complete but empty. This is a caveat, not a
		// blocker — the edition must not be filled with stale or insignificant material.
		return "READY_WITH_CAVEATS";
	}
	if (unresolvedIssues.length > 0 || review.residualRisks.length > 0) {
		return "READY_WITH_CAVEATS";
	}
	return "READY";
}

/**
 * Validate Selection Completeness (D02_VALIDATE_SELECTION_COMPLETENESS).
 * Verifies that all selected stories have complete evidence, no blocking
 * unresolved issues, and all editorial dependencies are resolved.
 */
async function validateSelectionCompleteness(input: any): Promise<any> {
	const { manifest, dossier } = input;

	const selectedStories = manifest.stories.filter(
		(story: EditorialStory) =>
			story.decision === "SELECTED" ||
			story.decision === "CATCH_UP_SELECTED",
	);

	const issues: string[] = [];

	// Check each selected story for completeness
	for (const story of selectedStories) {
		const assessment = manifest.candidates.find(
			(c: EditorialCandidateAssessment) =>
				c.candidateId === story.candidateId,
		);
		if (!assessment) {
			issues.push(
				`Story ${story.storyId} has no corresponding assessment`,
			);
			continue;
		}

		// Check evidence sufficiency
		if (assessment.eligibility.evidenceSufficiency === "WEAK") {
			issues.push(
				`Story ${story.storyId} (candidate ${story.candidateId}) has WEAK evidence sufficiency`,
			);
		}

		// Check temporal status
		if (assessment.eligibility.temporalStatus === "TIME_UNVERIFIED") {
			issues.push(
				`Story ${story.storyId} (candidate ${story.candidateId}) has TIME_UNVERIFIED temporal status`,
			);
		}

		// Check for unresolved issues in assessment
		if (assessment.uncertainty.length > 0) {
			issues.push(
				`Story ${story.storyId} carries uncertainty: ${assessment.uncertainty.join("; ")}`,
			);
		}
	}

	// Check manifest-level unresolved issues
	if (manifest.unresolvedIssues.length > 0) {
		issues.push(
			...manifest.unresolvedIssues.map(
				(issue: string) => `Manifest issue: ${issue}`,
			),
		);
	}

	// Check concentration review residual risks
	if (manifest.concentrationReview.residualRisks.length > 0) {
		issues.push(
			...manifest.concentrationReview.residualRisks.map(
				(risk: string) => `Concentration risk: ${risk}`,
			),
		);
	}

	return {
		valid: issues.length === 0,
		issues,
		validatedAt: new Date().toISOString(),
		validatedBy: "selection-completeness-validator",
		selectedStoryCount: selectedStories.length,
	};
}

/**
 * Resolve Editorial Dependencies (D03_RESOLVE_EDITORIAL_DEPENDENCIES).
 * Applies existing contracts to resolve any remaining editorial dependencies.
 */
async function resolveEditorialDependencies(input: any): Promise<any> {
	const { manifest, omissionReview, historicalRegression } = input;

	const resolvedStories = [...manifest.stories];
	const resolvedIssues = [...manifest.unresolvedIssues];

	// Resolve DEFERRED_UNVERIFIED candidates if omission review provides evidence
	if (omissionReview) {
		for (const candidate of omissionReview.criticalAndMaterialOmissionsRepaired) {
			if (candidate.repairAction !== "UNRESOLVED") {
				// Find corresponding story and update decision
				const storyIndex = resolvedStories.findIndex(
					(s) => s.candidateId === candidate.candidateId,
				);
				if (storyIndex >= 0) {
					resolvedStories[storyIndex] = {
						...resolvedStories[storyIndex],
						decision: "SELECTED" as const,
						unresolvedIssues: [],
					};
				}
			}
		}
	}

	// Resolve historical regression dependencies
	if (
		historicalRegression &&
		historicalRegression.finalStatus === "COMPLETE"
	) {
		for (const relationship of historicalRegression.relationships) {
			if (relationship.type === "PREVIOUSLY_COVERED") {
				// Mark as catch-up if appropriate
				const storyIndex = resolvedStories.findIndex(
					(s) => s.candidateId === relationship.currentCandidateId,
				);
				if (
					storyIndex >= 0 &&
					resolvedStories[storyIndex].decision === "DEFERRED"
				) {
					resolvedStories[storyIndex] = {
						...resolvedStories[storyIndex],
						decision: "CATCH_UP_SELECTED" as const,
						unresolvedIssues: [],
					};
				}
			}
		}
	}

	// Filter resolved issues
	const remainingIssues = resolvedIssues.filter(
		(issue) =>
			!issue.includes("DEPENDENCY_RESOLVED") &&
			!issue.includes("catch-up") &&
			!issue.includes("omission repaired"),
	);

	const resolvedManifest = {
		...manifest,
		stories: resolvedStories,
		unresolvedIssues: remainingIssues,
	};

	return {
		manifest: resolvedManifest,
		resolved: true,
		resolvedAt: new Date().toISOString(),
		resolvedBy: "editorial-dependency-resolver",
		resolvedCount:
			manifest.stories.length -
			resolvedStories.filter((s) => s.unresolvedIssues.length > 0).length,
	};
}

export {
	runEditorialSelection,
	validateSelectionCompleteness,
	resolveEditorialDependencies,
};
