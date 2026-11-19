/**
 * Collection Orchestrator
 *
 * Coordinates the retrieval from all sources across three discovery rings.
 * Manages scheduling, checkpointing, deduplication, and persistence.
 */

import type {
	SourceConfig,
	RetrievalResult,
	RetrievalCheckpoint,
	RetrievalError,
	RetrievalStatus,
	CollectedItem,
	CollectionJob,
	CollectionJobResult,
	TimeWindow,
	DiscoveryRing,
	RetryConfig,
	SourceAdapter,
} from "./types.js";

export type {
	CollectionJob,
	CollectionJobResult,
	TimeWindow,
} from "./types.js";

import { RssAdapter } from "./adapters/rss.js";
import { GitHubAdapter } from "./adapters/github.js";
import { ArxivAdapter } from "./adapters/arxiv.js";
import { ADAPTER_METADATA } from "./adapters/index.js";
import {
	generateContentHash,
	normalizeUrl,
	extractTimestamp,
} from "./types.js";
import { promises as fs } from "fs";
import path from "path";
import {
	DiscoveryLedger,
	createDiscoveryLedger,
} from "../discovery-ledger/index.js";
import type {
	SourceMonitoringRecord,
	ExecutionContext,
} from "../discovery-ledger/types.js";

export interface OrchestratorConfig {
	/** Path to source registry YAML */
	sourceRegistryPath: string;
	/** Output directory for discovered items */
	outputDir: string;
	/** Checkpoint directory */
	checkpointDir: string;
	/** Default timeout for requests */
	defaultTimeoutMs: number;
	/** Default rate limit (requests per minute) */
	defaultRateLimit: number;
	/** Maximum concurrent source retrievals */
	maxConcurrency: number;
	/** Default user agent */
	userAgent: string;
	/** Discovery ledger directory (optional, enables ledger writing) */
	ledgerDir?: string;
	/** Ledger history retention in days */
	ledgerHistoryRetentionDays?: number;
}

export interface DiscoveredItemRecord {
	id: string;
	sourceId: string;
	ring: DiscoveryRing;
	publishedAt: string;
	firstDisclosedAt?: string;
	eventDate?: string;
	lastUpdatedAt?: string;
	retrievedAt: string;
	sourceTimezone?: string;
	timestampConfidence?: number;
	url: string;
	title: string;
	summary?: string;
	authors?: string[];
	contentHash: string;
	content?: string;
	rawMetadata: Record<string, unknown>;
	tags?: string[];
	language?: string;
	researchDomains?: string[];
	subdomainTags?: string[];
	discoveredAt: string;
	status: "new" | "updated" | "duplicate";
}

export class CollectionOrchestrator {
	private readonly config: OrchestratorConfig;
	private readonly adapters: Map<string, SourceAdapter>;
	private readonly sourceRegistry: Map<string, SourceConfig>;
	private readonly checkpoints: Map<string, RetrievalCheckpoint>;
	private readonly discoveredItems: Map<string, DiscoveredItemRecord>;
	private readonly sourceIndex: Map<string, Set<string>>; // contentHash -> itemIds
	private readonly ledger: DiscoveryLedger | null;
	private currentExecutionContext: ExecutionContext | null = null;

	constructor(config: OrchestratorConfig) {
		this.config = config;
		this.adapters = new Map();
		this.sourceRegistry = new Map();
		this.checkpoints = new Map();
		this.discoveredItems = new Map();
		this.sourceIndex = new Map();

		// Initialize adapters
		this.adapters.set("rss", new RssAdapter());
		this.adapters.set("github", new GitHubAdapter());
		this.adapters.set("arxiv", new ArxivAdapter());

		// Initialize discovery ledger if configured
		if (config.ledgerDir) {
			this.ledger = createDiscoveryLedger({
				ledgerDir: config.ledgerDir,
				historyRetentionDays: config.ledgerHistoryRetentionDays,
			});
		} else {
			this.ledger = null;
		}
	}

	/**
	 * Initialize the orchestrator by loading source registry and checkpoints
	 */
	async initialize(): Promise<void> {
		await this.loadSourceRegistry();
		await this.loadCheckpoints();
		await this.loadDiscoveredItems();
	}

	/**
	 * Load source registry from YAML
	 */
	private async loadSourceRegistry(): Promise<void> {
		try {
			const yaml = await import("yaml");
			const content = await fs.readFile(
				this.config.sourceRegistryPath,
				"utf-8",
			);
			const parsed = yaml.parse(content);

			for (const source of parsed.sources) {
				if (source.status === "active") {
					const config = this.createSourceConfig(source);
					this.sourceRegistry.set(source.id, config);
				}
			}
		} catch (error) {
			throw new Error(
				`Failed to load source registry: ${error instanceof Error ? error.message : "Unknown error"}`,
				{ cause: error },
			);
		}
	}

	private createSourceConfig(source: Record<string, unknown>): SourceConfig {
		return {
			sourceId: source.id as string,
			type: source.type as SourceConfig["type"],
			url: source.url as string,
			repo: source.repo as string | undefined,
			ringAffinity: ((source.ringAffinity as number[]) || [
				1,
			]) as DiscoveryRing[],
			researchDomains: (source.researchDomains as string[]) || [],
			subdomainTags: (source.subdomainCoverage as string[]) || [],
			headers: source.headers as Record<string, string> | undefined,
			params: source.params as Record<string, string> | undefined,
			rateLimit: source.rateLimit as number | undefined,
			timeoutMs: source.timeoutMs as number | undefined,
			retry: source.retry as RetryConfig | undefined,
			cacheTtlSeconds: source.cacheTtlSeconds as number | undefined,
			followRedirects: source.followRedirects as boolean | undefined,
			userAgent: source.userAgent as string | undefined,
		};
	}

	/**
	 * Load checkpoints from disk
	 */
	private async loadCheckpoints(): Promise<void> {
		try {
			const files = await fs.readdir(this.config.checkpointDir);
			for (const file of files) {
				if (file.endsWith(".json")) {
					const content = await fs.readFile(
						path.join(this.config.checkpointDir, file),
						"utf-8",
					);
					const checkpoint = JSON.parse(
						content,
					) as RetrievalCheckpoint;
					this.checkpoints.set(checkpoint.sourceId, checkpoint);
				}
			}
		} catch {
			// No checkpoints directory or empty - start fresh
		}
	}

	private async loadDiscoveredItems(): Promise<void> {
		try {
			const files = await fs.readdir(this.config.outputDir);
			for (const file of files) {
				if (file.endsWith(".jsonl")) {
					const content = await fs.readFile(
						path.join(this.config.outputDir, file),
						"utf-8",
					);
					const lines = content.trim().split("\n");
					for (const line of lines) {
						if (line.trim()) {
							const item = JSON.parse(
								line,
							) as DiscoveredItemRecord;
							this.discoveredItems.set(item.id, item);
							this.indexItem(item);
						}
					}
				}
			}
		} catch {
			// No items yet
		}
	}

	private indexItem(item: DiscoveredItemRecord): void {
		const hashes = this.sourceIndex.get(item.contentHash) || new Set();
		hashes.add(item.id);
		this.sourceIndex.set(item.contentHash, hashes);
	}

	/**
	 * Run a collection job
	 */
	async runJob(job: CollectionJob): Promise<CollectionJobResult> {
		const startedAt = new Date().toISOString();
		const results: RetrievalResult[] = [];
		const allErrors: RetrievalError[] = [];
		let sourcesSuccessful = 0;
		let sourcesFailed = 0;
		let totalItemsCollected = 0;
		let totalNewItems = 0;

		// Start discovery ledger execution if enabled
		if (this.ledger && job.writeLedger) {
			// Determine edition date from job or use today
			const editionDate = job.timeWindow
				? job.timeWindow.start.split("T")[0]
				: new Date().toISOString().split("T")[0];

			this.currentExecutionContext = await this.ledger.startExecution(
				editionDate,
				job.rings,
				job.sourceIds.length > 0
					? job.sourceIds
					: Array.from(this.sourceRegistry.keys()),
				"1.0.0", // collector version - could be from package.json
			);
		}

		// Filter sources by ring
		const sources = Array.from(this.sourceRegistry.values()).filter((s) =>
			job.rings.includes(s.ringAffinity[0]),
		);

		// Apply time window filter if specified
		let filteredSources = sources;
		if (job.timeWindow) {
			filteredSources = sources.filter((s) => {
				const checkpoint = this.checkpoints.get(s.sourceId);
				if (!checkpoint || !checkpoint.lastProcessedAt) return true;
				const lastCheck = new Date(
					checkpoint.lastProcessedAt,
				).getTime();
				const windowStart = new Date(job.timeWindow!.start).getTime();
				return lastCheck >= windowStart;
			});
		}

		// Determine which sources are scheduled vs not checked
		const scheduledSourceIds = new Set(
			filteredSources.map((s) => s.sourceId),
		);
		const allSourceIds = new Set(sources.map((s) => s.sourceId));

		// Process sources with concurrency control
		const semaphore = new Semaphore(this.config.maxConcurrency);

		const promises = filteredSources.map(async (source) => {
			await semaphore.acquire();
			try {
				const adapter = this.getAdapter(source);
				if (!adapter) {
					throw new Error(
						`No adapter for source type: ${source.type}`,
					);
				}

				const checkpoint = this.checkpoints.get(source.sourceId);
				const shouldFullRefresh = job.forceFullRefresh || !checkpoint;

				const result = await this.retrieveWithRetry(
					adapter,
					source,
					shouldFullRefresh ? undefined : checkpoint,
				);

				// Record in discovery ledger
				if (
					this.ledger &&
					job.writeLedger &&
					this.currentExecutionContext
				) {
					this.ledger.recordSourceMonitoring(
						source,
						result,
						this.currentExecutionContext.executionId,
						this.currentExecutionContext.editionDate,
						true, // scheduled
						1, // attempt number
						false, // isRetry
					);
				}

				// Update checkpoint
				if (result.items.length > 0) {
					const latestItem = result.items.reduce((latest, item) =>
						new Date(item.publishedAt) >
						new Date(latest.publishedAt)
							? item
							: latest,
					);
					this.checkpoints.set(source.sourceId, {
						sourceId: source.sourceId,
						cursor: latestItem.id,
						lastProcessedAt: latestItem.publishedAt,
						itemsProcessed: result.items.length,
						checkpointAt: new Date().toISOString(),
					});
				}

				// Persist items
				await this.persistItems(source, result.items);

				await semaphore.release();

				if (result.status === "ERROR") {
					sourcesFailed++;
				} else {
					sourcesSuccessful++;
				}

				totalItemsCollected += result.items.length;
				totalNewItems += result.newItemCount;
				results.push(result);
				allErrors.push(...result.errors);

				return result;
			} catch (error) {
				await semaphore.release();
				sourcesFailed++;
				allErrors.push({
					code: "SOURCE_FETCH_FAILED",
					message:
						error instanceof Error
							? error.message
							: "Unknown error",
					url: source.url,
					timestamp: new Date().toISOString(),
					retryable: false,
				});

				// Record failure in discovery ledger
				if (
					this.ledger &&
					job.writeLedger &&
					this.currentExecutionContext
				) {
					const errorResult: RetrievalResult = {
						sourceConfig: source,
						status: "ERROR",
						items: [],
						newItemCount: 0,
						updatedItemCount: 0,
						errors: [
							{
								code: "SOURCE_FETCH_FAILED",
								message:
									error instanceof Error
										? error.message
										: "Unknown error",
								url: source.url,
								timestamp: new Date().toISOString(),
								retryable: false,
							},
						],
						metadata: {
							startedAt: new Date().toISOString(),
							completedAt: new Date().toISOString(),
							durationMs: 0,
						},
					};
					this.ledger.recordSourceMonitoring(
						source,
						errorResult,
						this.currentExecutionContext.executionId,
						this.currentExecutionContext.editionDate,
						true,
						1,
						false,
					);
				}

				return null;
			}
		});

		await Promise.all(promises);

		// Record NOT_CHECKED for sources that were in the ring but not filtered (time window)
		if (this.ledger && job.writeLedger && this.currentExecutionContext) {
			for (const source of sources) {
				if (!scheduledSourceIds.has(source.sourceId)) {
					this.ledger.recordNotChecked(
						source,
						this.currentExecutionContext.executionId,
						this.currentExecutionContext.editionDate,
						"Filtered out by time window",
					);
				}
			}
		}

		// Save checkpoints
		await this.saveCheckpoints();

		// Complete discovery ledger execution
		if (this.ledger && job.writeLedger && this.currentExecutionContext) {
			await this.ledger.completeExecution();
			this.currentExecutionContext = null;
		}

		const completedAt = new Date().toISOString();

		return {
			jobId: job.jobId,
			startedAt,
			completedAt,
			durationMs: Date.now() - new Date(startedAt).getTime(),
			sourcesAttempted: filteredSources.length,
			sourcesSuccessful,
			sourcesFailed,
			totalItemsCollected,
			totalNewItems,
			totalUpdatedItems: 0,
			results: results.filter(Boolean) as RetrievalResult[],
			errors: allErrors,
		};
	}

	private getAdapter(source: SourceConfig): SourceAdapter | null {
		const adapter = this.adapters.get(source.type);
		if (adapter && adapter.canHandle(source)) {
			return adapter;
		}
		return null;
	}

	private async retrieveWithRetry(
		adapter: SourceAdapter,
		config: SourceConfig,
		checkpoint?: RetrievalCheckpoint,
	): Promise<RetrievalResult> {
		const retryConfig = config.retry || {
			maxAttempts: 3,
			baseDelayMs: 1000,
			maxDelayMs: 30000,
			retryableStatusCodes: [408, 429, 500, 502, 503, 504],
			backoffMultiplier: 2,
			jitter: true,
		};

		let lastError: Error | null = null;

		for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
			try {
				const result = await adapter.retrieve(config, checkpoint);
				if (
					result.status !== "ERROR" ||
					!result.errors.some((e) => e.retryable)
				) {
					return result;
				}
				lastError = new Error(result.errors[0].message);
			} catch (error) {
				lastError =
					error instanceof Error ? error : new Error("Unknown error");
			}

			if (attempt < retryConfig.maxAttempts) {
				const delay = Math.min(
					retryConfig.baseDelayMs *
						Math.pow(retryConfig.backoffMultiplier, attempt - 1),
					retryConfig.maxDelayMs,
				);
				const jitter = retryConfig.jitter
					? Math.random() * 0.3 * delay
					: 0;
				await this.sleep(delay + jitter);
			}
		}

		return {
			sourceConfig: config,
			status: "ERROR",
			items: [],
			newItemCount: 0,
			updatedItemCount: 0,
			errors: [
				{
					code: "MAX_RETRIES_EXCEEDED",
					message: `Max retries exceeded: ${lastError?.message}`,
					url: config.url,
					timestamp: new Date().toISOString(),
					retryable: false,
				},
			],
			metadata: {
				startedAt: new Date().toISOString(),
				completedAt: new Date().toISOString(),
				durationMs: 0,
			},
		};
	}

	private async persistItems(
		source: SourceConfig,
		items: CollectedItem[],
	): Promise<void> {
		const dateStr = new Date().toISOString().split("T")[0];
		const filePath = path.join(this.config.outputDir, `${dateStr}.jsonl`);

		let newCount = 0;
		let updatedCount = 0;

		for (const item of items) {
			const existing = this.discoveredItems.get(item.contentHash);
			const normalizedUrl = normalizeUrl(item.url);
			const isDuplicate = this.sourceIndex.has(item.contentHash);

			const record: DiscoveredItemRecord = {
				...item,
				discoveredAt: new Date().toISOString(),
				status: existing
					? existing.url === normalizedUrl
						? "duplicate"
						: "updated"
					: "new",
			};

			if (isDuplicate && !existing) {
				record.status = "duplicate";
			}

			this.discoveredItems.set(item.id, record);
			this.indexItem(record);

			if (record.status === "new") newCount++;
			else if (record.status === "updated") updatedCount++;
		}

		// Write to JSONL file
		const lines = Array.from(this.discoveredItems.values())
			.filter(
				(r) => r.sourceId === this.sourceRegistry.keys().next().value,
			) // Simplified
			.map((r) => JSON.stringify(r))
			.join("\n");

		await fs.writeFile(filePath, lines + "\n", "utf-8");
	}

	private async saveCheckpoints(): Promise<void> {
		await fs.mkdir(this.config.checkpointDir, { recursive: true });

		for (const [sourceId, checkpoint] of this.checkpoints) {
			const filePath = path.join(
				this.config.checkpointDir,
				`${sourceId}.json`,
			);
			await fs.writeFile(
				filePath,
				JSON.stringify(checkpoint, null, 2),
				"utf-8",
			);
		}
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

class Semaphore {
	private permits: number;
	private waiters: (() => void)[] = [];

	constructor(permits: number) {
		this.permits = permits;
	}

	async acquire(): Promise<void> {
		if (this.permits > 0) {
			this.permits--;
			return;
		}
		return new Promise((resolve) => this.waiters.push(resolve));
	}

	release(): void {
		this.permits++;
		if (this.waiters.length > 0) {
			this.permits--;
			const next = this.waiters.shift()!;
			next();
		}
	}
}
