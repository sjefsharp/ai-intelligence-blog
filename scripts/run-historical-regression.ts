#!/usr/bin/env node
/**
 * Run the rolling seven-calendar-day historical regression for one edition.
 *
 * Consumes the canonical fact dossier produced by the earlier pipeline stage
 * and actually accessible previous editions, then produces a structured
 * historical regression report for editorial selection.
 *
 * Usage:
 *   pnpm exec tsx scripts/run-historical-regression.ts --edition 2025-01-15
 *   pnpm exec tsx scripts/run-historical-regression.ts --edition 2025-01-15 --demo
 *   pnpm exec tsx scripts/run-historical-regression.ts --edition 2025-01-15 --semantic
 *   pnpm exec tsx scripts/run-historical-regression.ts --edition 2025-01-15 --no-persist
 *
 * ⚠️  The stage never modifies previously published editions, never redefines
 * the strict daily news eligibility window and never performs editorial ranking.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

import {
	runHistoricalRegression,
	createHistoricalRegressionStore,
	createFreeLlmSemanticComparisonProvider,
	type HistoricalRegressionInput,
} from "../src/lib/historical-regression/index.js";
import { hasInferenceCredentials as hasInferenceCredentialsForRegression } from "../src/lib/fact-dossier/enrichment.js";
import type { CanonicalFactDossier } from "../src/lib/fact-dossier/schema.js";

const DEFAULT_EDITION = "2025-01-15";
const DATA_DIR = "data";

interface RunArgs {
	edition: string;
	dossierPath: string;
	dataDir: string;
	outDir: string;
	demo: boolean;
	semantic: boolean;
	persist: boolean;
	maxSemanticComparisons: number;
	generatedBy: string;
}

function parseArgs(argv: string[]): RunArgs {
	const raw: Record<string, string> = {};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (!arg.startsWith("--")) continue;
		const key = arg.slice(2);
		const next = argv[i + 1];
		if (next && !next.startsWith("--")) {
			raw[key] = next;
			i++;
		} else {
			raw[key] = "true";
		}
	}
	const edition = raw.edition ?? DEFAULT_EDITION;
	const maxSemantic = Number.parseInt(
		raw["max-semantic-comparisons"] ?? "20",
		10,
	);
	return {
		edition,
		dossierPath:
			raw.dossier ??
			join(DATA_DIR, "fact-dossiers", `edition_${edition}.json`),
		dataDir: raw["data-dir"] ?? DATA_DIR,
		outDir: raw.out ?? join(DATA_DIR, "historical-regression"),
		demo: raw.demo === "true",
		semantic: raw.semantic === "true",
		persist: raw["no-persist"] !== "true",
		maxSemanticComparisons: Number.isFinite(maxSemantic) ? maxSemantic : 20,
		generatedBy: raw["generated-by"] ?? "historical-regression-script",
	};
}

function loadCurrentDossier(path: string): CanonicalFactDossier {
	if (!existsSync(path)) {
		throw new Error(
			`Canonical fact dossier not found at ${path}. Run build-fact-dossier.ts first.`,
		);
	}
	return JSON.parse(readFileSync(path, "utf-8")) as CanonicalFactDossier;
}

function printReport(
	report: Awaited<ReturnType<typeof runHistoricalRegression>>["report"],
): void {
	const lines: string[] = [
		"",
		"HISTORICAL REGRESSION REPORT",
		"===========================",
		`Edition:            ${report.editionDate} (${report.editionId})`,
		`Report ID:          ${report.reportId}`,
		`Execution ID:       ${report.executionId}`,
		`Executed at:        ${report.executedAt}`,
		`Dossier version:    ${report.currentDossierVersion}`,
		`Daily window:       ${report.editionWindow.start} → ${report.editionWindow.end} (exclusive)`,
		`Historical window:  ${report.historicalWindow.editionDates[0]} … ${
			report.historicalWindow.editionDates[
				report.historicalWindow.editionDates.length - 1
			]
		} (${report.historicalWindow.days} calendar days, ${report.historicalWindow.timezone})`,
		`Final status:       ${report.finalStatus}`,
		`Candidates:         ${report.candidatesEvaluated}`,
		`Inference used:     ${report.inferenceUsed ? "yes" : "no"}`,
		"",
		"Historical edition availability:",
	];
	for (const edition of report.historicalEditions) {
		const missing =
			edition.missing.length > 0
				? ` — missing: ${edition.missing.join(", ")}`
				: "";
		lines.push(`  ${edition.editionDate}: ${edition.status}${missing}`);
	}

	const byClassification = new Map<string, number>();
	for (const relationship of report.relationships) {
		byClassification.set(
			relationship.classification,
			(byClassification.get(relationship.classification) ?? 0) + 1,
		);
	}
	lines.push("", "Relationship classifications:");
	for (const [classification, count] of [
		...byClassification.entries(),
	].sort()) {
		lines.push(`  ${classification}: ${count}`);
	}

	lines.push("", "Substantive updates:");
	if (report.substantiveUpdates.length === 0) lines.push("  none");
	for (const update of report.substantiveUpdates) {
		lines.push(
			`  [${update.previousEditionDate} → ${report.editionDate}] ${update.updateTypes.join(", ")}`,
		);
		for (const fact of update.changedFacts.slice(0, 4)) {
			lines.push(`      - ${fact}`);
		}
	}

	lines.push("", "Repeated reporting:");
	if (report.repeatedReporting.length === 0) lines.push("  none");
	for (const repeated of report.repeatedReporting) {
		lines.push(
			`  [${repeated.previousEditionDate}] ${repeated.previousCandidateId}`,
		);
	}

	lines.push("", "Potential historical omissions:");
	if (report.potentialOmissions.length === 0) lines.push("  none");
	for (const omission of report.potentialOmissions) {
		lines.push(
			`  ${omission.candidateId}: ${omission.classification} (${omission.significance})` +
				`${omission.proposedCatchUp ? " — CATCH_UP proposed" : ""}`,
		);
	}

	lines.push("", "Missing historical evidence:");
	if (report.missingHistoricalEvidence.length === 0) lines.push("  none");
	for (const entry of report.missingHistoricalEvidence) {
		lines.push(`  - ${entry}`);
	}

	lines.push("", "Unresolved classification questions:");
	if (report.unresolvedQuestions.length === 0) lines.push("  none");
	for (const question of report.unresolvedQuestions) {
		lines.push(`  - ${question}`);
	}

	lines.push("", `Content hash: ${report.contentHash}`, "");
	// eslint-disable-next-line no-console
	console.log(lines.join("\n"));
}

export async function main(
	argv: string[] = process.argv.slice(2),
): Promise<number> {
	const args = parseArgs(argv);

	// eslint-disable-next-line no-console
	console.log(`Running historical regression for edition ${args.edition}`);

	let dossier: CanonicalFactDossier;
	if (args.demo) {
		// eslint-disable-next-line no-console
		console.warn(
			"⚠  DEMO MODE: using SYNTHETIC TEST FIXTURES. Not real research findings.",
		);
		const { writeHistoricalFixtures, createCurrentEditionDossier } =
			await import("../src/lib/historical-regression/fixtures.js");
		writeHistoricalFixtures(`${DATA_DIR}/test-historical-regression`);
		dossier = createCurrentEditionDossier();
	} else {
		dossier = loadCurrentDossier(args.dossierPath);
	}

	const input: HistoricalRegressionInput = {
		editionDate: args.edition,
		canonicalDossier: dossier,
		dataDir: args.demo
			? `${DATA_DIR}/test-historical-regression`
			: args.dataDir,
		maxSemanticComparisons: args.maxSemanticComparisons,
		generatedBy: args.generatedBy,
		persist: args.persist,
		store: createHistoricalRegressionStore(args.outDir),
	};

	if (args.semantic) {
		if (hasInferenceCredentialsForRegression()) {
			input.semanticProvider = createFreeLlmSemanticComparisonProvider();
			// eslint-disable-next-line no-console
			console.log(
				"Semantic comparison enabled via configured free inference providers.",
			);
		} else {
			// eslint-disable-next-line no-console
			console.warn(
				"--semantic requested but no free inference credentials are configured; " +
					"unresolved semantic comparisons will be marked HISTORY_UNVERIFIED.",
			);
		}
	}

	const result = await runHistoricalRegression(input);
	printReport(result.report);

	if (args.persist) {
		// eslint-disable-next-line no-console
		console.log(
			`Report ${result.saveResult?.saved ? "written" : "already present"} → ${result.saveResult?.path}`,
		);
		const store = createHistoricalRegressionStore(args.outDir);
		// eslint-disable-next-line no-console
		console.log(
			`Traceability records: ${(await store.loadTraceability(args.edition)).length}`,
		);
	}

	if (result.report.finalStatus === "UNAVAILABLE") {
		// eslint-disable-next-line no-console
		console.error(
			"\n❌ No accessible historical edition could be compared; previous coverage cannot be ruled out.",
		);
		return 1;
	}

	if (result.report.finalStatus === "NOT_ASSESSABLE") {
		// eslint-disable-next-line no-console
		console.warn(
			"\n⚠️  Historical records are present but not usable for reliable comparison.",
		);
	}

	// eslint-disable-next-line no-console
	console.log("\n✅ Historical regression completed");
	return 0;
}

// Run when executed directly (not when imported by a test).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	main()
		.then((code) => {
			process.exitCode = code;
		})
		.catch((error) => {
			// eslint-disable-next-line no-console
			console.error(error instanceof Error ? error.stack : String(error));
			process.exitCode = 1;
		});
}
