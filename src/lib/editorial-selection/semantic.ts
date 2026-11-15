/**
 * Editorial Selection — Optional Model-Assisted Review
 *
 * Model reasoning is used ONLY for materiality assessment, interdisciplinary
 * interpretation, editorial trade-offs and adversarial review. It never
 * overrides deterministic eligibility, never re-decides novelty and never
 * re-verifies claims.
 *
 * Hard rules:
 * - Free inference only, through the existing `FreeLLMClient`
 *   (NVIDIA Nemotron via OpenRouter primary, Nous Portal Free Tier fallback).
 * - Deterministic findings are always preserved; model output is appended as an
 *   internal consistency check, not independent external validation.
 * - If inference capacity is unavailable, deterministic findings are preserved
 *   and the manifest records that the model-assisted review was skipped.
 * - No paid inference, no additional infrastructure.
 */

import { createFreeLLMClient, type FreeLLMClient } from "../free-llm-client.js";
import type { EditorialCandidateAssessment, EditorialStory } from "./schema.js";

export interface EditorialSemanticReviewInput {
	editionDate: string;
	assessments: EditorialCandidateAssessment[];
	stories: EditorialStory[];
}

export interface EditorialSemanticReviewOutcome {
	findings: string[];
	tradeOffs: string[];
	interdisciplinaryObservations: string[];
	provider?: string;
	model?: string;
}

/** Injectable provider so tests can supply deterministic fakes. */
export interface EditorialSemanticProvider {
	review(
		input: EditorialSemanticReviewInput,
	): Promise<EditorialSemanticReviewOutcome>;
}

function buildPrompt(input: EditorialSemanticReviewInput): string {
	const candidateSummaries = input.assessments
		.slice(0, 40)
		.map((assessment) =>
			[
				`ID: ${assessment.candidateId}`,
				`Headline: ${assessment.factualHeadline}`,
				`Decision: ${assessment.decision} (materiality ${assessment.materialityScore.toFixed(3)})`,
				`Eligibility: ${assessment.eligibility.state}`,
				`Dimensions: ${assessment.dimensions
					.map(
						(dimension) =>
							`${dimension.dimension}=${dimension.level}`,
					)
					.join(", ")}`,
			].join("\n"),
		)
		.join("\n\n");

	const storySummaries = input.stories
		.map(
			(story) =>
				`${story.order}. ${story.candidateId} — ${story.title} (${story.materialityScore.toFixed(3)})`,
		)
		.join("\n");

	return [
		"You are an evidence-first editorial review analyst for an AI intelligence publication.",
		"Challenge the editorial selection for bias and blind spots. Do NOT re-decide novelty or re-verify claims.",
		"Do NOT invent facts, scores or sources. Base every observation only on the supplied evidence.",
		"",
		"Evaluate: vendor concentration and whether it is justified; overlooked high-impact developments; technical product news",
		"displacing consequential research; undervalued strategic/economic developments; Ring 2 research coverage;",
		"mandatory development-tool monitoring confused with editorial priority; excluded findings that challenge the dominant",
		"narrative; meaningful second-order consequences that are supported by the evidence.",
		"",
		"Rules: do not recommend artificial diversity, topic quotas or vendor representation.",
		"Distinguish immediate observed impact from plausible implications and longer-term hypotheses.",
		"If the evidence is insufficient, say so explicitly rather than speculating.",
		"",
		`EDITION: ${input.editionDate}`,
		"",
		"SELECTED STORIES:",
		storySummaries || "(none)",
		"",
		"CANDIDATE ASSESSMENTS:",
		candidateSummaries || "(none)",
		"",
		'Respond with JSON only: {"findings": ["..."], "tradeOffs": ["..."], "interdisciplinaryObservations": ["..."]}',
	].join("\n");
}

function parseResponse(
	content: string,
	provider: string,
	model: string,
): EditorialSemanticReviewOutcome {
	const jsonMatch = content.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		return {
			findings: [],
			tradeOffs: [],
			interdisciplinaryObservations: [],
			provider,
			model,
		};
	}
	try {
		const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
		const toStringArray = (value: unknown): string[] =>
			Array.isArray(value)
				? value.filter(
						(item): item is string => typeof item === "string",
					)
				: [];
		return {
			findings: toStringArray(parsed.findings),
			tradeOffs: toStringArray(parsed.tradeOffs),
			interdisciplinaryObservations: toStringArray(
				parsed.interdisciplinaryObservations,
			),
			provider,
			model,
		};
	} catch {
		return {
			findings: [],
			tradeOffs: [],
			interdisciplinaryObservations: [],
			provider,
			model,
		};
	}
}

/**
 * Create an editorial review provider backed by the configured free inference
 * providers. Uses the existing FreeLLMClient with its free-only budget,
 * temperature 0 and a fixed seed for deterministic structured output.
 */
export function createFreeLlmEditorialSemanticProvider(
	client?: FreeLLMClient,
): EditorialSemanticProvider {
	const llm =
		client ??
		createFreeLLMClient({ enableCache: true, enableCheckpoints: false });
	return {
		async review(
			input: EditorialSemanticReviewInput,
		): Promise<EditorialSemanticReviewOutcome> {
			const response = await llm.request(
				[
					{
						role: "system",
						content:
							"You are an evidence-first editorial review analyst. Never invent facts. Base every observation only on the supplied evidence.",
					},
					{ role: "user", content: buildPrompt(input) },
				],
				{ temperature: 0, seed: 42, maxTokens: 1024 },
			);
			return parseResponse(
				response.content,
				response.provider,
				response.model,
			);
		},
	};
}
