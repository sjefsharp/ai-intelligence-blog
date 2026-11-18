#!/usr/bin/env tsx
/**
 * Scheduler Configuration Validator
 *
 * Validates the scheduler configuration against the schema and performs
 * additional runtime checks for the scheduling mechanism.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
	validateSchedulerConfig,
	createDefaultSchedulerConfig,
} from "../src/lib/scheduler/schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");
const CONFIG_PATH = join(PROJECT_ROOT, "data", "scheduler", "config.json");

interface ValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
}

function validateConfigFile(): ValidationResult {
	const result: ValidationResult = { valid: true, errors: [], warnings: [] };

	try {
		const configContent = readFileSync(CONFIG_PATH, "utf-8");
		const config = JSON.parse(configContent);
		const validation = validateSchedulerConfig(config);

		if (!validation.valid) {
			result.valid = false;
			result.errors.push(...validation.errors);
		} else {
			const cfg = validation.config!;

			// Additional runtime checks
			if (cfg.state !== "DISABLED") {
				result.warnings.push(
					`Scheduler state is ${cfg.state}, expected DISABLED for step 108`,
				);
			}

			if (cfg.activationGuard.schedulerEnabled) {
				result.errors.push(
					"Activation guard schedulerEnabled is true — must be false for step 108",
				);
				result.valid = false;
			}

			if (cfg.activationGuard.publicationAuthorized) {
				result.errors.push(
					"Activation guard publicationAuthorized is true — must be false for step 108",
				);
				result.valid = false;
			}

			if (cfg.activationGuard.deploymentAuthorized) {
				result.errors.push(
					"Activation guard deploymentAuthorized is true — must be false for step 108",
				);
				result.valid = false;
			}

			if (cfg.deploymentAuthorization !== "NOT_GRANTED") {
				result.errors.push(
					`Deployment authorization is ${cfg.deploymentAuthorization}, expected NOT_GRANTED`,
				);
				result.valid = false;
			}

			if (cfg.publicationAuthorization !== "NOT_GRANTED") {
				result.errors.push(
					`Publication authorization is ${cfg.publicationAuthorization}, expected NOT_GRANTED`,
				);
				result.valid = false;
			}

			// Check schedule expression
			if (cfg.schedule.timezone !== "Europe/Amsterdam") {
				result.errors.push(
					`Schedule timezone is ${cfg.schedule.timezone}, expected Europe/Amsterdam`,
				);
				result.valid = false;
			}

			if (cfg.schedule.hour !== 5 || cfg.schedule.minute !== 0) {
				result.errors.push(
					`Schedule time is ${cfg.schedule.hour}:${cfg.schedule.minute}, expected 05:00`,
				);
				result.valid = false;
			}

			if (cfg.schedule.frequency !== "daily") {
				result.errors.push(
					`Schedule frequency is ${cfg.schedule.frequency}, expected daily`,
				);
				result.valid = false;
			}

			// Check reporting window
			if (cfg.reportingWindow.timezone !== "Europe/Amsterdam") {
				result.errors.push(
					`Reporting window timezone is ${cfg.reportingWindow.timezone}, expected Europe/Amsterdam`,
				);
				result.valid = false;
			}

			if (cfg.reportingWindow.windowHour !== 5) {
				result.errors.push(
					`Reporting window hour is ${cfg.reportingWindow.windowHour}, expected 5`,
				);
				result.valid = false;
			}

			// Check free-only enforcement
			if (!cfg.resourcePolicy.freeOnlyInference) {
				result.errors.push(
					"Resource policy freeOnlyInference is false — must be true",
				);
				result.valid = false;
			}

			if (cfg.resourcePolicy.maxCostUsd !== 0) {
				result.errors.push(
					`Resource policy maxCostUsd is ${cfg.resourcePolicy.maxCostUsd}, must be 0`,
				);
				result.valid = false;
			}

			// Check no paid fallback
			if (!cfg.failurePolicy.noPaidFallback) {
				result.errors.push(
					"Failure policy noPaidFallback is false — must be true",
				);
				result.valid = false;
			}

			// Check concurrency
			if (cfg.concurrencyPolicy.maxPerEdition !== 1) {
				result.errors.push(
					`Concurrency maxPerEdition is ${cfg.concurrencyPolicy.maxPerEdition}, must be 1`,
				);
				result.valid = false;
			}

			// Check missed run policy
			if (cfg.missedRunPolicy.autoBackfill) {
				result.errors.push(
					"Missed run policy autoBackfill is true — must be false",
				);
				result.valid = false;
			}

			// Check mechanism
			if (cfg.mechanism !== "systemd-user-timer") {
				result.warnings.push(
					`Mechanism is ${cfg.mechanism}, expected systemd-user-timer`,
				);
			}

			// Check working directory
			if (cfg.workingDirectory !== PROJECT_ROOT) {
				result.warnings.push(
					`Working directory differs from project root`,
				);
			}
		}
	} catch (error) {
		result.valid = false;
		result.errors.push(
			`Failed to read/parse config: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	return result;
}

async function validateSystemdUnits(): Promise<ValidationResult> {
	const result: ValidationResult = { valid: true, errors: [], warnings: [] };

	const servicePath = join(
		PROJECT_ROOT,
		"scripts",
		"scheduler",
		"ai-intelligence-daily.service",
	);
	const timerPath = join(
		PROJECT_ROOT,
		"scripts",
		"scheduler",
		"ai-intelligence-daily.timer",
	);
	const wrapperPath = join(
		PROJECT_ROOT,
		"scripts",
		"scheduler",
		"run-daily-edition.sh",
	);

	// Check files exist
	for (const [name, path] of [
		["service unit", servicePath],
		["timer unit", timerPath],
		["wrapper script", wrapperPath],
	] as const) {
		try {
			const content = readFileSync(path, "utf-8");
			if (name === "wrapper script") {
				// Check executable
				const { statSync } = await import("fs");
				const stats = statSync(path);
				if (!(stats.mode & 0o111)) {
					result.warnings.push(`${name} is not executable`);
				}
			}
		} catch {
			result.errors.push(`${name} not found at ${path}`);
			result.valid = false;
		}
	}

	// Validate timer unit has correct schedule
	try {
		const timerContent = readFileSync(timerPath, "utf-8");
		if (
			!timerContent.includes("OnCalendar=*-*-* 05:00:00 Europe/Amsterdam")
		) {
			result.errors.push(
				"Timer unit does not have correct OnCalendar expression",
			);
			result.valid = false;
		}
		if (timerContent.includes("Persistent=true")) {
			result.warnings.push(
				"Timer unit has Persistent=true — may cause catch-up on boot",
			);
		}
	} catch {
		// Already reported
	}

	// Validate service unit
	try {
		const serviceContent = readFileSync(servicePath, "utf-8");
		if (!serviceContent.includes("EDITION_SCHEDULER_ENABLED=false")) {
			result.errors.push(
				"Service unit does not have EDITION_SCHEDULER_ENABLED=false",
			);
			result.valid = false;
		}
		if (!serviceContent.includes("EDITION_DEPLOYMENT_AUTHORIZED=false")) {
			result.errors.push(
				"Service unit does not have EDITION_DEPLOYMENT_AUTHORIZED=false",
			);
			result.valid = false;
		}
		if (!serviceContent.includes("EDITION_PUBLICATION_AUTHORIZED=false")) {
			result.errors.push(
				"Service unit does not have EDITION_PUBLICATION_AUTHORIZED=false",
			);
			result.valid = false;
		}
		if (!serviceContent.includes("ProtectSystem=strict")) {
			result.warnings.push("Service unit missing ProtectSystem=strict");
		}
		if (!serviceContent.includes("NoNewPrivileges=true")) {
			result.warnings.push("Service unit missing NoNewPrivileges=true");
		}
	} catch {
		// Already reported
	}

	return result;
}

async function main(): Promise<void> {
	console.log("=== Scheduler Configuration Validation ===\n");

	const configResult = validateConfigFile();
	const systemdResult = await validateSystemdUnits();

	console.log("--- Config File Validation ---");
	if (configResult.valid) {
		console.log("✅ Config file valid");
	} else {
		console.log("❌ Config file invalid");
	}
	for (const err of configResult.errors) {
		console.log(`  ERROR: ${err}`);
	}
	for (const warn of configResult.warnings) {
		console.log(`  WARN: ${warn}`);
	}

	console.log("\n--- Systemd Units Validation ---");
	if (systemdResult.valid) {
		console.log("✅ Systemd units valid");
	} else {
		console.log("❌ Systemd units invalid");
	}
	for (const err of systemdResult.errors) {
		console.log(`  ERROR: ${err}`);
	}
	for (const warn of systemdResult.warnings) {
		console.log(`  WARN: ${warn}`);
	}

	const overallValid = configResult.valid && systemdResult.valid;
	console.log(
		`\n=== Overall: ${overallValid ? "✅ VALID" : "❌ INVALID"} ===`,
	);

	process.exit(overallValid ? 0 : 1);
}

main().catch((error) => {
	console.error("Validation failed:", error);
	process.exit(1);
});
