/**
 * Discovery Ledger — Deterministic, Auditable Evidence of Source Monitoring
 *
 * Extends the existing collection pipeline with a structured, versioned ledger
 * that records every source monitoring attempt across all three discovery rings.
 * Provides coverage metrics, execution traceability, and historical regression detection.
 */

import type {
	DiscoveryRing,
	RetrievalStatus,
	SourceConfig,
	RetrievalResult,
	RetrievalError,
	CollectedItem,
	SourceType,
} from "../collection/types.js";

export type { DiscoveryRing, RetrievalStatus } from "../collection/types.js";

/** Discovery ledger schema version */
export const DISCOVERY_LEDGER_VERSION = "1.0.0";

/** Source family classification for coverage analysis */
export type SourceFamily =
	| "benchmark-repositories"
	| "conference-proceedings"
	| "arxiv-categories"
	| "cloud-provider-architecture"
	| "cloud-provider-ai-ml"
	| "major-ai-lab-blogs"
	| "research-institutions"
	| "advisory-organizations"
	| "security-advisories"
	| "coding-agent-vendor"
	| "coding-agent-community"
	| "ai-ide-releases"
	| "aggregator-feeds"
	| "independent-researchers"
	| "developer-tools"
	| "infrastructure-vendors"
	| "standards-bodies"
	| "regulatory-bodies"
	| "academic-journals";

/** Criticality level for monitoring priority */
export type CriticalityLevel =
	"mandatory" | "high" | "standard" | "supplementary";

/** Monitoring cadence */
export type MonitoringCadence =
	| "continuous"
	| "daily"
	| "weekly"
	| "bi-weekly"
	| "monthly"
	| "quarterly"
	| "manual";

/** Execution environment context */
export interface ExecutionContext {
	/** Unique execution identifier (UUID v4) */
	executionId: string;
	/** Edition date this execution serves (YYYY-MM-DD) */
	editionDate: string;
	/** When execution started (ISO 8601 with timezone) */
	startedAt: string;
	/** When execution completed (ISO 8601 with timezone) */
	completedAt?: string;
	/** Discovery rings included in this execution */
	rings: DiscoveryRing[];
	/** Source IDs targeted in this execution */
	sourceIds: string[];
	/** Git commit SHA of the collector code */
	gitCommit?: string;
	/** Collector version */
	collectorVersion: string;
	/** Timezone used for this execution */
	timezone: string;
	/** Node.js version */
	nodeVersion: string;
	/** Platform */
	platform: string;
}

/** Single source monitoring attempt record */
export interface SourceMonitoringRecord {
	/** Stable source ID from registry */
	sourceId: string;
	/** Canonical URL from registry */
	canonicalUrl: string;
	/** Discovery ring(s) this source belongs to */
	rings: DiscoveryRing[];
	/** Research domain(s) covered */
	researchDomains: string[];
	/** Source family for coverage aggregation */
	sourceFamily: SourceFamily;
	/** Source organization/vendor */
	organization: string;
	/** Criticality level */
	criticality: CriticalityLevel;
	/** Monitoring cadence */
	cadence: MonitoringCadence;
	/** Retrieval adapter used */
	adapterId: string;
	/** Actual access method (e.g., 'rss-feed', 'github-api-releases', 'arxiv-api', 'html-scraping') */
	accessMethod: string;
	/** Requested check timestamp (ISO 8601 with timezone) */
	requestedAt: string;
	/** Actual check timestamp (ISO 8601 with timezone) */
	checkedAt: string;
	/** Timezone of the check */
	checkTimezone: string;
	/** Source publication timestamps found (if available) */
	sourcePublicationTimestamps: string[];
	/** Latest item publication timestamp found */
	latestItemPublishedAt?: string;
	/** Retrieval outcome status */
	status: RetrievalStatus;
	/** Discovered candidate IDs */
	discoveredCandidateIds: string[];
	/** Number of new items discovered */
	newItemCount: number;
	/** Number of updated items */
	updatedItemCount: number;
	/** Original source URLs for each discovered item */
	sourceUrls: string[];
	/** Evidence references (specific URLs, selectors, API endpoints) */
	evidenceReferences: EvidenceReference[];
	/** Errors encountered */
	errors: MonitoringError[];
	/** Access limitations noted */
	accessLimitations: AccessLimitation[];
	/** Incomplete results details */
	incompleteResults?: IncompleteResults;
	/** Execution identifier linking to execution context */
	executionId: string;
	/** Edition date */
	editionDate: string;
	/** Whether this was a scheduled check */
	scheduled: boolean;
	/** Check duration in milliseconds */
	durationMs: number;
	/** Retry attempt number (1 = first attempt) */
	attemptNumber: number;
	/** Whether this record is a retry of a previous attempt */
	isRetry: boolean;
	/** Previous execution ID if retry */
	previousExecutionId?: string;
}

/** Evidence reference for traceability */
export interface EvidenceReference {
	/** Type of evidence */
	type:
		| "rss-entry"
		| "github-release"
		| "github-commit"
		| "arxiv-entry"
		| "html-element"
		| "json-api-response"
		| "feed-item";
	/** Specific URL or selector */
	locator: string;
	/** Human-readable description */
	description: string;
	/** Timestamp of the evidence */
	timestamp: string;
	/** Confidence in this evidence (0-1) */
	confidence: number;
}

/** Monitoring error with full context */
export interface MonitoringError {
	/** Error code */
	code: string;
	/** Human-readable message */
	message: string;
	/** HTTP status if applicable */
	statusCode?: number;
	/** URL that caused error */
	url?: string;
	/** Timestamp (ISO 8601 with timezone) */
	timestamp: string;
	/** Whether error is retryable */
	retryable: boolean;
	/** Error category for analysis */
	category:
		| "network"
		| "authentication"
		| "rate-limit"
		| "parsing"
		| "validation"
		| "timeout"
		| "content"
		| "unknown";
	/** Additional context */
	context?: Record<string, unknown>;
	/** Stack trace if available */
	stack?: string;
}

/** Access limitation details */
export interface AccessLimitation {
	/** Type of limitation */
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
	/** Description */
	description: string;
	/** Affected sections/endpoints */
	affectedSections: string[];
	/** Workaround if any */
	workaround?: string;
	/** Severity */
	severity:
		"blocks-all" | "blocks-partial" | "degrades-quality" | "informational";
	/** First observed */
	firstObserved: string;
	/** Last observed */
	lastObserved: string;
}

/** Incomplete results details */
export interface IncompleteResults {
	/** Reason for incompleteness */
	reason:
		| "pagination-truncated"
		| "time-window-limited"
		| "rate-limit-hit"
		| "partial-feed"
		| "missing-fields"
		| "conditional-request-304"
		| "other";
	/** Description */
	description: string;
	/** Estimated coverage percentage (0-100) */
	estimatedCoveragePercent: number;
	/** Items that could not be retrieved */
	missingItemCount?: number;
	/** Last successfully processed cursor/page */
	lastProcessedCursor?: string;
	/** Whether pagination was exhausted */
	paginationExhausted: boolean;
}

/** Coverage metrics by dimension */
export interface CoverageMetrics {
	/** By discovery ring */
	byRing: RingCoverage[];
	/** By research domain */
	byDomain: DomainCoverage[];
	/** By source family */
	bySourceFamily: SourceFamilyCoverage[];
	/** By organization */
	byOrganization: OrganizationCoverage[];
	/** By criticality */
	byCriticality: CriticalityCoverage[];
	/** By cadence */
	byCadence: CadenceCoverage[];
	/** Overall summary */
	overall: OverallCoverage;
	/** Missing high-value sources */
	missingHighValueSources: MissingSource[];
	/** Critical unvisited sources */
	criticalUnvisitedSources: string[];
}

/** Coverage for a single discovery ring */
export interface RingCoverage {
	ring: DiscoveryRing;
	sourcesRegistered: number;
	sourcesScheduled: number;
	sourcesAttempted: number;
	sourcesSuccessful: number; // CHECKED_FOUND + CHECKED_NONE
	sourcesWithFindings: number; // CHECKED_FOUND
	sourcesEmpty: number; // CHECKED_NONE
	sourcesInaccessible: number; // INACCESSIBLE
	sourcesNotChecked: number; // NOT_CHECKED
	sourcesError: number; // ERROR
	coveragePercent: number; // attempted / scheduled
	successRatePercent: number; // successful / attempted
	totalItemsDiscovered: number;
	totalNewItems: number;
}

/** Coverage for a single research domain */
export interface DomainCoverage {
	domainId: string;
	domainLabel: string;
	sourcesRegistered: number;
	sourcesScheduled: number;
	sourcesAttempted: number;
	sourcesSuccessful: number;
	sourcesWithFindings: number;
	sourcesInaccessible: number;
	sourcesNotChecked: number;
	coveragePercent: number;
	successRatePercent: number;
	totalItemsDiscovered: number;
	ringsCovered: DiscoveryRing[];
}

/** Coverage for a single source family */
export interface SourceFamilyCoverage {
	family: SourceFamily;
	sourcesRegistered: number;
	sourcesScheduled: number;
	sourcesAttempted: number;
	sourcesSuccessful: number;
	sourcesWithFindings: number;
	sourcesInaccessible: number;
	sourcesNotChecked: number;
	coveragePercent: number;
	successRatePercent: number;
	organizations: string[];
	ringsCovered: DiscoveryRing[];
	domainsCovered: string[];
}

/** Coverage for a single organization */
export interface OrganizationCoverage {
	organization: string;
	sourcesRegistered: number;
	sourcesScheduled: number;
	sourcesAttempted: number;
	sourcesSuccessful: number;
	sourcesWithFindings: number;
	sourcesInaccessible: number;
	sourcesNotChecked: number;
	coveragePercent: number;
	successRatePercent: number;
	sourceFamilies: SourceFamily[];
	criticalityLevels: CriticalityLevel[];
}

/** Coverage by criticality level */
export interface CriticalityCoverage {
	criticality: CriticalityLevel;
	sourcesRegistered: number;
	sourcesScheduled: number;
	sourcesAttempted: number;
	sourcesSuccessful: number;
	sourcesWithFindings: number;
	sourcesInaccessible: number;
	sourcesNotChecked: number;
	coveragePercent: number;
	mandatorySourcesAllChecked: boolean;
}

/** Coverage by monitoring cadence */
export interface CadenceCoverage {
	cadence: MonitoringCadence;
	sourcesRegistered: number;
	sourcesScheduled: number;
	sourcesAttempted: number;
	sourcesSuccessful: number;
	sourcesInaccessible: number;
	sourcesNotChecked: number;
	coveragePercent: number;
	overdueCount: number; // sources that missed their scheduled check
}

/** Overall coverage summary */
export interface OverallCoverage {
	totalSourcesRegistered: number;
	totalSourcesScheduled: number;
	totalSourcesAttempted: number;
	totalSourcesSuccessful: number;
	totalSourcesWithFindings: number;
	totalSourcesInaccessible: number;
	totalSourcesNotChecked: number;
	totalSourcesError: number;
	overallCoveragePercent: number;
	overallSuccessRatePercent: number;
	totalItemsDiscovered: number;
	totalNewItems: number;
	executionDurationMs: number;
	ringsCovered: DiscoveryRing[];
	domainsCovered: number;
	sourceFamiliesCovered: number;
	organizationsCovered: number;
}

/** Missing high-value source identification */
export interface MissingSource {
	sourceId: string;
	sourceFamily: SourceFamily;
	organization: string;
	researchDomains: string[];
	rings: DiscoveryRing[];
	criticality: CriticalityLevel;
	reason:
		| "never-registered"
		| "registered-but-inactive"
		| "registered-but-not-scheduled"
		| "scheduled-but-failed"
		| "scheduled-but-not-checked";
	lastSuccessfulCheck?: string;
	consecutiveFailures?: number;
	impactAssessment: "critical" | "high" | "medium" | "low";
}

/** Historical monitoring record for regression detection */
export interface HistoricalMonitoringRecord {
	executionId: string;
	editionDate: string;
	startedAt: string;
	completedAt: string;
	durationMs: number;
	coverage: CoverageMetrics;
	sourceRecords: SourceMonitoringRecord[];
	anomalies: MonitoringAnomaly[];
}

/** Monitoring anomaly for regression detection */
export interface MonitoringAnomaly {
	type:
		| "missed-scheduled-check"
		| "recurring-failure"
		| "coverage-deterioration"
		| "outdated-configuration"
		| "new-inaccessible-source"
		| "unexpected-zero-findings"
		| "execution-delay"
		| "duplicate-execution";
	severity: "critical" | "warning" | "info";
	sourceId?: string;
	description: string;
	detectedAt: string;
	details: Record<string, unknown>;
	suggestedAction?: string;
}

/** Candidate traceability record */
export interface CandidateTraceabilityRecord {
	/** Candidate ID */
	candidateId: string;
	/** Edition date */
	editionDate: string;
	/** Source discovery records that contributed to this candidate */
	sourceDiscoveries: SourceDiscoveryLink[];
	/** Novelty classification */
	noveltyClassification: NoveltyClassificationLink;
	/** Evidence verification */
	evidenceVerification: EvidenceVerificationLink[];
	/** Editorial disposition */
	editorialDisposition: EditorialDispositionLink;
	/** Full traceability chain */
	traceabilityChain: TraceabilityStep[];
}

/** Link from candidate to source discovery */
export interface SourceDiscoveryLink {
	discoveryId: string;
	sourceId: string;
	sourceMonitoringRecordId: string; // Links to SourceMonitoringRecord
	evidenceUrl: string;
	evidenceReference: EvidenceReference;
	ringClassification: DiscoveryRing[];
	evidenceClass: string;
	discoveredAt: string;
}

/** Link to novelty classification */
export interface NoveltyClassificationLink {
	classificationId: string;
	classification: "NEW" | "CATCH_UP" | "TIME_UNVERIFIED";
	editionDate: string;
	inWindow: boolean;
	primaryPublicationTimestamp: string;
	confidence: number;
	classifiedAt: string;
	classifiedBy: string;
}

/** Link to evidence verification */
export interface EvidenceVerificationLink {
	verificationId: string;
	claimId: string;
	sourceId: string;
	verificationStatus:
		"verified" | "unverified" | "contradicted" | "insufficient-evidence";
	verifiedAt: string;
	verifiedBy: string;
	evidenceUrls: string[];
}

/** Link to editorial disposition */
export interface EditorialDispositionLink {
	dispositionId: string;
	status: "selected" | "rejected" | "deferred" | "pending";
	decidedAt: string;
	decidedBy: string;
	rationale: string;
	publicationId?: string;
}

/** Single step in traceability chain */
export interface TraceabilityStep {
	step:
		| "source-discovery"
		| "novelty-classification"
		| "claim-verification"
		| "editorial-selection"
		| "publication";
	timestamp: string;
	actor: string; // system, editor, verifier, etc.
	inputIds: string[];
	outputIds: string[];
	notes?: string;
}

/** Discovery ledger entry (for storage) */
export interface DiscoveryLedgerEntry {
	version: string;
	createdAt: string;
	executionContext: ExecutionContext;
	sourceRecords: SourceMonitoringRecord[];
	coverageMetrics: CoverageMetrics;
	candidateTraceability: CandidateTraceabilityRecord[];
	anomalies: MonitoringAnomaly[];
}

/** Ledger query options */
export interface LedgerQuery {
	editionDate?: string;
	executionId?: string;
	sourceId?: string;
	ring?: DiscoveryRing;
	domain?: string;
	sourceFamily?: SourceFamily;
	organization?: string;
	criticality?: CriticalityLevel;
	status?: RetrievalStatus;
	startDate?: string;
	endDate?: string;
	limit?: number;
	offset?: number;
}

/** Ledger statistics */
export interface LedgerStats {
	totalExecutions: number;
	totalSourceRecords: number;
	dateRange: { earliest: string; latest: string };
	uniqueSources: number;
	uniqueOrganizations: number;
	coverageHistory: CoverageTrendPoint[];
}

/** Coverage trend over time */
export interface CoverageTrendPoint {
	editionDate: string;
	executionId: string;
	overallCoveragePercent: number;
	overallSuccessRatePercent: number;
	totalItemsDiscovered: number;
	sourcesAttempted: number;
	sourcesInaccessible: number;
	anomaliesCount: number;
}
