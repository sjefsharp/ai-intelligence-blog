#!/usr/bin/env node
/**
 * Validate all editorial data files against their JSON schemas
 * Run without cloud dependencies - pure local validation
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import Ajv from "ajv";
import { parse } from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");

const DATA_ROOT = join(__dirname, "..", "data");
const SCHEMAS_DIR = join(DATA_ROOT, "schemas");

const ajv = new Ajv({
	allErrors: true,
	strict: false,
	formats: { "date-time": true, uri: true },
});

// Load all schemas
const schemaFiles = readdirSync(SCHEMAS_DIR).filter((f) => f.endsWith(".json"));
const schemas = new Map();

for (const file of schemaFiles) {
	const schema = JSON.parse(readFileSync(join(SCHEMAS_DIR, file), "utf-8"));
	const key = file.replace(".json", "");
	schemas.set(key, schema);
	ajv.addSchema(schema, schema.$id);
}

console.log(`Loaded ${schemas.size} schemas`);

// Validate a single file against its schema
function validateFile(filePath: string, schemaName: string) {
	const schema = schemas.get(schemaName);
	if (!schema) {
		return { valid: false, errors: [`Unknown schema: ${schemaName}`] };
	}

	const validate = ajv.getSchema(schema.$id);
	if (!validate) {
		return { valid: false, errors: [`Schema not compiled: ${schemaName}`] };
	}

	let data;
	try {
		const content = readFileSync(filePath, "utf-8");
		if (filePath.endsWith(".yaml") || filePath.endsWith(".yml")) {
			data = parse(content);
			// Special handling for sources.yml which has a 'sources' array
			if (
				schemaName === "source-registry" &&
				data.sources &&
				Array.isArray(data.sources)
			) {
				const errors = [];
				for (let i = 0; i < data.sources.length; i++) {
					if (!validate(data.sources[i])) {
						errors.push(
							`sources[${i}]: ${ajv.errorsText(validate.errors)}`,
						);
					}
				}
				return { valid: errors.length === 0, errors };
			}
		} else if (filePath.endsWith(".jsonl")) {
			// Validate each line
			const lines = content.trim().split("\n").filter(Boolean);
			const errors = [];
			for (let i = 0; i < lines.length; i++) {
				try {
					const obj = JSON.parse(lines[i]);
					if (!validate(obj)) {
						errors.push(
							`Line ${i + 1}: ${ajv.errorsText(validate.errors)}`,
						);
					}
				} catch (e) {
					errors.push(
						`Line ${i + 1}: JSON parse error - ${(e as Error).message}`,
					);
				}
			}
			return { valid: errors.length === 0, errors };
		} else {
			data = JSON.parse(content);
		}
	} catch (e) {
		return {
			valid: false,
			errors: [`Parse error: ${(e as Error).message}`],
		};
	}

	const valid = validate(data);
	return {
		valid,
		errors: valid
			? []
			: validate.errors?.map((e) => `${e.instancePath} ${e.message}`) || [
					"Unknown validation error",
				],
	};
}

// Find all data files and match to schemas
const dataDirs = [
	{ dir: "", pattern: /^sources\.ya?ml$/, schema: "source-registry" },
	{ dir: "discovered", pattern: /\.jsonl$/, schema: "discovery-ledger" },
	{ dir: "candidates", pattern: /\.jsonl$/, schema: "candidate-news" },
	{ dir: "claims", pattern: /\.json$/, schema: "verified-claims" },
	{ dir: "dossiers", pattern: /\.json$/, schema: "fact-dossier" },
	{
		dir: "fact-dossiers",
		pattern: /^edition_\d{4}-\d{2}-\d{2}\.json$/,
		schema: "canonical-fact-dossier",
	},
	{
		dir: "historical-regression",
		pattern: /^\d{4}-\d{2}-\d{2}_.+\.json$/,
		schema: "historical-regression",
	},
	{
		dir: "editorial-selection",
		pattern: /^\d{4}-\d{2}-\d{2}_.+\.json$/,
		schema: "editorial-selection",
	},
	{ dir: "publications", pattern: /\.json$/, schema: "publication-history" },
	{ dir: "quality", pattern: /\.json$/, schema: "quality-report" },
	{ dir: "decisions", pattern: /\.json$/, schema: "editorial-decision" },
	{ dir: "indices", pattern: /master-index\.json$/, schema: "index-files" },
];

let totalFiles = 0;
let passedFiles = 0;
let failedFiles = 0;
const allErrors = [];

for (const { dir, pattern, schema } of dataDirs) {
	const dirPath = join(DATA_ROOT, dir);
	if (!existsSync(dirPath)) continue;

	const files = readdirSync(dirPath).filter((f) => pattern.test(f));
	if (files.length === 0) continue;

	console.log(`\n📁 ${dir} (${files.length} files) → ${schema}`);

	for (const file of files) {
		totalFiles++;
		const filePath = join(dirPath, file);
		const result = validateFile(filePath, schema);

		if (result.valid) {
			console.log(`  ✅ ${file}`);
			passedFiles++;
		} else {
			console.log(`  ❌ ${file}`);
			failedFiles++;
			allErrors.push({ file: `${dir}/${file}`, errors: result.errors });
		}
	}
}

// Validate index files
const indexPath = join(DATA_ROOT, "indices", "master-index.json");
if (existsSync(indexPath)) {
	const result = validateFile(indexPath, "index-files");
	totalFiles++;
	if (result.valid) {
		console.log(`\n  ✅ indices/master-index.json`);
		passedFiles++;
	} else {
		console.log(`\n  ❌ indices/master-index.json`);
		failedFiles++;
		allErrors.push({
			file: "indices/master-index.json",
			errors: result.errors,
		});
	}
}

console.log("\n" + "=".repeat(50));
console.log(
	`Total: ${totalFiles} | ✅ Passed: ${passedFiles} | ❌ Failed: ${failedFiles}`,
);

if (failedFiles > 0) {
	console.log("\n❌ Validation Errors:");
	for (const { file, errors } of allErrors) {
		console.log(`\n  ${file}:`);
		for (const err of errors) {
			console.log(`    - ${err}`);
		}
	}
	process.exit(1);
} else {
	console.log("\n✅ All files valid!");
}
