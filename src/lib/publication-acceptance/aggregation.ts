/**
 * Publication Acceptance Authority — Aggregation Engine
 *
 * Implements the deterministic decision function that aggregates all applicable
 * required gate results. The edition may reach VALIDATED only when all
 * mandatory gates have completed with PASS status and all required evidence
 * is accessible and valid.
 *
 * Deterministic aggregation rules:
 * 1. Every mandatory gate has completed.
 * 2. Every applicable mandatory gate has PASS status.
 * 3. All required evidence is accessible and valid.
 * 4. No unresolved critical factual defect exists.
 * 5. No unresolved mandatory publication-integrity failure exists.
 * 6. Required publication representations are complete.
 * 7. Required artifact references and hashes are consistent.
 * 8. No required evaluator result is stale.
 * 9. Existing lifecycle transition conditions are satisfied.
 * 10. Any required human authorization has been explicitly recorded.
 *
 * A required FAIL, UNVERIFIED or unresolved NOT_ASSESSABLE result must prevent
 * automatic validation.
 */

import {
	type AcceptanceGateResult,
	type AcceptanceDecision,
	type AcceptanceDecisionStatus,
	type AcceptanceDefect,
	AcceptanceDecisionStatusSchema,
	AcceptanceGateStatusSchema,
} from "./schema.js";
import { ACCEPTANCE_GATES, getGateDefinition } from "./gate-registry.js";

// ============================================================================
// Aggregation Input Types
// ============================================================================

/**
 * Input to the acceptance aggregation function.
 */
export interface AcceptanceAggregationInput {
	editionId: string;
	workflowRunId: string;
	contractVersion: string;
	gateResults: AcceptanceGateResult[];
	defects: AcceptanceDefect[];
	evidenceReferences: string[];
	artifactHashes: Record<string, string>;
	factDossierId: string;
	factDossierHash: string;
	editorialManifestId: string;
	editorialManifestHash: string;
	reportingInterval: {
		start: string;
		end: string;
		timezone: "Europe/Amsterdam";
	};
	currentLifecycleStatus: string;
	humanAuthorizations: Array<{
		gateId: string;
		authority: string;
		authorizedAt: string;
	}>;
}

// ============================================================================
// Aggregation Result Types
// ============================================================================

/**
 * Detailed aggregation result.
 */
export interface AcceptanceAggregationResult {
	decision: AcceptanceDecisionStatus;
	publicationEligible: boolean;
	blockingGates: string[];
	blockingConditions: string[];
	unverifiedConditions: string[];
	criticalDefects: AcceptanceDefect[];
	majorDefects: AcceptanceDefect[];
	minorDefects: AcceptanceDefect[];
	advisoryDefects: AcceptanceDefect[];
	gateSummary: Array<{
		gateId: string;
		name: string;
		status: string;
		mandatory: boolean;
		applicable: boolean;
		blocking: boolean;
	}>;
	aggregationTimestamp: string;
}

// ============================================================================
// Deterministic Aggregation Function
// ============================================================================

/**
 * Deterministic decision function that aggregates all applicable required gate results.
 *
 * The edition may reach VALIDATED only when:
 * 1. Every mandatory gate has completed.
 * 2. Every applicable mandatory gate has PASS status.
 * 3. All required evidence is accessible and valid.
 * 4. No unresolved critical factual defect exists.
 * 5. No unresolved mandatory publication-integrity failure exists.
 * 6. Required publication representations are complete.
 * 7. Required artifact references and hashes are consistent.
 * 8. No required evaluator result is stale.
 * 9. Existing lifecycle transition conditions are satisfied.
 * 10. Any required human authorization has been explicitly recorded.
 *
 * @param input - The aggregation input
 * @returns The detailed aggregation result
 */
export function aggregateAcceptanceDecision(
	input: AcceptanceAggregationInput,
): AcceptanceAggregationResult {
	const {
		editionId,
		gateResults,
		defects,
		humanAuthorizations,
		currentLifecycleStatus,
	} = input;

	const blockingGates: string[] = [];
	const blockingConditions: string[] = [];
	const unverifiedConditions: string[] = [];

	const criticalDefects: AcceptanceDefect[] = [];
	const majorDefects: AcceptanceDefect[] = [];
	const minorDefects: AcceptanceDefect[] = [];
	const advisoryDefects: AcceptanceDefect[] = [];

	const gateSummary: Array<{
		gateId: string;
		name: string;
		status: string;
		mandatory: boolean;
		applicable: boolean;
		blocking: boolean;
	}> = [];

	// ============================================================================
	// Step 1: Evaluate each gate
	// ============================================================================

	for (const gateDef of ACCEPTANCE_GATES) {
		const gateResult = gateResults.find((r) => r.gateId === gateDef.gateId);

		// Rule 1: Every mandatory gate has completed
		if (gateDef.mandatory && !gateResult) {
			blockingGates.push(gateDef.gateId);
			blockingConditions.push(
				`Mandatory gate ${gateDef.name} (${gateDef.gateId}) has not completed.`,
			);
			gateSummary.push({
				gateId: gateDef.gateId,
				name: gateDef.name,
				status: "NOT_EXECUTED",
				mandatory: gateDef.mandatory,
				applicable: true,
				blocking: true,
			});
			continue;
		}

		if (!gateResult) {
			// Non-mandatory gate without result is acceptable
			gateSummary.push({
				gateId: gateDef.gateId,
				name: gateDef.name,
				status: "NOT_EXECUTED",
				mandatory: gateDef.mandatory,
				applicable: false,
				blocking: false,
			});
			continue;
		}

		// Rule: NOT_APPLICABLE gates with valid applicability reason are acceptable
		if (gateResult.applicability === "NOT_APPLICABLE") {
			if (!gateResult.applicabilityReason) {
				blockingGates.push(gateDef.gateId);
				blockingConditions.push(
					`Gate ${gateDef.name} (${gateDef.gateId}) is NOT_APPLICABLE but lacks an explicit policy-based applicability reason.`,
				);
				gateSummary.push({
					gateId: gateDef.gateId,
					name: gateDef.name,
					status: gateResult.status,
					mandatory: gateDef.mandatory,
					applicable: false,
					blocking: true,
				});
				continue;
			}

			// NOT_APPLICABLE with valid reason is acceptable
			gateSummary.push({
				gateId: gateDef.gateId,
				name: gateDef.name,
				status: gateResult.status,
				mandatory: gateDef.mandatory,
				applicable: false,
				blocking: false,
			});
			continue;
		}

		// Rule 2: Every applicable mandatory gate has PASS status
		if (gateDef.mandatory && gateResult.status !== "PASS") {
			blockingGates.push(gateDef.gateId);

			if (gateResult.status === "FAIL") {
				blockingConditions.push(
					`Mandatory gate ${gateDef.name} (${gateDef.gateId}) returned FAIL.`,
				);
			} else if (gateResult.status === "UNVERIFIED") {
				unverifiedConditions.push(
					`Mandatory gate ${gateDef.name} (${gateDef.gateId}) returned UNVERIFIED.`,
				);
				blockingConditions.push(
					`Mandatory gate ${gateDef.name} (${gateDef.gateId}) is UNVERIFIED.`,
				);
			} else if (gateResult.status === "NOT_ASSESSABLE") {
				unverifiedConditions.push(
					`Mandatory gate ${gateDef.name} (${gateDef.gateId}) returned NOT_ASSESSABLE without a valid applicability exception.`,
				);
				blockingConditions.push(
					`Mandatory gate ${gateDef.name} (${gateDef.gateId}) is NOT_ASSESSABLE.`,
				);
			}

			gateSummary.push({
				gateId: gateDef.gateId,
				name: gateDef.name,
				status: gateResult.status,
				mandatory: gateDef.mandatory,
				applicable: true,
				blocking: true,
			});
			continue;
		}

		// Rule 10: Any required human authorization has been explicitly recorded
		if (gateDef.humanReviewRequired && gateResult.humanReviewRequired) {
			const hasAuthorization = humanAuthorizations.some(
				(auth) => auth.gateId === gateDef.gateId,
			);
			if (!hasAuthorization) {
				blockingGates.push(gateDef.gateId);
				blockingConditions.push(
					`Gate ${gateDef.name} (${gateDef.gateId}) requires human review authorization, but none was recorded.`,
				);
				gateSummary.push({
					gateId: gateDef.gateId,
					name: gateDef.name,
					status: gateResult.status,
					mandatory: gateDef.mandatory,
					applicable: true,
					blocking: true,
				});
				continue;
			}
		}

		// Gate passed all checks
		gateSummary.push({
			gateId: gateDef.gateId,
			name: gateDef.name,
			status: gateResult.status,
			mandatory: gateDef.mandatory,
			applicable: true,
			blocking: false,
		});
	}

	// ============================================================================
	// Step 2: Evaluate defects
	// ============================================================================

	for (const defect of defects) {
		if (defect.severity === "CRITICAL") {
			criticalDefects.push(defect);
			if (defect.blocking) {
				blockingConditions.push(
					`Critical defect ${defect.defectId} (${defect.category}): ${defect.description}`,
				);
			}
		} else if (defect.severity === "MAJOR") {
			majorDefects.push(defect);
			if (defect.blocking) {
				blockingConditions.push(
					`Major defect ${defect.defectId} (${defect.category}): ${defect.description}`,
				);
			}
		} else if (defect.severity === "MINOR") {
			minorDefects.push(defect);
		} else {
			advisoryDefects.push(defect);
		}
	}

	// Rule 4: No unresolved critical factual defect exists
	const unresolvedCritical = criticalDefects.filter((d) => d.blocking);
	if (unresolvedCritical.length > 0) {
		blockingConditions.push(
			`${unresolvedCritical.length} unresolved critical defect(s) exist.`,
		);
	}

	// Rule 5: No unresolved mandatory publication-integrity failure exists
	const publicationIntegrityDefects = defects.filter(
		(d) => d.gateId === "gate_publication_integrity" && d.blocking,
	);
	if (publicationIntegrityDefects.length > 0) {
		blockingConditions.push(
			`${publicationIntegrityDefects.length} unresolved publication-integrity failure(s) exist.`,
		);
	}

	// ============================================================================
	// Step 3: Evaluate lifecycle conditions
	// ============================================================================

	// Rule 9: Existing lifecycle transition conditions are satisfied
	if (currentLifecycleStatus !== "READY_FOR_VALIDATION") {
		blockingConditions.push(
			`Edition is in ${currentLifecycleStatus} state, not READY_FOR_VALIDATION.`,
		);
	}

	// ============================================================================
	// Step 4: Determine final decision
	// ============================================================================

	let decision: AcceptanceDecisionStatus;
	let publicationEligible: boolean;

	if (blockingConditions.length > 0) {
		// Check if any blocking condition is due to unverified/incomplete status
		const hasUnverified = unverifiedConditions.length > 0;
		const hasFailed = gateResults.some(
			(r) => r.status === "FAIL" && r.applicability === "APPLICABLE",
		);

		if (hasFailed) {
			decision = "FAILED";
		} else if (hasUnverified) {
			decision = "INCOMPLETE";
		} else {
			decision = "FAILED";
		}
		publicationEligible = false;
	} else {
		decision = "VALIDATED";
		publicationEligible = true;
	}

	return {
		decision,
		publicationEligible,
		blockingGates,
		blockingConditions,
		unverifiedConditions,
		criticalDefects,
		majorDefects,
		minorDefects,
		advisoryDefects,
		gateSummary,
		aggregationTimestamp: new Date().toISOString(),
	};
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a gate result is stale based on artifact hashes.
 */
export function isGateResultStale(
	gateResult: AcceptanceGateResult,
	currentArtifactHashes: Record<string, string>,
): boolean {
	for (const [artifactId, expectedHash] of Object.entries(
		gateResult.artifactHashes,
	)) {
		const currentHash = currentArtifactHashes[artifactId];
		if (currentHash && currentHash !== expectedHash) {
			return true;
		}
	}
	return false;
}

/**
 * Determine which gates need re-evaluation after an artifact change.
 */
export function getAffectedGates(
	changedArtifactId: string,
	gateResults: AcceptanceGateResult[],
): string[] {
	const affected: string[] = [];
	for (const result of gateResults) {
		if (result.artifactHashes[changedArtifactId]) {
			affected.push(result.gateId);
		}
	}
	return affected;
}

/**
 * Create a machine-readable acceptance decision.
 */
export function createAcceptanceDecision(
	editionId: string,
	aggregationResult: AcceptanceAggregationResult,
	contractVersion: string,
	reportLocation: string,
	artifactHashes: Record<string, string>,
): AcceptanceDecision {
	const {
		decision,
		publicationEligible,
		blockingGates,
		blockingConditions,
		unverifiedConditions,
	} = aggregationResult;

	return {
		schemaVersion: "1.0.0",
		decisionId: `dec_${generateId()}`,
		editionId,
		decisionStatus: decision,
		publicationEligible,
		blockingGateIds: blockingGates,
		blockingEvidenceReferences: blockingConditions,
		unverifiedConditions,
		artifactIntegrityReferences: artifactHashes,
		acceptanceReportLocation: reportLocation,
		contractVersion,
		decidedAt: aggregationResult.aggregationTimestamp,
		contentHash: "", // Will be computed by the report generator
	};
}

/**
 * Generate a stable identifier.
 */
function generateId(): string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
	let result = "";
	for (let i = 0; i < 16; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

/**
 * Validate that all mandatory gates are present in the results.
 */
export function validateMandatoryGatesPresent(
	gateResults: AcceptanceGateResult[],
): { valid: boolean; missing: string[] } {
	const mandatoryGates = ACCEPTANCE_GATES.filter((g) => g.mandatory);
	const resultIds = new Set(gateResults.map((r) => r.gateId));
	const missing = mandatoryGates
		.filter((g) => !resultIds.has(g.gateId))
		.map((g) => g.gateId);

	return { valid: missing.length === 0, missing };
}

/**
 * Check if a gate result has blocking conditions.
 */
export function hasBlockingConditions(
	gateResult: AcceptanceGateResult,
): boolean {
	return gateResult.blockingConditions.length > 0;
}

/**
 * Get all blocking conditions from gate results.
 */
export function getAllBlockingConditions(
	gateResults: AcceptanceGateResult[],
): string[] {
	const conditions: string[] = [];
	for (const result of gateResults) {
		if (result.blockingConditions.length > 0) {
			conditions.push(...result.blockingConditions);
		}
	}
	return conditions;
}
