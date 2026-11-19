/**
 * Canonical Fact Dossier — Module Exports
 *
 * The authoritative per-edition factual foundation consumed by every downstream
 * representation. This module consolidates earlier pipeline results; it does not
 * perform editorial ranking, article generation or publication.
 */

export * from "./schema.js";
export * from "./canonical.js";
export * from "./indicators.js";
export * from "./consolidator.js";
export * from "./store.js";
export * from "./validate.js";
export * from "./enrichment.js";

import { buildDossier as buildDossierImpl } from "./consolidator.js";

/**
 * Build the canonical fact dossier for an edition.
 * Entry point for workflow stage C03_BUILD_FACT_DOSSIER.
 * Handles workflow engine input format.
 */
export async function buildDossier(input: any): Promise<any> {
	// Extract parameters from workflow engine input format
	const editionDate = input.editionDate;
	const editionContext = input.editionContext;
	const candidates =
		input.candidates || input["candidates"] || input.items || [];

	// Build editorial window for context
	const { getEditorialWindow } = await import("../editorial-window.js");
	const window = getEditorialWindow(editionDate);

	// Build context
	const context = {
		editionDate,
		editionId: input.editionContext?.editionId || `edition_${editionDate}`,
		now: new Date().toISOString(),
		previousEditions: [],
		sourceRegistry: input.editionContext?.sourceRegistry,
		researchTaxonomy: input.editionContext?.researchTaxonomy,
		editionWindow: {
			editionDate: window.editionDate,
			start: window.start,
			end: window.end,
			durationHours: window.durationHours,
		},
		...input,
	};

	// Delegate to the consolidator
	const dossier = await import("./consolidator.js").then((m) =>
		m.buildDossier(editionDate, candidates, context),
	);

	// Persist the dossier using the store
	const { FactDossierStore, DEFAULT_FACT_DOSSIER_DIR } =
		await import("./store.js");
	const store = new FactDossierStore(DEFAULT_FACT_DOSSIER_DIR);
	await store.initialize();
	const saveResult = await store.save(dossier);

	// Return in workflow engine expected format
	return {
		outputArtifacts: [
			{
				artifactId: "canonical-fact-dossier",
				path: saveResult.path,
				description: "Canonical fact dossier for the edition",
				required: true,
			},
		],
		dossier,
	};
}
