/**
 * Independent English Listening Narrative Generator
 *
 * Generates the English listening-text derivative (english-listening) from
 * validated upstream inputs without paraphrasing or summarizing the Dutch
 * listening narrative or the English readable article.
 *
 * Implements the audio-first composition requirements per the publication contract:
 * - Independent authorship from canonical fact dossier and editorial selection manifest
 * - ADHD-aware cognitive accessibility (one concept at a time, context before complexity)
 * - Technical depth through progressive conceptual explanation
 * - Natural spoken transitions and listener reorientation
 * - Text-to-speech compatible Markdown (no spoken URLs, citation strings, visual references)
 * - Free LLM inference with budget, caching, checkpoints, and graceful degradation
 */

import { createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type {
	CanonicalFactDossier,
	CanonicalCandidate,
	ConsolidatedClaim,
	EvidenceClassification,
	VerificationLevel,
	TemporalEligibilityStatus,
} from "../fact-dossier/schema.js";
import type {
	EditorialSelectionManifest,
	EditorialStory,
	EditorialCandidateAssessment,
	EditorialDecision,
	EditorialDepth,
} from "../editorial-selection/schema.js";
import type {
	HistoricalRegressionReport,
	HistoricalRelationship,
	HistoricalRelationshipClassification,
} from "../historical-regression/schema.js";
import type { ArticleIdentity } from "./schema.js";
import {
	createFreeLLMClient,
	type LLMClientConfig,
	type LLMResponse,
} from "../free-llm-client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..", "..", "..");
const DATA_DIR = join(PROJECT_ROOT, "data");

/**
 * Story composition context loaded from upstream artifacts
 */
export interface EnglishListeningStoryContext {
	story: EditorialStory;
	candidate: CanonicalCandidate;
	assessment: EditorialCandidateAssessment;
	historicalRelationship: HistoricalRelationship | null;
	historicalClassification: HistoricalRelationshipClassification | null;
}

/**
 * Loaded upstream data for English listening narrative generation
 */
export interface EnglishListeningNarrativeGenerationInput {
	editionDate: string;
	editionWindow: { start: string; end: string; timezone: string };
	factDossier: CanonicalFactDossier;
	editorialManifest: EditorialSelectionManifest;
	historicalRegression: HistoricalRegressionReport | null;
	stories: EnglishListeningStoryContext[];
}

/**
 * LLM-assisted narrative segment
 */
interface NarrativeSegment {
	type: "opening" | "story" | "transition" | "reorientation" | "conclusion";
	content: string;
	claimIds: string[];
	sourceIds: string[];
}

/**
 * Generation checkpoint state
 */
interface GenerationCheckpoint {
	id: string;
	editionDate: string;
	step: number;
	totalSteps: number;
	completedSegments: NarrativeSegment[];
	processedStoryIds: string[];
	llmStats: {
		requests: number;
		tokens: number;
		providersUsed: string[];
		cacheHits: number;
	};
	errors: string[];
	timestamp: number;
}

/**
 * Generation result
 */
export interface EnglishListeningNarrativeGenerationResult {
	markdown: string;
	metadata: {
		contentHash: string;
		artifactId: string;
		estimatedListeningDurationMinutes: number;
		wordCount: number;
		segmentCount: number;
		storiesCovered: number;
	};
	traceability: {
		segments: Array<{
			type: NarrativeSegment["type"];
			claimIds: string[];
			sourceIds: string[];
			storyId?: string;
		}>;
		claimCoverage: string[];
		sourceCoverage: string[];
		storyCoverage: string[];
	};
	checkpoint: GenerationCheckpoint | null;
	validation: {
		valid: boolean;
		errors: string[];
		warnings: string[];
	};
}

/**
 * Default LLM client configuration for narrative generation
 */
function getDefaultLLMConfig(): LLMClientConfig {
	return createFreeLLMClient({
		budget: { maxRequests: 50, maxTokens: 100000, maxCostUsd: 0 },
		deterministic: true,
		enableCache: true,
		enableCheckpoints: true,
	}).getConfig();
}

/**
 * Load and prepare English listening narrative generation input from upstream artifacts
 */
export async function loadEnglishListeningNarrativeGenerationInput(
	editionDate: string,
	dataDir: string = DATA_DIR,
): Promise<EnglishListeningNarrativeGenerationInput> {
	const { readdir, readFile } = await import("fs/promises");
	const { join } = await import("path");

	// Load fact dossier
	const dossierPath = join(
		dataDir,
		"fact-dossiers",
		`edition_${editionDate}.json`,
	);
	const factDossier: CanonicalFactDossier = JSON.parse(
		await readFile(dossierPath, "utf-8"),
	);

	// Load editorial selection manifest (latest)
	const editorialDir = join(dataDir, "editorial-selection");
	const editorialFilesList = await readdir(editorialDir);
	const manifestFiles = editorialFilesList
		.filter((f) => f.startsWith(`${editionDate}_`) && f.endsWith(".json"))
		.sort();
	if (manifestFiles.length === 0) {
		throw new Error(
			`No editorial selection manifest found for ${editionDate}`,
		);
	}
	const latestManifest = manifestFiles[manifestFiles.length - 1];
	const editorialManifest: EditorialSelectionManifest = JSON.parse(
		await readFile(join(editorialDir, latestManifest), "utf-8"),
	);

	// Load historical regression report (latest)
	const historicalDir = join(dataDir, "historical-regression");
	let historicalRegression: HistoricalRegressionReport | null = null;
	try {
		const historicalFilesList = await readdir(historicalDir);
		const regressionFiles = historicalFilesList
			.filter(
				(f) => f.startsWith(`${editionDate}_`) && f.endsWith(".json"),
			)
			.sort();
		if (regressionFiles.length > 0) {
			const latestRegression =
				regressionFiles[regressionFiles.length - 1];
			historicalRegression = JSON.parse(
				await readFile(join(historicalDir, latestRegression), "utf-8"),
			);
		}
	} catch {
		// Historical regression may not exist
	}

	// Build story contexts
	const stories = buildStoryContexts(
		factDossier,
		editorialManifest,
		historicalRegression,
	);

	// Edition window
	const editionWindow = {
		start: factDossier.editionWindow.start,
		end: factDossier.editionWindow.end,
		timezone: factDossier.editionWindow.timezone,
	};

	return {
		editionDate,
		editionWindow,
		factDossier,
		editorialManifest,
		historicalRegression,
		stories,
	};
}

/**
 * Build story contexts by joining editorial stories with fact dossier candidates
 */
function buildStoryContexts(
	dossier: CanonicalFactDossier,
	manifest: EditorialSelectionManifest,
	historicalRegression: HistoricalRegressionReport | null,
): EnglishListeningStoryContext[] {
	const candidateMap = new Map(
		dossier.candidates.map((c) => [c.candidateId, c]),
	);
	const assessmentMap = new Map(
		manifest.candidates.map((a) => [a.candidateId, a]),
	);
	const historicalMap = historicalRegression
		? new Map(
				historicalRegression.relationships.map((r) => [
					r.candidateId,
					r,
				]),
			)
		: new Map();

	return manifest.stories.map((story) => {
		const candidate = candidateMap.get(story.candidateId);
		const assessment = assessmentMap.get(story.candidateId);
		const historicalRelationship =
			historicalMap.get(story.candidateId) ?? null;

		if (!candidate || !assessment) {
			throw new Error(
				`Missing candidate or assessment for story ${story.storyId}`,
			);
		}

		return {
			story,
			candidate,
			assessment,
			historicalRelationship,
			historicalClassification:
				historicalRelationship?.classification ?? null,
		};
	});
}

/**
 * Main entry point: Generate the complete English listening narrative markdown
 */
export async function generateEnglishListeningNarrativeMarkdown(
	input: EnglishListeningNarrativeGenerationInput,
	options: {
		validateOnly?: boolean;
		resumeFromCheckpoint?: string;
	} = {},
): Promise<EnglishListeningNarrativeGenerationResult> {
	const {
		editionDate,
		editionWindow,
		stories,
		factDossier,
		editorialManifest,
		historicalRegression,
	} = input;

	// Handle validation-only mode: return mock result without calling LLM
	if (options.validateOnly) {
		const mockMarkdown = generateMockEnglishListeningNarrative(
			editionDate,
			editionWindow,
			stories,
		);
		const contentHash = computeContentHashListening(mockMarkdown);
		const artifactId = `pubart_${randomBytes(8).toString("hex")}`;
		const wordCount = countWordsListening(mockMarkdown);
		const estimatedListeningDurationMinutes = Math.ceil(wordCount / 150);

		return {
			markdown: mockMarkdown,
			metadata: {
				contentHash,
				artifactId,
				estimatedListeningDurationMinutes,
				wordCount,
				segmentCount: 1 + stories.length * 2,
				storiesCovered: stories.length,
			},
			traceability: {
				segments: [
					{ type: "opening" as const, claimIds: [], sourceIds: [] },
					...stories
						.flatMap((s, i) => [
							{
								type: "story" as const,
								claimIds: s.candidate.claims.map(
									(c) => c.claimId,
								),
								sourceIds: s.candidate.sources.map(
									(src) => src.sourceId,
								),
								storyId: s.story.storyId,
							},
							{
								type: "transition" as const,
								claimIds: [],
								sourceIds: [],
							},
						])
						.slice(0, -1),
					{
						type: "conclusion" as const,
						claimIds: [],
						sourceIds: [],
					},
				],
				claimCoverage: stories.flatMap((s) =>
					s.candidate.claims.map((c) => c.claimId),
				),
				sourceCoverage: stories.flatMap((s) =>
					s.candidate.sources.map((src) => src.sourceId),
				),
				storyCoverage: stories.map((s) => s.story.storyId),
			},
			checkpoint: null,
			validation: { valid: true, errors: [], warnings: [] },
		};
	}

	// Initialize LLM client
	const llmClient = createFreeLLMClient(getDefaultLLMConfig());

	// Validate configuration
	const validation = await llmClient.validate();
	if (!validation.valid) {
		throw new Error(
			`LLM client validation failed: ${validation.errors.join(", ")}`,
		);
	}
	const checkpointDir = join(
		DATA_DIR,
		"checkpoints",
		"english-listening-narrative",
		editionDate,
	);
	await fs.mkdir(checkpointDir, { recursive: true });

	let checkpoint: GenerationCheckpoint | null = null;
	if (options.resumeFromCheckpoint) {
		checkpoint = await loadCheckpoint(options.resumeFromCheckpoint);
	}

	// Initialize generation state
	const completedSegments: NarrativeSegment[] =
		checkpoint?.completedSegments ?? [];
	const processedStoryIds = new Set(checkpoint?.processedStoryIds ?? []);
	const llmStats = checkpoint?.llmStats ?? {
		requests: 0,
		tokens: 0,
		providersUsed: [],
		cacheHits: 0,
	};
	const errors: string[] = checkpoint?.errors ?? [];
	const startStep = checkpoint?.step ?? 0;
	const totalSteps = 3 + stories.length * 2; // opening + (story + transition) * stories + conclusion

	// Check if we're in validation-only mode
	if (options.validateOnly) {
		llmClient.setValidationMode(true);
	}

	try {
		// Step 1: Generate opening (if not already done)
		if (startStep === 0) {
			const opening = await generateOpening(input, llmClient, llmStats);
			completedSegments.push(opening);
			await saveCheckpoint(
				checkpointDir,
				editionDate,
				1,
				totalSteps,
				completedSegments,
				processedStoryIds,
				llmStats,
				errors,
			);
		}

		// Step 2: Generate each story with transitions
		for (let i = 0; i < stories.length; i++) {
			const story = stories[i];
			const stepOffset = 1 + i * 2;

			if (
				startStep <= stepOffset &&
				!processedStoryIds.has(story.story.storyId)
			) {
				// Generate story narrative
				const storySegment = await generateStoryNarrative(
					i + 1,
					story,
					input,
					llmClient,
					llmStats,
				);
				completedSegments.push(storySegment);
				processedStoryIds.add(story.story.storyId);
				await saveCheckpoint(
					checkpointDir,
					editionDate,
					stepOffset + 1,
					totalSteps,
					completedSegments,
					processedStoryIds,
					llmStats,
					errors,
				);
			}

			if (
				i < stories.length - 1 &&
				startStep <= stepOffset + 1 &&
				!processedStoryIds.has(`transition-${i}`)
			) {
				// Generate transition to next story
				const nextStory = stories[i + 1];
				const transition = await generateTransition(
					story,
					nextStory,
					input,
					llmClient,
					llmStats,
				);
				completedSegments.push(transition);
				processedStoryIds.add(`transition-${i}`);
				await saveCheckpoint(
					checkpointDir,
					editionDate,
					stepOffset + 2,
					totalSteps,
					completedSegments,
					processedStoryIds,
					llmStats,
					errors,
				);
			}
		}

		// Step 3: Generate conclusion
		const conclusionStep = 1 + stories.length * 2;
		if (
			startStep <= conclusionStep &&
			!processedStoryIds.has("conclusion")
		) {
			const conclusion = await generateConclusion(
				input,
				llmClient,
				llmStats,
			);
			completedSegments.push(conclusion);
			processedStoryIds.add("conclusion");
			await saveCheckpoint(
				checkpointDir,
				editionDate,
				totalSteps,
				totalSteps,
				completedSegments,
				processedStoryIds,
				llmStats,
				errors,
			);
		}

		// Assemble final markdown
		const markdown = assembleMarkdown(
			editionDate,
			editionWindow,
			completedSegments,
		);

		// Validate output
		const outputValidation = validateEnglishListeningNarrativeOutput(
			markdown,
			input,
		);

		// Build traceability
		const traceability = buildTraceability(completedSegments, stories);

		// Compute metadata
		const wordCount = countWords(markdown);
		const estimatedListeningDurationMinutes = Math.ceil(wordCount / 150); // ~150 words per minute spoken
		const contentHash = computeContentHash(markdown);
		const artifactId = `pubart_${randomBytes(8).toString("hex")}`;

		return {
			markdown,
			metadata: {
				contentHash,
				artifactId,
				estimatedListeningDurationMinutes,
				wordCount,
				segmentCount: completedSegments.length,
				storiesCovered: stories.length,
			},
			traceability,
			checkpoint: null, // Generation complete, checkpoint no longer needed
			validation: outputValidation,
		};
	} catch (error) {
		// Save error checkpoint for resumability
		errors.push(
			`${error instanceof Error ? error.message : String(error)}`,
		);
		await saveCheckpoint(
			checkpointDir,
			editionDate,
			startStep,
			totalSteps,
			completedSegments,
			processedStoryIds,
			llmStats,
			errors,
		);
		throw error;
	}
}

/**
 * Generate the opening segment — concrete, consequential lead story
 */
async function generateOpening(
	input: EnglishListeningNarrativeGenerationInput,
	llmClient: ReturnType<typeof createFreeLLMClient>,
	stats: {
		requests: number;
		tokens: number;
		providersUsed: string[];
		cacheHits: number;
	},
): Promise<NarrativeSegment> {
	const { editionDate, editionWindow, stories } = input;

	if (stories.length === 0) {
		return {
			type: "opening",
			content: `Good morning. This is AI Daily Intelligence for ${formatDateEN(editionDate)}. In the past 24 hours, no developments were selected that meet the materiality threshold for this briefing.`,
			claimIds: [],
			sourceIds: [],
		};
	}

	const leadStory = stories[0];
	const leadCandidate = leadStory.candidate;
	const leadAssessment = leadStory.assessment;

	// Build prompt for LLM to generate a natural, audio-first opening
	const prompt = buildOpeningPrompt(
		leadCandidate,
		leadAssessment,
		leadStory.story,
		editionWindow,
		stories.length,
	);

	const response = await callLLMWithRetry(
		llmClient,
		prompt,
		stats,
		"opening",
	);

	return {
		type: "opening",
		content: response.content,
		claimIds: leadCandidate.claims.map((c) => c.claimId),
		sourceIds: leadCandidate.sources.map((s) => s.sourceId),
	};
}

/**
 * Build the prompt for the opening segment
 */
function buildOpeningPrompt(
	leadCandidate: CanonicalCandidate,
	leadAssessment: EditorialCandidateAssessment,
	leadStory: EditorialStory,
	editionWindow: { start: string; end: string; timezone: string },
	storyCount: number,
): string {
	const org = leadCandidate.organizations.join(", ");
	const domain = translateDomainENListening(
		leadCandidate.researchDomains[0] ?? "unknown domain",
	);
	const headline = leadCandidate.factualHeadline;
	const windowStr = formatWindowListening(editionWindow);

	return `You are the voice of AI Daily Intelligence, an English daily listening briefing for system architects and technical decision-makers. Write the opening of today's edition.

CONTEXT:
- Edition date: ${leadCandidate.editionDate}
- Reporting window: ${windowStr}
- Number of stories in this edition: ${storyCount}

LEADING DEVELOPMENT (Story 1):
- Organization(s): ${org}
- Domain: ${domain}
- Factual headline: ${headline}
- Exact statement of what changed: ${leadCandidate.exactStatement}
- Materiality: ${leadAssessment.materialityLevel} (score: ${leadAssessment.materialityScore.toFixed(2)})
- Evidence sufficiency: ${leadAssessment.eligibility.evidenceSufficiency}
- Temporal status: ${leadAssessment.eligibility.temporalStatus}

REQUIREMENTS FOR THE OPENING:
1. START WITH THE CONCRETE NEWS, not with a generic greeting or podcast intro.
2. Immediately establish: WHAT happened, WHY it matters now, and WHAT the listener needs to understand before technical details follow.
3. No generic themes, no artificial tension, no editorial self-commentary.
4. No description of the research or publication process.
5. No automatic preference for GitHub/Copilot/VS Code — the leading development is determined by editorial significance.
6. Write for an adult listener who may be driving, walking, or working — no screen access, no ability to re-read.
7. ADHD-friendly: one central concept, clear causal relationships, manageable information density.
8. Natural spoken sentence structure, suitable for browser-native SpeechSynthesis.
9. No URLs, citation identifiers, or audit terminology in the spoken text.
10. Maximum 3-4 sentences for the opening.

Write the opening NOW in English:`;
}

/**
 * Generate a story narrative segment — independent audio-first composition
 */
async function generateStoryNarrative(
	index: number,
	context: EnglishListeningStoryContext,
	input: EnglishListeningNarrativeGenerationInput,
	llmClient: ReturnType<typeof createFreeLLMClient>,
	stats: {
		requests: number;
		tokens: number;
		providersUsed: string[];
		cacheHits: number;
	},
): Promise<NarrativeSegment> {
	const {
		story,
		candidate,
		assessment,
		historicalRelationship,
		historicalClassification,
	} = context;

	const prompt = buildStoryPrompt(
		index,
		story,
		candidate,
		assessment,
		historicalRelationship,
		historicalClassification,
		input,
	);

	const response = await callLLMWithRetry(
		llmClient,
		prompt,
		stats,
		`story-${index}`,
	);

	return {
		type: "story",
		content: response.content,
		claimIds: candidate.claims.map((c) => c.claimId),
		sourceIds: candidate.sources.map((s) => s.sourceId),
	};
}

/**
 * Build the prompt for a story narrative segment
 */
function buildStoryPrompt(
	index: number,
	story: EditorialStory,
	candidate: CanonicalCandidate,
	assessment: EditorialCandidateAssessment,
	historicalRelationship: HistoricalRelationship | null,
	historicalClassification: HistoricalRelationshipClassification | null,
	input: EnglishListeningNarrativeGenerationInput,
): string {
	const org = candidate.organizations.join(", ");
	const domain = translateDomainENListening(
		candidate.researchDomains[0] ?? "unknown domain",
	);
	const headline = candidate.factualHeadline;
	const exactStatement = candidate.exactStatement;
	const materiality = assessment.materialityLevel;
	const evidenceSufficiency = assessment.eligibility.evidenceSufficiency;
	const temporalStatus = assessment.eligibility.temporalStatus;
	const depth = story.recommendedDepth;
	const caveats = story.caveats.slice(0, 3).join("; ");

	// Extract technical, methodological, strategic context from claims
	const technicalClaims = candidate.claims.filter((c) => c.technicalContext);
	const methodologicalClaims = candidate.claims.filter(
		(c) => c.methodologicalContext,
	);
	const strategicClaims = candidate.claims.filter((c) => c.strategicContext);

	let technicalContext = "";
	if (technicalClaims.length > 0) {
		const tc = technicalClaims[0].technicalContext!;
		technicalContext = `Technical mechanism: ${tc.mechanism ?? "not specified"}. Capabilities: ${tc.capabilities?.join(", ") ?? "none"}. Architecture: ${tc.architecture?.join(", ") ?? "none"}. Limitations: ${tc.limitations?.join(", ") ?? "none"}. Release maturity: ${tc.releaseMaturity ?? "unknown"}. Implementation status: ${tc.implementationStatus ?? "unknown"}.`;
	}

	let methodologicalContext = "";
	if (methodologicalClaims.length > 0) {
		const mc = methodologicalClaims[0].methodologicalContext!;
		methodologicalContext = `Study design: ${mc.studyDesign ?? "not specified"}. Methodology: ${mc.methodology ?? "not specified"}. Dataset: ${mc.dataset ?? "not specified"}. Evaluation conditions: ${mc.evaluationConditions ?? "not specified"}. Reproducibility: ${mc.reproducibility?.artifactAvailable ? "artifact available" : "no artifact"}.`;
	}

	let strategicContext = "";
	if (strategicClaims.length > 0) {
		const sc = strategicClaims[0].strategicContext!;
		strategicContext = `Research purpose: ${sc.researchPurpose ?? "not specified"}. Measured outcome: ${sc.measuredOutcome ?? "not specified"}. Baseline: ${sc.baseline ?? "not specified"}. Sample size: ${sc.sampleSize ?? "unknown"}. Statistical uncertainty: ${sc.statisticalUncertainty ?? "not specified"}. Causal claim type: ${sc.causalClaimType ?? "not specified"}. Generalizability: ${sc.generalizability ?? "not specified"}.`;
	}

	// Historical context
	let historicalContext = "";
	if (historicalClassification) {
		const labels: Record<HistoricalRelationshipClassification, string> = {
			NEW_DEVELOPMENT:
				"This is an entirely new development, not previously covered.",
			PREVIOUSLY_COVERED:
				"This development was already covered in a previous edition.",
			SUBSTANTIVE_UPDATE:
				"This is a substantive update relative to prior coverage — there is qualitatively new information.",
			REPEATED_REPORTING:
				"This repeats already-known information without qualitative change.",
			RELATED_CONTEXT: "This provides related contextual information.",
			POTENTIAL_HISTORICAL_OMISSION:
				"A potential historical omission has been identified.",
			HISTORY_UNVERIFIED:
				"Historical coverage could not be reliably established.",
		};
		historicalContext = labels[historicalClassification] ?? "";
		if (historicalRelationship?.substantiveUpdate) {
			historicalContext += ` Substantive change: ${historicalRelationship.substantiveUpdate.changedFacts.join("; ")}.`;
		}
	}

	// Limitations and counterevidence
	let limitationsContext = "";
	const evidenceClasses = new Set(
		candidate.claims.map((c) => c.evidenceClassification),
	);
	if (evidenceClasses.has("VENDOR_CLAIM")) {
		limitationsContext +=
			"Note: one or more claims come from the vendor without independent verification. ";
	}
	if (evidenceClasses.has("EXPERT_INTERPRETATION")) {
		limitationsContext +=
			"Conclusions are based on expert analysis, not direct measurement or replication. ";
	}
	const maxLevel = getMaxVerificationLevelListening(
		candidate.claims.map((c) => c.verificationLevel),
	);
	if (maxLevel === "L0") {
		limitationsContext +=
			"Verification level is L0 — only source cited, no methodology check. ";
	}

	const claimsWithCounterevidence = candidate.claims.filter(
		(c) => c.contradictoryEvidence.length > 0,
	);
	if (claimsWithCounterevidence.length > 0) {
		limitationsContext +=
			"Counterevidence has been identified that may qualify or contradict the claims. ";
	}

	return `You are the voice of AI Daily Intelligence. Write the complete listening narrative for Story ${index} of this edition.

CONTEXT:
- Story number: ${index}
- Organization(s): ${org}
- Domain: ${domain}
- Factual headline: ${headline}
- Exact statement of what changed: ${exactStatement}
- Materiality: ${materiality}
- Evidence sufficiency: ${evidenceSufficiency}
- Temporal status: ${temporalStatus}
- Recommended depth: ${depth}
- Historical context: ${historicalContext || "No historical relationship identified."}

TECHNICAL CONTEXT: ${technicalContext || "No detailed technical context available."}
METHODOLOGICAL CONTEXT: ${methodologicalContext || "No methodological context available."}
STRATEGIC CONTEXT: ${strategicContext || "No strategic context available."}
LIMITATIONS AND COUNTER-EVIDENCE: ${limitationsContext || "No significant limitations or counterevidence identified."}
EDITORIAL CAVEATS: ${caveats || "None."}

REQUIREMENTS FOR THE LISTENING NARRATIVE:
1. INDEPENDENT COMPOSITION: Generate DIRECTLY from the fact dossier and editorial selection. Do NOT summarize, shorten, read aloud, or paraphrase the Dutch listening narrative or the English readable article. Use a different structure and explanation suited for the listening medium.

2. SPOKEN STORYTELLING STRUCTURE (per development):
   A. Establish context: Introduce the practical, scientific, or organizational problem. Explain sufficient background so the listener understands the significance without prior knowledge.
   B. Reveal what changed: Describe the precise newly disclosed information. Distinguish the new development from established background.
   C. Explain HOW it works: Introduce the technical mechanism, scientific finding, or organizational process. Build explanation progressively from known concepts to unfamiliar details.
   D. Explain WHY it matters: Describe practical, technical, strategic, or economic consequences supported by evidence.
   E. Preserve limitations: Explain important caveats, uncertainties, counterevidence, and maturity constraints.
   F. Natural transition: Connect to the next development through a meaningful relationship or a clear topic shift.

3. COGNITIVE ACCESSIBILITY (ADHD-friendly):
   - One central concept at a time
   - Context BEFORE complex mechanisms
   - Clear causal relationships
   - Manageable information density
   - Gradual introduction of unfamiliar terminology
   - Short, natural spoken explanations
   - Meaningful transitions
   - Acknowledgment of important distinctions
   - Brief reorientation after complex explanations
   - Selective repetition ONLY when needed for comprehension
   - Concrete examples when abstraction becomes difficult
   - AVOID: long strings of unexplained acronyms, dense product lists, excessive benchmark figures, nested explanations requiring many prior details, unnecessary version numbers/command flags, excessive name-dropping, artificially dramatic language, infantilizing simplifications

4. TECHNICAL DEPTH WITHOUT COGNITIVE OVERLOAD:
   - Preserve substance of significant technical developments
   - Explain complex mechanisms through careful conceptual progression
   - Use accurate analogies where helpful, but acknowledge their limits
   - Do NOT replace technical understanding with motivational commentary or vague descriptions
   - Preserve precise technical terminology when needed and explain naturally on first meaningful use

5. SCIENTIFIC AND STRATEGIC NARRATIVE:
   - Give scientific discoveries and strategic research the same narrative care as software releases
   - Explain naturally: what researchers wanted to understand, how they investigated it, what was measured, what they found, what the findings do/don't establish, why conclusions matter
   - Distinguish: observed results from predictions, correlation from causation, original studies from advisory interpretations, vendor-sponsored evidence from independent studies, experimental findings from demonstrated production outcomes

6. QUANTITATIVE INFORMATION:
   - Use numbers ONLY when they materially improve understanding
   - Explain what the number represents, the relevant baseline/comparison, preserve significant uncertainty, avoid misleading precision
   - Convert dense benchmark descriptions into comprehensible spoken explanations

7. FACTUAL INTEGRITY AND UNCERTAINTY:
   - Every material claim must be consistent with the canonical fact dossier
   - Preserve distinction between: verified facts, vendor claims, research findings, original investigative reporting, expert interpretations, inferences, speculation, unverified information
   - Communicate uncertainty in natural English (e.g., "according to the company's own benchmarks," "independent replication is pending")
   - Distinguish: announced capabilities, experimental functionality, previews, general availability, independently demonstrated behavior
   - Do NOT claim a proposed capability is already operational
   - Do NOT fabricate experimental results, security guarantees, source verifications, or causal relationships

8. TEMPORAL AND HISTORICAL INTEGRITY:
   - Respect upstream temporal eligibility and historical regression decisions
   - Reporting window: previous edition day 05:00 inclusive → current edition day 05:00 exclusive, Europe/Amsterdam
   - Preserve distinction between: original event date, first public disclosure, publication timestamp, new substantive update, previously established information
   - Explain historical context ONLY when needed to understand the new development
   - Explicitly identify historical catch-up when included by editorial selection
   - Do NOT present old developments as newly announced

9. COMPLETE AND VENDOR-NEUTRAL COVERAGE:
   - Include EVERY materially selected story from the editorial selection manifest
   - Scale narrative depth to actual significance
   - Do NOT silently drop: complex scientific findings, strategic/economic developments, important security implications, less-known vendors, consequential counterevidence, relevant technical limitations
   - AVOID disproportionate emphasis on GitHub/Copilot/coding agents/VS Code unless editorial selection justifies it

10. TEXT-TO-SPEECH COMPATIBILITY:
    - Natural spoken sentence structure
    - Readable punctuation
    - Clear language metadata
    - Predictable reading order
    - Correct handling of abbreviations and technical names
    - NO unnecessary Markdown syntax that would be spoken
    - NO spoken URL lists or citation identifiers
    - NO references to diagrams the listener must see
    - NO dependence on visual layout or color
    - NO operational status messages in narrative content

Write the COMPLETE listening narrative for this story in English, as ONE COHESIVE TEXT WITHOUT SECTION HEADINGS (these are added later during assembly).`;
}

/**
 * Generate a transition between stories
 */
async function generateTransition(
	currentStory: EnglishListeningStoryContext,
	nextStory: EnglishListeningStoryContext,
	input: EnglishListeningNarrativeGenerationInput,
	llmClient: ReturnType<typeof createFreeLLMClient>,
	stats: {
		requests: number;
		tokens: number;
		providersUsed: string[];
		cacheHits: number;
	},
): Promise<NarrativeSegment> {
	const currentOrg = currentStory.candidate.organizations.join(", ");
	const currentDomain = translateDomainENListening(
		currentStory.candidate.researchDomains[0] ?? "unknown domain",
	);
	const nextOrg = nextStory.candidate.organizations.join(", ");
	const nextDomain = translateDomainENListening(
		nextStory.candidate.researchDomains[0] ?? "unknown domain",
	);
	const nextHeadline = nextStory.candidate.factualHeadline;

	// Check for genuine conceptual connections
	const sharedOrgs = currentStory.candidate.organizations.filter((o) =>
		nextStory.candidate.organizations.includes(o),
	);
	const sharedTechs = currentStory.candidate.technologies.filter((t) =>
		nextStory.candidate.technologies.includes(t),
	);
	const sharedDomains = currentStory.candidate.researchDomains.filter((d) =>
		nextStory.candidate.researchDomains.includes(d),
	);

	const prompt = `You are the voice of AI Daily Intelligence. Write a natural transition between two stories in the listening briefing.

CURRENT STORY:
- Organization(s): ${currentOrg}
- Domain: ${currentDomain}

NEXT STORY:
- Organization(s): ${nextOrg}
- Domain: ${nextDomain}
- Factual headline: ${nextHeadline}

SHARED ELEMENTS (for potential connection):
- Shared organizations: ${sharedOrgs.length > 0 ? sharedOrgs.join(", ") : "none"}
- Shared technologies: ${sharedTechs.length > 0 ? sharedTechs.join(", ") : "none"}
- Shared research domains: ${sharedDomains.length > 0 ? sharedDomains.join(", ") : "none"}

REQUIREMENTS:
1. Make a NATURAL connection where a genuine conceptual link exists.
2. Use a CLEAR topic shift when subjects differ.
3. Do NOT use mechanical sentences repeated between every story.
4. No editorial commentary about why a story was selected.
5. Do NOT fabricate connections between unrelated developments to create an artificial theme.
6. Brief reorientation after cognitively demanding sections is allowed: briefly remind what the problem was, what changed, why the distinction matters.
7. Suitable for SpeechSynthesis — natural sentence structure, no URLs, no citations.
8. Maximum 2-3 sentences.

Write the transition NOW in English:`;

	const response = await callLLMWithRetry(
		llmClient,
		prompt,
		stats,
		"transition",
	);

	return {
		type: "transition",
		content: response.content,
		claimIds: [],
		sourceIds: [],
	};
}

/**
 * Generate the conclusion segment
 */
async function generateConclusion(
	input: EnglishListeningNarrativeGenerationInput,
	llmClient: ReturnType<typeof createFreeLLMClient>,
	stats: {
		requests: number;
		tokens: number;
		providersUsed: string[];
		cacheHits: number;
	},
): Promise<NarrativeSegment> {
	const { stories, editionDate } = input;

	if (stories.length === 0) {
		return {
			type: "conclusion",
			content: `This was AI Daily Intelligence for ${formatDateEN(editionDate)}. See you tomorrow for the next briefing.`,
			claimIds: [],
			sourceIds: [],
		};
	}

	const storySummaries = stories
		.map((s, i) => {
			const org = s.candidate.organizations[0] ?? "unknown organization";
			const domain = translateDomainENListening(
				s.candidate.researchDomains[0] ?? "unknown domain",
			);
			return `${i + 1}. ${org} (${domain}): ${s.candidate.factualHeadline}`;
		})
		.join("; ");

	const prompt = `You are the voice of AI Daily Intelligence. Write the CLOSING of the listening briefing.

EDITION: ${formatDateEN(editionDate)}
STORIES IN THIS EDITION: ${storySummaries}

REQUIREMENTS:
1. End in a way that NATURALLY FOLLOWS from the actual developments.
2. A conclusion MAY briefly connect meaningful implications WHEN supported by evidence.
3. Do NOT require: generic architecture lesson, mandatory principles list, motivational closing, repetitive story summary, forced future prediction.
4. Vendor-neutral architectural insights ONLY when genuinely supported by the selected developments and authorized by editorial contract.
5. Otherwise: end NATURALLY.
6. Suitable for SpeechSynthesis — natural sentence structure, no URLs, no citations.
7. Maximum 3-4 sentences.

Write the conclusion NOW in English:`;

	const response = await callLLMWithRetry(
		llmClient,
		prompt,
		stats,
		"conclusion",
	);

	return {
		type: "conclusion",
		content: response.content,
		claimIds: [],
		sourceIds: [],
	};
}

/**
 * Call LLM with retry and stats tracking
 */
async function callLLMWithRetry(
	llmClient: ReturnType<typeof createFreeLLMClient>,
	prompt: string,
	stats: {
		requests: number;
		tokens: number;
		providersUsed: string[];
		cacheHits: number;
	},
	segmentType: string,
): Promise<{ content: string; cached: boolean }> {
	const messages = [
		{
			role: "system" as const,
			content:
				"You are the voice of AI Daily Intelligence, an English daily listening briefing on AI developments for system architects and technical decision-makers. You speak naturally, with technical depth, cognitive accessibility (ADHD-friendly), and suitability for browser-native text-to-speech.",
		},
		{ role: "user" as const, content: prompt },
	];

	const response = await llmClient.request(messages, {
		temperature: 0.3,
		maxTokens: 3000,
		checkpointId: `english-listening-${segmentType}`,
	});

	stats.requests++;
	stats.tokens += response.tokensUsed.total;
	if (!stats.providersUsed.includes(response.provider)) {
		stats.providersUsed.push(response.provider);
	}
	if (response.cached) {
		stats.cacheHits++;
	}

	return { content: response.content.trim(), cached: response.cached };
}

/**
 * Assemble final markdown from segments
 */
function assembleMarkdown(
	editionDate: string,
	editionWindow: { start: string; end: string; timezone: string },
	segments: NarrativeSegment[],
): string {
	const dateFormatted = formatDateEN(editionDate);
	const windowStr = formatWindowListening(editionWindow);

	const lines: string[] = [
		`# AI Daily Intelligence — ${dateFormatted}`,
		"",
		segments.find((s) => s.type === "opening")?.content ?? "",
		"",
		"---",
		"",
	];

	let storyIndex = 0;
	for (const segment of segments) {
		if (segment.type === "story") {
			storyIndex++;
			lines.push(`## Story ${storyIndex}`);
			lines.push("");
			lines.push(segment.content);
			lines.push("");
			lines.push("---");
			lines.push("");
		} else if (segment.type === "transition") {
			lines.push(segment.content);
			lines.push("");
			lines.push("---");
			lines.push("");
		} else if (segment.type === "conclusion") {
			lines.push(segment.content);
			lines.push("");
			lines.push("---");
			lines.push("");
		}
	}

	// Add footer (metadata, not spoken)
	lines.push(
		"*This listening narrative is independently authored from the canonical fact dossier and editorial selection manifest. No URLs, citation strings, or audit terminology. Written for an adult listener without screen access.*",
	);

	return lines.join("\n");
}

/**
 * Build traceability metadata
 */
function buildTraceability(
	segments: NarrativeSegment[],
	stories: EnglishListeningStoryContext[],
): EnglishListeningNarrativeGenerationResult["traceability"] {
	const claimCoverage = new Set<string>();
	const sourceCoverage = new Set<string>();
	const storyCoverage = new Set<string>();

	for (const segment of segments) {
		for (const claimId of segment.claimIds) claimCoverage.add(claimId);
		for (const sourceId of segment.sourceIds) sourceCoverage.add(sourceId);
		if (segment.type === "story") {
			// Find which story this segment corresponds to
			for (const story of stories) {
				const hasOverlap = segment.claimIds.some((c) =>
					story.candidate.claims.some((sc) => sc.claimId === c),
				);
				if (hasOverlap) {
					storyCoverage.add(story.story.storyId);
				}
			}
		}
	}

	return {
		segments: segments.map((s) => ({
			type: s.type,
			claimIds: s.claimIds,
			sourceIds: s.sourceIds,
			storyId:
				s.type === "story" ? Array.from(storyCoverage)[0] : undefined,
		})),
		claimCoverage: Array.from(claimCoverage),
		sourceCoverage: Array.from(sourceCoverage),
		storyCoverage: Array.from(storyCoverage),
	};
}

/**
 * Validate English listening narrative output
 */
export function validateEnglishListeningNarrativeOutput(
	markdown: string,
	input: EnglishListeningNarrativeGenerationInput,
): { valid: boolean; errors: string[]; warnings: string[] } {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check required structure
	if (!markdown.startsWith("# AI Daily Intelligence —")) {
		errors.push("Missing or incorrect title");
	}

	if (!markdown.includes("## Story")) {
		warnings.push("No story sections found (## Story N)");
	}

	// Check for forbidden elements in spoken content
	if (markdown.includes("http://") || markdown.includes("https://")) {
		warnings.push("URLs found in narrative — should not be spoken");
	}

	if (
		markdown.includes("claim_") ||
		markdown.includes("cand_") ||
		markdown.includes("disc_") ||
		markdown.includes("ev_")
	) {
		warnings.push(
			"Citation identifiers found in narrative — should not be spoken",
		);
	}

	if (
		markdown.includes("[Research Audit]") ||
		markdown.includes("[Listening Narrative]") ||
		markdown.includes("Navigatie")
	) {
		warnings.push(
			"Navigation/metadata references found in narrative — should not be spoken",
		);
	}

	// Check heading hierarchy
	const headingMatches = markdown.match(/^#{1,6} .+$/gm);
	if (headingMatches) {
		let prevLevel = 0;
		for (const heading of headingMatches) {
			const level = heading.match(/^#+/)?.[0].length ?? 0;
			if (prevLevel > 0 && level > prevLevel + 1) {
				warnings.push(`Heading level jump: ${heading}`);
			}
			prevLevel = level;
		}
	}

	// Check all selected stories are represented
	for (const story of input.stories) {
		const org = story.candidate.organizations[0] ?? "";
		if (org && !markdown.toLowerCase().includes(org.toLowerCase())) {
			warnings.push(
				`Organization ${org} from story ${story.story.storyId} not found in output`,
			);
		}
	}

	// Check for template variables
	if (markdown.includes("${editionDate}")) {
		errors.push("Template variable ${editionDate} not replaced");
	}

	// Check for visual references
	const visualRefs = [
		"diagram",
		"figure",
		"table",
		"chart",
		"schema",
		"illustration",
	];
	for (const ref of visualRefs) {
		if (markdown.toLowerCase().includes(ref)) {
			warnings.push(
				`Possible visual reference "${ref}" found — ensure textual fallback exists`,
			);
		}
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
	};
}

/**
 * Generate mock English listening narrative for validation mode
 */
function generateMockEnglishListeningNarrative(
	editionDate: string,
	editionWindow: { start: string; end: string; timezone: string },
	stories: EnglishListeningStoryContext[],
): string {
	const dateFormatted = formatDateEN(editionDate);
	const windowStr = formatWindowListening(editionWindow);

	let markdown = `# AI Daily Intelligence — ${dateFormatted}\n\n`;

	if (stories.length === 0) {
		markdown += `Good morning. This is your daily AI Intelligence listening briefing for ${dateFormatted}. In the past 24 hours, no developments were selected that meet the materiality threshold for this briefing.\n\n`;
	} else {
		markdown += `Good morning. This is your daily AI Intelligence listening briefing for ${dateFormatted}. Today ${stories.length} developments that matter for system architects and technical decision-makers.\n\n`;
		markdown += "---\n\n";

		markdown += `## Story 1\n\n`;
		markdown += `[VALIDATION MODE] Synthetic opening for testing. ${stories.map((s) => s.candidate.organizations.join(", ")).join("; ")}\n\n`;
		markdown += "---\n\n";

		markdown += stories
			.map(
				(s, i) =>
					`## Story ${i + 1}\n\n[VALIDATION MODE] Synthetic story narrative for testing. ${s.candidate.organizations.join(", ")} in ${translateDomainENListening(s.candidate.researchDomains[0] ?? "unknown domain")}.`,
			)
			.join("\n\n---\n\n");

		markdown += "\n\n---\n\n";

		markdown += `## Summary\n\n`;
		markdown += `Today we covered ${stories.length} stories.\n\n`;
		if (stories.length > 0) {
			markdown += `The most impactful was about ${stories[0].candidate.organizations[0]} and ${translateDomainENListening(stories[0].candidate.researchDomains[0] ?? "unknown domain")}.\n\n`;
		}
		markdown += `The technical details and source references are in the full newsletter and research audit.\n\n`;
		markdown += `Until tomorrow, with the next AI Intelligence briefing.\n\n`;
		markdown += "---\n\n";
		markdown += `*This listening narrative is independently authored from the canonical fact dossier and editorial selection manifest. No URLs, citation strings, or audit terminology. Written for an adult listener without screen access.*`;
	}

	return markdown;
}

// ============================================================================
// Helper functions
// ============================================================================

function formatDateEN(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

// ============================================================================
// Helper functions (exported for testing)
// ============================================================================

export function formatDateENListening(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

export function formatWindowListening(window: {
	start: string;
	end: string;
	timezone: string;
}): string {
	const start = parseTemporalTimestamp(window.start);
	const end = parseTemporalTimestamp(window.end);
	if (isNaN(start.getTime()) || isNaN(end.getTime())) {
		return "Invalid window";
	}
	return `${start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: window.timezone })}–${end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: window.timezone })} ${window.timezone}`;
}

export function parseTemporalTimestamp(isoStr: string): Date {
	const cleaned = isoStr.replace(/\[.*?\]$/, "");
	return new Date(cleaned);
}

export function translateDomainENListening(domain: string): string {
	const translations: Record<string, string> = {
		"agentic-ai-software-engineering": "Agentic AI & Software Engineering",
		"models-inference-scientific":
			"Models, Inference & Scientific Research",
		"architecture-security-governance":
			"Architecture, Security & Governance",
		"enterprise-adoption-organizational":
			"Enterprise AI Adoption & Organizational Transformation",
		"economics-business-impact":
			"Economics, Business Impact & Strategic Intelligence",
		"independent-research-advisory":
			"Independent Research & Advisory Intelligence",
		"coding-agents-skills-mcp-hooks-plugins-apm":
			"Coding Agents, Skills, MCP, Hooks, Plugins & APM",
		"agent-orchestration-evaluation-reliability-observability":
			"Agent Orchestration, Evaluation, Reliability & Observability",
		"security-sandboxing-software-supply-chains":
			"Security, Sandboxing & Software Supply Chains",
		"developer-productivity-software-delivery":
			"Developer Productivity & Software Delivery",
		"enterprise-ai-adoption-organizational-transformation":
			"Enterprise AI Adoption & Organizational Transformation",
	};
	return translations[domain] ?? domain;
}

export function getMaxVerificationLevelListening(
	levels: VerificationLevel[],
): VerificationLevel {
	const order: VerificationLevel[] = ["L0", "L1", "L2", "L3"];
	let max: VerificationLevel = "L0";
	for (const level of levels) {
		if (order.indexOf(level) > order.indexOf(max)) {
			max = level;
		}
	}
	return max;
}

export function computeContentHash(content: string): string {
	return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

export function computeContentHashListening(content: string): string {
	return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

export function countWords(text: string): number {
	return text
		.trim()
		.split(/\s+/)
		.filter((w) => w.length > 0).length;
}

export function countWordsListening(text: string): number {
	return text
		.trim()
		.split(/\s+/)
		.filter((w) => w.length > 0).length;
}

/**
 * Save checkpoint for resumability
 */
async function saveCheckpoint(
	checkpointDir: string,
	editionDate: string,
	step: number,
	totalSteps: number,
	segments: NarrativeSegment[],
	processedStoryIds: Set<string>,
	stats: {
		requests: number;
		tokens: number;
		providersUsed: string[];
		cacheHits: number;
	},
	errors: string[],
): Promise<void> {
	const checkpoint: GenerationCheckpoint = {
		id: `checkpoint_${editionDate}_${Date.now()}`,
		editionDate,
		step,
		totalSteps,
		completedSegments: segments,
		processedStoryIds: Array.from(processedStoryIds),
		llmStats: stats,
		errors,
		timestamp: Date.now(),
	};

	const checkpointPath = join(checkpointDir, `${checkpoint.id}.json`);
	await fs.writeFile(
		checkpointPath,
		JSON.stringify(checkpoint, null, 2),
		"utf-8",
	);
}

/**
 * Load checkpoint for resumability
 */
async function loadCheckpoint(
	checkpointId: string,
): Promise<GenerationCheckpoint | null> {
	try {
		const checkpointDir = join(
			DATA_DIR,
			"checkpoints",
			"english-listening-narrative",
		);
		const files = await fs.readdir(checkpointDir);
		const file = files.find((f) => f.startsWith(checkpointId));
		if (!file) return null;

		const content = await fs.readFile(join(checkpointDir, file), "utf-8");
		return JSON.parse(content);
	} catch {
		return null;
	}
}
