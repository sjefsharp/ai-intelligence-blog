/**
 * Book Delta — Research Audit Renderer
 *
 * Derives the Book Delta section of `research-audit.md` deterministically from
 * the persisted evaluation result. A missing or non-executed assessment is
 * always reported as such — never as a NONE outcome.
 */

import type { BookDeltaEvaluationResult } from "./schema.js";

/**
 * Render the "## Kennisregister Wijzigingen & Book Delta Voorstellen" section.
 *
 * @param editionDate Edition being reported.
 * @param evaluation Persisted evaluation result, when the assessment ran.
 */
export function renderBookDeltaAuditSection(
	editionDate: string,
	evaluation: BookDeltaEvaluationResult | null | undefined,
): string[] {
	const lines: string[] = [
		"## Kennisregister Wijzigingen & Book Delta Voorstellen",
		"",
	];

	if (!evaluation || !evaluation.evaluationPerformed) {
		lines.push(
			"- **Book Delta evaluatie:** NIET UITGEVOERD voor deze build.",
			"- **Status:** Geen evaluatieresultaat beschikbaar — dit is expliciet **geen** NONE-resultaat.",
			"- **Persistenceresultaat:** n.v.t. (evaluatie niet uitgevoerd).",
			`- **Vereiste review:** Book Delta-evaluatie uitvoeren en resultaat persistent opslaan voor ${editionDate}.`,
			"",
		);
		return lines;
	}

	const isNoneOutcome =
		evaluation.newProposals.length === 0 &&
		evaluation.noChangeDecisions > 0;

	lines.push(
		"- **Book Delta evaluatie:** UITGEVOERD.",
		`- **Bewijs beschouwd:** fact dossier=${evaluation.factDossierConsidered ? "ja" : "nee"}, thesaurus=${evaluation.thesaurusConsulted ? "ja" : "nee"}, architectuurprincipes=${evaluation.architecturePrinciplesConsulted ? "ja" : "nee"}, historische voorstellen=${evaluation.historicalProposalsInspected ? "ja" : "nee"}, doeldocumenten=${evaluation.targetDocumentsInspected ? "ja" : "nee"}.`,
		`- **Nieuwe voorstellen:** ${evaluation.newProposals.length}${evaluation.newProposals.length > 0 ? ` (${evaluation.newProposals.join(", ")})` : ""}.`,
		`- **Bijgewerkte historische voorstellen:** ${evaluation.updatedHistoricalProposals.length}${evaluation.updatedHistoricalProposals.length > 0 ? ` (${evaluation.updatedHistoricalProposals.join(", ")})` : ""}.`,
		`- **Gedetecteerde duplicaten:** ${evaluation.duplicateProposalsIdentified.length}${evaluation.duplicateProposalsIdentified.length > 0 ? ` (${evaluation.duplicateProposalsIdentified.join(", ")})` : ""}.`,
		`- **Beslissing zonder wijziging (NONE):** ${evaluation.noChangeDecisions}.`,
	);

	if (isNoneOutcome) {
		lines.push(
			"- **Uitslag:** NONE — geen actionable educatieve verbetering ondersteund door bewijs in deze editie.",
			"",
		);
	} else {
		lines.push("");
	}

	lines.push(
		`- **Onopgeloste bewijslacunes:** ${evaluation.unresolvedEvidenceGaps.length}${evaluation.unresolvedEvidenceGaps.length > 0 ? ` (${evaluation.unresolvedEvidenceGaps.slice(0, 5).join("; ")})` : ""}.`,
		`- **Doeldocument-toegangsbeperkingen:** ${evaluation.targetDocumentAccessLimitations.length}${evaluation.targetDocumentAccessLimitations.length > 0 ? ` (${evaluation.targetDocumentAccessLimitations.slice(0, 3).join("; ")})` : ""}.`,
		`- **Reviewvereisten:** ${evaluation.reviewRequirements.length} acceptatiecriterium(s) openstaand.`,
		`- **Persistentie:** ${evaluation.persistenceSucceeded ? "geslaagd" : "MISLUKT"}; **readback:** ${evaluation.readbackSucceeded ? "geslaagd" : "MISLUKT"}.`,
		`- **Inferentie gebruikt:** ${evaluation.inferenceUsed ? "ja" : "nee"}${evaluation.inferenceNote ? ` — ${evaluation.inferenceNote}` : ""}.`,
		"",
	);

	return lines;
}
