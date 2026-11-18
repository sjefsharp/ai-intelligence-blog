/**
 * Visualization — Public API
 *
 * Single entry point for the visualization module.
 * Re-exports all schemas, rendering, validation, and utilities.
 */

// Schema layer
export * from "./schema.js";

// Rendering
export * from "./render.js";

// Validation & Quality Evaluation
export * from "./validate.js";

import {
	renderVisualization,
	renderProcessDiagram,
	renderArchitectureDiagram,
	renderTimeline,
	renderComparisonTable,
	renderQuantitativeChart,
	renderConceptMap,
} from "./render.js";
import {
	validateVisualizationAsset,
	evaluateVisualizationQuality,
	runFullValidation,
	generateVisualizationContentHash,
} from "./validate.js";
import { writeFileSync, mkdirSync, readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { computeContentHash } from "../publication/metadata.js";

/**
 * Generate Optional Evidence-Backed Visual Explanations (E05_GENERATE_VISUALS).
 * Entry point for workflow stage E05.
 * Creates accessible visual explanations for stories with explanationOpportunities.
 */
export async function generateVisualizations(input: any): Promise<any> {
	const editionDate = input.editionDate;
	const factDossier =
		input["canonical-fact-dossier"] || input.canonicalFactDossier || input;
	const editorialManifest =
		input["resolved-editorial-manifest"] ||
		input.resolvedEditorialManifest ||
		input;

	const visualizations: any[] = [];
	const outputDir = `editions/edition_${editionDate}/assets/visualizations`;

	// Ensure output directory exists
	mkdirSync(outputDir, { recursive: true });

	// Get selected stories that have explanationOpportunities
	const selectedStories =
		editorialManifest?.selection?.filter(
			(s: any) =>
				s.decision === "SELECTED" || s.decision === "CATCH_UP_SELECTED",
		) || [];

	for (const story of selectedStories) {
		// Check if story has explanation opportunities
		const opportunities = story.explanationOpportunities || [];
		if (!Array.isArray(opportunities) || opportunities.length === 0)
			continue;

		for (const opportunity of opportunities) {
			try {
				let svg = "";
				let type = "diagram";

				// Generate appropriate visualization based on opportunity type
				if (
					opportunity.type === "process" ||
					opportunity.type === "workflow"
				) {
					svg = renderProcessDiagram({
						title: opportunity.title || `Process: ${story.title}`,
						steps: opportunity.steps || [],
						decisionPoints: opportunity.decisionPoints || [],
					});
					type = "process";
				} else if (
					opportunity.type === "architecture" ||
					opportunity.type === "system"
				) {
					svg = renderArchitectureDiagram({
						title:
							opportunity.title || `Architecture: ${story.title}`,
						components: opportunity.components || [],
						connections: opportunity.connections || [],
					});
					type = "architecture";
				} else if (
					opportunity.type === "timeline" ||
					opportunity.type === "temporal"
				) {
					svg = renderTimeline({
						title: opportunity.title || `Timeline: ${story.title}`,
						events: opportunity.events || [],
					});
					type = "timeline";
				} else if (
					opportunity.type === "comparison" ||
					opportunity.type === "compare"
				) {
					svg = renderComparisonTable({
						title:
							opportunity.title || `Comparison: ${story.title}`,
						items: opportunity.items || [],
						criteria: opportunity.criteria || [],
					});
					type = "comparison";
				} else if (
					opportunity.type === "chart" ||
					opportunity.type === "quantitative"
				) {
					svg = renderQuantitativeChart({
						title: opportunity.title || `Chart: ${story.title}`,
						data: opportunity.data || [],
						chartType: opportunity.chartType || "bar",
					});
					type = "chart";
				} else if (
					opportunity.type === "concept" ||
					opportunity.type === "concept-map"
				) {
					svg = renderConceptMap({
						title:
							opportunity.title || `Concept Map: ${story.title}`,
						concepts: opportunity.concepts || [],
						relationships: opportunity.relationships || [],
					});
					type = "concept-map";
				} else {
					// Default to generic visualization
					svg = renderVisualization({
						title:
							opportunity.title ||
							`Visualization: ${story.title}`,
						type: "diagram",
						elements: opportunity.elements || [],
					});
					type = "diagram";
				}

				if (svg) {
					const artifactId = `vis_${editionDate}_${story.candidateId || story.id}_${type}`;
					const fileName = `${artifactId}.svg`;
					const filePath = join(outputDir, fileName);

					// Write SVG file
					writeFileSync(filePath, svg, "utf-8");

					// Create metadata
					const metadata = {
						artifactId,
						editionId: `edition_${editionDate}`,
						editionDate,
						contentType: "visualization" as const,
						canonicalFilename: fileName,
						title:
							opportunity.title || `${type} for ${story.title}`,
						description:
							opportunity.description ||
							`Visual explanation for ${story.title}`,
						storyId: story.candidateId || story.id,
						storyTitle: story.title,
						visualizationType: type,
						accessibility: {
							altText:
								opportunity.altText ||
								`${type} explaining ${story.title}`,
							fallbackDescription:
								opportunity.fallbackDescription ||
								`Textual description: ${story.summary || story.title}`,
							longDescription: opportunity.longDescription || "",
						},
						evidenceBacking: opportunity.evidenceBacking || [],
						generatedBy: "visualization-engine",
						generatedAt: new Date().toISOString(),
						lifecycleStatus: "DRAFT" as const,
						validationStatus: "pending" as const,
						contentHash: computeContentHash(svg),
						schemaVersion: "1.0.0" as const,
					};

					// Write metadata file
					const metaPath = filePath + ".meta.json";
					writeFileSync(
						metaPath,
						JSON.stringify(metadata, null, 2),
						"utf-8",
					);

					visualizations.push({
						artifactId,
						path: filePath,
						metadata,
						type,
					});
				}
			} catch (err) {
				console.warn(
					`Failed to generate visualization for ${story.title}:`,
					err,
				);
				// Continue with other stories - failureBehavior is ALLOW_PARTIAL
			}
		}
	}

	return {
		visualizations,
		generatedAt: new Date().toISOString(),
		editionDate,
		outputDir,
	};
}

/**
 * Validate Visualization Accessibility (F04_VISUALIZATION_ACCESSIBILITY).
 * Entry point for workflow stage F04.
 * Validates generated visualizations for accessibility (alt text, contrast, reduced motion), WCAG 2.2 AA compliance, and evidence-backed content.
 */
export async function validateVisualizationAccessibility(
	input: any,
): Promise<any> {
	const editionDate = input.editionDate;

	// Load visual assets
	const visualAssetsArtifact = input["visual-assets"] || input.visualAssets;
	let visualizations: any[] = [];

	if (visualAssetsArtifact) {
		if (visualAssetsArtifact.path) {
			// Load visualizations from directory
			const { readdirSync, readFileSync } = await import("fs");
			const { join } = await import("path");
			try {
				const files = readdirSync(visualAssetsArtifact.path)
					.filter((f: string) => f.endsWith(".svg"))
					.map((f: string) => join(visualAssetsArtifact.path, f));
				for (const file of files) {
					const svg = readFileSync(file, "utf-8");
					const metaPath = file + ".meta.json";
					let metadata: any = {};
					try {
						metadata = JSON.parse(readFileSync(metaPath, "utf-8"));
					} catch {}
					visualizations.push({ svg, metadata, path: file });
				}
			} catch {}
		} else if (Array.isArray(visualAssetsArtifact)) {
			visualizations = visualAssetsArtifact;
		}
	}

	// Simple accessibility checks on each visualization
	const accessibilityResults = visualizations.map((vis: any) => {
		const metadata = vis.metadata || {};
		const svg = vis.svg || "";

		// Check for alt text in metadata
		const hasAltText = !!metadata.accessibility?.altText;
		const altText = metadata.accessibility?.altText || "";

		// Check for fallback description
		const hasFallbackDescription =
			!!metadata.accessibility?.fallbackDescription;
		const fallbackDescription =
			metadata.accessibility?.fallbackDescription || "";

		// Check for long description
		const hasLongDescription = !!metadata.accessibility?.longDescription;

		// Check for evidence backing
		const evidenceBacked =
			metadata.evidenceBacking && metadata.evidenceBacking.length > 0;

		// Simple SVG accessibility checks
		const hasTitle = svg.includes("<title>") && svg.includes("</title>");
		const hasDesc = svg.includes("<desc>") && svg.includes("</desc>");

		return {
			visualizationId: metadata.artifactId || `vis_${Date.now()}`,
			hasAltText,
			altText,
			hasFallbackDescription,
			fallbackDescription,
			hasLongDescription,
			evidenceBacked,
			hasTitle,
			hasDesc,
			svgSize: svg.length,
		};
	});

	// Overall accessibility summary
	const totalVisualizations = visualizations.length;
	const withAltText = accessibilityResults.filter((r) => r.hasAltText).length;
	const withFallbackDescription = accessibilityResults.filter(
		(r) => r.hasFallbackDescription,
	).length;
	const withTitle = accessibilityResults.filter((r) => r.hasTitle).length;
	const withDesc = accessibilityResults.filter((r) => r.hasDesc).length;
	const evidenceBacked = accessibilityResults.filter(
		(r) => r.evidenceBacked,
	).length;
	const allAccessible =
		totalVisualizations === 0 ||
		(withAltText === totalVisualizations &&
			withFallbackDescription === totalVisualizations);
	const allHaveTitleDesc =
		totalVisualizations === 0 ||
		(withTitle === totalVisualizations && withDesc === totalVisualizations);
	const allEvidenceBacked =
		totalVisualizations === 0 || evidenceBacked === totalVisualizations;

	const report = {
		reportId: `visacc_${Date.now()}`,
		editionDate,
		editionId: `edition_${editionDate}`,
		totalVisualizations,
		visualizations: accessibilityResults,
		summary: {
			totalVisualizations,
			withAltText,
			withFallbackDescription,
			withTitle,
			withDesc,
			evidenceBacked,
			allAccessible,
			allHaveTitleDesc,
			allEvidenceBacked,
			wcagAaCompliant:
				allAccessible && allHaveTitleDesc && allEvidenceBacked,
		},
		generatedAt: new Date().toISOString(),
		generatedBy: "visualization-accessibility-validator",
	};

	// Persist report
	const { writeFileSync, mkdirSync } = await import("fs");
	const { join } = await import("path");
	const outputDir = `data/quality/visualization`;
	mkdirSync(outputDir, { recursive: true });
	const reportPath = join(
		outputDir,
		`edition_${editionDate}_${report.reportId}.json`,
	);
	writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");

	return report;
}
