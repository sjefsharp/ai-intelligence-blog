/**
 * Book Delta — Engine Integration Tests
 *
 * These tests execute the deterministic Book Delta engine end to end against
 * synthetic fixtures and the repository's representative fact dossier. They
 * verify proposal creation, persistence, independent readback, NONE outcomes,
 * historical deduplication, blocked reintroduction, target-document handling,
 * approval boundaries, research-audit rendering and K-gate evidence loading.
 *
 * All fixtures are synthetic test data. No real daily edition is generated and
 * no canonical knowledge register is modified: every run is isolated in a
 * temporary BOOK_DELTA_DATA_DIR.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
	CanonicalFactDossierSchema,
	type CanonicalFactDossier,
	type CanonicalCandidate,
	type ConsolidatedClaim,
} from "../fact-dossier/schema.js";
import { BookDeltaEngine, type BookDeltaEngineConfig } from "./engine.js";
import { evaluateBookDelta, loadThesaurusEntries } from "./evaluate.js";
import {
	BookDeltaArtifactSchema,
	BookDeltaEvaluationResultSchema,
	BookDeltaKnowledgeContinuityResultSchema,
} from "./schema.js";
import {
	checkBookDeltaArtifactsExist,
	persistBookDeltaProposal,
	readAllProposalsAcrossEditions,
	readBookDeltaArtifact,
	readBookDeltaEvaluationResult,
	readBookDeltaKnowledgeContinuityResult,
} from "./store.js";
import { renderBookDeltaAuditSection } from "./audit-renderer.js";
import { loadKnowledgeContinuityEvidence } from "../publication-acceptance/knowledge-continuity-evidence.js";

const MODULE_DIR = fileURLToPath(new URL(".", import.meta.url));
const PROJECT_ROOT = join(MODULE_DIR, "..", "..", "..");
const EDITION_DATE = "2025-01-15";

/** Representative dossier shipped with the repository (synthetic research data). */
const BASE_DOSSIER = CanonicalFactDossierSchema.parse(
	JSON.parse(
		readFileSync(
			join(
				PROJECT_ROOT,
				"data",
				"fact-dossiers",
				`edition_${EDITION_DATE}.json`,
			),
			"utf8",
		),
	),
);

/**
 * Canonical thesaurus entries loaded from the repository artifact. This
 * regression-tests that the persistent thesaurus artifact validates against
 * the canonical TerminologyEntrySchema and is actually consultable.
 */
const THESAURUS_ENTRIES = loadThesaurusEntries(
	join(
		PROJECT_ROOT,
		"data",
		"thesaurus",
		"artifacts",
		"thesart_a1b2c3d4e5f67890.json",
	),
);

// ============================================================================
// Fixture helpers
// ============================================================================

/** Clone the representative candidate so every required field stays valid. */
function makeCandidate(
	overrides: Partial<CanonicalCandidate> = {},
): CanonicalCandidate {
	const source = BASE_DOSSIER.candidates[1];
	return {
		...source,
		candidateId: "cand_0000000000000002",
		editionId: `edition_${EDITION_DATE}`,
		editionDate: EDITION_DATE,
		claims: [makeClaim()],
		...overrides,
	};
}

/** Clone the representative consolidated claim. */
function makeClaim(
	overrides: Partial<ConsolidatedClaim> = {},
): ConsolidatedClaim {
	return {
		...BASE_DOSSIER.candidates[1].claims[0],
		claimId: "claim_0000000000000002",
		candidateId: "cand_0000000000000002",
		...overrides,
	};
}

/** Build a minimal dossier around synthetic candidates. */
function makeDossier(candidates: CanonicalCandidate[]): CanonicalFactDossier {
	return {
		...BASE_DOSSIER,
		editionId: `edition_${EDITION_DATE}`,
		editionDate: EDITION_DATE,
		candidates,
	};
}

/** A finding with enduring educational value and no project-local target. */
function enduringCandidate(statement: string): CanonicalCandidate {
	return makeCandidate({
		factualHeadline: statement,
		exactStatement: statement,
		researchDomains: ["models-inference-scientific"],
		technologies: [],
		claims: [
			makeClaim({
				claimStatement: statement,
				claimType: "scientific-research",
				evidenceClassification: "RESEARCH_FINDING",
				confidence: 0.9,
				verificationStatus: "verified",
				verificationLevel: "L2",
				limitingEvidence: [],
			}),
		],
	});
}

function makeEngine(
	dossier: CanonicalFactDossier,
	overrides: Partial<BookDeltaEngineConfig> = {},
): BookDeltaEngine {
	return new BookDeltaEngine({
		editionDate: EDITION_DATE,
		factDossier: dossier,
		thesaurusEntries: [],
		architecturePrinciples: [],
		enableModelAssistedDiscovery: false,
		enableTargetDocumentInspection: true,
		minConfidenceForProposal: 0.65,
		maxProposalsPerEdition: 10,
		...overrides,
	});
}

// ============================================================================
// Isolated temporary persistence
// ============================================================================

let tempDir: string;

beforeEach(() => {
	tempDir = mkdtempSync(join(tmpdir(), "book-delta-engine-test-"));
	// The engine treats BOOK_DELTA_DATA_DIR as the Book Delta root; the K gate
	// treats dataRoot as the project data root (it appends book-delta/<edition>).
	process.env.BOOK_DELTA_DATA_DIR = join(tempDir, "book-delta");
});

afterEach(() => {
	delete process.env.BOOK_DELTA_DATA_DIR;
	rmSync(tempDir, { recursive: true, force: true });
});

// ============================================================================
// Proposal creation, persistence and readback
// ============================================================================

describe("Book Delta engine — proposal creation and persistence", () => {
	it("creates a CANDIDATE proposal, persists it and verifies independent readback", async () => {
		const statement =
			"Xylophonist misconception persists in routing literature.";
		const engine = makeEngine(makeDossier([enduringCandidate(statement)]));

		const result = await engine.run();

		expect(result.proposals).toHaveLength(1);
		const proposal = result.proposals[0];
		expect(proposal.category).not.toBe("NONE");
		expect(proposal.lifecycleStatus).toBe("CANDIDATE");
		expect(proposal.supportingClaimIds).toContain("claim_0000000000000002");
		expect(proposal.originalSources.length).toBeGreaterThan(0);
		expect(proposal.acceptanceCriteria.length).toBeGreaterThan(0);
		expect(proposal.schemaVersion).toBe("1.0.0");

		// The engine never grants approval, implementation or validation.
		expect(proposal.lifecycleStatus).not.toBe("APPROVED");
		expect(proposal.lifecycleStatus).not.toBe("IMPLEMENTED");
		expect(proposal.lifecycleStatus).not.toBe("VALIDATED");

		// Artifact and evaluation results validate against their schemas.
		expect(() =>
			BookDeltaArtifactSchema.parse(result.artifact),
		).not.toThrow();
		expect(() =>
			BookDeltaEvaluationResultSchema.parse(result.evaluationResult),
		).not.toThrow();
		expect(() =>
			BookDeltaKnowledgeContinuityResultSchema.parse(
				result.knowledgeContinuityResult,
			),
		).not.toThrow();

		expect(result.evaluationResult.evaluationPerformed).toBe(true);
		expect(result.evaluationResult.persistenceSucceeded).toBe(true);
		expect(result.evaluationResult.readbackSucceeded).toBe(true);
		expect(result.evaluationResult.noChangeDecisions).toBe(0);
		expect(result.knowledgeContinuityResult.gateStatus).toBe("PASS");
		expect(result.knowledgeContinuityResult.editionId).toBe(
			`edition_${EDITION_DATE}`,
		);
		expect(result.knowledgeContinuityResult.editionDate).toBe(EDITION_DATE);

		// Files exist on disk and read back through the store.
		const existence = await checkBookDeltaArtifactsExist(EDITION_DATE);
		expect(existence.artifactExists).toBe(true);
		expect(existence.evaluationExists).toBe(true);
		expect(existence.knowledgeContinuityExists).toBe(true);
		expect(existence.proposalCount).toBe(1);

		const storedArtifact = await readBookDeltaArtifact(EDITION_DATE);
		expect(storedArtifact.proposals.map((p) => p.proposalId)).toContain(
			proposal.proposalId,
		);

		const storedEvaluation =
			await readBookDeltaEvaluationResult(EDITION_DATE);
		expect(storedEvaluation.newProposals).toContain(proposal.proposalId);

		const storedContinuity =
			await readBookDeltaKnowledgeContinuityResult(EDITION_DATE);
		expect(storedContinuity.gateStatus).toBe("PASS");
	});

	it("records the approval-boundary validation rule as passed", async () => {
		const engine = makeEngine(
			makeDossier([
				enduringCandidate(
					"Xylophonist misconception persists in routing literature.",
				),
			]),
		);
		const result = await engine.run();

		const rule = result.artifact.validationResults.find(
			(r) => r.rule === "approval-boundary",
		);
		expect(rule?.passed).toBe(true);
	});

	it("consults the thesaurus without raising a ReferenceError and records the claim reference", async () => {
		// The claim contains "Agent", which matches the representative thesaurus
		// entry. This exercises the terminology-reference code path.
		const statement = "Agent misconception persists in routing literature.";
		const engine = makeEngine(makeDossier([enduringCandidate(statement)]), {
			thesaurusEntries: THESAURUS_ENTRIES,
		});

		const result = await engine.run();

		expect(THESAURUS_ENTRIES.length).toBe(1);
		expect(result.proposals).toHaveLength(1);
		const terminology = result.proposals[0].terminologyReferences;
		expect(terminology.length).toBeGreaterThan(0);
		expect(terminology[0].entryId).toBe("thes_a1b2c3d4e5f67890");
		expect(terminology[0].note).toContain("claim_0000000000000002");
	});
});

// ============================================================================
// NONE outcome
// ============================================================================

describe("Book Delta engine — explicit NONE outcome", () => {
	it("records NONE when no finding has enduring educational value", async () => {
		const transient = makeCandidate({
			factualHeadline:
				"Vendor announces new software release version 2.3.1 now available",
			exactStatement:
				"Vendor announces new software release version 2.3.1 now available",
			researchDomains: ["cross-cutting"],
			claims: [
				makeClaim({
					claimStatement:
						"Vendor announces new software release version 2.3.1 now available",
					claimType: "software-release",
					evidenceClassification: "VENDOR_CLAIM",
					confidence: 0.9,
					verificationStatus: "verified",
					verificationLevel: "L2",
				}),
			],
		});

		const engine = makeEngine(makeDossier([transient]));
		const result = await engine.run();

		expect(result.proposals).toHaveLength(1);
		expect(result.proposals[0].category).toBe("NONE");
		expect(result.evaluationResult.noChangeDecisions).toBe(1);
		expect(result.evaluationResult.newProposals).toHaveLength(0);
		expect(
			result.evaluationResult.duplicateProposalsIdentified,
		).toHaveLength(0);
		expect(result.knowledgeContinuityResult.gateStatus).toBe("PASS");
		expect(result.knowledgeContinuityResult.evaluationRan).toBe(true);
	});

	it("renders a NONE outcome distinctly from a non-executed assessment", () => {
		const noneLines = renderBookDeltaAuditSection(EDITION_DATE, {
			editionId: `edition_${EDITION_DATE}`,
			editionDate: EDITION_DATE,
			evaluatedAt: new Date().toISOString(),
			evaluatedBy: "test",
			evaluationPerformed: true,
			factDossierConsidered: true,
			thesaurusConsulted: false,
			architecturePrinciplesConsulted: false,
			historicalProposalsInspected: true,
			targetDocumentsInspected: false,
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
		});

		const notExecutedLines = renderBookDeltaAuditSection(
			EDITION_DATE,
			null,
		);

		expect(noneLines.join("\n")).toContain("NONE");
		expect(notExecutedLines.join("\n")).toContain("NIET UITGEVOERD");
		expect(notExecutedLines.join("\n")).toContain("NONE-resultaat");
	});

	it("renders proposal identifiers when proposals were produced", async () => {
		const engine = makeEngine(
			makeDossier([
				enduringCandidate(
					"Xylophonist misconception persists in routing literature.",
				),
			]),
		);
		const result = await engine.run();

		const lines = renderBookDeltaAuditSection(
			EDITION_DATE,
			result.evaluationResult,
		).join("\n");
		expect(lines).toContain("UITGEVOERD");
		for (const proposalId of result.evaluationResult.newProposals) {
			expect(lines).toContain(proposalId);
		}
	});
});

// ============================================================================
// Historical deduplication and proposal continuity
// ============================================================================

describe("Book Delta engine — historical continuity", () => {
	it("keeps one stable proposal identifier across editions and strengthens it instead of duplicating", async () => {
		const statement =
			"Xylophonist misconception persists in routing literature.";
		const first = await makeEngine(
			makeDossier([enduringCandidate(statement)]),
		).run();
		const proposalId = first.proposals[0].proposalId;

		// A later edition adds a second verified claim to the same concept.
		const strengthenedCandidate = enduringCandidate(statement);
		strengthenedCandidate.claims = [
			...strengthenedCandidate.claims,
			{
				...strengthenedCandidate.claims[0],
				claimId: "claim_0000000000000003",
			},
		];
		const second = await makeEngine(
			makeDossier([strengthenedCandidate]),
		).run();

		expect(second.proposals[0].proposalId).toBe(proposalId);
		expect(second.evaluationResult.newProposals).not.toContain(proposalId);
		expect(second.evaluationResult.updatedHistoricalProposals).toContain(
			proposalId,
		);

		const all = await readAllProposalsAcrossEditions();
		const matching = all.filter((p) => p.proposalId === proposalId);
		expect(matching).toHaveLength(1);
		expect(matching[0].supportingClaimIds).toHaveLength(2);
		expect(matching[0].revisionHistory.length).toBe(1);

		const existence = await checkBookDeltaArtifactsExist(EDITION_DATE);
		expect(existence.proposalCount).toBe(1);
	});

	it("blocks silent reintroduction of a rejected proposal without new justification", async () => {
		const statement =
			"Xylophonist misconception persists in routing literature.";
		const first = await makeEngine(
			makeDossier([enduringCandidate(statement)]),
		).run();
		const proposalId = first.proposals[0].proposalId;

		// Simulate a human review decision: the proposal is rejected.
		const rejected: (typeof first.proposals)[0] = {
			...first.proposals[0],
			lifecycleStatus: "REJECTED",
			updatedAt: new Date(Date.now() + 1000).toISOString(),
		};
		await persistBookDeltaProposal(EDITION_DATE, rejected);

		const second = await makeEngine(
			makeDossier([enduringCandidate(statement)]),
		).run();

		expect(second.evaluationResult.newProposals).not.toContain(proposalId);
		expect(
			second.evaluationResult.unresolvedEvidenceGaps.some((gap) =>
				gap.includes("rejected proposal"),
			),
		).toBe(true);
		expect(
			second.evaluationResult.unresolvedEvidenceGaps.some((gap) =>
				gap.includes(
					"reintroduced without documented new justification",
				),
			),
		).toBe(true);
	});
});

// ============================================================================
// Target document handling
// ============================================================================

describe("Book Delta engine — target document handling", () => {
	it("leaves an unmatched destination explicitly unidentified and performs no comparison", async () => {
		const engine = makeEngine(
			makeDossier([
				enduringCandidate(
					"Xylophonist misconception persists in routing literature.",
				),
			]),
		);
		const result = await engine.run();

		const target = result.proposals[0].targetDocument!;
		expect(target.accessibility).toBe("unidentified");
		expect(target.comparisonPerformed).toBe(false);
		expect(target.comparisonResult).toBe("not-performed");
		expect(target.accessNote).toContain(
			"no comparison with existing material was performed",
		);
	});

	it("marks a lexical match as accessed but never confirms a defect from string matching alone", async () => {
		// "Historical regression" is present in docs/historical-regression.md.
		const engine = makeEngine(
			makeDossier([
				enduringCandidate(
					"Historical regression research improves editorial selection outcomes.",
				),
			]),
		);
		const result = await engine.run();

		const target = result.proposals[0].targetDocument!;
		expect(target.accessibility).toBe("accessed");
		expect(target.comparisonPerformed).toBe(true);
		expect(target.comparisonResult).toBe("inconclusive");
		expect(target.accessNote).toContain(
			"semantic coverage was not established",
		);
	});

	it("reports an explicitly disabled inspection without claiming a comparison", async () => {
		const engine = makeEngine(
			makeDossier([
				enduringCandidate(
					"Xylophonist misconception persists in routing literature.",
				),
			]),
			{
				enableTargetDocumentInspection: false,
			},
		);
		const result = await engine.run();

		const target = result.proposals[0].targetDocument!;
		expect(target.accessibility).toBe("unidentified");
		expect(target.comparisonPerformed).toBe(false);
		expect(target.accessNote).toContain("disabled by configuration");
	});
});

// ============================================================================
// Failure and interruption states
// ============================================================================

describe("Book Delta engine — failure states", () => {
	it("rejects when persistence cannot complete", async () => {
		// Replace the data root with a regular file so atomic writes fail.
		const blockedPath = join(tempDir, "not-a-directory");
		writeFileSync(blockedPath, "blocked", "utf8");
		process.env.BOOK_DELTA_DATA_DIR = blockedPath;

		const engine = makeEngine(
			makeDossier([
				enduringCandidate(
					"Xylophonist misconception persists in routing literature.",
				),
			]),
		);
		await expect(engine.run()).rejects.toThrow();
	});
});

// ============================================================================
// Knowledge-continuity gate integration
// ============================================================================

describe("Book Delta engine — knowledge continuity evidence", () => {
	it("produces evidence the K gate can observe without fabricating unrelated success", async () => {
		const engine = makeEngine(
			makeDossier([
				enduringCandidate(
					"Xylophonist misconception persists in routing literature.",
				),
			]),
		);
		await engine.run();

		const evidence = loadKnowledgeContinuityEvidence(EDITION_DATE, {
			dataRoot: tempDir,
		});
		expect(evidence).toBeDefined();
		expect(evidence?.result.bookDeltaExecuted).toBe(true);
		expect(evidence?.result.bookDeltaProposalsEvaluated).toBe(true);
		expect(evidence?.result.bookDeltaDeduplication).toBe(true);
		expect(evidence?.result.bookDeltaApprovalBoundaries).toBe(true);
		// The temporary root has no thesaurus or architecture-principles evidence,
		// so the gate must report blocking conditions rather than a clean PASS.
		expect(evidence?.result.blockingConditions.length).toBeGreaterThan(0);
	});

	it("returns undefined when no Book Delta evidence exists at all", () => {
		const emptyDir = mkdtempSync(join(tmpdir(), "book-delta-empty-"));
		try {
			const evidence = loadKnowledgeContinuityEvidence(EDITION_DATE, {
				dataRoot: emptyDir,
			});
			expect(evidence).toBeUndefined();
		} finally {
			rmSync(emptyDir, { recursive: true, force: true });
		}
	});
});

// ============================================================================
// Workflow entry point
// ============================================================================

describe("Book Delta workflow entry point", () => {
	it("runs deterministically without inference credentials and reports zero inference usage", async () => {
		const output = await evaluateBookDelta({
			editionDate: EDITION_DATE,
		});

		expect(output.evaluationPerformed).toBe(true);
		expect(output.resourcesUsed.modelRequests).toBe(0);
		expect(output.resourcesUsed.tokensUsed).toBe(0);
		expect(output.outputArtifacts.length).toBe(3);

		for (const artifact of output.outputArtifacts) {
			expect(existsSync(artifact.path)).toBe(true);
		}

		const artifact = JSON.parse(
			readFileSync(output.outputArtifacts[0].path, "utf8"),
		);
		expect(() => BookDeltaArtifactSchema.parse(artifact)).not.toThrow();
	});
});
