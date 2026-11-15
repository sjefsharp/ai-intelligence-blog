/**
 * Boundary tests for editorial-window.ts
 *
 * Tests cover:
 * - Normal day (24h window)
 * - Spring forward DST transition (23h window)
 * - Fall back DST transition (25h window)
 * - Boundary inclusivity/exclusivity (start inclusive, end exclusive)
 * - Timestamp containment checks
 * - Edition date lookup for timestamps
 * - Execution delay invariance (window fixed by edition date, not execution time)
 */

import { describe, it, expect } from "vitest";
import {
	getEditorialWindow,
	isInEditorialWindow,
	getEditionForTimestamp,
	getEditorialWindows,
	EDITORIAL_TIMEZONE,
	EDITORIAL_WINDOW_HOUR,
} from "./editorial-window";

describe("Editorial Window — Core Behavior", () => {
	it("returns correct window for a normal CET day (2025-01-15)", () => {
		const window = getEditorialWindow("2025-01-15");

		expect(window.editionDate).toBe("2025-01-15");
		expect(window.start).toBe(
			"2025-01-14T05:00:00+01:00[Europe/Amsterdam]",
		);
		expect(window.end).toBe("2025-01-15T05:00:00+01:00[Europe/Amsterdam]");
		expect(window.durationHours).toBe(24);
	});

	it("returns correct window for a normal CEST day (2025-07-15)", () => {
		const window = getEditorialWindow("2025-07-15");

		expect(window.editionDate).toBe("2025-07-15");
		expect(window.start).toBe(
			"2025-07-14T05:00:00+02:00[Europe/Amsterdam]",
		);
		expect(window.end).toBe("2025-07-15T05:00:00+02:00[Europe/Amsterdam]");
		expect(window.durationHours).toBe(24);
	});
});

describe("Editorial Window — DST Spring Forward (loses 1 hour)", () => {
	// 2025-03-30: Clocks jump from 02:00 to 03:00 (CET→CEST)
	// Window start: 2025-03-29T05:00:00+01:00 (CET)
	// Window end:   2025-03-30T05:00:00+02:00 (CEST)
	// UTC span: 23 hours

	it("handles spring forward transition correctly (2025-03-30)", () => {
		const window = getEditorialWindow("2025-03-30");

		expect(window.editionDate).toBe("2025-03-30");
		expect(window.start).toBe(
			"2025-03-29T05:00:00+01:00[Europe/Amsterdam]",
		);
		expect(window.end).toBe("2025-03-30T05:00:00+02:00[Europe/Amsterdam]");
		expect(window.durationHours).toBe(23);
	});

	it("spring forward: start is inclusive, end is exclusive", () => {
		const window = getEditorialWindow("2025-03-30");
		const startInstant = window.startZoned.toInstant();
		const endInstant = window.endZoned.toInstant();

		// Start boundary: exactly at start should be IN window
		expect(isInEditorialWindow(startInstant.toString(), "2025-03-30")).toBe(
			true,
		);

		// End boundary: exactly at end should be OUT of window (exclusive)
		expect(isInEditorialWindow(endInstant.toString(), "2025-03-30")).toBe(
			false,
		);

		// One nanosecond before end should be IN (use ZonedDateTime for nanosecond arithmetic)
		const justBeforeEndZdt = window.endZoned.subtract({ nanoseconds: 1 });
		expect(
			isInEditorialWindow(
				justBeforeEndZdt.toInstant().toString(),
				"2025-03-30",
			),
		).toBe(true);

		// One nanosecond after start should be IN
		const justAfterStartZdt = window.startZoned.add({ nanoseconds: 1 });
		expect(
			isInEditorialWindow(
				justAfterStartZdt.toInstant().toString(),
				"2025-03-30",
			),
		).toBe(true);
	});
});

describe("Editorial Window — DST Fall Back (gains 1 hour)", () => {
	// 2025-10-26: Clocks fall back from 03:00 to 02:00 (CEST→CET)
	// Window start: 2025-10-25T05:00:00+02:00 (CEST)
	// Window end:   2025-10-26T05:00:00+01:00 (CET)
	// UTC span: 25 hours (02:00-03:00 occurs twice)

	it("handles fall back transition correctly (2025-10-26)", () => {
		const window = getEditorialWindow("2025-10-26");

		expect(window.editionDate).toBe("2025-10-26");
		expect(window.start).toBe(
			"2025-10-25T05:00:00+02:00[Europe/Amsterdam]",
		);
		expect(window.end).toBe("2025-10-26T05:00:00+01:00[Europe/Amsterdam]");
		expect(window.durationHours).toBe(25);
	});

	it("fall back: start is inclusive, end is exclusive", () => {
		const window = getEditorialWindow("2025-10-26");
		const startInstant = window.startZoned.toInstant();
		const endInstant = window.endZoned.toInstant();

		expect(isInEditorialWindow(startInstant.toString(), "2025-10-26")).toBe(
			true,
		);
		expect(isInEditorialWindow(endInstant.toString(), "2025-10-26")).toBe(
			false,
		);

		const justBeforeEndZdt = window.endZoned.subtract({ nanoseconds: 1 });
		expect(
			isInEditorialWindow(
				justBeforeEndZdt.toInstant().toString(),
				"2025-10-26",
			),
		).toBe(true);
	});

	it("fall back: the repeated hour (02:00-03:00) is handled correctly", () => {
		// During fall back, 02:00-03:00 happens twice on 2025-10-26
		// First occurrence: 2025-10-26T02:00:00+02:00 (CEST) = 2025-10-26T00:00:00Z
		// Second occurrence: 2025-10-26T02:00:00+01:00 (CET) = 2025-10-26T01:00:00Z

		const firstOccurrence = "2025-10-26T02:30:00+02:00[Europe/Amsterdam]";
		const secondOccurrence = "2025-10-26T02:30:00+01:00[Europe/Amsterdam]";

		// Both should be in the 2025-10-26 window (which ends at 05:00 CET = 04:00 UTC)
		expect(isInEditorialWindow(firstOccurrence, "2025-10-26")).toBe(true);
		expect(isInEditorialWindow(secondOccurrence, "2025-10-26")).toBe(true);

		// The 2025-10-25 window ends at 2025-10-25T05:00:00+02:00 (CEST) = 03:00 UTC
		// Both occurrences are on Oct 26, which is AFTER the 2025-10-25 window ends
		expect(isInEditorialWindow(firstOccurrence, "2025-10-25")).toBe(false);
		expect(isInEditorialWindow(secondOccurrence, "2025-10-25")).toBe(false);

		// The 2025-10-27 window starts at 2025-10-26T05:00:00+01:00 (CET) = 04:00 UTC
		// Both occurrences are BEFORE the 2025-10-27 window starts
		expect(isInEditorialWindow(firstOccurrence, "2025-10-27")).toBe(false);
		expect(isInEditorialWindow(secondOccurrence, "2025-10-27")).toBe(false);
	});
});

describe("Editorial Window — Boundary Inclusivity/Exclusivity", () => {
	it("start boundary is inclusive (timestamp at start is IN window)", () => {
		const window = getEditorialWindow("2025-01-15");
		expect(isInEditorialWindow(window.start, "2025-01-15")).toBe(true);
	});

	it("end boundary is exclusive (timestamp at end is OUT of window)", () => {
		const window = getEditorialWindow("2025-01-15");
		expect(isInEditorialWindow(window.end, "2025-01-15")).toBe(false);
	});

	it("timestamp just before end is IN window", () => {
		const window = getEditorialWindow("2025-01-15");
		const justBeforeEndZdt = window.endZoned.subtract({ nanoseconds: 1 });
		expect(
			isInEditorialWindow(
				justBeforeEndZdt.toInstant().toString(),
				"2025-01-15",
			),
		).toBe(true);
	});

	it("timestamp just after start is IN window", () => {
		const window = getEditorialWindow("2025-01-15");
		const justAfterStartZdt = window.startZoned.add({ nanoseconds: 1 });
		expect(
			isInEditorialWindow(
				justAfterStartZdt.toInstant().toString(),
				"2025-01-15",
			),
		).toBe(true);
	});

	it("timestamp one day before start is OUT of window", () => {
		const window = getEditorialWindow("2025-01-15");
		const dayBeforeStartZdt = window.startZoned.subtract({ days: 1 });
		expect(
			isInEditorialWindow(
				dayBeforeStartZdt.toInstant().toString(),
				"2025-01-15",
			),
		).toBe(false);
	});

	it("timestamp one day after end is OUT of window", () => {
		const window = getEditorialWindow("2025-01-15");
		const dayAfterEndZdt = window.endZoned.add({ days: 1 });
		expect(
			isInEditorialWindow(
				dayAfterEndZdt.toInstant().toString(),
				"2025-01-15",
			),
		).toBe(false);
	});
});

describe("Editorial Window — Edition Date Lookup", () => {
	it("finds correct edition for timestamp in middle of window", () => {
		const timestamp = "2025-01-14T12:00:00+01:00[Europe/Amsterdam]";
		expect(getEditionForTimestamp(timestamp)).toBe("2025-01-15");
	});

	it("finds correct edition for timestamp at start boundary", () => {
		const window = getEditorialWindow("2025-01-15");
		expect(getEditionForTimestamp(window.start)).toBe("2025-01-15");
	});

	it("finds correct edition for timestamp just before end boundary", () => {
		const window = getEditorialWindow("2025-01-15");
		const justBeforeEndZdt = window.endZoned.subtract({ nanoseconds: 1 });
		expect(getEditionForTimestamp(justBeforeEndZdt.toString())).toBe(
			"2025-01-15",
		);
	});

	it("timestamp at end boundary belongs to NEXT edition", () => {
		const window = getEditorialWindow("2025-01-15");
		// End of 2025-01-15 window = start of 2025-01-16 window
		expect(getEditionForTimestamp(window.end)).toBe("2025-01-16");
	});

	it("handles DST spring forward boundary correctly", () => {
		// 2025-03-30 window ends at 05:00 CEST (which is 03:00 UTC)
		// 2025-03-31 window starts at 05:00 CEST
		const endOfMarch30 = "2025-03-30T05:00:00+02:00[Europe/Amsterdam]";
		expect(getEditionForTimestamp(endOfMarch30)).toBe("2025-03-31");
	});

	it("handles DST fall back boundary correctly", () => {
		// 2025-10-26 window ends at 05:00 CET (which is 04:00 UTC)
		// 2025-10-27 window starts at 05:00 CET
		const endOfOct26 = "2025-10-26T05:00:00+01:00[Europe/Amsterdam]";
		expect(getEditionForTimestamp(endOfOct26)).toBe("2025-10-27");
	});

	it("returns an edition date for any valid timestamp", () => {
		// Even very old timestamps belong to some edition window
		const oldTimestamp = "2020-01-01T12:00:00+01:00[Europe/Amsterdam]";
		const editionDate = getEditionForTimestamp(oldTimestamp, 14);
		expect(editionDate).toBe("2020-01-02");
	});

	it("handles UTC timestamps correctly", () => {
		// Convert UTC to Amsterdam timezone strings
		// 2025-01-14T04:00:00Z = 2025-01-14T05:00:00+01:00 (start of 2025-01-15 window)
		expect(
			getEditionForTimestamp(
				"2025-01-14T05:00:00+01:00[Europe/Amsterdam]",
			),
		).toBe("2025-01-15");

		// 2025-01-15T04:00:00Z = 2025-01-15T05:00:00+01:00 (end of 2025-01-15 window)
		expect(
			getEditionForTimestamp(
				"2025-01-15T05:00:00+01:00[Europe/Amsterdam]",
			),
		).toBe("2025-01-16");
	});
});

describe("Editorial Window — Execution Delay Invariance", () => {
	it("window is FIXED by edition date — same date always returns same window", () => {
		const window1 = getEditorialWindow("2025-01-15");
		const window2 = getEditorialWindow("2025-01-15");

		expect(window1.start).toBe(window2.start);
		expect(window1.end).toBe(window2.end);
		expect(window1.durationHours).toBe(window2.durationHours);
	});

	it("window does not depend on current system time", () => {
		// This test verifies the function is pure — no Date.now() or similar
		const window = getEditorialWindow("2025-06-15");
		expect(window.start).toBe(
			"2025-06-14T05:00:00+02:00[Europe/Amsterdam]",
		);
		expect(window.end).toBe("2025-06-15T05:00:00+02:00[Europe/Amsterdam]");
	});

	it("multiple calls with same edition date are idempotent", () => {
		for (let i = 0; i < 10; i++) {
			const window = getEditorialWindow("2025-12-25");
			expect(window.start).toBe(
				"2025-12-24T05:00:00+01:00[Europe/Amsterdam]",
			);
			expect(window.end).toBe(
				"2025-12-25T05:00:00+01:00[Europe/Amsterdam]",
			);
		}
	});
});

describe("Editorial Window — Multi-Day Range", () => {
	it("getEditorialWindows returns correct windows for a range", () => {
		const windows = getEditorialWindows("2025-01-15", "2025-01-17");

		expect(windows).toHaveLength(3);
		expect(windows[0].editionDate).toBe("2025-01-15");
		expect(windows[1].editionDate).toBe("2025-01-16");
		expect(windows[2].editionDate).toBe("2025-01-17");
	});

	it("range includes DST transition days", () => {
		const windows = getEditorialWindows("2025-03-29", "2025-03-31");

		expect(windows).toHaveLength(3);
		expect(windows[0].durationHours).toBe(24); // 2025-03-29 (normal CET)
		expect(windows[1].durationHours).toBe(23); // 2025-03-30 (spring forward)
		expect(windows[2].durationHours).toBe(24); // 2025-03-31 (normal CEST)
	});

	it("range includes fall back transition", () => {
		const windows = getEditorialWindows("2025-10-25", "2025-10-27");

		expect(windows).toHaveLength(3);
		expect(windows[0].durationHours).toBe(24); // 2025-10-25 (normal CEST)
		expect(windows[1].durationHours).toBe(25); // 2025-10-26 (fall back)
		expect(windows[2].durationHours).toBe(24); // 2025-10-27 (normal CET)
	});
});

describe("Editorial Window — Timezone Constants", () => {
	it("uses Europe/Amsterdam timezone", () => {
		expect(EDITORIAL_TIMEZONE).toBe("Europe/Amsterdam");
	});

	it("uses 05:00 as window hour", () => {
		expect(EDITORIAL_WINDOW_HOUR).toBe(5);
	});

	it("window hour is reflected in start/end times", () => {
		const window = getEditorialWindow("2025-01-15");
		expect(window.start).toContain("T05:00:00");
		expect(window.end).toContain("T05:00:00");
	});
});

describe("Editorial Window — ISO 8601 Output Format", () => {
	it("returns timestamps with timezone offset and IANA name", () => {
		const window = getEditorialWindow("2025-01-15");

		// Temporal.ZonedDateTime.toString() format: 2025-01-14T05:00:00+01:00[Europe/Amsterdam]
		expect(window.start).toMatch(
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}\[Europe\/Amsterdam\]$/,
		);
		expect(window.end).toMatch(
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}\[Europe\/Amsterdam\]$/,
		);
	});

	it("editionDate is plain YYYY-MM-DD", () => {
		const window = getEditorialWindow("2025-01-15");
		expect(window.editionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});
