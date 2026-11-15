/**
 * RSS Adapter Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { RssAdapter } from "./rss.js";
import type { SourceConfig, RetrievalCheckpoint } from "../types.js";

describe("RssAdapter", () => {
	let adapter: RssAdapter;

	beforeEach(() => {
		adapter = new RssAdapter();
	});

	describe("canHandle", () => {
		it("returns true for rss type", () => {
			const config = {
				type: "rss",
				url: "https://example.com/feed.xml",
			} as SourceConfig;
			expect(adapter.canHandle(config)).toBe(true);
		});

		it("returns true for atom type", () => {
			const config = {
				type: "atom",
				url: "https://example.com/feed.atom",
			} as SourceConfig;
			expect(adapter.canHandle(config)).toBe(true);
		});

		it("returns false for other types", () => {
			const config = {
				type: "github",
				url: "https://github.com/owner/repo",
			} as SourceConfig;
			expect(adapter.canHandle(config)).toBe(false);
		});
	});

	describe("getMetadata", () => {
		it("returns correct adapter metadata", () => {
			const metadata = adapter.getMetadata();
			expect(metadata.adapterId).toBe("rss");
			expect(metadata.name).toBe("RSS/Atom Feed Adapter");
			expect(metadata.supportedTypes).toEqual(["rss", "atom"]);
			expect(metadata.capabilities).toContain("conditional-requests");
			expect(metadata.capabilities).toContain("etag-support");
			expect(metadata.capabilities).toContain("last-modified-support");
		});
	});

	describe("validate", () => {
		it("validates accessible feed", async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				headers: new Headers({ "content-type": "application/rss+xml" }),
			};
			global.fetch = vi.fn().mockResolvedValue(mockResponse);

			const config = {
				type: "rss",
				url: "https://example.com/feed.xml",
			} as SourceConfig;
			const result = await adapter.validate(config);

			expect(result.accessible).toBe(true);
			expect(result.statusCode).toBe(200);
		});

		it("rejects non-feed content type", async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				headers: new Headers({ "content-type": "text/html" }),
			};
			global.fetch = vi.fn().mockResolvedValue(mockResponse);

			const config = {
				type: "rss",
				url: "https://example.com/feed.xml",
			} as SourceConfig;
			const result = await adapter.validate(config);

			expect(result.accessible).toBe(false);
			expect(result.errors).toBeDefined();
			expect(result.errors![0].code).toBe("INVALID_CONTENT_TYPE");
		});

		it("handles network errors", async () => {
			global.fetch = vi
				.fn()
				.mockRejectedValue(new Error("Network error"));

			const config = {
				type: "rss",
				url: "https://example.com/feed.xml",
			} as SourceConfig;
			const result = await adapter.validate(config);

			expect(result.accessible).toBe(false);
			expect(result.errors![0].retryable).toBe(true);
		});
	});

	describe("retrieve", () => {
		it("returns CHECKED_NONE for 304 Not Modified", async () => {
			const mockResponse = {
				ok: true,
				status: 304,
				headers: new Headers({
					etag: '"abc123"',
					"last-modified": "Mon, 10 Nov 2025 06:00:00 GMT",
				}),
			};
			global.fetch = vi.fn().mockResolvedValue(mockResponse);

			const config = {
				type: "rss",
				url: "https://example.com/feed.xml",
				sourceId: "test",
			} as SourceConfig;
			const result = await adapter.retrieve(config);

			expect(result.status).toBe("CHECKED_NONE");
			expect(result.items).toHaveLength(0);
			expect(result.metadata.cacheHit).toBe(true);
		});

		it("returns ERROR for HTTP error", async () => {
			const mockResponse = {
				ok: false,
				status: 404,
				statusText: "Not Found",
				headers: new Headers({}),
			};
			global.fetch = vi.fn().mockResolvedValue(mockResponse);

			const config = {
				type: "rss",
				url: "https://example.com/feed.xml",
				sourceId: "test",
			} as SourceConfig;
			const result = await adapter.retrieve(config);

			expect(result.status).toBe("ERROR");
			expect(result.errors[0].code).toBe("HTTP_ERROR");
		});

		it("parses RSS 2.0 feed", async () => {
			const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <link>https://example.com</link>
    <description>Test feed</description>
    <language>en</language>
    <item>
      <title>Test Item 1</title>
      <link>https://example.com/item1</link>
      <guid>item1</guid>
      <description>Description 1</description>
      <pubDate>Mon, 10 Nov 2025 06:00:00 +0000</pubDate>
      <category>AI</category>
      <category>ML</category>
      <author>author@example.com (Author Name)</author>
    </item>
    <item>
      <title>Test Item 2</title>
      <link>https://example.com/item2</link>
      <guid>item2</guid>
      <description>Description 2</description>
      <pubDate>Mon, 09 Nov 2025 06:00:00 +0000</pubDate>
      <category>Research</category>
    </item>
  </channel>
</rss>`;

			const mockResponse = {
				ok: true,
				status: 200,
				headers: new Headers({ "content-type": "application/rss+xml" }),
				text: () => Promise.resolve(rssContent),
			};
			global.fetch = vi.fn().mockResolvedValue(mockResponse);

			const config = {
				type: "rss",
				url: "https://example.com/feed.xml",
				sourceId: "test",
				ringAffinity: [1],
			} as SourceConfig;
			const result = await adapter.retrieve(config);

			expect(result.status).toBe("CHECKED_FOUND");
			expect(result.items).toHaveLength(2);
			expect(result.items[0].title).toBe("Test Item 1");
			expect(result.items[0].authors).toContain("Author Name");
			expect(result.items[0].tags).toContain("AI");
			expect(result.items[0].tags).toContain("ML");
			expect(result.items[0].researchDomains).toEqual(undefined);
		});

		it("parses Atom 1.0 feed", async () => {
			const atomContent = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Feed</title>
  <link href="https://example.com"/>
  <updated>2025-11-10T06:00:00Z</updated>
  <entry>
    <id>tag:example.com,2025:item1</id>
    <title>Atom Item 1</title>
    <link href="https://example.com/item1" rel="alternate"/>
    <summary>Atom summary</summary>
    <content type="html">Atom content</content>
    <author><name>Author Name</name></author>
    <published>2025-11-10T06:00:00Z</published>
    <updated>2025-11-10T07:00:00Z</updated>
    <category term="AI"/>
    <category term="ML"/>
  </entry>
</feed>`;

			const mockResponse = {
				ok: true,
				status: 200,
				headers: new Headers({
					"content-type": "application/atom+xml",
				}),
				text: () => Promise.resolve(atomContent),
			};
			global.fetch = vi.fn().mockResolvedValue(mockResponse);

			const config = {
				type: "atom",
				url: "https://example.com/feed.atom",
				sourceId: "test",
				ringAffinity: [1],
			} as SourceConfig;
			const result = await adapter.retrieve(config);

			expect(result.status).toBe("CHECKED_FOUND");
			expect(result.items).toHaveLength(1);
			expect(result.items[0].title).toBe("Atom Item 1");
			expect(result.items[0].authors).toContain("Author Name");
			expect(result.items[0].tags).toContain("AI");
			expect(result.items[0].sourceTimezone).toBe("UTC");
		});

		it("parses JSON Feed", async () => {
			const jsonFeed = JSON.stringify({
				version: "https://jsonfeed.org/version/1",
				title: "JSON Feed",
				home_page_url: "https://example.com",
				feed_url: "https://example.com/feed.json",
				items: [
					{
						id: "item1",
						title: "JSON Item",
						url: "https://example.com/item1",
						content_html: "<p>HTML content</p>",
						summary: "Plain summary",
						author: { name: "JSON Author" },
						date_published: "2025-11-10T06:00:00Z",
						tags: ["JSON", "Feed"],
					},
				],
			});

			const mockResponse = {
				ok: true,
				status: 200,
				headers: new Headers({ "content-type": "application/json" }),
				text: () => Promise.resolve(jsonFeed),
			};
			global.fetch = vi.fn().mockResolvedValue(mockResponse);

			const config = {
				type: "rss",
				url: "https://example.com/feed.json",
				sourceId: "test",
				ringAffinity: [1],
			} as SourceConfig;
			const result = await adapter.retrieve(config);

			expect(result.status).toBe("CHECKED_FOUND");
			expect(result.items).toHaveLength(1);
			expect(result.items[0].title).toBe("JSON Item");
			expect(result.items[0].authors).toContain("JSON Author");
			expect(result.items[0].tags).toContain("JSON");
		});

		it("respects checkpoint for incremental fetch", async () => {
			const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Old Item</title>
      <link>https://example.com/old</link>
      <guid>old</guid>
      <pubDate>Mon, 01 Jan 2025 06:00:00 +0000</pubDate>
    </item>
    <item>
      <title>New Item</title>
      <link>https://example.com/new</link>
      <guid>new</guid>
      <pubDate>Mon, 10 Nov 2025 06:00:00 +0000</pubDate>
    </item>
  </channel>
</rss>`;

			const mockResponse = {
				ok: true,
				status: 200,
				headers: new Headers({ "content-type": "application/rss+xml" }),
				text: () => Promise.resolve(rssContent),
			};
			global.fetch = vi.fn().mockResolvedValue(mockResponse);

			const checkpoint: RetrievalCheckpoint = {
				sourceId: "test",
				lastProcessedAt: "2025-01-15T00:00:00Z",
				itemsProcessed: 0,
				checkpointAt: "2025-01-15T00:00:00Z",
			};

			const config = {
				type: "rss",
				url: "https://example.com/feed.xml",
				sourceId: "test",
				ringAffinity: [1],
			} as SourceConfig;
			const result = await adapter.retrieve(config, checkpoint);

			expect(result.items).toHaveLength(1);
			expect(result.items[0].title).toBe("New Item");
		});

		it("handles malformed XML gracefully", async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				headers: new Headers({ "content-type": "application/rss+xml" }),
				text: () => Promise.resolve("not valid xml"),
			};
			global.fetch = vi.fn().mockResolvedValue(mockResponse);

			const config = {
				type: "rss",
				url: "https://example.com/feed.xml",
				sourceId: "test",
			} as SourceConfig;
			const result = await adapter.retrieve(config);

			expect(result.status).toBe("ERROR");
			expect(result.errors[0].code).toBe("FETCH_FAILED");
		});
	});
});
