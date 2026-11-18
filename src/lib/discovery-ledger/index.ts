/**
 * Discovery Ledger — Module Exports
 */

export * from "./types.ts";
export * from "./ledger.ts";

import { DiscoveryLedger, createDiscoveryLedger } from "./ledger.ts";

const DEFAULT_LEDGER_DIR = "data/discovery-ledger";

function getLedger(input: any): DiscoveryLedger {
	const editionDate = input.editionDate;
	const editionId = `edition_${editionDate}`;
	const ledgerDir = `data/discovery-ledger/${editionId}`;
	return createDiscoveryLedger({ ledgerDir });
}

/**
 * Run Ring 1 — First-Party Discovery
 * Entry point for workflow stage B01_RING1_DISCOVERY
 */
export async function runRing1Discovery(input: any): Promise<any> {
	const ledger = getLedger(input);
	const execution = await ledger.startExecution(input.editionDate, [1], {
		sourceFilter: "ring1",
	});
	// Simulate discovery - in real implementation, this would fetch from sources
	await ledger.completeExecution();
	return { success: true };
}

/**
 * Run Ring 2 — Independent Research Discovery
 * Entry point for workflow stage B02_RING2_DISCOVERY
 */
export async function runRing2Discovery(input: any): Promise<any> {
	const ledger = getLedger(input);
	const execution = await ledger.startExecution(input.editionDate, [2], {
		sourceFilter: "ring2",
	});
	await ledger.completeExecution();
	return { success: true };
}

/**
 * Run Ring 3 — Expert & Community Signal Discovery
 * Entry point for workflow stage B03_RING3_DISCOVERY
 */
export async function runRing3Discovery(input: any): Promise<any> {
	const ledger = getLedger(input);
	const execution = await ledger.startExecution(input.editionDate, [3], {
		sourceFilter: "ring3",
	});
	await ledger.completeExecution();
	return { success: true };
}

/**
 * Verify mandatory coding agent monitoring coverage
 * Entry point for workflow stage B04_MANDATORY_CODING_AGENT_MONITORING
 */
export async function verifyMandatoryCoverage(input: any): Promise<any> {
	const ledger = getLedger(input);
	// Query ledger for mandatory coverage
	const entries = await ledger.query({ editionDate: input.editionDate });
	return { "mandatory-coverage-report": { covered: 0, total: 14 } };
}

/**
 * Persist discovery results and evidence
 * Entry point for workflow stage B05_PERSIST_DISCOVERY_EVIDENCE
 */
export async function persistDiscoveryEvidence(input: any): Promise<any> {
	// Consolidate discovery results from all rings
	// In a real implementation, this would read from the ledger directory
	const consolidatedItems: any[] = [];

	return {
		"consolidated-discovery": { items: consolidatedItems },
		"complete-discovery-ledger": {
			editionDate: input.editionDate,
			rings: ["ring1", "ring2", "ring3"],
			items: consolidatedItems,
			completedAt: new Date().toISOString(),
		},
	};
}

/**
 * Validate discovery coverage and record gaps
 * Entry point for workflow stage B06_VALIDATE_DISCOVERY_COVERAGE
 */
export async function validateCoverage(input: any): Promise<any> {
	const ledger = getLedger(input);
	const stats = await ledger.getStats();
	return { "coverage-report": stats };
}
