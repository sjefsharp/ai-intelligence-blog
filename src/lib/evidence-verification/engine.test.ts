/**
 * Evidence Verification Engine Tests
 *
 * Tests cover:
 * - Claim-to-source traceability
 * - Evidence classification
 * - Primary versus secondary evidence
 * - Repeated claims without independent corroboration
 * - Conflicting evidence and uncertainty
 * - Product availability and release maturity
 * - Scientific benchmark interpretation
 * - Consultancy research methodology and disclosure limitations
 * - Correlation versus causation
 * - Publication and disclosure timestamp integrity
 * - Missing evidence and inaccessible paywalled research
 * - Persistence, readback and backward compatibility
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
	verifyClaim,
	verifyClaims,
	getVerificationStats,
	calculateConfidence,
	classifyEvidence,
	isVendorSource,
	isOriginalReporting,
	analyzeCounterevidence,
	identifyAssumptions,
	identifyAlternativeExplanations,
	identifyFalsificationCriteria,
	identifyUnresolvedUncertainties,
} from "./engine.js";
import { createEvidenceVerificationStore } from "./store.js";
import type { ClaimVerificationInput, EvidenceReference } from "./types.js";
import type { Counterevidence } from "./types.js";
import { promises as fs } from "fs";
import path from "path";

// ============================================================================
// Test Helpers
// ============================================================================

function createMockEvidence(
	overrides: Partial<EvidenceReference> = {},
): EvidenceReference {
	return {
		id: `ev_${Math.random().toString(36).slice(2, 18)}`,
		sourceId: "test-source",
		classification: "EXPERT_INTERPRETATION",
		url: "https://example.com/source",
		locator: "section 1",
		extractedText: "Test evidence text",
		timestamp: new Date().toISOString(),
		timestampType: "original-publication",
		sourceTimezone: "UTC",
		confidence: 0.9,
		tier: 2,
		evidenceRole: "primary",
		applicableMethods: ["primary-source-inspection"],
		limitations: [],
		retrievalMetadata: {
			retrievedAt: new Date().toISOString(),
			retrievalMethod: "automated-collection",
			contentHash: "sha256:abc123",
		},
		...overrides,
	};
}

function createMockInput(
	overrides: Partial<ClaimVerificationInput> = {},
): ClaimVerificationInput {
	return {
		candidateId: "cand_abc123",
		candidateStableId: "stable-candidate-1",
		claim: "Test claim for verification",
		claimType: "technical-announcement",
		sourceId: "test-source",
		sourceUrl: "https://example.com/announcement",
		sourceTitle: "Test Announcement",
		sourceAuthor: ["Author Name"],
		sourcePublisher: "Test Publisher",
		publicationTimestamp: new Date().toISOString(),
		supportingEvidence: [
			createMockEvidence(),
			createMockEvidence({
				evidenceRole: "corroborating",
				sourceId: "other-source",
			}),
		],
		...overrides,
	};
}

// ============================================================================
// Evidence Classification Tests
// ============================================================================

describe("Evidence Classification", () => {
	it("classifies VERIFIED_FACT with primary evidence and independent replication", () => {
		const evidence = [
			createMockEvidence({
				evidenceRole: "primary",
				classification: "VERIFIED_FACT",
			}),
			createMockEvidence({
				evidenceRole: "corroborating",
				sourceId: "other-source",
				classification: "VERIFIED_FACT",
			}),
		];

		const classification = classifyEvidence(
			evidence,
			"technical-announcement",
			1,
			true, // hasIndependentReplication
			true, // hasMethodology
			true, // hasReproductionArtifact
			false, // isVendorSource
			false, // isOriginalReporting
		);

		expect(classification).toBe("VERIFIED_FACT");
	});

	it("classifies VENDOR_CLAIM for vendor source without independent replication", () => {
		const evidence = [
			createMockEvidence({
				evidenceRole: "primary",
				classification: "VENDOR_CLAIM",
			}),
		];

		const classification = classifyEvidence(
			evidence,
			"technical-announcement",
			2,
			false, // hasIndependentReplication
			true,
			false,
			true, // isVendorSource
			false,
		);

		expect(classification).toBe("VENDOR_CLAIM");
	});

	it("classifies RESEARCH_FINDING for scientific research with methodology", () => {
		const evidence = [
			createMockEvidence({
				evidenceRole: "primary",
				classification: "RESEARCH_FINDING",
			}),
		];

		const classification = classifyEvidence(
			evidence,
			"scientific-research",
			1,
			false,
			true, // hasMethodology
			false,
			false,
			false,
		);

		expect(classification).toBe("RESEARCH_FINDING");
	});

	it("classifies ORIGINAL_REPORTING for first-hand disclosure", () => {
		const evidence = [
			createMockEvidence({
				evidenceRole: "primary",
				timestampType: "first-public-disclosure",
			}),
		];

		const classification = classifyEvidence(
			evidence,
			"original-reporting",
			2,
			false,
			true,
			false,
			false,
			true, // isOriginalReporting
		);

		expect(classification).toBe("ORIGINAL_REPORTING");
	});

	it("classifies EXPERT_INTERPRETATION for evidence-informed analysis without reproduction", () => {
		const evidence = [createMockEvidence({ evidenceRole: "primary" })];

		const classification = classifyEvidence(
			evidence,
			"strategic-research",
			2,
			false,
			true,
			false, // no reproduction artifact
			false,
			false,
		);

		expect(classification).toBe("EXPERT_INTERPRETATION");
	});

	it("classifies INFERENCE when no primary evidence exists", () => {
		const evidence = [createMockEvidence({ evidenceRole: "secondary" })];

		const classification = classifyEvidence(
			evidence,
			"technical-announcement",
			2,
			false,
			false,
			false,
			false,
			false,
		);

		expect(classification).toBe("INFERENCE");
	});

	it("classifies SPECULATION for tier 3 source without methodology", () => {
		const evidence = [
			createMockEvidence({ evidenceRole: "secondary", tier: 3 }),
		];

		const classification = classifyEvidence(
			evidence,
			"vendor-announcement",
			3,
			false,
			false,
			false,
			false,
			false,
		);

		expect(classification).toBe("SPECULATION");
	});

	it("classifies UNVERIFIED when no evidence available", () => {
		const classification = classifyEvidence(
			[],
			"technical-announcement",
			2,
			false,
			false,
			false,
			false,
			false,
		);

		expect(classification).toBe("UNVERIFIED");
	});
});

// ============================================================================
// Vendor Source Detection Tests
// ============================================================================

describe("Vendor Source Detection", () => {
	it("detects OpenAI as vendor source", () => {
		expect(
			isVendorSource("openai-news", "https://openai.com/news/research"),
		).toBe(true);
		expect(
			isVendorSource(
				"openai-news",
				"https://openai.com/blog/announcement",
			),
		).toBe(true);
	});

	it("detects Anthropic as vendor source", () => {
		expect(
			isVendorSource(
				"anthropic-research",
				"https://anthropic.com/research/paper",
			),
		).toBe(true);
	});

	it("detects Google as vendor source", () => {
		expect(
			isVendorSource(
				"google-ai-blog",
				"https://blog.google/technology/ai/announcement",
			),
		).toBe(true);
		expect(
			isVendorSource(
				"deepmind-blog",
				"https://deepmind.google/blog/announcement",
			),
		).toBe(true);
	});

	it("detects Microsoft as vendor source", () => {
		expect(
			isVendorSource(
				"azure-ai-blog",
				"https://azure.microsoft.com/blog/announcement",
			),
		).toBe(true);
		expect(
			isVendorSource(
				"github-copilot",
				"https://github.blog/announcement",
			),
		).toBe(true);
	});

	it("detects AWS as vendor source", () => {
		expect(
			isVendorSource(
				"aws-ml-blog",
				"https://aws.amazon.com/blogs/machine-learning/announcement",
			),
		).toBe(true);
	});

	it("does not detect independent journalism as vendor", () => {
		expect(
			isVendorSource(
				"tech-review",
				"https://www.technologyreview.com/article",
			),
		).toBe(false);
		expect(isVendorSource("lwn", "https://lwn.net/article")).toBe(false);
	});
});

// ============================================================================
// Original Reporting Detection Tests
// ============================================================================

describe("Original Reporting Detection", () => {
	it("detects Technology Review as journalism with first disclosure", () => {
		const evidence = [
			createMockEvidence({ timestampType: "first-public-disclosure" }),
		];
		expect(
			isOriginalReporting(
				"tech-review",
				"https://www.technologyreview.com/article",
				evidence,
			),
		).toBe(true);
	});

	it("does not detect without first disclosure evidence", () => {
		const evidence = [
			createMockEvidence({ timestampType: "original-publication" }),
		];
		expect(
			isOriginalReporting(
				"tech-review",
				"https://www.technologyreview.com/article",
				evidence,
			),
		).toBe(false);
	});

	it("does not detect non-journalism source as original reporting", () => {
		const evidence = [
			createMockEvidence({ timestampType: "first-public-disclosure" }),
		];
		expect(
			isOriginalReporting(
				"openai-news",
				"https://openai.com/news/article",
				evidence,
			),
		).toBe(false);
	});
});

// ============================================================================
// Confidence Calculation Tests
// ============================================================================

describe("Confidence Calculation", () => {
	it("returns high confidence for VERIFIED_FACT at L3", () => {
		const evidence = [
			createMockEvidence({
				classification: "VERIFIED_FACT",
				confidence: 0.95,
				evidenceRole: "primary",
			}),
			createMockEvidence({
				classification: "VERIFIED_FACT",
				confidence: 0.9,
				evidenceRole: "corroborating",
			}),
		];
		const counterevidence: any[] = [];

		const confidence = calculateConfidence(
			evidence,
			counterevidence,
			"VERIFIED_FACT",
			"L3",
		);
		expect(confidence).toBeGreaterThan(0.85);
	});

	it("returns low confidence for UNVERIFIED at L0", () => {
		const evidence = [
			createMockEvidence({
				classification: "UNVERIFIED",
				confidence: 0.3,
			}),
		];
		const counterevidence: any[] = [];

		const confidence = calculateConfidence(
			evidence,
			counterevidence,
			"UNVERIFIED",
			"L0",
		);
		expect(confidence).toBeLessThan(0.2);
	});

	it("reduces confidence when counterevidence exists", () => {
		const evidence = [
			createMockEvidence({
				classification: "VERIFIED_FACT",
				confidence: 0.9,
				evidenceRole: "primary",
			}),
		];
		const counterevidence = [
			{
				id: "ce_test1",
				claimId: "claim_test",
				evidenceReference: createMockEvidence({ confidence: 0.8 }),
				contradictsClaim: "Test claim",
				contradictionType: "direct" as const,
				description: "Test counterevidence",
				confidence: 0.8,
				sourceId: "counter-source",
				discoveredAt: new Date().toISOString(),
			},
		];

		const confidenceWithCounter = calculateConfidence(
			evidence,
			counterevidence,
			"VERIFIED_FACT",
			"L2",
		);
		const confidenceWithoutCounter = calculateConfidence(
			evidence,
			[],
			"VERIFIED_FACT",
			"L2",
		);

		expect(confidenceWithCounter).toBeLessThan(confidenceWithoutCounter);
	});

	it("boosts confidence for multiple primary sources", () => {
		const singlePrimary = [
			createMockEvidence({
				classification: "RESEARCH_FINDING",
				confidence: 0.8,
				evidenceRole: "primary",
			}),
		];
		const multiplePrimary = [
			createMockEvidence({
				classification: "RESEARCH_FINDING",
				confidence: 0.8,
				evidenceRole: "primary",
			}),
			createMockEvidence({
				classification: "RESEARCH_FINDING",
				confidence: 0.85,
				evidenceRole: "primary",
				sourceId: "other-source",
			}),
		];

		const singleConfidence = calculateConfidence(
			singlePrimary,
			[],
			"RESEARCH_FINDING",
			"L1",
		);
		const multiConfidence = calculateConfidence(
			multiplePrimary,
			[],
			"RESEARCH_FINDING",
			"L1",
		);

		expect(multiConfidence).toBeGreaterThanOrEqual(singleConfidence);
	});

	it("caps confidence at 1.0", () => {
		const evidence = [
			createMockEvidence({
				classification: "VERIFIED_FACT",
				confidence: 1.0,
				evidenceRole: "primary",
			}),
			createMockEvidence({
				classification: "VERIFIED_FACT",
				confidence: 1.0,
				evidenceRole: "primary",
				sourceId: "other",
			}),
		];

		const confidence = calculateConfidence(
			evidence,
			[],
			"VERIFIED_FACT",
			"L3",
		);
		expect(confidence).toBeLessThanOrEqual(1.0);
	});

	it("floors confidence at 0.0", () => {
		const evidence = [
			createMockEvidence({
				classification: "SPECULATION",
				confidence: 0.1,
				evidenceRole: "secondary",
			}),
		];
		const counterevidence: Counterevidence[] = [
			{
				id: "ce_test2",
				claimId: "claim_test",
				evidenceReference: createMockEvidence({ confidence: 0.9 }),
				contradictsClaim: "Test claim",
				contradictionType: "direct",
				description: "Test counterevidence 1",
				confidence: 0.9,
				sourceId: "counter-source-1",
				discoveredAt: new Date().toISOString(),
			},
			{
				id: "ce_test3",
				claimId: "claim_test",
				evidenceReference: createMockEvidence({ confidence: 0.8 }),
				contradictsClaim: "Test claim",
				contradictionType: "direct",
				description: "Test counterevidence 2",
				confidence: 0.8,
				sourceId: "counter-source-2",
				discoveredAt: new Date().toISOString(),
			},
		];

		const confidence = calculateConfidence(
			evidence,
			counterevidence,
			"SPECULATION",
			"L0",
		);
		expect(confidence).toBeGreaterThanOrEqual(0.0);
	});
});

// ============================================================================
// Counterevidence Analysis Tests
// ============================================================================

describe("Counterevidence Analysis", () => {
	it("identifies explicit counterevidence", () => {
		const evidence = [
			createMockEvidence({ evidenceRole: "primary" }),
			createMockEvidence({
				evidenceRole: "counterevidence",
				sourceId: "counter-source",
				extractedText: "This contradicts the claim",
			}),
		];

		const counterevidence = analyzeCounterevidence(
			"Test claim",
			evidence,
			"technical-announcement",
		);
		expect(counterevidence.length).toBe(1);
		expect(counterevidence[0].contradictionType).toBe("direct");
		expect(counterevidence[0].sourceId).toBe("counter-source");
	});

	it("identifies qualifying language as qualifying contradiction", () => {
		const evidence = [
			createMockEvidence({
				evidenceRole: "primary",
				extractedText:
					"The feature works, however it has limitations in edge cases",
			}),
		];

		const counterevidence = analyzeCounterevidence(
			"Feature works perfectly",
			evidence,
			"technical-announcement",
		);
		expect(counterevidence.length).toBe(1);
		expect(counterevidence[0].contradictionType).toBe("qualifying");
	});

	it("identifies preliminary language as qualifying contradiction", () => {
		const evidence = [
			createMockEvidence({
				evidenceRole: "primary",
				extractedText:
					"Preliminary results show improvement, but further testing needed",
			}),
		];

		const counterevidence = analyzeCounterevidence(
			"Significant improvement confirmed",
			evidence,
			"benchmark-result",
		);
		expect(counterevidence.length).toBe(1);
		expect(counterevidence[0].contradictionType).toBe("qualifying");
	});

	it("returns empty array when no counterevidence", () => {
		const evidence = [
			createMockEvidence({
				evidenceRole: "primary",
				extractedText: "Clear positive result",
			}),
		];
		const counterevidence = analyzeCounterevidence(
			"Test claim",
			evidence,
			"technical-announcement",
		);
		expect(counterevidence.length).toBe(0);
	});
});

// ============================================================================
// Assumption Identification Tests
// ============================================================================

describe("Assumption Identification", () => {
	it("identifies technical assumptions for performance claims", () => {
		const assumptions = identifyAssumptions(
			"New model is 50% faster than previous version",
			[],
			"benchmark-result",
		);
		expect(
			assumptions.some(
				(a) =>
					a.type === "technical" &&
					a.assumption.includes("Benchmark conditions"),
			),
		).toBe(true);
	});

	it("identifies compatibility assumptions for integration claims", () => {
		const assumptions = identifyAssumptions(
			"Tool integrates seamlessly with existing workflow",
			[],
			"technical-announcement",
		);
		expect(
			assumptions.some(
				(a) =>
					a.type === "technical" &&
					a.assumption.includes("API compatibility"),
			),
		).toBe(true);
	});

	it("identifies methodological assumptions for research claims", () => {
		const assumptions = identifyAssumptions(
			"Study shows significant improvement",
			[],
			"scientific-research",
		);
		expect(
			assumptions.some(
				(a) =>
					a.type === "methodological" &&
					a.assumption.includes("confounding"),
			),
		).toBe(true);
		expect(
			assumptions.some(
				(a) =>
					a.type === "methodological" &&
					a.assumption.includes("Statistical methods"),
			),
		).toBe(true);
	});

	it("identifies representativeness assumptions for advisory claims", () => {
		const assumptions = identifyAssumptions(
			"Survey shows 80% adoption rate",
			[],
			"strategic-research",
		);
		expect(
			assumptions.some(
				(a) =>
					a.type === "methodological" &&
					a.assumption.includes("representative"),
			),
		).toBe(true);
	});

	it("identifies causation assumption for causal claims", () => {
		const assumptions = identifyAssumptions(
			"AI adoption causes productivity increase",
			[],
			"advisory-finding",
		);
		expect(
			assumptions.some(
				(a) =>
					a.type === "methodological" &&
					a.assumption.includes("Correlation implies causation"),
			),
		).toBe(true);
	});

	it("identifies organizational translation assumption for enterprise claims", () => {
		const assumptions = identifyAssumptions(
			"Team productivity increases 30%",
			[],
			"productivity-claim",
		);
		expect(
			assumptions.some(
				(a) =>
					a.type === "organizational" &&
					a.assumption.includes("organizational outcomes"),
			),
		).toBe(true);
	});

	it("identifies cost accounting assumption for ROI claims", () => {
		const assumptions = identifyAssumptions(
			"ROI of 200% achieved",
			[],
			"roi-claim",
		);
		expect(
			assumptions.some(
				(a) =>
					a.type === "economic" &&
					a.assumption.includes("governance costs"),
			),
		).toBe(true);
	});

	it("identifies selection bias assumption for enterprise claims", () => {
		const assumptions = identifyAssumptions(
			"Early adopters report success",
			[],
			"enterprise-adoption",
		);
		expect(
			assumptions.some(
				(a) =>
					a.type === "methodological" &&
					a.assumption.includes("Selection bias"),
			),
		).toBe(true);
	});
});

// ============================================================================
// Alternative Explanation Tests
// ============================================================================

describe("Alternative Explanation Identification", () => {
	it("identifies confounding variable alternative for improvement claims", () => {
		const alternatives = identifyAlternativeExplanations(
			"New tool improves developer productivity by 40%",
			[],
			"productivity-claim",
		);
		expect(
			alternatives.some((a) => a.type === "confounding-variable"),
		).toBe(true);
	});

	it("identifies selection bias for enterprise adoption claims", () => {
		const alternatives = identifyAlternativeExplanations(
			"Companies adopting AI see revenue growth",
			[],
			"enterprise-adoption",
		);
		expect(
			alternatives.some(
				(a) =>
					a.type === "selection-bias" &&
					a.explanation.includes("self-selected"),
			),
		).toBe(true);
		expect(
			alternatives.some(
				(a) =>
					a.type === "selection-bias" &&
					a.explanation.includes("Survivorship"),
			),
		).toBe(true);
	});

	it("identifies measurement artifact for benchmark claims", () => {
		const alternatives = identifyAlternativeExplanations(
			"Benchmark shows 2x speedup",
			[],
			"benchmark-result",
		);
		expect(
			alternatives.some((a) => a.type === "measurement-artifact"),
		).toBe(true);
	});

	it("identifies third variable for advisory correlation claims", () => {
		const alternatives = identifyAlternativeExplanations(
			"Cloud adoption correlates with agility",
			[],
			"strategic-research",
		);
		expect(
			alternatives.some((a) => a.type === "different-causal-mechanism"),
		).toBe(true);
	});

	it("always includes statistical fluke alternative", () => {
		const alternatives = identifyAlternativeExplanations(
			"Any claim",
			[],
			"technical-announcement",
		);
		expect(alternatives.some((a) => a.type === "statistical-fluke")).toBe(
			true,
		);
	});
});

// ============================================================================
// Falsification Criteria Tests
// ============================================================================

describe("Falsification Criteria Identification", () => {
	it("always includes independent replication criterion", () => {
		const criteria = identifyFalsificationCriteria(
			"Any claim",
			[],
			"technical-announcement",
		);
		expect(
			criteria.some(
				(c) =>
					c.type === "reproduction" &&
					c.criterion.includes("Independent replication"),
			),
		).toBe(true);
	});

	it("includes API observation criterion for technical announcements", () => {
		const criteria = identifyFalsificationCriteria(
			"Feature works as documented",
			[],
			"technical-announcement",
		);
		expect(
			criteria.some(
				(c) =>
					c.type === "observation" &&
					c.criterion.includes("public API"),
			),
		).toBe(true);
	});

	it("includes controlled experiment for benchmark claims", () => {
		const criteria = identifyFalsificationCriteria(
			"Model is faster",
			[],
			"benchmark-result",
		);
		expect(
			criteria.some(
				(c) =>
					c.type === "experiment" &&
					c.criterion.includes("confounders"),
			),
		).toBe(true);
	});

	it("includes A/B test for enterprise claims", () => {
		const criteria = identifyFalsificationCriteria(
			"Productivity increases",
			[],
			"productivity-claim",
		);
		expect(
			criteria.some(
				(c) =>
					c.type === "experiment" && c.criterion.includes("A/B test"),
			),
		).toBe(true);
	});

	it("includes methodological audit for advisory claims", () => {
		const criteria = identifyFalsificationCriteria(
			"Adoption drives growth",
			[],
			"strategic-research",
		);
		expect(
			criteria.some(
				(c) =>
					c.type === "audit" &&
					c.criterion.includes("Methodological audit"),
			),
		).toBe(true);
	});
});

// ============================================================================
// Unresolved Uncertainty Tests
// ============================================================================

describe("Unresolved Uncertainty Identification", () => {
	it("identifies evidence gap when no primary evidence", () => {
		const evidence = [createMockEvidence({ evidenceRole: "secondary" })];
		const uncertainties = identifyUnresolvedUncertainties(
			"Test claim",
			evidence,
			[],
			"technical-announcement",
		);
		expect(
			uncertainties.some(
				(u) => u.type === "evidence-gap" && u.blockingVerification,
			),
		).toBe(true);
	});

	it("identifies evidence gap when no evidence at all", () => {
		const uncertainties = identifyUnresolvedUncertainties(
			"Test claim",
			[],
			[],
			"technical-announcement",
		);
		expect(
			uncertainties.some(
				(u) =>
					u.type === "evidence-gap" &&
					u.uncertainty.includes("No evidence"),
			),
		).toBe(true);
	});

	it("identifies methodological uncertainty for research without methodology", () => {
		const evidence = [
			createMockEvidence({
				applicableMethods: ["primary-source-inspection"],
			}),
		];
		const uncertainties = identifyUnresolvedUncertainties(
			"Study finds X",
			evidence,
			[],
			"scientific-research",
		);
		expect(
			uncertainties.some(
				(u) =>
					u.type === "methodological" &&
					u.uncertainty.includes("Methodology not documented"),
			),
		).toBe(true);
	});

	it("identifies counterevidence uncertainty", () => {
		const counterevidence = [
			{
				id: "ce_1",
				claimId: "",
				evidenceReference: createMockEvidence(),
				contradictsClaim: "",
				contradictionType: "direct" as const,
				description: "",
				confidence: 0.8,
				sourceId: "",
				discoveredAt: new Date().toISOString(),
			},
		];
		const uncertainties = identifyUnresolvedUncertainties(
			"Test claim",
			[createMockEvidence()],
			counterevidence,
			"technical-announcement",
		);
		expect(
			uncertainties.some(
				(u) =>
					u.type === "evidence-gap" &&
					u.uncertainty.includes("counterevidence"),
			),
		).toBe(true);
	});

	it("identifies temporal uncertainty when timestamp confidence is low", () => {
		const evidence = [
			createMockEvidence({
				timestampType: "original-publication",
				confidence: 0.5,
			}),
		];
		const uncertainties = identifyUnresolvedUncertainties(
			"Test claim",
			evidence,
			[],
			"technical-announcement",
		);
		expect(
			uncertainties.some(
				(u) =>
					u.type === "temporal" &&
					u.uncertainty.includes("timestamp"),
			),
		).toBe(true);
	});

	it("identifies generalizability uncertainty for enterprise claims", () => {
		const uncertainties = identifyUnresolvedUncertainties(
			"Company X sees benefit",
			[createMockEvidence()],
			[],
			"enterprise-adoption",
		);
		expect(uncertainties.some((u) => u.type === "generalizability")).toBe(
			true,
		);
	});

	it("identifies scope uncertainty for universal quantifiers", () => {
		const uncertainties = identifyUnresolvedUncertainties(
			"All organizations benefit",
			[createMockEvidence()],
			[],
			"enterprise-adoption",
		);
		expect(
			uncertainties.some(
				(u) => u.type === "scope" && u.blockingVerification,
			),
		).toBe(true);
	});
});

// ============================================================================
// Full Claim Verification Tests
// ============================================================================

describe("Full Claim Verification", () => {
	it("verifies technical announcement with GA release", async () => {
		const input = createMockInput({
			claim: "Product X v2.0 is now generally available with 40% performance improvement",
			claimType: "software-release",
			supportingEvidence: [
				createMockEvidence({
					extractedText:
						"Product X v2.0 is generally available as of today. Benchmarks show 40% performance improvement over v1.0.",
					evidenceRole: "primary",
				}),
				createMockEvidence({
					extractedText:
						"Independent testing confirms 38-42% improvement range",
					evidenceRole: "corroborating",
					sourceId: "independent-tester",
				}),
			],
		});

		const result = await verifyClaim(input);

		expect(result.id).toMatch(/^claim_[a-z0-9]{16}$/);
		expect(result.claim).toBe(input.claim);
		expect(result.evidenceClassification).toBe("VERIFIED_FACT");
		expect(result.verificationStatus).toBe("verified");
		expect(result.verificationLevel).toBe("L1");
		expect(result.confidence).toBeGreaterThan(0.8);
		expect(result.productContext?.releaseMaturity).toBe("ga");
		expect(result.productContext?.availability).toBe("general");
		expect(result.technicalContext?.implementationStatus).toBe("released");
	});

	it("verifies vendor claim without independent replication as VENDOR_CLAIM", async () => {
		const input = createMockInput({
			claim: "Our new model achieves state-of-the-art performance",
			claimType: "vendor-announcement",
			sourceUrl: "https://openai.com/blog/new-model",
			supportingEvidence: [
				createMockEvidence({
					extractedText:
						"We are excited to announce our new model achieves SOTA on benchmarks",
					evidenceRole: "primary",
				}),
			],
		});

		const result = await verifyClaim(input);

		expect(result.evidenceClassification).toBe("VENDOR_CLAIM");
		expect(result.verificationStatus).toBe("unverified");
		expect(result.verificationLevel).toBe("L0");
	});

	it("verifies scientific research with methodology", async () => {
		const input = createMockInput({
			claim: "New training method reduces compute by 30% while maintaining accuracy",
			claimType: "scientific-research",
			supportingEvidence: [
				createMockEvidence({
					extractedText:
						"We propose a new training method. Methodology: controlled experiments on 4 GPU clusters. Dataset: C4. Evaluation: perplexity on held-out set. Code available at github.com/repo",
					evidenceRole: "primary",
					applicableMethods: [
						"methodology-review",
						"artifact-reproduction",
					],
				}),
			],
		});

		const result = await verifyClaim(input);

		expect(result.evidenceClassification).toBe("RESEARCH_FINDING");
		expect(result.verificationStatus).toBe("verified");
		expect(
			result.scientificContext?.reproducibility?.artifactAvailable,
		).toBe(true);
		expect(
			result.scientificContext?.benchmarkMethodology?.hardwareSpecified,
		).toBe(true);
	});

	it("verifies advisory research with paywall limitations", async () => {
		const input = createMockInput({
			claim: "AI adoption correlates with 15% revenue increase",
			claimType: "strategic-research",
			sourceUrl: "https://www.mckinsey.com/insights/ai-adoption",
			supportingEvidence: [
				createMockEvidence({
					extractedText:
						"McKinsey Global Institute survey of 1000 companies. Methodology in appendix. Correlation found between AI adoption and revenue growth.",
					evidenceRole: "primary",
					applicableMethods: ["methodology-review"],
				}),
			],
		});

		const result = await verifyClaim(input);

		expect(result.evidenceClassification).toBe("EXPERT_INTERPRETATION");
		expect(result.verificationStatus).toBe("partially-verified");
		expect(
			result.researchContext?.paywallDetails?.methodologyVerifiable,
		).toBe(true);
		expect(result.researchContext?.causalClaimType).toBe("correlation");
	});

	it("verifies enterprise productivity claim with cost analysis", async () => {
		const input = createMockInput({
			claim: "Developers using Copilot complete tasks 55% faster",
			claimType: "productivity-claim",
			supportingEvidence: [
				createMockEvidence({
					extractedText:
						"Study of 200 developers. Measured task completion time. Baseline: control group without tool. Results: 55% faster. Implementation cost: $10/seat/month. Inference cost included.",
					evidenceRole: "primary",
				}),
			],
		});

		const result = await verifyClaim(input);

		expect(result.enterpriseContext?.measuredOutcome).toContain("faster");
		expect(result.enterpriseContext?.individualVsTeamVsOrg).toBe(
			"individual",
		);
		expect(result.enterpriseContext?.implementationCosts).toContain("$10");
	});

	it("verifies original reporting with first-hand disclosure", async () => {
		const input = createMockInput({
			claim: "Company X secretly acquired startup Y for $500M",
			claimType: "original-reporting",
			sourceUrl:
				"https://www.technologyreview.com/article/secret-acquisition",
			supportingEvidence: [
				createMockEvidence({
					extractedText:
						"According to three sources familiar with the matter, Company X acquired startup Y. The deal was not publicly announced.",
					timestampType: "first-public-disclosure",
					evidenceRole: "primary",
				}),
			],
		});

		const result = await verifyClaim(input);

		expect(result.evidenceClassification).toBe("ORIGINAL_REPORTING");
		expect(result.verificationStatus).toBe("verified");
	});

	it("handles contradictory evidence correctly", async () => {
		const input = createMockInput({
			claim: "Feature works perfectly in all cases",
			claimType: "technical-announcement",
			supportingEvidence: [
				createMockEvidence({
					extractedText: "Feature works perfectly in all cases",
					evidenceRole: "primary",
				}),
				createMockEvidence({
					extractedText:
						"However, feature fails in edge cases with high concurrency",
					evidenceRole: "counterevidence",
					sourceId: "bug-report",
				}),
			],
		});

		const result = await verifyClaim(input);

		expect(result.counterevidence.length).toBe(1);
		expect(result.verificationStatus).toBe("contradicted");
		expect(
			result.unresolvedUncertainties.some((u) =>
				u.uncertainty.includes("counterevidence"),
			),
		).toBe(true);
	});

	it("includes temporal verification metadata", async () => {
		const pubTime = "2025-11-10T06:00:00Z";
		const input = createMockInput({
			publicationTimestamp: pubTime,
			supportingEvidence: [
				createMockEvidence({
					timestamp: pubTime,
					timestampType: "original-publication",
					sourceTimezone: "UTC",
					confidence: 0.95,
				}),
			],
		});

		const result = await verifyClaim(input);

		expect(result.temporalVerification.originalPublicationTimestamp).toBe(
			pubTime,
		);
		expect(result.temporalVerification.timezonePrecision).toBe("exact");
		expect(result.temporalVerification.timestampConfidence).toBeGreaterThan(
			0.9,
		);
	});

	it("includes assumptions, alternatives, falsification criteria, and uncertainties", async () => {
		const input = createMockInput({
			claim: "New algorithm reduces latency by 50%",
			claimType: "benchmark-result",
			supportingEvidence: [createMockEvidence()],
		});

		const result = await verifyClaim(input);

		expect(result.assumptions.length).toBeGreaterThan(0);
		expect(result.alternativeExplanations.length).toBeGreaterThan(0);
		expect(result.falsificationCriteria.length).toBeGreaterThan(0);
		expect(result.unresolvedUncertainties.length).toBeGreaterThan(0);

		// Check all assumptions have claimId set
		for (const a of result.assumptions) {
			expect(a.claimId).toBe(result.id);
		}
		for (const a of result.alternativeExplanations) {
			expect(a.claimId).toBe(result.id);
		}
		for (const f of result.falsificationCriteria) {
			expect(f.claimId).toBe(result.id);
		}
		for (const u of result.unresolvedUncertainties) {
			expect(u.claimId).toBe(result.id);
		}
	});
});

// ============================================================================
// Batch Verification Tests
// ============================================================================

describe("Batch Verification", () => {
	it("verifies multiple claims", async () => {
		const inputs = [
			createMockInput({
				claim: "Claim 1",
				claimType: "technical-announcement",
			}),
			createMockInput({
				claim: "Claim 2",
				claimType: "software-release",
			}),
			createMockInput({
				claim: "Claim 3",
				claimType: "scientific-research",
			}),
		];

		const results = await verifyClaims(inputs);

		expect(results.length).toBe(3);
		expect(results[0].claim).toBe("Claim 1");
		expect(results[1].claim).toBe("Claim 2");
		expect(results[2].claim).toBe("Claim 3");
	});
});

// ============================================================================
// Statistics Tests
// ============================================================================

describe("Verification Statistics", () => {
	it("calculates correct statistics", async () => {
		const records = await verifyClaims([
			createMockInput({
				claim: "Verified fact",
				claimType: "technical-announcement",
				supportingEvidence: [
					createMockEvidence({
						classification: "VERIFIED_FACT",
						evidenceRole: "primary",
					}),
				],
			}),
			createMockInput({
				claim: "Vendor claim",
				claimType: "vendor-announcement",
				sourceUrl: "https://openai.com/blog/test",
				supportingEvidence: [
					createMockEvidence({ evidenceRole: "primary" }),
				],
			}),
			createMockInput({
				claim: "Research finding",
				claimType: "scientific-research",
			}),
		]);

		const stats = getVerificationStats(records);

		expect(stats.totalClaims).toBe(3);
		expect(stats.byClassification.VERIFIED_FACT).toBeGreaterThanOrEqual(1);
		expect(stats.byClassification.VENDOR_CLAIM).toBeGreaterThanOrEqual(1);
		expect(stats.byStatus.verified).toBeGreaterThanOrEqual(1);
		expect(stats.byStatus.unverified).toBeGreaterThanOrEqual(1);
		expect(stats.averageConfidence).toBeGreaterThan(0);
		expect(stats.verificationCoveragePercent).toBeGreaterThan(0);
	});
});

// ============================================================================
// Persistence Tests
// ============================================================================

describe("Evidence Verification Store", () => {
	const testDir = path.join(
		process.cwd(),
		"data",
		"test-evidence-verification",
	);
	let store: ReturnType<typeof createEvidenceVerificationStore>;

	beforeEach(async () => {
		// Clean up test directory
		await fs.rm(testDir, { recursive: true, force: true });
		store = createEvidenceVerificationStore({
			verificationDir: testDir,
			maxHistoryFiles: 5,
			historyRetentionDays: 3650,
		});
		await store.initialize();
	});

	afterEach(async () => {
		await fs.rm(testDir, { recursive: true, force: true });
	});

	it("saves and loads verification batch", async () => {
		const records = await verifyClaims([
			createMockInput({ claim: "Test claim 1" }),
			createMockInput({ claim: "Test claim 2" }),
		]);

		const editionDate = "2025-11-10";
		const executionId = "test-execution-123";

		const entry = await store.saveVerificationBatch(
			editionDate,
			executionId,
			records,
		);

		expect(entry.editionDate).toBe(editionDate);
		expect(entry.executionId).toBe(executionId);
		expect(entry.records.length).toBe(2);
		expect(entry.stats.totalClaims).toBe(2);
	});

	it("loads verification batch by edition date", async () => {
		const records = await verifyClaims([
			createMockInput({ claim: "Test claim" }),
		]);
		const editionDate = "2025-11-10";
		const executionId = "test-execution-456";

		await store.saveVerificationBatch(editionDate, executionId, records);
		const loaded = await store.loadVerificationBatch(editionDate);

		expect(loaded).not.toBeNull();
		expect(loaded!.editionDate).toBe(editionDate);
		expect(loaded!.records.length).toBe(1);
	});

	it("queries verification records", async () => {
		const records = await verifyClaims([
			createMockInput({
				claim: "Technical claim",
				claimType: "technical-announcement",
			}),
			createMockInput({
				claim: "Research claim",
				claimType: "scientific-research",
			}),
		]);
		const editionDate = "2025-11-10";
		await store.saveVerificationBatch(editionDate, "exec-1", records);

		const technicalClaims = await store.query({
			claimType: "technical-announcement",
			editionDate,
		});
		expect(technicalClaims.length).toBe(1);
		expect(technicalClaims[0].claimType).toBe("technical-announcement");

		const researchClaims = await store.query({
			claimType: "scientific-research",
			editionDate,
		});
		expect(researchClaims.length).toBe(1);
		expect(researchClaims[0].claimType).toBe("scientific-research");
	});

	it("gets claim verification by ID", async () => {
		const records = await verifyClaims([
			createMockInput({ claim: "Specific claim" }),
		]);
		const editionDate = "2025-11-10";
		await store.saveVerificationBatch(editionDate, "exec-2", records);

		const claimId = records[0].id;
		const loaded = await store.getClaimVerification(claimId);

		expect(loaded).not.toBeNull();
		expect(loaded!.id).toBe(claimId);
	});

	it("gets candidate verifications", async () => {
		const records = await verifyClaims([
			createMockInput({ claim: "Claim 1", candidateId: "cand_1" }),
			createMockInput({ claim: "Claim 2", candidateId: "cand_1" }),
			createMockInput({ claim: "Claim 3", candidateId: "cand_2" }),
		]);
		const editionDate = "2025-11-10";
		await store.saveVerificationBatch(editionDate, "exec-3", records);

		const cand1Claims = await store.getCandidateVerifications("cand_1");
		expect(cand1Claims.length).toBe(2);

		const cand2Claims = await store.getCandidateVerifications("cand_2");
		expect(cand2Claims.length).toBe(1);
	});

	it("exports for fact dossier", async () => {
		const records = await verifyClaims([
			createMockInput({ claim: "Claim 1", candidateId: "cand_export" }),
			createMockInput({ claim: "Claim 2", candidateId: "cand_export" }),
		]);
		const editionDate = "2025-11-10";
		await store.saveVerificationBatch(editionDate, "exec-4", records);

		const exportData = await store.exportForFactDossier("cand_export");

		expect(exportData.claims.length).toBe(2);
		expect(exportData.sources.length).toBeGreaterThan(0);
		expect(exportData.claims[0]).toHaveProperty("verification");
		expect(exportData.claims[0]).toHaveProperty("confidence");
	});

	it("updates claim verification with revision history", async () => {
		const records = await verifyClaims([
			createMockInput({ claim: "Original claim" }),
		]);
		const editionDate = "2025-11-10";
		const executionId = "exec-update";
		await store.saveVerificationBatch(editionDate, executionId, records);

		const claimId = records[0].id;
		const updated = await store.updateClaimVerification(
			editionDate,
			executionId,
			claimId,
			{ verificationStatus: "downgraded", confidence: 0.5 },
			"editor",
			"New evidence contradicts claim",
		);

		expect(updated).not.toBeNull();
		expect(updated!.verificationStatus).toBe("downgraded");
		expect(updated!.confidence).toBe(0.5);
		expect(updated!.revisionHistory.length).toBe(1);
		expect(updated!.revisionHistory[0].reason).toContain(
			"New evidence contradicts claim",
		);
	});

	it("retracts claim", async () => {
		const records = await verifyClaims([
			createMockInput({ claim: "To be retracted" }),
		]);
		const editionDate = "2025-11-10";
		const executionId = "exec-retract";
		await store.saveVerificationBatch(editionDate, executionId, records);

		const claimId = records[0].id;
		const retracted = await store.retractClaim(
			editionDate,
			executionId,
			claimId,
			"Found to be false",
			"editor",
		);

		expect(retracted).not.toBeNull();
		expect(retracted!.verificationStatus).toBe("retracted");
		expect(retracted!.evidenceClassification).toBe("UNVERIFIED");
	});

	it("supersedes claim", async () => {
		const records = await verifyClaims([
			createMockInput({ claim: "Old claim" }),
		]);
		const editionDate = "2025-11-10";
		const executionId = "exec-supersede";
		await store.saveVerificationBatch(editionDate, executionId, records);

		const claimId = records[0].id;
		const superseded = await store.supersedeClaim(
			editionDate,
			executionId,
			claimId,
			"claim_new_123",
			"editor",
			"Updated with new data",
		);

		expect(superseded).not.toBeNull();
		expect(superseded!.verificationStatus).toBe("superseded");
	});

	it("gets claim history", async () => {
		const records = await verifyClaims([
			createMockInput({ claim: "History test" }),
		]);
		const editionDate = "2025-11-10";
		const executionId = "exec-history";
		await store.saveVerificationBatch(editionDate, executionId, records);

		const claimId = records[0].id;
		await store.updateClaimVerification(
			editionDate,
			executionId,
			claimId,
			{ confidence: 0.5 },
			"editor",
			"Update 1",
		);
		await store.updateClaimVerification(
			editionDate,
			executionId,
			claimId,
			{ confidence: 0.3 },
			"editor",
			"Update 2",
		);

		const history = await store.getClaimHistory(claimId);
		expect(history.length).toBe(2);
	});

	it("gets global stats", async () => {
		const records = await verifyClaims([
			createMockInput({ claim: "Stats test" }),
		]);
		const editionDate = "2025-11-10";
		await store.saveVerificationBatch(editionDate, "exec-stats", records);

		const globalStats = await store.getGlobalStats();

		expect(globalStats.totalRecords).toBe(1);
		expect(globalStats.totalEditions).toBe(1);
		expect(globalStats.globalStats.totalClaims).toBe(1);
	});

	it("prunes old history files", async () => {
		// Create multiple edition files
		for (let i = 0; i < 8; i++) {
			const records = await verifyClaims([
				createMockInput({ claim: `Claim ${i}` }),
			]);
			const editionDate = `2025-11-${String(10 + i).padStart(2, "0")}`;
			await store.saveVerificationBatch(
				editionDate,
				`exec-${i}`,
				records,
			);
		}

		// Should only keep maxHistoryFiles (5)
		const files = await fs.readdir(testDir);
		expect(files.length).toBeLessThanOrEqual(5);
	});
});

// ============================================================================
// Backward Compatibility Tests
// ============================================================================

describe("Backward Compatibility", () => {
	it("maintains stable claim ID format", async () => {
		const input = createMockInput();
		const result = await verifyClaim(input);
		expect(result.id).toMatch(/^claim_[a-z0-9]{16}$/);
	});

	it("maintains evidence reference ID format", async () => {
		const input = createMockInput();
		const result = await verifyClaim(input);
		for (const e of result.supportingEvidence) {
			expect(e.id).toMatch(/^ev_[a-z0-9]{16}$/);
		}
	});

	it("maintains counterevidence ID format", async () => {
		const input = createMockInput({
			supportingEvidence: [
				createMockEvidence({ evidenceRole: "primary" }),
				createMockEvidence({
					evidenceRole: "counterevidence",
					sourceId: "counter",
				}),
			],
		});
		const result = await verifyClaim(input);
		for (const c of result.counterevidence) {
			expect(c.id).toMatch(/^ce_[a-z0-9]{16}$/);
		}
	});

	it("maintains assumption ID format", async () => {
		const input = createMockInput();
		const result = await verifyClaim(input);
		for (const a of result.assumptions) {
			expect(a.id).toMatch(/^asm_[a-z0-9]{16}$/);
		}
	});

	it("maintains alternative explanation ID format", async () => {
		const input = createMockInput();
		const result = await verifyClaim(input);
		for (const a of result.alternativeExplanations) {
			expect(a.id).toMatch(/^alt_[a-z0-9]{16}$/);
		}
	});

	it("maintains falsification criterion ID format", async () => {
		const input = createMockInput();
		const result = await verifyClaim(input);
		for (const f of result.falsificationCriteria) {
			expect(f.id).toMatch(/^fal_[a-z0-9]{16}$/);
		}
	});

	it("maintains uncertainty ID format", async () => {
		const input = createMockInput();
		const result = await verifyClaim(input);
		for (const u of result.unresolvedUncertainties) {
			expect(u.id).toMatch(/^unc_[a-z0-9]{16}$/);
		}
	});

	it("maintains revision ID format", async () => {
		const testDir = path.join(process.cwd(), "data", "test-compat");
		await fs.rm(testDir, { recursive: true, force: true });
		const store = createEvidenceVerificationStore({
			verificationDir: testDir,
			historyRetentionDays: 3650,
		});
		await store.initialize();

		const records = await verifyClaims([createMockInput()]);
		const editionDate = "2025-11-10";
		const executionId = "exec-compat";
		await store.saveVerificationBatch(editionDate, executionId, records);

		const claimId = records[0].id;
		await store.updateClaimVerification(
			editionDate,
			executionId,
			claimId,
			{ confidence: 0.5 },
			"editor",
			"Test",
		);

		const history = await store.getClaimHistory(claimId);
		expect(history[0].revisionId).toMatch(/^rev_[a-z0-9]{16}$/);

		await fs.rm(testDir, { recursive: true, force: true });
	});
});

// ============================================================================
// Representative Cases from Requirements
// ============================================================================

describe("Representative Verification Cases", () => {
	// Case 1: Official AI model or coding-agent announcement
	it("verifies official AI coding agent announcement (GitHub Copilot)", async () => {
		const input = createMockInput({
			claim: "GitHub Copilot Chat now supports GPT-4o model for all enterprise users",
			claimType: "vendor-announcement",
			sourceId: "github-copilot-vscode",
			sourceUrl: "https://github.blog/changelog/copilot-gpt4o",
			sourceTitle: "GitHub Copilot Chat: GPT-4o now available",
			sourcePublisher: "GitHub",
			supportingEvidence: [
				createMockEvidence({
					sourceId: "github-copilot-vscode",
					extractedText:
						"Starting today, GitHub Copilot Chat in VS Code supports GPT-4o for all Copilot Enterprise users. This model provides improved reasoning and code generation capabilities.",
					evidenceRole: "primary",
					timestampType: "original-publication",
				}),
				createMockEvidence({
					sourceId: "github-copilot-vscode",
					extractedText:
						"GPT-4o rollout begins today for Enterprise; Business and Individual users will receive access over the next two weeks.",
					evidenceRole: "primary",
					timestampType: "substantive-update",
				}),
			],
		});

		const result = await verifyClaim(input);

		expect(result.evidenceClassification).toBe("VENDOR_CLAIM");
		expect(result.verificationStatus).toBe("unverified");
		expect(result.productContext?.releaseMaturity).toBe("ga");
		expect(result.productContext?.availability).toBe("limited"); // Phased rollout
		expect(
			result.assumptions.some((a) => a.assumption.includes("rollout")),
		).toBe(true);
	});

	// Case 2: Original scientific research paper
	it("verifies original scientific research paper (arXiv)", async () => {
		const input = createMockInput({
			claim: "Mixture-of-Experts models achieve 40% compute reduction with equivalent perplexity",
			claimType: "scientific-research",
			sourceId: "arxiv-cs-lg",
			sourceUrl: "https://arxiv.org/abs/2501.12345",
			sourceTitle: "Efficient MoE Training via Dynamic Expert Routing",
			sourceAuthor: ["Researcher A", "Researcher B"],
			sourcePublisher: "arXiv",
			supportingEvidence: [
				createMockEvidence({
					sourceId: "arxiv-cs-lg",
					extractedText:
						"We propose Dynamic Expert Routing (DER) for Mixture-of-Experts models. Methodology: trained on 1T tokens, 8x H100, bfloat16. Evaluation: perplexity on C4 validation. Code: github.com/lab/der. Results: 40% FLOPs reduction at iso-perplexity.",
					evidenceRole: "primary",
					applicableMethods: [
						"methodology-review",
						"artifact-reproduction",
						"benchmark-methodology-audit",
					],
					timestampType: "original-publication",
				}),
			],
		});

		const result = await verifyClaim(input);

		expect(result.evidenceClassification).toBe("RESEARCH_FINDING");
		expect(result.verificationStatus).toBe("verified");
		expect(
			result.scientificContext?.reproducibility?.artifactAvailable,
		).toBe(true);
		expect(result.scientificContext?.benchmarkMethodology?.precision).toBe(
			"bfloat16",
		);
		expect(result.verificationLevel).toBe("L2");
	});

	// Case 3: Publicly accessible Gartner/McKinsey/Forrester/IDC research finding
	it("verifies publicly accessible McKinsey research finding", async () => {
		const input = createMockInput({
			claim: "Generative AI could add $2.6T-$4.4T annually to global economy",
			claimType: "advisory-finding",
			sourceId: "mckinsey-insights",
			sourceUrl:
				"https://www.mckinsey.com/insights/mgi/generative-ai-economic-potential",
			sourceTitle: "The economic potential of generative AI",
			sourcePublisher: "McKinsey Global Institute",
			supportingEvidence: [
				createMockEvidence({
					sourceId: "mckinsey-insights",
					extractedText:
						"MGI analysis estimates generative AI could add $2.6T-$4.4T annually across 63 use cases. Methodology: use case sizing, adoption curves, productivity modeling. Based on survey of 1000+ organizations. Full methodology in appendix (client access required).",
					evidenceRole: "primary",
					applicableMethods: [
						"methodology-review",
						"paywall-accessible-review",
					],
					timestampType: "original-publication",
				}),
			],
		});

		const result = await verifyClaim(input);

		expect(result.evidenceClassification).toBe("EXPERT_INTERPRETATION");
		expect(result.verificationStatus).toBe("partially-verified");
		expect(
			result.researchContext?.paywallDetails?.methodologyVerifiable,
		).toBe(true);
		expect(
			result.researchContext?.paywallDetails?.inaccessibleSections,
		).toContain("full methodology");
		expect(result.researchContext?.causalClaimType).toBe("prediction");
		expect(
			result.assumptions.some((a) =>
				a.assumption.includes("adoption curves"),
			),
		).toBe(true);
	});

	// Case 4: Vendor productivity or ROI claim
	it("verifies vendor productivity claim (GitHub Copilot)", async () => {
		const input = createMockInput({
			claim: "Developers using GitHub Copilot complete coding tasks 55% faster",
			claimType: "productivity-claim",
			sourceId: "github-copilot-vscode",
			sourceUrl:
				"https://github.blog/research/copilot-productivity-study",
			sourceTitle:
				"Research: Quantifying GitHub Copilot impact on developer productivity",
			sourcePublisher: "GitHub",
			supportingEvidence: [
				createMockEvidence({
					sourceId: "github-copilot-vscode",
					extractedText:
						"Controlled experiment with 95 developers. Task: implement HTTP server in JavaScript. Copilot group: 55% faster completion (1.2h vs 2.7h). Measured: task completion time. Baseline: control group without Copilot. Implementation cost: included in Copilot subscription ($19/user/month). Inference cost: covered by GitHub.",
					evidenceRole: "primary",
					applicableMethods: [
						"methodology-review",
						"statistical-analysis",
					],
					timestampType: "original-publication",
				}),
			],
		});

		const result = await verifyClaim(input);

		expect(result.evidenceClassification).toBe("VENDOR_CLAIM");
		expect(result.verificationStatus).toBe("unverified");
		expect(result.enterpriseContext?.measuredOutcome).toContain("faster");
		expect(result.enterpriseContext?.individualVsTeamVsOrg).toBe(
			"individual",
		);
		expect(result.enterpriseContext?.implementationCosts).toContain("$19");
		expect(
			result.assumptions.some((a) =>
				a.assumption.includes("Selection bias"),
			),
		).toBe(true);
	});

	// Case 5: Credible original report about older event with newly disclosed information
	it("verifies original reporting about older event with new disclosure", async () => {
		const input = createMockInput({
			claim: "Major cloud provider experienced unreported 2023 data breach affecting 10M users",
			claimType: "original-reporting",
			sourceId: "technologyreview.com",
			sourceUrl:
				"https://www.technologyreview.com/2025/01/15/cloud-provider-breach-2023",
			sourceTitle:
				"Exclusive: Cloud provider hid 2023 breach from regulators",
			sourcePublisher: "MIT Technology Review",
			publicationTimestamp: "2025-01-15T06:00:00Z",
			firstDisclosureTimestamp: "2025-01-15T06:00:00Z",
			supportingEvidence: [
				createMockEvidence({
					sourceId: "technologyreview.com",
					extractedText:
						"According to internal documents and three former employees, the breach occurred in March 2023 but was not disclosed. The company notified regulators only after our inquiry.",
					timestampType: "first-public-disclosure",
					evidenceRole: "primary",
				}),
				createMockEvidence({
					sourceId: "technologyreview.com",
					extractedText:
						'Documents dated March 15, 2023 show the security team identified the breach. Internal memo: "Do not disclose externally until legal review complete."',
					timestamp: "2023-03-15T00:00:00Z",
					timestampType: "underlying-event",
					evidenceRole: "corroborating",
				}),
			],
		});

		const result = await verifyClaim(input);

		expect(result.evidenceClassification).toBe("ORIGINAL_REPORTING");
		expect(result.verificationStatus).toBe("verified");
		expect(result.temporalVerification.firstPublicDisclosureTimestamp).toBe(
			"2025-01-15T06:00:00Z",
		);
		expect(result.temporalVerification.underlyingEventTimestamp).toContain(
			"2023",
		);
		expect(
			result.unresolvedUncertainties.some((u) => u.type === "temporal"),
		).toBe(true);
	});

	// Case 6: Claim with contradictory or insufficient evidence
	it("handles claim with contradictory evidence from independent replication failure", async () => {
		const input = createMockInput({
			claim: "New optimization reduces inference latency by 90%",
			claimType: "benchmark-result",
			sourceId: "vendor-benchmark",
			sourceUrl: "https://vendor.com/blog/90-percent-latency-reduction",
			sourceTitle:
				"Revolutionary optimization achieves 90% latency reduction",
			sourcePublisher: "AI Vendor Corp",
			supportingEvidence: [
				createMockEvidence({
					sourceId: "vendor-benchmark",
					extractedText:
						"Our new kernel optimization reduces inference latency by 90% on H100. Tested with batch size 1, FP8 precision.",
					evidenceRole: "primary",
				}),
				createMockEvidence({
					sourceId: "independent-lab",
					extractedText:
						"Independent reproduction attempt: achieved 35% reduction on same hardware. 90% claim not reproduced. Vendor used custom kernel not publicly available.",
					evidenceRole: "counterevidence",
				}),
			],
		});

		const result = await verifyClaim(input);

		expect(result.counterevidence.length).toBe(1);
		expect(result.counterevidence[0].contradictionType).toBe("direct");
		expect(result.verificationStatus).toBe("contradicted");
		expect(result.evidenceClassification).toBe("VENDOR_CLAIM");
		expect(
			result.unresolvedUncertainties.some((u) =>
				u.uncertainty.includes("counterevidence"),
			),
		).toBe(true);
		expect(
			result.falsificationCriteria.some((f) =>
				f.criterion.includes("reproduction"),
			),
		).toBe(true);
	});
});
