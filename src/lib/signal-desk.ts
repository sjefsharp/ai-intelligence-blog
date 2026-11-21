/**
 * Signal Desk — Core Logic for Expert Contributor Monitoring
 *
 * Implements: evidence classification, ring mapping, contributor lifecycle,
 * discovery pipeline integration, and validation per Signal Desk Specification v1.0
 */

import { Temporal } from "@js-temporal/polyfill";

// ============================================================================
// Types
// ============================================================================

export type EvidenceClass =
	| "ORIGINAL_FINDING"
	| "FIRST_HAND_DISCLOSURE"
	| "INDEPENDENT_ANALYSIS"
	| "EXPERT_INTERPRETATION"
	| "UNVERIFIED_CLAIM";

export type DiscoveryRing = 1 | 2 | 3;

export type ContributorStatus =
	"active" | "watchlisted" | "archived" | "retired";

export type ChannelStatus = "active" | "limited" | "degraded" | "inactive";

export type ChannelType =
	| "rss"
	| "github"
	| "youtube"
	| "x"
	| "linkedin"
	| "podcast"
	| "arxiv"
	| "other";

export interface ContributorProfile {
	github?: string;
	x?: string;
	blog?: string;
	youtube?: string;
	employer?: string;
	linkedin?: string;
	[key: string]: string | undefined;
}

export interface SourceChannel {
	type: ChannelType;
	url: string;
	status: ChannelStatus;
	lastFetched: string;
	accessNotes: string;
	cadence:
		"daily" | "weekly" | "bi-weekly" | "monthly" | "quarterly" | "manual";
	contentTypes: string[];
}

export interface ContributorEntry {
	id: string;
	name: string;
	verified: boolean;
	verificationDate: string;
	verificationMethod: string;
	canonicalProfiles: ContributorProfile;
	sourceChannels: SourceChannel[];
	researchDomains: string[];
	subdomainTags: string[];
	ringAffinity: DiscoveryRing[];
	mandatory: boolean;
	status: ContributorStatus;
	watchlistDate?: string;
	addedDate: string;
	lastReviewed: string;
	notes: string;
	classificationHistory: ClassificationChange[];
}

export interface ClassificationChange {
	date: string;
	fromStatus: ContributorStatus;
	toStatus: ContributorStatus;
	authority: string;
	rationale: string;
}

export interface DiscoveredItem {
	id: string;
	sourceId: string;
	contributorId?: string;
	discoveredAt: string;
	title: string;
	url: string;
	contentHash: string;
	publishedAt?: string;
	/** First supported public disclosure timestamp (distinct from publication). */
	firstDisclosedAt?: string;
	/** Underlying event date, when different from publication/disclosure. */
	eventDate?: string;
	/** Last substantive update timestamp. */
	lastUpdatedAt?: string;
	/** Source timezone for timestamp interpretation. */
	sourceTimezone?: string;
	/** Confidence in the timestamp values (0-1). */
	timestampConfidence?: number;
	authors?: string[];
	rawMetadata: Record<string, unknown>;
	summary?: string;
	tags?: string[];
	language?: "en" | "nl" | "unknown";
	evidenceClass: EvidenceClass;
	ringClassification: DiscoveryRing[];
	claims: ClaimClassification[];
	status:
		| "new"
		| "triaged"
		| "promoted"
		| "rejected"
		| "duplicate"
		| "quarantined";
	triageNotes?: string;
	candidateId?: string;
	duplicateOf?: string;
	signalDeskOrigin: boolean;
}

export interface ClaimClassification {
	claim: string;
	evidenceClass: EvidenceClass;
	ringClassification: DiscoveryRing[];
	locator?: string;
}

export interface CandidateNewsItem {
	id: string;
	discoveryId: string;
	title: string;
	summary: string;
	sourceIds: string[];
	contributorIds: string[];
	proposedType: string;
	tier: 1 | 2 | 3;
	triageDate: string;
	triageBy: string;
	keyClaims: CandidateClaim[];
	relevanceTags: string[];
	researchDomains: string[];
	subdomainTags: string[];
	crossDomainSignals: boolean;
	evidenceClassDistribution: Record<EvidenceClass, number>;
	ringClassificationDistribution: Record<DiscoveryRing, number>;
	signalDeskOrigin: boolean;
	temporalWindowDays: number;
	status: string;
	assignedAuthor?: string;
	assignedVerifier?: string;
	deadline?: string;
	notes?: string;
}

export interface CandidateClaim {
	claim: string;
	sourceId: string;
	contributorId?: string;
	evidenceClass: EvidenceClass;
	ringClassification: DiscoveryRing[];
	needsVerification: boolean;
	proposedLevel: "L1" | "L2" | "L3";
}

// ============================================================================
// Evidence Classification Logic
// ============================================================================

/**
 * Classify a contribution's evidence class based on content signals.
 * This is the primary classification at ingestion time.
 */
type ClassifiableItem = Pick<
	DiscoveredItem,
	"title" | "summary" | "authors" | "rawMetadata"
>;

export function classifyEvidence(
	item: ClassifiableItem,
	contributor?: ContributorEntry,
): EvidenceClass {
	// Check for first-hand disclosure (author announces their own work)
	if (isFirstHandDisclosure(item, contributor)) {
		return "FIRST_HAND_DISCLOSURE";
	}

	// Check for original finding (novel artifact, benchmark, demo with code/data)
	if (isOriginalFinding(item, contributor)) {
		return "ORIGINAL_FINDING";
	}

	// Check for independent analysis (methodology + evidence + independence)
	if (isIndependentAnalysis(item, contributor)) {
		return "INDEPENDENT_ANALYSIS";
	}

	// Check for unverified claim (speculation, rumor, hearsay)
	if (isUnverifiedClaim(item)) {
		return "UNVERIFIED_CLAIM";
	}

	// Default: expert interpretation
	return "EXPERT_INTERPRETATION";
}

/**
 * Detect first-hand disclosure: author announces their own release/work.
 */
function isFirstHandDisclosure(
	item: ClassifiableItem,
	contributor?: ContributorEntry,
): boolean {
	const text = `${item.title} ${item.summary || ""}`.toLowerCase();
	const authorNames = item.authors?.join(" ").toLowerCase() || "";

	// Author matches contributor name or canonical handle
	if (contributor) {
		const contributorName = contributor.name.toLowerCase();
		const githubHandle =
			contributor.canonicalProfiles.github
				?.split("/")
				.pop()
				?.toLowerCase() || "";
		const xHandle =
			contributor.canonicalProfiles.x?.split("/").pop()?.toLowerCase() ||
			"";

		if (
			authorNames.includes(contributorName) ||
			authorNames.includes(githubHandle) ||
			authorNames.includes(xHandle)
		) {
			// First-person language
			const firstPersonPatterns = [
				"i released",
				"i launched",
				"i published",
				"i built",
				"i created",
				"my new",
				"my latest",
				"our new",
				"our latest",
				"we released",
				"we launched",
				"we published",
				"announcing",
				"introducing",
			];
			if (firstPersonPatterns.some((p) => text.includes(p))) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Detect original finding: novel artifact with reproducibility signals.
 */
function isOriginalFinding(
	item: ClassifiableItem,
	contributor?: ContributorEntry,
): boolean {
	const text = `${item.title} ${item.summary || ""}`.toLowerCase();

	// Strong signals of original artifact
	const artifactPatterns = [
		"benchmark",
		"reproduction",
		"reproduced",
		"artifact",
		"code available",
		"github.com/",
		"docker",
		"conda",
		"nix",
		"ci passing",
		"tests pass",
		"new record",
		"state of the art",
		"sota",
		"outperforms",
		"beats",
		"measured",
		"latency",
		"throughput",
		"memory usage",
		"cost analysis",
		"vulnerability",
		"exploit",
		"attack",
		"proof of concept",
		"poc",
		"novel",
		"new approach",
		"new method",
		"new technique",
	];

	const hasArtifactSignal = artifactPatterns.some((p) => text.includes(p));

	// Reproducibility indicators
	const reproducibilityPatterns = [
		"code:",
		"repo:",
		"github:",
		"install:",
		"run:",
		"docker pull",
		"requirements.txt",
		"pyproject.toml",
		"cargo.toml",
		"package.json",
		"reproduce",
		"replication",
		"artifact evaluation",
	];
	const hasReproSignal = reproducibilityPatterns.some((p) =>
		text.includes(p),
	);

	return hasArtifactSignal && hasReproSignal;
}

/**
 * Detect independent analysis: methodology + evidence + independence.
 */
function isIndependentAnalysis(
	item: ClassifiableItem,
	contributor?: ContributorEntry,
): boolean {
	const text = `${item.title} ${item.summary || ""}`.toLowerCase();

	// Methodology disclosure
	const methodologyPatterns = [
		"methodology",
		"method:",
		"approach:",
		"we compared",
		"we evaluated",
		"we measured",
		"we tested",
		"experimental setup",
		"hardware:",
		"configuration:",
		"parameters:",
		"hyperparameters:",
		"baseline:",
		"control:",
		"ablation",
		"sensitivity analysis",
		"confounder",
	];
	const hasMethodology = methodologyPatterns.some((p) => text.includes(p));

	// Evidence citations
	const evidencePatterns = [
		"according to",
		"cites",
		"references",
		"source:",
		"data from",
		"results show",
		"figure",
		"table",
		"appendix",
		"supplementary",
	];
	const hasEvidence = evidencePatterns.some((p) => text.includes(p));

	// Independence statement
	const independencePatterns = [
		"independent",
		"no affiliation",
		"not affiliated",
		"no funding from",
		"self-funded",
		"personal project",
		"on my own time",
	];
	const hasIndependence = independencePatterns.some((p) => text.includes(p));

	// Comparative/benchmarking language
	const comparativePatterns = [
		"compared to",
		"versus",
		"vs.",
		"benchmark against",
		"outperforms",
		"underperforms",
		"trade-off",
		"tradeoff",
		"pros and cons",
	];
	const hasComparative = comparativePatterns.some((p) => text.includes(p));

	return (
		(hasMethodology && hasEvidence) || (hasIndependence && hasComparative)
	);
}

/**
 * Detect unverified claim: speculation, rumor, hearsay.
 */
function isUnverifiedClaim(item: ClassifiableItem): boolean {
	const text = `${item.title} ${item.summary || ""}`.toLowerCase();

	const unverifiedPatterns = [
		"rumor",
		"rumours",
		"speculation",
		"unconfirmed",
		"allegedly",
		"reportedly",
		"sources say",
		"insider",
		"leak",
		"leaked",
		"heard that",
		"people say",
		"word is",
		"buzz",
		"hype",
		"might be",
		"could be",
		"possibly",
		"potentially",
		"rumored",
	];

	// But exclude if it's clearly labeled as analysis/opinion
	const analysisPatterns = [
		"analysis",
		"opinion",
		"perspective",
		"take:",
		"viewpoint",
		"i think",
		"i believe",
		"in my view",
		"editorial",
	];

	const hasUnverified = unverifiedPatterns.some((p) => text.includes(p));
	const hasAnalysisFrame = analysisPatterns.some((p) => text.includes(p));

	return hasUnverified && !hasAnalysisFrame;
}

// ============================================================================
// Ring Classification Logic
// ============================================================================

/**
 * Map evidence class to primary discovery ring(s).
 * Per Signal Desk §6: classification by evidentiary role, not reputation.
 */
export function mapEvidenceClassToRings(
	evidenceClass: EvidenceClass,
): DiscoveryRing[] {
	const mapping: Record<EvidenceClass, DiscoveryRing[]> = {
		ORIGINAL_FINDING: [2], // Research-level original work
		FIRST_HAND_DISCLOSURE: [1], // Authoritative originator disclosure
		INDEPENDENT_ANALYSIS: [2], // Methodological scrutiny
		EXPERT_INTERPRETATION: [3], // Practitioner signal
		UNVERIFIED_CLAIM: [], // Quarantined, no ring
	};
	return mapping[evidenceClass] || [];
}

/**
 * Determine ring classification for a multi-claim item.
 * Each claim gets its own ring; item inherits union of claim rings.
 */
export function classifyItemRings(
	claims: ClaimClassification[],
): DiscoveryRing[] {
	const rings = new Set<DiscoveryRing>();
	for (const claim of claims) {
		for (const ring of claim.ringClassification) {
			rings.add(ring);
		}
	}
	return Array.from(rings).sort((a, b) => a - b);
}

/**
 * Validate ring classification consistency.
 * A claim's ring must be compatible with its evidence class.
 */
type RingClassificationInput = Pick<
	ClaimClassification,
	"evidenceClass" | "ringClassification"
>;

export function validateRingClassification(
	claim: RingClassificationInput,
): boolean {
	const expectedRings = mapEvidenceClassToRings(claim.evidenceClass);
	if (expectedRings.length === 0) {
		return claim.ringClassification.length === 0; // UNVERIFIED_CLAIM
	}
	// At least one ring must match expected
	return claim.ringClassification.some((r) => expectedRings.includes(r));
}

// ============================================================================
// Contributor Lifecycle Management
// ============================================================================

/**
 * Evaluate contributor status based on recent signal quality.
 */
export function evaluateContributorStatus(
	contributor: ContributorEntry,
	recentItems: DiscoveredItem[],
	now: string | Temporal.Instant = Temporal.Now.instant().toString(),
): { status: ContributorStatus; rationale: string } {
	// Use epoch milliseconds for date arithmetic to avoid Temporal Instant limitations
	const nowInstant =
		typeof now === "string" ? Temporal.Instant.from(now) : now;
	const nowEpochMs = nowInstant.epochMilliseconds;
	const thirtyDaysAgoMs = nowEpochMs - 30 * 24 * 60 * 60 * 1000;
	const twelveMonthsAgoMs = nowEpochMs - 365 * 24 * 60 * 60 * 1000;
	const sixMonthsAgoMs = nowEpochMs - 182 * 24 * 60 * 60 * 1000;

	// Count recent original contributions

	// Count recent any contributions
	const recentAny = recentItems.filter((item) => {
		const itemDate = Temporal.Instant.from(
			item.publishedAt || item.discoveredAt,
		).epochMilliseconds;
		return itemDate >= thirtyDaysAgoMs;
	}).length;

	// Check channel health
	const activeChannels = contributor.sourceChannels.filter(
		(c) => c.status === "active",
	).length;

	// Mandatory experts never auto-demote from active
	if (contributor.mandatory) {
		if (activeChannels === 0) {
			return {
				status: "watchlisted",
				rationale:
					"Mandatory expert with no active channels; requires investigation",
			};
		}
		return {
			status: "active",
			rationale: "Mandatory expert; active channels maintained",
		};
	}

	// Watchlist evaluation (6-month trial)
	if (contributor.status === "watchlisted") {
		const watchlistDate = contributor.watchlistDate
			? Temporal.Instant.from(contributor.watchlistDate).epochMilliseconds
			: null;
		if (watchlistDate !== null && watchlistDate <= sixMonthsAgoMs) {
			// 6 months elapsed - evaluate for promotion
			const totalOriginal = recentItems.filter(
				(i) => i.evidenceClass === "ORIGINAL_FINDING",
			).length;
			if (totalOriginal >= 3 && activeChannels >= 1) {
				return {
					status: "active",
					rationale:
						"Watchlist period complete; sufficient original contributions and active channels",
				};
			} else if (totalOriginal === 0 && activeChannels === 0) {
				return {
					status: "archived",
					rationale:
						"Watchlist period complete; no original contributions; no active channels",
				};
			}
		}
		return {
			status: "watchlisted",
			rationale: "Under evaluation; 6-month trial period",
		};
	}

	// Active contributor demotion criteria
	if (contributor.status === "active") {
		const twelveMonthOriginal = recentItems.filter((item) => {
			const itemDate = Temporal.Instant.from(
				item.publishedAt || item.discoveredAt,
			).epochMilliseconds;
			return (
				itemDate >= twelveMonthsAgoMs &&
				item.evidenceClass === "ORIGINAL_FINDING"
			);
		}).length;

		if (twelveMonthOriginal === 0 && activeChannels === 0) {
			return {
				status: "archived",
				rationale:
					"No original contributions in 12 months; no active channels",
			};
		}
		if (twelveMonthOriginal === 0 && recentAny === 0) {
			return {
				status: "watchlisted",
				rationale:
					"No recent contributions; monitoring for signal return",
			};
		}
	}

	return { status: contributor.status, rationale: "Status unchanged" };
}

/**
 * Record a status change with provenance.
 */
export function recordStatusChange(
	contributor: ContributorEntry,
	newStatus: ContributorStatus,
	authority: string,
	rationale: string,
): ContributorEntry {
	const change: ClassificationChange = {
		date: Temporal.Now.instant().toString(),
		fromStatus: contributor.status,
		toStatus: newStatus,
		authority,
		rationale,
	};

	return {
		...contributor,
		status: newStatus,
		lastReviewed: Temporal.Now.instant().toString(),
		classificationHistory: [...contributor.classificationHistory, change],
	};
}

// ============================================================================
// Discovery Pipeline Integration
// ============================================================================

/**
 * Process a raw Signal Desk item through classification pipeline.
 */
export function processSignalDeskItem(
	rawItem: Omit<
		DiscoveredItem,
		| "evidenceClass"
		| "ringClassification"
		| "claims"
		| "status"
		| "signalDeskOrigin"
	>,
	contributor: ContributorEntry,
): DiscoveredItem {
	// Build minimal item for classification
	const minimalItem: Pick<
		DiscoveredItem,
		"title" | "summary" | "authors" | "rawMetadata"
	> = {
		title: rawItem.title,
		summary: (rawItem.rawMetadata?.summary as string) || "",
		authors: rawItem.authors,
		rawMetadata: rawItem.rawMetadata,
	};

	// Classify evidence
	const evidenceClass = classifyEvidence(minimalItem, contributor);

	// Map to rings
	const ringClassification = mapEvidenceClassToRings(evidenceClass);

	// Extract claims (simplified: one claim per item for now)
	const claims: ClaimClassification[] = [
		{
			claim: rawItem.summary || rawItem.title,
			evidenceClass,
			ringClassification,
			locator: "full-item",
		},
	];

	// Determine status
	let status: DiscoveredItem["status"] = "new";
	if (evidenceClass === "UNVERIFIED_CLAIM") {
		status = "quarantined";
	}

	return {
		...rawItem,
		contributorId: contributor.id,
		evidenceClass,
		ringClassification,
		claims,
		status,
		signalDeskOrigin: true,
	};
}

/**
 * Aggregate Signal Desk items into candidate news with evidence tracking.
 */
export function aggregateToCandidate(
	items: DiscoveredItem[],
	candidateId: string,
	triageBy: string,
): CandidateNewsItem {
	const allClaims = items.flatMap((i) => i.claims);
	const evidenceClassDistribution: Record<EvidenceClass, number> = {
		ORIGINAL_FINDING: 0,
		FIRST_HAND_DISCLOSURE: 0,
		INDEPENDENT_ANALYSIS: 0,
		EXPERT_INTERPRETATION: 0,
		UNVERIFIED_CLAIM: 0,
	};
	const ringClassificationDistribution: Record<DiscoveryRing, number> = {
		1: 0,
		2: 0,
		3: 0,
	};

	for (const claim of allClaims) {
		evidenceClassDistribution[claim.evidenceClass]++;
		for (const ring of claim.ringClassification) {
			ringClassificationDistribution[ring]++;
		}
	}

	const sourceIds = [...new Set(items.map((i) => i.sourceId))];
	const contributorIds = [
		...new Set(
			items
				.map((i) => i.contributorId)
				.filter((c): c is string => Boolean(c)),
		),
	];
	const researchDomains = [
		...new Set(
			items.flatMap(
				(i) => (i.rawMetadata.researchDomains as string[]) || [],
			),
		),
	];
	const subdomainTags = [
		...new Set(
			items.flatMap(
				(i) => (i.rawMetadata.subdomainTags as string[]) || [],
			),
		),
	];

	return {
		id: candidateId,
		discoveryId: items[0]?.id || "",
		title: items[0]?.title || "Aggregated Signal Desk Items",
		summary: items
			.map((i) => i.summary)
			.filter((s): s is string => typeof s === "string")
			.join("; ")
			.slice(0, 500),
		sourceIds,
		contributorIds,
		proposedType: "daily-brief",
		tier: Math.min(
			...items.map((i) => (i.rawMetadata.tier as number) || 3),
		) as 1 | 2 | 3,
		triageDate: Temporal.Now.instant().toString(),
		triageBy,
		keyClaims: allClaims.map((c) => ({
			claim: c.claim,
			sourceId: items.find((i) => i.claims.includes(c))?.sourceId || "",
			contributorId: items.find((i) => i.claims.includes(c))
				?.contributorId,
			evidenceClass: c.evidenceClass,
			ringClassification: c.ringClassification,
			needsVerification: c.evidenceClass !== "FIRST_HAND_DISCLOSURE",
			proposedLevel:
				c.evidenceClass === "ORIGINAL_FINDING"
					? "L2"
					: ("L1" as "L1" | "L2" | "L3"),
		})),
		relevanceTags: [...new Set(items.flatMap((i) => i.tags || []))],
		researchDomains,
		subdomainTags,
		crossDomainSignals: researchDomains.length > 1,
		evidenceClassDistribution,
		ringClassificationDistribution,
		signalDeskOrigin: true,
		temporalWindowDays: 14,
		status: "proposed",
		assignedVerifier: triageBy,
		notes: `Aggregated from ${items.length} Signal Desk items`,
	};
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate a contributor entry against schema requirements.
 */
export function validateContributorEntry(entry: ContributorEntry): {
	valid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	if (!entry.id || !/^[a-z0-9-]+$/.test(entry.id)) {
		errors.push("Invalid ID format (must be kebab-case)");
	}
	if (!entry.name) {
		errors.push("Name is required");
	}
	if (!entry.verified) {
		errors.push("Contributor must be verified");
	}
	if (!entry.verificationDate) {
		errors.push("Verification date is required");
	}
	if (!entry.sourceChannels || entry.sourceChannels.length === 0) {
		errors.push("At least one source channel is required");
	}
	for (const channel of entry.sourceChannels || []) {
		if (
			![
				"rss",
				"github",
				"youtube",
				"x",
				"linkedin",
				"podcast",
				"arxiv",
				"other",
			].includes(channel.type)
		) {
			errors.push(`Invalid channel type: ${channel.type}`);
		}
		if (!channel.url) {
			errors.push("Channel URL is required");
		}
		if (
			!["active", "limited", "degraded", "inactive"].includes(
				channel.status,
			)
		) {
			errors.push(`Invalid channel status: ${channel.status}`);
		}
	}
	if (!entry.researchDomains || entry.researchDomains.length === 0) {
		errors.push("At least one research domain is required");
	}
	const validDomains = [
		"agentic-ai-software-engineering",
		"models-inference-scientific",
		"architecture-security-governance",
		"enterprise-adoption-organizational",
		"economics-business-impact",
		"independent-research-advisory",
	];
	for (const domain of entry.researchDomains) {
		if (!validDomains.includes(domain)) {
			errors.push(`Invalid research domain: ${domain}`);
		}
	}
	for (const tag of entry.subdomainTags) {
		if (!/^DOM-\d{2}-SD\d{2}$/.test(tag)) {
			errors.push(`Invalid subdomain tag format: ${tag}`);
		}
	}
	for (const ring of entry.ringAffinity) {
		if (![1, 2, 3].includes(ring)) {
			errors.push(`Invalid ring affinity: ${ring}`);
		}
	}
	if (
		!["active", "watchlisted", "archived", "retired"].includes(entry.status)
	) {
		errors.push(`Invalid status: ${entry.status}`);
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Validate a discovered item.
 */
export function validateDiscoveredItem(item: DiscoveredItem): {
	valid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	if (!item.id || !/^disc_[a-z0-9]{16}$/.test(item.id)) {
		errors.push("Invalid discovery ID format");
	}
	if (!item.evidenceClass) {
		errors.push("Evidence class is required");
	}
	if (!item.ringClassification || item.ringClassification.length === 0) {
		if (item.evidenceClass !== "UNVERIFIED_CLAIM") {
			errors.push(
				"Ring classification required for non-unverified items",
			);
		}
	}
	for (const ring of item.ringClassification) {
		if (![1, 2, 3].includes(ring)) {
			errors.push(`Invalid ring: ${ring}`);
		}
	}
	if (
		!validateRingClassification({
			evidenceClass: item.evidenceClass,
			ringClassification: item.ringClassification,
		})
	) {
		errors.push(
			`Ring classification incompatible with evidence class: ${item.evidenceClass} -> ${item.ringClassification}`,
		);
	}
	for (const claim of item.claims) {
		if (!validateRingClassification(claim)) {
			errors.push(
				`Claim ring classification incompatible: ${claim.evidenceClass} -> ${claim.ringClassification}`,
			);
		}
	}

	return { valid: errors.length === 0, errors };
}

// ============================================================================
// Export all types and functions
// ============================================================================

// Types are exported at their declarations above.
