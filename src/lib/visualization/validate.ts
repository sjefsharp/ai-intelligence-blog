/**
 * Visualization — Validation & Quality Evaluation
 *
 * Implements automated validation for visualization specifications and rendered assets.
 * Covers factual integrity, explanatory effectiveness, accessibility, visual design,
 * and operational integrity per the acceptance criteria.
 */

import { createHash } from "node:crypto";
import type {
	VisualizationSpecification,
	VisualizationAsset,
	VisualizationType,
	VisualizationEvidenceLink,
	QualityDimension,
} from "./schema.js";

// ============================================================================
// Validation Result Types
// ============================================================================

export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
	warnings: ValidationWarning[];
}

export interface ValidationError {
	code: string;
	message: string;
	path: string;
	severity: "error" | "critical";
}

export interface ValidationWarning {
	code: string;
	message: string;
	path: string;
}

export interface QualityEvaluationResult {
	dimension: QualityDimension;
	score: number; // 0-1
	findings: string[];
	traceableTo: string[];
	passed: boolean;
}

export interface FullValidationReport {
	specificationValid: boolean;
	specValidation: ValidationResult;
	assetValidation: ValidationResult | null;
	accessibilityValidation: ValidationResult | null;
	qualityEvaluation: QualityEvaluationResult[];
	overallScore: number;
	passed: boolean;
}

// ============================================================================
// Specification Validation
// ============================================================================

/**
 * Validates a visualization specification against the schema and business rules.
 */
export function validateVisualizationSpecification(
	spec: VisualizationSpecification,
): ValidationResult {
	const errors: ValidationError[] = [];
	const warnings: ValidationWarning[] = [];

	// Schema validation (Zod will catch structural issues)
	// Business rule validations:

	// 1. Every visualization must have an explanatory purpose
	if (
		!spec.explanatoryPurpose ||
		spec.explanatoryPurpose.trim().length === 0
	) {
		errors.push({
			code: "MISSING_EXPLANATORY_PURPOSE",
			message: "Visualization must have a non-empty explanatory purpose",
			path: "explanatoryPurpose",
			severity: "critical",
		});
	}

	// 2. Must reference at least one candidate and claim
	if (spec.candidateIds.length === 0) {
		errors.push({
			code: "NO_CANDIDATE_REFERENCES",
			message:
				"Visualization must reference at least one candidate from the canonical fact dossier",
			path: "candidateIds",
			severity: "critical",
		});
	}

	if (spec.claimIds.length === 0) {
		errors.push({
			code: "NO_CLAIM_REFERENCES",
			message:
				"Visualization must reference at least one claim from the canonical fact dossier",
			path: "claimIds",
			severity: "critical",
		});
	}

	if (spec.sourceIds.length === 0) {
		errors.push({
			code: "NO_SOURCE_REFERENCES",
			message: "Visualization must reference at least one source",
			path: "sourceIds",
			severity: "critical",
		});
	}

	// 3. Language variants must include both NL and EN for bilingual publications
	const languages = spec.languageVariants.map((v) => v.language);
	if (!languages.includes("nl")) {
		warnings.push({
			code: "MISSING_DUTCH_VARIANT",
			message:
				"Dutch (nl) language variant is missing — bilingual parity requires both languages",
			path: "languageVariants",
		});
	}
	if (!languages.includes("en")) {
		warnings.push({
			code: "MISSING_ENGLISH_VARIANT",
			message:
				"English (en) language variant is missing — bilingual parity requires both languages",
			path: "languageVariants",
		});
	}

	// 4. Each language variant must have required accessibility fields
	spec.languageVariants.forEach((variant, index) => {
		if (!variant.altText || variant.altText.trim().length === 0) {
			errors.push({
				code: "MISSING_ALT_TEXT",
				message: `Language variant ${variant.language} missing alt text (required for screenreaders)`,
				path: `languageVariants[${index}].altText`,
				severity: "critical",
			});
		}
		if (!variant.caption || variant.caption.trim().length === 0) {
			errors.push({
				code: "MISSING_CAPTION",
				message: `Language variant ${variant.language} missing caption`,
				path: `languageVariants[${index}].caption`,
				severity: "error",
			});
		}
		if (
			!variant.longDescription ||
			variant.longDescription.trim().length === 0
		) {
			errors.push({
				code: "MISSING_LONG_DESCRIPTION",
				message: `Language variant ${variant.language} missing long description (required for complex visuals)`,
				path: `languageVariants[${index}].longDescription`,
				severity: "error",
			});
		}
		if (!variant.title || variant.title.trim().length === 0) {
			errors.push({
				code: "MISSING_TITLE",
				message: `Language variant ${variant.language} missing title`,
				path: `languageVariants[${index}].title`,
				severity: "error",
			});
		}
	});

	// 5. Accessibility requirements per visualization type
	validateAccessibilityRequirements(spec, errors, warnings);

	// 6. Uncertainty and limitations must be explicit
	if (spec.uncertainty.assumptions.length === 0) {
		warnings.push({
			code: "NO_ASSUMPTIONS_DOCUMENTED",
			message:
				"No assumptions documented — visualizations should explicitly state material assumptions",
			path: "uncertainty.assumptions",
		});
	}

	// 7. Color-only risk check
	if (spec.uncertainty.colorOnlyRisk) {
		errors.push({
			code: "COLOR_ONLY_RISK",
			message:
				"Visualization uses color as the sole information channel — violates WCAG 1.4.1",
			path: "uncertainty.colorOnlyRisk",
			severity: "critical",
		});
	}

	// 8. Rendering requirements
	if (spec.rendering.outputFormats.length === 0) {
		errors.push({
			code: "NO_OUTPUT_FORMATS",
			message: "At least one output format must be specified",
			path: "rendering.outputFormats",
			severity: "error",
		});
	}

	// 9. Content hash integrity
	if (
		!spec.status.contentHash ||
		!spec.status.contentHash.match(/^sha256:[a-f0-9]{64}$/)
	) {
		errors.push({
			code: "INVALID_CONTENT_HASH",
			message:
				"Content hash must be a valid SHA-256 hash with sha256: prefix",
			path: "status.contentHash",
			severity: "error",
		});
	}

	// 10. Status consistency
	if (spec.status.renderStatus === "VALIDATED" && !spec.status.validated) {
		errors.push({
			code: "STATUS_INCONSISTENCY",
			message: "Render status is VALIDATED but validated flag is false",
			path: "status",
			severity: "error",
		});
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
	};
}

/**
 * Validates accessibility requirements specific to visualization type.
 */
function validateAccessibilityRequirements(
	spec: VisualizationSpecification,
	errors: ValidationError[],
	warnings: ValidationWarning[],
): void {
	const { type, accessibility, data } = spec;

	// Charts require accessible table
	if (type === "quantitative-chart" && !accessibility.hasAccessibleTable) {
		errors.push({
			code: "CHART_MISSING_ACCESSIBLE_TABLE",
			message:
				"Quantitative charts must provide an accessible data table equivalent (WCAG 1.1.1)",
			path: "accessibility.hasAccessibleTable",
			severity: "critical",
		});
	}

	// Complex diagrams require long description
	if (
		["architecture-diagram", "process-diagram", "concept-map"].includes(
			type,
		) &&
		!accessibility.hasLongDescription
	) {
		errors.push({
			code: "DIAGRAM_MISSING_LONG_DESCRIPTION",
			message: `${type} must provide a long description for screenreader users`,
			path: "accessibility.hasLongDescription",
			severity: "critical",
		});
	}

	// Keyboard accessibility for interactive elements
	if (accessibility.keyboardAccessible && !accessibility.focusManagement) {
		warnings.push({
			code: "KEYBOARD_WITHOUT_FOCUS_MANAGEMENT",
			message:
				"Keyboard accessible visualization should declare focus management requirements",
			path: "accessibility.focusManagement",
		});
	}

	// Color contrast verification
	if (
		!accessibility.targetLevel ||
		accessibility.targetLevel === "NOT_APPLICABLE"
	) {
		warnings.push({
			code: "NO_CONTRAST_TARGET",
			message:
				"No WCAG contrast level target specified — defaulting to AA",
			path: "accessibility.targetLevel",
		});
	}

	// Type-specific validations
	if (type === "quantitative-chart") {
		const chartData = data.data as any;
		if (chartData.series) {
			chartData.series.forEach((series: any, idx: number) => {
				series.data.forEach((point: any, pIdx: number) => {
					if (!point.measurement) {
						warnings.push({
							code: "CHART_POINT_MISSING_MEASUREMENT_METADATA",
							message: `Series ${series.id} point ${pIdx} missing measurement metadata (unit, baseline, uncertainty)`,
							path: `data.data.series[${idx}].data[${pIdx}].measurement`,
						});
					}
				});
			});
		}
	}

	if (type === "comparison-table") {
		const tableData = data.data as any;
		if (tableData.columns) {
			tableData.columns.forEach((col: any, idx: number) => {
				if (col.type === "number" && !col.unit) {
					warnings.push({
						code: "NUMERIC_COLUMN_MISSING_UNIT",
						message: `Numeric column "${col.header}" missing unit`,
						path: `data.data.columns[${idx}].unit`,
					});
				}
			});
		}
	}
}

// ============================================================================
// Asset Validation
// ============================================================================

/**
 * Validates a rendered visualization asset.
 */
export function validateVisualizationAsset(
	asset: VisualizationAsset,
	spec: VisualizationSpecification,
): ValidationResult {
	const errors: ValidationError[] = [];
	const warnings: ValidationWarning[] = [];

	// 1. Asset matches specification
	if (asset.visualizationId !== spec.visualizationId) {
		errors.push({
			code: "ASSET_SPEC_MISMATCH",
			message: `Asset visualizationId (${asset.visualizationId}) does not match specification (${spec.visualizationId})`,
			path: "visualizationId",
			severity: "critical",
		});
	}

	if (asset.editionId !== spec.editionId) {
		errors.push({
			code: "ASSET_EDITION_MISMATCH",
			message: `Asset editionId does not match specification`,
			path: "editionId",
			severity: "error",
		});
	}

	if (asset.specContentHash !== spec.status.contentHash) {
		errors.push({
			code: "ASSET_SPEC_HASH_MISMATCH",
			message: `Asset was generated from a different specification version (hash mismatch)`,
			path: "specContentHash",
			severity: "critical",
		});
	}

	// 2. Format matches one of the requested output formats
	if (!spec.rendering.outputFormats.includes(asset.format)) {
		warnings.push({
			code: "ASSET_FORMAT_NOT_REQUESTED",
			message: `Asset format ${asset.format} was not in the specification's requested output formats`,
			path: "format",
		});
	}

	// 3. Language variant exists in specification
	const specHasLanguage = spec.languageVariants.some(
		(v) => v.language === asset.language,
	);
	if (!specHasLanguage) {
		errors.push({
			code: "ASSET_LANGUAGE_NOT_IN_SPEC",
			message: `Asset language ${asset.language} not defined in specification language variants`,
			path: "language",
			severity: "error",
		});
	}

	// 4. Validation status
	if (!asset.validation.passed) {
		errors.push({
			code: "ASSET_VALIDATION_FAILED",
			message: `Asset validation failed: ${asset.validation.errors?.join("; ") || "unknown errors"}`,
			path: "validation",
			severity: "error",
		});
	}

	// 5. Accessibility validation
	if (asset.accessibilityValidation) {
		if (!asset.accessibilityValidation.passed) {
			errors.push({
				code: "ASSET_ACCESSIBILITY_FAILED",
				message: `Asset accessibility validation failed: ${asset.accessibilityValidation.details?.join("; ") || "unknown issues"}`,
				path: "accessibilityValidation",
				severity: "error",
			});
		}

		if (asset.accessibilityValidation.axeViolations > 0) {
			errors.push({
				code: "ASSET_AXE_VIOLATIONS",
				message: `Asset has ${asset.accessibilityValidation.axeViolations} axe-core violations`,
				path: "accessibilityValidation.axeViolations",
				severity: "error",
			});
		}

		if (asset.accessibilityValidation.contrastIssues > 0) {
			errors.push({
				code: "ASSET_CONTRAST_ISSUES",
				message: `Asset has ${asset.accessibilityValidation.contrastIssues} contrast issues`,
				path: "accessibilityValidation.contrastIssues",
				severity: "error",
			});
		}
	}

	// 6. Asset file existence would be checked at build time
	// (This is a structural validation; actual file existence is a build-time check)

	return {
		valid: errors.length === 0,
		errors,
		warnings,
	};
}

// ============================================================================
// Quality Evaluation
// ============================================================================

/**
 * Evaluates visualization quality across five dimensions.
 * Returns deterministic findings where possible, flags model-assisted judgments.
 */
export function evaluateVisualizationQuality(
	spec: VisualizationSpecification,
	asset: VisualizationAsset | null = null,
): QualityEvaluationResult[] {
	const results: QualityEvaluationResult[] = [];

	// 1. Factual Integrity
	results.push(evaluateFactualIntegrity(spec));

	// 2. Explanatory Effectiveness
	results.push(evaluateExplanatoryEffectiveness(spec));

	// 3. Accessibility
	results.push(evaluateAccessibility(spec, asset));

	// 4. Visual Design
	results.push(evaluateVisualDesign(spec));

	// 5. Operational Integrity
	results.push(evaluateOperationalIntegrity(spec, asset));

	return results;
}

function evaluateFactualIntegrity(
	spec: VisualizationSpecification,
): QualityEvaluationResult {
	const findings: string[] = [];
	const traceableTo: string[] = [];
	let score = 1.0;

	// Check all claims have evidence links
	const data = spec.data.data as any;
	let totalElements = 0;
	let elementsWithEvidence = 0;

	function checkEvidenceLinks(obj: any): void {
		if (!obj || typeof obj !== "object") return;
		if (obj.evidenceLinks && Array.isArray(obj.evidenceLinks)) {
			totalElements++;
			if (obj.evidenceLinks.length > 0) {
				elementsWithEvidence++;
				obj.evidenceLinks.forEach((link: VisualizationEvidenceLink) => {
					traceableTo.push(link.claimId);
				});
			}
		}
		Object.values(obj).forEach((v) => checkEvidenceLinks(v));
	}

	checkEvidenceLinks(data);

	if (totalElements > 0) {
		const coverage = elementsWithEvidence / totalElements;
		score = coverage;
		if (coverage < 1.0) {
			findings.push(
				`${Math.round((1 - coverage) * 100)}% of visual elements lack evidence links`,
			);
		}
	} else {
		findings.push("No visual elements with evidence links found");
		score = 0.5;
	}

	// Check uncertainty is documented
	if (spec.uncertainty.assumptions.length === 0) {
		findings.push("No assumptions documented");
		score *= 0.9;
	}
	if (spec.uncertainty.limitations.length === 0) {
		findings.push("No limitations documented");
		score *= 0.9;
	}
	if (spec.uncertainty.causalityRisk) {
		findings.push(
			"Causality risk flagged — visualization may imply unsupported causal relationships",
		);
		score *= 0.7;
	}
	if (spec.uncertainty.boundarySimplificationRisk) {
		findings.push(
			"Boundary simplification risk — critical security/trust boundaries may be oversimplified",
		);
		score *= 0.8;
	}

	return {
		dimension: "factual-integrity",
		score: Math.max(0, Math.min(1, score)),
		findings,
		traceableTo,
		passed: score >= 0.8,
	};
}

function evaluateExplanatoryEffectiveness(
	spec: VisualizationSpecification,
): QualityEvaluationResult {
	const findings: string[] = [];
	const traceableTo: string[] = [spec.explanatoryPurpose];
	let score = 1.0;

	// Explanatory purpose clarity
	if (spec.explanatoryPurpose.length < 50) {
		findings.push(
			"Explanatory purpose may be too brief to convey intended insight",
		);
		score *= 0.9;
	}

	// Type appropriateness (heuristic)
	const type = spec.type;
	const purpose = spec.explanatoryPurpose.toLowerCase();

	const typePurposeMap: Record<VisualizationType, string[]> = {
		"process-diagram": [
			"workflow",
			"sequence",
			"step",
			"decision",
			"pipeline",
			"flow",
		],
		"architecture-diagram": [
			"architecture",
			"component",
			"boundary",
			"trust",
			"system",
			"integration",
		],
		timeline: [
			"timeline",
			"release",
			"history",
			"sequence",
			"date",
			"chronological",
		],
		"comparison-table": [
			"compare",
			"comparison",
			"versus",
			"difference",
			"feature",
			"capability",
		],
		"quantitative-chart": [
			"measure",
			"benchmark",
			"trend",
			"chart",
			"graph",
			"statistic",
			"quantitative",
		],
		"concept-map": [
			"concept",
			"relationship",
			"terminology",
			"taxonomy",
			"ontology",
			"map",
		],
	};

	const relevantKeywords = typePurposeMap[type] || [];
	const keywordMatches = relevantKeywords.filter((k) =>
		purpose.includes(k),
	).length;

	if (keywordMatches === 0) {
		findings.push(
			`Visualization type "${type}" may not match the stated explanatory purpose`,
		);
		score *= 0.8;
	} else {
		findings.push(
			`Type-purpose alignment: ${keywordMatches} relevant keyword(s) matched`,
		);
	}

	// Language variant completeness
	if (spec.languageVariants.length < 2) {
		findings.push(
			"Missing bilingual variants — reduced accessibility for non-default language readers",
		);
		score *= 0.9;
	}

	// Caption and description quality
	spec.languageVariants.forEach((v) => {
		if (v.caption.length < 30) {
			findings.push(`${v.language} caption may be too brief`);
			score *= 0.95;
		}
		if (v.longDescription.length < 100) {
			findings.push(
				`${v.language} long description may be insufficient for complex visual`,
			);
			score *= 0.95;
		}
	});

	return {
		dimension: "explanatory-effectiveness",
		score: Math.max(0, Math.min(1, score)),
		findings,
		traceableTo,
		passed: score >= 0.7,
	};
}

function evaluateAccessibility(
	spec: VisualizationSpecification,
	asset: VisualizationAsset | null,
): QualityEvaluationResult {
	const findings: string[] = [];
	const traceableTo: string[] = [];
	let score = 1.0;

	const { accessibility, rendering, uncertainty } = spec;

	// WCAG target level
	if (accessibility.targetLevel === "AAA") {
		findings.push("Targets WCAG AAA — exemplary");
	} else if (accessibility.targetLevel === "AA") {
		findings.push("Targets WCAG AA — compliant");
	} else {
		findings.push("No explicit WCAG target level");
		score *= 0.8;
	}

	// Color-only check
	if (uncertainty.colorOnlyRisk) {
		findings.push("CRITICAL: Color used as sole information channel");
		score = 0;
	} else {
		findings.push("No color-only information channels detected");
	}

	// Accessible table for charts
	if (spec.type === "quantitative-chart") {
		if (accessibility.hasAccessibleTable) {
			findings.push("Accessible data table provided for chart");
		} else {
			findings.push(
				"MISSING: Accessible data table required for quantitative charts",
			);
			score *= 0.5;
		}
	}

	// Long description for complex diagrams
	if (
		["architecture-diagram", "process-diagram", "concept-map"].includes(
			spec.type,
		)
	) {
		if (accessibility.hasLongDescription) {
			findings.push("Long description provided for complex diagram");
		} else {
			findings.push(
				"MISSING: Long description required for complex diagrams",
			);
			score *= 0.6;
		}
	}

	// Alt text presence
	const allHaveAltText = spec.languageVariants.every(
		(v) => v.altText && v.altText.length > 0,
	);
	if (allHaveAltText) {
		findings.push("All language variants have alt text");
	} else {
		findings.push("Some language variants missing alt text");
		score *= 0.7;
	}

	// Keyboard accessibility
	if (accessibility.keyboardAccessible) {
		if (accessibility.focusManagement) {
			findings.push(
				"Keyboard accessibility with focus management declared",
			);
		} else {
			findings.push(
				"Keyboard accessible but focus management not declared",
			);
			score *= 0.9;
		}
	}

	// Reduced motion
	if (rendering.reducedMotion) {
		findings.push("Reduced motion preference respected");
	} else {
		findings.push("Reduced motion not explicitly handled");
		score *= 0.95;
	}

	// Theme compatibility
	if (
		rendering.themes.includes("dark") &&
		rendering.themes.includes("light")
	) {
		findings.push("Both light and dark theme support declared");
	} else {
		findings.push("Limited theme support");
		score *= 0.9;
	}

	// Asset-level accessibility validation
	if (asset?.accessibilityValidation) {
		if (asset.accessibilityValidation.passed) {
			findings.push("Asset passed automated accessibility validation");
			traceableTo.push("asset.accessibilityValidation");
		} else {
			findings.push(
				`Asset failed accessibility validation: ${asset.accessibilityValidation.details?.join("; ")}`,
			);
			score *= 0.5;
			traceableTo.push("asset.accessibilityValidation");
		}

		if (asset.accessibilityValidation.axeViolations > 0) {
			findings.push(
				`${asset.accessibilityValidation.axeViolations} axe-core violations in rendered asset`,
			);
			score *= 0.3;
		}
	}

	return {
		dimension: "accessibility",
		score: Math.max(0, Math.min(1, score)),
		findings,
		traceableTo,
		passed: score >= 0.8,
	};
}

function evaluateVisualDesign(
	spec: VisualizationSpecification,
): QualityEvaluationResult {
	const findings: string[] = [];
	const traceableTo: string[] = [];
	let score = 1.0;

	const { rendering, type } = spec;

	// Design system compliance (Miura-fold)
	findings.push(
		"Design system compliance: assumes Miura-fold palette, Atkinson/JetBrains Mono fonts",
	);

	// Responsive behavior
	if (rendering.responsive) {
		findings.push("Responsive behavior declared");
		if (rendering.minReadableWidth > 320) {
			findings.push(
				`Minimum readable width: ${rendering.minReadableWidth}px (above 320px baseline)`,
			);
			score *= 0.95;
		}
	} else {
		findings.push("Responsive behavior not declared");
		score *= 0.8;
	}

	// Label readability
	findings.push(
		"Label readability: dependent on SVG text sizing and viewport",
	);

	// Visual hierarchy
	findings.push(
		"Visual hierarchy: follows Miura-fold heading/typography scale",
	);

	// Decoration restraint
	if (type === "quantitative-chart" || type === "comparison-table") {
		findings.push(
			"Data visualization type — decorative elements minimized by design",
		);
	}

	// Theme switching
	if (
		rendering.colorScheme.contrastAA &&
		rendering.colorScheme.highContrast
	) {
		findings.push(
			"Color scheme supports AA contrast and high contrast mode",
		);
	} else {
		findings.push(
			"Color scheme may not meet contrast requirements in all modes",
		);
		score *= 0.9;
	}

	return {
		dimension: "visual-design",
		score: Math.max(0, Math.min(1, score)),
		findings,
		traceableTo,
		passed: score >= 0.7,
	};
}

function evaluateOperationalIntegrity(
	spec: VisualizationSpecification,
	asset: VisualizationAsset | null,
): QualityEvaluationResult {
	const findings: string[] = [];
	const traceableTo: string[] = [];
	let score = 1.0;

	const { status } = spec;

	// Render status
	switch (status.renderStatus) {
		case "VALIDATED":
			findings.push("Render status: VALIDATED");
			break;
		case "RENDERED":
			findings.push("Render status: RENDERED (not yet validated)");
			score *= 0.9;
			break;
		case "READY":
			findings.push("Render status: READY (not yet rendered)");
			score *= 0.8;
			break;
		case "FAILED":
			findings.push("Render status: FAILED");
			score = 0;
			break;
		case "UNAVAILABLE":
			findings.push("Render status: UNAVAILABLE (missing data)");
			score *= 0.5;
			break;
	}

	// Validation status
	if (status.validated) {
		findings.push("Specification validated");
	} else {
		findings.push("Specification not yet validated");
		score *= 0.8;
	}

	// Content hash integrity
	if (
		status.contentHash &&
		status.contentHash.match(/^sha256:[a-f0-9]{64}$/)
	) {
		findings.push("Content hash present and valid");
	} else {
		findings.push("Content hash missing or invalid");
		score *= 0.7;
	}

	// Asset validation
	if (asset) {
		if (asset.validation.passed) {
			findings.push("Asset validation passed");
			traceableTo.push("asset.validation");
		} else {
			findings.push(
				`Asset validation failed: ${asset.validation.errors?.join("; ")}`,
			);
			score *= 0.3;
			traceableTo.push("asset.validation");
		}

		if (asset.specContentHash === spec.status.contentHash) {
			findings.push("Asset matches current specification version");
		} else {
			findings.push("Asset specification hash mismatch");
			score *= 0.5;
		}
	} else {
		findings.push("No rendered asset available for validation");
		score *= 0.7;
	}

	// Idempotent generation (check previousVersionHash)
	if (status.previousVersionHash) {
		findings.push("Version chain maintained via previousVersionHash");
	}

	// Reproducibility
	findings.push(
		"Reproducibility: deterministic TypeScript rendering, no external APIs",
	);

	return {
		dimension: "operational-integrity",
		score: Math.max(0, Math.min(1, score)),
		findings,
		traceableTo,
		passed: score >= 0.8,
	};
}

// ============================================================================
// Full Validation Pipeline
// ============================================================================

/**
 * Runs the complete validation pipeline for a visualization specification and optional asset.
 */
export function runFullValidation(
	spec: VisualizationSpecification,
	asset: VisualizationAsset | null = null,
): FullValidationReport {
	const specValidation = validateVisualizationSpecification(spec);
	const assetValidation = asset
		? validateVisualizationAsset(asset, spec)
		: null;
	const qualityEvaluation = evaluateVisualizationQuality(spec, asset);

	// Accessibility validation (separate from quality evaluation for gating)
	const accessibilityValidation = validateAccessibilityOnly(spec, asset);

	// Overall score (weighted)
	const dimensionScores = qualityEvaluation.reduce(
		(sum, q) => sum + q.score,
		0,
	);
	const avgQualityScore =
		qualityEvaluation.length > 0
			? dimensionScores / qualityEvaluation.length
			: 0;

	const overallScore =
		(specValidation.valid ? 1 : 0) * 0.3 +
		(assetValidation?.valid !== false ? 1 : 0) * 0.2 +
		(accessibilityValidation.valid ? 1 : 0) * 0.3 +
		avgQualityScore * 0.2;

	const passed =
		specValidation.valid &&
		assetValidation?.valid !== false &&
		accessibilityValidation.valid &&
		overallScore >= 0.7;

	return {
		specificationValid: specValidation.valid,
		specValidation,
		assetValidation,
		accessibilityValidation,
		qualityEvaluation,
		overallScore,
		passed,
	};
}

/**
 * Validates only accessibility requirements (for gating).
 */
function validateAccessibilityOnly(
	spec: VisualizationSpecification,
	asset: VisualizationAsset | null,
): ValidationResult {
	const errors: ValidationError[] = [];
	const warnings: ValidationWarning[] = [];

	// Critical accessibility gates
	const { accessibility, type, uncertainty } = spec;

	// Color-only is a hard blocker
	if (uncertainty.colorOnlyRisk) {
		errors.push({
			code: "A11Y_COLOR_ONLY",
			message:
				"Visualization uses color as sole information channel (WCAG 1.4.1 violation)",
			path: "uncertainty.colorOnlyRisk",
			severity: "critical",
		});
	}

	// Charts require accessible table
	if (type === "quantitative-chart" && !accessibility.hasAccessibleTable) {
		errors.push({
			code: "A11Y_CHART_NO_TABLE",
			message:
				"Quantitative chart missing required accessible data table",
			path: "accessibility.hasAccessibleTable",
			severity: "critical",
		});
	}

	// Complex diagrams require long description
	if (
		["architecture-diagram", "process-diagram", "concept-map"].includes(
			type,
		) &&
		!accessibility.hasLongDescription
	) {
		errors.push({
			code: "A11Y_DIAGRAM_NO_LONG_DESC",
			message: `${type} missing required long description for screenreader users`,
			path: "accessibility.hasLongDescription",
			severity: "critical",
		});
	}

	// Alt text required for all
	spec.languageVariants.forEach((v, i) => {
		if (!v.altText || v.altText.trim().length === 0) {
			errors.push({
				code: "A11Y_MISSING_ALT",
				message: `Language variant ${v.language} missing alt text`,
				path: `languageVariants[${i}].altText`,
				severity: "critical",
			});
		}
	});

	// Asset accessibility
	if (
		asset?.accessibilityValidation &&
		!asset.accessibilityValidation.passed
	) {
		errors.push({
			code: "A11Y_ASSET_FAILED",
			message: `Rendered asset failed accessibility validation: ${asset.accessibilityValidation.details?.join("; ")}`,
			path: "asset.accessibilityValidation",
			severity: "critical",
		});
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
	};
}

// ============================================================================
// Utility: Generate Content Hash
// ============================================================================

/**
 * Generates a SHA-256 content hash for a visualization specification.
 * Excludes volatile fields (timestamps, status).
 */
export function generateVisualizationContentHash(
	spec: Omit<VisualizationSpecification, "status">,
): string {
	// Create a stable representation excluding volatile fields
	const stableSpec = {
		...spec,
		status: undefined,
	} as any;

	// Deterministic JSON serialization
	const canonicalJson = JSON.stringify(
		stableSpec,
		Object.keys(stableSpec).sort(),
	);
	const hash = createHash("sha256")
		.update(canonicalJson, "utf8")
		.digest("hex");
	return `sha256:${hash}`;
}

/**
 * Generates a SHA-256 content hash for a visualization asset.
 */
export function generateAssetContentHash(
	asset: Omit<
		VisualizationAsset,
		"contentHash" | "validation" | "accessibilityValidation"
	>,
): string {
	const stableAsset = {
		...asset,
		contentHash: undefined,
		validation: undefined,
		accessibilityValidation: undefined,
	} as any;
	const canonicalJson = JSON.stringify(
		stableAsset,
		Object.keys(stableAsset).sort(),
	);
	const hash = createHash("sha256")
		.update(canonicalJson, "utf8")
		.digest("hex");
	return `sha256:${hash}`;
}
