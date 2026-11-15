/**
 * Canonical Fact Dossier — Test Fixtures
 *
 * SYNTHETIC TEST DATA. Every candidate, discovery, claim and source below is
 * invented for regression testing. Nothing in this file is a real research
 * finding, vendor announcement or editorial judgement.
 *
 * The fixtures cover the representative cases required by the dossier
 * specification:
 *   1. Official AI model / coding-agent release
 *   2. Original scientific research paper
 *   3. Accessible Gartner/McKinsey/Forrester/IDC finding
 *   4. Vendor productivity / economic-impact claim
 *   5. New original reporting about an older event
 *   6. Previously reported development receiving a substantive update
 *   7. Candidate with contradictory evidence or unresolved publication timing
 *   plus CATCH_UP and NEW_FAIL (repost) cases.
 */

import crypto from "crypto";

import type { CandidateNewsItem, DiscoveredItem } from "../signal-desk.js";
import type {
	ClaimVerificationRecord,
	EvidenceReference,
} from "../evidence-verification/types.js";
import type { EditorialWindow } from "../editorial-window.js";
import { getEditorialWindow } from "../editorial-window.js";
import type {
	CandidateConsolidationInput,
	ConsolidationContext,
	SourceRegistryEntry,
} from "./consolidator.js";
import type {
	EvidenceClassification,
	TemporalEligibilityStatus,
	VerificationStatus,
} from "./schema.js";

export const EDITION_DATE = "2025-01-15";
export const EDITION_WINDOW: EditorialWindow = getEditorialWindow(EDITION_DATE);

export const TAXONOMY_DOMAINS = new Set([
	"agentic-ai-software-engineering",
	"models-inference-scientific",
	"architecture-security-governance",
	"enterprise-adoption-organizational",
	"economics-business-impact",
	"independent-research-advisory",
]);

let counter = 0;
/** Deterministic 16-hex identifier with the given prefix. */
export function stableId(prefix: "cand" | "claim" | "disc" | "ev"): string {
	counter += 1;
	const hash = crypto
		.createHash("sha256")
		.update(`${prefix}:${counter}`)
		.digest("hex")
		.slice(0, 16);
	return `${prefix}_${hash}`;
}

// ============================================================================
// Evidence reference builder
// ============================================================================

export function createMockEvidence(
	overrides: Partial<EvidenceReference> = {},
): EvidenceReference {
	const now = "2025-01-15T06:00:00Z";
	return {
		id: overrides.id ?? stableId("ev"),
		sourceId: overrides.sourceId ?? "test-source",
		classification: overrides.classification ?? "VERIFIED_FACT",
		url: overrides.url ?? "https://example.com/source",
		locator: overrides.locator ?? "section 1",
		extractedText:
			overrides.extractedText ?? "Synthetic test evidence text.",
		timestamp: overrides.timestamp ?? now,
		timestampType: overrides.timestampType ?? "original-publication",
		sourceTimezone: overrides.sourceTimezone ?? "UTC",
		confidence: overrides.confidence ?? 0.9,
		tier: overrides.tier ?? 1,
		evidenceRole: overrides.evidenceRole ?? "primary",
		applicableMethods: overrides.applicableMethods ?? [
			"primary-source-inspection",
		],
		limitations: overrides.limitations,
		retrievalMetadata: overrides.retrievalMetadata ?? {
			retrievedAt: now,
			retrievalMethod: "automated-collection",
			contentHash: `sha256:${crypto.createHash("sha256").update("evidence").digest("hex")}`,
		},
	};
}

// ============================================================================
// Claim verification record builder
// ============================================================================

export function createMockClaim(
	overrides: Partial<ClaimVerificationRecord> = {},
): ClaimVerificationRecord {
	const now = "2025-01-15T06:00:00Z";
	const candidateId = overrides.candidateId ?? "cand_0000000000000001";
	return {
		id: overrides.id ?? stableId("claim"),
		candidateId,
		candidateStableId: overrides.candidateStableId ?? candidateId,
		claim: overrides.claim ?? "Synthetic test claim.",
		claimType: overrides.claimType ?? "technical-announcement",
		originalSource: overrides.originalSource ?? {
			sourceId: "test-source",
			url: "https://example.com/source",
			title: "Synthetic Test Source",
			publicationTimestamp: now,
		},
		supportingEvidence: overrides.supportingEvidence ?? [
			createMockEvidence(),
		],
		counterevidence: overrides.counterevidence ?? [],
		assumptions: overrides.assumptions ?? [],
		alternativeExplanations: overrides.alternativeExplanations ?? [],
		falsificationCriteria: overrides.falsificationCriteria ?? [],
		unresolvedUncertainties: overrides.unresolvedUncertainties ?? [],
		evidenceClassification:
			overrides.evidenceClassification ?? "VERIFIED_FACT",
		verificationStatus: overrides.verificationStatus ?? "verified",
		verificationMethods: overrides.verificationMethods ?? [
			"primary-source-inspection",
		],
		confidence: overrides.confidence ?? 0.9,
		verificationLevel: overrides.verificationLevel ?? "L1",
		verificationDetails: overrides.verificationDetails,
		temporalVerification: overrides.temporalVerification ?? {
			originalPublicationTimestamp: now,
			retrievalTimestamp: now,
			indexingTimestamp: now,
			timezonePrecision: "exact",
			timestampConfidence: 0.95,
		},
		productContext: overrides.productContext,
		technicalContext: overrides.technicalContext,
		scientificContext: overrides.scientificContext,
		researchContext: overrides.researchContext,
		enterpriseContext: overrides.enterpriseContext,
		verifiedAt: overrides.verifiedAt ?? now,
		verifiedBy: overrides.verifiedBy ?? "synthetic-verifier",
		verificationDurationMs: overrides.verificationDurationMs ?? 100,
		revisionHistory: overrides.revisionHistory ?? [],
	};
}

// ============================================================================
// Candidate / discovery builders
// ============================================================================

export function createMockCandidate(
	overrides: Partial<CandidateNewsItem> = {},
): CandidateNewsItem {
	const id = overrides.id ?? stableId("cand");
	return {
		id,
		discoveryId: overrides.discoveryId ?? stableId("disc"),
		title: overrides.title ?? "Synthetic test candidate",
		summary:
			overrides.summary ??
			"Synthetic test summary describing a material change.",
		sourceIds: overrides.sourceIds ?? ["test-source"],
		contributorIds: overrides.contributorIds ?? [],
		proposedType: overrides.proposedType ?? "daily-brief",
		tier: overrides.tier ?? 1,
		triageDate: overrides.triageDate ?? "2025-01-15T07:00:00Z",
		triageBy: overrides.triageBy ?? "editor-test",
		keyClaims: overrides.keyClaims ?? [],
		relevanceTags: overrides.relevanceTags ?? ["synthetic", "test"],
		researchDomains: overrides.researchDomains ?? [
			"agentic-ai-software-engineering",
		],
		subdomainTags: overrides.subdomainTags ?? [],
		crossDomainSignals: overrides.crossDomainSignals ?? false,
		evidenceClassDistribution: overrides.evidenceClassDistribution ?? {
			ORIGINAL_FINDING: 0,
			FIRST_HAND_DISCLOSURE: 1,
			INDEPENDENT_ANALYSIS: 0,
			EXPERT_INTERPRETATION: 0,
			UNVERIFIED_CLAIM: 0,
		},
		ringClassificationDistribution:
			overrides.ringClassificationDistribution ?? { 1: 1, 2: 0, 3: 0 },
		signalDeskOrigin: overrides.signalDeskOrigin ?? false,
		temporalWindowDays: overrides.temporalWindowDays ?? 14,
		status: overrides.status ?? "proposed",
		assignedAuthor: overrides.assignedAuthor,
		assignedVerifier: overrides.assignedVerifier,
		deadline: overrides.deadline,
		notes: overrides.notes,
	};
}

export function createMockDiscovery(
	overrides: Partial<DiscoveredItem> = {},
): DiscoveredItem {
	return {
		id: overrides.id ?? stableId("disc"),
		sourceId: overrides.sourceId ?? "test-source",
		discoveredAt: overrides.discoveredAt ?? "2025-01-15T06:15:00Z",
		title: overrides.title ?? "Synthetic test discovery",
		url: overrides.url ?? "https://example.com/article",
		contentHash:
			overrides.contentHash ??
			`sha256:${crypto.createHash("sha256").update("discovery").digest("hex")}`,
		publishedAt:
			overrides.publishedAt ??
			"2025-01-14T12:00:00+01:00[Europe/Amsterdam]",
		firstDisclosedAt: overrides.firstDisclosedAt,
		eventDate: overrides.eventDate,
		lastUpdatedAt: overrides.lastUpdatedAt,
		sourceTimezone: overrides.sourceTimezone ?? "Europe/Amsterdam",
		timestampConfidence: overrides.timestampConfidence ?? 0.95,
		authors: overrides.authors ?? ["Synthetic Author"],
		rawMetadata: overrides.rawMetadata ?? {},
		summary: overrides.summary ?? "Synthetic test summary.",
		tags: overrides.tags ?? ["synthetic", "test"],
		language: overrides.language ?? "en",
		evidenceClass: overrides.evidenceClass ?? "FIRST_HAND_DISCLOSURE",
		ringClassification: overrides.ringClassification ?? [1],
		claims: overrides.claims ?? [],
		status: overrides.status ?? "new",
		signalDeskOrigin: overrides.signalDeskOrigin ?? false,
		candidateId: overrides.candidateId,
		duplicateOf: overrides.duplicateOf,
		triageNotes: overrides.triageNotes,
		contributorId: overrides.contributorId,
		...overrides,
	};
}

// ============================================================================
// Source registry / context
// ============================================================================

export function createSourceRegistry(): Map<string, SourceRegistryEntry> {
	const entries: SourceRegistryEntry[] = [
		{
			id: "github-copilot-vscode",
			tier: 2,
			type: "rss",
			url: "https://github.blog/changelog/feed/",
			title: "GitHub Blog Changelog",
			status: "active",
		},
		{
			id: "arxiv-cs-lg",
			tier: 1,
			type: "arxiv",
			url: "https://arxiv.org/rss/cs.LG",
			title: "arXiv cs.LG",
			status: "active",
		},
		{
			id: "mckinsey-insights",
			tier: 2,
			type: "blog",
			url: "https://www.mckinsey.com/insights/rss",
			title: "McKinsey Insights",
			status: "active",
		},
		{
			id: "mit-technology-review-ai",
			tier: 2,
			type: "blog",
			url: "https://www.technologyreview.com/topic/artificial-intelligence/feed",
			title: "MIT Technology Review AI",
			status: "active",
		},
		{
			id: "anthropic-claude-code",
			tier: 2,
			type: "rss",
			url: "https://code.claude.com/docs/en/changelog/rss.xml",
			title: "Claude Code Changelog",
			status: "active",
		},
		{
			id: "vendor-benchmark",
			tier: 3,
			type: "blog",
			url: "https://vendor.example.com/blog",
			title: "Synthetic Vendor Blog",
			status: "active",
		},
		{
			id: "test-source",
			tier: 1,
			type: "blog",
			url: "https://example.com/source",
			title: "Synthetic Test Source",
			status: "active",
		},
	];
	return new Map(entries.map((e) => [e.id, e]));
}

export function createContext(
	overrides: Partial<ConsolidationContext> = {},
): ConsolidationContext {
	return {
		editionDate: EDITION_DATE,
		editionWindow: EDITION_WINDOW,
		taxonomyDomains: TAXONOMY_DOMAINS,
		sourceRegistry: createSourceRegistry(),
		previousEditions: { availableEditionDates: new Set(), candidates: [] },
		generatedBy: "synthetic-consolidator-test",
		now: "2025-01-15T06:30:00Z",
		...overrides,
	};
}

// ============================================================================
// Representative fixtures
// ============================================================================

export interface RepresentativeFixture {
	key: string;
	label: string;
	input: CandidateConsolidationInput;
	expected: {
		temporalStatus: TemporalEligibilityStatus;
		classification?: EvidenceClassification;
		verificationStatus?: VerificationStatus;
		verificationLevel?: "L0" | "L1" | "L2" | "L3";
	};
}

export const IN_WINDOW = "2025-01-14T12:00:00+01:00[Europe/Amsterdam]";

export function createRepresentativeFixtures(): RepresentativeFixture[] {
	const fixtures: RepresentativeFixture[] = [];

	// ------------------------------------------------------------------------
	// 1. Official AI coding-agent release (vendor announcement)
	// ------------------------------------------------------------------------
	{
		const candidateId = "cand_0000000000000001";
		const claimId = "claim_0000000000000001";
		fixtures.push({
			key: "coding-agent-release",
			label: "Official AI coding-agent release",
			input: {
				candidate: createMockCandidate({
					id: candidateId,
					discoveryId: "disc_0000000000000001",
					title: "GitHub Copilot coding agent adds background delegation",
					summary:
						"GitHub Copilot coding agent now delegates tasks to background agents with checkpointing.",
					sourceIds: ["github-copilot-vscode"],
					tier: 2,
					researchDomains: ["agentic-ai-software-engineering"],
					subdomainTags: ["DOM-01-SD03"],
					ringClassificationDistribution: { 1: 0, 2: 0, 3: 1 },
					keyClaims: [],
				}),
				discovery: createMockDiscovery({
					id: "disc_0000000000000001",
					sourceId: "github-copilot-vscode",
					publishedAt: IN_WINDOW,
					firstDisclosedAt: IN_WINDOW,
					url: "https://github.blog/changelog/copilot-coding-agent-background-delegation",
					title: "GitHub Copilot coding agent adds background delegation",
				}),
				claims: [
					createMockClaim({
						id: claimId,
						candidateId,
						claim: "GitHub Copilot coding agent now delegates tasks to background agents with checkpointing.",
						claimType: "vendor-announcement",
						originalSource: {
							sourceId: "github-copilot-vscode",
							url: "https://github.blog/changelog/copilot-coding-agent-background-delegation",
							title: "GitHub Copilot coding agent adds background delegation",
							publicationTimestamp: IN_WINDOW,
							firstDisclosureTimestamp: IN_WINDOW,
						},
						evidenceClassification: "VENDOR_CLAIM",
						verificationStatus: "unverified",
						verificationLevel: "L0",
						confidence: 0.5,
						supportingEvidence: [
							createMockEvidence({
								sourceId: "github-copilot-vscode",
								url: "https://github.blog/changelog/copilot-coding-agent-background-delegation",
								extractedText:
									"Starting today, Copilot coding agent can delegate tasks to background agents. Rollout begins today for Enterprise users.",
								timestamp: IN_WINDOW,
								timestampType: "original-publication",
								classification: "VENDOR_CLAIM",
								tier: 2,
							}),
						],
						technicalContext: {
							implementationStatus: "preview",
							technicalMechanism:
								"Background agent delegation with checkpointed sessions.",
							capabilities: [
								"background task delegation",
								"checkpointing",
							],
							agenticImplications: [
								"Enables asynchronous multi-step coding workflows.",
							],
						},
						productContext: {
							productName: "GitHub Copilot coding agent",
							version: "unknown",
							releaseMaturity: "preview",
							availability: "limited",
							rolloutRestrictions: [
								"Phased rollout begins with Enterprise users.",
							],
						},
						temporalVerification: {
							originalPublicationTimestamp: IN_WINDOW,
							firstPublicDisclosureTimestamp: IN_WINDOW,
							retrievalTimestamp: "2025-01-15T06:00:00Z",
							indexingTimestamp: "2025-01-15T06:00:00Z",
							timezonePrecision: "exact",
							timestampConfidence: 0.95,
						},
					}),
				],
				entityHints: {
					organizations: ["GitHub"],
					products: ["GitHub Copilot coding agent"],
					technologies: ["background agents", "checkpointing"],
				},
			},
			expected: {
				temporalStatus: "NEW_PASS",
				classification: "VENDOR_CLAIM",
				verificationStatus: "unverified",
				verificationLevel: "L0",
			},
		});
	}

	// ------------------------------------------------------------------------
	// 2. Original scientific research paper
	// ------------------------------------------------------------------------
	{
		const candidateId = "cand_0000000000000002";
		const claimId = "claim_0000000000000002";
		fixtures.push({
			key: "scientific-paper",
			label: "Original scientific research paper",
			input: {
				candidate: createMockCandidate({
					id: candidateId,
					discoveryId: "disc_0000000000000002",
					title: "Mixture-of-Experts scaling laws show sublinear expert growth",
					summary:
						"A synthetic study derives scaling laws for Mixture-of-Experts models with documented methodology.",
					sourceIds: ["arxiv-cs-lg"],
					tier: 1,
					researchDomains: ["models-inference-scientific"],
					subdomainTags: ["DOM-02-SD01"],
					ringClassificationDistribution: { 1: 0, 2: 1, 3: 0 },
				}),
				discovery: createMockDiscovery({
					id: "disc_0000000000000002",
					sourceId: "arxiv-cs-lg",
					publishedAt: "2025-01-14T18:00:00+01:00[Europe/Amsterdam]",
					firstDisclosedAt:
						"2025-01-14T18:00:00+01:00[Europe/Amsterdam]",
					url: "https://arxiv.org/abs/2501.12345",
					title: "Mixture-of-Experts scaling laws",
				}),
				claims: [
					createMockClaim({
						id: claimId,
						candidateId,
						claim: "Optimal Mixture-of-Experts count scales sublinearly with model size under the synthetic study conditions.",
						claimType: "scientific-research",
						originalSource: {
							sourceId: "arxiv-cs-lg",
							url: "https://arxiv.org/abs/2501.12345",
							title: "Mixture-of-Experts scaling laws",
							publicationTimestamp:
								"2025-01-14T18:00:00+01:00[Europe/Amsterdam]",
						},
						evidenceClassification: "RESEARCH_FINDING",
						verificationStatus: "verified",
						verificationLevel: "L2",
						confidence: 0.9,
						supportingEvidence: [
							createMockEvidence({
								sourceId: "arxiv-cs-lg",
								url: "https://arxiv.org/abs/2501.12345",
								locator: "Section 4.2, Table 2",
								extractedText:
									"Synthetic methodology: controlled experiments on 8x H100, bfloat16, batch size 64. Code available at github.com/synthetic/moe-scaling.",
								timestamp:
									"2025-01-14T18:00:00+01:00[Europe/Amsterdam]",
								timestampType: "original-publication",
								classification: "RESEARCH_FINDING",
								tier: 1,
								applicableMethods: [
									"methodology-review",
									"artifact-reproduction",
								],
							}),
						],
						scientificContext: {
							studyDesign:
								"Controlled scaling experiments with fixed compute budget.",
							methodology:
								"Synthetic controlled experiments on 8x H100, bfloat16, batch size 64.",
							dataset: "Synthetic C4-derived validation set.",
							evaluationConditions:
								"Perplexity on held-out validation set.",
							reproducibility: {
								artifactAvailable: true,
								artifactUrl:
									"https://github.com/synthetic/moe-scaling",
								independentReplications: 0,
								replicationResults: undefined,
							},
							benchmarkMethodology: {
								warmupRuns: true,
								batchSize: 64,
								precision: "bfloat16",
								hardwareSpecified: true,
								confoundersAddressed: [
									"thermal throttling",
									"network variance",
								],
							},
						},
						temporalVerification: {
							originalPublicationTimestamp:
								"2025-01-14T18:00:00+01:00[Europe/Amsterdam]",
							firstPublicDisclosureTimestamp:
								"2025-01-14T18:00:00+01:00[Europe/Amsterdam]",
							retrievalTimestamp: "2025-01-15T06:00:00Z",
							indexingTimestamp: "2025-01-15T06:00:00Z",
							timezonePrecision: "exact",
							timestampConfidence: 0.95,
						},
					}),
				],
				entityHints: {
					organizations: ["Synthetic Research Lab"],
					technologies: ["Mixture-of-Experts", "scaling laws"],
					researchProjects: ["synthetic-moe-scaling"],
				},
			},
			expected: {
				temporalStatus: "NEW_PASS",
				classification: "RESEARCH_FINDING",
				verificationStatus: "verified",
				verificationLevel: "L2",
			},
		});
	}

	// ------------------------------------------------------------------------
	// 3. Accessible advisory finding (McKinsey MGI)
	// ------------------------------------------------------------------------
	{
		const candidateId = "cand_0000000000000003";
		const claimId = "claim_0000000000000003";
		fixtures.push({
			key: "advisory-finding",
			label: "Accessible McKinsey MGI finding",
			input: {
				candidate: createMockCandidate({
					id: candidateId,
					discoveryId: "disc_0000000000000003",
					title: "Synthetic advisory finding on generative AI economic potential",
					summary:
						"A synthetic advisory study estimates generative AI economic potential with disclosed methodology.",
					sourceIds: ["mckinsey-insights"],
					tier: 2,
					researchDomains: [
						"economics-business-impact",
						"independent-research-advisory",
					],
					subdomainTags: ["DOM-06-SD01", "DOM-05-SD02"],
					ringClassificationDistribution: { 1: 0, 2: 1, 3: 0 },
					crossDomainSignals: true,
				}),
				discovery: createMockDiscovery({
					id: "disc_0000000000000003",
					sourceId: "mckinsey-insights",
					publishedAt: IN_WINDOW,
					firstDisclosedAt: IN_WINDOW,
					url: "https://www.mckinsey.com/insights/synthetic-generative-ai-economic-potential",
					title: "Synthetic advisory finding",
				}),
				claims: [
					createMockClaim({
						id: claimId,
						candidateId,
						claim: "Generative AI could add a synthetic $2.6T-$4.4T annually across 63 use cases.",
						claimType: "advisory-finding",
						originalSource: {
							sourceId: "mckinsey-insights",
							url: "https://www.mckinsey.com/insights/synthetic-generative-ai-economic-potential",
							title: "Synthetic economic potential of generative AI",
							publisher: "McKinsey Global Institute",
							publicationTimestamp: IN_WINDOW,
						},
						evidenceClassification: "EXPERT_INTERPRETATION",
						verificationStatus: "partially-verified",
						verificationLevel: "L1",
						confidence: 0.7,
						supportingEvidence: [
							createMockEvidence({
								sourceId: "mckinsey-insights",
								url: "https://www.mckinsey.com/insights/synthetic-generative-ai-economic-potential",
								locator:
									"Executive summary and methodology appendix",
								extractedText:
									"Synthetic MGI analysis estimates generative AI could add $2.6T-$4.4T annually across 63 use cases. Methodology: use case sizing, adoption curves, productivity modeling. Survey of 1000+ organizations. Full methodology in appendix (client access required).",
								timestamp: IN_WINDOW,
								timestampType: "original-publication",
								classification: "EXPERT_INTERPRETATION",
								tier: 2,
								applicableMethods: [
									"methodology-review",
									"paywall-accessible-review",
								],
							}),
						],
						alternativeExplanations: [
							{
								id: "alt_0000000000000001",
								claimId,
								explanation:
									"Correlation may reflect a third variable driving both AI adoption and revenue growth, not direct causation.",
								type: "different-causal-mechanism",
								plausibility: "medium",
							},
						],
						researchContext: {
							researchPurpose:
								"Estimate the economic potential of generative AI across industries.",
							researchDesign:
								"Use case sizing with adoption curves and productivity modeling.",
							sampleSize: 1000,
							sampleComposition:
								"Survey of 1000+ organizations across 15 industries.",
							geographicScope: "Global",
							industryCoverage: "15 industries",
							researchPeriod: "2023 to 2024",
							statisticalUncertainty:
								"Estimates span $2.6T-$4.4T; confidence intervals not disclosed in public summary.",
							methodologicalLimitations: [
								"Public summary only; full methodology paywalled.",
							],
							fundingSources: ["McKinsey Global Institute"],
							conflictsOfInterest: [
								"Consulting engagements with subject vendors possible.",
							],
							causalClaimType: "prediction",
							generalizabilityAssessment:
								"Estimates depend on adoption curves and productivity modeling choices; not a universal forecast.",
							paywallDetails: {
								accessibleSections: [
									"executive summary",
									"methodology summary",
								],
								inaccessibleSections: ["full methodology"],
								methodologyVerifiable: true,
							},
						},
						enterpriseContext: {
							measuredOutcome:
								"Potential annual value of $2.6T-$4.4T across 63 use cases.",
							baseline:
								"Current-state operations without generative AI.",
							individualVsTeamVsOrg: "organizational",
							economicImpact: [
								"Potential $2.6T-$4.4T annual value.",
							],
							workforceImplications: [
								"Workforce transformation implications noted.",
							],
							governanceImplications: [
								"Governance and oversight implications noted.",
							],
							roi: "Not stated as a single ROI figure.",
							totalCostOfOwnership:
								"Implementation, inference and governance costs not itemized in public summary.",
							realizedVsEstimatedVsProjected: "projected",
							shortTermVsSustained: "unknown",
						},
						temporalVerification: {
							originalPublicationTimestamp: IN_WINDOW,
							firstPublicDisclosureTimestamp: IN_WINDOW,
							retrievalTimestamp: "2025-01-15T06:00:00Z",
							indexingTimestamp: "2025-01-15T06:00:00Z",
							timezonePrecision: "exact",
							timestampConfidence: 0.9,
						},
					}),
				],
				entityHints: {
					organizations: ["McKinsey Global Institute"],
					technologies: ["generative AI"],
					researchProjects: [
						"synthetic-generative-ai-economic-potential",
					],
				},
			},
			expected: {
				temporalStatus: "NEW_PASS",
				classification: "EXPERT_INTERPRETATION",
				verificationStatus: "partially-verified",
				verificationLevel: "L1",
			},
		});
	}

	// ------------------------------------------------------------------------
	// 4. Vendor productivity / economic-impact claim
	// ------------------------------------------------------------------------
	{
		const candidateId = "cand_0000000000000004";
		const claimId = "claim_0000000000000004";
		fixtures.push({
			key: "vendor-productivity-claim",
			label: "Vendor productivity / economic-impact claim",
			input: {
				candidate: createMockCandidate({
					id: candidateId,
					discoveryId: "disc_0000000000000004",
					title: "Synthetic vendor study claims 55% faster task completion",
					summary:
						"A synthetic vendor study reports faster task completion with a coding assistant.",
					sourceIds: ["github-copilot-vscode"],
					tier: 2,
					researchDomains: ["enterprise-adoption-organizational"],
					subdomainTags: ["DOM-04-SD02"],
					ringClassificationDistribution: { 1: 0, 2: 0, 3: 1 },
				}),
				discovery: createMockDiscovery({
					id: "disc_0000000000000004",
					sourceId: "github-copilot-vscode",
					publishedAt: IN_WINDOW,
					firstDisclosedAt: IN_WINDOW,
					url: "https://github.blog/research/synthetic-copilot-productivity-study",
					title: "Synthetic vendor productivity study",
				}),
				claims: [
					createMockClaim({
						id: claimId,
						candidateId,
						claim: "Developers using the synthetic coding assistant complete tasks 55% faster.",
						claimType: "productivity-claim",
						originalSource: {
							sourceId: "github-copilot-vscode",
							url: "https://github.blog/research/synthetic-copilot-productivity-study",
							title: "Synthetic vendor productivity study",
							publisher: "GitHub",
							publicationTimestamp: IN_WINDOW,
						},
						evidenceClassification: "VENDOR_CLAIM",
						verificationStatus: "unverified",
						verificationLevel: "L0",
						confidence: 0.5,
						supportingEvidence: [
							createMockEvidence({
								sourceId: "github-copilot-vscode",
								url: "https://github.blog/research/synthetic-copilot-productivity-study",
								extractedText:
									"Synthetic controlled experiment with 95 developers. Task: implement HTTP server in JavaScript. Copilot group: 55% faster completion. Baseline: control group without the assistant. Implementation cost: $19/user/month. Inference cost: covered by vendor.",
								timestamp: IN_WINDOW,
								timestampType: "original-publication",
								classification: "VENDOR_CLAIM",
								tier: 2,
							}),
						],
						enterpriseContext: {
							measuredOutcome:
								"55% faster task completion (1.2h vs 2.7h).",
							operationalDefinition:
								"Task completion time for a standardized HTTP server task.",
							baseline:
								"Control group without the coding assistant.",
							comparisonGroup: "Randomized control group.",
							individualVsTeamVsOrg: "individual",
							implementationCosts: "$19/user/month subscription.",
							inferenceCosts: "Covered by vendor; not itemized.",
							selectionBias:
								"Participants were volunteers; self-selection possible.",
							confoundingVariables: [
								"Prior familiarity with the assistant.",
							],
							shortTermVsSustained: "short-term",
							realizedVsEstimatedVsProjected: "realized",
							productivityConsequences: [
								"55% faster task completion in a synthetic study.",
							],
							economicImpact: [
								"Implementation cost of $19/user/month.",
							],
							workforceImplications: [
								"Role impact not assessed.",
							],
							governanceImplications: [
								"Governance costs not assessed.",
							],
						},
						temporalVerification: {
							originalPublicationTimestamp: IN_WINDOW,
							firstPublicDisclosureTimestamp: IN_WINDOW,
							retrievalTimestamp: "2025-01-15T06:00:00Z",
							indexingTimestamp: "2025-01-15T06:00:00Z",
							timezonePrecision: "exact",
							timestampConfidence: 0.9,
						},
					}),
				],
				entityHints: {
					organizations: ["GitHub"],
					products: ["Synthetic coding assistant"],
					technologies: ["coding assistant"],
				},
			},
			expected: {
				temporalStatus: "NEW_PASS",
				classification: "VENDOR_CLAIM",
				verificationStatus: "unverified",
				verificationLevel: "L0",
			},
		});
	}

	// ------------------------------------------------------------------------
	// 5. New original reporting about an older event
	// ------------------------------------------------------------------------
	{
		const candidateId = "cand_0000000000000005";
		const claimId = "claim_0000000000000005";
		const publication = "2025-01-14T14:00:00+01:00[Europe/Amsterdam]";
		const eventDate = "2023-03-15T00:00:00Z";
		fixtures.push({
			key: "original-reporting-older-event",
			label: "New original reporting about an older event",
			input: {
				candidate: createMockCandidate({
					id: candidateId,
					discoveryId: "disc_0000000000000005",
					title: "Exclusive: synthetic cloud provider hid 2023 breach",
					summary:
						"Original reporting reveals a synthetic 2023 data breach that was not publicly disclosed at the time.",
					sourceIds: ["mit-technology-review-ai"],
					tier: 2,
					researchDomains: ["architecture-security-governance"],
					subdomainTags: ["DOM-03-SD03"],
					ringClassificationDistribution: { 1: 0, 2: 1, 3: 0 },
				}),
				discovery: createMockDiscovery({
					id: "disc_0000000000000005",
					sourceId: "mit-technology-review-ai",
					publishedAt: publication,
					firstDisclosedAt: publication,
					eventDate,
					url: "https://www.technologyreview.com/synthetic/cloud-provider-2023-breach",
					title: "Exclusive: synthetic cloud provider hid 2023 breach",
				}),
				claims: [
					createMockClaim({
						id: claimId,
						candidateId,
						claim: "A synthetic cloud provider experienced an unreported 2023 data breach affecting 10M users.",
						claimType: "original-reporting",
						originalSource: {
							sourceId: "mit-technology-review-ai",
							url: "https://www.technologyreview.com/synthetic/cloud-provider-2023-breach",
							title: "Exclusive: synthetic cloud provider hid 2023 breach",
							publisher: "MIT Technology Review",
							publicationTimestamp: publication,
							firstDisclosureTimestamp: publication,
						},
						evidenceClassification: "ORIGINAL_REPORTING",
						verificationStatus: "verified",
						verificationLevel: "L1",
						confidence: 0.8,
						supportingEvidence: [
							createMockEvidence({
								sourceId: "mit-technology-review-ai",
								url: "https://www.technologyreview.com/synthetic/cloud-provider-2023-breach",
								extractedText:
									"According to internal documents and three former employees, the breach occurred in March 2023 but was not disclosed.",
								timestamp: publication,
								timestampType: "first-public-disclosure",
								classification: "ORIGINAL_REPORTING",
								tier: 2,
							}),
							createMockEvidence({
								sourceId: "mit-technology-review-ai",
								url: "https://www.technologyreview.com/synthetic/cloud-provider-2023-breach-documents",
								extractedText:
									"Internal documents dated March 15, 2023 show the security team identified the breach.",
								timestamp: eventDate,
								timestampType: "underlying-event",
								evidenceRole: "corroborating",
								classification: "ORIGINAL_REPORTING",
								tier: 2,
							}),
						],
						temporalVerification: {
							originalPublicationTimestamp: publication,
							firstPublicDisclosureTimestamp: publication,
							underlyingEventTimestamp: eventDate,
							retrievalTimestamp: "2025-01-15T06:00:00Z",
							indexingTimestamp: "2025-01-15T06:00:00Z",
							timezonePrecision: "exact",
							timestampConfidence: 0.9,
						},
					}),
				],
				entityHints: {
					organizations: ["Synthetic Cloud Provider"],
					products: ["Synthetic Cloud"],
					technologies: ["cloud infrastructure"],
				},
			},
			expected: {
				temporalStatus: "NEW_PASS",
				classification: "ORIGINAL_REPORTING",
				verificationStatus: "verified",
				verificationLevel: "L1",
			},
		});
	}

	// ------------------------------------------------------------------------
	// 6. Previously reported development receiving a substantive update
	// ------------------------------------------------------------------------
	{
		const candidateId = "cand_0000000000000006";
		const claimId = "claim_0000000000000006";
		fixtures.push({
			key: "substantive-update",
			label: "Previously reported development receiving a substantive update",
			input: {
				candidate: createMockCandidate({
					id: candidateId,
					discoveryId: "disc_0000000000000006",
					title: "Claude Code changelog: MCP task support and checkpointing",
					summary:
						"A synthetic changelog entry adds MCP task support and checkpointing to Claude Code.",
					sourceIds: ["anthropic-claude-code"],
					tier: 2,
					researchDomains: ["agentic-ai-software-engineering"],
					subdomainTags: ["DOM-01-SD03"],
					ringClassificationDistribution: { 1: 1, 2: 0, 3: 0 },
				}),
				discovery: createMockDiscovery({
					id: "disc_0000000000000006",
					sourceId: "anthropic-claude-code",
					publishedAt: IN_WINDOW,
					firstDisclosedAt: IN_WINDOW,
					lastUpdatedAt: IN_WINDOW,
					url: "https://code.claude.com/docs/en/changelog/synthetic-mcp-task-support",
					title: "Claude Code changelog: MCP task support and checkpointing",
				}),
				claims: [
					createMockClaim({
						id: claimId,
						candidateId,
						claim: "Claude Code now supports MCP task delegation and checkpointing for autonomous development.",
						claimType: "software-release",
						originalSource: {
							sourceId: "anthropic-claude-code",
							url: "https://code.claude.com/docs/en/changelog/synthetic-mcp-task-support",
							title: "Claude Code changelog: MCP task support and checkpointing",
							publicationTimestamp: IN_WINDOW,
						},
						evidenceClassification: "VENDOR_CLAIM",
						verificationStatus: "unverified",
						verificationLevel: "L0",
						confidence: 0.5,
						supportingEvidence: [
							createMockEvidence({
								sourceId: "anthropic-claude-code",
								url: "https://code.claude.com/docs/en/changelog/synthetic-mcp-task-support",
								extractedText:
									"Synthetic changelog: Claude Code adds MCP task support and checkpointing for autonomous development workflows.",
								timestamp: IN_WINDOW,
								timestampType: "substantive-update",
								classification: "VENDOR_CLAIM",
								tier: 2,
							}),
						],
						technicalContext: {
							implementationStatus: "released",
							technicalMechanism:
								"MCP task delegation with checkpointed sessions.",
							agenticImplications: [
								"Supports resumable autonomous development workflows.",
							],
						},
						temporalVerification: {
							originalPublicationTimestamp: IN_WINDOW,
							firstPublicDisclosureTimestamp: IN_WINDOW,
							substantiveUpdateTimestamp: IN_WINDOW,
							retrievalTimestamp: "2025-01-15T06:00:00Z",
							indexingTimestamp: "2025-01-15T06:00:00Z",
							timezonePrecision: "exact",
							timestampConfidence: 0.95,
						},
					}),
				],
				noveltyHints: {
					isKnownUpdate: true,
					updateDescription:
						"Added MCP task support and checkpointing for autonomous development.",
				},
				entityHints: {
					organizations: ["Anthropic"],
					products: ["Claude Code"],
					technologies: ["MCP", "checkpointing"],
				},
			},
			expected: {
				temporalStatus: "NEW_PASS",
				classification: "VENDOR_CLAIM",
				verificationStatus: "unverified",
				verificationLevel: "L0",
			},
		});
	}

	// ------------------------------------------------------------------------
	// 7. Contradictory evidence / unresolved publication timing
	// ------------------------------------------------------------------------
	{
		const candidateId = "cand_0000000000000007";
		const claimId = "claim_0000000000000007";
		fixtures.push({
			key: "contradictory-evidence",
			label: "Candidate with contradictory evidence",
			input: {
				candidate: createMockCandidate({
					id: candidateId,
					discoveryId: "disc_0000000000000007",
					title: "Synthetic vendor claims 90% latency reduction",
					summary:
						"A synthetic vendor benchmark claims a large latency reduction that independent reproduction did not confirm.",
					sourceIds: ["vendor-benchmark"],
					tier: 3,
					researchDomains: ["models-inference-scientific"],
					subdomainTags: ["DOM-02-SD03"],
					ringClassificationDistribution: { 1: 0, 2: 0, 3: 1 },
				}),
				discovery: createMockDiscovery({
					id: "disc_0000000000000007",
					sourceId: "vendor-benchmark",
					publishedAt: "2025-01-14T16:00:00+01:00[Europe/Amsterdam]",
					firstDisclosedAt:
						"2025-01-14T16:00:00+01:00[Europe/Amsterdam]",
					url: "https://vendor.example.com/blog/synthetic-90-percent-latency-reduction",
					title: "Synthetic vendor claims 90% latency reduction",
				}),
				claims: [
					createMockClaim({
						id: claimId,
						candidateId,
						claim: "A synthetic optimization reduces inference latency by 90%.",
						claimType: "benchmark-result",
						originalSource: {
							sourceId: "vendor-benchmark",
							url: "https://vendor.example.com/blog/synthetic-90-percent-latency-reduction",
							title: "Synthetic vendor claims 90% latency reduction",
							publisher: "Synthetic Vendor",
							publicationTimestamp:
								"2025-01-14T16:00:00+01:00[Europe/Amsterdam]",
						},
						evidenceClassification: "VENDOR_CLAIM",
						verificationStatus: "contradicted",
						verificationLevel: "L0",
						confidence: 0.2,
						supportingEvidence: [
							createMockEvidence({
								sourceId: "vendor-benchmark",
								url: "https://vendor.example.com/blog/synthetic-90-percent-latency-reduction",
								extractedText:
									"Synthetic kernel optimization reduces inference latency by 90% on H100. Tested with batch size 1, FP8 precision.",
								timestamp:
									"2025-01-14T16:00:00+01:00[Europe/Amsterdam]",
								timestampType: "original-publication",
								classification: "VENDOR_CLAIM",
								tier: 3,
							}),
						],
						counterevidence: [
							{
								id: "ce_0000000000000001",
								claimId,
								evidenceReference: createMockEvidence({
									sourceId: "independent-lab",
									url: "https://independent.example.com/synthetic-reproduction",
									extractedText:
										"Independent reproduction achieved 35% reduction on the same hardware; the 90% claim was not reproduced.",
									evidenceRole: "counterevidence",
									classification: "RESEARCH_FINDING",
									tier: 2,
								}),
								contradictsClaim:
									"A synthetic optimization reduces inference latency by 90%.",
								contradictionType: "direct",
								description:
									"Independent reproduction achieved 35% reduction; 90% claim not reproduced.",
								confidence: 0.8,
								sourceId: "independent-lab",
								discoveredAt: "2025-01-15T06:00:00Z",
							},
						],
						unresolvedUncertainties: [
							{
								id: "unc_0000000000000001",
								claimId,
								uncertainty:
									"Direct counterevidence identified; the 90% claim may be contradicted.",
								type: "evidence-gap",
								impact: "high",
								blockingVerification: true,
								researchNeeded:
									"Investigate the independent reproduction and the vendor kernel availability.",
							},
						],
						temporalVerification: {
							originalPublicationTimestamp:
								"2025-01-14T16:00:00+01:00[Europe/Amsterdam]",
							firstPublicDisclosureTimestamp:
								"2025-01-14T16:00:00+01:00[Europe/Amsterdam]",
							retrievalTimestamp: "2025-01-15T06:00:00Z",
							indexingTimestamp: "2025-01-15T06:00:00Z",
							timezonePrecision: "exact",
							timestampConfidence: 0.9,
						},
					}),
				],
				entityHints: {
					organizations: [
						"Synthetic Vendor",
						"Synthetic Independent Lab",
					],
					technologies: ["kernel optimization", "inference latency"],
				},
			},
			expected: {
				temporalStatus: "NEW_PASS",
				classification: "VENDOR_CLAIM",
				verificationStatus: "contradicted",
				verificationLevel: "L0",
			},
		});
	}

	// ------------------------------------------------------------------------
	// 8. Unresolved publication timing (TIME_UNVERIFIED)
	// ------------------------------------------------------------------------
	{
		const candidateId = "cand_0000000000000008";
		const claimId = "claim_0000000000000008";
		fixtures.push({
			key: "time-unverified",
			label: "Unresolved publication timing",
			input: {
				candidate: createMockCandidate({
					id: candidateId,
					discoveryId: "disc_0000000000000008",
					title: "Synthetic undated announcement",
					summary:
						"A synthetic announcement without a traceable publication timestamp.",
					sourceIds: ["test-source"],
					tier: 3,
					researchDomains: ["agentic-ai-software-engineering"],
					ringClassificationDistribution: { 1: 0, 2: 0, 3: 1 },
				}),
				discovery: createMockDiscovery({
					id: "disc_0000000000000008",
					sourceId: "test-source",
					publishedAt: undefined,
					url: "https://example.com/undated",
					title: "Synthetic undated announcement",
				}),
				claims: [
					createMockClaim({
						id: claimId,
						candidateId,
						claim: "A synthetic product feature exists.",
						claimType: "technical-announcement",
						evidenceClassification: "UNVERIFIED",
						verificationStatus: "unverified",
						verificationLevel: "L0",
						confidence: 0.1,
						originalSource: {
							sourceId: "test-source",
							url: "https://example.com/undated",
							title: "Synthetic undated announcement",
							publicationTimestamp: "",
						},
						supportingEvidence: [
							createMockEvidence({
								sourceId: "test-source",
								url: "https://example.com/undated",
								extractedText: "Synthetic undated evidence.",
								timestampType: "retrieval",
								classification: "UNVERIFIED",
								tier: 3,
							}),
						],
						temporalVerification: {
							originalPublicationTimestamp: "",
							retrievalTimestamp: "2025-01-15T06:00:00Z",
							indexingTimestamp: "2025-01-15T06:00:00Z",
							timezonePrecision: "unknown",
							timestampConfidence: 0,
						},
					}),
				],
				entityHints: { organizations: ["Synthetic Org"] },
			},
			expected: {
				temporalStatus: "TIME_UNVERIFIED",
				classification: "UNVERIFIED",
				verificationStatus: "unverified",
				verificationLevel: "L0",
			},
		});
	}

	// ------------------------------------------------------------------------
	// 9. CATCH_UP (explicitly dated older material with archive evidence)
	// ------------------------------------------------------------------------
	{
		const candidateId = "cand_0000000000000009";
		const claimId = "claim_0000000000000009";
		const oldDate = "2023-06-15T10:00:00+02:00[Europe/Amsterdam]";
		fixtures.push({
			key: "catch-up",
			label: "Explicitly dated CATCH_UP material",
			input: {
				candidate: createMockCandidate({
					id: candidateId,
					discoveryId: "disc_0000000000000009",
					title: "Archived: synthetic 2023 security advisory",
					summary:
						"Explicitly dated older material with traceable archive evidence.",
					sourceIds: ["arxiv-cs-lg"],
					tier: 1,
					researchDomains: ["architecture-security-governance"],
					ringClassificationDistribution: { 1: 0, 2: 1, 3: 0 },
				}),
				discovery: createMockDiscovery({
					id: "disc_0000000000000009",
					sourceId: "arxiv-cs-lg",
					publishedAt: oldDate,
					firstDisclosedAt: oldDate,
					url: "https://arxiv.org/abs/synthetic-2023-advisory",
					title: "Archived: synthetic 2023 security advisory",
				}),
				claims: [
					createMockClaim({
						id: claimId,
						candidateId,
						claim: "A synthetic 2023 advisory documented a vulnerability class.",
						claimType: "security-vulnerability",
						originalSource: {
							sourceId: "arxiv-cs-lg",
							url: "https://arxiv.org/abs/synthetic-2023-advisory",
							title: "Archived: synthetic 2023 security advisory",
							publicationTimestamp: oldDate,
						},
						evidenceClassification: "RESEARCH_FINDING",
						verificationStatus: "verified",
						verificationLevel: "L1",
						confidence: 0.85,
						supportingEvidence: [
							createMockEvidence({
								sourceId: "arxiv-cs-lg",
								url: "https://arxiv.org/abs/synthetic-2023-advisory",
								extractedText:
									"Synthetic 2023 advisory documenting a vulnerability class.",
								timestamp: oldDate,
								timestampType: "original-publication",
								classification: "RESEARCH_FINDING",
								tier: 1,
							}),
						],
						temporalVerification: {
							originalPublicationTimestamp: oldDate,
							firstPublicDisclosureTimestamp: oldDate,
							retrievalTimestamp: "2025-01-15T06:00:00Z",
							indexingTimestamp: "2025-01-15T06:00:00Z",
							timezonePrecision: "exact",
							timestampConfidence: 0.9,
						},
					}),
				],
				noveltyHints: {
					additionalEvidence: [
						{
							type: "archive_snapshot",
							reference:
								"https://web.archive.org/web/20230615/https://arxiv.org/abs/synthetic-2023-advisory",
							timestamp: oldDate,
							description:
								"Archive snapshot confirming 2023 publication.",
							confidence: 0.9,
						},
					],
				},
				entityHints: { organizations: ["Synthetic Research Lab"] },
			},
			expected: {
				temporalStatus: "CATCH_UP",
				classification: "RESEARCH_FINDING",
				verificationStatus: "verified",
				verificationLevel: "L1",
			},
		});
	}

	// ------------------------------------------------------------------------
	// 10. NEW_FAIL (in-window repost/summary)
	// ------------------------------------------------------------------------
	{
		const candidateId = "cand_0000000000000010";
		const claimId = "claim_0000000000000010";
		fixtures.push({
			key: "new-fail-repost",
			label: "In-window repost/summary (NEW_FAIL)",
			input: {
				candidate: createMockCandidate({
					id: candidateId,
					discoveryId: "disc_0000000000000010",
					title: "Recap: previously announced synthetic features",
					summary:
						"A recap of synthetic features previously reported earlier this year.",
					sourceIds: ["test-source"],
					tier: 2,
					researchDomains: ["agentic-ai-software-engineering"],
					ringClassificationDistribution: { 1: 0, 2: 0, 3: 1 },
				}),
				discovery: createMockDiscovery({
					id: "disc_0000000000000010",
					sourceId: "test-source",
					publishedAt: IN_WINDOW,
					firstDisclosedAt: IN_WINDOW,
					url: "https://example.com/recap",
					title: "Recap: previously announced synthetic features",
				}),
				claims: [
					createMockClaim({
						id: claimId,
						candidateId,
						claim: "A synthetic recap restates previously announced features.",
						claimType: "technical-announcement",
						evidenceClassification: "EXPERT_INTERPRETATION",
						verificationStatus: "partially-verified",
						verificationLevel: "L1",
						confidence: 0.6,
						supportingEvidence: [
							createMockEvidence({
								sourceId: "test-source",
								url: "https://example.com/recap",
								extractedText:
									"Recap of previously announced synthetic features.",
								timestamp: IN_WINDOW,
								timestampType: "original-publication",
								classification: "EXPERT_INTERPRETATION",
								tier: 2,
							}),
						],
						temporalVerification: {
							originalPublicationTimestamp: IN_WINDOW,
							firstPublicDisclosureTimestamp: IN_WINDOW,
							retrievalTimestamp: "2025-01-15T06:00:00Z",
							indexingTimestamp: "2025-01-15T06:00:00Z",
							timezonePrecision: "exact",
							timestampConfidence: 0.8,
						},
					}),
				],
				entityHints: { organizations: ["Synthetic Org"] },
			},
			expected: {
				temporalStatus: "NEW_FAIL",
				classification: "EXPERT_INTERPRETATION",
				verificationStatus: "partially-verified",
				verificationLevel: "L1",
			},
		});
	}

	return fixtures;
}
