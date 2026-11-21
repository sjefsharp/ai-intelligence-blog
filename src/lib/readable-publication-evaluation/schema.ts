/**
 * Readable Publication Quality Evaluation — Schema Layer
 *
 * Defines the authoritative, versioned, machine-readable data contract for the
 * readable-publication quality evaluation framework. The evaluation assesses the
 * Dutch canonical publication (publication.md) and English website article
 * derivative (english-derivative) against criteria covering:
 *
 * - First-screen clarity and immediate orientation
 * - Progressive disclosure and information hierarchy
 * - ADHD-aware cognitive accessibility
 * - Technical and scientific depth preservation
 * - Scientific and strategic research quality
 * - Factual fidelity and claim traceability
 * - Source transparency and research accessibility
 * - Editorial coherence and narrative structure
 * - Vendor neutrality and interdisciplinary balance
 * - Visual explanation integration
 * - WCAG 2.2 AA content-level accessibility
 * - Bilingual editorial quality
 *
 * Processing sequence preserved:
 *   Source Discovery → Retrieval → Temporal Classification → Claim Verification
 *     → Canonical Fact Dossier → Omission Review → Historical Regression
 *     → Editorial Selection → Publication Production → Visual Explanation
 *     → Readable Quality Evaluation (this module)
 *     → Publication Validation → Deployment
 */

import { z } from "astro/zod";

import type { CanonicalFactDossier } from "../fact-dossier/schema.js";
import type { EditorialSelectionManifest } from "../editorial-selection/schema.js";
import type { HistoricalRegressionReport } from "../historical-regression/schema.js";
import type {
	ArticleIdentity,
	PublicationMetadata,
} from "../publication/schema.js";
import type { VisualizationSpecification } from "../visualization/schema.js";

// ============================================================================
// Constants
// ============================================================================

/** Current readable publication evaluation schema version. */
export const READABLE_QUALITY_EVALUATION_SCHEMA_VERSION = "1.0.0";

/** Prefix for evaluation report identifiers. */
export const READABLE_EVALUATION_REPORT_ID_PREFIX = "rqe_";

/** Prefix for individual criterion evaluation identifiers. */
export const READABLE_CRITERION_EVALUATION_ID_PREFIX = "rcqe_";

/** Prefix for repair action identifiers. */
export const READABLE_REPAIR_ACTION_ID_PREFIX = "rqr_";

/**
 * Readable publication evaluation criterion identifiers.
 * These correspond to the 14 evaluation areas specified in the requirements.
 */
export const READABLE_CRITERIA = [
	"RPE1", // First-screen clarity and immediate orientation
	"RPE2", // Progressive disclosure and information hierarchy
	"RPE3", // ADHD-aware cognitive accessibility
	"RPE4", // Technical and scientific depth preservation
	"RPE5", // Scientific and strategic research quality
	"RPE6", // Factual fidelity and claim traceability
	"RPE7", // Source transparency and research accessibility
	"RPE8", // Editorial coherence and narrative structure
	"RPE9", // Vendor neutrality and interdisciplinary balance
	"RPE10", // Visual explanation integration
	"RPE11", // WCAG 2.2 AA content-level accessibility
	"RPE12", // Bilingual editorial quality (Dutch)
	"RPE13", // Bilingual editorial quality (English)
	"RPE14", // Cross-language factual consistency
] as const;

/** Evaluation statuses per specification. */
export const CriterionEvaluationStatusSchema = z.enum([
	"PASS",
	"FAIL",
	"UNVERIFIED",
	"NOT_ASSESSABLE",
]);

/** Severity levels per specification. */
export const SeverityLevelSchema = z.enum([
	"CRITICAL",
	"MAJOR",
	"MINOR",
	"ADVISORY",
]);

/** Evaluation method type. */
export const EvaluationMethodSchema = z.enum([
	"deterministic",
	"model-assisted",
	"evidence-based",
]);

/** Repair action status. */
export const RepairActionStatusSchema = z.enum([
	"proposed",
	"applied",
	"rejected",
	"failed",
]);

/** Evaluation scope. */
export const EvaluationScopeSchema = z.enum([
	"full-edition",
	"per-article",
	"opening-screen",
	"transitions",
	"conclusion",
	"specific-passage",
	"visual-explanation",
]);

/** Language of the publication being evaluated. */
export const EvaluationLanguageSchema = z.enum(["nl", "en", "both"]);

// ============================================================================
// Core Evaluation Types
// ============================================================================

/** Reference to a specific passage in the publication. */
export const PassageReferenceSchema = z.strictObject({
	/** Approximate character offset from start of markdown. */
	characterOffset: z.number().int().nonnegative(),
	/** Approximate line number. */
	lineNumber: z.number().int().positive().optional(),
	/** Section heading if identifiable. */
	sectionHeading: z.string().optional(),
	/** Quote from the passage (first 200 chars). */
	quote: z.string().max(500),
	/** Related story ID if applicable. */
	storyId: z
		.string()
		.regex(/^story_[a-z0-9]{16}$/)
		.optional(),
	/** Related article ID if applicable. */
	articleId: z
		.string()
		.regex(/^art_[a-z0-9]{16}$/)
		.optional(),
	/** Language of the passage. */
	language: z.enum(["nl", "en"]).optional(),
});

/** Evidence supporting a criterion evaluation. */
export const EvaluationEvidenceSchema = z.strictObject({
	/** Type of evidence. */
	type: EvaluationMethodSchema,
	/** Description of the evidence. */
	description: z.string().min(1),
	/** Passage references. */
	passageReferences: z.array(PassageReferenceSchema),
	/** Claim IDs relevant to this evidence. */
	claimIds: z.array(z.string().regex(/^claim_[a-z0-9]{16}$/)),
	/** Source IDs relevant to this evidence. */
	sourceIds: z.array(z.string()),
	/** Additional structured data. */
	metadata: z.record(z.string(), z.unknown()).optional(),
});

/** Individual criterion evaluation result. */
export const ReadableCriterionEvaluationSchema = z.strictObject({
	/** Criterion identifier (RPE1-RPE14). */
	criterionId: z.enum(READABLE_CRITERIA),
	/** Unique evaluation ID. */
	evaluationId: z.string().regex(/^rcqe_[a-z0-9]{16}$/),
	/** Evaluation status. */
	status: CriterionEvaluationStatusSchema,
	/** Severity if FAIL. */
	severity: SeverityLevelSchema.optional(),
	/** Scope of evaluation. */
	scope: EvaluationScopeSchema,
	/** Language(s) evaluated. */
	language: EvaluationLanguageSchema,
	/** Human-readable summary of the evaluation. */
	summary: z.string().min(1),
	/** Detailed rationale. */
	rationale: z.string().min(1),
	/** Supporting evidence. */
	evidence: z.array(EvaluationEvidenceSchema),
	/** Passage references for quick navigation. */
	passageReferences: z.array(PassageReferenceSchema),
	/** Whether a corrective action was attempted. */
	repairAttempted: z.boolean().default(false),
	/** Repair action ID if applicable. */
	repairActionId: z
		.string()
		.regex(/^rqr_[a-z0-9]{16}$/)
		.optional(),
	/** Reassessment result after repair. */
	reassessment: z
		.strictObject({
			status: CriterionEvaluationStatusSchema,
			summary: z.string(),
			reassessedAt: z.string(),
		})
		.optional(),
	/** Residual uncertainty after evaluation. */
	residualUncertainty: z.string().optional(),
	/** Evaluation method used. */
	method: EvaluationMethodSchema,
	/** Timestamp of evaluation. */
	evaluatedAt: z.string(),
	/** Evaluator identifier (model or deterministic). */
	evaluatedBy: z.string(),
	/** Reference to visualization evaluation when applicable. */
	visualizationReferences: z.array(z.string()).optional(),
});

/** Repair action record. */
export const ReadableRepairActionSchema = z.strictObject({
	repairActionId: z.string().regex(/^rqr_[a-z0-9]{16}$/),
	criterionId: z.enum(READABLE_CRITERIA),
	evaluationId: z.string().regex(/^rcqe_[a-z0-9]{16}$/),
	/** Type of issue being repaired. */
	issueType: z.enum([
		"factual",
		"structural",
		"explanatory",
		"stylistic",
		"accessibility",
	]),
	/** Description of the observable problem. */
	problemDescription: z.string().min(1),
	/** Exact affected passage. */
	affectedPassage: PassageReferenceSchema,
	/** Proposed correction. */
	proposedCorrection: z.string().min(1),
	/** Whether the correction preserves canonical facts. */
	preservesCanonicalFacts: z.boolean(),
	/** Whether the correction preserves editorial selection. */
	preservesEditorialSelection: z.boolean(),
	/** Whether the correction preserves bilingual consistency. */
	preservesBilingualConsistency: z.boolean(),
	/** Status of the repair. */
	status: RepairActionStatusSchema,
	/** Applied correction (if applied). */
	appliedCorrection: z.string().optional(),
	/** Timestamp of proposal. */
	proposedAt: z.string(),
	/** Timestamp of application (if applied). */
	appliedAt: z.string().optional(),
	/** Regression check results. */
	regressionChecks: z
		.array(
			z.strictObject({
				check: z.string(),
				passed: z.boolean(),
				details: z.string().optional(),
			}),
		)
		.default([]),
	/** Residual uncertainty after repair. */
	residualUncertainty: z.string().optional(),
});

/** Holistic readable publication assessment. */
export const HolisticReadableAssessmentSchema = z.strictObject({
	/** Whether the opening establishes effective reading context. */
	openingEstablishesContext: z.strictObject({
		status: CriterionEvaluationStatusSchema,
		summary: z.string(),
		rationale: z.string(),
		evidence: z.array(EvaluationEvidenceSchema),
	}),
	/** Whether the progression between articles is intelligible. */
	progressionIntelligible: z.strictObject({
		status: CriterionEvaluationStatusSchema,
		summary: z.string(),
		rationale: z.string(),
		evidence: z.array(EvaluationEvidenceSchema),
	}),
	/** Whether information density changes appropriately with complexity. */
	informationDensityAppropriate: z.strictObject({
		status: CriterionEvaluationStatusSchema,
		summary: z.string(),
		rationale: z.string(),
		evidence: z.array(EvaluationEvidenceSchema),
	}),
	/** Whether important concepts remain understandable across the edition. */
	conceptsRemainUnderstandable: z.strictObject({
		status: CriterionEvaluationStatusSchema,
		summary: z.string(),
		rationale: z.string(),
		evidence: z.array(EvaluationEvidenceSchema),
	}),
	/** Whether transitions provide sufficient reorientation. */
	transitionsProvideReorientation: z.strictObject({
		status: CriterionEvaluationStatusSchema,
		summary: z.string(),
		rationale: z.string(),
		evidence: z.array(EvaluationEvidenceSchema),
	}),
	/** Whether scientific, technical and strategic content receive appropriate depth. */
	contentDepthAppropriate: z.strictObject({
		status: CriterionEvaluationStatusSchema,
		summary: z.string(),
		rationale: z.string(),
		evidence: z.array(EvaluationEvidenceSchema),
	}),
	/** Whether the publication maintains factual integrity throughout. */
	factualIntegrityMaintained: z.strictObject({
		status: CriterionEvaluationStatusSchema,
		summary: z.string(),
		rationale: z.string(),
		evidence: z.array(EvaluationEvidenceSchema),
	}),
	/** Whether the conclusion follows naturally from the actual developments. */
	conclusionNatural: z.strictObject({
		status: CriterionEvaluationStatusSchema,
		summary: z.string(),
		rationale: z.string(),
		evidence: z.array(EvaluationEvidenceSchema),
	}),
	/** Whether the reader can understand the essential news without excessive scrolling. */
	screenIndependentUnderstanding: z.strictObject({
		status: CriterionEvaluationStatusSchema,
		summary: z.string(),
		rationale: z.string(),
		evidence: z.array(EvaluationEvidenceSchema),
	}),
	/** Whether Dutch and English versions are factually consistent. */
	bilingualConsistencyMaintained: z.strictObject({
		status: CriterionEvaluationStatusSchema,
		summary: z.string(),
		rationale: z.string(),
		evidence: z.array(EvaluationEvidenceSchema),
	}),
	/** Whether visual explanations materially improve comprehension. */
	visualsImproveComprehension: z.strictObject({
		status: CriterionEvaluationStatusSchema,
		summary: z.string(),
		rationale: z.string(),
		evidence: z.array(EvaluationEvidenceSchema),
	}),
	/** Whether WCAG 2.2 AA content requirements are met. */
	wcagContentCompliance: z.strictObject({
		status: CriterionEvaluationStatusSchema,
		summary: z.string(),
		rationale: z.string(),
		evidence: z.array(EvaluationEvidenceSchema),
	}),
	/** Identified trade-offs between criteria (e.g., technical depth vs cognitive load). */
	tradeoffs: z
		.array(
			z.strictObject({
				criteria: z.array(z.string()),
				description: z.string(),
				severity: SeverityLevelSchema,
				recommendation: z.string(),
			}),
		)
		.default([]),
	/** Overall holistic assessment status. */
	overallStatus: CriterionEvaluationStatusSchema,
	/** Overall holistic assessment summary. */
	overallSummary: z.string(),
	/** Residual uncertainty. */
	residualUncertainty: z.string().optional(),
	/** Evaluated at timestamp. */
	evaluatedAt: z.string(),
	/** Evaluator identifier. */
	evaluatedBy: z.string(),
	/** Evaluation method. */
	method: EvaluationMethodSchema,
});

/** Complete readable quality evaluation report. */
export const ReadableQualityEvaluationReportSchema = z.strictObject({
	schemaVersion: z.literal(READABLE_QUALITY_EVALUATION_SCHEMA_VERSION),
	reportId: z.string().regex(/^rqe_[a-z0-9]{16}$/),
	editionId: z.string().regex(/^edition_\d{4}-\d{2}-\d{2}$/),
	editionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	/** Reference to the Dutch canonical publication artifact. */
	dutchPublicationArtifactId: z.string().regex(/^pubart_[a-z0-9]{16}$/),
	/** Reference to the English derivative artifact. */
	englishPublicationArtifactId: z
		.string()
		.regex(/^pubart_[a-z0-9]{16}$/)
		.optional(),
	/** Reference to the canonical fact dossier. */
	factDossierId: z.string().regex(/^fd_[a-z0-9]{16}$/),
	/** Reference to the editorial selection manifest. */
	editorialSelectionManifestId: z.string().regex(/^esm_[a-z0-9]{16}$/),
	/** Individual criterion evaluations (14 criteria). */
	criterionEvaluations: z
		.array(ReadableCriterionEvaluationSchema)
		.min(14)
		.max(14),
	/** Holistic readable publication assessment. */
	holisticReadableAssessment: HolisticReadableAssessmentSchema.optional(),
	/** Repair actions taken during evaluation. */
	repairActions: z.array(ReadableRepairActionSchema),
	/** Overall evaluation summary. */
	overallSummary: z.strictObject({
		passedCount: z.number().int().min(0).max(14),
		failedCount: z.number().int().min(0).max(14),
		unverifiedCount: z.number().int().min(0).max(14),
		notAssessableCount: z.number().int().min(0).max(14),
		criticalFailures: z.number().int().nonnegative(),
		majorFailures: z.number().int().nonnegative(),
		blockingAcceptance: z.boolean(),
		repairActionsTaken: z.number().int().nonnegative(),
		repairActionsSuccessful: z.number().int().nonnegative(),
	}),
	/** Evaluation metadata. */
	metadata: z.strictObject({
		evaluatedAt: z.string(),
		evaluatedBy: z.string(),
		modelAssistedEvaluations: z.number().int().nonnegative(),
		deterministicEvaluations: z.number().int().nonnegative(),
		totalInferenceRequests: z.number().int().nonnegative(),
		totalInferenceTokens: z.number().int().nonnegative(),
		inferenceProvidersUsed: z.array(z.string()),
		validationMode: z.boolean(),
	}),
	/** Content hash for integrity verification. */
	contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
});

// ============================================================================
// Evaluation Input Types
// ============================================================================

/** Input data for readable quality evaluation. */
export interface ReadableQualityEvaluationInput {
	editionDate: string;
	editionId: string;
	dutchPublicationMarkdown: string;
	dutchPublicationArtifactId: string;
	dutchPublicationTraceability: {
		segments: Array<{
			type: string;
			claimIds: string[];
			sourceIds: string[];
			storyId?: string;
		}>;
		claimCoverage: string[];
		sourceCoverage: string[];
		storyCoverage: string[];
	};
	englishPublicationMarkdown?: string;
	englishPublicationArtifactId?: string;
	englishPublicationTraceability?: {
		segments: Array<{
			type: string;
			claimIds: string[];
			sourceIds: string[];
			storyId?: string;
		}>;
		claimCoverage: string[];
		sourceCoverage: string[];
		storyCoverage: string[];
	};
	factDossier: CanonicalFactDossier;
	editorialManifest: EditorialSelectionManifest;
	historicalRegression: HistoricalRegressionReport | null;
	publicationMetadata: PublicationMetadata;
	articleIdentities: ArticleIdentity[];
	visualizations: VisualizationSpecification[];
	validationMode?: boolean;
}

/** Full traceability from publication generation. */
export interface PublicationTraceability {
	segments: Array<{
		type: string;
		claimIds: string[];
		sourceIds: string[];
		storyId?: string;
	}>;
	claimCoverage: string[];
	sourceCoverage: string[];
	storyCoverage: string[];
}

// ============================================================================
// Inferred TypeScript Types
// ============================================================================

export type ReadableCriterionId = (typeof READABLE_CRITERIA)[number];
export type CriterionEvaluationStatus = z.infer<
	typeof CriterionEvaluationStatusSchema
>;
export type SeverityLevel = z.infer<typeof SeverityLevelSchema>;
export type EvaluationMethod = z.infer<typeof EvaluationMethodSchema>;
export type RepairActionStatus = z.infer<typeof RepairActionStatusSchema>;
export type EvaluationScope = z.infer<typeof EvaluationScopeSchema>;
export type EvaluationLanguage = z.infer<typeof EvaluationLanguageSchema>;
export type PassageReference = z.infer<typeof PassageReferenceSchema>;
export type EvaluationEvidence = z.infer<typeof EvaluationEvidenceSchema>;
export type ReadableCriterionEvaluation = z.infer<
	typeof ReadableCriterionEvaluationSchema
>;
export type ReadableRepairAction = z.infer<typeof ReadableRepairActionSchema>;
export type HolisticReadableAssessment = z.infer<
	typeof HolisticReadableAssessmentSchema
>;
export type ReadableQualityEvaluationReport = z.infer<
	typeof ReadableQualityEvaluationReportSchema
>;
export type OverallSummary = ReadableQualityEvaluationReport["overallSummary"];
export type EvaluationMetadata = ReadableQualityEvaluationReport["metadata"];

// ============================================================================
// JSON Schema Generation
// ============================================================================

/**
 * Generate the draft-07 JSON Schema for the readable quality evaluation report.
 */
export function generateReadableQualityEvaluationJsonSchema(): Record<
	string,
	unknown
> {
	const reportSchemaForJson = z.object({
		schemaVersion: z.literal(READABLE_QUALITY_EVALUATION_SCHEMA_VERSION),
		reportId: z.string(),
		editionId: z.string(),
		editionDate: z.string(),
		dutchPublicationArtifactId: z.string(),
		englishPublicationArtifactId: z.string().optional(),
		factDossierId: z.string(),
		editorialSelectionManifestId: z.string(),
		criterionEvaluations: z
			.array(
				z.object({
					criterionId: z.string(),
					evaluationId: z.string(),
					status: CriterionEvaluationStatusSchema,
					severity: SeverityLevelSchema.optional(),
					scope: EvaluationScopeSchema,
					language: EvaluationLanguageSchema,
					summary: z.string(),
					rationale: z.string(),
					evidence: z.array(
						z.object({
							type: EvaluationMethodSchema,
							description: z.string(),
							passageReferences: z.array(PassageReferenceSchema),
							claimIds: z.array(z.string()),
							sourceIds: z.array(z.string()),
							metadata: z
								.record(z.string(), z.unknown())
								.optional(),
						}),
					),
					passageReferences: z.array(PassageReferenceSchema),
					repairAttempted: z.boolean(),
					repairActionId: z.string().optional(),
					reassessment: z
						.object({
							status: CriterionEvaluationStatusSchema,
							summary: z.string(),
							reassessedAt: z.string(),
						})
						.optional(),
					residualUncertainty: z.string().optional(),
					method: EvaluationMethodSchema,
					evaluatedAt: z.string(),
					evaluatedBy: z.string(),
					visualizationReferences: z.array(z.string()).optional(),
				}),
			)
			.length(14),
		holisticReadableAssessment: z
			.object({
				openingEstablishesContext: z.object({
					status: CriterionEvaluationStatusSchema,
					summary: z.string(),
					rationale: z.string(),
					evidence: z.array(
						z.object({
							type: EvaluationMethodSchema,
							description: z.string(),
							passageReferences: z.array(PassageReferenceSchema),
							claimIds: z.array(z.string()),
							sourceIds: z.array(z.string()),
						}),
					),
				}),
				progressionIntelligible: z.object({
					status: CriterionEvaluationStatusSchema,
					summary: z.string(),
					rationale: z.string(),
					evidence: z.array(
						z.object({
							type: EvaluationMethodSchema,
							description: z.string(),
							passageReferences: z.array(PassageReferenceSchema),
							claimIds: z.array(z.string()),
							sourceIds: z.array(z.string()),
						}),
					),
				}),
				informationDensityAppropriate: z.object({
					status: CriterionEvaluationStatusSchema,
					summary: z.string(),
					rationale: z.string(),
					evidence: z.array(
						z.object({
							type: EvaluationMethodSchema,
							description: z.string(),
							passageReferences: z.array(PassageReferenceSchema),
							claimIds: z.array(z.string()),
							sourceIds: z.array(z.string()),
						}),
					),
				}),
				conceptsRemainUnderstandable: z.object({
					status: CriterionEvaluationStatusSchema,
					summary: z.string(),
					rationale: z.string(),
					evidence: z.array(
						z.object({
							type: EvaluationMethodSchema,
							description: z.string(),
							passageReferences: z.array(PassageReferenceSchema),
							claimIds: z.array(z.string()),
							sourceIds: z.array(z.string()),
						}),
					),
				}),
				transitionsProvideReorientation: z.object({
					status: CriterionEvaluationStatusSchema,
					summary: z.string(),
					rationale: z.string(),
					evidence: z.array(
						z.object({
							type: EvaluationMethodSchema,
							description: z.string(),
							passageReferences: z.array(PassageReferenceSchema),
							claimIds: z.array(z.string()),
							sourceIds: z.array(z.string()),
						}),
					),
				}),
				contentDepthAppropriate: z.object({
					status: CriterionEvaluationStatusSchema,
					summary: z.string(),
					rationale: z.string(),
					evidence: z.array(
						z.object({
							type: EvaluationMethodSchema,
							description: z.string(),
							passageReferences: z.array(PassageReferenceSchema),
							claimIds: z.array(z.string()),
							sourceIds: z.array(z.string()),
						}),
					),
				}),
				factualIntegrityMaintained: z.object({
					status: CriterionEvaluationStatusSchema,
					summary: z.string(),
					rationale: z.string(),
					evidence: z.array(
						z.object({
							type: EvaluationMethodSchema,
							description: z.string(),
							passageReferences: z.array(PassageReferenceSchema),
							claimIds: z.array(z.string()),
							sourceIds: z.array(z.string()),
						}),
					),
				}),
				conclusionNatural: z.object({
					status: CriterionEvaluationStatusSchema,
					summary: z.string(),
					rationale: z.string(),
					evidence: z.array(
						z.object({
							type: EvaluationMethodSchema,
							description: z.string(),
							passageReferences: z.array(PassageReferenceSchema),
							claimIds: z.array(z.string()),
							sourceIds: z.array(z.string()),
						}),
					),
				}),
				screenIndependentUnderstanding: z.object({
					status: CriterionEvaluationStatusSchema,
					summary: z.string(),
					rationale: z.string(),
					evidence: z.array(
						z.object({
							type: EvaluationMethodSchema,
							description: z.string(),
							passageReferences: z.array(PassageReferenceSchema),
							claimIds: z.array(z.string()),
							sourceIds: z.array(z.string()),
						}),
					),
				}),
				bilingualConsistencyMaintained: z.object({
					status: CriterionEvaluationStatusSchema,
					summary: z.string(),
					rationale: z.string(),
					evidence: z.array(
						z.object({
							type: EvaluationMethodSchema,
							description: z.string(),
							passageReferences: z.array(PassageReferenceSchema),
							claimIds: z.array(z.string()),
							sourceIds: z.array(z.string()),
						}),
					),
				}),
				visualsImproveComprehension: z.object({
					status: CriterionEvaluationStatusSchema,
					summary: z.string(),
					rationale: z.string(),
					evidence: z.array(
						z.object({
							type: EvaluationMethodSchema,
							description: z.string(),
							passageReferences: z.array(PassageReferenceSchema),
							claimIds: z.array(z.string()),
							sourceIds: z.array(z.string()),
						}),
					),
				}),
				wcagContentCompliance: z.object({
					status: CriterionEvaluationStatusSchema,
					summary: z.string(),
					rationale: z.string(),
					evidence: z.array(
						z.object({
							type: EvaluationMethodSchema,
							description: z.string(),
							passageReferences: z.array(PassageReferenceSchema),
							claimIds: z.array(z.string()),
							sourceIds: z.array(z.string()),
						}),
					),
				}),
				tradeoffs: z.array(
					z.object({
						criteria: z.array(z.string()),
						description: z.string(),
						severity: SeverityLevelSchema,
						recommendation: z.string(),
					}),
				),
				overallStatus: CriterionEvaluationStatusSchema,
				overallSummary: z.string(),
				residualUncertainty: z.string().optional(),
				evaluatedAt: z.string(),
				evaluatedBy: z.string(),
				method: EvaluationMethodSchema,
			})
			.optional(),
		repairActions: z.array(
			z.object({
				repairActionId: z.string(),
				criterionId: z.string(),
				evaluationId: z.string(),
				issueType: z.enum([
					"factual",
					"structural",
					"explanatory",
					"stylistic",
					"accessibility",
				]),
				problemDescription: z.string(),
				affectedPassage: PassageReferenceSchema,
				proposedCorrection: z.string(),
				preservesCanonicalFacts: z.boolean(),
				preservesEditorialSelection: z.boolean(),
				preservesBilingualConsistency: z.boolean(),
				status: RepairActionStatusSchema,
				appliedCorrection: z.string().optional(),
				proposedAt: z.string(),
				appliedAt: z.string().optional(),
				regressionChecks: z.array(
					z.object({
						check: z.string(),
						passed: z.boolean(),
						details: z.string().optional(),
					}),
				),
				residualUncertainty: z.string().optional(),
			}),
		),
		overallSummary: z.object({
			passedCount: z.number().int().min(0).max(14),
			failedCount: z.number().int().min(0).max(14),
			unverifiedCount: z.number().int().min(0).max(14),
			notAssessableCount: z.number().int().min(0).max(14),
			criticalFailures: z.number().int().nonnegative(),
			majorFailures: z.number().int().nonnegative(),
			blockingAcceptance: z.boolean(),
			repairActionsTaken: z.number().int().nonnegative(),
			repairActionsSuccessful: z.number().int().nonnegative(),
		}),
		metadata: z.object({
			evaluatedAt: z.string(),
			evaluatedBy: z.string(),
			modelAssistedEvaluations: z.number().int().nonnegative(),
			deterministicEvaluations: z.number().int().nonnegative(),
			totalInferenceRequests: z.number().int().nonnegative(),
			totalInferenceTokens: z.number().int().nonnegative(),
			inferenceProvidersUsed: z.array(z.string()),
			validationMode: z.boolean(),
		}),
		contentHash: z.string(),
	});

	const generated = z.toJSONSchema(reportSchemaForJson, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/readable-quality-evaluation.json",
		title: "Readable Publication Quality Evaluation Report",
		description:
			"Structured evaluation of Dutch and English readable publications against 14 criteria covering first-screen clarity, progressive disclosure, cognitive accessibility, technical depth, research quality, factual fidelity, source transparency, editorial coherence, vendor neutrality, visual integration, WCAG compliance, and bilingual quality.",
		...generated,
	};
}

/**
 * Generate the draft-07 JSON Schema for a single readable criterion evaluation.
 */
export function generateReadableCriterionEvaluationJsonSchema(): Record<
	string,
	unknown
> {
	const criterionSchemaForJson = z.object({
		criterionId: z.string(),
		evaluationId: z.string(),
		status: CriterionEvaluationStatusSchema,
		severity: SeverityLevelSchema.optional(),
		scope: EvaluationScopeSchema,
		language: EvaluationLanguageSchema,
		summary: z.string(),
		rationale: z.string(),
		evidence: z.array(
			z.object({
				type: EvaluationMethodSchema,
				description: z.string(),
				passageReferences: z.array(PassageReferenceSchema),
				claimIds: z.array(z.string()),
				sourceIds: z.array(z.string()),
				metadata: z.record(z.string(), z.unknown()).optional(),
			}),
		),
		passageReferences: z.array(PassageReferenceSchema),
		repairAttempted: z.boolean(),
		repairActionId: z.string().optional(),
		reassessment: z
			.object({
				status: CriterionEvaluationStatusSchema,
				summary: z.string(),
				reassessedAt: z.string(),
			})
			.optional(),
		residualUncertainty: z.string().optional(),
		method: EvaluationMethodSchema,
		evaluatedAt: z.string(),
		evaluatedBy: z.string(),
		visualizationReferences: z.array(z.string()).optional(),
	});

	const generated = z.toJSONSchema(criterionSchemaForJson, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/readable-criterion-evaluation.json",
		title: "Readable Publication Criterion Evaluation",
		description:
			"Individual RPE1-RPE14 criterion evaluation result with evidence, passage references, severity, and repair tracking.",
		...generated,
	};
}

/**
 * Generate the draft-07 JSON Schema for a readable repair action.
 */
export function generateReadableRepairActionJsonSchema(): Record<
	string,
	unknown
> {
	const repairSchemaForJson = z.object({
		repairActionId: z.string(),
		criterionId: z.string(),
		evaluationId: z.string(),
		issueType: z.enum([
			"factual",
			"structural",
			"explanatory",
			"stylistic",
			"accessibility",
		]),
		problemDescription: z.string(),
		affectedPassage: PassageReferenceSchema,
		proposedCorrection: z.string(),
		preservesCanonicalFacts: z.boolean(),
		preservesEditorialSelection: z.boolean(),
		preservesBilingualConsistency: z.boolean(),
		status: RepairActionStatusSchema,
		appliedCorrection: z.string().optional(),
		proposedAt: z.string(),
		appliedAt: z.string().optional(),
		regressionChecks: z.array(
			z.object({
				check: z.string(),
				passed: z.boolean(),
				details: z.string().optional(),
			}),
		),
		residualUncertainty: z.string().optional(),
	});

	const generated = z.toJSONSchema(repairSchemaForJson, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/readable-repair-action.json",
		title: "Readable Publication Repair Action",
		description:
			"Record of a corrective action taken during readable quality evaluation, including the issue, proposed correction, application status, and regression checks.",
		...generated,
	};
}
