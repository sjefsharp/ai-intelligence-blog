#!/usr/bin/env node
/**
 * Generate machine-readable JSON Schemas from the Zod contracts.
 *
 * The Zod schemas are the single source of truth; this script writes the
 * on-disk draft-07 contract so the TypeScript and JSON contracts cannot drift.
 *
 * Usage:
 *   pnpm exec tsx scripts/generate-schemas.ts
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

import { generateHistoricalRegressionJsonSchema } from "../src/lib/historical-regression/schema.js";
import { generateEditorialSelectionJsonSchema } from "../src/lib/editorial-selection/schema.js";
import { generateCanonicalFactDossierJsonSchema } from "../src/lib/fact-dossier/schema.js";
import {
	generatePublicationPackageJsonSchema,
	generateDailyIndexJsonSchema,
	generatePublicationMetadataJsonSchema,
	generateArticleIdentityJsonSchema,
	generateEditionIdentityJsonSchema,
} from "../src/lib/publication/schema.js";
import {
	generateListeningQualityEvaluationJsonSchema,
	generateCriterionEvaluationJsonSchema,
	generateRepairActionJsonSchema,
	generateHolisticListeningAssessmentJsonSchema,
} from "../src/lib/listening-quality-evaluation/schema.js";
import {
	generateAcceptanceReportJsonSchema,
	generateAcceptanceDecisionJsonSchema,
	generateAcceptanceGateDefinitionJsonSchema,
	generateAcceptanceGateResultJsonSchema,
} from "../src/lib/publication-acceptance/schema.js";
import {
	generateBookDeltaProposalJsonSchema,
	generateBookDeltaArtifactJsonSchema,
	generateBookDeltaEvaluationResultJsonSchema,
	generateBookDeltaKnowledgeContinuityJsonSchema,
} from "../src/lib/book-delta/schema.js";
import {
	generateTerminologyEntryJsonSchema,
	generateThesaurusArtifactJsonSchema,
	generateTerminologyChangeProposalJsonSchema,
} from "../src/lib/thesaurus/schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");
const SCHEMAS_DIR = join(__dirname, "..", "data", "schemas");

interface SchemaTarget {
	filename: string;
	generate: () => Record<string, unknown>;
}

const TARGETS: SchemaTarget[] = [
	{
		filename: "canonical-fact-dossier.json",
		generate: generateCanonicalFactDossierJsonSchema,
	},
	{
		filename: "editorial-selection.json",
		generate: generateEditorialSelectionJsonSchema,
	},
	{
		filename: "historical-regression.json",
		generate: generateHistoricalRegressionJsonSchema,
	},
	{
		filename: "terminology-entry.json",
		generate: generateTerminologyEntryJsonSchema,
	},
	{
		filename: "thesaurus-artifact.json",
		generate: generateThesaurusArtifactJsonSchema,
	},
	{
		filename: "terminology-change-proposal.json",
		generate: generateTerminologyChangeProposalJsonSchema,
	},
	{
		filename: "publication-package.json",
		generate: generatePublicationPackageJsonSchema,
	},
	{
		filename: "daily-index.json",
		generate: generateDailyIndexJsonSchema,
	},
	{
		filename: "publication-metadata.json",
		generate: generatePublicationMetadataJsonSchema,
	},
	{
		filename: "article-identity.json",
		generate: generateArticleIdentityJsonSchema,
	},
	{
		filename: "edition-identity.json",
		generate: generateEditionIdentityJsonSchema,
	},
	{
		filename: "listening-quality-evaluation.json",
		generate: generateListeningQualityEvaluationJsonSchema,
	},
	{
		filename: "criterion-evaluation.json",
		generate: generateCriterionEvaluationJsonSchema,
	},
	{
		filename: "repair-action.json",
		generate: generateRepairActionJsonSchema,
	},
	{
		filename: "holistic-listening-assessment.json",
		generate: generateHolisticListeningAssessmentJsonSchema,
	},
	{
		filename: "publication-acceptance-report.json",
		generate: generateAcceptanceReportJsonSchema,
	},
	{
		filename: "publication-acceptance-decision.json",
		generate: generateAcceptanceDecisionJsonSchema,
	},
	{
		filename: "acceptance-gate-definition.json",
		generate: generateAcceptanceGateDefinitionJsonSchema,
	},
	{
		filename: "acceptance-gate-result.json",
		generate: generateAcceptanceGateResultJsonSchema,
	},
	{
		filename: "book-delta-proposal.json",
		generate: generateBookDeltaProposalJsonSchema,
	},
	{
		filename: "book-delta-artifact.json",
		generate: generateBookDeltaArtifactJsonSchema,
	},
	{
		filename: "book-delta-evaluation.json",
		generate: generateBookDeltaEvaluationResultJsonSchema,
	},
	{
		filename: "book-delta-knowledge-continuity.json",
		generate: generateBookDeltaKnowledgeContinuityJsonSchema,
	},
];

export async function main(): Promise<number> {
	mkdirSync(SCHEMAS_DIR, { recursive: true });

	for (const target of TARGETS) {
		const schema = target.generate();
		const path = join(SCHEMAS_DIR, target.filename);
		writeFileSync(path, `${JSON.stringify(schema, null, 2)}\n`, "utf-8");
		// eslint-disable-next-line no-console
		console.log(
			`Generated ${path} (${Object.keys(schema).length} top-level keys)`,
		);
	}

	return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	main()
		.then((code) => {
			process.exitCode = code;
		})
		.catch((error) => {
			// eslint-disable-next-line no-console
			console.error(error instanceof Error ? error.stack : String(error));
			process.exitCode = 1;
		});
}
