/**
 * Collection Adapters — Index
 *
 * Central export point for all source adapters and their metadata.
 */

export { RssAdapter } from "./rss.js";
export { GitHubAdapter } from "./github.js";

import type { AdapterMetadata } from "../types.js";

export const ADAPTER_METADATA: Record<string, AdapterMetadata> = {
	rss: {
		adapterId: "rss",
		name: "RSS/Atom Feed Adapter",
		version: "1.0.0",
		description: "Retrieves and parses RSS 2.0 and Atom 1.0 feeds",
		supportedTypes: ["rss", "atom"] as const,
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
		] as const,
	},
	github: {
		adapterId: "github",
		name: "GitHub API Adapter",
		version: "1.0.0",
		description:
			"Retrieves releases, commits, issues, and discussions from GitHub",
		supportedTypes: ["github"] as const,
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
		] as const,
	},
} as const;

export type AdapterId = keyof typeof ADAPTER_METADATA;
