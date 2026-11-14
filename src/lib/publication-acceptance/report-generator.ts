/**
 * Publication Acceptance Authority — Report Generator
 *
 * Generates structured, persistent acceptance reports and machine-readable
 * acceptance decisions. Handles persistence, readback verification, and
 * content hash computation.
 */

import { createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
	type AcceptanceReport,
	type AcceptanceDecision,
	AcceptanceReportSchema,
	AcceptanceDecisionSchema,
} from "./schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..", "..");

/** Default directory for acceptance reports. */
export const DEFAULT_ACCEPTANCE_DIR = "data/acceptance-reports";

/**
 * Compute SHA-256 content hash of an object.
 */
export function computeContentHash(obj: unknown): string {
	const content = JSON.stringify(obj, Object.keys(obj as object).sort());
	return `sha256:${createHash("sha-256").update(content).digest("hex")}`;
}

/**
 * Canonical JSON stringify with sorted keys at all levels for deterministic hashing.
 */
export function canonicalStringify(obj: Record<string, unknown>): string {
	return JSON.stringify(
		obj,
		(key, value) => {
			if (value && typeof value === "object" && !Array.isArray(value)) {
				return Object.fromEntries(
					Object.entries(value).sort(([a], [b]) =>
						a.localeCompare(b),
					),
				);
			}
			return value;
		},
		2,
	);
}

/**
 * Compute SHA-256 hash of an object (canonical JSON with sorted keys).
 */
export function computeObjectHash(obj: Record<string, unknown>): string {
	const canonical = canonicalStringify(obj);
	return `sha256:${createHash("sha-256").update(canonical).digest("hex")}`;
}

/**
 * Generate a stable acceptance report ID.
 */
export function generateReportId(): string {
	return `acc_${randomBytes(8).toString("hex")}`;
}

/**
 * Generate a stable acceptance decision ID.
 */
export function generateDecisionId(): string {
	return `dec_${randomBytes(8).toString("hex")}`;
}

/**
 * Finalize an acceptance report by computing its content hash.
 */
export function finalizeReport(report: AcceptanceReport): AcceptanceReport {
	const { contentHash: _unused, ...reportWithoutHash } = report;
	const contentHash = computeObjectHash(
		reportWithoutHash as unknown as Record<string, unknown>,
	);
	return { ...report, contentHash };
}

/**
 * Finalize an acceptance decision by computing its content hash.
 */
export function finalizeDecision(
	decision: AcceptanceDecision,
): AcceptanceDecision {
	const { contentHash: _unused, ...decisionWithoutHash } = decision;
	const contentHash = computeObjectHash(
		decisionWithoutHash as unknown as Record<string, unknown>,
	);
	return { ...decision, contentHash };
}

/**
 * Persist an acceptance report to disk.
 */
export async function persistAcceptanceReport(
	report: AcceptanceReport,
	outputDir: string = DEFAULT_ACCEPTANCE_DIR,
): Promise<{ reportPath: string; contentHash: string }> {
	const dir = join(PROJECT_ROOT, outputDir);
	await fs.mkdir(dir, { recursive: true });

	const reportPath = join(dir, `${report.editionId}_${report.reportId}.json`);

	// Finalize report with content hash
	const finalizedReport = finalizeReport(report);

	// Atomic write
	const tempPath = `${reportPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
	await fs.writeFile(
		tempPath,
		canonicalStringify(
			finalizedReport as unknown as Record<string, unknown>,
		),
		"utf-8",
	);
	await fs.rename(tempPath, reportPath);

	// Readback verification
	const savedContent = await fs.readFile(reportPath, "utf-8");
	const savedReport = JSON.parse(savedContent) as AcceptanceReport;

	// Verify content hash
	const { contentHash: savedHash, ...savedWithoutHash } = savedReport;
	const verifiedHash = computeObjectHash(
		savedWithoutHash as unknown as Record<string, unknown>,
	);

	if (verifiedHash !== savedHash) {
		throw new Error(
			`Readback verification failed for acceptance report ${report.editionId}: ` +
				`content hash mismatch (expected: ${savedHash}, actual: ${verifiedHash})`,
		);
	}

	return { reportPath, contentHash: savedHash };
}

/**
 * Persist an acceptance decision to disk.
 */
export async function persistAcceptanceDecision(
	decision: AcceptanceDecision,
	outputDir: string = DEFAULT_ACCEPTANCE_DIR,
): Promise<{ decisionPath: string; contentHash: string }> {
	const dir = join(PROJECT_ROOT, outputDir);
	await fs.mkdir(dir, { recursive: true });

	const decisionPath = join(
		dir,
		`${decision.editionId}_${decision.decisionId}.decision.json`,
	);

	// Finalize decision with content hash
	const finalizedDecision = finalizeDecision(decision);

	// Atomic write
	const tempPath = `${decisionPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
	await fs.writeFile(
		tempPath,
		canonicalStringify(
			finalizedDecision as unknown as Record<string, unknown>,
		),
		"utf-8",
	);
	await fs.rename(tempPath, decisionPath);

	// Readback verification
	const savedContent = await fs.readFile(decisionPath, "utf-8");
	const savedDecision = JSON.parse(savedContent) as AcceptanceDecision;

	// Verify content hash
	const { contentHash: savedHash, ...savedWithoutHash } = savedDecision;
	const verifiedHash = computeObjectHash(
		savedWithoutHash as unknown as Record<string, unknown>,
	);

	if (verifiedHash !== savedHash) {
		throw new Error(
			`Readback verification failed for acceptance decision ${decision.editionId}: ` +
				`content hash mismatch (expected: ${savedHash}, actual: ${verifiedHash})`,
		);
	}

	return { decisionPath, contentHash: savedHash };
}

/**
 * Read and validate an acceptance report from disk.
 */
export async function readAcceptanceReport(
	reportPath: string,
): Promise<AcceptanceReport> {
	const fullPath = join(PROJECT_ROOT, reportPath);
	const content = await fs.readFile(fullPath, "utf-8");
	const parsed = JSON.parse(content);
	return AcceptanceReportSchema.parse(parsed);
}

/**
 * Read and validate an acceptance decision from disk.
 */
export async function readAcceptanceDecision(
	decisionPath: string,
): Promise<AcceptanceDecision> {
	const fullPath = join(PROJECT_ROOT, decisionPath);
	const content = await fs.readFile(fullPath, "utf-8");
	const parsed = JSON.parse(content);
	return AcceptanceDecisionSchema.parse(parsed);
}

/**
 * Generate a human-readable summary of the acceptance report.
 */
export function generateHumanReadableSummary(report: AcceptanceReport): string {
	const lines: string[] = [];

	lines.push("=".repeat(70));
	lines.push("PUBLICATION ACCEPTANCE REPORT");
	lines.push("=".repeat(70));
	lines.push("");
	lines.push(`Edition:           ${report.editionId}`);
	lines.push(`Workflow Run:      ${report.workflowRunId}`);
	lines.push(`Contract Version:  ${report.acceptanceContractVersion}`);
	lines.push(`Acceptance Time:   ${report.acceptanceTimestamp}`);
	lines.push("");
	lines.push(
		`Reporting Interval: ${report.reportingInterval.start} → ${report.reportingInterval.end}`,
	);
	lines.push(`Timezone:          ${report.reportingInterval.timezone}`);
	lines.push("");
	lines.push("-".repeat(70));
	lines.push(`OVERALL DECISION: ${report.overallDecision}`);
	lines.push("-".repeat(70));
	lines.push("");
	lines.push(
		`Deployment Eligible: ${report.deploymentEligible ? "YES" : "NO"}`,
	);
	lines.push(`Lifecycle State:     ${report.publicationLifecycleState}`);
	lines.push("");

	// Gate results
	lines.push("GATE RESULTS:");
	lines.push("-".repeat(70));
	for (const result of report.gateResults) {
		const statusIcon =
			result.status === "PASS"
				? "✓"
				: result.status === "FAIL"
					? "✗"
					: "?";
		const mandatoryFlag = result.mandatory ? "[MANDATORY]" : "[OPTIONAL]";
		lines.push(`  ${statusIcon} ${result.name} ${mandatoryFlag}`);
		lines.push(
			`    Status: ${result.status} | Applicability: ${result.applicability}`,
		);
		if (result.blockingConditions.length > 0) {
			lines.push(`    Blocking Conditions:`);
			for (const condition of result.blockingConditions) {
				lines.push(`      - ${condition}`);
			}
		}
		if (result.residualUncertainty) {
			lines.push(
				`    Residual Uncertainty: ${result.residualUncertainty}`,
			);
		}
		lines.push("");
	}

	// Defects
	if (report.criticalAndMajorDefects.length > 0) {
		lines.push("CRITICAL AND MAJOR DEFECTS:");
		lines.push("-".repeat(70));
		for (const defect of report.criticalAndMajorDefects) {
			lines.push(`  [${defect.severity}] ${defect.defectId}`);
			lines.push(`    Category: ${defect.category}`);
			lines.push(`    Description: ${defect.description}`);
			lines.push(`    Responsible: ${defect.responsibleComponent}`);
			lines.push(`    Remediation: ${defect.remediationRecommendation}`);
			lines.push("");
		}
	}

	// Unverified requirements
	if (report.unverifiedRequirements.length > 0) {
		lines.push("UNVERIFIED REQUIREMENTS:");
		lines.push("-".repeat(70));
		for (const req of report.unverifiedRequirements) {
			lines.push(`  - ${req}`);
		}
		lines.push("");
	}

	// Unresolved manual review
	if (report.unresolvedManualReview.length > 0) {
		lines.push("UNRESOLVED MANUAL REVIEW:");
		lines.push("-".repeat(70));
		for (const review of report.unresolvedManualReview) {
			lines.push(`  - ${review}`);
		}
		lines.push("");
	}

	// Rejection reasons
	if (report.rejectionReasons.length > 0) {
		lines.push("REJECTION REASONS:");
		lines.push("-".repeat(70));
		for (const reason of report.rejectionReasons) {
			lines.push(`  - ${reason}`);
		}
		lines.push("");
	}

	// Artifact hashes
	lines.push("ARTIFACT HASHES:");
	lines.push("-".repeat(70));
	for (const [artifactId, hash] of Object.entries(report.artifactHashes)) {
		lines.push(`  ${artifactId}: ${hash}`);
	}
	lines.push("");

	// Persistence
	lines.push("PERSISTENCE:");
	lines.push("-".repeat(70));
	lines.push(
		`  Persisted: ${report.persistenceReadback.persisted ? "YES" : "NO"}`,
	);
	lines.push(
		`  Readback Verified: ${report.persistenceReadback.readbackVerified ? "YES" : "NO"}`,
	);
	if (report.persistenceReadback.reportPath) {
		lines.push(`  Report Path: ${report.persistenceReadback.reportPath}`);
	}
	lines.push("");

	lines.push("=".repeat(70));
	lines.push(`Report ID: ${report.reportId}`);
	lines.push(`Content Hash: ${report.contentHash}`);
	lines.push("=".repeat(70));

	return lines.join("\n");
}

/**
 * Generate a concise human-readable summary for the acceptance decision.
 */
export function generateDecisionSummary(decision: AcceptanceDecision): string {
	const lines: string[] = [];

	lines.push("PUBLICATION ACCEPTANCE DECISION");
	lines.push("=".repeat(50));
	lines.push(`Edition:              ${decision.editionId}`);
	lines.push(`Decision:             ${decision.decisionStatus}`);
	lines.push(
		`Publication Eligible: ${decision.publicationEligible ? "YES" : "NO"}`,
	);
	lines.push(`Contract Version:     ${decision.contractVersion}`);
	lines.push(`Decided At:           ${decision.decidedAt}`);
	lines.push("");

	if (decision.blockingGateIds.length > 0) {
		lines.push("BLOCKING GATES:");
		for (const gateId of decision.blockingGateIds) {
			lines.push(`  - ${gateId}`);
		}
		lines.push("");
	}

	if (decision.blockingEvidenceReferences.length > 0) {
		lines.push("BLOCKING CONDITIONS:");
		for (const condition of decision.blockingEvidenceReferences) {
			lines.push(`  - ${condition}`);
		}
		lines.push("");
	}

	if (decision.unverifiedConditions.length > 0) {
		lines.push("UNVERIFIED CONDITIONS:");
		for (const condition of decision.unverifiedConditions) {
			lines.push(`  - ${condition}`);
		}
		lines.push("");
	}

	lines.push(`Report Location:      ${decision.acceptanceReportLocation}`);
	lines.push(`Decision ID:          ${decision.decisionId}`);
	lines.push(`Content Hash:         ${decision.contentHash}`);

	return lines.join("\n");
}
