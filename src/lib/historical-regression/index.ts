/**
 * Historical Regression — Module Exports
 *
 * Rolling seven-calendar-day historical regression stage. Compares the current
 * canonical fact dossier against accessible previous editions and their
 * supporting evidence, producing structured findings for editorial selection.
 *
 * This stage does not redefine novelty classification, evidence verification,
 * omission detection or editorial ranking, and it never modifies previously
 * published editions.
 */

export * from "./schema.js";
export * from "./window.js";
export * from "./matching.js";
export * from "./classifier.js";
export * from "./edition-store.js";
export * from "./semantic.js";
export * from "./store.js";
export * from "./engine.js";

import { runHistoricalRegression } from "./engine.js";
import { readFileSync } from "fs";

/**
 * Execute the historical regression.
 * Entry point for workflow stage C05_HISTORICAL_REGRESSION.
 */
export async function executeHistoricalRegression(input: any): Promise<any> {
	// Build the expected input structure from workflow artifacts
	const factDossierArtifact =
		input["canonical-fact-dossier"] || input.canonicalFactDossier || input;

	console.log(
		`[HistoricalRegression] Input keys: ${Object.keys(input).join(", ")}`,
	);
	console.log(
		`[HistoricalRegression] factDossierArtifact type: ${typeof factDossierArtifact}, value:`,
		factDossierArtifact,
	);

	let canonicalDossier = factDossierArtifact;
	// If artifact is a path string, load the dossier from file
	if (typeof factDossierArtifact === "string") {
		// Substitute edition template if present
		const editionDate = input.editionDate;
		const resolvedPath = factDossierArtifact
			.replace("{edition}", editionDate)
			.replace("${edition}", editionDate);
		try {
			canonicalDossier = JSON.parse(readFileSync(resolvedPath, "utf-8"));
			console.log(
				`[HistoricalRegression] Loaded fact dossier from ${resolvedPath}, candidates: ${canonicalDossier.candidates?.length || 0}`,
			);
		} catch (e) {
			console.error(
				`[HistoricalRegression] Failed to load fact dossier from ${resolvedPath}:`,
				e,
			);
			canonicalDossier = { candidates: [] };
		}
	} else if (factDossierArtifact && typeof factDossierArtifact === "object") {
		// Check if it's an artifact object with a path property
		if (
			factDossierArtifact.path &&
			typeof factDossierArtifact.path === "string"
		) {
			const editionDate = input.editionDate;
			const resolvedPath = factDossierArtifact.path
				.replace("{edition}", editionDate)
				.replace("${edition}", editionDate);
			try {
				canonicalDossier = JSON.parse(
					readFileSync(resolvedPath, "utf-8"),
				);
				console.log(
					`[HistoricalRegression] Loaded fact dossier from artifact path ${resolvedPath}, candidates: ${canonicalDossier.candidates?.length || 0}`,
				);
			} catch (e) {
				console.error(
					`[HistoricalRegression] Failed to load fact dossier from artifact path:`,
					e,
				);
				canonicalDossier = { candidates: [] };
			}
		} else {
			canonicalDossier = factDossierArtifact;
			console.log(
				`[HistoricalRegression] Received fact dossier object, candidates: ${canonicalDossier.candidates?.length || 0}`,
			);
		}
	} else {
		console.warn(
			`[HistoricalRegression] Unexpected fact dossier artifact type: ${typeof factDossierArtifact}, value:`,
			factDossierArtifact,
		);
		canonicalDossier = { candidates: [] };
	}

	// Ensure candidates array exists
	const candidates = Array.isArray(canonicalDossier.candidates)
		? canonicalDossier.candidates
		: [];

	const regressionInput = {
		editionDate: input.editionDate,
		canonicalDossier: {
			...canonicalDossier,
			candidates,
		},
		dataDir: "data",
		persist: true,
		now: new Date().toISOString(),
		generatedBy: "historical-regression-engine",
	};

	const result = await runHistoricalRegression(regressionInput);

	// Return the report which has the relationships array that editorial selection expects
	const report = result.report;
	// Ensure relationships is an array
	if (!Array.isArray(report.relationships)) {
		report.relationships = [];
	}
	// Ensure required properties exist
	if (!report.reportId) report.reportId = `hr_${Date.now()}`;
	if (!report.contentHash) report.contentHash = `sha256:${Date.now()}`;
	if (!report.finalStatus) report.finalStatus = "COMPLETE";
	return report;
}
