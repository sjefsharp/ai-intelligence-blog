/**
 * Edition discovery regression tests.
 *
 * `editions/edition_2026-11-17/` is a genuinely validated edition that was
 * committed before the daily index and publication package were emitted. It
 * must stay discoverable, and the missing metadata must be reported rather
 * than hidden.
 */

import { describe, expect, it } from "vitest";
import { loadEditionContent, listPublicEditionDates } from "./astro-adapter.js";

describe("edition discovery", () => {
	it("lists the validated 2026-11-17 edition", async () => {
		const dates = await listPublicEditionDates();
		expect(dates).toContain("2026-11-17");
	});

	it("loads an edition without a daily index and reports the gap", async () => {
		const edition = await loadEditionContent("2026-11-17");
		expect(edition).not.toBeNull();
		expect(edition?.dailyIndex).toBeNull();
		expect(edition?.canonicalReferences).toBeNull();
		expect(edition?.newsletter).not.toBeNull();
		expect(edition?.editionIdentity.editionId).toBe("edition_2026-11-17");
		expect(
			edition?.missingArtifacts.some(
				(artifact) => artifact.contentType === "daily-index",
			),
		).toBe(true);
	});

	it("loads the demo edition through its daily index", async () => {
		const edition = await loadEditionContent("2025-01-15");
		expect(edition?.dailyIndex).not.toBeNull();
	});
});
