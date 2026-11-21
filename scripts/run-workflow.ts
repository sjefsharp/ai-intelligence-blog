#!/usr/bin/env tsx
/**
 * AI Daily Intelligence — Workflow Orchestrator CLI
 *
 * Deterministic daily workflow orchestrator coordinating the complete
 * research, editorial, publication, quality, and knowledge continuity pipeline.
 *
 * Usage:
 *   pnpm exec tsx scripts/run-workflow.ts --edition 2025-01-15 --mode PLAN
 *   pnpm exec tsx scripts/run-workflow.ts --edition 2025-01-15 --mode VALIDATE
 *   pnpm exec tsx scripts/run-workflow.ts --edition 2025-01-15 --mode DRY_RUN
 *   pnpm exec tsx scripts/run-workflow.ts --edition 2025-01-15 --mode RESUME --resume-from wfr_abc123
 *   pnpm exec tsx scripts/run-workflow.ts --edition 2025-01-15 --mode EXECUTE
 *
 * Modes:
 *   PLAN        - Inspect graph, config, dependencies without execution
 *   VALIDATE    - Check contracts, config, graph integrity, existing artifacts
 *   DRY_RUN     - Execute with controlled fixtures, isolated output, stubbed deps
 *   RESUME      - Resume incomplete workflow from verified checkpoints
 *   EXECUTE     - Full real-edition execution (explicitly authorized)
 */

import { parseArgs } from "node:util";

import {
	createWorkflowOrchestrator,
	WorkflowOrchestrator,
} from "../src/lib/workflow-orchestrator/engine.js";

import type {
	CliOptions,
	WorkflowExecutionMode,
} from "../src/lib/workflow-orchestrator/schema.js";
import { validateWorkflowGraph } from "../src/lib/workflow-orchestrator/graph.js";

function parseCliArgs(): CliOptions {
	const { values } = parseArgs({
		args: process.argv.slice(2),
		options: {
			edition: { type: "string", short: "e" },
			mode: { type: "string", short: "m" },
			config: { type: "string", short: "c" },
			resumeFrom: { type: "string", short: "r" },
			"resume-from": { type: "string" },
			forceResume: { type: "boolean" },
			"force-resume": { type: "boolean" },
			dryRunFixtures: { type: "string" },
			"dry-run-fixtures": { type: "string" },
			outputDir: { type: "string", short: "o" },
			"output-dir": { type: "string" },
			verbose: { type: "boolean", short: "v" },
			dryRun: { type: "boolean" },
			"dry-run": { type: "boolean" },
			noPersist: { type: "boolean" },
			"no-persist": { type: "boolean" },
			skipStages: { type: "string" },
			"skip-stages": { type: "string" },
			onlyStages: { type: "string" },
			"only-stages": { type: "string" },
			maxParallelism: { type: "string" },
			"max-parallelism": { type: "string" },
			budgetOverride: { type: "string" },
			"budget-override": { type: "string" },
			timeoutMs: { type: "string" },
			"timeout-ms": { type: "string" },
			help: { type: "boolean", short: "h" },
			version: { type: "boolean", short: "V" },
			graph: { type: "boolean" },
			listStages: { type: "boolean" },
			"list-stages": { type: "boolean" },
			listPhases: { type: "boolean" },
			"list-phases": { type: "boolean" },
		},
		allowPositionals: true,
	});

	const mode = (values.mode as WorkflowExecutionMode) || "PLAN";
	const validModes: WorkflowExecutionMode[] = [
		"PLAN",
		"VALIDATE",
		"DRY_RUN",
		"RESUME",
		"EXECUTE",
	];
	if (!validModes.includes(mode)) {
		console.error(
			`Invalid mode: ${mode}. Valid modes: ${validModes.join(", ")}`,
		);
		process.exit(1);
	}

	// Handle special CLI-only flags
	if (values.help) {
		printHelp();
		process.exit(0);
	}
	if (values.version) {
		console.log("workflow-orchestrator v1.0.0");
		process.exit(0);
	}
	if (values.graph) {
		printGraph();
		process.exit(0);
	}
	if (values.listStages || values["list-stages"]) {
		listStages();
		process.exit(0);
	}
	if (values.listPhases || values["list-phases"]) {
		listPhases();
		process.exit(0);
	}

	// Return only valid CliOptions fields
	return {
		edition: values.edition,
		mode,
		config: values.config,
		resumeFrom: values.resumeFrom ?? values["resume-from"],
		forceResume: values.forceResume ?? values["force-resume"] ?? false,
		dryRunFixtures: values.dryRunFixtures ?? values["dry-run-fixtures"],
		outputDir: values.outputDir ?? values["output-dir"],
		verbose: values.verbose ?? false,
		dryRun: values.dryRun ?? values["dry-run"] ?? false,
		noPersist: values.noPersist ?? values["no-persist"] ?? false,
		skipStages:
			(values.skipStages ?? values["skip-stages"])
				? (values.skipStages ?? values["skip-stages"]!).split(",")
				: [],
		onlyStages:
			(values.onlyStages ?? values["only-stages"])
				? (values.onlyStages ?? values["only-stages"]!).split(",")
				: [],
		maxParallelism:
			(values.maxParallelism ?? values["max-parallelism"])
				? parseInt(
						values.maxParallelism ?? values["max-parallelism"]!,
						10,
					)
				: 1,
		budgetOverride: values.budgetOverride ?? values["budget-override"],
		timeoutMs:
			(values.timeoutMs ?? values["timeout-ms"])
				? parseInt(values.timeoutMs ?? values["timeout-ms"]!, 10)
				: undefined,
	};
}

function printHelp(): void {
	console.log(`
AI Daily Intelligence — Workflow Orchestrator

USAGE:
  pnpm exec tsx scripts/run-workflow.ts [OPTIONS]

OPTIONS:
  -e, --edition DATE        Edition date (YYYY-MM-DD). Defaults to current/next edition.
  -m, --mode MODE           Execution mode: PLAN, VALIDATE, DRY_RUN, RESUME, EXECUTE (default: PLAN)
  -c, --config PATH         Path to workflow configuration file
  -r, --resume-from RUN_ID  Resume from specific workflow run ID (for RESUME mode)
  --force-resume            Force resume even if lock appears active
  --dry-run-fixtures PATH   Path to synthetic fixtures for DRY_RUN mode
  -o, --output-dir PATH     Output directory for manifests, reports, locks
  -v, --verbose             Verbose output
  --dry-run                 Alias for --mode DRY_RUN
  --no-persist              Don't persist manifests and reports (for testing)
  --skip-stages IDs         Comma-separated stage IDs to skip
  --only-stages IDs         Comma-separated stage IDs to run exclusively
  --max-parallelism N       Max concurrent model calls (default: 1)
  --budget-override JSON    JSON override for resource budgets
  --timeout-ms N            Global timeout in milliseconds
  -h, --help                Show this help
  -V, --version             Show version
  --graph                   Print workflow graph and exit
  --list-stages             List all stages and exit
  --list-phases             List all phases and exit

MODES:
  PLAN        Inspect the workflow graph, configuration, dependencies, and expected
              operations without invoking any generation or modifying artifacts.
              Safe, non-destructive, default mode.

  VALIDATE    Check contracts, configuration, graph integrity, and existing artifacts
              without executing the complete research and publication process.

  DRY_RUN     Execute the workflow using controlled fixtures, isolated temporary
              output, and stubbed or explicitly bounded external dependencies.
              Does not overwrite production or historical artifacts.

  RESUME      Resume an existing authorized, incomplete workflow using verified
              checkpoints. Validates checkpoint compatibility before continuing.

  EXECUTE     Full real-edition execution. Requires explicit authorization.
              Does not imply publication or deployment - that is step 100.

EXAMPLES:
  # Plan tomorrow's edition
  pnpm exec tsx scripts/run-workflow.ts --mode PLAN

  # Validate configuration for a specific edition
  pnpm exec tsx scripts/run-workflow.ts --edition 2025-01-15 --mode VALIDATE

  # Dry run with synthetic fixtures
  pnpm exec tsx scripts/run-workflow.ts --edition 2025-01-15 --mode DRY_RUN

  # Resume a failed run
  pnpm exec tsx scripts/run-workflow.ts --edition 2025-01-15 --mode RESUME --resume-from wfr_abc123def4

  # Execute (authorized runs only)
  pnpm exec tsx scripts/run-workflow.ts --edition 2025-01-15 --mode EXECUTE

  # Show workflow graph
  pnpm exec tsx scripts/run-workflow.ts --graph

ENVIRONMENT:
  OPENROUTER_API_KEY        OpenRouter API key for free Nemotron models
  TZ                        Timezone (default: Europe/Amsterdam)

NOTE:
  This orchestrator is the CONTROL PLANE only. It coordinates existing
  components (discovery, verification, editorial, publication, evaluation,
  knowledge) without replacing their domain logic.
`);
}

async function printGraph(): Promise<void> {
	const { validateWorkflowGraph } =
		await import("../src/lib/workflow-orchestrator/graph.js");
	const graphValidation = validateWorkflowGraph();
	console.log("Workflow Graph:");
	console.log(`  ID: ai-intelligence-daily-edition-v1`);
	console.log(`  Version: 1.0.0`);
	console.log(`  Stages: 40`);
	console.log(`  Phases: 8`);
	console.log();
	console.log("Phases:");
	console.log("  A: Edition Initialization (5 stages)");
	console.log("  B: Research Discovery (6 stages)");
	console.log("  C: Evidence Preparation (5 stages)");
	console.log("  D: Editorial Decision-Making (3 stages)");
	console.log("  E: Publication Production (6 stages)");
	console.log("  F: Quality Assurance (5 stages)");
	console.log("  G: Knowledge Continuity (4 stages)");
	console.log("  H: Publication Preparation (5 stages)");
	console.log();
	console.log(
		"Validation: " + (graphValidation.valid ? "✅ VALID" : "❌ INVALID"),
	);
	if (graphValidation.warnings.length > 0) {
		console.log("Warnings:");
		for (const w of graphValidation.warnings) {
			console.log(`  ⚠️  ${w}`);
		}
	}
}

async function listStages(): Promise<void> {
	const { ALL_STAGES } =
		await import("../src/lib/workflow-orchestrator/graph.js");
	console.log("Workflow Stages:");
	for (const stage of ALL_STAGES) {
		const deps =
			stage.dependencies
				.filter((d) => d.required)
				.map((d) => d.stageId)
				.join(", ") || "none";
		console.log(`  ${stage.stageId} | ${stage.phase} | ${stage.name}`);
		console.log(`    Deps: ${deps}`);
		console.log(`    Effects: ${stage.sideEffects.join(", ")}`);
		console.log(
			`    Inference: ${stage.inferenceRequirements.required ? "required" : "optional"}`,
		);
	}
}

async function listPhases(): Promise<void> {
	const phases = [
		"PHASE_A_EDITION_INIT",
		"PHASE_B_RESEARCH_DISCOVERY",
		"PHASE_C_EVIDENCE_PREP",
		"PHASE_D_EDITORIAL_DECISION",
		"PHASE_E_PUBLICATION_PRODUCTION",
		"PHASE_F_QUALITY_ASSURANCE",
		"PHASE_G_KNOWLEDGE_CONTINUITY",
		"PHASE_H_PUBLICATION_PREP",
	];
	console.log("Workflow Phases:");
	for (const phase of phases) {
		const { getStagesByPhase } =
			await import("../src/lib/workflow-orchestrator/graph.js");
		const stages = getStagesByPhase(phase as any);
		console.log(`  ${phase} (${stages.length} stages)`);
		for (const stage of stages) {
			console.log(`    ${stage.stageId}: ${stage.name}`);
		}
	}
}

async function main(): Promise<void> {
	const options = parseCliArgs();

	// Validate workflow graph
	const graphValidation = validateWorkflowGraph();
	if (!graphValidation.valid) {
		console.error("Workflow graph validation failed:");
		for (const err of graphValidation.errors) {
			console.error(`  ❌ ${err}`);
		}
		process.exit(1);
	}

	if (graphValidation.warnings.length > 0) {
		console.warn(
			"Workflow graph warnings:",
			graphValidation.warnings.join("; "),
		);
	}

	// Create orchestrator
	let orchestrator: WorkflowOrchestrator;
	try {
		orchestrator = await createWorkflowOrchestrator(options);
	} catch (error) {
		console.error(
			"Failed to initialize orchestrator:",
			(error as Error).message,
		);
		process.exit(1);
	}

	// Run workflow
	let report;
	try {
		report = await orchestrator.run(options.edition);
	} catch (error) {
		console.error("Workflow execution failed:", (error as Error).message);
		if (options.verbose && error instanceof Error) {
			console.error(error.stack);
		}
		await orchestrator.shutdown();
		process.exit(1);
	}

	// Print summary
	console.log("\n" + "=".repeat(60));
	console.log("WORKFLOW EXECUTION SUMMARY");
	console.log("=".repeat(60));
	console.log(`Edition:         ${report.editionId} (${report.editionDate})`);
	console.log(`Mode:            ${report.executionMode}`);
	console.log(`Overall Status:  ${report.overallStatus}`);
	console.log(
		`Duration:        ${report.totalDurationMs ? (report.totalDurationMs / 1000).toFixed(1) + "s" : "N/A"}`,
	);
	console.log(`Stages Run:      ${report.stagesExecuted}`);
	console.log(`  ✅ Succeeded:   ${report.stagesSucceeded}`);
	console.log(`  ❌ Failed:      ${report.stagesFailed}`);
	console.log(`  🚫 Blocked:     ${report.stagesBlocked}`);
	console.log(`  ⏭️  Skipped:      ${report.stagesSkipped}`);
	console.log(`  ⚠️  Incomplete:   ${report.stagesIncomplete}`);

	if (report.resources) {
		console.log("\nResources:");
		console.log(`  Model Requests: ${report.resources.modelRequests}`);
		console.log(`  Tokens Used:    ${report.resources.tokensUsed}`);
		console.log(`  Source Requests: ${report.resources.sourceRequests}`);
		console.log(
			`  CPU Time:       ${(report.resources.totalCpuMs / 1000).toFixed(1)}s`,
		);
		console.log(`  Peak Memory:    ${report.resources.peakMemoryMb} MB`);
	}

	if (report.retries && report.retries.totalAttempts > 0) {
		console.log("\nRetries:");
		console.log(`  Total Attempts: ${report.retries.totalAttempts}`);
		console.log(`  Successful:     ${report.retries.successfulRetries}`);
		console.log(`  Failed:         ${report.retries.failedRetries}`);
	}

	if (report.unresolvedDefects && report.unresolvedDefects.length > 0) {
		console.log("\nUnresolved Defects:");
		for (const defect of report.unresolvedDefects) {
			console.log(
				`  ${defect.blocking ? "🔴" : "🟡"} [${defect.severity}] ${defect.stageId}: ${defect.description}`,
			);
		}
	}

	if (report.blockingFailures && report.blockingFailures.length > 0) {
		console.log("\nBlocking Failures:");
		for (const failure of report.blockingFailures) {
			console.log(
				`  🔴 [${failure.category}] ${failure.stageId}: ${failure.message}`,
			);
		}
	}

	console.log("\n" + "=".repeat(60));

	// Exit code based on outcome
	const exitCode =
		report.overallStatus === "SUCCESS" ||
		report.overallStatus === "PLAN_ONLY" ||
		report.overallStatus === "VALIDATION_ONLY" ||
		report.overallStatus === "DRY_RUN_COMPLETE"
			? 0
			: 1;

	await orchestrator.shutdown();
	process.exit(exitCode);
}

main().catch((error) => {
	console.error("Unexpected error:", error);
	process.exit(1);
});
