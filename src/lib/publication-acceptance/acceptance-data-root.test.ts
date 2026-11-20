/**
 * Publication Acceptance — persisted-data root resolution.
 *
 * The acceptance CLI is invoked by the scheduler with `--output-dir` pointing at
 * the run directory `<dataRoot>/scheduler/runs/<edition>_<run>`. Persisted
 * pipeline evidence lives directly under that data root. Resolving it wrongly
 * makes the mandatory K — Knowledge Continuity gate report persisted Book Delta
 * evidence as absent.
 */

import { describe, it, expect } from "vitest";
import { join } from "node:path";

import { resolveAcceptanceDataRoot } from "./acceptance-data-root.js";

describe("resolveAcceptanceDataRoot", () => {
	it("defaults to the repository data directory", () => {
		expect(resolveAcceptanceDataRoot(undefined, "/repo")).toBe(
			join("/repo", "data"),
		);
	});

	it("resolves a scheduler run directory to its data root", () => {
		const runDir = join(
			"/repo",
			"data",
			"scheduler",
			"runs",
			"edition_2026-11-20_sched_abc123",
		);
		expect(resolveAcceptanceDataRoot(runDir, "/repo")).toBe(
			join("/repo", "data"),
		);
	});
});
