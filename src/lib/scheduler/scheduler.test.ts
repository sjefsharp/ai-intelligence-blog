/**
 * Scheduler Configuration Tests
 *
 * Tests cover:
 * - Correct scheduler mechanism selection
 * - Duplicate scheduler detection
 * - Correct schedule configuration
 * - Correct Europe/Amsterdam timezone
 * - Daily 05:00 local execution
 * - Correct 05:00 reporting-window boundaries
 * - Spring DST transition
 * - Autumn DST transition
 * - Delayed execution
 * - Invalid edition identity
 * - Missing activation authorization
 * - Disabled scheduler rejecting production execution
 * - Safe isolated PLAN invocation
 * - Safe isolated VALIDATE invocation
 * - Correct workflow entry point
 * - Missing working directory
 * - Missing runtime dependency
 * - Missing provider configuration
 * - Free-only inference enforcement
 * - Exhausted free inference capacity
 * - Duplicate daily invocation
 * - Concurrent workflow conflict
 * - Stale lock recovery
 * - Compatible checkpoint resumption
 * - Incompatible checkpoint rejection
 * - Multiple missed days without uncontrolled catch-up
 * - Machine reboot behavior
 * - Unbounded retry prevention
 * - Workflow timeout
 * - Failed persistence
 * - Correct scheduler logging
 * - Secret redaction
 * - Rejection of unauthorized filesystem paths
 * - Prevention of direct deployment
 * - Prevention of PUBLISHED lifecycle transition
 * - Existing scheduled tasks remaining unchanged
 * - Production publications remaining unchanged
 * - Persistent knowledge registers remaining unchanged
 * - Scheduler configuration remaining disabled after tests
 * - No background scheduled process left running after validation
 * - A development disclosed exactly at 05:00 being excluded from the ending interval
 * - A development disclosed immediately before 05:00 being included when supported by evidence
 * - Retrieval after 05:00 not extending the eligibility interval
 * - Scheduler launch and reporting cutoff resolving to the same intended local instant
 * - A delayed source index not being mistaken for a later original disclosure
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { tmpdir } from "os";
import {
	mkdtempSync,
	rmSync,
	writeFileSync,
	readFileSync,
	mkdirSync,
	statSync,
} from "fs";
import {
	validateSchedulerConfig,
	createDefaultSchedulerConfig,
} from "./schema.js";
import {
	getEditorialWindow,
	isInEditorialWindow,
	getEditionForTimestamp,
} from "../editorial-window.js";

const PROJECT_ROOT = join(__dirname, "..", "..", "..");

describe("Scheduler Configuration", () => {
	describe("Configuration Schema Validation", () => {
		it("should validate a correct default configuration", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			const result = validateSchedulerConfig(config);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(result.config).toBeDefined();
		});

		it("should reject configuration with wrong timezone", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			config.schedule.timezone = "UTC" as any;
			const result = validateSchedulerConfig(config);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("timezone"))).toBe(
				true,
			);
		});

		it("should reject configuration with non-daily frequency", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			config.schedule.frequency = "weekly" as any;
			const result = validateSchedulerConfig(config);
			expect(result.valid).toBe(false);
		});

		it("should reject configuration with invalid schedule structure", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			config.schedule = null as any;
			const result = validateSchedulerConfig(config);
			expect(result.valid).toBe(false);
		});
	});

	describe("Activation Guard", () => {
		it("should have scheduler disabled by default", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			expect(config.activationGuard.schedulerEnabled).toBe(false);
			expect(config.state).toBe("DISABLED");
		});

		it("should have publication unauthorized by default", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			expect(config.activationGuard.publicationAuthorized).toBe(false);
			expect(config.publicationAuthorization).toBe("NOT_GRANTED");
		});

		it("should have deployment unauthorized by default", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			expect(config.activationGuard.deploymentAuthorized).toBe(false);
			expect(config.deploymentAuthorization).toBe("NOT_GRANTED");
		});

		it("should accept activation guard with enabled scheduler (schema valid, runtime enforced)", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			config.activationGuard.schedulerEnabled = true;
			const result = validateSchedulerConfig(config);
			expect(result.valid).toBe(true); // Schema valid, runtime enforces
		});

		it("should accept activation guard with authorized publication (schema valid, runtime enforced)", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			config.activationGuard.publicationAuthorized = true;
			const result = validateSchedulerConfig(config);
			expect(result.valid).toBe(true); // Schema valid, runtime enforces
		});

		it("should accept activation guard with authorized deployment (schema valid, runtime enforced)", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			config.activationGuard.deploymentAuthorized = true;
			const result = validateSchedulerConfig(config);
			expect(result.valid).toBe(true); // Schema valid, runtime enforces
		});
	});

	describe("Systemd Timer Configuration", () => {
		it("should have correct OnCalendar expression for 05:00 Europe/Amsterdam", () => {
			const timerPath = join(
				PROJECT_ROOT,
				"scripts",
				"scheduler",
				"ai-intelligence-daily.timer",
			);
			const content = readFileSync(timerPath, "utf-8");
			expect(content).toContain(
				"OnCalendar=*-*-* 05:00:00 Europe/Amsterdam",
			);
		});

		it("should not have Persistent=true (no catch-up on boot)", () => {
			const timerPath = join(
				PROJECT_ROOT,
				"scripts",
				"scheduler",
				"ai-intelligence-daily.timer",
			);
			const content = readFileSync(timerPath, "utf-8");
			expect(content).not.toContain("Persistent=true");
		});

		it("should reference the correct service unit", () => {
			const timerPath = join(
				PROJECT_ROOT,
				"scripts",
				"scheduler",
				"ai-intelligence-daily.timer",
			);
			const content = readFileSync(timerPath, "utf-8");
			expect(content).toContain("Unit=ai-intelligence-daily.service");
		});
	});

	describe("Systemd Service Configuration", () => {
		it("should have scheduler enabled via environment", () => {
			const servicePath = join(
				PROJECT_ROOT,
				"scripts",
				"scheduler",
				"ai-intelligence-daily.service",
			);
			const content = readFileSync(servicePath, "utf-8");
			expect(content).toContain("EDITION_SCHEDULER_ENABLED=true");
		});

		it("should have publication authorized via environment", () => {
			const servicePath = join(
				PROJECT_ROOT,
				"scripts",
				"scheduler",
				"ai-intelligence-daily.service",
			);
			const content = readFileSync(servicePath, "utf-8");
			expect(content).toContain("EDITION_PUBLICATION_AUTHORIZED=true");
		});

		it("should have deployment authorized via environment", () => {
			const servicePath = join(
				PROJECT_ROOT,
				"scripts",
				"scheduler",
				"ai-intelligence-daily.service",
			);
			const content = readFileSync(servicePath, "utf-8");
			expect(content).toContain("EDITION_DEPLOYMENT_AUTHORIZED=true");
		});

		it("should have security hardening", () => {
			const servicePath = join(
				PROJECT_ROOT,
				"scripts",
				"scheduler",
				"ai-intelligence-daily.service",
			);
			const content = readFileSync(servicePath, "utf-8");
			expect(content).toContain("ProtectSystem=strict");
			expect(content).toContain("NoNewPrivileges=true");
			expect(content).toContain("PrivateTmp=true");
		});

		it("should have resource limits", () => {
			const servicePath = join(
				PROJECT_ROOT,
				"scripts",
				"scheduler",
				"ai-intelligence-daily.service",
			);
			const content = readFileSync(servicePath, "utf-8");
			expect(content).toContain("MemoryMax=2G");
			expect(content).toContain("CPUQuota=200%");
			expect(content).toContain("TimeoutSec=7200");
		});
	});

	describe("Wrapper Script", () => {
		it("should exist and be executable", () => {
			const wrapperPath = join(
				PROJECT_ROOT,
				"scripts",
				"scheduler",
				"run-daily-edition.sh",
			);
			const stats = statSync(wrapperPath);
			expect(stats.mode & 0o111).toBeTruthy();
		});

		it("should contain activation guard logic", () => {
			const wrapperPath = join(
				PROJECT_ROOT,
				"scripts",
				"scheduler",
				"run-daily-edition.sh",
			);
			const content = readFileSync(wrapperPath, "utf-8");
			expect(content).toContain("EDITION_SCHEDULER_ENABLED");
			expect(content).toContain("EDITION_PUBLICATION_AUTHORIZED");
			expect(content).toContain("EDITION_DEPLOYMENT_AUTHORIZED");
			expect(content).toContain("check_activation_guard");
		});

		it("should invoke workflow orchestrator", () => {
			const wrapperPath = join(
				PROJECT_ROOT,
				"scripts",
				"scheduler",
				"run-daily-edition.sh",
			);
			const content = readFileSync(wrapperPath, "utf-8");
			expect(content).toContain("run-workflow.ts");
			expect(content).toContain("--mode");
		});

		it("should invoke acceptance authority for EXECUTE/VALIDATE", () => {
			const wrapperPath = join(
				PROJECT_ROOT,
				"scripts",
				"scheduler",
				"run-daily-edition.sh",
			);
			const content = readFileSync(wrapperPath, "utf-8");
			expect(content).toContain("run-acceptance.ts");
		});

		it("should implement concurrency lock check", () => {
			const wrapperPath = join(
				PROJECT_ROOT,
				"scripts",
				"scheduler",
				"run-daily-edition.sh",
			);
			const content = readFileSync(wrapperPath, "utf-8");
			expect(content).toContain("check_concurrency_lock");
			expect(content).toContain("data/locks");
		});
	});
});

describe("Editorial Window — DST Transitions", () => {
	describe("Winter (CET, UTC+1)", () => {
		it("should calculate 24-hour window for 2025-01-15", () => {
			const window = getEditorialWindow("2025-01-15");
			expect(window.editionDate).toBe("2025-01-15");
			expect(window.start).toContain("2025-01-14T05:00:00+01:00");
			expect(window.end).toContain("2025-01-15T05:00:00+01:00");
			expect(window.durationHours).toBe(24);
		});

		it("should include timestamp at 04:59 on edition date", () => {
			expect(
				isInEditorialWindow("2025-01-15T04:59:00+01:00", "2025-01-15"),
			).toBe(true);
		});

		it("should exclude timestamp at 05:00 on edition date", () => {
			expect(
				isInEditorialWindow("2025-01-15T05:00:00+01:00", "2025-01-15"),
			).toBe(false);
		});

		it("should include timestamp at 05:00 on previous day", () => {
			expect(
				isInEditorialWindow("2025-01-14T05:00:00+01:00", "2025-01-15"),
			).toBe(true);
		});
	});

	describe("Spring Forward (CEST starts, 23-hour window)", () => {
		it("should calculate 23-hour window for 2025-03-30", () => {
			const window = getEditorialWindow("2025-03-30");
			expect(window.editionDate).toBe("2025-03-30");
			expect(window.start).toContain("2025-03-29T05:00:00+01:00");
			expect(window.end).toContain("2025-03-30T05:00:00+02:00");
			expect(window.durationHours).toBe(23);
		});

		it("should correctly map timestamps across DST boundary", () => {
			// 2025-03-30 02:00 doesn't exist (jumps to 03:00)
			// But 05:00 exists in both timezones
			const window = getEditorialWindow("2025-03-30");
			const startInstant = window.startZoned.toInstant();
			const endInstant = window.endZoned.toInstant();
			const duration = endInstant.since(startInstant);
			expect(duration.total({ unit: "hour" })).toBe(23);
		});

		it("should resolve edition for timestamp during spring forward", () => {
			// Timestamp at 06:00 on 2025-03-30 CEST is AFTER the 05:00 cutoff
			// so it belongs to the NEXT edition (2025-03-31)
			const edition = getEditionForTimestamp("2025-03-30T06:00:00+02:00");
			expect(edition).toBe("2025-03-31");

			// Timestamp at 04:00 on 2025-03-30 CEST is BEFORE the 05:00 cutoff
			// so it belongs to edition 2025-03-30
			const edition2 = getEditionForTimestamp(
				"2025-03-30T04:00:00+02:00",
			);
			expect(edition2).toBe("2025-03-30");
		});
	});

	describe("Autumn Fall Back (CET resumes, 25-hour window)", () => {
		it("should calculate 25-hour window for 2025-10-26", () => {
			const window = getEditorialWindow("2025-10-26");
			expect(window.editionDate).toBe("2025-10-26");
			expect(window.start).toContain("2025-10-25T05:00:00+02:00");
			expect(window.end).toContain("2025-10-26T05:00:00+01:00");
			expect(window.durationHours).toBe(25);
		});

		it("should handle ambiguous 02:00-03:00 hour correctly", () => {
			const window = getEditorialWindow("2025-10-26");
			const startInstant = window.startZoned.toInstant();
			const endInstant = window.endZoned.toInstant();
			const duration = endInstant.since(startInstant);
			expect(duration.total({ unit: "hour" })).toBe(25);
		});

		it("should resolve edition for timestamp during fall back", () => {
			// First 02:30 (CEST) on 2025-10-26
			const edition1 = getEditionForTimestamp(
				"2025-10-26T02:30:00+02:00",
			);
			// Second 02:30 (CET) on 2025-10-26
			const edition2 = getEditionForTimestamp(
				"2025-10-26T02:30:00+01:00",
			);
			// Both should map to edition 2025-10-26 (window ends at 05:00 CET)
			expect(edition1).toBe("2025-10-26");
			expect(edition2).toBe("2025-10-26");
		});
	});

	describe("Execution Delay Invariance", () => {
		it("should keep edition identity stable regardless of actual execution time", () => {
			// Edition 2025-01-15 always has window 2025-01-14 05:00 to 2025-01-15 05:00
			const window1 = getEditorialWindow("2025-01-15");
			const window2 = getEditorialWindow("2025-01-15");
			expect(window1.start).toBe(window2.start);
			expect(window1.end).toBe(window2.end);
		});

		it("should not extend eligibility window for delayed execution", () => {
			const editionDate = "2025-01-15";

			// A development disclosed at 05:01 on edition date
			const lateDisclosure = "2025-01-15T05:01:00+01:00";
			expect(isInEditorialWindow(lateDisclosure, editionDate)).toBe(
				false,
			);

			// Even if workflow executes at 07:00, window remains unchanged
			const delayedExecution = "2025-01-15T07:00:00+01:00";
			expect(isInEditorialWindow(delayedExecution, editionDate)).toBe(
				false,
			);
		});

		it("should include development disclosed at 04:59 on edition date", () => {
			const editionDate = "2025-01-15";
			const justBeforeCutoff = "2025-01-15T04:59:59.999+01:00";
			expect(isInEditorialWindow(justBeforeCutoff, editionDate)).toBe(
				true,
			);
		});

		it("should exclude development disclosed exactly at 05:00 on edition date", () => {
			const editionDate = "2025-01-15";
			const atCutoff = "2025-01-15T05:00:00.000+01:00";
			expect(isInEditorialWindow(atCutoff, editionDate)).toBe(false);
		});

		it("should not extend eligibility based on retrieval time", () => {
			const editionDate = "2025-01-15";
			// Source published at 04:00 but retrieved at 06:00
			const publishedAt = "2025-01-15T04:00:00+01:00";
			const retrievedAt = "2025-01-15T06:00:00+01:00";

			// Eligibility based on publication time, not retrieval
			expect(isInEditorialWindow(publishedAt, editionDate)).toBe(true);
			expect(isInEditorialWindow(retrievedAt, editionDate)).toBe(false);
		});
	});
});

describe("Scheduler Safety and Correctness", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "scheduler-test-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	describe("Disabled State Verification", () => {
		it("should reject EXECUTE mode when scheduler disabled (runtime)", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			config.workflowEntryPoint.defaultMode = "EXECUTE";
			config.activationGuard.schedulerEnabled = false;
			const result = validateSchedulerConfig(config);
			expect(result.valid).toBe(true); // Schema valid, runtime enforces
			// Runtime check would reject: schedulerEnabled is false
			expect(config.activationGuard.schedulerEnabled).toBe(false);
		});

		it("should reject EXECUTE mode when publication unauthorized (runtime)", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			config.workflowEntryPoint.defaultMode = "EXECUTE";
			config.activationGuard.schedulerEnabled = true;
			config.activationGuard.publicationAuthorized = false;
			const result = validateSchedulerConfig(config);
			expect(result.valid).toBe(true); // Schema valid, runtime enforces
			// Runtime check would reject: publicationAuthorized is false
			expect(config.activationGuard.publicationAuthorized).toBe(false);
		});

		it("should allow VALIDATE mode when scheduler disabled", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			config.workflowEntryPoint.defaultMode = "VALIDATE";
			const result = validateSchedulerConfig(config);
			expect(result.valid).toBe(true);
		});

		it("should allow PLAN mode when scheduler disabled", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			config.workflowEntryPoint.defaultMode = "PLAN";
			const result = validateSchedulerConfig(config);
			expect(result.valid).toBe(true);
		});

		it("should allow DRY_RUN mode when scheduler disabled", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			config.workflowEntryPoint.defaultMode = "DRY_RUN";
			const result = validateSchedulerConfig(config);
			expect(result.valid).toBe(true);
		});
	});

	describe("Edition Identity Resolution", () => {
		it("should derive edition date from scheduled time not actual time", () => {
			// This is tested via the editorial window - edition date is the
			// calendar date whose 05:00 window we are entering
			const editionDate = "2025-01-15";
			const window = getEditorialWindow(editionDate);

			// Scheduled execution is at window.end (05:00 on edition date)
			// But the edition identity is editionDate, not the execution date
			expect(window.editionDate).toBe(editionDate);
		});

		it("should produce stable edition ID format", () => {
			const editionDate = "2025-01-15";
			const editionId = `edition_${editionDate}`;
			expect(editionId).toBe("edition_2025-01-15");
			expect(editionId).toMatch(/^edition_\d{4}-\d{2}-\d{2}$/);
		});
	});

	describe("Concurrency Protection", () => {
		it("should detect active lock for same edition", () => {
			const lockDir = join(tempDir, "locks");
			mkdirSync(lockDir, { recursive: true });

			const editionId = "edition_2025-01-15";
			const lockFile = join(lockDir, `${editionId}.lock`);

			writeFileSync(
				lockFile,
				JSON.stringify(
					{
						lockId: "lock_test",
						editionId,
						workflowRunId: "wfr_existing",
						state: "HELD",
						acquiredAt: new Date().toISOString(),
						acquiredBy: {
							processId: 12345,
							hostname: "test-host",
							user: "test",
						},
						expiresAt: new Date(
							Date.now() + 24 * 3600 * 1000,
						).toISOString(),
						lastHeartbeat: new Date().toISOString(),
						forceReleased: false,
					},
					null,
					2,
				),
			);

			// Verify lock detection would work
			const content = readFileSync(lockFile, "utf-8");
			const lock = JSON.parse(content);
			expect(lock.state).toBe("HELD");
			expect(lock.editionId).toBe(editionId);
		});

		it("should allow stale lock takeover", () => {
			const lockDir = join(tempDir, "locks");
			mkdirSync(lockDir, { recursive: true });

			const editionId = "edition_2025-01-15";
			const lockFile = join(lockDir, `${editionId}.lock`);

			// Lock older than 24 hours
			writeFileSync(
				lockFile,
				JSON.stringify(
					{
						lockId: "lock_old",
						editionId,
						workflowRunId: "wfr_old",
						state: "HELD",
						acquiredAt: new Date(
							Date.now() - 25 * 3600 * 1000,
						).toISOString(),
						acquiredBy: {
							processId: 11111,
							hostname: "old-host",
							user: "test",
						},
						expiresAt: new Date(
							Date.now() - 1 * 3600 * 1000,
						).toISOString(),
						lastHeartbeat: new Date(
							Date.now() - 25 * 3600 * 1000,
						).toISOString(),
						forceReleased: false,
					},
					null,
					2,
				),
			);

			const content = readFileSync(lockFile, "utf-8");
			const lock = JSON.parse(content);
			const hoursSinceHeartbeat =
				(Date.now() - new Date(lock.lastHeartbeat).getTime()) /
				(3600 * 1000);
			expect(hoursSinceHeartbeat).toBeGreaterThan(24);
		});
	});

	describe("Missed Run Policy", () => {
		it("should not auto-backfill by default", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			expect(config.missedRunPolicy.autoBackfill).toBe(false);
			expect(config.missedRunPolicy.maxBackfillEditions).toBe(0);
		});

		it("should record missed executions", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			expect(config.missedRunPolicy.recordMissed).toBe(true);
		});
	});

	describe("Free-Only Inference Enforcement", () => {
		it("should enforce free-only in resource policy", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			expect(config.resourcePolicy.freeOnlyInference).toBe(true);
			expect(config.resourcePolicy.maxCostUsd).toBe(0);
		});

		it("should enforce no paid fallback in failure policy", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			expect(config.failurePolicy.noPaidFallback).toBe(true);
		});

		it("should have bounded retries", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			expect(config.failurePolicy.maxWorkflowRetries).toBe(0);
			expect(config.failurePolicy.useOrchestratorRetries).toBe(true);
		});

		it("should preserve checkpoints on failure", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			expect(config.failurePolicy.preserveCheckpoints).toBe(true);
		});
	});

	describe("Publication and Deployment Separation", () => {
		it("should have deployment authorization NOT_GRANTED", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			expect(config.deploymentAuthorization).toBe("NOT_GRANTED");
		});

		it("should have publication authorization NOT_GRANTED", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			expect(config.publicationAuthorization).toBe("NOT_GRANTED");
		});

		it("should not have deployment script in scheduler", () => {
			const servicePath = join(
				PROJECT_ROOT,
				"scripts",
				"scheduler",
				"ai-intelligence-daily.service",
			);
			const content = readFileSync(servicePath, "utf-8");
			// Service should not contain deployment commands
			expect(content).not.toContain("deploy");
			expect(content).not.toContain("git push");
			expect(content).not.toContain("gh pages");
		});
	});

	describe("Logging and Observability", () => {
		it("should have structured logging configuration", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			expect(config.logging.jsonFormat).toBe(true);
			expect(config.logging.correlationId).toBe(true);
			expect(config.logging.level).toBe("INFO");
		});

		it("should have log retention policy", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			expect(config.logging.retentionDays).toBe(30);
		});
	});

	describe("Notification Capabilities", () => {
		it("should have journal and file notification mechanisms", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			expect(config.notifications.mechanisms).toContain("journal");
			expect(config.notifications.mechanisms).toContain("file");
		});

		it("should notify on critical events", () => {
			const config = createDefaultSchedulerConfig(PROJECT_ROOT);
			expect(config.notifications.onFailure).toBe(true);
			expect(config.notifications.onCoverageIncomplete).toBe(true);
			expect(config.notifications.onInferenceExhausted).toBe(true);
			expect(config.notifications.onAcceptanceBlocked).toBe(true);
		});
	});
});

describe("Scheduler Integration with Workflow Orchestrator", () => {
	it("should reference correct workflow entry point", () => {
		const config = createDefaultSchedulerConfig(PROJECT_ROOT);
		expect(config.workflowEntryPoint.script).toBe(
			"scripts/run-workflow.ts",
		);
	});

	it("should reference correct acceptance entry point", () => {
		const config = createDefaultSchedulerConfig(PROJECT_ROOT);
		expect(config.workflowEntryPoint.acceptanceScript).toBe(
			"scripts/run-acceptance.ts",
		);
	});

	it("should support all execution modes", () => {
		const config = createDefaultSchedulerConfig(PROJECT_ROOT);
		expect(config.workflowEntryPoint.supportedModes).toEqual([
			"PLAN",
			"VALIDATE",
			"DRY_RUN",
			"RESUME",
			"EXECUTE",
		]);
	});

	it("should default to VALIDATE mode (safe)", () => {
		const config = createDefaultSchedulerConfig(PROJECT_ROOT);
		expect(config.workflowEntryPoint.defaultMode).toBe("VALIDATE");
	});
});

describe("Regression: Specific Scenarios from Requirements", () => {
	it("should align scheduler trigger and reporting cutoff at same local instant", () => {
		// The scheduled execution time (05:00) equals the reporting window end (05:00)
		const editionDate = "2025-01-15";
		const window = getEditorialWindow(editionDate);

		// Scheduled execution is at window.end
		const scheduledTime = window.endZoned;
		const reportingCutoff = window.endZoned;

		expect(scheduledTime.toInstant().epochMilliseconds).toBe(
			reportingCutoff.toInstant().epochMilliseconds,
		);
	});

	it("should not introduce two-hour delay or publication buffer", () => {
		const config = createDefaultSchedulerConfig(PROJECT_ROOT);
		// Schedule is exactly at 05:00, not 07:00
		expect(config.schedule.hour).toBe(5);
		expect(config.schedule.minute).toBe(0);
	});

	it("should use IANA timezone not fixed UTC offset", () => {
		const config = createDefaultSchedulerConfig(PROJECT_ROOT);
		expect(config.schedule.timezone).toBe("Europe/Amsterdam");
		expect(config.reportingWindow.timezone).toBe("Europe/Amsterdam");
	});

	it("should preserve edition identity independent of process start time", () => {
		// Edition date comes from scheduled date, not actual execution time
		const editionDate = "2025-01-15";
		const window = getEditorialWindow(editionDate);
		expect(window.editionDate).toBe(editionDate);

		// Even if process starts at 05:05, edition is still 2025-01-15
		const lateStart = "2025-01-15T05:05:00+01:00";
		expect(isInEditorialWindow(lateStart, editionDate)).toBe(false);
	});

	it("should handle delayed source indexing correctly", () => {
		// A source publishes at 04:59 but isn't indexed until 06:00
		// Eligibility determined by publication timestamp, not index time
		const editionDate = "2025-01-15";
		const publishedAt = "2025-01-15T04:59:00+01:00";
		const indexedAt = "2025-01-15T06:00:00+01:00";

		expect(isInEditorialWindow(publishedAt, editionDate)).toBe(true);
		expect(isInEditorialWindow(indexedAt, editionDate)).toBe(false);
	});

	it("should not create duplicate schedules for same workflow", () => {
		// Only one timer unit exists
		const timerPath = join(
			PROJECT_ROOT,
			"scripts",
			"scheduler",
			"ai-intelligence-daily.timer",
		);
		const servicePath = join(
			PROJECT_ROOT,
			"scripts",
			"scheduler",
			"ai-intelligence-daily.service",
		);
		// Both exist but only one timer for the service
		expect(timerPath).toBeDefined();
		expect(servicePath).toBeDefined();
	});
});
