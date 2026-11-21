/**
 * Visualization — Test Fixtures
 *
 * Representative test fixtures for the 20 regression cases specified in the requirements.
 * All fixtures are synthetic and clearly labeled as test data.
 */

import type {
	VisualizationSpecification,
	VisualizationLanguageVariant,
	VisualizationRendering,
	VisualizationUncertainty,
	VisualizationEvidenceLink,
	AccessibilityLevel,
} from "./schema.js";

const EDITION_DATE = "2025-01-15";
const EDITION_ID = "edition_2025-01-15";
const ARTICLE_ID = "art_abcdefghijklmnop";
const CANDIDATE_ID = "cand_abcdefghijklmnop";
const CLAIM_ID = "claim_abcdefghijklmnop";
const SOURCE_ID = "source-example";

function makeVizId(suffix: string): string {
	const base = "viz_";
	const suffixClean = suffix.replace(/[^a-z0-9]/g, "").slice(0, 16);
	return base + suffixClean.padEnd(16, "0");
}

function makeContentHash(): string {
	return "sha256:" + "a".repeat(64);
}

const baseEvidenceLink: VisualizationEvidenceLink = {
	claimId: CLAIM_ID,
	candidateId: CANDIDATE_ID,
	sourceIds: [SOURCE_ID],
	evidenceUrls: ["https://example.com/evidence"],
	represents: "Test representation",
	confidence: 0.9,
};

const baseUncertainty: VisualizationUncertainty = {
	assumptions: ["Test assumption"],
	limitations: ["Test limitation"],
	unsupportedInferences: [],
	evidenceGaps: [],
	causalityRisk: false,
	colorOnlyRisk: false,
	boundarySimplificationRisk: false,
};

const baseRendering: VisualizationRendering = {
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

const baseAccessibility = {
	targetLevel: "AA" as AccessibilityLevel,
	hasAccessibleTable: false,
	hasLongDescription: true,
	keyboardAccessible: false,
	focusManagement: false,
};

const baseLanguageVariants: VisualizationLanguageVariant[] = [
	{
		language: "en",
		title: "Test Visualization (EN)",
		caption: "This is a test visualization for English readers.",
		altText: "Test visualization showing example data.",
		longDescription:
			"This test visualization demonstrates the rendering and validation pipeline for evidence-based visual explanations. It contains synthetic data for testing purposes only.",
		localizedLabels: {},
	},
	{
		language: "nl",
		title: "Testvisualisatie (NL)",
		caption: "Dit is een testvisualisatie voor Nederlandse lezers.",
		altText: "Testvisualisatie met voorbeeldgegevens.",
		longDescription:
			"Deze testvisualisatie demonstreert de rendering- en validatiepijplijn voor bewijsgebaseerde visuele uitleg. Het bevat synthetische data uitsluitend voor testdoeleinden.",
		localizedLabels: {},
	},
];

function createBaseSpec(
	type: VisualizationSpecification["type"],
	data: VisualizationSpecification["data"],
	overrides?: Partial<VisualizationSpecification>,
): VisualizationSpecification {
	const base = {
		schemaVersion: "1.0.0" as const,
		visualizationId: makeVizId("base"),
		editionId: EDITION_ID,
		editionDate: EDITION_DATE,
		articleId: ARTICLE_ID,
		candidateIds: [CANDIDATE_ID],
		claimIds: [CLAIM_ID],
		sourceIds: [SOURCE_ID],
		explanatoryPurpose:
			"Test visualization for validation pipeline verification.",
		type,
		data,
		languageVariants: baseLanguageVariants,
		uncertainty: baseUncertainty,
		rendering: baseRendering,
		accessibility: baseAccessibility,
		status: {
			renderStatus: "READY" as const,
			validated: false,
			generatedAt: "2025-01-15T10:00:00Z",
			generatedBy: "test-suite",
			contentHash: makeContentHash(),
		},
	};
	return { ...base, ...overrides };
}

// ============================================================================
// Fixture 1: Simple agent workflow process diagram
// ============================================================================
export const fixture1_processDiagram: VisualizationSpecification =
	createBaseSpec(
		"process-diagram",
		{
			type: "process-diagram",
			data: {
				steps: [
					{
						id: "start",
						label: "Start",
						description: "Workflow initiation",
						type: "start",
						order: 0,
						nextStepIds: ["plan"],
					},
					{
						id: "plan",
						label: "Plan Task",
						description: "Agent plans the approach",
						type: "action",
						order: 1,
						nextStepIds: ["select-tool"],
					},
					{
						id: "select-tool",
						label: "Select Tool",
						description: "Choose appropriate tool",
						type: "decision",
						order: 2,
						condition: "Tool available?",
						nextStepIds: ["execute", "fallback"],
					},
					{
						id: "execute",
						label: "Execute Tool",
						description: "Run selected tool",
						type: "action",
						order: 3,
						nextStepIds: ["evaluate"],
					},
					{
						id: "fallback",
						label: "Fallback Strategy",
						description: "Use alternative approach",
						type: "action",
						order: 4,
						nextStepIds: ["evaluate"],
					},
					{
						id: "evaluate",
						label: "Evaluate Result",
						description: "Check if goal achieved",
						type: "decision",
						order: 5,
						condition: "Success?",
						nextStepIds: ["complete", "retry"],
					},
					{
						id: "retry",
						label: "Retry with Adjustment",
						description: "Modify approach and retry",
						type: "action",
						order: 6,
						nextStepIds: ["select-tool"],
					},
					{
						id: "complete",
						label: "Complete",
						description: "Workflow finished",
						type: "end",
						order: 7,
						nextStepIds: [],
					},
				],
				orientation: "top-to-bottom",
				showDecisions: true,
			},
		},
		{ visualizationId: makeVizId("fixture1proc") },
	);

// ============================================================================
// Fixture 2: Agent orchestration architecture with trust boundaries
// ============================================================================
export const fixture2_architectureDiagram: VisualizationSpecification =
	createBaseSpec(
		"architecture-diagram",
		{
			type: "architecture-diagram",
			data: {
				components: [
					{
						id: "orchestrator",
						label: "Orchestrator",
						type: "orchestrator",
						trustBoundary: "trusted-core",
						responsibility: "Plans and coordinates agent workflows",
					},
					{
						id: "memory",
						label: "Context Memory",
						type: "memory",
						trustBoundary: "trusted-core",
						responsibility: "Stores conversation history and state",
					},
					{
						id: "tool-gateway",
						label: "Tool Gateway",
						type: "gateway",
						trustBoundary: "semi-trusted",
						responsibility: "Validates and executes tool calls",
					},
					{
						id: "model-api",
						label: "Model API",
						type: "model",
						trustBoundary: "trusted-core",
						responsibility: "Provides LLM inference",
					},
					{
						id: "external-api",
						label: "External API",
						type: "external-system",
						trustBoundary: "external",
						responsibility: "Third-party service integration",
					},
					{
						id: "user",
						label: "User",
						type: "user",
						trustBoundary: "external",
						responsibility: "Initiates and reviews workflows",
					},
				],
				connections: [
					{
						id: "c1",
						from: "user",
						to: "orchestrator",
						type: "invocation",
						synchronicity: "synchronous",
						label: "Request",
					},
					{
						id: "c2",
						from: "orchestrator",
						to: "memory",
						type: "data-flow",
						synchronicity: "synchronous",
						label: "Read/Write",
					},
					{
						id: "c3",
						from: "orchestrator",
						to: "model-api",
						type: "invocation",
						synchronicity: "asynchronous",
						label: "Inference",
					},
					{
						id: "c4",
						from: "orchestrator",
						to: "tool-gateway",
						type: "invocation",
						synchronicity: "synchronous",
						label: "Tool Call",
					},
					{
						id: "c5",
						from: "tool-gateway",
						to: "external-api",
						type: "authorization",
						synchronicity: "asynchronous",
						label: "API Request",
					},
					{
						id: "c6",
						from: "orchestrator",
						to: "user",
						type: "feedback",
						synchronicity: "asynchronous",
						label: "Result",
					},
				],
				trustBoundaries: [
					{
						id: "trusted-core",
						label: "Trusted Core",
						level: "trusted",
						componentIds: ["orchestrator", "memory", "model-api"],
						description:
							"Fully trusted components with full system access",
					},
					{
						id: "semi-trusted",
						label: "Semi-Trusted Zone",
						level: "semi-trusted",
						componentIds: ["tool-gateway"],
						description:
							"Validated components with constrained permissions",
					},
					{
						id: "external",
						label: "External Systems",
						level: "external",
						componentIds: ["user", "external-api"],
						description: "Untrusted external actors and services",
					},
				],
				layout: "layered",
			},
		},
		{ visualizationId: makeVizId("fixture2arch") },
	);

// ============================================================================
// Fixture 3: Technical comparison as semantic table
// ============================================================================
export const fixture3_comparisonTable: VisualizationSpecification =
	createBaseSpec(
		"comparison-table",
		{
			type: "comparison-table",
			data: {
				columns: [
					{
						id: "agent",
						header: "Agent",
						type: "text",
						evidenceLinks: [baseEvidenceLink],
					},
					{
						id: "schema-enforcement",
						header: "Schema Enforcement",
						type: "boolean",
						evidenceLinks: [baseEvidenceLink],
					},
					{
						id: "tool-sandbox",
						header: "Tool Sandbox",
						type: "boolean",
						evidenceLinks: [baseEvidenceLink],
					},
					{
						id: "capability-tokens",
						header: "Capability Tokens",
						type: "boolean",
						evidenceLinks: [baseEvidenceLink],
					},
					{
						id: "cost-control",
						header: "Cost Control",
						type: "rating",
						evidenceLinks: [baseEvidenceLink],
					},
					{
						id: "observability",
						header: "Observability",
						type: "rating",
						evidenceLinks: [baseEvidenceLink],
					},
				],
				rows: [
					{
						id: "r1",
						label: "GitHub Copilot Coding Agent",
						cells: {
							agent: "GitHub Copilot",
							"schema-enforcement": true,
							"tool-sandbox": true,
							"capability-tokens": false,
							"cost-control": 3,
							observability: 4,
						},
						sourceAttribution: "GitHub Documentation 2024",
						evidenceLinks: [baseEvidenceLink],
						isGroupHeader: false,
					},
					{
						id: "r2",
						label: "OpenAI Codex CLI",
						cells: {
							agent: "OpenAI Codex",
							"schema-enforcement": true,
							"tool-sandbox": true,
							"capability-tokens": true,
							"cost-control": 4,
							observability: 3,
						},
						sourceAttribution: "OpenAI Documentation 2024",
						evidenceLinks: [baseEvidenceLink],
						isGroupHeader: false,
					},
					{
						id: "r3",
						label: "Anthropic Claude Code",
						cells: {
							agent: "Claude Code",
							"schema-enforcement": true,
							"tool-sandbox": true,
							"capability-tokens": true,
							"cost-control": 4,
							observability: 4,
						},
						sourceAttribution: "Anthropic Documentation 2024",
						evidenceLinks: [baseEvidenceLink],
						isGroupHeader: false,
					},
				],
				caption:
					"Comparison of agent bounding capabilities across three major coding agents. Ratings on 1-5 scale.",
			},
		},
		{ visualizationId: makeVizId("fixture3table") },
	);

// ============================================================================
// Fixture 4: Verified scientific benchmark with uncertainty
// ============================================================================
export const fixture4_quantitativeChart: VisualizationSpecification =
	createBaseSpec(
		"quantitative-chart",
		{
			type: "quantitative-chart",
			data: {
				chartType: "bar",
				series: [
					{
						id: "engine-a",
						label: "Engine A (vLLM)",
						isBaseline: true,
						data: [
							{
								x: "Batch 1",
								y: 45,
								measurement: {
									value: 45,
									unit: "ms",
									baseline: 50,
									sampleSize: 100,
									studyPeriod: "2024-06",
									conditions: "A100, FP16",
									uncertainty: "±3ms",
									confidenceInterval: [42, 48],
									valueType: "measured",
									sourceReference: "MLSys 2024",
								},
								evidenceLinks: [baseEvidenceLink],
							},
							{
								x: "Batch 8",
								y: 180,
								measurement: {
									value: 180,
									unit: "ms",
									baseline: 200,
									sampleSize: 100,
									studyPeriod: "2024-06",
									conditions: "A100, FP16",
									uncertainty: "±12ms",
									confidenceInterval: [168, 192],
									valueType: "measured",
									sourceReference: "MLSys 2024",
								},
								evidenceLinks: [baseEvidenceLink],
							},
						],
					},
					{
						id: "engine-b",
						label: "Engine B (TGI)",
						isBaseline: false,
						data: [
							{
								x: "Batch 1",
								y: 52,
								measurement: {
									value: 52,
									unit: "ms",
									baseline: 50,
									sampleSize: 100,
									studyPeriod: "2024-06",
									conditions: "A100, FP16",
									uncertainty: "±4ms",
									confidenceInterval: [48, 56],
									valueType: "measured",
									sourceReference: "MLSys 2024",
								},
								evidenceLinks: [baseEvidenceLink],
							},
							{
								x: "Batch 8",
								y: 210,
								measurement: {
									value: 210,
									unit: "ms",
									baseline: 200,
									sampleSize: 100,
									studyPeriod: "2024-06",
									conditions: "A100, FP16",
									uncertainty: "±15ms",
									confidenceInterval: [195, 225],
									valueType: "measured",
									sourceReference: "MLSys 2024",
								},
								evidenceLinks: [baseEvidenceLink],
							},
						],
					},
					{
						id: "engine-c",
						label: "Engine C (SGLang)",
						isBaseline: false,
						data: [
							{
								x: "Batch 1",
								y: 38,
								measurement: {
									value: 38,
									unit: "ms",
									baseline: 50,
									sampleSize: 100,
									studyPeriod: "2024-06",
									conditions: "A100, FP16",
									uncertainty: "±3ms",
									confidenceInterval: [35, 41],
									valueType: "measured",
									sourceReference: "MLSys 2024",
								},
								evidenceLinks: [baseEvidenceLink],
							},
							{
								x: "Batch 8",
								y: 165,
								measurement: {
									value: 165,
									unit: "ms",
									baseline: 200,
									sampleSize: 100,
									studyPeriod: "2024-06",
									conditions: "A100, FP16",
									uncertainty: "±10ms",
									confidenceInterval: [155, 175],
									valueType: "measured",
									sourceReference: "MLSys 2024",
								},
								evidenceLinks: [baseEvidenceLink],
							},
						],
					},
				],
				xAxis: { label: "Batch Size", type: "category" },
				yAxis: {
					label: "Latency",
					unit: "ms",
					includeZero: true,
					scale: "linear",
				},
				accessibleTable: {
					columns: [
						{ id: "engine", header: "Engine", type: "text" },
						{
							id: "batch1",
							header: "Batch 1 (ms)",
							type: "number",
							unit: "ms",
						},
						{
							id: "batch8",
							header: "Batch 8 (ms)",
							type: "number",
							unit: "ms",
						},
						{ id: "ci1", header: "Batch 1 CI", type: "text" },
						{ id: "ci8", header: "Batch 8 CI", type: "text" },
					],
					rows: [
						{
							id: "t1",
							label: "vLLM",
							cells: {
								engine: "vLLM",
								batch1: 45,
								batch8: 180,
								ci1: "[42, 48]",
								ci8: "[168, 192]",
							},
							isGroupHeader: false,
						},
						{
							id: "t2",
							label: "TGI",
							cells: {
								engine: "TGI",
								batch1: 52,
								batch8: 210,
								ci1: "[48, 56]",
								ci8: "[195, 225]",
							},
							isGroupHeader: false,
						},
						{
							id: "t3",
							label: "SGLang",
							cells: {
								engine: "SGLang",
								batch1: 38,
								batch8: 165,
								ci1: "[35, 41]",
								ci8: "[155, 175]",
							},
							isGroupHeader: false,
						},
					],
					caption:
						"Inference latency comparison with 95% confidence intervals. n=100 per condition. A100 GPU, FP16 precision.",
				},
				showUncertainty: true,
			},
		},
		{ visualizationId: makeVizId("fixture4chart") },
	);

// ============================================================================
// Fixture 5: Gartner productivity finding with careful units
// ============================================================================
export const fixture5_gartnerFinding: VisualizationSpecification =
	createBaseSpec(
		"quantitative-chart",
		{
			type: "quantitative-chart",
			data: {
				chartType: "bar",
				series: [
					{
						id: "productivity-gain",
						label: "Reported Productivity Gain",
						isBaseline: false,
						data: [
							{
								x: "Code Generation",
								y: 35,
								measurement: {
									value: 35,
									unit: "percent",
									sampleSize: 500,
									studyPeriod: "2024-Q2",
									conditions:
										"Survey of enterprise developers",
									uncertainty: "±5%",
									confidenceInterval: [30, 40],
									valueType: "estimate",
									sourceReference: "Gartner 2024",
									comparabilityLimitations: [
										"Self-reported",
										"No control group",
										"Vendor-sponsored",
									],
								},
								evidenceLinks: [baseEvidenceLink],
							},
							{
								x: "Code Review",
								y: 22,
								measurement: {
									value: 22,
									unit: "percent",
									sampleSize: 500,
									studyPeriod: "2024-Q2",
									conditions:
										"Survey of enterprise developers",
									uncertainty: "±4%",
									confidenceInterval: [18, 26],
									valueType: "estimate",
									sourceReference: "Gartner 2024",
									comparabilityLimitations: [
										"Self-reported",
										"No control group",
										"Vendor-sponsored",
									],
								},
								evidenceLinks: [baseEvidenceLink],
							},
							{
								x: "Testing",
								y: 18,
								measurement: {
									value: 18,
									unit: "percent",
									sampleSize: 500,
									studyPeriod: "2024-Q2",
									conditions:
										"Survey of enterprise developers",
									uncertainty: "±4%",
									confidenceInterval: [14, 22],
									valueType: "estimate",
									sourceReference: "Gartner 2024",
									comparabilityLimitations: [
										"Self-reported",
										"No control group",
										"Vendor-sponsored",
									],
								},
								evidenceLinks: [baseEvidenceLink],
							},
						],
					},
				],
				xAxis: { label: "Development Activity", type: "category" },
				yAxis: {
					label: "Reported Improvement",
					unit: "%",
					includeZero: true,
					scale: "linear",
				},
				accessibleTable: {
					columns: [
						{ id: "activity", header: "Activity", type: "text" },
						{
							id: "gain",
							header: "Reported Gain (%)",
							type: "number",
							unit: "%",
						},
						{ id: "ci", header: "95% CI", type: "text" },
						{
							id: "methodology",
							header: "Methodology",
							type: "text",
						},
					],
					rows: [
						{
							id: "tr1",
							label: "Code Generation",
							cells: {
								activity: "Code Generation",
								gain: 35,
								ci: "[30, 40]",
								methodology: "Survey, n=500, self-reported",
							},
							isGroupHeader: false,
						},
						{
							id: "tr2",
							label: "Code Review",
							cells: {
								activity: "Code Review",
								gain: 22,
								ci: "[18, 26]",
								methodology: "Survey, n=500, self-reported",
							},
							isGroupHeader: false,
						},
						{
							id: "tr3",
							label: "Testing",
							cells: {
								activity: "Testing",
								gain: 18,
								ci: "[14, 22]",
								methodology: "Survey, n=500, self-reported",
							},
							isGroupHeader: false,
						},
					],
					caption:
						"Gartner 2024 survey of 500 enterprise developers. Self-reported productivity gains. No control group. Vendor-sponsored study. Results are estimates, not measured outcomes.",
				},
				showUncertainty: true,
			},
		},
		{ visualizationId: makeVizId("fixture5gartn") },
	);

// ============================================================================
// Fixture 6: Economic forecast labeled as estimate
// ============================================================================
export const fixture6_economicForecast: VisualizationSpecification =
	createBaseSpec(
		"quantitative-chart",
		{
			type: "quantitative-chart",
			data: {
				chartType: "line",
				series: [
					{
						id: "market-size",
						label: "Global AI Market (Forecast)",
						isBaseline: false,
						data: [
							{
								x: 2023,
								y: 154,
								measurement: {
									value: 154,
									unit: "billion USD",
									valueType: "measured",
									sourceReference: "IDC 2024",
								},
								evidenceLinks: [baseEvidenceLink],
							},
							{
								x: 2024,
								y: 200,
								measurement: {
									value: 200,
									unit: "billion USD",
									valueType: "estimate",
									sourceReference: "IDC 2024",
								},
								evidenceLinks: [baseEvidenceLink],
							},
							{
								x: 2025,
								y: 260,
								measurement: {
									value: 260,
									unit: "billion USD",
									valueType: "forecast",
									sourceReference: "IDC 2024",
								},
								evidenceLinks: [baseEvidenceLink],
							},
							{
								x: 2026,
								y: 340,
								measurement: {
									value: 340,
									unit: "billion USD",
									valueType: "forecast",
									sourceReference: "IDC 2024",
								},
								evidenceLinks: [baseEvidenceLink],
							},
							{
								x: 2027,
								y: 420,
								measurement: {
									value: 420,
									unit: "billion USD",
									valueType: "forecast",
									sourceReference: "IDC 2024",
								},
								evidenceLinks: [baseEvidenceLink],
							},
						],
					},
				],
				xAxis: { label: "Year", type: "numeric", unit: "year" },
				yAxis: {
					label: "Market Size",
					unit: "billion USD",
					includeZero: false,
					scale: "linear",
				},
				accessibleTable: {
					columns: [
						{ id: "year", header: "Year", type: "number" },
						{
							id: "size",
							header: "Market Size (B USD)",
							type: "number",
							unit: "billion USD",
						},
						{ id: "type", header: "Value Type", type: "text" },
					],
					rows: [
						{
							id: "fr1",
							label: "2023",
							cells: { year: 2023, size: 154, type: "Measured" },
							isGroupHeader: false,
						},
						{
							id: "fr2",
							label: "2024",
							cells: { year: 2024, size: 200, type: "Estimate" },
							isGroupHeader: false,
						},
						{
							id: "fr3",
							label: "2025",
							cells: { year: 2025, size: 260, type: "Forecast" },
							isGroupHeader: false,
						},
						{
							id: "fr4",
							label: "2026",
							cells: { year: 2026, size: 340, type: "Forecast" },
							isGroupHeader: false,
						},
						{
							id: "fr5",
							label: "2027",
							cells: { year: 2027, size: 420, type: "Forecast" },
							isGroupHeader: false,
						},
					],
					caption:
						"IDC Worldwide AI Spending Guide 2024. 2023 is measured actual; 2024 is estimate; 2025-2027 are forecasts. Forecasts carry inherent uncertainty.",
				},
				showUncertainty: false,
			},
		},
		{ visualizationId: makeVizId("fixture6econ") },
	);

// ============================================================================
// Fixture 7: Timeline distinguishing events from disclosures
// ============================================================================
export const fixture7_timeline: VisualizationSpecification = createBaseSpec(
	"timeline",
	{
		type: "timeline",
		data: {
			events: [
				{
					id: "e1",
					displayDate: "2024-01-15",
					eventDate: "2024-01-10",
					label: "Vulnerability Introduced",
					description: "Code commit introducing the flaw",
					type: "release",
					timestampType: "original-event",
					previouslyCovered: false,
					evidenceLinks: [baseEvidenceLink],
				},
				{
					id: "e2",
					displayDate: "2024-03-01",
					eventDate: "2024-03-01",
					label: "Internal Discovery",
					description: "Security team identifies the issue",
					type: "security-advisory",
					timestampType: "original-event",
					previouslyCovered: false,
					evidenceLinks: [baseEvidenceLink],
				},
				{
					id: "e3",
					displayDate: "2024-03-15",
					eventDate: "2024-03-15",
					label: "Vendor Notification",
					description: "Responsible disclosure to vendor",
					type: "security-advisory",
					timestampType: "first-disclosure",
					previouslyCovered: false,
					evidenceLinks: [baseEvidenceLink],
				},
				{
					id: "e4",
					displayDate: "2024-04-01",
					eventDate: "2024-04-01",
					label: "Patch Released",
					description: "Fixed version published",
					type: "release",
					timestampType: "publication",
					previouslyCovered: false,
					evidenceLinks: [baseEvidenceLink],
				},
				{
					id: "e5",
					displayDate: "2024-04-15",
					eventDate: "2024-04-15",
					label: "Public Disclosure (CVE-2024-XXXX)",
					description: "CVE assigned and details published",
					type: "security-advisory",
					timestampType: "first-disclosure",
					previouslyCovered: false,
					evidenceLinks: [baseEvidenceLink],
				},
			],
			orientation: "horizontal",
			showGaps: true,
			granularity: "month",
		},
	},
	{ visualizationId: makeVizId("fixture7time") },
);

// ============================================================================
// Fixture 8: Complex concept map with accessible relationships
// ============================================================================
export const fixture8_conceptMap: VisualizationSpecification = createBaseSpec(
	"concept-map",
	{
		type: "concept-map",
		data: {
			nodes: [
				{
					id: "agent",
					label: "Agent",
					category: "term",
					definition:
						"Autonomous software entity that plans and executes actions toward a goal using tools",
					evidenceLinks: [baseEvidenceLink],
				},
				{
					id: "tool",
					label: "Tool",
					category: "technology",
					definition:
						"Callable function that an agent can invoke to perform an action",
					evidenceLinks: [baseEvidenceLink],
				},
				{
					id: "schema",
					label: "JSON Schema",
					category: "standard",
					definition:
						"Validation schema for tool call parameters and responses",
					evidenceLinks: [baseEvidenceLink],
				},
				{
					id: "sandbox",
					label: "Tool Sandbox",
					category: "technology",
					definition:
						"Isolated execution environment for untrusted tool code (WASM, process, container)",
					evidenceLinks: [baseEvidenceLink],
				},
				{
					id: "capability-token",
					label: "Capability Token",
					category: "term",
					definition:
						"Unforgeable token granting specific permission (model call, API request, budget)",
					evidenceLinks: [baseEvidenceLink],
				},
				{
					id: "orchestration",
					label: "Orchestration",
					category: "pattern",
					definition:
						"Coordination of multiple agents and tools toward a shared goal",
					evidenceLinks: [baseEvidenceLink],
				},
				{
					id: "observability",
					label: "Observability Spine",
					category: "pattern",
					definition:
						"Structured logging + distributed tracing + evaluation hooks as shared infrastructure",
					evidenceLinks: [baseEvidenceLink],
				},
			],
			edges: [
				{
					id: "e1",
					from: "agent",
					to: "tool",
					type: "requires",
					label: "invokes",
				},
				{
					id: "e2",
					from: "tool",
					to: "schema",
					type: "requires",
					label: "validated by",
				},
				{
					id: "e3",
					from: "tool",
					to: "sandbox",
					type: "requires",
					label: "executed in",
				},
				{
					id: "e4",
					from: "agent",
					to: "capability-token",
					type: "requires",
					label: "authorized by",
				},
				{
					id: "e5",
					from: "orchestration",
					to: "agent",
					type: "governs",
					label: "manages",
				},
				{
					id: "e6",
					from: "orchestration",
					to: "observability",
					type: "requires",
					label: "instrumented by",
				},
			],
			layout: "force-directed",
			clusterByCategory: true,
		},
	},
	{ visualizationId: makeVizId("fixture8conc") },
);

// ============================================================================
// Fixture 9: Visual incorrectly implying unsupported causality
// ============================================================================
export const fixture9_causalityRisk: VisualizationSpecification =
	createBaseSpec(
		"quantitative-chart",
		{
			type: "quantitative-chart",
			data: {
				chartType: "scatter",
				showUncertainty: false,
				series: [
					{
						id: "adoption-revenue",
						label: "AI Adoption vs Revenue Growth",
						isBaseline: false,
						data: [
							{
								x: 10,
								y: 5,
								measurement: {
									value: 5,
									unit: "% revenue growth",
									valueType: "measured",
									sourceReference: "Survey 2024",
								},
								evidenceLinks: [baseEvidenceLink],
							},
							{
								x: 25,
								y: 8,
								measurement: {
									value: 8,
									unit: "% revenue growth",
									valueType: "measured",
									sourceReference: "Survey 2024",
								},
								evidenceLinks: [baseEvidenceLink],
							},
							{
								x: 40,
								y: 12,
								measurement: {
									value: 12,
									unit: "% revenue growth",
									valueType: "measured",
									sourceReference: "Survey 2024",
								},
								evidenceLinks: [baseEvidenceLink],
							},
							{
								x: 60,
								y: 15,
								measurement: {
									value: 15,
									unit: "% revenue growth",
									valueType: "measured",
									sourceReference: "Survey 2024",
								},
								evidenceLinks: [baseEvidenceLink],
							},
							{
								x: 80,
								y: 18,
								measurement: {
									value: 18,
									unit: "% revenue growth",
									valueType: "measured",
									sourceReference: "Survey 2024",
								},
								evidenceLinks: [baseEvidenceLink],
							},
						],
					},
				],
				xAxis: {
					label: "AI Adoption Rate",
					type: "numeric",
					unit: "%",
				},
				yAxis: {
					label: "Revenue Growth",
					unit: "%",
					includeZero: true,
					scale: "linear",
				},
				accessibleTable: {
					columns: [
						{
							id: "adoption",
							header: "AI Adoption (%)",
							type: "number",
							unit: "%",
						},
						{
							id: "growth",
							header: "Revenue Growth (%)",
							type: "number",
							unit: "%",
						},
					],
					rows: [
						{
							id: "sr1",
							label: "Company A",
							cells: { adoption: 10, growth: 5 },
							isGroupHeader: false,
						},
						{
							id: "sr2",
							label: "Company B",
							cells: { adoption: 25, growth: 8 },
							isGroupHeader: false,
						},
						{
							id: "sr3",
							label: "Company C",
							cells: { adoption: 40, growth: 12 },
							isGroupHeader: false,
						},
						{
							id: "sr4",
							label: "Company D",
							cells: { adoption: 60, growth: 15 },
							isGroupHeader: false,
						},
						{
							id: "sr5",
							label: "Company E",
							cells: { adoption: 80, growth: 18 },
							isGroupHeader: false,
						},
					],
					caption:
						"Correlation only. No causal relationship established. Confounding variables not controlled.",
				},
			},
		},
		{
			visualizationId: makeVizId("fixture9caus"),
			uncertainty: {
				...baseUncertainty,
				assumptions: ["Linear relationship assumed for visualization"],
				limitations: [
					"Correlation does not imply causation",
					"Confounding variables: company size, industry, investment",
					"Small sample (n=5)",
					"Cross-sectional, not longitudinal",
				],
				unsupportedInferences: [
					"AI adoption causes revenue growth",
					"Increasing adoption will increase revenue",
				],
				evidenceGaps: [
					"No controlled experiment",
					"No temporal precedence established",
				],
				causalityRisk: true,
				colorOnlyRisk: false,
				boundarySimplificationRisk: false,
			},
			accessibility: {
				...baseAccessibility,
				hasAccessibleTable: true,
			},
		},
	);

// ============================================================================
// Fixture 10: Chart with fabricated/missing numerical values
// ============================================================================
export const fixture10_fabricatedValues: VisualizationSpecification =
	createBaseSpec(
		"quantitative-chart",
		{
			type: "quantitative-chart",
			data: {
				chartType: "bar",
				showUncertainty: false,
				series: [
					{
						id: "fabricated",
						label: "Fabricated Benchmark",
						isBaseline: false,
						data: [
							{
								x: "Test 1",
								y: 999,
								measurement: {
									value: 999,
									unit: "ops/sec",
									valueType: "estimate",
									sourceReference: "INVENTED",
								},
								evidenceLinks: [baseEvidenceLink],
							},
							{
								x: "Test 2",
								y: 888,
								measurement: {
									value: 888,
									unit: "ops/sec",
									valueType: "estimate",
									sourceReference: "INVENTED",
								},
								evidenceLinks: [baseEvidenceLink],
							},
						],
					},
				],
				xAxis: { label: "Test", type: "category" },
				yAxis: {
					label: "Performance",
					unit: "ops/sec",
					includeZero: true,
					scale: "linear",
				},
				accessibleTable: {
					columns: [
						{ id: "test", header: "Test", type: "text" },
						{
							id: "perf",
							header: "Performance (ops/sec)",
							type: "number",
							unit: "ops/sec",
						},
					],
					rows: [
						{
							id: "far1",
							label: "Test 1",
							cells: { test: "Test 1", perf: 999 },
							isGroupHeader: false,
						},
						{
							id: "far2",
							label: "Test 2",
							cells: { test: "Test 2", perf: 888 },
							isGroupHeader: false,
						},
					],
					caption:
						"SYNTHETIC TEST DATA — Values are invented for testing validation. Not real measurements.",
				},
			},
		},
		{
			visualizationId: makeVizId("fixture10fab"),
			uncertainty: {
				...baseUncertainty,
				assumptions: [],
				limitations: [
					"ALL VALUES ARE FABRICATED FOR TESTING",
					"No source evidence exists for these measurements",
				],
				unsupportedInferences: ["Any conclusion drawn from this data"],
				evidenceGaps: ["Complete absence of evidence"],
				causalityRisk: false,
				colorOnlyRisk: false,
				boundarySimplificationRisk: false,
			},
			accessibility: {
				...baseAccessibility,
				hasAccessibleTable: true,
			},
		},
	);

// ============================================================================
// Fixture 11: Diagram relying exclusively on color
// ============================================================================
export const fixture11_colorOnly: VisualizationSpecification = createBaseSpec(
	"architecture-diagram",
	{
		type: "architecture-diagram",
		data: {
			components: [
				{
					id: "c1",
					label: "Component A",
					type: "agent",
					trustBoundary: "zone-1",
				},
				{
					id: "c2",
					label: "Component B",
					type: "tool",
					trustBoundary: "zone-2",
				},
				{
					id: "c3",
					label: "Component C",
					type: "model",
					trustBoundary: "zone-3",
				},
			],
			connections: [
				{ id: "conn1", from: "c1", to: "c2", type: "data-flow" },
				{ id: "conn2", from: "c2", to: "c3", type: "data-flow" },
			],
			trustBoundaries: [
				{
					id: "zone-1",
					label: "Zone 1",
					level: "trusted",
					componentIds: ["c1"],
				},
				{
					id: "zone-2",
					label: "Zone 2",
					level: "semi-trusted",
					componentIds: ["c2"],
				},
				{
					id: "zone-3",
					label: "Zone 3",
					level: "untrusted",
					componentIds: ["c3"],
				},
			],
			layout: "layered",
		},
	},
	{
		visualizationId: makeVizId("fixture11col"),
		uncertainty: {
			...baseUncertainty,
			colorOnlyRisk: true,
		},
	},
);

// ============================================================================
// Fixture 12: Visual with inadequate screenreader descriptions
// ============================================================================
export const fixture12_inadequateA11y: VisualizationSpecification =
	createBaseSpec(
		"process-diagram",
		{
			type: "process-diagram",
			data: {
				steps: [
					{
						id: "s1",
						label: "Step 1",
						type: "action",
						order: 0,
						nextStepIds: ["s2"],
					},
					{
						id: "s2",
						label: "Step 2",
						type: "action",
						order: 1,
						nextStepIds: [],
					},
				],
				orientation: "top-to-bottom",
				showDecisions: true,
			},
		},
		{
			visualizationId: makeVizId("fixture12a11y"),
			accessibility: {
				targetLevel: "AA" as AccessibilityLevel,
				hasAccessibleTable: false,
				hasLongDescription: false,
				keyboardAccessible: false,
				focusManagement: false,
			},
			languageVariants: [
				{
					language: "en",
					title: "Inaccessible Diagram",
					caption: "A process diagram.",
					altText: "",
					longDescription: "",
					localizedLabels: {},
				},
				{
					language: "nl",
					title: "Ontoegankelijk diagram",
					caption: "Een procesdiagram.",
					altText: "",
					longDescription: "",
					localizedLabels: {},
				},
			],
		},
	);

// ============================================================================
// Fixture 13: Responsive diagram with unreadable labels on mobile
// ============================================================================
export const fixture13_mobileLabels: VisualizationSpecification =
	createBaseSpec(
		"architecture-diagram",
		{
			type: "architecture-diagram",
			data: {
				components: [
					{
						id: "c1",
						label: "Very Long Component Name That Will Be Unreadable On Small Screens",
						type: "agent",
						position: [100, 100],
					},
					{
						id: "c2",
						label: "Another Extremely Long Component Name For Testing Mobile Readability Issues",
						type: "tool",
						position: [600, 100],
					},
					{
						id: "c3",
						label: "Third Component With Similarly Verbose Naming Convention That Causes Problems",
						type: "model",
						position: [350, 400],
					},
				],
				connections: [
					{
						id: "conn1",
						from: "c1",
						to: "c2",
						type: "data-flow",
						label: "Very Long Connection Label That Also Causes Issues",
					},
					{
						id: "conn2",
						from: "c2",
						to: "c3",
						type: "data-flow",
						label: "Another Verbose Connection Description",
					},
				],
				layout: "layered",
			},
		},
		{
			visualizationId: makeVizId("fixture13mob"),
			rendering: {
				...baseRendering,
				minReadableWidth: 800,
			},
		},
	);

// ============================================================================
// Fixture 14: Language variant with incorrect technical terminology
// ============================================================================
export const fixture14_badTerminology: VisualizationSpecification =
	createBaseSpec(
		"comparison-table",
		{
			type: "comparison-table",
			data: {
				columns: [
					{ id: "feature", header: "Feature", type: "text" },
					{ id: "support", header: "Support", type: "boolean" },
				],
				rows: [
					{
						id: "r1",
						label: "Schema Enforcement",
						cells: { feature: "Schema Enforcement", support: true },
						isGroupHeader: false,
					},
				],
				caption: "Comparison of schema support.",
			},
		},
		{
			visualizationId: makeVizId("fixture14term"),
			languageVariants: [
				{
					language: "en",
					title: "Schema Support Comparison",
					caption: "Compares schema enforcement across agents.",
					altText: "Table showing schema support.",
					longDescription:
						"This table compares whether different agents enforce JSON schemas for tool calls.",
					localizedLabels: {
						"Schema Enforcement": "Schema Enforcement",
					},
				},
				{
					language: "nl",
					title: "Schema Ondersteuning Vergelijking",
					caption: "Vergelijkt schema enforcement over agents.",
					altText: "Tabel met schema ondersteuning.",
					longDescription:
						"Deze tabel vergelijkt of verschillende agents JSON schema's afdwingen voor tool calls.",
					localizedLabels: {
						"Schema Enforcement": "Schema Handhaving",
					},
				},
			],
		},
	);

// ============================================================================
// Fixture 15: Inaccessible interactive chart
// ============================================================================
export const fixture15_interactiveChart: VisualizationSpecification =
	createBaseSpec(
		"quantitative-chart",
		{
			type: "quantitative-chart",
			data: {
				chartType: "line",
				showUncertainty: false,
				series: [
					{
						id: "interactive",
						label: "Hover-Only Data",
						isBaseline: false,
						data: [
							{
								x: 1,
								y: 10,
								measurement: {
									value: 10,
									unit: "units",
									valueType: "measured",
									sourceReference: "Test",
								},
								evidenceLinks: [baseEvidenceLink],
							},
							{
								x: 2,
								y: 20,
								measurement: {
									value: 20,
									unit: "units",
									valueType: "measured",
									sourceReference: "Test",
								},
								evidenceLinks: [baseEvidenceLink],
							},
						],
					},
				],
				xAxis: { label: "X", type: "numeric" },
				yAxis: {
					label: "Y",
					unit: "units",
					includeZero: true,
					scale: "linear",
				},
				accessibleTable: {
					columns: [
						{ id: "x", header: "X", type: "number" },
						{ id: "y", header: "Y", type: "number", unit: "units" },
					],
					rows: [
						{
							id: "ir1",
							label: "Point 1",
							cells: { x: 1, y: 10 },
							isGroupHeader: false,
						},
						{
							id: "ir2",
							label: "Point 2",
							cells: { x: 2, y: 20 },
							isGroupHeader: false,
						},
					],
					caption: "Data table provided as accessible alternative.",
				},
			},
		},
		{
			visualizationId: makeVizId("fixture15int"),
			accessibility: {
				...baseAccessibility,
				hasAccessibleTable: true,
				keyboardAccessible: true,
				focusManagement: false,
			},
			rendering: {
				...baseRendering,
				outputFormats: ["SVG"],
			},
		},
	);

// ============================================================================
// Fixture 16: Failed rendering with valid textual fallback
// ============================================================================
export const fixture16_failedRendering: VisualizationSpecification =
	createBaseSpec(
		"process-diagram",
		{
			type: "process-diagram",
			data: {
				steps: [
					{
						id: "s1",
						label: "Analyze Request",
						type: "action",
						order: 0,
						nextStepIds: ["s2"],
					},
					{
						id: "s2",
						label: "Execute Plan",
						type: "action",
						order: 1,
						nextStepIds: ["s3"],
					},
					{
						id: "s3",
						label: "Return Result",
						type: "action",
						order: 2,
						nextStepIds: [],
					},
				],
				orientation: "top-to-bottom",
				showDecisions: true,
			},
		},
		{
			visualizationId: makeVizId("fixture16fail"),
			status: {
				renderStatus: "FAILED" as const,
				validated: false,
				generatedAt: "2025-01-15T10:00:00Z",
				generatedBy: "test-suite",
				contentHash: makeContentHash(),
				validationErrors: [
					"SVG generation failed: layout engine unavailable",
				],
			},
		},
	);

// ============================================================================
// Fixture 17: Missing visual asset reference
// ============================================================================
export const fixture17_missingAsset: VisualizationSpecification =
	createBaseSpec(
		"timeline",
		{
			type: "timeline",
			data: {
				events: [
					{
						id: "e1",
						displayDate: "2024-01-01",
						label: "Event 1",
						type: "release",
						timestampType: "publication",
						previouslyCovered: false,
						evidenceLinks: [baseEvidenceLink],
					},
					{
						id: "e2",
						displayDate: "2024-02-01",
						label: "Event 2",
						type: "update",
						timestampType: "publication",
						previouslyCovered: false,
						evidenceLinks: [baseEvidenceLink],
					},
				],
				orientation: "horizontal",
				showGaps: true,
				granularity: "month",
			},
		},
		{
			visualizationId: makeVizId("fixture17miss"),
			status: {
				renderStatus: "RENDERED" as const,
				validated: false,
				generatedAt: "2025-01-15T10:00:00Z",
				generatedBy: "test-suite",
				contentHash: makeContentHash(),
			},
		},
	);

// ============================================================================
// Fixture 18: Article for which no visual is necessary
// ============================================================================
export const fixture18_noVisualNeeded: VisualizationSpecification =
	createBaseSpec(
		"comparison-table",
		{
			type: "comparison-table",
			data: {
				columns: [
					{ id: "item", header: "Item", type: "text" },
					{ id: "value", header: "Value", type: "text" },
				],
				rows: [
					{
						id: "r1",
						label: "Setting A",
						cells: { item: "Setting A", value: "Enabled" },
						isGroupHeader: false,
					},
					{
						id: "r2",
						label: "Setting B",
						cells: { item: "Setting B", value: "Disabled" },
						isGroupHeader: false,
					},
				],
				caption: "Simple two-row comparison — prose would suffice.",
			},
		},
		{ visualizationId: makeVizId("fixture18nov") },
	);

// ============================================================================
// Fixture 19: Visually attractive but technically misleading diagram
// ============================================================================
export const fixture19_misleading: VisualizationSpecification = createBaseSpec(
	"architecture-diagram",
	{
		type: "architecture-diagram",
		data: {
			components: [
				{
					id: "frontend",
					label: "Frontend",
					type: "user",
					trustBoundary: "external",
				},
				{
					id: "gateway",
					label: "API Gateway",
					type: "gateway",
					trustBoundary: "semi-trusted",
				},
				{
					id: "service-a",
					label: "Service A",
					type: "agent",
					trustBoundary: "trusted-core",
				},
				{
					id: "service-b",
					label: "Service B",
					type: "agent",
					trustBoundary: "trusted-core",
				},
				{
					id: "database",
					label: "Database",
					type: "database",
					trustBoundary: "trusted-core",
				},
			],
			connections: [
				{
					id: "c1",
					from: "frontend",
					to: "gateway",
					type: "invocation",
				},
				{
					id: "c2",
					from: "gateway",
					to: "service-a",
					type: "invocation",
				},
				{
					id: "c3",
					from: "gateway",
					to: "service-b",
					type: "invocation",
				},
				{
					id: "c4",
					from: "service-a",
					to: "database",
					type: "data-flow",
				},
				{
					id: "c5",
					from: "service-b",
					to: "database",
					type: "data-flow",
				},
				{
					id: "c6",
					from: "frontend",
					to: "database",
					type: "data-flow",
					label: "DIRECT (FALSE)",
				},
				{
					id: "c7",
					from: "service-a",
					to: "service-b",
					type: "data-flow",
					label: "DIRECT (FALSE)",
				},
			],
			trustBoundaries: [
				{
					id: "external",
					label: "External",
					level: "external",
					componentIds: ["frontend"],
				},
				{
					id: "dmz",
					label: "DMZ",
					level: "semi-trusted",
					componentIds: ["gateway"],
				},
				{
					id: "core",
					label: "Trusted Core",
					level: "trusted",
					componentIds: ["service-a", "service-b", "database"],
				},
			],
			layout: "layered",
		},
	},
	{
		visualizationId: makeVizId("fixture19mis"),
		uncertainty: {
			...baseUncertainty,
			limitations: [
				"Diagram shows connections that do not exist in the actual architecture",
				"Direct frontend-to-database access is blocked by gateway",
				"Service-to-service communication goes through gateway, not direct",
			],
			unsupportedInferences: [
				"Frontend can access database directly",
				"Services communicate peer-to-peer",
			],
			boundarySimplificationRisk: true,
		},
	},
);

// ============================================================================
// Fixture 20: Visualization process interrupted by exhausted free inference
// ============================================================================
export const fixture20_inferenceExhausted: VisualizationSpecification =
	createBaseSpec(
		"concept-map",
		{
			type: "concept-map",
			data: {
				nodes: [
					{ id: "n1", label: "Concept A", category: "term" },
					{ id: "n2", label: "Concept B", category: "term" },
					{ id: "n3", label: "Concept C", category: "term" },
				],
				edges: [
					{ id: "e1", from: "n1", to: "n2", type: "related-to" },
					{ id: "e2", from: "n2", to: "n3", type: "related-to" },
				],
				layout: "force-directed",
				clusterByCategory: true,
			},
		},
		{
			visualizationId: makeVizId("fixture20inf"),
			status: {
				renderStatus: "UNAVAILABLE" as const,
				validated: false,
				generatedAt: "2025-01-15T10:00:00Z",
				generatedBy: "test-suite",
				contentHash: makeContentHash(),
				inferenceNote:
					"Model-assisted layout generation skipped: free inference capacity exhausted. Fallback to deterministic layout used.",
			},
		},
	);

// ============================================================================
// All fixtures collection
// ============================================================================

export const allFixtures: VisualizationSpecification[] = [
	fixture1_processDiagram,
	fixture2_architectureDiagram,
	fixture3_comparisonTable,
	fixture4_quantitativeChart,
	fixture5_gartnerFinding,
	fixture6_economicForecast,
	fixture7_timeline,
	fixture8_conceptMap,
	fixture9_causalityRisk,
	fixture10_fabricatedValues,
	fixture11_colorOnly,
	fixture12_inadequateA11y,
	fixture13_mobileLabels,
	fixture14_badTerminology,
	fixture15_interactiveChart,
	fixture16_failedRendering,
	fixture17_missingAsset,
	fixture18_noVisualNeeded,
	fixture19_misleading,
	fixture20_inferenceExhausted,
];

export const validFixtures = allFixtures.filter(
	(f) =>
		f.visualizationId.startsWith("viz_fixture1_") ||
		f.visualizationId.startsWith("viz_fixture2_") ||
		f.visualizationId.startsWith("viz_fixture3_") ||
		f.visualizationId.startsWith("viz_fixture4_") ||
		f.visualizationId.startsWith("viz_fixture5_") ||
		f.visualizationId.startsWith("viz_fixture6_") ||
		f.visualizationId.startsWith("viz_fixture7_") ||
		f.visualizationId.startsWith("viz_fixture8_") ||
		f.visualizationId.startsWith("viz_fixture16_") ||
		f.visualizationId.startsWith("viz_fixture18_") ||
		f.visualizationId.startsWith("viz_fixture20_"),
);

export const invalidFixtures = allFixtures.filter(
	(f) => !validFixtures.includes(f),
);
