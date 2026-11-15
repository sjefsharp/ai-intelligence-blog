/**
 * Omission Review — Types & Interfaces
 *
 * Implements a second, methodologically distinct discovery and omission-detection stage
 * that identifies consequential AI developments potentially missed during initial research.
 *
 * Preserves the established processing sequence:
 * Source Discovery → Retrieval → Temporal Classification → Claim Verification
 * → Canonical Fact Dossier → Omission Review → Editorial Selection → Publication
 */

import type {
	DiscoveryRing,
	SourceFamily,
	CriticalityLevel,
	MonitoringCadence,
} from "../discovery-ledger/types.js";
import type { CandidateNewsItem, DiscoveredItem } from "../signal-desk.js";
import type { ClaimVerificationRecord } from "../evidence-verification/types.js";
import type {
	SourceMonitoringRecord,
	CoverageMetrics,
	MissingSource,
} from "../discovery-ledger/types.js";
import type { NoveltyClassificationResult } from "../novelty-classification.js";
import type {
	CanonicalFactDossier,
	CanonicalCandidate,
} from "../fact-dossier/schema.js";

/** Omission review schema version */
export const OMISSION_REVIEW_VERSION = "1.0.0";

/** Omission classification categories */
export type OmissionClassification =
	| "CRITICAL_OMISSION"
	| "MATERIAL_OMISSION"
	| "COVERED"
	| "SUBSTANTIVE_UPDATE"
	| "DUPLICATE"
	| "NOT_NEW"
	| "INSUFFICIENT_EVIDENCE"
	| "COVERAGE_GAP";

/** Alternative discovery strategy executed */
export type DiscoveryStrategy =
	| "topic-driven-search"
	| "cross-vendor-comparison"
	| "event-centric-search"
	| "original-research-disclosure-search"
	| "unexpected-technical-finding-investigation"
	| "major-economic-organizational-development-search"
	| "emerging-project-researcher-contribution-examination"
	| "prior-edition-historical-comparison"
	| "mandatory-developer-tool-release-index-check"
	| "strategic-advisory-coverage-assessment"
	| "major-launch-sub-announcement-crosscheck";

/** Research domain coverage assessment */
export type ResearchDomain =
	| "foundation-models-reasoning-multimodality"
	| "agentic-ai-autonomous-software-engineering"
	| "coding-agents-skills-mcp-hooks-plugins-apm"
	| "agent-orchestration-evaluation-reliability-observability"
	| "context-engineering-memory-system1-routing"
	| "ai-inference-hardware-infrastructure"
	| "security-sandboxing-software-supply-chains"
	| "architecture-interoperability-open-standards"
	| "enterprise-ai-adoption-organizational-transformation"
	| "developer-productivity-software-delivery"
	| "governance-policy-regulation"
	| "ai-investment-economics-roi-market-developments"
	| "original-scientific-breakthroughs-emerging-research";

/** Evidence that a source was checked during omission review */
export interface OmissionReviewSourceCheck {
	sourceId: string;
	canonicalUrl: string;
	ring: DiscoveryRing[];
	sourceFamily: SourceFamily;
	organization: string;
	researchDomains: ResearchDomain[];
	criticality: CriticalityLevel;
	cadence: MonitoringCadence;
	strategy: DiscoveryStrategy;
	checkedAt: string;
	status:
		| "CHECKED_FOUND"
		| "CHECKED_NONE"
		| "INACCESSIBLE"
		| "ERROR"
		| "NOT_CHECKED";
	newlyDiscoveredCandidateIds: string[];
	evidenceReferences: OmissionReviewEvidenceReference[];
	errors: OmissionReviewError[];
	accessLimitations: OmissionReviewAccessLimitation[];
	incompleteResults?: OmissionReviewIncompleteResults;
	durationMs: number;
}

/** Evidence reference for omission review traceability */
export interface OmissionReviewEvidenceReference {
	type:
		| "original-announcement"
		| "changelog-entry"
		| "github-release"
		| "arxiv-entry"
		| "advisory-public-summary"
		| "research-paper"
		| "interview-podcast"
		| "github-issue"
		| "community-post"
		| "conference-recording";
	locator: string;
	description: string;
	timestamp: string;
	confidence: number;
	url: string;
}

/** Error during omission review source check */
export interface OmissionReviewError {
	code: string;
	message: string;
	statusCode?: number;
	url?: string;
	timestamp: string;
	retryable: boolean;
	category:
		| "network"
		| "authentication"
		| "rate-limit"
		| "parsing"
		| "validation"
		| "timeout"
		| "content"
		| "unknown";
	context?: Record<string, unknown>;
}

/** Access limitation encountered */
export interface OmissionReviewAccessLimitation {
	type:
		| "paywall"
		| "authentication-required"
		| "rate-limited"
		| "cloudflare-protection"
		| "cors"
		| "no-native-rss"
		| "intermittent"
		| "deprecated"
		| "geographic"
		| "other";
	description: string;
	affectedSections: string[];
	workaround?: string;
	severity:
		"blocks-all" | "blocks-partial" | "degrades-quality" | "informational";
	firstObserved: string;
	lastObserved: string;
}

/** Incomplete results details */
export interface OmissionReviewIncompleteResults {
	reason:
		| "pagination-truncated"
		| "time-window-limited"
		| "rate-limit-hit"
		| "partial-feed"
		| "missing-fields"
		| "conditional-request-304"
		| "other";
	description: string;
	estimatedCoveragePercent: number;
	missingItemCount?: number;
	lastProcessedCursor?: string;
	paginationExhausted: boolean;
}

/** Newly discovered candidate during omission review */
export interface OmittedCandidate {
	id: string; // stable ID: omit_[a-z0-9]{16}
	title: string;
	summary: string;
	sourceIds: string[];
	proposedPublicationTimestamp: string;
	firstDisclosureTimestamp?: string;
	eventDate?: string;
	researchDomains: ResearchDomain[];
	subdomainTags: string[];
	ringClassification: DiscoveryRing[];
	evidenceClass:
		| "ORIGINAL_FINDING"
		| "FIRST_HAND_DISCLOSURE"
		| "INDEPENDENT_ANALYSIS"
		| "EXPERT_INTERPRETATION"
		| "UNVERIFIED_CLAIM";
	tier: 1 | 2 | 3;
	sourceUrls: string[];
	discoveredByStrategy: DiscoveryStrategy;
	discoveredAt: string;
	claims: OmittedClaim[];
	omissionClassification: OmissionClassification;
	omissionReasoning: string;
	noveltyClassification?: NoveltyClassificationResult;
	verificationRecords?: ClaimVerificationRecord[];
	repairStatus:
		| "PENDING"
		| "VERIFIED_AND_ADDED"
		| "VERIFIED_REJECTED"
		| "UNRESOLVED"
		| "EVIDENCE_UNAVAILABLE";
	repairedAt?: string;
	repairedBy?: string;
}

/** Claim within an omitted candidate */
export interface OmittedClaim {
	claim: string;
	claimType: OmittedClaimType;
	sourceId: string;
	evidenceClass:
		| "ORIGINAL_FINDING"
		| "FIRST_HAND_DISCLOSURE"
		| "INDEPENDENT_ANALYSIS"
		| "EXPERT_INTERPRETATION"
		| "UNVERIFIED_CLAIM";
	ringClassification: DiscoveryRing[];
	needsVerification: boolean;
	proposedLevel: "L1" | "L2" | "L3";
}

/** Claim type for omitted candidates (subset of full claim types) */
export type OmittedClaimType =
	| "technical-announcement"
	| "software-release"
	| "scientific-research"
	| "benchmark-result"
	| "strategic-research"
	| "advisory-finding"
	| "enterprise-adoption"
	| "productivity-claim"
	| "roi-claim"
	| "economic-impact"
	| "original-reporting"
	| "vendor-announcement"
	| "policy-regulation"
	| "security-vulnerability";

/** Substantive update to an existing candidate */
export interface SubstantiveUpdate {
	existingCandidateId: string;
	existingCandidateStableId: string;
	updateTitle: string;
	updateSummary: string;
	newPublicationTimestamp: string;
	newlyRevealedFacts: string[];
	updatedFields: (
		| "title"
		| "summary"
		| "claims"
		| "timestamps"
		| "sources"
		| "researchDomains"
	)[];
	sourceUrls: string[];
	discoveredByStrategy: DiscoveryStrategy;
	discoveredAt: string;
	noveltyClassification?: NoveltyClassificationResult;
	verificationRecords?: ClaimVerificationRecord[];
	repairStatus:
		"PENDING" | "VERIFIED_AND_UPDATED" | "VERIFIED_REJECTED" | "UNRESOLVED";
	repairedAt?: string;
	repairedBy?: string;
}

/** Coverage assessment across all dimensions */
export interface OmissionCoverageAssessment {
	byRing: RingOmissionCoverage[];
	byResearchDomain: DomainOmissionCoverage[];
	bySourceFamily: SourceFamilyOmissionCoverage[];
	byOrganization: OrganizationOmissionCoverage[];
	byCriticality: CriticalityOmissionCoverage[];
	byStrategy: StrategyExecutionRecord[];
	mandatoryToolChecks: MandatoryToolCheck[];
	strategicResearchGaps: StrategicResearchGap[];
	overall: OverallOmissionCoverage;
}

/** Coverage for a discovery ring in omission review */
export interface RingOmissionCoverage {
	ring: DiscoveryRing;
	sourcesInRegistry: number;
	sourcesCheckedInInitialDiscovery: number;
	sourcesRecheckedInOmissionReview: number;
	newlyDiscoveredCandidates: number;
	coverageGaps: RingCoverageGap[];
}

/** Gap in ring coverage */
export interface RingCoverageGap {
	sourceId: string;
	sourceFamily: SourceFamily;
	organization: string;
	reason:
		| "never-registered"
		| "registered-but-not-checked"
		| "checked-but-incomplete"
		| "access-failed"
		| "no-longer-publishing";
	impact: "critical" | "high" | "medium" | "low";
	description: string;
}

/** Coverage for a research domain */
export interface DomainOmissionCoverage {
	domain: ResearchDomain;
	domainLabel: string;
	sourcesRegistered: number;
	sourcesChecked: number;
	candidatesInDossier: number;
	newlyDiscoveredCandidates: number;
	coveragePercent: number;
	underrepresented: boolean;
	missingSourceFamilies: SourceFamily[];
}

/** Coverage for a source family */
export interface SourceFamilyOmissionCoverage {
	family: SourceFamily;
	sourcesRegistered: number;
	sourcesChecked: number;
	sourcesWithFindings: number;
	newlyDiscoveredCandidates: number;
	organizations: string[];
	ringsCovered: DiscoveryRing[];
	domainsCovered: ResearchDomain[];
	coverageGap: boolean;
	gapReason?: string;
}

/** Coverage for an organization */
export interface OrganizationOmissionCoverage {
	organization: string;
	sourcesRegistered: number;
	sourcesChecked: number;
	sourcesWithFindings: number;
	newlyDiscoveredCandidates: number;
	sourceFamilies: SourceFamily[];
	criticalityLevels: CriticalityLevel[];
	overrepresented: boolean;
	underrepresented: boolean;
}

/** Coverage by criticality */
export interface CriticalityOmissionCoverage {
	criticality: CriticalityLevel;
	sourcesRegistered: number;
	sourcesScheduled: number;
	sourcesChecked: number;
	sourcesInaccessible: number;
	mandatorySourcesAllChecked: boolean;
	missingMandatorySources: string[];
}

/** Record of a discovery strategy execution */
export interface StrategyExecutionRecord {
	strategy: DiscoveryStrategy;
	executed: boolean;
	executedAt?: string;
	durationMs?: number;
	sourcesQueried: number;
	candidatesFound: number;
	candidatesClassified: OmissionClassification[];
	errors: string[];
	notes: string;
}

/** Mandatory developer tool check result */
export interface MandatoryToolCheck {
	tool:
		| "vscode"
		| "github-copilot-cli"
		| "github-copilot-coding-agent"
		| "openai-codex"
		| "openai-codex-cli"
		| "anthropic-claude-code"
		| "google-gemini-cli"
		| "visual-studio"
		| "jetbrains"
		| "cursor"
		| "windsurf"
		| "cline"
		| "aider"
		| "opencode";
	vendor: string;
	releaseIndexChecked: boolean;
	changelogChecked: boolean;
	githubReleasesChecked: boolean;
	blogAnnouncementsChecked: boolean;
	newlyDiscoveredReleases: string[];
	coverageGap: boolean;
	gapDescription?: string;
}

/** Strategic research gap identification */
export interface StrategicResearchGap {
	source:
		| "gartner"
		| "mckinsey"
		| "forrester"
		| "idc"
		| "academic"
		| "other-advisory";
	topic: string;
	publicSummaryAvailable: boolean;
	methodologyDisclosed: boolean;
	paywalled: boolean;
	significance: "critical" | "high" | "medium" | "low";
	missingFromDossier: boolean;
	reason:
		| "not-monitored"
		| "paywall-blocked"
		| "methodology-not-disclosed"
		| "not-temporally-eligible"
		| "insufficient-evidence";
	evidenceUrl?: string;
}

/** Overall coverage summary */
export interface OverallOmissionCoverage {
	initialCandidateCount: number;
	omittedCandidatesFound: number;
	criticalOmissions: number;
	materialOmissions: number;
	substantiveUpdatesFound: number;
	duplicatesIdentified: number;
	coverageGaps: number;
	sourcesUnchecked: number;
	strategiesExecuted: number;
	completenessScore: number; // 0-100
}

/** Omission review execution context */
export interface OmissionReviewContext {
	editionDate: string;
	dossierVersion: string;
	initialCandidateCount: number;
	dossierId: string;
	startedAt: string;
	completedAt?: string;
	executedStrategies: DiscoveryStrategy[];
	executionId: string;
	gitCommit?: string;
	reviewerId: string;
}

/** Complete omission review report */
export interface OmissionReviewReport {
	version: string;
	context: OmissionReviewContext;
	reviewedDossierVersion: string;
	initialCandidateCount: number;
	alternativeStrategiesExecuted: StrategyExecutionRecord[];
	sourcesAndDomainsInspected: {
		ringsAssessed: DiscoveryRing[];
		researchDomainsAssessed: ResearchDomain[];
		sourceFamiliesAssessed: SourceFamily[];
		organizationsAssessed: string[];
	};
	newlyDiscoveredCandidates: OmittedCandidate[];
	substantiveUpdates: SubstantiveUpdate[];
	omissionClassifications: Record<string, OmissionClassification>; // candidateId -> classification
	criticalAndMaterialOmissionsRepaired: {
		candidateId: string;
		repairAction: "ADDED_TO_DOSSIER" | "UPDATED_EXISTING" | "UNRESOLVED";
		verificationOutcome:
			| "VERIFIED"
			| "PARTIALLY_VERIFIED"
			| "REJECTED"
			| "EVIDENCE_UNAVAILABLE";
		timestamp: string;
	}[];
	existingCandidatesUpdated: {
		candidateId: string;
		updateType:
			| "SUBSTANTIVE_UPDATE"
			| "CORRECTION"
			| "CLAIM_ADDED"
			| "CLAIM_REMOVED";
		timestamp: string;
	}[];
	remainingCoverageGaps: {
		type:
			| "SOURCE_UNAVAILABLE"
			| "DOMAIN_UNDERREPRESENTED"
			| "RING_GAP"
			| "MANDATORY_TOOL_MISSING"
			| "STRATEGIC_RESEARCH_GAP"
			| "LANGUAGE_GEOGRAPHIC_GAP";
		description: string;
		significance: "critical" | "high" | "medium" | "low";
		affectedSources: string[];
		affectedDomains: ResearchDomain[];
		mitigation?: string;
	}[];
	finalDossierVersion: string;
	executionTimestamps: {
		startedAt: string;
		strategyExecutionCompletedAt?: string;
		candidateInvestigationCompletedAt?: string;
		verificationCompletedAt?: string;
		dossierRepairCompletedAt?: string;
		reportFinalizedAt: string;
	};
	verificationOutcomes: {
		totalCandidatesInvestigated: number;
		verifiedAndAdded: number;
		verifiedAndRejected: number;
		evidenceUnavailable: number;
		unresolved: number;
	};
}

/** Input for running omission review */
export interface OmissionReviewInput {
	editionDate: string;
	canonicalDossier: CanonicalFactDossier;
	discoveryLedgerRecords: SourceMonitoringRecord[];
	sourceRegistry: Map<
		string,
		{
			id: string;
			url: string;
			tier: 1 | 2 | 3;
			type: string;
			ringAffinity: DiscoveryRing[];
			researchDomains: string[];
			sourceFamily: SourceFamily;
			organization: string;
			criticality: CriticalityLevel;
			cadence: MonitoringCadence;
		}
	>;
	previousEditionDossiers?: CanonicalFactDossier[];
	reviewerId: string;
	gitCommit?: string;
}

/** Result of omission review execution */
export interface OmissionReviewResult {
	report: OmissionReviewReport;
	updatedDossier: CanonicalFactDossier;
	addedCandidates: CanonicalCandidate[];
	updatedCandidates: CanonicalCandidate[];
}

/** Coverage gap for reporting */
export interface CoverageGapReport {
	gapId: string;
	type:
		| "SOURCE_UNAVAILABLE"
		| "DOMAIN_UNDERREPRESENTED"
		| "RING_GAP"
		| "MANDATORY_TOOL_MISSING"
		| "STRATEGIC_RESEARCH_GAP"
		| "LANGUAGE_GEOGRAPHIC_GAP";
	description: string;
	significance: "critical" | "high" | "medium" | "low";
	affectedSources: string[];
	affectedDomains: ResearchDomain[];
	discoveredAt: string;
	mitigation?: string;
	blockingReviewCompleteness: boolean;
}

export type {
	DiscoveryRing,
	SourceFamily,
	CriticalityLevel,
	MonitoringCadence,
	CandidateNewsItem,
	DiscoveredItem,
	ClaimVerificationRecord,
	SourceMonitoringRecord,
	CoverageMetrics,
	MissingSource,
	NoveltyClassificationResult,
	CanonicalFactDossier,
	CanonicalCandidate,
};
