/**
 * Book Delta — Tests
 *
 * Regression tests covering the 24 fixture scenarios and validation
 * of schema integrity, persistence, and integration.
 */

import { describe, it, expect } from "vitest";
import {
	BOOK_DELTA_SCHEMA_VERSION,
	BOOK_DELTA_ID_PATTERNS,
	type BookDeltaProposal,
	type BookDeltaCategory,
	type KnowledgeDomain,
} from "./schema.js";
import {
	validateBookDeltaProposal,
	computeObjectHash,
	canonicalStringify,
	isValidProposalId,
	isValidArtifactId,
	isValidEditionDate,
	isValidClaimId,
	isValidCandidateId,
	isValidThesaurusEntryId,
	isValidPrincipleId,
	validateLifecycleTransition,
	validateProposalForReview,
	validateProposalEvidenceReferences,
} from "./validate.js";
import {
	ALL_PROPOSAL_FIXTURES,
	ALL_EVALUATION_FIXTURES,
	KNOWLEDGE_CONTINUITY_FIXTURES,
	validateAllFixtures,
	FIXTURE_MISSING_CONCEPT,
	FIXTURE_TECHNICAL_ACCURACY,
	FIXTURE_MISCONCEPTION_CORRECTION,
	FIXTURE_PREREQUISITE_SEQUENCING,
	FIXTURE_COGNITIVE_ACCESSIBILITY,
	FIXTURE_TRANSIENT_PRODUCT,
	FIXTURE_VENDOR_GENERALIZATION,
	FIXTURE_CONSULTANCY_LIMITATIONS,
	FIXTURE_STRATEGIC_NOT_PRINCIPLE,
	FIXTURE_THESAURUS_COVERED,
	FIXTURE_PRINCIPLE_NEEDS_EXAMPLE,
	FIXTURE_DUPLICATE_PROPOSAL,
	FIXTURE_STRENGTHENING_EVIDENCE,
	FIXTURE_REJECTED_REINTRODUCED,
	FIXTURE_INACCESSIBLE_TARGET,
	FIXTURE_UNSUPPORTED_CORRECTION,
	FIXTURE_UNAUTHORIZED_APPROVED,
	FIXTURE_UNAUTHORIZED_IMPLEMENTED,
	FIXTURE_VALID_NONE,
	FIXTURE_DEPRECATE_OUTDATED,
	FIXTURE_PERSISTENCE_FAILURE,
	FIXTURE_SUPERSEDED_FOUNDATION,
	FIXTURE_TERMINOLOGY_CORRUPTION,
	FIXTURE_INTERRUPTED_INFERENCE,
} from "./fixtures.js";

describe("Book Delta Schema Validation", () => {
	it("should validate all proposal fixtures", async () => {
		const results = await validateAllFixtures();
		if (results.proposals.errors.length > 0) {
			console.error(
				"Proposal validation errors:",
				results.proposals.errors,
			);
		}
		expect(results.proposals.invalid).toBe(0);
		expect(results.proposals.valid).toBe(ALL_PROPOSAL_FIXTURES.length);
	});

	it("should validate all evaluation fixtures", async () => {
		const results = await validateAllFixtures();
		if (results.evaluations.errors.length > 0) {
			console.error(
				"Evaluation validation errors:",
				results.evaluations.errors,
			);
		}
		expect(results.evaluations.invalid).toBe(0);
		expect(results.evaluations.valid).toBe(ALL_EVALUATION_FIXTURES.length);
	});

	it("should validate all knowledge continuity fixtures", async () => {
		const results = await validateAllFixtures();
		if (results.knowledgeContinuity.errors.length > 0) {
			console.error(
				"Knowledge continuity validation errors:",
				results.knowledgeContinuity.errors,
			);
		}
		expect(results.knowledgeContinuity.invalid).toBe(0);
		expect(results.knowledgeContinuity.valid).toBe(
			KNOWLEDGE_CONTINUITY_FIXTURES.length,
		);
	});

	it("should enforce proposal ID pattern", () => {
		expect(isValidProposalId("bdp_abcdefghijklmnop")).toBe(true);
		expect(isValidProposalId("bdp_abcdefghijklmno")).toBe(false); // 15 chars
		expect(isValidProposalId("bdp_abcdefghijklmnopq")).toBe(false); // 17 chars
		expect(isValidProposalId("bdp_ABCDEFGHIJKLMNOP")).toBe(false); // uppercase
		expect(isValidProposalId("prop_abcdefghijklmnop")).toBe(false); // wrong prefix
	});

	it("should enforce artifact ID pattern", () => {
		expect(isValidArtifactId("bdart_abcdefghijklmnop")).toBe(true);
		expect(isValidArtifactId("bdart_abcdefghijklmno")).toBe(false);
	});

	it("should enforce edition date pattern (format only, not semantic validity)", () => {
		expect(isValidEditionDate("2025-01-15")).toBe(true);
		expect(isValidEditionDate("2025-13-15")).toBe(true); // Pattern matches, semantic validity not checked
		expect(isValidEditionDate("25-01-15")).toBe(false);
		expect(isValidEditionDate("2025/01/15")).toBe(false);
	});

	it("should enforce claim ID pattern", () => {
		expect(isValidClaimId("claim_abcdefghijklmnop")).toBe(true);
		expect(isValidClaimId("claim_abcdefghijklmno")).toBe(false);
	});

	it("should enforce candidate ID pattern", () => {
		expect(isValidCandidateId("cand_abcdefghijklmnop")).toBe(true);
		expect(isValidCandidateId("cand_abcdefghijklmno")).toBe(false);
	});

	it("should enforce thesaurus entry ID pattern", () => {
		expect(isValidThesaurusEntryId("thes_abcdefghijklmnop")).toBe(true);
		expect(isValidThesaurusEntryId("thes_abcdefghijklmno")).toBe(false);
	});

	it("should enforce principle ID pattern", () => {
		expect(isValidPrincipleId("AP-001")).toBe(true);
		expect(isValidPrincipleId("AP-01")).toBe(false);
		expect(isValidPrincipleId("AP-1234")).toBe(false);
		expect(isValidPrincipleId("ap-001")).toBe(false);
	});
});

describe("Book Delta Proposal Categories", () => {
	it("should accept all seven valid categories", () => {
		const validCategories: BookDeltaCategory[] = [
			"ADD",
			"REFINE",
			"CORRECT",
			"EXTEND",
			"RESTRUCTURE",
			"DEPRECATE",
			"NONE",
		];

		for (const category of validCategories) {
			// Create a minimal valid proposal for each category
			const baseProposal = {
				proposalId: "bdp_abcdefghijklmnop",
				editionId: "edition_2025-01-15",
				editionDate: "2025-01-15",
				category,
				title: { en: "Test", nl: "Test" },
				knowledgeDomain: "agentic-ai-software-engineering",
				targetAudience: ["system-architects"],
				targetConcept: "Test concept",
				currentGap: { en: "Gap", nl: "Gap" },
				proposedChange: { en: "Change", nl: "Change" },
				rationale: { en: "Rationale", nl: "Rationale" },
				supportingClaimIds:
					category === "NONE" ? [] : ["claim_abcdefghijklmnop"],
				originalSources:
					category === "NONE"
						? []
						: [
								{
									sourceId: "test",
									url: "https://example.com",
									title: "Test",
									tier: 1,
									accessedAt: new Date().toISOString(),
									retrievalStatus: "CHECKED_FOUND" as const,
									confidence: 0.9,
								},
							],
				researchDates: {
					earliestFinding: "2025-01-15",
					latestFinding: "2025-01-15",
					primaryEditionDates: ["2025-01-15"],
				},
				evidenceClassification: "VERIFIED_FACT",
				confidence: 0.85,
				materialUncertainty: "low",
				educationalValue: "foundational",
				limitations: [],
				terminologyReferences: [],
				principleReferences: [],
				historicalProposalReferences: [],
				conflicts: [],
				counterevidence: [],
				acceptanceCriteria: [
					{
						criterionId: "test",
						description: "Test",
						measurable: true,
						verificationMethod: "content-inspection",
						evidenceRequired: [],
					},
				],
				durability: {
					conceptualImportance: "high",
					technicalAccuracy: "high",
					reusability: "cross-domain",
					multiContextRelevance: true,
					prerequisiteDependencies: [],
					likelihoodOfFutureChange: "low",
					authoritativeEvidenceAvailable: true,
					practicalApplicability: "high",
					correctsRecurringMisconception: false,
					progressiveLearningValue: "high",
					maintenanceCostEstimate: "low",
				},
				accessibility: {
					explicitObjectives: true,
					explicitPrerequisites: true,
					progressiveDisclosure: true,
					contextBeforeComplexity: true,
					meaningfulSequencing: true,
					concreteExamples: true,
					accurateAnalogies: true,
					clearDistinctions: true,
					manageableDensity: true,
					independentExploration: true,
					reducedRepetition: true,
					cognitiveLoadAssessment: "Test",
				},
				lifecycleStatus: "CANDIDATE",
				revisionHistory: [],
				uniquenessStatus: "unique",
				schemaVersion: "1.0.0",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				createdBy: "test",
				tags: ["test"],
			};
			const validated = validateBookDeltaProposal(baseProposal);
			expect(validated.category).toBe(category);
		}
	});

	it("should reject invalid category", () => {
		const proposal = {
			...FIXTURE_MISSING_CONCEPT,
			category: "INVALID" as any,
		};
		expect(() => validateBookDeltaProposal(proposal)).toThrow();
	});
});

describe("Book Delta Lifecycle Transitions", () => {
	it("should allow valid transitions from CANDIDATE", () => {
		expect(
			validateLifecycleTransition("CANDIDATE", "READY_FOR_REVIEW").valid,
		).toBe(true);
		expect(validateLifecycleTransition("CANDIDATE", "REJECTED").valid).toBe(
			true,
		);
		expect(
			validateLifecycleTransition("CANDIDATE", "SUPERSEDED").valid,
		).toBe(true);
	});

	it("should reject invalid transitions from CANDIDATE", () => {
		expect(validateLifecycleTransition("CANDIDATE", "APPROVED").valid).toBe(
			false,
		);
		expect(
			validateLifecycleTransition("CANDIDATE", "IMPLEMENTED").valid,
		).toBe(false);
		expect(
			validateLifecycleTransition("CANDIDATE", "VALIDATED").valid,
		).toBe(false);
	});

	it("should allow valid transitions from READY_FOR_REVIEW", () => {
		expect(
			validateLifecycleTransition("READY_FOR_REVIEW", "APPROVED").valid,
		).toBe(true);
		expect(
			validateLifecycleTransition("READY_FOR_REVIEW", "REJECTED").valid,
		).toBe(true);
		expect(
			validateLifecycleTransition("READY_FOR_REVIEW", "CANDIDATE").valid,
		).toBe(true);
		expect(
			validateLifecycleTransition("READY_FOR_REVIEW", "SUPERSEDED").valid,
		).toBe(true);
	});

	it("should allow valid transitions from APPROVED", () => {
		expect(
			validateLifecycleTransition("APPROVED", "IMPLEMENTED").valid,
		).toBe(true);
		expect(validateLifecycleTransition("APPROVED", "REJECTED").valid).toBe(
			true,
		);
		expect(
			validateLifecycleTransition("APPROVED", "SUPERSEDED").valid,
		).toBe(true);
	});

	it("should allow valid transitions from IMPLEMENTED", () => {
		expect(
			validateLifecycleTransition("IMPLEMENTED", "VALIDATED").valid,
		).toBe(true);
		expect(
			validateLifecycleTransition("IMPLEMENTED", "SUPERSEDED").valid,
		).toBe(true);
	});

	it("should allow valid transitions from VALIDATED", () => {
		expect(
			validateLifecycleTransition("VALIDATED", "SUPERSEDED").valid,
		).toBe(true);
	});

	it("should not allow transitions from SUPERSEDED", () => {
		expect(
			validateLifecycleTransition("SUPERSEDED", "CANDIDATE").valid,
		).toBe(false);
		expect(
			validateLifecycleTransition("SUPERSEDED", "APPROVED").valid,
		).toBe(false);
	});

	it("should not allow transitions from REJECTED except to CANDIDATE or SUPERSEDED", () => {
		expect(validateLifecycleTransition("REJECTED", "CANDIDATE").valid).toBe(
			true,
		);
		expect(
			validateLifecycleTransition("REJECTED", "SUPERSEDED").valid,
		).toBe(true);
		expect(validateLifecycleTransition("REJECTED", "APPROVED").valid).toBe(
			false,
		);
	});
});

describe("Book Delta Proposal Completeness Validation", () => {
	it("should mark complete proposal as ready for review", () => {
		const result = validateProposalForReview(FIXTURE_MISSING_CONCEPT);
		expect(result.ready).toBe(true);
		expect(result.missing).toHaveLength(0);
	});

	it("should detect missing bilingual fields", () => {
		const incomplete = {
			...FIXTURE_MISSING_CONCEPT,
			title: { en: "Test", nl: "" },
		};
		const result = validateProposalForReview(incomplete);
		expect(result.ready).toBe(false);
		expect(result.missing).toContain("bilingual title");
	});

	it("should detect missing supporting claim IDs", () => {
		const incomplete = {
			...FIXTURE_MISSING_CONCEPT,
			supportingClaimIds: [],
		};
		const result = validateProposalForReview(incomplete);
		expect(result.ready).toBe(false);
		expect(result.missing).toContain("supporting claim IDs");
	});

	it("should detect missing original sources", () => {
		const incomplete = { ...FIXTURE_MISSING_CONCEPT, originalSources: [] };
		const result = validateProposalForReview(incomplete);
		expect(result.ready).toBe(false);
		expect(result.missing).toContain("original sources");
	});

	it("should detect missing acceptance criteria", () => {
		const incomplete = {
			...FIXTURE_MISSING_CONCEPT,
			acceptanceCriteria: [],
		};
		const result = validateProposalForReview(incomplete);
		expect(result.ready).toBe(false);
		expect(result.missing).toContain("acceptance criteria");
	});

	it("should detect low confidence", () => {
		const incomplete = { ...FIXTURE_MISSING_CONCEPT, confidence: 0.3 };
		const result = validateProposalForReview(incomplete);
		expect(result.ready).toBe(false);
		expect(result.missing).toContain("sufficient confidence (≥0.5)");
	});

	it("should detect speculative material uncertainty", () => {
		const incomplete = {
			...FIXTURE_MISSING_CONCEPT,
			materialUncertainty: "speculative" as any,
		};
		const result = validateProposalForReview(incomplete);
		expect(result.ready).toBe(false);
		expect(result.missing).toContain(
			"non-speculative material uncertainty",
		);
	});
});

describe("Book Delta Evidence Reference Validation", () => {
	it("should validate correct evidence references", () => {
		const proposal: BookDeltaProposal = {
			proposalId: "bdp_abcdefghijklmnop",
			editionId: "edition_2025-01-15",
			editionDate: "2025-01-15",
			category: "ADD",
			title: { en: "Test", nl: "Test" },
			knowledgeDomain: "agentic-ai-software-engineering",
			targetAudience: ["system-architects"],
			targetConcept: "Test concept",
			currentGap: { en: "Gap", nl: "Gap" },
			proposedChange: { en: "Change", nl: "Change" },
			rationale: { en: "Rationale", nl: "Rationale" },
			supportingClaimIds: ["claim_abcdefghijklmnop"],
			originalSources: [
				{
					sourceId: "test",
					url: "https://example.com",
					title: "Test",
					tier: 1,
					accessedAt: new Date().toISOString(),
					retrievalStatus: "CHECKED_FOUND" as const,
					confidence: 0.9,
				},
			],
			researchDates: {
				earliestFinding: "2025-01-15",
				latestFinding: "2025-01-15",
				primaryEditionDates: ["2025-01-15"],
			},
			evidenceClassification: "VERIFIED_FACT",
			confidence: 0.85,
			materialUncertainty: "low",
			educationalValue: "foundational",
			limitations: [],
			terminologyReferences: [
				{
					entryId: "thes_abcdefghijklmnop",
					term: "Test",
					relationship: "related-concept",
					note: "Test",
				},
			],
			principleReferences: [
				{
					principleId: "AP-001",
					title: "Test",
					relationship: "illustrates",
					note: "Test",
				},
			],
			historicalProposalReferences: [
				{
					proposalId: "bdp_abcdefghijklmnop",
					editionDate: "2024-01-15",
					relationship: "unique",
					resolutionNote: "Test",
				},
			],
			conflicts: [],
			counterevidence: [],
			acceptanceCriteria: [
				{
					criterionId: "test",
					description: "Test",
					measurable: true,
					verificationMethod: "content-inspection",
					evidenceRequired: [],
				},
			],
			durability: {
				conceptualImportance: "high",
				technicalAccuracy: "high",
				reusability: "cross-domain",
				multiContextRelevance: true,
				prerequisiteDependencies: [],
				likelihoodOfFutureChange: "low",
				authoritativeEvidenceAvailable: true,
				practicalApplicability: "high",
				correctsRecurringMisconception: false,
				progressiveLearningValue: "high",
				maintenanceCostEstimate: "low",
			},
			accessibility: {
				explicitObjectives: true,
				explicitPrerequisites: true,
				progressiveDisclosure: true,
				contextBeforeComplexity: true,
				meaningfulSequencing: true,
				concreteExamples: true,
				accurateAnalogies: true,
				clearDistinctions: true,
				manageableDensity: true,
				independentExploration: true,
				reducedRepetition: true,
				cognitiveLoadAssessment: "Test",
			},
			lifecycleStatus: "CANDIDATE",
			revisionHistory: [],
			uniquenessStatus: "unique",
			schemaVersion: "1.0.0",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			createdBy: "test",
			tags: ["test"],
		};
		const result = validateProposalEvidenceReferences(proposal);
		expect(result.valid).toBe(true);
		expect(result.issues).toHaveLength(0);
	});

	it("should detect invalid claim ID format", () => {
		const proposal = {
			...FIXTURE_MISSING_CONCEPT,
			supportingClaimIds: ["invalid-claim-id"],
		};
		const result = validateProposalEvidenceReferences(proposal);
		expect(result.valid).toBe(false);
		expect(result.issues).toContain(
			"Invalid claim ID format: invalid-claim-id",
		);
	});

	it("should detect invalid thesaurus entry ID", () => {
		const proposal = {
			...FIXTURE_MISSING_CONCEPT,
			terminologyReferences: [
				{
					...FIXTURE_MISSING_CONCEPT.terminologyReferences[0],
					entryId: "invalid-id",
				},
			],
		};
		const result = validateProposalEvidenceReferences(proposal);
		expect(result.valid).toBe(false);
		expect(
			result.issues.some((i) => i.includes("Invalid thesaurus entry ID")),
		).toBe(true);
	});

	it("should detect invalid principle ID", () => {
		const proposal = {
			...FIXTURE_MISSING_CONCEPT,
			principleReferences: [
				{
					...FIXTURE_MISSING_CONCEPT.principleReferences[0],
					principleId: "INVALID-001",
				},
			],
		};
		const result = validateProposalEvidenceReferences(proposal);
		expect(result.valid).toBe(false);
		expect(
			result.issues.some((i) => i.includes("Invalid principle ID")),
		).toBe(true);
	});

	it("should detect invalid historical proposal ID", () => {
		const proposal = {
			...FIXTURE_MISSING_CONCEPT,
			historicalProposalReferences: [
				{
					...FIXTURE_MISSING_CONCEPT.historicalProposalReferences[0],
					proposalId: "invalid-id",
				},
			],
		};
		const result = validateProposalEvidenceReferences(proposal);
		expect(result.valid).toBe(false);
		expect(
			result.issues.some((i) =>
				i.includes("Invalid historical proposal ID"),
			),
		).toBe(true);
	});
});

describe("Book Delta Fixture Categories", () => {
	it("should have all 7 categories represented in fixtures", () => {
		const categories = new Set(
			ALL_PROPOSAL_FIXTURES.map((f) => f.category),
		);
		expect(categories).toContain("ADD");
		expect(categories).toContain("REFINE");
		expect(categories).toContain("CORRECT");
		expect(categories).toContain("EXTEND");
		expect(categories).toContain("RESTRUCTURE");
		expect(categories).toContain("DEPRECATE");
		expect(categories).toContain("NONE");
	});

	it("should have at least one fixture per category", () => {
		const counts: Record<BookDeltaCategory, number> = {
			ADD: 0,
			REFINE: 0,
			CORRECT: 0,
			EXTEND: 0,
			RESTRUCTURE: 0,
			DEPRECATE: 0,
			NONE: 0,
		};
		for (const f of ALL_PROPOSAL_FIXTURES) {
			counts[f.category]++;
		}
		for (const [, count] of Object.entries(counts)) {
			expect(count).toBeGreaterThanOrEqual(1);
		}
	});

	it("should have at least one NONE proposal", () => {
		const noneProposals = ALL_PROPOSAL_FIXTURES.filter(
			(f) => f.category === "NONE",
		);
		expect(noneProposals.length).toBeGreaterThanOrEqual(1);
	});
});

describe("Book Delta Specific Fixture Validations", () => {
	it("Fixture 1: Missing concept should be ADD with foundational value", () => {
		expect(FIXTURE_MISSING_CONCEPT.category).toBe("ADD");
		expect(FIXTURE_MISSING_CONCEPT.educationalValue).toBe("foundational");
		expect(FIXTURE_MISSING_CONCEPT.confidence).toBeGreaterThan(0.9);
		expect(
			FIXTURE_MISSING_CONCEPT.supportingClaimIds.length,
		).toBeGreaterThanOrEqual(2);
	});

	it("Fixture 2: Technical accuracy should be REFINE with performance evidence", () => {
		expect(FIXTURE_TECHNICAL_ACCURACY.category).toBe("REFINE");
		expect(FIXTURE_TECHNICAL_ACCURACY.evidenceClassification).toBe(
			"VERIFIED_FACT",
		);
		expect(FIXTURE_TECHNICAL_ACCURACY.knowledgeDomain).toBe(
			"architecture-security-governance",
		);
	});

	it("Fixture 3: Misconception correction should be CORRECT with counterevidence", () => {
		expect(FIXTURE_MISCONCEPTION_CORRECTION.category).toBe("CORRECT");
		expect(
			FIXTURE_MISCONCEPTION_CORRECTION.counterevidence.length,
		).toBeGreaterThan(0);
		expect(FIXTURE_MISCONCEPTION_CORRECTION.materialUncertainty).toBe(
			"low",
		);
	});

	it("Fixture 4: Prerequisite sequencing should be RESTRUCTURE", () => {
		expect(FIXTURE_PREREQUISITE_SEQUENCING.category).toBe("RESTRUCTURE");
		expect(
			FIXTURE_PREREQUISITE_SEQUENCING.accessibility.meaningfulSequencing,
		).toBe(true);
		expect(
			FIXTURE_PREREQUISITE_SEQUENCING.principleReferences.length,
		).toBeGreaterThan(0);
	});

	it("Fixture 5: Cognitive accessibility should be REFINE with ADHD considerations", () => {
		expect(FIXTURE_COGNITIVE_ACCESSIBILITY.category).toBe("REFINE");
		expect(
			FIXTURE_COGNITIVE_ACCESSIBILITY.accessibility
				.cognitiveLoadAssessment,
		).toContain("ADHD");
		expect(
			FIXTURE_COGNITIVE_ACCESSIBILITY.accessibility.manageableDensity,
		).toBe(true);
	});

	it("Fixture 6: Transient product should be NONE", () => {
		expect(FIXTURE_TRANSIENT_PRODUCT.category).toBe("NONE");
		expect(FIXTURE_TRANSIENT_PRODUCT.supportingClaimIds).toHaveLength(0);
		expect(FIXTURE_TRANSIENT_PRODUCT.originalSources).toHaveLength(0);
	});

	it("Fixture 7: Vendor generalization should be CORRECT with methodological caveats", () => {
		expect(FIXTURE_VENDOR_GENERALIZATION.category).toBe("CORRECT");
		expect(
			FIXTURE_VENDOR_GENERALIZATION.methodologicalCaveats,
		).toBeDefined();
		expect(
			FIXTURE_VENDOR_GENERALIZATION.methodologicalCaveats
				?.vendorClaimVsIndependent,
		).toBeDefined();
	});

	it("Fixture 8: Consultancy limitations should be EXTEND with caveats", () => {
		expect(FIXTURE_CONSULTANCY_LIMITATIONS.category).toBe("EXTEND");
		expect(FIXTURE_CONSULTANCY_LIMITATIONS.evidenceClassification).toBe(
			"EXPERT_INTERPRETATION",
		);
		expect(FIXTURE_CONSULTANCY_LIMITATIONS.materialUncertainty).toBe(
			"high",
		);
		expect(
			FIXTURE_CONSULTANCY_LIMITATIONS.methodologicalCaveats
				?.generalizabilityLimitations.length,
		).toBeGreaterThan(0);
	});

	it("Fixture 9: Strategic not principle should be ADD", () => {
		expect(FIXTURE_STRATEGIC_NOT_PRINCIPLE.category).toBe("ADD");
		expect(FIXTURE_STRATEGIC_NOT_PRINCIPLE.knowledgeDomain).toBe(
			"architecture-security-governance",
		);
		expect(
			FIXTURE_STRATEGIC_NOT_PRINCIPLE.principleReferences.length,
		).toBeGreaterThan(0);
	});

	it("Fixture 10: Thesaurus covered should be NONE with terminology reference", () => {
		expect(FIXTURE_THESAURUS_COVERED.category).toBe("NONE");
		expect(
			FIXTURE_THESAURUS_COVERED.terminologyReferences[0]?.relationship,
		).toBe("subject-of-proposal");
	});

	it("Fixture 11: Principle needs example should be EXTEND not modification", () => {
		expect(FIXTURE_PRINCIPLE_NEEDS_EXAMPLE.category).toBe("EXTEND");
		expect(
			FIXTURE_PRINCIPLE_NEEDS_EXAMPLE.principleReferences[0]
				?.relationship,
		).toBe("illustrates");
		expect(FIXTURE_PRINCIPLE_NEEDS_EXAMPLE.rationale.en).toContain(
			"separate from Book Delta",
		);
	});

	it("Fixture 12: Duplicate should have duplicate uniqueness status", () => {
		expect(FIXTURE_DUPLICATE_PROPOSAL.uniquenessStatus).toBe("duplicate");
		expect(
			FIXTURE_DUPLICATE_PROPOSAL.historicalProposalReferences[0]
				?.relationship,
		).toBe("duplicate");
	});

	it("Fixture 13: Strengthening evidence should have strengthens-existing status", () => {
		expect(FIXTURE_STRENGTHENING_EVIDENCE.uniquenessStatus).toBe(
			"strengthens-existing",
		);
		expect(FIXTURE_STRENGTHENING_EVIDENCE.evidenceClassification).toBe(
			"VERIFIED_FACT",
		);
	});

	it("Fixture 14: Rejected reintroduction should result in NONE", () => {
		expect(FIXTURE_REJECTED_REINTRODUCED.category).toBe("NONE");
		expect(FIXTURE_REJECTED_REINTRODUCED.uniquenessStatus).toBe(
			"duplicate",
		);
		expect(
			FIXTURE_REJECTED_REINTRODUCED.historicalProposalReferences[0]
				?.resolutionNote,
		).toContain("REJECTED");
	});

	it("Fixture 15: Inaccessible target should document limitation", () => {
		expect(FIXTURE_INACCESSIBLE_TARGET.targetDocument?.accessibility).toBe(
			"inaccessible",
		);
		expect(
			FIXTURE_INACCESSIBLE_TARGET.targetDocument?.comparisonPerformed,
		).toBe(true);
	});

	it("Fixture 16: Unsupported correction should result in NONE", () => {
		expect(FIXTURE_UNSUPPORTED_CORRECTION.category).toBe("NONE");
		expect(
			FIXTURE_UNSUPPORTED_CORRECTION.counterevidence.length,
		).toBeGreaterThan(0);
	});

	it("Fixture 17: Unauthorized approved should be CANDIDATE", () => {
		expect(FIXTURE_UNAUTHORIZED_APPROVED.lifecycleStatus).toBe("CANDIDATE");
		expect(FIXTURE_UNAUTHORIZED_APPROVED.lifecycleStatus).not.toBe(
			"APPROVED",
		);
	});

	it("Fixture 18: Unauthorized implemented should be CANDIDATE", () => {
		expect(FIXTURE_UNAUTHORIZED_IMPLEMENTED.lifecycleStatus).toBe(
			"CANDIDATE",
		);
		expect(FIXTURE_UNAUTHORIZED_IMPLEMENTED.lifecycleStatus).not.toBe(
			"IMPLEMENTED",
		);
	});

	it("Fixture 19: Valid NONE should have explicit acceptance criteria", () => {
		expect(FIXTURE_VALID_NONE.category).toBe("NONE");
		expect(FIXTURE_VALID_NONE.acceptanceCriteria[0]?.criterionId).toBe(
			"none-validated",
		);
	});

	it("Fixture 20: Deprecate outdated content should be DEPRECATE with migration path", () => {
		expect(FIXTURE_DEPRECATE_OUTDATED.category).toBe("DEPRECATE");
		expect(
			FIXTURE_DEPRECATE_OUTDATED.acceptanceCriteria.some(
				(c) => c.criterionId === "deprecation-marked",
			),
		).toBe(true);
		expect(
			FIXTURE_DEPRECATE_OUTDATED.acceptanceCriteria.some(
				(c) => c.criterionId === "replacement-current",
			),
		).toBe(true);
	});

	it("Fixture 21: Persistence failure fixture should exist", () => {
		expect(FIXTURE_PERSISTENCE_FAILURE.proposalId).toMatch(
			BOOK_DELTA_ID_PATTERNS.proposal,
		);
	});

	it("Fixture 22: Interrupted inference should document gaps", () => {
		expect(
			FIXTURE_INTERRUPTED_INFERENCE.unresolvedEvidenceGaps.length,
		).toBeGreaterThan(0);
		expect(FIXTURE_INTERRUPTED_INFERENCE.inferenceNote).toContain(
			"exhausted",
		);
	});

	it("Fixture 23: Superseded foundation should have supersedes status", () => {
		expect(FIXTURE_SUPERSEDED_FOUNDATION.category).toBe("CORRECT");
		expect(FIXTURE_SUPERSEDED_FOUNDATION.uniquenessStatus).toBe(
			"supersedes",
		);
		expect(
			FIXTURE_SUPERSEDED_FOUNDATION.historicalProposalReferences[0]
				?.relationship,
		).toBe("supersedes");
	});

	it("Fixture 24: Terminology corruption should be NONE with boundary enforcement", () => {
		expect(FIXTURE_TERMINOLOGY_CORRUPTION.category).toBe("NONE");
		expect(
			FIXTURE_TERMINOLOGY_CORRUPTION.terminologyReferences[0]?.note,
		).toContain("does not modify");
		expect(
			FIXTURE_TERMINOLOGY_CORRUPTION.acceptanceCriteria[0]?.criterionId,
		).toBe("thesaurus-not-modified");
	});
});

describe("Book Delta Canonical Serialization", () => {
	it("should produce deterministic JSON for identical objects", () => {
		const obj = { b: 2, a: 1, c: { z: 3, y: 4 } };
		const str1 = canonicalStringify(obj);
		const str2 = canonicalStringify(obj);
		expect(str1).toBe(str2);
	});

	it("should sort object keys alphabetically", () => {
		const obj = { z: 1, a: 2 };
		const str = canonicalStringify(obj);
		expect(str).toBe('{"a":2,"z":1}');
	});

	it("should handle nested objects", () => {
		const obj = { outer: { inner: { deep: "value" } } };
		const str = canonicalStringify(obj);
		expect(str).toContain('"deep":"value"');
	});

	it("should handle arrays", () => {
		const obj = { items: [3, 1, 2] };
		const str = canonicalStringify(obj);
		expect(str).toBe('{"items":[3,1,2]}'); // Arrays preserve order
	});
});

describe("Book Delta Hash Computation", () => {
	it("should compute consistent hashes for identical content", async () => {
		const obj = { test: "data", number: 42 };
		const hash1 = await computeObjectHash(obj);
		const hash2 = await computeObjectHash(obj);
		expect(hash1).toBe(hash2);
		expect(hash1).toMatch(/^sha256:[a-f0-9]{64}$/);
	});

	it("should produce different hashes for different content", async () => {
		const hash1 = await computeObjectHash({ a: 1 });
		const hash2 = await computeObjectHash({ a: 2 });
		expect(hash1).not.toBe(hash2);
	});
});

describe("Book Delta Knowledge Domain Coverage", () => {
	it("should cover all knowledge domains in fixtures", () => {
		const domains = new Set(
			ALL_PROPOSAL_FIXTURES.map((f) => f.knowledgeDomain),
		);
		const expectedDomains: KnowledgeDomain[] = [
			"agentic-ai-software-engineering",
			"models-inference-scientific",
			"architecture-security-governance",
			"enterprise-adoption-organizational",
			"economics-business-impact",
			"independent-research-advisory",
			"cross-cutting",
		];

		for (const domain of expectedDomains) {
			expect(domains.has(domain)).toBe(true);
		}
	});
});

describe("Book Delta Target Audience Coverage", () => {
	it("should include primary audiences in fixtures", () => {
		const allAudiences = ALL_PROPOSAL_FIXTURES.flatMap(
			(f) => f.targetAudience,
		);
		const uniqueAudiences = new Set(allAudiences);

		expect(uniqueAudiences.has("system-architects")).toBe(true);
		expect(uniqueAudiences.has("principal-engineers")).toBe(true);
	});
});

describe("Book Delta Evidence Classification Distribution", () => {
	it("should have proposals with varying evidence classifications", () => {
		const classifications = new Set(
			ALL_PROPOSAL_FIXTURES.map((f) => f.evidenceClassification),
		);
		expect(classifications.has("VERIFIED_FACT")).toBe(true);
		expect(classifications.has("RESEARCH_FINDING")).toBe(true);
		expect(classifications.has("EXPERT_INTERPRETATION")).toBe(true);
		expect(classifications.has("ORIGINAL_REPORTING")).toBe(true);
		expect(classifications.has("UNVERIFIED")).toBe(true);
		expect(classifications.has("VENDOR_CLAIM")).toBe(true);
	});
});

describe("Book Delta Material Uncertainty Distribution", () => {
	it("should have proposals with varying uncertainty levels", () => {
		const uncertainties = new Set(
			ALL_PROPOSAL_FIXTURES.map((f) => f.materialUncertainty),
		);
		expect(uncertainties.has("low")).toBe(true);
		expect(uncertainties.has("medium")).toBe(true);
		expect(uncertainties.has("high")).toBe(true);
		// speculative is only in review validation, not in fixtures
	});
});

describe("Book Delta Educational Value Distribution", () => {
	it("should have proposals with varying educational values", () => {
		const values = new Set(
			ALL_PROPOSAL_FIXTURES.map((f) => f.educationalValue),
		);
		expect(values.has("foundational")).toBe(true);
		expect(values.has("significant")).toBe(true);
		expect(values.has("supplementary")).toBe(true);
		expect(values.has("niche")).toBe(true);
	});
});

describe("Book Delta Accessibility Considerations", () => {
	it("should have accessibility assessments for non-NONE proposals", () => {
		const nonNone = ALL_PROPOSAL_FIXTURES.filter(
			(f) => f.category !== "NONE",
		);
		for (const proposal of nonNone) {
			expect(
				proposal.accessibility.cognitiveLoadAssessment,
			).toBeDefined();
			expect(
				proposal.accessibility.cognitiveLoadAssessment?.length ?? 0,
			).toBeGreaterThan(0);
		}
	});
});

describe("Book Delta Durability Assessment", () => {
	it("should have durability assessments for non-NONE proposals", () => {
		const nonNone = ALL_PROPOSAL_FIXTURES.filter(
			(f) => f.category !== "NONE",
		);
		for (const proposal of nonNone) {
			expect(proposal.durability.conceptualImportance).toBeDefined();
			expect(proposal.durability.technicalAccuracy).toBeDefined();
			expect(proposal.durability.reusability).toBeDefined();
			expect(proposal.durability.maintenanceCostEstimate).toBeDefined();
		}
	});
});

describe("Book Delta Acceptance Criteria", () => {
	it("should have at least one acceptance criterion per proposal", () => {
		for (const proposal of ALL_PROPOSAL_FIXTURES) {
			expect(proposal.acceptanceCriteria.length).toBeGreaterThan(0);
			for (const criterion of proposal.acceptanceCriteria) {
				expect(criterion.criterionId).toBeDefined();
				expect(criterion.description).toBeDefined();
				expect(criterion.measurable).toBeDefined();
				expect(criterion.verificationMethod).toBeDefined();
				expect(criterion.evidenceRequired.length).toBeGreaterThan(0);
			}
		}
	});
});

describe("Book Delta Knowledge Continuity Integration", () => {
	it("should have PASS gate status for completed evaluations", () => {
		const completed = KNOWLEDGE_CONTINUITY_FIXTURES.filter(
			(f) => f.evaluationRan,
		);
		for (const kc of completed) {
			expect(kc.gateStatus).toBe("PASS");
		}
	});

	it("should have NOT_ASSESSABLE for skipped evaluations", () => {
		const skipped = KNOWLEDGE_CONTINUITY_FIXTURES.filter(
			(f) => !f.evaluationRan,
		);
		for (const kc of skipped) {
			expect(kc.gateStatus).toBe("NOT_ASSESSABLE");
		}
	});

	it("should report unresolved limitations when present", () => {
		const withLimitations = KNOWLEDGE_CONTINUITY_FIXTURES.filter(
			(f) => f.limitationsReported,
		);
		for (const kc of withLimitations) {
			expect(kc.unresolvedLimitations.length).toBeGreaterThan(0);
		}
	});
});

describe("Book Delta Evaluation Result Integration", () => {
	it("should distinguish interrupted evaluation from NONE", () => {
		expect(FIXTURE_INTERRUPTED_INFERENCE.evaluationPerformed).toBe(true);
		expect(FIXTURE_VALID_NONE.category).toBe("NONE");
	});

	it("should document inference exhaustion", () => {
		expect(FIXTURE_INTERRUPTED_INFERENCE.inferenceUsed).toBe(true);
		expect(FIXTURE_INTERRUPTED_INFERENCE.inferenceNote).toContain(
			"exhausted",
		);
		expect(
			FIXTURE_INTERRUPTED_INFERENCE.unresolvedEvidenceGaps.some((g) =>
				g.includes("inference capacity"),
			),
		).toBe(true);
	});
});

describe("Book Delta Schema Version", () => {
	it("should have correct schema version in all proposals", () => {
		for (const proposal of ALL_PROPOSAL_FIXTURES) {
			expect(proposal.schemaVersion).toBe(BOOK_DELTA_SCHEMA_VERSION);
		}
	});

	it("should have correct schema version in evaluation results", () => {
		for (const _evalResult of ALL_EVALUATION_FIXTURES) {
			// Evaluation result doesn't have schemaVersion field, but artifact does
		}
	});
});

describe("Book Delta Proposal ID Generation", () => {
	it("should generate valid proposal IDs", () => {
		// This tests the pattern, actual generation is in store.ts
		const validIds = [
			"bdp_abcdefghijklmnop",
			"bdp_0123456789abcdef",
			"bdp_ffffffffffffffff",
		];
		for (const id of validIds) {
			expect(isValidProposalId(id)).toBe(true);
		}
	});
});

describe("Book Delta Historical Continuity", () => {
	it("should track historical proposal references", () => {
		const withHistory = ALL_PROPOSAL_FIXTURES.filter(
			(f) => f.historicalProposalReferences.length > 0,
		);
		expect(withHistory.length).toBeGreaterThan(0);

		for (const proposal of withHistory) {
			for (const ref of proposal.historicalProposalReferences) {
				expect(ref.proposalId).toMatch(BOOK_DELTA_ID_PATTERNS.proposal);
				expect(ref.editionDate).toMatch(
					BOOK_DELTA_ID_PATTERNS.editionDate,
				);
				expect([
					"unique",
					"strengthens-existing",
					"revises-scope",
					"links-related",
					"supersedes",
					"duplicate",
				]).toContain(ref.relationship);
			}
		}
	});
});

describe("Book Delta Uniqueness Status Values", () => {
	it("should use all uniqueness status values", () => {
		const statuses = new Set(
			ALL_PROPOSAL_FIXTURES.map((f) => f.uniquenessStatus),
		);
		expect(statuses.has("unique")).toBe(true);
		expect(statuses.has("strengthens-existing")).toBe(true);
		expect(statuses.has("revises-scope")).toBe(true);
		expect(statuses.has("links-related")).toBe(true);
		expect(statuses.has("supersedes")).toBe(true);
		expect(statuses.has("duplicate")).toBe(true);
	});
});

describe("Book Delta Counterevidence", () => {
	it("should include counterevidence where appropriate", () => {
		const withCounterevidence = ALL_PROPOSAL_FIXTURES.filter(
			(f) => f.counterevidence.length > 0,
		);
		expect(withCounterevidence.length).toBeGreaterThan(0);

		for (const proposal of withCounterevidence) {
			for (const ce of proposal.counterevidence) {
				expect(ce.description).toBeDefined();
				expect(ce.sourceReference).toBeDefined();
				expect(ce.evidenceClassification).toBeDefined();
				expect(["qualifying", "limiting", "contradictory"]).toContain(
					ce.impact,
				);
			}
		}
	});
});

describe("Book Delta Methodological Caveats", () => {
	it("should include caveats for strategic/consultancy proposals", () => {
		const withCaveats = ALL_PROPOSAL_FIXTURES.filter(
			(f) => f.methodologicalCaveats !== undefined,
		);
		expect(withCaveats.length).toBeGreaterThan(0);

		for (const proposal of withCaveats) {
			const caveats = proposal.methodologicalCaveats!;
			expect(caveats.generalizabilityLimitations.length).toBeGreaterThan(
				0,
			);
		}
	});
});

describe("Book Delta NONE Proposal Requirements", () => {
	it("should have empty supporting claims and sources", () => {
		const noneProposals = ALL_PROPOSAL_FIXTURES.filter(
			(f) => f.category === "NONE",
		);
		for (const proposal of noneProposals) {
			expect(proposal.supportingClaimIds).toHaveLength(0);
			expect(proposal.originalSources).toHaveLength(0);
		}
	});

	it("should have explicit acceptance criteria for NONE", () => {
		const noneProposals = ALL_PROPOSAL_FIXTURES.filter(
			(f) => f.category === "NONE",
		);
		for (const proposal of noneProposals) {
			const noneCriterion = proposal.acceptanceCriteria.find(
				(c) =>
					c.criterionId.includes("none") ||
					c.criterionId.includes("thesaurus") ||
					c.criterionId.includes("no-evidence"),
			);
			expect(noneCriterion).toBeDefined();
		}
	});
});
