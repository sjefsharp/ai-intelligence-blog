/**
 * Listening Quality Evaluation — Schema Layer
 *
 * Defines the authoritative, versioned, machine-readable data contract for the
 * Q1-Q10 listening quality evaluation framework. The evaluation assesses the
 * independently authored Dutch listening narrative against ten criteria covering
 * factual fidelity, technical depth, narrative coherence, cognitive accessibility
 * and suitability for adults listening without visual support.
 *
 * Processing sequence preserved:
 *   Source Discovery → Retrieval → Temporal Classification → Claim Verification
 *     → Canonical Fact Dossier → Omission Review → Historical Regression
 *     → Editorial Selection → Publication Production
 *     → Listening Quality Evaluation (this module)
 *     → Publication Validation → Deployment
 */

import { z } from "astro/zod";

import type { CanonicalFactDossier } from "../fact-dossier/schema.js";
import type { EditorialSelectionManifest } from "../editorial-selection/schema.js";
import type { HistoricalRegressionReport } from "../historical-regression/schema.js";
import type { ListeningNarrativeGenerationResult } from "../publication/listening-narrative-generator.js";
import type {
	ArticleIdentity,
	PublicationMetadata,
} from "../publication/schema.js";

// ============================================================================
// Constants
// ============================================================================

/** Current listening quality evaluation schema version. */
export const LISTENING_QUALITY_EVALUATION_SCHEMA_VERSION = "1.0.0";

/** Prefix for evaluation report identifiers. */
export const EVALUATION_REPORT_ID_PREFIX = "lqe_";

/** Prefix for individual criterion evaluation identifiers. */
export const CRITERION_EVALUATION_ID_PREFIX = "cqe_";

/** Prefix for repair action identifiers. */
export const REPAIR_ACTION_ID_PREFIX = "lqr_";

/** Q1-Q10 criterion identifiers. */
export const Q_CRITERIA = [
	"Q1",
	"Q2",
	"Q3",
	"Q4",
	"Q5",
	"Q6",
	"Q7",
	"Q8",
	"Q9",
	"Q10",
] as const;

/** Audio A-G criterion identifiers. */
export const AUDIO_CRITERIA = ["A", "B", "C", "D", "E", "F", "G"] as const;

/** All criterion identifiers (Q1-Q10 + Audio A-G). */
export const ALL_CRITERIA = [...Q_CRITERIA, ...AUDIO_CRITERIA] as const;

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
	"full-narrative",
	"per-story",
	"opening",
	"transitions",
	"conclusion",
	"specific-passage",
]);

// ============================================================================
// Core Evaluation Types
// ============================================================================

/** Reference to a specific passage in the narrative. */
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
export const CriterionEvaluationSchema = z.strictObject({
	/** Criterion identifier (Q1-Q10, Audio A-G). */
	criterionId: z.union([z.enum(Q_CRITERIA), z.enum(AUDIO_CRITERIA)]),
	/** Unique evaluation ID. */
	evaluationId: z.string().regex(/^cqe_[a-z0-9]{16}$/),
	/** Evaluation status. */
	status: CriterionEvaluationStatusSchema,
	/** Severity if FAIL. */
	severity: SeverityLevelSchema.optional(),
	/** Scope of evaluation. */
	scope: EvaluationScopeSchema,
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
		.regex(/^lqr_[a-z0-9]{16}$/)
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
	/** Reference to Q1-Q10 evidence when applicable. */
	qEvidenceReferences: z.array(z.string()).optional(),
	/** Whether this criterion was evaluated as part of holistic listening assessment. */
	holisticAssessment: z.boolean().default(false),
});

/** Repair action record. */
export const RepairActionSchema = z.strictObject({
	repairActionId: z.string().regex(/^lqr_[a-z0-9]{16}$/),
	criterionId: z.union([z.enum(Q_CRITERIA), z.enum(AUDIO_CRITERIA)]),
	evaluationId: z.string().regex(/^cqe_[a-z0-9]{16}$/),
	/** Type of issue being repaired. */
	issueType: z.enum(["factual", "structural", "explanatory", "stylistic"]),
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

/** Holistic listening experience assessment for Audio A-G. */
export const HolisticListeningAssessmentSchema = z.strictObject({
	/** Whether the opening establishes an effective listening context. */
	openingEstablishesContext: z.strictObject({
		status: CriterionEvaluationStatusSchema,
		summary: z.string(),
		rationale: z.string(),
		evidence: z.array(EvaluationEvidenceSchema),
	}),
	/** Whether the progression between stories is intelligible. */
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
	/** Whether important concepts remain understandable over time. */
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
	/** Whether the narrative maintains factual integrity throughout. */
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
	/** Whether the listener can understand the essential news without consulting a screen. */
	screenIndependentUnderstanding: z.strictObject({
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

/** Complete listening quality evaluation report. */
export const ListeningQualityEvaluationReportSchema = z.strictObject({
	schemaVersion: z.literal(LISTENING_QUALITY_EVALUATION_SCHEMA_VERSION),
	reportId: z.string().regex(/^lqe_[a-z0-9]{16}$/),
	editionId: z.string().regex(/^edition_\d{4}-\d{2}-\d{2}$/),
	editionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	/** Reference to the listening narrative artifact. */
	listeningNarrativeArtifactId: z.string().regex(/^pubart_[a-z0-9]{16}$/),
	/** Reference to the canonical fact dossier. */
	factDossierId: z.string().regex(/^fd_[a-z0-9]{16}$/),
	/** Reference to the editorial selection manifest. */
	editorialSelectionManifestId: z.string().regex(/^esm_[a-z0-9]{16}$/),
	/** Individual criterion evaluations (7 for Audio A-G only, 10 for Q1-Q10 only, 17 for combined). */
	criterionEvaluations: z.array(CriterionEvaluationSchema).min(7).max(17),
	/** Audio A-G holistic listening experience assessment (only present when Audio A-G evaluated). */
	holisticListeningAssessment: HolisticListeningAssessmentSchema.optional(),
	/** Repair actions taken during evaluation. */
	repairActions: z.array(RepairActionSchema),
	/** Overall evaluation summary. */
	overallSummary: z.strictObject({
		passedCount: z.number().int().min(0).max(17),
		failedCount: z.number().int().min(0).max(17),
		unverifiedCount: z.number().int().min(0).max(17),
		notAssessableCount: z.number().int().min(0).max(17),
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

/** Input data for listening quality evaluation. */
export interface ListeningQualityEvaluationInput {
	editionDate: string;
	editionId: string;
	listeningNarrativeMarkdown: string;
	listeningNarrativeArtifactId: string;
	listeningNarrativeTraceability: ListeningNarrativeGenerationResult["traceability"];
	factDossier: CanonicalFactDossier;
	editorialManifest: EditorialSelectionManifest;
	historicalRegression: HistoricalRegressionReport | null;
	publicationMetadata: PublicationMetadata;
	articleIdentities: ArticleIdentity[];
	validationMode?: boolean;
}

/** Re-exported from listening narrative generator for traceability. */
export interface NarrativeSegmentTrace {
	type: "opening" | "story" | "transition" | "reorientation" | "conclusion";
	claimIds: string[];
	sourceIds: string[];
	storyId?: string;
}

/** Full traceability from listening narrative generation. */
export interface ListeningNarrativeTraceability {
	segments: NarrativeSegmentTrace[];
	claimCoverage: string[];
	sourceCoverage: string[];
	storyCoverage: string[];
}

// ============================================================================
// Inferred TypeScript Types
// ============================================================================

export type CriterionId = (typeof Q_CRITERIA)[number];
export type AudioCriterionId = (typeof AUDIO_CRITERIA)[number];
export type AnyCriterionId = CriterionId | AudioCriterionId;
export type CriterionEvaluationStatus = z.infer<
	typeof CriterionEvaluationStatusSchema
>;
export type SeverityLevel = z.infer<typeof SeverityLevelSchema>;
export type EvaluationMethod = z.infer<typeof EvaluationMethodSchema>;
export type RepairActionStatus = z.infer<typeof RepairActionStatusSchema>;
export type EvaluationScope = z.infer<typeof EvaluationScopeSchema>;
export type PassageReference = z.infer<typeof PassageReferenceSchema>;
export type EvaluationEvidence = z.infer<typeof EvaluationEvidenceSchema>;
export type CriterionEvaluation = z.infer<typeof CriterionEvaluationSchema>;
export type RepairAction = z.infer<typeof RepairActionSchema>;
export type HolisticListeningAssessment = z.infer<
	typeof HolisticListeningAssessmentSchema
>;
export type ListeningQualityEvaluationReport = z.infer<
	typeof ListeningQualityEvaluationReportSchema
>;
export type OverallSummary = ListeningQualityEvaluationReport["overallSummary"];
export type EvaluationMetadata = ListeningQualityEvaluationReport["metadata"];

// ============================================================================
// JSON Schema Generation
// ============================================================================

/**
 * Generate the draft-07 JSON Schema for the listening quality evaluation report.
 * Note: Union types (Q1-Q10 + Audio A-G) require manual handling for JSON Schema.
 * Complex nested schemas are simplified for JSON Schema compatibility.
 */
export function generateListeningQualityEvaluationJsonSchema(): Record<
	string,
	unknown
> {
	// Create a simplified version for JSON Schema generation
	const reportSchemaForJson = z.object({
		schemaVersion: z.literal(LISTENING_QUALITY_EVALUATION_SCHEMA_VERSION),
		reportId: z.string(),
		editionId: z.string(),
		editionDate: z.string(),
		listeningNarrativeArtifactId: z.string(),
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
					qEvidenceReferences: z.array(z.string()).optional(),
					holisticAssessment: z.boolean(),
				}),
			)
			.length(17),
		holisticListeningAssessment: z
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
				]),
				problemDescription: z.string(),
				affectedPassage: PassageReferenceSchema,
				proposedCorrection: z.string(),
				preservesCanonicalFacts: z.boolean(),
				preservesEditorialSelection: z.boolean(),
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
			passedCount: z.number().int().min(0).max(17),
			failedCount: z.number().int().min(0).max(17),
			unverifiedCount: z.number().int().min(0).max(17),
			notAssessableCount: z.number().int().min(0).max(17),
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
		$id: "https://ai-intelligence-blog/schemas/listening-quality-evaluation.json",
		title: "Listening Quality Evaluation Report",
		description:
			"Structured evaluation of the Dutch listening narrative against Q1-Q10 and Audio A-G criteria covering factual fidelity, technical depth, narrative coherence, cognitive accessibility, and holistic listening experience suitability for adults listening without visual support.",
		...generated,
	};
}

/**
 * Generate the draft-07 JSON Schema for a single criterion evaluation.
 */
export function generateCriterionEvaluationJsonSchema(): Record<
	string,
	unknown
> {
	const criterionSchemaForJson = z.object({
		criterionId: z.string(),
		evaluationId: z.string(),
		status: CriterionEvaluationStatusSchema,
		severity: SeverityLevelSchema.optional(),
		scope: EvaluationScopeSchema,
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
		qEvidenceReferences: z.array(z.string()).optional(),
		holisticAssessment: z.boolean(),
	});

	const generated = z.toJSONSchema(criterionSchemaForJson, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/criterion-evaluation.json",
		title: "Criterion Evaluation",
		description:
			"Individual Q1-Q10 and Audio A-G criterion evaluation result with evidence, passage references, severity, and repair tracking.",
		...generated,
	};
}

/**
 * Generate the draft-07 JSON Schema for a repair action.
 */
export function generateRepairActionJsonSchema(): Record<string, unknown> {
	const repairSchemaForJson = z.object({
		repairActionId: z.string(),
		criterionId: z.string(),
		evaluationId: z.string(),
		issueType: z.enum([
			"factual",
			"structural",
			"explanatory",
			"stylistic",
		]),
		problemDescription: z.string(),
		affectedPassage: PassageReferenceSchema,
		proposedCorrection: z.string(),
		preservesCanonicalFacts: z.boolean(),
		preservesEditorialSelection: z.boolean(),
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
		$id: "https://ai-intelligence-blog/schemas/repair-action.json",
		title: "Repair Action",
		description:
			"Record of a corrective action taken during listening quality evaluation, including the issue, proposed correction, application status, and regression checks.",
		...generated,
	};
}

/**
 * Generate the draft-07 JSON Schema for the holistic listening assessment.
 */
export function generateHolisticListeningAssessmentJsonSchema(): Record<
	string,
	unknown
> {
	const holisticSchemaForJson = z.object({
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
	});

	const generated = z.toJSONSchema(holisticSchemaForJson, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/holistic-listening-assessment.json",
		title: "Holistic Listening Assessment",
		description:
			"Holistic assessment of the complete listening experience across Audio A-G criteria, evaluating the narrative as an integrated whole rather than isolated criteria.",
		...generated,
	};
}
