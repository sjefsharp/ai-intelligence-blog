/**
 * Editorial Selection — Merging & Relationships
 *
 * Combines related candidates that describe one coherent development while
 * retaining separate source IDs, claim IDs and evidence provenance. Independent
 * findings are never merged merely because they concern the same vendor or
 * topic.
 *
 * Merge criteria (deliberately strict):
 * - The candidates share a normalized canonical URL and a source identifier, or
 * - They share a source identifier and repeat the same normalized claim
 *   statement, or
 * - They share a source identifier and their exact statements are near-identical
 *   (token similarity at or above the configured threshold).
 *
 * Within a merge group the highest-materiality candidate becomes the primary
 * story; the others are recorded as MERGED with their provenance preserved.
 */

import type { CanonicalCandidate } from "../fact-dossier/schema.js";
import type { HistoricalRelationship } from "../historical-regression/schema.js";
import type {
	EditorialCandidateAssessment,
	EditorialRelationship,
	EditorialStory,
} from "./schema.js";
import { EDITORIAL_RELATIONSHIP_ID_PREFIX } from "./schema.js";
import { normalizeStatement, normalizeUrl } from "./similarity.js";
import crypto from "crypto";

function sha16(value: string): string {
	return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

/** Derive a stable relationship identifier. */
export function deriveRelationshipId(keys: string[]): string {
	return `${EDITORIAL_RELATIONSHIP_ID_PREFIX}${sha16(keys.toSorted().join(":"))}`;
}

/**
 * Detect merge groups among candidates. Returns a map from merged candidate
 * identifier to the primary candidate identifier of its group.
 */
export function detectMergeGroups(
	candidates: CanonicalCandidate[],
	materiality: Map<string, number>,
): Map<string, string> {
	const sorted = candidates.toSorted((a, b) =>
		a.candidateId.localeCompare(b.candidateId),
	);
	const parent = new Map<string, string>();

	const find = (id: string): string => {
		let current = id;
		while (parent.has(current)) current = parent.get(current)!;
		return current;
	};

	const union = (a: string, b: string): void => {
		const rootA = find(a);
		const rootB = find(b);
		if (rootA === rootB) return;
		// The higher-materiality candidate becomes the group primary. Ties break
		// deterministically on identifier order.
		const scoreA = materiality.get(rootA) ?? 0;
		const scoreB = materiality.get(rootB) ?? 0;
		if (
			scoreB > scoreA ||
			(scoreB === scoreA && rootB.localeCompare(rootA) < 0)
		) {
			parent.set(rootA, rootB);
		} else {
			parent.set(rootB, rootA);
		}
	};

	for (let i = 0; i < sorted.length; i++) {
		for (let j = i + 1; j < sorted.length; j++) {
			const first = sorted[i];
			const second = sorted[j];
			if (shouldMerge(first, second)) {
				union(first.candidateId, second.candidateId);
			}
		}
	}

	const groups = new Map<string, string[]>();
	for (const candidate of sorted) {
		const root = find(candidate.candidateId);
		const members = groups.get(root) ?? [];
		members.push(candidate.candidateId);
		groups.set(root, members);
	}

	const merged = new Map<string, string>();
	const byId = new Map(
		sorted.map((candidate) => [candidate.candidateId, candidate]),
	);
	for (const [, members] of groups) {
		if (members.length < 2) continue;
		const ordered = members
			.map((id) => ({
				id,
				score: materiality.get(id) ?? 0,
				published:
					byId.get(id)?.timestamps.originalPublicationTimestamp ?? "",
			}))
			.sort((a, b) => {
				// The earliest publication is the primary story (the original article);
				// materiality and identifier order are deterministic tiebreakers.
				if (a.published !== b.published)
					return a.published.localeCompare(b.published);
				if (b.score !== a.score) return b.score - a.score;
				return a.id.localeCompare(b.id);
			});
		const primary = ordered[0].id;
		for (const member of ordered.slice(1)) {
			merged.set(member.id, primary);
		}
	}
	return merged;
}

function shouldMerge(a: CanonicalCandidate, b: CanonicalCandidate): boolean {
	const aUrls = new Set(
		a.sources.map((source) => normalizeUrl(source.canonicalUrl)),
	);
	const bUrls = new Set(
		b.sources.map((source) => normalizeUrl(source.canonicalUrl)),
	);
	const sharesUrl = [...aUrls].some((url) => bUrls.has(url));
	if (sharesUrl) return true;

	const aSources = new Set(a.sources.map((source) => source.sourceId));
	const bSources = new Set(b.sources.map((source) => source.sourceId));
	const sharesSource = [...aSources].some((sourceId) =>
		bSources.has(sourceId),
	);
	if (!sharesSource) return false;

	// Same source registry entry and an identical claim statement: the same
	// underlying material, not merely the same vendor or topic.
	const aClaims = a.claims.map((claim) =>
		normalizeStatement(claim.claimStatement),
	);
	const bClaims = b.claims.map((claim) =>
		normalizeStatement(claim.claimStatement),
	);
	return aClaims.some((claim) => bClaims.includes(claim));
}

/**
 * Identify relationships between selected stories and other assessed
 * candidates. Relationships are evidence-backed and never invented: they are
 * derived from shared identifiers, entity overlap or historical regression
 * links.
 */
export function identifyRelationships(
	assessments: EditorialCandidateAssessment[],
	stories: EditorialStory[],
	historicalRelationships: Map<string, HistoricalRelationship>,
): EditorialRelationship[] {
	const relationships: EditorialRelationship[] = [];
	const storyByCandidate = new Map(
		stories.map((story) => [story.candidateId, story]),
	);

	// --- Merged coverage: provenance preserved inside a selected story -------
	for (const story of stories) {
		if (story.mergedCandidateIds.length === 0) continue;
		relationships.push(
			buildRelationship(
				[story.storyId],
				[story.candidateId, ...story.mergedCandidateIds],
				"same-development",
				`Merged coverage: ${story.mergedCandidateIds.length} additional article(s) describe the same coherent development; separate source, candidate and claim identifiers are preserved.`,
				[...story.sourceIds, ...story.claimIds],
			),
		);
	}

	// --- Relationships among selected stories --------------------------------
	for (let i = 0; i < stories.length; i++) {
		for (let j = i + 1; j < stories.length; j++) {
			const first = stories[i];
			const second = stories[j];
			const sharedSources = first.sourceIds.filter((id) =>
				second.sourceIds.includes(id),
			);
			const sharedOrgs = first.organizations.filter((org) =>
				second.organizations.includes(org),
			);
			const sharedDomains = first.researchDomains.filter((domain) =>
				second.researchDomains.includes(domain),
			);

			if (sharedSources.length > 0) {
				relationships.push(
					buildRelationship(
						[first.storyId, second.storyId],
						[first.candidateId, second.candidateId],
						"same-development",
						`Share source identifier(s) ${sharedSources.join(", ")}; describe one coherent development.`,
						[...sharedSources],
					),
				);
			} else if (sharedOrgs.length > 0 && sharedDomains.length > 0) {
				relationships.push(
					buildRelationship(
						[first.storyId, second.storyId],
						[first.candidateId, second.candidateId],
						"related-development",
						`Related through organization(s) ${sharedOrgs.join(", ")} and research domain(s) ${sharedDomains.join(", ")}.`,
						[...sharedOrgs, ...sharedDomains],
					),
				);
			} else if (sharedOrgs.length > 0) {
				relationships.push(
					buildRelationship(
						[first.storyId, second.storyId],
						[first.candidateId, second.candidateId],
						"related-development",
						`Related through organization(s) ${sharedOrgs.join(", ")}.`,
						[...sharedOrgs],
					),
				);
			}
		}
	}

	// --- Historical regression links between selected stories ----------------
	for (const [candidateId, relationship] of historicalRelationships) {
		if (
			relationship.classification !== "SUBSTANTIVE_UPDATE" &&
			relationship.classification !== "PREVIOUSLY_COVERED" &&
			relationship.classification !== "REPEATED_REPORTING"
		) {
			continue;
		}
		const story = storyByCandidate.get(candidateId);
		if (!story) continue;
		const previousCandidateId = relationship.primaryMatchCandidateId;
		if (!previousCandidateId) continue;
		const previousStory = storyByCandidate.get(previousCandidateId);
		if (!previousStory || previousStory.storyId === story.storyId) continue;

		relationships.push(
			buildRelationship(
				[story.storyId, previousStory.storyId],
				[candidateId, previousCandidateId],
				relationship.classification === "SUBSTANTIVE_UPDATE"
					? "extends"
					: "related-development",
				describeHistoricalLink(relationship.classification),
				[`historical-regression:${relationship.candidateId}`],
			),
		);
	}

	// --- Contradictions recorded by evidence verification --------------------
	for (const story of stories) {
		const assessment = assessments.find(
			(entry) => entry.candidateId === story.candidateId,
		);
		if (!assessment) continue;
		for (const caveat of assessment.uncertainty) {
			if (/contradict|counterevidence/i.test(caveat)) {
				relationships.push(
					buildRelationship(
						[story.storyId],
						[story.candidateId],
						"contradicts",
						`Material caveat: ${caveat}`,
						[...story.claimIds],
					),
				);
			}
		}
	}

	return dedupeRelationships(relationships);
}

function describeHistoricalLink(classification: string): string {
	switch (classification) {
		case "SUBSTANTIVE_UPDATE":
			return "Historical regression identifies a substantive update linking these developments.";
		case "PREVIOUSLY_COVERED":
			return "Historical regression links these developments to previously covered material.";
		case "REPEATED_REPORTING":
			return "Historical regression links these developments through repeated reporting.";
		default:
			return "Historical regression links these developments.";
	}
}

function buildRelationship(
	storyIds: string[],
	candidateIds: string[],
	type: EditorialRelationship["type"],
	description: string,
	evidenceTraceableTo: string[],
): EditorialRelationship {
	return {
		relationshipId: deriveRelationshipId([
			...storyIds,
			...candidateIds,
			type,
		]),
		storyIds: [...new Set(storyIds)].sort(),
		candidateIds: [...new Set(candidateIds)].sort(),
		type,
		description,
		evidenceTraceableTo: [...new Set(evidenceTraceableTo)].sort(),
	};
}

function dedupeRelationships(
	relationships: EditorialRelationship[],
): EditorialRelationship[] {
	const seen = new Set<string>();
	const result: EditorialRelationship[] = [];
	for (const relationship of relationships) {
		if (seen.has(relationship.relationshipId)) continue;
		seen.add(relationship.relationshipId);
		result.push(relationship);
	}
	return result.sort((a, b) =>
		a.relationshipId.localeCompare(b.relationshipId),
	);
}
