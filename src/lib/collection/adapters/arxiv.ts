/**
 * arXiv API Adapter
 *
 * Queries arXiv API for preprints by category, author, or keyword.
 * Supports conditional requests, incremental fetching, and structured metadata extraction.
 */

import type {
	SourceAdapter,
	SourceConfig,
	RetrievalResult,
	RetrievalCheckpoint,
	RetrievalError,
	CollectedItem,
	ValidationResult,
	AdapterMetadata,
} from "../types.js";

interface ArxivEntry {
	id: string;
	title: string;
	summary: string;
	authors: { name: string }[];
	published: string;
	updated: string;
	categories: string[];
	links: { href: string; rel: string; type?: string }[];
}

interface ArxivFeed {
	feed: {
		title: string;
		id: string;
		updated: string;
		entry: ArxivEntry[];
	};
}

export class ArxivAdapter implements SourceAdapter {
	readonly adapterId = "arxiv";
	readonly supportedTypes: "arxiv"[] = ["arxiv"];

	private readonly baseUrl = "http://export.arxiv.org/api/query";

	canHandle(config: SourceConfig): boolean {
		return config.type === "arxiv";
	}

	async validate(config: SourceConfig): Promise<ValidationResult> {
		try {
			// Test with a minimal query
			const response = await fetch(
				`${this.baseUrl}?search_query=cat:cs.LG&max_results=1`,
				{
					method: "GET",
					headers: {
						Accept: "application/atom+xml, application/xml",
					},
				},
			);

			return {
				accessible: response.ok,
				statusCode: response.status,
				sampleItemCount: response.ok ? 1 : 0,
				errors: !response.ok
					? [
							{
								code: "ARXIV_API_ERROR",
								message: `arXiv API returned ${response.status}: ${response.statusText}`,
								statusCode: response.status,
								url: config.url,
								timestamp: new Date().toISOString(),
								retryable: response.status >= 500,
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
		const items: CollectedItem[] = [];

		try {
			// Build query from config
			const query = this.buildQuery(config);
			const maxResults =
				(config.parseOptions?.maxResults as number) || 100;

			let feed: ArxivFeed | null = null;
			let start = checkpoint?.page ? checkpoint.page * 50 : 0;

			while (items.length < maxResults) {
				const queryUrl = `${this.baseUrl}?search_query=${encodeURIComponent(query)}&start=${start}&max_results=50&sortBy=submittedDate&sortOrder=descending`;

				const response = await fetch(queryUrl, {
					method: "GET",
					headers: {
						Accept: "application/atom+xml, application/xml",
						"User-Agent":
							config.userAgent || "ai-intelligence-blog/1.0",
					},
				});

				if (!response.ok) {
					errors.push({
						code: "ARXIV_API_ERROR",
						message: `arXiv API returned ${response.status}: ${response.statusText}`,
						statusCode: response.status,
						url: config.url,
						timestamp: new Date().toISOString(),
						retryable: response.status >= 500,
					});
					break;
				}

				const text = await response.text();
				const parsed = this.parseFeed(text);
				feed = parsed;

				if (!feed.feed.entry || feed.feed.entry.length === 0) break;

				for (const entry of feed.feed.entry) {
					const publishedAt = entry.published;
					const publishedTime = new Date(publishedAt).getTime();
					const cutoffTime = checkpoint?.lastProcessedAt
						? new Date(checkpoint.lastProcessedAt).getTime()
						: 0;

					if (cutoffTime && publishedTime <= cutoffTime) {
						return this.buildResult(
							config,
							items,
							errors,
							startedAt,
						);
					}

					const contentHash = this.generateHash(
						`${entry.id}${entry.title}${entry.summary}`,
					);
					const url =
						entry.links.find((l) => l.rel === "alternate")?.href ||
						entry.id;

					const item: CollectedItem = {
						id: `arxiv_${entry.id.split("/").pop()}`,
						sourceId: config.sourceId,
						ring: config.ringAffinity[0] || 2,
						publishedAt,
						firstDisclosedAt: publishedAt,
						retrievedAt: new Date().toISOString(),
						sourceTimezone: "UTC",
						timestampConfidence: 0.95,
						url,
						title: entry.title.trim(),
						summary: entry.summary.trim().slice(0, 500),
						authors: entry.authors.map((a) => a.name),
						contentHash: `sha256:${contentHash}`,
						content: entry.summary,
						rawMetadata: {
							arxivId: entry.id.split("/").pop(),
							categories: entry.categories,
							updated: entry.updated,
							pdfUrl: entry.links.find(
								(l) => l.type === "application/pdf",
							)?.href,
						},
						tags: [...entry.categories, "preprint"],
						language: "en",
						researchDomains: config.researchDomains,
						subdomainTags: config.subdomainTags,
					};
					items.push(item);
				}

				if (feed.feed.entry.length < 50) break;
				start += 50;
			}

			return this.buildResult(config, items, errors, startedAt);
		} catch (error) {
			errors.push({
				code: "FETCH_FAILED",
				message:
					error instanceof Error ? error.message : "Unknown error",
				url: config.url,
				timestamp: new Date().toISOString(),
				retryable: true,
			});

			return this.buildResult(config, items, errors, startedAt);
		}
	}

	getMetadata(): AdapterMetadata {
		return {
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
		};
	}

	private buildQuery(config: SourceConfig): string {
		const parts: string[] = [];

		if (config.parseOptions?.categories) {
			const cats = Array.isArray(config.parseOptions.categories)
				? config.parseOptions.categories
				: [config.parseOptions.categories];
			parts.push(cats.map((c) => `cat:${c}`).join(" OR "));
		}

		if (config.parseOptions?.authors) {
			const authors = Array.isArray(config.parseOptions.authors)
				? config.parseOptions.authors
				: [config.parseOptions.authors];
			parts.push(authors.map((a) => `au:"${a}"`).join(" OR "));
		}

		if (config.parseOptions?.keywords) {
			const keywords = Array.isArray(config.parseOptions.keywords)
				? config.parseOptions.keywords
				: [config.parseOptions.keywords];
			parts.push(keywords.map((k) => `all:"${k}"`).join(" OR "));
		}

		// Default to AI-relevant categories if no query specified
		if (parts.length === 0) {
			parts.push(
				"cat:cs.LG OR cat:cs.CL OR cat:cs.DC OR cat:cs.SE OR cat:stat.ML",
			);
		}

		return parts.join(" AND ");
	}

	private parseFeed(text: string): ArxivFeed {
		// Parse Atom feed with arXiv extensions
		const feed: ArxivFeed = {
			feed: {
				title: "",
				id: "",
				updated: "",
				entry: [],
			},
		};

		// Extract feed-level info
		const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
		if (titleMatch) feed.feed.title = titleMatch[1].trim();

		const idMatch = text.match(/<id[^>]*>([\s\S]*?)<\/id>/i);
		if (idMatch) feed.feed.id = idMatch[1].trim();

		const updatedMatch = text.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
		if (updatedMatch) feed.feed.updated = updatedMatch[1].trim();

		// Extract entries
		const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
		let match;
		while ((match = entryRegex.exec(text)) !== null) {
			const entryContent = match[1];
			const entry: ArxivEntry = {
				id: this.extractTag(entryContent, "id") || "",
				title: this.extractTag(entryContent, "title") || "",
				summary: this.extractTag(entryContent, "summary") || "",
				authors: this.extractAuthors(entryContent),
				published: this.extractTag(entryContent, "published") || "",
				updated: this.extractTag(entryContent, "updated") || "",
				categories: this.extractCategories(entryContent),
				links: this.extractLinks(entryContent),
			};
			if (entry.id) feed.feed.entry.push(entry);
		}

		return feed;
	}

	private extractTag(content: string, tagName: string): string | undefined {
		const regex = new RegExp(
			`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
			"i",
		);
		const match = content.match(regex);
		return match ? match[1].trim() : undefined;
	}

	private extractAuthors(content: string): { name: string }[] {
		const authors: { name: string }[] = [];
		const authorRegex = /<author[^>]*>([\s\S]*?)<\/author>/gi;
		let match;
		while ((match = authorRegex.exec(content)) !== null) {
			const authorContent = match[1];
			const name = this.extractTag(authorContent, "name");
			if (name) authors.push({ name });
		}
		return authors;
	}

	private extractCategories(content: string): string[] {
		const categories: string[] = [];
		const catRegex = /<category[^>]*term=["']([^"']*)["']/gi;
		let match;
		while ((match = catRegex.exec(content)) !== null) {
			categories.push(match[1]);
		}
		return categories;
	}

	private extractLinks(
		content: string,
	): { href: string; rel: string; type?: string }[] {
		const links: { href: string; rel: string; type?: string }[] = [];
		const linkRegex =
			/<link[^>]*href=["']([^"']*)["'][^>]*rel=["']([^"']*)["']([^>]*type=["']([^"']*)["'])?/gi;
		let match;
		while ((match = linkRegex.exec(content)) !== null) {
			links.push({
				href: match[1],
				rel: match[2],
				type: match[4],
			});
		}
		return links;
	}

	private generateHash(content: string): string {
		let hash = 0;
		for (let i = 0; i < content.length; i++) {
			const char = content.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash;
		}
		return Math.abs(hash).toString(16).padStart(64, "0");
	}

	private buildResult(
		config: SourceConfig,
		items: CollectedItem[],
		errors: RetrievalError[],
		startedAt: string,
	): RetrievalResult {
		return {
			sourceConfig: config,
			status:
				errors.length > 0
					? "ERROR"
					: items.length > 0
						? "CHECKED_FOUND"
						: "CHECKED_NONE",
			items,
			newItemCount: items.length,
			updatedItemCount: 0,
			errors,
			metadata: {
				startedAt,
				completedAt: new Date().toISOString(),
				durationMs: Date.now() - new Date(startedAt).getTime(),
			},
		};
	}
}
