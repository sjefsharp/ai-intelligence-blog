/**
 * Novelty Classification — Publication-date-first classification for editorial items.
 *
 * Classification logic (per editorial contract):
 * - NEW: Material information first publicly disclosed inside the exact news window
 * - CATCH_UP: Explicitly dated older material with traceable evidence
 * - TIME_UNVERIFIED: Publication time cannot be verified with traceable evidence
 *
 * Key principles:
 * - Publication date is primary, not event date
 * - Newly revealed facts about older events may qualify as NEW
 * - Substantive updates to existing information may qualify as NEW
 * - Reposts and new summaries of established information do NOT qualify
 * - All classifications require traceable evidence
 */

import { Temporal } from "@js-temporal/polyfill";
import {
	getEditorialWindow,
	isInEditorialWindow,
	getEditionForTimestamp,
} from "./editorial-window";

/** Classification categories for editorial novelty */
export type NoveltyClassification = "NEW" | "CATCH_UP" | "TIME_UNVERIFIED";

/** Evidence supporting a classification decision */
export interface ClassificationEvidence {
	/** Type of evidence */
	type:
		| "source_publication_date"
		| "source_modification_date"
		| "archive_snapshot"
		| "author_statement"
		| "version_history";
	/** URL or reference to the evidence */
	reference: string;
	/** Timestamp of the evidence (ISO 8601 with timezone) */
	timestamp: string;
	/** Human-readable description */
	description: string;
	/** Confidence in this evidence (0-1) */
	confidence: number;
}

/** Result of novelty classification */
export interface NoveltyClassificationResult {
	/** The classification */
	classification: NoveltyClassification;
	/** Edition date this item belongs to (YYYY-MM-DD) */
	editionDate: string;
	/** Whether the item falls within the editorial window for the edition */
	inWindow: boolean;
	/** Evidence supporting the classification */
	evidence: ClassificationEvidence[];
	/** Reasoning for the classification decision */
	reasoning: string;
	/** Primary publication timestamp used for classification (ISO 8601) */
	primaryPublicationTimestamp: string;
	/** Whether this is a substantive update to existing information */
	isSubstantiveUpdate: boolean;
	/** Whether this reveals newly discovered facts about older events */
	isNewlyRevealedFact: boolean;
	/**
	 * Whether the item is a repost/summary of established information.
	 * Exposed so downstream stages (canonical fact dossier) can derive a
	 * NEW_PASS / NEW_FAIL eligibility gate without re-implementing the
	 * publication-date-first classification. Optional for backward
	 * compatibility with older persisted results.
	 */
	isRepostOrSummary?: boolean;
	/** Confidence in the classification (0-1) */
	confidence: number;
}

/** Input for novelty classification */
export interface NoveltyClassificationInput {
	/** Candidate item title */
	title: string;
	/** Candidate item summary */
	summary: string;
	/** Proposed publication timestamp (when the information was first publicly disclosed) */
	proposedPublicationTimestamp: string;
	/** Source URL(s) */
	sourceUrls: string[];
	/** Source tier (1-3) */
	sourceTier: 1 | 2 | 3;
	/** Whether this is a known update to previously published information */
	isKnownUpdate?: boolean;
	/** Description of what makes this an update (if applicable) */
	updateDescription?: string;
	/** Whether this reveals newly discovered facts about older events */
	newlyRevealedFacts?: string[];
	/** Edition date to classify against (optional, defaults to edition for timestamp) */
	editionDate?: string;
	/** Additional evidence */
	additionalEvidence?: ClassificationEvidence[];
}

/**
 * Classify the novelty of an editorial item based on publication date.
 *
 * @param input - Item to classify
 * @returns Classification result with evidence and reasoning
 */
export function classifyNovelty(
	input: NoveltyClassificationInput,
): NoveltyClassificationResult {
	const {
		proposedPublicationTimestamp,
		sourceUrls,
		sourceTier,
		isKnownUpdate = false,
		updateDescription,
		newlyRevealedFacts = [],
		editionDate,
		additionalEvidence = [],
	} = input;

	// Determine edition date
	let targetEditionDate: string;
	try {
		targetEditionDate =
			editionDate ||
			getEditionForTimestamp(proposedPublicationTimestamp) ||
			"";
	} catch {
		// Invalid timestamp format
		return {
			classification: "TIME_UNVERIFIED",
			editionDate: "",
			inWindow: false,
			evidence: [
				{
					type: "source_publication_date",
					reference: proposedPublicationTimestamp,
					timestamp: proposedPublicationTimestamp,
					description:
						"Could not parse proposed publication timestamp",
					confidence: 0,
				},
			],
			reasoning: "Unable to parse proposed publication timestamp",
			primaryPublicationTimestamp: proposedPublicationTimestamp,
			isSubstantiveUpdate: false,
			isNewlyRevealedFact: false,
			confidence: 0,
		};
	}

	if (!targetEditionDate) {
		return {
			classification: "TIME_UNVERIFIED",
			editionDate: "",
			inWindow: false,
			evidence: [
				{
					type: "source_publication_date",
					reference: proposedPublicationTimestamp,
					timestamp: proposedPublicationTimestamp,
					description:
						"Could not determine edition date for proposed publication timestamp",
					confidence: 0,
				},
			],
			reasoning:
				"Unable to determine edition date from proposed publication timestamp",
			primaryPublicationTimestamp: proposedPublicationTimestamp,
			isSubstantiveUpdate: false,
			isNewlyRevealedFact: false,
			confidence: 0,
		};
	}

	// Get the editorial window for this edition
	const window = getEditorialWindow(targetEditionDate);
	const inWindow = isInEditorialWindow(
		proposedPublicationTimestamp,
		targetEditionDate,
	);

	// Build base evidence
	const evidence: ClassificationEvidence[] = [
		{
			type: "source_publication_date",
			reference: sourceUrls[0] || "unknown",
			timestamp: proposedPublicationTimestamp,
			description: `Primary publication timestamp: ${proposedPublicationTimestamp}`,
			confidence: sourceTier === 1 ? 0.95 : sourceTier === 2 ? 0.85 : 0.7,
		},
		...additionalEvidence,
	];

	// Check for substantive update
	const isSubstantiveUpdate =
		isKnownUpdate && Boolean(updateDescription?.trim());
	if (isSubstantiveUpdate) {
		evidence.push({
			type: "version_history",
			reference: sourceUrls[0] || "unknown",
			timestamp: proposedPublicationTimestamp,
			description: `Substantive update: ${updateDescription}`,
			confidence: 0.8,
		});
	}

	// Check for newly revealed facts
	const isNewlyRevealedFact = newlyRevealedFacts.length > 0;
	if (isNewlyRevealedFact) {
		evidence.push({
			type: "source_publication_date",
			reference: sourceUrls[0] || "unknown",
			timestamp: proposedPublicationTimestamp,
			description: `Newly revealed facts about older events: ${newlyRevealedFacts.join("; ")}`,
			confidence: 0.75,
		});
	}

	// Repost/summary detection is exposed so downstream stages can derive a
	// NEW_PASS / NEW_FAIL eligibility gate without re-deciding novelty.
	const repostOrSummary = isRepostOrSummary(input);

	// Determine classification
	let classification: NoveltyClassification;
	let reasoning: string;
	let confidence: number;

	if (!inWindow) {
		// Outside editorial window - check if it's explicitly dated older material
		if (isExplicitlyDatedOlderMaterial(input, targetEditionDate)) {
			classification = "CATCH_UP";
			reasoning = `Publication timestamp ${proposedPublicationTimestamp} falls outside editorial window for edition ${targetEditionDate} (${window.start} → ${window.end}). Classified as CATCH_UP because the material is explicitly dated and has traceable evidence.`;
			confidence = 0.85;
		} else {
			classification = "TIME_UNVERIFIED";
			reasoning = `Publication timestamp ${proposedPublicationTimestamp} falls outside editorial window for edition ${targetEditionDate} (${window.start} → ${window.end}) and cannot be verified as explicitly dated older material.`;
			confidence = 0.6;
		}
	} else {
		// Inside editorial window
		if (repostOrSummary) {
			classification = "TIME_UNVERIFIED";
			reasoning = `Publication timestamp ${proposedPublicationTimestamp} is within editorial window for edition ${targetEditionDate}, but content appears to be a repost or summary of established information without new material disclosure.`;
			confidence = 0.7;
		} else if (isSubstantiveUpdate || isNewlyRevealedFact) {
			classification = "NEW";
			reasoning = `Publication timestamp ${proposedPublicationTimestamp} is within editorial window for edition ${targetEditionDate}. Classified as NEW because it contains ${isSubstantiveUpdate ? "substantive updates" : ""}${isSubstantiveUpdate && isNewlyRevealedFact ? " and " : ""}${isNewlyRevealedFact ? "newly revealed facts about older events" : ""} first publicly disclosed in this window.`;
			confidence = 0.9;
		} else {
			classification = "NEW";
			reasoning = `Publication timestamp ${proposedPublicationTimestamp} is within editorial window for edition ${targetEditionDate}. Classified as NEW as material information first publicly disclosed in this window.`;
			confidence = 0.85;
		}
	}
	// Adjust confidence based on source tier
	const tierConfidenceFactor =
		sourceTier === 1 ? 1.0 : sourceTier === 2 ? 0.9 : 0.8;
	confidence = Math.min(1.0, confidence * tierConfidenceFactor);

	return {
		classification,
		editionDate: targetEditionDate,
		inWindow,
		evidence,
		reasoning,
		primaryPublicationTimestamp: proposedPublicationTimestamp,
		isSubstantiveUpdate,
		isNewlyRevealedFact,
		isRepostOrSummary: repostOrSummary,
		confidence,
	};
}

/**
 * Check if the item represents a repost or summary of established information.
 * Exported so the canonical fact dossier can derive its NEW_PASS / NEW_FAIL
 * eligibility gate from the same logic used by `classifyNovelty`.
 */
export function isRepostOrSummary(input: NoveltyClassificationInput): boolean {
	const {
		title,
		summary,
		isKnownUpdate,
		updateDescription,
		newlyRevealedFacts = [],
	} = input;

	// If it's a known update with substantive description, it's not a repost
	if (isKnownUpdate && updateDescription?.trim()) {
		return false;
	}

	// If it has newly revealed facts, it's not a repost
	if (newlyRevealedFacts.length > 0) {
		return false;
	}

	// Heuristic: check for repost/summary indicators in title/summary
	// Use word boundary regex to avoid false positives
	const repostIndicators = [
		"recap",
		"roundup",
		"round-up",
		"previously",
		"earlier this year",
		"as reported",
		"according to",
		"repost",
		"revisiting",
		"round up",
	];

	const text = `${title} ${summary}`.toLowerCase();
	// Check for whole word matches or phrase matches
	return repostIndicators.some((indicator) => {
		// For single words, use word boundary; for phrases, use direct inclusion
		if (indicator.includes(" ")) {
			return text.includes(indicator);
		}
		return new RegExp(`\\b${indicator}\\b`).test(text);
	});
}

/**
 * Check if the item is explicitly dated older material with traceable evidence.
 */
function isExplicitlyDatedOlderMaterial(
	input: NoveltyClassificationInput,
	editionDate: string,
): boolean {
	const {
		proposedPublicationTimestamp,
		sourceTier,
		additionalEvidence = [],
	} = input;

	// Must have at least Tier 2 source for older material (Tier 1 is highest trust)
	if (sourceTier < 1 || sourceTier > 3) {
		return false;
	}
	if (sourceTier === 3) {
		return false;
	}

	// Must have additional evidence supporting the date
	const hasDateEvidence = additionalEvidence.some(
		(e) =>
			e.type === "source_publication_date" ||
			e.type === "archive_snapshot",
	);

	if (!hasDateEvidence) {
		return false;
	}

	// The publication timestamp should be significantly before the window
	const window = getEditorialWindow(editionDate);
	const proposedInstant = Temporal.Instant.from(proposedPublicationTimestamp);
	const windowStartInstant = window.startZoned.toInstant();

	const daysDifference = Math.floor(
		proposedInstant.until(windowStartInstant).total({ unit: "day" }),
	);

	// At least 7 days before window start to be "older material"
	return daysDifference >= 7;
}

/**
 * Batch classify multiple items.
 */
export function classifyNoveltyBatch(
	input:
		| {
				editionDate: string;
				editionContext?: Record<string, unknown>;
				cliOptions?: Record<string, unknown>;
				llmClient?: unknown;
				"consolidated-discovery"?: NoveltyClassificationInput[];
				items?: NoveltyClassificationInput[];
		  }
		| NoveltyClassificationInput[],
): NoveltyClassificationResult[] {
	// Handle both array input (direct) and object input (from workflow engine)
	const items = Array.isArray(input)
		? input
		: input["consolidated-discovery"] || input.items || [];
	return items.map(classifyNovelty);
}

/**
 * Get classification statistics for a batch.
 */
export function getClassificationStats(
	results: NoveltyClassificationResult[],
): {
	total: number;
	new: number;
	catchUp: number;
	timeUnverified: number;
	averageConfidence: number;
} {
	const stats = {
		total: results.length,
		new: 0,
		catchUp: 0,
		timeUnverified: 0,
		averageConfidence: 0,
	};

	let confidenceSum = 0;
	for (const result of results) {
		confidenceSum += result.confidence;
		switch (result.classification) {
			case "NEW":
				stats.new++;
				break;
			case "CATCH_UP":
				stats.catchUp++;
				break;
			case "TIME_UNVERIFIED":
				stats.timeUnverified++;
				break;
		}
	}

	stats.averageConfidence = stats.total > 0 ? confidenceSum / stats.total : 0;
	return stats;
}

/**
 * Format classification result for display.
 */
export function formatClassification(
	result: NoveltyClassificationResult,
): string {
	const lines = [
		`Classification: ${result.classification}`,
		`Edition: ${result.editionDate}`,
		`In Window: ${result.inWindow ? "Yes" : "No"}`,
		`Confidence: ${(result.confidence * 100).toFixed(1)}%`,
		`Primary Timestamp: ${result.primaryPublicationTimestamp}`,
		`Substantive Update: ${result.isSubstantiveUpdate ? "Yes" : "No"}`,
		`Newly Revealed Fact: ${result.isNewlyRevealedFact ? "Yes" : "No"}`,
		`Reasoning: ${result.reasoning}`,
		"",
		"Evidence:",
	];

	for (const ev of result.evidence) {
		lines.push(
			`  - [${ev.type}] ${ev.description} (confidence: ${(ev.confidence * 100).toFixed(0)}%)`,
		);
		lines.push(`    Reference: ${ev.reference}`);
		lines.push(`    Timestamp: ${ev.timestamp}`);
	}

	return lines.join("\n");
}
