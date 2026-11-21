/**
 * Discovery Ledger — Core Implementation
 *
 * Provides deterministic, auditable evidence of source monitoring across all
 * three discovery rings with coverage metrics, traceability, and regression detection.
 */

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import type {
	DiscoveryLedgerEntry,
	ExecutionContext,
	SourceMonitoringRecord,
	CoverageMetrics,
	CandidateTraceabilityRecord,
	MonitoringAnomaly,
	LedgerQuery,
	LedgerStats,
	CoverageTrendPoint,
	SourceFamily,
	CriticalityLevel,
	MonitoringCadence,
	DiscoveryRing,
	EvidenceReference,
	MonitoringError,
	AccessLimitation,
	IncompleteResults,
	RingCoverage,
	DomainCoverage,
	SourceFamilyCoverage,
	OrganizationCoverage,
	CriticalityCoverage,
	CadenceCoverage,
	OverallCoverage,
	MissingSource,
	SourceDiscoveryLink,
	NoveltyClassificationLink,
	EvidenceVerificationLink,
	EditorialDispositionLink,
	TraceabilityStep,
} from "./types.js";

import type {
	SourceConfig,
	RetrievalResult,
	RetrievalError,
} from "../collection/types.js";

/** Default ledger storage directory */
const DEFAULT_LEDGER_DIR = "data/discovery-ledger";

/** Default history retention (days) */
const DEFAULT_HISTORY_RETENTION_DAYS = 7;

/** Maximum history files to keep */
const MAX_HISTORY_FILES = 14;

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
	return crypto.randomUUID();
}

/**
 * Discovery Ledger Manager
 */
export class DiscoveryLedger {
	private readonly ledgerDir: string;
	private readonly historyRetentionDays: number;
	private readonly maxHistoryFiles: number;
	private currentExecution: ExecutionContext | null = null;
	private currentRecords: SourceMonitoringRecord[] = [];
	private currentCandidateTraceability: CandidateTraceabilityRecord[] = [];

	constructor(
		ledgerDir: string = DEFAULT_LEDGER_DIR,
		historyRetentionDays: number = DEFAULT_HISTORY_RETENTION_DAYS,
		maxHistoryFiles: number = MAX_HISTORY_FILES,
	) {
		this.ledgerDir = ledgerDir;
		this.historyRetentionDays = historyRetentionDays;
		this.maxHistoryFiles = maxHistoryFiles;
	}

	/**
	 * Start a new monitoring execution
	 */
	async startExecution(
		editionDate: string,
		rings: DiscoveryRing[],
		sourceIds: string[],
		collectorVersion: string = "1.0.0",
		gitCommit?: string,
	): Promise<ExecutionContext> {
		const executionId = generateUUID();
		const startedAt = new Date().toISOString();

		this.currentExecution = {
			executionId,
			editionDate,
			startedAt,
			rings,
			sourceIds,
			gitCommit,
			collectorVersion,
			timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			nodeVersion: process.version,
			platform: process.platform,
		};

		this.currentRecords = [];
		this.currentCandidateTraceability = [];

		return this.currentExecution;
	}

	/**
	 * Record a source monitoring attempt
	 */
	recordSourceMonitoring(
		sourceConfig: SourceConfig,
		retrievalResult: RetrievalResult,
		executionId: string,
		editionDate: string,
		scheduled: boolean = true,
		attemptNumber: number = 1,
		isRetry: boolean = false,
		previousExecutionId?: string,
	): SourceMonitoringRecord {
		const checkedAt = new Date().toISOString();
		const requestedAt = retrievalResult.metadata.startedAt;
		const checkTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

		// Extract source publication timestamps
		const sourcePublicationTimestamps = retrievalResult.items
			.map((item) => item.publishedAt)
			.filter((ts): ts is string => !!ts)
			.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

		const latestItemPublishedAt = sourcePublicationTimestamps[0];

		// Build evidence references
		const evidenceReferences =
			this.buildEvidenceReferences(retrievalResult);

		// Build monitoring errors
		const errors = this.buildMonitoringErrors(
			retrievalResult.errors,
			sourceConfig.url,
		);

		// Build access limitations
		const accessLimitations = this.detectAccessLimitations(
			retrievalResult,
			sourceConfig,
		);

		// Build incomplete results
		const incompleteResults = this.detectIncompleteResults(
			retrievalResult,
			sourceConfig,
		);

		// Determine source family
		const sourceFamily = this.inferSourceFamily(sourceConfig);

		// Determine organization
		const organization = this.inferOrganization(sourceConfig);

		// Determine criticality
		const criticality = this.inferCriticality(sourceConfig);

		// Determine cadence
		const cadence = this.inferCadence(sourceConfig);

		const record: SourceMonitoringRecord = {
			sourceId: sourceConfig.sourceId,
			canonicalUrl: sourceConfig.url,
			rings: sourceConfig.ringAffinity,
			researchDomains: sourceConfig.researchDomains,
			sourceFamily,
			organization,
			criticality,
			cadence,
			adapterId: this.inferAdapterId(sourceConfig.type),
			accessMethod: this.inferAccessMethod(sourceConfig.type),
			requestedAt,
			checkedAt,
			checkTimezone,
			sourcePublicationTimestamps,
			latestItemPublishedAt,
			status: retrievalResult.status,
			discoveredCandidateIds: retrievalResult.items.map(
				(item) => item.id,
			),
			newItemCount: retrievalResult.newItemCount,
			updatedItemCount: retrievalResult.updatedItemCount,
			sourceUrls: retrievalResult.items.map((item) => item.url),
			evidenceReferences,
			errors,
			accessLimitations,
			incompleteResults,
			executionId,
			editionDate,
			scheduled,
			durationMs: retrievalResult.metadata.durationMs,
			attemptNumber,
			isRetry,
			previousExecutionId,
		};

		this.currentRecords.push(record);
		return record;
	}

	/**
	 * Record a source that was NOT checked (NOT_CHECKED status)
	 */
	recordNotChecked(
		sourceConfig: SourceConfig,
		executionId: string,
		editionDate: string,
		reason: string,
	): SourceMonitoringRecord {
		const checkedAt = new Date().toISOString();

		const record: SourceMonitoringRecord = {
			sourceId: sourceConfig.sourceId,
			canonicalUrl: sourceConfig.url,
			rings: sourceConfig.ringAffinity,
			researchDomains: sourceConfig.researchDomains,
			sourceFamily: this.inferSourceFamily(sourceConfig),
			organization: this.inferOrganization(sourceConfig),
			criticality: this.inferCriticality(sourceConfig),
			cadence: this.inferCadence(sourceConfig),
			adapterId: this.inferAdapterId(sourceConfig.type),
			accessMethod: this.inferAccessMethod(sourceConfig.type),
			requestedAt: checkedAt,
			checkedAt,
			checkTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			sourcePublicationTimestamps: [],
			status: "NOT_CHECKED",
			discoveredCandidateIds: [],
			newItemCount: 0,
			updatedItemCount: 0,
			sourceUrls: [],
			evidenceReferences: [],
			errors: [
				{
					code: "NOT_SCHEDULED",
					message: reason,
					url: sourceConfig.url,
					timestamp: checkedAt,
					retryable: false,
					category: "unknown",
				},
			],
			accessLimitations: [],
			executionId,
			editionDate,
			scheduled: false,
			durationMs: 0,
			attemptNumber: 1,
			isRetry: false,
		};

		this.currentRecords.push(record);
		return record;
	}

	/**
	 * Record candidate traceability
	 */
	recordCandidateTraceability(
		candidateId: string,
		editionDate: string,
		sourceDiscoveries: SourceDiscoveryLink[],
		noveltyClassification: NoveltyClassificationLink,
		evidenceVerification: EvidenceVerificationLink[],
		editorialDisposition: EditorialDispositionLink,
	): CandidateTraceabilityRecord {
		const traceabilityChain = this.buildTraceabilityChain(
			candidateId,
			sourceDiscoveries,
			noveltyClassification,
			evidenceVerification,
			editorialDisposition,
		);

		const record: CandidateTraceabilityRecord = {
			candidateId,
			editionDate,
			sourceDiscoveries,
			noveltyClassification,
			evidenceVerification,
			editorialDisposition,
			traceabilityChain,
		};

		this.currentCandidateTraceability.push(record);
		return record;
	}

	/**
	 * Complete the current execution and persist the ledger entry
	 */
	async completeExecution(): Promise<DiscoveryLedgerEntry> {
		if (!this.currentExecution) {
			throw new Error("No active execution to complete");
		}

		const completedAt = new Date().toISOString();
		this.currentExecution.completedAt = completedAt;

		// Calculate coverage metrics
		const coverageMetrics = this.calculateCoverageMetrics(
			this.currentExecution.editionDate,
		);

		// Detect anomalies
		const anomalies = await this.detectAnomalies(
			this.currentExecution.editionDate,
			this.currentRecords,
		);

		// Build ledger entry
		const entry: DiscoveryLedgerEntry = {
			version: "1.0.0",
			createdAt: completedAt,
			executionContext: this.currentExecution,
			sourceRecords: this.currentRecords,
			coverageMetrics,
			candidateTraceability: this.currentCandidateTraceability,
			anomalies,
		};

		// Persist to disk
		await this.persistEntry(entry);

		// Clean up old history
		await this.pruneHistory();

		// Reset current execution
		this.currentExecution = null;
		this.currentRecords = [];
		this.currentCandidateTraceability = [];

		return entry;
	}

	/**
	 * Calculate coverage metrics from current records
	 */
	private calculateCoverageMetrics(editionDate: string): CoverageMetrics {
		const records = this.currentRecords;
		const scheduledRecords = records.filter((r) => r.scheduled);
		const attemptedRecords = records.filter(
			(r) => r.status !== "NOT_CHECKED",
		);

		// By Ring
		const byRing = this.calculateRingCoverage(
			records,
			scheduledRecords,
			attemptedRecords,
		);

		// By Domain
		const byDomain = this.calculateDomainCoverage(
			records,
			scheduledRecords,
			attemptedRecords,
		);

		// By Source Family
		const bySourceFamily = this.calculateSourceFamilyCoverage(
			records,
			scheduledRecords,
			attemptedRecords,
		);

		// By Organization
		const byOrganization = this.calculateOrganizationCoverage(
			records,
			scheduledRecords,
			attemptedRecords,
		);

		// By Criticality
		const byCriticality = this.calculateCriticalityCoverage(
			records,
			scheduledRecords,
			attemptedRecords,
		);

		// By Cadence
		const byCadence = this.calculateCadenceCoverage(
			records,
			scheduledRecords,
			attemptedRecords,
		);

		// Overall
		const overall = this.calculateOverallCoverage(
			records,
			scheduledRecords,
			attemptedRecords,
		);

		// Missing high-value sources
		const missingHighValueSources =
			this.identifyMissingHighValueSources(records);

		// Critical unvisited sources
		const criticalUnvisitedSources =
			this.identifyCriticalUnvisitedSources(records);

		return {
			byRing,
			byDomain,
			bySourceFamily,
			byOrganization,
			byCriticality,
			byCadence,
			overall,
			missingHighValueSources,
			criticalUnvisitedSources,
		};
	}

	private calculateRingCoverage(
		allRecords: SourceMonitoringRecord[],
		scheduled: SourceMonitoringRecord[],
		attempted: SourceMonitoringRecord[],
	): RingCoverage[] {
		const rings: DiscoveryRing[] = [1, 2, 3];
		return rings.map((ring) => {
			const ringRecords = allRecords.filter((r) =>
				r.rings.includes(ring),
			);
			const ringScheduled = scheduled.filter((r) =>
				r.rings.includes(ring),
			);
			const ringAttempted = attempted.filter((r) =>
				r.rings.includes(ring),
			);
			const ringSuccessful = ringAttempted.filter(
				(r) =>
					r.status === "CHECKED_FOUND" || r.status === "CHECKED_NONE",
			);
			const ringWithFindings = ringAttempted.filter(
				(r) => r.status === "CHECKED_FOUND",
			);
			const ringEmpty = ringAttempted.filter(
				(r) => r.status === "CHECKED_NONE",
			);
			const ringInaccessible = ringAttempted.filter(
				(r) => r.status === "INACCESSIBLE",
			);
			const ringNotChecked = ringRecords.filter(
				(r) => r.status === "NOT_CHECKED",
			);
			const ringError = ringAttempted.filter((r) => r.status === "ERROR");

			const totalItems = ringAttempted.reduce(
				(sum, r) => sum + r.newItemCount + r.updatedItemCount,
				0,
			);
			const totalNew = ringAttempted.reduce(
				(sum, r) => sum + r.newItemCount,
				0,
			);

			return {
				ring,
				sourcesRegistered: ringRecords.length,
				sourcesScheduled: ringScheduled.length,
				sourcesAttempted: ringAttempted.length,
				sourcesSuccessful: ringSuccessful.length,
				sourcesWithFindings: ringWithFindings.length,
				sourcesEmpty: ringEmpty.length,
				sourcesInaccessible: ringInaccessible.length,
				sourcesNotChecked: ringNotChecked.length,
				sourcesError: ringError.length,
				coveragePercent:
					ringScheduled.length > 0
						? (ringAttempted.length / ringScheduled.length) * 100
						: 0,
				successRatePercent:
					ringAttempted.length > 0
						? (ringSuccessful.length / ringAttempted.length) * 100
						: 0,
				totalItemsDiscovered: totalItems,
				totalNewItems: totalNew,
			};
		});
	}

	private calculateDomainCoverage(
		allRecords: SourceMonitoringRecord[],
		scheduled: SourceMonitoringRecord[],
		attempted: SourceMonitoringRecord[],
	): DomainCoverage[] {
		const domainMap = new Map<
			string,
			{ label: string; records: SourceMonitoringRecord[] }
		>();

		for (const record of allRecords) {
			for (const domain of record.researchDomains) {
				const existing = domainMap.get(domain) || {
					label: domain,
					records: [],
				};
				existing.records.push(record);
				domainMap.set(domain, existing);
			}
		}

		return Array.from(domainMap.entries()).map(
			([domainId, { label, records }]) => {
				const domainScheduled = scheduled.filter((r) =>
					r.researchDomains.includes(domainId),
				);
				const domainAttempted = attempted.filter((r) =>
					r.researchDomains.includes(domainId),
				);
				const domainSuccessful = domainAttempted.filter(
					(r) =>
						r.status === "CHECKED_FOUND" ||
						r.status === "CHECKED_NONE",
				);
				const domainWithFindings = domainAttempted.filter(
					(r) => r.status === "CHECKED_FOUND",
				);
				const domainInaccessible = domainAttempted.filter(
					(r) => r.status === "INACCESSIBLE",
				);
				const domainNotChecked = records.filter(
					(r) => r.status === "NOT_CHECKED",
				);

				const totalItems = domainAttempted.reduce(
					(sum, r) => sum + r.newItemCount + r.updatedItemCount,
					0,
				);
				const ringsCovered = [
					...new Set(domainAttempted.flatMap((r) => r.rings)),
				].sort((a, b) => a - b);

				return {
					domainId,
					domainLabel: label,
					sourcesRegistered: records.length,
					sourcesScheduled: domainScheduled.length,
					sourcesAttempted: domainAttempted.length,
					sourcesSuccessful: domainSuccessful.length,
					sourcesWithFindings: domainWithFindings.length,
					sourcesInaccessible: domainInaccessible.length,
					sourcesNotChecked: domainNotChecked.length,
					coveragePercent:
						domainScheduled.length > 0
							? (domainAttempted.length /
									domainScheduled.length) *
								100
							: 0,
					successRatePercent:
						domainAttempted.length > 0
							? (domainSuccessful.length /
									domainAttempted.length) *
								100
							: 0,
					totalItemsDiscovered: totalItems,
					ringsCovered,
				};
			},
		);
	}

	private calculateSourceFamilyCoverage(
		allRecords: SourceMonitoringRecord[],
		scheduled: SourceMonitoringRecord[],
		attempted: SourceMonitoringRecord[],
	): SourceFamilyCoverage[] {
		const familyMap = new Map<SourceFamily, SourceMonitoringRecord[]>();

		for (const record of allRecords) {
			const existing = familyMap.get(record.sourceFamily) || [];
			existing.push(record);
			familyMap.set(record.sourceFamily, existing);
		}

		return Array.from(familyMap.entries()).map(([family, records]) => {
			const familyScheduled = scheduled.filter(
				(r) => r.sourceFamily === family,
			);
			const familyAttempted = attempted.filter(
				(r) => r.sourceFamily === family,
			);
			const familySuccessful = familyAttempted.filter(
				(r) =>
					r.status === "CHECKED_FOUND" || r.status === "CHECKED_NONE",
			);
			const familyWithFindings = familyAttempted.filter(
				(r) => r.status === "CHECKED_FOUND",
			);
			const familyInaccessible = familyAttempted.filter(
				(r) => r.status === "INACCESSIBLE",
			);
			const familyNotChecked = records.filter(
				(r) => r.status === "NOT_CHECKED",
			);

			const organizations = [
				...new Set(records.map((r) => r.organization)),
			];
			const ringsCovered = [
				...new Set(familyAttempted.flatMap((r) => r.rings)),
			].sort((a, b) => a - b);
			const domainsCovered = [
				...new Set(familyAttempted.flatMap((r) => r.researchDomains)),
			];

			return {
				family,
				sourcesRegistered: records.length,
				sourcesScheduled: familyScheduled.length,
				sourcesAttempted: familyAttempted.length,
				sourcesSuccessful: familySuccessful.length,
				sourcesWithFindings: familyWithFindings.length,
				sourcesInaccessible: familyInaccessible.length,
				sourcesNotChecked: familyNotChecked.length,
				coveragePercent:
					familyScheduled.length > 0
						? (familyAttempted.length / familyScheduled.length) *
							100
						: 0,
				successRatePercent:
					familyAttempted.length > 0
						? (familySuccessful.length / familyAttempted.length) *
							100
						: 0,
				organizations,
				ringsCovered,
				domainsCovered,
			};
		});
	}

	private calculateOrganizationCoverage(
		allRecords: SourceMonitoringRecord[],
		scheduled: SourceMonitoringRecord[],
		attempted: SourceMonitoringRecord[],
	): OrganizationCoverage[] {
		const orgMap = new Map<string, SourceMonitoringRecord[]>();

		for (const record of allRecords) {
			const existing = orgMap.get(record.organization) || [];
			existing.push(record);
			orgMap.set(record.organization, existing);
		}

		return Array.from(orgMap.entries()).map(([organization, records]) => {
			const orgScheduled = scheduled.filter(
				(r) => r.organization === organization,
			);
			const orgAttempted = attempted.filter(
				(r) => r.organization === organization,
			);
			const orgSuccessful = orgAttempted.filter(
				(r) =>
					r.status === "CHECKED_FOUND" || r.status === "CHECKED_NONE",
			);
			const orgWithFindings = orgAttempted.filter(
				(r) => r.status === "CHECKED_FOUND",
			);
			const orgInaccessible = orgAttempted.filter(
				(r) => r.status === "INACCESSIBLE",
			);
			const orgNotChecked = records.filter(
				(r) => r.status === "NOT_CHECKED",
			);

			const sourceFamilies = [
				...new Set(records.map((r) => r.sourceFamily)),
			];
			const criticalityLevels = [
				...new Set(records.map((r) => r.criticality)),
			];

			return {
				organization,
				sourcesRegistered: records.length,
				sourcesScheduled: orgScheduled.length,
				sourcesAttempted: orgAttempted.length,
				sourcesSuccessful: orgSuccessful.length,
				sourcesWithFindings: orgWithFindings.length,
				sourcesInaccessible: orgInaccessible.length,
				sourcesNotChecked: orgNotChecked.length,
				coveragePercent:
					orgScheduled.length > 0
						? (orgAttempted.length / orgScheduled.length) * 100
						: 0,
				successRatePercent:
					orgAttempted.length > 0
						? (orgSuccessful.length / orgAttempted.length) * 100
						: 0,
				sourceFamilies,
				criticalityLevels,
			};
		});
	}

	private calculateCriticalityCoverage(
		allRecords: SourceMonitoringRecord[],
		scheduled: SourceMonitoringRecord[],
		attempted: SourceMonitoringRecord[],
	): CriticalityCoverage[] {
		const criticalities: CriticalityLevel[] = [
			"mandatory",
			"high",
			"standard",
			"supplementary",
		];

		return criticalities.map((criticality) => {
			const critRecords = allRecords.filter(
				(r) => r.criticality === criticality,
			);
			const critScheduled = scheduled.filter(
				(r) => r.criticality === criticality,
			);
			const critAttempted = attempted.filter(
				(r) => r.criticality === criticality,
			);
			const critSuccessful = critAttempted.filter(
				(r) =>
					r.status === "CHECKED_FOUND" || r.status === "CHECKED_NONE",
			);
			const critWithFindings = critAttempted.filter(
				(r) => r.status === "CHECKED_FOUND",
			);
			const critInaccessible = critAttempted.filter(
				(r) => r.status === "INACCESSIBLE",
			);
			const critNotChecked = critRecords.filter(
				(r) => r.status === "NOT_CHECKED",
			);

			const mandatorySourcesAllChecked =
				criticality === "mandatory"
					? critScheduled.every((r) => r.status !== "NOT_CHECKED")
					: true;

			return {
				criticality,
				sourcesRegistered: critRecords.length,
				sourcesScheduled: critScheduled.length,
				sourcesAttempted: critAttempted.length,
				sourcesSuccessful: critSuccessful.length,
				sourcesWithFindings: critWithFindings.length,
				sourcesInaccessible: critInaccessible.length,
				sourcesNotChecked: critNotChecked.length,
				coveragePercent:
					critScheduled.length > 0
						? (critAttempted.length / critScheduled.length) * 100
						: 0,
				mandatorySourcesAllChecked,
			};
		});
	}

	private calculateCadenceCoverage(
		allRecords: SourceMonitoringRecord[],
		scheduled: SourceMonitoringRecord[],
		attempted: SourceMonitoringRecord[],
	): CadenceCoverage[] {
		const cadences: MonitoringCadence[] = [
			"continuous",
			"daily",
			"weekly",
			"bi-weekly",
			"monthly",
			"quarterly",
			"manual",
		];

		return cadences.map((cadence) => {
			const cadRecords = allRecords.filter((r) => r.cadence === cadence);
			const cadScheduled = scheduled.filter((r) => r.cadence === cadence);
			const cadAttempted = attempted.filter((r) => r.cadence === cadence);
			const cadSuccessful = cadAttempted.filter(
				(r) =>
					r.status === "CHECKED_FOUND" || r.status === "CHECKED_NONE",
			);
			const cadInaccessible = cadAttempted.filter(
				(r) => r.status === "INACCESSIBLE",
			);
			const cadNotChecked = cadRecords.filter(
				(r) => r.status === "NOT_CHECKED",
			);

			// For simplicity, overdue = scheduled but not checked
			const overdueCount = cadScheduled.filter(
				(r) => r.status === "NOT_CHECKED",
			).length;

			return {
				cadence,
				sourcesRegistered: cadRecords.length,
				sourcesScheduled: cadScheduled.length,
				sourcesAttempted: cadAttempted.length,
				sourcesSuccessful: cadSuccessful.length,
				sourcesInaccessible: cadInaccessible.length,
				sourcesNotChecked: cadNotChecked.length,
				coveragePercent:
					cadScheduled.length > 0
						? (cadAttempted.length / cadScheduled.length) * 100
						: 0,
				overdueCount,
			};
		});
	}

	private calculateOverallCoverage(
		allRecords: SourceMonitoringRecord[],
		scheduled: SourceMonitoringRecord[],
		attempted: SourceMonitoringRecord[],
	): OverallCoverage {
		const successful = attempted.filter(
			(r) => r.status === "CHECKED_FOUND" || r.status === "CHECKED_NONE",
		);
		const withFindings = attempted.filter(
			(r) => r.status === "CHECKED_FOUND",
		);
		const inaccessible = attempted.filter(
			(r) => r.status === "INACCESSIBLE",
		);
		const notChecked = allRecords.filter((r) => r.status === "NOT_CHECKED");
		const error = attempted.filter((r) => r.status === "ERROR");

		const totalItems = attempted.reduce(
			(sum, r) => sum + r.newItemCount + r.updatedItemCount,
			0,
		);
		const totalNew = attempted.reduce((sum, r) => sum + r.newItemCount, 0);
		const executionDuration = allRecords.reduce(
			(sum, r) => sum + r.durationMs,
			0,
		);
		const ringsCovered = [
			...new Set(attempted.flatMap((r) => r.rings)),
		].sort((a, b) => a - b);
		const domainsCovered = [
			...new Set(attempted.flatMap((r) => r.researchDomains)),
		].length;
		const sourceFamiliesCovered = [
			...new Set(attempted.map((r) => r.sourceFamily)),
		].length;
		const organizationsCovered = [
			...new Set(attempted.map((r) => r.organization)),
		].length;

		return {
			totalSourcesRegistered: allRecords.length,
			totalSourcesScheduled: scheduled.length,
			totalSourcesAttempted: attempted.length,
			totalSourcesSuccessful: successful.length,
			totalSourcesWithFindings: withFindings.length,
			totalSourcesInaccessible: inaccessible.length,
			totalSourcesNotChecked: notChecked.length,
			totalSourcesError: error.length,
			overallCoveragePercent:
				scheduled.length > 0
					? (attempted.length / scheduled.length) * 100
					: 0,
			overallSuccessRatePercent:
				attempted.length > 0
					? (successful.length / attempted.length) * 100
					: 0,
			totalItemsDiscovered: totalItems,
			totalNewItems: totalNew,
			executionDurationMs: executionDuration,
			ringsCovered,
			domainsCovered,
			sourceFamiliesCovered,
			organizationsCovered,
		};
	}

	private identifyMissingHighValueSources(
		records: SourceMonitoringRecord[],
	): MissingSource[] {
		// This would ideally cross-reference with the source registry
		// For now, identify sources that were scheduled but not checked, or consistently inaccessible
		const missing: MissingSource[] = [];

		// Sources that were scheduled but not checked
		const notChecked = records.filter(
			(r) => r.scheduled && r.status === "NOT_CHECKED",
		);
		for (const record of notChecked) {
			missing.push({
				sourceId: record.sourceId,
				sourceFamily: record.sourceFamily,
				organization: record.organization,
				researchDomains: record.researchDomains,
				rings: record.rings,
				criticality: record.criticality,
				reason: "scheduled-but-not-checked",
				impactAssessment:
					record.criticality === "mandatory"
						? "critical"
						: record.criticality === "high"
							? "high"
							: "medium",
			});
		}

		// Also detect mandatory/high criticality sources that are NOT_CHECKED even if not explicitly scheduled
		// (e.g., mandatory sources that should have been checked but weren't)
		const criticalNotChecked = records.filter(
			(r) =>
				!r.scheduled &&
				r.status === "NOT_CHECKED" &&
				(r.criticality === "mandatory" || r.criticality === "high"),
		);
		for (const record of criticalNotChecked) {
			missing.push({
				sourceId: record.sourceId,
				sourceFamily: record.sourceFamily,
				organization: record.organization,
				researchDomains: record.researchDomains,
				rings: record.rings,
				criticality: record.criticality,
				reason: "scheduled-but-not-checked",
				impactAssessment:
					record.criticality === "mandatory" ? "critical" : "high",
			});
		}

		// Sources that are consistently inaccessible
		const inaccessible = records.filter(
			(r) => r.scheduled && r.status === "INACCESSIBLE",
		);
		for (const record of inaccessible) {
			missing.push({
				sourceId: record.sourceId,
				sourceFamily: record.sourceFamily,
				organization: record.organization,
				researchDomains: record.researchDomains,
				rings: record.rings,
				criticality: record.criticality,
				reason: "scheduled-but-failed",
				impactAssessment:
					record.criticality === "mandatory"
						? "critical"
						: record.criticality === "high"
							? "high"
							: "medium",
			});
		}

		return missing;
	}

	private identifyCriticalUnvisitedSources(
		records: SourceMonitoringRecord[],
	): string[] {
		// Sources with mandatory/high criticality that were never even scheduled
		// This would require registry cross-reference; placeholder for now
		return records
			.filter(
				(r) =>
					(r.criticality === "mandatory" ||
						r.criticality === "high") &&
					r.status === "NOT_CHECKED",
			)
			.map((r) => r.sourceId);
	}

	/**
	 * Detect anomalies for regression detection
	 */
	private async detectAnomalies(
		editionDate: string,
		records: SourceMonitoringRecord[],
	): Promise<MonitoringAnomaly[]> {
		const anomalies: MonitoringAnomaly[] = [];
		const detectedAt = new Date().toISOString();

		// Load previous execution for comparison
		const previousEntry = await this.loadMostRecentEntry(editionDate);

		if (previousEntry) {
			// ... rest of the method
			// Check for missed scheduled checks
			const previousScheduled = previousEntry.sourceRecords.filter(
				(r) => r.scheduled,
			);
			const currentScheduled = records.filter((r) => r.scheduled);

			for (const prevRecord of previousScheduled) {
				const currentRecord = currentScheduled.find(
					(r) => r.sourceId === prevRecord.sourceId,
				);
				if (!currentRecord) {
					anomalies.push({
						type: "missed-scheduled-check",
						severity:
							prevRecord.criticality === "mandatory"
								? "critical"
								: "warning",
						sourceId: prevRecord.sourceId,
						description: `Source ${prevRecord.sourceId} was scheduled in previous execution but not in current`,
						detectedAt,
						details: {
							previousExecutionId:
								previousEntry.executionContext.executionId,
							previousEditionDate:
								previousEntry.executionContext.editionDate,
							criticality: prevRecord.criticality,
						},
						suggestedAction:
							"Verify source configuration and scheduling",
					});
				} else if (
					currentRecord.status === "NOT_CHECKED" &&
					prevRecord.status !== "NOT_CHECKED"
				) {
					anomalies.push({
						type: "missed-scheduled-check",
						severity:
							currentRecord.criticality === "mandatory"
								? "critical"
								: "warning",
						sourceId: currentRecord.sourceId,
						description: `Source ${currentRecord.sourceId} was checked previously but not in current execution`,
						detectedAt,
						details: {
							previousExecutionId:
								previousEntry.executionContext.executionId,
							previousStatus: prevRecord.status,
							criticality: currentRecord.criticality,
						},
						suggestedAction: "Investigate why source was skipped",
					});
				}
			}

			// Check for recurring failures
			for (const record of records) {
				if (
					record.status === "INACCESSIBLE" ||
					record.status === "ERROR"
				) {
					const prevRecord = previousEntry.sourceRecords.find(
						(r) => r.sourceId === record.sourceId,
					);
					if (
						prevRecord &&
						(prevRecord.status === "INACCESSIBLE" ||
							prevRecord.status === "ERROR")
					) {
						anomalies.push({
							type: "recurring-failure",
							severity:
								record.criticality === "mandatory"
									? "critical"
									: "warning",
							sourceId: record.sourceId,
							description: `Source ${record.sourceId} has failed in consecutive executions`,
							detectedAt,
							details: {
								currentStatus: record.status,
								previousStatus: prevRecord.status,
								currentErrors: record.errors.map((e) => e.code),
								previousErrors: prevRecord.errors.map(
									(e) => e.code,
								),
								criticality: record.criticality,
							},
							suggestedAction:
								"Investigate persistent access issues; consider alternative access method",
						});
					}
				}
			}

			// Check for coverage deterioration
			const prevCoverage =
				previousEntry.coverageMetrics.overall.overallCoveragePercent;
			const currentCoverage = this.calculateOverallCoverage(
				records,
				records.filter((r) => r.scheduled),
				records.filter((r) => r.status !== "NOT_CHECKED"),
			).overallCoveragePercent;

			if (currentCoverage < prevCoverage - 10) {
				// 10% threshold
				anomalies.push({
					type: "coverage-deterioration",
					severity: "warning",
					description: `Overall coverage dropped from ${prevCoverage.toFixed(1)}% to ${currentCoverage.toFixed(1)}%`,
					detectedAt,
					details: {
						previousCoverage: prevCoverage,
						currentCoverage: currentCoverage,
						dropPercent: prevCoverage - currentCoverage,
					},
					suggestedAction:
						"Review sources that were not checked; investigate scheduling issues",
				});
			}

			// Check for outdated configurations (sources with access limitations that persist)
			for (const record of records) {
				if (record.accessLimitations.length > 0) {
					const prevRecord = previousEntry.sourceRecords.find(
						(r) => r.sourceId === record.sourceId,
					);
					if (prevRecord && prevRecord.accessLimitations.length > 0) {
						const sameLimitations = record.accessLimitations.some(
							(al) =>
								prevRecord.accessLimitations.some(
									(pal) => pal.type === al.type,
								),
						);
						if (sameLimitations) {
							anomalies.push({
								type: "outdated-configuration",
								severity: "info",
								sourceId: record.sourceId,
								description: `Source ${record.sourceId} has persistent access limitations`,
								detectedAt,
								details: {
									limitations: record.accessLimitations.map(
										(al) => al.type,
									),
									firstObserved:
										record.accessLimitations[0]
											?.firstObserved,
								},
								suggestedAction:
									"Review source configuration; consider alternative source or access method",
							});
						}
					}
				}
			}

			// Check for new inaccessible sources
			for (const record of records) {
				if (record.status === "INACCESSIBLE") {
					const prevRecord = previousEntry.sourceRecords.find(
						(r) => r.sourceId === record.sourceId,
					);
					if (prevRecord && prevRecord.status !== "INACCESSIBLE") {
						anomalies.push({
							type: "new-inaccessible-source",
							severity:
								record.criticality === "mandatory"
									? "critical"
									: "warning",
							sourceId: record.sourceId,
							description: `Source ${record.sourceId} became inaccessible (was ${prevRecord.status} previously)`,
							detectedAt,
							details: {
								previousStatus: prevRecord.status,
								currentErrors: record.errors.map((e) => e.code),
								accessLimitations: record.accessLimitations.map(
									(al) => al.type,
								),
								criticality: record.criticality,
							},
							suggestedAction:
								"Investigate access change; verify if temporary or permanent",
						});
					}
				}
			}

			// Check for unexpected zero findings (previously had findings)
			for (const record of records) {
				if (
					record.status === "CHECKED_NONE" &&
					record.newItemCount === 0
				) {
					const prevRecord = previousEntry.sourceRecords.find(
						(r) => r.sourceId === record.sourceId,
					);
					if (
						prevRecord &&
						prevRecord.status === "CHECKED_FOUND" &&
						prevRecord.newItemCount > 0
					) {
						anomalies.push({
							type: "unexpected-zero-findings",
							severity: "info",
							sourceId: record.sourceId,
							description: `Source ${record.sourceId} returned zero findings (previously had ${prevRecord.newItemCount})`,
							detectedAt,
							details: {
								previousItemCount: prevRecord.newItemCount,
								currentItemCount: 0,
								timeSinceLastFinding:
									prevRecord.latestItemPublishedAt
										? new Date().getTime() -
											new Date(
												prevRecord.latestItemPublishedAt,
											).getTime()
										: null,
							},
							suggestedAction:
								"Verify source is still publishing; check if feed changed",
						});
					}
				}
			}

			// Check for execution delay
			const prevStarted = new Date(
				previousEntry.executionContext.startedAt,
			).getTime();
			const currentStarted = new Date().getTime();
			const delayHours =
				(currentStarted - prevStarted) / (1000 * 60 * 60);
			if (delayHours > 36) {
				// More than 36 hours between executions
				anomalies.push({
					type: "execution-delay",
					severity: "warning",
					description: `Execution delayed by ${delayHours.toFixed(1)} hours since previous run`,
					detectedAt,
					details: {
						previousExecutionId:
							previousEntry.executionContext.executionId,
						previousStartedAt:
							previousEntry.executionContext.startedAt,
						delayHours,
					},
					suggestedAction:
						"Check scheduler; verify cron/trigger is functioning",
				});
			}
		}

		// Check for duplicate execution (same edition date)
		const existingEntry = await this.loadEntryForEdition(editionDate);
		if (
			existingEntry &&
			existingEntry.executionContext.executionId !==
				this.currentExecution?.executionId
		) {
			anomalies.push({
				type: "duplicate-execution",
				severity: "critical",
				description: `Duplicate execution for edition ${editionDate} detected`,
				detectedAt,
				details: {
					previousExecutionId:
						existingEntry.executionContext.executionId,
					currentExecutionId: this.currentExecution?.executionId,
				},
				suggestedAction:
					"Investigate scheduler; ensure idempotent execution",
			});
		}

		return anomalies;
	}

	/**
	 * Persist ledger entry to disk
	 */
	private async persistEntry(entry: DiscoveryLedgerEntry): Promise<void> {
		await fs.mkdir(this.ledgerDir, { recursive: true });

		const filename = `${entry.executionContext.editionDate}_${entry.executionContext.executionId.slice(0, 8)}.json`;
		const filepath = path.join(this.ledgerDir, filename);

		await fs.writeFile(filepath, JSON.stringify(entry, null, 2), "utf-8");
	}

	/**
	 * Load most recent ledger entry before a given edition date
	 */
	private async loadMostRecentEntry(
		beforeEditionDate: string,
	): Promise<DiscoveryLedgerEntry | null> {
		try {
			const files = await fs.readdir(this.ledgerDir);
			const entries: DiscoveryLedgerEntry[] = [];

			for (const file of files) {
				if (file.endsWith(".json")) {
					const content = await fs.readFile(
						path.join(this.ledgerDir, file),
						"utf-8",
					);
					const entry = JSON.parse(content) as DiscoveryLedgerEntry;
					if (
						entry.executionContext.editionDate < beforeEditionDate
					) {
						entries.push(entry);
					}
				}
			}

			if (entries.length === 0) return null;

			entries.sort((a, b) =>
				b.executionContext.editionDate.localeCompare(
					a.executionContext.editionDate,
				),
			);
			return entries[0];
		} catch {
			return null;
		}
	}

	/**
	 * Load ledger entry for a specific edition date
	 */
	private async loadEntryForEdition(
		editionDate: string,
	): Promise<DiscoveryLedgerEntry | null> {
		try {
			const files = await fs.readdir(this.ledgerDir);
			for (const file of files) {
				if (file.startsWith(editionDate) && file.endsWith(".json")) {
					const content = await fs.readFile(
						path.join(this.ledgerDir, file),
						"utf-8",
					);
					return JSON.parse(content) as DiscoveryLedgerEntry;
				}
			}
			return null;
		} catch {
			return null;
		}
	}

	/**
	 * Prune old history files beyond retention
	 */
	private async pruneHistory(): Promise<void> {
		try {
			const files = await fs.readdir(this.ledgerDir);
			const jsonFiles = files.filter((f) => f.endsWith(".json"));

			// Parse dates from filenames
			const fileDates = jsonFiles
				.map((f) => {
					const dateStr = f.split("_")[0];
					const date = new Date(dateStr);
					return { file: f, date: date.getTime() };
				})
				.filter((f) => !isNaN(f.date))
				.sort((a, b) => b.date - a.date); // Newest first

			// Keep only maxHistoryFiles
			if (fileDates.length > this.maxHistoryFiles) {
				const toDelete = fileDates.slice(this.maxHistoryFiles);
				for (const { file } of toDelete) {
					await fs.unlink(path.join(this.ledgerDir, file));
				}
			}

			// Also delete files older than retention period
			// Only delete files with dates in the past (not future dates)
			const now = Date.now();
			const cutoffTime =
				now - this.historyRetentionDays * 24 * 60 * 60 * 1000;
			for (const { file, date } of fileDates) {
				// Skip files with future dates (edition dates in the future)
				if (date > now) {
					continue;
				}
				if (date < cutoffTime) {
					await fs.unlink(path.join(this.ledgerDir, file));
				}
			}
		} catch {
			// Ignore pruning errors
		}
	}

	/**
	 * Build evidence references from retrieval result
	 */
	private buildEvidenceReferences(
		result: RetrievalResult,
	): EvidenceReference[] {
		const references: EvidenceReference[] = [];

		for (const item of result.items) {
			references.push({
				type: this.inferEvidenceType(result.sourceConfig.type),
				locator: item.url,
				description: `Item: ${item.title}`,
				timestamp: item.publishedAt,
				confidence: item.timestampConfidence || 0.9,
			});
		}

		return references;
	}

	/**
	 * Build monitoring errors from retrieval errors
	 */
	private buildMonitoringErrors(
		errors: RetrievalError[],
		sourceUrl: string,
	): MonitoringError[] {
		return errors.map((error) => ({
			code: error.code,
			message: error.message,
			statusCode: error.statusCode,
			url: error.url || sourceUrl,
			timestamp: error.timestamp,
			retryable: error.retryable,
			category: this.categorizeError(error),
			context: error.context,
		}));
	}

	/**
	 * Categorize error for analysis
	 */
	private categorizeError(
		error: RetrievalError,
	): MonitoringError["category"] {
		if (error.statusCode) {
			if (error.statusCode === 401 || error.statusCode === 403)
				return "authentication";
			if (error.statusCode === 429) return "rate-limit";
			if (error.statusCode >= 500) return "network";
			if (error.statusCode === 408) return "timeout";
		}
		if (error.code.includes("PARSE") || error.code.includes("VALIDATION"))
			return "parsing";
		if (error.code.includes("CONTENT")) return "content";
		if (error.retryable) return "network";
		return "unknown";
	}

	/**
	 * Detect access limitations from retrieval result
	 */
	private detectAccessLimitations(
		result: RetrievalResult,
		config: SourceConfig,
	): AccessLimitation[] {
		const limitations: AccessLimitation[] = [];
		const now = new Date().toISOString();

		// Check for Cloudflare protection (specific patterns)
		const hasCloudflareError = result.errors.some(
			(e) =>
				e.message.toLowerCase().includes("cloudflare") ||
				(e.statusCode === 503 &&
					e.message.toLowerCase().includes("ray id")),
		);

		if (hasCloudflareError) {
			limitations.push({
				type: "cloudflare-protection",
				description:
					"Source protected by Cloudflare bot mitigation; requires browser-like headers or manual review",
				affectedSections: [config.url],
				workaround:
					"Use browser-like fetcher (Playwright/Puppeteer) or Feeder-generated feed",
				severity: "blocks-all",
				firstObserved: now,
				lastObserved: now,
			});
		}

		// Check for paywall/authentication (401, 403 with auth context)
		const hasAuthError = result.errors.some((e) => {
			if (e.statusCode === 401) return true;
			if (e.statusCode === 403) {
				// Check if message indicates auth/paywall rather than bot protection
				const msg = e.message.toLowerCase();
				return (
					msg.includes("unauthorized") ||
					msg.includes("forbidden") ||
					msg.includes("authentication") ||
					msg.includes("subscription") ||
					msg.includes("paywall") ||
					msg.includes("login") ||
					msg.includes("access denied") ||
					e.code?.toLowerCase().includes("auth")
				);
			}
			return (
				e.message.toLowerCase().includes("unauthorized") ||
				e.message.toLowerCase().includes("forbidden") ||
				e.message.toLowerCase().includes("paywall") ||
				e.message.toLowerCase().includes("subscription required")
			);
		});

		if (hasAuthError && !hasCloudflareError) {
			limitations.push({
				type: "authentication-required",
				description: "Source requires authentication or subscription",
				affectedSections: [config.url],
				severity: "blocks-all",
				firstObserved: now,
				lastObserved: now,
			});
		}

		// Check for rate limiting
		const hasRateLimit = result.errors.some((e) => e.statusCode === 429);
		if (hasRateLimit) {
			limitations.push({
				type: "rate-limited",
				description:
					"Source enforces rate limits that prevent complete retrieval",
				affectedSections: [config.url],
				workaround:
					"Implement exponential backoff; request rate limit increase",
				severity: "degrades-quality",
				firstObserved: now,
				lastObserved: now,
			});
		}

		// Check for no native RSS (common for AI lab blogs)
		if (
			config.type === "blog" &&
			config.url.includes("rss") &&
			result.status === "ERROR"
		) {
			const hasFeedError = result.errors.some(
				(e) =>
					e.code === "INVALID_CONTENT_TYPE" ||
					e.message.includes("feed"),
			);
			if (hasFeedError) {
				limitations.push({
					type: "no-native-rss",
					description:
						"Source does not provide native RSS/Atom feed; requires generated feed",
					affectedSections: [config.url],
					workaround:
						"Monitor via Feeder/alan-turing-institute/ai-rss-feeds generated feeds",
					severity: "blocks-all",
					firstObserved: now,
					lastObserved: now,
				});
			}
		}

		// Check for intermittent connectivity
		const hasNetworkErrors = result.errors.some(
			(e) => e.code === "FETCH_FAILED" || e.code === "TIMEOUT",
		);
		if (hasNetworkErrors) {
			limitations.push({
				type: "intermittent",
				description: "Source shows intermittent connectivity issues",
				affectedSections: [config.url],
				severity: "degrades-quality",
				firstObserved: now,
				lastObserved: now,
			});
		}

		return limitations;
	}

	/**
	 * Detect incomplete results
	 */
	private detectIncompleteResults(
		result: RetrievalResult,
		config: SourceConfig,
	): IncompleteResults | undefined {
		// Check for conditional request 304 (no new content) - applies to any status
		if (result.metadata.statusCode === 304) {
			return {
				reason: "conditional-request-304",
				description:
					"Source returned 304 Not Modified; no new content since last check",
				estimatedCoveragePercent: 100,
				paginationExhausted: true,
			};
		}

		if (result.status === "CHECKED_FOUND" && result.items.length > 0) {
			// Check if pagination might have been truncated
			const hasPaginationLimit =
				config.parseOptions?.maxResults ||
				config.parseOptions?.maxItems;
			if (
				hasPaginationLimit &&
				result.items.length >= (hasPaginationLimit as number)
			) {
				return {
					reason: "pagination-truncated",
					description: `Retrieval limited to ${hasPaginationLimit} items; more may be available`,
					estimatedCoveragePercent: 80,
					paginationExhausted: false,
				};
			}
		}

		if (result.status === "INACCESSIBLE" || result.status === "ERROR") {
			return {
				reason: "other",
				description: `Retrieval failed: ${result.errors.map((e) => e.message).join("; ")}`,
				estimatedCoveragePercent: 0,
				paginationExhausted: false,
			};
		}

		return undefined;
	}

	/**
	 * Infer source family from source config
	 */
	private inferSourceFamily(config: SourceConfig): SourceFamily {
		const url = config.url.toLowerCase();
		const tags =
			(config as any).tags?.map((t: string) => t.toLowerCase()) || [];
		const all = [url, ...tags].join(" ");

		// Benchmark repositories
		if (
			all.includes("mlperf") ||
			all.includes("llmperf") ||
			all.includes("benchmark") ||
			all.includes("mlcommons/results") ||
			all.includes("llmperf/llmperf")
		) {
			return "benchmark-repositories";
		}

		// Conference proceedings
		if (
			all.includes("neurips") ||
			all.includes("icml") ||
			all.includes("iclr") ||
			all.includes("mlsys") ||
			all.includes("osdi") ||
			all.includes("sosp") ||
			config.type === "conference"
		) {
			return "conference-proceedings";
		}

		// arXiv categories
		if (config.type === "arxiv" || all.includes("arxiv")) {
			return "arxiv-categories";
		}

		// Cloud provider architecture
		if (
			all.includes("aws.amazon.com/blogs/architecture") ||
			all.includes("cloud.google.com/blog/topics/architecture") ||
			all.includes("azure-architecture") ||
			all.includes("cloudflare.com/blog")
		) {
			return "cloud-provider-architecture";
		}

		// Cloud provider AI/ML
		if (
			all.includes("aws.amazon.com/blogs/machine-learning") ||
			all.includes("aws.amazon.com/blogs/amazon-ai") ||
			all.includes("azure.microsoft.com/blog/product/azure-ai") ||
			all.includes("cloud.google.com/blog/topics/ai-machine-learning") ||
			all.includes("cloud.google.com/blog/products/ai")
		) {
			return "cloud-provider-ai-ml";
		}

		// Major AI lab blogs
		if (
			all.includes("research.google") ||
			all.includes("deepmind.google") ||
			all.includes("ai.facebook.com") ||
			all.includes("anthropic.com/research") ||
			all.includes("openai.com/news/research") ||
			all.includes("openai.com/news") ||
			all.includes("microsoft.com/research") ||
			all.includes("nvidia.com/blog") ||
			all.includes("developer.nvidia.com") ||
			all.includes("engineering.fb.com") ||
			all.includes("github.blog")
		) {
			return "major-ai-lab-blogs";
		}

		// Research institutions
		if (
			all.includes("allenai.org") ||
			all.includes("mila.quebec") ||
			all.includes("bair.berkeley") ||
			all.includes("hai.stanford") ||
			all.includes("ai.stanford") ||
			all.includes("aisi.gov.uk") ||
			all.includes("turing.ac.uk")
		) {
			return "research-institutions";
		}

		// Advisory organizations
		if (
			all.includes("gartner.com") ||
			all.includes("mckinsey.com") ||
			all.includes("forrester.com") ||
			all.includes("idc.com") ||
			all.includes("technologyreview.com")
		) {
			return "advisory-organizations";
		}

		// Security advisories
		if (
			config.type === "security" ||
			all.includes("cve") ||
			all.includes("ghsa") ||
			all.includes("advisories")
		) {
			return "security-advisories";
		}

		// Coding agent vendors
		if (
			all.includes("copilot") ||
			all.includes("claude-code") ||
			all.includes("codex") ||
			all.includes("gemini-cli") ||
			all.includes("junie")
		) {
			return "coding-agent-vendor";
		}

		// Coding agent community
		if (
			all.includes("cline") ||
			all.includes("opencode") ||
			all.includes("aider") ||
			all.includes("kilocode") ||
			all.includes("goose") ||
			all.includes("continue")
		) {
			return "coding-agent-community";
		}

		// AI IDE releases
		if (
			all.includes("vscode") ||
			all.includes("cursor") ||
			all.includes("windsurf") ||
			all.includes("zed") ||
			all.includes("visual-studio") ||
			all.includes("xcode")
		) {
			return "ai-ide-releases";
		}

		// Aggregator feeds
		if (
			all.includes("havoptic") ||
			all.includes("agentic-index") ||
			all.includes("devagentradar")
		) {
			return "aggregator-feeds";
		}

		// Independent researchers
		if (
			all.includes("simonwillison") ||
			all.includes("lemire") ||
			all.includes("hamel.dev") ||
			all.includes("lilianweng") ||
			all.includes("interconnected.org")
		) {
			return "independent-researchers";
		}

		// Developer tools
		if (
			all.includes("langchain") ||
			all.includes("supabase") ||
			all.includes("weaviate") ||
			all.includes("pinecone") ||
			all.includes("groq") ||
			all.includes("dagster") ||
			all.includes("ollama") ||
			all.includes("perplexity") ||
			all.includes("huggingface") ||
			all.includes("mistral") ||
			all.includes("cohere") ||
			all.includes("x.ai") ||
			all.includes("deepseek") ||
			all.includes("thinkingmachines") ||
			all.includes("transluce") ||
			all.includes("timaeus") ||
			all.includes("goodfire") ||
			all.includes("far.ai") ||
			all.includes("eleuther")
		) {
			return "developer-tools";
		}

		// Infrastructure vendors
		if (
			all.includes("nvidia") ||
			all.includes("amd") ||
			all.includes("intel") ||
			all.includes("groq") ||
			all.includes("cerebras") ||
			all.includes("tenstorrent")
		) {
			return "infrastructure-vendors";
		}

		// Standards bodies
		if (
			all.includes("w3.org") ||
			all.includes("ietf.org") ||
			all.includes("iso.org") ||
			all.includes("oasis-open.org") ||
			all.includes("cncf.io") ||
			all.includes("onnx.ai") ||
			all.includes("opentelemetry.io") ||
			all.includes("opencost.io")
		) {
			return "standards-bodies";
		}

		// Regulatory bodies
		if (
			all.includes("eur-lex.europa.eu") ||
			all.includes("federalregister.gov") ||
			all.includes("legislation.gov.uk") ||
			all.includes("nist.gov") ||
			all.includes("ai-act")
		) {
			return "regulatory-bodies";
		}

		// Academic journals
		if (
			all.includes("ieee.org") ||
			all.includes("acm.org") ||
			all.includes("openreview.net") ||
			all.includes("distill.pub") ||
			all.includes("paperswithcode.com")
		) {
			return "academic-journals";
		}

		// Default
		return "developer-tools";
	}

	/**
	 * Infer organization from source config
	 */
	private inferOrganization(config: SourceConfig): string {
		const url = config.url.toLowerCase();

		// Check specific GitHub organizations first
		if (url.includes("github.com/mlcommons/")) return "MLCommons";
		if (url.includes("github.com/llmperf/")) return "LLMPerf";

		if (url.includes("aws.amazon.com") || url.includes("amazon"))
			return "Amazon Web Services";
		if (
			url.includes("cloud.google.com") ||
			url.includes("google") ||
			url.includes("deepmind")
		)
			return "Google";
		if (
			url.includes("azure.microsoft.com") ||
			url.includes("microsoft.com/research") ||
			url.includes("devblogs.microsoft.com")
		)
			return "Microsoft";
		if (url.includes("cloudflare.com")) return "Cloudflare";
		if (url.includes("nvidia.com") || url.includes("developer.nvidia.com"))
			return "NVIDIA";
		if (url.includes("github.com") || url.includes("github.blog"))
			return "GitHub";
		if (url.includes("anthropic.com")) return "Anthropic";
		if (url.includes("openai.com")) return "OpenAI";
		if (
			url.includes("ai.facebook.com") ||
			url.includes("engineering.fb.com")
		)
			return "Meta";
		if (url.includes("mistral.ai")) return "Mistral AI";
		if (url.includes("cohere.com")) return "Cohere";
		if (url.includes("x.ai")) return "xAI";
		if (url.includes("deepseek.com")) return "DeepSeek";
		if (url.includes("ollama.com")) return "Ollama";
		if (url.includes("perplexity.ai")) return "Perplexity";
		if (url.includes("huggingface.co")) return "Hugging Face";
		if (url.includes("thinkingmachines.ai")) return "Thinking Machines Lab";
		if (url.includes("transluce.org")) return "Transluce";
		if (url.includes("timaeus.co")) return "Timaeus";
		if (url.includes("goodfire.ai")) return "Goodfire";
		if (url.includes("far.ai")) return "FAR.AI";
		if (url.includes("eleuther.ai")) return "EleutherAI";
		if (url.includes("langchain.com")) return "LangChain";
		if (url.includes("supabase.com")) return "Supabase";
		if (url.includes("weaviate.io")) return "Weaviate";
		if (url.includes("pinecone.io")) return "Pinecone";
		if (url.includes("groq.com")) return "Groq";
		if (url.includes("dagster.io")) return "Dagster";
		if (url.includes("cursor.com")) return "Cursor";
		if (url.includes("windsurf.com")) return "Windsurf/Codeium";
		if (url.includes("zed.dev")) return "Zed Industries";
		if (url.includes("jetbrains.com") || url.includes("junie"))
			return "JetBrains";
		if (url.includes("apple.com") || url.includes("xcode")) return "Apple";
		if (
			url.includes("visualstudio.com") ||
			url.includes("devblogs.microsoft.com/visualstudio")
		)
			return "Microsoft Visual Studio";
		if (url.includes("havoptic.com")) return "Havoptic";
		if (url.includes("agenticindex.io")) return "Agentic Index";
		if (url.includes("devagentradar.com")) return "DevAgentRadar";
		if (url.includes("simonwillison.net")) return "Simon Willison";
		if (url.includes("lemire.me")) return "Daniel Lemire";
		if (url.includes("hamel.dev")) return "Hamel Husain";
		if (url.includes("lilianweng.github.io")) return "Lilian Weng";
		if (url.includes("interconnected.org")) return "Matt Webb";
		if (url.includes("allenai.org")) return "Allen Institute for AI";
		if (url.includes("mila.quebec")) return "Mila Quebec AI Institute";
		if (url.includes("bair.berkeley.edu")) return "Berkeley AI Research";
		if (url.includes("hai.stanford.edu") || url.includes("ai.stanford.edu"))
			return "Stanford University";
		if (url.includes("aisi.gov.uk")) return "UK AI Security Institute";
		if (url.includes("turing.ac.uk")) return "Alan Turing Institute";
		if (url.includes("technologyreview.com"))
			return "MIT Technology Review";
		if (url.includes("gartner.com")) return "Gartner";
		if (url.includes("mckinsey.com")) return "McKinsey & Company";
		if (url.includes("forrester.com")) return "Forrester";
		if (url.includes("idc.com")) return "IDC";
		if (url.includes("cncf.io")) return "CNCF";
		if (url.includes("mlcommons.org") || url.includes("mlperf"))
			return "MLCommons";
		if (url.includes("arxiv.org")) return "arXiv";

		// Try to extract from URL
		try {
			const parsed = new URL(config.url);
			return parsed.hostname.replace("www.", "").split(".")[0];
		} catch {
			return "Unknown";
		}
	}

	/**
	 * Infer criticality from source config
	 */
	private inferCriticality(config: SourceConfig): CriticalityLevel {
		// Tier 1 sources are typically mandatory or high
		if (
			config.type === "conference" ||
			config.type === "security" ||
			config.type === "arxiv"
		) {
			return "high";
		}

		// Check for mandatory monitoring sources per contract
		const url = config.url.toLowerCase();

		// Mandatory monitoring sources per contract
		if (
			url.includes("vscode") ||
			url.includes("visualstudio") ||
			url.includes("copilot") ||
			url.includes("claude-code") ||
			url.includes("codex") ||
			url.includes("gemini-cli") ||
			url.includes("junie")
		) {
			return "mandatory";
		}

		// High priority organizations
		const highPriorityOrgs = [
			"Google",
			"Microsoft",
			"Amazon Web Services",
			"NVIDIA",
			"GitHub",
			"Anthropic",
			"OpenAI",
			"Meta",
			"CNCF",
			"MLCommons",
			"arXiv",
		];
		if (highPriorityOrgs.includes(this.inferOrganization(config))) {
			return "high";
		}

		// Advisory orgs are standard (public only)
		const advisoryOrgs = [
			"Gartner",
			"McKinsey & Company",
			"Forrester",
			"IDC",
		];
		if (advisoryOrgs.includes(this.inferOrganization(config))) {
			return "standard";
		}

		return "standard";
	}

	/**
	 * Infer monitoring cadence from source config
	 */
	private inferCadence(config: SourceConfig): MonitoringCadence {
		const url = config.url.toLowerCase();

		// Continuous: GitHub releases, security feeds
		if (config.type === "github" || config.type === "security") {
			return "continuous";
		}

		// Daily: RSS feeds from major sources
		if (config.type === "rss" || config.type === "atom") {
			if (url.includes("daily") || url.includes("news")) {
				return "daily";
			}
			return "daily"; // Most RSS feeds are daily
		}

		// Weekly: Weekly publications, some blogs
		if (url.includes("weekly") || url.includes("the-batch")) {
			return "weekly";
		}

		// Monthly: Monthly releases, some vendor blogs
		if (config.type === "conference") {
			return "monthly";
		}

		// Default
		return "daily";
	}

	/**
	 * Infer adapter ID from source type
	 */
	private inferAdapterId(type: SourceConfig["type"]): string {
		const adapterMap: Record<SourceConfig["type"], string> = {
			rss: "rss",
			atom: "rss",
			github: "github",
			arxiv: "arxiv",
			conference: "html",
			security: "rss",
			"api-docs": "html",
			blog: "html",
			"benchmark-repo": "github",
			html: "html",
			"json-api": "html",
		};
		return adapterMap[type] || "html";
	}

	/**
	 * Infer access method from source type
	 */
	private inferAccessMethod(type: SourceConfig["type"]): string {
		const methodMap: Record<SourceConfig["type"], string> = {
			rss: "rss-feed",
			atom: "atom-feed",
			github: "github-api-releases",
			arxiv: "arxiv-api",
			conference: "html-scraping",
			security: "rss-feed",
			"api-docs": "html-scraping",
			blog: "rss-feed-or-html",
			"benchmark-repo": "github-api",
			html: "html-scraping",
			"json-api": "json-api",
		};
		return methodMap[type] || "unknown";
	}

	/**
	 * Infer evidence type from source type
	 */
	private inferEvidenceType(
		type: SourceConfig["type"],
	): EvidenceReference["type"] {
		const typeMap: Record<SourceConfig["type"], EvidenceReference["type"]> =
			{
				rss: "rss-entry",
				atom: "rss-entry",
				github: "github-release",
				arxiv: "arxiv-entry",
				conference: "html-element",
				security: "rss-entry",
				"api-docs": "html-element",
				blog: "rss-entry",
				"benchmark-repo": "github-release",
				html: "html-element",
				"json-api": "json-api-response",
			};
		return typeMap[type] || "feed-item";
	}

	/**
	 * Build traceability chain
	 */
	private buildTraceabilityChain(
		candidateId: string,
		sourceDiscoveries: SourceDiscoveryLink[],
		noveltyClassification: NoveltyClassificationLink,
		evidenceVerification: EvidenceVerificationLink[],
		editorialDisposition: EditorialDispositionLink,
	): TraceabilityStep[] {
		const chain: TraceabilityStep[] = [];

		// Step 1: Source Discovery
		chain.push({
			step: "source-discovery",
			timestamp:
				sourceDiscoveries[0]?.discoveredAt || new Date().toISOString(),
			actor: "system",
			inputIds: sourceDiscoveries.map((d) => d.sourceMonitoringRecordId),
			outputIds: sourceDiscoveries.map((d) => d.discoveryId),
			notes: `Discovered from ${sourceDiscoveries.length} source(s)`,
		});

		// Step 2: Novelty Classification
		chain.push({
			step: "novelty-classification",
			timestamp: noveltyClassification.classifiedAt,
			actor: noveltyClassification.classifiedBy,
			inputIds: sourceDiscoveries.map((d) => d.discoveryId),
			outputIds: [noveltyClassification.classificationId],
			notes: `Classified as ${noveltyClassification.classification} (confidence: ${noveltyClassification.confidence})`,
		});

		// Step 3: Claim Verification
		for (const verification of evidenceVerification) {
			chain.push({
				step: "claim-verification",
				timestamp: verification.verifiedAt,
				actor: verification.verifiedBy,
				inputIds: [noveltyClassification.classificationId],
				outputIds: [verification.verificationId],
				notes: `Claim ${verification.claimId} ${verification.verificationStatus}`,
			});
		}

		// Step 4: Editorial Selection
		chain.push({
			step: "editorial-selection",
			timestamp: editorialDisposition.decidedAt,
			actor: editorialDisposition.decidedBy,
			inputIds: evidenceVerification.map((v) => v.verificationId),
			outputIds: [editorialDisposition.dispositionId],
			notes: `Disposition: ${editorialDisposition.status}`,
		});

		// Step 5: Publication (if selected)
		if (
			editorialDisposition.status === "selected" &&
			editorialDisposition.publicationId
		) {
			chain.push({
				step: "publication",
				timestamp: new Date().toISOString(),
				actor: "system",
				inputIds: [editorialDisposition.dispositionId],
				outputIds: [editorialDisposition.publicationId],
				notes: `Published to ${editorialDisposition.publicationId}`,
			});
		}

		return chain;
	}

	// ============================================================================
	// Query Methods
	// ============================================================================

	/**
	 * Query ledger entries
	 */
	async query(query: LedgerQuery): Promise<DiscoveryLedgerEntry[]> {
		const files = await fs.readdir(this.ledgerDir);
		const entries: DiscoveryLedgerEntry[] = [];

		for (const file of files) {
			if (file.endsWith(".json")) {
				const content = await fs.readFile(
					path.join(this.ledgerDir, file),
					"utf-8",
				);
				const entry = JSON.parse(content) as DiscoveryLedgerEntry;

				// Apply filters
				if (
					query.editionDate &&
					entry.executionContext.editionDate !== query.editionDate
				)
					continue;
				if (
					query.executionId &&
					entry.executionContext.executionId !== query.executionId
				)
					continue;
				if (
					query.startDate &&
					entry.executionContext.editionDate < query.startDate
				)
					continue;
				if (
					query.endDate &&
					entry.executionContext.editionDate > query.endDate
				)
					continue;

				// Filter source records if needed
				if (
					query.sourceId ||
					query.ring ||
					query.domain ||
					query.sourceFamily ||
					query.organization ||
					query.criticality ||
					query.status
				) {
					const filteredRecords = entry.sourceRecords.filter(
						(record) => {
							if (
								query.sourceId &&
								record.sourceId !== query.sourceId
							)
								return false;
							if (
								query.ring &&
								!record.rings.includes(query.ring)
							)
								return false;
							if (
								query.domain &&
								!record.researchDomains.includes(query.domain)
							)
								return false;
							if (
								query.sourceFamily &&
								record.sourceFamily !== query.sourceFamily
							)
								return false;
							if (
								query.organization &&
								record.organization !== query.organization
							)
								return false;
							if (
								query.criticality &&
								record.criticality !== query.criticality
							)
								return false;
							if (query.status && record.status !== query.status)
								return false;
							return true;
						},
					);

					if (filteredRecords.length === 0) continue;
					entry.sourceRecords = filteredRecords;
				}

				entries.push(entry);
			}
		}

		// Sort by edition date descending
		entries.sort((a, b) =>
			b.executionContext.editionDate.localeCompare(
				a.executionContext.editionDate,
			),
		);

		// Apply pagination
		const offset = query.offset || 0;
		const limit = query.limit || 100;
		return entries.slice(offset, offset + limit);
	}

	/**
	 * Get ledger statistics
	 */
	async getStats(): Promise<LedgerStats> {
		const files = await fs.readdir(this.ledgerDir);
		const entries: DiscoveryLedgerEntry[] = [];

		for (const file of files) {
			if (file.endsWith(".json")) {
				const content = await fs.readFile(
					path.join(this.ledgerDir, file),
					"utf-8",
				);
				entries.push(JSON.parse(content));
			}
		}

		if (entries.length === 0) {
			return {
				totalExecutions: 0,
				totalSourceRecords: 0,
				dateRange: { earliest: "", latest: "" },
				uniqueSources: 0,
				uniqueOrganizations: 0,
				coverageHistory: [],
			};
		}

		entries.sort((a, b) =>
			a.executionContext.editionDate.localeCompare(
				b.executionContext.editionDate,
			),
		);

		const allRecords = entries.flatMap((e) => e.sourceRecords);
		const uniqueSources = new Set(allRecords.map((r) => r.sourceId)).size;
		const uniqueOrgs = new Set(allRecords.map((r) => r.organization)).size;

		const coverageHistory: CoverageTrendPoint[] = entries.map((entry) => ({
			editionDate: entry.executionContext.editionDate,
			executionId: entry.executionContext.executionId,
			overallCoveragePercent:
				entry.coverageMetrics.overall.overallCoveragePercent,
			overallSuccessRatePercent:
				entry.coverageMetrics.overall.overallSuccessRatePercent,
			totalItemsDiscovered:
				entry.coverageMetrics.overall.totalItemsDiscovered,
			sourcesAttempted:
				entry.coverageMetrics.overall.totalSourcesAttempted,
			sourcesInaccessible:
				entry.coverageMetrics.overall.totalSourcesInaccessible,
			anomaliesCount: entry.anomalies.length,
		}));

		return {
			totalExecutions: entries.length,
			totalSourceRecords: allRecords.length,
			dateRange: {
				earliest: entries[0].executionContext.editionDate,
				latest: entries[entries.length - 1].executionContext
					.editionDate,
			},
			uniqueSources,
			uniqueOrganizations: uniqueOrgs,
			coverageHistory,
		};
	}

	/**
	 * Load a specific ledger entry by execution ID
	 */
	async loadEntry(executionId: string): Promise<DiscoveryLedgerEntry | null> {
		const files = await fs.readdir(this.ledgerDir);
		for (const file of files) {
			if (
				file.includes(executionId.slice(0, 8)) &&
				file.endsWith(".json")
			) {
				const content = await fs.readFile(
					path.join(this.ledgerDir, file),
					"utf-8",
				);
				return JSON.parse(content) as DiscoveryLedgerEntry;
			}
		}
		return null;
	}

	/**
	 * Get candidate traceability for a candidate ID
	 */
	async getCandidateTraceability(
		candidateId: string,
	): Promise<CandidateTraceabilityRecord | null> {
		const files = await fs.readdir(this.ledgerDir);
		for (const file of files) {
			if (file.endsWith(".json")) {
				const content = await fs.readFile(
					path.join(this.ledgerDir, file),
					"utf-8",
				);
				const entry = JSON.parse(content) as DiscoveryLedgerEntry;
				const trace = entry.candidateTraceability.find(
					(t) => t.candidateId === candidateId,
				);
				if (trace) return trace;
			}
		}
		return null;
	}

	/**
	 * Get all anomalies across history
	 */
	async getAnomalies(since?: string): Promise<MonitoringAnomaly[]> {
		const files = await fs.readdir(this.ledgerDir);
		const anomalies: MonitoringAnomaly[] = [];

		for (const file of files) {
			if (file.endsWith(".json")) {
				const content = await fs.readFile(
					path.join(this.ledgerDir, file),
					"utf-8",
				);
				const entry = JSON.parse(content) as DiscoveryLedgerEntry;

				if (since && entry.executionContext.editionDate < since)
					continue;

				anomalies.push(...entry.anomalies);
			}
		}

		return anomalies.sort((a, b) =>
			b.detectedAt.localeCompare(a.detectedAt),
		);
	}

	/**
	 * Get source monitoring history
	 */
	async getSourceHistory(
		sourceId: string,
	): Promise<SourceMonitoringRecord[]> {
		const files = await fs.readdir(this.ledgerDir);
		const history: SourceMonitoringRecord[] = [];

		for (const file of files) {
			if (file.endsWith(".json")) {
				const content = await fs.readFile(
					path.join(this.ledgerDir, file),
					"utf-8",
				);
				const entry = JSON.parse(content) as DiscoveryLedgerEntry;
				const records = entry.sourceRecords.filter(
					(r) => r.sourceId === sourceId,
				);
				history.push(...records);
			}
		}

		return history.sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
	}
}

/**
 * Create a DiscoveryLedger instance with default configuration
 */
export function createDiscoveryLedger(options?: {
	ledgerDir?: string;
	historyRetentionDays?: number;
	maxHistoryFiles?: number;
}): DiscoveryLedger {
	return new DiscoveryLedger(
		options?.ledgerDir || DEFAULT_LEDGER_DIR,
		options?.historyRetentionDays || DEFAULT_HISTORY_RETENTION_DAYS,
		options?.maxHistoryFiles || MAX_HISTORY_FILES,
	);
}
