/**
 * Tests for novelty-classification.ts
 *
 * Tests cover:
 * - NEW classification for items in editorial window
 * - CATCH_UP for explicitly dated older material
 * - TIME_UNVERIFIED for outside window without evidence / reposts
 * - Substantive updates qualifying as NEW
 * - Newly revealed facts about older events qualifying as NEW
 * - Reposts and summaries not qualifying as NEW
 * - Batch classification and statistics
 */

import { describe, it, expect } from "vitest";
import {
	classifyNovelty,
	classifyNoveltyBatch,
	getClassificationStats,
	formatClassification,
} from "./novelty-classification";
import type { NoveltyClassificationInput } from "./novelty-classification";

const createBaseInput = (
	overrides: Partial<NoveltyClassificationInput> = {},
): NoveltyClassificationInput => ({
	title: "Test Item",
	summary: "Test summary",
	proposedPublicationTimestamp: "2025-01-14T12:00:00+01:00[Europe/Amsterdam]",
	sourceUrls: ["https://example.com/source"],
	sourceTier: 1,
	...overrides,
});

describe("Novelty Classification — Core Behavior", () => {
	it("classifies as NEW when timestamp is in editorial window", () => {
		const result = classifyNovelty(createBaseInput());

		expect(result.classification).toBe("NEW");
		expect(result.editionDate).toBe("2025-01-15");
		expect(result.inWindow).toBe(true);
		expect(result.confidence).toBeGreaterThan(0.8);
	});

	it("classifies as NEW for substantive updates in window", () => {
		const input = createBaseInput({
			isKnownUpdate: true,
			updateDescription: "Added new benchmark results for v2.1 release",
		});

		const result = classifyNovelty(input);

		expect(result.classification).toBe("NEW");
		expect(result.isSubstantiveUpdate).toBe(true);
		expect(result.reasoning).toContain("substantive updates");
	});

	it("classifies as NEW for newly revealed facts about older events", () => {
		const input = createBaseInput({
			newlyRevealedFacts: [
				"Security vulnerability discovered in 2023 codebase",
				"Original author confirmed flaw",
			],
		});

		const result = classifyNovelty(input);

		expect(result.classification).toBe("NEW");
		expect(result.isNewlyRevealedFact).toBe(true);
		expect(result.reasoning).toContain("newly revealed facts");
	});

	it("classifies as TIME_UNVERIFIED for reposts in window", () => {
		const input = createBaseInput({
			title: "Recap: Previously announced features",
			summary:
				"Summary of features previously reported earlier this year",
		});

		const result = classifyNovelty(input);

		expect(result.classification).toBe("TIME_UNVERIFIED");
		expect(result.reasoning).toContain("repost or summary");
	});

	it("classifies as TIME_UNVERIFIED for roundups in window", () => {
		const input = createBaseInput({
			title: "Roundup of Q1 announcements",
			summary: "A round-up of all announcements made in Q1",
		});

		const result = classifyNovelty(input);

		expect(result.classification).toBe("TIME_UNVERIFIED");
	});
});

describe("Novelty Classification — CATCH_UP", () => {
	it("classifies as CATCH_UP for explicitly dated older material with evidence", () => {
		const input: NoveltyClassificationInput = {
			title: "Archived: 2023 security advisory",
			summary: "Previously unpublished details from 2023",
			proposedPublicationTimestamp:
				"2023-06-15T10:00:00+02:00[Europe/Amsterdam]",
			sourceUrls: ["https://example.com/archive"],
			sourceTier: 2,
			additionalEvidence: [
				{
					type: "archive_snapshot",
					reference:
						"https://web.archive.org/web/20230615/https://example.com/advisory",
					timestamp: "2023-06-15T10:00:00+02:00[Europe/Amsterdam]",
					description: "Archive snapshot confirming 2023 publication",
					confidence: 0.9,
				},
			],
			editionDate: "2025-01-15",
		};

		const result = classifyNovelty(input);

		expect(result.classification).toBe("CATCH_UP");
		expect(result.editionDate).toBe("2025-01-15");
		expect(result.inWindow).toBe(false);
		expect(result.reasoning).toContain("CATCH_UP");
	});

	it("does NOT classify as CATCH_UP for Tier 3 source without date evidence", () => {
		const input: NoveltyClassificationInput = {
			title: "Old blog post",
			summary: "Blog post from 2022",
			proposedPublicationTimestamp: "2022-01-01T00:00:00Z",
			sourceUrls: ["https://example.com/blog"],
			sourceTier: 3,
			editionDate: "2025-01-15",
		};

		const result = classifyNovelty(input);

		// Should be TIME_UNVERIFIED due to low tier and no evidence
		expect(result.classification).toBe("TIME_UNVERIFIED");
	});

	it("does NOT classify as CATCH_UP without archive/date evidence", () => {
		const input: NoveltyClassificationInput = {
			title: "Old announcement",
			summary: "Announcement from 2023",
			proposedPublicationTimestamp:
				"2023-06-15T10:00:00+02:00[Europe/Amsterdam]",
			sourceUrls: ["https://example.com/announcement"],
			sourceTier: 2,
			editionDate: "2025-01-15",
			// No additionalEvidence
		};

		const result = classifyNovelty(input);

		expect(result.classification).toBe("TIME_UNVERIFIED");
	});
});

describe("Novelty Classification — TIME_UNVERIFIED", () => {
	it("classifies as TIME_UNVERIFIED for timestamp outside window without catch-up evidence", () => {
		const input: NoveltyClassificationInput = {
			title: "Random old post",
			summary: "Some post from 2020",
			proposedPublicationTimestamp:
				"2020-01-01T12:00:00+01:00[Europe/Amsterdam]",
			sourceUrls: ["https://example.com/post"],
			sourceTier: 2,
			editionDate: "2025-01-15",
		};

		const result = classifyNovelty(input);

		expect(result.classification).toBe("TIME_UNVERIFIED");
		expect(result.inWindow).toBe(false);
	});

	it("classifies as TIME_UNVERIFIED when edition date cannot be determined", () => {
		// Use an invalid timestamp format that will fail parsing
		const input: NoveltyClassificationInput = {
			title: "Invalid timestamp",
			summary: "This timestamp is invalid",
			proposedPublicationTimestamp: "not-a-valid-timestamp",
			sourceUrls: ["https://example.com/ancient"],
			sourceTier: 1,
		};

		const result = classifyNovelty(input);

		expect(result.classification).toBe("TIME_UNVERIFIED");
		expect(result.editionDate).toBe("");
		expect(result.confidence).toBe(0);
	});
});

describe("Novelty Classification — Edge Cases", () => {
	it("handles boundary at window start (inclusive)", () => {
		const input = createBaseInput({
			proposedPublicationTimestamp:
				"2025-01-14T05:00:00+01:00[Europe/Amsterdam]",
		});

		const result = classifyNovelty(input);

		expect(result.inWindow).toBe(true);
		expect(result.classification).toBe("NEW");
	});

	it("handles boundary at window end (exclusive)", () => {
		const input = createBaseInput({
			proposedPublicationTimestamp:
				"2025-01-15T05:00:00+01:00[Europe/Amsterdam]",
		});

		const result = classifyNovelty(input);

		// End boundary belongs to next edition (start of next window is inclusive)
		expect(result.inWindow).toBe(true);
		expect(result.editionDate).toBe("2025-01-16");
		expect(result.classification).toBe("NEW");
	});

	it("handles DST spring forward window (23 hours)", () => {
		const input = createBaseInput({
			proposedPublicationTimestamp:
				"2025-03-29T12:00:00+01:00[Europe/Amsterdam]",
			editionDate: "2025-03-30",
		});

		const result = classifyNovelty(input);

		expect(result.inWindow).toBe(true);
		expect(result.editionDate).toBe("2025-03-30");
		expect(result.classification).toBe("NEW");
	});

	it("handles DST fall back window (25 hours)", () => {
		const input = createBaseInput({
			proposedPublicationTimestamp:
				"2025-10-25T12:00:00+02:00[Europe/Amsterdam]",
			editionDate: "2025-10-26",
		});

		const result = classifyNovelty(input);

		expect(result.inWindow).toBe(true);
		expect(result.editionDate).toBe("2025-10-26");
		expect(result.classification).toBe("NEW");
	});

	it("handles substantive update combined with newly revealed facts", () => {
		const input = createBaseInput({
			isKnownUpdate: true,
			updateDescription: "Major revision with new findings",
			newlyRevealedFacts: [
				"Original assumption was incorrect",
				"New data changes conclusion",
			],
		});

		const result = classifyNovelty(input);

		expect(result.classification).toBe("NEW");
		expect(result.isSubstantiveUpdate).toBe(true);
		expect(result.isNewlyRevealedFact).toBe(true);
		expect(result.reasoning).toContain(
			"substantive updates and newly revealed facts",
		);
	});

	it("respects explicit editionDate override", () => {
		const input = createBaseInput({
			proposedPublicationTimestamp:
				"2025-01-14T12:00:00+01:00[Europe/Amsterdam]",
			editionDate: "2025-01-20",
		});

		const result = classifyNovelty(input);

		expect(result.editionDate).toBe("2025-01-20");
	});
});

describe("Novelty Classification — Batch Operations", () => {
	it("batch classifies multiple items", () => {
		const inputs: NoveltyClassificationInput[] = [
			createBaseInput({
				proposedPublicationTimestamp:
					"2025-01-14T12:00:00+01:00[Europe/Amsterdam]",
			}),
			createBaseInput({
				title: "Old item",
				proposedPublicationTimestamp:
					"2023-01-01T12:00:00+01:00[Europe/Amsterdam]",
				sourceTier: 2,
				additionalEvidence: [
					{
						type: "archive_snapshot",
						reference: "https://archive.org/snapshot",
						timestamp:
							"2023-01-01T12:00:00+01:00[Europe/Amsterdam]",
						description: "Archive evidence",
						confidence: 0.9,
					},
				],
				editionDate: "2025-01-15",
			}),
			createBaseInput({
				title: "Repost",
				summary: "Recap of earlier news",
				proposedPublicationTimestamp:
					"2025-01-14T12:00:00+01:00[Europe/Amsterdam]",
			}),
		];

		const results = classifyNoveltyBatch(inputs);

		expect(results).toHaveLength(3);
		expect(results[0].classification).toBe("NEW");
		expect(results[1].classification).toBe("CATCH_UP");
		expect(results[2].classification).toBe("TIME_UNVERIFIED");
	});

	it("calculates classification statistics", () => {
		const inputs: NoveltyClassificationInput[] = [
			createBaseInput({
				proposedPublicationTimestamp:
					"2025-01-14T12:00:00+01:00[Europe/Amsterdam]",
			}),
			createBaseInput({
				proposedPublicationTimestamp:
					"2025-01-14T14:00:00+01:00[Europe/Amsterdam]",
			}),
			createBaseInput({
				title: "Old",
				proposedPublicationTimestamp:
					"2023-01-01T12:00:00+01:00[Europe/Amsterdam]",
				sourceTier: 2,
				additionalEvidence: [
					{
						type: "archive_snapshot",
						reference: "x",
						timestamp:
							"2023-01-01T12:00:00+01:00[Europe/Amsterdam]",
						description: "x",
						confidence: 0.9,
					},
				],
				editionDate: "2025-01-15",
			}),
			createBaseInput({
				title: "Repost",
				summary: "Recap",
				proposedPublicationTimestamp:
					"2025-01-14T12:00:00+01:00[Europe/Amsterdam]",
			}),
		];

		const results = classifyNoveltyBatch(inputs);
		const stats = getClassificationStats(results);

		expect(stats.total).toBe(4);
		expect(stats.new).toBe(2);
		expect(stats.catchUp).toBe(1);
		expect(stats.timeUnverified).toBe(1);
		expect(stats.averageConfidence).toBeGreaterThan(0);
	});
});

describe("Novelty Classification — Formatting", () => {
	it("formats classification result for display", () => {
		const result = classifyNovelty(createBaseInput());
		const formatted = formatClassification(result);

		expect(formatted).toContain("Classification: NEW");
		expect(formatted).toContain("Edition: 2025-01-15");
		expect(formatted).toContain("In Window: Yes");
		expect(formatted).toContain("Confidence:");
		expect(formatted).toContain("Evidence:");
	});
});

describe("Novelty Classification — Source Tier Impact", () => {
	it("Tier 1 sources get higher confidence", () => {
		const tier1Input = createBaseInput({ sourceTier: 1 });
		const tier3Input = createBaseInput({ sourceTier: 3 });

		const tier1Result = classifyNovelty(tier1Input);
		const tier3Result = classifyNovelty(tier3Input);

		expect(tier1Result.confidence).toBeGreaterThan(tier3Result.confidence);
	});

	it("CATCH_UP requires at least Tier 2", () => {
		const tier1Input: NoveltyClassificationInput = {
			...createBaseInput({
				title: "Old",
				proposedPublicationTimestamp:
					"2023-01-01T12:00:00+01:00[Europe/Amsterdam]",
				sourceTier: 1,
				additionalEvidence: [
					{
						type: "archive_snapshot",
						reference: "x",
						timestamp:
							"2023-01-01T12:00:00+01:00[Europe/Amsterdam]",
						description: "x",
						confidence: 0.9,
					},
				],
				editionDate: "2025-01-15",
			}),
		};

		const tier3Input: NoveltyClassificationInput = {
			...tier1Input,
			sourceTier: 3,
		};

		const tier1Result = classifyNovelty(tier1Input);
		const tier3Result = classifyNovelty(tier3Input);

		// Tier 1 should qualify for CATCH_UP, Tier 3 should not
		expect(tier1Result.classification).toBe("CATCH_UP");
		expect(tier3Result.classification).toBe("TIME_UNVERIFIED");
	});
});

describe("Novelty Classification — Repost Detection", () => {
	const repostTitles = [
		"Recap: What happened last week",
		"Roundup: Q1 highlights",
		"Round-up of the month",
		"Previously announced features",
		"Earlier this year we reported",
		"As reported last month",
		"According to previous coverage",
		"Revisiting the announcement",
		"Repost: Important update",
		"Round up of the week",
	];

	for (const title of repostTitles) {
		it(`detects "${title}" as repost`, () => {
			const input = createBaseInput({
				title,
				summary: "Content matching the title",
			});

			const result = classifyNovelty(input);

			expect(result.classification).toBe("TIME_UNVERIFIED");
		});
	}

	it("does not flag substantive updates as reposts", () => {
		const input = createBaseInput({
			title: "Recap: Major update to v2.0",
			summary:
				"Major revision with new benchmark results and architectural changes",
			isKnownUpdate: true,
			updateDescription: "Added new benchmarks and corrected methodology",
		});

		const result = classifyNovelty(input);

		expect(result.classification).toBe("NEW");
		expect(result.isSubstantiveUpdate).toBe(true);
	});
});
