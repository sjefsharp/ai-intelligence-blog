/**
 * Historical Regression — Deterministic Matching
 *
 * Compares current canonical candidates against an index of one historical
 * edition using deterministic identifiers first:
 *   stable candidate IDs → stable claim IDs → normalized canonical URLs →
 *   source IDs → organization/product/technology entities → timestamps →
 *   token similarity (flag only).
 *
 * Similar headlines, vendors or research topics are never equated with
 * identical developments. Token similarity is recorded as evidence and, when
 * it is the only signal, the comparison is escalated to semantic review or
 * marked HISTORY_UNVERIFIED — never silently promoted to a match.
 */

import type { CanonicalCandidate } from "../fact-dossier/schema.js";
import type { HistoricalMatchEvidence, HistoricalMatchType } from "./schema.js";

// ============================================================================
// URL normalization
// ============================================================================

/** Query parameters that carry no canonical identity. */
const NON_CANONICAL_QUERY_PARAMS = new Set([
	"utm_source",
	"utm_medium",
	"utm_campaign",
	"utm_term",
	"utm_content",
	"utm_id",
	"ref",
	"referrer",
	"source",
	"fbclid",
	"gclid",
	"mc_cid",
	"mc_eid",
]);

/**
 * Normalize a URL for deterministic comparison.
 *
 * - lowercases scheme and host
 * - upgrades http → https (canonical identity is host + path)
 * - strips `www.`
 * - removes fragments and non-canonical tracking query parameters
 * - sorts remaining query parameters
 * - strips trailing slashes (except root)
 */
export function normalizeUrl(url: string): string {
	try {
		const parsed = new URL(url.trim());
		const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
		const protocol =
			parsed.protocol.toLowerCase() === "http:"
				? "https:"
				: parsed.protocol.toLowerCase();
		const path = parsed.pathname.replace(/\/+$/, "") || "/";
		const params = [...parsed.searchParams.entries()]
			.filter(
				([key]) => !NON_CANONICAL_QUERY_PARAMS.has(key.toLowerCase()),
			)
			.sort((a, b) =>
				a[0] === b[0]
					? a[1].localeCompare(b[1])
					: a[0].localeCompare(b[0]),
			);
		const query =
			params.length > 0
				? `?${params.map(([k, v]) => `${k}=${v}`).join("&")}`
				: "";
		return `${protocol}//${host}${path}${query}`;
	} catch {
		return url.trim().toLowerCase();
	}
}

// ============================================================================
// Tokenization and similarity
// ============================================================================

const STOP_WORDS = new Set([
	"the",
	"and",
	"for",
	"with",
	"from",
	"that",
	"this",
	"into",
	"onto",
	"over",
	"under",
	"about",
	"after",
	"before",
	"been",
	"being",
	"have",
	"has",
	"had",
	"its",
	"their",
	"they",
	"them",
	"then",
	"than",
	"when",
	"where",
	"which",
	"while",
	"will",
	"would",
	"could",
	"should",
	"also",
	"more",
	"most",
	"less",
	"least",
	"such",
	"some",
	"any",
	"all",
	"each",
	"other",
	"another",
	"new",
	"now",
	"via",
	"per",
	"using",
	"used",
	"uses",
	"adds",
	"added",
	"adds",
	"says",
	"said",
	"report",
	"reports",
	"reported",
	"announces",
	"announced",
	"announcement",
	"update",
	"updates",
	"updated",
	"release",
	"releases",
	"released",
	"launch",
	"launches",
	"launched",
	"introduces",
	"introduced",
]);

/** Tokenize free text into comparable lowercase tokens. */
export function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.split(" ")
		.filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

/** Jaccard similarity of two token sets (0-1). */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
	if (a.size === 0 && b.size === 0) return 0;
	let intersection = 0;
	for (const token of a) {
		if (b.has(token)) intersection++;
	}
	const union = a.size + b.size - intersection;
	return union === 0 ? 0 : intersection / union;
}

/** Containment similarity: |a ∩ b| / min(|a|, |b|) (0-1). */
export function containmentSimilarity(a: Set<string>, b: Set<string>): number {
	if (a.size === 0 || b.size === 0) return 0;
	let intersection = 0;
	for (const token of a) {
		if (b.has(token)) intersection++;
	}
	return intersection / Math.min(a.size, b.size);
}

/** Build the comparable token set for a candidate's headline + exact statement. */
export function candidateTextTokens(
	candidate: CanonicalCandidate,
): Set<string> {
	return new Set(
		tokenize(`${candidate.factualHeadline} ${candidate.exactStatement}`),
	);
}

/** Build the comparable token set for a candidate's claim statements. */
export function candidateClaimTokens(
	candidate: CanonicalCandidate,
): Set<string> {
	return new Set(
		tokenize(candidate.claims.map((c) => c.claimStatement).join(" ")),
	);
}

/** Best pairwise claim containment similarity between two candidates (0-1). */
export function claimSimilarity(
	current: CanonicalCandidate,
	historical: CanonicalCandidate,
): number {
	const currentClaims = current.claims.map(
		(c) => new Set(tokenize(c.claimStatement)),
	);
	const historicalClaims = historical.claims.map(
		(c) => new Set(tokenize(c.claimStatement)),
	);
	if (currentClaims.length === 0 || historicalClaims.length === 0) return 0;

	let best = 0;
	for (const a of currentClaims) {
		for (const b of historicalClaims) {
			const score = Math.max(
				containmentSimilarity(a, b),
				jaccardSimilarity(a, b),
			);
			if (score > best) best = score;
		}
	}
	return best;
}

// ============================================================================
// Version comparison
// ============================================================================

/** Extract a dotted/numeric version token from arbitrary text. */
export function extractVersion(text: string | undefined): string | null {
	if (!text) return null;
	const match = text.match(/(\d+(?:\.\d+)+)/);
	return match ? match[1] : null;
}

/**
 * Compare two version strings numerically.
 * Returns -1, 0, 1, or null when either version cannot be parsed.
 */
export function compareVersions(
	a: string | undefined,
	b: string | undefined,
): number | null {
	const va = extractVersion(a);
	const vb = extractVersion(b);
	if (!va || !vb) return null;
	const pa = va.split(".").map((n) => Number.parseInt(n, 10));
	const pb = vb.split(".").map((n) => Number.parseInt(n, 10));
	const length = Math.max(pa.length, pb.length);
	for (let i = 0; i < length; i++) {
		const na = pa[i] ?? 0;
		const nb = pb[i] ?? 0;
		if (na !== nb) return na < nb ? -1 : 1;
	}
	return 0;
}

// ============================================================================
// Edition index
// ============================================================================

/** Indexed form of one historical edition, used for deterministic matching. */
export interface HistoricalEditionIndex {
	editionDate: string;
	editionId: string;
	candidates: CanonicalCandidate[];
	byCandidateId: Map<string, CanonicalCandidate>;
	claimToCandidate: Map<string, CanonicalCandidate>;
	urlToCandidates: Map<string, CanonicalCandidate[]>;
	sourceIdToCandidates: Map<string, CanonicalCandidate[]>;
	publicationIds: string[];
	/** Resolve the historical candidate a match refers to, if determinable. */
	resolveCandidateId(match: HistoricalMatchEvidence): string | undefined;
}

/** Build a deterministic index over one historical edition's canonical dossier. */
export function buildHistoricalEditionIndex(params: {
	editionDate: string;
	dossier: { candidates: CanonicalCandidate[] };
	publicationIds?: string[];
}): HistoricalEditionIndex {
	const byCandidateId = new Map<string, CanonicalCandidate>();
	const claimToCandidate = new Map<string, CanonicalCandidate>();
	const urlToCandidates = new Map<string, CanonicalCandidate[]>();
	const sourceIdToCandidates = new Map<string, CanonicalCandidate[]>();

	const addCandidate = (
		map: Map<string, CanonicalCandidate[]>,
		key: string,
		candidate: CanonicalCandidate,
	) => {
		const list = map.get(key) ?? [];
		list.push(candidate);
		map.set(key, list);
	};

	for (const candidate of params.dossier.candidates) {
		byCandidateId.set(candidate.candidateId, candidate);
		for (const claim of candidate.claims) {
			if (!claimToCandidate.has(claim.claimId)) {
				claimToCandidate.set(claim.claimId, candidate);
			}
		}
		for (const source of candidate.sources) {
			addCandidate(
				urlToCandidates,
				normalizeUrl(source.canonicalUrl),
				candidate,
			);
			addCandidate(sourceIdToCandidates, source.sourceId, candidate);
		}
		for (const claim of candidate.claims) {
			for (const url of claim.supportingEvidenceUrls) {
				addCandidate(urlToCandidates, normalizeUrl(url), candidate);
			}
		}
	}

	return {
		editionDate: params.editionDate,
		editionId: `edition_${params.editionDate}`,
		candidates: params.dossier.candidates,
		byCandidateId,
		claimToCandidate,
		urlToCandidates,
		sourceIdToCandidates,
		publicationIds: params.publicationIds ?? [],
		resolveCandidateId(match: HistoricalMatchEvidence): string | undefined {
			if (match.matchedCandidateIds.length > 0)
				return match.matchedCandidateIds[0];
			for (const claimId of match.matchedClaimIds) {
				const candidate = claimToCandidate.get(claimId);
				if (candidate) return candidate.candidateId;
			}
			for (const url of match.matchedUrls) {
				const hits = urlToCandidates.get(url);
				if (hits && hits.length > 0) return hits[0].candidateId;
			}
			return match.semanticMatchCandidateId;
		},
	};
}

// ============================================================================
// Match computation
// ============================================================================

/** Match types that establish identity of the underlying development. */
export const STRONG_MATCH_TYPES: ReadonlySet<HistoricalMatchType> = new Set([
	"candidate-id",
	"claim-id",
	"source-url",
	"timestamp",
]);

/** Match types that only indicate related context. */
export const WEAK_MATCH_TYPES: ReadonlySet<HistoricalMatchType> = new Set([
	"entity",
	"source-id",
	"semantic-similarity",
]);

/** Default headline token-similarity threshold for flagging a semantic comparison. */
export const DEFAULT_HEADLINE_SIMILARITY_THRESHOLD = 0.6;

/** Default claim token-similarity threshold for flagging a semantic comparison. */
export const DEFAULT_CLAIM_SIMILARITY_THRESHOLD = 0.5;

/** Backwards-compatible alias for the headline threshold. */
export const DEFAULT_SEMANTIC_SIMILARITY_THRESHOLD =
	DEFAULT_HEADLINE_SIMILARITY_THRESHOLD;

/** Minimum number of shared tokens before similarity is considered meaningful. */
export const MIN_SHARED_TOKENS = 3;

export interface MatchOptions {
	/** Headline similarity threshold that flags a semantic comparison (default 0.6). */
	headlineSimilarityThreshold?: number;
	/** Claim similarity threshold that flags a semantic comparison (default 0.5). */
	claimSimilarityThreshold?: number;
}

/** Case-insensitive exact entity comparison. */
function normalizeEntity(value: string): string {
	return value.trim().toLowerCase();
}

function overlap(current: string[], historical: string[]): string[] {
	const historicalSet = new Set(historical.map(normalizeEntity));
	const shared = [
		...new Set(
			current.filter((value) =>
				historicalSet.has(normalizeEntity(value)),
			),
		),
	];
	return shared.sort((a, b) => a.localeCompare(b));
}

function normalizeTimestamp(value: string | undefined): string | undefined {
	if (!value) return undefined;
	try {
		return new Date(value).toISOString();
	} catch {
		return value;
	}
}

/**
 * Compute deterministic match evidence between the current candidate and one
 * historical edition. Never throws: malformed records degrade to weaker
 * evidence with an explanatory note.
 */
export function computeHistoricalMatch(
	current: CanonicalCandidate,
	index: HistoricalEditionIndex,
	options: MatchOptions = {},
): HistoricalMatchEvidence {
	const headlineThreshold =
		options.headlineSimilarityThreshold ??
		DEFAULT_HEADLINE_SIMILARITY_THRESHOLD;
	const claimThreshold =
		options.claimSimilarityThreshold ?? DEFAULT_CLAIM_SIMILARITY_THRESHOLD;
	const evidenceReferences: string[] = [];

	// --- Candidate ID -------------------------------------------------------
	const sameCandidate = index.byCandidateId.get(current.candidateId);
	const matchedCandidateIds: string[] = sameCandidate
		? [sameCandidate.candidateId]
		: [];

	// --- Claim IDs ----------------------------------------------------------
	const matchedClaimRecords = current.claims
		.map((claim) => ({
			claim,
			candidate: index.claimToCandidate.get(claim.claimId),
		}))
		.filter(
			(
				entry,
			): entry is {
				claim: typeof entry.claim;
				candidate: CanonicalCandidate;
			} => Boolean(entry.candidate),
		);
	const matchedClaims = matchedClaimRecords.map((entry) => entry.candidate);
	const matchedClaimIds = [
		...new Set(matchedClaimRecords.map((entry) => entry.claim.claimId)),
	].sort();
	for (const claimId of matchedClaimIds) {
		evidenceReferences.push(`${index.editionId}.json#claim/${claimId}`);
	}

	// A stable claim identifier identifies exactly one historical candidate.
	const implicatedCandidateIds = [
		...new Set([
			...matchedCandidateIds,
			...matchedClaims.map((candidate) => candidate.candidateId),
		]),
	].sort();

	// --- Normalized canonical URLs -----------------------------------------
	const currentUrls = [
		...current.sources.map((source) => normalizeUrl(source.canonicalUrl)),
		...current.claims.flatMap((claim) =>
			claim.supportingEvidenceUrls.map((url) => normalizeUrl(url)),
		),
	];
	const matchedUrls: string[] = [];
	const urlMatchedCandidates = new Set<string>();
	for (const url of currentUrls) {
		const hits = index.urlToCandidates.get(url);
		if (hits) {
			matchedUrls.push(url);
			for (const hit of hits) urlMatchedCandidates.add(hit.candidateId);
		}
	}
	const uniqueMatchedUrls = [...new Set(matchedUrls)].sort();

	// --- Source IDs ---------------------------------------------------------
	const currentSourceIds = current.sources.map((source) => source.sourceId);
	const matchedSourceIds = [
		...new Set(
			currentSourceIds.filter((id) => index.sourceIdToCandidates.has(id)),
		),
	].sort();

	// --- Entities -----------------------------------------------------------
	const historicalCandidates = index.candidates;
	const sharedOrganizations = [
		...new Set(
			historicalCandidates.flatMap((h) =>
				overlap(current.organizations, h.organizations),
			),
		),
	].sort();
	const sharedProducts = [
		...new Set(
			historicalCandidates.flatMap((h) =>
				overlap(current.products, h.products),
			),
		),
	].sort();
	const sharedTechnologies = [
		...new Set(
			historicalCandidates.flatMap((h) =>
				overlap(current.technologies, h.technologies),
			),
		),
	].sort();

	// Research domains are shared across almost everything; recorded for context.
	const historicalDomains = new Set(
		historicalCandidates.flatMap((h) => h.researchDomains),
	);
	const sharedResearchDomains = [
		...new Set(
			current.researchDomains.filter((d) => historicalDomains.has(d)),
		),
	].sort();

	const hasEntityOverlap =
		sharedOrganizations.length > 0 ||
		sharedProducts.length > 0 ||
		sharedTechnologies.length > 0;

	// --- Timestamps ---------------------------------------------------------
	const currentPublication = normalizeTimestamp(
		current.timestamps.originalPublicationTimestamp,
	);
	const currentDisclosure = normalizeTimestamp(
		current.timestamps.earliestSupportedPublicDisclosureTimestamp,
	);
	let timestampMatch = false;
	if (currentPublication || currentDisclosure) {
		for (const historical of historicalCandidates) {
			const historicalPublication = normalizeTimestamp(
				historical.timestamps.originalPublicationTimestamp,
			);
			const historicalDisclosure = normalizeTimestamp(
				historical.timestamps
					.earliestSupportedPublicDisclosureTimestamp,
			);
			if (
				(currentPublication &&
					currentPublication === historicalPublication) ||
				(currentDisclosure &&
					currentDisclosure === historicalDisclosure)
			) {
				timestampMatch = true;
				break;
			}
		}
	}

	// --- Token similarity (flag only) --------------------------------------
	const currentTokens = candidateTextTokens(current);
	const currentClaimTokens = candidateClaimTokens(current);
	let headlineSimilarity = 0;
	let bestSemanticCandidate: CanonicalCandidate | null = null;
	let bestClaimSimilarity = 0;
	let sharedTokenCount = 0;

	for (const historical of historicalCandidates) {
		const historicalTokens = candidateTextTokens(historical);
		const shared = [...currentTokens].filter((token) =>
			historicalTokens.has(token),
		).length;
		const headline = jaccardSimilarity(currentTokens, historicalTokens);
		const claim = claimSimilarity(current, historical);
		if (headline > headlineSimilarity || claim > bestClaimSimilarity) {
			bestSemanticCandidate = historical;
			sharedTokenCount = shared;
		}
		headlineSimilarity = Math.max(headlineSimilarity, headline);
		bestClaimSimilarity = Math.max(bestClaimSimilarity, claim);
	}

	const semanticSimilarityFlagged =
		headlineSimilarity >= headlineThreshold ||
		(bestClaimSimilarity >= claimThreshold &&
			sharedTokenCount >= MIN_SHARED_TOKENS);

	const primaryHistorical =
		sameCandidate ??
		matchedClaims[0] ??
		(urlMatchedCandidates.size > 0
			? index.byCandidateId.get([...urlMatchedCandidates][0])
			: undefined) ??
		bestSemanticCandidate;

	const previousPublicationId = undefined; // publication linkage is resolved by the engine

	// --- Match type priority ------------------------------------------------
	let matchType: HistoricalMatchType;
	if (sameCandidate) {
		matchType = "candidate-id";
	} else if (matchedClaims.length > 0) {
		matchType = "claim-id";
	} else if (uniqueMatchedUrls.length > 0) {
		matchType = "source-url";
	} else if (timestampMatch && hasEntityOverlap) {
		matchType = "timestamp";
	} else if (hasEntityOverlap) {
		matchType = "entity";
	} else if (matchedSourceIds.length > 0) {
		matchType = "source-id";
	} else if (semanticSimilarityFlagged) {
		matchType = "semantic-similarity";
	} else {
		matchType = "none";
	}

	const matched = matchType !== "none";

	if (implicatedCandidateIds.length > 0) {
		evidenceReferences.push(
			`${index.editionId}.json#candidate/${implicatedCandidateIds[0]}`,
		);
	}
	for (const url of uniqueMatchedUrls) {
		evidenceReferences.push(url);
	}

	const note = buildMatchNote({
		matchType,
		matched,
		sameCandidate: Boolean(sameCandidate),
		matchedClaimCount: matchedClaims.length,
		matchedUrlCount: uniqueMatchedUrls.length,
		hasEntityOverlap,
		timestampMatch,
		headlineSimilarity,
		bestClaimSimilarity,
		semanticSimilarityFlagged,
		sharedTokenCount,
		headlineThreshold,
		claimThreshold,
	});

	return {
		editionDate: index.editionDate,
		editionId: index.editionId,
		matched,
		matchType,
		matchedCandidateIds: implicatedCandidateIds,
		matchedClaimIds,
		matchedSourceIds,
		semanticMatchCandidateId:
			matchType === "semantic-similarity"
				? bestSemanticCandidate?.candidateId
				: undefined,
		matchedUrls: uniqueMatchedUrls,
		sharedOrganizations,
		sharedProducts,
		sharedTechnologies,
		sharedResearchDomains,
		headlineSimilarity: roundTo(headlineSimilarity, 4),
		claimSimilarity: roundTo(bestClaimSimilarity, 4),
		timestampMatch,
		previousPublicationId,
		evidenceReferences: [...new Set(evidenceReferences)].sort(),
		note,
	};
}

function buildMatchNote(params: {
	matchType: HistoricalMatchType;
	matched: boolean;
	sameCandidate: boolean;
	matchedClaimCount: number;
	matchedUrlCount: number;
	hasEntityOverlap: boolean;
	timestampMatch: boolean;
	headlineSimilarity: number;
	bestClaimSimilarity: number;
	semanticSimilarityFlagged: boolean;
	sharedTokenCount: number;
	headlineThreshold: number;
	claimThreshold: number;
}): string {
	if (!params.matched) {
		return `No deterministic identifier, normalized URL, entity or timestamp match; token similarity below the flagging thresholds (headline ${params.headlineThreshold}, claim ${params.claimThreshold}).`;
	}
	switch (params.matchType) {
		case "candidate-id":
			return "Exact stable candidate identifier match.";
		case "claim-id":
			return `Exact stable claim identifier match (${params.matchedClaimCount} claim(s)).`;
		case "source-url":
			return `Normalized canonical URL match (${params.matchedUrlCount} URL(s)).`;
		case "timestamp":
			return "Publication/disclosure timestamp match combined with organization/product/technology overlap.";
		case "entity":
			return "Organization/product/technology overlap only; no identifier, URL or timestamp match.";
		case "source-id":
			return "Shared source registry identifier only; the underlying developments are not established as identical.";
		case "semantic-similarity":
			return `Token similarity above the flagging thresholds (headline ${params.headlineThreshold}, claim ${params.claimThreshold}) without deterministic identity; escalated for semantic review.`;
		default:
			return "No match.";
	}
}

function roundTo(value: number, decimals: number): number {
	const factor = 10 ** decimals;
	return Math.round(value * factor) / factor;
}
