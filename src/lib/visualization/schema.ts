/**
 * Visualization — Schema Layer
 *
 * Defines the authoritative, versioned, machine-readable data contract for
 * evidence-based visual explanations. Visualizations consume the canonical
 * fact dossier, editorial selection manifest, and verified claims — they do
 * not independently discover news, reinterpret factual eligibility, change
 * editorial selection, or invent missing evidence.
 *
 * Design rules:
 * - Schemas are defined with Zod (TypeScript schemas) and inferred into static
 *   types, so the runtime validator and the compile-time types cannot drift.
 * - A JSON Schema (draft-07) is generated from the same Zod schemas via
 *   `z.toJSONSchema`, so the on-disk data contract and the TypeScript contract
 *   are generated from one source of truth.
 * - Every identifier pattern reuses the existing stable identifier conventions.
 * - Visualizations must be traceable to authoritative evidence.
 * - Visualizations are optional — their absence must never prevent an otherwise
 *   complete and understandable publication.
 */

import { z } from "astro/zod";

// ============================================================================
// Constants
// ============================================================================

/** Current visualization schema version. */
export const VISUALIZATION_SCHEMA_VERSION = "1.0.0";

/** Prefix for visualization identifiers. */
export const VISUALIZATION_ID_PREFIX = "viz_";

/** Prefix for visualization asset identifiers. */
export const VISUALIZATION_ASSET_ID_PREFIX = "asset_";

/** Stable identifier patterns reused from the existing pipeline. */
export const VISUALIZATION_ID_PATTERNS = {
	visualization: /^viz_[a-z0-9]{16}$/,
	asset: /^asset_[a-z0-9]{16}$/,
	editionDate: /^\d{4}-\d{2}-\d{2}$/,
	edition: /^edition_\d{4}-\d{2}-\d{2}$/,
	candidate: /^cand_[a-z0-9]{16}$/,
	claim: /^claim_[a-z0-9]{16}$/,
	article: /^art_[a-z0-9]{16}$/,
	source: /^[a-z0-9-]+$/,
} as const;

// ============================================================================
// Enumerations
// ============================================================================

/**
 * Supported visualization types per the visual selection principles.
 * A: Process diagrams — Agent workflows, tool-calling sequences, research pipelines
 * B: Architecture diagrams — System components, trust boundaries, agent orchestration
 * C: Timelines — Product releases, research developments, historical changes
 * D: Comparison tables — Model capabilities, coding-agent functionality, benchmarks
 * E: Quantitative charts — Scientific measurements, benchmark results, trends
 * F: Concept maps — Technical terminology, technology relationships, principles
 */
export const VisualizationTypeSchema = z.enum([
	"process-diagram",
	"architecture-diagram",
	"timeline",
	"comparison-table",
	"quantitative-chart",
	"concept-map",
]);

/**
 * Rendering states for explicit fallback behavior.
 * - READY: Data and references valid, ready to render
 * - RENDERED: Successfully rendered to output format
 * - VALIDATED: Rendered output passed accessibility and integrity checks
 * - FAILED: Rendering failed, fallback required
 * - UNAVAILABLE: Required data missing, no rendering attempted
 */
export const VisualizationRenderStatusSchema = z.enum([
	"READY",
	"RENDERED",
	"VALIDATED",
	"FAILED",
	"UNAVAILABLE",
]);

/**
 * Output format for the rendered visualization.
 * - SVG: Accessible SVG (preferred for diagrams)
 * - HTML_TABLE: Semantic HTML table (preferred for comparison tables)
 * - MERMAID: Mermaid diagram definition (for static rendering)
 * - CSV_DATA: Raw data for chart libraries (with accessible table fallback)
 * - MARKDOWN: Structured markdown (for simple timelines, concept maps)
 */
export const VisualizationOutputFormatSchema = z.enum([
	"SVG",
	"HTML_TABLE",
	"MERMAID",
	"CSV_DATA",
	"MARKDOWN",
]);

/**
 * Language variants for bilingual support.
 */
export const VisualizationLanguageSchema = z.union([
	z.literal("nl"),
	z.literal("en"),
]);

/**
 * Accessibility compliance level.
 */
export const AccessibilityLevelSchema = z.enum(["AA", "AAA", "NOT_APPLICABLE"]);

/**
 * Quality evaluation dimensions.
 */
export const QualityDimensionSchema = z.enum([
	"factual-integrity",
	"explanatory-effectiveness",
	"accessibility",
	"visual-design",
	"operational-integrity",
]);

// ============================================================================
// Evidence Traceability
// ============================================================================

/**
 * Links a visualization element to its authoritative evidence.
 * Every meaningful visual element must trace back to the canonical fact dossier.
 */
export const VisualizationEvidenceLinkSchema = z.strictObject({
	/** Stable claim identifier from the canonical fact dossier. */
	claimId: z.string().regex(VISUALIZATION_ID_PATTERNS.claim),
	/** Stable candidate identifier from the canonical fact dossier. */
	candidateId: z.string().regex(VISUALIZATION_ID_PATTERNS.candidate),
	/** Original source identifiers from the source registry. */
	sourceIds: z
		.array(z.string().regex(VISUALIZATION_ID_PATTERNS.source))
		.min(1),
	/** Original evidence URLs. */
	evidenceUrls: z.array(z.string().url()).min(1),
	/** What aspect of the claim this visual element represents. */
	represents: z.string().min(1),
	/** Confidence in the visual representation accuracy (0-1). */
	confidence: z.number().min(0).max(1),
});

/**
 * Measurement metadata for quantitative visualizations.
 * Preserves original measured values, units, baselines, and uncertainty.
 */
export const MeasurementMetadataSchema = z.strictObject({
	/** The measured value as reported in the source. */
	value: z.number(),
	/** Unit of measurement (e.g., "ms", "tokens", "USD", "percentage"). */
	unit: z.string().min(1),
	/** Baseline or comparison value where applicable. */
	baseline: z.number().optional(),
	/** Sample size where material (e.g., n=30). */
	sampleSize: z.number().int().positive().optional(),
	/** Study or measurement period. */
	studyPeriod: z.string().optional(),
	/** Experimental conditions. */
	conditions: z.string().optional(),
	/** Statistical uncertainty (e.g., confidence interval). */
	uncertainty: z.string().optional(),
	/** Confidence interval if supplied. */
	confidenceInterval: z.tuple([z.number(), z.number()]).optional(),
	/** Source classification: measured, estimate, forecast, vendor-reported. */
	valueType: z.enum([
		"measured",
		"estimate",
		"forecast",
		"vendor-reported",
		"independently-replicated",
	]),
	/** Comparability limitations noted in the source. */
	comparabilityLimitations: z.array(z.string()).optional(),
	/** Original source reference. */
	sourceReference: z.string().min(1),
});

/**
 * Uncertainty and limitation metadata.
 * Must be explicit — never inferred or fabricated.
 */
export const VisualizationUncertaintySchema = z.strictObject({
	/** Material assumptions made in creating the visualization. */
	assumptions: z.array(z.string()),
	/** Known limitations of the visual representation. */
	limitations: z.array(z.string()),
	/** Unsupported inferences that must NOT be implied by the visual. */
	unsupportedInferences: z.array(z.string()),
	/** Evidence gaps that affect the visualization. */
	evidenceGaps: z.array(z.string()),
	/** Whether the visualization implies causality not supported by evidence. */
	causalityRisk: z.boolean(),
	/** Whether the visualization uses color as the sole information channel. */
	colorOnlyRisk: z.boolean(),
	/** Whether the visualization simplifies away critical boundaries. */
	boundarySimplificationRisk: z.boolean(),
});

// ============================================================================
// Visualization Data Definitions (per type)
// ============================================================================

/**
 * Process Diagram: Agent workflows, tool-calling sequences, research pipelines.
 * Represents sequential or branching steps with decision points.
 */
export const ProcessDiagramDataSchema = z.strictObject({
	/** Steps in the process. */
	steps: z
		.array(
			z.strictObject({
				id: z.string().min(1),
				label: z.string().min(1),
				description: z.string().optional(),
				type: z.enum([
					"action",
					"decision",
					"start",
					"end",
					"parallel-start",
					"parallel-end",
					"subprocess",
				]),
				evidenceLinks: z
					.array(VisualizationEvidenceLinkSchema)
					.optional(),
				/** Order in the sequence. */
				order: z.number().int().nonnegative(),
				/** Next step IDs (for branching). */
				nextStepIds: z.array(z.string()).optional(),
				/** Condition for decision branches. */
				condition: z.string().optional(),
			}),
		)
		.min(2),
	/** Reading direction. */
	orientation: z
		.enum(["top-to-bottom", "left-to-right"])
		.default("top-to-bottom"),
	/** Whether to show decision diamonds. */
	showDecisions: z.boolean().default(true),
});

/**
 * Architecture Diagram: System components, trust boundaries, agent orchestration.
 * Represents components, their relationships, and trust/authorization boundaries.
 */
export const ArchitectureDiagramDataSchema = z.strictObject({
	/** System components. */
	components: z
		.array(
			z.strictObject({
				id: z.string().min(1),
				label: z.string().min(1),
				description: z.string().optional(),
				type: z.enum([
					"agent",
					"tool",
					"model",
					"database",
					"api",
					"gateway",
					"user",
					"external-system",
					"memory",
					"orchestrator",
				]),
				/** Trust boundary this component belongs to. */
				trustBoundary: z.string().optional(),
				/** Responsibility summary. */
				responsibility: z.string().optional(),
				evidenceLinks: z
					.array(VisualizationEvidenceLinkSchema)
					.optional(),
				/** Position hint for layout (optional). */
				position: z.tuple([z.number(), z.number()]).optional(),
			}),
		)
		.min(1),
	/** Connections between components. */
	connections: z
		.array(
			z.strictObject({
				id: z.string().min(1),
				from: z.string().min(1),
				to: z.string().min(1),
				label: z.string().optional(),
				type: z.enum([
					"data-flow",
					"control-flow",
					"authorization",
					"invocation",
					"observation",
					"feedback",
				]),
				/** Sync vs async. */
				synchronicity: z
					.enum(["synchronous", "asynchronous"])
					.optional(),
				evidenceLinks: z
					.array(VisualizationEvidenceLinkSchema)
					.optional(),
			}),
		)
		.optional(),
	/** Trust boundaries. */
	trustBoundaries: z
		.array(
			z.strictObject({
				id: z.string().min(1),
				label: z.string().min(1),
				description: z.string().optional(),
				componentIds: z.array(z.string()).min(1),
				/** Security level. */
				level: z.enum([
					"trusted",
					"semi-trusted",
					"untrusted",
					"external",
				]),
			}),
		)
		.optional(),
	/** Layout hint. */
	layout: z
		.enum(["hierarchical", "radial", "force-directed", "layered"])
		.default("layered"),
});

/**
 * Timeline: Product releases, research developments, historical changes.
 * Distinguishes original events from later public disclosures.
 */
export const TimelineDataSchema = z.strictObject({
	/** Events on the timeline. */
	events: z
		.array(
			z.strictObject({
				id: z.string().min(1),
				/** Display date (when the event became public/was disclosed). */
				displayDate: z.string().min(1),
				/** Underlying event date (when it actually occurred), if different. */
				eventDate: z.string().optional(),
				label: z.string().min(1),
				description: z.string().optional(),
				type: z.enum([
					"release",
					"disclosure",
					"research-publication",
					"security-advisory",
					"deprecation",
					"update",
					"milestone",
				]),
				/** Whether this is the original event or a later disclosure. */
				timestampType: z.enum([
					"original-event",
					"first-disclosure",
					"publication",
					"substantive-update",
				]),
				evidenceLinks: z.array(VisualizationEvidenceLinkSchema).min(1),
				/** Whether this event was previously covered. */
				previouslyCovered: z.boolean().default(false),
				/** Related candidate ID if applicable. */
				candidateId: z
					.string()
					.regex(VISUALIZATION_ID_PATTERNS.candidate)
					.optional(),
			}),
		)
		.min(2),
	/** Timeline orientation. */
	orientation: z.enum(["horizontal", "vertical"]).default("horizontal"),
	/** Whether to show gaps between events. */
	showGaps: z.boolean().default(true),
	/** Time granularity for axis labels. */
	granularity: z
		.enum(["day", "week", "month", "quarter", "year"])
		.default("month"),
});

/**
 * Comparison Table: Model capabilities, coding-agent functionality, benchmarks.
 * Semantic HTML table with accessible structure.
 */
export const ComparisonTableDataSchema = z.strictObject({
	/** Column definitions. */
	columns: z
		.array(
			z.strictObject({
				id: z.string().min(1),
				header: z.string().min(1),
				/** Data type for sorting/alignment. */
				type: z
					.enum(["text", "number", "boolean", "rating", "status"])
					.default("text"),
				/** Unit for numeric columns. */
				unit: z.string().optional(),
				/** Whether higher is better (for ratings/numbers). */
				higherIsBetter: z.boolean().optional(),
				evidenceLinks: z
					.array(VisualizationEvidenceLinkSchema)
					.optional(),
			}),
		)
		.min(2),
	/** Row data. */
	rows: z
		.array(
			z.strictObject({
				id: z.string().min(1),
				/** Row label (first column). */
				label: z.string().min(1),
				/** Cell values keyed by column ID. */
				cells: z.record(
					z.string(),
					z.union([z.string(), z.number(), z.boolean(), z.null()]),
				),
				/** Source attribution for this row. */
				sourceAttribution: z.string().optional(),
				evidenceLinks: z
					.array(VisualizationEvidenceLinkSchema)
					.optional(),
				/** Whether this is a header/grouping row. */
				isGroupHeader: z.boolean().default(false),
			}),
		)
		.min(1),
	/** Caption explaining the comparison purpose. */
	caption: z.string().min(1),
	/** Sort configuration. */
	defaultSort: z
		.object({
			columnId: z.string(),
			direction: z.enum(["asc", "desc"]),
		})
		.optional(),
});

/**
 * Quantitative Chart: Scientific measurements, benchmark results, trends.
 * Must preserve original measured values, units, baselines, uncertainty.
 * Requires accessible table fallback for screenreaders.
 */
export const QuantitativeChartDataSchema = z.strictObject({
	/** Chart type. */
	chartType: z.enum([
		"bar",
		"line",
		"scatter",
		"area",
		"grouped-bar",
		"stacked-bar",
	]),
	/** Series data. */
	series: z
		.array(
			z.strictObject({
				id: z.string().min(1),
				label: z.string().min(1),
				/** Data points. */
				data: z
					.array(
						z.strictObject({
							x: z.union([z.string(), z.number(), z.date()]),
							y: z.number(),
							/** Measurement metadata for this point. */
							measurement: MeasurementMetadataSchema.optional(),
							evidenceLinks: z
								.array(VisualizationEvidenceLinkSchema)
								.optional(),
						}),
					)
					.min(1),
				/** Whether this series is a baseline/reference. */
				isBaseline: z.boolean().default(false),
			}),
		)
		.min(1),
	/** X-axis configuration. */
	xAxis: z.strictObject({
		label: z.string().min(1),
		type: z.enum(["category", "time", "numeric"]).default("category"),
		unit: z.string().optional(),
	}),
	/** Y-axis configuration. */
	yAxis: z.strictObject({
		label: z.string().min(1),
		unit: z.string().optional(),
		/** Whether to include zero in scale. */
		includeZero: z.boolean().default(true),
		/** Scale type. */
		scale: z.enum(["linear", "log"]).default("linear"),
	}),
	/** Accessible data table (required for full understanding). */
	accessibleTable: ComparisonTableDataSchema,
	/** Whether error bars/uncertainty should be shown. */
	showUncertainty: z.boolean().default(false),
	/** Legend configuration. */
	legend: z
		.object({
			position: z
				.enum(["top", "bottom", "left", "right"])
				.default("bottom"),
			show: z.boolean().default(true),
		})
		.optional(),
});

/**
 * Concept Map: Technical terminology, technology relationships, principles.
 * Represents nodes and their relationships with accessible textual representation.
 */
export const ConceptMapDataSchema = z.strictObject({
	/** Concept nodes. */
	nodes: z
		.array(
			z.strictObject({
				id: z.string().min(1),
				label: z.string().min(1),
				/** Full definition/description. */
				definition: z.string().optional(),
				/** Concept category. */
				category: z.enum([
					"term",
					"technology",
					"principle",
					"pattern",
					"organization",
					"standard",
					"method",
				]),
				evidenceLinks: z
					.array(VisualizationEvidenceLinkSchema)
					.optional(),
				/** Position hint for layout. */
				position: z.tuple([z.number(), z.number()]).optional(),
			}),
		)
		.min(2),
	/** Relationships between concepts. */
	edges: z
		.array(
			z.strictObject({
				id: z.string().min(1),
				from: z.string().min(1),
				to: z.string().min(1),
				/** Relationship type. */
				type: z.enum([
					"requires",
					"enables",
					"extends",
					"implements",
					"contrasts",
					"related-to",
					"part-of",
					"governs",
				]),
				label: z.string().optional(),
				evidenceLinks: z
					.array(VisualizationEvidenceLinkSchema)
					.optional(),
			}),
		)
		.optional(),
	/** Layout algorithm. */
	layout: z
		.enum(["force-directed", "hierarchical", "radial", "grid"])
		.default("force-directed"),
	/** Whether to cluster by category. */
	clusterByCategory: z.boolean().default(true),
});

/**
 * Union of all visualization data types.
 */
export const VisualizationDataSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("process-diagram"),
		data: ProcessDiagramDataSchema,
	}),
	z.object({
		type: z.literal("architecture-diagram"),
		data: ArchitectureDiagramDataSchema,
	}),
	z.object({ type: z.literal("timeline"), data: TimelineDataSchema }),
	z.object({
		type: z.literal("comparison-table"),
		data: ComparisonTableDataSchema,
	}),
	z.object({
		type: z.literal("quantitative-chart"),
		data: QuantitativeChartDataSchema,
	}),
	z.object({ type: z.literal("concept-map"), data: ConceptMapDataSchema }),
]);

// ============================================================================
// Visualization Specification (Complete Contract)
// ============================================================================

/**
 * Language-specific presentation configuration.
 * Factual data is shared; only labels, captions, alt text are localized.
 */
export const VisualizationLanguageVariantSchema = z.strictObject({
	language: VisualizationLanguageSchema,
	/** Display title. */
	title: z.string().min(1),
	/** Caption explaining the intended insight. */
	caption: z.string().min(1),
	/** Alt text for screenreaders (concise). */
	altText: z.string().min(1),
	/** Extended textual explanation for complex visuals. */
	longDescription: z.string().min(1),
	/** Localized axis labels, legend items, etc. */
	localizedLabels: z.record(z.string(), z.string()).optional(),
});

/**
 * Rendering requirements and configuration.
 */
export const VisualizationRenderingSchema = z.strictObject({
	/** Output format(s) to generate. */
	outputFormats: z.array(VisualizationOutputFormatSchema).min(1),
	/** Preferred primary format. */
	primaryFormat: VisualizationOutputFormatSchema,
	/** Whether responsive behavior is required. */
	responsive: z.boolean().default(true),
	/** Minimum viewport width for readable labels (px). */
	minReadableWidth: z.number().int().positive().default(320),
	/** Whether reduced motion should disable animations. */
	reducedMotion: z.boolean().default(true),
	/** Color scheme compliance. */
	colorScheme: z.object({
		/** Meets WCAG AA contrast. */
		contrastAA: z.boolean().default(true),
		/** Does not rely on color alone. */
		noColorOnly: z.boolean().default(true),
		/** Supports high contrast mode. */
		highContrast: z.boolean().default(true),
	}),
	/** Theme compatibility. */
	themes: z.array(z.enum(["light", "dark"])).default(["light", "dark"]),
});

/**
 * Complete visualization specification.
 * This is the authoritative contract consumed by rendering and validation.
 */
export const VisualizationSpecificationSchema = z.strictObject({
	/** Schema version for migrations. */
	schemaVersion: z.literal(VISUALIZATION_SCHEMA_VERSION),
	/** Stable visualization identifier. */
	visualizationId: z.string().regex(VISUALIZATION_ID_PATTERNS.visualization),
	/** Edition and article references. */
	editionId: z.string().regex(VISUALIZATION_ID_PATTERNS.edition),
	editionDate: z.string().regex(VISUALIZATION_ID_PATTERNS.editionDate),
	articleId: z.string().regex(VISUALIZATION_ID_PATTERNS.article).optional(),
	/** Associated candidate and claim IDs from the canonical dossier. */
	candidateIds: z
		.array(z.string().regex(VISUALIZATION_ID_PATTERNS.candidate))
		.min(1),
	claimIds: z.array(z.string().regex(VISUALIZATION_ID_PATTERNS.claim)).min(1),
	/** Original source references. */
	sourceIds: z
		.array(z.string().regex(VISUALIZATION_ID_PATTERNS.source))
		.min(1),
	/** Intended explanatory purpose (why this visual exists). */
	explanatoryPurpose: z.string().min(1),
	/** Visualization type. */
	type: VisualizationTypeSchema,
	/** Visualization data (type-specific). */
	data: VisualizationDataSchema,
	/** Language variants (factual data shared, only presentation localized). */
	languageVariants: z.array(VisualizationLanguageVariantSchema).min(1).max(2),
	/** Accessibility metadata. */
	accessibility: z.strictObject({
		/** WCAG compliance level targeted. */
		targetLevel: AccessibilityLevelSchema.default("AA"),
		/** Whether accessible table equivalent is provided (required for charts). */
		hasAccessibleTable: z.boolean(),
		/** Whether long description is provided (required for complex diagrams). */
		hasLongDescription: z.boolean(),
		/** Reading order for screenreaders. */
		readingOrder: z.array(z.string()).optional(),
		/** Keyboard interaction required. */
		keyboardAccessible: z.boolean().default(false),
		/** Focus management needed. */
		focusManagement: z.boolean().default(false),
	}),
	/** Measurement and uncertainty metadata. */
	measurements: z.array(MeasurementMetadataSchema).optional(),
	/** Uncertainty and limitations. */
	uncertainty: VisualizationUncertaintySchema,
	/** Rendering requirements. */
	rendering: VisualizationRenderingSchema,
	/** Generation and validation status. */
	status: z.strictObject({
		/** Current render status. */
		renderStatus: VisualizationRenderStatusSchema.default("READY"),
		/** Whether validation passed. */
		validated: z.boolean().default(false),
		/** Validation timestamp. */
		validatedAt: z.string().optional(),
		/** Validation errors if any. */
		validationErrors: z.array(z.string()).optional(),
		/** Generation timestamp. */
		generatedAt: z.string().min(1),
		/** Generator version/tool. */
		generatedBy: z.string().min(1),
		/** Content hash of the specification. */
		contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
		/** Previous version hash for version chain. */
		previousVersionHash: z
			.string()
			.regex(/^sha256:[a-f0-9]{64}$/)
			.optional(),
		/** Note when rendering was skipped or degraded (e.g. inference exhausted). */
		inferenceNote: z.string().optional(),
	}),
	/** Quality evaluation results. */
	qualityEvaluation: z
		.array(
			z.strictObject({
				dimension: QualityDimensionSchema,
				score: z.number().min(0).max(1),
				findings: z.array(z.string()),
				traceableTo: z.array(z.string()),
			}),
		)
		.optional(),
});

// ============================================================================
// Visualization Asset (Rendered Output)
// ============================================================================

/**
 * Rendered visualization asset with provenance.
 */
export const VisualizationAssetSchema = z.strictObject({
	schemaVersion: z.literal(VISUALIZATION_SCHEMA_VERSION),
	assetId: z.string().startsWith(VISUALIZATION_ASSET_ID_PREFIX),
	visualizationId: z.string().regex(VISUALIZATION_ID_PATTERNS.visualization),
	editionId: z.string().regex(VISUALIZATION_ID_PATTERNS.edition),
	editionDate: z.string().regex(VISUALIZATION_ID_PATTERNS.editionDate),
	format: VisualizationOutputFormatSchema,
	language: VisualizationLanguageSchema,
	/** Relative path to the asset file. */
	relativePath: z.string().min(1),
	/** Content hash of the asset. */
	contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
	/** Generation metadata. */
	generatedAt: z.string().min(1),
	generatedBy: z.string().min(1),
	/** Source specification hash. */
	specContentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
	/** Validation status. */
	validation: z.strictObject({
		passed: z.boolean(),
		validatedAt: z.string().optional(),
		errors: z.array(z.string()).optional(),
		warnings: z.array(z.string()).optional(),
	}),
	/** Accessibility validation results. */
	accessibilityValidation: z
		.strictObject({
			passed: z.boolean(),
			checkedAt: z.string().optional(),
			axeViolations: z.number().int().nonnegative().default(0),
			contrastIssues: z.number().int().nonnegative().default(0),
			keyboardIssues: z.number().int().nonnegative().default(0),
			details: z.array(z.string()).optional(),
		})
		.optional(),
});

// ============================================================================
// Inferred TypeScript Types
// ============================================================================

export type VisualizationType = z.infer<typeof VisualizationTypeSchema>;
export type VisualizationRenderStatus = z.infer<
	typeof VisualizationRenderStatusSchema
>;
export type VisualizationOutputFormat = z.infer<
	typeof VisualizationOutputFormatSchema
>;
export type VisualizationLanguage = z.infer<typeof VisualizationLanguageSchema>;
export type AccessibilityLevel = z.infer<typeof AccessibilityLevelSchema>;
export type QualityDimension = z.infer<typeof QualityDimensionSchema>;

export type VisualizationEvidenceLink = z.infer<
	typeof VisualizationEvidenceLinkSchema
>;
export type MeasurementMetadata = z.infer<typeof MeasurementMetadataSchema>;
export type VisualizationUncertainty = z.infer<
	typeof VisualizationUncertaintySchema
>;

export type ProcessDiagramData = z.infer<typeof ProcessDiagramDataSchema>;
export type ArchitectureDiagramData = z.infer<
	typeof ArchitectureDiagramDataSchema
>;
export type TimelineData = z.infer<typeof TimelineDataSchema>;
export type ComparisonTableData = z.infer<typeof ComparisonTableDataSchema>;
export type QuantitativeChartData = z.infer<typeof QuantitativeChartDataSchema>;
export type ConceptMapData = z.infer<typeof ConceptMapDataSchema>;
export type VisualizationData = z.infer<typeof VisualizationDataSchema>;

export type VisualizationLanguageVariant = z.infer<
	typeof VisualizationLanguageVariantSchema
>;
export type VisualizationRendering = z.infer<
	typeof VisualizationRenderingSchema
>;
export type VisualizationSpecification = z.infer<
	typeof VisualizationSpecificationSchema
>;
export type VisualizationAsset = z.infer<typeof VisualizationAssetSchema>;

// ============================================================================
// JSON Schema Generation (Single Source of Truth)
// ============================================================================

/**
 * Generate the draft-07 JSON Schema for the visualization specification.
 * Written to `data/schemas/visualization-specification.json`.
 */
export function generateVisualizationSpecificationJsonSchema(): Record<
	string,
	unknown
> {
	const generated = z.toJSONSchema(VisualizationSpecificationSchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/visualization-specification.json",
		title: "Visualization Specification",
		description:
			"Evidence-based visual explanation specification. Consumes canonical fact dossier and editorial selection manifest. Every visual element traces to authoritative evidence. Visualizations are optional and never block publication.",
		...generated,
	};
}

/**
 * Generate the draft-07 JSON Schema for the visualization asset.
 * Written to `data/schemas/visualization-asset.json`.
 */
export function generateVisualizationAssetJsonSchema(): Record<
	string,
	unknown
> {
	const generated = z.toJSONSchema(VisualizationAssetSchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/visualization-asset.json",
		title: "Visualization Asset",
		description:
			"Rendered visualization asset with provenance, validation status, and accessibility results.",
		...generated,
	};
}
