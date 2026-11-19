/**
 * Architecture Principles Register — Module Exports
 *
 * Persistent, evidence-based register of reusable architectural principles
 * derived from verified AI research, technological developments, engineering
 * experience and established standards.
 */

export * from "./schema.js";
export * from "./store.js";
export * from "./engine.js";

import { createArchitecturePrinciplesEngine } from "./engine.js";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { randomBytes, createHash } from "crypto";

/**
 * Evaluate Architecture Principles (G02_ARCHITECTURE_PRINCIPLES_EVALUATION).
 * Entry point for workflow stage G02.
 * Evaluates candidate principles from edition evidence against the register.
 */
export async function evaluateArchitecturePrinciples(input: any): Promise<any> {
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

	// Create and initialize the architecture principles engine
	const engine = createArchitecturePrinciplesEngine();
	await engine.initialize(factDossier);

	// Run the evaluation
	const result = await engine.evaluateEdition();

	// Sanitize delta to match PrincipleDeltaSchema exactly (remove any extra fields like schemaVersion)
	const sanitizedDelta = {
		deltaId: result.delta.deltaId,
		editionDate: result.delta.editionDate,
		generatedAt: result.delta.generatedAt,
		generatedBy: result.delta.generatedBy,
		proposedChanges: result.delta.proposedChanges,
		validationResults: result.delta.validationResults,
		contentHash: result.delta.contentHash,
	};

	// Persist evaluation result
	const evaluationResult = {
		evaluationId: `arch-eval_${randomBytes(8).toString("hex")}`,
		editionDate: input.editionDate,
		editionId: `edition_${input.editionDate}`,
		delta: sanitizedDelta,
		knowledgeContinuityResult: result.knowledgeContinuityResult,
		evaluatedAt: new Date().toISOString(),
		evaluatedBy: "architecture-principles-engine",
		contentHash: `sha256:${createHash("sha256").update(JSON.stringify(sanitizedDelta)).digest("hex")}`,
	};

	// Persist evaluation result
	const evalDir = "data/architecture-principles/evaluations";
	mkdirSync(evalDir, { recursive: true });
	const evalPath = join(
		evalDir,
		`edition_${input.editionDate}_${evaluationResult.evaluationId}.json`,
	);
	writeFileSync(evalPath, JSON.stringify(evaluationResult, null, 2), "utf-8");

	return {
		outputArtifacts: [
			{
				artifactId: "architecture-principles",
				path: "data/architecture-principles/architecture-principles-artifact.json",
				description:
					"Updated ArchitecturePrinciplesRegister with new/verified principles",
				required: true,
			},
			{
				artifactId: "architecture-principles-evaluation",
				path: evalPath,
				description: "ArchitecturePrinciplesEvaluationResult",
				required: true,
			},
		],
		evaluationResult,
	};
}
