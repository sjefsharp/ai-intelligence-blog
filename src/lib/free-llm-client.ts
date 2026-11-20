/**
 * Free LLM Client Wrapper — NVIDIA Nemotron via OpenRouter (primary only)
 *
 * Features:
 * - Configurable request budgets (tokens, requests, cost)
 * - Bounded retries with exponential backoff + jitter
 * - Response caching (in-memory + persistent)
 * - Checkpoint persistence for resumable operations
 * - Deterministic operations (seed, temperature=0 for structured tasks)
 * - Free-only policy enforcement (never uses paid models)
 * - Graceful degradation: stops cleanly when provider exhausted
 * - Zero-cost validation mode (dry-run without API calls)
 *
 * Provider:
 * 1. OpenRouter — nvidia/nemotron-3-ultra-550b-a55b:free (only provider)
 */

import {
	readFileSync,
	writeFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	unlinkSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Types
// ============================================================================

export interface ProviderConfig {
	name: string;
	baseUrl: string;
	model: string;
	apiKeyEnv?: string;
	headers?: Record<string, string>;
	rateLimit?: {
		requestsPerMinute: number;
		tokensPerMinute: number;
	};
	timeoutMs: number;
}

export interface RequestBudget {
	maxRequests: number;
	maxTokens: number;
	maxCostUsd: number; // Always 0 for free-only
}

export interface RetryConfig {
	maxAttempts: number;
	baseDelayMs: number;
	maxDelayMs: number;
	jitterFactor: number;
	retryableStatuses: number[];
}

export interface CacheEntry {
	response: string;
	tokensUsed: number;
	timestamp: number;
	requestHash: string;
}

export interface Checkpoint {
	id: string;
	operation: string;
	step: number;
	totalSteps: number;
	context: Record<string, unknown>;
	timestamp: number;
}

export interface LLMResponse {
	content: string;
	provider: string;
	model: string;
	tokensUsed: {
		prompt: number;
		completion: number;
		total: number;
	};
	cached: boolean;
	requestId: string;
}

export interface LLMClientConfig {
	providers: ProviderConfig[];
	budget: RequestBudget;
	retry: RetryConfig;
	cacheDir: string;
	checkpointDir: string;
	enableCache: boolean;
	enableCheckpoints: boolean;
	deterministic: boolean;
	validateOnly: boolean; // Dry-run mode
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
	{
		name: "openrouter-primary",
		baseUrl: "https://openrouter.ai/api/v1",
		model: "nvidia/nemotron-3-ultra-550b-a55b:free",
		apiKeyEnv: "OPENROUTER_API_KEY",
		headers: {
			"HTTP-Referer": "https://ai-intelligence-blog.example.com",
			"X-Title": "ai-intelligence-blog",
		},
		rateLimit: { requestsPerMinute: 20, tokensPerMinute: 50000 },
		timeoutMs: 60000,
	},
];

export const DEFAULT_BUDGET: RequestBudget = {
	maxRequests: 1000,
	maxTokens: 500000,
	maxCostUsd: 0, // Free-only policy
};

export const DEFAULT_RETRY: RetryConfig = {
	maxAttempts: 3,
	baseDelayMs: 1000,
	maxDelayMs: 30000,
	jitterFactor: 0.25,
	retryableStatuses: [408, 429, 500, 502, 503, 504],
};

export const DEFAULT_CLIENT_CONFIG: LLMClientConfig = {
	providers: DEFAULT_PROVIDERS,
	budget: DEFAULT_BUDGET,
	retry: DEFAULT_RETRY,
	cacheDir: join(__dirname, "..", "..", "..", "data", "llm-cache"),
	checkpointDir: join(__dirname, "..", "..", "..", "data", "checkpoints"),
	enableCache: true,
	enableCheckpoints: true,
	deterministic: true,
	validateOnly: false,
};

// ============================================================================
// Utility Functions
// ============================================================================

function hashString(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return hash.toString(36);
}

function generateRequestId(): string {
	return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateBackoff(attempt: number, config: RetryConfig): number {
	const delay = Math.min(
		config.baseDelayMs * Math.pow(2, attempt),
		config.maxDelayMs,
	);
	const jitter = delay * config.jitterFactor * Math.random();
	return Math.floor(delay + jitter);
}

function isRetryableError(
	error: unknown,
	retryableStatuses: number[],
): boolean {
	if (error instanceof Response) {
		return retryableStatuses.includes(error.status);
	}
	if (error instanceof Error) {
		// Network errors, timeouts
		return (
			error.name === "TypeError" ||
			error.message.includes("timeout") ||
			error.message.includes("ECONNREFUSED")
		);
	}
	return false;
}

// ============================================================================
// Cache Manager
// ============================================================================

export class CacheManager {
	private cache: Map<string, CacheEntry> = new Map();
	private cacheDir: string;
	private hits = 0;
	private misses = 0;

	constructor(cacheDir: string) {
		this.cacheDir = cacheDir;
		this.load();
	}

	private load(): void {
		if (!existsSync(this.cacheDir)) {
			mkdirSync(this.cacheDir, { recursive: true });
			return;
		}
		const files = readdirSync(this.cacheDir).filter((f) =>
			f.endsWith(".json"),
		);
		for (const file of files) {
			try {
				const content = readFileSync(
					join(this.cacheDir, file),
					"utf-8",
				);
				const entry = JSON.parse(content) as CacheEntry;
				this.cache.set(entry.requestHash, entry);
			} catch {
				// Skip corrupted entries
			}
		}
	}

	private persist(): void {
		if (!existsSync(this.cacheDir)) {
			mkdirSync(this.cacheDir, { recursive: true });
		}
		for (const [hash, entry] of this.cache) {
			const filePath = join(this.cacheDir, `${hash}.json`);
			writeFileSync(filePath, JSON.stringify(entry));
		}
	}

	get(requestHash: string): CacheEntry | undefined {
		const entry = this.cache.get(requestHash);
		if (entry) {
			this.hits++;
			return entry;
		}
		this.misses++;
		return undefined;
	}

	set(requestHash: string, entry: CacheEntry): void {
		this.cache.set(requestHash, entry);
		this.persist();
	}

	getStats(): {
		hits: number;
		misses: number;
		size: number;
		hitRate: number;
	} {
		const total = this.hits + this.misses;
		return {
			hits: this.hits,
			misses: this.misses,
			size: this.cache.size,
			hitRate: total > 0 ? this.hits / total : 0,
		};
	}

	clear(): void {
		this.cache.clear();
		this.hits = 0;
		this.misses = 0;
		this.persist();
	}
}

// ============================================================================
// Checkpoint Manager
// ============================================================================

export class CheckpointManager {
	private checkpointDir: string;
	private checkpoints: Map<string, Checkpoint> = new Map();

	constructor(checkpointDir: string) {
		this.checkpointDir = checkpointDir;
		this.load();
	}

	private load(): void {
		if (!existsSync(this.checkpointDir)) {
			mkdirSync(this.checkpointDir, { recursive: true });
			return;
		}
		const files = readdirSync(this.checkpointDir).filter((f) =>
			f.endsWith(".json"),
		);
		for (const file of files) {
			try {
				const content = readFileSync(
					join(this.checkpointDir, file),
					"utf-8",
				);
				const checkpoint = JSON.parse(content) as Checkpoint;
				this.checkpoints.set(checkpoint.id, checkpoint);
			} catch {
				// Skip corrupted
			}
		}
	}

	private persist(id: string): void {
		const checkpoint = this.checkpoints.get(id);
		if (checkpoint) {
			const filePath = join(this.checkpointDir, `${id}.json`);
			writeFileSync(filePath, JSON.stringify(checkpoint));
		}
	}

	create(
		id: string,
		operation: string,
		totalSteps: number,
		context: Record<string, unknown> = {},
	): Checkpoint {
		const checkpoint: Checkpoint = {
			id,
			operation,
			step: 0,
			totalSteps,
			context,
			timestamp: Date.now(),
		};
		this.checkpoints.set(id, checkpoint);
		this.persist(id);
		return checkpoint;
	}

	update(
		id: string,
		step: number,
		contextUpdate: Record<string, unknown> = {},
	): Checkpoint | undefined {
		const checkpoint = this.checkpoints.get(id);
		if (!checkpoint) return undefined;
		checkpoint.step = step;
		checkpoint.context = { ...checkpoint.context, ...contextUpdate };
		checkpoint.timestamp = Date.now();
		this.persist(id);
		return checkpoint;
	}

	complete(
		id: string,
		finalContext: Record<string, unknown> = {},
	): Checkpoint | undefined {
		const checkpoint = this.checkpoints.get(id);
		if (!checkpoint) return undefined;
		checkpoint.step = checkpoint.totalSteps;
		checkpoint.context = { ...checkpoint.context, ...finalContext };
		checkpoint.timestamp = Date.now();
		this.persist(id);
		return checkpoint;
	}

	get(id: string): Checkpoint | undefined {
		return this.checkpoints.get(id);
	}

	delete(id: string): boolean {
		const deleted = this.checkpoints.delete(id);
		if (deleted) {
			const filePath = join(this.checkpointDir, `${id}.json`);
			if (existsSync(filePath)) {
				try {
					unlinkSync(filePath);
				} catch {}
			}
		}
		return deleted;
	}

	list(): Checkpoint[] {
		return Array.from(this.checkpoints.values());
	}
}

// ============================================================================
// Budget Tracker
// ============================================================================

export class BudgetTracker {
	private used: { requests: number; tokens: number } = {
		requests: 0,
		tokens: 0,
	};
	private budget: RequestBudget;

	constructor(budget: RequestBudget) {
		this.budget = budget;
	}

	check(requestTokens: number = 0): { allowed: boolean; reason?: string } {
		if (this.used.requests >= this.budget.maxRequests) {
			return {
				allowed: false,
				reason: `Request budget exhausted (${this.budget.maxRequests})`,
			};
		}
		if (this.used.tokens + requestTokens > this.budget.maxTokens) {
			return {
				allowed: false,
				reason: `Token budget would be exceeded (${this.used.tokens}/${this.budget.maxTokens})`,
			};
		}
		if (this.budget.maxCostUsd > 0) {
			return {
				allowed: false,
				reason: "Cost budget exceeded (free-only policy)",
			};
		}
		return { allowed: true };
	}

	consume(tokens: number): void {
		this.used.requests++;
		this.used.tokens += tokens;
	}

	getUsage(): { requests: number; tokens: number; budget: RequestBudget } {
		return { ...this.used, budget: this.budget };
	}

	reset(): void {
		this.used = { requests: 0, tokens: 0 };
	}
}

// ============================================================================
// Free LLM Client
// ============================================================================

export class FreeLLMClient {
	private config: LLMClientConfig;
	private cache: CacheManager;
	private checkpoints: CheckpointManager;
	private budget: BudgetTracker;
	private currentProviderIndex = 0;
	private requestCount = 0;

	constructor(config: Partial<LLMClientConfig> = {}) {
		this.config = { ...DEFAULT_CLIENT_CONFIG, ...config };
		this.cache = new CacheManager(this.config.cacheDir);
		this.checkpoints = new CheckpointManager(this.config.checkpointDir);
		this.budget = new BudgetTracker(this.config.budget);
	}

	/**
	 * Get the current client configuration (read-only access)
	 */
	getConfig(): Readonly<LLMClientConfig> {
		return this.config;
	}

	/**
	 * Validate configuration without making API calls
	 */
	async validate(): Promise<{
		valid: boolean;
		errors: string[];
		warnings: string[];
	}> {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Check API keys
		for (const provider of this.config.providers) {
			if (provider.apiKeyEnv && !process.env[provider.apiKeyEnv]) {
				warnings.push(
					`Missing env var ${provider.apiKeyEnv} for provider ${provider.name}`,
				);
			}
		}

		// Check at least one provider has credentials (skip in validateOnly mode)
		if (!this.config.validateOnly) {
			const hasCredentials = this.config.providers.some(
				(p) => !p.apiKeyEnv || process.env[p.apiKeyEnv],
			);
			if (!hasCredentials) {
				errors.push("No provider has valid credentials configured");
			}
		}

		// Verify budget is free-only
		if (this.config.budget.maxCostUsd > 0) {
			errors.push("Budget maxCostUsd must be 0 for free-only policy");
		}

		return { valid: errors.length === 0, errors, warnings };
	}

	/**
	 * Get current provider config
	 */
	private getCurrentProvider(): ProviderConfig {
		return this.config.providers[this.currentProviderIndex];
	}

	/**
	 * Rotate to next provider (not available with single provider)
	 */
	private rotateProvider(): boolean {
		// Single provider - no rotation available
		return false;
	}

	/**
	 * Build request hash for caching
	 */
	private buildRequestHash(
		messages: Array<{ role: string; content: string }>,
		provider: ProviderConfig,
		options: { temperature?: number; maxTokens?: number } = {},
	): string {
		const content = JSON.stringify({
			messages,
			model: provider.model,
			...options,
		});
		return hashString(content);
	}

	/**
	 * Make request to a specific provider
	 */
	private async makeRequest(
		provider: ProviderConfig,
		messages: Array<{ role: string; content: string }>,
		options: {
			temperature?: number;
			maxTokens?: number;
			seed?: number;
		} = {},
	): Promise<{
		content: string;
		tokensUsed: { prompt: number; completion: number; total: number };
	}> {
		const apiKey = provider.apiKeyEnv
			? process.env[provider.apiKeyEnv]
			: undefined;
		if (!apiKey) {
			throw new Error(
				`Missing API key for provider ${provider.name} (env: ${provider.apiKeyEnv})`,
			);
		}

		const body = {
			model: provider.model,
			messages,
			temperature: this.config.deterministic
				? 0
				: (options.temperature ?? 0.3),
			max_tokens: options.maxTokens ?? 2048,
			seed: this.config.deterministic ? (options.seed ?? 42) : undefined,
			stream: false,
		};

		const headers: Record<string, string> = {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
			...provider.headers,
		};

		const response = await fetch(`${provider.baseUrl}/chat/completions`, {
			method: "POST",
			headers,
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(provider.timeoutMs),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Provider ${provider.name} returned ${response.status}: ${errorText}`,
			);
		}

		const data = await response.json();
		const content = data.choices?.[0]?.message?.content ?? "";
		const tokensUsed = data.usage ?? {
			prompt_tokens: 0,
			completion_tokens: 0,
			total_tokens: 0,
		};

		return {
			content,
			tokensUsed: {
				prompt: tokensUsed.prompt_tokens ?? 0,
				completion: tokensUsed.completion_tokens ?? 0,
				total: tokensUsed.total_tokens ?? 0,
			},
		};
	}

	/**
	 * Execute request with retry, fallback, caching, budget, and checkpointing
	 */
	async request(
		messages: Array<{ role: string; content: string }>,
		options: {
			temperature?: number;
			maxTokens?: number;
			seed?: number;
			checkpointId?: string;
			checkpointStep?: number;
			skipCache?: boolean;
		} = {},
	): Promise<LLMResponse> {
		const requestId = generateRequestId();
		const provider = this.getCurrentProvider();
		const requestHash = this.buildRequestHash(messages, provider, options);

		// Check cache first
		if (this.config.enableCache && !options.skipCache) {
			const cached = this.cache.get(requestHash);
			if (cached) {
				return {
					content: cached.response,
					provider: provider.name,
					model: provider.model,
					tokensUsed: {
						prompt: 0,
						completion: 0,
						total: cached.tokensUsed,
					},
					cached: true,
					requestId,
				};
			}
		}

		// Check budget
		const estimatedTokens =
			messages.reduce((sum, m) => sum + m.content.length / 4, 0) +
			(options.maxTokens ?? 2048);
		const budgetCheck = this.budget.check(estimatedTokens);
		if (!budgetCheck.allowed) {
			throw new Error(`Budget exceeded: ${budgetCheck.reason}`);
		}

		// Dry-run validation mode
		if (this.config.validateOnly) {
			return {
				content:
					"[VALIDATION MODE] Request would be sent to " +
					provider.name,
				provider: provider.name,
				model: provider.model,
				tokensUsed: { prompt: 0, completion: 0, total: 0 },
				cached: false,
				requestId,
			};
		}

		// Checkpoint before request
		if (this.config.enableCheckpoints && options.checkpointId) {
			this.checkpoints.update(
				options.checkpointId,
				options.checkpointStep ?? 0,
				{
					lastRequest: {
						provider: provider.name,
						model: provider.model,
						requestId,
					},
				},
			);
		}

		// Retry loop with fallback
		let lastError: Error | undefined;
		let attempt = 0;

		while (true) {
			const currentProvider = this.getCurrentProvider();

			for (
				attempt = 0;
				attempt < this.config.retry.maxAttempts;
				attempt++
			) {
				try {
					const result = await this.makeRequest(
						currentProvider,
						messages,
						options,
					);

					// Success — update budget, cache, checkpoint
					this.budget.consume(result.tokensUsed.total);

					if (this.config.enableCache) {
						this.cache.set(requestHash, {
							response: result.content,
							tokensUsed: result.tokensUsed.total,
							timestamp: Date.now(),
							requestHash,
						});
					}

					if (this.config.enableCheckpoints && options.checkpointId) {
						this.checkpoints.update(
							options.checkpointId,
							options.checkpointStep ?? 0,
							{
								lastResponse: {
									tokensUsed: result.tokensUsed.total,
									requestId,
								},
							},
						);
					}

					return {
						content: result.content,
						provider: currentProvider.name,
						model: currentProvider.model,
						tokensUsed: result.tokensUsed,
						cached: false,
						requestId,
					};
				} catch (error) {
					lastError =
						error instanceof Error
							? error
							: new Error(String(error));

					// Check if we should retry
					if (
						attempt < this.config.retry.maxAttempts - 1 &&
						isRetryableError(
							error,
							this.config.retry.retryableStatuses,
						)
					) {
						const delay = calculateBackoff(
							attempt,
							this.config.retry,
						);
						await sleep(delay);
						continue;
					}
					break; // Non-retryable or max attempts reached
				}
			}

			// Provider failed — no fallback available
			if (!this.rotateProvider()) {
				// Single provider exhausted
				throw new Error(
					`Provider ${this.config.providers[0].name} exhausted after ${this.config.retry.maxAttempts} attempts. ` +
						`Last error: ${lastError?.message}. ` +
						`Budget used: ${this.budget.getUsage().requests}/${this.config.budget.maxRequests} requests, ` +
						`${this.budget.getUsage().tokens}/${this.config.budget.maxTokens} tokens.`,
				);
			}

			// Try next provider (never reached with single provider)
			continue;
		}
	}

	/**
	 * Structured output request with schema validation
	 */
	async requestStructured<T>(
		messages: Array<{ role: string; content: string }>,
		schema: { parse: (data: string) => T },
		options: Parameters<FreeLLMClient["request"]>[1] = {},
	): Promise<T> {
		const systemPrompt = messages.find((m) => m.role === "system");
		const enhancedMessages = [
			...(systemPrompt ? [systemPrompt] : []),
			{
				role: "user",
				content:
					messages
						.filter((m) => m.role !== "system")
						.map((m) => m.content)
						.join("\n\n") +
					"\n\nRespond ONLY with valid JSON matching this schema:\n" +
					JSON.stringify(schema, null, 2),
			},
		];

		const response = await this.request(enhancedMessages, {
			...options,
			temperature: 0,
			seed: 42,
		});

		try {
			return schema.parse(response.content);
		} catch (error) {
			throw new Error(
				`Structured output validation failed: ${error instanceof Error ? error.message : String(error)}`,
				{ cause: error },
			);
		}
	}

	/**
	 * Get client statistics
	 */
	getStats(): {
		budget: ReturnType<BudgetTracker["getUsage"]>;
		cache: ReturnType<CacheManager["getStats"]>;
		currentProvider: string;
		providersExhausted: boolean;
		requestCount: number;
	} {
		return {
			budget: this.budget.getUsage(),
			cache: this.cache.getStats(),
			currentProvider: this.getCurrentProvider().name,
			providersExhausted:
				this.currentProviderIndex >= this.config.providers.length - 1,
			requestCount: this.requestCount,
		};
	}

	/**
	 * Reset client state (for testing)
	 */
	reset(): void {
		this.currentProviderIndex = 0;
		this.requestCount = 0;
		this.budget.reset();
		this.cache.clear();
	}

	/**
	 * Enable/disable validation mode
	 */
	setValidationMode(enabled: boolean): void {
		this.config.validateOnly = enabled;
	}
}

// ============================================================================
// Factory Function
// ============================================================================

export function createFreeLLMClient(
	overrides: Partial<LLMClientConfig> = {},
): FreeLLMClient {
	return new FreeLLMClient(overrides);
}

/**
 * Check if any inference credentials are configured
 */
export function hasInferenceCredentials(): boolean {
	return Boolean(process.env.OPENROUTER_API_KEY);
}

// ============================================================================
// Schema Helper (Zod-like interface for structured output)
// ============================================================================

export const Schema = {
	string: (description?: string) => ({
		type: "string",
		description,
		parse: (v: string) => v,
	}),
	number: (description?: string) => ({
		type: "number",
		description,
		parse: (v: string) => Number(v),
	}),
	boolean: (description?: string) => ({
		type: "boolean",
		description,
		parse: (v: string) => v === "true",
	}),
	array: (item: any, description?: string) => ({
		type: "array",
		items: item,
		description,
		parse: (v: string) => JSON.parse(v),
	}),
	object: (shape: Record<string, any>, description?: string) => ({
		type: "object",
		properties: shape,
		description,
		parse: (v: string) => JSON.parse(v),
	}),
};
