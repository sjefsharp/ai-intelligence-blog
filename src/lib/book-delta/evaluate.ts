/**
 * Book Delta — Workflow Entry Point
 *
 * Implements the `evaluateBookDelta` entry point referenced by the workflow
 * orchestrator graph (`G03_BOOK_DELTA_EVALUATION`) and the standalone CLI
 * (`scripts/run-book-delta.ts`).
 *
 * The entry point loads only repository-local artifacts, runs the deterministic
 * evidence-based evaluation, persists the proposal register, and reports
 * inspectable output paths. It never modifies canonical terminology,
 * architecture principles, the fact dossier, or editorial decisions.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
	createFreeLLMClient,
	hasInferenceCredentials,
	type FreeLLMClient,
} from "../free-llm-client.js";
import {
	CanonicalFactDossierSchema,
	type CanonicalFactDossier,
} from "../fact-dossier/schema.js";
import {
	TerminologyEntrySchema,
	type TerminologyEntry,
} from "../thesaurus/schema.js";
import {
	ArchitecturePrincipleSchema,
	type ArchitecturePrinciple,
} from "../architecture-principles/schema.js";
import { BookDeltaEngine, type BookDeltaEngineConfig } from "./engine.js";
import {
	getArtifactPath,
	getEvaluationResultPath,
	getKnowledgeContinuityResultPath,
	persistBookDeltaArtifact,
	persistBookDeltaEvaluationResult,
	persistBookDeltaKnowledgeContinuityResult,
} from "./store.js";

const __dirname = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
	"..",
);

/** Input contract consumed from the workflow orchestrator stage context. */
export interface BookDeltaStageInput {
	editionDate: string;
	"canonical-fact-dossier"?: string;
	"resolved-editorial-manifest"?: string;
	thesaurus?: string;
	"architecture-principles"?: string;
	"book-delta"?: string;
	llmClient?: FreeLLMClient;
	cliOptions?: { mode?: string };
}

/** Output contract returned to the workflow orchestrator. */
export interface BookDeltaStageOutput {
	outputArtifacts: Array<{
		artifactId: string;
		path: string;
		description: string;
	}>;
	resourcesUsed: {
		modelRequests?: number;
		tokensUsed?: number;
		durationMs?: number;
	};
	evaluationPerformed: boolean;
	note: string;
}

/** Read and parse a JSON file, returning null when absent or unreadable. */
function readJsonFile(path: string): unknown | null {
	try {
		return JSON.parse(readFileSync(path, "utf8")) as unknown;
	} catch {
		return null;
	}
}

/** Extract candidate findings from the fact dossier. */
function loadFactDossier(
	editionDate: string,
	providedPath?: string,
): CanonicalFactDossier {
	const candidates = [
		providedPath,
		join(__dirname, "data", "fact-dossiers", `edition_${editionDate}.json`),
		join(
			__dirname,
			"data",
			"fact-dossiers-real",
			`edition_${editionDate}.json`,
		),
	].filter((p): p is string => typeof p === "string");

	let lastError = "no candidate path available";
	for (const path of candidates) {
		const raw = readJsonFile(path);
		if (raw === null) {
			lastError = `unreadable: ${path}`;
			continue;
		}
		const parsed = CanonicalFactDossierSchema.safeParse(raw);
		if (parsed.success) return parsed.data;
		lastError = `schema validation failed for ${path}: ${parsed.error.issues
			.map((i) => `${i.path.join(".")}: ${i.message}`)
			.join("; ")}`;
	}

	throw new Error(
		`Book Delta could not load the canonical fact dossier for ${editionDate} (${lastError}).`,
	);
}

/** Recursively drop properties whose value is null. The canonical thesaurus
 * artifact records absent optional fields as null, while the schema models
 * them as absent (undefined). This is a read-only normalization for lenient
 * loading — it is never written back to the register. */
function stripNullValues(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(stripNullValues);
	if (value !== null && typeof value === "object") {
		const result: Record<string, unknown> = {};
		for (const [key, entry] of Object.entries(value)) {
			if (entry !== null) result[key] = stripNullValues(entry);
		}
		return result;
	}
	return value;
}

/** Load thesaurus entries leniently; invalid entries are skipped, never repaired. */
export function loadThesaurusEntries(
	providedPath?: string,
): TerminologyEntry[] {
	const candidates = [
		providedPath,
		join(__dirname, "data", "thesaurus", "thesaurus-artifact.json"),
		join(
			__dirname,
			"data",
			"thesaurus",
			"artifacts",
			"thesart_a1b2c3d4e5f67890.json",
		),
	].filter((p): p is string => typeof p === "string");

	for (const path of candidates) {
		const raw = readJsonFile(path);
		if (raw === null) continue;
		const container = Array.isArray(raw)
			? raw
			: (raw as { entries?: unknown[] }).entries;
		if (!Array.isArray(container)) continue;

		const entries: TerminologyEntry[] = [];
		for (const item of container) {
			const parsed = TerminologyEntrySchema.safeParse(
				stripNullValues(item),
			);
			if (parsed.success) entries.push(parsed.data);
		}
		if (entries.length > 0) return entries;
	}

	return [];
}

/** Load architecture principles leniently; invalid records are skipped. */
function loadArchitecturePrinciples(
	providedPath?: string,
): ArchitecturePrinciple[] {
	const candidates = [
		providedPath,
		join(__dirname, "data", "architecture-principles", "apr-artifact.json"),
		join(
			__dirname,
			"data",
			"architecture-principles",
			"architecture-principles.json",
		),
	].filter((p): p is string => typeof p === "string");

	for (const path of candidates) {
		const raw = readJsonFile(path);
		if (raw === null) continue;
		const container = Array.isArray(raw)
			? raw
			: (raw as { principles?: unknown[] }).principles;
		if (!Array.isArray(container)) continue;

		const principles: ArchitecturePrinciple[] = [];
		for (const item of container) {
			const parsed = ArchitecturePrincipleSchema.safeParse(
				stripNullValues(item),
			);
			if (parsed.success) principles.push(parsed.data);
		}
		if (principles.length > 0) return principles;
	}

	return [];
}

/**
 * Workflow entry point for the Book Delta stage.
 *
 * Deterministic evaluation always runs. Model-assisted discovery is enabled
 * only when free-tier credentials are configured; inference failures fall back
 * to deterministic evaluation and are reported honestly.
 */
export async function evaluateBookDelta(
	input: BookDeltaStageInput,
): Promise<BookDeltaStageOutput> {
	const startedAt = Date.now();
	const editionDate = input.editionDate;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(editionDate)) {
		throw new Error(
			`Book Delta requires a valid edition date (YYYY-MM-DD), received: ${editionDate}`,
		);
	}

	const factDossier = loadFactDossier(
		editionDate,
		input["canonical-fact-dossier"],
	);
	const thesaurusEntries = loadThesaurusEntries(input.thesaurus);
	const architecturePrinciples = loadArchitecturePrinciples(
		input["architecture-principles"],
	);

	const useModel = Boolean(input.llmClient) || hasInferenceCredentials();
	const llmClient =
		input.llmClient ?? (useModel ? createFreeLLMClient() : undefined);

	const config: BookDeltaEngineConfig = {
		editionDate,
		factDossier,
		thesaurusEntries,
		architecturePrinciples,
		llmClient,
		enableModelAssistedDiscovery: useModel,
		enableTargetDocumentInspection: true,
		minConfidenceForProposal: 0.65,
		maxProposalsPerEdition: 10,
	};

	const engine = new BookDeltaEngine(config);
	const result = await engine.run();

	// Persist Book Delta artifacts to disk for evidence loader
	await persistBookDeltaArtifact(editionDate, result.artifact);
	await persistBookDeltaEvaluationResult(
		editionDate,
		result.evaluationResult,
	);
	await persistBookDeltaKnowledgeContinuityResult(
		editionDate,
		result.knowledgeContinuityResult,
	);

	return {
		outputArtifacts: [
			{
				artifactId: "book-delta",
				path: getArtifactPath(editionDate),
				description: "Complete derived Book Delta proposal register",
			},
			{
				artifactId: "book-delta-evaluation",
				path: getEvaluationResultPath(editionDate),
				description:
					"Structured Book Delta evaluation result for research-audit integration",
			},
			{
				artifactId: "book-delta-knowledge-continuity",
				path: getKnowledgeContinuityResultPath(editionDate),
				description:
					"Book Delta contribution to the Knowledge Continuity gate",
			},
		],
		resourcesUsed: {
			modelRequests: result.modelRequests,
			tokensUsed: result.tokensUsed,
			durationMs: Date.now() - startedAt,
		},
		evaluationPerformed: result.evaluationResult.evaluationPerformed,
		note:
			`${result.evaluationResult.newProposals.length} new proposal(s), ` +
			`${result.evaluationResult.updatedHistoricalProposals.length} updated, ` +
			`${result.evaluationResult.duplicateProposalsIdentified.length} duplicate(s); ` +
			`inference used: ${result.evaluationResult.inferenceUsed} ` +
			`(${result.modelRequests} request(s), ${result.tokensUsed} token(s)); ` +
			`dropped by per-edition cap: ${result.droppedCandidateCount}`,
	};
}
