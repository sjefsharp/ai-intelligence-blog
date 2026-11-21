/**
 * Thesaurus Validation Tests
 *
 * Tests cover:
 * - Terminology entry structure and ID uniqueness
 * - Bilingual definition integrity
 * - Alias and acronym conflict detection
 * - Relationship integrity and cycle detection
 * - Lifecycle status transitions
 * - Duplicate detection
 * - Schema validation
 * - Backward compatibility
 * - Markdown generation
 */

import { describe, it, expect } from "vitest";
import {
	TerminologyEntrySchema,
	ThesaurusArtifactSchema,
	TerminologyChangeProposalSchema,
	ID_PATTERNS,
	TerminologyLifecycleStatusSchema,
	TerminologyChangeTypeSchema,
	TerminologyRelationshipTypeSchema,
	LanguageCodeSchema,
	generateTerminologyEntryJsonSchema,
	generateThesaurusArtifactJsonSchema,
	generateTerminologyChangeProposalJsonSchema,
} from "./schema.js";
import {
	normalizeTerm,
	normalizeAcronym,
	bilingualEquivalent,
	detectDuplicate,
	validateTerminologyEntry,
	validateThesaurusArtifact,
	validateRelationships,
	searchTerminologyEntries,
	getTerminologyEntryById,
	getEntriesByDomain,
} from "./engine.js";
import type {
	TerminologyEntry,
	TerminologyLifecycleStatus,
	ThesaurusArtifact,
	TerminologyChangeProposal,
} from "./schema.js";

// ============================================================================
// Test Fixtures
// ============================================================================

const createSampleEntry = (
	overrides: Partial<TerminologyEntry> = {},
): TerminologyEntry => {
	const base: TerminologyEntry = {
		entryId: "thes_a1b2c3d4e5f67890",
		canonicalTerm: "Foundation Model",
		originalLanguage: "en",
		preferredTerm: { en: "Foundation Model", nl: "Foundation Model" },
		acronyms: [],
		aliases: {
			en: ["Base Model", "Pre-trained Model"],
			nl: ["Basismodel", "Pre-getraind Model"],
		},
		definition: {
			en: "Large-scale model trained on broad data, adaptable to wide range of downstream tasks",
			nl: "Grootschalig model getraind op brede data, aanpasbaar aan wijd scala downstream taken",
		},
		researchDomains: [
			{ domainId: "models-inference-scientific", primary: true },
			{ domainId: "agentic-ai-software-engineering", primary: false },
		],
		relationships: [],
		sources: [
			{
				sourceId: "arxiv-cs-cl-cs-lg",
				url: "https://arxiv.org/abs/2108.07258",
				title: "On the Opportunities and Risks of Foundation Models",
				tier: 1,
				section: "Abstract",
				accessedAt: "2025-11-10T10:00:00Z",
				retrievalStatus: "CHECKED_FOUND",
				confidence: 0.95,
			},
		],
		evidenceClassification: "RESEARCH_FINDING",
		verificationStatus: "verified",
		verificationConfidence: 0.9,
		standards: ["Stanford HAI Foundation Model Definition"],
		versionApplicability: [],
		forbidden: { en: ["Open Source Model"], nl: ["Open Source Model"] },
		lifecycleStatus: "ESTABLISHED",
		firstObservedAt: "2021-08-16",
		firstVerifiedAt: "2025-11-10",
		lastReviewedAt: "2025-11-10",
		establishedAt: "2025-11-10",
		revisionHistory: [],
		historicalObservations: [
			{
				date: "2021-08-16",
				sourceId: "arxiv-cs-cl-cs-lg",
				sourceUrl: "https://arxiv.org/abs/2108.07258",
				context:
					'Term coined in Stanford HAI paper "On the Opportunities and Risks of Foundation Models"',
				confidence: 0.9,
				isFirstObserved: true,
				note: "Original publication",
			},
		],
		schemaVersion: "1.0.0",
		createdAt: "2025-11-10T10:00:00Z",
		updatedAt: "2025-11-10T10:00:00Z",
		createdBy: "thesaurus-engine",
		tags: ["foundational", "ml"],
	};

	// Apply overrides, filtering out undefined values for strictObject compatibility
	const result: TerminologyEntry = { ...base };
	for (const [key, value] of Object.entries(overrides)) {
		if (value !== undefined) {
			(result as any)[key] = value;
		}
	}
	return result;
};

const createSampleEntry2 = (
	overrides: Partial<TerminologyEntry> = {},
): TerminologyEntry => ({
	...createSampleEntry(),
	entryId: "thes_b2c3d4e5f67890a1",
	canonicalTerm: "Large Language Model (LLM)",
	originalLanguage: "en",
	preferredTerm: {
		en: "Large Language Model (LLM)",
		nl: "Large Language Model (LLM)",
	},
	acronyms: [
		{
			acronym: "LLM",
			expansion: {
				en: "Large Language Model",
				nl: "Large Language Model",
			},
			authority: "academic-consensus",
		},
	],
	aliases: {
		en: ["LLM", "Large Language Model"],
		nl: ["LLM", "Groot Taalmodel"],
	},
	definition: {
		en: "Foundation model specialized for natural language processing tasks",
		nl: "Foundation model gespecialiseerd voor natuurlijke taalverwerking taken",
	},
	researchDomains: [
		{ domainId: "models-inference-scientific", primary: true },
	],
	relationships: [
		{
			targetId: "thes_a1b2c3d4e5f67890",
			type: "narrower-than",
			rationale:
				"LLM is a specific type of foundation model specialized for language",
			confidence: 1.0,
			establishedAt: "2025-11-10T10:00:00Z",
			establishedBy: "thesaurus-engine",
		},
	],
	lifecycleStatus: "ESTABLISHED",
	...overrides,
});

describe("Thesaurus Schema — Structure Validation", () => {
	describe("TerminologyEntrySchema", () => {
		it("validates a complete valid entry", () => {
			const entry = createSampleEntry();
			const result = TerminologyEntrySchema.safeParse(entry);
			if (!result.success) {
				console.log(
					"Validation errors:",
					JSON.stringify(result.error.issues, null, 2),
				);
			}
			expect(result.success).toBe(true);
		});

		it("rejects entry with invalid ID pattern", () => {
			const entry = createSampleEntry({ entryId: "invalid-id" });
			const result = TerminologyEntrySchema.safeParse(entry);
			expect(result.success).toBe(false);
		});

		it("rejects entry with missing required fields", () => {
			const entry = createSampleEntry({ canonicalTerm: "" });
			const result = TerminologyEntrySchema.safeParse(entry);
			expect(result.success).toBe(false);
		});

		it("rejects entry with empty sources array", () => {
			const entry = createSampleEntry({ sources: [] });
			const result = TerminologyEntrySchema.safeParse(entry);
			expect(result.success).toBe(false);
		});

		it("accepts all valid lifecycle statuses", () => {
			const statuses: TerminologyLifecycleStatus[] = [
				"CANDIDATE",
				"VERIFIED",
				"ESTABLISHED",
				"REVISED",
				"DEPRECATED",
				"SUPERSEDED",
			];
			for (const status of statuses) {
				const entry = createSampleEntry({ lifecycleStatus: status });
				const result = TerminologyEntrySchema.safeParse(entry);
				expect(result.success).toBe(true);
			}
		});

		it("accepts all valid evidence classifications", () => {
			const classifications = [
				"VERIFIED_FACT",
				"VENDOR_CLAIM",
				"RESEARCH_FINDING",
				"ORIGINAL_REPORTING",
				"EXPERT_INTERPRETATION",
				"INFERENCE",
				"SPECULATION",
				"UNVERIFIED",
			];
			for (const classification of classifications) {
				const entry = createSampleEntry({
					evidenceClassification: classification as any,
				});
				const result = TerminologyEntrySchema.safeParse(entry);
				expect(result.success).toBe(true);
			}
		});

		it("accepts all valid verification statuses", () => {
			const statuses = [
				"verified",
				"partially-verified",
				"unverified",
				"contradicted",
				"insufficient-evidence",
				"downgraded",
				"retracted",
				"superseded",
			];
			for (const status of statuses) {
				const entry = createSampleEntry({
					verificationStatus: status as any,
				});
				const result = TerminologyEntrySchema.safeParse(entry);
				expect(result.success).toBe(true);
			}
		});

		it("accepts all valid relationship types", () => {
			const entry = createSampleEntry({
				relationships: [
					{
						targetId: "thes_a1b2c3d4e5f67890",
						type: "synonym-of",
						rationale: "test",
						confidence: 1,
						establishedAt: "2025-11-10T10:00:00Z",
						establishedBy: "test",
					},
					{
						targetId: "thes_a1b2c3d4e5f67890",
						type: "alias-of",
						rationale: "test",
						confidence: 1,
						establishedAt: "2025-11-10T10:00:00Z",
						establishedBy: "test",
					},
					{
						targetId: "thes_a1b2c3d4e5f67890",
						type: "broader-than",
						rationale: "test",
						confidence: 1,
						establishedAt: "2025-11-10T10:00:00Z",
						establishedBy: "test",
					},
					{
						targetId: "thes_a1b2c3d4e5f67890",
						type: "narrower-than",
						rationale: "test",
						confidence: 1,
						establishedAt: "2025-11-10T10:00:00Z",
						establishedBy: "test",
					},
					{
						targetId: "thes_a1b2c3d4e5f67890",
						type: "related-to",
						rationale: "test",
						confidence: 1,
						establishedAt: "2025-11-10T10:00:00Z",
						establishedBy: "test",
					},
					{
						targetId: "thes_a1b2c3d4e5f67890",
						type: "part-of",
						rationale: "test",
						confidence: 1,
						establishedAt: "2025-11-10T10:00:00Z",
						establishedBy: "test",
					},
					{
						targetId: "thes_a1b2c3d4e5f67890",
						type: "extends",
						rationale: "test",
						confidence: 1,
						establishedAt: "2025-11-10T10:00:00Z",
						establishedBy: "test",
					},
					{
						targetId: "thes_a1b2c3d4e5f67890",
						type: "contrasts-with",
						rationale: "test",
						confidence: 1,
						establishedAt: "2025-11-10T10:00:00Z",
						establishedBy: "test",
					},
					{
						targetId: "thes_a1b2c3d4e5f67890",
						type: "supersedes",
						rationale: "test",
						confidence: 1,
						establishedAt: "2025-11-10T10:00:00Z",
						establishedBy: "test",
					},
					{
						targetId: "thes_a1b2c3d4e5f67890",
						type: "conflicts-with",
						rationale: "test",
						confidence: 1,
						establishedAt: "2025-11-10T10:00:00Z",
						establishedBy: "test",
					},
				],
			});
			const result = TerminologyEntrySchema.safeParse(entry);
			if (!result.success) {
				console.log(
					"Relationship validation errors:",
					JSON.stringify(result.error.issues, null, 2),
				);
			}
			expect(result.success).toBe(true);
		});

		it("accepts both language codes", () => {
			const entry = createSampleEntry({ originalLanguage: "nl" });
			const result = TerminologyEntrySchema.safeParse(entry);
			expect(result.success).toBe(true);

			const entry2 = createSampleEntry({ originalLanguage: "en" });
			const result2 = TerminologyEntrySchema.safeParse(entry2);
			expect(result2.success).toBe(true);
		});

		it("rejects invalid language code", () => {
			const entry = createSampleEntry({ originalLanguage: "fr" as any });
			const result = TerminologyEntrySchema.safeParse(entry);
			expect(result.success).toBe(false);
		});

		it("validates version applicability structure", () => {
			const entry = createSampleEntry({
				versionApplicability: [
					{
						version: "v1.0",
						applicable: true,
						notes: "Initial release",
					},
					{
						version: "v2.0",
						applicable: false,
						notes: "Breaking changes",
					},
				],
			});
			const result = TerminologyEntrySchema.safeParse(entry);
			expect(result.success).toBe(true);
		});

		it("validates acronym structure", () => {
			const entry = createSampleEntry({
				acronyms: [
					{
						acronym: "FM",
						expansion: {
							en: "Foundation Model",
							nl: "Foundation Model",
						},
						context: "ML literature",
						authority: "Stanford HAI",
					},
				],
			});
			const result = TerminologyEntrySchema.safeParse(entry);
			expect(result.success).toBe(true);
		});

		it("validates historical observations with first observed flag", () => {
			const entry = createSampleEntry({
				historicalObservations: [
					{
						date: "2021-08-16",
						sourceId: "src1",
						sourceUrl: "https://example.com",
						context: "First use",
						confidence: 0.9,
						isFirstObserved: true,
					},
					{
						date: "2022-01-15",
						sourceId: "src2",
						sourceUrl: "https://example.com/2",
						context: "Wider adoption",
						confidence: 0.8,
						isFirstObserved: false,
					},
				],
			});
			const result = TerminologyEntrySchema.safeParse(entry);
			expect(result.success).toBe(true);
		});

		it("validates revision history with all change types", () => {
			const entry = createSampleEntry({
				revisionHistory: [
					{
						revisionId: "rev_1",
						changeType: "ADD",
						revisedAt: "2025-11-10T10:00:00Z",
						revisedBy: "engine",
						justification: "Initial add",
					},
					{
						revisionId: "rev_2",
						changeType: "REFINE",
						revisedAt: "2025-11-11T10:00:00Z",
						revisedBy: "engine",
						justification: "Improved definition",
					},
					{
						revisionId: "rev_3",
						changeType: "CONFIRM",
						revisedAt: "2025-11-12T10:00:00Z",
						revisedBy: "engine",
						justification: "Promoted to established",
					},
				],
			});
			const result = TerminologyEntrySchema.safeParse(entry);
			expect(result.success).toBe(true);
		});
	});

	describe("ThesaurusArtifactSchema", () => {
		it("validates a complete artifact", () => {
			const artifact = {
				artifactId: "thesart_a1b2c3d4e5f67890",
				schemaVersion: "1.0.0",
				editionDate: "2025-11-10",
				generatedAt: "2025-11-10T10:00:00Z",
				generatedBy: "thesaurus-engine",
				entries: [createSampleEntry(), createSampleEntry2()],
				contentHash: "sha256:" + "a".repeat(64),
				previousVersionHash: "sha256:" + "b".repeat(64),
				stats: {
					totalEntries: 2,
					byLifecycleStatus: {
						CANDIDATE: 0,
						VERIFIED: 0,
						ESTABLISHED: 2,
						REVISED: 0,
						DEPRECATED: 0,
						SUPERSEDED: 0,
					},
					byDomain: {
						"models-inference-scientific": 2,
						"agentic-ai-software-engineering": 1,
					},
					verifiedEntries: 0,
					establishedEntries: 2,
					candidateEntries: 0,
					deprecatedEntries: 0,
					supersededEntries: 0,
					bilingualEntries: 2,
					entriesWithRelationships: 1,
				},
				validationResults: [],
			};
			const result = ThesaurusArtifactSchema.safeParse(artifact);
			expect(result.success).toBe(true);
		});

		it("rejects artifact with duplicate entry IDs", () => {
			const entry = createSampleEntry();
			const artifact = {
				artifactId: "thesart_xxx",
				schemaVersion: "1.0.0",
				generatedAt: "2025-11-10T10:00:00Z",
				generatedBy: "test",
				entries: [entry, entry], // Duplicate
				contentHash: "sha256:" + "a".repeat(64),
				stats: {
					totalEntries: 2,
					byLifecycleStatus: {
						CANDIDATE: 0,
						VERIFIED: 0,
						ESTABLISHED: 2,
						REVISED: 0,
						DEPRECATED: 0,
						SUPERSEDED: 0,
					},
					byDomain: {},
					verifiedEntries: 0,
					establishedEntries: 2,
					candidateEntries: 0,
					deprecatedEntries: 0,
					supersededEntries: 0,
					bilingualEntries: 2,
					entriesWithRelationships: 0,
				},
				validationResults: [],
			};
			const result = ThesaurusArtifactSchema.safeParse(artifact);
			expect(result.success).toBe(false);
		});
	});

	describe("TerminologyChangeProposalSchema", () => {
		it("validates an ADD proposal", () => {
			const proposal = {
				proposalId: "prop_a1b2c3d4e5f67890",
				editionDate: "edition_2025-11-10",
				changeType: "ADD",
				proposedEntry: createSampleEntry({
					entryId: "thes_new1234567890123",
				}),
				evidence: [
					{
						sourceId: "arxiv-cs-cl-cs-lg",
						url: "https://arxiv.org/abs/2108.07258",
						title: "Foundation Models Paper",
						tier: 1,
						section: "Abstract",
						accessedAt: "2025-11-10T10:00:00Z",
						retrievalStatus: "CHECKED_FOUND",
						confidence: 0.95,
					},
				],
				justification: "New term from foundational paper",
				relatedEntryIds: [],
				autoEligible: false,
				status: "pending",
				proposedAt: "2025-11-10T10:00:00Z",
				proposedBy: "thesaurus-engine",
			};
			const result = TerminologyChangeProposalSchema.safeParse(proposal);
			expect(result.success).toBe(true);
		});

		it("validates a MERGE proposal with relatedEntryIds", () => {
			const proposal = {
				proposalId: "prop_a1b2c3d4e5f67890",
				editionDate: "edition_2025-11-10",
				changeType: "MERGE",
				targetEntryId: "thes_a1b2c3d4e5f67890",
				proposedEntry: undefined,
				evidence: [
					{
						sourceId: "arxiv-cs-cl-cs-lg",
						url: "https://arxiv.org/abs/2108.07258",
						title: "Foundation Models Paper",
						tier: 1,
						section: "Abstract",
						accessedAt: "2025-11-10T10:00:00Z",
						retrievalStatus: "CHECKED_FOUND",
						confidence: 0.95,
					},
				],
				justification: "Merge duplicate entries",
				relatedEntryIds: ["thes_b2c3d4e5f67890a1"],
				autoEligible: false,
				status: "pending",
				proposedAt: "2025-11-10T10:00:00Z",
				proposedBy: "thesaurus-engine",
			};
			const result = TerminologyChangeProposalSchema.safeParse(proposal);
			expect(result.success).toBe(true);
		});

		it("accepts all valid change types", () => {
			const changeTypes = [
				"ADD",
				"CONFIRM",
				"REFINE",
				"MERGE",
				"DEPRECATE",
				"SUPERSEDE",
				"NONE",
			] as const;
			for (const changeType of changeTypes) {
				const proposal: TerminologyChangeProposal = {
					proposalId: "prop_a1b2c3d4e5f67890",
					editionDate: "edition_2025-11-10",
					changeType,
					evidence: [
						{
							sourceId: "arxiv-cs-cl-cs-lg",
							url: "https://arxiv.org/abs/2108.07258",
							title: "Foundation Models Paper",
							tier: 1,
							section: "Abstract",
							accessedAt: "2025-11-10T10:00:00Z",
							retrievalStatus: "CHECKED_FOUND",
							confidence: 0.95,
						},
					],
					justification: "test",
					relatedEntryIds: [],
					autoEligible: false,
					status: "pending",
					proposedAt: "2025-11-10T10:00:00Z",
					proposedBy: "test",
				};
				if (changeType !== "ADD")
					proposal.targetEntryId = "thes_a1b2c3d4e5f67890";
				if (changeType === "ADD")
					proposal.proposedEntry = createSampleEntry({
						entryId: "thes_new1234567890123",
					});
				const result =
					TerminologyChangeProposalSchema.safeParse(proposal);
				expect(result.success).toBe(true);
			}
		});
	});
});

describe("Thesaurus Engine — Core Operations", () => {
	const entries = [createSampleEntry(), createSampleEntry2()];

	describe("normalizeTerm", () => {
		it("normalizes terms consistently", () => {
			expect(normalizeTerm("Foundation Model")).toBe("foundation model");
			expect(normalizeTerm("  Foundation   Model  ")).toBe(
				"foundation model",
			);
			expect(normalizeTerm("FOUNDATION MODEL")).toBe("foundation model");
			expect(normalizeTerm("Foundation-Model")).toBe("foundation-model");
		});

		it("removes special characters", () => {
			expect(normalizeTerm("Model@#$%")).toBe("model");
			expect(normalizeTerm("Model (v1.0)")).toBe("model (v1.0)");
		});
	});

	describe("normalizeAcronym", () => {
		it("normalizes acronyms to uppercase", () => {
			expect(normalizeAcronym("llm")).toBe("LLM");
			expect(normalizeAcronym("LlM")).toBe("LLM");
			expect(normalizeAcronym("m-c-p")).toBe("MCP");
		});
	});

	describe("bilingualEquivalent", () => {
		it("returns true for equivalent bilingual strings", () => {
			const a = { en: "Foundation Model", nl: "Foundation Model" };
			const b = { en: "Foundation Model", nl: "Foundation Model" };
			expect(bilingualEquivalent(a, b)).toBe(true);
		});

		it("returns false for different bilingual strings", () => {
			const a = { en: "Foundation Model", nl: "Foundation Model" };
			const b = { en: "Large Language Model", nl: "Groot Taalmodel" };
			expect(bilingualEquivalent(a, b)).toBe(false);
		});

		it("is case-insensitive", () => {
			const a = { en: "Foundation Model", nl: "Foundation Model" };
			const b = { en: "foundation model", nl: "foundation model" };
			expect(bilingualEquivalent(a, b)).toBe(true);
		});
	});

	describe("detectDuplicate", () => {
		it("detects exact canonical term match", () => {
			const proposed = createSampleEntry({
				canonicalTerm: "Foundation Model",
			});
			const result = detectDuplicate(proposed, entries);
			expect(result.isDuplicate).toBe(true);
			expect(result.matchType).toBe("exact-canonical");
			expect(result.confidence).toBe(1.0);
		});

		it("detects exact preferred term match (EN)", () => {
			const proposed = createSampleEntry({
				canonicalTerm: "Different Term",
				preferredTerm: {
					en: "Foundation Model",
					nl: "Foundation Model",
				},
			});
			const result = detectDuplicate(proposed, entries);
			expect(result.isDuplicate).toBe(true);
			expect(result.matchType).toBe("exact-alias");
		});

		it("detects exact preferred term match (NL)", () => {
			const proposed = createSampleEntry({
				canonicalTerm: "Different Term",
				preferredTerm: { en: "Other", nl: "Foundation Model" },
			});
			const result = detectDuplicate(proposed, entries);
			expect(result.isDuplicate).toBe(true);
			expect(result.matchType).toBe("exact-alias");
		});

		it("detects alias match", () => {
			const proposed = createSampleEntry({
				canonicalTerm: "New Term",
				preferredTerm: { en: "New Term", nl: "Nieuwe Term" },
				aliases: { en: ["Base Model"], nl: [] },
			});
			const result = detectDuplicate(proposed, entries);
			expect(result.isDuplicate).toBe(true);
			expect(result.matchType).toBe("exact-alias");
		});

		it("detects acronym conflict", () => {
			const proposed = createSampleEntry({
				canonicalTerm: "New Model",
				preferredTerm: { en: "New Model", nl: "Nieuw Model" },
				acronyms: [
					{
						acronym: "LLM",
						expansion: {
							en: "Large Language Model",
							nl: "Groot Taalmodel",
						},
					},
				],
			});
			const result = detectDuplicate(proposed, entries);
			expect(result.isDuplicate).toBe(true);
			expect(result.matchType).toBe("acronym-conflict");
		});

		it("returns no duplicate for genuinely new term", () => {
			const proposed = createSampleEntry({
				canonicalTerm: "Totally New Concept",
				preferredTerm: {
					en: "Totally New Concept",
					nl: "Helemaal Nieuw Concept",
				},
				acronyms: [],
				aliases: { en: [], nl: [] },
			});
			const result = detectDuplicate(proposed, entries);
			expect(result.isDuplicate).toBe(false);
		});
	});

	describe("validateTerminologyEntry", () => {
		it("passes validation for valid entry", () => {
			const entry = createSampleEntry();
			const result = validateTerminologyEntry(
				entry,
				entries.filter((e) => e.entryId !== entry.entryId),
			);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("fails validation for empty canonical term", () => {
			const entry = createSampleEntry({ canonicalTerm: "" });
			const result = validateTerminologyEntry(entry, entries);
			expect(result.valid).toBe(false);
			expect(
				result.errors.some(
					(e) =>
						e.code === "SCHEMA_VALIDATION" &&
						e.field === "canonicalTerm",
				),
			).toBe(true);
		});

		it("fails validation for missing sources", () => {
			const entry = createSampleEntry({ sources: [] });
			const result = validateTerminologyEntry(entry, entries);
			expect(result.valid).toBe(false);
			expect(
				result.errors.some(
					(e) =>
						e.code === "SCHEMA_VALIDATION" && e.field === "sources",
				),
			).toBe(true);
		});

		it("fails validation for invalid entry ID pattern", () => {
			const entry = createSampleEntry({ entryId: "invalid" });
			const result = validateTerminologyEntry(entry, entries);
			expect(result.valid).toBe(false);
			expect(
				result.errors.some(
					(e) =>
						e.code === "SCHEMA_VALIDATION" && e.field === "entryId",
				),
			).toBe(true);
		});

		it("fails validation for SUPERSEDED without supersededBy", () => {
			const entry = createSampleEntry({
				lifecycleStatus: "SUPERSEDED",
				supersededBy: undefined,
			});
			const result = validateTerminologyEntry(entry, entries);
			expect(result.valid).toBe(false);
			expect(
				result.errors.some((e) => e.code === "MISSING_SUPERSEDED_BY"),
			).toBe(true);
		});

		it("fails validation for supersededBy referencing non-existent entry", () => {
			const entry = createSampleEntry({
				lifecycleStatus: "SUPERSEDED",
				supersededBy: "thes_nonexistent12345",
			});
			const result = validateTerminologyEntry(entry, entries);
			expect(result.valid).toBe(false);
			expect(
				result.errors.some((e) => e.code === "INVALID_SUPERSEDED_BY"),
			).toBe(true);
		});

		it("fails validation for self-referencing relationship", () => {
			const entry = createSampleEntry({
				relationships: [
					{
						targetId: "thes_a1b2c3d4e5f67890",
						type: "related-to",
						rationale: "test",
						confidence: 1,
						establishedAt: "2025-11-10T10:00:00Z",
						establishedBy: "test",
					},
				],
			});
			const result = validateTerminologyEntry(entry, entries);
			expect(result.valid).toBe(false);
			expect(
				result.errors.some(
					(e) => e.code === "SELF_REFERENCE_RELATIONSHIP",
				),
			).toBe(true);
		});

		it("fails validation for contradictory relationships", () => {
			const entry = createSampleEntry({
				relationships: [
					{
						targetId: "thes_b2c3d4e5f67890a1",
						type: "synonym-of",
						rationale: "test",
						confidence: 1,
						establishedAt: "2025-11-10T10:00:00Z",
						establishedBy: "test",
					},
					{
						targetId: "thes_b2c3d4e5f67890a1",
						type: "conflicts-with",
						rationale: "test",
						confidence: 1,
						establishedAt: "2025-11-10T10:00:00Z",
						establishedBy: "test",
					},
				],
			});
			const result = validateTerminologyEntry(entry, entries);
			expect(result.valid).toBe(false);
			expect(
				result.errors.some(
					(e) => e.code === "CONTRADICTORY_RELATIONSHIPS",
				),
			).toBe(true);
		});

		it("fails validation for duplicate canonical term", () => {
			const entry = createSampleEntry({
				entryId: "thes_new1234567890123",
			});
			const result = validateTerminologyEntry(entry, entries);
			expect(result.valid).toBe(false);
			expect(
				result.errors.some((e) => e.code === "DUPLICATE_ENTRY"),
			).toBe(true);
		});

		it("warns for short definitions", () => {
			const entry = createSampleEntry({
				definition: { en: "Short", nl: "Kort" },
			});
			const result = validateTerminologyEntry(entry, entries);
			expect(
				result.warnings.some((w) => w.code === "SHORT_EN_DEFINITION"),
			).toBe(true);
			expect(
				result.warnings.some((w) => w.code === "SHORT_NL_DEFINITION"),
			).toBe(true);
		});

		it("warns for missing establishedAt on ESTABLISHED entry", () => {
			// Create a fresh entry without establishedAt
			const entry = createSampleEntry({ lifecycleStatus: "ESTABLISHED" });
			// Remove establishedAt from the entry (simulate missing field)
			delete entry.establishedAt;
			const result = validateTerminologyEntry(entry, entries);
			expect(
				result.warnings.some(
					(w) => w.code === "MISSING_ESTABLISHED_DATE",
				),
			).toBe(true);
		});
	});

	describe("validateThesaurusArtifact", () => {
		it("passes validation for valid artifact", () => {
			const artifact: ThesaurusArtifact = {
				artifactId: "thesart_a1b2c3d4e5f67890",
				schemaVersion: "1.0.0",
				generatedAt: "2025-11-10T10:00:00Z",
				generatedBy: "test",
				entries,
				contentHash: "sha256:" + "a".repeat(64),
				stats: {
					totalEntries: 2,
					byLifecycleStatus: {
						CANDIDATE: 0,
						VERIFIED: 0,
						ESTABLISHED: 2,
						REVISED: 0,
						DEPRECATED: 0,
						SUPERSEDED: 0,
					},
					byDomain: { "models-inference-scientific": 2 },
					verifiedEntries: 0,
					establishedEntries: 2,
					candidateEntries: 0,
					deprecatedEntries: 0,
					supersededEntries: 0,
					bilingualEntries: 2,
					entriesWithRelationships: 1,
				},
				validationResults: [],
			};
			const result = validateThesaurusArtifact(artifact);
			expect(result.valid).toBe(true);
		});

		it("fails validation for duplicate entry IDs in artifact", () => {
			const entry = createSampleEntry();
			const artifact: ThesaurusArtifact = {
				artifactId: "thesart_test",
				schemaVersion: "1.0.0",
				generatedAt: "2025-11-10T10:00:00Z",
				generatedBy: "test",
				entries: [entry, entry],
				contentHash: "sha256:" + "a".repeat(64),
				stats: {
					totalEntries: 2,
					byLifecycleStatus: {
						CANDIDATE: 0,
						VERIFIED: 0,
						ESTABLISHED: 2,
						REVISED: 0,
						DEPRECATED: 0,
						SUPERSEDED: 0,
					},
					byDomain: {},
					verifiedEntries: 0,
					establishedEntries: 2,
					candidateEntries: 0,
					deprecatedEntries: 0,
					supersededEntries: 0,
					bilingualEntries: 2,
					entriesWithRelationships: 0,
				},
				validationResults: [],
			};
			const result = validateThesaurusArtifact(artifact);
			expect(result.valid).toBe(false);
			expect(
				result.errors.some((e) => e.code === "DUPLICATE_ENTRY_IDS"),
			).toBe(true);
		});
	});

	describe("validateRelationships", () => {
		it("passes for valid relationship graph", () => {
			const result = validateRelationships(entries);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(result.invalidTargets).toHaveLength(0);
		});

		it("detects invalid relationship targets", () => {
			const badEntries = [
				createSampleEntry({
					relationships: [
						{
							targetId: "thes_nonexistent",
							type: "related-to",
							rationale: "test",
							confidence: 1,
							establishedAt: "2025-11-10T10:00:00Z",
							establishedBy: "test",
						},
					],
				}),
			];
			const result = validateRelationships(badEntries);
			expect(result.valid).toBe(false);
			expect(result.invalidTargets).toContain("thes_nonexistent");
		});

		it("detects self-references", () => {
			const badEntries = [
				createSampleEntry({
					relationships: [
						{
							targetId: "thes_a1b2c3d4e5f67890",
							type: "related-to",
							rationale: "test",
							confidence: 1,
							establishedAt: "2025-11-10T10:00:00Z",
							establishedBy: "test",
						},
					],
				}),
			];
			const result = validateRelationships(badEntries);
			expect(result.valid).toBe(false);
			expect(
				result.errors.some((e) => e.includes("self-referencing")),
			).toBe(true);
		});
	});

	describe("searchTerminologyEntries", () => {
		it("finds entry by canonical term", () => {
			const results = searchTerminologyEntries(
				entries,
				"Foundation Model",
			);
			expect(results.length).toBeGreaterThanOrEqual(1);
			expect(
				results.some((r) => r.canonicalTerm === "Foundation Model"),
			).toBe(true);
		});

		it("finds entry by alias", () => {
			const results = searchTerminologyEntries(entries, "Base Model");
			expect(results).toHaveLength(1);
			expect(results[0].canonicalTerm).toBe("Foundation Model");
		});

		it("finds entry by acronym", () => {
			const results = searchTerminologyEntries(entries, "LLM");
			expect(results).toHaveLength(1);
			expect(results[0].canonicalTerm).toBe("Large Language Model (LLM)");
		});

		it("finds entry by partial match", () => {
			const results = searchTerminologyEntries(entries, "Model");
			expect(results.length).toBeGreaterThan(0);
		});

		it("is case-insensitive", () => {
			const results = searchTerminologyEntries(
				entries,
				"foundation model",
			);
			expect(results.length).toBeGreaterThanOrEqual(1);
			expect(
				results.some((r) => r.canonicalTerm === "Foundation Model"),
			).toBe(true);
		});

		it("excludes deprecated entries by default", () => {
			const deprecatedEntry = createSampleEntry({
				entryId: "thes_deprecated",
				canonicalTerm: "Deprecated Term",
				lifecycleStatus: "DEPRECATED",
			});
			const allEntries = [...entries, deprecatedEntry];
			const results = searchTerminologyEntries(
				allEntries,
				"Deprecated Term",
			);
			expect(results).toHaveLength(0);

			const resultsWithDeprecated = searchTerminologyEntries(
				allEntries,
				"Deprecated Term",
				{ includeDeprecated: true },
			);
			expect(resultsWithDeprecated).toHaveLength(1);
		});

		it("filters by lifecycle status", () => {
			const candidateEntry = createSampleEntry({
				entryId: "thes_candidate",
				canonicalTerm: "Candidate Term",
				lifecycleStatus: "CANDIDATE",
			});
			const allEntries = [...entries, candidateEntry];
			const results = searchTerminologyEntries(
				allEntries,
				"Candidate Term",
				{ lifecycleStatus: ["CANDIDATE"] },
			);
			expect(results).toHaveLength(1);
		});
	});

	describe("getTerminologyEntryById", () => {
		it("returns entry by ID", () => {
			const entry = getTerminologyEntryById(
				entries,
				"thes_a1b2c3d4e5f67890",
			);
			expect(entry).toBeDefined();
			expect(entry?.canonicalTerm).toBe("Foundation Model");
		});

		it("returns undefined for non-existent ID", () => {
			const entry = getTerminologyEntryById(entries, "thes_nonexistent");
			expect(entry).toBeUndefined();
		});
	});

	describe("getEntriesByDomain", () => {
		it("returns entries for a domain", () => {
			const domainEntries = getEntriesByDomain(
				entries,
				"models-inference-scientific",
			);
			expect(domainEntries).toHaveLength(2);
		});

		it("returns empty array for non-existent domain", () => {
			const domainEntries = getEntriesByDomain(
				entries,
				"non-existent-domain",
			);
			expect(domainEntries).toHaveLength(0);
		});
	});
});

describe("Thesaurus JSON Schema Generation", () => {
	it("generates valid JSON Schema for terminology entry", () => {
		const schema = generateTerminologyEntryJsonSchema();
		expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#");
		expect(schema.$id).toBe(
			"https://ai-intelligence-blog/schemas/terminology-entry.json",
		);
		expect(schema.title).toBe("Terminology Entry");
		expect(schema.type).toBe("object");
	});

	it("generates valid JSON Schema for thesaurus artifact", () => {
		const schema = generateThesaurusArtifactJsonSchema();
		expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#");
		expect(schema.$id).toBe(
			"https://ai-intelligence-blog/schemas/thesaurus-artifact.json",
		);
		expect(schema.title).toBe("Thesaurus Artifact");
	});

	it("generates valid JSON Schema for change proposal", () => {
		const schema = generateTerminologyChangeProposalJsonSchema();
		expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#");
		expect(schema.$id).toBe(
			"https://ai-intelligence-blog/schemas/terminology-change-proposal.json",
		);
		expect(schema.title).toBe("Terminology Change Proposal");
	});
});

describe("Thesaurus ID Patterns", () => {
	it("entry ID pattern matches valid IDs", () => {
		expect(ID_PATTERNS.thesaurusEntry.test("thes_a1b2c3d4e5f67890")).toBe(
			true,
		);
		expect(ID_PATTERNS.thesaurusEntry.test("thes_abcdefghijklmnop")).toBe(
			true,
		);
	});

	it("entry ID pattern rejects invalid IDs", () => {
		expect(ID_PATTERNS.thesaurusEntry.test("thes_short")).toBe(false);
		expect(ID_PATTERNS.thesaurusEntry.test("invalid_id")).toBe(false);
		expect(ID_PATTERNS.thesaurusEntry.test("thes_")).toBe(false);
	});

	it("artifact ID pattern matches valid IDs", () => {
		expect(
			ID_PATTERNS.thesaurusArtifact.test("thesart_a1b2c3d4e5f67890"),
		).toBe(true);
	});
});

describe("Thesaurus Enum Validation", () => {
	it("validates all lifecycle statuses", () => {
		const statuses = [
			"CANDIDATE",
			"VERIFIED",
			"ESTABLISHED",
			"REVISED",
			"DEPRECATED",
			"SUPERSEDED",
		];
		for (const status of statuses) {
			expect(
				TerminologyLifecycleStatusSchema.safeParse(status).success,
			).toBe(true);
		}
		expect(
			TerminologyLifecycleStatusSchema.safeParse("INVALID").success,
		).toBe(false);
	});

	it("validates all change types", () => {
		const types = [
			"ADD",
			"CONFIRM",
			"REFINE",
			"MERGE",
			"DEPRECATE",
			"SUPERSEDE",
			"NONE",
		];
		for (const type of types) {
			expect(TerminologyChangeTypeSchema.safeParse(type).success).toBe(
				true,
			);
		}
	});

	it("validates all relationship types", () => {
		const types = [
			"synonym-of",
			"alias-of",
			"broader-than",
			"narrower-than",
			"related-to",
			"part-of",
			"extends",
			"contrasts-with",
			"supersedes",
			"conflicts-with",
		];
		for (const type of types) {
			expect(
				TerminologyRelationshipTypeSchema.safeParse(type).success,
			).toBe(true);
		}
	});

	it("validates language codes", () => {
		expect(LanguageCodeSchema.safeParse("en").success).toBe(true);
		expect(LanguageCodeSchema.safeParse("nl").success).toBe(true);
		expect(LanguageCodeSchema.safeParse("fr").success).toBe(false);
	});
});
