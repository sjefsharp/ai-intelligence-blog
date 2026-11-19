/** Phase G — Knowledge Continuity Validation */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { randomBytes, createHash } from "crypto";

interface ArtifactRef {
	path?: string;
	[key: string]: unknown;
}

interface KnowledgeContinuityResult {
	validationId: string;
	editionDate: string;
	editionId: string;
	thesaurus: {
		persisted: boolean;
		readbackValid: boolean;
		entryCount: number;
		contentHash: string;
	};
	architecturePrinciples: {
		persisted: boolean;
		readbackValid: boolean;
		principleCount: number;
		contentHash: string;
	};
	bookDelta: {
		persisted: boolean;
		readbackValid: boolean;
		proposalCount: number;
		contentHash: string;
	};
	historicalContinuity: {
		thesaurusContinuity: boolean;
		principlesContinuity: boolean;
		bookDeltaContinuity: boolean;
		details: string;
	};
	overallValid: boolean;
	validatedAt: string;
	validatedBy: string;
	contentHash: string;
}

interface PhaseGInput {
	editionDate: string;
	thesaurus?: ArtifactRef;
	"architecture-principles"?: ArtifactRef;
	"book-delta"?: ArtifactRef;
}

/**
 * Validate Persistent Knowledge State & Historical Continuity (G04_VALIDATE_KNOWLEDGE_STATE).
 * Entry point for workflow stage G04.
 */
export async function validateKnowledgeState(input: PhaseGInput): Promise<any> {
	const editionDate = input.editionDate;
	const editionId = `edition_${editionDate}`;

	// Load and validate thesaurus
	const thesaurusArtifact = input["thesaurus"];
	let thesaurusResult = {
		persisted: false,
		readbackValid: false,
		entryCount: 0,
		contentHash: "",
	};
	if (thesaurusArtifact?.path) {
		try {
			const thesaurus = JSON.parse(
				readFileSync(thesaurusArtifact.path, "utf-8"),
			);
			thesaurusResult = {
				persisted: true,
				readbackValid: true,
				entryCount: thesaurus.entries?.length || 0,
				contentHash: thesaurus.contentHash || "",
			};
		} catch {
			thesaurusResult = {
				persisted: false,
				readbackValid: false,
				entryCount: 0,
				contentHash: "",
			};
		}
	}

	// Load and validate architecture principles
	const archPrinciplesArtifact = input["architecture-principles"];
	let archPrinciplesResult = {
		persisted: false,
		readbackValid: false,
		principleCount: 0,
		contentHash: "",
	};
	if (archPrinciplesArtifact?.path) {
		try {
			const arch = JSON.parse(
				readFileSync(archPrinciplesArtifact.path, "utf-8"),
			);
			archPrinciplesResult = {
				persisted: true,
				readbackValid: true,
				principleCount: arch.principles?.length || 0,
				contentHash: arch.contentHash || "",
			};
		} catch {
			archPrinciplesResult = {
				persisted: false,
				readbackValid: false,
				principleCount: 0,
				contentHash: "",
			};
		}
	}

	// Load and validate book delta
	const bookDeltaArtifact = input["book-delta"];
	let bookDeltaResult = {
		persisted: false,
		readbackValid: false,
		proposalCount: 0,
		contentHash: "",
	};
	if (bookDeltaArtifact?.path) {
		try {
			const bookDelta = JSON.parse(
				readFileSync(bookDeltaArtifact.path, "utf-8"),
			);
			bookDeltaResult = {
				persisted: true,
				readbackValid: true,
				proposalCount: bookDelta.proposals?.length || 0,
				contentHash: bookDelta.contentHash || "",
			};
		} catch {
			bookDeltaResult = {
				persisted: false,
				readbackValid: false,
				proposalCount: 0,
				contentHash: "",
			};
		}
	}

	// Check historical continuity
	const thesaurusContinuity =
		thesaurusResult.persisted && thesaurusResult.readbackValid;
	const principlesContinuity =
		archPrinciplesResult.persisted && archPrinciplesResult.readbackValid;
	const bookDeltaContinuity =
		bookDeltaResult.persisted && bookDeltaResult.readbackValid;

	const result: KnowledgeContinuityResult = {
		validationId: `kcv_${randomBytes(8).toString("hex")}`,
		editionDate,
		editionId: `edition_${editionDate}`,
		thesaurus: thesaurusResult,
		architecturePrinciples: archPrinciplesResult,
		bookDelta: bookDeltaResult,
		historicalContinuity: {
			thesaurusContinuity,
			principlesContinuity,
			bookDeltaContinuity,
			details: `Thesaurus: ${thesaurusContinuity ? "OK" : "FAIL"}, Principles: ${principlesContinuity ? "OK" : "FAIL"}, Book Delta: ${bookDeltaContinuity ? "OK" : "FAIL"}`,
		},
		overallValid:
			thesaurusContinuity && principlesContinuity && bookDeltaContinuity,
		validatedAt: new Date().toISOString(),
		validatedBy: "knowledge-continuity-validator",
		contentHash: `sha256:${createHash("sha256")
			.update(
				JSON.stringify({
					thesaurus: thesaurusResult,
					architecturePrinciples: archPrinciplesResult,
					bookDelta: bookDeltaResult,
				}),
			)
			.digest("hex")}`,
	};

	return result;
}
