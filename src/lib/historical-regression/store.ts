/**
 * Historical Regression — Persistence
 *
 * Persists one historical regression report per edition plus an append-only
 * cross-edition traceability ledger.
 *
 * Guarantees:
 * - Atomic writes (temp file + rename).
 * - Readback verification (byte equality + content hash).
 * - Idempotent classification records: identical classification content produces
 *   the same reportId and is not written twice.
 * - Traceability records are append-only and deduplicated by deterministic
 *   recordId, so repeated executions never duplicate links.
 * - Historical records are never modified by this stage.
 * - Local filesystem only; no external database.
 */

import { promises as fs } from "fs";
import path from "path";

import {
	canonicalPrettyJson,
	sha256Canonical,
} from "../fact-dossier/canonical.js";
import {
	HISTORICAL_REGRESSION_ID_PREFIX,
	HISTORICAL_TRACEABILITY_ID_PREFIX,
	HistoricalTraceabilityRecordSchema,
	type HistoricalRegressionReport,
	type HistoricalTraceabilityRecord,
} from "./schema.js";

export const DEFAULT_HISTORICAL_REGRESSION_DIR = "data/historical-regression";

/** Index file name. */
export const HISTORICAL_REGRESSION_INDEX_FILE = "index.json";

/** Append-only traceability ledger file name. */
export const HISTORICAL_TRACEABILITY_FILE = "traceability.jsonl";

export interface SaveReportResult {
	saved: boolean;
	path: string;
	reason: "written" | "identical";
	contentHash: string;
	reportId: string;
}

export interface HistoricalRegressionIndexEntry {
	reportId: string;
	contentHash: string;
	executionId: string;
	executedAt: string;
	finalStatus: HistoricalRegressionReport["finalStatus"];
	path: string;
	candidatesEvaluated: number;
	inferenceUsed: boolean;
}

export interface HistoricalRegressionIndex {
	schemaVersion: string;
	editions: Record<string, HistoricalRegressionIndexEntry>;
}

/**
 * Compute the deterministic content hash for a regression report.
 * Execution metadata is excluded so identical classifications produce
 * identical hashes (and therefore idempotent reruns).
 */
export function computeRegressionReportContentHash(
	report: HistoricalRegressionReport,
): string {
	const {
		reportId: _reportId,
		executionId: _executionId,
		executedAt: _executedAt,
		contentHash: _contentHash,
		...rest
	} = report;
	return sha256Canonical(rest);
}

/** Derive the stable report identifier from the classification content. */
export function deriveReportId(contentHash: string): string {
	return `${HISTORICAL_REGRESSION_ID_PREFIX}${contentHash.replace(/^sha256:/, "").slice(0, 16)}`;
}

/** Derive the deterministic traceability record identifier. */
export function deriveTraceabilityRecordId(record: {
	reportId: string;
	candidateId: string;
	classification: string;
	previousEditionDate?: string;
}): string {
	const basis = [
		record.reportId,
		record.candidateId,
		record.classification,
		record.previousEditionDate ?? "",
	].join(":");
	return `${HISTORICAL_TRACEABILITY_ID_PREFIX}${sha256Canonical(basis)
		.replace(/^sha256:/, "")
		.slice(0, 16)}`;
}

/** Build one traceability record from a relationship classification. */
export function buildTraceabilityRecord(
	report: HistoricalRegressionReport,
	relationship: HistoricalRegressionReport["relationships"][number],
): HistoricalTraceabilityRecord {
	const record: HistoricalTraceabilityRecord = {
		recordId: "",
		reportId: report.reportId,
		editionDate: report.editionDate,
		editionId: report.editionId,
		candidateId: relationship.candidateId,
		claimIds: relationship.matches.flatMap(
			(match) => match.matchedClaimIds,
		),
		classification: relationship.classification,
		previousEditionDate: relationship.primaryMatchEditionDate,
		previousEditionId: relationship.primaryMatchEditionDate
			? `edition_${relationship.primaryMatchEditionDate}`
			: undefined,
		previousCandidateId: relationship.primaryMatchCandidateId,
		previousClaimIds:
			relationship.substantiveUpdate?.previousClaimIds ??
			relationship.repeatedReporting?.previousClaimIds ??
			relationship.matches.flatMap((match) => match.matchedClaimIds),
		previousPublicationId: relationship.matches.find(
			(match) => match.previousPublicationId,
		)?.previousPublicationId,
		evidenceUrls: [
			...new Set(
				relationship.matches.flatMap(
					(match) => match.evidenceReferences,
				),
			),
		].sort(),
		substantiveUpdateTypes:
			relationship.substantiveUpdate?.updateTypes ?? [],
		semanticComparisonUsed: relationship.semanticComparisonUsed,
		executedAt: report.executedAt,
	};
	record.recordId = deriveTraceabilityRecordId({
		reportId: record.reportId,
		candidateId: record.candidateId,
		classification: record.classification,
		previousEditionDate: record.previousEditionDate,
	});
	return record;
}

export class HistoricalRegressionStore {
	private readonly baseDir: string;

	constructor(baseDir: string = DEFAULT_HISTORICAL_REGRESSION_DIR) {
		this.baseDir = baseDir;
	}

	/** The directory where regression reports are persisted. */
	get directory(): string {
		return this.baseDir;
	}

	async initialize(): Promise<void> {
		await fs.mkdir(this.baseDir, { recursive: true });
	}

	private indexPath(): string {
		return path.join(this.baseDir, HISTORICAL_REGRESSION_INDEX_FILE);
	}

	private traceabilityPath(): string {
		return path.join(this.baseDir, HISTORICAL_TRACEABILITY_FILE);
	}

	private reportPath(editionDate: string, executionId: string): string {
		return path.join(
			this.baseDir,
			`${editionDate}_${executionId.slice(0, 8)}.json`,
		);
	}

	async loadIndex(): Promise<HistoricalRegressionIndex> {
		try {
			const content = await fs.readFile(this.indexPath(), "utf-8");
			return JSON.parse(content) as HistoricalRegressionIndex;
		} catch {
			return { schemaVersion: "1.0.0", editions: {} };
		}
	}

	private async saveIndex(index: HistoricalRegressionIndex): Promise<void> {
		await this.initialize();
		const tempPath = path.join(
			this.baseDir,
			`.${HISTORICAL_REGRESSION_INDEX_FILE}.tmp-${process.pid}`,
		);
		await fs.writeFile(tempPath, canonicalPrettyJson(index), "utf-8");
		await fs.rename(tempPath, this.indexPath());
	}

	/**
	 * Persist a regression report. Verifies the content hash, performs an atomic
	 * write, reads the file back, updates the edition index and appends
	 * traceability records. Identical classification content is a no-op.
	 */
	async saveReport(
		report: HistoricalRegressionReport,
	): Promise<SaveReportResult> {
		await this.initialize();

		const computedHash = computeRegressionReportContentHash(report);
		if (report.contentHash !== computedHash) {
			throw new Error(
				`Content hash mismatch for report ${report.reportId}: provided ${report.contentHash}, computed ${computedHash}`,
			);
		}

		const index = await this.loadIndex();
		const existing = index.editions[report.editionDate];
		if (existing && existing.contentHash === computedHash) {
			// Identical classification content already persisted for this edition.
			return {
				saved: false,
				path: path.join(this.baseDir, existing.path),
				reason: "identical",
				contentHash: computedHash,
				reportId: report.reportId,
			};
		}

		const filePath = this.reportPath(
			report.editionDate,
			report.executionId,
		);
		const serialized = canonicalPrettyJson(report);

		const tempPath = path.join(
			this.baseDir,
			`.${report.editionDate}_${report.executionId.slice(0, 8)}.tmp-${process.pid}`,
		);
		await fs.writeFile(tempPath, serialized, "utf-8");
		try {
			await fs.rename(tempPath, filePath);
		} catch (error) {
			await fs.unlink(tempPath).catch(() => {});
			throw error;
		}

		// Readback verification: byte equality and content hash.
		const readBack = await fs.readFile(filePath, "utf-8");
		if (readBack !== serialized) {
			throw new Error(`Readback verification failed for ${filePath}`);
		}
		const parsed = JSON.parse(readBack) as HistoricalRegressionReport;
		if (computeRegressionReportContentHash(parsed) !== computedHash) {
			throw new Error(
				`Readback hash verification failed for ${filePath}`,
			);
		}

		index.editions[report.editionDate] = {
			reportId: report.reportId,
			contentHash: computedHash,
			executionId: report.executionId,
			executedAt: report.executedAt,
			finalStatus: report.finalStatus,
			path: path.basename(filePath),
			candidatesEvaluated: report.candidatesEvaluated,
			inferenceUsed: report.inferenceUsed,
		};
		await this.saveIndex(index);

		await this.appendTraceability(report);

		return {
			saved: true,
			path: filePath,
			reason: "written",
			contentHash: computedHash,
			reportId: report.reportId,
		};
	}

	/** Append traceability records, deduplicated by deterministic recordId. */
	async appendTraceability(
		report: HistoricalRegressionReport,
	): Promise<HistoryTraceabilityAppendResult> {
		await this.initialize();
		const existing = await this.loadTraceability();
		const existingIds = new Set(existing.map((record) => record.recordId));

		const records = report.relationships.map((relationship) =>
			buildTraceabilityRecord(report, relationship),
		);
		const fresh = records.filter(
			(record) => !existingIds.has(record.recordId),
		);
		if (fresh.length === 0) {
			return { appended: 0, total: existing.length };
		}

		const lines =
			fresh.map((record) => JSON.stringify(record)).join("\n") + "\n";
		await fs.appendFile(this.traceabilityPath(), lines, "utf-8");

		// Readback verification of the appended records.
		const after = await this.loadTraceability();
		const afterIds = new Set(after.map((record) => record.recordId));
		const missing = fresh.filter(
			(record) => !afterIds.has(record.recordId),
		);
		if (missing.length > 0) {
			throw new Error(
				`Traceability readback verification failed: ${missing.length} record(s) missing after append`,
			);
		}

		return { appended: fresh.length, total: after.length };
	}

	/** Load all traceability records, optionally filtered by edition date. */
	async loadTraceability(
		editionDate?: string,
	): Promise<HistoricalTraceabilityRecord[]> {
		try {
			const content = await fs.readFile(this.traceabilityPath(), "utf-8");
			const records = content
				.split("\n")
				.map((line) => line.trim())
				.filter(Boolean)
				.map((line) => JSON.parse(line) as unknown)
				.filter((record): record is HistoricalTraceabilityRecord => {
					// Schema-validate every ledger entry; corrupted lines are skipped so a
					// single bad append cannot break historical readback.
					return HistoricalTraceabilityRecordSchema.safeParse(record)
						.success;
				});
			const filtered = editionDate
				? records.filter((record) => record.editionDate === editionDate)
				: records;
			return filtered.sort((a, b) =>
				a.candidateId === b.candidateId
					? (a.previousEditionDate ?? "").localeCompare(
							b.previousEditionDate ?? "",
						)
					: a.candidateId.localeCompare(b.candidateId),
			);
		} catch {
			return [];
		}
	}

	/** Load a regression report by edition date and (optionally) execution id. */
	async loadReport(
		editionDate: string,
		executionId?: string,
	): Promise<HistoricalRegressionReport | null> {
		if (executionId) {
			try {
				const content = await fs.readFile(
					this.reportPath(editionDate, executionId),
					"utf-8",
				);
				return JSON.parse(content) as HistoricalRegressionReport;
			} catch {
				return null;
			}
		}
		const index = await this.loadIndex();
		const entry = index.editions[editionDate];
		if (!entry) return null;
		try {
			const content = await fs.readFile(
				path.join(this.baseDir, entry.path),
				"utf-8",
			);
			return JSON.parse(content) as HistoricalRegressionReport;
		} catch {
			return null;
		}
	}

	/** List edition dates with a persisted regression report. */
	async listEditions(): Promise<string[]> {
		const index = await this.loadIndex();
		return Object.keys(index.editions).sort();
	}
}

export interface HistoryTraceabilityAppendResult {
	appended: number;
	total: number;
}

/** Create a store with the default configuration. */
export function createHistoricalRegressionStore(
	baseDir?: string,
): HistoricalRegressionStore {
	return new HistoricalRegressionStore(baseDir);
}
