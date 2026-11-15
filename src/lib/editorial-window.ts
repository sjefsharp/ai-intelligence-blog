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
		// using epochMilliseconds to avoid string parsing issues in test environment
		const instant = Temporal.Instant.from(timestamp);
		zoned = Temporal.ZonedDateTime.from({
			epochMilliseconds: instant.epochMilliseconds,
			timeZone: "Europe/Amsterdam",
		});
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
