/**
 * Free-only inference policy guard.
 *
 * The publication pipeline may only use free-tier providers. Nous Portal is a
 * paid service, so no runtime configuration may reference it. This test fails
 * if a paid provider or the Nous API key is reintroduced.
 */

import { describe, expect, it } from "vitest";
import { getDefaultLLMConfig } from "./audio-evaluator.js";
import {
	DEFAULT_BUDGET,
	DEFAULT_PROVIDERS,
	type ProviderConfig,
} from "../free-llm-client.js";

function assertFreeOnly(provider: ProviderConfig) {
	expect(provider.model).toMatch(/:free$/);
	expect(provider.apiKeyEnv).not.toBe("NOUS_API_KEY");
	expect(provider.baseUrl).not.toContain("nousresearch");
	expect(provider.baseUrl).not.toContain("api.nous");
}

describe("free-only inference policy", () => {
	it("declares only free-tier providers in the authoritative client", () => {
		expect(DEFAULT_PROVIDERS.length).toBeGreaterThan(0);
		for (const provider of DEFAULT_PROVIDERS) {
			assertFreeOnly(provider);
		}
	});

	it("audio evaluator defaults follow the same free-only policy", () => {
		const config = getDefaultLLMConfig();
		expect(config.providers.length).toBeGreaterThan(0);
		for (const provider of config.providers) {
			assertFreeOnly(provider);
		}
	});

	it("enforces a zero-cost budget", () => {
		expect(DEFAULT_BUDGET.maxCostUsd).toBe(0);
		expect(getDefaultLLMConfig().budget.maxCostUsd).toBe(0);
	});
});
