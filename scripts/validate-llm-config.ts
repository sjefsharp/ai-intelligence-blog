#!/usr/bin/env node
/**
 * Validate Free LLM Client Configuration
 *
 * Runs dry-run validation without making API calls.
 * Verifies:
 * - Provider configuration validity
 * - Required environment variables
 * - Budget settings (free-only enforcement)
 * - Cache and checkpoint directory accessibility
 * - Model availability in provider catalogs
 */

import {
	createFreeLLMClient,
	DEFAULT_CLIENT_CONFIG,
} from "../src/lib/free-llm-client.ts";

async function main() {
	console.log("🔍 Validating Free LLM Client Configuration\n");

	const client = createFreeLLMClient({
		...DEFAULT_CLIENT_CONFIG,
		validateOnly: true, // Dry-run mode
	});

	const result = await client.validate();

	console.log("📋 Validation Results:");
	console.log(`   Valid: ${result.valid ? "✅ YES" : "❌ NO"}`);

	if (result.warnings.length > 0) {
		console.log("\n⚠️  Warnings:");
		for (const w of result.warnings) {
			console.log(`   - ${w}`);
		}
	}

	if (result.errors.length > 0) {
		console.log("\n❌ Errors:");
		for (const e of result.errors) {
			console.log(`   - ${e}`);
		}
	}

	if (result.valid) {
		console.log("\n✅ Configuration is valid for free-only operation");
		console.log(
			"   - Primary: OpenRouter (nvidia/nemotron-3-ultra-550b-a55b:free)",
		);
		console.log(
			"   - Fallback 1: OpenRouter (nvidia/nemotron-3.5-lightning:free)",
		);
		console.log("   - Budget: $0 cost, 1000 requests, 500k tokens");
		console.log("   - Retries: 3 attempts with exponential backoff");
		console.log("   - Cache: enabled (persistent)");
		console.log("   - Checkpoints: enabled (persistent)");
		console.log("   - Deterministic mode: enabled");
		console.log("   - Free-only enforcement: $0 cost budget");
	} else {
		console.log("\n❌ Configuration has errors that must be fixed");
		process.exit(1);
	}

	// Show stats
	const stats = client.getStats();
	console.log("\n📊 Client Stats (dry-run):");
	console.log(`   Current Provider: ${stats.currentProvider}`);
	console.log(
		`   Budget: ${stats.budget.requests}/${stats.budget.budget.maxRequests} requests, ${stats.budget.tokens}/${stats.budget.budget.maxTokens} tokens`,
	);
	console.log(
		`   Cache: ${stats.cache.hits} hits, ${stats.cache.misses} misses, ${stats.cache.size} entries`,
	);
	console.log(
		`   Providers Exhausted: ${stats.providersExhausted ? "YES" : "NO"}`,
	);

	// Show directory status
	const { existsSync } = await import("fs");
	const cacheDir = DEFAULT_CLIENT_CONFIG.cacheDir;
	const checkpointDir = DEFAULT_CLIENT_CONFIG.checkpointDir;
	console.log(`\n📁 Directories:`);
	console.log(
		`   Cache: ${cacheDir} - ${existsSync(cacheDir) ? "✅ exists" : "❌ missing"}`,
	);
	console.log(
		`   Checkpoints: ${checkpointDir} - ${existsSync(checkpointDir) ? "✅ exists" : "❌ missing"}`,
	);

	// Check environment
	console.log("\n🔐 Environment:");
	console.log(
		`   OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? "✅ set" : "❌ not set"}`,
	);
}

main().catch((err) => {
	console.error("💥 Validation failed:", err);
	process.exit(1);
});
