/**
 * Historical Regression — Engine
 *
 * Executes the rolling seven-calendar-day historical regression for one edition:
 *
 *   1. Compute the historical comparison window (preceding 7 calendar dates).
 *   2. Load and assess actually accessible previous editions.
 *   3. Compare current canonical candidates against available historical evidence.
 *   4. Classify historical relationships and detect substantive updates,
 *      repeated reporting and potential historical omissions.
 *   5. Produce a structured regression report for editorial selection.
 *
 * The stage reuses the existing novelty classifier, canonical fact dossier,
 * evidence verification records, omission review reports and discovery ledger.
 * It never re-implements novelty classification, evidence verification,
 * omission detection or editorial ranking.
 */

import crypto from "crypto";

import type { CanonicalFactDossier } from "../fact-dossier/schema.js";
import { getEditorialWindow } from "../editorial-window.js";
import {
	HISTORICAL_REGRESSION_SCHEMA_VERSION,
	HISTORICAL_REGRESSION_TIMEZONE,
	type HistoricalEditionAvailability,
	type HistoricalOmissionFinding,
	type HistoricalRegressionReport,
	type HistoricalRegressionStatus,
	type HistoricalRelationship,
	type HistoricalTraceabilityRecord,
} from "./schema.js";
import {
	getHistoricalComparisonWindow,
	type HistoricalComparisonWindow,
} from "./window.js";
import {
	loadHistoricalEdition,
	findPublicationIdForCandidate,
	type HistoricalEditionBundle,
	type EditionStoreOptions,
} from "./edition-store.js";
import {
	buildHistoricalEditionIndex,
	computeHistoricalMatch,
} from "./matching.js";
import {
	analyzePotentialOmission,
	classifyRelationship,
	type HistoricalClassificationContext,
	type SemanticBudget,
} from "./classifier.js";
import type { SemanticComparisonProvider } from "./semantic.js";
import {
	computeRegressionReportContentHash,
	createHistoricalRegressionStore,
	deriveReportId,
	type HistoricalRegressionStore,
	type SaveReportResult,
} from "./store.js";

/** Default maximum number of model-assisted semantic comparisons per run. */
export const DEFAULT_MAX_SEMANTIC_COMPARISONS = 20;

export interface HistoricalRegressionInput {
	/** Edition date in YYYY-MM-DD format. */
	editionDate: string;
	/** Current canonical fact dossier (already built by the earlier stage). */
	canonicalDossier: CanonicalFactDossier;
	/** Local data root (default 'data'). */
	dataDir?: string;
	/** Optional model-assisted semantic comparison provider. */
	semanticProvider?: SemanticComparisonProvider;
	/** Maximum semantic comparisons per run (cost control). */
	maxSemanticComparisons?: number;
	/** Deterministic timestamp override (tests, reproducible builds). */
	now?: string;
	/** Actor identifier recorded in the report. */
	generatedBy?: string;
	/** Include discovery records in the historical availability assessment. */
	includeDiscoveryRecords?: boolean;
	/** Include monitoring records in the historical availability assessment. */
	includeMonitoringRecords?: boolean;
	/** Persist the report and traceability records (default true). */
	persist?: boolean;
	/** Injectable store (tests). */
	store?: HistoricalRegressionStore;
}

export interface HistoricalRegressionResult {
	report: HistoricalRegressionReport;
	availability: HistoricalEditionAvailability[];
	relationships: HistoricalRelationship[];
	potentialOmissions: HistoricalOmissionFinding[];
	traceability: HistoricalTraceabilityRecord[];
	saveResult: SaveReportResult | null;
}

/** Generate a stable execution identifier (matches the omission review convention). */
function generateExecutionId(): string {
	return `exec_${crypto.randomBytes(8).toString("hex")}`;
}

/** Aggregate edition availability into the final regression status. */
export function computeFinalStatus(
	bundles: HistoricalEditionBundle[],
): HistoricalRegressionStatus {
	const statuses = bundles.map((bundle) => bundle.availability.status);
	if (statuses.includes("AVAILABLE")) return "COMPLETE";
	if (statuses.includes("PARTIAL")) return "PARTIAL";
	if (statuses.includes("NOT_ASSESSABLE")) return "NOT_ASSESSABLE";
	return "UNAVAILABLE";
}

/** Build the missing/uncertain historical evidence summary. */
export function buildMissingHistoricalEvidence(
	bundles: HistoricalEditionBundle[],
): string[] {
	const entries: string[] = [];
	for (const bundle of bundles) {
		const availability = bundle.availability;
		if (availability.status === "UNAVAILABLE") {
			entries.push(
				`Edition ${availability.editionDate}: no accessible historical records; previous coverage cannot be ruled out.`,
			);
			continue;
		}
		if (availability.status === "NOT_ASSESSABLE") {
			entries.push(
				`Edition ${availability.editionDate}: historical records are present but not usable for reliable comparison.`,
			);
			continue;
		}
		if (availability.missing.length > 0) {
			entries.push(
				`Edition ${availability.editionDate}: missing ${availability.missing.join(", ")}.`,
			);
		}
	}
	return entries.sort();
}

/**
 * Execute the historical regression for one edition.
 */
export async function runHistoricalRegression(
	input: HistoricalRegressionInput,
): Promise<HistoricalRegressionResult> {
	const dataDir = input.dataDir ?? "data";
	const now = input.now ?? new Date().toISOString();
	const generatedBy = input.generatedBy ?? "historical-regression-engine";

	const comparisonWindow: HistoricalComparisonWindow =
		getHistoricalComparisonWindow(input.editionDate);

	// --- 1. Load and assess actually accessible previous editions ----------
	const editionOptions: EditionStoreOptions = {
		dataDir,
		includeDiscoveryRecords: input.includeDiscoveryRecords,
		includeMonitoringRecords: input.includeMonitoringRecords,
	};
	const bundles: HistoricalEditionBundle[] =
		comparisonWindow.editionDates.map((editionDate) =>
			loadHistoricalEdition(editionDate, editionOptions),
		);

	const indexes = new Map<
		string,
		ReturnType<typeof buildHistoricalEditionIndex>
	>();
	for (const bundle of bundles) {
		if (!bundle.availability.canBeReliablyCompared || !bundle.dossier)
			continue;
		const indexed = buildHistoricalEditionIndex({
			editionDate: bundle.editionDate,
			dossier: bundle.dossier,
			publicationIds: bundle.availability.publicationIds,
		});
		if (indexed) indexes.set(bundle.editionDate, indexed);
	}

	const historyAvailable = indexes.size > 0;
	const semanticBudget: SemanticBudget = {
		remaining: Math.max(
			0,
			input.maxSemanticComparisons ?? DEFAULT_MAX_SEMANTIC_COMPARISONS,
		),
	};

	const context: HistoricalClassificationContext = {
		available: historyAvailable,
		indexes,
		semanticProvider: input.semanticProvider,
		semanticBudget,
		now,
	};

	// --- 2. Compare and classify every current candidate -------------------
	const relationships: HistoricalRelationship[] = [];
	const substantiveUpdates: HistoricalRegressionReport["substantiveUpdates"] =
		[];
	const repeatedReporting: HistoricalRegressionReport["repeatedReporting"] =
		[];
	const potentialOmissions: HistoricalOmissionFinding[] = [];
	const unresolvedQuestions: string[] = [];

	const candidates = input.canonicalDossier.candidates.toSorted((a, b) =>
		a.candidateId.localeCompare(b.candidateId),
	);

	for (const candidate of candidates) {
		const matches = [...indexes.entries()]
			.map(([editionDate, index]) =>
				computeHistoricalMatch(candidate, index),
			)
			.sort((a, b) => b.editionDate.localeCompare(a.editionDate));

		// Resolve previous publication references for traceability. This only adds
		// links; it never invents coverage.
		for (const match of matches) {
			const bundle = bundles.find(
				(candidate) => candidate.editionDate === match.editionDate,
			);
			const matchedCandidateId = match.matchedCandidateIds[0];
			if (!bundle || !matchedCandidateId) continue;
			const publicationId = findPublicationIdForCandidate(
				bundle,
				matchedCandidateId,
			);
			if (publicationId) match.previousPublicationId = publicationId;
		}

		const omission = analyzePotentialOmission({
			current: candidate,
			window: comparisonWindow,
			bundles,
			matches,
		});
		if (omission) potentialOmissions.push(omission);

		const result = await classifyRelationship({
			current: candidate,
			matches,
			context,
			omission,
		});

		relationships.push(result.relationship);
		unresolvedQuestions.push(...result.unresolvedQuestions);
		if (result.relationship.substantiveUpdate) {
			substantiveUpdates.push(result.relationship.substantiveUpdate);
		}
		if (result.relationship.repeatedReporting) {
			repeatedReporting.push(result.relationship.repeatedReporting);
		}
	}

	// Record unresolved semantic comparisons when the budget or provider was absent.
	const semanticOnlyCandidates = relationships.filter(
		(relationship) =>
			relationship.derivedFrom === "deterministic-matching" &&
			relationship.matches.some(
				(match) => match.matchType === "semantic-similarity",
			) &&
			relationship.classification === "HISTORY_UNVERIFIED",
	);
	if (semanticOnlyCandidates.length > 0 && !input.semanticProvider) {
		unresolvedQuestions.push(
			`${semanticOnlyCandidates.length} candidate(s) required semantic comparison but no free inference provider was configured; marked HISTORY_UNVERIFIED.`,
		);
	} else if (
		semanticOnlyCandidates.length > 0 &&
		semanticBudget.remaining === 0
	) {
		unresolvedQuestions.push(
			`${semanticOnlyCandidates.length} candidate(s) required semantic comparison but the comparison budget was exhausted; marked HISTORY_UNVERIFIED.`,
		);
	}

	// --- 3. Build the report ----------------------------------------------
	const finalStatus = computeFinalStatus(bundles);
	const inferenceUsed = relationships.some(
		(relationship) => relationship.semanticComparisonUsed,
	);
	const editionWindow =
		input.canonicalDossier.editionWindow ??
		getEditorialWindow(input.editionDate);

	const reportWithoutHash: Omit<
		HistoricalRegressionReport,
		"reportId" | "contentHash"
	> = {
		schemaVersion: HISTORICAL_REGRESSION_SCHEMA_VERSION,
		editionId: `edition_${input.editionDate}`,
		editionDate: input.editionDate,
		editionWindow: {
			editionDate: editionWindow.editionDate,
			start: editionWindow.start,
			end: editionWindow.end,
			timezone: editionWindow.timezone,
			durationHours: editionWindow.durationHours,
		},
		executionId: generateExecutionId(),
		executedAt: now,
		generatedBy,
		currentDossierVersion: input.canonicalDossier.dossierId,
		currentDossierContentHash: input.canonicalDossier.contentHash,
		historicalWindow: {
			days: comparisonWindow.days as 7,
			timezone: comparisonWindow.timezone as "Europe/Amsterdam",
			editionDates: comparisonWindow.editionDates,
			dailyEligibilityWindow: {
				editionDate:
					comparisonWindow.dailyEligibilityWindow.editionDate,
				start: comparisonWindow.dailyEligibilityWindow.start,
				end: comparisonWindow.dailyEligibilityWindow.end,
				timezone: HISTORICAL_REGRESSION_TIMEZONE,
				durationHours:
					comparisonWindow.dailyEligibilityWindow.durationHours,
			},
			dailyEligibilityWindowUnchanged: true,
		},
		historicalEditions: bundles.map((bundle) => bundle.availability),
		candidatesEvaluated: candidates.length,
		relationships,
		substantiveUpdates: substantiveUpdates.sort((a, b) =>
			a.previousEditionDate.localeCompare(b.previousEditionDate),
		),
		repeatedReporting: repeatedReporting.sort((a, b) =>
			a.previousEditionDate.localeCompare(b.previousEditionDate),
		),
		potentialOmissions: potentialOmissions.sort((a, b) =>
			a.candidateId.localeCompare(b.candidateId),
		),
		missingHistoricalEvidence: buildMissingHistoricalEvidence(bundles),
		unresolvedQuestions: [...new Set(unresolvedQuestions)].sort(),
		finalStatus,
		inferenceUsed,
		inferenceNote: inferenceUsed
			? "Model-assisted semantic comparison was used only where deterministic evidence was insufficient; deterministic findings were preserved and no novelty decision was overridden."
			: "No model inference was required; every relationship was derived deterministically from accessible local records.",
	};

	const contentHash = computeRegressionReportContentHash({
		...reportWithoutHash,
		reportId: "",
		contentHash: "",
	} as unknown as HistoricalRegressionReport);
	const reportId = deriveReportId(contentHash);

	const report: HistoricalRegressionReport = {
		...reportWithoutHash,
		reportId,
		contentHash,
	};

	// --- 4. Persist --------------------------------------------------------
	let saveResult: SaveReportResult | null = null;
	let traceability: HistoricalTraceabilityRecord[] = [];
	if (input.persist !== false) {
		const store =
			input.store ??
			createHistoricalRegressionStore(`${dataDir}/historical-regression`);
		saveResult = await store.saveReport(report);
		traceability = await store.loadTraceability(input.editionDate);
	}

	return {
		report,
		availability: bundles.map((bundle) => bundle.availability),
		relationships,
		potentialOmissions,
		traceability,
		saveResult,
	};
}
