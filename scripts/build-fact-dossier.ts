#!/usr/bin/env node
/**
 * Build the canonical fact dossier for one edition.
 *
 * Consumes earlier pipeline results (candidates, discovery records, verified
 * claims, source registry, research taxonomy) and persists one authoritative
 * dossier per edition. Deterministic by default; optional model-assisted
 * enrichment is opt-in and never required.
 *
 * Usage:
 *   pnpm exec tsx scripts/build-fact-dossier.ts --edition 2025-01-15
 *   pnpm exec tsx scripts/build-fact-dossier.ts --edition 2025-01-15 --enrich
 *
 * SYNTHETIC DATA NOTICE: the repository's seeded candidates/discoveries are
 * test fixtures, not real research findings.
 */

import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { parse, parseAllDocuments } from "yaml";

import {
	buildDossier,
	type CandidateConsolidationInput,
	type ConsolidationContext,
	type PreviousEditionCandidateSummary,
	type PreviousEditionIndex,
	type SourceRegistryEntry,
} from "../src/lib/fact-dossier/consolidator.js";
import { createFactDossierStore } from "../src/lib/fact-dossier/store.js";
import { validateFactDossier } from "../src/lib/fact-dossier/validate.js";
import {
	enrichDossier,
	createFreeLlmEnrichmentProvider,
	hasInferenceCredentials,
} from "../src/lib/fact-dossier/enrichment.js";
import { getEditorialWindow } from "../src/lib/editorial-window.js";
import { EvidenceVerificationStore } from "../src/lib/evidence-verification/index.js";
import type {
	CandidateNewsItem,
	DiscoveredItem,
} from "../src/lib/signal-desk.js";
import type { ClaimVerificationRecord } from "../src/lib/evidence-verification/types.js";

const DEFAULT_EDITION = "2025-01-15";
const DATA_DIR = "data";

interface BuildArgs {
	edition: string;
	candidatesPath: string;
	discoveredPath: string;
	verificationDir: string;
	outDir: string;
	enrich: boolean;
	demo: boolean;
	generatedBy: string;
}

function parseArgs(argv: string[]): BuildArgs {
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
		candidatesPath:
			raw.candidates ?? join(DATA_DIR, "candidates", `${edition}.jsonl`),
		discoveredPath:
			raw.discovered ?? join(DATA_DIR, "discovered", `${edition}.jsonl`),
		verificationDir:
			raw["verification-dir"] ?? join(DATA_DIR, "evidence-verification"),
		outDir: raw.out ?? join(DATA_DIR, "fact-dossiers"),
		enrich: raw.enrich === "true",
		demo: raw.demo === "true",
		generatedBy: raw["generated-by"] ?? "build-fact-dossier-script",
	};
}

function loadJsonl(path: string): Record<string, unknown>[] {
	if (!existsSync(path)) return [];
	const content = readFileSync(path, "utf-8");
	return content
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => JSON.parse(line) as Record<string, unknown>);
}

function loadSourceRegistry(path: string): Map<string, SourceRegistryEntry> {
	if (!existsSync(path)) return new Map();
	const doc = parse(readFileSync(path, "utf-8")) as {
		sources?: Array<Record<string, unknown>>;
	};
	const map = new Map<string, SourceRegistryEntry>();
	for (const entry of doc.sources ?? []) {
		const id = String(entry.id);
		map.set(id, {
			id,
			tier: entry.tier as 1 | 2 | 3,
			type: String(entry.type),
			url: String(entry.url),
			title: entry.title ? String(entry.title) : undefined,
			status: entry.status ? String(entry.status) : undefined,
			ringAffinity: Array.isArray(entry.ringAffinity)
				? (entry.ringAffinity as unknown[]).filter(
						(v): v is 1 | 2 | 3 => v === 1 || v === 2 || v === 3,
					)
				: undefined,
		});
	}
	return map;
}

function loadTaxonomyDomains(path: string): Set<string> {
	if (!existsSync(path)) {
		return new Set([
			"agentic-ai-software-engineering",
			"models-inference-scientific",
			"architecture-security-governance",
			"enterprise-adoption-organizational",
			"economics-business-impact",
			"independent-research-advisory",
		]);
	}
	const content = readFileSync(path, "utf-8");
	const docs = parseAllDocuments(content);
	const doc = docs[0]?.toJS() as
		{ domains?: Array<{ id: string }> } | undefined;
	return new Set((doc?.domains ?? []).map((d) => d.id));
}

function loadPreviousEditions(
	dataDir: string,
	currentEdition: string,
): PreviousEditionIndex {
	const availableEditionDates = new Set<string>();
	const candidates: PreviousEditionCandidateSummary[] = [];
	const candidatesDir = join(dataDir, "candidates");
	if (!existsSync(candidatesDir)) {
		return { availableEditionDates, candidates };
	}
	for (const file of readdirSync(candidatesDir)) {
		const match = file.match(/^(\d{4}-\d{2}-\d{2})\.jsonl$/);
		if (!match) continue;
		const editionDate = match[1];
		availableEditionDates.add(editionDate);
		const records = loadJsonl(
			join(candidatesDir, file),
		) as unknown as CandidateNewsItem[];
		for (const record of records) {
			candidates.push({
				candidateId: record.id,
				editionDate,
				title: record.title,
				sourceIds: record.sourceIds,
			});
		}
	}
	availableEditionDates.delete(currentEdition);
	return { availableEditionDates, candidates };
}

async function loadClaims(
	verificationDir: string,
): Promise<Map<string, ClaimVerificationRecord[]>> {
	const byCandidate = new Map<string, ClaimVerificationRecord[]>();
	if (!existsSync(verificationDir)) return byCandidate;
	const store = new EvidenceVerificationStore(verificationDir);
	const records = await store.query({ limit: 10000 });
	for (const record of records) {
		const list = byCandidate.get(record.candidateId) ?? [];
		list.push(record);
		byCandidate.set(record.candidateId, list);
	}
	return byCandidate;
}

function printSummary(
	dossier: ReturnType<typeof buildDossier>,
	validationErrors: string[],
): void {
	const summary = dossier.editionSummary;
	const lines = [
		"",
		"Canonical Fact Dossier",
		"=====================",
		`Edition:        ${dossier.editionDate} (${dossier.editionId})`,
		`Status:         ${dossier.status}`,
		`Candidates:     ${summary.totalCandidates}`,
		`Claims:         ${summary.totalClaims}`,
		`Temporal:       ${JSON.stringify(summary.byTemporalEligibility)}`,
		`Classifications:${JSON.stringify(summary.byEvidenceClassification)}`,
		`Domains:        ${JSON.stringify(summary.byResearchDomain)}`,
		`Evidence gaps:  ${summary.candidatesWithEvidenceGaps} candidate(s)`,
		`Counterevidence:${summary.claimsWithCounterevidence} claim(s)`,
		`Uncertainty:    ${dossier.uncertaintyRegister.length} registered`,
		`Content hash:   ${dossier.contentHash}`,
		`Inference used: ${dossier.processingAudit.inferenceUsed ? "yes" : "no"}`,
		"",
	];
	if (dossier.processingAudit.failedCandidateIds.length > 0) {
		lines.push(
			`Failed candidates: ${dossier.processingAudit.failedCandidateIds.length}`,
			...dossier.processingAudit.steps
				.filter((step) => step.status === "failed" && step.error)
				.map((step) => `  - ${step.step}: ${step.error}`),
			"",
		);
	}
	if (validationErrors.length > 0) {
		lines.push(
			"Validation errors:",
			...validationErrors.map((e) => `  - ${e}`),
			"",
		);
	} else {
		lines.push("Validation:     PASS", "");
	}
	// eslint-disable-next-line no-console
	console.log(lines.join("\n"));
}

export async function main(
	argv: string[] = process.argv.slice(2),
): Promise<number> {
	const args = parseArgs(argv);

	const sourceRegistry = loadSourceRegistry(join(DATA_DIR, "sources.yml"));
	const taxonomyDomains = loadTaxonomyDomains(
		join(DATA_DIR, "research-taxonomy.yml"),
	);
	const previousEditions = loadPreviousEditions(DATA_DIR, args.edition);

	let inputs: CandidateConsolidationInput[];

	if (args.demo) {
		// eslint-disable-next-line no-console
		console.warn(
			"⚠  DEMO MODE: using SYNTHETIC TEST FIXTURES. Not real research findings.",
		);
		const { createRepresentativeFixtures } =
			await import("../src/lib/fact-dossier/fixtures.js");
		inputs = createRepresentativeFixtures().map((fixture) => fixture.input);
	} else {
		const candidates = loadJsonl(
			args.candidatesPath,
		) as unknown as CandidateNewsItem[];
		const discoveries = loadJsonl(
			args.discoveredPath,
		) as unknown as DiscoveredItem[];
		const claimsByCandidate = await loadClaims(args.verificationDir);

		if (candidates.length === 0) {
			// eslint-disable-next-line no-console
			console.warn(
				`No candidates found at ${args.candidatesPath}; nothing to consolidate.`,
			);
			return 0;
		}

		inputs = candidates.map((candidate) => ({
			candidate,
			discovery: discoveries.find((d) => d.id === candidate.discoveryId),
			claims: claimsByCandidate.get(candidate.id) ?? [],
		}));
	}

	const context: ConsolidationContext = {
		editionDate: args.edition,
		editionWindow: getEditorialWindow(args.edition),
		taxonomyDomains,
		sourceRegistry,
		previousEditions,
		generatedBy: args.generatedBy,
	};

	let dossier = buildDossier(args.edition, inputs, context);

	if (args.enrich) {
		if (hasInferenceCredentials()) {
			dossier = await enrichDossier(
				dossier,
				createFreeLlmEnrichmentProvider(),
			);
		} else {
			// eslint-disable-next-line no-console
			console.warn(
				"--enrich requested but no inference credentials configured; deterministic consolidation preserved.",
			);
			dossier = await enrichDossier(dossier, undefined);
		}
	}

	const store = createFactDossierStore(args.outDir);
	const saveResult = await store.save(dossier);
	const validation = validateFactDossier(dossier);

	printSummary(dossier, validation.errors);
	// eslint-disable-next-line no-console
	console.log(
		`Saved: ${saveResult.saved ? saveResult.reason : "no change"} → ${saveResult.path}`,
	);

	return validation.valid ? 0 : 1;
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
