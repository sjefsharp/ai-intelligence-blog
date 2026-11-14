#!/usr/bin/env node
/**
 * Validate one or all persisted canonical fact dossiers.
 *
 * Usage:
 *   pnpm exec tsx scripts/validate-fact-dossier.ts
 *   pnpm exec tsx scripts/validate-fact-dossier.ts data/fact-dossiers/edition_2025-01-15.json
 */

import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

import { validateFactDossier } from "../src/lib/fact-dossier/index.js";

const args = process.argv.slice(2);
const target = args[0] ?? "data/fact-dossiers";

const files: string[] = [];
if (target.endsWith(".json")) {
	files.push(target);
} else if (existsSync(target)) {
	for (const file of readdirSync(target).sort()) {
		if (file.startsWith("edition_") && file.endsWith(".json")) {
			files.push(join(target, file));
		}
	}
}

if (files.length === 0) {
	// eslint-disable-next-line no-console
	console.error(`No canonical fact dossiers found at ${target}`);
	process.exit(1);
}

let failed = 0;
for (const file of files) {
	try {
		const dossier = JSON.parse(readFileSync(file, "utf-8")) as {
			candidates?: unknown[];
			editionSummary?: { totalClaims?: number };
			contentHash?: string;
		};
		const result = validateFactDossier(dossier);
		if (result.valid) {
			// eslint-disable-next-line no-console
			console.log(
				`✅ ${file} (${dossier.candidates?.length ?? 0} candidates, ${dossier.editionSummary?.totalClaims ?? 0} claims)`,
			);
		} else {
			failed++;
			// eslint-disable-next-line no-console
			console.log(`❌ ${file}`);
			for (const error of result.errors) {
				// eslint-disable-next-line no-console
				console.log(`   - ${error}`);
			}
		}
		for (const warning of result.warnings) {
			// eslint-disable-next-line no-console
			console.log(`   ⚠ ${warning}`);
		}
	} catch (error) {
		failed++;
		// eslint-disable-next-line no-console
		console.log(
			`❌ ${file}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

process.exit(failed > 0 ? 1 : 0);
