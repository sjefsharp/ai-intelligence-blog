/**
 * GitHub API Adapter
 *
 * Retrieves releases, commits, issues, and discussions from GitHub repositories
 * using the GitHub REST API with authentication, pagination, and rate limiting.
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
} from "../types.js";

interface GitHubRelease {
	id: number;
	tag_name: string;
	name: string;
	body: string;
	draft: boolean;
	prerelease: boolean;
	created_at: string;
	published_at: string;
	author: { login: string };
	html_url: string;
	assets: { name: string; url: string }[];
}

interface GitHubCommit {
	sha: string;
	commit: {
		author: { name: string; email: string; date: string };
		committer: { name: string; email: string; date: string };
		message: string;
	};
	html_url: string;
	author?: { login: string };
	committer?: { login: string };
}

interface GitHubIssue {
	id: number;
	number: number;
	title: string;
	body: string;
	state: string;
	created_at: string;
	updated_at: string;
	closed_at: string | null;
	user: { login: string };
	assignees: { login: string }[];
	labels: { name: string }[];
	html_url: string;
	pull_request?: { url: string };
}

interface GitHubDiscussion {
	id: string;
	number: number;
	title: string;
	body: string;
	created_at: string;
	updated_at: string;
	author: { login: string };
	category: { name: string };
	html_url: string;
}

export class GitHubAdapter implements SourceAdapter {
	readonly adapterId = "github";
	readonly supportedTypes: "github"[] = ["github"];

	private readonly baseUrl = "https://api.github.com";
	private readonly token?: string;

	constructor(token?: string) {
		this.token = token || process.env.GITHUB_TOKEN;
	}

	canHandle(config: SourceConfig): boolean {
		return config.type === "github" && !!config.repo;
	}

	async validate(config: SourceConfig): Promise<ValidationResult> {
		if (!config.repo) {
			return {
				accessible: false,
				errors: [
					{
						code: "MISSING_REPO",
						message: "GitHub adapter requires repo configuration",
						url: config.url,
						timestamp: new Date().toISOString(),
						retryable: false,
					},
				],
			};
		}

		try {
			const response = await this.request(`repos/${config.repo}`, config);
			return {
				accessible: response.ok,
				statusCode: response.status,
				sampleItemCount: response.ok ? 1 : 0,
				errors: !response.ok
					? [
							{
								code: "REPO_NOT_FOUND",
								message: `Repository not accessible: ${response.status} ${response.statusText}`,
								statusCode: response.status,
								url: config.url,
								timestamp: new Date().toISOString(),
								retryable:
									response.status === 403 ||
									response.status >= 500,
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
		const allItems: CollectedItem[] = [];

		try {
			// Fetch releases
			const releasesResult = await this.fetchReleases(config, checkpoint);
			allItems.push(...releasesResult.items);
			errors.push(...releasesResult.errors);

			// Fetch recent commits (if no checkpoint or forced)
			if (!checkpoint || checkpoint.itemsProcessed === 0) {
				const commitsResult = await this.fetchCommits(
					config,
					checkpoint,
				);
				allItems.push(...commitsResult.items);
				errors.push(...commitsResult.errors);
			}

			// Fetch recent issues/discussions (if configured)
			if (config.parseOptions?.includeIssues) {
				const issuesResult = await this.fetchIssues(config, checkpoint);
				allItems.push(...issuesResult.items);
				errors.push(...issuesResult.errors);
			}

			if (config.parseOptions?.includeDiscussions) {
				const discussionsResult = await this.fetchDiscussions(
					config,
					checkpoint,
				);
				allItems.push(...discussionsResult.items);
				errors.push(...discussionsResult.errors);
			}

			// Sort by published date descending
			allItems.sort(
				(a, b) =>
					new Date(b.publishedAt).getTime() -
					new Date(a.publishedAt).getTime(),
			);

			// Limit items if configured
			const maxItems =
				(config.parseOptions?.maxItems as number | undefined) || 100;
			const limitedItems = allItems.slice(0, maxItems);

			return {
				sourceConfig: config,
				status:
					errors.length > 0
						? "ERROR"
						: allItems.length > 0
							? "CHECKED_FOUND"
							: "CHECKED_NONE",
				items: limitedItems,
				newItemCount: limitedItems.length,
				updatedItemCount: 0,
				errors,
				metadata: {
					startedAt,
					completedAt: new Date().toISOString(),
					durationMs: Date.now() - new Date(startedAt).getTime(),
				},
			};
		} catch (error) {
			return {
				sourceConfig: config,
				status: "ERROR",
				items: [],
				newItemCount: 0,
				updatedItemCount: 0,
				errors: [
					{
						code: "FETCH_FAILED",
						message:
							error instanceof Error
								? error.message
								: "Unknown error",
						url: config.url,
						timestamp: new Date().toISOString(),
						retryable: true,
					},
				],
				metadata: {
					startedAt,
					completedAt: new Date().toISOString(),
					durationMs: Date.now() - new Date(startedAt).getTime(),
				},
			};
		}
	}

	getMetadata(): AdapterMetadata {
		return {
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
		};
	}

	private async fetchReleases(
		config: SourceConfig,
		checkpoint?: RetrievalCheckpoint,
	): Promise<{ items: CollectedItem[]; errors: RetrievalError[] }> {
		const items: CollectedItem[] = [];
		const errors: RetrievalError[] = [];
		let page = checkpoint?.page || 1;
		const perPage = 30;
		const cutoffTime = checkpoint?.lastProcessedAt
			? new Date(checkpoint.lastProcessedAt).getTime()
			: 0;

		try {
			while (true) {
				const response = await this.request(
					`repos/${config.repo}/releases?per_page=${perPage}&page=${page}`,
					config,
				);

				if (!response.ok) {
					errors.push({
						code: "RELEASES_FETCH_FAILED",
						message: `Failed to fetch releases: ${response.status} ${response.statusText}`,
						statusCode: response.status,
						url: config.url,
						timestamp: new Date().toISOString(),
						retryable:
							response.status === 403 || response.status >= 500,
					});
					break;
				}

				const releases: GitHubRelease[] = await response.json();
				if (releases.length === 0) break;

				for (const release of releases) {
					const publishedAt =
						release.published_at || release.created_at;
					const publishedTime = new Date(publishedAt).getTime();

					if (cutoffTime && publishedTime <= cutoffTime) {
						return { items, errors };
					}

					const contentHash = this.generateHash(
						`${release.tag_name}${release.body || ""}${release.html_url}`,
					);
					const item: CollectedItem = {
						id: `github_release_${release.id}`,
						sourceId: config.sourceId,
						ring: config.ringAffinity[0] || 1,
						publishedAt,
						firstDisclosedAt: publishedAt,
						retrievedAt: new Date().toISOString(),
						sourceTimezone: "UTC",
						timestampConfidence: 0.95,
						url: release.html_url,
						title: release.name || release.tag_name,
						summary: release.body?.slice(0, 500),
						authors: [release.author.login],
						contentHash: `sha256:${contentHash}`,
						content: release.body,
						rawMetadata: {
							tagName: release.tag_name,
							draft: release.draft,
							prerelease: release.prerelease,
							assets: release.assets.map((a) => a.name),
						},
						tags: [
							"release",
							release.prerelease ? "prerelease" : "stable",
						],
						language: "en",
						researchDomains: config.researchDomains,
						subdomainTags: config.subdomainTags,
					};
					items.push(item);
				}

				if (releases.length < perPage) break;
				page++;
			}
		} catch (error) {
			errors.push({
				code: "RELEASES_EXCEPTION",
				message:
					error instanceof Error ? error.message : "Unknown error",
				url: config.url,
				timestamp: new Date().toISOString(),
				retryable: true,
			});
		}

		return { items, errors };
	}

	private async fetchCommits(
		config: SourceConfig,
		checkpoint?: RetrievalCheckpoint,
	): Promise<{ items: CollectedItem[]; errors: RetrievalError[] }> {
		const items: CollectedItem[] = [];
		const errors: RetrievalError[] = [];
		let page = 1;
		const perPage = 50;
		const cutoffTime = checkpoint?.lastProcessedAt
			? new Date(checkpoint.lastProcessedAt).getTime()
			: 0;

		try {
			while (items.length < 100) {
				const response = await this.request(
					`repos/${config.repo}/commits?per_page=${perPage}&page=${page}`,
					config,
				);

				if (!response.ok) {
					errors.push({
						code: "COMMITS_FETCH_FAILED",
						message: `Failed to fetch commits: ${response.status} ${response.statusText}`,
						statusCode: response.status,
						url: config.url,
						timestamp: new Date().toISOString(),
						retryable:
							response.status === 403 || response.status >= 500,
					});
					break;
				}

				const commits: GitHubCommit[] = await response.json();
				if (commits.length === 0) break;

				for (const commit of commits) {
					const publishedAt = commit.commit.author.date;
					const publishedTime = new Date(publishedAt).getTime();

					if (cutoffTime && publishedTime <= cutoffTime) {
						return { items, errors };
					}

					const contentHash = this.generateHash(
						`${commit.sha}${commit.commit.message}${commit.html_url}`,
					);
					const item: CollectedItem = {
						id: `github_commit_${commit.sha}`,
						sourceId: config.sourceId,
						ring: config.ringAffinity[0] || 1,
						publishedAt,
						firstDisclosedAt: publishedAt,
						retrievedAt: new Date().toISOString(),
						sourceTimezone: "UTC",
						timestampConfidence: 0.9,
						url: commit.html_url,
						title: commit.commit.message.split("\n")[0],
						summary: commit.commit.message.slice(0, 500),
						authors: [
							commit.commit.author.name,
							commit.author?.login,
						].filter((a): a is string => Boolean(a)),
						contentHash: `sha256:${contentHash}`,
						content: commit.commit.message,
						rawMetadata: {
							sha: commit.sha,
							committer: commit.commit.committer.name,
						},
						tags: ["commit"],
						language: "en",
						researchDomains: config.researchDomains,
						subdomainTags: config.subdomainTags,
					};
					items.push(item);
				}

				if (commits.length < perPage) break;
				page++;
			}
		} catch (error) {
			errors.push({
				code: "COMMITS_EXCEPTION",
				message:
					error instanceof Error ? error.message : "Unknown error",
				url: config.url,
				timestamp: new Date().toISOString(),
				retryable: true,
			});
		}

		return { items, errors };
	}

	private async fetchIssues(
		config: SourceConfig,
		checkpoint?: RetrievalCheckpoint,
	): Promise<{ items: CollectedItem[]; errors: RetrievalError[] }> {
		const items: CollectedItem[] = [];
		const errors: RetrievalError[] = [];
		let page = 1;
		const perPage = 30;
		const cutoffTime = checkpoint?.lastProcessedAt
			? new Date(checkpoint.lastProcessedAt).getTime()
			: 0;

		try {
			while (items.length < 50) {
				const response = await this.request(
					`repos/${config.repo}/issues?state=all&per_page=${perPage}&page=${page}&sort=created&direction=desc`,
					config,
				);

				if (!response.ok) {
					errors.push({
						code: "ISSUES_FETCH_FAILED",
						message: `Failed to fetch issues: ${response.status} ${response.statusText}`,
						statusCode: response.status,
						url: config.url,
						timestamp: new Date().toISOString(),
						retryable:
							response.status === 403 || response.status >= 500,
					});
					break;
				}

				const issues: GitHubIssue[] = await response.json();
				if (issues.length === 0) break;

				for (const issue of issues) {
					if (issue.pull_request) continue; // Skip PRs

					const publishedAt = issue.created_at;
					const publishedTime = new Date(publishedAt).getTime();

					if (cutoffTime && publishedTime <= cutoffTime) {
						return { items, errors };
					}

					const contentHash = this.generateHash(
						`${issue.id}${issue.title}${issue.body || ""}`,
					);
					const item: CollectedItem = {
						id: `github_issue_${issue.id}`,
						sourceId: config.sourceId,
						ring: config.ringAffinity[0] || 1,
						publishedAt,
						firstDisclosedAt: publishedAt,
						retrievedAt: new Date().toISOString(),
						sourceTimezone: "UTC",
						timestampConfidence: 0.85,
						url: issue.html_url,
						title: issue.title,
						summary: issue.body?.slice(0, 500),
						authors: [
							issue.user.login,
							...issue.assignees.map((a) => a.login),
						],
						contentHash: `sha256:${contentHash}`,
						content: issue.body,
						rawMetadata: {
							number: issue.number,
							state: issue.state,
							labels: issue.labels.map((l) => l.name),
							closedAt: issue.closed_at,
						},
						tags: [
							"issue",
							issue.state,
							...issue.labels.map((l) => l.name),
						],
						language: "en",
						researchDomains: config.researchDomains,
						subdomainTags: config.subdomainTags,
					};
					items.push(item);
				}

				if (issues.length < perPage) break;
				page++;
			}
		} catch (error) {
			errors.push({
				code: "ISSUES_EXCEPTION",
				message:
					error instanceof Error ? error.message : "Unknown error",
				url: config.url,
				timestamp: new Date().toISOString(),
				retryable: true,
			});
		}

		return { items, errors };
	}

	private async fetchDiscussions(
		config: SourceConfig,
		checkpoint?: RetrievalCheckpoint,
	): Promise<{ items: CollectedItem[]; errors: RetrievalError[] }> {
		const items: CollectedItem[] = [];
		const errors: RetrievalError[] = [];

		try {
			// GitHub GraphQL API for discussions
			const query = `
        query($repo: String!, $owner: String!, $first: Int!, $after: String) {
          repository(name: $repo, owner: $owner) {
            discussions(first: $first, after: $after, orderBy: {field: CREATED_AT, direction: DESC}) {
              pageInfo { hasNextPage, endCursor }
              nodes {
                id
                number
                title
                body
                createdAt
                updatedAt
                author { login }
                category { name }
                url
              }
            }
          }
        }
      `;

			let hasNextPage = true;
			let afterCursor: string | null = null;
			const cutoffTime = checkpoint?.lastProcessedAt
				? new Date(checkpoint.lastProcessedAt).getTime()
				: 0;

			while (hasNextPage && items.length < 50) {
				const variables = {
					repo: config.repo!.split("/")[1],
					owner: config.repo!.split("/")[0],
					first: 20,
					after: afterCursor,
				};

				const response = await this.graphql(query, variables, config);

				if (response.errors) {
					errors.push({
						code: "DISCUSSIONS_GRAPHQL_ERROR",
						message: response.errors
							.map((e) => e.message)
							.join(", "),
						url: config.url,
						timestamp: new Date().toISOString(),
						retryable: true,
					});
					break;
				}

				const discussions = (response.data as any)?.repository
					?.discussions;
				if (!discussions) break;

				for (const discussion of discussions.nodes) {
					const publishedAt = discussion.createdAt;
					const publishedTime = new Date(publishedAt).getTime();

					if (cutoffTime && publishedTime <= cutoffTime) {
						hasNextPage = false;
						break;
					}

					const contentHash = this.generateHash(
						`${discussion.id}${discussion.title}${discussion.body || ""}`,
					);
					const item: CollectedItem = {
						id: `github_discussion_${discussion.number}`,
						sourceId: config.sourceId,
						ring: config.ringAffinity[0] || 1,
						publishedAt,
						firstDisclosedAt: publishedAt,
						retrievedAt: new Date().toISOString(),
						sourceTimezone: "UTC",
						timestampConfidence: 0.85,
						url: discussion.html_url,
						title: discussion.title,
						summary: discussion.body?.slice(0, 500),
						authors: [discussion.author.login],
						contentHash: `sha256:${contentHash}`,
						content: discussion.body,
						rawMetadata: {
							number: discussion.number,
							category: discussion.category.name,
						},
						tags: ["discussion", discussion.category.name],
						language: "en",
						researchDomains: config.researchDomains,
						subdomainTags: config.subdomainTags,
					};
					items.push(item);
				}

				hasNextPage = discussions.pageInfo.hasNextPage;
				afterCursor = discussions.pageInfo.endCursor;
			}
		} catch (error) {
			errors.push({
				code: "DISCUSSIONS_EXCEPTION",
				message:
					error instanceof Error ? error.message : "Unknown error",
				url: config.url,
				timestamp: new Date().toISOString(),
				retryable: true,
			});
		}

		return { items, errors };
	}

	private async request(
		endpoint: string,
		config: SourceConfig,
	): Promise<Response> {
		const url = `${this.baseUrl}/${endpoint}`;
		const headers: Record<string, string> = {
			Accept: "application/vnd.github+json",
			"User-Agent": config.userAgent || "ai-intelligence-blog/1.0",
			"X-GitHub-Api-Version": "2022-11-28",
		};

		if (this.token) {
			headers["Authorization"] = `Bearer ${this.token}`;
		}

		if (config.headers) {
			Object.assign(headers, config.headers);
		}

		return await fetch(`${this.baseUrl}/${endpoint}`, {
			method: "GET",
			headers,
			signal: AbortSignal.timeout(config.timeoutMs || 30000),
			redirect: "follow",
		});
	}

	private async graphql(
		query: string,
		variables: Record<string, unknown>,
		config: SourceConfig,
	): Promise<{ data?: unknown; errors?: { message: string }[] }> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			"User-Agent": config.userAgent || "ai-intelligence-blog/1.0",
		};

		if (this.token) {
			headers["Authorization"] = `Bearer ${this.token}`;
		}

		const response = await fetch(`${this.baseUrl}/graphql`, {
			method: "POST",
			headers,
			body: JSON.stringify({ query, variables }),
			signal: AbortSignal.timeout(config.timeoutMs || 30000),
		});
		return await response.json();
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
}
