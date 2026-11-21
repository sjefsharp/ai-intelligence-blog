/**
 * Scheduler Configuration Schema
 *
 * Defines the configuration for the AI Daily Intelligence daily scheduler.
 * This schema is versioned and used for validation of scheduler configuration.
 */

import { z } from "astro/zod";

// ============================================================================
// Constants
// ============================================================================

export const SCHEDULER_CONFIG_VERSION = "1.0.0";
export const SCHEDULER_ID = "ai-intelligence-daily-edition";

// ============================================================================
// Enumerations
// ============================================================================

export const SchedulerStateSchema = z.enum([
	"DISABLED", // Schedule exists but not enabled
	"ENABLED", // Schedule active and will execute
	"PAUSED", // Temporarily paused
	"ERROR", // Configuration error
]);

export const ExecutionModeSchema = z.enum([
	"PLAN",
	"VALIDATE",
	"DRY_RUN",
	"RESUME",
	"EXECUTE",
]);

export const AuthorizationStateSchema = z.enum([
	"NOT_GRANTED",
	"GRANTED",
	"REVOKED",
]);

// ============================================================================
// Configuration Objects
// ============================================================================

export const ScheduleExpressionSchema = z.strictObject({
	/** IANA timezone identifier */
	timezone: z.literal("Europe/Amsterdam"),
	/** Hour (0-23) in the timezone */
	hour: z.number().int().min(0).max(23),
	/** Minute (0-59) */
	minute: z.number().int().min(0).max(59),
	/** Second (0-59) */
	second: z.number().int().min(0).max(59).default(0),
	/** Calendar day frequency */
	frequency: z.literal("daily"),
});

export const ReportingWindowSchema = z.strictObject({
	/** Start boundary: previous calendar day at window hour (inclusive) */
	startOffsetDays: z.literal(-1),
	/** End boundary: edition date at window hour (exclusive) */
	endOffsetDays: z.literal(0),
	/** Window hour in editorial timezone */
	windowHour: z.number().int().min(0).max(23),
	/** Timezone for window boundaries */
	timezone: z.literal("Europe/Amsterdam"),
});

export const ResourcePolicySchema = z.strictObject({
	/** Maximum total workflow duration in milliseconds */
	maxTotalDurationMs: z.number().int().positive(),
	/** Maximum model requests per workflow */
	maxModelRequests: z.number().int().positive(),
	/** Maximum tokens per workflow */
	maxTokens: z.number().int().positive(),
	/** Maximum concurrent model calls */
	maxConcurrentModelCalls: z.number().int().positive().default(1),
	/** Free-only inference enforcement */
	freeOnlyInference: z.literal(true),
	/** Maximum cost in USD (always 0) */
	maxCostUsd: z.literal(0),
});

export const ConcurrencyPolicySchema = z.strictObject({
	/** Maximum concurrent executions per edition */
	maxPerEdition: z.literal(1),
	/** Lock TTL in hours */
	lockTtlHours: z.number().int().positive().default(24),
	/** Heartbeat interval in seconds */
	heartbeatIntervalSeconds: z.number().int().positive().default(30),
	/** Action on conflict */
	conflictAction: z.enum(["BLOCK", "QUEUE", "OVERRIDE"]).default("BLOCK"),
});

export const FailurePolicySchema = z.strictObject({
	/** Maximum retries for the entire workflow */
	maxWorkflowRetries: z.number().int().nonnegative().default(0),
	/** Stage-level retries are handled by orchestrator */
	useOrchestratorRetries: z.literal(true),
	/** Preserve checkpoints on failure */
	preserveCheckpoints: z.literal(true),
	/** Graceful degradation on free inference exhaustion */
	gracefulDegradation: z.literal(true),
	/** Never switch to paid providers */
	noPaidFallback: z.literal(true),
});

export const MissedRunPolicySchema = z.strictObject({
	/** Automatically backfill missed editions */
	autoBackfill: z.literal(false),
	/** Maximum editions to backfill if enabled */
	maxBackfillEditions: z.number().int().nonnegative().default(0),
	/** Record missed executions */
	recordMissed: z.literal(true),
	/** Alert on missed execution */
	alertOnMissed: z.literal(false),
});

export const ActivationGuardSchema = z.strictObject({
	/** Scheduler explicitly enabled */
	schedulerEnabled: z.boolean().default(false),
	/** Publication authorization granted */
	publicationAuthorized: z.boolean().default(false),
	/** Deployment authorization granted */
	deploymentAuthorized: z.boolean().default(false),
	/** Required environment variables */
	requiredEnvVars: z
		.array(z.string())
		.default([
			"EDITION_SCHEDULER_ENABLED",
			"EDITION_PUBLICATION_AUTHORIZED",
			"EDITION_DEPLOYMENT_AUTHORIZED",
		]),
	/** Fail closed if any check fails */
	failClosed: z.literal(true),
});

export const LoggingConfigSchema = z.strictObject({
	/** Log directory */
	logDirectory: z.string().default("data/scheduler/logs"),
	/** Log retention days */
	retentionDays: z.number().int().positive().default(30),
	/** Structured JSON logging */
	jsonFormat: z.boolean().default(true),
	/** Log level */
	level: z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).default("INFO"),
	/** Include correlation ID */
	correlationId: z.boolean().default(true),
});

export const NotificationConfigSchema = z.strictObject({
	/** Notification mechanisms available */
	mechanisms: z
		.array(z.enum(["journal", "file", "webhook", "email"]))
		.default(["journal", "file"]),
	/** Notify on workflow failure */
	onFailure: z.boolean().default(true),
	/** Notify on mandatory source coverage incomplete */
	onCoverageIncomplete: z.boolean().default(true),
	/** Notify on free inference exhausted */
	onInferenceExhausted: z.boolean().default(true),
	/** Notify on acceptance blocked */
	onAcceptanceBlocked: z.boolean().default(true),
	/** Notify on persistent storage failure */
	onStorageFailure: z.boolean().default(true),
	/** Notify on repeated execution failure */
	onRepeatedFailure: z.boolean().default(true),
	/** Webhook URL (if webhook mechanism enabled) */
	webhookUrl: z.string().url().optional(),
});

// ============================================================================
// Main Configuration Schema
// ============================================================================

export const SchedulerConfigSchema = z.strictObject({
	/** Configuration schema version */
	schemaVersion: z.literal(SCHEDULER_CONFIG_VERSION),
	/** Stable scheduler identifier */
	schedulerId: z.literal(SCHEDULER_ID),
	/** Human-readable purpose */
	purpose: z.string().default("AI Daily Intelligence generation"),
	/** Scheduling mechanism */
	mechanism: z.literal("systemd-user-timer"),
	/** Schedule expression */
	schedule: ScheduleExpressionSchema,
	/** Reporting window definition */
	reportingWindow: ReportingWindowSchema,
	/** Workflow entry point */
	workflowEntryPoint: z.strictObject({
		script: z.string().default("scripts/run-workflow.ts"),
		acceptanceScript: z.string().default("scripts/run-acceptance.ts"),
		defaultMode: ExecutionModeSchema.default("VALIDATE"),
		supportedModes: z
			.array(ExecutionModeSchema)
			.default(["PLAN", "VALIDATE", "DRY_RUN", "RESUME", "EXECUTE"]),
	}),
	/** Working directory */
	workingDirectory: z.string(),
	/** Execution user/context */
	executionContext: z.strictObject({
		user: z.string(),
		environmentFile: z.string().optional(),
	}),
	/** Environment configuration reference */
	environment: z.strictObject({
		configFile: z.string().default(".env.local"),
		requiredVars: z
			.array(z.string())
			.default(["OPENROUTER_API_KEY", "GROQ_API_KEY"]),
		timezone: z.literal("Europe/Amsterdam"),
	}),
	/** Resource policy */
	resourcePolicy: ResourcePolicySchema,
	/** Concurrency policy */
	concurrencyPolicy: ConcurrencyPolicySchema,
	/** Failure policy */
	failurePolicy: FailurePolicySchema,
	/** Missed run policy */
	missedRunPolicy: MissedRunPolicySchema,
	/** Activation guard */
	activationGuard: ActivationGuardSchema,
	/** Logging configuration */
	logging: LoggingConfigSchema,
	/** Notification configuration */
	notifications: NotificationConfigSchema,
	/** Deployment authorization state */
	deploymentAuthorization: AuthorizationStateSchema.default("NOT_GRANTED"),
	/** Production publication authorization state */
	publicationAuthorization: AuthorizationStateSchema.default("NOT_GRANTED"),
	/** Current scheduler state */
	state: SchedulerStateSchema.default("DISABLED"),
	/** Configuration last modified */
	lastModified: z.string().optional(),
	/** Configuration modified by */
	modifiedBy: z.string().optional(),
});

// ============================================================================
// Inferred Types
// ============================================================================

export type ScheduleExpression = z.infer<typeof ScheduleExpressionSchema>;
export type ReportingWindow = z.infer<typeof ReportingWindowSchema>;
export type ResourcePolicy = z.infer<typeof ResourcePolicySchema>;
export type ConcurrencyPolicy = z.infer<typeof ConcurrencyPolicySchema>;
export type FailurePolicy = z.infer<typeof FailurePolicySchema>;
export type MissedRunPolicy = z.infer<typeof MissedRunPolicySchema>;
export type ActivationGuard = z.infer<typeof ActivationGuardSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type NotificationConfig = z.infer<typeof NotificationConfigSchema>;
export type SchedulerConfig = z.infer<typeof SchedulerConfigSchema>;
export type SchedulerState = z.infer<typeof SchedulerStateSchema>;
export type AuthorizationState = z.infer<typeof AuthorizationStateSchema>;

// ============================================================================
// Default Configuration
// ============================================================================

export function createDefaultSchedulerConfig(
	workingDir: string,
): SchedulerConfig {
	return {
		schemaVersion: SCHEDULER_CONFIG_VERSION,
		schedulerId: SCHEDULER_ID,
		purpose: "AI Daily Intelligence generation",
		mechanism: "systemd-user-timer",
		schedule: {
			timezone: "Europe/Amsterdam",
			hour: 5,
			minute: 0,
			second: 0,
			frequency: "daily",
		},
		reportingWindow: {
			startOffsetDays: -1,
			endOffsetDays: 0,
			windowHour: 5,
			timezone: "Europe/Amsterdam",
		},
		workflowEntryPoint: {
			script: "scripts/run-workflow.ts",
			acceptanceScript: "scripts/run-acceptance.ts",
			defaultMode: "VALIDATE",
			supportedModes: [
				"PLAN",
				"VALIDATE",
				"DRY_RUN",
				"RESUME",
				"EXECUTE",
			],
		},
		workingDirectory: workingDir,
		executionContext: {
			user: process.env.USER || "unknown",
		},
		environment: {
			configFile: ".env.local",
			requiredVars: ["OPENROUTER_API_KEY", "GROQ_API_KEY"],
			timezone: "Europe/Amsterdam",
		},
		resourcePolicy: {
			maxTotalDurationMs: 7200000, // 2 hours
			maxModelRequests: 1000,
			maxTokens: 500000,
			maxConcurrentModelCalls: 1,
			freeOnlyInference: true,
			maxCostUsd: 0,
		},
		concurrencyPolicy: {
			maxPerEdition: 1,
			lockTtlHours: 24,
			heartbeatIntervalSeconds: 30,
			conflictAction: "BLOCK",
		},
		failurePolicy: {
			maxWorkflowRetries: 0,
			useOrchestratorRetries: true,
			preserveCheckpoints: true,
			gracefulDegradation: true,
			noPaidFallback: true,
		},
		missedRunPolicy: {
			autoBackfill: false,
			maxBackfillEditions: 0,
			recordMissed: true,
			alertOnMissed: false,
		},
		activationGuard: {
			schedulerEnabled: false,
			publicationAuthorized: false,
			deploymentAuthorized: false,
			requiredEnvVars: [
				"EDITION_SCHEDULER_ENABLED",
				"EDITION_PUBLICATION_AUTHORIZED",
				"EDITION_DEPLOYMENT_AUTHORIZED",
			],
			failClosed: true,
		},
		logging: {
			logDirectory: "data/scheduler/logs",
			retentionDays: 30,
			jsonFormat: true,
			level: "INFO",
			correlationId: true,
		},
		notifications: {
			mechanisms: ["journal", "file"],
			onFailure: true,
			onCoverageIncomplete: true,
			onInferenceExhausted: true,
			onAcceptanceBlocked: true,
			onStorageFailure: true,
			onRepeatedFailure: true,
		},
		deploymentAuthorization: "NOT_GRANTED",
		publicationAuthorization: "NOT_GRANTED",
		state: "DISABLED",
	};
}

// ============================================================================
// Validation
// ============================================================================

export function validateSchedulerConfig(config: unknown): {
	valid: boolean;
	errors: string[];
	config?: SchedulerConfig;
} {
	const result = SchedulerConfigSchema.safeParse(config);
	if (result.success) {
		return { valid: true, errors: [], config: result.data };
	}
	return {
		valid: false,
		errors: result.error.issues.map(
			(e) => `${e.path.join(".")}: ${e.message}`,
		),
	};
}
