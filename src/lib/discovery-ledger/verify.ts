/**
 * Discovery Ledger — Mandatory Coverage Verification
 *
 * Verifies that all mandatory monitoring targets (coding agents, developer tools)
 * have been checked in the current edition's discovery ledger.
 */

import type {
	DiscoveryLedgerEntry,
	SourceMonitoringRecord,
	CriticalityLevel,
} from "./types.js";

/**
 * Result of mandatory coverage verification
 */
export interface MandatoryCoverageReport {
	verified: boolean;
	mandatorySources: {
		sourceId: string;
		sourceFamily: string;
		organization: string;
		status:
			| "CHECKED_FOUND"
			| "CHECKED_NONE"
			| "INACCESSIBLE"
			| "NOT_CHECKED"
			| "ERROR";
		checked: boolean;
	}[];
	uncheckedMandatory: string[];
	verifiedAt: string;
}

/**
 * Verify Mandatory Coverage (B04_MANDATORY_CODING_AGENT_MONITORING).
 * Checks that all mandatory coding agent and developer tool monitoring targets
 * have been checked in the current edition's discovery ledger.
 */
export async function verifyMandatoryCoverage(input: {
	editionDate: string;
	ledgerEntry: DiscoveryLedgerEntry;
}): Promise<MandatoryCoverageReport> {
	const { editionDate, ledgerEntry } = input;

	// Handle missing or malformed ledger entry
	if (
		!ledgerEntry ||
		!ledgerEntry.sourceRecords ||
		!Array.isArray(ledgerEntry.sourceRecords)
	) {
		return {
			verified: false,
			mandatorySources: [],
			uncheckedMandatory: ["NO_SOURCE_RECORDS_IN_LEDGER"],
			verifiedAt: new Date().toISOString(),
			error: "Ledger entry missing or has no sourceRecords array",
		};
	}

	// Find all mandatory sources in the ledger
	const mandatorySources = ledgerEntry.sourceRecords.filter(
		(record) => record.criticality === "mandatory",
	);

	// Check each mandatory source
	const checkedMandatory = mandatorySources.map((record) => ({
		sourceId: record.sourceId,
		sourceFamily: record.sourceFamily,
		organization: record.organization,
		status: record.status,
		checked: record.status !== "NOT_CHECKED",
	}));

	// Find unchecked mandatory sources
	const uncheckedMandatory = checkedMandatory
		.filter((m) => !m.checked)
		.map((m) => m.sourceId);

	// All mandatory sources must be checked (not NOT_CHECKED)
	const verified = uncheckedMandatory.length === 0;

	return {
		verified,
		mandatorySources: checkedMandatory,
		uncheckedMandatory,
		verifiedAt: new Date().toISOString(),
	};
}

/**
 * Standalone function for workflow stage B04.
 * Loads the latest ledger entry for the edition and verifies mandatory coverage.
 */
export async function verifyMandatoryCoverageWrapper(input: any): Promise<any> {
	const { readFileSync, readdirSync } = await import("fs");
	const { join } = await import("path");

	const editionDate = input.editionDate;
	const ledgerDir = "data/discovery-ledger";

	// Load the most recent ledger entry for this edition
	let ledgerEntry: any = null;
	try {
		const files = readdirSync(ledgerDir)
			.filter(
				(f) => f.startsWith(`${editionDate}_`) && f.endsWith(".json"),
			)
			.sort()
			.reverse(); // Most recent first

		if (files.length > 0) {
			ledgerEntry = JSON.parse(
				readFileSync(join(ledgerDir, files[0]), "utf-8"),
			);
		}
	} catch {
		// No ledger entry found
	}

	if (!ledgerEntry) {
		return {
			verified: false,
			mandatorySources: [],
			uncheckedMandatory: ["NO_LEDGER_ENTRY"],
			verifiedAt: new Date().toISOString(),
			error: "No discovery ledger entry found for edition",
		};
	}

	const result = await verifyMandatoryCoverage({ editionDate, ledgerEntry });

	return {
		...result,
		verified: result.verified,
		verifiedAt: result.verifiedAt,
		verifiedBy: "mandatory-coverage-verifier",
	};
}
