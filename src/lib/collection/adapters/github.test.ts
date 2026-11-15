/**
 * GitHub Adapter Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitHubAdapter } from "./github.js";
import type { SourceConfig, RetrievalCheckpoint } from "../types.js";

describe("GitHubAdapter", () => {
	let adapter: GitHubAdapter;

	beforeEach(() => {
		adapter = new GitHubAdapter("test-token");
		vi.clearAllMocks();
	});

	describe("canHandle", () => {
		it("returns true for github type with repo", () => {
			const config = {
				type: "github",
				url: "https://github.com/owner/repo",
				repo: "owner/repo",
			} as unknown as SourceConfig;
			expect(adapter.canHandle(config)).toBe(true);
		});

		it("returns false for github type without repo", () => {
			const config = {
				type: "github",
				url: "https://github.com/owner/repo",
			} as unknown as SourceConfig;
			expect(adapter.canHandle(config)).toBe(false);
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
			expect(metadata.adapterId).toBe("github");
			expect(metadata.name).toBe("GitHub API Adapter");
			expect(metadata.supportedTypes).toEqual(["github"]);
			expect(metadata.capabilities).toContain("authentication");
			expect(metadata.capabilities).toContain("rate-limit-headers");
			expect(metadata.capabilities).toContain("full-history");
		});
	});

	describe("validate", () => {
		it("validates accessible repository", async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				headers: new Headers({}),
				json: () => Promise.resolve({ full_name: "owner/repo" }),
			};
			global.fetch = vi.fn().mockResolvedValue(mockResponse);

			const config = {
				type: "github",
				url: "https://github.com/owner/repo",
				repo: "owner/repo",
				sourceId: "test",
			} as unknown as SourceConfig;
			const result = await adapter.validate(config);

			expect(result.accessible).toBe(true);
			expect(result.statusCode).toBe(200);
		});

		it("rejects inaccessible repository", async () => {
			const mockResponse = {
				ok: false,
				status: 404,
				statusText: "Not Found",
				headers: new Headers({}),
			};
			global.fetch = vi.fn().mockResolvedValue(mockResponse);

			const config = {
				type: "github",
				url: "https://github.com/owner/repo",
				repo: "owner/repo",
				sourceId: "test",
			} as unknown as SourceConfig;
			const result = await adapter.validate(config);

			expect(result.accessible).toBe(false);
			expect(result.errors).toBeDefined();
			expect(result.errors![0].code).toBe("REPO_NOT_FOUND");
		});
	});

	describe("retrieve", () => {
		it("fetches releases", async () => {
			const releasesResponse = {
				ok: true,
				status: 200,
				headers: new Headers({ "x-ratelimit-remaining": "4999" }),
				json: () =>
					Promise.resolve([
						{
							id: 123,
							tag_name: "v1.0.0",
							name: "Release 1.0.0",
							body: "Release notes",
							draft: false,
							prerelease: false,
							created_at: "2025-11-10T06:00:00Z",
							published_at: "2025-11-10T06:00:00Z",
							author: { login: "maintainer" },
							html_url:
								"https://github.com/owner/repo/releases/tag/v1.0.0",
							assets: [
								{
									name: "asset.zip",
									url: "https://github.com/asset.zip",
								},
							],
						},
					]),
			};

			const commitsResponse = {
				ok: true,
				status: 200,
				headers: new Headers({ "x-ratelimit-remaining": "4998" }),
				json: () => Promise.resolve([]),
			};

			global.fetch = vi
				.fn()
				.mockResolvedValueOnce(releasesResponse)
				.mockResolvedValueOnce(commitsResponse);

			const config = {
				type: "github",
				url: "https://github.com/owner/repo",
				repo: "owner/repo",
				sourceId: "test",
				ringAffinity: [1],
			} as unknown as SourceConfig;

			const result = await adapter.retrieve(config);

			expect(result.status).toBe("CHECKED_FOUND");
			expect(result.items).toHaveLength(1);
			expect(result.items[0].title).toBe("Release 1.0.0");
			expect(result.items[0].authors).toContain("maintainer");
			expect(result.items[0].tags).toContain("release");
			expect(result.items[0].tags).toContain("stable");
		});

		it("fetches commits", async () => {
			const releasesResponse = {
				ok: true,
				status: 200,
				headers: new Headers({}),
				json: () => Promise.resolve([]),
			};

			const commitsResponse = {
				ok: true,
				status: 200,
				headers: new Headers({}),
				json: () =>
					Promise.resolve([
						{
							sha: "abc123",
							commit: {
								author: {
									name: "Author",
									email: "author@example.com",
									date: "2025-11-10T06:00:00Z",
								},
								committer: {
									name: "Committer",
									email: "committer@example.com",
									date: "2025-11-10T07:00:00Z",
								},
								message: "Fix bug\n\nDetailed description",
							},
							html_url:
								"https://github.com/owner/repo/commit/abc123",
							author: { login: "author" },
						},
					]),
			};

			global.fetch = vi
				.fn()
				.mockResolvedValueOnce(releasesResponse)
				.mockResolvedValueOnce(commitsResponse);

			const config = {
				type: "github",
				url: "https://github.com/owner/repo",
				repo: "owner/repo",
				sourceId: "test",
				ringAffinity: [1],
			} as unknown as SourceConfig;

			const result = await adapter.retrieve(config);

			expect(result.status).toBe("CHECKED_FOUND");
			expect(result.items).toHaveLength(1);
			expect(result.items[0].title).toBe("Fix bug");
			expect(result.items[0].tags).toContain("commit");
		});

		it("fetches issues when configured", async () => {
			const releasesResponse = {
				ok: true,
				status: 200,
				headers: new Headers({}),
				json: () => Promise.resolve([]),
			};

			const commitsResponse = {
				ok: true,
				status: 200,
				headers: new Headers({}),
				json: () => Promise.resolve([]),
			};

			const issuesResponse = {
				ok: true,
				status: 200,
				headers: new Headers({}),
				json: () =>
					Promise.resolve([
						{
							id: 456,
							number: 42,
							title: "Issue Title",
							body: "Issue description",
							state: "open",
							created_at: "2025-11-10T06:00:00Z",
							updated_at: "2025-11-10T07:00:00Z",
							closed_at: null,
							user: { login: "reporter" },
							assignees: [{ login: "assignee" }],
							labels: [
								{ name: "bug" },
								{ name: "priority:high" },
							],
							html_url: "https://github.com/owner/repo/issues/42",
						},
					]),
			};

			const discussionsResponse = {
				ok: true,
				status: 200,
				json: () =>
					Promise.resolve({
						data: {
							repository: {
								discussions: {
									nodes: [],
									pageInfo: { hasNextPage: false },
								},
							},
						},
					}),
			};

			global.fetch = vi
				.fn()
				.mockResolvedValueOnce(releasesResponse)
				.mockResolvedValueOnce(commitsResponse)
				.mockResolvedValueOnce(issuesResponse)
				.mockResolvedValueOnce(discussionsResponse);

			const config = {
				type: "github",
				url: "https://github.com/owner/repo",
				repo: "owner/repo",
				sourceId: "test",
				ringAffinity: [1],
				parseOptions: { includeIssues: true, includeDiscussions: true },
			} as unknown as SourceConfig;

			const result = await adapter.retrieve(config);

			expect(
				result.items.some((i: any) => i.title === "Issue Title"),
			).toBe(true);
			const issueItem = result.items.find(
				(i: any) => i.title === "Issue Title",
			);
			expect(issueItem?.tags).toContain("issue");
			expect(issueItem?.tags).toContain("open");
			expect(issueItem?.tags).toContain("bug");
			expect(issueItem?.tags).toContain("priority:high");
		});

		it("respects checkpoint for incremental fetch", async () => {
			// GitHub API returns releases sorted by created_at descending (newest first)
			const releasesResponse = {
				ok: true,
				status: 200,
				headers: new Headers({}),
				json: () =>
					Promise.resolve([
						{
							id: 2,
							tag_name: "v1.0.0",
							name: "New Release",
							body: "",
							draft: false,
							prerelease: false,
							created_at: "2025-11-10T06:00:00Z",
							published_at: "2025-11-10T06:00:00Z",
							author: { login: "maintainer" },
							html_url:
								"https://github.com/owner/repo/releases/tag/v1.0.0",
							assets: [],
						},
						{
							id: 1,
							tag_name: "v0.9.0",
							name: "Old Release",
							body: "",
							draft: false,
							prerelease: false,
							created_at: "2025-01-01T06:00:00Z",
							published_at: "2025-01-01T06:00:00Z",
							author: { login: "maintainer" },
							html_url:
								"https://github.com/owner/repo/releases/tag/v0.9.0",
							assets: [],
						},
					]),
			};

			const commitsResponse = {
				ok: true,
				status: 200,
				headers: new Headers({}),
				json: () => Promise.resolve([]),
			};

			global.fetch = vi
				.fn()
				.mockResolvedValueOnce(releasesResponse)
				.mockResolvedValueOnce(commitsResponse);

			const checkpoint: RetrievalCheckpoint = {
				sourceId: "test",
				lastProcessedAt: "2025-01-15T00:00:00Z",
				itemsProcessed: 0,
				checkpointAt: "2025-01-15T00:00:00Z",
			};

			const config = {
				type: "github",
				url: "https://github.com/owner/repo",
				repo: "owner/repo",
				sourceId: "test",
				ringAffinity: [1],
			} as unknown as SourceConfig;

			const result = await adapter.retrieve(config, checkpoint);

			expect(result.items).toHaveLength(1);
			expect(result.items[0].title).toBe("New Release");
		});

		it("handles rate limiting with retryable error", async () => {
			const mockResponse = {
				ok: false,
				status: 403,
				statusText: "Forbidden",
				headers: new Headers({
					"x-ratelimit-remaining": "0",
					"x-ratelimit-reset": "1234567890",
				}),
			};
			global.fetch = vi.fn().mockResolvedValue(mockResponse);

			const config = {
				type: "github",
				url: "https://github.com/owner/repo",
				repo: "owner/repo",
				sourceId: "test",
			} as unknown as SourceConfig;
			const result = await adapter.retrieve(config);

			expect(result.status).toBe("ERROR");
			expect(result.errors[0].retryable).toBe(true);
		});
	});
});
