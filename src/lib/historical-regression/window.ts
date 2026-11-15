/**
 * Historical Regression — Seven-Calendar-Day Comparison Window
 *
 * Computes the rolling historical comparison window used to detect previously
 * covered information. This window is deliberately separate from the strict
 * daily news eligibility window:
 *
 * - Daily news eligibility: half-open [previous day 05:00, edition date 05:00)
 *   Europe/Amsterdam. Computed by `getEditorialWindow` and never modified here.
 * - Historical regression: the preceding seven CALENDAR dates in
 *   Europe/Amsterdam, used only to detect previously covered information.
 *
 * Both windows are derived SOLELY from the edition date. Execution time,
 * late runs and daylight-saving transitions never shift either boundary.
 * PlainDate arithmetic is calendar-based, so DST transitions are handled
 * correctly by construction.
 */

import { Temporal } from "@js-temporal/polyfill";

import {
	getEditorialWindow,
	EDITORIAL_TIMEZONE,
	type EditorialWindow,
} from "../editorial-window.js";
import {
	HISTORICAL_REGRESSION_DAYS,
	HISTORICAL_REGRESSION_TIMEZONE,
} from "./schema.js";

/** A computed historical comparison window. */
export interface HistoricalComparisonWindow {
	/** Edition date the regression runs for (YYYY-MM-DD). */
	editionDate: string;
	/** Number of preceding calendar dates examined. */
	days: number;
	/** IANA timezone used for the calendar-date arithmetic. */
	timezone: string;
	/** The preceding calendar dates examined, ascending (oldest first). */
	editionDates: string[];
	/** The strict daily news eligibility window, reported separately and unchanged. */
	dailyEligibilityWindow: EditorialWindow;
	/** Explicit marker that the daily eligibility window is untouched. */
	dailyEligibilityWindowUnchanged: true;
}

/**
 * Return the preceding `days` calendar dates for an edition date, ascending.
 *
 * Uses `Temporal.PlainDate` arithmetic, which is calendar-based and therefore
 * correct across DST transitions (the returned values are dates, not instants).
 *
 * @example
 * getHistoricalComparisonDates('2026-11-11', 7)
 * // → ['2026-11-04','2026-11-05','2026-11-06','2026-11-07',
 * //    '2026-11-08','2026-11-09','2026-11-10']
 */
export function getHistoricalComparisonDates(
	editionDate: string,
	days: number = HISTORICAL_REGRESSION_DAYS,
): string[] {
	const date = Temporal.PlainDate.from(editionDate);
	const result: string[] = [];
	for (let i = days; i >= 1; i--) {
		result.push(date.subtract({ days: i }).toString());
	}
	return result;
}

/**
 * Compute the complete historical comparison window for an edition date.
 *
 * The result is a pure function of `editionDate`: passing different execution
 * timestamps produces identical output, so a late execution cannot shift the
 * reference window.
 */
export function getHistoricalComparisonWindow(
	editionDate: string,
	days: number = HISTORICAL_REGRESSION_DAYS,
): HistoricalComparisonWindow {
	const plainDate = Temporal.PlainDate.from(editionDate);
	const editionDates = getHistoricalComparisonDates(
		plainDate.toString(),
		days,
	);

	return {
		editionDate: plainDate.toString(),
		days,
		timezone: HISTORICAL_REGRESSION_TIMEZONE,
		editionDates,
		dailyEligibilityWindow: getEditorialWindow(plainDate.toString()),
		dailyEligibilityWindowUnchanged: true,
	};
}

/**
 * Determine which edition date's daily eligibility window contains a timestamp.
 * Returns null when the timestamp does not fall inside any of the supplied
 * editions' windows.
 *
 * Windows are half-open [start, end) and contiguous, so at most one edition can
 * match for a given list of consecutive edition dates.
 */
export function findEditionDateForTimestamp(
	timestamp: string,
	editionDates: string[],
): string | null {
	const instant = Temporal.Instant.from(timestamp);
	for (const editionDate of editionDates) {
		const window = getEditorialWindow(editionDate);
		const start = window.startZoned.toInstant();
		const end = window.endZoned.toInstant();
		if (
			Temporal.Instant.compare(instant, start) >= 0 &&
			Temporal.Instant.compare(instant, end) < 0
		) {
			return editionDate;
		}
	}
	return null;
}

/**
 * Assert (and report) that the daily eligibility window is unchanged by the
 * historical regression stage. Exposed for tests and audit output.
 */
export function verifyDailyWindowUnchanged(editionDate: string): {
	unchanged: true;
	timezone: string;
	start: string;
	end: string;
	durationHours: number;
} {
	const window = getEditorialWindow(editionDate);
	return {
		unchanged: true,
		timezone: EDITORIAL_TIMEZONE,
		start: window.start,
		end: window.end,
		durationHours: window.durationHours,
	};
}
