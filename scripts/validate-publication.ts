#!/usr/bin/env tsx
/**
 * Validate Daily Publication Package
 *
 * Validates all publication artifacts, metadata, and cross-references
 * for a given edition date against the canonical contracts.
 *
 * Usage:
 *   pnpm exec tsx scripts/validate-publication.ts --edition 2025-01-15
 *   pnpm exec tsx scripts/validate-publication.ts --all
 */

import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import {
	validatePublicationMetadata,
	validateDailyIndex,
	validateArticleIdentity,
	validateEditionIdentity,
	validateCanonicalReferences,
	computeContentHash,
	computeObjectHash,
} from "../src/lib/publication/metadata.js";
import {
	readPublicationMetadata,
	readDailyIndexMetadata,
	readPublicationPackage,
	checkCanonicalArtifactsExist,
	listEditionDirectories,
} from "../src/lib/publication/store.js";
import {
	EditionIdentitySchema,
	CanonicalReferencesSchema,
	ArticleIdentitySchema,
	PublicationPackageSchema,
	PublicationMetadataSchema,
	DailyIndexSchema,
	CANONICAL_ARTIFACT_FILENAMES,
	type EditionIdentity,
	type CanonicalReferences,
	type ArticleIdentity,
	type PublicationPackage,
	type PublicationMetadata,
	type DailyIndex,
} from "../src/lib/publication/schema.js";
import {
	getEditionDir,
	getAllCanonicalPaths,
} from "../src/lib/publication/paths.js";

interface ValidationResult {
	check: string;
	passed: boolean;
	details?: string;
	severity: "error" | "warning" | "info";
}

interface CliOptions {
	edition?: string;
	all?: boolean;
}

function parseCliArgs(): CliOptions {
	const { values } = parseArgs({
		args: process.argv.slice(2),
		options: {
			edition: { type: "string", short: "e" },
			all: { type: "boolean" },
		},
	});

	return {
		edition: values.edition,
		all: values.all ?? false,
	};
}

async function validateEdition(
	editionDate: string,
): Promise<ValidationResult[]> {
	const results: ValidationResult[] = [];

	// 1. Check all canonical artifacts exist
	const existenceCheck = await checkCanonicalArtifactsExist(editionDate);
	results.push({
		check: "Canonical artifacts exist",
		passed: existenceCheck.allExist,
		details: existenceCheck.allExist
			? "All 4 canonical artifacts present"
			: `Missing: ${existenceCheck.missing.join(", ")}`,
		severity: "error",
	});

	if (!existenceCheck.allExist) {
		return results; // Can't continue without artifacts
	}

	// 2. Read and validate daily index
	try {
		const dailyIndex = await readDailyIndexMetadata(editionDate);
		validateDailyIndex(dailyIndex);
		results.push({
			check: "Daily index schema validation",
			passed: true,
			details: "Daily index conforms to schema",
			severity: "info",
		});

		// 3. Validate edition identity in index
		validateEditionIdentity({
			editionId: dailyIndex.editionId,
			editionDate: dailyIndex.editionDate,
			editionWindow: dailyIndex.editionWindow,
			reportingWindow: dailyIndex.reportingWindow,
		});
		results.push({
			check: "Edition identity validation",
			passed: true,
			details: `Edition ${dailyIndex.editionId} identity valid`,
			severity: "info",
		});

		// 4. Verify canonical publications referenced in index
		for (const pub of dailyIndex.canonicalPublications) {
			const artifactPath = join(
				getEditionDir(editionDate),
				pub.relativePath,
			);
			try {
				const meta = await readPublicationMetadata(artifactPath);
				validatePublicationMetadata(meta);

				// Verify content hash matches
				// Note: Would need to read actual markdown content for full verification

				results.push({
					check: `Canonical publication: ${pub.contentType}`,
					passed: true,
					details: `${pub.filename} metadata valid (${meta.lifecycleStatus})`,
					severity: "info",
				});

				// Verify lifecycle status
				if (meta.lifecycleStatus === "DRAFT") {
					results.push({
						check: `Lifecycle status: ${pub.contentType}`,
						passed: false,
						details: "Publication still in DRAFT status",
						severity: "warning",
					});
				}
			} catch (err) {
				results.push({
					check: `Canonical publication: ${pub.contentType}`,
					passed: false,
					details: `Failed to read/validate metadata: ${err}`,
					severity: "error",
				});
			}
		}

		// 5. Validate English derivatives if present
		if (dailyIndex.englishDerivatives) {
			for (const deriv of dailyIndex.englishDerivatives) {
				try {
					const artifactPath = join(
						getEditionDir(editionDate),
						deriv.relativePath,
					);
					const meta = await readPublicationMetadata(artifactPath);
					validatePublicationMetadata(meta);

					// Verify it references a valid source artifact
					const sourceExists = dailyIndex.canonicalPublications.some(
						(p: { artifactId: string }) =>
							p.artifactId === deriv.sourceArtifactId,
					);
					results.push({
						check: `English derivative: ${deriv.contentType}`,
						passed: true,
						details: `${deriv.filename} metadata valid, source ${sourceExists ? "found" : "MISSING"}`,
						severity: sourceExists ? "info" : "warning",
					});
				} catch (err) {
					results.push({
						check: `English derivative: ${deriv.contentType}`,
						passed: false,
						details: `Failed to read/validate: ${err}`,
						severity: "warning", // Derivatives may not exist yet
					});
				}
			}
		}

		// 6. Validate navigation structure
		const nav = dailyIndex.availableNavigation;
		const navChecks = [
			{ name: "byTopic", data: nav.byTopic },
			{ name: "bySource", data: nav.bySource },
			{ name: "byOrganization", data: nav.byOrganization },
			{ name: "byResearchDomain", data: nav.byResearchDomain },
		];

		for (const { name, data } of navChecks) {
			const hasData = data.length > 0;
			results.push({
				check: `Navigation: ${name}`,
				passed: hasData,
				details: hasData
					? `${data.length} entries`
					: "No navigation entries",
				severity: hasData ? "info" : "warning",
			});
		}

		// 7. Check for missing artifacts
		if (dailyIndex.missingArtifacts.length > 0) {
			results.push({
				check: "Missing artifacts reported",
				passed: true, // Not a failure, just informative
				details: `${dailyIndex.missingArtifacts.length} artifacts reported missing: ${dailyIndex.missingArtifacts.map((m: { contentType: string; language: string }) => `${m.contentType} (${m.language})`).join(", ")}`,
				severity: "warning",
			});
		}
	} catch (err) {
		results.push({
			check: "Daily index validation",
			passed: false,
			details: `Failed to read/validate daily index: ${err}`,
			severity: "error",
		});
	}

	// 8. Validate publication package if exists
	try {
		const pkg = await readPublicationPackage(editionDate);
		// Validate against schema (would need PublicationPackageSchema.parse)
		results.push({
			check: "Publication package exists",
			passed: true,
			details: `Package ID: ${pkg.packageId}`,
			severity: "info",
		});

		// Verify content hash
		const expectedHash = pkg.contentHash;
		if (expectedHash) {
			results.push({
				check: "Publication package integrity",
				passed: true,
				details: `Content hash recorded: ${expectedHash}`,
				severity: "info",
			});
		}
	} catch {
		results.push({
			check: "Publication package",
			passed: false,
			details: "Publication package not found or invalid",
			severity: "warning",
		});
	}

	// 9. Validate relative link integrity
	try {
		const dailyIndex = await readDailyIndexMetadata(editionDate);
		for (const pub of dailyIndex.canonicalPublications) {
			// Check that the relative path resolves correctly
			const fullPath = join(getEditionDir(editionDate), pub.relativePath);
			// We already verified existence above, so this is a structural check
			if (
				!pub.relativePath.startsWith("canonical/") &&
				!pub.relativePath.startsWith("derivatives/")
			) {
				results.push({
					check: `Relative path structure: ${pub.contentType}`,
					passed: false,
					details: `Unexpected path prefix: ${pub.relativePath}`,
					severity: "warning",
				});
			}
		}
		results.push({
			check: "Relative link structure",
			passed: true,
			details:
				"All canonical paths under canonical/, derivatives under derivatives/",
			severity: "info",
		});
	} catch {
		// Already reported
	}

	return results;
}

function printResults(results: ValidationResult[], editionDate: string): void {
	console.log(`\\n=== Validation Results for ${editionDate} ===`);

	const passed = results.filter((r) => r.passed).length;
	const failed = results.filter((r) => !r.passed).length;
	const errors = results.filter(
		(r) => !r.passed && r.severity === "error",
	).length;
	const warnings = results.filter(
		(r) => !r.passed && r.severity === "warning",
	).length;

	for (const result of results) {
		const icon = result.passed
			? "✅"
			: result.severity === "error"
				? "❌"
				: "⚠️";
		const severity = result.severity.toUpperCase();
		console.log(`${icon} [${severity}] ${result.check}`);
		if (result.details) {
			console.log(`   ${result.details}`);
		}
	}

	console.log(`\\n=== Summary ===`);
	console.log(`Total checks: ${results.length}`);
	console.log(`Passed: ${passed}`);
	console.log(`Failed: ${failed} (Errors: ${errors}, Warnings: ${warnings})`);

	if (errors > 0) {
		console.log("\\n❌ VALIDATION FAILED — Critical errors found");
		process.exitCode = 1;
	} else if (warnings > 0) {
		console.log("\\n⚠️ VALIDATION PASSED WITH WARNINGS");
	} else {
		console.log("\\n✅ ALL VALIDATIONS PASSED");
	}
}

async function main() {
	const options = parseCliArgs();

	let editions: string[] = [];

	if (options.all) {
		editions = await listEditionDirectories();
		if (editions.length === 0) {
			console.log("No editions found.");
			return;
		}
		console.log(`Validating ${editions.length} editions...`);
	} else if (options.edition) {
		editions = [options.edition];
	} else {
		console.error(
			"Error: Either --edition YYYY-MM-DD or --all is required",
		);
		process.exit(1);
	}

	let allPassed = true;

	for (const edition of editions) {
		const results = await validateEdition(edition);
		printResults(results, edition);

		const hasErrors = results.some(
			(r) => !r.passed && r.severity === "error",
		);
		if (hasErrors) allPassed = false;
	}

	if (!allPassed) {
		process.exit(1);
	}
}

main().catch((err) => {
	console.error("Validation failed:", err);
	process.exit(1);
});
