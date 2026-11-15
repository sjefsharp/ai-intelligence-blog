/**
 * Collection Types Tests
 */

import { describe, it, expect } from "vitest";
import {
	normalizeUrl,
	generateContentHash,
	extractTimestamp,
	isDuplicate,
	createSourceConfig,
	DEFAULT_RETRY_CONFIG,
	ADAPTER_METADATA,
} from "../collection/types.js";

describe("Collection Types", () => {
	describe("normalizeUrl", () => {
		it("removes fragments", () => {
			expect(normalizeUrl("https://example.com/page#section")).toBe(
				"https://example.com/page",
			);
		});

		it("normalizes trailing slashes", () => {
			expect(normalizeUrl("https://example.com/page/")).toBe(
				"https://example.com/page",
			);
		});

		it("sorts query parameters", () => {
			expect(normalizeUrl("https://example.com/page?b=2&a=1")).toBe(
				"https://example.com/page?a=1&b=2",
			);
		});

		it("handles invalid URLs gracefully", () => {
			expect(normalizeUrl("not-a-url")).toBe("not-a-url");
		});
	});

	describe("generateContentHash", () => {
		it("generates consistent hashes for same content", () => {
			const hash1 = generateContentHash("test content");
			const hash2 = generateContentHash("test content");
			expect(hash1).toBe(hash2);
		});

		it("generates different hashes for different content", () => {
			const hash1 = generateContentHash("content 1");
			const hash2 = generateContentHash("content 2");
			expect(hash1).not.toBe(hash2);
		});

		it("produces sha256 prefix", () => {
			const hash = generateContentHash("test");
			expect(hash.startsWith("sha256:")).toBe(true);
		});
	});

	describe("extractTimestamp", () => {
		it("parses ISO 8601 with Z", () => {
			const result = extractTimestamp("2025-11-10T06:00:00Z");
			expect(result).not.toBeNull();
			expect(result!.timestamp).toBe("2025-11-10T06:00:00Z");
			expect(result!.confidence).toBe(0.95);
		});

		it("parses ISO 8601 with timezone offset", () => {
			const result = extractTimestamp("2025-11-10T06:00:00+01:00");
			expect(result).not.toBeNull();
			expect(result!.timestamp).toBe("2025-11-10T06:00:00+01:00");
		});

		it("parses RFC 2822 format", () => {
			const result = extractTimestamp("Mon, 10 Nov 2025 06:00:00 +0000");
			expect(result).not.toBeNull();
			expect(result!.confidence).toBe(0.85);
		});

		it("parses simple date", () => {
			const result = extractTimestamp("2025-11-10");
			expect(result).not.toBeNull();
			expect(result!.confidence).toBe(0.7);
		});

		it("returns null for invalid input", () => {
			expect(extractTimestamp("")).toBeNull();
			expect(extractTimestamp(null)).toBeNull();
			expect(extractTimestamp("invalid")).toBeNull();
		});
	});

	describe("isDuplicate", () => {
		it("detects duplicate by content hash", () => {
			const item1 = {
				contentHash: "sha256:abc123",
				url: "https://a.com",
			} as any;
			const item2 = {
				contentHash: "sha256:abc123",
				url: "https://b.com",
			} as any;
			expect(isDuplicate(item1, item2)).toBe(true);
		});

		it("detects duplicate by normalized URL", () => {
			const item1 = {
				contentHash: "sha256:abc123",
				url: "https://example.com/page",
			} as any;
			const item2 = {
				contentHash: "sha256:def456",
				url: "https://example.com/page/",
			} as any;
			expect(isDuplicate(item1, item2)).toBe(true);
		});

		it("returns false for different items", () => {
			const item1 = {
				contentHash: "sha256:abc123",
				url: "https://a.com",
			} as any;
			const item2 = {
				contentHash: "sha256:def456",
				url: "https://b.com",
			} as any;
			expect(isDuplicate(item1, item2)).toBe(false);
		});
	});

	describe("createSourceConfig", () => {
		it("creates config with defaults", () => {
			const config = createSourceConfig({
				id: "test-source",
				type: "rss",
				url: "https://example.com/feed.xml",
				tags: ["test"],
			});

			expect(config.sourceId).toBe("test-source");
			expect(config.type).toBe("rss");
			expect(config.ringAffinity).toEqual([1]);
			expect(config.rateLimit).toBe(60);
			expect(config.timeoutMs).toBe(30000);
		});

		it("includes repo for github type", () => {
			const config = createSourceConfig({
				id: "test-github",
				type: "github",
				url: "https://github.com/owner/repo",
				repo: "owner/repo",
				tags: ["test"],
			});

			expect(config.repo).toBe("owner/repo");
		});
	});

	describe("DEFAULT_RETRY_CONFIG", () => {
		it("has reasonable defaults", () => {
			expect(DEFAULT_RETRY_CONFIG.maxAttempts).toBe(3);
			expect(DEFAULT_RETRY_CONFIG.baseDelayMs).toBe(1000);
			expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(30000);
			expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBe(2);
			expect(DEFAULT_RETRY_CONFIG.jitter).toBe(true);
			expect(DEFAULT_RETRY_CONFIG.retryableStatusCodes).toContain(429);
			expect(DEFAULT_RETRY_CONFIG.retryableStatusCodes).toContain(503);
		});
	});

	describe("ADAPTER_METADATA", () => {
		it("has metadata for rss adapter", () => {
			expect(ADAPTER_METADATA.rss.adapterId).toBe("rss");
			expect(ADAPTER_METADATA.rss.capabilities).toContain("pagination");
			expect(ADAPTER_METADATA.rss.capabilities).toContain(
				"conditional-requests",
			);
		});

		it("has metadata for github adapter", () => {
			expect(ADAPTER_METADATA.github.adapterId).toBe("github");
			expect(ADAPTER_METADATA.github.capabilities).toContain(
				"authentication",
			);
		});

		it("has metadata for arxiv adapter", () => {
			expect(ADAPTER_METADATA.arxiv.adapterId).toBe("arxiv");
		});
	});
});
