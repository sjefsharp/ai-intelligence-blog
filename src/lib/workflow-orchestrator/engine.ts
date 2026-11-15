/**
 * Workflow Orchestrator — Engine
 *
 * Deterministic execution engine for the AI Daily Intelligence workflow graph.
 * Implements stage sequencing, dependency management, checkpointing, failure handling,
 * resource governance, and safe resumption.
 */

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { Temporal } from "@js-temporal/polyfill";

// Fix for NodeJS namespace
declare global {
	namespace NodeJS {
		interface Timeout {}
	}
}

import {
	WORKFLOW_ID_PATTERNS,
	WORKFLOW_ORCHESTRATOR_SCHEMA_VERSION,
	// Schema values
	StageDefinitionSchema,
	StageExecutionRecordSchema,
	ExecutionManifestSchema,
	WorkflowLockSchema,
	WorkflowReportSchema,
	EditionContextSchema,
	CliOptionsSchema,
} from "./schema.js";

import type {
	// Types
	StageDefinition,
	StageExecutionRecord,
	StageExecutionState,
	StageDependency,
	ArtifactRef,
	WorkflowExecutionMode,
	WorkflowRunOutcome,
	FailureCategory,
	WorkflowPhase,
	EditionContext,
	ExecutionManifest,
	WorkflowLock,
	WorkflowLockState,
	WorkflowReport,
	CliOptions,
	ResourceBudget,
	StageExecutionBudget,
	RetryPolicy,
	CheckpointPolicy,
	InferenceRequirements,
	ArtifactValidationStatus,
	StageSideEffect,
} from "./schema.js";

import {
	ALL_STAGES,
	WORKFLOW_GRAPH,
	getStageById,
	getStagesByPhase,
	validateWorkflowGraph,
} from "./graph.js";

import { getEditorialWindow, EDITORIAL_TIMEZONE } from "../editorial-window.js";
import {
	createFreeLLMClient,
	hasInferenceCredentials,
	FreeLLMClient,
} from "../free-llm-client.js";

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MANIFEST_DIR = "data/execution-manifests";
const DEFAULT_LOCK_DIR = "data/locks";
const DEFAULT_REPORT_DIR = "data/workflow-reports";
const DEFAULT_EVIDENCE_DIR = "data/evidence-packages";
const LOCK_TTL_HOURS = 24;
const HEARTBEAT_INTERVAL_MS = 30000;

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(prefix: string): string {
	return `${prefix}${crypto.randomBytes(8).toString("hex")}`;
}

function generateContentHash(data: unknown): string {
	const content = JSON.stringify(data, Object.keys(data as object).sort());
	return `sha256:${crypto.createHash("sha256").update(content).digest("hex")}`;
}

function computeArtifactHash(filePath: string): Promise<string | null> {
	return fs
		.readFile(filePath)
		.then(
			(content) =>
				`sha256:${crypto.createHash("sha256").update(content).digest("hex")}`,
		)
		.catch(() => null);
}

function nowISO(): string {
	return new Date().toISOString();
}

function parseEditionDate(editionId: string): string {
	const match = editionId.match(/^edition_(\d{4}-\d{2}-\d{2})$/);
	return match ? match[1] : editionId;
}

// ============================================================================
// Workflow Engine Class
// ============================================================================

export class WorkflowOrchestrator {
	private manifestDir: string;
	private lockDir: string;
	private reportDir: string;
	private evidenceDir: string;
	private cliOptions: CliOptions;
	private manifest: ExecutionManifest | null = null;
	private lock: WorkflowLock | null = null;
	private llmClient: FreeLLMClient | null = null;
	private stageModules: Map<string, any> = new Map();
	private heartbeatTimer: NodeJS.Timeout | null = null;
	private startTime: number = 0;

	constructor(cliOptions: CliOptions) {
		this.cliOptions = CliOptionsSchema.parse(cliOptions);
		this.manifestDir = cliOptions.outputDir || DEFAULT_MANIFEST_DIR;
		this.lockDir = DEFAULT_LOCK_DIR;
		this.reportDir = DEFAULT_REPORT_DIR;
		this.evidenceDir = DEFAULT_EVIDENCE_DIR;
	}

	// ============================================================================
	// Initialization
	// ============================================================================

	async initialize(): Promise<void> {
		// Validate workflow graph
		const graphValidation = validateWorkflowGraph();
		if (!graphValidation.valid) {
			throw new Error(
				`Workflow graph invalid: ${graphValidation.errors.join("; ")}`,
			);
		}
		if (graphValidation.warnings.length > 0) {
			console.warn(
				"Workflow graph warnings:",
				graphValidation.warnings.join("; "),
			);
		}

		// Create directories
		await fs.mkdir(this.manifestDir, { recursive: true });
		await fs.mkdir(this.lockDir, { recursive: true });
		await fs.mkdir(this.reportDir, { recursive: true });
		await fs.mkdir(this.evidenceDir, { recursive: true });

		// Initialize LLM client if needed
		if (this.needsInference()) {
			this.llmClient = createFreeLLMClient({
				validateOnly:
					this.cliOptions.mode === "DRY_RUN" ||
					this.cliOptions.mode === "VALIDATE",
				budget: {
					maxRequests: this.getEffectiveBudget().maxModelRequests,
					maxTokens: this.getEffectiveBudget().maxTokens,
					maxCostUsd: 0,
				},
			});

			const validation = await this.llmClient.validate();
			if (!validation.valid) {
				throw new Error(
					`LLM client validation failed: ${validation.errors.join("; ")}`,
				);
			}
			if (validation.warnings.length > 0) {
				console.warn(
					"LLM client warnings:",
					validation.warnings.join("; "),
				);
			}
		}

		// Load stage modules lazily
		this.preloadStageModules();
	}

	private needsInference(): boolean {
		const inferenceStages = ALL_STAGES.filter(
			(s) => s.inferenceRequirements.required,
		);
		return inferenceStages.length > 0 && this.cliOptions.mode !== "PLAN";
	}

	private getEffectiveBudget(): ResourceBudget {
		const baseBudget: ResourceBudget = {
			maxModelRequests: 1000,
			maxTokens: 500000,
			maxSourceRequests: 5000,
			maxStageDurationMs: 1800000,
			maxTotalDurationMs: 7200000,
			maxConcurrentModelCalls: this.cliOptions.maxParallelism,
			maxTemporaryStorageMb: 1024,
			maxArtifactSizeMb: 100,
			maxRetriesPerStage: 3,
			inferenceBudget: {
				maxRequests: 1000,
				maxTokens: 500000,
				maxCostUsd: 0,
			},
		};

		if (this.cliOptions.budgetOverride) {
			try {
				const override = JSON.parse(this.cliOptions.budgetOverride);
				return { ...baseBudget, ...override };
			} catch {
				console.warn("Invalid budget override, using defaults");
			}
		}
		return baseBudget;
	}

	private preloadStageModules(): void {
		// Module paths are declared in stage definitions
		// We'll load them dynamically when executing
	}

	// ============================================================================
	// Lock Management
	// ============================================================================

	async acquireLock(editionContext: EditionContext): Promise<WorkflowLock> {
		const editionId = editionContext.editionId;
		const lockPath = path.join(this.lockDir, `${editionId}.lock`);
		const workflowRunId = generateId("wfr_");
		const acquiredAt = nowISO();
		const expiresAt = Temporal.Instant.from(acquiredAt)
			.add({ hours: LOCK_TTL_HOURS })
			.toString();

		// Check existing lock
		try {
			const existingContent = await fs.readFile(lockPath, "utf-8");
			const existingLock = JSON.parse(existingContent) as WorkflowLock;

			if (existingLock.state === "HELD") {
				const lastHeartbeat = existingLock.lastHeartbeat
					? Temporal.Instant.from(existingLock.lastHeartbeat)
					: Temporal.Instant.from(existingLock.acquiredAt);
				const now = Temporal.Now.instant();
				const hoursSinceHeartbeat = now
					.since(lastHeartbeat)
					.total({ unit: "hour" });

				if (
					hoursSinceHeartbeat < LOCK_TTL_HOURS &&
					!this.cliOptions.forceResume
				) {
					// Lock is active
					throw new Error(
						`CONCURRENT_EXECUTION: Edition ${editionId} already locked by run ${existingLock.workflowRunId} ` +
							`(PID ${existingLock.acquiredBy.processId} on ${existingLock.acquiredBy.hostname}, ` +
							`heartbeat ${hoursSinceHeartbeat.toFixed(1)}h ago). Use --force-resume to override.`,
					);
				}
				// Stale lock - we can take it
				console.warn(
					`Stale lock detected for ${editionId}, taking ownership`,
				);
			}
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
				// File doesn't exist - that's fine
				if (!(err as Error).message.includes("CONCURRENT_EXECUTION")) {
					throw err;
				}
				throw err;
			}
		}

		// Acquire lock
		this.lock = {
			lockId: generateId("lock_"),
			editionId,
			workflowRunId,
			state: "HELD",
			acquiredAt,
			acquiredBy: {
				processId: process.pid,
				hostname: require("os").hostname(),
				user: process.env.USER || "unknown",
			},
			expiresAt,
			lastHeartbeat: acquiredAt,
			forceReleased: false,
		};

		await fs.writeFile(
			lockPath,
			JSON.stringify(this.lock, null, 2),
			"utf-8",
		);

		// Start heartbeat
		this.startHeartbeat(lockPath);

		console.log(
			`Acquired lock for edition ${editionId} (run ${workflowRunId})`,
		);
		return this.lock;
	}

	private startHeartbeat(lockPath: string): void {
		this.heartbeatTimer = setInterval(async () => {
			if (!this.lock) return;
			this.lock.lastHeartbeat = nowISO();
			try {
				await fs.writeFile(
					lockPath,
					JSON.stringify(this.lock, null, 2),
					"utf-8",
				);
			} catch {
				// Ignore heartbeat failures
			}
		}, HEARTBEAT_INTERVAL_MS);
	}

	async releaseLock(finalState: WorkflowLockState = "FREE"): Promise<void> {
		if (!this.lock) return;

		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}

		const lockPath = path.join(this.lockDir, `${this.lock.editionId}.lock`);
		this.lock.state = finalState;
		this.lock.lastHeartbeat = nowISO();

		try {
			await fs.writeFile(
				lockPath,
				JSON.stringify(this.lock, null, 2),
				"utf-8",
			);
			console.log(
				`Released lock for edition ${this.lock.editionId} (state: ${finalState})`,
			);
		} catch (err) {
			console.error("Failed to release lock:", err);
		}
	}

	// ============================================================================
	// Manifest Management
	// ============================================================================

	async createManifest(
		editionContext: EditionContext,
	): Promise<ExecutionManifest> {
		const workflowRunId = generateId("wfr_");
		const topologicalOrder = WORKFLOW_GRAPH.topologicalOrder;

		const initialStages: StageExecutionRecord[] = ALL_STAGES.map(
			(stage) => ({
				stageId: stage.stageId,
				attempt: 1,
				state: "PENDING",
				inputArtifacts: [],
				outputArtifacts: [],
				inputHashes: {},
				outputHashes: {},
				resourcesUsed: {
					modelRequests: 0,
					tokensUsed: 0,
					sourceRequests: 0,
					cpuMs: 0,
					memoryPeakMb: 0,
					temporaryStorageMb: 0,
				},
				validationResults: [],
			}),
		);

		this.manifest = {
			manifestId: workflowRunId,
			schemaVersion: WORKFLOW_ORCHESTRATOR_SCHEMA_VERSION,
			workflowGraphVersion: WORKFLOW_GRAPH.version,
			contractVersion: "1.0", // From publication contract
			edition: editionContext,
			executionMode: this.cliOptions.mode,
			requestedAt: nowISO(),
			initiatedBy: `workflow-orchestrator/${process.pid}`,
			configurationRefs: [],
			effectiveBudget: this.getEffectiveBudget(),
			stages: initialStages,
			stageOrder: topologicalOrder,
			dependencyOutcomes: {},
			retryAttempts: {},
			fallbackEvents: [],
			cacheHits: {},
			checkpoints: [],
			resumeHistory: [],
			validationResults: [],
			errors: [],
			limitations: [],
			overallOutcome: "INCOMPLETE",
			nextStageReadiness: {},
		};

		// Persist initial manifest
		await this.persistManifest();
		return this.manifest;
	}

	async persistManifest(): Promise<void> {
		if (!this.manifest) throw new Error("No manifest to persist");

		const manifestPath = path.join(
			this.manifestDir,
			`${this.manifest.edition.editionId}_${this.manifest.manifestId.slice(0, 8)}.json`,
		);

		// Update content hash
		this.manifest.contentHash = generateContentHash(this.manifest);

		await fs.writeFile(
			manifestPath,
			JSON.stringify(this.manifest, null, 2),
			"utf-8",
		);
	}

	async loadManifest(
		editionId: string,
		runId?: string,
	): Promise<ExecutionManifest | null> {
		try {
			const files = await fs.readdir(this.manifestDir);
			let targetFile: string | null = null;

			if (runId) {
				targetFile =
					files.find((f) =>
						f.startsWith(`${editionId}_${runId.slice(0, 8)}`),
					) || null;
			} else {
				// Find latest for this edition
				const editionFiles = files
					.filter(
						(f) =>
							f.startsWith(`${editionId}_`) &&
							f.endsWith(".json"),
					)
					.sort()
					.reverse();
				targetFile = editionFiles[0] || null;
			}

			if (!targetFile) return null;

			const content = await fs.readFile(
				path.join(this.manifestDir, targetFile),
				"utf-8",
			);
			return ExecutionManifestSchema.parse(JSON.parse(content));
		} catch {
			return null;
		}
	}

	// ============================================================================
	// Stage Execution
	// ============================================================================

	async executeStage(
		stageDef: StageDefinition,
	): Promise<StageExecutionRecord> {
		if (!this.manifest) throw new Error("Manifest not initialized");

		const stageRecord = this.manifest.stages.find(
			(s) => s.stageId === stageDef.stageId,
		);
		if (!stageRecord)
			throw new Error(`Stage record not found: ${stageDef.stageId}`);

		// Check if already completed successfully
		if (stageRecord.state === "SUCCEEDED" && !this.cliOptions.forceResume) {
			console.log(`Stage ${stageDef.name} already SUCCEEDED, skipping`);
			return stageRecord;
		}

		// Check dependencies
		const depCheck = this.checkDependencies(stageDef);
		if (!depCheck.satisfied) {
			stageRecord.state = "BLOCKED";
			this.manifest.dependencyOutcomes[stageDef.stageId] = {
				satisfied: false,
				reason: depCheck.reason,
				artifacts: [],
			};
			await this.persistManifest();
			throw new Error(
				`Dependencies not satisfied for ${stageDef.name}: ${depCheck.reason}`,
			);
		}

		this.manifest.dependencyOutcomes[stageDef.stageId] = {
			satisfied: true,
			reason: "All dependencies satisfied",
			artifacts: depCheck.artifacts,
		};

		// Update stage state
		stageRecord.state = "RUNNING";
		stageRecord.startedAt = nowISO();
		stageRecord.attempt =
			(this.manifest.retryAttempts[stageDef.stageId] || 0) + 1;
		this.manifest.retryAttempts[stageDef.stageId] = stageRecord.attempt;
		await this.persistManifest();

		console.log(
			`Executing stage: ${stageDef.name} (attempt ${stageRecord.attempt})`,
		);

		try {
			// Execute the stage
			const result = await this.runStageModule(stageDef, stageRecord);

			// Update record with results
			stageRecord.state = "SUCCEEDED";
			stageRecord.completedAt = nowISO();
			stageRecord.durationMs =
				Date.parse(stageRecord.completedAt) -
				Date.parse(stageRecord.startedAt!);
			stageRecord.outputArtifacts = result.outputArtifacts || [];
			stageRecord.outputHashes = result.outputHashes || {};
			stageRecord.resourcesUsed = {
				...stageRecord.resourcesUsed,
				...result.resourcesUsed,
			};
			stageRecord.validationResults = result.validationResults || [];
			stageRecord.checkpointId = result.checkpointId;

			// Update manifest
			this.manifest.stages = this.manifest.stages.map((s) =>
				s.stageId === stageDef.stageId ? stageRecord : s,
			);

			await this.persistManifest();
			console.log(`Stage ${stageDef.name} SUCCEEDED`);
			return stageRecord;
		} catch (error) {
			return this.handleStageError(stageDef, stageRecord, error);
		}
	}

	private checkDependencies(stageDef: StageDefinition): {
		satisfied: boolean;
		reason: string;
		artifacts: ArtifactRef[];
	} {
		if (!this.manifest)
			return { satisfied: false, reason: "No manifest", artifacts: [] };

		const artifacts: ArtifactRef[] = [];
		const missing: string[] = [];

		for (const dep of stageDef.dependencies) {
			if (!dep.required) continue;

			const depRecord = this.manifest.stages.find(
				(s) => s.stageId === dep.stageId,
			);
			if (!depRecord) {
				missing.push(`${dep.stageId} (no record)`);
				continue;
			}

			if (depRecord.state !== "SUCCEEDED") {
				missing.push(`${dep.stageId} (state: ${depRecord.state})`);
				continue;
			}

			// Check artifact references
			for (const artifactRef of dep.artifactRefs || []) {
				artifacts.push(artifactRef);
				// In a real implementation, we'd verify the artifact exists
				// For now, we trust the dependency succeeded
			}
		}

		if (missing.length > 0) {
			return {
				satisfied: false,
				reason: `Missing dependencies: ${missing.join(", ")}`,
				artifacts,
			};
		}

		return {
			satisfied: true,
			reason: "All dependencies satisfied",
			artifacts,
		};
	}

	private async runStageModule(
		stageDef: StageDefinition,
		stageRecord: StageExecutionRecord,
	): Promise<{
		outputArtifacts: ArtifactRef[];
		outputHashes: Record<string, string>;
		resourcesUsed: Partial<StageExecutionRecord["resourcesUsed"]>;
		validationResults: StageExecutionRecord["validationResults"];
		checkpointId?: string;
	}> {
		// Prepare input
		const input = await this.prepareStageInput(stageDef, stageRecord);

		// Create checkpoint if enabled
		let checkpointId: string | undefined;
		if (stageDef.checkpointPolicy.enabled) {
			checkpointId = generateId("cp_");
		}

		// Execute based on mode
		let result: any;

		if (
			this.cliOptions.mode === "DRY_RUN" ||
			this.cliOptions.mode === "VALIDATE"
		) {
			// Dry run: validate inputs, return mock outputs
			result = await this.dryRunStage(stageDef, input);
		} else if (this.cliOptions.mode === "PLAN") {
			// Plan mode: just validate contracts - no module loading needed
			result = await this.planStage(stageDef, input);
		} else {
			// Execute mode: load module and run actual stage
			const module = await this.loadStageModule(stageDef.modulePath);
			const entryPoint = module[stageDef.entryPoint];
			if (!entryPoint) {
				throw new Error(
					`Entry point ${stageDef.entryPoint} not found in ${stageDef.modulePath}`,
				);
			}
			result = await entryPoint(input);
		}

		// Validate outputs against contract
		const validationResults = await this.validateStageOutputs(
			stageDef,
			result,
		);

		// Compute hashes
		const outputHashes: Record<string, string> = {};
		for (const artifact of result.outputArtifacts || []) {
			if (artifact.path && !artifact.path.startsWith("memory://")) {
				const hash = await computeArtifactHash(artifact.path);
				if (hash) outputHashes[artifact.artifactId] = hash;
			}
		}

		return {
			outputArtifacts: result.outputArtifacts || [],
			outputHashes,
			resourcesUsed: result.resourcesUsed || {},
			validationResults,
			checkpointId,
		};
	}

	private async loadStageModule(modulePath: string): Promise<any> {
		if (this.stageModules.has(modulePath)) {
			return this.stageModules.get(modulePath);
		}

		try {
			// Handle both relative and absolute paths
			const resolvedPath =
				modulePath.startsWith(".") || modulePath.startsWith("/")
					? modulePath
					: `../${modulePath}`;

			const module = await import(resolvedPath);
			this.stageModules.set(modulePath, module);
			return module;
		} catch (err) {
			throw new Error(
				`Failed to load module ${modulePath}: ${(err as Error).message}`,
			);
		}
	}

	private async prepareStageInput(
		stageDef: StageDefinition,
		stageRecord: StageExecutionRecord,
	): Promise<any> {
		// Build input from manifest and artifact references
		const input: Record<string, any> = {
			editionDate: this.manifest?.edition.editionDate,
			editionContext: this.manifest?.edition,
			cliOptions: this.cliOptions,
			llmClient: this.llmClient,
		};

		// Add artifact paths
		for (const artifact of stageRecord.inputArtifacts) {
			input[artifact.artifactId] = artifact.path;
		}

		return input;
	}

	private async dryRunStage(
		stageDef: StageDefinition,
		input: any,
	): Promise<any> {
		console.log(`  [DRY_RUN] Would execute: ${stageDef.name}`);
		console.log(
			`  [DRY_RUN] Module: ${stageDef.modulePath}.${stageDef.entryPoint}`,
		);
		console.log(`  [DRY_RUN] Input keys: ${Object.keys(input).join(", ")}`);

		// Return mock output matching output contract
		const mockOutputs: ArtifactRef[] =
			stageDef.outputContract.producedArtifacts.map((a) => ({
				...a,
				path: a.path.replace(
					"{edition}",
					input.editionDate || "YYYY-MM-DD",
				),
			}));

		return {
			outputArtifacts: mockOutputs,
			resourcesUsed: {
				modelRequests: 0,
				tokensUsed: 0,
				sourceRequests: 0,
				cpuMs: 100,
				memoryPeakMb: 50,
				temporaryStorageMb: 10,
			},
			validationResults: [],
		};
	}

	private async planStage(
		stageDef: StageDefinition,
		input: any,
	): Promise<any> {
		console.log(`  [PLAN] Stage: ${stageDef.name}`);
		console.log(`  [PLAN] Phase: ${stageDef.phase}`);
		console.log(
			`  [PLAN] Dependencies: ${stageDef.dependencies.map((d) => d.stageId).join(", ") || "none"}`,
		);
		console.log(
			`  [PLAN] Side effects: ${stageDef.sideEffects.join(", ")}`,
		);
		console.log(
			`  [PLAN] Inference: ${stageDef.inferenceRequirements.required ? "required" : "not required"}`,
		);
		console.log(
			`  [PLAN] Budget: ${stageDef.executionBudget.timeoutMs}ms, ${stageDef.executionBudget.inferenceBudget?.maxRequests || 0} model reqs`,
		);

		return {
			outputArtifacts: stageDef.outputContract.producedArtifacts,
			resourcesUsed: {},
			validationResults: [],
		};
	}

	private async validateStageOutputs(
		stageDef: StageDefinition,
		result: any,
	): Promise<StageExecutionRecord["validationResults"]> {
		const validationResults: StageExecutionRecord["validationResults"] = [];

		// Check all required artifacts produced
		for (const expected of stageDef.outputContract.producedArtifacts) {
			if (expected.required) {
				const produced = result.outputArtifacts?.find(
					(a: ArtifactRef) => a.artifactId === expected.artifactId,
				);
				validationResults.push({
					rule: `artifact_${expected.artifactId}_produced`,
					passed: !!produced,
					details: produced
						? `Produced at ${produced.path}`
						: "Required artifact not produced",
				});
			}
		}

		// Validate schemas if specified
		if (stageDef.outputSchema && result.outputArtifacts) {
			// Schema validation would go here
			validationResults.push({
				rule: `output_schema_${stageDef.outputSchema}`,
				passed: true,
				details: "Schema validation placeholder",
			});
		}

		return validationResults;
	}

	private async handleStageError(
		stageDef: StageDefinition,
		stageRecord: StageExecutionRecord,
		error: unknown,
	): Promise<StageExecutionRecord> {
		const err = error instanceof Error ? error : new Error(String(error));
		const attempt = stageRecord.attempt;
		const maxRetries = stageDef.retryPolicy.maxAttempts;

		// Classify error
		const category = this.classifyError(err, stageDef);
		const retryable =
			stageDef.retryPolicy.retryableCategories.includes(category) &&
			attempt < maxRetries;

		const errorRecord = {
			category,
			message: err.message,
			details: { stack: err.stack },
			recoverable: retryable || stageDef.recoverable,
			retryEligible: retryable,
			blockingDependencies: [],
			recommendedAction: retryable
				? `Retry (attempt ${attempt + 1}/${maxRetries})`
				: "Manual intervention required",
		};

		stageRecord.error = errorRecord;
		stageRecord.state = retryable ? "PENDING" : "FAILED";

		this.manifest!.errors.push({
			stageId: stageDef.stageId,
			category,
			message: err.message,
			recoverable: retryable || stageDef.recoverable,
			at: nowISO(),
		});

		await this.persistManifest();

		if (retryable) {
			console.warn(
				`Stage ${stageDef.name} failed (attempt ${attempt}/${maxRetries}), will retry: ${err.message}`,
			);
			// Wait for backoff
			const delay = this.calculateBackoff(attempt, stageDef.retryPolicy);
			await new Promise((r) => setTimeout(r, delay));
			return this.executeStage(stageDef);
		}

		// Check failure behavior
		if (stageDef.failureBehavior === "BLOCK_DOWNSTREAM") {
			throw new Error(`Stage ${stageDef.name} failed: ${err.message}`);
		} else if (stageDef.failureBehavior === "ALLOW_PARTIAL") {
			stageRecord.state = "INCOMPLETE";
			console.warn(`Stage ${stageDef.name} INCOMPLETE: ${err.message}`);
			return stageRecord;
		} else if (stageDef.failureBehavior === "SKIP_DOWNSTREAM") {
			stageRecord.state = "SKIPPED";
			console.warn(`Stage ${stageDef.name} SKIPPED: ${err.message}`);
			return stageRecord;
		} else {
			throw new Error(`Stage ${stageDef.name} failed: ${err.message}`);
		}
	}

	private classifyError(
		error: Error,
		stageDef: StageDefinition,
	): FailureCategory {
		const message = error.message.toLowerCase();

		if (
			message.includes("econnrefused") ||
			message.includes("enotfound") ||
			message.includes("timeout")
		) {
			return "NETWORK_FAILURE";
		}
		if (message.includes("429") || message.includes("rate limit")) {
			return "RATE_LIMITED";
		}
		if (
			message.includes("api key") ||
			message.includes("unauthorized") ||
			message.includes("401") ||
			message.includes("403")
		) {
			return "INFERENCE_UNAVAILABLE";
		}
		if (
			message.includes("budget") ||
			message.includes("exhausted") ||
			message.includes("quota")
		) {
			return "RESOURCE_EXHAUSTED";
		}
		if (
			message.includes("validation") ||
			message.includes("schema") ||
			message.includes("contract")
		) {
			return "VALIDATION_FAILED";
		}
		if (
			message.includes("enoent") ||
			message.includes("eacces") ||
			message.includes("permission")
		) {
			return "PERSISTENCE_FAILED";
		}
		if (message.includes("concurrent") || message.includes("lock")) {
			return "CONCURRENT_EXECUTION";
		}
		if (
			message.includes("dependency") ||
			message.includes("not satisfied")
		) {
			return "DEPENDENCY_FAILED";
		}

		// Check if it's a source availability error
		if (
			stageDef.sideEffects.includes("NETWORK_FETCH") &&
			(message.includes("not found") || message.includes("404"))
		) {
			return "SOURCE_UNAVAILABLE";
		}

		return "INTERNAL_ERROR";
	}

	private calculateBackoff(
		attempt: number,
		retryPolicy: RetryPolicy,
	): number {
		const delay = Math.min(
			retryPolicy.baseDelayMs * Math.pow(2, attempt),
			retryPolicy.maxDelayMs,
		);
		const jitter = delay * retryPolicy.jitterFactor * Math.random();
		return Math.floor(delay + jitter);
	}

	// ============================================================================
	// Workflow Execution
	// ============================================================================

	async run(editionDate?: string): Promise<WorkflowReport> {
		this.startTime = Date.now();

		// Resolve edition date
		const targetEditionDate =
			editionDate ||
			this.cliOptions.edition ||
			this.getDefaultEditionDate();
		console.log(
			`Starting workflow for edition ${targetEditionDate} in ${this.cliOptions.mode} mode`,
		);

		// Create edition context
		const editionContext = this.createEditionContext(targetEditionDate);

		// Acquire lock (skip in PLAN/VALIDATE/DRY_RUN)
		if (
			this.cliOptions.mode === "EXECUTE" ||
			this.cliOptions.mode === "RESUME"
		) {
			await this.acquireLock(editionContext);
		}

		try {
			// Create or load manifest
			if (
				this.cliOptions.mode === "RESUME" &&
				this.cliOptions.resumeFrom
			) {
				this.manifest = await this.loadManifest(
					editionContext.editionId,
					this.cliOptions.resumeFrom,
				);
				if (!this.manifest) {
					throw new Error(
						`No manifest found to resume for edition ${editionContext.editionId}`,
					);
				}
				console.log(
					`Resuming from manifest ${this.manifest.manifestId}`,
				);
			} else {
				await this.createManifest(editionContext);
			}

			// Execute stages in topological order
			const stagesToRun = this.getStagesToRun();

			for (const stageDef of stagesToRun) {
				// Check if stage should be skipped
				if (this.cliOptions.skipStages.includes(stageDef.stageId)) {
					console.log(
						`Skipping stage ${stageDef.name} (--skip-stages)`,
					);
					const record = this.manifest!.stages.find(
						(s) => s.stageId === stageDef.stageId,
					)!;
					record.state = "SKIPPED";
					await this.persistManifest();
					continue;
				}

				if (
					this.cliOptions.onlyStages.length > 0 &&
					!this.cliOptions.onlyStages.includes(stageDef.stageId)
				) {
					continue;
				}

				// Check if already complete
				const record = this.manifest!.stages.find(
					(s) => s.stageId === stageDef.stageId,
				)!;
				if (
					record.state === "SUCCEEDED" &&
					this.cliOptions.mode !== "RESUME"
				) {
					console.log(
						`Stage ${stageDef.name} already complete, skipping`,
					);
					continue;
				}

				// Execute stage
				await this.executeStage(stageDef);
			}

			// Finalize
			this.manifest!.completedAt = nowISO();
			this.manifest!.overallOutcome = this.computeOverallOutcome();
			await this.persistManifest();

			// Generate report
			const report = await this.generateReport();
			await this.persistReport(report);

			return report;
		} finally {
			// Release lock
			if (this.lock) {
				await this.releaseLock(
					this.manifest?.overallOutcome === "SUCCESS"
						? "FREE"
						: "STALE",
				);
			}
		}
	}

	private getDefaultEditionDate(): string {
		// Default to tomorrow's edition (reported at 07:00 for previous day 05:00-05:00)
		const now = Temporal.Now.zonedDateTimeISO(EDITORIAL_TIMEZONE);
		const editionDate =
			now.hour >= 5
				? now.toPlainDate()
				: now.subtract({ days: 1 }).toPlainDate();
		return editionDate.toString();
	}

	private createEditionContext(editionDate: string): EditionContext {
		const window = getEditorialWindow(editionDate);
		const editionId = `edition_${editionDate}`;

		return {
			editionId,
			editionDate,
			timezone: EDITORIAL_TIMEZONE,
			reportingWindow: {
				start: window.start,
				end: window.end,
				startZoned: window.startZoned.toString(),
				endZoned: window.endZoned.toString(),
				durationHours: window.durationHours,
			},
			windowResolvedAt: nowISO(),
			scheduledExecutionTime: Temporal.PlainDate.from(editionDate)
				.toPlainDateTime({ hour: 7, minute: 0 })
				.toZonedDateTime(EDITORIAL_TIMEZONE)
				.toString(),
		};
	}

	private getStagesToRun(): StageDefinition[] {
		const mode = this.cliOptions.mode;

		if (mode === "PLAN" || mode === "VALIDATE") {
			// Return all stages for inspection
			return ALL_STAGES;
		}

		if (mode === "DRY_RUN") {
			return ALL_STAGES;
		}

		if (mode === "RESUME") {
			// Only run incomplete/failed stages
			if (!this.manifest) return ALL_STAGES;
			const incompleteIds = this.manifest.stages
				.filter((s) =>
					[
						"PENDING",
						"READY",
						"RUNNING",
						"FAILED",
						"BLOCKED",
						"INCOMPLETE",
					].includes(s.state),
				)
				.map((s) => s.stageId);
			return ALL_STAGES.filter((s) => incompleteIds.includes(s.stageId));
		}

		// EXECUTE mode
		return ALL_STAGES;
	}

	private computeOverallOutcome(): WorkflowRunOutcome {
		if (!this.manifest) return "FAILED";

		const states = this.manifest.stages.map((s) => s.state);
		const hasFailed = states.includes("FAILED");
		const hasBlocked = states.includes("BLOCKED");
		const hasIncomplete = states.includes("INCOMPLETE");
		const allSucceeded = states.every(
			(s) => s === "SUCCEEDED" || s === "SKIPPED",
		);

		if (this.cliOptions.mode === "PLAN") return "PLAN_ONLY";
		if (this.cliOptions.mode === "VALIDATE") return "VALIDATION_ONLY";
		if (this.cliOptions.mode === "DRY_RUN") return "DRY_RUN_COMPLETE";

		if (hasFailed) return "FAILED";
		if (hasBlocked) return "BLOCKED";
		if (hasIncomplete) return "PARTIAL_SUCCESS";
		if (allSucceeded) return "SUCCESS";

		return "INCOMPLETE";
	}

	// ============================================================================
	// Reporting
	// ============================================================================

	async generateReport(): Promise<WorkflowReport> {
		if (!this.manifest) throw new Error("No manifest to report on");

		const report: WorkflowReport = {
			reportId: generateId("rpt_"),
			manifestId: this.manifest.manifestId,
			editionId: this.manifest.edition.editionId,
			editionDate: this.manifest.edition.editionDate,
			executionMode: this.manifest.executionMode,
			workflowGraphVersion: this.manifest.workflowGraphVersion,
			contractVersion: this.manifest.contractVersion,
			startedAt: this.manifest.requestedAt,
			completedAt: this.manifest.completedAt,
			totalDurationMs: this.manifest.completedAt
				? Date.parse(this.manifest.completedAt) -
					Date.parse(this.manifest.requestedAt)
				: undefined,

			overallStatus: this.manifest.overallOutcome,
			stagesExecuted: this.manifest.stages.filter(
				(s) => s.state !== "PENDING",
			).length,
			stagesSucceeded: this.manifest.stages.filter(
				(s) => s.state === "SUCCEEDED",
			).length,
			stagesFailed: this.manifest.stages.filter(
				(s) => s.state === "FAILED",
			).length,
			stagesBlocked: this.manifest.stages.filter(
				(s) => s.state === "BLOCKED",
			).length,
			stagesSkipped: this.manifest.stages.filter(
				(s) => s.state === "SKIPPED",
			).length,
			stagesIncomplete: this.manifest.stages.filter(
				(s) => s.state === "INCOMPLETE",
			).length,

			// Aggregate metrics from stage records
			resources: this.aggregateResources(),
			retries: this.aggregateRetries(),
			evidenceClassification: this.classifyEvidence(),
			checkpointInfo: this.summarizeCheckpoints(),
			unresolvedDefects: this.collectUnresolvedDefects(),
			blockingFailures: this.collectBlockingFailures(),

			// Phase-specific summaries (would be populated from actual stage outputs)
			discoveryCoverage: undefined,
			temporalEligibility: undefined,
			verification: undefined,
			omissionReview: undefined,
			historicalRegression: undefined,
			editorialSelection: undefined,
			publication: undefined,
			qualityEvaluation: undefined,
			knowledgeContinuity: undefined,
		};

		return report;
	}

	private aggregateResources(): WorkflowReport["resources"] {
		if (!this.manifest) {
			return {
				modelRequests: 0,
				tokensUsed: 0,
				sourceRequests: 0,
				totalCpuMs: 0,
				peakMemoryMb: 0,
				fallbackCount: 0,
				providersExhausted: false,
			};
		}

		return this.manifest.stages.reduce(
			(acc, s) => ({
				modelRequests:
					acc.modelRequests + s.resourcesUsed.modelRequests,
				tokensUsed: acc.tokensUsed + s.resourcesUsed.tokensUsed,
				sourceRequests:
					acc.sourceRequests + s.resourcesUsed.sourceRequests,
				totalCpuMs: acc.totalCpuMs + s.resourcesUsed.cpuMs,
				peakMemoryMb: Math.max(
					acc.peakMemoryMb,
					s.resourcesUsed.memoryPeakMb,
				),
				fallbackCount: acc.fallbackCount, // Would track from LLM client
				providersExhausted: acc.providersExhausted,
			}),
			{
				modelRequests: 0,
				tokensUsed: 0,
				sourceRequests: 0,
				totalCpuMs: 0,
				peakMemoryMb: 0,
				fallbackCount: 0,
				providersExhausted: false,
			},
		);
	}

	private aggregateRetries(): WorkflowReport["retries"] {
		if (!this.manifest) {
			return {
				totalAttempts: 0,
				successfulRetries: 0,
				failedRetries: 0,
				byCategory: {},
			};
		}

		let totalAttempts = 0;
		let successfulRetries = 0;
		let failedRetries = 0;
		const byCategory: Record<string, number> = {};

		for (const stage of this.manifest.stages) {
			if (stage.attempt > 1) {
				totalAttempts += stage.attempt - 1;
				if (stage.state === "SUCCEEDED")
					successfulRetries += stage.attempt - 1;
				else failedRetries += stage.attempt - 1;
			}
			if (stage.error) {
				byCategory[stage.error.category] =
					(byCategory[stage.error.category] || 0) + 1;
			}
		}

		return { totalAttempts, successfulRetries, failedRetries, byCategory };
	}

	private classifyEvidence(): WorkflowReport["evidenceClassification"] {
		// This would be populated from actual evaluation results
		return {
			executed: 0,
			validated: 0,
			modelAssessed: 0,
			independentlyVerified: 0,
			unverified: 0,
			notExecuted: 0,
		};
	}

	private summarizeCheckpoints(): WorkflowReport["checkpointInfo"] {
		if (!this.manifest) {
			return {
				checkpointsCreated: 0,
				checkpointsValid: 0,
				resumePossible: false,
			};
		}

		const validCheckpoints = this.manifest.checkpoints.filter(
			(c) => c.valid,
		).length;
		const lastValid = this.manifest.checkpoints
			.filter((c) => c.valid)
			.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];

		return {
			checkpointsCreated: this.manifest.checkpoints.length,
			checkpointsValid: validCheckpoints,
			resumePossible: validCheckpoints > 0,
			lastValidCheckpoint: lastValid?.checkpointId,
		};
	}

	private collectUnresolvedDefects(): WorkflowReport["unresolvedDefects"] {
		if (!this.manifest) return [];

		return this.manifest.stages
			.filter(
				(s) =>
					s.state === "FAILED" ||
					s.state === "INCOMPLETE" ||
					s.state === "BLOCKED",
			)
			.map((s) => ({
				stageId: s.stageId,
				description:
					s.error?.message || "Stage did not complete successfully",
				severity:
					s.state === "FAILED"
						? "CRITICAL"
						: s.state === "BLOCKED"
							? "MAJOR"
							: "MINOR",
				blocking: s.state !== "INCOMPLETE",
			}));
	}

	private collectBlockingFailures(): WorkflowReport["blockingFailures"] {
		if (!this.manifest) return [];

		return this.manifest.errors
			.filter((e) => e.recoverable === false)
			.map((e) => ({
				stageId: e.stageId || "unknown",
				category: e.category,
				message: e.message,
			}));
	}

	async persistReport(report: WorkflowReport): Promise<void> {
		const reportPath = path.join(
			this.reportDir,
			`${report.editionId}_${report.reportId.slice(0, 8)}.json`,
		);
		await fs.writeFile(
			reportPath,
			JSON.stringify(report, null, 2),
			"utf-8",
		);
		console.log(`Report persisted: ${reportPath}`);
	}

	// ============================================================================
	// Cleanup
	// ============================================================================

	async shutdown(): Promise<void> {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
		}
		if (this.llmClient) {
			// LLM client doesn't need explicit shutdown
		}
		if (this.manifest && !this.manifest.completedAt) {
			await this.persistManifest();
		}
	}
}

// ============================================================================
// Factory Function
// ============================================================================

export async function createWorkflowOrchestrator(
	cliOptions: CliOptions,
): Promise<WorkflowOrchestrator> {
	const orchestrator = new WorkflowOrchestrator(cliOptions);
	await orchestrator.initialize();
	return orchestrator;
}
