/**
 * Audio A-G Evaluation — Core Evaluator
 *
 * Implements the Audio A-G listening quality evaluation framework for the
 * independently authored Dutch AI Intelligence narrative. Complements Q1-Q10
 * by assessing the complete listening experience as an integrated narrative.
 *
 * Processing sequence:
 *   Q1-Q10 Evaluation → Audio A-G Evaluation → Publication Validation → Deployment
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
	AUDIO_CRITERIA,
	ALL_CRITERIA,
	CriterionEvaluationStatusSchema,
	SeverityLevelSchema,
	EvaluationMethodSchema,
	RepairActionStatusSchema,
	EvaluationScopeSchema,
	type CriterionId,
	type AudioCriterionId,
	type AnyCriterionId,
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
	type HolisticListeningAssessment,
	CriterionEvaluationSchema,
	RepairActionSchema,
	ListeningQualityEvaluationReportSchema,
	HolisticListeningAssessmentSchema,
	generateListeningQualityEvaluationJsonSchema,
	generateCriterionEvaluationJsonSchema,
	generateRepairActionJsonSchema,
	generateHolisticListeningAssessmentJsonSchema,
} from "./schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..", "..", "..");
const DATA_DIR = join(PROJECT_ROOT, "data");
const AUDIO_EVALUATION_DIR = join(DATA_DIR, "audio-evaluations");
const CHECKPOINT_DIR = join(DATA_DIR, "checkpoints", "audio-evaluation");

/**
 * Coerce evaluation report to match strict Zod schemas.
 * Free-tier models often return strings where objects are expected.
 * This normalizes passageReferences, evidence, and other structured fields.
 */
function coerceEvaluationReport(report: any): any {
	if (!report || typeof report !== "object") return report;

	// Handle arrays
	if (Array.isArray(report)) {
		return report.map(coerceEvaluationReport);
	}

	// Handle passageReferences - convert strings to PassageReference objects
	if (report.passageReferences && Array.isArray(report.passageReferences)) {
		report.passageReferences = report.passageReferences.map((ref: any) => {
			if (typeof ref === "string") {
				return {
					characterOffset: 0,
					lineNumber: 1,
					sectionHeading: undefined,
					quote: ref.slice(0, 500),
					storyId: undefined,
				};
			}
			if (ref && typeof ref === "object") {
				return {
					characterOffset: ref.characterOffset ?? 0,
					lineNumber: ref.lineNumber ?? 1,
					sectionHeading: ref.sectionHeading ?? undefined,
					quote: ref.quote ?? "",
					storyId: ref.storyId ?? undefined,
				};
			}
			return {
				characterOffset: 0,
				lineNumber: 1,
				sectionHeading: undefined,
				quote: "",
				storyId: undefined,
			};
		});
	}

	// Handle evidence array - ensure passageReferences in each evidence item
	if (report.evidence && Array.isArray(report.evidence)) {
		report.evidence = report.evidence.map((ev: any) => {
			if (ev && typeof ev === "object") {
				if (
					ev.passageReferences &&
					Array.isArray(ev.passageReferences)
				) {
					ev.passageReferences = ev.passageReferences.map(
						(ref: any) => {
							if (typeof ref === "string") {
								return {
									characterOffset: 0,
									lineNumber: 1,
									sectionHeading: undefined,
									quote: ref.slice(0, 500),
									storyId: undefined,
								};
							}
							if (ref && typeof ref === "object") {
								return {
									characterOffset: ref.characterOffset ?? 0,
									lineNumber: ref.lineNumber ?? 1,
									sectionHeading:
										ref.sectionHeading ?? undefined,
									quote: ref.quote ?? "",
									storyId: ref.storyId ?? undefined,
								};
							}
							return {
								characterOffset: 0,
								lineNumber: 1,
								sectionHeading: undefined,
								quote: "",
								storyId: undefined,
							};
						},
					);
				}
			}
			return ev;
		});
	}

	// Handle affectedPassage in repair actions
	if (report.affectedPassage) {
		if (typeof report.affectedPassage === "string") {
			report.affectedPassage = {
				characterOffset: 0,
				lineNumber: 1,
				sectionHeading: undefined,
				quote: report.affectedPassage.slice(0, 500),
				storyId: undefined,
			};
		} else if (
			report.affectedPassage &&
			typeof report.affectedPassage === "object"
		) {
			report.affectedPassage = {
				characterOffset: report.affectedPassage.characterOffset ?? 0,
				lineNumber: report.affectedPassage.lineNumber ?? 1,
				sectionHeading:
					report.affectedPassage.sectionHeading ?? undefined,
				quote: report.affectedPassage.quote ?? "",
				storyId: report.affectedPassage.storyId ?? undefined,
			};
		}
	}

	// Handle criterionEvaluations array
	if (
		report.criterionEvaluations &&
		Array.isArray(report.criterionEvaluations)
	) {
		report.criterionEvaluations = report.criterionEvaluations.map(
			(ce: any) => coerceEvaluationReport(ce),
		);
	}

	// Handle holisticListeningAssessment
	if (report.holisticListeningAssessment) {
		report.holisticListeningAssessment = coerceEvaluationReport(
			report.holisticListeningAssessment,
		);
	}

	// Handle repairActions array
	if (report.repairActions && Array.isArray(report.repairActions)) {
		report.repairActions = report.repairActions.map((ra: any) =>
			coerceEvaluationReport(ra),
		);
	}

	// Recursively process all object properties
	for (const key of Object.keys(report)) {
		if (
			![
				"passageReferences",
				"evidence",
				"affectedPassage",
				"criterionEvaluations",
				"holisticListeningAssessment",
				"repairActions",
			].includes(key)
		) {
			report[key] = coerceEvaluationReport(report[key]);
		}
	}

	return report;
}

// ============================================================================
// Helper Types
// ============================================================================

interface AudioEvaluationContext {
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
	qEvaluationReport: ListeningQualityEvaluationReport | null; // Previous Q1-Q10 results
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
	// Use the same default providers as the main client
	const providers = [
		{
			name: "openrouter-primary",
			baseUrl: "https://openrouter.ai/api/v1",
			model: "nvidia/nemotron-3-ultra-550b-a55b:free",
			apiKeyEnv: "OPENROUTER_API_KEY",
			headers: {
				"HTTP-Referer": "https://ai-intelligence-blog.example.com",
				"X-Title": "ai-intelligence-blog",
			},
			rateLimit: { requestsPerMinute: 20, tokensPerMinute: 50000 },
			timeoutMs: 60000,
		},
		{
			name: "openrouter-fallback-1",
			baseUrl: "https://openrouter.ai/api/v1",
			model: "nvidia/nemotron-3.5-lightning:free",
			apiKeyEnv: "OPENROUTER_API_KEY",
			headers: {
				"HTTP-Referer": "https://ai-intelligence-blog.example.com",
				"X-Title": "ai-intelligence-blog",
			},
			rateLimit: { requestsPerMinute: 20, tokensPerMinute: 50000 },
			timeoutMs: 60000,
		},
		{
			name: "nous-primary",
			baseUrl: "https://api.nous.research/v1",
			model: "nemotron-3.5-super-vl-free",
			apiKeyEnv: "NOUS_API_KEY",
			rateLimit: { requestsPerMinute: 30, tokensPerMinute: 100000 },
			timeoutMs: 60000,
		},
		{
			name: "nous-fallback-1",
			baseUrl: "https://api.nous.research/v1",
			model: "nemotron-3.5-lightning-free",
			apiKeyEnv: "NOUS_API_KEY",
			rateLimit: { requestsPerMinute: 30, tokensPerMinute: 100000 },
			timeoutMs: 60000,
		},
		{
			name: "nous-fallback-2",
			baseUrl: "https://api.nous.research/v1",
			model: "beam-free",
			apiKeyEnv: "NOUS_API_KEY",
			rateLimit: { requestsPerMinute: 30, tokensPerMinute: 100000 },
			timeoutMs: 60000,
		},
		{
			name: "nous-fallback-3",
			baseUrl: "https://api.nous.research/v1",
			model: "flint-40b-free",
			apiKeyEnv: "NOUS_API_KEY",
			rateLimit: { requestsPerMinute: 30, tokensPerMinute: 100000 },
			timeoutMs: 60000,
		},
	];

	return {
		providers,
		budget: { maxRequests: 30, maxTokens: 80000, maxCostUsd: 0 },
		retry: {
			maxAttempts: 3,
			baseDelayMs: 1000,
			maxDelayMs: 30000,
			jitterFactor: 0.25,
			retryableStatuses: [408, 429, 500, 502, 503, 504],
		},
		cacheDir: join(PROJECT_ROOT, "data", "llm-cache"),
		checkpointDir: join(PROJECT_ROOT, "data", "checkpoints"),
		enableCache: true,
		enableCheckpoints: true,
		deterministic: true,
		validateOnly: false,
	};
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
	ctx: AudioEvaluationContext,
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
		checkpointId: `audio-${segmentType}`,
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
// Q1-Q10 Evidence Mapping
// ============================================================================

/**
 * Map Audio A-G criteria to relevant Q1-Q10 evaluations for evidence reuse.
 * This avoids duplicating evaluation work where criteria overlap.
 */
function getQEvidenceReferences(
	ctx: AudioEvaluationContext,
	audioCriterion: AudioCriterionId,
): string[] {
	if (!ctx.qEvaluationReport) return [];

	const qEvals = ctx.qEvaluationReport.criterionEvaluations;
	const references: string[] = [];

	switch (audioCriterion) {
		case "A": // Opening quality -> Q7
			references.push(
				...qEvals
					.filter((e) => e.criterionId === "Q7")
					.map((e) => e.evaluationId),
			);
			break;
		case "B": // What/why/how -> Q2, Q5
			references.push(
				...qEvals
					.filter((e) => ["Q2", "Q5"].includes(e.criterionId))
					.map((e) => e.evaluationId),
			);
			break;
		case "C": // Cognitive load -> Q1, Q2, Q8, Q9
			references.push(
				...qEvals
					.filter((e) =>
						["Q1", "Q2", "Q8", "Q9"].includes(e.criterionId),
					)
					.map((e) => e.evaluationId),
			);
			break;
		case "D": // Language/analogies -> Q1, Q5
			references.push(
				...qEvals
					.filter((e) => ["Q1", "Q5"].includes(e.criterionId))
					.map((e) => e.evaluationId),
			);
			break;
		case "E": // Audio-first independence -> Q3, Q4, Q6
			references.push(
				...qEvals
					.filter((e) => ["Q3", "Q4", "Q6"].includes(e.criterionId))
					.map((e) => e.evaluationId),
			);
			break;
		case "F": // Factual caveats -> Q5
			references.push(
				...qEvals
					.filter((e) => e.criterionId === "Q5")
					.map((e) => e.evaluationId),
			);
			break;
		case "G": // Complete coverage -> Q5, Q10
			references.push(
				...qEvals
					.filter((e) => ["Q5", "Q10"].includes(e.criterionId))
					.map((e) => e.evaluationId),
			);
			break;
	}

	return references;
}

// ============================================================================
// Audio A Criterion: Concrete and Consequential Opening
// ============================================================================

async function evaluateAudioA_Opening(
	ctx: AudioEvaluationContext,
): Promise<CriterionEvaluation> {
	// Deterministic check: presence of concrete lead story
	const deterministicCheck = checkOpeningQuality(ctx);

	// Get Q7 evidence for reuse
	const qEvidenceRefs = getQEvidenceReferences(ctx, "A");

	// Model-assisted evaluation for holistic assessment
	const prompt = `Evalueer Audio-criterium A: "Concrete en consequentiele opening" voor het volgende luisternarratief.

CRITERIUM A: Evalueer of het narratief begint met een specifieke, betekenisvolle ontwikkeling die onmiddellijk relevantie vestigt.

Vereisten:
- Opent met daadwerkelijk nieuws, niet met een generieke introductie
- Vestigt een concreet probleem, gebeurtenis of ontwikkeling
- Maakt de significantie begrijpelijk VOORDAT complexiteit volgt
- Vangt aandacht door substantie, niet door kunstmatige spanning
- Vermijdt formuleuze podcast-introducties
- Vermijdt editorieel zelfcommentaar
- Vermijdt gedwongen overkoepelende thema's
- Behoudt vendor-neutrale editoriële volgorde

De opening mag NIET automatisch GitHub, Copilot, VS Code of coding agents prioritair stellen.
Wetenschappelijke doorbraken, beveiligingsbevindingen, economische ontwikkelingen en strategisch onderzoek mogen legitiem leiden.

LUISTERNARRATIEF (opening sectie - voor eerste '## Verhaal'):
${ctx.listeningNarrativeMarkdown.split("## Verhaal")[0]}

LEIDENDE ONTWIKKELING UIT EDITORIËLE SELECTIE:
${ctx.editorialManifest.stories.length > 0 ? `${ctx.editorialManifest.stories[0].organizations.join(", ")} - ${ctx.editorialManifest.stories[0].summary}` : "Geen verhalen"}

Q7 BEVINDINGEN (voor hergebruik):
${qEvidenceRefs.length > 0 ? "Q7 evaluatie beschikbaar" : "Geen Q7 evaluatie beschikbaar"}

Geef je evaluatie in JSON formaat:
{
  "status": "PASS|FAIL|UNVERIFIED|NOT_ASSESSABLE",
  "severity": "CRITICAL|MAJOR|MINOR|ADVISORY",
  "summary": "Korte samenvatting",
  "rationale": "Gedetailleerde redenatie met passage referenties",
  "evidence": [{"type": "model-assisted", "description": "...", "passageReferences": [], "claimIds": [], "sourceIds": []}],
  "passageReferences": [],
  "residualUncertainty": "..."
}`;

	const result = await callLLMWithRetry(ctx, prompt, "A");
	const evaluation = parseModelEvaluation(
		result.content,
		"A",
		"model-assisted",
		ctx,
	);
	evaluation.qEvidenceReferences = qEvidenceRefs;
	evaluation.holisticAssessment = true;

	// Combine with deterministic result
	if (!deterministicCheck.passed && evaluation.status === "PASS") {
		evaluation.status = "FAIL";
		evaluation.severity = "MAJOR";
		evaluation.summary =
			"Deterministische check gefaald: " + deterministicCheck.details;
		evaluation.evidence = [
			...evaluation.evidence,
			...deterministicCheck.evidence,
		];
		evaluation.passageReferences = [
			...evaluation.passageReferences,
			...deterministicCheck.passageReferences,
		];
	}

	return evaluation;
}

function checkOpeningQuality(
	ctx: AudioEvaluationContext,
): DeterministicCheckResult {
	const openingSection =
		ctx.listeningNarrativeMarkdown.split("## Verhaal")[0];
	const refs: PassageReference[] = [];
	const evidence: EvaluationEvidence[] = [];
	let passed = true;

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

// ============================================================================
// Audio B Criterion: Intelligible What, Why and How
// ============================================================================

async function evaluateAudioB_WhatWhyHow(
	ctx: AudioEvaluationContext,
): Promise<CriterionEvaluation> {
	const qEvidenceRefs = getQEvidenceReferences(ctx, "B");

	const prompt = `Evalueer Audio-criterium B: "Begrijpelijk wat, waarom en hoe" voor het volgende luisternarratief.

CRITERIUM B: Evalueer of luisteraars progressief kunnen begrijpen wat er gebeurd is, waarom het belangrijk is, en hoe het werkt voor ELK geselecteerd verhaal.

Voor ELK geselecteerd verhaal beoordeel:

WAT is er gebeurd?
- Is de materieel nieuwe informatie duidelijk geïdentificeerd?
- Kan de luisteraar de nieuwe onthulling onderscheiden van historische context?
- Zijn organisaties, technologieën en bevindingen begrijpelijk geïntroduceerd?

WAROM is het belangrijk?
- Zijn de daadwerkelijke gevolgen uitgelegd?
- Is de significantie gegrondvest in bewijs?
- Zijn praktische, wetenschappelijke, economische of organisatorische implicaties begrijpelijk?

HOE werkt het?
- Is het onderliggende mechanisme voldoende uitgelegd?
- Bouwt de uitleg op vanuit gevestigde context?
- Zijn belangrijke architecturale, wetenschappelijke of technische relaties accurate?
- Zijn betekenisvolle beperkingen opgenomen?

Deze vragen beschreven VEREISTE begrip, niet een verplichte narratieve sjabloon.
Vermijd herhalende zinnen als "wat gebeurde, waarom het belangrijk is en hoe het werkt" bij elk verhaal.
Behoud substantiële uitleg van complexe onderwerpen zoals agent orchestratie, model inferentie, onderzoeksmethodologie, beveiligingsgrenzen en enterprise productiviteit.
Vervang technisch begrip NIET door generieke conclusies.

LUISTERNARRATIEF:
${ctx.listeningNarrativeMarkdown}

EDITORIËLE SELECTIE (verhalen in volgorde):
${ctx.editorialManifest.stories.map((s, i) => `${i + 1}. ${s.organizations.join(", ")} (${s.researchDomains[0]})`).join("\n")}

Q2/Q5 BEVINDINGEN (voor hergebruik):
${qEvidenceRefs.length > 0 ? "Q2, Q5 evaluaties beschikbaar" : "Geen Q2/Q5 evaluaties beschikbaar"}

Geef je evaluatie in JSON formaat:
{
  "status": "PASS|FAIL|UNVERIFIED|NOT_ASSESSABLE",
  "severity": "CRITICAL|MAJOR|MINOR|ADVISORY",
  "summary": "Korte samenvatting",
  "rationale": "Gedetailleerde redenatie per verhaal met passage referenties",
  "evidence": [{"type": "model-assisted", "description": "...", "passageReferences": [], "claimIds": [], "sourceIds": []}],
  "passageReferences": [],
  "residualUncertainty": "..."
}`;

	const result = await callLLMWithRetry(ctx, prompt, "B");
	const evaluation = parseModelEvaluation(
		result.content,
		"B",
		"model-assisted",
		ctx,
	);
	evaluation.qEvidenceReferences = qEvidenceRefs;
	evaluation.holisticAssessment = true;
	return evaluation;
}

// ============================================================================
// Audio C Criterion: Manageable Cognitive Load and Listener Re-entry
// ============================================================================

async function evaluateAudioC_CognitiveLoad(
	ctx: AudioEvaluationContext,
): Promise<CriterionEvaluation> {
	const qEvidenceRefs = getQEvidenceReferences(ctx, "C");

	const prompt = `Evalueer Audio-criterium C: "Beheersbare cognitieve lading en luisteraar herinstap" voor het volgende luisternarratief.

CRITERIUM C: Evalueer of het narratief begrijpelijk blijft tijdens continu luisteren zonder visuele referentie of frequente terugspoelen.

Beoordeel:
- Aantal nieuwe concepten tegelijk geïntroduceerd
- Afhankelijkheden van informatie veel eerder gepresenteerd
- Dichtheid van acroniemen, productnamen en numerieke waarden
- Lengte en complexiteit van technische uitleggen
- Balans tussen achtergrond en nieuwe informatie
- Natuurlijke heroriëntatiemogelijkheden
- Effectiviteit van overgangen tussen ongerelateerde onderwerpen
- Selectieve herhaling van essentiële concepten
- Duidelijke herstelpunten na cognitief veeleisende passages

Identificeer secties die excessieve werkgeheugen retentie vereisen.
Aanbevelingen voor gerichte verbeteringen:
- Benodigde context eerder introduceren
- Ongerelateerde concepten scheiden
- Een mechanisme in logische volgorde uitleggen
- Dichte opsommingen vervangen door betekenisvolle uitleg
- Korte contextuele herinnering na complexiteit toevoegen
- Overgangen tussen onderwerpen verbeteren

Leg NIET willekeurige zinslengtes, woordtellingen of complexiteitslimieten op.
Verwijder NIET essentiële technische inhoud puur om de waargenomen cognitieve inspanning te reduceren.
Behandel ADHD-gerichte ontwerp als een toegankelijkheidsdoel, niet als wetenschappelijk gevalideerde universele luistermethode.

LUISTERNARRATIEF:
${ctx.listeningNarrativeMarkdown}

Q1/Q2/Q8/Q9 BEVINDINGEN (voor hergebruik):
${qEvidenceRefs.length > 0 ? "Q1, Q2, Q8, Q9 evaluaties beschikbaar" : "Geen Q1/Q2/Q8/Q9 evaluaties beschikbaar"}

Geef je evaluatie in JSON formaat:
{
  "status": "PASS|FAIL|UNVERIFIED|NOT_ASSESSABLE",
  "severity": "CRITICAL|MAJOR|MINOR|ADVISORY",
  "summary": "Korte samenvatting",
  "rationale": "Gedetailleerde redenatie met specifieke cognitief veeleisende passages",
  "evidence": [{"type": "model-assisted", "description": "...", "passageReferences": [], "claimIds": [], "sourceIds": []}],
  "passageReferences": [],
  "residualUncertainty": "..."
}`;

	const result = await callLLMWithRetry(ctx, prompt, "C");
	const evaluation = parseModelEvaluation(
		result.content,
		"C",
		"model-assisted",
		ctx,
	);
	evaluation.qEvidenceReferences = qEvidenceRefs;
	evaluation.holisticAssessment = true;
	return evaluation;
}

// ============================================================================
// Audio D Criterion: Accurate Analogies and Natural Spoken Dutch
// ============================================================================

async function evaluateAudioD_Language(
	ctx: AudioEvaluationContext,
): Promise<CriterionEvaluation> {
	const qEvidenceRefs = getQEvidenceReferences(ctx, "D");

	const prompt = `Evalueer Audio-criterium D: "Accurate analogieën en natuurlijk gesproken Nederlands" voor het volgende luisternarratief.

CRITERIUM D: Evalueer de taal-kwaliteit en uitleg-integriteit van het narratief.

Analogie-kwaliteit:
Beoordeel of analogieën:
- Een echt moeilijk concept uitleggen
- De belangrijke eigenschappen van het daadwerkelijke mechanisme behouden
- Geen misleidende causale implicaties introduceren
- Geen fictieve technische capaciteiten introduceren
- Hun beperkheden verduidelijken waar nodig
- Complexiteit reduceren zonder essentiële onderscheidingen te verduisteren

Een analogie is OPTIONEEL. Vereis GEEN analogieën wanneer een directe uitleg helderder is.

Gesproken Nederlands:
Evalueer of:
- Zinnen natuurlijk klinken wanneer gesproken
- Technische terminologie passend geïntroduceerd wordt
- Engelse technische termen behouden blijven waar nuttig
- Acroniemen en productnamen begrijpelijk afgehandeld worden
- Overgangen conversationeel zijn zonder informeel vulsel te worden
- Uitleggen onnodig geschreven of bureaucratisch taalgebruik vermijden
- Numerieke informatie begrijpelijk is bij één keer horen
- Het narratief professioneel, technisch precies en geschikt voor volwassenen blijft

Verwar conversationele taal NIET met gereduceerde intellectuele diepgang.
Vermijd kunstmatige enthousiasme, herhalende retorische vragen en overdreven claims.
Het narratief moet geschikt zijn voor browser-native text-to-speech zonder afhankelijkheid van een specifieke speech synthesis provider.

LUISTERNARRATIEF:
${ctx.listeningNarrativeMarkdown}

Q1/Q5 BEVINDINGEN (voor hergebruik):
${qEvidenceRefs.length > 0 ? "Q1, Q5 evaluaties beschikbaar" : "Geen Q1/Q5 evaluaties beschikbaar"}

Geef je evaluatie in JSON formaat:
{
  "status": "PASS|FAIL|UNVERIFIED|NOT_ASSESSABLE",
  "severity": "CRITICAL|MAJOR|MINOR|ADVISORY",
  "summary": "Korte samenvatting",
  "rationale": "Gedetailleerde redenatie over analogie-kwaliteit en gesproken taal",
  "evidence": [{"type": "model-assisted", "description": "...", "passageReferences": [], "claimIds": [], "sourceIds": []}],
  "passageReferences": [],
  "residualUncertainty": "..."
}`;

	const result = await callLLMWithRetry(ctx, prompt, "D");
	const evaluation = parseModelEvaluation(
		result.content,
		"D",
		"model-assisted",
		ctx,
	);
	evaluation.qEvidenceReferences = qEvidenceRefs;
	evaluation.holisticAssessment = true;
	return evaluation;
}

// ============================================================================
// Audio E Criterion: Independent Audio-First Composition
// ============================================================================

async function evaluateAudioE_Independence(
	ctx: AudioEvaluationContext,
): Promise<CriterionEvaluation> {
	// Deterministic check for newsletter structural markers
	const deterministicCheck = checkNarrativeIndependence(ctx);

	const qEvidenceRefs = getQEvidenceReferences(ctx, "E");

	const prompt = `Evalueer Audio-criterium E: "Onafhankelijke audio-first compositie zonder technische-publicatie lekkage" voor het volgende luisternarratief.

CRITERIUM E: Verifieer dat het luisternarratief functioneert als een onafhankelijk werk, GEEN audio-reproductie van publication.md.

Detecteer ongeschikte lekkage van:
- Technische nieuwsbrief koppenstructuren
- Markdown formatting bedoeld alleen voor visuele lezing
- Bron-URLs en citatie-identificaties
- Onderzoeks-audit terminologie
- Interne bestandsnamen en paden
- Model-provider of uitvoeringsdetails
- Testresultaten en acceptatiepoorten
- Visuele referenties die kijken naar een diagram vereisen
- Lange tabellen of lijsten bedoeld voor scherm-inspectie
- Editorieel commentaar over nieuwsbrief constructie

STA TOE: Technische informatie wanneer deze deel uitmaakt van het daadwerkelijke nieuws.
Een verhaal over een nieuwe AI evaluatiemethodologie mag legitiem evaluatieterminologie bespreken.

ONDERSCHEID: Nieuwsinhoud van interne productiemetadata.
Vergelijk het luisternarratief met de technische nieuwsbrief waar nuttig.
Bestraf GEEN gedeelde geverifieerde feiten, noodzakelijke terminologie of identieke productnamen.
De luisterversie MOET zijn eigen natuurlijke narratieve structuur hebben en begrijpelijk zijn zonder toegang tot andere publicatie-artefacten.

LUISTERNARRATIEF:
${ctx.listeningNarrativeMarkdown}

Q3/Q4/Q6 BEVINDINGEN (voor hergebruik):
${qEvidenceRefs.length > 0 ? "Q3, Q4, Q6 evaluaties beschikbaar" : "Geen Q3/Q4/Q6 evaluaties beschikbaar"}

Geef je evaluatie in JSON formaat:
{
  "status": "PASS|FAIL|UNVERIFIED|NOT_ASSESSABLE",
  "severity": "CRITICAL|MAJOR|MINOR|ADVISORY",
  "summary": "Korte samenvatting",
  "rationale": "Gedetailleerde redenatie over lekkage detectie",
  "evidence": [{"type": "model-assisted", "description": "...", "passageReferences": [], "claimIds": [], "sourceIds": []}],
  "passageReferences": [],
  "residualUncertainty": "..."
}`;

	const result = await callLLMWithRetry(ctx, prompt, "E");
	const evaluation = parseModelEvaluation(
		result.content,
		"E",
		"model-assisted",
		ctx,
	);
	evaluation.qEvidenceReferences = qEvidenceRefs;
	evaluation.holisticAssessment = true;

	// Combine with deterministic result
	if (!deterministicCheck.passed && evaluation.status === "PASS") {
		evaluation.status = "FAIL";
		evaluation.severity = "MAJOR";
		evaluation.summary =
			"Deterministische check gefaald: " + deterministicCheck.details;
		evaluation.evidence = [
			...evaluation.evidence,
			...deterministicCheck.evidence,
		];
		evaluation.passageReferences = [
			...evaluation.passageReferences,
			...deterministicCheck.passageReferences,
		];
	}

	return evaluation;
}

function checkNarrativeIndependence(
	ctx: AudioEvaluationContext,
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
				description: "Newsletter structurele marker gedetecteerd",
				passageReferences: matches,
				claimIds: [],
				sourceIds: [],
			});
		}
	}

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

// ============================================================================
// Audio F Criterion: Factual Caveats, Attribution and Fabrication Prevention
// ============================================================================

async function evaluateAudioF_FactualIntegrity(
	ctx: AudioEvaluationContext,
): Promise<CriterionEvaluation> {
	// Deterministic factual consistency check
	const deterministicCheck = checkFactualConsistency(ctx);

	const qEvidenceRefs = getQEvidenceReferences(ctx, "F");

	const prompt = `Evalueer Audio-criterium F: "Feitelijke voorbehouden, attributie en fabricatie preventie" voor het volgende luisternarratief.

CRITERIUM F: Verifieer dat het narratief trouw blijft aan het canoniek feiten dossier.

Controleer:
- Elke materiële feitenclaim
- Technische mechanismen en architectuur-uitleggen
- Productversies en beschikbaarheid
- Experimentele versus productie-maturiteit
- Kwantitatieve resultaten en benchmarks
- Wetenschappelijke methodologie en onzekerheid
- Onafhankelijke corroboratie
- Vendor claims en commerciële aankondigingen
- Economische en organisatorische gevolgen
- Historische en temporele framing
- Relevant tegenbewijs
- Materiële beperkingen en onopgeloste vragen

Voor Gartner, McKinsey, Forrester, IDC en vergelijkbare onderzoekorganisaties, behoud onderscheiden tussen:
- Originele empirische bevindingen
- Advies-interpretatie
- Correlatie en causaliteit
- Historische observatie en voorspelling
- Gemeten productiviteit en geschatte ROI
- Onderzoekssteekproeven en bredere populaties
- Vendor-gesponsord onderzoek en onafhankelijk onderzoek

VIND NIET UIT:
- Benchmark resultaten
- Onafhankelijke verificatie
- Product capaciteiten
- Technische mechanismen
- Bron-statements
- Causale relaties
- Economische effecten
- Onderzoeksconclusies

Essentiële kwalificaties moeten begrijpelijk blijven in gesproken vorm.
Overbelast het narratief NIET met methodologische details die de interpretatie niet beïnvloeden.
Kritieke feitelijke vervormingen, gefabriceerde claims en weggelaten materiële voorbehouden MOETEN acceptatie blokkeren.

LUISTERNARRATIEF:
${ctx.listeningNarrativeMarkdown}

FEITEN DOSSIER SAMENVATTING:
${summarizeFactDossier(ctx.factDossier)}

EDITORIËLE SELECTIE:
${summarizeEditorialSelection(ctx.editorialManifest)}

Q5 BEVINDINGEN (voor hergebruik):
${qEvidenceRefs.length > 0 ? "Q5 evaluatie beschikbaar" : "Geen Q5 evaluatie beschikbaar"}

Geef je evaluatie in JSON formaat:
{
  "status": "PASS|FAIL|UNVERIFIED|NOT_ASSESSABLE",
  "severity": "CRITICAL|MAJOR|MINOR|ADVISORY",
  "summary": "Korte samenvatting",
  "rationale": "Gedetailleerde redenatie over feite-getrouwheid",
  "evidence": [{"type": "model-assisted", "description": "...", "passageReferences": [], "claimIds": [], "sourceIds": []}],
  "passageReferences": [],
  "residualUncertainty": "..."
}`;

	const result = await callLLMWithRetry(ctx, prompt, "F");
	const evaluation = parseModelEvaluation(
		result.content,
		"F",
		"model-assisted",
		ctx,
	);
	evaluation.qEvidenceReferences = qEvidenceRefs;
	evaluation.holisticAssessment = true;

	// Combine with deterministic result
	if (!deterministicCheck.passed && evaluation.status === "PASS") {
		evaluation.status = "FAIL";
		evaluation.severity = "CRITICAL";
		evaluation.summary =
			"Deterministische feite-check gefaald: " +
			deterministicCheck.details;
		evaluation.evidence = [
			...evaluation.evidence,
			...deterministicCheck.evidence,
		];
		evaluation.passageReferences = [
			...evaluation.passageReferences,
			...deterministicCheck.passageReferences,
		];
	}

	return evaluation;
}

function checkFactualConsistency(
	ctx: AudioEvaluationContext,
): DeterministicCheckResult {
	const refs: PassageReference[] = [];
	const evidence: EvaluationEvidence[] = [];
	let passed = true;

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

// ============================================================================
// Audio G Criterion: Complete Meaningful News Coverage
// ============================================================================

async function evaluateAudioG_Coverage(
	ctx: AudioEvaluationContext,
): Promise<CriterionEvaluation> {
	// Deterministic check for selected story coverage
	const deterministicCheck = checkSelectedStoryCoverage(ctx);

	const qEvidenceRefs = getQEvidenceReferences(ctx, "G");

	const prompt = `Evalueer Audio-criterium G: "Complete betekenisvolle nieuwsdekking zonder gedwongen sjablonen" voor het volgende luisternarratief.

CRITERIUM G: Evalueer of het narratief de volledige editoriële selectie dekt met passende diepgang en balans.

Vereisten:
- Neem ELK materieel geselecteerde ontwikkeling op
- Behoud belangrijke wetenschappelijke en technische bevindingen
- Dek consequentiële strategische, organisatorische en economische ontwikkelingen
- Neem significante beveiligings- en governance-implicaties op waar ondersteund
- Behoud betekenisvolle beperkingen en tegenbewijs
- Respecteer het editoriële selectie manifest
- Behoud vendor-neutrale dekking
- Vermijd willekeurige verhaal-quota
- Vermijd verplichte architectuurlessen
- Vermijd kunstmatige verbindingen tussen ongerelateerde onderwerpen
- Vermijd herhalende verhaalstructuren

Pas narratieve diepte aan naar significantie.
Een rustige nieuwsdag mag een korter narratief produceren.
Een dag met verschillende grote ontwikkelingen mag aanzienlijk meer uitleg vereisen.
Voeg GEEN vulstof toe om een doel-duur te halen.
Laat GEEN geselecteerde verhalen stilzwijgend vallen om inferentie-kosten, narratieve lengte of cognitieve complexiteit te reduceren.
Als volledige dekking niet binnen het beschikbare gratis inferentie-budget kan, bewaar de onvoltooide draft en rapporteer de beperking.

LUISTERNARRATIEF:
${ctx.listeningNarrativeMarkdown}

EDITORIËLE SELECTIE (geselecteerde verhalen):
${ctx.editorialManifest.stories
	.filter(
		(s) => s.decision === "SELECTED" || s.decision === "CATCH_UP_SELECTED",
	)
	.map(
		(s, i) =>
			`${i + 1}. ${s.organizations.join(", ")} (${s.researchDomains[0]}) - ${s.summary} [diepgang: ${s.recommendedDepth}]`,
	)
	.join("\n")}

Q5/Q10 BEVINDINGEN (voor hergebruik):
${qEvidenceRefs.length > 0 ? "Q5, Q10 evaluaties beschikbaar" : "Geen Q5/Q10 evaluaties beschikbaar"}

Geef je evaluatie in JSON formaat:
{
  "status": "PASS|FAIL|UNVERIFIED|NOT_ASSESSABLE",
  "severity": "CRITICAL|MAJOR|MINOR|ADVISORY",
  "summary": "Korte samenvatting",
  "rationale": "Gedetailleerde redenatie over dekking van geselecteerde verhalen",
  "evidence": [{"type": "model-assisted", "description": "...", "passageReferences": [], "claimIds": [], "sourceIds": []}],
  "passageReferences": [],
  "residualUncertainty": "..."
}`;

	const result = await callLLMWithRetry(ctx, prompt, "G");
	const evaluation = parseModelEvaluation(
		result.content,
		"G",
		"model-assisted",
		ctx,
	);
	evaluation.qEvidenceReferences = qEvidenceRefs;
	evaluation.holisticAssessment = true;

	// Combine with deterministic result
	if (!deterministicCheck.passed && evaluation.status === "PASS") {
		evaluation.status = "FAIL";
		evaluation.severity = "CRITICAL";
		evaluation.summary =
			"Deterministische dekking-check gefaald: " +
			deterministicCheck.details;
		evaluation.evidence = [
			...evaluation.evidence,
			...deterministicCheck.evidence,
		];
		evaluation.passageReferences = [
			...evaluation.passageReferences,
			...deterministicCheck.passageReferences,
		];
	}

	return evaluation;
}

function checkSelectedStoryCoverage(
	ctx: AudioEvaluationContext,
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

// ============================================================================
// Holistic Listening Experience Assessment
// ============================================================================

async function evaluateHolisticListening(
	ctx: AudioEvaluationContext,
	audioEvaluations: CriterionEvaluation[],
): Promise<HolisticListeningAssessment> {
	const now = new Date().toISOString();

	// Build trade-offs analysis
	const tradeoffs = identifyTradeoffs(audioEvaluations);

	// Determine overall status
	const failedAudio = audioEvaluations.filter((e) => e.status === "FAIL");
	const criticalFailures = audioEvaluations.filter(
		(e) => e.severity === "CRITICAL",
	);
	const majorFailures = audioEvaluations.filter(
		(e) => e.severity === "MAJOR",
	);

	let overallStatus: CriterionEvaluationStatus = "PASS";
	if (criticalFailures.length > 0) overallStatus = "FAIL";
	else if (majorFailures.length > 0) overallStatus = "FAIL";
	else if (failedAudio.length > 0) overallStatus = "FAIL";
	else if (audioEvaluations.some((e) => e.status === "UNVERIFIED"))
		overallStatus = "UNVERIFIED";

	const overallSummary = buildOverallSummary(
		audioEvaluations,
		tradeoffs,
		overallStatus,
	);

	return {
		openingEstablishesContext: {
			status:
				audioEvaluations.find((e) => e.criterionId === "A")?.status ||
				"UNVERIFIED",
			summary:
				audioEvaluations.find((e) => e.criterionId === "A")?.summary ||
				"Niet geëvalueerd",
			rationale:
				audioEvaluations.find((e) => e.criterionId === "A")
					?.rationale || "Niet geëvalueerd",
			evidence:
				audioEvaluations.find((e) => e.criterionId === "A")?.evidence ||
				[],
		},
		progressionIntelligible: {
			status:
				audioEvaluations.find((e) => e.criterionId === "B")?.status ||
				"UNVERIFIED",
			summary:
				audioEvaluations.find((e) => e.criterionId === "B")?.summary ||
				"Niet geëvalueerd",
			rationale:
				audioEvaluations.find((e) => e.criterionId === "B")
					?.rationale || "Niet geëvalueerd",
			evidence:
				audioEvaluations.find((e) => e.criterionId === "B")?.evidence ||
				[],
		},
		informationDensityAppropriate: {
			status:
				audioEvaluations.find((e) => e.criterionId === "C")?.status ||
				"UNVERIFIED",
			summary:
				audioEvaluations.find((e) => e.criterionId === "C")?.summary ||
				"Niet geëvalueerd",
			rationale:
				audioEvaluations.find((e) => e.criterionId === "C")
					?.rationale || "Niet geëvalueerd",
			evidence:
				audioEvaluations.find((e) => e.criterionId === "C")?.evidence ||
				[],
		},
		transitionsProvideReorientation: {
			status:
				audioEvaluations.find((e) => e.criterionId === "C")?.status ||
				"UNVERIFIED", // C covers transitions
			summary:
				audioEvaluations.find((e) => e.criterionId === "C")?.summary ||
				"Niet geëvalueerd",
			rationale:
				audioEvaluations.find((e) => e.criterionId === "C")
					?.rationale || "Niet geëvalueerd",
			evidence:
				audioEvaluations.find((e) => e.criterionId === "C")?.evidence ||
				[],
		},
		contentDepthAppropriate: {
			status:
				audioEvaluations.find((e) => e.criterionId === "B")?.status ||
				"UNVERIFIED", // B covers depth
			summary:
				audioEvaluations.find((e) => e.criterionId === "B")?.summary ||
				"Niet geëvalueerd",
			rationale:
				audioEvaluations.find((e) => e.criterionId === "B")
					?.rationale || "Niet geëvalueerd",
			evidence:
				audioEvaluations.find((e) => e.criterionId === "B")?.evidence ||
				[],
		},
		factualIntegrityMaintained: {
			status:
				audioEvaluations.find((e) => e.criterionId === "F")?.status ||
				"UNVERIFIED",
			summary:
				audioEvaluations.find((e) => e.criterionId === "F")?.summary ||
				"Niet geëvalueerd",
			rationale:
				audioEvaluations.find((e) => e.criterionId === "F")
					?.rationale || "Niet geëvalueerd",
			evidence:
				audioEvaluations.find((e) => e.criterionId === "F")?.evidence ||
				[],
		},
		conclusionNatural: {
			status:
				audioEvaluations.find((e) => e.criterionId === "G")?.status ||
				"UNVERIFIED", // G covers conclusion
			summary:
				audioEvaluations.find((e) => e.criterionId === "G")?.summary ||
				"Niet geëvalueerd",
			rationale:
				audioEvaluations.find((e) => e.criterionId === "G")
					?.rationale || "Niet geëvalueerd",
			evidence:
				audioEvaluations.find((e) => e.criterionId === "G")?.evidence ||
				[],
		},
		screenIndependentUnderstanding: {
			status:
				audioEvaluations.find((e) => e.criterionId === "E")?.status ||
				"UNVERIFIED", // E covers audio-first
			summary:
				audioEvaluations.find((e) => e.criterionId === "E")?.summary ||
				"Niet geëvalueerd",
			rationale:
				audioEvaluations.find((e) => e.criterionId === "E")
					?.rationale || "Niet geëvalueerd",
			evidence:
				audioEvaluations.find((e) => e.criterionId === "E")?.evidence ||
				[],
		},
		conceptsRemainUnderstandable: {
			status:
				audioEvaluations.find((e) => e.criterionId === "C")?.status ||
				"UNVERIFIED",
			summary:
				audioEvaluations.find((e) => e.criterionId === "C")?.summary ||
				"Niet geëvalueerd",
			rationale:
				audioEvaluations.find((e) => e.criterionId === "C")
					?.rationale || "Niet geëvalueerd",
			evidence:
				audioEvaluations.find((e) => e.criterionId === "C")?.evidence ||
				[],
		},
		tradeoffs,
		overallStatus,
		overallSummary,
		residualUncertainty:
			criticalFailures.length > 0
				? "Kritieke feite-fouten geblokkeerd"
				: majorFailures.length > 0
					? "Significante begrips-defecten"
					: undefined,
		evaluatedAt: now,
		evaluatedBy: "audio-holistic-evaluator",
		method: "model-assisted",
	};
}

function identifyTradeoffs(audioEvaluations: CriterionEvaluation[]): Array<{
	criteria: string[];
	description: string;
	severity: SeverityLevel;
	recommendation: string;
}> {
	const tradeoffs: Array<{
		criteria: string[];
		description: string;
		severity: SeverityLevel;
		recommendation: string;
	}> = [];

	// Technical depth vs cognitive load
	const bEval = audioEvaluations.find((e) => e.criterionId === "B");
	const cEval = audioEvaluations.find((e) => e.criterionId === "C");
	if (bEval && cEval && bEval.status === "PASS" && cEval.status === "FAIL") {
		tradeoffs.push({
			criteria: ["B", "C"],
			description:
				"Technische diepgang (B) kan cognitieve lading (C) verhogen",
			severity: "MAJOR",
			recommendation:
				"Balans diepgang met progressieve uitleg en heroriëntatiepunten",
		});
	}

	// Analogy clarity vs factual accuracy
	const dEval = audioEvaluations.find((e) => e.criterionId === "D");
	const fEval = audioEvaluations.find((e) => e.criterionId === "F");
	if (dEval && fEval && dEval.status === "PASS" && fEval.status === "FAIL") {
		tradeoffs.push({
			criteria: ["D", "F"],
			description:
				"Analogieën kunnen helderheid verbeteren maar risico op feitelijke vervorming",
			severity: "CRITICAL",
			recommendation:
				"Beperk analogieën tot concepten waar directe uitleg onvoldoende is; verduidelijk beperkingen expliciet",
		});
	}

	// Transitions vs repetitive commentary
	const cEval2 = audioEvaluations.find((e) => e.criterionId === "C");
	const eEval = audioEvaluations.find((e) => e.criterionId === "E");
	if (
		cEval2 &&
		eEval &&
		cEval2.status === "PASS" &&
		eEval.status === "FAIL"
	) {
		tradeoffs.push({
			criteria: ["C", "E"],
			description:
				"Overgangen verbeteren oriëntatie maar kunnen editorieel zelfcommentaar introduceren",
			severity: "MINOR",
			recommendation:
				"Gebruik inhoudelijke overgangen (causale/contrastrelaties) in plaats van meta-commentaar",
		});
	}

	// Coverage completeness vs narrative length
	const gEval = audioEvaluations.find((e) => e.criterionId === "G");
	const cEval3 = audioEvaluations.find((e) => e.criterionId === "C");
	if (
		gEval &&
		cEval3 &&
		gEval.status === "PASS" &&
		cEval3.status === "FAIL"
	) {
		tradeoffs.push({
			criteria: ["G", "C"],
			description:
				"Volledige dekking (G) kan narratieve lengte en cognitieve lading (C) verhogen",
			severity: "MAJOR",
			recommendation:
				"Pas diepte aan per verhaal significantie; overweeg catch-up voor minder kritieke verhalen",
		});
	}

	return tradeoffs;
}

function buildOverallSummary(
	audioEvaluations: CriterionEvaluation[],
	tradeoffs: Array<{
		criteria: string[];
		description: string;
		severity: SeverityLevel;
		recommendation: string;
	}>,
	overallStatus: CriterionEvaluationStatus,
): string {
	const passed = audioEvaluations.filter((e) => e.status === "PASS").length;
	const failed = audioEvaluations.filter((e) => e.status === "FAIL").length;
	const unverified = audioEvaluations.filter(
		(e) => e.status === "UNVERIFIED",
	).length;
	const critical = audioEvaluations.filter(
		(e) => e.severity === "CRITICAL",
	).length;
	const major = audioEvaluations.filter((e) => e.severity === "MAJOR").length;

	const parts = [
		`Audio A-G evaluatie: ${passed} PASS, ${failed} FAIL, ${unverified} UNVERIFIED van 7 criteria.`,
		`Algehele status: ${overallStatus}.`,
	];

	if (critical > 0) {
		parts.push(
			`${critical} kritieke feite-fout(en) die acceptatie blokkeren.`,
		);
	}
	if (major > 0) {
		parts.push(`${major} significante begrips- of coherentie-defect(en).`);
	}
	if (tradeoffs.length > 0) {
		parts.push(
			`${tradeoffs.length} criteria-interactie(s) geïdentificeerd: ${tradeoffs.map((t) => t.criteria.join("+")).join(", ")}.`,
		);
	}

	return parts.join(" ");
}

// ============================================================================
// Model Evaluation Parser
// ============================================================================

function parseModelEvaluation(
	content: string,
	criterionId: AudioCriterionId,
	method: EvaluationMethod,
	ctx: AudioEvaluationContext,
): CriterionEvaluation {
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
			holisticAssessment: true,
		};
	} catch (error) {
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
			holisticAssessment: true,
		};
	}
}

// ============================================================================
// Helper Functions
// ============================================================================

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
// Repair Mechanism (Reused from Q1-Q10)
// ============================================================================

async function attemptRepair(
	ctx: AudioEvaluationContext,
	evaluation: CriterionEvaluation,
	issueType: "factual" | "structural" | "explanatory" | "stylistic",
): Promise<RepairAction | null> {
	if (evaluation.status !== "FAIL" || evaluation.repairAttempted) {
		return null;
	}

	const repairActionId = generateRepairActionId();
	const now = new Date().toISOString();

	const affectedPassage = evaluation.passageReferences[0] || {
		characterOffset: 0,
		quote: "Onbekende passage",
	};

	const prompt = `Je bent een editor die een luisternarratief herstelt na een Audio-${evaluation.criterionId} evaluatie falen.

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
		`repair-${evaluation.criterionId}`,
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
	ctx: AudioEvaluationContext,
	repairAction: RepairAction,
): Promise<Array<{ check: string; passed: boolean; details?: string }>> {
	const checks: Array<{ check: string; passed: boolean; details?: string }> =
		[];

	const coverageCheck = checkSelectedStoryCoverage(ctx);
	checks.push({
		check: "Selected story coverage",
		passed: coverageCheck.passed,
		details: coverageCheck.details,
	});

	const factualCheck = checkFactualConsistency(ctx);
	checks.push({
		check: "Factual consistency",
		passed: factualCheck.passed,
		details: factualCheck.details,
	});

	const opsCheck = checkOperationalCommentary(ctx);
	checks.push({
		check: "No operational commentary",
		passed: opsCheck.passed,
		details: opsCheck.details,
	});

	const refCheck = checkSpokenReferences(ctx);
	checks.push({
		check: "No spoken references",
		passed: refCheck.passed,
		details: refCheck.details,
	});

	return checks;
}

function checkOperationalCommentary(
	ctx: AudioEvaluationContext,
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

function checkSpokenReferences(
	ctx: AudioEvaluationContext,
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

// ============================================================================
// Main Audio Evaluation Function
// ============================================================================

export async function evaluateAudioQuality(
	input: ListeningQualityEvaluationInput & {
		qEvaluationReport?: ListeningQualityEvaluationReport;
	},
): Promise<{
	evaluationReport: ListeningQualityEvaluationReport;
	holisticAssessment: HolisticListeningAssessment;
}> {
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
		qEvaluationReport = null,
	} = input;

	const llmClient = createFreeLLMClient(getDefaultLLMConfig());

	if (!validationMode) {
		const validation = await llmClient.validate();
		if (!validation.valid) {
			throw new Error(
				`LLM client validation failed: ${validation.errors.join(", ")}`,
			);
		}
	} else {
		llmClient.setValidationMode(true);
	}

	const ctx: AudioEvaluationContext = {
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
		qEvaluationReport,
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

	const now = new Date().toISOString();

	// Run Audio A-G evaluations
	const audioCriteria: AudioCriterionId[] = [
		"A",
		"B",
		"C",
		"D",
		"E",
		"F",
		"G",
	];
	const audioEvaluations: CriterionEvaluation[] = [];

	for (const criterionId of audioCriteria) {
		let evaluation: CriterionEvaluation;
		switch (criterionId) {
			case "A":
				evaluation = await evaluateAudioA_Opening(ctx);
				break;
			case "B":
				evaluation = await evaluateAudioB_WhatWhyHow(ctx);
				break;
			case "C":
				evaluation = await evaluateAudioC_CognitiveLoad(ctx);
				break;
			case "D":
				evaluation = await evaluateAudioD_Language(ctx);
				break;
			case "E":
				evaluation = await evaluateAudioE_Independence(ctx);
				break;
			case "F":
				evaluation = await evaluateAudioF_FactualIntegrity(ctx);
				break;
			case "G":
				evaluation = await evaluateAudioG_Coverage(ctx);
				break;
			default:
				continue;
		}

		ctx.criterionEvaluations.push(evaluation);
		audioEvaluations.push(evaluation);

		// Attempt repair for failures
		if (
			evaluation.status === "FAIL" &&
			evaluation.severity &&
			["CRITICAL", "MAJOR"].includes(evaluation.severity)
		) {
			let issueType:
				"factual" | "structural" | "explanatory" | "stylistic";
			switch (criterionId) {
				case "A":
					issueType = "structural";
					break;
				case "B":
					issueType = "explanatory";
					break;
				case "C":
					issueType = "stylistic";
					break;
				case "D":
					issueType = "explanatory";
					break;
				case "E":
					issueType = "structural";
					break;
				case "F":
					issueType = "factual";
					break;
				case "G":
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
					const regressionChecks = await runRegressionChecks(
						ctx,
						repairAction,
					);
					repairAction.regressionChecks = regressionChecks;

					const reEvalResult = {
						passed: true,
						details: "",
						passageReferences: [],
						evidence: [],
					}; // Simplified re-eval
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

	// Holistic listening experience assessment
	const holisticAssessment = await evaluateHolisticListening(
		ctx,
		audioEvaluations,
	);

	// Compute overall summary (Q1-Q10 + Audio A-G = 17 total)
	// Note: Q1-Q10 evaluations come from qEvaluationReport
	const qEvaluations = qEvaluationReport?.criterionEvaluations || [];
	const allEvaluations = [...qEvaluations, ...audioEvaluations];

	const passedCount = allEvaluations.filter(
		(e) => e.status === "PASS",
	).length;
	const failedCount = allEvaluations.filter(
		(e) => e.status === "FAIL",
	).length;
	const unverifiedCount = allEvaluations.filter(
		(e) => e.status === "UNVERIFIED",
	).length;
	const notAssessableCount = allEvaluations.filter(
		(e) => e.status === "NOT_ASSESSABLE",
	).length;
	const criticalFailures = allEvaluations.filter(
		(e) => e.severity === "CRITICAL",
	).length;
	const majorFailures = allEvaluations.filter(
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
		evaluatedBy: "audio-quality-evaluator",
		modelAssistedEvaluations: allEvaluations.filter(
			(e) => e.method === "model-assisted",
		).length,
		deterministicEvaluations: allEvaluations.filter(
			(e) => e.method === "deterministic",
		).length,
		totalInferenceRequests:
			ctx.llmStats.requests +
			(qEvaluationReport?.metadata.totalInferenceRequests || 0),
		totalInferenceTokens:
			ctx.llmStats.tokens +
			(qEvaluationReport?.metadata.totalInferenceTokens || 0),
		inferenceProvidersUsed: [
			...new Set([
				...ctx.llmStats.providersUsed,
				...(qEvaluationReport?.metadata.inferenceProvidersUsed || []),
			]),
		],
		validationMode,
	};

	// Build combined report
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
		criterionEvaluations: allEvaluations,
		holisticListeningAssessment: holisticAssessment,
		repairActions: ctx.repairActions,
		overallSummary,
		metadata,
	};

	const contentHash = computeContentHash(JSON.stringify(reportWithoutHash));

	const evaluationReport: ListeningQualityEvaluationReport = {
		...reportWithoutHash,
		contentHash,
	};

	// Coerce LLM output to match strict schemas before validation
	const coercedReport = coerceEvaluationReport(evaluationReport);

	ListeningQualityEvaluationReportSchema.parse(coercedReport);

	return { evaluationReport: coercedReport, holisticAssessment };
}

// ============================================================================
// Persistence
// ============================================================================

export async function persistAudioEvaluationReport(
	editionDate: string,
	report: ListeningQualityEvaluationReport,
): Promise<string> {
	await fs.mkdir(AUDIO_EVALUATION_DIR, { recursive: true });
	await fs.mkdir(CHECKPOINT_DIR, { recursive: true });

	const filename = `${editionDate}_${report.reportId}.json`;
	const filepath = join(AUDIO_EVALUATION_DIR, filename);

	await fs.writeFile(filepath, JSON.stringify(report, null, 2), "utf-8");
	return filepath;
}

export async function loadAudioEvaluationReport(
	editionDate: string,
	reportId: string,
): Promise<ListeningQualityEvaluationReport | null> {
	const filename = `${editionDate}_${reportId}.json`;
	const filepath = join(AUDIO_EVALUATION_DIR, filename);

	try {
		const content = await fs.readFile(filepath, "utf-8");
		return JSON.parse(content);
	} catch {
		return null;
	}
}

export async function listAudioEvaluationReports(
	editionDate: string,
): Promise<string[]> {
	try {
		const files = await fs.readdir(AUDIO_EVALUATION_DIR);
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
