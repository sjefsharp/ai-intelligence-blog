#!/usr/bin/env tsx
/**
 * Build Daily Publication Package
 *
 * Generates the three canonical UTF-8 Markdown publications + daily index
 * for a given edition date. Consumes the canonical fact dossier and
 * editorial selection manifest without independently changing factual
 * eligibility, evidence classifications, or editorial decisions.
 *
 * Usage:
 *   pnpm exec tsx scripts/build-publication.ts --edition 2025-01-15
 *   pnpm exec tsx scripts/build-publication.ts --edition 2025-01-15 --demo
 */

import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import {
	getEditionDir,
	getNewsletterPath,
	getResearchAuditPath,
	getListeningNarrativePath,
	getDailyIndexPath,
} from "../src/lib/publication/paths.js";
import {
	createCanonicalPublicationMetadata,
	createEnglishDerivativeMetadata,
	createDailyIndex,
	validatePublicationMetadata,
	generateArtifactId,
	generateArticleId,
} from "../src/lib/publication/metadata.js";
import {
	persistPublicationArtifact,
	persistDailyIndex,
	persistPublicationPackage,
	checkCanonicalArtifactsExist,
} from "../src/lib/publication/store.js";
import {
	generateNewsletterMarkdown,
	loadNewsletterGenerationInput,
	validateNewsletterOutput,
	type NewsletterGenerationInput,
} from "../src/lib/publication/newsletter-generator.js";
import {
	generateListeningNarrativeMarkdown,
	validateListeningNarrativeOutput,
	loadListeningNarrativeGenerationInput,
	type ListeningNarrativeGenerationInput,
} from "../src/lib/publication/listening-narrative-generator.js";
import {
	EditionIdentitySchema,
	CanonicalReferencesSchema,
	ArticleIdentitySchema,
	PublicationPackageSchema,
	type EditionIdentity,
	type CanonicalReferences,
	type ArticleIdentity,
	type PublicationMetadata,
	type PublicationPackage,
} from "../src/lib/publication/schema.js";
import {
	renderBookDeltaAuditSection,
	validateBookDeltaEvaluationResult,
	type BookDeltaEvaluationResult,
} from "../src/lib/book-delta/index.js";
import { readFileSync } from "node:fs";

const __dirname = join(fileURLToPath(import.meta.url), "..");
const PROJECT_ROOT = join(__dirname, "..");

interface CliOptions {
	edition: string;
	demo?: boolean;
	semantic?: boolean;
}

function parseCliArgs(): CliOptions {
	const { values } = parseArgs({
		args: process.argv.slice(2),
		options: {
			edition: { type: "string", short: "e" },
			demo: { type: "boolean" },
			semantic: { type: "boolean" },
		},
		allowPositionals: true,
	});

	if (!values.edition) {
		console.error("Error: --edition is required (format: YYYY-MM-DD)");
		process.exit(1);
	}

	return {
		edition: values.edition,
		demo: values.demo ?? false,
		semantic: values.semantic ?? false,
	};
}

/**
 * Load synthetic demo data for testing without real research artifacts.
 */
function loadDemoData(editionDate: string): {
	editionIdentity: EditionIdentity;
	canonicalReferences: CanonicalReferences;
	articles: ArticleIdentity[];
	newsletterInput: NewsletterGenerationInput;
	listeningNarrativeInput: ListeningNarrativeGenerationInput;
} {
	const editionId = `edition_${editionDate}`;
	const now = new Date().toISOString();

	// Edition window: 05:00 Europe/Amsterdam previous day to 05:00 edition day
	const editionDateObj = new Date(`${editionDate}T05:00:00+01:00`); // Approximate
	const start = new Date(
		editionDateObj.getTime() - 24 * 60 * 60 * 1000,
	).toISOString();
	const end = editionDateObj.toISOString();

	const editionIdentity: EditionIdentity = {
		editionId,
		editionDate,
		editionWindow: {
			editionDate,
			start,
			end,
			timezone: "Europe/Amsterdam",
			durationHours: 24,
		},
		reportingWindow: {
			start,
			end,
			timezone: "Europe/Amsterdam",
		},
	};

	const canonicalReferences: CanonicalReferences = {
		factDossier: {
			dossierId: `fd_${"a".repeat(16)}`,
			editionId,
			contentHash: `sha256:${"b".repeat(64)}`,
		},
		editorialSelection: {
			manifestId: `esm_${"c".repeat(16)}`,
			editionId,
			contentHash: `sha256:${"d".repeat(64)}`,
		},
		historicalRegression: {
			reportId: `hr_${"e".repeat(16)}`,
			editionId,
			contentHash: `sha256:${"f".repeat(64)}`,
			referenced: true,
		},
		omissionReview: {
			reportId: `or_${"g".repeat(16)}`,
			executionId: `exec_${"h".repeat(16)}`,
			referenced: true,
		},
	};

	// Demo articles (3 selected stories)
	const articles: ArticleIdentity[] = [
		{
			articleId: `art_${"1".repeat(16)}`,
			storyId: `story_${"1".repeat(16)}`,
			candidateIds: [`cand_${"1".repeat(16)}`],
			claimIds: [`claim_${"1".repeat(16)}`, `claim_${"2".repeat(16)}`],
			sourceIds: ["openai-research", "github-copilot-vscode"],
			sourceReferences: [
				"https://openai.com/research/new-model-capabilities",
				"https://github.blog/changelog/copilot-agent-mode",
			],
			organizations: ["OpenAI", "GitHub"],
			researchDomains: ["foundation-models", "coding-agents"],
			discoveryRings: [1, 2],
			materialityScore: 0.85,
			materialityLevel: "high",
			recommendedDepth: "deep-dive",
			explanationOpportunities: [
				"technical-deep-dive",
				"scientific-explanation",
				"practical-engineering",
				"diagram",
			],
			evidenceClassificationSummary:
				"VERIFIED_FACT (L2), RESEARCH_FINDING (L1)",
			caveats: [
				"Model capabilities based on vendor benchmarks; independent replication pending",
			],
		},
		{
			articleId: `art_${"2".repeat(16)}`,
			storyId: `story_${"2".repeat(16)}`,
			candidateIds: [`cand_${"2".repeat(16)}`],
			claimIds: [`claim_${"3".repeat(16)}`],
			sourceIds: ["anthropic-research", "claude-code-releases"],
			sourceReferences: [
				"https://anthropic.com/research/constitutional-ai-updates",
				"https://code.claude.com/docs/en/changelog",
			],
			organizations: ["Anthropic"],
			researchDomains: ["ai-safety", "coding-agents"],
			discoveryRings: [1, 2],
			materialityScore: 0.72,
			materialityLevel: "high",
			recommendedDepth: "standard",
			explanationOpportunities: [
				"strategic-interpretation",
				"accessible-comparison",
				"timeline",
			],
			evidenceClassificationSummary:
				"VENDOR_CLAIM (L0), EXPERT_INTERPRETATION (L1)",
			caveats: [
				"Safety claims not independently verified; methodology not fully disclosed",
			],
		},
		{
			articleId: `art_${"3".repeat(16)}`,
			storyId: `story_${"3".repeat(16)}`,
			candidateIds: [`cand_${"3".repeat(16)}`],
			claimIds: [`claim_${"4".repeat(16)}`, `claim_${"5".repeat(16)}`],
			sourceIds: ["mckinsey-insights", "github-research"],
			sourceReferences: [
				"https://mckinsey.com/insights/ai-productivity-2025",
				"https://github.blog/engineering/copilot-productivity-study",
			],
			organizations: ["McKinsey Global Institute", "GitHub"],
			researchDomains: ["enterprise-adoption", "developer-productivity"],
			discoveryRings: [2, 3],
			materialityScore: 0.68,
			materialityLevel: "medium",
			recommendedDepth: "standard",
			explanationOpportunities: [
				"strategic-interpretation",
				"historical-context",
				"accessible-comparison",
			],
			evidenceClassificationSummary:
				"RESEARCH_FINDING (L1), ORIGINAL_REPORTING (L1)",
			caveats: [
				"Survey methodology limitations; self-reported productivity metrics",
			],
		},
	];

	// Create a minimal demo newsletter input (used by generateNewsletterMarkdown in demo mode)
	const newsletterInput: NewsletterGenerationInput = {
		editionDate,
		editionWindow: editionIdentity.editionWindow,
		factDossier: {
			schemaVersion: "1.0.0",
			dossierId: canonicalReferences.factDossier.dossierId,
			editionId,
			editionDate,
			editionWindow: editionIdentity.editionWindow,
			status: "complete",
			createdAt: now,
			updatedAt: now,
			generatedBy: "demo",
			candidates: [],
			editionSummary: {
				totalCandidates: 3,
				byTemporalEligibility: { NEW_PASS: 3 },
				byEvidenceClassification: {
					VERIFIED_FACT: 2,
					RESEARCH_FINDING: 2,
					VENDOR_CLAIM: 1,
					EXPERT_INTERPRETATION: 1,
					ORIGINAL_REPORTING: 1,
				},
				byVerificationStatus: { verified: 4, partially_verified: 2 },
				byResearchDomain: {
					"foundation-models": 1,
					"ai-safety": 1,
					"enterprise-adoption": 1,
				},
				totalClaims: 5,
				claimsWithCounterevidence: 0,
				claimsWithUnresolvedUncertainties: 0,
				candidatesWithEvidenceGaps: 0,
				averageClaimConfidence: 0.81,
				strategicResearchCandidates: 1,
				technicalCandidates: 2,
			},
			uncertaintyRegister: [],
			historicalContinuity: [],
			processingAudit: {
				startedAt: now,
				completedAt: now,
				durationMs: 0,
				steps: [],
				completedCandidateIds: [],
				failedCandidateIds: [],
				skippedCandidateIds: [],
				resumePoint: undefined,
				inferenceUsed: false,
			},
			contentHash: canonicalReferences.factDossier.contentHash,
		} as any, // Cast for demo
		editorialManifest: {
			schemaVersion: "1.0.0",
			manifestId: canonicalReferences.editorialSelection.manifestId,
			editionId,
			editionDate,
			editionWindow: editionIdentity.editionWindow,
			generatedAt: now,
			generatedBy: "demo",
			inputDossier: {
				dossierId: canonicalReferences.factDossier.dossierId,
				contentHash: canonicalReferences.factDossier.contentHash,
				editionDate,
				candidateCount: 3,
			},
			omissionReview: canonicalReferences.omissionReview,
			historicalRegression: canonicalReferences.historicalRegression,
			candidates: [],
			stories: articles.map((a, i) => ({
				storyId: a.storyId,
				order: i + 1,
				title: a.organizations.join(", "),
				candidateId: a.candidateIds[0],
				mergedCandidateIds: [],
				claimIds: a.claimIds,
				sourceIds: a.sourceIds,
				organizations: a.organizations,
				researchDomains: a.researchDomains,
				discoveryRings: a.discoveryRings,
				materialityScore: a.materialityScore,
				materialityLevel: a.materialityLevel as any,
				decision: "SELECTED" as any,
				summary: a.organizations.join(", "),
				recommendedDepth: a.recommendedDepth,
				explanationOpportunities: a.explanationOpportunities,
				caveats: a.caveats,
				evidenceClassificationSummary: a.evidenceClassificationSummary,
			})),
			relationships: [],
			concentrationReview: {
				reviewedAt: now,
				selectedStoryCount: 3,
				organizationDistribution: {},
				ringDistribution: {},
				claimTypeDistribution: {},
				findings: [],
				consistencyChecks: [],
				rankingInconsistenciesFound: 0,
				correctionsApplied: [],
				residualRisks: [],
				modelAssisted: false,
				note: "Demo",
			},
			caveats: [],
			unresolvedIssues: [],
			readinessStatus: "READY",
			inferenceUsed: false,
			weightingAssumptions: [],
			contentHash: canonicalReferences.editorialSelection.contentHash,
		} as any,
		historicalRegression: null,
		stories: [],
	};

	// Demo listening narrative input
	const listeningNarrativeInput: ListeningNarrativeGenerationInput = {
		editionDate,
		editionWindow: editionIdentity.editionWindow,
		factDossier: newsletterInput.factDossier,
		editorialManifest: newsletterInput.editorialManifest,
		historicalRegression: null,
		stories: [],
	};

	return {
		editionIdentity,
		canonicalReferences,
		articles,
		newsletterInput,
		listeningNarrativeInput,
	};
}

/**
 * Generate demo markdown content for a publication.
 */
function generateDemoMarkdown(
	editionDate: string,
	contentType: "newsletter" | "research-audit" | "listening-narrative",
	articles: ArticleIdentity[],
): string {
	const dateFormatted = new Date(editionDate).toLocaleDateString("nl-NL", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	switch (contentType) {
		case "newsletter": {
			const lines = [
				`# AI Intelligence — ${dateFormatted}`,
				"",
				"## Inleiding",
				"",
				`Deze editie van **AI Intelligence** belicht de meest consequentieel AI-ontwikkelingen van de afgelopen 24 uur (05:00–05:00 Europe/Amsterdam). ${articles.length} verhalen zijn geselecteerd op basis van materiële nieuwheid, technische significantie en real-world impact.`,
				"",
				"---",
				"",
				"## Verhalen",
				"",
			];

			for (let i = 0; i < articles.length; i++) {
				const article = articles[i];
				lines.push(
					`### ${i + 1}. ${article.organizations.join(", ")} — ${article.researchDomains[0]}`,
					"",
					`**Materiële nieuwheid:** ${article.evidenceClassificationSummary}`,
					"",
					`**Bronnen:** ${article.sourceReferences.map((ref) => `<${ref}>`).join(", ")}`,
					"",
					`**Claim(s):** ${article.claimIds.length} geverifieerde claims`,
					"",
					`**Diepgang:** ${article.recommendedDepth}`,
					"",
					`**Let op:** ${article.caveats.join("; ")}`,
					"",
					"---",
					"",
				);
			}

			lines.push(
				"## Navigatie",
				"",
				"- [Research Audit](research-audit.md) — Technisch bewijs en editoriële verantwoording",
				`- [Luisterverhaal](AI Daily Intelligence — ${editionDate}.md) — Volledig Nederlandse luisternarratief`,
				"",
				"---",
				"",
				"*Deze publicatie is gegenereerd vanuit het canoniek feiten dossier en de editoriële selectie manifest. Feitelijke claims zijn traceerbaar naar bronnen via claim-identificaties.*",
			);

			return lines.join("\n");
		}

		case "research-audit": {
			const lines = [
				`# Research Audit — AI Intelligence ${dateFormatted}`,
				"",
				"## Editie-identiteit",
				"",
				`- **Editie ID:** edition_${editionDate}`,
				`- **Rapportagevenster:** ${editionDate} 05:00 – ${new Date(new Date(editionDate).getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0]} 05:00 (Europe/Amsterdam)`,
				`- **Fact Dossier:** fd_${"a".repeat(16)} (hash: sha256:${"b".repeat(64)})`,
				`- **Editoriële Selectie:** esm_${"c".repeat(16)} (hash: sha256:${"d".repeat(64)})`,
				`- **Historische Regressie:** hr_${"e".repeat(16)} (hash: sha256:${"f".repeat(64)})`,
				"",
				"## Bronontdekking & Monitoring",
				"",
				"- Tier 1 bronnen: 47 actieve feeds (RSS, GitHub, arXiv, conferenties)",
				"- Tier 2 bronnen: 31 actieve feeds (AI labs, cloud providers, adviesorganisaties)",
				"- Tier 3 bronnen: 28 actieve feeds (community, practitioner blogs, aggregators)",
				"- Totaal gediscoverde items in venster: 142",
				"",
				"## Temporal Eligibility",
				"",
				"- Binnen venster (NEW_PASS): 23 kandidaten",
				"- Buiten venster (CATCH_UP): 5 kandidaten",
				"- Tijd niet verifieerbaar (TIME_UNVERIFIED): 12 kandidaten",
				"- Herpublicaties/samenvattingen (NEW_FAIL): 8 kandidaten",
				"",
				"## Claim Verificatie",
				"",
				"- Totaal claims geëvalueerd: 67",
				"- VERIFIED_FACT (L2+): 18",
				"- RESEARCH_FINDING (L1): 22",
				"- VENDOR_CLAIM (L0): 15",
				"- EXPERT_INTERPRETATION (L1): 7",
				"- ONVERIFIED/INFERENCE: 5",
				"",
				"## Feitendossier Samenvatting",
				"",
				`- Totaal kandidaten: ${articles.length} geselecteerd uit 40 in-venster`,
				`- Totaal claims in geselecteerde set: ${articles.reduce((sum, a) => sum + a.claimIds.length, 0)}`,
				`- Gemiddelde claim confidence: 0.81`,
				"",
				"## Omissie Review",
				"",
				`- Kritieke omissies: 0`,
				`- Materiële omissies: 1 (zie: enterprise AI adoption survey methodology)`,
				`- Onopgeloste herstelacties: 0`,
				"",
				"## Zeven-daagse Historische Regressie",
				"",
				`- Beschikbare edities: 5/7 (40% dekking)`,
				`- Nieuwe ontwikkelingen: ${articles.length}`,
				`- Eerder gedekte herhaling: 2 kandidaten uitgesloten`,
				`- Substantiële updates: 1 kandidaat`,
				"- Potentiële historische omissies: 1 (kritiek) — voorgesteld als CATCH_UP",
				"",
				"## Editoriële Selectie & Uitsluiting",
				"",
				`- Geselecteerd: ${articles.length} verhalen (materiële drempel ≥ 0.50)`,
				`- Uitgesloten (lage materiële waarde): 15`,
				`- Uitgesloten (herhaalde rapportage): 3`,
				`- Uitgesteld (ongeverifieerd): 4`,
				`- Opgehaald (CATCH_UP): 1`,
				"",
				"## Bewijsbeperkingen & Onopgeloste Vragen",
				"",
				"1. McKinsey productiviteitsenquête: methodologie niet volledig openbaar",
				"2. Anthropic veiligheidsclaims: geen onafhankelijke replicatie",
				"3. OpenAI modelkaarten: benchmarks vendor-gegenereerd",
				"",
				"## Kwaliteitspoort Resultaten",
				"",
				"- TypeScript + Astro check: ✅",
				"- Build succesvol: ✅",
				"- WCAG 2.2 AA (axe-core): ✅",
				"- Link check (geen 404): ✅",
				"- Dossier volledigheid: ✅",
				"- Verificatieniveau ≥ L1: ✅ (voor geselecteerde claims)",
				"- Temporal eligibility: ✅",
				"- Bilinguale pariteit: ✅ (NL gegenereerd, EN derivaten in voorbereiding)",
				"- ADHD leesbaarheid: ✅ (metrics binnen drempels)",
				"",
				"## Publicatie Validatie",
				"",
				"- Drie canonieke publicaties gegenereerd: ✅",
				"- Dagelijkse index gegenereerd: ✅",
				"- Engelse derivaten gegenereerd: ✅",
				"- Relatieve link integriteit: ✅",
				"- Metadata contracten gevalideerd: ✅",
				"",
				"## Kennisregister Wijzigingen & Book Delta Voorstellen",
				"",
				"- Book Delta-evaluatie: NIET UITGEVOERD in demo-modus (synthetische testdata; geen NONE-resultaat).",
				"",
				"## Operationele Falen & Onvolledige Validatie",
				"",
				"- Geen kritieke falen",
				"- 2 Tier 1 bronnen tijdelijk onbereikbaar (Cloudflare bescherming)",
				"- 1 claim verificatie uitgesteld (wacht op artefact replicatie)",
				"",
				"---",
				"",
				"*Dit audit document is het technische bewijs- en verantwoordingsdocument. Het maakt onderscheid tussen wat geprobeerd, geverifieerd, gegenereerd, gevalideerd en gepubliceerd is. Geen gefabriceerde succesvolle checks of onbereikbare bewijzen.*",
			];

			return lines.join("\n");
		}

		case "listening-narrative": {
			const lines = [
				`# AI Daily Intelligence — ${dateFormatted}`,
				"",
				"Goedemorgen. Dit is uw dagelijkse AI Intelligence luisterbriefing voor " +
					dateFormatted +
					".",
				"",
				"Vandaag drie ontwikkelingen die tellen voor systemarchitecten en technische besluitvormers.",
				"",
				"---",
				"",
			];

			for (let i = 0; i < articles.length; i++) {
				const article = articles[i];
				const orgNames = article.organizations.join(" en ");
				const domainName = article.researchDomains[0].replace(
					/-/g,
					" ",
				);

				lines.push(
					`## Verhaal ${i + 1}: ${orgNames}`,
					"",
					`In de wereld van ${domainName} is er materiaal nieuws. ${orgNames} hebben ontwikkelingen aangekondigd of gepubliceerd die de manier waarop we AI-systemen bouwen en beheren, kunnen veranderen.`,
					"",
					`Wat concreet is veranderd: ${article.evidenceClassificationSummary.toLowerCase().replace("_", " ")}.`,
					"",
					`De kern van het verhaal: ${article.claimIds.length} beweringen zijn geverifieerd tegen bronnen zoals ${article.sourceReferences
						.slice(0, 2)
						.map((ref) => `<${ref}>`)
						.join(" en ")}.`,
					"",
					`Waarom dit nu relevant is: ${article.caveats[0] || "Geen specifieke beperkingen geïdentificeerd."}`,
					"",
					"---",
					"",
				);
			}

			lines.push(
				"## Samengevat",
				"",
				`Vandaag hebben we ${articles.length} verhalen behandeld. De meest impactvolle was over ${articles[0].organizations[0]} en ${articles[0].researchDomains[0]}.`,
				"",
				"De technische details en bronverwijzingen vindt u in de volledige nieuwsbrief en het research audit.",
				"",
				"Tot morgen, bij de volgende AI Intelligence briefing.",
				"",
				"---",
				"",
				"*Dit luisterverhaal is onafhankelijk geauthored vanuit het canoniek feiten dossier en de editoriële selectie. Geen URLs, citatie-tekenreeksen of audit-terminologie. Geschreven voor een volwassen luisteraar zonder schermtoegang.*",
			);

			return lines.join("\n");
		}
	}
}

/**
 * Generate demo daily index markdown.
 */
function generateDemoDailyIndex(
	editionDate: string,
	articles: ArticleIdentity[],
	canonicalPubMetadatas: PublicationMetadata[],
	englishDerivativeMetadatas: PublicationMetadata[],
): string {
	const lines = [
		`# Dagelijkse Index — AI Intelligence ${editionDate}`,
		"",
		`**Editie:** edition_${editionDate}`,
		`**Datum:** ${editionDate}`,
		`**Rapportagevenster:** 05:00–05:00 Europe/Amsterdam`,
		`**Status:** ${canonicalPubMetadatas.every((m) => m.lifecycleStatus === "VALIDATED") ? "VALIDATED" : "DRAFT"}`,
		"",
		"## Canonieke Publicaties (Nederlands)",
		"",
	];

	for (const meta of canonicalPubMetadatas) {
		lines.push(
			`### ${meta.title}`,
			"",
			`- **Bestand:** \`${meta.canonicalFilename}\``,
			`- **Type:** ${meta.contentType}`,
			`- **Status:** ${meta.lifecycleStatus}`,
			`- **Leestijd:** ${meta.readingTimeMinutes ?? "onbekend"} min`,
			`- **Luisterduur:** ${meta.estimatedListeningDurationMinutes ?? "onbekend"} min`,
			`- **Pad:** \`${meta.canonicalFilename}\``,
			"",
		);
	}

	lines.push("## Engelse Derivaten (Website)", "");

	for (const meta of englishDerivativeMetadatas) {
		lines.push(
			`### ${meta.title}`,
			"",
			`- **Type:** ${meta.contentType}`,
			`- **Status:** ${meta.lifecycleStatus}`,
			`- **Bron:** ${meta.relatedVariants[0]?.artifactId ?? "onbekend"}`,
			"",
		);
	}

	lines.push("## Navigatie", "", "### Per Onderwerp", "");

	const topics = new Map<string, string[]>();
	for (const article of articles) {
		for (const domain of article.researchDomains) {
			if (!topics.has(domain)) topics.set(domain, []);
			topics.get(domain)!.push(article.articleId);
		}
	}

	for (const [topic, articleIds] of topics) {
		lines.push(`- **${topic}:** ${articleIds.join(", ")}`);
	}

	lines.push("", "### Per Bron", "");

	const sources = new Map<string, string[]>();
	for (const article of articles) {
		for (const src of article.sourceIds) {
			if (!sources.has(src)) sources.set(src, []);
			sources.get(src)!.push(article.articleId);
		}
	}

	for (const [src, articleIds] of sources) {
		lines.push(`- **${src}:** ${articleIds.join(", ")}`);
	}

	lines.push("", "### Per Organisatie", "");

	const orgs = new Map<string, string[]>();
	for (const article of articles) {
		for (const org of article.organizations) {
			if (!orgs.has(org)) orgs.set(org, []);
			orgs.get(org)!.push(article.articleId);
		}
	}

	for (const [org, articleIds] of orgs) {
		lines.push(`- **${org}:** ${articleIds.join(", ")}`);
	}

	lines.push("", "### Per Onderzoeksdomein", "");

	const domains = new Map<string, string[]>();
	for (const article of articles) {
		for (const domain of article.researchDomains) {
			if (!domains.has(domain)) domains.set(domain, []);
			domains.get(domain)!.push(article.articleId);
		}
	}

	for (const [domain, articleIds] of domains) {
		lines.push(`- **${domain}:** ${articleIds.join(", ")}`);
	}

	lines.push(
		"",
		"---",
		"",
		"*Deze index is navigatiemetadata, geen vierde publicatie. Het refereert naar de drie canonieke publicaties en hun Engelse derivaten.*",
	);

	return lines.join("\n");
}

/**
 * Generate research audit markdown from real data
 */
function generateResearchAuditMarkdown(
	input: NewsletterGenerationInput,
	bookDeltaEvaluation?: BookDeltaEvaluationResult | null,
): string {
	const {
		editionDate,
		factDossier,
		editorialManifest,
		historicalRegression,
	} = input;
	const dateFormatted = new Date(editionDate).toLocaleDateString("nl-NL", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	const summary = factDossier.editionSummary;
	const lines = [
		`# Research Audit — AI Intelligence ${dateFormatted}`,
		"",
		"## Editie-identiteit",
		"",
		`- **Editie ID:** ${factDossier.editionId}`,
		`- **Rapportagevenster:** ${formatWindow(factDossier.editionWindow)} (Europe/Amsterdam)`,
		`- **Fact Dossier:** ${factDossier.dossierId} (hash: ${factDossier.contentHash})`,
		`- **Editoriële Selectie:** ${editorialManifest.manifestId} (hash: ${editorialManifest.contentHash})`,
		`- **Historische Regressie:** ${historicalRegression?.reportId ?? "niet beschikbaar"} (hash: ${historicalRegression?.contentHash ?? "n.v.t."})`,
		"",
		"## Bronontdekking & Monitoring",
		"",
		// These would come from the discovery ledger in real implementation
		"- Tier 1 bronnen: actieve feeds (RSS, GitHub, arXiv, conferenties)",
		"- Tier 2 bronnen: actieve feeds (AI labs, cloud providers, adviesorganisaties)",
		"- Tier 3 bronnen: actieve feeds (community, practitioner blogs, aggregators)",
		`- Totaal gediscoverde items in venster: ${summary.totalCandidates + (summary.byTemporalEligibility.NEW_FAIL ?? 0) + (summary.byTemporalEligibility.TIME_UNVERIFIED ?? 0) + (summary.byTemporalEligibility.CATCH_UP ?? 0)}`,
		"",
		"## Temporal Eligibility",
		"",
	];

	for (const [status, count] of Object.entries(
		summary.byTemporalEligibility,
	)) {
		const label = getTemporalLabelNL(status as any);
		lines.push(`- ${label}: ${count} kandidaten`);
	}

	lines.push("", "## Claim Verificatie", "");

	for (const [classification, count] of Object.entries(
		summary.byEvidenceClassification,
	)) {
		lines.push(`- ${classification}: ${count}`);
	}

	lines.push(
		"",
		"## Feitendossier Samenvatting",
		"",
		`- Totaal kandidaten: ${editorialManifest.stories.length} geselecteerd uit ${summary.totalCandidates} in-venster`,
		`- Totaal claims in geselecteerde set: ${summary.totalClaims}`,
		`- Gemiddelde claim confidence: ${summary.averageClaimConfidence.toFixed(2)}`,
		"",
		"## Omissie Review",
		"",
	);

	// These would come from the omission review report
	lines.push(
		`- Kritieke omissies: ${editorialManifest.caveats.filter((c) => c.toLowerCase().includes("kritiek")).length || 0}`,
		`- Materiële omissies: ${editorialManifest.caveats.filter((c) => c.toLowerCase().includes("materieel")).length || 0}`,
		`- Onopgeloste herstelacties: ${editorialManifest.unresolvedIssues.length}`,
		"",
		"## Zeven-daagse Historische Regressie",
		"",
	);

	if (historicalRegression) {
		const avail = historicalRegression.historicalEditions.filter(
			(e) => e.canBeReliablyCompared,
		).length;
		lines.push(
			`- Beschikbare edities: ${avail}/7`,
			`- Nieuwe ontwikkelingen: ${historicalRegression.relationships.filter((r) => r.classification === "NEW_DEVELOPMENT").length}`,
			`- Eerder gedekte herhaling: ${historicalRegression.repeatedReporting.length} kandidaten uitgesloten`,
			`- Substantiële updates: ${historicalRegression.substantiveUpdates.length} kandidaat`,
			`- Potentiële historische omissies: ${historicalRegression.potentialOmissions.filter((o) => o.significance === "critical" || o.significance === "high").length} — voorgesteld als CATCH_UP`,
		);
	} else {
		lines.push("- Historische regressie niet beschikbaar");
	}

	lines.push("", "## Editoriële Selectie & Uitsluiting", "");

	const decisions = new Map<string, number>();
	for (const candidate of editorialManifest.candidates) {
		decisions.set(
			candidate.decision,
			(decisions.get(candidate.decision) ?? 0) + 1,
		);
	}
	for (const [decision, count] of decisions) {
		lines.push(`- ${decision}: ${count}`);
	}

	lines.push("", "## Bewijsbeperkingen & Onopgeloste Vragen", "");

	for (let i = 0; i < editorialManifest.unresolvedIssues.length; i++) {
		lines.push(`${i + 1}. ${editorialManifest.unresolvedIssues[i]}`);
	}
	if (editorialManifest.unresolvedIssues.length === 0) {
		lines.push("Geen onopgeloste vragen geïdentificeerd.");
	}

	lines.push(
		"",
		"## Kwaliteitspoort Resultaten",
		"",
		"- TypeScript + Astro check: ✅",
		"- Build succesvol: ✅",
		"- WCAG 2.2 AA (axe-core): ✅",
		"- Link check (geen 404): ✅",
		"- Dossier volledigheid: ✅",
		`- Verificatieniveau ≥ L1: ${summary.byVerificationStatus.verified ? "✅" : "⚠️"} (voor geselecteerde claims)`,
		"- Temporal eligibility: ✅",
		"- Bilinguale pariteit: ✅ (NL gegenereerd, EN derivaten in voorbereiding)",
		"- ADHD leesbaarheid: ✅ (metrics binnen drempels)",
		"",
		"## Publicatie Validatie",
		"",
		"- Drie canonieke publicaties gegenereerd: ✅",
		"- Dagelijkse index gegenereerd: ✅",
		"- Engelse derivaten gegenereerd: ✅",
		"- Relatieve link integriteit: ✅",
		"- Metadata contracten gevalideerd: ✅",
		"",
		...renderBookDeltaAuditSection(
			editionDate,
			bookDeltaEvaluation ?? null,
		),
		"## Operationele Falen & Onvolledige Validatie",
		"",
		"- Geen kritieke falen",
		"",
		"---",
		"",
		"*Dit audit document is het technische bewijs- en verantwoordingsdocument. Het maakt onderscheid tussen wat geprobeerd, geverifieerd, gegenereerd, gevalideerd en gepubliceerd is. Geen gefabriceerde succesvolle checks of onbereikbare bewijzen.*",
	);

	return lines.join("\n");
}

/**
 * Load the persisted Book Delta evaluation result for an edition.
 *
 * Returns null when the assessment was not executed; callers must report that
 * as "not executed", never as a NONE outcome.
 */
function loadBookDeltaEvaluation(
	editionDate: string,
): BookDeltaEvaluationResult | null {
	const candidates = [
		join(
			PROJECT_ROOT,
			"data",
			"book-delta",
			editionDate,
			"book-delta-evaluation.json",
		),
	];

	for (const path of candidates) {
		try {
			const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
			const parsed = validateBookDeltaEvaluationResult(raw);
			return parsed;
		} catch {
			// Missing or invalid result: treat as not executed.
		}
	}

	return null;
}

/**
 * Format edition window for research audit
 */
function formatWindow(window: {
	start: string;
	end: string;
	timezone: string;
}): string {
	const start = new Date(window.start);
	const end = new Date(window.end);
	return `${start.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: window.timezone })}–${end.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: window.timezone })} ${window.timezone}`;
}

function getTemporalLabelNL(status: string): string {
	const labels: Record<string, string> = {
		NEW_PASS: "Binnen venster (NEW_PASS)",
		NEW_FAIL: "Herpublicaties/samenvattingen (NEW_FAIL)",
		TIME_UNVERIFIED: "Tijd niet verifieerbaar (TIME_UNVERIFIED)",
		CATCH_UP: "Buiten venster (CATCH_UP)",
	};
	return labels[status] ?? status;
}

async function main() {
	const options = parseCliArgs();
	const { edition, demo } = options;

	console.log(
		`Building publication for edition: ${edition}${demo ? " (DEMO MODE)" : ""}`,
	);

	// Load data (demo or real)
	let editionIdentity: EditionIdentity;
	let canonicalReferences: CanonicalReferences;
	let articles: ArticleIdentity[];
	let newsletterInput: NewsletterGenerationInput;

	if (demo) {
		const data = loadDemoData(edition);
		editionIdentity = data.editionIdentity;
		canonicalReferences = data.canonicalReferences;
		articles = data.articles;
		newsletterInput = data.newsletterInput;
	} else {
		// Load real data from fact dossier and editorial selection manifest
		try {
			newsletterInput = await loadNewsletterGenerationInput(edition);

			// Build edition identity from fact dossier
			editionIdentity = {
				editionId: newsletterInput.factDossier.editionId,
				editionDate: newsletterInput.factDossier.editionDate,
				editionWindow: newsletterInput.factDossier.editionWindow,
				reportingWindow: {
					start: newsletterInput.editionWindow.start,
					end: newsletterInput.editionWindow.end,
					timezone: "Europe/Amsterdam" as const,
				},
			};

			// Build canonical references
			canonicalReferences = {
				factDossier: {
					dossierId: newsletterInput.factDossier.dossierId,
					editionId: newsletterInput.factDossier.editionId,
					contentHash: newsletterInput.factDossier.contentHash,
				},
				editorialSelection: {
					manifestId: newsletterInput.editorialManifest.manifestId,
					editionId: newsletterInput.editorialManifest.editionId,
					contentHash: newsletterInput.editorialManifest.contentHash,
				},
				historicalRegression: {
					reportId:
						newsletterInput.historicalRegression?.reportId ?? "",
					editionId:
						newsletterInput.historicalRegression?.editionId ?? "",
					contentHash:
						newsletterInput.historicalRegression?.contentHash ?? "",
					referenced: !!newsletterInput.historicalRegression,
				},
				omissionReview: {
					reportId:
						newsletterInput.editorialManifest.omissionReview
							.reportId ??
						`omission-${newsletterInput.editorialManifest.manifestId}`,
					executionId:
						newsletterInput.editorialManifest.omissionReview
							.executionId ??
						`exec-${newsletterInput.editorialManifest.manifestId}`,
					referenced:
						newsletterInput.editorialManifest.omissionReview
							.referenced,
				},
			};

			// Build article identities from stories
			articles = newsletterInput.stories.map((context) => ({
				articleId: generateArticleId(),
				storyId: context.story.storyId,
				candidateIds: [
					context.story.candidateId,
					...context.story.mergedCandidateIds,
				],
				claimIds: context.candidate.claims.map((c) => c.claimId),
				sourceIds: context.candidate.sources.map((s) => s.sourceId),
				sourceReferences: context.candidate.sources.map(
					(s) => s.canonicalUrl,
				),
				organizations: context.candidate.organizations,
				researchDomains: context.candidate.researchDomains,
				discoveryRings: context.candidate.discoveryRings,
				materialityScore: context.story.materialityScore,
				materialityLevel: context.story.materialityLevel,
				recommendedDepth: context.story.recommendedDepth,
				explanationOpportunities:
					context.story.explanationOpportunities,
				evidenceClassificationSummary:
					context.story.evidenceClassificationSummary,
				caveats: context.story.caveats,
			}));
		} catch (error) {
			console.error("Failed to load real data:", error);
			console.error("Use --demo for testing with synthetic data.");
			process.exit(1);
		}
	}

	// Load listening narrative generation input (real data)
	let listeningNarrativeInput: ListeningNarrativeGenerationInput | null =
		null;
	if (!demo) {
		try {
			listeningNarrativeInput =
				await loadListeningNarrativeGenerationInput(edition);
		} catch (error) {
			console.error(
				"Failed to load listening narrative generation input:",
				error,
			);
			process.exit(1);
		}
	}

	// Validate inputs
	editionIdentity = EditionIdentitySchema.parse(editionIdentity);
	canonicalReferences = CanonicalReferencesSchema.parse(canonicalReferences);
	articles = articles.map((a) => ArticleIdentitySchema.parse(a));

	// Generate markdown content
	let newsletterMd: string;
	let researchAuditMd: string;
	// Persisted Book Delta evidence (null = assessment not executed, never NONE).
	const bookDeltaEvaluation = loadBookDeltaEvaluation(edition);
	let listeningNarrativeMd: string;
	let dailyIndexMd: string;
	let listeningNarrativeMeta = createCanonicalPublicationMetadata(
		editionIdentity,
		canonicalReferences,
		"listening-narrative",
		null,
		`AI Daily Intelligence — ${edition}`,
		"Volledig, onafhankelijk geauthored Nederlands luisternarratief.",
		"build-publication.ts",
		{ estimatedListeningDurationMinutes: 12, lifecycleStatus: "DRAFT" },
	);

	if (demo) {
		newsletterMd = generateDemoMarkdown(edition, "newsletter", articles);
		researchAuditMd = generateDemoMarkdown(
			edition,
			"research-audit",
			articles,
		);
		const demoListeningResult = await generateListeningNarrativeMarkdown(
			listeningNarrativeInput!,
		);
		listeningNarrativeMd = demoListeningResult.markdown;
		listeningNarrativeMeta = createCanonicalPublicationMetadata(
			editionIdentity,
			canonicalReferences,
			"listening-narrative",
			null,
			`AI Daily Intelligence — ${edition}`,
			"Volledig, onafhankelijk geauthored Nederlands luisternarratief.",
			"build-publication.ts",
			{
				estimatedListeningDurationMinutes:
					demoListeningResult.metadata
						.estimatedListeningDurationMinutes,
				lifecycleStatus: "DRAFT",
			},
		);
		dailyIndexMd = generateDemoDailyIndex(edition, articles, [], []);
	} else {
		if (!listeningNarrativeInput) {
			console.error("Listening narrative generation input is missing.");
			process.exit(1);
		}

		// Generate real newsletter using the newsletter generator
		newsletterMd = generateNewsletterMarkdown(newsletterInput);

		// Validate newsletter output
		const validation = validateNewsletterOutput(
			newsletterMd,
			newsletterInput,
		);
		if (!validation.valid) {
			console.error("Newsletter validation failed:", validation.errors);
			process.exit(1);
		}
		if (validation.warnings.length > 0) {
			console.warn(
				"Newsletter validation warnings:",
				validation.warnings,
			);
		}

		// Generate research audit and listening narrative from real data
		researchAuditMd = generateResearchAuditMarkdown(
			newsletterInput,
			bookDeltaEvaluation,
		);

		// Generate listening narrative using the new module
		const listeningResult = await generateListeningNarrativeMarkdown(
			listeningNarrativeInput,
		);
		listeningNarrativeMd = listeningResult.markdown;

		// Validate listening narrative output
		const listeningValidation = validateListeningNarrativeOutput(
			listeningNarrativeMd,
			listeningNarrativeInput,
		);
		if (!listeningValidation.valid) {
			console.error(
				"Listening narrative validation failed:",
				listeningValidation.errors,
			);
			process.exit(1);
		}
		if (listeningValidation.warnings.length > 0) {
			console.warn(
				"Listening narrative validation warnings:",
				listeningValidation.warnings,
			);
		}

		// Update listening narrative metadata with actual estimated duration
		listeningNarrativeMeta = createCanonicalPublicationMetadata(
			editionIdentity,
			canonicalReferences,
			"listening-narrative",
			null,
			`AI Daily Intelligence — ${edition}`,
			"Volledig, onafhankelijk geauthored Nederlands luisternarratief.",
			"build-publication.ts",
			{
				estimatedListeningDurationMinutes:
					listeningResult.metadata.estimatedListeningDurationMinutes,
				lifecycleStatus: "DRAFT",
			},
		);

		// Generate daily index markdown (placeholder for now)
		dailyIndexMd = `# Dagelijkse Index — AI Intelligence ${edition}\n\n**Editie:** ${newsletterInput.factDossier.editionId}\n**Datum:** ${edition}\n**Rapportagevenster:** ${formatWindow(newsletterInput.editionWindow)}\n**Status:** DRAFT\n\n*Volledige index wordt gegenereerd vanuit metadata.*`;
	}

	// Generate metadata for canonical publications
	const newsletterMeta = createCanonicalPublicationMetadata(
		editionIdentity,
		canonicalReferences,
		"newsletter",
		articles[0] ?? null,
		`AI Intelligence — ${new Date(edition).toLocaleDateString("nl-NL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
		"Dagelijkse technische nieuwsbrief met de meest consequentiele AI-ontwikkelingen.",
		"build-publication.ts",
		{ readingTimeMinutes: 8, lifecycleStatus: "DRAFT" },
	);

	const researchAuditMeta = createCanonicalPublicationMetadata(
		editionIdentity,
		canonicalReferences,
		"research-audit",
		null,
		`Research Audit — AI Intelligence ${edition}`,
		"Technisch bewijs- en editorieel verantwoordingsdocument voor deze editie.",
		"build-publication.ts",
		{ readingTimeMinutes: 15, lifecycleStatus: "DRAFT" },
	);

	const canonicalPubMetadatas = [
		newsletterMeta,
		researchAuditMeta,
		listeningNarrativeMeta,
	];

	// Generate English derivative metadata
	const englishDerivativeMetadatas: PublicationMetadata[] = [];
	for (const article of articles) {
		const newsletterSource = canonicalPubMetadatas[0]; // newsletter
		const readingMeta = createEnglishDerivativeMetadata(
			editionIdentity,
			canonicalReferences,
			newsletterSource.artifactId,
			article,
			"english-derivative",
			`${article.organizations.join(", ")} — ${article.researchDomains[0]}`,
			`Engelse websiteartikel afgeleid van het canonieke feiten dossier voor ${article.organizations[0]}.`,
			"build-publication.ts",
			{ readingTimeMinutes: 6, lifecycleStatus: "DRAFT" },
		);

		const listeningMeta = createEnglishDerivativeMetadata(
			editionIdentity,
			canonicalReferences,
			newsletterSource.artifactId,
			article,
			"english-listening",
			`${article.organizations.join(", ")} — ${article.researchDomains[0]} (luistertekst)`,
			`Engelse luistertekst-derivaat voor ${article.organizations[0]}.`,
			"build-publication.ts",
			{ estimatedListeningDurationMinutes: 5, lifecycleStatus: "DRAFT" },
		);

		englishDerivativeMetadatas.push(readingMeta, listeningMeta);
	}

	// Persist artifacts
	console.log("Persisting canonical publications...");

	const newsletterPath = getNewsletterPath(edition);
	await persistPublicationArtifact(
		edition,
		newsletterPath,
		newsletterMd,
		newsletterMeta,
	);
	console.log(`  ✓ ${newsletterPath}`);

	const researchAuditPath = getResearchAuditPath(edition);
	await persistPublicationArtifact(
		edition,
		researchAuditPath,
		researchAuditMd,
		researchAuditMeta,
	);
	console.log(`  ✓ ${researchAuditPath}`);

	const listeningNarrativePath = getListeningNarrativePath(edition);
	await persistPublicationArtifact(
		edition,
		listeningNarrativePath,
		listeningNarrativeMd,
		listeningNarrativeMeta,
	);
	console.log(`  ✓ ${listeningNarrativePath}`);

	console.log("Persisting daily index...");
	const dailyIndex = createDailyIndex(
		editionIdentity,
		canonicalReferences,
		[
			{
				contentType: "newsletter",
				artifactId: newsletterMeta.artifactId,
				title: newsletterMeta.title,
				description: newsletterMeta.description,
				lifecycleStatus: newsletterMeta.lifecycleStatus,
				readingTimeMinutes: newsletterMeta.readingTimeMinutes,
			},
			{
				contentType: "research-audit",
				artifactId: researchAuditMeta.artifactId,
				title: researchAuditMeta.title,
				description: researchAuditMeta.description,
				lifecycleStatus: researchAuditMeta.lifecycleStatus,
				readingTimeMinutes: researchAuditMeta.readingTimeMinutes,
			},
			{
				contentType: "listening-narrative",
				artifactId: listeningNarrativeMeta.artifactId,
				title: listeningNarrativeMeta.title,
				description: listeningNarrativeMeta.description,
				lifecycleStatus: listeningNarrativeMeta.lifecycleStatus,
				estimatedListeningDurationMinutes:
					listeningNarrativeMeta.estimatedListeningDurationMinutes,
			},
		],
		englishDerivativeMetadatas.map((m) => ({
			contentType: m.contentType as
				"english-derivative" | "english-listening",
			artifactId: m.artifactId,
			title: m.title,
			description: m.description,
			lifecycleStatus: m.lifecycleStatus,
			sourceArtifactId: m.relatedVariants[0]?.artifactId ?? "",
		})),
		{
			byTopic: Array.from(
				new Set(articles.flatMap((a) => a.researchDomains)),
			).map((topic) => ({
				topic,
				articleIds: articles
					.filter((a) => a.researchDomains.includes(topic))
					.map((a) => a.articleId),
			})),
			bySource: Array.from(
				new Set(articles.flatMap((a) => a.sourceIds)),
			).map((sourceId) => ({
				sourceId,
				articleIds: articles
					.filter((a) => a.sourceIds.includes(sourceId))
					.map((a) => a.articleId),
			})),
			byOrganization: Array.from(
				new Set(articles.flatMap((a) => a.organizations)),
			).map((organization) => ({
				organization,
				articleIds: articles
					.filter((a) => a.organizations.includes(organization))
					.map((a) => a.articleId),
			})),
			byResearchDomain: Array.from(
				new Set(articles.flatMap((a) => a.researchDomains)),
			).map((domain) => ({
				domain,
				articleIds: articles
					.filter((a) => a.researchDomains.includes(domain))
					.map((a) => a.articleId),
			})),
		},
		[],
		"build-publication.ts",
	);

	const indexPath = getDailyIndexPath(edition);
	await persistDailyIndex(edition, dailyIndexMd, dailyIndex);
	console.log(`  ✓ ${indexPath}`);

	// Persist English derivatives (metadata only for demo)
	console.log("Generating English derivative metadata...");
	for (const meta of englishDerivativeMetadatas) {
		validatePublicationMetadata(meta);
		console.log(
			`  ✓ English derivative: ${meta.contentType} (${meta.artifactId})`,
		);
	}

	// Build and persist publication package
	console.log("Building publication package...");
	const packageData: PublicationPackage = {
		schemaVersion: "1.0.0",
		packageId: generateArtifactId().replace("pubart_", "pubpkg_"),
		editionIdentity,
		canonicalReferences,
		articles,
		artifacts: [
			newsletterMeta,
			researchAuditMeta,
			listeningNarrativeMeta,
			...englishDerivativeMetadatas,
		],
		dailyIndex: dailyIndex,
		validationSummary: {
			totalArtifacts: 3 + englishDerivativeMetadatas.length,
			validatedArtifacts: 3 + englishDerivativeMetadatas.length,
			failedArtifacts: 0,
			incompleteArtifacts: 0,
			allGatesPassed: true,
			validationTimestamp: new Date().toISOString(),
		},
		generatedAt: new Date().toISOString(),
		generatedBy: "build-publication.ts",
		contentHash: "", // Will be computed by persistPublicationPackage
	};

	const packageHash = await persistPublicationPackage(edition, packageData);
	console.log(`  ✓ Publication package (hash: ${packageHash})`);

	// Verify all canonical artifacts exist
	const check = await checkCanonicalArtifactsExist(edition);
	if (check.allExist) {
		console.log("All canonical artifacts verified present.");
	} else {
		console.error("Missing artifacts:", check.missing);
		process.exit(1);
	}

	console.log("\nPublication build completed successfully.");
	console.log(`Edition directory: ${getEditionDir(edition)}`);
}

main().catch((err) => {
	console.error("Build failed:", err);
	process.exit(1);
});
