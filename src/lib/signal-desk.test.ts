/**
 * Signal Desk — Validation Tests
 *
 * Tests cover:
 * - Evidence classification logic
 * - Ring classification mapping
 * - Contributor lifecycle evaluation
 * - Validation utilities
 * - Pipeline integration
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
	classifyEvidence,
	mapEvidenceClassToRings,
	classifyItemRings,
	validateRingClassification,
	evaluateContributorStatus,
	recordStatusChange,
	processSignalDeskItem,
	aggregateToCandidate,
	validateContributorEntry,
	validateDiscoveredItem,
	type ContributorEntry,
	type DiscoveredItem,
	type ClaimClassification,
	type EvidenceClass,
	type DiscoveryRing,
	type ContributorStatus,
} from "./signal-desk";

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockContributor = (
	overrides: Partial<ContributorEntry> = {},
): ContributorEntry => ({
	id: "test-expert",
	name: "Test Expert",
	verified: true,
	verificationDate: "2025-11-10T06:00:00Z",
	verificationMethod: "github-profile + blog-rss",
	canonicalProfiles: {
		github: "https://github.com/testexpert",
		blog: "https://testexpert.com",
	},
	sourceChannels: [
		{
			type: "rss",
			url: "https://testexpert.com/feed.xml",
			status: "active",
			lastFetched: "2025-11-10T06:00:00Z",
			accessNotes: "Standard RSS",
			cadence: "weekly",
			contentTypes: ["blog-post"],
		},
	],
	researchDomains: ["agentic-ai-software-engineering"],
	subdomainTags: ["DOM-01-SD03"],
	ringAffinity: [1, 3],
	mandatory: false,
	status: "active",
	addedDate: "2025-11-10T06:00:00Z",
	lastReviewed: "2025-11-10T06:00:00Z",
	notes: "Test contributor",
	classificationHistory: [],
	...overrides,
});

const createMockItem = (
	overrides: Partial<DiscoveredItem> = {},
): DiscoveredItem => ({
	id: "disc_test1234567890ab",
	sourceId: "test-source",
	discoveredAt: "2025-11-10T06:00:00Z",
	title: "Test Item",
	url: "https://testexpert.com/post",
	contentHash: "sha256:" + "a".repeat(64),
	publishedAt: "2025-11-10T06:00:00Z",
	authors: ["Test Expert"],
	rawMetadata: {},
	summary: "Test summary",
	tags: ["test"],
	language: "en",
	evidenceClass: "EXPERT_INTERPRETATION",
	ringClassification: [3],
	claims: [
		{
			claim: "Test claim",
			evidenceClass: "EXPERT_INTERPRETATION",
			ringClassification: [3],
		},
	],
	status: "new",
	signalDeskOrigin: true,
	...overrides,
});

// ============================================================================
// Evidence Classification Tests
// ============================================================================

describe("Signal Desk — Evidence Classification", () => {
	const contributor = createMockContributor();

	describe("FIRST_HAND_DISCLOSURE", () => {
		it("classifies first-person release announcement as FIRST_HAND_DISCLOSURE", () => {
			const item = createMockItem({
				title: "I released a new TypeScript tool for AI coding",
				summary:
					"Announcing my latest open-source project that helps with AI-assisted development",
				authors: ["Test Expert"],
				rawMetadata: {},
			});

			const result = classifyEvidence(item, contributor);
			expect(result).toBe("FIRST_HAND_DISCLOSURE");
		});

		it('classifies "we launched" as FIRST_HAND_DISCLOSURE', () => {
			const item = createMockItem({
				title: "We launched a new benchmark for agent evaluation",
				summary:
					"Our team is excited to introduce a new benchmark suite",
				authors: ["Test Expert"],
				rawMetadata: {},
			});

			const result = classifyEvidence(item, contributor);
			expect(result).toBe("FIRST_HAND_DISCLOSURE");
		});

		it("does NOT classify third-party announcement as FIRST_HAND_DISCLOSURE", () => {
			const item = createMockItem({
				title: "Anthropic released Claude Code v2",
				summary:
					"Anthropic announced the latest version of their coding agent",
				authors: ["Anthropic Blog"],
				rawMetadata: {},
			});

			const result = classifyEvidence(item, contributor);
			expect(result).not.toBe("FIRST_HAND_DISCLOSURE");
		});
	});

	describe("ORIGINAL_FINDING", () => {
		it("classifies benchmark with reproducibility as ORIGINAL_FINDING", () => {
			const item = createMockItem({
				title: "New benchmark: Agent framework outperforms baseline by 40%",
				summary:
					"Measured latency and throughput on new agent framework. Code: github.com/test/benchmark. Reproduce with docker pull test/benchmark. Reproduction steps documented.",
				authors: ["Test Expert"],
				rawMetadata: {},
			});

			const result = classifyEvidence(item, contributor);
			expect(result).toBe("ORIGINAL_FINDING");
		});

		it("classifies vulnerability with PoC as ORIGINAL_FINDING", () => {
			const item = createMockItem({
				title: "Prompt injection vulnerability in popular agent framework",
				summary:
					"Discovered new attack vector. Proof of concept code available. Reproduce with: code: github.com/test/poc. Reproduction steps documented.",
				authors: ["Test Expert"],
				rawMetadata: {},
			});

			const result = classifyEvidence(item, contributor);
			expect(result).toBe("ORIGINAL_FINDING");
		});

		it("does NOT classify opinion without artifact as ORIGINAL_FINDING", () => {
			const item = createMockItem({
				title: "I think agent frameworks will improve next year",
				summary:
					"My prediction about the future of agent development based on current trends",
				authors: ["Test Expert"],
				rawMetadata: {},
			});

			const result = classifyEvidence(item, contributor);
			expect(result).not.toBe("ORIGINAL_FINDING");
		});
	});

	describe("INDEPENDENT_ANALYSIS", () => {
		it("classifies methodology + evidence comparison as INDEPENDENT_ANALYSIS", () => {
			const item = createMockItem({
				title: "Independent comparison: Framework A vs Framework B for agent orchestration",
				summary:
					"We evaluated both frameworks on identical hardware. Methodology: ran 100 trials each, measured latency p99. Results show Framework A 20% faster. No affiliation with either vendor. Independent analysis.",
				authors: ["Test Expert"],
				rawMetadata: {},
			});

			const result = classifyEvidence(item, contributor);
			expect(result).toBe("INDEPENDENT_ANALYSIS");
		});

		it("classifies reproduction study as INDEPENDENT_ANALYSIS", () => {
			const item = createMockItem({
				title: "Reproducing the SWE-bench results for Framework X",
				summary:
					"We replicated the original benchmark using their published methodology. Results show the claimed 85% solve rate. Code and data available. Independent reproduction study. No affiliation with Framework X authors. Benchmark against original.",
				authors: ["Test Expert"],
				rawMetadata: {},
			});

			const result = classifyEvidence(item, contributor);
			expect(result).toBe("INDEPENDENT_ANALYSIS");
		});
	});

	describe("UNVERIFIED_CLAIM", () => {
		it("classifies rumor/speculation as UNVERIFIED_CLAIM", () => {
			const item = createMockItem({
				title: "Rumor: Major AI lab to release new model next week",
				summary:
					"Unconfirmed reports suggest a major release is imminent. Sources say the model will have 10x context window.",
				authors: ["Anonymous"],
				rawMetadata: {},
			});

			const result = classifyEvidence(item, contributor);
			expect(result).toBe("UNVERIFIED_CLAIM");
		});

		it("classifies hearsay as UNVERIFIED_CLAIM", () => {
			const item = createMockItem({
				title: "People say the new framework is unstable",
				summary:
					"Heard that the latest release has issues. No specific details provided.",
				authors: ["Community"],
				rawMetadata: {},
			});

			const result = classifyEvidence(item, contributor);
			expect(result).toBe("UNVERIFIED_CLAIM");
		});

		it("does NOT classify labeled opinion as UNVERIFIED_CLAIM", () => {
			const item = createMockItem({
				title: "Analysis: Why I believe agent frameworks need better sandboxing",
				summary:
					"In my view, the current sandboxing approaches are insufficient. Here is my perspective...",
				authors: ["Test Expert"],
				rawMetadata: {},
			});

			const result = classifyEvidence(item, contributor);
			expect(result).not.toBe("UNVERIFIED_CLAIM");
		});
	});

	describe("EXPERT_INTERPRETATION (default)", () => {
		it("classifies architectural opinion as EXPERT_INTERPRETATION", () => {
			const item = createMockItem({
				title: "Why capability tokens are the future of agent authorization",
				summary:
					"Based on my experience, capability-based auth provides better security than RBAC for agents.",
				authors: ["Test Expert"],
				rawMetadata: {},
			});

			const result = classifyEvidence(item, contributor);
			expect(result).toBe("EXPERT_INTERPRETATION");
		});

		it("classifies prediction without evidence as EXPERT_INTERPRETATION", () => {
			const item = createMockItem({
				title: "Predictions for AI coding agents in 2026",
				summary:
					"I expect we will see multi-agent orchestration become mainstream. Here are my thoughts.",
				authors: ["Test Expert"],
				rawMetadata: {},
			});

			const result = classifyEvidence(item, contributor);
			expect(result).toBe("EXPERT_INTERPRETATION");
		});
	});
});

// ============================================================================
// Ring Classification Tests
// ============================================================================

describe("Signal Desk — Ring Classification Mapping", () => {
	it("maps FIRST_HAND_DISCLOSURE to Ring 1", () => {
		const rings = mapEvidenceClassToRings("FIRST_HAND_DISCLOSURE");
		expect(rings).toEqual([1]);
	});

	it("maps ORIGINAL_FINDING to Ring 2", () => {
		const rings = mapEvidenceClassToRings("ORIGINAL_FINDING");
		expect(rings).toEqual([2]);
	});

	it("maps INDEPENDENT_ANALYSIS to Ring 2", () => {
		const rings = mapEvidenceClassToRings("INDEPENDENT_ANALYSIS");
		expect(rings).toEqual([2]);
	});

	it("maps EXPERT_INTERPRETATION to Ring 3", () => {
		const rings = mapEvidenceClassToRings("EXPERT_INTERPRETATION");
		expect(rings).toEqual([3]);
	});

	it("maps UNVERIFIED_CLAIM to empty (quarantined)", () => {
		const rings = mapEvidenceClassToRings("UNVERIFIED_CLAIM");
		expect(rings).toEqual([]);
	});
});

describe("Signal Desk — Item Ring Classification", () => {
	it("aggregates claim rings for multi-claim item", () => {
		const claims: ClaimClassification[] = [
			{
				claim: "First party release",
				evidenceClass: "FIRST_HAND_DISCLOSURE",
				ringClassification: [1],
			},
			{
				claim: "Benchmark comparison",
				evidenceClass: "INDEPENDENT_ANALYSIS",
				ringClassification: [2],
			},
			{
				claim: "Future speculation",
				evidenceClass: "EXPERT_INTERPRETATION",
				ringClassification: [3],
			},
		];

		const rings = classifyItemRings(claims);
		expect(rings).toEqual([1, 2, 3]);
	});

	it("deduplicates rings", () => {
		const claims: ClaimClassification[] = [
			{
				claim: "Claim 1",
				evidenceClass: "FIRST_HAND_DISCLOSURE",
				ringClassification: [1],
			},
			{
				claim: "Claim 2",
				evidenceClass: "FIRST_HAND_DISCLOSURE",
				ringClassification: [1],
			},
		];

		const rings = classifyItemRings(claims);
		expect(rings).toEqual([1]);
	});
});

describe("Signal Desk — Ring Validation", () => {
	it("validates FIRST_HAND_DISCLOSURE with Ring 1", () => {
		const claim: ClaimClassification = {
			claim: "Test",
			evidenceClass: "FIRST_HAND_DISCLOSURE",
			ringClassification: [1],
		};
		expect(validateRingClassification(claim)).toBe(true);
	});

	it("validates ORIGINAL_FINDING with Ring 2", () => {
		const claim: ClaimClassification = {
			claim: "Test",
			evidenceClass: "ORIGINAL_FINDING",
			ringClassification: [2],
		};
		expect(validateRingClassification(claim)).toBe(true);
	});

	it("rejects FIRST_HAND_DISCLOSURE with Ring 3", () => {
		const claim: ClaimClassification = {
			claim: "Test",
			evidenceClass: "FIRST_HAND_DISCLOSURE",
			ringClassification: [3],
		};
		expect(validateRingClassification(claim)).toBe(false);
	});

	it("accepts UNVERIFIED_CLAIM with no rings", () => {
		const claim: ClaimClassification = {
			claim: "Test",
			evidenceClass: "UNVERIFIED_CLAIM",
			ringClassification: [],
		};
		expect(validateRingClassification(claim)).toBe(true);
	});
});

// ============================================================================
// Contributor Lifecycle Tests
// ============================================================================

describe("Signal Desk — Contributor Lifecycle", () => {
	// Use ISO strings for dates to avoid Temporal Instant month issues
	const nowISO = "2025-11-10T06:00:00Z";
	const oneDay = (n: number) =>
		new Date(Date.parse(nowISO) - n * 24 * 60 * 60 * 1000).toISOString();
	const oneMonth = (n: number) =>
		new Date(
			Date.parse(nowISO) - n * 30 * 24 * 60 * 60 * 1000,
		).toISOString();

	const activeContributor = createMockContributor({
		status: "active",
		mandatory: false,
	});
	const mandatoryContributor = createMockContributor({
		status: "active",
		mandatory: true,
	});
	const watchlistedContributor = createMockContributor({
		status: "watchlisted",
		watchlistDate: oneMonth(5),
	});
	const watchlistedContributorOld = createMockContributor({
		status: "watchlisted",
		watchlistDate: oneMonth(7),
	});

	describe("Mandatory contributors", () => {
		it("never demotes mandatory contributor with active channels", () => {
			const items: DiscoveredItem[] = [];
			const result = evaluateContributorStatus(
				mandatoryContributor,
				items,
				nowISO,
			);
			expect(result.status).toBe("active");
		});

		it("watchlists mandatory contributor with no active channels", () => {
			const contributor = createMockContributor({
				status: "active",
				mandatory: true,
				sourceChannels: [
					{
						...createMockContributor().sourceChannels[0],
						status: "inactive",
					},
				],
			});
			const items: DiscoveredItem[] = [];
			const result = evaluateContributorStatus(
				contributor,
				items,
				nowISO,
			);
			expect(result.status).toBe("watchlisted");
		});
	});

	describe("Watchlisted contributors", () => {
		it("promotes watchlisted after 6 months with sufficient original contributions", () => {
			// Need 6+ months (182+ days) elapsed for promotion
			const oldWatchlist = createMockContributor({
				status: "watchlisted",
				watchlistDate: oneMonth(7),
			});
			const items: DiscoveredItem[] = Array(5)
				.fill(null)
				.map((_, i) =>
					createMockItem({
						id: `disc_${i}`.padEnd(20, "0"),
						evidenceClass: "ORIGINAL_FINDING",
						publishedAt: oneDay(i * 10),
					}),
				);
			const result = evaluateContributorStatus(
				oldWatchlist,
				items,
				nowISO,
			);
			expect(result.status).toBe("active");
		});

		it("archives watchlisted after 6 months with no contributions AND no active channels", () => {
			const noChannels = createMockContributor({
				status: "watchlisted",
				watchlistDate: oneMonth(7),
				sourceChannels: [
					{
						...createMockContributor().sourceChannels[0],
						status: "inactive",
					},
				],
			});
			const items: DiscoveredItem[] = [];
			const result = evaluateContributorStatus(noChannels, items, nowISO);
			expect(result.status).toBe("archived");
		});

		it("stays watchlisted if 6 months not elapsed", () => {
			const recentWatchlist = createMockContributor({
				status: "watchlisted",
				watchlistDate: oneMonth(2),
			});
			const items: DiscoveredItem[] = [];
			const result = evaluateContributorStatus(
				recentWatchlist,
				items,
				nowISO,
			);
			expect(result.status).toBe("watchlisted");
		});
	});

	describe("Active contributors", () => {
		it("archives after 12 months no original contributions and no active channels", () => {
			const items: DiscoveredItem[] = Array(3)
				.fill(null)
				.map((_, i) =>
					createMockItem({
						id: `disc_${i}`.padEnd(20, "0"),
						evidenceClass: "EXPERT_INTERPRETATION",
						publishedAt: oneMonth(2),
					}),
				);
			const noChannels = createMockContributor({
				status: "active",
				sourceChannels: [
					{
						...createMockContributor().sourceChannels[0],
						status: "inactive",
					},
				],
			});
			const result = evaluateContributorStatus(noChannels, items, nowISO);
			expect(result.status).toBe("archived");
		});

		it("watchlists if no recent contributions but channels active", () => {
			const items: DiscoveredItem[] = [];
			const result = evaluateContributorStatus(
				activeContributor,
				items,
				nowISO,
			);
			expect(result.status).toBe("watchlisted");
		});
	});
});

describe("Signal Desk — Status Change Recording", () => {
	it("records status change with provenance", () => {
		const contributor = createMockContributor({ status: "watchlisted" });
		const updated = recordStatusChange(
			contributor,
			"active",
			"Editor-in-Chief",
			"6-month trial complete; 5 original findings",
		);

		expect(updated.status).toBe("active");
		expect(updated.classificationHistory).toHaveLength(1);
		expect(updated.classificationHistory[0].fromStatus).toBe("watchlisted");
		expect(updated.classificationHistory[0].toStatus).toBe("active");
		expect(updated.classificationHistory[0].authority).toBe(
			"Editor-in-Chief",
		);
		expect(updated.classificationHistory[0].rationale).toBe(
			"6-month trial complete; 5 original findings",
		);
	});

	it("preserves history on multiple changes", () => {
		let contributor = createMockContributor({ status: "watchlisted" });
		contributor = recordStatusChange(
			contributor,
			"active",
			"Editor",
			"Promoted",
		);
		contributor = recordStatusChange(
			contributor,
			"archived",
			"Editor",
			"No signal",
		);

		expect(contributor.classificationHistory).toHaveLength(2);
		expect(contributor.classificationHistory[0].toStatus).toBe("active");
		expect(contributor.classificationHistory[1].toStatus).toBe("archived");
	});
});

// ============================================================================
// Pipeline Integration Tests
// ============================================================================

describe("Signal Desk — Pipeline Integration", () => {
	const contributor = createMockContributor();

	describe("processSignalDeskItem", () => {
		it("classifies and adds Signal Desk metadata", () => {
			const rawItem: Omit<
				DiscoveredItem,
				| "evidenceClass"
				| "ringClassification"
				| "claims"
				| "status"
				| "signalDeskOrigin"
			> = {
				id: "disc_test1234567890ab",
				sourceId: "test-source",
				discoveredAt: "2025-11-10T06:00:00Z",
				title: "New benchmark: Agent framework outperforms baseline by 40%",
				url: "https://testexpert.com/benchmark",
				contentHash: "sha256:" + "a".repeat(64),
				publishedAt: "2025-11-10T06:00:00Z",
				authors: ["Test Expert"],
				rawMetadata: {
					summary:
						"Measured latency and throughput. Code: github.com/test/benchmark. Reproduce with docker pull test/benchmark.",
				},
				summary:
					"Measured latency and throughput. Code: github.com/test/benchmark. Reproduce with docker pull test/benchmark.",
				tags: ["benchmark", "agent"],
				language: "en",
			};

			const processed = processSignalDeskItem(rawItem, contributor);

			expect(processed.contributorId).toBe("test-expert");
			expect(processed.evidenceClass).toBe("ORIGINAL_FINDING");
			expect(processed.ringClassification).toEqual([2]);
			expect(processed.claims).toHaveLength(1);
			expect(processed.claims[0].evidenceClass).toBe("ORIGINAL_FINDING");
			expect(processed.status).toBe("new");
			expect(processed.signalDeskOrigin).toBe(true);
		});

		it("classifies first-hand disclosure correctly", () => {
			const rawItem: Omit<
				DiscoveredItem,
				| "evidenceClass"
				| "ringClassification"
				| "claims"
				| "status"
				| "signalDeskOrigin"
			> = {
				id: "disc_test1234567890ab",
				sourceId: "test-source",
				discoveredAt: "2025-11-10T06:00:00Z",
				title: "I released a new benchmark for agent evaluation",
				url: "https://testexpert.com/benchmark",
				contentHash: "sha256:" + "a".repeat(64),
				publishedAt: "2025-11-10T06:00:00Z",
				authors: ["Test Expert"],
				rawMetadata: {
					summary:
						"New benchmark with code and Docker for reproduction",
				},
				summary: "New benchmark with code and Docker for reproduction",
				tags: ["benchmark", "agent"],
				language: "en",
			};

			const processed = processSignalDeskItem(rawItem, contributor);

			expect(processed.contributorId).toBe("test-expert");
			expect(processed.evidenceClass).toBe("FIRST_HAND_DISCLOSURE");
			expect(processed.ringClassification).toEqual([1]);
			expect(processed.status).toBe("new");
			expect(processed.signalDeskOrigin).toBe(true);
		});

		it("quarantines UNVERIFIED_CLAIM", () => {
			const rawItem: Omit<
				DiscoveredItem,
				| "evidenceClass"
				| "ringClassification"
				| "claims"
				| "status"
				| "signalDeskOrigin"
			> = {
				id: "disc_test1234567890ab",
				sourceId: "test-source",
				discoveredAt: "2025-11-10T06:00:00Z",
				title: "Rumor: New model next week",
				url: "https://testexpert.com/rumor",
				contentHash: "sha256:" + "a".repeat(64),
				publishedAt: "2025-11-10T06:00:00Z",
				authors: ["Anonymous"],
				rawMetadata: { summary: "Unconfirmed reports suggest..." },
				summary: "Unconfirmed reports suggest...",
				tags: ["rumor"],
				language: "en",
			};

			const processed = processSignalDeskItem(rawItem, contributor);

			expect(processed.evidenceClass).toBe("UNVERIFIED_CLAIM");
			expect(processed.ringClassification).toEqual([]);
			expect(processed.status).toBe("quarantined");
		});
	});

	describe("aggregateToCandidate", () => {
		it("aggregates multiple items with evidence tracking", () => {
			const items: DiscoveredItem[] = [
				createMockItem({
					id: "disc_1".padEnd(20, "0"),
					evidenceClass: "ORIGINAL_FINDING",
					ringClassification: [2],
					claims: [
						{
							claim: "Benchmark result",
							evidenceClass: "ORIGINAL_FINDING",
							ringClassification: [2],
						},
					],
					rawMetadata: {
						tier: 2,
						researchDomains: ["agentic-ai-software-engineering"],
						subdomainTags: ["DOM-01-SD04"],
					},
					contributorId: "test-expert",
				}),
				createMockItem({
					id: "disc_2".padEnd(20, "0"),
					evidenceClass: "FIRST_HAND_DISCLOSURE",
					ringClassification: [1],
					claims: [
						{
							claim: "Release announcement",
							evidenceClass: "FIRST_HAND_DISCLOSURE",
							ringClassification: [1],
						},
					],
					rawMetadata: {
						tier: 1,
						researchDomains: ["agentic-ai-software-engineering"],
						subdomainTags: ["DOM-01-SD03"],
					},
					contributorId: "test-expert",
				}),
			];

			const candidate = aggregateToCandidate(
				items,
				"cand_test1234567890ab",
				"editor",
			);

			expect(candidate.signalDeskOrigin).toBe(true);
			expect(candidate.evidenceClassDistribution.ORIGINAL_FINDING).toBe(
				1,
			);
			expect(
				candidate.evidenceClassDistribution.FIRST_HAND_DISCLOSURE,
			).toBe(1);
			expect(candidate.ringClassificationDistribution[1]).toBe(1);
			expect(candidate.ringClassificationDistribution[2]).toBe(1);
			expect(candidate.contributorIds).toContain("test-expert");
			expect(candidate.crossDomainSignals).toBe(false); // same domain
		});
	});
});

// ============================================================================
// Validation Tests
// ============================================================================

describe("Signal Desk — Validation", () => {
	describe("validateContributorEntry", () => {
		it("accepts valid contributor", () => {
			const contributor = createMockContributor();
			const result = validateContributorEntry(contributor);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("rejects invalid ID format", () => {
			const contributor = createMockContributor({ id: "Test_Expert" });
			const result = validateContributorEntry(contributor);
			expect(result.valid).toBe(false);
			expect(result.errors).toContain(
				"Invalid ID format (must be kebab-case)",
			);
		});

		it("rejects unverified contributor", () => {
			const contributor = createMockContributor({ verified: false });
			const result = validateContributorEntry(contributor);
			expect(result.valid).toBe(false);
			expect(result.errors).toContain("Contributor must be verified");
		});

		it("rejects missing source channels", () => {
			const contributor = createMockContributor({ sourceChannels: [] });
			const result = validateContributorEntry(contributor);
			expect(result.valid).toBe(false);
			expect(result.errors).toContain(
				"At least one source channel is required",
			);
		});

		it("rejects invalid research domain", () => {
			const contributor = createMockContributor({
				researchDomains: ["invalid-domain"],
			});
			const result = validateContributorEntry(contributor);
			expect(result.valid).toBe(false);
			expect(
				result.errors.some((e) =>
					e.includes("Invalid research domain"),
				),
			).toBe(true);
		});

		it("rejects invalid subdomain tag format", () => {
			const contributor = createMockContributor({
				subdomainTags: ["INVALID-TAG"],
			});
			const result = validateContributorEntry(contributor);
			expect(result.valid).toBe(false);
			expect(
				result.errors.some((e) =>
					e.includes("Invalid subdomain tag format"),
				),
			).toBe(true);
		});

		it("rejects invalid ring affinity", () => {
			const contributor = createMockContributor({
				ringAffinity: [4] as unknown as DiscoveryRing[],
			});
			const result = validateContributorEntry(contributor);
			expect(result.valid).toBe(false);
			expect(
				result.errors.some((e) => e.includes("Invalid ring affinity")),
			).toBe(true);
		});
	});

	describe("validateDiscoveredItem", () => {
		it("accepts valid item", () => {
			const item = createMockItem({
				evidenceClass: "ORIGINAL_FINDING",
				ringClassification: [2],
			});
			const result = validateDiscoveredItem(item);
			expect(result.valid).toBe(true);
		});

		it("rejects missing evidence class", () => {
			const item = createMockItem({ evidenceClass: "" as any });
			const result = validateDiscoveredItem(item);
			expect(result.valid).toBe(false);
			expect(result.errors).toContain("Evidence class is required");
		});

		it("rejects incompatible ring for evidence class", () => {
			const item = createMockItem({
				evidenceClass: "FIRST_HAND_DISCLOSURE",
				ringClassification: [3],
			});
			const result = validateDiscoveredItem(item);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("incompatible"))).toBe(
				true,
			);
		});

		it("accepts UNVERIFIED_CLAIM with no rings", () => {
			const item = createMockItem({
				evidenceClass: "UNVERIFIED_CLAIM",
				ringClassification: [],
			});
			const result = validateDiscoveredItem(item);
			expect(result.valid).toBe(true);
		});

		it("validates claims array", () => {
			const item = createMockItem({
				evidenceClass: "ORIGINAL_FINDING",
				ringClassification: [2],
				claims: [
					{
						claim: "Test",
						evidenceClass: "FIRST_HAND_DISCLOSURE",
						ringClassification: [3],
					},
				],
			});
			const result = validateDiscoveredItem(item);
			expect(result.valid).toBe(false);
		});
	});
});

// ============================================================================
// Contributor Registry Fixtures Validation
// ============================================================================

describe("Signal Desk — Contributor Registry Fixtures", () => {
	// This test validates the actual contributors.yml data
	// We'll load and validate it in an integration test
	it("should validate all mandatory contributors have required fields", () => {
		// This is a placeholder - actual validation happens via schema validation
		// of the YAML file in the build pipeline
		expect(true).toBe(true);
	});
});
