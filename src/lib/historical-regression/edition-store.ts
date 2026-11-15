/**
 * Historical Regression — Historical Edition Availability
 *
 * Reads previous editions ONLY from actually accessible, verified local
 * records. Nothing is manufactured: when a record is missing it is recorded as
 * missing, and a missing edition is never interpreted as evidence that a story
 * was not previously covered.
 *
 * Sources inspected per historical edition date:
 * - data/fact-dossiers/edition_<date>.json          (canonical fact dossier)
 * - data/omission-reviews/<date>_*.json             (research audit)
 * - data/publications/*.json                        (published article records)
 * - data/candidates/<date>.jsonl                    (candidate records)
 * - data/discovered/<date>.jsonl                    (discovery records)
 * - data/discovery-ledger/<date>_*.json             (monitoring records)
 * - data/dossiers/*.json                            (legacy per-candidate dossiers)
 */

import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

import { validateFactDossier } from "../fact-dossier/validate.js";
import type { CanonicalFactDossier } from "../fact-dossier/schema.js";
import type { OmissionReviewReport } from "../omission-review/types.js";
import type { CandidateNewsItem, DiscoveredItem } from "../signal-desk.js";
import type { SourceMonitoringRecord } from "../discovery-ledger/types.js";
import type { HistoricalEditionAvailability } from "./schema.js";

/** Default data root. */
export const DEFAULT_DATA_DIR = "data";

/** Minimal shape of a publication-history record. */
export interface HistoricalPublicationRecord {
	id: string;
	dossierId: string;
	slug: string;
	type: string;
	locale: string;
	title?: string;
	publishedAt: string;
	status: string;
}

/** Minimal shape of a legacy per-candidate fact dossier. */
export interface HistoricalLegacyDossierRecord {
	id: string;
	candidateId: string;
	slug: string;
	type: string;
	locale: string;
	status: string;
}

/** Everything actually accessible for one historical edition date. */
export interface HistoricalEditionBundle {
	editionDate: string;
	availability: HistoricalEditionAvailability;
	dossier: CanonicalFactDossier | null;
	audit: OmissionReviewReport | null;
	candidateRecords: CandidateNewsItem[];
	discoveryRecords: DiscoveredItem[];
	monitoringRecords: SourceMonitoringRecord[];
	publicationRecords: HistoricalPublicationRecord[];
	legacyDossiers: HistoricalLegacyDossierRecord[];
}

/** Options controlling which record types are inspected. */
export interface EditionStoreOptions {
	dataDir?: string;
	/** Also inspect discovery records (default true). */
	includeDiscoveryRecords?: boolean;
	/** Also inspect monitoring records (default true). */
	includeMonitoringRecords?: boolean;
}

function safeReadJson(
	path: string,
): { ok: true; value: unknown } | { ok: false } {
	try {
		return {
			ok: true,
			value: JSON.parse(readFileSync(path, "utf-8")) as unknown,
		};
	} catch {
		return { ok: false };
	}
}

function readJsonl(path: string): {
	ok: boolean;
	records: Record<string, unknown>[];
	error?: string;
} {
	let content: string;
	try {
		content = readFileSync(path, "utf-8");
	} catch {
		return { ok: false, records: [] };
	}
	const records: Record<string, unknown>[] = [];
	for (const [index, line] of content.split("\n").entries()) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			records.push(JSON.parse(trimmed) as Record<string, unknown>);
		} catch (error) {
			return {
				ok: false,
				records,
				error: `line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	}
	return { ok: true, records };
}

function listFiles(
	dir: string,
	predicate: (file: string) => boolean,
): string[] {
	try {
		return readdirSync(dir).filter(predicate).sort();
	} catch {
		return [];
	}
}

/** Structural validation for an omission review report (research audit). */
export function validateResearchAudit(value: unknown): {
	valid: boolean;
	errors: string[];
} {
	const errors: string[] = [];
	if (value === null || typeof value !== "object") {
		return { valid: false, errors: ["research audit is not an object"] };
	}
	const record = value as Record<string, unknown>;
	const context = record.context as Record<string, unknown> | undefined;
	if (!context || typeof context !== "object") {
		errors.push("research audit is missing context");
	} else {
		if (typeof context.editionDate !== "string")
			errors.push("research audit context.editionDate missing");
		if (typeof context.executionId !== "string")
			errors.push("research audit context.executionId missing");
	}
	if (!Array.isArray(record.alternativeStrategiesExecuted)) {
		errors.push(
			"research audit alternativeStrategiesExecuted is not an array",
		);
	}
	if (!Array.isArray(record.newlyDiscoveredCandidates)) {
		errors.push("research audit newlyDiscoveredCandidates is not an array");
	}
	if (typeof record.finalDossierVersion !== "string") {
		errors.push("research audit finalDossierVersion missing");
	}
	return { valid: errors.length === 0, errors };
}

/** Convert a local calendar date to a filename-safe edition prefix. */
function editionPrefix(editionDate: string): string {
	return `edition_${editionDate}`;
}

/**
 * Load and assess one historical edition from local records.
 * Never throws: unreadable or malformed records are recorded explicitly.
 */
export function loadHistoricalEdition(
	editionDate: string,
	options: EditionStoreOptions = {},
): HistoricalEditionBundle {
	const dataDir = options.dataDir ?? DEFAULT_DATA_DIR;
	const includeDiscovery = options.includeDiscoveryRecords ?? true;
	const includeMonitoring = options.includeMonitoringRecords ?? true;

	const notes: string[] = [];
	const missing: string[] = [];

	// --- Canonical fact dossier --------------------------------------------
	const dossierPath = join(
		dataDir,
		"fact-dossiers",
		`${editionPrefix(editionDate)}.json`,
	);
	const dossierFileExists = existsSync(dossierPath);
	let dossier: CanonicalFactDossier | null = null;
	let dossierValid = false;
	let dossierParseable = false;
	if (dossierFileExists) {
		const read = safeReadJson(dossierPath);
		if (read.ok) {
			dossierParseable = true;
			const candidate = read.value as CanonicalFactDossier;
			const validation = validateFactDossier(candidate);
			dossierValid = validation.valid;
			if (dossierValid) {
				dossier = candidate;
			} else {
				notes.push(
					`Canonical fact dossier is present but fails validation (${validation.errors.length} error(s)); it cannot be used for reliable comparison.`,
				);
			}
		} else {
			notes.push(
				"Canonical fact dossier file exists but is not parseable JSON.",
			);
		}
	} else {
		missing.push("canonical fact dossier");
	}

	// --- Research audit -----------------------------------------------------
	const auditDir = join(dataDir, "omission-reviews");
	const auditFiles = listFiles(
		auditDir,
		(file) => file.startsWith(`${editionDate}_`) && file.endsWith(".json"),
	);
	let audit: OmissionReviewReport | null = null;
	let auditValid = false;
	let auditFileExists = auditFiles.length > 0;
	if (auditFileExists) {
		// Prefer the most recent audit file (lexicographic order is stable for the
		// `<date>_<exec>.json` naming convention used by the omission review stage).
		const latest = auditFiles[auditFiles.length - 1];
		const read = safeReadJson(join(auditDir, latest));
		if (read.ok) {
			const validation = validateResearchAudit(read.value);
			auditValid = validation.valid;
			if (auditValid) {
				audit = read.value as OmissionReviewReport;
			} else {
				notes.push(
					`Research audit is present but fails structural validation: ${validation.errors.join("; ")}.`,
				);
			}
		} else {
			notes.push("Research audit file exists but is not parseable JSON.");
		}
	} else {
		missing.push("research audit");
	}

	// --- Candidate records --------------------------------------------------
	const candidatesPath = join(dataDir, "candidates", `${editionDate}.jsonl`);
	const candidatesFileExists = existsSync(candidatesPath);
	const candidateRead = candidatesFileExists
		? readJsonl(candidatesPath)
		: { ok: false, records: [] };
	const candidateRecordsAvailable = candidatesFileExists && candidateRead.ok;
	const candidateRecords: CandidateNewsItem[] = candidateRecordsAvailable
		? (candidateRead.records as unknown as CandidateNewsItem[])
		: [];
	if (!candidatesFileExists) {
		missing.push("candidate records");
	} else if (!candidateRead.ok) {
		notes.push(
			`Candidate records are present but not parseable (${candidateRead.error}).`,
		);
	}

	// --- Discovery records --------------------------------------------------
	const discoveredPath = join(dataDir, "discovered", `${editionDate}.jsonl`);
	const discoveredFileExists = includeDiscovery && existsSync(discoveredPath);
	const discoveryRead = discoveredFileExists
		? readJsonl(discoveredPath)
		: { ok: false, records: [] };
	const discoveryRecordsAvailable = discoveredFileExists && discoveryRead.ok;
	const discoveryRecords: DiscoveredItem[] = discoveryRecordsAvailable
		? (discoveryRead.records as unknown as DiscoveredItem[])
		: [];
	if (includeDiscovery && !discoveredFileExists) {
		missing.push("discovery records");
	} else if (includeDiscovery && !discoveryRead.ok) {
		notes.push(
			`Discovery records are present but not parseable (${discoveryRead.error}).`,
		);
	}

	// --- Monitoring records -------------------------------------------------
	const ledgerDir = join(dataDir, "discovery-ledger");
	const monitoringFiles = includeMonitoring
		? listFiles(
				ledgerDir,
				(file) =>
					file.startsWith(`${editionDate}_`) &&
					file.endsWith(".json"),
			)
		: [];
	const monitoringRecordsAvailable = monitoringFiles.length > 0;
	const monitoringRecords: SourceMonitoringRecord[] = [];
	if (monitoringRecordsAvailable) {
		for (const file of monitoringFiles) {
			const read = safeReadJson(join(ledgerDir, file));
			if (
				read.ok &&
				Array.isArray(
					(read.value as { sourceRecords?: unknown[] }).sourceRecords,
				)
			) {
				monitoringRecords.push(
					...(
						read.value as {
							sourceRecords: SourceMonitoringRecord[];
						}
					).sourceRecords,
				);
			}
		}
	}
	if (includeMonitoring && !monitoringRecordsAvailable) {
		missing.push("monitoring records");
	}

	// --- Published article records -----------------------------------------
	const publicationsDir = join(dataDir, "publications");
	const publicationFiles = listFiles(publicationsDir, (file) =>
		file.endsWith(".json"),
	);
	const publicationRecords: HistoricalPublicationRecord[] = [];
	const dossierId = dossier?.dossierId;
	for (const file of publicationFiles) {
		const read = safeReadJson(join(publicationsDir, file));
		if (!read.ok) continue;
		const record = read.value as Partial<HistoricalPublicationRecord>;
		if (
			typeof record.id !== "string" ||
			typeof record.dossierId !== "string"
		)
			continue;
		const matchesDossier =
			Boolean(dossierId) && record.dossierId === dossierId;
		const matchesEditionDate =
			typeof record.publishedAt === "string" &&
			record.publishedAt.slice(0, 10) === editionDate;
		if (matchesDossier || matchesEditionDate) {
			publicationRecords.push(record as HistoricalPublicationRecord);
		}
	}
	const publishedArticleRecordsAvailable = publicationRecords.length > 0;
	if (!publishedArticleRecordsAvailable) {
		missing.push("published article records");
	}

	// --- Legacy per-candidate dossiers -------------------------------------
	const legacyDir = join(dataDir, "dossiers");
	const legacyFiles = listFiles(legacyDir, (file) => file.endsWith(".json"));
	const legacyDossiers: HistoricalLegacyDossierRecord[] = [];
	for (const file of legacyFiles) {
		const read = safeReadJson(join(legacyDir, file));
		if (!read.ok) continue;
		const record = read.value as Partial<HistoricalLegacyDossierRecord>;
		if (
			typeof record.id !== "string" ||
			typeof record.candidateId !== "string"
		)
			continue;
		const belongsToEdition =
			(dossier &&
				dossier.candidates.some(
					(c) => c.candidateId === record.candidateId,
				)) ||
			candidateRecords.some((c) => c.id === record.candidateId);
		if (belongsToEdition) {
			legacyDossiers.push(record as HistoricalLegacyDossierRecord);
		}
	}

	// --- Identifier extraction ---------------------------------------------
	const candidateIds = dossier
		? dossier.candidates.map((c) => c.candidateId)
		: candidateRecords.map((c) => c.id);
	const claimIds = dossier
		? dossier.candidates.flatMap((c) => c.claims.map((cl) => cl.claimId))
		: [];
	const sourceIds = dossier
		? [
				...new Set(
					dossier.candidates.flatMap((c) =>
						c.sources.map((s) => s.sourceId),
					),
				),
			].sort()
		: [...new Set(candidateRecords.flatMap((c) => c.sourceIds))].sort();
	const publicationIds = publicationRecords.map((record) => record.id).sort();

	// --- Status classification ---------------------------------------------
	const anyFileAccessible =
		dossierFileExists ||
		auditFileExists ||
		candidatesFileExists ||
		discoveredFileExists ||
		monitoringRecordsAvailable ||
		publishedArticleRecordsAvailable ||
		legacyDossiers.length > 0;

	let status: HistoricalEditionAvailability["status"];
	if (!anyFileAccessible) {
		status = "UNAVAILABLE";
		notes.push("No accessible historical records for this edition date.");
	} else if (dossierFileExists && !dossierValid) {
		// A present-but-untrustworthy dossier cannot support reliable comparison.
		status = "NOT_ASSESSABLE";
	} else if (dossierValid && auditValid) {
		status = "AVAILABLE";
	} else {
		status = "PARTIAL";
		if (!dossierValid)
			notes.push(
				"Canonical fact dossier unavailable or unusable; comparison is limited.",
			);
		if (!auditValid)
			notes.push(
				"Research audit unavailable or unusable; comparison is limited.",
			);
	}

	const availability: HistoricalEditionAvailability = {
		editionDate,
		editionId: editionPrefix(editionDate),
		exists: anyFileAccessible,
		dossierAvailable: dossierValid,
		dossierValid,
		researchAuditAvailable: auditValid,
		researchAuditValid: auditValid,
		publishedArticleRecordsAvailable,
		candidateRecordsAvailable,
		discoveryRecordsAvailable,
		monitoringRecordsAvailable,
		candidateIds: [...new Set(candidateIds)].sort(),
		claimIds: [...new Set(claimIds)].sort(),
		sourceIds: [...new Set(sourceIds)].sort(),
		publicationIds,
		canBeReliablyCompared: status === "AVAILABLE",
		status,
		missing: [...new Set(missing)].sort(),
		notes,
	};

	return {
		editionDate,
		availability,
		dossier,
		audit,
		candidateRecords,
		discoveryRecords,
		monitoringRecords,
		publicationRecords,
		legacyDossiers,
	};
}

/** Extract the stable publication identifier for a historical candidate, when known. */
export function findPublicationIdForCandidate(
	bundle: HistoricalEditionBundle,
	candidateId: string,
): string | undefined {
	const publication = bundle.publicationRecords.find((record) => {
		const legacy = bundle.legacyDossiers.find(
			(dossier) => dossier.candidateId === candidateId,
		);
		return legacy ? record.dossierId === legacy.id : false;
	});
	if (publication) return publication.id;
	if (bundle.publicationRecords.length === 1)
		return bundle.publicationRecords[0].id;
	return undefined;
}
