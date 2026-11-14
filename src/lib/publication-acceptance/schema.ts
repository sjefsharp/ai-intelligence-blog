/**
 * Publication Acceptance Authority — Schema Layer
 *
 * Defines the authoritative, versioned, machine-readable data contract for the
 * final publication acceptance-gate framework. This module is the single
 * deterministic authority for deciding whether a daily bilingual edition
 * satisfies all mandatory requirements and is eligible for publication.
 *
 * The acceptance framework does NOT publish, deploy, schedule or activate
 * anything. It evaluates required evidence, applies deterministic acceptance
 * rules, identifies unresolved blocking conditions, authorizes the VALIDATED
 * lifecycle transition when justified, and produces an inspectable release
 * decision.
 *
 * Processing sequence preserved:
 *   Source Discovery → Retrieval → Temporal Classification → Claim Verification
 *     → Canonical Fact Dossier → Omission Review → Historical Regression
 *     → Editorial Selection → Publication Production → Quality Evaluation
 *     → Knowledge Continuity → Publication Preparation
 *     → Publication Acceptance (this module)
 *     → Deployment and Publication
 *
 * Design rules:
 * - Schemas are defined with Zod (TypeScript schemas) and inferred into static
 *   types, so the runtime validator and the compile-time types cannot drift.
 * - A JSON Schema (draft-07) is generated from the same Zod schemas via
 *   `z.toJSONSchema`, so the on-disk data contract and the TypeScript contract
 *   are generated from one source of truth.
 * - Every identifier pattern reuses the existing stable identifier conventions.
 * - The acceptance framework is a CONTROL PLANE ONLY — it evaluates evidence,
 *   does not replace existing research, editorial, publication, evaluation or
 *   knowledge components.
 */

import { z } from "astro/zod";

// ============================================================================
// Constants
// ============================================================================

/** Current publication acceptance schema version. */
export const PUBLICATION_ACCEPTANCE_SCHEMA_VERSION = "1.0.0";

/** Prefix for acceptance report identifiers. */
export const ACCEPTANCE_REPORT_ID_PREFIX = "acc_";

/** Prefix for acceptance gate identifiers. */
export const ACCEPTANCE_GATE_ID_PREFIX = "gate_";

/** Prefix for acceptance decision identifiers. */
export const ACCEPTANCE_DECISION_ID_PREFIX = "dec_";

/**
 * Stable identifier patterns reused from the existing pipeline.
 */
export const ACCEPTANCE_ID_PATTERNS = {
	acceptanceReport: /^acc_[a-z0-9]{16}$/,
	acceptanceGate: /^gate_[a-z0-9_]+$/,
	acceptanceDecision: /^dec_[a-z0-9]{16}$/,
	edition: /^edition_\d{4}-\d{2}-\d{2}$/,
	editionDate: /^\d{4}-\d{2}-\d{2}$/,
	candidate: /^cand_[a-z0-9]{16}$/,
	claim: /^claim_[a-z0-9]{16}$/,
	discovery: /^disc_[a-z0-9]{16}$/,
	source: /^[a-z0-9-]+$/,
	subdomain: /^DOM-\d{2}-SD\d{2}$/,
	domain: /^DOM-\d{2}$/,
	thesaurusEntry: /^thes_[a-z0-9]{16}$/,
	principle: /^AP-\d{3}$/,
	factDossier: /^fd_[a-z0-9]{16}$/,
	editorialManifest: /^esm_[a-z0-9]{16}$/,
	historicalReport: /^hr_[a-z0-9]{16}$/,
	omissionReview: /^or_[a-z0-9]{16}$/,
	publicationPackage: /^pubpkg_[a-z0-9]{16}$/,
	publicationArtifact: /^pubart_[a-z0-9]{16}$/,
	article: /^art_[a-z0-9]{16}$/,
	story: /^story_[a-z0-9]{16}$/,
} as const;

// ============================================================================
// Enumerations
// ============================================================================

/**
 * Acceptance gate evaluation status.
 * Reuses the established evaluation states from the quality evaluation modules.
 * - PASS: All applicable mandatory checks have sufficient supporting evidence.
 * - FAIL: A concrete requirement violation has been established.
 * - UNVERIFIED: Required evidence or evaluation capability is insufficient.
 * - NOT_ASSESSABLE: The criterion genuinely cannot be evaluated in the current context.
 */
export const AcceptanceGateStatusSchema = z.enum([
	"PASS",
	"FAIL",
	"UNVERIFIED",
	"NOT_ASSESSABLE",
]);

/**
 * Acceptance decision status.
 * - VALIDATED: All mandatory gates passed; edition is eligible for publication.
 * - FAILED: A mandatory gate failed or required evidence is missing.
 * - INCOMPLETE: Required evidence or evaluation capability is insufficient.
 * - NOT_ASSESSABLE: The criterion genuinely cannot be evaluated in the current context.
 */
export const AcceptanceDecisionStatusSchema = z.enum([
	"VALIDATED",
	"FAILED",
	"INCOMPLETE",
	"NOT_ASSESSABLE",
]);

/**
 * Defect severity levels.
 * Reuses the established severity model from the quality evaluation modules.
 * - CRITICAL: Blocks acceptance; must be resolved before publication.
 * - MAJOR: Significant issue; must be resolved before publication.
 * - MINOR: Minor issue; should be resolved but does not block publication.
 * - ADVISORY: Informational; does not block publication.
 */
export const AcceptanceSeveritySchema = z.enum([
	"CRITICAL",
	"MAJOR",
	"MINOR",
	"ADVISORY",
]);

/**
 * Publication lifecycle status.
 * Reuses the established lifecycle from the publication schema.
 */
export const AcceptanceLifecycleStatusSchema = z.enum([
	"DRAFT",
	"READY_FOR_VALIDATION",
	"VALIDATED",
	"PUBLISHED",
	"FAILED",
	"INCOMPLETE",
	"SUPERSEDED",
]);

/**
 * Acceptance execution mode.
 * Reuses the execution modes established in step 99.
 * - PLAN: Display required gates, dependencies and evidence expected.
 * - VALIDATE: Evaluate existing artifacts and evidence without generating new publication content.
 * - DRY_RUN: Evaluate synthetic fixtures in an isolated workspace.
 * - RESUME: Continue an interrupted acceptance evaluation from compatible checkpoints.
 * - EXECUTE: Evaluate an explicitly authorized edition against its actual persisted artifacts.
 */
export const AcceptanceExecutionModeSchema = z.enum([
	"PLAN",
	"VALIDATE",
	"DRY_RUN",
	"RESUME",
	"EXECUTE",
]);

/**
 * Gate applicability status.
 * - APPLICABLE: The gate must be evaluated for this edition.
 * - NOT_APPLICABLE: The gate is not required for this edition (with explicit policy-based reason).
 */
export const AcceptanceApplicabilityStatusSchema = z.enum([
	"APPLICABLE",
	"NOT_APPLICABLE",
]);

/**
 * Evidence binding status.
 * - BOUND: The evaluation is bound to the current artifact version.
 * - STALE: The evaluation was performed on a different artifact version.
 * - UNBOUND: The evaluation has no artifact binding.
 */
export const EvidenceBindingStatusSchema = z.enum([
	"BOUND",
	"STALE",
	"UNBOUND",
]);

/**
 * Exception approval status.
 * - PENDING: Exception requested but not yet approved.
 * - APPROVED: Exception explicitly approved by authorized authority.
 * - REJECTED: Exception rejected by authorized authority.
 */
export const ExceptionApprovalStatusSchema = z.enum([
	"PENDING",
	"APPROVED",
	"REJECTED",
]);

// ============================================================================
// Gate Definition Types
// ============================================================================

/**
 * Acceptance gate definition.
 * Each gate exposes a versioned contract containing all required information.
 */
export const AcceptanceGateDefinitionSchema = z.strictObject({
	/** Stable gate identifier. */
	gateId: z.string().regex(ACCEPTANCE_ID_PATTERNS.acceptanceGate),
	/** Human-readable gate name. */
	name: z.string().min(1),
	/** Purpose of this gate. */
	purpose: z.string().min(1),
	/** Applicable edition and scope. */
	scope: z.enum([
		"edition",
		"artifact",
		"claim",
		"source",
		"visualization",
		"knowledge",
	]),
	/** Required input artifacts. */
	requiredInputArtifacts: z.array(z.string()),
	/** Required upstream dependencies (gate IDs). */
	requiredUpstreamGates: z.array(z.string()),
	/** Applicability conditions. */
	applicabilityConditions: z.array(z.string()),
	/** Validation rules. */
	validationRules: z.array(z.string()),
	/** Evidence references. */
	evidenceReferences: z.array(z.string()),
	/** Evaluator version. */
	evaluatorVersion: z.string().min(1),
	/** Human review requirements where applicable. */
	humanReviewRequired: z.boolean().default(false),
	/** Whether this gate is mandatory for publication acceptance. */
	mandatory: z.boolean().default(true),
});

/**
 * Acceptance gate execution result.
 * Records the evaluation result for a single gate.
 */
export const AcceptanceGateResultSchema = z.strictObject({
	/** Gate identifier. */
	gateId: z.string().regex(ACCEPTANCE_ID_PATTERNS.acceptanceGate),
	/** Gate name. */
	name: z.string().min(1),
	/** Evaluation status. */
	status: AcceptanceGateStatusSchema,
	/** Applicability status. */
	applicability: AcceptanceApplicabilityStatusSchema,
	/** Applicability reason (required when NOT_APPLICABLE). */
	applicabilityReason: z.string().optional(),
	/** Defect severity (if FAIL). */
	severity: AcceptanceSeveritySchema.optional(),
	/** Blocking conditions. */
	blockingConditions: z.array(z.string()),
	/** Evidence references. */
	evidenceReferences: z.array(z.string()),
	/** Relevant artifact hashes. */
	artifactHashes: z.record(z.string(), z.string()),
	/** Evaluator version. */
	evaluatorVersion: z.string().min(1),
	/** Execution timestamp. */
	executedAt: z.string(),
	/** Remediation references. */
	remediationReferences: z.array(z.string()),
	/** Residual uncertainty. */
	residualUncertainty: z.string().optional(),
	/** Human review requirements. */
	humanReviewRequired: z.boolean().default(false),
	/** Human review status. */
	humanReviewStatus: z
		.enum(["not-required", "pending", "approved", "rejected"])
		.default("not-required"),
	/** Whether this gate is mandatory. */
	mandatory: z.boolean().default(true),
	/** Upstream gate dependencies that were satisfied. */
	satisfiedUpstreamGates: z.array(z.string()),
	/** Upstream gate dependencies that were not satisfied. */
	unsatisfiedUpstreamGates: z.array(z.string()),
});

// ============================================================================
// Defect Types
// ============================================================================

/**
 * Acceptance defect.
 * Records a specific defect found during acceptance evaluation.
 */
export const AcceptanceDefectSchema = z.strictObject({
	/** Defect identifier. */
	defectId: z.string().min(1),
	/** Gate identifier that identified this defect. */
	gateId: z.string().regex(ACCEPTANCE_ID_PATTERNS.acceptanceGate),
	/** Defect category. */
	category: z.enum([
		"MISSING_EVIDENCE",
		"INVALID_EVIDENCE",
		"STALE_EVIDENCE",
		"CONTRADICTION",
		"FABRICATION",
		"INCOMPLETE_COVERAGE",
		"INVALID_LIFECYCLE",
		"ARTIFACT_INTEGRITY",
		"CROSS_LANGUAGE_INCONSISTENCY",
		"TEMPORAL_ELIGIBILITY",
		"SOURCE_PROVENANCE",
		"EDITORIAL_INTEGRITY",
		"READABILITY_DEFECT",
		"AUDIO_QUALITY_DEFECT",
		"KNOWLEDGE_CONTINUITY_DEFECT",
		"VISUALIZATION_DEFECT",
		"METADATA_DEFECT",
		"OTHER",
	]),
	/** Defect description. */
	description: z.string().min(1),
	/** Defect severity. */
	severity: AcceptanceSeveritySchema,
	/** Whether this defect blocks acceptance. */
	blocking: z.boolean(),
	/** Affected artifact identifiers. */
	affectedArtifacts: z.array(z.string()),
	/** Evidence references. */
	evidenceReferences: z.array(z.string()),
	/** Responsible upstream component. */
	responsibleComponent: z.string().min(1),
	/** Remediation recommendation. */
	remediationRecommendation: z.string().min(1),
	/** Timestamp when the defect was identified. */
	identifiedAt: z.string(),
});

// ============================================================================
// Exception Types
// ============================================================================

/**
 * Acceptance exception request.
 * Records an explicit exception to a gate requirement.
 */
export const AcceptanceExceptionRequestSchema = z.strictObject({
	/** Exception identifier. */
	exceptionId: z.string().min(1),
	/** Gate identifier this exception applies to. */
	gateId: z.string().regex(ACCEPTANCE_ID_PATTERNS.acceptanceGate),
	/** Exact affected criterion. */
	affectedCriterion: z.string().min(1),
	/** Explanation. */
	explanation: z.string().min(1),
	/** Risk assessment. */
	riskAssessment: z.string().min(1),
	/** Supporting evidence. */
	supportingEvidence: z.array(z.string()),
	/** Scope of the exception. */
	scope: z.string().min(1),
	/** Expiration or review condition. */
	expirationCondition: z.string().optional(),
	/** Decision authority. */
	decisionAuthority: z.string().min(1),
	/** Exception status. */
	status: ExceptionApprovalStatusSchema,
	/** Audit trail. */
	auditTrail: z.array(z.string()),
	/** Timestamp when the exception was requested. */
	requestedAt: z.string(),
	/** Timestamp when the exception was decided. */
	decidedAt: z.string().optional(),
});

// ============================================================================
// Evidence Binding Types
// ============================================================================

/**
 * Evidence binding record.
 * Binds an evaluation to specific artifact versions.
 */
export const EvidenceBindingSchema = z.strictObject({
	/** Edition identifier. */
	editionId: z.string().regex(ACCEPTANCE_ID_PATTERNS.edition),
	/** Artifact identifier. */
	artifactId: z.string().min(1),
	/** Artifact content hash. */
	artifactContentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
	/** Relevant source and claim references. */
	sourceReferences: z.array(z.string()),
	claimReferences: z.array(z.string()),
	/** Fact dossier version or hash. */
	factDossierHash: z
		.string()
		.regex(/^sha256:[a-f0-9]{64}$/)
		.optional(),
	/** Editorial selection manifest version or hash. */
	editorialManifestHash: z
		.string()
		.regex(/^sha256:[a-f0-9]{64}$/)
		.optional(),
	/** Evaluator version. */
	evaluatorVersion: z.string().min(1),
	/** Relevant policy or contract version. */
	policyVersion: z.string().min(1),
	/** Binding status. */
	bindingStatus: EvidenceBindingStatusSchema,
	/** Timestamp when the binding was created. */
	boundAt: z.string(),
});

// ============================================================================
// Acceptance Report Types
// ============================================================================

/**
 * Acceptance report.
 * The structured, persistent acceptance report.
 */
export const AcceptanceReportSchema = z.strictObject({
	/** Schema version. */
	schemaVersion: z.literal(PUBLICATION_ACCEPTANCE_SCHEMA_VERSION),
	/** Report identifier. */
	reportId: z.string().regex(ACCEPTANCE_ID_PATTERNS.acceptanceReport),
	/** Edition identifier. */
	editionId: z.string().regex(ACCEPTANCE_ID_PATTERNS.edition),
	/** Workflow run identifier. */
	workflowRunId: z.string().min(1),
	/** Acceptance contract version. */
	acceptanceContractVersion: z.string().min(1),
	/** Acceptance timestamp. */
	acceptanceTimestamp: z.string(),
	/** Reporting interval. */
	reportingInterval: z.strictObject({
		start: z.string(),
		end: z.string(),
		timezone: z.literal("Europe/Amsterdam"),
	}),
	/** Overall decision. */
	overallDecision: AcceptanceDecisionStatusSchema,
	/** Required gate inventory. */
	requiredGates: z.array(AcceptanceGateDefinitionSchema),
	/** Gate applicability. */
	gateApplicability: z.record(
		z.string(),
		AcceptanceApplicabilityStatusSchema,
	),
	/** Gate results. */
	gateResults: z.array(AcceptanceGateResultSchema),
	/** Evidence references. */
	evidenceReferences: z.array(z.string()),
	/** Artifact identifiers and hashes. */
	artifactHashes: z.record(z.string(), z.string()),
	/** Fact dossier reference. */
	factDossierReference: z.strictObject({
		dossierId: z.string().regex(ACCEPTANCE_ID_PATTERNS.factDossier),
		contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
	}),
	/** Editorial manifest reference. */
	editorialManifestReference: z.strictObject({
		manifestId: z.string().regex(ACCEPTANCE_ID_PATTERNS.editorialManifest),
		contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
	}),
	/** Critical and major defects. */
	criticalAndMajorDefects: z.array(AcceptanceDefectSchema),
	/** Unverified requirements. */
	unverifiedRequirements: z.array(z.string()),
	/** Unresolved manual review. */
	unresolvedManualReview: z.array(z.string()),
	/** Remediation history. */
	remediationHistory: z.array(
		z.strictObject({
			remediationId: z.string().min(1),
			gateId: z.string(),
			defectId: z.string(),
			action: z.string(),
			result: z.string(),
			timestamp: z.string(),
		}),
	),
	/** Publication lifecycle state. */
	publicationLifecycleState: AcceptanceLifecycleStatusSchema,
	/** Deployment eligibility. */
	deploymentEligible: z.boolean(),
	/** Explicit reasons for any rejected decision. */
	rejectionReasons: z.array(z.string()),
	/** Independent persistence and readback result. */
	persistenceReadback: z.strictObject({
		persisted: z.boolean(),
		readbackVerified: z.boolean(),
		reportPath: z.string().optional(),
		verifiedAt: z.string().optional(),
	}),
	/** Content hash of this report. */
	contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
});

// ============================================================================
// Acceptance Decision Types
// ============================================================================

/**
 * Machine-readable acceptance decision.
 * The stable interface usable by the workflow orchestrator and later CI stages.
 */
export const AcceptanceDecisionSchema = z.strictObject({
	/** Schema version. */
	schemaVersion: z.literal(PUBLICATION_ACCEPTANCE_SCHEMA_VERSION),
	/** Decision identifier. */
	decisionId: z.string().regex(ACCEPTANCE_ID_PATTERNS.acceptanceDecision),
	/** Edition identity. */
	editionId: z.string().regex(ACCEPTANCE_ID_PATTERNS.edition),
	/** Decision status. */
	decisionStatus: AcceptanceDecisionStatusSchema,
	/** Publication eligibility. */
	publicationEligible: z.boolean(),
	/** Blocking gate identifiers. */
	blockingGateIds: z.array(z.string()),
	/** Blocking evidence references. */
	blockingEvidenceReferences: z.array(z.string()),
	/** Unverified conditions. */
	unverifiedConditions: z.array(z.string()),
	/** Artifact integrity references. */
	artifactIntegrityReferences: z.record(z.string(), z.string()),
	/** Acceptance report location. */
	acceptanceReportLocation: z.string().optional(),
	/** Contract version. */
	contractVersion: z.string().min(1),
	/** Decision timestamp. */
	decidedAt: z.string(),
	/** Content hash of the decision. */
	contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
});

// ============================================================================
// Inferred TypeScript Types
// ============================================================================

export type AcceptanceGateStatus = z.infer<typeof AcceptanceGateStatusSchema>;
export type AcceptanceDecisionStatus = z.infer<
	typeof AcceptanceDecisionStatusSchema
>;
export type AcceptanceSeverity = z.infer<typeof AcceptanceSeveritySchema>;
export type AcceptanceLifecycleStatus = z.infer<
	typeof AcceptanceLifecycleStatusSchema
>;
export type AcceptanceExecutionMode = z.infer<
	typeof AcceptanceExecutionModeSchema
>;
export type AcceptanceApplicabilityStatus = z.infer<
	typeof AcceptanceApplicabilityStatusSchema
>;
export type EvidenceBindingStatus = z.infer<typeof EvidenceBindingStatusSchema>;
export type ExceptionApprovalStatus = z.infer<
	typeof ExceptionApprovalStatusSchema
>;

export type AcceptanceGateDefinition = z.infer<
	typeof AcceptanceGateDefinitionSchema
>;
export type AcceptanceGateResult = z.infer<typeof AcceptanceGateResultSchema>;
export type AcceptanceDefect = z.infer<typeof AcceptanceDefectSchema>;
export type AcceptanceExceptionRequest = z.infer<
	typeof AcceptanceExceptionRequestSchema
>;
export type EvidenceBinding = z.infer<typeof EvidenceBindingSchema>;
export type AcceptanceReport = z.infer<typeof AcceptanceReportSchema>;
export type AcceptanceDecision = z.infer<typeof AcceptanceDecisionSchema>;

// ============================================================================
// JSON Schema Generation (Single Source of Truth)
// ============================================================================

/**
 * Generate the draft-07 JSON Schema for the acceptance report.
 */
export function generateAcceptanceReportJsonSchema(): Record<string, unknown> {
	const generated = z.toJSONSchema(AcceptanceReportSchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/publication-acceptance-report.json",
		title: "Publication Acceptance Report",
		description:
			"Structured, persistent acceptance report containing edition identity, workflow run, gate inventory, gate results, evidence references, artifact hashes, defects, lifecycle state, deployment eligibility, and rejection reasons.",
		...generated,
	};
}

/**
 * Generate the draft-07 JSON Schema for the acceptance decision.
 */
export function generateAcceptanceDecisionJsonSchema(): Record<
	string,
	unknown
> {
	const generated = z.toJSONSchema(AcceptanceDecisionSchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/publication-acceptance-decision.json",
		title: "Publication Acceptance Decision",
		description:
			"Machine-readable acceptance decision containing edition identity, decision status, publication eligibility, blocking gates, evidence references, artifact integrity references, and report location.",
		...generated,
	};
}

/**
 * Generate the draft-07 JSON Schema for a gate definition.
 */
export function generateAcceptanceGateDefinitionJsonSchema(): Record<
	string,
	unknown
> {
	const generated = z.toJSONSchema(AcceptanceGateDefinitionSchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/acceptance-gate-definition.json",
		title: "Acceptance Gate Definition",
		description:
			"Versioned contract for an acceptance gate containing stable identifier, purpose, scope, required inputs, dependencies, applicability conditions, validation rules, and evidence references.",
		...generated,
	};
}

/**
 * Generate the draft-07 JSON Schema for a gate result.
 */
export function generateAcceptanceGateResultJsonSchema(): Record<
	string,
	unknown
> {
	const generated = z.toJSONSchema(AcceptanceGateResultSchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/acceptance-gate-result.json",
		title: "Acceptance Gate Result",
		description:
			"Execution result for a single acceptance gate containing status, applicability, severity, blocking conditions, evidence references, artifact hashes, and remediation references.",
		...generated,
	};
}
