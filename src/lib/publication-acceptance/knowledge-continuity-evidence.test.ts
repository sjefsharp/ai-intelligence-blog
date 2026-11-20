/**
 * Knowledge Continuity Evidence Loader — default data root regression tests.
 *
 * The daily edition acceptance failed because the loader resolved its default
 * data root above the repository instead of the repository's `data/` directory,
 * so persisted Book Delta evidence was reported as absent and the mandatory
 * K — Knowledge Continuity gate returned UNVERIFIED. These tests pin the
 * default to the repository data directory.
 */

import { describe, it, expect } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadKnowledgeContinuityEvidence } from "./knowledge-continuity-evidence.js";

const MODULE_DIR = fileURLToPath(new URL(".", import.meta.url));
const PROJECT_ROOT = join(MODULE_DIR, "..", "..", "..");
const DATA_ROOT = join(PROJECT_ROOT, "data");
const EDITION_DATE = "2025-01-15";

const EVALUATION_FIXTURE = {
	editionId: `edition_${EDITION_DATE}`,
	editionDate: EDITION_DATE,
	evaluatedAt: "2025-01-15T05:00:00.000Z",
	evaluatedBy: "acceptance-test-fixture",
	evaluationPerformed: true,
	factDossierConsidered: true,
	thesaurusConsulted: false,
	architecturePrinciplesConsulted: false,
	historicalProposalsInspected: true,
	targetDocumentsInspected: true,
	newProposals: [],
	updatedHistoricalProposals: [],
	duplicateProposalsIdentified: [],
	noChangeDecisions: 1,
	unresolvedEvidenceGaps: [],
	targetDocumentAccessLimitations: [],
	reviewRequirements: [],
	persistenceSucceeded: true,
	readbackSucceeded: true,
	inferenceUsed: false,
};

describe("Knowledge continuity evidence loader — default data root", () => {
	it("reads Book Delta evidence from the repository data directory by default", () => {
		const editionDir = join(DATA_ROOT, "book-delta", EDITION_DATE);
		mkdirSync(editionDir, { recursive: true });
		writeFileSync(
			join(editionDir, "book-delta-evaluation.json"),
			JSON.stringify(EVALUATION_FIXTURE),
			"utf8",
		);

		try {
			const evidence = loadKnowledgeContinuityEvidence(EDITION_DATE);
			expect(evidence).toBeDefined();
			expect(evidence?.result.bookDeltaExecuted).toBe(true);
			expect(evidence?.result.bookDeltaProposalsEvaluated).toBe(true);
		} finally {
			rmSync(editionDir, { recursive: true, force: true });
		}
	});
});
