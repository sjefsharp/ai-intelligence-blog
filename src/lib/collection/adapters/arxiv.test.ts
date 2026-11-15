/**
 * arXiv Adapter Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArxivAdapter } from "./arxiv.js";
import type { SourceConfig, RetrievalCheckpoint } from "../types.js";

describe("ArxivAdapter", () => {
	let adapter: ArxivAdapter;

	beforeEach(() => {
		adapter = new ArxivAdapter();
		vi.clearAllMocks();
	});

	describe("canHandle", () => {
		it("returns true for arxiv type", () => {
			const config = {
				type: "arxiv",
				url: "https://arxiv.org/api/query",
			} as unknown as SourceConfig;
			expect(adapter.canHandle(config)).toBe(true);
		});

		it("returns false for other types", () => {
			const config = {
				type: "rss",
				url: "https://example.com/feed.xml",
			} as unknown as SourceConfig;
			expect(adapter.canHandle(config)).toBe(false);
		});
	});

	describe("getMetadata", () => {
		it("returns correct adapter metadata", () => {
			const metadata = adapter.getMetadata();
			expect(metadata.adapterId).toBe("arxiv");
			expect(metadata.name).toBe("arXiv API Adapter");
			expect(metadata.supportedTypes).toEqual(["arxiv"]);
			expect(metadata.capabilities).toContain("pagination");
			expect(metadata.capabilities).toContain("content-hash");
			expect(metadata.capabilities).toContain("author-extraction");
		});
	});

	describe("validate", () => {
		it("validates accessible arXiv API", async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				headers: new Headers({
					"content-type": "application/atom+xml",
				}),
			};
			global.fetch = vi.fn().mockResolvedValue(mockResponse);

			const config = {
				type: "arxiv",
				url: "https://arxiv.org/api/query",
				sourceId: "test",
			} as unknown as SourceConfig;
			const result = await adapter.validate(config);

			expect(result.accessible).toBe(true);
			expect(result.statusCode).toBe(200);
		});

		it("handles API errors", async () => {
			const mockResponse = {
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
				headers: new Headers({}),
			};
			global.fetch = vi.fn().mockResolvedValue(mockResponse);

			const config = {
				type: "arxiv",
				url: "https://arxiv.org/api/query",
				sourceId: "test",
			} as unknown as SourceConfig;
			const result = await adapter.validate(config);

			expect(result.accessible).toBe(false);
			expect(result.errors).toBeDefined();
			expect(result.errors![0].retryable).toBe(true);
		});
	});

	describe("retrieve", () => {
		it("fetches and parses arXiv Atom feed", async () => {
			const atomContent = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>arXiv query results</title>
  <id>https://arxiv.org/api/query</id>
  <updated>2025-11-10T06:00:00Z</updated>
  <entry>
    <id>https://arxiv.org/abs/2511.01234v1</id>
    <title>Test Paper Title</title>
    <summary>This is a test paper abstract about machine learning.</summary>
    <author><name>John Doe</name></author>
    <author><name>Jane Smith</name></author>
    <published>2025-11-10T06:00:00Z</published>
    <updated>2025-11-10T06:00:00Z</updated>
    <category term="cs.LG"/>
    <category term="cs.CL"/>
    <link href="https://arxiv.org/abs/2511.01234v1" rel="alternate" type="text/html"/>
    <link href="https://arxiv.org/pdf/2511.01234v1.pdf" rel="related" type="application/pdf"/>
  </entry>
  <entry>
    <id>https://arxiv.org/abs/2511.05678v1</id>
    <title>Another Paper</title>
    <summary>Another abstract about NLP.</summary>
    <author><name>Alice Brown</name></author>
    <published>2025-11-09T06:00:00Z</published>
    <category term="cs.CL"/>
    <link href="https://arxiv.org/abs/2511.05678v1" rel="alternate" type="text/html"/>
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
				type: "arxiv",
				url: "https://arxiv.org/api/query",
				sourceId: "test",
				ringAffinity: [2],
				parseOptions: { maxResults: 100 },
			} as unknown as SourceConfig;

			const result = await adapter.retrieve(config);

			expect(result.status).toBe("CHECKED_FOUND");
			expect(result.items).toHaveLength(2);
			expect(result.items[0].title).toBe("Test Paper Title");
			expect(result.items[0].authors).toEqual(["John Doe", "Jane Smith"]);
			expect(result.items[0].tags).toContain("cs.LG");
			expect(result.items[0].tags).toContain("cs.CL");
			expect(result.items[0].tags).toContain("preprint");
			expect(result.items[0].rawMetadata.pdfUrl).toBe(
				"https://arxiv.org/pdf/2511.01234v1.pdf",
			);
			expect(result.items[0].ring).toBe(2);
		});

		it("builds query from categories", async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				headers: new Headers({
					"content-type": "application/atom+xml",
				}),
				text: () =>
					Promise.resolve(
						'<?xml version="1.0"?><feed><entry><id>test</id><title>T</title><summary>S</summary><author><name>A</name></author><published>2025-11-10T00:00:00Z</published><category term="cs.LG"/></entry></feed>',
					),
			};
			global.fetch = vi.fn().mockResolvedValue(mockResponse);

			const config = {
				type: "arxiv",
				url: "https://arxiv.org/api/query",
				sourceId: "test",
				ringAffinity: [2],
				parseOptions: { categories: ["cs.LG", "cs.CL"] },
			} as unknown as SourceConfig;

			await adapter.retrieve(config);

			const callUrl = (global.fetch as any).mock.calls[0][0];
			// URL is encoded, so check for encoded versions
			expect(callUrl).toContain("cat%3Acs.LG"); // cat:cs.LG encoded
			expect(callUrl).toContain("cat%3Acs.CL");
		});

		it("builds query from authors", async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				headers: new Headers({
					"content-type": "application/atom+xml",
				}),
				text: () =>
					Promise.resolve(
						'<?xml version="1.0"?><feed><entry><id>test</id><title>T</title><summary>S</summary><author><name>A</name></author><published>2025-11-10T00:00:00Z</published></entry></feed>',
					),
			};
			global.fetch = vi.fn().mockResolvedValue(mockResponse);

			const config = {
				type: "arxiv",
				url: "https://arxiv.org/api/query",
				sourceId: "test",
				ringAffinity: [2],
				parseOptions: { authors: ["John Doe"] },
			} as unknown as SourceConfig;

			await adapter.retrieve(config);

			const callUrl = (global.fetch as any).mock.calls[0][0];
			// URL is encoded, so check for encoded versions
			expect(callUrl).toContain("au%3A%22John%20Doe%22"); // au:"John Doe" encoded
		});

		it("builds query from keywords", async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				headers: new Headers({
					"content-type": "application/atom+xml",
				}),
				text: () =>
					Promise.resolve(
						'<?xml version="1.0"?><feed><entry><id>test</id><title>T</title><summary>S</summary><author><name>A</name></author><published>2025-11-10T00:00:00Z</published></entry></feed>',
					),
			};
			global.fetch = vi.fn().mockResolvedValue(mockResponse);

			const config = {
				type: "arxiv",
				url: "https://arxiv.org/api/query",
				sourceId: "test",
				ringAffinity: [2],
				parseOptions: { keywords: ["transformer", "attention"] },
			} as unknown as SourceConfig;

			await adapter.retrieve(config);

			const callUrl = (global.fetch as any).mock.calls[0][0];
			// URL is encoded, so check for encoded versions
			expect(callUrl).toContain("all%3A%22transformer%22");
			expect(callUrl).toContain("all%3A%22attention%22");
		});

		it("uses default categories when none specified", async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				headers: new Headers({
					"content-type": "application/atom+xml",
				}),
				text: () =>
					Promise.resolve(
						'<?xml version="1.0"?><feed><entry><id>test</id><title>T</title><summary>S</summary><author><name>A</name></author><published>2025-11-10T00:00:00Z</published></entry></feed>',
					),
			};
			global.fetch = vi.fn().mockResolvedValue(mockResponse);

			const config = {
				type: "arxiv",
				url: "https://arxiv.org/api/query",
				sourceId: "test",
				ringAffinity: [2],
			} as unknown as SourceConfig;

			await adapter.retrieve(config);

			const callUrl = (global.fetch as any).mock.calls[0][0];
			// URL is encoded, so check for encoded versions
			expect(callUrl).toContain("cat%3Acs.LG");
			expect(callUrl).toContain("cat%3Acs.CL");
			expect(callUrl).toContain("cat%3Acs.DC");
			expect(callUrl).toContain("cat%3Acs.SE");
			expect(callUrl).toContain("cat%3Astat.ML");
		});

		it("respects checkpoint for incremental fetch", async () => {
			// arXiv API returns results sorted by submittedDate descending (newest first)
			const atomContent = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>https://arxiv.org/abs/2511.05678v1</id>
    <title>New Paper</title>
    <summary>Abstract</summary>
    <author><name>Author</name></author>
    <published>2025-11-10T06:00:00Z</published>
    <category term="cs.LG"/>
    <link href="https://arxiv.org/abs/2511.05678v1" rel="alternate"/>
  </entry>
  <entry>
    <id>https://arxiv.org/abs/2511.01234v1</id>
    <title>Old Paper</title>
    <summary>Abstract</summary>
    <author><name>Author</name></author>
    <published>2025-01-01T06:00:00Z</published>
    <category term="cs.LG"/>
    <link href="https://arxiv.org/abs/2511.01234v1" rel="alternate"/>
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

			const checkpoint: RetrievalCheckpoint = {
				sourceId: "test",
				lastProcessedAt: "2025-01-15T00:00:00Z",
				itemsProcessed: 0,
				checkpointAt: "2025-01-15T00:00:00Z",
			};

			const config = {
				type: "arxiv",
				url: "https://arxiv.org/api/query",
				sourceId: "test",
				ringAffinity: [2],
			} as unknown as SourceConfig;

			const result = await adapter.retrieve(config, checkpoint);

			expect(result.items).toHaveLength(1);
			expect(result.items[0].title).toBe("New Paper");
		});

		it("handles API errors gracefully", async () => {
			const mockResponse = {
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
				headers: new Headers({}),
			};
			global.fetch = vi.fn().mockResolvedValue(mockResponse);

			const config = {
				type: "arxiv",
				url: "https://arxiv.org/api/query",
				sourceId: "test",
			} as unknown as SourceConfig;
			const result = await adapter.retrieve(config);

			expect(result.status).toBe("ERROR");
			expect(result.errors[0].code).toBe("ARXIV_API_ERROR");
			expect(result.errors[0].retryable).toBe(true);
		});
	});
});
