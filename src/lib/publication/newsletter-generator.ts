/**
 * Dutch Technical Newsletter Generator
 *
 * Generates the canonical publication.md from validated upstream inputs:
 * - Canonical Fact Dossier (factual authority)
 * - Editorial Selection Manifest (selection authority)
 * - Historical Regression Report (historical context)
 *
 * Implements layered story composition per the publication contract:
 * A. What changed (newly disclosed information)
 * B. Why it matters (concrete significance)
 * C. How it works (underlying mechanism)
 * D. Limitations and counterevidence
 * E. Technical and strategic depth
 * F. Original sources
 */

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

/**
 * Story composition context loaded from upstream artifacts
 */
export interface NewsletterStoryContext {
	story: EditorialStory;
	candidate: CanonicalCandidate;
	assessment: EditorialCandidateAssessment;
	historicalRelationship: HistoricalRelationship | null;
	historicalClassification: HistoricalRelationshipClassification | null;
}

/**
 * Loaded upstream data for newsletter generation
 */
export interface NewsletterGenerationInput {
	editionDate: string;
	editionWindow: {
		editionDate: string;
		start: string;
		end: string;
		timezone: string;
		durationHours: number;
	};
	factDossier: CanonicalFactDossier;
	editorialManifest: EditorialSelectionManifest;
	historicalRegression: HistoricalRegressionReport | null;
	stories: NewsletterStoryContext[];
}

/**
 * Generate the complete Dutch technical newsletter markdown
 */
export function generateNewsletterMarkdown(
	input: NewsletterGenerationInput,
): string {
	const { editionDate, editionWindow, stories } = input;
	const dateFormatted = formatDutchDate(editionDate);

	const lines: string[] = [
		`# AI Intelligence — ${dateFormatted}`,
		"",
		"## Inleiding",
		"",
		generateIntroduction(editionDate, editionWindow, stories),
		"",
		"---",
		"",
		"## Verhalen",
		"",
	];

	for (let i = 0; i < stories.length; i++) {
		const context = stories[i];
		lines.push(...generateStorySection(i + 1, context, input));
		lines.push("", "---", "");
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

/**
 * Generate the editorial introduction
 */
function generateIntroduction(
	editionDate: string,
	editionWindow: {
		editionDate: string;
		start: string;
		end: string;
		timezone: string;
		durationHours: number;
	},
	stories: NewsletterStoryContext[],
): string {
	if (stories.length === 0) {
		return `Deze editie van **AI Intelligence** belicht de afgelopen 24 uur (${formatWindow(editionWindow)}). Er zijn geen ontwikkelingen geselecteerd die de materiële drempel bereiken.`;
	}

	// Identify the lead story and its significance
	const leadStory = stories[0];
	const leadCandidate = leadStory.candidate;
	const leadAssessment = leadStory.assessment;

	// Build a concrete, factual introduction
	const parts: string[] = [];

	parts.push(
		`Deze editie van **AI Intelligence** belicht de meest consequentieel AI-ontwikkelingen van de afgelopen 24 uur (${formatWindow(editionWindow)}). ${stories.length} verhalen zijn geselecteerd op basis van materiële nieuwheid, technische significantie en real-world impact.`,
	);

	// Lead with concrete news, not generic trends
	const leadOrg = leadCandidate.organizations[0] ?? "onbekende organisatie";
	const leadDomain = leadCandidate.researchDomains[0] ?? "onbekend domein";
	const leadHeadline = leadCandidate.factualHeadline;

	parts.push(
		`De meest impactvolle ontwikkeling betreft **${leadOrg}** in het domein **${translateDomain(leadDomain)}**: ${leadHeadline.toLowerCase()}.`,
	);

	// Mention the evidence classification of the lead
	const leadEvidenceSummary = leadAssessment.eligibility.evidenceSufficiency;
	const leadTemporal = leadStory.historicalClassification;
	if (leadTemporal) {
		const temporalLabel = getHistoricalLabel(leadTemporal);
		if (temporalLabel) {
			parts.push(
				`Deze ontwikkeling is geclassificeerd als **${temporalLabel}** met bewijslast **${leadEvidenceSummary}**.`,
			);
		}
	}

	// Brief mention of other significant stories if more than 1
	if (stories.length > 1) {
		const otherTopics = stories
			.slice(1, 4)
			.map(
				(s) =>
					`${s.candidate.organizations[0] ?? "onbekend"} (${translateDomain(s.candidate.researchDomains[0] ?? "onbekend")})`,
			)
			.join(", ");
		parts.push(
			`Verder in deze editie: ${otherTopics}${stories.length > 4 ? ` en ${stories.length - 4} andere ontwikkelingen` : ""}.`,
		);
	}

	return parts.join(" ");
}

/**
 * Generate a single story section with layered composition
 */
function generateStorySection(
	index: number,
	context: NewsletterStoryContext,
	input: NewsletterGenerationInput,
): string[] {
	const {
		story,
		candidate,
		assessment,
		historicalRelationship,
		historicalClassification,
	} = context;
	const lines: string[] = [];

	// Story heading with organization and domain
	const orgNames = candidate.organizations.join(", ");
	const domainLabel = translateDomain(
		candidate.researchDomains[0] ?? "onbekend",
	);
	lines.push(`### ${index}. ${orgNames} — ${domainLabel}`);
	lines.push("");

	// A. What changed
	lines.push(
		...generateWhatChanged(candidate, assessment, historicalClassification),
	);
	lines.push("");

	// B. Why it matters
	lines.push(
		...generateWhyItMatters(candidate, assessment, historicalRelationship),
	);
	lines.push("");

	// C. How it works
	lines.push(...generateHowItWorks(candidate, assessment));
	lines.push("");

	// D. Limitations and counterevidence
	lines.push(...generateLimitations(candidate, assessment));
	lines.push("");

	// E. Technical and strategic depth (if deep-dive)
	if (story.recommendedDepth === "deep-dive") {
		lines.push(...generateTechnicalDepth(candidate, assessment));
		lines.push("");
	}

	// F. Original sources
	lines.push(...generateSources(candidate, assessment));
	lines.push("");

	// Evidence classification summary and caveats
	lines.push(
		`**Materiële nieuwheid:** ${assessment.eligibility.evidenceSufficiency} — ${story.evidenceClassificationSummary}`,
	);
	lines.push("");
	lines.push(`**Diepgang:** ${translateDepth(story.recommendedDepth)}`);
	lines.push("");
	if (story.caveats.length > 0) {
		// Truncate caveats to avoid overwhelming the reader; keep first 3
		// Also truncate individual caveats that are excessively long
		const displayedCaveats = story.caveats.slice(0, 3).map((caveat) => {
			if (caveat.length > 300) {
				return caveat.substring(0, 300) + "…";
			}
			return caveat;
		});
		const moreCount = story.caveats.length - displayedCaveats.length;
		let caveatsText = displayedCaveats.join("; ");
		if (moreCount > 0) {
			caveatsText += `; en ${moreCount} andere`;
		}
		lines.push(`**Let op:** ${caveatsText}`);
		lines.push("");
	}

	return lines;
}

/**
 * Layer A: What changed — newly disclosed information
 */
function generateWhatChanged(
	candidate: CanonicalCandidate,
	assessment: EditorialCandidateAssessment,
	historicalClassification: HistoricalRelationshipClassification | null,
): string[] {
	const lines: string[] = ["#### Wat is veranderd", ""];

	// Lead with the exact factual statement
	lines.push(candidate.exactStatement);
	lines.push("");

	// Temporal context
	const pubTime = candidate.timestamps.originalPublicationTimestamp;
	const firstDisclosure =
		candidate.timestamps.earliestSupportedPublicDisclosureTimestamp;
	const underlyingEvent = candidate.timestamps.underlyingEventDate;

	if (pubTime) {
		const pubDate = formatDutchDateTime(pubTime);
		lines.push(`**Publicatiedatum:** ${pubDate} (Europe/Amsterdam).`);
	}
	if (firstDisclosure && firstDisclosure !== pubTime) {
		const discDate = formatDutchDateTime(firstDisclosure);
		lines.push(`**Eerste openbare openbaring:** ${discDate}.`);
	}
	if (underlyingEvent && underlyingEvent !== pubTime) {
		const eventDate = formatDutchDate(underlyingEvent);
		lines.push(`**Onderliggend evenement:** ${eventDate}.`);
	}

	// Historical classification context
	if (historicalClassification) {
		const label = getHistoricalLabel(historicalClassification);
		if (label) {
			lines.push(`**Historische context:** ${label}.`);
		}
	}

	// Distinguish new facts from background
	if (
		candidate.temporalEligibility.noveltyClassification.isSubstantiveUpdate
	) {
		lines.push(
			"**Substantiële update:** Dit is een kwalificatieve wijziging ten opzichte van eerdere rapportage.",
		);
	}
	if (
		candidate.temporalEligibility.noveltyClassification.isNewlyRevealedFact
	) {
		lines.push(
			"**Nieuw onthulde feiten:** Deze informatie was eerder niet publiek bekend.",
		);
	}

	// Organizations and products involved
	if (candidate.organizations.length > 0) {
		lines.push(
			`**Betrokken organisaties:** ${candidate.organizations.join(", ")}.`,
		);
	}
	if (candidate.products.length > 0) {
		lines.push(`**Producten/diensten:** ${candidate.products.join(", ")}.`);
	}
	if (candidate.technologies.length > 0) {
		lines.push(`**Technologieën:** ${candidate.technologies.join(", ")}.`);
	}

	return lines;
}

/**
 * Layer B: Why it matters — concrete significance
 */
function generateWhyItMatters(
	candidate: CanonicalCandidate,
	assessment: EditorialCandidateAssessment,
	historicalRelationship: HistoricalRelationship | null,
): string[] {
	const lines: string[] = ["#### Waarom dit belangrijk is", ""];

	// Materiality and evidence strength
	const materiality = assessment.materialityScore;
	const materialityLabel = getMaterialityLabel(materiality);
	lines.push(
		`**Materiële gewicht:** ${materialityLabel} (score: ${materiality.toFixed(2)}).`,
	);
	lines.push("");

	// Dimension assessments that explain significance
	const significanceDims = assessment.dimensions.filter((d) =>
		[
			"real-world-consequences",
			"strategic-economic-significance",
			"scientific-technical-significance",
		].includes(d.dimension),
	);

	for (const dim of significanceDims) {
		if (dim.level !== "low" && dim.evidence.length > 0) {
			const dimLabel = translateDimension(dim.dimension);
			lines.push(`**${dimLabel}:** ${dim.evidence.join(" ")}`);
			lines.push("");
		}
	}

	// Concrete implications per domain
	const domain = candidate.researchDomains[0];
	if (domain) {
		const implications = getDomainImplications(
			domain,
			candidate,
			assessment,
		);
		if (implications) {
			lines.push(implications);
			lines.push("");
		}
	}

	// Historical significance if applicable
	if (
		historicalRelationship &&
		historicalRelationship.classification === "SUBSTANTIVE_UPDATE"
	) {
		lines.push(
			"**Historische betekenis:** Deze update introduceert kwalitatief nieuwe informatie die eerdere conclusies kan wijzigen.",
		);
		lines.push("");
	}

	return lines;
}

/**
 * Layer C: How it works — underlying mechanism
 */
function generateHowItWorks(
	candidate: CanonicalCandidate,
	assessment: EditorialCandidateAssessment,
): string[] {
	const lines: string[] = ["#### Hoe het werkt", ""];

	// Check if we have technical context in claims
	const technicalClaims = candidate.claims.filter((c) => c.technicalContext);
	const methodologicalClaims = candidate.claims.filter(
		(c) => c.methodologicalContext,
	);
	const strategicClaims = candidate.claims.filter((c) => c.strategicContext);

	if (technicalClaims.length > 0) {
		const claim = technicalClaims[0];
		const tech = claim.technicalContext!;

		if (tech.mechanism) {
			lines.push(`**Technisch mechanisme:** ${tech.mechanism}`);
			lines.push("");
		}

		if (tech.capabilities && tech.capabilities.length > 0) {
			lines.push(`**Capaciteiten:** ${tech.capabilities.join(", ")}`);
			lines.push("");
		}

		if (tech.architecture && tech.architecture.length > 0) {
			lines.push(`**Architectuur:** ${tech.architecture.join("; ")}`);
			lines.push("");
		}

		if (tech.limitations && tech.limitations.length > 0) {
			lines.push(
				`**Technische beperkingen:** ${tech.limitations.join("; ")}`,
			);
			lines.push("");
		}

		if (tech.productVersion) {
			lines.push(`**Productversie:** ${tech.productVersion}`);
			lines.push("");
		}

		if (tech.releaseMaturity) {
			lines.push(
				`**Releasematuring:** ${translateMaturity(tech.releaseMaturity)}`,
			);
			lines.push("");
		}

		if (tech.implementationStatus) {
			lines.push(
				`**Implementatiestatus:** ${translateImplementationStatus(tech.implementationStatus)}`,
			);
			lines.push("");
		}
	}

	// Methodological context for research
	if (methodologicalClaims.length > 0) {
		const claim = methodologicalClaims[0];
		const method = claim.methodologicalContext!;

		if (method.studyDesign) {
			lines.push(`**Onderzoeksdesign:** ${method.studyDesign}`);
			lines.push("");
		}
		if (method.methodology) {
			lines.push(`**Methodologie:** ${method.methodology}`);
			lines.push("");
		}
		if (method.dataset) {
			lines.push(`**Dataset:** ${method.dataset}`);
			lines.push("");
		}
		if (method.evaluationConditions) {
			lines.push(
				`**Evaluatiecondities:** ${method.evaluationConditions}`,
			);
			lines.push("");
		}
		if (method.reproducibility) {
			const repro = method.reproducibility;
			if (repro.artifactAvailable) {
				lines.push(
					`**Reproduceerbaarheid:** Artefact beschikbaar${repro.artifactUrl ? ` (${repro.artifactUrl})` : ""}.`,
				);
				if (repro.independentReplications > 0) {
					lines.push(
						`**Onafhankelijke replicaties:** ${repro.independentReplications} (${repro.replicationResults ?? "onbekend"}).`,
					);
				}
				lines.push("");
			}
		}
	}

	// Strategic context for advisory/economic research
	if (strategicClaims.length > 0) {
		const claim = strategicClaims[0];
		const strat = claim.strategicContext!;

		if (strat.researchPurpose) {
			lines.push(`**Onderzoeksdoel:** ${strat.researchPurpose}`);
			lines.push("");
		}
		if (strat.measuredOutcome) {
			lines.push(`**Gemeten uitkomst:** ${strat.measuredOutcome}`);
			lines.push("");
		}
		if (strat.baseline) {
			lines.push(`**Baseline:** ${strat.baseline}`);
			lines.push("");
		}
		if (strat.sampleSize) {
			lines.push(
				`**Steekproefgrootte:** ${strat.sampleSize} (${strat.sampleComposition ?? "samenstelling onbekend"}).`,
			);
			lines.push("");
		}
		if (strat.statisticalUncertainty) {
			lines.push(
				`**Statistische onzekerheid:** ${strat.statisticalUncertainty}`,
			);
			lines.push("");
		}
		if (strat.causalClaimType) {
			lines.push(
				`**Causale claim type:** ${translateCausalType(strat.causalClaimType)}`,
			);
			lines.push("");
		}
		if (strat.generalizability) {
			lines.push(`**Generaliseerbaarheid:** ${strat.generalizability}`);
			lines.push("");
		}
	}

	// If no detailed context available, provide a generic but honest statement
	if (
		technicalClaims.length === 0 &&
		methodologicalClaims.length === 0 &&
		strategicClaims.length === 0
	) {
		lines.push(
			"Gedetailleerde technische of methodologische context is niet beschikbaar in de geverifieerde bronnen.",
		);
		lines.push("");
	}

	return lines;
}

/**
 * Layer D: Limitations and counterevidence
 */
function generateLimitations(
	candidate: CanonicalCandidate,
	assessment: EditorialCandidateAssessment,
): string[] {
	const lines: string[] = ["#### Beperkingen en tegenbewijs", ""];

	let hasContent = false;

	// Evidence classification caveats
	const evidenceClasses = new Set(
		candidate.claims.map((c) => c.evidenceClassification),
	);
	if (evidenceClasses.has("VENDOR_CLAIM")) {
		lines.push(
			"**Vendor-claim:** Een of meer beweringen stammen van de aanbieder zonder onafhankelijke verificatie.",
		);
		lines.push("");
		hasContent = true;
	}
	if (evidenceClasses.has("EXPERT_INTERPRETATION")) {
		lines.push(
			"**Experinterpreatie:** Conclusies zijn gebaseerd op deskundigenanalyse, niet op directe meting of replicatie.",
		);
		lines.push("");
		hasContent = true;
	}
	if (
		evidenceClasses.has("UNVERIFIED") ||
		evidenceClasses.has("SPECULATION") ||
		evidenceClasses.has("INFERENCE")
	) {
		lines.push(
			"**Ongeverifieerde claims:** Sommige beweringen zijn niet onafhankelijk geverifieerd.",
		);
		lines.push("");
		hasContent = true;
	}

	// Verification level
	const maxLevel = getMaxVerificationLevel(
		candidate.claims.map((c) => c.verificationLevel),
	);
	if (maxLevel === "L0") {
		lines.push(
			"**Verificatieniveau:** L0 (alleen bron geciteerd, geen methodologiecheck).",
		);
		lines.push("");
		hasContent = true;
	} else if (maxLevel === "L1") {
		lines.push(
			"**Verificatieniveau:** L1 (methodologie beoordeeld, geen artefactreproductie).",
		);
		lines.push("");
		hasContent = true;
	}

	// Counterevidence
	const claimsWithCounterevidence = candidate.claims.filter(
		(c) => c.contradictoryEvidence.length > 0,
	);
	if (claimsWithCounterevidence.length > 0) {
		lines.push("**Tegenbewijs:**");
		for (const claim of claimsWithCounterevidence) {
			for (const counter of claim.contradictoryEvidence) {
				lines.push(
					`- ${counter.description} (bron: ${counter.sourceId}, vertrouwen: ${counter.confidence.toFixed(2)})`,
				);
			}
		}
		lines.push("");
		hasContent = true;
	}

	// Unresolved uncertainties
	const claimsWithUncertainties = candidate.claims.filter(
		(c) => c.uncertainty.unresolved.length > 0,
	);
	if (claimsWithUncertainties.length > 0) {
		lines.push("**Onopgeloste onzekerheden:**");
		for (const claim of claimsWithUncertainties) {
			for (const unc of claim.uncertainty.unresolved) {
				const blocking = unc.blocking ? " (blokkerend)" : "";
				lines.push(
					`- ${unc.uncertainty}${blocking} — impact: ${unc.impact}`,
				);
			}
		}
		lines.push("");
		hasContent = true;
	}

	// Availability/maturity limitations
	const availabilityClaims = candidate.claims.filter(
		(c) => c.productContext?.availability,
	);
	for (const claim of availabilityClaims) {
		if (
			claim.productContext?.availability &&
			claim.productContext.availability !== "general"
		) {
			lines.push(
				`**Beschikbaarheid:** ${translateAvailability(claim.productContext.availability)}.`,
			);
			if (
				claim.productContext.rolloutRestrictions &&
				claim.productContext.rolloutRestrictions.length > 0
			) {
				lines.push(
					`**Uitrolbeperkingen:** ${claim.productContext.rolloutRestrictions.join("; ")}`,
				);
			}
			lines.push("");
			hasContent = true;
		}
	}

	// Source accessibility limitations
	const limitedSources = candidate.sourceAccessibility.filter(
		(s) => s.limitations.length > 0,
	);
	if (limitedSources.length > 0) {
		lines.push("**Brontoegankelijkheid:**");
		for (const src of limitedSources) {
			for (const lim of src.limitations) {
				lines.push(
					`- ${src.canonicalUrl}: ${lim.description} (${translateAccessSeverity(lim.severity)})`,
				);
			}
		}
		lines.push("");
		hasContent = true;
	}

	if (!hasContent) {
		lines.push(
			"Geen significante beperkingen of tegenbewijs geïdentificeerd in de geverifieerde bronnen.",
		);
		lines.push("");
	}

	return lines;
}

/**
 * Layer E: Technical and strategic depth (for deep-dive stories)
 */
function generateTechnicalDepth(
	candidate: CanonicalCandidate,
	assessment: EditorialCandidateAssessment,
): string[] {
	const lines: string[] = ["#### Technische en strategische diepgang", ""];

	// Deep-dive into technical claims
	const technicalClaims = candidate.claims.filter((c) => c.technicalContext);
	if (technicalClaims.length > 0) {
		lines.push("**Technische architectuur en implementatie:**");
		lines.push("");

		for (const claim of technicalClaims) {
			const tech = claim.technicalContext!;

			if (
				tech.securityAssumptions &&
				tech.securityAssumptions.length > 0
			) {
				lines.push(
					`**Beveiligingsassumpties:** ${tech.securityAssumptions.join("; ")}`,
				);
				lines.push("");
			}
			if (tech.trustBoundaries && tech.trustBoundaries.length > 0) {
				lines.push(
					`**Vertrouwensgrenzen:** ${tech.trustBoundaries.join("; ")}`,
				);
				lines.push("");
			}
			if (
				tech.agenticImplications &&
				tech.agenticImplications.length > 0
			) {
				lines.push(
					`**Implicaties voor agentische systemen:** ${tech.agenticImplications.join("; ")}`,
				);
				lines.push("");
			}
			if (tech.compatibility && tech.compatibility.length > 0) {
				lines.push(
					`**Compatibiliteit:** ${tech.compatibility.join("; ")}`,
				);
				lines.push("");
			}
		}
	}

	// Strategic depth
	const strategicClaims = candidate.claims.filter((c) => c.strategicContext);
	if (strategicClaims.length > 0) {
		lines.push("**Strategische en economische implicaties:**");
		lines.push("");

		for (const claim of strategicClaims) {
			const strat = claim.strategicContext!;

			if (
				strat.enterpriseImplications &&
				strat.enterpriseImplications.length > 0
			) {
				lines.push(
					`**Enterprise-implicaties:** ${strat.enterpriseImplications.join("; ")}`,
				);
				lines.push("");
			}
			if (
				strat.productivityConsequences &&
				strat.productivityConsequences.length > 0
			) {
				lines.push(
					`**Productiviteitsgevolgen:** ${strat.productivityConsequences.join("; ")}`,
				);
				lines.push("");
			}
			if (strat.economicImpact && strat.economicImpact.length > 0) {
				lines.push(
					`**Economische impact:** ${strat.economicImpact.join("; ")}`,
				);
				lines.push("");
			}
			if (
				strat.workforceImplications &&
				strat.workforceImplications.length > 0
			) {
				lines.push(
					`**Werknemersimplicaties:** ${strat.workforceImplications.join("; ")}`,
				);
				lines.push("");
			}
			if (
				strat.governanceImplications &&
				strat.governanceImplications.length > 0
			) {
				lines.push(
					`**Governance-implicaties:** ${strat.governanceImplications.join("; ")}`,
				);
				lines.push("");
			}
			if (
				strat.competingExplanations &&
				strat.competingExplanations.length > 0
			) {
				lines.push(
					`**Concurrerende verklaringen:** ${strat.competingExplanations.join("; ")}`,
				);
				lines.push("");
			}
		}
	}

	// Benchmark details if present
	const benchmarkClaims = candidate.claims.filter(
		(c) => c.methodologicalContext?.benchmarkConditions,
	);
	if (benchmarkClaims.length > 0) {
		lines.push("**Benchmarkdetails:**");
		lines.push("");
		for (const claim of benchmarkClaims) {
			const bench = claim.methodologicalContext!.benchmarkConditions!;
			const details: string[] = [];
			if (bench.warmupRuns) details.push("warm-up runs uitgevoerd");
			if (bench.batchSize) details.push(`batch size: ${bench.batchSize}`);
			if (bench.precision) details.push(`precisie: ${bench.precision}`);
			if (bench.hardwareSpecified)
				details.push("hardware gespecificeerd");
			if (bench.confoundersAddressed.length > 0)
				details.push(
					`confounders: ${bench.confoundersAddressed.join(", ")}`,
				);
			if (details.length > 0) {
				lines.push(`- ${details.join("; ")}`);
			}
		}
		lines.push("");
	}

	return lines;
}

/**
 * Layer F: Original sources
 */
function generateSources(
	candidate: CanonicalCandidate,
	assessment: EditorialCandidateAssessment,
): string[] {
	const lines: string[] = ["#### Bronnen", ""];

	// Primary source URLs
	const sourceUrls = candidate.sources.map((s) => s.canonicalUrl);
	const uniqueUrls = [...new Set(sourceUrls)];
	for (const url of uniqueUrls) {
		lines.push(`- ${url}`);
	}
	lines.push("");

	// Claim-level source references
	const claimSourceUrls = new Set<string>();
	for (const claim of candidate.claims) {
		for (const url of claim.supportingEvidenceUrls) {
			claimSourceUrls.add(url);
		}
	}
	if (claimSourceUrls.size > 0) {
		lines.push("**Claim-specifieke bronnen:**");
		for (const url of claimSourceUrls) {
			if (!uniqueUrls.includes(url)) {
				lines.push(`- ${url}`);
			}
		}
		lines.push("");
	}

	// Claim IDs for traceability
	lines.push(
		`**Claim-identificaties:** ${candidate.claims.map((c) => c.claimId).join(", ")}`,
	);

	return lines;
}

/**
 * Load and prepare newsletter generation input from upstream artifacts
 */
export async function loadNewsletterGenerationInput(
	editionDate: string,
	dataDir: string = "data",
): Promise<NewsletterGenerationInput> {
	const { readFileSync } = await import("fs");
	const { join } = await import("path");

	// Load fact dossier
	const dossierPath = join(
		dataDir,
		"fact-dossiers",
		`edition_${editionDate}.json`,
	);
	const factDossier: CanonicalFactDossier = JSON.parse(
		readFileSync(dossierPath, "utf-8"),
	);

	// Load editorial selection manifest (latest)
	const editorialDir = join(dataDir, "editorial-selection");

	// Use dynamic import for fs promises
	const { readdir, readFile } = await import("fs/promises");
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
		editionDate: factDossier.editionDate,
		start: factDossier.editionWindow.start,
		end: factDossier.editionWindow.end,
		timezone: factDossier.editionWindow.timezone,
		durationHours: factDossier.editionWindow.durationHours || 24,
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
): NewsletterStoryContext[] {
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

// ============================================================================
// Helper functions for formatting and translation
// ============================================================================

function formatDutchDate(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString("nl-NL", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

function parseTemporalTimestamp(isoStr: string): Date {
	// Remove timezone in brackets like [Europe/Amsterdam] which JS Date can't parse
	const cleaned = isoStr.replace(/\[.*?\]$/, "");
	return new Date(cleaned);
}

function formatDutchDateTime(isoStr: string): string {
	const date = parseTemporalTimestamp(isoStr);
	if (isNaN(date.getTime())) {
		return "Onbekende datum";
	}
	return date.toLocaleString("nl-NL", {
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "Europe/Amsterdam",
		hour12: false,
	});
}

export function formatWindow(window: {
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

function translateDomain(domain: string): string {
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

function translateDepth(depth: "brief" | "standard" | "deep-dive"): string {
	const translations: Record<string, string> = {
		brief: "kort",
		standard: "standaard",
		"deep-dive": "diepgang",
	};
	return translations[depth] ?? depth;
}

function translateMaturity(maturity: string): string {
	const translations: Record<string, string> = {
		ga: "Algemeen Beschikbaar (GA)",
		preview: "Preview",
		experimental: "Experimenteel",
		deprecated: "Afgeschreven",
		unknown: "Onbekend",
	};
	return translations[maturity] ?? maturity;
}

function translateImplementationStatus(status: string): string {
	const translations: Record<string, string> = {
		released: "Uitgebracht",
		preview: "Preview",
		announced: "Aangekondigd",
		research: "Onderzoek",
		unknown: "Onbekend",
	};
	return translations[status] ?? status;
}

function translateAvailability(availability: string): string {
	const translations: Record<string, string> = {
		general: "Algemeen beschikbaar",
		limited: "Beperkt beschikbaar",
		waitlist: "Wachtlijst",
		internal: "Intern",
		unknown: "Onbekend",
	};
	return translations[availability] ?? availability;
}

function translateAccessSeverity(severity: string): string {
	const translations: Record<string, string> = {
		"blocks-all": "Blokkeert alle toegang",
		"blocks-partial": "Blokkeert gedeeltelijke toegang",
		"degrades-quality": "Vermindert kwaliteit",
		informational: "Informatief",
	};
	return translations[severity] ?? severity;
}

function translateCausalType(type: string): string {
	const translations: Record<string, string> = {
		correlation: "Correlatie",
		causation: "Causaliteit",
		prediction: "Voorspelling",
		interpretation: "Interpretatie",
	};
	return translations[type] ?? type;
}

function translateDimension(dimension: string): string {
	const translations: Record<string, string> = {
		"material-novelty": "Materiële nieuwheid",
		"scientific-technical-significance":
			"Wetenschappelijke/technische significantie",
		"real-world-consequences": "Real-world gevolgen",
		"strategic-economic-significance":
			"Strategische/economische significantie",
		"evidence-strength": "Bewijskracht",
		"generalizability-learning-value": "Generaliseerbaarheid/leerwaarde",
		"engineering-architectural-relevance":
			"Engineering/architectuur relevantie",
		"availability-maturity": "Beschikbaarheid/volwassenheid",
	};
	return translations[dimension] ?? dimension;
}

function getHistoricalLabel(
	classification: HistoricalRelationshipClassification,
): string {
	const labels: Record<HistoricalRelationshipClassification, string> = {
		NEW_DEVELOPMENT: "Nieuwe ontwikkeling, niet eerder gedekt",
		PREVIOUSLY_COVERED: "Eerder gedekt in eerdere editie",
		SUBSTANTIVE_UPDATE:
			"Substantiële update ten opzichte van eerdere dekking",
		REPEATED_REPORTING:
			"Herhaling van reeds bekende informatie zonder kwalificatieve wijziging",
		RELATED_CONTEXT: "Gerelateerde contextuele informatie",
		POTENTIAL_HISTORICAL_OMISSION:
			"Potentiële historische omissie geïdentificeerd",
		HISTORY_UNVERIFIED: "Historische dekking niet verifieerbaar",
	};
	return labels[classification] ?? classification;
}

function getMaterialityLabel(score: number): string {
	if (score >= 0.75) return "Zeer hoog";
	if (score >= 0.6) return "Hoog";
	if (score >= 0.45) return "Matig";
	if (score >= 0.3) return "Laag";
	return "Onvoldoende";
}

function getMaxVerificationLevel(
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

function getDomainImplications(
	domain: string,
	candidate: CanonicalCandidate,
	assessment: EditorialCandidateAssessment,
): string | null {
	const implications: Record<string, string[]> = {
		"agentic-ai-software-engineering": [
			"Beïnvloedt hoe autonome agents worden gebouwd, georchestreerd en beveiligd.",
			"Relevant voor ontwikkelaars die agentische workflows implementeren.",
		],
		"models-inference-scientific": [
			"Wijzigt de capaciteiten, kosten of beschikbaarheid van foundation models.",
			"Heeft gevolgen voor inferentie-architecturen en modelkeuzes.",
		],
		"architecture-security-governance": [
			"Beïnvloedt beveiligingsarchitectuur, governance-kaders en compliance.",
			"Relevant voor architecten die AI-systemen veilig en auditabel moeten maken.",
		],
		"enterprise-adoption-organizational": [
			"Geeft inzicht in adoptiebarrières, productiviteitseffecten en organisatieverandering.",
			"Belangrijk voor leiders die AI-transformatie sturen.",
		],
		"economics-business-impact": [
			"Beïnvloedt investeringsbeslissingen, TCO-modellen en concurrentiepositie.",
			"Relevant voor financiële en strategische planning.",
		],
		"independent-research-advisory": [
			"Biedt methodologisch gerobuste inzichten voor besluitvorming.",
			"Helpt bij het onderscheiden van bewijs van hype.",
		],
	};

	const domainImplications = implications[domain];
	if (domainImplications && domainImplications.length > 0) {
		return `**Domeinspecifieke implicaties:** ${domainImplications.join(" ")}`;
	}
	return null;
}

/**
 * Validation function for newsletter generation output
 */
export function validateNewsletterOutput(
	markdown: string,
	input: NewsletterGenerationInput,
): {
	valid: boolean;
	errors: string[];
	warnings: string[];
} {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check required sections
	if (!markdown.startsWith("# AI Intelligence —")) {
		errors.push("Missing or incorrect title");
	}

	if (!markdown.includes("## Inleiding")) {
		errors.push("Missing introduction section");
	}

	if (!markdown.includes("## Verhalen")) {
		errors.push("Missing stories section");
	}

	if (!markdown.includes("## Navigatie")) {
		errors.push("Missing navigation section");
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

	// Check heading hierarchy (no skipped levels)
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

	// Check for placeholder template variables
	if (markdown.includes("${editionDate}")) {
		errors.push("Template variable ${editionDate} not replaced");
	}

	// Check source references
	if (!markdown.includes("http")) {
		warnings.push("No source URLs found in output");
	}

	// Check evidence classifications are preserved
	const classificationKeywords = [
		"VERIFIED_FACT",
		"VENDOR_CLAIM",
		"RESEARCH_FINDING",
		"EXPERT_INTERPRETATION",
		"ORIGINAL_REPORTING",
	];
	const sufficiencyKeywords = ["STRONG", "ADEQUATE", "WEAK"];
	const temporalKeywords = [
		"NEW_PASS",
		"NEW_FAIL",
		"TIME_UNVERIFIED",
		"CATCH_UP",
	];
	const hasClassification = classificationKeywords.some((k) =>
		markdown.includes(k),
	);
	const hasSufficiency = sufficiencyKeywords.some((k) =>
		markdown.includes(k),
	);
	const hasTemporal = temporalKeywords.some((k) => markdown.includes(k));
	if (!hasClassification && !hasSufficiency && !hasTemporal) {
		warnings.push(
			"No evidence classification, sufficiency, or temporal eligibility keywords found",
		);
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
	};
}
