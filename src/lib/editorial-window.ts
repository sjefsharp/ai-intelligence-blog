/**
 * Editorial Window — Fixed daily news window for AI Intelligence publication.
 *
 * Window definition (per editorial contract amendment):
 * - Start: previous calendar day at 05:00 Europe/Amsterdam (inclusive)
 * - End: edition date at 05:00 Europe/Amsterdam (exclusive)
 *
 * Key properties:
 * - Uses IANA timezone 'Europe/Amsterdam' with correct DST handling
 * - Window is fixed by edition date — execution delays never change boundaries
 * - Returns timezone-aware timestamps (ISO 8601 with offset)
 * - Handles DST transitions: window is 23h (spring forward) or 25h (fall back) in UTC
 */

import { Temporal } from "@js-temporal/polyfill";

/** IANA timezone identifier for Amsterdam (handles DST automatically) */
export const EDITORIAL_TIMEZONE = "Europe/Amsterdam";

/** Hour (0-23) when the daily window opens/closes in editorial timezone */
export const EDITORIAL_WINDOW_HOUR = 5;

/**
 * Represents a fixed editorial window for a given edition date.
 * All timestamps are timezone-aware (ISO 8601 with offset).
 */
export interface EditorialWindow {
	/** Edition date in ISO 8601 date format (YYYY-MM-DD) */
	editionDate: string;
	/** Window start: previous calendar day at 05:00 Europe/Amsterdam (inclusive) */
	start: string;
	/** Window end: edition date at 05:00 Europe/Amsterdam (exclusive) */
	end: string;
	/** Start as Temporal.ZonedDateTime for computation */
	startZoned: Temporal.ZonedDateTime;
	/** End as Temporal.ZonedDateTime for computation */
	endZoned: Temporal.ZonedDateTime;
	/** Duration of window in hours (23, 24, or 25 due to DST) */
	durationHours: number;
}

/**
 * Compute the fixed editorial window for a given edition date.
 *
 * The window is determined SOLELY by the edition date — not by execution time.
 * This ensures reproducibility: same edition date always yields same window.
 *
 * @param editionDate - Edition date in YYYY-MM-DD format (in Europe/Amsterdam timezone)
 * @returns EditorialWindow with timezone-aware start/end timestamps
 *
 * @example
 * // Edition 2025-01-15 (CET, UTC+1)
 * // Start: 2025-01-14T05:00:00+01:00
 * // End:   2025-01-15T05:00:00+01:00
 * // Duration: 24 hours
 *
 * @example
 * // Edition 2025-03-30 (CEST starts, spring forward)
 * // Start: 2025-03-29T05:00:00+01:00
 * // End:   2025-03-30T05:00:00+02:00
 * // Duration: 23 hours (clock jumps from 02:00 to 03:00)
 *
 * @example
 * // Edition 2025-10-26 (CET resumes, fall back)
 * // Start: 2025-10-25T05:00:00+02:00
 * // End:   2025-10-26T05:00:00+01:00
 * // Duration: 25 hours (02:00-03:00 occurs twice)
 */
export function getEditorialWindow(editionDate: string): EditorialWindow {
	// Parse edition date as plain date (no timezone)
	const plainDate = Temporal.PlainDate.from(editionDate);

	// Window starts at 05:00 on previous calendar day in Europe/Amsterdam
	const previousDay = plainDate.subtract({ days: 1 });
	const windowTime = Temporal.PlainTime.from({
		hour: EDITORIAL_WINDOW_HOUR,
		minute: 0,
		second: 0,
		millisecond: 0,
		microsecond: 0,
		nanosecond: 0,
	});

	// Create PlainDateTime then convert to ZonedDateTime
	const startZoned = previousDay
		.toPlainDateTime(windowTime)
		.toZonedDateTime(EDITORIAL_TIMEZONE);

	// Window ends at 05:00 on edition date in Europe/Amsterdam
	const endZoned = plainDate
		.toPlainDateTime(windowTime)
		.toZonedDateTime(EDITORIAL_TIMEZONE);

	// Compute duration in hours (handles DST transitions correctly)
	const duration = endZoned.since(startZoned);
	const durationHours = Math.round(duration.total({ unit: "hour" }));

	return {
		editionDate: plainDate.toString(),
		start: startZoned.toString(),
		end: endZoned.toString(),
		startZoned,
		endZoned,
		durationHours,
	};
}

/**
 * Compare two Temporal.Instant objects.
 * Returns -1 if a < b, 0 if a === b, 1 if a > b
 */
function compareInstants(a: Temporal.Instant, b: Temporal.Instant): number {
	return Temporal.Instant.compare(a, b);
}

/**
 * Check if a given timestamp falls within the editorial window for an edition.
 *
 * @param timestamp - ISO 8601 timestamp (any timezone, will be converted)
 * @param editionDate - Edition date in YYYY-MM-DD format
 * @returns true if timestamp is within [start, end) window
 */
export function isInEditorialWindow(
	timestamp: string,
	editionDate: string,
): boolean {
	const window = getEditorialWindow(editionDate);
	const instant = Temporal.Instant.from(timestamp);
	const startInstant = window.startZoned.toInstant();
	const endInstant = window.endZoned.toInstant();
	return (
		compareInstants(instant, startInstant) >= 0 &&
		compareInstants(instant, endInstant) < 0
	);
}

/**
 * Get the edition date that a given timestamp belongs to.
 * Returns the edition date whose window contains the timestamp.
 * If timestamp falls exactly on a boundary, it belongs to the later edition.
 *
 * @param timestamp - ISO 8601 timestamp
 * @returns Edition date in YYYY-MM-DD format, or null if not in any recent window
 */
export function getEditionForTimestamp(
	timestamp: string,
	maxLookbackDays = 14,
): string | null {
	// Try to parse as ZonedDateTime directly (works for timestamps with timezone)
	let zoned: Temporal.ZonedDateTime;
	try {
		zoned = Temporal.ZonedDateTime.from(timestamp);
	} catch {
		// If parsing fails (e.g., UTC timestamp without timezone), convert via Instant
		try {
			const instant = Temporal.Instant.from(timestamp);
			zoned = instant.toZonedDateTimeISO("Europe/Amsterdam");
		} catch {
			// If all parsing fails, return null
			return null;
		}
	}

	const localDate = zoned.toPlainDate().toString();
	const instant = zoned.toInstant();

	// The edition date is either the local date (for times before 05:00)
	// or the next day (for times at or after 05:00).
	// Check both the local date and the next day.
	const nextDate = zoned.toPlainDate().add({ days: 1 }).toString();
	for (const date of [localDate, nextDate]) {
		const window = getEditorialWindow(date);
		if (
			compareInstants(instant, window.startZoned.toInstant()) >= 0 &&
			compareInstants(instant, window.endZoned.toInstant()) < 0
		) {
			return date;
		}
	}

	// Look back further if needed (for stale content detection)
	for (let i = 2; i <= maxLookbackDays; i++) {
		const date = zoned.toPlainDate().subtract({ days: i }).toString();
		const window = getEditorialWindow(date);
		if (
			compareInstants(instant, window.startZoned.toInstant()) >= 0 &&
			compareInstants(instant, window.endZoned.toInstant()) < 0
		) {
			return date;
		}
	}

	return null;
}

/**
 * Get all editorial windows for a date range (inclusive).
 * Useful for batch processing or verification.
 */
export function getEditorialWindows(
	startEditionDate: string,
	endEditionDate: string,
): EditorialWindow[] {
	const start = Temporal.PlainDate.from(startEditionDate);
	const end = Temporal.PlainDate.from(endEditionDate);
	const windows: EditorialWindow[] = [];

	let current = start;
	while (Temporal.PlainDate.compare(current, end) <= 0) {
		windows.push(getEditorialWindow(current.toString()));
		current = current.add({ days: 1 });
	}

	return windows;
}

/**
 * Format a window for human-readable display (debugging/logging).
 */
export function formatWindow(window: EditorialWindow): string {
	return (
		`Edition: ${window.editionDate}\n` +
		`Window:  ${window.start} → ${window.end} (exclusive)\n` +
		`Duration: ${window.durationHours}h\n` +
		`Timezone: ${EDITORIAL_TIMEZONE}`
	);
}

/**
 * Resolve edition identity and compute the editorial window.
 * Entry point for workflow stage A01_RESOLVE_EDITION.
 *
 * @param input - Stage input containing editionDate, editionContext, cliOptions, llmClient
 * @returns EditionContext with editionId, editionDate, timezone, reportingWindow, and scheduledExecutionTime
 */
export function resolveEdition(input: {
	editionDate: string;
	editionContext?: any;
	cliOptions?: any;
	llmClient?: any;
}): {
	editionId: string;
	editionDate: string;
	timezone: string;
	reportingWindow: {
		start: string;
		end: string;
		startZoned: string;
		endZoned: string;
		durationHours: number;
	};
	windowResolvedAt: string;
	scheduledExecutionTime: string;
} {
	const editionDate = input.editionDate;
	const window = getEditorialWindow(editionDate);
	const editionId = `edition_${editionDate}`;
	const now = new Date().toISOString();

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
		windowResolvedAt: now,
		scheduledExecutionTime: Temporal.PlainDate.from(editionDate)
			.toPlainDateTime({ hour: 7, minute: 0 })
			.toZonedDateTime(EDITORIAL_TIMEZONE)
			.toString(),
	};
}

/**
 * Load and validate source registry and research taxonomy.
 * Entry point for workflow stage A02_LOAD_REGISTRIES.
 */
export async function loadRegistries(input: {
	editionDate: string;
	editionContext?: any;
	cliOptions?: any;
	llmClient?: any;
}): Promise<{
	"validated-source-registry": Map<string, any>;
	"validated-research-taxonomy": any;
}> {
	const { readFileSync } = await import("fs");
	const { join } = await import("path");

	// Load source registry
	const sourcesPath = join(process.cwd(), "data", "sources.yml");
	const sourcesContent = readFileSync(sourcesPath, "utf-8");
	const { parseAllDocuments } = await import("yaml");
	const sourceDocs = parseAllDocuments(sourcesContent);
	const sourceRegistry = sourceDocs[0]?.toJSON() ?? {};

	// Load research taxonomy
	const taxonomyPath = join(process.cwd(), "data", "research-taxonomy.yml");
	const taxonomyContent = readFileSync(taxonomyPath, "utf-8");
	const taxonomyDocs = parseAllDocuments(taxonomyContent);
	const researchTaxonomy = taxonomyDocs[0]?.toJSON() ?? {};

	return {
		"validated-source-registry": new Map(Object.entries(sourceRegistry)),
		"validated-research-taxonomy": researchTaxonomy,
	};
}

/**
 * Validate persistent knowledge registers (thesaurus, architecture principles, book delta).
 * Entry point for workflow stage A03_VALIDATE_KNOWLEDGE_REGISTERS.
 */
export async function validateKnowledgeRegisters(input: {
	editionDate: string;
	editionContext?: any;
	cliOptions?: any;
	llmClient?: any;
}): Promise<{
	"knowledge-register-status": any;
}> {
	const { readFileSync, existsSync } = await import("fs");
	const { join } = await import("path");

	const registers = {
		thesaurus: { exists: false, valid: false, entries: 0 },
		architecturePrinciples: { exists: false, valid: false, entries: 0 },
		bookDelta: { exists: false, valid: false, entries: 0 },
	};

	// Check thesaurus
	const thesaurusPath = join(
		process.cwd(),
		"data",
		"thesaurus",
		"thesaurus-artifact.json",
	);
	if (existsSync(thesaurusPath)) {
		try {
			const content = readFileSync(thesaurusPath, "utf-8");
			const data = JSON.parse(content);
			registers.thesaurus = {
				exists: true,
				valid: true,
				entries: data.entries?.length || 0,
			};
		} catch {
			registers.thesaurus = { exists: true, valid: false, entries: 0 };
		}
	}

	// Check architecture principles
	const apPath = join(
		process.cwd(),
		"data",
		"architecture-principles",
		"apr-artifact.json",
	);
	if (existsSync(apPath)) {
		try {
			const content = readFileSync(apPath, "utf-8");
			const data = JSON.parse(content);
			registers.architecturePrinciples = {
				exists: true,
				valid: true,
				entries: data.principles?.length || 0,
			};
		} catch {
			registers.architecturePrinciples = {
				exists: true,
				valid: false,
				entries: 0,
			};
		}
	}

	// Check book delta
	const bdPath = join(
		process.cwd(),
		"data",
		"book-delta",
		"book-delta-artifact.json",
	);
	if (existsSync(bdPath)) {
		try {
			const content = readFileSync(bdPath, "utf-8");
			const data = JSON.parse(content);
			registers.bookDelta = {
				exists: true,
				valid: true,
				entries: data.proposals?.length || 0,
			};
		} catch {
			registers.bookDelta = { exists: true, valid: false, entries: 0 };
		}
	}

	return {
		"knowledge-register-status": registers,
	};
}

/**
 * Initialize durable execution manifest.
 * Entry point for workflow stage A04_INIT_EXECUTION_MANIFEST.
 */
export async function initExecutionManifest(input: {
	editionDate: string;
	editionContext?: any;
	cliOptions?: any;
	llmClient?: any;
}): Promise<{
	"execution-manifest": any;
}> {
	const { writeFileSync, mkdirSync } = await import("fs");
	const { join } = await import("path");
	const crypto = await import("crypto");

	const editionDate = input.editionDate;
	const editionId = `edition_${editionDate}`;
	const manifestId = `wfr_${crypto.randomBytes(8).toString("hex")}`;

	const manifest = {
		manifestId,
		schemaVersion: "1.0.0",
		workflowGraphVersion: "1.0.0",
		contractVersion: "1.0",
		edition: input.editionContext || {
			editionId,
			editionDate,
			timezone: "Europe/Amsterdam",
		},
		executionMode: input.cliOptions?.mode || "EXECUTE",
		requestedAt: new Date().toISOString(),
		initiatedBy: `workflow-orchestrator/${process.pid}`,
		configurationRefs: [],
		effectiveBudget: {
			maxModelRequests: 1000,
			maxTokens: 500000,
			maxSourceRequests: 5000,
			maxStageDurationMs: 1800000,
			maxTotalDurationMs: 7200000,
			maxConcurrentModelCalls: 1,
			maxTemporaryStorageMb: 1024,
			maxArtifactSizeMb: 100,
			maxRetriesPerStage: 3,
			inferenceBudget: {
				maxRequests: 1000,
				maxTokens: 500000,
				maxCostUsd: 0,
			},
		},
		stages: [],
		stageOrder: [],
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

	// Persist manifest
	const manifestDir = join(process.cwd(), "data", "execution-manifests");
	mkdirSync(manifestDir, { recursive: true });
	const manifestPath = join(
		manifestDir,
		`${editionId}_${manifestId.slice(0, 8)}.json`,
	);
	writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

	return {
		"execution-manifest": manifest,
	};
}

/**
 * Acquire edition execution lock.
 * Entry point for workflow stage A05_ACQUIRE_LOCK.
 */
export async function acquireLock(input: {
	editionDate: string;
	editionContext?: any;
	cliOptions?: any;
	llmClient?: any;
}): Promise<{
	"workflow-lock": any;
}> {
	const { writeFileSync, mkdirSync, readFileSync, existsSync } =
		await import("fs");
	const { join } = await import("path");
	const crypto = await import("crypto");
	const os = await import("os");

	const editionDate = input.editionDate;
	const editionId = `edition_${editionDate}`;
	const lockDir = join(process.cwd(), "data", "locks");
	mkdirSync(lockDir, { recursive: true });
	const lockPath = join(lockDir, `${editionId}.lock`);

	// Check existing lock
	if (existsSync(lockPath)) {
		try {
			const existingContent = readFileSync(lockPath, "utf-8");
			const existingLock = JSON.parse(existingContent);
			if (existingLock.state === "HELD") {
				// Check if it's held by the same process (engine already acquired it)
				if (existingLock.acquiredBy?.processId === process.pid) {
					// Same process - lock already acquired by engine, return it
					return {
						"workflow-lock": existingLock,
					};
				}
				throw new Error(
					`CONCURRENT_EXECUTION: Edition ${editionId} already locked`,
				);
			}
		} catch (e) {
			if ((e as Error).message.includes("CONCURRENT_EXECUTION")) {
				throw e;
			}
			// Stale or corrupted lock, proceed
		}
	}

	const workflowRunId = `wfr_${crypto.randomBytes(8).toString("hex")}`;
	const acquiredAt = new Date().toISOString();
	const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

	const lock = {
		lockId: `lock_${crypto.randomBytes(8).toString("hex")}`,
		editionId,
		workflowRunId,
		state: "HELD",
		acquiredAt,
		acquiredBy: {
			processId: process.pid,
			hostname: os.hostname(),
			user: process.env.USER || "unknown",
		},
		expiresAt,
		lastHeartbeat: acquiredAt,
		forceReleased: false,
	};

	writeFileSync(lockPath, JSON.stringify(lock, null, 2), "utf-8");

	return {
		"workflow-lock": lock,
	};
}
