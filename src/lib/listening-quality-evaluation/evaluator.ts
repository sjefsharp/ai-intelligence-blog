/**
 * Listening Quality Evaluation — Core Evaluator
 *
 * Implements the Q1-Q10 listening quality evaluation framework for the
 * independently authored Dutch AI Intelligence narrative. Combines deterministic
 * checks with model-assisted editorial assessments.
 */

import { createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "astro/zod";

import type {
	CanonicalFactDossier,
	CanonicalCandidate,
	ConsolidatedClaim,
	VerificationLevel,
	EvidenceClassification,
} from "../fact-dossier/schema.js";
import type {
	EditorialSelectionManifest,
	EditorialStory,
	EditorialCandidateAssessment,
} from "../editorial-selection/schema.js";
import type { HistoricalRegressionReport } from "../historical-regression/schema.js";
import type {
	ArticleIdentity,
	PublicationMetadata,
} from "../publication/schema.js";
import {
	createFreeLLMClient,
	type LLMClientConfig,
	type LLMResponse,
} from "../free-llm-client.js";
import {
	LISTENING_QUALITY_EVALUATION_SCHEMA_VERSION,
	EVALUATION_REPORT_ID_PREFIX,
	CRITERION_EVALUATION_ID_PREFIX,
	REPAIR_ACTION_ID_PREFIX,
	Q_CRITERIA,
	ALL_CRITERIA,
	CriterionEvaluationStatusSchema,
	SeverityLevelSchema,
	EvaluationMethodSchema,
	RepairActionStatusSchema,
	EvaluationScopeSchema,
	type CriterionId,
	type CriterionEvaluationStatus,
	type SeverityLevel,
	type EvaluationMethod,
	type RepairActionStatus,
	type EvaluationScope,
	type CriterionEvaluation,
	type RepairAction,
	type ListeningQualityEvaluationReport,
	type ListeningQualityEvaluationInput,
	type OverallSummary,
	type EvaluationMetadata,
	type PassageReference,
	type EvaluationEvidence,
	type NarrativeSegmentTrace,
	type ListeningNarrativeTraceability,
	CriterionEvaluationSchema,
	RepairActionSchema,
	ListeningQualityEvaluationReportSchema,
	generateListeningQualityEvaluationJsonSchema,
} from "./schema.js";

export type { ListeningQualityEvaluationInput } from "./schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..", "..", "..");
const DATA_DIR = join(PROJECT_ROOT, "data");
const EVALUATION_DIR = join(DATA_DIR, "listening-quality-evaluations");
const CHECKPOINT_DIR = join(
	DATA_DIR,
	"checkpoints",
	"listening-quality-evaluation",
);

// ============================================================================
// Helper Types
// ============================================================================

interface EvaluationContext {
	editionDate: string;
	editionId: string;
	listeningNarrativeMarkdown: string;
	listeningNarrativeArtifactId: string;
	listeningNarrativeTraceability: ListeningNarrativeTraceability;
	factDossier: CanonicalFactDossier;
	editorialManifest: EditorialSelectionManifest;
	historicalRegression: HistoricalRegressionReport | null;
	publicationMetadata: PublicationMetadata;
	articleIdentities: ArticleIdentity[];
	validationMode: boolean;
	llmClient: ReturnType<typeof createFreeLLMClient>;
	criterionEvaluations: CriterionEvaluation[];
	repairActions: RepairAction[];
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
		budget: { maxRequests: 30, maxTokens: 80000, maxCostUsd: 0 },
		deterministic: true,
		enableCache: true,
		enableCheckpoints: true,
	}).getConfig();
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateEvaluationId(): string {
	return `${CRITERION_EVALUATION_ID_PREFIX}${randomBytes(8).toString("hex")}`;
}

function generateRepairActionId(): string {
	return `${REPAIR_ACTION_ID_PREFIX}${randomBytes(8).toString("hex")}`;
}

function generateReportId(): string {
	return `${EVALUATION_REPORT_ID_PREFIX}${randomBytes(8).toString("hex")}`;
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
				"Je bent een expert editor die luisterteksten evalueert op feitengetrouwheid, technisch diepgang, narratieve coherentie en cognitieve toegankelijkheid voor volwassen luisteraars (inclusief ADHD-karakteristieken). Je antwoordeert in het Nederlands met gestructureerde, bewijs-gebaseerde bevindingen.",
		},
		{ role: "user" as const, content: prompt },
	];

	const response = await ctx.llmClient.request(messages, {
		temperature: 0.1,
		maxTokens: 4000,
		checkpointId: `lqe-${segmentType}`,
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
 * Q3: Check for operational/audit commentary in the narrative.
 */
function checkOperationalCommentary(
	ctx: EvaluationContext,
): DeterministicCheckResult {
	const forbiddenPatterns: RegExp[] = [
		/pipeline/i,
		/uitvoering/i,
		/uitvoeringsstatus/i,
		/bronverzameling/i,
		/broncollectie/i,
		/model.*gebruik/i,
		/provider.*gebruik/i,
		/tool.*invocat/i,
		/acceptatie.*poort/i,
		/acceptatiegate/i,
		/bestand.*naam/i,
		/artefact.*pad/i,
		/audit.*instruct/i,
		/publicatie.*werkstroom/i,
		/interne.*review/i,
		/validatie.*proces/i,
		/evaluatie.*proces/i,
		/onderzoeksuitvoering/i,
		/checkpoint/i,
		/cache.*hit/i,
		/token.*budget/i,
		/inferentie.*request/i,
	];

	const refs: PassageReference[] = [];
	const evidence: EvaluationEvidence[] = [];
	let passed = true;

	for (const pattern of forbiddenPatterns) {
		const matches = findPassageReferences(ctx.listeningNarrativeMarkdown, [
			pattern,
		]);
		if (matches.length > 0) {
			passed = false;
			refs.push(...matches);
			evidence.push({
				type: "deterministic",
				description: `Operationale term gedetecteerd in narratief`,
				passageReferences: matches,
				claimIds: [],
				sourceIds: [],
			});
		}
	}

	return {
		passed,
		details: passed
			? "Geen operationele commentaar gedetecteerd"
			: "Operationele commentaar gevonden",
		passageReferences: refs,
		evidence,
	};
}

/**
 * Q5: Check that all selected stories are covered in the narrative.
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
		const matches = findPassageReferences(ctx.listeningNarrativeMarkdown, [
			orgNames,
		]);
		if (matches.length === 0) {
			passed = false;
			evidence.push({
				type: "deterministic",
				description: `Geselecteerde story ${story.storyId} (${orgNames}) niet gevonden in luisternarratief`,
				passageReferences: [],
				claimIds: story.claimIds,
				sourceIds: story.sourceIds,
			});
		} else {
			refs.push(...matches);
		}
	}

	return {
		passed,
		details: passed
			? `Alle ${selectedStories.length} geselecteerde verhalen gedekt`
			: `${selectedStories.length - refs.length} geselecteerde verhalen ontbreken`,
		passageReferences: refs,
		evidence,
	};
}

/**
 * Q5: Check factual consistency against canonical dossier.
 */
function checkFactualConsistency(
	ctx: EvaluationContext,
): DeterministicCheckResult {
	const refs: PassageReference[] = [];
	const evidence: EvaluationEvidence[] = [];
	let passed = true;

	// Check that candidate organizations appear in narrative
	const allOrgs = new Set<string>();
	for (const candidate of ctx.factDossier.candidates) {
		for (const org of candidate.organizations) {
			allOrgs.add(org);
		}
	}

	for (const org of allOrgs) {
		if (
			!ctx.listeningNarrativeMarkdown
				.toLowerCase()
				.includes(org.toLowerCase())
		) {
			passed = false;
			evidence.push({
				type: "deterministic",
				description: `Organisatie "${org}" uit feiten dossier niet in luisternarratief`,
				passageReferences: [],
				claimIds: [],
				sourceIds: [],
			});
		}
	}

	// Check that claim IDs are referenced in traceability
	const traceabilityClaims = new Set(
		ctx.listeningNarrativeTraceability.claimCoverage,
	);
	for (const candidate of ctx.factDossier.candidates) {
		for (const claim of candidate.claims) {
			if (!traceabilityClaims.has(claim.claimId)) {
				evidence.push({
					type: "deterministic",
					description: `Claim ${claim.claimId} niet in traceability van luisternarratief`,
					passageReferences: [],
					claimIds: [claim.claimId],
					sourceIds: [],
				});
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
 * Q3: Check for spoken URLs or citation strings.
 */
function checkSpokenReferences(
	ctx: EvaluationContext,
): DeterministicCheckResult {
	const urlPattern = /https?:\/\/[^\s]+/g;
	const citationPattern =
		/\b(claim_|cand_|disc_|ev_|story_|art_)[a-z0-9]{16}\b/g;

	const urls = ctx.listeningNarrativeMarkdown.match(urlPattern) || [];
	const citations =
		ctx.listeningNarrativeMarkdown.match(citationPattern) || [];

	const refs: PassageReference[] = [];
	const evidence: EvaluationEvidence[] = [];
	let passed = true;

	if (urls.length > 0) {
		passed = false;
		for (const url of urls.slice(0, 5)) {
			const matches = findPassageReferences(
				ctx.listeningNarrativeMarkdown,
				[url],
			);
			refs.push(...matches);
			evidence.push({
				type: "deterministic",
				description: `URL in luisternarratief: ${url}`,
				passageReferences: matches,
				claimIds: [],
				sourceIds: [],
			});
		}
	}

	if (citations.length > 0) {
		passed = false;
		for (const cit of citations.slice(0, 5)) {
			const matches = findPassageReferences(
				ctx.listeningNarrativeMarkdown,
				[cit],
			);
			refs.push(...matches);
			evidence.push({
				type: "deterministic",
				description: `Citatie-identifier in luisternarratief: ${cit}`,
				passageReferences: matches,
				claimIds: [],
				sourceIds: [],
			});
		}
	}

	return {
		passed,
		details: passed
			? "Geen gesproken URLs of citaties"
			: `${urls.length} URLs, ${citations.length} citaties gedetecteerd`,
		passageReferences: refs,
		evidence,
	};
}

/**
 * Q4: Check narrative independence from technical newsletter structure.
 */
function checkNarrativeIndependence(
	ctx: EvaluationContext,
): DeterministicCheckResult {
	const newsletterStructuralMarkers: RegExp[] = [
		/^## Inleiding$/m,
		/^## Verhalen$/m,
		/^#### Wat is veranderd$/m,
		/^#### Waarom dit belangrijk is$/m,
		/^#### Hoe het werkt$/m,
		/^#### Beperkingen en tegenbewijs$/m,
		/^#### Bronnen$/m,
		/^## Navigatie$/m,
		/\[Research Audit\]/,
		/\[Luisterverhaal\]/,
	];

	const refs: PassageReference[] = [];
	const evidence: EvaluationEvidence[] = [];
	let passed = true;
	let matchedMarkers = 0;

	for (const pattern of newsletterStructuralMarkers) {
		const matches = findPassageReferences(ctx.listeningNarrativeMarkdown, [
			pattern,
		]);
		if (matches.length > 0) {
			matchedMarkers++;
			refs.push(...matches);
			evidence.push({
				type: "deterministic",
				description: `Newsletter structurele marker gedetecteerd`,
				passageReferences: matches,
				claimIds: [],
				sourceIds: [],
			});
		}
	}

	// More than 3 structural matches suggests mechanical copying
	if (matchedMarkers > 3) {
		passed = false;
	}

	return {
		passed,
		details: passed
			? "Narratief structureel onafhankelijk van newsletter"
			: `${matchedMarkers} newsletter structurele markers gedetecteerd`,
		passageReferences: refs,
		evidence,
	};
}

/**
 * Q6: Check for editorial self-commentary.
 */
function checkEditorialSelfCommentary(
	ctx: EvaluationContext,
): DeterministicCheckResult {
	const selfCommentaryPatterns: RegExp[] = [
		/waarom.*geselecteerd/i,
		/hoe.*gestructureerd/i,
		/waarom.*onderwerp.*aandacht/i,
		/hoeveel.*inspanning/i,
		/onderzoek.*editie/i,
		/ik ga.*bespreken/i,
		/ik zal.*uitwerken/i,
		/we gaan.*kijken/i,
		/deze editie.*bevat/i,
		/de selectie.*omvat/i,
		/de keuze.*voor/i,
		/editorieel.*besluit/i,
	];

	const refs: PassageReference[] = [];
	const evidence: EvaluationEvidence[] = [];
	let passed = true;

	for (const pattern of selfCommentaryPatterns) {
		const matches = findPassageReferences(ctx.listeningNarrativeMarkdown, [
			pattern,
		]);
		if (matches.length > 0) {
			passed = false;
			refs.push(...matches);
			evidence.push({
				type: "deterministic",
				description: `Editorieel zelfcommentaar patroon gedetecteerd`,
				passageReferences: matches,
				claimIds: [],
				sourceIds: [],
			});
		}
	}

	return {
		passed,
		details: passed
			? "Geen editorieel zelfcommentaar"
			: "Editorieel zelfcommentaar gedetecteerd",
		passageReferences: refs,
		evidence,
	};
}

/**
 * Q7: Check opening quality.
 */
function checkOpeningQuality(ctx: EvaluationContext): DeterministicCheckResult {
	const openingSection =
		ctx.listeningNarrativeMarkdown.split("## Verhaal")[0];
	const refs: PassageReference[] = [];
	const evidence: EvaluationEvidence[] = [];
	let passed = true;

	// Check for generic intro patterns
	const genericPatterns = [
		/goedemorgen.*dit is/i,
		/welkom bij/i,
		/in deze editie/i,
		/vandaag hebben we/i,
	];

	let hasGenericIntro = false;
	for (const pattern of genericPatterns) {
		if (pattern.test(openingSection)) {
			hasGenericIntro = true;
			break;
		}
	}

	// Check for concrete news lead
	const hasConcreteLead =
		ctx.editorialManifest.stories.length > 0 &&
		ctx.editorialManifest.stories[0].organizations.some((org) =>
			openingSection.toLowerCase().includes(org.toLowerCase()),
		);

	if (hasGenericIntro && !hasConcreteLead) {
		passed = false;
		evidence.push({
			type: "deterministic",
			description:
				"Opening bevat generieke intro zonder concrete leidende nieuws",
			passageReferences: findPassageReferences(openingSection, [""]),
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

	return {
		passed,
		details: passed
			? "Opening bevat concrete leidende ontwikkeling"
			: "Opening voldoet niet aan concrete lead eis",
		passageReferences: refs,
		evidence,
	};
}

/**
 * Q10: Check for mandatory architecture lesson.
 */
function checkMandatoryArchitectureLesson(
	ctx: EvaluationContext,
): DeterministicCheckResult {
	const architectureLessonPatterns: RegExp[] = [
		/architectuur.*les/i,
		/architectuurprincipe/i,
		/governance.*conclusie/i,
		/samenvattend.*architectuur/i,
		/lessen.*voor.*architectuur/i,
		/algemene.*principes/i,
		/software.*engineering.*advies/i,
		/agent.*orchestratie.*les/i,
	];

	const refs: PassageReference[] = [];
	const evidence: EvaluationEvidence[] = [];
	let passed = true;

	for (const pattern of architectureLessonPatterns) {
		const matches = findPassageReferences(ctx.listeningNarrativeMarkdown, [
			pattern,
		]);
		if (matches.length > 0) {
			passed = false;
			refs.push(...matches);
			evidence.push({
				type: "deterministic",
				description: `Mogelijk verplichte architectuurles patroon gedetecteerd`,
				passageReferences: matches,
				claimIds: [],
				sourceIds: [],
			});
		}
	}

	return {
		passed,
		details: passed
			? "Geen verplichte architectuurles gedetecteerd"
			: "Architectuurles patronen gedetecteerd",
		passageReferences: refs,
		evidence,
	};
}

/**
 * Q3: Check for visual references.
 */
function checkVisualReferences(
	ctx: EvaluationContext,
): DeterministicCheckResult {
	const visualPatterns: RegExp[] = [
		/zie (het )?(diagram|figuur|tabel|grafiek|schema|illustratie)/i,
		/in (het )?(diagram|figuur|tabel|grafiek|schema) (wordt|staat)/i,
		/zoals (in|op) (het )?(diagram|figuur|tabel|grafiek|schema)/i,
		/onderstaand (diagram|figuur|tabel|grafiek|schema)/i,
		/bovenstaand (diagram|figuur|tabel|grafiek|schema)/i,
	];

	const refs: PassageReference[] = [];
	const evidence: EvaluationEvidence[] = [];
	let passed = true;

	for (const pattern of visualPatterns) {
		const matches = findPassageReferences(ctx.listeningNarrativeMarkdown, [
			pattern,
		]);
		if (matches.length > 0) {
			passed = false;
			refs.push(...matches);
			evidence.push({
				type: "deterministic",
				description: `Visuele referentie gedetecteerd`,
				passageReferences: matches,
				claimIds: [],
				sourceIds: [],
			});
		}
	}

	return {
		passed,
		details: passed
			? "Geen visuele referenties"
			: "Visuele referenties gedetecteerd",
		passageReferences: refs,
		evidence,
	};
}

// ============================================================================
// Model-Assisted Evaluations
// ============================================================================

async function evaluateQ1_TerminologyExplained(
	ctx: EvaluationContext,
): Promise<CriterionEvaluation> {
	const prompt = `Evalueer criterium Q1: "Nodige terminologie uitgelegd" voor het volgende luisternarratief.

CRITERIUM Q1: Verifieer dat onbekende technische termen, acroniemen en gespecialiseerde concepten een accurate uitleg krijgen bij hun eerste betekenisvolle voorkomen.

Evalueer of:
- Essentiële concepten worden geïntroduceerd VOORDAT ze gebruikt worden
- Terminologie wordt uitgelegd in natuurlijk gesproken Nederlands
- Definities technisch accurate blijven
- Oorspronkelijke Engelse terminologie behouden blijft waar dat precisie verbetert
- Acroniemen NIET in cognitief veeleisende reeksen geïntroduceerd worden
- Eerder geïntroduceerde concepten NIET herhaaldelijk uitgelegd worden zonder reden

LUISTERNARRATIEF:
${ctx.listeningNarrativeMarkdown}

BESCHIKBARE TERMINOLOGIE (uit feiten dossier):
${extractTerminology(ctx.factDossier)}

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

	const result = await callLLMWithRetry(ctx, prompt, "Q1");
	const evaluation = parseModelEvaluation(
		result.content,
		"Q1",
		"model-assisted",
		ctx,
	);
	return evaluation;
}

async function evaluateQ2_ContextBeforeComplexity(
	ctx: EvaluationContext,
): Promise<CriterionEvaluation> {
	const prompt = `Evalueer criterium Q2: "Context voor complexiteit" voor het volgende luisternarratief.

CRITERIUM Q2: Verifieer dat de luisteraar voldoende conceptuele context ontvangt VOORDAT complexe technische mechanismen, wetenschappelijke bevindingen of strategische implicaties geïntroduceerd worden.

Evalueer of:
- Het relevante probleem of de situatie eerst gevestigd wordt
- De luisteraar begrijpt waar de ontwikkeling over gaat
- Technische mechanismen een begrijpelijke conceptuele progressie volgen
- Nieuwe informatie opbouwt op eerder uitgelegde concepten
- Onderzoeksbevindingen geïntroduceerd worden met de relevante onderzoeksvraag
- Cijfers en benchmarks gecontextualiseerd worden VOOR interpretatie

Identificeer passages waar complexiteit verschijnt VOÓÓR de benodigde uitleg.

LUISTERNARRATIEF:
${ctx.listeningNarrativeMarkdown}

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

	const result = await callLLMWithRetry(ctx, prompt, "Q2");
	return parseModelEvaluation(result.content, "Q2", "model-assisted", ctx);
}

async function evaluateQ4_AudioFirstIndependence(
	ctx: EvaluationContext,
): Promise<CriterionEvaluation> {
	const prompt = `Evalueer criterium Q4: "Onafhankelijk audio-first narratieve coherentie" voor het volgende luisternarratief.

CRITERIUM Q4: Verifieer dat de luistereditie een onafhankelijk geauthored narratief is, GEEN audio-aanpassing van de technische newsletter.

Evalueer of:
- Het narratief ontsproeit uit het canoniek feiten dossier en editoriële selectie manifest
- De verhaalstructuur geschikt is voor luisteren
- Het narratief op zichzelf staat zonder visuele context
- Paragrafen natuurlijk verbinden
- Technische uitleg aangepast is voor gesproken begrip
- De tekst NIET de newsletter koppen, lijsten en paragraafstructuren mechanisch herproduceert
- Luisteraars NIET hoeven te herlezen, diagrammen te inspecteren of bronlinks te raadplegen

LUISTERNARRATIEF:
${ctx.listeningNarrativeMarkdown}

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

	const result = await callLLMWithRetry(ctx, prompt, "Q4");
	return parseModelEvaluation(result.content, "Q4", "model-assisted", ctx);
}

async function evaluateQ5_FactualAccuracy(
	ctx: EvaluationContext,
): Promise<CriterionEvaluation> {
	const prompt = `Evalueer criterium Q5: "Feitelijke accurateheid, technisch diepgang en traceerbaarheid" voor het volgende luisternarratief.

CRITERIUM Q5: Verifieer dat alle materiële beweringen consistent blijven met het canoniek feiten dossier en editoriële selectie manifest.

Evalueer:
- Feitelijke accurateheid
- Correcte technische mechanismen
- Behoud van belangrijke wetenschappelijke bevindingen
- Accurate behandeling van onderzoeksmethodologie
- Correcte release maturity en beschikbaarheid
- Accurate numerieke bevindingen
- Attributie van vendor claims
- Onderscheid correlatie vs causaliteit
- Behoud van beperkingen en onzekerheid
- Complete dekking van materieel geselecteerde ontwikkelingen
- Traceerbaarheid naar originele claim en source identifiers

Wetenschappelijk en strategisch onderzoek van academische instellingen, Gartner, McKinsey, Forrester, IDC en vergelijkbare bronnen moet dezelfde evidentiële discipline krijgen als technische productaankondigingen.

Het gesproken narratief mag GEEN experimenten, resultaten, capaciteiten, architectuurimplicaties of causale verklaringen UITVINDEN.

LUISTERNARRATIEF:
${ctx.listeningNarrativeMarkdown}

FEITEN DOSSIER SAMENVATTING:
${summarizeFactDossier(ctx.factDossier)}

EDITORIËLE SELECTIE:
${summarizeEditorialSelection(ctx.editorialManifest)}

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

	const result = await callLLMWithRetry(ctx, prompt, "Q5");
	return parseModelEvaluation(result.content, "Q5", "model-assisted", ctx);
}

async function evaluateQ6_NoEditorialSelfCommentary(
	ctx: EvaluationContext,
): Promise<CriterionEvaluation> {
	const prompt = `Evalueer criterium Q6: "Geen editorieel zelfcommentaar" voor het volgende luisternarratief.

CRITERIUM Q6: Verifieer dat het narratief onnodig commentaar over eigen editoriale keuzes vermijdt.

Detecteer zinnen die uitleggen:
- Waarom de auteur een bepaald verhaal geselecteerd heeft
- Hoe de newsletter gestructureerd was
- Waarom een onderwerp aandacht verdient volgens de editor
- Hoeveel moeite het onderzoek van de editie gekost heeft
- Wat de verteller van plan is te bespreken puur als editoriële aankondiging

Onderscheid editorieel zelfcommentaar van nuttige luisteraar-orientatie.
Natuurlijke overgangen en korte uitleg waarom een ontwikkeling belangrijk is ZIJN toegestaan.
Het narratief moet het nieuws DIRECT communiceren in plaats van de eigen constructie te beschrijven.

LUISTERNARRATIEF:
${ctx.listeningNarrativeMarkdown}

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

	const result = await callLLMWithRetry(ctx, prompt, "Q6");
	return parseModelEvaluation(result.content, "Q6", "model-assisted", ctx);
}

async function evaluateQ7_ConcreteOpening(
	ctx: EvaluationContext,
): Promise<CriterionEvaluation> {
	const prompt = `Evalueer criterium Q7: "Concrete opening zonder formuleuze structuur" voor het volgende luisternarratief.

CRITERIUM Q7: Evalueer of de opening onmiddellijk een consequentieel ontwikkelingsgebied of concrete situatie vestigt.

Vereisten:
- Begin met daadwerkelijk materieel nieuws
- Vestig significantie snel
- Geef voldoende context voor begrip
- Vermijd generieke introducties en herhalende podcast formules
- Vermijd kunstmatige spanning
- Vermijd gedwongen overkoepelende thema's
- Vermijd automatische prioritering van GitHub, Copilot of VS Code
- Sta wetenschappelijke, economische, strategische of beveiligingsontwikkelingen toe te leiden wanneer editorieel gerechtvaardigd

LUISTERNARRATIEF (opening sectie):
${ctx.listeningNarrativeMarkdown.split("## Verhaal")[0]}

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

	const result = await callLLMWithRetry(ctx, prompt, "Q7");
	return parseModelEvaluation(result.content, "Q7", "model-assisted", ctx);
}

async function evaluateQ8_ManageableInformationDensity(
	ctx: EvaluationContext,
): Promise<CriterionEvaluation> {
	const prompt = `Evalueer criterium Q8: "Beheersbare informatiedichtheid" voor het volgende luisternarratief.

CRITERIUM Q8: Evalueer of het narratief informatie presenteert in een tempo geschikt voor continuous luisteren.

Beoordeel:
- Aantal onbekende concepten geïntroduceerd tegelijk
- Dichtheid van acroniemen en productnamen
- Frequentie van technische details
- Lengte en complexiteit van uitleggen
- Kwantitatieve informatie en benchmark beschrijvingen
- Werkgeheugen afhankelijkheden tussen zinnen
- Onnodige herhaling
- Balans tussen conceptuele uitleg en technisch diepgang

Identificeer cognitief veeleisende passages en geef gerichte verbeteringen aan.
Gebruik kortere uitleg, contextuele verduidelijking, betekenisvolle overgangen of selectieve herhaling waar nuttig.
Leg NIET willekeurige zinslengte limieten of maximum aantal technische termen op zonder ondersteunend bewijs.
Gooi NIET belangrijke informatie weg om een oppervlakkige leesbaarheidsscore te halen.

LUISTERNARRATIEF:
${ctx.listeningNarrativeMarkdown}

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

	const result = await callLLMWithRetry(ctx, prompt, "Q8");
	return parseModelEvaluation(result.content, "Q8", "model-assisted", ctx);
}

async function evaluateQ9_NaturalTransitions(
	ctx: EvaluationContext,
): Promise<CriterionEvaluation> {
	const prompt = `Evalueer criterium Q9: "Natuurlijke overgangen en luisteraar heroriëntatie" voor het volgende luisternarratief.

CRITERIUM Q9: Evalueer of luisteraars de progressie tussen ontwikkelingen kunnen volgen en hun oriëntatie kunnen herwinnen na complexe secties.

Vereisten:
- Natuurlijke overgangen tussen gerelateerde verhalen
- Duidelijke onderwerpwisselingen wanneer onderwerpen ongerelateerd
- Expliciete relaties waar bewijs voor beschikbaar is
- Gelegelijke heroriëntatie na veeleisende uitleggen
- GEEN onnodige recaps na elke paragraaf
- GEEN herhalende overgangsjablonen
- GEEN gefabriceerde conceptuele verbindingen
- GEEN afhankelijkheid van visuele structuur om onderwerpwisselingen te begrijpen

Een heroriëntatie moet de huidige uitleg kort verbinden met zijn centrale vraag of gevolg.

Evalueer de coherentie van de gehele luisterervaring, niet geïsoleerde paragrafen.

LUISTERNARRATIEF:
${ctx.listeningNarrativeMarkdown}

EDITORIËLE VERHALVOLGORDE:
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

	const result = await callLLMWithRetry(ctx, prompt, "Q9");
	return parseModelEvaluation(result.content, "Q9", "model-assisted", ctx);
}

async function evaluateQ10_NoMandatoryArchitectureLesson(
	ctx: EvaluationContext,
): Promise<CriterionEvaluation> {
	const prompt = `Evalueer criterium Q10: "Geen verplichte architectuurles" voor het volgende luisternarratief.

CRITERIUM Q10: Verifieer dat het narratief NIET automatisch elke ontwikkeling transformeert in een algemeen architectuur-, governance- of engineering-principe.

Architectuurinzichten Mogen opgenomen worden wanneer:
- Ze natuurlijk voortvloeien uit de gerapporteerde ontwikkeling
- Ze ondersteund worden door actueel bewijs
- Ze het begrip verbeteren
- Hun toepasbaarheid en beperkingen duidelijk zijn

Vereist NIET:
- Een governance conclusie voor elk verhaal
- Een finale architectuur-principes sectie
- Een generieke les over agent orchestratie
- Herhaald software engineering advies
- Een geforceerde samenvatting van architectuurimplicaties

Sta toe dat het narratief natuurlijk eindigt.
Behoud écht significante architectuurinzichten zonder ze te fabriceren.

LUISTERNARRATIEF (conclusie sectie):
${ctx.listeningNarrativeMarkdown.split("## Verhaal").pop() || ctx.listeningNarrativeMarkdown.slice(-1000)}

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

	const result = await callLLMWithRetry(ctx, prompt, "Q10");
	return parseModelEvaluation(result.content, "Q10", "model-assisted", ctx);
}

// ============================================================================
// Model Evaluation Parser
// ============================================================================

function parseModelEvaluation(
	content: string,
	criterionId: CriterionId,
	method: EvaluationMethod,
	ctx: EvaluationContext,
): CriterionEvaluation {
	try {
		// Extract JSON from model response
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
			scope: parsed.scope || "full-narrative",
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
			qEvidenceReferences: [],
			holisticAssessment: false,
		};
	} catch (error) {
		// Fallback on parse failure
		const evaluationId = generateEvaluationId();
		const now = new Date().toISOString();
		return {
			criterionId,
			evaluationId,
			status: "UNVERIFIED",
			scope: "full-narrative",
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
			qEvidenceReferences: [],
			holisticAssessment: false,
		};
	}
}

// ============================================================================
// Helper Functions
// ============================================================================

function extractTerminology(dossier: CanonicalFactDossier): string {
	const terms = new Set<string>();
	for (const candidate of dossier.candidates) {
		for (const claim of candidate.claims) {
			if (claim.technicalContext?.capabilities) {
				for (const cap of claim.technicalContext.capabilities)
					terms.add(cap);
			}
			if (claim.technicalContext?.architecture) {
				for (const arch of claim.technicalContext.architecture)
					terms.add(arch);
			}
		}
	}
	return (
		Array.from(terms).slice(0, 30).join(", ") ||
		"Geen gespecialiseerde terminologie geïdentificeerd"
	);
}

function summarizeFactDossier(dossier: CanonicalFactDossier): string {
	const summary = [
		`Totaal kandidaten: ${dossier.editionSummary.totalCandidates}`,
		`Totaal claims: ${dossier.editionSummary.totalClaims}`,
		`Temporale eligibiliteit: ${JSON.stringify(dossier.editionSummary.byTemporalEligibility)}`,
		`Bewijsclassificatie: ${JSON.stringify(dossier.editionSummary.byEvidenceClassification)}`,
		`Verificatiestatus: ${JSON.stringify(dossier.editionSummary.byVerificationStatus)}`,
		`Onderzoeksdomeinen: ${JSON.stringify(dossier.editionSummary.byResearchDomain)}`,
		`Gemiddelde claim confidence: ${dossier.editionSummary.averageClaimConfidence.toFixed(2)}`,
		`Claims met tegenbewijs: ${dossier.editionSummary.claimsWithCounterevidence}`,
		`Claims met onopgeloste onzekerheden: ${dossier.editionSummary.claimsWithUnresolvedUncertainties}`,
	].join("\n");
	return summary;
}

function summarizeEditorialSelection(
	manifest: EditorialSelectionManifest,
): string {
	const selected = manifest.stories.filter(
		(s) => s.decision === "SELECTED" || s.decision === "CATCH_UP_SELECTED",
	);
	const excluded = manifest.candidates.filter((c) =>
		c.decision.startsWith("EXCLUDED"),
	);
	const deferred = manifest.candidates.filter(
		(c) => c.decision === "DEFERRED_UNVERIFIED",
	);

	return [
		`Geselecteerde verhalen: ${selected.length}`,
		`Uitgesloten: ${excluded.length}`,
		`Uitgesteld: ${deferred.length}`,
		`Catch-up: ${manifest.candidates.filter((c) => c.decision === "CATCH_UP_SELECTED").length}`,
		`Concentratie review: ${manifest.concentrationReview.findings.slice(0, 3).join("; ")}`,
	].join("\n");
}

// ============================================================================
// Repair Mechanism
// ============================================================================

async function attemptRepair(
	ctx: EvaluationContext,
	evaluation: CriterionEvaluation,
	issueType: "factual" | "structural" | "explanatory" | "stylistic",
): Promise<RepairAction | null> {
	if (evaluation.status !== "FAIL" || evaluation.repairAttempted) {
		return null;
	}

	const repairActionId = generateRepairActionId();
	const now = new Date().toISOString();

	// Find the most relevant passage
	const affectedPassage = evaluation.passageReferences[0] || {
		characterOffset: 0,
		quote: "Onbekende passage",
	};

	// Generate repair prompt
	const prompt = `Je bent een editor die een luisternarratief herstelt na een Q${evaluation.criterionId.replace("Q", "")} evaluatie falen.

ORIGINELE EVALUATIE:
- Criterium: ${evaluation.criterionId}
- Status: ${evaluation.status}
- Severity: ${evaluation.severity}
- Samenvatting: ${evaluation.summary}
- Rational: ${evaluation.rationale}
- Issue type: ${issueType}

BEINVLOEDDE PASSAGE:
${evaluation.passageReferences.map((p) => p.quote).join("\n---\n")}

HELE LUISTERNARRATIEF:
${ctx.listeningNarrativeMarkdown}

FEITEN DOSSIER CONTEXT:
${summarizeFactDossier(ctx.factDossier)}

TAAK: Stel de KLEINSTE correctie voor die de defect VOLLEDIG adresseert.
- Behoud de canonieke feiten en editoriële selectie
- Voeg GEEN onondersteunde claims toe
- Verwijder GEEN materieel geselecteerde ontwikkelingen
- Wijzig GEEN bronattributie
- Wijzig GEEN numerieke bevindingen
- Onderdruk GEEN belangrijke beperkingen
- Wijzig GEEN upstream bewijs
- Vervang GEEN editoriële selectie

Geef je voorstel in JSON formaat:
{
  "proposedCorrection": "Exacte voorgestelde tekstwijziging",
  "preservesCanonicalFacts": true,
  "preservesEditorialSelection": true,
  "issueType": "${issueType}",
  "problemDescription": "Korte beschrijving van het observeerbare probleem"
}`;

	const result = await callLLMWithRetry(
		ctx,
		prompt,
		`repair-Q${evaluation.criterionId.replace("Q", "")}`,
	);
	let proposedCorrection = "";
	let preservesCanonicalFacts = true;
	let preservesEditorialSelection = true;
	let problemDescription = evaluation.summary;

	try {
		const jsonMatch = result.content.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0]);
			proposedCorrection = parsed.proposedCorrection || "";
			preservesCanonicalFacts = parsed.preservesCanonicalFacts !== false;
			preservesEditorialSelection =
				parsed.preservesEditorialSelection !== false;
			problemDescription =
				parsed.problemDescription || evaluation.summary;
		}
	} catch {
		// Use fallback
	}

	// Apply correction if safe
	let appliedCorrection: string | undefined;
	let status: RepairActionStatus = "proposed";

	if (
		proposedCorrection &&
		proposedCorrection.length > 0 &&
		preservesCanonicalFacts &&
		preservesEditorialSelection
	) {
		const originalMarkdown = ctx.listeningNarrativeMarkdown;
		let newMarkdown = originalMarkdown;

		// Try to apply the correction
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
				ctx.listeningNarrativeMarkdown = newMarkdown;
			}
		}
	} else {
		// Repair not applied - mark as rejected
		status = "rejected";
	}

	// Only create repair action if there's a meaningful proposed correction
	if (!proposedCorrection || proposedCorrection.length === 0) {
		return null;
	}

	const repairAction: RepairAction = {
		repairActionId,
		criterionId: evaluation.criterionId,
		evaluationId: evaluation.evaluationId,
		issueType,
		problemDescription,
		affectedPassage,
		proposedCorrection,
		preservesCanonicalFacts,
		preservesEditorialSelection,
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
	repairAction: RepairAction,
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

	// Check no new operational commentary
	const opsCheck = checkOperationalCommentary(ctx);
	checks.push({
		check: "No operational commentary",
		passed: opsCheck.passed,
		details: opsCheck.details,
	});

	// Check no spoken references
	const refCheck = checkSpokenReferences(ctx);
	checks.push({
		check: "No spoken references",
		passed: refCheck.passed,
		details: refCheck.details,
	});

	return checks;
}

// ============================================================================
// Main Evaluation Function
// ============================================================================

export async function evaluateListeningQuality(
	input: ListeningQualityEvaluationInput,
): Promise<ListeningQualityEvaluationReport> {
	const {
		editionDate,
		editionId,
		listeningNarrativeMarkdown,
		listeningNarrativeArtifactId,
		listeningNarrativeTraceability,
		factDossier,
		editorialManifest,
		historicalRegression,
		publicationMetadata,
		articleIdentities,
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
		listeningNarrativeMarkdown,
		listeningNarrativeArtifactId,
		listeningNarrativeTraceability,
		factDossier,
		editorialManifest,
		historicalRegression,
		publicationMetadata,
		articleIdentities,
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
		criterionId: CriterionId;
		check: () => DeterministicCheckResult;
	}> = [
		{ criterionId: "Q3", check: () => checkOperationalCommentary(ctx) },
		{ criterionId: "Q5", check: () => checkSelectedStoryCoverage(ctx) },
		{ criterionId: "Q5", check: () => checkFactualConsistency(ctx) },
		{ criterionId: "Q3", check: () => checkSpokenReferences(ctx) },
		{ criterionId: "Q4", check: () => checkNarrativeIndependence(ctx) },
		{ criterionId: "Q6", check: () => checkEditorialSelfCommentary(ctx) },
		{ criterionId: "Q7", check: () => checkOpeningQuality(ctx) },
		{
			criterionId: "Q10",
			check: () => checkMandatoryArchitectureLesson(ctx),
		},
		{ criterionId: "Q3", check: () => checkVisualReferences(ctx) },
	];

	// Track which criteria have deterministic results
	const deterministicResults = new Map<
		CriterionId,
		DeterministicCheckResult
	>();

	for (const { criterionId, check } of deterministicChecks) {
		const result = check();
		const existing = deterministicResults.get(criterionId);
		if (!existing || !result.passed) {
			deterministicResults.set(criterionId, result);
		}
	}

	// Create evaluations for Q3, Q5, Q6, Q7, Q10 from deterministic checks
	const now = new Date().toISOString();
	for (const [criterionId, result] of deterministicResults) {
		const evaluationId = generateEvaluationId();
		const evaluation: CriterionEvaluation = {
			criterionId,
			evaluationId,
			status: result.passed ? "PASS" : "FAIL",
			severity: result.passed
				? undefined
				: criterionId === "Q5"
					? "CRITICAL"
					: "MAJOR",
			scope:
				criterionId === "Q7"
					? "opening"
					: criterionId === "Q10"
						? "conclusion"
						: "full-narrative",
			summary: result.details,
			rationale: `Deterministic check: ${result.details}`,
			evidence: result.evidence,
			passageReferences: result.passageReferences,
			repairAttempted: false,
			residualUncertainty: result.passed
				? undefined
				: "Deterministic check failed; manual review recommended",
			method: "deterministic",
			evaluatedAt: now,
			evaluatedBy: "deterministic-checker",
			qEvidenceReferences: [],
			holisticAssessment: false,
		};
		ctx.criterionEvaluations.push(evaluation);
	}

	// Run model-assisted evaluations for remaining criteria
	const modelAssistedCriteria: CriterionId[] = ["Q1", "Q2", "Q4", "Q8", "Q9"];

	for (const criterionId of modelAssistedCriteria) {
		// Skip if already evaluated deterministically
		if (ctx.criterionEvaluations.some((e) => e.criterionId === criterionId))
			continue;

		let evaluation: CriterionEvaluation;
		switch (criterionId) {
			case "Q1":
				evaluation = await evaluateQ1_TerminologyExplained(ctx);
				break;
			case "Q2":
				evaluation = await evaluateQ2_ContextBeforeComplexity(ctx);
				break;
			case "Q4":
				evaluation = await evaluateQ4_AudioFirstIndependence(ctx);
				break;
			case "Q8":
				evaluation = await evaluateQ8_ManageableInformationDensity(ctx);
				break;
			case "Q9":
				evaluation = await evaluateQ9_NaturalTransitions(ctx);
				break;
			default:
				continue;
		}

		ctx.criterionEvaluations.push(evaluation);

		// Attempt repair for failures
		if (
			evaluation.status === "FAIL" &&
			evaluation.severity &&
			["CRITICAL", "MAJOR"].includes(evaluation.severity)
		) {
			let issueType:
				"factual" | "structural" | "explanatory" | "stylistic";
			switch (criterionId) {
				case "Q1":
					issueType = "explanatory";
					break;
				case "Q2":
					issueType = "structural";
					break;
				case "Q4":
					issueType = "structural";
					break;
				case "Q8":
					issueType = "stylistic";
					break;
				case "Q9":
					issueType = "structural";
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
					// Run regression checks
					const regressionChecks = await runRegressionChecks(
						ctx,
						repairAction,
					);
					repairAction.regressionChecks = regressionChecks;

					// Re-evaluate the criterion after repair
					const reEvalResult = deterministicResults.get(
						criterionId,
					) || {
						passed: false,
						details: "",
						passageReferences: [],
						evidence: [],
					};
					const reassessment: CriterionEvaluation["reassessment"] = {
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

	// Ensure all 10 criteria have evaluations (fill gaps with UNVERIFIED)
	for (const criterionId of Q_CRITERIA) {
		if (
			!ctx.criterionEvaluations.some((e) => e.criterionId === criterionId)
		) {
			ctx.criterionEvaluations.push({
				criterionId,
				evaluationId: generateEvaluationId(),
				status: "UNVERIFIED",
				scope: "full-narrative",
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
				qEvidenceReferences: [],
				holisticAssessment: false,
			});
		}
	}

	// Sort evaluations by criterion order
	ctx.criterionEvaluations.sort(
		(a, b) =>
			ALL_CRITERIA.indexOf(a.criterionId as any) -
			ALL_CRITERIA.indexOf(b.criterionId as any),
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
		evaluatedBy: "listening-quality-evaluator",
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
		ListeningQualityEvaluationReport,
		"contentHash"
	> = {
		schemaVersion: LISTENING_QUALITY_EVALUATION_SCHEMA_VERSION,
		reportId: generateReportId(),
		editionId,
		editionDate,
		listeningNarrativeArtifactId,
		factDossierId: factDossier.dossierId,
		editorialSelectionManifestId: editorialManifest.manifestId,
		criterionEvaluations: ctx.criterionEvaluations,
		repairActions: ctx.repairActions,
		overallSummary,
		metadata,
	};

	const contentHash = computeContentHash(JSON.stringify(reportWithoutHash));

	const report: ListeningQualityEvaluationReport = {
		...reportWithoutHash,
		contentHash,
	};

	// Validate report
	ListeningQualityEvaluationReportSchema.parse(report);

	return report;
}

// ============================================================================
// Persistence
// ============================================================================

export async function persistEvaluationReport(
	editionDate: string,
	report: ListeningQualityEvaluationReport,
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
): Promise<ListeningQualityEvaluationReport | null> {
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
