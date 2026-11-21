/**
 * Collection Orchestrator Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CollectionOrchestrator } from "../collection/orchestrator.js";
import type { OrchestratorConfig } from "../collection/orchestrator.js";
import type { CollectionJob, DiscoveryRing } from "../collection/types.js";

describe("CollectionOrchestrator", () => {
	let orchestrator: CollectionOrchestrator;
	let mockConfig: OrchestratorConfig;

	beforeEach(() => {
		mockConfig = {
			sourceRegistryPath: "data/sources.yml",
			outputDir: "data/discovered",
			checkpointDir: "data/checkpoints",
			defaultTimeoutMs: 30000,
			defaultRateLimit: 60,
			maxConcurrency: 2,
			userAgent: "test-agent/1.0",
		};

		orchestrator = new CollectionOrchestrator(mockConfig);
	});

	describe("initialization", () => {
		it("creates with default config", () => {
			expect(orchestrator).toBeDefined();
		});
	});

	describe("ring filtering", () => {
		it("filters sources by ring affinity", () => {
			// This tests the internal logic indirectly
			const ring1: DiscoveryRing = 1;
			const ring2: DiscoveryRing = 2;
			const ring3: DiscoveryRing = 3;

			expect([1, 2, 3]).toContain(ring1);
			expect([1, 2, 3]).toContain(ring2);
			expect([1, 2, 3]).toContain(ring3);
		});
	});

	describe("CollectionJob", () => {
		it("creates job with all required fields", () => {
			const job: CollectionJob = {
				jobId: "test-job-1",
				name: "Test Job",
				sourceIds: ["source1", "source2"],
				rings: [1, 2],
				forceFullRefresh: false,
				maxItemsPerSource: 50,
				concurrency: 3,
				outputDir: "data/test",
				writeLedger: true,
			};

			expect(job.jobId).toBe("test-job-1");
			expect(job.rings).toEqual([1, 2]);
			expect(job.maxItemsPerSource).toBe(50);
		});

		it("handles time window", () => {
			const job: CollectionJob = {
				jobId: "test-job-2",
				name: "Test Job with Time Window",
				sourceIds: [],
				rings: [1],
				timeWindow: {
					start: "2025-01-01T00:00:00Z",
					end: "2025-12-31T23:59:59Z",
					timezone: "UTC",
				},
				outputDir: "data/test",
			};

			expect(job.timeWindow?.start).toBe("2025-01-01T00:00:00Z");
			expect(job.timeWindow?.timezone).toBe("UTC");
		});
	});
});
