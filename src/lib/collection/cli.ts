/**
 * Collection CLI — Command-line interface for source collection
 *
 * Usage:
 *   pnpm collect [options]
 *
 * Options:
 *   --rings <1,2,3>     Discovery rings to collect (default: 1,2,3)
 *   --sources <ids>     Comma-separated source IDs to collect
 *   --since <date>      Only collect items since this date (ISO 8601)
 *   --until <date>      Only collect items until this date (ISO 8601)
 *   --force-full        Force full refresh ignoring checkpoints
 *   --max-items <n>     Maximum items per source (default: 100)
 *   --concurrency <n>   Max concurrent sources (default: 5)
 *   --dry-run           Validate sources without collecting
 *   --verbose           Verbose logging
 */

import { Command } from "commander";
import { CollectionOrchestrator } from "./orchestrator.js";
import type { OrchestratorConfig, CollectionJob } from "./orchestrator.js";
import type { TimeWindow, DiscoveryRing } from "./types.js";

const program = new Command();

program
	.name("collect")
	.description("AI Intelligence Source Collection Pipeline")
	.version("1.0.0");

program
	.option(
		"-r, --rings <rings>",
		"Discovery rings to collect (comma-separated)",
		"1,2,3",
	)
	.option("-s, --sources <sources>", "Comma-separated source IDs to collect")
	.option("--since <date>", "Only collect items since this date (ISO 8601)")
	.option("--until <date>", "Only collect items until this date (ISO 8601)")
	.option("-f, --force-full", "Force full refresh ignoring checkpoints")
	.option("-m, --max-items <n>", "Maximum items per source", "100")
	.option("-c, --concurrency <n>", "Max concurrent sources", "5")
	.option("-d, --dry-run", "Validate sources without collecting")
	.option("-v, --verbose", "Verbose logging")
	.option(
		"--registry <path>",
		"Path to source registry YAML",
		"data/sources.yml",
	)
	.option("--output <dir>", "Output directory", "data/discovered")
	.option("--checkpoints <dir>", "Checkpoint directory", "data/checkpoints");

program.parse();

const options = program.opts();

async function main() {
	const rings = options.rings
		.split(",")
		.map((r: string) => parseInt(r.trim(), 10)) as DiscoveryRing[];
	const sourceIds = options.sources
		? options.sources.split(",").map((s: string) => s.trim())
		: undefined;
	const maxItems = parseInt(options.maxItems, 10);
	const concurrency = parseInt(options.concurrency, 10);

	let timeWindow: TimeWindow | undefined;
	if (options.since || options.until) {
		timeWindow = {
			start: options.since || "2020-01-01T00:00:00Z",
			end: options.until || new Date().toISOString(),
			timezone: "UTC",
		};
	}

	const config: OrchestratorConfig = {
		sourceRegistryPath: options.registry,
		outputDir: options.output,
		checkpointDir: options.checkpoints,
		defaultTimeoutMs: 30000,
		defaultRateLimit: 60,
		maxConcurrency: concurrency,
		userAgent:
			"ai-intelligence-blog/1.0 (+https://github.com/ai-intelligence-blog)",
	};

	const orchestrator = new CollectionOrchestrator(config);

	console.log("[collect] Initializing orchestrator...");
	await orchestrator.initialize();

	if (options.dryRun) {
		console.log("[collect] Dry run mode - validating sources only");
		await validateSources(orchestrator);
		return;
	}

	const job: CollectionJob = {
		jobId: `collect_${Date.now()}`,
		name: `Collection job ${new Date().toISOString()}`,
		sourceIds: sourceIds || [],
		rings,
		timeWindow,
		forceFullRefresh: options.forceFull,
		maxItemsPerSource: maxItems,
		concurrency,
		outputDir: options.output,
		writeLedger: true,
	};

	console.log(`[collect] Starting collection job: ${job.jobId}`);
	console.log(`[collect] Rings: ${rings.join(", ")}`);
	console.log(`[collect] Max items per source: ${maxItems}`);
	console.log(`[collect] Concurrency: ${concurrency}`);

	const startTime = Date.now();
	const result = await orchestrator.runJob(job);
	const duration = Date.now() - startTime;

	console.log("\n[collect] Collection complete");
	console.log(`  Duration: ${duration}ms`);
	console.log(`  Sources attempted: ${result.sourcesAttempted}`);
	console.log(`  Sources successful: ${result.sourcesSuccessful}`);
	console.log(`  Sources failed: ${result.sourcesFailed}`);
	console.log(`  Total items collected: ${result.totalItemsCollected}`);
	console.log(`  Total new items: ${result.totalNewItems}`);

	if (result.errors.length > 0) {
		console.log("\n[collect] Errors:");
		for (const error of result.errors.slice(0, 10)) {
			console.log(
				`  [${error.code}] ${error.message} (${error.url || "N/A"})`,
			);
		}
		if (result.errors.length > 10) {
			console.log(`  ... and ${result.errors.length - 10} more errors`);
		}
	}

	// Print per-source summary
	console.log("\n[collect] Per-source summary:");
	for (const resultItem of result.results) {
		console.log(
			`  ${resultItem.sourceConfig.sourceId}: ${resultItem.items.length} items, ${resultItem.errors.length} errors`,
		);
	}
}

async function validateSources(orchestrator: any) {
	const registry = orchestrator.sourceRegistry;
	let validated = 0;
	let failed = 0;

	for (const [, config] of registry) {
		try {
			const adapter = orchestrator.getAdapter(config);
			if (!adapter) {
				console.log(
					`[SKIP] ${config.sourceId}: No adapter for type ${config.type}`,
				);
				continue;
			}

			const validation = await adapter.validate(config);
			if (validation.accessible) {
				console.log(`[OK] ${config.sourceId} (${config.type})`);
				validated++;
			} else {
				console.log(
					`[FAIL] ${config.sourceId}: ${validation.errors?.[0]?.message || "Unknown error"}`,
				);
				failed++;
			}
		} catch (error) {
			console.log(
				`[ERROR] ${config.sourceId}: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			failed++;
		}
	}

	console.log(`\nValidation complete: ${validated} passed, ${failed} failed`);
}

// Run the program
main().catch((error) => {
	console.error("[collect] Fatal error:", error);
	process.exit(1);
});
