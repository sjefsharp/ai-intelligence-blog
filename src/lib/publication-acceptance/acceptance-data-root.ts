/**
 * Publication Acceptance — Persisted-Data Root Resolution
 *
 * Acceptance reads persisted pipeline evidence (Book Delta, thesaurus,
 * architecture principles, scheduler runs, execution manifests) from a single
 * data root. The scheduler invokes the acceptance CLI with `--output-dir`
 * pointing at the run directory `<dataRoot>/scheduler/runs/<edition>_<run>`;
 * the data root is three levels above it. Without an output directory the
 * repository's `data/` directory is used.
 */

import { join } from "node:path";

export function resolveAcceptanceDataRoot(
	outputDir: string | undefined,
	projectRoot: string,
): string {
	if (!outputDir) {
		return join(projectRoot, "data");
	}
	return join(outputDir, "..", "..", "..");
}
