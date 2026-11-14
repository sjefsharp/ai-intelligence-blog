/**
 * Editorial Selection — Persistence
 *
 * Persists one editorial selection manifest per edition under
 * `data/editorial-selection/`.
 *
 * Guarantees:
 * - Atomic writes (temp file + rename).
 * - Readback verification (byte equality + content hash).
 * - Idempotent manifests: identical selection content produces the same
 *   manifestId and is not written twice.
 * - Execution timestamps vary per run but are excluded from the selection
 *   identity, so reruns are no-ops.
 * - Local filesystem only; no external database.
 * - Historical manifests are never modified by this stage.
 */

import { promises as fs } from "fs";
import path from "path";

import {
	canonicalPrettyJson,
	sha256Canonical,
} from "../fact-dossier/canonical.js";
import {
	EDITORIAL_SELECTION_ID_PREFIX,
	type EditorialSelectionManifest,
} from "./schema.js";

export const DEFAULT_EDITORIAL_SELECTION_DIR = "data/editorial-selection";

/** Index file name. */
export const EDITORIAL_SELECTION_INDEX_FILE = "index.json";

export interface SaveManifestResult {
	saved: boolean;
	path: string;
	reason: "written" | "identical";
	contentHash: string;
	manifestId: string;
}

export interface EditorialSelectionIndexEntry {
	manifestId: string;
	contentHash: string;
	generatedAt: string;
	generatedBy: string;
	readinessStatus: EditorialSelectionManifest["readinessStatus"];
	selectedStories: number;
	path: string;
}

export interface EditorialSelectionIndex {
	schemaVersion: string;
	editions: Record<string, EditorialSelectionIndexEntry>;
}

/**
 * Compute the deterministic content hash for a manifest. Execution metadata is
 * excluded so identical selection content produces identical hashes (and
 * therefore idempotent reruns).
 */
export function computeManifestContentHash(
	manifest: EditorialSelectionManifest,
): string {
	const {
		manifestId: _manifestId,
		generatedAt: _generatedAt,
		contentHash: _contentHash,
		...rest
	} = manifest;
	return sha256Canonical(rest);
}

/** Derive the stable manifest identifier from the selection content. */
export function deriveManifestId(contentHash: string): string {
	return `${EDITORIAL_SELECTION_ID_PREFIX}${contentHash.replace(/^sha256:/, "").slice(0, 16)}`;
}

export class EditorialSelectionStore {
	private readonly baseDir: string;

	constructor(baseDir: string = DEFAULT_EDITORIAL_SELECTION_DIR) {
		this.baseDir = baseDir;
	}

	/** The directory where manifests are persisted. */
	get directory(): string {
		return this.baseDir;
	}

	async initialize(): Promise<void> {
		await fs.mkdir(this.baseDir, { recursive: true });
	}

	private indexPath(): string {
		return path.join(this.baseDir, EDITORIAL_SELECTION_INDEX_FILE);
	}

	private manifestPath(editionDate: string, generatedAt: string): string {
		// ISO timestamps are not filename-safe; keep only the date portion.
		const stamp = generatedAt
			.replace(/[:.]/g, "-")
			.replace("T", "_")
			.slice(0, 19);
		return path.join(this.baseDir, `${editionDate}_${stamp}.json`);
	}

	async loadIndex(): Promise<EditorialSelectionIndex> {
		try {
			const content = await fs.readFile(this.indexPath(), "utf-8");
			return JSON.parse(content) as EditorialSelectionIndex;
		} catch {
			return { schemaVersion: "1.0.0", editions: {} };
		}
	}

	private async saveIndex(index: EditorialSelectionIndex): Promise<void> {
		await this.initialize();
		const tempPath = path.join(
			this.baseDir,
			`.${EDITORIAL_SELECTION_INDEX_FILE}.tmp-${process.pid}`,
		);
		await fs.writeFile(tempPath, canonicalPrettyJson(index), "utf-8");
		await fs.rename(tempPath, this.indexPath());
	}

	/**
	 * Persist a manifest. Verifies the content hash, performs an atomic write,
	 * reads the file back and updates the edition index. Identical selection
	 * content is a no-op.
	 */
	async saveManifest(
		manifest: EditorialSelectionManifest,
	): Promise<SaveManifestResult> {
		await this.initialize();

		const computedHash = computeManifestContentHash(manifest);
		if (manifest.contentHash !== computedHash) {
			throw new Error(
				`Content hash mismatch for manifest ${manifest.manifestId}: provided ${manifest.contentHash}, computed ${computedHash}`,
			);
		}

		const index = await this.loadIndex();
		const existing = index.editions[manifest.editionDate];
		if (existing && existing.contentHash === computedHash) {
			return {
				saved: false,
				path: path.join(this.baseDir, existing.path),
				reason: "identical",
				contentHash: computedHash,
				manifestId: manifest.manifestId,
			};
		}

		const filePath = this.manifestPath(
			manifest.editionDate,
			manifest.generatedAt,
		);
		const serialized = canonicalPrettyJson(manifest);

		const tempPath = path.join(
			this.baseDir,
			`.${manifest.editionDate}_${manifest.manifestId}.tmp-${process.pid}`,
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
		const parsed = JSON.parse(readBack) as EditorialSelectionManifest;
		if (computeManifestContentHash(parsed) !== computedHash) {
			throw new Error(
				`Readback hash verification failed for ${filePath}`,
			);
		}

		index.editions[manifest.editionDate] = {
			manifestId: manifest.manifestId,
			contentHash: computedHash,
			generatedAt: manifest.generatedAt,
			generatedBy: manifest.generatedBy,
			readinessStatus: manifest.readinessStatus,
			selectedStories: manifest.stories.length,
			path: path.basename(filePath),
		};
		await this.saveIndex(index);

		return {
			saved: true,
			path: filePath,
			reason: "written",
			contentHash: computedHash,
			manifestId: manifest.manifestId,
		};
	}

	/** Load a manifest by edition date. Returns null when absent or unreadable. */
	async loadManifest(
		editionDate: string,
	): Promise<EditorialSelectionManifest | null> {
		const index = await this.loadIndex();
		const entry = index.editions[editionDate];
		if (!entry) return null;
		try {
			const content = await fs.readFile(
				path.join(this.baseDir, entry.path),
				"utf-8",
			);
			return JSON.parse(content) as EditorialSelectionManifest;
		} catch {
			return null;
		}
	}

	/** List edition dates with a persisted manifest. */
	async listEditions(): Promise<string[]> {
		const index = await this.loadIndex();
		return Object.keys(index.editions).sort();
	}
}

/** Create a store with the default configuration. */
export function createEditorialSelectionStore(
	baseDir?: string,
): EditorialSelectionStore {
	return new EditorialSelectionStore(baseDir);
}
