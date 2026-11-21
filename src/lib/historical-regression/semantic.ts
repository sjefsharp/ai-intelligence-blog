/**
 * Historical Regression — Optional Semantic Comparison
 *
 * Model reasoning is used ONLY where deterministic evidence is insufficient to
 * distinguish a meaningful update from repetition (for example, a token-similarity
 * match with no shared identifier, URL or entity). The provider is injectable so
 * tests can supply deterministic fakes.
 *
 * Hard rules:
 * - Free inference only, through the existing `FreeLLMClient`
 *   (NVIDIA Nemotron via OpenRouter primary).
 * - If inference capacity is unavailable, the caller preserves deterministic
 *   findings and marks the unresolved comparison HISTORY_UNVERIFIED.
 * - A semantic verdict never overrides the existing novelty classifier; it only
 *   informs the historical relationship classification.
 * - Semantic output is always recorded as model-assisted and traceable.
 */

import { createFreeLLMClient, type FreeLLMClient } from "../free-llm-client.js";
import type { HistoricalMatchType } from "./schema.js";

export interface SemanticComparisonInput {
	current: {
		candidateId: string;
		headline: string;
		statement: string;
		claims: string[];
		organizations: string[];
		products: string[];
		technologies: string[];
		sourceUrls: string[];
		publicationTimestamp?: string;
	};
	previous: {
		editionDate: string;
		candidateId: string;
		headline: string;
		statement: string;
		claims: string[];
		organizations: string[];
		products: string[];
		technologies: string[];
		sourceUrls: string[];
		publicationTimestamp?: string;
	};
	/** Deterministic signal that caused the escalation. */
	deterministicMatchType: HistoricalMatchType;
}

export interface SemanticComparisonOutcome {
	relationship:
		| "same-development"
		| "substantive-update"
		| "distinct-development"
		| "repeated-reporting"
		| "insufficient-evidence";
	confidence: number;
	changedFacts: string[];
	rationale: string;
	provider?: string;
	model?: string;
}

/** Injectable provider so tests can supply deterministic fakes. */
export interface SemanticComparisonProvider {
	compare(input: SemanticComparisonInput): Promise<SemanticComparisonOutcome>;
}

function buildPrompt(input: SemanticComparisonInput): string {
	return [
		"You are an evidence-first historical regression analyst for an AI intelligence publication.",
		"Determine the relationship between a CURRENT candidate and a PREVIOUS edition candidate.",
		"",
		"Definitions:",
		"- same-development: the same material development; no qualifying factual change.",
		"- substantive-update: newly disclosed information materially changes or extends the previous development.",
		"- distinct-development: a materially new development with no established equivalent.",
		"- repeated-reporting: a new publication repeats substantially established information without a qualifying change.",
		"- insufficient-evidence: the supplied evidence cannot support a reliable decision.",
		"",
		"Do NOT treat similar headlines, vendors or research topics as identical developments.",
		"Do NOT treat superficial wording changes, repeated predictions or republished conclusions as substantive updates.",
		"Qualifying changes include: general availability of a previously announced feature, new benchmark results with",
		"identifiable experimental changes, independent replication contradicting earlier claims, new security evidence,",
		"material changes to model behaviour/licensing/pricing/availability, newly disclosed technical limitations,",
		"original reporting revealing previously undisclosed facts, follow-up research findings, revised strategic",
		"research with new empirical data, and new measured enterprise outcomes.",
		"",
		`CURRENT: ${JSON.stringify(input.current, null, 2)}`,
		`PREVIOUS (${input.previous.editionDate}): ${JSON.stringify(input.previous, null, 2)}`,
		`Deterministic match signal: ${input.deterministicMatchType}`,
		"",
		'Respond with JSON only: {"relationship": "...", "confidence": 0.0, "changedFacts": ["..."], "rationale": "..."}',
	].join("\n");
}

function parseResponse(
	content: string,
	provider: string,
	model: string,
): SemanticComparisonOutcome {
	const jsonMatch = content.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		return {
			relationship: "insufficient-evidence",
			confidence: 0,
			changedFacts: [],
			rationale:
				"Model returned no parseable JSON; treated as insufficient evidence.",
			provider,
			model,
		};
	}
	try {
		const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
		const relationship = parsed.relationship;
		const valid: SemanticComparisonOutcome["relationship"][] = [
			"same-development",
			"substantive-update",
			"distinct-development",
			"repeated-reporting",
			"insufficient-evidence",
		];
		const confidence =
			typeof parsed.confidence === "number" &&
			parsed.confidence >= 0 &&
			parsed.confidence <= 1
				? parsed.confidence
				: 0;
		const changedFacts = Array.isArray(parsed.changedFacts)
			? parsed.changedFacts.filter(
					(fact): fact is string => typeof fact === "string",
				)
			: [];
		const rationale =
			typeof parsed.rationale === "string" ? parsed.rationale : "";
		return {
			relationship: valid.includes(
				relationship as SemanticComparisonOutcome["relationship"],
			)
				? (relationship as SemanticComparisonOutcome["relationship"])
				: "insufficient-evidence",
			confidence,
			changedFacts,
			rationale,
			provider,
			model,
		};
	} catch {
		return {
			relationship: "insufficient-evidence",
			confidence: 0,
			changedFacts: [],
			rationale:
				"Model response could not be parsed; treated as insufficient evidence.",
			provider,
			model,
		};
	}
}

/**
 * Create a semantic comparison provider backed by the configured free inference
 * providers. Uses the existing FreeLLMClient with its free-only budget,
 * temperature 0 and a fixed seed for deterministic structured output.
 */
export function createFreeLlmSemanticComparisonProvider(
	client?: FreeLLMClient,
): SemanticComparisonProvider {
	const llm =
		client ??
		createFreeLLMClient({ enableCache: true, enableCheckpoints: false });
	return {
		async compare(
			input: SemanticComparisonInput,
		): Promise<SemanticComparisonOutcome> {
			const response = await llm.request(
				[
					{
						role: "system",
						content:
							"You are an evidence-first historical regression analyst. Never invent facts. Base every decision only on the supplied evidence.",
					},
					{ role: "user", content: buildPrompt(input) },
				],
				{ temperature: 0, seed: 42, maxTokens: 768 },
			);
			return parseResponse(
				response.content,
				response.provider,
				response.model,
			);
		},
	};
}
