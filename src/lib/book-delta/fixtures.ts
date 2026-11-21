/**
 * Book Delta — Test Fixtures
 *
 * Representative regression fixtures covering the 24 scenarios specified
 * in the implementation requirements. All fixtures are clearly labeled
 * as synthetic test data.
 */

import {
	type BookDeltaProposal,
	type BookDeltaArtifact,
	type BookDeltaEvaluationResult,
	type BookDeltaKnowledgeContinuityResult,
	type BookDeltaCategory,
	type BookDeltaLifecycle,
	type EvidenceClassification,
	type VerificationStatus,
	type VerificationLevel,
	type TargetAudience,
	type KnowledgeDomain,
	type EducationalValue,
	type MaterialUncertainty,
	type TargetDocumentAccess,
	type UniquenessStatus,
	type BilingualString,
	type AuthoritativeSourceReference,
	type ResearchDateRange,
	type AcceptanceCriterion,
	type TargetDocumentReference,
	type TerminologyReference,
	type PrincipleReference,
	type Counterevidence,
	type AccessibilityConsiderations,
	type DurabilityAssessment,
	type MethodologicalCaveats,
	BOOK_DELTA_SCHEMA_VERSION,
	BOOK_DELTA_ID_PATTERNS,
	BookDeltaProposalSchema,
	BookDeltaArtifactSchema,
	BookDeltaEvaluationResultSchema,
	BookDeltaKnowledgeContinuityResultSchema,
} from "./schema.js";
import {
	computeObjectHash,
	canonicalStringify,
	validateBookDeltaProposal,
	validateBookDeltaArtifact,
	validateBookDeltaEvaluationResult,
	validateBookDeltaKnowledgeContinuityResult,
} from "./validate.js";

// ============================================================================
// Test Data Factory Functions
// ============================================================================

function createBilingualString(en: string, nl: string): BilingualString {
	return { en, nl };
}

function createSourceReference(
	overrides: Partial<AuthoritativeSourceReference> = {},
): AuthoritativeSourceReference {
	return {
		sourceId: "test-source",
		url: "https://example.com/test",
		title: "Test Source",
		tier: 1,
		section: "Section 1",
		accessedAt: new Date().toISOString(),
		retrievalStatus: "CHECKED_FOUND",
		confidence: 0.9,
		...overrides,
	};
}

function createResearchDateRange(): ResearchDateRange {
	const today = new Date().toISOString().split("T")[0];
	return {
		earliestFinding: today,
		latestFinding: today,
		primaryEditionDates: [today],
	};
}

function createAcceptanceCriterion(
	overrides: Partial<AcceptanceCriterion> = {},
): AcceptanceCriterion {
	return {
		criterionId: "test-criterion",
		description: "Test acceptance criterion",
		measurable: true,
		verificationMethod: "content-inspection",
		evidenceRequired: ["Evidence 1", "Evidence 2"],
		...overrides,
	};
}

function createTargetDocumentReference(
	overrides: Partial<TargetDocumentReference> = {},
): TargetDocumentReference {
	return {
		accessibility: "unidentified",
		comparisonPerformed: false,
		comparisonResult: "not-performed",
		accessNote: "Test fixture - target document not identified",
		...overrides,
	};
}

function createTerminologyReference(
	overrides: Partial<TerminologyReference> = {},
): TerminologyReference {
	return {
		entryId: "thes_abcdefghijklmnop",
		term: "Test Term",
		relationship: "related-concept",
		note: "Test fixture reference",
		...overrides,
	};
}

function createPrincipleReference(
	overrides: Partial<PrincipleReference> = {},
): PrincipleReference {
	return {
		principleId: "AP-001",
		title: "Test Principle",
		relationship: "illustrates",
		note: "Test fixture reference",
		...overrides,
	};
}

function createCounterevidence(
	overrides: Partial<Counterevidence> = {},
): Counterevidence {
	return {
		description: "Test counterevidence",
		sourceReference: createSourceReference(),
		evidenceClassification: "VERIFIED_FACT",
		impact: "qualifying",
		note: "Test fixture",
		...overrides,
	};
}

function createAccessibilityConsiderations(
	overrides: Partial<AccessibilityConsiderations> = {},
): AccessibilityConsiderations {
	return {
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
		cognitiveLoadAssessment: "Test assessment",
		...overrides,
	};
}

function createDurabilityAssessment(
	overrides: Partial<DurabilityAssessment> = {},
): DurabilityAssessment {
	return {
		conceptualImportance: "high",
		technicalAccuracy: "high",
		reusability: "cross-domain",
		multiContextRelevance: true,
		prerequisiteDependencies: ["prereq-1", "prereq-2"],
		likelihoodOfFutureChange: "low",
		authoritativeEvidenceAvailable: true,
		practicalApplicability: "high",
		correctsRecurringMisconception: false,
		progressiveLearningValue: "high",
		maintenanceCostEstimate: "low",
		...overrides,
	};
}

function createMethodologicalCaveats(
	overrides: Partial<MethodologicalCaveats> = {},
): MethodologicalCaveats {
	return {
		empiricalVsInterpretation: "Test caveat",
		correlationVsCausation: "Test caveat",
		measuredVsForecast: "Test caveat",
		vendorClaimVsIndependent: "Test caveat",
		experimentalVsProduction: "Test caveat",
		populationScope: "Test caveat",
		generalizabilityLimitations: ["Limitation 1", "Limitation 2"],
		conflictingStudies: [],
		...overrides,
	};
}

function generateRandomHex(length: number): string {
	const bytes = new Uint8Array(Math.ceil(length / 2));
	crypto.getRandomValues(bytes);
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")
		.slice(0, length);
}

function createProposal(
	overrides: Partial<BookDeltaProposal> = {},
): BookDeltaProposal {
	const now = new Date().toISOString();
	const editionDate = "2025-01-15";
	const editionId = `edition_${editionDate}`;

	const base: BookDeltaProposal = {
		proposalId: `bdp_${generateRandomHex(16)}`,
		editionId,
		editionDate,
		category: "ADD",
		title: createBilingualString(
			"Add Missing Explanation: Test Concept",
			"Voeg Ontbrekende Uitleg Toe: Test Concept",
		),
		knowledgeDomain: "agentic-ai-software-engineering",
		targetAudience: ["system-architects", "principal-engineers"],
		targetConcept: "Test concept for educational improvement",
		targetDocument: createTargetDocumentReference(),
		currentGap: createBilingualString(
			"Current explanation is missing",
			"Huidige uitleg ontbreekt",
		),
		proposedChange: createBilingualString(
			"Add new explanation with examples",
			"Voeg nieuwe uitleg met voorbeelden toe",
		),
		rationale: createBilingualString(
			"Based on verified research findings",
			"Gebaseerd op geverifieerde onderzoeksbevindingen",
		),
		supportingClaimIds: [`claim_${generateRandomHex(16)}`],
		originalSources: [createSourceReference()],
		researchDates: createResearchDateRange(),
		evidenceClassification: "VERIFIED_FACT",
		confidence: 0.85,
		materialUncertainty: "low",
		educationalValue: "foundational",
		limitations: [],
		terminologyReferences: [createTerminologyReference()],
		principleReferences: [createPrincipleReference()],
		historicalProposalReferences: [],
		conflicts: [],
		counterevidence: [],
		acceptanceCriteria: [createAcceptanceCriterion()],
		durability: createDurabilityAssessment(),
		methodologicalCaveats: createMethodologicalCaveats(),
		accessibility: createAccessibilityConsiderations(),
		lifecycleStatus: "CANDIDATE",
		revisionHistory: [],
		uniquenessStatus: "unique",
		schemaVersion: BOOK_DELTA_SCHEMA_VERSION,
		createdAt: now,
		updatedAt: now,
		createdBy: "test-fixture",
		tags: ["test", "add"],
	};

	return { ...base, ...overrides };
}

// ============================================================================
// Fixture 1: Significant research finding revealing a genuinely missing educational concept
// ============================================================================

export const FIXTURE_MISSING_CONCEPT: BookDeltaProposal = createProposal({
	proposalId: "bdp_fixt000000000001",
	category: "ADD",
	title: createBilingualString(
		"Add Missing Explanation: Chain-of-Thought Reasoning in Agent Architectures",
		"Voeg Ontbrekende Uitleg Toe: Chain-of-Thought Redenering in Agent Architecturen",
	),
	targetConcept:
		"Chain-of-Thought reasoning mechanisms and their architectural implications for autonomous agents",
	currentGap: createBilingualString(
		"Current educational material does not explain how Chain-of-Thought reasoning works internally or its architectural trade-offs",
		"Huidig educatief materiaal legt niet uit hoe Chain-of-Thought redenering intern werkt of wat de architecturale trade-offs zijn",
	),
	proposedChange: createBilingualString(
		"Introduce a foundational section covering CoT mechanism, token budget implications, sandbox isolation requirements, and failure modes",
		"Introduceer een fundamentele sectie over CoT-mechanisme, tokenbudget-implicaties, sandbox-isolatievereisten en falenmodi",
	),
	rationale: createBilingualString(
		"Verified research (arXiv:2401.12345, MLPerf v3.1) establishes CoT as a distinct architectural pattern with measurable cost/latency trade-offs. System architects need this for agent design decisions.",
		"Geverifieerd onderzoek (arXiv:2401.12345, MLPerf v3.1) stelt CoT vast als een distinct architecturaal patroon met meetbare kosten/latentie trade-offs. Systeemarchitecten hebben dit nodig voor agent ontwerpbeslissingen.",
	),
	supportingClaimIds: ["claim_abcdefghijklmnop", "claim_bcdefghijklmnopq"],
	originalSources: [
		createSourceReference({
			sourceId: "arxiv-cot-mechanisms",
			url: "https://arxiv.org/abs/2401.12345",
			title: "Chain-of-Thought Mechanisms in LLM Agents",
		}),
		createSourceReference({
			sourceId: "mlperf-v31",
			url: "https://mlcommons.org/results/v3.1",
			title: "MLPerf Inference v3.1 Results",
		}),
	],
	evidenceClassification: "RESEARCH_FINDING",
	confidence: 0.92,
	educationalValue: "foundational",
	knowledgeDomain: "agentic-ai-software-engineering",
	targetAudience: [
		"system-architects",
		"principal-engineers",
		"ml-platform-leads",
	],
	tags: ["add", "chain-of-thought", "agent-architecture"],
});

// ============================================================================
// Fixture 2: Software engineering explanation requiring greater technical accuracy
// ============================================================================

export const FIXTURE_TECHNICAL_ACCURACY: BookDeltaProposal = createProposal({
	proposalId: "bdp_fixt000000000002",
	category: "REFINE",
	title: createBilingualString(
		"Refine Explanation: Capability Token Validation Performance Characteristics",
		"Verbeter Uitleg: Prestatiekarakteristieken van Capability Token Validatie",
	),
	targetConcept:
		"Performance overhead and caching strategies for capability token validation in high-throughput agent systems",
	currentGap: createBilingualString(
		'Existing explanation states "validation is fast" without quantifying latency percentiles, cache hit rates, or cold-start penalties',
		'Bestaande uitleg stelt "validatie is snel" zonder kwantificering van latentie percentielen, cache hit rates, of cold-start penalties',
	),
	proposedChange: createBilingualString(
		"Add measured p50/p99 latency figures, cache warming strategies, and circuit breaker integration patterns with concrete configuration examples",
		"Voeg gemeten p50/p99 latentiecijfers, cache warming strategieën, en circuit breaker integratiepatronen toe met concrete configuratievoorbeelden",
	),
	rationale: createBilingualString(
		"Benchmark reproduction (L2 verified) shows 2.3ms p99 overhead with cold cache vs 0.1ms warm. Current explanation is misleading for latency-sensitive architectures.",
		"Benchmark replicatie (L2 geverifieerd) toont 2.3ms p99 overhead met koude cache vs 0.1ms warm. Huidige uitleg is misleidend voor latentie-gevoelige architecturen.",
	),
	supportingClaimIds: ["claim_cdefghijklmnopqr"],
	originalSources: [
		createSourceReference({
			sourceId: "capability-token-benchmark",
			url: "https://github.com/example/token-bench",
			title: "Capability Token Validation Benchmark",
		}),
	],
	evidenceClassification: "VERIFIED_FACT",
	confidence: 0.88,
	educationalValue: "significant",
	knowledgeDomain: "architecture-security-governance",
	targetAudience: [
		"system-architects",
		"principal-engineers",
		"security-architects",
	],
	tags: ["refine", "performance", "capability-tokens"],
});

// ============================================================================
// Fixture 3: Scientific misconception requiring correction
// ============================================================================

export const FIXTURE_MISCONCEPTION_CORRECTION: BookDeltaProposal =
	createProposal({
		proposalId: "bdp_fixt000000000003",
		category: "CORRECT",
		title: createBilingualString(
			"Correct Misconception: Larger Context Windows Always Improve RAG Accuracy",
			"Corrigeer Misverstand: Grotere Context Vensters Verbeteren Altijd RAG Nauwkeurigheid",
		),
		targetConcept:
			"Relationship between context window size and Retrieval-Augmented Generation accuracy",
		currentGap: createBilingualString(
			'Widely cited vendor marketing claims that "larger context = better RAG" without evidence. Independent research shows diminishing returns and noise amplification beyond optimal retrieval depth.',
			'Wijd geciteerde vendor marketing claims dat "groter context = betere RAG" zonder bewijs. Onafhankelijk onderzoek toont afnemende opbrengsten en ruisversterking na optimale retrieval diepte.',
		),
		proposedChange: createBilingualString(
			"Replace the vendor claim with verified findings: optimal retrieval depth is typically 5-10 documents; larger windows increase latency and hallucination rate without accuracy gains",
			"Vervang de vendor claim door geverifieerde bevindingen: optimale retrieval diepte is typisch 5-10 documenten; grotere vensters verhogen latentie en hallucinatiepercentage zonder nauwkeurigheidswinst",
		),
		rationale: createBilingualString(
			"Controlled study (NeurIPS 2024, L3 replicated) with n=5000 queries shows accuracy peaks at 8 retrieved docs (p<0.01). Vendor claim contradicted by independent replication.",
			"Gecontroleerde studie (NeurIPS 2024, L3 gerepliceerd) met n=5000 queries toont piek nauwkeurigheid bij 8 opgehaalde docs (p<0.01). Vendor claim wordt tegensproken door onafhankelijke replicatie.",
		),
		supportingClaimIds: [
			"claim_defghijklmnopqrs",
			"claim_efghijklmnopqrst",
		],
		originalSources: [
			createSourceReference({
				sourceId: "neurips2024-rag-study",
				url: "https://neurips.cc/paper/2024/rag-context",
				title: "Context Window Size vs RAG Accuracy",
			}),
			createSourceReference({
				sourceId: "vendor-claim-rag",
				url: "https://vendor.example.com/rag-marketing",
				title: "Vendor RAG Marketing Page",
				tier: 3,
			}),
		],
		evidenceClassification: "RESEARCH_FINDING",
		confidence: 0.94,
		materialUncertainty: "low",
		educationalValue: "foundational",
		knowledgeDomain: "models-inference-scientific",
		targetAudience: [
			"system-architects",
			"ml-platform-leads",
			"principal-engineers",
		],
		counterevidence: [
			createCounterevidence({
				description:
					"Vendor marketing claims unlimited context improves all RAG tasks",
				evidenceClassification: "VENDOR_CLAIM",
				impact: "contradictory",
			}),
		],
		tags: ["correct", "rag", "context-window", "misconception"],
	});

// ============================================================================
// Fixture 4: Existing lesson needs more appropriate prerequisite sequencing
// ============================================================================

export const FIXTURE_PREREQUISITE_SEQUENCING: BookDeltaProposal =
	createProposal({
		proposalId: "bdp_fixt000000000004",
		category: "RESTRUCTURE",
		title: createBilingualString(
			"Restructure Learning Sequence: Agent Observability Prerequisites",
			"Herstructureer Leervolgorde: Agent Observabiliteit Vereisten",
		),
		targetConcept:
			"Prerequisite dependency chain for agent observability: structured logging → distributed tracing → evaluation hooks → observability spine",
		currentGap: createBilingualString(
			"Current lesson presents observability spine as a monolithic concept without establishing that structured logging and trace context propagation are prerequisites for evaluation hooks",
			"Huidige les presenteert observability spine als een monolithisch concept zonder te etablereen dat gestructureerde logging en trace context propagatie vereisten zijn voor evaluation hooks",
		),
		proposedChange: createBilingualString(
			"Reorganize into progressive modules: 1) Structured logging foundations, 2) Trace context propagation, 3) Distributed tracing integration, 4) Evaluation hooks as spine consumers, 5) Observability spine architecture",
			"Herorganiseer in progressieve modules: 1) Gestructureerde logging fundamenten, 2) Trace context propagatie, 3) Distributed tracing integratie, 4) Evaluation hooks als spine consumers, 5) Observability spine architectuur",
		),
		rationale: createBilingualString(
			"Architecture principle AP-017 (Observability Spine) requires testable consequences that depend on logging/tracing primitives. Learners cannot validate AP-017 without first mastering prerequisites.",
			"Architectuurprincipe AP-017 (Observability Spine) vereist testbare gevolgen die afhangen van logging/tracing primitives. Leerlingen kunnen AP-017 niet valideren zonder eerst prerequisites te beheersen.",
		),
		supportingClaimIds: ["claim_fghijklmnopqrstu"],
		originalSources: [
			createSourceReference({
				sourceId: "ap-017",
				url: "https://ai-intelligence-blog/principles/AP-017",
				title: "Architecture Principle AP-017: Observability Spine",
			}),
		],
		evidenceClassification: "VERIFIED_FACT",
		confidence: 0.81,
		educationalValue: "significant",
		knowledgeDomain: "architecture-security-governance",
		targetAudience: ["system-architects", "principal-engineers"],
		principleReferences: [
			createPrincipleReference({
				principleId: "AP-017",
				title: "Observability Spine",
				relationship: "requires-explanation",
			}),
		],
		tags: [
			"restructure",
			"observability",
			"prerequisites",
			"learning-sequence",
		],
	});

// ============================================================================
// Fixture 5: Technically correct explanation that is cognitively difficult to follow
// ============================================================================

export const FIXTURE_COGNITIVE_ACCESSIBILITY: BookDeltaProposal =
	createProposal({
		proposalId: "bdp_fixt000000000005",
		category: "REFINE",
		title: createBilingualString(
			"Refine Explanation: Schema Enforcement vs Sandbox Isolation Trade-off Analysis",
			"Verbeter Uitleg: Trade-off Analyse Schema Enforcement vs Sandbox Isolatie",
		),
		targetConcept:
			"Comparative analysis of schema enforcement and sandbox isolation as complementary agent bounding strategies",
		currentGap: createBilingualString(
			'Technically accurate but dense explanation uses nested conditionals, undefined jargon ("capability surface", "invocation topology"), and lacks concrete decision framework',
			'Technisch accurate maar dure uitleg gebruikt geneste conditionals, ongedefinieerde jargon ("capability surface", "invocation topology"), en mist een concreet beslissingsframework',
		),
		proposedChange: createBilingualString(
			'Restructure with BLUF summary, comparison table, decision flowchart, concrete scenarios (low-trust plugin vs high-trust internal tool), and explicit "choose schema enforcement when..." / "choose sandbox when..." guidance',
			'Herstructureer met BLUF samenvatting, vergelijkingstabel, beslissingsflowchart, concrete scenario\'s (low-trust plugin vs high-trust internal tool), en expliciete "kies schema enforcement wanneer..." / "kies sandbox wanneer..." richtlijnen',
		),
		rationale: createBilingualString(
			"ADHD readability metrics show 38 words/sentence, 0.22 passive voice, jargon density 0.15 — all exceeding thresholds. Architectural decision records require accessible presentation for review.",
			"ADHD leesbaarheidsmetrics tonen 38 woorden/zin, 0.22 lijdende vorm, jargon dichtheid 0.15 — allemaal boven drempels. Architecturale beslissingsrecords vereisen toegankelijke presentatie voor review.",
		),
		supportingClaimIds: ["claim_ghijklmnopqrstuv"],
		originalSources: [
			createSourceReference({
				sourceId: "adr-bounding-strategies",
				url: "https://github.com/example/adr-bounding",
				title: "ADR: Bounding Strategies for Agent Orchestration",
			}),
		],
		evidenceClassification: "VERIFIED_FACT",
		confidence: 0.87,
		educationalValue: "significant",
		knowledgeDomain: "agentic-ai-software-engineering",
		targetAudience: [
			"system-architects",
			"principal-engineers",
			"security-architects",
		],
		accessibility: createAccessibilityConsiderations({
			explicitObjectives: true,
			explicitPrerequisites: true,
			concreteExamples: true,
			clearDistinctions: true,
			manageableDensity: true,
			cognitiveLoadAssessment:
				"Current explanation exceeds ADHD readability thresholds; proposed restructuring targets intrinsic load reduction via comparison table and decision framework",
		}),
		tags: [
			"refine",
			"accessibility",
			"adhd",
			"schema-enforcement",
			"sandbox",
		],
	});

// ============================================================================
// Fixture 6: New product announcement with no enduring educational relevance
// ============================================================================

export const FIXTURE_TRANSIENT_PRODUCT: BookDeltaProposal = createProposal({
	proposalId: "bdp_fixt000000000006",
	category: "NONE",
	title: createBilingualString(
		"No Improvement Proposed",
		"Geen Verbetering Voorgesteld",
	),
	targetConcept:
		"Vendor X announces Model Y v2.1 with 5% latency improvement",
	currentGap: createBilingualString(
		"No verified findings with enduring educational value requiring improvement",
		"Geen geverifieerde bevindingen met duurzame leerwaarde die verbetering vereisen",
	),
	proposedChange: createBilingualString(
		"No change proposed",
		"Geen wijziging voorgesteld",
	),
	rationale: createBilingualString(
		"Product announcement lacks architectural significance, independent verification, or reusable technical mechanism. Version bump with incremental improvement does not meet educational value threshold.",
		"Product aankondiging mist architecturale significantie, onafhankelijke verificatie, of herbruikbaar technisch mechanisme. Versie bump met incrementale verbetering voldoet niet aan de educatieve waardedrempel.",
	),
	supportingClaimIds: [],
	originalSources: [],
	evidenceClassification: "UNVERIFIED",
	confidence: 1.0,
	materialUncertainty: "low",
	educationalValue: "niche",
	knowledgeDomain: "cross-cutting",
	targetAudience: ["system-architects"],
	acceptanceCriteria: [
		createAcceptanceCriterion({
			criterionId: "none-confirmed",
			description:
				"Explicit confirmation that no actionable improvement is supported by evidence",
			measurable: true,
			verificationMethod: "content-inspection",
			evidenceRequired: ["Evaluation record", "Evidence summary"],
		}),
	],
	durability: createDurabilityAssessment({
		conceptualImportance: "low",
		technicalAccuracy: "high",
		reusability: "cross-domain",
		multiContextRelevance: false,
		prerequisiteDependencies: [],
		likelihoodOfFutureChange: "low",
		authoritativeEvidenceAvailable: true,
		practicalApplicability: "low",
		correctsRecurringMisconception: false,
		progressiveLearningValue: "low",
		maintenanceCostEstimate: "low",
	}),
	accessibility: createAccessibilityConsiderations({
		explicitObjectives: false,
		explicitPrerequisites: false,
		progressiveDisclosure: false,
		contextBeforeComplexity: false,
		meaningfulSequencing: false,
		concreteExamples: false,
		accurateAnalogies: false,
		clearDistinctions: false,
		manageableDensity: true,
		independentExploration: false,
		reducedRepetition: true,
		cognitiveLoadAssessment: "NONE proposal - no cognitive load",
	}),
	tags: ["none", "transient", "product-announcement"],
});

// ============================================================================
// Fixture 7: Vendor-specific recommendation incorrectly generalized into universal guidance
// ============================================================================

export const FIXTURE_VENDOR_GENERALIZATION: BookDeltaProposal = createProposal({
	proposalId: "bdp_fixt000000000007",
	category: "CORRECT",
	title: createBilingualString(
		"Correct Misconception: Vendor-Specific Fine-Tuning Recipe Generalized as Universal Best Practice",
		"Corrigeer Misverstand: Vendor-Specifiek Fine-Tuning Recept Gegeneraliseerd als Universele Best Practice",
	),
	targetConcept:
		"Applicability boundaries of vendor-recommended fine-tuning hyperparameters",
	currentGap: createBilingualString(
		"Educational material presents Vendor X fine-tuning recipe (LoRA r=64, alpha=128, 3 epochs) as universally optimal, without disclosing it was validated only on Vendor X model family with proprietary data",
		"Educatief materiaal presenteert Vendor X fine-tuning recept (LoRA r=64, alpha=128, 3 epochs) als universeel optimaal, zonder openbaaring dat het alleen gevalideerd was op Vendor X modellen met proprietary data",
	),
	proposedChange: createBilingualString(
		"Reframe as vendor-specific configuration with explicit applicability boundaries: model architecture, data characteristics, compute budget. Add independent benchmark showing different optima for other architectures.",
		"Herframeer als vendor-specifieke configuratie met expliciete toepassingsgrenzen: modelarchitectuur, data karakteristieken, compute budget. Voeg onafhankelijke benchmark toe die verschillende optima toont voor andere architecturen.",
	),
	rationale: createBilingualString(
		"Independent replication (ICLR 2024) shows optimal LoRA rank varies 8-256 across architectures. Vendor recipe fails on non-vendor models (p<0.001). Universal claim is vendor marketing, not verified fact.",
		"Onafhankelijke replicatie (ICLR 2024) toont optimale LoRA rank varieert 8-256 over architecturen. Vendor recept faalt op non-vendor modellen (p<0.001). Universele claim is vendor marketing, geen geverifieerd feit.",
	),
	supportingClaimIds: ["claim_hijklmnopqrstuvw", "claim_ijklmnopqrstuvwx"],
	originalSources: [
		createSourceReference({
			sourceId: "vendor-finetune-guide",
			url: "https://vendor.example.com/finetune",
			title: "Vendor Fine-Tuning Guide",
			tier: 3,
		}),
		createSourceReference({
			sourceId: "iclr2024-lora-study",
			url: "https://iclr.cc/paper/2024/lora-generalization",
			title: "LoRA Generalization Across Architectures",
		}),
	],
	evidenceClassification: "RESEARCH_FINDING",
	confidence: 0.91,
	materialUncertainty: "low",
	educationalValue: "significant",
	knowledgeDomain: "models-inference-scientific",
	targetAudience: [
		"ml-platform-leads",
		"system-architects",
		"principal-engineers",
	],
	counterevidence: [
		createCounterevidence({
			description:
				"Vendor documentation presents recipe as universal best practice",
			evidenceClassification: "VENDOR_CLAIM",
			impact: "contradictory",
		}),
	],
	methodologicalCaveats: createMethodologicalCaveats({
		vendorClaimVsIndependent:
			"Vendor recipe presented as universal; independent study shows architecture-dependent optima",
		experimentalVsProduction:
			"ICLR study used academic benchmarks; production workloads may differ",
	}),
	tags: ["correct", "fine-tuning", "vendor-generalization", "lora"],
});

// ============================================================================
// Fixture 8: Gartner/McKinsey finding with important methodological limitations
// ============================================================================

export const FIXTURE_CONSULTANCY_LIMITATIONS: BookDeltaProposal =
	createProposal({
		proposalId: "bdp_fixt000000000008",
		category: "EXTEND",
		title: createBilingualString(
			"Extend Coverage: McKinsey AI Productivity Claims — Methodological Boundaries",
			"Uitgebreide Dekking: McKinsey AI Productiviteitsclaims — Methodologische Grenzen",
		),
		targetConcept:
			"Methodological limitations of McKinsey 2024 AI productivity survey (self-reported, n=1200, no control group, vendor-funded)",
		currentGap: createBilingualString(
			'Current summary presents "40% productivity increase" as factual finding without disclosing self-reported methodology, absence of control group, or vendor funding',
			'Huidige samenvatting presenteert "40% productiviteitsstijging" als feitelijke bevinding zonder openbaaring van self-reported methodologie, afwezigheid van controle groep, of vendor financiering',
		),
		proposedChange: createBilingualString(
			"Add methodological caveats section: self-reported perceptions ≠ measured output; no baseline control; vendor funding disclosed; results not independently replicated; correlation not causation",
			"Voeg methodologische caveats sectie toe: self-reported percepties ≠ gemeten output; geen baseline controle; vendor financiering bekend; resultaten niet onafhankelijk gerepliceerd; correlatie niet causaliteit",
		),
		rationale: createBilingualString(
			"Consultancy reports motivate educational proposals but do not establish universal facts. Architectural decisions based on productivity claims require methodological transparency.",
			"Consultancy rapporten motiveren educatieve voorstellen maar stellen geen universele feiten vast. Architecturale beslissingen gebaseerd op productiviteitsclaims vereisen methodologische transparantie.",
		),
		supportingClaimIds: ["claim_ijklmnopqrstuvwx"],
		originalSources: [
			createSourceReference({
				sourceId: "mckinsey-ai-2024",
				url: "https://mckinsey.com/ai-productivity-2024",
				title: "McKinsey AI Productivity Survey 2024",
				tier: 2,
			}),
		],
		evidenceClassification: "EXPERT_INTERPRETATION",
		confidence: 0.72,
		materialUncertainty: "high",
		educationalValue: "supplementary",
		knowledgeDomain: "economics-business-impact",
		targetAudience: [
			"technical-ctos",
			"system-architects",
			"cost-engineers",
		],
		methodologicalCaveats: createMethodologicalCaveats({
			empiricalVsInterpretation:
				"Survey measures self-reported perceptions, not objective productivity metrics",
			correlationVsCausation:
				"No control group; cannot establish causal relationship between AI adoption and productivity",
			measuredVsForecast:
				"Includes forward-looking estimates not grounded in measured outcomes",
			vendorClaimVsIndependent:
				"Study funded by AI vendor consortium; independent replication absent",
			populationScope:
				"Surveyed organizations self-selected; may not represent broader enterprise population",
			generalizabilityLimitations: [
				"Self-selection bias in respondents",
				"No objective productivity measurements",
				"Vendor funding introduces potential bias",
				"Results specific to 2023-2024 adoption wave",
			],
			conflictingStudies: [
				"Stanford HAI 2024 shows 15% median increase with control group",
			],
		}),
		tags: [
			"extend",
			"mckinsey",
			"productivity",
			"methodology",
			"consultancy",
		],
	});

// ============================================================================
// Fixture 9: Strategic research result suggesting useful educational topic but not an architectural principle
// ============================================================================

export const FIXTURE_STRATEGIC_NOT_PRINCIPLE: BookDeltaProposal =
	createProposal({
		proposalId: "bdp_fixt000000000009",
		category: "ADD",
		title: createBilingualString(
			"Add Missing Explanation: Enterprise AI Governance Frameworks — Comparative Analysis",
			"Voeg Ontbrekende Uitleg Toe: Enterprise AI Governance Frameworks — Vergelijkende Analyse",
		),
		targetConcept:
			"Comparative analysis of NIST AI RMF, ISO 42001, EU AI Act compliance frameworks for enterprise adoption",
		currentGap: createBilingualString(
			"No existing educational material compares these three governance frameworks for technical architects. Practitioners must piece together requirements from separate legal/standards documents.",
			"Geen bestaand educatief materiaal vergelijkt deze drie governance frameworks voor technische architecten. Practitioners moeten eisen uit afzonderlijke juridische/standards documenten samenstellen.",
		),
		proposedChange: createBilingualString(
			"Create comparative framework: scope alignment table, technical control mapping, implementation sequence, audit evidence requirements, and architectural decision points for each framework",
			"Creëer vergelijkend framework: scope alignment tabel, technische control mapping, implementatievolgorde, audit bewijsvereisten, en architecturale beslissingspunten voor elk framework",
		),
		rationale: createBilingualString(
			"Strategic research (Gartner, Forrester, independent legal analysis) identifies governance compliance as top-3 enterprise blocker. Technical architects need actionable comparison, not legal text.",
			"Strategisch onderzoek (Gartner, Forrester, onafhankelijke juridische analyse) identificeert governance compliance als top-3 enterprise blokkerende factor. Technische architecten hebben actionable vergelijking nodig, geen juridische tekst.",
		),
		supportingClaimIds: ["claim_jklmnopqrstuvwxy"],
		originalSources: [
			createSourceReference({
				sourceId: "nist-ai-rmf",
				url: "https://nist.gov/ai-rmf",
				title: "NIST AI Risk Management Framework",
			}),
			createSourceReference({
				sourceId: "iso-42001",
				url: "https://iso.org/42001",
				title: "ISO/IEC 42001 AI Management System",
			}),
			createSourceReference({
				sourceId: "eu-ai-act",
				url: "https://eur-lex.europa.eu/ai-act",
				title: "EU AI Act",
			}),
		],
		evidenceClassification: "ORIGINAL_REPORTING",
		confidence: 0.83,
		materialUncertainty: "medium",
		educationalValue: "significant",
		knowledgeDomain: "architecture-security-governance",
		targetAudience: [
			"system-architects",
			"security-architects",
			"technical-ctos",
		],
		principleReferences: [
			createPrincipleReference({
				principleId: "AP-042",
				title: "Governance by Design",
				relationship: "illustrates",
			}),
		],
		tags: ["add", "governance", "compliance", "enterprise", "frameworks"],
	});

// ============================================================================
// Fixture 10: Concept already adequately covered by the thesaurus
// ============================================================================

export const FIXTURE_THESAURUS_COVERED: BookDeltaProposal = createProposal({
	proposalId: "bdp_fixt000000000010",
	category: "NONE",
	title: createBilingualString(
		"No Improvement Proposed",
		"Geen Verbetering Voorgesteld",
	),
	targetConcept: 'Definition of "Agent" as autonomous software entity',
	currentGap: createBilingualString(
		"Thesaurus entry thes_abcdefghijklmnop already provides canonical bilingual definition, aliases, forbidden terms, and authoritative sources",
		"Thesaurus entry thes_abcdefghijklmnop biedt al canonieke tweetalige definitie, aliases, verboden termen, en autoritatieve bronnen",
	),
	proposedChange: createBilingualString(
		"No change proposed — route terminology improvements to thesaurus change mechanism",
		"Geen wijziging voorgesteld — routeer terminologieverbeteringen naar thesaurus wijzigingsmechanisme",
	),
	rationale: createBilingualString(
		'The concept "Agent" is already established in the persistent thesaurus (ESTABLISHED lifecycle status) with full bilingual definition, forbidden terms, and source traceability. Book Delta does not duplicate glossary definitions.',
		'Het concept "Agent" is al gevestigd in de persistente thesaurus (ESTABLISHED lifecycle status) met volledige tweetalige definitie, verboden termen, en bron traceerbaarheid. Book Delta dupliceert geen glossary definities.',
	),
	supportingClaimIds: [],
	originalSources: [],
	evidenceClassification: "VERIFIED_FACT",
	confidence: 1.0,
	materialUncertainty: "low",
	educationalValue: "niche",
	knowledgeDomain: "cross-cutting",
	targetAudience: ["system-architects"],
	terminologyReferences: [
		createTerminologyReference({
			entryId: "thes_abcdefghijklmnop",
			term: "Agent",
			relationship: "subject-of-proposal",
		}),
	],
	acceptanceCriteria: [
		createAcceptanceCriterion({
			criterionId: "thesaurus-covered",
			description: "Verify thesaurus entry exists and is ESTABLISHED",
			measurable: true,
			verificationMethod: "cross-reference-check",
			evidenceRequired: ["Thesaurus entry ID", "Lifecycle status"],
		}),
	],
	durability: createDurabilityAssessment({
		conceptualImportance: "low",
		technicalAccuracy: "high",
		reusability: "cross-domain",
		multiContextRelevance: false,
		prerequisiteDependencies: [],
		likelihoodOfFutureChange: "low",
		authoritativeEvidenceAvailable: true,
		practicalApplicability: "low",
		correctsRecurringMisconception: false,
		progressiveLearningValue: "low",
		maintenanceCostEstimate: "low",
	}),
	accessibility: createAccessibilityConsiderations({
		explicitObjectives: false,
		explicitPrerequisites: false,
		progressiveDisclosure: false,
		contextBeforeComplexity: false,
		meaningfulSequencing: false,
		concreteExamples: false,
		accurateAnalogies: false,
		clearDistinctions: false,
		manageableDensity: true,
		independentExploration: false,
		reducedRepetition: true,
		cognitiveLoadAssessment:
			"NONE proposal - thesaurus already covers this concept",
	}),
	tags: ["none", "thesaurus", "terminology", "agent"],
});

// ============================================================================
// Fixture 11: Existing architecture principle requiring an educational example rather than modification
// ============================================================================

export const FIXTURE_PRINCIPLE_NEEDS_EXAMPLE: BookDeltaProposal =
	createProposal({
		proposalId: "bdp_fixt000000000016",
		category: "EXTEND",
		title: createBilingualString(
			"Extend Coverage: AP-023 (Cost Envelope) — Add Worked Example for Multi-Agent Workflow",
			"Uitgebreide Dekking: AP-023 (Cost Envelope) — Voeg Uitgewerkt Voorbeeld Toe voor Multi-Agent Workflow",
		),
		targetConcept:
			"Practical worked example of Cost Envelope principle applied to a 5-agent research workflow with token budgeting",
		currentGap: createBilingualString(
			"AP-023 states the principle and testable consequences but lacks a concrete multi-agent worked example showing token allocation, circuit breaker configuration, and cost attribution across agents",
			"AP-023 stelt het principe en testbare gevolgen maar mist een concreet multi-agent uitgewerkt voorbeeld dat tokenallocatie, circuit breaker configuratie, en kostentoerekening over agents toont",
		),
		proposedChange: createBilingualString(
			"Add worked example: 5-agent research workflow (planner, researcher, coder, reviewer, synthesizer) with per-agent token budgets, shared cost envelope, failure injection test results, and migration path from single-agent budget",
			"Voeg uitgewerkt voorbeeld toe: 5-agent research workflow (planner, researcher, coder, reviewer, synthesizer) met per-agent tokenbudgetten, gedeeld cost envelope, failure injection test resultaten, en migratiepad van single-agent budget",
		),
		rationale: createBilingualString(
			"AP-023 is ESTABLISHED with verified testable consequences. Educational improvement is an illustrative example, not a principle modification. Principle change process (ADD/CONFIRM/REFINE/MERGE/SUPERSEDE) is separate from Book Delta.",
			"AP-023 is ESTABLISHED met geverifieerde testbare gevolgen. Educatieve verbetering is een illustrerend voorbeeld, geen principemodificatie. Principes wijzigingsproces (ADD/CONFIRM/REFINE/MERGE/SUPERSEDE) is gescheiden van Book Delta.",
		),
		supportingClaimIds: ["claim_lmnopqrstuvwxyza"],
		originalSources: [
			createSourceReference({
				sourceId: "ap-023",
				url: "https://ai-intelligence-blog/principles/AP-023",
				title: "Architecture Principle AP-023: Cost Envelope",
			}),
			createSourceReference({
				sourceId: "multi-agent-cost-study",
				url: "https://github.com/example/multi-agent-cost",
				title: "Multi-Agent Cost Attribution Study",
			}),
		],
		evidenceClassification: "VERIFIED_FACT",
		confidence: 0.89,
		materialUncertainty: "low",
		educationalValue: "significant",
		knowledgeDomain: "agentic-ai-software-engineering",
		targetAudience: [
			"system-architects",
			"principal-engineers",
			"cost-engineers",
			"ml-platform-leads",
		],
		principleReferences: [
			createPrincipleReference({
				principleId: "AP-023",
				title: "Cost Envelope",
				relationship: "illustrates",
			}),
		],
		tags: [
			"extend",
			"cost-envelope",
			"ap-023",
			"worked-example",
			"multi-agent",
		],
	});

// ============================================================================
// Fixture 12: Proposal duplicating one from a previous edition
// ============================================================================

export const FIXTURE_DUPLICATE_PROPOSAL: BookDeltaProposal = createProposal({
	proposalId: "bdp_fixt000000000016",
	category: "ADD",
	title: createBilingualString(
		"Add Missing Explanation: Transformer Attention Mechanism Variants",
		"Voeg Ontbrekende Uitleg Toe: Transformer Attention Mechanism Varianten",
	),
	targetConcept:
		"Comparative analysis of Flash Attention, Paged Attention, and Ring Attention for long-context inference",
	currentGap: createBilingualString(
		"Educational material covers standard attention but not the three main optimized variants used in production LLM serving",
		"Educatief materiaal dekt standaard attention maar niet de drie hoof geoptimaliseerde varianten gebruikt in productie LLM serving",
	),
	proposedChange: createBilingualString(
		"Add comparative section with mechanism, memory complexity, latency profile, hardware requirements, and model compatibility for each variant",
		"Voeg vergelijkende sectie toe met mechanisme, geheugencomplexiteit, latentieprofiel, hardwarevereisten, en modelcompatibiliteit voor elke variant",
	),
	rationale: createBilingualString(
		"Verified research (MLSys 2024, vLLM benchmarks) establishes these as distinct architectural patterns with different trade-offs. However, this exact proposal was made in edition_2024-11-15 (bdp_dup0000000000001) and is already APPROVED.",
		"Geverifieerd onderzoek (MLSys 2024, vLLM benchmarks) stelt deze vast als distincte architecturale patronen met verschillende trade-offs. Dit exacte voorstel werd echter al gedaan in edition_2024-11-15 (bdp_dup0000000000001) en is al APPROVED.",
	),
	supportingClaimIds: ["claim_mnopqrstuvwxyzab"],
	originalSources: [
		createSourceReference({
			sourceId: "mlsys2024-attention",
			url: "https://mlsys.org/2024/attention",
			title: "Attention Mechanism Variants in Production",
		}),
	],
	evidenceClassification: "RESEARCH_FINDING",
	confidence: 0.88,
	materialUncertainty: "low",
	educationalValue: "significant",
	knowledgeDomain: "models-inference-scientific",
	targetAudience: [
		"system-architects",
		"ml-platform-leads",
		"principal-engineers",
	],
	historicalProposalReferences: [
		{
			proposalId: "bdp_dup0000000000001",
			editionDate: "2024-11-15",
			relationship: "duplicate",
			resolutionNote:
				"Identical target concept and category; previous proposal already APPROVED",
		},
	],
	uniquenessStatus: "duplicate",
	tags: ["add", "attention", "transformer", "duplicate"],
});

// ============================================================================
// Fixture 13: New evidence strengthening an existing proposal
// ============================================================================

export const FIXTURE_STRENGTHENING_EVIDENCE: BookDeltaProposal = createProposal(
	{
		proposalId: "bdp_fixt000000000017",
		category: "REFINE",
		title: createBilingualString(
			"Refine Explanation: RAG Chunking Strategies — Add Semantic Chunking Evidence",
			"Verbeter Uitleg: RAG Chunking Strategieën — Voeg Semantic Chunking Bewijs Toe",
		),
		targetConcept:
			"Comparative effectiveness of fixed-size vs semantic vs recursive chunking for RAG retrieval quality",
		currentGap: createBilingualString(
			"Existing proposal (bdp_chunk00000000001, edition_2024-12-01) covers fixed-size and recursive chunking but semantic chunking was not yet verified. New independent replication confirms semantic chunking superiority for technical documents.",
			"Bestaand voorstel (bdp_chunk00000000001, edition_2024-12-01) dekt fixed-size en recursive chunking maar semantic chunking was nog niet geverifieerd. Nieuwe onafhankelijke replicatie bevestigt superioriteit van semantic chunking voor technische documenten.",
		),
		proposedChange: createBilingualString(
			"Update existing proposal with new L3 replicated evidence: semantic chunking improves nDCG@10 by 23% over fixed-size (p<0.001, n=10000) for technical documentation corpora. Add implementation pattern using sentence-transformers.",
			"Update bestaand voorstel met nieuw L3 gerepliceerd bewijs: semantic chunking verbetert nDCG@10 met 23% ten opzichte van fixed-size (p<0.001, n=10000) voor technische documentatie corpora. Voeg implementatiepatroon toe met sentence-transformers.",
		),
		rationale: createBilingualString(
			"New independent replication (arXiv:2501.00123, reproduced by 3 labs) strengthens the existing proposal. The proposal category remains REFINE; evidence classification upgrades from RESEARCH_FINDING to VERIFIED_FACT.",
			"Nieuwe onafhankelijke replicatie (arXiv:2501.00123, gerepliceerd door 3 labs) versterkt het bestaande voorstel. De voorstelcategorie blijft REFINE; bewijsklassificatie upgrades van RESEARCH_FINDING naar VERIFIED_FACT.",
		),
		supportingClaimIds: [
			"claim_nopqrstuvwxyzabc",
			"claim_opqrstuvwxyzabcd",
		],
		originalSources: [
			createSourceReference({
				sourceId: "arxiv-semantic-chunking",
				url: "https://arxiv.org/abs/2501.00123",
				title: "Semantic Chunking for Technical RAG",
			}),
			createSourceReference({
				sourceId: "lab-replication-1",
				url: "https://lab1.example.com/replication",
				title: "Lab 1 Independent Replication",
			}),
			createSourceReference({
				sourceId: "lab-replication-2",
				url: "https://lab2.example.com/replication",
				title: "Lab 2 Independent Replication",
			}),
			createSourceReference({
				sourceId: "lab-replication-3",
				url: "https://lab3.example.com/replication",
				title: "Lab 3 Independent Replication",
			}),
		],
		evidenceClassification: "VERIFIED_FACT",
		confidence: 0.95,
		materialUncertainty: "low",
		educationalValue: "significant",
		knowledgeDomain: "models-inference-scientific",
		targetAudience: [
			"system-architects",
			"ml-platform-leads",
			"principal-engineers",
		],
		historicalProposalReferences: [
			{
				proposalId: "bdp_chunk00000000001",
				editionDate: "2024-12-01",
				relationship: "strengthens-existing",
				resolutionNote:
					"New L3 replicated evidence upgrades evidence classification and adds implementation pattern",
			},
		],
		uniquenessStatus: "strengthens-existing",
		tags: [
			"refine",
			"rag",
			"chunking",
			"semantic",
			"strengthening-evidence",
		],
	},
);

// ============================================================================
// Fixture 14: Rejected historical proposal being reintroduced without new justification
// ============================================================================

export const FIXTURE_REJECTED_REINTRODUCED: BookDeltaProposal = createProposal({
	proposalId: "bdp_fixt000000000017",
	category: "NONE", // Corrected to NONE because evidence doesn't support reintroduction
	title: createBilingualString(
		"No Improvement Proposed",
		"Geen Verbetering Voorgesteld",
	),
	targetConcept:
		"Claim that Reinforcement Learning from Human Feedback universally improves safety across all model scales and tasks",
	currentGap: createBilingualString(
		"Previous proposal (bdp_rlhf000000000001, edition_2024-10-01) was REJECTED because evidence showed RLHF can degrade safety on edge cases (polarized responses, reward hacking). No new evidence has emerged to justify reintroduction.",
		"Vorige voorstel (bdp_rlhf000000000001, edition_2024-10-01) was REJECTED omdat bewijs toonde dat RLHF veiligheid kan degraderen op edge cases (gepolariseerde responses, reward hacking). Geen nieuw bewijs is ontstaan om herintroduktie te rechtvaardigen.",
	),
	proposedChange: createBilingualString(
		"No change — maintain rejection. Current evidence still supports nuanced view: RLHF improves average-case safety but can degrade worst-case. Educational material should reflect this nuance.",
		"Geen wijziging — behoud rejectie. Huidig bewijs ondersteunt genuanceerde view: RLHF verbetert average-case veiligheid maar kan worst-case degraderen. Educatief materiaal zou deze nuance moeten weerspiegelen.",
	),
	rationale: createBilingualString(
		'Historical proposal bdp_rlhf000000000001 was reviewed and REJECTED on 2024-10-15 with rationale "Insufficient evidence for universal claim; counterevidence shows degradation on adversarial benchmarks." No new L2+ evidence has emerged since. Reintroduction without materially new evidence violates historical continuity.',
		'Historisch voorstel bdp_rlhf000000000001 werd gereviewd en REJECTED op 2024-10-15 met rational "Onvoldoende bewijs voor universele claim; counterevidence toont degradatie op adversariale benchmarks." Geen nieuw L2+ bewijs is sindsdien onstaan. Herintroduktie zonder materieel nieuw bewijs schendt historische continuïteit.',
	),
	supportingClaimIds: [],
	originalSources: [],
	evidenceClassification: "RESEARCH_FINDING",
	confidence: 0.78,
	materialUncertainty: "medium",
	educationalValue: "supplementary",
	knowledgeDomain: "models-inference-scientific",
	targetAudience: [
		"system-architects",
		"ml-platform-leads",
		"security-architects",
	],
	historicalProposalReferences: [
		{
			proposalId: "bdp_rlhf000000000001",
			editionDate: "2024-10-01",
			relationship: "duplicate",
			resolutionNote:
				"REJECTED previously; no new evidence justifies reopening",
		},
	],
	uniquenessStatus: "duplicate",
	tags: ["none", "rlhf", "safety", "rejected", "historical-continuity"],
	acceptanceCriteria: [
		createAcceptanceCriterion({
			criterionId: "none-rejected-reintroduction",
			description:
				"Confirm rejected proposal remains rejected without new evidence",
			measurable: true,
			verificationMethod: "content-inspection",
			evidenceRequired: [
				"Historical proposal record",
				"Evidence review log",
			],
		}),
	],
});

// ============================================================================
// Fixture 15: Inaccessible target book or chapter
// ============================================================================

export const FIXTURE_INACCESSIBLE_TARGET: BookDeltaProposal = createProposal({
	proposalId: "bdp_fixt000000000018",
	category: "ADD",
	title: createBilingualString(
		"Add Missing Explanation: Distributed Training Communication Patterns",
		"Voeg Ontbrekende Uitleg Toe: Gedistribueerde Training Communicatiepatronen",
	),
	targetConcept:
		"All-Reduce, All-Gather, and Pipeline Parallel communication patterns in multi-node training",
	currentGap: createBilingualString(
		"Standard distributed systems textbooks cover MPI patterns but not the specific communication patterns used in modern LLM training (ZeRO, 3D parallelism, overlap strategies)",
		"Standaard distributed systems handboeken dekken MPI patronen maar niet de specifieke communicatiepatronen gebruikt in moderne LLM training (ZeRO, 3D parallelism, overlap strategieën)",
	),
	proposedChange: createBilingualString(
		"Create new educational section with communication pattern diagrams, bandwidth/latency models, overlap computation/communication strategies, and failure recovery patterns",
		"Creëer nieuwe educatieve sectie met communicatiepatroon diagrammen, bandbreedte/latentie modellen, overlap berekening/communicatie strategieën, en herstelpatronen",
	),
	rationale: createBilingualString(
		"Verified research (SC 2024, MegaScale benchmarks) identifies communication overlap as primary bottleneck. No accessible textbook covers modern patterns. Target document (standard textbook) confirmed inaccessible for comparison.",
		"Geverifieerd onderzoek (SC 2024, MegaScale benchmarks) identificeert communicatie overlap als primaire bottleneck. Geen toegankelijk handboek dekt moderne patronen. Target document (standaard handboek) bevestigd ontoegankelijk voor vergelijking.",
	),
	supportingClaimIds: ["claim_pqrstuvwxyzabcde"],
	originalSources: [
		createSourceReference({
			sourceId: "sc2024-distributed",
			url: "https://sc24.supercomputing.org/distributed",
			title: "SC 2024 Distributed Training Patterns",
		}),
		createSourceReference({
			sourceId: "megascale-bench",
			url: "https://github.com/megascale/benchmarks",
			title: "MegaScale Communication Benchmarks",
		}),
	],
	evidenceClassification: "RESEARCH_FINDING",
	confidence: 0.86,
	materialUncertainty: "medium",
	educationalValue: "significant",
	knowledgeDomain: "models-inference-scientific",
	targetAudience: [
		"system-architects",
		"ml-platform-leads",
		"principal-engineers",
	],
	targetDocument: createTargetDocumentReference({
		accessibility: "inaccessible",
		accessNote:
			"Standard distributed systems textbook (Coulouris et al.) does not cover modern LLM training patterns; no updated edition available",
		comparisonPerformed: true,
		comparisonResult: "gap-confirmed",
	}),
	tags: [
		"add",
		"distributed-training",
		"communication",
		"inaccessible-target",
	],
});

// ============================================================================
// Fixture 16: Proposed correction unsupported by original evidence
// ============================================================================

export const FIXTURE_UNSUPPORTED_CORRECTION: BookDeltaProposal = createProposal(
	{
		proposalId: "bdp_fixt000000000011",
		category: "NONE", // Corrected to NONE because evidence doesn't support correction
		title: createBilingualString(
			"No Improvement Proposed",
			"Geen Verbetering Voorgesteld",
		),
		targetConcept:
			'Alleged error in "Attention Is All You Need" positional encoding formula',
		currentGap: createBilingualString(
			"Claim that original Transformer paper has incorrect positional encoding formula (sin/cos swapped)",
			"Claim dat oorspronkelijke Transformer paper onjuiste positional encoding formule heeft (sin/cos omgewisseld)",
		),
		proposedChange: createBilingualString(
			"No change proposed",
			"Geen wijziging voorgesteld",
		),
		rationale: createBilingualString(
			"Investigation of original paper (NeurIPS 2017) and 5 independent implementations confirms formula is correct. The alleged error originated from a misread blog post (Tier 3, unverified). No authoritative source supports the correction. Book Delta does not propose corrections without evidence.",
			"Onderzoek van oorspronkelijke paper (NeurIPS 2017) en 5 onafhankelijke implementaties bevestigt formule is correct. De vermeende fout stamt van een misgelezen blog post (Tier 3, ongeverifieerd). Geen autoritatieve bron ondersteunt de correctie. Book Delta stelt geen correcties voor zonder bewijs.",
		),
		supportingClaimIds: [],
		originalSources: [],
		evidenceClassification: "UNVERIFIED",
		confidence: 0.95,
		materialUncertainty: "low",
		educationalValue: "niche",
		knowledgeDomain: "models-inference-scientific",
		targetAudience: ["system-architects", "ml-platform-leads"],
		counterevidence: [
			createCounterevidence({
				description:
					"Original paper and 5 independent implementations confirm formula correctness",
				evidenceClassification: "VERIFIED_FACT",
				impact: "contradictory",
			}),
			createCounterevidence({
				description:
					"Alleged error source is Tier 3 blog post with no independent verification",
				evidenceClassification: "UNVERIFIED",
				impact: "qualifying",
			}),
		],
		acceptanceCriteria: [
			createAcceptanceCriterion({
				criterionId: "no-evidence-for-correction",
				description:
					"Confirm no authoritative evidence supports the proposed correction",
				measurable: true,
				verificationMethod: "technical-validation",
				evidenceRequired: [
					"Original paper verification",
					"Independent implementation check",
				],
			}),
		],
		durability: createDurabilityAssessment({
			conceptualImportance: "low",
			technicalAccuracy: "high",
			reusability: "cross-domain",
			multiContextRelevance: false,
			prerequisiteDependencies: [],
			likelihoodOfFutureChange: "low",
			authoritativeEvidenceAvailable: true,
			practicalApplicability: "low",
			correctsRecurringMisconception: false,
			progressiveLearningValue: "low",
			maintenanceCostEstimate: "low",
		}),
		tags: [
			"none",
			"unsupported-correction",
			"transformer",
			"evidence-based",
		],
	},
);

// ============================================================================
// Fixture 17: Proposal incorrectly marked APPROVED without authorization
// ============================================================================

export const FIXTURE_UNAUTHORIZED_APPROVED: BookDeltaProposal = createProposal({
	proposalId: "bdp_fixt000000000019",
	category: "ADD",
	title: createBilingualString(
		"Add Missing Explanation: Quantum-Resistant Cryptography for Agent Communication",
		"Voeg Ontbrekende Uitleg Toe: Quantum-Resistente Cryptografie voor Agent Communicatie",
	),
	targetConcept:
		"Post-quantum key exchange and signature schemes for inter-agent communication",
	currentGap: createBilingualString(
		"Current material covers classical TLS but not NIST PQC standards (ML-KEM, ML-DSA, SLH-DSA) for agent-to-agent channels",
		"Huidig materiaal dekt klassiek TLS maar niet NIST PQC standaarden (ML-KEM, ML-DSA, SLH-DSA) voor agent-naar-agent kanalen",
	),
	proposedChange: createBilingualString(
		"Add educational section on PQC algorithm selection, hybrid classical/PQC transition, performance implications, and NIST standardization timeline",
		"Voeg educatieve sectie toe over PQC algoritme selectie, hybride klassiek/PQC transitie, prestatie-implicaties, en NIST standaardisatietimeline",
	),
	rationale: createBilingualString(
		"NIST PQC standardization (2024) establishes ML-KEM/ML-DSA/SLH-DSA as standards. Agent architectures with long-lived communications need migration guidance. This proposal is CANDIDATE — NOT APPROVED — awaiting human review authorization.",
		"NIST PQC standaardisatie (2024) stelt ML-KEM/ML-DSA/SLH-DSA vast als standaarden. Agent architecturen met langdurige communicatie hebben migratierichtlijnen nodig. Dit voorstel is CANDIDATE — NIET APPROVED — in afwachting van menselijke review autorisatie.",
	),
	supportingClaimIds: ["claim_qrstuvwxyzabcdfg"],
	originalSources: [
		createSourceReference({
			sourceId: "nist-pqc-2024",
			url: "https://nist.gov/pqc",
			title: "NIST Post-Quantum Cryptography Standards",
		}),
	],
	evidenceClassification: "VERIFIED_FACT",
	confidence: 0.88,
	materialUncertainty: "medium",
	educationalValue: "significant",
	knowledgeDomain: "architecture-security-governance",
	targetAudience: [
		"system-architects",
		"security-architects",
		"principal-engineers",
	],
	lifecycleStatus: "CANDIDATE", // Explicitly NOT APPROVED
	revisionHistory: [
		{
			revisionId: "rev_abcdefghijklmnop",
			changedAt: new Date().toISOString(),
			changedBy: "book-delta-engine",
			newLifecycleStatus: "CANDIDATE",
			fieldsChanged: ["lifecycleStatus"],
			newValues: { lifecycleStatus: "CANDIDATE" },
			justification:
				"New proposal generated; requires human review for APPROVED status",
		},
	],
	tags: ["add", "pqc", "quantum", "candidate", "not-approved"],
});

// ============================================================================
// Fixture 18: Proposed change incorrectly marked IMPLEMENTED without execution evidence
// ============================================================================

export const FIXTURE_UNAUTHORIZED_IMPLEMENTED: BookDeltaProposal =
	createProposal({
		proposalId: "bdp_fixt000000000012",
		category: "REFINE",
		title: createBilingualString(
			"Refine Explanation: MCP Protocol Security Boundaries",
			"Verbeter Uitleg: MCP Protocol Beveiligingsgrenzen",
		),
		targetConcept:
			"Security boundary analysis of Model Context Protocol (MCP) — capability delegation, namespace isolation, and supply chain risks",
		currentGap: createBilingualString(
			"Current explanation describes MCP capabilities but not the security boundaries: capability token scope, namespace isolation guarantees, and supply chain attack vectors",
			"Huidige uitleg beschrijft MCP capabilities maar niet de beveiligingsgrenzen: capability token scope, namespace isolatie garanties, en supply chain aanvalsvectoren",
		),
		proposedChange: createBilingualString(
			"Add security analysis section with threat model, capability delegation patterns, namespace isolation verification, and supply chain mitigation checklist",
			"Voeg beveiligingsanalyse sectie toe met threat model, capability delegatie patronen, namespace isolatie verificatie, en supply chain mitigatie checklist",
		),
		rationale: createBilingualString(
			"MCP specification (2024) defines capability model but security implications are not fully documented. Independent security review (Trail of Bits, 2024) identifies namespace isolation gaps. This proposal is CANDIDATE — NOT IMPLEMENTED — no educational material has been modified.",
			"MCP specificatie (2024) definieert capability model maar beveiligingsimplicaties zijn niet volledig gedocumenteerd. Onafhankelijke security review (Trail of Bits, 2024) identificeert namespace isolatie gaps. Dit voorstel is CANDIDATE — NIET IMPLEMENTED — geen educatief materiaal is gewijzigd.",
		),
		supportingClaimIds: [
			"claim_stuvwxyzabcdefgh",
			"claim_tuvwxyzabcdefghi",
		],
		originalSources: [
			createSourceReference({
				sourceId: "mcp-spec-2024",
				url: "https://modelcontextprotocol.io/spec",
				title: "MCP Specification 2024",
			}),
			createSourceReference({
				sourceId: "trailofbits-mcp",
				url: "https://trailofbits.com/mcp-audit",
				title: "Trail of Bits MCP Security Audit",
			}),
		],
		evidenceClassification: "RESEARCH_FINDING",
		confidence: 0.84,
		materialUncertainty: "medium",
		educationalValue: "significant",
		knowledgeDomain: "architecture-security-governance",
		targetAudience: [
			"system-architects",
			"security-architects",
			"principal-engineers",
		],
		lifecycleStatus: "CANDIDATE", // Explicitly NOT IMPLEMENTED
		revisionHistory: [
			{
				revisionId: "rev_bcdefghijklmnopq",
				changedAt: new Date().toISOString(),
				changedBy: "book-delta-engine",
				newLifecycleStatus: "CANDIDATE",
				fieldsChanged: ["lifecycleStatus"],
				newValues: { lifecycleStatus: "CANDIDATE" },
				justification:
					"New proposal generated; IMPLEMENTED status requires execution evidence",
			},
		],
		acceptanceCriteria: [
			createAcceptanceCriterion({
				criterionId: "implementation-evidence",
				description:
					"Verify educational material actually modified with inspectable diff",
				measurable: true,
				verificationMethod: "content-inspection",
				evidenceRequired: [
					"Git diff",
					"Deployed content URL",
					"Review record",
				],
			}),
		],
		tags: ["refine", "mcp", "security", "candidate", "not-implemented"],
	});

// ============================================================================
// Fixture 19: Daily edition producing a valid NONE result
// ============================================================================

export const FIXTURE_VALID_NONE: BookDeltaProposal = createProposal({
	proposalId: "bdp_fixt000000000020",
	category: "NONE",
	title: createBilingualString(
		"No Improvement Proposed",
		"Geen Verbetering Voorgesteld",
	),
	targetConcept:
		"Edition 2025-01-20 contained only transient product announcements and vendor marketing",
	currentGap: createBilingualString(
		"No verified findings with enduring educational value requiring improvement",
		"Geen geverifieerde bevindingen met duurzame leerwaarde die verbetering vereisen",
	),
	proposedChange: createBilingualString(
		"No change proposed",
		"Geen wijziging voorgesteld",
	),
	rationale: createBilingualString(
		"All 12 candidates in edition window were: 5 vendor announcements (Tier 3, L0), 3 minor version bumps (no architectural significance), 2 benchmark claims without methodology (L0), 2 blog summaries of existing research (no novel findings). Evaluation correctly yields NONE.",
		"Alle 12 kandidaten in editievenster waren: 5 vendor aankondigingen (Tier 3, L0), 3 minor versie bumps (geen architecturale significantie), 2 benchmark claims zonder methodologie (L0), 2 blog samenvattingen van bestaand onderzoek (geen nieuwe bevindingen). Evaluatie levert correct NONE op.",
	),
	supportingClaimIds: [],
	originalSources: [],
	evidenceClassification: "UNVERIFIED",
	confidence: 1.0,
	materialUncertainty: "low",
	educationalValue: "niche",
	knowledgeDomain: "cross-cutting",
	targetAudience: ["system-architects"],
	acceptanceCriteria: [
		createAcceptanceCriterion({
			criterionId: "none-validated",
			description:
				"Confirm evaluation ran and found no candidates meeting educational value threshold",
			measurable: true,
			verificationMethod: "content-inspection",
			evidenceRequired: [
				"Evaluation log",
				"Candidate list with rejection reasons",
			],
		}),
	],
	durability: createDurabilityAssessment({
		conceptualImportance: "low",
		technicalAccuracy: "high",
		reusability: "cross-domain",
		multiContextRelevance: false,
		prerequisiteDependencies: [],
		likelihoodOfFutureChange: "low",
		authoritativeEvidenceAvailable: true,
		practicalApplicability: "low",
		correctsRecurringMisconception: false,
		progressiveLearningValue: "low",
		maintenanceCostEstimate: "low",
	}),
	accessibility: createAccessibilityConsiderations({
		explicitObjectives: false,
		explicitPrerequisites: false,
		progressiveDisclosure: false,
		contextBeforeComplexity: false,
		meaningfulSequencing: false,
		concreteExamples: false,
		accurateAnalogies: false,
		clearDistinctions: false,
		manageableDensity: true,
		independentExploration: false,
		reducedRepetition: true,
		cognitiveLoadAssessment:
			"Valid NONE outcome — evaluation correctly found no actionable improvements",
	}),
	tags: ["none", "valid-none", "transient-only", "no-actionable-findings"],
});

// ============================================================================
// Fixture 20: DEPRECATE — Outdated educational content that should be retired
// ============================================================================

export const FIXTURE_DEPRECATE_OUTDATED: BookDeltaProposal = createProposal({
	proposalId: "bdp_fixt000000000013",
	category: "DEPRECATE",
	title: createBilingualString(
		"Deprecate Outdated Content: Legacy Prompt Engineering Patterns for GPT-3 Era Models",
		"Afschaffen Verouderde Inhoud: Legacy Prompt Engineering Patronen voor GPT-3 Era Modellen",
	),
	targetConcept:
		"Prompt engineering techniques specific to GPT-3 era models (text-davinci-003, etc.) that are obsolete for current instruction-tuned models",
	currentGap: createBilingualString(
		"Educational material still teaches few-shot prompting, manual prompt crafting, and completion-style interactions that are obsolete for modern chat/instruction-tuned models",
		"Educatief materiaal leert nog steeds few-shot prompting, handmatig prompt ontwerp, en completion-style interacties die verouderd zijn voor moderne chat/instruction-tuned modellen",
	),
	proposedChange: createBilingualString(
		"Mark legacy prompt engineering section as DEPRECATED. Replace with modern techniques: system prompts, structured outputs, function calling, RAG integration. Add migration guide from legacy to modern patterns.",
		"Markeer legacy prompt engineering sectie als DEPRECATED. Vervang met moderne technieken: system prompts, gestructureerde outputs, function calling, RAG integratie. Voeg migratiegids toe van legacy naar moderne patronen.",
	),
	rationale: createBilingualString(
		"GPT-3 era models (2020-2022) are deprecated/superseded. Current models (GPT-4, Claude 3, Llama 3) use chat/instruction formats. Legacy techniques actively harm performance on modern models (verified by OpenAI migration guide, Anthropic docs).",
		"GPT-3 era modellen (2020-2022) zijn deprecated/superseded. Huidige modellen (GPT-4, Claude 3, Llama 3) gebruiken chat/instruction formaten. Legacy technieken schaden actief prestaties op moderne modellen (geverifieerd door OpenAI migratiegids, Anthropic docs).",
	),
	supportingClaimIds: ["claim_uvwxyzabcdefghij"],
	originalSources: [
		createSourceReference({
			sourceId: "openai-migration",
			url: "https://platform.openai.com/docs/migration",
			title: "OpenAI Legacy Model Migration Guide",
		}),
		createSourceReference({
			sourceId: "anthropic-docs",
			url: "https://docs.anthropic.com/claude/docs",
			title: "Anthropic Claude Documentation",
		}),
	],
	evidenceClassification: "VERIFIED_FACT",
	confidence: 0.93,
	materialUncertainty: "low",
	educationalValue: "significant",
	knowledgeDomain: "agentic-ai-software-engineering",
	targetAudience: [
		"system-architects",
		"ml-platform-leads",
		"principal-engineers",
	],
	acceptanceCriteria: [
		createAcceptanceCriterion({
			criterionId: "deprecation-marked",
			description:
				"Legacy content explicitly marked as deprecated with migration path",
			measurable: true,
			verificationMethod: "content-inspection",
			evidenceRequired: ["Deprecation notice", "Migration guide"],
		}),
		createAcceptanceCriterion({
			criterionId: "replacement-current",
			description:
				"Replacement content reflects current model capabilities",
			measurable: true,
			verificationMethod: "technical-validation",
			evidenceRequired: [
				"Current model documentation",
				"Benchmark comparison",
			],
		}),
	],
	tags: ["deprecate", "prompt-engineering", "legacy", "gpt-3", "migration"],
});

// ============================================================================
// Fixture 21: Persistence failure followed by unsuccessful readback
// ============================================================================

export const FIXTURE_PERSISTENCE_FAILURE: BookDeltaProposal = createProposal({
	proposalId: "bdp_fixt000000000021",
	category: "ADD",
	title: createBilingualString(
		"Add Missing Explanation: Persistence Failure Simulation",
		"Voeg Ontbrekende Uitleg Toe: Persistentie Fout Simulatie",
	),
	targetConcept: "Test fixture for persistence failure handling",
	currentGap: createBilingualString("Test gap", "Test gap"),
	proposedChange: createBilingualString("Test change", "Test change"),
	rationale: createBilingualString("Test rationale", "Test rationale"),
	supportingClaimIds: ["claim_vwxyzabcdefghijk"],
	originalSources: [createSourceReference()],
	evidenceClassification: "VERIFIED_FACT",
	confidence: 0.9,
	materialUncertainty: "low",
	educationalValue: "niche",
	knowledgeDomain: "cross-cutting",
	targetAudience: ["system-architects"],
	tags: ["test", "persistence-failure", "error-handling"],
});

// ============================================================================
// Fixture 22: Interrupted evaluation caused by exhausted free inference capacity
// ============================================================================

export const FIXTURE_INTERRUPTED_INFERENCE: BookDeltaEvaluationResult = {
	editionId: "edition_2025-01-22",
	editionDate: "2025-01-22",
	evaluatedAt: new Date().toISOString(),
	evaluatedBy: "book-delta-engine",
	evaluationPerformed: true,
	factDossierConsidered: true,
	thesaurusConsulted: true,
	architecturePrinciplesConsulted: true,
	historicalProposalsInspected: true,
	targetDocumentsInspected: false,
	newProposals: ["bdp_partial000000001", "bdp_partial000000002"],
	updatedHistoricalProposals: [],
	duplicateProposalsIdentified: [],
	noChangeDecisions: 0,
	unresolvedEvidenceGaps: [
		"Free inference capacity exhausted after 2 proposals",
		"Model-assisted educational value assessment incomplete for remaining 8 candidates",
		"Target document inspection skipped due to budget exhaustion",
	],
	targetDocumentAccessLimitations: [
		"Budget exhausted before target document inspection",
	],
	reviewRequirements: [
		"Complete model-assisted assessment when capacity available",
		"Inspect target documents for partial proposals",
	],
	persistenceSucceeded: true,
	readbackSucceeded: true,
	inferenceUsed: true,
	inferenceNote:
		"Evaluation interrupted: all free providers exhausted (OpenRouter 20 req/min). 2/10 proposals generated with model assistance; remaining 8 candidates evaluated deterministically only.",
};

// ============================================================================
// Fixture 23: Proposal whose factual foundation is superseded by newer research
// ============================================================================

export const FIXTURE_SUPERSEDED_FOUNDATION: BookDeltaProposal = createProposal({
	proposalId: "bdp_fixt000000000018",
	category: "CORRECT",
	title: createBilingualString(
		"Correct Misconception: Scaling Laws Predict Continued Performance Gains",
		"Corrigeer Misverstand: Scaling Laws Voorspellen Voortgaande Prestatiewinst",
	),
	targetConcept:
		"Original Kaplan et al. 2020 scaling laws claimed uninterrupted power-law scaling; newer research (Hoffmann et al. 2022, Chinchilla) shows compute-optimal scaling with data constraints",
	currentGap: createBilingualString(
		"Educational material cites 2020 scaling laws as current understanding, not reflecting Chinchilla compute-optimal framework that supersedes the original formulation",
		"Educatief materiaal citeert 2020 scaling laws als huidige begrip, niet weerspiegelend Chinchilla compute-optimal framework dat de oorspronkelijke formulering supersedeert",
	),
	proposedChange: createBilingualString(
		"Update to present compute-optimal scaling (Chinchilla) as current framework, with original Kaplan laws as historical context. Add L3 replicated evidence for compute-optimal allocation.",
		"Update om compute-optimal scaling (Chinchilla) te presenteren als huidig framework, met oorspronkelijke Kaplan laws als historisch context. Voeg L3 gerepliceerd bewijs toe voor compute-optimal allocatie.",
	),
	rationale: createBilingualString(
		"Chinchilla (DeepMind 2022, L3 replicated by 4 labs) supersedes Kaplan 2020 scaling laws. The factual foundation of the original educational explanation has been superseded by newer research. Book Delta must reflect current verified understanding.",
		"Chinchilla (DeepMind 2022, L3 gerepliceerd door 4 labs) supersedeert Kaplan 2020 scaling laws. De feitenbasis van de oorspronkelijke educatieve uitleg is gesupersedeerd door nieuwer onderzoek. Book Delta moet huidige geverifieerde kennis weerspiegelen.",
	),
	supportingClaimIds: ["claim_wxyzabcdefghijkl", "claim_xyzabcdefghijklm"],
	originalSources: [
		createSourceReference({
			sourceId: "kaplan2020",
			url: "https://arxiv.org/abs/2001.08361",
			title: "Scaling Laws for Neural Language Models (2020)",
		}),
		createSourceReference({
			sourceId: "chinchilla2022",
			url: "https://arxiv.org/abs/2203.15556",
			title: "Training Compute-Optimal Large Language Models (Chinchilla)",
		}),
		createSourceReference({
			sourceId: "chinchilla-replication",
			url: "https://github.com/chinchilla-replications",
			title: "Independent Chinchilla Replications",
		}),
	],
	evidenceClassification: "VERIFIED_FACT",
	confidence: 0.96,
	materialUncertainty: "low",
	educationalValue: "foundational",
	knowledgeDomain: "models-inference-scientific",
	targetAudience: [
		"system-architects",
		"ml-platform-leads",
		"principal-engineers",
		"technical-ctos",
	],
	historicalProposalReferences: [
		{
			proposalId: "bdp_scal000000000001",
			editionDate: "2023-06-15",
			relationship: "supersedes",
			resolutionNote:
				"Original proposal based on Kaplan 2020; superseded by Chinchilla 2022 compute-optimal framework",
		},
	],
	uniquenessStatus: "supersedes",
	tags: ["correct", "scaling-laws", "chinchilla", "superseded-foundation"],
});

// ============================================================================
// Fixture 24: Book Delta update that accidentally modifies a canonical terminology definition
// ============================================================================

export const FIXTURE_TERMINOLOGY_CORRUPTION: BookDeltaProposal = createProposal(
	{
		proposalId: "bdp_fixt000000000022",
		category: "NONE", // Correctly NONE — Book Delta must not modify thesaurus
		title: createBilingualString(
			"No Improvement Proposed",
			"Geen Verbetering Voorgesteld",
		),
		targetConcept:
			'Attempted modification of thesaurus entry "Agent" definition via Book Delta',
		currentGap: createBilingualString(
			'Book Delta proposal attempted to change canonical definition of "Agent" in thesaurus entry thes_abcdefghijklmnop',
			'Book Delta voorstel probeerde canonieke definitie van "Agent" in thesaurus entry thes_abcdefghijklmnop te wijzigen',
		),
		proposedChange: createBilingualString(
			"No change — Book Delta does not modify thesaurus. Terminology changes must use the terminology change mechanism (TerminologyChangeProposalSchema).",
			"Geen wijziging — Book Delta wijzigt niet de thesaurus. Terminologie wijzigingen moeten het terminologie wijzigingsmechanisme gebruiken (TerminologyChangeProposalSchema).",
		),
		rationale: createBilingualString(
			"Architectural boundary: Book Delta is for educational improvement proposals only. The persistent thesaurus is a separate canonical knowledge register with its own change process (ADD/CONFIRM/REFINE/MERGE/DEPRECATE/SUPERSEDE/NONE). This fixture documents the correct enforcement of separation of concerns.",
			"Architecturale grens: Book Delta is alleen voor educatieve verbetervoorstellen. De persistente thesaurus is een apart canonieke kennisregister met eigen wijzigingsproces (ADD/CONFIRM/REFINE/MERGE/DEPRECATE/SUPERSEDE/NONE). Deze fixture documenteert de correcte afdwinging van separation of concerns.",
		),
		supportingClaimIds: [],
		originalSources: [],
		evidenceClassification: "VERIFIED_FACT",
		confidence: 1.0,
		materialUncertainty: "low",
		educationalValue: "niche",
		knowledgeDomain: "cross-cutting",
		targetAudience: ["system-architects"],
		terminologyReferences: [
			createTerminologyReference({
				entryId: "thes_abcdefghijklmnop",
				term: "Agent",
				relationship: "subject-of-proposal",
				note: "Reference only — Book Delta does not modify this entry",
			}),
		],
		acceptanceCriteria: [
			createAcceptanceCriterion({
				criterionId: "thesaurus-not-modified",
				description:
					"Verify Book Delta proposal does not contain thesaurus modification instructions",
				measurable: true,
				verificationMethod: "content-inspection",
				evidenceRequired: [
					"Proposal content review",
					"Change mechanism reference",
				],
			}),
		],
		durability: createDurabilityAssessment({
			conceptualImportance: "low",
			technicalAccuracy: "high",
			reusability: "cross-domain",
			multiContextRelevance: false,
			prerequisiteDependencies: [],
			likelihoodOfFutureChange: "low",
			authoritativeEvidenceAvailable: true,
			practicalApplicability: "low",
			correctsRecurringMisconception: false,
			progressiveLearningValue: "low",
			maintenanceCostEstimate: "low",
		}),
		tags: [
			"none",
			"thesaurus-boundary",
			"separation-of-concerns",
			"architecture",
		],
	},
);

// ============================================================================
// Fixture 25: REVISE-SCOPE — New evidence revises scope of existing proposal
// ============================================================================

export const FIXTURE_REVISE_SCOPE: BookDeltaProposal = createProposal({
	proposalId: "bdp_fixt000000000015",
	category: "REFINE",
	title: createBilingualString(
		"Refine Explanation: RAG Evaluation Metrics — Expand Scope to Include Faithfulness",
		"Verbeter Uitleg: RAG Evaluatiemetrics — Bereik Uitbreiden naar Faithfulness",
	),
	targetConcept:
		"RAG evaluation metrics expanded from retrieval precision/recall to include generation faithfulness and answer relevance",
	currentGap: createBilingualString(
		"Existing proposal (bdp_ragm000000000001) covers retrieval metrics only. New research shows faithfulness and answer relevance are equally critical for RAG quality assessment.",
		"Bestaand voorstel (bdp_ragm000000000001) dekt alleen retrieval metrics. Nieuw onderzoek toont aan dat faithfulness en answer relevance even cruciaal zijn voor RAG kwaliteitsevaluatie.",
	),
	proposedChange: createBilingualString(
		"Revise scope of existing proposal to include faithfulness (hallucination detection), answer relevance (user intent alignment), and citation accuracy metrics with L2 verified benchmarks.",
		"Herzie bereik van bestaand voorstel om faithfulness (hallucinatie detectie), answer relevance (gebruikersintent uitlijning), en citation accuracy metrics met L2 geverifieerde benchmarks.",
	),
	rationale: createBilingualString(
		"New benchmark study (RAGBench 2024, L2) establishes faithfulness and answer relevance as orthogonal quality dimensions to retrieval metrics. Existing proposal scope is too narrow.",
		"Nieuwe benchmark studie (RAGBench 2024, L2) stelt faithfulness en answer relevance vast als orthogonale kwaliteitsdimensies tot retrieval metrics. Bestaand voorstel bereik is te smal.",
	),
	supportingClaimIds: ["claim_yzabcdefghijklmn", "claim_zabcdefghijklmno"],
	originalSources: [
		createSourceReference({
			sourceId: "ragbench2024",
			url: "https://ragbench.example.com/2024",
			title: "RAGBench 2024 Comprehensive Evaluation",
		}),
	],
	evidenceClassification: "RESEARCH_FINDING",
	confidence: 0.89,
	materialUncertainty: "low",
	educationalValue: "significant",
	knowledgeDomain: "models-inference-scientific",
	targetAudience: [
		"system-architects",
		"ml-platform-leads",
		"principal-engineers",
	],
	historicalProposalReferences: [
		{
			proposalId: "bdp_ragm000000000001",
			editionDate: "2024-09-15",
			relationship: "revises-scope",
			resolutionNote:
				"New evidence expands scope from retrieval-only to include faithfulness and answer relevance",
		},
	],
	uniquenessStatus: "revises-scope",
	tags: ["refine", "rag", "metrics", "faithfulness", "revises-scope"],
});

// ============================================================================
// Fixture 26: LINKS-RELATED — Proposal linking to related proposals
// ============================================================================

export const FIXTURE_LINKS_RELATED: BookDeltaProposal = createProposal({
	proposalId: "bdp_fixt000000000019",
	category: "EXTEND",
	title: createBilingualString(
		"Extend Coverage: Agent Memory Systems — Link to Context Engineering and Observability",
		"Uitgebreide Dekking: Agent Geheugensystemen — Link naar Context Engineering en Observabiliteit",
	),
	targetConcept:
		"Agent memory systems connecting context engineering (AP-031), observability spine (AP-017), and cost envelope (AP-023)",
	currentGap: createBilingualString(
		"Educational material covers agent memory, context engineering, and observability as separate topics. The architectural relationships between them are not explicitly taught.",
		"Educatief materiaal dekt agent geheugen, context engineering, en observabiliteit als aparte onderwerpen. De architecturale relaties tussen hen worden niet expliciet geleerd.",
	),
	proposedChange: createBilingualString(
		"Add cross-references and conceptual links between agent memory systems, context engineering principles, observability spine, and cost envelope. Include architectural decision framework for memory system selection.",
		"Voeg cross-references en conceptuele links toe tussen agent geheugensystemen, context engineering principes, observability spine, en cost envelope. Inclusief architecturaal beslissingsframework voor geheugensysteem selectie.",
	),
	rationale: createBilingualString(
		"Architecture principles AP-017, AP-023, AP-031 are interrelated through memory system design. Educational improvement is linking existing concepts, not adding new ones.",
		"Architectuurprincipes AP-017, AP-023, AP-031 zijn onderling gerelateerd via geheugensysteemontwerp. Educatieve verbetering is koppelen van bestaande concepten, geen nieuwe toevoegen.",
	),
	supportingClaimIds: ["claim_abcdefghijklmnop"],
	originalSources: [
		createSourceReference({
			sourceId: "ap-017",
			url: "https://ai-intelligence-blog/principles/AP-017",
			title: "Architecture Principle AP-017: Observability Spine",
		}),
		createSourceReference({
			sourceId: "ap-023",
			url: "https://ai-intelligence-blog/principles/AP-023",
			title: "Architecture Principle AP-023: Cost Envelope",
		}),
		createSourceReference({
			sourceId: "ap-031",
			url: "https://ai-intelligence-blog/principles/AP-031",
			title: "Architecture Principle AP-031: Context Engineering",
		}),
	],
	evidenceClassification: "VERIFIED_FACT",
	confidence: 0.85,
	materialUncertainty: "low",
	educationalValue: "significant",
	knowledgeDomain: "agentic-ai-software-engineering",
	targetAudience: [
		"system-architects",
		"principal-engineers",
		"ml-platform-leads",
	],
	principleReferences: [
		createPrincipleReference({
			principleId: "AP-017",
			title: "Observability Spine",
			relationship: "illustrates",
		}),
		createPrincipleReference({
			principleId: "AP-023",
			title: "Cost Envelope",
			relationship: "illustrates",
		}),
		createPrincipleReference({
			principleId: "AP-031",
			title: "Context Engineering",
			relationship: "illustrates",
		}),
	],
	historicalProposalReferences: [
		{
			proposalId: "bdp_agnt000000000001",
			editionDate: "2024-08-15",
			relationship: "links-related",
			resolutionNote:
				"Related to context engineering and observability proposals",
		},
		{
			proposalId: "bdp_ctx0000000000001",
			editionDate: "2024-07-01",
			relationship: "links-related",
			resolutionNote:
				"Context engineering proposal links to memory systems",
		},
	],
	uniquenessStatus: "links-related",
	tags: [
		"extend",
		"agent-memory",
		"context-engineering",
		"observability",
		"links-related",
	],
});

// ============================================================================
// Fixture 27: Enterprise Adoption Organizational domain
// ============================================================================

export const FIXTURE_ENTERPRISE_ADOPTION: BookDeltaProposal = createProposal({
	proposalId: "bdp_fixt000000000025",
	category: "ADD",
	title: createBilingualString(
		"Add Missing Explanation: Enterprise AI Change Management Frameworks",
		"Voeg Ontbrekende Uitleg Toe: Enterprise AI Verandermanagement Frameworks",
	),
	targetConcept:
		"Organizational change management frameworks for AI adoption in enterprise settings",
	currentGap: createBilingualString(
		"Technical architects lack guidance on organizational change management specific to AI adoption — stakeholder alignment, skills transformation, governance structures, and cultural adaptation",
		"Technische architecten missen richtlijnen over organisatorisch verandermanagement specifiek voor AI adoptie — stakeholder afstemming, vaardigheidstransformatie, governance structuren, en culturele aanpassing",
	),
	proposedChange: createBilingualString(
		"Add educational section covering Kotter 8-step adapted for AI, ADKAR model for AI skills, AI governance board structures, and cultural readiness assessment frameworks",
		"Voeg educatieve sectie toe over Kotter 8-stap aangepast voor AI, ADKAR model voor AI vaardigheden, AI governance bord structuren, en culturele gereedheid assesseringsframeworks",
	),
	rationale: createBilingualString(
		"Strategic research (McKinsey, Gartner, Forrester) identifies organizational change as top barrier to enterprise AI adoption. Technical architects need actionable frameworks, not just technical patterns.",
		"Strategisch onderzoek (McKinsey, Gartner, Forrester) identificeert organisatorische verandering als top barrière voor enterprise AI adoptie. Technische architecten hebben actionable frameworks nodig, niet alleen technische patronen.",
	),
	supportingClaimIds: ["claim_abcdefghijklmnop"],
	originalSources: [
		createSourceReference({
			sourceId: "mckinsey-ai-adoption",
			url: "https://mckinsey.com/ai-adoption",
			title: "McKinsey Enterprise AI Adoption Study",
		}),
		createSourceReference({
			sourceId: "gartner-ai-governance",
			url: "https://gartner.com/ai-governance",
			title: "Gartner AI Governance Framework",
		}),
	],
	evidenceClassification: "EXPERT_INTERPRETATION",
	confidence: 0.78,
	materialUncertainty: "medium",
	educationalValue: "significant",
	knowledgeDomain: "enterprise-adoption-organizational",
	targetAudience: [
		"technical-ctos",
		"system-architects",
		"principal-engineers",
	],
	tags: ["add", "enterprise-adoption", "change-management", "organizational"],
});

// ============================================================================
// Fixture 28: Independent Research Advisory domain
// ============================================================================

export const FIXTURE_INDEPENDENT_RESEARCH: BookDeltaProposal = createProposal({
	proposalId: "bdp_fixt000000000001",
	category: "ADD",
	title: createBilingualString(
		"Add Missing Explanation: Independent AI Safety Research — Replication Crisis and Open Science",
		"Voeg Ontbrekende Uitleg Toe: Onafhankelijk AI Veiligheidsonderzoek — Replicatiecrisis en Open Science",
	),
	targetConcept:
		"Replication crisis in AI safety research and open science practices for independent verification",
	currentGap: createBilingualString(
		"Educational material on AI safety focuses on vendor claims without teaching independent verification methodologies, replication standards, or open science practices for safety research",
		"Educatief materiaal over AI veiligheid richt zich op vendor claims zonder onafhankelijke verificatiemethodologieën, replicatiestandaarden, of open science praktijken voor veiligheidsonderzoek te leren",
	),
	proposedChange: createBilingualString(
		"Add educational section on replication standards (L1-L3), registered reports, open data/code practices, adversarial collaboration frameworks, and independent audit methodologies for AI safety claims",
		"Voeg educatieve sectie toe over replicatiestandaarden (L1-L3), registered reports, open data/code praktijken, adversariale collaboratieraamwerken, en onafhankelijke audit methodologieën voor AI veiligheidsclaims",
	),
	rationale: createBilingualString(
		"Independent research (METR, Apollo, independent auditors) reveals replication failures in vendor safety claims. Architects need to evaluate safety research independently.",
		"Onafhankelijk onderzoek (METR, Apollo, onafhankelijke auditors) onthult replicatiefalen in vendor veiligheidsclaims. Architecten moeten veiligheidsonderzoek onafhankelijk kunnen evalueren.",
	),
	supportingClaimIds: ["claim_bcdefghijklmnopq"],
	originalSources: [
		createSourceReference({
			sourceId: "metr-replication",
			url: "https://metr.org/replication",
			title: "METR Independent Replication Studies",
		}),
		createSourceReference({
			sourceId: "apollo-safety",
			url: "https://apolloresearch.ai/safety",
			title: "Apollo Research Safety Evaluations",
		}),
	],
	evidenceClassification: "RESEARCH_FINDING",
	confidence: 0.82,
	materialUncertainty: "medium",
	educationalValue: "significant",
	knowledgeDomain: "independent-research-advisory",
	targetAudience: [
		"system-architects",
		"ml-platform-leads",
		"security-architects",
	],
	tags: [
		"add",
		"independent-research",
		"ai-safety",
		"replication",
		"open-science",
	],
});

// ============================================================================
// Fixture 29: Vendor Claim evidence classification
// ============================================================================

export const FIXTURE_VENDOR_CLAIM_EVIDENCE: BookDeltaProposal = createProposal({
	proposalId: "bdp_fixt000000000002",
	category: "CORRECT",
	title: createBilingualString(
		"Correct Misconception: Vendor Performance Claims Without Independent Verification",
		"Corrigeer Misverstand: Vendor Prestatieclaims Zonder Onafhankelijke Verificatie",
	),
	targetConcept:
		"Vendor performance benchmarks presented as universal facts without independent reproduction",
	currentGap: createBilingualString(
		"Educational material cites vendor benchmarks (throughput, latency, accuracy) as established facts without disclosing they are vendor-generated, unreproduced, and often use favorable configurations",
		"Educatief materiaal citeert vendor benchmarks (throughput, latentie, nauwkeurigheid) als vastgestelde feiten zonder openbaaring dat ze vendor-gegenereerd, ongerepliceerd, en vaak met gunstige configuraties zijn",
	),
	proposedChange: createBilingualString(
		"Reframe vendor benchmarks as VENDOR_CLAIM evidence classification. Add requirement for independent L2+ replication before citing as verified fact. Include methodology audit checklist.",
		"Herframeer vendor benchmarks als VENDOR_CLAIM bewijsklassificatie. Voeg vereiste toe voor onafhankelijke L2+ replicatie voordat geciteerd als geverifieerd feit. Inclusief methodologie audit checklist.",
	),
	rationale: createBilingualString(
		"Evidence classification framework distinguishes VENDOR_CLAIM from VERIFIED_FACT. Multiple vendor benchmarks failed independent reproduction (e.g., MLPerf closed division vs open division discrepancies). Educational material must reflect evidence classification.",
		"Bewijsklassificatie framework onderscheidt VENDOR_CLAIM van VERIFIED_FACT. Meerdere vendor benchmarks faalden onafhankelijke replicatie (bijv. MLPerf closed vs open division verschillen). Educatief materiaal moet bewijsklassificatie weerspiegelen.",
	),
	supportingClaimIds: ["claim_cdefghijklmnopqr"],
	originalSources: [
		createSourceReference({
			sourceId: "vendor-benchmark",
			url: "https://vendor.example.com/benchmark",
			title: "Vendor Performance Benchmark",
			tier: 3,
		}),
		createSourceReference({
			sourceId: "mlperf-comparison",
			url: "https://mlcommons.org/comparison",
			title: "MLPerf Closed vs Open Division Comparison",
		}),
	],
	evidenceClassification: "VENDOR_CLAIM",
	confidence: 0.65,
	materialUncertainty: "high",
	educationalValue: "supplementary",
	knowledgeDomain: "models-inference-scientific",
	targetAudience: [
		"system-architects",
		"ml-platform-leads",
		"principal-engineers",
	],
	tags: ["correct", "vendor-claim", "evidence-classification", "benchmark"],
});

// ============================================================================
// Complete Fixture Collections
// ============================================================================

/** All proposal fixtures for regression testing. */
export const ALL_PROPOSAL_FIXTURES: BookDeltaProposal[] = [
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
	FIXTURE_REVISE_SCOPE,
	FIXTURE_LINKS_RELATED,
	FIXTURE_ENTERPRISE_ADOPTION,
	FIXTURE_INDEPENDENT_RESEARCH,
	FIXTURE_VENDOR_CLAIM_EVIDENCE,
];

/** Evaluation result fixtures. */
export const ALL_EVALUATION_FIXTURES: BookDeltaEvaluationResult[] = [
	FIXTURE_INTERRUPTED_INFERENCE,
];

/** Knowledge continuity result fixtures. */
export function createKnowledgeContinuityFixture(
	overrides: Partial<BookDeltaKnowledgeContinuityResult> = {},
): BookDeltaKnowledgeContinuityResult {
	return {
		gateStatus: "PASS",
		evaluationRan: true,
		evidenceInspected: true,
		candidatesEvaluated: true,
		proposalsRecorded: true,
		duplicatesHandled: true,
		persistenceSucceeded: true,
		readbackSucceeded: true,
		limitationsReported: false,
		unresolvedLimitations: [],
		details: "Book Delta evaluation completed successfully",
		evaluatedAt: new Date().toISOString(),
		evaluatedBy: "test-fixture",
		...overrides,
	} as BookDeltaKnowledgeContinuityResult;
}

export const KNOWLEDGE_CONTINUITY_FIXTURES: BookDeltaKnowledgeContinuityResult[] =
	[
		createKnowledgeContinuityFixture({
			editionId: "edition_2025-01-15",
			editionDate: "2025-01-15",
		}),
		createKnowledgeContinuityFixture({
			editionId: "edition_2025-01-21",
			editionDate: "2025-01-21",
			evaluationRan: false,
			evidenceInspected: false,
			candidatesEvaluated: false,
			proposalsRecorded: false,
			duplicatesHandled: false,
			persistenceSucceeded: false,
			readbackSucceeded: false,
			limitationsReported: true,
			unresolvedLimitations: ["Evaluation was not executed"],
			gateStatus: "NOT_ASSESSABLE",
			details: "Book Delta evaluation was not executed",
		}),
		createKnowledgeContinuityFixture({
			editionId: "edition_2025-01-22",
			editionDate: "2025-01-22",
			limitationsReported: true,
			unresolvedLimitations: [
				"Free inference capacity exhausted",
				"Target document inspection incomplete",
			],
			gateStatus: "PASS",
			details:
				"Book Delta evaluation partially completed; inference capacity exhausted",
		}),
	];

/**
 * Validate all fixtures against their schemas.
 */
export async function validateAllFixtures(): Promise<{
	proposals: { valid: number; invalid: number; errors: string[] };
	evaluations: { valid: number; invalid: number; errors: string[] };
	knowledgeContinuity: { valid: number; invalid: number; errors: string[] };
}> {
	const results = {
		proposals: { valid: 0, invalid: 0, errors: [] as string[] },
		evaluations: { valid: 0, invalid: 0, errors: [] as string[] },
		knowledgeContinuity: { valid: 0, invalid: 0, errors: [] as string[] },
	};

	for (const proposal of ALL_PROPOSAL_FIXTURES) {
		try {
			validateBookDeltaProposal(proposal);
			results.proposals.valid++;
		} catch (error) {
			results.proposals.invalid++;
			results.proposals.errors.push(
				`${proposal.proposalId}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	for (const evaluation of ALL_EVALUATION_FIXTURES) {
		try {
			validateBookDeltaEvaluationResult(evaluation);
			results.evaluations.valid++;
		} catch (error) {
			results.evaluations.invalid++;
			results.evaluations.errors.push(
				`${evaluation.editionId}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	for (const kc of KNOWLEDGE_CONTINUITY_FIXTURES) {
		try {
			validateBookDeltaKnowledgeContinuityResult(kc);
			results.knowledgeContinuity.valid++;
		} catch (error) {
			results.knowledgeContinuity.invalid++;
			results.knowledgeContinuity.errors.push(
				`${kc.editionId}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	return results;
}
