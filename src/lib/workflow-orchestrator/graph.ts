/**
 * Workflow Graph — Canonical Stage Definitions
 *
 * Defines the complete workflow graph for the AI Daily Intelligence daily edition pipeline.
 * Each stage declares its dependencies, contracts, execution budget, and failure handling.
 * This is the SINGLE SOURCE OF TRUTH for the workflow dependency structure.
 */

import { WORKFLOW_ID_PATTERNS, StageDefinitionSchema } from "./schema.js";

import type {
	StageDefinition,
	StageDefinitionInput,
	StageDependency,
	ArtifactRef,
	StageInputContract,
	StageOutputContract,
	InferenceRequirements,
	StageExecutionBudget,
	RetryPolicy,
	CheckpointPolicy,
	WorkflowPhase,
	StageSideEffect,
} from "./schema.js";

/** Generate a stable stage ID */
function stageId(suffix: string): string {
	return `wfs_${suffix.padStart(16, "0")}`;
}

/** Common artifact references */
const ARTIFACTS = {
	SOURCE_REGISTRY: {
		artifactId: "source-registry",
		path: "data/sources.yml",
		description:
			"Authoritative source registry with tier, ring affinity, criticality",
	},
	RESEARCH_TAXONOMY: {
		artifactId: "research-taxonomy",
		path: "data/research-taxonomy.yml",
		description:
			"Research domain map with subdomains, canonical terms, ring-domain mapping",
	},
	DISCOVERY_LEDGER: {
		artifactId: "discovery-ledger",
		path: "data/discovery-ledger/",
		description:
			"Deterministic audit trail of all source monitoring attempts",
	},
	CANDIDATES: {
		artifactId: "candidates",
		path: "data/candidates/{edition}.jsonl",
		description: "Triage-promoted candidate news items",
	},
	VERIFIED_CLAIMS: {
		artifactId: "verified-claims",
		path: "data/claims/",
		description:
			"Evidence-verified claims with classification and provenance",
	},
	FACT_DOSSIER: {
		artifactId: "canonical-fact-dossier",
		path: "data/fact-dossiers/edition_{edition}.json",
		description: "Canonical per-edition factual foundation",
	},
	OMISSION_REVIEW: {
		artifactId: "omission-review",
		path: "data/omission-reviews/{edition}_*.json",
		description: "Second discovery and omission detection report",
	},
	HISTORICAL_REGRESSION: {
		artifactId: "historical-regression",
		path: "data/historical-regression/{edition}_*.json",
		description: "Seven-calendar-day historical comparison report",
	},
	EDITORIAL_MANIFEST: {
		artifactId: "editorial-selection",
		path: "data/editorial-selection/{edition}_*.json",
		description: "Vendor-neutral editorial selection manifest",
	},
	NEWSLETTER: {
		artifactId: "newsletter",
		path: "editions/edition_{edition}/canonical/publication.md",
		description: "Dutch readable technical newsletter",
	},
	RESEARCH_AUDIT: {
		artifactId: "research-audit",
		path: "editions/edition_{edition}/canonical/research-audit.md",
		description: "Technical evidence and editorial accountability document",
	},
	LISTENING_NL: {
		artifactId: "listening-narrative-nl",
		path: "editions/edition_{edition}/canonical/AI Daily Intelligence — {edition}.md",
		description: "Dutch independent listening narrative",
	},
	ENGLISH_ARTICLES: {
		artifactId: "english-articles",
		path: "editions/edition_{edition}/derivatives/english-articles/",
		description: "English readable publication derivatives",
	},
	ENGLISH_LISTENING: {
		artifactId: "english-listening",
		path: "editions/edition_{edition}/derivatives/english-listening/",
		description: "English listening narrative derivatives",
	},
	DAILY_INDEX: {
		artifactId: "daily-index",
		path: "editions/edition_{edition}/index.md",
		description: "Daily navigation index (not a canonical publication)",
	},
	PUBLICATION_PACKAGE: {
		artifactId: "publication-package",
		path: "editions/edition_{edition}/publication-package.json",
		description:
			"Complete publication package with all artifacts and metadata",
	},
	Q1Q10_EVAL: {
		artifactId: "q1q10-evaluation",
		path: "data/quality/q1q10/{edition}_*.json",
		description: "Listening quality Q1-Q10 evaluation report",
	},
	AUDIO_AG_EVAL: {
		artifactId: "audio-ag-evaluation",
		path: "data/quality/audio-ag/{edition}_*.json",
		description: "Holistic audio A-G evaluation report",
	},
	READABLE_QUALITY: {
		artifactId: "readable-quality",
		path: "data/quality/readable/{edition}_*.json",
		description: "Readable publication quality evaluation",
	},
	THESAURUS: {
		artifactId: "thesaurus",
		path: "data/thesaurus/thesaurus-artifact.json",
		description: "Persistent terminology thesaurus",
	},
	ARCHITECTURE_PRINCIPLES: {
		artifactId: "architecture-principles",
		path: "data/architecture-principles/apr-artifact.json",
		description: "Persistent architecture principles register",
	},
	BOOK_DELTA: {
		artifactId: "book-delta",
		path: "data/book-delta/{edition}/book-delta-artifact.json",
		description: "Persistent Book Delta proposals register",
	},
} as const;

/** Create artifact ref with edition placeholder */
function artifactRef(
	key: keyof typeof ARTIFACTS,
	edition?: string,
): ArtifactRef {
	const a = ARTIFACTS[key];
	return {
		artifactId: a.artifactId,
		path: edition ? a.path.replace("{edition}", edition) : a.path,
		description: a.description,
		required: true,
	};
}

/** Common retry policy */
const DEFAULT_RETRY: RetryPolicy = {
	maxAttempts: 3,
	baseDelayMs: 1000,
	maxDelayMs: 30000,
	jitterFactor: 0.25,
	retryableCategories: [
		"NETWORK_FAILURE",
		"RATE_LIMITED",
		"INFERENCE_UNAVAILABLE",
		"SOURCE_UNAVAILABLE",
	],
};

/** Common checkpoint policy */
const DEFAULT_CHECKPOINT: CheckpointPolicy = {
	enabled: true,
	persistIntervalSteps: 5,
	maxCheckpoints: 50,
	ttlHours: 168,
	validateOnResume: true,
};

/** Common execution budget */
const DEFAULT_BUDGET: StageExecutionBudget = {
	timeoutMs: 300000, // 5 minutes
	maxRetries: 3,
	inferenceBudget: { maxRequests: 50, maxTokens: 100000 },
	cpuBudgetMs: 60000,
	memoryBudgetMb: 512,
};

/** Long-running budget */
const LONG_BUDGET: StageExecutionBudget = {
	timeoutMs: 900000, // 15 minutes
	maxRetries: 3,
	inferenceBudget: { maxRequests: 200, maxTokens: 500000 },
	cpuBudgetMs: 300000,
	memoryBudgetMb: 1024,
};

/** Very long budget for publication generation */
const PUBLICATION_BUDGET: StageExecutionBudget = {
	timeoutMs: 600000, // 10 minutes
	maxRetries: 2,
	inferenceBudget: { maxRequests: 100, maxTokens: 200000 },
	cpuBudgetMs: 120000,
	memoryBudgetMb: 1024,
};

/** Helper to create complete InferenceRequirements */
function createInferenceReq(
	overrides: Partial<InferenceRequirements> = {},
): InferenceRequirements {
	return {
		required: false,
		providers: [],
		estimatedRequests: 0,
		estimatedTokens: 0,
		deterministic: true,
		structuredOutput: false,
		temperature: 0,
		fallbackAllowed: true,
		...overrides,
	};
}

/** Helper to create dependency with artifactRefs */
function dep(
	stageId: string,
	required = true,
	artifactRefs: ArtifactRef[] = [],
): StageDependency {
	return { stageId, required, artifactRefs };
}

/** ============================================================================
 * PHASE A — EDITION INITIALIZATION
 * ============================================================================ */

const A01_RESOLVE_EDITION: StageDefinitionInput = {
	stageId: stageId("a01_resolve_edition"),
	name: "Resolve Edition Identity",
	description:
		"Compute edition ID, reporting window (05:00–05:00 Europe/Amsterdam), validate timezone handling including DST transitions",
	phase: "PHASE_A_EDITION_INIT",
	dependencies: [],
	inputContract: {
		requiredArtifacts: [],
		optionalArtifacts: [],
		configurationRefs: [],
		environmentVars: ["TZ"],
	},
	outputContract: {
		producedArtifacts: [
			{
				...artifactRef("SOURCE_REGISTRY"),
				artifactId: "edition-context",
				path: "memory://edition-context",
				description: "EditionContext with resolved window boundaries",
			},
		],
		sideEffects: ["NONE"],
		modifiesState: false,
		emitsEvents: ["EDITION_RESOLVED"],
	},
	inputSchema: "EditionContext",
	outputSchema: "EditionContext",
	sideEffects: ["NONE"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: { ...DEFAULT_BUDGET, timeoutMs: 10000 },
	checkpointPolicy: { ...DEFAULT_CHECKPOINT, enabled: false },
	inferenceRequirements: { required: false },
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: false,
	validationResponsibility: "SELF",
	postValidationHooks: [],
	modulePath: "../editorial-window.ts",
	entryPoint: "resolveEdition",
	version: "1.0.0",
	tags: ["deterministic", "timezone-aware", "dst-handling"],
};

const A02_LOAD_REGISTRIES: StageDefinitionInput = {
	stageId: stageId("a02_load_registries"),
	name: "Load Source Registry & Research Taxonomy",
	description:
		"Load and validate data/sources.yml and data/research-taxonomy.yml against schemas",
	phase: "PHASE_A_EDITION_INIT",
	dependencies: [
		{
			stageId: stageId("a01_resolve_edition"),
			required: true,
			artifactRefs: [artifactRef("SOURCE_REGISTRY")],
		},
	],
	inputContract: {
		requiredArtifacts: [
			artifactRef("SOURCE_REGISTRY"),
			artifactRef("RESEARCH_TAXONOMY"),
		],
		optionalArtifacts: [],
		configurationRefs: [],
		environmentVars: [],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "validated-source-registry",
				path: "memory://validated-source-registry",
				description: "Parsed and validated source registry Map",
				required: true,
			},
			{
				artifactId: "validated-research-taxonomy",
				path: "memory://validated-research-taxonomy",
				description: "Parsed and validated research taxonomy",
				required: true,
			},
		],
		sideEffects: ["READ_ONLY"],
		modifiesState: false,
		emitsEvents: ["REGISTRIES_LOADED"],
	},
	inputSchema: "SourceRegistry + ResearchTaxonomy",
	outputSchema: "ValidatedRegistries",
	sideEffects: ["READ_ONLY"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: { ...DEFAULT_BUDGET, timeoutMs: 30000 },
	checkpointPolicy: { ...DEFAULT_CHECKPOINT, enabled: false },
	inferenceRequirements: { required: false },
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: false,
	validationResponsibility: "SELF",
	postValidationHooks: [],
	modulePath: "../editorial-window.ts",
	entryPoint: "loadRegistries",
	version: "1.0.0",
	tags: ["validation", "schema-check"],
};

const A03_VALIDATE_KNOWLEDGE_REGISTERS: StageDefinitionInput = {
	stageId: stageId("a03_validate_knowledge_registers"),
	name: "Validate Persistent Knowledge Registers",
	description:
		"Verify thesaurus, architecture principles, and book delta registers exist, are readable, and pass schema validation",
	phase: "PHASE_A_EDITION_INIT",
	dependencies: [{ stageId: stageId("a01_resolve_edition"), required: true }],
	inputContract: {
		requiredArtifacts: [
			artifactRef("THESAURUS"),
			artifactRef("ARCHITECTURE_PRINCIPLES"),
			artifactRef("BOOK_DELTA"),
		],
		optionalArtifacts: [],
		configurationRefs: [],
		environmentVars: [],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "knowledge-register-status",
				path: "memory://knowledge-register-status",
				description: "Validation status for each knowledge register",
				required: true,
			},
		],
		sideEffects: ["READ_ONLY"],
		modifiesState: false,
		emitsEvents: ["KNOWLEDGE_REGISTERS_VALIDATED"],
	},
	inputSchema:
		"ThesaurusArtifact + ArchitecturePrinciplesRegister + BookDeltaArtifact",
	outputSchema: "KnowledgeRegisterStatus",
	sideEffects: ["READ_ONLY"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: { ...DEFAULT_BUDGET, timeoutMs: 30000 },
	checkpointPolicy: { ...DEFAULT_CHECKPOINT, enabled: false },
	inferenceRequirements: { required: false },
	failureBehavior: "ALLOW_PARTIAL",
	recoverable: true,
	compensatingAction: "Continue with empty registers; log warnings",
	validationResponsibility: "SELF",
	postValidationHooks: [],
	modulePath: "../editorial-window.ts",
	entryPoint: "validateKnowledgeRegisters",
	version: "1.0.0",
	tags: ["knowledge-continuity", "persistence-check"],
};

const A04_INIT_EXECUTION_MANIFEST: StageDefinitionInput = {
	stageId: stageId("a04_init_execution_manifest"),
	name: "Initialize Durable Execution Manifest",
	description:
		"Create the authoritative execution manifest with edition context, budget, graph version, and empty stage records",
	phase: "PHASE_A_EDITION_INIT",
	dependencies: [
		{ stageId: stageId("a01_resolve_edition"), required: true },
		{ stageId: stageId("a02_load_registries"), required: true },
		{
			stageId: stageId("a03_validate_knowledge_registers"),
			required: false,
		},
	],
	inputContract: {
		requiredArtifacts: [],
		optionalArtifacts: [],
		configurationRefs: ["workflow-graph-version", "contract-version"],
		environmentVars: [],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "execution-manifest",
				path: "data/execution-manifests/{edition}_*.json",
				description:
					"Initialized ExecutionManifest with PENDING stages",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL"],
		modifiesState: true,
		emitsEvents: ["MANIFEST_INITIALIZED"],
	},
	inputSchema: "CliOptions + EditionContext + WorkflowGraph",
	outputSchema: "ExecutionManifest",
	sideEffects: ["WRITE_LOCAL"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: { ...DEFAULT_BUDGET, timeoutMs: 10000 },
	checkpointPolicy: { ...DEFAULT_CHECKPOINT, enabled: false },
	inferenceRequirements: { required: false },
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: false,
	validationResponsibility: "SELF",
	postValidationHooks: [],
	modulePath: "../editorial-window.ts",
	entryPoint: "initExecutionManifest",
	version: "1.0.0",
	tags: ["persistence", "manifest"],
};

const A05_ACQUIRE_LOCK: StageDefinitionInput = {
	stageId: stageId("a05_acquire_lock"),
	name: "Acquire Edition Execution Lock",
	description:
		"Lightweight filesystem lock to prevent concurrent runs for the same edition",
	phase: "PHASE_A_EDITION_INIT",
	dependencies: [{ stageId: stageId("a01_resolve_edition"), required: true }],
	inputContract: {
		requiredArtifacts: [],
		optionalArtifacts: [],
		configurationRefs: ["lock-ttl-hours"],
		environmentVars: [],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "workflow-lock",
				path: "data/locks/{edition}.lock",
				description: "WorkflowLock with acquired state",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL"],
		modifiesState: true,
		emitsEvents: ["LOCK_ACQUIRED"],
	},
	inputSchema: "EditionContext",
	outputSchema: "WorkflowLock",
	sideEffects: ["WRITE_LOCAL"],
	retryPolicy: { ...DEFAULT_RETRY, maxAttempts: 1 }, // No retry on lock contention
	executionBudget: { ...DEFAULT_BUDGET, timeoutMs: 10000 },
	checkpointPolicy: { ...DEFAULT_CHECKPOINT, enabled: false },
	inferenceRequirements: { required: false },
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: false,
	compensatingAction: "Return CONFLICT with existing lock details",
	validationResponsibility: "SELF",
	postValidationHooks: [],
	modulePath: "../editorial-window.ts",
	entryPoint: "acquireLock",
	version: "1.0.0",
	tags: ["concurrency", "lock"],
};

/** ============================================================================
 * PHASE B — RESEARCH DISCOVERY
 * ============================================================================ */

const B01_RING1_DISCOVERY: StageDefinitionInput = {
	stageId: stageId("b01_ring1_discovery"),
	name: "Ring 1 — First-Party Discovery",
	description:
		"Execute discovery for Tier 1 sources: official releases, vendor announcements, product docs, specifications, primary technical publications, benchmarks, standards, security advisories",
	phase: "PHASE_B_RESEARCH_DISCOVERY",
	dependencies: [
		{
			stageId: stageId("a02_load_registries"),
			required: true,
			artifactRefs: [artifactRef("SOURCE_REGISTRY")],
		},
		{ stageId: stageId("a05_acquire_lock"), required: true },
	],
	inputContract: {
		requiredArtifacts: [
			artifactRef("SOURCE_REGISTRY"),
			artifactRef("RESEARCH_TAXONOMY"),
		],
		optionalArtifacts: [artifactRef("DISCOVERY_LEDGER")],
		configurationRefs: ["ring1-source-filter", "max-items-per-source"],
		environmentVars: ["OPENROUTER_API_KEY"],
	},
	outputContract: {
		producedArtifacts: [
			{
				...artifactRef("DISCOVERY_LEDGER"),
				artifactId: "ring1-discovered",
				path: "data/discovered/ring1_{edition}.jsonl",
				description: "Discovered items from Ring 1 sources",
				required: true,
			},
			{
				...artifactRef("DISCOVERY_LEDGER"),
				artifactId: "ring1-ledger",
				path: "data/discovery-ledger/{edition}_ring1_*.json",
				description:
					"Ring 1 monitoring records with INACCESSIBLE/CHECKED_NONE/CHECKED_FOUND status",
				required: true,
			},
		],
		sideEffects: ["NETWORK_FETCH", "WRITE_LOCAL", "INFERENCE_CALL"],
		modifiesState: true,
		emitsEvents: ["RING1_COMPLETE"],
	},
	inputSchema: "SourceRegistry + ResearchTaxonomy + EditionContext",
	outputSchema: "DiscoveredItems + DiscoveryLedgerEntry",
	sideEffects: ["NETWORK_FETCH", "WRITE_LOCAL", "INFERENCE_CALL"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: LONG_BUDGET,
	checkpointPolicy: DEFAULT_CHECKPOINT,
	inferenceRequirements: {
		required: true,
		providers: ["openrouter-primary"],
		estimatedRequests: 20,
		estimatedTokens: 50000,
		deterministic: true,
		structuredOutput: true,
		fallbackAllowed: true,
	},
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: true,
	compensatingAction:
		"Record INACCESSIBLE sources in ledger; continue with CHECKED_FOUND/CHECKED_NONE",
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_ring_coverage",
		"validate_mandatory_sources_checked",
	],
	modulePath: "../discovery-ledger/index.js",
	entryPoint: "runRing1Discovery",
	version: "1.0.0",
	tags: ["discovery", "ring1", "first-party", "mandatory"],
};

const B02_RING2_DISCOVERY: StageDefinitionInput = {
	stageId: stageId("b02_ring2_discovery"),
	name: "Ring 2 — Independent Research Discovery",
	description:
		"Execute discovery for Tier 2 sources: academic publications, original scientific research, technical investigations, benchmarks, strategic research (Gartner, McKinsey, Forrester, IDC public)",
	phase: "PHASE_B_RESEARCH_DISCOVERY",
	dependencies: [
		{ stageId: stageId("a02_load_registries"), required: true },
		{ stageId: stageId("a05_acquire_lock"), required: true },
	],
	inputContract: {
		requiredArtifacts: [
			artifactRef("SOURCE_REGISTRY"),
			artifactRef("RESEARCH_TAXONOMY"),
		],
		optionalArtifacts: [artifactRef("DISCOVERY_LEDGER")],
		configurationRefs: ["ring2-source-filter"],
		environmentVars: ["OPENROUTER_API_KEY"],
	},
	outputContract: {
		producedArtifacts: [
			{
				...artifactRef("DISCOVERY_LEDGER"),
				artifactId: "ring2-discovered",
				path: "data/discovered/ring2_{edition}.jsonl",
				description: "Discovered items from Ring 2 sources",
				required: true,
			},
			{
				...artifactRef("DISCOVERY_LEDGER"),
				artifactId: "ring2-ledger",
				path: "data/discovery-ledger/{edition}_ring2_*.json",
				description: "Ring 2 monitoring records",
				required: true,
			},
		],
		sideEffects: ["NETWORK_FETCH", "WRITE_LOCAL", "INFERENCE_CALL"],
		modifiesState: true,
		emitsEvents: ["RING2_COMPLETE"],
	},
	inputSchema: "SourceRegistry + ResearchTaxonomy + EditionContext",
	outputSchema: "DiscoveredItems + DiscoveryLedgerEntry",
	sideEffects: ["NETWORK_FETCH", "WRITE_LOCAL", "INFERENCE_CALL"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: LONG_BUDGET,
	checkpointPolicy: DEFAULT_CHECKPOINT,
	inferenceRequirements: {
		required: true,
		providers: ["openrouter-primary"],
		estimatedRequests: 30,
		estimatedTokens: 100000,
		deterministic: true,
		structuredOutput: true,
		fallbackAllowed: true,
	},
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: true,
	compensatingAction:
		"Record INACCESSIBLE sources; do NOT skip Ring 2 because Ring 1 produced enough stories",
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_ring_coverage",
		"validate_methodology_disclosure_tier2",
	],
	modulePath: "../discovery-ledger/index.js",
	entryPoint: "runRing2Discovery",
	version: "1.0.0",
	tags: ["discovery", "ring2", "independent-research", "mandatory"],
};

const B03_RING3_DISCOVERY: StageDefinitionInput = {
	stageId: stageId("b03_ring3_discovery"),
	name: "Ring 3 — Expert & Community Signal Discovery",
	description:
		"Execute discovery for Tier 3 sources: independent experts, maintainers, engineering practitioners, community signals, reproducible GitHub repos, conference talks",
	phase: "PHASE_B_RESEARCH_DISCOVERY",
	dependencies: [
		{ stageId: stageId("a02_load_registries"), required: true },
		{ stageId: stageId("a05_acquire_lock"), required: true },
	],
	inputContract: {
		requiredArtifacts: [
			artifactRef("SOURCE_REGISTRY"),
			artifactRef("RESEARCH_TAXONOMY"),
		],
		optionalArtifacts: [artifactRef("DISCOVERY_LEDGER")],
		configurationRefs: ["ring3-source-filter"],
		environmentVars: ["OPENROUTER_API_KEY"],
	},
	outputContract: {
		producedArtifacts: [
			{
				...artifactRef("DISCOVERY_LEDGER"),
				artifactId: "ring3-discovered",
				path: "data/discovered/ring3_{edition}.jsonl",
				description: "Discovered items from Ring 3 sources",
				required: true,
			},
			{
				...artifactRef("DISCOVERY_LEDGER"),
				artifactId: "ring3-ledger",
				path: "data/discovery-ledger/{edition}_ring3_*.json",
				description: "Ring 3 monitoring records",
				required: true,
			},
		],
		sideEffects: ["NETWORK_FETCH", "WRITE_LOCAL", "INFERENCE_CALL"],
		modifiesState: true,
		emitsEvents: ["RING3_COMPLETE"],
	},
	inputSchema: "SourceRegistry + ResearchTaxonomy + EditionContext",
	outputSchema: "DiscoveredItems + DiscoveryLedgerEntry",
	sideEffects: ["NETWORK_FETCH", "WRITE_LOCAL", "INFERENCE_CALL"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: LONG_BUDGET,
	checkpointPolicy: DEFAULT_CHECKPOINT,
	inferenceRequirements: {
		required: true,
		providers: ["openrouter-primary"],
		estimatedRequests: 25,
		estimatedTokens: 80000,
		deterministic: true,
		structuredOutput: true,
		fallbackAllowed: true,
	},
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: true,
	compensatingAction: "Record INACCESSIBLE sources; do NOT skip Ring 3",
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_ring_coverage",
		"validate_corroboration_requirement_tier3",
	],
	modulePath: "../discovery-ledger/index.js",
	entryPoint: "runRing3Discovery",
	version: "1.0.0",
	tags: ["discovery", "ring3", "expert-community", "mandatory"],
};

const B04_MANDATORY_CODING_AGENT_MONITORING: StageDefinitionInput = {
	stageId: stageId("b04_mandatory_coding_agent_monitoring"),
	name: "Mandatory Coding Agent & Developer Tool Monitoring",
	description:
		"Enforce mandatory monitoring coverage for VS Code, GitHub Copilot CLI, GitHub Copilot in VS Code, GitHub Copilot Coding Agent, and competing agents (Claude Code, Codex CLI, Gemini CLI, Junie, Cursor, Windsurf, Zed, etc.)",
	phase: "PHASE_B_RESEARCH_DISCOVERY",
	dependencies: [
		{ stageId: stageId("b01_ring1_discovery"), required: true },
		{ stageId: stageId("b02_ring2_discovery"), required: true },
		{ stageId: stageId("b03_ring3_discovery"), required: true },
		{ stageId: stageId("b05_persist_discovery_evidence"), required: true },
	],
	inputContract: {
		requiredArtifacts: [artifactRef("DISCOVERY_LEDGER")],
		optionalArtifacts: [],
		configurationRefs: ["mandatory-source-ids"],
		environmentVars: [],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "mandatory-coverage-report",
				path: "memory://mandatory-coverage-report",
				description:
					"Verification that all mandatory sources were CHECKED_FOUND or CHECKED_NONE (not INACCESSIBLE/NOT_CHECKED)",
				required: true,
			},
		],
		sideEffects: ["READ_ONLY"],
		modifiesState: false,
		emitsEvents: ["MANDATORY_COVERAGE_VERIFIED"],
	},
	inputSchema: "DiscoveryLedgerEntry",
	outputSchema: "MandatoryCoverageReport",
	sideEffects: ["READ_ONLY"],
	retryPolicy: { ...DEFAULT_RETRY, maxAttempts: 1 },
	executionBudget: { ...DEFAULT_BUDGET, timeoutMs: 30000 },
	checkpointPolicy: { ...DEFAULT_CHECKPOINT, enabled: false },
	inferenceRequirements: { required: false },
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: false,
	compensatingAction:
		"Fail if any mandatory source is INACCESSIBLE or NOT_CHECKED",
	validationResponsibility: "SELF",
	postValidationHooks: ["validate_all_mandatory_checked"],
	modulePath: "./phases/phase-b.ts",
	entryPoint: "verifyMandatoryCoverage",
	version: "1.0.0",
	tags: ["mandatory", "coding-agents", "developer-tools", "enforcement"],
};

const B05_PERSIST_DISCOVERY_EVIDENCE: StageDefinitionInput = {
	stageId: stageId("b05_persist_discovery_evidence"),
	name: "Persist Discovery Results & Evidence",
	description:
		"Consolidate all ring discovery results, write discovery ledger, record source statuses (INACCESSIBLE, NOT_CHECKED, CHECKED_NONE, CHECKED_FOUND)",
	phase: "PHASE_B_RESEARCH_DISCOVERY",
	dependencies: [
		{ stageId: stageId("b01_ring1_discovery"), required: true },
		{ stageId: stageId("b02_ring2_discovery"), required: true },
		{ stageId: stageId("b03_ring3_discovery"), required: true },
	],
	inputContract: {
		requiredArtifacts: [
			{ ...artifactRef("DISCOVERY_LEDGER"), artifactId: "ring1-ledger" },
			{ ...artifactRef("DISCOVERY_LEDGER"), artifactId: "ring2-ledger" },
			{ ...artifactRef("DISCOVERY_LEDGER"), artifactId: "ring3-ledger" },
		],
		optionalArtifacts: [],
		configurationRefs: [],
		environmentVars: [],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "consolidated-discovery",
				path: "data/discovered/{edition}.jsonl",
				description: "All discovered items across rings",
				required: true,
			},
			{
				artifactId: "complete-discovery-ledger",
				path: "data/discovery-ledger/{edition}_complete_*.json",
				description: "Complete ledger entry with coverage metrics",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL"],
		modifiesState: true,
		emitsEvents: ["DISCOVERY_EVIDENCE_PERSISTED"],
	},
	inputSchema: "DiscoveryLedgerEntry[]",
	outputSchema: "ConsolidatedDiscovery + CompleteLedger",
	sideEffects: ["WRITE_LOCAL"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: { ...DEFAULT_BUDGET, timeoutMs: 60000 },
	checkpointPolicy: { ...DEFAULT_CHECKPOINT, enabled: false },
	inferenceRequirements: { required: false },
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: true,
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_source_status_distinctions",
		"validate_coverage_metrics",
	],
	modulePath: "../discovery-ledger/index.js",
	entryPoint: "persistDiscoveryEvidence",
	version: "1.0.0",
	tags: ["persistence", "evidence", "ledger"],
};

const B06_VALIDATE_DISCOVERY_COVERAGE: StageDefinitionInput = {
	stageId: stageId("b06_validate_discovery_coverage"),
	name: "Validate Discovery Coverage & Record Gaps",
	description:
		"Compute coverage metrics by ring, domain, organization, criticality; explicitly record missing/inaccessible sources as gaps",
	phase: "PHASE_B_RESEARCH_DISCOVERY",
	dependencies: [
		{ stageId: stageId("b05_persist_discovery_evidence"), required: true },
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "complete-discovery-ledger",
				path: "data/discovery-ledger/{edition}_complete_*.json",
			},
		],
		optionalArtifacts: [],
		configurationRefs: ["coverage-thresholds"],
		environmentVars: [],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "coverage-report",
				path: "memory://coverage-report",
				description:
					"CoverageMetrics with gaps and missing high-value sources",
				required: true,
			},
		],
		sideEffects: ["READ_ONLY"],
		modifiesState: false,
		emitsEvents: ["COVERAGE_VALIDATED"],
	},
	inputSchema: "DiscoveryLedgerEntry",
	outputSchema: "CoverageMetrics",
	sideEffects: ["READ_ONLY"],
	retryPolicy: { ...DEFAULT_RETRY, maxAttempts: 1 },
	executionBudget: { ...DEFAULT_BUDGET, timeoutMs: 30000 },
	checkpointPolicy: { ...DEFAULT_CHECKPOINT, enabled: false },
	inferenceRequirements: { required: false },
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: false,
	validationResponsibility: "SELF",
	postValidationHooks: ["validate_mandatory_sources_all_checked"],
	modulePath: "../discovery-ledger/index.js",
	entryPoint: "validateCoverage",
	version: "1.0.0",
	tags: ["validation", "coverage", "gaps"],
};

/** ============================================================================
 * PHASE C — EVIDENCE PREPARATION
 * ============================================================================ */

const C01_TEMPORAL_ELIGIBILITY: StageDefinitionInput = {
	stageId: stageId("c01_temporal_eligibility"),
	name: "Temporal Eligibility Classification",
	description:
		"Classify each candidate as NEW_PASS, NEW_FAIL (repost/summary), CATCH_UP, or TIME_UNVERIFIED using publication-date-first logic and editorial window",
	phase: "PHASE_C_EVIDENCE_PREP",
	dependencies: [
		{ stageId: stageId("b05_persist_discovery_evidence"), required: true },
		{ stageId: stageId("a01_resolve_edition"), required: true },
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "consolidated-discovery",
				path: "data/discovered/{edition}.jsonl",
			},
			{ artifactId: "edition-context", path: "memory://edition-context" },
		],
		optionalArtifacts: [],
		configurationRefs: ["novelty-thresholds"],
		environmentVars: [],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "candidates",
				path: "data/candidates/{edition}.jsonl",
				description:
					"CandidateNewsItem with temporalEligibility and noveltyClassification",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL"],
		modifiesState: true,
		emitsEvents: ["TEMPORAL_CLASSIFIED"],
	},
	inputSchema: "DiscoveredItem[] + EditionContext",
	outputSchema: "CandidateNewsItem[]",
	sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: LONG_BUDGET,
	checkpointPolicy: DEFAULT_CHECKPOINT,
	inferenceRequirements: {
		required: true,
		providers: ["openrouter-primary"],
		estimatedRequests: 40,
		estimatedTokens: 100000,
		deterministic: true,
		structuredOutput: true,
		fallbackAllowed: true,
	},
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: true,
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_novelty_classifications",
		"validate_new_fail_repost_detection",
	],
	modulePath: "../novelty-classification.js",
	entryPoint: "classifyNoveltyBatch",
	version: "1.0.0",
	tags: ["temporal", "novelty", "classification", "publication-date-first"],
};

const C02_CLAIM_VERIFICATION: StageDefinitionInput = {
	stageId: stageId("c02_claim_verification"),
	name: "Evidence Verification & Claim Classification",
	description:
		"Verify material claims against supporting evidence; classify evidence (VERIFIED_FACT, VENDOR_CLAIM, RESEARCH_FINDING, etc.); detect counterevidence; achieve L1+ verification for selected claims",
	phase: "PHASE_C_EVIDENCE_PREP",
	dependencies: [
		{ stageId: stageId("c01_temporal_eligibility"), required: true },
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "candidates",
				path: "data/candidates/{edition}.jsonl",
			},
		],
		optionalArtifacts: [],
		configurationRefs: ["verification-levels", "claim-types"],
		environmentVars: ["OPENROUTER_API_KEY"],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "verified-claims",
				path: "data/evidence-verification/{edition}/",
				description:
					"ClaimVerificationRecord[] with evidenceClassification, verificationStatus, verificationLevel",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL", "NETWORK_FETCH"],
		modifiesState: true,
		emitsEvents: ["CLAIMS_VERIFIED"],
	},
	inputSchema: "CandidateNewsItem[]",
	outputSchema: "ClaimVerificationRecord[]",
	sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL", "NETWORK_FETCH"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: { ...LONG_BUDGET, timeoutMs: 1200000 }, // 20 minutes
	checkpointPolicy: DEFAULT_CHECKPOINT,
	inferenceRequirements: {
		required: true,
		providers: ["openrouter-primary"],
		estimatedRequests: 100,
		estimatedTokens: 300000,
		deterministic: true,
		structuredOutput: true,
		fallbackAllowed: true,
	},
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: true,
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_verification_levels",
		"validate_claim_traceability",
	],
	modulePath: "../evidence-verification/index.js",
	entryPoint: "verifyClaims",
	version: "1.0.0",
	tags: ["verification", "evidence", "claims", "L1+"],
};

const C03_BUILD_FACT_DOSSIER: StageDefinitionInput = {
	stageId: stageId("c03_build_fact_dossier"),
	name: "Build Canonical Fact Dossier",
	description:
		"Consolidate candidates, discoveries, verified claims into the authoritative per-edition CanonicalFactDossier with edition summary, uncertainty register, and historical continuity",
	phase: "PHASE_C_EVIDENCE_PREP",
	dependencies: [
		{ stageId: stageId("c01_temporal_eligibility"), required: true },
		{ stageId: stageId("c02_claim_verification"), required: true },
		{ stageId: stageId("a01_resolve_edition"), required: true },
		{ stageId: stageId("a02_load_registries"), required: true },
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "candidates",
				path: "data/candidates/{edition}.jsonl",
			},
			{
				artifactId: "verified-claims",
				path: "data/evidence-verification/{edition}/",
			},
			{ artifactId: "edition-context", path: "memory://edition-context" },
			{
				artifactId: "validated-source-registry",
				path: "memory://validated-source-registry",
			},
			{
				artifactId: "validated-research-taxonomy",
				path: "memory://validated-research-taxonomy",
			},
		],
		optionalArtifacts: [],
		configurationRefs: ["previous-editions-path"],
		environmentVars: ["OPENROUTER_API_KEY"],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "canonical-fact-dossier",
				path: "data/fact-dossiers/edition_{edition}.json",
				description:
					"CanonicalFactDossier with contentHash, editionSummary, uncertaintyRegister, processingAudit",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL"],
		modifiesState: true,
		emitsEvents: ["FACT_DOSSIER_BUILT"],
	},
	inputSchema: "CandidateConsolidationInput[] + ConsolidationContext",
	outputSchema: "CanonicalFactDossier",
	sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: LONG_BUDGET,
	checkpointPolicy: DEFAULT_CHECKPOINT,
	inferenceRequirements: {
		required: false, // Optional enrichment
		providers: ["openrouter-primary"],
		estimatedRequests: 10,
		estimatedTokens: 50000,
		deterministic: true,
		structuredOutput: true,
		fallbackAllowed: true,
	},
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: true,
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_fact_dossier_schema",
		"validate_content_hash",
		"validate_uncertainty_register",
	],
	modulePath: "../fact-dossier/index.js",
	entryPoint: "buildDossier",
	version: "1.0.0",
	tags: ["consolidation", "fact-dossier", "canonical", "authoritative"],
};

const C04_OMISSION_REVIEW: StageDefinitionInput = {
	stageId: stageId("c04_omission_review"),
	name: "Independent Omission Review",
	description:
		"Execute alternative discovery strategies against canonical fact dossier; detect critical/material omissions; verify and add missing candidates; record coverage gaps",
	phase: "PHASE_C_EVIDENCE_PREP",
	dependencies: [
		{ stageId: stageId("c03_build_fact_dossier"), required: true },
		{ stageId: stageId("b05_persist_discovery_evidence"), required: true },
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "canonical-fact-dossier",
				path: "data/fact-dossiers/edition_{edition}.json",
			},
			{
				artifactId: "complete-discovery-ledger",
				path: "data/discovery-ledger/{edition}_complete_*.json",
			},
			{
				artifactId: "validated-source-registry",
				path: "memory://validated-source-registry",
			},
		],
		optionalArtifacts: [
			{
				artifactId: "previous-edition-dossiers",
				path: "data/fact-dossiers/",
			},
		],
		configurationRefs: ["omission-strategies"],
		environmentVars: ["OPENROUTER_API_KEY"],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "omission-review-report",
				path: "data/omission-reviews/{edition}_*.json",
				description:
					"OmissionReviewReport with newlyDiscoveredCandidates, substantiveUpdates, remainingCoverageGaps, verificationOutcomes",
				required: true,
			},
			{
				artifactId: "repaired-fact-dossier",
				path: "data/fact-dossiers/edition_{edition}.json",
				description:
					"Updated CanonicalFactDossier with verified omissions added",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL", "NETWORK_FETCH"],
		modifiesState: true,
		emitsEvents: ["OMISSION_REVIEW_COMPLETE"],
	},
	inputSchema: "OmissionReviewInput",
	outputSchema: "OmissionReviewResult",
	sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL", "NETWORK_FETCH"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: { ...LONG_BUDGET, timeoutMs: 1200000 },
	checkpointPolicy: DEFAULT_CHECKPOINT,
	inferenceRequirements: {
		required: true,
		providers: ["openrouter-primary"],
		estimatedRequests: 50,
		estimatedTokens: 150000,
		deterministic: true,
		structuredOutput: true,
		fallbackAllowed: true,
	},
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: true,
	compensatingAction:
		"Record UNRESOLVED critical omissions; mark review completeness UNVERIFIED if gaps block",
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_omission_classifications",
		"verify_critical_omissions_resolved",
		"validate_dossier_repair_traceability",
	],
	modulePath: "../omission-review/index.ts",
	entryPoint: "executeOmissionReview",
	version: "1.0.0",
	tags: ["omission", "second-discovery", "independent", "repair"],
};

const C05_HISTORICAL_REGRESSION: StageDefinitionInput = {
	stageId: stageId("c05_historical_regression"),
	name: "Seven-Calendar-Day Historical Regression",
	description:
		"Compare current fact dossier against accessible previous 7 editions; classify relationships (NEW_DEVELOPMENT, PREVIOUSLY_COVERED, SUBSTANTIVE_UPDATE, NEWLY_DISCLOSED_HISTORICAL, DUPLICATE_REPORTING, EXPLICIT_CATCH_UP); identify potential historical omissions",
	phase: "PHASE_C_EVIDENCE_PREP",
	dependencies: [
		{ stageId: stageId("c03_build_fact_dossier"), required: true },
		{ stageId: stageId("c04_omission_review"), required: true }, // Must run after omission review per contract
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "canonical-fact-dossier",
				path: "data/fact-dossiers/edition_{edition}.json",
			},
			{
				artifactId: "omission-review-report",
				path: "data/omission-reviews/{edition}_*.json",
			},
		],
		optionalArtifacts: [
			{ artifactId: "previous-editions", path: "data/fact-dossiers/" },
		],
		configurationRefs: [
			"historical-window-days",
			"max-semantic-comparisons",
		],
		environmentVars: ["OPENROUTER_API_KEY"],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "historical-regression-report",
				path: "data/historical-regression/{edition}_*.json",
				description:
					"HistoricalRegressionReport with relationships, substantiveUpdates, repeatedReporting, potentialOmissions, missingHistoricalEvidence, unresolvedQuestions",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL", "READ_ONLY"],
		modifiesState: true,
		emitsEvents: ["HISTORICAL_REGRESSION_COMPLETE"],
	},
	inputSchema: "HistoricalRegressionInput",
	outputSchema: "HistoricalRegressionReport",
	sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL", "READ_ONLY"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: { ...LONG_BUDGET, timeoutMs: 900000 },
	checkpointPolicy: DEFAULT_CHECKPOINT,
	inferenceRequirements: {
		required: false, // Optional semantic comparison
		providers: ["openrouter-primary"],
		estimatedRequests: 30,
		estimatedTokens: 100000,
		deterministic: true,
		structuredOutput: true,
		fallbackAllowed: true,
	},
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: true,
	compensatingAction:
		"Mark finalStatus UNAVAILABLE if no accessible historical editions; NOT_ASSESSABLE if records present but not usable",
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_relationship_classifications",
		"verify_no_historical_edition_modification",
		"validate_traceability_references",
	],
	modulePath: "../historical-regression/index.ts",
	entryPoint: "executeHistoricalRegression",
	version: "1.0.0",
	tags: ["historical", "regression", "seven-day", "read-only-history"],
};

/** ============================================================================
 * PHASE D — EDITORIAL DECISION-MAKING
 * ============================================================================ */

const D01_EDITORIAL_SELECTION: StageDefinitionInput = {
	stageId: stageId("d01_editorial_selection"),
	name: "Vendor-Neutral Editorial Selection",
	description:
		"Rank and select stories from repaired fact dossier using materiality dimensions; apply concentration review; produce editorial selection manifest with readiness status",
	phase: "PHASE_D_EDITORIAL_DECISION",
	dependencies: [
		{ stageId: stageId("c03_build_fact_dossier"), required: true },
		{ stageId: stageId("c04_omission_review"), required: true },
		{ stageId: stageId("c05_historical_regression"), required: true },
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "canonical-fact-dossier",
				path: "data/fact-dossiers/edition_{edition}.json",
			},
			{
				artifactId: "omission-review-report",
				path: "data/omission-reviews/{edition}_*.json",
			},
			{
				artifactId: "historical-regression-report",
				path: "data/historical-regression/{edition}_*.json",
			},
		],
		optionalArtifacts: [],
		configurationRefs: ["selection-thresholds", "concentration-rules"],
		environmentVars: ["OPENROUTER_API_KEY"],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "editorial-selection-manifest",
				path: "data/editorial-selection/{edition}_*.json",
				description:
					"EditorialSelectionManifest with stories, candidates, decisions, readinessStatus, concentrationReview",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL"],
		modifiesState: true,
		emitsEvents: ["EDITORIAL_SELECTION_COMPLETE"],
	},
	inputSchema: "EditorialSelectionInput",
	outputSchema: "EditorialSelectionManifest",
	sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: LONG_BUDGET,
	checkpointPolicy: DEFAULT_CHECKPOINT,
	inferenceRequirements: {
		required: false, // Optional semantic consistency check
		providers: ["openrouter-primary"],
		estimatedRequests: 10,
		estimatedTokens: 30000,
		deterministic: true,
		structuredOutput: true,
		fallbackAllowed: true,
	},
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: true,
	compensatingAction:
		"Mark readinessStatus BLOCKED if consequential candidates require explicit decision",
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_selection_completeness",
		"validate_evidence_readiness",
		"validate_concentration_review",
	],
	modulePath: "../editorial-selection/index.ts",
	entryPoint: "executeEditorialSelection",
	version: "1.0.0",
	tags: ["editorial", "selection", "vendor-neutral", "materiality"],
};

const D02_VALIDATE_SELECTION_COMPLETENESS: StageDefinitionInput = {
	stageId: stageId("d02_validate_selection_completeness"),
	name: "Validate Selection Completeness & Evidence Readiness",
	description:
		"Verify all selected stories have complete evidence, no blocking unresolved issues, and all editorial dependencies resolved",
	phase: "PHASE_D_EDITORIAL_DECISION",
	dependencies: [
		{ stageId: stageId("d01_editorial_selection"), required: true },
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "editorial-selection-manifest",
				path: "data/editorial-selection/{edition}_*.json",
			},
			{
				artifactId: "canonical-fact-dossier",
				path: "data/fact-dossiers/edition_{edition}.json",
			},
		],
		optionalArtifacts: [],
		configurationRefs: ["completeness-rules"],
		environmentVars: [],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "selection-validation",
				path: "memory://selection-validation",
				description: "Validation result with any blocking issues",
				required: true,
			},
		],
		sideEffects: ["READ_ONLY"],
		modifiesState: false,
		emitsEvents: ["SELECTION_VALIDATED"],
	},
	inputSchema: "EditorialSelectionManifest + CanonicalFactDossier",
	outputSchema: "SelectionValidationResult",
	sideEffects: ["READ_ONLY"],
	retryPolicy: { ...DEFAULT_RETRY, maxAttempts: 1 },
	executionBudget: { ...DEFAULT_BUDGET, timeoutMs: 30000 },
	checkpointPolicy: { ...DEFAULT_CHECKPOINT, enabled: false },
	inferenceRequirements: { required: false },
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: false,
	validationResponsibility: "SELF",
	postValidationHooks: ["validate_no_unresolved_dependencies"],
	modulePath: "./phases/phase-d.ts",
	entryPoint: "validateSelectionCompletenessWrapper",
	version: "1.0.0",
	tags: ["validation", "completeness", "evidence-readiness"],
};

const D03_RESOLVE_EDITORIAL_DEPENDENCIES: StageDefinitionInput = {
	stageId: stageId("d03_resolve_editorial_dependencies"),
	name: "Resolve Unresolved Editorial Dependencies",
	description:
		"Apply existing contracts to resolve any remaining editorial dependencies (e.g., catch-up approvals, historical omissions, cross-references)",
	phase: "PHASE_D_EDITORIAL_DECISION",
	dependencies: [
		{ stageId: stageId("d01_editorial_selection"), required: true },
		{
			stageId: stageId("d02_validate_selection_completeness"),
			required: true,
		},
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "editorial-selection-manifest",
				path: "data/editorial-selection/{edition}_*.json",
			},
		],
		optionalArtifacts: [
			{
				artifactId: "omission-review-report",
				path: "data/omission-reviews/{edition}_*.json",
			},
			{
				artifactId: "historical-regression-report",
				path: "data/historical-regression/{edition}_*.json",
			},
		],
		configurationRefs: ["dependency-resolution-rules"],
		environmentVars: ["OPENROUTER_API_KEY"],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "resolved-editorial-manifest",
				path: "data/editorial-selection/{edition}_resolved_*.json",
				description:
					"EditorialSelectionManifest with unresolvedIssues cleared",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL"],
		modifiesState: true,
		emitsEvents: ["EDITORIAL_DEPENDENCIES_RESOLVED"],
	},
	inputSchema:
		"EditorialSelectionManifest + OmissionReview + HistoricalRegression",
	outputSchema: "EditorialSelectionManifest",
	sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: LONG_BUDGET,
	checkpointPolicy: DEFAULT_CHECKPOINT,
	inferenceRequirements: {
		required: false,
		providers: ["openrouter-primary"],
		estimatedRequests: 5,
		estimatedTokens: 20000,
		deterministic: true,
		structuredOutput: true,
		fallbackAllowed: true,
	},
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: true,
	validationResponsibility: "SELF",
	postValidationHooks: ["validate_all_dependencies_resolved"],
	modulePath: "./phases/phase-d.ts",
	entryPoint: "resolveEditorialDependenciesWrapper",
	version: "1.0.0",
	tags: ["editorial", "dependencies", "resolution"],
};

/** ============================================================================
 * PHASE E — PUBLICATION PRODUCTION
 * ============================================================================ */

const E01_GENERATE_NL_NEWSLETTER: StageDefinitionInput = {
	stageId: stageId("e01_generate_nl_newsletter"),
	name: "Generate Dutch Technical Newsletter",
	description:
		"Produce publication.md (readable technical newsletter in Dutch) from canonical fact dossier and editorial manifest",
	phase: "PHASE_E_PUBLICATION_PRODUCTION",
	dependencies: [
		{
			stageId: stageId("d03_resolve_editorial_dependencies"),
			required: true,
		},
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "canonical-fact-dossier",
				path: "data/fact-dossiers/edition_{edition}.json",
			},
			{
				artifactId: "resolved-editorial-manifest",
				path: "data/editorial-selection/{edition}_resolved_*.json",
			},
			{
				artifactId: "historical-regression-report",
				path: "data/historical-regression/{edition}_*.json",
			},
		],
		optionalArtifacts: [],
		configurationRefs: ["newsletter-template", "max-reading-time"],
		environmentVars: [],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "newsletter-md",
				path: "editions/edition_{edition}/canonical/publication.md",
				description: "Dutch readable technical newsletter",
				required: true,
			},
			{
				artifactId: "newsletter-meta",
				path: "editions/edition_{edition}/canonical/publication.md.meta.json",
				description: "PublicationMetadata with lifecycleStatus DRAFT",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL", "PUBLISH_PREP"],
		modifiesState: true,
		emitsEvents: ["NL_NEWSLETTER_GENERATED"],
	},
	inputSchema: "NewsletterGenerationInput",
	outputSchema: "PublicationArtifact + Metadata",
	sideEffects: ["WRITE_LOCAL", "PUBLISH_PREP"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: PUBLICATION_BUDGET,
	checkpointPolicy: DEFAULT_CHECKPOINT,
	inferenceRequirements: { required: false },
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: true,
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_newsletter_structure",
		"validate_cross_language_consistency",
	],
	modulePath: "../publication/index.ts",
	entryPoint: "generateNewsletterMarkdownWrapper",
	version: "1.0.0",
	tags: ["publication", "dutch", "newsletter", "canonical"],
};

const E02_GENERATE_NL_LISTENING: StageDefinitionInput = {
	stageId: stageId("e02_generate_nl_listening"),
	name: "Generate Dutch Independent Listening Narrative",
	description:
		'Produce "AI Daily Intelligence — YYYY-MM-DD.md" (independently authored Dutch listening narrative) from canonical evidence',
	phase: "PHASE_E_PUBLICATION_PRODUCTION",
	dependencies: [
		{
			stageId: stageId("d03_resolve_editorial_dependencies"),
			required: true,
		},
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "canonical-fact-dossier",
				path: "data/fact-dossiers/edition_{edition}.json",
			},
			{
				artifactId: "resolved-editorial-manifest",
				path: "data/editorial-selection/{edition}_resolved_*.json",
			},
			{
				artifactId: "historical-regression-report",
				path: "data/historical-regression/{edition}_*.json",
			},
		],
		optionalArtifacts: [],
		configurationRefs: ["listening-template", "target-duration-minutes"],
		environmentVars: [],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "listening-nl-md",
				path: "editions/edition_{edition}/canonical/AI Daily Intelligence — {edition}.md",
				description: "Dutch independent listening narrative",
				required: true,
			},
			{
				artifactId: "listening-nl-meta",
				path: "editions/edition_{edition}/canonical/AI Daily Intelligence — {edition}.md.meta.json",
				description: "PublicationMetadata with lifecycleStatus DRAFT",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL", "PUBLISH_PREP"],
		modifiesState: true,
		emitsEvents: ["NL_LISTENING_GENERATED"],
	},
	inputSchema: "ListeningNarrativeGenerationInput",
	outputSchema: "PublicationArtifact + Metadata",
	sideEffects: ["WRITE_LOCAL", "PUBLISH_PREP"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: PUBLICATION_BUDGET,
	checkpointPolicy: DEFAULT_CHECKPOINT,
	inferenceRequirements: { required: false },
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: true,
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_listening_structure",
		"validate_no_urls_citations",
		"validate_independent_authoring",
	],
	modulePath: "../publication/index.ts",
	entryPoint: "generateListeningNarrativeMarkdownWrapper",
	version: "1.0.0",
	tags: [
		"publication",
		"dutch",
		"listening",
		"canonical",
		"independent-authoring",
	],
};

const E02b_GENERATE_RESEARCH_AUDIT: StageDefinitionInput = {
	stageId: stageId("e02b_generate_research_audit"),
	name: "Generate Research Audit — Technical Evidence & Editorial Accountability",
	description:
		"Produce research-audit.md (technical evidence & editorial accountability) from canonical fact dossier and editorial manifest",
	phase: "PHASE_E_PUBLICATION_PRODUCTION",
	dependencies: [
		{
			stageId: stageId("d03_resolve_editorial_dependencies"),
			required: true,
		},
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "canonical-fact-dossier",
				path: "data/fact-dossiers/edition_{edition}.json",
			},
			{
				artifactId: "resolved-editorial-manifest",
				path: "data/editorial-selection/{edition}_resolved_*.json",
			},
			{
				artifactId: "historical-regression-report",
				path: "data/historical-regression/{edition}_*.json",
			},
		],
		optionalArtifacts: [],
		configurationRefs: [
			"research-audit-template",
			"evidence-citation-rules",
		],
		environmentVars: ["OPENROUTER_API_KEY"],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "research-audit-md",
				path: "editions/edition_{edition}/canonical/research-audit.md",
				description:
					"Research audit — technical evidence & editorial accountability",
				required: true,
			},
			{
				artifactId: "research-audit-meta",
				path: "editions/edition_{edition}/canonical/research-audit.md.meta.json",
				description: "PublicationMetadata with lifecycleStatus DRAFT",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL", "PUBLISH_PREP", "INFERENCE_CALL"],
		modifiesState: true,
		emitsEvents: ["RESEARCH_AUDIT_GENERATED"],
	},
	inputSchema: "ResearchAuditGenerationInput",
	outputSchema: "PublicationArtifact + Metadata + Traceability",
	sideEffects: ["WRITE_LOCAL", "PUBLISH_PREP", "INFERENCE_CALL"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: PUBLICATION_BUDGET,
	checkpointPolicy: DEFAULT_CHECKPOINT,
	inferenceRequirements: {
		required: false,
		providers: ["openrouter-primary"],
		estimatedRequests: 5,
		estimatedTokens: 20000,
		deterministic: true,
		structuredOutput: true,
		fallbackAllowed: true,
	},
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: true,
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_evidence_citation_coverage",
		"validate_editorial_accountability_completeness",
		"validate_traceability_completeness",
	],
	modulePath: "../publication/index.ts",
	entryPoint: "generateResearchAuditWrapper",
	version: "1.0.0",
	tags: [
		"publication",
		"research-audit",
		"evidence",
		"editorial-accountability",
		"canonical",
	],
};

const E03_GENERATE_EN_ARTICLES: StageDefinitionInput = {
	stageId: stageId("e03_generate_en_articles"),
	name: "Generate English Readable Derivatives",
	description:
		"Produce English website articles from canonical fact dossier (derived, not independently authored)",
	phase: "PHASE_E_PUBLICATION_PRODUCTION",
	dependencies: [
		{ stageId: stageId("e01_generate_nl_newsletter"), required: true },
		{ stageId: stageId("e02_generate_nl_listening"), required: true },
		{ stageId: stageId("e02b_generate_research_audit"), required: true },
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "canonical-fact-dossier",
				path: "data/fact-dossiers/edition_{edition}.json",
			},
			{
				artifactId: "resolved-editorial-manifest",
				path: "data/editorial-selection/{edition}_resolved_*.json",
			},
			{
				artifactId: "newsletter-md",
				path: "editions/edition_{edition}/canonical/publication.md",
			},
		],
		optionalArtifacts: [],
		configurationRefs: ["english-template", "cross-language-rules"],
		environmentVars: ["OPENROUTER_API_KEY"],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "english-articles",
				path: "editions/edition_{edition}/derivatives/english-articles/*.md",
				description: "English readable article derivatives",
				required: true,
			},
			{
				artifactId: "english-articles-meta",
				path: "editions/edition_{edition}/derivatives/english-articles/*.meta.json",
				description: "PublicationMetadata for each article",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL", "PUBLISH_PREP", "INFERENCE_CALL"],
		modifiesState: true,
		emitsEvents: ["EN_ARTICLES_GENERATED"],
	},
	inputSchema: "EnglishArticleGenerationInput",
	outputSchema: "PublicationArtifact[] + Metadata[]",
	sideEffects: ["WRITE_LOCAL", "PUBLISH_PREP", "INFERENCE_CALL"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: PUBLICATION_BUDGET,
	checkpointPolicy: DEFAULT_CHECKPOINT,
	inferenceRequirements: {
		required: true,
		providers: ["openrouter-primary"],
		estimatedRequests: 10,
		estimatedTokens: 50000,
		deterministic: true,
		structuredOutput: false,
		fallbackAllowed: true,
	},
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: true,
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_cross_language_consistency",
		"validate_factual_provenance_preserved",
	],
	modulePath: "../publication/index.js",
	entryPoint: "generateEnglishArticles",
	version: "1.0.0",
	tags: ["publication", "english", "derivative", "translation"],
};

const E04_GENERATE_EN_LISTENING: StageDefinitionInput = {
	stageId: stageId("e04_generate_en_listening"),
	name: "Generate English Listening Derivatives",
	description:
		"Produce English listening narratives from canonical evidence (derived from Dutch listening narrative structure)",
	phase: "PHASE_E_PUBLICATION_PRODUCTION",
	dependencies: [
		{ stageId: stageId("e02_generate_nl_listening"), required: true },
		{ stageId: stageId("e01_generate_nl_newsletter"), required: true },
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "canonical-fact-dossier",
				path: "data/fact-dossiers/edition_{edition}.json",
			},
			{
				artifactId: "resolved-editorial-manifest",
				path: "data/editorial-selection/{edition}_resolved_*.json",
			},
			{
				artifactId: "listening-nl-md",
				path: "editions/edition_{edition}/canonical/AI Daily Intelligence — {edition}.md",
			},
		],
		optionalArtifacts: [],
		configurationRefs: ["english-listening-template"],
		environmentVars: ["OPENROUTER_API_KEY"],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "english-listening",
				path: "editions/edition_{edition}/derivatives/english-listening/*.md",
				description: "English listening narrative derivatives",
				required: true,
			},
			{
				artifactId: "english-listening-meta",
				path: "editions/edition_{edition}/derivatives/english-listening/*.meta.json",
				description: "PublicationMetadata for each listening piece",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL", "PUBLISH_PREP", "INFERENCE_CALL"],
		modifiesState: true,
		emitsEvents: ["EN_LISTENING_GENERATED"],
	},
	inputSchema: "EnglishListeningGenerationInput",
	outputSchema: "PublicationArtifact[] + Metadata[]",
	sideEffects: ["WRITE_LOCAL", "PUBLISH_PREP", "INFERENCE_CALL"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: PUBLICATION_BUDGET,
	checkpointPolicy: DEFAULT_CHECKPOINT,
	inferenceRequirements: {
		required: true,
		providers: ["openrouter-primary"],
		estimatedRequests: 10,
		estimatedTokens: 50000,
		deterministic: true,
		structuredOutput: false,
		fallbackAllowed: true,
	},
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: true,
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_cross_language_consistency",
		"validate_listening_provenance",
	],
	modulePath: "../publication/index.js",
	entryPoint: "generateEnglishListeningNarratives",
	version: "1.0.0",
	tags: ["publication", "english", "listening", "derivative"],
};

const E05_GENERATE_VISUALS: StageDefinitionInput = {
	stageId: stageId("e05_generate_visuals"),
	name: "Generate Optional Evidence-Backed Visual Explanations",
	description:
		"Create accessible visual explanations (diagrams, timelines, comparisons) for stories with explanationOpportunities; always provide textual fallback",
	phase: "PHASE_E_PUBLICATION_PRODUCTION",
	dependencies: [
		{ stageId: stageId("e01_generate_nl_newsletter"), required: true },
		{ stageId: stageId("e02_generate_nl_listening"), required: true },
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "resolved-editorial-manifest",
				path: "data/editorial-selection/{edition}_resolved_*.json",
			},
			{
				artifactId: "canonical-fact-dossier",
				path: "data/fact-dossiers/edition_{edition}.json",
			},
		],
		optionalArtifacts: [],
		configurationRefs: [
			"visualization-rules",
			"accessibility-requirements",
		],
		environmentVars: ["OPENROUTER_API_KEY"],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "visual-assets",
				path: "editions/edition_{edition}/assets/visualizations/",
				description:
					"SVG/PNG visualizations with accessibility metadata",
				required: false,
			},
			{
				artifactId: "visual-metadata",
				path: "editions/edition_{edition}/assets/visualizations/*.meta.json",
				description:
					"VisualizationMetadata with alt text, fallback description",
				required: false,
			},
		],
		sideEffects: ["WRITE_LOCAL", "PUBLISH_PREP", "INFERENCE_CALL"],
		modifiesState: true,
		emitsEvents: ["VISUALS_GENERATED"],
	},
	inputSchema: "VisualizationInput",
	outputSchema: "VisualizationArtifact[]",
	sideEffects: ["WRITE_LOCAL", "PUBLISH_PREP", "INFERENCE_CALL"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: PUBLICATION_BUDGET,
	checkpointPolicy: DEFAULT_CHECKPOINT,
	inferenceRequirements: {
		required: false,
		providers: ["openrouter-primary"],
		estimatedRequests: 10,
		estimatedTokens: 50000,
		deterministic: true,
		structuredOutput: true,
		fallbackAllowed: true,
	},
	failureBehavior: "ALLOW_PARTIAL",
	recoverable: true,
	compensatingAction:
		"Skip visuals; textual fallback always available in publications",
	validationResponsibility: "SELF",
	postValidationHooks: ["validate_accessibility", "validate_evidence_backed"],
	modulePath: "../visualization/index.js",
	entryPoint: "generateVisualizations",
	version: "1.0.0",
	tags: ["visualization", "optional", "accessibility", "evidence-backed"],
};

const E06_VALIDATE_PUBLICATION_ARTIFACTS: StageDefinitionInput = {
	stageId: stageId("e06_validate_publication_artifacts"),
	name: "Validate Publication Artifact Structure & Cross-Language Consistency",
	description:
		"Verify all three canonical documents exist, have valid metadata, correct edition identity, UTF-8 content, required source references, consistent story coverage, factual provenance, correct lifecycle state",
	phase: "PHASE_E_PUBLICATION_PRODUCTION",
	dependencies: [
		{ stageId: stageId("e01_generate_nl_newsletter"), required: true },
		{ stageId: stageId("e02_generate_nl_listening"), required: true },
		{ stageId: stageId("e03_generate_en_articles"), required: true },
		{ stageId: stageId("e04_generate_en_listening"), required: true },
		{ stageId: stageId("e05_generate_visuals"), required: false },
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "newsletter-md",
				path: "editions/edition_{edition}/canonical/publication.md",
			},
			{
				artifactId: "listening-nl-md",
				path: "editions/edition_{edition}/canonical/AI Daily Intelligence — {edition}.md",
			},
			{
				artifactId: "research-audit-md",
				path: "editions/edition_{edition}/canonical/research-audit.md",
			},
			{
				artifactId: "english-articles",
				path: "editions/edition_{edition}/derivatives/english-articles/",
			},
			{
				artifactId: "english-listening",
				path: "editions/edition_{edition}/derivatives/english-listening/",
			},
		],
		optionalArtifacts: [
			{
				artifactId: "visual-assets",
				path: "editions/edition_{edition}/assets/visualizations/",
			},
		],
		configurationRefs: ["publication-validation-rules"],
		environmentVars: [],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "publication-validation-report",
				path: "memory://publication-validation-report",
				description: "Validation results for all artifacts",
				required: true,
			},
		],
		sideEffects: ["READ_ONLY"],
		modifiesState: false,
		emitsEvents: ["PUBLICATION_ARTIFACTS_VALIDATED"],
	},
	inputSchema: "PublicationArtifact[] + Metadata[]",
	outputSchema: "PublicationValidationReport",
	sideEffects: ["READ_ONLY"],
	retryPolicy: { ...DEFAULT_RETRY, maxAttempts: 1 },
	executionBudget: { ...DEFAULT_BUDGET, timeoutMs: 60000 },
	checkpointPolicy: { ...DEFAULT_CHECKPOINT, enabled: false },
	inferenceRequirements: { required: false },
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: false,
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_three_canonical_documents",
		"validate_filenames",
		"validate_metadata",
		"validate_cross_language_consistency",
		"validate_no_overwrite_published",
	],
	modulePath: "../publication/index.js",
	entryPoint: "validatePublicationArtifacts",
	version: "1.0.0",
	tags: ["validation", "publication", "cross-language", "integrity"],
};

/** ============================================================================
 * PHASE F — QUALITY ASSURANCE
 * ============================================================================ */

const F01_Q1Q10_EVALUATION: StageDefinitionInput = {
	stageId: stageId("f01_q1q10_evaluation"),
	name: "Listening Quality Q1-Q10 Evaluation",
	description:
		"Evaluate Dutch listening narrative against Q1-Q10 criteria (factual fidelity, technical depth, narrative coherence, cognitive accessibility, adult listening suitability)",
	phase: "PHASE_F_QUALITY_ASSURANCE",
	dependencies: [
		{ stageId: stageId("e02_generate_nl_listening"), required: true },
		{
			stageId: stageId("e06_validate_publication_artifacts"),
			required: true,
		},
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "listening-nl-md",
				path: "editions/edition_{edition}/canonical/AI Daily Intelligence — {edition}.md",
			},
			{
				artifactId: "canonical-fact-dossier",
				path: "data/fact-dossiers/edition_{edition}.json",
			},
			{
				artifactId: "resolved-editorial-manifest",
				path: "data/editorial-selection/{edition}_resolved_*.json",
			},
		],
		optionalArtifacts: [
			{
				artifactId: "historical-regression-report",
				path: "data/historical-regression/{edition}_*.json",
			},
		],
		configurationRefs: ["q1q10-criteria", "repair-budget"],
		environmentVars: ["OPENROUTER_API_KEY"],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "q1q10-evaluation",
				path: "data/quality/q1q10/{edition}_*.json",
				description:
					"ListeningQualityEvaluationReport with criterionEvaluations, overallSummary, repairActions",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL"],
		modifiesState: true,
		emitsEvents: ["Q1Q10_EVALUATED"],
	},
	inputSchema: "ListeningQualityEvaluationInput",
	outputSchema: "ListeningQualityEvaluationReport",
	sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: LONG_BUDGET,
	checkpointPolicy: DEFAULT_CHECKPOINT,
	inferenceRequirements: {
		required: true,
		providers: ["openrouter-primary"],
		estimatedRequests: 20,
		estimatedTokens: 80000,
		deterministic: true,
		structuredOutput: true,
		fallbackAllowed: true,
	},
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: true,
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_criterion_structured_output",
		"validate_unverified_not_pass",
	],
	modulePath: "../listening-quality-evaluation/index.ts",
	entryPoint: "evaluateListeningQualityWrapper",
	version: "1.0.0",
	tags: ["quality", "q1q10", "listening", "evaluation"],
};

const F02_AUDIO_AG_EVALUATION: StageDefinitionInput = {
	stageId: stageId("f02_audio_ag_evaluation"),
	name: "Audio A-G Holistic Listening Evaluation",
	description:
		"Evaluate complete listening experience against Audio A-G criteria (complements Q1-Q10 by assessing integrated narrative quality)",
	phase: "PHASE_F_QUALITY_ASSURANCE",
	dependencies: [
		{ stageId: stageId("f01_q1q10_evaluation"), required: true },
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "listening-nl-md",
				path: "editions/edition_{edition}/canonical/AI Daily Intelligence — {edition}.md",
			},
			{
				artifactId: "q1q10-evaluation",
				path: "data/quality/q1q10/{edition}_*.json",
			},
			{
				artifactId: "canonical-fact-dossier",
				path: "data/fact-dossiers/edition_{edition}.json",
			},
			{
				artifactId: "resolved-editorial-manifest",
				path: "data/editorial-selection/{edition}_resolved_*.json",
			},
		],
		optionalArtifacts: [
			{
				artifactId: "historical-regression-report",
				path: "data/historical-regression/{edition}_*.json",
			},
		],
		configurationRefs: ["audio-ag-criteria", "tradeoff-detection"],
		environmentVars: ["OPENROUTER_API_KEY"],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "audio-ag-evaluation",
				path: "data/quality/audio-ag/{edition}_*.json",
				description:
					"AudioQualityEvaluationReport with criterionEvaluations, holisticAssessment, tradeoffs",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL"],
		modifiesState: true,
		emitsEvents: ["AUDIO_AG_EVALUATED"],
	},
	inputSchema: "AudioQualityEvaluationInput",
	outputSchema: "AudioQualityEvaluationReport",
	sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: LONG_BUDGET,
	checkpointPolicy: DEFAULT_CHECKPOINT,
	inferenceRequirements: {
		required: true,
		providers: ["openrouter-primary"],
		estimatedRequests: 15,
		estimatedTokens: 60000,
		deterministic: true,
		structuredOutput: true,
		fallbackAllowed: true,
	},
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: true,
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_holistic_assessment",
		"validate_q_evidence_references",
	],
	modulePath: "../listening-quality-evaluation/index.ts",
	entryPoint: "evaluateAudioQualityWrapper",
	version: "1.0.0",
	tags: ["quality", "audio-ag", "holistic", "listening"],
};

const F03_READABLE_QUALITY_EVALUATION: StageDefinitionInput = {
	stageId: stageId("f03_readable_quality_evaluation"),
	name: "Readable Publication Quality Evaluation",
	description:
		"Evaluate Dutch newsletter and research audit for structure, evidence integration, readability, ADHD-friendly metrics, bilingual consistency",
	phase: "PHASE_F_QUALITY_ASSURANCE",
	dependencies: [
		{ stageId: stageId("e01_generate_nl_newsletter"), required: true },
		{
			stageId: stageId("e06_validate_publication_artifacts"),
			required: true,
		},
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "newsletter-md",
				path: "editions/edition_{edition}/canonical/publication.md",
			},
			{
				artifactId: "research-audit-md",
				path: "editions/edition_{edition}/canonical/research-audit.md",
			},
			{
				artifactId: "canonical-fact-dossier",
				path: "data/fact-dossiers/edition_{edition}.json",
			},
			{
				artifactId: "resolved-editorial-manifest",
				path: "data/editorial-selection/{edition}_resolved_*.json",
			},
		],
		optionalArtifacts: [],
		configurationRefs: ["readable-quality-rules", "adhd-metrics"],
		environmentVars: ["OPENROUTER_API_KEY"],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "readable-quality-evaluation",
				path: "data/quality/readable/{edition}_*.json",
				description: "ReadablePublicationEvaluationReport",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL"],
		modifiesState: true,
		emitsEvents: ["READABLE_QUALITY_EVALUATED"],
	},
	inputSchema: "ReadablePublicationEvaluationInput",
	outputSchema: "ReadablePublicationEvaluationReport",
	sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: LONG_BUDGET,
	checkpointPolicy: DEFAULT_CHECKPOINT,
	inferenceRequirements: {
		required: true,
		providers: ["openrouter-primary"],
		estimatedRequests: 15,
		estimatedTokens: 50000,
		deterministic: true,
		structuredOutput: true,
		fallbackAllowed: true,
	},
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: true,
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_adhd_metrics",
		"validate_bilingual_consistency",
	],
	modulePath: "../readable-publication-evaluation/index.js",
	entryPoint: "evaluateReadablePublication",
	version: "1.0.0",
	tags: ["quality", "readable", "adhd-friendly", "bilingual"],
};

const F04_VISUALIZATION_ACCESSIBILITY: StageDefinitionInput = {
	stageId: stageId("f04_visualization_accessibility"),
	name: "Visualization & Accessibility Checks",
	description:
		"Validate generated visualizations for accessibility (alt text, contrast, reduced motion), WCAG 2.2 AA compliance, and evidence-backed content",
	phase: "PHASE_F_QUALITY_ASSURANCE",
	dependencies: [
		{ stageId: stageId("e05_generate_visuals"), required: true },
		{
			stageId: stageId("e06_validate_publication_artifacts"),
			required: true,
		},
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "visual-assets",
				path: "editions/edition_{edition}/assets/visualizations/",
			},
			{
				artifactId: "newsletter-md",
				path: "editions/edition_{edition}/canonical/publication.md",
			},
		],
		optionalArtifacts: [],
		configurationRefs: ["accessibility-rules", "visualization-standards"],
		environmentVars: [],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "visualization-accessibility-report",
				path: "data/quality/visualization/{edition}_*.json",
				description: "VisualizationAccessibilityReport",
				required: true,
			},
		],
		sideEffects: ["READ_ONLY"],
		modifiesState: false,
		emitsEvents: ["VISUALIZATION_ACCESSIBILITY_CHECKED"],
	},
	inputSchema: "VisualizationArtifact[] + PublicationArtifact",
	outputSchema: "VisualizationAccessibilityReport",
	sideEffects: ["READ_ONLY"],
	retryPolicy: { ...DEFAULT_RETRY, maxAttempts: 1 },
	executionBudget: { ...DEFAULT_BUDGET, timeoutMs: 60000 },
	checkpointPolicy: { ...DEFAULT_CHECKPOINT, enabled: false },
	inferenceRequirements: { required: false },
	failureBehavior: "ALLOW_PARTIAL",
	recoverable: true,
	compensatingAction: "Textual fallback in publications suffices",
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_wcag_aa",
		"validate_alt_text",
		"validate_textual_fallback",
	],
	modulePath: "../visualization/index.js",
	entryPoint: "validateVisualizationAccessibility",
	version: "1.0.0",
	tags: ["quality", "visualization", "accessibility", "wcag"],
};

const F05_BOUNDED_REPAIRS: StageDefinitionInput = {
	stageId: stageId("f05_bounded_repairs"),
	name: "Bounded Editorial Repairs & Regression Checks",
	description:
		"Execute controlled repair actions for failed quality criteria; preserve original evidence and selection; validate repaired artifacts; rerun affected downstream checks; enforce iteration budgets",
	phase: "PHASE_F_QUALITY_ASSURANCE",
	dependencies: [
		{ stageId: stageId("f01_q1q10_evaluation"), required: true },
		{ stageId: stageId("f02_audio_ag_evaluation"), required: true },
		{ stageId: stageId("f03_readable_quality_evaluation"), required: true },
		{ stageId: stageId("f04_visualization_accessibility"), required: true },
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "q1q10-evaluation",
				path: "data/quality/q1q10/{edition}_*.json",
			},
			{
				artifactId: "audio-ag-evaluation",
				path: "data/quality/audio-ag/{edition}_*.json",
			},
			{
				artifactId: "readable-quality-evaluation",
				path: "data/quality/readable/{edition}_*.json",
			},
			{
				artifactId: "listening-nl-md",
				path: "editions/edition_{edition}/canonical/AI Daily Intelligence — {edition}.md",
			},
			{
				artifactId: "newsletter-md",
				path: "editions/edition_{edition}/canonical/publication.md",
			},
			{
				artifactId: "research-audit-md",
				path: "editions/edition_{edition}/canonical/research-audit.md",
			},
			{
				artifactId: "canonical-fact-dossier",
				path: "data/fact-dossiers/edition_{edition}.json",
			},
			{
				artifactId: "resolved-editorial-manifest",
				path: "data/editorial-selection/{edition}_resolved_*.json",
			},
		],
		optionalArtifacts: [],
		configurationRefs: ["max-repair-iterations", "repair-budget"],
		environmentVars: ["OPENROUTER_API_KEY"],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "repaired-listening-nl",
				path: "editions/edition_{edition}/canonical/AI Daily Intelligence — {edition}.md",
				description: "Repaired Dutch listening narrative",
				required: false,
			},
			{
				artifactId: "repaired-newsletter",
				path: "editions/edition_{edition}/canonical/publication.md",
				description: "Repaired Dutch newsletter",
				required: false,
			},
			{
				artifactId: "repaired-research-audit",
				path: "editions/edition_{edition}/canonical/research-audit.md",
				description: "Repaired research audit",
				required: false,
			},
			{
				artifactId: "repair-record",
				path: "data/quality/repairs/{edition}_*.json",
				description:
					"RepairRecord with attempts, outcomes, downstream rechecks",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL"],
		modifiesState: true,
		emitsEvents: ["REPAIRS_COMPLETE"],
	},
	inputSchema: "QualityEvaluationReports + PublicationArtifacts",
	outputSchema: "RepairRecord",
	sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: { ...LONG_BUDGET, timeoutMs: 1800000 }, // 30 minutes
	checkpointPolicy: DEFAULT_CHECKPOINT,
	inferenceRequirements: {
		required: true,
		providers: ["openrouter-primary"],
		estimatedRequests: 20,
		estimatedTokens: 80000,
		deterministic: true,
		structuredOutput: true,
		fallbackAllowed: true,
	},
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: true,
	compensatingAction:
		"Stop/escalate when no safe repair remains; record residual failures",
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_no_fact_modification",
		"validate_downstream_regression_check",
		"validate_iteration_budget",
	],
	modulePath: "./phases/phase-f.ts",
	entryPoint: "executeBoundedRepairs",
	version: "1.0.0",
	tags: ["quality", "repair", "bounded", "regression-check"],
};

/** ============================================================================
 * PHASE G — KNOWLEDGE CONTINUITY
 * ============================================================================ */

const G01_THESAURUS_EVALUATION: StageDefinitionInput = {
	stageId: stageId("g01_thesaurus_evaluation"),
	name: "Thesaurus Terminology Evaluation",
	description:
		"Evaluate candidate terminology additions/updates from edition evidence; verify definitions, relationships, bilingual terms; persist changes with traceability",
	phase: "PHASE_G_KNOWLEDGE_CONTINUITY",
	dependencies: [
		{ stageId: stageId("c03_build_fact_dossier"), required: true },
		{
			stageId: stageId("d03_resolve_editorial_dependencies"),
			required: true,
		},
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "canonical-fact-dossier",
				path: "data/fact-dossiers/edition_{edition}.json",
			},
			{
				artifactId: "resolved-editorial-manifest",
				path: "data/editorial-selection/{edition}_resolved_*.json",
			},
			{
				artifactId: "thesaurus",
				path: "data/thesaurus/thesaurus-artifact.json",
			},
		],
		optionalArtifacts: [],
		configurationRefs: ["terminology-criteria", "auto-promotion-rules"],
		environmentVars: ["OPENROUTER_API_KEY"],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "thesaurus",
				path: "data/thesaurus/thesaurus-artifact.json",
				description:
					"Updated ThesaurusArtifact with new/verified entries",
				required: true,
			},
			{
				artifactId: "thesaurus-evaluation",
				path: "data/thesaurus/evaluations/{edition}_*.json",
				description: "ThesaurusEvaluationResult",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL"],
		modifiesState: true,
		emitsEvents: ["THESAURUS_EVALUATED"],
	},
	inputSchema: "CanonicalFactDossier + EditorialManifest + ThesaurusArtifact",
	outputSchema: "ThesaurusArtifact + EvaluationResult",
	sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: LONG_BUDGET,
	checkpointPolicy: DEFAULT_CHECKPOINT,
	inferenceRequirements: {
		required: true,
		providers: ["openrouter-primary"],
		estimatedRequests: 10,
		estimatedTokens: 50000,
		deterministic: true,
		structuredOutput: true,
		fallbackAllowed: true,
	},
	failureBehavior: "ALLOW_PARTIAL",
	recoverable: true,
	compensatingAction: "Valid outcome NONE acceptable; record skipped ≠ NONE",
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_persistence_readback",
		"validate_bilingual_definitions",
		"validate_relationship_traceability",
	],
	modulePath: "../thesaurus/index.js",
	entryPoint: "evaluateThesaurus",
	version: "1.0.0",
	tags: ["knowledge", "thesaurus", "terminology", "persistence"],
};

const G02_ARCHITECTURE_PRINCIPLES_EVALUATION: StageDefinitionInput = {
	stageId: stageId("g02_architecture_principles_evaluation"),
	name: "Architecture Principles Evaluation",
	description:
		"Evaluate ADD, CONFIRM, REFINE, MERGE, SUPERSEDE, NONE for principles; validate evidence, relationships, testable consequences; persist with traceability",
	phase: "PHASE_G_KNOWLEDGE_CONTINUITY",
	dependencies: [
		{ stageId: stageId("c03_build_fact_dossier"), required: true },
		{
			stageId: stageId("d03_resolve_editorial_dependencies"),
			required: true,
		},
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "canonical-fact-dossier",
				path: "data/fact-dossiers/edition_{edition}.json",
			},
			{
				artifactId: "resolved-editorial-manifest",
				path: "data/editorial-selection/{edition}_resolved_*.json",
			},
			{
				artifactId: "architecture-principles",
				path: "data/architecture-principles/apr-artifact.json",
			},
		],
		optionalArtifacts: [],
		configurationRefs: ["principle-criteria", "evidence-requirements"],
		environmentVars: ["OPENROUTER_API_KEY"],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "architecture-principles",
				path: "data/architecture-principles/apr-artifact.json",
				description: "Updated ArchitecturePrinciplesRegister",
				required: true,
			},
			{
				artifactId: "principles-evaluation",
				path: "data/architecture-principles/evaluations/{edition}_*.json",
				description: "PrinciplesEvaluationResult",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL"],
		modifiesState: true,
		emitsEvents: ["PRINCIPLES_EVALUATED"],
	},
	inputSchema:
		"CanonicalFactDossier + EditorialManifest + ArchitecturePrinciplesRegister",
	outputSchema: "ArchitecturePrinciplesRegister + EvaluationResult",
	sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: LONG_BUDGET,
	checkpointPolicy: DEFAULT_CHECKPOINT,
	inferenceRequirements: {
		required: true,
		providers: ["openrouter-primary"],
		estimatedRequests: 15,
		estimatedTokens: 80000,
		deterministic: true,
		structuredOutput: true,
		fallbackAllowed: true,
	},
	failureBehavior: "ALLOW_PARTIAL",
	recoverable: true,
	compensatingAction: "Valid outcome NONE acceptable; record skipped ≠ NONE",
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_persistence_readback",
		"validate_evidence_relationships",
		"validate_testable_consequences",
	],
	modulePath: "../architecture-principles/index.js",
	entryPoint: "evaluateArchitecturePrinciples",
	version: "1.0.0",
	tags: [
		"knowledge",
		"architecture-principles",
		"evidence-backed",
		"persistence",
	],
};

const G03_BOOK_DELTA_EVALUATION: StageDefinitionInput = {
	stageId: stageId("g03_book_delta_evaluation"),
	name: "Book Delta Proposal Evaluation",
	description:
		"Generate evidence-backed educational improvement proposals; deduplicate against historical proposals; preserve approval boundary; integrate with research-audit",
	phase: "PHASE_G_KNOWLEDGE_CONTINUITY",
	dependencies: [
		{ stageId: stageId("c03_build_fact_dossier"), required: true },
		{
			stageId: stageId("d03_resolve_editorial_dependencies"),
			required: true,
		},
		{ stageId: stageId("g01_thesaurus_evaluation"), required: false },
		{
			stageId: stageId("g02_architecture_principles_evaluation"),
			required: false,
		},
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "canonical-fact-dossier",
				path: "data/fact-dossiers/edition_{edition}.json",
			},
			{
				artifactId: "resolved-editorial-manifest",
				path: "data/editorial-selection/{edition}_resolved_*.json",
			},
			{
				artifactId: "thesaurus",
				path: "data/thesaurus/thesaurus-artifact.json",
			},
			{
				artifactId: "architecture-principles",
				path: "data/architecture-principles/apr-artifact.json",
			},
			{
				artifactId: "book-delta",
				path: "data/book-delta/{edition}/book-delta-artifact.json",
				required: true,
			},
		],
		optionalArtifacts: [],
		configurationRefs: ["book-delta-criteria", "target-documents"],
		environmentVars: ["OPENROUTER_API_KEY"],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "book-delta",
				path: "data/book-delta/{edition}/book-delta-artifact.json",
				description: "Updated BookDeltaArtifact",
				required: true,
			},
			{
				artifactId: "book-delta-evaluation",
				path: "data/book-delta/{edition}/book-delta-evaluation.json",
				description: "BookDeltaEvaluationResult",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL"],
		modifiesState: true,
		emitsEvents: ["BOOK_DELTA_EVALUATED"],
	},
	inputSchema:
		"CanonicalFactDossier + EditorialManifest + Thesaurus + Principles + BookDelta",
	outputSchema: "BookDeltaArtifact + EvaluationResult",
	sideEffects: ["WRITE_LOCAL", "INFERENCE_CALL"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: LONG_BUDGET,
	checkpointPolicy: DEFAULT_CHECKPOINT,
	inferenceRequirements: {
		required: true,
		providers: ["openrouter-primary"],
		estimatedRequests: 20,
		estimatedTokens: 100000,
		deterministic: true,
		structuredOutput: true,
		fallbackAllowed: true,
	},
	failureBehavior: "ALLOW_PARTIAL",
	recoverable: true,
	compensatingAction:
		"Valid outcome NONE acceptable; skipped ≠ NONE; do not auto-approve external changes",
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_persistence_readback",
		"validate_evidence_traceability",
		"validate_historical_deduplication",
		"validate_approval_boundary",
	],
	modulePath: "../book-delta/index.js",
	entryPoint: "evaluateBookDelta",
	version: "1.0.0",
	tags: [
		"knowledge",
		"book-delta",
		"educational",
		"proposals",
		"deduplication",
	],
};

const G04_VALIDATE_KNOWLEDGE_STATE: StageDefinitionInput = {
	stageId: stageId("g04_validate_knowledge_state"),
	name: "Validate Persistent Knowledge State & Historical Continuity",
	description:
		"Verify all three knowledge registers persisted correctly, read back successfully, and maintain historical continuity",
	phase: "PHASE_G_KNOWLEDGE_CONTINUITY",
	dependencies: [
		{ stageId: stageId("g01_thesaurus_evaluation"), required: true },
		{
			stageId: stageId("g02_architecture_principles_evaluation"),
			required: true,
		},
		{ stageId: stageId("g03_book_delta_evaluation"), required: true },
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "thesaurus",
				path: "data/thesaurus/thesaurus-artifact.json",
			},
			{
				artifactId: "architecture-principles",
				path: "data/architecture-principles/apr-artifact.json",
			},
			{
				artifactId: "book-delta",
				path: "data/book-delta/{edition}/book-delta-artifact.json",
			},
		],
		optionalArtifacts: [
			{
				artifactId: "thesaurus-evaluation",
				path: "data/thesaurus/evaluations/{edition}_*.json",
			},
			{
				artifactId: "principles-evaluation",
				path: "data/architecture-principles/evaluations/{edition}_*.json",
			},
			{
				artifactId: "book-delta-evaluation",
				path: "data/book-delta/{edition}/book-delta-evaluation.json",
			},
		],
		configurationRefs: [],
		environmentVars: [],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "knowledge-continuity-result",
				path: "memory://knowledge-continuity-result",
				description:
					"KnowledgeContinuityGateResult with PASS/FAIL/UNVERIFIED/NOT_ASSESSABLE",
				required: true,
			},
		],
		sideEffects: ["READ_ONLY"],
		modifiesState: false,
		emitsEvents: ["KNOWLEDGE_CONTINUITY_VALIDATED"],
	},
	inputSchema:
		"ThesaurusArtifact + ArchitecturePrinciplesRegister + BookDeltaArtifact",
	outputSchema: "KnowledgeContinuityResult",
	sideEffects: ["READ_ONLY"],
	retryPolicy: { ...DEFAULT_RETRY, maxAttempts: 1 },
	executionBudget: { ...DEFAULT_BUDGET, timeoutMs: 30000 },
	checkpointPolicy: { ...DEFAULT_CHECKPOINT, enabled: false },
	inferenceRequirements: { required: false },
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: false,
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_all_registers_readback",
		"validate_historical_continuity",
	],
	modulePath: "./phases/phase-g.js",
	entryPoint: "validateKnowledgeState",
	version: "1.0.0",
	tags: ["knowledge", "validation", "persistence", "continuity"],
};

/** ============================================================================
 * PHASE H — PUBLICATION PREPARATION
 * ============================================================================ */

const H01_ASSEMBLE_CANONICAL_DOCUMENTS: StageDefinitionInput = {
	stageId: stageId("h01_assemble_canonical_documents"),
	name: "Assemble Three Canonical Daily Publications",
	description:
		'Finalize publication.md, research-audit.md, and "AI Daily Intelligence — YYYY-MM-DD.md" with validated content, correct metadata, and stable references',
	phase: "PHASE_H_PUBLICATION_PREP",
	dependencies: [
		{ stageId: stageId("f05_bounded_repairs"), required: true },
		{ stageId: stageId("g04_validate_knowledge_state"), required: true },
		{
			stageId: stageId("e06_validate_publication_artifacts"),
			required: true,
		},
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "newsletter-md",
				path: "editions/edition_{edition}/canonical/publication.md",
			},
			{
				artifactId: "listening-nl-md",
				path: "editions/edition_{edition}/canonical/AI Daily Intelligence — {edition}.md",
			},
			{
				artifactId: "research-audit-md",
				path: "editions/edition_{edition}/canonical/research-audit.md",
			},
			{
				artifactId: "canonical-fact-dossier",
				path: "data/fact-dossiers/edition_{edition}.json",
			},
			{
				artifactId: "resolved-editorial-manifest",
				path: "data/editorial-selection/{edition}_resolved_*.json",
			},
			{
				artifactId: "omission-review-report",
				path: "data/omission-reviews/{edition}_*.json",
			},
			{
				artifactId: "historical-regression-report",
				path: "data/historical-regression/{edition}_*.json",
			},
			{
				artifactId: "q1q10-evaluation",
				path: "data/quality/q1q10/{edition}_*.json",
			},
			{
				artifactId: "audio-ag-evaluation",
				path: "data/quality/audio-ag/{edition}_*.json",
			},
			{
				artifactId: "readable-quality-evaluation",
				path: "data/quality/readable/{edition}_*.json",
			},
			{
				artifactId: "knowledge-continuity-result",
				path: "memory://knowledge-continuity-result",
			},
		],
		optionalArtifacts: [],
		configurationRefs: ["canonical-templates"],
		environmentVars: [],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "final-newsletter",
				path: "editions/edition_{edition}/canonical/publication.md",
				description:
					"Final publication.md with lifecycleStatus VALIDATED",
				required: true,
			},
			{
				artifactId: "final-listening-nl",
				path: "editions/edition_{edition}/canonical/AI Daily Intelligence — {edition}.md",
				description:
					"Final listening narrative with lifecycleStatus VALIDATED",
				required: true,
			},
			{
				artifactId: "final-research-audit",
				path: "editions/edition_{edition}/canonical/research-audit.md",
				description:
					"Final research audit with lifecycleStatus VALIDATED",
				required: true,
			},
			{
				artifactId: "canonical-metadata",
				path: "editions/edition_{edition}/canonical/*.meta.json",
				description:
					"Updated PublicationMetadata with VALIDATED status",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL", "PUBLISH_PREP"],
		modifiesState: true,
		emitsEvents: ["CANONICAL_DOCUMENTS_ASSEMBLED"],
	},
	inputSchema: "PublicationArtifacts + Evaluations + KnowledgeContinuity",
	outputSchema: "CanonicalPublications + Metadata",
	sideEffects: ["WRITE_LOCAL", "PUBLISH_PREP"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: PUBLICATION_BUDGET,
	checkpointPolicy: DEFAULT_CHECKPOINT,
	inferenceRequirements: { required: false },
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: true,
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_three_documents",
		"validate_metadata_validated_status",
		"validate_factual_provenance",
	],
	modulePath: "../publication/index.js",
	entryPoint: "assembleCanonicalDocuments",
	version: "1.0.0",
	tags: ["publication", "canonical", "assembly", "validated"],
};

const H02_ASSEMBLE_WEBSITE_DERIVATIVES: StageDefinitionInput = {
	stageId: stageId("h02_assemble_website_derivatives"),
	name: "Assemble & Verify Permitted Website Derivatives",
	description:
		"Finalize English articles, English listening narratives, daily index.md; verify cross-references and relative link integrity",
	phase: "PHASE_H_PUBLICATION_PREP",
	dependencies: [
		{
			stageId: stageId("h01_assemble_canonical_documents"),
			required: true,
		},
		{ stageId: stageId("e03_generate_en_articles"), required: true },
		{ stageId: stageId("e04_generate_en_listening"), required: true },
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "english-articles",
				path: "editions/edition_{edition}/derivatives/english-articles/",
			},
			{
				artifactId: "english-listening",
				path: "editions/edition_{edition}/derivatives/english-listening/",
			},
			{
				artifactId: "daily-index-md",
				path: "editions/edition_{edition}/index.md",
			},
			{
				artifactId: "final-newsletter",
				path: "editions/edition_{edition}/canonical/publication.md",
			},
			{
				artifactId: "final-listening-nl",
				path: "editions/edition_{edition}/canonical/AI Daily Intelligence — {edition}.md",
			},
			{
				artifactId: "final-research-audit",
				path: "editions/edition_{edition}/canonical/research-audit.md",
			},
		],
		optionalArtifacts: [
			{
				artifactId: "visual-assets",
				path: "editions/edition_{edition}/assets/visualizations/",
			},
		],
		configurationRefs: ["derivative-templates", "navigation-rules"],
		environmentVars: [],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "final-english-articles",
				path: "editions/edition_{edition}/derivatives/english-articles/",
				description: "Final English articles with VALIDATED status",
				required: true,
			},
			{
				artifactId: "final-english-listening",
				path: "editions/edition_{edition}/derivatives/english-listening/",
				description: "Final English listening with VALIDATED status",
				required: true,
			},
			{
				artifactId: "final-daily-index",
				path: "editions/edition_{edition}/index.md",
				description: "Final daily index with navigation",
				required: true,
			},
			{
				artifactId: "derivative-metadata",
				path: "editions/edition_{edition}/derivatives/*.meta.json",
				description: "Updated PublicationMetadata for derivatives",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL", "PUBLISH_PREP"],
		modifiesState: true,
		emitsEvents: ["WEBSITE_DERIVATIVES_ASSEMBLED"],
	},
	inputSchema: "EnglishDerivatives + CanonicalPublications",
	outputSchema: "FinalDerivatives + Index + Metadata",
	sideEffects: ["WRITE_LOCAL", "PUBLISH_PREP"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: PUBLICATION_BUDGET,
	checkpointPolicy: DEFAULT_CHECKPOINT,
	inferenceRequirements: { required: false },
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: true,
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_relative_links",
		"validate_navigation_structure",
		"validate_no_fourth_canonical",
	],
	modulePath: "../publication/index.js",
	entryPoint: "assembleWebsiteDerivatives",
	version: "1.0.0",
	tags: ["publication", "derivatives", "website", "navigation"],
};

const H03_AGGREGATE_EVIDENCE: StageDefinitionInput = {
	stageId: stageId("h03_aggregate_evidence"),
	name: "Aggregate Research, Editorial, Quality & Knowledge Evidence",
	description:
		"Compile complete evidence package linking source → retrieval → candidate → classification → verification → dossier → selection → publication → evaluation → acceptance inputs",
	phase: "PHASE_H_PUBLICATION_PREP",
	dependencies: [
		{
			stageId: stageId("h01_assemble_canonical_documents"),
			required: true,
		},
		{
			stageId: stageId("h02_assemble_website_derivatives"),
			required: true,
		},
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "execution-manifest",
				path: "data/execution-manifests/{edition}_*.json",
			},
			{
				artifactId: "canonical-fact-dossier",
				path: "data/fact-dossiers/edition_{edition}.json",
			},
			{
				artifactId: "resolved-editorial-manifest",
				path: "data/editorial-selection/{edition}_resolved_*.json",
			},
			{
				artifactId: "omission-review-report",
				path: "data/omission-reviews/{edition}_*.json",
			},
			{
				artifactId: "historical-regression-report",
				path: "data/historical-regression/{edition}_*.json",
			},
			{
				artifactId: "q1q10-evaluation",
				path: "data/quality/q1q10/{edition}_*.json",
			},
			{
				artifactId: "audio-ag-evaluation",
				path: "data/quality/audio-ag/{edition}_*.json",
			},
			{
				artifactId: "readable-quality-evaluation",
				path: "data/quality/readable/{edition}_*.json",
			},
			{
				artifactId: "knowledge-continuity-result",
				path: "memory://knowledge-continuity-result",
			},
			{
				artifactId: "thesaurus-evaluation",
				path: "data/thesaurus/evaluations/{edition}_*.json",
			},
			{
				artifactId: "principles-evaluation",
				path: "data/architecture-principles/evaluations/{edition}_*.json",
			},
			{
				artifactId: "book-delta-evaluation",
				path: "data/book-delta/{edition}/book-delta-evaluation.json",
			},
		],
		optionalArtifacts: [
			{
				artifactId: "visualization-accessibility-report",
				path: "data/quality/visualization/{edition}_*.json",
			},
			{
				artifactId: "repair-record",
				path: "data/quality/repairs/{edition}_*.json",
			},
		],
		configurationRefs: [],
		environmentVars: [],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "evidence-package",
				path: "data/evidence-packages/{edition}_*.json",
				description: "Complete traceability evidence package",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL"],
		modifiesState: true,
		emitsEvents: ["EVIDENCE_AGGREGATED"],
	},
	inputSchema: "AllEvaluationReports + ExecutionManifest",
	outputSchema: "EvidencePackage",
	sideEffects: ["WRITE_LOCAL"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: { ...DEFAULT_BUDGET, timeoutMs: 60000 },
	checkpointPolicy: { ...DEFAULT_CHECKPOINT, enabled: false },
	inferenceRequirements: { required: false },
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: true,
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_traceability_chain_complete",
		"validate_source_to_publication_links",
	],
	modulePath: "./phases/phase-h.js",
	entryPoint: "aggregateEvidence",
	version: "1.0.0",
	tags: ["evidence", "traceability", "aggregation", "acceptance-inputs"],
};

const H04_PRODUCE_COMPLETION_REPORT: StageDefinitionInput = {
	stageId: stageId("h04_produce_completion_report"),
	name: "Produce Workflow Completion Report & Acceptance-Gate Inputs",
	description:
		"Generate structured execution report covering all phases, resource usage, unresolved defects, checkpoint info, and explicit next-stage readiness for step 100 acceptance framework",
	phase: "PHASE_H_PUBLICATION_PREP",
	dependencies: [
		{ stageId: stageId("h03_aggregate_evidence"), required: true },
		{ stageId: stageId("a04_init_execution_manifest"), required: true },
	],
	inputContract: {
		requiredArtifacts: [
			{
				artifactId: "execution-manifest",
				path: "data/execution-manifests/{edition}_*.json",
			},
			{
				artifactId: "evidence-package",
				path: "data/evidence-packages/{edition}_*.json",
			},
			{
				artifactId: "final-newsletter",
				path: "editions/edition_{edition}/canonical/publication.md",
			},
			{
				artifactId: "final-listening-nl",
				path: "editions/edition_{edition}/canonical/AI Daily Intelligence — {edition}.md",
			},
			{
				artifactId: "final-research-audit",
				path: "editions/edition_{edition}/canonical/research-audit.md",
			},
			{
				artifactId: "final-daily-index",
				path: "editions/edition_{edition}/index.md",
			},
		],
		optionalArtifacts: [],
		configurationRefs: ["report-template"],
		environmentVars: [],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "workflow-report",
				path: "data/workflow-reports/{edition}_*.json",
				description:
					"WorkflowReport with complete phase-by-phase results",
				required: true,
			},
			{
				artifactId: "acceptance-gate-inputs",
				path: "data/acceptance-gate/{edition}_*.json",
				description:
					"Structured inputs for step 100 acceptance framework",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL"],
		modifiesState: true,
		emitsEvents: ["WORKFLOW_COMPLETE", "ACCEPTANCE_READY"],
	},
	inputSchema: "ExecutionManifest + EvidencePackage + FinalArtifacts",
	outputSchema: "WorkflowReport + AcceptanceGateInputs",
	sideEffects: ["WRITE_LOCAL"],
	retryPolicy: DEFAULT_RETRY,
	executionBudget: { ...DEFAULT_BUDGET, timeoutMs: 60000 },
	checkpointPolicy: { ...DEFAULT_CHECKPOINT, enabled: false },
	inferenceRequirements: { required: false },
	failureBehavior: "BLOCK_DOWNSTREAM",
	recoverable: true,
	validationResponsibility: "SELF",
	postValidationHooks: [
		"validate_report_completeness",
		"validate_acceptance_inputs_structure",
		"distinguish_executed_vs_validated_vs_unverified",
	],
	modulePath: "./phases/phase-h.js",
	entryPoint: "produceCompletionReport",
	version: "1.0.0",
	tags: ["reporting", "acceptance-gate", "observability", "completion"],
};

const H05_RELEASE_LOCK: StageDefinitionInput = {
	stageId: stageId("h05_release_lock"),
	name: "Release Edition Execution Lock",
	description:
		"Release the filesystem lock for this edition, recording final state",
	phase: "PHASE_H_PUBLICATION_PREP",
	dependencies: [
		{ stageId: stageId("h04_produce_completion_report"), required: true },
		{ stageId: stageId("a05_acquire_lock"), required: true },
	],
	inputContract: {
		requiredArtifacts: [
			{ artifactId: "workflow-lock", path: "data/locks/{edition}.lock" },
		],
		optionalArtifacts: [],
		configurationRefs: [],
		environmentVars: [],
	},
	outputContract: {
		producedArtifacts: [
			{
				artifactId: "released-lock",
				path: "data/locks/{edition}.lock",
				description: "WorkflowLock with state FREE",
				required: true,
			},
		],
		sideEffects: ["WRITE_LOCAL"],
		modifiesState: true,
		emitsEvents: ["LOCK_RELEASED"],
	},
	inputSchema: "WorkflowLock",
	outputSchema: "WorkflowLock",
	sideEffects: ["WRITE_LOCAL"],
	retryPolicy: { ...DEFAULT_RETRY, maxAttempts: 3 },
	executionBudget: { ...DEFAULT_BUDGET, timeoutMs: 10000 },
	checkpointPolicy: { ...DEFAULT_CHECKPOINT, enabled: false },
	inferenceRequirements: { required: false },
	failureBehavior: "ALLOW_PARTIAL",
	recoverable: true,
	compensatingAction: "Log warning; manual lock release may be needed",
	validationResponsibility: "SELF",
	postValidationHooks: [],
	modulePath: "./phases/phase-h.js",
	entryPoint: "releaseLock",
	version: "1.0.0",
	tags: ["concurrency", "lock", "cleanup"],
};

/** ============================================================================
 * COMPLETE WORKFLOW GRAPH
 * ============================================================================ */

export const ALL_STAGE_DEFINITIONS: StageDefinitionInput[] = [
	// Phase A
	A01_RESOLVE_EDITION,
	A02_LOAD_REGISTRIES,
	A03_VALIDATE_KNOWLEDGE_REGISTERS,
	A04_INIT_EXECUTION_MANIFEST,
	A05_ACQUIRE_LOCK,

	// Phase B
	B01_RING1_DISCOVERY,
	B02_RING2_DISCOVERY,
	B03_RING3_DISCOVERY,
	B04_MANDATORY_CODING_AGENT_MONITORING,
	B05_PERSIST_DISCOVERY_EVIDENCE,
	B06_VALIDATE_DISCOVERY_COVERAGE,

	// Phase C
	C01_TEMPORAL_ELIGIBILITY,
	C02_CLAIM_VERIFICATION,
	C03_BUILD_FACT_DOSSIER,
	C04_OMISSION_REVIEW,
	C05_HISTORICAL_REGRESSION,

	// Phase D
	D01_EDITORIAL_SELECTION,
	D02_VALIDATE_SELECTION_COMPLETENESS,
	D03_RESOLVE_EDITORIAL_DEPENDENCIES,

	// Phase E
	E01_GENERATE_NL_NEWSLETTER,
	E02_GENERATE_NL_LISTENING,
	E02b_GENERATE_RESEARCH_AUDIT,
	E03_GENERATE_EN_ARTICLES,
	E04_GENERATE_EN_LISTENING,
	E05_GENERATE_VISUALS,
	E06_VALIDATE_PUBLICATION_ARTIFACTS,

	// Phase F
	F01_Q1Q10_EVALUATION,
	F02_AUDIO_AG_EVALUATION,
	F03_READABLE_QUALITY_EVALUATION,
	F04_VISUALIZATION_ACCESSIBILITY,
	F05_BOUNDED_REPAIRS,

	// Phase G
	G01_THESAURUS_EVALUATION,
	G02_ARCHITECTURE_PRINCIPLES_EVALUATION,
	G03_BOOK_DELTA_EVALUATION,
	G04_VALIDATE_KNOWLEDGE_STATE,

	// Phase H
	H01_ASSEMBLE_CANONICAL_DOCUMENTS,
	H02_ASSEMBLE_WEBSITE_DERIVATIVES,
	H03_AGGREGATE_EVIDENCE,
	H04_PRODUCE_COMPLETION_REPORT,
	H05_RELEASE_LOCK,
];

/**
 * Parsed workflow stages. Parsing applies the schema defaults so consumers
 * receive complete StageDefinition records while the definitions above remain
 * concise schema input.
 */
export const ALL_STAGES: StageDefinition[] =
	StageDefinitionSchema.array().parse(ALL_STAGE_DEFINITIONS);

/** Build edges from stage dependencies */
export function buildWorkflowEdges(): Array<{
	from: string;
	to: string;
	type: "HARD" | "SOFT" | "ARTIFACT";
}> {
	const edges: Array<{
		from: string;
		to: string;
		type: "HARD" | "SOFT" | "ARTIFACT";
	}> = [];

	for (const stage of ALL_STAGES) {
		for (const dep of stage.dependencies) {
			edges.push({
				from: dep.stageId,
				to: stage.stageId,
				type: dep.required ? "HARD" : "SOFT",
			});
		}
	}

	return edges;
}

/** Get stages by phase */
export function getStagesByPhase(phase: WorkflowPhase): StageDefinition[] {
	return ALL_STAGES.filter((s) => s.phase === phase);
}

/** Get stage by ID */
export function getStageById(stageId: string): StageDefinition | undefined {
	return ALL_STAGES.find((s) => s.stageId === stageId);
}

/** Get topological order (phases in sequence, stages within phase by dependencies) */
export function getTopologicalOrder(): string[] {
	// Simple phase-ordered topological sort
	const phases: WorkflowPhase[] = [
		"PHASE_A_EDITION_INIT",
		"PHASE_B_RESEARCH_DISCOVERY",
		"PHASE_C_EVIDENCE_PREP",
		"PHASE_D_EDITORIAL_DECISION",
		"PHASE_E_PUBLICATION_PRODUCTION",
		"PHASE_F_QUALITY_ASSURANCE",
		"PHASE_G_KNOWLEDGE_CONTINUITY",
		"PHASE_H_PUBLICATION_PREP",
	];

	const ordered: string[] = [];

	for (const phase of phases) {
		const phaseStages = getStagesByPhase(phase);
		// Sort by dependency depth within phase
		const sorted = topologicalSortPhase(phaseStages);
		ordered.push(...sorted.map((s) => s.stageId));
	}

	return ordered;
}

function topologicalSortPhase(stages: StageDefinition[]): StageDefinition[] {
	const visited = new Set<string>();
	const result: StageDefinition[] = [];
	const stageMap = new Map(stages.map((s) => [s.stageId, s]));

	function visit(stage: StageDefinition) {
		if (visited.has(stage.stageId)) return;
		for (const dep of stage.dependencies) {
			if (dep.required) {
				const depStage = stageMap.get(dep.stageId);
				if (depStage) visit(depStage);
			}
		}
		visited.add(stage.stageId);
		result.push(stage);
	}

	for (const stage of stages) {
		visit(stage);
	}

	return result;
}

/** Validate workflow graph integrity */
export function validateWorkflowGraph(): {
	valid: boolean;
	errors: string[];
	warnings: string[];
} {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check for duplicate stage IDs
	const ids = new Set<string>();
	for (const stage of ALL_STAGES) {
		if (ids.has(stage.stageId)) {
			errors.push(`Duplicate stage ID: ${stage.stageId}`);
		}
		ids.add(stage.stageId);
	}

	// Check all dependencies reference existing stages
	for (const stage of ALL_STAGES) {
		for (const dep of stage.dependencies) {
			if (!ids.has(dep.stageId)) {
				errors.push(
					`Stage ${stage.stageId} depends on unknown stage: ${dep.stageId}`,
				);
			}
		}
	}

	// Check for cycles (simple DFS)
	const stageMap = new Map(ALL_STAGES.map((s) => [s.stageId, s]));
	const visited = new Set<string>();
	const recStack = new Set<string>();

	function checkCycles(stageId: string, path: string[]): boolean {
		if (recStack.has(stageId)) {
			errors.push(`Cycle detected: ${[...path, stageId].join(" → ")}`);
			return true;
		}
		if (visited.has(stageId)) return false;

		visited.add(stageId);
		recStack.add(stageId);

		const stage = stageMap.get(stageId);
		if (stage) {
			for (const dep of stage.dependencies) {
				if (dep.required) {
					checkCycles(dep.stageId, [...path, stageId]);
				}
			}
		}

		recStack.delete(stageId);
		return false;
	}

	for (const stage of ALL_STAGES) {
		if (!visited.has(stage.stageId)) {
			checkCycles(stage.stageId, []);
		}
	}

	// Warn about stages with no dependencies and no dependents (isolated)
	const hasDependent = new Set<string>();
	for (const stage of ALL_STAGES) {
		for (const dep of stage.dependencies) {
			hasDependent.add(dep.stageId);
		}
	}
	for (const stage of ALL_STAGES) {
		if (
			stage.dependencies.length === 0 &&
			!hasDependent.has(stage.stageId)
		) {
			warnings.push(
				`Stage ${stage.stageId} (${stage.name}) is isolated - no dependencies and no dependents`,
			);
		}
	}

	// Verify phase ordering (no backward phase dependencies)
	const phaseOrder: Record<WorkflowPhase, number> = {
		PHASE_A_EDITION_INIT: 1,
		PHASE_B_RESEARCH_DISCOVERY: 2,
		PHASE_C_EVIDENCE_PREP: 3,
		PHASE_D_EDITORIAL_DECISION: 4,
		PHASE_E_PUBLICATION_PRODUCTION: 5,
		PHASE_F_QUALITY_ASSURANCE: 6,
		PHASE_G_KNOWLEDGE_CONTINUITY: 7,
		PHASE_H_PUBLICATION_PREP: 8,
	};

	for (const stage of ALL_STAGES) {
		const stagePhaseOrder = phaseOrder[stage.phase];
		for (const dep of stage.dependencies) {
			const depStage = stageMap.get(dep.stageId);
			if (depStage && dep.required) {
				const depPhaseOrder = phaseOrder[depStage.phase];
				if (depPhaseOrder > stagePhaseOrder) {
					warnings.push(
						`Stage ${stage.stageId} (${stage.phase}) depends on ${dep.stageId} (${depStage.phase}) in later phase - verify this is intentional`,
					);
				}
			}
		}
	}

	return { valid: errors.length === 0, errors, warnings };
}

// Export the complete graph
export const WORKFLOW_GRAPH = {
	graphId: "ai-intelligence-daily-edition-v1",
	version: "1.0.0",
	stages: ALL_STAGES,
	edges: buildWorkflowEdges(),
	validatedAt: new Date().toISOString(),
	validatedBy: "workflow-orchestrator/schema.ts",
	topologicalOrder: getTopologicalOrder(),
	cycles: [],
	unreachableStages: [],
};
