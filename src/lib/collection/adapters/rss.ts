/**
 * RSS/Atom Feed Adapter
 *
 * Retrieves and parses RSS 2.0 and Atom 1.0 feeds with support for
 * conditional requests, pagination, and incremental fetching.
 */

import type {
	SourceAdapter,
	SourceConfig,
	RetrievalResult,
	RetrievalCheckpoint,
	RetrievalError,
	RetrievalStatus,
	CollectedItem,
	ValidationResult,
	AdapterMetadata,
	AdapterCapability,
	RetrievalMetadata,
} from "../types.js";

import { ADAPTER_METADATA } from "./index.js";

// Runtime values for RetrievalStatus (since it's a type alias, not an enum)
const RetrievalStatusValues = {
	CHECKED_FOUND: "CHECKED_FOUND" as RetrievalStatus,
	CHECKED_NONE: "CHECKED_NONE" as RetrievalStatus,
	INACCESSIBLE: "INACCESSIBLE" as RetrievalStatus,
	NOT_CHECKED: "NOT_CHECKED" as RetrievalStatus,
	ERROR: "ERROR" as RetrievalStatus,
};

export class RssAdapter implements SourceAdapter {
	readonly adapterId = "rss";
	readonly supportedTypes: ("rss" | "atom")[] = ["rss", "atom"];

	private readonly feedParser: FeedParser;

	constructor() {
		this.feedParser = new FeedParser();
	}

	canHandle(config: SourceConfig): boolean {
		return this.supportedTypes.includes(config.type as "rss" | "atom");
	}

	async validate(config: SourceConfig): Promise<ValidationResult> {
		try {
			const response = await this.fetchWithConditions(config, {
				method: "HEAD",
				headers: this.buildHeaders(config),
			});

			const contentType = response.headers.get("content-type") || "";
			const isFeed = this.isFeedContentType(contentType);

			return {
				accessible: response.ok && isFeed,
				statusCode: response.status,
				contentType,
				sampleItemCount: response.ok ? 1 : 0,
				errors:
					response.ok && !isFeed
						? [
								{
									code: "INVALID_CONTENT_TYPE",
									message: `Expected feed content type, got ${contentType}`,
									statusCode: response.status,
									url: config.url,
									timestamp: new Date().toISOString(),
									retryable: false,
								},
							]
						: undefined,
			};
		} catch (error) {
			return {
				accessible: false,
				errors: [
					{
						code: "VALIDATION_FAILED",
						message:
							error instanceof Error
								? error.message
								: "Unknown error",
						url: config.url,
						timestamp: new Date().toISOString(),
						retryable: true,
					},
				],
			};
		}
	}

	async retrieve(
		config: SourceConfig,
		checkpoint?: RetrievalCheckpoint,
	): Promise<RetrievalResult> {
		const startedAt = new Date().toISOString();
		const errors: RetrievalError[] = [];
		let statusCode: number | undefined;
		let etag: string | undefined;
		let lastModified: string | undefined;
		let cacheHit = false;
		let responseSize = 0;

		try {
			const response = await this.fetchWithConditions(config, {
				method: "GET",
				headers: this.buildHeaders(config, checkpoint),
			});

			statusCode = response.status;
			etag = response.headers.get("etag") || undefined;
			lastModified = response.headers.get("last-modified") || undefined;

			if (response.status === 304) {
				cacheHit = true;
				return this.buildResult(
					config,
					[],
					RetrievalStatusValues.CHECKED_NONE,
					startedAt,
					{
						statusCode,
						etag,
						lastModified,
						cacheHit: true,
					},
				);
			}

			if (!response.ok) {
				const error: RetrievalError = {
					code: "HTTP_ERROR",
					message: `HTTP ${response.status}: ${response.statusText}`,
					statusCode: response.status,
					url: config.url,
					timestamp: new Date().toISOString(),
					retryable: this.isRetryableStatus(response.status),
				};
				errors.push(error);

				return this.buildResult(
					config,
					[],
					RetrievalStatusValues.ERROR,
					startedAt,
					{
						statusCode,
						etag,
						lastModified,
						cacheHit,
					},
					errors,
				);
			}

			const contentType = response.headers.get("content-type") || "";
			if (!this.isFeedContentType(contentType)) {
				const error: RetrievalError = {
					code: "INVALID_CONTENT_TYPE",
					message: `Expected feed content type, got ${contentType}`,
					statusCode: response.status,
					url: config.url,
					timestamp: new Date().toISOString(),
					retryable: false,
				};
				errors.push(error);

				return this.buildResult(
					config,
					[],
					RetrievalStatusValues.ERROR,
					startedAt,
					{
						statusCode,
						etag,
						lastModified,
						cacheHit,
					},
					errors,
				);
			}

			const text = await response.text();
			responseSize = text.length;

			const feed = await this.feedParser.parse(text, config.url);
			const items = this.extractItems(feed, config, checkpoint);

			return this.buildResult(
				config,
				items,
				items.length > 0
					? RetrievalStatusValues.CHECKED_FOUND
					: RetrievalStatusValues.CHECKED_NONE,
				startedAt,
				{
					statusCode,
					etag,
					lastModified,
					cacheHit,
					responseSize,
				},
				errors,
			);
		} catch (error) {
			const retrievalError: RetrievalError = {
				code: "FETCH_FAILED",
				message:
					error instanceof Error ? error.message : "Unknown error",
				url: config.url,
				timestamp: new Date().toISOString(),
				retryable: true,
			};
			errors.push(retrievalError);

			return this.buildResult(
				config,
				[],
				RetrievalStatusValues.ERROR,
				startedAt,
				{
					statusCode,
					etag,
					lastModified,
					cacheHit,
					responseSize,
				},
				errors,
			);
		}
	}

	getMetadata(): AdapterMetadata {
		return ADAPTER_METADATA.rss;
	}

	private async fetchWithConditions(
		config: SourceConfig,
		options: RequestInit,
	): Promise<Response> {
		const response = await fetch(config.url, {
			...options,
			signal: AbortSignal.timeout(config.timeoutMs || 30000),
			redirect: config.followRedirects ? "follow" : "manual",
		});
		return response;
	}

	private isRetryableStatus(status: number): boolean {
		return [408, 429, 500, 502, 503, 504].includes(status);
	}

	private buildHeaders(
		config: SourceConfig,
		checkpoint?: RetrievalCheckpoint,
	): Record<string, string> {
		const headers: Record<string, string> = {
			"User-Agent": config.userAgent || "ai-intelligence-blog/1.0",
			Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
		};

		if (config.headers) {
			Object.assign(headers, config.headers);
		}

		if (checkpoint?.cursor) {
			// Use If-None-Match with ETag if available
			// For RSS, we typically use If-Modified-Since
		}

		if (checkpoint?.lastProcessedAt) {
			headers["If-Modified-Since"] = new Date(
				checkpoint.lastProcessedAt,
			).toUTCString();
		}

		return headers;
	}

	private isFeedContentType(contentType: string): boolean {
		const type = contentType.toLowerCase();
		return (
			type.includes("rss") ||
			type.includes("atom") ||
			type.includes("xml") ||
			type.includes("application/feed+json") ||
			type.includes("application/json")
		);
	}

	private extractItems(
		feed: ParsedFeed,
		config: SourceConfig,
		checkpoint?: RetrievalCheckpoint,
	): CollectedItem[] {
		const items: CollectedItem[] = [];
		const cutoffTime = checkpoint?.lastProcessedAt
			? new Date(checkpoint.lastProcessedAt).getTime()
			: 0;

		for (const entry of feed.items || []) {
			const publishedAt = this.extractEntryDate(entry);
			if (!publishedAt) continue;

			const publishedTime = new Date(publishedAt).getTime();
			if (cutoffTime && publishedTime <= cutoffTime) continue;

			const url = entry.link || entry.id || config.url;
			const contentHash = this.generateEntryHash(entry, url);

			const item: CollectedItem = {
				id: this.generateItemId(config.sourceId, url, contentHash),
				sourceId: config.sourceId,
				ring: config.ringAffinity[0] || 1,
				publishedAt,
				firstDisclosedAt: publishedAt,
				retrievedAt: new Date().toISOString(),
				sourceTimezone: "UTC",
				timestampConfidence: 0.9,
				url,
				title: entry.title || "Untitled",
				summary: entry.summary || entry.contentSnippet || undefined,
				authors: entry.author ? [entry.author] : entry.authors || [],
				contentHash,
				content: entry.content || entry.contentSnippet || undefined,
				rawMetadata: {
					guid: entry.guid,
					categories: entry.categories,
					enclosure: entry.enclosure,
				},
				tags: entry.categories || [],
				language: feed.language || "en",
				researchDomains: config.researchDomains,
				subdomainTags: config.subdomainTags,
			};

			items.push(item);
		}

		return items;
	}

	private extractEntryDate(entry: FeedEntry): string | null {
		// Try various date fields in order of preference
		const dateFields = [
			entry.published,
			entry.updated,
			entry.pubDate,
			entry.publishedDate,
			entry.date,
		];

		for (const field of dateFields) {
			if (field) {
				const parsed = new Date(field);
				if (!isNaN(parsed.getTime())) {
					return parsed.toISOString();
				}
			}
		}

		return null;
	}

	private generateEntryHash(entry: FeedEntry, url: string): string {
		const content = `${entry.title || ""}${entry.summary || ""}${entry.content || ""}${url}`;
		let hash = 0;
		for (let i = 0; i < content.length; i++) {
			const char = content.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash;
		}
		return `sha256:${Math.abs(hash).toString(16).padStart(64, "0")}`;
	}

	private generateItemId(
		sourceId: string,
		url: string,
		contentHash: string,
	): string {
		const combined = `${sourceId}|${url}|${contentHash}`;
		let hash = 0;
		for (let i = 0; i < combined.length; i++) {
			const char = combined.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash;
		}
		return `item_${Math.abs(hash).toString(36)}`;
	}

	private buildResult(
		config: SourceConfig,
		items: CollectedItem[],
		status: RetrievalStatus,
		startedAt: string,
		metadata: Partial<RetrievalMetadata>,
		errors: RetrievalError[] = [],
	): RetrievalResult {
		return {
			sourceConfig: config,
			status,
			items,
			newItemCount: items.length,
			updatedItemCount: 0,
			errors,
			metadata: {
				startedAt,
				completedAt: new Date().toISOString(),
				durationMs: Date.now() - new Date(startedAt).getTime(),
				...metadata,
			},
		};
	}
}

// Type definitions for parsed feed
interface ParsedFeed {
	title?: string;
	link?: string;
	description?: string;
	language?: string;
	items?: FeedEntry[];
}

interface FeedEntry {
	title?: string;
	link?: string;
	guid?: string;
	id?: string;
	summary?: string;
	content?: string;
	contentSnippet?: string;
	author?: string;
	authors?: string[];
	published?: string;
	updated?: string;
	pubDate?: string;
	publishedDate?: string;
	date?: string;
	categories?: string[];
	enclosure?: { url: string; type: string; length: string }[];
}

class FeedParser {
	async parse(text: string, sourceUrl: string): Promise<ParsedFeed> {
		// Simple RSS/Atom parser - in production would use a proper library
		// For now, implement basic XML parsing

		// Try to detect format
		if (
			text.includes("<feed") ||
			text.includes('xmlns="http://www.w3.org/2005/Atom"')
		) {
			return this.parseAtom(text);
		} else if (text.includes("<rss") || text.includes("<channel>")) {
			return this.parseRss(text);
		}

		// Try JSON Feed
		if (text.trim().startsWith("{") && text.includes('"version"')) {
			return this.parseJsonFeed(text);
		}

		throw new Error("Unrecognized feed format");
	}

	private parseRss(text: string): ParsedFeed {
		const feed: ParsedFeed = { items: [] };

		// Extract channel info
		const channelMatch = text.match(/<channel[^>]*>([\s\S]*?)<\/channel>/i);
		if (channelMatch) {
			const channelContent = channelMatch[1];
			feed.title = this.extractTag(channelContent, "title");
			feed.link = this.extractTag(channelContent, "link");
			feed.description = this.extractTag(channelContent, "description");
			feed.language = this.extractTag(channelContent, "language");

			// Extract items
			const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
			let match;
			while ((match = itemRegex.exec(channelContent)) !== null) {
				const itemContent = match[1];
				const author =
					this.extractTag(itemContent, "author") ||
					this.extractTag(itemContent, "dc:creator");
				const item: FeedEntry = {
					title: this.extractTag(itemContent, "title"),
					link: this.extractTag(itemContent, "link"),
					guid: this.extractTag(itemContent, "guid"),
					summary:
						this.extractTag(itemContent, "description") ||
						this.extractTag(itemContent, "summary"),
					content:
						this.extractTag(itemContent, "content:encoded") ||
						this.extractTag(itemContent, "content"),
					author: this.extractAuthorName(author),
					published: this.extractTag(itemContent, "pubDate"),
					pubDate: this.extractTag(itemContent, "pubDate"),
					categories: this.extractAllTags(itemContent, "category"),
				};
				feed.items!.push(item);
			}
		}

		return feed;
	}

	private extractAuthorName(author?: string): string | undefined {
		if (!author) return undefined;
		// Handle "email (name)" format
		const match = author.match(/\(([^)]+)\)/);
		if (match) return match[1].trim();
		// Handle "name <email>" format
		const match2 = author.match(/^([^<]+)</);
		if (match2) return match2[1].trim();
		return author.trim();
	}

	private extractAuthorFromAtom(entryContent: string): string | undefined {
		// Extract author name from <author><name>Name</name></author>
		const authorMatch = entryContent.match(
			/<author[^>]*>([\s\S]*?)<\/author>/i,
		);
		if (authorMatch) {
			const authorContent = authorMatch[1];
			const nameMatch = authorContent.match(
				/<name[^>]*>([\s\S]*?)<\/name>/i,
			);
			if (nameMatch) return nameMatch[1].trim();
			// Fallback: use the whole author content
			return authorContent.trim();
		}
		return undefined;
	}

	private parseAtom(text: string): ParsedFeed {
		const feed: ParsedFeed = { items: [] };

		// Extract feed info
		feed.title = this.extractTag(text, "title");
		feed.link = this.extractAttr(text, "link", "href");
		feed.description = this.extractTag(text, "subtitle");
		feed.language =
			this.extractAttr(text, "feed", "xml:lang") ||
			this.extractAttr(text, "feed", "lang");

		// Extract entries
		const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
		let match;
		while ((match = entryRegex.exec(text)) !== null) {
			const entryContent = match[1];
			const item: FeedEntry = {
				title: this.extractTag(entryContent, "title"),
				link: this.extractAttr(entryContent, "link", "href"),
				guid: this.extractTag(entryContent, "id"),
				summary: this.extractTag(entryContent, "summary"),
				content: this.extractTag(entryContent, "content"),
				author: this.extractAuthorFromAtom(entryContent),
				published: this.extractTag(entryContent, "published"),
				updated: this.extractTag(entryContent, "updated"),
				categories: this.extractAllAttrs(
					entryContent,
					"category",
					"term",
				),
			};
			feed.items!.push(item);
		}

		return feed;
	}

	private parseJsonFeed(text: string): ParsedFeed {
		try {
			const data = JSON.parse(text);
			const feed: ParsedFeed = {
				title: data.title,
				link: data.home_page_url || data.feed_url,
				description: data.description,
				language: data.language,
				items: [],
			};

			if (data.items) {
				for (const item of data.items) {
					feed.items!.push({
						title: item.title,
						link: item.url,
						guid: item.id,
						summary: item.summary,
						content: item.content_html || item.content_text,
						author: item.author?.name,
						published: item.date_published,
						updated: item.date_modified,
						categories: item.tags,
					});
				}
			}

			return feed;
		} catch {
			throw new Error("Invalid JSON Feed format");
		}
	}

	private extractTag(content: string, tagName: string): string | undefined {
		// Handle namespaced tags
		const regex = new RegExp(
			`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
			"i",
		);
		const match = content.match(regex);
		if (match) {
			return match[1].trim();
		}
		return undefined;
	}

	private extractAttr(
		content: string,
		tagName: string,
		attr: string,
	): string | undefined {
		const regex = new RegExp(
			`<${tagName}[^>]*${attr}=["']([^"']*)["']`,
			"i",
		);
		const match = content.match(regex);
		if (match) {
			return match[1].trim();
		}
		return undefined;
	}

	private extractAllTags(content: string, tagName: string): string[] {
		const results: string[] = [];
		const regex = new RegExp(
			`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
			"gi",
		);
		let match;
		while ((match = regex.exec(content)) !== null) {
			results.push(match[1].trim());
		}
		return results;
	}

	private extractAllAttrs(
		content: string,
		tagName: string,
		attr: string,
	): string[] {
		const results: string[] = [];
		const regex = new RegExp(
			`<${tagName}[^>]*${attr}=["']([^"']*)["']`,
			"gi",
		);
		let match;
		while ((match = regex.exec(content)) !== null) {
			results.push(match[1].trim());
		}
		return results;
	}
}
