#!/usr/bin/env tsx
/**
 * Book Delta Evaluation CLI
 *
 * Runs the evidence-based Book Delta evaluation for one edition and persists
 * the proposal register, evaluation result and knowledge-continuity evidence.
 *
 * This is a proposal-generation and review capability. It never approves,
 * implements or validates educational changes and never modifies canonical
 * terminology, architecture principles, the fact dossier or editorial records.
 *
 * Usage:
 *   pnpm exec tsx scripts/run-book-delta.ts --edition 2025-01-15
 */

import { parseArgs } from "node:util";
import { evaluateBookDelta } from "../src/lib/book-delta/index.js";

interface CliOptions {
	edition?: string;
	help?: boolean;
	json?: boolean;
}

function parseCliArgs(): CliOptions {
	const { values } = parseArgs({
		args: process.argv.slice(2),
		options: {
			edition: { type: "string", short: "e" },
			help: { type: "boolean", short: "h" },
			json: { type: "boolean" },
		},
		allowPositionals: false,
	});

	return {
		edition: values.edition,
		help: values.help ?? false,
		json: values.json ?? false,
	};
}

function printHelp(): void {
	console.log(`
Book Delta Evaluation

USAGE:
  pnpm exec tsx scripts/run-book-delta.ts --edition YYYY-MM-DD [--json]

OPTIONS:
  -e, --edition DATE   Edition date to evaluate (required)
  -j, --json           Print the machine-readable stage output
  -h, --help           Show this help

OUTPUTS (persisted under data/book-delta/<edition>/):
  book-delta-artifact.json
  book-delta-evaluation.json
  book-delta-knowledge-continuity.json
  bdp_<id>.json for each proposal created or strengthened

NOTES:
  Deterministic evaluation always runs. Model-assisted discovery is used only
  when free-tier inference credentials are configured. Inference failure falls
  back to deterministic evaluation and is reported, never fabricated.
`);
}

async function main(): Promise<number> {
	const options = parseCliArgs();
	if (options.help || !options.edition) {
		printHelp();
		return options.help ? 0 : 1;
	}

	try {
		const output = await evaluateBookDelta({
			editionDate: options.edition,
		});

		if (options.json) {
			console.log(JSON.stringify(output, null, 2));
		} else {
			console.log(
				`Book Delta evaluation completed for ${options.edition}`,
			);
			console.log(`  ${output.note}`);
			for (const artifact of output.outputArtifacts) {
				console.log(`  ✓ ${artifact.path} (${artifact.artifactId})`);
			}
		}

		return output.evaluationPerformed ? 0 : 1;
	} catch (error) {
		console.error(
			`Book Delta evaluation failed for ${options.edition}:`,
			error instanceof Error ? error.message : String(error),
		);
		return 1;
	}
}

main()
	.then((code) => {
		process.exitCode = code;
	})
	.catch((error) => {
		console.error(
			"Unexpected error:",
			error instanceof Error ? error.stack : String(error),
		);
		process.exitCode = 1;
	});
