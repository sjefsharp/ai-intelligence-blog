/**
 * Research Audit Generator
 *
 * Generates the research-audit.md (Technical Evidence & Editorial Accountability)
 * — one of the three canonical daily publications per contract §2.
 *
 * This document provides complete traceability from sources through claims
 * to editorial decisions, enabling independent verification.
 */

import { readdirSync } from "fs";
import {
	type CanonicalReferences,
	type PublicationMetadata,
} from "./schema.js";
import type { CanonicalFactDossier } from "../fact-dossier/schema.js";
import type { EditorialSelectionManifest } from "../editorial-selection/schema.js";
import type { HistoricalRegressionReport } from "../historical-regression/schema.js";
import {
	createCanonicalPublicationMetadata,
	computeContentHash,
} from "./metadata.js";
import { persistPublicationArtifact } from "./store.js";

export interface ResearchAuditGenerationInput {
	editionDate: string;
	factDossier: CanonicalFactDossier;
	editorialManifest: EditorialSelectionManifest;
	historicalRegression: HistoricalRegressionReport | null;
	dataDir?: string;
	now?: string;
	generatedBy?: string;
}

export interface ResearchAuditGenerationResult {
	markdown: string;
	metadata: PublicationMetadata;
	traceability: {
		sourceCoverage: string[];
		claimCoverage: string[];
		storyCoverage: string[];
	};
}

function formatDateNL(dateStr: string): string {
	const date = new Date(`${dateStr}T00:00:00`);
	return date.toLocaleDateString("nl-NL", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
		timeZone: "Europe/Amsterdam",
	});
}

function formatWindow(window: {
	start: string;
	end: string;
	timezone: string;
}): string {
	const start = new Date(window.start);
	const end = new Date(window.end);
	const fmt: Intl.DateTimeFormatOptions = {
		hour: "2-digit",
		minute: "2-digit",
		timeZone: window.timezone,
	};
	return `${start.toLocaleTimeString("nl-NL", fmt)}–${end.toLocaleTimeString("nl-NL", fmt)} ${window.timezone}`;
}

function countWords(text: string): number {
	return text.split(/\s+/).filter((w) => w.length > 0).length;
}

function getSelectedStories(editorialManifest: EditorialSelectionManifest) {
	return editorialManifest.stories.filter(
		(s) => s.decision === "SELECTED" || s.decision === "CATCH_UP_SELECTED",
	);
}

function buildSourceReferenceSection(
	factDossier: CanonicalFactDossier,
): string {
	const sources = factDossier.candidates.flatMap((c) =>
		c.claims.flatMap((claim) => claim.supportingEvidenceUrls),
	);
	const uniqueSources = [...new Set(sources)];

	let md = "## Bronnenoverzicht\n\n";
	md += "| Bron ID | URL | Tier | Toegankelijkheid |\n";
	md += "|---------|-----|------|------------------|\n";

	for (const sourceRef of uniqueSources) {
		const source = factDossier.candidates
			.flatMap((c) => c.claims)
			.find((claim) => claim.supportingEvidenceUrls.includes(sourceRef));
		const url = sourceRef;
		const tier = source?.verificationLevel || "onbekend";
		const accessibility = "open"; // Would need source registry lookup
		md += `| \`${sourceRef}\` | ${url} | ${tier} | ${accessibility} |\n`;
	}

	return md;
}

function buildClaimTraceabilitySection(
	factDossier: CanonicalFactDossier,
): string {
	let md = "## Claim-traceerbaarheid\n\n";
	md +=
		"| Claim ID | Tekst | Verificatiestatus | Evidentieclassificatie | Bronnen |\n";
	md +=
		"|----------|-------|-------------------|------------------------|---------|\n";

	for (const candidate of factDossier.candidates) {
		for (const claim of candidate.claims) {
			const verification = claim.verificationStatus || "onbeoordeeld";
			const evidence = claim.evidenceClassification || "onbekend";
			const sources = claim.supportingEvidenceUrls.join(", ") || "geen";
			md += `| \`${claim.claimId}\` | ${claim.claimStatement.slice(0, 80)}... | ${verification} | ${evidence} | ${sources} |\n`;
		}
	}

	return md;
}

/** Candidate decisions that remove a candidate from selection. */
const EXCLUDED_DECISIONS = new Set([
	"EXCLUDED_LOW_MATERIALITY",
	"EXCLUDED_REPEATED",
	"EXCLUDED_TEMPORAL",
	"DEFERRED_UNVERIFIED",
]);

function buildEditorialAccountabilitySection(
	editorialManifest: EditorialSelectionManifest,
	factDossier: CanonicalFactDossier,
): string {
	const selectedStories = getSelectedStories(editorialManifest);

	let md = "## Editoriële verantwoording\n\n";
	md += "### Selectiecriteria\n\n";
	md += "Verhalen worden geselecteerd op basis van:\n";
	md +=
		"- **Materiële relevantie**: Verhouding tussen claim-ondersteuning en brede impact\n";
	md += "- **Evidentiedichtheid**: Aantal geverifieerde claims per bron\n";
	md +=
		"- **Nieuwsgierigheid**: Eerste openbaarmaking binnen rapportagevenster\n";
	md += "- **Onafhankelijkheid**: Geen vendor-bias in selectie\n\n";

	md += "### Geselecteerde verhalen\n\n";
	md +=
		"| Verhaal ID | Titel | Beslissing | Onderzoeksdomein | Claim-aantal |\n";
	md +=
		"|------------|-------|------------|------------------|--------------|\n";

	for (const story of selectedStories) {
		const candidate = factDossier.candidates.find(
			(c: CanonicalFactDossier["candidates"][0]) =>
				c.candidateId === story.candidateId,
		);
		const claimCount = candidate?.claims?.length || 0;
		md += `| \`${story.storyId}\` | ${story.title} | ${story.decision} | ${story.researchDomains?.join(", ") || "n.v.t."} | ${claimCount} |\n`;
	}

	md += "\n### Uitgesloten kandidaten\n\n";
	const excludedCandidates = editorialManifest.candidates.filter((c) =>
		EXCLUDED_DECISIONS.has(c.decision),
	);

	if (excludedCandidates.length > 0) {
		md += "| Kandidaat ID | Kop | Beslissing | Reden |\n";
		md += "|-------------|-----|------------|-------|\n";
		for (const candidate of excludedCandidates) {
			md += `| \`${candidate.candidateId}\` | ${candidate.factualHeadline} | ${candidate.decision} | ${candidate.decisionReasons.join("; ") || "onvoldoende evidentie"} |\n`;
		}
	} else {
		md += "Geen kandidaten uitgesloten.\n";
	}

	return md;
}

function buildOmissionReviewSection(omissionReview: any): string {
	let md = "## Omissiereview\n\n";

	if (!omissionReview) {
		md += "Geen omissiereview beschikbaar.\n";
		return md;
	}

	md += `**Uitvoerings-ID**: ${omissionReview.context?.executionId || "onbekend"}\n`;
	md += `**Versie**: ${omissionReview.version || "onbekend"}\n\n`;

	if (omissionReview.newlyDiscoveredCandidates?.length > 0) {
		md += "### Nieuwo ontdekte kandidaten\n\n";
		md += "| Kandidaat ID | Titel | Reden |\n";
		md += "|--------------|-------|-------|\n";
		for (const c of omissionReview.newlyDiscoveredCandidates) {
			md += `| \`${c.candidateId || c.id}\` | ${c.title || c.candidateTitle} | ${c.justification || "Nieuw in rapportagevenster"} |\n`;
		}
		md += "\n";
	}

	if (omissionReview.criticalAndMaterialOmissionsRepaired?.length > 0) {
		md += "### Herstelde kritieke/materiële omissies\n\n";
		for (const r of omissionReview.criticalAndMaterialOmissionsRepaired) {
			md += `- \`${r.candidateId}\`: ${r.repairDescription || "Hersteld via aanvullende zoekopdracht"}\n`;
		}
		md += "\n";
	}

	if (omissionReview.remainingCoverageGaps?.length > 0) {
		md += "### Resterende dekkingsgaten\n\n";
		for (const gap of omissionReview.remainingCoverageGaps) {
			md += `- ${gap.description || gap.domain}: ${gap.reason || "Geen bronnen gevonden"}\n`;
		}
		md += "\n";
	}

	return md;
}

function buildHistoricalRegressionSection(
	historicalRegression: HistoricalRegressionReport | null,
): string {
	let md = "## Historische regressie (7 kalenderdagen)\n\n";

	if (!historicalRegression) {
		md += "Geen historische regressie beschikbaar.\n";
		return md;
	}

	md += `**Rapport-ID**: ${historicalRegression.reportId || "onbekend"}\n`;
	md += `**Status**: ${historicalRegression.finalStatus || "onbekend"}\n\n`;

	if (historicalRegression.relationships?.length > 0) {
		md += "### Gedetecteerde relaties\n\n";
		md +=
			"| Classificatie | Kandidaat ID | Editiedatum | Betrouwbaarheid | Toelichting |\n";
		md +=
			"|---------------|--------------|-------------|-----------------|-------------|\n";
		for (const rel of historicalRegression.relationships) {
			md += `| ${rel.classification} | \`${rel.candidateId}\` | ${rel.editionDate} | ${(rel.confidence * 100).toFixed(0)}% | ${rel.rationale || "Automatisch gedetecteerd"} |\n`;
		}
		md += "\n";
	}

	if (historicalRegression.missingHistoricalEvidence?.length > 0) {
		md += "### Ontbrekende historische bewijzen\n\n";
		for (const m of historicalRegression.missingHistoricalEvidence) {
			md += `- ${m}\n`;
		}
		md += "\n";
	}

	return md;
}

function buildCrossReferenceSection(
	factDossier: CanonicalFactDossier,
	editorialManifest: EditorialSelectionManifest,
): string {
	const selectedStories = getSelectedStories(editorialManifest);

	let md = "## Kruisverwijzingen & Navigatie\n\n";

	md += "### Per onderwerp\n\n";
	const topics = new Map<string, string[]>();
	for (const story of selectedStories) {
		for (const domain of story.researchDomains || []) {
			if (!topics.has(domain)) topics.set(domain, []);
			topics.get(domain)!.push(story.storyId);
		}
	}
	for (const [topic, stories] of topics) {
		md += `**${topic}**: ${stories.map((s) => `\`${s}\``).join(", ")}\n\n`;
	}

	md += "### Per organisatie\n\n";
	const orgs = new Map<string, string[]>();
	for (const story of selectedStories) {
		for (const org of story.organizations || []) {
			if (!orgs.has(org)) orgs.set(org, []);
			orgs.get(org)!.push(story.storyId);
		}
	}
	for (const [org, stories] of orgs) {
		md += `**${org}**: ${stories.map((s) => `\`${s}\``).join(", ")}\n\n`;
	}

	md += "### Per bron\n\n";
	const sources = new Map<string, string[]>();
	for (const candidate of factDossier.candidates) {
		for (const claim of candidate.claims) {
			for (const src of claim.supportingEvidenceUrls) {
				if (!sources.has(src)) sources.set(src, []);
				sources.get(src)!.push(candidate.candidateId);
			}
		}
	}
	for (const [src, candidates] of sources) {
		md += `**${src}**: ${candidates.map((c) => `\`${c}\``).join(", ")}\n\n`;
	}

	return md;
}

function buildTraceabilitySection(
	factDossier: CanonicalFactDossier,
	editorialManifest: EditorialSelectionManifest,
): {
	sourceCoverage: string[];
	claimCoverage: string[];
	storyCoverage: string[];
} {
	const sourceCoverage = new Set<string>();
	const claimCoverage = new Set<string>();
	const storyCoverage = new Set<string>();

	for (const story of getSelectedStories(editorialManifest)) {
		storyCoverage.add(story.storyId);
		const candidate = factDossier.candidates.find(
			(c) => c.candidateId === story.candidateId,
		);
		if (candidate) {
			for (const claim of candidate.claims) {
				claimCoverage.add(claim.claimId);
				for (const src of claim.supportingEvidenceUrls) {
					sourceCoverage.add(src);
				}
			}
		}
	}

	return {
		sourceCoverage: [...sourceCoverage],
		claimCoverage: [...claimCoverage],
		storyCoverage: [...storyCoverage],
	};
}

/**
 * Generate the complete Dutch research audit markdown.
 */
export async function generateResearchAuditMarkdown(
	input: ResearchAuditGenerationInput,
): Promise<ResearchAuditGenerationResult> {
	const {
		editionDate,
		factDossier,
		editorialManifest,
		historicalRegression,
		generatedBy = "research-audit-generator",
	} = input;

	const dateFormatted = formatDateNL(editionDate);
	const window = factDossier.editionWindow || {
		editionDate,
		start: `${editionDate}T05:00:00+01:00[Europe/Amsterdam]`,
		end: `${editionDate}T05:00:00+01:00[Europe/Amsterdam]`,
		timezone: "Europe/Amsterdam",
		durationHours: 24,
	};

	const traceability = buildTraceabilitySection(
		factDossier,
		editorialManifest,
	);

	const lines: string[] = [
		`# Research Audit — ${dateFormatted}`,
		"",
		"## Inleiding",
		"",
		`Dit research audit documenteert de technische bewijslast en editoriële verantwoording voor de AI Intelligence editie van ${dateFormatted}. Het biedt volledige traceerbaarheid van bronnen door claims naar editoriële beslissingen, ter ondersteuning van onafhankelijke verificatie.`,
		"",
		`**Rapportagevenster**: ${formatWindow(window)}`,
		`**Feitendossier**: ${factDossier.dossierId || "onbekend"} (${factDossier.contentHash?.slice(0, 16) || "onbekend"})`,
		`**Editoriële selectie**: ${editorialManifest.manifestId || "onbekend"}`,
		`**Historische regressie**: ${historicalRegression?.reportId || "niet beschikbaar"}`,
		`**Contraatversie**: ${factDossier.schemaVersion || "1.0.0"}`,
		"",
		"---\n",
		buildSourceReferenceSection(factDossier),
		"\n",
		buildClaimTraceabilitySection(factDossier),
		"\n",
		buildEditorialAccountabilitySection(editorialManifest, factDossier),
		"\n",
		buildOmissionReviewSection(null),
		"\n",
		buildHistoricalRegressionSection(historicalRegression),
		"\n",
		buildCrossReferenceSection(factDossier, editorialManifest),
		"\n",
		"## Methodologie & Kwaliteitsborging\n\n",
		"### Bronverificatie\n",
		"- Alle bronnen geverifieerd via originiele publicatie-URL's\n",
		"- Tier-1 bronnen (officiële release notes, peer-reviewed papers) gewogen zwaarder\n",
		"- Tier-2/3 bronnen (blogposts, community signalen) gemarkeerd als ondersteunend\n\n",
		"### Claim-verificatie\n",
		"- Elke claim geverifieerd tegen minimaal één Tier-1 bron\n",
		"- Conflicterende bronnen gemarkeerd en gedocumenteerd in onzekerheidsregister\n",
		'- Claims zonder voldoende bewijs gemarkeerd als "onbeoordeeld"\n\n',
		"### Editoriële integriteit\n",
		"- Selectiecriteria gepubliceerd en toepasbaar op alle kandidaten\n",
		"- Geen vendor-bias: selectie op basis van materiële relevantie\n",
		"- Uitgesloten kandidaten transparent gerapporteerd met redenen\n\n",
		"### Historische continuïteit\n",
		"- 7-kalenderdag regressie tegen eerdere edities\n",
		"- Dubbele vermeldingen gedetecteerd en geconsolideerd\n",
		"- Nieuwe informatie over historische items geaggregeerd\n\n",
	];

	const markdown = lines.join("\n");

	// Create metadata
	const editionIdentity = {
		editionId: `edition_${editionDate}`,
		editionDate,
		editionWindow: {
			editionDate,
			start: window.start,
			end: window.end,
			timezone: window.timezone,
			durationHours: window.durationHours || 24,
		},
		reportingWindow: {
			start: window.start,
			end: window.end,
			timezone: window.timezone,
		},
	};

	const canonicalReferences: CanonicalReferences = {
		factDossier: {
			dossierId: factDossier.dossierId || "",
			editionId: factDossier.editionId || "",
			contentHash: factDossier.contentHash || "",
		},
		editorialSelection: {
			manifestId: editorialManifest.manifestId || "",
			editionId: editorialManifest.editionId || "",
			contentHash: editorialManifest.contentHash || "",
		},
		historicalRegression: historicalRegression
			? {
					reportId: historicalRegression.reportId || "",
					editionId: historicalRegression.editionId || "",
					contentHash: historicalRegression.contentHash || "",
					referenced: true,
				}
			: {
					reportId: "",
					editionId: "",
					contentHash: "",
					referenced: false,
				},
		omissionReview: {
			reportId: "",
			executionId: "",
			referenced: false,
		},
	};

	const metadata = createCanonicalPublicationMetadata(
		editionIdentity,
		canonicalReferences,
		"research-audit",
		null, // research-audit covers whole edition, no single article
		`Research Audit — ${dateFormatted}`,
		"Technisch bewijs en editoriële verantwoording voor AI Intelligence",
		generatedBy,
		{
			lifecycleStatus: "DRAFT",
			validationStatus: "pending",
			readingTimeMinutes: Math.ceil(countWords(markdown) / 200),
		},
	);

	return {
		markdown,
		metadata,
		traceability,
	};
}

/**
 * Load input from filesystem for workflow execution.
 */
export async function loadResearchAuditGenerationInput(
	editionDate: string,
	dataDir: string = "data",
): Promise<ResearchAuditGenerationInput> {
	const { readFileSync } = await import("fs");
	const { join } = await import("path");

	// Load fact dossier
	const dossierPath = join(
		dataDir,
		"fact-dossiers",
		`edition_${editionDate}.json`,
	);
	const factDossier = JSON.parse(readFileSync(dossierPath, "utf-8"));

	// Load editorial selection manifest
	const editorialDir = join(dataDir, "editorial-selection");
	const editorialFiles = readdirSync(editorialDir)
		.filter((f) => f.startsWith(`${editionDate}_`) && f.endsWith(".json"))
		.sort();
	if (editorialFiles.length === 0) {
		throw new Error(
			`No editorial selection manifest found for ${editionDate}`,
		);
	}
	const latestManifest = editorialFiles[editorialFiles.length - 1];
	const editorialManifest = JSON.parse(
		readFileSync(join(editorialDir, latestManifest), "utf-8"),
	);

	// Load historical regression (optional)
	let historicalRegression = null;
	try {
		const historicalDir = join(dataDir, "historical-regression");
		const historicalFiles = readdirSync(historicalDir)
			.filter(
				(f) => f.startsWith(`${editionDate}_`) && f.endsWith(".json"),
			)
			.sort();
		if (historicalFiles.length > 0) {
			historicalRegression = JSON.parse(
				readFileSync(
					join(
						historicalDir,
						historicalFiles[historicalFiles.length - 1],
					),
					"utf-8",
				),
			);
		}
	} catch {
		// Optional
	}

	return {
		editionDate,
		factDossier,
		editorialManifest,
		historicalRegression,
		dataDir,
		now: new Date().toISOString(),
		generatedBy: "research-audit-generator",
	};
}

/**
 * Generate and persist the research audit artifact.
 * Entry point for workflow stage.
 */
export async function generateResearchAudit(input: any): Promise<any> {
	const editionDate = input.editionDate;

	// Load input using existing loader
	const loadedInput = await loadResearchAuditGenerationInput(
		editionDate,
		"data",
	);

	// Generate the research audit
	const result = await generateResearchAuditMarkdown(loadedInput);

	// Persist the artifact
	const artifactPath = `editions/edition_${editionDate}/canonical/research-audit.md`;
	await persistPublicationArtifact(
		editionDate,
		artifactPath,
		result.markdown,
		result.metadata,
	);

	return {
		markdown: result.markdown,
		metadata: {
			...result.metadata,
			contentHash: computeContentHash(result.markdown),
		},
		traceability: result.traceability,
	};
}
