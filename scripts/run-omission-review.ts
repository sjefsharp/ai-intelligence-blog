#!/usr/bin/env node
/**
 * Run Omission Review for one edition.
 *
 * Consumes the canonical fact dossier and discovery ledger, executes
 * alternative discovery strategies, and produces an auditable omission
 * review report with dossier repairs.
 *
 * Usage:
 *   pnpm exec tsx scripts/run-omission-review.ts --edition 2025-01-15
 *   pnpm exec tsx scripts/run-omission-review.ts --edition 2025-01-15 --demo
 *
 * SYNTHETIC DATA NOTICE: the repository's seeded candidates/discoveries are
 * test fixtures, not real research findings.
 */

import {
	existsSync,
	readFileSync,
	readdirSync,
	mkdirSync,
	writeFileSync,
} from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { parse, parseAllDocuments } from "yaml";

import {
	createOmissionReviewEngine,
	type OmissionReviewInput,
	type OmissionReviewResult,
} from "../src/lib/omission-review/index.js";
import { createFactDossierStore } from "../src/lib/fact-dossier/store.js";
import { createDiscoveryLedger } from "../src/lib/discovery-ledger/index.js";
import type { SourceMonitoringRecord } from "../src/lib/discovery-ledger/types.js";
import type { CanonicalFactDossier } from "../src/lib/fact-dossier/schema.js";

const DEFAULT_EDITION = "2025-01-15";
const DATA_DIR = "data";

interface RunArgs {
	edition: string;
	dossierPath: string;
	ledgerDir: string;
	outDir: string;
	demo: boolean;
	reviewer: string;
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
	return {
		edition,
		dossierPath:
			raw.dossier ??
			join(DATA_DIR, "fact-dossiers", `edition_${edition}.json`),
		ledgerDir: raw.ledger ?? join(DATA_DIR, "discovery-ledger"),
		outDir: raw.out ?? join(DATA_DIR, "omission-reviews"),
		demo: raw.demo === "true",
		reviewer: raw.reviewer ?? "omission-review-script",
	};
}

function loadSourceRegistry(path: string) {
	if (!existsSync(path)) return new Map();
	const doc = parse(readFileSync(path, "utf-8")) as {
		sources?: Array<Record<string, unknown>>;
	};
	const map = new Map();
	for (const entry of doc.sources ?? []) {
		const id = String(entry.id);
		map.set(id, {
			id,
			url: String(entry.url),
			tier: entry.tier as 1 | 2 | 3,
			type: String(entry.type),
			ringAffinity: Array.isArray(entry.ringAffinity)
				? (entry.ringAffinity as unknown[]).filter(
						(v): v is 1 | 2 | 3 => v === 1 || v === 2 || v === 3,
					)
				: [1],
			researchDomains: Array.isArray(entry.researchDomains)
				? entry.researchDomains.map(String)
				: [],
			sourceFamily: String(entry.sourceFamily || "developer-tools"),
			organization: String(entry.organization || "Unknown"),
			criticality:
				(entry.criticality as
					"mandatory" | "high" | "standard" | "supplementary") ||
				"standard",
			cadence:
				(entry.cadence as
					| "continuous"
					| "daily"
					| "weekly"
					| "bi-weekly"
					| "monthly"
					| "quarterly"
					| "manual") || "daily",
		});
	}
	return map;
}

async function loadLedgerRecords(
	ledgerDir: string,
	editionDate: string,
): Promise<SourceMonitoringRecord[]> {
	if (!existsSync(ledgerDir)) return [];
	const ledger = createDiscoveryLedger({ ledgerDir });
	const entries = await ledger.query({ editionDate });
	return entries.flatMap((e) => e.sourceRecords);
}

async function loadPreviousDossiers(
	dataDir: string,
	currentEdition: string,
): Promise<CanonicalFactDossier[]> {
	const dossiers: CanonicalFactDossier[] = [];
	const dossierDir = join(dataDir, "fact-dossiers");
	if (!existsSync(dossierDir)) return dossiers;

	for (const file of readdirSync(dossierDir)) {
		if (file.startsWith(currentEdition)) continue;
		if (!file.endsWith(".json")) continue;
		const content = readFileSync(join(dossierDir, file), "utf-8");
		try {
			dossiers.push(JSON.parse(content));
		} catch {
			// Skip invalid
		}
	}
	return dossiers;
}

async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
	const args = parseArgs(argv);

	console.log(`Running Omission Review for edition ${args.edition}`);

	// Load canonical fact dossier
	let dossier: CanonicalFactDossier;
	if (args.demo) {
		console.warn(
			"⚠  DEMO MODE: using SYNTHETIC TEST FIXTURES. Not real research findings.",
		);
		const { createRepresentativeFixtures, createContext } =
			await import("../src/lib/fact-dossier/fixtures.js");
		const { buildDossier } =
			await import("../src/lib/fact-dossier/consolidator.js");

		const fixtures = createRepresentativeFixtures();
		const inputs = fixtures.map((f) => f.input);
		const context = createContext({ editionDate: args.edition });
		dossier = buildDossier(args.edition, inputs, context);
	} else {
		if (!existsSync(args.dossierPath)) {
			console.error(
				`Canonical fact dossier not found at ${args.dossierPath}`,
			);
			console.error(
				"Run build-fact-dossier.ts first to generate the dossier.",
			);
			return 1;
		}
		dossier = JSON.parse(readFileSync(args.dossierPath, "utf-8"));
	}

	// Load discovery ledger records
	const ledgerRecords = await loadLedgerRecords(args.ledgerDir, args.edition);
	console.log(`Loaded ${ledgerRecords.length} discovery ledger records`);

	// Load source registry
	const sourceRegistry = loadSourceRegistry(join(DATA_DIR, "sources.yml"));
	console.log(`Loaded ${sourceRegistry.size} source registry entries`);

	// Load previous edition dossiers for historical comparison
	const previousDossiers = await loadPreviousDossiers(DATA_DIR, args.edition);
	console.log(`Loaded ${previousDossiers.length} previous edition dossiers`);

	// Run omission review
	const engine = createOmissionReviewEngine(args.outDir);

	const input: OmissionReviewInput = {
		editionDate: args.edition,
		canonicalDossier: dossier,
		discoveryLedgerRecords: ledgerRecords,
		sourceRegistry,
		previousEditionDossiers: previousDossiers,
		reviewerId: args.reviewer,
	};

	console.log("Executing omission review strategies...");
	const result: OmissionReviewResult = await engine.execute(input);

	// Output summary
	const report = result.report;
	console.log("\n" + "=".repeat(60));
	console.log("OMISSION REVIEW REPORT");
	console.log("=".repeat(60));
	console.log(`Edition:           ${report.context.editionDate}`);
	console.log(`Execution ID:      ${report.context.executionId}`);
	console.log(`Initial Candidates: ${report.initialCandidateCount}`);
	console.log(
		`Strategies Executed: ${report.alternativeStrategiesExecuted.filter((s) => s.executed).length}/${report.alternativeStrategiesExecuted.length}`,
	);
	console.log(
		`New Candidates Found: ${report.newlyDiscoveredCandidates.length}`,
	);
	console.log(
		`  Critical Omissions: ${report.newlyDiscoveredCandidates.filter((c) => c.omissionClassification === "CRITICAL_OMISSION").length}`,
	);
	console.log(
		`  Material Omissions: ${report.newlyDiscoveredCandidates.filter((c) => c.omissionClassification === "MATERIAL_OMISSION").length}`,
	);
	console.log(
		`  Covered:            ${report.newlyDiscoveredCandidates.filter((c) => c.omissionClassification === "COVERED").length}`,
	);
	console.log(`  Substantive Updates: ${report.substantiveUpdates.length}`);
	console.log(
		`  Duplicates:         ${report.newlyDiscoveredCandidates.filter((c) => c.omissionClassification === "DUPLICATE").length}`,
	);
	console.log(
		`  Not New:            ${report.newlyDiscoveredCandidates.filter((c) => c.omissionClassification === "NOT_NEW").length}`,
	);
	console.log(
		`  Insufficient Evidence: ${report.newlyDiscoveredCandidates.filter((c) => c.omissionClassification === "INSUFFICIENT_EVIDENCE").length}`,
	);
	console.log(
		`  Coverage Gaps:      ${report.newlyDiscoveredCandidates.filter((c) => c.omissionClassification === "COVERAGE_GAP").length}`,
	);
	console.log(`Substantive Updates: ${report.substantiveUpdates.length}`);
	console.log(`Coverage Gaps:       ${report.remainingCoverageGaps.length}`);
	console.log(
		`  Critical:          ${report.remainingCoverageGaps.filter((g) => g.significance === "critical").length}`,
	);
	console.log(
		`  High:              ${report.remainingCoverageGaps.filter((g) => g.significance === "high").length}`,
	);
	console.log(
		`  Medium:            ${report.remainingCoverageGaps.filter((g) => g.significance === "medium").length}`,
	);
	console.log(
		`  Low:               ${report.remainingCoverageGaps.filter((g) => g.significance === "low").length}`,
	);
	console.log(`Verification Outcomes:`);
	console.log(
		`  Verified & Added:  ${report.verificationOutcomes.verifiedAndAdded}`,
	);
	console.log(
		`  Verified & Rejected: ${report.verificationOutcomes.verifiedAndRejected}`,
	);
	console.log(
		`  Evidence Unavailable: ${report.verificationOutcomes.evidenceUnavailable}`,
	);
	console.log(
		`  Unresolved:        ${report.verificationOutcomes.unresolved}`,
	);
	console.log(`Final Dossier:       ${report.finalDossierVersion}`);
	console.log(`Report Saved:        ${args.outDir}`);
	console.log("=".repeat(60));

	// Check for unresolved critical omissions
	const criticalUnresolved = report.newlyDiscoveredCandidates.filter(
		(c) =>
			c.omissionClassification === "CRITICAL_OMISSION" &&
			(c.repairStatus === "UNRESOLVED" ||
				c.repairStatus === "EVIDENCE_UNAVAILABLE"),
	).length;

	if (criticalUnresolved > 0) {
		console.error(
			`\n❌ ${criticalUnresolved} CRITICAL OMISSION(S) REMAIN UNRESOLVED`,
		);
		console.error(
			"Discovery cannot be claimed complete per acceptance criteria.",
		);
		return 1;
	}

	// Check for blocking coverage gaps
	const blockingGaps = report.remainingCoverageGaps.filter(
		(g) => g.significance === "critical",
	).length;
	if (blockingGaps > 0) {
		console.warn(
			`\n⚠️  ${blockingGaps} COVERAGE GAP(S) BLOCK REVIEW COMPLETENESS`,
		);
		console.warn(
			"Review completeness marked as UNVERIFIED per cost/execution constraints.",
		);
	}

	console.log("\n✅ Omission review completed successfully");
	return 0;
}

// Run when executed directly
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	main()
		.then((code) => {
			process.exitCode = code;
		})
		.catch((error) => {
			console.error(error instanceof Error ? error.stack : String(error));
			process.exitCode = 1;
		});
}
