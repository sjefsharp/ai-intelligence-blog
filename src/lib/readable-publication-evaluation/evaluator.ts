/**
 * Readable Publication Quality Evaluation — Core Evaluator
 *
 * Implements the RPE1-RPE14 readable publication quality evaluation framework for
 * the Dutch canonical publication (publication.md) and English website article
 * derivative (english-derivative). Combines deterministic checks with
 * model-assisted editorial assessments.
 */

import { createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { CanonicalFactDossier } from "../fact-dossier/schema.js";
import type { EditorialSelectionManifest } from "../editorial-selection/schema.js";
import type { HistoricalRegressionReport } from "../historical-regression/schema.js";
import type {
	ArticleIdentity,
	PublicationMetadata,
} from "../publication/schema.js";
import type { VisualizationSpecification } from "../visualization/schema.js";
import {
	createFreeLLMClient,
	type LLMClientConfig,
} from "../free-llm-client.js";
import {
	READABLE_QUALITY_EVALUATION_SCHEMA_VERSION,
	READABLE_EVALUATION_REPORT_ID_PREFIX,
	READABLE_CRITERION_EVALUATION_ID_PREFIX,
	READABLE_REPAIR_ACTION_ID_PREFIX,
	READABLE_CRITERIA,
	CriterionEvaluationStatusSchema,
	SeverityLevelSchema,
	type ReadableCriterionId,
	type CriterionEvaluationStatus,
	type SeverityLevel,
	type EvaluationMethod,
	type RepairActionStatus,
	type EvaluationLanguage,
	type ReadableCriterionEvaluation,
	type ReadableRepairAction,
	type ReadableQualityEvaluationReport,
	type ReadableQualityEvaluationInput,
	type OverallSummary,
	type EvaluationMetadata,
	type PassageReference,
	type EvaluationEvidence,
	ReadableQualityEvaluationReportSchema,
} from "./schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..", "..", "..");
const DATA_DIR = join(PROJECT_ROOT, "data");
const EVALUATION_DIR = join(DATA_DIR, "readable-quality-evaluations");
const CHECKPOINT_DIR = join(
	DATA_DIR,
	"checkpoints",
	"readable-quality-evaluation",
);

// ============================================================================
// Helper Types
// ============================================================================

interface EvaluationContext {
	editionDate: string;
	editionId: string;
	dutchPublicationMarkdown: string;
	dutchPublicationArtifactId: string;
	dutchPublicationTraceability: ReadableQualityEvaluationInput["dutchPublicationTraceability"];
	englishPublicationMarkdown: string | undefined;
	englishPublicationArtifactId: string | undefined;
	englishPublicationTraceability:
		| ReadableQualityEvaluationInput["englishPublicationTraceability"]
		| undefined;
	factDossier: CanonicalFactDossier;
	editorialManifest: EditorialSelectionManifest;
	historicalRegression: HistoricalRegressionReport | null;
	publicationMetadata: PublicationMetadata;
	articleIdentities: ArticleIdentity[];
	visualizations: VisualizationSpecification[];
	validationMode: boolean;
	llmClient: ReturnType<typeof createFreeLLMClient>;
	criterionEvaluations: ReadableCriterionEvaluation[];
	repairActions: ReadableRepairAction[];
	llmStats: {
		requests: number;
		tokens: number;
		providersUsed: string[];
		cacheHits: number;
	};
}

interface DeterministicCheckResult {
	passed: boolean;
	details: string;
	passageReferences: PassageReference[];
	evidence: EvaluationEvidence[];
}

// ============================================================================
// Default LLM Configuration
// ============================================================================

function getDefaultLLMConfig(): LLMClientConfig {
	return createFreeLLMClient({
		budget: { maxRequests: 40, maxTokens: 100000, maxCostUsd: 0 },
		deterministic: true,
		enableCache: true,
		enableCheckpoints: true,
	}).getConfig();
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateEvaluationId(): string {
	return `${READABLE_CRITERION_EVALUATION_ID_PREFIX}${randomBytes(8).toString("hex")}`;
}

function generateRepairActionId(): string {
	return `${READABLE_REPAIR_ACTION_ID_PREFIX}${randomBytes(8).toString("hex")}`;
}

function generateReportId(): string {
	return `${READABLE_EVALUATION_REPORT_ID_PREFIX}${randomBytes(8).toString("hex")}`;
}

function computeContentHash(content: string): string {
	return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

function findPassageReferences(
	markdown: string,
	searchTerms: (string | RegExp)[],
	maxRefs: number = 5,
): PassageReference[] {
	const refs: PassageReference[] = [];
	const lines = markdown.split("\n");

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		for (const term of searchTerms) {
			let match = false;
			let matchIndex = -1;
			if (term instanceof RegExp) {
				const regexMatch = line.match(term);
				if (regexMatch) {
					match = true;
					matchIndex = regexMatch.index || 0;
				}
			} else if (line.toLowerCase().includes(term.toLowerCase())) {
				match = true;
				matchIndex = line.toLowerCase().indexOf(term.toLowerCase());
			}

			if (match) {
				const charOffset =
					lines.slice(0, i).join("\n").length +
					Math.max(0, matchIndex);
				refs.push({
					characterOffset: Math.max(0, charOffset),
					lineNumber: i + 1,
					sectionHeading: findCurrentSection(lines, i),
					quote: line.trim().slice(0, 200),
				});
				if (refs.length >= maxRefs) return refs;
			}
		}
	}
	return refs;
}

function findCurrentSection(
	lines: string[],
	lineIndex: number,
): string | undefined {
	for (let i = lineIndex; i >= 0; i--) {
		const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
		if (match) return match[2].trim();
	}
	return undefined;
}

async function callLLMWithRetry(
	ctx: EvaluationContext,
	prompt: string,
	segmentType: string,
): Promise<{ content: string; cached: boolean }> {
	const messages = [
		{
			role: "system" as const,
			content:
				"Je bent een expert editor die leesbare publicaties evalueert op eerste-scherm helderheid, progressieve openbaarmaking, cognitieve toegankelijkheid (ADHD-vriendelijk), technische diepgang, wetenschappelijke kwaliteit, feitelijke getrouwheid, brontransparantie, editoriële coherentie, leveranciersneutraliteit, visuele integratie, WCAG 2.2 AA toegankelijkheid, en tweetalige kwaliteit. Je antwoordeert in het Nederlands met gestructureerde, bewijs-gebaseerde bevindingen.",
		},
		{ role: "user" as const, content: prompt },
	];

	const response = await ctx.llmClient.request(messages, {
		temperature: 0.1,
		maxTokens: 4000,
		checkpointId: `rqe-${segmentType}`,
	});

	ctx.llmStats.requests++;
	ctx.llmStats.tokens += response.tokensUsed.total;
	if (!ctx.llmStats.providersUsed.includes(response.provider)) {
		ctx.llmStats.providersUsed.push(response.provider);
	}
	if (response.cached) ctx.llmStats.cacheHits++;

	return { content: response.content.trim(), cached: response.cached };
}

// ============================================================================
// Deterministic Checks
// ============================================================================

/**
 * RPE1: Check first-screen clarity and immediate orientation.
 */
function checkFirstScreenClarity(
	ctx: EvaluationContext,
): DeterministicCheckResult {
	const refs: PassageReference[] = [];
	const evidence: EvaluationEvidence[] = [];
	let passed = true;

	// Check for edition date visibility
	const datePattern = /\d{4}-\d{2}-\d{2}|\d{1,2}\s+\w+\s+\d{4}/;
	const hasEditionDate = datePattern.test(
		ctx.dutchPublicationMarkdown.slice(0, 1000),
	);

	// Check for concrete news lead (first story organization mentioned early)
	const firstStoryOrg = ctx.editorialManifest.stories[0]?.organizations[0];
	const hasConcreteLead = firstStoryOrg
		? ctx.dutchPublicationMarkdown
				.slice(0, 2000)
				.toLowerCase()
				.includes(firstStoryOrg.toLowerCase())
		: true;

	// Check for generic intro patterns
	const genericPatterns = [
		/welkom bij/i,
		/in deze editie/i,
		/vandaag hebben we/i,
		/goedemorgen.*dit is/i,
		/deze briefing belicht/i,
	];

	let hasGenericIntro = false;
	for (const pattern of genericPatterns) {
		if (pattern.test(ctx.dutchPublicationMarkdown.slice(0, 1000))) {
			hasGenericIntro = true;
			break;
		}
	}

	if (!hasEditionDate) {
		passed = false;
		evidence.push({
			type: "deterministic",
			description: "Editie datum niet zichtbaar in openings scherm",
			passageReferences: [],
			claimIds: [],
			sourceIds: [],
		});
	}

	if (hasGenericIntro && !hasConcreteLead) {
		passed = false;
		evidence.push({
			type: "deterministic",
			description: "Generieke intro zonder concrete leidende nieuws",
			passageReferences: findPassageReferences(
				ctx.dutchPublicationMarkdown,
				[""],
			),
			claimIds: [],
			sourceIds: [],
		});
	}

	if (!hasConcreteLead && ctx.editorialManifest.stories.length > 0) {
		passed = false;
		evidence.push({
			type: "deterministic",
			description:
				"Opening noemt leidende organisatie uit editoriële selectie niet",
			passageReferences: [],
			claimIds: [],
			sourceIds: [],
		});
	}

	// Check heading hierarchy
	const headings =
		ctx.dutchPublicationMarkdown.match(/^#{1,6}\s+.+$/gm) || [];
	const hasH1 = headings.some((h) => h.startsWith("# "));
	const hasH2 = headings.some((h) => h.startsWith("## "));

	if (!hasH1 || !hasH2) {
		passed = false;
		evidence.push({
			type: "deterministic",
			description: "Ontbrekende kopstructuur (H1/H2) in openings scherm",
			passageReferences: [],
			claimIds: [],
			sourceIds: [],
		});
	}

	return {
		passed,
		details: passed
			? "Eerste scherm biedt heldere oriëntatie met concrete nieuws lead"
			: "Eerste scherm tekortkomingen in helderheid of oriëntatie",
		passageReferences: refs,
		evidence,
	};
}

/**
 * RPE6: Check factual consistency against canonical dossier.
 */
function checkFactualConsistency(
	ctx: EvaluationContext,
): DeterministicCheckResult {
	const refs: PassageReference[] = [];
	const evidence: EvaluationEvidence[] = [];
	let passed = true;

	// Check that candidate organizations appear in Dutch publication
	const allOrgs = new Set<string>();
	for (const candidate of ctx.factDossier.candidates) {
		for (const org of candidate.organizations) {
			allOrgs.add(org);
		}
	}

	for (const org of allOrgs) {
		if (
			!ctx.dutchPublicationMarkdown
				.toLowerCase()
				.includes(org.toLowerCase())
		) {
			passed = false;
			evidence.push({
				type: "deterministic",
				description: `Organisatie "${org}" uit feiten dossier niet in Nederlandse publicatie`,
				passageReferences: [],
				claimIds: [],
				sourceIds: [],
			});
		}
	}

	// Check that claim IDs are referenced in traceability
	const traceabilityClaims = new Set(
		ctx.dutchPublicationTraceability.claimCoverage,
	);
	for (const candidate of ctx.factDossier.candidates) {
		for (const claim of candidate.claims) {
			if (!traceabilityClaims.has(claim.claimId)) {
				evidence.push({
					type: "deterministic",
					description: `Claim ${claim.claimId} niet in traceability van Nederlandse publicatie`,
					passageReferences: [],
					claimIds: [claim.claimId],
					sourceIds: [],
				});
			}
		}
	}

	// Check English publication if present
	if (ctx.englishPublicationMarkdown && ctx.englishPublicationTraceability) {
		const enTraceabilityClaims = new Set(
			ctx.englishPublicationTraceability.claimCoverage,
		);
		for (const candidate of ctx.factDossier.candidates) {
			for (const claim of candidate.claims) {
				if (!enTraceabilityClaims.has(claim.claimId)) {
					evidence.push({
						type: "deterministic",
						description: `Claim ${claim.claimId} niet in traceability van Engelse publicatie`,
						passageReferences: [],
						claimIds: [claim.claimId],
						sourceIds: [],
					});
				}
			}
		}
	}

	return {
		passed,
		details: passed
			? "Feitelijke consistentie met dossier geverifieerd"
			: "Afwijkingen ten opzichte van feiten dossier",
		passageReferences: refs,
		evidence,
	};
}

/**
 * RPE6: Check selected story coverage.
 */
function checkSelectedStoryCoverage(
	ctx: EvaluationContext,
): DeterministicCheckResult {
	const selectedStories = ctx.editorialManifest.stories.filter(
		(s) => s.decision === "SELECTED" || s.decision === "CATCH_UP_SELECTED",
	);

	const refs: PassageReference[] = [];
	const evidence: EvaluationEvidence[] = [];
	let passed = true;

	for (const story of selectedStories) {
		const orgNames = story.organizations.join(" ");
		const matches = findPassageReferences(ctx.dutchPublicationMarkdown, [
			orgNames,
		]);
		if (matches.length === 0) {
			passed = false;
			evidence.push({
				type: "deterministic",
				description: `Geselecteerde story ${story.storyId} (${orgNames}) niet gevonden in Nederlandse publicatie`,
				passageReferences: [],
				claimIds: story.claimIds,
				sourceIds: story.sourceIds,
			});
		} else {
			refs.push(...matches);
		}

		// Also check English if present
		if (ctx.englishPublicationMarkdown) {
			const enMatches = findPassageReferences(
				ctx.englishPublicationMarkdown,
				[orgNames],
			);
			if (enMatches.length === 0) {
				passed = false;
				evidence.push({
					type: "deterministic",
					description: `Geselecteerde story ${story.storyId} (${orgNames}) niet gevonden in Engelse publicatie`,
					passageReferences: [],
					claimIds: story.claimIds,
					sourceIds: story.sourceIds,
				});
			}
		}
	}

	return {
		passed,
		details: passed
			? `Alle ${selectedStories.length} geselecteerde verhalen gedekt in beide talen`
			: `${selectedStories.length - refs.length} geselecteerde verhalen ontbreken`,
		passageReferences: refs,
		evidence,
	};
}

/**
 * RPE7: Check for source references in publications.
 */
function checkSourceTransparency(
	ctx: EvaluationContext,
): DeterministicCheckResult {
	const refs: PassageReference[] = [];
	const evidence: EvaluationEvidence[] = [];
	let passed = true;

	// Check for source URLs in Dutch publication
	const urlPattern = /https?:\/\/[^\s]+/g;
	const urls = ctx.dutchPublicationMarkdown.match(urlPattern) || [];

	// Check for explicit source section
	const hasSourceSection =
		/## Bronnen|#### Bronnen|## References|### Bronnen/i.test(
			ctx.dutchPublicationMarkdown,
		);

	if (urls.length === 0 && ctx.factDossier.candidates.length > 0) {
		passed = false;
		evidence.push({
			type: "deterministic",
			description: "Geen bron URLs gevonden in Nederlandse publicatie",
			passageReferences: [],
			claimIds: [],
			sourceIds: [],
		});
	}

	if (!hasSourceSection && ctx.factDossier.candidates.length > 0) {
		evidence.push({
			type: "deterministic",
			description:
				"Geen expliciete bronnen sectie in Nederlandse publicatie",
			passageReferences: [],
			claimIds: [],
			sourceIds: [],
		});
	}

	// Check English publication
	if (ctx.englishPublicationMarkdown) {
		const enUrls = ctx.englishPublicationMarkdown.match(urlPattern) || [];
		const enHasSourceSection =
			/## References|## Bronnen|### References/i.test(
				ctx.englishPublicationMarkdown,
			);

		if (enUrls.length === 0 && ctx.factDossier.candidates.length > 0) {
			passed = false;
			evidence.push({
				type: "deterministic",
				description: "Geen bron URLs gevonden in Engelse publicatie",
				passageReferences: [],
				claimIds: [],
				sourceIds: [],
			});
		}

		if (!enHasSourceSection && ctx.factDossier.candidates.length > 0) {
			evidence.push({
				type: "deterministic",
				description:
					"Geen expliciete bronnen sectie in Engelse publicatie",
				passageReferences: [],
				claimIds: [],
				sourceIds: [],
			});
		}
	}

	return {
		passed,
		details: passed
			? "Bronverwijzingen aanwezig in beide publicaties"
			: "Ontbrekende bronverwijzingen of bronnen secties",
		passageReferences: refs,
		evidence,
	};
}

/**
 * RPE3: Check for ADHD-aware cognitive accessibility indicators.
 */
function checkCognitiveAccessibility(
	ctx: EvaluationContext,
): DeterministicCheckResult {
	const refs: PassageReference[] = [];
	const evidence: EvaluationEvidence[] = [];
	let passed = true;

	// Check for short paragraphs (max ~4 sentences)
	const paragraphs = ctx.dutchPublicationMarkdown.split(/\n\s*\n/);
	let longParagraphs = 0;
	for (const para of paragraphs) {
		// Skip headings and empty paragraphs
		if (para.trim().startsWith("#") || para.trim().length === 0) continue;
		const sentences = para.match(/[.!?]+/g) || [];
		if (sentences.length > 6) {
			longParagraphs++;
		}
	}

	const contentParagraphs = paragraphs.filter(
		(p) => !p.trim().startsWith("#") && p.trim().length > 0,
	);
	if (
		contentParagraphs.length > 0 &&
		longParagraphs > contentParagraphs.length * 0.3
	) {
		passed = false;
		evidence.push({
			type: "deterministic",
			description: `${longParagraphs} van ${contentParagraphs.length} paragrafen hebben >6 zinnen (cognitieve belasting)`,
			passageReferences: [],
			claimIds: [],
			sourceIds: [],
		});
	}

	// Check for heading frequency (every ~300 words)
	const words = ctx.dutchPublicationMarkdown.split(/\s+/).length;
	const headings =
		ctx.dutchPublicationMarkdown.match(/^#{1,6}\s+.+$/gm) || [];
	if (words > 600 && headings.length < 3) {
		passed = false;
		evidence.push({
			type: "deterministic",
			description: `Onvoldoende koppen (${headings.length}) voor ${words} woorden — aanbevolen elke ~300 woorden`,
			passageReferences: [],
			claimIds: [],
			sourceIds: [],
		});
	}

	// Check for meaningful heading text (not just numbers)
	const numberedHeadings = headings.filter((h) =>
		/^#{1,6}\s+\d+[\.\s]/.test(h),
	).length;
	if (numberedHeadings > headings.length * 0.5 && headings.length > 0) {
		evidence.push({
			type: "deterministic",
			description: `Veel genummerde koppen (${numberedHeadings}/${headings.length}) — beschrijvende koppen zijn toegankelijker`,
			passageReferences: [],
			claimIds: [],
			sourceIds: [],
		});
	}

	// Check for explicit connections between concepts
	const connectionWords = [
		"daarom",
		"daardoor",
		"als gevolg",
		"op basis van",
		"dit betekent",
		"met andere woorden",
		"concreter",
		"specifiek",
	];
	let connectionCount = 0;
	for (const word of connectionWords) {
		const regex = new RegExp(`\\b${word}\\b`, "gi");
		connectionCount += (ctx.dutchPublicationMarkdown.match(regex) || [])
			.length;
	}

	if (connectionCount < Math.max(3, words / 1000)) {
		evidence.push({
			type: "deterministic",
			description: `Weinig expliciete conceptuele verbindingen (${connectionCount} gevonden) — verlaagt cognitieve toegankelijkheid`,
			passageReferences: [],
			claimIds: [],
			sourceIds: [],
		});
	}

	return {
		passed,
		details: passed
			? "Cognitieve toegankelijkheid indicatoren voldoende"
			: "Cognitieve toegankelijkheid tekortkomingen gedetecteerd",
		passageReferences: refs,
		evidence,
	};
}

/**
 * RPE4: Check technical depth preservation.
 */
function checkTechnicalDepth(ctx: EvaluationContext): DeterministicCheckResult {
	const refs: PassageReference[] = [];
	const evidence: EvaluationEvidence[] = [];
	let passed = true;

	// Check for technical context in claims
	let hasTechnicalMechanism = false;
	let hasArchitecture = false;
	let hasLimitations = false;
	let hasReleaseMaturity = false;

	for (const candidate of ctx.factDossier.candidates) {
		for (const claim of candidate.claims) {
			if (claim.technicalContext) {
				if (claim.technicalContext.mechanism)
					hasTechnicalMechanism = true;
				if (claim.technicalContext.architecture?.length)
					hasArchitecture = true;
				if (claim.technicalContext.limitations?.length)
					hasLimitations = true;
				if (claim.technicalContext.releaseMaturity)
					hasReleaseMaturity = true;
			}
		}
	}

	// Check if technical content is present in Dutch publication
	const techTerms = [
		"mechanisme",
		"architectuur",
		"implementatie",
		"releasematuring",
		"beschikbaarheid",
		"beperking",
	];
	let techMentions = 0;
	for (const term of techTerms) {
		techMentions += (
			ctx.dutchPublicationMarkdown
				.toLowerCase()
				.match(new RegExp(`\\b${term}\\b`, "g")) || []
		).length;
	}

	if ((hasTechnicalMechanism || hasArchitecture) && techMentions < 3) {
		passed = false;
		evidence.push({
			type: "deterministic",
			description:
				"Technische mechanisme/architectuur in dossier maar onvoldoende in publicatie",
			passageReferences: [],
			claimIds: [],
			sourceIds: [],
		});
	}

	if (hasLimitations) {
		const limitationTerms = [
			"beperking",
			"limitatie",
			"tekortkoming",
			"niet beschikbaar",
		];
		let limMentions = 0;
		for (const term of limitationTerms) {
			limMentions += (
				ctx.dutchPublicationMarkdown
					.toLowerCase()
					.match(new RegExp(`\\b${term}\\b`, "g")) || []
			).length;
		}
		if (limMentions === 0) {
			passed = false;
			evidence.push({
				type: "deterministic",
				description:
					"Beperkingen in dossier maar niet in publicatie vermeld",
				passageReferences: [],
				claimIds: [],
				sourceIds: [],
			});
		}
	}

	if (hasReleaseMaturity) {
		const maturityTerms = [
			"ga",
			"preview",
			"experimenteel",
			"algemeen beschikbaar",
			"beperkt beschikbaar",
		];
		let matMentions = 0;
		for (const term of maturityTerms) {
			matMentions += (
				ctx.dutchPublicationMarkdown
					.toLowerCase()
					.match(new RegExp(`\\b${term}\\b`, "g")) || []
			).length;
		}
		if (matMentions === 0) {
			evidence.push({
				type: "deterministic",
				description:
					"Release maturing in dossier maar niet in publicatie vermeld",
				passageReferences: [],
				claimIds: [],
				sourceIds: [],
			});
		}
	}

	return {
		passed,
		details: passed
			? "Technische diepgang behouden in publicatie"
			: "Technische diepgang onvoldoende vertegenwoordigd",
		passageReferences: refs,
		evidence,
	};
}

/**
 * RPE5: Check scientific/strategic research quality treatment.
 */
function checkResearchQuality(
	ctx: EvaluationContext,
): DeterministicCheckResult {
	const refs: PassageReference[] = [];
	const evidence: EvaluationEvidence[] = [];
	let passed = true;

	// Check for research findings in dossier
	let hasResearchFindings = false;
	let hasMethodology = false;
	let hasCausalClaims = false;
	let hasLimitations = false;

	for (const candidate of ctx.factDossier.candidates) {
		for (const claim of candidate.claims) {
			if (
				claim.claimType === "scientific-research" ||
				claim.claimType === "strategic-research" ||
				claim.claimType === "advisory-finding"
			) {
				hasResearchFindings = true;
			}
			if (claim.methodologicalContext) {
				hasMethodology = true;
			}
			if (claim.strategicContext) {
				if (claim.strategicContext.causalClaimType)
					hasCausalClaims = true;
				if (
					claim.strategicContext.generalizability ||
					claim.strategicContext.competingExplanations?.length
				)
					hasLimitations = true;
			}
		}
	}

	if (hasResearchFindings) {
		// Check that methodology is mentioned
		const methodTerms = [
			"methodologie",
			"onderzoeksdesign",
			"dataset",
			"evaluatiecondities",
			"reproduceerbaar",
		];
		let methodMentions = 0;
		for (const term of methodTerms) {
			methodMentions += (
				ctx.dutchPublicationMarkdown
					.toLowerCase()
					.match(new RegExp(`\\b${term}\\b`, "g")) || []
			).length;
		}
		if (methodMentions === 0 && hasMethodology) {
			passed = false;
			evidence.push({
				type: "deterministic",
				description:
					"Wetenschappelijk onderzoek in dossier maar methodologie niet in publicatie",
				passageReferences: [],
				claimIds: [],
				sourceIds: [],
			});
		}

		// Check for causal claim qualification
		if (hasCausalClaims) {
			const causalTerms = [
				"correlatie",
				"causaliteit",
				"voorspelling",
				"interpretatie",
				"kan wijzen op",
				"suggereert",
			];
			let causalMentions = 0;
			for (const term of causalTerms) {
				causalMentions += (
					ctx.dutchPublicationMarkdown
						.toLowerCase()
						.match(new RegExp(`\\b${term}\\b`, "g")) || []
				).length;
			}
			if (causalMentions === 0) {
				passed = false;
				evidence.push({
					type: "deterministic",
					description:
						"Causale claims in dossier maar niet gekwalificeerd in publicatie",
					passageReferences: [],
					claimIds: [],
					sourceIds: [],
				});
			}
		}

		// Check for limitations
		if (hasLimitations) {
			const limTerms = [
				"beperking",
				"generaliseerbaarheid",
				"concurrerende verklaring",
				"onzekerheid",
			];
			let limMentions = 0;
			for (const term of limTerms) {
				limMentions += (
					ctx.dutchPublicationMarkdown
						.toLowerCase()
						.match(new RegExp(`\\b${term}\\b`, "g")) || []
				).length;
			}
			if (limMentions === 0) {
				evidence.push({
					type: "deterministic",
					description:
						"Onderzoekbeperkingen in dossier maar niet in publicatie",
					passageReferences: [],
					claimIds: [],
					sourceIds: [],
				});
			}
		}
	}

	return {
		passed,
		details: passed
			? "Wetenschappelijke/strategische onderzoekskwaliteit behouden"
			: "Onderzoekskwaliteit onvoldoende vertegenwoordigd",
		passageReferences: refs,
		evidence,
	};
}

/**
 * RPE8: Check editorial coherence and narrative structure.
 */
function checkEditorialCoherence(
	ctx: EvaluationContext,
): DeterministicCheckResult {
	const refs: PassageReference[] = [];
	const evidence: EvaluationEvidence[] = [];
	let passed = true;

	// Check that story order matches editorial manifest
	const storyOrderInPub: string[] = [];
	const storyHeadings =
		ctx.dutchPublicationMarkdown.match(/^###\s+\d+\.\s+(.+)$/gm) || [];
	for (const heading of storyHeadings) {
		const match = heading.match(/^###\s+\d+\.\s+(.+)$/);
		if (match) storyOrderInPub.push(match[1].trim());
	}

	// Check for transitions between stories
	const transitionTerms = [
		"verder",
		"ook",
		"daarnaast",
		"in een ander domein",
		"tegelijkertijd",
		"overigens",
	];
	let transitionCount = 0;
	for (const term of transitionTerms) {
		transitionCount += (
			ctx.dutchPublicationMarkdown
				.toLowerCase()
				.match(new RegExp(`\\b${term}\\b`, "g")) || []
		).length;
	}

	if (storyHeadings.length > 1 && transitionCount < 2) {
		evidence.push({
			type: "deterministic",
			description: `Weinig overgangswoorden (${transitionCount}) tussen ${storyHeadings.length} verhalen`,
			passageReferences: [],
			claimIds: [],
			sourceIds: [],
		});
	}

	// Check for conclusion
	const hasConclusion =
		/## Samengevat|## Conclusie|## Afsluiting|## Further Reading/i.test(
			ctx.dutchPublicationMarkdown,
		);

	if (!hasConclusion && ctx.editorialManifest.stories.length > 0) {
		evidence.push({
			type: "deterministic",
			description: "Geen afsluitende sectie of samenvatting gevonden",
			passageReferences: [],
			claimIds: [],
			sourceIds: [],
		});
	}

	return {
		passed,
		details: passed
			? "Editoriële coherentie en structuur adequate"
			: "Editoriële coherentie tekortkomingen",
		passageReferences: refs,
		evidence,
	};
}

/**
 * RPE9: Check vendor neutrality indicators.
 */
function checkVendorNeutrality(
	ctx: EvaluationContext,
): DeterministicCheckResult {
	const refs: PassageReference[] = [];
	const evidence: EvaluationEvidence[] = [];
	let passed = true;

	// Count mentions of specific vendors
	const vendorTerms = [
		"github copilot",
		"copilot",
		"vs code",
		"visual studio code",
		"github actions",
		"microsoft",
	];
	const vendorCounts: Record<string, number> = {};

	for (const term of vendorTerms) {
		const count = (
			ctx.dutchPublicationMarkdown
				.toLowerCase()
				.match(new RegExp(term.replace(/\s+/g, "\\s+"), "g")) || []
		).length;
		if (count > 0) vendorCounts[term] = count;
	}

	// Check if vendor mentions are disproportionate
	const totalVendorMentions = Object.values(vendorCounts).reduce(
		(a, b) => a + b,
		0,
	);
	const totalOrgs = ctx.editorialManifest.stories.filter(
		(s) => s.decision === "SELECTED",
	).length;

	if (totalVendorMentions > totalOrgs * 3) {
		passed = false;
		evidence.push({
			type: "deterministic",
			description: `Disproportionele leveranciersvermeldingen (${totalVendorMentions} voor ${totalOrgs} verhalen)`,
			passageReferences: [],
			claimIds: [],
			sourceIds: [],
		});
	}

	// Check for architectural lesson patterns
	const archLessonPatterns = [
		/architectuur.*les/i,
		/architectuurprincipe/i,
		/governance.*conclusie/i,
		/samenvattend.*architectuur/i,
		/lessen.*voor.*architectuur/i,
		/algemene.*principes/i,
		/software.*engineering.*advies/i,
	];

	let archLessons = 0;
	for (const pattern of archLessonPatterns) {
		if (pattern.test(ctx.dutchPublicationMarkdown)) archLessons++;
	}

	if (archLessons > 1) {
		evidence.push({
			type: "deterministic",
			description: `Meerdere architectuurles patronen (${archLessons}) — kan leveranciersneutraliteit schaden`,
			passageReferences: [],
			claimIds: [],
			sourceIds: [],
		});
	}

	return {
		passed,
		details: passed
			? "Leveranciersneutraliteit indicatoren adequate"
			: "Mogelijke leveranciersneutraliteit concerns",
		passageReferences: refs,
		evidence,
	};
}

/**
 * RPE10: Check visual explanation integration.
 */
function checkVisualIntegration(
	ctx: EvaluationContext,
): DeterministicCheckResult {
	const refs: PassageReference[] = [];
	const evidence: EvaluationEvidence[] = [];
	let passed = true;

	// Check if visualizations exist for this edition
	if (ctx.visualizations.length > 0) {
		// Check for visual references in publication
		const visualPatterns = [
			/zie (het )?(diagram|figuur|tabel|grafiek|schema|illustratie)/i,
			/in (het )?(diagram|figuur|tabel|grafiek|schema) (wordt|staat)/i,
			/zoals (in|op) (het )?(diagram|figuur|tabel|grafiek|schema)/i,
		];

		let visualRefCount = 0;
		for (const pattern of visualPatterns) {
			visualRefCount += (
				ctx.dutchPublicationMarkdown.match(pattern) || []
			).length;
		}

		if (visualRefCount === 0) {
			evidence.push({
				type: "deterministic",
				description: `Visualisaties beschikbaar (${ctx.visualizations.length}) maar niet gerefereerd in publicatie`,
				passageReferences: [],
				claimIds: [],
				sourceIds: [],
			});
		}

		// Check for alt text / captions in publication
		const hasCaptions = /!\[.*\]\(|alt=|caption=/i.test(
			ctx.dutchPublicationMarkdown,
		);
		if (!hasCaptions) {
			evidence.push({
				type: "deterministic",
				description:
					"Geen alt-teksten of captions voor visualisaties in publicatie",
				passageReferences: [],
				claimIds: [],
				sourceIds: [],
			});
		}
	}

	// Check for tables in markdown
	const hasTables = /\|.*\|.*\|/.test(ctx.dutchPublicationMarkdown);
	if (hasTables) {
		// Check for header row
		const tableLines = ctx.dutchPublicationMarkdown
			.split("\n")
			.filter((l) => l.includes("|"));
		const hasHeaderSeparator = tableLines.some((l) =>
			/^\|?\s*-+\s*\|/.test(l),
		);
		if (!hasHeaderSeparator) {
			evidence.push({
				type: "deterministic",
				description:
					"Tabellen zonder duidelijke header-scheiding (toegankelijkheid)",
				passageReferences: findPassageReferences(
					ctx.dutchPublicationMarkdown,
					["|"],
				),
				claimIds: [],
				sourceIds: [],
			});
		}
	}

	return {
		passed,
		details: passed
			? "Visuele integratie adequate"
			: "Visuele integratie tekortkomingen",
		passageReferences: refs,
		evidence,
	};
}

/**
 * RPE11: Check WCAG 2.2 AA content-level requirements.
 */
function checkWcagContent(ctx: EvaluationContext): DeterministicCheckResult {
	const refs: PassageReference[] = [];
	const evidence: EvaluationEvidence[] = [];
	let passed = true;

	// Check heading hierarchy (no skipped levels)
	const headings =
		ctx.dutchPublicationMarkdown.match(/^#{1,6}\s+.+$/gm) || [];
	let prevLevel = 0;
	for (const heading of headings) {
		const level = heading.match(/^#+/)?.[0].length || 0;
		if (prevLevel > 0 && level > prevLevel + 1) {
			passed = false;
			evidence.push({
				type: "deterministic",
				description: `Kopniveau sprong: ${heading} (van H${prevLevel} naar H${level})`,
				passageReferences: findPassageReferences(
					ctx.dutchPublicationMarkdown,
					[heading],
				),
				claimIds: [],
				sourceIds: [],
			});
		}
		prevLevel = level;
	}

	// Check for descriptive link text (not "klik hier" or "hier")
	const linkPattern = /\[([^\]]+)\]\([^)]+\)/g;
	let linkMatch;
	let poorLinkCount = 0;
	while (
		(linkMatch = linkPattern.exec(ctx.dutchPublicationMarkdown)) !== null
	) {
		const linkText = linkMatch[1].toLowerCase();
		if (
			["klik hier", "hier", "link", "read more", "meer", "bron"].includes(
				linkText,
			)
		) {
			poorLinkCount++;
		}
	}
	if (poorLinkCount > 0) {
		evidence.push({
			type: "deterministic",
			description: `${poorLinkCount} links met niet-beschrijvende linktekst ("klik hier", "hier", etc.)`,
			passageReferences: [],
			claimIds: [],
			sourceIds: [],
		});
	}

	// Check for alt text on images
	const imagePattern = /!\[([^\]]*)\]\([^)]+\)/g;
	let imgMatch;
	let missingAlt = 0;
	while (
		(imgMatch = imagePattern.exec(ctx.dutchPublicationMarkdown)) !== null
	) {
		if (!imgMatch[1].trim()) missingAlt++;
	}
	if (missingAlt > 0) {
		passed = false;
		evidence.push({
			type: "deterministic",
			description: `${missingAlt} afbeeldingen zonder alt-tekst`,
			passageReferences: [],
			claimIds: [],
			sourceIds: [],
		});
	}

	// Check language declaration
	const hasLangAttr = /lang\s*=\s*["']nl["']/.test(
		ctx.dutchPublicationMarkdown,
	);
	if (!hasLangAttr && ctx.dutchPublicationMarkdown.length > 0) {
		evidence.push({
			type: "deterministic",
			description:
				'Geen taalattribuut (lang="nl") gedetecteerd in publicatie',
			passageReferences: [],
			claimIds: [],
			sourceIds: [],
		});
	}

	return {
		passed,
		details: passed
			? "WCAG 2.2 AA inhoudsvereisten voldoende"
			: "WCAG 2.2 AA inhoudsvereisten tekortkomingen",
		passageReferences: refs,
		evidence,
	};
}

/**
 * RPE14: Check bilingual consistency basics.
 */
function checkBilingualConsistency(
	ctx: EvaluationContext,
): DeterministicCheckResult {
	const refs: PassageReference[] = [];
	const evidence: EvaluationEvidence[] = [];
	let passed = true;

	if (
		!ctx.englishPublicationMarkdown ||
		!ctx.englishPublicationTraceability
	) {
		// English publication not provided - mark as NOT_ASSESSABLE for bilingual checks
		return {
			passed: false, // This will be overridden to NOT_ASSESSABLE in the evaluation
			details:
				"Engelse publicatie niet beschikbaar voor tweetalige consistentie check",
			passageReferences: [],
			evidence: [
				{
					type: "deterministic",
					description:
						"Engelse publicatie ontbreekt — kan niet beoordeeld worden",
					passageReferences: [],
					claimIds: [],
					sourceIds: [],
				},
			],
		};
	}

	// Check that both have same story coverage
	const nlStories = ctx.dutchPublicationTraceability.storyCoverage.length;
	const enStories = ctx.englishPublicationTraceability.storyCoverage.length;

	if (nlStories !== enStories) {
		passed = false;
		evidence.push({
			type: "deterministic",
			description: `Verhaal dekking verschilt: NL=${nlStories}, EN=${enStories}`,
			passageReferences: [],
			claimIds: [],
			sourceIds: [],
		});
	}

	// Check claim coverage overlap
	const nlClaims = new Set(ctx.dutchPublicationTraceability.claimCoverage);
	const enClaims = new Set(ctx.englishPublicationTraceability.claimCoverage);
	const nlOnly = [...nlClaims].filter((c) => !enClaims.has(c));
	const enOnly = [...enClaims].filter((c) => !nlClaims.has(c));

	if (nlOnly.length > 0 || enOnly.length > 0) {
		evidence.push({
			type: "deterministic",
			description: `Claim dekking asymmetrie: NL-only=${nlOnly.length}, EN-only=${enOnly.length}`,
			passageReferences: [],
			claimIds: [...nlOnly, ...enOnly],
			sourceIds: [],
		});
	}

	// Check for numerical consistency (extract numbers from both)
	const numPattern = /\b\d+(?:[.,]\d+)?(?:%|[eE][+-]?\d+)?\b/g;
	const nlNumbers = [
		...new Set(ctx.dutchPublicationMarkdown.match(numPattern) || []),
	];
	const enNumbers = [
		...new Set(ctx.englishPublicationMarkdown.match(numPattern) || []),
	];

	const nlNumSet = new Set(nlNumbers);
	const enNumSet = new Set(enNumbers);
	const missingInEn = nlNumbers.filter((n) => !enNumSet.has(n));
	const missingInNl = enNumbers.filter((n) => !nlNumSet.has(n));

	// Also check for specific contradictory numbers (e.g., 15% vs 20%)
	const percentagePattern = /\b(\d+(?:[.,]\d+)?)\s*%/g;
	const nlPercentages = [
		...ctx.dutchPublicationMarkdown.matchAll(percentagePattern),
	].map((m) => m[1]);
	const enPercentages = [
		...ctx.englishPublicationMarkdown.matchAll(percentagePattern),
	].map((m) => m[1]);

	// Check if same context has different percentages
	for (const nlPct of nlPercentages) {
		for (const enPct of enPercentages) {
			if (nlPct !== enPct) {
				passed = false;
				evidence.push({
					type: "deterministic",
					description: `Contradictorische percentages gedetecteerd: NL="${nlPct}%" vs EN="${enPct}%"`,
					passageReferences: [],
					claimIds: [],
					sourceIds: [],
				});
			}
		}
	}

	if (missingInEn.length > 5 || missingInNl.length > 5) {
		evidence.push({
			type: "deterministic",
			description: `Numerieke consistentie: ${missingInEn.length} getallen in NL niet in EN, ${missingInNl.length} in EN niet in NL`,
			passageReferences: [],
			claimIds: [],
			sourceIds: [],
		});
	}

	return {
		passed,
		details: passed
			? "Twee talige consistentie basis checks geslaagd"
			: "Twee talige consistentie afwijkingen",
		passageReferences: refs,
		evidence,
	};
}

// ============================================================================
// Model-Assisted Evaluations
// ============================================================================

async function evaluateRPE1_FirstScreenClarity(
	ctx: EvaluationContext,
): Promise<ReadableCriterionEvaluation> {
	const prompt = `Evalueer criterium RPE1: "Eerste-scherm helderheid en directe oriëntatie" voor de volgende publicaties.

CRITERIUM RPE1: Beoordeel of lezers de betekenis van de editie begrijpen vanaf het openings scherm.

Beoordeel:
- Is de editie datum duidelijk zichtbaar?
- Is het doel van de publicatie onmiddellijk begrijpelijk?
- Zijn de meest consequentievolle ontwikkelingen identificeerbaar zonder uitgebreid scrollen?
- Communiceert de opening concrete nieuws in plaats van generieke AI commentaar?
- Is de hiërarchie tussen editie overzicht en individuele verhalen duidelijk?
- Kunnen lezers snel nieuws koppen van achtergrond informatie onderscheiden?
- Worden belangrijke bevindingen voor lengte technische uitleggen gepresenteerd?
- Is de opening visueel rustig en cognitief beheersbaar?
- Zijn koppen beschrijvend en informatief?
- Vermijdt de presentatie onnodige interface afleiding?

DE NEDERLANDSE PUBLICATIE (eerste 2000 tekens):
${ctx.dutchPublicationMarkdown.slice(0, 2000)}

LEIDENDE ONTWIKKELING UIT EDITORIËLE SELECTIE:
${ctx.editorialManifest.stories.length > 0 ? `${ctx.editorialManifest.stories[0].organizations.join(", ")} - ${ctx.editorialManifest.stories[0].summary}` : "Geen verhalen"}

Geef je evaluatie in JSON formaat:
{
  "status": "PASS|FAIL|UNVERIFIED|NOT_ASSESSABLE",
  "severity": "CRITICAL|MAJOR|MINOR|ADVISORY",
  "summary": "Korte samenvatting",
  "rationale": "Gedetailleerde redenatie",
  "evidence": [{"type": "model-assisted", "description": "...", "passageReferences": [], "claimIds": [], "sourceIds": []}],
  "passageReferences": [],
  "residualUncertainty": "..."
}`;

	const result = await callLLMWithRetry(ctx, prompt, "RPE1");
	return parseModelEvaluation(
		result.content,
		"RPE1",
		"model-assisted",
		ctx,
		"nl",
	);
}

async function evaluateRPE2_ProgressiveDisclosure(
	ctx: EvaluationContext,
): Promise<ReadableCriterionEvaluation> {
	const prompt = `Evalueer criterium RPE2: "Progressieve openbaarmaking en informatie hiërarchie" voor de volgende publicaties.

CRITERIUM RPE2: Beoordeel of de publicatie meerdere begripsniveaus biedt zonder feitentrouwheid te compromitteren.

Ondersteun een coherente progressie van:
1. Essentiële ontwikkeling
2. Praktische significantie
3. Conceptuele uitleg
4. Technisch/wetenschappelijk mechanisme
5. Bewijs, beperkingen en tegenargumenten
6. Geavanceerde technische, strategische of architecturale detail
7. Originele bronnen voor verder onderzoek

Beoordeel:
- Of het essentiële nieuws zichtbaar is voor ondersteunende detail
- Of complexiteit in een logische volgorde geïntroduceerd wordt
- Of de lezer relevante diepere secties kan identificeren
- Of uitleggen coherent blijven bij sequentiële lezing
- Of optionele details overgeslagen kunnen worden zonder de centrale betekenis te verliezen
- Of belangrijke voorbehouden toegankelijk zijn in plaats van verborgen
- Of de hiërarchie in zowel Nederlands als Engels werkt

DE NEDERLANDSE PUBLICATIE:
${ctx.dutchPublicationMarkdown}

${
	ctx.englishPublicationMarkdown
		? `DE ENGELSE PUBLICATIE:
${ctx.englishPublicationMarkdown}`
		: ""
}

Geef je evaluatie in JSON formaat:
{
  "status": "PASS|FAIL|UNVERIFIED|NOT_ASSESSABLE",
  "severity": "CRITICAL|MAJOR|MINOR|ADVISORY",
  "summary": "Korte samenvatting",
  "rationale": "Gedetailleerde redenatie",
  "evidence": [{"type": "model-assisted", "description": "...", "passageReferences": [], "claimIds": [], "sourceIds": []}],
  "passageReferences": [],
  "residualUncertainty": "..."
}`;

	const result = await callLLMWithRetry(ctx, prompt, "RPE2");
	return parseModelEvaluation(
		result.content,
		"RPE2",
		"model-assisted",
		ctx,
		"both",
	);
}

async function evaluateRPE3_CognitiveAccessibility(
	ctx: EvaluationContext,
): Promise<ReadableCriterionEvaluation> {
	const prompt = `Evalueer criterium RPE3: "ADHD-bewuste cognitieve toegankelijkheid" voor de volgende publicaties.

CRITERIUM RPE3: Beoordeel leesbaarheid voor volwassenen die aandachtsregulatie, werkgeheugen of informatieverwerkingsuitdagingen kunnen ervaren.

Pas de volgende principes toe:
- Één centraal idee per coherente passage
- Duidelijke visuele en conceptuele hiërarchie
- Betekenisvolle paragraaf grenzen
- Belangrijke bevindingen vroeg gepresenteerd
- Expliciete verbindingen tussen concepten
- Context vóór abstracte mechanismen
- Voorspelbare sectie organisatie
- Beperkte onnodige herhaling
- Natuurlijke overgangen tussen ontwikkelingen
- Begrijpelijke technische terminologie
- Duidelijke onderscheidingen tussen feiten, interpretaties en speculatie
- Verminderde decoratieve en navigatieve afleiding
- Toepasselijke witruimte en leesbare typografie
- Gemakkelijke mogelijkheden om te hervatten na onderbreking

Beoordeel of lange technische uitleggen onnodige cognitieve afhankelijkheden creëren.
Identificeer passages waar lezers excessieve eerdere details moeten onthouden.
Beveel gerichte structurele verbeteringen aan in plaats van automatisch te verkorten.

DE NEDERLANDSE PUBLICATIE:
${ctx.dutchPublicationMarkdown}

${
	ctx.englishPublicationMarkdown
		? `DE ENGELSE PUBLICATIE:
${ctx.englishPublicationMarkdown}`
		: ""
}

Geef je evaluatie in JSON formaat:
{
  "status": "PASS|FAIL|UNVERIFIED|NOT_ASSESSABLE",
  "severity": "CRITICAL|MAJOR|MINOR|ADVISORY",
  "summary": "Korte samenvatting",
  "rationale": "Gedetailleerde redenatie",
  "evidence": [{"type": "model-assisted", "description": "...", "passageReferences": [], "claimIds": [], "sourceIds": []}],
  "passageReferences": [],
  "residualUncertainty": "..."
}`;

	const result = await callLLMWithRetry(ctx, prompt, "RPE3");
	return parseModelEvaluation(
		result.content,
		"RPE3",
		"model-assisted",
		ctx,
		"both",
	);
}

async function evaluateRPE4_TechnicalDepth(
	ctx: EvaluationContext,
): Promise<ReadableCriterionEvaluation> {
	const prompt = `Evalueer criterium RPE4: "Technische en wetenschappelijke diepgang behoud" voor de volgende publicaties.

CRITERIUM RPE4: Verifieer dat editoriële toegankelijkheid niet ten koste gaat van technische substantie.

Beoorwel of geselecteerde ontwikkelingen relevante behouden:
- Technische mechanismen
- Systeem gedrag
- Architectuur en interoperabiliteit
- Model capaciteiten en beperkingen
- Software versies en release volwassenheid
- Beveiligingsassumpties en vertrouwensgrenzen
- Evaluatie en benchmark methodologie
- Reproduceerbaarheid
- Operationele implicaties
- Architecturale trade-offs
- Bewijs en tegenbewijs

Onderscheid:
- Aangekondigde capaciteiten van geïmplementeerde functionaliteit
- Publieke previews van algemeen beschikbare releases
- Leveranciers-gerapporteerde prestaties van onafhankelijke evaluatie
- Gedemonstreerde resultaten van theoretische mogelijkheden
- Technische haalbaarheid van operationele gereedheid

Identificeer uitleggen die oppervlakkelijk leesbaar zijn maar technisch incomplete.
Behou geavanceerde technische details wanneer ze materieel begrip verbeteren.

DE NEDERLANDSE PUBLICATIE:
${ctx.dutchPublicationMarkdown}

FEITEN DOSSIER CONTEXT:
${summarizeFactDossierForDepth(ctx.factDossier)}

Geef je evaluatie in JSON formaat:
{
  "status": "PASS|FAIL|UNVERIFIED|NOT_ASSESSABLE",
  "severity": "CRITICAL|MAJOR|MINOR|ADVISORY",
  "summary": "Korte samenvatting",
  "rationale": "Gedetailleerde redenatie",
  "evidence": [{"type": "model-assisted", "description": "...", "passageReferences": [], "claimIds": [], "sourceIds": []}],
  "passageReferences": [],
  "residualUncertainty": "..."
}`;

	const result = await callLLMWithRetry(ctx, prompt, "RPE4");
	return parseModelEvaluation(
		result.content,
		"RPE4",
		"model-assisted",
		ctx,
		"both",
	);
}

async function evaluateRPE5_ResearchQuality(
	ctx: EvaluationContext,
): Promise<ReadableCriterionEvaluation> {
	const prompt = `Evalueer criterium RPE5: "Wetenschappelijke en strategische onderzoekskwaliteit" voor de volgende publicaties.

CRITERIUM RPE5: Beoordeel de editoriële behandeling van origineel onderzoek en strategische intelligence uit:
- Academische instellingen
- Onafhankelijke laboratoria
- Gartner, McKinsey, Forrester, IDC
- Vergelijkbare betrouwbare onderzoek en adviseursorganisaties

Zorg dat artikelen relevante behouden:
- Onderzoeksvragen
- Methodologie
- Studie populatie
- Steekproef kenmerken
- Onderzoeksperiode
- Geografische en industrie reikwijdte
- Gemeten uitkomsten
- Baselines en vergelijkingsgroepen
- Statistische onzekerheid
- Methodologische beperkingen
- Financiering en potentiële belangenconflicten
- Generaliseerbaarheid
- Tegenbewijs

Onderscheid originele empirische resultaten van advies aanbevelingen en marktvoorspellingen.
Onderscheid correlatie van causaliteit.
Onderscheid geschatte productiviteit/ROI van gedemonstreerde organisatie-uitkomsten.
Draai geen beperkte studies om in universele conclusies.

DE NEDERLANDSE PUBLICATIE:
${ctx.dutchPublicationMarkdown}

FEITEN DOSSIER ONDERZOEK CONTEXT:
${summarizeResearchContext(ctx.factDossier)}

Geef je evaluatie in JSON formaat:
{
  "status": "PASS|FAIL|UNVERIFIED|NOT_ASSESSABLE",
  "severity": "CRITICAL|MAJOR|MINOR|ADVISORY",
  "summary": "Korte samenvatting",
  "rationale": "Gedetailleerde redenatie",
  "evidence": [{"type": "model-assisted", "description": "...", "passageReferences": [], "claimIds": [], "sourceIds": []}],
  "passageReferences": [],
  "residualUncertainty": "..."
}`;

	const result = await callLLMWithRetry(ctx, prompt, "RPE5");
	return parseModelEvaluation(
		result.content,
		"RPE5",
		"model-assisted",
		ctx,
		"both",
	);
}

async function evaluateRPE8_EditorialCoherence(
	ctx: EvaluationContext,
): Promise<ReadableCriterionEvaluation> {
	const prompt = `Evalueer criterium RPE8: "Editoriële coherentie en narratieve structuur" voor de volgende publicaties.

CRITERIUM RPE8: Beoordeel de publicatie als een complete leeservaring in plaats van geïsoleerde artikel fragmenten.

Beoordeel:
- Logische progressie tussen geselecteerde ontwikkelingen
- Duidelijke scheiding van ongerelateerde onderwerpen
- Toepasselijke groepering van gerelateerde verhalen
- Consistente terminologie
- Betekenisvolle overgangen
- Afwezigheid van onnodige herhaling
- Toepasselijke uitleg diepgang
- Gebalanceerde aandacht voor materiële significantie
- Coherente algehele structuur
- Een natuurlijke conclusie waar toepasselijk

Dwing niet alle nieuws in één overkoepelend thema.
Dwing geen uniforme artikel lengtes.
Een stille editie is acceptabel wanneer weinig ontwikkelingen de editoriële eisen halen.
Een langere editie is toepasselijk wanneer meerdere consequentievolle ontwikkelingen substantiële uitleg vereisen.

DE NEDERLANDSE PUBLICATIE:
${ctx.dutchPublicationMarkdown}

EDITORIËLE SELECTIE VOLGORDE:
${ctx.editorialManifest.stories.map((s, i) => `${i + 1}. ${s.organizations.join(", ")} (${s.researchDomains[0]})`).join("\n")}

Geef je evaluatie in JSON formaat:
{
  "status": "PASS|FAIL|UNVERIFIED|NOT_ASSESSABLE",
  "severity": "CRITICAL|MAJOR|MINOR|ADVISORY",
  "summary": "Korte samenvatting",
  "rationale": "Gedetailleerde redenatie",
  "evidence": [{"type": "model-assisted", "description": "...", "passageReferences": [], "claimIds": [], "sourceIds": []}],
  "passageReferences": [],
  "residualUncertainty": "..."
}`;

	const result = await callLLMWithRetry(ctx, prompt, "RPE8");
	return parseModelEvaluation(
		result.content,
		"RPE8",
		"model-assisted",
		ctx,
		"both",
	);
}

async function evaluateRPE9_VendorNeutrality(
	ctx: EvaluationContext,
): Promise<ReadableCriterionEvaluation> {
	const prompt = `Evalueer criterium RPE9: "Leveranciersneutraliteit en interdisciplinaire balans" voor de volgende publicaties.

CRITERIUM RPE9: Beoorwel of de publicatie de geselecteerde editoriële inventaris getrouw vertegenwoordigt.

Controleer op:
- Disproportionele uitbreiding van persoonlijk bevorzugde technologie onderwerpen
- Onterecht vermindering van wetenschappelijk onderzoek
- Ondervertegenwoordiging van significante strategische en economische bevindingen
- Excessieve aandacht voor GitHub, Copilot of VS Code
- Onnodige herhaling van bekende agentic engineering principes
- Verlies van tegenbewijs of concurrerende uitleggen
- Onondersteunde strategische of architecturale extrapolaties

Leg geen vaste leveranciersquota's of verplichte onderzoeksdomein dekking per editie op.
Vergelijk daadwerkelijke artikel diepgang met de significantie en uitleg eisen vastgelegd in het editoriële selectie manifest.
Als een onderwerp meer uitleg krijgt omdat het mechanisme moeilijk is, onderscheid dat legitieme behoeften van editoriële bias.

DE NEDERLANDSE PUBLICATIE:
${ctx.dutchPublicationMarkdown}

EDITORIËLE SELECTIE (materiële scores en diepgang aanbevelingen):
${ctx.editorialManifest.stories.map((s) => `${s.organizations.join(", ")}: materiality=${s.materialityScore.toFixed(2)}, depth=${s.recommendedDepth}, domain=${s.researchDomains[0]}`).join("\n")}

Geef je evaluatie in JSON formaat:
{
  "status": "PASS|FAIL|UNVERIFIED|NOT_ASSESSABLE",
  "severity": "CRITICAL|MAJOR|MINOR|ADVISORY",
  "summary": "Korte samenvatting",
  "rationale": "Gedetailleerde redenatie",
  "evidence": [{"type": "model-assisted", "description": "...", "passageReferences": [], "claimIds": [], "sourceIds": []}],
  "passageReferences": [],
  "residualUncertainty": "..."
}`;

	const result = await callLLMWithRetry(ctx, prompt, "RPE9");
	return parseModelEvaluation(
		result.content,
		"RPE9",
		"model-assisted",
		ctx,
		"both",
	);
}

async function evaluateRPE12_BilingualDutch(
	ctx: EvaluationContext,
): Promise<ReadableCriterionEvaluation> {
	const prompt = `Evalueer criterium RPE12: "Twee talige editoriële kwaliteit - Nederlands" voor de Nederlandse publicatie.

CRITERIUM RPE12: Beoordeel de Nederlandse publicatie onafhankelijk op:

- Natuurlijk professioneel Nederlands
- Technische terminologie accurate
- Consistent feitelijke betekenis
- Toepasselijke informatie hiërarchie
- Correcte originele bronverwijzingen
- Consistentie met numerieke bevindingen in dossier
- Accurate onderzoek interpretatie
- Gelokaliseerde toegankelijke beschrijvingen
- Correcte taal-specifieke metadata

De Nederlandse publicatie is canonieke publicatie artefact, maar geen substitutie voor het feiten dossier als feiten autoriteit.

DE NEDERLANDSE PUBLICATIE:
${ctx.dutchPublicationMarkdown}

Geef je evaluatie in JSON formaat:
{
  "status": "PASS|FAIL|UNVERIFIED|NOT_ASSESSABLE",
  "severity": "CRITICAL|MAJOR|MINOR|ADVISORY",
  "summary": "Korte samenvatting",
  "rationale": "Gedetailleerde redenatie",
  "evidence": [{"type": "model-assisted", "description": "...", "passageReferences": [], "claimIds": [], "sourceIds": []}],
  "passageReferences": [],
  "residualUncertainty": "..."
}`;

	const result = await callLLMWithRetry(ctx, prompt, "RPE12");
	return parseModelEvaluation(
		result.content,
		"RPE12",
		"model-assisted",
		ctx,
		"nl",
	);
}

async function evaluateRPE13_BilingualEnglish(
	ctx: EvaluationContext,
): Promise<ReadableCriterionEvaluation> {
	if (!ctx.englishPublicationMarkdown) {
		return {
			criterionId: "RPE13",
			evaluationId: generateEvaluationId(),
			status: "NOT_ASSESSABLE",
			scope: "full-edition",
			language: "en",
			summary: "Engelse publicatie niet beschikbaar voor evaluatie",
			rationale:
				"Geen Engelse publicatie artefact geleverd voor evaluatie",
			evidence: [],
			passageReferences: [],
			repairAttempted: false,
			residualUncertainty: "Engelse publicatie ontbreekt",
			method: "deterministic",
			evaluatedAt: new Date().toISOString(),
			evaluatedBy: "deterministic-checker",
			visualizationReferences: [],
		};
	}

	const prompt = `Evalueer criterium RPE13: "Twee talige editoriële kwaliteit - Engels" voor de Engelse publicatie.

CRITERIUM RPE13: Beoordeel de Engelse publicatie onafhankelijk op:

- Natuurlijk professioneel Engels
- Technische terminologie accurate
- Consistent feitelijke betekenis (vs dossier)
- Toepasselijke informatie hiërarchie
- Correcte originele bronverwijzingen
- Consistentie met numerieke bevindingen in dossier
- Accurate onderzoek interpretatie
- Gelokaliseerde toegankelijke beschrijvingen
- Correcte taal-specifieke metadata

De Engelse publicatie is een derivaat, niet een vertaling — concepten mappen 1:1, idioomen niet.

DE ENGELSE PUBLICATIE:
${ctx.englishPublicationMarkdown}

Geef je evaluatie in JSON formaat:
{
  "status": "PASS|FAIL|UNVERIFIED|NOT_ASSESSABLE",
  "severity": "CRITICAL|MAJOR|MINOR|ADVISORY",
  "summary": "Korte samenvatting",
  "rationale": "Gedetailleerde redenatie",
  "evidence": [{"type": "model-assisted", "description": "...", "passageReferences": [], "claimIds": [], "sourceIds": []}],
  "passageReferences": [],
  "residualUncertainty": "..."
}`;

	const result = await callLLMWithRetry(ctx, prompt, "RPE13");
	return parseModelEvaluation(
		result.content,
		"RPE13",
		"model-assisted",
		ctx,
		"en",
	);
}

async function evaluateRPE14_CrossLanguageConsistency(
	ctx: EvaluationContext,
): Promise<ReadableCriterionEvaluation> {
	if (
		!ctx.englishPublicationMarkdown ||
		!ctx.englishPublicationTraceability
	) {
		return {
			criterionId: "RPE14",
			evaluationId: generateEvaluationId(),
			status: "NOT_ASSESSABLE",
			scope: "full-edition",
			language: "both",
			summary:
				"Engelse publicatie niet beschikbaar voor cross-taal consistentie",
			rationale:
				"Geen Engelse publicatie artefact geleverd voor evaluatie",
			evidence: [],
			passageReferences: [],
			repairAttempted: false,
			residualUncertainty: "Engelse publicatie ontbreekt",
			method: "deterministic",
			evaluatedAt: new Date().toISOString(),
			evaluatedBy: "deterministic-checker",
			visualizationReferences: [],
		};
	}

	const prompt = `Evalueer criterium RPE14: "Cross-taal feite consistentie" tussen Nederlandse en Engelse publicaties.

CRITERIUM RPE14: Beoordeel of beide taalvarianten feitelijk consistent zijn met elkaar EN met het canoniek feiten dossier.

Vergelijk:
- Numerieke bevindingen (percentages, benchmarks, datums, versies)
- Release maturing / beschikbaarheid
- Certeitsniveaus (verifieerd, leveranciersclaim, onderzoek, etc.)
- Attributie van claims
- Beperkingen en onzekerheden
- Technische terminologie (concepten mappen 1:1)

Identificeer:
- Contradicerende numerieke resultaten
- Verschillende release maturing labels
- Sterkere zekerheid in één taal dan de andere
- Ontbrekende beperkingen in één taal
- Terminologie afwijkingen die betekenis wijzigen

DE NEDERLANDSE PUBLICATIE:
${ctx.dutchPublicationMarkdown}

DE ENGELSE PUBLICATIE:
${ctx.englishPublicationMarkdown}

Geef je evaluatie in JSON formaat:
{
  "status": "PASS|FAIL|UNVERIFIED|NOT_ASSESSABLE",
  "severity": "CRITICAL|MAJOR|MINOR|ADVISORY",
  "summary": "Korte samenvatting",
  "rationale": "Gedetailleerde redenatie",
  "evidence": [{"type": "model-assisted", "description": "...", "passageReferences": [], "claimIds": [], "sourceIds": []}],
  "passageReferences": [],
  "residualUncertainty": "..."
}`;

	const result = await callLLMWithRetry(ctx, prompt, "RPE14");
	return parseModelEvaluation(
		result.content,
		"RPE14",
		"model-assisted",
		ctx,
		"both",
	);
}

// ============================================================================
// Model Evaluation Parser
// ============================================================================

function parseModelEvaluation(
	content: string,
	criterionId: ReadableCriterionId,
	method: EvaluationMethod,
	ctx: EvaluationContext,
	language: EvaluationLanguage,
): ReadableCriterionEvaluation {
	try {
		const jsonMatch = content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			throw new Error("No JSON found in model response");
		}
		const parsed = JSON.parse(jsonMatch[0]);

		const evaluationId = generateEvaluationId();
		const now = new Date().toISOString();

		return {
			criterionId,
			evaluationId,
			status: CriterionEvaluationStatusSchema.parse(parsed.status),
			severity: parsed.severity
				? SeverityLevelSchema.parse(parsed.severity)
				: undefined,
			scope: parsed.scope || "full-edition",
			language: parsed.language || language,
			summary: parsed.summary || "Model evaluation completed",
			rationale: parsed.rationale || "Model-assisted evaluation",
			evidence: (parsed.evidence || []).map((e: unknown) => ({
				type: method,
				description:
					typeof e === "string"
						? e
						: (e as Record<string, unknown>).description ||
							"Model evidence",
				passageReferences:
					typeof e === "object" && e && "passageReferences" in e
						? ((e as Record<string, unknown>)
								.passageReferences as PassageReference[])
						: [],
				claimIds:
					typeof e === "object" && e && "claimIds" in e
						? ((e as Record<string, unknown>).claimIds as string[])
						: [],
				sourceIds:
					typeof e === "object" && e && "sourceIds" in e
						? ((e as Record<string, unknown>).sourceIds as string[])
						: [],
				metadata:
					typeof e === "object" && e && "metadata" in e
						? ((e as Record<string, unknown>).metadata as Record<
								string,
								unknown
							>)
						: undefined,
			})),
			passageReferences: parsed.passageReferences || [],
			repairAttempted: false,
			reassessment: undefined,
			residualUncertainty: parsed.residualUncertainty,
			method,
			evaluatedAt: now,
			evaluatedBy: `${method}-evaluator`,
			visualizationReferences: [],
		};
	} catch (error) {
		const evaluationId = generateEvaluationId();
		const now = new Date().toISOString();
		return {
			criterionId,
			evaluationId,
			status: "UNVERIFIED",
			scope: "full-edition",
			language,
			summary: "Model evaluation parse failed",
			rationale: `Failed to parse model response: ${error instanceof Error ? error.message : String(error)}`,
			evidence: [
				{
					type: method,
					description: "Model response could not be parsed",
					passageReferences: [],
					claimIds: [],
					sourceIds: [],
				},
			],
			passageReferences: [],
			repairAttempted: false,
			residualUncertainty:
				"Model evaluation unreliable due to parse failure",
			method,
			evaluatedAt: now,
			evaluatedBy: `${method}-evaluator`,
			visualizationReferences: [],
		};
	}
}

// ============================================================================
// Helper Functions
// ============================================================================

function summarizeFactDossierForDepth(dossier: CanonicalFactDossier): string {
	const technicalClaims: string[] = [];
	const researchClaims: string[] = [];

	for (const candidate of dossier.candidates) {
		for (const claim of candidate.claims) {
			if (claim.technicalContext) {
				technicalClaims.push(
					`${candidate.organizations.join(", ")}: ${claim.technicalContext.mechanism || "geen mechanisme"} (${claim.technicalContext.releaseMaturity || "onbekend"})`,
				);
			}
			if (claim.methodologicalContext || claim.strategicContext) {
				researchClaims.push(
					`${candidate.organizations.join(", ")}: ${claim.claimType} - ${claim.methodologicalContext?.methodology || claim.strategicContext?.researchPurpose || "geen context"}`,
				);
			}
		}
	}

	return [
		`Totaal kandidaten: ${dossier.editionSummary.totalCandidates}`,
		`Technische claims: ${technicalClaims.length}`,
		`Onderzoeksclaims: ${researchClaims.length}`,
		technicalClaims.slice(0, 10).join("\n"),
		researchClaims.slice(0, 10).join("\n"),
	].join("\n");
}

function summarizeResearchContext(dossier: CanonicalFactDossier): string {
	const researchCandidates = dossier.candidates.filter((c) =>
		c.claims.some((cl) =>
			[
				"scientific-research",
				"strategic-research",
				"advisory-finding",
				"benchmark-result",
				"productivity-claim",
				"roi-claim",
				"economic-impact",
			].includes(cl.claimType),
		),
	);

	if (researchCandidates.length === 0) {
		return "Geen wetenschappelijke/strategische onderzoeksclaims in dossier";
	}

	return researchCandidates
		.map((c) => {
			const claim = c.claims[0];
			return `${c.organizations.join(", ")} (${c.researchDomains[0]}): ${claim.claimType} - methodologie: ${claim.methodologicalContext?.methodology || "niet gespecificeerd"}, steekproef: ${claim.strategicContext?.sampleSize || "onbekend"}, causaliteit: ${claim.strategicContext?.causalClaimType || "niet gespecificeerd"}, onzekerheid: ${claim.strategicContext?.statisticalUncertainty || "niet gespecificeerd"}`;
		})
		.join("\n");
}

// ============================================================================
// Repair Mechanism
// ============================================================================

async function attemptRepair(
	ctx: EvaluationContext,
	evaluation: ReadableCriterionEvaluation,
	issueType:
		| "factual"
		| "structural"
		| "explanatory"
		| "stylistic"
		| "accessibility",
): Promise<ReadableRepairAction | null> {
	if (evaluation.status !== "FAIL" || evaluation.repairAttempted) {
		return null;
	}

	const repairActionId = generateRepairActionId();
	const now = new Date().toISOString();

	const affectedPassage = evaluation.passageReferences[0] || {
		characterOffset: 0,
		quote: "Onbekende passage",
	};

	const prompt = `Je bent een editor die een leesbare publicatie herstelt na een ${evaluation.criterionId} evaluatie falen.

ORIGINELE EVALUATIE:
- Criterium: ${evaluation.criterionId}
- Status: ${evaluation.status}
- Severity: ${evaluation.severity}
- Samenvatting: ${evaluation.summary}
- Rational: ${evaluation.rationale}
- Issue type: ${issueType}

BEINVLOEDDE PASSAGE:
${evaluation.passageReferences.map((p) => p.quote).join("\n---\n")}

NEDERLANDSE PUBLICATIE:
${ctx.dutchPublicationMarkdown}

${
	ctx.englishPublicationMarkdown
		? `ENGELSE PUBLICATIE:
${ctx.englishPublicationMarkdown}`
		: ""
}

FEITEN DOSSIER CONTEXT:
${summarizeFactDossierForDepth(ctx.factDossier)}

TAAK: Stel de KLEINSTE correctie voor die de defect VOLLEDIG adresseert.
- Behoud de canonieke feiten en editoriële selectie
- Voeg GEEN onondersteunde claims toe
- Verwijder GEEN materieel geselecteerde ontwikkelingen
- Wijzig GEEN bronattributie
- Wijzig GEEN numerieke bevindingen
- Onderdruk GEEN belangrijke beperkingen
- Wijzig GEEN upstream bewijs
- Vervang GEEN editoriële selectie
- Behoud tweetalige consistentie

Geef je voorstel in JSON formaat:
{
  "proposedCorrection": "Exacte voorgestelde tekstwijziging",
  "preservesCanonicalFacts": true,
  "preservesEditorialSelection": true,
  "preservesBilingualConsistency": true,
  "issueType": "${issueType}",
  "problemDescription": "Korte beschrijving van het observeerbare probleem"
}`;

	const result = await callLLMWithRetry(
		ctx,
		prompt,
		`repair-${evaluation.criterionId}`,
	);
	let proposedCorrection = "";
	let preservesCanonicalFacts = true;
	let preservesEditorialSelection = true;
	let preservesBilingualConsistency = true;
	let problemDescription = evaluation.summary;

	try {
		const jsonMatch = result.content.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0]);
			proposedCorrection = parsed.proposedCorrection || "";
			preservesCanonicalFacts = parsed.preservesCanonicalFacts !== false;
			preservesEditorialSelection =
				parsed.preservesEditorialSelection !== false;
			preservesBilingualConsistency =
				parsed.preservesBilingualConsistency !== false;
			problemDescription =
				parsed.problemDescription || evaluation.summary;
		}
	} catch {
		// Use fallback
	}

	let appliedCorrection: string | undefined;
	let status: RepairActionStatus = "proposed";

	if (
		proposedCorrection &&
		proposedCorrection.length > 0 &&
		preservesCanonicalFacts &&
		preservesEditorialSelection &&
		preservesBilingualConsistency
	) {
		const originalMarkdown = ctx.dutchPublicationMarkdown;
		let newMarkdown = originalMarkdown;

		if (affectedPassage.quote && affectedPassage.quote.length > 10) {
			const quoteIndex = newMarkdown.indexOf(affectedPassage.quote);
			if (quoteIndex >= 0) {
				newMarkdown =
					newMarkdown.slice(0, quoteIndex) +
					proposedCorrection +
					newMarkdown.slice(
						quoteIndex + affectedPassage.quote.length,
					);
				appliedCorrection = proposedCorrection;
				status = "applied";
				ctx.dutchPublicationMarkdown = newMarkdown;
			}
		}
	} else {
		status = "rejected";
	}

	if (!proposedCorrection || proposedCorrection.length === 0) {
		return null;
	}

	const repairAction: ReadableRepairAction = {
		repairActionId,
		criterionId: evaluation.criterionId,
		evaluationId: evaluation.evaluationId,
		issueType,
		problemDescription,
		affectedPassage,
		proposedCorrection,
		preservesCanonicalFacts,
		preservesEditorialSelection,
		preservesBilingualConsistency,
		status,
		appliedCorrection,
		proposedAt: now,
		appliedAt: status === "applied" ? now : undefined,
		regressionChecks: [],
		residualUncertainty:
			status === "applied"
				? "Repair applied; re-evaluation needed"
				: "Repair proposed but not applied",
	};

	return repairAction;
}

async function runRegressionChecks(
	ctx: EvaluationContext,
	repairAction: ReadableRepairAction,
): Promise<Array<{ check: string; passed: boolean; details?: string }>> {
	const checks: Array<{ check: string; passed: boolean; details?: string }> =
		[];

	// Check that all selected stories still covered
	const coverageCheck = checkSelectedStoryCoverage(ctx);
	checks.push({
		check: "Selected story coverage",
		passed: coverageCheck.passed,
		details: coverageCheck.details,
	});

	// Check factual consistency
	const factualCheck = checkFactualConsistency(ctx);
	checks.push({
		check: "Factual consistency",
		passed: factualCheck.passed,
		details: factualCheck.details,
	});

	// Check first screen clarity
	const screenCheck = checkFirstScreenClarity(ctx);
	checks.push({
		check: "First screen clarity",
		passed: screenCheck.passed,
		details: screenCheck.details,
	});

	// Check source transparency
	const sourceCheck = checkSourceTransparency(ctx);
	checks.push({
		check: "Source transparency",
		passed: sourceCheck.passed,
		details: sourceCheck.details,
	});

	// Check bilingual consistency if English present
	if (ctx.englishPublicationMarkdown) {
		const bilingualCheck = checkBilingualConsistency(ctx);
		checks.push({
			check: "Bilingual consistency",
			passed: bilingualCheck.passed,
			details: bilingualCheck.details,
		});
	}

	return checks;
}

// ============================================================================
// Main Evaluation Function
// ============================================================================

export async function evaluateReadableQuality(
	input: ReadableQualityEvaluationInput,
): Promise<ReadableQualityEvaluationReport> {
	const {
		editionDate,
		editionId,
		dutchPublicationMarkdown,
		dutchPublicationArtifactId,
		dutchPublicationTraceability,
		englishPublicationMarkdown,
		englishPublicationArtifactId,
		englishPublicationTraceability,
		factDossier,
		editorialManifest,
		historicalRegression,
		publicationMetadata,
		articleIdentities,
		visualizations,
		validationMode = false,
	} = input;

	// Initialize LLM client
	const llmClient = createFreeLLMClient(getDefaultLLMConfig());

	// Validate configuration
	const validation = await llmClient.validate();
	if (!validation.valid && !validationMode) {
		throw new Error(
			`LLM client validation failed: ${validation.errors.join(", ")}`,
		);
	}

	// Initialize context
	const ctx: EvaluationContext = {
		editionDate,
		editionId,
		dutchPublicationMarkdown,
		dutchPublicationArtifactId,
		dutchPublicationTraceability,
		englishPublicationMarkdown,
		englishPublicationArtifactId,
		englishPublicationTraceability,
		factDossier,
		editorialManifest,
		historicalRegression,
		publicationMetadata,
		articleIdentities,
		visualizations,
		validationMode,
		llmClient,
		criterionEvaluations: [],
		repairActions: [],
		llmStats: {
			requests: 0,
			tokens: 0,
			providersUsed: [],
			cacheHits: 0,
		},
	};

	if (validationMode) {
		ctx.llmClient.setValidationMode(true);
	}

	// Run deterministic checks first
	const deterministicChecks: Array<{
		criterionId: ReadableCriterionId;
		check: () => DeterministicCheckResult;
	}> = [
		{ criterionId: "RPE1", check: () => checkFirstScreenClarity(ctx) },
		{ criterionId: "RPE6", check: () => checkSelectedStoryCoverage(ctx) },
		{ criterionId: "RPE6", check: () => checkFactualConsistency(ctx) },
		{ criterionId: "RPE7", check: () => checkSourceTransparency(ctx) },
		{ criterionId: "RPE3", check: () => checkCognitiveAccessibility(ctx) },
		{ criterionId: "RPE4", check: () => checkTechnicalDepth(ctx) },
		{ criterionId: "RPE5", check: () => checkResearchQuality(ctx) },
		{ criterionId: "RPE8", check: () => checkEditorialCoherence(ctx) },
		{ criterionId: "RPE9", check: () => checkVendorNeutrality(ctx) },
		{ criterionId: "RPE10", check: () => checkVisualIntegration(ctx) },
		{ criterionId: "RPE11", check: () => checkWcagContent(ctx) },
		{ criterionId: "RPE14", check: () => checkBilingualConsistency(ctx) },
	];

	const deterministicResults = new Map<
		ReadableCriterionId,
		DeterministicCheckResult
	>();

	for (const { criterionId, check } of deterministicChecks) {
		const result = check();
		const existing = deterministicResults.get(criterionId);
		if (!existing || !result.passed) {
			deterministicResults.set(criterionId, result);
		}
	}

	// Create evaluations for deterministic criteria
	const now = new Date().toISOString();
	for (const [criterionId, result] of deterministicResults) {
		const evaluationId = generateEvaluationId();

		// Special handling for RPE14 when no English publication
		let status: CriterionEvaluationStatus = result.passed ? "PASS" : "FAIL";
		let severity: SeverityLevel | undefined = result.passed
			? undefined
			: criterionId === "RPE6"
				? "CRITICAL"
				: "MAJOR";
		let residualUncertainty = result.passed
			? undefined
			: "Deterministic check failed; manual review recommended";

		if (
			criterionId === "RPE14" &&
			(!ctx.englishPublicationMarkdown ||
				!ctx.englishPublicationTraceability)
		) {
			status = "NOT_ASSESSABLE";
			severity = undefined;
			residualUncertainty =
				"Engelse publicatie niet beschikbaar voor cross-taal consistentie evaluatie";
		}

		const evaluation: ReadableCriterionEvaluation = {
			criterionId,
			evaluationId,
			status,
			severity,
			scope: criterionId === "RPE1" ? "opening-screen" : "full-edition",
			language: criterionId === "RPE14" ? "both" : "nl",
			summary: result.details,
			rationale: `Deterministic check: ${result.details}`,
			evidence: result.evidence,
			passageReferences: result.passageReferences,
			repairAttempted: false,
			residualUncertainty,
			method: "deterministic",
			evaluatedAt: now,
			evaluatedBy: "deterministic-checker",
			visualizationReferences: [],
		};
		ctx.criterionEvaluations.push(evaluation);
	}

	// Run model-assisted evaluations for remaining criteria
	const modelAssistedCriteria: Array<{
		id: ReadableCriterionId;
		fn: (ctx: EvaluationContext) => Promise<ReadableCriterionEvaluation>;
	}> = [
		{ id: "RPE1", fn: evaluateRPE1_FirstScreenClarity },
		{ id: "RPE2", fn: evaluateRPE2_ProgressiveDisclosure },
		{ id: "RPE3", fn: evaluateRPE3_CognitiveAccessibility },
		{ id: "RPE4", fn: evaluateRPE4_TechnicalDepth },
		{ id: "RPE5", fn: evaluateRPE5_ResearchQuality },
		{ id: "RPE8", fn: evaluateRPE8_EditorialCoherence },
		{ id: "RPE9", fn: evaluateRPE9_VendorNeutrality },
		{ id: "RPE12", fn: evaluateRPE12_BilingualDutch },
		{ id: "RPE13", fn: evaluateRPE13_BilingualEnglish },
		{ id: "RPE14", fn: evaluateRPE14_CrossLanguageConsistency },
	];

	for (const { id, fn } of modelAssistedCriteria) {
		// Skip if already evaluated deterministically
		if (ctx.criterionEvaluations.some((e) => e.criterionId === id))
			continue;

		let evaluation: ReadableCriterionEvaluation;
		try {
			evaluation = await fn(ctx);
		} catch (error) {
			// Fallback on error
			evaluation = {
				criterionId: id,
				evaluationId: generateEvaluationId(),
				status: "UNVERIFIED",
				scope: "full-edition",
				language:
					id === "RPE14"
						? "both"
						: id === "RPE13"
							? "en"
							: id === "RPE12"
								? "nl"
								: "both",
				summary: "Model evaluation failed",
				rationale: `Model evaluation error: ${error instanceof Error ? error.message : String(error)}`,
				evidence: [
					{
						type: "model-assisted",
						description: "Model evaluation error",
						passageReferences: [],
						claimIds: [],
						sourceIds: [],
					},
				],
				passageReferences: [],
				repairAttempted: false,
				residualUncertainty: "Model evaluation failed",
				method: "model-assisted",
				evaluatedAt: new Date().toISOString(),
				evaluatedBy: "model-assisted-evaluator",
				visualizationReferences: [],
			};
		}

		ctx.criterionEvaluations.push(evaluation);

		// Attempt repair for failures
		if (
			evaluation.status === "FAIL" &&
			evaluation.severity &&
			["CRITICAL", "MAJOR"].includes(evaluation.severity)
		) {
			let issueType:
				| "factual"
				| "structural"
				| "explanatory"
				| "stylistic"
				| "accessibility";
			switch (id) {
				case "RPE1":
					issueType = "structural";
					break;
				case "RPE2":
					issueType = "structural";
					break;
				case "RPE3":
					issueType = "accessibility";
					break;
				case "RPE4":
					issueType = "explanatory";
					break;
				case "RPE5":
					issueType = "explanatory";
					break;
				case "RPE6":
					issueType = "factual";
					break;
				case "RPE7":
					issueType = "structural";
					break;
				case "RPE8":
					issueType = "structural";
					break;
				case "RPE9":
					issueType = "explanatory";
					break;
				case "RPE10":
					issueType = "structural";
					break;
				case "RPE11":
					issueType = "accessibility";
					break;
				case "RPE12":
					issueType = "stylistic";
					break;
				case "RPE13":
					issueType = "stylistic";
					break;
				case "RPE14":
					issueType = "factual";
					break;
				default:
					issueType = "explanatory";
			}

			const repairAction = await attemptRepair(
				ctx,
				evaluation,
				issueType,
			);
			if (repairAction) {
				ctx.repairActions.push(repairAction);
				evaluation.repairAttempted = true;
				evaluation.repairActionId = repairAction.repairActionId;

				if (repairAction.status === "applied") {
					const regressionChecks = await runRegressionChecks(
						ctx,
						repairAction,
					);
					repairAction.regressionChecks = regressionChecks;

					// Re-run the deterministic check for this criterion if applicable
					const reEvalResult = deterministicResults.get(id) || {
						passed: false,
						details: "",
						passageReferences: [],
						evidence: [],
					};
					const reassessment: ReadableCriterionEvaluation["reassessment"] =
						{
							status: reEvalResult.passed ? "PASS" : "FAIL",
							summary: reEvalResult.passed
								? "Repair successful; criterion now passes"
								: "Repair applied but criterion still fails",
							reassessedAt: new Date().toISOString(),
						};
					evaluation.reassessment = reassessment;
				}
			}
		}
	}

	// Ensure all 14 criteria have evaluations (fill gaps with UNVERIFIED)
	for (const criterionId of READABLE_CRITERIA) {
		if (
			!ctx.criterionEvaluations.some((e) => e.criterionId === criterionId)
		) {
			ctx.criterionEvaluations.push({
				criterionId,
				evaluationId: generateEvaluationId(),
				status: "UNVERIFIED",
				scope: "full-edition",
				language:
					criterionId === "RPE14"
						? "both"
						: criterionId === "RPE13"
							? "en"
							: criterionId === "RPE12"
								? "nl"
								: "both",
				summary: "Criterion not evaluated",
				rationale:
					"No evaluation method available for this criterion in current implementation",
				evidence: [],
				passageReferences: [],
				repairAttempted: false,
				residualUncertainty: "Criterion evaluation not implemented",
				method: "deterministic",
				evaluatedAt: now,
				evaluatedBy: "evaluator",
				visualizationReferences: [],
			});
		}
	}

	// Sort evaluations by criterion order
	ctx.criterionEvaluations.sort(
		(a, b) =>
			READABLE_CRITERIA.indexOf(a.criterionId) -
			READABLE_CRITERIA.indexOf(b.criterionId),
	);

	// Compute overall summary
	const passedCount = ctx.criterionEvaluations.filter(
		(e) => e.status === "PASS",
	).length;
	const failedCount = ctx.criterionEvaluations.filter(
		(e) => e.status === "FAIL",
	).length;
	const unverifiedCount = ctx.criterionEvaluations.filter(
		(e) => e.status === "UNVERIFIED",
	).length;
	const notAssessableCount = ctx.criterionEvaluations.filter(
		(e) => e.status === "NOT_ASSESSABLE",
	).length;
	const criticalFailures = ctx.criterionEvaluations.filter(
		(e) => e.severity === "CRITICAL",
	).length;
	const majorFailures = ctx.criterionEvaluations.filter(
		(e) => e.severity === "MAJOR",
	).length;
	const repairActionsTaken = ctx.repairActions.length;
	const repairActionsSuccessful = ctx.repairActions.filter(
		(r) => r.status === "applied",
	).length;
	const blockingAcceptance =
		criticalFailures > 0 ||
		(majorFailures > 0 && repairActionsSuccessful === 0);

	const overallSummary: OverallSummary = {
		passedCount,
		failedCount,
		unverifiedCount,
		notAssessableCount,
		criticalFailures,
		majorFailures,
		blockingAcceptance,
		repairActionsTaken,
		repairActionsSuccessful,
	};

	const metadata: EvaluationMetadata = {
		evaluatedAt: now,
		evaluatedBy: "readable-quality-evaluator",
		modelAssistedEvaluations: ctx.criterionEvaluations.filter(
			(e) => e.method === "model-assisted",
		).length,
		deterministicEvaluations: ctx.criterionEvaluations.filter(
			(e) => e.method === "deterministic",
		).length,
		totalInferenceRequests: ctx.llmStats.requests,
		totalInferenceTokens: ctx.llmStats.tokens,
		inferenceProvidersUsed: ctx.llmStats.providersUsed,
		validationMode,
	};

	// Build report
	const reportWithoutHash: Omit<
		ReadableQualityEvaluationReport,
		"contentHash"
	> = {
		schemaVersion: READABLE_QUALITY_EVALUATION_SCHEMA_VERSION,
		reportId: generateReportId(),
		editionId,
		editionDate,
		dutchPublicationArtifactId,
		englishPublicationArtifactId,
		factDossierId: factDossier.dossierId,
		editorialSelectionManifestId: editorialManifest.manifestId,
		criterionEvaluations: ctx.criterionEvaluations,
		repairActions: ctx.repairActions,
		overallSummary,
		metadata,
	};

	const contentHash = computeContentHash(JSON.stringify(reportWithoutHash));

	const report: ReadableQualityEvaluationReport = {
		...reportWithoutHash,
		contentHash,
	};

	// Validate report
	ReadableQualityEvaluationReportSchema.parse(report);

	return report;
}

// ============================================================================
// Persistence
// ============================================================================

export async function persistEvaluationReport(
	editionDate: string,
	report: ReadableQualityEvaluationReport,
): Promise<string> {
	await fs.mkdir(EVALUATION_DIR, { recursive: true });
	await fs.mkdir(CHECKPOINT_DIR, { recursive: true });

	const filename = `${editionDate}_${report.reportId}.json`;
	const filepath = join(EVALUATION_DIR, filename);

	await fs.writeFile(filepath, JSON.stringify(report, null, 2), "utf-8");
	return filepath;
}

export async function loadEvaluationReport(
	editionDate: string,
	reportId: string,
): Promise<ReadableQualityEvaluationReport | null> {
	const filename = `${editionDate}_${reportId}.json`;
	const filepath = join(EVALUATION_DIR, filename);

	try {
		const content = await fs.readFile(filepath, "utf-8");
		return JSON.parse(content);
	} catch {
		return null;
	}
}

export async function listEvaluationReports(
	editionDate: string,
): Promise<string[]> {
	try {
		const files = await fs.readdir(EVALUATION_DIR);
		return files
			.filter(
				(f) => f.startsWith(`${editionDate}_`) && f.endsWith(".json"),
			)
			.map((f) => f.replace(`${editionDate}_`, "").replace(".json", ""))
			.sort();
	} catch {
		return [];
	}
}
