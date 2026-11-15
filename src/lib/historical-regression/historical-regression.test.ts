/**
 * Historical Regression — Validation Tests
 *
 * ⚠️  All edition, candidate and claim data used here is SYNTHETIC FIXTURE
 * DATA from `./fixtures.js`. No test below represents actually retrieved
 * historical evidence, and no assertion should be read as a real editorial or
 * research finding.
 *
 * Coverage:
 * 1.  Correct seven-calendar-day window calculation.
 * 2.  Daylight-saving transitions.
 * 3.  Late execution without boundary shifts.
 * 4.  Available, partial and missing historical editions.
 * 5.  Previously covered developments.
 * 6.  Duplicate reporting across multiple sources.
 * 7.  Genuine substantive updates.
 * 8.  Different studies covering similar topics.
 * 9.  Publication of new evidence about older events.
 * 10. Repeated consultancy findings without new data.
 * 11. Newly revised strategic research conclusions.
 * 12. Historical omissions and catch-up classification.
 * 13. Candidate-to-edition traceability.
 * 14. Stable identifiers and idempotent reruns.
 * 15. Persistent records and verified readback.
 * 16. Backward compatibility with existing pipeline contracts.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
	existsSync,
	readFileSync,
	rmSync,
	mkdirSync,
	writeFileSync,
	appendFileSync,
} from "fs";
import { join } from "path";

import {
	CURRENT_EDITION,
	HISTORICAL_EDITIONS,
	FIXTURE_DATA_DIR,
	createCurrentEditionDossier,
	createHistoricalFixtures,
	fixtureCandidateId,
	writeHistoricalFixtures,
} from "./fixtures.js";
import {
	HISTORICAL_REGRESSION_DAYS,
	HISTORICAL_REGRESSION_SCHEMA_VERSION,
	HISTORICAL_REGRESSION_TIMEZONE,
	HistoricalRegressionReportSchema,
	generateHistoricalRegressionJsonSchema,
	getHistoricalComparisonDates,
	getHistoricalComparisonWindow,
	verifyDailyWindowUnchanged,
	computeHistoricalMatch,
	buildHistoricalEditionIndex,
	findHistoricalEditionForDisclosure,
	normalizeUrl,
	compareVersions,
	loadHistoricalEdition,
	runHistoricalRegression,
	createHistoricalRegressionStore,
	computeRegressionReportContentHash,
	deriveReportId,
	type HistoricalRegressionInput,
	type SemanticComparisonProvider,
} from "./index.js";
import {
	getEditorialWindow,
	isInEditorialWindow,
} from "../editorial-window.js";
import { classifyNovelty } from "../novelty-classification.js";
import { deriveTemporalEligibilityStatus } from "../fact-dossier/consolidator.js";
import { validateFactDossier } from "../fact-dossier/validate.js";
import type { CanonicalFactDossier } from "../fact-dossier/schema.js";

// ============================================================================
// Helpers
// ============================================================================

const EDITION = CURRENT_EDITION; // 2025-01-15
const STORE_DIR = join(FIXTURE_DATA_DIR, "historical-regression");

let currentDossier: CanonicalFactDossier;
let baseResult: Awaited<ReturnType<typeof runHistoricalRegression>>;

beforeAll(() => {
	writeHistoricalFixtures(FIXTURE_DATA_DIR);
	currentDossier = createCurrentEditionDossier();
});

afterAll(() => {
	rmSync(STORE_DIR, { recursive: true, force: true });
});

function run(overrides: Partial<HistoricalRegressionInput> = {}) {
	return runHistoricalRegression({
		editionDate: EDITION,
		canonicalDossier: currentDossier,
		dataDir: FIXTURE_DATA_DIR,
		now: "2025-01-15T06:00:00Z",
		generatedBy: "historical-regression-test",
		store: createHistoricalRegressionStore(STORE_DIR),
		...overrides,
	});
}

function relationshipFor(
	result: Awaited<ReturnType<typeof runHistoricalRegression>>,
	key: string,
) {
	const id = fixtureCandidateId(key);
	const relationship = result.relationships.find(
		(entry) => entry.candidateId === id,
	);
	if (!relationship)
		throw new Error(`No relationship for fixture key ${key} (${id})`);
	return relationship;
}

function omissionFor(
	result: Awaited<ReturnType<typeof runHistoricalRegression>>,
	key: string,
) {
	const id = fixtureCandidateId(key);
	return (
		result.potentialOmissions.find((entry) => entry.candidateId === id) ??
		null
	);
}

beforeAll(async () => {
	baseResult = await run();
});

// ============================================================================
// 1. Seven-calendar-day window calculation
// ============================================================================

describe("Seven-calendar-day comparison window", () => {
	it("returns exactly the preceding seven calendar dates in ascending order", () => {
		const window = getHistoricalComparisonWindow("2026-11-11");
		expect(window.days).toBe(HISTORICAL_REGRESSION_DAYS);
		expect(window.days).toBe(7);
		expect(window.timezone).toBe(HISTORICAL_REGRESSION_TIMEZONE);
		expect(window.timezone).toBe("Europe/Amsterdam");
		expect(window.editionDates).toEqual([
			"2026-11-04",
			"2026-11-05",
			"2026-11-06",
			"2026-11-07",
			"2026-11-08",
			"2026-11-09",
			"2026-11-10",
		]);
	});

	it("handles month and year boundaries", () => {
		expect(getHistoricalComparisonDates("2026-01-03", 7)).toEqual([
			"2025-12-27",
			"2025-12-28",
			"2025-12-29",
			"2025-12-30",
			"2025-12-31",
			"2026-01-01",
			"2026-01-02",
		]);
		expect(getHistoricalComparisonDates("2026-03-01", 7)[0]).toBe(
			"2026-02-22",
		);
	});

	it("keeps the strict daily eligibility window separate and unchanged", () => {
		const window = getHistoricalComparisonWindow("2026-11-11");
		expect(window.dailyEligibilityWindowUnchanged).toBe(true);
		expect(window.dailyEligibilityWindow.start).toBe(
			"2026-11-10T05:00:00+01:00[Europe/Amsterdam]",
		);
		expect(window.dailyEligibilityWindow.end).toBe(
			"2026-11-11T05:00:00+01:00[Europe/Amsterdam]",
		);
		expect(window.dailyEligibilityWindow.durationHours).toBe(24);
		// The historical comparison window must not replace or shift the daily window.
		const daily = getEditorialWindow("2026-11-11");
		expect(window.dailyEligibilityWindow.start).toBe(daily.start);
		expect(window.dailyEligibilityWindow.end).toBe(daily.end);
	});

	it("reports the daily window as unchanged via the audit helper", () => {
		const report = verifyDailyWindowUnchanged("2026-11-11");
		expect(report.unchanged).toBe(true);
		expect(report.timezone).toBe("Europe/Amsterdam");
		expect(report.durationHours).toBe(24);
	});
});

// ============================================================================
// 2. Daylight-saving transitions
// ============================================================================

describe("Daylight-saving transitions", () => {
	it("produces 23-hour daily windows across the spring-forward transition", () => {
		const window = getHistoricalComparisonWindow("2025-03-30");
		expect(window.editionDates).toEqual([
			"2025-03-23",
			"2025-03-24",
			"2025-03-25",
			"2025-03-26",
			"2025-03-27",
			"2025-03-28",
			"2025-03-29",
		]);
		expect(window.dailyEligibilityWindow.durationHours).toBe(23);
		expect(window.dailyEligibilityWindow.start).toBe(
			"2025-03-29T05:00:00+01:00[Europe/Amsterdam]",
		);
		expect(window.dailyEligibilityWindow.end).toBe(
			"2025-03-30T05:00:00+02:00[Europe/Amsterdam]",
		);
	});

	it("produces 25-hour daily windows across the fall-back transition", () => {
		const window = getHistoricalComparisonWindow("2025-10-26");
		expect(window.editionDates).toEqual([
			"2025-10-19",
			"2025-10-20",
			"2025-10-21",
			"2025-10-22",
			"2025-10-23",
			"2025-10-24",
			"2025-10-25",
		]);
		expect(window.dailyEligibilityWindow.durationHours).toBe(25);
		expect(window.dailyEligibilityWindow.start).toBe(
			"2025-10-25T05:00:00+02:00[Europe/Amsterdam]",
		);
		expect(window.dailyEligibilityWindow.end).toBe(
			"2025-10-26T05:00:00+01:00[Europe/Amsterdam]",
		);
	});

	it("classifies timestamps correctly on the transition days themselves", () => {
		// 2025-03-30 window: [2025-03-29T05:00+01:00, 2025-03-30T05:00+02:00)
		expect(
			isInEditorialWindow("2025-03-29T12:00:00+01:00", "2025-03-30"),
		).toBe(true);
		expect(
			isInEditorialWindow("2025-03-30T03:00:00+02:00", "2025-03-30"),
		).toBe(true);
		expect(
			isInEditorialWindow("2025-03-30T06:00:00+02:00", "2025-03-30"),
		).toBe(false);
	});
});

// ============================================================================
// 3. Late execution without boundary shifts
// ============================================================================

describe("Late execution invariance", () => {
	it("produces identical historical dates and daily windows regardless of execution time", async () => {
		const early = await run({ now: "2025-01-15T05:30:00Z" });
		const late = await run({ now: "2025-01-16T23:59:00Z" });

		expect(early.report.historicalWindow.editionDates).toEqual(
			late.report.historicalWindow.editionDates,
		);
		expect(early.report.historicalWindow.dailyEligibilityWindow).toEqual(
			late.report.historicalWindow.dailyEligibilityWindow,
		);
		expect(early.report.editionWindow).toEqual(late.report.editionWindow);
	});

	it("produces identical classifications and report identifiers on late execution", async () => {
		const early = await run({ now: "2025-01-15T05:30:00Z" });
		const late = await run({ now: "2025-01-16T23:59:00Z" });

		expect(late.report.reportId).toBe(early.report.reportId);
		expect(late.report.contentHash).toBe(early.report.contentHash);
		expect(late.report.relationships).toEqual(early.report.relationships);
		expect(late.report.finalStatus).toBe(early.report.finalStatus);
	});

	it("keeps the strict 24-hour news window separate from the 7-day window", async () => {
		const result = await run();
		const window = getEditorialWindow(EDITION);
		expect(result.report.editionWindow.start).toBe(window.start);
		expect(result.report.editionWindow.end).toBe(window.end);
		expect(result.report.historicalWindow.days).toBe(7);
		expect(result.report.historicalWindow.editionDates).toHaveLength(7);
		expect(result.report.historicalWindow.editionDates).not.toContain(
			EDITION,
		);
	});
});

// ============================================================================
// 4. Historical edition availability
// ============================================================================

describe("Historical edition availability", () => {
	it("classifies AVAILABLE, PARTIAL and UNAVAILABLE editions", () => {
		const byDate = new Map(
			baseResult.availability.map((entry) => [entry.editionDate, entry]),
		);

		expect(byDate.get("2025-01-08")?.status).toBe("AVAILABLE");
		expect(byDate.get("2025-01-09")?.status).toBe("AVAILABLE");
		expect(byDate.get("2025-01-10")?.status).toBe("AVAILABLE");
		expect(byDate.get("2025-01-11")?.status).toBe("UNAVAILABLE");
		expect(byDate.get("2025-01-12")?.status).toBe("PARTIAL");
		expect(byDate.get("2025-01-13")?.status).toBe("AVAILABLE");
		expect(byDate.get("2025-01-14")?.status).toBe("AVAILABLE");
	});

	it("records which historical evidence is present for each edition", () => {
		const byDate = new Map(
			baseResult.availability.map((entry) => [entry.editionDate, entry]),
		);
		const available = byDate.get("2025-01-08")!;
		expect(available.dossierAvailable).toBe(true);
		expect(available.researchAuditAvailable).toBe(true);
		expect(available.publishedArticleRecordsAvailable).toBe(true);
		expect(available.canBeReliablyCompared).toBe(true);
		expect(available.candidateIds.length).toBeGreaterThan(0);

		const partial = byDate.get("2025-01-12")!;
		expect(partial.dossierAvailable).toBe(true);
		expect(partial.researchAuditAvailable).toBe(false);
		expect(partial.canBeReliablyCompared).toBe(false);
		expect(partial.missing).toContain("research audit");

		const unavailable = byDate.get("2025-01-11")!;
		expect(unavailable.exists).toBe(false);
		expect(unavailable.dossierAvailable).toBe(false);
		expect(unavailable.canBeReliablyCompared).toBe(false);
	});

	it("aggregates the final regression status from edition availability", () => {
		expect(baseResult.report.finalStatus).toBe("COMPLETE");
	});

	it("loads editions from actually accessible local records only", () => {
		const bundle = loadHistoricalEdition("2025-01-11", {
			dataDir: FIXTURE_DATA_DIR,
		});
		expect(bundle.availability.status).toBe("UNAVAILABLE");
		expect(bundle.dossier).toBeNull();
		expect(bundle.audit).toBeNull();
	});

	it("marks an unparseable dossier as NOT_ASSESSABLE rather than AVAILABLE", () => {
		// The fixture directory contains only valid dossiers; construct a corrupt
		// record in a temporary directory to prove the classification is not based
		// on file existence alone.
		const tempDir = join(FIXTURE_DATA_DIR, "corpus-invalid");
		rmSync(tempDir, { recursive: true, force: true });
		mkdirSync(join(tempDir, "fact-dossiers"), { recursive: true });
		writeFileSync(
			join(tempDir, "fact-dossiers", "edition_2025-01-08.json"),
			"{ not valid json",
			"utf-8",
		);
		const bundle = loadHistoricalEdition("2025-01-08", {
			dataDir: tempDir,
		});
		expect(bundle.availability.status).toBe("NOT_ASSESSABLE");
		expect(bundle.availability.dossierAvailable).toBe(false);
		rmSync(tempDir, { recursive: true, force: true });
	});
});

// ============================================================================
// 5-11, 12. Relationship classifications
// ============================================================================

describe("Historical relationship classification", () => {
	it("classifies an already covered release as PREVIOUSLY_COVERED (fixture case 1)", () => {
		const relationship = relationshipFor(
			baseResult,
			"cand_copilot_release_0108",
		);
		expect(relationship.classification).toBe("PREVIOUSLY_COVERED");
		expect(relationship.primaryMatchEditionDate).toBe("2025-01-08");
		expect(relationship.primaryMatchType).toBe("candidate-id");
		expect(relationship.derivedFrom).toBe("deterministic-matching");
	});

	it("classifies a material capability update as SUBSTANTIVE_UPDATE (fixture case 2)", () => {
		const relationship = relationshipFor(
			baseResult,
			"cand_copilot_update_0115",
		);
		expect(relationship.classification).toBe("SUBSTANTIVE_UPDATE");
		expect(relationship.primaryMatchEditionDate).toBe("2025-01-08");
		expect(relationship.substantiveUpdate).toBeDefined();
		expect(relationship.substantiveUpdate?.updateTypes).toContain(
			"availability-change",
		);
		expect(relationship.substantiveUpdate?.updateTypes).toContain(
			"behavior-change",
		);
		expect(relationship.substantiveUpdate?.withinCurrentEditionWindow).toBe(
			true,
		);
		expect(relationship.substantiveUpdate?.previousCandidateId).toBe(
			fixtureCandidateId("cand_copilot_release_0108"),
		);
	});

	it("classifies a new article summarizing an older paper as REPEATED_REPORTING (fixture case 3)", () => {
		const relationship = relationshipFor(
			baseResult,
			"cand_paper_summary_0115",
		);
		expect(relationship.classification).toBe("REPEATED_REPORTING");
		expect(relationship.primaryMatchEditionDate).toBe("2025-01-08");
		expect(relationship.repeatedReporting?.qualifyingChange).toBeNull();
	});

	it("classifies an independent replication as SUBSTANTIVE_UPDATE with independent-replication (fixture case 4)", () => {
		const relationship = relationshipFor(
			baseResult,
			"cand_independent_replication_0115",
		);
		expect(relationship.classification).toBe("SUBSTANTIVE_UPDATE");
		expect(relationship.primaryMatchEditionDate).toBe("2025-01-09");
		expect(relationship.substantiveUpdate?.updateTypes).toContain(
			"independent-replication",
		);
		expect(relationship.substantiveUpdate?.updateTypes).toContain(
			"measured-outcome",
		);
	});

	it("classifies a repeated consultancy finding as REPEATED_REPORTING without new data (fixture case 5)", () => {
		const relationship = relationshipFor(
			baseResult,
			"cand_gartner_repeat_0115",
		);
		expect(relationship.classification).toBe("REPEATED_REPORTING");
		expect(relationship.primaryMatchEditionDate).toBe("2025-01-09");
		expect(relationship.repeatedReporting).toBeDefined();
		expect(relationship.substantiveUpdate).toBeUndefined();
	});

	it("classifies revised strategic research with new empirical findings as SUBSTANTIVE_UPDATE (fixture case 6)", () => {
		const relationship = relationshipFor(
			baseResult,
			"cand_mckinsey_new_0115",
		);
		expect(relationship.classification).toBe("SUBSTANTIVE_UPDATE");
		expect(relationship.substantiveUpdate?.updateTypes).toContain(
			"strategic-research-revision",
		);
		expect(relationship.substantiveUpdate?.updateTypes).toContain(
			"measured-outcome",
		);
		expect(
			relationship.substantiveUpdate?.changedFacts.some((fact) =>
				fact.includes("Sample size"),
			),
		).toBe(true);
	});

	it("does not collapse different studies covering similar topics (fixture case 11)", () => {
		const relationship = relationshipFor(baseResult, "cand_idc_0115");
		expect(relationship.classification).toBe("NEW_DEVELOPMENT");
		expect(relationship.matches.every((match) => !match.matched)).toBe(
			true,
		);
	});

	it("preserves publication-date-first semantics for original reporting about older events (fixture case 9)", () => {
		const relationship = relationshipFor(
			baseResult,
			"cand_breach_exclusive_0115",
		);
		expect(relationship.classification).toBe("NEW_DEVELOPMENT");
		// The underlying event is old, but the first disclosure is in the current window.
		expect(relationship.historicalContext.join(" ")).not.toContain(
			"2023-03-15",
		);
		expect(
			omissionFor(baseResult, "cand_breach_exclusive_0115"),
		).toBeNull();
	});

	it("marks semantic-only matches as HISTORY_UNVERIFIED when no inference is available", () => {
		const relationship = relationshipFor(
			baseResult,
			"cand_context_update_0115",
		);
		expect(relationship.classification).toBe("HISTORY_UNVERIFIED");
		expect(
			relationship.matches.some(
				(match) => match.matchType === "semantic-similarity",
			),
		).toBe(true);
		expect(relationship.semanticComparisonUsed).toBe(false);
		expect(baseResult.report.inferenceUsed).toBe(false);
		expect(baseResult.report.unresolvedQuestions.join(" ")).toContain(
			"semantic comparison",
		);
	});

	it("uses model reasoning only where deterministic evidence is insufficient", async () => {
		const semanticProvider: SemanticComparisonProvider = {
			compare: async () => ({
				relationship: "substantive-update",
				confidence: 0.85,
				changedFacts: [
					"A new method extends context compression with a different mechanism.",
				],
				rationale: "Synthetic semantic comparison fixture.",
				provider: "fake-provider",
				model: "fake-model",
			}),
		};

		const result = await run({ semanticProvider });
		const relationship = relationshipFor(
			result,
			"cand_context_update_0115",
		);

		expect(relationship.classification).toBe("SUBSTANTIVE_UPDATE");
		expect(relationship.derivedFrom).toBe("semantic-comparison");
		expect(relationship.semanticComparisonUsed).toBe(true);
		expect(result.report.inferenceUsed).toBe(true);
		expect(result.report.inferenceNote).toContain("Model-assisted");
		// Deterministic classifications remain untouched.
		expect(
			relationshipFor(result, "cand_copilot_release_0108").classification,
		).toBe("PREVIOUSLY_COVERED");
		expect(
			relationshipFor(result, "cand_copilot_update_0115").derivedFrom,
		).toBe("deterministic-matching");
	});

	it("marks the semantic comparison unresolved when free inference fails", async () => {
		const failingProvider: SemanticComparisonProvider = {
			compare: async () => {
				throw new Error(
					"All free providers exhausted (synthetic test)",
				);
			},
		};

		const result = await run({ semanticProvider: failingProvider });
		const relationship = relationshipFor(
			result,
			"cand_context_update_0115",
		);

		expect(relationship.classification).toBe("HISTORY_UNVERIFIED");
		expect(relationship.semanticComparisonUsed).toBe(false);
		expect(result.report.inferenceUsed).toBe(false);
		expect(result.report.unresolvedQuestions.join(" ")).toContain(
			"inference capacity",
		);
	});

	it("classifies a missed development as POTENTIAL_HISTORICAL_OMISSION with CATCH_UP (fixture case 7)", () => {
		const relationship = relationshipFor(
			baseResult,
			"cand_missed_announcement_0115",
		);
		expect(relationship.classification).toBe(
			"POTENTIAL_HISTORICAL_OMISSION",
		);

		const omission = omissionFor(
			baseResult,
			"cand_missed_announcement_0115",
		);
		expect(omission).not.toBeNull();
		expect(omission?.suspectedMissedEditionDate).toBe("2025-01-10");
		expect(omission?.classification).toBe("NOT_DISCOVERED");
		expect(omission?.significance).toBe("high");
		expect(omission?.proposedCatchUp).toBe(true);
		expect(omission?.catchUpNote).toContain("CATCH_UP");
	});

	it("never interprets a missing edition as evidence of no previous coverage (fixture case 8)", () => {
		const omission = omissionFor(
			baseResult,
			"cand_inaccessible_window_0115",
		);
		expect(omission).not.toBeNull();
		expect(omission?.suspectedMissedEditionDate).toBe("2025-01-11");
		expect(omission?.classification).toBe("NOT_ASSESSABLE");
		expect(omission?.proposedCatchUp).toBe(false);

		const relationship = relationshipFor(
			baseResult,
			"cand_inaccessible_window_0115",
		);
		expect(relationship.classification).not.toBe("PREVIOUSLY_COVERED");
		expect(baseResult.report.missingHistoricalEvidence.join(" ")).toContain(
			"Edition 2025-01-11: no accessible historical records",
		);
	});

	it("marks every candidate HISTORY_UNVERIFIED when no historical edition is accessible", async () => {
		const emptyDir = join(FIXTURE_DATA_DIR, "empty-history");
		rmSync(emptyDir, { recursive: true, force: true });
		mkdirSync(emptyDir, { recursive: true });

		const result = await run({
			dataDir: emptyDir,
			store: createHistoricalRegressionStore(
				join(emptyDir, "historical-regression"),
			),
		});

		expect(result.report.finalStatus).toBe("UNAVAILABLE");
		expect(result.report.historicalEditions).toHaveLength(7);
		for (const edition of result.report.historicalEditions) {
			expect(edition.status).toBe("UNAVAILABLE");
			expect(edition.canBeReliablyCompared).toBe(false);
		}
		for (const relationship of result.relationships) {
			expect(relationship.classification).toBe("HISTORY_UNVERIFIED");
			expect(relationship.derivedFrom).toBe("history-unavailable");
		}
		expect(result.report.missingHistoricalEvidence).toHaveLength(7);
		rmSync(emptyDir, { recursive: true, force: true });
	});

	it("ignores malformed disclosure timestamps during omission analysis", () => {
		expect(
			findHistoricalEditionForDisclosure("not-a-timestamp", [
				"2025-01-08",
			]),
		).toBeNull();
		expect(
			findHistoricalEditionForDisclosure("2025-01-07T12:00:00+01:00", [
				"2025-01-08",
			]),
		).toBe("2025-01-08");
		// The current edition window is explicitly outside the historical window.
		expect(
			findHistoricalEditionForDisclosure("2025-01-14T12:00:00+01:00", [
				...HISTORICAL_EDITIONS,
			]),
		).toBeNull();
	});

	it("keeps historical relationship classification separate from temporal novelty eligibility", () => {
		for (const relationship of baseResult.relationships) {
			const candidate = currentDossier.candidates.find(
				(entry) => entry.candidateId === relationship.candidateId,
			);
			expect(candidate).toBeDefined();
			// The dossier's novelty-derived eligibility is untouched by regression.
			expect(candidate!.temporalEligibility.derivedFrom).toBe(
				"novelty-classification",
			);
			expect(relationship.derivedFrom).not.toBe("novelty-classification");
		}
	});
});

// ============================================================================
// 13. Cross-edition traceability
// ============================================================================

describe("Cross-edition traceability", () => {
	it("records previous coverage references with stable identifiers", () => {
		const relationship = relationshipFor(
			baseResult,
			"cand_copilot_update_0115",
		);
		expect(relationship.primaryMatchEditionDate).toBe("2025-01-08");
		expect(relationship.primaryMatchCandidateId).toBe(
			fixtureCandidateId("cand_copilot_release_0108"),
		);
		expect(relationship.substantiveUpdate?.previousClaimIds).toContain(
			// The claim identifier is stable across editions in the fixture set.
			relationship.matches.find(
				(match) => match.editionDate === "2025-01-08",
			)?.matchedClaimIds[0] ?? "",
		);
	});

	it("links previous publication identifiers where records exist", () => {
		const relationship = relationshipFor(
			baseResult,
			"cand_copilot_release_0108",
		);
		const match = relationship.matches.find(
			(entry) => entry.editionDate === "2025-01-08",
		);
		expect(match?.previousPublicationId).toMatch(/^pub_[a-z0-9]{16}$/);
	});

	it("persists append-only traceability records", async () => {
		const store = createHistoricalRegressionStore(STORE_DIR);
		const records = (await store.loadTraceability(EDITION)).filter(
			(record) => record.reportId === baseResult.report.reportId,
		);
		expect(records.length).toBe(baseResult.relationships.length);
		for (const record of records) {
			expect(record.recordId).toMatch(/^htr_[a-z0-9]{16}$/);
			expect(record.reportId).toBe(baseResult.report.reportId);
			expect(record.editionDate).toBe(EDITION);
		}
		const copilot = records.find(
			(record) =>
				record.candidateId ===
				fixtureCandidateId("cand_copilot_update_0115"),
		);
		expect(copilot?.previousEditionDate).toBe("2025-01-08");
		expect(copilot?.classification).toBe("SUBSTANTIVE_UPDATE");
	});
});

// ============================================================================
// 14-15. Idempotency, persistence and readback
// ============================================================================

describe("Idempotency and persistence", () => {
	it("does not duplicate classification records on rerun", async () => {
		const first = await run({ now: "2025-01-15T06:00:00Z" });
		const second = await run({ now: "2025-01-15T06:05:00Z" });

		expect(second.report.reportId).toBe(first.report.reportId);
		expect(second.report.contentHash).toBe(first.report.contentHash);
		expect(second.saveResult?.saved).toBe(false);
		expect(second.saveResult?.reason).toBe("identical");
	});

	it("produces a stable report identifier derived from classification content", () => {
		const expectedId = deriveReportId(baseResult.report.contentHash);
		expect(baseResult.report.reportId).toBe(expectedId);
		expect(baseResult.report.reportId).toMatch(/^hr_[a-z0-9]{16}$/);
	});

	it("verifies persisted report readback and content hash", async () => {
		const store = createHistoricalRegressionStore(STORE_DIR);
		const loaded = await store.loadReport(EDITION);
		expect(loaded).not.toBeNull();
		expect(loaded!.reportId).toBe(baseResult.report.reportId);
		expect(loaded!.contentHash).toBe(baseResult.report.contentHash);
		expect(computeRegressionReportContentHash(loaded!)).toBe(
			loaded!.contentHash,
		);

		const files = existsSync(join(STORE_DIR, "index.json"));
		expect(files).toBe(true);
		const index = JSON.parse(
			readFileSync(join(STORE_DIR, "index.json"), "utf-8"),
		);
		expect(index.editions[EDITION].reportId).toBe(
			baseResult.report.reportId,
		);
		expect(index.editions[EDITION].contentHash).toBe(
			baseResult.report.contentHash,
		);
	});

	it("appends traceability records exactly once across reruns", async () => {
		await run({ now: "2025-01-15T06:10:00Z" });
		await run({ now: "2025-01-15T06:20:00Z" });
		const store = createHistoricalRegressionStore(STORE_DIR);
		const records = await store.loadTraceability(EDITION);
		const ids = records.map((record) => record.recordId);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("keeps historical records immutable (fixtures unchanged after runs)", async () => {
		const before = readFileSync(
			join(FIXTURE_DATA_DIR, "fact-dossiers", "edition_2025-01-08.json"),
			"utf-8",
		);
		await run({ now: "2025-01-15T06:30:00Z" });
		const after = readFileSync(
			join(FIXTURE_DATA_DIR, "fact-dossiers", "edition_2025-01-08.json"),
			"utf-8",
		);
		expect(after).toBe(before);
	});

	it("schema-validates the traceability ledger and skips corrupted lines", async () => {
		const store = createHistoricalRegressionStore(STORE_DIR);
		const ledgerPath = join(STORE_DIR, "traceability.jsonl");
		const before = await store.loadTraceability(EDITION);
		expect(before.length).toBeGreaterThan(0);

		// Append a corrupted line directly; the reader must skip it.
		const corrupted = JSON.stringify({
			recordId: "htr_not-a-valid-record",
			reportId: "hr_bad",
		});
		appendFileSync(ledgerPath, `${corrupted}\n`, "utf-8");

		const after = await store.loadTraceability(EDITION);
		expect(after.map((record) => record.recordId)).toEqual(
			before.map((record) => record.recordId),
		);
		expect(after.map((record) => record.recordId)).not.toContain(
			"htr_not-a-valid-record",
		);
	});
});

// ============================================================================
// 16. Backward compatibility
// ============================================================================

describe("Backward compatibility with existing pipeline contracts", () => {
	it("consumes the existing canonical fact dossier without modification", async () => {
		const snapshot = JSON.stringify(currentDossier);
		await run({ now: "2025-01-15T06:40:00Z" });
		expect(JSON.stringify(currentDossier)).toBe(snapshot);
	});

	it("validates the fixture dossiers against the canonical dossier schema", () => {
		const fixtures = createHistoricalFixtures();
		for (const [editionDate, dossier] of Object.entries(
			fixtures.historical,
		)) {
			const result = validateFactDossier(dossier);
			expect(
				result.valid,
				`${editionDate}: ${result.errors.join("; ")}`,
			).toBe(true);
		}
		expect(validateFactDossier(fixtures.current).valid).toBe(true);
	});

	it("reuses the existing novelty classifier for temporal eligibility", () => {
		const candidate = currentDossier.candidates.find(
			(entry) =>
				entry.candidateId ===
				fixtureCandidateId("cand_copilot_update_0115"),
		)!;
		const direct = classifyNovelty({
			title: candidate.factualHeadline,
			summary: candidate.exactStatement,
			proposedPublicationTimestamp:
				candidate.timestamps.originalPublicationTimestamp!,
			sourceUrls: [candidate.sources[0].canonicalUrl],
			sourceTier: 2,
			editionDate: EDITION,
			isKnownUpdate: true,
			updateDescription: "fixture",
		});
		expect(
			candidate.temporalEligibility.noveltyClassification.classification,
		).toBe(direct.classification);
		expect(candidate.temporalEligibility.status).toBe(
			deriveTemporalEligibilityStatus(direct),
		);
	});

	it("produces a report that validates against the report schema", () => {
		const parsed = HistoricalRegressionReportSchema.safeParse(
			baseResult.report,
		);
		expect(
			parsed.success,
			JSON.stringify(parsed.success ? [] : parsed.error.issues),
		).toBe(true);
	});

	it("keeps the daily eligibility window authoritative and unchanged in the report", () => {
		const window = getEditorialWindow(EDITION);
		expect(baseResult.report.editionWindow).toEqual({
			editionDate: EDITION,
			start: window.start,
			end: window.end,
			timezone: "Europe/Amsterdam",
			durationHours: window.durationHours,
		});
		expect(
			baseResult.report.historicalWindow.dailyEligibilityWindow,
		).toEqual(baseResult.report.editionWindow);
	});

	it("generates a draft-07 JSON schema from the same Zod contract", () => {
		const schema = generateHistoricalRegressionJsonSchema();
		expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#");
		expect(schema.$id).toBe(
			"https://ai-intelligence-blog/schemas/historical-regression.json",
		);
		expect(schema.title).toBe("Historical Regression Report");
		expect(HISTORICAL_REGRESSION_SCHEMA_VERSION).toBe("1.0.0");
	});

	it("does not re-implement novelty classification, verification or ranking", () => {
		// The report must not contain editorial ranking, quotas or scores.
		const serialized = JSON.stringify(baseResult.report);
		expect(serialized).not.toContain('"priorityScore"');
		expect(serialized).not.toContain('"readinessFlags"');
		expect(baseResult.report.candidatesEvaluated).toBe(
			currentDossier.candidates.length,
		);
	});
});

// ============================================================================
// Deterministic matching primitives
// ============================================================================

describe("Deterministic matching primitives", () => {
	it("normalizes URLs for canonical comparison", () => {
		expect(normalizeUrl("https://www.Example.com/path/")).toBe(
			"https://example.com/path",
		);
		expect(normalizeUrl("http://example.com/path?utm_source=x&id=2")).toBe(
			"https://example.com/path?id=2",
		);
		expect(normalizeUrl("https://example.com/path?id=2&id=1")).toBe(
			"https://example.com/path?id=1&id=2",
		);
	});

	it("compares product versions numerically", () => {
		expect(compareVersions("1.0", "2.0")).toBe(-1);
		expect(compareVersions("2.0", "2.0")).toBe(0);
		expect(compareVersions("2.1", "2.0")).toBe(1);
		expect(compareVersions(undefined, "2.0")).toBeNull();
	});

	it("prefers deterministic identifiers over token similarity", () => {
		const historical = createHistoricalFixtures().historical["2025-01-08"];
		const index = buildHistoricalEditionIndex({
			editionDate: "2025-01-08",
			dossier: historical,
			publicationIds: [],
		});
		const current = createCurrentEditionDossier().candidates.find(
			(entry) =>
				entry.candidateId ===
				fixtureCandidateId("cand_copilot_release_0108"),
		)!;
		const match = computeHistoricalMatch(current, index);
		expect(match.matchType).toBe("candidate-id");
		expect(match.matched).toBe(true);
		expect(match.matchedUrls.length).toBeGreaterThan(0);
	});
});
