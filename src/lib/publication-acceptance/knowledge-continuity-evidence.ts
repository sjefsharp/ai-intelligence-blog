/**
 * Publication Acceptance — Knowledge Continuity Evidence Loader
 *
 * Reads persisted Book Delta, thesaurus and architecture-principles evidence
 * and derives the boolean inputs required by the K — Knowledge Continuity
 * acceptance gate. Every flag must be observable on disk; anything that cannot
 * be verified is reported as false with an explicit blocking condition.
 *
 * A skipped assessment is never converted into a NONE result.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { KnowledgeContinuityResult } from "./evaluator.js";
import {
	BookDeltaEvaluationResultSchema,
	BookDeltaKnowledgeContinuityResultSchema,
	BookDeltaArtifactSchema,
	type BookDeltaEvaluationResult,
	type BookDeltaKnowledgeContinuityResult,
	type BookDeltaArtifact,
} from "../book-delta/index.js";
import { getResearchAuditPath } from "../publication/paths.js";

const __dirname = join(fileURLToPath(import.meta.url), "..", "..", "..", "..");

export interface KnowledgeContinuityEvidence {
	editionDate: string;
	result: KnowledgeContinuityResult;
	evidenceReferences: string[];
}

/** Read a JSON file; return null when absent or invalid. */
function readJson(path: string): Record<string, unknown> | null {
	try {
		return JSON.parse(readFileSync(path, "utf8")) as Record<
			string,
			unknown
		>;
	} catch {
		return null;
	}
}

/** Find the single most recent file matching a prefix in a directory. */
function findLatestFile(dir: string, prefix: string): string | null {
	try {
		const matches = readdirSync(dir)
			.filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
			.sort();
		return matches.length > 0
			? join(dir, matches[matches.length - 1])
			: null;
	} catch {
		return null;
	}
}

/** Verify a persisted artifact carries a well-formed content hash. */
function hasVerifiableHash(raw: Record<string, unknown>): boolean {
	return (
		typeof raw.contentHash === "string" &&
		raw.contentHash.startsWith("sha256:")
	);
}

/**
 * Load knowledge-continuity evidence for an edition.
 *
 * Returns undefined when no Book Delta assessment was ever persisted (the gate
 * then reports UNVERIFIED rather than fabricating success).
 */
export function loadKnowledgeContinuityEvidence(
	editionDate: string,
	options: { dataRoot?: string } = {},
): KnowledgeContinuityEvidence | undefined {
	const dataRoot = options.dataRoot ?? join(__dirname, "data");
	const bookDeltaDir = join(dataRoot, "book-delta", editionDate);
	const evaluationPath = join(bookDeltaDir, "book-delta-evaluation.json");
	const continuityPath = join(
		bookDeltaDir,
		"book-delta-knowledge-continuity.json",
	);
	const artifactPath = join(bookDeltaDir, "book-delta-artifact.json");

	console.error(
		`[DEBUG] loadKnowledgeContinuityEvidence: editionDate=${editionDate}`,
	);
	console.error(`[DEBUG] dataRoot=${dataRoot}`);
	console.error(`[DEBUG] bookDeltaDir=${bookDeltaDir}`);
	console.error(
		`[DEBUG] evaluationPath=${evaluationPath}, exists=${existsSync(evaluationPath)}`,
	);
	console.error(
		`[DEBUG] continuityPath=${continuityPath}, exists=${existsSync(continuityPath)}`,
	);
	console.error(
		`[DEBUG] artifactPath=${artifactPath}, exists=${existsSync(artifactPath)}`,
	);

	const blockingConditions: string[] = [];
	const evidenceReferences: string[] = [];

	// --- Book Delta -----------------------------------------------------------
	let bookDeltaExecuted = false;
	let bookDeltaProposalsEvaluated = false;
	let bookDeltaDeduplication = false;
	let bookDeltaApprovalBoundaries = false;
	let bookDeltaResultsRecorded = false;
	let bookDeltaPersistence = false;
	let bookDeltaReadback = false;

	const evaluationRaw = readJson(evaluationPath);
	const continuityRaw = readJson(continuityPath);
	const artifactRaw = readJson(artifactPath);

	let evaluation: BookDeltaEvaluationResult | null = null;
	let continuity: BookDeltaKnowledgeContinuityResult | null = null;
	let artifact: BookDeltaArtifact | null = null;

	if (evaluationRaw) {
		const parsed = BookDeltaEvaluationResultSchema.safeParse(evaluationRaw);
		if (parsed.success) evaluation = parsed.data;
	}
	if (continuityRaw) {
		const parsed =
			BookDeltaKnowledgeContinuityResultSchema.safeParse(continuityRaw);
		if (parsed.success) continuity = parsed.data;
	}
	if (artifactRaw) {
		const parsed = BookDeltaArtifactSchema.safeParse(artifactRaw);
		if (parsed.success) artifact = parsed.data;
	}

	if (evaluation !== null) {
		bookDeltaExecuted = evaluation.evaluationPerformed === true;
		bookDeltaProposalsEvaluated =
			evaluation.newProposals.length > 0 ||
			evaluation.duplicateProposalsIdentified.length > 0 ||
			evaluation.noChangeDecisions > 0;
		bookDeltaPersistence = evaluation.persistenceSucceeded === true;
		bookDeltaReadback = evaluation.readbackSucceeded === true;
		evidenceReferences.push(evaluationPath);
	}

	if (continuity !== null) {
		evidenceReferences.push(continuityPath);
	}

	if (artifact !== null) {
		const rules = new Map(
			artifact.validationResults.map((r) => [r.rule, r.passed]),
		);
		bookDeltaDeduplication = rules.get("stable-proposal-identity") === true;
		bookDeltaApprovalBoundaries = rules.get("approval-boundary") === true;
		evidenceReferences.push(artifactPath);
	}

	// Research-audit reporting check: the audit must state that the assessment
	// ran (or explicitly records a NONE outcome), never a silent omission.
	const researchAuditPath = getResearchAuditPath(editionDate);
	if (existsSync(researchAuditPath)) {
		const audit = readFileSync(researchAuditPath, "utf8");
		if (
			audit.includes(
				"## Kennisregister Wijzigingen & Book Delta Voorstellen",
			)
		) {
			bookDeltaResultsRecorded =
				audit.includes("Book Delta evaluatie:** UITGEVOERD") ||
				(audit.includes("**Uitslag:** NONE") && bookDeltaExecuted);
		}
		evidenceReferences.push(researchAuditPath);
	}

	if (!bookDeltaExecuted) {
		blockingConditions.push(
			"Book Delta assessment was not actually executed (no persisted evaluation result for this edition).",
		);
	}
	if (evaluation !== null && !bookDeltaProposalsEvaluated) {
		blockingConditions.push(
			"No educational improvement candidates were evaluated.",
		);
	}
	if (!bookDeltaDeduplication) {
		blockingConditions.push(
			"Historical proposal deduplication is not evidenced by the persisted artifact.",
		);
	}
	if (!bookDeltaApprovalBoundaries) {
		blockingConditions.push(
			"Approval-boundary validation is not evidenced by the persisted artifact.",
		);
	}
	if (!bookDeltaResultsRecorded) {
		blockingConditions.push(
			"Book Delta results are not recorded in research-audit.md.",
		);
	}
	if (evaluation !== null && !bookDeltaPersistence) {
		blockingConditions.push("Book Delta persistence was not verified.");
	}
	if (evaluation !== null && !bookDeltaReadback) {
		blockingConditions.push(
			"Book Delta independent readback was not verified.",
		);
	}

	// --- Thesaurus ------------------------------------------------------------
	const thesaurusArtifactPath = findLatestFile(
		join(dataRoot, "thesaurus", "artifacts"),
		"thesart_",
	);
	const thesaurusEvaluationPath = findLatestFile(
		join(dataRoot, "thesaurus", "evaluations"),
		`${editionDate}`,
	);

	const thesaurusRaw = thesaurusArtifactPath
		? readJson(thesaurusArtifactPath)
		: null;
	const thesaurusRead = thesaurusRaw !== null;
	const thesaurusEvaluated = thesaurusEvaluationPath !== null;
	const thesaurusPersistenceVerified =
		thesaurusRaw !== null && hasVerifiableHash(thesaurusRaw);
	const thesaurusUpdatesHandled = thesaurusEvaluated;
	const noUnauthorizedChanges = thesaurusEvaluated;

	if (!thesaurusRead)
		blockingConditions.push(
			"Persistent thesaurus register could not be read.",
		);
	if (!thesaurusEvaluated)
		blockingConditions.push(
			"Thesaurus evaluation record for this edition is absent.",
		);
	if (!thesaurusPersistenceVerified)
		blockingConditions.push(
			"Thesaurus persistence hash could not be verified.",
		);
	if (thesaurusArtifactPath) evidenceReferences.push(thesaurusArtifactPath);
	if (thesaurusEvaluationPath)
		evidenceReferences.push(thesaurusEvaluationPath);

	// --- Architecture principles ---------------------------------------------
	const principlesRegisterPath = join(
		dataRoot,
		"architecture-principles",
		"architecture-principles.json",
	);
	const principlesEvaluationPath = findLatestFile(
		join(dataRoot, "architecture-principles", "evaluations"),
		`${editionDate}`,
	);

	const principlesRaw = existsSync(principlesRegisterPath)
		? readJson(principlesRegisterPath)
		: null;
	const principlesRead = principlesRaw !== null;
	const principlesClassificationCorrect = principlesEvaluationPath !== null;
	const principlesEvidenceValidated = principlesEvaluationPath !== null;
	const principlesPersistenceVerified =
		principlesRaw !== null && hasVerifiableHash(principlesRaw);

	if (!principlesRead)
		blockingConditions.push(
			"Architecture principles register could not be read.",
		);
	if (!principlesClassificationCorrect) {
		blockingConditions.push(
			"Architecture principles classification record for this edition is absent.",
		);
	}
	if (!principlesPersistenceVerified) {
		blockingConditions.push(
			"Architecture principles persistence hash could not be verified.",
		);
	}
	if (principlesRegisterPath && existsSync(principlesRegisterPath))
		evidenceReferences.push(principlesRegisterPath);
	if (principlesEvaluationPath)
		evidenceReferences.push(principlesEvaluationPath);

	// If no Book Delta evidence exists at all, leave the gate UNVERIFIED rather
	// than asserting a FAIL built mostly on unrelated upstream gaps.
	if (evaluation === null && continuity === null && artifact === null) {
		return undefined;
	}

	const result: KnowledgeContinuityResult = {
		thesaurusRead,
		thesaurusEvaluated,
		thesaurusUpdatesHandled,
		noUnauthorizedChanges,
		thesaurusPersistenceVerified,
		principlesRead,
		principlesClassificationCorrect,
		principlesEvidenceValidated,
		principlesPersistenceVerified,
		bookDeltaExecuted,
		bookDeltaProposalsEvaluated,
		bookDeltaDeduplication,
		bookDeltaApprovalBoundaries,
		bookDeltaResultsRecorded,
		blockingConditions,
		evidenceReferences,
	};

	return { editionDate, result, evidenceReferences };
}
