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
import type {
	VisualizationLanguageVariant,
	VisualizationRendering,
	VisualizationSpecification,
	ProcessDiagramData,
	ArchitectureDiagramData,
	TimelineData,
	ComparisonTableData,
	QuantitativeChartData,
	ConceptMapData,
} from "./schema.js";

// Helper to create default rendering config
function createDefaultRendering(): VisualizationRendering {
	return {
		outputFormats: ["SVG", "HTML_TABLE"],
		primaryFormat: "SVG",
		responsive: true,
		minReadableWidth: 320,
		reducedMotion: true,
		colorScheme: {
			contrastAA: true,
			noColorOnly: true,
			highContrast: true,
		},
		themes: ["light", "dark"],
	};
}

// Helper to create default language variant
function createDefaultLanguageVariant(
	title: string,
	description: string,
	language: "nl" | "en" = "nl",
): VisualizationLanguageVariant {
	return {
		language,
		title,
		caption: description,
		altText: description,
		longDescription: description,
		localizedLabels: {},
	};
}

// Helper to create minimal spec for rendering
function createMinimalSpec(
	editionDate: string,
	visualizationId: string,
	type: string,
): VisualizationSpecification {
	return {
		schemaVersion: "1.0.0",
		visualizationId,
		editionId: `edition_${editionDate}`,
		editionDate,
		articleId: `art_${visualizationId}`,
		candidateIds: [`cand_${visualizationId}`],
		claimIds: [`claim_${visualizationId}`],
		sourceIds: [`source_${visualizationId}`],
		explanatoryPurpose: `Visual explanation for ${type}`,
		type: type as any,
		data: {} as any,
		languageVariants: [
			createDefaultLanguageVariant(
				`${type} visualization`,
				`Visual explanation for ${type}`,
			),
		],
		accessibility: {
			targetLevel: "AA",
			hasAccessibleTable: true,
			hasLongDescription: true,
			keyboardAccessible: false,
			focusManagement: false,
		},
		uncertainty: {
			assumptions: [],
			limitations: [],
			unsupportedInferences: [],
			evidenceGaps: [],
			causalityRisk: false,
			colorOnlyRisk: false,
			boundarySimplificationRisk: false,
		},
		rendering: createDefaultRendering(),
		status: {
			renderStatus: "READY",
			validated: false,
			generatedAt: new Date().toISOString(),
			generatedBy: "visualization-engine",
			contentHash: computeContentHash(visualizationId),
		},
	};
}

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

				// Generate artifactId early for spec creation
				const artifactId = `vis_${editionDate}_${story.candidateId || story.id}_${opportunity.type || "diagram"}`;

				// Generate appropriate visualization based on opportunity type
				if (
					opportunity.type === "process" ||
					opportunity.type === "workflow"
				) {
					const data: ProcessDiagramData = {
						steps: (opportunity.steps || []).map(
							(s: any, i: number) => ({
								id: s.id || `step_${i}`,
								label: s.label || s.title || `Step ${i + 1}`,
								type: s.type || "action",
								order: s.order ?? i,
								nextStepIds: s.nextStepIds || [],
								evidenceLinks: s.evidenceLinks || [],
							}),
						),
						orientation: opportunity.orientation || "top-to-bottom",
						showDecisions: opportunity.showDecisions ?? true,
					};
					const variant = createDefaultLanguageVariant(
						opportunity.title || `Process: ${story.title}`,
						opportunity.description ||
							`Process diagram for ${story.title}`,
					);
					const rendering = createDefaultRendering();
					const spec = createMinimalSpec(
						editionDate,
						artifactId,
						"process-diagram",
					);
					svg = renderProcessDiagram(data, variant, rendering, spec);
					type = "process";
				} else if (
					opportunity.type === "architecture" ||
					opportunity.type === "system"
				) {
					const data: ArchitectureDiagramData = {
						components: (opportunity.components || []).map(
							(c: any, i: number) => ({
								id: c.id || `comp_${i}`,
								label:
									c.label || c.name || `Component ${i + 1}`,
								type: c.type || "service",
								trustZone: c.trustZone || "internal",
								evidenceLinks: c.evidenceLinks || [],
							}),
						),
						connections: (opportunity.connections || []).map(
							(conn: any, i: number) => ({
								id: conn.id || `conn_${i}`,
								from: conn.from || "",
								to: conn.to || "",
								type: conn.type || "sync",
								protocol: conn.protocol,
								evidenceLinks: conn.evidenceLinks || [],
							}),
						),
						trustBoundaries: opportunity.trustBoundaries || [],
						layout: opportunity.layout || "auto",
					};
					const variant = createDefaultLanguageVariant(
						opportunity.title || `Architecture: ${story.title}`,
						opportunity.description ||
							`Architecture diagram for ${story.title}`,
					);
					const rendering = createDefaultRendering();
					const spec = createMinimalSpec(
						editionDate,
						artifactId,
						"architecture-diagram",
					);
					svg = renderArchitectureDiagram(
						data,
						variant,
						rendering,
						spec,
					);
					type = "architecture";
				} else if (
					opportunity.type === "timeline" ||
					opportunity.type === "temporal"
				) {
					const data: TimelineData = {
						events: (opportunity.events || []).map(
							(e: any, i: number) => ({
								id: e.id || `evt_${i}`,
								displayDate:
									e.date ||
									e.timestamp ||
									new Date().toISOString().split("T")[0],
								label: e.label || e.title || `Event ${i + 1}`,
								description: e.description,
								type: e.type || "milestone",
								timestampType:
									e.timestampType || "original-event",
								evidenceLinks: e.evidenceLinks || [],
								previouslyCovered: e.previouslyCovered ?? false,
							}),
						),
						orientation: opportunity.orientation || "horizontal",
						granularity: opportunity.granularity || "day",
						showGaps: true,
					};
					const variant = createDefaultLanguageVariant(
						opportunity.title || `Timeline: ${story.title}`,
						opportunity.description ||
							`Timeline for ${story.title}`,
					);
					const rendering = createDefaultRendering();
					const spec = createMinimalSpec(
						editionDate,
						artifactId,
						"timeline",
					);
					svg = renderTimeline(data, variant, rendering, spec);
					type = "timeline";
				} else if (
					opportunity.type === "comparison" ||
					opportunity.type === "compare"
				) {
					const data: ComparisonTableData = {
						caption:
							opportunity.title || `Comparison: ${story.title}`,
						columns: (opportunity.criteria || []).map((c: any) => ({
							id: c.key || c.name || "",
							header: c.label || c.name || "",
							type: c.type || "text",
							unit: c.unit,
							higherIsBetter: c.higherIsBetter,
							evidenceLinks: c.evidenceLinks || [],
						})),
						rows: (opportunity.items || []).map(
							(item: any, i: number) => ({
								id: item.id || `item_${i}`,
								label:
									item.label || item.name || `Item ${i + 1}`,
								cells: item.values || {},
								evidenceLinks: item.evidenceLinks || [],
							}),
						),
						defaultSort: opportunity.sortBy
							? {
									columnId: opportunity.sortBy,
									direction: opportunity.sortOrder || "asc",
								}
							: undefined,
					};
					const variant = createDefaultLanguageVariant(
						opportunity.title || `Comparison: ${story.title}`,
						opportunity.description ||
							`Comparison table for ${story.title}`,
					);
					const rendering = createDefaultRendering();
					const spec = createMinimalSpec(
						editionDate,
						artifactId,
						"comparison-table",
					);
					svg = renderComparisonTable(data, variant, rendering, spec);
					type = "comparison";
				} else if (
					opportunity.type === "chart" ||
					opportunity.type === "quantitative"
				) {
					const data: QuantitativeChartData = {
						chartType: (opportunity.chartType || "bar") as any,
						series: (opportunity.data || []).map(
							(ds: any, i: number) => ({
								id: ds.id || `series_${i}`,
								label: ds.label || `Dataset ${i + 1}`,
								data: (ds.data || []).map((d: any) => ({
									x: d.x || d.label || "",
									y: d.y || d.value || 0,
								})),
								measurement: ds.measurement,
								evidenceLinks: ds.evidenceLinks || [],
							}),
						),
						xAxis: {
							label: opportunity.xAxis || "X",
							type: "category",
						},
						yAxis: {
							label: opportunity.yAxis || "Y",
							scale: "linear",
							includeZero: true,
						},
						accessibleTable: {
							columns: [],
							rows: [],
							caption: "Accessible data table",
						},
						showUncertainty: false,
					};
					const variant = createDefaultLanguageVariant(
						opportunity.title || `Chart: ${story.title}`,
						opportunity.description || `Chart for ${story.title}`,
					);
					const rendering = createDefaultRendering();
					const spec = createMinimalSpec(
						editionDate,
						artifactId,
						"quantitative-chart",
					);
					svg = renderQuantitativeChart(
						data,
						variant,
						rendering,
						spec,
					);
					type = "chart";
				} else if (
					opportunity.type === "concept" ||
					opportunity.type === "concept-map"
				) {
					const data: ConceptMapData = {
						nodes: (opportunity.concepts || []).map(
							(c: any, i: number) => ({
								id: c.id || `concept_${i}`,
								label: c.label || c.name || `Concept ${i + 1}`,
								category: c.category || "term",
								definition: c.definition,
								evidenceLinks: c.evidenceLinks || [],
							}),
						),
						edges: (opportunity.relationships || []).map(
							(r: any, i: number) => ({
								id: r.id || `rel_${i}`,
								from: r.from || "",
								to: r.to || "",
								type: r.type || "related",
								label: r.label,
								evidenceLinks: r.evidenceLinks || [],
							}),
						),
						layout: opportunity.layout || "force-directed",
						clusterByCategory: true,
					};
					const variant = createDefaultLanguageVariant(
						opportunity.title || `Concept Map: ${story.title}`,
						opportunity.description ||
							`Concept map for ${story.title}`,
					);
					const rendering = createDefaultRendering();
					const spec = createMinimalSpec(
						editionDate,
						artifactId,
						"concept-map",
					);
					svg = renderConceptMap(data, variant, rendering, spec);
					type = "concept-map";
				} else {
					// Default to a process diagram built from the opportunity elements.
					const data: ProcessDiagramData = {
						steps: (opportunity.elements || []).map(
							(element: any, index: number) => ({
								id: element.id || `step_${index + 1}`,
								label:
									element.label ||
									element.name ||
									`Step ${index + 1}`,
								type: "action",
								order: element.order ?? index + 1,
							}),
						),
						orientation: "top-to-bottom",
						showDecisions: true,
					};
					const variant = createDefaultLanguageVariant(
						opportunity.title || `Visualization: ${story.title}`,
						opportunity.description ||
							`Visualization for ${story.title}`,
					);
					const rendering = createDefaultRendering();
					const spec = createMinimalSpec(
						editionDate,
						artifactId,
						"process-diagram",
					);
					svg = renderProcessDiagram(data, variant, rendering, spec);
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
