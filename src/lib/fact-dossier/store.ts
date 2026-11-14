/**
 * Canonical Fact Dossier — Persistence
 *
 * One authoritative logical dossier per edition, stored at
 * `data/fact-dossiers/edition_<YYYY-MM-DD>.json`.
 *
 * Guarantees:
 * - Atomic writes (temp file + rename).
 * - Readback verification (byte equality + content hash).
 * - Idempotent updates (identical content ⇒ no write; changed content ⇒ new
 *   version with `previousVersionHash` preserved).
 * - Explicit schema version on every record.
 * - No uncontrolled duplication of retrieved documents (claims/sources are
 *   referenced, not copied).
 * - Resumable processing: per-candidate failures are recorded in the dossier's
 *   processing audit, so a later run can retry only what failed.
 * - No mandatory cloud database (local filesystem only).
 */

import { promises as fs } from "fs";
import path from "path";

import type { CanonicalFactDossier } from "./schema.js";
import { canonicalPrettyJson, computeDossierContentHash } from "./canonical.js";
import { validateFactDossier, type ValidationResult } from "./validate.js";

export const DEFAULT_FACT_DOSSIER_DIR = "data/fact-dossiers";

export interface SaveResult {
	saved: boolean;
	path: string;
	reason: "written" | "updated" | "identical";
	contentHash: string;
	previousVersionHash?: string;
}

export interface LoadResult {
	dossier: CanonicalFactDossier | null;
	validation: ValidationResult;
}

export class FactDossierStore {
	private readonly baseDir: string;

	constructor(baseDir: string = DEFAULT_FACT_DOSSIER_DIR) {
		this.baseDir = baseDir;
	}

	/** The directory where dossiers are persisted. */
	get directory(): string {
		return this.baseDir;
	}

	async initialize(): Promise<void> {
		await fs.mkdir(this.baseDir, { recursive: true });
	}

	private filename(editionDate: string): string {
		return `edition_${editionDate}.json`;
	}

	private filepath(editionDate: string): string {
		return path.join(this.baseDir, this.filename(editionDate));
	}

	/**
	 * Persist a dossier. Verifies the content hash, performs an atomic write,
	 * and reads the file back to confirm integrity. Identical content is a no-op.
	 */
	async save(dossier: CanonicalFactDossier): Promise<SaveResult> {
		await this.initialize();
		const filePath = this.filepath(dossier.editionDate);

		const computedHash = computeDossierContentHash(dossier);
		if (dossier.contentHash !== computedHash) {
			throw new Error(
				`Content hash mismatch for dossier ${dossier.dossierId}: ` +
					`provided ${dossier.contentHash}, computed ${computedHash}`,
			);
		}

		const existing = await this.load(dossier.editionDate);
		if (existing && existing.contentHash === computedHash) {
			return {
				saved: false,
				path: filePath,
				reason: "identical",
				contentHash: computedHash,
				previousVersionHash: existing.previousVersionHash,
			};
		}

		const previousVersionHash = existing?.contentHash;
		const toWrite: CanonicalFactDossier = {
			...dossier,
			previousVersionHash,
			contentHash: computedHash,
		};
		const serialized = canonicalPrettyJson(toWrite);

		const tempPath = path.join(
			this.baseDir,
			`.${this.filename(dossier.editionDate)}.tmp-${process.pid}`,
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
			throw new Error(
				`Readback verification failed for ${filePath}: file content differs from the serialized dossier`,
			);
		}
		const parsed = JSON.parse(readBack) as CanonicalFactDossier;
		const readBackHash = computeDossierContentHash(parsed);
		if (readBackHash !== computedHash) {
			throw new Error(
				`Readback hash verification failed for ${filePath}`,
			);
		}

		return {
			saved: true,
			path: filePath,
			reason: existing ? "updated" : "written",
			contentHash: computedHash,
			previousVersionHash,
		};
	}

	/** Load a dossier by edition date. Returns null when absent or unreadable. */
	async load(editionDate: string): Promise<CanonicalFactDossier | null> {
		try {
			const content = await fs.readFile(
				this.filepath(editionDate),
				"utf-8",
			);
			return JSON.parse(content) as CanonicalFactDossier;
		} catch {
			return null;
		}
	}

	/** Load and validate a dossier by edition date. */
	async loadAndValidate(editionDate: string): Promise<LoadResult> {
		const dossier = await this.load(editionDate);
		if (!dossier) {
			return {
				dossier: null,
				validation: {
					valid: false,
					errors: [`No dossier found for edition ${editionDate}`],
					warnings: [],
				},
			};
		}
		return { dossier, validation: validateFactDossier(dossier) };
	}

	/** List all edition dates with a persisted dossier. */
	async listEditions(): Promise<string[]> {
		try {
			const files = await fs.readdir(this.baseDir);
			return files
				.filter((f) => f.startsWith("edition_") && f.endsWith(".json"))
				.map((f) => f.replace(/^edition_/, "").replace(/\.json$/, ""))
				.sort();
		} catch {
			return [];
		}
	}

	/**
	 * Remove a dossier (used by tests and recovery tooling). Returns true when a
	 * file was removed.
	 */
	async remove(editionDate: string): Promise<boolean> {
		try {
			await fs.unlink(this.filepath(editionDate));
			return true;
		} catch {
			return false;
		}
	}
}

/** Create a store with the default configuration. */
export function createFactDossierStore(baseDir?: string): FactDossierStore {
	return new FactDossierStore(baseDir);
}
