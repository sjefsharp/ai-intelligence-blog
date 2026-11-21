/**
 * Canonical Fact Dossier — Optional Model-Assisted Enrichment
 *
 * The dossier is deterministic by default. This module provides an OPTIONAL
 * semantic enrichment path for the exact-statement field, using the configured
 * free inference provider (NVIDIA Nemotron via OpenRouter) through the
 * existing `FreeLLMClient`.
 *
 * Hard rules:
 * - Enrichment is never required to complete a dossier.
 * - Enrichment never creates or modifies verified claim records.
 * - If model capacity is unavailable, the deterministic statement is preserved
 *   and the failure is recorded explicitly.
 * - Enriched statements are marked `model-assisted` and never imply independent
 *   verification.
 * - No paid inference is ever used (the free-only client enforces $0 cost).
 */

import type { CanonicalCandidate, CanonicalFactDossier } from "./schema.js";
import { computeDossierContentHash } from "./canonical.js";
import { createFreeLLMClient, type FreeLLMClient } from "../free-llm-client.js";

export interface EnrichmentInput {
	candidateId: string;
	title: string;
	summary: string;
	claims: string[];
	sourceTitles: string[];
}

export interface EnrichmentOutcome {
	exactStatement?: string;
	technicalInterpretation?: string;
	provider?: string;
	model?: string;
}

/** Injectable provider so tests can supply deterministic fakes. */
export interface EnrichmentProvider {
	enrich(input: EnrichmentInput): Promise<EnrichmentOutcome>;
}

/** Whether any free inference credential is configured. */
export function hasInferenceCredentials(): boolean {
	return Boolean(process.env.OPENROUTER_API_KEY);
}

function buildPrompt(input: EnrichmentInput): string {
	return [
		"You are an evidence-first technical editor for an AI intelligence publication.",
		"Write one precise, factual sentence describing what materially changed, based ONLY on the supplied evidence.",
		"Do not invent dates, numbers, capabilities, costs or verification status.",
		"If the evidence is insufficient, set exactStatement to INSUFFICIENT_EVIDENCE.",
		"",
		`Title: ${input.title}`,
		`Summary: ${input.summary}`,
		"Claims:",
		...input.claims.map((c) => `- ${c}`),
		`Sources: ${input.sourceTitles.join(", ")}`,
		"",
		'Respond with JSON only: {"exactStatement": "...", "technicalInterpretation": "..."}',
	].join("\n");
}

function parseEnrichmentResponse(
	content: string,
	provider: string,
	model: string,
): EnrichmentOutcome {
	const jsonMatch = content.match(/\{[\s\S]*\}/);
	if (!jsonMatch) return { provider, model };
	try {
		const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
		return {
			exactStatement:
				typeof parsed.exactStatement === "string"
					? parsed.exactStatement.trim()
					: undefined,
			technicalInterpretation:
				typeof parsed.technicalInterpretation === "string"
					? parsed.technicalInterpretation.trim()
					: undefined,
			provider,
			model,
		};
	} catch {
		return { provider, model };
	}
}

/**
 * Create an enrichment provider backed by the configured free inference
 * providers. Uses the existing FreeLLMClient with its free-only budget.
 */
export function createFreeLlmEnrichmentProvider(
	client?: FreeLLMClient,
): EnrichmentProvider {
	const llm =
		client ??
		createFreeLLMClient({ enableCache: true, enableCheckpoints: false });
	return {
		async enrich(input: EnrichmentInput): Promise<EnrichmentOutcome> {
			const response = await llm.request(
				[
					{
						role: "system",
						content:
							"You are an evidence-first technical editor. Never invent facts. Base every statement only on the supplied evidence.",
					},
					{ role: "user", content: buildPrompt(input) },
				],
				{ temperature: 0, seed: 42, maxTokens: 512 },
			);
			return parseEnrichmentResponse(
				response.content,
				response.provider,
				response.model,
			);
		},
	};
}

/**
 * Apply optional enrichment to a dossier. Never throws: enrichment failures are
 * recorded per candidate and the deterministic dossier is preserved.
 */
export async function enrichDossier(
	dossier: CanonicalFactDossier,
	provider?: EnrichmentProvider,
	now: string = new Date().toISOString(),
): Promise<CanonicalFactDossier> {
	const candidates: CanonicalCandidate[] = [];

	for (const candidate of dossier.candidates) {
		if (!provider) {
			candidates.push({
				...candidate,
				enrichment: {
					status: "disabled",
					exactStatementSource: "deterministic",
					note: "No enrichment provider configured; deterministic consolidation used.",
				},
			});
			continue;
		}

		try {
			const outcome = await provider.enrich({
				candidateId: candidate.candidateId,
				title: candidate.factualHeadline,
				summary: candidate.exactStatement,
				claims: candidate.claims.map((c) => c.claimStatement),
				sourceTitles: candidate.sources.map(
					(s) => s.title ?? s.sourceId,
				),
			});
			const isUsable =
				typeof outcome.exactStatement === "string" &&
				outcome.exactStatement.length > 0 &&
				!/INSUFFICIENT_EVIDENCE/i.test(outcome.exactStatement);
			const statement = isUsable ? outcome.exactStatement : undefined;

			candidates.push({
				...candidate,
				exactStatement: statement ?? candidate.exactStatement,
				enrichment: {
					status: isUsable ? "enriched" : "failed",
					exactStatementSource: isUsable
						? "model-assisted"
						: "deterministic",
					note: isUsable
						? "Exact statement assisted by model reasoning over the supplied evidence; not independently verified."
						: "Model returned no usable statement; deterministic consolidation preserved.",
					provider: outcome.provider,
					model: outcome.model,
					enrichedAt: now,
				},
			});
		} catch (error) {
			candidates.push({
				...candidate,
				enrichment: {
					status: "unavailable",
					exactStatementSource: "deterministic",
					note: `Enrichment unavailable: ${error instanceof Error ? error.message : String(error)}`,
				},
			});
		}
	}

	const updated: CanonicalFactDossier = {
		...dossier,
		candidates,
		updatedAt: now,
		processingAudit: {
			...dossier.processingAudit,
			inferenceUsed: Boolean(provider),
			inferenceNote: provider
				? "Optional model-assisted enrichment applied; deterministic verified records preserved."
				: "No model inference was required for deterministic consolidation.",
		},
		contentHash: "",
	};
	updated.contentHash = computeDossierContentHash(updated);
	return updated;
}
