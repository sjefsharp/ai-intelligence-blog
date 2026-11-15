/**
 * Source Collection Pipeline — Common Types & Interfaces
 *
 * Defines the unified retrieval interface and data structures for
 * all three discovery rings per AI Intelligence Publication Contract §3.
 */

import type { Temporal } from "@js-temporal/polyfill";

/**
 * Source type categories matching the source registry
 */
export type SourceType =
	| "rss"
	| "atom"
	| "github"
	| "arxiv"
	| "conference"
	| "security"
	| "api-docs"
	| "blog"
	| "benchmark-repo"
	| "html"
	| "json-api";

/**
 * Discovery ring classification
 */
export type DiscoveryRing = 1 | 2 | 3;

/**
 * Retrieval status for ledger entries
 */
export type RetrievalStatus =
	"CHECKED_FOUND" | "CHECKED_NONE" | "INACCESSIBLE" | "NOT_CHECKED" | "ERROR";

/**
 * HTTP method for retrieval
 */
export type HttpMethod = "GET" | "HEAD";

/**
 * Source-specific retrieval configuration
 */
export interface SourceConfig {
	/** Unique source identifier (matches source registry) */
	sourceId: string;
	/** Source type determining adapter selection */
	type: SourceType;
	/** Primary URL for retrieval */
	url: string;
	/** GitHub repository (owner/name) for github type */
	repo?: string;
	/** Discovery ring affinity */
	ringAffinity: DiscoveryRing[];
	/** Research domains covered */
	researchDomains: string[];
	/** Subdomain tags */
	subdomainTags: string[];
	/** Request headers */
	headers?: Record<string, string>;
	/** Query parameters */
	params?: Record<string, string>;
	/** HTTP method */
	method?: HttpMethod;
	/** Expected content type */
	expectedContentType?: string;
	/** Custom parsing options */
	parseOptions?: Record<string, unknown>;
	/** Rate limit (requests per minute) */
	rateLimit?: number;
	/** Timeout in milliseconds */
	timeoutMs?: number;
	/** Retry configuration */
	retry?: RetryConfig;
	/** Cache TTL in seconds */
	cacheTtlSeconds?: number;
	/** Whether to follow redirects */
	followRedirects?: boolean;
	/** User agent string */
	userAgent?: string;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
	maxAttempts: number;
	baseDelayMs: number;
	maxDelayMs: number;
	retryableStatusCodes: number[];
	backoffMultiplier: number;
	jitter: boolean;
}

/**
 * Normalized item from any source
 */
export interface CollectedItem {
	/** Stable unique identifier for this item */
	id: string;
	/** Source registry ID */
	sourceId: string;
	/** Discovery ring this item belongs to */
	ring: DiscoveryRing;
	/** Original publication timestamp from source */
	publishedAt: string;
	/** First supported public disclosure timestamp */
	firstDisclosedAt?: string;
	/** Underlying event date (if different from publication) */
	eventDate?: string;
	/** Last substantive update timestamp */
	lastUpdatedAt?: string;
	/** Retrieval timestamp */
	retrievedAt: string;
	/** Source timezone for timestamp interpretation */
	sourceTimezone?: string;
	/** Timestamp confidence (0-1) */
	timestampConfidence?: number;
	/** Canonical URL */
	url: string;
	/** Title from source */
	title: string;
	/** Summary/description from source */
	summary?: string;
	/** Author(s) if available */
	authors?: string[];
	/** Content hash for deduplication */
	contentHash: string;
	/** Raw content (truncated for storage) */
	content?: string;
	/** Raw metadata from source */
	rawMetadata: Record<string, unknown>;
	/** Tags extracted from source */
	tags?: string[];
	/** Language */
	language?: string;
	/** Research domains */
	researchDomains?: string[];
	/** Subdomain tags */
	subdomainTags?: string[];
}

/**
 * Retrieval result for a single source
 */
export interface RetrievalResult {
	/** Source configuration used */
	sourceConfig: SourceConfig;
	/** Overall retrieval status */
	status: RetrievalStatus;
	/** Items discovered */
	items: CollectedItem[];
	/** Number of new items */
	newItemCount: number;
	/** Number of updated items */
	updatedItemCount: number;
	/** Errors encountered */
	errors: RetrievalError[];
	/** Request metadata */
	metadata: RetrievalMetadata;
	/** Checkpoint for resumable collection */
	checkpoint?: RetrievalCheckpoint;
}

/**
 * Retrieval error details
 */
export interface RetrievalError {
	/** Error code */
	code: string;
	/** Human-readable message */
	message: string;
	/** HTTP status if applicable */
	statusCode?: number;
	/** URL that caused error */
	url?: string;
	/** Timestamp */
	timestamp: string;
	/** Whether error is retryable */
	retryable: boolean;
	/** Additional context */
	context?: Record<string, unknown>;
}

/**
 * Retrieval metadata
 */
export interface RetrievalMetadata {
	/** Request start time */
	startedAt: string;
	/** Request end time */
	completedAt: string;
	/** Duration in milliseconds */
	durationMs: number;
	/** HTTP status code */
	statusCode?: number;
	/** Response size in bytes */
	responseSize?: number;
	/** ETag if available */
	etag?: string;
	/** Last-Modified header */
	lastModified?: string;
	/** Cache hit/miss */
	cacheHit?: boolean;
	/** Rate limit remaining */
	rateLimitRemaining?: number;
	/** Rate limit reset time */
	rateLimitReset?: string;
}

/**
 * Checkpoint for resumable collection
 */
export interface RetrievalCheckpoint {
	/** Source ID */
	sourceId: string;
	/** Last processed item ID or cursor */
	cursor?: string;
	/** Last processed timestamp */
	lastProcessedAt?: string;
	/** Page number for paginated sources */
	page?: number;
	/** Total items processed in this session */
	itemsProcessed: number;
	/** Checkpoint timestamp */
	checkpointAt: string;
}

/**
 * Source adapter interface
 */
export interface SourceAdapter {
	/** Adapter identifier */
	readonly adapterId: string;
	/** Supported source types */
	readonly supportedTypes: SourceType[];
	/** Test if adapter can handle this source */
	canHandle(config: SourceConfig): boolean;
	/** Retrieve items from source */
	retrieve(
		config: SourceConfig,
		checkpoint?: RetrievalCheckpoint,
	): Promise<RetrievalResult>;
	/** Validate source accessibility */
	validate(config: SourceConfig): Promise<ValidationResult>;
	/** Get adapter metadata */
	getMetadata(): AdapterMetadata;
}

/**
 * Validation result for source accessibility
 */
export interface ValidationResult {
	/** Whether source is accessible */
	accessible: boolean;
	/** HTTP status code */
	statusCode?: number;
	/** Content type */
	contentType?: string;
	/** Sample items found */
	sampleItemCount?: number;
	/** Errors if not accessible */
	errors?: RetrievalError[];
	/** Warnings */
	warnings?: string[];
}

/**
 * Adapter metadata
 */
export interface AdapterMetadata {
	adapterId: string;
	name: string;
	version: string;
	description: string;
	supportedTypes: SourceType[];
	capabilities: AdapterCapability[];
}

/**
 * Adapter capabilities
 */
export type AdapterCapability =
	| "pagination"
	| "conditional-requests"
	| "incremental-fetch"
	| "full-history"
	| "real-time"
	| "authentication"
	| "rate-limit-headers"
	| "etag-support"
	| "last-modified-support"
	| "content-hash"
	| "timestamp-extraction"
	| "author-extraction"
	| "tag-extraction"
	| "language-detection";

/**
 * Collection job configuration
 */
export interface CollectionJob {
	/** Job ID */
	jobId: string;
	/** Job name */
	name: string;
	/** Sources to collect */
	sourceIds: string[];
	/** Discovery rings to include */
	rings: DiscoveryRing[];
	/** Time window for collection */
	timeWindow?: TimeWindow;
	/** Whether to force full refresh */
	forceFullRefresh?: boolean;
	/** Maximum items per source */
	maxItemsPerSource?: number;
	/** Concurrency limit */
	concurrency?: number;
	/** Retry configuration */
	retry?: RetryConfig;
	/** Output directory */
	outputDir: string;
	/** Whether to write to discovery ledger */
	writeLedger?: boolean;
}

/**
 * Time window for collection
 */
export interface TimeWindow {
	/** Start of window (inclusive) */
	start: string;
	/** End of window (exclusive) */
	end: string;
	/** Timezone for window boundaries */
	timezone: string;
}

/**
 * Collection job result
 */
export interface CollectionJobResult {
	jobId: string;
	startedAt: string;
	completedAt: string;
	durationMs: number;
	sourcesAttempted: number;
	sourcesSuccessful: number;
	sourcesFailed: number;
	totalItemsCollected: number;
	totalNewItems: number;
	totalUpdatedItems: number;
	results: RetrievalResult[];
	errors: RetrievalError[];
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
	maxAttempts: 3,
	baseDelayMs: 1000,
	maxDelayMs: 30000,
	retryableStatusCodes: [408, 429, 500, 502, 503, 504],
	backoffMultiplier: 2,
	jitter: true,
};

/**
 * Default adapter metadata
 */
export const ADAPTER_METADATA: Record<string, AdapterMetadata> = {
	rss: {
		adapterId: "rss",
		name: "RSS/Atom Feed Adapter",
		version: "1.0.0",
		description: "Retrieves and parses RSS 2.0 and Atom 1.0 feeds",
		supportedTypes: ["rss", "atom"],
		capabilities: [
			"pagination",
			"conditional-requests",
			"incremental-fetch",
			"etag-support",
			"last-modified-support",
			"content-hash",
			"timestamp-extraction",
			"author-extraction",
			"tag-extraction",
			"language-detection",
		],
	},
	github: {
		adapterId: "github",
		name: "GitHub API Adapter",
		version: "1.0.0",
		description:
			"Retrieves releases, commits, issues, and discussions from GitHub",
		supportedTypes: ["github"],
		capabilities: [
			"pagination",
			"conditional-requests",
			"incremental-fetch",
			"full-history",
			"authentication",
			"rate-limit-headers",
			"etag-support",
			"content-hash",
			"timestamp-extraction",
			"author-extraction",
			"tag-extraction",
		],
	},
	arxiv: {
		adapterId: "arxiv",
		name: "arXiv API Adapter",
		version: "1.0.0",
		description:
			"Queries arXiv API for preprints by category, author, or keyword",
		supportedTypes: ["arxiv"],
		capabilities: [
			"pagination",
			"conditional-requests",
			"incremental-fetch",
			"content-hash",
			"timestamp-extraction",
			"author-extraction",
			"tag-extraction",
		],
	},
	html: {
		adapterId: "html",
		name: "HTML/JSON Extraction Adapter",
		version: "1.0.0",
		description: "Extracts structured data from HTML pages and JSON APIs",
		supportedTypes: ["html", "json-api", "blog", "api-docs"],
		capabilities: [
			"conditional-requests",
			"etag-support",
			"last-modified-support",
			"content-hash",
			"timestamp-extraction",
			"author-extraction",
			"tag-extraction",
			"language-detection",
		],
	},
};

/**
 * Creates a default source config from registry entry
 */
export function createSourceConfig(registryEntry: {
	id: string;
	type: SourceType;
	url: string;
	repo?: string;
	tags: string[];
	researchDomains?: string[];
	subdomainCoverage?: string[];
	ringAffinity?: DiscoveryRing[];
}): SourceConfig {
	return {
		sourceId: registryEntry.id,
		type: registryEntry.type,
		url: registryEntry.url,
		repo: registryEntry.repo,
		ringAffinity: registryEntry.ringAffinity || [1],
		researchDomains: registryEntry.researchDomains || [],
		subdomainTags: registryEntry.subdomainCoverage || [],
		rateLimit: 60,
		timeoutMs: 30000,
		retry: DEFAULT_RETRY_CONFIG,
		cacheTtlSeconds: 3600,
		followRedirects: true,
		userAgent:
			"ai-intelligence-blog/1.0 (+https://github.com/ai-intelligence-blog)",
	};
}

/**
 * Generates a stable content hash for deduplication
 */
export function generateContentHash(content: string): string {
	// Simple hash for now - in production would use crypto.subtle.digest
	let hash = 0;
	for (let i = 0; i < content.length; i++) {
		const char = content.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return `sha256:${Math.abs(hash).toString(16).padStart(64, "0")}`;
}

/**
 * Normalizes a URL for comparison
 */
export function normalizeUrl(url: string): string {
	try {
		const parsed = new URL(url);
		// Remove fragment
		parsed.hash = "";
		// Normalize pathname
		parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
		// Sort search params
		const params = Array.from(parsed.searchParams.entries()).sort((a, b) =>
			a[0].localeCompare(b[0]),
		);
		parsed.search = new URLSearchParams(params).toString();
		return parsed.toString();
	} catch {
		return url;
	}
}

/**
 * Extracts timestamp from various formats with timezone awareness
 */
export function extractTimestamp(
	value: unknown,
	sourceTimezone: string = "UTC",
): { timestamp: string; confidence: number } | null {
	if (!value) return null;

	const str = String(value).trim();
	if (!str) return null;

	// Try ISO 8601 with timezone
	const isoMatch = str.match(
		/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/,
	);
	if (isoMatch) {
		return { timestamp: isoMatch[1], confidence: 0.95 };
	}

	// Try RFC 2822 / RSS date format
	const rfcMatch = str.match(
		/^(\w{3}, \d{2} \w{3} \d{4} \d{2}:\d{2}:\d{2} [+-]\d{4})/,
	);
	if (rfcMatch) {
		return { timestamp: rfcMatch[1], confidence: 0.85 };
	}

	// Try simple date formats
	const simpleMatch = str.match(/^(\d{4}-\d{2}-\d{2})/);
	if (simpleMatch) {
		return {
			timestamp: `${simpleMatch[1]}T00:00:00${sourceTimezone === "UTC" ? "Z" : ""}`,
			confidence: 0.7,
		};
	}

	return null;
}

/**
 * Determines if two items are duplicates based on content hash
 */
export function isDuplicate(
	item1: CollectedItem,
	item2: CollectedItem,
): boolean {
	return (
		item1.contentHash === item2.contentHash ||
		normalizeUrl(item1.url) === normalizeUrl(item2.url)
	);
}
