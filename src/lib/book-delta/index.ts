/**
 * Book Delta — Module Exports
 *
 * Evidence-based proposal mechanism for improving educational knowledge and
 * explanatory material based on verified daily research findings.
 *
 * This module implements the Book Delta capability as specified in the
 * AI Intelligence Publication Contract. It is a proposal-generation and
 * review capability, NOT:
 * - A separate source of factual truth
 * - A replacement for the thesaurus
 * - A mechanism for automatically modifying architecture principles
 * - An autonomous book editor
 */

export * from "./schema.js";
export * from "./store.js";
export * from "./engine.js";
export * from "./validate.js";
export * from "./fixtures.js";
export * from "./evaluate.js";
export * from "./audit-renderer.js";

import { createBookDeltaEngine } from "./engine.js";
import type { BookDeltaEngineConfig } from "./engine.js";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { randomBytes, createHash } from "crypto";

/**
 * Evaluate Book Delta (G03_BOOK_DELTA_EVALUATION).
 * Entry point for workflow stage G03.
 * Generates evidence-based proposals for educational knowledge improvement.
 */
export async function evaluateBookDelta(input: any): Promise<any> {
	const editionDate = input.editionDate;

	// Load fact dossier
	const factDossierArtifact =
		input["canonical-fact-dossier"] || input.canonicalFactDossier;
	let factDossier: any = {
		candidates: [],
		editionDate,
		editionWindow: { start: "", end: "", timezone: "Europe/Amsterdam" },
	};
	if (factDossierArtifact) {
		if (factDossierArtifact.path) {
			factDossier = JSON.parse(
				readFileSync(factDossierArtifact.path, "utf-8"),
			);
		} else if (typeof factDossierArtifact === "string") {
			factDossier = JSON.parse(
				readFileSync(factDossierArtifact, "utf-8"),
			);
		} else if (factDossierArtifact.candidates !== undefined) {
			factDossier = factDossierArtifact;
		}
	}

	// Load thesaurus
	const thesaurusArtifact = input["thesaurus"] || input.thesaurusArtifact;
	let thesaurusEntries: any[] = [];
	if (thesaurusArtifact) {
		if (thesaurusArtifact.path) {
			const thesaurus = JSON.parse(
				readFileSync(thesaurusArtifact.path, "utf-8"),
			);
			thesaurusEntries = thesaurus.entries || [];
		} else if (typeof thesaurusArtifact === "string") {
			const thesaurus = JSON.parse(
				readFileSync(thesaurusArtifact, "utf-8"),
			);
			thesaurusEntries = thesaurus.entries || [];
		} else if (thesaurusArtifact.entries !== undefined) {
			thesaurusEntries = thesaurusArtifact.entries || [];
		}
	}

	// Load architecture principles
	const archPrinciplesArtifact =
		input["architecture-principles"] ||
		input.architecturePrinciplesArtifact;
	let architecturePrinciples: any[] = [];
	if (archPrinciplesArtifact) {
		if (archPrinciplesArtifact.path) {
			const arch = JSON.parse(
				readFileSync(archPrinciplesArtifact.path, "utf-8"),
			);
			architecturePrinciples = arch.principles || [];
		} else if (typeof archPrinciplesArtifact === "string") {
			const arch = JSON.parse(
				readFileSync(archPrinciplesArtifact, "utf-8"),
			);
			architecturePrinciples = arch.principles || [];
		} else if (archPrinciplesArtifact.principles !== undefined) {
			architecturePrinciples = archPrinciplesArtifact.principles || [];
		}
	}

	// Load historical regression (optional)
	const historicalRegressionArtifact =
		input["historical-regression-report"] ||
		input.historicalRegressionReport;
	let historicalRegression: any = null;
	if (historicalRegressionArtifact) {
		if (historicalRegressionArtifact.path) {
			historicalRegression = JSON.parse(
				readFileSync(historicalRegressionArtifact.path, "utf-8"),
			);
		} else if (typeof historicalRegressionArtifact === "string") {
			historicalRegression = JSON.parse(
				readFileSync(historicalRegressionArtifact, "utf-8"),
			);
		} else if (historicalRegressionArtifact.reportId !== undefined) {
			historicalRegression = historicalRegressionArtifact;
		}
	}

	// Load editorial manifest (optional)
	const editorialManifestArtifact =
		input["resolved-editorial-manifest"] || input.resolvedEditorialManifest;
	let editorialManifest: any = null;
	if (editorialManifestArtifact) {
		if (editorialManifestArtifact.path) {
			editorialManifest = JSON.parse(
				readFileSync(editorialManifestArtifact.path, "utf-8"),
			);
		} else if (typeof editorialManifestArtifact === "string") {
			editorialManifest = JSON.parse(
				readFileSync(editorialManifestArtifact, "utf-8"),
			);
		} else if (editorialManifestArtifact.stories !== undefined) {
			editorialManifest = editorialManifestArtifact;
		}
	}

	// Create and run the book delta engine
	const config: BookDeltaEngineConfig = {
		editionDate,
		factDossier,
		thesaurusEntries: thesaurusEntries || [],
		architecturePrinciples: architecturePrinciples || [],
		historicalRegression,
		editorialManifest,
		enableModelAssistedDiscovery: true,
		enableTargetDocumentInspection: true,
		minConfidenceForProposal: 0.65,
		maxProposalsPerEdition: 10,
	};

	const engine = createBookDeltaEngine(config);
	const result = await engine.run();

	// Persist evaluation result
	const evaluationResult = {
		evaluationId: `bd-eval_${randomBytes(8).toString("hex")}`,
		editionDate: input.editionDate,
		editionId: `edition_${input.editionDate}`,
		proposals: result.proposals,
		artifact: result.artifact,
		evaluationResult: result.evaluationResult,
		knowledgeContinuityResult: result.knowledgeContinuityResult,
		modelRequests: result.modelRequests,
		tokensUsed: result.tokensUsed,
		droppedCandidateCount: result.droppedCandidateCount,
		evaluatedAt: new Date().toISOString(),
		evaluatedBy: "book-delta-engine",
		contentHash: `sha256:${createHash("sha256").update(JSON.stringify(result.proposals)).digest("hex")}`,
	};

	// Persist evaluation result
	const evalDir = "data/book-delta/evaluations";
	mkdirSync(evalDir, { recursive: true });
	const evalPath = join(
		evalDir,
		`edition_${input.editionDate}_${evaluationResult.evaluationId}.json`,
	);
	writeFileSync(evalPath, JSON.stringify(evaluationResult, null, 2), "utf-8");

	return {
		outputArtifacts: [
			{
				artifactId: "book-delta",
				path: "data/book-delta/book-delta-artifact.json",
				description:
					"Updated BookDeltaArtifact with new/verified proposals",
				required: true,
			},
			{
				artifactId: "book-delta-evaluation",
				path: evalPath,
				description: "BookDeltaEvaluationResult",
				required: true,
			},
		],
		evaluationResult,
	};
}
