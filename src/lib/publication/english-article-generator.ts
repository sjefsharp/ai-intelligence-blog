/**
 * English Website Article Generator
 *
 * Generates the English website article derivative (english-derivative) from
 * validated upstream inputs without mechanically translating the Dutch newsletter.
 *
 * Implements independent editorial composition per the publication contract:
 * - Consumes Canonical Fact Dossier (factual authority)
 * - Consumes Editorial Selection Manifest (selection authority)
 * - Consumes Historical Regression Report (historical context)
 * - Produces natural, technically accurate English for Astro website
 * - Maintains cross-language factual consistency with Dutch canonical publications
 */

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
import { generateArticleId, computeContentHash } from "./metadata.js";

/**
 * Story composition context loaded from upstream artifacts
 */
export interface EnglishArticleStoryContext {
	story: EditorialStory;
	candidate: CanonicalCandidate;
	assessment: EditorialCandidateAssessment;
	historicalRelationship: HistoricalRelationship | null;
	historicalClassification: HistoricalRelationshipClassification | null;
}

/**
 * Loaded upstream data for English article generation
 */
export interface EnglishArticleGenerationInput {
	editionDate: string;
	editionWindow: { start: string; end: string; timezone: string };
	factDossier: CanonicalFactDossier;
	editorialManifest: EditorialSelectionManifest;
	historicalRegression: HistoricalRegressionReport | null;
	stories: EnglishArticleStoryContext[];
}

/**
 * LLM-assisted article segment
 */
interface ArticleSegment {
	type: "lead" | "story" | "crosslink";
	content: string;
	claimIds: string[];
	sourceIds: string[];
	storyId?: string;
}

/**
 * Generation result
 */
export interface EnglishArticleGenerationResult {
	markdown: string;
	metadata: {
		contentHash: string;
		artifactId: string;
		readingTimeMinutes: number;
		wordCount: number;
		segmentCount: number;
		storiesCovered: number;
	};
	traceability: {
		segments: Array<{
			type: ArticleSegment["type"];
			claimIds: string[];
			sourceIds: string[];
			storyId?: string;
		}>;
		claimCoverage: string[];
		sourceCoverage: string[];
		storyCoverage: string[];
	};
	validation: {
		valid: boolean;
		errors: string[];
		warnings: string[];
	};
}

/**
 * Default LLM client configuration for article generation
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
 * Load and prepare English article generation input from upstream artifacts
 */
export async function loadEnglishArticleGenerationInput(
	editionDate: string,
	dataDir: string = "data",
): Promise<EnglishArticleGenerationInput> {
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
): EnglishArticleStoryContext[] {
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
 * Main entry point: Generate the complete English website article markdown
 */
export async function generateEnglishArticleMarkdown(
	input: EnglishArticleGenerationInput,
	options: {
		validateOnly?: boolean;
	} = {},
): Promise<EnglishArticleGenerationResult> {
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
		const mockMarkdown = generateMockEnglishArticle(
			editionDate,
			editionWindow,
			stories,
		);
		const contentHash = computeContentHash(mockMarkdown);
		const artifactId = `pubart_${cryptoRandomBytes(8)}`;
		const wordCount = countWords(mockMarkdown);
		const readingTimeMinutes = Math.ceil(wordCount / 200); // ~200 words per minute reading

		return {
			markdown: mockMarkdown,
			metadata: {
				contentHash,
				artifactId,
				readingTimeMinutes,
				wordCount,
				segmentCount: 1 + stories.length,
				storiesCovered: stories.length,
			},
			traceability: {
				segments: [
					{ type: "lead", claimIds: [], sourceIds: [] },
					...stories.map((s) => ({
						type: "story" as const,
						claimIds: s.candidate.claims.map((c) => c.claimId),
						sourceIds: s.candidate.sources.map(
							(src) => src.sourceId,
						),
						storyId: s.story.storyId,
					})),
				],
				claimCoverage: stories.flatMap((s) =>
					s.candidate.claims.map((c) => c.claimId),
				),
				sourceCoverage: stories.flatMap((s) =>
					s.candidate.sources.map((src) => src.sourceId),
				),
				storyCoverage: stories.map((s) => s.story.storyId),
			},
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

	let completedSegments: ArticleSegment[] = [];
	const llmStats = {
		requests: 0,
		tokens: 0,
		providersUsed: [] as string[],
		cacheHits: 0,
	};
	const errors: string[] = [];

	try {
		// Step 1: Generate lead article (comprehensive piece covering top stories)
		const leadSegment = await generateLeadArticle(
			input,
			llmClient,
			llmStats,
		);
		completedSegments.push(leadSegment);

		// Step 2: Generate individual story sections for each selected story
		for (let i = 0; i < stories.length; i++) {
			const story = stories[i];
			const storySegment = await generateStorySection(
				i + 1,
				story,
				input,
				llmClient,
				llmStats,
			);
			completedSegments.push(storySegment);
		}

		// Step 3: Generate cross-link navigation
		const crosslinkSegment = await generateCrossLinks(
			input,
			llmClient,
			llmStats,
		);
		completedSegments.push(crosslinkSegment);

		// Assemble final markdown
		const markdown = assembleMarkdown(
			editionDate,
			editionWindow,
			completedSegments,
		);

		// Validate output
		const outputValidation = validateEnglishArticleOutput(markdown, input);

		// Build traceability
		const traceability = buildTraceability(completedSegments, stories);

		// Compute metadata
		const wordCount = countWords(markdown);
		const readingTimeMinutes = Math.ceil(wordCount / 200);
		const contentHash = computeContentHash(markdown);
		const artifactId = `pubart_${cryptoRandomBytes(8)}`;

		return {
			markdown,
			metadata: {
				contentHash,
				artifactId,
				readingTimeMinutes,
				wordCount,
				segmentCount: completedSegments.length,
				storiesCovered: stories.length,
			},
			traceability,
			validation: outputValidation,
		};
	} catch (error) {
		errors.push(
			`${error instanceof Error ? error.message : String(error)}`,
		);
		throw error;
	}
}

/**
 * Generate the lead article — comprehensive piece integrating top developments
 */
async function generateLeadArticle(
	input: EnglishArticleGenerationInput,
	llmClient: ReturnType<typeof createFreeLLMClient>,
	stats: {
		requests: number;
		tokens: number;
		providersUsed: string[];
		cacheHits: number;
	},
): Promise<ArticleSegment> {
	const { editionDate, editionWindow, stories, editorialManifest } = input;

	if (stories.length === 0) {
		return {
			type: "lead",
			content: generateEmptyLead(editionDate, editionWindow),
			claimIds: [],
			sourceIds: [],
		};
	}

	const leadStory = stories[0];
	const leadCandidate = leadStory.candidate;
	const leadAssessment = leadStory.assessment;

	// Build prompt for LLM to generate a natural, article-first lead
	const prompt = buildLeadArticlePrompt(
		leadCandidate,
		leadAssessment,
		leadStory.story,
		editionWindow,
		stories.length,
		editorialManifest,
	);

	const response = await callLLMWithRetry(
		llmClient,
		prompt,
		stats,
		"lead-article",
	);

	return {
		type: "lead",
		content: response.content,
		claimIds: leadCandidate.claims.map((c) => c.claimId),
		sourceIds: leadCandidate.sources.map((s) => s.sourceId),
	};
}

/**
 * Build the prompt for the lead article
 */
function buildLeadArticlePrompt(
	leadCandidate: CanonicalCandidate,
	leadAssessment: EditorialCandidateAssessment,
	leadStory: EditorialStory,
	editionWindow: { start: string; end: string; timezone: string },
	storyCount: number,
	editorialManifest: EditorialSelectionManifest,
): string {
	const org = leadCandidate.organizations.join(", ");
	const domain = translateDomainEN(
		leadCandidate.researchDomains[0] ?? "unknown domain",
	);
	const headline = leadCandidate.factualHeadline;
	const windowStr = formatWindowEN(editionWindow);

	// Build context for all stories for integration
	const storySummaries = editorialManifest.stories
		.filter(
			(s) =>
				s.decision === "SELECTED" || s.decision === "CATCH_UP_SELECTED",
		)
		.slice(0, 5)
		.map(
			(s, i) =>
				`${i + 1}. ${s.organizations.join(", ")} (${translateDomainEN(s.researchDomains[0] ?? "unknown")}): ${s.summary}`,
		)
		.join("\n");

	return `You are an AI Intelligence editor writing for system architects and technical decision-makers. Write the LEAD ARTICLE for today's edition — a coherent, independently authored English website article that integrates the most consequential AI developments.

CONTEXT:
- Edition date: ${leadCandidate.editionDate}
- Reporting window: ${windowStr}
- Number of selected stories: ${storyCount}

LEADING DEVELOPMENT (Story 1):
- Organization(s): ${org}
- Domain: ${domain}
- Factual headline: ${headline}
- Exact statement of what changed: ${leadCandidate.exactStatement}
- Materiality: ${leadAssessment.materialityLevel} (score: ${leadAssessment.materialityScore.toFixed(2)})
- Evidence sufficiency: ${leadAssessment.eligibility.evidenceSufficiency}
- Temporal status: ${leadAssessment.eligibility.temporalStatus}

ALL SELECTED STORIES (for integration):
${storySummaries}

REQUIREMENTS FOR THE LEAD ARTICLE:
1. OPEN WITH CONCRETE NEWS: Start with the specific development that matters most. No generic intros, no "in this edition" formulas.
2. ESTABLISH SIGNIFICANCE IMMEDIATELY: Explain WHY this matters to architects and technical leaders — concrete consequences, not abstract importance.
3. PROVIDE CONTEXT BEFORE COMPLEXITY: Give the reader enough background to understand the development before introducing technical mechanisms.
4. INTEGRATE MULTIPLE STORIES NATURALLY: When covering additional stories, connect them through genuine conceptual relationships (shared organizations, technologies, domains, or causal links). Use clear transitions when topics shift.
5. TECHNICAL DEPTH WITH PROGRESSIVE DISCLOSURE: Explain mechanisms, architectures, and research methodologies by building from known concepts to novel details. Preserve precise terminology; explain on first meaningful use.
6. PRESERVE EVIDENCE DISTINCTIONS: Distinguish verified facts, vendor claims, research findings, original reporting, expert interpretations, inferences, speculation, and unverified information. Use natural English phrasing (e.g., "according to the company's own benchmarks," "independent replication is pending").
7. MAINTAIN LIMITATIONS AND UNCERTAINTY: Include material caveats, counterevidence, availability/maturity constraints, and unresolved questions.
8. PRESERVE TEMPORAL AND HISTORICAL INTEGRITY: Respect upstream temporal eligibility and historical regression decisions. Distinguish original event date, first public disclosure, publication timestamp, substantive updates, and previously established information.
9. VENDOR-NEUTRAL EDITORIAL JUDGMENT: Do not automatically prioritize GitHub, Copilot, VS Code, or coding agents beyond their editorial significance. Scientific breakthroughs, security findings, economic developments, and strategic research may legitimately lead.
10. ADHD-FRIENDLY COGNITIVE ACCESSIBILITY: One central concept at a time. Clear causal relationships. Manageable information density. Descriptive headings. Short paragraphs. Predictable progression.
11. WEBSITE ARTICLE FORMAT: Use Markdown with descriptive headings (##, ###). No spoken URLs, citation strings, or audit terminology. Include original source URLs in a References section at the end.
12. PROFESSIONAL NATURAL ENGLISH: Write for technically interested adults. Avoid literal Dutch sentence structures, machine-translation artifacts, artificially simplified language, generic AI marketing language, excessive jargon without explanation, unsupported enthusiasm, repetitive editorial commentary.

Write the COMPLETE LEAD ARTICLE now in English:`;
}

/**
 * Generate a story section — detailed coverage of one selected development
 */
async function generateStorySection(
	index: number,
	context: EnglishArticleStoryContext,
	input: EnglishArticleGenerationInput,
	llmClient: ReturnType<typeof createFreeLLMClient>,
	stats: {
		requests: number;
		tokens: number;
		providersUsed: string[];
		cacheHits: number;
	},
): Promise<ArticleSegment> {
	const {
		story,
		candidate,
		assessment,
		historicalRelationship,
		historicalClassification,
	} = context;

	const prompt = buildStorySectionPrompt(
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
		`story-section-${index}`,
	);

	return {
		type: "story",
		content: response.content,
		claimIds: candidate.claims.map((c) => c.claimId),
		sourceIds: candidate.sources.map((s) => s.sourceId),
		storyId: story.storyId,
	};
}

/**
 * Build the prompt for a story section
 */
function buildStorySectionPrompt(
	index: number,
	story: EditorialStory,
	candidate: CanonicalCandidate,
	assessment: EditorialCandidateAssessment,
	historicalRelationship: HistoricalRelationship | null,
	historicalClassification: HistoricalRelationshipClassification | null,
	input: EnglishArticleGenerationInput,
): string {
	const org = candidate.organizations.join(", ");
	const domain = translateDomainEN(
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
			"Note: one or more claims originate from the vendor without independent verification. ";
	}
	if (evidenceClasses.has("EXPERT_INTERPRETATION")) {
		limitationsContext +=
			"Conclusions are based on expert analysis, not direct measurement or replication. ";
	}
	const maxLevel = getMaxVerificationLevel(
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

	return `You are an AI Intelligence editor. Write a DETAILED STORY SECTION for Story ${index} of this edition.

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

REQUIREMENTS FOR THE STORY SECTION:
1. INDEPENDENT COMPOSITION: Generate DIRECTLY from the fact dossier and editorial selection. Do NOT summarize, shorten, read aloud, or paraphrase the Dutch newsletter (publication.md). Use a different structure and explanation suited for the written article medium.

2. STORYTELLING STRUCTURE (per development):
   A. ESTABLISH CONTEXT: Introduce the practical, scientific, or organizational problem. Explain sufficient background so the reader understands the significance without prior knowledge.
   B. REVEAL WHAT CHANGED: Describe the precise newly disclosed information. Distinguish the new development from established background.
   C. EXPLAIN HOW IT WORKS: Introduce the technical mechanism, scientific finding, or organizational process. Build explanation progressively from known concepts to unfamiliar details.
   D. EXPLAIN WHY IT MATTERS: Describe practical, technical, strategic, or economic consequences supported by evidence.
   E. PRESERVE LIMITATIONS: Explain important caveats, uncertainties, counterevidence, and maturity constraints.
   F. NATURAL TRANSITION: Connect to the next development through a meaningful relationship or clear topic shift.

3. COGNITIVE ACCESSIBILITY (ADHD-friendly):
   - One central concept at a time
   - Context BEFORE complex mechanisms
   - Clear causal relationships
   - Manageable information density
   - Gradual introduction of unfamiliar terminology
   - Short, natural explanatory prose
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
   - Convert dense benchmark descriptions into comprehensible written explanations

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

10. WEBSITE ARTICLE FORMAT:
    - Descriptive Markdown headings (##, ###)
    - Natural written punctuation
    - Clear language metadata
    - Predictable reading order
    - Correct handling of abbreviations and technical names
    - Original source URLs in References section
    - NO unnecessary Markdown syntax that would hinder reading
    - NO spoken citation identifiers
    - NO references to diagrams the reader must see
    - NO dependence on visual layout or color
    - NO operational status messages in narrative content

Write the COMPLETE STORY SECTION now in English, as a cohesive text with appropriate headings (use ## for story heading, ### for subsections).`;
}

/**
 * Generate cross-link navigation section
 */
async function generateCrossLinks(
	input: EnglishArticleGenerationInput,
	llmClient: ReturnType<typeof createFreeLLMClient>,
	stats: {
		requests: number;
		tokens: number;
		providersUsed: string[];
		cacheHits: number;
	},
): Promise<ArticleSegment> {
	const { editionDate, stories } = input;

	const storySummaries = stories
		.map((s, i) => {
			const org = s.candidate.organizations[0] ?? "unknown organization";
			const domain = translateDomainEN(
				s.candidate.researchDomains[0] ?? "unknown domain",
			);
			return `${i + 1}. ${org} (${domain}): ${s.candidate.factualHeadline}`;
		})
		.join("; ");

	const prompt = `You are an AI Intelligence editor. Write the CROSS-LINK section at the end of the article.

EDITION: ${formatDateEN(editionDate)}
STORIES IN THIS EDITION: ${storySummaries}

REQUIREMENTS:
1. Provide natural navigation to related content (research audit, listening narrative, topic pages).
2. End in a way that NATURALLY FOLLOWS from the actual developments.
3. A conclusion MAY briefly connect meaningful implications WHEN supported by evidence.
4. Do NOT require: generic architecture lesson, mandatory principles list, motivational closing, repetitive story summary, forced future prediction.
5. Vendor-neutral architectural insights ONLY when genuinely supported by the selected developments and authorized by editorial contract.
6. Otherwise: end NATURALLY.
7. Website article format — natural written prose, no spoken URLs, no citations.

Write the CROSS-LINK section now in English:`;

	const response = await callLLMWithRetry(
		llmClient,
		prompt,
		stats,
		"crosslinks",
	);

	return {
		type: "crosslink",
		content: response.content,
		claimIds: [],
		sourceIds: [],
	};
}

/**
 * Assemble final markdown from segments
 */
function assembleMarkdown(
	editionDate: string,
	editionWindow: { start: string; end: string; timezone: string },
	segments: ArticleSegment[],
): string {
	const dateFormatted = formatDateEN(editionDate);
	const windowStr = formatWindowEN(editionWindow);

	const lines: string[] = [
		`# AI Intelligence — ${dateFormatted}`,
		"",
		`*Reporting window: ${windowStr}*`,
		"",
	];

	// Lead article
	const leadSegment = segments.find((s) => s.type === "lead");
	if (leadSegment) {
		lines.push(leadSegment.content);
		lines.push("", "---", "");
	}

	// Story sections
	for (const segment of segments) {
		if (segment.type === "story") {
			lines.push(segment.content);
			lines.push("", "---", "");
		}
	}

	// Cross-links
	const crosslinkSegment = segments.find((s) => s.type === "crosslink");
	if (crosslinkSegment) {
		lines.push("## Further Reading");
		lines.push("");
		lines.push(crosslinkSegment.content);
		lines.push("");
	}

	// References
	lines.push("## References");
	lines.push("");
	lines.push(
		"*This article is independently authored from the canonical fact dossier and editorial selection manifest. All factual claims are traceable to original sources via claim identifiers.*",
	);
	lines.push("");
	lines.push("---");
	lines.push("");
	lines.push("**Canonical Dutch publications for this edition:**");
	lines.push(
		`- [Technical Newsletter (NL)](../canonical/publication.md) — Nederlandse technische nieuwsbrief`,
	);
	lines.push(
		`- [Research Audit (NL)](../canonical/research-audit.md) — Technisch bewijs en editoriële verantwoording`,
	);
	lines.push(
		`- [Listening Narrative (NL)](../canonical/AI Daily Intelligence — ${editionDate}.md) — Volledig Nederlandse luisternarratief`,
	);

	return lines.join("\n");
}

/**
 * Build traceability metadata
 */
function buildTraceability(
	segments: ArticleSegment[],
	stories: EnglishArticleStoryContext[],
): EnglishArticleGenerationResult["traceability"] {
	const claimCoverage = new Set<string>();
	const sourceCoverage = new Set<string>();
	const storyCoverage = new Set<string>();

	for (const segment of segments) {
		for (const claimId of segment.claimIds) claimCoverage.add(claimId);
		for (const sourceId of segment.sourceIds) sourceCoverage.add(sourceId);
		if (segment.storyId) storyCoverage.add(segment.storyId);
	}

	return {
		segments: segments.map((s) => ({
			type: s.type,
			claimIds: s.claimIds,
			sourceIds: s.sourceIds,
			storyId: s.storyId,
		})),
		claimCoverage: Array.from(claimCoverage),
		sourceCoverage: Array.from(sourceCoverage),
		storyCoverage: Array.from(storyCoverage),
	};
}

/**
 * Validate English article output
 */
export function validateEnglishArticleOutput(
	markdown: string,
	input: EnglishArticleGenerationInput,
): { valid: boolean; errors: string[]; warnings: string[] } {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check required structure
	if (!markdown.startsWith("# AI Intelligence —")) {
		errors.push("Missing or incorrect title");
	}

	if (!markdown.includes("## Further Reading")) {
		warnings.push("Missing cross-link/navigation section");
	}

	if (!markdown.includes("## References")) {
		warnings.push("Missing references section");
	}

	// Check for forbidden elements in written content (less strict than audio)
	if (
		markdown.includes("claim_") ||
		markdown.includes("cand_") ||
		markdown.includes("disc_") ||
		markdown.includes("ev_")
	) {
		warnings.push(
			"Citation identifiers found in article — should only appear in metadata, not narrative",
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

	// Check for source URLs
	if (!markdown.includes("http")) {
		warnings.push("No source URLs found in output");
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
	};
}

/**
 * Generate mock English article for validation mode
 */
function generateMockEnglishArticle(
	editionDate: string,
	editionWindow: { start: string; end: string; timezone: string },
	stories: EnglishArticleStoryContext[],
): string {
	const dateFormatted = formatDateEN(editionDate);
	const windowStr = formatWindowEN(editionWindow);

	let markdown = `# AI Intelligence — ${dateFormatted}\n\n*Reporting window: ${windowStr}*\n\n`;

	if (stories.length === 0) {
		markdown += `This edition of **AI Intelligence** covers the past 24 hours (${windowStr}). No developments were selected that meet the materiality threshold.\n\n`;
	} else {
		markdown += `This edition of **AI Intelligence** examines the most consequential AI developments from the past 24 hours (${windowStr}). ${stories.length} stories have been selected based on material novelty, technical significance, and real-world impact.\n\n`;

		const leadStory = stories[0];
		const leadOrg =
			leadStory.candidate.organizations[0] ?? "an organization";
		const leadDomain = translateDomainEN(
			leadStory.candidate.researchDomains[0] ?? "a domain",
		);
		const leadHeadline = leadStory.candidate.factualHeadline;

		markdown += `The lead development concerns **${leadOrg}** in **${leadDomain}**: ${leadHeadline.toLowerCase()}.\n\n`;

		if (stories.length > 1) {
			const otherTopics = stories
				.slice(1, 4)
				.map(
					(s) =>
						`${s.candidate.organizations[0] ?? "unknown"} (${translateDomainEN(s.candidate.researchDomains[0] ?? "unknown")})`,
				)
				.join(", ");
			markdown += `Also in this edition: ${otherTopics}${stories.length > 4 ? ` and ${stories.length - 4} other developments` : ""}.\n\n`;
		}

		markdown += "---\n\n";

		for (let i = 0; i < stories.length; i++) {
			const story = stories[i];
			const org = story.candidate.organizations.join(", ");
			const domain = translateDomainEN(
				story.candidate.researchDomains[0] ?? "unknown domain",
			);
			markdown += `## ${i + 1}. ${org} — ${domain}\n\n`;
			markdown += `**[VALIDATION MODE]** Synthetic story narrative for testing. ${story.candidate.organizations.join(", ")} in ${domain}.\n\n`;
			markdown += "---\n\n";
		}

		markdown += "## Further Reading\n\n";
		markdown +=
			"See the Research Audit for technical evidence and editorial accountability. The Listening Narrative provides a complete audio-first version of this edition.\n\n";
		markdown += "---\n\n";
	}

	markdown += "## References\n\n";
	markdown +=
		"*This article is independently authored from the canonical fact dossier and editorial selection manifest. All factual claims are traceable to original sources via claim identifiers.*\n\n";
	markdown += "---\n\n";
	markdown += "**Canonical Dutch publications for this edition:**\n";
	markdown += `- [Technical Newsletter (NL)](../canonical/publication.md) — Nederlandse technische nieuwsbrief\n`;
	markdown += `- [Research Audit (NL)](../canonical/research-audit.md) — Technisch bewijs en editoriële verantwoording\n`;
	markdown += `- [Listening Narrative (NL)](../canonical/AI Daily Intelligence — ${editionDate}.md) — Volledig Nederlandse luisternarratief\n`;

	return markdown;
}

// ============================================================================
// Helper functions (exported for testing)
// ============================================================================

export function formatDateEN(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

export function formatWindowEN(window: {
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

export function translateDomainEN(domain: string): string {
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

export function getMaxVerificationLevel(
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

export function countWords(text: string): number {
	return text
		.trim()
		.split(/\s+/)
		.filter((w) => w.length > 0).length;
}

export function cryptoRandomBytes(bytes: number): string {
	const array = new Uint8Array(bytes);
	crypto.getRandomValues(array);
	return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
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
				"You are an AI Intelligence editor writing for system architects and technical decision-makers. You write natural, technically precise English with cognitive accessibility (ADHD-friendly), suitable for a professional website article. You preserve evidence distinctions, limitations, and uncertainty. You do not use marketing language, artificial enthusiasm, or vendor-biased framing.",
		},
		{ role: "user" as const, content: prompt },
	];

	const response = await llmClient.request(messages, {
		temperature: 0.3,
		maxTokens: 4000,
		checkpointId: `english-article-${segmentType}`,
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
 * Generate empty lead for editions with no stories
 */
function generateEmptyLead(
	editionDate: string,
	editionWindow: { start: string; end: string; timezone: string },
): string {
	const windowStr = formatWindowEN(editionWindow);
	return `This edition of **AI Intelligence** covers the past 24 hours (${windowStr}). No developments were selected that meet the materiality threshold for publication.`;
}
