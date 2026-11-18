/**
 * Thesaurus Module — Public API
 *
 * Single entry point for all thesaurus functionality.
 */

export * from "./schema.js";
export * from "./store.js";
export * from "./engine.js";

import { processChangeProposals } from "./engine.js";
import type { TerminologyChangeProposal } from "./engine.js";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomBytes, createHash } from "crypto";

/**
 * Evaluate Thesaurus Terminology (G01_THESAURUS_EVALUATION).
 * Entry point for workflow stage G01.
 * Processes candidate terminology additions/updates from edition evidence.
 */
export async function evaluateThesaurus(input: any): Promise<any> {
	const editionDate = input.editionDate;

	// Load fact dossier
	const factDossierArtifact =
		input["canonical-fact-dossier"] || input.canonicalFactDossier;
	let factDossier: any = {
		candidates: [],
		editionDate,
		editionWindow: { start: "", end: "", timezone: "Europe/Amsterdam" },
	};
	if (factDossierArtifact) {
		if (factDossierArtifact.path) {
			factDossier = JSON.parse(
				readFileSync(factDossierArtifact.path, "utf-8"),
			);
		} else if (typeof factDossierArtifact === "string") {
			factDossier = JSON.parse(
				readFileSync(factDossierArtifact, "utf-8"),
			);
		} else if (factDossierArtifact.candidates !== undefined) {
			factDossier = factDossierArtifact;
		}
	}

	// Load editorial manifest
	const editorialManifestArtifact =
		input["resolved-editorial-manifest"] || input.resolvedEditorialManifest;
	let editorialManifest: any = { stories: [], candidates: [], editionDate };
	if (editorialManifestArtifact) {
		if (editorialManifestArtifact.path) {
			editorialManifest = JSON.parse(
				readFileSync(editorialManifestArtifact.path, "utf-8"),
			);
		} else if (typeof editorialManifestArtifact === "string") {
			editorialManifest = JSON.parse(
				readFileSync(editorialManifestArtifact, "utf-8"),
			);
		} else if (editorialManifestArtifact.stories !== undefined) {
			editorialManifest = editorialManifestArtifact;
		}
	}

	// Load existing thesaurus
	const thesaurusArtifact = input["thesaurus"] || input.thesaurusArtifact;
	let thesaurus: any = {
		entries: [],
		relationships: [],
		version: 1,
		schemaVersion: "1.0.0",
	};
	if (thesaurusArtifact) {
		if (thesaurusArtifact.path) {
			thesaurus = JSON.parse(
				readFileSync(thesaurusArtifact.path, "utf-8"),
			);
		} else if (typeof thesaurusArtifact === "string") {
			thesaurus = JSON.parse(readFileSync(thesaurusArtifact, "utf-8"));
		} else if (thesaurusArtifact.entries !== undefined) {
			thesaurus = thesaurusArtifact;
		}
	}

	// Generate change proposals from fact dossier and editorial manifest
	const proposals: any[] = [];

	// Extract terminology candidates from fact dossier candidates
	const candidates = factDossier.candidates || [];
	for (const candidate of candidates) {
		// Extract key terms from candidate
		const domains = candidate.researchDomains || [];
		const claims = candidate.claims || [];

		for (const claim of claims) {
			// Extract key terms from claim text
			const text = claim.text || claim.claimText || "";
			const terms = extractKeyTerms(text);

			for (const term of terms) {
				if (term.length > 3 && term.length < 50) {
					proposals.push({
						proposalId: `prop_${randomBytes(8).toString("hex")}`,
						editionDate: input.editionDate,
						changeType: "ADD",
						proposedEntry: {
							entryId: `term_${randomBytes(8).toString("hex")}`,
							canonicalTerm: term,
							definition: {
								nl: `Definitie voor ${term} (automatisch gegenereerd uit editie ${input.editionDate})`,
								en: `Definition for ${term} (auto-generated from edition ${input.editionDate})`,
							},
							domain: candidate.researchDomains?.[0] || "general",
							status: "candidate",
							sourceReferences: claim.sourceReferences || [],
							claimReferences: [claim.claimId || ""],
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString(),
						},
						justification: `Term extracted from claim ${claim.claimId || "unknown"} in edition ${input.editionDate}`,
						status: "pending",
					});
				}
			}
		}

		// Also extract from editorial manifest stories
		const stories = editorialManifest.stories || [];
		for (const story of stories) {
			if (
				story.decision === "SELECTED" ||
				story.decision === "CATCH_UP_SELECTED"
			) {
				const terms = extractKeyTerms(
					story.title + " " + (story.summary || ""),
				);
				for (const term of terms) {
					if (term.length > 3 && term.length < 50) {
						proposals.push({
							proposalId: `prop_${randomBytes(8).toString("hex")}`,
							editionDate: input.editionDate,
							changeType: "ADD",
							proposedEntry: {
								entryId: `term_${randomBytes(8).toString("hex")}`,
								canonicalTerm: term,
								definition: {
									nl: `Definitie voor ${term} (uit geselecteerd verhaal in editie ${input.editionDate})`,
									en: `Definition for ${term} (from selected story in edition ${input.editionDate})`,
								},
								domain: story.researchDomains?.[0] || "general",
								status: "candidate",
								sourceReferences: story.sourceReferences || [],
								claimReferences: story.claimIds || [],
								createdAt: new Date().toISOString(),
								updatedAt: new Date().toISOString(),
							},
							justification: `Term from selected story ${story.storyId || story.candidateId || "unknown"}`,
							status: "pending",
						});
					}
				}
			}
		}
	}

	// Limit proposals to avoid overwhelming the system
	const limitedProposals = proposals.slice(0, 50);

	// Process proposals
	const results = await processChangeProposals(limitedProposals, {
		generatedBy: "thesaurus-evaluation-engine",
	});

	// Load updated thesaurus (processChangeProposals should have updated the persisted artifact)
	let updatedThesaurus = thesaurus;
	try {
		const thesaurusPath = join(
			"data",
			"thesaurus",
			"thesaurus-artifact.json",
		);
		updatedThesaurus = JSON.parse(readFileSync(thesaurusPath, "utf-8"));
	} catch {}

	// Persist evaluation result
	const evaluationResult = {
		evaluationId: `thes-eval_${randomBytes(8).toString("hex")}`,
		editionDate: input.editionDate,
		editionId: `edition_${input.editionDate}`,
		proposalsProcessed: limitedProposals.length,
		proposalsAccepted: results.filter((r) => r.success).length,
		proposalsRejected: results.filter((r) => !r.success).length,
		results,
		evaluatedAt: new Date().toISOString(),
		evaluatedBy: "thesaurus-evaluation-engine",
		contentHash: `sha256:${createHash("sha256")
			.update(JSON.stringify({ proposals: limitedProposals, results }))
			.digest("hex")}`,
	};

	// Persist evaluation result
	const evalDir = "data/thesaurus/evaluations";
	mkdirSync(evalDir, { recursive: true });
	const evalPath = join(
		evalDir,
		`edition_${input.editionDate}_${evaluationResult.evaluationId}.json`,
	);
	writeFileSync(evalPath, JSON.stringify(evaluationResult, null, 2), "utf-8");

	return {
		outputArtifacts: [
			{
				artifactId: "thesaurus",
				path: "data/thesaurus/thesaurus-artifact.json",
				description:
					"Updated ThesaurusArtifact with new/verified entries",
				required: true,
			},
			{
				artifactId: "thesaurus-evaluation",
				path: evalPath,
				description: "ThesaurusEvaluationResult",
				required: true,
			},
		],
		evaluationResult,
	};
}

function extractKeyTerms(text: string): string[] {
	if (!text) return [];
	// Simple extraction: find capitalized words, acronyms, and technical terms
	const words =
		text.match(
			/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b|\b[A-Z]{2,}\b|\b[a-z]+(?:-[a-z]+)+\b/g,
		) || [];
	// Filter common words
	const stopWords = new Set([
		"The",
		"This",
		"That",
		"With",
		"From",
		"Have",
		"Will",
		"Been",
		"Were",
		"Their",
		"Would",
		"Could",
		"Should",
		"About",
		"After",
		"Before",
		"During",
		"Under",
		"Over",
		"Between",
		"Through",
		"Across",
		"Since",
		"Until",
		"While",
		"When",
		"Where",
		"Which",
		"There",
		"Here",
		"What",
		"Who",
		"How",
		"Why",
		"And",
		"But",
		"Or",
		"Not",
		"For",
		"Are",
		"Was",
		"Had",
		"Has",
		"His",
		"Her",
		"Its",
		"Our",
		"Out",
		"One",
		"Two",
		"New",
		"Old",
		"See",
		"Saw",
		"Say",
		"Get",
		"Got",
		"Go",
		"Went",
		"Come",
		"Came",
		"Take",
		"Took",
		"Make",
		"Made",
		"Know",
		"Knew",
		"Think",
		"Thought",
		"Want",
		"Wanted",
		"Need",
		"Needed",
		"Use",
		"Used",
		"Find",
		"Found",
		"Give",
		"Gave",
		"Tell",
		"Told",
		"Ask",
		"Asked",
		"Work",
		"Worked",
		"Call",
		"Called",
		"Try",
		"Tried",
		"Feel",
		"Felt",
		"Become",
		"Became",
		"Leave",
		"Left",
		"Put",
		"Set",
		"Run",
		"Ran",
		"Move",
		"Moved",
		"Change",
		"Changed",
		"Show",
		"Showed",
		"Hear",
		"Heard",
		"Play",
		"Played",
		"Turn",
		"Turned",
		"Start",
		"Started",
		"Stop",
		"Stopped",
		"Begin",
		"Began",
		"End",
		"Ended",
		"Open",
		"Opened",
		"Close",
		"Closed",
		"Read",
		"Write",
		"Wrote",
		"Sit",
		"Sat",
		"Stand",
		"Stood",
		"Walk",
		"Walked",
		"Run",
		"Ran",
		"Fly",
		"Flew",
		"Drive",
		"Drove",
		"Ride",
		"Rode",
		"Swim",
		"Swam",
		"Sing",
		"Sang",
		"Dance",
		"Danced",
		"Sleep",
		"Slept",
		"Wake",
		"Woke",
		"Eat",
		"Ate",
		"Drink",
		"Drank",
		"Buy",
		"Bought",
		"Sell",
		"Sold",
		"Pay",
		"Paid",
		"Cost",
		"Send",
		"Sent",
		"Build",
		"Built",
		"Break",
		"Broke",
		"Cut",
		"Hit",
		"Held",
		"Keep",
		"Kept",
		"Let",
		"Let",
		"Meet",
		"Met",
		"Win",
		"Won",
		"Lose",
		"Lost",
		"Shoot",
		"Shot",
		"Fight",
		"Fought",
		"Kill",
		"Killed",
		"Die",
		"Died",
		"Live",
		"Lived",
		"Love",
		"Loved",
		"Hate",
		"Hated",
		"Like",
		"Liked",
		"Want",
		"Wanted",
		"Need",
		"Needed",
		"Use",
		"Used",
		"Make",
		"Made",
		"Do",
		"Did",
		"Get",
		"Got",
		"Go",
		"Went",
		"Come",
		"Came",
		"Take",
		"Took",
		"Give",
		"Gave",
	]);
	return [...new Set(words.filter((w) => !stopWords.has(w) && w.length > 2))];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, "..", "..", "..", "data");
const THESAURUS_DIR = join(DATA_DIR, "thesaurus");
mkdirSync(THESAURUS_DIR, { recursive: true });
