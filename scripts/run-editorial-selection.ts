#!/usr/bin/env node
/**
 * Run the editorial ranking and selection stage for one edition.
 *
 * Consumes the canonical fact dossier, the omission review report and the
 * seven-day historical regression report, then produces the structured
 * editorial selection manifest for downstream publication generators.
 *
 * Usage:
 *   pnpm exec tsx scripts/run-editorial-selection.ts --edition 2025-01-15
 *   pnpm exec tsx scripts/run-editorial-selection.ts --edition 2025-01-15 --demo
 *   pnpm exec tsx scripts/run-editorial-selection.ts --edition 2025-01-15 --semantic
 *   pnpm exec tsx scripts/run-editorial-selection.ts --edition 2025-01-15 --no-persist
 *
 * ⚠️  The stage never re-implements source retrieval, temporal classification,
 * evidence verification, omission detection or historical regression. It does
 * not generate articles or publish content.
 */

import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

import {
	runEditorialSelection,
	createEditorialSelectionStore,
	createFreeLlmEditorialSemanticProvider,
	type EditorialSelectionInput,
} from "../src/lib/editorial-selection/index.js";
import { hasInferenceCredentials } from "../src/lib/fact-dossier/enrichment.js";
import { createHistoricalRegressionStore } from "../src/lib/historical-regression/index.js";
import type { CanonicalFactDossier } from "../src/lib/fact-dossier/schema.js";
import type { OmissionReviewReport } from "../src/lib/omission-review/types.js";
import type { HistoricalRegressionReport } from "../src/lib/historical-regression/schema.js";

const DEFAULT_EDITION = "2025-01-15";
const DATA_DIR = "data";

interface RunArgs {
	edition: string;
	dossierPath: string;
	omissionReviewPath: string | null;
	historicalRegressionPath: string | null;
	dataDir: string;
	outDir: string;
	demo: boolean;
	semantic: boolean;
	persist: boolean;
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
	const demo = raw.demo === "true";
	return {
		edition,
		dossierPath:
			raw.dossier ??
			join(DATA_DIR, "fact-dossiers", `edition_${edition}.json`),
		omissionReviewPath: raw["omission-review"] ?? null,
		historicalRegressionPath: raw["historical-regression"] ?? null,
		dataDir: raw["data-dir"] ?? DATA_DIR,
		// Synthetic demo output must never land in a real data path.
		outDir:
			raw.out ??
			(demo
				? join(DATA_DIR, "test-editorial-selection")
				: join(DATA_DIR, "editorial-selection")),
		demo,
		semantic: raw.semantic === "true",
		persist: raw["no-persist"] !== "true",
		generatedBy: raw["generated-by"] ?? "editorial-selection-script",
	};
}

function loadJson<T>(path: string): T {
	return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function findLatestReport(
	dir: string,
	edition: string,
	prefix: string,
): string | null {
	if (!existsSync(dir)) return null;
	const matches = readdirSync(dir)
		.filter(
			(file) => file.startsWith(`${edition}_`) && file.endsWith(".json"),
		)
		.sort();
	if (matches.length === 0) return null;
	return join(dir, matches[matches.length - 1]);
}

function printReport(
	manifest: Awaited<ReturnType<typeof runEditorialSelection>>["manifest"],
): void {
	const lines: string[] = [
		"",
		"EDITORIAL SELECTION MANIFEST",
		"============================",
		`Edition:            ${manifest.editionDate} (${manifest.editionId})`,
		`Manifest ID:        ${manifest.manifestId}`,
		`Generated at:       ${manifest.generatedAt}`,
		`Dossier version:    ${manifest.inputDossier.dossierId}`,
		`Dossier hash:       ${manifest.inputDossier.contentHash}`,
		`Candidates:         ${manifest.candidates.length}`,
		`Stories selected:   ${manifest.stories.length}`,
		`Readiness:          ${manifest.readinessStatus}`,
		`Inference used:     ${manifest.inferenceUsed ? "yes" : "no"}`,
		"",
		"Selected stories (publication order):",
	];

	if (manifest.stories.length === 0) {
		lines.push("  none — no candidate met the selection threshold");
	}
	for (const story of manifest.stories) {
		const merged =
			story.mergedCandidateIds.length > 0
				? ` (+${story.mergedCandidateIds.length} merged)`
				: "";
		lines.push(
			`  ${story.order}. [${story.decision}] ${story.candidateId} ` +
				`materiality=${story.materialityScore.toFixed(3)} depth=${story.recommendedDepth}${merged}`,
		);
		lines.push(`      ${story.title}`);
		if (story.caveats.length > 0) {
			lines.push(`      caveats: ${story.caveats.length}`);
		}
	}

	lines.push("", "Decisions:");
	const byDecision = new Map<string, number>();
	for (const candidate of manifest.candidates) {
		byDecision.set(
			candidate.decision,
			(byDecision.get(candidate.decision) ?? 0) + 1,
		);
	}
	for (const [decision, count] of [...byDecision.entries()].sort()) {
		lines.push(`  ${decision}: ${count}`);
	}

	lines.push("", "Concentration & blind-spot review:");
	for (const check of manifest.concentrationReview.consistencyChecks) {
		lines.push(`  [${check.passed ? "PASS" : "FAIL"}] ${check.check}`);
	}
	if (manifest.concentrationReview.findings.length > 0) {
		lines.push("", "  Findings:");
		for (const finding of manifest.concentrationReview.findings) {
			lines.push(`    - ${finding}`);
		}
	}

	if (manifest.caveats.length > 0) {
		lines.push("", "Caveats:");
		for (const caveat of manifest.caveats) {
			lines.push(`  - ${caveat}`);
		}
	}
	if (manifest.unresolvedIssues.length > 0) {
		lines.push("", "Unresolved issues:");
		for (const issue of manifest.unresolvedIssues) {
			lines.push(`  - ${issue}`);
		}
	}

	lines.push("", `Content hash: ${manifest.contentHash}`, "");
	// eslint-disable-next-line no-console
	console.log(lines.join("\n"));
}

export async function main(
	argv: string[] = process.argv.slice(2),
): Promise<number> {
	const args = parseArgs(argv);

	// eslint-disable-next-line no-console
	console.log(`Running editorial selection for edition ${args.edition}`);

	let dossier: CanonicalFactDossier;
	let omissionReview: OmissionReviewReport | null = null;
	let historicalRegression: HistoricalRegressionReport | null = null;

	if (args.demo) {
		// eslint-disable-next-line no-console
		console.warn(
			"⚠  DEMO MODE: using SYNTHETIC TEST FIXTURES. Not real research findings.",
		);
		const { combinedEdition } =
			await import("../src/lib/editorial-selection/fixtures.js");
		const fixture = combinedEdition();
		dossier = fixture.dossier;
		omissionReview = fixture.omissionReview;
		historicalRegression = fixture.historicalRegression;
	} else {
		if (!existsSync(args.dossierPath)) {
			// eslint-disable-next-line no-console
			console.error(
				`Canonical fact dossier not found at ${args.dossierPath}. Run build-fact-dossier.ts first.`,
			);
			return 1;
		}
		dossier = loadJson<CanonicalFactDossier>(args.dossierPath);

		const omissionPath =
			args.omissionReviewPath ??
			findLatestReport(
				join(args.dataDir, "omission-reviews"),
				args.edition,
				"omission",
			);
		if (omissionPath && existsSync(omissionPath)) {
			omissionReview = loadJson<OmissionReviewReport>(omissionPath);
		}

		const regressionPath =
			args.historicalRegressionPath ??
			findLatestReport(
				join(args.dataDir, "historical-regression"),
				args.edition,
				"regression",
			);
		if (regressionPath && existsSync(regressionPath)) {
			historicalRegression =
				loadJson<HistoricalRegressionReport>(regressionPath);
		} else {
			const store = createHistoricalRegressionStore(
				join(args.dataDir, "historical-regression"),
			);
			historicalRegression = await store.loadReport(args.edition);
		}
	}

	const input: EditorialSelectionInput = {
		editionDate: args.edition,
		canonicalDossier: dossier,
		omissionReview,
		historicalRegression,
		dataDir: args.dataDir,
		generatedBy: args.generatedBy,
		persist: args.persist,
		store: createEditorialSelectionStore(args.outDir),
	};

	if (args.semantic) {
		if (hasInferenceCredentials()) {
			input.semanticProvider = createFreeLlmEditorialSemanticProvider();
			// eslint-disable-next-line no-console
			console.log(
				"Model-assisted internal consistency check enabled via configured free providers.",
			);
		} else {
			// eslint-disable-next-line no-console
			console.warn(
				"--semantic requested but no free inference credentials are configured; " +
					"deterministic findings will be preserved without a model-assisted review.",
			);
		}
	}

	const result = await runEditorialSelection(input);
	printReport(result.manifest);

	if (args.persist) {
		// eslint-disable-next-line no-console
		console.log(
			`Manifest ${result.saveResult?.saved ? "written" : "already present"} → ${result.saveResult?.path}`,
		);
	}

	if (result.manifest.readinessStatus === "BLOCKED") {
		// eslint-disable-next-line no-console
		console.error(
			"\n❌ Editorial selection is BLOCKED: consequential candidates require an explicit editorial decision.",
		);
		return 1;
	}

	// eslint-disable-next-line no-console
	console.log("\n✅ Editorial selection completed");
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
