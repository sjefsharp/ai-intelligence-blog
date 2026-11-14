/**
 * Workflow Orchestrator — Schema Layer
 *
 * Defines the authoritative, versioned, machine-readable data contract for the
 * deterministic daily workflow orchestrator. This module provides the control plane
 * for coordinating the complete AI Daily Intelligence research, editorial production,
 * multilingual publication, quality evaluation and knowledge-continuity processes.
 *
 * Design rules:
 * - Schemas are defined with Zod (TypeScript schemas) and inferred into static types
 * - A JSON Schema (draft-07) is generated from the same Zod schemas
 * - Every identifier pattern reuses existing stable identifier conventions
 * - The orchestrator is a CONTROL PLANE ONLY — it coordinates, does not replace
 *   existing research, editorial, publication, evaluation or knowledge components
 */

import { z } from "astro/zod";

// ============================================================================
// Constants
// ============================================================================

/** Current workflow orchestrator schema version. */
export const WORKFLOW_ORCHESTRATOR_SCHEMA_VERSION = "1.0.0";

/** Prefix for workflow run identifiers. */
export const WORKFLOW_RUN_ID_PREFIX = "wfr_";

/** Prefix for workflow stage identifiers. */
export const WORKFLOW_STAGE_ID_PREFIX = "wfs_";

/** Stable identifier patterns reused from the existing pipeline. */
export const WORKFLOW_ID_PATTERNS = {
	workflowRun: /^wfr_[a-z0-9]{16}$/,
	stage: /^wfs_[a-z0-9_]+$/,
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
 * Workflow execution mode.
 * - PLAN: Inspect graph, config, dependencies without execution
 * - VALIDATE: Check contracts, config, graph integrity, existing artifacts
 * - DRY_RUN: Execute with controlled fixtures, isolated output, stubbed deps
 * - RESUME: Resume incomplete workflow from verified checkpoints
 * - EXECUTE: Full real-edition execution (explicitly authorized)
 */
export const WorkflowExecutionModeSchema = z.enum([
	"PLAN",
	"VALIDATE",
	"DRY_RUN",
	"RESUME",
	"EXECUTE",
]);

/**
 * Workflow stage execution state.
 * - PENDING: Not yet eligible for execution
 * - READY: Dependencies satisfied, ready to run
 * - RUNNING: Execution has started
 * - SUCCEEDED: Outputs produced and validated per stage contract
 * - FAILED: Concrete failure encountered
 * - BLOCKED: Required dependencies, permissions, or resources unavailable
 * - INCOMPLETE: Some work succeeded but stage contract not fully met
 * - SKIPPED: Omission explicitly permitted and justified
 */
export const StageExecutionStateSchema = z.enum([
	"PENDING",
	"READY",
	"RUNNING",
	"SUCCEEDED",
	"FAILED",
	"BLOCKED",
	"INCOMPLETE",
	"SKIPPED",
]);

/**
 * Stage side-effect classification.
 * - NONE: Pure function, no side effects
 * - READ_ONLY: Reads existing artifacts/files
 * - WRITE_LOCAL: Writes to local filesystem (data/, editions/)
 * - INFERENCE_CALL: Invokes language model (free tier only)
 * - NETWORK_FETCH: Retrieves external source content
 * - PUBLISH_PREP: Prepares publication artifacts (not deployment)
 */
export const StageSideEffectSchema = z.enum([
	"NONE",
	"READ_ONLY",
	"WRITE_LOCAL",
	"INFERENCE_CALL",
	"NETWORK_FETCH",
	"PUBLISH_PREP",
]);

/**
 * Failure category for deterministic error handling.
 */
export const FailureCategorySchema = z.enum([
	"INVALID_INPUT",
	"CONTRACT_VIOLATION",
	"SOURCE_UNAVAILABLE",
	"NETWORK_FAILURE",
	"RATE_LIMITED",
	"INFERENCE_UNAVAILABLE",
	"RESOURCE_EXHAUSTED",
	"VALIDATION_FAILED",
	"PERSISTENCE_FAILED",
	"DEPENDENCY_FAILED",
	"CONCURRENT_EXECUTION",
	"UNAUTHORIZED_ACTION",
	"INTERNAL_ERROR",
]);

/**
 * Overall workflow run outcome.
 */
export const WorkflowRunOutcomeSchema = z.enum([
	"SUCCESS",
	"PARTIAL_SUCCESS",
	"FAILED",
	"BLOCKED",
	"INCOMPLETE",
	"VALIDATION_ONLY",
	"PLAN_ONLY",
	"DRY_RUN_COMPLETE",
]);

/**
 * Workflow phase grouping (for reporting).
 */
export const WorkflowPhaseSchema = z.enum([
	"PHASE_A_EDITION_INIT",
	"PHASE_B_RESEARCH_DISCOVERY",
	"PHASE_C_EVIDENCE_PREP",
	"PHASE_D_EDITORIAL_DECISION",
	"PHASE_E_PUBLICATION_PRODUCTION",
	"PHASE_F_QUALITY_ASSURANCE",
	"PHASE_G_KNOWLEDGE_CONTINUITY",
	"PHASE_H_PUBLICATION_PREP",
]);

/**
 * Artifact validation status.
 */
export const ArtifactValidationStatusSchema = z.enum([
	"EXISTS",
	"VALID",
	"INVALID",
	"MISSING",
	"NOT_CHECKED",
	"OUTDATED",
]);

/**
 * Workflow lock state.
 */
export const WorkflowLockStateSchema = z.enum([
	"FREE",
	"HELD",
	"STALE",
	"CONFLICT",
]);

// ============================================================================
// Shared Sub-Records
// ============================================================================

/** Resource budget constraints. */
export const ResourceBudgetSchema = z.strictObject({
	maxModelRequests: z.number().int().positive(),
	maxTokens: z.number().int().positive(),
	maxSourceRequests: z.number().int().positive(),
	maxStageDurationMs: z.number().int().positive(),
	maxTotalDurationMs: z.number().int().positive(),
	maxConcurrentModelCalls: z.number().int().positive(),
	maxTemporaryStorageMb: z.number().int().positive(),
	maxArtifactSizeMb: z.number().int().positive(),
	maxRetriesPerStage: z.number().int().nonnegative(),
	inferenceBudget: z.strictObject({
		maxRequests: z.number().int().positive(),
		maxTokens: z.number().int().positive(),
		maxCostUsd: z.literal(0), // Free-only enforcement
	}),
});

/** Retry policy configuration. */
export const RetryPolicySchema = z.strictObject({
	maxAttempts: z.number().int().positive().default(3),
	baseDelayMs: z.number().int().positive().default(1000),
	maxDelayMs: z.number().int().positive().default(30000),
	jitterFactor: z.number().min(0).max(1).default(0.25),
	retryableCategories: z
		.array(FailureCategorySchema)
		.default([
			"NETWORK_FAILURE",
			"RATE_LIMITED",
			"INFERENCE_UNAVAILABLE",
			"SOURCE_UNAVAILABLE",
		]),
});

/** Cache/checkpoint policy. */
export const CheckpointPolicySchema = z.strictObject({
	enabled: z.boolean().default(true),
	persistIntervalSteps: z.number().int().positive().default(5),
	maxCheckpoints: z.number().int().positive().default(50),
	ttlHours: z.number().int().positive().default(168), // 7 days
	validateOnResume: z.boolean().default(true),
});

/** Execution timeout/budget for a stage. */
export const StageExecutionBudgetSchema = z.strictObject({
	timeoutMs: z.number().int().positive(),
	maxRetries: z.number().int().nonnegative(),
	inferenceBudget: z
		.strictObject({
			maxRequests: z.number().int().nonnegative(),
			maxTokens: z.number().int().nonnegative(),
		})
		.optional(),
	cpuBudgetMs: z.number().int().positive().optional(),
	memoryBudgetMb: z.number().int().positive().optional(),
});

/** Stage input/output artifact references. */
export const ArtifactRefSchema = z.strictObject({
	artifactId: z.string().min(1),
	path: z.string().min(1),
	contentHash: z
		.string()
		.regex(/^sha256:[a-f0-9]{64}$/)
		.optional(),
	version: z.string().optional(),
	required: z.boolean().default(true),
	description: z.string().optional(),
});

/** Stage dependency declaration. */
export const StageDependencySchema = z.strictObject({
	stageId: z.string().regex(WORKFLOW_ID_PATTERNS.stage),
	required: z.boolean().default(true),
	artifactRefs: z.array(ArtifactRefSchema).default([]),
	condition: z.string().optional(), // Optional condition expression
});

/** Stage input contract. */
export const StageInputContractSchema = z.strictObject({
	requiredArtifacts: z.array(ArtifactRefSchema).default([]),
	optionalArtifacts: z.array(ArtifactRefSchema).default([]),
	configurationRefs: z.array(z.string()).default([]),
	environmentVars: z.array(z.string()).default([]),
});

/** Stage output contract. */
export const StageOutputContractSchema = z.strictObject({
	producedArtifacts: z.array(ArtifactRefSchema).default([]),
	sideEffects: z.array(StageSideEffectSchema).default(["NONE"]),
	modifiesState: z.boolean().default(false),
	emitsEvents: z.array(z.string()).default([]),
});

/** Inference requirements for a stage. */
export const InferenceRequirementsSchema = z.strictObject({
	required: z.boolean().default(false),
	providers: z.array(z.string()).default([]),
	estimatedRequests: z.number().int().nonnegative().default(0),
	estimatedTokens: z.number().int().nonnegative().default(0),
	deterministic: z.boolean().default(true),
	structuredOutput: z.boolean().default(false),
	temperature: z.number().min(0).max(2).default(0),
	fallbackAllowed: z.boolean().default(true),
});

// ============================================================================
// Stage Definition
// ============================================================================

/** Complete stage definition in the workflow graph. */
export const StageDefinitionSchema = z.strictObject({
	// Stable identifier
	stageId: z.string().regex(WORKFLOW_ID_PATTERNS.stage),

	// Human-readable
	name: z.string().min(1),
	description: z.string().min(1),
	phase: WorkflowPhaseSchema,

	// Dependencies
	dependencies: z.array(StageDependencySchema).default([]),

	// Contracts
	inputContract: StageInputContractSchema,
	outputContract: StageOutputContractSchema,

	// Schemas (referenced by name for validation)
	inputSchema: z.string().optional(),
	outputSchema: z.string().optional(),

	// Execution
	sideEffects: z.array(StageSideEffectSchema).default(["NONE"]),
	retryPolicy: RetryPolicySchema,
	executionBudget: StageExecutionBudgetSchema,
	checkpointPolicy: CheckpointPolicySchema,
	inferenceRequirements: InferenceRequirementsSchema,

	// Failure handling
	failureBehavior: z
		.enum([
			"BLOCK_DOWNSTREAM",
			"ALLOW_PARTIAL",
			"SKIP_DOWNSTREAM",
			"ESCALATE",
		])
		.default("BLOCK_DOWNSTREAM"),
	recoverable: z.boolean().default(true),
	compensatingAction: z.string().optional(),

	// Validation
	validationResponsibility: z
		.enum(["SELF", "DOWNSTREAM", "ORCHESTRATOR", "SHARED"])
		.default("SELF"),
	postValidationHooks: z.array(z.string()).default([]),

	// Metadata
	modulePath: z.string().min(1), // e.g., 'src/lib/fact-dossier/index.js'
	entryPoint: z.string().min(1), // e.g., 'buildDossier'
	version: z.string().default("1.0.0"),
	tags: z.array(z.string()).default([]),
});

// ============================================================================
// Stage Execution Record
// ============================================================================

/** Record of a single stage execution attempt. */
export const StageExecutionRecordSchema = z.strictObject({
	stageId: z.string().regex(WORKFLOW_ID_PATTERNS.stage),
	attempt: z.number().int().positive().default(1),

	// State
	state: StageExecutionStateSchema,
	startedAt: z.string().optional(),
	completedAt: z.string().optional(),
	durationMs: z.number().int().nonnegative().optional(),

	// Input/Output
	inputArtifacts: z.array(ArtifactRefSchema).default([]),
	outputArtifacts: z.array(ArtifactRefSchema).default([]),
	inputHashes: z.record(z.string(), z.string()).default({}),
	outputHashes: z.record(z.string(), z.string()).default({}),

	// Resources
	resourcesUsed: z
		.strictObject({
			modelRequests: z.number().int().nonnegative().default(0),
			tokensUsed: z.number().int().nonnegative().default(0),
			sourceRequests: z.number().int().nonnegative().default(0),
			cpuMs: z.number().int().nonnegative().default(0),
			memoryPeakMb: z.number().int().nonnegative().default(0),
			temporaryStorageMb: z.number().int().nonnegative().default(0),
		})
		.prefault({}),

	// Errors
	error: z
		.strictObject({
			category: FailureCategorySchema,
			message: z.string(),
			details: z.record(z.string(), z.unknown()).optional(),
			recoverable: z.boolean(),
			retryEligible: z.boolean(),
			blockingDependencies: z.array(z.string()).default([]),
			recommendedAction: z.string().optional(),
		})
		.optional(),

	// Checkpoint
	checkpointId: z.string().optional(),
	checkpointStep: z.number().int().nonnegative().optional(),

	// Validation
	validationResults: z
		.array(
			z.strictObject({
				rule: z.string(),
				passed: z.boolean(),
				details: z.string().optional(),
			}),
		)
		.default([]),

	// Metadata
	executedBy: z.string().optional(),
	hostname: z.string().optional(),
	processId: z.number().int().optional(),
});

// ============================================================================
// Workflow Graph
// ============================================================================

/** Validated workflow dependency graph. */
export const WorkflowGraphSchema = z.strictObject({
	graphId: z.string().min(1),
	version: z.string().default("1.0.0"),
	stages: z.array(StageDefinitionSchema).min(1),
	edges: z
		.array(
			z.strictObject({
				from: z.string().regex(WORKFLOW_ID_PATTERNS.stage),
				to: z.string().regex(WORKFLOW_ID_PATTERNS.stage),
				type: z.enum(["HARD", "SOFT", "ARTIFACT"]).default("HARD"),
			}),
		)
		.default([]),
	validatedAt: z.string(),
	validatedBy: z.string().min(1),
	topologicalOrder: z.array(z.string().regex(WORKFLOW_ID_PATTERNS.stage)),
	cycles: z.array(z.array(z.string())).default([]), // Should be empty
	unreachableStages: z.array(z.string()).default([]),
});

// ============================================================================
// Edition Identity & Temporal Context
// ============================================================================

/** Edition identity with timezone-aware reporting window. */
export const EditionContextSchema = z.strictObject({
	editionId: z.string().regex(WORKFLOW_ID_PATTERNS.edition),
	editionDate: z.string().regex(WORKFLOW_ID_PATTERNS.editionDate),
	timezone: z.literal("Europe/Amsterdam"),
	reportingWindow: z.strictObject({
		start: z.string(), // ISO 8601 with offset
		end: z.string(), // ISO 8601 with offset
		startZoned: z.string(),
		endZoned: z.string(),
		durationHours: z.number().int().min(23).max(25),
	}),
	windowResolvedAt: z.string(), // When the window was computed
	scheduledExecutionTime: z.string().optional(), // Intended: 07:00 Europe/Amsterdam
	actualExecutionTime: z.string().optional(),
});

// ============================================================================
// Execution Manifest
// ============================================================================

/** Complete durable execution manifest for one workflow run. */
export const ExecutionManifestSchema = z.strictObject({
	// Identity
	manifestId: z.string().regex(WORKFLOW_ID_PATTERNS.workflowRun),
	schemaVersion: z.literal(WORKFLOW_ORCHESTRATOR_SCHEMA_VERSION),
	workflowGraphVersion: z.string(),
	contractVersion: z.string(), // Publication contract version

	// Edition context
	edition: EditionContextSchema,

	// Run configuration
	executionMode: WorkflowExecutionModeSchema,
	requestedAt: z.string(),
	initiatedBy: z.string().min(1),
	configurationRefs: z.array(z.string()).default([]),

	// Resource governance
	effectiveBudget: ResourceBudgetSchema,

	// Stage execution
	stages: z.array(StageExecutionRecordSchema).default([]),
	stageOrder: z
		.array(z.string().regex(WORKFLOW_ID_PATTERNS.stage))
		.default([]),

	// Dependencies & artifacts
	dependencyOutcomes: z
		.record(
			z.string(),
			z.strictObject({
				satisfied: z.boolean(),
				reason: z.string().optional(),
				artifacts: z.array(ArtifactRefSchema).default([]),
			}),
		)
		.default({}),

	// Retry & recovery
	retryAttempts: z
		.record(z.string(), z.number().int().nonnegative())
		.default({}),
	fallbackEvents: z
		.array(
			z.strictObject({
				stageId: z.string(),
				fromProvider: z.string(),
				toProvider: z.string(),
				reason: z.string(),
				at: z.string(),
			}),
		)
		.default([]),

	// Cache & checkpoints
	cacheHits: z.record(z.string(), z.number().int().nonnegative()).default({}),
	checkpoints: z
		.array(
			z.strictObject({
				checkpointId: z.string(),
				stageId: z.string(),
				step: z.number().int().nonnegative(),
				timestamp: z.string(),
				valid: z.boolean(),
			}),
		)
		.default([]),
	resumeHistory: z
		.array(
			z.strictObject({
				resumeId: z.string(),
				fromCheckpoint: z.string(),
				at: z.string(),
				reason: z.string(),
			}),
		)
		.default([]),

	// Validation & results
	validationResults: z
		.array(
			z.strictObject({
				stageId: z.string(),
				rule: z.string(),
				passed: z.boolean(),
				details: z.string().optional(),
			}),
		)
		.default([]),

	// Errors & limitations
	errors: z
		.array(
			z.strictObject({
				stageId: z.string().optional(),
				category: FailureCategorySchema,
				message: z.string(),
				recoverable: z.boolean(),
				at: z.string(),
			}),
		)
		.default([]),
	limitations: z
		.array(
			z.strictObject({
				stageId: z.string().optional(),
				description: z.string(),
				severity: z.enum(["BLOCKING", "DEGRADED", "INFORMATIONAL"]),
				workaround: z.string().optional(),
			}),
		)
		.default([]),

	// Completion
	completedAt: z.string().optional(),
	overallOutcome: WorkflowRunOutcomeSchema,
	contentHash: z
		.string()
		.regex(/^sha256:[a-f0-9]{64}$/)
		.optional(),

	// Next-stage readiness
	nextStageReadiness: z
		.record(
			z.string(),
			z.strictObject({
				stageId: z.string(),
				ready: z.boolean(),
				blockingReasons: z.array(z.string()).default([]),
			}),
		)
		.default({}),
});

// ============================================================================
// Workflow Lock
// ============================================================================

/** Lightweight execution lock for concurrency control. */
export const WorkflowLockSchema = z.strictObject({
	lockId: z.string().min(1),
	editionId: z.string().regex(WORKFLOW_ID_PATTERNS.edition),
	workflowRunId: z.string().regex(WORKFLOW_ID_PATTERNS.workflowRun),
	state: WorkflowLockStateSchema,
	acquiredAt: z.string(),
	acquiredBy: z.strictObject({
		processId: z.number().int(),
		hostname: z.string(),
		user: z.string(),
	}),
	expiresAt: z.string().optional(),
	lastHeartbeat: z.string().optional(),
	forceReleased: z.boolean().default(false),
	forceReleasedAt: z.string().optional(),
	forceReleasedBy: z.string().optional(),
});

// ============================================================================
// Workflow Report
// ============================================================================

/** Structured execution report for observability. */
export const WorkflowReportSchema = z.strictObject({
	reportId: z.string().min(1),
	manifestId: z.string().regex(WORKFLOW_ID_PATTERNS.workflowRun),
	editionId: z.string().regex(WORKFLOW_ID_PATTERNS.edition),
	editionDate: z.string().regex(WORKFLOW_ID_PATTERNS.editionDate),
	executionMode: WorkflowExecutionModeSchema,
	workflowGraphVersion: z.string(),
	contractVersion: z.string(),

	// Timing
	startedAt: z.string(),
	completedAt: z.string().optional(),
	totalDurationMs: z.number().int().nonnegative().optional(),

	// Overall
	overallStatus: WorkflowRunOutcomeSchema,
	stagesExecuted: z.number().int().nonnegative(),
	stagesSucceeded: z.number().int().nonnegative(),
	stagesFailed: z.number().int().nonnegative(),
	stagesBlocked: z.number().int().nonnegative(),
	stagesSkipped: z.number().int().nonnegative(),
	stagesIncomplete: z.number().int().nonnegative(),

	// Discovery coverage
	discoveryCoverage: z
		.strictObject({
			ring1SourcesAttempted: z.number().int().nonnegative(),
			ring1SourcesSuccessful: z.number().int().nonnegative(),
			ring2SourcesAttempted: z.number().int().nonnegative(),
			ring2SourcesSuccessful: z.number().int().nonnegative(),
			ring3SourcesAttempted: z.number().int().nonnegative(),
			ring3SourcesSuccessful: z.number().int().nonnegative(),
			mandatorySourcesAllChecked: z.boolean(),
			missingHighValueSources: z.number().int().nonnegative(),
			inaccessibleSources: z.number().int().nonnegative(),
			notCheckedSources: z.number().int().nonnegative(),
		})
		.optional(),

	// Temporal eligibility
	temporalEligibility: z
		.strictObject({
			newPass: z.number().int().nonnegative(),
			catchUp: z.number().int().nonnegative(),
			timeUnverified: z.number().int().nonnegative(),
			newFail: z.number().int().nonnegative(),
		})
		.optional(),

	// Verification
	verification: z
		.strictObject({
			totalCandidates: z.number().int().nonnegative(),
			totalClaims: z.number().int().nonnegative(),
			verifiedClaims: z.number().int().nonnegative(),
			partiallyVerifiedClaims: z.number().int().nonnegative(),
			unverifiedClaims: z.number().int().nonnegative(),
			contradictedClaims: z.number().int().nonnegative(),
			claimsWithCounterevidence: z.number().int().nonnegative(),
		})
		.optional(),

	// Omission review
	omissionReview: z
		.strictObject({
			completed: z.boolean(),
			strategiesExecuted: z.number().int().nonnegative(),
			criticalOmissions: z.number().int().nonnegative(),
			materialOmissions: z.number().int().nonnegative(),
			coverageGaps: z.number().int().nonnegative(),
			unresolvedCritical: z.number().int().nonnegative(),
			blockingGaps: z.number().int().nonnegative(),
		})
		.optional(),

	// Historical regression
	historicalRegression: z
		.strictObject({
			completed: z.boolean(),
			editionsCompared: z.number().int().nonnegative(),
			newDevelopments: z.number().int().nonnegative(),
			repeatedReporting: z.number().int().nonnegative(),
			substantiveUpdates: z.number().int().nonnegative(),
			potentialOmissions: z.number().int().nonnegative(),
			unresolvedQuestions: z.number().int().nonnegative(),
		})
		.optional(),

	// Editorial selection
	editorialSelection: z
		.strictObject({
			completed: z.boolean(),
			candidatesEvaluated: z.number().int().nonnegative(),
			storiesSelected: z.number().int().nonnegative(),
			readinessStatus: z.enum(["READY", "BLOCKED", "INCOMPLETE"]),
			unresolvedDependencies: z.number().int().nonnegative(),
		})
		.optional(),

	// Publication artifacts
	publication: z
		.strictObject({
			canonicalDocumentsGenerated: z.number().int().nonnegative(),
			englishDerivativesGenerated: z.number().int().nonnegative(),
			dailyIndexGenerated: z.boolean(),
			validationPassed: z.boolean(),
			crossLanguageConsistency: z.boolean(),
		})
		.optional(),

	// Quality evaluation
	qualityEvaluation: z
		.strictObject({
			q1q10Completed: z.boolean(),
			q1q10Passed: z.number().int().nonnegative(),
			q1q10Failed: z.number().int().nonnegative(),
			q1q10Unverified: z.number().int().nonnegative(),
			audioAGCompleted: z.boolean(),
			audioAGPassed: z.number().int().nonnegative(),
			audioAGFailed: z.number().int().nonnegative(),
			audioAGUnverified: z.number().int().nonnegative(),
			readableQualityCompleted: z.boolean(),
			visualizationAccessibilityCompleted: z.boolean(),
			repairsAttempted: z.number().int().nonnegative(),
			repairsSuccessful: z.number().int().nonnegative(),
			downstreamRegressions: z.number().int().nonnegative(),
		})
		.optional(),

	// Knowledge continuity
	knowledgeContinuity: z
		.strictObject({
			thesaurusEvaluated: z.boolean(),
			thesaurusChanges: z.number().int().nonnegative(),
			architecturePrinciplesEvaluated: z.boolean(),
			architecturePrinciplesChanges: z.number().int().nonnegative(),
			bookDeltaEvaluated: z.boolean(),
			bookDeltaProposals: z.number().int().nonnegative(),
			persistenceVerified: z.boolean(),
			readbackVerified: z.boolean(),
			skippedStages: z.array(z.string()).default([]),
		})
		.optional(),

	// Resources
	resources: z.strictObject({
		modelRequests: z.number().int().nonnegative(),
		tokensUsed: z.number().int().nonnegative(),
		sourceRequests: z.number().int().nonnegative(),
		totalCpuMs: z.number().int().nonnegative(),
		peakMemoryMb: z.number().int().nonnegative(),
		fallbackCount: z.number().int().nonnegative(),
		providersExhausted: z.boolean(),
	}),

	// Retries
	retries: z.strictObject({
		totalAttempts: z.number().int().nonnegative(),
		successfulRetries: z.number().int().nonnegative(),
		failedRetries: z.number().int().nonnegative(),
		byCategory: z
			.record(z.string(), z.number().int().nonnegative())
			.default({}),
	}),

	// Unresolved
	unresolvedDefects: z
		.array(
			z.strictObject({
				stageId: z.string(),
				description: z.string(),
				severity: z.enum(["CRITICAL", "MAJOR", "MINOR"]),
				blocking: z.boolean(),
			}),
		)
		.default([]),

	// Blocking failures
	blockingFailures: z
		.array(
			z.strictObject({
				stageId: z.string(),
				category: FailureCategorySchema,
				message: z.string(),
			}),
		)
		.default([]),

	// Evidence classification
	evidenceClassification: z.strictObject({
		executed: z.number().int().nonnegative(),
		validated: z.number().int().nonnegative(),
		modelAssessed: z.number().int().nonnegative(),
		independentlyVerified: z.number().int().nonnegative(),
		unverified: z.number().int().nonnegative(),
		notExecuted: z.number().int().nonnegative(),
	}),

	// Checkpoint & resume
	checkpointInfo: z.strictObject({
		checkpointsCreated: z.number().int().nonnegative(),
		checkpointsValid: z.number().int().nonnegative(),
		resumePossible: z.boolean(),
		lastValidCheckpoint: z.string().optional(),
	}),
});

// ============================================================================
// CLI Options
// ============================================================================

/** Command-line interface options. */
export const CliOptionsSchema = z.strictObject({
	edition: z.string().regex(WORKFLOW_ID_PATTERNS.editionDate).optional(),
	mode: WorkflowExecutionModeSchema.default("PLAN"),
	config: z.string().optional(),
	graph: z.string().optional(),
	resumeFrom: z.string().optional(),
	forceResume: z.boolean().default(false),
	dryRunFixtures: z.string().optional(),
	outputDir: z.string().optional(),
	verbose: z.boolean().default(false),
	dryRun: z.boolean().default(false),
	noPersist: z.boolean().default(false),
	skipStages: z.array(z.string()).default([]),
	onlyStages: z.array(z.string()).default([]),
	maxParallelism: z.number().int().positive().default(1),
	budgetOverride: z.string().optional(),
	timeoutMs: z.number().int().positive().optional(),
});

// ============================================================================
// Inferred TypeScript Types
// ============================================================================

export type WorkflowExecutionMode = z.infer<typeof WorkflowExecutionModeSchema>;
export type StageExecutionState = z.infer<typeof StageExecutionStateSchema>;
export type StageSideEffect = z.infer<typeof StageSideEffectSchema>;
export type FailureCategory = z.infer<typeof FailureCategorySchema>;
export type WorkflowRunOutcome = z.infer<typeof WorkflowRunOutcomeSchema>;
export type WorkflowPhase = z.infer<typeof WorkflowPhaseSchema>;
export type ArtifactValidationStatus = z.infer<
	typeof ArtifactValidationStatusSchema
>;
export type WorkflowLockState = z.infer<typeof WorkflowLockStateSchema>;

export type ResourceBudget = z.infer<typeof ResourceBudgetSchema>;
export type RetryPolicy = z.infer<typeof RetryPolicySchema>;
export type CheckpointPolicy = z.infer<typeof CheckpointPolicySchema>;
export type StageExecutionBudget = z.infer<typeof StageExecutionBudgetSchema>;
export type ArtifactRef = z.infer<typeof ArtifactRefSchema>;
export type StageDependency = z.infer<typeof StageDependencySchema>;
export type StageInputContract = z.infer<typeof StageInputContractSchema>;
export type StageOutputContract = z.infer<typeof StageOutputContractSchema>;
export type InferenceRequirements = z.infer<typeof InferenceRequirementsSchema>;

export type StageDefinition = z.infer<typeof StageDefinitionSchema>;
/** Schema input type: defaulted fields may be omitted by graph definitions. */
export type StageDefinitionInput = z.input<typeof StageDefinitionSchema>;
export type StageExecutionRecord = z.infer<typeof StageExecutionRecordSchema>;
export type WorkflowGraph = z.infer<typeof WorkflowGraphSchema>;
export type EditionContext = z.infer<typeof EditionContextSchema>;
export type ExecutionManifest = z.infer<typeof ExecutionManifestSchema>;
export type WorkflowLock = z.infer<typeof WorkflowLockSchema>;
export type WorkflowReport = z.infer<typeof WorkflowReportSchema>;
export type CliOptions = z.infer<typeof CliOptionsSchema>;

// ============================================================================
// JSON Schema Generation
// ============================================================================

/**
 * Generate the draft-07 JSON Schema for a stage definition.
 */
export function generateStageDefinitionJsonSchema(): Record<string, unknown> {
	const generated = z.toJSONSchema(StageDefinitionSchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/workflow-stage-definition.json",
		title: "Workflow Stage Definition",
		description:
			"Complete definition of a workflow stage with dependencies, contracts, execution budget, and failure handling.",
		...generated,
	};
}

/**
 * Generate the draft-07 JSON Schema for the workflow graph.
 */
export function generateWorkflowGraphJsonSchema(): Record<string, unknown> {
	const generated = z.toJSONSchema(WorkflowGraphSchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/workflow-graph.json",
		title: "Workflow Graph",
		description:
			"Validated directed acyclic graph of workflow stages with topological ordering.",
		...generated,
	};
}

/**
 * Generate the draft-07 JSON Schema for the execution manifest.
 */
export function generateExecutionManifestJsonSchema(): Record<string, unknown> {
	const generated = z.toJSONSchema(ExecutionManifestSchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/execution-manifest.json",
		title: "Execution Manifest",
		description:
			"Durable execution manifest capturing complete workflow run state, artifacts, resources, and outcomes.",
		...generated,
	};
}

/**
 * Generate the draft-07 JSON Schema for the workflow report.
 */
export function generateWorkflowReportJsonSchema(): Record<string, unknown> {
	const generated = z.toJSONSchema(WorkflowReportSchema, {
		target: "draft-07",
	}) as Record<string, unknown>;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://ai-intelligence-blog/schemas/workflow-report.json",
		title: "Workflow Report",
		description:
			"Structured execution report covering all phases, quality, knowledge continuity, and resource usage.",
		...generated,
	};
}
