/**
 * Independent Dutch Listening Narrative Generator
 *
 * Generates the canonical "AI Daily Intelligence — YYYY-MM-DD.md" artifact from
 * validated upstream inputs without paraphrasing or summarizing the technical newsletter.
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
	VerificationLevel,
} from "../fact-dossier/schema.js";
import type {
	EditorialSelectionManifest,
	EditorialStory,
	EditorialCandidateAssessment,
} from "../editorial-selection/schema.js";
import type {
	HistoricalRegressionReport,
	HistoricalRelationship,
	HistoricalRelationshipClassification,
} from "../historical-regression/schema.js";
import {
	createFreeLLMClient,
	type LLMClientConfig,
} from "../free-llm-client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..", "..", "..");
const DATA_DIR = join(PROJECT_ROOT, "data");

/**
 * Story composition context loaded from upstream artifacts
 */
export interface ListeningStoryContext {
	story: EditorialStory;
	candidate: CanonicalCandidate;
	assessment: EditorialCandidateAssessment;
	historicalRelationship: HistoricalRelationship | null;
	historicalClassification: HistoricalRelationshipClassification | null;
}

/**
 * Loaded upstream data for listening narrative generation
 */
export interface ListeningNarrativeGenerationInput {
	editionDate: string;
	editionWindow: { start: string; end: string; timezone: string };
	factDossier: CanonicalFactDossier;
	editorialManifest: EditorialSelectionManifest;
	historicalRegression: HistoricalRegressionReport | null;
	stories: ListeningStoryContext[];
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
export interface ListeningNarrativeGenerationResult {
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
 * Load and prepare listening narrative generation input from upstream artifacts
 */
export async function loadListeningNarrativeGenerationInput(
	editionDate: string,
	dataDir: string = DATA_DIR,
): Promise<ListeningNarrativeGenerationInput> {
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
): ListeningStoryContext[] {
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
 * Main entry point: Generate the complete Dutch listening narrative markdown
 */
export async function generateListeningNarrativeMarkdown(
	input: ListeningNarrativeGenerationInput,
	options: {
		validateOnly?: boolean;
		resumeFromCheckpoint?: string;
	} = {},
): Promise<ListeningNarrativeGenerationResult> {
	const { editionDate, editionWindow, stories } = input;

	// Handle validation-only mode: return mock result without calling LLM
	if (options.validateOnly) {
		const mockMarkdown = `# AI Daily Intelligence — ${formatDutchDate(editionDate)}

Goedemorgen. Dit is uw dagelijkse AI Intelligence luisterbriefing voor ${formatDutchDate(editionDate)}.

Vandaag ${stories.length} ontwikkelingen die tellen voor systemarchitecten en technische besluitvormers.

---

## Verhaal 1

[VALIDATION MODE] Synthetic opening for testing. ${stories.map((s) => s.candidate.organizations.join(", ")).join("; ")}

---

${stories
	.map(
		(s, i) => `## Verhaal ${i + 1}

[VALIDATION MODE] Synthetic story narrative for testing. ${s.candidate.organizations.join(", ")} in ${translateDomainNLListening(s.candidate.researchDomains[0] ?? "onbekend domein")}.`,
	)
	.join("\n\n---\n\n")}

---

## Samengevat

Vandaag hebben we ${stories.length} verhalen behandeld.

${stories.length > 0 ? `De meest impactvolle was over ${stories[0].candidate.organizations[0]} en ${translateDomainNLListening(stories[0].candidate.researchDomains[0] ?? "onbekend domein")}.` : ""}

De technische details en bronverwijzingen vindt u in de volledige nieuwsbrief en het research audit.

Tot morgen, bij de volgende AI Intelligence briefing.

---

*Dit luisterverhaal is onafhankelijk geauthored vanuit het canoniek feiten dossier en de editoriële selectie manifest. Geen URLs, citatie-tekenreeksen of audit-terminologie. Geschreven voor een volwassen luisteraar zonder schermtoegang.*`;

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
		"listening-narrative",
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
		const outputValidation = validateListeningNarrativeOutput(
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
	input: ListeningNarrativeGenerationInput,
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
			content: `Goedemorgen. Dit is AI Daily Intelligence voor ${formatDutchDate(editionDate)}. In de afgelopen 24 uur zijn er geen ontwikkelingen geselecteerd die de materiële drempel bereiken voor deze briefing.`,
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
	const domain = translateDomainNLListening(
		leadCandidate.researchDomains[0] ?? "onbekend domein",
	);
	const headline = leadCandidate.factualHeadline;
	const windowStr = formatWindowListening(editionWindow);

	return `Je bent de stem van AI Daily Intelligence, een Nederlandse dagelijkse luisterbriefing voor systemarchitecten en technische besluitvormers. Schrijf de opening van de editie van vandaag.

CONTEXT:
- Editiedatum: ${leadCandidate.editionDate}
- Rapportagevenster: ${windowStr}
- Aantal verhalen in deze editie: ${storyCount}

LEIDENDE ONTWIKKELING (Story 1):
- Organisatie(s): ${org}
- Domein: ${domain}
- Feitelijke kop: ${headline}
- Exacte verklaring wat veranderd is: ${leadCandidate.exactStatement}
- Materiële gewicht: ${leadAssessment.materialityLevel} (score: ${leadAssessment.materialityScore.toFixed(2)})
- Bewijslast: ${leadAssessment.eligibility.evidenceSufficiency}
- Temporale status: ${leadAssessment.eligibility.temporalStatus}

VEREISTES VOOR DE OPENING:
1. Begin MET DE CONCRETE NIEUWS, niet met een algemene begroeting of podcast-intro.
2. Stel direct vast: WAT is er gebeurd, WAAROM het nu belangrijk is, en WAT de luisteraar moet begrijpen voordat technische details volgen.
3. Geen generieke thema's, geen kunstmatige spanning, geen editoriële zelfcommentaar.
4. Geen beschrijving van het onderzoek- of publicatieproces.
5. Geen automatische voorkeur voor GitHub/Copilot/VS Code — de leidende ontwikkeling wordt bepaald door editoriële significantie.
6. Schrijf voor een volwassen luisteraar die mogelijk rijdt, wandelt of werkt — geen schermtoegang, geen mogelijkheid om terug te lezen.
7. ADHD-vriendelijk: één centraal concept, duidelijke causale relaties, beheersbare informatiedichtheid.
8. Natuurlijke gesproken zinstructuur, geschikt voor browser-native SpeechSynthesis.
9. Geen URLs, citatie-identificaties, of audit-terminologie in de gesproken tekst.
10. Maximaal 3-4 zinnen voor de opening.

Schrijf NU de opening in het Nederlands:`;
}

/**
 * Generate a story narrative segment — independent audio-first composition
 */
async function generateStoryNarrative(
	index: number,
	context: ListeningStoryContext,
	input: ListeningNarrativeGenerationInput,
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
	input: ListeningNarrativeGenerationInput,
): string {
	const org = candidate.organizations.join(", ");
	const domain = translateDomainNLListening(
		candidate.researchDomains[0] ?? "onbekend domein",
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
		technicalContext = `Technisch mechanisme: ${tc.mechanism ?? "niet gespecificeerd"}. Capaciteiten: ${tc.capabilities?.join(", ") ?? "geen"}. Architectuur: ${tc.architecture?.join(", ") ?? "geen"}. Beperkingen: ${tc.limitations?.join(", ") ?? "geen"}. Releasematuring: ${tc.releaseMaturity ?? "onbekend"}. Implementatiestatus: ${tc.implementationStatus ?? "onbekend"}.`;
	}

	let methodologicalContext = "";
	if (methodologicalClaims.length > 0) {
		const mc = methodologicalClaims[0].methodologicalContext!;
		methodologicalContext = `Onderzoeksdesign: ${mc.studyDesign ?? "niet gespecificeerd"}. Methodologie: ${mc.methodology ?? "niet gespecificeerd"}. Dataset: ${mc.dataset ?? "niet gespecificeerd"}. Evaluatiecondities: ${mc.evaluationConditions ?? "niet gespecificeerd"}. Reproduceerbaarheid: ${mc.reproducibility?.artifactAvailable ? "artefact beschikbaar" : "geen artefact"}.`;
	}

	let strategicContext = "";
	if (strategicClaims.length > 0) {
		const sc = strategicClaims[0].strategicContext!;
		strategicContext = `Onderzoeksdoel: ${sc.researchPurpose ?? "niet gespecificeerd"}. Gemeten uitkomst: ${sc.measuredOutcome ?? "niet gespecificeerd"}. Baseline: ${sc.baseline ?? "niet gespecificeerd"}. Steekproefgrootte: ${sc.sampleSize ?? "onbekend"}. Statistische onzekerheid: ${sc.statisticalUncertainty ?? "niet gespecificeerd"}. Causale claim type: ${sc.causalClaimType ?? "niet gespecificeerd"}. Generaliseerbaarheid: ${sc.generalizability ?? "niet gespecificeerd"}.`;
	}

	// Historical context
	let historicalContext = "";
	if (historicalClassification) {
		const labels: Record<HistoricalRelationshipClassification, string> = {
			NEW_DEVELOPMENT:
				"Dit is een volledig nieuwe ontwikkeling, niet eerder gedekt.",
			PREVIOUSLY_COVERED:
				"Deze ontwikkeling was al eerder gedekt in een vorige editie.",
			SUBSTANTIVE_UPDATE:
				"Dit is een substantiële update ten opzichte van eerdere dekking — er is kwalitatief nieuwe informatie.",
			REPEATED_REPORTING:
				"Dit is herhaling van reeds bekende informatie zonder kwalificatieve wijziging.",
			RELATED_CONTEXT: "Dit biedt gerelateerde contextuele informatie.",
			POTENTIAL_HISTORICAL_OMISSION:
				"Er is een potentiële historische omissie geïdentificeerd.",
			HISTORY_UNVERIFIED:
				"Historische dekking kon niet betrouwbaar worden vastgesteld.",
		};
		historicalContext = labels[historicalClassification] ?? "";
		if (historicalRelationship?.substantiveUpdate) {
			historicalContext += ` Substantiële wijziging: ${historicalRelationship.substantiveUpdate.changedFacts.join("; ")}.`;
		}
	}

	// Limitations and counterevidence
	let limitationsContext = "";
	const evidenceClasses = new Set(
		candidate.claims.map((c) => c.evidenceClassification),
	);
	if (evidenceClasses.has("VENDOR_CLAIM")) {
		limitationsContext +=
			"Let op: een of meer beweringen stammen van de aanbieder zonder onafhankelijke verificatie. ";
	}
	if (evidenceClasses.has("EXPERT_INTERPRETATION")) {
		limitationsContext +=
			"Conclusies zijn gebaseerd op deskundigenanalyse, niet op directe meting of replicatie. ";
	}
	const maxLevel = getMaxVerificationLevelListening(
		candidate.claims.map((c) => c.verificationLevel),
	);
	if (maxLevel === "L0") {
		limitationsContext +=
			"Verificatieniveau is L0 — alleen bron geciteerd, geen methodologiecheck. ";
	}

	const claimsWithCounterevidence = candidate.claims.filter(
		(c) => c.contradictoryEvidence.length > 0,
	);
	if (claimsWithCounterevidence.length > 0) {
		limitationsContext +=
			"Er is tegenbewijs geïdentificeerd dat de claims kan kwalificeren of tegenspreken. ";
	}

	return `Je bent de stem van AI Daily Intelligence. Schrijf het complete luisternarratief voor Verhaal ${index} van deze editie.

CONTEXT:
- Verhaal nummer: ${index}
- Organisatie(s): ${org}
- Domein: ${domain}
- Feitelijke kop: ${headline}
- Exacte verklaring wat veranderd is: ${exactStatement}
- Materiële gewicht: ${materiality}
- Bewijslast: ${evidenceSufficiency}
- Temporale status: ${temporalStatus}
- Aanbevolen diepgang: ${depth}
- Historische context: ${historicalContext || "Geen historische relatie geïdentificeerd."}

TECHNISCHE CONTEXT: ${technicalContext || "Geen gedetailleerde technische context beschikbaar."}
METHODOLOGISCHE CONTEXT: ${methodologicalContext || "Geen methodologische context beschikbaar."}
STRATEGISCHE CONTEXT: ${strategicContext || "Geen strategische context beschikbaar."}
BEPERKINGEN EN TEGENBEWIJS: ${limitationsContext || "Geen significante beperkingen of tegenbewijs geïdentificeerd."}
CAVEATS UIT EDITORIËLE SELECTIE: ${caveats || "Geen."}

VEREISTES VOOR HET LUISTERNARRATIEF:
1. INDEPENDENTE COMPOSITIE: Genereer DIRECT uit het feiten dossier en de editoriële selectie. Samenvat, verkort, lees voor of paraphraseer NIET de technische nieuwsbrief (publication.md). Gebruik een andere structuur en uitleg passend voor het luistermedium.

2. GESPROKEN STORYTELLING STRUCTUUR (per ontwikkeling):
   A. Context vestigen: Introduceer het praktische, wetenschappelijke of organisatorische probleem. Leg voldoende achtergrond uit zodat de luisteraar de significantie begrijpt zonder eerdere kennis.
   B. Onthul wat veranderd is: Beschrijf de precieze nieuw onthulde informatie. Onderscheid de nieuwe ontwikkeling van de gevestigde achtergrond.
   C. Leg uit HOE het werkt: Introduceer het technische mechanisme, de wetenschappelijke bevinding of het organisatieproces. Bouw uitleg progressief op van bekende concepten naar onbekende details.
   D. Leg uit WAAROM het belangrijk is: Beschrijf de praktische, technische, strategische of economische gevolgen ondersteund door bewijs.
   E. Behoud beperkings: Leg belangrijke voorbehouden, onzekerheid, tegenbewijs en maturiteitsbeperkingen uit.
   F. Natuurlijke overgang: Verbind met de volgende ontwikkeling door een betekenisvolle relatie of een duidelijke onderwerpwisseling.

3. COGNITIEVE TOEGANKELIJKHEID (ADHD-vriendelijk):
   - Één centraal concept per keer
   - Context VOOR complexe mechanismen
   - Duidelijke causale relaties
   - Beheersbare informatiedichtheid
   - Geleidelijke introductie van onbekende terminologie
   - Korte, natuurlijke gesproken uitleg
   - Betekenisvolle overgangen
   - Herkenning van belangrijke onderscheiden
   - Korte heroriëntatie na complexe uitleg
   - Selectieve herhaling INDIEN nodig voor begrip
   - Concreet voorbeelden wanneer abstractie lastig wordt
   - VERMIJD: lange rijen onontledigde acroniemen, dichte productlijsten, excessieve benchmarkcijfers, geneste uitleg die veel eerdere details vereist, onnodige versienummers/commandovlaggen, excessieve naamvermelding, artificieel dramatische taal, infantiliserende vereenvoudigingen

4. TECHNISCHE DIEPTIJ ZONDER COGNITIEVE OVERBELASTING:
   - Behoud de substantie van significante technische ontwikkelingen
   - Leg complexe mechanismen uit via zorgvuldige conceptuele progressie
   - Gebruik accurate analogieën waar nuttig, maar verduidelijk hun beperkingen
   - Vervang technisch begrip NIET door motiverende commentaar of vage beschrijvingen
   - Behoud precise technische terminologie wanneer nodig en leg deze natuurlijk uit bij eerste betekenisvolle gebruik

5. WETENSCHAPPELIJKE EN STRATEGISCHE NARRATIEF:
   - Geef wetenschappelijke ontdekkingen en strategisch onderzoek dezelfde narratieve zorg als software releases
   - Leg natuurlijk uit: wat wilden onderzoekers begrijpen, hoe onderzochten ze het, wat werd gemeten, wat vonden ze, wat de bevindingen wel/niet vastleggen, waarom de conclusies belangrijk zijn
   - Onderscheid: waargenomen resultaten van voorspellingen, correlatie van causaliteit, originele studies van adviesinterpretaties, vendor-gesponsorde bewijzen van onafhankelijke studies, experimentele bevindingen van gedemonstreerde productie-uitkomsten

6. KWANTITATIEVE INFORMATIE:
   - Gebruik cijfers ALLEEN wanneer ze materieel begrip verbeteren
   - Leg uit wat het getal vertegenwoordigt, de relevante baseline/vergelijking, behoud significante onzekerheid, vermijd misleidende precisie
   - Converteer dichte benchmarkbeschrijvingen naar verstaanbare gesproken uitleg

7. FACTUELE INTEGRITEIT EN ONZEKERHEID:
   - Elke materiële bewering moet consistent zijn met het canoniek feiten dossier
   - Behoud onderscheid tussen: geverifieerde feiten, vendor-claims, onderzoeksbevindingen, origineel investigatief verslag, expertinterpretaties, inferenties, speculatie, ongeverifieerde informatie
   - Communiceer onzekerheid in natuurlijk Nederlands (bijv. "volgens de eigen benchmark van het bedrijf", "onafhankelijke replicatie staat nog uit")
   - Onderscheid: aangekondigde capaciteiten, experimentele functionaliteit, previews, algemeen beschikbaar, onafhankelijk gedemonstreerd gedrag
   - Claim NIET dat een voorgestelde capaciteit al operationeel is
   - Fabricer GEEN experimentele uitkomsten, beveiligingsgaranties, bronverificatie of causale relaties

8. TEMPORELE EN HISTORISCHE INTEGRITEIT:
   - Respecteer de upstream temporale eligibiliteit en historische regressie beslissingen
   - Rapportagevenster: vorige editiedag 05:00 inclusief → huidige editiedag 05:00 exclusief, Europe/Amsterdam
   - Behoud verschil tussen: originele eventdatum, eerste openbare openbaring, publicatietimestamp, nieuwe substantiële update, eerder gevestigde informatie
   - Leg historische context UIT ALLEEN wanneer nodig om de nieuwe ontwikkeling te begrijpen
   - Identificeer expliciet historisch catch-up wanneer opgenomen door editoriële selectie
   - Presenteer GEEN oude ontwikkeling als nieuw aangekondigd

9. VOLLEDIGE EN VENDOR-NEUTRALE DEKKING:
   - Neem ELK materieel geselecteerd verhaal op uit de editoriële selectie manifest
   - Pas narratieve diepte aan naar daadwerkelijke significantie
   - Laat NIET stilzwijgend vallen: complexe wetenschappelijke bevindingen, strategische/economische ontwikkelingen, belangrijke beveiligingsimplicaties, minder bekende leveranciers, consequent tegenbewijs, relevante technische beperkingen
   - VERMIJD onevenredige nadruk op GitHub/Copilot/coding agents/VS Code tenzij editoriële selectie dit rechtvaardigt

10. TEXT-TO-SPEECH COMPATIBILITEIT:
    - Natuurlijke gesproken zinstructuur
    - Leesbare leestekens
    - Duidelijke taalmetadata
    - Voorspelbare leesvolgorde
    - Correcte afhandeling van afkortingen en technische namen
    - GEEN onnodige Markdown-syntax die naar spraak zou gaan
    - GEEN gesproken URL-lijsten of citatie-identificaties
    - GEEN verwijzingen naar diagrammen die de luisteraar moet zien
    - GEEN afhankelijkheid van visuele positionering of kleur
    - GEEN operationele statusberichten in narratieve inhoud

Schrijf NU het complete luisternarratief voor dit verhaal in het Nederlands, als één samenhangende tekst zonder sectiekopjes (deze worden later toegevoegd bij assemblage).`;
}

/**
 * Generate a transition between stories
 */
async function generateTransition(
	currentStory: ListeningStoryContext,
	nextStory: ListeningStoryContext,
	input: ListeningNarrativeGenerationInput,
	llmClient: ReturnType<typeof createFreeLLMClient>,
	stats: {
		requests: number;
		tokens: number;
		providersUsed: string[];
		cacheHits: number;
	},
): Promise<NarrativeSegment> {
	const currentOrg = currentStory.candidate.organizations.join(", ");
	const currentDomain = translateDomainNLListening(
		currentStory.candidate.researchDomains[0] ?? "onbekend domein",
	);
	const nextOrg = nextStory.candidate.organizations.join(", ");
	const nextDomain = translateDomainNLListening(
		nextStory.candidate.researchDomains[0] ?? "onbekend domein",
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

	const prompt = `Je bent de stem van AI Daily Intelligence. Schrijf een natuurlijke overgang tussen twee verhalen in de luisterbriefing.

HUIDIG VERHAAL:
- Organisatie(s): ${currentOrg}
- Domein: ${currentDomain}

VOLGENDE VERHAAL:
- Organisatie(s): ${nextOrg}
- Domein: ${nextDomain}
- Feitelijke kop: ${nextHeadline}

GEDEELDE ELEMENTEN (voor eventuele verbinding):
- Gedeelde organisaties: ${sharedOrgs.length > 0 ? sharedOrgs.join(", ") : "geen"}
- Gedeelde technologieën: ${sharedTechs.length > 0 ? sharedTechs.join(", ") : "geen"}
- Gedeelde onderzoeksdomeinen: ${sharedDomains.length > 0 ? sharedDomains.join(", ") : "geen"}

VEREISTES:
1. Maak een NATUURLIJKE relatie waar een echte conceptuele verbinding bestaat.
2. Gebruik een DUIDELIJKE overgang wanneer onderwerpen verschillen.
3. Geef GEEN mechanische zinnen die tussen elk verhaal herhaald worden.
4. Geen editoriële commentaar over waarom een verhaal geselecteerd is.
5. Fabricerer GEEN verbindingen tussen ongerelateerde ontwikkelingen om een kunstmatig thema te creëren.
6. Korte heroriëntatie na cognitief veeleisende secties is toegestaan: herinner kort wat het probleem was, wat veranderd is, waarom het onderscheid belangrijk is.
7. Geschikt voor SpeechSynthesis — natuurlijke zinstructuur, geen URLs, geen citaties.
8. Maximaal 2-3 zinnen.

Schrijf NU de overgang in het Nederlands:`;

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
	input: ListeningNarrativeGenerationInput,
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
			content: `Dit was AI Daily Intelligence voor ${formatDutchDate(editionDate)}. Tot morgen bij de volgende briefing.`,
			claimIds: [],
			sourceIds: [],
		};
	}

	const storySummaries = stories
		.map((s, i) => {
			const org = s.candidate.organizations[0] ?? "onbekende organisatie";
			const domain = translateDomainNLListening(
				s.candidate.researchDomains[0] ?? "onbekend domein",
			);
			return `${i + 1}. ${org} (${domain}): ${s.candidate.factualHeadline}`;
		})
		.join("; ");

	const prompt = `Je bent de stem van AI Daily Intelligence. Schrijf de SLUITING van de luisterbriefing.

EDITIE: ${formatDutchDate(editionDate)}
VERHALEN IN DEZE EDITIE: ${storySummaries}

VEREISTES:
1. Eindig op een manier die NATUURLIJK VOLGT uit de daadwerkelijke ontwikkelingen.
2. Een conclusie KAN kort betekenisvolle implicaties verbinden WANNEER door bewijs ondersteund.
3. VEREIST GEEN: generieke architectuurles, verplichte lijst met principes, motiverende afsluiting, herhalende samenvatting van elk verhaal, gedwongen voorspelling over de toekomst.
4. Vendor-neutrale architectuurinzichten ALLEEN wanneer écht ondersteund door de geselecteerde ontwikkelingen en geautoriseerd door de editoriële contract.
5. Anders: sluit NATUURLIJK af.
6. Geschikt voor SpeechSynthesis — natuurlijke zinstructuur, geen URLs, geen citaties.
7. Maximaal 3-4 zinnen.

Schrijf NU de conclusie in het Nederlands:`;

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
				"Je bent de stem van AI Daily Intelligence, een Nederlandse dagelijkse luisterbriefing over AI-ontwikkelingen voor systemarchitecten en technische besluitvormers. Je spreekt natuurlijk, technisch diepgang, cognitief toegankelijk (ADHD-vriendelijk), en geschikt voor browser-native text-to-speech.",
		},
		{ role: "user" as const, content: prompt },
	];

	const response = await llmClient.request(messages, {
		temperature: 0.3,
		maxTokens: 3000,
		checkpointId: `listening-narrative-${segmentType}`,
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
	const dateFormatted = formatDutchDate(editionDate);

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
			lines.push(`## Verhaal ${storyIndex}`);
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
		"*Dit luisterverhaal is onafhankelijk geauthored vanuit het canoniek feiten dossier en de editoriële selectie manifest. Geen URLs, citatie-tekenreeksen of audit-terminologie. Geschreven voor een volwassen luisteraar zonder schermtoegang.*",
	);

	return lines.join("\n");
}

/**
 * Build traceability metadata
 */
function buildTraceability(
	segments: NarrativeSegment[],
	stories: ListeningStoryContext[],
): ListeningNarrativeGenerationResult["traceability"] {
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
 * Validate listening narrative output
 */
export function validateListeningNarrativeOutput(
	markdown: string,
	input: ListeningNarrativeGenerationInput,
): { valid: boolean; errors: string[]; warnings: string[] } {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check required structure
	if (!markdown.startsWith("# AI Daily Intelligence —")) {
		errors.push("Missing or incorrect title");
	}

	if (!markdown.includes("## Verhaal")) {
		warnings.push("No story sections found (## Verhaal N)");
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
		markdown.includes("[Luisterverhaal]") ||
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
		if (org && !markdown.includes(org)) {
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
		"figuur",
		"tabel",
		"grafiek",
		"afbeelding",
		"schema",
		"illustratie",
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
 * Compute content hash
 */
function computeContentHash(content: string): string {
	return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

/**
 * Count words in text
 */
function countWords(text: string): number {
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
			"listening-narrative",
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

/**
 * Format date in Dutch
 */
function formatDutchDate(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString("nl-NL", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

/**
 * Format date in Dutch
 */
export function formatDutchDateListening(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString("nl-NL", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

/**
 * Format edition window
 */
export function formatWindowListening(window: {
	start: string;
	end: string;
	timezone: string;
}): string {
	const start = parseTemporalTimestamp(window.start);
	const end = parseTemporalTimestamp(window.end);
	if (isNaN(start.getTime()) || isNaN(end.getTime())) {
		return "Ongeldig venster";
	}
	return `${start.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: window.timezone })}–${end.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: window.timezone })} ${window.timezone}`;
}

export function parseTemporalTimestamp(isoStr: string): Date {
	const cleaned = isoStr.replace(/\[.*?\]$/, "");
	return new Date(cleaned);
}

/**
 * Translate research domain to Dutch
 */
export function translateDomainNLListening(domain: string): string {
	const translations: Record<string, string> = {
		"agentic-ai-software-engineering": "Agentic AI & Software Engineering",
		"models-inference-scientific":
			"Modellen, Inferentie & Wetenschappelijk Onderzoek",
		"architecture-security-governance":
			"Architectuur, Beveiliging & Governance",
		"enterprise-adoption-organizational":
			"Enterprise AI Adoptie & Organisatie Transformatie",
		"economics-business-impact":
			"Economie, Business Impact & Strategische Intelligence",
		"independent-research-advisory":
			"Onafhankelijk Onderzoek & Advies Intelligence",
		"coding-agents-skills-mcp-hooks-plugins-apm":
			"Coding Agents, Skills, MCP, Hooks, Plugins & APM",
		"agent-orchestration-evaluation-reliability-observability":
			"Agent Orchestratie, Evaluatie, Betrouwbaarheid & Observabiliteit",
		"security-sandboxing-software-supply-chains":
			"Beveiliging, Sandboxing & Software Supply Chains",
		"developer-productivity-software-delivery":
			"Developer Productiviteit & Software Delivery",
		"enterprise-ai-adoption-organizational-transformation":
			"Enterprise AI Adoptie & Organisatie Transformatie",
	};
	return translations[domain] ?? domain;
}

/**
 * Get max verification level
 */
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

/**
 * Compute content hash
 */
export function computeContentHashListening(content: string): string {
	return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

/**
 * Count words in text
 */
export function countWordsListening(text: string): number {
	return text
		.trim()
		.split(/\s+/)
		.filter((w) => w.length > 0).length;
}
