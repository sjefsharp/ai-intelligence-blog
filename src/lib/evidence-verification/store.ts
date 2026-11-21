/**
 * Evidence Verification Persistence — Storage & Retrieval
 *
 * Persists structured verification records using the existing local project architecture.
 * Maintains traceability across Source → Retrieval → Candidate → Claim → Evidence → Verification Decision.
 */

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import type {
	ClaimVerificationRecord,
	VerificationQuery,
	VerificationStats,
	Counterevidence,
	UnresolvedUncertainty,
	VerificationRevision,
	EvidenceClassification,
	VerificationStatus,
	ClaimType,
} from "./types.js";

/** Default storage directory */
const DEFAULT_VERIFICATION_DIR = "data/evidence-verification";

/** Current schema version */
const VERIFICATION_SCHEMA_VERSION = "1.0.0";

/** File naming: editionDate_executionId.json */
function getVerificationFilename(
	editionDate: string,
	executionId: string,
): string {
	return `${editionDate}_${executionId.slice(0, 8)}.json`;
}

/** Generate content hash for verification record */
function generateRecordHash(record: ClaimVerificationRecord): string {
	// Hash the essential content (excluding metadata that changes)
	const content = JSON.stringify({
		id: record.id,
		claim: record.claim,
		evidenceClassification: record.evidenceClassification,
		verificationStatus: record.verificationStatus,
		confidence: record.confidence,
		supportingEvidence: record.supportingEvidence.map((e) => ({
			id: e.id,
			sourceId: e.sourceId,
			classification: e.classification,
			url: e.url,
			locator: e.locator,
			extractedText: e.extractedText,
			timestamp: e.timestamp,
			confidence: e.confidence,
		})),
		counterevidence: record.counterevidence.map((c) => ({
			id: c.id,
			sourceId: c.sourceId,
			contradictsClaim: c.contradictsClaim,
			contradictionType: c.contradictionType,
			confidence: c.confidence,
		})),
	});
	return `sha256:${crypto.createHash("sha256").update(content).digest("hex")}`;
}

/** Verification storage entry */
export interface VerificationStorageEntry {
	version: string;
	createdAt: string;
	editionDate: string;
	executionId: string;
	records: ClaimVerificationRecord[];
	contentHashes: Record<string, string>; // claimId -> contentHash
	stats: VerificationStats;
}

/** Evidence Verification Store */
export class EvidenceVerificationStore {
	private readonly verificationDir: string;
	private readonly maxHistoryFiles: number;
	private readonly historyRetentionDays: number;

	constructor(
		verificationDir: string = DEFAULT_VERIFICATION_DIR,
		maxHistoryFiles: number = 14,
		historyRetentionDays: number = 7,
	) {
		this.verificationDir = verificationDir;
		this.maxHistoryFiles = maxHistoryFiles;
		this.historyRetentionDays = historyRetentionDays;
	}

	/** Initialize the store (create directory) */
	async initialize(): Promise<void> {
		await fs.mkdir(this.verificationDir, { recursive: true });
	}

	/** Save a batch of verification records for an edition */
	async saveVerificationBatch(
		editionDate: string,
		executionId: string,
		records: ClaimVerificationRecord[],
	): Promise<VerificationStorageEntry> {
		await this.initialize();

		const contentHashes: Record<string, string> = {};
		for (const record of records) {
			contentHashes[record.id] = generateRecordHash(record);
		}

		// Calculate stats
		const stats = this.calculateStats(records);

		const entry: VerificationStorageEntry = {
			version: VERIFICATION_SCHEMA_VERSION,
			createdAt: new Date().toISOString(),
			editionDate,
			executionId,
			records,
			contentHashes,
			stats,
		};

		const filename = getVerificationFilename(editionDate, executionId);
		const filepath = path.join(this.verificationDir, filename);

		await fs.writeFile(filepath, JSON.stringify(entry, null, 2), "utf-8");

		// Prune old history
		await this.pruneHistory();

		return entry;
	}

	/** Load verification records for a specific edition */
	async loadVerificationBatch(
		editionDate: string,
		executionId?: string,
	): Promise<VerificationStorageEntry | null> {
		try {
			const files = await fs.readdir(this.verificationDir);
			let targetFile: string | null = null;

			if (executionId) {
				targetFile =
					files.find(
						(f) =>
							f.startsWith(editionDate) &&
							f.includes(executionId.slice(0, 8)) &&
							f.endsWith(".json"),
					) || null;
			} else {
				// Get the most recent file for this edition date
				const editionFiles = files
					.filter(
						(f) => f.startsWith(editionDate) && f.endsWith(".json"),
					)
					.sort()
					.reverse();
				targetFile = editionFiles[0] || null;
			}

			if (!targetFile) return null;

			const content = await fs.readFile(
				path.join(this.verificationDir, targetFile),
				"utf-8",
			);
			return JSON.parse(content) as VerificationStorageEntry;
		} catch {
			return null;
		}
	}

	/** Query verification records across editions */
	async query(query: VerificationQuery): Promise<ClaimVerificationRecord[]> {
		const files = await fs.readdir(this.verificationDir);
		const results: ClaimVerificationRecord[] = [];

		for (const file of files) {
			if (!file.endsWith(".json")) continue;

			try {
				const content = await fs.readFile(
					path.join(this.verificationDir, file),
					"utf-8",
				);
				const entry = JSON.parse(content) as VerificationStorageEntry;

				// Apply edition date filter
				if (
					query.editionDate &&
					entry.editionDate !== query.editionDate
				)
					continue;
				if (query.startDate && entry.editionDate < query.startDate)
					continue;
				if (query.endDate && entry.editionDate > query.endDate)
					continue;

				// Filter records
				for (const record of entry.records) {
					if (this.matchesQuery(record, query)) {
						results.push(record);
					}
				}
			} catch {
				// Skip corrupted files
			}
		}

		// Sort by verification timestamp descending
		results.sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt));

		// Apply pagination
		const offset = query.offset || 0;
		const limit = query.limit || 100;
		return results.slice(offset, offset + limit);
	}

	/** Check if a record matches query criteria */
	private matchesQuery(
		record: ClaimVerificationRecord,
		query: VerificationQuery,
	): boolean {
		if (query.candidateId && record.candidateId !== query.candidateId)
			return false;
		if (query.claimId && record.id !== query.claimId) return false;
		if (query.claimType && record.claimType !== query.claimType)
			return false;
		if (
			query.evidenceClassification &&
			record.evidenceClassification !== query.evidenceClassification
		)
			return false;
		if (
			query.verificationStatus &&
			record.verificationStatus !== query.verificationStatus
		)
			return false;
		if (
			query.verificationLevel &&
			record.verificationLevel !== query.verificationLevel
		)
			return false;
		if (
			query.sourceId &&
			!record.supportingEvidence.some(
				(e) => e.sourceId === query.sourceId,
			)
		)
			return false;
		if (
			query.minConfidence !== undefined &&
			record.confidence < query.minConfidence
		)
			return false;
		if (
			query.maxConfidence !== undefined &&
			record.confidence > query.maxConfidence
		)
			return false;
		if (query.hasCounterevidence !== undefined) {
			const hasCE = record.counterevidence.length > 0;
			if (query.hasCounterevidence !== hasCE) return false;
		}
		if (query.hasUnresolvedUncertainties !== undefined) {
			const hasUU = record.unresolvedUncertainties.length > 0;
			if (query.hasUnresolvedUncertainties !== hasUU) return false;
		}
		return true;
	}

	/** Get a single verification record by claim ID */
	async getClaimVerification(
		claimId: string,
	): Promise<ClaimVerificationRecord | null> {
		const results = await this.query({ claimId, limit: 1 });
		return results[0] || null;
	}

	/** Get all verification records for a candidate */
	async getCandidateVerifications(
		candidateId: string,
	): Promise<ClaimVerificationRecord[]> {
		return this.query({ candidateId });
	}

	/** Get verification statistics across all editions */
	async getGlobalStats(): Promise<{
		totalRecords: number;
		totalEditions: number;
		dateRange: { earliest: string; latest: string };
		globalStats: VerificationStats;
		editionStats: Array<{ editionDate: string; stats: VerificationStats }>;
	}> {
		const files = await fs.readdir(this.verificationDir);
		const entries: VerificationStorageEntry[] = [];
		const editionStats: Array<{
			editionDate: string;
			stats: VerificationStats;
		}> = [];

		for (const file of files) {
			if (!file.endsWith(".json")) continue;
			try {
				const content = await fs.readFile(
					path.join(this.verificationDir, file),
					"utf-8",
				);
				const entry = JSON.parse(content) as VerificationStorageEntry;
				entries.push(entry);
				editionStats.push({
					editionDate: entry.editionDate,
					stats: entry.stats,
				});
			} catch {
				// Skip corrupted
			}
		}

		if (entries.length === 0) {
			return {
				totalRecords: 0,
				totalEditions: 0,
				dateRange: { earliest: "", latest: "" },
				globalStats: this.emptyStats(),
				editionStats: [],
			};
		}

		// Sort by edition date
		entries.sort((a, b) => a.editionDate.localeCompare(b.editionDate));

		const allRecords = entries.flatMap((e) => e.records);
		const globalStats = this.calculateStats(allRecords);

		return {
			totalRecords: allRecords.length,
			totalEditions: entries.length,
			dateRange: {
				earliest: entries[0].editionDate,
				latest: entries[entries.length - 1].editionDate,
			},
			globalStats,
			editionStats,
		};
	}

	/** Calculate verification statistics */
	private calculateStats(
		records: ClaimVerificationRecord[],
	): VerificationStats {
		const classifications: EvidenceClassification[] = [
			"VERIFIED_FACT",
			"VENDOR_CLAIM",
			"RESEARCH_FINDING",
			"ORIGINAL_REPORTING",
			"EXPERT_INTERPRETATION",
			"INFERENCE",
			"SPECULATION",
			"UNVERIFIED",
		];
		const statuses: VerificationStatus[] = [
			"verified",
			"partially-verified",
			"unverified",
			"contradicted",
			"insufficient-evidence",
			"downgraded",
			"retracted",
			"superseded",
		];
		const claimTypes: ClaimType[] = [
			"technical-announcement",
			"software-release",
			"scientific-research",
			"benchmark-result",
			"strategic-research",
			"advisory-finding",
			"enterprise-adoption",
			"productivity-claim",
			"roi-claim",
			"economic-impact",
			"original-reporting",
			"vendor-announcement",
			"policy-regulation",
			"security-vulnerability",
		];

		const byClassification: Record<EvidenceClassification, number> =
			{} as Record<EvidenceClassification, number>;
		const byStatus: Record<VerificationStatus, number> = {} as Record<
			VerificationStatus,
			number
		>;
		const byClaimType: Record<ClaimType, number> = {} as Record<
			ClaimType,
			number
		>;

		for (const c of classifications) byClassification[c] = 0;
		for (const s of statuses) byStatus[s] = 0;
		for (const t of claimTypes) byClaimType[t] = 0;

		const stats: VerificationStats = {
			totalClaims: records.length,
			byClassification,
			byStatus,
			byLevel: { L0: 0, L1: 0, L2: 0, L3: 0 },
			byClaimType,
			averageConfidence: 0,
			claimsWithCounterevidence: 0,
			claimsWithUnresolvedUncertainties: 0,
			verificationCoveragePercent: 0,
		};

		let confidenceSum = 0;
		let verifiedOrPartial = 0;

		for (const record of records) {
			stats.byClassification[record.evidenceClassification]++;
			stats.byStatus[record.verificationStatus]++;
			stats.byLevel[record.verificationLevel]++;
			stats.byClaimType[record.claimType]++;
			confidenceSum += record.confidence;

			if (
				record.verificationStatus === "verified" ||
				record.verificationStatus === "partially-verified"
			) {
				verifiedOrPartial++;
			}
			if (record.counterevidence.length > 0) {
				stats.claimsWithCounterevidence++;
			}
			if (record.unresolvedUncertainties.length > 0) {
				stats.claimsWithUnresolvedUncertainties++;
			}
		}

		stats.averageConfidence =
			records.length > 0 ? confidenceSum / records.length : 0;
		stats.verificationCoveragePercent =
			records.length > 0 ? (verifiedOrPartial / records.length) * 100 : 0;

		return stats;
	}

	private emptyStats(): VerificationStats {
		const classifications: EvidenceClassification[] = [
			"VERIFIED_FACT",
			"VENDOR_CLAIM",
			"RESEARCH_FINDING",
			"ORIGINAL_REPORTING",
			"EXPERT_INTERPRETATION",
			"INFERENCE",
			"SPECULATION",
			"UNVERIFIED",
		];
		const statuses: VerificationStatus[] = [
			"verified",
			"partially-verified",
			"unverified",
			"contradicted",
			"insufficient-evidence",
			"downgraded",
			"retracted",
			"superseded",
		];
		const claimTypes: ClaimType[] = [
			"technical-announcement",
			"software-release",
			"scientific-research",
			"benchmark-result",
			"strategic-research",
			"advisory-finding",
			"enterprise-adoption",
			"productivity-claim",
			"roi-claim",
			"economic-impact",
			"original-reporting",
			"vendor-announcement",
			"policy-regulation",
			"security-vulnerability",
		];

		const byClassification: Record<EvidenceClassification, number> =
			{} as Record<EvidenceClassification, number>;
		const byStatus: Record<VerificationStatus, number> = {} as Record<
			VerificationStatus,
			number
		>;
		const byClaimType: Record<ClaimType, number> = {} as Record<
			ClaimType,
			number
		>;

		for (const c of classifications) byClassification[c] = 0;
		for (const s of statuses) byStatus[s] = 0;
		for (const t of claimTypes) byClaimType[t] = 0;

		return {
			totalClaims: 0,
			byClassification,
			byStatus,
			byLevel: { L0: 0, L1: 0, L2: 0, L3: 0 },
			byClaimType,
			averageConfidence: 0,
			claimsWithCounterevidence: 0,
			claimsWithUnresolvedUncertainties: 0,
			verificationCoveragePercent: 0,
		};
	}

	/** Update a verification record (create new revision) */
	async updateClaimVerification(
		editionDate: string,
		executionId: string,
		claimId: string,
		updates: Partial<ClaimVerificationRecord>,
		revisedBy: string,
		reason: string,
	): Promise<ClaimVerificationRecord | null> {
		const entry = await this.loadVerificationBatch(
			editionDate,
			executionId,
		);
		if (!entry) return null;

		const recordIndex = entry.records.findIndex((r) => r.id === claimId);
		if (recordIndex === -1) return null;

		const record = entry.records[recordIndex];
		const revisionId = `rev_${crypto.randomBytes(8).toString("hex")}`;

		// Capture previous values for revision history
		const revision: VerificationRevision = {
			revisionId,
			revisedAt: new Date().toISOString(),
			revisedBy,
			changes: Object.keys(updates),
			previousClassification: record.evidenceClassification,
			previousStatus: record.verificationStatus,
			previousConfidence: record.confidence,
			reason,
		};

		// Apply updates
		const updatedRecord: ClaimVerificationRecord = {
			...record,
			...updates,
			revisionHistory: [...record.revisionHistory, revision],
		};

		// Recalculate confidence if classification or evidence changed
		if (
			updates.evidenceClassification ||
			updates.supportingEvidence ||
			updates.counterevidence
		) {
			// Would need to recalculate - for now preserve existing
		}

		entry.records[recordIndex] = updatedRecord;
		entry.contentHashes[claimId] = generateRecordHash(updatedRecord);
		entry.stats = this.calculateStats(entry.records);

		const filename = getVerificationFilename(editionDate, executionId);
		const filepath = path.join(this.verificationDir, filename);
		await fs.writeFile(filepath, JSON.stringify(entry, null, 2), "utf-8");

		return updatedRecord;
	}

	/** Record a retraction */
	async retractClaim(
		editionDate: string,
		executionId: string,
		claimId: string,
		retractionReason: string,
		retractedBy: string,
	): Promise<ClaimVerificationRecord | null> {
		return this.updateClaimVerification(
			editionDate,
			executionId,
			claimId,
			{
				verificationStatus: "retracted",
				evidenceClassification: "UNVERIFIED",
			},
			retractedBy,
			`Retracted: ${retractionReason}`,
		);
	}

	/** Record a supersession */
	async supersedeClaim(
		editionDate: string,
		executionId: string,
		claimId: string,
		newClaimId: string,
		supersededBy: string,
		reason: string,
	): Promise<ClaimVerificationRecord | null> {
		return this.updateClaimVerification(
			editionDate,
			executionId,
			claimId,
			{
				verificationStatus: "superseded",
			},
			supersededBy,
			`Superseded by ${newClaimId}: ${reason}`,
		);
	}

	/** Get verification history for a claim (all revisions) */
	async getClaimHistory(claimId: string): Promise<VerificationRevision[]> {
		const record = await this.getClaimVerification(claimId);
		return record?.revisionHistory || [];
	}

	/** Get all counterevidence across all records */
	async getAllCounterevidence(): Promise<Counterevidence[]> {
		const files = await fs.readdir(this.verificationDir);
		const allCounterevidence: Counterevidence[] = [];

		for (const file of files) {
			if (!file.endsWith(".json")) continue;
			try {
				const content = await fs.readFile(
					path.join(this.verificationDir, file),
					"utf-8",
				);
				const entry = JSON.parse(content) as VerificationStorageEntry;
				for (const record of entry.records) {
					allCounterevidence.push(
						...record.counterevidence.map((ce) => ({
							...ce,
							claimId: record.id,
						})),
					);
				}
			} catch {
				// Skip
			}
		}

		return allCounterevidence;
	}

	/** Get all unresolved uncertainties */
	async getAllUnresolvedUncertainties(): Promise<UnresolvedUncertainty[]> {
		const files = await fs.readdir(this.verificationDir);
		const allUncertainties: UnresolvedUncertainty[] = [];

		for (const file of files) {
			if (!file.endsWith(".json")) continue;
			try {
				const content = await fs.readFile(
					path.join(this.verificationDir, file),
					"utf-8",
				);
				const entry = JSON.parse(content) as VerificationStorageEntry;
				for (const record of entry.records) {
					allUncertainties.push(
						...record.unresolvedUncertainties.map((uu) => ({
							...uu,
							claimId: record.id,
						})),
					);
				}
			} catch {
				// Skip
			}
		}

		return allUncertainties;
	}

	/** Get traceability chain for a claim */
	async getClaimTraceability(claimId: string): Promise<{
		claim: ClaimVerificationRecord | null;
		sourceRecords: Array<{
			sourceId: string;
			url: string;
			timestamp: string;
			evidenceRole: string;
		}>;
		candidateId: string | null;
		editionDate: string | null;
	}> {
		const record = await this.getClaimVerification(claimId);
		if (!record)
			return {
				claim: null,
				sourceRecords: [],
				candidateId: null,
				editionDate: null,
			};

		const sourceRecords = record.supportingEvidence.map((e) => ({
			sourceId: e.sourceId,
			url: e.url,
			timestamp: e.timestamp,
			evidenceRole: e.evidenceRole,
		}));

		return {
			claim: record,
			sourceRecords,
			candidateId: record.candidateId,
			editionDate: null, // Would need to query storage for edition date
		};
	}

	/** Export verification records for fact dossier consumption */
	async exportForFactDossier(candidateId: string): Promise<{
		claims: Array<{
			id: string;
			text: string;
			sourceId: string;
			locator: string;
			verification: string;
			confidence: number;
			status: string;
		}>;
		sources: Array<{
			id: string;
			tier: number;
			url: string;
			title: string;
			accessed: string;
			claims: string[];
			verification: string;
		}>;
	}> {
		const records = await this.getCandidateVerifications(candidateId);
		if (records.length === 0) {
			return { claims: [], sources: [] };
		}

		// Build claims for dossier
		const claims = records.map((r) => ({
			id: r.id,
			text: r.claim,
			sourceId: r.originalSource.sourceId,
			locator: r.supportingEvidence[0]?.locator || "",
			verification: r.verificationLevel,
			confidence: r.confidence,
			status: r.verificationStatus,
		}));

		// Build sources for dossier
		const sourceMap = new Map<
			string,
			{
				tier: number;
				url: string;
				title: string;
				claims: string[];
				verification: string;
			}
		>();
		for (const record of records) {
			const sourceId = record.originalSource.sourceId;
			if (!sourceMap.has(sourceId)) {
				sourceMap.set(sourceId, {
					tier: record.supportingEvidence[0]?.tier || 2,
					url: record.originalSource.url,
					title: record.originalSource.title,
					claims: [],
					verification: record.verificationLevel,
				});
			}
			sourceMap.get(sourceId)!.claims.push(record.id);
			// Use highest verification level
			const currentVer = sourceMap.get(sourceId)!.verification;
			const levels = { L0: 0, L1: 1, L2: 2, L3: 3 };
			if (
				levels[record.verificationLevel as keyof typeof levels] >
				levels[currentVer as keyof typeof levels]
			) {
				sourceMap.get(sourceId)!.verification =
					record.verificationLevel;
			}
		}

		const sources = Array.from(sourceMap.entries()).map(([id, data]) => ({
			id,
			...data,
			accessed: records[0].temporalVerification.retrievalTimestamp,
		}));

		return { claims, sources };
	}

	/** Prune old history files */
	private async pruneHistory(): Promise<void> {
		try {
			const files = await fs.readdir(this.verificationDir);
			const jsonFiles = files.filter((f) => f.endsWith(".json"));

			const fileDates = jsonFiles
				.map((f) => {
					const dateStr = f.split("_")[0];
					const date = new Date(dateStr);
					return { file: f, date: date.getTime() };
				})
				.filter((f) => !isNaN(f.date))
				.sort((a, b) => b.date - a.date);

			// Keep only maxHistoryFiles
			if (fileDates.length > this.maxHistoryFiles) {
				const toDelete = fileDates.slice(this.maxHistoryFiles);
				for (const { file } of toDelete) {
					await fs
						.unlink(path.join(this.verificationDir, file))
						.catch(() => {});
				}
			}

			// Also delete files older than retention period (past dates only)
			const now = Date.now();
			const cutoffTime =
				now - this.historyRetentionDays * 24 * 60 * 60 * 1000;
			for (const { file, date } of fileDates) {
				if (date > now) continue; // Skip future edition dates
				if (date < cutoffTime) {
					await fs
						.unlink(path.join(this.verificationDir, file))
						.catch(() => {});
				}
			}
		} catch {
			// Ignore pruning errors
		}
	}
}

/** Create a verification store instance */
export function createEvidenceVerificationStore(options?: {
	verificationDir?: string;
	maxHistoryFiles?: number;
	historyRetentionDays?: number;
}): EvidenceVerificationStore {
	return new EvidenceVerificationStore(
		options?.verificationDir || DEFAULT_VERIFICATION_DIR,
		options?.maxHistoryFiles || 14,
		options?.historyRetentionDays || 7,
	);
}
